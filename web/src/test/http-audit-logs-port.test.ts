// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpAuditLogsPort } from '../api/http-audit-logs-port';
import { envelope, json, setupHarness } from './http-adapter-harness';

describe('HttpAuditLogsPort', () => {
  it('listAuditLogs sends the filter, range and page and resolves the page', async () => {
    const body = {
      items: [
        {
          id: 'log-1',
          eventType: 'OrderConfirmed',
          eventLabel: 'Chốt đơn',
          actorAccountId: null,
          actorDisplayName: null,
          targetType: 'Order',
          targetId: 'ord-1',
          occurredAt: '2026-10-30T03:00:00.000Z',
          changes: [
            {
              field: 'status',
              before: 'baogia',
              after: 'dachot',
              isMoney: false,
            },
          ],
        },
      ],
      total: 1,
      page: 2,
      pageSize: 20,
    };
    const h = setupHarness(() => json(200, body));
    await expect(
      new HttpAuditLogsPort(h.client).listAuditLogs({
        targetType: 'Order',
        from: '2026-10-01',
        to: '2026-10-30',
        page: 2,
      }),
    ).resolves.toEqual(body);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(h.requests[0].url);
    expect(h.requests[0].method).toBe('GET');
    expect(url.pathname).toBe('/audit-logs');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      targetType: 'Order',
      from: '2026-10-01',
      to: '2026-10-30',
      page: '2',
    });
  });

  it('an empty query sends no parameter', async () => {
    const h = setupHarness(() => json(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    await new HttpAuditLogsPort(h.client).listAuditLogs({});
    expect(new URL(h.requests[0].url).search).toBe('');
  });

  it('a 403 rejects with the envelope status; a 400 carries its fieldErrors', async () => {
    const forbidden = setupHarness(() => envelope(403, 'FORBIDDEN', 'Không có quyền.'));
    await expect(new HttpAuditLogsPort(forbidden.client).listAuditLogs({})).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    const bad = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.', [
        {
          field: 'to',
          code: 'INVALID_DATE_RANGE',
          message: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
        },
      ]),
    );
    const error = await new HttpAuditLogsPort(bad.client)
      .listAuditLogs({ from: '2026-10-06', to: '2026-10-05' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      fieldErrors: [{ field: 'to' }],
    });
  });
});
