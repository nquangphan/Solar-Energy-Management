// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpWarrantyPort } from '../api/http-warranty-port';
import { envelope, json, setupHarness } from './http-adapter-harness';

describe('HttpWarrantyPort', () => {
  it('lookup sends the raw phone and resolves the computed lines', async () => {
    const body = {
      found: true,
      phone: '+84903176968',
      customer: { phone: '+84903176968', name: 'Nguyễn Văn A', custType: 'CA_NHAN' },
      orders: [
        {
          id: 'ord-1',
          status: 'nghiem_thu',
          confirmedAt: '2026-02-10T00:00:00.000Z',
          lineItems: [
            {
              id: 'l-1',
              name: 'Tấm pin',
              qty: 18,
              unit: 'tấm',
              warrantyMonths: 144,
              warrantyStartAt: '2026-02-10T00:00:00.000Z',
              warrantyEndAt: '2038-02-10T00:00:00.000Z',
              remainingDays: 4224,
              remainingMonths: 138,
              warrantyStatus: 'con_han',
            },
          ],
        },
      ],
    };
    const h = setupHarness(() => json(200, body));
    await expect(new HttpWarrantyPort(h.client).lookup('0903 176 968')).resolves.toEqual(body);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(h.requests[0].url);
    expect(h.requests[0].method).toBe('GET');
    expect(url.pathname).toBe('/orders/warranty-lookup');
    expect(url.searchParams.get('phone')).toBe('0903 176 968');
  });

  it('lookup of an unknown phone resolves found:false (not an error)', async () => {
    const body = { found: false, phone: '+84900000000', customer: null, orders: [] };
    const h = setupHarness(() => json(200, body));
    await expect(new HttpWarrantyPort(h.client).lookup('0900000000')).resolves.toEqual(body);
  });

  it('lookup rejects an invalid phone with the envelope', async () => {
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Số điện thoại không hợp lệ.', [
        { field: 'phone', code: 'INVALID_PHONE', message: 'Số điện thoại không hợp lệ.' },
      ]),
    );
    const error = await new HttpWarrantyPort(h.client).lookup('abc').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Số điện thoại không hợp lệ.',
      fieldErrors: [{ field: 'phone', code: 'INVALID_PHONE', message: 'Số điện thoại không hợp lệ.' }],
    });
  });
});
