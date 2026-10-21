import {
  MOC_TU_DONG,
  type MocTuDong,
} from '../../orders/domain/auto-transition-map';
import {
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_THI_CONG,
} from '../../orders/domain/order-status';

/**
 * Payment schedule rules (FR-11) — PURE DOMAIN: no Nest, no Prisma, no async.
 *
 * Every installment is entered as EITHER a percent of the order total OR an integer amount, and
 * this module resolves both into integer dong (AD-10). Clients never add, subtract or split
 * money: `amount` and `scheduledTotal` come from here.
 */

/** Hard cap on installments per schedule. */
export const MAX_INSTALLMENTS = 12;
/**
 * Hard cap on one installment amount, typed or resolved from a percent: the column is INT4, so a
 * larger value would fail at the driver as a 500 instead of a field error.
 */
export const MAX_INSTALLMENT_AMOUNT = 2_000_000_000;
/** Max length of an installment condition note. */
export const CONDITION_NOTE_MAX_LENGTH = 200;

/**
 * Order statuses whose schedule may be (re)configured: the order is confirmed (prices are
 * snapshotted, so the total is stable) and not closed. `baogia`/`choduyet` still have a live
 * total; `hoanthanh`/`huy` are closed.
 */
export const EDITABLE_ORDER_STATUSES: ReadonlySet<string> = new Set([
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_THI_CONG,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_DA_GIAO,
]);

/** Field-error codes produced here (the DTO layer covers ranges and lengths). */
export const SCHEDULE_ERROR = {
  exactlyOneOf: 'exactlyOneOf',
  firstInstallmentZero: 'firstInstallmentZero',
  resolvedZero: 'resolvedZero',
  amountTooLarge: 'amountTooLarge',
} as const;
export type ScheduleErrorCode =
  (typeof SCHEDULE_ERROR)[keyof typeof SCHEDULE_ERROR];

export interface InstallmentInput {
  readonly percent?: number | null;
  readonly amount?: number | null;
  readonly conditionNote: string;
}

export interface ResolvedInstallment {
  readonly seq: number;
  readonly percent: number | null;
  readonly amount: number;
  readonly conditionNote: string;
  readonly milestone: MocTuDong | null;
}

export interface ScheduleFieldError {
  readonly field: string;
  readonly code: ScheduleErrorCode;
}

export type ResolveInstallmentsResult =
  | {
      readonly ok: true;
      readonly installments: readonly ResolvedInstallment[];
      readonly scheduledTotal: number;
    }
  | { readonly ok: false; readonly errors: readonly ScheduleFieldError[] };

const isSet = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

/**
 * Milestone by POSITION, never taken from the client: the first installment is always the
 * deposit (FR-8 "first deposit paid ⇒ Đã cọc" — which is also why it may not be 0); with two or
 * more installments the last one settles the order; middle ones carry no milestone.
 */
function milestoneAt(index: number, count: number): MocTuDong | null {
  if (index === 0) return MOC_TU_DONG.coc;
  if (index === count - 1) return MOC_TU_DONG.tatToan;
  return null;
}

/**
 * Resolve installment inputs against the order total (integer dong).
 *
 * `percent` ⇒ `floor(orderTotal * percent / 100)` — integer arithmetic only (the product of two
 * integers stays far below 2^53). Rounding remainder: ONLY when every installment is a percent
 * and the percents sum to exactly 100, the LAST installment takes `orderTotal − Σ(previous)` so
 * the schedule sums to the total to the dong. Mixed inputs or Σ% ≠ 100 get no top-up — the
 * mismatch surfaces as a warning instead.
 */
export function resolveInstallments(
  orderTotal: number,
  inputs: readonly InstallmentInput[],
): ResolveInstallmentsResult {
  const errors: ScheduleFieldError[] = [];
  inputs.forEach((input, i) => {
    if (isSet(input.percent) === isSet(input.amount)) {
      errors.push({
        field: `installments.${i}.percent`,
        code: SCHEDULE_ERROR.exactlyOneOf,
      });
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const amounts = inputs.map((input) =>
    isSet(input.percent)
      ? Math.floor((orderTotal * input.percent) / 100)
      : (input.amount as number),
  );
  const allPercent = inputs.every((input) => isSet(input.percent));
  const percentSum = inputs.reduce(
    (sum, input) => sum + (input.percent ?? 0),
    0,
  );
  if (allPercent && percentSum === 100 && amounts.length > 0) {
    const last = amounts.length - 1;
    const previous = amounts.slice(0, last).reduce((sum, a) => sum + a, 0);
    amounts[last] = orderTotal - previous;
  }

  amounts.forEach((amount, i) => {
    if (amount <= 0) {
      errors.push({
        field: `installments.${i}.amount`,
        code:
          i === 0
            ? SCHEDULE_ERROR.firstInstallmentZero
            : SCHEDULE_ERROR.resolvedZero,
      });
    } else if (amount > MAX_INSTALLMENT_AMOUNT) {
      errors.push({
        field: `installments.${i}.amount`,
        code: SCHEDULE_ERROR.amountTooLarge,
      });
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const installments = inputs.map((input, i) => ({
    seq: i + 1,
    percent: isSet(input.percent) ? input.percent : null,
    amount: amounts[i],
    conditionNote: input.conditionNote,
    milestone: milestoneAt(i, inputs.length),
  }));
  return {
    ok: true,
    installments,
    scheduledTotal: amounts.reduce((sum, a) => sum + a, 0),
  };
}

/** Same installments in the same order — a repeated save of this list writes nothing. */
export function isSameSchedule(
  a: readonly ResolvedInstallment[],
  b: readonly ResolvedInstallment[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (x, i) =>
        x.seq === b[i].seq &&
        x.percent === b[i].percent &&
        x.amount === b[i].amount &&
        x.conditionNote === b[i].conditionNote &&
        x.milestone === b[i].milestone,
    )
  );
}
