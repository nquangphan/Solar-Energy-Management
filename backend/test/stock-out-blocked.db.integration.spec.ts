import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import type { AppException } from '../src/common/errors/app.exception';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventBus } from '../src/events/event-bus';
import { quoteStockLine } from '../src/inventory/domain/stock-shortfall';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for blocked stock-outs and the quote stock warning — facts
 * a mock cannot prove:
 *  - a refused stock-out (free-standing, standalone order issue, "Đã giao") rolls everything
 *    back AND leaves exactly ONE `StockOutBlocked` audit row through the real AD-18 path;
 *  - the figures on that event are read UNDER the products lock (forced interleaving);
 *  - confirming an order is never blocked by stock;
 *  - the quote warning's `reserved` excludes what the order itself holds (real ledger SUM).
 *
 * REAL bus → REAL `AuditService`. SKIPS itself without `DATABASE_URL` ⇒ default `npm test`
 * stays HERMETIC. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Blocked stock-out + quote stock warning on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let vouchers: StockVouchersService;

  const ACTOR = 'acc-stock-out-blocked-65';
  const PHONE = '+84900000650';
  const SKU = 'TEST65-';
  let sourceId: string;

  const PERMISSIONS = new Set<string>([
    PERM.ordersViewAll,
    PERM.ordersConfirm,
    PERM.quotesCreateEdit,
    PERM.inventoryManage,
    PERM.deliveryConfirm,
  ]);

  /** Delete in FK order everything this file's fixtures create. */
  async function cleanUp(): Promise<void> {
    const found = await prisma.order.findMany({
      where: { customerSdt: PHONE },
      select: { id: true },
    });
    const orderIds = found.map((o) => o.id);
    const productRows = await prisma.product.findMany({
      where: { sku: { startsWith: SKU } },
      select: { id: true },
    });
    const productIds = productRows.map((p) => p.id);

    await prisma.stockMovement.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.stockVoucherLine.deleteMany({
      where: { stockVoucher: { createdByAccountId: ACTOR } },
    });
    await prisma.stockVoucher.deleteMany({
      where: { createdByAccountId: ACTOR },
    });
    await prisma.attachment.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.auditLog.deleteMany({ where: { actorAccountId: ACTOR } });
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { currentVersionId: null },
    });
    await prisma.orderLineItem.deleteMany({
      where: { orderVersion: { orderId: { in: orderIds } } },
    });
    await prisma.orderVersion.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.deleteMany({ where: { sdt: PHONE } });
    await prisma.stockItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
  }

  let productCount = 0;
  async function createProduct(
    opts: { onHand?: number; tracksStock?: boolean } = {},
  ): Promise<string> {
    productCount += 1;
    const p = await prisma.product.create({
      data: {
        name: `Test65 SP ${String(productCount).padStart(2, '0')}`,
        sku: `${SKU}${productCount}`,
        unit: 'tấm',
        price: 3_000_000,
        costPrice: 1_000,
        tracksStock: opts.tracksStock ?? true,
      },
    });
    if (opts.onHand !== undefined) {
      await prisma.stockItem.create({
        data: { productId: p.id, onHand: opts.onHand },
      });
    }
    return p.id;
  }

  /** An order at `status` with a current version; snapshot set unless `baogia`. */
  async function createOrder(
    status: string,
    lines: { productId: string | null; qty: number }[],
  ): Promise<{ id: string; versionId: string }> {
    const created = await prisma.order.create({
      data: {
        status,
        customerSdt: PHONE,
        ownerAccountId: ACTOR,
        sourceId,
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: false,
        scopeVanChuyen: true,
      },
    });
    const version = await prisma.orderVersion.create({
      data: { orderId: created.id, versionNo: 1 },
    });
    for (const [i, l] of lines.entries()) {
      await prisma.orderLineItem.create({
        data: {
          orderVersionId: version.id,
          productId: l.productId,
          name: l.productId === null ? 'Phí tự do' : `Dòng ${i}`,
          unit: 'tấm',
          qty: l.qty,
          unitPrice: 500,
          priceEditable: true,
          unitPriceSnapshot: status === 'baogia' ? null : 500,
          displayOrder: i,
        },
      });
    }
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    return { id: created.id, versionId: version.id };
  }

  async function onHand(productId: string): Promise<number | null> {
    const s = await prisma.stockItem.findUnique({ where: { productId } });
    return s?.onHand ?? null;
  }

  async function statusOf(orderId: string): Promise<string> {
    return (await prisma.order.findUniqueOrThrow({ where: { id: orderId } }))
      .status;
  }

  function blockedRows(where: { targetId?: string | null } = {}) {
    return prisma.auditLog.findMany({
      where: { actorAccountId: ACTOR, eventType: 'StockOutBlocked', ...where },
    });
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function rejection(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (e) {
      return e as AppException;
    }
    throw new Error('Expected an AppException, got none.');
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const audit = new AuditService(prisma as unknown as PrismaService);
    const bus = {
      publish: async (event: DomainEvent) => {
        await audit.record(event);
      },
      subscribe: () => {},
    } as unknown as EventBus;
    vouchers = new StockVouchersService(
      prisma as unknown as PrismaService,
      bus,
    );
    orders = new OrdersService(
      prisma as unknown as PrismaService,
      bus,
      fakeStorage(),
      vouchers,
      new StockItemsService(prisma as unknown as PrismaService),
    );

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('CustomerSource not seeded — run `npx prisma db seed`.');
    }
    sourceId = facebook.id;

    await cleanUp();
    await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'stock-out-blocked-65@test.local',
        passwordHash: 'x',
        displayName: 'Người test chặn xuất',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Khách test chặn xuất',
        sourceId,
      },
    });
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actorAccountId: ACTOR } });
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('confirming is NOT blocked by stock: a tracked line with on-hand 0 ⇒ dachot, stock and vouchers untouched', async () => {
    const panel = await createProduct({ onHand: 0 });
    const o = await createOrder('baogia', [{ productId: panel, qty: 5 }]);
    const check = await orders.getStockCheck(ACTOR, PERMISSIONS, o.id);
    expect(check.lines[0]).toMatchObject({ status: 'short', shortfall: 5 });
    const vouchersBefore = await prisma.stockVoucher.count();

    await orders.confirm(ACTOR, o.id, 8, false, PERMISSIONS);

    expect(await statusOf(o.id)).toBe('dachot');
    expect(await onHand(panel)).toBe(0);
    expect(await prisma.stockVoucher.count()).toBe(vouchersBefore);
    expect(await blockedRows()).toHaveLength(0);
  });

  it('free-standing stock-out beyond on-hand ⇒ 409; on-hand intact; 0 new vouchers; exactly 1 StockOutBlocked row without target', async () => {
    const panel = await createProduct({ onHand: 4 });

    const err = await rejection(
      vouchers.taoPhieu(
        { type: 'xuat', lines: [{ productId: panel, qty: 6 }] },
        ACTOR,
      ),
    );

    expect(err.getStatus()).toBe(409);
    expect(await onHand(panel)).toBe(4);
    expect(
      await prisma.stockVoucher.count({ where: { createdByAccountId: ACTOR } }),
    ).toBe(0);
    const rows = await blockedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].targetType).toBeNull();
    expect(rows[0].targetId).toBeNull();
    expect(rows[0].after).toEqual({
      lines: [{ productId: panel, qty: 6, onHand: 4 }],
    });
  });

  for (const [door, run] of [
    [
      'standalone issue',
      (id: string) => orders.issueStock(ACTOR, PERMISSIONS, id),
    ],
    [
      '"Đã giao"',
      (id: string) =>
        orders.chuyenTrangThaiThuCong({
          callerAccountId: ACTOR,
          quyen: PERMISSIONS,
          orderId: id,
          event: SU_KIEN.xongGiao,
          anh: [],
        }),
    ],
  ] as const) {
    it(`${door}, one product enough + one short ⇒ 409; order stays danggiao; 0 vouchers; both on-hand intact; 1 StockOutBlocked row on the order with ONLY the short product`, async () => {
      const enough = await createProduct({ onHand: 10 });
      const short = await createProduct({ onHand: 2 });
      const o = await createOrder('danggiao', [
        { productId: enough, qty: 3 },
        { productId: short, qty: 5 },
      ]);

      const err = await rejection(run(o.id));

      expect(err.getStatus()).toBe(409);
      expect(await statusOf(o.id)).toBe('danggiao');
      expect(
        await prisma.stockVoucher.count({ where: { orderId: o.id } }),
      ).toBe(0);
      expect(await onHand(enough)).toBe(10);
      expect(await onHand(short)).toBe(2);
      const rows = await blockedRows({ targetId: o.id });
      expect(rows).toHaveLength(1);
      expect(rows[0].targetType).toBe('Order');
      expect(rows[0].after).toEqual({
        orderId: o.id,
        orderVersionId: o.versionId,
        lines: [{ productId: short, qty: 5, onHand: 2 }],
      });
      expect(await blockedRows()).toHaveLength(1);
      expect(
        await prisma.auditLog.count({
          where: {
            actorAccountId: ACTOR,
            eventType: { in: ['StatusChanged', 'StockIssued'] },
          },
        }),
      ).toBe(0);
    });
  }

  it('🔴 FORCED: another tx holds the products lock and zeroes on-hand uncommitted ⇒ the issue waits, is refused, and the event carries the on-hand read UNDER the lock (0), not the 10 before it', async () => {
    const panel = await createProduct({ onHand: 10 });
    const o = await createOrder('danggiao', [{ productId: panel, qty: 3 }]);

    let release!: () => void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    const otherTx = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${panel} FOR UPDATE`;
        await tx.$executeRaw`UPDATE stock_items SET on_hand = 0 WHERE product_id = ${panel}`;
        await holding;
      },
      { timeout: 10_000 },
    );
    await wait(150);

    const issuing = rejection(orders.issueStock(ACTOR, PERMISSIONS, o.id));
    await wait(300);

    release();
    await otherTx;
    const err = await issuing;

    expect(err.getStatus()).toBe(409);
    const rows = await blockedRows({ targetId: o.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].after).toMatchObject({
      lines: [{ productId: panel, qty: 3, onHand: 0 }],
    });
  });

  it('quote warning after the order took its stock ⇒ no lines (its own issued goods are not "to bring in")', async () => {
    const panel = await createProduct({ onHand: 3 });
    const o = await createOrder('dachot', [{ productId: panel, qty: 3 }]);
    expect(
      (await orders.getStockCheck(ACTOR, PERMISSIONS, o.id)).lines,
    ).toHaveLength(1);

    await orders.issueStock(ACTOR, PERMISSIONS, o.id);

    expect(await onHand(panel)).toBe(0);
    expect(await orders.getStockCheck(ACTOR, PERMISSIONS, o.id)).toEqual({
      lines: [],
    });
  });

  it("quote warning: reserved excludes the order's own hold — +3 held for X, +2 for Y on one product ⇒ X sees 2, Y sees 3", async () => {
    const panel = await createProduct({ onHand: 4 });
    const x = await createOrder('baogia', [{ productId: panel, qty: 2 }]);
    const y = await createOrder('baogia', [{ productId: panel, qty: 2 }]);
    const si = await prisma.stockItem.findUniqueOrThrow({
      where: { productId: panel },
    });
    await prisma.$executeRaw`INSERT INTO stock_movements (id, stock_item_id, order_id, order_version_id, qty, type)
      VALUES (gen_random_uuid()::text, ${si.id}, ${x.id}, ${x.versionId}, 3, 'reserve')`;
    await prisma.$executeRaw`INSERT INTO stock_movements (id, stock_item_id, order_id, order_version_id, qty, type)
      VALUES (gen_random_uuid()::text, ${si.id}, ${y.id}, ${y.versionId}, 2, 'reserve')`;

    const forX = (await orders.getStockCheck(ACTOR, PERMISSIONS, x.id))
      .lines[0];
    const forY = (await orders.getStockCheck(ACTOR, PERMISSIONS, y.id))
      .lines[0];

    // Derived figures computed by the real domain function, not typed by hand.
    expect(forX).toMatchObject({
      onHand: 4,
      reserved: 2,
      ...quoteStockLine({ qty: 2, onHand: 4, reserved: 2 }),
    });
    expect(forY).toMatchObject({
      onHand: 4,
      reserved: 3,
      ...quoteStockLine({ qty: 2, onHand: 4, reserved: 3 }),
    });
    expect(forX.status).toBe('enough');
    expect(forY.status).toBe('short');
  });
});
