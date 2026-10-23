// AccountFormCubit (Story 8.3): load (create reads the presets, edit picks the
// account by id; a missing or read-only account is unavailable; a stale reply
// never paints), the taps (preset, active flag) carrying every other field, and
// the save (raw values + preset key / four fields; a refusal keeps the choices and
// pins the backend's field errors; a cubit closed while the port answers emits
// nothing). Expected states are built field by field with the constructor; seeds
// carry every field off its default; the held port answers each call separately.
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/session/accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';
import 'package:pns_mobile/screens/permissions/account_form_cubit.dart';
import 'package:pns_mobile/screens/permissions/account_form_state.dart';

import 'held_accounts_port.dart';

final AccountPermissionSummary _inactive = demoAccount(isActive: false);
final RolePresetOption _tho = kDemoPresets.first;
final RolePresetOption _keToan = kDemoPresets.last;

/// A create-mode ready state with every field off its default (saving excepted).
AccountFormState _createSeed() => AccountFormState(
  status: AccountFormStatus.ready,
  presets: kDemoPresets,
  preset: _keToan,
  isActive: false,
  fieldErrors: const {'phone': 'old phone error'},
  formError: 'old form error',
  errorMessage: 'old message',
);

/// An edit-mode ready state with every field off its default (saving excepted).
AccountFormState _editSeed() => AccountFormState(
  status: AccountFormStatus.ready,
  presets: kDemoPresets,
  preset: _keToan,
  isActive: false,
  account: _inactive,
  fieldErrors: const {'phone': 'old phone error'},
  formError: 'old form error',
  errorMessage: 'old message',
);

Future<String?> _saveTyped(AccountFormCubit cubit) => cubit.save(
  displayName: 'Phạm Văn E',
  phone: '0912 345 678',
  email: 'e@local.test',
  password: 'MatKhau123',
);

