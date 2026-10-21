import type { Order } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { AppException } from '../src/common/errors/app.exception';
import type { EventBus } from '../src/events/event-bus';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Unit tests of the quote screen's early stock warning in `OrdersService.getStockCheck`
 * (mock Prisma + mock `inventory/` read).
 *
 *  1. OP ORDER — scope (`findScopedOrThrow`) is the FIRST op; out of scope ⇒ 404 and nothing
 *     else is read.
 *  2. Only the current version's product lines are handed to `inventory/` (free-text lines
 *     never); `orders/` never reads stock tables itself.
 *  3. Read only — no write, no event.
 */
describe('OrdersService.getStockCheck', () => {
  const ACTOR = 'acc-sale';
  const ORDER_ID = 'ord-q';
  const AT = new Date('2026-10-21T04:00:00Z');
  const SALE: ReadonlySet<string> = new Set([
    PERM.ordersViewOwn,
    PERM.quotesCreateEdit,
  ]);

  const ORDER = {
    id: ORDER_ID,
    status: 'baogia',
    currentVersionId: 'ver-2',
    ownerAccountId: ACTOR,
    assigneeAccountId: null,
    createdAt: AT,
    updatedAt: AT,
  } as unknown as Order;

  const CHECK = [
    {
      productId: 'p-panel',
      name: 'Tấm pin',
      unit: 'tấm',
      qty: 16,
      onHand: 5,
      reserved: 0,
      available: 5,
      shortfall: 11,
      status: 'short' as const,
    },
  ];

  const calls: string[] = [];
  function recorded(name: string, result: unknown): jest.Mock {
    return jest.fn(() => {
      calls.push(name);
      return Promise.resolve(result);
    });
  }

  let prisma: {
    order: { findFirst: jest.Mock };
    orderLineItem: { findMany: jest.Mock };
    stockItem: { findMany: jest.Mock };
    stockMovement: { groupBy: jest.Mock };
    $transaction: jest.Mock;
  };
  let stockItems: { checkOrderLines: jest.Mock };
  let stockVouchers: { findOrderIssueVoucher: jest.Mock };
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  let service: OrdersService;

  beforeEach(() => {
    calls.length = 0;
    jest.clearAllMocks();
    prisma = {
      order: { findFirst: recorded('order.findFirst', ORDER) },
      orderLineItem: {
        findMany: recorded('orderLineItem.findMany', [
          { productId: 'p-panel', qty: 10 },
          { productId: null, qty: 1 },
          { productId: 'p-panel', qty: 6 },
        ]),
      },
      stockItem: { findMany: jest.fn() },
      stockMovement: { groupBy: jest.fn() },
      $transaction: jest.fn(),
    };
    stockItems = { checkOrderLines: recorded('checkOrderLines', CHECK) };
    stockVouchers = {
      findOrderIssueVoucher: recorded('findOrderIssueVoucher', null),
    };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBus,
      fakeStorage(),
      stockVouchers as unknown as StockVouchersService,
      stockItems as unknown as StockItemsService,
    );
  });

  it('ORDER: scope first → issued? → current version lines → inventory figures; returns them as is', async () => {
    const result = await service.getStockCheck(ACTOR, SALE, ORDER_ID);

    expect(result).toEqual({ lines: CHECK });
    expect(calls).toEqual([
      'order.findFirst',
      'findOrderIssueVoucher',
      'orderLineItem.findMany',
      'checkOrderLines',
    ]);
    expect(prisma.orderLineItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderVersionId: 'ver-2' } }),
    );
  });

  it('stock already issued for the current version ⇒ no lines (no warning about goods the order already took), stock figures never read', async () => {
    stockVouchers.findOrderIssueVoucher = recorded('findOrderIssueVoucher', {
      id: 'voucher-1',
    });

    const result = await service.getStockCheck(ACTOR, SALE, ORDER_ID);

    expect(result).toEqual({ lines: [] });
    expect(stockVouchers.findOrderIssueVoucher).toHaveBeenCalledWith(
      prisma,
      ORDER_ID,
      'ver-2',
    );
    expect(calls).toEqual(['order.findFirst', 'findOrderIssueVoucher']);
    expect(stockItems.checkOrderLines).not.toHaveBeenCalled();
  });

  it('hands inventory every PRODUCT line of the current version (free-text lines never; merging is its call)', async () => {
    await service.getStockCheck(ACTOR, SALE, ORDER_ID);

    expect(stockItems.checkOrderLines).toHaveBeenCalledWith(ORDER_ID, [
      { productId: 'p-panel', qty: 10 },
      { productId: 'p-panel', qty: 6 },
    ]);
  });

  it('scope clause narrows to owner/assignee without orders.view_all', async () => {
    await service.getStockCheck(ACTOR, SALE, ORDER_ID);

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: ORDER_ID },
          {
            OR: [{ ownerAccountId: ACTOR }, { assigneeAccountId: ACTOR }],
          },
        ],
      },
    });
  });

  it('out of scope ⇒ 404 (same message as an unknown id), nothing else read', async () => {
    prisma.order.findFirst = recorded('order.findFirst', null);

    const err = await service
      .getStockCheck('acc-other', SALE, ORDER_ID)
      .catch((e: AppException) => e);

    expect((err as AppException).getStatus()).toBe(404);
    expect((err as AppException).message).toBe(
      `Không tìm thấy đơn hàng: ${ORDER_ID}`,
    );
    expect(calls).toEqual(['order.findFirst']);
  });

  it('never reads stock tables itself, never opens a tx, never publishes', async () => {
    await service.getStockCheck(ACTOR, SALE, ORDER_ID);

    expect(prisma.stockItem.findMany).not.toHaveBeenCalled();
    expect(prisma.stockMovement.groupBy).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
