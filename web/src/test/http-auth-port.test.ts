// @vitest-environment node
// HttpAuthPort through the real transport + generated client, with a stubbed
// fetchImpl (no network, no fake port): tokens land where they belong on success
// and nowhere on failure; logout always clears the local session.
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import { createApiClient } from '../api/client';
import { HttpAuthPort } from '../api/http-auth-port';
import { REFRESH_TOKEN_KEY, createSessionStore } from '../api/session-store';
import { createTransport } from '../api/transport';
import { memoryStorage } from './memory-storage';

const BASE = 'http://api.test';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setup(respond: (request: Request) => Response | Promise<Response>) {
  const storage = memoryStorage();
  const session = createSessionStore(() => storage);
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(input instanceof Request ? input : new Request(input, init)),
  );
  const transport = createTransport({ baseUrl: BASE, session, fetchImpl });
  const port = new HttpAuthPort(createApiClient(transport, BASE), session, transport);
  return { port, session, storage, fetchImpl };
}

describe('HttpAuthPort', () => {
  it('login 200 keeps the access token in memory and the refresh token in storage', async () => {
    const { port, session, storage, fetchImpl } = setup(() =>
      json(200, { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }),
    );
    await port.login({ email: 'admin@pns.vn', password: 'MatKhau123' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = fetchImpl.mock.lastCall![0] as Request;
    expect(new URL(request.url).pathname).toBe('/auth/login');
    expect(await request.json()).toEqual({ email: 'admin@pns.vn', password: 'MatKhau123' });
    expect(session.getAccessToken()).toBe('access-1');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('login 401 rejects with the backend message and writes no token', async () => {
    const { port, session, storage } = setup(() =>
      json(401, {
        code: 'UNAUTHENTICATED',
        message: 'Thông tin đăng nhập không đúng',
        traceId: 't-1',
      }),
    );
    await expect(port.login({ email: 'admin@pns.vn', password: 'sai' })).rejects.toMatchObject({
      status: 401,
      message: 'Thông tin đăng nhập không đúng',
    });
    expect(session.getAccessToken()).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it('logout sends the stored refresh token to /auth/logout and clears both tokens', async () => {
    const { port, session, storage, fetchImpl } = setup(() => new Response(null, { status: 204 }));
    session.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    await port.logout();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = fetchImpl.mock.lastCall![0] as Request;
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/auth/logout');
    expect(await request.json()).toEqual({ refreshToken: 'refresh-1' });
    expect(session.getAccessToken()).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('logout clears both tokens even when the network fails', async () => {
    const { port, session, storage, fetchImpl } = setup(() => {
      throw new TypeError('fetch failed');
    });
    session.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    await expect(port.logout()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(session.getAccessToken()).toBeNull();
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('restoreSession without a stored refresh token answers false with no network call', async () => {
    const { port, fetchImpl } = setup(() => json(200, {}));
    await expect(port.restoreSession()).resolves.toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(0);
  });

  it('restoreSession trades the stored refresh token for a new pair', async () => {
    const { port, session, storage, fetchImpl } = setup(() =>
      json(200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 }),
    );
    storage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    await expect(port.restoreSession()).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(session.getAccessToken()).toBe('access-2');
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
  });

  it('restoreSession with a dead refresh token answers false and clears it', async () => {
    const { port, storage } = setup(() =>
      json(401, { code: 'UNAUTHENTICATED', message: 'Thông tin đăng nhập không đúng', traceId: 't' }),
    );
    storage.setItem(REFRESH_TOKEN_KEY, 'refresh-dead');
    await expect(port.restoreSession()).resolves.toBe(false);
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('rejections are ApiError instances', async () => {
    const { port } = setup(() => json(400, { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', traceId: 't' }));
    await expect(port.login({ email: 'x', password: 'y' })).rejects.toBeInstanceOf(ApiError);
  });
});
