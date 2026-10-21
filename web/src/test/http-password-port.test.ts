// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpPasswordPort } from '../api/http-password-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

describe('HttpPasswordPort', () => {
  it('requestResetCode POSTs the email and resolves only the code lifetime', async () => {
    const h = setupHarness(() => json(200, { expiresInSeconds: 600 }));
    await expect(new HttpPasswordPort(h.client).requestResetCode('a@pns.vn')).resolves.toEqual({
      expiresInSeconds: 600,
    });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/auth/forgot-password');
    expect(await h.requests[0].json()).toEqual({ email: 'a@pns.vn' });
  });

  it('resetPassword sends email/code/newPassword and resolves undefined on 204', async () => {
    const h = setupHarness(() => new Response(null, { status: 204 }));
    const input = { email: 'a@pns.vn', code: '123456', newPassword: 'MatKhauMoi1' };
    await expect(new HttpPasswordPort(h.client).resetPassword(input)).resolves.toBeUndefined();
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/auth/reset-password');
    expect(await h.requests[0].json()).toEqual(input);
  });

  it('resetPassword rejects a wrong code with the envelope and its fieldErrors', async () => {
    const h = setupHarness(() =>
      envelope(400, 'VALIDATION_ERROR', 'Mã xác thực không đúng.', [
        { field: 'code', code: 'INVALID', message: 'Mã xác thực không đúng.' },
      ]),
    );
    const error = await new HttpPasswordPort(h.client)
      .resetPassword({ email: 'a@pns.vn', code: '000000', newPassword: 'MatKhauMoi1' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Mã xác thực không đúng.',
      fieldErrors: [{ field: 'code', code: 'INVALID', message: 'Mã xác thực không đúng.' }],
    });
  });

  it('changePassword with a wrong current password: 401 → refresh OK → replayed 401 rejects and never expires the session', async () => {
    const h = setupHarness((request) => {
      if (target(request) === '/auth/refresh') {
        return json(200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 });
      }
      return envelope(401, 'UNAUTHENTICATED', 'Mật khẩu hiện tại không đúng');
    });
    const error = await new HttpPasswordPort(h.client)
      .changePassword({ currentPassword: 'sai', newPassword: 'MatKhauMoi1' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Mật khẩu hiện tại không đúng' });
    expect(h.requests.map(target)).toEqual(['/auth/change-password', '/auth/refresh', '/auth/change-password']);
    expect(h.fetchImpl).toHaveBeenCalledTimes(3);
    expect(h.onSessionExpired).toHaveBeenCalledTimes(0);
    expect(h.session.getRefreshToken()).toBe('refresh-2');
  });
});
