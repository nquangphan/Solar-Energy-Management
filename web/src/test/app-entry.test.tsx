// The real web entry (main.tsx) end to end: session store + transport + generated
// client + HttpAuthPort + LoginScreen, mounted into a jsdom #root. Only the global
// `fetch` is stubbed — no network. Each case re-imports the module, so the app
// boots fresh (StrictMode included) against its own stubbed backend.
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { REFRESH_TOKEN_KEY } from '../api/session-store';
import { memoryStorage } from './memory-storage';

const API = 'http://localhost:5173/api';

type Handler = (request: Request) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 };
const DEAD_REFRESH = {
  code: 'UNAUTHENTICATED',
  message: 'Thông tin đăng nhập không đúng',
  traceId: 't-r',
};

/** Boots main.tsx with `routes` ("METHOD /path" under /api) as the backend. */
async function boot(routes: Record<string, Handler>, storedRefreshToken?: string) {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
  // Node 24's own (unconfigured) localStorage shadows jsdom's: give the page a working one.
  const localStorage = memoryStorage();
  vi.stubGlobal('localStorage', localStorage);
  if (storedRefreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, storedRefreshToken);
  vi.stubEnv('VITE_API_BASE_URL', API);
  const handlers = Object.fromEntries(
    Object.entries(routes).map(([key, handler]) => [key, vi.fn(handler)]),
  );
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    const handler = handlers[`${request.method} ${path}`];
    if (!handler) throw new Error(`unexpected request ${request.method} ${path}`);
    return handler(request);
  });
  vi.stubGlobal('fetch', fetchMock);
  await act(async () => {
    await import('../main');
  });
  return { handlers, fetchMock, localStorage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('web entry (main.tsx)', () => {
  it('without a stored refresh token it opens Đăng nhập and calls nothing', async () => {
    const { fetchMock } = await boot({});
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('signs in through the form: tokens stored, signed-in view shown', async () => {
    const { handlers, localStorage } = await boot({ 'POST /auth/login': () => json(200, TOKENS) });
    fireEvent.change(await screen.findByPlaceholderText('Email đăng nhập'), {
      target: { value: 'admin@pns.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), {
      target: { value: 'MatKhau123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Đã đăng nhập.')).toBeTruthy();
    expect(handlers['POST /auth/login']).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('wrong credentials keep Đăng nhập with the backend message and store nothing', async () => {
    const { localStorage } = await boot({ 'POST /auth/login': () => json(401, DEAD_REFRESH) });
    fireEvent.change(await screen.findByPlaceholderText('Email đăng nhập'), {
      target: { value: 'admin@pns.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'sai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Thông tin đăng nhập không đúng',
    );
    expect(screen.queryByText('Đã đăng nhập.')).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('a reload with a live refresh token restores the session with ONE refresh (StrictMode double effect)', async () => {
    const { handlers, localStorage } = await boot(
      {
        'POST /auth/refresh': () =>
          json(200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 }),
      },
      'refresh-1',
    );
    expect(await screen.findByText('Đã đăng nhập.')).toBeTruthy();
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
  });

  it('a reload with a dead refresh token lands on Đăng nhập and forgets the token', async () => {
    const { handlers, localStorage } = await boot(
      { 'POST /auth/refresh': () => json(401, DEAD_REFRESH) },
      'refresh-dead',
    );
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('Đăng xuất posts the refresh token to /auth/logout and returns to Đăng nhập', async () => {
    const { handlers, localStorage } = await boot(
      {
        'POST /auth/refresh': () =>
          json(200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 }),
        'POST /auth/logout': () => new Response(null, { status: 204 }),
      },
      'refresh-1',
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(handlers['POST /auth/logout']).toHaveBeenCalledTimes(1);
    const request = handlers['POST /auth/logout'].mock.lastCall![0];
    expect(await request.json()).toEqual({ refreshToken: 'refresh-2' });
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });
});
