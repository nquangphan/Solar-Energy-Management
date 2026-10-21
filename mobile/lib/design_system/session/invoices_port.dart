// hand-authored — mobile invoices port (Story 7.4, mirror web
// web/src/design-system/session/invoices-port.ts). The seam between the
// "Hoá đơn bán hàng" screen and `/orders/:id/invoices`.
//
// THE CLIENT COMPUTES NO MONEY. Every amount, the invoice number and the verdict
// (`creatable`, `blockedReason`, `currentInvoiceId`) are the backend's; the screen
// only renders them.

/// Mirrors `InvoiceSummary`.
class InvoiceSummary {
  const InvoiceSummary({
    required this.id,
    required this.invoiceNo,
    required this.versionNo,
    required this.issuedAt,
    required this.customerName,
    this.customerTaxCode,
    required this.vatRate,
    required this.applyVat,
    required this.subtotal,
    required this.discountAmount,
    required this.vatAmount,
    required this.total,
    required this.lineCount,
  });

  final String id;

  /// e.g. `HD-2026-0001`.
  final String invoiceNo;

  /// The order version the invoice snapshots.
  final int versionNo;

  /// UTC instant.
  final DateTime issuedAt;
  final String customerName;
  final String? customerTaxCode;
  final int vatRate;
  final bool applyVat;

  /// Whole đồng, computed by the backend.
  final int subtotal;
  final int discountAmount;
  final int vatAmount;
  final int total;
  final int lineCount;
}

/// Mirrors `InvoicesOverview`.
class InvoicesOverview {
  const InvoicesOverview({
    required this.creatable,
    this.blockedReason,
    this.currentInvoiceId,
    required this.versionNo,
    required this.customerName,
    this.customerTaxCode,
    required this.lineCount,
    required this.orderTotal,
    required this.invoices,
  });

  final bool creatable;
  final String? blockedReason;

  /// Set when the current order version already has an invoice.
  final String? currentInvoiceId;
  final int versionNo;
  final String customerName;
  final String? customerTaxCode;
  final int lineCount;

  /// Whole đồng, computed by the backend.
  final int orderTotal;

  /// Newest first.
  final List<InvoiceSummary> invoices;
}

/// The error envelope an [InvoicesPort] throws: [status] 400 | 404 | 409; the
/// screen renders [message] verbatim.
class InvoicesPortError implements Exception {
  const InvoicesPortError({required this.status, required this.message});

  final int status;
  final String message;

  @override
  String toString() => 'InvoicesPortError($status): $message';
}

/// Injectable transport for the Hoá đơn screen. A PORT, NOT an HTTP client.
abstract class InvoicesPort {
  Future<InvoicesOverview> getOverview(String orderId);

  /// Idempotent: a replay returns the SAME invoice. Throws [InvoicesPortError]
  /// on 400 / 404 / 409.
  Future<InvoiceSummary> createInvoice(String orderId);
}
