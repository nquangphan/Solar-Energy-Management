// hand-authored — web session port (Story 2.6, mirror Flutter
// mobile/lib/design_system/session/me_port.dart). The seam between the UI gating
// layer and the `/me` endpoint (Story 2.5).
//
// GATING IS UX ONLY (AD-4): the permission set fetched here decides which
// surfaces the UI SHOWS; the backend enforces EVERY request regardless. A hidden
// nav item is convenience, never a security boundary.

/**
 * The `/me` payload shape — MUST match the backend `MeResponseDto`
 * (Story 2.5: `{ id, email, displayName, permissions: string[] }`; `permissions`
 * is sorted, each element a key in `backend/openapi/permissions.json`).
 *
 * TODO(app-runtime): when the FE OpenAPI client is generated from `openapi.json`
 * (AD-12), replace this hand-written type with the generated `MeResponseDto`
 * type — do not hand-edit the spec.
 */
export interface MeResponse {
  id: string;
  email: string;
  displayName: string;
  permissions: string[];
}

/**
 * Injectable transport for fetching `/me`. This is a PORT (a one-method
 * interface), NOT an HTTP client — the seam that lets gating consume `/me`
 * without the app owning a bundler/router/token store yet.
 *
 * TODO(Story 10.4): the HTTP adapter goes through the generated client; the
 * transport (web/src/api/transport.ts, Story 10.3) already attaches the bearer
 * and parses the AD-5 envelope. Until then `FakeMePort` drives tests.
 */
export interface MePort {
  fetchMe(): Promise<MeResponse>;
}
