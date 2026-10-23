// A PaymentsPort for the PaymentScheduleCubit tests (Story 11.4): FakePaymentsPort
// underneath (its key replay and `recordCalls` included), every call logged in
// order (see RecordingPortCalls).
import 'package:pns_mobile/design_system/session/fake_payments_port.dart';
import 'package:pns_mobile/design_system/session/payments_port.dart';

import '../recording_port_calls.dart';

class RecordingPaymentsPort extends FakePaymentsPort with RecordingPortCalls {
  RecordingPaymentsPort({super.initial, super.replyToReplace, super.replyToRecord});

  @override
  Future<PaymentSchedule> getSchedule(String orderId) =>
      record('getSchedule', [orderId], () => super.getSchedule(orderId));

  @override
  Future<PaymentSchedule> replaceSchedule(String orderId, ReplacePaymentScheduleInput input) =>
      record('replaceSchedule', [orderId, input], () => super.replaceSchedule(orderId, input));

  @override
  Future<RecordPaymentResult> recordPayment(String orderId, RecordPaymentInput input) =>
      record('recordPayment', [orderId, input], () => super.recordPayment(orderId, input));
}
