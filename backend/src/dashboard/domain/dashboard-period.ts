import { todayInVietnam } from '../../payments/domain/payment';

/** Periods the dashboard can summarise; each one ends today (Vietnam time). */
export const DASHBOARD_PERIODS = ['day', 'week', 'month'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** Vietnam calendar days `YYYY-MM-DD`, both ends inclusive. */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * The period that ends today in Vietnam (UTC+7): day = today; week = Monday → today;
 * month = the 1st → today. Business decision G-6 (2026-10-22).
 */
export function periodRange(period: DashboardPeriod, now: Date): DateRange {
  const to = todayInVietnam(now);
  if (period === 'day') return { from: to, to };
  if (period === 'month') return { from: `${to.slice(0, 8)}01`, to };
  // getUTCDay on a UTC-midnight date is the weekday of that calendar day: 0 = Sunday.
  const daysSinceMonday = (new Date(`${to}T00:00:00Z`).getUTCDay() + 6) % 7;
  return { from: addDays(to, -daysSinceMonday), to };
}

/**
 * Preset period of the profit report (FR-37), ending today in Vietnam (UTC+7): month = the 1st →
 * today; year = 1 January → today. The custom period carries its own days.
 */
export function profitPeriodRange(
  period: 'month' | 'year',
  now: Date,
): DateRange {
  const to = todayInVietnam(now);
  if (period === 'year') return { from: `${to.slice(0, 4)}-01-01`, to };
  return { from: `${to.slice(0, 8)}01`, to };
}

/**
 * Vietnam days → half-open instant range `[fromInstant, toExclusive)` for instant columns such as
 * `orders.created_at` (`TIMESTAMP(3)` holding UTC, filled by Prisma). DATE columns (`payments.paid_on`) already hold Vietnam days and
 * are filtered on the strings directly — shifting them again would move them by a day.
 */
export function vietnamRangeToInstants(range: DateRange): {
  fromInstant: Date;
  toExclusive: Date;
} {
  return {
    fromInstant: new Date(`${range.from}T00:00:00+07:00`),
    toExclusive: new Date(`${addDays(range.to, 1)}T00:00:00+07:00`),
  };
}
