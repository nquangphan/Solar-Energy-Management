import { PERM, type PermissionKey } from './permission-registry';

/**
 * Permissions that are useless — or worse, fail halfway with a 403 — without another one.
 * Saving a set that holds a key without what it requires is refused (400), so a screen the
 * account can open never breaks mid-flow. Two shapes:
 *  - `PERMISSION_REQUIRES` (AND): every listed key is needed.
 *  - `PERMISSION_REQUIRES_ANY` (OR): at least one listed key is needed.
 *
 * Pure domain: `PERM.x` only. Action/approval permissions added later extend THESE tables.
 */
export const PERMISSION_REQUIRES: Partial<
  Record<PermissionKey, readonly PermissionKey[]>
> = {
  // The settings screen lists customer sources through `GET /customer-sources`, gated on
  // `customers.manage`.
  [PERM.settingsManage]: [PERM.customersManage],
  // The quote builder looks customers up / creates them (`customers.manage`) and lists catalog
  // products and groups (`catalog.view`; that error is swallowed into an empty list, so it
  // would fail silently).
  [PERM.quotesCreateEdit]: [PERM.customersManage, PERM.catalogView],
  // The approval queue is filtered by the order view scope (`listPendingDiscounts` uses the
  // same scope as the order list): an approver holding only `orders.view_own` never sees
  // anyone else's request, so the permission would be dead.
  [PERM.discountsApprove]: [PERM.ordersViewAll],
  // The catalog screen lists through `GET /products` and `/product-groups`, gated on
  // `catalog.view`.
  [PERM.catalogManage]: [PERM.catalogView],
};

/**
 * Order actions: every screen of these flows opens from the order list or detail, gated
 * `orders.view_all` OR `orders.view_own` — without either the flow is a 403 at its first
 * step. `orders.view_all` alone is enough (the Admin/Manager/Accountant presets hold it
 * without `view_own`), hence OR. `inventory.manage` is absent on purpose: stock levels and
 * stock-in vouchers run without any order.
 */
const ORDER_VIEW_SCOPES: readonly PermissionKey[] = [
  PERM.ordersViewAll,
  PERM.ordersViewOwn,
];

export const PERMISSION_REQUIRES_ANY: Partial<
  Record<PermissionKey, readonly PermissionKey[]>
> = {
  [PERM.quotesCreateEdit]: ORDER_VIEW_SCOPES,
  [PERM.ordersConfirm]: ORDER_VIEW_SCOPES,
  [PERM.discountsApply]: ORDER_VIEW_SCOPES,
  [PERM.constructionTransition]: ORDER_VIEW_SCOPES,
  [PERM.deliveryConfirm]: ORDER_VIEW_SCOPES,
  [PERM.paymentsRecord]: ORDER_VIEW_SCOPES,
  [PERM.contractsGenerate]: ORDER_VIEW_SCOPES,
  [PERM.invoicesManage]: ORDER_VIEW_SCOPES,
};

export interface MissingDependency {
  readonly key: PermissionKey;
  /** AND part: required keys not held, sorted. */
  readonly missing: PermissionKey[];
  /** OR part: the whole group in table order when none of it is held; empty otherwise. */
  readonly missingAnyOf: PermissionKey[];
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
    .map((key) => {
      const anyOf = PERMISSION_REQUIRES_ANY[key] ?? [];
      return {
        key,
        missing: (PERMISSION_REQUIRES[key] ?? [])
          .filter((required) => !held.has(required))
          .sort(),
        missingAnyOf: anyOf.some((option) => held.has(option))
          ? []
          : [...anyOf],
      };
    })
    .filter(
      (entry) => entry.missing.length > 0 || entry.missingAnyOf.length > 0,
    );
}

/**
 * The user-facing sentence for one gap, e.g. "«Cấu hình hệ thống» cần thêm «Quản lý khách
 * hàng»." or "«Chốt đơn» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».".
 * `labelOf` maps a key to its registry label.
 */
export function dependencyMessage(
  gap: MissingDependency,
  labelOf: (key: PermissionKey) => string,
): string {
  const quote = (key: PermissionKey) => `«${labelOf(key)}»`;
  const parts = gap.missing.map(quote);
  if (gap.missingAnyOf.length > 0) {
    parts.push(`một trong ${gap.missingAnyOf.map(quote).join(', ')}`);
  }
  return `«${labelOf(gap.key)}» cần thêm ${parts.join(', ')}.`;
}
