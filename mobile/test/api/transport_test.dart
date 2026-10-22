// Transport (Story 10.6): envelope → ApiError in one place, Bearer on private
// routes only, single-flight refresh on 401 with at most one replay per request.
// Every case counts the requests the fake adapter actually received.
import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/api/transport.dart';

import 'support/fake_http.dart';

const _base = 'http://backend.test';

class _Harness {
  _Harness(FakeHandler handler, {String baseUrl = _base}) : adapter = FakeAdapter(handler) {
    transport = Transport(
      baseUrl: baseUrl,
      session: session,
      adapter: adapter,
      onSessionExpired: () => expiredCalls++,
    );
  }

  final FakeAdapter adapter;
  final MemoryKeyValueStore store = MemoryKeyValueStore();
  late final SessionStore session = SessionStore(store);
  late final Transport transport;
  int expiredCalls = 0;

  Future<void> signIn(String access, String refresh) => session.setTokens(accessToken: access, refreshToken: refresh);

  Future<Object?> get(String path, {ResponseType? responseType, CancelToken? cancelToken}) =>
      transport.call(() async => (await transport.dio.get<Object?>(path,
              options: responseType == null ? null : Options(responseType: responseType), cancelToken: cancelToken))
          .data);

  Future<Object?> post(String path, {Object? data}) =>
      transport.call(() async => (await transport.dio.post<Object?>(path, data: data)).data);
}

/// 401 for a stale token, 200 for `Bearer access-2`; refresh rotates to access-2 / refresh-2.
FutureOr<ResponseBody> _renewingBackend(RecordedRequest r) {
  if (r.path.endsWith('/auth/refresh')) return jsonBody(200, tokens('access-2', 'refresh-2'));
  if (r.authorization == 'Bearer access-2') return jsonBody(200, {'ok': r.path});
  return jsonBody(401, envelope('UNAUTHENTICATED', 'Token hết hạn.'));
}

TypeMatcher<ApiError> _apiError({int? status, String? code, String? message}) => isA<ApiError>()
    .having((e) => e.status, 'status', status)
    .having((e) => e.code, 'code', code)
    .having((e) => e.message, 'message', message ?? isNotEmpty);

