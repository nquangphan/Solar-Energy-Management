// hand-authored — the signed-in app (Story 10.7): the router over the screens the
// Menu opens, built once the account's permissions (`/me`) are known.
//
// Permissions are fetched once per session (PermissionsProvider, keyed by sign-in
// in PnsApp), so the router is built once: its initial location and its gate come
// from that set. Every route is registered; the top-level redirect sends a path the
// account may not open — or one that does not exist — back to the landing page,
// using the same gate as the Menu (app_routes.dart, AD-17).
//
// Sub-screens are PUSHED (the Android back button pops to the previous screen); a
// bottom-nav tab is a `go`. Only the Menu tab is wired here: Trang chủ, Đơn hàng,
// Kho and the Tạo FAB have no mobile screen behind the router yet and stay inert.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design_system/components/components.dart';
import '../design_system/gating/app_permissions.dart';
import '../design_system/session/app_session.dart';
import '../design_system/session/customers_port.dart';
import '../design_system/session/password_port.dart';
import '../design_system/session/warranty_port.dart';
import '../design_system/shell/app_bottom_nav.dart';
import '../design_system/shell/app_menu_nav.dart';
import '../design_system/shell/app_phone_frame.dart';
import '../design_system/tokens/app_tokens.dart';
import '../screens/account/profile_screen.dart';
import '../screens/customers/customer_detail_screen.dart';
import '../screens/customers/customer_list_screen.dart';
import '../screens/customers/customer_pick_screen.dart';
import '../screens/menu/menu_screen.dart';
import '../screens/warranty/warranty_lookup_screen.dart';
import 'app_chrome.dart';
import 'app_routes.dart';

/// Index of the locked bottom-nav `Menu` tab.
const int _menuTab = 4;

class SignedInApp extends StatefulWidget {
  const SignedInApp({
    super.key,
    required this.password,
    required this.customers,
    required this.warranty,
    required this.onLogout,
    required this.onRetry,
  });

  final PasswordPort password;
  final CustomersPort customers;
  final WarrantyPort warranty;

  /// Signs out; the app returns to Đăng nhập when it completes.
  final Future<void> Function() onLogout;

  /// Fetches `/me` again after it failed.
  final VoidCallback onRetry;

  @override
  State<SignedInApp> createState() => _SignedInAppState();
}

class _SignedInAppState extends State<SignedInApp> {
  GoRouter? _router;

  @override
  void dispose() {
    _router?.dispose();
    super.dispose();
  }

  GoRouter _buildRouter(Set<PermissionKey> perms) {
    final landing = landingPath(perms);
    return GoRouter(
      initialLocation: landing,
      redirect: (context, state) => isOpenable(state.uri.path, perms) ? null : landing,
      routes: [
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
            port: widget.customers,
            onOpen: (phone) => context.push(customerPath(phone)),
            onAdd: () => context.push(kCustomerLookupPath),
          ),
        ),
        // Before `/customers/:phone`, which would otherwise take `lookup` for a phone.
        GoRoute(
          path: kCustomerLookupPath,
          builder: (context, state) => CustomerPickScreen(
            port: widget.customers,
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
              CustomerDetailScreen(port: widget.customers, sdt: state.pathParameters['phone']!),
        ),
        GoRoute(
          path: kWarrantyPath,
          builder: (context, state) => WarrantyLookupScreen(port: widget.warranty),
        ),
        GoRoute(
          path: kProfilePath,
          builder: (context, state) => ProfileScreen(port: widget.password),
        ),
      ],
    );
  }

  void _selectTab(int index) {
    if (index == _menuTab) _router?.go(kMenuPath);
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
        final router = _router ??= _buildRouter(scope.perms);
        return MaterialApp.router(
          key: const ValueKey<String>('signed-in'),
          debugShowCheckedModeBanner: false,
          title: kAppTitle,
          routerConfig: router,
          builder: (context, child) =>
              AppBottomNavScope(onSelect: _selectTab, child: appPage(child ?? const SizedBox.shrink())),
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
