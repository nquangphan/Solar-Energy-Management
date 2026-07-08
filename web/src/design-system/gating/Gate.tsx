// hand-authored — web gating primitive (Story 1.10, mirror Flutter
// mobile/lib/design_system/gating/app_gate.dart `AppGate`).
import type { ReactNode } from 'react';

import { can } from './permissions';
import type { PermissionKey, PermissionSet } from './permissions';

export interface GateProps {
  /** The effective permission set (Epic 1 = stub, Epic 2 = `/me`). */
  perms: PermissionSet;
  /** The permission key the children require. */
  requires: PermissionKey;
  children: ReactNode;
}

/**
 * Renders `children` only when `perms` includes `requires`; otherwise renders
 * NOTHING (returns `null`). A gated-out surface simply DISAPPEARS — there is no
 * "blocked" screen, no greyed/`disabled` control, no `opacity`/`pointer-events`
 * (UX-DR-22).
 *
 * This is UX gating ONLY (AD-4): the backend enforces every request regardless.
 * Hiding a control here is convenience, never a security boundary.
 */
export function Gate({ perms, requires, children }: GateProps) {
  return can(perms, requires) ? <>{children}</> : null;
}
