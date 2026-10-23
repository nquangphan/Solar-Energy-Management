// hand-authored — Chuyển trạng thái (Story 11.3, moved out of OrderStatusChangeScreen's State).
// WHICH STEPS EXIST IS NOT COMPUTED HERE: the lifecycle's `nextSteps` arrive
// already filtered by the backend (AD-2/AD-4), and the picked `event` goes straight
// back to the port — the destination belongs to the transition table (AD-11).
// Photos are XFile handed to the port; R2 is the backend's (AD-3).

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart' show XFile;

import '../../design_system/session/orders_port.dart';
import 'order_status_change_state.dart';
import 'stock_issue_preview.dart' show rowErrors;

class OrderStatusChangeCubit extends Cubit<OrderStatusChangeState> {
  OrderStatusChangeCubit(this._port, this._orderId) : super(const OrderStatusChangeState());

  final OrdersPort _port;
  final String _orderId;

  int _latest = 0;
  int _stockIssueTicket = 0;

  Future<void> load() async {
    final int ticket = ++_latest;
    emit(state.copyWith(status: OrderStatusChangeStatus.loading));
    try {
      final OrderLifecycle lifecycle = await _port.getLifecycle(_orderId);
      // The screen can be popped while the request is in flight.
      if (isClosed || ticket != _latest) return;
      emit(state.copyWith(steps: lifecycle.nextSteps, status: OrderStatusChangeStatus.ready));
      // Preselect only when there is exactly one choice: with two open
      // branches (thi công / giao hàng) a default would make a consequential
      // decision for the user, and both are one tap from committing.
      selectStep(lifecycle.nextSteps.length == 1 ? lifecycle.nextSteps.first.event : null);
    } catch (_) {
      if (isClosed || ticket != _latest) return;
      emit(state.copyWith(status: OrderStatusChangeStatus.error));
    }
  }

  /// Picks a step — everything that belonged to the previous step goes. The
  /// stock-out preview belongs to "Đã giao" only, and the button waits for it:
  /// the button says what will happen.
  void selectStep(String? event) {
    ++_stockIssueTicket;
    emit(state.copyWith(
      selected: event,
      stockIssue: null,
      lineErrors: const <int, String>{},
      sendError: null,
      previewStatus: null,
    ));
    if (event == kEventDelivered) loadPreview();
  }

  /// Loads the "Đã giao" preview; a late answer for a step the user already
  /// left is dropped (ticket). A failure offers a retry, never a silent label.
  Future<void> loadPreview() async {
    final int ticket = ++_stockIssueTicket;
    emit(state.copyWith(previewStatus: OrderStatusChangeStatus.loading));
    try {
      final OrderStockIssueView view = await _port.getStockIssue(_orderId);
      if (isClosed || ticket != _stockIssueTicket) return;
      emit(state.copyWith(stockIssue: view, previewStatus: OrderStatusChangeStatus.ready));
    } catch (_) {
      if (isClosed || ticket != _stockIssueTicket) return;
      emit(state.copyWith(previewStatus: OrderStatusChangeStatus.error));
    }
  }

  /// Sends the picked step with [files] in order. The committed status (`''` when
  /// the backend named none), or null when nothing was picked, the backend refused
  /// (its words are then in the state) or the screen is already gone.
  Future<String?> submit(List<XFile> files) async {
    final String? selected = state.selected;
    if (selected == null) return null;
    emit(state.copyWith(sending: true, sendError: null, lineErrors: const <int, String>{}));
    try {
      final StatusChangeResult result = await _port.transition(_orderId, selected, files);
      if (isClosed) return null;
      emit(state.copyWith(sending: false));
      return result.status.json ?? '';
    } catch (error) {
      if (isClosed) return null;
      emit(state.copyWith(
        sending: false,
        // The backend owns the status/permission rules, so it owns the words for
        // them: its message is rendered verbatim. The fallback is for transport
        // failures the backend never saw.
        sendError: error is OrderPortException ? error.message : 'Không chuyển được trạng thái.',
        lineErrors: rowErrors(error),
      ));
      // The refusal may be about stock that moved since the preview was read —
      // show the current numbers next to the backend's row messages.
      if (selected == kEventDelivered) loadPreview();
      return null;
    }
  }
}
