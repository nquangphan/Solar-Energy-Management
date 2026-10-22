// HttpAuthPort (Story 10.6): real generated client + transport over a fake
// HTTP adapter — tokens land in the session store, logout always clears it,
// restore without a stored token makes no request.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/generated/pns_api_client.dart';
import 'package:pns_mobile/api/http_auth_port.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/api/transport.dart';

import 'support/fake_http.dart';

class _Auth {
  _Auth(FakeHandler handler) : adapter = FakeAdapter(handler) {
    transport = Transport(baseUrl: 'http://backend.test', session: session, adapter: adapter);
    port = HttpAuthPort(PnsApiClient(transport.dio), session, transport);
  }

  final FakeAdapter adapter;
  final MemoryKeyValueStore store = MemoryKeyValueStore();
  late final SessionStore session = SessionStore(store);
  late final Transport transport;
  late final HttpAuthPort port;
}

void main() {
  test('login 200 stores both tokens and sends the typed body', () async {
    final a = _Auth((_) => jsonBody(200, tokens('access-1', 'refresh-1')));
    await a.port.login(email: 'nv@pns.solar', password: 'secret-1');
    expect(a.session.accessToken, 'access-1');
    expect(a.store.values[kRefreshTokenKey], 'refresh-1');
    final request = a.adapter.requests.single;
    expect([request.method, request.path], ['POST', '/auth/login']);
    expect(request.json, {'email': 'nv@pns.solar', 'password': 'secret-1'});
    expect(request.authorization, isNull);
  });

  test('login 401 throws the envelope message and stores nothing', () async {
    final a = _Auth((_) => jsonBody(401, envelope('UNAUTHENTICATED', 'Thông tin đăng nhập không đúng')));
    await expectLater(
      a.port.login(email: 'nv@pns.solar', password: 'wrong'),
      throwsA(isA<ApiError>()
          .having((e) => e.message, 'message', 'Thông tin đăng nhập không đúng')
          .having((e) => e.status, 'status', 401)),
    );
    expect(a.session.accessToken, isNull);
    expect(a.store.values, isEmpty);
    expect(a.adapter.to('/auth/refresh'), isEmpty);
  });

  test('logout posts the stored refresh token and clears the session', () async {
    final a = _Auth((_) => noContent());
    await a.session.setTokens(accessToken: 'access-1', refreshToken: 'refresh-1');
    await a.port.logout();
    expect(a.adapter.to('/auth/logout').single.json, {'refreshToken': 'refresh-1'});
    expect(a.session.accessToken, isNull);
    expect(a.store.values, isEmpty);
  });

  test('logout clears the session even when the network is down', () async {
    final a = _Auth(refuseConnection);
    await a.session.setTokens(accessToken: 'access-1', refreshToken: 'refresh-1');
    await a.port.logout();
    expect(a.adapter.requests, hasLength(1));
    expect(a.session.accessToken, isNull);
    expect(a.store.values, isEmpty);
  });

  test('restore without a stored refresh token answers false with zero requests', () async {
    final a = _Auth((_) => jsonBody(200, tokens('x', 'y')));
    expect(await a.port.restoreSession(), isFalse);
    expect(a.adapter.requests, isEmpty);
  });

  test('restore trades the stored refresh token for new tokens', () async {
    final a = _Auth((_) => jsonBody(200, tokens('access-2', 'refresh-2')));
    await a.store.write(kRefreshTokenKey, 'refresh-1');
    expect(await a.port.restoreSession(), isTrue);
    expect(a.adapter.to('/auth/refresh').single.json, {'refreshToken': 'refresh-1'});
    expect(a.session.accessToken, 'access-2');
    expect(a.store.values[kRefreshTokenKey], 'refresh-2');
  });

  test('restore with a refused refresh answers false and clears the store', () async {
    final a = _Auth((_) => jsonBody(401, envelope('UNAUTHENTICATED', 'Phiên đã bị thu hồi.')));
    await a.store.write(kRefreshTokenKey, 'refresh-1');
    expect(await a.port.restoreSession(), isFalse);
    expect(a.store.values, isEmpty);
  });
}
