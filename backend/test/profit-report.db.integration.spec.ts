import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  PROFIT_GROUP_BY,
  UNASSIGNED_LABEL,
  profitFigures,
} from '../src/dashboard/domain/profit-report';
import { ProfitReportService } from '../src/dashboard/profit-report.service';
import type { ProfitReportResponseDto } from '../src/dashboard/dto/profit-report-response.dto';
import {
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_HUY,
  TRANG_THAI_THI_CONG,
} from '../src/orders/domain/order-status';
import { quoteNumberOf } from '../src/orders/domain/quote-number';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Profit report on REAL Postgres — what a mock cannot prove: which orders the joins and filters
 * keep, the `::bigint` before a line product past INT4, the half-open Vietnam-day bounds on the
 * UTC `TIMESTAMP` `stock_vouchers.created_at`, the Vietnam month of an issue, and the lines being
 * those of the voucher's version.
 *
 * Every voucher is dated 2033 so data of other suites or the dev seed cannot land in a period
 * measured here. Expected money is recomputed from the seeded lines with the AC formula
 * (Σ unitPriceSnapshot × qty − discount, Σ costPriceSnapshot × qty), never typed in.
 *
 * Skipped without `DATABASE_URL` ⇒ `npm test` stays hermetic. Run: `npm run test:db`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

interface Line {
  unitPriceSnapshot: number;
  costPriceSnapshot: number | null;
  qty: number;
}

interface Seeded {
  lines: Line[];
  discountAmount: number | null;
}

/** Revenue/cost of an order straight from the AC wording. */
function money({ lines, discountAmount }: Seeded) {
  let revenue = -(discountAmount ?? 0);
  let cost = 0;
  for (const l of lines) {
    revenue += l.unitPriceSnapshot * l.qty;
    cost += (l.costPriceSnapshot ?? l.unitPriceSnapshot) * l.qty;
  }
  return { revenue, cost };
}

