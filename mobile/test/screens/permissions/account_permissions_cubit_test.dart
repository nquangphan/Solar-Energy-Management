// AccountPermissionsCubit (Story 8.2): load (the account picked by id from the
// list, the options next to it), the draft (ticks and presets never call the
// port), the dependency gaps that disable Lưu for both combinations that 403
// mid-flow, the save (whole draft, sorted; a refusal keeps the draft), and a
// cubit closed while the port is still answering. Expected states are built
// field by field with the constructor; seeds carry every field off its default.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';
import 'package:pns_mobile/screens/permissions/account_permissions_cubit.dart';
import 'package:pns_mobile/screens/permissions/account_permissions_state.dart';

import 'held_accounts_port.dart';

const String _id = kDemoWorkerId;
final AccountPermissionSummary _account = demoAccount();
final AccountPermissionSummary _saved = demoAccount(
  permissions: const [
    AppPermissionKeys.catalogView,
    AppPermissionKeys.customersManage,
  ],
  matchingPreset: RolePreset.keToan,
  matchingPresetLabel: 'Kế toán',
);
final PermissionOptions _options = demoOptions();

const Set<String> _seedDraft = {
  AppPermissionKeys.customersManage,
  AppPermissionKeys.auditRead,
};

/// A ready state with every field off its default (saving excepted: it blocks edits).
AccountPermissionsState _seed({
  Set<String> draft = _seedDraft,
  AccountPermissionSummary? account,
}) => AccountPermissionsState(
  status: AccountPermissionsStatus.ready,
  account: account ?? _account,
  options: _options,
  draft: draft,
  saveError: 'old error',
  saved: true,
  errorMessage: 'old message',
);

