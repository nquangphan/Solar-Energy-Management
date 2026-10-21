// hand-authored — TEST/DEMO-ONLY fake port (Stories 7.1–7.2, mirror Flutter
// mobile/lib/design_system/session/fake_payments_port.dart).
//
// NOT a real backend and it owns NO copy of the schedule or payment rules: it
// computes no amount, no total, no difference and nothing paid. Every number below
// is typed as the backend returns it (the mockup order DH-2048, total 83.010.960 đ).
// `replaceSchedule` / `recordPayment` record what was sent and answer with a canned
// reply; `recordPayment` replays the stored answer for a key it has already seen (same
// payload), and refuses the key with 409 for any other payload, as the backend does.

import type {
  Installment,
  PaymentSchedule,
  PaymentsPort,
  PaymentsPortError,
  RecordPaymentInput,
  RecordPaymentResult,
  ReplacePaymentScheduleInput,
} from './payments-port';

const INSTALLMENTS_20_70_10: Installment[] = [
  {
    id: 'inst-1',
    seq: 1,
    percent: 20,
    amount: 16_602_192,
    conditionNote: 'Cọc khi ký hợp đồng',
    milestone: 'coc',
    paidAmount: 0,
    status: 'unpaid',
    remainingAmount: 16_602_192,
    payments: [],
  },
  {
    id: 'inst-2',
    seq: 2,
    percent: 70,
    amount: 58_107_672,
    conditionNote: 'Khi thi công',
    milestone: null,
    paidAmount: 0,
    status: 'unpaid',
    remainingAmount: 58_107_672,
    payments: [],
  },
  {
    id: 'inst-3',
    seq: 3,
    percent: 10,
    amount: 8_301_096,
    conditionNote: 'Khi nghiệm thu, bàn giao',
    milestone: 'tat_toan',
    paidAmount: 0,
    status: 'unpaid',
    remainingAmount: 8_301_096,
    payments: [],
  },
];

/** The mockup schedule: 20/70/10 on 83.010.960 đ, totals match, nothing paid. */
export const DEMO_PAYMENT_SCHEDULE: PaymentSchedule = {
  orderId: 'DH-2048',
  configured: true,
  editable: true,
  orderTotal: 83_010_960,
  scheduledTotal: 83_010_960,
  difference: 0,
  totalMatches: true,
  paidTotal: 0,
  remainingTotal: 83_010_960,
  paidPercent: 0,
  paymentStatus: 'unpaid',
  recordable: true,
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
  paidTotal: 0,
  remainingTotal: 83_010_960,
  paidPercent: 0,
  paymentStatus: 'unpaid',
  recordable: true,
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

/** The mockup after the deposit was recorded (Thu 02/07 · Chuyển khoản). */
export const DEMO_PAYMENT_SCHEDULE_DEPOSIT_PAID: PaymentSchedule = {
  ...DEMO_PAYMENT_SCHEDULE,
  editable: false,
  paidTotal: 16_602_192,
  remainingTotal: 66_408_768,
  paidPercent: 20,
  paymentStatus: 'partial',
  installments: [
    {
      ...INSTALLMENTS_20_70_10[0],
      paidAmount: 16_602_192,
      remainingAmount: 0,
      status: 'paid',
      payments: [
        {
          id: 'pay-1',
          installmentId: 'inst-1',
          amount: 16_602_192,
          paidOn: '2026-07-02',
          method: 'bank_transfer',
          note: null,
          recordedAt: '2026-07-02T03:00:00.000Z',
        },
      ],
    },
    INSTALLMENTS_20_70_10[1],
    INSTALLMENTS_20_70_10[2],
  ],
};

/** Answer to recording the full deposit: the order moved to Đã cọc. */
export const DEMO_RECORD_DEPOSIT_RESULT: RecordPaymentResult = {
  payment: DEMO_PAYMENT_SCHEDULE_DEPOSIT_PAID.installments[0].payments[0],
  schedule: DEMO_PAYMENT_SCHEDULE_DEPOSIT_PAID,
  orderStatus: 'dacoc',
  autoTransition: { event: 'du_coc', outcome: 'applied', message: null },
};

type Reply<T> = T | { error: PaymentsPortError } | (() => Promise<T>);

export class FakePaymentsPort implements PaymentsPort {
  /** Every input `replaceSchedule` received, in order. */
  readonly replaceCalls: ReplacePaymentScheduleInput[] = [];
  /** Every input `recordPayment` received, in order (retries included). */
  readonly recordCalls: RecordPaymentInput[] = [];
  /** Answers already given, by idempotency key — a retry with the same payload replays them. */
  private readonly recorded = new Map<
    string,
    { input: RecordPaymentInput; result: RecordPaymentResult }
  >();

  /**
   * @param schedule what `getSchedule` answers (until a successful write).
   * @param reply what `replaceSchedule` answers: a schedule, a rejection, or a
   *   promise the test controls (to hold a save in flight).
   * @param recordReply what `recordPayment` answers for a NEW key, same shapes.
   */
  constructor(
    private schedule: PaymentSchedule = DEMO_PAYMENT_SCHEDULE_EMPTY,
    private readonly reply: Reply<PaymentSchedule> = DEMO_PAYMENT_SCHEDULE,
    private readonly recordReply: Reply<RecordPaymentResult> = DEMO_RECORD_DEPOSIT_RESULT,
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

  async recordPayment(orderId: string, input: RecordPaymentInput): Promise<RecordPaymentResult> {
    this.recordCalls.push(input);
    const seen = this.recorded.get(input.idempotencyKey);
    if (seen !== undefined) {
      // Same contract as the backend: same key + same payload ⇒ replay; other payload ⇒ 409.
      if (JSON.stringify(seen.input) !== JSON.stringify(input)) {
        throw {
          code: 'CONFLICT',
          message: 'Khoá ghi nhận đã được dùng cho một khoản khác.',
        } satisfies PaymentsPortError;
      }
      return { ...seen.result, autoTransition: null };
    }
    const reply = this.recordReply;
    let result: RecordPaymentResult;
    if (typeof reply === 'function') {
      result = await reply();
    } else if ('error' in reply) {
      throw reply.error;
    } else {
      result = reply;
    }
    this.recorded.set(input.idempotencyKey, { input, result });
    this.schedule = result.schedule;
    return { ...result, schedule: { ...result.schedule, orderId } };
  }
}
