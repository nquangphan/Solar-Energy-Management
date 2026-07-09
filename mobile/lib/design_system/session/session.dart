// hand-authored — session module barrel (Story 2.6, mirror web session/index.ts).
// Parallel to gating.dart and shell.dart. Exports the seam that binds `/me`
// (Story 2.5) to the gating permission set: port + mapping + provider/scope + the
// test/demo fake port.
//
// Gating is UX only (AD-4); this layer holds no business logic and touches no DB
// (AD-1/2). The registry is backend-owned (AD-17) — the provider only maps the
// `/me` payload the backend returns.

export 'me_port.dart';
export 'password_port.dart';
export 'app_session.dart';
export 'app_session_gating_example.dart';

// TEST/DEMO-ONLY — not a real session source (see fake_me_port.dart,
// fake_password_port.dart). They enforce no security rule; the backend owns all of them.
export 'fake_me_port.dart';
export 'fake_password_port.dart';
