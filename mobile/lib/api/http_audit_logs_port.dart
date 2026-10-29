// hand-authored — the real AuditLogsPort over the generated client (Story 8.5,
// mirror web/src/api/http-audit-logs-port.ts). A rejection reaches the cubit as
// AuditLogsPortException carrying the backend's sentence.
import '../design_system/session/audit_logs_port.dart';
import 'api_error.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpAuditLogsPort implements AuditLogsPort {
  HttpAuditLogsPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  }) async {
    try {
      return await _transport.call(
        () => _client.audit.auditControllerList(
          targetType: targetType,
          from: from,
          to: to,
          page: page,
        ),
      );
    } on ApiError catch (e) {
      throw AuditLogsPortException(e.message);
    }
  }
}
