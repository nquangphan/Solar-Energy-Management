// hand-authored — web password port (Story 2.8, mirror Flutter
// mobile/lib/design_system/session/password_port.dart). The seam between the
// Quên mật khẩu / Hồ sơ screens and the three password endpoints (Story 2.8):
// `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`.
//
// THE VERIFICATION CODE NEVER CROSSES THIS PORT INBOUND. `requestResetCode`
// returns only how long a code stays valid — the same value whether or not the
// number is registered (the backend refuses to reveal which). The code reaches the user
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
 * The real adapter is `web/src/api/http-password-port.ts` (wired in main.tsx);
 * `FakePasswordPort` drives tests and demos.
 */
export interface PasswordPort {
  /**
   * Ask for a reset code for a RAW phone (the backend normalizes it). Resolves
   * identically for a known and an unknown number — never branch the UI on "does
   * this account exist".
   */
  requestResetCode(phone: string): Promise<{ expiresInSeconds: number }>;

  /** Consume the code and set a new password. Rejects on any invalid branch. */
  resetPassword(input: {
    phone: string;
    code: string;
    newPassword: string;
  }): Promise<void>;

  /** Change the signed-in account's own password. Rejects if `currentPassword` is wrong. */
  changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void>;
}
