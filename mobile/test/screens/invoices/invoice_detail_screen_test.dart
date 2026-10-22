// hand-authored — widget test for the Xem hoá đơn screen (Story 7.5).
//
// Everything goes through the REAL screen with the fake port: the document
// (number, UTC+7 date, linked order, seller with "Chưa cấu hình", customer, lines
// and totals through MoneyText), the optional discount / VAT rows, the PDF
// status, "Xuất PDF" (export ⇒ download ⇒ share, one call per press), refusals
// verbatim, the share fallback, the load states, plus the longest labels at
// 320/360px.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_invoices_port.dart';
import 'package:pns_mobile/design_system/session/invoices_port.dart';
import 'package:pns_mobile/screens/invoices/invoice_detail_screen.dart';

const String _kOrderId = 'DH-2048';
const String _kInvoiceId = 'invoice-1';
const String _kInfo =
    'Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).';

/// The demo invoice issued at 18:30Z — already the next day in Vietnam.
InvoiceDetail _detail({
  bool withTaxCode = true,
  bool withAddress = true,
  InvoiceSeller seller = kDemoInvoiceSeller,
  List<InvoiceLine> lines = kDemoInvoiceLines,
  String invoiceNo = 'HD-2026-0001',
  String quoteNo = 'BG-3F2A9B1C',
  String customerName = 'VP Công Chứng Lê Đình Thao',
  bool applyVat = true,
  int discountAmount = 0,
  int vatAmount = 6148960,
  InvoicePdfInfo? pdf,
}) =>
    demoInvoiceDetail(
      issuedAt: DateTime.utc(2026, 7, 5, 18, 30),
      quoteNo: quoteNo,
      versionNo: 2,
      invoiceNo: invoiceNo,
      customerName: customerName,
      withTaxCode: withTaxCode,
      withAddress: withAddress,
      seller: seller,
      lines: lines,
      applyVat: applyVat,
      discountAmount: discountAmount,
      vatAmount: vatAmount,
      pdf: pdf,
    );

FakeInvoicesPort _port([InvoiceDetail? detail]) =>
    FakeInvoicesPort(details: <InvoiceDetail>[detail ?? _detail()]);

class _GatedPort extends FakeInvoicesPort {
  _GatedPort() : super(details: <InvoiceDetail>[_detail()]);

  final Completer<void> gate = Completer<void>();

  @override
  Future<InvoicePdfInfo> exportInvoicePdf(
      String orderId, String invoiceId) async {
    await gate.future;
    return super.exportInvoicePdf(orderId, invoiceId);
  }
}

class _Shared {
  /// The file name travels as the share title (`XFile.fromData` has no name on
  /// the test VM).
  final List<String?> titles = <String?>[];
  final List<List<String>?> names = <List<String>?>[];
  Object? error;

  Future<AppShareResult> call(List<XFile> files,
      {String? title, String? text, List<String>? fileNames}) async {
    expect(files.length, 1);
    titles.add(title);
    names.add(fileNames);
    final Object? err = error;
    if (err != null) throw err;
    return AppShareResult.shared;
  }
}

void _screen(WidgetTester tester, [double width = 400.0]) {
  tester.view.physicalSize = Size(width, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Future<void> _pump(
  WidgetTester tester,
  InvoicesPort port, {
  _Shared? shared,
  bool settle = true,
}) async {
  final _Shared share = shared ?? _Shared();
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: InvoiceDetailScreen(
          port: port,
          orderId: _kOrderId,
          invoiceId: _kInvoiceId,
          shareImpl: share.call,
        ),
      ),
    ),
  );
  if (settle) await tester.pumpAndSettle();
}

