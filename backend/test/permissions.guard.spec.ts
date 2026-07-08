import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { IS_PUBLIC_KEY } from '../src/auth/public.decorator';
import type { RequestWithAccount } from '../src/auth/current-account.decorator';

/**
 * Unit `PermissionsGuard` (hermetic — mock `Reflector`/`AccountPermissionsService`). Phủ
 * AC-2/AC-3: `@Public` bỏ qua; không `@RequirePermissions` → cho qua (chỉ cần đăng nhập);
 * effective ⊇ required (AND) → cho qua; thiếu ≥1 key → 403 FORBIDDEN; đọc `account.id` từ
 * request; `request.account` vắng → 401 fail-closed.
 */
describe('PermissionsGuard (unit)', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let accountPermissions: { listForAccount: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    accountPermissions = { listForAccount: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      accountPermissions as unknown as AccountPermissionsService,
    );
  });

  /** Reflector trả `isPublic` cho `IS_PUBLIC_KEY`, `required` cho `REQUIRE_PERMISSIONS_KEY`. */
  function stubReflector(isPublic: boolean, required: unknown): void {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === IS_PUBLIC_KEY ? isPublic : required,
    );
  }

  function makeContext(account?: {
    id: string;
    email: string;
    displayName: string;
  }): ExecutionContext {
    const request = { account } as unknown as RequestWithAccount;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  const account = { id: 'acc-1', email: 'u@e.com', displayName: 'U' };

  it('@Public → cho qua, KHÔNG resolve quyền', async () => {
    stubReflector(true, undefined);
    await expect(guard.canActivate(makeContext(account))).resolves.toBe(true);
    expect(accountPermissions.listForAccount).not.toHaveBeenCalled();
  });

  it('không metadata @RequirePermissions → cho qua (chỉ cần đăng nhập)', async () => {
    stubReflector(false, undefined);
    await expect(guard.canActivate(makeContext(account))).resolves.toBe(true);
    expect(accountPermissions.listForAccount).not.toHaveBeenCalled();
  });

  it('metadata rỗng [] → cho qua', async () => {
    stubReflector(false, []);
    await expect(guard.canActivate(makeContext(account))).resolves.toBe(true);
  });

  it('đủ quyền (effective ⊇ required) → cho qua, đọc account.id đúng', async () => {
    stubReflector(false, [PERM.auditRead]);
    accountPermissions.listForAccount.mockResolvedValueOnce(
      new Set([PERM.auditRead, PERM.ordersViewAll]),
    );
    await expect(guard.canActivate(makeContext(account))).resolves.toBe(true);
    expect(accountPermissions.listForAccount).toHaveBeenCalledWith('acc-1');
  });

  it('thiếu 1 key → 403 FORBIDDEN', async () => {
    stubReflector(false, [PERM.auditRead]);
    accountPermissions.listForAccount.mockResolvedValueOnce(
      new Set([PERM.ordersViewAll]),
    );
    const err = await guard
      .canActivate(makeContext(account))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).errorCode).toBe(ErrorCode.FORBIDDEN);
    expect((err as AppException).getStatus()).toBe(403);
  });

  it('AND nhiều key: có 1 thiếu 1 → 403', async () => {
    stubReflector(false, [PERM.auditRead, PERM.permissionsManage]);
    accountPermissions.listForAccount.mockResolvedValueOnce(
      new Set([PERM.auditRead]),
    );
    await expect(guard.canActivate(makeContext(account))).rejects.toMatchObject(
      { errorCode: ErrorCode.FORBIDDEN },
    );
  });

  it('request.account vắng (lỗi wiring thứ tự guard) → 401 fail-closed', async () => {
    stubReflector(false, [PERM.auditRead]);
    const err = await guard
      .canActivate(makeContext(undefined))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    expect(accountPermissions.listForAccount).not.toHaveBeenCalled();
  });
});
