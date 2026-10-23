import { PERM, type PermissionKey } from './permission-registry';

/**
 * Permissions that are useless — or worse, fail halfway with a 403 — without another one.
 * Saving a set that holds a key without what it requires is refused (400), so a screen the
 * account can open never breaks mid-flow:
 *  - `settings.manage`: the settings screen lists customer sources through
 *    `GET /customer-sources`, which is gated on `customers.manage`.
 *  - `quotes.create_edit`: the quote builder looks customers up / creates them
 *    (`customers.manage`) and lists catalog products and groups (`catalog.view`; that error is
 *    swallowed into an empty list, so it would fail silently).
 *
 * Pure domain: `PERM.x` only. Action/approval permissions added later extend THIS table.
 */
export const PERMISSION_REQUIRES: Partial<
  Record<PermissionKey, readonly PermissionKey[]>
> = {
  [PERM.settingsManage]: [PERM.customersManage],
  [PERM.quotesCreateEdit]: [PERM.customersManage, PERM.catalogView],
};

export interface MissingDependency {
  readonly key: PermissionKey;
  readonly missing: PermissionKey[];
}

/**
 * Every key of `keys` lacking some permission it requires, with what is missing. Sorted by key
 * and by missing key, so messages are deterministic. Empty ⇒ the set is consistent.
 */
export function missingDependencies(
  keys: Iterable<PermissionKey>,
): MissingDependency[] {
  const held = new Set(keys);
  return [...held]
    .sort()
    .map((key) => ({
      key,
      missing: (PERMISSION_REQUIRES[key] ?? [])
        .filter((required) => !held.has(required))
        .sort(),
    }))
    .filter((entry) => entry.missing.length > 0);
}

/**
 * The user-facing sentence for one gap, e.g. "«Cấu hình hệ thống» cần thêm «Quản lý khách
 * hàng».". `labelOf` maps a key to its registry label.
 */
export function dependencyMessage(
  gap: MissingDependency,
  labelOf: (key: PermissionKey) => string,
): string {
  const missing = gap.missing.map((key) => `«${labelOf(key)}»`).join(', ');
  return `«${labelOf(gap.key)}» cần thêm ${missing}.`;
}
