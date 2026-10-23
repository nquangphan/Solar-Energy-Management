// hand-authored — one account's permission matrix (Story 8.2), held by
// AccountPermissionsCubit. The draft is the set being edited; [account] is what
// the backend has stored. Applying a preset only changes the draft.

import 'package:equatable/equatable.dart';

import '../../design_system/session/accounts_port.dart';

enum AccountPermissionsStatus { loading, ready, error }

final class AccountPermissionsState extends Equatable {
  const AccountPermissionsState({
    this.status = AccountPermissionsStatus.loading,
    this.account,
    this.options,
    this.draft = const <String>{},
    this.saving = false,
    this.saveError,
    this.saved = false,
    this.errorMessage,
  });

  final AccountPermissionsStatus status;

  /// The account as the backend stores it (and its `editable` flag).
  final AccountPermissionSummary? account;

  /// Registry entries (backend order) and the presets the caller may grant.
  final PermissionOptions? options;

  /// The ticks on screen, not yet saved.
  final Set<String> draft;

  final bool saving;

  /// The backend's sentence when the last save was refused; the draft is kept.
  final String? saveError;

  /// The last save succeeded and nothing was ticked since.
  final bool saved;

  /// Why the matrix could not be read.
  final String? errorMessage;

  /// The backend decides whether this account may be edited (AD-2).
  bool get editable => account?.editable ?? false;

  /// One sentence per ticked permission that lacks one it requires, in the
  /// backend's wording and order (by key, missing keys by key) — display of the
  /// `requires` data the backend sends, the save is refused there too.
  List<String> get dependencyGaps {
    final PermissionOptions? o = options;
    if (o == null) return const <String>[];
    final Map<String, String> labels = {
      for (final PermissionOption p in o.permissions) p.key: p.label,
    };
    final List<PermissionOption> held = [
      for (final PermissionOption p in o.permissions)
        if (draft.contains(p.key)) p,
    ]..sort((a, b) => a.key.compareTo(b.key));
    return [
      for (final PermissionOption p in held)
        if (p.requires.any((r) => !draft.contains(r)))
          '«${p.label}» cần thêm ${([for (final String r in p.requires)
            if (!draft.contains(r)) r]..sort()).map((r) => '«${labels[r] ?? r}»').join(', ')}.',
    ];
  }

  bool get canSave =>
      status == AccountPermissionsStatus.ready &&
      editable &&
      !saving &&
      dependencyGaps.isEmpty;

  @override
  List<Object?> get props => [
    status,
    account,
    options,
    draft,
    saving,
    saveError,
    saved,
    errorMessage,
  ];
}
