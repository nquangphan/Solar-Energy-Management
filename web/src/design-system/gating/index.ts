// hand-authored — gating module barrel (Story 1.10). Parallel to
// components/index.ts and shell/index.ts. Exports the gating primitives + the
// stub permission set. Gating is UX only (AD-4); the permission registry is
// backend-owned and generated from code (AD-17) — `PERM`/`DEMO_PERMISSIONS` here
// are Epic 1 placeholders, swapped for `/me` in Epic 2.
//
// A11y note: the accessibility floor (touch target ≥44px) is a SIBLING concern,
// not part of this module — it ships as the standalone CSS layer
// `web/src/design-system/a11y/a11y.css`, which MUST load AFTER components.css +
// shell.css (it floors `.btn`/`.navlink`/… touch targets). No bundler entry
// exists in the repo yet (YAGNI) — that ordering note is the contract.

export { Gate } from './Gate';
export type { GateProps } from './Gate';

export { can, orderScope, filterNav, PERM, DEMO_PERMISSIONS } from './permissions';
export type { PermissionKey, PermissionSet } from './permissions';
