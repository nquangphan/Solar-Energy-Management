// hand-authored — web payments port (Stories 7.1–7.2, mirror Flutter
// mobile/lib/design_system/session/payments_port.dart). The seam between the
// Lịch thanh toán screen and `/orders/{id}/payment-schedule` + `/orders/{id}/payments`.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Each installment's amount, the
// schedule total, the order total after VAT, the difference and whether they
// match are the backend's — the screen only renders them. Milestones are assigned
// by the server by position; the client never sends one. What has been paid, what
// is left and every paid/unpaid status are the backend's too.
//
// Every data type below is the GENERATED contract type (AD-12); only
// `RecordPaymentInput` loosens one field (a blank amount stays absent).

import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** `PaymentResponseDto` — `amount` integer đồng, `paidOn` `YYYY-MM-DD`, `recordedAt` ISO-8601 UTC. */
export type Payment = Schemas['PaymentResponseDto'];

export type PaymentMethod = Payment['method'];

/**
 * `InstallmentResponseDto`. `percent` is what the user typed (null when typed as
 * an amount); `amount`, `paidAmount`, `remainingAmount` are integer đồng resolved
 * by the backend. `milestone` is `coc` on the first installment, `tat_toan` on the
 * last (≥ 2), else null. `payments` are ordered by payment date, then recording time.
 */
export type Installment = Schemas['InstallmentResponseDto'];

export type PaymentStatus = Installment['status'];

/**
 * `PaymentScheduleResponseDto`. `configured: false` ⇒ no schedule yet
 * (`installments` empty). `editable`/`recordable` are decided by the backend (the
 * buttons also need `payments.record`). `difference` and `remainingTotal` may be
 * negative; `paidPercent` is floored by the backend.
 */
export type PaymentSchedule = Schemas['PaymentScheduleResponseDto'];

/**
 * One installment of `ReplacePaymentScheduleRequestDto`: EXACTLY one of
 * `percent` / `amount`. A blank input is OMITTED, never sent as 0.
 */
export type InstallmentInput = Schemas['InstallmentInputDto'];

/** `ReplacePaymentScheduleRequestDto`. */
export type ReplacePaymentScheduleInput = Schemas['ReplacePaymentScheduleRequestDto'];

/**
 * `RecordPaymentRequestDto`, with `amount` optional: a blank amount is the
 * server's to reject — 400 `fieldErrors.amount`, never a client 0. The
 * `idempotencyKey` is generated ONCE per opened form and re-sent on every retry.
 */
export type RecordPaymentInput = Omit<Schemas['RecordPaymentRequestDto'], 'amount'> & {
  amount?: number;
};

/** `AutoTransitionResultDto`: applied = the order moved; already = it was there; skipped = refused (money still recorded). */
export type AutoTransitionResult = Schemas['AutoTransitionResultDto'];

/**
 * `RecordPaymentResponseDto`. `schedule` is the schedule after this payment;
 * `autoTransition` is null when no milestone was reached, and always null on a
 * retry of the same key.
 */
export type RecordPaymentResult = Schemas['RecordPaymentResponseDto'];

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
 * The real implementation is `web/src/api/http-payments-port.ts` (the transport
 * attaches the Bearer token and parses the AD-5 envelope).
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
