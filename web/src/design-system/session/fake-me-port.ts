// hand-authored — TEST/DEMO-ONLY fake port (Story 2.6, mirror Flutter
// mobile/lib/design_system/session/fake_me_port.dart).
//
// NOT a real session source: it returns a configurable in-memory payload so the
// gating seam is testable/demoable WITHOUT an app-runtime, bundler or network.
// The real session comes from an HTTP `MePort` bound to a logged-in token
// (app-runtime/login-network, out of scope here).

import type { MePort, MeResponse } from './me-port';

/**
 * The default demo payload — a manager who sees all orders + manages permissions
 * but is NOT a Super Admin (no `audit.read`). Same shape as the Epic 1
 * `DEMO_PERMISSIONS` stub, so `filterNav` drops the Audit item exactly as before
 * (parity with Story 1.10). `permissions` is sorted, matching the `/me` contract.
 */
export const DEMO_ME: MeResponse = {
  id: 'demo-account',
  email: 'demo@phuongnam.solar',
  phone: '+84900000001',
  displayName: 'Quản lý (demo)',
  permissions: ['orders.view_all', 'permissions.manage'],
};

/**
 * A `MePort` that resolves a fixed payload — TEST/DEMO ONLY. Pass a custom
 * `MeResponse` to model any account (e.g. a Super Admin with `audit.read`, or an
 * account with only `orders.view_own`).
 */
export class FakeMePort implements MePort {
  constructor(private readonly me: MeResponse = DEMO_ME) {}

  fetchMe(): Promise<MeResponse> {
    return Promise.resolve(this.me);
  }
}
