import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { IS_PUBLIC_KEY } from '../src/auth/public.decorator';
import { REQUIRE_ANY_PERMISSION_KEY } from '../src/auth/require-any-permission.decorator';
import { REQUIRE_PERMISSIONS_KEY } from '../src/auth/require-permissions.decorator';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * Ma trận hai ngữ nghĩa quyền của `PermissionsGuard`. Ca trung tâm: `orders.view_all` và
 * `orders.view_own` là HAI PHẠM VI của cùng một hành động, và `role-presets.ts` cấp
 * `view_all` KHÔNG kèm `view_own` — nên AND không diễn đạt được cửa vào của `GET /orders`,
 * và một `@RequirePermissions(ordersViewOwn)` làm "sàn" sẽ khoá chính admin ra ngoài.
 */
describe('PermissionsGuard — AND (@RequirePermissions) và OR (@RequireAnyPermissions)', () => {
  /** Metadata giả lập theo đúng cách guard đọc: `getAllAndOverride(key, [handler, class])`. */
  function dungGuard(
    metadata: Record<string, unknown>,
    quyenCuaAccount: readonly string[],
    /** `false` = mô phỏng lỗi wiring guard (không có `request.account`). */
    coAccount = true,
  ) {
    const account = coAccount ? { id: 'acc-1' } : undefined;
    const reflector = {
      getAllAndOverride: (key: string) => metadata[key],
    } as unknown as Reflector;

    const demSoLanResolve = { count: 0 };
    const accountPermissions = {
      listForAccount: async (id: string) => {
        demSoLanResolve.count += 1;
        expect(id).toBe('acc-1');
        return new Set(quyenCuaAccount);
      },
    } as unknown as AccountPermissionsService;

    const context = {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ account }) }),
    } as unknown as ExecutionContext;

    const guard = new PermissionsGuard(reflector, accountPermissions);
    return { guard, context, demSoLanResolve };
  }

  /** Từ chối phải là ĐÚNG `AppException(FORBIDDEN, 403)` — không mã lỗi riêng (AD-5). */
  async function mongDoi403(ket: Promise<boolean>): Promise<void> {
    const loi = await ket.catch((e: unknown) => e);
    expect(loi).toBeInstanceOf(AppException);
    expect((loi as AppException).errorCode).toBe(ErrorCode.FORBIDDEN);
    expect((loi as AppException).getStatus()).toBe(403);
    expect((loi as AppException).message).toBe('Không đủ quyền thực hiện');
  }

  const CHI_OR = {
    [REQUIRE_ANY_PERMISSION_KEY]: [PERM.ordersViewAll, PERM.ordersViewOwn],
  };

  it('OR: có key A (orders.view_all) ⇒ qua', async () => {
    const { guard, context } = dungGuard(CHI_OR, [PERM.ordersViewAll]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('OR: có key B (orders.view_own) ⇒ qua', async () => {
    const { guard, context } = dungGuard(CHI_OR, [PERM.ordersViewOwn]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('OR: có CẢ HAI key ⇒ qua', async () => {
    const { guard, context } = dungGuard(CHI_OR, [
      PERM.ordersViewAll,
      PERM.ordersViewOwn,
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('OR: KHÔNG key nào trong danh sách ⇒ 403 FORBIDDEN', async () => {
    const { guard, context } = dungGuard(CHI_OR, [PERM.customersManage]);
    await mongDoi403(guard.canActivate(context));
  });

  it('OR: account KHÔNG có quyền nào ⇒ 403', async () => {
    const { guard, context } = dungGuard(CHI_OR, []);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it('OR chỉ resolve effective set ĐÚNG MỘT LẦN (không thêm round-trip DB)', async () => {
    const { guard, context, demSoLanResolve } = dungGuard(
      {
        [REQUIRE_PERMISSIONS_KEY]: [PERM.customersManage],
        ...CHI_OR,
      },
      [PERM.customersManage, PERM.ordersViewOwn],
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(demSoLanResolve.count).toBe(1);
  });

  it('khai CẢ AND lẫn OR: đủ AND nhưng thiếu OR ⇒ 403', async () => {
    const { guard, context } = dungGuard(
      { [REQUIRE_PERMISSIONS_KEY]: [PERM.customersManage], ...CHI_OR },
      [PERM.customersManage],
    );
    await mongDoi403(guard.canActivate(context));
  });

  it('khai CẢ AND lẫn OR: đủ OR nhưng thiếu AND ⇒ 403', async () => {
    const { guard, context } = dungGuard(
      { [REQUIRE_PERMISSIONS_KEY]: [PERM.customersManage], ...CHI_OR },
      [PERM.ordersViewAll],
    );
    await mongDoi403(guard.canActivate(context));
  });

  it('AND giữ NGUYÊN hành vi cũ: đủ mọi key ⇒ qua, thiếu 1 ⇒ 403', async () => {
    const meta = {
      [REQUIRE_PERMISSIONS_KEY]: [PERM.customersManage, PERM.costsView],
    };
    const du = dungGuard(meta, [PERM.customersManage, PERM.costsView]);
    await expect(du.guard.canActivate(du.context)).resolves.toBe(true);

    const thieu = dungGuard(meta, [PERM.customersManage]);
    await mongDoi403(thieu.guard.canActivate(thieu.context));
  });

  it('KHÔNG khai decorator nào ⇒ giữ hành vi cũ (chỉ cần đăng nhập)', async () => {
    const { guard, context, demSoLanResolve } = dungGuard({}, []);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(demSoLanResolve.count).toBe(0);
  });

  it('@Public() ⇒ bỏ qua hoàn toàn, kể cả khi có khai OR', async () => {
    const { guard, context } = dungGuard(
      { [IS_PUBLIC_KEY]: true, ...CHI_OR },
      [],
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('fail-closed: khai OR mà thiếu request.account ⇒ 401, KHÔNG cho qua âm thầm', async () => {
    const { guard, context } = dungGuard(CHI_OR, [PERM.ordersViewAll], false);
    const loi = await guard.canActivate(context).catch((e: unknown) => e);
    expect(loi).toBeInstanceOf(AppException);
    expect((loi as AppException).errorCode).toBe(ErrorCode.UNAUTHENTICATED);
    expect((loi as AppException).getStatus()).toBe(401);
  });

  it('OR khai mảng RỖNG ⇒ coi như không khai (không khoá cửa vô cớ)', async () => {
    const { guard, context } = dungGuard(
      { [REQUIRE_ANY_PERMISSION_KEY]: [] },
      [],
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
