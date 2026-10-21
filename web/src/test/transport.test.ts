// @vitest-environment node
// Transport behaviour through the real generated client (openapi-fetch) with a
// stubbed `fetchImpl` — no network. Node's own Request/Response, so body streams
// and clone() behave like the browser's, not like a jsdom shim.
//
// Call counts are asserted with toHaveBeenCalledTimes: a duplicated refresh or a
// second onSessionExpired must turn a case red.
import { describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from '../api/api-error';
import { createApiClient } from '../api/client';
import { REFRESH_TOKEN_KEY, createSessionStore } from '../api/session-store';
import { createTransport } from '../api/transport';
import type {
  ContractsPortError,
  InvoicesPortError,
  OrderPortError,
} from '../design-system/session';
import type { CustomerPortError } from '../design-system/session/customers-port';
import { memoryStorage } from './memory-storage';

const BASE = 'http://api.test';
/** The page origin when the web runs on the vite dev server (base `/api`, proxied). */
const PAGE = 'http://localhost:5173';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const UNAUTHENTICATED = { code: 'UNAUTHENTICATED', message: 'Chưa xác thực', traceId: 't-401' };
const BAD_CREDENTIALS = {
  code: 'UNAUTHENTICATED',
  message: 'Thông tin đăng nhập không đúng',
  traceId: 't-cred',
};
const ME = { id: 'acc-1', email: 'a@pns.vn', permissions: [] };

type Handler = (request: Request) => Response | Promise<Response>;

/**
 * Wires session + transport + client over a stubbed backend. `routes` maps
 * "METHOD /path" to a handler; each handler is a vi.fn so its calls are countable.
 */
function setup(
  routes: Record<string, Handler>,
  tokens: { access?: string; refresh?: string } = { access: 'access-1', refresh: 'refresh-1' },
  baseUrl = BASE,
) {
  const storage = memoryStorage();
  const session = createSessionStore(() => storage);
  if (tokens.access && tokens.refresh) {
    session.setTokens({ accessToken: tokens.access, refreshToken: tokens.refresh });
  } else if (tokens.refresh) {
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }
  const handlers = Object.fromEntries(
    Object.entries(routes).map(([key, handler]) => [key, vi.fn(handler)]),
  );
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    // A relative refresh URL (base `/api`) resolves against the page origin, as in the browser.
    const request = input instanceof Request ? input : new Request(new URL(String(input), PAGE), init);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    return handler(request);
  });
  const onSessionExpired = vi.fn();
  const transport = createTransport({ baseUrl, session, fetchImpl, onSessionExpired });
  const client = createApiClient(transport, baseUrl);
  return { client, transport, session, storage, handlers, fetchImpl, onSessionExpired };
}

/** A refresh handler that rotates tokens: access-2 / refresh-2. */
const refreshOk: Handler = () =>
  json(200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 });

/** GET /me: 401 for anything but the renewed token. */
const meNeedsAccess2: Handler = (request) =>
  request.headers.get('Authorization') === 'Bearer access-2'
    ? json(200, ME)
    : json(401, UNAUTHENTICATED);

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

