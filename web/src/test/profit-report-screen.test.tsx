// Profit report: the screen prints what the backend computed — KPIs
// from `totals`, money through the formatter, the margin as `N%` or `—` — and
// sends the grouping and the period it is asked for. A slow earlier reply must
// not repaint the table.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import {
  DEMO_ME,
  DEMO_PROFIT_ROWS,
  DEMO_PROFIT_TOTALS,
  FakeMePort,
  FakeProfitReportPort,
  PermissionsProvider,
} from '../design-system/session';
import type { ProfitReport, ProfitReportPort, ProfitReportQuery } from '../design-system/session';
import { formatVnd } from '../design-system/components';
import { ProfitReportScreen } from '../screens/reports/ProfitReportScreen';

afterEach(cleanup);

const ME = new FakeMePort({ ...DEMO_ME, permissions: ['costs.view'] });

function renderScreen(port: ProfitReportPort) {
  return render(
    <PermissionsProvider port={ME}>
      <ProfitReportScreen port={port} />
    </PermissionsProvider>,
  );
}

/** The n-th seg of the toolbar: 0 = grouping, 1 = period. */
const seg = (index: number, name: string) =>
  within(document.querySelectorAll('.seg')[index] as HTMLElement).getByRole('link', { name });

const headers = () => [...document.querySelectorAll('thead th')].map((th) => th.textContent);
const rows = () =>
  [...document.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent));
const kpis = () =>
  [...document.querySelectorAll('.kpi')].map((k) => [
    k.querySelector('.k-l')?.textContent,
    k.querySelector('.k-v')?.textContent,
  ]);

const report = (over: Partial<ProfitReport> = {}): ProfitReport => ({
  groupBy: 'order',
  from: '2026-10-01',
  to: '2026-10-30',
  totals: DEMO_PROFIT_TOTALS,
  rows: DEMO_PROFIT_ROWS.order,
  ...over,
});

