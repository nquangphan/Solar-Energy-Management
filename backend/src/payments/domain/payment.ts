import {
  MOC_TU_DONG,
  type MocTuDong,
} from '../../orders/domain/auto-transition-map';
import { TRANG_THAI_HOAN_THANH } from '../../orders/domain/order-status';
import { EDITABLE_ORDER_STATUSES } from './payment-schedule';

/**
 * Payment recording rules (FR-12) — PURE DOMAIN: no Nest, no Prisma, no async.
 *
 * Money is integer dong (AD-10). Every "paid / remaining / status" figure a client shows is
 * derived here from the stored payments on read — there is no stored payment-status column to
 * drift from the ledger.
 */

/** Known payment methods. Display labels ("Chuyển khoản" / "Tiền mặt") belong to clients. */
export const PAYMENT_METHODS = ['bank_transfer', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Max length of a payment note. */
export const PAYMENT_NOTE_MAX_LENGTH = 200;

/**
 * Order statuses that accept a payment: every status whose schedule is editable, plus
 * `hoanthanh` — an order closed by hand (acceptance / delivered) before the customer paid the
 * last installment still has to record that money. Not `baogia`/`choduyet` (a reopened order
 * has a live total) and not `huy` (refunds are out of scope).
 */
export const RECORDABLE_ORDER_STATUSES: ReadonlySet<string> = new Set([
  ...EDITABLE_ORDER_STATUSES,
  TRANG_THAI_HOAN_THANH,
]);

/** Paid state of one installment, or of the whole order. */
export const PAYMENT_STATUS = {
  unpaid: 'unpaid',
  partial: 'partial',
  paid: 'paid',
} as const;
export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Field-error codes produced here (the DTO layer covers types, ranges and lengths). */
export const PAYMENT_ERROR = {
  exceedsRemaining: 'exceedsRemaining',
  futureDate: 'futureDate',
} as const;
export type PaymentErrorCode =
  (typeof PAYMENT_ERROR)[keyof typeof PAYMENT_ERROR];

export interface PaymentFieldError {
  readonly field: 'amount' | 'paidOn';
  readonly code: PaymentErrorCode;
}

export function installmentStatus(amount: number, paid: number): PaymentStatus {
  if (paid <= 0) return PAYMENT_STATUS.unpaid;
  return paid >= amount ? PAYMENT_STATUS.paid : PAYMENT_STATUS.partial;
}

export function orderPaymentStatus(
  orderTotal: number,
  paidTotal: number,
): PaymentStatus {
  if (paidTotal <= 0) return PAYMENT_STATUS.unpaid;
  return orderTotal > 0 && paidTotal >= orderTotal
    ? PAYMENT_STATUS.paid
    : PAYMENT_STATUS.partial;
}

/** Whole percent paid, floored, integer arithmetic only; 0 when the total is 0 (no division). */
export function paidPercent(orderTotal: number, paidTotal: number): number {
  if (orderTotal <= 0) return 0;
  return Math.floor((paidTotal * 100) / orderTotal);
}

/**
 * Today's date in Vietnam (UTC+7, no DST) as `YYYY-MM-DD`. Customers and staff live in UTC+7
 * while the server may run in UTC, so "a future payment date" is judged against this day.
 */
export function todayInVietnam(now: Date): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** `paidOn` and `today` are both `YYYY-MM-DD`, so string order is date order. */
export function isFutureDate(paidOn: string, today: string): boolean {
  return paidOn > today;
}

/**
 * Rules a payment must pass against its installment. Paying LESS than what is left is fine (an
 * installment may be paid in several parts); paying MORE is refused — an extra zero is the most
 * common typo with money, and overpaying one installment would silently shift the schedule.
 */
export function validatePayment(input: {
  readonly amount: number;
  readonly installmentRemaining: number;
  readonly paidOn: string;
  readonly today: string;
}): PaymentFieldError[] {
  const errors: PaymentFieldError[] = [];
  if (input.amount > input.installmentRemaining) {
    errors.push({ field: 'amount', code: PAYMENT_ERROR.exceedsRemaining });
  }
  if (isFutureDate(input.paidOn, input.today)) {
    errors.push({ field: 'paidOn', code: PAYMENT_ERROR.futureDate });
  }
  return errors;
}

/** One installment with what has been paid on it BEFORE the payment being recorded. */
export interface InstallmentPaidState {
  readonly id: string;
  readonly amount: number;
  readonly milestone: MocTuDong | null;
  readonly paid: number;
}

/**
 * Milestones THIS payment just completed — a rising edge, not a state: a milestone fires only on
 * the payment that takes it from "not reached" to "reached", so a later payment never fires it a
 * second time. Returned in schedule order (`coc` before `tat_toan`).
 *
 *  - `coc`: the paid installment carries `coc` and just became fully paid.
 *  - `tat_toan`: after this payment every installment is paid AND the order total is covered —
 *    WHICHEVER installment this payment was for (a customer who pays the last installment first
 *    and the middle one afterwards still settles the order on that middle payment). A payment is
 *    only accepted on an installment that still has something left, so "everything paid" was
 *    false before it: the condition holding afterwards IS the rising edge. A schedule may be
 *    saved short of the total (warning only), and paying off a short schedule is not "the whole
 *    order value collected" — the definition of `MOC_TU_DONG.tatToan`.
 *
 * `tat_toan` needs a schedule that has a settlement installment (two or more installments). A
 * single-installment schedule carries only `coc`, so it fires only `du_coc`: closing straight
 * from a deposit would skip every installation/delivery step.
 *
 * Both fire on one payment only when the deposit is the last thing paid; the caller attempts
 * them in the returned order.
 */
export function milestonesReached(input: {
  readonly installments: readonly InstallmentPaidState[];
  readonly installmentId: string;
  readonly amount: number;
  readonly orderTotal: number;
}): MocTuDong[] {
  const target = input.installments.find((i) => i.id === input.installmentId);
  if (target === undefined) return [];
  const paidAfter = target.paid + input.amount;
  if (target.paid >= target.amount || paidAfter < target.amount) {
    // The paid installment did not just become fully paid ⇒ nothing became reached.
    return [];
  }
  const reached: MocTuDong[] = [];
  if (target.milestone === MOC_TU_DONG.coc) reached.push(MOC_TU_DONG.coc);

  const hasSettlement = input.installments.some(
    (i) => i.milestone === MOC_TU_DONG.tatToan,
  );
  const allPaid = input.installments.every(
    (i) => (i.id === target.id ? paidAfter : i.paid) >= i.amount,
  );
  const paidTotalAfter =
    input.installments.reduce((sum, i) => sum + i.paid, 0) + input.amount;
  if (hasSettlement && allPaid && paidTotalAfter >= input.orderTotal) {
    reached.push(MOC_TU_DONG.tatToan);
  }
  return reached;
}

/** The fields a retry must repeat exactly to be treated as the same payment. */
export interface PaymentRequestFields {
  readonly orderId: string;
  readonly installmentId: string;
  readonly amount: number;
  readonly paidOn: string;
  readonly method: string;
  readonly note: string | null;
}

/** Same idempotency key AND same payload ⇒ replay; same key with any other payload ⇒ conflict. */
export function isSamePaymentRequest(
  a: PaymentRequestFields,
  b: PaymentRequestFields,
): boolean {
  return (
    a.orderId === b.orderId &&
    a.installmentId === b.installmentId &&
    a.amount === b.amount &&
    a.paidOn === b.paidOn &&
    a.method === b.method &&
    a.note === b.note
  );
}

/** Trimmed note; empty after trim ⇒ null, so a replay compares normalised values. */
export function normalizeNote(note: string | null | undefined): string | null {
  const trimmed = (note ?? '').trim();
  return trimmed === '' ? null : trimmed;
}
