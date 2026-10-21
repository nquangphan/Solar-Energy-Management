import type { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import { tinhGiaVonBinhQuan } from '../src/inventory/domain/gia-von';
import { StockVoucherCreated } from '../src/inventory/domain/stock-voucher-events';
import {
  StockVouchersService,
  type CreateReturnVoucherInput,
} from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Return voucher from a cancelled order's stock-out (mock Prisma). Guards what the DB lane
 * cannot isolate: op order (origin read, `products` lock, re-checks AFTER the lock, writes),
 * the line cost taken from the ORIGIN line (never today's `costPrice`), every refusal writing
 * and publishing nothing, exactly one `StockVoucherCreated` AFTER commit, and no ledger write.
 */
describe('StockVouchersService.createReturnVoucher', () => {
  const ACTOR = 'acc-kho';
  const ORIGIN = 'vx-1';
  const ORDER = 'ord-1';
  const P1 = '11111111-1111-4111-8111-111111111111';
  const P2 = '22222222-2222-4222-8222-222222222222';
  const P3 = '33333333-3333-4333-8333-333333333333';

  const calls: string[] = [];
  function recorded<T>(name: string, result: T): jest.Mock {
    return jest.fn(() => {
      calls.push(name);
      return Promise.resolve(result);
    });
  }

  function originRow(
    o: {
      type?: string;
      orderId?: string | null;
      returnOfVoucherId?: string | null;
      lines?: { productId: string; qty: number; unitCost: number }[];
    } = {},
  ) {
    return {
      id: ORIGIN,
      seq: 96,
      type: o.type ?? 'xuat',
      orderId: o.orderId === undefined ? ORDER : o.orderId,
      returnOfVoucherId: o.returnOfVoucherId ?? null,
      lines: (
        o.lines ?? [
          { productId: P1, qty: 12, unitCost: 1_000_000 },
          { productId: P2, qty: 2, unitCost: 300_000 },
        ]
      ).map((l) => ({ ...l, product: { unit: 'tấm' } })),
    };
  }

  function product(
    id: string,
    o: {
      onHand?: number;
      costPrice?: number;
      tracksStock?: boolean;
      isActive?: boolean;
    } = {},
  ) {
    return {
      id,
      name: `SP ${id.slice(0, 2)}`,
      unit: 'tấm',
      costPrice: o.costPrice ?? 1_200_000,
      tracksStock: o.tracksStock ?? true,
      isActive: o.isActive ?? true,
      stockItem: { id: `s-${id}`, productId: id, onHand: o.onHand ?? 8 },
    };
  }

  let tx: {
    $queryRaw: jest.Mock;
    stockVoucher: { findUnique: jest.Mock; create: jest.Mock };
    order: { findUnique: jest.Mock };
    product: { findMany: jest.Mock; update: jest.Mock };
    stockItem: { upsert: jest.Mock };
    stockMovement: { create: jest.Mock };
  };
  let commitError: Error | null;
  const prisma = { $transaction: jest.fn() };
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = new StockVouchersService(
    prisma as unknown as PrismaService,
    eventBus as unknown as EventBus,
  );

  function given(
    o: {
      origin?: ReturnType<typeof originRow> | null;
      existingReturn?: { seq: number; type: string } | null;
      orderStatus?: string;
      products?: ReturnType<typeof product>[];
    } = {},
  ) {
    const origin = o.origin === undefined ? originRow() : o.origin;
    tx.stockVoucher.findUnique = jest.fn(
      (args: { where: { id?: string; returnOfVoucherId?: string } }) => {
        if (args.where.id !== undefined) {
          calls.push('origin.findUnique');
          return Promise.resolve(origin);
        }
        calls.push('existingReturn.findUnique');
        return Promise.resolve(o.existingReturn ?? null);
      },
    );
    tx.order.findUnique = recorded('order.findUnique', {
      status: o.orderStatus ?? 'huy',
    });
    tx.product.findMany = recorded(
      'product.findMany',
      o.products ?? [product(P1), product(P2)],
    );
  }

  function input(lines: CreateReturnVoucherInput['lines'], note?: string) {
    return { lines, ...(note !== undefined && { note }) };
  }

  async function caught(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (e) {
      return e as AppException;
    }
    throw new Error('expected a rejection');
  }

  function expectNothingWritten(): void {
    expect(tx.stockItem.upsert).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.stockVoucher.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    calls.length = 0;
    commitError = null;
    jest.clearAllMocks();
    tx = {
      $queryRaw: recorded('lock.products', []),
      stockVoucher: {
        findUnique: jest.fn(),
        create: jest.fn(
          (args: {
            data: {
              note: string | null;
              returnOfVoucherId: string;
              lines: {
                create: { productId: string; qty: number; unitCost: number }[];
              };
            };
          }) => {
            calls.push('stockVoucher.create');
            return Promise.resolve({
              id: 'vr-1',
              seq: 4,
              type: 'nhap',
              note: args.data.note,
              orderId: null,
              returnOfVoucherId: args.data.returnOfVoucherId,
              createdAt: new Date('2026-10-21T03:00:00Z'),
              createdBy: { id: ACTOR, displayName: 'Thủ kho' },
              lines: args.data.lines.create.map((l) => ({
                ...l,
                product: { name: 'SP', sku: 'SKU', unit: 'tấm' },
              })),
              order: null,
              returnOf: { id: ORIGIN, seq: 96, type: 'xuat', orderId: ORDER },
              returnVoucher: null,
            });
          },
        ),
      },
      order: { findUnique: jest.fn() },
      product: { findMany: jest.fn(), update: recorded('product.update', {}) },
      stockItem: { upsert: recorded('stockItem.upsert', {}) },
      stockMovement: { create: recorded('stockMovement.create', {}) },
    };
    prisma.$transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => {
        calls.push('tx.begin');
        const result = await fn(tx);
        if (commitError) throw commitError;
        calls.push('tx.commit');
        return result;
      },
    );
    eventBus.publish.mockImplementation(() => {
      calls.push('publish');
      return Promise.resolve();
    });
  });

  it('op order: origin read → products lock (origin set) → already-returned + order status re-checked AFTER the lock → writes → commit → publish', async () => {
    given();

    await service.createReturnVoucher(
      ORIGIN,
      input([{ productId: P1, qty: 12 }]),
      ACTOR,
    );

    expect(calls).toEqual([
      'tx.begin',
      'origin.findUnique',
      'lock.products',
      'existingReturn.findUnique',
      'order.findUnique',
      'product.findMany',
      'stockItem.upsert',
      'product.update',
      'stockVoucher.create',
      'tx.commit',
      'publish',
    ]);
    const sql = (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray)
      .join('?')
      .replace(/\s+/g, ' ')
      .trim();
    expect(sql).toBe(
      'SELECT id FROM products WHERE id = ANY(?) ORDER BY id FOR UPDATE',
    );
    // Locked by the ORIGIN's products, not only the requested lines.
    expect(tx.$queryRaw.mock.calls[0][1]).toEqual([P1, P2]);
    expect(tx.order.findUnique).toHaveBeenCalledWith({
      where: { id: ORDER },
      select: { status: true },
    });
  });

  it('line cost = ORIGIN line cost (not today costPrice); onHand += counted qty; costPrice = weighted average', async () => {
    given({
      products: [
        product(P1, { onHand: 8, costPrice: 1_200_000 }),
        product(P2, { onHand: 0, costPrice: 999 }),
      ],
    });

    const result = await service.createReturnVoucher(
      ORIGIN,
      input(
        [
          { productId: P1, qty: 12 },
          { productId: P2, qty: 2 },
        ],
        '2 tấm nứt',
      ),
      ACTOR,
    );

    const expectedP1Cost = tinhGiaVonBinhQuan({
      onHandTruoc: 8,
      giaVonTruoc: 1_200_000,
      qtyNhap: 12,
      donGiaNhap: 1_000_000,
    });
    expect(expectedP1Cost).not.toBe(1_000_000);
    expect(tx.stockItem.upsert).toHaveBeenNthCalledWith(1, {
      where: { productId: P1 },
      create: { productId: P1, onHand: 20 },
      update: { onHand: 20 },
    });
    expect(tx.product.update).toHaveBeenNthCalledWith(1, {
      where: { id: P1 },
      data: { costPrice: expectedP1Cost },
    });
    // onHand 0 ⇒ the return comes back at exactly the origin cost.
    expect(tx.product.update).toHaveBeenNthCalledWith(2, {
      where: { id: P2 },
      data: { costPrice: 300_000 },
    });
    expect(tx.stockVoucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'nhap',
          note: '2 tấm nứt',
          returnOfVoucherId: ORIGIN,
          createdByAccountId: ACTOR,
          lines: {
            create: [
              { productId: P1, qty: 12, unitCost: 1_000_000 },
              { productId: P2, qty: 2, unitCost: 300_000 },
            ],
          },
        }),
      }),
    );
    // A return voucher carries no order pair of its own.
    const data = tx.stockVoucher.create.mock.calls[0][0].data;
    expect(data.orderId).toBeUndefined();
    expect(data.orderVersionId).toBeUndefined();
    expect(result.ma).toBe('PK-NT-0004');
    expect(result.returnOfVoucherId).toBe(ORIGIN);
    expect(result.returnOf).toEqual({
      id: ORIGIN,
      ma: 'PK-X-0096',
      orderId: ORDER,
    });
    expect(result.orderId).toBeUndefined();
    expect(result.canReturn).toBe(false);
  });

  it('partial return: only the counted lines are written', async () => {
    given();

    const result = await service.createReturnVoucher(
      ORIGIN,
      input([{ productId: P1, qty: 10 }]),
      ACTOR,
    );

    expect(tx.stockItem.upsert).toHaveBeenCalledTimes(1);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      productId: P1,
      qty: 10,
      unitCost: 1_000_000,
    });
  });

  it('a product untracked or deactivated since the issue is still taken back', async () => {
    given({
      products: [
        product(P1, { tracksStock: false, isActive: false }),
        product(P2),
      ],
    });

    await service.createReturnVoucher(
      ORIGIN,
      input([{ productId: P1, qty: 3 }]),
      ACTOR,
    );

    expect(tx.stockItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.stockVoucher.create).toHaveBeenCalledTimes(1);
  });

  it('writes NO stock movement (the hold was released at issue and at cancel)', async () => {
    given();

    await service.createReturnVoucher(
      ORIGIN,
      input([{ productId: P1, qty: 12 }]),
      ACTOR,
    );

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('publishes StockVoucherCreated EXACTLY once AFTER commit, linking the origin and the cancelled order', async () => {
    given({
      products: [product(P1, { onHand: 8, costPrice: 1_200_000 }), product(P2)],
    });

    await service.createReturnVoucher(
      ORIGIN,
      input([{ productId: P1, qty: 12 }], 'ghi chú'),
      ACTOR,
    );

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const event = eventBus.publish.mock.calls[0][0] as StockVoucherCreated;
    expect(event).toBeInstanceOf(StockVoucherCreated);
    expect(event.actorAccountId).toBe(ACTOR);
    expect(event.target).toEqual({ type: 'StockVoucher', id: 'vr-1' });
    expect(event.after).toEqual({
      id: 'vr-1',
      ma: 'PK-NT-0004',
      type: 'nhap',
      note: 'ghi chú',
      returnOfVoucherId: ORIGIN,
      orderId: ORDER,
      lines: [
        {
          productId: P1,
          qty: 12,
          unitCost: 1_000_000,
          onHandTruoc: 8,
          onHandSau: 20,
          giaVonTruoc: 1_200_000,
          giaVonSau: tinhGiaVonBinhQuan({
            onHandTruoc: 8,
            giaVonTruoc: 1_200_000,
            qtyNhap: 12,
            donGiaNhap: 1_000_000,
          }),
        },
      ],
    });
  });

  it('commit fails AFTER the tx body ran ⇒ 0 events', async () => {
    given();
    commitError = new Error('serialization failure');

    await expect(
      service.createReturnVoucher(
        ORIGIN,
        input([{ productId: P1, qty: 1 }]),
        ACTOR,
      ),
    ).rejects.toBe(commitError);

    expect(calls).toContain('stockVoucher.create');
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  describe('refusals — nothing written, nothing published', () => {
    it('origin missing ⇒ 404 before any lock', async () => {
      given({ origin: null });

      const err = await caught(
        service.createReturnVoucher(
          ORIGIN,
          input([{ productId: P1, qty: 1 }]),
          ACTOR,
        ),
      );

      expect(err.getStatus()).toBe(404);
      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(err.message).toBe(`Không tìm thấy phiếu kho: ${ORIGIN}`);
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expectNothingWritten();
    });

    it.each([
      ['a free-standing stock-in', originRow({ type: 'nhap', orderId: null })],
      ['a free-standing stock-out', originRow({ type: 'xuat', orderId: null })],
      // A return voucher is itself a `nhap` without an order pair.
      [
        'a return voucher',
        originRow({ type: 'nhap', orderId: null, returnOfVoucherId: 'vx-0' }),
      ],
    ])('origin is %s ⇒ 409', async (_name, origin) => {
      given({ origin });

      const err = await caught(
        service.createReturnVoucher(
          ORIGIN,
          input([{ productId: P1, qty: 1 }]),
          ACTOR,
        ),
      );

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Chỉ phiếu xuất gắn đơn mới lập được phiếu nhập trả.',
      );
      expectNothingWritten();
    });

    it('already returned (seen AFTER the lock) ⇒ 409 naming the PK-NT voucher', async () => {
      given({ existingReturn: { seq: 4, type: 'nhap' } });

      const err = await caught(
        service.createReturnVoucher(
          ORIGIN,
          input([{ productId: P1, qty: 1 }]),
          ACTOR,
        ),
      );

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Phiếu xuất này đã có phiếu nhập trả PK-NT-0004.',
      );
      expect(calls.indexOf('lock.products')).toBeLessThan(
        calls.indexOf('existingReturn.findUnique'),
      );
      expectNothingWritten();
    });

    it.each(['dachot', 'dacoc', 'dagiao', 'hoanthanh'])(
      'order still %s ⇒ 409',
      async (status) => {
        given({ orderStatus: status });

        const err = await caught(
          service.createReturnVoucher(
            ORIGIN,
            input([{ productId: P1, qty: 1 }]),
            ACTOR,
          ),
        );

        expect(err.getStatus()).toBe(409);
        expect(err.message).toBe('Đơn chưa huỷ — không lập phiếu nhập trả.');
        expectNothingWritten();
      },
    );

    it('duplicate product ⇒ 400 DUPLICATE_PRODUCT on lines.1.productId', async () => {
      given();

      const err = await caught(
        service.createReturnVoucher(
          ORIGIN,
          input([
            { productId: P1, qty: 1 },
            { productId: P1, qty: 2 },
          ]),
          ACTOR,
        ),
      );

      expect(err.getStatus()).toBe(400);
      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors).toEqual([
        expect.objectContaining({
          field: 'lines.1.productId',
          code: 'DUPLICATE_PRODUCT',
        }),
      ]);
      expectNothingWritten();
    });

    it('product not on the origin ⇒ 400 NOT_ON_ORIGIN_VOUCHER', async () => {
      given();

      const err = await caught(
        service.createReturnVoucher(
          ORIGIN,
          input([{ productId: P3, qty: 1 }]),
          ACTOR,
        ),
      );

      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors).toEqual([
        expect.objectContaining({
          field: 'lines.0.productId',
          code: 'NOT_ON_ORIGIN_VOUCHER',
        }),
      ]);
      expectNothingWritten();
    });

    it('more than issued ⇒ 400 RETURN_EXCEEDS_ISSUED on that line qty; exactly the issued qty passes', async () => {
      given();

      const err = await caught(
        service.createReturnVoucher(
          ORIGIN,
          input([
            { productId: P1, qty: 12 },
            { productId: P2, qty: 3 },
          ]),
          ACTOR,
        ),
      );

      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors).toEqual([
        {
          field: 'lines.1.qty',
          code: 'RETURN_EXCEEDS_ISSUED',
          message: 'Đã xuất 2 tấm, không nhận lại được 3.',
        },
      ]);
      expectNothingWritten();
    });
  });
});
