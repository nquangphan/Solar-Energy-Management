// hand-authored — web sign-in port (Story 10.3). The seam between the Đăng nhập
// screen / app shell and the session endpoints: `POST /auth/login`,
// `/auth/refresh`, `/auth/logout`. Web-only for now: the mobile twin lands with
// Story 10.6, so this file is not in the parity table yet.
//
// Tokens never cross this port: the HTTP adapter stores them in the session
// store and the transport attaches them. A screen only learns "signed in or not".

export interface AuthPort {
  /** POST /auth/login — rejects with the AD-5 error (401 wrong credentials, 400 validation). */
  login(input: { email: string; password: string }): Promise<void>;
  /** Start-up: trade the stored refresh token for an access token. false ⇒ show Đăng nhập. */
  restoreSession(): Promise<boolean>;
  /** POST /auth/logout with the stored refresh token; ALWAYS clears the local session. */
  logout(): Promise<void>;
}
