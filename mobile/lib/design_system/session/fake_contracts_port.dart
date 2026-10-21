// hand-authored — TEST/DEMO-ONLY fake port (Story 7.3, mirror web
// web/src/design-system/session/fake-contracts-port.ts).
//
// NOT a real backend and it computes NOTHING: the numbers are typed as the backend
// would return them. `generateContract` adds one canned summary with an increasing
// number; the list is kept newest first (the port contract), and `initial` is taken
// in that order. The call lists record what the screen asked for.

import 'dart:typed_data';

import 'contracts_port.dart';

class FakeContractsPort implements ContractsPort {
  FakeContractsPort({
    this.contractType = 'sale',
    this.generatable = true,
    this.blockedReason,
    this.missingPartyFields = const <String>[],
    this.customerName = 'Anh Nguyễn Văn An',
    List<ContractSummary> initial = const <ContractSummary>[],
    this.overviewError,
    this.generateError,
    this.downloadError,
  }) : _contracts = List<ContractSummary>.of(initial);

  String contractType;
  bool generatable;
  String? blockedReason;
  List<String> missingPartyFields;
  String customerName;

  /// Thrown by the next [getOverview] calls while non-null.
  Object? overviewError;
  Object? generateError;
  Object? downloadError;

  final List<ContractSummary> _contracts;
  int _seq = 0;

  final List<String> overviewCalls = <String>[];
  final List<String> generateCalls = <String>[];
  final List<({String orderId, String contractId})> downloadCalls =
      <({String orderId, String contractId})>[];

  @override
  Future<ContractsOverview> getOverview(String orderId) async {
    overviewCalls.add(orderId);
    final Object? err = overviewError;
    if (err != null) throw err;
    return ContractsOverview(
      contractType: contractType,
      generatable: generatable,
      blockedReason: blockedReason,
      quoteNo: 'BG-2048',
      versionNo: 1,
      customerName: customerName,
      lineCount: 4,
      orderTotal: 83010960,
      scheduleLabel: '20/70/10',
      missingPartyFields: missingPartyFields,
      contracts: List<ContractSummary>.unmodifiable(_contracts),
    );
  }

  @override
  Future<ContractSummary> generateContract(String orderId) async {
    generateCalls.add(orderId);
    final Object? err = generateError;
    if (err != null) throw err;
    _seq += 1;
    final String prefix = contractType == 'construction' ? 'HĐTC' : 'HĐMB';
    final ContractSummary created = ContractSummary(
      id: 'contract-$_seq',
      contractNo: '$prefix-${(123455 + _seq).toString()}/2026',
      contractType: contractType,
      // The ORDER version printed (the overview's), not a contract counter.
      versionNo: 1,
      fileName: contractType == 'construction'
          ? 'hop-dong-thi-cong-$_seq'
          : 'hop-dong-mua-ban-$_seq',
      pdfSize: 4096,
      createdAt: '2026-10-22T03:00:00.000Z',
    );
    _contracts.insert(0, created);
    return created;
  }

  @override
  Future<ContractPdfFile> downloadContractPdf(
      String orderId, String contractId) async {
    downloadCalls.add((orderId: orderId, contractId: contractId));
    final Object? err = downloadError;
    if (err != null) throw err;
    return ContractPdfFile(
      bytes: Uint8List.fromList(const <int>[0x25, 0x50, 0x44, 0x46]),
      fileName: '$contractId.pdf',
    );
  }
}
