import { quoteNumberOf } from '../../orders/domain/quote-number';

/**
 * Gross profit on materials (FR-37, AD-20) — PURE DOMAIN. One report, four ways to group it.
 *
 * Every figure the clients show is computed here (AD-2): per-order revenue/cost come from the
 * read query, this file adds them up per group, derives the gross profit and the margin, and
 * builds the row labels so web and mobile print the same text.
 */

export const PROFIT_GROUP_BY = [
  'order',
  'month',
  'assignee',
  'source',
] as const;
export type ProfitGroupBy = (typeof PROFIT_GROUP_BY)[number];

export const PROFIT_PERIODS = ['month', 'year', 'custom'] as const;
export type ProfitPeriod = (typeof PROFIT_PERIODS)[number];

/** Row label of the orders that have no assignee, gathered into one `key: null` row. */
export const UNASSIGNED_LABEL = 'Chưa giao người phụ trách';

/** One issued order: revenue after the approved discount (before VAT) and frozen cost. */
export interface OrderProfitRow {
  readonly orderId: string;
  readonly issuedAt: Date;
  /** Vietnam month of the issue, `YYYY-MM`. */
  readonly issuedMonth: string;
  readonly customerName: string;
  readonly assigneeAccountId: string | null;
  readonly assigneeDisplayName: string | null;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly revenue: number;
  readonly cost: number;
}

export interface ProfitFigures {
  readonly revenue: number;
  readonly cost: number;
  readonly grossProfit: number;
  /** Whole percent, half-up; `null` when there is no positive revenue to divide by. */
  readonly marginPct: number | null;
}

export interface ProfitTotals extends ProfitFigures {
  readonly orderCount: number;
}

export interface ProfitGroupRow extends ProfitTotals {
  readonly key: string | null;
  readonly label: string;
  /** The four fields below are filled only when grouping by order. */
  readonly customerName: string | null;
  readonly assigneeDisplayName: string | null;
  readonly sourceName: string | null;
  readonly issuedAt: Date | null;
}

/**
 * Gross profit and margin of a revenue/cost pair. The margin is rounded half-up in pure integer
 * arithmetic (the `estimatedMarginPct` pattern), negative profits included.
 */
export function profitFigures(revenue: number, cost: number): ProfitFigures {
  const grossProfit = revenue - cost;
  const marginPct =
    revenue <= 0
      ? null
      : Math.floor((grossProfit * 100 + Math.floor(revenue / 2)) / revenue);
  return { revenue, cost, grossProfit, marginPct };
}

/** Sum of the given orders. */
export function profitTotals(rows: readonly OrderProfitRow[]): ProfitTotals {
  let revenue = 0;
  let cost = 0;
  for (const row of rows) {
    revenue += row.revenue;
    cost += row.cost;
  }
  return { ...profitFigures(revenue, cost), orderCount: rows.length };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `2026-10` ⇒ `10/2026`. */
function monthLabel(month: string): string {
  return `${month.slice(5, 7)}/${month.slice(0, 4)}`;
}

function groupKey(row: OrderProfitRow, groupBy: ProfitGroupBy): string | null {
  if (groupBy === 'order') return row.orderId;
  if (groupBy === 'month') return row.issuedMonth;
  if (groupBy === 'assignee') return row.assigneeAccountId;
  return row.sourceId;
}

function groupLabel(row: OrderProfitRow, groupBy: ProfitGroupBy): string {
  if (groupBy === 'order') return quoteNumberOf(row.orderId);
  if (groupBy === 'month') return monthLabel(row.issuedMonth);
  if (groupBy === 'assignee')
    return row.assigneeDisplayName ?? UNASSIGNED_LABEL;
  return row.sourceName;
}

/**
 * Rows of the report for one way of grouping. Order: by order ⇒ newest issue first; by month ⇒
 * newest month first; by assignee or source ⇒ highest gross profit first, then label.
 */
export function groupProfitRows(
  rows: readonly OrderProfitRow[],
  groupBy: ProfitGroupBy,
): ProfitGroupRow[] {
  if (groupBy === 'order') {
    return [...rows]
      .sort(
        (a, b) =>
          b.issuedAt.getTime() - a.issuedAt.getTime() ||
          compareText(b.orderId, a.orderId),
      )
      .map((row) => ({
        key: row.orderId,
        label: groupLabel(row, groupBy),
        ...profitTotals([row]),
        customerName: row.customerName,
        assigneeDisplayName: row.assigneeDisplayName,
        sourceName: row.sourceName,
        issuedAt: row.issuedAt,
      }));
  }

  const groups = new Map<string | null, OrderProfitRow[]>();
  for (const row of rows) {
    const key = groupKey(row, groupBy);
    const members = groups.get(key);
    if (members === undefined) groups.set(key, [row]);
    else members.push(row);
  }
  const grouped: ProfitGroupRow[] = [...groups].map(([key, members]) => ({
    key,
    label: groupLabel(members[0], groupBy),
    ...profitTotals(members),
    customerName: null,
    assigneeDisplayName: null,
    sourceName: null,
    issuedAt: null,
  }));
  if (groupBy === 'month')
    return grouped.sort((a, b) => compareText(b.key ?? '', a.key ?? ''));
  return grouped.sort(
    (a, b) =>
      b.grossProfit - a.grossProfit ||
      compareText(a.label, b.label) ||
      compareText(a.key ?? '', b.key ?? ''),
  );
}
