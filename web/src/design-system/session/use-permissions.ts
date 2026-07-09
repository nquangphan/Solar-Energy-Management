// hand-authored — web permission hook (Story 2.6). The public selector over
// `PermissionsProvider`: consumers read the effective set + the derived order
// scope from ONE place instead of the Epic 1 `DEMO_PERMISSIONS` stub.
//
// GATING IS UX ONLY (AD-4): the returned `perms`/`orderScope` decide what the UI
// shows; the backend enforces every request (Story 2.5).

import type { PermissionSet } from '../gating/permissions';
import { orderScope } from '../gating/permissions';
import { usePermissionsContext } from './PermissionsProvider';
import type { MeResponse } from './me-port';
import type { SessionStatus } from './session';

export interface UsePermissions {
  status: SessionStatus;
  perms: PermissionSet;
  /** Order-list scope selector (AC-3, FR-18): `'all'` vs `'mine'`, ready for Epic 5. */
  orderScope: 'all' | 'mine';
  /** Raw `/me` identity for the Hồ sơ screen (Story 2.8); `null` unless `status === 'ready'`. */
  me: MeResponse | null;
}

/**
 * Returns the effective permission set + derived `orderScope` from the session
 * provider. Signature-stable wrapper: `orderScope` here is the SAME pure
 * `orderScope(perms)` from the gating primitive (Story 1.10) — only its SOURCE
 * changed from stub to `/me`. Story 2.8 adds `me` ADDITIVELY: no existing caller
 * of `perms`/`orderScope` changes.
 */
export function usePermissions(): UsePermissions {
  const { status, perms, me } = usePermissionsContext();
  return { status, perms, orderScope: orderScope(perms), me };
}
