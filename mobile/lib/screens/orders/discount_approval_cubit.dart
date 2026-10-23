// hand-authored — Duyệt chiết khấu (Story 11.3, moved out of DiscountApprovalScreen's State).
// The list and the decision go through the injected [OrdersPort]; every number
// on the screen is the backend's (AD-10/16). A failed decision only sets the
// banner — the list and the selection stay (invariant k).

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/orders_port.dart';
import 'discount_approval_state.dart';

class DiscountApprovalCubit extends Cubit<DiscountApprovalState> {
  DiscountApprovalCubit(this._ordersPort) : super(const DiscountApprovalState());

  final OrdersPort _ordersPort;

  Future<void> load() async {
    emit(state.copyWith(status: DiscountApprovalStatus.loading));
    try {
      final List<DiscountPendingItem> fresh = await _ordersPort.listPendingDiscounts();
      if (isClosed) return;
      emit(state.copyWith(items: fresh, status: DiscountApprovalStatus.ready));
    } catch (_) {
      if (isClosed) return;
      emit(state.copyWith(status: DiscountApprovalStatus.error));
    }
  }

  /// Opening an item clears the reason error; the banner of a failed decision stays.
  void select(DiscountPendingItem item) => emit(state.copyWith(selected: item, reasonError: null));

  /// A rejection with an empty reason is blocked here, before any request.
  void requireReason() => emit(state.copyWith(reasonError: 'Lý do là bắt buộc khi từ chối chiết khấu.'));

  void clearReasonError() => emit(state.copyWith(reasonError: null));

  /// Sends the decision (FR-18) — the backend changes the status, records it and
  /// publishes the event; the cubit drops the selection and reloads the list. True
  /// when the backend accepted it. [reasonText] goes out untouched (an empty one is
  /// absent). Failure ⇒ only the banner changes.
  Future<bool> resolve(bool approve, String reasonText) async {
    final DiscountPendingItem? selected = state.selected;
    if (selected == null) return false;
    emit(state.copyWith(resolveBusy: true));
    try {
      await _ordersPort.resolveDiscount(
        selected.orderId,
        ResolveDiscountInput(
          approve: approve,
          reason: reasonText.isNotEmpty ? reasonText : null,
        ),
      );
      if (isClosed) return false;
      emit(state.copyWith(selected: null, reasonError: null, error: null));
      await load();
      return true;
    } catch (err) {
      if (isClosed) return false;
      emit(state.copyWith(
        error: err is OrderPortException ? err.message : 'Không thực hiện được. Thử lại.',
      ));
      return false;
    } finally {
      if (!isClosed) emit(state.copyWith(resolveBusy: false));
    }
  }
}
