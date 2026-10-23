// hand-authored — the account form (Story 8.3), held by AccountFormCubit. The
// typed values live in the screen's TextEditingControllers; this state holds
// what the backend sent (presets, the account being edited), the choices made
// with taps (preset, active flag) and the save's progress and errors.

import 'package:equatable/equatable.dart';

import '../../design_system/session/accounts_port.dart';

/// `unavailable` = edit mode on an account that is missing or not editable.
enum AccountFormStatus { loading, ready, error, unavailable }

final class AccountFormState extends Equatable {
  const AccountFormState({
    this.status = AccountFormStatus.loading,
    this.presets = const <RolePresetOption>[],
    this.preset,
    this.isActive = true,
    this.account,
    this.saving = false,
    this.fieldErrors = const <String, String>{},
    this.formError,
    this.errorMessage,
  });

  final AccountFormStatus status;

  /// Create mode: the presets the caller may grant in full (backend-filtered).
  final List<RolePresetOption> presets;

  /// Create mode: the chosen preset; none until the user picks one.
  final RolePresetOption? preset;

  final bool isActive;

  /// Edit mode: the account as loaded (initial values of the fields).
  final AccountPermissionSummary? account;

  final bool saving;

  /// The backend's field errors of the last save (`field` → sentence).
  final Map<String, String> fieldErrors;

  /// The backend's sentence when the last save failed without a field.
  final String? formError;

  /// Why the form could not load, or the backend's read-only reason.
  final String? errorMessage;

  bool get editing => account != null;

  /// Taps may still change the form; the text fields are checked by the screen.
  bool get canSave =>
      status == AccountFormStatus.ready &&
      !saving &&
      (editing || preset != null);

  @override
  List<Object?> get props => [
    status,
    presets,
    preset,
    isActive,
    account,
    saving,
    fieldErrors,
    formError,
    errorMessage,
  ];
}
