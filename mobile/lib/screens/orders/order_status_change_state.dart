// hand-authored — Chuyển trạng thái state (Story 11.3), held by OrderStatusChangeCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/orders_port.dart';

enum OrderStatusChangeStatus { loading, ready, error }

/// "Leave this field as it is" for the nullable fields of [OrderStatusChangeState.copyWith].
const Object _keep = Object();

final class OrderStatusChangeState extends Equatable {
  const OrderStatusChangeState({
    this.status = OrderStatusChangeStatus.loading,
    this.steps = const [],
    this.selected,
    this.stockIssue,
    this.previewStatus,
    this.sending = false,
    this.sendError,
    this.lineErrors = const {},
  });

  /// The lifecycle read.
  final OrderStatusChangeStatus status;

  /// The steps THIS caller may take now — the backend's filtered list (AD-2/AD-4).
  final List<OrderNextStep> steps;

  /// The picked step's `event`; null ⇒ nothing picked.
  final String? selected;

  /// The "Đã giao" stock-out preview; null for every other step.
  final OrderStockIssueView? stockIssue;

  /// The preview's own load state — null ⇒ this step has no preview.
  final OrderStatusChangeStatus? previewStatus;

  final bool sending;

  /// The backend's refusal, verbatim (or the transport fallback).
  final String? sendError;

  /// The backend's per-row stock refusals, by preview row index.
  final Map<int, String> lineErrors;

  OrderStatusChangeState copyWith({
    OrderStatusChangeStatus? status,
    List<OrderNextStep>? steps,
    Object? selected = _keep,
    Object? stockIssue = _keep,
    Object? previewStatus = _keep,
    bool? sending,
    Object? sendError = _keep,
    Map<int, String>? lineErrors,
  }) =>
      OrderStatusChangeState(
        status: status ?? this.status,
        steps: steps ?? this.steps,
        selected: identical(selected, _keep) ? this.selected : selected as String?,
        stockIssue: identical(stockIssue, _keep) ? this.stockIssue : stockIssue as OrderStockIssueView?,
        previewStatus:
            identical(previewStatus, _keep) ? this.previewStatus : previewStatus as OrderStatusChangeStatus?,
        sending: sending ?? this.sending,
        sendError: identical(sendError, _keep) ? this.sendError : sendError as String?,
        lineErrors: lineErrors ?? this.lineErrors,
      );

  @override
  List<Object?> get props => [status, steps, selected, stockIssue, previewStatus, sending, sendError, lineErrors];
}
