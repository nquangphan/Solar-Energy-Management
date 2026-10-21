// hand-authored — web session port (Story 2.6, mirror Flutter
// mobile/lib/design_system/session/me_port.dart). The seam between the UI gating
// layer and the `/me` endpoint (Story 2.5).
//
// GATING IS UX ONLY (AD-4): the permission set fetched here decides which
// surfaces the UI SHOWS; the backend enforces EVERY request regardless. A hidden
// nav item is convenience, never a security boundary.

import type { components } from '../../api/generated/schema';

/**
 * The `/me` payload — the generated `MeResponseDto` (AD-12: no hand-written
 * contract types). `permissions` is sorted, each element a key in
 * `backend/openapi/permissions.json`.
 */
export type MeResponse = components['schemas']['MeResponseDto'];

/**
 * Injectable transport for fetching `/me`. This is a PORT (a one-method
 * interface), NOT an HTTP client. The real adapter is `web/src/api/http-me-port.ts`
 * (wired in main.tsx); `FakeMePort` drives tests and demos.
 */
export interface MePort {
  fetchMe(): Promise<MeResponse>;
}
