// SessionCubit (Story 11.1): the session phases PnsApp used to hold in its State.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/app/session_cubit.dart';
import 'package:pns_mobile/app/session_state.dart';
import 'package:pns_mobile/design_system/session/session.dart';

/// Restore / logout answer when the test says so; counts logout calls.
class _ScriptedAuthPort implements AuthPort {
  _ScriptedAuthPort({this.restoreThrows = false});

  final bool restoreThrows;
  final Completer<bool> restored = Completer<bool>();
  Completer<void> loggedOut = Completer<void>();
  int logouts = 0;

  @override
  Future<void> login({required String phone, required String password}) async {}

  @override
  Future<bool> restoreSession() async {
    if (restoreThrows) throw StateError('offline');
    return restored.future;
  }

  @override
  Future<void> logout() {
    logouts++;
    return loggedOut.future;
  }
}

const _signedIn1 = SessionState(phase: SessionPhase.signedIn, signInCount: 1);
const _signedOut1 = SessionState(phase: SessionPhase.signedOut, signInCount: 1);

void main() {
  test('starts restoring, before any sign-in', () {
    final cubit = SessionCubit(const FakeAuthPort());
    expect(cubit.state, const SessionState(phase: SessionPhase.restoring, signInCount: 0));
    cubit.close();
  });

  blocTest<SessionCubit, SessionState>(
    'a restored session ⇒ signed in, first sign-in',
    build: () => SessionCubit(const FakeAuthPort(restored: true)),
    act: (cubit) => cubit.restore(),
    expect: () => [_signedIn1],
  );

  blocTest<SessionCubit, SessionState>(
    'no stored session ⇒ signed out',
    build: () => SessionCubit(const FakeAuthPort()),
    act: (cubit) => cubit.restore(),
    expect: () => [const SessionState(phase: SessionPhase.signedOut)],
  );

  blocTest<SessionCubit, SessionState>(
    'restore throws ⇒ signed out (never stuck on the skeleton)',
    build: () => SessionCubit(_ScriptedAuthPort(restoreThrows: true)),
    act: (cubit) => cubit.restore(),
    expect: () => [const SessionState(phase: SessionPhase.signedOut)],
  );

  test('restore answering after close ⇒ no throw, no emit', () async {
    final auth = _ScriptedAuthPort();
    final cubit = SessionCubit(auth);
    final states = <SessionState>[];
    final sub = cubit.stream.listen(states.add);
    final restore = cubit.restore();
    await cubit.close();
    auth.restored.complete(true);
    await restore;
    expect(states, isEmpty);
    await sub.cancel();
  });

  blocTest<SessionCubit, SessionState>(
    'login, Quên mật khẩu and back move between the signed-out phases',
    build: () => SessionCubit(const FakeAuthPort()),
    seed: () => const SessionState(phase: SessionPhase.signedOut),
    act: (cubit) => cubit
      ..showForgotPassword()
      ..backToLogin()
      ..signedIn(),
    expect: () => [
      const SessionState(phase: SessionPhase.forgotPassword),
      const SessionState(phase: SessionPhase.signedOut),
      _signedIn1,
    ],
  );

  final expired = ValueNotifier<int>(0);
  blocTest<SessionCubit, SessionState>(
    'session expiry while signed in ⇒ signed out',
    build: () => SessionCubit(const FakeAuthPort(), sessionExpired: expired),
    seed: () => _signedIn1,
    act: (_) => expired.value++,
    expect: () => [_signedOut1],
  );

  for (final phase in [SessionPhase.signedOut, SessionPhase.forgotPassword, SessionPhase.restoring]) {
    blocTest<SessionCubit, SessionState>(
      'session expiry during ${phase.name} ⇒ nothing emitted',
      build: () => SessionCubit(const FakeAuthPort(), sessionExpired: expired),
      seed: () => SessionState(phase: phase),
      act: (_) => expired.value++,
      expect: () => const <SessionState>[],
    );
  }

  test('after close the expiry listener is gone (a bump neither throws nor emits)', () async {
    final signal = ValueNotifier<int>(0);
    final cubit = SessionCubit(const FakeAuthPort(restored: true), sessionExpired: signal);
    await cubit.restore();
    await cubit.close();
    expect(() => signal.value++, returnsNormally);
    expect(cubit.state, _signedIn1);
  });

  test('two logout taps while the first is pending ⇒ ONE logout call, then signed out', () async {
    final auth = _ScriptedAuthPort();
    final cubit = SessionCubit(auth)..signedIn();
    final first = cubit.logout();
    final second = cubit.logout();
    await second;
    expect(auth.logouts, 1);
    expect(cubit.state.phase, SessionPhase.signedIn);
    auth.loggedOut.complete();
    await first;
    expect(cubit.state, _signedOut1);
    // The flag resets: a later sign-out sends again.
    auth.loggedOut = Completer<void>()..complete();
    await (cubit..signedIn()).logout();
    expect(auth.logouts, 2);
    await cubit.close();
  });

  test('a failing logout still ends signed out, and the error reaches the caller', () async {
    final auth = _ScriptedAuthPort();
    final cubit = SessionCubit(auth)..signedIn();
    final logout = cubit.logout();
    auth.loggedOut.completeError(StateError('offline'));
    await expectLater(logout, throwsStateError);
    expect(cubit.state, _signedOut1);
    await cubit.close();
  });

  test('logout answering after close ⇒ no throw, no emit', () async {
    final auth = _ScriptedAuthPort();
    final cubit = SessionCubit(auth)..signedIn();
    final states = <SessionState>[];
    final sub = cubit.stream.listen(states.add);
    final logout = cubit.logout();
    await cubit.close();
    auth.loggedOut.complete();
    await logout;
    expect(states, isEmpty);
    await sub.cancel();
  });

  blocTest<SessionCubit, SessionState>(
    'retrying /me bumps the sign-in count and keeps the phase',
    build: () => SessionCubit(const FakeAuthPort()),
    seed: () => _signedIn1,
    act: (cubit) => cubit.retryPermissions(),
    expect: () => [const SessionState(phase: SessionPhase.signedIn, signInCount: 2)],
  );
}
