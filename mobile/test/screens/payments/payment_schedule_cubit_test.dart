// PaymentScheduleCubit (Story 11.4): the schedule, its edit form and the record-a-payment form
// PaymentScheduleScreen used to hold in its State — the idempotency key above all (NFR-1).
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/fake_payments_port.dart';
import 'package:pns_mobile/design_system/session/payments_port.dart';
import 'package:pns_mobile/screens/payments/payment_schedule_cubit.dart';
import 'package:pns_mobile/screens/payments/payment_schedule_state.dart';

import 'recording_payments_port.dart';

const String _orderId = 'DH-2048';
const String _recordFallback = 'Không ghi nhận được thanh toán. Vui lòng thử lại.';
const String _saveFallback = 'Không lưu được lịch thanh toán. Vui lòng thử lại.';

final PaymentSchedule _configured = demoPaymentScheduleConfigured;
final Installment _first = _configured.installments[0];
final Installment _second = _configured.installments[1];

const AutoTransitionResult _skipped = AutoTransitionResult(
  event: AutoTransitionResultDtoEvent.duCoc,
  outcome: AutoTransitionResultDtoOutcome.skipped,
  message: 'Đơn chưa chốt.',
);

/// `key-1`, `key-2`, … — one per call.
String Function() _keys() {
  int n = 0;
  return () => 'key-${++n}';
}

PaymentScheduleCubit _cubit(PaymentsPort port, {String Function()? newKey}) =>
    PaymentScheduleCubit(port: port, orderId: _orderId, newKey: newKey ?? _keys());

/// Every field away from its default, so a dropped carry-over shows.
PaymentScheduleState _seed({PaymentScheduleStatus status = PaymentScheduleStatus.ready}) => PaymentScheduleState(
      status: status,
      schedule: _configured,
      editing: true,
      saving: false,
      rowErrors: const {0: PaymentRowErrors(number: 'n0')},
      formError: 'form',
      conflict: 'conflict',
      recordFor: _first,
      recordKey: 'key-seed',
      recordFailedAttempt: true,
      recording: false,
      recordFieldErrors: const {'amount': 'a'},
      recordError: 'record',
      recordConflict: 'record conflict',
      outcome: demoRecordDepositResult.autoTransition,
      outcomeStatus: 'dacoc',
    );

/// The record form open on [_first] under [key], nothing else set.
PaymentScheduleState _formOpen({String key = 'key-1', bool failed = false}) => PaymentScheduleState(
      status: PaymentScheduleStatus.ready,
      schedule: _configured,
      recordFor: _first,
      recordKey: key,
      recordFailedAttempt: failed,
    );

Future<String?> _submit(PaymentScheduleCubit cubit,
        {String amountText = '16602192', String paidOn = '2026-07-02', String method = 'bank_transfer', String note = ''}) =>
    cubit.submitRecord(amountText: amountText, paidOn: paidOn, method: method, note: note);

ReplacePaymentScheduleInput _twoRows() => const ReplacePaymentScheduleInput(installments: [
      InstallmentInput(percent: 30, conditionNote: 'a'),
      InstallmentInput(percent: 70, conditionNote: 'b'),
    ]);

PaymentsPortError _invalid(List<FieldError> fields, {String message = 'Dữ liệu không hợp lệ.'}) =>
    PaymentsPortError(code: 'VALIDATION_FAILED', message: message, fieldErrors: fields);

FieldError _field(String field, String message) => FieldError(field: field, code: 'invalid', message: message);

