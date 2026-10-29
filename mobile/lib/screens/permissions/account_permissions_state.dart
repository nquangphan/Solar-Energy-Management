// hand-authored — one account's permission matrix (Story 8.2), held by
// AccountPermissionsCubit. The draft is the set being edited; [account] is what
// the backend has stored. Applying a preset only changes the draft.

import 'package:equatable/equatable.dart';

import '../../design_system/components/status_chip.dart';
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

  /// One sentence per ticked permission that lacks what it requires, in the
  /// backend's wording and order (by key; the AND part by key, then "một trong …"
  /// in `requiresAnyOf` order when none of that group is ticked) — display of
  /// the data the backend sends, the save is refused there too.
  List<String> get dependencyGaps {
    final PermissionOptions? o = options;
    if (o == null) return const <String>[];
    final Map<String, String> labels = {
      for (final PermissionOption p in o.permissions) p.key: p.label,
    };
    String quote(String key) => '«${labels[key] ?? key}»';
    final List<PermissionOption> held = [
      for (final PermissionOption p in o.permissions)
        if (draft.contains(p.key)) p,
    ]..sort((a, b) => a.key.compareTo(b.key));
    final List<String> gaps = [];
    for (final PermissionOption p in held) {
      final List<String> missing = [
        for (final String r in p.requires)
          if (!draft.contains(r)) r,
      ]..sort();
      final List<String> missingAnyOf = p.requiresAnyOf.any(draft.contains)
          ? const <String>[]
          : p.requiresAnyOf;
      if (missing.isEmpty && missingAnyOf.isEmpty) continue;
      final List<String> parts = [
        ...missing.map(quote),
        if (missingAnyOf.isNotEmpty)
          'một trong ${missingAnyOf.map(quote).join(', ')}',
      ];
      gaps.add('«${p.label}» cần thêm ${parts.join(', ')}.');
    }
    return gaps;
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

/// The order steps [option] gates, e.g. "Chuyển: Báo giá → Đã chốt · Chờ duyệt
/// → Đã chốt" — labels from the StatusChip map, an unknown status key shows
/// "—", a repeated `from → to` pair of status keys shows once. Null when it
/// gates no step.
String? permissionTransitionsLine(PermissionOption option) {
  String label(String raw) {
    final StatusKey? key = statusKeyOf(raw);
    return key == null ? '—' : kStatusLabels[key]!;
  }

  final Map<String, PermissionTransition> pairs = {
    for (final PermissionTransition t in option.transitions)
      '${t.from}\u0000${t.to}': t,
  };
  if (pairs.isEmpty) return null;
  return 'Chuyển: ${pairs.values.map((t) => '${label(t.from)} → ${label(t.to)}').join(' · ')}';
}
