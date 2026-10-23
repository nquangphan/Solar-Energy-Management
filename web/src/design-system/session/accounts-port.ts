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
}
