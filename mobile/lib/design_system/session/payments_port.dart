// hand-authored — mobile payment-schedule port (Story 7.1, mirror web
// web/src/design-system/session/payments-port.ts). The seam between the
// "Lịch thanh toán" screen and `/orders/:id/payment-schedule`.
//
// THE CLIENT COMPUTES NO MONEY. Every amount, both totals, the difference and
// the "totals match" verdict are the backend's. The input carries only what the
// user typed: a blank number is ABSENT from the payload — never coerced to 0.

/// Mirrors `InstallmentResponseDto`.
class Installment {
  const Installment({
    required this.seq,
    this.percent,
    required this.amount,
    required this.conditionNote,
    this.milestone,
  });

  /// 1-based position in the schedule.
  final int seq;

  /// Null when the installment was typed as an amount.
  final int? percent;

  /// Whole đồng, computed by the backend.
  final int amount;
  final String conditionNote;

  /// `coc` (first) | `tat_toan` (last) | null.
  final String? milestone;
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
}
