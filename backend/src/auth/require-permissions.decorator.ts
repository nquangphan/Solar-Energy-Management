import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../accounts/domain/permission-registry';

/** Khoá metadata chứa danh sách `PermissionKey` mà endpoint yêu cầu (semantics AND). */
export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

/**
 * `@RequirePermissions(PERM.x, PERM.y)` — endpoint đòi **tất cả** key liệt kê (AND).
 * `PermissionsGuard` đọc metadata này rồi so với effective set của account.
 *
 * Tham số kiểu `PermissionKey` (registry `accounts/domain`, AD-17) → gọi bằng `PERM.xxx`,
 * KHÔNG chuỗi literal (source-guard `no-permission-literal-outside-registry` sẽ fail nếu
 * lọt literal quyền). Endpoint KHÔNG khai decorator này = chỉ cần đăng nhập.
 */
export const RequirePermissions = (...keys: PermissionKey[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, keys);
