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
  setTokens(tokens: SessionTokens): void;
  clear(): void;
}

export function createSessionStore(storage: () => Storage = () => window.localStorage): SessionStore {
  let accessToken: string | null = null;

  return {
    getAccessToken: () => accessToken,
    getRefreshToken() {
      try {
        return storage().getItem(REFRESH_TOKEN_KEY);
      } catch {
        return null;
      }
    },
    setTokens(tokens) {
      accessToken = tokens.accessToken;
      try {
        storage().setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      } catch {
        // Storage unavailable: the session lives until the tab closes.
      }
    },
    clear() {
      accessToken = null;
      try {
        storage().removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // Nothing stored that we could reach.
      }
    },
  };
}
