// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpCatalogPort } from '../api/http-catalog-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

function product(id: string, name: string, sku: string) {
  return {
    id,
    name,
    sku,
    unit: 'tấm',
    price: 2_450_000,
    costPrice: 1_950_000,
    tracksStock: true,
    priceEditable: false,
    warrantyMonths: 144,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const PRODUCTS = [
  product('p-1', 'Tấm pin JA Solar 580W', 'JAS-580'),
  product('p-2', 'Inverter Sungrow 10kW', 'PIN-INV-10'),
  product('p-3', 'Tủ điện AC', 'AC-01'),
];

describe('HttpCatalogPort', () => {
  it('listProducts narrows by name or SKU and never carries costPrice', async () => {
    const h = setupHarness(() => json(200, PRODUCTS));
    const result = await new HttpCatalogPort(h.client).listProducts('PIN');
    expect(result.map((p) => p.id)).toEqual(['p-1', 'p-2']);
    for (const p of result) expect('costPrice' in p).toBe(false);
    expect(result[0]).toEqual({
      id: 'p-1',
      name: 'Tấm pin JA Solar 580W',
      sku: 'JAS-580',
      unit: 'tấm',
      price: 2_450_000,
      priceEditable: false,
      warrantyMonths: 144,
      isActive: true,
    });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/products');
  });

  it('listProducts without a search returns every product, still without costPrice', async () => {
    const h = setupHarness(() => json(200, PRODUCTS));
    const result = await new HttpCatalogPort(h.client).listProducts();
    expect(result).toHaveLength(3);
    for (const p of result) expect('costPrice' in p).toBe(false);
  });

  it('listProducts rejects 403 as ApiError', async () => {
    const h = setupHarness(() => envelope(403, 'FORBIDDEN', 'Bạn không có quyền.'));
    const error = await new HttpCatalogPort(h.client).listProducts().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Bạn không có quyền.' });
  });

  it('listGroups maps each group to the picker shape', async () => {
    const h = setupHarness(() =>
      json(200, [
        {
          id: 'g-1',
          name: 'Gói 5kW',
          description: null,
          isActive: true,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ]),
    );
    await expect(new HttpCatalogPort(h.client).listGroups()).resolves.toEqual([
      { id: 'g-1', name: 'Gói 5kW', description: null, isActive: true },
    ]);
    expect(target(h.requests[0])).toBe('/product-groups');
  });

  it('getGroup GETs the group by id with its checklist', async () => {
    const item = { productId: 'p-1', name: 'Tấm pin', sku: 'JAS-580', unit: 'tấm', price: 1, isActive: false, displayOrder: 1 };
    const h = setupHarness(() =>
      json(200, {
        id: 'g-1',
        name: 'Gói 5kW',
        description: 'Mái tôn',
        isActive: true,
        items: [item],
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      }),
    );
    await expect(new HttpCatalogPort(h.client).getGroup('g-1')).resolves.toEqual({
      id: 'g-1',
      name: 'Gói 5kW',
      description: 'Mái tôn',
      isActive: true,
      items: [item],
    });
    expect(target(h.requests[0])).toBe('/product-groups/g-1');
  });
});
