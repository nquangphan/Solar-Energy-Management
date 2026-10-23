// ForgotPasswordCubit (Story 11.1): the two-step flow, its validation and the
// resend countdown that ForgotPasswordScreen used to hold in its State. The
// countdown cases run under testWidgets for its fake clock.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/generated/models/field_error_dto.dart';
import 'package:pns_mobile/design_system/session/session.dart';
import 'package:pns_mobile/screens/auth/forgot_password_cubit.dart';
import 'package:pns_mobile/screens/auth/forgot_password_state.dart';

/// Records every call; [requestError]/[resetError] make the call throw, [pending]
/// and [resetPending] hold the request / reset until the test completes them.
class _RecordingPasswordPort implements PasswordPort {
  _RecordingPasswordPort({this.expiresInSeconds = 300, this.requestError, this.resetError});

  final int expiresInSeconds;
  final Object? requestError;
  final Object? resetError;
  Completer<int>? pending;
  Completer<void>? resetPending;
  final List<String> requested = [];
  final List<({String phone, String code, String newPassword})> resets = [];

  @override
  Future<int> requestResetCode(String phone) async {
    requested.add(phone);
    if (requestError != null) throw requestError!;
    return pending?.future ?? expiresInSeconds;
  }

  @override
  Future<void> resetPassword({required String phone, required String code, required String newPassword}) async {
    resets.add((phone: phone, code: code, newPassword: newPassword));
    if (resetError != null) throw resetError!;
    await resetPending?.future;
  }

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {}
}

const _resetFailed = 'Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.';
const _verify = ForgotPasswordState(step: ForgotStep.verify, remaining: 300);

