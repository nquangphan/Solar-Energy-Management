import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import { AppException } from '../src/common/errors/app.exception';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventBus } from '../src/events/event-bus';
import { tinhGiaVonBinhQuan } from '../src/inventory/domain/gia-von';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for the order-bound stock issue — facts a mock cannot prove:
 *  - stock + voucher + order-line cost + order status commit TOGETHER or not at all;
 *  - the frozen cost is the cost AT ISSUE (read after the `products` lock), not at Chốt;
 *  - the `orders → products` lock order serialises two issues of one order (exactly 1
 *    voucher) and does not deadlock with a free-standing voucher;
 *  - the "one order, one stock-out" unique and both CHECKs stand on their own;
 *  - the reservation is released by exactly what is held.
 *
 * REAL bus → REAL `AuditService`: audit rows come from the actual AD-18 path.
 *
 * SKIPS itself without `DATABASE_URL` ⇒ default `npm test` stays HERMETIC. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Order-bound stock issue on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let vouchers: StockVouchersService;
  let stockItems: StockItemsService;

  const ACTOR = 'acc-stock-issue-64';
  const PHONE = '+84900000640';
  const SKU = 'TEST64-';
  let sourceId: string;

  const PERMISSIONS = new Set<string>([
    PERM.ordersViewAll,
    PERM.inventoryManage,
    PERM.deliveryConfirm,
    PERM.constructionTransition,
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
    opts: { costPrice?: number; onHand?: number; tracksStock?: boolean } = {},
  ): Promise<string> {
    productCount += 1;
    const p = await prisma.product.create({
      data: {
        name: `Test64 SP ${String(productCount).padStart(2, '0')}`,
        sku: `${SKU}${productCount}`,
        unit: 'tấm',
        price: 3_000_000,
        costPrice: opts.costPrice ?? 0,
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

  /**
   * A confirmed order (lines carry `unitPriceSnapshot`) at the given status, with a current
   * version. Shipping on by default ⇒ the `danggiao → dagiao` path.
   */
  async function createOrder(
    status: string,
    lines: {
      productId: string | null;
      qty: number;
      unitPriceSnapshot: number;
    }[],
    scope: { vanChuyen?: boolean; thiCong?: boolean } = {},
  ): Promise<{ id: string; versionId: string; lineIds: string[] }> {
    const created = await prisma.order.create({
      data: {
        status,
        customerSdt: PHONE,
        ownerAccountId: ACTOR,
        sourceId,
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: scope.thiCong ?? false,
        scopeVanChuyen: scope.vanChuyen ?? true,
      },
    });
    const version = await prisma.orderVersion.create({
      data: { orderId: created.id, versionNo: 1 },
    });
    const lineIds: string[] = [];
    for (const [i, l] of lines.entries()) {
      const line = await prisma.orderLineItem.create({
        data: {
          orderVersionId: version.id,
          productId: l.productId,
          name: l.productId === null ? 'Phí tự do' : `Dòng ${i}`,
          unit: 'tấm',
          qty: l.qty,
          unitPrice: l.unitPriceSnapshot,
          unitPriceSnapshot: l.unitPriceSnapshot,
          displayOrder: i,
        },
      });
      lineIds.push(line.id);
    }
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    return { id: created.id, versionId: version.id, lineIds };
  }

  async function onHand(productId: string): Promise<number | null> {
    const s = await prisma.stockItem.findUnique({ where: { productId } });
    return s?.onHand ?? null;
  }

  async function lineCosts(lineIds: string[]): Promise<(number | null)[]> {
    const rows = await prisma.orderLineItem.findMany({
      where: { id: { in: lineIds } },
    });
    return lineIds.map(
      (id) => rows.find((r) => r.id === id)!.costPriceSnapshot,
    );
  }

  function voucherCount(orderId: string): Promise<number> {
    return prisma.stockVoucher.count({ where: { orderId } });
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function deliver(orderId: string, withPhoto = false) {
    return orders.chuyenTrangThaiThuCong({
      callerAccountId: ACTOR,
      quyen: PERMISSIONS,
      orderId,
      event: SU_KIEN.xongGiao,
      anh: withPhoto
        ? [
            {
              originalname: 'delivered.jpg',
              mimetype: 'image/jpeg',
              size: 10,
              buffer: Buffer.from('bytes'),
            },
          ]
        : [],
    });
  }

  async function statusOf(orderId: string): Promise<string> {
    return (await prisma.order.findUniqueOrThrow({ where: { id: orderId } }))
      .status;
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
    stockItems = new StockItemsService(prisma as unknown as PrismaService);
    orders = new OrdersService(
      prisma as unknown as PrismaService,
      bus,
      fakeStorage(),
      vouchers,
      stockItems,
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
        email: 'stock-issue-64@test.local',
        passwordHash: 'x',
        displayName: 'Người test xuất kho',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Khách test xuất kho',
        sourceId,
      },
    });
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  describe('standalone stock issue', () => {
    it('deducts onHand by the merged total; 1 xuat voucher bound to (order, version); tracked line cost = unit_cost, installation = selling price; status UNCHANGED; 1 StockIssued audit row', async () => {
      const panel = await createProduct({ costPrice: 2_000_000, onHand: 30 });
      const install = await createProduct({ tracksStock: false });
      const o = await createOrder('danggiao', [
        { productId: panel, qty: 6, unitPriceSnapshot: 3_000_000 },
        { productId: install, qty: 1, unitPriceSnapshot: 1_500_000 },
        { productId: panel, qty: 4, unitPriceSnapshot: 3_000_000 },
      ]);

      const result = await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      expect(result.created).toBe(true);
      expect(await onHand(panel)).toBe(20);
      const saved = await prisma.stockVoucher.findMany({
        where: { orderId: o.id },
        include: { lines: true },
      });
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        type: 'xuat',
        orderVersionId: o.versionId,
        createdByAccountId: ACTOR,
      });
      expect(saved[0].lines).toEqual([
        expect.objectContaining({
          productId: panel,
          qty: 10,
          unitCost: 2_000_000,
        }),
      ]);
      expect(await lineCosts(o.lineIds)).toEqual([
        2_000_000, 1_500_000, 2_000_000,
      ]);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status,
      ).toBe('danggiao');
      expect(
        await prisma.auditLog.count({
          where: { eventType: 'StockIssued', targetId: saved[0].id },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { eventType: 'StockVoucherCreated', targetId: saved[0].id },
        }),
      ).toBe(0);
    });

    it('cost AT ISSUE ≠ at Chốt: a stock-in after confirmation moves the cost ⇒ the snapshot is the NEW cost', async () => {
      const panel = await createProduct({ costPrice: 1_000_000, onHand: 10 });
      const o = await createOrder('dacoc', [
        { productId: panel, qty: 5, unitPriceSnapshot: 3_000_000 },
      ]);
      await vouchers.taoPhieu(
        {
          type: 'nhap',
          lines: [{ productId: panel, qty: 10, unitCost: 1_600_000 }],
        },
        ACTOR,
      );
      const newCost = tinhGiaVonBinhQuan({
        onHandTruoc: 10,
        giaVonTruoc: 1_000_000,
        qtyNhap: 10,
        donGiaNhap: 1_600_000,
      });

      await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      expect(newCost).toBe(1_300_000);
      expect(await lineCosts(o.lineIds)).toEqual([newCost]);
      expect(await onHand(panel)).toBe(15);
    });

    it('second call ⇒ still 1 voucher, onHand deducted once, no extra audit', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder('thicong', [
        { productId: panel, qty: 3, unitPriceSnapshot: 500 },
      ]);

      const first = await orders.issueStock(ACTOR, PERMISSIONS, o.id);
      const second = await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      expect(second).toEqual({ voucher: first.voucher, created: false });
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(7);
      expect(
        await prisma.auditLog.count({
          where: { eventType: 'StockIssued', targetId: first.voucher.id },
        }),
      ).toBe(1);
    });
  });

  describe('"Đã giao" step', () => {
    it('`danggiao --xong_giao-->` ⇒ dagiao + voucher + line cost in the SAME commit', async () => {
      const panel = await createProduct({ costPrice: 700, onHand: 5 });
      const o = await createOrder('danggiao', [
        { productId: panel, qty: 2, unitPriceSnapshot: 900 },
      ]);

      const result = await deliver(o.id);

      expect(result.status).toBe('dagiao');
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(3);
      expect(await lineCosts(o.lineIds)).toEqual([700]);
      const audit = await prisma.auditLog.findMany({
        where: { actorAccountId: ACTOR, occurredAt: result.occurredAt },
      });
      expect(audit.map((a) => a.eventType).sort()).toEqual([
        'StatusChanged',
        'StockIssued',
      ]);
    });

    it('customer pick-up `dacoc --xong_giao-->` (second edge into dagiao) also issues stock', async () => {
      const panel = await createProduct({ costPrice: 700, onHand: 5 });
      const o = await createOrder(
        'dacoc',
        [{ productId: panel, qty: 5, unitPriceSnapshot: 900 }],
        { vanChuyen: false },
      );

      const result = await deliver(o.id);

      expect(result.status).toBe('dagiao');
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(0);
    });

    it('already issued standalone ⇒ "Đã giao" only moves the status, still 1 voucher', async () => {
      const panel = await createProduct({ costPrice: 700, onHand: 5 });
      const o = await createOrder('danggiao', [
        { productId: panel, qty: 2, unitPriceSnapshot: 900 },
      ]);
      await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      const result = await deliver(o.id);

      expect(result.status).toBe('dagiao');
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(3);
    });

    it('short stock (one enough, one short) ⇒ 409; order stays danggiao, 0 vouchers, onHand untouched, costs null, 0 photos', async () => {
      const enough = await createProduct({ costPrice: 100, onHand: 10 });
      const short = await createProduct({ costPrice: 100, onHand: 1 });
      const o = await createOrder('danggiao', [
        { productId: enough, qty: 2, unitPriceSnapshot: 300 },
        { productId: short, qty: 4, unitPriceSnapshot: 300 },
      ]);

      const err = await deliver(o.id, true).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppException);
      expect((err as AppException).getStatus()).toBe(409);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status,
      ).toBe('danggiao');
      expect(await voucherCount(o.id)).toBe(0);
      expect(await onHand(enough)).toBe(10);
      expect(await onHand(short)).toBe(1);
      expect(await lineCosts(o.lineIds)).toEqual([null, null]);
      expect(await prisma.attachment.count({ where: { orderId: o.id } })).toBe(
        0,
      );
    });
  });

  describe('DB constraints standing alone', () => {
    it('unique (order_id, order_version_id): a raw second voucher for the same pair ⇒ error by name', async () => {
      const panel = await createProduct({ costPrice: 1, onHand: 5 });
      const o = await createOrder('dacoc', [
        { productId: panel, qty: 1, unitPriceSnapshot: 1 },
      ]);
      await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      await expect(
        prisma.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, order_id, order_version_id)
          VALUES (gen_random_uuid()::text, 'xuat', ${ACTOR}, ${o.id}, ${o.versionId})`,
      ).rejects.toThrow(/stock_vouchers_order_id_order_version_id_key/);
    });

    it('CHECK stock_vouchers_order_pair: order_id alone ⇒ error by name', async () => {
      const o = await createOrder('dacoc', []);

      await expect(
        prisma.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, order_id)
          VALUES (gen_random_uuid()::text, 'xuat', ${ACTOR}, ${o.id})`,
      ).rejects.toThrow(/stock_vouchers_order_pair/);
    });

    it('CHECK stock_vouchers_order_only_xuat: an order-bound nhap voucher ⇒ error by name', async () => {
      const o = await createOrder('dacoc', []);

      await expect(
        prisma.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, order_id, order_version_id)
          VALUES (gen_random_uuid()::text, 'nhap', ${ACTOR}, ${o.id}, ${o.versionId})`,
      ).rejects.toThrow(/stock_vouchers_order_only_xuat/);
    });

    it('free-standing vouchers (both columns null) never hit the unique', async () => {
      const panel = await createProduct({ costPrice: 1, onHand: 5 });

      await vouchers.taoPhieu(
        { type: 'xuat', lines: [{ productId: panel, qty: 1 }] },
        ACTOR,
      );
      await vouchers.taoPhieu(
        { type: 'xuat', lines: [{ productId: panel, qty: 1 }] },
        ACTOR,
      );

      expect(await onHand(panel)).toBe(3);
    });
  });

  it('reservation release: +5 held ⇒ exactly 1 extra −5 xuat movement, SUM back to 0; product with nothing held ⇒ no row; the stock read path sees the new numbers', async () => {
    const held = await createProduct({ costPrice: 10, onHand: 20 });
    const notHeld = await createProduct({ costPrice: 10, onHand: 20 });
    const o = await createOrder('dacoc', [
      { productId: held, qty: 5, unitPriceSnapshot: 50 },
      { productId: notHeld, qty: 2, unitPriceSnapshot: 50 },
    ]);
    const si = await prisma.stockItem.findUniqueOrThrow({
      where: { productId: held },
    });
    await prisma.$executeRaw`INSERT INTO stock_movements (id, stock_item_id, order_id, order_version_id, qty, type)
      VALUES (gen_random_uuid()::text, ${si.id}, ${o.id}, ${o.versionId}, 5, 'giu')`;
    const before = await stockItems.lietKeTonKho({ productIds: [held] });
    expect(before.items[0]).toMatchObject({ onHand: 20, reserved: 5 });

    await orders.issueStock(ACTOR, PERMISSIONS, o.id);

    const movements = await prisma.stockMovement.findMany({
      where: { orderId: o.id },
      orderBy: { qty: 'asc' },
    });
    expect(movements.map((m) => [m.stockItemId, m.qty, m.type])).toEqual([
      [si.id, -5, 'xuat'],
      [si.id, 5, 'giu'],
    ]);
    const after = await stockItems.lietKeTonKho({
      productIds: [held, notHeld],
    });
    expect(after.items.find((i) => i.productId === held)).toMatchObject({
      onHand: 15,
      reserved: 0,
    });
    expect(after.items.find((i) => i.productId === notHeld)).toMatchObject({
      onHand: 18,
      reserved: 0,
    });
  });

  describe('🔴 lock order orders → products: FORCED interleaving', () => {
    it('another tx holds the order row lock while inserting the order stock-out ⇒ the issue waits, sees that voucher, does NOT issue again', async () => {
      // Remove `lockOrderRow` from the issue path ⇒ the issue does not wait, reads "not
      // issued", locks products (the other tx does not hold them) and inserts a voucher ⇒
      // unique violation once the other tx commits ⇒ RED.
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder('danggiao', [
        { productId: panel, qty: 3, unitPriceSnapshot: 500 },
      ]);

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${o.id} FOR UPDATE`;
          await tx.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, order_id, order_version_id)
            VALUES (gen_random_uuid()::text, 'xuat', ${ACTOR}, ${o.id}, ${o.versionId})`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      const issuing = orders.issueStock(ACTOR, PERMISSIONS, o.id);
      await wait(300);

      release();
      await otherTx;
      const result = await issuing;

      expect(result.created).toBe(false);
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(10);
    });

    it('two real issues of one order in parallel ⇒ exactly 1 voucher, onHand deducted once, one creates and one returns it', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder('danggiao', [
        { productId: panel, qty: 3, unitPriceSnapshot: 500 },
      ]);

      const results = await Promise.allSettled([
        orders.issueStock(ACTOR, PERMISSIONS, o.id),
        orders.issueStock(ACTOR, PERMISSIONS, o.id),
      ]);

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      const created = results.map(
        (r) =>
          (r as PromiseFulfilledResult<{ created: boolean }>).value.created,
      );
      expect(created.sort()).toEqual([false, true]);
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(7);
    });

    it('another tx holds the products lock with an uncommitted cost change ⇒ the frozen cost is the value AFTER that commit', async () => {
      // Read costPrice BEFORE the products lock ⇒ snapshot of the old 100 ⇒ RED.
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder('danggiao', [
        { productId: panel, qty: 3, unitPriceSnapshot: 500 },
      ]);

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${panel} FOR UPDATE`;
          await tx.$executeRaw`UPDATE products SET cost_price = 777 WHERE id = ${panel}`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      const issuing = orders.issueStock(ACTOR, PERMISSIONS, o.id);
      await wait(300);

      release();
      await otherTx;
      const result = await issuing;

      expect(result.voucher.lines[0].unitCost).toBe(777);
      expect(await lineCosts(o.lineIds)).toEqual([777]);
    });

    it('order-bound issue in parallel with a free-standing stock-in of the same products ⇒ no deadlock, final onHand right', async () => {
      const a = await createProduct({ costPrice: 100, onHand: 20 });
      const b = await createProduct({ costPrice: 100, onHand: 20 });
      const o = await createOrder('danggiao', [
        { productId: b, qty: 2, unitPriceSnapshot: 500 },
        { productId: a, qty: 3, unitPriceSnapshot: 500 },
      ]);

      await Promise.all([
        orders.issueStock(ACTOR, PERMISSIONS, o.id),
        vouchers.taoPhieu(
          {
            type: 'nhap',
            lines: [
              { productId: a, qty: 5, unitCost: 100 },
              { productId: b, qty: 5, unitCost: 100 },
            ],
          },
          ACTOR,
        ),
      ]);

      expect(await onHand(a)).toBe(22);
      expect(await onHand(b)).toBe(23);
    });
  });

  describe('direct close dachot → hoan_thanh (equipment-only order)', () => {
    const NOT_ISSUED =
      'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.';
    const CASHIER = new Set<string>([PERM.ordersViewAll, PERM.paymentsRecord]);
    const EQUIPMENT_ONLY = { vanChuyen: false, thiCong: false };

    function close(orderId: string) {
      return orders.chuyenTrangThaiThuCong({
        callerAccountId: ACTOR,
        quyen: CASHIER,
        orderId,
        event: SU_KIEN.hoanThanh,
        anh: [],
      });
    }

    function autoClose(orderId: string) {
      return orders.chuyenTrangThaiTuDong({
        orderId,
        event: SU_KIEN.hoanThanh,
        actorAccountId: ACTOR,
        actorPermissions: CASHIER,
      });
    }

    it('stock-tracked lines not issued ⇒ 409; order stays dachot, 0 vouchers, onHand untouched', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'dachot',
        [{ productId: panel, qty: 4, unitPriceSnapshot: 500 }],
        EQUIPMENT_ONLY,
      );

      const err = await rejection(close(o.id));

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(NOT_ISSUED);
      expect(await statusOf(o.id)).toBe('dachot');
      expect(await voucherCount(o.id)).toBe(0);
      expect(await onHand(panel)).toBe(10);
    });

    it('standalone issue AT dachot (status unchanged, cost frozen), then the close goes through', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'dachot',
        [
          { productId: panel, qty: 4, unitPriceSnapshot: 500 },
          { productId: null, qty: 1, unitPriceSnapshot: 70 },
        ],
        EQUIPMENT_ONLY,
      );

      const issued = await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      expect(issued.created).toBe(true);
      expect(await statusOf(o.id)).toBe('dachot');
      expect(await onHand(panel)).toBe(6);
      expect(await lineCosts(o.lineIds)).toEqual([100, 70]);

      const closed = await close(o.id);

      expect(closed.status).toBe('hoanthanh');
      expect(await statusOf(o.id)).toBe('hoanthanh');
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(6);
    });

    it('no stock-tracked line (untracked product + free-text line) ⇒ closes directly, no voucher', async () => {
      const service = await createProduct({ costPrice: 0, tracksStock: false });
      const o = await createOrder(
        'dachot',
        [
          { productId: service, qty: 1, unitPriceSnapshot: 900 },
          { productId: null, qty: 1, unitPriceSnapshot: 70 },
        ],
        EQUIPMENT_ONLY,
      );

      expect((await close(o.id)).status).toBe('hoanthanh');
      expect(await voucherCount(o.id)).toBe(0);
    });

    it('auto lane (full payment) is gated by the same engine check ⇒ 409, order stays dachot', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'dachot',
        [{ productId: panel, qty: 1, unitPriceSnapshot: 500 }],
        EQUIPMENT_ONLY,
      );

      const err = await rejection(autoClose(o.id));

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(NOT_ISSUED);
      expect(await statusOf(o.id)).toBe('dachot');
    });

    it('🔴 FORCED: another tx holds the order row lock while inserting the stock-out ⇒ the close waits, sees that voucher, closes', async () => {
      // Run the check BEFORE the order lock ⇒ it reads "not issued" while the voucher is
      // uncommitted ⇒ 409 ⇒ RED.
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'dachot',
        [{ productId: panel, qty: 2, unitPriceSnapshot: 500 }],
        EQUIPMENT_ONLY,
      );

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${o.id} FOR UPDATE`;
          await tx.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, order_id, order_version_id)
            VALUES (gen_random_uuid()::text, 'xuat', ${ACTOR}, ${o.id}, ${o.versionId})`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      const closing = autoClose(o.id);
      await wait(300);

      release();
      await otherTx;
      await closing;

      expect(await statusOf(o.id)).toBe('hoanthanh');
    });

    it('🔴 FORCED: another tx holds the products lock while turning tracksStock ON ⇒ the close (pre-check passed) waits, reads it under the lock, 409', async () => {
      // Read `tracksStock` without the products lock (or drop the in-tx check) ⇒ the close
      // sees the pre-commit `false` and goes through ⇒ RED.
      const panel = await createProduct({
        costPrice: 100,
        onHand: 10,
        tracksStock: false,
      });
      const o = await createOrder(
        'dachot',
        [{ productId: panel, qty: 2, unitPriceSnapshot: 500 }],
        EQUIPMENT_ONLY,
      );

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${panel} FOR UPDATE`;
          await tx.$executeRaw`UPDATE products SET tracks_stock = true WHERE id = ${panel}`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      const closing = rejection(close(o.id));
      await wait(300);

      release();
      await otherTx;
      const err = await closing;

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(NOT_ISSUED);
      expect(await statusOf(o.id)).toBe('dachot');
    });

    it('re-opening an order issued at dachot ⇒ 409; still 1 version, 1 voucher, order stays dachot', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'dachot',
        [{ productId: panel, qty: 2, unitPriceSnapshot: 500 }],
        EQUIPMENT_ONLY,
      );
      await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      const err = await rejection(
        orders.revise(
          ACTOR,
          o.id,
          false,
          new Set([PERM.ordersViewAll, PERM.quotesCreateEdit]),
        ),
      );

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe('Đơn đã xuất kho — không mở lại để sửa được.');
      expect(
        await prisma.orderVersion.count({ where: { orderId: o.id } }),
      ).toBe(1);
      expect(await voucherCount(o.id)).toBe(1);
      expect(await statusOf(o.id)).toBe('dachot');
    });
  });
  describe('construction close nghiemthu → hoan_thanh (installation order)', () => {
    const NOT_ISSUED =
      'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.';
    const SUPERVISOR = new Set<string>([
      PERM.ordersViewAll,
      PERM.constructionTransition,
    ]);
    const INSTALLATION = { vanChuyen: false, thiCong: true };

    function close(orderId: string) {
      return orders.chuyenTrangThaiThuCong({
        callerAccountId: ACTOR,
        quyen: SUPERVISOR,
        orderId,
        event: SU_KIEN.hoanThanh,
        anh: [],
      });
    }

    function autoClose(orderId: string) {
      return orders.chuyenTrangThaiTuDong({
        orderId,
        event: SU_KIEN.hoanThanh,
        actorAccountId: ACTOR,
        actorPermissions: SUPERVISOR,
      });
    }

    it('stock-tracked lines not issued ⇒ 409 on both lanes; order stays nghiemthu, 0 vouchers, onHand untouched', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'nghiemthu',
        [{ productId: panel, qty: 4, unitPriceSnapshot: 500 }],
        INSTALLATION,
      );

      const manual = await rejection(close(o.id));
      const auto = await rejection(autoClose(o.id));

      expect(manual.getStatus()).toBe(409);
      expect(manual.message).toBe(NOT_ISSUED);
      expect(auto.getStatus()).toBe(409);
      expect(auto.message).toBe(NOT_ISSUED);
      expect(await statusOf(o.id)).toBe('nghiemthu');
      expect(await voucherCount(o.id)).toBe(0);
      expect(await onHand(panel)).toBe(10);
    });

    it('standalone issue AT nghiemthu (status unchanged, cost frozen), then the close goes through', async () => {
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'nghiemthu',
        [
          { productId: panel, qty: 4, unitPriceSnapshot: 500 },
          { productId: null, qty: 1, unitPriceSnapshot: 70 },
        ],
        INSTALLATION,
      );

      const issued = await orders.issueStock(ACTOR, PERMISSIONS, o.id);

      expect(issued.created).toBe(true);
      expect(await statusOf(o.id)).toBe('nghiemthu');
      expect(await onHand(panel)).toBe(6);
      expect(await lineCosts(o.lineIds)).toEqual([100, 70]);

      const closed = await close(o.id);

      expect(closed.status).toBe('hoanthanh');
      expect(await statusOf(o.id)).toBe('hoanthanh');
      expect(await voucherCount(o.id)).toBe(1);
      expect(await onHand(panel)).toBe(6);
    });

    it('🔴 FORCED: another tx holds the order row lock while inserting the stock-out ⇒ the close waits, sees that voucher, closes', async () => {
      // Run the check BEFORE the order lock ⇒ it reads "not issued" while the voucher is
      // uncommitted ⇒ 409 ⇒ RED.
      const panel = await createProduct({ costPrice: 100, onHand: 10 });
      const o = await createOrder(
        'nghiemthu',
        [{ productId: panel, qty: 2, unitPriceSnapshot: 500 }],
        INSTALLATION,
      );

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${o.id} FOR UPDATE`;
          await tx.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, order_id, order_version_id)
            VALUES (gen_random_uuid()::text, 'xuat', ${ACTOR}, ${o.id}, ${o.versionId})`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      const closing = autoClose(o.id);
      await wait(300);

      release();
      await otherTx;
      await closing;

      expect(await statusOf(o.id)).toBe('hoanthanh');
    });

    it('🔴 FORCED: another tx holds the products lock while turning tracksStock ON ⇒ the close (pre-check passed) waits, reads it under the lock, 409', async () => {
      const panel = await createProduct({
        costPrice: 100,
        onHand: 10,
        tracksStock: false,
      });
      const o = await createOrder(
        'nghiemthu',
        [{ productId: panel, qty: 2, unitPriceSnapshot: 500 }],
        INSTALLATION,
      );

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${panel} FOR UPDATE`;
          await tx.$executeRaw`UPDATE products SET tracks_stock = true WHERE id = ${panel}`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      const closing = rejection(close(o.id));
      await wait(300);

      release();
      await otherTx;
      const err = await closing;

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(NOT_ISSUED);
      expect(await statusOf(o.id)).toBe('nghiemthu');
    });
  });
});
