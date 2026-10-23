// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpDashboardPort } from '../api/http-dashboard-port';
import { envelope, json, setupHarness } from './http-adapter-harness';

describe('HttpDashboardPort', () => {
  it('getSummary sends the period and resolves the computed summary', async () => {
    const body = {
      period: 'week',
      from: '2026-10-19',
      to: '2026-10-23',
      revenue: null,
      newOrderCount: 5,
      ordersByStatus: [{ status: 'baogia', count: 5 }],
    };
    const h = setupHarness(() => json(200, body));
    await expect(new HttpDashboardPort(h.client).getSummary('week')).resolves.toEqual(body);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(h.requests[0].url);
    expect(h.requests[0].method).toBe('GET');
    expect(url.pathname).toBe('/dashboard/summary');
    expect(url.searchParams.get('period')).toBe('week');
  });

  it('getSummary rejects a 403 with the envelope status', async () => {
    const h = setupHarness(() => envelope(403, 'FORBIDDEN', 'Không có quyền.'));
    const error = await new HttpDashboardPort(h.client).getSummary('month').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
