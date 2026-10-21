import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { AppException } from '../src/common/errors/app.exception';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventBus } from '../src/events/event-bus';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for the stock reservation written when an order is
 * confirmed — facts a mock cannot prove:
 *  - confirm writes one `reserve` row per stock-tracked product, in the same commit, and the
 *    stock read path (`reserved = SUM(qty)`) sees it; confirming is never blocked by stock;
 *  - retries and real parallel confirms leave exactly ONE set of rows;
 *  - re-confirm releases what the older version holds (append-only) and reserves the new one;
 *  - the order-bound stock issue then releases exactly the current hold;
 *  - the unique key and the sign CHECK stand on their own;
 *  - the `products` FOR UPDATE lock is really taken (forced interleaving).
 *
 * SKIPS itself without `DATABASE_URL` ⇒ default `npm test` stays HERMETIC. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Stock reservation at order confirm on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let vouchers: StockVouchersService;
  let stockItems: StockItemsService;
  const published: DomainEvent[] = [];

  const ACTOR = 'acc-stock-reserve-66';
  const OUTSIDER = 'acc-stock-reserve-66-outsider';
  const PHONE = '+84900000660';
  const SKU = 'TEST66-';
  let sourceId: string;

  const ALL = new Set<string>(Object.values(PERM));

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
    await prisma.auditLog.deleteMany({ where: { actorAccountId: ACTOR } });
    await prisma.discountApproval.deleteMany({
      where: { orderId: { in: orderIds } },
    });
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
        name: `Test66 SP ${String(productCount).padStart(2, '0')}`,
        sku: `${SKU}${productCount}`,
        unit: 'tấm',
        price: 1_000_000,
        costPrice: 100,
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

  /** An open quote (`baogia`) with a current version and the given lines (`null` = free text). */
  async function createQuote(
    lines: { productId: string | null; qty: number }[],
  ): Promise<{ id: string; versionId: string }> {
    const created = await prisma.order.create({
      data: {
        status: 'baogia',
        customerSdt: PHONE,
        ownerAccountId: ACTOR,
        sourceId,
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: false,
        scopeVanChuyen: false,
      },
    });
    const version = await prisma.orderVersion.create({
      data: { orderId: created.id, versionNo: 1 },
    });
    await addLines(version.id, lines);
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    return { id: created.id, versionId: version.id };
  }

  async function addLines(
    versionId: string,
    lines: { productId: string | null; qty: number }[],
  ): Promise<void> {
    for (const [i, l] of lines.entries()) {
      await prisma.orderLineItem.create({
        data: {
          orderVersionId: versionId,
          productId: l.productId,
          name: l.productId === null ? 'Phí tự do' : `Dòng ${i}`,
          unit: 'tấm',
          qty: l.qty,
          unitPrice: 1_000_000,
          displayOrder: i,
        },
      });
    }
  }

  function confirm(orderId: string, actor = ACTOR, perms = ALL) {
    return orders.confirm(actor, orderId, 8, false, perms);
  }

  /** Reopen, then replace the new version's lines. Returns the new version id. */
  async function reviseWith(
    orderId: string,
    lines: { productId: string | null; qty: number }[],
  ): Promise<string> {
    await orders.revise(ACTOR, orderId, false, ALL);
    const { currentVersionId } = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    await prisma.orderLineItem.deleteMany({
      where: { orderVersionId: currentVersionId! },
    });
    await addLines(currentVersionId!, lines);
    return currentVersionId!;
  }

  /** Ledger rows of an order as [versionId, productId, type, qty], oldest first. */
  async function ledger(
    orderId: string,
  ): Promise<[string, string, string, number][]> {
    const rows = await prisma.stockMovement.findMany({
      where: { orderId },
      include: { stockItem: { select: { productId: true } } },
      orderBy: [{ createdAt: 'asc' }, { type: 'desc' }],
    });
    return rows.map((r) => [
      r.orderVersionId,
      r.stockItem.productId,
      r.type,
      r.qty,
    ]);
  }

  async function stockOf(productId: string) {
    const list = await stockItems.lietKeTonKho({ productIds: [productId] });
    return list.items[0];
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
    throw new Error('Expected an error, got none.');
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const bus = {
      publish: async (event: DomainEvent) => {
        published.push(event);
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
        email: 'stock-reserve-66@test.local',
        passwordHash: 'x',
        displayName: 'Người test giữ chỗ tồn',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Khách test giữ chỗ tồn',
        sourceId,
      },
    });
  });

  beforeEach(() => {
    published.length = 0;
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  describe('first confirm', () => {
    it('one reserve row per stock-tracked product (same-product lines merged; untracked and free-text lines get none); onHand unchanged; the stock read path sees it', async () => {
      const a = await createProduct({ onHand: 10 });
      const b = await createProduct({ onHand: 10 });
      const c = await createProduct({ tracksStock: false });
      const o = await createQuote([
        { productId: a, qty: 3 },
        { productId: a, qty: 2 },
        { productId: b, qty: 4 },
        { productId: c, qty: 1 },
        { productId: null, qty: 1 },
      ]);

      const view = await confirm(o.id);

      expect(view.status).toBe('dachot');
      expect((await ledger(o.id)).sort()).toEqual(
        [
          [o.versionId, a, 'reserve', 5],
          [o.versionId, b, 'reserve', 4],
        ].sort(),
      );
      expect(await stockOf(a)).toMatchObject({
        onHand: 10,
        reserved: 5,
        khaDung: 5,
      });
      expect(await stockOf(b)).toMatchObject({ onHand: 10, reserved: 4 });
      expect(
        await prisma.stockItem.findUnique({ where: { productId: c } }),
      ).toBeNull();
    });

    it('short stock does NOT block: on-hand 1, order needs 5 ⇒ confirmed, reserved 5, available −4, to buy 4, no StockOutBlocked', async () => {
      const a = await createProduct({ onHand: 1 });
      const o = await createQuote([{ productId: a, qty: 5 }]);

      const view = await confirm(o.id);

      expect(view.status).toBe('dachot');
      expect(await ledger(o.id)).toEqual([[o.versionId, a, 'reserve', 5]]);
      expect(await stockOf(a)).toMatchObject({
        onHand: 1,
        reserved: 5,
        khaDung: -4,
        canNhap: 4,
      });
      expect(published.map((e) => e.type)).not.toContain('StockOutBlocked');
    });

    it('a product with no stock row yet gets one lazily (on-hand 0)', async () => {
      const a = await createProduct();
      const o = await createQuote([{ productId: a, qty: 2 }]);

      await confirm(o.id);

      expect(
        await prisma.stockItem.findUniqueOrThrow({ where: { productId: a } }),
      ).toMatchObject({ onHand: 0 });
      expect(await stockOf(a)).toMatchObject({ reserved: 2, khaDung: -2 });
    });

    it('a caller outside the order scope ⇒ 404 and the ledger stays empty', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 2 }]);

      const err = await rejection(
        confirm(
          o.id,
          OUTSIDER,
          new Set([PERM.ordersViewOwn, PERM.ordersConfirm]),
        ),
      );

      expect(err.getStatus()).toBe(404);
      expect(await ledger(o.id)).toEqual([]);
    });
    it('an order coming from an approved discount (choduyet) reserves exactly like a plain quote', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 3 }]);
      await prisma.order.update({
        where: { id: o.id },
        data: { status: 'choduyet' },
      });
      await prisma.discountApproval.create({
        data: {
          orderId: o.id,
          orderVersionId: o.versionId,
          amount: 100_000,
          status: 'dong_y',
          requestedByAccountId: ACTOR,
        },
      });

      const view = await confirm(o.id);

      expect(view.status).toBe('dachot');
      expect(await ledger(o.id)).toEqual([[o.versionId, a, 'reserve', 3]]);
      expect((await stockOf(a)).reserved).toBe(3);
    });

    it('the reservation fails mid-way ⇒ the whole confirm rolls back: still a quote, no snapshot, no ledger row, nothing published', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 2 }]);
      const original = vouchers.reserveForOrderInTx.bind(vouchers);
      const spy = jest
        .spyOn(vouchers, 'reserveForOrderInTx')
        .mockImplementationOnce(async (tx, input) => {
          await original(tx, input);
          throw new Error('reservation failed after writing');
        });

      try {
        await expect(confirm(o.id)).rejects.toThrow(
          'reservation failed after writing',
        );
      } finally {
        spy.mockRestore();
      }

      expect(
        await prisma.order.findUniqueOrThrow({ where: { id: o.id } }),
      ).toMatchObject({ status: 'baogia' });
      expect(
        await prisma.orderVersion.findUniqueOrThrow({
          where: { id: o.versionId },
        }),
      ).toMatchObject({ chotAt: null });
      expect(await ledger(o.id)).toEqual([]);
      expect((await stockOf(a)).reserved).toBe(0);
      expect(published).toHaveLength(0);
    });
  });

  describe('idempotency', () => {
    it('confirm called again on a confirmed order ⇒ same ledger, nothing published', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 3 }]);
      await confirm(o.id);
      published.length = 0;

      const again = await confirm(o.id);

      expect(again.status).toBe('dachot');
      expect(await ledger(o.id)).toEqual([[o.versionId, a, 'reserve', 3]]);
      expect(published).toHaveLength(0);
    });

    it('two real confirms of one order in parallel ⇒ both 200, exactly ONE reserve row per product', async () => {
      const a = await createProduct({ onHand: 10 });
      const b = await createProduct({ onHand: 10 });
      const o = await createQuote([
        { productId: a, qty: 3 },
        { productId: b, qty: 1 },
      ]);

      const results = await Promise.allSettled([confirm(o.id), confirm(o.id)]);

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect((await ledger(o.id)).sort()).toEqual(
        [
          [o.versionId, a, 'reserve', 3],
          [o.versionId, b, 'reserve', 1],
        ].sort(),
      );
      expect((await stockOf(a)).reserved).toBe(3);
      expect(published.filter((e) => e.type === 'OrderConfirmed')).toHaveLength(
        1,
      );
    });
  });

  describe('stale version', () => {
    it('a confirm + reopen landing between a confirm read and its lock ⇒ the stale confirm is refused (409), the dead version is not re-frozen and the newer one holds nothing', async () => {
      const a = await createProduct({ onHand: 10 });
      const b = await createProduct({ onHand: 10 });
      const o = await createQuote([
        { productId: a, qty: 5 },
        { productId: b, qty: 4 },
      ]);
      // The pre-tx line read of the stale confirm is where it stalls: another confirm and a
      // reopen commit right there, before the stale confirm takes the order lock.
      let v2 = '';
      const original = prisma.orderLineItem.findMany.bind(prisma.orderLineItem);
      const spy = jest
        .spyOn(prisma.orderLineItem, 'findMany')
        .mockImplementationOnce((async (args: unknown) => {
          await confirm(o.id);
          v2 = await reviseWith(o.id, [{ productId: a, qty: 1 }]);
          return original(args as Parameters<typeof original>[0]);
        }) as unknown as typeof prisma.orderLineItem.findMany);

      let err: AppException;
      try {
        err = await rejection(confirm(o.id));
      } finally {
        spy.mockRestore();
      }

      expect(err.getStatus()).toBe(409);
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: o.id },
      });
      expect(order).toMatchObject({ status: 'baogia', currentVersionId: v2 });
      expect(
        await prisma.orderVersion.findUniqueOrThrow({ where: { id: v2 } }),
      ).toMatchObject({ chotAt: null });
      expect((await ledger(o.id)).sort()).toEqual(
        [
          [o.versionId, a, 'reserve', 5],
          [o.versionId, b, 'reserve', 4],
        ].sort(),
      );
      // Re-confirming the CURRENT version then frees the old hold, B included.
      await confirm(o.id);
      expect((await stockOf(a)).reserved).toBe(1);
      expect((await stockOf(b)).reserved).toBe(0);
    });
  });

  describe('re-confirm after reopening', () => {
    it('reopening alone releases nothing, and the order own hold does not warn it on its quote', async () => {
      const a = await createProduct({ onHand: 5 });
      const o = await createQuote([{ productId: a, qty: 5 }]);
      await confirm(o.id);

      await orders.revise(ACTOR, o.id, false, ALL);

      expect(await ledger(o.id)).toEqual([[o.versionId, a, 'reserve', 5]]);
      expect((await stockOf(a)).reserved).toBe(5);
      const check = await orders.getStockCheck(ACTOR, ALL, o.id);
      expect(check.lines).toEqual([
        expect.objectContaining({ productId: a, status: 'enough' }),
      ]);
    });

    it('releases what the old version holds and reserves the new version — old rows never updated; a second cycle releases only the newer version', async () => {
      const a = await createProduct({ onHand: 20 });
      const b = await createProduct({ onHand: 20 });
      const d = await createProduct({ onHand: 20 });
      const o = await createQuote([
        { productId: a, qty: 5 },
        { productId: b, qty: 4 },
      ]);
      await confirm(o.id);
      const v1Rows = await prisma.stockMovement.findMany({
        where: { orderVersionId: o.versionId },
      });

      const v2 = await reviseWith(o.id, [
        { productId: a, qty: 2 },
        { productId: d, qty: 3 },
      ]);
      await confirm(o.id);

      expect((await ledger(o.id)).sort()).toEqual(
        [
          [o.versionId, a, 'reserve', 5],
          [o.versionId, b, 'reserve', 4],
          [o.versionId, a, 'release', -5],
          [o.versionId, b, 'release', -4],
          [v2, a, 'reserve', 2],
          [v2, d, 'reserve', 3],
        ].sort(),
      );
      // Append-only: the original rows are byte-for-byte the same.
      expect(
        await prisma.stockMovement.findMany({
          where: { id: { in: v1Rows.map((r) => r.id) } },
        }),
      ).toEqual(expect.arrayContaining(v1Rows));
      expect((await stockOf(a)).reserved).toBe(2);
      expect((await stockOf(b)).reserved).toBe(0);
      expect((await stockOf(d)).reserved).toBe(3);

      const v3 = await reviseWith(o.id, [{ productId: a, qty: 1 }]);
      await confirm(o.id);

      const rows = await ledger(o.id);
      expect(rows.filter(([v]) => v === o.versionId)).toHaveLength(4);
      expect(rows.filter(([v]) => v === v2).sort()).toEqual(
        [
          [v2, a, 'reserve', 2],
          [v2, d, 'reserve', 3],
          [v2, a, 'release', -2],
          [v2, d, 'release', -3],
        ].sort(),
      );
      expect(rows.filter(([v]) => v === v3)).toEqual([[v3, a, 'reserve', 1]]);
      expect((await stockOf(a)).reserved).toBe(1);
      expect((await stockOf(d)).reserved).toBe(0);
    });

    it('re-confirm releases only THIS order hold — another order holding the same product keeps its reserve', async () => {
      const a = await createProduct({ onHand: 20 });
      const x = await createQuote([{ productId: a, qty: 4 }]);
      const y = await createQuote([{ productId: a, qty: 6 }]);
      await confirm(x.id);
      await confirm(y.id);

      const v2 = await reviseWith(x.id, [{ productId: a, qty: 1 }]);
      await confirm(x.id);

      expect(await ledger(y.id)).toEqual([[y.versionId, a, 'reserve', 6]]);
      expect((await ledger(x.id)).sort()).toEqual(
        [
          [x.versionId, a, 'reserve', 4],
          [x.versionId, a, 'release', -4],
          [v2, a, 'reserve', 1],
        ].sort(),
      );
      expect((await stockOf(a)).reserved).toBe(7);
    });

    it('an order confirmed before reservations existed (no ledger rows) re-confirms without any release — releases follow the ledger, not the old lines', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 5 }]);
      await prisma.order.update({
        where: { id: o.id },
        data: { status: 'dachot' },
      });

      const v2 = await reviseWith(o.id, [{ productId: a, qty: 2 }]);
      await confirm(o.id);

      expect(await ledger(o.id)).toEqual([[v2, a, 'reserve', 2]]);
      expect((await stockOf(a)).reserved).toBe(2);
    });

    it('a new version with no product line left (free text only) still releases the old hold', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 3 }]);
      await confirm(o.id);

      await reviseWith(o.id, [{ productId: null, qty: 1 }]);
      await confirm(o.id);

      expect(await ledger(o.id)).toEqual([
        [o.versionId, a, 'reserve', 3],
        [o.versionId, a, 'release', -3],
      ]);
      expect((await stockOf(a)).reserved).toBe(0);
    });

    it('a product that stopped tracking stock after the first confirm still has its hold released', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 4 }]);
      await confirm(o.id);
      await prisma.product.update({
        where: { id: a },
        data: { tracksStock: false },
      });

      await reviseWith(o.id, [{ productId: a, qty: 4 }]);
      await confirm(o.id);

      expect(await ledger(o.id)).toEqual([
        [o.versionId, a, 'reserve', 4],
        [o.versionId, a, 'release', -4],
      ]);
      const si = await prisma.stockItem.findUniqueOrThrow({
        where: { productId: a },
        include: { movements: true },
      });
      expect(si.movements.reduce((s, m) => s + m.qty, 0)).toBe(0);
    });
  });

  describe('order-bound stock issue after confirm', () => {
    it('releases exactly the confirmed hold (xuat −5 next to reserve +5), reserved back to 0, onHand −5', async () => {
      const a = await createProduct({ onHand: 0 });
      const o = await createQuote([{ productId: a, qty: 5 }]);
      await confirm(o.id);
      await vouchers.taoPhieu(
        { type: 'nhap', lines: [{ productId: a, qty: 5, unitCost: 100 }] },
        ACTOR,
      );

      await orders.issueStock(ACTOR, ALL, o.id);

      expect(await ledger(o.id)).toEqual([
        [o.versionId, a, 'reserve', 5],
        [o.versionId, a, 'xuat', -5],
      ]);
      expect(await stockOf(a)).toMatchObject({ onHand: 0, reserved: 0 });
    });

    it('after a re-confirm the issue releases the NEW version hold', async () => {
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 5 }]);
      await confirm(o.id);
      const v2 = await reviseWith(o.id, [{ productId: a, qty: 3 }]);
      await confirm(o.id);

      await orders.issueStock(ACTOR, ALL, o.id);

      expect((await ledger(o.id)).filter(([v]) => v === v2).sort()).toEqual(
        [
          [v2, a, 'reserve', 3],
          [v2, a, 'xuat', -3],
        ].sort(),
      );
      expect(await stockOf(a)).toMatchObject({ onHand: 7, reserved: 0 });
    });
  });

  describe('DB constraints on their own (raw SQL)', () => {
    let si: string;
    let o: { id: string; versionId: string };

    beforeAll(async () => {
      const a = await createProduct({ onHand: 0 });
      si = (
        await prisma.stockItem.findUniqueOrThrow({ where: { productId: a } })
      ).id;
      o = await createQuote([]);
    });

    function insert(qty: number, type: string) {
      return prisma.$executeRaw`INSERT INTO stock_movements (id, stock_item_id, order_id, order_version_id, qty, type)
        VALUES (gen_random_uuid()::text, ${si}, ${o.id}, ${o.versionId}, ${qty}, ${type})`;
    }

    async function errorText(p: Promise<unknown>): Promise<string> {
      const e = await rejection(p);
      return String((e as Error).message) + JSON.stringify(e);
    }

    it('a second reserve row for the same (version, product) ⇒ unique key violation; reserve + xuat on the same pair is accepted', async () => {
      await insert(2, 'reserve');

      expect(await errorText(insert(1, 'reserve'))).toContain(
        'stock_movements_order_version_id_stock_item_id_type_key',
      );
      await expect(insert(-2, 'xuat')).resolves.toBe(1);
    });

    it.each([
      [0, 'reserve'],
      [-1, 'reserve'],
      [0, 'release'],
      [1, 'release'],
      [1, 'xuat'],
      [3, 'giu'],
    ])('qty %d with type %s ⇒ sign CHECK violation', async (qty, type) => {
      expect(await errorText(insert(qty, type))).toContain(
        'stock_movements_qty_sign',
      );
    });
  });

  describe('🔴 products FOR UPDATE: FORCED interleaving', () => {
    it('another tx holds the product lock ⇒ confirm WAITS, then completes with the right ledger once released', async () => {
      // Drop `FOR UPDATE` from the reservation ⇒ nothing else on this path touches the
      // products row (its stock row already exists) ⇒ confirm finishes while the lock is held ⇒ RED.
      const a = await createProduct({ onHand: 10 });
      const o = await createQuote([{ productId: a, qty: 3 }]);

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${a} FOR UPDATE`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      let settled = false;
      const confirming = confirm(o.id).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);

      release();
      await otherTx;
      const view = await confirming;

      expect(view.status).toBe('dachot');
      expect(await ledger(o.id)).toEqual([[o.versionId, a, 'reserve', 3]]);
    });

    it('re-confirm also locks a product only the OLD version holds ⇒ it WAITS on that lock, then releases it', async () => {
      // Lock only the new version's products ⇒ the release of `b` is written without its
      // products lock (the release row references `stock_items`, not `products`) ⇒ RED.
      const a = await createProduct({ onHand: 10 });
      const b = await createProduct({ onHand: 10 });
      const o = await createQuote([
        { productId: a, qty: 2 },
        { productId: b, qty: 4 },
      ]);
      await confirm(o.id);
      await reviseWith(o.id, [{ productId: a, qty: 2 }]);

      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const otherTx = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${b} FOR UPDATE`;
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);

      let settled = false;
      const confirming = confirm(o.id).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);

      release();
      await otherTx;
      await confirming;

      expect((await stockOf(a)).reserved).toBe(2);
      expect((await stockOf(b)).reserved).toBe(0);
    });

    it('two different orders on one product with no stock row yet, confirmed in parallel ⇒ both confirmed, one stock row, reserved = sum', async () => {
      const a = await createProduct();
      const x = await createQuote([{ productId: a, qty: 2 }]);
      const y = await createQuote([{ productId: a, qty: 5 }]);

      const results = await Promise.allSettled([confirm(x.id), confirm(y.id)]);

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(await prisma.stockItem.count({ where: { productId: a } })).toBe(1);
      expect((await stockOf(a)).reserved).toBe(7);
    });

    it('confirm in parallel with a free-standing stock-in of the same products ⇒ no deadlock, final numbers right', async () => {
      const a = await createProduct({ onHand: 20 });
      const b = await createProduct({ onHand: 20 });
      const o = await createQuote([
        { productId: b, qty: 2 },
        { productId: a, qty: 3 },
      ]);

      await Promise.all([
        confirm(o.id),
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

      expect(await stockOf(a)).toMatchObject({ onHand: 25, reserved: 3 });
      expect(await stockOf(b)).toMatchObject({ onHand: 25, reserved: 2 });
    });
  });
});
