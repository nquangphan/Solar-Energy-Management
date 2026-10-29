// The application layer (routes + gating + sidebar navigation) over fake ports. Not the
// composition root — app-entry.test.tsx drives main.tsx end to end with a stubbed fetch.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes, SignedOutRoutes } from '../app/AppRoutes';
import type { AppPorts } from '../app/AppRoutes';
import { AVAILABLE_NAV_KEYS, NAV_ROUTES } from '../app/routes';
import {
  DEMO_ACCOUNTS,
  FakeAccountsPort,
  FakeAuditLogsPort,
  FakeAuthPort,
  FakeCatalogPort,
  FakeContractsPort,
  FakeCustomerSourcesPort,
  FakeCustomersPort,
  FakeDashboardPort,
  FakeInventoryPort,
  FakeInvoicesPort,
  FakeMePort,
  FakeOrdersPort,
  FakePasswordPort,
  FakePaymentsPort,
  FakeProfitReportPort,
  FakeSettingsPort,
  FakeStockVouchersPort,
  FakeWarrantyPort,
  PermissionsProvider,
} from '../design-system/session';
import { SIDEBAR_NAV } from '../design-system/shell';

afterEach(cleanup);

const ALL_PERMISSIONS = [
  'audit.read',
  'catalog.view',
  'costs.view',
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
    me: new FakeMePort({ id: 'acc-1', email: 'a@pns.vn', phone: null, displayName: 'A', permissions }),
    password: new FakePasswordPort(),
    customers: new FakeCustomersPort(),
    customerSources: new FakeCustomerSourcesPort(),
    catalog: new FakeCatalogPort(),
    settings: new FakeSettingsPort(),
    warranty: new FakeWarrantyPort(),
    orders: new FakeOrdersPort(),
    inventory: new FakeInventoryPort(),
    stockVouchers: new FakeStockVouchersPort(),
    payments: new FakePaymentsPort(),
    contracts: new FakeContractsPort(),
    invoices: new FakeInvoicesPort(),
    dashboard: new FakeDashboardPort(),
    accounts: new FakeAccountsPort(),
    auditLogs: new FakeAuditLogsPort(),
    profitReport: new FakeProfitReportPort(),
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
  it('an orders.view_own account sees Trang chủ + Đơn hàng + Tra cứu bảo hành + Hồ sơ, and /customers lands on /dashboard', async () => {
    renderAt('/customers', ports(['orders.view_own']));
    expect(await screen.findByText('Tra cứu bảo hành', { selector: 'a.navlink' })).toBeTruthy();
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    // The dashboard rendered instead of the customer list.
    expect(topbarTitle()).toContain('Tổng quan vận hành');
    expect(topbarTitle()).not.toContain('Khách hàng');
    expect(navLabels()).toEqual(['Trang chủ', 'Đơn hàng', 'Tra cứu bảo hành', 'Hồ sơ']);
    for (const hidden of ['Khách hàng', 'Cấu hình', 'Kho', 'Danh mục', 'Phân quyền', 'Audit', 'Lợi nhuận']) {
      expect(navLabels()).not.toContain(hidden);
    }
  });

  it('/settings without settings.manage does not render the config screen', async () => {
    renderAt('/settings', ports(['orders.view_own']));
    await screen.findByText('Tra cứu bảo hành', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
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

  it('Phân quyền: permissions.manage shows the link and opens /permissions; without it the link is hidden and the URL lands on /dashboard', async () => {
    const appPorts = ports(ALL_PERMISSIONS);
    const list = vi.spyOn(appPorts.accounts, 'listAccounts');
    renderAt('/profile', appPorts);
    fireEvent.click(await screen.findByText('Phân quyền', { selector: 'a.navlink' }));
    expect(screen.getByTestId('path').textContent).toBe('/permissions');
    await vi.waitFor(() => expect(topbarTitle()).toContain('Phân quyền & tài khoản'));
    expect(list).toHaveBeenCalledTimes(1);
    cleanup();

    const without = ports(ALL_PERMISSIONS.filter((key) => key !== 'permissions.manage'));
    const listWithout = vi.spyOn(without.accounts, 'listAccounts');
    renderAt('/permissions', without);
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(navLabels()).not.toContain('Phân quyền');
    expect(listWithout).not.toHaveBeenCalled();
  });

  it('Audit: audit.read shows the link and opens /audit; without it (even with every other key) the link is hidden and /audit lands on /dashboard', async () => {
    const appPorts = ports(ALL_PERMISSIONS);
    const list = vi.spyOn(appPorts.auditLogs, 'listAuditLogs');
    renderAt('/profile', appPorts);
    fireEvent.click(await screen.findByText('Audit', { selector: 'a.navlink' }));
    expect(screen.getByTestId('path').textContent).toBe('/audit');
    await vi.waitFor(() => expect(topbarTitle()).toContain('Audit log'));
    expect(list).toHaveBeenCalledTimes(1);
    cleanup();

    const without = ports(ALL_PERMISSIONS.filter((key) => key !== 'audit.read'));
    const listWithout = vi.spyOn(without.auditLogs, 'listAuditLogs');
    renderAt('/audit', without);
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(navLabels()).not.toContain('Audit');
    expect(listWithout).not.toHaveBeenCalled();
  });

  it('Lợi nhuận: costs.view shows the link under Báo cáo and opens /reports/profit; without it (even with every other key) the link is hidden and the URL lands on /dashboard', async () => {
    const appPorts = ports(ALL_PERMISSIONS);
    const report = vi.spyOn(appPorts.profitReport, 'getProfitReport');
    renderAt('/profile', appPorts);
    fireEvent.click(await screen.findByText('Lợi nhuận', { selector: 'a.navlink' }));
    expect(screen.getByTestId('path').textContent).toBe('/reports/profit');
    expect(NAV_ROUTES.profit).toBe('/reports/profit');
    await vi.waitFor(() => expect(topbarTitle()).toContain('Lợi nhuận gộp'));
    expect(report).toHaveBeenCalledTimes(1);
    const sections = Array.from(document.querySelectorAll('nav.sidebar .navsec')).map((s) => s.textContent);
    expect(sections).toEqual(['Báo cáo', 'Quản trị']);
    cleanup();

    const without = ports(
      ALL_PERMISSIONS.filter((key) => key !== 'costs.view').concat(['dashboard.finance_view', 'payments.record']),
    );
    const reportWithout = vi.spyOn(without.profitReport, 'getProfitReport');
    renderAt('/reports/profit', without);
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(navLabels()).not.toContain('Lợi nhuận');
    expect(reportWithout).not.toHaveBeenCalled();
  });

  it('the account form routes inherit the Phân quyền gate; /permissions/new is never an account id', async () => {
    const without = ports(ALL_PERMISSIONS.filter((key) => key !== 'permissions.manage'));
    const options = vi.spyOn(without.accounts, 'getPermissionOptions');
    const list = vi.spyOn(without.accounts, 'listAccounts');
    for (const path of ['/permissions/new', '/permissions/6f1c2a4e-0b7d-4c1a-9d3e-2f5a8b7c9d10/edit']) {
      renderAt(path, without);
      await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
      expect(screen.getByTestId('path').textContent, path).toBe('/dashboard');
      cleanup();
    }
    expect(options).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();

    const withPerm = ports(ALL_PERMISSIONS);
    const listWith = vi.spyOn(withPerm.accounts, 'listAccounts');
    renderAt('/permissions/new', withPerm);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Tạo tài khoản mới'));
    expect(listWith).not.toHaveBeenCalled();
  });

  it('"+ Tạo account" → save ⇒ back on /permissions with the new account selected; "Sửa account" opens its edit route', async () => {
    const appPorts = ports(ALL_PERMISSIONS);
    renderAt('/permissions', appPorts);
    fireEvent.click(await screen.findByRole('button', { name: /Tạo account/ }));
    expect(screen.getByTestId('path').textContent).toBe('/permissions/new');
    await screen.findByLabelText('Họ tên');
    fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Trần Văn A' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại (dùng đăng nhập)'), { target: { value: '0912 345 678' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@local.test' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu ban đầu'), { target: { value: 'MatKhau123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chọn preset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thợ khảo sát' }));
    // The fake answers `new-1`; point it at a listed account so the matrix can select it.
    vi.spyOn(appPorts.accounts, 'createAccount').mockResolvedValue({
      ...DEMO_ACCOUNTS[0],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu account' }));

    await vi.waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/permissions'));
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: /Trần Văn A/ }).getAttribute('aria-pressed')).toBe('true'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sửa account' }));
    expect(screen.getByTestId('path').textContent).toBe(`/permissions/${DEMO_ACCOUNTS[0].id}/edit`);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Sửa tài khoản'));
  });

  it('leaving the edit form — saved or cancelled — lands on /permissions with that account selected', async () => {
    const edited = DEMO_ACCOUNTS[1];
    for (const leave of ['Lưu account', 'Huỷ']) {
      renderAt(`/permissions/${edited.id}/edit`, ports(ALL_PERMISSIONS));
      await screen.findByLabelText('Họ tên');
      fireEvent.change(screen.getByLabelText('Số điện thoại (dùng đăng nhập)'), { target: { value: '0912 345 670' } });
      fireEvent.click(screen.getByRole('button', { name: leave }));

      await vi.waitFor(() => expect(screen.getByTestId('path').textContent, leave).toBe('/permissions'));
      await vi.waitFor(() =>
        expect(screen.getByRole('button', { name: /Lê Thị C/ }).getAttribute('aria-pressed'), leave).toBe('true'),
      );
      cleanup();
    }
  });

  it('"/" lands on Trang chủ (/dashboard) for every account: it is first in the sidebar and needs no permission', async () => {
    for (const permissions of [ALL_PERMISSIONS, ['orders.view_own'], ['customers.manage', 'settings.manage'], []]) {
      renderAt('/', ports(permissions));
      await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
      expect(screen.getByTestId('path').textContent, permissions.join(',')).toBe('/dashboard');
      await vi.waitFor(() => expect(topbarTitle()).toContain('Tổng quan vận hành'));
      cleanup();
    }
  });

  it('an unknown path lands on /dashboard too, even with no business permission', async () => {
    renderAt('/no-such-page', ports([]));
    await screen.findByText('Hồ sơ', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(navLabels()).toEqual(['Trang chủ', 'Hồ sơ']);
  });

  it('the customer child routes inherit the customers gate: neither renders nor calls the port', async () => {
    for (const path of ['/customers/lookup', '/customers/%2B84903176968']) {
      const appPorts = ports(['orders.view_own']);
      const get = vi.spyOn(appPorts.customers, 'get');
      renderAt(path, appPorts);
      await screen.findByText('Tra cứu bảo hành', { selector: 'a.navlink' });
      expect(screen.getByTestId('path').textContent).toBe('/dashboard');
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

describe('AppRoutes — orders and inventory (Story 10.5)', () => {
  const DOCS = ['orders.view_all', 'contracts.generate', 'invoices.manage'];
  /** Step 1 of CreateQuoteScreen is the Story 3.4 pick screen rendered whole. */
  const QUOTE_STEP_1 = 'Tra cứu theo số điện thoại';

  /** A real order in the fake, so the detail screen reaches `ready` and draws its actions. */
  async function withOrder(permissions: string[]) {
    const appPorts = ports(permissions);
    const order = await appPorts.orders.create({ customerPhone: '+84903176968' });
    return { appPorts, id: order.id };
  }

  async function openDetail(permissions: string[]) {
    const { appPorts, id } = await withOrder(permissions);
    renderAt(`/orders/${id}`, appPorts);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Chi tiết đơn'));
    await screen.findByRole('button', { name: 'Thanh toán' });
    return { appPorts, id };
  }

  it('AVAILABLE_NAV_KEYS carries orders and inventory (read from NAV_ROUTES)', () => {
    expect(Object.keys(NAV_ROUTES)).toEqual(expect.arrayContaining(['orders', 'inventory']));
    expect(AVAILABLE_NAV_KEYS.has('orders')).toBe(true);
    expect(AVAILABLE_NAV_KEYS.has('inventory')).toBe(true);
  });

  it('contracts.generate + invoices.manage: the detail shows all three buttons, each opens its screen for this order', async () => {
    const { appPorts, id } = await openDetail(DOCS);
    expect(navLabels()).toContain('Đơn hàng');
    for (const name of ['Thanh toán', 'Hợp đồng', 'Hoá đơn']) {
      expect(screen.getByRole('button', { name }), name).toBeTruthy();
    }
    const overview = vi.spyOn(appPorts.contracts, 'getOverview');
    fireEvent.click(screen.getByRole('button', { name: 'Hợp đồng' }));
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${id}/contracts`);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Sinh hợp đồng'));
    expect(overview).toHaveBeenCalledWith(id);
    cleanup();

    const second = await openDetail(DOCS);
    const invoices = vi.spyOn(second.appPorts.invoices, 'getOverview');
    fireEvent.click(screen.getByRole('button', { name: 'Hoá đơn' }));
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${second.id}/invoices`);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Hoá đơn bán hàng'));
    expect(invoices).toHaveBeenCalledWith(second.id);
    cleanup();

    const third = await openDetail(DOCS);
    const schedule = vi.spyOn(third.appPorts.payments, 'getSchedule');
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }));
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${third.id}/payments`);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Lịch thanh toán'));
    expect(schedule).toHaveBeenCalledWith(third.id);
  });

  it('orders.view_own only: Thanh toán but no Hợp đồng / Hoá đơn, and typing their URL lands on /dashboard', async () => {
    const { id } = await openDetail(['orders.view_own']);
    expect(screen.queryByRole('button', { name: 'Hợp đồng' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hoá đơn' })).toBeNull();
    cleanup();

    for (const path of [`/orders/${id}/contracts`, `/orders/${id}/invoices`, `/orders/${id}/invoices/inv-1`]) {
      const appPorts = ports(['orders.view_own']);
      const contracts = vi.spyOn(appPorts.contracts, 'getOverview');
      const invoices = vi.spyOn(appPorts.invoices, 'getOverview');
      const invoice = vi.spyOn(appPorts.invoices, 'getInvoice');
      renderAt(path, appPorts);
      await screen.findByText('Đơn hàng', { selector: 'a.navlink' });
      expect(screen.getByTestId('path').textContent, path).toBe('/dashboard');
      expect(topbarTitle()).not.toContain('Sinh hợp đồng');
      expect(topbarTitle()).not.toContain('Hoá đơn bán hàng');
      expect(contracts).toHaveBeenCalledTimes(0);
      expect(invoices).toHaveBeenCalledTimes(0);
      expect(invoice).toHaveBeenCalledTimes(0);
      cleanup();
    }
  });

  it('/orders/new needs quotes.create_edit; with it the quote builder opens, never a detail of order "new"', async () => {
    const without = ports(['orders.view_own']);
    renderAt('/orders/new', without);
    await screen.findByText('Đơn hàng', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(topbarTitle()).not.toContain(QUOTE_STEP_1);
    cleanup();

    const withPerm = ports(['orders.view_own', 'quotes.create_edit']);
    const get = vi.spyOn(withPerm.orders, 'get');
    renderAt('/orders/new', withPerm);
    await vi.waitFor(() => expect(topbarTitle()).toContain(QUOTE_STEP_1));
    expect(screen.getByTestId('path').textContent).toBe('/orders/new');
    expect(topbarTitle()).not.toContain('Chi tiết đơn');
    expect(get).toHaveBeenCalledTimes(0);
  });

  it('"+ Tạo đơn" is there with quotes.create_edit and absent without it — on a list with rows and on an empty one', async () => {
    const empty = { items: [], total: 0, page: 1, pageSize: 20 };
    for (const [permissions, expected] of [
      [['orders.view_all', 'quotes.create_edit'], 1],
      [['orders.view_all'], 0],
    ] as const) {
      renderAt('/orders', ports([...permissions]));
      await vi.waitFor(() => expect(screen.getAllByRole('button', { name: 'Xem' }).length).toBeGreaterThan(0));
      expect(screen.queryAllByRole('button', { name: '+ Tạo đơn' }), `rows ${permissions}`).toHaveLength(expected);
      cleanup();

      const appPorts = ports([...permissions]);
      vi.spyOn(appPorts.orders, 'list').mockResolvedValue(empty);
      renderAt('/orders', appPorts);
      await screen.findByText('Chưa có đơn nào');
      // Toolbar + empty state each carry the button when it may be used.
      expect(screen.queryAllByRole('button', { name: '+ Tạo đơn' }), `empty ${permissions}`).toHaveLength(expected * 2);
      expect(screen.queryByText('Bấm ➕Tạo để bắt đầu.') !== null).toBe(expected === 1);
      cleanup();
    }
  });

  it('"+ Tạo đơn" opens /orders/new', async () => {
    renderAt('/orders', ports(['orders.view_all', 'quotes.create_edit']));
    fireEvent.click(await screen.findByRole('button', { name: '+ Tạo đơn' }));
    expect(screen.getByTestId('path').textContent).toBe('/orders/new');
    await vi.waitFor(() => expect(topbarTitle()).toContain(QUOTE_STEP_1));
  });

  it('Duyệt chiết khấu: the list button and the route both need discounts.approve', async () => {
    renderAt('/orders', ports(['orders.view_all', 'discounts.approve']));
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt chiết khấu' }));
    expect(screen.getByTestId('path').textContent).toBe('/orders/discount-approvals');
    await vi.waitFor(() => expect(topbarTitle()).toContain('Duyệt chiết khấu'));
    cleanup();

    const without = ports(['orders.view_all']);
    const pending = vi.spyOn(without.orders, 'listPendingDiscounts');
    renderAt('/orders', without);
    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: 'Xem' }).length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Duyệt chiết khấu' })).toBeNull();
    cleanup();

    renderAt('/orders/discount-approvals', without);
    await screen.findByText('Đơn hàng', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(pending).toHaveBeenCalledTimes(0);
  });

  it('Kho: quotes.create_edit sees the stock but not Phiếu kho, and /inventory/vouchers lands on /dashboard', async () => {
    renderAt('/inventory', ports(['quotes.create_edit']));
    await vi.waitFor(() => expect(topbarTitle()).toContain('Tồn kho'));
    expect(navLabels()).toContain('Kho');
    expect(screen.queryByRole('button', { name: 'Phiếu kho' })).toBeNull();
    cleanup();

    const appPorts = ports(['quotes.create_edit']);
    const vouchers = vi.spyOn(appPorts.stockVouchers, 'listVouchers');
    renderAt('/inventory/vouchers', appPorts);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Tổng quan vận hành'));
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(vouchers).toHaveBeenCalledTimes(0);
  });

  it('Kho: inventory.manage opens Phiếu kho from the stock screen', async () => {
    renderAt('/inventory', ports(['inventory.manage']));
    fireEvent.click(await screen.findByRole('button', { name: 'Phiếu kho' }));
    expect(screen.getByTestId('path').textContent).toBe('/inventory/vouchers');
    await vi.waitFor(() => expect(topbarTitle()).toContain('Phiếu kho'));
  });

  it('a KE_TOAN-like account (orders + payments + invoices, no customers.manage) lands on /dashboard', async () => {
    renderAt('/', ports(['orders.view_all', 'payments.record', 'invoices.manage']));
    await screen.findByText('Đơn hàng', { selector: 'a.navlink' });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');
    expect(navLabels()).not.toContain('Khách hàng');
  });
});

describe('AppRoutes — order navigation wiring', () => {
  const DOCS = ['orders.view_all', 'contracts.generate', 'invoices.manage'];

  function back() {
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
  }

  it('the list row "Xem" opens that order’s detail; the detail’s back returns to /orders', async () => {
    const appPorts = ports(['orders.view_all']);
    const order = await appPorts.orders.create({ customerPhone: '+84903176968' });
    const get = vi.spyOn(appPorts.orders, 'get');
    renderAt('/orders', appPorts);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Xem' }))[0]);
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${order.id}`);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Chi tiết đơn'));
    expect(get).toHaveBeenCalledWith(order.id);

    back();
    expect(screen.getByTestId('path').textContent).toBe('/orders');
  });

  it('Chuyển trạng thái opens /orders/:id/transition for this order; its back returns to the detail', async () => {
    const appPorts = ports(['orders.view_all']);
    const order = await appPorts.orders.create({ customerPhone: '+84903176968' });
    // A confirmed order has a manual next step, so the button is drawn.
    await appPorts.orders.confirmOrder(order.id);
    renderAt(`/orders/${order.id}`, appPorts);
    const lifecycle = vi.spyOn(appPorts.orders, 'getLifecycle');
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển trạng thái' }));
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${order.id}/transition`);
    await vi.waitFor(() => expect(topbarTitle()).toContain('Chuyển trạng thái'));
    expect(lifecycle).toHaveBeenCalledWith(order.id);

    back();
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${order.id}`);
  });

  it('back from Thanh toán and from Hợp đồng returns to the order detail', async () => {
    const appPorts = ports(DOCS);
    const order = await appPorts.orders.create({ customerPhone: '+84903176968' });
    for (const path of [`/orders/${order.id}/payments`, `/orders/${order.id}/contracts`]) {
      renderAt(path, appPorts);
      await screen.findByRole('button', { name: 'Quay lại' });
      back();
      expect(screen.getByTestId('path').textContent, path).toBe(`/orders/${order.id}`);
      cleanup();
    }
  });

  it('invoices.manage: "Xem" on an invoice opens its detail; back returns to the invoice list', async () => {
    const appPorts = ports(DOCS);
    const order = await appPorts.orders.create({ customerPhone: '+84903176968' });
    const invoice = await appPorts.invoices.createInvoice(order.id);
    const getInvoice = vi.spyOn(appPorts.invoices, 'getInvoice');
    renderAt(`/orders/${order.id}/invoices`, appPorts);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem' }));
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${order.id}/invoices/${invoice.id}`);
    await vi.waitFor(() => expect(getInvoice).toHaveBeenCalledWith(order.id, invoice.id));

    back();
    expect(screen.getByTestId('path').textContent).toBe(`/orders/${order.id}/invoices`);
  });

  it('back from Phiếu kho returns to /inventory', async () => {
    // With orders.view_all the landing is /orders, so a wrong back target cannot fall through the gate to /inventory.
    renderAt('/inventory/vouchers', ports(['orders.view_all', 'inventory.manage']));
    await vi.waitFor(() => expect(topbarTitle()).toContain('Phiếu kho'));
    back();
    expect(screen.getByTestId('path').textContent).toBe('/inventory');
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