describe('transport — error envelope', () => {
  it('400 envelope with fieldErrors becomes an ApiError carrying every field', async () => {
    const { client } = setup({
      'POST /auth/change-password': () =>
        json(400, {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ',
          traceId: 't-400',
          fieldErrors: [
            { field: 'newPassword', code: 'MIN_LENGTH', message: 'Tối thiểu 8 ký tự.' },
            { field: 42, message: 'malformed — dropped' },
          ],
        }),
    });
    const error = await rejection(
      client.POST('/auth/change-password', {
        body: { currentPassword: 'old', newPassword: 'x' },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ',
      traceId: 't-400',
      fieldErrors: [{ field: 'newPassword', code: 'MIN_LENGTH', message: 'Tối thiểu 8 ký tự.' }],
    });
    expect((error as ApiError).fieldErrors).toHaveLength(1);
  });

  it('a body that is not an envelope (proxy HTML 502) gives the generic message, not a SyntaxError', async () => {
    const { client } = setup({
      'GET /me': () =>
        new Response('<html>502 Bad Gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
    });
    const error = await rejection(client.GET('/me'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: undefined, message: GENERIC_ERROR_MESSAGE });
  });

  it('a network failure gives an ApiError without status and the network message', async () => {
    const { client } = setup({
      'GET /me': () => {
        throw new TypeError('fetch failed');
      },
    });
    const error = await rejection(client.GET('/me'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: undefined, code: undefined, message: NETWORK_ERROR_MESSAGE });
  });

  it('a caller abort is rethrown untouched', async () => {
    const { client } = setup({
      'GET /me': () => {
        throw new DOMException('aborted', 'AbortError');
      },
    });
    const error = await rejection(client.GET('/me'));
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
  });
});

describe('transport — bearer', () => {
  it('attaches the bearer to ordinary routes and never to the five public auth routes', async () => {
    const seen = new Map<string, string | null>();
    const record: Handler = (request) => {
      seen.set(new URL(request.url).pathname, request.headers.get('Authorization'));
      return new Response(null, { status: 204 });
    };
    const { client } = setup({
      'GET /me': record,
      'POST /auth/login': record,
      'POST /auth/refresh': record,
      'POST /auth/logout': record,
      'POST /auth/forgot-password': record,
      'POST /auth/reset-password': record,
    });
    await client.GET('/me');
    await client.POST('/auth/login', { body: { email: 'a@pns.vn', password: 'x' } });
    await client.POST('/auth/refresh', { body: { refreshToken: 'r' } });
    await client.POST('/auth/logout', { body: { refreshToken: 'r' } });
    await client.POST('/auth/forgot-password', { body: { email: 'a@pns.vn' } });
    await client.POST('/auth/reset-password', {
      body: { email: 'a@pns.vn', code: '123456', newPassword: 'MatKhauMoi456' },
    });
    expect(seen.get('/me')).toBe('Bearer access-1');
    for (const path of [
      '/auth/login',
      '/auth/refresh',
      '/auth/logout',
      '/auth/forgot-password',
      '/auth/reset-password',
    ]) {
      expect(seen.has(path)).toBe(true);
      expect(seen.get(path)).toBeNull();
    }
  });
});

describe('transport — 401 and refresh', () => {
  it('401 → one refresh → replay with the new token succeeds', async () => {
    const { client, handlers, session } = setup({
      'GET /me': meNeedsAccess2,
      'POST /auth/refresh': refreshOk,
    });
    const { data } = await client.GET('/me');
    expect(data).toEqual(ME);
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(handlers['GET /me']).toHaveBeenCalledTimes(2);
    expect(session.getAccessToken()).toBe('access-2');
  });

  it('refresh stores the ROTATED refresh token and sends the stored one', async () => {
    const { client, handlers, storage } = setup({
      'GET /me': meNeedsAccess2,
      'POST /auth/refresh': refreshOk,
    });
    await client.GET('/me');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
    const refreshRequest = handlers['POST /auth/refresh'].mock.lastCall![0];
    expect(await refreshRequest.json()).toEqual({ refreshToken: 'refresh-1' });
  });

  it('the replay carries the NEW Authorization and the SAME JSON body as the first send', async () => {
    const attempts: { auth: string | null; body: string }[] = [];
    const { client, handlers } = setup({
      'POST /auth/change-password': async (request) => {
        attempts.push({ auth: request.headers.get('Authorization'), body: await request.text() });
        return attempts.length === 1 ? json(401, UNAUTHENTICATED) : new Response(null, { status: 204 });
      },
      'POST /auth/refresh': refreshOk,
    });
    await client.POST('/auth/change-password', {
      body: { currentPassword: 'MatKhauCu123', newPassword: 'MatKhauMoi456' },
    });
    expect(handlers['POST /auth/change-password']).toHaveBeenCalledTimes(2);
    expect(attempts[0].auth).toBe('Bearer access-1');
    expect(attempts[1].auth).toBe('Bearer access-2');
    expect(attempts[1].body).toBe(attempts[0].body);
    expect(JSON.parse(attempts[1].body)).toEqual({
      currentPassword: 'MatKhauCu123',
      newPassword: 'MatKhauMoi456',
    });
  });

  it('two concurrent 401s share ONE refresh, then both replay', async () => {
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const { client, handlers } = setup({
      'GET /me': meNeedsAccess2,
      'POST /auth/refresh': async () => {
        await refreshGate;
        return refreshOk(new Request(`${BASE}/auth/refresh`));
      },
    });
    const first = client.GET('/me');
    const second = client.GET('/me');
    await vi.waitFor(() => expect(handlers['GET /me']).toHaveBeenCalledTimes(2));
    releaseRefresh();
    const [a, b] = await Promise.all([first, second]);
    expect(a.data).toEqual(ME);
    expect(b.data).toEqual(ME);
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(handlers['GET /me']).toHaveBeenCalledTimes(4);
  });

  it('refresh 401 → session cleared, onSessionExpired once, request rejected', async () => {
    const { client, session, storage, onSessionExpired } = setup({
      'GET /me': () => json(401, UNAUTHENTICATED),
      'POST /auth/refresh': () => json(401, BAD_CREDENTIALS),
    });
    const error = await rejection(client.GET('/me'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: BAD_CREDENTIALS.message,
    });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(session.getAccessToken()).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('two concurrent 401s + failing refresh → onSessionExpired exactly once, both reject', async () => {
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const { client, handlers, onSessionExpired } = setup({
      'GET /me': () => json(401, UNAUTHENTICATED),
      'POST /auth/refresh': async () => {
        await refreshGate;
        return new Response('<html>bad gateway</html>', { status: 502 });
      },
    });
    const first = rejection(client.GET('/me'));
    const second = rejection(client.GET('/me'));
    await vi.waitFor(() => expect(handlers['GET /me']).toHaveBeenCalledTimes(2));
    releaseRefresh();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', message: SESSION_EXPIRED_MESSAGE });
    expect(b).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', message: SESSION_EXPIRED_MESSAGE });
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('401 on /auth/login is an answer: no refresh, the backend message surfaces', async () => {
    const { client, handlers, onSessionExpired, session } = setup({
      'POST /auth/login': () => json(401, BAD_CREDENTIALS),
      'POST /auth/refresh': refreshOk,
    });
    const error = await rejection(
      client.POST('/auth/login', { body: { email: 'a@pns.vn', password: 'sai' } }),
    );
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', message: BAD_CREDENTIALS.message });
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(0);
    expect(session.getAccessToken()).toBe('access-1');
  });

  it('replay still 401 (wrong current password) → ApiError, one refresh, session kept', async () => {
    const WRONG_CURRENT = {
      code: 'UNAUTHENTICATED',
      message: 'Mật khẩu hiện tại không đúng',
      traceId: 't-cp',
    };
    const { client, handlers, onSessionExpired, session } = setup({
      'POST /auth/change-password': () => json(401, WRONG_CURRENT),
      'POST /auth/refresh': refreshOk,
    });
    const error = await rejection(
      client.POST('/auth/change-password', {
        body: { currentPassword: 'sai', newPassword: 'MatKhauMoi456' },
      }),
    );
    expect(error).toMatchObject({ status: 401, message: WRONG_CURRENT.message });
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(handlers['POST /auth/change-password']).toHaveBeenCalledTimes(2);
    expect(onSessionExpired).toHaveBeenCalledTimes(0);
    expect(session.getAccessToken()).toBe('access-2');
  }, 2000);

  it('no refresh token + 401 → no refresh call, onSessionExpired once', async () => {
    const { client, handlers, onSessionExpired } = setup(
      {
        'GET /me': () => json(401, UNAUTHENTICATED),
        'POST /auth/refresh': refreshOk,
      },
      {},
    );
    const error = await rejection(client.GET('/me'));
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});

describe('transport — renewal edge cases', () => {
  it('a 401 that lands after another request already renewed replays with the new token, no second refresh', async () => {
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    let calls = 0;
    const { client, handlers } = setup({
      'GET /me': async (request) => {
        calls += 1;
        if (calls === 1) {
          // Sent with access-1; its 401 arrives only after the other request renewed.
          await slowGate;
          return json(401, UNAUTHENTICATED);
        }
        return meNeedsAccess2(request);
      },
      'POST /auth/refresh': refreshOk,
    });
    const slow = client.GET('/me');
    await vi.waitFor(() => expect(handlers['GET /me']).toHaveBeenCalledTimes(1));
    const fast = await client.GET('/me');
    expect(fast.data).toEqual(ME);
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    releaseSlow();
    const { data } = await slow;
    expect(data).toEqual(ME);
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(handlers['GET /me']).toHaveBeenCalledTimes(4);
  });

  it('a 401 whose body is not an envelope (proxy) still triggers the refresh', async () => {
    let calls = 0;
    const { client, handlers } = setup({
      'GET /me': (request) => {
        calls += 1;
        return calls === 1 ? new Response('Unauthorized', { status: 401 }) : meNeedsAccess2(request);
      },
      'POST /auth/refresh': refreshOk,
    });
    const { data } = await client.GET('/me');
    expect(data).toEqual(ME);
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
  });

  it('a 401 that lands AFTER the failed refresh is rejected without a second expiry or refresh', async () => {
    let releaseLate!: () => void;
    const lateGate = new Promise<void>((resolve) => {
      releaseLate = resolve;
    });
    let meCalls = 0;
    const { client, handlers, onSessionExpired } = setup({
      'GET /me': async () => {
        meCalls += 1;
        if (meCalls === 2) await lateGate;
        return json(401, UNAUTHENTICATED);
      },
      'POST /auth/refresh': () => json(401, BAD_CREDENTIALS),
    });
    const first = rejection(client.GET('/me'));
    const late = rejection(client.GET('/me'));
    await first;
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    releaseLate();
    expect(await late).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', message: SESSION_EXPIRED_MESSAGE });
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('a refresh 5xx envelope expires the session with the session message, not the 5xx text', async () => {
    const { client, onSessionExpired } = setup({
      'GET /me': () => json(401, UNAUTHENTICATED),
      'POST /auth/refresh': () => json(500, { code: 'INTERNAL', message: 'Lỗi hệ thống', traceId: 't-500' }),
    });
    const error = await rejection(client.GET('/me'));
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', message: SESSION_EXPIRED_MESSAGE });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('an abort during the replay is rethrown untouched and keeps the renewed session', async () => {
    let meCalls = 0;
    const { client, session, onSessionExpired } = setup({
      'GET /me': () => {
        meCalls += 1;
        if (meCalls === 1) return json(401, UNAUTHENTICATED);
        throw new DOMException('aborted', 'AbortError');
      },
      'POST /auth/refresh': refreshOk,
    });
    const error = await rejection(client.GET('/me'));
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
    expect(onSessionExpired).toHaveBeenCalledTimes(0);
    expect(session.getAccessToken()).toBe('access-2');
  });

  it('a refresh 200 without a token pair expires the session instead of storing garbage', async () => {
    const { client, session, storage, onSessionExpired } = setup({
      'GET /me': () => json(401, UNAUTHENTICATED),
      'POST /auth/refresh': () => json(200, { accessToken: 'access-2' }),
    });
    const error = await rejection(client.GET('/me'));
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', message: SESSION_EXPIRED_MESSAGE });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(session.getAccessToken()).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });
});

describe('transport — relative /api base (the main.tsx default, proxied by vite)', () => {
  const API = '/api';

  it('strips the base path: public auth routes get no bearer and their 401 never refreshes', async () => {
    const { transport, handlers, onSessionExpired } = setup(
      {
        'POST /api/auth/login': (request) =>
          request.headers.get('Authorization') === null
            ? json(401, BAD_CREDENTIALS)
            : json(500, { code: 'INTERNAL', message: 'bearer leaked onto login', traceId: 't' }),
        'POST /api/auth/refresh': refreshOk,
      },
      undefined,
      API,
    );
    const error = await rejection(
      transport.fetch(
        new Request(`${PAGE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'a@pns.vn', password: 'sai' }),
        }),
      ),
    );
    expect(error).toMatchObject({ status: 401, message: BAD_CREDENTIALS.message });
    expect(handlers['POST /api/auth/refresh']).toHaveBeenCalledTimes(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(0);
  });

  it('an ordinary route gets the bearer and renews through /api/auth/refresh', async () => {
    const { transport, handlers } = setup(
      {
        'GET /api/me': meNeedsAccess2,
        'POST /api/auth/refresh': refreshOk,
      },
      undefined,
      API,
    );
    const response = await transport.fetch(new Request(`${PAGE}/api/me`));
    expect(await response.json()).toEqual(ME);
    expect(handlers['GET /api/me']).toHaveBeenCalledTimes(2);
    expect(handlers['GET /api/me'].mock.calls[0][0].headers.get('Authorization')).toBe('Bearer access-1');
    expect(handlers['POST /api/auth/refresh']).toHaveBeenCalledTimes(1);
  });
});

describe('session store', () => {
  it('blocked localStorage reads as "no token" instead of crashing', () => {
    const session = createSessionStore(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(session.getRefreshToken()).toBeNull();
    expect(() => session.setTokens({ accessToken: 'a', refreshToken: 'r' })).not.toThrow();
    expect(session.getAccessToken()).toBe('a');
    expect(() => session.clear()).not.toThrow();
  });
});

describe('ApiError fits the screens\' port error shapes', () => {
  it('assigns to OrderPortError, ContractsPortError, CustomerPortError, InvoicesPortError without a cast', () => {
    const error = new ApiError('Dữ liệu không hợp lệ', {
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: [{ field: 'email', code: 'IS_EMAIL', message: 'Email không hợp lệ' }],
    });
    // Compile-time proof (typecheck lane): no `as`, so a shape drift fails tsc.
    const order: OrderPortError = error;
    const contracts: ContractsPortError = error;
    const customer: CustomerPortError = error;
    const invoices: InvoicesPortError = error;
    expect(order.code).toBe('VALIDATION_ERROR');
    expect(contracts.status).toBe(400);
    expect(customer.fieldErrors?.[0].field).toBe('email');
    expect(invoices.message).toBe('Dữ liệu không hợp lệ');
  });
});
