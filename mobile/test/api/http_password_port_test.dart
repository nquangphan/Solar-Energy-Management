// HttpPasswordPort (Story 10.7): the three password routes with their typed bodies;
// a wrong current password is a replayed 401 that throws and keeps the session.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/http_password_port.dart';
import 'package:pns_mobile/api/session_store.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

void main() {
  test('requestResetCode posts the email (no Bearer) and returns the lifetime', () async {
    final s = ApiStack((_) => jsonBody(200, {'expiresInSeconds': 300}));
    expect(await HttpPasswordPort(s.client, s.transport).requestResetCode('nv@pns.solar'), 300);
    final request = s.adapter.requests.single;
    expect([request.method, request.path], ['POST', '/auth/forgot-password']);
    expect(request.json, {'email': 'nv@pns.solar'});
    expect(request.authorization, isNull);
  });

  test('resetPassword posts email, code and new password', () async {
    final s = ApiStack((_) => noContent());
    await HttpPasswordPort(
      s.client,
      s.transport,
    ).resetPassword(email: 'nv@pns.solar', code: '123456', newPassword: 'MatKhauMoi#1');
    final request = s.adapter.to('/auth/reset-password').single;
    expect(request.json, {'email': 'nv@pns.solar', 'code': '123456', 'newPassword': 'MatKhauMoi#1'});
  });

  test('resetPassword with a wrong code throws the backend message', () async {
    final s = ApiStack((_) => jsonBody(400, envelope('VALIDATION_ERROR', 'Mã xác nhận không đúng hoặc đã hết hạn.')));
    await expectLater(
      HttpPasswordPort(s.client, s.transport).resetPassword(email: 'nv@pns.solar', code: '000000', newPassword: 'x'),
      throwsA(isA<ApiError>().having((e) => e.message, 'message', 'Mã xác nhận không đúng hoặc đã hết hạn.')),
    );
    expect(s.adapter.to('/auth/refresh'), isEmpty);
  });

  test('changePassword 204 sends both passwords with the Bearer', () async {
    final s = await ApiStack((_) => noContent()).signedIn();
    await HttpPasswordPort(s.client, s.transport).changePassword(currentPassword: 'cu', newPassword: 'moi');
    final request = s.adapter.requests.single;
    expect([request.path, request.authorization], ['/auth/change-password', 'Bearer access-1']);
    expect(request.json, {'currentPassword': 'cu', 'newPassword': 'moi'});
  });

  test('changePassword with a wrong current password: one refresh, one replay, ApiError, session kept', () async {
    final s = await ApiStack((r) {
      if (r.path == '/auth/refresh') return jsonBody(200, tokens('access-2', 'refresh-2'));
      return jsonBody(401, envelope('UNAUTHENTICATED', 'Mật khẩu hiện tại không đúng.'));
    }).signedIn();
    await expectLater(
      HttpPasswordPort(s.client, s.transport).changePassword(currentPassword: 'sai', newPassword: 'moi'),
      throwsA(isA<ApiError>().having((e) => e.message, 'message', 'Mật khẩu hiện tại không đúng.')),
    );
    expect(s.adapter.to('/auth/change-password'), hasLength(2));
    expect(s.adapter.to('/auth/refresh'), hasLength(1));
    expect(s.session.accessToken, 'access-2');
    expect(s.store.values[kRefreshTokenKey], 'refresh-2');
    expect(s.expiredCalls, 0);
  });
}
