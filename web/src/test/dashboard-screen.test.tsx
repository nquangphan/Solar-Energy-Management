// Trang chủ (Story 8.1): what the screen shows follows what the backend sent —
// no revenue KPI at all when `revenue` is null, no order blocks when the counts
// are null — plus period switching, the 403 empty state and the error retry.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import {
  DEMO_DASHBOARD_SUMMARY,
  DEMO_ME,
  FakeDashboardPort,
  FakeMePort,
  PermissionsProvider,
} from '../design-system/session';
import type { DashboardPeriod, DashboardPort, DashboardSummary } from '../design-system/session';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';

afterEach(cleanup);

const ME = new FakeMePort({ ...DEMO_ME, permissions: ['orders.view_own'] });

function renderScreen(port: DashboardPort) {
  return render(
    <PermissionsProvider port={ME}>
      <DashboardScreen port={port} />
    </PermissionsProvider>,
  );
}

const bars = () => [...document.querySelectorAll('.chart .bar span')].map((s) => s.textContent);

describe('DashboardScreen', () => {
  it('with revenue: the accent KPI shows it through formatVnd, the chart has all ten statuses', async () => {
    renderScreen(new FakeDashboardPort());
    expect(await screen.findByText('1.240.000.000 đ')).toBeTruthy();
    expect(screen.getByText('Doanh thu tháng này').closest('.kpi')?.className).toContain('accent');
    expect(bars()).toEqual([
      'Báo giá',
      'Chờ duyệt',
      'Đã chốt',
      'Đã cọc',
      'Đang thi công',
      'Nghiệm thu',
      'Đang giao',
      'Đã giao',
      'Hoàn thành',
      'Huỷ',
    ]);
    expect(screen.getByText('01/10/2026 – 23/10/2026')).toBeTruthy();
  });

  it('revenue null ⇒ no Doanh thu anywhere in the DOM, the order count still shows', async () => {
    renderScreen(new FakeDashboardPort({ ...DEMO_DASHBOARD_SUMMARY, revenue: null }));
    expect(await screen.findByText('Đơn mới tháng này')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Doanh thu');
    expect(document.querySelectorAll('.kpi')).toHaveLength(1);
  });

  it('order blocks null ⇒ no order KPI and no chart, revenue still shows', async () => {
    renderScreen(
      new FakeDashboardPort({ ...DEMO_DASHBOARD_SUMMARY, newOrderCount: null, ordersByStatus: null }),
    );
    expect(await screen.findByText('Doanh thu tháng này')).toBeTruthy();
    expect(screen.queryByText('Đơn mới tháng này')).toBeNull();
    expect(screen.queryByText('Đơn theo trạng thái')).toBeNull();
  });

  it('switching period asks the port again with the new period and relabels the KPIs', async () => {
    const port = new FakeDashboardPort();
    renderScreen(port);
    await screen.findByText('Doanh thu tháng này');
    fireEvent.click(screen.getByText('Tuần'));
    expect(await screen.findByText('Doanh thu tuần này')).toBeTruthy();
    fireEvent.click(screen.getByText('Ngày'));
    expect(await screen.findByText('Doanh thu hôm nay')).toBeTruthy();
    expect(port.calls).toEqual(['month', 'week', 'day']);
    expect(screen.getByText('Ngày').className).toBe('active');
    expect(screen.getByText('Tuần').className).not.toBe('active');
  });

  it('Trang chủ is the active sidebar link', async () => {
    renderScreen(new FakeDashboardPort());
    await screen.findByText('Doanh thu tháng này');
    expect(document.querySelector('.navlink.active')?.textContent).toBe('Trang chủ');
  });

  it('while a new period loads, the old figures are not shown under the new label', async () => {
    const pending = new Map<DashboardPeriod, (s: DashboardSummary) => void>();
    const port: DashboardPort = {
      getSummary: (period) => new Promise((resolve) => pending.set(period, resolve)),
    };
    renderScreen(port);
    await vi.waitFor(() => expect(pending.has('month')).toBe(true));
    pending.get('month')!(DEMO_DASHBOARD_SUMMARY);
    expect(await screen.findByText('1.240.000.000 đ')).toBeTruthy();
    fireEvent.click(screen.getByText('Tuần'));
    await vi.waitFor(() => expect(pending.has('week')).toBe(true));
    expect(screen.queryByText('1.240.000.000 đ')).toBeNull();
    expect(screen.queryByText('Doanh thu tuần này')).toBeNull();
    expect(document.querySelectorAll('.kpi')).toHaveLength(0);
  });

  it('a late answer for an old period never replaces the newer one', async () => {
    const pending = new Map<DashboardPeriod, (s: DashboardSummary) => void>();
    const port: DashboardPort = {
      getSummary: (period) => new Promise((resolve) => pending.set(period, resolve)),
    };
    renderScreen(port);
    await vi.waitFor(() => expect(pending.has('month')).toBe(true));
    fireEvent.click(screen.getByText('Tuần'));
    await vi.waitFor(() => expect(pending.has('week')).toBe(true));
    pending.get('week')!({ ...DEMO_DASHBOARD_SUMMARY, period: 'week', newOrderCount: 5 });
    expect(await screen.findByText('Đơn mới tuần này')).toBeTruthy();
    pending.get('month')!({ ...DEMO_DASHBOARD_SUMMARY, newOrderCount: 99 });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.queryByText('99')).toBeNull();
  });

  it('a port error shows ErrorState and Thử lại asks again', async () => {
    const getSummary = vi
      .fn<DashboardPort['getSummary']>()
      .mockRejectedValueOnce(new ApiError('Lỗi', { status: 500 }))
      .mockResolvedValueOnce(DEMO_DASHBOARD_SUMMARY);
    renderScreen({ getSummary });
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('1.240.000.000 đ')).toBeTruthy();
    expect(getSummary).toHaveBeenCalledTimes(2);
  });

  it('403 (no block at all) ⇒ an empty state, not an endless retry', async () => {
    renderScreen({ getSummary: () => Promise.reject(new ApiError('Không có quyền.', { status: 403 })) });
    expect(await screen.findByText('Không có số liệu cho tài khoản này')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });
});
