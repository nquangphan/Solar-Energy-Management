// hand-authored — mobile accounts port (Story 8.2, mirror web
// web/src/design-system/session/accounts-port.ts). The seam between the
// Phân quyền screens and `GET /accounts`, `GET /accounts/permission-options`,
// `PUT /accounts/{id}/permissions`, and the account form's `POST /accounts` and
// `PUT /accounts/{id}` (Story 8.3).
//
// WHO MAY DO WHAT ARRIVES COMPUTED (AD-2): `grantable` per permission,
// `editable` + `readOnlyReason` per account, and the presets already filtered
// to the ones the caller may grant. The screens only display them.
//
// Every data type below is the GENERATED contract type (AD-12).

import '../../api/generated/models/account_permission_summary_dto.dart';
import '../../api/generated/models/create_account_request_dto.dart';
import '../../api/generated/models/permission_option_dto.dart';
import '../../api/generated/models/permission_options_response_dto.dart';
import '../../api/generated/models/permission_transition_dto.dart';
import '../../api/generated/models/role_preset_option_dto.dart';
import '../../api/generated/models/update_account_request_dto.dart';

export '../../api/generated/models/role_preset.dart';

/// One account with its stored permission set and what the caller may do with it.
typedef AccountPermissionSummary = AccountPermissionSummaryDto;

/// The registry (labels, grouping order, dependencies, grantable) plus the presets.
typedef PermissionOptions = PermissionOptionsResponseDto;

/// One registry permission as the caller sees it.
typedef PermissionOption = PermissionOptionDto;

/// One order transition-table edge a permission gates (`event`, `from`, `to`).
typedef PermissionTransition = PermissionTransitionDto;

/// One role preset: default values loaded into the draft, never stored.
typedef RolePresetOption = RolePresetOptionDto;

/// Body of `POST /accounts`: `phone` raw as typed, `preset` loaded server-side.
typedef CreateAccountInput = CreateAccountRequestDto;

/// Body of `PUT /accounts/{id}`: all four fields, no password.
typedef UpdateAccountInput = UpdateAccountRequestDto;

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

  /// Creates an account and loads its preset. Throws [AccountsPortException]:
  /// 400/409 with `fieldErrors` (displayName, phone, email, password, preset),
  /// 403 for a preset the caller cannot grant in full.
  Future<AccountPermissionSummary> createAccount(CreateAccountInput input);

  /// Replaces the profile and active flag of [id] (`isActive: false` revokes
  /// every session). Throws [AccountsPortException]: 400/409 with `fieldErrors`,
  /// 403 (self, escalation), 404.
  Future<AccountPermissionSummary> updateAccount(
    String id,
    UpdateAccountInput input,
  );
}
