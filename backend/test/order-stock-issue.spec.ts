import type { Order } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { AppException } from '../src/common/errors/app.exception';
import type { EventBus } from '../src/events/event-bus';
import { StockIssued } from '../src/inventory/domain/stock-issued-event';
import type {
  StockVoucherDetail,
  StockVouchersService,
} from '../src/inventory/stock-vouchers.service';
import {
  SU_KIEN,
  type TransitionEvent,
} from '../src/orders/domain/allowed-transition';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage, type FakeStorage } from './util/fake-storage';

/**
 * Unit tests of the order-bound stock issue in `OrdersService` (mock Prisma + mock
 * `inventory/` primitive).
 *
 * What a mock measures and the DB lane cannot isolate:
 *  1. OP ORDER — scope before anything; the order lock is the first op in the tx, BEFORE the
 *     primitive; order-line costs are written AFTER the primitive, from its `costByProduct`.
 *  2. Each event type is published exactly ONCE, AFTER commit; a failed commit ⇒ 0 events (the
 *     mock RUNS the tx body before throwing — a plain rejected mock would fake-pass "publish
 *     after commit").
 *  3. "Đã giao": a missing `inventory.manage` is refused BEFORE paying for R2, and re-checked
 *     under the lock.
 *  4. Other manual steps never touch stock.
 *  5. The direct close `dachot → hoan_thanh` is refused while tracked stock is not issued —
 *     before R2 in the manual lane, and under the order lock in the engine (both lanes).
 *  6. Re-opening an issued order is refused under the lock.
 */
