// hand-authored — Sinh hợp đồng (Story 11.4, moved out of ContractsScreen's State).
// Every read and write goes through the injected [ContractsPort]; the share seam
// comes from the screen. Nothing here computes money — the overview arrives
// computed by the backend.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/contracts_port.dart';
import 'contracts_state.dart';

const String _kUnknownError = 'Không xuất được hợp đồng. Vui lòng thử lại.';
const String _kDownloadError =
    'Không tải được file hợp đồng. Vui lòng thử lại.';

/// The contract exists now, so a retry of "Xuất PDF hợp đồng" would make a SECOND
/// one: point at "Tải PDF" in the refreshed list instead.
String _generatedButNotDownloaded(String contractNo) =>
    'Đã sinh hợp đồng $contractNo nhưng chưa tải được — bấm “Tải PDF” trong danh sách.';

class ContractsCubit extends Cubit<ContractsState> {
  ContractsCubit(this._port, this._orderId) : super(const ContractsState());

  final ContractsPort _port;
  final String _orderId;

  int _ticket = 0;

  /// [showSkeleton] false = a refresh behind the overview already on screen: a
  /// failure keeps the last good view.
  Future<void> load({bool showSkeleton = true}) async {
    final int ticket = ++_ticket;
    if (showSkeleton) emit(state.copyWith(status: ContractsStatus.loading));
    try {
      final ContractsOverview o = await _port.getOverview(_orderId);
      if (isClosed || ticket != _ticket) return;
      emit(state.copyWith(overview: o, status: ContractsStatus.ready));
    } catch (_) {
      if (isClosed || ticket != _ticket) return;
      // A failed silent refresh keeps the last good view.
      if (showSkeleton || state.overview == null) {
        emit(state.copyWith(status: ContractsStatus.error));
      }
    }
  }

  /// Generates a NEW contract, then shares its PDF. A share that fails after the
  /// contract exists is not an error of the generate: the banner points at
  /// "Tải PDF" instead of inviting a second contract.
  Future<void> generate(AppShareFn share) => _run(() async {
        final ContractSummary created = await _port.generateContract(_orderId);
        if (isClosed) return;
        try {
          await _share(created.id, share);
        } catch (_) {
          if (isClosed) return;
          emit(state.copyWith(error: _generatedButNotDownloaded(created.contractNo)));
        }
      });

  Future<void> download(String contractId, AppShareFn share) =>
      _run(() => _share(contractId, share), fallback: _kDownloadError);

  Future<void> _share(String contractId, AppShareFn share) async {
    final ContractPdfFile file =
        await _port.downloadContractPdf(_orderId, contractId);
    if (isClosed) return;
    await share(
      <XFile>[
        XFile.fromData(
          file.bytes,
          mimeType: 'application/pdf',
          name: file.fileName,
        ),
      ],
      title: file.fileName,
      fileNames: <String>[file.fileName],
    );
  }

  /// Runs [action] once at a time; a failure becomes a banner with the server
  /// message verbatim. The button comes back BEFORE the overview is re-read.
  Future<void> _run(Future<void> Function() action,
      {String fallback = _kUnknownError}) async {
    if (state.busy) return;
    emit(state.copyWith(busy: true, error: null));
    try {
      await action();
    } catch (e) {
      if (!isClosed) {
        emit(state.copyWith(error: e is ContractsPortError ? e.message : fallback));
      }
    } finally {
      if (!isClosed) emit(state.copyWith(busy: false));
    }
    if (isClosed) return;
    await load(showSkeleton: false);
  }
}
