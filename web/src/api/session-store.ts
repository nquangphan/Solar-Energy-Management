// hand-authored — where the web client keeps its tokens (Story 10.3).
//
// Access token: memory only (gone on reload; restored from the refresh token).
// Refresh token: localStorage, so a reload keeps the user signed in. Every
// localStorage access is guarded — private mode or blocked storage behaves as
// "no stored token", never as a crash.

export const REFRESH_TOKEN_KEY = 'pns.refreshToken';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  /**
   * Bumped when a session starts (login) or ends (clear), not when it is renewed. A renewal
   * that finishes after the generation moved belongs to a session that is gone.
   */
  getGeneration(): number;
  /** `renewal`: the tokens rotate the CURRENT session (refresh) instead of starting one. */
  setTokens(tokens: SessionTokens, options?: { renewal?: boolean }): void;
  clear(): void;
}

export function createSessionStore(storage: () => Storage = () => window.localStorage): SessionStore {
  let accessToken: string | null = null;
  let generation = 0;

  return {
    getAccessToken: () => accessToken,
    getGeneration: () => generation,
    getRefreshToken() {
      try {
        return storage().getItem(REFRESH_TOKEN_KEY);
      } catch {
        return null;
      }
    },
    setTokens(tokens, options) {
      if (!options?.renewal) generation += 1;
      accessToken = tokens.accessToken;
      try {
        storage().setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      } catch {
        // Storage unavailable: the session lives until the tab closes.
      }
    },
    clear() {
      generation += 1;
      accessToken = null;
      try {
        storage().removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // Nothing stored that we could reach.
      }
    },
  };
}
