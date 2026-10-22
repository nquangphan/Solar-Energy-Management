// hand-authored — TEST/DEMO-ONLY fake port (Story 2.6, mirror web
// web/src/design-system/session/fake-me-port.ts).
//
// NOT a real session source: it returns a configurable in-memory payload so the
// gating seam is testable/demoable WITHOUT an app-runtime or network. The real
// session comes from an HTTP [MePort] bound to a logged-in token
// (app-runtime/login-network, out of scope here).

import 'me_port.dart';

/// The default demo payload — a manager who sees all orders + manages
/// permissions but is NOT a Super Admin (no `audit.read`). Same shape as the
/// Epic 1 `demoPermissions` stub, so `filterNav` drops the Audit item exactly as
/// before (parity with Story 1.10). `permissions` is sorted, matching `/me`.
const MeResponse kDemoMe = MeResponse(
  id: 'demo-account',
  email: 'demo@phuongnam.solar',
  phone: '+84900000001',
  displayName: 'Quản lý (demo)',
  permissions: ['orders.view_all', 'permissions.manage'],
);

/// A [MePort] that resolves a fixed payload — TEST/DEMO ONLY. Pass a custom
/// [MeResponse] to model any account (e.g. a Super Admin with `audit.read`, or
/// an account with only `orders.view_own`).
class FakeMePort implements MePort {
  const FakeMePort([this.me = kDemoMe]);

  final MeResponse me;

  @override
  Future<MeResponse> fetchMe() async => me;
}
