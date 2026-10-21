import { MOC_TU_DONG } from '../src/orders/domain/auto-transition-map';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_CHO_DUYET,
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_HOAN_THANH,
  TRANG_THAI_HUY,
} from '../src/orders/domain/order-status';
import {
  PAYMENT_ERROR,
  PAYMENT_STATUS,
  RECORDABLE_ORDER_STATUSES,
  installmentStatus,
  isSamePaymentRequest,
  milestonesReached,
  normalizeNote,
  orderPaymentStatus,
  paidPercent,
  todayInVietnam,
  validatePayment,
  type InstallmentPaidState,
} from '../src/payments/domain/payment';
import { resolveInstallments } from '../src/payments/domain/payment-schedule';

/**
 * Pure-domain tests for payment recording (FR-12). Schedules are built with the REAL
 * `resolveInstallments`, and payments are applied one after another through the real
 * `milestonesReached`, so no derived number is typed by hand.
 */

function scheduleOf(total: number, percents: number[]): InstallmentPaidState[] {
  const result = resolveInstallments(
    total,
    percents.map((percent) => ({ percent, conditionNote: 'n' })),
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.installments.map((i) => ({
    id: `i${i.seq}`,
    amount: i.amount,
    milestone: i.milestone,
    paid: 0,
  }));
}

/** Records `amount` on installment `id`, returns the milestones fired and the new state. */
function pay(
  state: InstallmentPaidState[],
  id: string,
  amount: number,
  orderTotal: number,
) {
  const fired = milestonesReached({
    installments: state,
    installmentId: id,
    amount,
    orderTotal,
  });
  const next = state.map((i) =>
    i.id === id ? { ...i, paid: i.paid + amount } : i,
  );
  return { fired, next };
}

const TOTAL = 83_010_960;

describe('milestonesReached', () => {
  it('deposit paid in full at once fires coc', () => {
    const s = scheduleOf(TOTAL, [20, 70, 10]);
    expect(pay(s, 'i1', s[0].amount, TOTAL).fired).toEqual([MOC_TU_DONG.coc]);
  });

  it('deposit paid in parts fires coc only on the payment that completes it, never again', () => {
    let s = scheduleOf(TOTAL, [20, 70, 10]);
    const first = 10_000_000;
    let r = pay(s, 'i1', first, TOTAL);
    expect(r.fired).toEqual([]);
    s = r.next;
    r = pay(s, 'i1', s[0].amount - first, TOTAL);
    expect(r.fired).toEqual([MOC_TU_DONG.coc]);
    s = r.next;
    // A further payment on an already-paid deposit is no rising edge.
    expect(pay(s, 'i1', 1, TOTAL).fired).toEqual([]);
  });

  it('a middle installment never fires anything', () => {
    const s = scheduleOf(TOTAL, [20, 70, 10]);
    expect(pay(s, 'i2', s[1].amount, TOTAL).fired).toEqual([]);
  });

  it('last installment fires tat_toan once every installment is paid and the total is covered', () => {
    let s = scheduleOf(TOTAL, [20, 70, 10]);
    s = pay(s, 'i1', s[0].amount, TOTAL).next;
    s = pay(s, 'i2', s[1].amount, TOTAL).next;
    expect(pay(s, 'i3', s[2].amount, TOTAL).fired).toEqual([
      MOC_TU_DONG.tatToan,
    ]);
  });

  it('last installment paid while a middle one is still open fires nothing', () => {
    let s = scheduleOf(TOTAL, [20, 70, 10]);
    s = pay(s, 'i1', s[0].amount, TOTAL).next;
    expect(pay(s, 'i3', s[2].amount, TOTAL).fired).toEqual([]);
  });

  it('paying the middle installment last fires tat_toan — whichever installment settles the order', () => {
    let s = scheduleOf(TOTAL, [20, 70, 10]);
    s = pay(s, 'i1', s[0].amount, TOTAL).next;
    s = pay(s, 'i3', s[2].amount, TOTAL).next;
    const part = 1_000_000;
    const r = pay(s, 'i2', part, TOTAL);
    expect(r.fired).toEqual([]);
    expect(pay(r.next, 'i2', s[1].amount - part, TOTAL).fired).toEqual([
      MOC_TU_DONG.tatToan,
    ]);
  });

  it('paying the deposit last fires coc then tat_toan, in that order', () => {
    let s = scheduleOf(TOTAL, [20, 70, 10]);
    s = pay(s, 'i3', s[2].amount, TOTAL).next;
    s = pay(s, 'i2', s[1].amount, TOTAL).next;
    expect(pay(s, 'i1', s[0].amount, TOTAL).fired).toEqual([
      MOC_TU_DONG.coc,
      MOC_TU_DONG.tatToan,
    ]);
  });

  it('a short schedule settled on a middle installment never fires tat_toan', () => {
    const short = resolveInstallments(TOTAL, [
      { percent: 20, conditionNote: 'n' },
      { percent: 70, conditionNote: 'n' },
      { amount: Math.floor(TOTAL / 10) - 1, conditionNote: 'n' },
    ]);
    if (!short.ok) throw new Error('fixture');
    let s: InstallmentPaidState[] = short.installments.map((i) => ({
      id: `i${i.seq}`,
      amount: i.amount,
      milestone: i.milestone,
      paid: 0,
    }));
    s = pay(s, 'i1', s[0].amount, TOTAL).next;
    s = pay(s, 'i3', s[2].amount, TOTAL).next;
    expect(pay(s, 'i2', s[1].amount, TOTAL).fired).toEqual([]);
  });

  it('a schedule short of the order total never fires tat_toan', () => {
    // 20/70 of the total, last = 10% of the total minus 1 dong (schedule saved short).
    const short = resolveInstallments(TOTAL, [
      { percent: 20, conditionNote: 'n' },
      { percent: 70, conditionNote: 'n' },
      { amount: Math.floor(TOTAL / 10) - 1, conditionNote: 'n' },
    ]);
    if (!short.ok) throw new Error('fixture');
    expect(short.scheduledTotal).toBeLessThan(TOTAL);
    let s: InstallmentPaidState[] = short.installments.map((i) => ({
      id: `i${i.seq}`,
      amount: i.amount,
      milestone: i.milestone,
      paid: 0,
    }));
    s = pay(s, 'i1', s[0].amount, TOTAL).next;
    s = pay(s, 'i2', s[1].amount, TOTAL).next;
    expect(pay(s, 'i3', s[2].amount, TOTAL).fired).toEqual([]);
  });

  it('a single 100% installment fires only coc, never tat_toan', () => {
    const s = scheduleOf(TOTAL, [100]);
    expect(s[0].milestone).toBe(MOC_TU_DONG.coc);
    expect(pay(s, 'i1', s[0].amount, TOTAL).fired).toEqual([MOC_TU_DONG.coc]);
  });

  it('unknown installment fires nothing', () => {
    const s = scheduleOf(TOTAL, [20, 80]);
    expect(pay(s, 'nope', 1, TOTAL).fired).toEqual([]);
  });
});

describe('validatePayment', () => {
  const today = '2026-10-21';

  it('accepts exactly the remaining amount and refuses one dong more', () => {
    expect(
      validatePayment({
        amount: 500,
        installmentRemaining: 500,
        paidOn: today,
        today,
      }),
    ).toEqual([]);
    expect(
      validatePayment({
        amount: 501,
        installmentRemaining: 500,
        paidOn: today,
        today,
      }),
    ).toEqual([{ field: 'amount', code: PAYMENT_ERROR.exceedsRemaining }]);
  });

  it('refuses a payment date after today and accepts today', () => {
    expect(
      validatePayment({
        amount: 1,
        installmentRemaining: 1,
        paidOn: '2026-10-22',
        today,
      }),
    ).toEqual([{ field: 'paidOn', code: PAYMENT_ERROR.futureDate }]);
  });
});

describe('todayInVietnam', () => {
  it('23:30 UTC on day D is already day D+1 in Vietnam', () => {
    expect(todayInVietnam(new Date('2026-10-21T23:30:00.000Z'))).toBe(
      '2026-10-22',
    );
  });

  it('16:59 UTC is still the same day in Vietnam, 17:00 UTC is the next', () => {
    expect(todayInVietnam(new Date('2026-10-21T16:59:59.999Z'))).toBe(
      '2026-10-21',
    );
    expect(todayInVietnam(new Date('2026-10-21T17:00:00.000Z'))).toBe(
      '2026-10-22',
    );
  });
});

describe('payment status figures', () => {
  it('installmentStatus: unpaid / partial / paid', () => {
    expect(installmentStatus(100, 0)).toBe(PAYMENT_STATUS.unpaid);
    expect(installmentStatus(100, 99)).toBe(PAYMENT_STATUS.partial);
    expect(installmentStatus(100, 100)).toBe(PAYMENT_STATUS.paid);
  });

  it('orderPaymentStatus: paid only when the total is covered', () => {
    expect(orderPaymentStatus(TOTAL, 0)).toBe(PAYMENT_STATUS.unpaid);
    expect(orderPaymentStatus(TOTAL, TOTAL - 1)).toBe(PAYMENT_STATUS.partial);
    expect(orderPaymentStatus(TOTAL, TOTAL)).toBe(PAYMENT_STATUS.paid);
    expect(orderPaymentStatus(0, 0)).toBe(PAYMENT_STATUS.unpaid);
  });

  it('paidPercent floors, stays an integer and never divides by zero', () => {
    const s = scheduleOf(TOTAL, [20, 70, 10]);
    expect(paidPercent(TOTAL, s[0].amount)).toBe(20);
    expect(paidPercent(3, 1)).toBe(33);
    expect(paidPercent(3, 2)).toBe(66);
    expect(paidPercent(0, 0)).toBe(0);
    expect(paidPercent(0, 5)).toBe(0);
    expect(Number.isInteger(paidPercent(TOTAL, 12_345_678))).toBe(true);
  });
});

describe('RECORDABLE_ORDER_STATUSES', () => {
  it('accepts confirmed and closed-by-hand orders, refuses quote/approval/cancelled', () => {
    expect(RECORDABLE_ORDER_STATUSES.has(TRANG_THAI_DA_CHOT)).toBe(true);
    expect(RECORDABLE_ORDER_STATUSES.has(TRANG_THAI_HOAN_THANH)).toBe(true);
    expect(RECORDABLE_ORDER_STATUSES.has(TRANG_THAI_BAO_GIA)).toBe(false);
    expect(RECORDABLE_ORDER_STATUSES.has(TRANG_THAI_CHO_DUYET)).toBe(false);
    expect(RECORDABLE_ORDER_STATUSES.has(TRANG_THAI_HUY)).toBe(false);
  });
});

describe('isSamePaymentRequest / normalizeNote', () => {
  const base = {
    orderId: 'o',
    installmentId: 'i',
    amount: 1,
    paidOn: '2026-10-21',
    method: 'cash',
    note: null,
  };

  it('identical payload is a replay, any differing field is not', () => {
    expect(isSamePaymentRequest(base, { ...base })).toBe(true);
    for (const diff of [
      { orderId: 'o2' },
      { installmentId: 'i2' },
      { amount: 2 },
      { paidOn: '2026-10-20' },
      { method: 'bank_transfer' },
      { note: 'x' },
    ]) {
      expect(isSamePaymentRequest(base, { ...base, ...diff })).toBe(false);
    }
  });

  it('note is trimmed and empty becomes null', () => {
    expect(normalizeNote('  a  ')).toBe('a');
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
  });
});
