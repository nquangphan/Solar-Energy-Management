// hand-authored — mobile password port (Story 2.8, mirror web
// web/src/design-system/session/password-port.ts). The seam between the Quên mật
// khẩu / Hồ sơ screens and the three password endpoints (Story 2.8):
// `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`.
//
// THE VERIFICATION CODE NEVER CROSSES THIS PORT INBOUND. [requestResetCode]
// returns only how long a code stays valid — the same value whether or not the
// email exists (the backend refuses to reveal which). The code reaches the user
// out of band; the screen only ever SENDS one back.
//
// The backend enforces every rule behind these calls (AD-4): attempt ceiling,
// single-use, expiry, and "current password must be correct". A client-side
// check is UX, never a security boundary.

/// Injectable transport for the password flows. This is a PORT (three methods),
/// NOT an HTTP client — the seam that lets the screens exist before the app owns
/// networking/navigation/a token store.
///
/// TODO(app-runtime/login-network): the real implementation attaches
/// `Authorization: Bearer <accessToken>` (Story 2.3) to [changePassword] and
/// parses the AD-5 error envelope into the screen's banner copy. It lands with
/// the app-runtime; until then [FakePasswordPort] drives tests.
abstract class PasswordPort {
  /// Ask for a reset code. Resolves identically for a known and an unknown email
  /// — never branch the UI on "does this account exist".
  Future<int> requestResetCode(String email);

  /// Consume the code and set a new password. Throws on any invalid branch.
  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  });

  /// Change the signed-in account's own password. Throws if [currentPassword] is wrong.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  });
}
