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
 * TODO(app-runtime/login-network): the real implementation attaches
 * `Authorization: Bearer <accessToken>` (Story 2.3) and parses the AD-5 error
 * envelope. It lands with the app-runtime; until then `FakeMePort` drives tests.
 */
export interface MePort {
  fetchMe(): Promise<MeResponse>;
}
