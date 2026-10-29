// hand-authored — Audit log state (Story 8.5), held by AuditLogCubit.
import 'package:equatable/equatable.dart';

import '../../design_system/session/audit_logs_port.dart';

enum AuditLogStatus { loading, ready, error }

/// One class for every phase: the filters and the page outlive a load or a failure.
final class AuditLogState extends Equatable {
  const AuditLogState({
    this.status = AuditLogStatus.loading,
    this.targetType,
    this.from,
    this.to,
    this.page = 1,
    this.items = const <AuditLogEntry>[],
    this.total = 0,
    this.pageSize = 20,
    this.errorMessage,
  });

  final AuditLogStatus status;

  /// Target-type filter; null = every type.
  final AuditTargetType? targetType;

  /// Vietnam days `YYYY-MM-DD` (both inclusive); null = open end.
  final String? from;
  final String? to;

  /// The page shown (or loading), from 1.
  final int page;

  /// The records of [page], newest first, exactly as the backend sent them.
  final List<AuditLogEntry> items;

  /// Every record matching the filters — the backend counts (AD-1).
  final int total;
  final int pageSize;

  /// The backend's sentence of the last failure.
  final String? errorMessage;

  @override
  List<Object?> get props => [
    status,
    targetType,
    from,
    to,
    page,
    items,
    total,
    pageSize,
    errorMessage,
  ];
}
