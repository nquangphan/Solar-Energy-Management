// hand-authored — TEST/DEMO-ONLY fake port (Stories 7.1–7.2, mirror web
// web/src/design-system/session/fake-payments-port.ts).
//
// NOT a real backend and it computes NOTHING: every amount below is typed as the
// backend would return it, and `replaceSchedule` / `recordPayment` answer a canned
// reply regardless of what was submitted. They only record what they were sent;
// `recordPayment` replays the stored answer for a key it has already seen (same payload),
// and refuses the key with 409 for any other payload, as the backend does.

import 'payments_port.dart';

const Installment _inst1 = Installment(
  id: 'inst-1',
  seq: 1,
  percent: 20,
  amount: 16602192,
  conditionNote: 'Cọc khi ký hợp đồng',
  milestone: InstallmentResponseDtoMilestone.coc,
  paidAmount: 0,
  remainingAmount: 16602192,
  status: InstallmentResponseDtoStatus.unpaid,
  payments: <Payment>[],
);
const Installment _inst2 = Installment(
  id: 'inst-2',
  seq: 2,
  percent: 70,
  amount: 58107672,
  conditionNote: 'Khi thi công',
  milestone: null,
  paidAmount: 0,
  remainingAmount: 58107672,
  status: InstallmentResponseDtoStatus.unpaid,
  payments: <Payment>[],
);
const Installment _inst3 = Installment(
  id: 'inst-3',
  seq: 3,
  percent: 10,
  amount: 8301096,
  conditionNote: 'Khi nghiệm thu, bàn giao',
  milestone: InstallmentResponseDtoMilestone.tatToan,
  paidAmount: 0,
  remainingAmount: 8301096,
  status: InstallmentResponseDtoStatus.unpaid,
  payments: <Payment>[],
);

final PaymentSchedule demoPaymentScheduleConfigured = PaymentSchedule(
  orderId: 'DH-2048',
  configured: true,
  editable: true,
  orderTotal: 83010960,
  scheduledTotal: 83010960,
  difference: 0,
  totalMatches: true,
  paidTotal: 0,
  remainingTotal: 83010960,
  paidPercent: 0,
  paymentStatus: PaymentScheduleResponseDtoPaymentStatus.unpaid,
  recordable: true,
  installments: <Installment>[_inst1, _inst2, _inst3],
  updatedAt: DateTime.utc(2026, 10, 21, 3, 15),
);

const PaymentSchedule demoPaymentScheduleEmpty = PaymentSchedule(
  orderId: 'DH-2048',
  configured: false,
  editable: true,
  orderTotal: 83010960,
  scheduledTotal: 0,
  difference: 83010960,
  totalMatches: false,
  paidTotal: 0,
  remainingTotal: 83010960,
  paidPercent: 0,
  paymentStatus: PaymentScheduleResponseDtoPaymentStatus.unpaid,
  recordable: true,
  installments: <Installment>[],
  updatedAt: null,
);

/// Installments 1 and 2 only: the sum is short of the order total.
final PaymentSchedule demoPaymentScheduleMismatch = PaymentSchedule(
  orderId: 'DH-2048',
  configured: true,
  editable: true,
  orderTotal: 83010960,
  scheduledTotal: 74709864,
  difference: 8301096,
  totalMatches: false,
  paidTotal: 0,
  remainingTotal: 83010960,
  paidPercent: 0,
  paymentStatus: PaymentScheduleResponseDtoPaymentStatus.unpaid,
  recordable: true,
  installments: <Installment>[_inst1, _inst2],
  updatedAt: DateTime.utc(2026, 10, 21, 3, 15),
);

final Payment _depositPayment = Payment(
  id: 'pay-1',
  installmentId: 'inst-1',
  amount: 16602192,
  paidOn: '2026-07-02',
  method: PaymentResponseDtoMethod.bankTransfer,
  note: null,
  recordedAt: DateTime.utc(2026, 7, 2, 3),
);

