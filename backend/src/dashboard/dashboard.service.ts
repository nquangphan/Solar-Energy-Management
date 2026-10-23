import { Injectable } from '@nestjs/common';
import { PERM } from '../accounts/domain/permission-registry';
import { ORDER_STATUS_KEYS } from '../orders/domain/order-status';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  periodRange,
  vietnamRangeToInstants,
  type DashboardPeriod,
} from './domain/dashboard-period';

export interface DashboardSummaryView {
  period: DashboardPeriod;
  from: string;
  to: string;
  revenue: number | null;
  newOrderCount: number | null;
  ordersByStatus: { status: string; count: number }[] | null;
}

/**
 * Operations dashboard (FR-19). Every figure is computed here; clients only display it (AD-2).
 * Each block is gated by its own permission and stays `null` — its query never even runs — when
 * the caller lacks that permission (AD-4).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async summary(
    callerAccountId: string,
    permissions: ReadonlySet<string>,
    period: DashboardPeriod,
    now: Date,
  ): Promise<DashboardSummaryView> {
    const range = periodRange(period, now);
    const revenue = permissions.has(PERM.dashboardFinanceView)
      ? await this.revenue(range.from, range.to)
      : null;
    const canReadOrders =
      permissions.has(PERM.ordersViewAll) ||
      permissions.has(PERM.ordersViewOwn);
    if (!canReadOrders) {
      return {
        period,
        ...range,
        revenue,
        newOrderCount: null,
        ordersByStatus: null,
      };
    }

    const scope = this.orders.scopeWhere(callerAccountId, permissions);
    const { fromInstant, toExclusive } = vietnamRangeToInstants(range);
    const newOrderCount = await this.prisma.order.count({
      where: {
        AND: [{ createdAt: { gte: fromInstant, lt: toExclusive } }, ...scope],
      },
    });
    // A snapshot of the whole pipeline, not filtered by the period.
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { AND: scope },
    });
    const byStatus = new Map(groups.map((g) => [g.status, g._count._all]));
    return {
      period,
      ...range,
      revenue,
      newOrderCount,
      ordersByStatus: ORDER_STATUS_KEYS.map((status) => ({
        status,
        count: byStatus.get(status) ?? 0,
      })),
    };
  }

  /**
   * Money collected in the period, company-wide: whoever holds the finance permission sees every
   * payment, so this is NOT narrowed by the order scope. `paid_on` is a DATE that already holds
   * the Vietnam day, hence the plain string bounds. The sum can exceed INT4, so it is read as
   * `bigint` and becomes a number at this one point.
   */
  private async revenue(from: string, to: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(amount), 0)::bigint AS total
      FROM payments
      WHERE paid_on BETWEEN ${from}::date AND ${to}::date`;
    return Number(row.total);
  }
}
