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
import { REQUIRE_ANY_PERMISSION_KEY } from './require-any-permission.decorator';
import { REQUIRE_PERMISSIONS_KEY } from './require-permissions.decorator';
import type { RequestWithAccount } from './current-account.decorator';

/**
 * Guard toàn cục #2 (fail-closed): enforce `@RequirePermissions` MỖI request. Chạy SAU
 * `JwtAuthGuard` (đọc `request.account` do guard đó gắn) — thứ tự `APP_GUARD` trong
 * `AuthModule` bắt buộc Jwt trước Permissions.
 *
 * `@Public()` → bỏ qua. KHÔNG khai decorator quyền nào (vd `/me` — chỉ cần đăng nhập)
 * → cho qua (Jwt đã lo xác thực). `request.account` vắng (lỗi wiring) ⇒ coi như 401
 * fail-closed, KHÔNG cho qua âm thầm.
 *
 * Hai ngữ nghĩa quyền, ĐỘC LẬP nhau, đọc trên CÙNG một effective set resolve TƯƠI qua
 * `AccountPermissionsService.listForAccount` (AD-8, KHÔNG suy quyền từ JWT/role) — đúng
 * MỘT round-trip DB mỗi request dù khai một hay cả hai:
 *
 * - `@RequirePermissions(...)` (AND): thiếu ≥1 key ⇒ 403.
 * - `@RequireAnyPermissions(...)` (OR): không có key nào trong danh sách ⇒ 403.
 *
 * Khai CẢ HAI ⇒ phải thoả CẢ HAI (đủ AND-set **và** có ≥1 của OR-set). Mọi đường từ chối
 * dùng chung `AppException(FORBIDDEN, 403)` — không mã lỗi riêng (AD-5).
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
    const requiredAny = this.reflector.getAllAndOverride<PermissionKey[]>(
      REQUIRE_ANY_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const coKhaiAnd = Boolean(required && required.length > 0);
    const coKhaiOr = Boolean(requiredAny && requiredAny.length > 0);
    if (!coKhaiAnd && !coKhaiOr) {
      // Endpoint chỉ cần đăng nhập (không quyền cụ thể) — JwtAuthGuard đã xác thực.
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAccount>();
    const account = request.account;
    if (!account) {
      // Fail-closed: Permissions chạy mà thiếu danh tính ⇒ wiring sai thứ tự guard.
      throw new AppException(ErrorCode.UNAUTHENTICATED, 401, 'Chưa xác thực');
    }

    // MỘT lần resolve cho cả hai phép — round-trip DB thứ hai mỗi request là hồi quy
    // hiệu năng câm, không ai nhìn thấy cho tới lúc list đơn chậm.
    const effective = await this.accountPermissions.listForAccount(account.id);

    const duAnd = !coKhaiAnd || required.every((key) => effective.has(key));
    const duOr = !coKhaiOr || requiredAny.some((key) => effective.has(key));
    if (!duAnd || !duOr) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        403,
        'Không đủ quyền thực hiện',
      );
    }
    return true;
  }
}
