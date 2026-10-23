// hand-authored — Trang chủ (Story 8.1). Every read goes through the injected
// [DashboardPort]; nothing here computes a figure — the backend sends them.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/dashboard_port.dart';
import 'dashboard_state.dart';

class DashboardCubit extends Cubit<DashboardState> {
  DashboardCubit(this._port) : super(const DashboardState());

  final DashboardPort _port;

  /// Switching period quickly sends overlapping requests; only the latest may paint.
  int _ticket = 0;

  /// Reads the current period again (first load, Thử lại, tab tapped again).
  Future<void> load() => _fetch(state.period);

  Future<void> selectPeriod(DashboardPeriod period) => _fetch(period);

  Future<void> _fetch(DashboardPeriod period) async {
    final int ticket = ++_ticket;
    emit(
      DashboardState(
        period: period,
        status: DashboardStatus.loading,
        summary: state.summary,
      ),
    );
    try {
      final DashboardSummary summary = await _port.getSummary(period);
      if (isClosed || ticket != _ticket) return;
      emit(
        DashboardState(
          period: state.period,
          status: DashboardStatus.ready,
          summary: summary,
        ),
      );
    } catch (e) {
      if (isClosed || ticket != _ticket) return;
      final bool forbidden = e is DashboardPortException && e.forbidden;
      emit(
        DashboardState(
          period: state.period,
          status: forbidden ? DashboardStatus.forbidden : DashboardStatus.error,
          summary: state.summary,
        ),
      );
    }
  }
}
