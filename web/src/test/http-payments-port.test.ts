// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpPaymentsPort } from '../api/http-payments-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const SCHEDULE = {
  orderId: 'o1',
  configured: true,
  editable: true,
  orderTotal: 83_010_960,
  scheduledTotal: 83_010_960,
  difference: 0,
  totalMatches: true,
  paidTotal: 0,
  remainingTotal: 83_010_960,
  paidPercent: 0,
  paymentStatus: 'unpaid',
  recordable: true,
  installments: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
};
const KEY = '3b241101-e2bb-4255-8caf-4136c566a962';
const RESULT = {
  payment: { id: 'pay1', installmentId: 'i1', amount: 16_602_192, paidOn: '2026-10-01', method: 'cash', note: null, recordedAt: '2026-10-01T00:00:00.000Z' },
  schedule: SCHEDULE,
  orderStatus: 'dacoc',
  autoTransition: { event: 'du_coc', outcome: 'applied', message: null },
};
const INPUT = { idempotencyKey: KEY, installmentId: 'i1', amount: 16_602_192, paidOn: '2026-10-01', method: 'cash' as const };

describe('HttpPaymentsPort', () => {
  it('getSchedule GETs the schedule of the order', async () => {
    const h = setupHarness(() => json(200, SCHEDULE));
    await expect(new HttpPaymentsPort(h.client).getSchedule('o1')).resolves.toEqual(SCHEDULE);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/orders/o1/payment-schedule');
  });

  it('replaceSchedule PUTs the installments as typed (a blank is absent, never 0)', async () => {
    const h = setupHarness(() => json(200, SCHEDULE));
    const input = { installments: [{ percent: 20, conditionNote: 'Cọc' }, { amount: 50_000_000, conditionNote: 'Lắp xong' }] };
    await expect(new HttpPaymentsPort(h.client).replaceSchedule('o1', input)).resolves.toEqual(SCHEDULE);
    expect(h.requests[0].method).toBe('PUT');
    expect(target(h.requests[0])).toBe('/orders/o1/payment-schedule');
    expect(JSON.parse(await h.requests[0].text())).toEqual(input);
  });

  it('recordPayment carries the GIVEN idempotency key byte for byte in the body, never in a header', async () => {
    const h = setupHarness(() => json(200, RESULT));
    await expect(new HttpPaymentsPort(h.client).recordPayment('o1', INPUT)).resolves.toEqual(RESULT);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    const request = h.requests[0];
    expect(request.method).toBe('POST');
    expect(target(request)).toBe('/orders/o1/payments');
    expect(JSON.parse(await request.text())).toEqual(INPUT);
    expect([...request.headers.keys()].filter((k) => /idempotency/i.test(k))).toEqual([]);
  });

  it('a retry with the same input sends the same key again (the backend replays it)', async () => {
    const h = setupHarness(() => json(200, { ...RESULT, autoTransition: null }));
    const port = new HttpPaymentsPort(h.client);
    await port.recordPayment('o1', INPUT);
    await port.recordPayment('o1', INPUT);
    expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    const keys = await Promise.all(h.requests.map(async (r) => (JSON.parse(await r.text()) as { idempotencyKey: string }).idempotencyKey));
    expect(keys).toEqual([KEY, KEY]);
  });

  it('a blank amount stays ABSENT from the body and the 400 names `amount`', async () => {
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', [{ field: 'amount', code: 'isInt', message: 'Phải là số nguyên.' }]),
    );
    const { amount: _blank, ...withoutAmount } = INPUT;
    const error = await new HttpPaymentsPort(h.client).recordPayment('o1', withoutAmount).catch((e: unknown) => e);
    const sent = JSON.parse(await h.requests[0].text()) as Record<string, unknown>;
    expect(Object.hasOwn(sent, 'amount')).toBe(false);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: [{ field: 'amount', code: 'isInt', message: 'Phải là số nguyên.' }],
    });
  });
});
