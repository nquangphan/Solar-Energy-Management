// hand-authored — mobile payments port (Stories 7.1–7.2, mirror web
// web/src/design-system/session/payments-port.ts). The seam between the
// "Lịch thanh toán" screen and `/orders/:id/payment-schedule` + `/orders/:id/payments`.
//
// THE CLIENT COMPUTES NO MONEY. Every amount, both totals, the difference, the
// "totals match" verdict, what is paid and every paid/unpaid status are the backend's. The input carries only what the
// user typed: a blank number is ABSENT from the payload — never coerced to 0.

/// Mirrors `PaymentResponseDto`.
class Payment {
  const Payment({
    required this.id,
    required this.installmentId,
    required this.amount,
    required this.paidOn,
    required this.method,
    this.note,
    required this.recordedAt,
  });

  final String id;
  final String installmentId;

  /// Whole đồng.
  final int amount;

  /// `YYYY-MM-DD`.
  final String paidOn;

  /// `bank_transfer` | `cash`.
  final String method;
  final String? note;

  /// ISO-8601 UTC.
  final String recordedAt;
}

/// Mirrors `InstallmentResponseDto`.
class Installment {
  const Installment({
    required this.id,
    required this.seq,
    this.percent,
    required this.amount,
    required this.conditionNote,
    this.milestone,
    required this.paidAmount,
    required this.remainingAmount,
    required this.status,
    required this.payments,
  });

  /// Sent back when recording a payment against this installment.
  final String id;

  /// 1-based position in the schedule.
  final int seq;

  /// Null when the installment was typed as an amount.
  final int? percent;

  /// Whole đồng, computed by the backend.
  final int amount;
  final String conditionNote;

  /// `coc` (first) | `tat_toan` (last) | null.
  final String? milestone;

  /// Whole đồng collected / still owed on this installment, computed by the backend.
  final int paidAmount;
  final int remainingAmount;

  /// `unpaid` | `partial` | `paid`.
  final String status;

  /// Ordered by payment date, then recording time.
  final List<Payment> payments;
}

/// Mirrors `PaymentScheduleResponseDto`.
class PaymentSchedule {
  const PaymentSchedule({
    required this.orderId,
    required this.configured,
    required this.editable,
    required this.orderTotal,
    required this.scheduledTotal,
    required this.difference,
    required this.totalMatches,
    required this.paidTotal,
    required this.remainingTotal,
    required this.paidPercent,
    required this.paymentStatus,
    required this.recordable,
    required this.installments,
    this.updatedAt,
  });

  final String orderId;
  final bool configured;

  /// Decided by the backend; the client never derives it from the order status.
  final bool editable;

  /// Order total after VAT, whole đồng.
  final int orderTotal;
  final int scheduledTotal;

  /// `orderTotal - scheduledTotal`; may be negative.
  final int difference;
  final bool totalMatches;

  /// Whole đồng collected on the order; `orderTotal - paidTotal` (may be negative).
  final int paidTotal;
  final int remainingTotal;

  /// Whole percent paid, floored by the backend.
  final int paidPercent;

  /// `unpaid` | `partial` | `paid`.
  final String paymentStatus;

  /// Decided by the backend: the order accepts payments. The button also needs
  /// `payments.record`.
  final bool recordable;
  final List<Installment> installments;

  /// ISO-8601 UTC; null while unconfigured.
  final String? updatedAt;
}

/// One typed installment. A null [percent] / [amount] is omitted from the wire
/// payload (blank ≠ 0); the backend answers 400 `exactlyOneOf`.
class InstallmentInput {
  const InstallmentInput(
      {this.percent, this.amount, required this.conditionNote});

  final int? percent;
  final int? amount;
  final String conditionNote;

  Map<String, Object> toJson() => <String, Object>{
        if (percent != null) 'percent': percent!,
        if (amount != null) 'amount': amount!,
        'conditionNote': conditionNote,
      };
}

/// Body of `PUT /orders/:id/payment-schedule`.
class ReplacePaymentScheduleInput {
  const ReplacePaymentScheduleInput({required this.installments});

  final List<InstallmentInput> installments;

  Map<String, Object> toJson() => <String, Object>{
        'installments': <Map<String, Object>>[
          for (final InstallmentInput i in installments) i.toJson(),
        ],
      };
}

/// Body of `POST /orders/:id/payments`. [idempotencyKey] is generated ONCE per
/// opened form and re-sent on every retry. A null [amount] is omitted (blank ≠ 0).
class RecordPaymentInput {
  const RecordPaymentInput({
    required this.idempotencyKey,
    required this.installmentId,
    this.amount,
    required this.paidOn,
    required this.method,
    this.note,
  });

  final String idempotencyKey;
  final String installmentId;
  final int? amount;
  final String paidOn;
  final String method;
  final String? note;

  Map<String, Object> toJson() => <String, Object>{
        'idempotencyKey': idempotencyKey,
        'installmentId': installmentId,
        if (amount != null) 'amount': amount!,
        'paidOn': paidOn,
        'method': method,
        if (note != null) 'note': note!,
      };
}

/// Mirrors `AutoTransitionResultDto`.
class AutoTransitionResult {
  const AutoTransitionResult({
    required this.event,
    required this.outcome,
    this.message,
  });

  /// `du_coc` | `hoan_thanh`.
  final String event;

  /// `applied` | `already` | `skipped` (money still recorded).
  final String outcome;
  final String? message;
}

/// Mirrors `RecordPaymentResponseDto`.
class RecordPaymentResult {
  const RecordPaymentResult({
    required this.payment,
    required this.schedule,
    required this.orderStatus,
    this.autoTransition,
  });

  final Payment payment;

  /// The schedule as it is after this payment.
  final PaymentSchedule schedule;
  final String orderStatus;

  /// Null when no milestone was reached, and always null on a retry of the same key.
  final AutoTransitionResult? autoTransition;
}

/// One `fieldErrors[]` entry. [field] is the backend path, e.g.
/// `installments.0.percent` or plain `installments`.
class FieldError {
  const FieldError({
    required this.field,
    required this.code,
    required this.message,
  });

  final String field;
  final String code;
  final String message;
}

/// The error envelope a [PaymentsPort] throws. [code] is the envelope code:
/// `VALIDATION_ERROR` (400, with [fieldErrors]) | `CONFLICT` (409) |
/// `NOT_FOUND` (404). The screen renders [message] verbatim.
class PaymentsPortError implements Exception {
  const PaymentsPortError({
    required this.code,
    required this.message,
    this.fieldErrors,
  });

  final String code;
  final String message;
  final List<FieldError>? fieldErrors;

  @override
  String toString() => 'PaymentsPortError($code): $message';
}

/// Injectable transport for the Lịch thanh toán screen. A PORT, NOT an HTTP client.
abstract class PaymentsPort {
  /// Unconfigured order ⇒ a `configured: false` schedule, never a 404.
  Future<PaymentSchedule> getSchedule(String orderId);

  /// Replaces the whole schedule. Throws [PaymentsPortError] on 400 / 404 / 409.
  Future<PaymentSchedule> replaceSchedule(
    String orderId,
    ReplacePaymentScheduleInput input,
  );

  /// Records one payment; the same key + payload answers the same payment.
  /// Throws [PaymentsPortError] on 400 / 404 / 409.
  Future<RecordPaymentResult> recordPayment(
    String orderId,
    RecordPaymentInput input,
  );
}
