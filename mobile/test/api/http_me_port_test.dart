// HttpMePort (Story 10.7): GET /me with the Bearer, mapped onto the generated type;
// a failure is the transport's ApiError.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/http_me_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

void main() {
  test('fetchMe 200 returns the identity and permissions', () async {
    final s = await ApiStack(
      (_) => jsonBody(200, {
        'id': 'acc-1',
        'email': 'nv@pns.solar',
        'displayName': 'Nhân viên A',
        'permissions': ['customers.manage', 'orders.view_own'],
      }),
    ).signedIn();
    final me = await HttpMePort(s.client, s.transport).fetchMe();
    expect(me.displayName, 'Nhân viên A');
    expect(me.email, 'nv@pns.solar');
    expect(me.permissions, ['customers.manage', 'orders.view_own']);
    final request = s.adapter.requests.single;
    expect([request.method, request.path, request.authorization], ['GET', '/me', 'Bearer access-1']);
  });

  test('fetchMe error envelope throws ApiError with the backend message', () async {
    final s = await ApiStack((_) => jsonBody(403, envelope('FORBIDDEN', 'Tài khoản đã bị khoá.'))).signedIn();
    await expectLater(
      HttpMePort(s.client, s.transport).fetchMe(),
      throwsA(
        isA<ApiError>()
            .having((e) => e.message, 'message', 'Tài khoản đã bị khoá.')
            .having((e) => e.status, 'status', 403),
      ),
    );
    expect(s.adapter.requests, hasLength(1));
  });

  test('a 200 body missing a required field is the generic ApiError, never a TypeError', () async {
    final s = await ApiStack((_) => jsonBody(200, {'id': 'acc-1'})).signedIn();
    await expectLater(
      HttpMePort(s.client, s.transport).fetchMe(),
      throwsA(isA<ApiError>().having((e) => e.message, 'message', kGenericErrorMessage)),
    );
  });
}
