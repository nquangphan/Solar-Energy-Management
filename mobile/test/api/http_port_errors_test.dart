// Every method of the six order/stock/money/document adapters converts a backend
// rejection into ITS port's error type (Story 10.8) — the screens catch those
// nominally, so one method that leaks a raw ApiError (or swallows it) breaks its
// screen's error state while every success test stays green. The table lists
// each port's methods and is checked against the port interface itself, so a
// method added later without a case fails here.
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/http_contracts_port.dart';
import 'package:pns_mobile/api/http_inventory_port.dart';
import 'package:pns_mobile/api/http_invoices_port.dart';
import 'package:pns_mobile/api/http_orders_port.dart';
import 'package:pns_mobile/api/http_payments_port.dart';
import 'package:pns_mobile/api/http_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/contracts_port.dart';
import 'package:pns_mobile/design_system/session/invoices_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/design_system/session/payments_port.dart';
import 'package:pns_mobile/design_system/session/stock_vouchers_port.dart';

import 'support/api_stack.dart';
import 'support/fake_http.dart';

const String _message = 'Đơn đã thay đổi — tải lại rồi thử lại.';

typedef _Case = (String method, Future<Object?> Function(ApiStack s) call);

final XFile _photo = XFile.fromData(Uint8List.fromList(const [1, 2, 3]), path: '/picked/a.jpg');

HttpOrdersPort _orders(ApiStack s) => HttpOrdersPort(s.client, s.transport);
HttpStockVouchersPort _vouchers(ApiStack s) => HttpStockVouchersPort(s.client, s.transport);
HttpPaymentsPort _payments(ApiStack s) => HttpPaymentsPort(s.client, s.transport);
HttpContractsPort _contracts(ApiStack s) => HttpContractsPort(s.client, s.transport);
HttpInvoicesPort _invoices(ApiStack s) => HttpInvoicesPort(s.client, s.transport);

final List<_Case> _orderCases = [
  ('create', (s) => _orders(s).create(const CreateOrderInput(customerPhone: '0903176968'))),
  ('get', (s) => _orders(s).get('o1')),
  ('list', (s) => _orders(s).list()),
  ('getLifecycle', (s) => _orders(s).getLifecycle('o1')),
  ('listVersions', (s) => _orders(s).listVersions('o1')),
  ('addLine', (s) => _orders(s).addLine('o1', const AddOrderLineInput(productId: 'p-1', qty: 1))),
  ('updateLine', (s) => _orders(s).updateLine('o1', 'l1', const UpdateOrderLineInput(qty: 2))),
  ('removeLine', (s) => _orders(s).removeLine('o1', 'l1')),
  ('updateScopeFlags', (s) => _orders(s).updateScopeFlags('o1', const UpdateScopeFlagsInput(scopeDelivery: true))),
  ('updateOrderMeta', (s) => _orders(s).updateOrderMeta('o1', const UpdateOrderMetaInput(kWp: 5.0))),
  ('previewTotal', (s) => _orders(s).previewTotal(const PreviewTotalInput(lines: []))),
  ('confirmOrder', (s) => _orders(s).confirmOrder('o1')),
  ('reviseOrder', (s) => _orders(s).reviseOrder('o1')),
  ('applyDiscount', (s) => _orders(s).applyDiscount('o1', const ApplyDiscountInput(amount: 1))),
  ('resolveDiscount', (s) => _orders(s).resolveDiscount('o1', const ResolveDiscountInput(approve: true))),
  ('listPendingDiscounts', (s) => _orders(s).listPendingDiscounts()),
  ('exportQuote', (s) => _orders(s).exportQuote('o1')),
  ('transition', (s) => _orders(s).transition('o1', 'xong_giao', [_photo])),
  ('cancel', (s) => _orders(s).cancel('o1', 'Khách đổi ý')),
  ('listAttachments', (s) => _orders(s).listAttachments('o1')),
  ('addAttachments', (s) => _orders(s).addAttachments('o1', [_photo])),
  ('removeAttachment', (s) => _orders(s).removeAttachment('o1', 'a1')),
  ('attachmentBytes', (s) => _orders(s).attachmentBytes('o1', 'a1')),
  ('getStockIssue', (s) => _orders(s).getStockIssue('o1')),
  ('issueStock', (s) => _orders(s).issueStock('o1')),
  ('getStockCheck', (s) => _orders(s).getStockCheck('o1')),
];

final List<_Case> _inventoryCases = [('listStock', (s) => HttpInventoryPort(s.client, s.transport).listStock())];

final List<_Case> _voucherCases = [
  ('listVouchers', (s) => _vouchers(s).listVouchers()),
  ('getVoucher', (s) => _vouchers(s).getVoucher('pk-1')),
  (
    'createVoucher',
    (s) => _vouchers(s).createVoucher(
      const CreateStockVoucherInput(
        type: CreateStockVoucherRequestDtoType.xuat,
        lines: [CreateStockVoucherLineInput(productId: 'p-1', qty: 1)],
      ),
    ),
  ),
  (
    'createReturnVoucher',
    (s) =>
        _vouchers(s).createReturnVoucher('pk-1', lines: const [CreateReturnVoucherLineInput(productId: 'p-1', qty: 1)]),
  ),
];