void main() {
  test('(a) a 400 envelope becomes ApiError with its fieldErrors; malformed ones are dropped', () async {
    final h = _Harness((_) => jsonBody(400, envelope('VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', fieldErrors: [
          {'field': 'phone', 'code': 'isPhone', 'message': 'SĐT không hợp lệ.'},
          {'field': 'name', 'code': 7},
        ])));
    await h.signIn('access-1', 'refresh-1');
    await expectLater(
      h.post('/customers', data: {'phone': 'x'}),
      throwsA(_apiError(status: 400, code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ.')
          .having((e) => e.fieldErrors!.map((f) => f.field), 'fields', ['phone'])
          .having((e) => e.traceId, 'traceId', 'trace-1')),
    );
    expect(h.adapter.requests, hasLength(1));
    expect(h.adapter.to('/auth/refresh'), isEmpty);
  });

  test('(b) a body that is not an envelope (HTML 502, empty) gives the generic message with the status', () async {
    final h = _Harness((r) => r.path == '/a' ? textBody(502, '<html>Bad gateway</html>') : textBody(500, ''));
    await expectLater(h.get('/a'), throwsA(_apiError(status: 502, message: kGenericErrorMessage)));
    await expectLater(h.get('/b'), throwsA(_apiError(status: 500, message: kGenericErrorMessage)));
  });

  test('(c) a connection failure gives the network message without a status', () async {
    final h = _Harness(refuseConnection);
    await expectLater(h.get('/orders'), throwsA(_apiError(message: kNetworkErrorMessage)));
  });

  test('(d) 401 → refresh → replay succeeds; both rotated tokens are stored', () async {
    final h = _Harness(_renewingBackend);
    await h.signIn('access-1', 'refresh-1');
    expect(await h.get('/orders'), {'ok': '/orders'});
    expect(h.adapter.to('/auth/refresh'), hasLength(1));
    expect(h.adapter.to('/auth/refresh').single.json, {'refreshToken': 'refresh-1'});
    expect(h.adapter.to('/orders'), hasLength(2));
    expect(h.session.accessToken, 'access-2');
    expect(h.store.values[kRefreshTokenKey], 'refresh-2');
    expect(h.expiredCalls, 0);
  });

  test('(e) two concurrent 401s share ONE refresh and both replay', () async {
    final gate = Completer<void>();
    final h = _Harness((r) async {
      if (r.path == '/auth/refresh') {
        await gate.future;
        return jsonBody(200, tokens('access-2', 'refresh-2'));
      }
      return _renewingBackend(r);
    });
    await h.signIn('access-1', 'refresh-1');
    final a = h.get('/orders');
    final b = h.get('/customers');
    await pumpEventQueue();
    gate.complete();
    expect(await a, {'ok': '/orders'});
    expect(await b, {'ok': '/customers'});
    expect(h.adapter.to('/auth/refresh'), hasLength(1));
  });

  test('(f) refresh refused (401) clears the session, reports expiry once, throws its message', () async {
    final h = _Harness((r) => r.path == '/auth/refresh'
        ? jsonBody(401, envelope('UNAUTHENTICATED', 'Phiên đã bị thu hồi.'))
        : jsonBody(401, envelope('UNAUTHENTICATED', 'Token hết hạn.')));
    await h.signIn('access-1', 'refresh-1');
    await expectLater(
        h.get('/orders'), throwsA(_apiError(status: 401, code: 'UNAUTHENTICATED', message: 'Phiên đã bị thu hồi.')));
    expect(h.session.accessToken, isNull);
    expect(h.store.values, isEmpty);
    expect(h.expiredCalls, 1);
    expect(h.adapter.to('/orders'), hasLength(1));
  });

  test('(g) concurrent 401s + failed refresh expire once; a 401 arriving AFTER that neither refreshes nor reports', () async {
    final refreshGate = Completer<void>();
    final lateGate = Completer<void>();
    final h = _Harness((r) async {
      if (r.path == '/auth/refresh') {
        await refreshGate.future;
        return jsonBody(401, envelope('UNAUTHENTICATED', 'Phiên đã bị thu hồi.'));
      }
      if (r.path == '/late') await lateGate.future;
      return jsonBody(401, envelope('UNAUTHENTICATED', 'Token hết hạn.'));
    });
    await h.signIn('access-1', 'refresh-1');
    final a = expectLater(h.get('/a'), throwsA(isA<ApiError>()));
    final b = expectLater(h.get('/b'), throwsA(isA<ApiError>()));
    final late = expectLater(
        h.get('/late'), throwsA(_apiError(status: 401, code: 'UNAUTHENTICATED', message: kSessionExpiredMessage)));
    await pumpEventQueue();
    refreshGate.complete();
    await a;
    await b;
    expect(h.expiredCalls, 1);
    lateGate.complete();
    await late;
    expect(h.adapter.to('/auth/refresh'), hasLength(1));
    expect(h.expiredCalls, 1);
  });

  test('(h) refresh failing with 5xx or no connection reports the generic session-expired message', () async {
    for (final refresh in <FakeHandler>[
      (_) => jsonBody(503, envelope('SERVICE_UNAVAILABLE', 'Bảo trì.')),
      refuseConnection,
      (_) => jsonBody(200, {'unexpected': true}),
    ]) {
      final h = _Harness((r) => r.path == '/auth/refresh' ? refresh(r) : jsonBody(401, envelope('UNAUTHENTICATED', 'x')));
      await h.signIn('access-1', 'refresh-1');
      await expectLater(h.get('/orders'), throwsA(_apiError(status: 401, code: 'UNAUTHENTICATED', message: kSessionExpiredMessage)));
      expect(h.expiredCalls, 1);
      expect(h.store.values, isEmpty);
    }
  });

  test('(i) a 401 on the public auth routes never refreshes and carries no Bearer', () async {
    final h = _Harness((_) => jsonBody(401, envelope('UNAUTHENTICATED', 'Thông tin đăng nhập không đúng')));
    await h.signIn('access-1', 'refresh-1');
    for (final path in kPublicAuthPaths) {
      await expectLater(h.post(path, data: {}),
          throwsA(_apiError(status: 401, code: 'UNAUTHENTICATED', message: 'Thông tin đăng nhập không đúng')));
    }
    expect(kPublicAuthPaths, hasLength(5));
    expect(h.adapter.requests, hasLength(5));
    expect(h.adapter.requests.map((r) => r.authorization), everyElement(isNull));
    expect(h.expiredCalls, 0);
    expect(h.session.accessToken, 'access-1');
  });

  test('(i) public routes are matched on the whole segment after the base path', () async {
    final h = _Harness(_renewingBackend, baseUrl: '$_base/api');
    await h.signIn('access-1', 'refresh-1');
    // /auth/login-history is NOT /auth/login: it gets a Bearer and renews on 401.
    expect(await h.get('/auth/login-history'), {'ok': '/api/auth/login-history'});
    expect(h.adapter.to('/api/auth/refresh'), hasLength(1));
    expect(h.adapter.requests.first.authorization, 'Bearer access-1');
  });

  test('(j) a replay still 401 (wrong current password) throws its envelope and keeps the session', () async {
    final h = _Harness((r) => r.path == '/auth/refresh'
        ? jsonBody(200, tokens('access-2', 'refresh-2'))
        : jsonBody(401, envelope('INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng.')));
    await h.signIn('access-1', 'refresh-1');
    await expectLater(h.post('/auth/change-password', data: {}),
        throwsA(_apiError(status: 401, code: 'INVALID_CREDENTIALS', message: 'Mật khẩu hiện tại không đúng.')));
    expect(h.adapter.to('/auth/refresh'), hasLength(1));
    expect(h.adapter.to('/auth/change-password'), hasLength(2));
    expect(h.session.accessToken, 'access-2');
    expect(h.store.values[kRefreshTokenKey], 'refresh-2');
    expect(h.expiredCalls, 0);
  });

  test('(k) a 401 without any stored refresh token expires the session without calling refresh', () async {
    final h = _Harness(_renewingBackend);
    await expectLater(h.get('/orders'), throwsA(_apiError(status: 401, code: 'UNAUTHENTICATED', message: kSessionExpiredMessage)));
    expect(h.adapter.to('/auth/refresh'), isEmpty);
    expect(h.expiredCalls, 1);
  });

  test('(l) the Bearer is attached on private routes and switches to the new token on replay', () async {
    final h = _Harness(_renewingBackend);
    await h.signIn('access-1', 'refresh-1');
    await h.get('/orders');
    expect(h.adapter.to('/orders').map((r) => r.authorization), ['Bearer access-1', 'Bearer access-2']);
    expect(h.adapter.to('/auth/refresh').single.authorization, isNull);
  });

  test('(m) a multipart body is sent again in full on replay', () async {
    final h = _Harness(_renewingBackend);
    await h.signIn('access-1', 'refresh-1');
    final form = FormData.fromMap({
      'event': 'xong_giao',
      'files': [MultipartFile.fromBytes(utf8.encode('photo-bytes'), filename: 'a.jpg')],
    });
    expect(await h.post('/orders/1/transition', data: form), {'ok': '/orders/1/transition'});
    final sent = h.adapter.to('/orders/1/transition').toList();
    expect(sent, hasLength(2));
    expect(sent[1].bodyText, contains('photo-bytes'));
    expect(sent[1].bodyText, contains('xong_giao'));
  });

  test('(n) an error on a stream or bytes download still yields the envelope message', () async {
    final h = _Harness((_) => jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy hợp đồng.')));
    await h.signIn('access-1', 'refresh-1');
    for (final type in [ResponseType.stream, ResponseType.bytes]) {
      await expectLater(h.get('/orders/1/contracts/2/pdf', responseType: type),
          throwsA(_apiError(status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy hợp đồng.')));
    }
  });

  test('(o) a cancelled request stays a cancellation and does not expire the session', () async {
    final h = _Harness((_) => Completer<ResponseBody>().future);
    await h.signIn('access-1', 'refresh-1');
    final token = CancelToken();
    final pending = h.get('/orders', cancelToken: token);
    await pumpEventQueue();
    token.cancel();
    await expectLater(pending, throwsA(isA<DioException>().having((e) => e.type, 'type', DioExceptionType.cancel)));
    expect(h.expiredCalls, 0);
    expect(h.session.accessToken, 'access-1');
  });
}
