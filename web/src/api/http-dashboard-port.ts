// hand-authored — the real DashboardPort over the generated client (Story 8.1).
import type {
  DashboardPeriod,
  DashboardPort,
  DashboardSummary,
} from '../design-system/session/dashboard-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpDashboardPort implements DashboardPort {
  constructor(private readonly client: ApiClient) {}

  async getSummary(period: DashboardPeriod): Promise<DashboardSummary> {
    const { data } = await this.client.GET('/dashboard/summary', { params: { query: { period } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
