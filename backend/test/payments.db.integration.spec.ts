import { randomUUID } from 'node:crypto';
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
import { todayInVietnam } from '../src/payments/domain/payment';
import type { DepositRecorded } from '../src/payments/domain/payment-events';
import type { InstallmentInput } from '../src/payments/domain/payment-schedule';
import { PaymentSchedulesService } from '../src/payments/payment-schedules.service';
import {
  PaymentsService,
  type RecordPaymentInput,
} from '../src/payments/payments.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for payment recording — facts a mock cannot prove:
 *  - a payment and the transition it triggers commit together; a transition refused by the
 *    engine (unissued stock, missing permission, edge not in the table) leaves the payment
 *    COMMITTED and the order where it was; any OTHER error rolls both back;
 *  - the CHECK constraints and the unique idempotency key stand on their own;
 *  - the `orders` FOR UPDATE lock is really taken: a holder that INSERTS a payment under the
 *    lock (the very rows the recorder sums) makes the recorder wait and then see it — for the
 *    remaining amount, for the idempotency key, and for the schedule replace that must turn
 *    into a 409 instead of a 500 FK.
 *
 * SKIPS itself without `DATABASE_URL` ⇒ default `npm test` stays HERMETIC. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Payment recording on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let schedules: PaymentSchedulesService;
  let payments: PaymentsService;
  const published: DomainEvent[] = [];

  const ACTOR = 'acc-payments-72';
  const PHONE = '+84900000720';
  const SKU = 'T72-';
  const ALL = new Set<string>(Object.values(PERM));
  /** Accountant-like: may record payments, may not close a construction order. */
  const RECORD_ONLY = new Set<string>([
    PERM.paymentsRecord,
    PERM.ordersViewAll,
  ]);
  /** 76,862,000 + VAT 8% = 83,010,960 — the mockup total. */
  const LINE_PRICE = 76_862_000;
  const TOTAL = 83_010_960;
  const STOCK_NOT_ISSUED =
    'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.';
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
    const productRows = await prisma.product.findMany({
      where: { sku: { startsWith: SKU } },
      select: { id: true },
    });
    const productIds = productRows.map((p) => p.id);
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
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
    await prisma.stockItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
  }

  let productCount = 0;
  async function trackedProduct(): Promise<string> {
    productCount += 1;
    const p = await prisma.product.create({
      data: {
        name: `Test72 SP ${String(productCount).padStart(2, '0')}`,
        sku: `${SKU}${productCount}`,
        unit: 'tấm',
        price: 0,
        costPrice: 0,
        tracksStock: true,
      },
    });
    await prisma.stockItem.create({ data: { productId: p.id, onHand: 10 } });
    return p.id;
  }

  /**
   * A quote with one free-priced line (+ optionally a tracked-stock line priced 0, so the total
   * stays the mockup total), confirmed through the real service, then — fixture only — put at
   * `status`. A 20/70/10 schedule is saved through the real service while still `dachot`.
   */
  async function orderWithSchedule(
    status: string,
    opts: { trackedLine?: boolean; inputs?: InstallmentInput[] } = {},
  ): Promise<{ orderId: string; inst: { id: string; amount: number }[] }> {
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
        unitPrice: LINE_PRICE,
        priceEditable: true,
        displayOrder: 0,
      },
    });
    if (opts.trackedLine === true) {
      await prisma.orderLineItem.create({
        data: {
          orderVersionId: version.id,
          productId: await trackedProduct(),
          name: 'Tấm pin',
          unit: 'tấm',
          qty: 2,
          unitPrice: 0,
          priceEditable: true,
          displayOrder: 1,
        },
      });
    }
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    await orders.confirm(ACTOR, created.id, 8, false, ALL);
    await schedules.replace(
      ACTOR,
      ALL,
      created.id,
      opts.inputs ?? SPLIT_20_70_10,
      8,
      false,
    );
    if (status !== 'dachot') {
      await prisma.order.update({
        where: { id: created.id },
        data: { status },
      });
    }
    const inst = await prisma.installment.findMany({
      where: { schedule: { orderId: created.id } },
      orderBy: { seq: 'asc' },
      select: { id: true, amount: true },
    });
    // Fixture events (confirm, schedule) are not what the tests below count.
    published.length = 0;
    return { orderId: created.id, inst };
  }

  const today = () => todayInVietnam(new Date());

  const record = (
    orderId: string,
    input: Partial<RecordPaymentInput> & {
      installmentId: string;
      amount: number;
    },
    permissions: ReadonlySet<string> = ALL,
  ) =>
    payments.record(
      ACTOR,
      permissions,
      orderId,
      {
        idempotencyKey: randomUUID(),
        paidOn: today(),
        method: 'bank_transfer',
        ...input,
      },
      8,
      false,
    );

  /** Seeds an already-recorded payment straight into the table (setup only). */
  const seedPayment = (
    orderId: string,
    installmentId: string,
    amount: number,
    t: Prisma.TransactionClient = prisma,
    idempotencyKey = randomUUID(),
  ) =>
    t.payment.create({
      data: {
        orderId,
        installmentId,
        amount,
        paidOn: new Date(`${today()}T00:00:00.000Z`),
        method: 'cash',
        idempotencyKey,
        recordedByAccountId: ACTOR,
      },
    });

  const statusOf = async (orderId: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;
  const paymentRows = (orderId: string) =>
    prisma.payment.count({ where: { orderId } });
  const auditCount = (orderId: string, eventType: string) =>
    prisma.auditLog.count({
      where: { actorAccountId: ACTOR, eventType, targetId: orderId },
    });
  const publishedTypes = () => published.map((e) => e.type);

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
    orders = new OrdersService(
      prisma as unknown as PrismaService,
      bus,
      fakeStorage(),
      new StockVouchersService(prisma as unknown as PrismaService, bus),
      new StockItemsService(prisma as unknown as PrismaService),
    );
    schedules = new PaymentSchedulesService(
      prisma as unknown as PrismaService,
      bus,
      orders,
    );
    payments = new PaymentsService(
      prisma as unknown as PrismaService,
      bus,
      orders,
      schedules,
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
        email: 'payments-72@test.local',
        passwordHash: 'x',
        displayName: 'Người test ghi nhận thanh toán',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Khách test thanh toán',
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

  it('full deposit on dachot ⇒ one payment row, order dacoc, mockup figures, one audit row per event without the note', async () => {
    const { orderId, inst } = await orderWithSchedule('dachot');
    const statusAuditsBefore = await auditCount(orderId, 'StatusChanged');
    const result = await record(orderId, {
      installmentId: inst[0].id,
      amount: 16_602_192,
      note: 'Khách CK qua VCB, SĐT 0912345678',
    });

    expect(await paymentRows(orderId)).toBe(1);
    expect(await statusOf(orderId)).toBe('dacoc');
    expect(result.orderStatus).toBe('dacoc');
    expect(result.autoTransition).toEqual({
      event: 'du_coc',
      outcome: 'applied',
      message: null,
    });
    expect(result.payment.paidOn).toBe(today());
    expect(result.schedule).toMatchObject({
      orderTotal: TOTAL,
      paidTotal: 16_602_192,
      remainingTotal: 66_408_768,
      paidPercent: 20,
      paymentStatus: 'partial',
      editable: false,
      recordable: true,
    });
    expect(result.schedule.installments[0].status).toBe('paid');
    expect(publishedTypes()).toEqual(['DepositRecorded', 'StatusChanged']);

    expect(await auditCount(orderId, 'DepositRecorded')).toBe(1);
    expect(await auditCount(orderId, 'StatusChanged')).toBe(
      statusAuditsBefore + 1,
    );
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { eventType: 'DepositRecorded', targetId: orderId },
    });
    expect(audit.targetType).toBe('Order');
    expect(JSON.stringify(audit)).not.toContain('VCB');
  });

  it('deposit in two parts: first keeps dachot, second moves to dacoc, one more dong ⇒ 400', async () => {
    const { orderId, inst } = await orderWithSchedule('dachot');
    const first = await record(orderId, {
      installmentId: inst[0].id,
      amount: 10_000_000,
    });
    expect(first.autoTransition).toBeNull();
    expect(first.schedule.installments[0].status).toBe('partial');
    expect(await statusOf(orderId)).toBe('dachot');

    const second = await record(orderId, {
      installmentId: inst[0].id,
      amount: inst[0].amount - 10_000_000,
    });
    expect(second.autoTransition?.outcome).toBe('applied');
    expect(await statusOf(orderId)).toBe('dacoc');

    const err = (await rejection(
      record(orderId, { installmentId: inst[0].id, amount: 1 }),
    )) as AppException;
    expect(err.getStatus()).toBe(400);
    expect(err.fieldErrors?.[0]).toMatchObject({
      field: 'amount',
      code: 'exceedsRemaining',
    });
    expect(await paymentRows(orderId)).toBe(2);
  });

  describe('transition refused ⇒ the payment STILL commits (no money rollback)', () => {
    it('nghiemthu with unissued tracked stock: skipped 409 with the stock message, payment kept, no StatusChanged', async () => {
      const { orderId, inst } = await orderWithSchedule('nghiemthu', {
        trackedLine: true,
      });
      await seedPayment(orderId, inst[0].id, inst[0].amount);
      await seedPayment(orderId, inst[1].id, inst[1].amount);
      const statusAuditsBefore = await auditCount(orderId, 'StatusChanged');

      const result = await record(orderId, {
        installmentId: inst[2].id,
        amount: inst[2].amount,
      });

      expect(result.autoTransition).toEqual({
        event: 'hoan_thanh',
        outcome: 'skipped',
        message: STOCK_NOT_ISSUED,
      });
      expect(await paymentRows(orderId)).toBe(3);
      expect(await statusOf(orderId)).toBe('nghiemthu');
      expect(result.schedule.paymentStatus).toBe('paid');
      expect(publishedTypes()).toEqual(['PaymentRecorded']);
      expect(await auditCount(orderId, 'PaymentRecorded')).toBe(1);
      expect(await auditCount(orderId, 'StatusChanged')).toBe(
        statusAuditsBefore,
      );
    });

    it('recorder without construction.transition: skipped 403, payment kept', async () => {
      const { orderId, inst } = await orderWithSchedule('nghiemthu');
      await seedPayment(orderId, inst[0].id, inst[0].amount);
      await seedPayment(orderId, inst[1].id, inst[1].amount);

      const result = await record(
        orderId,
        { installmentId: inst[2].id, amount: inst[2].amount },
        RECORD_ONLY,
      );

      expect(result.autoTransition?.outcome).toBe('skipped');
      expect(result.autoTransition?.message).toBe(
        'Bạn không có quyền thực hiện chuyển trạng thái này.',
      );
      expect(await paymentRows(orderId)).toBe(3);
      expect(await statusOf(orderId)).toBe('nghiemthu');
    });

    it('thicong has no close edge: skipped, payment kept', async () => {
      const { orderId, inst } = await orderWithSchedule('thicong');
      await seedPayment(orderId, inst[0].id, inst[0].amount);
      await seedPayment(orderId, inst[1].id, inst[1].amount);
      const result = await record(orderId, {
        installmentId: inst[2].id,
        amount: inst[2].amount,
      });
      expect(result.autoTransition?.outcome).toBe('skipped');
      expect(await paymentRows(orderId)).toBe(3);
      expect(await statusOf(orderId)).toBe('thicong');
    });

    it('deposit completed while the order is already in thicong: skipped, payment kept', async () => {
      const { orderId, inst } = await orderWithSchedule('thicong');
      const result = await record(orderId, {
        installmentId: inst[0].id,
        amount: inst[0].amount,
      });
      expect(result.autoTransition).toMatchObject({
        event: 'du_coc',
        outcome: 'skipped',
      });
      expect(await paymentRows(orderId)).toBe(1);
    });
  });

  describe('settlement', () => {
    it('dagiao, schedule matching the total, last installment paid ⇒ hoanthanh applied', async () => {
      const { orderId, inst } = await orderWithSchedule('dagiao');
      await seedPayment(orderId, inst[0].id, inst[0].amount);
      await seedPayment(orderId, inst[1].id, inst[1].amount);
      const result = await record(orderId, {
        installmentId: inst[2].id,
        amount: inst[2].amount,
      });
      expect(result.autoTransition).toEqual({
        event: 'hoan_thanh',
        outcome: 'applied',
        message: null,
      });
      expect(await statusOf(orderId)).toBe('hoanthanh');
      expect(publishedTypes()).toEqual(['PaymentRecorded', 'StatusChanged']);
    });

    it('a schedule short of the total, every installment paid ⇒ no transition', async () => {
      const { orderId, inst } = await orderWithSchedule('dagiao', {
        inputs: [
          { percent: 20, conditionNote: 'Cọc' },
          { percent: 70, conditionNote: 'Thi công' },
          { amount: 1_000_000, conditionNote: 'Bàn giao' },
        ],
      });
      await seedPayment(orderId, inst[0].id, inst[0].amount);
      await seedPayment(orderId, inst[1].id, inst[1].amount);
      const result = await record(orderId, {
        installmentId: inst[2].id,
        amount: inst[2].amount,
      });
      expect(result.autoTransition).toBeNull();
      expect(await statusOf(orderId)).toBe('dagiao');
    });

    it('a single 100% installment paid on dachot ⇒ only du_coc, the order is dacoc, not closed', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot', {
        inputs: [{ percent: 100, conditionNote: 'Toàn bộ' }],
      });
      const result = await record(orderId, {
        installmentId: inst[0].id,
        amount: TOTAL,
      });
      expect(result.autoTransition?.event).toBe('du_coc');
      expect(await statusOf(orderId)).toBe('dacoc');
    });

    it('dagiao, last installment paid BEFORE the middle one ⇒ the middle payment settles the order', async () => {
      const { orderId, inst } = await orderWithSchedule('dagiao');
      await seedPayment(orderId, inst[0].id, inst[0].amount);
      const last = await record(orderId, {
        installmentId: inst[2].id,
        amount: inst[2].amount,
      });
      expect(last.autoTransition).toBeNull();
      expect(await statusOf(orderId)).toBe('dagiao');

      const middle = await record(orderId, {
        installmentId: inst[1].id,
        amount: inst[1].amount,
      });
      expect(middle.autoTransition).toEqual({
        event: 'hoan_thanh',
        outcome: 'applied',
        message: null,
      });
      expect(await statusOf(orderId)).toBe('hoanthanh');
      expect(publishedTypes()).toEqual([
        'PaymentRecorded',
        'PaymentRecorded',
        'StatusChanged',
      ]);
    });

    it('deposit paid LAST on dachot ⇒ du_coc applied, then hoan_thanh refused from dacoc; payment kept, one StatusChanged', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      await seedPayment(orderId, inst[2].id, inst[2].amount);
      await seedPayment(orderId, inst[1].id, inst[1].amount);
      const result = await record(orderId, {
        installmentId: inst[0].id,
        amount: inst[0].amount,
      });
      expect(result.autoTransition).toEqual({
        event: 'du_coc',
        outcome: 'applied',
        message: null,
      });
      expect(result.orderStatus).toBe('dacoc');
      expect(await statusOf(orderId)).toBe('dacoc');
      expect(await paymentRows(orderId)).toBe(3);
      expect(publishedTypes()).toEqual(['DepositRecorded', 'StatusChanged']);
      const event = published[0] as DepositRecorded;
      expect(event.after.autoTransitions.map((a) => a.outcome)).toEqual([
        'applied',
        'skipped',
      ]);
    });

    it('hoanthanh order with money still owed ⇒ recorded', async () => {
      const { orderId, inst } = await orderWithSchedule('hoanthanh');
      await record(orderId, { installmentId: inst[1].id, amount: 1_000 });
      expect(await paymentRows(orderId)).toBe(1);
    });
  });

  describe('any other error inside the tx rolls the payment back (never only 403/409)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('an error thrown AFTER the real transition wrote the status ⇒ no payment row, status unchanged, nothing published', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const statusAuditsBefore = await auditCount(orderId, 'StatusChanged');
      const real = orders.autoTransitionInTx.bind(orders);
      const boom = new Error('unexpected failure after the status write');
      jest
        .spyOn(orders, 'autoTransitionInTx')
        .mockImplementationOnce(async (t, input) => {
          // The real engine writes `dachot → dacoc` in THIS tx, then something else fails.
          await real(t, input);
          throw boom;
        });

      expect(
        await rejection(
          record(orderId, {
            installmentId: inst[0].id,
            amount: inst[0].amount,
          }),
        ),
      ).toBe(boom);
      expect(await paymentRows(orderId)).toBe(0);
      expect(await statusOf(orderId)).toBe('dachot');
      expect(published).toEqual([]);
      expect(await auditCount(orderId, 'DepositRecorded')).toBe(0);
      expect(await auditCount(orderId, 'StatusChanged')).toBe(
        statusAuditsBefore,
      );
    });

    it('a database error inside the transition ⇒ the whole tx aborts, no payment row', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      jest
        .spyOn(orders, 'autoTransitionInTx')
        .mockImplementationOnce(async (t) => {
          await t.$queryRaw`SELECT 1 / 0`;
          return null;
        });

      const err = await rejection(
        record(orderId, { installmentId: inst[0].id, amount: inst[0].amount }),
      );
      expect(err).not.toBeInstanceOf(AppException);
      expect(await paymentRows(orderId)).toBe(0);
      expect(await statusOf(orderId)).toBe('dachot');
      expect(published).toEqual([]);
    });
  });

  describe('idempotency', () => {
    it('same key + same payload twice ⇒ same payment id, one row, no second audit row', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const input = {
        idempotencyKey: randomUUID(),
        installmentId: inst[0].id,
        amount: inst[0].amount,
        note: '  ghi chú  ',
      };
      const first = await record(orderId, input);
      const again = await record(orderId, input);
      expect(again.payment.id).toBe(first.payment.id);
      expect(again.autoTransition).toBeNull();
      expect(await paymentRows(orderId)).toBe(1);
      expect(await auditCount(orderId, 'DepositRecorded')).toBe(1);
      expect(publishedTypes()).toEqual(['DepositRecorded', 'StatusChanged']);
    });

    it('same key on another amount ⇒ 409, nothing written', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const key = randomUUID();
      await record(orderId, {
        idempotencyKey: key,
        installmentId: inst[0].id,
        amount: 1_000,
      });
      const err = (await rejection(
        record(orderId, {
          idempotencyKey: key,
          installmentId: inst[0].id,
          amount: 2_000,
        }),
      )) as AppException;
      expect(err.getStatus()).toBe(409);
      expect(await paymentRows(orderId)).toBe(1);
    });

    it('a retry whose response was lost replays after the order was cancelled meanwhile', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const input = {
        idempotencyKey: randomUUID(),
        installmentId: inst[1].id,
        amount: 1_000,
      };
      const first = await record(orderId, input);
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'huy' },
      });
      published.length = 0;
      const again = await record(orderId, input);
      expect(again.payment.id).toBe(first.payment.id);
      expect(again.orderStatus).toBe('huy');
      expect(await paymentRows(orderId)).toBe(1);
      expect(published).toEqual([]);
    });

    it('one key sent to ANOTHER order while the first insert is uncommitted ⇒ 409 once it commits, never a 500', async () => {
      const a = await orderWithSchedule('dachot');
      const b = await orderWithSchedule('dachot');
      const key = randomUUID();
      const holder = holdOrderLock(a.orderId, (t) =>
        seedPayment(a.orderId, a.inst[1].id, 1_000, t, key),
      );
      await wait(150);
      // Different order ⇒ different row lock: only the unique index makes B wait for A.
      const outcome = rejection(
        record(b.orderId, {
          idempotencyKey: key,
          installmentId: b.inst[1].id,
          amount: 1_000,
        }),
      );
      await wait(300);
      holder.release();
      await holder.tx;
      const err = (await outcome) as AppException;
      expect(err).toBeInstanceOf(AppException);
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Khoá ghi nhận đã được dùng cho một khoản khác.',
      );
      expect(await paymentRows(a.orderId)).toBe(1);
      expect(await paymentRows(b.orderId)).toBe(0);
    });

    it('the unique key stands on its own', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const key = randomUUID();
      await seedPayment(orderId, inst[0].id, 1, prisma, key);
      const err = await rejection(
        seedPayment(orderId, inst[0].id, 1, prisma, key),
      );
      expect(String((err as Error).message)).toMatch(/idempotency_key/);
    });
  });

  describe('CHECK constraints stand on their own', () => {
    it.each([
      ['amount = 0', { amount: 0 }, 'payments_amount_positive'],
      ['amount < 0', { amount: -1 }, 'payments_amount_positive'],
      ['unknown method', { method: 'momo' }, 'payments_method_known'],
    ])('%s is rejected by %s', async (_l, override, constraint) => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const err = await rejection(
        prisma.payment.create({
          data: {
            orderId,
            installmentId: inst[0].id,
            amount: 1_000,
            paidOn: new Date('2026-10-21T00:00:00.000Z'),
            method: 'cash',
            idempotencyKey: randomUUID(),
            recordedByAccountId: ACTOR,
            ...override,
          },
        }),
      );
      expect(String((err as Error).message)).toContain(constraint);
    });
  });

  describe('🔴 FOR UPDATE on orders: FORCED interleaving', () => {
    it('a holder that INSERTS a payment on installment 1 under the lock ⇒ the recorder waits, then sees it and refuses the overpay', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const lock = holdOrderLock(orderId, (t) =>
        seedPayment(orderId, inst[0].id, 10_000_000, t),
      );
      await wait(150);
      let settled = false;
      // Fits only if the holder's 10,000,000 is not counted.
      const running = rejection(
        record(orderId, {
          installmentId: inst[0].id,
          amount: inst[0].amount - 5_000_000,
        }),
      ).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      lock.release();
      await lock.tx;
      const err = (await running) as AppException;
      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.[0]?.code).toBe('exceedsRemaining');
      const sum = await prisma.payment.aggregate({
        where: { installmentId: inst[0].id },
        _sum: { amount: true },
      });
      expect(Number(sum._sum.amount)).toBeLessThanOrEqual(inst[0].amount);
      expect(await paymentRows(orderId)).toBe(1);
    });

    it('a holder that INSERTS the payment of the same key under the lock ⇒ the retry waits, then replays it (no P2002 500)', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const key = randomUUID();
      const lock = holdOrderLock(orderId, (t) =>
        t.payment.create({
          data: {
            orderId,
            installmentId: inst[0].id,
            amount: 1_000_000,
            paidOn: new Date(`${today()}T00:00:00.000Z`),
            method: 'bank_transfer',
            idempotencyKey: key,
            recordedByAccountId: ACTOR,
          },
        }),
      );
      await wait(150);
      const running = record(orderId, {
        idempotencyKey: key,
        installmentId: inst[0].id,
        amount: 1_000_000,
      });
      await wait(300);
      lock.release();
      await lock.tx;
      const result = await running;
      const row = await prisma.payment.findUniqueOrThrow({
        where: { idempotencyKey: key },
      });
      expect(result.payment.id).toBe(row.id);
      expect(await paymentRows(orderId)).toBe(1);
    });

    it('two recordings with one key in parallel ⇒ both resolve with one payment id, one row', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const input = {
        idempotencyKey: randomUUID(),
        installmentId: inst[0].id,
        amount: 1_000_000,
      };
      const [a, b] = await Promise.all([
        record(orderId, input),
        record(orderId, input),
      ]);
      expect(a.payment.id).toBe(b.payment.id);
      expect(await paymentRows(orderId)).toBe(1);
    });

    it('a holder that INSERTS a payment under the lock ⇒ a concurrent schedule replace waits, then 409 (never a 500 FK)', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const lock = holdOrderLock(orderId, (t) =>
        seedPayment(orderId, inst[0].id, 1_000_000, t),
      );
      await wait(150);
      const running = rejection(
        schedules.replace(
          ACTOR,
          ALL,
          orderId,
          [{ percent: 100, conditionNote: 'Toàn bộ' }],
          8,
          false,
        ),
      );
      await wait(300);
      lock.release();
      await lock.tx;
      const err = (await running) as AppException;
      expect(err).toBeInstanceOf(AppException);
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe('Đơn đã có thanh toán — không sửa lịch được.');
      expect(
        await prisma.installment.count({ where: { schedule: { orderId } } }),
      ).toBe(3);
      const view = await schedules.get(ACTOR, ALL, orderId, 8, false);
      expect(view.editable).toBe(false);
    });

    it('an order cancelled under the lock ⇒ the in-tx re-check refuses with 409, nothing written', async () => {
      const { orderId, inst } = await orderWithSchedule('dachot');
      const lock = holdOrderLock(orderId, (t) =>
        t.order.update({ where: { id: orderId }, data: { status: 'huy' } }),
      );
      await wait(150);
      const running = rejection(
        record(orderId, { installmentId: inst[0].id, amount: 1_000 }),
      );
      await wait(300);
      lock.release();
      await lock.tx;
      const err = (await running) as AppException;
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe('Đơn vừa thay đổi — tải lại rồi ghi nhận lại.');
      expect(await paymentRows(orderId)).toBe(0);
    });
  });
});
