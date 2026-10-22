// HttpWarrantyPort (Story 10.7): the raw phone as a query, `found: false` as a normal
// answer, a rejection as the WarrantyPortException the screen reads.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_warranty_port.dart';
import 'package:pns_mobile/design_system/session/warranty_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpWarrantyPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpWarrantyPort(s.client, s.transport));
}

void main() {
  test('lookup 200 maps dates as UTC and the status onto the generated enum', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, {
        'found': true,
        'phone': '+84903176968',
        'customer': {'phone': '+84903176968', 'name': 'Nguyễn Văn A', 'custType': 'CA_NHAN'},
        'orders': [
          {
            'id': 'o1',
            'status': 'nghiem_thu',
            'confirmedAt': '2026-02-10T00:00:00.000Z',
            'lineItems': [
              {
                'id': 'l1',
                'name': 'Tấm pin',
                'qty': 18,
                'unit': 'tấm',
                'warrantyMonths': 144,
                'warrantyStartAt': '2026-02-10T00:00:00.000Z',
                'warrantyEndAt': '2038-02-10T00:00:00.000Z',
                'remainingDays': 4224,
                'remainingMonths': 138,
                'warrantyStatus': 'con_han',
              },
            ],
          },
        ],
      }),
    );
    final result = await port.lookup('+84903176968');
    final line = result.orders.single.lineItems.single;
    expect(line.warrantyStatus, WarrantyLineItemDtoWarrantyStatus.conHan);
    expect(line.warrantyEndAt, DateTime.utc(2038, 2, 10));
    expect(line.warrantyEndAt.isUtc, isTrue);
    final request = s.adapter.requests.single;
    expect([request.method, request.path], ['GET', '/orders/warranty-lookup']);
    expect(request.query, {'phone': '+84903176968'});
  });

  test('found: false is an answer, not an error', () async {
    final (_, port) = await _port(
      (_) => jsonBody(200, {'found': false, 'phone': '+84999999999', 'customer': null, 'orders': []}),
    );
    final result = await port.lookup('0999999999');
    expect(result.found, isFalse);
    expect(result.orders, isEmpty);
  });

  test('an invalid phone (400) is a WarrantyPortException with the backend words', () async {
    final (_, port) = await _port(
      (_) => jsonBody(
        400,
        envelope(
          'VALIDATION_ERROR',
          'Số điện thoại không hợp lệ.',
          fieldErrors: [
            {'field': 'phone', 'code': 'isPhone', 'message': 'SĐT phải có 10 chữ số.'},
          ],
        ),
      ),
    );
    await expectLater(
      port.lookup('12'),
      throwsA(
        isA<WarrantyPortException>().having((e) => e.message, 'message', 'Số điện thoại không hợp lệ.').having(
          (e) => e.fieldErrors,
          'fieldErrors',
          {'phone': 'SĐT phải có 10 chữ số.'},
        ),
      ),
    );
  });
}
