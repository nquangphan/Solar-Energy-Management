// hand-authored — Audit log (Story 8.5). Every read goes through the injected
// [AuditLogsPort]; nothing here interprets a record — the backend sends the label
// and the flat before → after rows.
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/audit_logs_port.dart';
import 'audit_log_state.dart';

/// Fallback when a failure carries no sentence of its own.
const String kAuditLogLoadError = 'Không tải được nhật ký Audit.';

final RegExp _plainDate = RegExp(r'^\d{4}-\d{2}-\d{2}$');

class AuditLogCubit extends Cubit<AuditLogState> {
  AuditLogCubit(this._port) : super(const AuditLogState());

  final AuditLogsPort _port;

  /// Overlapping requests (quick filter changes): only the latest may paint.
  int _ticket = 0;

  /// Reads the current filters and page again (first load, Thử lại).
  Future<void> load() =>
      _fetch(state.targetType, state.from, state.to, state.page);

  /// Any filter change returns to page 1 — page 3 of the old result set means nothing.
  Future<void> selectTarget(AuditTargetType? targetType) =>
      _fetch(targetType, state.from, state.to, 1);

  /// [text] as typed: a full `YYYY-MM-DD` filters, an empty field clears the end,
  /// anything in between (still typing) changes nothing.
  Future<void> setFrom(String text) async {
    final ({String? day})? parsed = _parseDay(text);
    if (parsed == null || parsed.day == state.from) return;
    await _fetch(state.targetType, parsed.day, state.to, 1);
  }

  Future<void> setTo(String text) async {
    final ({String? day})? parsed = _parseDay(text);
    if (parsed == null || parsed.day == state.to) return;
    await _fetch(state.targetType, state.from, parsed.day, 1);
  }

  Future<void> goToPage(int page) =>
      _fetch(state.targetType, state.from, state.to, page);

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
    AuditTargetType? targetType,
    String? from,
    String? to,
    int page,
  ) async {
    final int ticket = ++_ticket;
    emit(
      AuditLogState(
        status: AuditLogStatus.loading,
        targetType: targetType,
        from: from,
        to: to,
        page: page,
        items: state.items,
        total: state.total,
        pageSize: state.pageSize,
        errorMessage: state.errorMessage,
      ),
    );
    try {
      final AuditLogPage result = await _port.listAuditLogs(
        targetType: targetType,
        from: from,
        to: to,
        page: page,
      );
      if (isClosed || ticket != _ticket) return;
      emit(
        AuditLogState(
          status: AuditLogStatus.ready,
          targetType: state.targetType,
          from: state.from,
          to: state.to,
          page: state.page,
          items: result.items,
          total: result.total.toInt(),
          pageSize: result.pageSize.toInt(),
        ),
      );
    } catch (e) {
      if (isClosed || ticket != _ticket) return;
      emit(
        AuditLogState(
          status: AuditLogStatus.error,
          targetType: state.targetType,
          from: state.from,
          to: state.to,
          page: state.page,
          items: state.items,
          total: state.total,
          pageSize: state.pageSize,
          errorMessage: e is AuditLogsPortException && e.message.isNotEmpty
              ? e.message
              : kAuditLogLoadError,
        ),
      );
    }
  }
}
