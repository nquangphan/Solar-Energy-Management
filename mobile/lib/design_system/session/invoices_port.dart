// hand-authored — mobile invoices port (Story 7.4 + 7.5, mirror web
// web/src/design-system/session/invoices-port.ts). The seam between the
// "Hoá đơn bán hàng" screen and `/orders/:id/invoices`.
//
// THE CLIENT COMPUTES NO MONEY. Every amount, the invoice number and the verdict
// (`creatable`, `blockedReason`, `currentInvoiceId`) are the backend's; the screen
// only renders them.

import 'dart:typed_data';

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

/// Mirrors `InvoiceSeller`: the seller copied at issue time; `''` = not
/// configured then.
class InvoiceSeller {
  const InvoiceSeller({
    required this.legalName,
    required this.taxCode,
    required this.address,
    required this.representative,
    required this.representativeTitle,
    required this.phone,
    required this.bankAccount,
  });

  final String legalName;
  final String taxCode;
  final String address;
  final String representative;
  final String representativeTitle;
  final String phone;
  final String bankAccount;
}

/// Mirrors `InvoiceLine`.
class InvoiceLine {
  const InvoiceLine({
    required this.displayOrder,
    required this.name,
    required this.unit,
    required this.qty,
    required this.unitPrice,
    required this.amount,
  });

  final int displayOrder;
  final String name;
  final String unit;
  final int qty;

  /// Whole đồng.
  final int unitPrice;

  /// Whole đồng, stored by the backend.
  final int amount;
}

/// Mirrors `InvoicePdfResponse`: the stored PDF, rendered once by the backend.
class InvoicePdfInfo {
  const InvoicePdfInfo({
    required this.fileName,
    required this.pdfSize,
    required this.exportedAt,
  });

  /// ASCII, with the `.pdf` extension.
  final String fileName;
  final int pdfSize;

  /// UTC instant.
  final DateTime exportedAt;
}

/// Mirrors `InvoiceDetailResponse`: one invoice read from its stored snapshot.
class InvoiceDetail extends InvoiceSummary {
  const InvoiceDetail({
    required super.id,
    required super.invoiceNo,
    required super.versionNo,
    required super.issuedAt,
    required super.customerName,
    super.customerTaxCode,
    required super.vatRate,
    required super.applyVat,
    required super.subtotal,
    required super.discountAmount,
    required super.vatAmount,
    required super.total,
    required super.lineCount,
    required this.orderId,
    required this.quoteNo,
    required this.customerSdt,
    this.customerAddress,
    required this.seller,
    required this.lines,
    this.pdf,
  });

  final String orderId;

  /// "Gắn đơn" — the order's quote number.
  final String quoteNo;
  final String customerSdt;
  final String? customerAddress;
  final InvoiceSeller seller;

  /// In display order.
  final List<InvoiceLine> lines;

  /// null until exported.
  final InvoicePdfInfo? pdf;
}

/// The PDF of one invoice, as downloaded.
class InvoicePdfFile {
  const InvoicePdfFile({required this.bytes, required this.fileName});

  final Uint8List bytes;

  /// With the `.pdf` extension.
  final String fileName;
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

  /// One invoice of this order. Throws [InvoicesPortError] (404 for another
  /// order's invoice).
  Future<InvoiceDetail> getInvoice(String orderId, String invoiceId);

  /// Renders the PDF the first time; every later call returns the SAME stored
  /// file.
  Future<InvoicePdfInfo> exportInvoicePdf(String orderId, String invoiceId);

  /// The stored PDF. Throws [InvoicesPortError] 404 before the first export.
  Future<InvoicePdfFile> downloadInvoicePdf(String orderId, String invoiceId);
}
