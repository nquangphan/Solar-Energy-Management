// Audit log (Story 8.5): what the screen prints follows what the backend sent —
// "Hệ thống" for a system actor, money through formatVnd, a status through its
// label — plus filters that reset the page, the empty and error states, and a
// slow earlier reply that must not repaint the table.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import { DEMO_AUDIT_LOGS, DEMO_ME, FakeAuditLogsPort, FakeMePort, PermissionsProvider } from '../design-system/session';
import type { AuditLogEntry, AuditLogPage, AuditLogQuery, AuditLogsPort } from '../design-system/session';
import { AuditLogScreen } from '../screens/audit/AuditLogScreen';

afterEach(cleanup);

const ME = new FakeMePort({ ...DEMO_ME, permissions: ['audit.read'] });

function renderScreen(port: AuditLogsPort) {
  return render(
    <PermissionsProvider port={ME}>
      <AuditLogScreen port={port} />
    </PermissionsProvider>,
  );
}

/** The target-type filter (a Seg of links). */
const seg = (name: string) =>
  within(document.querySelector('.seg') as HTMLElement).getByRole('link', {
    name,
  });

const rows = () =>
  [...document.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent));

const page = (items: AuditLogEntry[], over: Partial<AuditLogPage> = {}): AuditLogPage => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  ...over,
});

