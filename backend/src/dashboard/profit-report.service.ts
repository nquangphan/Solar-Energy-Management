import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PrismaService } from '../prisma/prisma.service';
import {
  profitPeriodRange,
  vietnamRangeToInstants,
  type DateRange,
} from './domain/dashboard-period';
import {
  groupProfitRows,
  profitTotals,
  type OrderProfitRow,
} from './domain/profit-report';
import type { ProfitReportQueryDto } from './dto/profit-report-query.dto';
import type { ProfitReportResponseDto } from './dto/profit-report-response.dto';

const MISSING_DATE = 'REQUIRED';
const MISSING_DATE_MESSAGE = 'Chọn ngày cho kỳ tuỳ chọn.';
const INVALID_DATE_RANGE = 'INVALID_DATE_RANGE';
const INVALID_DATE_RANGE_MESSAGE =
  'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
const DATES_ONLY_FOR_CUSTOM = 'DATES_ONLY_FOR_CUSTOM';
const DATES_ONLY_FOR_CUSTOM_MESSAGE = 'Chỉ gửi ngày khi chọn kỳ tuỳ chọn.';

function validationError(
  field: 'from' | 'to',
  code: string,
  message: string,
): AppException {
  return new AppException(ErrorCode.VALIDATION_ERROR, 400, message, [
    { field, code, message },
  ]);
}

/** Per-order row of the read query; money is `bigint` because sums can exceed INT4. */
type RawOrderProfitRow = Omit<OrderProfitRow, 'revenue' | 'cost'> & {
  revenue: bigint;
  cost: bigint;
};

/**
 * Gross profit on materials (FR-37, AD-20), READ ONLY: no write, no event, no lock.
 *
 * An order counts when and only when it has a stock-issue voucher and is not cancelled; its lines
 * are those of the version the voucher was issued for. The period filters on the issue date.
 * Company-wide: `costs.view` is the only gate, the order scope does not narrow it (as the
 * dashboard revenue).
 */
@Injectable()
export class ProfitReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(
    query: ProfitReportQueryDto,
    now: Date,
  ): Promise<ProfitReportResponseDto> {
    const groupBy = query.groupBy ?? 'order';
    const range = resolveRange(query, now);
    const orders = await this.issuedOrders(range);
    return {
      groupBy,
      ...range,
      totals: profitTotals(orders),
      rows: groupProfitRows(orders, groupBy),
    };
  }

  /**
   * One row per issued, non-cancelled order whose issue falls in the range — ONE query, no N+1.
   *
   * - Lines are joined on the VOUCHER's version, not on `current_version_id`.
   * - `::bigint` comes BEFORE the multiplication: `int4 * int4` overflows on a line above
   *   2,147,483,647 đồng and Postgres would throw.
   * - Revenue subtracts the approved discount snapshotted on that version, before VAT.
   * - A line without a cost snapshot falls back to its selling price (margin 0, never inflated);
   *   every line of an issued version is given one in the issuing tx, so this is only a net.
   * - `created_at` is a TIMESTAMP holding UTC: + 7 hours gives the Vietnam month.
   */
  private async issuedOrders(range: DateRange): Promise<OrderProfitRow[]> {
    const { fromInstant, toExclusive } = vietnamRangeToInstants(range);
    const rows = await this.prisma.$queryRaw<RawOrderProfitRow[]>`
      SELECT o.id AS "orderId",
             sv.created_at AS "issuedAt",
             to_char(sv.created_at + interval '7 hours', 'YYYY-MM') AS "issuedMonth",
             c.name AS "customerName",
             o.assignee_account_id AS "assigneeAccountId",
             a.display_name AS "assigneeDisplayName",
             o.source_id AS "sourceId",
             s.name AS "sourceName",
             (SUM(li.unit_price_snapshot::bigint * li.qty)
               - COALESCE(MAX(v.discount_amount), 0))::bigint AS revenue,
             SUM(COALESCE(li.cost_price_snapshot, li.unit_price_snapshot)::bigint * li.qty)::bigint AS cost
      FROM stock_vouchers sv
      JOIN orders o ON o.id = sv.order_id
      JOIN order_versions v ON v.id = sv.order_version_id
      JOIN order_line_items li ON li.order_version_id = sv.order_version_id
      JOIN customers c ON c.sdt = o.customer_sdt
      JOIN customer_sources s ON s.id = o.source_id
      LEFT JOIN accounts a ON a.id = o.assignee_account_id
      WHERE sv.type = 'xuat'
        AND sv.order_id IS NOT NULL
        AND o.status <> 'huy'
        AND sv.created_at >= ${fromInstant}
        AND sv.created_at < ${toExclusive}
      GROUP BY o.id, sv.id, c.name, a.display_name, s.name`;
    return rows.map((row) => ({
      ...row,
      revenue: Number(row.revenue),
      cost: Number(row.cost),
    }));
  }
}

/**
 * The period's Vietnam days. A custom period needs both days, in order; days sent with a preset
 * period are refused rather than silently ignored.
 */
function resolveRange(query: ProfitReportQueryDto, now: Date): DateRange {
  const period = query.period ?? 'month';
  if (period !== 'custom') {
    if (query.from !== undefined || query.to !== undefined) {
      throw validationError(
        query.from !== undefined ? 'from' : 'to',
        DATES_ONLY_FOR_CUSTOM,
        DATES_ONLY_FOR_CUSTOM_MESSAGE,
      );
    }
    return profitPeriodRange(period, now);
  }
  const { from, to } = query;
  if (from === undefined || to === undefined) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      400,
      MISSING_DATE_MESSAGE,
      (['from', 'to'] as const)
        .filter((field) => query[field] === undefined)
        .map((field) => ({
          field,
          code: MISSING_DATE,
          message: MISSING_DATE_MESSAGE,
        })),
    );
  }
  if (from > to)
    throw validationError('to', INVALID_DATE_RANGE, INVALID_DATE_RANGE_MESSAGE);
  return { from, to };
}
