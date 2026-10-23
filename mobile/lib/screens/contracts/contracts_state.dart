// hand-authored — Sinh hợp đồng state (Story 11.4), held by ContractsCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/contracts_port.dart';

enum ContractsStatus { loading, ready, error }

/// "Leave this field as it is" for the nullable fields of [ContractsState.copyWith].
const Object _keep = Object();

/// One class for every phase: a failed silent re-read keeps the overview on
/// screen, so the data outlives the phase.
final class ContractsState extends Equatable {
  const ContractsState({
    this.status = ContractsStatus.loading,
    this.overview,
    this.busy = false,
    this.error,
  });

  final ContractsStatus status;

  /// The backend's view of the order's contract: totals, labels and whether a
  /// contract may be generated — nothing here is computed client-side.
  final ContractsOverview? overview;

  /// A generate or a download is running; both buttons are disabled.
  final bool busy;

  /// The banner of the last generate/download; null = no banner.
  final String? error;

  ContractsState copyWith({
    ContractsStatus? status,
    ContractsOverview? overview,
    bool? busy,
    Object? error = _keep,
  }) =>
      ContractsState(
        status: status ?? this.status,
        overview: overview ?? this.overview,
        busy: busy ?? this.busy,
        error: identical(error, _keep) ? this.error : error as String?,
      );

  @override
  List<Object?> get props => [status, overview, busy, error];
}
