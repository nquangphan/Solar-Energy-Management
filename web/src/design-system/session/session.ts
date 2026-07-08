// hand-authored — web session mapping (Story 2.6, mirror Flutter
// mobile/lib/design_system/session/app_session.dart).
//
// Maps the `/me` payload to the gating `PermissionSet`. This layer only MAPS and
// HOLDS permissions + calls the port — it derives NO permission and runs NO
// business logic (AD-1/2); the effective set is decided by the backend
// (Stories 2.4/2.5).

import type { PermissionSet, PermissionKey } from '../gating/permissions';
import type { MeResponse } from './me-port';

/** Provider status: awaiting `/me`, ready with perms, or the fetch failed. */
export type SessionStatus = 'loading' | 'ready' | 'error';

/**
 * Map the `/me` permission array to the gating `PermissionSet` (AD-12: "the FE
 * builds the PermissionSet from this array"). Pure — a new readonly Set.
 *
 * This set is for UX GATING ONLY (AD-4): the backend enforces every request
 * (Story 2.5). Never treat a hidden nav item / null-rendered `<Gate>` as access
 * control.
 */
export function toPermissionSet(me: MeResponse): PermissionSet {
  return new Set<PermissionKey>(me.permissions);
}
