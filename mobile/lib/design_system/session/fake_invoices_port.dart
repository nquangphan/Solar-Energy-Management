// hand-authored — TEST/DEMO-ONLY fake port (Story 7.4 + 7.5, mirror web
// web/src/design-system/session/fake-invoices-port.ts).
//
// NOT a real backend and it computes NOTHING: the money numbers are typed as the
// backend would return them. The first `createInvoice` appends `HD-2026-0001`; a
// second call returns the SAME invoice (idempotent replay). `exportInvoicePdf`
// stores a PDF the first time and returns the SAME one afterwards; an unknown
// invoice, an invoice asked for through ANOTHER order and a download before the
// export are refused like the backend does. The fake holds the invoices of ONE
// order: the first order it is asked about.

import 'dart:typed_data';

import 'invoices_port.dart';

/// The backend's status refusal (`invoice-eligibility.ts`), the default
/// blocked reason.
const String _kStatusBlocked = 'Chỉ tạo hoá đơn khi đơn đã chốt và chưa huỷ.';

/// The backend's refusals for one invoice (`invoice-document.service.ts`).
const InvoicesPortError _kInvoiceNotFound =
    InvoicesPortError(status: 404, message: 'Không tìm thấy hoá đơn.');
const InvoicesPortError _kPdfNotExported =
    InvoicesPortError(status: 404, message: 'Hoá đơn này chưa xuất PDF.');

/// The mockup seller (`#s-invoice`): name and tax code set, the rest empty.
const InvoiceSeller kDemoInvoiceSeller = InvoiceSeller(
  legalName: 'CÔNG TY NLMT PHƯƠNG NAM',
  taxCode: '0312998771',
  address: '',
  representative: '',
  representativeTitle: '',
  phone: '',
  bankAccount: '',
);

/// The mockup lines — literal figures as the backend returns them.
const List<InvoiceLine> kDemoInvoiceLines = <InvoiceLine>[
  InvoiceLine(
      displayOrder: 0,
      name: 'Tấm pin AE 630W',
      unit: 'Tấm',
      qty: 14,
      unitPrice: 2583000,
      amount: 36162000),
  InvoiceLine(
      displayOrder: 1,
      name: 'Inverter Solplanet ASW8000-S',
      unit: 'Bộ',
      qty: 1,
      unitPrice: 18500000,
      amount: 18500000),
  InvoiceLine(
      displayOrder: 2,
      name: 'Vật tư (gói)',
      unit: 'Gói',
      qty: 1,
      unitPrice: 12400000,
      amount: 12400000),
  InvoiceLine(
      displayOrder: 3,
      name: 'Công lắp đặt',
      unit: 'Gói',
      qty: 1,
      unitPrice: 9800000,
      amount: 9800000),
];

/// The mockup invoice in full. Every figure is a literal; tests pick variants
/// (discount, no VAT, no tax code…) through the named parameters.
InvoiceDetail demoInvoiceDetail({
  String id = 'invoice-1',
  String invoiceNo = 'HD-2026-0001',
  String orderId = 'DH-2048',
  String quoteNo = 'BG-2048',
  int versionNo = 1,
  DateTime? issuedAt,
  String customerName = 'VP Công Chứng Lê Đình Thao',
  bool withTaxCode = true,
  String? customerTaxCode,
  bool withAddress = true,
  InvoiceSeller seller = kDemoInvoiceSeller,
  List<InvoiceLine> lines = kDemoInvoiceLines,
  bool applyVat = true,
  int vatRate = 8,
  int subtotal = 76862000,
  int discountAmount = 0,
  int vatAmount = 6148960,
  int total = 83010960,
  InvoicePdfInfo? pdf,
}) =>
    InvoiceDetail(
      id: id,
      invoiceNo: invoiceNo,
      versionNo: versionNo,
      issuedAt: issuedAt ?? DateTime.utc(2026, 10, 22, 3),
      customerName: customerName,
      customerTaxCode: withTaxCode ? (customerTaxCode ?? '0316552018') : null,
      vatRate: vatRate,
      applyVat: applyVat,
      subtotal: subtotal,
      discountAmount: discountAmount,
      vatAmount: vatAmount,
      total: total,
      lineCount: lines.length,
      orderId: orderId,
      quoteNo: quoteNo,
      customerSdt: '+84901234567',
      customerAddress: withAddress ? '122 Trần Não, TP. Thủ Đức' : null,
      seller: seller,
      lines: lines,
      pdf: pdf,
    );