void main() {
  test('starts on the request step with no message and no countdown', () {
    final cubit = ForgotPasswordCubit(_RecordingPasswordPort());
    expect(cubit.state, const ForgotPasswordState(step: ForgotStep.request, remaining: 0));
    cubit.close();
  });

  final blank = _RecordingPasswordPort();
  blocTest<ForgotPasswordCubit, ForgotPasswordState>(
    'blank phone ⇒ the request message, no port call',
    build: () => ForgotPasswordCubit(blank),
    act: (cubit) => cubit.requestCode('   '),
    expect: () => [const ForgotPasswordState(error: 'Nhập số điện thoại đã đăng ký.')],
    verify: (_) => expect(blank.requested, isEmpty),
  );

  final sent = _RecordingPasswordPort();
  blocTest<ForgotPasswordCubit, ForgotPasswordState>(
    'code sent ⇒ the verify step with the code lifetime; the RAW number only trimmed',
    build: () => ForgotPasswordCubit(sent),
    seed: () => const ForgotPasswordState(error: 'old', phoneError: 'old'),
    act: (cubit) => cubit.requestCode(' 0901 234 567 '),
    expect: () => [const ForgotPasswordState(), _verify],
    verify: (_) => expect(sent.requested, ['0901 234 567']),
  );

  blocTest<ForgotPasswordCubit, ForgotPasswordState>(
    'a 400 fieldErrors.phone ⇒ its first message under the field',
    build: () => ForgotPasswordCubit(_RecordingPasswordPort(
      requestError: ApiError('Dữ liệu không hợp lệ.', status: 400, fieldErrors: [
        const FieldErrorDto(field: 'phone', code: 'isPhoneNumber', message: 'Số điện thoại không hợp lệ.'),
        const FieldErrorDto(field: 'phone', code: 'second', message: 'thứ hai'),
      ]),
    )),
    act: (cubit) => cubit.requestCode('abc'),
    expect: () => [const ForgotPasswordState(), const ForgotPasswordState(phoneError: 'Số điện thoại không hợp lệ.')],
  );

  blocTest<ForgotPasswordCubit, ForgotPasswordState>(
    'any other request failure ⇒ the one generic message',
    build: () => ForgotPasswordCubit(_RecordingPasswordPort(requestError: ApiError('Quá nhiều yêu cầu.', status: 429))),
    act: (cubit) => cubit.requestCode('0901'),
    expect: () => [const ForgotPasswordState(), const ForgotPasswordState(error: 'Không gửi được mã. Thử lại sau.')],
  );

  test('the request answering after close ⇒ no throw, no emit, no countdown', () async {
    final port = _RecordingPasswordPort()..pending = Completer<int>();
    final cubit = ForgotPasswordCubit(port);
    final request = cubit.requestCode('0901');
    final states = <ForgotPasswordState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.close();
    port.pending!.complete(300);
    await request;
    expect(states, isEmpty);
    await sub.cancel();
  });

  test('the request failing after close ⇒ no throw, no emit', () async {
    final port = _RecordingPasswordPort()..pending = Completer<int>();
    final cubit = ForgotPasswordCubit(port);
    final request = cubit.requestCode('0901');
    final states = <ForgotPasswordState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.close();
    port.pending!.completeError(ApiError('Quá nhiều yêu cầu.', status: 429));
    await request;
    expect(states, isEmpty);
    await sub.cancel();
  });

  for (final (outcome, Object? error) in [('accepted', null), ('refused', ApiError('Mã đã hết hạn.', status: 400))]) {
    test('the reset $outcome after close ⇒ false (no return to login), no throw, no emit', () async {
      final port = _RecordingPasswordPort()..resetPending = Completer<void>();
      final cubit = ForgotPasswordCubit(port);
      final reset = cubit.reset(phone: '0901', code: '123456', password: 'abc12345', confirm: 'abc12345');
      final states = <ForgotPasswordState>[];
      final sub = cubit.stream.listen(states.add);
      await cubit.close();
      error == null ? port.resetPending!.complete() : port.resetPending!.completeError(error);
      expect(await reset, isFalse);
      expect(states, isEmpty);
      await sub.cancel();
    });
  }

  final invalid = _RecordingPasswordPort();
  for (final (name, code, password, confirm, message) in [
    ('a code that is not 6 digits', '12345', 'abc12345', 'abc12345', 'Mã xác thực gồm đúng 6 chữ số.'),
    ('a weak password', '123456', 'abcdefgh', 'abcdefgh', 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.'),
    ('a confirmation that does not match', '123456', 'abc12345', 'abc12346', 'Xác nhận mật khẩu không khớp.'),
  ]) {
    blocTest<ForgotPasswordCubit, ForgotPasswordState>(
      '$name ⇒ its message, no port call',
      build: () => ForgotPasswordCubit(invalid),
      seed: () => _verify,
      act: (cubit) async =>
          expect(await cubit.reset(phone: '0901', code: code, password: password, confirm: confirm), isFalse),
      expect: () => [ForgotPasswordState(step: ForgotStep.verify, remaining: 300, error: message)],
      verify: (_) => expect(invalid.resets, isEmpty),
    );
  }

  final accepted = _RecordingPasswordPort();
  blocTest<ForgotPasswordCubit, ForgotPasswordState>(
    'reset accepted ⇒ true; phone and code trimmed, the password sent as typed',
    build: () => ForgotPasswordCubit(accepted),
    seed: () => const ForgotPasswordState(step: ForgotStep.verify, remaining: 300, error: 'old'),
    act: (cubit) async =>
        expect(await cubit.reset(phone: ' 0901 ', code: ' 123456 ', password: 'abc12345', confirm: 'abc12345'), isTrue),
    expect: () => [_verify],
    verify: (_) => expect(accepted.resets, [(phone: '0901', code: '123456', newPassword: 'abc12345')]),
  );

  for (final error in [ApiError('Mã đã hết hạn.', status: 400), StateError('offline')]) {
    blocTest<ForgotPasswordCubit, ForgotPasswordState>(
      'reset refused (${error.runtimeType}) ⇒ the ONE generic message, never the cause',
      build: () => ForgotPasswordCubit(_RecordingPasswordPort(resetError: error)),
      seed: () => _verify,
      act: (cubit) async =>
          expect(await cubit.reset(phone: '0901', code: '123456', password: 'abc12345', confirm: 'abc12345'), isFalse),
      expect: () => [const ForgotPasswordState(step: ForgotStep.verify, remaining: 300, error: _resetFailed)],
    );
  }

  testWidgets('the countdown ticks down once a second to zero and stops there', (tester) async {
    final cubit = ForgotPasswordCubit(_RecordingPasswordPort(expiresInSeconds: 2));
    await cubit.requestCode('0901');
    expect(cubit.state.remaining, 2);
    await tester.pump(const Duration(seconds: 1));
    expect(cubit.state.remaining, 1);
    await tester.pump(const Duration(seconds: 1));
    expect(cubit.state.remaining, 0);
    await tester.pump(const Duration(seconds: 5));
    expect(cubit.state.remaining, 0);
    // Stopped at zero: no timer is left pending (testWidgets fails on one).
    await cubit.close();
  });

  testWidgets('a tick keeps the banner (it only moves the countdown)', (tester) async {
    final cubit = ForgotPasswordCubit(_RecordingPasswordPort(expiresInSeconds: 5));
    await cubit.requestCode('0901');
    await cubit.reset(phone: '0901', code: '1', password: 'abc12345', confirm: 'abc12345');
    await tester.pump(const Duration(seconds: 1));
    expect(cubit.state, const ForgotPasswordState(step: ForgotStep.verify, remaining: 4, error: 'Mã xác thực gồm đúng 6 chữ số.'));
    await cubit.close();
  });

  test('close while counting ⇒ the timer is cancelled, nothing emitted after', () async {
    final cubit = ForgotPasswordCubit(_RecordingPasswordPort(expiresInSeconds: 300));
    await cubit.requestCode('0901');
    final states = <ForgotPasswordState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.close();
    // Past one tick on the real clock: a live timer would have emitted (or thrown).
    await Future<void>.delayed(const Duration(milliseconds: 1100));
    expect(states, isEmpty);
    expect(cubit.state.remaining, 300);
    await sub.cancel();
  });

  testWidgets('a second code request restarts the countdown (the old timer is cancelled)', (tester) async {
    final cubit = ForgotPasswordCubit(_RecordingPasswordPort(expiresInSeconds: 10));
    await cubit.requestCode('0901');
    await tester.pump(const Duration(seconds: 3));
    expect(cubit.state.remaining, 7);
    await cubit.requestCode('0901');
    expect(cubit.state.remaining, 10);
    await tester.pump(const Duration(seconds: 1));
    // One timer, so one tick per second.
    expect(cubit.state.remaining, 9);
    await cubit.close();
  });
}
