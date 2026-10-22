// hand-authored — the real ContractsPort over the generated client (Story 10.8,
// mirror web/src/api/http-contracts-port.ts).
//
// The PDF download arrives as a header-less byte stream, so its file name comes
// from the contract's own metadata (the overview lists it); the web reads the
// same name off Content-Disposition. The bytes go to share_plus — never a URL.
import '../design_system/session/contracts_port.dart';
import 'api_error.dart';
import 'bytes.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpContractsPort implements ContractsPort {
  HttpContractsPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await _transport.call(request);
    } on ApiError catch (e) {
      throw ContractsPortError(status: e.status ?? 0, message: e.message);
    }
  }

  @override
  Future<ContractsOverview> getOverview(String orderId) =>
      _call(() => _client.contracts.contractsControllerOverview(id: Uri.encodeComponent(orderId)));

  @override
  Future<ContractSummary> generateContract(String orderId) =>
      _call(() => _client.contracts.contractsControllerGenerate(id: Uri.encodeComponent(orderId)));

  @override
  Future<ContractPdfFile> downloadContractPdf(String orderId, String contractId) async {
    final overview = await getOverview(orderId);
    final stored = [
      for (final c in overview.contracts)
        if (c.id == contractId) c.fileName,
    ];
    final bytes = await _call(
      () => collectBytes(
        _client.contracts.contractsControllerDownloadPdf(
          id: Uri.encodeComponent(orderId),
          contractId: Uri.encodeComponent(contractId),
        ),
      ),
    );
    // The stored name has no extension; the backend serves it as `<name>.pdf`.
    return ContractPdfFile(bytes: bytes, fileName: '${stored.isEmpty ? contractId : stored.first}.pdf');
  }
}
