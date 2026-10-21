// The application layer (routes + gating + sidebar navigation) over fake ports. Not the
// composition root — app-entry.test.tsx drives main.tsx end to end with a stubbed fetch.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes, SignedOutRoutes } from '../app/AppRoutes';
import type { AppPorts } from '../app/AppRoutes';
import { AVAILABLE_NAV_KEYS, NAV_ROUTES } from '../app/routes';
import {
  FakeAuthPort,
  FakeCatalogPort,
  FakeCustomerSourcesPort,
  FakeCustomersPort,
  FakeMePort,
  FakePasswordPort,
  FakeSettingsPort,
  FakeWarrantyPort,
  PermissionsProvider,
} from '../design-system/session';
import { SIDEBAR_NAV } from '../design-system/shell';

afterEach(cleanup);

const ALL_PERMISSIONS = [
  'audit.read',
  'catalog.view',
  'customers.manage',
  'inventory.manage',
  'orders.view_all',
  'permissions.manage',
  'quotes.create_edit',
  'settings.manage',
];

function ports(permissions: string[]): AppPorts {
  return {
    auth: new FakeAuthPort(),
    me: new FakeMePort({ id: 'acc-1', email: 'a@pns.vn', displayName: 'A', permissions }),
    password: new FakePasswordPort(),
    customers: new FakeCustomersPort(),
    customerSources: new FakeCustomerSourcesPort(),
    catalog: new FakeCatalogPort(),
    settings: new FakeSettingsPort(),
    warranty: new FakeWarrantyPort(),
  };
}

function LocationProbe() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderAt(path: string, appPorts: AppPorts) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PermissionsProvider port={appPorts.me}>
        <AppRoutes ports={appPorts} onLogout={vi.fn()} onRetry={vi.fn()} />
      </PermissionsProvider>
      <LocationProbe />
    </MemoryRouter>,
  );
}

function topbarTitle(): string {
  return document.querySelector('.topbar-title')?.textContent ?? '';
}

function navLabels(): string[] {
  return Array.from(document.querySelectorAll('nav.sidebar a.navlink')).map((a) => a.textContent ?? '');
}

