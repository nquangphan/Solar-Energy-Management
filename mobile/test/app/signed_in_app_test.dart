// The signed-in app (Story 10.7): Menu gated by /me, the router over the Menu's
// screens, the bottom nav's tabs, back navigation, per-account permissions,
// a failed /me with retry, and session expiry from a sub-screen — the whole app
// over the real HTTP adapters with a fake backend. Every account lands on Trang
// chủ (Story 8.1); the Menu tests open the Menu tab first.
// The order/stock routes are in order_routes_test.dart.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/screens/account/profile_screen.dart';
import 'package:pns_mobile/screens/auth/login_screen.dart';
import 'package:pns_mobile/screens/customers/customer_detail_screen.dart';
import 'package:pns_mobile/screens/customers/customer_list_screen.dart';
import 'package:pns_mobile/screens/customers/customer_pick_screen.dart';
import 'package:pns_mobile/screens/dashboard/dashboard_screen.dart';
import 'package:pns_mobile/screens/menu/menu_screen.dart';
import 'package:pns_mobile/screens/orders/order_list_screen.dart';
import 'package:pns_mobile/screens/permissions/account_form_screen.dart';
import 'package:pns_mobile/screens/permissions/account_list_screen.dart';
import 'package:pns_mobile/screens/permissions/account_permissions_screen.dart';
import 'package:pns_mobile/screens/warranty/warranty_lookup_screen.dart';

import '../api/support/fake_http.dart';
import 'support/app_harness.dart';

const _customerPerms = ['customers.manage', 'orders.view_own'];

Map<String, Object?> _customer(String phone, String name) => {
  'phone': phone,
  'custType': 'CA_NHAN',
  'name': name,
  'nationalId': null,
  'taxCode': null,
  'address': null,
  'bankAccount': null,
  'sourceId': 'src-1',
  'sourceNote': null,
  'createdAt': '2026-07-13T00:00:00.000Z',
  'updatedAt': '2026-07-13T00:00:00.000Z',
};

Map<String, Object?> _account(String id, String name) => {
  'id': id,
  'displayName': name,
  'phone': '+84900000002',
  'email': '$id@pns.solar',
  'isActive': true,
  'permissions': ['catalog.view'],
  'matchingPreset': null,
  'matchingPresetLabel': null,
  'editable': true,
  'readOnlyReason': null,
};

/// A backend for two accounts: `0911…` (A) holds [permsA], `0922…` (B) holds [permsB]; each
/// login hands out a token naming its account, /me answers for that token.
FakeHandler _backend({List<String> permsA = _customerPerms, List<String> permsB = const []}) => (r) {
  switch (r.path) {
    case '/auth/login':
      final who = ((r.json as Map)['phone'] as String).startsWith('0922') ? 'b' : 'a';
      return jsonBody(200, tokens('access-$who', 'refresh-$who'));
    case '/auth/refresh':
      return jsonBody(200, tokens('access-a', 'refresh-a'));
    case '/auth/logout':
      return noContent();
    case '/me':
      return r.authorization == 'Bearer access-b'
          ? jsonBody(200, meBody(permsB, displayName: 'Người B', email: 'b@pns.solar'))
          : jsonBody(200, meBody(permsA, displayName: 'Người A', email: 'a@pns.solar'));
    case '/customers':
      return jsonBody(200, {
        'items': [_customer('+84903176968', 'Nguyễn Văn A')],
        'total': 1,
        'page': 1,
        'pageSize': 20,
      });
    case '/customers/%2B84903176968':
      return jsonBody(200, _customer('+84903176968', 'Nguyễn Văn A'));
    case '/customer-sources':
      return jsonBody(200, [
        {'id': 'src-1', 'name': 'Facebook', 'description': null, 'active': true, 'sortOrder': 1, 'isOther': false},
      ]);
    case '/orders':
      return jsonBody(200, {'items': [], 'total': 0, 'page': 1, 'pageSize': 20});
    case '/orders/warranty-lookup':
      return jsonBody(200, {'found': false, 'phone': '+84999999999', 'customer': null, 'orders': []});
    case '/dashboard/summary':
      return jsonBody(200, dashboardBody());
    case '/accounts':
      // POST creates `acc-new`; the list always carries it so its matrix can open.
      if (r.method == 'POST') return jsonBody(201, _account('acc-new', 'Người Mới'));
      return jsonBody(200, [_account('acc-worker', 'Bình Thợ'), _account('acc-new', 'Người Mới')]);
    case '/accounts/acc-worker':
      return jsonBody(200, _account('acc-worker', 'Bình Sửa'));
    case '/accounts/permission-options':
      return jsonBody(200, {
        'permissions': [
          {
            'key': 'catalog.view',
            'label': 'Xem danh mục vật tư',
            'group': 'catalog',
            'requires': [],
            'requiresAnyOf': [],
            'grantable': true,
            'transitions': [],
          },
        ],
        'presets': [
          {'key': 'THO_KS', 'label': 'Thợ khảo sát', 'permissions': ['catalog.view']},
        ],
      });
  }
  return jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy.'));
};

