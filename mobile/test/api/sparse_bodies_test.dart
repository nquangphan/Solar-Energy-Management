// Sparse request bodies (Story 10.8): the JSON a body produces is compared WHOLE
// (map equality, never a lone containsKey) — a stray `null` key is exactly the
// bug: on the shared PATCH it clears kWp, on a not-null field it is a 400.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/bytes.dart';
import 'package:pns_mobile/api/sparse_bodies.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/design_system/session/stock_vouchers_port.dart';

/// What the wire carries: the body encoded the way Dio encodes it.
Object? wire(Object body) => jsonDecode(jsonEncode(body));

void main() {
  group('PATCH /orders/:id', () {
    test('one scope flag ⇒ only that key (no kWp/validityNote/vatMode null)', () {
      expect(wire(scopeFlagsBody(const UpdateScopeFlagsInput(scopeConstruction: true))), <String, Object?>{
        'scopeConstruction': true,
      });
      expect(
        wire(scopeFlagsBody(const UpdateScopeFlagsInput(scopeConstruction: false, scopeDelivery: true))),
        <String, Object?>{'scopeConstruction': false, 'scopeDelivery': true},
      );
    });

    test('kWp present as null ⇒ {"kWp": null} (clear)', () {
      expect(wire(orderMetaBody(const UpdateOrderMetaInput(kWp: null))), <String, Object?>{'kWp': null});
    });

    test('kWp absent ⇒ no kWp key', () {
      expect(wire(orderMetaBody(const UpdateOrderMetaInput(vatMode: 'khong_vat'))), <String, Object?>{
        'vatMode': 'khong_vat',
      });
      expect(wire(orderMetaBody(const UpdateOrderMetaInput(validityNote: '48h'))), <String, Object?>{
        'validityNote': '48h',
      });
    });

    test('kWp value ⇒ that value', () {
      expect(wire(orderMetaBody(const UpdateOrderMetaInput(kWp: 8.82))), <String, Object?>{'kWp': 8.82});
    });
  });

  group('PATCH /orders/:id/line-items/:lineId', () {
    test('qty only ⇒ {"qty": 3} (warranty untouched)', () {
      expect(wire(lineUpdateBody(const UpdateOrderLineInput(qty: 3))), <String, Object?>{'qty': 3});
    });

    test('warrantyMonths present as null ⇒ {"warrantyMonths": null} (no warranty)', () {
      expect(wire(lineUpdateBody(const UpdateOrderLineInput(warrantyMonths: null))), <String, Object?>{
        'warrantyMonths': null,
      });
    });

    test('warrantyMonths value with qty ⇒ both', () {
      expect(wire(lineUpdateBody(const UpdateOrderLineInput(qty: 2, warrantyMonths: 12))), <String, Object?>{
        'qty': 2,
        'warrantyMonths': 12,
      });
    });
  });

  test('POST line-items: a catalogue line carries no name/unit/unitPrice/note keys', () {
    expect(wire(addLineBody(const AddOrderLineInput(productId: 'p-1', qty: 2))), <String, Object?>{
      'productId': 'p-1',
      'qty': 2,
      'isFlexible': false,
    });
    expect(
      wire(addLineBody(const AddOrderLineInput(name: 'Phí', unit: 'lần', qty: 1, unitPrice: 500000))),
      <String, Object?>{'name': 'Phí', 'unit': 'lần', 'qty': 1, 'unitPrice': 500000, 'isFlexible': false},
    );
  });

  test('POST preview-total: vatMode/discountAmount only when echoed', () {
    expect(
      wire(
        previewTotalBody(const PreviewTotalInput(lines: <PreviewTotalLine>[PreviewTotalLine(unitPrice: 100, qty: 2)])),
      ),
      <String, Object?>{
        'lines': <Object?>[
          <String, Object?>{'unitPrice': 100, 'qty': 2},
        ],
      },
    );
    expect(
      wire(
        previewTotalBody(
          const PreviewTotalInput(
            lines: <PreviewTotalLine>[],
            vatMode: PreviewTotalRequestDtoVatMode.khongVat,
            discountAmount: 5,
          ),
        ),
      ),
      <String, Object?>{'lines': <Object?>[], 'vatMode': 'khong_vat', 'discountAmount': 5},
    );
  });

  test('POST /stock-vouchers: a stock-out line has no unitCost key, a stock-in line keeps it', () {
    expect(
      wire(
        stockVoucherBody(
          const CreateStockVoucherInput(
            type: CreateStockVoucherRequestDtoType.xuat,
            lines: <CreateStockVoucherLineInput>[CreateStockVoucherLineInput(productId: 'p-1', qty: 1)],
          ),
        ),
      ),
      <String, Object?>{
        'type': 'xuat',
        'lines': <Object?>[
          <String, Object?>{'productId': 'p-1', 'qty': 1},
        ],
      },
    );
    expect(
      wire(
        stockVoucherBody(
          const CreateStockVoucherInput(
            type: CreateStockVoucherRequestDtoType.nhap,
            note: 'Tồn đầu kỳ',
            lines: <CreateStockVoucherLineInput>[CreateStockVoucherLineInput(productId: 'p-1', qty: 4, unitCost: 0)],
          ),
        ),
      ),
      <String, Object?>{
        'type': 'nhap',
        'note': 'Tồn đầu kỳ',
        'lines': <Object?>[
          <String, Object?>{'productId': 'p-1', 'qty': 4, 'unitCost': 0},
        ],
      },
    );
  });

  test('collectBytes joins every chunk in order', () async {
    final bytes = await collectBytes(
      Stream<List<int>>.fromIterable(<List<int>>[
        <int>[1, 2],
        <int>[],
        <int>[3],
      ]),
    );
    expect(bytes, <int>[1, 2, 3]);
  });
}