describe('AppRoutes', () => {
  it('an orders.view_own account sees only Tra cứu bảo hành + Hồ sơ, and /customers lands on /warranty', async () => {
    renderAt('/customers', ports(['orders.view_own']));
    expect(await screen.findByText('Tra cứu bảo hành', { selector: 'a.navlink' })).toBeTruthy();
    expect(screen.getByTestId('path').textContent).toBe('/warranty');
    // The warranty screen rendered instead of the customer list.
    expect(topbarTitle()).toContain('Tra cứu bảo hành');
    expect(topbarTitle()).not.toContain('Khách hàng');
    expect(navLabels()).toEqual(['Tra cứu bảo hành', 'Hồ sơ']);
    for (const hidden of ['Khách hàng', 'Cấu hình', 'Đơn hàng', 'Kho', 'Trang chủ', 'Danh mục', 'Phân quyền', 'Audit']) {
      expect(navLabels()).not.toContain(hidden);
    }
  });

  it('/settings without settings.manage does not render the config screen', async () => {
    renderAt('/settings', ports(['orders.view_own']));
    await screen.findByText('Tra cứu bảo hành', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/warranty');
    expect(screen.queryByText('Nguồn khách hàng')).toBeNull();
  });

  it('a full account navigates by the sidebar: Khách hàng → row → detail (E.164 + survives the URL) → Cấu hình', async () => {
    const appPorts = ports(ALL_PERMISSIONS);
    const get = vi.spyOn(appPorts.customers, 'get');
    renderAt('/profile', appPorts);

    fireEvent.click(await screen.findByText('Khách hàng', { selector: 'a.navlink' }));
    expect(screen.getByTestId('path').textContent).toBe('/customers');
    // The list loaded from the port.
    expect(await screen.findByText('+84903176968')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Xem' })[0]);
    expect(screen.getByTestId('path').textContent).toBe('/customers/%2B84903176968');
    await vi.waitFor(() => expect(topbarTitle()).toContain('Nguyễn Văn A'));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('+84903176968');

    fireEvent.click(screen.getByText('Cấu hình', { selector: 'a.navlink' }));
    expect(screen.getByTestId('path').textContent).toBe('/settings');
    expect(await screen.findByText('Nguồn khách hàng')).toBeTruthy();
  });

  it('"/" lands on the first openable route in sidebar order', async () => {
    renderAt('/', ports(ALL_PERMISSIONS));
    await screen.findByText('Khách hàng', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/customers');
  });

  it('"/" for an orders.view_own account lands on /warranty', async () => {
    renderAt('/', ports(['orders.view_own']));
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/warranty');
  });

  it('an account with no business permission lands on /profile from "/" and from an unknown path', async () => {
    renderAt('/', ports([]));
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/profile');
    cleanup();
    renderAt('/no-such-page', ports([]));
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/profile');
  });

  it('the customer child routes inherit the customers gate: neither renders nor calls the port', async () => {
    for (const path of ['/customers/lookup', '/customers/%2B84903176968']) {
      const appPorts = ports(['orders.view_own']);
      const get = vi.spyOn(appPorts.customers, 'get');
      renderAt(path, appPorts);
      await screen.findByText('Tra cứu bảo hành', { selector: 'a.navlink' });
      expect(screen.getByTestId('path').textContent).toBe('/warranty');
      expect(topbarTitle()).not.toContain('Tra cứu theo số điện thoại');
      expect(get).toHaveBeenCalledTimes(0);
      cleanup();
    }
  });

  it('a deep link to /customers/%2B… opens the detail with the decoded E.164 phone', async () => {
    const appPorts = ports(ALL_PERMISSIONS);
    const get = vi.spyOn(appPorts.customers, 'get');
    renderAt('/customers/%2B84903176968', appPorts);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Nguyễn Văn A'));
    expect(screen.getByTestId('path').textContent).toBe('/customers/%2B84903176968');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('+84903176968');
  });

  it('+ Thêm khách → lookup → Dùng khách này opens that customer’s detail', async () => {
    const appPorts = ports(ALL_PERMISSIONS);
    const lookup = vi.spyOn(appPorts.customers, 'lookup');
    const get = vi.spyOn(appPorts.customers, 'get');
    renderAt('/customers', appPorts);

    fireEvent.click((await screen.findAllByRole('button', { name: '+ Thêm khách' }))[0]);
    expect(screen.getByTestId('path').textContent).toBe('/customers/lookup');
    expect(topbarTitle()).toContain('Tra cứu theo số điện thoại');

    fireEvent.change(screen.getByLabelText('SĐT'), { target: { value: '0903 176 968' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dùng khách này' }));
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('0903 176 968');
    expect(screen.getByTestId('path').textContent).toBe('/customers/%2B84903176968');
    await vi.waitFor(() => expect(topbarTitle()).toContain('Nguyễn Văn A'));
    expect(get).toHaveBeenCalledWith('+84903176968');
  });

  it('the sidebar shows exactly the routed keys (availableKeys = the route table)', async () => {
    expect([...AVAILABLE_NAV_KEYS]).toEqual(Object.keys(NAV_ROUTES));
    renderAt('/profile', ports(ALL_PERMISSIONS));
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    const expected = SIDEBAR_NAV.flatMap((section) => section.links)
      .filter((link) => Object.hasOwn(NAV_ROUTES, link.key))
      .map((link) => link.label);
    expect(expected.length).toBe(Object.keys(NAV_ROUTES).length);
    expect(navLabels()).toEqual(expected);
  });
});

describe('SignedOutRoutes', () => {
  function renderSignedOut(path: string) {
    const onLoggedIn = vi.fn();
    render(
      <MemoryRouter initialEntries={[path]}>
        <SignedOutRoutes ports={{ auth: new FakeAuthPort(), password: new FakePasswordPort() }} onLoggedIn={onLoggedIn} />
        <LocationProbe />
      </MemoryRouter>,
    );
    return { onLoggedIn };
  }

  it('any other path goes to Đăng nhập', async () => {
    renderSignedOut('/customers');
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(screen.getByTestId('path').textContent).toBe('/login');
  });

  it('Quên mật khẩu? → /forgot-password → Quay lại đăng nhập → /login', async () => {
    const { onLoggedIn } = renderSignedOut('/login');
    fireEvent.click(await screen.findByRole('button', { name: 'Quên mật khẩu?' }));
    expect(screen.getByTestId('path').textContent).toBe('/forgot-password');
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại đăng nhập' }));
    expect(screen.getByTestId('path').textContent).toBe('/login');
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(onLoggedIn).toHaveBeenCalledTimes(0);
  });
});