InvoiceDetail _withPdf(InvoiceDetail d, InvoicePdfInfo? pdf) => InvoiceDetail(
      id: d.id,
      invoiceNo: d.invoiceNo,
      versionNo: d.versionNo,
      issuedAt: d.issuedAt,
      customerName: d.customerName,
      customerTaxCode: d.customerTaxCode,
      vatRate: d.vatRate,
      applyVat: d.applyVat,
      subtotal: d.subtotal,
      discountAmount: d.discountAmount,
      vatAmount: d.vatAmount,
      total: d.total,
      lineCount: d.lineCount,
      orderId: d.orderId,
      quoteNo: d.quoteNo,
      customerSdt: d.customerSdt,
      customerAddress: d.customerAddress,
      seller: d.seller,
      lines: d.lines,
      pdf: pdf,
    );

class FakeInvoicesPort implements InvoicesPort {
  FakeInvoicesPort({
    this.creatable = true,
    this.blockedReason,
    this.customerName = 'VP Công Chứng Lê Đình Thao',
    this.customerTaxCode = '0316552018',
    this.versionNo = 1,
    List<InvoiceSummary> initial = const <InvoiceSummary>[],
    this.currentInvoiceId,
    this.overviewError,
    this.createError,
    List<InvoiceDetail> details = const <InvoiceDetail>[],
    this.getInvoiceError,
    this.exportError,
    this.downloadError,
  })  : _invoices = List<InvoiceSummary>.of(initial),
        _details = <String, InvoiceDetail>{
          for (final InvoiceDetail d in details) d.id: d,
        };

  bool creatable;
  String? blockedReason;
  String customerName;
  String? customerTaxCode;
  int versionNo;
  String? currentInvoiceId;

  /// Thrown by [getOverview] while non-null.
  Object? overviewError;

  /// Thrown by [createInvoice] while non-null.
  Object? createError;

  /// Thrown by [getInvoice] while non-null.
  Object? getInvoiceError;

  /// Thrown by [exportInvoicePdf] while non-null.
  Object? exportError;

  /// Thrown by [downloadInvoicePdf] while non-null.
  Object? downloadError;

  final List<InvoiceSummary> _invoices;
  final Map<String, InvoiceDetail> _details;
  final Map<String, InvoicePdfInfo> _pdfs = <String, InvoicePdfInfo>{};

  final List<String> overviewCalls = <String>[];
  final List<String> createCalls = <String>[];
  final List<String> getInvoiceCalls = <String>[];
  final List<String> exportCalls = <String>[];
  final List<String> downloadCalls = <String>[];

  @override
  Future<InvoicesOverview> getOverview(String orderId) async {
    overviewCalls.add(orderId);
    _bind(orderId);
    final Object? err = overviewError;
    if (err != null) throw err;
    return InvoicesOverview(
      creatable: creatable,
      // Like the backend: the blocker's message whenever one applies, even
      // beside an existing invoice; none when the invoice is the only reason.
      blockedReason: creatable
          ? null
          : (blockedReason ??
              (currentInvoiceId == null ? _kStatusBlocked : null)),
      currentInvoiceId: currentInvoiceId,
      versionNo: versionNo,
      customerName: customerName,
      customerTaxCode: customerTaxCode,
      lineCount: 4,
      orderTotal: 83010960,
      invoices: List<InvoiceSummary>.unmodifiable(_invoices),
    );
  }

