// hand-authored — the web client's ONLY network boundary (Story 10.3, AD-12 client rule).
//
// The generated client (openapi-fetch) hands every request to `transport.fetch`.
// This is the one place that:
//   - calls the network (guard: src/test/no-network-outside-transport.test.ts);
//   - attaches `Authorization: Bearer <access>` (never on the public auth routes);
//   - turns a non-ok response into an ApiError (AD-5 envelope parsed here and only
//     here), so adapters only ever see `data`;
//   - renews the session on 401: ONE refresh shared by every waiting request, each
//     request replayed AT MOST once.
//
// 401 means different things per route: wrong credentials on /auth/login, a dead
// refresh token on /auth/refresh, a wrong current password on change-password.
// Hence the rules: no refresh for the public auth routes; a replay that is still
// 401 surfaces as an ApiError (the session is kept); only a failed REFRESH clears
// the session and reports it expired.
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  toApiError,
} from './api-error';
import type { components } from './generated/schema';
import type { SessionStore } from './session-store';

type RefreshRequest = components['schemas']['RefreshRequestDto'];
type AuthTokens = components['schemas']['AuthTokensDto'];

/** Routes that authenticate by their body, not by a bearer — a 401 there is an answer, not an expired token. */
export const PUBLIC_AUTH_PATHS: ReadonlySet<string> = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

export interface TransportOptions {
  /** Same value the generated client is built with: `/api` (dev proxy) or the backend's full URL. */
  baseUrl: string;
  session: SessionStore;
  fetchImpl?: typeof fetch;
  /** Called once per failed renewal, after the session is cleared. */
  onSessionExpired?: () => void;
}

export interface Transport {
  fetch(request: Request): Promise<Response>;
  /** Trades the stored refresh token for new tokens; shares an in-flight renewal. */
  refreshSession(): Promise<boolean>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isAuthTokens(value: unknown): value is AuthTokens {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.accessToken === 'string' && typeof v.refreshToken === 'string';
}

export function createTransport({
  baseUrl,
  session,
  fetchImpl = globalThis.fetch.bind(globalThis),
  onSessionExpired,
}: TransportOptions): Transport {
  const base = baseUrl.replace(/\/$/, '');
  const basePath = new URL(base, 'http://base.invalid').pathname.replace(/\/$/, '');
  // The renewal in flight; resolves to null on success, or the error to reject with.
  let refreshing: Promise<ApiError | null> | null = null;

  function routeOf(request: Request): string {
    const path = new URL(request.url).pathname;
    if (path === basePath) return '/';
    return path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : path;
  }

  function authorize(request: Request, token: string | null): void {
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
  }

  async function send(request: Request): Promise<Response> {
    try {
      return await fetchImpl(request);
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new ApiError(NETWORK_ERROR_MESSAGE);
    }
  }

  async function ensureOk(response: Response): Promise<Response> {
    if (response.ok) return response;
    throw await toApiError(response);
  }

  function expired(message = SESSION_EXPIRED_MESSAGE): ApiError {
    return new ApiError(message, { status: 401, code: 'UNAUTHENTICATED' });
  }

  async function renew(): Promise<ApiError | null> {
    const refreshToken = session.getRefreshToken();
    let failure = expired();
    if (refreshToken) {
      try {
        const body: RefreshRequest = { refreshToken };
        const response = await fetchImpl(`${base}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          const tokens: unknown = await response.json();
          if (isAuthTokens(tokens)) {
            // The backend rotates the refresh token: keeping the old one fails the next renewal.
            session.setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
            return null;
          }
        } else {
          // Only the backend's own "refresh refused" (401 envelope) speaks for the session;
          // a 5xx or validation message would mislabel why the user is signed out.
          const error = await toApiError(response);
          if (response.status === 401 && error.code) failure = expired(error.message);
        }
      } catch {
        // Network failure or unreadable body: the session cannot be renewed.
      }
    }
    session.clear();
    onSessionExpired?.();
    return failure;
  }

  function renewOnce(): Promise<ApiError | null> {
    if (!refreshing) {
      refreshing = renew().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  return {
    async fetch(request) {
      if (PUBLIC_AUTH_PATHS.has(routeOf(request))) return ensureOk(await send(request));

      // The body is a stream: once sent it cannot be read again, so keep a copy for the replay.
      const replay = request.clone();
      const sentToken = session.getAccessToken();
      authorize(request, sentToken);
      const response = await send(request);
      if (response.status !== 401) return ensureOk(response);

      // Another request may already have renewed the session while this one was in flight.
      const current = session.getAccessToken();
      // Sent with a token that is gone now: the session ended while this request was in
      // flight (a failed renewal already reported it, or a logout). Renewing again would
      // report the same expiry a second time.
      if (current === null && sentToken !== null) throw expired();
      if (current === sentToken) {
        const failure = await renewOnce();
        if (failure) throw failure;
      }
      authorize(replay, session.getAccessToken());
      return ensureOk(await send(replay));
    },

    async refreshSession() {
      return (await renewOnce()) === null;
    },
  };
}
