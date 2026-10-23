// The order and stock routes of the signed-in app (Story 10.8), over the real HTTP
// adapters with a stateful fake backend: the three permission-gated buttons of an
// order (same fixture, only the permissions differ), the child-route gates, the
// tabs and the Tạo FAB, and the screens underneath reading again when a writing
// screen on top of them closes. Sign-in lands on Trang chủ (Story 8.1); an account
// that may see orders then opens the Đơn hàng tab, where these cases start.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/design_system/shell/app_bottom_nav.dart';
import 'package:pns_mobile/screens/contracts/contracts_screen.dart';
import 'package:pns_mobile/screens/dashboard/dashboard_screen.dart';
import 'package:pns_mobile/screens/inventory/inventory_screen.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_screen.dart';
import 'package:pns_mobile/screens/invoices/invoice_detail_screen.dart';
import 'package:pns_mobile/screens/invoices/invoices_screen.dart';
import 'package:pns_mobile/screens/menu/menu_screen.dart';
import 'package:pns_mobile/screens/orders/create_quote_screen.dart';
import 'package:pns_mobile/screens/orders/discount_approval_screen.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';
import 'package:pns_mobile/screens/orders/order_list_screen.dart';
import 'package:pns_mobile/screens/orders/order_status_change_screen.dart';
import 'package:pns_mobile/screens/payments/payment_schedule_screen.dart';

import '../api/support/contract_json.dart';
import '../api/support/fake_http.dart';
import 'support/app_harness.dart';

const List<String> _full = [
  'orders.view_all',
  'contracts.generate',
  'invoices.manage',
  'quotes.create_edit',
  'payments.record',
  'delivery.confirm',
];

/// The backend's orders, as it changes under the app.
class _Backend {
  _Backend(this.perms);

  final List<String> perms;
  final Map<String, String> status = {'o1': 'dachot'};
  final Map<String, String> customer = {'o1': 'Anh An'};

  /// When set, reading an order answers a 500 envelope.
  bool orderReadFails = false;

  Map<String, Object?> _row(String id) => {
    'id': id,
    'status': status[id],
    'customerPhone': '+84903176968',
    'customerName': customer[id],
    'ownerAccountId': 'acc-1',
    'assigneeAccountId': null,
    'createdAt': '2026-07-18T00:00:00.000Z',
    'updatedAt': '2026-07-18T00:00:00.000Z',
  };

  Map<String, Object?> _lifecycle(String id) => {
    'steps': [
      {'status': status[id], 'progress': 'current'},
    ],
    'nextSteps': status[id] == 'dachot'
        ? [
            {'event': 'bat_dau_giao', 'to': 'danggiao', 'requires': 'delivery.confirm'},
          ]
        : [],
    'canCancel': false,
  };

  Map<String, Object?> _schedule() => {
    ...scheduleJson(payments: []),
    'paidTotal': 0,
    'remainingTotal': 83010960,
    'paidPercent': 0,
    'paymentStatus': 'unpaid',
    'installments': [
      {
        'id': 'inst-1',
        'seq': 1,
        'percent': 20,
        'amount': 16602192,
        'conditionNote': 'Cọc',
        'milestone': 'coc',
        'paidAmount': 0,
        'remainingAmount': 16602192,
        'status': 'unpaid',
        'payments': [],
      },
    ],
  };