Finder _exportButton() => find.widgetWithText(AppButton, 'Xuất PDF');

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
      'document: number, UTC+7 date, linked order, seller, customer, lines and '
      'totals through MoneyText', (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, _port());

    expect(find.text('Hoá đơn bán hàng'), findsOneWidget);
    expect(find.text('HOÁ ĐƠN BÁN HÀNG'.toUpperCase()), findsOneWidget);
    expect(find.text('HD-2026-0001'), findsOneWidget);
    expect(find.text('06/07/2026'), findsOneWidget);
    expect(find.text('BG-3F2A9B1C · Bản 2'), findsOneWidget);
    expect(find.text('CÔNG TY NLMT PHƯƠNG NAM'), findsOneWidget);
    expect(find.text('0312998771'), findsOneWidget);
    // Address, phone and bank account were empty when the invoice was issued.
    expect(find.text('Chưa cấu hình'), findsNWidgets(3));
    expect(find.text('VP Công Chứng Lê Đình Thao'), findsOneWidget);
    expect(find.text('0316552018'), findsOneWidget);
    expect(find.text('122 Trần Não, TP. Thủ Đức'), findsOneWidget);
    expect(find.text('Tấm pin AE 630W ×14'), findsOneWidget);
    expect(find.text('Inverter Solplanet ASW8000-S ×1'), findsOneWidget);
    expect(find.text('Vật tư (gói) ×1'), findsOneWidget);
    expect(find.text('Công lắp đặt ×1'), findsOneWidget);
    for (final int amount in <int>[
      36162000,
      18500000,
      12400000,
      9800000,
      76862000,
      6148960,
      83010960,
    ]) {
      expect(
        find.byWidgetPredicate(
            (Widget w) => w is MoneyText && w.value == amount),
        findsOneWidget,
        reason: 'MoneyText($amount)',
      );
    }
    expect(find.text('Tổng trước VAT'), findsOneWidget);
    expect(find.text('VAT 8%'), findsOneWidget);
    expect(find.text('Tổng thanh toán'), findsOneWidget);
    expect(find.text('Chiết khấu'), findsNothing);
    expect(find.text('Không áp VAT'), findsNothing);
    expect(find.text(_kInfo), findsOneWidget);
    // Short labels that also sit inside longer ones, matched as whole texts.
    expect(find.text('HOÁ ĐƠN'), findsOneWidget);
    expect(find.text('MST'.toUpperCase()), findsOneWidget);
  });

  testWidgets('no tax code / no address ⇒ "Không có MST", no address row',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, _port(_detail(withTaxCode: false, withAddress: false)));
    expect(find.text('Không có MST'), findsOneWidget);
    // The only "Địa chỉ" left is the seller's.
    expect(find.text('Địa chỉ'), findsOneWidget);
  });

  testWidgets('discount above zero ⇒ a Chiết khấu row through MoneyText',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, _port(_detail(discountAmount: 1862000)));
    expect(find.text('Chiết khấu'), findsOneWidget);
    expect(
      find.byWidgetPredicate(
          (Widget w) => w is MoneyText && w.value == 1862000),
      findsOneWidget,
    );
  });

  testWidgets('applyVat false ⇒ "Không áp VAT"', (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, _port(_detail(applyVat: false, vatAmount: 0)));
    expect(find.text('Không áp VAT'), findsOneWidget);
    expect(find.text('VAT 8%'), findsNothing);
  });

  testWidgets('PDF status: "Chưa xuất PDF" then "Đã xuất PDF · dd/MM/yyyy"',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, _port());
    expect(find.text('Chưa xuất PDF'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await _pump(
      tester,
      _port(_detail(
        pdf: InvoicePdfInfo(
          fileName: 'hoa-don-HD-2026-0001.pdf',
          pdfSize: 48213,
          exportedAt: DateTime.utc(2026, 12, 31, 18),
        ),
      )),
    );
    expect(find.text('Đã xuất PDF · 01/01/2027'), findsOneWidget);
  });

  testWidgets(
      'press ⇒ export once, download, share the named file, reload shows '
      'Đã xuất PDF', (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = _port();
    final _Shared shared = _Shared();
    await _pump(tester, port, shared: shared);

    await _tap(tester, _exportButton());

    expect(port.exportCalls, <String>[_kInvoiceId]);
    expect(port.downloadCalls, <String>[_kInvoiceId]);
    expect(shared.titles, <String?>['hoa-don-HD-2026-0001.pdf']);
    expect(shared.names, <List<String>?>[<String>['hoa-don-HD-2026-0001.pdf']]);
    expect(port.getInvoiceCalls.length, 2);
    expect(find.text('Đã xuất PDF · 22/10/2026'), findsOneWidget);
    expect(find.byType(AppBanner), findsOneWidget); // only the info banner
  });

  testWidgets('double press in flight ⇒ one export call, button disabled',
      (WidgetTester tester) async {
    _screen(tester);
    final _GatedPort port = _GatedPort();
    await _pump(tester, port);

    await tester.ensureVisible(_exportButton());
    await tester.tap(_exportButton());
    await tester.pump();
    final AppButton busy = tester.widget<AppButton>(_exportButton());
    expect(busy.onPressed, isNull);
    await tester.tap(_exportButton(), warnIfMissed: false);
    await tester.pump();

    port.gate.complete();
    await tester.pumpAndSettle();

    expect(port.exportCalls, <String>[_kInvoiceId]);
    expect(tester.widget<AppButton>(_exportButton()).onPressed, isNotNull);
    expect(find.text('Đã xuất PDF · 22/10/2026'), findsOneWidget);
  });

  testWidgets('a server refusal is shown verbatim',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = _port()
      ..exportError = const InvoicesPortError(
          status: 404, message: 'Không tìm thấy hoá đơn.');
    await _pump(tester, port);

    await _tap(tester, _exportButton());

    expect(find.text('Không tìm thấy hoá đơn.'), findsOneWidget);
  });

  testWidgets(
      'a share failure (not an envelope) ⇒ the Vietnamese fallback, the stored '
      'file still shows', (WidgetTester tester) async {
    _screen(tester);
    final _Shared shared = _Shared()..error = Exception('share sheet failed');
    await _pump(tester, _port(), shared: shared);

    await _tap(tester, _exportButton());

    expect(find.text('Không xuất được PDF hoá đơn. Vui lòng thử lại.'),
        findsOneWidget);
    expect(find.text('Đã xuất PDF · 22/10/2026'), findsOneWidget);
  });

  testWidgets('loading ⇒ skeleton', (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, _port(), settle: false);
    expect(find.byType(AppSkeleton), findsWidgets);
    await tester.pumpAndSettle();
  });

  testWidgets('load error ⇒ error state, "Thử lại" reloads',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = _port()
      ..getInvoiceError = StateError('offline');
    await _pump(tester, port);
    expect(find.text('Không tải được hoá đơn.'), findsOneWidget);

    port.getInvoiceError = null;
    await _tap(tester, find.text('Thử lại'));

    expect(find.text('HD-2026-0001'), findsOneWidget);
    expect(port.getInvoiceCalls.length, 2);
  });

  test('the fake refuses like the backend: unknown invoice, download first',
      () async {
    final FakeInvoicesPort port = _port();
    await expectLater(
      port.getInvoice(_kOrderId, 'invoice-unknown'),
      throwsA(isA<InvoicesPortError>()
          .having((InvoicesPortError e) => e.status, 'status', 404)
          .having((InvoicesPortError e) => e.message, 'message',
              'Không tìm thấy hoá đơn.')),
    );
    await expectLater(
      port.downloadInvoicePdf(_kOrderId, _kInvoiceId),
      throwsA(isA<InvoicesPortError>().having(
          (InvoicesPortError e) => e.message,
          'message',
          'Hoá đơn này chưa xuất PDF.')),
    );
  });

  test('the fake refuses an invoice asked for through another order', () async {
    final FakeInvoicesPort port = _port();
    await port.getInvoice(_kOrderId, _kInvoiceId);
    for (final Future<Object> Function() call in <Future<Object> Function()>[
      () => port.getInvoice('DH-OTHER', _kInvoiceId),
      () => port.exportInvoicePdf('DH-OTHER', _kInvoiceId),
      () => port.downloadInvoicePdf('DH-OTHER', _kInvoiceId),
    ]) {
      await expectLater(
        call(),
        throwsA(isA<InvoicesPortError>()
            .having((InvoicesPortError e) => e.status, 'status', 404)
            .having((InvoicesPortError e) => e.message, 'message',
                'Không tìm thấy hoá đơn.')),
      );
    }
  });

  test('a listed invoice opens with the list\'s own customer and figures',
      () async {
    final InvoiceSummary listed = InvoiceSummary(
      id: 'inv-listed',
      invoiceNo: 'HD-2026-0042',
      versionNo: 3,
      issuedAt: DateTime.utc(2026, 10, 21, 3),
      customerName: 'Công ty TNHH Mặt Trời Xanh',
      customerTaxCode: '0300000001',
      vatRate: 10,
      applyVat: true,
      subtotal: 10000000,
      discountAmount: 500000,
      vatAmount: 950000,
      total: 10450000,
      lineCount: 4,
    );
    final FakeInvoicesPort port =
        FakeInvoicesPort(initial: <InvoiceSummary>[listed]);
    final InvoiceDetail d = await port.getInvoice(_kOrderId, listed.id);
    expect(d.customerName, listed.customerName);
    expect(d.customerTaxCode, listed.customerTaxCode);
    expect(d.vatRate, listed.vatRate);
    expect(d.subtotal, listed.subtotal);
    expect(d.discountAmount, listed.discountAmount);
    expect(d.vatAmount, listed.vatAmount);
    expect(d.total, listed.total);
  });

  testWidgets('another invoice on the same screen instance is read and shown',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = FakeInvoicesPort(details: <InvoiceDetail>[
      _detail(),
      demoInvoiceDetail(id: 'invoice-2', invoiceNo: 'HD-2026-0002'),
    ]);
    Widget screen(String invoiceId) => MaterialApp(
          home: Scaffold(
            body: InvoiceDetailScreen(
              port: port,
              orderId: _kOrderId,
              invoiceId: invoiceId,
            ),
          ),
        );
    await tester.pumpWidget(screen(_kInvoiceId));
    await tester.pumpAndSettle();
    expect(find.text('HD-2026-0001'), findsOneWidget);

    await tester.pumpWidget(screen('invoice-2'));
    await tester.pumpAndSettle();
    expect(find.text('HD-2026-0002'), findsOneWidget);
    expect(find.text('HD-2026-0001'), findsNothing);
  });

  test('the fake exports once: a second export returns the same file',
      () async {
    final FakeInvoicesPort port = _port();
    final InvoicePdfInfo first =
        await port.exportInvoicePdf(_kOrderId, _kInvoiceId);
    final InvoicePdfInfo second =
        await port.exportInvoicePdf(_kOrderId, _kInvoiceId);
    expect(identical(first, second), isTrue);
  });

  test('an invoice created through the fake can be opened (one store)',
      () async {
    final FakeInvoicesPort port = FakeInvoicesPort();
    final InvoiceSummary created = await port.createInvoice(_kOrderId);
    final InvoiceDetail detail = await port.getInvoice(_kOrderId, created.id);
    expect(detail.invoiceNo, created.invoiceNo);
  });

  for (final double width in <double>[320.0, 360.0]) {
    testWidgets('longest labels do not overflow at ${width.toInt()}px',
        (WidgetTester tester) async {
      _screen(tester, width);
      await _pump(
        tester,
        _port(_detail(
          invoiceNo: 'HD-2026-123456',
          customerName: 'K' * 80,
          seller: InvoiceSeller(
            legalName: 'C' * 80,
            taxCode: '0312998771',
            address: 'A' * 120,
            representative: '',
            representativeTitle: '',
            phone: '',
            bankAccount: 'B' * 60,
          ),
          lines: <InvoiceLine>[
            InvoiceLine(
                displayOrder: 0,
                name: 'T' * 120,
                unit: 'Tấm',
                qty: 140,
                unitPrice: 2583000,
                amount: 361620000),
          ],
          pdf: InvoicePdfInfo(
            fileName: 'hoa-don-HD-2026-123456.pdf',
            pdfSize: 1,
            exportedAt: DateTime.utc(2026, 12, 30, 18),
          ),
        )),
      );
      expect(find.text('Đã xuất PDF · 31/12/2026'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await _tap(tester, _exportButton());
      expect(tester.takeException(), isNull);
    });
  }
}
