// PnsApp + composition root (Story 10.6; signed-in app 10.7): start-up restore,
// sign in, sign out, expiry back to Đăng nhập, Quên mật khẩu — over the real HTTP
// adapters + transport with a fake HTTP adapter. The app drops the mockup phone
// chrome (bare frame).
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/app/app_ports.dart';
import 'package:pns_mobile/app/pns_app.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/auth_port.dart';
import 'package:pns_mobile/design_system/shell/app_phone_frame.dart';
import 'package:pns_mobile/main.dart';
import 'package:pns_mobile/design_system/session/fake_catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_contracts_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/fake_invoices_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_audit_logs_port.dart';
import 'package:pns_mobile/design_system/session/fake_dashboard_port.dart';
import 'package:pns_mobile/design_system/session/fake_me_port.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/fake_password_port.dart';
import 'package:pns_mobile/design_system/session/fake_payments_port.dart';
import 'package:pns_mobile/design_system/session/fake_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/fake_warranty_port.dart';
import 'package:pns_mobile/screens/auth/forgot_password_screen.dart';
import 'package:pns_mobile/screens/auth/login_screen.dart';
import 'package:pns_mobile/screens/dashboard/dashboard_screen.dart';
import 'package:pns_mobile/screens/menu/menu_screen.dart';

import '../api/support/fake_http.dart';
import 'support/app_harness.dart';

/// A port whose start-up restore blows up (any adapter bug, not just an ApiError).
class _ThrowingRestorePort implements AuthPort {
  @override
  Future<bool> restoreSession() async => throw StateError('restore crashed');

  @override
  Future<void> login({required String phone, required String password}) async {}

  @override
  Future<void> logout() async {}
}

/// Backend: login ⇒ tokens; refresh ⇒ rotated tokens unless the token is 'dead'; logout ⇒ 204.
ResponseBody _backend(RecordedRequest r) {
  switch (r.path) {
    case '/auth/login':
      return jsonBody(200, tokens('access-1', 'refresh-1'));
    case '/auth/refresh':
      return (r.json as Map)['refreshToken'] == 'dead'
          ? jsonBody(401, envelope('UNAUTHENTICATED', 'Phiên đã bị thu hồi.'))
          : jsonBody(200, tokens('access-2', 'refresh-2'));
    case '/auth/logout':
      return noContent();
    case '/auth/forgot-password':
      return jsonBody(200, {'expiresInSeconds': 300});
    case '/me':
      return jsonBody(200, meBody(['customers.manage']));
    case '/dashboard/summary':
      return jsonBody(200, dashboardBody());
  }
  return jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy.'));
}

Future<void> _settle(WidgetTester tester) => settle(tester);