  FakeHandler handler() => (r) {
    final segments = Uri.parse(r.path).pathSegments;
    if (r.path == '/auth/refresh') return jsonBody(200, tokens('access-a', 'refresh-a'));
    if (r.path == '/me') return jsonBody(200, meBody(perms));
    if (r.path == '/orders' && r.method == 'GET') {
      return jsonBody(200, {
        'items': [for (final id in status.keys) _row(id)],
        'total': status.length,
        'page': 1,
        'pageSize': 20,
      });
    }
    if (r.path == '/orders/pending-discount-approvals') return jsonBody(200, <Object?>[]);
    if (segments.length >= 2 && segments.first == 'orders' && status.containsKey(segments[1])) {
      final id = segments[1];
      final rest = segments.skip(2).join('/');
      switch ('${r.method} $rest') {
        case 'GET ':
          if (orderReadFails) return jsonBody(500, envelope('INTERNAL', 'Lỗi máy chủ.'));
          return jsonBody(200, orderJson(id: id, status: status[id]!));
        case 'GET lifecycle':
          return jsonBody(200, _lifecycle(id));
        case 'GET versions':
          return jsonBody(200, {'items': <Object?>[]});
        case 'GET stock-issue':
          return jsonBody(200, stockIssueJson());
        case 'POST transition':
          status[id] = 'danggiao';
          return jsonBody(201, {...statusChangeJson(), 'status': 'danggiao'});
        case 'GET payment-schedule':
          return jsonBody(200, _schedule());
        case 'POST payments':
          status[id] = 'dacoc';
          return jsonBody(201, recordPaymentJson());
        case 'GET contracts':
          return jsonBody(200, contractsOverviewJson());
        case 'GET invoices':
          return jsonBody(200, invoicesOverviewJson());
        case 'GET invoices/inv-1':
          return jsonBody(200, invoiceDetailJson());
      }
    }
    if (r.path == '/dashboard/summary') return jsonBody(200, dashboardBody());
    if (r.path == '/stock-items') return jsonBody(200, stockListJson());
    if (r.path == '/stock-vouchers') return jsonBody(200, voucherListJson());
    if (r.path == '/products' || r.path == '/product-groups' || r.path == '/customer-sources') {
      return jsonBody(200, <Object?>[]);
    }
    return jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy.'));
  };
}

/// Signed in: lands on Trang chủ, then opens the Đơn hàng tab when [perms] may see orders.
Future<(TestApp, _Backend)> _signedIn(WidgetTester tester, List<String> perms) async {
  final backend = _Backend(perms);
  final app = TestApp(backend.handler());
  app.store.values['pns.refreshToken'] = 'refresh-0';
  await tester.pumpWidget(app.widget);
  await _navigated(tester);
  expect(find.byType(DashboardScreen), findsOneWidget);
  expect(_location(tester), '/dashboard');
  if (perms.contains('orders.view_all') || perms.contains('orders.view_own')) {
    await _tap(tester, _tab('Đơn hàng'));
  }
  return (app, backend);
}

Future<void> _navigated(WidgetTester tester) async {
  await settle(tester);
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await _navigated(tester);
}

Finder _button(String label) => find.widgetWithText(AppButton, label);

Finder _tab(String label) => find.descendant(of: find.byType(AppBottomNav), matching: find.text(label));

GoRouter _router(WidgetTester tester) => GoRouter.of(tester.element(find.byType(Navigator).last));

String _location(WidgetTester tester) => _router(tester).state.uri.toString();

Future<void> _back(WidgetTester tester) async {
  await tester.binding.handlePopRoute();
  await _navigated(tester);
}

Future<void> _openOrder(WidgetTester tester) async {
  await _tap(tester, _button('Xem').first);
  expect(find.byType(OrderDetailScreen), findsOneWidget);
}

