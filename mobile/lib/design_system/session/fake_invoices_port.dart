// hand-authored — TEST/DEMO-ONLY fake port (Story 7.4, mirror web
// web/src/design-system/session/fake-invoices-port.ts).
//
// NOT a real backend and it computes NOTHING: the money numbers are typed as the
// backend would return them. The first `createInvoice` appends `HD-2026-0001`; a
// second call returns the SAME invoice (idempotent replay).

import 'invoices_port.dart';

/// The backend's status refusal (`invoice-eligibility.ts`), the default
/// blocked reason.
const String _kStatusBlocked = 'Chỉ tạo hoá đơn khi đơn đã chốt và chưa huỷ.';

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
  }) : _invoices = List<InvoiceSummary>.of(initial);

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

  final List<InvoiceSummary> _invoices;

  final List<String> overviewCalls = <String>[];
  final List<String> createCalls = <String>[];

  @override
  Future<InvoicesOverview> getOverview(String orderId) async {
    overviewCalls.add(orderId);
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
}
