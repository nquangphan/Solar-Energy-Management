import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AccountsService } from '../src/accounts/accounts.service';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { RequestWithAccount } from '../src/auth/current-account.decorator';

/**
 * Unit `JwtAuthGuard` (hermetic — mock `JwtService`/`AccountsService`/`Reflector`, dựng
 * `ExecutionContext` giả). Phủ AC-2: `@Public` bỏ qua; thiếu/sai Bearer → 401; verify lỗi
 * → 401 (envelope generic); account null hoặc `isActive=false` → 401; hợp lệ → gắn
 * `request.account` (KHÔNG `passwordHash`).
 */
describe('JwtAuthGuard (unit)', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let jwt: { verifyAsync: jest.Mock };
  let accounts: { findById: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    jwt = { verifyAsync: jest.fn() };
    accounts = { findById: jest.fn() };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      jwt as unknown as JwtService,
      accounts as unknown as AccountsService,
    );
  });

  function makeContext(headers: Record<string, string> = {}): {
    ctx: ExecutionContext;
    request: RequestWithAccount;
  } {
    const request = { headers } as unknown as RequestWithAccount;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { ctx, request };
  }

  const activeAccount = {
    id: 'acc-1',
    email: 'user@example.com',
    displayName: 'Người Dùng',
    passwordHash: 'argon2-hash-secret',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('@Public → cho qua không cần token, KHÔNG verify', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx } = makeContext();

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(accounts.findById).not.toHaveBeenCalled();
  });

  it('thiếu header Authorization → 401 UNAUTHENTICATED', async () => {
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHENTICATED,
    });
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('header không phải "Bearer " → 401', async () => {
    const { ctx } = makeContext({ authorization: 'Basic abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(AppException);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('"Bearer " rỗng token → 401', async () => {
    const { ctx } = makeContext({ authorization: 'Bearer    ' });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHENTICATED,
    });
  });

  it('verifyAsync throw (hết hạn/chữ ký sai/malformed) → 401 (KHÔNG leak lý do)', async () => {
    jwt.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));
    const { ctx } = makeContext({ authorization: 'Bearer expired.jwt' });

    const err = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    expect((err as AppException).getStatus()).toBe(401);
    // Message trung tính, KHÔNG chứa lý do verify.
    expect((err as AppException).message).not.toContain('expired');
  });

  it('token hợp lệ nhưng account không tồn tại → 401', async () => {
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'acc-x' });
    accounts.findById.mockResolvedValueOnce(null);
    const { ctx } = makeContext({ authorization: 'Bearer ok.jwt' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHENTICATED,
    });
  });

  it('token hợp lệ nhưng account isActive=false → 401 (deactivate hiệu lực tức thì)', async () => {
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'acc-1' });
    accounts.findById.mockResolvedValueOnce({
      ...activeAccount,
      isActive: false,
    });
    const { ctx } = makeContext({ authorization: 'Bearer ok.jwt' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHENTICATED,
    });
  });

  it('token hợp lệ + account active → cho qua, gắn request.account (KHÔNG passwordHash)', async () => {
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'acc-1' });
    accounts.findById.mockResolvedValueOnce(activeAccount);
    const { ctx, request } = makeContext({ authorization: 'Bearer ok.jwt' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.account).toEqual({
      id: 'acc-1',
      email: 'user@example.com',
      displayName: 'Người Dùng',
    });
    expect(JSON.stringify(request.account)).not.toContain('passwordHash');
    expect(accounts.findById).toHaveBeenCalledWith('acc-1');
  });
});
