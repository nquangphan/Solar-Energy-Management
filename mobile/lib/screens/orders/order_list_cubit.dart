// hand-authored — Đơn hàng list (Story 11.3, moved out of OrderListScreen's State).
// Every query goes to the BACKEND through the injected [OrdersPort] (AD-1/AD-2):
// the client does not filter, count or paginate in memory, and it sends no scope
// parameter — "all orders" vs "my orders" is a permission resolved server-side.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/orders_port.dart';
import 'order_list_state.dart';

class OrderListCubit extends Cubit<OrderListState> {
  OrderListCubit(this._port) : super(const OrderListState());

  final OrdersPort _port;

  String _filter = kOrderFilterAll;
  int _page = 1;

  /// Answers do not necessarily come back in the order they were asked. Without
  /// this ticket, a slow reply to an earlier filter can land AFTER the reply to
  /// the current one and repaint the list with rows the user already moved past
  /// — they would simply be wrong, silently.
  int _latest = 0;

  Future<void> load() async {
    final int ticket = ++_latest;
    // Loading keeps the rows already shown; only the phase and the query change.
    emit(OrderListState(
      items: state.items,
      page: _page,
      total: state.total,
      pageSize: state.pageSize,
      filter: _filter,
    ));
    try {
      // `followUp` and `status` are mutually exclusive — the filter row picks
      // exactly one of the three shapes, so the two never travel together.
      final OrderPage page = await _port.list(
        followUp: _filter == kOrderFilterFollowUp ? true : null,
        status: (_filter == kOrderFilterAll || _filter == kOrderFilterFollowUp) ? null : _filter,
        page: _page,
      );
      if (isClosed || ticket != _latest) return;
      emit(OrderListState(
        status: OrderListStatus.ready,
        items: page.items,
        page: _page,
        total: page.total.toInt(),
        pageSize: page.pageSize.toInt(),
        filter: _filter,
      ));
    } catch (_) {
      if (isClosed || ticket != _latest) return;
      emit(OrderListState(
        status: OrderListStatus.error,
        items: state.items,
        page: _page,
        total: state.total,
        pageSize: state.pageSize,
        filter: _filter,
      ));
    }
  }

  Future<void> setFilter(String filter) {
    _filter = filter;
    return _reloadFromFirstPage();
  }

  /// Any filter change invalidates the page number — page 3 of the old result set
  /// is meaningless against the new one, so every change returns to page 1.
  Future<void> _reloadFromFirstPage() {
    _page = 1;
    return load();
  }

  Future<void> goToPage(int page) {
    _page = page;
    return load();
  }
}