  @override
  Future<InvoiceSummary> createInvoice(String orderId) async {
    createCalls.add(orderId);
    _bind(orderId);
    final Object? err = createError;
    if (err != null) throw err;
    if (_invoices.isNotEmpty && currentInvoiceId == _invoices.first.id) {
      return _invoices.first;
    }
    // Like the backend: a blocked order is refused with 409 and its reason.
    if (!creatable) {
      throw InvoicesPortError(
          status: 409, message: blockedReason ?? _kStatusBlocked);
    }
    final InvoiceSummary created = InvoiceSummary(
      // Unique even when the seeded list already holds an invoice.
      id: 'invoice-${_invoices.length + 1}',
      invoiceNo: 'HD-2026-0001',
      versionNo: versionNo,
      issuedAt: DateTime.utc(2026, 10, 22, 3),
      customerName: customerName,
      customerTaxCode: customerTaxCode,
      vatRate: 8,
      applyVat: true,
      subtotal: 76862000,
      discountAmount: 0,
      vatAmount: 6148960,
      total: 83010960,
      lineCount: 4,
    );
    _invoices.insert(0, created);
    currentInvoiceId = created.id;
    creatable = false;
    return created;
  }

  /// The fake's one order: the first one it is asked about.
  String? _orderId;

  void _bind(String orderId) => _orderId ??= orderId;

  /// The seeded detail, else the demo detail of an invoice created here (one
  /// store — the list's own figures), else null. Like the backend, an invoice
  /// asked for through ANOTHER order is as missing as an unknown one.
  InvoiceDetail? _find(String orderId, String invoiceId) {
    _bind(orderId);
    if (orderId != _orderId) return null;
    final InvoiceDetail? seeded = _details[invoiceId];
    if (seeded != null) return seeded;
    for (final InvoiceSummary i in _invoices) {
      if (i.id == invoiceId) {
        return demoInvoiceDetail(
          id: i.id,
          invoiceNo: i.invoiceNo,
          orderId: orderId,
          versionNo: i.versionNo,
          issuedAt: i.issuedAt,
          customerName: i.customerName,
          withTaxCode: i.customerTaxCode != null,
          customerTaxCode: i.customerTaxCode,
          applyVat: i.applyVat,
          vatRate: i.vatRate,
          subtotal: i.subtotal,
          discountAmount: i.discountAmount,
          vatAmount: i.vatAmount,
          total: i.total,
        );
      }
    }
    return null;
  }

  @override
  Future<InvoiceDetail> getInvoice(String orderId, String invoiceId) async {
    getInvoiceCalls.add(invoiceId);
    final Object? err = getInvoiceError;
    if (err != null) throw err;
    final InvoiceDetail? found = _find(orderId, invoiceId);
    if (found == null) throw _kInvoiceNotFound;
    return _withPdf(found, _pdfs[invoiceId] ?? found.pdf);
  }

  @override
  Future<InvoicePdfInfo> exportInvoicePdf(
      String orderId, String invoiceId) async {
    exportCalls.add(invoiceId);
    final Object? err = exportError;
    if (err != null) throw err;
    final InvoiceDetail? found = _find(orderId, invoiceId);
    if (found == null) throw _kInvoiceNotFound;
    final InvoicePdfInfo? stored = _pdfs[invoiceId] ?? found.pdf;
    if (stored != null) return stored;
    final InvoicePdfInfo pdf = InvoicePdfInfo(
      fileName: 'hoa-don-${found.invoiceNo}.pdf',
      pdfSize: 48213,
      exportedAt: DateTime.utc(2026, 10, 22, 4),
    );
    _pdfs[invoiceId] = pdf;
    return pdf;
  }

  @override
  Future<InvoicePdfFile> downloadInvoicePdf(
      String orderId, String invoiceId) async {
    downloadCalls.add(invoiceId);
    final Object? err = downloadError;
    if (err != null) throw err;
    final InvoiceDetail? found = _find(orderId, invoiceId);
    if (found == null) throw _kInvoiceNotFound;
    final InvoicePdfInfo? pdf = _pdfs[invoiceId] ?? found.pdf;
    if (pdf == null) throw _kPdfNotExported;
    return InvoicePdfFile(
      bytes: Uint8List.fromList(const <int>[0x25, 0x50, 0x44, 0x46]),
      fileName: pdf.fileName,
    );
  }
}
