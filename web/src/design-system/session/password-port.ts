// hand-authored — web password port (Story 2.8, mirror Flutter
// mobile/lib/design_system/session/password_port.dart). The seam between the
// Quên mật khẩu / Hồ sơ screens and the three password endpoints (Story 2.8):
// `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`.
//
// THE VERIFICATION CODE NEVER CROSSES THIS PORT INBOUND. `requestResetCode`
// returns only how long a code stays valid — the same value whether or not the
// email exists (the backend refuses to reveal which). The code reaches the user
// out of band; the screen only ever SENDS one back.
//
// The backend enforces every rule behind these calls (AD-4): attempt ceiling,
// single-use, expiry, and "current password must be correct". A client-side
// check is UX, never a security boundary.

/**
 * Injectable transport for the password flows. This is a PORT (three methods),
 * NOT an HTTP client — the seam that lets the screens exist before the app owns
 * a bundler/router/token store.
 *
 * TODO(Story 10.4): the HTTP adapter goes through the generated client; the
 * transport (web/src/api/transport.ts, Story 10.3) already attaches the bearer
 * and parses the AD-5 envelope. Until then `FakePasswordPort` drives tests and
 * the Quên mật khẩu screen in main.tsx.
 */
export interface PasswordPort {
  /**
   * Ask for a reset code. Resolves identically for a known and an unknown email
   * — never branch the UI on "does this account exist".
   */
  requestResetCode(email: string): Promise<{ expiresInSeconds: number }>;

  /** Consume the code and set a new password. Rejects on any invalid branch. */
  resetPassword(input: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<void>;

  /** Change the signed-in account's own password. Rejects if `currentPassword` is wrong. */
  changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void>;
}
