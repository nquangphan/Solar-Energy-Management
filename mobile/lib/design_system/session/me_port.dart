// hand-authored — mobile session port (Story 2.6, mirror web
// web/src/design-system/session/me-port.ts). The seam between the UI gating
// layer and the `/me` endpoint (Story 2.5).
//
// GATING IS UX ONLY (AD-4): the permission set fetched here decides which
// surfaces the UI SHOWS; the backend enforces EVERY request regardless. A hidden
// nav item is convenience, never a security boundary.

import '../../api/generated/models/me_response_dto.dart';

/// The `/me` payload — the generated `MeResponseDto` (Story 10.7, AD-12):
/// `{ id, email, phone, displayName, permissions: string[] }` (`phone` E.164 or
/// null); `permissions` is sorted,
/// each element a key in `backend/openapi/permissions.json`.
typedef MeResponse = MeResponseDto;

/// Injectable transport for fetching `/me`. This is a PORT (a one-method
/// interface), NOT an HTTP client — the seam that lets gating consume `/me`
/// without the app owning networking/navigation/a token store yet.
///
/// The real implementation is `HttpMePort` (lib/api/http_me_port.dart); [FakeMePort]
/// drives tests and demos.
abstract class MePort {
  Future<MeResponse> fetchMe();
}
