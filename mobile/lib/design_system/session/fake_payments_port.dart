// hand-authored — TEST/DEMO-ONLY fake port (Story 7.1, mirror web
// web/src/design-system/session/fake-payments-port.ts).
//
// NOT a real backend and it computes NOTHING: every amount below is typed as the
// backend would return it, and `replaceSchedule` answers a canned reply
// regardless of what was submitted. It only records what it was sent.

import 'payments_port.dart';

const PaymentSchedule demoPaymentScheduleConfigured = PaymentSchedule(
  orderId: 'DH-2048',
  configured: true,
  editable: true,
  orderTotal: 83010960,
  scheduledTotal: 83010960,
  difference: 0,
  totalMatches: true,
  installments: <Installment>[
    Installment(
      seq: 1,
      percent: 20,
      amount: 16602192,
      conditionNote: 'Cọc khi ký hợp đồng',
      milestone: 'coc',
    ),
    Installment(
      seq: 2,
      percent: 70,
      amount: 58107672,
      conditionNote: 'Khi thi công',
    ),
    Installment(
      seq: 3,
      percent: 10,
      amount: 8301096,
      conditionNote: 'Khi nghiệm thu, bàn giao',
      milestone: 'tat_toan',
    ),
  ],
  updatedAt: '2026-10-21T03:15:00.000Z',
);

const PaymentSchedule demoPaymentScheduleEmpty = PaymentSchedule(
  orderId: 'DH-2048',
  configured: false,
  editable: true,
  orderTotal: 83010960,
  scheduledTotal: 0,
  difference: 83010960,
  totalMatches: false,
  installments: <Installment>[],
);

/// Installments 1 and 2 only: the sum is short of the order total.
const PaymentSchedule demoPaymentScheduleMismatch = PaymentSchedule(
  orderId: 'DH-2048',
  configured: true,
  editable: true,
  orderTotal: 83010960,
  scheduledTotal: 74709864,
  difference: 8301096,
  totalMatches: false,
  installments: <Installment>[
    Installment(
      seq: 1,
      percent: 20,
      amount: 16602192,
      conditionNote: 'Cọc khi ký hợp đồng',
      milestone: 'coc',
    ),
    Installment(
      seq: 2,
      percent: 70,
      amount: 58107672,
      conditionNote: 'Khi thi công',
    ),
  ],
  updatedAt: '2026-10-21T03:15:00.000Z',
);

class FakePaymentsPort implements PaymentsPort {
  /// [replyToReplace] is a [PaymentSchedule] (returned) or a [PaymentsPortError]
  /// (thrown); default = the configured demo.
  FakePaymentsPort({
    PaymentSchedule initial = demoPaymentScheduleEmpty,
    Object replyToReplace = demoPaymentScheduleConfigured,
  })  : assert(
          replyToReplace is PaymentSchedule ||
              replyToReplace is PaymentsPortError,
          'replyToReplace must be a PaymentSchedule or a PaymentsPortError',
        ),
        _current = initial,
        _reply = replyToReplace;

  PaymentSchedule _current;
  final Object _reply;

  /// Every input submitted to [replaceSchedule], in order.
  final List<ReplacePaymentScheduleInput> replaceCalls =
      <ReplacePaymentScheduleInput>[];

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
}