void main() {
  testWidgets(
    'full account: Đơn hàng tab opens the list; the order shows Thanh toán/Hợp đồng/Hoá đơn, each opens its screen for this order, back returns',
    (tester) async {
      await _signedIn(tester, _full);
      expect(find.byType(OrderListScreen), findsOneWidget);
      expect(_location(tester), '/orders');
      await _openOrder(tester);
      expect(_location(tester), '/orders/o1');

      for (final (label, path, orderIdOf) in <(String, String, String Function())>[
        (
          'Thanh toán',
          '/orders/o1/payments',
          () => tester.widget<PaymentScheduleScreen>(find.byType(PaymentScheduleScreen)).orderId,
        ),
        (
          'Hợp đồng',
          '/orders/o1/contracts',
          () => tester.widget<ContractsScreen>(find.byType(ContractsScreen)).orderId,
        ),
        ('Hoá đơn', '/orders/o1/invoices', () => tester.widget<InvoicesScreen>(find.byType(InvoicesScreen)).orderId),
      ]) {
        await _tap(tester, _button(label));
        expect(_location(tester), path, reason: label);
        expect(orderIdOf(), 'o1', reason: label);
        await _back(tester);
        expect(find.byType(OrderDetailScreen), findsOneWidget, reason: 'back from $label');
        expect(_location(tester), '/orders/o1');
      }
    },
  );

  testWidgets('Hoá đơn → Xem opens that invoice of this order; back returns to the invoice list', (tester) async {
    await _signedIn(tester, _full);
    await _openOrder(tester);
    await _tap(tester, _button('Hoá đơn'));
    expect(find.byType(InvoicesScreen), findsOneWidget);

    await _tap(tester, _button('Xem'));
    expect(_location(tester), '/orders/o1/invoices/inv-1');
    final detail = tester.widget<InvoiceDetailScreen>(find.byType(InvoiceDetailScreen));
    expect([detail.orderId, detail.invoiceId], ['o1', 'inv-1']);

    await _back(tester);
    expect(find.byType(InvoiceDetailScreen), findsNothing);
    expect(find.byType(InvoicesScreen), findsOneWidget);
    expect(_location(tester), '/orders/o1/invoices');
  });

  testWidgets('orders.view_own only (same order): Thanh toán but no Hợp đồng/Hoá đơn, and their paths land back', (
    tester,
  ) async {
    await _signedIn(tester, ['orders.view_own']);
    await _openOrder(tester);
    expect(_button('Thanh toán'), findsOneWidget);
    expect(_button('Hợp đồng'), findsNothing);
    expect(_button('Hoá đơn'), findsNothing);

    for (final path in ['/orders/o1/contracts', '/orders/o1/invoices', '/orders/o1/invoices/inv-1']) {
      _router(tester).go(path);
      await _navigated(tester);
      expect(_location(tester), '/dashboard', reason: path);
      expect(find.byType(ContractsScreen), findsNothing);
      expect(find.byType(InvoicesScreen), findsNothing);
    }
  });

  testWidgets('/orders/new: the quote form with quotes.create_edit (not an order "new"), the landing page without', (
    tester,
  ) async {
    await _signedIn(tester, ['orders.view_all']);
    _router(tester).go('/orders/new');
    await _navigated(tester);
    expect(_location(tester), '/dashboard');
    expect(find.byType(CreateQuoteScreen), findsNothing);

    await tester.pumpWidget(const SizedBox());
    await _signedIn(tester, ['orders.view_all', 'quotes.create_edit']);
    _router(tester).go('/orders/new');
    await _navigated(tester);
    expect(find.byType(CreateQuoteScreen), findsOneWidget);
    expect(find.byType(OrderDetailScreen), findsNothing);
  });

  testWidgets('the Tạo FAB opens the quote form with quotes.create_edit; without it nothing moves and nothing throws', (
    tester,
  ) async {
    // From a screen other than the landing page, so "nothing moves" is not the
    // redirect landing back where it already was.
    await _signedIn(tester, ['orders.view_all']);
    await _openOrder(tester);
    await _tap(tester, _tab('Tạo'));
    expect(tester.takeException(), isNull);
    expect(_location(tester), '/orders/o1');

    await tester.pumpWidget(const SizedBox());
    await _signedIn(tester, ['orders.view_all', 'quotes.create_edit']);
    await _tap(tester, _tab('Tạo'));
    expect(find.byType(CreateQuoteScreen), findsOneWidget);
    expect(_location(tester), '/orders/new');
  });

  testWidgets(
    'tabs: Đơn hàng, Kho and Trang chủ open their screens from the Menu; Phiếu kho needs inventory.manage',
    (tester) async {
      await _signedIn(tester, ['orders.view_all', 'inventory.manage']);
      await _tap(tester, _tab('Menu'));
      expect(find.byType(MenuScreen), findsOneWidget);
      await _tap(tester, _tab('Kho'));
      expect(find.byType(InventoryScreen), findsOneWidget);
      expect(_location(tester), '/inventory');
      await _tap(tester, _tab('Trang chủ'));
      expect(find.byType(DashboardScreen), findsOneWidget);
      expect(_location(tester), '/dashboard');
      await _tap(tester, _tab('Đơn hàng'));
      expect(find.byType(OrderListScreen), findsOneWidget);
      expect(_location(tester), '/orders');
      _router(tester).go('/inventory/vouchers');
      await _navigated(tester);
      expect(find.byType(StockVouchersScreen), findsOneWidget);

      // quotes.create_edit opens Tồn kho but not Phiếu kho; it stays on Trang chủ.
      await tester.pumpWidget(const SizedBox());
      await _signedIn(tester, ['quotes.create_edit']);
      expect(find.byType(DashboardScreen), findsOneWidget);
      await _tap(tester, _tab('Kho'));
      expect(find.byType(InventoryScreen), findsOneWidget);
      // Not from the landing page: a tab the account may not open leaves it where it is.
      await _tap(tester, _tab('Đơn hàng'));
      expect(_location(tester), '/inventory', reason: 'a tab the account may not open does nothing');
      _router(tester).go('/inventory/vouchers');
      await _navigated(tester);
      expect(find.byType(StockVouchersScreen), findsNothing);
      expect(_location(tester), '/dashboard');
    },
  );

  testWidgets(
    'Duyệt chiết khấu only with discounts.approve (button and route); + Tạo đơn only with quotes.create_edit',
    (tester) async {
      await _signedIn(tester, ['orders.view_all']);
      expect(_button('Duyệt chiết khấu'), findsNothing);
      expect(_button('+ Tạo đơn'), findsNothing);
      _router(tester).go('/orders/discount-approvals');
      await _navigated(tester);
      expect(find.byType(DiscountApprovalScreen), findsNothing);
      expect(_location(tester), '/dashboard');

      await tester.pumpWidget(const SizedBox());
      await _signedIn(tester, ['orders.view_all', 'discounts.approve', 'quotes.create_edit']);
      expect(_button('+ Tạo đơn'), findsOneWidget);
      await _tap(tester, _button('Duyệt chiết khấu'));
      expect(find.byType(DiscountApprovalScreen), findsOneWidget);
      expect(_location(tester), '/orders/discount-approvals');
    },
  );

  testWidgets('an empty list offers + Tạo đơn only to an account that may create quotes', (tester) async {
    final (_, backend) = await _signedIn(tester, ['orders.view_all']);
    backend.status.clear();
    await _tap(tester, _tab('Menu'));
    await _tap(tester, _tab('Đơn hàng'));
    expect(find.text('Chưa có đơn nào'), findsOneWidget);
    expect(_button('+ Tạo đơn'), findsNothing);
    expect(find.text('Bấm ➕Tạo để bắt đầu.'), findsNothing);

    await tester.pumpWidget(const SizedBox());
    final (_, second) = await _signedIn(tester, ['orders.view_all', 'quotes.create_edit']);
    second.status.clear();
    await _tap(tester, _tab('Menu'));
    await _tap(tester, _tab('Đơn hàng'));
    expect(find.text('Chưa có đơn nào'), findsOneWidget);
    expect(_button('+ Tạo đơn'), findsNWidgets(2));
    expect(find.text('Bấm ➕Tạo để bắt đầu.'), findsOneWidget);
  });

  group('the screen underneath reads again when a writing screen closes', () {
    testWidgets('a status change ⇒ back on the order with its new status', (tester) async {
      final (app, _) = await _signedIn(tester, _full);
      await _openOrder(tester);
      expect(find.text('Đã chốt'), findsWidgets);
      final lifecycleReads = app.adapter.to('/orders/o1/lifecycle').length;

      await _tap(tester, _button('Chuyển trạng thái'));
      expect(find.byType(OrderStatusChangeScreen), findsOneWidget);
      await _tap(tester, find.text('Đang giao').last);
      await _tap(tester, _button('Xác nhận chuyển'));

      expect(find.byType(OrderDetailScreen), findsOneWidget);
      expect(_location(tester), '/orders/o1');
      expect(app.adapter.to('/orders/o1/lifecycle').length, greaterThan(lifecycleReads + 1));
      expect(find.text('Đang giao'), findsWidgets);
      expect(find.text('Đã chốt'), findsNothing);
      expect(_button('Chuyển trạng thái'), findsNothing, reason: 'no next step any more');
    });

    testWidgets('a payment that moves the order to Đã cọc ⇒ back ⇒ the order shows Đã cọc', (tester) async {
      final (app, _) = await _signedIn(tester, _full);
      await _openOrder(tester);
      await _tap(tester, _button('Thanh toán'));
      await _tap(tester, find.text('Ghi nhận').first);
      await _tap(tester, find.text('Ghi nhận đợt 1'));
      await _tap(tester, find.descendant(of: find.byType(AppConfirmDialog), matching: find.text('Ghi nhận')));
      expect(app.adapter.to('/orders/o1/payments').where((r) => r.method == 'POST'), hasLength(1));

      await _back(tester);
      expect(find.byType(OrderDetailScreen), findsOneWidget);
      expect(find.text('Đã cọc'), findsWidgets);
      expect(find.text('Đã chốt'), findsNothing);
    });

    testWidgets(
      'a confirmed quote (from + Tạo đơn) ⇒ its order opens; back ⇒ the list shows it; back again never returns to the form',
      (tester) async {
        final (_, backend) = await _signedIn(tester, [..._full, 'discounts.approve']);
        expect(find.text('Chị Bình'), findsNothing);
        await _tap(tester, _button('+ Tạo đơn'));
        expect(find.byType(CreateQuoteScreen), findsOneWidget);

        // The form confirmed a new order (its own flow is covered by its screen tests).
        backend.status['o2'] = 'dachot';
        backend.customer['o2'] = 'Chị Bình';
        tester.widget<CreateQuoteScreen>(find.byType(CreateQuoteScreen)).onDone!(
          Order.fromJson(orderJson(id: 'o2', status: 'dachot')),
        );
        await _navigated(tester);
        expect(find.byType(OrderDetailScreen), findsOneWidget);
        expect(_location(tester), '/orders/o2');

        await _back(tester);
        expect(find.byType(OrderListScreen), findsOneWidget);
        expect(find.text('Chị Bình'), findsOneWidget);
        expect(find.byType(CreateQuoteScreen), findsNothing);
        expect(_location(tester), '/orders');
      },
    );

    testWidgets('the same from the Tạo FAB: back from the new order ⇒ the list shows it', (tester) async {
      final (_, backend) = await _signedIn(tester, _full);
      await _tap(tester, _tab('Tạo'));
      backend.status['o2'] = 'dachot';
      backend.customer['o2'] = 'Chị Bình';
      tester.widget<CreateQuoteScreen>(find.byType(CreateQuoteScreen)).onDone!(
        Order.fromJson(orderJson(id: 'o2', status: 'dachot')),
      );
      await _navigated(tester);
      expect(_location(tester), '/orders/o2');
      await _back(tester);
      expect(find.text('Chị Bình'), findsOneWidget);
    });

    testWidgets('the order a confirmed quote opened closes after a status change ⇒ the list shows that status', (
      tester,
    ) async {
      final (_, backend) = await _signedIn(tester, _full);
      // The filter row names every status too: count the rows on top of it.
      final movedBefore = find.text('Đang giao').evaluate().length;
      await _tap(tester, _button('+ Tạo đơn'));
      backend.status['o2'] = 'dachot';
      backend.customer['o2'] = 'Chị Bình';
      tester.widget<CreateQuoteScreen>(find.byType(CreateQuoteScreen)).onDone!(
        Order.fromJson(orderJson(id: 'o2', status: 'dachot')),
      );
      await _navigated(tester);
      expect(_location(tester), '/orders/o2');

      await _tap(tester, _button('Chuyển trạng thái'));
      await _tap(tester, find.text('Đang giao').last);
      await _tap(tester, _button('Xác nhận chuyển'));
      expect(_location(tester), '/orders/o2');

      await _back(tester);
      expect(find.byType(OrderListScreen), findsOneWidget);
      expect(find.text('Đang giao'), findsNWidgets(movedBefore + 1), reason: 'o2 moved on while its detail was open');
    });

    testWidgets('the Đơn hàng tab over a written order ⇒ the list reads again (a go drops the push futures)', (
      tester,
    ) async {
      final (_, _) = await _signedIn(tester, _full);
      // The filter row names every status too: count the rows on top of it.
      final movedBefore = find.text('Đang giao').evaluate().length;
      final confirmedBefore = find.text('Đã chốt').evaluate().length;
      await _openOrder(tester);
      await _tap(tester, _button('Chuyển trạng thái'));
      await _tap(tester, find.text('Đang giao').last);
      await _tap(tester, _button('Xác nhận chuyển'));
      expect(_location(tester), '/orders/o1');

      await _tap(tester, _tab('Đơn hàng'));
      expect(_location(tester), '/orders');
      expect(find.byType(OrderListScreen), findsOneWidget);
      expect(find.text('Đang giao'), findsNWidgets(movedBefore + 1));
      expect(find.text('Đã chốt'), findsNWidgets(confirmedBefore - 1));
    });

    testWidgets('the Kho tab over Phiếu kho ⇒ Tồn kho reads the stock again', (tester) async {
      final (app, _) = await _signedIn(tester, ['inventory.manage']);
      await _tap(tester, _tab('Kho'));
      await _tap(tester, find.text('Phiếu kho'));
      final reads = app.adapter.to('/stock-items').length;
      await _tap(tester, _tab('Kho'));
      expect(find.byType(InventoryScreen), findsOneWidget);
      expect(app.adapter.to('/stock-items').length, greaterThan(reads));
    });

    testWidgets('a failed re-read on return keeps the order on screen (no skeleton, no error state)', (tester) async {
      final (app, backend) = await _signedIn(tester, _full);
      await _openOrder(tester);
      await _tap(tester, _button('Hợp đồng'));
      backend.orderReadFails = true;
      final reads = app.adapter.to('/orders/o1').length;
      await _back(tester);
      expect(app.adapter.to('/orders/o1').length, greaterThan(reads), reason: 'it did read again');
      expect(find.byType(OrderDetailScreen), findsOneWidget);
      expect(find.text('Đã chốt'), findsWidgets);
      expect(find.byType(AppErrorState), findsNothing);
    });

    testWidgets('Phiếu kho closes ⇒ Tồn kho reads the stock again', (tester) async {
      final (app, _) = await _signedIn(tester, ['inventory.manage']);
      await _tap(tester, _tab('Kho'));
      final reads = app.adapter.to('/stock-items').length;
      await _tap(tester, find.text('Phiếu kho'));
      expect(find.byType(StockVouchersScreen), findsOneWidget);
      await _back(tester);
      expect(find.byType(InventoryScreen), findsOneWidget);
      expect(app.adapter.to('/stock-items').length, greaterThan(reads));
    });
  });
}