describe('OrdersService — order-bound stock issue', () => {
  const ACTOR = 'acc-warehouse';
  const ORDER_ID = 'ord-si';
  const P1 = 'p-panel';
  const AT = new Date('2026-10-21T04:00:00Z');

  const WAREHOUSE: ReadonlySet<string> = new Set([
    PERM.ordersViewAll,
    PERM.inventoryManage,
    PERM.deliveryConfirm,
    PERM.constructionTransition,
  ]);
  const DELIVERY_ONLY: ReadonlySet<string> = new Set([
    PERM.ordersViewAll,
    PERM.deliveryConfirm,
  ]);

  function order(status: string, overrides: Partial<Order> = {}): Order {
    return {
      id: ORDER_ID,
      status,
      customerSdt: '+84912345678',
      currentVersionId: 'ver-1',
      ownerAccountId: ACTOR,
      assigneeAccountId: null,
      sourceId: 'src-fb',
      custType: 'CA_NHAN',
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: true,
      kWp: null,
      vatMode: null,
      validityNote: null,
      cancelReason: null,
      cancelledAt: null,
      createdAt: AT,
      updatedAt: AT,
      ...overrides,
    };
  }

  const ORDER_LINES = [
    { id: 'l-panel', productId: P1, qty: 10, unitPriceSnapshot: 3_000_000 },
    {
      id: 'l-install',
      productId: 'p-install',
      qty: 1,
      unitPriceSnapshot: 1_500_000,
    },
    { id: 'l-free', productId: null, qty: 1, unitPriceSnapshot: 200_000 },
  ];

  const VOUCHER: StockVoucherDetail = {
    id: 'v-1',
    ma: 'PK-X-0096',
    type: 'xuat',
    orderId: ORDER_ID,
    createdAt: AT,
    nguoiTao: { id: ACTOR, displayName: 'Thủ kho' },
    soDong: 1,
    tongSoLuong: 10,
    note: null,
    lines: [
      {
        productId: P1,
        ten: 'Tấm pin',
        sku: 'PIN',
        donVi: 'tấm',
        qty: 10,
        unitCost: 2_088_000,
      },
    ],
  };
  const EVENT = new StockIssued(
    ACTOR,
    {
      id: 'v-1',
      code: 'PK-X-0096',
      orderId: ORDER_ID,
      orderVersionId: 'ver-1',
      lines: [],
    },
    AT,
  );

  const calls: string[] = [];
  function recorded(name: string, result: unknown = {}): jest.Mock {
    return jest.fn(() => {
      calls.push(name);
      return Promise.resolve(result);
    });
  }

  let orderRepo: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
  };
  let versionRepo: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  let lineRepo: {
    findMany: jest.Mock;
    update: jest.Mock;
    createMany: jest.Mock;
  };
  let attachmentRepo: { createMany: jest.Mock };
  let queryRaw: jest.Mock;
  let stockVouchers: {
    findOrderIssueVoucher: jest.Mock;
    previewOrderIssue: jest.Mock;
    issueForOrderInTx: jest.Mock;
    lockTrackedProductsInTx: jest.Mock;
  };
  let commitError: Error | null;
  let storage: FakeStorage;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  let service: OrdersService;

  function givenOrder(o: Order): void {
    orderRepo.findFirst = recorded('order.findFirst', o);
    orderRepo.findUnique = recorded('order.findUnique', o);
  }

  function notIssuedWithTrackedLines(): void {
    stockVouchers.findOrderIssueVoucher = recorded(
      'findOrderIssueVoucher',
      null,
    );
    stockVouchers.previewOrderIssue = recorded('previewOrderIssue', {
      lines: [
        {
          productId: P1,
          name: 'Tấm pin',
          sku: 'PIN',
          unit: 'tấm',
          qty: 10,
          onHand: 40,
        },
      ],
      tracked: new Set([P1]),
    });
    stockVouchers.issueForOrderInTx = recorded('primitive', {
      voucher: VOUCHER,
      costByProduct: new Map([[P1, 2_088_000]]),
      event: EVENT,
    });
  }

  beforeEach(() => {
    calls.length = 0;
    commitError = null;
    jest.clearAllMocks();
    orderRepo = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: recorded('order.updateMany', { count: 1 }),
      update: recorded('order.update'),
    };
    versionRepo = {
      findUnique: recorded('orderVersion.findUnique', {
        id: 'ver-1',
        versionNo: 1,
      }),
      create: recorded('orderVersion.create'),
    };
    lineRepo = {
      findMany: recorded('orderLineItem.findMany', ORDER_LINES),
      update: recorded('orderLineItem.update'),
      createMany: recorded('orderLineItem.createMany'),
    };
    attachmentRepo = { createMany: recorded('attachment.createMany') };
    queryRaw = recorded('lockOrderRow', []);
    stockVouchers = {
      findOrderIssueVoucher: jest.fn(),
      previewOrderIssue: jest.fn(),
      issueForOrderInTx: jest.fn(),
      lockTrackedProductsInTx: recorded('lockTrackedProducts', new Set()),
    };
    notIssuedWithTrackedLines();
    const tx = {
      order: orderRepo,
      orderVersion: versionRepo,
      orderLineItem: lineRepo,
      attachment: attachmentRepo,
      $queryRaw: queryRaw,
    };
    const prisma = {
      order: orderRepo,
      orderVersion: versionRepo,
      orderLineItem: lineRepo,
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        calls.push('tx.begin');
        const result = await fn(tx);
        if (commitError) throw commitError;
        calls.push('tx.commit');
        return result;
      }),
    };
    eventBus.publish.mockImplementation((e: { type: string }) => {
      calls.push(`publish:${e.type}`);
      return Promise.resolve();
    });
    storage = fakeStorage();
    service = new OrdersService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBus,
      storage,
      stockVouchers as unknown as StockVouchersService,
    );
  });

  async function caught(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (e) {
      return e as AppException;
    }
    throw new Error('Expected an AppException, got none.');
  }

  function published(type: string): number {
    return eventBus.publish.mock.calls.filter(
      ([e]) => (e as { type: string }).type === type,
    ).length;
  }

  describe('standalone path — issueStock', () => {
    beforeEach(() => givenOrder(order('danggiao')));

    it('ORDER: scope → tx [lock order → re-read → already issued? → primitive → line costs] → commit → publish', async () => {
      const result = await service.issueStock(ACTOR, WAREHOUSE, ORDER_ID);

      expect(result).toEqual({ voucher: VOUCHER, created: true });
      expect(calls[0]).toBe('order.findFirst');
      const inTx = calls.slice(calls.indexOf('tx.begin') + 1);
      expect(inTx[0]).toBe('lockOrderRow');
      expect(inTx.indexOf('order.findUnique')).toBeLessThan(
        inTx.indexOf('primitive'),
      );
      expect(inTx.indexOf('findOrderIssueVoucher')).toBeLessThan(
        inTx.indexOf('primitive'),
      );
      expect(inTx.indexOf('primitive')).toBeLessThan(
        inTx.indexOf('orderLineItem.update'),
      );
      expect(calls.indexOf('publish:StockIssued')).toBeGreaterThan(
        calls.indexOf('tx.commit'),
      );
      expect(published('StockIssued')).toBe(1);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('hands the primitive EVERY product line of the current version (tracksStock is its call)', async () => {
      await service.issueStock(ACTOR, WAREHOUSE, ORDER_ID);

      expect(stockVouchers.issueForOrderInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orderId: ORDER_ID,
          orderVersionId: 'ver-1',
          actorAccountId: ACTOR,
          orderLines: [
            { productId: P1, qty: 10 },
            { productId: 'p-install', qty: 1 },
          ],
        }),
      );
    });

    it('freezes EVERY line cost: tracked line = primitive costByProduct; installation + free-text = selling price', async () => {
      await service.issueStock(ACTOR, WAREHOUSE, ORDER_ID);

      const written = lineRepo.update.mock.calls.map(
        ([a]) =>
          [
            (a as { where: { id: string } }).where.id,
            (a as { data: { costPriceSnapshot: number } }).data
              .costPriceSnapshot,
          ] as const,
      );
      expect(written).toEqual([
        ['l-panel', 2_088_000],
        ['l-install', 1_500_000],
        ['l-free', 200_000],
      ]);
    });

    it('already issued ⇒ returns the existing voucher, created false: NO primitive, NO line writes, NO publish', async () => {
      stockVouchers.findOrderIssueVoucher = recorded(
        'findOrderIssueVoucher',
        VOUCHER,
      );

      const result = await service.issueStock(ACTOR, WAREHOUSE, ORDER_ID);

      expect(result).toEqual({ voucher: VOUCHER, created: false });
      expect(stockVouchers.issueForOrderInTx).not.toHaveBeenCalled();
      expect(lineRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('commit fails AFTER the tx body ran ⇒ 0 events', async () => {
      commitError = new Error('serialization failure');

      await expect(
        service.issueStock(ACTOR, WAREHOUSE, ORDER_ID),
      ).rejects.toThrow('serialization failure');

      expect(stockVouchers.issueForOrderInTx).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it.each(['baogia', 'choduyet', 'dagiao', 'hoanthanh', 'huy', 'nghiemthu'])(
      'status %s ⇒ 409, no tx opened',
      async (status) => {
        givenOrder(order(status));

        const err = await caught(
          service.issueStock(ACTOR, WAREHOUSE, ORDER_ID),
        );

        expect(err.getStatus()).toBe(409);
        expect(err.message).toBe('Đơn ở trạng thái này không xuất kho được.');
        expect(calls).not.toContain('tx.begin');
      },
    );

    it.each(['dachot', 'dacoc', 'danggiao', 'thicong'])(
      'status %s ⇒ issuable',
      async (status) => {
        givenOrder(order(status));

        await expect(
          service.issueStock(ACTOR, WAREHOUSE, ORDER_ID),
        ).resolves.toEqual({ voucher: VOUCHER, created: true });
      },
    );

    it('status changed between pre-check and lock ⇒ 409 under the lock, no primitive', async () => {
      orderRepo.findFirst = recorded('order.findFirst', order('danggiao'));
      orderRepo.findUnique = recorded('order.findUnique', order('dagiao'));

      const err = await caught(service.issueStock(ACTOR, WAREHOUSE, ORDER_ID));

      expect(err.getStatus()).toBe(409);
      expect(stockVouchers.issueForOrderInTx).not.toHaveBeenCalled();
    });

    it('no stock-tracked line ⇒ 409, NO line costs written, NO publish', async () => {
      stockVouchers.issueForOrderInTx = recorded('primitive', {
        voucher: null,
        costByProduct: new Map(),
        event: null,
      });

      const err = await caught(service.issueStock(ACTOR, WAREHOUSE, ORDER_ID));

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Đơn không có vật tư theo dõi tồn kho — không cần phiếu xuất.',
      );
      expect(lineRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('line without a selling price snapshot (corrupt data) ⇒ 409, primitive not called', async () => {
      lineRepo.findMany = recorded('orderLineItem.findMany', [
        { id: 'l-x', productId: P1, qty: 1, unitPriceSnapshot: null },
      ]);

      const err = await caught(service.issueStock(ACTOR, WAREHOUSE, ORDER_ID));

      expect(err.getStatus()).toBe(409);
      expect(stockVouchers.issueForOrderInTx).not.toHaveBeenCalled();
    });

    it('out of scope ⇒ 404 before anything else', async () => {
      orderRepo.findFirst = recorded('order.findFirst', null);

      const err = await caught(
        service.issueStock(
          'acc-other',
          new Set([PERM.ordersViewOwn, PERM.inventoryManage]),
          ORDER_ID,
        ),
      );

      expect(err.getStatus()).toBe(404);
      expect(calls).toEqual(['order.findFirst']);
    });
  });

  describe('"Đã giao" step — chuyenTrangThaiThuCong(xong_giao)', () => {
    beforeEach(() => givenOrder(order('danggiao')));

    function photo() {
      return {
        originalname: 'delivered.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
        buffer: Buffer.from('x'),
      };
    }

    function deliver(permissions: ReadonlySet<string>, withPhoto = false) {
      return service.chuyenTrangThaiThuCong({
        callerAccountId: ACTOR,
        quyen: permissions,
        orderId: ORDER_ID,
        event: SU_KIEN.xongGiao,
        anh: withPhoto ? [photo()] : [],
      });
    }

    it('in-tx order: transition → issue → line costs → photos; publishes StatusChanged then StockIssued, once each, AFTER commit', async () => {
      const result = await deliver(WAREHOUSE, true);

      expect(result.status).toBe('dagiao');
      const at = (name: string) => calls.indexOf(name);
      expect(at('order.updateMany')).toBeLessThan(at('primitive'));
      expect(at('primitive')).toBeLessThan(at('orderLineItem.update'));
      expect(at('orderLineItem.update')).toBeLessThan(
        at('attachment.createMany'),
      );
      expect(at('tx.commit')).toBeLessThan(at('publish:StatusChanged'));
      expect(at('publish:StatusChanged')).toBeLessThan(
        at('publish:StockIssued'),
      );
      expect(published('StatusChanged')).toBe(1);
      expect(published('StockIssued')).toBe(1);
      expect(stockVouchers.issueForOrderInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ occurredAt: result.occurredAt }),
      );
    });

    it('not issued + tracked lines + no inventory.manage ⇒ 403 BEFORE R2: no upload, no tx', async () => {
      const err = await caught(deliver(DELIVERY_ONLY, true));

      expect(err.getStatus()).toBe(403);
      expect(err.message).toBe(
        'Xác nhận Đã giao sẽ xuất kho — cần quyền nhập/xuất kho.',
      );
      expect(storage.objects.size).toBe(0);
      expect(calls).not.toContain('tx.begin');
    });

    it('re-checked UNDER THE LOCK: pre-check saw nothing to issue but the tx must issue ⇒ 403, rollback, 0 events', async () => {
      stockVouchers.previewOrderIssue = recorded('previewOrderIssue', {
        lines: [],
        tracked: new Set(),
      });

      const err = await caught(deliver(DELIVERY_ONLY));

      expect(err.getStatus()).toBe(403);
      expect(stockVouchers.issueForOrderInTx).toHaveBeenCalledTimes(1);
      expect(lineRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('already issued standalone ⇒ only the status moves: no primitive, no StockIssued', async () => {
      stockVouchers.findOrderIssueVoucher = recorded(
        'findOrderIssueVoucher',
        VOUCHER,
      );

      await deliver(DELIVERY_ONLY);

      expect(stockVouchers.issueForOrderInTx).not.toHaveBeenCalled();
      expect(lineRepo.update).not.toHaveBeenCalled();
      expect(published('StatusChanged')).toBe(1);
      expect(published('StockIssued')).toBe(0);
    });

    it('no tracked line ⇒ still delivered + still freezes line costs, no StockIssued', async () => {
      stockVouchers.issueForOrderInTx = recorded('primitive', {
        voucher: null,
        costByProduct: new Map(),
        event: null,
      });

      const result = await deliver(WAREHOUSE);

      expect(result.status).toBe('dagiao');
      expect(lineRepo.update).toHaveBeenCalledTimes(ORDER_LINES.length);
      expect(published('StockIssued')).toBe(0);
    });

    it('issue throws (short stock) ⇒ no photo rows, no publish', async () => {
      stockVouchers.issueForOrderInTx = jest.fn(() =>
        Promise.reject(new Error('short-stock')),
      );

      await expect(deliver(WAREHOUSE, true)).rejects.toThrow('short-stock');

      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    const OTHER_STEPS: readonly [TransitionEvent, string][] = [
      [SU_KIEN.batDauGiao, 'dacoc'],
      [SU_KIEN.batDauThiCong, 'dacoc'],
      [SU_KIEN.xongThiCong, 'thicong'],
      [SU_KIEN.hoanThanh, 'dagiao'],
    ];
    it.each(OTHER_STEPS)(
      'step %s never touches stock (no read, no issue)',
      async (event, status) => {
        givenOrder(order(status));

        await service.chuyenTrangThaiThuCong({
          callerAccountId: ACTOR,
          // No inventory.manage ⇒ if this step leaked into the stock branch, the pre-check
          // would read stock.
          quyen: new Set([
            PERM.ordersViewAll,
            PERM.deliveryConfirm,
            PERM.constructionTransition,
          ]),
          orderId: ORDER_ID,
          event,
          anh: [],
        });

        expect(stockVouchers.findOrderIssueVoucher).not.toHaveBeenCalled();
        expect(stockVouchers.previewOrderIssue).not.toHaveBeenCalled();
        expect(stockVouchers.issueForOrderInTx).not.toHaveBeenCalled();
        expect(stockVouchers.lockTrackedProductsInTx).not.toHaveBeenCalled();
        expect(lineRepo.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('direct close dachot → hoan_thanh (equipment-only order)', () => {
    const CASHIER: ReadonlySet<string> = new Set([
      PERM.ordersViewAll,
      PERM.paymentsRecord,
    ]);
    const NOT_ISSUED =
      'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.';

    beforeEach(() =>
      givenOrder(
        order('dachot', { scopeThiCong: false, scopeVanChuyen: false }),
      ),
    );

    function close(withPhoto = false) {
      return service.chuyenTrangThaiThuCong({
        callerAccountId: ACTOR,
        quyen: CASHIER,
        orderId: ORDER_ID,
        event: SU_KIEN.hoanThanh,
        anh: withPhoto
          ? [
              {
                originalname: 'paid.jpg',
                mimetype: 'image/jpeg',
                size: 2048,
                buffer: Buffer.from('x'),
              },
            ]
          : [],
      });
    }

    it('tracked lines not issued ⇒ 409 BEFORE R2: no upload, no tx', async () => {
      const err = await caught(close(true));

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(NOT_ISSUED);
      expect(storage.objects.size).toBe(0);
      expect(calls).not.toContain('tx.begin');
    });

    it('re-checked UNDER THE ORDER LOCK: pre-check saw nothing tracked, the tx does ⇒ 409, status not written, 0 events', async () => {
      stockVouchers.previewOrderIssue = recorded('previewOrderIssue', {
        lines: [],
        tracked: new Set(),
      });
      stockVouchers.lockTrackedProductsInTx = recorded(
        'lockTrackedProducts',
        new Set([P1]),
      );

      const err = await caught(close());

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(NOT_ISSUED);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      const inTx = calls.slice(calls.indexOf('tx.begin') + 1);
      expect(inTx[0]).toBe('lockOrderRow');
      expect(inTx.indexOf('order.findUnique')).toBeGreaterThan(0);
      expect(inTx.indexOf('order.findUnique')).toBeLessThan(
        inTx.indexOf('lockTrackedProducts'),
      );
    });

    it('the in-tx check reads the version pointer re-read UNDER the lock, not the pre-tx one', async () => {
      orderRepo.findFirst = recorded(
        'order.findFirst',
        order('dachot', { scopeThiCong: false, scopeVanChuyen: false }),
      );
      orderRepo.findUnique = recorded(
        'order.findUnique',
        order('dachot', {
          scopeThiCong: false,
          scopeVanChuyen: false,
          currentVersionId: 'ver-2',
        }),
      );
      stockVouchers.previewOrderIssue = recorded('previewOrderIssue', {
        lines: [],
        tracked: new Set(),
      });

      await close();

      expect(stockVouchers.findOrderIssueVoucher).toHaveBeenLastCalledWith(
        expect.anything(),
        ORDER_ID,
        'ver-2',
      );
    });

    it('hands the in-tx check every product id of the current version', async () => {
      stockVouchers.previewOrderIssue = recorded('previewOrderIssue', {
        lines: [],
        tracked: new Set(),
      });

      await close();

      expect(stockVouchers.lockTrackedProductsInTx).toHaveBeenCalledWith(
        expect.anything(),
        [P1, 'p-install'],
      );
    });

    it('already issued ⇒ closes: status written, no product lock, StatusChanged once', async () => {
      stockVouchers.findOrderIssueVoucher = recorded(
        'findOrderIssueVoucher',
        VOUCHER,
      );

      const result = await close();

      expect(result.status).toBe('hoanthanh');
      expect(stockVouchers.lockTrackedProductsInTx).not.toHaveBeenCalled();
      expect(stockVouchers.issueForOrderInTx).not.toHaveBeenCalled();
      expect(published('StatusChanged')).toBe(1);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('no tracked line ⇒ closes directly, never issues', async () => {
      stockVouchers.previewOrderIssue = recorded('previewOrderIssue', {
        lines: [],
        tracked: new Set(),
      });

      const result = await close();

      expect(result.status).toBe('hoanthanh');
      expect(orderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: 'dachot' },
        data: { status: 'hoanthanh' },
      });
      expect(stockVouchers.issueForOrderInTx).not.toHaveBeenCalled();
      expect(lineRepo.update).not.toHaveBeenCalled();
    });

    it('auto lane (full payment) is gated by the SAME engine check ⇒ 409, status not written', async () => {
      stockVouchers.lockTrackedProductsInTx = recorded(
        'lockTrackedProducts',
        new Set([P1]),
      );

      const err = await caught(
        service.chuyenTrangThaiTuDong({
          orderId: ORDER_ID,
          event: SU_KIEN.hoanThanh,
          actorAccountId: ACTOR,
          actorPermissions: CASHIER,
        }),
      );

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(NOT_ISSUED);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('other edges into hoan_thanh never run the check', async () => {
      givenOrder(order('nghiemthu'));

      await service.chuyenTrangThaiThuCong({
        callerAccountId: ACTOR,
        quyen: WAREHOUSE,
        orderId: ORDER_ID,
        event: SU_KIEN.hoanThanh,
        anh: [],
      });

      expect(stockVouchers.lockTrackedProductsInTx).not.toHaveBeenCalled();
      expect(stockVouchers.findOrderIssueVoucher).not.toHaveBeenCalled();
    });
  });

  describe('re-open (revise) an issued order', () => {
    const EDITOR: ReadonlySet<string> = new Set([
      PERM.ordersViewAll,
      PERM.quotesCreateEdit,
    ]);

    beforeEach(() => givenOrder(order('dachot')));

    it('issued ⇒ 409 under the order lock: no new version, no pointer move, 0 events', async () => {
      stockVouchers.findOrderIssueVoucher = recorded(
        'findOrderIssueVoucher',
        VOUCHER,
      );

      const err = await caught(service.revise(ACTOR, ORDER_ID, false, EDITOR));

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe('Đơn đã xuất kho — không mở lại để sửa được.');
      expect(calls.indexOf('lockOrderRow')).toBeLessThan(
        calls.indexOf('findOrderIssueVoucher'),
      );
      expect(versionRepo.create).not.toHaveBeenCalled();
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('not issued ⇒ re-opens as before (new version)', async () => {
      lineRepo.findMany = recorded('orderLineItem.findMany', []);

      // The view read AFTER commit is not stubbed here (covered by `orders.service.spec.ts`) —
      // only the tx body matters for this check.
      await service.revise(ACTOR, ORDER_ID, false, EDITOR).catch(() => null);

      expect(calls).toContain('tx.commit');

      expect(stockVouchers.findOrderIssueVoucher).toHaveBeenCalledWith(
        expect.anything(),
        ORDER_ID,
        'ver-1',
      );
      expect(versionRepo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('preview — getStockIssue', () => {
    beforeEach(() => givenOrder(order('danggiao')));

    it('not issued: tracked lines + names of untracked lines; canIssue with inventory.manage', async () => {
      lineRepo.findMany = recorded('orderLineItem.findMany', [
        { name: 'Tấm pin', productId: P1, qty: 10 },
        { name: 'Công lắp đặt', productId: 'p-install', qty: 1 },
        { name: 'Phí khảo sát', productId: null, qty: 1 },
      ]);

      const view = await service.getStockIssue(ACTOR, WAREHOUSE, ORDER_ID);

      expect(view.issued).toBe(false);
      expect(view.voucher).toBeUndefined();
      expect(view.canIssue).toBe(true);
      expect(view.lines.map((l) => l.productId)).toEqual([P1]);
      expect(view.untrackedItems).toEqual(['Công lắp đặt', 'Phí khảo sát']);
      expect(stockVouchers.previewOrderIssue).toHaveBeenCalledWith([
        { productId: P1, qty: 10 },
        { productId: 'p-install', qty: 1 },
      ]);
    });

    it('delivery.confirm only ⇒ canIssue false', async () => {
      const view = await service.getStockIssue(ACTOR, DELIVERY_ONLY, ORDER_ID);
      expect(view.canIssue).toBe(false);
    });

    it('dachot (equipment-only direct close) ⇒ canIssue true', async () => {
      givenOrder(order('dachot'));
      const view = await service.getStockIssue(ACTOR, WAREHOUSE, ORDER_ID);
      expect(view.canIssue).toBe(true);
    });

    it('status without a standalone issue ⇒ canIssue false', async () => {
      givenOrder(order('dagiao'));
      const view = await service.getStockIssue(ACTOR, WAREHOUSE, ORDER_ID);
      expect(view.canIssue).toBe(false);
    });

    it('no tracked line ⇒ canIssue false', async () => {
      stockVouchers.previewOrderIssue = recorded('previewOrderIssue', {
        lines: [],
        tracked: new Set(),
      });
      const view = await service.getStockIssue(ACTOR, WAREHOUSE, ORDER_ID);
      expect(view.canIssue).toBe(false);
    });

    it('issued ⇒ issued + voucher, lines/untrackedItems empty, order lines not read', async () => {
      stockVouchers.findOrderIssueVoucher = recorded(
        'findOrderIssueVoucher',
        VOUCHER,
      );

      const view = await service.getStockIssue(ACTOR, WAREHOUSE, ORDER_ID);

      expect(view).toEqual({
        issued: true,
        voucher: VOUCHER,
        canIssue: false,
        lines: [],
        untrackedItems: [],
      });
      expect(lineRepo.findMany).not.toHaveBeenCalled();
    });

    it('out of scope ⇒ 404 before any stock read', async () => {
      orderRepo.findFirst = recorded('order.findFirst', null);
      const err = await caught(
        service.getStockIssue(ACTOR, WAREHOUSE, ORDER_ID),
      );
      expect(err.getStatus()).toBe(404);
      expect(stockVouchers.findOrderIssueVoucher).not.toHaveBeenCalled();
    });
  });
});
