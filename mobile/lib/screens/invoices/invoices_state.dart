// hand-authored — Hoá đơn bán hàng state (Story 11.4), held by InvoicesCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/invoices_port.dart';

enum InvoicesStatus { loading, ready, error }

/// "Leave this field as it is" for the nullable fields of [InvoicesState.copyWith].
const Object _keep = Object();

/// One class for every phase: a failed silent re-read keeps the overview on
/// screen, so the data outlives the phase.
final class InvoicesState extends Equatable {
  const InvoicesState({
    this.status = InvoicesStatus.loading,
    this.overview,
    this.busy = false,
    this.error,
  });

  final InvoicesStatus status;

  /// The backend's view of the order's invoices — nothing here is computed client-side.
  final InvoicesOverview? overview;

  /// A create is running, re-read included; the button is disabled.
  final bool busy;

  /// The banner of the last create; null = no banner.
  final String? error;

  InvoicesState copyWith({
    InvoicesStatus? status,
    InvoicesOverview? overview,
    bool? busy,
    Object? error = _keep,
  }) =>
      InvoicesState(
        status: status ?? this.status,
        overview: overview ?? this.overview,
        busy: busy ?? this.busy,
        error: identical(error, _keep) ? this.error : error as String?,
      );

  @override
  List<Object?> get props => [status, overview, busy, error];
}