void main() {
  test('starts loading with nothing', () {
    final cubit = AccountPermissionsCubit(FakeAccountsPort(), _id);
    expect(cubit.state, const AccountPermissionsState());
    cubit.close();
  });

  group('load', () {
    late HeldAccountsPort port;
    setUp(() => port = HeldAccountsPort());

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'picks the account by id; the draft starts as its stored set',
      build: () => AccountPermissionsCubit(port, _id),
      seed: () => _seed(),
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.complete([demoAccount(id: 'other'), _account]);
        port.options.last.complete(_options);
        await f;
      },
      expect: () => [
        const AccountPermissionsState(),
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: {..._account.permissions},
        ),
      ],
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'an id missing from the list ⇒ error',
      build: () => AccountPermissionsCubit(port, _id),
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.complete([demoAccount(id: 'other')]);
        port.options.last.complete(_options);
        await f;
      },
      expect: () => [
        const AccountPermissionsState(),
        const AccountPermissionsState(
          status: AccountPermissionsStatus.error,
          errorMessage: 'Không tìm thấy tài khoản.',
        ),
      ],
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'a refusal of either read shows the backend sentence',
      build: () => AccountPermissionsCubit(port, _id),
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.complete([_account]);
        port.options.last.completeError(
          const AccountsPortException('Bạn không có quyền.'),
        );
        await f;
      },
      expect: () => [
        const AccountPermissionsState(),
        const AccountPermissionsState(
          status: AccountPermissionsStatus.error,
          errorMessage: 'Bạn không có quyền.',
        ),
      ],
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'any other failure shows the generic sentence',
      build: () => AccountPermissionsCubit(port, _id),
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.completeError(StateError('boom'));
        port.options.last.complete(_options);
        await f;
      },
      expect: () => [
        const AccountPermissionsState(),
        const AccountPermissionsState(
          status: AccountPermissionsStatus.error,
          errorMessage: kAccountPermissionsLoadError,
        ),
      ],
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'a late answer to an older load is dropped',
      build: () => AccountPermissionsCubit(port, _id),
      act: (cubit) async {
        final older = cubit.load();
        final newer = cubit.load();
        port.lists[1].complete([_account]);
        port.options[1].complete(_options);
        await newer;
        port.lists[0].complete([_saved]);
        port.options[0].complete(demoOptions());
        await older;
      },
      expect: () => [
        const AccountPermissionsState(),
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: {..._account.permissions},
        ),
      ],
    );
  });

  group('load (stale failure)', () {
    late HeldAccountsPort port;
    setUp(() => port = HeldAccountsPort());

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'an older load failing after the newer one answered is dropped',
      build: () => AccountPermissionsCubit(port, _id),
      act: (cubit) async {
        final older = cubit.load();
        final newer = cubit.load();
        port.lists[1].complete([_account]);
        port.options[1].complete(_options);
        await newer;
        port.lists[0].completeError(
          const AccountsPortException('stale failure'),
        );
        port.options[0].complete(demoOptions());
        await older;
      },
      expect: () => [
        const AccountPermissionsState(),
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: {..._account.permissions},
        ),
      ],
    );
  });

  group('draft', () {
    final FakeAccountsPort fake = FakeAccountsPort();

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'ticking adds a key and keeps every other field (saved clears)',
      build: () => AccountPermissionsCubit(fake, _id),
      seed: () => _seed(),
      act: (cubit) => cubit.toggle(AppPermissionKeys.catalogView, true),
      expect: () => [
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: const {..._seedDraft, AppPermissionKeys.catalogView},
          saveError: 'old error',
          errorMessage: 'old message',
        ),
      ],
      verify: (_) => expect(fake.updateCalls, isEmpty),
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'unticking removes the key',
      build: () => AccountPermissionsCubit(fake, _id),
      seed: () => _seed(),
      act: (cubit) => cubit.toggle(AppPermissionKeys.auditRead, false),
      expect: () => [
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: const {AppPermissionKeys.customersManage},
          saveError: 'old error',
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'applying a preset loads its values into the draft only — the port is not called',
      build: () => AccountPermissionsCubit(fake, _id),
      seed: () => _seed(),
      act: (cubit) => cubit.applyPreset(kDemoPresets[1]),
      expect: () => [
        // The old save error described another draft: cleared (as on web).
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: {...kDemoPresets[1].permissions},
          errorMessage: 'old message',
        ),
      ],
      verify: (_) {
        expect(fake.updateCalls, isEmpty);
        expect(fake.listCalls, 0);
      },
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'edits are ignored while saving or not ready',
      build: () => AccountPermissionsCubit(fake, _id),
      seed: () => AccountPermissionsState(
        status: AccountPermissionsStatus.ready,
        account: _account,
        options: _options,
        draft: _seedDraft,
        saving: true,
      ),
      act: (cubit) {
        cubit.toggle(AppPermissionKeys.catalogView, true);
        cubit.applyPreset(kDemoPresets[0]);
      },
      expect: () => const <AccountPermissionsState>[],
    );
  });

  group('dependency gaps (Lưu disabled)', () {
    final FakeAccountsPort fake = FakeAccountsPort();
    test('settings.manage without customers.manage', () {
      final s = _seed(
        draft: const {
          AppPermissionKeys.settingsManage,
          AppPermissionKeys.catalogView,
        },
      );
      expect(s.dependencyGaps, [
        '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».',
      ]);
      expect(s.canSave, isFalse);
    });

    test('quotes.create_edit without customers.manage', () {
      final s = _seed(
        draft: const {
          AppPermissionKeys.quotesCreateEdit,
          AppPermissionKeys.catalogView,
        },
      );
      expect(s.dependencyGaps, [
        '«Tạo/sửa báo giá» cần thêm «Quản lý khách hàng».',
      ]);
      expect(s.canSave, isFalse);
    });

    test(
      'several gaps: sorted by key, missing keys by key, one sentence each',
      () {
        final s = _seed(
          draft: const {
            AppPermissionKeys.settingsManage,
            AppPermissionKeys.quotesCreateEdit,
          },
        );
        expect(s.dependencyGaps, [
          '«Tạo/sửa báo giá» cần thêm «Xem danh mục vật tư», «Quản lý khách hàng».',
          '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».',
        ]);
      },
    );

    test(
      'dependencies met ⇒ no gap, Lưu enabled; read-only account ⇒ Lưu disabled',
      () {
        final ok = _seed(
          draft: const {
            AppPermissionKeys.quotesCreateEdit,
            AppPermissionKeys.customersManage,
            AppPermissionKeys.catalogView,
          },
        );
        expect(ok.dependencyGaps, isEmpty);
        expect(ok.canSave, isTrue);
        expect(_seed(account: demoAccount(editable: false)).canSave, isFalse);
      },
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'save with a gap sends nothing',
      build: () => AccountPermissionsCubit(fake, _id),
      seed: () => _seed(draft: const {AppPermissionKeys.settingsManage}),
      act: (cubit) => cubit.save(),
      expect: () => const <AccountPermissionsState>[],
      verify: (_) => expect(fake.updateCalls, isEmpty),
    );
  });

  group('save', () {
    late HeldAccountsPort port;
    setUp(() => port = HeldAccountsPort());
    const Set<String> draft = {
      AppPermissionKeys.customersManage,
      AppPermissionKeys.catalogView,
    };

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'sends the whole draft in matrix order, then shows what the backend saved',
      build: () => AccountPermissionsCubit(port, _id),
      seed: () => _seed(draft: draft),
      act: (cubit) async {
        final f = cubit.save();
        port.updates.last.complete(_saved);
        await f;
      },
      expect: () => [
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: draft,
          saving: true,
          errorMessage: 'old message',
        ),
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _saved,
          options: _options,
          draft: {..._saved.permissions},
          saved: true,
          errorMessage: 'old message',
        ),
      ],
      verify: (_) {
        expect(port.updateCalls, hasLength(1));
        expect(port.updateCalls.single.$1, _id);
        expect(port.updateCalls.single.$2, [
          AppPermissionKeys.customersManage,
          AppPermissionKeys.catalogView,
        ]);
      },
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'the draft after a save is the backend reply, not what was sent',
      build: () => AccountPermissionsCubit(port, _id),
      seed: () => _seed(draft: draft),
      act: (cubit) async {
        final f = cubit.save();
        port.updates.last.complete(
          demoAccount(permissions: const [AppPermissionKeys.catalogView]),
        );
        await f;
      },
      skip: 1,
      verify: (cubit) =>
          expect(cubit.state.draft, {AppPermissionKeys.catalogView}),
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'a stored key outside the registry options is never sent back',
      build: () => AccountPermissionsCubit(port, _id),
      seed: () => _seed(draft: const {...draft, 'legacy.removed_key'}),
      act: (cubit) async {
        final f = cubit.save();
        port.updates.last.complete(_saved);
        await f;
      },
      verify: (_) => expect(port.updateCalls.single.$2, [
        AppPermissionKeys.customersManage,
        AppPermissionKeys.catalogView,
      ]),
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'a refusal shows the backend sentence and keeps the draft',
      build: () => AccountPermissionsCubit(port, _id),
      seed: () => _seed(draft: draft),
      act: (cubit) async {
        final f = cubit.save();
        port.updates.last.completeError(
          const AccountsPortException('Không thể cấp quyền bạn không có: x'),
        );
        await f;
      },
      skip: 1,
      expect: () => [
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: draft,
          saveError: 'Không thể cấp quyền bạn không có: x',
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'any other failure shows the generic sentence',
      build: () => AccountPermissionsCubit(port, _id),
      seed: () => _seed(draft: draft),
      act: (cubit) async {
        final f = cubit.save();
        port.updates.last.completeError(StateError('boom'));
        await f;
      },
      skip: 1,
      expect: () => [
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: _account,
          options: _options,
          draft: draft,
          saveError: kAccountPermissionsSaveError,
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountPermissionsCubit, AccountPermissionsState>(
      'a read-only account is never sent',
      build: () => AccountPermissionsCubit(port, _id),
      seed: () => _seed(draft: draft, account: demoAccount(editable: false)),
      act: (cubit) => cubit.save(),
      expect: () => const <AccountPermissionsState>[],
      verify: (_) => expect(port.updateCalls, isEmpty),
    );

    test(
      'closed while saving or loading: a late answer emits nothing and does not throw',
      () async {
        for (final bool fail in [false, true]) {
          final p = HeldAccountsPort();
          final cubit = AccountPermissionsCubit(p, _id);
          cubit.emit(_seed(draft: draft));
          final states = <AccountPermissionsState>[];
          final sub = cubit.stream.listen(states.add);
          final saving = cubit.save();
          final loading = cubit.load();
          await Future<void>.delayed(Duration.zero);
          final int before = states.length;
          await cubit.close();
          if (fail) {
            p.updates.last.completeError(StateError('x'));
            p.lists.last.completeError(StateError('x'));
          } else {
            p.updates.last.complete(_saved);
            p.lists.last.complete([_account]);
          }
          p.options.last.complete(_options);
          await saving;
          await loading;
          await sub.cancel();
          expect(states, hasLength(before));
        }
      },
    );
  });
}
