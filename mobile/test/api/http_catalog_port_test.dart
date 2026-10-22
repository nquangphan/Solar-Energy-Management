// HttpCatalogPort (Story 10.7): products projected field by field (no cost ever
// reaches the picker), the search narrowed on the returned list, groups mapped.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/http_catalog_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

Map<String, Object?> _product(String id, String name, String sku, {num? warrantyMonths}) => {
  'id': id,
  'name': name,
  'sku': sku,
  'unit': 'tấm',
  'price': 2450000,
  'costPrice': 1900000,
  'tracksStock': true,
  'priceEditable': false,
  'warrantyMonths': warrantyMonths,
  'isActive': true,
  'createdAt': '2026-07-13T00:00:00.000Z',
  'updatedAt': '2026-07-13T00:00:00.000Z',
};

final _products = [
  _product('p1', 'Tấm pin JA Solar 580W', 'JAS-580-M10', warrantyMonths: 144),
  _product('p2', 'Inverter Hybrid 8kW', 'INV-HYB-8K'),
];

Future<(ApiStack, HttpCatalogPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpCatalogPort(s.client, s.transport));
}

void main() {
  test('listProducts maps every product and drops nothing but the cost', () async {
    final (s, port) = await _port((_) => jsonBody(200, _products));
    final products = await port.listProducts();
    expect(products.map((p) => p.id), ['p1', 'p2']);
    expect(products.first.price, 2450000);
    expect(products.first.warrantyMonths, 144);
    expect(products.last.warrantyMonths, isNull);
    final request = s.adapter.requests.single;
    expect([request.method, request.path], ['GET', '/products']);
  });

  test('listProducts narrows by name or SKU, case-insensitive; a blank search keeps all', () async {
    final (_, port) = await _port((_) => jsonBody(200, _products));
    expect((await port.listProducts(search: 'inverter')).map((p) => p.id), ['p2']);
    expect((await port.listProducts(search: 'jas-580')).map((p) => p.id), ['p1']);
    expect((await port.listProducts(search: '  ')).map((p) => p.id), ['p1', 'p2']);
  });

  test('getGroup returns the checklist with each product flag', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, {
        'id': 'g1',
        'name': 'Gói Hybrid 8kW',
        'description': null,
        'isActive': true,
        'items': [
          {
            'productId': 'p1',
            'name': 'Tấm pin',
            'sku': 'JAS',
            'unit': 'tấm',
            'price': 2450000,
            'isActive': false,
            'displayOrder': 0,
          },
        ],
        'createdAt': '2026-07-13T00:00:00.000Z',
        'updatedAt': '2026-07-13T00:00:00.000Z',
      }),
    );
    final group = await port.getGroup('g1');
    expect(group.items.single.isActive, isFalse);
    expect(s.adapter.requests.single.path, '/product-groups/g1');
  });

  test('listGroups maps the rows', () async {
    final (s, port) = await _port(
      (_) => jsonBody(200, [
        {
          'id': 'g1',
          'name': 'Gói A',
          'description': 'Mô tả',
          'isActive': true,
          'createdAt': '2026-07-13T00:00:00.000Z',
          'updatedAt': '2026-07-13T00:00:00.000Z',
        },
      ]),
    );
    final groups = await port.listGroups();
    expect([groups.single.name, groups.single.description], ['Gói A', 'Mô tả']);
    expect(s.adapter.requests.single.path, '/product-groups');
  });

  test('an error envelope is the transport ApiError', () async {
    final (_, port) = await _port((_) => jsonBody(403, envelope('FORBIDDEN', 'Bạn không có quyền xem danh mục.')));
    await expectLater(
      port.listProducts(),
      throwsA(isA<ApiError>().having((e) => e.message, 'message', 'Bạn không có quyền xem danh mục.')),
    );
  });
}
