// hand-authored — web accounts port (Story 8.2, mirror Flutter
// mobile/lib/design_system/session/accounts_port.dart). The seam between the
// Phân quyền screen and `/accounts`.
//
// WHO MAY GRANT/EDIT WHAT ARRIVES COMPUTED (AD-2): `grantable` per permission,
// `editable` + `readOnlyReason` per account, and only the presets the caller can
// grant in full. The screen displays them; it never re-derives the escalation rules.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** One account with its stored permission set (`AccountPermissionSummaryDto`). */
export type AccountPermissionSummary = Schemas['AccountPermissionSummaryDto'];

/** The registry and presets as the caller sees them (`PermissionOptionsResponseDto`). */
export type PermissionOptions = Schemas['PermissionOptionsResponseDto'];

/** One registry permission (`PermissionOptionDto`). */
export type PermissionOption = Schemas['PermissionOptionDto'];

/** One role preset — default values only, never stored on the account (`RolePresetOptionDto`). */
export type RolePresetOption = Schemas['RolePresetOptionDto'];

/** Body of `POST /accounts` (`CreateAccountRequestDto`): `phone` raw as typed, `preset` loaded server-side. */
export type CreateAccountInput = Schemas['CreateAccountRequestDto'];

/** Body of `PUT /accounts/{id}` (`UpdateAccountRequestDto`): all four fields, no password. */
export type UpdateAccountInput = Schemas['UpdateAccountRequestDto'];

/**
 * The AD-5 error envelope the port rejects with. The account form renders `message`
 * verbatim and pins `fieldErrors` under the matching input — the client owns none of
 * these rules, so it owns no words for them.
 */
export interface AccountsPortError {
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

/** Injectable transport for the Phân quyền screen — a PORT, not an HTTP client. */
export interface AccountsPort {
  listAccounts(): Promise<AccountPermissionSummary[]>;
  getPermissionOptions(): Promise<PermissionOptions>;
  /**
   * Replaces the whole set. Rejects with the AD-5 error: 400 (unknown key or a
   * permission missing one it requires — `fieldErrors.permissions`), 403 (self,
   * escalation), 404.
   */
  updatePermissions(id: string, permissions: string[]): Promise<AccountPermissionSummary>;
  /**
   * Creates an account and loads its preset. Rejects with the AD-5 error: 400
   * (`fieldErrors` on displayName/phone/email/password/preset), 403 (a preset the caller
   * cannot grant in full), 409 (`fieldErrors.phone` / `.email` taken).
   */
  createAccount(input: CreateAccountInput): Promise<AccountPermissionSummary>;
  /**
   * Replaces the profile and active flag (`isActive: false` deactivates and revokes every
   * session). Rejects with the AD-5 error: 400 (`fieldErrors`), 403 (self, escalation),
   * 404, 409 (`fieldErrors.phone` / `.email` taken).
   */
  updateAccount(id: string, input: UpdateAccountInput): Promise<AccountPermissionSummary>;
}
