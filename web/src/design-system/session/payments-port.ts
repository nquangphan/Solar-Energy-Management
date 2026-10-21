// hand-authored — web payments port (Stories 7.1–7.2, mirror Flutter
// mobile/lib/design_system/session/payments_port.dart). The seam between the
// Lịch thanh toán screen and `/orders/{id}/payment-schedule` + `/orders/{id}/payments`.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Each installment's amount, the
// schedule total, the order total after VAT, the difference and whether they
// match are the backend's — the screen only renders them. Milestones are assigned
// by the server by position; the client never sends one. What has been paid, what
// is left and every paid/unpaid status are the backend's too.

export type PaymentMethod = 'bank_transfer' | 'cash';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

/** Mirrors `PaymentResponseDto` field for field. */
export interface Payment {
  id: string;
  installmentId: string;
  /** Integer đồng. */
  amount: number;
  /** `YYYY-MM-DD`. */
  paidOn: string;
  method: PaymentMethod;
  note: string | null;
  /** ISO-8601 UTC. */
  recordedAt: string;
}

/** Mirrors `InstallmentResponseDto` field for field. */
export interface Installment {
  /** Sent back when recording a payment against this installment. */
  id: string;
  seq: number;
  /** What the user typed; null when the installment was typed as an amount. */
  percent: number | null;
  /** Integer đồng, resolved by the backend. */
  amount: number;
  conditionNote: string;
  /** `coc` on the first installment, `tat_toan` on the last (≥ 2), else null. */
  milestone: 'coc' | 'tat_toan' | null;
  /** Integer đồng collected on this installment, computed by the backend. */
  paidAmount: number;
  /** Integer đồng still owed on this installment, computed by the backend. */
  remainingAmount: number;
  status: PaymentStatus;
  /** Ordered by payment date, then recording time. */
  payments: Payment[];
}

/** Mirrors `PaymentScheduleResponseDto` field for field. */
export interface PaymentSchedule {
  orderId: string;
  /** false ⇒ the order has no schedule yet (`installments` is empty). */
  configured: boolean;
  /** Decided by the backend (confirmed, not closed, nothing paid yet). The edit button also needs `payments.record`. */
  editable: boolean;
  orderTotal: number;
  scheduledTotal: number;
  /** orderTotal − scheduledTotal, computed by the backend; may be negative. */
  difference: number;
  totalMatches: boolean;
  /** Integer đồng collected on the order, computed by the backend. */
  paidTotal: number;
  /** orderTotal − paidTotal, computed by the backend; may be negative. */
  remainingTotal: number;
  /** Whole percent paid, floored by the backend. */
  paidPercent: number;
  paymentStatus: PaymentStatus;
  /** Decided by the backend: the order accepts payments. The button also needs `payments.record`. */
  recordable: boolean;
  installments: Installment[];
  /** ISO-8601 UTC; null when not configured. */
  updatedAt: string | null;
}

/**
 * One installment of `ReplacePaymentScheduleRequestDto`: EXACTLY one of
 * `percent` / `amount`. A blank input is OMITTED, never sent as 0.
 */
export interface InstallmentInput {
  percent?: number;
  amount?: number;
  conditionNote: string;
}

/** Mirrors `ReplacePaymentScheduleRequestDto`. */
export interface ReplacePaymentScheduleInput {
  installments: InstallmentInput[];
}

/**
 * Mirrors `RecordPaymentRequestDto`. `idempotencyKey` is generated ONCE per opened
 * form and re-sent on every retry. A blank amount is OMITTED, never sent as 0.
 */
export interface RecordPaymentInput {
  idempotencyKey: string;
  installmentId: string;
  amount?: number;
  paidOn: string;
  method: PaymentMethod;
  note?: string;
}

/** Mirrors `AutoTransitionResultDto`. */
export interface AutoTransitionResult {
  event: 'du_coc' | 'hoan_thanh';
  /** applied = the order moved; already = it was there; skipped = refused (money still recorded). */
  outcome: 'applied' | 'already' | 'skipped';
  message: string | null;
}

/** Mirrors `RecordPaymentResponseDto`. */
export interface RecordPaymentResult {
  payment: Payment;
  /** The schedule as it is after this payment. */
  schedule: PaymentSchedule;
  orderStatus: string;
  /** null when no milestone was reached, and always null on a retry of the same key. */
  autoTransition: AutoTransitionResult | null;
}

/**
 * The AD-5 error envelope this port rejects with. `code` is the envelope code
 * (`VALIDATION_ERROR` 400, `NOT_FOUND` 404, `CONFLICT` 409). `field` is the
 * backend path, e.g. `installments.0.amount` or `amount`. The screen renders `message` verbatim.
 */
export interface PaymentsPortError {
  code: string;
  message: string;
  fieldErrors?: { field: string; code: string; message: string }[];
}

/**
 * Injectable transport for the Lịch thanh toán screen. A PORT, NOT an HTTP client.
 *
 * TODO(app-runtime/login-network): the real implementation attaches the bearer
 * token and parses the AD-5 envelope into `PaymentsPortError`.
 */
export interface PaymentsPort {
  getSchedule(orderId: string): Promise<PaymentSchedule>;
  /** Replaces every installment. Rejects with `PaymentsPortError` on 400 / 404 / 409. */
  replaceSchedule(orderId: string, input: ReplacePaymentScheduleInput): Promise<PaymentSchedule>;
  /**
   * Records one payment. The same key + payload answers the same payment (retry-safe).
   * Rejects with `PaymentsPortError` on 400 / 404 / 409.
   */
  recordPayment(orderId: string, input: RecordPaymentInput): Promise<RecordPaymentResult>;
}
