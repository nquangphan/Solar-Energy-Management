// PermissionsCubit (Story 11.1): `/me` → the gating permission set, and nothing
// emitted once the provider that owned it is gone.
import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/session.dart';

class _ThrowingMePort implements MePort {
  @override
  Future<MeResponse> fetchMe() async => throw StateError('offline');
}

class _PendingMePort implements MePort {
  final Completer<MeResponse> reply = Completer<MeResponse>();

  @override
  Future<MeResponse> fetchMe() => reply.future;
}

void main() {
  test('starts loading with no permissions and no identity', () {
    final cubit = PermissionsCubit(const FakeMePort());
    expect(cubit.state, const PermissionsState());
    expect(cubit.state.status, SessionStatus.loading);
    expect(cubit.state.perms, isEmpty);
    expect(cubit.state.me, isNull);
    cubit.close();
  });

  blocTest<PermissionsCubit, PermissionsState>(
    '/me answers ⇒ ready with the mapped set and the identity',
    build: () => PermissionsCubit(const FakeMePort()),
    act: (cubit) => cubit.load(),
    expect: () => [
      PermissionsState(status: SessionStatus.ready, perms: toPermissionSet(kDemoMe), me: kDemoMe),
    ],
  );

  blocTest<PermissionsCubit, PermissionsState>(
    '/me fails ⇒ error, no permissions, no identity',
    build: () => PermissionsCubit(_ThrowingMePort()),
    act: (cubit) => cubit.load(),
    expect: () => [const PermissionsState(status: SessionStatus.error)],
  );

  test('/me answering after close ⇒ no throw, no emit', () async {
    final port = _PendingMePort();
    final cubit = PermissionsCubit(port);
    final states = <PermissionsState>[];
    final sub = cubit.stream.listen(states.add);
    final load = cubit.load();
    await cubit.close();
    port.reply.complete(kDemoMe);
    await load;
    expect(states, isEmpty);
    await sub.cancel();
  });

  test('/me failing after close ⇒ no throw, no emit', () async {
    final port = _PendingMePort();
    final cubit = PermissionsCubit(port);
    final states = <PermissionsState>[];
    final sub = cubit.stream.listen(states.add);
    final load = cubit.load();
    await cubit.close();
    port.reply.completeError(StateError('offline'));
    await load;
    expect(states, isEmpty);
    await sub.cancel();
  });
}
