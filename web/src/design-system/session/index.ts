// hand-authored — session module barrel (Story 2.6). Parallel to gating/index.ts
// and shell/index.ts. Exports the seam that binds `/me` (Story 2.5) to the gating
// `PermissionSet`: port + mapping + provider/hook + the test/demo fake port.
//
// Gating is UX only (AD-4); this layer holds no business logic and touches no DB
// (AD-1/2). The registry is backend-owned (AD-17) — the provider only maps the
// `/me` payload the backend returns.

export type { MePort, MeResponse } from './me-port';
export { toPermissionSet } from './session';
export type { SessionStatus } from './session';
export { PermissionsProvider, usePermissionsContext } from './PermissionsProvider';
export type { PermissionsState, PermissionsProviderProps } from './PermissionsProvider';
export { usePermissions } from './use-permissions';
export type { UsePermissions } from './use-permissions';
export { SessionGatingExample } from './SessionGatingExample';

// TEST/DEMO-ONLY — not a real session source (see fake-me-port.ts).
export { FakeMePort, DEMO_ME } from './fake-me-port';
