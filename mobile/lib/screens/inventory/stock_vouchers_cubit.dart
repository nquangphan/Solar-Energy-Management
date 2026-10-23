// hand-authored — Phiếu kho (Story 11.4, moved out of StockVouchersScreen's State).
// The list and the detail are read through the injected [StockVouchersPort]; the
// tab maps to the backend's filters and the client filters, counts and compares
// nothing (AD-2). The two sheets keep their own in-flight flags (their PopScope
// needs them); the cubit only forwards their port calls.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/inventory_port.dart';
import '../../design_system/session/stock_vouchers_port.dart';
import 'stock_vouchers_state.dart';

class StockVouchersCubit extends Cubit<StockVouchersState> {
  StockVouchersCubit({required StockVouchersPort port, required InventoryPort inventoryPort})
      : _port = port,
        _inventoryPort = inventoryPort,
        super(const StockVouchersState());

  final StockVouchersPort _port;

  /// Product picker source — the same stock list the Tồn kho screen reads.
  final InventoryPort _inventoryPort;

  int _listTicket = 0;

  Future<void> load() async {
    final int ticket = ++_listTicket;
    emit(state.copyWith(status: StockVouchersStatus.loading));
    try {
      // The tab maps to the backend's filters; the client filters nothing itself.
      final StockVoucherList list = switch (state.tab) {
        kVoucherTabStockIn => await _port.listVouchers(type: 'nhap', isReturn: false),
        kVoucherTabStockOut => await _port.listVouchers(type: 'xuat'),
        kVoucherTabReturn => await _port.listVouchers(isReturn: true),
        _ => await _port.listVouchers(),
      };
      if (isClosed || ticket != _listTicket) return;
      emit(state.copyWith(items: list.items, status: StockVouchersStatus.ready));
    } catch (_) {
      if (isClosed || ticket != _listTicket) return;
      emit(state.copyWith(status: StockVouchersStatus.error));
    }
  }

  Future<void> changeTab(String key) async {
    if (key == state.tab) return;
    emit(state.copyWith(tab: key));
    await load();
  }

  /// Opens one voucher. The previous detail stays behind the skeleton; an answer
  /// for a voucher no longer selected is dropped.
  Future<void> select(String id) async {
    emit(state.copyWith(selectedId: id, detailStatus: StockVouchersStatus.loading));
    try {
      final StockVoucherDetail d = await _port.getVoucher(id);
      if (isClosed || state.selectedId != id) return;
      emit(state.copyWith(detail: d, detailStatus: StockVouchersStatus.ready));
    } catch (_) {
      if (isClosed || state.selectedId != id) return;
      emit(state.copyWith(detailStatus: StockVouchersStatus.error));
    }
  }

  /// After a sheet created voucher [id]: re-read the list, then open it. A return
  /// voucher lands on "Tất cả" (same as web) so it is in the list.
  Future<void> showCreated(String id, {required bool fromReturn}) async {
    if (fromReturn && state.tab != kVoucherTabAll) emit(state.copyWith(tab: kVoucherTabAll));
    await load();
    if (isClosed) return;
    await select(id);
  }

  /// The create sheet's product search — the port's error reaches the sheet untouched.
  Future<StockList> searchStock(String q) => _inventoryPort.listStock(q: q);

  /// The create sheet's send — the port's error reaches the sheet untouched.
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input) => _port.createVoucher(input);

  /// The return sheet's send — the port's error reaches the sheet untouched.
  Future<StockVoucherDetail> createReturnVoucher(
    String originId, {
    String? note,
    required List<CreateReturnVoucherLineInput> lines,
  }) =>
      _port.createReturnVoucher(originId, note: note, lines: lines);
}