void main() {
  test('starts loading with nothing open', () {
    final cubit = _cubit(RecordingPaymentsPort());
    expect(cubit.state, const PaymentScheduleState());
    cubit.close();
  });

  group('load', () {
    late RecordingPaymentsPort port;
    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'ok ⇒ loading, then ready with the schedule of this order',
      setUp: () => port = RecordingPaymentsPort(initial: _configured),
      build: () => _cubit(port),
      act: (cubit) => cubit.load(),
      expect: () => [
        const PaymentScheduleState(),
        PaymentScheduleState(status: PaymentScheduleStatus.ready, schedule: _configured),
      ],
      verify: (_) => expect(port.argsOf('getSchedule'), [
        [_orderId],
      ]),
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'a port error ⇒ error',
      build: () => _cubit(RecordingPaymentsPort()..errors['getSchedule'] = StateError('offline')),
      act: (cubit) => cubit.load(),
      expect: () => [const PaymentScheduleState(), const PaymentScheduleState(status: PaymentScheduleStatus.error)],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'closes both forms and clears their errors, but KEEPS the outcome, its status, the key and the failed attempt',
      build: () => _cubit(RecordingPaymentsPort(initial: demoPaymentScheduleMismatch)),
      seed: _seed,
      act: (cubit) => cubit.load(),
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.loading,
          schedule: _configured,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: demoPaymentScheduleMismatch,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'a reload that fails keeps the outcome, the key and the failed attempt too',
      build: () => _cubit(RecordingPaymentsPort()..errors['getSchedule'] = StateError('offline')),
      seed: _seed,
      act: (cubit) => cubit.load(),
      skip: 1,
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.error,
          schedule: _configured,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
    );

    for (final outcome in ['answers', 'fails']) {
      test('ticket: the first read $outcome after the second answered ⇒ only the second shows', () async {
        final port = RecordingPaymentsPort()..held.add('getSchedule');
        final cubit = _cubit(port);
        unawaited(cubit.load());
        unawaited(cubit.load());
        port.pendingOf('getSchedule', 1).complete(demoPaymentScheduleMismatch);
        await pumpEventQueue();
        outcome == 'answers'
            ? port.pendingOf('getSchedule', 0).complete(_configured)
            : port.pendingOf('getSchedule', 0).completeError(StateError('late'));
        await pumpEventQueue();
        expect(cubit.state,
            PaymentScheduleState(status: PaymentScheduleStatus.ready, schedule: demoPaymentScheduleMismatch));
        await cubit.close();
      });
    }
  });

  group('record a payment — the idempotency key', () {
    test('openRecord ⇒ a NEW key, the failed flag and the outcome reset, its errors cleared', () {
      final cubit = _cubit(RecordingPaymentsPort(), newKey: _keys());
      cubit.emit(_seed().copyWith(recordFor: _second));
      expect(cubit.openRecord(_first), isTrue);
      expect(
        cubit.state,
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          editing: true,
          rowErrors: const {0: PaymentRowErrors(number: 'n0')},
          formError: 'form',
          conflict: 'conflict',
          recordFor: _first,
          recordKey: 'key-1',
          outcomeStatus: 'dacoc',
        ),
      );
      cubit.close();
    });

    test('openRecord on the installment already open ⇒ false, the form and its key kept', () {
      final cubit = _cubit(RecordingPaymentsPort(), newKey: _keys());
      cubit.emit(_seed());
      expect(cubit.openRecord(_first), isFalse);
      expect(cubit.state, _seed());
      cubit.close();
    });

    test('a refused attempt, then a retry ⇒ the SAME key twice; the success reports the status (replay)', () async {
      final port = RecordingPaymentsPort(
        initial: _configured,
        replyToRecord: RecordPaymentResult(
          payment: demoRecordDepositResult.payment,
          schedule: demoPaymentScheduleDepositPaid,
          orderStatus: 'dacoc',
          autoTransition: null,
        ),
      )..errors['recordPayment'] = const PaymentsPortError(code: 'INTERNAL', message: 'Lỗi máy chủ.');
      final cubit = _cubit(port);
      cubit.emit(PaymentScheduleState(status: PaymentScheduleStatus.ready, schedule: _configured));
      cubit.openRecord(_first);
      expect(await _submit(cubit), isNull);
      expect(cubit.state.recordFailedAttempt, isTrue);
      expect(cubit.openRecord(_first), isFalse, reason: 'pressing Ghi nhận again keeps the form');
      port.errors.remove('recordPayment');
      expect(await _submit(cubit), 'dacoc', reason: 'no autoTransition, but the first attempt may have landed');
      expect([for (final a in port.argsOf('recordPayment')) (a[1] as RecordPaymentInput).idempotencyKey], ['key-1', 'key-1']);
      expect(cubit.state.recordKey, 'key-1');
      await cubit.close();
    });

    test('closeRecord then open again ⇒ a fresh key', () async {
      final port = RecordingPaymentsPort(initial: _configured);
      final cubit = _cubit(port);
      cubit.openRecord(_first);
      cubit.closeRecord();
      cubit.openRecord(_first);
      await _submit(cubit);
      expect(port.recordCalls.single.idempotencyKey, 'key-2');
      await cubit.close();
    });

    test('another installment ⇒ a fresh key', () {
      final cubit = _cubit(RecordingPaymentsPort());
      cubit.openRecord(_first);
      expect(cubit.openRecord(_second), isTrue);
      expect(cubit.state.recordKey, 'key-2');
      expect(cubit.state.recordFor, same(_second));
      cubit.close();
    });

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'closeRecord ⇒ no form, its errors cleared; the key and the rest kept',
      build: () => _cubit(RecordingPaymentsPort()),
      seed: _seed,
      act: (cubit) => cubit.closeRecord(),
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          editing: true,
          rowErrors: const {0: PaymentRowErrors(number: 'n0')},
          formError: 'form',
          conflict: 'conflict',
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
    );
  });

  group('submitRecord', () {
    late RecordingPaymentsPort port;

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'ok + applied ⇒ recording, then the new schedule, form closed, outcome shown; returns the status',
      setUp: () => port = RecordingPaymentsPort(initial: _configured),
      build: () => _cubit(port),
      seed: () => _formOpen().copyWith(recordError: 'old', recordConflict: 'old', recordFieldErrors: const {'paidOn': 'x'}),
      act: (cubit) async => expect(await _submit(cubit, note: '  cọc  ', paidOn: ' 2026-07-02 '), 'dacoc'),
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          recordFor: _first,
          recordKey: 'key-1',
          recording: true,
        ),
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: demoPaymentScheduleDepositPaid,
          recordKey: 'key-1',
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
      verify: (_) {
        final RecordPaymentInput sent = port.recordCalls.single;
        expect(port.argsOf('recordPayment').single.first, _orderId);
        expect(sent.idempotencyKey, 'key-1');
        expect(sent.installmentId, 'inst-1');
        expect(sent.amount, 16602192);
        expect(sent.paidOn, '2026-07-02');
        expect(sent.method, 'bank_transfer');
        expect(sent.note, 'cọc');
      },
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'a blank note ⇒ null; a blank amount ⇒ null to the port (the adapter refuses it, 0 HTTP)',
      setUp: () => port = RecordingPaymentsPort(initial: _configured),
      build: () => _cubit(port),
      seed: _formOpen,
      act: (cubit) => _submit(cubit, amountText: '', note: '   ', method: 'cash'),
      verify: (_) {
        expect(port.recordCalls.single.amount, isNull);
        expect(port.recordCalls.single.note, isNull);
        expect(port.recordCalls.single.method, 'cash');
      },
    );

    test('skipped on a first attempt ⇒ null (the order did not move)', () async {
      final port = RecordingPaymentsPort(
        replyToRecord: RecordPaymentResult(
          payment: demoRecordDepositResult.payment,
          schedule: demoPaymentScheduleDepositPaid,
          orderStatus: 'dachot',
          autoTransition: _skipped,
        ),
      );
      final cubit = _cubit(port)..emit(_formOpen());
      expect(await _submit(cubit), isNull);
      expect(cubit.state.outcome, same(_skipped));
      expect(cubit.state.outcomeStatus, 'dachot');
      await cubit.close();
    });

    test('no autoTransition on a first attempt ⇒ null', () async {
      final port = RecordingPaymentsPort(
        replyToRecord: RecordPaymentResult(
          payment: demoRecordDepositResult.payment,
          schedule: demoPaymentScheduleDepositPaid,
          orderStatus: 'dachot',
          autoTransition: null,
        ),
      );
      final cubit = _cubit(port)..emit(_formOpen());
      expect(await _submit(cubit), isNull);
      await cubit.close();
    });

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'CONFLICT ⇒ the conflict banner only; the attempt counts as failed',
      build: () => _cubit(RecordingPaymentsPort()
        ..errors['recordPayment'] = const PaymentsPortError(code: 'CONFLICT', message: 'Lịch đã đổi.')),
      seed: _formOpen,
      act: (cubit) => _submit(cubit),
      skip: 1,
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          recordFor: _first,
          recordKey: 'key-1',
          recordFailedAttempt: true,
          recordConflict: 'Lịch đã đổi.',
        ),
      ],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'field errors: amount/paidOn under their field (first one wins), the rest joined under the message',
      build: () => _cubit(RecordingPaymentsPort()
        ..errors['recordPayment'] = _invalid([
          _field('amount', 'Số tiền vượt phần còn lại.'),
          _field('amount', 'second amount'),
          _field('paidOn', 'Ngày thu không được sau hôm nay.'),
          _field('method', 'Phương thức không hợp lệ.'),
        ])),
      seed: _formOpen,
      act: (cubit) => _submit(cubit),
      skip: 1,
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          recordFor: _first,
          recordKey: 'key-1',
          recordFailedAttempt: true,
          recordFieldErrors: const {
            'amount': 'Số tiền vượt phần còn lại.',
            'paidOn': 'Ngày thu không được sau hôm nay.',
          },
          recordError: 'Dữ liệu không hợp lệ.\nPhương thức không hợp lệ.',
        ),
      ],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'any other error ⇒ the fallback sentence; the attempt counts as failed',
      build: () => _cubit(RecordingPaymentsPort()..errors['recordPayment'] = StateError('offline')),
      seed: _formOpen,
      act: (cubit) => _submit(cubit),
      skip: 1,
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          recordFor: _first,
          recordKey: 'key-1',
          recordFailedAttempt: true,
          recordError: _recordFallback,
        ),
      ],
    );

    test('already recording ⇒ null, no request', () async {
      final port = RecordingPaymentsPort();
      final cubit = _cubit(port)..emit(_formOpen().copyWith(recording: true));
      expect(await _submit(cubit), isNull);
      expect(port.log, isEmpty);
      await cubit.close();
    });

    test('no form open ⇒ null, no request', () async {
      final port = RecordingPaymentsPort();
      final cubit = _cubit(port)..emit(_seed().copyWith(recordFor: null));
      expect(await _submit(cubit), isNull);
      expect(port.log, isEmpty);
      await cubit.close();
    });

    test('a second press while the first is in flight ⇒ one request', () async {
      final port = RecordingPaymentsPort()..held.add('recordPayment');
      final cubit = _cubit(port)..emit(_formOpen());
      final Future<String?> first = _submit(cubit);
      expect(await _submit(cubit), isNull);
      expect(port.log, ['recordPayment']);
      port.pendingOf('recordPayment').complete();
      expect(await first, 'dacoc');
      await cubit.close();
    });
  });

  blocTest<PaymentScheduleCubit, PaymentScheduleState>(
    'an emit while sending keeps the in-flight flags (saving, recording)',
    build: () => _cubit(RecordingPaymentsPort()),
    seed: () => _formOpen().copyWith(saving: true, recording: true),
    act: (cubit) => cubit.closeRecord(),
    expect: () => [
      PaymentScheduleState(
        status: PaymentScheduleStatus.ready,
        schedule: _configured,
        saving: true,
        recordKey: 'key-1',
        recording: true,
      ),
    ],
  );

  group('edit the schedule', () {
    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'startEdit ⇒ editing, the form errors cleared, the rest kept',
      build: () => _cubit(RecordingPaymentsPort()),
      seed: () => _seed().copyWith(editing: false),
      act: (cubit) => cubit.startEdit(),
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          editing: true,
          recordFor: _first,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          recordFieldErrors: const {'amount': 'a'},
          recordError: 'record',
          recordConflict: 'record conflict',
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'cancelEdit ⇒ not editing, the form errors cleared, the rest kept',
      build: () => _cubit(RecordingPaymentsPort()),
      seed: _seed,
      act: (cubit) => cubit.cancelEdit(),
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          recordFor: _first,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          recordFieldErrors: const {'amount': 'a'},
          recordError: 'record',
          recordConflict: 'record conflict',
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'clearRowErrors() ⇒ the row errors only; the form banner stays',
      build: () => _cubit(RecordingPaymentsPort()),
      seed: _seed,
      act: (cubit) => cubit.clearRowErrors(),
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          editing: true,
          formError: 'form',
          conflict: 'conflict',
          recordFor: _first,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          recordFieldErrors: const {'amount': 'a'},
          recordError: 'record',
          recordConflict: 'record conflict',
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'clearRowErrors(formError: true) ⇒ the row errors and the form banner; the conflict stays',
      build: () => _cubit(RecordingPaymentsPort()),
      seed: _seed,
      act: (cubit) => cubit.clearRowErrors(formError: true),
      expect: () => [
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: _configured,
          editing: true,
          conflict: 'conflict',
          recordFor: _first,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          recordFieldErrors: const {'amount': 'a'},
          recordError: 'record',
          recordConflict: 'record conflict',
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        ),
      ],
    );
  });

  group('save', () {
    late RecordingPaymentsPort port;
    late ReplacePaymentScheduleInput input;

    /// The record side of [_seed], untouched by the edit form.
    PaymentScheduleState editing({
      PaymentSchedule? schedule,
      bool editing = true,
      bool saving = false,
      Map<int, PaymentRowErrors> rowErrors = const {},
      String? formError,
      String? conflict,
    }) =>
        PaymentScheduleState(
          status: PaymentScheduleStatus.ready,
          schedule: schedule ?? _configured,
          editing: editing,
          saving: saving,
          rowErrors: rowErrors,
          formError: formError,
          conflict: conflict,
          recordFor: _first,
          recordKey: 'key-seed',
          recordFailedAttempt: true,
          recordFieldErrors: const {'amount': 'a'},
          recordError: 'record',
          recordConflict: 'record conflict',
          outcome: demoRecordDepositResult.autoTransition,
          outcomeStatus: 'dacoc',
        );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'ok ⇒ saving (errors cleared), then the new schedule and the form closed; the input sent as built',
      setUp: () {
        port = RecordingPaymentsPort(replyToReplace: demoPaymentScheduleMismatch);
        input = _twoRows();
      },
      build: () => _cubit(port),
      seed: _seed,
      act: (cubit) => cubit.save(input, rowCount: () => 2),
      expect: () => [
        editing(saving: true),
        editing(schedule: demoPaymentScheduleMismatch, editing: false),
      ],
      verify: (_) {
        expect(port.argsOf('replaceSchedule').single[0], _orderId);
        expect(port.argsOf('replaceSchedule').single[1], same(input));
      },
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'row field errors land on their row (first one per field wins); one past the rows displayed is general',
      build: () => _cubit(RecordingPaymentsPort(
        replyToReplace: _invalid([
          _field('installments.1.percent', 'Tỉ lệ phải từ 1 đến 100.'),
          _field('installments.1.amount', 'second number'),
          _field('installments.0.conditionNote', 'Điều kiện quá dài.'),
          _field('installments.5.amount', 'Đợt không tồn tại.'),
        ]),
      )),
      seed: _seed,
      act: (cubit) => cubit.save(_twoRows(), rowCount: () => 2),
      skip: 1,
      expect: () => [
        editing(
          rowErrors: const {
            1: PaymentRowErrors(number: 'Tỉ lệ phải từ 1 đến 100.'),
            0: PaymentRowErrors(note: 'Điều kiện quá dài.'),
          },
          formError: 'Đợt không tồn tại.',
        ),
      ],
    );

    test('the rows are counted when the answer arrives: a row removed during the save sends its error to the banner',
        () async {
      final port = RecordingPaymentsPort()..held.add('replaceSchedule');
      final cubit = _cubit(port)..emit(_seed());
      const ReplacePaymentScheduleInput threeRows = ReplacePaymentScheduleInput(installments: [
        InstallmentInput(percent: 20, conditionNote: 'a'),
        InstallmentInput(percent: 70, conditionNote: 'b'),
        InstallmentInput(percent: 10, conditionNote: 'c'),
      ]);
      int displayed = 3;
      final Future<void> pending = cubit.save(threeRows, rowCount: () => displayed);
      await pumpEventQueue();
      displayed = 2;
      port.pendingOf('replaceSchedule').completeError(_invalid([_field('installments.2.amount', 'Số tiền phải lớn hơn 0.')]));
      await pending;
      expect(cubit.state.rowErrors, isEmpty);
      expect(cubit.state.formError, 'Số tiền phải lớn hơn 0.');
      await cubit.close();
    });

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'only row errors ⇒ no form banner',
      build: () => _cubit(RecordingPaymentsPort(
        replyToReplace: _invalid([_field('installments.1.percent', 'Tỉ lệ phải từ 1 đến 100.')]),
      )),
      seed: _seed,
      act: (cubit) => cubit.save(_twoRows(), rowCount: () => 2),
      skip: 1,
      expect: () => [
        editing(rowErrors: const {1: PaymentRowErrors(number: 'Tỉ lệ phải từ 1 đến 100.')}),
      ],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'no field error at all ⇒ the message as the form banner',
      build: () => _cubit(RecordingPaymentsPort(replyToReplace: _invalid(const [], message: 'Tổng không khớp.'))),
      seed: _seed,
      act: (cubit) => cubit.save(_twoRows(), rowCount: () => 2),
      skip: 1,
      expect: () => [editing(formError: 'Tổng không khớp.')],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'CONFLICT ⇒ the conflict banner only',
      build: () => _cubit(RecordingPaymentsPort(
        replyToReplace: const PaymentsPortError(code: 'CONFLICT', message: 'Lịch đã có thu tiền.'),
      )),
      seed: _seed,
      act: (cubit) => cubit.save(_twoRows(), rowCount: () => 2),
      skip: 1,
      expect: () => [editing(conflict: 'Lịch đã có thu tiền.')],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'any other error ⇒ the fallback sentence',
      build: () => _cubit(RecordingPaymentsPort()..errors['replaceSchedule'] = StateError('offline')),
      seed: _seed,
      act: (cubit) => cubit.save(_twoRows(), rowCount: () => 2),
      skip: 1,
      expect: () => [editing(formError: _saveFallback)],
    );

    blocTest<PaymentScheduleCubit, PaymentScheduleState>(
      'general errors joined line by line; an index equal to the rows sent is general; first note error per row wins',
      build: () => _cubit(RecordingPaymentsPort(
        replyToReplace: _invalid([
          _field('installments', 'Tổng phải đủ 100%.'),
          _field('installments.2.amount', 'Đợt 3 không tồn tại.'),
          _field('installments.0.conditionNote', 'Điều kiện quá dài.'),
          _field('installments.0.conditionNote', 'second note'),
        ]),
      )),
      seed: _seed,
      act: (cubit) => cubit.save(_twoRows(), rowCount: () => 2),
      skip: 1,
      expect: () => [
        editing(
          rowErrors: const {0: PaymentRowErrors(note: 'Điều kiện quá dài.')},
          formError: 'Tổng phải đủ 100%.\nĐợt 3 không tồn tại.',
        ),
      ],
    );

    test('already saving ⇒ no request', () async {
      final port = RecordingPaymentsPort();
      final cubit = _cubit(port)..emit(_seed().copyWith(saving: true));
      await cubit.save(_twoRows(), rowCount: () => 2);
      expect(port.log, isEmpty);
      await cubit.close();
    });
  });

  group('closed early', () {
    for (final outcome in ['answers', 'fails']) {
      test('load: the port $outcome after close ⇒ no throw, no emit', () async {
        final port = RecordingPaymentsPort()..held.add('getSchedule');
        final cubit = _cubit(port);
        final Future<void> pending = cubit.load();
        await pumpEventQueue();
        await cubit.close();
        outcome == 'answers'
            ? port.pendingOf('getSchedule').complete(_configured)
            : port.pendingOf('getSchedule').completeError(StateError('late'));
        await pending;
        expect(cubit.state, const PaymentScheduleState());
      });
    }

    // A late success, a late refusal and a late transport failure each once.
    for (final (String outcome, Object? error) in [
      ('answers', null),
      ('fails (PaymentsPortError)', const PaymentsPortError(code: 'INTERNAL', message: 'x')),
      ('fails (StateError)', StateError('late')),
    ]) {
      test('submitRecord: the port $outcome after close ⇒ null, no emit', () async {
        final port = RecordingPaymentsPort()..held.add('recordPayment');
        final cubit = _cubit(port)..emit(_formOpen());
        final Future<String?> pending = _submit(cubit);
        await pumpEventQueue();
        await cubit.close();
        error == null
            ? port.pendingOf('recordPayment').complete()
            : port.pendingOf('recordPayment').completeError(error);
        expect(await pending, isNull);
        expect(cubit.state, _formOpen().copyWith(recording: true));
      });

      test('save: the port $outcome after close ⇒ no throw, no emit', () async {
        final port = RecordingPaymentsPort()..held.add('replaceSchedule');
        final cubit = _cubit(port)..emit(_seed());
        final Future<void> pending = cubit.save(_twoRows(), rowCount: () => 2);
        await pumpEventQueue();
        await cubit.close();
        error == null
            ? port.pendingOf('replaceSchedule').complete()
            : port.pendingOf('replaceSchedule').completeError(error);
        await pending;
        expect(cubit.state.saving, isTrue);
        expect(cubit.state.editing, isTrue);
      });
    }
  });
}
