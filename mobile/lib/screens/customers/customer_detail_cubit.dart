// hand-authored — Chi tiết khách (Story 11.2, moved out of CustomerDetailScreen's State).
// Reads ONE customer, then the source catalogue, through the injected
// [CustomersPort] — one after the other, never in parallel. Any failure is the
// error phase with Thử lại.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/customers_port.dart';
import 'customer_detail_state.dart';

class CustomerDetailCubit extends Cubit<CustomerDetailState> {
  CustomerDetailCubit(this._port, this._sdt) : super(const CustomerDetailState());

  final CustomersPort _port;

  /// RAW or E.164 — the backend normalises before it reads (AD-9).
  final String _sdt;

  Future<void> load() async {
    emit(state.withStatus(CustomerDetailStatus.loading));
    try {
      final Customer found = await _port.get(_sdt);
      final List<CustomerSource> catalogue = await _port.listSources();
      if (isClosed) return;
      emit(CustomerDetailState(status: CustomerDetailStatus.ready, customer: found, sources: catalogue));
    } catch (_) {
      if (isClosed) return;
      emit(state.withStatus(CustomerDetailStatus.error));
    }
  }
}
