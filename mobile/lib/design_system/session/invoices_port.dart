// hand-authored — mobile invoices port (Story 7.4 + 7.5, mirror web
// web/src/design-system/session/invoices-port.ts). The seam between the
// "Hoá đơn bán hàng" screen and `/orders/:id/invoices`.
//
// THE CLIENT COMPUTES NO MONEY. Every amount, the invoice number and the verdict
// (`creatable`, `blockedReason`, `currentInvoiceId`) are the backend's; the screen
// only renders them.

import 'dart:typed_data';

import '../../api/generated/models/invoice_detail_response_dto.dart';
import '../../api/generated/models/invoice_line_dto.dart';
import '../../api/generated/models/invoice_pdf_response_dto.dart';
import '../../api/generated/models/invoice_response_dto.dart';
import '../../api/generated/models/invoice_seller_dto.dart';
import '../../api/generated/models/invoices_overview_response_dto.dart';

/// `InvoiceResponseDto` (generated, Story 10.8). `invoiceNo` e.g.
/// `HD-2026-0001`; `versionNo` is the order version the invoice snapshots;
/// `issuedAt` a UTC instant; money fields whole đồng computed by the backend.
typedef InvoiceSummary = InvoiceResponseDto;

/// `InvoicesOverviewResponseDto`. `currentInvoiceId` is set when the current
/// order version already has an invoice; `invoices` newest first.
typedef InvoicesOverview = InvoicesOverviewResponseDto;

/// `InvoiceSellerDto`: the seller copied at issue time; `''` = not configured then.
typedef InvoiceSeller = InvoiceSellerDto;

/// `InvoiceLineDto` — `unitPrice`/`amount` whole đồng, stored by the backend.
typedef InvoiceLine = InvoiceLineDto;

/// `InvoicePdfResponseDto`: the stored PDF, rendered once by the backend.
/// `fileName` is ASCII with the `.pdf` extension.
typedef InvoicePdfInfo = InvoicePdfResponseDto;

/// `InvoiceDetailResponseDto`: one invoice read from its stored snapshot — the
/// summary fields plus `orderId`, `quoteNo` ("Gắn đơn"), `customerPhone`,
/// `customerAddress`, `seller`, `lines` (display order) and `pdf` (null until
/// exported). Not a subtype of [InvoiceSummary].
typedef InvoiceDetail = InvoiceDetailResponseDto;

/// The PDF of one invoice, as downloaded. Hand-kept: assembled by the adapter
/// from the bytes and the stored `pdf.fileName`; not a contract type.
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
