// hand-authored — the web route table (Story 10.4): nav key ⇄ path, ONE table.
//
// Gating reuses the sidebar's own data: a route opens exactly when
// `filterNav(SIDEBAR_NAV, perms)` still holds a link with its key — no second
// list of permissions here (AD-17), and gating is UX only: the backend enforces
// every request (AD-4). Paths are code, so English; labels stay in SIDEBAR_NAV.
import { filterNav } from '../design-system/gating';
import type { PermissionSet } from '../design-system/gating';
import { SIDEBAR_NAV } from '../design-system/shell';

/** Every nav key the web has a screen for, with the path that opens it. */
export const NAV_ROUTES = {
  home: '/dashboard',
  orders: '/orders',
  customers: '/customers',
  inventory: '/inventory',
  warranty: '/warranty',
  settings: '/settings',
  permissions: '/permissions',
  profile: '/profile',
} as const;

export type NavRouteKey = keyof typeof NAV_ROUTES;

/** Keys the sidebar may show: a link without a screen is hidden, never a placeholder page (UX-DR-22). */
export const AVAILABLE_NAV_KEYS: ReadonlySet<string> = new Set(Object.keys(NAV_ROUTES));

/** Child routes of `customers` (they inherit its gate). */
export const CUSTOMER_LOOKUP_PATH = '/customers/lookup';
/** The E.164 key carries a `+`, so it is encoded into the path segment. */
export function customerPath(phone: string): string {
  return `${NAV_ROUTES.customers}/${encodeURIComponent(phone)}`;
}

/**
 * Child routes of `orders` (they inherit its gate; some add a permission of their
 * own). The static ones are matched before `/orders/:id`.
 */
export const ORDER_NEW_PATH = '/orders/new';
export const DISCOUNT_APPROVALS_PATH = '/orders/discount-approvals';
export function orderPath(id: string): string {
  return `${NAV_ROUTES.orders}/${encodeURIComponent(id)}`;
}
export function orderTransitionPath(id: string): string {
  return `${orderPath(id)}/transition`;
}
export function orderPaymentsPath(id: string): string {
  return `${orderPath(id)}/payments`;
}
export function orderContractsPath(id: string): string {
  return `${orderPath(id)}/contracts`;
}
export function orderInvoicesPath(id: string): string {
  return `${orderPath(id)}/invoices`;
}
export function orderInvoicePath(id: string, invoiceId: string): string {
  return `${orderInvoicesPath(id)}/${encodeURIComponent(invoiceId)}`;
}

/** Child route of `inventory`: the Phiếu kho screen, which also needs `inventory.manage`. */
export const STOCK_VOUCHERS_PATH = '/inventory/vouchers';

/** Child routes of `permissions` (they inherit its gate): the account form. `new` is matched before `:id/edit`. */
export const ACCOUNT_NEW_PATH = '/permissions/new';
export function accountEditPath(id: string): string {
  return `${NAV_ROUTES.permissions}/${encodeURIComponent(id)}/edit`;
}

/** Signed-out routes. */
export const LOGIN_PATH = '/login';
export const FORGOT_PASSWORD_PATH = '/forgot-password';

export function pathOfKey(key: string): string | undefined {
  return Object.hasOwn(NAV_ROUTES, key) ? NAV_ROUTES[key as NavRouteKey] : undefined;
}

/** Route keys this account may open, in sidebar order. */
export function openableKeys(perms: PermissionSet): NavRouteKey[] {
  return filterNav(SIDEBAR_NAV, perms)
    .flatMap((section) => section.links.map((link) => link.key))
    .filter((key): key is NavRouteKey => AVAILABLE_NAV_KEYS.has(key));
}

/** Where `/`, an unknown path or a gated-out path lands: the first openable route, else Hồ sơ. */
export function landingPath(perms: PermissionSet): string {
  const [first] = openableKeys(perms);
  return first === undefined ? NAV_ROUTES.profile : NAV_ROUTES[first];
}
