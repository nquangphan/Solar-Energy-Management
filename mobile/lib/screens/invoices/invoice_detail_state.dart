// hand-authored — Xem hoá đơn state (Story 11.4), held by InvoiceDetailCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/invoices_port.dart';

enum InvoiceDetailStatus { loading, ready, error }

/// "Leave this field as it is" for the nullable fields of [InvoiceDetailState.copyWith].
const Object _keep = Object();

/// One class for every phase: a failed silent re-read keeps the invoice on
/// screen, so the data outlives the phase.
final class InvoiceDetailState extends Equatable {
  const InvoiceDetailState({
    this.status = InvoiceDetailStatus.loading,
    this.invoice,
    this.busy = false,
    this.error,
  });

  final InvoiceDetailStatus status;

  /// The snapshot the backend stored when the invoice was issued.
  final InvoiceDetail? invoice;

  /// An export is running, re-read included; the button is disabled.
  final bool busy;

  /// The banner of the last export; null = no banner.
  final String? error;

  InvoiceDetailState copyWith({
    InvoiceDetailStatus? status,
    Object? invoice = _keep,
    bool? busy,
    Object? error = _keep,
  }) =>
      InvoiceDetailState(
        status: status ?? this.status,
        invoice: identical(invoice, _keep) ? this.invoice : invoice as InvoiceDetail?,
        busy: busy ?? this.busy,
        error: identical(error, _keep) ? this.error : error as String?,
      );

  @override
  List<Object?> get props => [status, invoice, busy, error];
}
