import type { PermissionKey } from './permission-registry';

/**
 * Hai luật không-leo-thang quyền (FR-18) — DOMAIN THUẦN: chỉ `PermissionKey` + `Set`,
 * KHÔNG Nest/Prisma/`AppException` (mirror `role-presets.ts`). Hàm trả **danh sách key
 * vi phạm** (không throw) — tầng service quyết định mã lỗi và thông điệp.
 *
 * BẤT BIẾN: luật #2 là thứ khiến "xoá Super Admin" bất khả. `ADMIN` KHÔNG mang
 * `audit.read` lẫn `system.feature_flags`, còn `SUPER_ADMIN` mang cả hai (xem
 * `role-presets.ts`) ⇒ mọi thao tác của `ADMIN` lên account `SUPER_ADMIN` — kể cả gửi
 * bộ quyền RỖNG để thu sạch — đều bị luật #2 chặn trước khi chạm DB.
 *
 * Cả hai hàm trả mảng **sorted + dedup** để thông điệp lỗi tất định, dễ test.
 */

function sortedUnique(keys: Iterable<PermissionKey>): PermissionKey[] {
  return [...new Set(keys)].sort();
}

/** Luật #1: key actor định cấp mà chính actor KHÔNG có. Rỗng ⇒ hợp lệ. */
export function keysActorCannotGrant(
  actorPermissions: ReadonlySet<PermissionKey>,
  requestedKeys: readonly PermissionKey[],
): PermissionKey[] {
  return sortedUnique(
    requestedKeys.filter((key) => !actorPermissions.has(key)),
  );
}

/** Luật #2: key target ĐANG mang mà actor KHÔNG có. Rỗng ⇒ actor được phép sửa target. */
export function keysBlockingActorFromTarget(
  actorPermissions: ReadonlySet<PermissionKey>,
  targetPermissions: ReadonlySet<PermissionKey>,
): PermissionKey[] {
  return sortedUnique(
    [...targetPermissions].filter((key) => !actorPermissions.has(key)),
  );
}
