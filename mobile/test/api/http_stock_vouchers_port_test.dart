// HttpStockVouchersPort (Story 10.8): list filters, detail, create (a stock-out
// line carries NO unitCost key) and return vouchers over the real transport;
// every field error reaches the screen in order.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/stock_vouchers_port.dart';

import 'support/api_stack.dart';
import 'support/contract_json.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpStockVouchersPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpStockVouchersPort(s.client, s.transport));
}

void main() {
  test('listVouchers sends only the filters set', () async {
    final (s, port) = await _port((_) => jsonBody(200, voucherListJson()));
    final list = await port.listVouchers(type: 'xuat', isReturn: false);
    await port.listVouchers();
    expect(s.adapter.requests.map((r) => r.path).toSet(), {'/stock-vouchers'});
    expect(s.adapter.requests.map((r) => r.query).toList(), [
      {'type': 'xuat', 'isReturn': 'false'},
      <String, String>{},
    ]);
    expect(list.items.single.type, StockVoucherSummaryDtoType.xuat);
    expect(list.items.single.createdAt, DateTime.utc(2026, 7, 18));
  });

  test('getVoucher reads one voucher', () async {
    final (s, port) = await _port((_) => jsonBody(200, voucherJson(type: 'nhap', unitCost: 2110000)));
    final v = await port.getVoucher('pk-1');
    expect([s.adapter.requests.single.method, s.adapter.requests.single.path], ['GET', '/stock-vouchers/pk-1']);
    expect([v.code, v.lines.single.unitCost, v.createdBy.displayName], ['PK-X-0097', 2110000, 'Kho']);
  });

  test('createVoucher: a stock-out line has no unitCost key, a stock-in line keeps it', () async {
    final (s, port) = await _port((_) => jsonBody(201, voucherJson()));
    await port.createVoucher(
      const CreateStockVoucherInput(
        type: CreateStockVoucherRequestDtoType.xuat,
        lines: [CreateStockVoucherLineInput(productId: 'p-1', qty: 2)],
      ),
    );
    await port.createVoucher(
      const CreateStockVoucherInput(
        type: CreateStockVoucherRequestDtoType.nhap,
        note: 'Tồn đầu kỳ',
        lines: [CreateStockVoucherLineInput(productId: 'p-1', qty: 4, unitCost: 2110000)],
      ),
    );
    expect(s.adapter.requests.map((r) => '${r.method} ${r.path}').toSet(), {'POST /stock-vouchers'});
    expect(s.adapter.requests.map((r) => r.json).toList(), [
      {
        'type': 'xuat',
        'lines': [
          {'productId': 'p-1', 'qty': 2},
        ],
      },
      {
        'type': 'nhap',
        'note': 'Tồn đầu kỳ',
        'lines': [
          {'productId': 'p-1', 'qty': 4, 'unitCost': 2110000},
        ],
      },
    ]);
  });

  test('createReturnVoucher posts note + lines to the origin voucher', () async {
    final (s, port) = await _port((_) => jsonBody(201, voucherJson(id: 'pk-nt', type: 'nhap')));
    final created = await port.createReturnVoucher(
      'pk-1',
      note: 'Hỏng 1 tấm',
      lines: const [CreateReturnVoucherLineInput(productId: 'p-1', qty: 1)],
    );
    final r = s.adapter.requests.single;
    expect([r.method, r.path], ['POST', '/stock-vouchers/pk-1/return']);
    expect(r.json, {
      'note': 'Hỏng 1 tấm',
      'lines': [
        {'productId': 'p-1', 'qty': 1},
      ],
    });
    expect(created.id, 'pk-nt');
  });

  test('every field error reaches the screen, in order', () async {
    final (_, port) = await _port(
      (_) => jsonBody(
        409,
        envelope(
          'CONFLICT',
          'Không đủ tồn.',
          fieldErrors: [
            {'field': 'lines.1.qty', 'code': 'INSUFFICIENT_STOCK', 'message': 'Còn 0 bình.'},
            {'field': 'lines.0.qty', 'code': 'INSUFFICIENT_STOCK', 'message': 'Còn 1 bộ.'},
          ],
        ),
      ),
    );
    await expectLater(
      port.createVoucher(
        const CreateStockVoucherInput(
          type: CreateStockVoucherRequestDtoType.xuat,
          lines: [CreateStockVoucherLineInput(productId: 'p-1', qty: 2)],
        ),
      ),
      throwsA(
        isA<StockVoucherPortException>().having((e) => e.message, 'message', 'Không đủ tồn.').having(
          (e) => e.fieldErrors.map((f) => '${f.field}|${f.code}|${f.message}').toList(),
          'fieldErrors',
          ['lines.1.qty|INSUFFICIENT_STOCK|Còn 0 bình.', 'lines.0.qty|INSUFFICIENT_STOCK|Còn 1 bộ.'],
        ),
      ),
    );
  });
}
