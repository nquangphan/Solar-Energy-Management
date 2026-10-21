// hand-authored — web payments port (Story 7.1, mirror Flutter
// mobile/lib/design_system/session/payments_port.dart). The seam between the
// Lịch thanh toán screen and `/orders/{id}/payment-schedule`.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Each installment's amount, the
// schedule total, the order total after VAT, the difference and whether they
// match are the backend's — the screen only renders them. Milestones are assigned
// by the server by position; the client never sends one.

/** Mirrors `InstallmentResponseDto` field for field. */
export interface Installment {
  seq: number;
  /** What the user typed; null when the installment was typed as an amount. */
  percent: number | null;
  /** Integer đồng, resolved by the backend. */
  amount: number;
  conditionNote: string;
  /** `coc` on the first installment, `tat_toan` on the last (≥ 2), else null. */
  milestone: 'coc' | 'tat_toan' | null;
}

/** Mirrors `PaymentScheduleResponseDto` field for field. */
export interface PaymentSchedule {
  orderId: string;
  /** false ⇒ the order has no schedule yet (`installments` is empty). */
  configured: boolean;
  /** Decided by the backend (confirmed and not closed). The edit button also needs `payments.record`. */
  editable: boolean;
  orderTotal: number;
  scheduledTotal: number;
  /** orderTotal − scheduledTotal, computed by the backend; may be negative. */
  difference: number;
  totalMatches: boolean;
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
 * The AD-5 error envelope this port rejects with. `code` is the envelope code
 * (`VALIDATION_ERROR` 400, `NOT_FOUND` 404, `CONFLICT` 409). `field` is the
 * backend path, e.g. `installments.0.amount`. The screen renders `message` verbatim.
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
}
