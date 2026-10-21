// hand-authored — TEST/DEMO-ONLY fake port (Story 7.1, mirror Flutter
// mobile/lib/design_system/session/fake_payments_port.dart).
//
// NOT a real backend and it owns NO copy of the schedule rules: it computes no
// amount, no total and no difference. Every number below is typed as the backend
// returns it (the mockup order DH-2048, total 83.010.960 đ). `replaceSchedule`
// records what was sent and answers with a canned reply.

import type {
  PaymentSchedule,
  PaymentsPort,
  PaymentsPortError,
  ReplacePaymentScheduleInput,
} from './payments-port';

const INSTALLMENTS_20_70_10: PaymentSchedule['installments'] = [
  { seq: 1, percent: 20, amount: 16_602_192, conditionNote: 'Cọc khi ký hợp đồng', milestone: 'coc' },
  { seq: 2, percent: 70, amount: 58_107_672, conditionNote: 'Khi thi công', milestone: null },
  {
    seq: 3,
    percent: 10,
    amount: 8_301_096,
    conditionNote: 'Khi nghiệm thu, bàn giao',
    milestone: 'tat_toan',
  },
];

/** The mockup schedule: 20/70/10 on 83.010.960 đ, totals match. */
export const DEMO_PAYMENT_SCHEDULE: PaymentSchedule = {
  orderId: 'DH-2048',
  configured: true,
  editable: true,
  orderTotal: 83_010_960,
  scheduledTotal: 83_010_960,
  difference: 0,
  totalMatches: true,
  installments: INSTALLMENTS_20_70_10,
  updatedAt: '2026-10-21T03:00:00.000Z',
};

/** Confirmed order with no schedule yet. */
export const DEMO_PAYMENT_SCHEDULE_EMPTY: PaymentSchedule = {
  orderId: 'DH-2048',
  configured: false,
  editable: true,
  orderTotal: 83_010_960,
  scheduledTotal: 0,
  difference: 83_010_960,
  totalMatches: false,
  installments: [],
  updatedAt: null,
};

/** 20/70 only — the schedule falls short of the order total by 8.301.096 đ. */
export const DEMO_PAYMENT_SCHEDULE_MISMATCH: PaymentSchedule = {
  ...DEMO_PAYMENT_SCHEDULE,
  scheduledTotal: 74_709_864,
  difference: 8_301_096,
  totalMatches: false,
  installments: INSTALLMENTS_20_70_10.slice(0, 2),
};

export class FakePaymentsPort implements PaymentsPort {
  /** Every input `replaceSchedule` received, in order. */
  readonly replaceCalls: ReplacePaymentScheduleInput[] = [];

  /**
   * @param schedule what `getSchedule` answers (until a successful replace).
   * @param reply what `replaceSchedule` answers: a schedule, a rejection, or a
   *   promise the test controls (to hold a save in flight).
   */
  constructor(
    private schedule: PaymentSchedule = DEMO_PAYMENT_SCHEDULE_EMPTY,
    private readonly reply:
      | PaymentSchedule
      | { error: PaymentsPortError }
      | (() => Promise<PaymentSchedule>) = DEMO_PAYMENT_SCHEDULE,
  ) {}

  async getSchedule(orderId: string): Promise<PaymentSchedule> {
    return { ...this.schedule, orderId };
  }

  async replaceSchedule(
    orderId: string,
    input: ReplacePaymentScheduleInput,
  ): Promise<PaymentSchedule> {
    this.replaceCalls.push(input);
    const reply = this.reply;
    if (typeof reply === 'function') {
      this.schedule = await reply();
    } else if ('error' in reply) {
      throw reply.error;
    } else {
      this.schedule = reply;
    }
    return { ...this.schedule, orderId };
  }
}
