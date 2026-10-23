// hand-authored — Danh sách khách (Story 11.2, moved out of CustomerListScreen's State).
// Every query goes to the BACKEND through the injected [CustomersPort] (AD-1/AD-2):
// the client does not filter, sort, count or paginate in memory, and it never
// inspects the phone string the user typed.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/customers_port.dart';
import 'customer_list_state.dart';

class CustomerListCubit extends Cubit<CustomerListState> {
  CustomerListCubit(this._port) : super(const CustomerListState());

  final CustomersPort _port;

  String _q = '';
  String _custType = kAllCustTypes;
  int _page = 1;

  /// Every keystroke starts a query, and the answers do not necessarily come back in
  /// the order they were asked. Without this ticket, a slow reply to `090` can land
  /// AFTER the reply to `0903` and repaint the list with results for a query the user
  /// has already moved past — the rows would simply be wrong, silently.
  int _latest = 0;

  Future<void> load() async {
    final int ticket = ++_latest;
    // Loading keeps the rows already shown; only the phase and the query change.
    emit(CustomerListState(
      items: state.items,
      page: _page,
      total: state.total,
      pageSize: state.pageSize,
      custType: _custType,
      searching: _searching,
    ));
    try {
      // The query goes to the backend untouched — `0903` is matched there against the
      // E.164 key, which is a thing only the backend knows how to do (AD-9).
      final CustomerPage page = await _port.list(
        q: _q.isEmpty ? null : _q,
        custType: _custType == kAllCustTypes ? null : _custType,
        page: _page,
      );
      if (isClosed || ticket != _latest) return;
      emit(CustomerListState(
        status: CustomerListStatus.ready,
        items: page.items,
        page: _page,
        total: page.total.toInt(),
        pageSize: page.pageSize.toInt(),
        custType: _custType,
        searching: _searching,
      ));
    } catch (_) {
      if (isClosed || ticket != _latest) return;
      emit(CustomerListState(
        status: CustomerListStatus.error,
        items: state.items,
        page: _page,
        total: state.total,
        pageSize: state.pageSize,
        custType: _custType,
        searching: _searching,
      ));
    }
  }

  bool get _searching => _q.isNotEmpty || _custType != kAllCustTypes;

  Future<void> search(String q) {
    _q = q;
    return _reloadFromFirstPage();
  }

  Future<void> setCustType(String custType) {
    _custType = custType;
    return _reloadFromFirstPage();
  }

  /// Any change to the query or filter invalidates the page number — page 3 of the
  /// old result set is meaningless against the new one, so every change returns to page 1.
  Future<void> _reloadFromFirstPage() {
    _page = 1;
    return load();
  }

  Future<void> goToPage(int page) {
    _page = page;
    return load();
  }
}
