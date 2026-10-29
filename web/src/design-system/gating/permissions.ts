// hand-authored — web gating primitives (Story 1.10, mirror Flutter
// mobile/lib/design_system/gating/app_permissions.dart). Pure, presentation-only
// permission helpers: no network, no router, no business logic (AD-1/2).
//
// GATING IS UX ONLY (AD-4): hiding a surface a user lacks permission for is a
// convenience, NOT access control — the backend enforces EVERY request. Never
// treat a hidden nav item / null-rendered <Gate> as a security boundary.
//
// KEY-AGNOSTIC (AD-17): a permission key is just an opaque string. The canonical
// permission registry is owned by the backend `accounts/domain`, generated from
// code, and consumed identically by FE gating / BE guard / noti resolver. These
// helpers only compare strings — they hardcode NO permission literal in their
// logic, so when Epic 2 wires `/me`, the registry changes in one place and this
// logic is untouched.

/** An opaque permission key. Not a hardcoded union — the registry is backend-owned (AD-17). */
export type PermissionKey = string;

/** The effective permission set of the current Account (Epic 1 = stub, Epic 2 = `/me`). */
export type PermissionSet = ReadonlySet<PermissionKey>;

/** Membership test. Pure, no side effects. */
export function can(perms: PermissionSet, key: PermissionKey): boolean {
  return perms.has(key);
}

/**
 * Order list scope (AD-17, FR-18): `'all'` when the Account may see every order,
 * `'mine'` when it may see only its own, `'none'` when it holds NEITHER key.
 * "View all orders" and "own orders only" are two EXPLICIT keys in the registry.
 *
 * `'none'` is what makes this usable for nav gating (Story 5.3, UX-DR-22):
 * collapsing "no permission at all" into `'mine'` would claim every signed-in
 * account may see some orders, so the Đơn hàng nav item could never be hidden.
 * Scope is still UX only — the backend answers `GET /orders` with 403 (AD-4).
 */
export function orderScope(perms: PermissionSet): 'all' | 'mine' | 'none' {
  if (can(perms, PERM.ordersViewAll)) return 'all';
  if (can(perms, PERM.ordersViewOwn)) return 'mine';
  return 'none';
}

/** A nav link carrying an optional permission gate. Structural — matches `NavLink`. */
interface GatedLink {
  requires?: PermissionKey;
  /** Any-of gate: the link survives when the Account holds AT LEAST ONE of these keys. */
  requiresAny?: readonly PermissionKey[];
  key?: string;
}

/** A nav section with gated links. Structural — matches `NavSection`. */
interface GatedSection<L extends GatedLink> {
  links: L[];
}

/**
 * Filter a nav tree by permission (UX-DR-22): drop any link the Account cannot
 * satisfy, then drop any section left with zero links (no orphan group header).
 * Pure — returns a new array, never mutates the input.
 *
 * TWO gate shapes, mirroring the backend's two permission decorators:
 * - `requires` (ALL-of, one key): the ordinary case.
 * - `requiresAny` (ANY-of): for an action split across several permission keys,
 *   where no single key is a correct gate. Đơn hàng is the case that forced it —
 *   `orders.view_all` would hide the item from exactly the people the list is
 *   for, and `orders.view_own` would hide it from admins, because the role
 *   presets grant `view_all` WITHOUT `view_own`.
 *
 * The gate lives on the LINK DATA, not in a caller: every screen already routes
 * its sidebar through `filterNav`, so a per-screen wrapper would gate only the
 * screens that remembered to call it — and the item would stay visible on every
 * other screen, which is where a user without the permission actually is.
 *
 * Generic over the concrete link/section shape so `permissions.ts` stays
 * independent of the shell (`Sidebar` imports the `PermissionKey` type from here,
 * not the reverse — no circular dependency).
 */
export function filterNav<L extends GatedLink, S extends GatedSection<L>>(
  sections: S[],
  perms: PermissionSet,
): S[] {
  return sections
    .map((section) => ({
      ...section,
      links: section.links.filter(
        (link) =>
          (link.requires == null || can(perms, link.requires)) &&
          (link.requiresAny == null || link.requiresAny.some((key) => can(perms, key))),
      ),
    }))
    .filter((section) => section.links.length > 0);
}

/**
 * Named permission keys used by the UI. Every value is a key from the canonical
 * backend registry (AD-17); Story 2.6 binds them to `backend/openapi/permissions.json`
 * via a drift-guard test (permission-keys.test.mjs) so no value can drift, and
 * `permission-keys.generated.ts` is the registry-derived SSOT for future imports.
 * This is NOT the source of truth; the backend always enforces every request
 * (AD-4) — hiding UI is only UX. When `/me` lands (Epic 2), the effective set is
 * sourced from the session provider, not the `DEMO_PERMISSIONS` stub below,
 * leaving `Gate` / `can` / `filterNav` / `orderScope` untouched.
 */
export const PERM = {
  /** May view ALL orders (vs only their own) — drives `orderScope` (FR-18). */
  ordersViewAll: 'orders.view_all',
  /** May view ONLY their own orders — the `'mine'` scope (FR-18). */
  ordersViewOwn: 'orders.view_own',
  /** May read the audit log (FR-20) — gated on this permission, never on a role. */
  auditRead: 'audit.read',
  /** May manage account permissions (the Phân quyền screen, Epic 8). */
  permissionsManage: 'permissions.manage',
  /** May view the finance dashboard numbers (FR-19, Epic 8). */
  dashboardFinanceView: 'dashboard.finance_view',
  /** May manage customers — gates the Khách hàng nav item + all customer screens (FR-29). */
  customersManage: 'customers.manage',
  /** May configure the system — gates the Cấu hình nav item + the customer-source catalogue writes (FR-35). */
  settingsManage: 'settings.manage',
  /** May move stock in/out — one of the two keys that open the Tồn kho screen (FR-25). */
  inventoryManage: 'inventory.manage',
  /** May create/edit quotes — sale reads Khả dụng on the Tồn kho screen to promise stock (FR-25). */
  quotesCreateEdit: 'quotes.create_edit',
} as const;

/**
 * STUB effective permission set — Epic 1 PLACEHOLDER ONLY (see `PERM`). Models a
 * demo manager: sees all orders + manages permissions, but is NOT a Super Admin
 * (so the Audit nav item is gated OUT), demonstrating `filterNav`. Epic 2 sources
 * this from `/me`.
 */
export const DEMO_PERMISSIONS: PermissionSet = new Set<PermissionKey>([
  PERM.ordersViewAll,
  PERM.permissionsManage,
]);
