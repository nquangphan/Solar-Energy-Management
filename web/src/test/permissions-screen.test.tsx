// Phân quyền (Story 8.2): the checklist shows the stored set of the selected
// account; a preset only loads values (no port call); Lưu sends the full draft;
// the dependency gaps from `requires` block Lưu; `grantable`/`editable` from the
// backend disable boxes / the whole card; a save error keeps the ticks.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import { PERMISSION_KEYS as K } from '../design-system/gating/permission-keys.generated';
import {
  DEMO_ACCOUNTS,
  DEMO_ME,
  DEMO_PERMISSION_OPTIONS,
  FakeAccountsPort,
  FakeMePort,
  PermissionsProvider,
} from '../design-system/session';
import type { AccountPermissionSummary, AccountsPort } from '../design-system/session';
import { PermissionsScreen, dependencyWarnings, transitionsLine } from '../screens/permissions/PermissionsScreen';

afterEach(cleanup);

const ME = new FakeMePort({ ...DEMO_ME, permissions: [K.permissionsManage] });
const [WORKER, INACTIVE, OWNER] = DEMO_ACCOUNTS;

function renderScreen(port: AccountsPort) {
  return render(
    <PermissionsProvider port={ME}>
      <PermissionsScreen port={port} />
    </PermissionsProvider>,
  );
}

const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement;
const ticked = () => DEMO_PERMISSION_OPTIONS.permissions.filter((o) => box(o.label).checked).map((o) => o.key);

async function openAccount(port: AccountsPort, name: RegExp) {
  renderScreen(port);
  fireEvent.click(await screen.findByRole('button', { name }));
}

