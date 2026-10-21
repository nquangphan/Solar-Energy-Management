// hand-authored — TEST/DEMO-ONLY fake port (Story 10.3).
//
// NOT a real sign-in: it resolves (or rejects) in memory so the Đăng nhập screen
// is testable WITHOUT a backend or network. It enforces NO security rule — the
// backend owns every one of them (AD-4).

import type { AuthPort } from './auth-port';

/**
 * An `AuthPort` that signs in by default — TEST/DEMO ONLY. Pass `rejectWith` to
 * model a backend refusal (wrong credentials) and drive the screen's danger
 * `Banner`; `restored` is what `restoreSession` answers.
 */
export class FakeAuthPort implements AuthPort {
  constructor(
    private readonly rejectWith?: Error,
    private readonly restored = false,
  ) {}

  login(): Promise<void> {
    return this.rejectWith ? Promise.reject(this.rejectWith) : Promise.resolve();
  }

  restoreSession(): Promise<boolean> {
    return Promise.resolve(this.restored);
  }

  logout(): Promise<void> {
    return Promise.resolve();
  }
}
