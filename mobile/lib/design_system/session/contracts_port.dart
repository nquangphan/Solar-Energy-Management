// hand-authored — mobile contracts port (Story 7.3, mirror web
// web/src/design-system/session/contracts-port.ts). The seam between the
// "Sinh hợp đồng" screen and `/orders/:id/contracts`.
//
// THE CLIENT COMPUTES NO MONEY. The order total, the schedule label, the contract
// number and every verdict (`generatable`, `blockedReason`, `missingPartyFields`)
// are the backend's; the screen only renders them.

import 'dart:typed_data';

import '../../api/generated/models/contract_response_dto.dart';
import '../../api/generated/models/contracts_overview_response_dto.dart';

export '../../api/generated/models/contract_response_dto_contract_type.dart';
export '../../api/generated/models/contracts_overview_response_dto_contract_type.dart';

/// `ContractResponseDto` (generated, Story 10.8). `contractNo` e.g.
/// `HĐMB-123456/2026`; `contractType` is `construction` | `sale`; `fileName` is
/// ASCII without extension; `pdfSize` in bytes.
typedef ContractSummary = ContractResponseDto;

/// `ContractsOverviewResponseDto`. `orderTotal` is whole đồng computed by the
/// backend; `missingPartyFields` are labels of the legal-entity fields still
/// blank; `contracts` newest first.
typedef ContractsOverview = ContractsOverviewResponseDto;

/// The PDF of one contract, as downloaded. Hand-kept: the adapter assembles it
/// from the bytes and the contract's `fileName`; it is not a contract type.
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
