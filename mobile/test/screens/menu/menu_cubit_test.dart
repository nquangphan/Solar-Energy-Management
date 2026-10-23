// MenuCubit (Story 11.1): the Đăng xuất button's "signing out" flag.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/screens/menu/menu_cubit.dart';

void main() {
  test('starts not signing out', () {
    final cubit = MenuCubit(() async {});
    expect(cubit.state, isFalse);
    cubit.close();
  });

  blocTest<MenuCubit, bool>(
    'logout ⇒ true while it runs, false once done',
    build: () => MenuCubit(() async {}),
    act: (cubit) => cubit.logout(),
    expect: () => [true, false],
  );

  blocTest<MenuCubit, bool>(
    'no logout callback ⇒ nothing happens',
    build: () => MenuCubit(null),
    act: (cubit) => cubit.logout(),
    expect: () => const <bool>[],
  );

  test('two taps while the first is pending ⇒ the callback runs once', () async {
    var calls = 0;
    final done = Completer<void>();
    final cubit = MenuCubit(() {
      calls++;
      return done.future;
    });
    final first = cubit.logout();
    await cubit.logout();
    expect(calls, 1);
    expect(cubit.state, isTrue);
    done.complete();
    await first;
    expect(cubit.state, isFalse);
    await cubit.close();
  });

  test('a failing logout still clears the flag, and the error reaches the caller', () async {
    final cubit = MenuCubit(() async => throw StateError('offline'));
    await expectLater(cubit.logout(), throwsStateError);
    expect(cubit.state, isFalse);
    await cubit.close();
  });

  test('logout finishing after close ⇒ no throw, no emit', () async {
    final done = Completer<void>();
    final cubit = MenuCubit(() => done.future);
    final logout = cubit.logout();
    final states = <bool>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.close();
    done.complete();
    await logout;
    expect(states, isEmpty);
    await sub.cancel();
  });
}
