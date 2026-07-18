import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../accounts/domain/permission-registry';

/** Khoá metadata chứa danh sách `PermissionKey` mà endpoint chấp nhận (semantics OR). */
export const REQUIRE_ANY_PERMISSION_KEY = 'requireAnyPermission';

/**
 * `@RequireAnyPermissions(PERM.x, PERM.y)` — endpoint đòi **ÍT NHẤT MỘT** key liệt kê (OR),
 * song song với `@RequirePermissions` (AND) chứ KHÔNG thay thế nó.
 *
 * Dùng khi hai key diễn đạt hai PHẠM VI của cùng một hành động, và preset vai trò cấp key
 * rộng KHÔNG kèm key hẹp: đặt key hẹp làm "sàn" AND sẽ khoá chính người có quyền rộng ra
 * ngoài. `GET /orders` là ca đầu tiên — `orders.view_all` hoặc `orders.view_own` đều mở cửa,
 * phạm vi dữ liệu do service thu hẹp sau đó.
 *
 * Tham số kiểu `PermissionKey` (registry `accounts/domain`, AD-17) → gọi bằng `PERM.xxx`,
 * KHÔNG chuỗi literal.
 */
export const RequireAnyPermissions = (...keys: PermissionKey[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, keys);
