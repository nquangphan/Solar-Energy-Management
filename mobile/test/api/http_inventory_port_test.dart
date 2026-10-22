// HttpInventoryPort (Story 10.8): the stock list over the real transport; the
// search goes as typed, and a failure stays the ApiError the screen catches.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/http_inventory_port.dart';
import 'package:pns_mobile/design_system/session/inventory_port.dart';

import 'support/api_stack.dart';
import 'support/contract_json.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpInventoryPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpInventoryPort(s.client, s.transport));
}

void main() {
  test('listStock(q) sends the search as typed and maps the computed figures', () async {
    final (s, port) = await _port((_) => jsonBody(200, stockListJson()));
    final list = await port.listStock(q: 'pin');
    await port.listStock();
    expect(s.adapter.requests.map((r) => '${r.method} ${r.path}').toSet(), {'GET /stock-items'});
    expect(s.adapter.requests.map((r) => r.query).toList(), [
      {'q': 'pin'},
      <String, String>{},
    ]);
    final item = list.items.single;
    expect([item.available, item.toPurchase, item.stockStatus], [-2, 2, StockItemViewDtoStockStatus.am]);
    expect(list.purchaseList.single.toPurchase, 2);
  });

  test('a rejection stays an ApiError with the backend message', () async {
    final (_, port) = await _port((_) => jsonBody(403, envelope('FORBIDDEN', 'Bạn không có quyền.')));
    await expectLater(
      port.listStock(),
      throwsA(isA<ApiError>().having((e) => e.message, 'message', 'Bạn không có quyền.')),
    );
  });
}
