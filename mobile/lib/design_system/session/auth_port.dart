// hand-authored — mobile sign-in port (Story 10.6, mirror web
// web/src/design-system/session/auth-port.ts). The seam between the Đăng nhập
// screen / app and the session endpoints: `POST /auth/login`, `/auth/refresh`,
// `/auth/logout`.
//
// Tokens never cross this port: the HTTP adapter stores them in the session
// store and the transport attaches them. A screen only learns "signed in or not".

abstract class AuthPort {
  /// POST /auth/login — throws the AD-5 error (401 wrong credentials, 400 validation).
  Future<void> login({required String email, required String password});

  /// Start-up: trade the stored refresh token for an access token. false ⇒ show Đăng nhập.
  Future<bool> restoreSession();

  /// POST /auth/logout with the stored refresh token; ALWAYS clears the local session.
  Future<void> logout();
}
