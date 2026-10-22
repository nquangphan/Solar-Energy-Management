// PnsApp + composition root (Story 10.6): start-up restore, sign in, sign out,
// expiry back to Đăng nhập — over the real HttpAuthPort + transport with a fake
// HTTP adapter. The app drops the mockup phone chrome (bare frame).
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/generated/pns_api_client.dart';
import 'package:pns_mobile/api/http_auth_port.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/api/transport.dart';
import 'package:pns_mobile/app/pns_app.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/auth_port.dart';
import 'package:pns_mobile/design_system/shell/app_phone_frame.dart';
import 'package:pns_mobile/main.dart';
import 'package:pns_mobile/screens/auth/login_screen.dart';

import '../api/support/fake_http.dart';

class _App {
  _App(FakeHandler handler) : adapter = FakeAdapter(handler) {
    transport = Transport(
      baseUrl: 'http://backend.test',
      session: session,
      adapter: adapter,
      onSessionExpired: () => expired.value++,
    );
    client = PnsApiClient(transport.dio);
    widget = PnsApp(auth: HttpAuthPort(client, session, transport), sessionExpired: expired);
  }

  final FakeAdapter adapter;
  final MemoryKeyValueStore store = MemoryKeyValueStore();
  late final SessionStore session = SessionStore(store);
  final ValueNotifier<int> expired = ValueNotifier<int>(0);
  late final Transport transport;
  late final PnsApiClient client;
  late final PnsApp widget;
}

/// A port whose start-up restore blows up (any adapter bug, not just an ApiError).
class _ThrowingRestorePort implements AuthPort {
  @override
  Future<bool> restoreSession() async => throw StateError('restore crashed');

  @override
  Future<void> login({required String email, required String password}) async {}

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
  }
  return jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy.'));
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

void main() {
  testWidgets('no stored refresh token ⇒ Đăng nhập, zero requests, no mockup chrome', (tester) async {
    final app = _App(_backend);
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.requests, isEmpty);
    // The real app renders edge-to-edge: the frame is there, its fake status bar is not.
    expect(find.byType(AppPhoneFrame), findsOneWidget);
    expect(find.text('9:41'), findsNothing);
  });

  testWidgets('sign in ⇒ "Đã đăng nhập."; Đăng xuất ⇒ POST /auth/logout, store empty, back to Đăng nhập',
      (tester) async {
    final app = _App(_backend);
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    await tester.enterText(find.byType(TextField).at(0), 'nv@pns.solar');
    await tester.enterText(find.byType(TextField).at(1), 'secret-1');
    await tester.tap(find.widgetWithText(AppButton, 'Đăng nhập'));
    await _settle(tester);
    expect(find.text('Đã đăng nhập.'), findsOneWidget);
    expect(app.store.values[kRefreshTokenKey], 'refresh-1');

    await tester.tap(find.widgetWithText(AppButton, 'Đăng xuất'));
    await _settle(tester);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.to('/auth/logout').single.json, {'refreshToken': 'refresh-1'});
    expect(app.store.values, isEmpty);
    expect(app.session.accessToken, isNull);
  });

  testWidgets('a valid stored refresh token at start-up ⇒ straight to "Đã đăng nhập."', (tester) async {
    final app = _App(_backend);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    expect(find.byType(AppSkeleton), findsWidgets);
    await _settle(tester);

    expect(find.text('Đã đăng nhập.'), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    expect(app.adapter.to('/auth/refresh'), hasLength(1));
  });

  testWidgets('a refused refresh at start-up ⇒ Đăng nhập and the dead token is gone', (tester) async {
    final app = _App(_backend);
    app.store.values[kRefreshTokenKey] = 'dead';
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.store.values, isEmpty);
  });

  testWidgets('session expiry reported by the transport ⇒ back to Đăng nhập', (tester) async {
    final app = _App(_backend);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);
    expect(find.text('Đã đăng nhập.'), findsOneWidget);

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
    final app = _App(refuseConnection);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.to('/auth/refresh'), hasLength(1));
    expect(app.store.values, isEmpty);
  });

  testWidgets('unreadable secure storage at start-up ⇒ Đăng nhập, zero requests, no crash', (tester) async {
    final app = _App(_backend);
    app.store.failing = true;
    await tester.pumpWidget(app.widget);
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.requests, isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Đăng xuất with the network down still returns to Đăng nhập and empties the store', (tester) async {
    final app = _App(_backend);
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);
    expect(find.text('Đã đăng nhập.'), findsOneWidget);

    app.adapter.handler = refuseConnection;
    await tester.tap(find.widgetWithText(AppButton, 'Đăng xuất'));
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.adapter.to('/auth/logout'), hasLength(1));
    expect(app.store.values, isEmpty);
    expect(app.session.accessToken, isNull);
  });

  testWidgets('signed in, a private call whose renewal is refused ⇒ the transport sends the app back to Đăng nhập',
      (tester) async {
    // Start-up renewal hands out a refresh token the backend then refuses; /me answers 401.
    final app = _App((r) {
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
    expect(find.text('Đã đăng nhập.'), findsOneWidget);

    Object? failure;
    unawaited(app.transport.call(() => app.client.auth.meControllerMe()).then<void>((_) {}, onError: (Object e) {
      failure = e;
    }));
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(app.expired.value, 1);
    expect(app.adapter.to('/auth/refresh'), hasLength(2));
    expect(app.store.values, isEmpty);
    expect(failure, isA<ApiError>().having((e) => e.message, 'message', 'Phiên đã bị thu hồi.'));
  });
  testWidgets('a restore that throws ⇒ Đăng nhập instead of a stuck skeleton', (tester) async {
    await tester.pumpWidget(PnsApp(auth: _ThrowingRestorePort()));
    await _settle(tester);

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(AppSkeleton), findsNothing);
  });

  testWidgets('the on-screen keyboard never hides the Đăng nhập button (body lifted above it)', (tester) async {
    addTearDown(tester.view.reset);
    final app = _App(_backend);
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
    final app = _App((r) async {
      if (r.path == '/auth/logout') await release.future;
      return _backend(r);
    });
    app.store.values[kRefreshTokenKey] = 'refresh-0';
    await tester.pumpWidget(app.widget);
    await _settle(tester);

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
}
