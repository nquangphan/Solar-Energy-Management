// hand-authored — the signed-in app (Story 10.7, orders/stock/money/documents
// Story 10.8): the router over every signed-in screen, built once the account's
// permissions (`/me`) are known.
//
// Permissions are fetched once per session (PermissionsProvider, keyed by sign-in
// in PnsApp), so the router is built once: its initial location and its gate come
// from that set. Every route is registered; the top-level redirect sends a path the
// account may not open — or one that does not exist — back to the landing page,
// using the same gate as the Menu and the tabs (app_routes.dart, AD-17).
//
// Sub-screens are PUSHED (the Android back button pops to the previous screen); a
// bottom-nav tab is a `go`. A screen that opens a WRITING screen gets a callback
// returning the push future and reads its data again when it completes: the
// screen underneath stays alive with its old state. A form that is done is popped
// before its result is pushed (never pushReplacement: go_router drops the
// replaced route's push future, so the screen below would never reload).
//
// The buttons follow the web (AppRoutes.tsx): the same callbacks are passed under
// the same permission keys. Gating is UX; the backend enforces every request (AD-4).
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design_system/components/components.dart';
import '../design_system/gating/app_permission_keys.g.dart';
import '../design_system/gating/app_permissions.dart';
import '../design_system/session/app_session.dart';
import '../design_system/shell/app_bottom_nav.dart';
import '../design_system/shell/app_menu_nav.dart';
import '../design_system/shell/app_phone_frame.dart';
import '../design_system/tokens/app_tokens.dart';
import '../screens/account/profile_screen.dart';
import '../screens/contracts/contracts_screen.dart';
import '../screens/customers/customer_detail_screen.dart';
import '../screens/customers/customer_list_screen.dart';
import '../screens/customers/customer_pick_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/inventory/inventory_screen.dart';
import '../screens/inventory/stock_vouchers_screen.dart';
import '../screens/invoices/invoice_detail_screen.dart';
import '../screens/invoices/invoices_screen.dart';
import '../screens/menu/menu_screen.dart';
import '../screens/orders/create_quote_screen.dart';
import '../screens/orders/discount_approval_screen.dart';
import '../screens/orders/order_detail_screen.dart';
import '../screens/orders/order_list_screen.dart';
import '../screens/orders/order_status_change_screen.dart';
import '../screens/payments/payment_schedule_screen.dart';
import '../screens/permissions/account_form_screen.dart';
import '../screens/permissions/account_list_screen.dart';
import '../screens/permissions/account_permissions_screen.dart';
import '../screens/warranty/warranty_lookup_screen.dart';
import 'app_chrome.dart';
import 'app_ports.dart';
import 'app_routes.dart';

/// Indexes of the locked bottom-nav tabs that open a screen.
const int _homeTab = 0;
const int _ordersTab = 1;
const int _inventoryTab = 3;
const int _menuTab = 4;

class SignedInApp extends StatefulWidget {
  const SignedInApp({
    super.key,
    required this.ports,
    required this.onLogout,
    required this.onRetry,
  });

  final AppPorts ports;

  /// Signs out; the app returns to Đăng nhập when it completes.
  final Future<void> Function() onLogout;

  /// Fetches `/me` again after it failed.
  final VoidCallback onRetry;

  @override
  State<SignedInApp> createState() => _SignedInAppState();
}

class _SignedInAppState extends State<SignedInApp> {
  GoRouter? _router;
  Set<PermissionKey> _perms = const <PermissionKey>{};

  /// Tells the order list to read again although no push future of its own
  /// completed: a quote opened from the Tạo FAB closes, the order a confirmed
  /// quote opened closes, or the Đơn hàng tab is tapped (a `go` drops the pushed
  /// screens without completing their futures). Never `router.refresh()`: run
  /// while a pop is settling, it re-applies the location being left.
  final ValueNotifier<int> _ordersReload = ValueNotifier<int>(0);

  /// The same for Tồn kho when the Kho tab is tapped over Phiếu kho.
  final ValueNotifier<int> _inventoryReload = ValueNotifier<int>(0);

  /// The same for Trang chủ when its tab is tapped again: the figures read again.
  final ValueNotifier<int> _homeReload = ValueNotifier<int>(0);

  @override
  void dispose() {
    _router?.dispose();
    _ordersReload.dispose();
    _inventoryReload.dispose();
    _homeReload.dispose();
    super.dispose();
  }

