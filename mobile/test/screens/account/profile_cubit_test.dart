// ProfileCubit (Story 11.2): the đổi mật khẩu rules ProfileScreen used to hold in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/design_system/session/password_port.dart';
import 'package:pns_mobile/screens/account/profile_cubit.dart';
import 'package:pns_mobile/screens/account/profile_state.dart';

/// Records every changePassword call; answers with [reply] (or throws [error]).
class _RecordingPasswordPort implements PasswordPort {
  _RecordingPasswordPort({this.error});

  final Object? error;
  Completer<void>? reply;
  final List<({String currentPassword, String newPassword})> calls = [];

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    calls.add((currentPassword: currentPassword, newPassword: newPassword));
    if (error != null) throw error!;
    await reply?.future;
  }

  @override
  Future<int> requestResetCode(String phone) async => 300;

  @override
  Future<void> resetPassword({required String phone, required String code, required String newPassword}) async {}
}

const String _failed = 'Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại.';

void main() {
  test('starts with no error and no success banner', () {
    final cubit = ProfileCubit(_RecordingPasswordPort());
    expect(cubit.state, const ProfileState());
    cubit.close();
  });

  final invalid = _RecordingPasswordPort();
  blocTest<ProfileCubit, ProfileState>(
    'the three validation messages, in order, never reach the port',
    build: () => ProfileCubit(invalid),
    act: (cubit) async {
      expect(await cubit.submit(current: '   ', password: 'MatKhau123', confirm: 'MatKhau123'), isFalse);
      await cubit.submit(current: 'cu', password: 'ngan1', confirm: 'ngan1');
      await cubit.submit(current: 'cu', password: 'MatKhau123', confirm: 'MatKhau124');
    },
    expect: () => [
      const ProfileState(error: 'Nhập mật khẩu hiện tại.'),
      const ProfileState(error: 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.'),
      const ProfileState(error: 'Xác nhận mật khẩu không khớp.'),
    ],
    verify: (_) => expect(invalid.calls, isEmpty),
  );

  blocTest<ProfileCubit, ProfileState>(
    'several rules broken at once ⇒ the first in order wins: current, then policy, then confirmation',
    build: () => ProfileCubit(_RecordingPasswordPort()),
    act: (cubit) async {
      await cubit.submit(current: '', password: 'ngan', confirm: 'khac');
      await cubit.submit(current: 'cu', password: 'ngan', confirm: 'khac');
    },
    expect: () => [
      const ProfileState(error: 'Nhập mật khẩu hiện tại.'),
      const ProfileState(error: 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.'),
    ],
  );

  final accepted = _RecordingPasswordPort();
  blocTest<ProfileCubit, ProfileState>(
    'accepted ⇒ true and done; the current password is trimmed, the new one sent as typed',
    build: () => ProfileCubit(accepted),
    seed: () => const ProfileState(error: 'old'),
    act: (cubit) async =>
        expect(await cubit.submit(current: ' cu ', password: ' MatKhau123', confirm: ' MatKhau123'), isTrue),
    expect: () => [const ProfileState(), const ProfileState(done: true)],
    verify: (_) => expect(accepted.calls, [(currentPassword: 'cu', newPassword: ' MatKhau123')]),
  );

  for (final (kind, Object error) in [
    ('an ApiError with its own message', ApiError('Mật khẩu hiện tại không đúng.', status: 400)),
    ('a non-ApiError', StateError('offline')),
  ]) {
    blocTest<ProfileCubit, ProfileState>(
      '$kind ⇒ the fixed sentence, false, not done',
      build: () => ProfileCubit(_RecordingPasswordPort(error: error)),
      act: (cubit) async =>
          expect(await cubit.submit(current: 'cu', password: 'MatKhau123', confirm: 'MatKhau123'), isFalse),
      expect: () => [const ProfileState(), const ProfileState(error: _failed)],
    );
  }

  blocTest<ProfileCubit, ProfileState>(
    'submitting after a success drops the success banner before the validation error',
    build: () => ProfileCubit(_RecordingPasswordPort()),
    seed: () => const ProfileState(done: true),
    act: (cubit) => cubit.submit(current: '', password: '', confirm: ''),
    expect: () => [const ProfileState(), const ProfileState(error: 'Nhập mật khẩu hiện tại.')],
  );

  blocTest<ProfileCubit, ProfileState>(
    'clearError drops the error and keeps the success banner',
    build: () => ProfileCubit(_RecordingPasswordPort()),
    seed: () => const ProfileState(error: 'x', done: true),
    act: (cubit) => cubit.clearError(),
    expect: () => [const ProfileState(done: true)],
  );

  for (final (outcome, Object? error) in [('answering', null), ('failing', StateError('offline'))]) {
    test('the port $outcome after close ⇒ false, no throw, no emit', () async {
      final port = _RecordingPasswordPort()..reply = Completer<void>();
      final cubit = ProfileCubit(port);
      final submit = cubit.submit(current: 'cu', password: 'MatKhau123', confirm: 'MatKhau123');
      final states = <ProfileState>[];
      final sub = cubit.stream.listen(states.add);
      await cubit.close();
      error == null ? port.reply!.complete() : port.reply!.completeError(error);
      expect(await submit, isFalse);
      expect(states, isEmpty);
      await sub.cancel();
    });
  }
}