/// The mockup after the deposit was recorded (Thu 02/07 · Chuyển khoản).
final PaymentSchedule demoPaymentScheduleDepositPaid = PaymentSchedule(
  orderId: 'DH-2048',
  configured: true,
  editable: false,
  orderTotal: 83010960,
  scheduledTotal: 83010960,
  difference: 0,
  totalMatches: true,
  paidTotal: 16602192,
  remainingTotal: 66408768,
  paidPercent: 20,
  paymentStatus: PaymentScheduleResponseDtoPaymentStatus.partial,
  recordable: true,
  installments: <Installment>[
    Installment(
      id: 'inst-1',
      seq: 1,
      percent: 20,
      amount: 16602192,
      conditionNote: 'Cọc khi ký hợp đồng',
      milestone: InstallmentResponseDtoMilestone.coc,
      paidAmount: 16602192,
      remainingAmount: 0,
      status: InstallmentResponseDtoStatus.paid,
      payments: <Payment>[_depositPayment],
    ),
    _inst2,
    _inst3,
  ],
  updatedAt: DateTime.utc(2026, 10, 21, 3, 15),
);

/// Answer to recording the full deposit: the order moved to Đã cọc.
final RecordPaymentResult demoRecordDepositResult = RecordPaymentResult(
  payment: _depositPayment,
  schedule: demoPaymentScheduleDepositPaid,
  orderStatus: 'dacoc',
  autoTransition: const AutoTransitionResult(
    event: AutoTransitionResultDtoEvent.duCoc,
    outcome: AutoTransitionResultDtoOutcome.applied,
    message: null,
  ),
);

class FakePaymentsPort implements PaymentsPort {
  /// [replyToReplace] is a [PaymentSchedule] (returned) or a [PaymentsPortError]
  /// (thrown); default = the configured demo. [replyToRecord] answers a NEW key:
  /// a [RecordPaymentResult], a [PaymentsPortError] / any error (thrown), or a
  /// `Future<RecordPaymentResult> Function()` the test controls.
  FakePaymentsPort({
    PaymentSchedule? initial,
    Object? replyToReplace,
    Object? replyToRecord,
  })  : assert(
          replyToReplace == null ||
              replyToReplace is PaymentSchedule ||
              replyToReplace is PaymentsPortError,
          'replyToReplace must be a PaymentSchedule or a PaymentsPortError',
        ),
        _current = initial ?? demoPaymentScheduleEmpty,
        _reply = replyToReplace ?? demoPaymentScheduleConfigured,
        _recordReply = replyToRecord ?? demoRecordDepositResult;

  PaymentSchedule _current;
  final Object _reply;
  final Object _recordReply;
  final Map<String, RecordPaymentResult> _recorded =
      <String, RecordPaymentResult>{};
  final Map<String, String> _recordedPayloads = <String, String>{};

  /// Every input submitted to [replaceSchedule], in order.
  final List<ReplacePaymentScheduleInput> replaceCalls =
      <ReplacePaymentScheduleInput>[];

  /// Every input submitted to [recordPayment], in order (retries included).
  final List<RecordPaymentInput> recordCalls = <RecordPaymentInput>[];

  @override
  Future<PaymentSchedule> getSchedule(String orderId) async => _current;

  @override
  Future<PaymentSchedule> replaceSchedule(
    String orderId,
    ReplacePaymentScheduleInput input,
  ) async {
    replaceCalls.add(input);
    final Object reply = _reply;
    if (reply is PaymentsPortError) throw reply;
    _current = reply as PaymentSchedule;
    return _current;
  }

  @override
  Future<RecordPaymentResult> recordPayment(
    String orderId,
    RecordPaymentInput input,
  ) async {
    recordCalls.add(input);
    final RecordPaymentResult? seen = _recorded[input.idempotencyKey];
    if (seen != null) {
      if (_recordedPayloads[input.idempotencyKey] !=
          input.toJson().toString()) {
        throw const PaymentsPortError(
          code: 'CONFLICT',
          message: 'Khoá ghi nhận đã được dùng cho một khoản khác.',
        );
      }
      return RecordPaymentResult(
        payment: seen.payment,
        schedule: seen.schedule,
        orderStatus: seen.orderStatus,
        autoTransition: null,
      );
    }
    final Object reply = _recordReply;
    final RecordPaymentResult result;
    if (reply is RecordPaymentResult) {
      result = reply;
    } else if (reply is Future<RecordPaymentResult> Function()) {
      result = await reply();
    } else {
      throw reply;
    }
    _recorded[input.idempotencyKey] = result;
    _recordedPayloads[input.idempotencyKey] = input.toJson().toString();
    _current = result.schedule;
    return result;
  }
}
