// hand-authored — one account's permission matrix (Story 8.2). Reads and saves
// through the injected [AccountsPort]. Ticking and applying a preset only change
// the draft; Lưu sends the whole draft. Who may grant/edit what comes from the
// backend (`grantable`, `editable`) — never decided here.

import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/accounts_port.dart';
import 'account_permissions_state.dart';

const String kAccountPermissionsLoadError =
    'Không tải được quyền của tài khoản.';
const String kAccountPermissionsSaveError = 'Không lưu được quyền.';

class AccountPermissionsCubit extends Cubit<AccountPermissionsState> {
  AccountPermissionsCubit(this._port, this._accountId)
    : super(const AccountPermissionsState());

  final AccountsPort _port;
  final String _accountId;

  int _ticket = 0;

  /// [silent]: keep the current matrix on screen until the reply (coming back
  /// from the account form) instead of the loading skeleton.
  Future<void> load({bool silent = false}) async {
    final int ticket = ++_ticket;
    if (!silent) emit(const AccountPermissionsState());
    try {
      final (
        List<AccountPermissionSummary> accounts,
        PermissionOptions options,
      ) = await (
        _port.listAccounts(),
        _port.getPermissionOptions(),
      ).wait;
      if (isClosed || ticket != _ticket) return;
      final AccountPermissionSummary? account = accounts
          .where((a) => a.id == _accountId)
          .firstOrNull;
      if (account == null) {
        emit(
          const AccountPermissionsState(
            status: AccountPermissionsStatus.error,
            errorMessage: 'Không tìm thấy tài khoản.',
          ),
        );
        return;
      }
      emit(
        AccountPermissionsState(
          status: AccountPermissionsStatus.ready,
          account: account,
          options: options,
          draft: {...account.permissions},
        ),
      );
    } catch (e) {
      if (isClosed || ticket != _ticket) return;
      // `.wait` on a record wraps each failure in an AsyncError; show the first one.
      final Object error =
          e is ParallelWaitError<Object?, (AsyncError?, AsyncError?)>
          ? (e.errors.$1?.error ?? e.errors.$2?.error ?? e)
          : e;
      emit(
        AccountPermissionsState(
          status: AccountPermissionsStatus.error,
          errorMessage: error is AccountsPortException
              ? error.message
              : kAccountPermissionsLoadError,
        ),
      );
    }
  }

  void toggle(String key, bool checked) {
    if (state.status != AccountPermissionsStatus.ready || state.saving) return;
    _setDraft(
      checked ? {...state.draft, key} : ({...state.draft}..remove(key)),
      saveError: state.saveError,
    );
  }

  /// Loads the preset's values into the draft only — nothing is sent. A previous
  /// save error no longer describes the new draft, so it is cleared (as on web).
  void applyPreset(RolePresetOption preset) {
    if (state.status != AccountPermissionsStatus.ready || state.saving) return;
    _setDraft({...preset.permissions}, saveError: null);
  }

  void _setDraft(Set<String> draft, {required String? saveError}) => emit(
    AccountPermissionsState(
      status: state.status,
      account: state.account,
      options: state.options,
      draft: draft,
      saving: state.saving,
      saveError: saveError,
      errorMessage: state.errorMessage,
    ),
  );

  Future<void> save() async {
    final AccountPermissionSummary? account = state.account;
    if (account == null || !state.canSave) return;
    final Set<String> draft = state.draft;
    emit(
      AccountPermissionsState(
        status: state.status,
        account: account,
        options: state.options,
        draft: draft,
        saving: true,
        errorMessage: state.errorMessage,
      ),
    );
    try {
      // Only registry keys the matrix shows (as on web): a stale stored key that is
      // no longer in the registry has no box to untick and would make every save 400.
      final AccountPermissionSummary saved = await _port
          .updatePermissions(account.id, [
            for (final PermissionOption option in state.options!.permissions)
              if (draft.contains(option.key)) option.key,
          ]);
      if (isClosed) return;
      emit(
        AccountPermissionsState(
          status: state.status,
          account: saved,
          options: state.options,
          draft: {...saved.permissions},
          saved: true,
          errorMessage: state.errorMessage,
        ),
      );
    } catch (e) {
      if (isClosed) return;
      emit(
        AccountPermissionsState(
          status: state.status,
          account: state.account,
          options: state.options,
          draft: state.draft,
          saveError: e is AccountsPortException
              ? e.message
              : kAccountPermissionsSaveError,
          errorMessage: state.errorMessage,
        ),
      );
    }
  }
}
