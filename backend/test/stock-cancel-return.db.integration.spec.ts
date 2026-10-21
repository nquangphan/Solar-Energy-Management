import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import { AppException } from '../src/common/errors/app.exception';
import type { DomainEvent } from '../src/events/domain-event';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import { tinhGiaVonBinhQuan } from '../src/inventory/domain/gia-von';
import { OrderCancelledStockSubscriber } from '../src/inventory/order-cancelled-stock.subscriber';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for what happens to stock when an order ENDS — facts a mock
 * cannot prove:
 *  - cancelling through the real `OrdersService` + real `InProcessEventBus` + real
 *    `OrderCancelledStockSubscriber` releases what the order holds (append-only, every version)
 *    and never adds `onHand`; completing an order releases what it still holds;
 *  - a return voucher counted from the origin stock-out puts stock back at the ORIGIN cost,
 *    moves the weighted average, writes no ledger row and one audit row;
 *  - the new unique, CHECK and FK stand on their own;
 *  - the `orders` / `products` FOR UPDATE locks are really taken (forced interleaving), and two
 *    parallel returns of one origin yield exactly one voucher.
 *
 * SKIPS itself without `DATABASE_URL` ⇒ default `npm test` stays HERMETIC. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb(
  'Stock on order cancel / completion and return vouchers on REAL Postgres',
  () => {
    let prisma: PrismaClient;
    let orders: OrdersService;
    let vouchers: StockVouchersService;
    let stockItems: StockItemsService;
    const published: DomainEvent[] = [];

    const ACTOR = 'acc-stock-cancel-67';
    const PHONE = '+84900000670';
    const SKU = 'TEST67-';
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
      // A return voucher RESTRICTs its origin ⇒ returns go first.
      await prisma.stockVoucher.deleteMany({
        where: { createdByAccountId: ACTOR, returnOfVoucherId: { not: null } },
      });
      await prisma.stockVoucher.deleteMany({
        where: { createdByAccountId: ACTOR },
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
      opts: { onHand?: number; tracksStock?: boolean; costPrice?: number } = {},
    ): Promise<string> {
      productCount += 1;
      const p = await prisma.product.create({
        data: {
          name: `Test67 SP ${String(productCount).padStart(2, '0')}`,
          sku: `${SKU}${productCount}`,
          unit: 'tấm',
          price: 3_000_000,
          costPrice: opts.costPrice ?? 100,
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
            unitPrice: 3_000_000,
            displayOrder: i,
          },
        });
      }
    }

    function confirm(orderId: string) {
      return orders.confirm(ACTOR, orderId, 8, false, ALL);
    }

    function cancel(orderId: string) {
      return orders.huyDon({
        callerAccountId: ACTOR,
        quyen: ALL,
        orderId,
        lyDo: 'Khách đổi ý, không lắp nữa',
      });
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

    /** Ledger rows with their ids, to prove old rows are never updated/deleted. */
    async function ledgerRows(orderId: string) {
      return prisma.stockMovement.findMany({
        where: { orderId },
        select: { id: true, qty: true, type: true },
        orderBy: { id: 'asc' },
      });
    }

    async function stockOf(productId: string) {
      const list = await stockItems.lietKeTonKho({ productIds: [productId] });
      return list.items[0];
    }

    async function voucherCount(): Promise<number> {
      return prisma.stockVoucher.count({
        where: { createdByAccountId: ACTOR },
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
      throw new Error('Expected an error, got none.');
    }

    /** Confirmed, issued, then cancelled order — returns the origin stock-out id. */
    async function cancelledAfterIssue(
      lines: { productId: string; qty: number }[],
    ): Promise<{ orderId: string; originId: string }> {
      const o = await createQuote(lines);
      await confirm(o.id);
      const { voucher } = await orders.issueStock(ACTOR, ALL, o.id);
      await cancel(o.id);
      return { orderId: o.id, originId: voucher.id };
    }

    /** Holds `SELECT … FOR UPDATE` on one row until `release()` is called. */
    function holdLock(
      table: 'orders' | 'products',
      id: string,
      underLock?: (t: Prisma.TransactionClient) => Promise<unknown>,
    ) {
      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      const tx = prisma.$transaction(
        async (t) => {
          if (table === 'orders') {
            await t.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`;
          } else {
            await t.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
          }
          await underLock?.(t);
          await holding;
        },
        { timeout: 10_000 },
      );
      return { release, tx };
    }

    beforeAll(async () => {
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      await prisma.$connect();
      const bus = new InProcessEventBus();
      bus.subscribe({
        handle: (event: DomainEvent) => {
          published.push(event);
        },
      });
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
      new OrderCancelledStockSubscriber(bus, vouchers).onModuleInit();
      new AuditSubscriber(
        bus,
        new AuditService(prisma as unknown as PrismaService),
      ).onModuleInit();

      const facebook = await prisma.customerSource.findUnique({
        where: { name: 'Facebook' },
      });
      if (facebook === null) {
        throw new Error(
          'CustomerSource not seeded — run `npx prisma db seed`.',
        );
      }
      sourceId = facebook.id;

      await cleanUp();
      await prisma.account.create({
        data: {
          id: ACTOR,
          email: 'stock-cancel-67@test.local',
          passwordHash: 'x',
          displayName: 'Người test nhập trả',
        },
      });
      await prisma.customer.create({
        data: {
          sdt: PHONE,
          custType: 'CA_NHAN',
          name: 'Khách test nhập trả',
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

    describe('cancel BEFORE stock issue ⇒ the hold is released right away', () => {
      it.each(['dachot', 'dacoc'])(
        'cancel from %s: exactly one release row per held product, old rows untouched, reserved 0, onHand unchanged, no voucher',
        async (from) => {
          const a = await createProduct({ onHand: 10 });
          const b = await createProduct({ onHand: 10 });
          const c = await createProduct({ tracksStock: false });
          const o = await createQuote([
            { productId: a, qty: 5 },
            { productId: b, qty: 4 },
            { productId: c, qty: 1 },
            { productId: null, qty: 1 },
          ]);
          await confirm(o.id);
          if (from === 'dacoc') {
            await prisma.order.update({
              where: { id: o.id },
              data: { status: 'dacoc' },
            });
          }
          const before = await ledgerRows(o.id);
          const vouchersBefore = await voucherCount();

          const result = await cancel(o.id);

          expect(result.status).toBe('huy');
          expect((await ledger(o.id)).sort()).toEqual(
            [
              [o.versionId, a, 'reserve', 5],
              [o.versionId, b, 'reserve', 4],
              [o.versionId, a, 'release', -5],
              [o.versionId, b, 'release', -4],
            ].sort(),
          );
          const after = await ledgerRows(o.id);
          for (const row of before) expect(after).toContainEqual(row);
          expect(await stockOf(a)).toMatchObject({ onHand: 10, reserved: 0 });
          expect(await stockOf(b)).toMatchObject({ onHand: 10, reserved: 0 });
          expect(await voucherCount()).toBe(vouchersBefore);
        },
      );
    });

    describe('cancel AFTER stock issue ⇒ stock is NOT added back by itself', () => {
      it('onHand unchanged, reserved 0, no ledger row, no voucher; the origin offers a return', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        const { voucher } = await orders.issueStock(ACTOR, ALL, o.id);
        const ledgerBefore = await ledger(o.id);
        const vouchersBefore = await voucherCount();

        await cancel(o.id);

        expect(await stockOf(a)).toMatchObject({ onHand: 5, reserved: 0 });
        expect(await ledger(o.id)).toEqual(ledgerBefore);
        expect(await voucherCount()).toBe(vouchersBefore);
        const origin = await vouchers.chiTietPhieu(voucher.id);
        expect(origin.canReturn).toBe(true);
        expect(origin.returnVoucher).toBeUndefined();
      });
    });

    describe('which versions are released', () => {
      it('reopened then cancelled ⇒ released on the OLD version, though the event names the new one', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        const v2 = await reviseWith(o.id, [{ productId: a, qty: 5 }]);

        await cancel(o.id);

        const event = published.find((e) => e.type === 'OrderCancelled') as
          (DomainEvent & { orderVersionId: string }) | undefined;
        expect(event?.orderVersionId).toBe(v2);
        expect(await ledger(o.id)).toEqual([
          [o.versionId, a, 'reserve', 5],
          [o.versionId, a, 'release', -5],
        ]);
        expect((await stockOf(a)).reserved).toBe(0);
      });

      it('re-confirmed then cancelled ⇒ only the current version is released; v1 untouched, no unique clash', async () => {
        const a = await createProduct({ onHand: 10 });
        const b = await createProduct({ onHand: 10 });
        const o = await createQuote([
          { productId: a, qty: 5 },
          { productId: b, qty: 4 },
        ]);
        await confirm(o.id);
        const v2 = await reviseWith(o.id, [{ productId: a, qty: 2 }]);
        await confirm(o.id);
        const beforeCancel = await ledger(o.id);

        await cancel(o.id);

        expect(await ledger(o.id)).toEqual([
          ...beforeCancel,
          [v2, a, 'release', -2],
        ]);
        expect((await stockOf(a)).reserved).toBe(0);
        expect((await stockOf(b)).reserved).toBe(0);
      });

      it('a product untracked after confirm is still released on cancel', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        await prisma.product.update({
          where: { id: a },
          data: { tracksStock: false },
        });

        await cancel(o.id);

        expect(await ledger(o.id)).toEqual([
          [o.versionId, a, 'reserve', 5],
          [o.versionId, a, 'release', -5],
        ]);
      });
    });

    describe('releaseForCancelledOrder — idempotent and harmless', () => {
      it('a second run writes nothing', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        await cancel(o.id);
        const once = await ledger(o.id);

        await vouchers.releaseForCancelledOrder(o.id);

        expect(await ledger(o.id)).toEqual(once);
      });

      it('cancelled from baogia (never confirmed) ⇒ no ledger, nothing written', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);

        await cancel(o.id);

        expect(await ledger(o.id)).toEqual([]);
      });

      it('called on a LIVE order ⇒ its hold stays', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);

        await vouchers.releaseForCancelledOrder(o.id);

        expect(await ledger(o.id)).toEqual([[o.versionId, a, 'reserve', 5]]);
        expect((await stockOf(a)).reserved).toBe(5);
      });
    });

    describe('completion (→ hoanthanh) releases what the order still holds', () => {
      it('a product untracked after confirm (so never issued) ⇒ released at the close, in the same commit', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        await prisma.product.update({
          where: { id: a },
          data: { tracksStock: false },
        });

        await orders.chuyenTrangThaiTuDong({
          orderId: o.id,
          event: SU_KIEN.hoanThanh,
          actorAccountId: ACTOR,
          actorPermissions: ALL,
        });

        expect(
          (await prisma.order.findUniqueOrThrow({ where: { id: o.id } }))
            .status,
        ).toBe('hoanthanh');
        expect(await ledger(o.id)).toEqual([
          [o.versionId, a, 'reserve', 5],
          [o.versionId, a, 'release', -5],
        ]);
        expect(await stockOf(a)).toMatchObject({ onHand: 10, reserved: 0 });
      });

      it('the ungated delivery close dagiao → hoanthanh releases too', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        await prisma.product.update({
          where: { id: a },
          data: { tracksStock: false },
        });
        // Fixture shortcut to the delivered state; the close under test is the real engine.
        await prisma.order.update({
          where: { id: o.id },
          data: { status: 'dagiao', scopeVanChuyen: true },
        });

        await orders.chuyenTrangThaiTuDong({
          orderId: o.id,
          event: SU_KIEN.hoanThanh,
          actorAccountId: ACTOR,
          actorPermissions: ALL,
        });

        expect(
          (await prisma.order.findUniqueOrThrow({ where: { id: o.id } }))
            .status,
        ).toBe('hoanthanh');
        expect(await ledger(o.id)).toEqual([
          [o.versionId, a, 'reserve', 5],
          [o.versionId, a, 'release', -5],
        ]);
        expect(await stockOf(a)).toMatchObject({ onHand: 10, reserved: 0 });
      });

      it('issued then closed ⇒ the ledger already nets to 0, nothing more is written', async () => {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        await orders.issueStock(ACTOR, ALL, o.id);
        const issued = await ledger(o.id);

        await orders.chuyenTrangThaiTuDong({
          orderId: o.id,
          event: SU_KIEN.hoanThanh,
          actorAccountId: ACTOR,
          actorPermissions: ALL,
        });

        expect(await ledger(o.id)).toEqual(issued);
        expect(await stockOf(a)).toMatchObject({ onHand: 5, reserved: 0 });
      });
    });

    describe('return voucher', () => {
      /**
       * A: issued 12 at cost 1_000_000, then a later stock-in moves today's cost to 1_400_000 ⇒
       * the return must use 1_000_000 and average against 1_400_000 (not an equivalent mutant).
       */
      async function issuedThenRestocked() {
        const a = await createProduct({ onHand: 12, costPrice: 1_000_000 });
        const b = await createProduct({ onHand: 2, costPrice: 300_000 });
        const { orderId, originId } = await cancelledAfterIssue([
          { productId: a, qty: 12 },
          { productId: b, qty: 2 },
        ]);
        await vouchers.taoPhieu(
          {
            type: 'nhap',
            lines: [{ productId: a, qty: 8, unitCost: 1_400_000 }],
          },
          ACTOR,
        );
        return { a, b, orderId, originId };
      }

      it('full return: PK-NT, origin link, origin line cost (= order cost snapshot), onHand back, weighted average, no ledger row, one audit row', async () => {
        const { a, b, orderId, originId } = await issuedThenRestocked();
        const ledgerBefore = await ledger(orderId);
        expect(await stockOf(a)).toMatchObject({ onHand: 8 });

        const ret = await vouchers.createReturnVoucher(
          originId,
          {
            note: '2 tấm nứt kính',
            lines: [
              { productId: a, qty: 12 },
              { productId: b, qty: 2 },
            ],
          },
          ACTOR,
        );

        expect(ret.type).toBe('nhap');
        expect(ret.ma).toMatch(/^PK-NT-\d{4,}$/);
        expect(ret.returnOfVoucherId).toBe(originId);
        expect(ret.returnOf).toEqual({
          id: originId,
          ma: expect.stringMatching(/^PK-X-/),
          orderId,
        });
        expect(ret.orderId).toBeUndefined();
        const snapshots = await prisma.orderLineItem.findMany({
          where: { orderVersion: { orderId }, productId: { in: [a, b] } },
          select: { productId: true, costPriceSnapshot: true },
        });
        const snapshotOf = new Map(
          snapshots.map((s) => [s.productId, s.costPriceSnapshot]),
        );
        expect(snapshotOf.get(a)).toBe(1_000_000);
        expect(ret.lines.find((l) => l.productId === a)?.unitCost).toBe(
          snapshotOf.get(a),
        );
        expect(ret.lines.find((l) => l.productId === b)?.unitCost).toBe(
          snapshotOf.get(b),
        );
        expect(await stockOf(a)).toMatchObject({ onHand: 20 });
        expect(await stockOf(b)).toMatchObject({ onHand: 2 });
        const productA = await prisma.product.findUniqueOrThrow({
          where: { id: a },
        });
        expect(productA.costPrice).toBe(
          tinhGiaVonBinhQuan({
            onHandTruoc: 8,
            giaVonTruoc: 1_400_000,
            qtyNhap: 12,
            donGiaNhap: 1_000_000,
          }),
        );
        expect(await ledger(orderId)).toEqual(ledgerBefore);
        const audit = await prisma.auditLog.findMany({
          where: { eventType: 'StockVoucherCreated', targetId: ret.id },
        });
        expect(audit).toHaveLength(1);
        expect(audit[0].after).toMatchObject({
          returnOfVoucherId: originId,
          orderId,
        });

        const origin = await vouchers.chiTietPhieu(originId);
        expect(origin.canReturn).toBe(false);
        expect(origin.returnVoucher).toEqual({ id: ret.id, ma: ret.ma });
      });

      it('partial return: only the counted line is written', async () => {
        const { a, b, originId } = await issuedThenRestocked();

        const ret = await vouchers.createReturnVoucher(
          originId,
          { lines: [{ productId: a, qty: 10 }] },
          ACTOR,
        );

        expect(ret.lines).toHaveLength(1);
        expect(await stockOf(a)).toMatchObject({ onHand: 18 });
        expect(await stockOf(b)).toMatchObject({ onHand: 0 });
      });

      it('a product untracked and deactivated since the issue is still taken back', async () => {
        const a = await createProduct({ onHand: 5, costPrice: 500 });
        const { originId } = await cancelledAfterIssue([
          { productId: a, qty: 5 },
        ]);
        await prisma.product.update({
          where: { id: a },
          data: { tracksStock: false, isActive: false },
        });

        await vouchers.createReturnVoucher(
          originId,
          { lines: [{ productId: a, qty: 3 }] },
          ACTOR,
        );

        const item = await prisma.stockItem.findUniqueOrThrow({
          where: { productId: a },
        });
        expect(item.onHand).toBe(3);
      });

      it('list filter: isReturn=true has the return, type=nhap&isReturn=false does not, no filter has both', async () => {
        const { originId } = await issuedThenRestocked();
        const ret = await vouchers.createReturnVoucher(
          originId,
          {
            lines: [
              {
                productId: (
                  await prisma.stockVoucherLine.findFirstOrThrow({
                    where: { stockVoucherId: originId },
                  })
                ).productId,
                qty: 1,
              },
            ],
          },
          ACTOR,
        );

        const ids = async (q: Parameters<typeof vouchers.lietKePhieu>[0]) =>
          (await vouchers.lietKePhieu(q)).items.map((i) => i.id);

        expect(await ids({ isReturn: true })).toContain(ret.id);
        expect(await ids({ isReturn: true })).not.toContain(originId);
        expect(await ids({ type: 'nhap', isReturn: false })).not.toContain(
          ret.id,
        );
        const all = await ids({});
        expect(all).toEqual(expect.arrayContaining([ret.id, originId]));
      });

      describe('refusals write nothing', () => {
        async function snapshot(productId: string) {
          const item = await prisma.stockItem.findUnique({
            where: { productId },
          });
          const p = await prisma.product.findUniqueOrThrow({
            where: { id: productId },
          });
          return {
            onHand: item?.onHand,
            costPrice: p.costPrice,
            vouchers: await voucherCount(),
          };
        }

        it('order not cancelled (issued, still dachot) ⇒ 409', async () => {
          const a = await createProduct({ onHand: 5 });
          const o = await createQuote([{ productId: a, qty: 5 }]);
          await confirm(o.id);
          const { voucher } = await orders.issueStock(ACTOR, ALL, o.id);
          const before = await snapshot(a);

          const err = await rejection(
            vouchers.createReturnVoucher(
              voucher.id,
              { lines: [{ productId: a, qty: 1 }] },
              ACTOR,
            ),
          );

          expect(err.getStatus()).toBe(409);
          expect(await snapshot(a)).toEqual(before);
          expect((await vouchers.chiTietPhieu(voucher.id)).canReturn).toBe(
            false,
          );
        });

        it.each(['nhap', 'xuat'] as const)(
          'a free-standing %s voucher as origin ⇒ 409',
          async (type) => {
            const a = await createProduct({ onHand: 5, costPrice: 10 });
            const free = await vouchers.taoPhieu(
              {
                type,
                lines: [
                  type === 'nhap'
                    ? { productId: a, qty: 1, unitCost: 10 }
                    : { productId: a, qty: 1 },
                ],
              },
              ACTOR,
            );
            const before = await snapshot(a);

            const err = await rejection(
              vouchers.createReturnVoucher(
                free.id,
                { lines: [{ productId: a, qty: 1 }] },
                ACTOR,
              ),
            );

            expect(err.getStatus()).toBe(409);
            expect(await snapshot(a)).toEqual(before);
          },
        );

        it('the return voucher itself as origin ⇒ 409; a second return of the same origin ⇒ 409 naming PK-NT', async () => {
          const a = await createProduct({ onHand: 5, costPrice: 10 });
          const { originId } = await cancelledAfterIssue([
            { productId: a, qty: 5 },
          ]);
          const ret = await vouchers.createReturnVoucher(
            originId,
            { lines: [{ productId: a, qty: 2 }] },
            ACTOR,
          );
          const before = await snapshot(a);

          const ofReturn = await rejection(
            vouchers.createReturnVoucher(
              ret.id,
              { lines: [{ productId: a, qty: 1 }] },
              ACTOR,
            ),
          );
          const second = await rejection(
            vouchers.createReturnVoucher(
              originId,
              { lines: [{ productId: a, qty: 1 }] },
              ACTOR,
            ),
          );

          expect(ofReturn.getStatus()).toBe(409);
          expect(second.getStatus()).toBe(409);
          expect(second.message).toContain(ret.ma);
          expect(await snapshot(a)).toEqual(before);
        });

        it.each<
          [
            string,
            (a: string, other: string) => { productId: string; qty: number }[],
            number,
            string,
          ]
        >([
          [
            'duplicate product',
            (a) => [
              { productId: a, qty: 1 },
              { productId: a, qty: 1 },
            ],
            400,
            'DUPLICATE_PRODUCT',
          ],
          [
            'product not on the origin',
            (_a, other) => [{ productId: other, qty: 1 }],
            400,
            'NOT_ON_ORIGIN_VOUCHER',
          ],
          [
            'more than issued',
            (a) => [{ productId: a, qty: 6 }],
            400,
            'RETURN_EXCEEDS_ISSUED',
          ],
        ])('%s ⇒ %i %s', async (_name, lines, status, code) => {
          const a = await createProduct({ onHand: 5, costPrice: 10 });
          const other = await createProduct({ onHand: 1 });
          const { originId } = await cancelledAfterIssue([
            { productId: a, qty: 5 },
          ]);
          const before = await snapshot(a);

          const err = await rejection(
            vouchers.createReturnVoucher(
              originId,
              { lines: lines(a, other) },
              ACTOR,
            ),
          );

          expect(err.getStatus()).toBe(status);
          expect(err.fieldErrors?.[0]?.code).toBe(code);
          expect(await snapshot(a)).toEqual(before);
        });

        it('origin missing ⇒ 404', async () => {
          const err = await rejection(
            vouchers.createReturnVoucher(
              '00000000-0000-4000-8000-000000000067',
              {
                lines: [
                  { productId: '00000000-0000-4000-8000-000000000001', qty: 1 },
                ],
              },
              ACTOR,
            ),
          );

          expect(err.getStatus()).toBe(404);
        });
      });
    });

    describe('DB constraints stand on their own (raw SQL)', () => {
      async function rawError(sql: Promise<unknown>): Promise<string> {
        try {
          await sql;
        } catch (e) {
          return String((e as Error).message);
        }
        throw new Error('Expected a DB error, got none.');
      }

      async function returned() {
        const a = await createProduct({ onHand: 5, costPrice: 10 });
        const { originId, orderId } = await cancelledAfterIssue([
          { productId: a, qty: 5 },
        ]);
        const ret = await vouchers.createReturnVoucher(
          originId,
          { lines: [{ productId: a, qty: 1 }] },
          ACTOR,
        );
        const order = await prisma.order.findUniqueOrThrow({
          where: { id: orderId },
        });
        return { originId, ret, orderId, versionId: order.currentVersionId! };
      }

      it('a second voucher with the same return_of_voucher_id ⇒ unique stock_vouchers_return_of_voucher_id_key', async () => {
        const { originId } = await returned();

        const msg = await rawError(
          prisma.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, return_of_voucher_id)
          VALUES (gen_random_uuid()::text, 'nhap', ${ACTOR}, ${originId})`,
        );

        expect(msg).toContain('stock_vouchers_return_of_voucher_id_key');
      });

      it("a return link on a 'xuat' voucher ⇒ CHECK stock_vouchers_return_is_stock_in", async () => {
        const { ret } = await returned();

        // Points at the RETURN voucher (no other return yet) so only the CHECK can refuse it.
        const msg = await rawError(
          prisma.$executeRaw`INSERT INTO stock_vouchers (id, type, created_by_account_id, return_of_voucher_id)
          VALUES (gen_random_uuid()::text, 'xuat', ${ACTOR}, ${ret.id})`,
        );

        expect(msg).toContain('stock_vouchers_return_is_stock_in');
      });

      it('a return voucher carrying an order pair ⇒ refused by a CHECK (on a nhap row the older stock_vouchers_order_only_xuat fires first)', async () => {
        const { ret, orderId, versionId } = await returned();

        const msg = await rawError(
          prisma.$executeRaw`UPDATE stock_vouchers SET order_id = ${orderId}, order_version_id = ${versionId}
          WHERE id = ${ret.id}`,
        );

        expect(msg).toContain('23514');
        expect(msg).toMatch(
          /stock_vouchers_return_is_stock_in|stock_vouchers_order_only_xuat/,
        );
        const row = await prisma.stockVoucher.findUniqueOrThrow({
          where: { id: ret.id },
        });
        expect(row.orderId).toBeNull();
      });

      it('deleting an origin that has a return voucher ⇒ FK RESTRICT', async () => {
        const { originId } = await returned();
        // Clear the origin's own lines so only the return link can refuse the delete.
        await prisma.stockVoucherLine.deleteMany({
          where: { stockVoucherId: originId },
        });

        const msg = await rawError(
          prisma.$executeRaw`DELETE FROM stock_vouchers WHERE id = ${originId}`,
        );

        expect(msg).toContain('stock_vouchers_return_of_voucher_id_fkey');
      });
    });

    describe('🔴 FOR UPDATE: FORCED interleaving', () => {
      /** Confirmed order flipped to `huy` without its release yet — the window after commit. */
      async function cancelledNotReleased() {
        const a = await createProduct({ onHand: 10 });
        const o = await createQuote([{ productId: a, qty: 5 }]);
        await confirm(o.id);
        await prisma.order.update({
          where: { id: o.id },
          data: { status: 'huy' },
        });
        return { a, o };
      }

      async function expectWaits(
        lock: ReturnType<typeof holdLock>,
        run: () => Promise<unknown>,
      ): Promise<void> {
        await wait(150);
        let settled = false;
        const running = run().finally(() => {
          settled = true;
        });
        await wait(300);
        expect(settled).toBe(false);
        lock.release();
        await lock.tx;
        await running;
      }

      it('another tx holds the PRODUCT lock ⇒ the cancel release WAITS, then writes the right ledger', async () => {
        const { a, o } = await cancelledNotReleased();

        await expectWaits(holdLock('products', a), () =>
          vouchers.releaseForCancelledOrder(o.id),
        );

        expect(await ledger(o.id)).toEqual([
          [o.versionId, a, 'reserve', 5],
          [o.versionId, a, 'release', -5],
        ]);
      });

      it('another tx holds the ORDER lock and releases first ⇒ the cancel release WAITS, then reads the ledger AFTER it (no double release)', async () => {
        // Without the orders lock the ledger is read before the other tx commits (+5 held);
        // the insert then blocks on the FK key-share lock and, once unblocked, writes a second
        // release for the same version ⇒ unique violation.
        const { a, o } = await cancelledNotReleased();
        const item = await prisma.stockItem.findUniqueOrThrow({
          where: { productId: a },
        });

        await expectWaits(
          holdLock('orders', o.id, (t) =>
            t.stockMovement.create({
              data: {
                stockItemId: item.id,
                orderId: o.id,
                orderVersionId: o.versionId,
                qty: -5,
                type: 'release',
              },
            }),
          ),
          () => vouchers.releaseForCancelledOrder(o.id),
        );

        expect(await ledger(o.id)).toEqual([
          [o.versionId, a, 'reserve', 5],
          [o.versionId, a, 'release', -5],
        ]);
        expect((await stockOf(a)).reserved).toBe(0);
      });

      it('the lock set includes a product only an OLD version holds ⇒ the release WAITS on it', async () => {
        const a = await createProduct({ onHand: 10 });
        const b = await createProduct({ onHand: 10 });
        const o = await createQuote([
          { productId: a, qty: 2 },
          { productId: b, qty: 4 },
        ]);
        await confirm(o.id);
        await reviseWith(o.id, [{ productId: a, qty: 2 }]);
        await prisma.order.update({
          where: { id: o.id },
          data: { status: 'huy' },
        });

        await expectWaits(holdLock('products', b), () =>
          vouchers.releaseForCancelledOrder(o.id),
        );

        expect((await stockOf(b)).reserved).toBe(0);
      });

      it('another tx holds the PRODUCT lock and adds stock ⇒ the return voucher WAITS, then reads onHand AFTER it (no lost update)', async () => {
        // The holder WRITES under the lock: without the products lock the return reads onHand
        // before the holder commits, then overwrites its +3 (a bare hold would not catch it —
        // the later `product.update` blocks on the held row anyway).
        const a = await createProduct({ onHand: 5, costPrice: 10 });
        const { originId } = await cancelledAfterIssue([
          { productId: a, qty: 5 },
        ]);

        await expectWaits(
          holdLock('products', a, (t) =>
            t.stockItem.update({
              where: { productId: a },
              data: { onHand: { increment: 3 } },
            }),
          ),
          () =>
            vouchers.createReturnVoucher(
              originId,
              { lines: [{ productId: a, qty: 4 }] },
              ACTOR,
            ),
        );

        expect((await stockOf(a)).onHand).toBe(7);
      });

      it('two returns of one origin in parallel ⇒ exactly one succeeds, the other is 409, onHand added once', async () => {
        const a = await createProduct({ onHand: 5, costPrice: 10 });
        const { originId } = await cancelledAfterIssue([
          { productId: a, qty: 5 },
        ]);

        // Both start while a third tx holds the product lock, so both are past the origin read
        // and queued on the lock when it is released — the race is forced, not left to timing.
        const lock = holdLock('products', a);
        await wait(150);
        const both = Promise.allSettled([
          vouchers.createReturnVoucher(
            originId,
            { lines: [{ productId: a, qty: 5 }] },
            ACTOR,
          ),
          vouchers.createReturnVoucher(
            originId,
            { lines: [{ productId: a, qty: 5 }] },
            ACTOR,
          ),
        ]);
        await wait(300);
        lock.release();
        await lock.tx;
        const results = await both;

        const ok = results.filter((r) => r.status === 'fulfilled');
        const failed = results.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        expect(ok).toHaveLength(1);
        expect(failed).toHaveLength(1);
        expect(failed[0].reason).toBeInstanceOf(AppException);
        expect((failed[0].reason as AppException).getStatus()).toBe(409);
        expect((await stockOf(a)).onHand).toBe(5);
        expect(
          await prisma.stockVoucher.count({
            where: { returnOfVoucherId: originId },
          }),
        ).toBe(1);
      });
    });
  },
);
