// Account form (Story 8.3): create sends the raw phone + the chosen preset key; Lưu
// stays disabled until every field is filled and a preset is chosen; the backend's
// field errors land under the matching input with every typed value kept; edit has no
// password/preset and sends all four fields; a non-editable account cannot be opened.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { AccountFormScreen } from '../screens/permissions/AccountFormScreen';

afterEach(cleanup);

const ME = new FakeMePort({ ...DEMO_ME, permissions: [K.permissionsManage] });
const [WORKER, INACTIVE, OWNER] = DEMO_ACCOUNTS;

function renderForm(port: AccountsPort, props: { accountId?: string; onDone?: (id: string) => void } = {}) {
  const onDone = props.onDone ?? vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <PermissionsProvider port={ME}>
      <AccountFormScreen port={port} accountId={props.accountId} onDone={onDone} onCancel={onCancel} />
    </PermissionsProvider>,
  );
  return { ...view, onDone, onCancel };
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });
const saveButton = () => screen.getByRole('button', { name: 'Lưu account' }) as HTMLButtonElement;

async function fillCreate() {
  await screen.findByLabelText('Họ tên');
  type('Họ tên', 'Phạm Văn E');
  type('Số điện thoại (dùng đăng nhập)', '0912 345 678');
  type('Email', 'e.pham@local.test');
  type('Mật khẩu ban đầu', 'MatKhau123');
}

function choosePreset(label: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Chọn preset' }));
  fireEvent.click(screen.getByRole('button', { name: label }));
}

/** A port whose create rejects with the given AD-5 error. */
function rejectingCreate(error: ApiError) {
  const port = new FakeAccountsPort();
  vi.spyOn(port, 'createAccount').mockRejectedValue(error);
  return port;
}

