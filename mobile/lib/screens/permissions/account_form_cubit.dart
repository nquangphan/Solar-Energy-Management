// hand-authored — the account form (Story 8.3). Create mode reads the presets
// the caller may grant; edit mode reads the account from the list (no
// `GET /accounts/:id`). Saving sends the typed values RAW — the phone is
// normalized by the backend (AD-9), the password policy is the backend's — and
// its 400/409 `fieldErrors` come back per field, every typed value kept.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/accounts_port.dart';
import 'account_form_state.dart';

const String kAccountFormLoadError = 'Không tải được dữ liệu tài khoản.';
const String kAccountFormSaveError = 'Không lưu được tài khoản.';

/// The inputs the form renders, by the backend's field name.
const List<String> _profileFields = ['displayName', 'phone', 'email'];

List<String> _shownFields(AccountFormState state) =>
    state.editing ? _profileFields : [..._profileFields, 'password', 'preset'];

class AccountFormCubit extends Cubit<AccountFormState> {
  /// [accountId] absent ⇒ create; present ⇒ edit that account.
  AccountFormCubit(this._port, this._accountId)
    : super(const AccountFormState());

  final AccountsPort _port;
  final String? _accountId;

  int _ticket = 0;

  Future<void> load() async {
    final int ticket = ++_ticket;
    emit(const AccountFormState());
    try {
      final String? accountId = _accountId;
      if (accountId == null) {
        final PermissionOptions options = await _port.getPermissionOptions();
        if (isClosed || ticket != _ticket) return;
        emit(
          AccountFormState(
            status: AccountFormStatus.ready,
            presets: options.presets,
          ),
        );
        return;
      }
      final AccountPermissionSummary? account = (await _port.listAccounts())
          .where((a) => a.id == accountId)
          .firstOrNull;
      if (isClosed || ticket != _ticket) return;
      if (account == null || !account.editable) {
        emit(
          AccountFormState(
            status: AccountFormStatus.unavailable,
            errorMessage: account?.readOnlyReason,
          ),
        );
        return;
      }
      emit(
        AccountFormState(
          status: AccountFormStatus.ready,
          isActive: account.isActive,
          account: account,
        ),
      );
    } catch (e) {
      if (isClosed || ticket != _ticket) return;
      emit(
        AccountFormState(
          status: AccountFormStatus.error,
          errorMessage: e is AccountsPortException
              ? e.message
              : kAccountFormLoadError,
        ),
      );
    }
  }

  void choosePreset(RolePresetOption preset) {
    if (state.status != AccountFormStatus.ready || state.saving) return;
    _set(preset: preset, isActive: state.isActive);
  }

  void setActive(bool isActive) {
    if (state.status != AccountFormStatus.ready || state.saving) return;
    _set(preset: state.preset, isActive: isActive);
  }

  void _set({required RolePresetOption? preset, required bool isActive}) =>
      emit(
        AccountFormState(
          status: state.status,
          presets: state.presets,
          preset: preset,
          isActive: isActive,
          account: state.account,
          fieldErrors: state.fieldErrors,
          formError: state.formError,
          errorMessage: state.errorMessage,
        ),
      );

  /// Sends the form; answers the saved account's id, or null when the backend
  /// refused it (the errors are in the state) or the form closed meanwhile.
  Future<String?> save({
    required String displayName,
    required String phone,
    required String email,
    required String password,
  }) async {
    if (!state.canSave) return null;
    final AccountFormState before = state;
    emit(
      AccountFormState(
        status: before.status,
        presets: before.presets,
        preset: before.preset,
        isActive: before.isActive,
        account: before.account,
        saving: true,
        errorMessage: before.errorMessage,
      ),
    );
    try {
      final AccountPermissionSummary? account = before.account;
      final AccountPermissionSummary saved = account == null
          ? await _port.createAccount(
              CreateAccountInput(
                displayName: displayName,
                phone: phone,
                email: email,
                password: password,
                preset: before.preset!.key,
                isActive: before.isActive,
              ),
            )
          : await _port.updateAccount(
              account.id,
              UpdateAccountInput(
                displayName: displayName,
                phone: phone,
                email: email,
                isActive: before.isActive,
              ),
            );
      if (isClosed) return null;
      emit(
        AccountFormState(
          status: before.status,
          presets: before.presets,
          preset: before.preset,
          isActive: before.isActive,
          account: before.account,
          errorMessage: before.errorMessage,
        ),
      );
      return saved.id;
    } catch (e) {
      if (isClosed) return null;
      final Map<String, String> fieldErrors = e is AccountsPortException
          ? e.fieldErrors
          : const <String, String>{};
      emit(
        AccountFormState(
          status: before.status,
          presets: before.presets,
          preset: before.preset,
          isActive: before.isActive,
          account: before.account,
          fieldErrors: fieldErrors,
          // A refusal naming no input on screen (403, 404, or a field the
          // form does not show) goes in the banner.
          formError: fieldErrors.keys.any(_shownFields(before).contains)
              ? null
              : e is AccountsPortException
              ? e.message
              : kAccountFormSaveError,
          errorMessage: before.errorMessage,
        ),
      );
      return null;
    }
  }
}
