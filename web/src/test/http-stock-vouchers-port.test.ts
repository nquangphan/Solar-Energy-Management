// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpStockVouchersPort } from '../api/http-stock-vouchers-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const DETAIL = {
  id: 'pk1',
  code: 'PK-N-0119',
  type: 'nhap',
  createdAt: '2026-10-01T00:00:00.000Z',
  createdBy: { id: 'acc-kho', displayName: 'Kho Bình' },
  lineCount: 1,
  totalQty: 10,
  note: null,
  lines: [{ productId: 'p1', name: 'Tấm pin 550W', sku: 'PIN-550', unit: 'tấm', qty: 10, unitCost: 2_000_000 }],
  canReturn: false,
};

async function bodyOf(request: Request): Promise<unknown> {
  return JSON.parse(await request.text());
}

describe('HttpStockVouchersPort', () => {
  it('listVouchers sends `type` and `isReturn` as the generated query types', async () => {
    const list = { items: [] };
    const h = setupHarness(() => json(200, list));
    await expect(new HttpStockVouchersPort(h.client).listVouchers({ type: 'xuat', isReturn: false })).resolves.toEqual(list);
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/stock-vouchers?type=xuat&isReturn=false');
  });

  it('getVoucher GETs one voucher by id', async () => {
    const h = setupHarness(() => json(200, DETAIL));
    await expect(new HttpStockVouchersPort(h.client).getVoucher('pk1')).resolves.toEqual(DETAIL);
    expect(target(h.requests[0])).toBe('/stock-vouchers/pk1');
  });

  it('createVoucher POSTs the voucher as given', async () => {
    const h = setupHarness(() => json(201, DETAIL));
    const input = { type: 'nhap' as const, note: 'Nhập đợt 1', lines: [{ productId: 'p1', qty: 10, unitCost: 2_000_000 }] };
    await expect(new HttpStockVouchersPort(h.client).createVoucher(input)).resolves.toEqual(DETAIL);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/stock-vouchers');
    expect(await bodyOf(h.requests[0])).toEqual(input);
  });

  it('createReturnVoucher POSTs to the origin voucher, without any cost', async () => {
    const h = setupHarness(() => json(201, { ...DETAIL, id: 'pk2', code: 'PK-NT-0001' }));
    const input = { lines: [{ productId: 'p1', qty: 2 }] };
    await new HttpStockVouchersPort(h.client).createReturnVoucher('pk1', input);
    expect(target(h.requests[0])).toBe('/stock-vouchers/pk1/return');
    expect(await bodyOf(h.requests[0])).toEqual(input);
  });

  it('a 409 (not enough stock) is rejected with its line field error', async () => {
    const h = setupHarness(() =>
      envelope(409, 'CONFLICT', 'Không đủ tồn.', [{ field: 'lines.0.qty', code: 'INSUFFICIENT_STOCK', message: 'Còn 3.' }]),
    );
    const error = await new HttpStockVouchersPort(h.client)
      .createVoucher({ type: 'xuat', lines: [{ productId: 'p1', qty: 5 }] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Không đủ tồn.',
      fieldErrors: [{ field: 'lines.0.qty', code: 'INSUFFICIENT_STOCK', message: 'Còn 3.' }],
    });
  });
});
