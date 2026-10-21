// LoginScreen against FakeAuthPort: the backend's message reaches the Banner
// verbatim, a double submit is impossible while a request is in flight, and an
// account that is not an email never reaches the port.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import { FakeAuthPort } from '../design-system/session';
import type { AuthPort } from '../design-system/session';
import { LoginScreen } from '../screens/auth/LoginScreen';

afterEach(cleanup);

function fill(account: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('Email đăng nhập'), { target: { value: account } });
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
    fill(' admin@pns.vn ', 'MatKhau123');
    fireEvent.click(submitButton());
    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ email: 'admin@pns.vn', password: 'MatKhau123' });
  });

  it('shows the backend 401 message verbatim in the alert Banner', async () => {
    const port = new FakeAuthPort(
      new ApiError('Thông tin đăng nhập không đúng', { status: 401, code: 'UNAUTHENTICATED' }),
    );
    const onLoggedIn = vi.fn();
    render(<LoginScreen port={port} onLoggedIn={onLoggedIn} />);
    fill('admin@pns.vn', 'sai');
    fireEvent.click(submitButton());
    expect((await screen.findByRole('alert')).textContent).toContain('Thông tin đăng nhập không đúng');
    expect(onLoggedIn).toHaveBeenCalledTimes(0);
    expect(submitButton().disabled).toBe(false);
  });

  it('a failure that is not an ApiError shows the generic message, not its own text', async () => {
    const port = new FakeAuthPort(new TypeError('Cannot read properties of undefined'));
    render(<LoginScreen port={port} onLoggedIn={vi.fn()} />);
    fill('admin@pns.vn', 'MatKhau123');
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
    fill('admin@pns.vn', 'MatKhau123');
    fireEvent.click(submitButton());
    await vi.waitFor(() => expect(submitButton().disabled).toBe(true));
    fireEvent.click(submitButton());
    fireEvent.submit(submitButton().closest('form')!);
    expect(port.login).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('a phone number is refused before reaching the port', async () => {
    const port = new FakeAuthPort();
    const login = vi.spyOn(port, 'login');
    render(<LoginScreen port={port} onLoggedIn={vi.fn()} />);
    fill('0912345678', 'MatKhau123');
    fireEvent.click(submitButton());
    expect((await screen.findByRole('alert')).textContent).toContain('Tài khoản phải là email hợp lệ.');
    expect(login).toHaveBeenCalledTimes(0);
  });
});
