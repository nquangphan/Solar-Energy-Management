// LoginScreen against FakeAuthPort: the backend's message reaches the Banner
// verbatim, a double submit is impossible while a request is in flight, the phone
// reaches the port RAW (only trimmed — the backend normalizes, AD-9), and a 400
// `fieldErrors.phone` shows right under the phone field.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import { FakeAuthPort } from '../design-system/session';
import type { AuthPort } from '../design-system/session';
import { LoginScreen } from '../screens/auth/LoginScreen';

afterEach(cleanup);

function fill(phone: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), { target: { value: phone } });
  fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: password } });
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Đăng nhập' }) as HTMLButtonElement;
}

describe('LoginScreen', () => {
  it('signs in with the right credentials and emits onLoggedIn once', async () => {
    const port = new FakeAuthPort();
    const login = vi.spyOn(port, 'login');
    const onLoggedIn = vi.fn();
    render(<LoginScreen port={port} onLoggedIn={onLoggedIn} />);
    fill(' 0912 345 678 ', 'MatKhau123');
    fireEvent.click(submitButton());
    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledTimes(1);
    // Trimmed at both ends, inner spaces kept: the client never normalizes a phone.
    expect(login).toHaveBeenCalledWith({ phone: '0912 345 678', password: 'MatKhau123' });
  });

  it('shows the backend 401 message verbatim in the alert Banner', async () => {
    const port = new FakeAuthPort(
      new ApiError('Thông tin đăng nhập không đúng', { status: 401, code: 'UNAUTHENTICATED' }),
    );
    const onLoggedIn = vi.fn();
    render(<LoginScreen port={port} onLoggedIn={onLoggedIn} />);
    fill('0912345678', 'sai');
    fireEvent.click(submitButton());
    expect((await screen.findByRole('alert')).textContent).toContain('Thông tin đăng nhập không đúng');
    expect(onLoggedIn).toHaveBeenCalledTimes(0);
    expect(submitButton().disabled).toBe(false);
  });

  it('a failure that is not an ApiError shows the generic message, not its own text', async () => {
    const port = new FakeAuthPort(new TypeError('Cannot read properties of undefined'));
    render(<LoginScreen port={port} onLoggedIn={vi.fn()} />);
    fill('0912345678', 'MatKhau123');
    fireEvent.click(submitButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Không thực hiện được. Thử lại.');
    expect(alert.textContent).not.toContain('Cannot read');
  });

  it('disables the button while the request is in flight (no double submit)', async () => {
    let finish!: () => void;
    const port: AuthPort = {
      login: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
      restoreSession: () => Promise.resolve(false),
      logout: () => Promise.resolve(),
    };
    const onLoggedIn = vi.fn();
    render(<LoginScreen port={port} onLoggedIn={onLoggedIn} />);
    fill('0912345678', 'MatKhau123');
    fireEvent.click(submitButton());
    await vi.waitFor(() => expect(submitButton().disabled).toBe(true));
    fireEvent.click(submitButton());
    fireEvent.submit(submitButton().closest('form')!);
    expect(port.login).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('the phone field is a tel input with tel autocomplete', () => {
    render(<LoginScreen port={new FakeAuthPort()} onLoggedIn={vi.fn()} />);
    const input = screen.getByLabelText('Số điện thoại') as HTMLInputElement;
    expect(input.type).toBe('tel');
    expect(input.getAttribute('autocomplete')).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('tel');
  });

  it('an empty phone is refused before reaching the port', async () => {
    const port = new FakeAuthPort();
    const login = vi.spyOn(port, 'login');
    render(<LoginScreen port={port} onLoggedIn={vi.fn()} />);
    fill('   ', 'MatKhau123');
    fireEvent.click(submitButton());
    expect((await screen.findByRole('alert')).textContent).toContain('Nhập đủ số điện thoại và mật khẩu.');
    expect(login).toHaveBeenCalledTimes(0);
  });

  it('a 400 fieldErrors.phone shows right after the phone field, not in the top banner', async () => {
    const message = 'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).';
    const port = new FakeAuthPort(
      new ApiError('Số điện thoại không hợp lệ.', {
        status: 400,
        code: 'VALIDATION_ERROR',
        fieldErrors: [{ field: 'phone', code: 'isPhoneNumber', message }],
      }),
    );
    render(<LoginScreen port={port} onLoggedIn={vi.fn()} />);
    fill('abc', 'MatKhau123');
    fireEvent.click(submitButton());

    const fieldError = await screen.findByText(message);
    const phoneInput = screen.getByLabelText('Số điện thoại');
    const passwordInput = screen.getByLabelText('Mật khẩu');
    // DOM order: phone input → its error → password input.
    expect(phoneInput.compareDocumentPosition(fieldError) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fieldError.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText(message)).toHaveLength(1);
  });
});
