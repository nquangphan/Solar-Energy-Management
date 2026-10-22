// The mobile HTTP stack over a REAL socket (Story 10.6): Transport with Dio's
// default IO adapter + generated client + HttpAuthPort against an HttpServer on
// 127.0.0.1 that mimics the backend's auth routes. The other api tests swap the
// adapter out; this one proves the production adapter path — headers, JSON
// bodies, a base path, refresh + replay — on the wire. Loopback only.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/generated/pns_api_client.dart';
import 'package:pns_mobile/api/http_auth_port.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/api/transport.dart';

import 'support/fake_http.dart';

class _Seen {
  _Seen(this.method, this.path, this.authorization, this.body);

  final String method;
  final String path;
  final String? authorization;
  final Object? body;
}

/// Backend stand-in under `/api`: credentials `nv@pns.solar` / `secret-1`; `/me` accepts only [validAccess].
class _Backend {
  late final HttpServer server;
  final List<_Seen> seen = [];
  String validAccess = 'access-1';
  int _rotation = 1;

  String get baseUrl => 'http://${server.address.host}:${server.port}/api';

  Future<void> start() async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen(_handle);
  }

  Future<void> _handle(HttpRequest request) async {
    final text = await utf8.decoder.bind(request).join();
    final body = text.isEmpty ? null : jsonDecode(text);
    final path = request.uri.path;
    seen.add(_Seen(request.method, path, request.headers.value(HttpHeaders.authorizationHeader), body));

    void reply(int status, [Object? json]) {
      request.response.statusCode = status;
      if (json != null) {
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(json));
      }
      request.response.close();
    }

    switch ('${request.method} $path') {
      case 'POST /api/auth/login':
        final ok = body is Map && body['email'] == 'nv@pns.solar' && body['password'] == 'secret-1';
        return ok
            ? reply(200, tokens('access-1', 'refresh-1'))
            : reply(401, envelope('UNAUTHENTICATED', 'Thông tin đăng nhập không đúng'));
      case 'POST /api/auth/refresh':
        if (body is! Map || body['refreshToken'] != 'refresh-$_rotation') {
          return reply(401, envelope('UNAUTHENTICATED', 'Phiên đã bị thu hồi.'));
        }
        _rotation++;
        validAccess = 'access-$_rotation';
        return reply(200, tokens(validAccess, 'refresh-$_rotation'));
      case 'POST /api/auth/logout':
        return reply(204);
      case 'GET /api/me':
        return request.headers.value(HttpHeaders.authorizationHeader) == 'Bearer $validAccess'
            ? reply(200, {'id': 'u-1', 'email': 'nv@pns.solar', 'displayName': 'Nhân viên', 'permissions': <String>[]})
            : reply(401, envelope('UNAUTHENTICATED', 'Token hết hạn.'));
    }
    reply(404, envelope('NOT_FOUND', 'Không tìm thấy.'));
  }
}

void main() {
  late _Backend backend;
  late MemoryKeyValueStore store;
  late SessionStore session;
  late Transport transport;
  late PnsApiClient client;
  late HttpAuthPort port;
  late int expired;

  setUp(() async {
    backend = _Backend();
    await backend.start();
    store = MemoryKeyValueStore();
    session = SessionStore(store);
    expired = 0;
    transport = Transport(baseUrl: backend.baseUrl, session: session, onSessionExpired: () => expired++);
    client = PnsApiClient(transport.dio);
    port = HttpAuthPort(client, session, transport);
  });

  tearDown(() => backend.server.close(force: true));

  test('sign in, an expired access token renewed + replayed, sign out — over a real socket', () async {
    await port.login(email: 'nv@pns.solar', password: 'secret-1');
    expect(session.accessToken, 'access-1');
    expect(store.values[kRefreshTokenKey], 'refresh-1');

    expect((await transport.call(() => client.auth.meControllerMe())).email, 'nv@pns.solar');

    // The backend lets access-1 lapse: /me 401 ⇒ one refresh ⇒ replay with the new Bearer.
    backend.validAccess = 'expired';
    expect((await transport.call(() => client.auth.meControllerMe())).displayName, 'Nhân viên');
    expect(session.accessToken, 'access-2');
    expect(store.values[kRefreshTokenKey], 'refresh-2');

    await port.logout();
    expect(store.values, isEmpty);
    expect(session.accessToken, isNull);
    expect(expired, 0);

    expect([for (final s in backend.seen) '${s.method} ${s.path} ${s.authorization}'], [
      'POST /api/auth/login null',
      'GET /api/me Bearer access-1',
      'GET /api/me Bearer access-1',
      'POST /api/auth/refresh null',
      'GET /api/me Bearer access-2',
      'POST /api/auth/logout null',
    ]);
    expect(backend.seen[3].body, {'refreshToken': 'refresh-1'});
    expect(backend.seen.last.body, {'refreshToken': 'refresh-2'});
  });

  test('wrong password ⇒ ApiError with the backend message, no refresh, nothing stored', () async {
    await expectLater(
      port.login(email: 'nv@pns.solar', password: 'wrong'),
      throwsA(isA<ApiError>()
          .having((e) => e.status, 'status', 401)
          .having((e) => e.code, 'code', 'UNAUTHENTICATED')
          .having((e) => e.message, 'message', 'Thông tin đăng nhập không đúng')),
    );
    expect(backend.seen.map((s) => s.path), ['/api/auth/login']);
    expect(store.values, isEmpty);
  });

  test('restore at start-up trades the stored token; a revoked one signs out once', () async {
    store.values[kRefreshTokenKey] = 'refresh-1';
    expect(await port.restoreSession(), isTrue);
    expect(session.accessToken, 'access-2');

    store.values[kRefreshTokenKey] = 'revoked';
    expect(await port.restoreSession(), isFalse);
    expect(store.values, isEmpty);
    expect(session.accessToken, isNull);
    expect(expired, 1);
  });

  test('backend down ⇒ the network message, no status', () async {
    final port = backend.server.port;
    await backend.server.close(force: true);
    final offline = Transport(baseUrl: 'http://127.0.0.1:$port/api', session: session);
    final auth = HttpAuthPort(PnsApiClient(offline.dio), session, offline);
    await expectLater(
      auth.login(email: 'nv@pns.solar', password: 'secret-1'),
      throwsA(isA<ApiError>()
          .having((e) => e.message, 'message', kNetworkErrorMessage)
          .having((e) => e.status, 'status', isNull)),
    );
  });
}
