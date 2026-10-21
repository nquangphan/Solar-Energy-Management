import type { Prisma } from '@prisma/client';
import type { EventBus } from '../src/events/event-bus';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Confirm-time stock reservation primitive — runs INSIDE the caller's tx (mock Prisma). Guards
 * what the DB lane cannot isolate: op order (own-ledger read, then the `products` lock before
 * any write), what is released (exactly what an older version holds — not its line qty, not
 * filtered by `tracksStock`), what is reserved (`stockIssueLines` selection), idempotent skip,
 * and that it never opens a tx, publishes or moves `onHand`.
 */
describe('StockVouchersService.reserveForOrderInTx', () => {
  const ORDER = 'ord-1';
  const V1 = 'ver-1';
  const V2 = 'ver-2';
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

  let tx: {
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
    product: { findMany: jest.Mock };
    stockItem: { findMany: jest.Mock; upsert: jest.Mock };
    stockMovement: {
      groupBy: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  const prisma = { $transaction: jest.fn() };
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = new StockVouchersService(
    prisma as unknown as PrismaService,
    eventBus as unknown as EventBus,
  );

  function given(o: {
    products?: { id: string; name: string; tracksStock: boolean }[];
    /** Ledger groups of OTHER versions of the order: version, stock item, summed qty. */
    held?: { orderVersionId: string; stockItemId: string; qty: number }[];
    /** Stock item id → product id, for the held groups. */
    heldItems?: Record<string, string>;
    /** Stock item ids this version already reserved. */
    alreadyReserved?: string[];
  }) {
    tx.product.findMany = recorded('product.findMany', o.products ?? []);
    tx.stockMovement.groupBy = recorded(
      'stockMovement.groupBy',
      (o.held ?? []).map((g) => ({
        orderVersionId: g.orderVersionId,
        stockItemId: g.stockItemId,
        _sum: { qty: g.qty },
      })),
    );
    tx.stockItem.findMany = jest.fn(
      (args: { where: { id: { in: string[] } } }) => {
        calls.push('stockItem.findMany');
        return Promise.resolve(
          args.where.id.in.map((id) => ({ productId: o.heldItems![id] })),
        );
      },
    );
    tx.stockMovement.findUnique = jest.fn(
      (args: {
        where: {
          orderVersionId_stockItemId_type: { stockItemId: string };
        };
      }) => {
        calls.push('stockMovement.findUnique');
        const id = args.where.orderVersionId_stockItemId_type.stockItemId;
        return Promise.resolve(
          (o.alreadyReserved ?? []).includes(id) ? { id: 'mv-old' } : null,
        );
      },
    );
  }

  function reserve(orderLines: { productId: string; qty: number }[]) {
    return service.reserveForOrderInTx(
      tx as unknown as Prisma.TransactionClient,
      { orderId: ORDER, orderVersionId: V2, orderLines },
    );
  }

  function created() {
    return tx.stockMovement.create.mock.calls.map(
      (c) => (c as [{ data: unknown }])[0].data,
    );
  }

  beforeEach(() => {
    calls.length = 0;
    jest.clearAllMocks();
    tx = {
      $queryRaw: recorded('$queryRaw', []),
      $transaction: jest.fn(),
      product: { findMany: recorded('product.findMany', []) },
      stockItem: {
        findMany: recorded('stockItem.findMany', []),
        upsert: jest.fn((args: { where: { productId: string } }) => {
          calls.push('stockItem.upsert');
          return Promise.resolve({ id: `s-${args.where.productId}` });
        }),
      },
      stockMovement: {
        groupBy: recorded('stockMovement.groupBy', []),
        findUnique: recorded('stockMovement.findUnique', null),
        create: recorded('stockMovement.create', {}),
      },
    };
  });

  it("reads only this order's OTHER versions, then locks products FOR UPDATE before any product read or stock write", async () => {
    given({
      products: [
        { id: P2, name: 'Tấm pin', tracksStock: true },
        { id: P1, name: 'Inverter', tracksStock: true },
      ],
    });

    await reserve([
      { productId: P2, qty: 4 },
      { productId: P1, qty: 1 },
    ]);

    expect(tx.stockMovement.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['orderVersionId', 'stockItemId'],
        where: { orderId: ORDER, orderVersionId: { not: V2 } },
        _sum: { qty: true },
      }),
    );
    const lockAt = calls.indexOf('$queryRaw');
    expect(calls.slice(0, lockAt)).toEqual(['stockMovement.groupBy']);
    const [sql, ids] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string[],
    ];
    expect(sql.join('?')).toMatch(
      /SELECT id FROM products WHERE id = ANY\(\?\) ORDER BY id FOR UPDATE/,
    );
    expect([...ids].sort()).toEqual([P1, P2]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('reserves stock-tracked lines merged per product; untracked and unknown products get nothing; onHand never changes', async () => {
    given({
      products: [
        { id: P1, name: 'Tấm pin', tracksStock: true },
        { id: P2, name: 'Công lắp', tracksStock: false },
      ],
    });

    await reserve([
      { productId: P1, qty: 3 },
      { productId: P2, qty: 1 },
      { productId: P1, qty: 2 },
      { productId: P3, qty: 7 },
    ]);

    expect(tx.stockItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.stockItem.upsert).toHaveBeenCalledWith({
      where: { productId: P1 },
      create: { productId: P1, onHand: 0 },
      update: {},
    });
    expect(created()).toEqual([
      {
        stockItemId: `s-${P1}`,
        orderId: ORDER,
        orderVersionId: V2,
        qty: 5,
        type: 'reserve',
      },
    ]);
  });

  it('releases what each older version still HOLDS — even for a product no longer tracked — and locks its product too', async () => {
    given({
      products: [
        { id: P1, name: 'Tấm pin', tracksStock: true },
        { id: P2, name: 'Inverter', tracksStock: false },
      ],
      // The older version once reserved 5 of P1 and 4 of P2; the ledger says what is held.
      held: [
        { orderVersionId: V1, stockItemId: `s-${P1}`, qty: 5 },
        { orderVersionId: V1, stockItemId: `s-${P2}`, qty: 4 },
      ],
      heldItems: { [`s-${P1}`]: P1, [`s-${P2}`]: P2 },
    });

    await reserve([{ productId: P1, qty: 2 }]);

    const [, ids] = tx.$queryRaw.mock.calls[0] as [unknown, string[]];
    expect([...ids].sort()).toEqual([P1, P2]);
    expect(calls.indexOf('$queryRaw')).toBeLessThan(
      calls.indexOf('stockMovement.create'),
    );
    expect(created()).toEqual([
      {
        stockItemId: `s-${P1}`,
        orderId: ORDER,
        orderVersionId: V1,
        qty: -5,
        type: 'release',
      },
      {
        stockItemId: `s-${P2}`,
        orderId: ORDER,
        orderVersionId: V1,
        qty: -4,
        type: 'release',
      },
      {
        stockItemId: `s-${P1}`,
        orderId: ORDER,
        orderVersionId: V2,
        qty: 2,
        type: 'reserve',
      },
    ]);
  });

  it('an older version already netted to zero (or below) is neither released nor locked', async () => {
    given({
      products: [{ id: P1, name: 'Tấm pin', tracksStock: true }],
      held: [
        { orderVersionId: V1, stockItemId: `s-${P2}`, qty: 0 },
        { orderVersionId: 'ver-0', stockItemId: `s-${P3}`, qty: -1 },
      ],
      heldItems: { [`s-${P2}`]: P2, [`s-${P3}`]: P3 },
    });

    await reserve([{ productId: P1, qty: 2 }]);

    expect(tx.stockItem.findMany).not.toHaveBeenCalled();
    const [, ids] = tx.$queryRaw.mock.calls[0] as [unknown, string[]];
    expect(ids).toEqual([P1]);
    expect(created()).toEqual([
      expect.objectContaining({ type: 'reserve', qty: 2 }),
    ]);
  });

  it('a product this version already reserved is skipped (idempotent), others are still reserved', async () => {
    given({
      products: [
        { id: P1, name: 'Tấm pin', tracksStock: true },
        { id: P2, name: 'Inverter', tracksStock: true },
      ],
      alreadyReserved: [`s-${P1}`],
    });

    await reserve([
      { productId: P1, qty: 2 },
      { productId: P2, qty: 1 },
    ]);

    expect(tx.stockMovement.findUnique).toHaveBeenCalledWith({
      where: {
        orderVersionId_stockItemId_type: {
          orderVersionId: V2,
          stockItemId: `s-${P1}`,
          type: 'reserve',
        },
      },
    });
    expect(created()).toEqual([
      {
        stockItemId: `s-${P2}`,
        orderId: ORDER,
        orderVersionId: V2,
        qty: 1,
        type: 'reserve',
      },
    ]);
  });

  it('nothing held and no product line ⇒ no lock, no write', async () => {
    given({});

    await reserve([]);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.stockItem.upsert).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
