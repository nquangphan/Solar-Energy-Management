// hand-authored — mobile accounts port (Story 8.2, mirror web
// web/src/design-system/session/accounts-port.ts). The seam between the
// Phân quyền screens and `GET /accounts`, `GET /accounts/permission-options`
// and `PUT /accounts/{id}/permissions`.
//
// WHO MAY DO WHAT ARRIVES COMPUTED (AD-2): `grantable` per permission,
// `editable` + `readOnlyReason` per account, and the presets already filtered
// to the ones the caller may grant. The screens only display them.
//
// Every data type below is the GENERATED contract type (AD-12).

import '../../api/generated/models/account_permission_summary_dto.dart';
import '../../api/generated/models/permission_option_dto.dart';
import '../../api/generated/models/permission_options_response_dto.dart';
import '../../api/generated/models/role_preset_option_dto.dart';

export '../../api/generated/models/role_preset.dart';

/// One account with its stored permission set and what the caller may do with it.
typedef AccountPermissionSummary = AccountPermissionSummaryDto;

/// The registry (labels, grouping order, dependencies, grantable) plus the presets.
typedef PermissionOptions = PermissionOptionsResponseDto;

/// One registry permission as the caller sees it.
typedef PermissionOption = PermissionOptionDto;

/// One role preset: default values loaded into the draft, never stored.
typedef RolePresetOption = RolePresetOptionDto;

class AccountsPortException implements Exception {
  const AccountsPortException(this.message, {this.fieldErrors = const {}});

  /// The backend's `message`, shown to the user as-is.
  final String message;

  /// `field` → `message`, flattened from the envelope's `fieldErrors[]`.
  final Map<String, String> fieldErrors;

  @override
  String toString() => message;
}

abstract class AccountsPort {
  Future<List<AccountPermissionSummary>> listAccounts();

  Future<PermissionOptions> getPermissionOptions();

  /// Replaces the whole set of [id]; answers the account as saved.
  Future<AccountPermissionSummary> updatePermissions(
    String id,
    List<String> permissions,
  );
}
