// HttpCustomersPort (Story 10.7): each method's route/query/body over the real
// transport, the phone escaped in the path and raw in the query, and every
// backend rejection converted to the CustomerPortException the screens read.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_customers_port.dart';
import 'package:pns_mobile/design_system/session/customers_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

Map<String, Object?> _customer(String phone) => {
  'phone': phone,
  'custType': 'CA_NHAN',
  'name': 'Nguyễn Văn A',
  'nationalId': '079201001234',
  'taxCode': null,
  'address': null,
  'bankAccount': null,
  'sourceId': 'src-1',
  'sourceNote': null,
  'createdAt': '2026-07-13T00:00:00.000Z',
  'updatedAt': '2026-07-13T00:00:00.000Z',
};

Future<(ApiStack, HttpCustomersPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpCustomersPort(s.client, s.transport));
}

void main() {
  test('lookup sends the raw phone as a query the server decodes back to +84…', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, {'found': true, 'phone': '+84903176968', 'customer': _customer('+84903176968')}),
    );
    final result = await port.lookup('+84903176968');
    expect(result.found, isTrue);
    expect(result.customer?.nationalId, '079201001234');
    final request = s.adapter.requests.single;
    expect([request.method, request.path], ['GET', '/customers/lookup']);
    expect(request.query, {'phone': '+84903176968'});
  });

  test('get escapes the phone into ONE path segment', () async {
    final (s, port) = await _port((r) => jsonBody(200, _customer('+84903176968')));
    final customer = await port.get('+84903176968');
    expect(customer.phone, '+84903176968');
    expect(customer.createdAt, DateTime.utc(2026, 7, 13));
    await port.get('0903/176');
    expect(s.adapter.requests.map((r) => r.path), ['/customers/%2B84903176968', '/customers/0903%2F176']);
  });

  test('list maps the custType filter onto the generated enum and pages', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, {
        'items': [_customer('+84903176968')],
        'total': 41,
        'page': 3,
        'pageSize': 20,
      }),
    );
    final page = await port.list(q: 'Nguyễn', custType: 'THUONG_MAI', page: 3, pageSize: 20);
    expect(page.total, 41);
    expect(page.items.single.phone, '+84903176968');
    expect(s.adapter.requests.single.query, {'q': 'Nguyễn', 'custType': 'THUONG_MAI', 'page': '3', 'pageSize': '20'});
  });

  test('list without filters sends no filter parameter', () async {
    final (s, port) = await _port((_) => jsonBody(200, {'items': [], 'total': 0, 'page': 1, 'pageSize': 20}));
    await port.list();
    expect(s.adapter.requests.single.query, isEmpty);
  });

  test('create posts the generated body', () async {
    final (s, port) = await _port((_) => jsonBody(201, _customer('+84903176968')));
    await port.create(
      const CreateCustomerInput(
        phone: '0903 176 968',
        custType: CreateCustomerRequestDtoCustType.caNhan,
        name: 'Nguyễn Văn A',
        sourceId: 'src-1',
      ),
    );
    final request = s.adapter.requests.single;
    expect([request.method, request.path], ['POST', '/customers']);
    expect(request.json, containsPair('phone', '0903 176 968'));
    expect(request.json, containsPair('custType', 'CA_NHAN'));
  });

  test('a duplicate phone (409) is a CustomerPortException carrying the field message verbatim', () async {
    final (_, port) = await _port(
      (_) => jsonBody(
        409,
        envelope(
          'CONFLICT',
          'Số điện thoại đã tồn tại.',
          fieldErrors: [
            {'field': 'phone', 'code': 'duplicate', 'message': 'Đã có khách hàng với số điện thoại này.'},
            {'field': 'phone', 'code': 'other', 'message': 'Câu thứ hai.'},
          ],
        ),
      ),
    );
    await expectLater(
      port.create(
        const CreateCustomerInput(
          phone: '0903176968',
          custType: CreateCustomerRequestDtoCustType.caNhan,
          name: 'A',
          sourceId: 'src-1',
        ),
      ),
      throwsA(
        isA<CustomerPortException>().having((e) => e.message, 'message', 'Số điện thoại đã tồn tại.').having(
          (e) => e.fieldErrors,
          'fieldErrors',
          {'phone': 'Đã có khách hàng với số điện thoại này.'},
        ),
      ),
    );
  });

  test('an invalid phone on lookup (400) is a CustomerPortException too', () async {
    final (_, port) = await _port((_) => jsonBody(400, envelope('VALIDATION_ERROR', 'Số điện thoại không hợp lệ.')));
    await expectLater(
      port.lookup('abc'),
      throwsA(isA<CustomerPortException>().having((e) => e.message, 'message', 'Số điện thoại không hợp lệ.')),
    );
  });

  test('listSources asks for switched-off sources too', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, [
        {'id': 'src-1', 'name': 'Facebook', 'description': null, 'active': true, 'sortOrder': 1, 'isOther': false},
        {'id': 'src-2', 'name': 'Hội chợ 2025', 'description': null, 'active': false, 'sortOrder': 2, 'isOther': false},
      ]),
    );
    final sources = await port.listSources();
    expect(sources.map((x) => x.active), [true, false]);
    final request = s.adapter.requests.single;
    expect(
      [request.path, request.query],
      [
        '/customer-sources',
        {'includeInactive': 'true'},
      ],
    );
  });
}
