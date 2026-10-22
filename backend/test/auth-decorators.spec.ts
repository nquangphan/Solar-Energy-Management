import { type ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, Public } from '../src/auth/public.decorator';
import {
  REQUIRE_PERMISSIONS_KEY,
  RequirePermissions,
} from '../src/auth/require-permissions.decorator';
import {
  CurrentAccount,
  type AuthenticatedAccount,
  type RequestWithAccount,
} from '../src/auth/current-account.decorator';
import { PERM } from '../src/accounts/domain/permission-registry';

/**
 * Unit decorator (nhẹ): `Public()` set `IS_PUBLIC_KEY=true`; `RequirePermissions(PERM.x)`
 * set mảng key ĐÚNG thứ tự. Dùng `PERM.*` (KHÔNG literal) — nhất quán AD-17.
 */
describe('auth decorators (unit)', () => {
  const reflector = new Reflector();

  it('@Public set metadata IS_PUBLIC_KEY = true', () => {
    class Sample {
      @Public()
      route(): void {}
    }
    expect(reflector.get(IS_PUBLIC_KEY, Sample.prototype.route)).toBe(true);
  });

  it('@RequirePermissions set mảng PermissionKey đúng thứ tự', () => {
    class Sample {
      @RequirePermissions(PERM.auditRead, PERM.ordersViewAll)
      route(): void {}
    }
    expect(
      reflector.get(REQUIRE_PERMISSIONS_KEY, Sample.prototype.route),
    ).toEqual([PERM.auditRead, PERM.ordersViewAll]);
  });

  it('@RequirePermissions không tham số → mảng rỗng', () => {
    class Sample {
      @RequirePermissions()
      route(): void {}
    }
    expect(
      reflector.get(REQUIRE_PERMISSIONS_KEY, Sample.prototype.route),
    ).toEqual([]);
  });

  describe('@CurrentAccount', () => {
    /** Rút factory của param-decorator qua ROUTE_ARGS_METADATA (cách chuẩn của Nest). */
    type ParamFactory = (
      data: unknown,
      ctx: ExecutionContext,
    ) => AuthenticatedAccount | undefined;

    function currentAccountFactory(): ParamFactory {
      class Probe {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tham số chỉ để gắn decorator
        route(@CurrentAccount() account: AuthenticatedAccount): void {}
      }
      const meta = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        Probe,
        'route',
      ) as Record<string, { factory: ParamFactory }>;
      return meta[Object.keys(meta)[0]].factory;
    }

    function ctxWith(account?: AuthenticatedAccount): ExecutionContext {
      const request = { account } as unknown as RequestWithAccount;
      return {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;
    }

    it('trả request.account do JwtAuthGuard gắn', () => {
      const account: AuthenticatedAccount = {
        id: 'acc-1',
        email: 'u@e.com',
        phone: null,
        displayName: 'U',
      };
      expect(currentAccountFactory()(undefined, ctxWith(account))).toBe(
        account,
      );
    });

    it('request.account vắng → undefined', () => {
      expect(currentAccountFactory()(undefined, ctxWith())).toBeUndefined();
    });
  });
});