final List<_Case> _paymentCases = [
  ('getSchedule', (s) => _payments(s).getSchedule('o1')),
  ('replaceSchedule', (s) => _payments(s).replaceSchedule('o1', const ReplacePaymentScheduleInput(installments: []))),
  (
    'recordPayment',
    (s) => _payments(s).recordPayment(
      'o1',
      const RecordPaymentInput(
        idempotencyKey: 'k',
        installmentId: 'inst-1',
        amount: 1,
        paidOn: '2026-10-21',
        method: 'cash',
      ),
    ),
  ),
];

final List<_Case> _contractCases = [
  ('getOverview', (s) => _contracts(s).getOverview('o1')),
  ('generateContract', (s) => _contracts(s).generateContract('o1')),
  ('downloadContractPdf', (s) => _contracts(s).downloadContractPdf('o1', 'c1')),
];

final List<_Case> _invoiceCases = [
  ('getOverview', (s) => _invoices(s).getOverview('o1')),
  ('createInvoice', (s) => _invoices(s).createInvoice('o1')),
  ('getInvoice', (s) => _invoices(s).getInvoice('o1', 'inv-1')),
  ('exportInvoicePdf', (s) => _invoices(s).exportInvoicePdf('o1', 'inv-1')),
  ('downloadInvoicePdf', (s) => _invoices(s).downloadInvoicePdf('o1', 'inv-1')),
];

/// The methods an abstract port class declares, read from its source.
List<String> portMethods(String file, String className) {
  final src = File('lib/design_system/session/$file').readAsStringSync();
  final body = RegExp('abstract class $className \\{([\\s\\S]*?)\\n\\}').firstMatch(src)!.group(1)!;
  return [for (final m in RegExp(r'^\s+Future<[^\n]*?> (\w+)\(', multiLine: true).allMatches(body)) m.group(1)!];
}

Future<void> _expectOne(_Case c, Matcher error) async {
  final s = await ApiStack((_) => jsonBody(409, envelope('CONFLICT', _message))).signedIn();
  await expectLater(c.$2(s), throwsA(error), reason: c.$1);
  expect(s.adapter.requests, hasLength(1), reason: '${c.$1}: exactly one request reached the backend');
}

void main() {
  test('the table lists every method of every port (42), checked against the interfaces', () {
    final tables = <(String, String, List<_Case>)>[
      ('orders_port.dart', 'OrdersPort', _orderCases),
      ('inventory_port.dart', 'InventoryPort', _inventoryCases),
      ('stock_vouchers_port.dart', 'StockVouchersPort', _voucherCases),
      ('payments_port.dart', 'PaymentsPort', _paymentCases),
      ('contracts_port.dart', 'ContractsPort', _contractCases),
      ('invoices_port.dart', 'InvoicesPort', _invoiceCases),
    ];
    var total = 0;
    for (final (file, cls, cases) in tables) {
      final declared = portMethods(file, cls);
      expect(declared, isNotEmpty, reason: '$cls read with no method (reader went blind)');
      expect(cases.map((c) => c.$1).toList()..sort(), declared..sort(), reason: cls);
      total += cases.length;
    }
    expect(total, 42);
  });

  group('OrdersPort ⇒ OrderPortException (message + code)', () {
    for (final c in _orderCases) {
      test(
        c.$1,
        () => _expectOne(
          c,
          isA<OrderPortException>()
              .having((e) => e.message, 'message', _message)
              .having((e) => e.code, 'code', 'CONFLICT'),
        ),
      );
    }
  });

  group('InventoryPort ⇒ the ApiError itself (its screen catches any error)', () {
    for (final c in _inventoryCases) {
      test(
        c.$1,
        () => _expectOne(
          c,
          isA<ApiError>().having((e) => e.message, 'message', _message).having((e) => e.status, 'status', 409),
        ),
      );
    }
  });

  group('StockVouchersPort ⇒ StockVoucherPortException', () {
    for (final c in _voucherCases) {
      test(c.$1, () => _expectOne(c, isA<StockVoucherPortException>().having((e) => e.message, 'message', _message)));
    }
  });

  group('PaymentsPort ⇒ PaymentsPortError (code + message)', () {
    for (final c in _paymentCases) {
      test(
        c.$1,
        () => _expectOne(
          c,
          isA<PaymentsPortError>()
              .having((e) => e.code, 'code', 'CONFLICT')
              .having((e) => e.message, 'message', _message),
        ),
      );
    }
  });

  group('ContractsPort ⇒ ContractsPortError (status + message)', () {
    for (final c in _contractCases) {
      test(
        c.$1,
        () => _expectOne(
          c,
          isA<ContractsPortError>()
              .having((e) => e.status, 'status', 409)
              .having((e) => e.message, 'message', _message),
        ),
      );
    }
  });

  group('InvoicesPort ⇒ InvoicesPortError (status + message)', () {
    for (final c in _invoiceCases) {
      test(
        c.$1,
        () => _expectOne(
          c,
          isA<InvoicesPortError>().having((e) => e.status, 'status', 409).having((e) => e.message, 'message', _message),
        ),
      );
    }
  });
}
