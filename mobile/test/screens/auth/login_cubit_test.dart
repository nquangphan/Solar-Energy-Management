// LoginCubit (Story 11.1): the Đăng nhập rules LoginScreen used to hold in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/generated/models/field_error_dto.dart';
import 'package:pns_mobile/design_system/session/session.dart';
import 'package:pns_mobile/screens/auth/login_cubit.dart';
import 'package:pns_mobile/screens/auth/login_state.dart';

/// Records every login call; answers with [reply] (or throws [error]).
class _RecordingAuthPort implements AuthPort {
  _RecordingAuthPort({this.error});

  final Object? error;
  Completer<void>? reply;
  final List<({String phone, String password})> calls = [];

  @override
  Future<void> login({required String phone, required String password}) async {
    calls.add((phone: phone, password: password));
    if (error != null) throw error!;
    await reply?.future;
  }

  @override
  Future<bool> restoreSession() async => false;

  @override
  Future<void> logout() async {}
}

ApiError _phoneRejected(String message) => ApiError(
      'Dữ liệu không hợp lệ.',
      status: 400,
      fieldErrors: [
        const FieldErrorDto(field: 'other', code: 'x', message: 'khác'),
        FieldErrorDto(field: 'phone', code: 'isPhoneNumber', message: message),
        const FieldErrorDto(field: 'phone', code: 'second', message: 'thứ hai'),
      ],
    );

void main() {
  test('starts idle with no message', () {
    final cubit = LoginCubit(_RecordingAuthPort());
    expect(cubit.state, const LoginState());
    cubit.close();
  });

  final empty = _RecordingAuthPort();
  blocTest<LoginCubit, LoginState>(
    'blank phone or password (after trim) ⇒ the validation message, no port call',
    build: () => LoginCubit(empty),
    act: (cubit) async {
      expect(await cubit.submit(phone: '  ', password: 'pw'), isFalse);
      await cubit.submit(phone: '0901', password: '   ');
    },
    expect: () => [const LoginState(error: 'Nhập đủ số điện thoại và mật khẩu.')],
    verify: (_) => expect(empty.calls, isEmpty),
  );

  final accepted = _RecordingAuthPort();
  blocTest<LoginCubit, LoginState>(
    'accepted ⇒ true, busy then idle; the phone is trimmed, the password sent as typed',
    build: () => LoginCubit(accepted),
    seed: () => const LoginState(error: 'old', phoneError: 'old'),
    act: (cubit) async => expect(await cubit.submit(phone: ' 0901 234 567 ', password: ' pw '), isTrue),
    expect: () => [const LoginState(busy: true), const LoginState()],
    verify: (_) => expect(accepted.calls, [(phone: '0901 234 567', password: ' pw ')]),
  );

  blocTest<LoginCubit, LoginState>(
    'a 400 fieldErrors.phone ⇒ the FIRST phone message under the field, no banner',
    build: () => LoginCubit(_RecordingAuthPort(error: _phoneRejected('Số điện thoại không hợp lệ.'))),
    act: (cubit) => cubit.submit(phone: 'abc', password: 'pw'),
    expect: () => [const LoginState(busy: true), const LoginState(phoneError: 'Số điện thoại không hợp lệ.')],
  );

  blocTest<LoginCubit, LoginState>(
    'any other ApiError ⇒ its message verbatim',
    build: () => LoginCubit(_RecordingAuthPort(error: ApiError('Sai số điện thoại hoặc mật khẩu.', status: 401))),
    act: (cubit) => cubit.submit(phone: '0901', password: 'pw'),
    expect: () => [const LoginState(busy: true), const LoginState(error: 'Sai số điện thoại hoặc mật khẩu.')],
  );

  blocTest<LoginCubit, LoginState>(
    'a non-ApiError ⇒ the generic message, never its English text',
    build: () => LoginCubit(_RecordingAuthPort(error: StateError('socket closed'))),
    act: (cubit) => cubit.submit(phone: '0901', password: 'pw'),
    expect: () => [const LoginState(busy: true), const LoginState(error: kGenericErrorMessage)],
  );

  test('a second submit while busy sends nothing', () async {
    final port = _RecordingAuthPort()..reply = Completer<void>();
    final cubit = LoginCubit(port);
    final first = cubit.submit(phone: '0901', password: 'pw');
    expect(await cubit.submit(phone: '0901', password: 'pw'), isFalse);
    expect(port.calls, hasLength(1));
    port.reply!.complete();
    expect(await first, isTrue);
    await cubit.close();
  });

  test('the port answering after close ⇒ false, no throw, no emit', () async {
    final port = _RecordingAuthPort()..reply = Completer<void>();
    final cubit = LoginCubit(port);
    final submit = cubit.submit(phone: '0901', password: 'pw');
    final states = <LoginState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.close();
    port.reply!.complete();
    expect(await submit, isFalse);
    expect(states, isEmpty);
    await sub.cancel();
  });

  test('the port failing after close ⇒ false, no throw, no emit', () async {
    final port = _RecordingAuthPort()..reply = Completer<void>();
    final cubit = LoginCubit(port);
    final submit = cubit.submit(phone: '0901', password: 'pw');
    final states = <LoginState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.close();
    port.reply!.completeError(ApiError('Sai số điện thoại hoặc mật khẩu.', status: 401));
    expect(await submit, isFalse);
    expect(states, isEmpty);
    await sub.cancel();
  });
}
