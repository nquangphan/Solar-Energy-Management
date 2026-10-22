// HttpInvoicesPort (Story 10.8): overview, create, detail, export and the PDF
// download over the real transport. The download is named from the invoice's
// stored `pdf.fileName` (read from the detail first), falling back to the id; a
// download before the export is the backend's 404 message, verbatim.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/http_invoices_port.dart';
import 'package:pns_mobile/design_system/session/invoices_port.dart';

import 'support/api_stack.dart';
import 'support/contract_json.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpInvoicesPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpInvoicesPort(s.client, s.transport));
}

void main() {
  test('overview, create, detail and export', () async {
    final (s, port) = await _port(
      routes({
        'GET /orders/o1/invoices': () => jsonBody(200, invoicesOverviewJson()),
        'POST /orders/o1/invoices': () => jsonBody(201, invoiceJson()),
        'GET /orders/o1/invoices/inv-1': () => jsonBody(200, invoiceDetailJson()),
        'POST /orders/o1/invoices/inv-1/pdf': () => jsonBody(201, invoicePdfJson()),
      }),
    );
    expect((await port.getOverview('o1')).currentInvoiceId, 'inv-1');
    expect((await port.createInvoice('o1')).issuedAt, DateTime.utc(2026, 10, 22, 3));
    final detail = await port.getInvoice('o1', 'inv-1');
    expect(
      [detail.customerPhone, detail.seller.taxCode, detail.lines.single.amount],
      ['+84903176968', '0312998771', 36162000],
    );
    expect((await port.exportInvoicePdf('o1', 'inv-1')).exportedAt, DateTime.utc(2026, 10, 22, 4));
    expect(s.adapter.requests.map((r) => r.method).toList(), ['GET', 'POST', 'GET', 'POST']);
  });

  test('downloadInvoicePdf: detail, then the bytes, named from pdf.fileName', () async {
    final (s, port) = await _port(
      routes({
        'GET /orders/o1/invoices/inv-1': () => jsonBody(200, invoiceDetailJson()),
        'GET /orders/o1/invoices/inv-1/pdf': () => bytesBody(200, [0x25, 0x50]),
      }),
    );
    final file = await port.downloadInvoicePdf('o1', 'inv-1');
    expect(s.adapter.requests.map((r) => '${r.method} ${r.path}').toList(), [
      'GET /orders/o1/invoices/inv-1',
      'GET /orders/o1/invoices/inv-1/pdf',
    ]);
    expect(
      [file.fileName, file.bytes],
      [
        'hoa-don-HD-2026-0001.pdf',
        [0x25, 0x50],
      ],
    );
  });

  test('no stored pdf metadata ⇒ <invoiceId>.pdf', () async {
    final (_, port) = await _port(
      routes({
        'GET /orders/o1/invoices/inv-1': () => jsonBody(200, invoiceDetailJson(exported: false)),
        'GET /orders/o1/invoices/inv-1/pdf': () => bytesBody(200, [1]),
      }),
    );
    expect((await port.downloadInvoicePdf('o1', 'inv-1')).fileName, 'inv-1.pdf');
  });

  test('a download before the export ⇒ InvoicesPortError(404) with the backend message', () async {
    final (_, port) = await _port(
      routes({
        'GET /orders/o1/invoices/inv-1': () => jsonBody(200, invoiceDetailJson(exported: false)),
        'GET /orders/o1/invoices/inv-1/pdf': () => jsonBody(404, envelope('NOT_FOUND', 'Hoá đơn này chưa xuất PDF.')),
      }),
    );
    await expectLater(
      port.downloadInvoicePdf('o1', 'inv-1'),
      throwsA(
        isA<InvoicesPortError>()
            .having((e) => e.status, 'status', 404)
            .having((e) => e.message, 'message', 'Hoá đơn này chưa xuất PDF.'),
      ),
    );
  });

  test('the bytes come through a 401 on the download itself → refresh → replay', () async {
    final (s, port) = await _port(
      renewingOnce(
        routes({
          'GET /orders/o1/invoices/inv-1': () => jsonBody(200, invoiceDetailJson()),
          'GET /orders/o1/invoices/inv-1/pdf': () => bytesBody(200, [5, 5, 5]),
        }),
        onlyPath: '/orders/o1/invoices/inv-1/pdf',
      ),
    );
    expect((await port.downloadInvoicePdf('o1', 'inv-1')).bytes, [5, 5, 5]);
    expect(s.adapter.to('/auth/refresh'), hasLength(1));
    expect(s.adapter.to('/orders/o1/invoices/inv-1/pdf'), hasLength(2), reason: 'refused once, replayed once');
  });
}
