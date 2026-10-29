// hand-authored — the real AuditLogsPort over the generated client (Story 8.5).
import type { AuditLogPage, AuditLogQuery, AuditLogsPort } from '../design-system/session/audit-logs-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpAuditLogsPort implements AuditLogsPort {
  constructor(private readonly client: ApiClient) {}

  async listAuditLogs(query: AuditLogQuery): Promise<AuditLogPage> {
    const { data } = await this.client.GET('/audit-logs', {
      params: { query },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
