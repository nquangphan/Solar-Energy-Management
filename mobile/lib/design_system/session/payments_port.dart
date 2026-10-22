// hand-authored — mobile payments port (Stories 7.1–7.2, mirror web
// web/src/design-system/session/payments-port.ts). The seam between the
// "Lịch thanh toán" screen and `/orders/:id/payment-schedule` + `/orders/:id/payments`.
//
// THE CLIENT COMPUTES NO MONEY. Every amount, both totals, the difference, the
// "totals match" verdict, what is paid and every paid/unpaid status are the backend's. The input carries only what the
// user typed: a blank number is ABSENT from the payload — never coerced to 0.

import '../../api/generated/models/auto_transition_result_dto.dart';
import '../../api/generated/models/installment_input_dto.dart';
import '../../api/generated/models/installment_response_dto.dart';
import '../../api/generated/models/payment_response_dto.dart';
import '../../api/generated/models/payment_schedule_response_dto.dart';
import '../../api/generated/models/record_payment_response_dto.dart';
import '../../api/generated/models/replace_payment_schedule_request_dto.dart';

export '../../api/generated/models/auto_transition_result_dto_event.dart';
export '../../api/generated/models/auto_transition_result_dto_outcome.dart';
export '../../api/generated/models/installment_response_dto_milestone.dart';
export '../../api/generated/models/installment_response_dto_status.dart';
export '../../api/generated/models/payment_response_dto_method.dart';
export '../../api/generated/models/payment_schedule_response_dto_payment_status.dart';

/// `PaymentResponseDto` (generated, Story 10.8). `amount` is whole đồng;
/// `paidOn` is the `YYYY-MM-DD` string as the backend sent it (the derived spec
/// keeps calendar dates as strings — tool/generate_api.dart); `method` is
/// `bank_transfer` | `cash`.
typedef Payment = PaymentResponseDto;

/// `InstallmentResponseDto`. `percent` is null when the installment was typed
/// as an amount; `amount`/`paidAmount`/`remainingAmount` are whole đồng computed
/// by the backend; `milestone` is `coc` (first) | `tat_toan` (last) | null;
/// `status` is `unpaid` | `partial` | `paid`; `payments` are ordered by payment
/// date, then recording time.
typedef Installment = InstallmentResponseDto;

/// `PaymentScheduleResponseDto`. `editable` and `recordable` are decided by the
/// backend (the record button also needs `payments.record`); `difference` and
/// `remainingTotal` may be negative; `paidPercent` is floored by the backend;
/// `updatedAt` is null while unconfigured.
typedef PaymentSchedule = PaymentScheduleResponseDto;

/// One typed installment. A null `percent` / `amount` means blank (never 0);
/// the backend reads a null as absent and answers 400 `exactlyOneOf`.
typedef InstallmentInput = InstallmentInputDto;

/// Body of `PUT /orders/:id/payment-schedule`.
typedef ReplacePaymentScheduleInput = ReplacePaymentScheduleRequestDto;

/// Body of `POST /orders/:id/payments`. [idempotencyKey] is generated ONCE per
/// opened form and re-sent on every retry. A null [amount] is omitted (blank ≠ 0).
///
/// Hand-kept: the generated `RecordPaymentRequestDto` requires `amount`, and a
/// blank amount must never become a number the user did not type. The adapter
/// refuses a null [amount] with the backend's own field error, sending nothing.
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

/// `AutoTransitionResultDto`. `event` is `du_coc` | `hoan_thanh`; `outcome` is
/// `applied` | `already` | `skipped` (money still recorded).
typedef AutoTransitionResult = AutoTransitionResultDto;

/// `RecordPaymentResponseDto`. `schedule` is the schedule as it is after this
/// payment; `autoTransition` is null when no milestone was reached, and always
/// null on a retry of the same key.
typedef RecordPaymentResult = RecordPaymentResponseDto;

/// One `fieldErrors[]` entry. [field] is the backend path, e.g.
/// `installments.0.percent` or plain `installments`. Hand-kept: the payload of
/// [PaymentsPortError], not a response type.
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
