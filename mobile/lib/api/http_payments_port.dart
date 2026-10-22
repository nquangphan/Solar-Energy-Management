// hand-authored — the real PaymentsPort over the generated client (Story 10.8,
// mirror web/src/api/http-payments-port.ts).
//
// Recording a payment is idempotent on the server by the key the SCREEN generated
// once per opened form: it travels in the body exactly as given, and this
// adapter never makes one up — a fresh key on a retry would record the money
// twice (NFR-1).
//
// A blank amount is never turned into a number: the generated body requires
// `amount`, so a null one is refused here with the backend's own field error and
// nothing is sent (the screen already stops before this; this is the backstop).
import '../design_system/session/payments_port.dart';
import 'api_error.dart';
import 'generated/models/record_payment_request_dto.dart';
import 'generated/models/record_payment_request_dto_method.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

/// The backend's envelope for a request that fails validation, and its words for
/// an amount that is not a whole number (`record-payment-request.dto.ts`).
const String _kValidationMessage = 'Dữ liệu không hợp lệ';
const String _kAmountNotInteger = 'Số tiền thu phải là số nguyên đồng.';

class HttpPaymentsPort implements PaymentsPort {
  HttpPaymentsPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await _transport.call(request);
    } on ApiError catch (e) {
      throw PaymentsPortError(
        code: e.code ?? '',
        message: e.message,
        fieldErrors: e.fieldErrors == null
            ? null
            : [for (final f in e.fieldErrors!) FieldError(field: f.field, code: f.code, message: f.message)],
      );
    }
  }

  @override
  Future<PaymentSchedule> getSchedule(String orderId) =>
      _call(() => _client.payments.paymentSchedulesControllerGet(id: Uri.encodeComponent(orderId)));

  @override
  Future<PaymentSchedule> replaceSchedule(String orderId, ReplacePaymentScheduleInput input) =>
      _call(() => _client.payments.paymentSchedulesControllerReplace(id: Uri.encodeComponent(orderId), body: input));

  @override
  Future<RecordPaymentResult> recordPayment(String orderId, RecordPaymentInput input) async {
    final amount = input.amount;
    if (amount == null) {
      throw const PaymentsPortError(
        code: 'VALIDATION_ERROR',
        message: _kValidationMessage,
        fieldErrors: [FieldError(field: 'amount', code: 'isInt', message: _kAmountNotInteger)],
      );
    }
    return _call(
      () => _client.payments.paymentsControllerRecord(
        id: Uri.encodeComponent(orderId),
        body: RecordPaymentRequestDto(
          idempotencyKey: input.idempotencyKey,
          installmentId: input.installmentId,
          amount: amount,
          paidOn: input.paidOn,
          method: RecordPaymentRequestDtoMethod.fromJson(input.method),
          note: input.note,
        ),
      ),
    );
  }
}
