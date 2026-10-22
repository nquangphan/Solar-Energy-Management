// The composition root (main.tsx) end to end: session store + transport + generated
// client + every HTTP adapter + router + PermissionsProvider, mounted into a jsdom
// #root. Only the global `fetch` is stubbed — no network, no fake port. Each case
// re-imports the module, so the app boots fresh (StrictMode included) against its
// own stubbed backend, at the URL the case starts from.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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
const RENEWED = { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 };
const DEAD_REFRESH = {
  code: 'UNAUTHENTICATED',
  message: 'Thông tin đăng nhập không đúng',
  traceId: 't-r',
};

function me(permissions: string[], displayName = 'Tài khoản A') {
  return { id: `acc-${displayName}`, email: 'a@pns.vn', displayName, permissions };
}
const OWN_ORDERS = me(['orders.view_own']);
const CUSTOMER_STAFF = me(['customers.manage', 'orders.view_own'], 'Tài khoản B');
const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };

/** Boots main.tsx at `path` with `routes` ("METHOD /path" under /api) as the backend. */
async function boot(routes: Record<string, Handler>, storedRefreshToken?: string, path = '/') {
  vi.resetModules();
  window.history.replaceState(null, '', path);
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
    const route = new URL(request.url).pathname.replace(/^\/api/, '');
    const handler = handlers[`${request.method} ${route}`];
    if (!handler) throw new Error(`unexpected request ${request.method} ${route}`);
    return handler(request);
  });
  vi.stubGlobal('fetch', fetchMock);
  await act(async () => {
    await import('../main');
  });
  return { handlers, fetchMock, localStorage };
}

