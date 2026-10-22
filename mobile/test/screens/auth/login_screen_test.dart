// Native Flutter widget test for the Đăng nhập screen (Story 1.11 — AC-1/2;
// signs in since Story 10.6). Mirrors mobile/test/design_system/shell_render_test.dart:
// pump the real screen and assert it composes the shipped widgets, has no auth
// nav (UX-DR-15), and that empty-submit validation surfaces an AppBanner (AC-2).
// The Story 10.6 group drives the REAL HttpAuthPort + transport over a fake
// HTTP adapter (no FakeAuthPort).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:dio/dio.dart';
import 'package:pns_mobile/api/generated/pns_api_client.dart';
import 'package:pns_mobile/api/http_auth_port.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/api/transport.dart';
import 'package:pns_mobile/design_system/icons/app_icons.dart';
import 'package:pns_mobile/design_system/session/session.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';
import 'package:pns_mobile/screens/auth/login_screen.dart';

import '../../api/support/fake_http.dart';

// Scaffold supplies the Material ancestor AppField's TextField needs; the real
// app entry (Epic 2) provides it via its own Material surface.
Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

LoginScreen _screen() => LoginScreen(port: const FakeAuthPort(), onLoggedIn: () {});

/// LoginScreen on the real HTTP sign-in stack; the backend is [adapter].
LoginScreen _httpScreen(FakeAdapter adapter, SessionStore session, VoidCallback onLoggedIn) {
  final transport = Transport(baseUrl: 'http://backend.test', session: session, adapter: adapter);
  return LoginScreen(
    port: HttpAuthPort(PnsApiClient(transport.dio), session, transport),
    onLoggedIn: onLoggedIn,
  );
}

/// Lets the HTTP stack (futures + Dio timers in the fake-async zone) run to completion.
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

Future<void> _fillAndSubmit(WidgetTester tester, String email, String password) async {
  await tester.enterText(find.byType(TextField).at(0), email);
  await tester.enterText(find.byType(TextField).at(1), password);
  await tester.tap(find.byType(AppButton));
}

