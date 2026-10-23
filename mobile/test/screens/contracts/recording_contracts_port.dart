// A ContractsPort for the ContractsCubit tests (Story 11.4): FakeContractsPort
// underneath, every call logged in order (see RecordingPortCalls).
import 'package:pns_mobile/design_system/session/contracts_port.dart';
import 'package:pns_mobile/design_system/session/fake_contracts_port.dart';

import '../recording_port_calls.dart';

class RecordingContractsPort extends FakeContractsPort with RecordingPortCalls {
  RecordingContractsPort({super.initial});

  @override
  Future<ContractsOverview> getOverview(String orderId) =>
      record('getOverview', [orderId], () => super.getOverview(orderId));

  @override
  Future<ContractSummary> generateContract(String orderId) =>
      record('generateContract', [orderId], () => super.generateContract(orderId));

  @override
  Future<ContractPdfFile> downloadContractPdf(String orderId, String contractId) => record(
        'downloadContractPdf',
        [orderId, contractId],
        () => super.downloadContractPdf(orderId, contractId),
      );
}
