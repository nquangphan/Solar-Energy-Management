// ForgotPasswordScreen: the phone reaches the port RAW (only trimmed), a 400
// `fieldErrors.phone` shows right under the phone field, and step 2 never echoes the
// number nor claims a code was sent — it must not reveal whether the number exists.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
import type { PasswordPort } from '../design-system/session/password-port';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

afterEach(cleanup);

function portWith(requestResetCode: PasswordPort['requestResetCode']): PasswordPort {
  return {
    requestResetCode: vi.fn(requestResetCode),
    resetPassword: vi.fn(() => Promise.resolve()),
    changePassword: vi.fn(() => Promise.resolve()),
  };
}

function requestCodeFor(phone: string) {
  fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại đã đăng ký'), { target: { value: phone } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
}

describe('ForgotPasswordScreen', () => {
  it('sends the raw phone and step 2 does not echo it', async () => {
    const port = portWith(() => Promise.resolve({ expiresInSeconds: 300 }));
    render(<ForgotPasswordScreen port={port} />);
    requestCodeFor(' 0912 345 678 ');

    const confirmation = await screen.findByText(/Mã có hiệu lực 5 phút\./);
    expect(port.requestResetCode).toHaveBeenCalledWith('0912 345 678');
    expect(confirmation.textContent).toBe(
      'Nếu số điện thoại đã đăng ký, mã 6 số sẽ được gửi tới số đó. Mã có hiệu lực 5 phút.',
    );
    expect(document.body.textContent).not.toMatch(/0912|345 678|678/);
  });

  it('the phone field is a tel input with tel autocomplete', () => {
    render(<ForgotPasswordScreen port={portWith(() => Promise.resolve({ expiresInSeconds: 300 }))} />);
    const input = screen.getByLabelText('Số điện thoại đã đăng ký') as HTMLInputElement;
    expect(input.type).toBe('tel');
    expect(input.getAttribute('autocomplete')).toBe('tel');
  });

  it('an empty phone is refused before reaching the port', async () => {
    const port = portWith(() => Promise.resolve({ expiresInSeconds: 300 }));
    render(<ForgotPasswordScreen port={port} />);
    requestCodeFor('  ');
    expect((await screen.findByRole('alert')).textContent).toContain('Nhập số điện thoại đã đăng ký.');
    expect(port.requestResetCode).toHaveBeenCalledTimes(0);
  });

  it('a 400 fieldErrors.phone shows right after the phone field, not in the top banner', async () => {
    const message = 'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).';
    const port = portWith(() =>
      Promise.reject(
        new ApiError('Số điện thoại không hợp lệ.', {
          status: 400,
          code: 'VALIDATION_ERROR',
          fieldErrors: [{ field: 'phone', code: 'isPhoneNumber', message }],
        }),
      ),
    );
    render(<ForgotPasswordScreen port={port} />);
    requestCodeFor('abc');

    const fieldError = await screen.findByText(message);
    const input = screen.getByLabelText('Số điện thoại đã đăng ký');
    const submit = screen.getByRole('button', { name: 'Gửi mã' });
    expect(input.compareDocumentPosition(fieldError) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fieldError.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('step 2 resets with the same raw phone; a phone field error there still shows the one generic message', async () => {
    const port = portWith(() => Promise.resolve({ expiresInSeconds: 300 }));
    vi.mocked(port.resetPassword).mockRejectedValueOnce(
      new ApiError('Số điện thoại không hợp lệ.', {
        status: 400,
        code: 'VALIDATION_ERROR',
        fieldErrors: [{ field: 'phone', code: 'isPhoneNumber', message: 'Số điện thoại không hợp lệ.' }],
      }),
    );
    render(<ForgotPasswordScreen port={port} />);
    requestCodeFor(' 0912 345 678 ');
    await screen.findByText(/Mã có hiệu lực 5 phút\./);

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu mới'), { target: { value: 'MatKhauMoi1' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập lại mật khẩu mới'), { target: { value: 'MatKhauMoi1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.',
    );
    expect(port.resetPassword).toHaveBeenCalledWith({
      phone: '0912 345 678',
      code: '123456',
      newPassword: 'MatKhauMoi1',
    });
    expect(screen.queryByText('Số điện thoại không hợp lệ.')).toBeNull();
  });

  it('any other request failure shows the one generic message', async () => {
    const port = portWith(() => Promise.reject(new ApiError('boom', { status: 500 })));
    render(<ForgotPasswordScreen port={port} />);
    requestCodeFor('0912345678');
    expect((await screen.findByRole('alert')).textContent).toContain('Không gửi được mã. Thử lại sau.');
  });
});