/// Signed in from a stored session; with [toMenu] the Menu tab is opened first (every
/// account lands on Trang chủ).
Future<TestApp> _signedIn(WidgetTester tester, FakeHandler backend, {bool toMenu = true}) async {
  final app = TestApp(backend);
  app.store.values['pns.refreshToken'] = 'refresh-0';
  await tester.pumpWidget(app.widget);
  await settle(tester);
  if (toMenu) await _openMenu(tester);
  return app;
}

Future<void> _openMenu(WidgetTester tester) async {
  if (find.byType(MenuScreen).evaluate().isNotEmpty) return;
  await tester.tap(find.text('Menu'));
  await _navigated(tester);
}

Future<void> _login(WidgetTester tester, String phone) async {
  await tester.enterText(find.byType(TextField).at(0), phone);
  await tester.enterText(find.byType(TextField).at(1), 'secret-1');
  await tester.tap(find.widgetWithText(AppButton, 'Đăng nhập'));
  await settle(tester);
}

Future<void> _logout(WidgetTester tester) async {
  final logout = find.widgetWithText(AppButton, 'Đăng xuất');
  await tester.ensureVisible(logout);
  await tester.tap(logout);
  await settle(tester);
}

/// Requests settle in small real-time steps; then the page transition runs to its end.
Future<void> _navigated(WidgetTester tester) async {
  await settle(tester);
  await tester.pumpAndSettle();
}

Future<void> _tapButton(WidgetTester tester, String label) async {
  final button = find.widgetWithText(AppButton, label);
  await tester.ensureVisible(button);
  await tester.tap(button);
  await _navigated(tester);
}

GoRouter _router(WidgetTester tester) => GoRouter.of(tester.element(find.byType(Navigator).last));

String _location(WidgetTester tester) => _router(tester).state.uri.toString();

