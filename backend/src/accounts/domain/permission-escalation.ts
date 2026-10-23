import { PERM, type PermissionKey } from './permission-registry';

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

/**
 * A held key that covers a narrower one for granting/editing purposes only. `orders.view_all`
 * is a superset of `orders.view_own`, yet no preset holds both (one view scope each) ⇒ without
 * this an Admin could neither grant the field-worker presets nor edit any account holding
 * `orders.view_own`. Effective access is unchanged: the guard still checks literal keys.
 */
export const PERMISSION_IMPLIES: Partial<
  Record<PermissionKey, readonly PermissionKey[]>
> = {
  [PERM.ordersViewAll]: [PERM.ordersViewOwn],
};

/** Keys the actor may grant or may find on an account it edits: its own set plus what it implies. */
export function grantableBy(
  actorPermissions: ReadonlySet<PermissionKey>,
): Set<PermissionKey> {
  const grantable = new Set(actorPermissions);
  for (const key of actorPermissions) {
    for (const implied of PERMISSION_IMPLIES[key] ?? []) grantable.add(implied);
  }
  return grantable;
}

function sortedUnique(keys: Iterable<PermissionKey>): PermissionKey[] {
  return [...new Set(keys)].sort();
}

/** Luật #1: key actor định cấp mà chính actor KHÔNG có (xem `grantableBy`). Rỗng ⇒ hợp lệ. */
export function keysActorCannotGrant(
  actorPermissions: ReadonlySet<PermissionKey>,
  requestedKeys: readonly PermissionKey[],
): PermissionKey[] {
  const grantable = grantableBy(actorPermissions);
  return sortedUnique(requestedKeys.filter((key) => !grantable.has(key)));
}

/** Luật #2: key target ĐANG mang mà actor KHÔNG có (xem `grantableBy`). Rỗng ⇒ actor được phép sửa target. */
export function keysBlockingActorFromTarget(
  actorPermissions: ReadonlySet<PermissionKey>,
  targetPermissions: ReadonlySet<PermissionKey>,
): PermissionKey[] {
  const grantable = grantableBy(actorPermissions);
  return sortedUnique(
    [...targetPermissions].filter((key) => !grantable.has(key)),
  );
}
