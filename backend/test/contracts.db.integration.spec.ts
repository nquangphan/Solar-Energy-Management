import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import {
  ContractsService,
  ORDER_CHANGED_MESSAGE,
} from '../src/contracts/contracts.service';
import { CONTRACT_BLOCKED_MESSAGE } from '../src/contracts/domain/contract-eligibility';
import type { AppException } from '../src/common/errors/app.exception';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { OrdersService } from '../src/orders/orders.service';
import type { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { PaymentSchedulesService } from '../src/payments/payment-schedules.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { fakeStorage, type FakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for contract generation — facts a mock cannot prove:
 *  - the migration's CHECK constraints stand on their own (a direct insert violating them fails);
 *  - the number comes from the `contracts.seq` sequence: two concurrent generations get two
 *    different numbers and both rows commit (no P2002, no 500);
 *  - generation runs under the order row lock: a holder that changes the schedule, reopens the
 *    order, or edits a quote line and confirms under that lock makes the generation WAIT, then
 *    see the committed change and refuse;
 *  - a real generation writes the row and one `ContractGenerated` audit row;
 *  - a revised + re-confirmed order prints its new version number, the old contract keeps its own.
 *
 * Renderer and storage are fakes (no Chromium, no R2). SKIPS itself without `DATABASE_URL`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Contract generation on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let schedules: PaymentSchedulesService;
  let contracts: ContractsService;
  let storage: FakeStorage;

  const ACTOR = 'acc-contracts-73';
  const PHONE = '+84900000730';
  const ALL = new Set<string>(Object.values(PERM));
  const PDF = Buffer.from('%PDF-1.4 test');
  let sourceId: string;
  /** When set, every render waits on it — lets a test hold requests AFTER they took a number. */
  let renderGate: (() => Promise<void>) | null = null;

  async function cleanUp(): Promise<void> {
    const found = await prisma.order.findMany({
      where: { customerSdt: PHONE },
      select: { id: true },
    });
    const orderIds = found.map((o) => o.id);
    await prisma.contract.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.installment.deleteMany({
      where: { schedule: { orderId: { in: orderIds } } },
    });
    await prisma.paymentSchedule.deleteMany({
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
    await prisma.account.deleteMany({ where: { id: ACTOR } });
  }

  /** A confirmed order (76.862.000 + VAT 8%) with a 20/70/10 schedule saved by the real service. */
  async function confirmedOrderWithSchedule(): Promise<string> {
    const created = await prisma.order.create({
      data: {
        status: 'baogia',
        customerSdt: PHONE,
        ownerAccountId: ACTOR,
        sourceId,
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: true,
        scopeVanChuyen: false,
        vatMode: 'co_vat',
      },
    });
    const version = await prisma.orderVersion.create({
      data: { orderId: created.id, versionNo: 1 },
    });
    await prisma.orderLineItem.create({
      data: {
        orderVersionId: version.id,
        productId: null,
        name: 'Hệ 10kWp trọn gói',
        unit: 'Bộ',
        qty: 1,
        unitPrice: 76_862_000,
        priceEditable: true,
        displayOrder: 0,
      },
    });
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    await orders.confirm(ACTOR, created.id, 8, false, ALL);
    await schedules.replace(
      ACTOR,
      ALL,
      created.id,
      [
        { percent: 20, conditionNote: 'Cọc' },
        { percent: 70, conditionNote: 'Thi công' },
        { percent: 10, conditionNote: 'Nghiệm thu' },
      ],
      8,
      false,
    );
    return created.id;
  }

  const generate = (orderId: string) =>
    contracts.generate(ACTOR, ALL, orderId, 8, false);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  /** Holds `SELECT … FROM orders … FOR UPDATE` (and runs `underLock`) until `release()`. */
  function holdOrderLock(
    orderId: string,
    underLock: (t: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    let release!: () => void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tx = prisma.$transaction(
      async (t) => {
        await t.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
        await underLock(t);
        await holding;
      },
      { timeout: 10_000 },
    );
    return { release, tx };
  }

  async function rejection(p: Promise<unknown>): Promise<Error> {
    try {
      await p;
    } catch (e) {
      return e as Error;
    }
    throw new Error('Expected an error, got none.');
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const bus = new InProcessEventBus();
    new AuditSubscriber(
      bus,
      new AuditService(prisma as unknown as PrismaService),
    ).onModuleInit();
    storage = fakeStorage();
    orders = new OrdersService(
      prisma as unknown as PrismaService,
      bus,
      storage,
      new StockVouchersService(prisma as unknown as PrismaService, bus),
      new StockItemsService(prisma as unknown as PrismaService),
    );
    schedules = new PaymentSchedulesService(
      prisma as unknown as PrismaService,
      bus,
      orders,
    );
    contracts = new ContractsService(
      orders,
      prisma as unknown as PrismaService,
      bus,
      storage,
      {
        renderPdf: async () => {
          await renderGate?.();
          return PDF;
        },
      } as unknown as QuoteRendererPort,
      new SettingsService(prisma as unknown as PrismaService, bus),
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
        email: 'contracts-73@example.com',
        passwordHash: 'x',
        displayName: 'Test 7.3',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Khách 7.3',
        sourceId,
      },
    });
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  describe('CHECK constraints stand on their own', () => {
    let orderId: string;
    let versionId: string;

    beforeAll(async () => {
      orderId = await confirmedOrderWithSchedule();
      versionId = (
        await prisma.order.findUniqueOrThrow({
          where: { id: orderId },
        })
      ).currentVersionId as string;
    });

    const insert = (type: string, pdfSize: number) =>
      prisma.contract.create({
        data: {
          id: randomUUID(),
          orderId,
          orderVersionId: versionId,
          type,
          contractNo: `TEST-${randomUUID()}`,
          pdfKey: 'k',
          pdfSize,
          fileName: 'f',
          createdByAccountId: ACTOR,
        },
      });

    it('unknown type ⇒ contracts_type_known', async () => {
      const error = await rejection(insert('lease', 10));
      expect(error.message).toContain('contracts_type_known');
    });

    it('pdf_size 0 ⇒ contracts_pdf_size_positive', async () => {
      const error = await rejection(insert('sale', 0));
      expect(error.message).toContain('contracts_pdf_size_positive');
    });

    it('a valid row inserts, and its seq comes from the sequence', async () => {
      const row = await insert('sale', 10);
      expect(row.seq).toBeGreaterThan(0);
      await prisma.contract.delete({ where: { id: row.id } });
    });
  });

  it('a real generation ⇒ one row with the printed metadata + one ContractGenerated audit row', async () => {
    const orderId = await confirmedOrderWithSchedule();

    const result = await generate(orderId);

    const row = await prisma.contract.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(row).toMatchObject({
      orderId,
      type: 'construction',
      contractNo: result.contractNo,
      pdfKey: `contracts/${orderId}/${result.id}.pdf`,
      pdfSize: PDF.length,
      fileName: `hop-dong-thi-cong-${row.seq}`,
      createdByAccountId: ACTOR,
    });
    expect(result.contractNo).toBe(
      `HĐTC-${row.seq}/${new Date(row.createdAt.getTime() + 7 * 3600_000).getUTCFullYear()}`,
    );
    expect(storage.objects.get(row.pdfKey)?.body).toEqual(PDF);
    const audits = await prisma.auditLog.findMany({
      where: {
        actorAccountId: ACTOR,
        eventType: 'ContractGenerated',
        targetId: orderId,
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].targetType).toBe('Order');
    expect(audits[0].occurredAt.getTime()).toBe(row.createdAt.getTime());
  });

  it('two concurrent generations on DIFFERENT orders ⇒ different seq and number, no P2002', async () => {
    const first = await confirmedOrderWithSchedule();
    const second = await confirmedOrderWithSchedule();

    // Different orders do not share a row lock, so both requests reserve their number before
    // either writes its row: the render step (after the reservation, before the insert) waits
    // until both have arrived. `count() + 1` would hand both the same number here.
    let arrived = 0;
    let releaseBoth!: () => void;
    const bothArrived = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });
    renderGate = () => {
      arrived += 1;
      if (arrived === 2) releaseBoth();
      return bothArrived;
    };

    const [a, b] = await Promise.all([
      generate(first),
      generate(second),
    ]).finally(() => {
      renderGate = null;
    });

    const rows = await prisma.contract.findMany({
      where: { orderId: { in: [first, second] } },
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.seq)).size).toBe(2);
    expect(a.contractNo).not.toBe(b.contractNo);
    expect(typeof rows[0].seq).toBe('number');
  });

  it('two concurrent generations on the SAME order ⇒ serialised by the row lock, two rows, two numbers', async () => {
    const orderId = await confirmedOrderWithSchedule();

    const [a, b] = await Promise.all([generate(orderId), generate(orderId)]);

    const rows = await prisma.contract.findMany({ where: { orderId } });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.seq)).size).toBe(2);
    expect(a.contractNo).not.toBe(b.contractNo);
  });

  describe('🔴 FOR UPDATE on orders: FORCED interleaving', () => {
    it('a holder that changes an installment amount under the lock ⇒ generation waits, then refuses the mismatch; no row, no number printed', async () => {
      const orderId = await confirmedOrderWithSchedule();
      const lock = holdOrderLock(orderId, (t) =>
        t.installment.updateMany({
          where: { schedule: { orderId }, seq: 1 },
          data: { amount: { increment: 1 } },
        }),
      );
      await wait(150);
      let settled = false;
      const running = rejection(generate(orderId)).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;

      const error = (await running) as AppException;
      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(CONTRACT_BLOCKED_MESSAGE.scheduleMismatch);
      expect(await prisma.contract.count({ where: { orderId } })).toBe(0);
    });

    it('a holder that edits a quote line and confirms under the lock (same version) ⇒ generation waits, then 409 "Đơn vừa thay đổi"; no row from the quote-time lines', async () => {
      // A quote that already carries a schedule matching its quote-time lines (it was confirmed
      // with that schedule, then reopened): the scoped read sees status baogia and qty 1.
      const orderId = await confirmedOrderWithSchedule();
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'baogia' },
      });
      const line = await prisma.orderLineItem.findFirstOrThrow({
        where: { orderVersion: { orderId } },
      });
      const lock = holdOrderLock(orderId, async (t) => {
        await t.orderLineItem.update({
          where: { id: line.id },
          data: { qty: 2 },
        });
        await t.order.update({
          where: { id: orderId },
          data: { status: 'dachot' },
        });
      });
      await wait(150);
      let settled = false;
      const running = rejection(generate(orderId)).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;

      const error = (await running) as AppException;
      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(ORDER_CHANGED_MESSAGE);
      expect(await prisma.contract.count({ where: { orderId } })).toBe(0);
    });

    it('a holder that reopens the order under the lock ⇒ generation waits, then refuses by status; no row', async () => {
      const orderId = await confirmedOrderWithSchedule();
      const lock = holdOrderLock(orderId, (t) =>
        t.order.update({ where: { id: orderId }, data: { status: 'baogia' } }),
      );
      await wait(150);
      let settled = false;
      const running = rejection(generate(orderId)).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;

      const error = (await running) as AppException;
      expect(error.getStatus()).toBe(409);
      expect(error.message).toBe(CONTRACT_BLOCKED_MESSAGE.status);
      expect(await prisma.contract.count({ where: { orderId } })).toBe(0);
    });
  });

  it('revise + re-confirm ⇒ the new contract prints the new version, the old one keeps its own', async () => {
    const orderId = await confirmedOrderWithSchedule();
    const first = await generate(orderId);

    await orders.revise(ACTOR, orderId, false, ALL);
    await orders.confirm(ACTOR, orderId, 8, false, ALL);
    const second = await generate(orderId);

    expect(first.versionNo).toBe(1);
    expect(second.versionNo).toBe(2);
    const overview = await contracts.overview(ACTOR, ALL, orderId, 8, false);
    expect(overview.contracts.map((c) => [c.id, c.versionNo])).toEqual([
      [second.id, 2],
      [first.id, 1],
    ]);
  });
});
