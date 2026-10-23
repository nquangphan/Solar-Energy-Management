// hand-authored — Đơn hàng list state (Story 11.3), held by OrderListCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/orders_port.dart';

/// The "Tất cả" filter: no `status`, no `followUp`.
const String kOrderFilterAll = 'ALL';

/// The "Follow-up" filter: `followUp: true`, no `status`.
const String kOrderFilterFollowUp = 'FOLLOW_UP';

enum OrderListStatus { loading, ready, error }

final class OrderListState extends Equatable {
  const OrderListState({
    this.status = OrderListStatus.loading,
    this.items = const [],
    this.page = 1,
    this.total = 0,
    this.pageSize = 20,
    this.filter = kOrderFilterAll,
  });

  final OrderListStatus status;

  // The backend owns the count and the slicing (AD-1): the state holds only the
  // page it asked for and the total it was told, and never counts rows itself.
  final List<OrderListItem> items;
  final int page;
  final int total;
  final int pageSize;

  /// [kOrderFilterAll], [kOrderFilterFollowUp] or a `StatusKey.name`.
  final String filter;

  @override
  List<Object?> get props => [status, items, page, total, pageSize, filter];
}
