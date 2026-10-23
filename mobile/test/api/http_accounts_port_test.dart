// HttpAccountsPort (Story 8.2): the three routes and their bodies, the nullable
// preset fields kept as null, and every rejection turned into an
// AccountsPortException carrying the backend's sentence and fieldErrors.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/http_accounts_port.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/accounts_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpAccountsPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpAccountsPort(s.client, s.transport));
}

Map<String, Object?> _summary({String? preset, String? label, String? phone}) =>
    {
      'id': 'acc-2',
      'displayName': 'Bình',
      'phone': phone,
      'email': 'b@x.test',
      'isActive': false,
      'permissions': [AppPermissionKeys.catalogView],
      'matchingPreset': preset,
      'matchingPresetLabel': label,
      'editable': true,
      'readOnlyReason': null,
    };

void main() {
  test(
    'listAccounts GETs /accounts and maps the preset enum and nulls',
    () async {
      final (s, port) = await _port(
        (_) => jsonBody(200, [
          _summary(
            preset: 'THO_KS',
            label: 'Thợ khảo sát',
            phone: '+84900000002',
          ),
          _summary(),
        ]),
      );
      final result = await port.listAccounts();
      expect(result.first.matchingPreset, RolePreset.thoKs);
      expect(result.first.matchingPresetLabel, 'Thợ khảo sát');
      expect(result.first.phone, '+84900000002');
      expect(result.last.matchingPreset, isNull);
      expect(result.last.matchingPresetLabel, isNull);
      expect(result.last.phone, isNull);
      expect(result.last.isActive, isFalse);
      final request = s.adapter.requests.single;
      expect([request.method, request.path], ['GET', '/accounts']);
    },
  );

  test('getPermissionOptions GETs /accounts/permission-options', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, {
        'permissions': [
          {
            'key': AppPermissionKeys.settingsManage,
            'label': 'Cấu hình hệ thống',
            'group': 'settings',
            'requires': [AppPermissionKeys.customersManage],
            'grantable': false,
          },
        ],
        'presets': [
          {
            'key': 'KE_TOAN',
            'label': 'Kế toán',
            'permissions': [AppPermissionKeys.catalogView],
          },
        ],
      }),
    );
    final result = await port.getPermissionOptions();
    expect(result.permissions.single.requires, [
      AppPermissionKeys.customersManage,
    ]);
    expect(result.permissions.single.grantable, isFalse);
    expect(result.presets.single.key, RolePreset.keToan);
    expect(s.adapter.requests.single.path, '/accounts/permission-options');
  });

  test(
    'updatePermissions PUTs the whole set to /accounts/{id}/permissions',
    () async {
      final (s, port) = await _port((_) => jsonBody(200, _summary()));
      final result = await port.updatePermissions('acc-2', [
        AppPermissionKeys.catalogView,
      ]);
      expect(result.id, 'acc-2');
      final request = s.adapter.requests.single;
      expect(
        [request.method, request.path],
        ['PUT', '/accounts/acc-2/permissions'],
      );
      expect(request.json, {
        'permissions': [AppPermissionKeys.catalogView],
      });
    },
  );

  test(
    '400 dependency refusal ⇒ AccountsPortException with the sentence and fieldErrors',
    () async {
      const sentence = '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».';
      final (_, port) = await _port(
        (_) => jsonBody(
          400,
          envelope(
            'VALIDATION_ERROR',
            sentence,
            fieldErrors: [
              {
                'field': 'permissions',
                'code': 'PERMISSION_DEPENDENCY',
                'message': sentence,
              },
            ],
          ),
        ),
      );
      await expectLater(
        port.updatePermissions('acc-2', [AppPermissionKeys.settingsManage]),
        throwsA(
          isA<AccountsPortException>()
              .having((e) => e.message, 'message', sentence)
              .having((e) => e.fieldErrors, 'fieldErrors', {
                'permissions': sentence,
              }),
        ),
      );
    },
  );

  test('403 and 404 keep the backend sentence', () async {
    for (final (status, code, message) in [
      (403, 'FORBIDDEN', 'Không thể tự sửa quyền của chính mình.'),
      (404, 'NOT_FOUND', 'Không tìm thấy tài khoản.'),
    ]) {
      final (_, port) = await _port(
        (_) => jsonBody(status, envelope(code, message)),
      );
      await expectLater(
        port.updatePermissions('acc-2', const []),
        throwsA(
          isA<AccountsPortException>().having(
            (e) => e.message,
            'message',
            message,
          ),
        ),
      );
    }
  });

  test('backend unreachable ⇒ the network sentence, no fieldErrors', () async {
    final (_, port) = await _port(refuseConnection);
    await expectLater(
      port.listAccounts(),
      throwsA(
        isA<AccountsPortException>()
            .having((e) => e.message, 'message', kNetworkErrorMessage)
            .having((e) => e.fieldErrors, 'fieldErrors', isEmpty),
      ),
    );
  });
}