void main() {
  testWidgets('the Menu shows a row only for what the account may open — one permission apart', (tester) async {
    await _signedIn(tester, _backend());
    expect(find.byType(MenuScreen), findsOneWidget);
    expect(find.text('Khách hàng'), findsOneWidget);
    expect(find.text('Tra cứu bảo hành'), findsOneWidget);
    expect(find.text('Hồ sơ'), findsOneWidget);
    expect(find.text('Người A'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await _signedIn(tester, _backend(permsA: ['orders.view_own']));
    expect(find.text('Khách hàng'), findsNothing);
    expect(find.text('Tra cứu bảo hành'), findsOneWidget);
  });

  testWidgets('Phân quyền shows only with permissions.manage; an account opens and Back re-reads the list', (
    tester,
  ) async {
    await _signedIn(tester, _backend());
    expect(find.text('Phân quyền'), findsNothing);

    await tester.pumpWidget(const SizedBox());
    final app = await _signedIn(tester, _backend(permsA: ['permissions.manage']));
    await tester.tap(find.text('Phân quyền'));
    await _navigated(tester);
    expect(find.byType(AccountListScreen), findsOneWidget);
    expect(_location(tester), '/permissions');
    expect(app.adapter.to('/accounts'), hasLength(1));

    await tester.tap(find.text('Bình Thợ'));
    await _navigated(tester);
    expect(find.byType(AccountPermissionsScreen), findsOneWidget);
    expect(_location(tester), '/permissions/acc-worker');
    expect(find.text('Quyền · Bình Thợ'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await _navigated(tester);
    expect(find.byType(AccountListScreen), findsOneWidget);
    expect(app.adapter.to('/accounts'), hasLength(3), reason: 'list, matrix, list again');
  });

  testWidgets('+ Tạo opens /permissions/new (never an account id); saving lands on the new matrix; Sửa account edits', (
    tester,
  ) async {
    final app = await _signedIn(tester, _backend(permsA: ['permissions.manage']));
    await tester.tap(find.text('Phân quyền'));
    await _navigated(tester);
    await tester.tap(find.text('+ Tạo'));
    await _navigated(tester);
    expect(_location(tester), '/permissions/new');
    expect(find.byType(AccountFormScreen), findsOneWidget);
    expect(find.byType(AccountPermissionsScreen), findsNothing);

    await tester.enterText(find.byType(TextField).at(0), 'Người Mới');
    await tester.enterText(find.byType(TextField).at(1), '0912 345 678');
    await tester.enterText(find.byType(TextField).at(2), 'moi@pns.solar');
    await tester.enterText(find.byType(TextField).at(3), 'MatKhau123');
    final picker = find.byKey(const ValueKey<String>('preset-picker'));
    await tester.ensureVisible(picker);
    await tester.tap(picker);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(AppButton, 'Thợ khảo sát').last);
    await tester.pumpAndSettle();
    await _tapButton(tester, 'Lưu account');

    expect((app.adapter.requests.where((r) => r.method == 'POST' && r.path == '/accounts').single.json as Map)['phone'],
        '0912 345 678');
    expect(_location(tester), '/permissions/acc-new');
    expect(find.text('Quyền · Người Mới'), findsOneWidget);
    final listReads = app.adapter.to('/accounts').where((r) => r.method == 'GET').length;
    await tester.binding.handlePopRoute();
    await _navigated(tester);
    expect(_location(tester), '/permissions');
    expect(app.adapter.to('/accounts').where((r) => r.method == 'GET').length, greaterThan(listReads),
        reason: 'the list reads again when the flow closes');

    await tester.tap(find.text('Bình Thợ'));
    await _navigated(tester);
    await _tapButton(tester, 'Sửa account');
    expect(_location(tester), '/permissions/acc-worker/edit');
    expect(find.text('Sửa tài khoản'), findsOneWidget);
    await _tapButton(tester, 'Lưu account');
    expect(app.adapter.requests.where((r) => r.method == 'PUT' && r.path == '/accounts/acc-worker'), hasLength(1));
    expect(_location(tester), '/permissions/acc-worker');
    expect(find.byType(AccountPermissionsScreen), findsOneWidget);
  });

  testWidgets('the account form routes follow the Phân quyền gate', (tester) async {
    await _signedIn(tester, _backend(permsA: ['orders.view_own']), toMenu: false);
    for (final path in ['/permissions/new', '/permissions/acc-worker/edit']) {
      _router(tester).go(path);
      await _navigated(tester);
      expect(find.byType(AccountFormScreen), findsNothing, reason: path);
      expect(_location(tester), '/dashboard', reason: path);
    }
  });

  testWidgets('Khách hàng → a customer with + in the phone → back returns to the list', (tester) async {
    final app = await _signedIn(tester, _backend());
    await tester.tap(find.text('Khách hàng'));
    await _navigated(tester);
    expect(find.byType(CustomerListScreen), findsOneWidget);
    expect(find.text('Nguyễn Văn A'), findsOneWidget);

    await tester.tap(find.widgetWithText(AppButton, 'Xem'));
    await _navigated(tester);
    expect(find.byType(CustomerDetailScreen), findsOneWidget);
    expect(app.adapter.to('/customers/%2B84903176968'), hasLength(1));
    expect(_location(tester), '/customers/%2B84903176968');

    await tester.binding.handlePopRoute();
    await _navigated(tester);
    expect(find.byType(CustomerListScreen), findsOneWidget);
    expect(find.byType(CustomerDetailScreen), findsNothing);
  });

  testWidgets('+ Thêm khách → an unknown phone → create → the new customer\'s detail, over the real adapters', (
    tester,
  ) async {
    final ok = _backend();
    var stored = false;
    final app = await _signedIn(tester, (r) {
      if (r.path == '/customers/lookup') {
        return jsonBody(200, {'found': false, 'phone': '+84903555777', 'customer': null});
      }
      if (r.path == '/customers' && r.method == 'POST') {
        stored = true;
        return jsonBody(201, _customer('+84903555777', 'Trần Thị B'));
      }
      if (r.path == '/customers' && stored) {
        return jsonBody(200, {
          'items': [_customer('+84903176968', 'Nguyễn Văn A'), _customer('+84903555777', 'Trần Thị B')],
          'total': 2,
          'page': 1,
          'pageSize': 20,
        });
      }
      if (r.path == '/customers/%2B84903555777') return jsonBody(200, _customer('+84903555777', 'Trần Thị B'));
      return ok(r);
    });
    await tester.tap(find.text('Khách hàng'));
    await _navigated(tester);
    await _tapButton(tester, '+ Thêm khách');
    // `/customers/lookup` is the pick screen, not a customer whose phone is "lookup".
    expect(_location(tester), '/customers/lookup');
    expect(find.byType(CustomerPickScreen), findsOneWidget);
    expect(app.adapter.to('/customers/lookup'), isEmpty);

    await tester.enterText(find.byType(TextField).first, '0903 555 777');
    await _tapButton(tester, 'Tra cứu');
    expect(app.adapter.to('/customers/lookup').single.query, {'phone': '0903 555 777'});
    await _tapButton(tester, 'Tạo khách hàng mới');
    await tester.enterText(find.byType(TextField).at(1), 'Trần Thị B');
    await _tapButton(tester, 'Facebook');
    await _tapButton(tester, 'Lưu khách hàng');

    final created = app.adapter.requests.singleWhere((r) => r.path == '/customers' && r.method == 'POST');
    expect(created.json, containsPair('phone', '0903 555 777'));
    expect(created.json, containsPair('name', 'Trần Thị B'));
    expect(created.json, containsPair('sourceId', 'src-1'));
    expect(find.byType(CustomerDetailScreen), findsOneWidget);
    expect(_location(tester), '/customers/%2B84903555777');
    expect(app.adapter.to('/customers/%2B84903555777'), hasLength(1));

    // The create form left the stack: Back returns to the list, which re-read and shows the new customer.
    await tester.binding.handlePopRoute();
    await _navigated(tester);
    expect(find.byType(CustomerPickScreen), findsNothing);
    expect(_location(tester), '/customers');
    expect(find.descendant(of: find.byType(CustomerListScreen), matching: find.text('Trần Thị B')), findsOneWidget);
  });

  testWidgets('a duplicate phone on create shows the backend sentence under SĐT, and stays on the form', (
    tester,
  ) async {
    final ok = _backend();
    final app = await _signedIn(tester, (r) {
      if (r.path == '/customers/lookup') {
        return jsonBody(200, {'found': false, 'phone': '+84903555777', 'customer': null});
      }
      if (r.path == '/customers' && r.method == 'POST') {
        return jsonBody(
          409,
          envelope(
            'CONFLICT',
            'Số điện thoại đã có khách hàng: +84903555777',
            fieldErrors: [
              {'field': 'phone', 'code': 'duplicate', 'message': 'Số điện thoại này đã thuộc về một khách hàng khác.'},
            ],
          ),
        );
      }
      return ok(r);
    });
    await tester.tap(find.text('Khách hàng'));
    await _navigated(tester);
    await _tapButton(tester, '+ Thêm khách');
    await tester.enterText(find.byType(TextField).first, '0903555777');
    await _tapButton(tester, 'Tra cứu');
    await _tapButton(tester, 'Tạo khách hàng mới');
    await tester.enterText(find.byType(TextField).at(1), 'Trần Thị B');
    await _tapButton(tester, 'Facebook');
    await _tapButton(tester, 'Lưu khách hàng');

    final fieldError = find.widgetWithText(AppBanner, 'Số điện thoại này đã thuộc về một khách hàng khác.');
    expect(fieldError, findsOneWidget);
    expect(tester.getTopLeft(fieldError).dy, lessThan(tester.getTopLeft(find.widgetWithText(AppButton, 'Tra cứu')).dy));
    expect(find.text('Số điện thoại đã có khách hàng: +84903555777'), findsOneWidget);
    expect(find.byType(CustomerDetailScreen), findsNothing);
    expect(_location(tester), '/customers/lookup');
    expect(app.adapter.requests.where((r) => r.path == '/customers' && r.method == 'POST'), hasLength(1));
  });

  testWidgets('Hồ sơ shows the /me identity and Cập nhật mật khẩu posts through the password adapter', (tester) async {
    final ok = _backend();
    final app = await _signedIn(tester, (r) => r.path == '/auth/change-password' ? noContent() : ok(r));
    final meCalls = app.adapter.to('/me').length;
    await tester.tap(find.text('Hồ sơ'));
    await _navigated(tester);
    final profile = find.byType(ProfileScreen);
    expect(profile, findsOneWidget);
    expect(find.descendant(of: profile, matching: find.text('Người A')), findsWidgets);
    expect(find.descendant(of: profile, matching: find.text('a@pns.solar')), findsWidgets);
    // The identity comes from the session's /me, not a second fetch.
    expect(app.adapter.to('/me'), hasLength(meCalls));

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'old-pass-1');
    await tester.enterText(fields.at(1), 'new-pass-22');
    await tester.enterText(fields.at(2), 'new-pass-22');
    await _tapButton(tester, 'Cập nhật mật khẩu');

    final change = app.adapter.to('/auth/change-password').single;
    expect(change.authorization, 'Bearer access-a');
    expect(change.json, {'currentPassword': 'old-pass-1', 'newPassword': 'new-pass-22'});
    expect(find.text('Đã đổi mật khẩu. Bạn cần đăng nhập lại.'), findsOneWidget);
  });

  testWidgets('a path the account may not open, or an unknown one, lands on the landing page', (tester) async {
    // Every account lands on Trang chủ (Story 8.1).
    await _signedIn(tester, _backend(permsA: ['orders.view_own']), toMenu: false);
    expect(find.byType(DashboardScreen), findsOneWidget);
    expect(_location(tester), '/dashboard');
    _router(tester).go('/customers');
    await _navigated(tester);
    expect(find.byType(CustomerListScreen), findsNothing);
    expect(_location(tester), '/dashboard');

    _router(tester).go('/nowhere');
    await _navigated(tester);
    expect(_location(tester), '/dashboard');

    // Control: an openable path does open.
    _router(tester).go('/warranty');
    await _navigated(tester);
    expect(find.byType(WarrantyLookupScreen), findsOneWidget);

    // Without an order key /orders is gated out — back to Trang chủ.
    await tester.pumpWidget(const SizedBox());
    await _signedIn(tester, _backend(permsA: ['customers.manage']), toMenu: false);
    expect(find.byType(DashboardScreen), findsOneWidget);
    _router(tester).go('/orders');
    await _navigated(tester);
    expect(find.byType(DashboardScreen), findsOneWidget);
    expect(_location(tester), '/dashboard');
  });

  testWidgets('the Menu tab from a sub-screen returns to the Menu; the tabs/FAB this account may not open do nothing; Trang chủ opens the dashboard', (
    tester,
  ) async {
    // customers.manage + orders.view_own: no stock key (Kho) and no quote key (Tạo).
    await _signedIn(tester, _backend());
    await tester.tap(find.text('Hồ sơ'));
    await _navigated(tester);
    expect(find.byType(ProfileScreen), findsOneWidget);

    for (final tab in ['Kho', 'Tạo']) {
      await tester.tap(find.text(tab));
      await _navigated(tester);
      expect(tester.takeException(), isNull, reason: tab);
      expect(_location(tester), '/profile', reason: tab);
    }

    await tester.tap(find.text('Menu'));
    await _navigated(tester);
    expect(find.byType(MenuScreen), findsOneWidget);
    expect(_location(tester), '/menu');

    // The Đơn hàng tab is wired (Story 10.8): this account may see orders.
    await tester.tap(find.text('Đơn hàng'));
    await _navigated(tester);
    expect(find.byType(OrderListScreen), findsOneWidget);
    expect(_location(tester), '/orders');

    // The Trang chủ tab is wired (Story 8.1) and needs no permission.
    await tester.tap(find.text('Trang chủ'));
    await _navigated(tester);
    expect(find.byType(DashboardScreen), findsOneWidget);
    expect(_location(tester), '/dashboard');
  });

  testWidgets('tapping Trang chủ while on it reads the figures again', (tester) async {
    final app = await _signedIn(tester, _backend(), toMenu: false);
    expect(find.byType(DashboardScreen), findsOneWidget);
    expect(app.adapter.to('/dashboard/summary'), hasLength(1));

    await tester.tap(find.text('Trang chủ'));
    await _navigated(tester);
    expect(_location(tester), '/dashboard');
    expect(app.adapter.to('/dashboard/summary'), hasLength(2));
  });

  testWidgets('signing out A and in as B gives B\'s permissions, not A\'s', (tester) async {
    await _signedIn(tester, _backend(permsB: ['orders.view_all']));
    expect(find.text('Khách hàng'), findsOneWidget);

    await _logout(tester);
    expect(find.byType(LoginScreen), findsOneWidget);
    await _login(tester, '0922222222');

    // B lands on Trang chủ; B's Menu is B's.
    expect(find.byType(DashboardScreen), findsOneWidget);
    await _openMenu(tester);
    expect(find.byType(MenuScreen), findsOneWidget);
    expect(find.text('Người B'), findsOneWidget);
    expect(find.text('Khách hàng'), findsNothing);
    expect(find.text('Tra cứu bảo hành'), findsOneWidget);
  });

  testWidgets('/me failing shows an error with Thử lại, which asks /me exactly once more', (tester) async {
    var meCalls = 0;
    final ok = _backend();
    final app = await _signedIn(tester, (r) {
      if (r.path == '/me' && ++meCalls == 1) return jsonBody(500, envelope('INTERNAL', 'Lỗi máy chủ.'));
      return ok(r);
    }, toMenu: false);
    expect(find.byType(AppErrorState), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Đăng xuất'), findsOneWidget);
    expect(app.adapter.to('/me'), hasLength(1));

    await tester.tap(find.widgetWithText(AppButton, 'Thử lại'));
    await _navigated(tester);
    expect(app.adapter.to('/me'), hasLength(2));
    // Signed in: the landing page (Trang chủ).
    expect(find.byType(DashboardScreen), findsOneWidget);
  });

  testWidgets('Đăng xuất on the /me error, tapped twice while logout is pending ⇒ one POST /auth/logout', (
    tester,
  ) async {
    final release = Completer<void>();
    final ok = _backend();
    final app = await _signedIn(tester, (r) async {
      if (r.path == '/me') return jsonBody(500, envelope('INTERNAL', 'Lỗi máy chủ.'));
      if (r.path == '/auth/logout') await release.future;
      return ok(r);
    }, toMenu: false);
    expect(find.byType(AppErrorState), findsOneWidget);
    final logout = find.widgetWithText(AppButton, 'Đăng xuất');
    await tester.tap(logout);
    await settle(tester);
    await tester.tap(logout);
    await settle(tester);
    // The second tap neither sends again nor jumps ahead of the pending sign-out.
    expect(find.byType(LoginScreen), findsNothing);
    release.complete();
    await _navigated(tester);

    expect(app.adapter.to('/auth/logout'), hasLength(1));
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('session expiry on a sub-screen ⇒ back to Đăng nhập', (tester) async {
    final app = await _signedIn(tester, _backend());
    await tester.tap(find.text('Tra cứu bảo hành'));
    await _navigated(tester);
    expect(find.byType(WarrantyLookupScreen), findsOneWidget);

    app.expired.value++;
    await _navigated(tester);
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('Tra cứu bảo hành over the router: the raw phone goes out, found:false is an answer', (tester) async {
    final app = await _signedIn(tester, _backend());
    await tester.tap(find.text('Tra cứu bảo hành'));
    await _navigated(tester);
    await tester.enterText(find.byType(TextField).first, '0999 999 999');
    await tester.tap(find.widgetWithText(AppButton, 'Tra cứu'));
    await _navigated(tester);
    expect(app.adapter.to('/orders/warranty-lookup').single.query, {'phone': '0999 999 999'});
    expect(find.text('SĐT chưa có trong hệ thống.'), findsOneWidget);
  });

  testWidgets('the on-screen keyboard never hides a routed form\'s button (Tra cứu bảo hành)', (tester) async {
    addTearDown(tester.view.reset);
    await _signedIn(tester, _backend());
    await tester.tap(find.text('Tra cứu bảo hành'));
    await _navigated(tester);

    tester.view.viewInsets = FakeViewPadding(bottom: 300.0 * tester.view.devicePixelRatio);
    await tester.pump();
    final button = find.widgetWithText(AppButton, 'Tra cứu');
    await tester.ensureVisible(button);
    await tester.pump();

    final visibleBottom = tester.view.physicalSize.height / tester.view.devicePixelRatio - 300.0;
    expect(tester.getRect(button).bottom, lessThanOrEqualTo(visibleBottom));
  });
}
