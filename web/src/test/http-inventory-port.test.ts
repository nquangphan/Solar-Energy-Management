// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpInventoryPort } from '../api/http-inventory-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const STOCK = {
  items: [
    {
      productId: 'p1',
      name: 'Tấm pin 550W',
      sku: 'PIN-550',
      unit: 'tấm',
      onHand: 10,
      reserved: 12,
      available: -2,
      toPurchase: 2,
      stockStatus: 'am',
    },
  ],
  purchaseList: [{ productId: 'p1', name: 'Tấm pin 550W', unit: 'tấm', toPurchase: 2 }],
};

describe('HttpInventoryPort', () => {
  it('listStock sends the search as `q` and returns the backend figures untouched', async () => {
    const h = setupHarness(() => json(200, STOCK));
    await expect(new HttpInventoryPort(h.client).listStock({ q: 'pin' })).resolves.toEqual(STOCK);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/stock-items?q=pin');
  });

  it('listStock without a search sends no query', async () => {
    const h = setupHarness(() => json(200, STOCK));
    await new HttpInventoryPort(h.client).listStock();
    expect(target(h.requests[0])).toBe('/stock-items');
  });

  it('a 403 envelope is rejected as ApiError', async () => {
    const h = setupHarness(() => envelope(403, 'FORBIDDEN', 'Bạn không có quyền xem tồn kho.'));
    const error = await new HttpInventoryPort(h.client).listStock().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Bạn không có quyền xem tồn kho.' });
  });
});
