// hand-authored — mobile audit log port (Story 8.5, mirror web
// web/src/design-system/session/audit-logs-port.ts). The seam between the Audit
// screen and `GET /audit-logs`.
//
// READ ONLY (AD-8): there is no method to change or remove a record. The action
// label and the flat before → after rows arrive computed by the backend (AD-2).
//
// Every data type below is the GENERATED contract type (AD-12).
import '../../api/generated/models/audit_change_dto.dart';
import '../../api/generated/models/audit_log_entry_dto.dart';
import '../../api/generated/models/audit_log_list_response_dto.dart';
import '../../api/generated/models/audit_target_type.dart';

export '../../api/generated/models/audit_target_type.dart';

/// One page of the audit log, newest first.
typedef AuditLogPage = AuditLogListResponseDto;

/// One immutable record: who, what, target, when, before → after.
typedef AuditLogEntry = AuditLogEntryDto;

/// One changed field; `isMoney` ⇒ render through the money formatter.
typedef AuditChange = AuditChangeDto;

class AuditLogsPortException implements Exception {
  const AuditLogsPortException(this.message);

  final String message;

  @override
  String toString() => message;
}

abstract class AuditLogsPort {
  /// [from]/[to] are Vietnam days `YYYY-MM-DD`, both inclusive.
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  });
}
