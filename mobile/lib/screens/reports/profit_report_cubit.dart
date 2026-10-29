// hand-authored — profit report cubit. Every read goes through the
// injected [ProfitReportPort]; nothing here computes a figure — the backend sends
// revenue, cost, gross profit, margin and the row labels.
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/profit_report_port.dart';
import 'profit_report_state.dart';

/// Fallback when a failure carries no sentence of its own.
const String kProfitReportLoadError = 'Không tải được báo cáo lợi nhuận.';

/// Same sentence as the backend's `fieldErrors.to` for this case.
const String kProfitReversedDates =
    'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';

final RegExp _plainDate = RegExp(r'^\d{4}-\d{2}-\d{2}$');

class ProfitReportCubit extends Cubit<ProfitReportState> {
  ProfitReportCubit(this._port) : super(const ProfitReportState());

  final ProfitReportPort _port;

  /// Overlapping requests (quick switches): only the latest may paint.
  int _ticket = 0;

  /// Reads the current grouping and period again (first load, Thử lại).
  Future<void> load() =>
      _fetch(state.groupBy, state.period, state.from, state.to);

  Future<void> selectGroupBy(ProfitGroupBy groupBy) =>
      _fetch(groupBy, state.period, state.from, state.to);

  Future<void> selectPeriod(ProfitPeriod period) =>
      _fetch(state.groupBy, period, state.from, state.to);

  /// [text] as typed: a full real `YYYY-MM-DD` sets the day, an empty field
  /// clears it, anything in between (still typing) changes nothing.
  Future<void> setFrom(String text) async {
    final ({String? day})? parsed = _parseDay(text);
    if (parsed == null || parsed.day == state.from) return;
    await _fetch(state.groupBy, state.period, parsed.day, state.to);
  }

  Future<void> setTo(String text) async {
    final ({String? day})? parsed = _parseDay(text);
    if (parsed == null || parsed.day == state.to) return;
    await _fetch(state.groupBy, state.period, state.from, parsed.day);
  }

  /// null while still typing — or a day that does not exist (2026-13-01,
  /// 2026-02-30), which the backend would only refuse; otherwise the day, or
  /// `day: null` for an empty field.
  static ({String? day})? _parseDay(String text) {
    final String t = text.trim();
    if (t.isEmpty) return (day: null);
    if (!_plainDate.hasMatch(t)) return null;
    // DateTime.parse rolls an impossible day over (02-30 → 03-02): a real day
    // prints back exactly as typed.
    final DateTime? day = DateTime.tryParse(t);
    if (day == null || day.toIso8601String().substring(0, 10) != t) {
      return null;
    }
    return (day: t);
  }

  Future<void> _fetch(
    ProfitGroupBy groupBy,
    ProfitPeriod period,
    String? from,
    String? to,
  ) async {
    final int ticket = ++_ticket;
    final bool custom = period == ProfitPeriod.custom;
    // Plain `YYYY-MM-DD` strings compare in calendar order.
    final bool missing = from == null || to == null;
    if (custom && (missing || from.compareTo(to) > 0)) {
      emit(
        ProfitReportState(
          status: missing
              ? ProfitReportStatus.awaitingDates
              : ProfitReportStatus.reversedDates,
          groupBy: groupBy,
          period: period,
          from: from,
          to: to,
          report: state.report,
          errorMessage: state.errorMessage,
        ),
      );
      return;
    }
    emit(
      ProfitReportState(
        status: ProfitReportStatus.loading,
        groupBy: groupBy,
        period: period,
        from: from,
        to: to,
        report: state.report,
        errorMessage: state.errorMessage,
      ),
    );
    try {
      final ProfitReport result = await _port.getProfitReport(
        groupBy: groupBy,
        period: period,
        from: custom ? from : null,
        to: custom ? to : null,
      );
      if (isClosed || ticket != _ticket) return;
      emit(
        ProfitReportState(
          status: ProfitReportStatus.ready,
          groupBy: state.groupBy,
          period: state.period,
          from: state.from,
          to: state.to,
          report: result,
        ),
      );
    } catch (e) {
      if (isClosed || ticket != _ticket) return;
      emit(
        ProfitReportState(
          status: ProfitReportStatus.error,
          groupBy: state.groupBy,
          period: state.period,
          from: state.from,
          to: state.to,
          report: state.report,
          errorMessage: e is ProfitReportPortException && e.message.isNotEmpty
              ? e.message
              : kProfitReportLoadError,
        ),
      );
    }
  }
}
