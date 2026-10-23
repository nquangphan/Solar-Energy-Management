import { PERM } from '../src/accounts/domain/permission-registry';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { ORDER_STATUS_KEYS } from '../src/orders/domain/order-status';
import type { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * DashboardService — hermetic unit (mock Prisma). Pins which query runs for which permission:
 * the money query never runs without `dashboard.finance_view`, the order queries never run
 * without an order read permission, and the order queries receive the EXACT scope array of
 * `OrdersService.scopeWhere` (the same clause `GET /orders` uses).
 */
describe('DashboardService', () => {
  const CALLER = 'acc-sale-1';
  // Monday 2026-10-26 00:10 in Vietnam.
  const NOW = new Date('2026-10-25T17:10:00Z');
  const SCOPE = [
    { OR: [{ ownerAccountId: CALLER }, { assigneeAccountId: CALLER }] },
  ];

  const queryRaw = jest.fn();
  const count = jest.fn();
  const groupBy = jest.fn();
  const scopeWhere = jest.fn();
  const service = new DashboardService(
    {
      $queryRaw: queryRaw,
      order: { count, groupBy },
    } as unknown as PrismaService,
    { scopeWhere } as unknown as OrdersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ total: 3_000_000_000n }]);
    count.mockResolvedValue(4);
    groupBy.mockResolvedValue([
      { status: 'thicong', _count: { _all: 3 } },
      { status: 'baogia', _count: { _all: 7 } },
    ]);
    scopeWhere.mockReturnValue(SCOPE);
  });

  const summary = (period: 'day' | 'week' | 'month', ...perms: string[]) =>
    service.summary(CALLER, new Set(perms), period, NOW);

  it('without dashboard.finance_view: revenue is null and the money query never runs', async () => {
    const result = await summary('month', PERM.ordersViewAll);
    expect(result.revenue).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(result.newOrderCount).toBe(4);
  });

  it('with dashboard.finance_view: revenue is the SUM read as BigInt, turned into a number', async () => {
    const result = await summary('month', PERM.dashboardFinanceView);
    expect(result.revenue).toBe(3_000_000_000);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('the money query is bounded by the period days', async () => {
    await summary('week', PERM.dashboardFinanceView);
    const values = (queryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(values).toEqual(['2026-10-26', '2026-10-26']);
  });

  it('without any order read permission: counts are null and no order query runs', async () => {
    const result = await summary('month', PERM.dashboardFinanceView);
    expect(result.newOrderCount).toBeNull();
    expect(result.ordersByStatus).toBeNull();
    expect(count).not.toHaveBeenCalled();
    expect(groupBy).not.toHaveBeenCalled();
    expect(scopeWhere).not.toHaveBeenCalled();
  });

  it('view_own: both order queries carry the exact scopeWhere array', async () => {
    const perms = new Set<string>([PERM.ordersViewOwn]);
    await service.summary(CALLER, perms, 'day', NOW);
    expect(scopeWhere).toHaveBeenCalledWith(CALLER, perms);
    const countWhere = (
      count.mock.calls[0] as [{ where: { AND: unknown[] } }]
    )[0].where.AND;
    expect(countWhere.slice(1)).toEqual(SCOPE);
    expect(countWhere[1]).toBe(SCOPE[0]);
    const groupWhere = (
      groupBy.mock.calls[0] as [{ where: { AND: unknown[] } }]
    )[0].where.AND;
    expect(groupWhere).toEqual(SCOPE);
    expect(groupWhere[0]).toBe(SCOPE[0]);
  });

  it('new orders are counted on the half-open Vietnam-day instant range', async () => {
    await summary('day', PERM.ordersViewAll);
    const countWhere = (
      count.mock.calls[0] as [{ where: { AND: unknown[] } }]
    )[0].where.AND;
    expect(countWhere[0]).toEqual({
      createdAt: {
        gte: new Date('2026-10-25T17:00:00.000Z'),
        lt: new Date('2026-10-26T17:00:00.000Z'),
      },
    });
  });

  it('the status breakdown is a snapshot: no period filter on groupBy', async () => {
    scopeWhere.mockReturnValue([]);
    await summary('day', PERM.ordersViewAll);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
      where: { AND: [] },
    });
  });

  it('ordersByStatus lists all ten statuses in workflow order, missing ones as 0', async () => {
    const result = await summary('month', PERM.ordersViewAll);
    expect(result.ordersByStatus).toEqual([
      { status: 'baogia', count: 7 },
      { status: 'choduyet', count: 0 },
      { status: 'dachot', count: 0 },
      { status: 'dacoc', count: 0 },
      { status: 'thicong', count: 3 },
      { status: 'nghiemthu', count: 0 },
      { status: 'danggiao', count: 0 },
      { status: 'dagiao', count: 0 },
      { status: 'hoanthanh', count: 0 },
      { status: 'huy', count: 0 },
    ]);
    expect(result.ordersByStatus?.map((s) => s.status)).toEqual([
      ...ORDER_STATUS_KEYS,
    ]);
  });

  it('echoes the period and its Vietnam days', async () => {
    const result = await summary('week', PERM.ordersViewAll);
    expect(result).toMatchObject({
      period: 'week',
      from: '2026-10-26',
      to: '2026-10-26',
    });
  });
});