void main() {
  testWidgets('no stored refresh token ⇒ Đăng nhập, zero requests, no mockup chrome', (tester) async {
    final app = TestApp(_backend);
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.requests, isEmpty);
    // The real app renders edge-to-edge: the frame is there, its fake status bar is not.
    expect(find.byType(AppPhoneFrame), findsOneWidget);
    expect(find.text('9:41'), findsNothing);
  });

  testWidgets('sign in ⇒ Trang chủ; Menu → Đăng xuất ⇒ POST /auth/logout, store empty, back to Đăng nhập',
      (tester) async {
    final app = TestApp(_backend);
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    await tester.enterText(find.byType(TextField).at(0), '0912345678');
    await tester.enterText(find.byType(TextField).at(1), 'secret-1');
    await tester.tap(find.widgetWithText(AppButton, 'Đăng nhập'));
    await _settle(tester);
    expect(find.byType(DashboardScreen), findsOneWidget);
    expect(app.store.values[kRefreshTokenKey], 'refresh-1');

    await openMenuTab(tester);
    expect(find.byType(MenuScreen), findsOneWidget);
    await tester.tap(find.widgetWithText(AppButton, 'Đăng xuất'));
    await _settle(tester);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.to('/auth/logout').single.json, {'refreshToken': 'refresh-1'});
    expect(app.store.values, isEmpty);
    expect(app.session.accessToken, isNull);
  });

  testWidgets('a valid stored refresh token at start-up ⇒ straight to Trang chủ', (tester) async {
    final app = TestApp(_backend);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    expect(find.byType(AppSkeleton), findsWidgets);
    await _settle(tester);

    expect(find.byType(DashboardScreen), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    expect(app.adapter.to('/auth/refresh'), hasLength(1));
  });

  testWidgets('a refused refresh at start-up ⇒ Đăng nhập and the dead token is gone', (tester) async {
    final app = TestApp(_backend);
    app.store.values[kRefreshTokenKey] = 'dead';
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.store.values, isEmpty);
  });

  testWidgets('session expiry reported by the transport ⇒ back to Đăng nhập', (tester) async {
    final app = TestApp(_backend);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);
    expect(find.byType(DashboardScreen), findsOneWidget);

    app.expired.value++;
    await tester.pump();
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('composition root without API_BASE_URL ⇒ configuration error, no app wired', (tester) async {
    await tester.pumpWidget(buildApp(''));
    expect(find.byType(ConfigErrorApp), findsOneWidget);
    expect(find.byType(PnsApp), findsNothing);
    expect(find.textContaining('Chưa cấu hình địa chỉ máy chủ'), findsOneWidget);
  });

  testWidgets('composition root with a base URL wires PnsApp (empty store ⇒ Đăng nhập)', (tester) async {
    await tester.pumpWidget(buildApp('http://backend.test', secureStore: MemoryKeyValueStore()));
    await _settle(tester);
    expect(find.byType(PnsApp), findsOneWidget);
    expect(find.byType(LoginScreen), findsOneWidget);
  });
  testWidgets('backend unreachable at start-up ⇒ Đăng nhập, the stored token is dropped', (tester) async {
    final app = TestApp(refuseConnection);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.to('/auth/refresh'), hasLength(1));
    expect(app.store.values, isEmpty);
  });

  testWidgets('unreadable secure storage at start-up ⇒ Đăng nhập, zero requests, no crash', (tester) async {
    final app = TestApp(_backend);
    app.store.failing = true;
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.requests, isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Đăng xuất with the network down still returns to Đăng nhập and empties the store', (tester) async {
    final app = TestApp(_backend);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);
    await openMenuTab(tester);
    expect(find.byType(MenuScreen), findsOneWidget);

    app.adapter.handler = refuseConnection;
    await tester.tap(find.widgetWithText(AppButton, 'Đăng xuất'));
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.to('/auth/logout'), hasLength(1));
    expect(app.store.values, isEmpty);
    expect(app.session.accessToken, isNull);
  });

  testWidgets('signed in, /me whose renewal is refused ⇒ the transport sends the app back to Đăng nhập',
      (tester) async {
    // Start-up renewal hands out a refresh token the backend then refuses; /me answers 401.
    final app = TestApp((r) {
      switch (r.path) {
        case '/auth/refresh':
          return (r.json as Map)['refreshToken'] == 'dead'
              ? jsonBody(401, envelope('UNAUTHENTICATED', 'Phiên đã bị thu hồi.'))
              : jsonBody(200, tokens('access-2', 'dead'));
        case '/me':
          return jsonBody(401, envelope('UNAUTHENTICATED', 'Token hết hạn.'));
      }
      return jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy.'));
    });
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.expired.value, 1);
    expect(app.adapter.to('/me'), hasLength(1));
    expect(app.adapter.to('/auth/refresh'), hasLength(2));
    expect(app.store.values, isEmpty);
  });

  testWidgets('a restore that throws ⇒ Đăng nhập instead of a stuck skeleton', (tester) async {
    await tester.pumpWidget(PnsApp(
      auth: _ThrowingRestorePort(),
      ports: AppPorts(
        me: const FakeMePort(),
        password: const FakePasswordPort(),
        customers: FakeCustomersPort(),
        warranty: const FakeWarrantyPort(),
        catalog: FakeCatalogPort(),
        orders: FakeOrdersPort(),
        inventory: const FakeInventoryPort(),
        stockVouchers: FakeStockVouchersPort(),
        payments: FakePaymentsPort(),
        contracts: FakeContractsPort(),
        invoices: FakeInvoicesPort(),
        dashboard: FakeDashboardPort(),
        accounts: FakeAccountsPort(),
        auditLogs: FakeAuditLogsPort(),
      ),
    ));
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(AppSkeleton), findsNothing);
  });

  testWidgets('the on-screen keyboard never hides the Đăng nhập button (body lifted above it)', (tester) async {
    addTearDown(tester.view.reset);
    final app = TestApp(_backend);
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    // Keyboard up: half of the 600-logical-pixel test screen is covered.
    tester.view.viewInsets = FakeViewPadding(bottom: 300.0 * tester.view.devicePixelRatio);
    await tester.pump();
    final button = find.widgetWithText(AppButton, 'Đăng nhập');
    await tester.ensureVisible(button);
    await tester.pump();

    final visibleBottom = tester.view.physicalSize.height / tester.view.devicePixelRatio - 300.0;
    expect(tester.getRect(button).bottom, lessThanOrEqualTo(visibleBottom));
  });

  testWidgets('Đăng xuất tapped twice while the logout call is pending ⇒ one POST /auth/logout', (tester) async {
    final release = Completer<void>();
    final app = TestApp((r) async {
      if (r.path == '/auth/logout') await release.future;
      return _backend(r);
    });
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);
    await openMenuTab(tester);

    final logout = find.widgetWithText(AppButton, 'Đăng xuất');
    await tester.tap(logout);
    await _settle(tester);
    await tester.tap(logout);
    await _settle(tester);
    release.complete();
    await _settle(tester);

    expect(app.adapter.to('/auth/logout'), hasLength(1));
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('Đăng nhập → Quên mật khẩu ⇒ sending the code posts the raw phone; back ⇒ Đăng nhập', (tester) async {
    final app = TestApp(_backend);
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    await tester.tap(find.text('Quên mật khẩu?'));
    await _settle(tester);
    expect(find.byType(ForgotPasswordScreen), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, '0912 345 678');
    await tester.tap(find.widgetWithText(AppButton, 'Gửi mã'));
    await _settle(tester);
    expect(app.adapter.to('/auth/forgot-password').single.json, {'phone': '0912 345 678'});

    // Step 2's card scrolls; bring the back action into view before tapping it.
    await tester.ensureVisible(find.widgetWithText(AppButton, 'Quay lại đăng nhập'));
    await tester.pump();
    await tester.tap(find.widgetWithText(AppButton, 'Quay lại đăng nhập'));
    await _settle(tester);
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('the Android back button on Quên mật khẩu returns to Đăng nhập, it does not close the app', (
    tester,
  ) async {
    await tester.pumpWidget(TestApp(_backend).widget);
    await _settle(tester);
    await tester.tap(find.text('Quên mật khẩu?'));
    await _settle(tester);
    expect(find.byType(ForgotPasswordScreen), findsOneWidget);

    expect(await tester.binding.handlePopRoute(), isTrue, reason: 'false = the system would close the app');
    await _settle(tester);
    expect(find.byType(LoginScreen), findsOneWidget);
  });
}
