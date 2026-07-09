// hand-authored — TEST/DEMO-ONLY fake port (Story 2.8, mirror Flutter
// mobile/lib/design_system/session/fake_password_port.dart).
//
// NOT a real password flow: it resolves (or rejects) in memory so the Quên mật
// khẩu / Hồ sơ screens are testable WITHOUT an app-runtime, bundler or network.
// It enforces NO security rule — the backend owns every one of them (AD-4).

import type { PasswordPort } from './password-port';

/** Code lifetime the demo backend reports (matches the 5-minute default TTL). */
export const DEMO_EXPIRES_IN_SECONDS = 300;

/**
 * A `PasswordPort` that resolves by default — TEST/DEMO ONLY. Pass `rejectWith`
 * to model a backend failure (wrong code, wrong current password) and drive the
 * screens' danger `Banner`.
 */
export class FakePasswordPort implements PasswordPort {
  constructor(
    private readonly rejectWith?: Error,
    private readonly expiresInSeconds: number = DEMO_EXPIRES_IN_SECONDS,
  ) {}

  requestResetCode(): Promise<{ expiresInSeconds: number }> {
    // The real forgot-password endpoint ALWAYS returns 200 (anti-enumeration),
    // so this never surfaces a failure — rejectWith only models a reset/change
    // rejection, letting a test reach step 2 and then fail the submit.
    return Promise.resolve({ expiresInSeconds: this.expiresInSeconds });
  }

  resetPassword(): Promise<void> {
    return this.rejectWith ? Promise.reject(this.rejectWith) : Promise.resolve();
  }

  changePassword(): Promise<void> {
    return this.rejectWith ? Promise.reject(this.rejectWith) : Promise.resolve();
  }
}
