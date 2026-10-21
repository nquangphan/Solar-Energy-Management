import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import { AppException } from '../src/common/errors/app.exception';
import type { DomainEvent } from '../src/events/domain-event';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { OrdersService } from '../src/orders/orders.service';
import type { InstallmentInput } from '../src/payments/domain/payment-schedule';
import { PaymentSchedulesService } from '../src/payments/payment-schedules.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for the payment schedule — facts a mock cannot prove:
 *  - replace-all really leaves exactly the new rows (one schedule row, stable id);
 *  - the hand-written CHECK constraints stand on their own;
 *  - the mismatch is recomputed against the order's CURRENT total after reopen + re-confirm;
 *  - the `orders` FOR UPDATE lock is really taken: a holder that WRITES the installments under
 *    the lock makes the replace wait and then produce exactly its own list; two first-time
 *    saves yield exactly one schedule; a cancel committed under the lock is seen by the re-check.
 *
 * SKIPS itself without `DATABASE_URL` ⇒ default `npm test` stays HERMETIC. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Payment schedules on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let schedules: PaymentSchedulesService;
  const published: DomainEvent[] = [];

  const ACTOR = 'acc-payment-schedule-71';
  const PHONE = '+84900000710';
  const ALL = new Set<string>(Object.values(PERM));
  /** 76,862,000 + VAT 8% = 83,010,960 — the mockup total. */
  const LINE_PRICE = 76_862_000;
  const TOTAL = 83_010_960;
  let sourceId: string;

  const SPLIT_20_70_10: InstallmentInput[] = [
    { percent: 20, conditionNote: 'Cọc khi ký hợp đồng' },
    { percent: 70, conditionNote: 'Khi thi công' },
    { percent: 10, conditionNote: 'Khi nghiệm thu, bàn giao' },
  ];

  async function cleanUp(): Promise<void> {
    const found = await prisma.order.findMany({
      where: { customerSdt: PHONE },
      select: { id: true },
    });
    const orderIds = found.map((o) => o.id);
    await prisma.installment.deleteMany({
      where: { schedule: { orderId: { in: orderIds } } },
    });
    await prisma.paymentSchedule.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.stockMovement.deleteMany({
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

  /** A quote with one free-priced line, confirmed through the real service (`dachot`). */
  async function confirmedOrder(
    unitPrice = LINE_PRICE,
    qty = 1,
  ): Promise<string> {
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
        qty,
        unitPrice,
        priceEditable: true,
        displayOrder: 0,
      },
    });
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    await orders.confirm(ACTOR, created.id, 8, false, ALL);
    return created.id;
  }

  const replace = (orderId: string, inputs: InstallmentInput[]) =>
    schedules.replace(ACTOR, ALL, orderId, inputs, 8, false);

  async function installmentsOf(orderId: string) {
    return prisma.installment.findMany({
      where: { schedule: { orderId } },
      orderBy: { seq: 'asc' },
      select: {
        seq: true,
        percent: true,
        amount: true,
        conditionNote: true,
        milestone: true,
      },
    });
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function rejection(p: Promise<unknown>): Promise<unknown> {
    try {
      await p;
    } catch (e) {
      return e;
    }
    throw new Error('Expected an error, got none.');
  }

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
    new AuditSubscriber(
      bus,
      new AuditService(prisma as unknown as PrismaService),
    ).onModuleInit();
    const stockItems = new StockItemsService(
      prisma as unknown as PrismaService,
    );
    orders = new OrdersService(
      prisma as unknown as PrismaService,
      bus,
      fakeStorage(),
      new StockVouchersService(prisma as unknown as PrismaService, bus),
      stockItems,
    );
    schedules = new PaymentSchedulesService(
      prisma as unknown as PrismaService,
      bus,
      orders,
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
        email: 'payment-schedule-71@test.local',
        passwordHash: 'x',
        displayName: 'Người test lịch thanh toán',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Khách test lịch',
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

  it('20/70/10 on 83,010,960 ⇒ one schedule + three exact installments, one audit row', async () => {
    const orderId = await confirmedOrder();
    const view = await replace(orderId, SPLIT_20_70_10);

    expect(view.orderTotal).toBe(TOTAL);
    expect(view.totalMatches).toBe(true);
    expect(await prisma.paymentSchedule.count({ where: { orderId } })).toBe(1);
    expect(await installmentsOf(orderId)).toEqual([
      {
        seq: 1,
        percent: 20,
        amount: 16_602_192,
        conditionNote: 'Cọc khi ký hợp đồng',
        milestone: 'coc',
      },
      {
        seq: 2,
        percent: 70,
        amount: 58_107_672,
        conditionNote: 'Khi thi công',
        milestone: null,
      },
      {
        seq: 3,
        percent: 10,
        amount: 8_301_096,
        conditionNote: 'Khi nghiệm thu, bàn giao',
        milestone: 'tat_toan',
      },
    ]);
    expect(
      await prisma.auditLog.count({
        where: {
          actorAccountId: ACTOR,
          eventType: 'PaymentScheduleConfigured',
          targetId: orderId,
        },
      }),
    ).toBe(1);
  });

  it('replacing 3 installments with 2 leaves exactly 2 rows under the SAME schedule row', async () => {
    const orderId = await confirmedOrder();
    await replace(orderId, SPLIT_20_70_10);
    const first = await prisma.paymentSchedule.findUniqueOrThrow({
      where: { orderId },
    });

    await replace(orderId, [
      { percent: 30, conditionNote: 'Cọc' },
      { percent: 70, conditionNote: 'Bàn giao' },
    ]);

    const second = await prisma.paymentSchedule.findUniqueOrThrow({
      where: { orderId },
    });
    expect(second.id).toBe(first.id);
    expect((await installmentsOf(orderId)).map((i) => i.seq)).toEqual([1, 2]);
  });

  it('a status outside the editable set ⇒ 409 and nothing written', async () => {
    const orderId = await confirmedOrder();
    await orders.revise(ACTOR, orderId, false, ALL); // back to baogia
    const err = await rejection(replace(orderId, SPLIT_20_70_10));
    expect((err as AppException).getStatus()).toBe(409);
    expect(await prisma.paymentSchedule.count({ where: { orderId } })).toBe(0);
  });

  it('reopen + edit line + re-confirm ⇒ GET reports the mismatch against the NEW total', async () => {
    const orderId = await confirmedOrder();
    await replace(orderId, SPLIT_20_70_10);

    await orders.revise(ACTOR, orderId, false, ALL);
    const { currentVersionId } = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    await prisma.orderLineItem.updateMany({
      where: { orderVersionId: currentVersionId! },
      data: { unitPrice: LINE_PRICE + 1_000_000 },
    });
    const reopened = await schedules.get(ACTOR, ALL, orderId, 8, false);
    expect(reopened.editable).toBe(false);

    await orders.confirm(ACTOR, orderId, 8, false, ALL);
    const view = await schedules.get(ACTOR, ALL, orderId, 8, false);
    expect(view.orderTotal).toBe(TOTAL + 1_080_000);
    expect(view.scheduledTotal).toBe(TOTAL);
    expect(view.difference).toBe(1_080_000);
    expect(view.totalMatches).toBe(false);
    expect(view.editable).toBe(true);
  });

  it('an order above the INT4 range: 100% ⇒ 400 field error (not a driver 500); a split that fits saves', async () => {
    // 2 × 2,000,000,000 + VAT 8% = 4,320,000,000 — the total itself exceeds INT4.
    const orderId = await confirmedOrder(2_000_000_000, 2);
    const err = (await rejection(
      replace(orderId, [{ percent: 100, conditionNote: 'Toàn bộ' }]),
    )) as AppException;
    expect(err).toBeInstanceOf(AppException);
    expect(err.getStatus()).toBe(400);
    expect(await prisma.paymentSchedule.count({ where: { orderId } })).toBe(0);

    const view = await replace(orderId, [
      { percent: 40, conditionNote: 'Cọc' },
      { percent: 30, conditionNote: 'Thi công' },
      { percent: 30, conditionNote: 'Bàn giao' },
    ]);
    expect(view.orderTotal).toBe(4_320_000_000);
    expect(view.totalMatches).toBe(true);
    expect((await installmentsOf(orderId)).map((i) => i.amount)).toEqual([
      1_728_000_000, 1_296_000_000, 1_296_000_000,
    ]);
  });

  describe('CHECK constraints stand on their own', () => {
    let scheduleId: string;

    beforeAll(async () => {
      const orderId = await confirmedOrder();
      await replace(orderId, [{ percent: 100, conditionNote: 'Toàn bộ' }]);
      scheduleId = (
        await prisma.paymentSchedule.findUniqueOrThrow({ where: { orderId } })
      ).id;
    });

    it.each([
      ['amount = 0', { amount: 0 }, 'installments_amount_positive'],
      ['percent = 0', { percent: 0 }, 'installments_percent_range'],
      ['percent = 101', { percent: 101 }, 'installments_percent_range'],
      ['seq = 0', { seq: 0 }, 'installments_seq_positive'],
      [
        'unknown milestone',
        { milestone: 'giua' },
        'installments_milestone_known',
      ],
    ])('%s is rejected by %s', async (_l, override, constraint) => {
      const err = await rejection(
        prisma.installment.create({
          data: {
            scheduleId,
            seq: 9,
            percent: null,
            amount: 1_000,
            conditionNote: 'x',
            milestone: null,
            ...override,
          },
        }),
      );
      expect(String((err as Error).message)).toContain(constraint);
    });
  });

  describe('🔴 FOR UPDATE on orders: FORCED interleaving', () => {
    it('a holder that rewrites the installments under the order lock ⇒ replace WAITS, then the final list is exactly its own', async () => {
      const orderId = await confirmedOrder();
      await replace(orderId, SPLIT_20_70_10);
      const { id: scheduleId } = await prisma.paymentSchedule.findUniqueOrThrow(
        {
          where: { orderId },
        },
      );

      const lock = holdOrderLock(orderId, async (t) => {
        await t.installment.deleteMany({ where: { scheduleId } });
        await t.installment.create({
          data: {
            scheduleId,
            seq: 1,
            percent: 100,
            amount: TOTAL,
            conditionNote: 'Holder',
            milestone: 'coc',
          },
        });
      });
      await wait(150);
      let settled = false;
      const running = replace(orderId, [
        { percent: 50, conditionNote: 'B1' },
        { percent: 50, conditionNote: 'B2' },
      ]).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;
      await running;

      const rows = await installmentsOf(orderId);
      expect(rows.map((r) => [r.seq, r.conditionNote])).toEqual([
        [1, 'B1'],
        [2, 'B2'],
      ]);
      expect(await prisma.paymentSchedule.count({ where: { orderId } })).toBe(
        1,
      );
    });

    it('two first-time saves in parallel ⇒ both succeed, exactly one schedule, one consistent list', async () => {
      const orderId = await confirmedOrder();
      const results = await Promise.allSettled([
        replace(orderId, SPLIT_20_70_10),
        replace(orderId, [
          { percent: 50, conditionNote: 'B1' },
          { percent: 50, conditionNote: 'B2' },
        ]),
      ]);
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(await prisma.paymentSchedule.count({ where: { orderId } })).toBe(
        1,
      );
      const notes = (await installmentsOf(orderId)).map((r) => r.conditionNote);
      expect([
        ['Cọc khi ký hợp đồng', 'Khi thi công', 'Khi nghiệm thu, bàn giao'],
        ['B1', 'B2'],
      ]).toContainEqual(notes);
    });

    it('an order cancelled under the lock ⇒ the in-tx re-check refuses with 409, nothing written', async () => {
      const orderId = await confirmedOrder();
      const lock = holdOrderLock(orderId, (t) =>
        t.order.update({ where: { id: orderId }, data: { status: 'huy' } }),
      );
      await wait(150);
      const running = rejection(replace(orderId, SPLIT_20_70_10));
      await wait(300);
      lock.release();
      await lock.tx;
      const err = (await running) as AppException;
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Đơn vừa thay đổi — tải lại rồi cấu hình lại lịch.',
      );
      expect(await prisma.paymentSchedule.count({ where: { orderId } })).toBe(
        0,
      );
    });
  });
});
