// hand-authored — mobile contracts port (Story 7.3, mirror web
// web/src/design-system/session/contracts-port.ts). The seam between the
// "Sinh hợp đồng" screen and `/orders/:id/contracts`.
//
// THE CLIENT COMPUTES NO MONEY. The order total, the schedule label, the contract
// number and every verdict (`generatable`, `blockedReason`, `missingPartyFields`)
// are the backend's; the screen only renders them.

import 'dart:typed_data';

/// Mirrors `ContractSummaryDto`.
class ContractSummary {
  const ContractSummary({
    required this.id,
    required this.contractNo,
    required this.contractType,
    required this.versionNo,
    required this.fileName,
    required this.pdfSize,
    required this.createdAt,
  });

  final String id;

  /// e.g. `HĐMB-123456/2026`.
  final String contractNo;

  /// `construction` | `sale`.
  final String contractType;
  final int versionNo;

  /// ASCII, without extension.
  final String fileName;

  /// Bytes.
  final int pdfSize;

  /// ISO-8601 UTC.
  final String createdAt;
}

/// Mirrors `ContractsOverviewDto`.
class ContractsOverview {
  const ContractsOverview({
    required this.contractType,
    required this.generatable,
    this.blockedReason,
    required this.quoteNo,
    required this.versionNo,
    required this.customerName,
    required this.lineCount,
    required this.orderTotal,
    this.scheduleLabel,
    required this.missingPartyFields,
    required this.contracts,
  });

  /// `construction` | `sale`.
  final String contractType;
  final bool generatable;
  final String? blockedReason;
  final String quoteNo;
  final int versionNo;
  final String customerName;
  final int lineCount;

  /// Whole đồng, computed by the backend.
  final int orderTotal;
  final String? scheduleLabel;

  /// Labels of the legal-entity fields still blank.
  final List<String> missingPartyFields;

  /// Newest first.
  final List<ContractSummary> contracts;
}

/// The PDF of one contract, as downloaded.
class ContractPdfFile {
  const ContractPdfFile({required this.bytes, required this.fileName});

  final Uint8List bytes;

  /// With the `.pdf` extension.
  final String fileName;
}

/// The error envelope a [ContractsPort] throws: [status] 400 | 404 | 409; the
/// screen renders [message] verbatim.
class ContractsPortError implements Exception {
  const ContractsPortError({required this.status, required this.message});

  final int status;
  final String message;

  @override
  String toString() => 'ContractsPortError($status): $message';
}

/// Injectable transport for the Sinh hợp đồng screen. A PORT, NOT an HTTP client.
abstract class ContractsPort {
  Future<ContractsOverview> getOverview(String orderId);

  /// Appends a NEW contract on every call. Throws [ContractsPortError] on 400 / 404 / 409.
  Future<ContractSummary> generateContract(String orderId);

  Future<ContractPdfFile> downloadContractPdf(
      String orderId, String contractId);
}
