// hand-authored — the real AuthPort over the generated client (Story 10.3).
//
// Tokens go straight into the session store; the screen never holds one.
// Renewal is NOT re-implemented here: restoreSession reuses the transport's
// single-flight refresh, so the transport stays the one place that refreshes.
import type { AuthPort } from '../design-system/session/auth-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';
import type { SessionStore } from './session-store';
import type { Transport } from './transport';

export class HttpAuthPort implements AuthPort {
  constructor(
    private readonly client: ApiClient,
    private readonly session: SessionStore,
    private readonly transport: Pick<Transport, 'refreshSession'>,
  ) {}

  async login(input: { email: string; password: string }): Promise<void> {
    const { data } = await this.client.POST('/auth/login', { body: input });
    // A non-ok response already threw in the transport; an ok one without tokens is a broken backend.
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    this.session.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  async restoreSession(): Promise<boolean> {
    if (!this.session.getRefreshToken()) return false;
    return this.transport.refreshSession();
  }

  async logout(): Promise<void> {
    const refreshToken = this.session.getRefreshToken();
    try {
      if (refreshToken) await this.client.POST('/auth/logout', { body: { refreshToken } });
    } catch {
      // Logout is idempotent server-side and the token expires anyway: signing out locally is what matters.
    } finally {
      this.session.clear();
    }
  }
}