describe('AuditLogScreen', () => {
  it('renders who · action · target · before → after · when for every record', async () => {
    renderScreen(new FakeAuditLogsPort());
    await screen.findByText('Trần Kinh Doanh');
    expect(rows()).toEqual([
      ['Trần Kinh Doanh', 'Chốt đơn', 'Đơn hàng 9f8e7d6c', 'status: Báo giá → Đã chốt', '30/10/2026 · 10:05'],
      ['Lê Kế Toán', 'Ghi nhận thanh toán', 'Đơn hàng 9f8e7d6c', 'orderPaid: 0 đ → 83.010.960 đ', '29/10/2026 · 16:30'],
      ['Hệ thống', 'Chuyển trạng thái', 'Đơn hàng 9f8e7d6c', 'status: Đã chốt → Đã cọc', '29/10/2026 · 16:30'],
      ['33333333', 'Đổi mật khẩu', '—', '—', '28/10/2026 · 08:00'],
    ]);
  });

  it('prints a value as sent when it is not a money integer or a known status; null as —', async () => {
    const entry: AuditLogEntry = {
      ...DEMO_AUDIT_LOGS[0],
      targetType: 'Customer',
      targetId: '+84903176968',
      changes: [
        { field: 'status', before: null, after: 'unknown', isMoney: false },
        { field: 'total', before: '1.5', after: 'abc', isMoney: true },
        { field: '', before: '["a"]', after: '["a","b"]', isMoney: false },
      ],
    };
    renderScreen(new FakeAuditLogsPort(page([entry])));
    await screen.findByText('Chốt đơn');
    expect(rows()[0][2]).toBe('Khách hàng +84903176968');
    expect(rows()[0][3]).toBe('status: — → unknowntotal: 1.5 → abc["a"] → ["a","b"]');
  });

  it('a money value is formatted only when it is a plain safe integer', async () => {
    const entry: AuditLogEntry = {
      ...DEMO_AUDIT_LOGS[0],
      changes: [
        { field: 'lines[0].qty', before: '5', after: '10', isMoney: false },
        { field: 'amount', before: '', after: '1e3', isMoney: true },
        { field: 'total', before: '9007199254740993', after: '-500000', isMoney: true },
      ],
    };
    renderScreen(new FakeAuditLogsPort(page([entry])));
    await screen.findByText('Chốt đơn');
    expect(rows()[0][3]).toBe('lines[0].qty: 5 → 10amount:  → 1e3total: 9007199254740993 → -500.000 đ');
  });

  it('each date picker is bounded by the other end of the range', async () => {
    renderScreen(new FakeAuditLogsPort());
    await screen.findByText('Trần Kinh Doanh');
    const from = screen.getByLabelText('Từ ngày') as HTMLInputElement;
    const to = screen.getByLabelText('Đến ngày') as HTMLInputElement;
    expect([from.max, to.min, to.max]).toEqual(['9999-12-31', '', '9999-12-31']);
    fireEvent.change(from, { target: { value: '2026-10-01' } });
    fireEvent.change(to, { target: { value: '2026-10-30' } });
    expect([from.max, to.min]).toEqual(['2026-10-30', '2026-10-01']);
  });

  it('there is no edit, delete or export control, and no role wording', async () => {
    renderScreen(new FakeAuditLogsPort());
    await screen.findByText('Trần Kinh Doanh');
    for (const word of [/sửa$/i, /xoá$/i, /xuất/i]) {
      expect(screen.queryByRole('button', { name: word })).toBeNull();
    }
    expect(document.body.textContent).not.toContain('Super Admin');
  });

  it('changing the target filter or a date sends the query and returns to page 1', async () => {
    const port = new FakeAuditLogsPort();
    renderScreen(port);
    await screen.findByText('Trang 1/3');
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByText('Trang 2/3');
    expect(port.calls.at(-1)).toEqual({ page: 2 });

    fireEvent.click(seg('Đơn hàng'));
    await screen.findByText('Trang 1/3');
    expect(port.calls.at(-1)).toEqual({ targetType: 'Order', page: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByText('Trang 2/3');
    fireEvent.change(screen.getByLabelText('Từ ngày'), {
      target: { value: '2026-10-01' },
    });
    await screen.findByText('Trang 1/3');
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByText('Trang 2/3');
    fireEvent.change(screen.getByLabelText('Đến ngày'), {
      target: { value: '2026-10-30' },
    });
    await screen.findByText('Trang 1/3');
    await vi.waitFor(() =>
      expect(port.calls.at(-1)).toEqual({
        targetType: 'Order',
        from: '2026-10-01',
        to: '2026-10-30',
        page: 1,
      }),
    );

    fireEvent.click(seg('Tất cả'));
    fireEvent.change(screen.getByLabelText('Từ ngày'), {
      target: { value: '' },
    });
    await vi.waitFor(() => expect(port.calls.at(-1)).toEqual({ to: '2026-10-30', page: 1 }));
  });

  it('every one of the nine target types is a filter option', async () => {
    renderScreen(new FakeAuditLogsPort());
    await screen.findByText('Trần Kinh Doanh');
    for (const label of [
      'Tất cả',
      'Đơn hàng',
      'Account',
      'Sản phẩm',
      'Nhóm sản phẩm',
      'Khách hàng',
      'Nguồn khách',
      'Phiếu kho',
      'Cờ tính năng',
      'Cấu hình',
    ]) {
      expect(seg(label), label).toBeTruthy();
    }
  });

  it('an empty book and an empty filtered view say different things', async () => {
    renderScreen(new FakeAuditLogsPort(page([])));
    expect(await screen.findByText('Chưa có bản ghi nào')).toBeTruthy();
    fireEvent.click(seg('Phiếu kho'));
    expect(await screen.findByText('Không có bản ghi phù hợp')).toBeTruthy();
  });

  it('a failure shows the backend sentence and Thử lại loads again', async () => {
    const port = new FakeAuditLogsPort();
    const list = vi.spyOn(port, 'listAuditLogs').mockRejectedValueOnce(
      new ApiError('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.', {
        status: 400,
        code: 'VALIDATION_ERROR',
      }),
    );
    renderScreen(port);
    expect(await screen.findByText('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Trần Kinh Doanh')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('a failure without a message falls back to a generic sentence', async () => {
    const port: AuditLogsPort = {
      listAuditLogs: () => Promise.reject(new Error('')),
    };
    renderScreen(port);
    expect(await screen.findByText('Không tải được nhật ký Audit.')).toBeTruthy();
  });

  it('a slow reply to an earlier filter does not repaint the table', async () => {
    let releaseFirst: (value: AuditLogPage) => void = () => {};
    const port: AuditLogsPort = {
      listAuditLogs: (query: AuditLogQuery) =>
        query.targetType === undefined
          ? new Promise((resolve) => {
              releaseFirst = resolve;
            })
          : Promise.resolve(page([{ ...DEMO_AUDIT_LOGS[0], actorDisplayName: 'Người mới' }])),
    };
    renderScreen(port);
    await screen.findByText('Đang tải nhật ký…');
    fireEvent.click(seg('Sản phẩm'));
    expect(await screen.findByText('Người mới')).toBeTruthy();
    releaseFirst(page([{ ...DEMO_AUDIT_LOGS[0], actorDisplayName: 'Người cũ' }]));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Người cũ')).toBeNull();
    expect(screen.getByText('Người mới')).toBeTruthy();
  });

  it('the pager walks back and forth and stops at both ends; one page shows no pager', async () => {
    const port = new FakeAuditLogsPort();
    renderScreen(port);
    await screen.findByText('Trang 1/3');
    const prev = () => screen.getByRole('button', { name: 'Trước' }) as HTMLButtonElement;
    const next = () => screen.getByRole('button', { name: 'Sau' }) as HTMLButtonElement;
    expect(prev().disabled).toBe(true);
    fireEvent.click(next());
    await screen.findByText('Trang 2/3');
    fireEvent.click(next());
    await screen.findByText('Trang 3/3');
    expect(next().disabled).toBe(true);
    fireEvent.click(prev());
    await screen.findByText('Trang 2/3');
    expect(port.calls.map((q) => q.page)).toEqual([1, 2, 3, 2]);

    cleanup();
    renderScreen(new FakeAuditLogsPort(page([DEMO_AUDIT_LOGS[0]])));
    await screen.findByText('Chốt đơn');
    expect(screen.queryByRole('button', { name: 'Trước' })).toBeNull();
    expect(screen.queryByText(/^Trang \d+\/\d+$/)).toBeNull();
  });

  it('a slow FAILURE of an earlier filter does not replace the newer table', async () => {
    let failFirst: (reason: unknown) => void = () => {};
    const port: AuditLogsPort = {
      listAuditLogs: (query: AuditLogQuery) =>
        query.targetType === undefined
          ? new Promise((_resolve, reject) => {
              failFirst = reject;
            })
          : Promise.resolve(page([{ ...DEMO_AUDIT_LOGS[0], actorDisplayName: 'Người mới' }])),
    };
    renderScreen(port);
    await screen.findByText('Đang tải nhật ký…');
    fireEvent.click(seg('Sản phẩm'));
    expect(await screen.findByText('Người mới')).toBeTruthy();
    failFirst(new ApiError('Lỗi cũ.', { status: 500, code: 'INTERNAL' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Lỗi cũ.')).toBeNull();
    expect(screen.getByText('Người mới')).toBeTruthy();
  });
});
