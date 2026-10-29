// hand-authored — the real ProfitReportPort over the generated client.
import type {
  ProfitReport,
  ProfitReportPort,
  ProfitReportQuery,
} from '../design-system/session/profit-report-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpProfitReportPort implements ProfitReportPort {
  constructor(private readonly client: ApiClient) {}

  async getProfitReport(query: ProfitReportQuery): Promise<ProfitReport> {
    const { data } = await this.client.GET('/reports/profit', {
      params: { query },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
