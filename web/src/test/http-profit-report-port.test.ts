// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpProfitReportPort } from '../api/http-profit-report-port';
import { DEMO_PROFIT_ROWS, DEMO_PROFIT_TOTALS } from '../design-system/session';
import { envelope, json, setupHarness } from './http-adapter-harness';

describe('HttpProfitReportPort', () => {
  it('getProfitReport sends the grouping and the custom days and resolves the report', async () => {
    const body = {
      groupBy: 'month',
      from: '2026-07-01',
      to: '2026-07-31',
      totals: DEMO_PROFIT_TOTALS,
      rows: DEMO_PROFIT_ROWS.month,
    };
    const h = setupHarness(() => json(200, body));
    await expect(
      new HttpProfitReportPort(h.client).getProfitReport({
        groupBy: 'month',
        period: 'custom',
        from: '2026-07-01',
        to: '2026-07-31',
      }),
    ).resolves.toEqual(body);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(h.requests[0].url);
    expect(h.requests[0].method).toBe('GET');
    expect(url.pathname).toBe('/reports/profit');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      groupBy: 'month',
      period: 'custom',
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('an empty query sends no parameter', async () => {
    const h = setupHarness(() =>
      json(200, { groupBy: 'order', from: '2026-10-01', to: '2026-10-30', totals: DEMO_PROFIT_TOTALS, rows: [] }),
    );
    await new HttpProfitReportPort(h.client).getProfitReport({});
    expect(new URL(h.requests[0].url).search).toBe('');
  });

  it('a 403 rejects with the envelope status; a 400 carries its fieldErrors', async () => {
    const forbidden = setupHarness(() => envelope(403, 'FORBIDDEN', 'Không có quyền.'));
    await expect(new HttpProfitReportPort(forbidden.client).getProfitReport({})).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    const bad = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Chọn ngày cho kỳ tuỳ chọn.', [
        { field: 'to', code: 'REQUIRED', message: 'Chọn ngày cho kỳ tuỳ chọn.' },
      ]),
    );
    const error = await new HttpProfitReportPort(bad.client)
      .getProfitReport({ period: 'custom', from: '2026-07-01' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fieldErrors: [{ field: 'to' }] });
  });
});
