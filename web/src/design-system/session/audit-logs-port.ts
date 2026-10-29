// hand-authored — web audit log port (Story 8.5, mirror Flutter
// mobile/lib/design_system/session/audit_logs_port.dart). The seam between the
// Audit screen and `GET /audit-logs`.
//
// READ ONLY (AD-8): there is no method to change or remove a record. The action
// label and the flat before → after rows arrive computed by the backend (AD-2).
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components, paths } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** One page of the audit log, newest first (`AuditLogListResponseDto`). */
export type AuditLogPage = Schemas['AuditLogListResponseDto'];

/** One immutable record: who, what, target, when, before → after (`AuditLogEntryDto`). */
export type AuditLogEntry = Schemas['AuditLogEntryDto'];

/** One changed field (`AuditChangeDto`); `isMoney` ⇒ render through the money formatter. */
export type AuditChange = Schemas['AuditChangeDto'];

/** Target type filter, page and the Vietnam-day range `from`/`to` (`YYYY-MM-DD`, both inclusive). */
export type AuditLogQuery = NonNullable<paths['/audit-logs']['get']['parameters']['query']>;

/** Injectable transport for the audit screen — a PORT, not an HTTP client. */
export interface AuditLogsPort {
  /** Rejects with the AD-5 error (403 without `audit.read`, 400 on a bad range). */
  listAuditLogs(query: AuditLogQuery): Promise<AuditLogPage>;
}