describe('PermissionsScreen', () => {
  it('"Tạo account" is in the topbar when the screen can open the form, absent otherwise', async () => {
    const onCreate = vi.fn();
    render(
      <PermissionsProvider port={ME}>
        <PermissionsScreen port={new FakeAccountsPort()} onCreate={onCreate} />
      </PermissionsProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Tạo account/ }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    cleanup();

    renderScreen(new FakeAccountsPort());
    await screen.findByRole('button', { name: /Trần Văn A/ });
    expect(screen.queryByRole('button', { name: /Tạo account/ })).toBeNull();
  });

  it('"Sửa account" shows only on an editable account and opens it', async () => {
    const onEdit = vi.fn();
    render(
      <PermissionsProvider port={ME}>
        <PermissionsScreen port={new FakeAccountsPort()} onEdit={onEdit} />
      </PermissionsProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Chủ vận hành/ }));
    expect(screen.queryByRole('button', { name: 'Sửa account' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Trần Văn A/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa account' }));
    expect(onEdit).toHaveBeenCalledWith(WORKER.id);
  });

  it('selectAccountId selects that account once the list loads (coming back from the form)', async () => {
    render(
      <PermissionsProvider port={ME}>
        <PermissionsScreen port={new FakeAccountsPort()} selectAccountId={INACTIVE.id} />
      </PermissionsProvider>,
    );
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: /Lê Thị C/ }).getAttribute('aria-pressed')).toBe('true'),
    );
    expect(ticked()).toEqual([...INACTIVE.permissions]);
  });

  it('the list shows name, phone, preset label or Tuỳ chỉnh, and Đã vô hiệu', async () => {
    renderScreen(new FakeAccountsPort());
    const row = await screen.findByRole('button', { name: /Trần Văn A/ });
    expect(row.textContent).toContain('+84901234567');
    expect(row.textContent).toContain('Thợ khảo sát');
    const inactive = screen.getByRole('button', { name: /Lê Thị C/ });
    expect(inactive.textContent).toContain('Tuỳ chỉnh');
    expect(inactive.textContent).toContain('Đã vô hiệu');
  });

  it('selecting an account ticks exactly its stored permissions', async () => {
    await openAccount(new FakeAccountsPort(), /Trần Văn A/);
    expect(ticked().sort()).toEqual([...WORKER.permissions].sort());
    expect(screen.getByRole('button', { name: /Trần Văn A/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Lê Thị C/ }).getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.perm-card-head .ktype')?.textContent).toBe('Thợ khảo sát');
  });

  it('Phân quyền is the active sidebar link', async () => {
    renderScreen(new FakeAccountsPort());
    await screen.findByRole('button', { name: /Trần Văn A/ });
    expect(document.querySelector('.navlink.active')?.textContent).toBe('Phân quyền');
  });

  it('a successful save puts the backend summary on the row, the card header and the ticks', async () => {
    const port = new FakeAccountsPort();
    // The reply differs from what was sent: the ticks must follow the backend, not the draft.
    const stored = [K.catalogView, K.paymentsRecord];
    vi.spyOn(port, 'updatePermissions').mockResolvedValue({
      ...WORKER,
      permissions: stored,
      matchingPreset: 'KE_TOAN',
      matchingPresetLabel: 'Kế toán',
    });
    await openAccount(port, /Trần Văn A/);
    fireEvent.click(screen.getByRole('button', { name: 'Áp preset role' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kế toán' }));
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(screen.getByRole('button', { name: /Trần Văn A/ }).textContent).toContain('Kế toán'));
    expect(document.querySelector('.perm-card-head .ktype')?.textContent).toBe('Kế toán');
    expect(ticked().sort()).toEqual([...stored].sort());
  });

  it('Lưu is disabled while a save is pending, so a double click sends once', async () => {
    const port = new FakeAccountsPort();
    let resolve!: (s: AccountPermissionSummary) => void;
    const update = vi.spyOn(port, 'updatePermissions').mockReturnValue(new Promise((r) => (resolve = r)));
    await openAccount(port, /Trần Văn A/);
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    expect(saveButton().disabled).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);

    resolve(WORKER);
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
  });

  it("switching account clears the previous account's save error", async () => {
    const port = new FakeAccountsPort();
    vi.spyOn(port, 'updatePermissions').mockRejectedValue(
      new ApiError('Không thể cấp quyền bạn không có: audit.read', { status: 403, code: 'FORBIDDEN' }),
    );
    await openAccount(port, /Trần Văn A/);
    fireEvent.click(saveButton());
    expect(await screen.findByText('Không thể cấp quyền bạn không có: audit.read')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Lê Thị C/ }));
    expect(screen.queryByText('Không thể cấp quyền bạn không có: audit.read')).toBeNull();
  });

  it('applying a preset changes the ticks but sends nothing; Lưu then sends the full draft', async () => {
    const port = new FakeAccountsPort();
    const update = vi.spyOn(port, 'updatePermissions');
    await openAccount(port, /Trần Văn A/);

    fireEvent.click(screen.getByRole('button', { name: 'Áp preset role' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kế toán' }));
    const keToan = DEMO_PERMISSION_OPTIONS.presets[1].permissions;
    expect(ticked().sort()).toEqual([...keToan].sort());
    expect(update).not.toHaveBeenCalled();
    // Picking a preset closes the sheet.
    expect(screen.queryByRole('button', { name: 'Kế toán' })).toBeNull();

    fireEvent.click(box('Sinh hợp đồng'));
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const [id, sent] = update.mock.calls[0];
    expect(id).toBe(WORKER.id);
    expect([...sent].sort()).toEqual([...keToan, K.contractsGenerate].sort());
  });

  it.each([
    [
      'settings.manage without customers.manage',
      [K.settingsManage, K.catalogView],
      '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».',
    ],
    [
      'quotes.create_edit without customers.manage',
      [K.quotesCreateEdit, K.catalogView, K.ordersViewOwn],
      '«Tạo/sửa báo giá» cần thêm «Quản lý khách hàng».',
    ],
  ])('%s ⇒ warning banner naming both and Lưu disabled', async (_name, keys, sentence) => {
    const account: AccountPermissionSummary = {
      ...WORKER,
      permissions: keys,
    };
    const port = new FakeAccountsPort([account]);
    await openAccount(port, /Trần Văn A/);
    expect(screen.getByText(sentence)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    // Adding what is missing clears the warning and enables Lưu.
    fireEvent.click(box('Quản lý khách hàng'));
    expect(screen.queryByText(sentence)).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it('several gaps read like the backend 400: gaps by key, missing keys by key', () => {
    expect(
      dependencyWarnings(DEMO_PERMISSION_OPTIONS.permissions, new Set([K.settingsManage, K.quotesCreateEdit])),
    ).toEqual([
      '«Tạo/sửa báo giá» cần thêm «Xem danh mục vật tư», «Quản lý khách hàng», một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».',
      '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».',
    ]);
  });

  it('"at least one of": no view scope ⇒ the backend sentence; either scope alone ⇒ none', () => {
    const options = DEMO_PERMISSION_OPTIONS.permissions;
    expect(dependencyWarnings(options, new Set([K.ordersConfirm]))).toEqual([
      '«Chốt đơn» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».',
    ]);
    expect(dependencyWarnings(options, new Set([K.ordersConfirm, K.ordersViewOwn]))).toEqual([]);
    expect(dependencyWarnings(options, new Set([K.ordersConfirm, K.ordersViewAll]))).toEqual([]);
  });

  it('AND and "một trong" join in one sentence, AND part first', () => {
    expect(
      dependencyWarnings(DEMO_PERMISSION_OPTIONS.permissions, new Set([K.quotesCreateEdit, K.catalogView])),
    ).toEqual(['«Tạo/sửa báo giá» cần thêm «Quản lý khách hàng», một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».']);
  });

  it('an "at least one of" gap shows the banner and disables Lưu until a view scope is ticked', async () => {
    const sentence = '«Chốt đơn» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».';
    const port = new FakeAccountsPort([{ ...WORKER, permissions: [K.ordersConfirm] }]);
    await openAccount(port, /Trần Văn A/);
    expect(screen.getByText(sentence)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(box('Chỉ xem đơn của mình'));
    expect(screen.queryByText(sentence)).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it('each permission that gates order steps shows them under its box, labels from StatusChip', async () => {
    await openAccount(new FakeAccountsPort(), /Trần Văn A/);
    expect(screen.getByText('Chuyển: Báo giá → Đã chốt · Chờ duyệt → Đã chốt')).toBeTruthy();
    expect(screen.getByText('Chuyển: Đã chốt → Đã cọc · Đã chốt → Hoàn thành')).toBeTruthy();
    expect(screen.getByText('Chuyển: Đã chốt → Báo giá · Báo giá → Huỷ · Đã chốt → Huỷ · Đã cọc → Huỷ')).toBeTruthy();
    // One line per permission with steps, none for the rest.
    const lines = document.querySelectorAll('.perm-transitions');
    const withSteps = DEMO_PERMISSION_OPTIONS.permissions.filter((o) => o.transitions.length > 0);
    expect(withSteps.length).toBeGreaterThan(0);
    expect(lines.length).toBe(withSteps.length);
    // The line sits with its own box.
    const confirmItem = box('Chốt đơn').closest('.perm-item');
    expect(confirmItem?.textContent).toContain('Chuyển: Báo giá → Đã chốt');
    expect(box('Xem tất cả đơn').closest('.perm-item')?.querySelector('.perm-transitions')).toBeNull();
    // Assistive tech hears the steps with the box they belong to; a box without steps has no description.
    const describedBy = box('Chốt đơn').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      'Chuyển: Báo giá → Đã chốt · Chờ duyệt → Đã chốt',
    );
    expect(box('Xem tất cả đơn').hasAttribute('aria-describedby')).toBe(false);
  });

  it('transitionsLine: a repeated from → to pair shows once; an unknown status key shows —', () => {
    const base = DEMO_PERMISSION_OPTIONS.permissions[0];
    expect(transitionsLine({ ...base, transitions: [] })).toBeNull();
    expect(
      transitionsLine({
        ...base,
        transitions: [
          { event: 'xong_giao', from: 'dacoc', to: 'dagiao' },
          { event: 'other', from: 'dacoc', to: 'dagiao' },
          { event: 'x', from: 'bay_len', to: 'thicong' },
        ],
      }),
    ).toBe('Chuyển: Đã cọc → Đã giao · — → Đang thi công');
    // Dedupe is by status keys, not by label: two different unknown keys stay two steps.
    expect(
      transitionsLine({
        ...base,
        transitions: [
          { event: 'x', from: 'bay_len', to: 'thicong' },
          { event: 'y', from: 'roi_xuong', to: 'thicong' },
        ],
      }),
    ).toBe('Chuyển: — → Đang thi công · — → Đang thi công');
  });

  it('the steps line is information, not an edit control: it shows on a box the caller cannot grant and on a read-only account', async () => {
    const options = {
      ...DEMO_PERMISSION_OPTIONS,
      permissions: DEMO_PERMISSION_OPTIONS.permissions.map((o) =>
        o.key === K.ordersConfirm ? { ...o, grantable: false } : o,
      ),
    };
    await openAccount(new FakeAccountsPort(DEMO_ACCOUNTS, options), /Trần Văn A/);
    expect(box('Chốt đơn').disabled).toBe(true);
    expect(box('Chốt đơn').closest('.perm-item')?.textContent).toContain(
      'Chuyển: Báo giá → Đã chốt · Chờ duyệt → Đã chốt',
    );
    cleanup();

    await openAccount(new FakeAccountsPort(), /Chủ vận hành/);
    expect(screen.getByText(OWNER.readOnlyReason ?? '')).toBeTruthy();
    const withSteps = DEMO_PERMISSION_OPTIONS.permissions.filter((o) => o.transitions.length > 0);
    expect(withSteps.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.perm-transitions').length).toBe(withSteps.length);
  });

  it('a permission the backend marks grantable:false is a disabled box', async () => {
    await openAccount(new FakeAccountsPort(), /Trần Văn A/);
    expect(box('Xem Audit log (Super Admin)').disabled).toBe(true);
    expect(box('Chốt đơn').disabled).toBe(false);
  });

  it('editable:false ⇒ the reason shows, every box, the preset button and Lưu are disabled', async () => {
    await openAccount(new FakeAccountsPort(), /Chủ vận hành/);
    expect(screen.getByText(OWNER.readOnlyReason ?? '')).toBeTruthy();
    for (const o of DEMO_PERMISSION_OPTIONS.permissions) expect(box(o.label).disabled, o.key).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Áp preset role',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(saveButton().disabled).toBe(true);
  });

  it('a 403 from the port shows the backend sentence and keeps the ticks', async () => {
    const port = new FakeAccountsPort();
    vi.spyOn(port, 'updatePermissions').mockRejectedValue(
      new ApiError('Không thể sửa account mang quyền bạn không có: audit.read', { status: 403, code: 'FORBIDDEN' }),
    );
    await openAccount(port, /Trần Văn A/);
    fireEvent.click(box('Ghi nhận thanh toán'));
    const before = ticked();
    fireEvent.click(saveButton());
    expect(await screen.findByText('Không thể sửa account mang quyền bạn không có: audit.read')).toBeTruthy();
    expect(ticked()).toEqual(before);
    expect(before).toContain(K.paymentsRecord);
  });

  it('while a save is pending the account rows cannot be switched; its refusal shows on that account', async () => {
    const port = new FakeAccountsPort();
    let reject!: (e: unknown) => void;
    vi.spyOn(port, 'updatePermissions').mockReturnValue(new Promise((_, r) => (reject = r)));
    await openAccount(port, /Trần Văn A/);
    fireEvent.click(saveButton());

    const other = screen.getByRole('button', { name: /Lê Thị C/ }) as HTMLButtonElement;
    expect(other.disabled).toBe(true);
    fireEvent.click(other);
    expect(other.getAttribute('aria-pressed')).toBe('false');

    reject(new ApiError('Không thể cấp quyền bạn không có: audit.read', { status: 403, code: 'FORBIDDEN' }));
    expect(await screen.findByText('Không thể cấp quyền bạn không có: audit.read')).toBeTruthy();
    expect(other.disabled).toBe(false);
    expect(ticked().sort()).toEqual([...WORKER.permissions].sort());
  });

  it('under StrictMode the double mount keeps the newest load, not a late older one', async () => {
    const port = new FakeAccountsPort();
    let resolveFirst!: (list: AccountPermissionSummary[]) => void;
    vi.spyOn(port, 'listAccounts')
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce([WORKER]);
    render(
      <StrictMode>
        <PermissionsProvider port={ME}>
          <PermissionsScreen port={port} />
        </PermissionsProvider>
      </StrictMode>,
    );
    await screen.findByRole('button', { name: /Trần Văn A/ });
    resolveFirst([INACTIVE]);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: /Lê Thị C/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Trần Văn A/ })).toBeTruthy();
  });

  it('the list failing to load shows the error with a retry', async () => {
    const port = new FakeAccountsPort();
    vi.spyOn(port, 'listAccounts').mockRejectedValueOnce(new ApiError('x', { status: 500 }));
    renderScreen(port);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('button', { name: /Trần Văn A/ })).toBeTruthy();
  });
});