  GoRouter _buildRouter(Set<PermissionKey> perms) {
    final landing = landingPath(perms);
    final ports = widget.ports;
    bool may(PermissionKey key) => can(perms, key);
    // A sub-screen's back: pop when there is something under it (a deep path opened
    // on its own has nothing), otherwise go to the landing page.
    void back(BuildContext context) => context.canPop() ? context.pop() : context.go(landing);
    String id(GoRouterState state) => state.pathParameters['id']!;

    return GoRouter(
      initialLocation: landing,
      redirect: (context, state) => isOpenable(state.uri.path, perms) ? null : landing,
      routes: [
        GoRoute(
          path: kHomePath,
          builder: (context, state) =>
              DashboardScreen(port: ports.dashboard, reloadSignal: _homeReload),
        ),
        GoRoute(
          path: kMenuPath,
          builder: (context, state) => MenuScreen(
            sections: filterNav(kMobileMenu, perms),
            onOpen: (key) => context.push(kNavRoutes[key]!),
            onLogout: widget.onLogout,
          ),
        ),
        GoRoute(
          path: kCustomersPath,
          builder: (context, state) => CustomerListScreen(
            port: ports.customers,
            onOpen: (phone) => context.push(customerPath(phone)),
            onAdd: () => context.push(kCustomerLookupPath),
          ),
        ),
        // Before `/customers/:phone`, which would otherwise take `lookup` for a phone.
        GoRoute(
          path: kCustomerLookupPath,
          builder: (context, state) => CustomerPickScreen(
            port: ports.customers,
            // The pick/create form is done once a customer is chosen: it leaves the stack
            // (the list underneath re-reads) and the customer opens over the list, so Back
            // never returns to a filled form that would only re-submit a duplicate.
            onSelect: (customer) {
              final router = GoRouter.of(context);
              if (router.canPop()) router.pop();
              router.push(customerPath(customer.phone));
            },
          ),
        ),
        GoRoute(
          path: '$kCustomersPath/:phone',
          builder: (context, state) =>
              CustomerDetailScreen(port: ports.customers, sdt: state.pathParameters['phone']!),
        ),
        GoRoute(
          path: kWarrantyPath,
          builder: (context, state) => WarrantyLookupScreen(port: ports.warranty),
        ),
        GoRoute(
          path: kPermissionsPath,
          builder: (context, state) => AccountListScreen(
            port: ports.accounts,
            // The list reads again when the matrix closes (it may have saved).
            onOpen: (accountId) => context.push(permissionAccountPath(accountId)),
            // The form pops with the new id, then its matrix opens: a pushReplacement would
            // drop this future, and the list would never read again.
            onCreate: () async {
              final String? created = await context.push<String>(kAccountNewPath);
              if (created != null && context.mounted) await context.push(permissionAccountPath(created));
            },
          ),
        ),
        // The form routes before `/permissions/:id`, which would otherwise read `new` as an id.
        GoRoute(
          path: kAccountNewPath,
          builder: (context, state) => AccountFormScreen(
            port: ports.accounts,
            onDone: (accountId) => context.pop(accountId),
            onBack: () => back(context),
          ),
        ),
        GoRoute(
          path: '$kPermissionsPath/:id/edit',
          builder: (context, state) => AccountFormScreen(
            port: ports.accounts,
            accountId: id(state),
            onDone: (accountId) => context.pop(accountId),
            onBack: () => back(context),
          ),
        ),
        GoRoute(
          path: '$kPermissionsPath/:id',
          builder: (context, state) => AccountPermissionsScreen(
            port: ports.accounts,
            accountId: id(state),
            onBack: () => back(context),
            onEdit: () => context.push(accountEditPath(id(state))),
          ),
        ),
        GoRoute(
          path: kProfilePath,
          builder: (context, state) => ProfileScreen(port: ports.password),
        ),
        GoRoute(
          path: kOrdersPath,
          builder: (context, state) => OrderListScreen(
            reloadSignal: _ordersReload,
            port: ports.orders,
            perms: perms,
            onOpen: (orderId) => context.push(orderPath(orderId)),
            onAdd: may(AppPermissionKeys.quotesCreateEdit) ? () => context.push(kOrderNewPath) : null,
            onOpenDiscountApprovals:
                may(AppPermissionKeys.discountsApprove) ? () => context.push(kDiscountApprovalsPath) : null,
          ),
        ),
        // The two static children before `/orders/:id`, which would otherwise take them for an id.
        GoRoute(
          path: kOrderNewPath,
          builder: (context, state) => CreateQuoteScreen(
            ordersPort: ports.orders,
            catalogPort: ports.catalog,
            customersPort: ports.customers,
            perms: perms,
            // Confirmed: the form leaves the stack (whatever opened it reads again) and the
            // order opens in its place, so Back never returns to a confirmed form.
            onDone: (order) {
              final router = GoRouter.of(context);
              if (router.canPop()) router.pop();
              // The list under the new order read once when the form popped; the order
              // can change before it closes (status, deposit), so read again then.
              router.push(orderPath(order.id)).then((_) => _reloadOrders());
            },
          ),
        ),
        GoRoute(
          path: kDiscountApprovalsPath,
          builder: (context, state) => DiscountApprovalScreen(ordersPort: ports.orders),
        ),
        GoRoute(
          path: '$kOrdersPath/:id',
          builder: (context, state) => OrderDetailScreen(
            port: ports.orders,
            orderId: id(state),
            perms: perms,
            onBack: () => back(context),
            // The screen hides it when the backend offers no next step.
            onChangeStatus: () => context.push(orderTransitionPath(id(state))),
            // Every account that sees the order reads its schedule; recording is gated in the screen.
            onOpenPaymentSchedule: () => context.push(orderPaymentsPath(id(state))),
            onOpenContracts:
                may(AppPermissionKeys.contractsGenerate) ? () => context.push(orderContractsPath(id(state))) : null,
            onOpenInvoices:
                may(AppPermissionKeys.invoicesManage) ? () => context.push(orderInvoicesPath(id(state))) : null,
          ),
        ),
        GoRoute(
          path: '$kOrdersPath/:id/transition',
          builder: (context, state) => OrderStatusChangeScreen(
            port: ports.orders,
            orderId: id(state),
            onBack: () => back(context),
            // Back to the order, which reads its new status when this screen pops.
            onDone: (_) => back(context),
          ),
        ),
        GoRoute(
          path: '$kOrdersPath/:id/payments',
          builder: (context, state) => PaymentScheduleScreen(
            port: ports.payments,
            orderId: id(state),
            perms: perms,
            onBack: () => back(context),
          ),
        ),
        GoRoute(
          path: '$kOrdersPath/:id/contracts',
          builder: (context, state) =>
              ContractsScreen(port: ports.contracts, orderId: id(state), onBack: () => back(context)),
        ),
        GoRoute(
          path: '$kOrdersPath/:id/invoices',
          builder: (context, state) => InvoicesScreen(
            port: ports.invoices,
            orderId: id(state),
            onBack: () => back(context),
            onOpenInvoice: (invoiceId) => context.push(orderInvoicePath(id(state), invoiceId)),
          ),
        ),
        GoRoute(
          path: '$kOrdersPath/:id/invoices/:invoiceId',
          builder: (context, state) => InvoiceDetailScreen(
            port: ports.invoices,
            orderId: id(state),
            invoiceId: state.pathParameters['invoiceId']!,
            onBack: () => back(context),
          ),
        ),
        GoRoute(
          path: kInventoryPath,
          builder: (context, state) => InventoryScreen(
            reloadSignal: _inventoryReload,
            port: ports.inventory,
            perms: perms,
            // The screen shows the entry only to inventory.manage.
            onOpenVouchers: () => context.push(kStockVouchersPath),
          ),
        ),
        GoRoute(
          path: kStockVouchersPath,
          builder: (context, state) => StockVouchersScreen(
            port: ports.stockVouchers,
            inventoryPort: ports.inventory,
            onBack: () => back(context),
          ),
        ),
      ],
    );
  }

