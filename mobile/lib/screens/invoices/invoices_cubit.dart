// hand-authored — Hoá đơn bán hàng (Story 11.4, moved out of InvoicesScreen's State).
// Every read and write goes through the injected [InvoicesPort]. Nothing here
// computes money — the overview arrives computed by the backend.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/invoices_port.dart';
import 'invoices_state.dart';

const String _kUnknownError = 'Không tạo được hoá đơn. Vui lòng thử lại.';

class InvoicesCubit extends Cubit<InvoicesState> {
  InvoicesCubit(this._port, this._orderId) : super(const InvoicesState());

  final InvoicesPort _port;
  final String _orderId;

  int _ticket = 0;

  /// [showSkeleton] false = a refresh behind the overview already on screen: a
  /// failure keeps the last good view.
  Future<void> load({bool showSkeleton = true}) async {
    final int ticket = ++_ticket;
    if (showSkeleton) emit(state.copyWith(status: InvoicesStatus.loading));
    try {
      final InvoicesOverview o = await _port.getOverview(_orderId);
      if (isClosed || ticket != _ticket) return;
      emit(state.copyWith(overview: o, status: InvoicesStatus.ready));
    } catch (_) {
      if (isClosed || ticket != _ticket) return;
      // A failed silent refresh keeps the last good view.
      if (showSkeleton || state.overview == null) {
        emit(state.copyWith(status: InvoicesStatus.error));
      }
    }
  }

  /// One call at a time; a failure becomes a banner with the server message
  /// verbatim, then the overview is reloaded.
  Future<void> create() async {
    if (state.busy) return;
    emit(state.copyWith(busy: true, error: null));
    try {
      await _port.createInvoice(_orderId);
    } catch (e) {
      if (!isClosed) {
        emit(state.copyWith(error: e is InvoicesPortError ? e.message : _kUnknownError));
      }
    } finally {
      // Still busy while reloading: the button must not come back before the
      // overview says whether the version now has its invoice.
      if (!isClosed) await load(showSkeleton: false);
      if (!isClosed) {
        // A lost response (fallback, not a server refusal) whose invoice was in
        // fact created: the reload shows it, so the "could not create" banner
        // would contradict the screen.
        final bool created = state.error == _kUnknownError && state.overview?.currentInvoiceId != null;
        emit(created ? state.copyWith(busy: false, error: null) : state.copyWith(busy: false));
      }
    }
  }
}