void main() {
  group('LoginScreen (Story 1.11)', () {
    testWidgets('composes 2 AppField + primary AppButton + brand (AC-1)',
        (tester) async {
      await tester.pumpWidget(_host(_screen()));

      expect(find.byType(AppField), findsNWidgets(2));
      expect(find.byType(AppButton), findsOneWidget);
      expect(find.text('Đăng nhập'), findsOneWidget);
      expect(find.text('Phương Nam Solar'), findsOneWidget);
      expect(find.text('Quên mật khẩu?'), findsOneWidget);
      // Brand mark uses the canonical ic-sun icon.
      expect(
        find.byWidgetPredicate((w) => w is AppIcon && w.name == 'ic-sun'),
        findsOneWidget,
      );
    });

    testWidgets('auth screen has no topbar/bottom-nav (UX-DR-15)',
        (tester) async {
      await tester.pumpWidget(_host(_screen()));

      expect(find.byType(AppPhoneFrame), findsOneWidget);
      expect(find.byType(AppTopbar), findsNothing);
      expect(find.byType(AppBottomNav), findsNothing);
      expect(find.byType(AppMobileShell), findsNothing);
    });

    testWidgets('empty submit surfaces an AppBanner error (AC-2)',
        (tester) async {
      await tester.pumpWidget(_host(_screen()));

      // No error banner before submit.
      expect(find.byType(AppBanner), findsNothing);

      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(find.byType(AppBanner), findsOneWidget);
      expect(find.text('Nhập đủ tài khoản và mật khẩu.'), findsOneWidget);
    });

    testWidgets('malformed account surfaces the format error (AC-2)',
        (tester) async {
      await tester.pumpWidget(_host(_screen()));

      // Account is not a valid email.
      await tester.enterText(find.byType(TextField).at(0), 'not-an-account');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(find.byType(AppBanner), findsOneWidget);
      expect(
        find.text('Tài khoản phải là email hợp lệ.'),
        findsOneWidget,
      );
    });

    testWidgets('a phone number is refused — sign-in is by email only',
        (tester) async {
      await tester.pumpWidget(_host(_screen()));

      await tester.enterText(find.byType(TextField).at(0), '0912345678');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(find.text('Tài khoản phải là email hợp lệ.'), findsOneWidget);
    });

    testWidgets('valid credentials clear the error region (AC-2 happy path)',
        (tester) async {
      await tester.pumpWidget(_host(_screen()));

      // First force an error so we can prove a valid submit clears it.
      await tester.tap(find.byType(AppButton));
      await tester.pump();
      expect(find.byType(AppBanner), findsOneWidget);

      await tester.enterText(find.byType(TextField).at(0), 'admin@pns.vn');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.byType(AppButton));
      await tester.pump();

      // Valid email + password ⇒ no banner (real auth wires in Story 10.6).
      expect(find.byType(AppBanner), findsNothing);
    });

    testWidgets('valid email is accepted too (AC-2 happy path)',
        (tester) async {
      await tester.pumpWidget(_host(_screen()));

      await tester.enterText(find.byType(TextField).at(0), 'a@b.co');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(find.byType(AppBanner), findsNothing);
    });

    testWidgets('password field masks its input (AC-1)', (tester) async {
      await tester.pumpWidget(_host(_screen()));

      // Field order: account (0), password (1).
      final TextField password =
          tester.widget<TextField>(find.byType(TextField).at(1));
      expect(password.obscureText, isTrue);
    });
  });

  group('LoginScreen signs in over HTTP (Story 10.6)', () {
    testWidgets('right credentials ⇒ one POST /auth/login with the typed body, onLoggedIn once', (tester) async {
      final adapter = FakeAdapter((_) => jsonBody(200, tokens('access-1', 'refresh-1')));
      final store = MemoryKeyValueStore();
      var loggedIn = 0;
      await tester.pumpWidget(_host(_httpScreen(adapter, SessionStore(store), () => loggedIn++)));

      await _fillAndSubmit(tester, ' nv@pns.solar ', 'secret-1');
      await _settle(tester);

      expect(loggedIn, 1);
      expect(adapter.requests.single.path, '/auth/login');
      expect(adapter.requests.single.json, {'email': 'nv@pns.solar', 'password': 'secret-1'});
      expect(store.values[kRefreshTokenKey], 'refresh-1');
      expect(find.byType(AppBanner), findsNothing);
    });

    testWidgets('401 envelope ⇒ banner shows the backend message verbatim, button enabled again', (tester) async {
      final adapter = FakeAdapter((_) => jsonBody(401, envelope('UNAUTHENTICATED', 'Thông tin đăng nhập không đúng')));
      final store = MemoryKeyValueStore();
      var loggedIn = 0;
      await tester.pumpWidget(_host(_httpScreen(adapter, SessionStore(store), () => loggedIn++)));

      await _fillAndSubmit(tester, 'nv@pns.solar', 'wrong');
      await _settle(tester);

      expect(find.text('Thông tin đăng nhập không đúng'), findsOneWidget);
      expect(loggedIn, 0);
      expect(store.values, isEmpty);
      expect(tester.widget<AppButton>(find.byType(AppButton)).onPressed, isNotNull);
    });

    testWidgets('a second tap while busy sends no second request', (tester) async {
      final gate = Completer<ResponseBody>();
      final adapter = FakeAdapter((_) => gate.future);
      var loggedIn = 0;
      await tester.pumpWidget(_host(_httpScreen(adapter, SessionStore(MemoryKeyValueStore()), () => loggedIn++)));

      await _fillAndSubmit(tester, 'nv@pns.solar', 'secret-1');
      await _settle(tester);
      expect(tester.widget<AppButton>(find.byType(AppButton)).onPressed, isNull);
      await tester.tap(find.byType(AppButton));
      await _settle(tester);
      expect(adapter.requests, hasLength(1));

      gate.complete(jsonBody(200, tokens('access-1', 'refresh-1')));
      await _settle(tester);
      expect(loggedIn, 1);
      expect(adapter.requests, hasLength(1));
    });

    testWidgets('backend unreachable ⇒ banner shows the network message, nothing stored, button enabled again',
        (tester) async {
      final adapter = FakeAdapter(refuseConnection);
      final store = MemoryKeyValueStore();
      var loggedIn = 0;
      await tester.pumpWidget(_host(_httpScreen(adapter, SessionStore(store), () => loggedIn++)));

      await _fillAndSubmit(tester, 'nv@pns.solar', 'secret-1');
      await _settle(tester);

      expect(find.text('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'), findsOneWidget);
      expect(loggedIn, 0);
      expect(store.values, isEmpty);
      expect(adapter.to('/auth/refresh'), isEmpty);
      expect(tester.widget<AppButton>(find.byType(AppButton)).onPressed, isNotNull);
    });

    testWidgets('the password is sent exactly as typed (only the email is trimmed)', (tester) async {
      final adapter = FakeAdapter((_) => jsonBody(200, tokens('access-1', 'refresh-1')));
      await tester.pumpWidget(_host(_httpScreen(adapter, SessionStore(MemoryKeyValueStore()), () {})));

      await _fillAndSubmit(tester, 'nv@pns.solar', ' pass word ');
      await _settle(tester);

      expect(adapter.requests.single.json, {'email': 'nv@pns.solar', 'password': ' pass word '});
    });

    testWidgets('a failure that is not an ApiError shows the generic Vietnamese message', (tester) async {
      await tester.pumpWidget(_host(LoginScreen(port: FakeAuthPort(throwWith: StateError('boom')), onLoggedIn: () {})));
      await _fillAndSubmit(tester, 'nv@pns.solar', 'secret-1');
      await tester.pump();
      expect(find.text('Không thực hiện được. Thử lại.'), findsOneWidget);
      expect(find.textContaining('boom'), findsNothing);
    });
  });
}