async function signIn(email = 'a@pns.vn') {
  fireEvent.change(await screen.findByPlaceholderText('Email đăng nhập'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'MatKhau123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

function navLabels(): string[] {
  return Array.from(document.querySelectorAll('nav.sidebar a.navlink')).map((a) => a.textContent ?? '');
}

function topbarTitle(): string {
  return document.querySelector('.topbar-title')?.textContent ?? '';
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('composition root (main.tsx)', () => {
  it('without a stored refresh token it opens Đăng nhập at /login and calls nothing', async () => {
    const { fetchMock } = await boot({}, undefined, '/settings');
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('sign-in loads /me and opens the first screen the permissions allow', async () => {
    const { handlers, localStorage } = await boot({
      'POST /auth/login': () => json(200, TOKENS),
      'GET /me': () => json(200, OWN_ORDERS),
      'GET /orders': () => json(200, EMPTY_PAGE),
    });
    await signIn();
    await waitFor(() => expect(topbarTitle()).toContain('Đơn hàng'));
    expect(window.location.pathname).toBe('/orders');
    expect(navLabels()).toEqual(['Đơn hàng', 'Tra cứu bảo hành', 'Hồ sơ']);
    expect(handlers['POST /auth/login']).toHaveBeenCalledTimes(1);
    // Measured: 2. StrictMode mounts the new PermissionsProvider, unmounts and mounts it
    // again in development, so its effect fetches twice; the first answer is discarded
    // (`alive` flag). A production build fetches once.
    expect(handlers['GET /me']).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('an orders.view_all account lands on /orders and the list comes from GET /orders over fetch', async () => {
    const row = {
      id: 'o1',
      status: 'baogia',
      customerPhone: '+84903176968',
      customerName: 'Nguyễn Văn A',
      ownerAccountId: 'acc-1',
      assigneeAccountId: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const { handlers } = await boot({
      'POST /auth/login': () => json(200, TOKENS),
      'GET /me': () => json(200, me(['orders.view_all', 'payments.record', 'invoices.manage'])),
      'GET /orders': () => json(200, { items: [row], total: 1, page: 1, pageSize: 20 }),
    });
    await signIn();
    expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy();
    expect(window.location.pathname).toBe('/orders');
    const listed = handlers['GET /orders'].mock.calls.map(([request]) => request as Request);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed[0].headers.get('authorization')).toBe('Bearer access-1');
    expect(new URL(listed[0].url).search).toBe('?page=1');
  });

  it('wrong credentials keep Đăng nhập with the backend message and store nothing', async () => {
    const { handlers, localStorage } = await boot({
      'POST /auth/login': () => json(401, DEAD_REFRESH),
      'GET /me': () => json(200, OWN_ORDERS),
    });
    await signIn();
    expect((await screen.findByRole('alert')).textContent).toContain('Thông tin đăng nhập không đúng');
    expect(handlers['GET /me']).toHaveBeenCalledTimes(0);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('a reload with a live refresh token keeps the session AND the route, with ONE refresh', async () => {
    const { handlers, localStorage } = await boot(
      {
        'POST /auth/refresh': () => json(200, RENEWED),
        'GET /me': () => json(200, OWN_ORDERS),
      },
      'refresh-1',
      '/profile',
    );
    await waitFor(() => expect(topbarTitle()).toContain('Hồ sơ'));
    expect(window.location.pathname).toBe('/profile');
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
  });

  it('a reload with a dead refresh token lands on Đăng nhập and forgets the token', async () => {
    const { handlers, localStorage } = await boot(
      { 'POST /auth/refresh': () => json(401, DEAD_REFRESH) },
      'refresh-dead',
      '/warranty',
    );
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('/me 500 shows the error state; Thử lại fetches /me again and opens the app', async () => {
    let fail = true;
    const { handlers } = await boot(
      {
        'POST /auth/refresh': () => json(200, RENEWED),
        'GET /me': () =>
          fail ? json(500, { code: 'INTERNAL', message: 'Lỗi máy chủ', traceId: 't' }) : json(200, OWN_ORDERS),
        'GET /orders': () => json(200, EMPTY_PAGE),
      },
      'refresh-1',
    );
    expect(await screen.findByText('Không tải được thông tin tài khoản.')).toBeTruthy();
    const failedCalls = handlers['GET /me'].mock.calls.length;
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(topbarTitle()).toContain('Đơn hàng'));
    expect(handlers['GET /me'].mock.calls.length).toBeGreaterThan(failedCalls);
  });

  it('Đăng xuất on the /me error state posts /auth/logout and returns to Đăng nhập', async () => {
    const { handlers, localStorage } = await boot(
      {
        'POST /auth/refresh': () => json(200, RENEWED),
        'GET /me': () => json(500, { code: 'INTERNAL', message: 'Lỗi máy chủ', traceId: 't' }),
        'POST /auth/logout': () => new Response(null, { status: 204 }),
      },
      'refresh-1',
    );
    await screen.findByText('Không tải được thông tin tài khoản.');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
    expect(handlers['POST /auth/logout']).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('real data end to end: customer list → detail (%2B in the request path) → Cấu hình loads sources and VAT', async () => {
    const customer = {
      phone: '+84903176968',
      custType: 'CA_NHAN',
      name: 'Khách Thật',
      nationalId: '079201001234',
      taxCode: null,
      address: null,
      bankAccount: null,
      sourceId: 'src-1',
      sourceNote: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const source = { id: 'src-1', name: 'Nguồn Thật', description: null, active: true, sortOrder: 1, isOther: false };
    const legal = {
      legalName: 'Công ty TNHH Phương Nam Solar',
      taxCode: '0312345678',
      address: '1 Lê Lợi',
      representative: 'Nguyễn Văn B',
      representativeTitle: 'Giám đốc',
      phone: '0909000000',
      bankAccount: '0071000123456',
    };
    const { handlers } = await boot(
      {
        'POST /auth/refresh': () => json(200, RENEWED),
        'GET /me': () => json(200, me(['customers.manage', 'settings.manage', 'orders.view_own'])),
        'GET /customers': () => json(200, { items: [customer], total: 1, page: 1, pageSize: 20 }),
        'GET /customers/%2B84903176968': () => json(200, customer),
        'GET /customer-sources': () => json(200, [source]),
        'GET /settings/vat-rate': () => json(200, { ratePercent: 8 }),
        'GET /settings/company-legal-entity': () => json(200, legal),
      },
      'refresh-1',
      '/customers',
    );
    expect(await screen.findByText('Khách Thật')).toBeTruthy();
    expect(handlers['GET /customers'].mock.lastCall![0].headers.get('authorization')).toBe('Bearer access-2');

    fireEvent.click(screen.getByRole('button', { name: 'Xem' }));
    expect(window.location.pathname).toBe('/customers/%2B84903176968');
    await waitFor(() => expect(topbarTitle()).toContain('Khách Thật'));
    expect(handlers['GET /customers/%2B84903176968']).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Cấu hình', { selector: 'a.navlink' }));
    expect(window.location.pathname).toBe('/settings');
    expect(await screen.findByText('Nguồn Thật')).toBeTruthy();
    expect(await screen.findByText('8%')).toBeTruthy();
    const sourceQueries = handlers['GET /customer-sources'].mock.calls.map(([request]) => new URL(request.url).search);
    expect(sourceQueries).toContain('?includeInactive=true');
    expect(handlers['GET /settings/company-legal-entity']).toHaveBeenCalled();
  });

  it('Đăng xuất on Hồ sơ posts /auth/logout, forgets the token and returns to Đăng nhập', async () => {
    const { handlers, localStorage } = await boot(
      {
        'POST /auth/refresh': () => json(200, RENEWED),
        'GET /me': () => json(200, OWN_ORDERS),
        'POST /auth/logout': () => new Response(null, { status: 204 }),
      },
      'refresh-1',
    );
    fireEvent.click(await screen.findByText('Hồ sơ', { selector: 'a.navlink' }));
    expect(window.location.pathname).toBe('/profile');
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
    expect(handlers['POST /auth/logout']).toHaveBeenCalledTimes(1);
    const request = handlers['POST /auth/logout'].mock.lastCall![0];
    expect(await request.json()).toEqual({ refreshToken: 'refresh-2' });
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('signing out A and in as B fetches /me again and shows B’s sidebar', async () => {
    let account = OWN_ORDERS;
    const { handlers } = await boot(
      {
        'POST /auth/refresh': () => json(200, RENEWED),
        'POST /auth/login': () => json(200, TOKENS),
        'POST /auth/logout': () => new Response(null, { status: 204 }),
        'GET /me': () => json(200, account),
        'GET /customers': () => json(200, EMPTY_PAGE),
        'GET /orders': () => json(200, EMPTY_PAGE),
      },
      'refresh-1',
      '/profile',
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    await screen.findByRole('button', { name: 'Đăng nhập' });
    expect(navLabels()).toEqual([]);
    const callsForA = handlers['GET /me'].mock.calls.length;

    account = CUSTOMER_STAFF;
    await signIn('b@pns.vn');
    await waitFor(() => expect(navLabels()).toEqual(['Đơn hàng', 'Khách hàng', 'Tra cứu bảo hành', 'Hồ sơ']));
    expect(window.location.pathname).toBe('/orders');
    expect(handlers['GET /me'].mock.calls.length).toBeGreaterThan(callsForA);
  });

  it('a failed renewal mid-session sends the user back to Đăng nhập', async () => {
    let refreshes = 0;
    const { handlers, localStorage } = await boot(
      {
        // The boot renewal succeeds; the next one (after the access token expired) is refused.
        'POST /auth/refresh': () => (++refreshes === 1 ? json(200, RENEWED) : json(401, DEAD_REFRESH)),
        'GET /me': () => json(200, CUSTOMER_STAFF),
        'GET /customers': () => json(401, { code: 'UNAUTHENTICATED', message: 'Hết hạn', traceId: 't' }),
      },
      'refresh-1',
      '/customers',
    );
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
    expect(handlers['POST /auth/refresh']).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('Quên mật khẩu posts to /auth/forgot-password through the real adapter', async () => {
    const { handlers } = await boot({
      'POST /auth/forgot-password': () => json(200, { expiresInSeconds: 300 }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Quên mật khẩu?' }));
    expect(window.location.pathname).toBe('/forgot-password');
    fireEvent.change(screen.getByPlaceholderText('Nhập email đã đăng ký'), { target: { value: 'a@pns.vn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
    await waitFor(() => expect(handlers['POST /auth/forgot-password']).toHaveBeenCalledTimes(1));
    const request = handlers['POST /auth/forgot-password'].mock.lastCall![0];
    expect(await request.json()).toEqual({ email: 'a@pns.vn' });
    expect(await screen.findByPlaceholderText('000000')).toBeTruthy();
  });
});
