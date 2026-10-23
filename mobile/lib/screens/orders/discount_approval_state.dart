// hand-authored — Duyệt chiết khấu state (Story 11.3), held by DiscountApprovalCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/orders_port.dart';

enum DiscountApprovalStatus { loading, ready, error }

/// "Leave this field as it is" for the nullable fields of [DiscountApprovalState.copyWith].
const Object _keep = Object();

final class DiscountApprovalState extends Equatable {
  const DiscountApprovalState({
    this.status = DiscountApprovalStatus.loading,
    this.items = const [],
    this.selected,
    this.error,
    this.reasonError,
    this.resolveBusy = false,
  });

  final DiscountApprovalStatus status;

  /// The orders awaiting approval, every number backend-computed (AD-16).
  final List<DiscountPendingItem> items;

  /// The item shown in detail — null ⇒ only the list.
  final DiscountPendingItem? selected;

  /// The decision's failure, shown in the banner; the list and the selection stay.
  final String? error;

  /// A rejection without a reason, blocked before any request.
  final String? reasonError;

  final bool resolveBusy;

  DiscountApprovalState copyWith({
    DiscountApprovalStatus? status,
    List<DiscountPendingItem>? items,
    Object? selected = _keep,
    Object? error = _keep,
    Object? reasonError = _keep,
    bool? resolveBusy,
  }) =>
      DiscountApprovalState(
        status: status ?? this.status,
        items: items ?? this.items,
        selected: identical(selected, _keep) ? this.selected : selected as DiscountPendingItem?,
        error: identical(error, _keep) ? this.error : error as String?,
        reasonError: identical(reasonError, _keep) ? this.reasonError : reasonError as String?,
        resolveBusy: resolveBusy ?? this.resolveBusy,
      );

  @override
  List<Object?> get props => [status, items, selected, error, reasonError, resolveBusy];
}
