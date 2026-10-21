import { Logger } from '@nestjs/common';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventBus } from '../src/events/event-bus';
import { OrderCancelledStockSubscriber } from '../src/inventory/order-cancelled-stock.subscriber';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { OrderCancelled } from '../src/orders/domain/order-events';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Release of what an ENDED order still holds (mock Prisma). Guards what the DB lane cannot
 * isolate: op order (`orders` lock first, status re-read, ledger read, `products` lock before
 * any write), what is released (per ORDER across every version, exactly the held amount, no
 * `tracksStock` filter), the no-op branches, and that `onHand`/vouchers/events are untouched.
 */
describe('StockVouchersService — release on cancel / completion', () => {
  const ORDER = 'ord-1';
  const V1 = 'ver-1';
  const V2 = 'ver-2';
  const P1 = '11111111-1111-4111-8111-111111111111';
  const P2 = '22222222-2222-4222-8222-222222222222';

  const calls: string[] = [];
  function recorded<T>(name: string, result: T): jest.Mock {
    return jest.fn(() => {
      calls.push(name);
      return Promise.resolve(result);
    });
  }

  let tx: {
    $queryRaw: jest.Mock;
    order: { findUnique: jest.Mock };
    product: { findMany: jest.Mock };
    stockItem: { findMany: jest.Mock; upsert: jest.Mock; update: jest.Mock };
    stockVoucher: { create: jest.Mock };
    stockMovement: { groupBy: jest.Mock; create: jest.Mock };
  };
  const prisma = { $transaction: jest.fn() };
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = new StockVouchersService(
    prisma as unknown as PrismaService,
    eventBus as unknown as EventBus,
  );

  /** SQL text of every `$queryRaw` call, in order. */
  function sqlCalls(): string[] {
    return tx.$queryRaw.mock.calls.map((c) =>
      (c[0] as TemplateStringsArray).join('?').replace(/\s+/g, ' ').trim(),
    );
  }

  function given(o: {
    orderRow?: boolean;
    status?: string;
    held?: { orderVersionId: string; stockItemId: string; qty: number }[];
    heldItems?: Record<string, string>;
  }) {
    tx.$queryRaw = jest.fn((sql: TemplateStringsArray) => {
      const text = sql.join('?');
      calls.push(/FROM orders/.test(text) ? 'lock.orders' : 'lock.products');
      return Promise.resolve(
        /FROM orders/.test(text) && o.orderRow === false ? [] : [{ id: 'x' }],
      );
    });
    tx.order.findUnique = recorded('order.findUnique', {
      status: o.status ?? 'huy',
    });
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
  }

  beforeEach(() => {
    calls.length = 0;
    jest.clearAllMocks();
    tx = {
      $queryRaw: jest.fn(),
      order: { findUnique: jest.fn() },
      product: { findMany: recorded('product.findMany', []) },
      stockItem: {
        findMany: jest.fn(),
        upsert: recorded('stockItem.upsert', {}),
        update: recorded('stockItem.update', {}),
      },
      stockVoucher: { create: recorded('stockVoucher.create', {}) },
      stockMovement: {
        groupBy: jest.fn(),
        create: recorded('stockMovement.create', {}),
      },
    };
    prisma.$transaction.mockImplementation(
      (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    );
  });

  describe('releaseForCancelledOrder', () => {
    it('locks the orders row FIRST, re-reads the status, reads the ledger, locks products before any write', async () => {
      given({
        held: [{ orderVersionId: V1, stockItemId: 'si-1', qty: 5 }],
        heldItems: { 'si-1': P1 },
      });

      await service.releaseForCancelledOrder(ORDER);

      expect(calls).toEqual([
        'lock.orders',
        'order.findUnique',
        'stockMovement.groupBy',
        'stockItem.findMany',
        'lock.products',
        'stockMovement.create',
      ]);
      expect(sqlCalls()[0]).toBe(
        'SELECT id FROM orders WHERE id = ? FOR UPDATE',
      );
      expect(sqlCalls()[1]).toBe(
        'SELECT id FROM products WHERE id = ANY(?) ORDER BY id FOR UPDATE',
      );
      expect(tx.$queryRaw.mock.calls[0][1]).toBe(ORDER);
    });

    it('releases per ORDER across every version (not only the event version), by exactly what is held', async () => {
      given({
        held: [
          { orderVersionId: V1, stockItemId: 'si-1', qty: 5 },
          { orderVersionId: V2, stockItemId: 'si-2', qty: 2 },
        ],
        heldItems: { 'si-1': P1, 'si-2': P2 },
      });

      await service.releaseForCancelledOrder(ORDER);

      expect(tx.stockMovement.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['orderVersionId', 'stockItemId'],
          where: { orderId: ORDER },
        }),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(tx.stockMovement.create).toHaveBeenNthCalledWith(1, {
        data: {
          stockItemId: 'si-1',
          orderId: ORDER,
          orderVersionId: V1,
          qty: -5,
          type: 'release',
        },
      });
      expect(tx.stockMovement.create).toHaveBeenNthCalledWith(2, {
        data: {
          stockItemId: 'si-2',
          orderId: ORDER,
          orderVersionId: V2,
          qty: -2,
          type: 'release',
        },
      });
      // The lock set is exactly the products of what is held.
      expect(tx.$queryRaw.mock.calls[1][1]).toEqual([P1, P2]);
    });

    it('never reads tracksStock: a product untracked since confirm still gives back its hold', async () => {
      given({
        held: [{ orderVersionId: V1, stockItemId: 'si-1', qty: 5 }],
        heldItems: { 'si-1': P1 },
      });

      await service.releaseForCancelledOrder(ORDER);

      expect(tx.product.findMany).not.toHaveBeenCalled();
      // The held stock items are resolved by id alone — no product filter.
      expect(tx.stockItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['si-1'] } },
        select: { productId: true },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('skips groups holding nothing or less (issued, already released)', async () => {
      given({
        held: [
          { orderVersionId: V1, stockItemId: 'si-1', qty: 0 },
          { orderVersionId: V1, stockItemId: 'si-2', qty: -3 },
        ],
        heldItems: {},
      });

      await service.releaseForCancelledOrder(ORDER);

      expect(calls).not.toContain('lock.products');
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('no ledger ⇒ no products lock, no write (idempotent rerun, order never confirmed)', async () => {
      given({ held: [] });

      await service.releaseForCancelledOrder(ORDER);

      expect(calls).toEqual([
        'lock.orders',
        'order.findUnique',
        'stockMovement.groupBy',
      ]);
    });

    it.each(['dachot', 'dacoc', 'baogia', 'hoanthanh'])(
      'order in %s (not cancelled) ⇒ reads no ledger, writes nothing',
      async (status) => {
        given({
          status,
          held: [{ orderVersionId: V1, stockItemId: 'si-1', qty: 5 }],
          heldItems: { 'si-1': P1 },
        });

        await service.releaseForCancelledOrder(ORDER);

        expect(tx.stockMovement.groupBy).not.toHaveBeenCalled();
        expect(tx.stockMovement.create).not.toHaveBeenCalled();
      },
    );

    it('order row missing ⇒ nothing read or written', async () => {
      given({ orderRow: false });

      await service.releaseForCancelledOrder(ORDER);

      expect(calls).toEqual(['lock.orders']);
    });

    it('never touches onHand, never writes a voucher, never publishes', async () => {
      given({
        held: [{ orderVersionId: V1, stockItemId: 'si-1', qty: 5 }],
        heldItems: { 'si-1': P1 },
      });

      await service.releaseForCancelledOrder(ORDER);

      expect(tx.stockItem.upsert).not.toHaveBeenCalled();
      expect(tx.stockItem.update).not.toHaveBeenCalled();
      expect(tx.stockVoucher.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('releaseHeldForOrderInTx', () => {
    it('runs inside the caller tx: never opens one, never locks the orders row itself', async () => {
      given({
        held: [{ orderVersionId: V1, stockItemId: 'si-1', qty: 4 }],
        heldItems: { 'si-1': P1 },
      });

      await service.releaseHeldForOrderInTx(tx as never, ORDER);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(calls).toEqual([
        'stockMovement.groupBy',
        'stockItem.findMany',
        'lock.products',
        'stockMovement.create',
      ]);
    });
  });
});

describe('OrderCancelledStockSubscriber', () => {
  const stockVouchers = { releaseForCancelledOrder: jest.fn() };
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const subscriber = new OrderCancelledStockSubscriber(
    eventBus as unknown as EventBus,
    stockVouchers as unknown as StockVouchersService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('subscribes itself to the bus exactly once on module init', () => {
    subscriber.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledTimes(1);
    expect(eventBus.subscribe).toHaveBeenCalledWith(subscriber);
  });

  it('a failed release is logged with the order id and rethrown (the hold stays; rerun is safe)', async () => {
    const boom = new Error('connection lost');
    stockVouchers.releaseForCancelledOrder.mockRejectedValueOnce(boom);
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      subscriber.handle(
        new OrderCancelled(
          'acc-1',
          'ord-9',
          'Khách đổi ý',
          'dachot',
          'ver-2',
          new Date(),
        ),
      ),
    ).rejects.toBe(boom);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toContain('ord-9');
    logError.mockRestore();
  });

  it('OrderCancelled ⇒ releases by the order id of the event target', async () => {
    await subscriber.handle(
      new OrderCancelled(
        'acc-1',
        'ord-9',
        'Khách đổi ý',
        'dachot',
        'ver-2',
        new Date(),
      ),
    );

    expect(stockVouchers.releaseForCancelledOrder).toHaveBeenCalledTimes(1);
    expect(stockVouchers.releaseForCancelledOrder).toHaveBeenCalledWith(
      'ord-9',
    );
  });

  it.each<[string, DomainEvent]>([
    [
      'StatusChanged',
      {
        type: 'StatusChanged',
        occurredAt: new Date(),
        target: { type: 'Order', id: 'ord-9' },
      },
    ],
    [
      'OrderCancelled on a non-order target',
      {
        type: 'OrderCancelled',
        occurredAt: new Date(),
        target: { type: 'Quote', id: 'q-1' },
      },
    ],
    [
      'OrderCancelled without a target',
      { type: 'OrderCancelled', occurredAt: new Date() },
    ],
  ])('%s ⇒ ignored', async (_name, event) => {
    await subscriber.handle(event);

    expect(stockVouchers.releaseForCancelledOrder).not.toHaveBeenCalled();
  });
});