describe('AccountFormScreen — create', () => {
  it('sends the raw phone verbatim, the preset key and the active flag, then hands back the new id', async () => {
    const port = new FakeAccountsPort();
    const { onDone } = renderForm(port);
    await fillCreate();
    choosePreset('Thợ khảo sát');
    fireEvent.click(screen.getByRole('button', { name: /Tạm khoá/ }));

    fireEvent.click(saveButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('new-1'));
    expect(port.created).toEqual([
      {
        displayName: 'Phạm Văn E',
        phone: '0912 345 678',
        email: 'e.pham@local.test',
        password: 'MatKhau123',
        preset: 'THO_KS',
        isActive: false,
      },
    ]);
  });

  it('Lưu is disabled until a preset is chosen, and while any field is blank', async () => {
    renderForm(new FakeAccountsPort());
    await fillCreate();
    expect(saveButton().disabled).toBe(true);
    choosePreset('Kế toán');
    expect(saveButton().disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Kế toán' })).toBeTruthy();
    type('Mật khẩu ban đầu', '');
    expect(saveButton().disabled).toBe(true);
  });

  it('Lưu is disabled while the name, phone or email is blank or only spaces', async () => {
    renderForm(new FakeAccountsPort());
    await fillCreate();
    choosePreset('Kế toán');
    for (const [label, value] of [
      ['Họ tên', 'Phạm Văn E'],
      ['Số điện thoại (dùng đăng nhập)', '0912 345 678'],
      ['Email', 'e.pham@local.test'],
    ]) {
      type(label, '   ');
      expect(saveButton().disabled, label).toBe(true);
      type(label, value);
      expect(saveButton().disabled, label).toBe(false);
    }
  });

  it('a failed load shows the error state; Thử lại loads the presets again', async () => {
    const port = new FakeAccountsPort();
    const options = vi.spyOn(port, 'getPermissionOptions').mockRejectedValueOnce(new Error('offline'));
    renderForm(port);
    expect(await screen.findByText('Không tải được danh sách preset.')).toBeTruthy();
    expect(screen.queryByLabelText('Họ tên')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByLabelText('Họ tên')).toBeTruthy();
    expect(options).toHaveBeenCalledTimes(2);
  });

  it('Huỷ and the topbar back both leave through onCancel, nothing sent', async () => {
    const port = new FakeAccountsPort();
    const { onCancel } = renderForm(port);
    await fillCreate();
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(port.created).toEqual([]);
  });

  it('saving again clears the previous error while the new save is in flight', async () => {
    const port = new FakeAccountsPort();
    vi.spyOn(port, 'createAccount')
      .mockRejectedValueOnce(
        new ApiError('Số điện thoại đã thuộc tài khoản khác.', {
          status: 409,
          fieldErrors: [{ field: 'phone', code: 'isUnique', message: 'Số điện thoại đã thuộc tài khoản khác.' }],
        }),
      )
      .mockReturnValueOnce(new Promise(() => {}));
    renderForm(port);
    await fillCreate();
    choosePreset('Thợ khảo sát');
    fireEvent.click(saveButton());
    await screen.findByText('Số điện thoại đã thuộc tài khoản khác.');

    type('Số điện thoại (dùng đăng nhập)', '0912 345 679');
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton().disabled).toBe(true));
    expect(screen.queryByText('Số điện thoại đã thuộc tài khoản khác.')).toBeNull();
  });

  it('the preset sheet lists exactly the presets the backend offers', async () => {
    renderForm(new FakeAccountsPort());
    await screen.findByLabelText('Họ tên');
    fireEvent.click(screen.getByRole('button', { name: 'Chọn preset' }));
    const sheet = document.querySelector('.perm-presets');
    const labels = [...(sheet?.querySelectorAll('button') ?? [])].map((b) => b.textContent);
    expect(labels).toEqual(DEMO_PERMISSION_OPTIONS.presets.map((p) => p.label));
  });

  it('no preset offered ⇒ empty state and Lưu stays disabled', async () => {
    renderForm(new FakeAccountsPort(DEMO_ACCOUNTS, { ...DEMO_PERMISSION_OPTIONS, presets: [] }));
    expect(await screen.findByText('Bạn không cấp được preset nào.')).toBeTruthy();
    await fillCreate();
    expect(saveButton().disabled).toBe(true);
  });

  it('a 409 on phone shows the backend sentence under the phone and keeps every value', async () => {
    const port = rejectingCreate(
      new ApiError('Số điện thoại đã thuộc tài khoản khác.', {
        status: 409,
        fieldErrors: [{ field: 'phone', code: 'isUnique', message: 'Số điện thoại đã thuộc tài khoản khác.' }],
      }),
    );
    renderForm(port);
    await fillCreate();
    choosePreset('Thợ khảo sát');

    fireEvent.click(saveButton());

    const message = await screen.findByText('Số điện thoại đã thuộc tài khoản khác.');
    expect(message.className).toBe('acct-field-error');
    expect(message.previousElementSibling?.querySelector('input')).toBe(input('Số điện thoại (dùng đăng nhập)'));
    expect(input('Số điện thoại (dùng đăng nhập)').value).toBe('0912 345 678');
    expect(input('Họ tên').value).toBe('Phạm Văn E');
    expect(input('Mật khẩu ban đầu').value).toBe('MatKhau123');
    expect(screen.getByRole('button', { name: 'Thợ khảo sát' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a 400 on password lands under the password input', async () => {
    const port = rejectingCreate(
      new ApiError('Dữ liệu không hợp lệ.', {
        status: 400,
        fieldErrors: [{ field: 'password', code: 'matches', message: 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.' }],
      }),
    );
    renderForm(port);
    await fillCreate();
    choosePreset('Thợ khảo sát');

    fireEvent.click(saveButton());

    const message = await screen.findByText('Mật khẩu tối thiểu 8 ký tự, có chữ và số.');
    expect(message.parentElement?.querySelector('input')).toBe(input('Mật khẩu ban đầu'));
  });

  it('an error without a field shows the backend sentence in a banner above the form', async () => {
    const port = rejectingCreate(new ApiError('Không thể cấp quyền bạn không có: audit.read', { status: 403 }));
    renderForm(port);
    await fillCreate();
    choosePreset('Thợ khảo sát');

    fireEvent.click(saveButton());

    expect((await screen.findByRole('alert')).textContent).toContain('Không thể cấp quyền bạn không có');
    expect(input('Email').value).toBe('e.pham@local.test');
  });

  it('a double-click sends one create; Lưu and Huỷ are disabled while it is in flight', async () => {
    const port = new FakeAccountsPort();
    let resolve!: (summary: AccountPermissionSummary) => void;
    const create = vi.spyOn(port, 'createAccount').mockReturnValue(new Promise((r) => (resolve = r)));
    const { onDone } = renderForm(port);
    await fillCreate();
    choosePreset('Thợ khảo sát');

    fireEvent.click(saveButton());
    fireEvent.click(saveButton());

    expect(create).toHaveBeenCalledTimes(1);
    expect(saveButton().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Huỷ' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Quay lại' })).toBeNull();
    resolve({ ...WORKER, id: 'new-9' });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('new-9'));
  });
});

describe('AccountFormScreen — edit', () => {
  it('loads the account, has no password and no preset, and sends all four fields', async () => {
    const port = new FakeAccountsPort();
    const { onDone } = renderForm(port, { accountId: WORKER.id });
    expect(((await screen.findByLabelText('Họ tên')) as HTMLInputElement).value).toBe(WORKER.displayName);
    expect(screen.queryByLabelText('Mật khẩu ban đầu')).toBeNull();
    expect(screen.queryByText('Role preset')).toBeNull();
    expect(screen.getByText('Sửa tài khoản')).toBeTruthy();
    type('Họ tên', 'Trần Văn B');
    fireEvent.click(screen.getByRole('button', { name: /Tạm khoá/ }));

    fireEvent.click(saveButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(WORKER.id));
    expect(port.updated).toEqual([
      {
        id: WORKER.id,
        input: {
          displayName: 'Trần Văn B',
          phone: WORKER.phone,
          email: expect.stringContaining(WORKER.email),
          isActive: false,
        },
      },
    ]);
  });

  it('reactivating: Kích hoạt on a deactivated account sends isActive true', async () => {
    const port = new FakeAccountsPort();
    const { onDone } = renderForm(port, { accountId: INACTIVE.id });
    await screen.findByLabelText('Họ tên');
    expect(screen.getByRole('button', { name: /Tạm khoá/ }).getAttribute('aria-pressed')).toBe('true');
    type('Số điện thoại (dùng đăng nhập)', '0912 345 670');

    fireEvent.click(screen.getByRole('button', { name: /Kích hoạt/ }));
    expect(screen.getByRole('button', { name: /Kích hoạt/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(saveButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(INACTIVE.id));
    expect(port.updated).toEqual([
      {
        id: INACTIVE.id,
        input: {
          displayName: INACTIVE.displayName,
          phone: '0912 345 670',
          email: expect.stringContaining(INACTIVE.email),
          isActive: true,
        },
      },
    ]);
  });

  it('field errors on the name and the email land under each input; the typed values stay', async () => {
    const port = new FakeAccountsPort();
    vi.spyOn(port, 'updateAccount').mockRejectedValue(
      new ApiError('Dữ liệu không hợp lệ.', {
        status: 409,
        fieldErrors: [
          { field: 'displayName', code: 'isNotEmpty', message: 'Không được để trống.' },
          { field: 'email', code: 'isUnique', message: 'Email đã thuộc tài khoản khác.' },
        ],
      }),
    );
    renderForm(port, { accountId: WORKER.id });
    await screen.findByLabelText('Họ tên');
    type('Email', 'owner@phuongnamsolar.vn');

    fireEvent.click(saveButton());

    const emailError = await screen.findByText('Email đã thuộc tài khoản khác.');
    expect(emailError.previousElementSibling?.querySelector('input')).toBe(input('Email'));
    const nameError = screen.getByText('Không được để trống.');
    expect(nameError.previousElementSibling?.querySelector('input')).toBe(input('Họ tên'));
    expect(input('Email').value).toBe('owner@phuongnamsolar.vn');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a field error on no input of the form (edit has no password) shows in the banner, not nowhere', async () => {
    const port = new FakeAccountsPort();
    vi.spyOn(port, 'updateAccount').mockRejectedValue(
      new ApiError('Không đổi mật khẩu ở đây — người dùng tự đổi ở Hồ sơ.', {
        status: 400,
        fieldErrors: [
          { field: 'password', code: 'isAbsent', message: 'Không đổi mật khẩu ở đây — người dùng tự đổi ở Hồ sơ.' },
        ],
      }),
    );
    renderForm(port, { accountId: WORKER.id });
    await screen.findByLabelText('Họ tên');

    fireEvent.click(saveButton());

    expect((await screen.findByRole('alert')).textContent).toContain('Không đổi mật khẩu ở đây');
  });

  it('an account the caller cannot edit ⇒ error state with the backend reason, no form', async () => {
    renderForm(new FakeAccountsPort(), { accountId: OWNER.id });
    expect(await screen.findByText('Không sửa được tài khoản này.')).toBeTruthy();
    expect(screen.getByText(OWNER.readOnlyReason!)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lưu account' })).toBeNull();
  });

  it('an unknown account ⇒ the same error state', async () => {
    renderForm(new FakeAccountsPort(), { accountId: 'missing' });
    expect(await screen.findByText('Không sửa được tài khoản này.')).toBeTruthy();
  });

  it('a stale load for a previous account never paints over the current one', async () => {
    const port = new FakeAccountsPort();
    const replies: ((list: AccountPermissionSummary[]) => void)[] = [];
    vi.spyOn(port, 'listAccounts').mockImplementation(() => new Promise((r) => replies.push(r)));
    const view = renderForm(port, { accountId: WORKER.id });
    view.rerender(
      <PermissionsProvider port={ME}>
        <AccountFormScreen port={port} accountId={DEMO_ACCOUNTS[1].id} onDone={() => {}} onCancel={() => {}} />
      </PermissionsProvider>,
    );
    await waitFor(() => expect(replies).toHaveLength(2));
    replies[1](DEMO_ACCOUNTS);
    expect(((await screen.findByLabelText('Họ tên')) as HTMLInputElement).value).toBe(DEMO_ACCOUNTS[1].displayName);
    replies[0](DEMO_ACCOUNTS.map((a) => ({ ...a, displayName: `stale ${a.displayName}` })));
    await new Promise((r) => setTimeout(r, 0));
    expect(input('Họ tên').value).toBe(DEMO_ACCOUNTS[1].displayName);
  });
});
