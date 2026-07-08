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
 * else `'mine'`. "View all orders" and "own orders only" are two EXPLICIT keys in
 * the registry — this drives the Order list scope in Epic 5.
 */
export function orderScope(perms: PermissionSet): 'all' | 'mine' {
  return can(perms, PERM.ordersViewAll) ? 'all' : 'mine';
}

/** A nav link carrying an optional permission gate. Structural — matches `NavLink`. */
interface GatedLink {
  requires?: PermissionKey;
}

/** A nav section with gated links. Structural — matches `NavSection`. */
interface GatedSection<L extends GatedLink> {
  links: L[];
}

/**
 * Filter a nav tree by permission (UX-DR-22): drop any link whose `requires` is
 * not in `perms`, then drop any section left with zero links (no orphan group
 * header). Pure — returns a new array, never mutates the input.
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
      links: section.links.filter((link) => link.requires == null || can(perms, link.requires)),
    }))
    .filter((section) => section.links.length > 0);
}

/**
 * STUB permission keys — Epic 1 PLACEHOLDER ONLY. Epic 2 replaces this with the
 * permission registry generated from backend code (AD-17). This is NOT the source
 * of truth; the backend always enforces every request (AD-4) — hiding UI is only
 * UX. Do not clone these literals across the codebase: when `/me` lands, swap
 * `PERM` / `DEMO_PERMISSIONS` and the `requires` values in `SIDEBAR_NAV` in ONE
 * place, leaving `Gate` / `can` / `filterNav` / `orderScope` untouched.
 */
export const PERM = {
  /** May view ALL orders (vs only their own) — drives `orderScope` (FR-18). */
  ordersViewAll: 'orders.view_all',
  /** May read the audit log — Super Admin only (FR-20). */
  auditRead: 'audit.read',
  /** May manage account permissions (the Phân quyền screen, Epic 8). */
  permissionsManage: 'permissions.manage',
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