describeDb('Profit report on real Postgres', () => {
  let prisma: PrismaClient;
  let service: ProfitReportService;

  const PHONE = '+84900000086';
  const SALE_A = 'acc-profit-86-a';
  const SALE_B = 'acc-profit-86-b';
  const RETIRED_SOURCE_NAME = 'Nguồn ngừng 8.6';
  const NOW = new Date('2033-09-15T03:00:00Z');
  const JULY = {
    period: 'custom' as const,
    from: '2033-07-01',
    to: '2033-07-31',
  };

  let facebookId: string;
  let retiredSourceId: string;
  const ids: Record<string, string> = {};

  // Panels (stock-tracked, real cost) + installation (cost frozen at the selling price).
  const PANELS: Line = {
    unitPriceSnapshot: 3_250_000,
    costPriceSnapshot: 2_610_000,
    qty: 14,
  };
  const INSTALLATION: Line = {
    unitPriceSnapshot: 6_500_000,
    costPriceSnapshot: 6_500_000,
    qty: 1,
  };
  /** unit × qty = 6,000,000,000 > INT4 max: overflows unless cast to bigint first. */
  const BIG: Line = {
    unitPriceSnapshot: 2_000_000_000,
    costPriceSnapshot: 1_500_000_000,
    qty: 3,
  };

  const ISSUED: Seeded = {
    lines: [PANELS, INSTALLATION],
    discountAmount: 2_000_000,
  };
  const BIG_ORDER: Seeded = { lines: [BIG], discountAmount: null };
  /** A line without a cost snapshot: counted at its selling price, so it adds no profit. */
  const NO_COST: Line = {
    unitPriceSnapshot: 500_000,
    costPriceSnapshot: null,
    qty: 3,
  };
  /** Issued on its FIRST version; the current version has other lines that must not count. */
  const ISSUED_V1: Seeded = {
    lines: [
      { unitPriceSnapshot: 1_000_000, costPriceSnapshot: 700_000, qty: 2 },
      NO_COST,
    ],
    discountAmount: null,
  };
  const CURRENT_V2_LINES: Line[] = [
    { unitPriceSnapshot: 9_000_000, costPriceSnapshot: 100_000, qty: 5 },
  ];
  const NEXT_DAY: Seeded = {
    lines: [
      { unitPriceSnapshot: 4_000_000, costPriceSnapshot: 3_000_000, qty: 1 },
    ],
    discountAmount: null,
  };
  const OTHER: Seeded = {
    lines: [
      { unitPriceSnapshot: 5_000_000, costPriceSnapshot: 1_000_000, qty: 1 },
    ],
    discountAmount: null,
  };

  async function cleanUp(): Promise<void> {
    const orders = await prisma.order.findMany({
      where: { customerSdt: PHONE },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      await prisma.stockVoucher.deleteMany({
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
    }
    await prisma.customer.deleteMany({ where: { sdt: PHONE } });
    await prisma.customerSource.deleteMany({
      where: { name: RETIRED_SOURCE_NAME },
    });
    await prisma.account.deleteMany({
      where: { id: { in: [SALE_A, SALE_B] } },
    });
  }

  async function createVersion(
    orderId: string,
    versionNo: number,
    seeded: Seeded,
  ): Promise<string> {
    const version = await prisma.orderVersion.create({
      data: {
        orderId,
        versionNo,
        discountAmount: seeded.discountAmount,
        chotAt: new Date('2033-06-01T03:00:00Z'),
        lineItems: {
          create: seeded.lines.map((l, i) => ({
            name: `Dòng ${i + 1}`,
            unit: 'cái',
            qty: l.qty,
            unitPrice: l.unitPriceSnapshot,
            unitPriceSnapshot: l.unitPriceSnapshot,
            costPriceSnapshot: l.costPriceSnapshot,
            displayOrder: i,
          })),
        },
      },
    });
    return version.id;
  }

  /** Order + its version; a stock-issue voucher dated `issuedAt` when given. */
  async function createOrder(input: {
    status: string;
    assignee: string | null;
    sourceId: string;
    seeded: Seeded;
    issuedAt: Date | null;
  }): Promise<string> {
    const order = await prisma.order.create({
      data: {
        status: input.status,
        customerSdt: PHONE,
        ownerAccountId: SALE_A,
        assigneeAccountId: input.assignee,
        sourceId: input.sourceId,
        custType: 'CA_NHAN',
      },
    });
    const versionId = await createVersion(order.id, 1, input.seeded);
    await prisma.order.update({
      where: { id: order.id },
      data: { currentVersionId: versionId },
    });
    if (input.issuedAt !== null) {
      await prisma.stockVoucher.create({
        data: {
          type: 'xuat',
          createdByAccountId: SALE_A,
          orderId: order.id,
          orderVersionId: versionId,
          createdAt: input.issuedAt,
        },
      });
    }
    return order.id;
  }

  const report = (
    groupBy: (typeof PROFIT_GROUP_BY)[number],
    range: { period: 'custom'; from: string; to: string } = JULY,
  ): Promise<ProfitReportResponseDto> =>
    service.report({ groupBy, ...range }, NOW);

  const keysOf = (r: ProfitReportResponseDto) => r.rows.map((row) => row.key);

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new ProfitReportService(prisma as unknown as PrismaService);

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('CustomerSource not seeded — run `npx prisma db seed`.');
    }
    facebookId = facebook.id;

    await cleanUp();
    await prisma.account.createMany({
      data: [
        {
          id: SALE_A,
          email: 'profit-86-a@test.local',
          passwordHash: 'x',
          displayName: 'Sale A 8.6',
        },
        {
          id: SALE_B,
          email: 'profit-86-b@test.local',
          passwordHash: 'x',
          displayName: 'Sale B 8.6',
          isActive: false,
        },
      ],
    });
    const retired = await prisma.customerSource.create({
      data: { name: RETIRED_SOURCE_NAME, active: false, sortOrder: 986 },
    });
    retiredSourceId = retired.id;
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'CA_NHAN',
        name: 'Khách 8.6',
        sourceId: facebookId,
      },
    });

    ids.issued = await createOrder({
      status: TRANG_THAI_THI_CONG,
      assignee: SALE_A,
      sourceId: facebookId,
      seeded: ISSUED,
      issuedAt: new Date('2033-07-10T03:00:00Z'),
    });
    // 23:59:59 on 31/07 in Vietnam: the last second of July.
    ids.big = await createOrder({
      status: TRANG_THAI_DA_GIAO,
      assignee: null,
      sourceId: retiredSourceId,
      seeded: BIG_ORDER,
      issuedAt: new Date('2033-07-31T23:59:59+07:00'),
    });
    // 00:00:00 on 01/08 in Vietnam (17:00Z on 31/07): August, not July.
    ids.nextDay = await createOrder({
      status: TRANG_THAI_THI_CONG,
      assignee: null,
      sourceId: facebookId,
      seeded: NEXT_DAY,
      issuedAt: new Date('2033-08-01T00:00:00+07:00'),
    });
    // 17:30Z on 31/07 is already 01/08 in Vietnam: month 2033-08.
    ids.lateUtc = await createOrder({
      status: TRANG_THAI_THI_CONG,
      assignee: SALE_A,
      sourceId: retiredSourceId,
      seeded: OTHER,
      issuedAt: new Date('2033-07-31T17:30:00Z'),
    });
    // The first second of July in Vietnam (17:00Z on 30/06): July.
    ids.firstSecond = await createOrder({
      status: TRANG_THAI_THI_CONG,
      assignee: SALE_B,
      sourceId: facebookId,
      seeded: ISSUED_V1,
      issuedAt: new Date('2033-07-01T00:00:00+07:00'),
    });
    const v2 = await createVersion(ids.firstSecond, 2, {
      lines: CURRENT_V2_LINES,
      discountAmount: null,
    });
    await prisma.order.update({
      where: { id: ids.firstSecond },
      data: { currentVersionId: v2 },
    });
    // The last second of June in Vietnam: out of July.
    ids.june = await createOrder({
      status: TRANG_THAI_THI_CONG,
      assignee: SALE_A,
      sourceId: facebookId,
      seeded: OTHER,
      issuedAt: new Date('2033-06-30T23:59:59+07:00'),
    });
    // Never in the report: confirmed but not issued; service-only (cost frozen, no voucher);
    // issued then cancelled.
    ids.confirmed = await createOrder({
      status: TRANG_THAI_DA_CHOT,
      assignee: SALE_A,
      sourceId: facebookId,
      seeded: OTHER,
      issuedAt: null,
    });
    ids.serviceOnly = await createOrder({
      status: TRANG_THAI_DA_GIAO,
      assignee: SALE_A,
      sourceId: facebookId,
      seeded: { lines: [INSTALLATION], discountAmount: null },
      issuedAt: null,
    });
    ids.cancelled = await createOrder({
      status: TRANG_THAI_HUY,
      assignee: SALE_A,
      sourceId: facebookId,
      seeded: OTHER,
      issuedAt: new Date('2033-07-15T03:00:00Z'),
    });
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('keeps only issued, non-cancelled orders of the period', async () => {
    const r = await report('order');
    expect(new Set(keysOf(r))).toEqual(
      new Set([ids.issued, ids.big, ids.firstSecond]),
    );
    for (const absent of [
      ids.confirmed,
      ids.serviceOnly,
      ids.cancelled,
      ids.nextDay,
      ids.lateUtc,
      ids.june,
    ])
      expect(keysOf(r)).not.toContain(absent);
  });

  it('revenue subtracts the approved discount; the installation line adds no profit', async () => {
    const row = (await report('order')).rows.find((x) => x.key === ids.issued);
    const { revenue, cost } = money(ISSUED);
    expect(row).toMatchObject({
      label: quoteNumberOf(ids.issued),
      customerName: 'Khách 8.6',
      assigneeDisplayName: 'Sale A 8.6',
      sourceName: 'Facebook',
      issuedAt: new Date('2033-07-10T03:00:00Z'),
      orderCount: 1,
      ...profitFigures(revenue, cost),
    });
    expect(row!.grossProfit).toBe(
      (PANELS.unitPriceSnapshot - PANELS.costPriceSnapshot!) * PANELS.qty -
        ISSUED.discountAmount!,
    );
  });

  it('a line product past INT4 is summed exactly, not an overflow error', async () => {
    const row = (await report('order')).rows.find((x) => x.key === ids.big);
    expect(row).toMatchObject(
      profitFigures(money(BIG_ORDER).revenue, money(BIG_ORDER).cost),
    );
    expect(row!.revenue).toBeGreaterThan(2_147_483_647);
  });

  it("counts the lines of the voucher's version, not the current one", async () => {
    const row = (await report('order')).rows.find(
      (x) => x.key === ids.firstSecond,
    );
    expect(row).toMatchObject(
      profitFigures(money(ISSUED_V1).revenue, money(ISSUED_V1).cost),
    );
  });

  it('a line without a cost snapshot counts at its selling price: no profit, never inflated', async () => {
    const row = (await report('order')).rows.find(
      (x) => x.key === ids.firstSecond,
    );
    const withoutNoCost = money({
      lines: ISSUED_V1.lines.filter((l) => l !== NO_COST),
      discountAmount: ISSUED_V1.discountAmount,
    });
    expect(row!.grossProfit).toBe(
      profitFigures(withoutNoCost.revenue, withoutNoCost.cost).grossProfit,
    );
  });

  it('Vietnam-day bounds: both ends of July in, the neighbours out', async () => {
    const keys = keysOf(await report('order'));
    expect(keys).toContain(ids.firstSecond);
    expect(keys).toContain(ids.big);
    expect(keys).not.toContain(ids.june);
    expect(keys).not.toContain(ids.nextDay);
  });

  it('groups by the Vietnam month of the issue', async () => {
    const r = await report('month', {
      period: 'custom',
      from: '2033-07-01',
      to: '2033-08-31',
    });
    expect(r.rows.map((x) => [x.key, x.label, x.orderCount])).toEqual([
      ['2033-08', '08/2033', 2],
      ['2033-07', '07/2033', 3],
    ]);
    const august = money(NEXT_DAY);
    const lateUtc = money(OTHER);
    expect(r.rows[0]).toMatchObject(
      profitFigures(
        august.revenue + lateUtc.revenue,
        august.cost + lateUtc.cost,
      ),
    );
  });

  it.each(PROFIT_GROUP_BY)(
    'grouped by %s, the rows add up to the totals',
    async (groupBy) => {
      const r = await report(groupBy, {
        period: 'custom',
        from: '2033-06-01',
        to: '2033-08-31',
      });
      const sum = (f: (row: (typeof r.rows)[number]) => number) =>
        r.rows.reduce((t, row) => t + f(row), 0);
      expect(r.totals.orderCount).toBe(6);
      expect(sum((x) => x.revenue)).toBe(r.totals.revenue);
      expect(sum((x) => x.cost)).toBe(r.totals.cost);
      expect(sum((x) => x.grossProfit)).toBe(r.totals.grossProfit);
      expect(sum((x) => x.orderCount)).toBe(r.totals.orderCount);
    },
  );

  it('totals of July are the sum of its three orders', async () => {
    const r = await report('source');
    const all = [ISSUED, BIG_ORDER, ISSUED_V1].map(money);
    expect(r.totals).toEqual({
      ...profitFigures(
        all.reduce((t, m) => t + m.revenue, 0),
        all.reduce((t, m) => t + m.cost, 0),
      ),
      orderCount: 3,
    });
  });

  it('unassigned orders share one null row; a deactivated assignee keeps the name', async () => {
    const r = await report('assignee', {
      period: 'custom',
      from: '2033-06-01',
      to: '2033-08-31',
    });
    const byKey = new Map(r.rows.map((x) => [x.key, x]));
    expect(byKey.get(null)).toMatchObject({
      label: UNASSIGNED_LABEL,
      orderCount: 2,
    });
    expect(byKey.get(SALE_B)).toMatchObject({
      label: 'Sale B 8.6',
      orderCount: 1,
    });
    expect(byKey.get(SALE_A)?.orderCount).toBe(3);
  });

  it('a retired customer source still shows its name', async () => {
    const r = await report('source');
    expect(r.rows.find((x) => x.key === retiredSourceId)?.label).toBe(
      RETIRED_SOURCE_NAME,
    );
    expect(r.rows.find((x) => x.key === facebookId)?.orderCount).toBe(2);
  });
});