describe('ProfitReportScreen', () => {
  it('shows the four KPIs from totals, the mandatory label and note, and one row per order', async () => {
    const port = new FakeProfitReportPort();
    renderScreen(port);
    await screen.findByText('BG-9F8E7D6C');
    expect(port.calls).toEqual([{ groupBy: 'order', period: 'month' }]);
    expect(kpis()).toEqual([
      ['Doanh thu', formatVnd(DEMO_PROFIT_TOTALS.revenue)],
      ['Giá vốn', formatVnd(DEMO_PROFIT_TOTALS.cost)],
      ['Lợi nhuận gộp', formatVnd(DEMO_PROFIT_TOTALS.grossProfit)],
      ['Biên gộp', `${DEMO_PROFIT_TOTALS.marginPct}%`],
    ]);
    expect(document.querySelector('.kpi.accent .k-l')?.textContent).toBe('Lợi nhuận gộp');
    expect(screen.getByText('Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung.')).toBeTruthy();
    expect(screen.getByText('Đơn chưa xuất kho không có trong báo cáo.')).toBeTruthy();
    expect(headers()).toEqual([
      'Đơn',
      'Khách',
      'Sale',
      'Nguồn',
      'Ngày xuất',
      'Doanh thu',
      'Giá vốn',
      'Lợi nhuận gộp',
      'Biên',
    ]);
    const first = DEMO_PROFIT_ROWS.order[0];
    expect(rows()[0]).toEqual([
      first.label,
      first.customerName,
      first.assigneeDisplayName,
      first.sourceName,
      '28/10',
      formatVnd(first.revenue),
      formatVnd(first.cost),
      formatVnd(first.grossProfit),
      `${first.marginPct}%`,
    ]);
    expect(rows()).toHaveLength(DEMO_PROFIT_ROWS.order.length);
  });

  it('a negative profit prints as the formatter does; a null margin and a missing assignee print —', async () => {
    renderScreen(new FakeProfitReportPort());
    await screen.findByText('BG-9F8E7D6C');
    const loss = DEMO_PROFIT_ROWS.order[2];
    const noRevenue = DEMO_PROFIT_ROWS.order[3];
    expect(loss.grossProfit).toBeLessThan(0);
    expect(noRevenue.marginPct).toBeNull();
    expect(rows()[2][2]).toBe('—');
    expect(rows()[2][7]).toBe(formatVnd(loss.grossProfit));
    expect(rows()[2][8]).toBe(`${loss.marginPct}%`);
    expect(rows()[3][8]).toBe('—');
  });

  it('a null total margin prints —', async () => {
    renderScreen({
      getProfitReport: () =>
        Promise.resolve(report({ totals: { revenue: 0, cost: 0, grossProfit: 0, marginPct: null, orderCount: 1 } })),
    });
    await screen.findByText('BG-9F8E7D6C');
    expect(kpis()[3]).toEqual(['Biên gộp', '—']);
  });

  it.each([
    ['Theo tháng', 'month', 'Tháng'],
    ['Theo sale', 'assignee', 'Sale'],
    ['Theo nguồn khách', 'source', 'Nguồn khách'],
  ] as const)('%s sends groupBy=%s and shows label · Số đơn · money columns', async (label, groupBy, header) => {
    const port = new FakeProfitReportPort();
    renderScreen(port);
    await screen.findByText('BG-9F8E7D6C');
    fireEvent.click(seg(0, label));
    const expected = DEMO_PROFIT_ROWS[groupBy];
    await screen.findByText(expected[0].label);
    expect(port.calls.at(-1)).toEqual({ groupBy, period: 'month' });
    expect(headers()).toEqual([header, 'Số đơn', 'Doanh thu', 'Giá vốn', 'Lợi nhuận gộp', 'Biên']);
    expect(rows()).toEqual(
      expected.map((r) => [
        r.label,
        String(r.orderCount),
        formatVnd(r.revenue),
        formatVnd(r.cost),
        formatVnd(r.grossProfit),
        r.marginPct === null ? '—' : `${r.marginPct}%`,
      ]),
    );
  });

  it('Năm nay sends period=year; Tuỳ chọn waits for both days then sends period=custom&from&to', async () => {
    const port = new FakeProfitReportPort();
    renderScreen(port);
    await screen.findByText('BG-9F8E7D6C');
    fireEvent.click(seg(1, 'Năm nay'));
    await vi.waitFor(() => expect(port.calls.at(-1)).toEqual({ groupBy: 'order', period: 'year' }));

    const callsBefore = port.calls.length;
    fireEvent.click(seg(1, 'Tuỳ chọn'));
    expect(await screen.findByText('Chọn từ ngày và đến ngày')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-07-01' } });
    expect(await screen.findByText('Chọn từ ngày và đến ngày')).toBeTruthy();
    expect(port.calls.length).toBe(callsBefore);

    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-07-31' } });
    await screen.findByText('BG-9F8E7D6C');
    expect(port.calls.at(-1)).toEqual({ groupBy: 'order', period: 'custom', from: '2026-07-01', to: '2026-07-31' });
    expect(screen.getByText('Xuất kho 01/07/2026 – 31/07/2026')).toBeTruthy();

    fireEvent.click(seg(0, 'Theo sale'));
    await vi.waitFor(() =>
      expect(port.calls.at(-1)).toEqual({ groupBy: 'assignee', period: 'custom', from: '2026-07-01', to: '2026-07-31' }),
    );

    fireEvent.click(seg(1, 'Tháng này'));
    await vi.waitFor(() => expect(port.calls.at(-1)).toEqual({ groupBy: 'assignee', period: 'month' }));
    expect(screen.queryByLabelText('Từ ngày')).toBeNull();
  });

  it('each date picker is bounded by the other end of the range', async () => {
    renderScreen(new FakeProfitReportPort());
    await screen.findByText('BG-9F8E7D6C');
    fireEvent.click(seg(1, 'Tuỳ chọn'));
    const from = screen.getByLabelText('Từ ngày') as HTMLInputElement;
    const to = screen.getByLabelText('Đến ngày') as HTMLInputElement;
    expect([from.max, to.min, to.max]).toEqual(['9999-12-31', '', '9999-12-31']);
    fireEvent.change(from, { target: { value: '2026-07-01' } });
    fireEvent.change(to, { target: { value: '2026-07-31' } });
    expect([from.max, to.min]).toEqual(['2026-07-31', '2026-07-01']);
  });

  it('only the end day typed still waits for the start day', async () => {
    const port = new FakeProfitReportPort();
    renderScreen(port);
    await screen.findByText('BG-9F8E7D6C');
    fireEvent.click(seg(1, 'Tuỳ chọn'));
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-07-31' } });
    expect(await screen.findByText('Chọn từ ngày và đến ngày')).toBeTruthy();
    expect(port.calls).toHaveLength(1);
  });

  it('an end day typed before the start ⇒ the range sentence, nothing sent, no Thử lại', async () => {
    const port = new FakeProfitReportPort();
    renderScreen(port);
    await screen.findByText('BG-9F8E7D6C');
    fireEvent.click(seg(1, 'Tuỳ chọn'));
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-07-31' } });
    expect(await screen.findByText('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.')).toBeTruthy();
    expect(port.calls).toHaveLength(1);
    expect(screen.queryByText('Thử lại')).toBeNull();

    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-08-01' } });
    await vi.waitFor(() =>
      expect(port.calls.at(-1)).toEqual({ groupBy: 'order', period: 'custom', from: '2026-08-01', to: '2026-08-01' }),
    );
  });

  it('no issued order ⇒ the empty sentence', async () => {
    renderScreen({ getProfitReport: () => Promise.resolve(report({ rows: [] })) });
    expect(await screen.findByText('Chưa có đơn đã xuất kho trong kỳ này.')).toBeTruthy();
    expect(document.querySelector('table')).toBeNull();
  });

  it('a failure shows the backend sentence and Thử lại loads again', async () => {
    const port = new FakeProfitReportPort();
    const get = vi
      .spyOn(port, 'getProfitReport')
      .mockRejectedValueOnce(new ApiError('Bạn không có quyền.', { status: 403, code: 'FORBIDDEN' }));
    renderScreen(port);
    expect(await screen.findByText('Bạn không có quyền.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('BG-9F8E7D6C')).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('a failure without a message falls back to a generic sentence', async () => {
    renderScreen({ getProfitReport: () => Promise.reject(new Error('')) });
    expect(await screen.findByText('Không tải được báo cáo lợi nhuận.')).toBeTruthy();
  });

  it('a slow reply to an earlier grouping does not repaint the table', async () => {
    let releaseFirst: (value: ProfitReport) => void = () => {};
    const port: ProfitReportPort = {
      getProfitReport: (query: ProfitReportQuery) =>
        query.groupBy === 'order'
          ? new Promise((resolve) => {
              releaseFirst = resolve;
            })
          : Promise.resolve(report({ groupBy: 'source', rows: DEMO_PROFIT_ROWS.source })),
    };
    renderScreen(port);
    await vi.waitFor(() => expect(document.querySelector('.skeleton, [class*="skel"]')).toBeTruthy());
    fireEvent.click(seg(0, 'Theo nguồn khách'));
    expect(await screen.findByText(DEMO_PROFIT_ROWS.source[0].label)).toBeTruthy();
    releaseFirst(report());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('BG-9F8E7D6C')).toBeNull();
    expect(headers()[0]).toBe('Nguồn khách');
  });

  it('a slow FAILURE of an earlier grouping does not replace the newer table with an error', async () => {
    let failFirst: (reason: unknown) => void = () => {};
    const port: ProfitReportPort = {
      getProfitReport: (query: ProfitReportQuery) =>
        query.groupBy === 'order'
          ? new Promise((_, reject) => {
              failFirst = reject;
            })
          : Promise.resolve(report({ groupBy: 'source', rows: DEMO_PROFIT_ROWS.source })),
    };
    renderScreen(port);
    await vi.waitFor(() => expect(document.querySelector('.skeleton, [class*="skel"]')).toBeTruthy());
    fireEvent.click(seg(0, 'Theo nguồn khách'));
    expect(await screen.findByText(DEMO_PROFIT_ROWS.source[0].label)).toBeTruthy();
    failFirst(new ApiError('Lỗi cũ.', { status: 500, code: 'INTERNAL' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Lỗi cũ.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(screen.getByText(DEMO_PROFIT_ROWS.source[0].label)).toBeTruthy();
  });

  it('a request still in flight when Tuỳ chọn starts waiting for days paints nothing', async () => {
    let releaseFirst: (value: ProfitReport) => void = () => {};
    const port: ProfitReportPort = {
      getProfitReport: () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    };
    renderScreen(port);
    await vi.waitFor(() => expect(document.querySelector('.skeleton, [class*="skel"]')).toBeTruthy());
    fireEvent.click(seg(1, 'Tuỳ chọn'));
    expect(await screen.findByText('Chọn từ ngày và đến ngày')).toBeTruthy();
    releaseFirst(report());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('Chọn từ ngày và đến ngày')).toBeTruthy();
    expect(screen.queryByText('BG-9F8E7D6C')).toBeNull();
    expect(document.querySelector('.kpi')).toBeNull();
  });

  it('has no Excel export and no month-over-month delta', async () => {
    renderScreen(new FakeProfitReportPort());
    await screen.findByText('BG-9F8E7D6C');
    expect(screen.queryByText(/Excel/i)).toBeNull();
    expect(screen.queryByText(/so tháng trước/)).toBeNull();
    expect(document.querySelector('.k-d')).toBeNull();
  });
});