void main() {
  late HeldAccountsPort port;
  setUp(() => port = HeldAccountsPort());

  test('starts loading with nothing', () {
    final cubit = AccountFormCubit(FakeAccountsPort(), null);
    expect(cubit.state, const AccountFormState());
    cubit.close();
  });

  group('load', () {
    blocTest<AccountFormCubit, AccountFormState>(
      'create: the presets the backend offers, nothing chosen, active by default',
      build: () => AccountFormCubit(port, null),
      seed: _createSeed,
      act: (cubit) async {
        final f = cubit.load();
        port.options.last.complete(demoOptions());
        await f;
      },
      expect: () => [
        const AccountFormState(),
        const AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'edit: the account picked by id, its active flag loaded',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      seed: _editSeed,
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.complete([demoAccount(id: 'other'), _inactive]);
        await f;
      },
      expect: () => [
        const AccountFormState(),
        AccountFormState(
          status: AccountFormStatus.ready,
          isActive: false,
          account: _inactive,
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'edit: a read-only account ⇒ unavailable with the backend reason',
      build: () => AccountFormCubit(port, kDemoSelfId),
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.complete([
          demoAccount(
            id: kDemoSelfId,
            editable: false,
            readOnlyReason: 'Đây là tài khoản của bạn.',
          ),
        ]);
        await f;
      },
      expect: () => [
        const AccountFormState(),
        const AccountFormState(
          status: AccountFormStatus.unavailable,
          errorMessage: 'Đây là tài khoản của bạn.',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'edit: an id missing from the list ⇒ unavailable without a reason',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.complete([demoAccount(id: 'other')]);
        await f;
      },
      expect: () => [
        const AccountFormState(),
        const AccountFormState(status: AccountFormStatus.unavailable),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'a refusal shows the backend sentence',
      build: () => AccountFormCubit(port, null),
      act: (cubit) async {
        final f = cubit.load();
        port.options.last.completeError(
          const AccountsPortException('Bạn không có quyền.'),
        );
        await f;
      },
      expect: () => [
        const AccountFormState(),
        const AccountFormState(
          status: AccountFormStatus.error,
          errorMessage: 'Bạn không có quyền.',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'any other failure shows the generic sentence',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      act: (cubit) async {
        final f = cubit.load();
        port.lists.last.completeError(StateError('boom'));
        await f;
      },
      expect: () => [
        const AccountFormState(),
        const AccountFormState(
          status: AccountFormStatus.error,
          errorMessage: kAccountFormLoadError,
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'a stale reply (first load answering after the second) never paints',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      act: (cubit) async {
        final first = cubit.load();
        final second = cubit.load();
        port.lists[1].complete([_inactive]);
        await second;
        port.lists[0].complete([demoAccount(displayName: 'stale')]);
        await first;
      },
      expect: () => [
        const AccountFormState(),
        AccountFormState(
          status: AccountFormStatus.ready,
          isActive: false,
          account: _inactive,
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'closed before the reply ⇒ nothing more is emitted (success and failure)',
      build: () => AccountFormCubit(port, null),
      act: (cubit) async {
        final f = cubit.load();
        await cubit.close();
        port.options.last.complete(demoOptions());
        await f;
        final g = AccountFormCubit(port, null);
        final h = g.load();
        await g.close();
        port.options.last.completeError(StateError('late'));
        await h;
      },
      expect: () => [const AccountFormState()],
    );
  });

  group('taps', () {
    blocTest<AccountFormCubit, AccountFormState>(
      'choosePreset changes only the preset',
      build: () => AccountFormCubit(port, null),
      seed: _createSeed,
      act: (cubit) => cubit.choosePreset(_tho),
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _tho,
          isActive: false,
          fieldErrors: const {'phone': 'old phone error'},
          formError: 'old form error',
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'setActive changes only the flag (edit mode keeps the account)',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      seed: _editSeed,
      act: (cubit) => cubit.setActive(true),
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: true,
          account: _inactive,
          fieldErrors: const {'phone': 'old phone error'},
          formError: 'old form error',
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'taps are ignored while saving or before the form is ready',
      build: () => AccountFormCubit(port, null),
      seed: () => AccountFormState(
        status: AccountFormStatus.ready,
        presets: kDemoPresets,
        preset: _keToan,
        saving: true,
      ),
      act: (cubit) {
        cubit.choosePreset(_tho);
        cubit.setActive(false);
        cubit.emit(const AccountFormState());
        cubit.choosePreset(_tho);
        cubit.setActive(false);
      },
      expect: () => [const AccountFormState()],
    );
  });

  group('save', () {
    blocTest<AccountFormCubit, AccountFormState>(
      'create sends the raw values with the preset key; errors clear while saving; answers the new id',
      build: () => AccountFormCubit(port, null),
      seed: _createSeed,
      act: (cubit) async {
        final f = _saveTyped(cubit);
        port.accountWrites.last.complete(demoAccount(id: 'new-7'));
        expect(await f, 'new-7');
        expect(port.createCalls.single.toJson(), {
          'displayName': 'Phạm Văn E',
          'phone': '0912 345 678',
          'email': 'e@local.test',
          'password': 'MatKhau123',
          'preset': 'KE_TOAN',
          'isActive': false,
        });
      },
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          saving: true,
          errorMessage: 'old message',
        ),
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'edit sends exactly the four fields of that account',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      seed: _editSeed,
      act: (cubit) async {
        final f = _saveTyped(cubit);
        port.accountWrites.last.complete(_inactive);
        expect(await f, kDemoWorkerId);
        final (String id, UpdateAccountInput input) =
            port.updateAccountCalls.single;
        expect(id, kDemoWorkerId);
        expect(input.toJson(), {
          'displayName': 'Phạm Văn E',
          'phone': '0912 345 678',
          'email': 'e@local.test',
          'isActive': false,
        });
        expect(port.createCalls, isEmpty);
      },
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          account: _inactive,
          saving: true,
          errorMessage: 'old message',
        ),
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          account: _inactive,
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'create without a preset sends nothing',
      build: () => AccountFormCubit(port, null),
      seed: () => const AccountFormState(
        status: AccountFormStatus.ready,
        presets: kDemoPresets,
      ),
      act: (cubit) async {
        expect(await _saveTyped(cubit), isNull);
        expect(port.createCalls, isEmpty);
      },
      expect: () => const <AccountFormState>[],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'a 409 pins the field error, keeps the choices, answers null',
      build: () => AccountFormCubit(port, null),
      seed: _createSeed,
      act: (cubit) async {
        final f = _saveTyped(cubit);
        port.accountWrites.last.completeError(
          const AccountsPortException(
            'Số điện thoại đã thuộc tài khoản khác.',
            fieldErrors: {'phone': 'Số điện thoại đã thuộc tài khoản khác.'},
          ),
        );
        expect(await f, isNull);
      },
      skip: 1,
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          fieldErrors: const {
            'phone': 'Số điện thoại đã thuộc tài khoản khác.',
          },
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'a refusal without a field becomes the form error',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      seed: _editSeed,
      act: (cubit) async {
        final f = _saveTyped(cubit);
        port.accountWrites.last.completeError(
          const AccountsPortException(
            'Không thể tự sửa tài khoản của chính mình.',
          ),
        );
        await f;
      },
      skip: 1,
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          account: _inactive,
          formError: 'Không thể tự sửa tài khoản của chính mình.',
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'a field error on no input of the form (edit has no password) becomes the form error too',
      build: () => AccountFormCubit(port, kDemoWorkerId),
      seed: _editSeed,
      act: (cubit) async {
        final f = _saveTyped(cubit);
        port.accountWrites.last.completeError(
          const AccountsPortException(
            'Không đổi mật khẩu ở đây.',
            fieldErrors: {'password': 'Không đổi mật khẩu ở đây.'},
          ),
        );
        await f;
      },
      skip: 1,
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          account: _inactive,
          fieldErrors: const {'password': 'Không đổi mật khẩu ở đây.'},
          formError: 'Không đổi mật khẩu ở đây.',
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'any other failure becomes the generic form error',
      build: () => AccountFormCubit(port, null),
      seed: _createSeed,
      act: (cubit) async {
        final f = _saveTyped(cubit);
        port.accountWrites.last.completeError(StateError('boom'));
        await f;
      },
      skip: 1,
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          formError: kAccountFormSaveError,
          errorMessage: 'old message',
        ),
      ],
    );

    blocTest<AccountFormCubit, AccountFormState>(
      'closed before the save answers ⇒ null and nothing more (success and failure)',
      build: () => AccountFormCubit(port, null),
      seed: _createSeed,
      act: (cubit) async {
        final f = _saveTyped(cubit);
        await cubit.close();
        port.accountWrites.last.complete(demoAccount(id: 'late'));
        expect(await f, isNull);
        final other = AccountFormCubit(port, null)..emit(_createSeed());
        final g = _saveTyped(other);
        await other.close();
        port.accountWrites.last.completeError(StateError('late'));
        expect(await g, isNull);
      },
      expect: () => [
        AccountFormState(
          status: AccountFormStatus.ready,
          presets: kDemoPresets,
          preset: _keToan,
          isActive: false,
          saving: true,
          errorMessage: 'old message',
        ),
      ],
    );
  });
}
