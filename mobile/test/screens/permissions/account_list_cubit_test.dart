// AccountListCubit (Story 8.2): the load phases, the backend's sentence on a
// refusal, the ticket that keeps a late answer off the screen, and a cubit
// closed while the port is still answering. Expected states are built field by
// field with the constructor; seeds carry every field off its default; each
// answer is a distinct instance.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';
import 'package:pns_mobile/screens/permissions/account_list_cubit.dart';
import 'package:pns_mobile/screens/permissions/account_list_state.dart';

import 'held_accounts_port.dart';

final List<AccountPermissionSummary> _seeded = [
  demoAccount(displayName: 'Seed'),
];
final List<AccountPermissionSummary> _first = [
  demoAccount(displayName: 'First'),
];
final List<AccountPermissionSummary> _late = [demoAccount(displayName: 'Late')];

void main() {
  test('starts loading with no accounts', () {
    final cubit = AccountListCubit(FakeAccountsPort());
    expect(cubit.state, const AccountListState());
    cubit.close();
  });

  final HeldAccountsPort held = HeldAccountsPort();

  blocTest<AccountListCubit, AccountListState>(
    'a reload keeps the rows shown, clears the error, then shows the new rows',
    build: () => AccountListCubit(held),
    seed: () => AccountListState(
      status: AccountListStatus.error,
      accounts: _seeded,
      errorMessage: 'old',
    ),
    act: (cubit) async {
      final f = cubit.load();
      held.lists.last.complete(_first);
      await f;
    },
    expect: () => [
      AccountListState(
        status: AccountListStatus.loading,
        accounts: _seeded,
        errorMessage: null,
      ),
      AccountListState(
        status: AccountListStatus.ready,
        accounts: _first,
        errorMessage: null,
      ),
    ],
  );

  blocTest<AccountListCubit, AccountListState>(
    'a refusal shows the backend sentence and keeps the rows',
    build: () => AccountListCubit(held),
    seed: () =>
        AccountListState(status: AccountListStatus.ready, accounts: _seeded),
    act: (cubit) async {
      final f = cubit.load();
      held.lists.last.completeError(
        const AccountsPortException('Bạn không có quyền.'),
      );
      await f;
    },
    expect: () => [
      AccountListState(status: AccountListStatus.loading, accounts: _seeded),
      AccountListState(
        status: AccountListStatus.error,
        accounts: _seeded,
        errorMessage: 'Bạn không có quyền.',
      ),
    ],
  );

  blocTest<AccountListCubit, AccountListState>(
    'any other failure shows the generic sentence',
    build: () => AccountListCubit(held),
    act: (cubit) async {
      final f = cubit.load();
      held.lists.last.completeError(StateError('boom'));
      await f;
    },
    expect: () => [
      const AccountListState(),
      const AccountListState(
        status: AccountListStatus.error,
        errorMessage: kAccountListLoadError,
      ),
    ],
  );

  blocTest<AccountListCubit, AccountListState>(
    'a late answer to an older load is dropped',
    build: () => AccountListCubit(held),
    act: (cubit) async {
      final older = cubit.load();
      final newer = cubit.load();
      final n = held.lists.length;
      held.lists[n - 1].complete(_first);
      await newer;
      held.lists[n - 2].complete(_late);
      await older;
    },
    expect: () => [
      const AccountListState(),
      AccountListState(status: AccountListStatus.ready, accounts: _first),
    ],
  );

  blocTest<AccountListCubit, AccountListState>(
    'an older load failing after the newer one answered is dropped',
    build: () => AccountListCubit(held),
    act: (cubit) async {
      final older = cubit.load();
      final newer = cubit.load();
      final n = held.lists.length;
      held.lists[n - 1].complete(_first);
      await newer;
      held.lists[n - 2].completeError(
        const AccountsPortException('stale failure'),
      );
      await older;
    },
    expect: () => [
      const AccountListState(),
      AccountListState(status: AccountListStatus.ready, accounts: _first),
    ],
  );

  test(
    'closed while loading: a late success or failure emits nothing and does not throw',
    () async {
      for (final bool fail in [false, true]) {
        final port = HeldAccountsPort();
        final cubit = AccountListCubit(port);
        final states = <AccountListState>[];
        final sub = cubit.stream.listen(states.add);
        final f = cubit.load();
        await Future<void>.delayed(Duration.zero);
        final int before = states.length;
        await cubit.close();
        fail
            ? port.lists.last.completeError(StateError('x'))
            : port.lists.last.complete(_first);
        await f;
        await sub.cancel();
        expect(states, hasLength(before));
      }
    },
  );
}
