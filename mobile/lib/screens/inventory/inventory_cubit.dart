// hand-authored — Tồn kho (Story 11.4, moved out of InventoryScreen's State).
// The stock is read through the injected [InventoryPort]; every number in it is
// the backend's (AD-2) — nothing here compares, filters or derives a quantity.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/inventory_port.dart';
import 'inventory_state.dart';

class InventoryCubit extends Cubit<InventoryState> {
  InventoryCubit(this._port) : super(const InventoryLoading());

  final InventoryPort _port;

  /// No ticket, as before the move: two overlapping reads let the later answer
  /// win (TD-75).
  Future<void> load() async {
    emit(const InventoryLoading());
    try {
      final StockList data = await _port.listStock();
      if (isClosed) return;
      emit(InventoryReady(data));
    } catch (_) {
      if (isClosed) return;
      emit(const InventoryError());
    }
  }
}
