import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { DashboardService } from '../src/dashboard/dashboard.service';
import type { EventBus } from '../src/events/event-bus';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_THI_CONG,
} from '../src/orders/domain/order-status';
import { OrdersService } from '../src/orders/orders.service';
import { MAX_INSTALLMENT_AMOUNT } from '../src/payments/domain/payment-schedule';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Dashboard aggregates on REAL Postgres — what a mock cannot prove: the `::bigint` SUM past
 * INT4, the DATE bounds on `paid_on`, the half-open instant range on the UTC `TIMESTAMP(3)`
 * `created_at`, and the scope clause actually excluding someone else's orders.
 *
 * Every fixture lives in mid-2031 and `now` is set there, so data from other suites or the dev
 * seed (dated today) cannot land in any period measured here.
 *
 * Skipped without `DATABASE_URL` ⇒ `npm test` stays hermetic. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Dashboard summary on real Postgres', () => {
  let prisma: PrismaClient;
  let service: DashboardService;

  const PHONE = '+84900000081';
  const ME = 'acc-dashboard-81-me';
  const OTHER = 'acc-dashboard-81-other';
  // Thursday 2031-07-03 10:00 in Vietnam. Week = Mon 2031-06-30 → today (crosses a month end).
  const NOW = new Date('2031-07-03T03:00:00Z');

  const PAID_TODAY = MAX_INSTALLMENT_AMOUNT;
  const PAID_YESTERDAY = MAX_INSTALLMENT_AMOUNT;
  const PAID_MONDAY_LAST_MONTH = 1_500_000_000;
  const PAID_SUNDAY_BEFORE = 700_000_000;

  let orderIds: string[] = [];

  async function cleanUp(): Promise<void> {
    const orders = await prisma.order.findMany({
      where: { customerSdt: PHONE },
      select: { id: true },
    });
    const ids = orders.map((o) => o.id);
    if (ids.length > 0) {
      await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.installment.deleteMany({
        where: { schedule: { orderId: { in: ids } } },
      });
      await prisma.paymentSchedule.deleteMany({
        where: { orderId: { in: ids } },
      });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.customer.deleteMany({ where: { sdt: PHONE } });
    await prisma.account.deleteMany({ where: { id: { in: [ME, OTHER] } } });
  }

  async function createOrder(
    sourceId: string,
    ownerAccountId: string,
    assigneeAccountId: string | null,
    status: string,
    createdAt: Date,
  ): Promise<string> {
    const order = await prisma.order.create({
      data: {
        status,
        customerSdt: PHONE,
        ownerAccountId,
        assigneeAccountId,
        sourceId,
        custType: 'CA_NHAN',
        createdAt,
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  const summary = (period: 'day' | 'week' | 'month', perms: string[]) =>
    service.summary(ME, new Set(perms), period, NOW);

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const orders = new OrdersService(
      prisma as unknown as PrismaService,
      { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
      fakeStorage(),
      {} as unknown as StockVouchersService,
      {} as unknown as StockItemsService,
    );
    service = new DashboardService(prisma as unknown as PrismaService, orders);

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('CustomerSource not seeded — run `npx prisma db seed`.');
    }

    await cleanUp();
    orderIds = [];
    await prisma.account.createMany({
      data: [
        {
          id: ME,
          email: 'dashboard-81-me@test.local',
          passwordHash: 'x',
          displayName: 'Me 8.1',
        },
        {
          id: OTHER,
          email: 'dashboard-81-other@test.local',
          passwordHash: 'x',
          displayName: 'Other 8.1',
        },
      ],
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Dashboard 8.1 customer',
        sourceId: facebook.id,
      },
    });

    // 23:30 in Vietnam on 2031-07-02 — the day before "today".
    await createOrder(
      facebook.id,
      ME,
      null,
      TRANG_THAI_BAO_GIA,
      new Date('2031-07-02T16:30:00Z'),
    );
    // 00:10 in Vietnam on 2031-07-03 — already "today".
    await createOrder(
      facebook.id,
      ME,
      null,
      TRANG_THAI_DA_CHOT,
      new Date('2031-07-02T17:10:00Z'),
    );
    // Someone else's order assigned to me, today.
    await createOrder(
      facebook.id,
      OTHER,
      ME,
      TRANG_THAI_THI_CONG,
      new Date('2031-07-03T02:00:00Z'),
    );
    // Purely someone else's order, today. It carries the payments.
    const othersOrder = await createOrder(
      facebook.id,
      OTHER,
      null,
      TRANG_THAI_BAO_GIA,
      new Date('2031-07-03T02:00:00Z'),
    );

    const schedule = await prisma.paymentSchedule.create({
      data: { orderId: othersOrder },
    });
    const paid: [number, string][] = [
      [PAID_TODAY, '2031-07-03'],
      [PAID_YESTERDAY, '2031-07-02'],
      [PAID_MONDAY_LAST_MONTH, '2031-06-30'],
      [PAID_SUNDAY_BEFORE, '2031-06-29'],
    ];
    for (const [i, [amount, paidOn]] of paid.entries()) {
      const installment = await prisma.installment.create({
        data: {
          scheduleId: schedule.id,
          seq: i + 1,
          amount,
          conditionNote: `Installment ${i + 1}`,
        },
      });
      await prisma.payment.create({
        data: {
          orderId: othersOrder,
          installmentId: installment.id,
          amount,
          paidOn: new Date(`${paidOn}T00:00:00Z`),
          method: 'bank_transfer',
          idempotencyKey: randomUUID(),
          recordedByAccountId: OTHER,
        },
      });
    }
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('a month total past INT4 (two payments at the installment cap) comes back exact', async () => {
    const result = await summary('month', [PERM.dashboardFinanceView]);
    expect(PAID_TODAY + PAID_YESTERDAY).toBeGreaterThan(2_147_483_647);
    expect(result.revenue).toBe(PAID_TODAY + PAID_YESTERDAY);
    expect(result).toMatchObject({ from: '2031-07-01', to: '2031-07-03' });
  });

  it('paid_on lands in the right period: today, yesterday, Monday of last month, Sunday before', async () => {
    expect((await summary('day', [PERM.dashboardFinanceView])).revenue).toBe(
      PAID_TODAY,
    );
    const week = await summary('week', [PERM.dashboardFinanceView]);
    expect(week).toMatchObject({ from: '2031-06-30', to: '2031-07-03' });
    expect(week.revenue).toBe(
      PAID_TODAY + PAID_YESTERDAY + PAID_MONDAY_LAST_MONTH,
    );
  });

  it('an order made at 23:30 the day before is not in "day"; one made at 00:10 is', async () => {
    const result = await summary('day', [PERM.ordersViewOwn]);
    // Mine at 00:10 + the one assigned to me; not mine at 23:30 the day before.
    expect(result.newOrderCount).toBe(2);
    expect((await summary('week', [PERM.ordersViewOwn])).newOrderCount).toBe(3);
  });

  it('view_all counts the other person’s order too', async () => {
    expect((await summary('day', [PERM.ordersViewAll])).newOrderCount).toBe(3);
  });

  it('view_own: the status breakdown skips other people’s orders and keeps the assigned one', async () => {
    const result = await summary('month', [PERM.ordersViewOwn]);
    const counts = Object.fromEntries(
      (result.ordersByStatus ?? []).map((s) => [s.status, s.count]),
    );
    expect(counts[TRANG_THAI_BAO_GIA]).toBe(1);
    expect(counts[TRANG_THAI_DA_CHOT]).toBe(1);
    expect(counts[TRANG_THAI_THI_CONG]).toBe(1);
    expect(result.ordersByStatus).toHaveLength(10);
  });
});