  /// A tab the account may not open does nothing: the bar is locked to five tabs
  /// (UX-DR-15), so it cannot be hidden.
  void _selectTab(int index) {
    final router = _router;
    if (router == null) return;
    final String? path = switch (index) {
      _homeTab => kHomePath,
      _ordersTab => kOrdersPath,
      _inventoryTab => kInventoryPath,
      _menuTab => kMenuPath,
      _ => null,
    };
    if (path == null || !isOpenable(path, _perms)) return;
    // The tab's root screen may sit under screens that wrote; they are dropped
    // without completing the futures its reload waits on, so rebuild it instead.
    if (index == _ordersTab) _ordersReload.value++;
    if (index == _inventoryTab) _inventoryReload.value++;
    if (index == _homeTab) _homeReload.value++;
    router.go(path);
  }

  Future<void> _createQuote() async {
    final router = _router;
    if (router == null) return;
    await router.push(kOrderNewPath);
    _reloadOrders();
  }

  /// Has the order list under whatever is on top of it read again (see [_ordersReload]).
  void _reloadOrders() {
    if (mounted) _ordersReload.value++;
  }

  @override
  Widget build(BuildContext context) {
    final scope = PermissionsScope.of(context);
    switch (scope.status) {
      case SessionStatus.loading:
        return _plain(const SessionSkeleton());
      case SessionStatus.error:
        return _plain(
          AppPhoneFrame(
            child: Padding(
              padding: const EdgeInsets.all(18.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppErrorState(message: 'Không tải được thông tin tài khoản.', onRetry: widget.onRetry),
                  const SizedBox(height: AppTokens.space16),
                  AppButton(label: 'Đăng xuất', wide: true, onPressed: widget.onLogout),
                ],
              ),
            ),
          ),
        );
      case SessionStatus.ready:
        _perms = scope.perms;
        final router = _router ??= _buildRouter(scope.perms);
        return MaterialApp.router(
          key: const ValueKey<String>('signed-in'),
          debugShowCheckedModeBanner: false,
          title: kAppTitle,
          routerConfig: router,
          builder: (context, child) => AppBottomNavScope(
            onSelect: _selectTab,
            // No quote permission ⇒ the FAB does nothing (null), like a gated tab.
            onCreateQuote: isOpenable(kOrderNewPath, scope.perms) ? _createQuote : null,
            child: appPage(child ?? const SizedBox.shrink()),
          ),
        );
    }
  }

  Widget _plain(Widget body) => MaterialApp(
    key: const ValueKey<String>('signed-in-pending'),
    debugShowCheckedModeBanner: false,
    title: kAppTitle,
    home: appPage(body),
  );
}
