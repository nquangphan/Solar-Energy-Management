import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountPermissionsService } from '../accounts/account-permissions.service';
import type { PermissionKey } from '../accounts/domain/permission-registry';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUIRE_PERMISSIONS_KEY } from './require-permissions.decorator';
import type { RequestWithAccount } from './current-account.decorator';

/**
 * Guard toàn cục #2 (fail-closed): enforce `@RequirePermissions` MỖI request. Chạy SAU
 * `JwtAuthGuard` (đọc `request.account` do guard đó gắn) — thứ tự `APP_GUARD` trong
 * `AuthModule` bắt buộc Jwt trước Permissions.
 *
 * `@Public()` → bỏ qua. KHÔNG khai `@RequirePermissions` (vd `/me` — chỉ cần đăng nhập)
 * → cho qua (Jwt đã lo xác thực). Có khai: resolve effective set TƯƠI qua
 * `AccountPermissionsService.listForAccount` (AD-8, KHÔNG suy quyền từ JWT/role) → chứa
 * ĐỦ mọi key (AND) ⇒ cho qua; thiếu ≥1 ⇒ `AppException(FORBIDDEN, 403)`. `request.account`
 * vắng (lỗi wiring) ⇒ coi như 401 fail-closed, KHÔNG cho qua âm thầm.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      // Endpoint chỉ cần đăng nhập (không quyền cụ thể) — JwtAuthGuard đã xác thực.
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAccount>();
    const account = request.account;
    if (!account) {
      // Fail-closed: Permissions chạy mà thiếu danh tính ⇒ wiring sai thứ tự guard.
      throw new AppException(ErrorCode.UNAUTHENTICATED, 401, 'Chưa xác thực');
    }

    const effective = await this.accountPermissions.listForAccount(account.id);
    const hasAll = required.every((key) => effective.has(key));
    if (!hasAll) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        403,
        'Không đủ quyền thực hiện',
      );
    }
    return true;
  }
}
