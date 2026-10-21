// hand-authored — Flutter gating primitives (Story 1.10, mirror web
// web/src/design-system/gating/permissions.ts). Pure, presentation-only
// permission helpers: no network, no router, no business logic (AD-1/2).
//
// GATING IS UX ONLY (AD-4): hiding a surface a user lacks permission for is a
// convenience, NOT access control — the backend enforces EVERY request. Never
// treat a hidden nav item / shrunk AppGate as a security boundary.
//
// KEY-AGNOSTIC (AD-17): a permission key is just an opaque String. The canonical
// permission registry is owned by the backend `accounts/domain`, generated from
// code, and consumed identically by FE gating / BE guard / noti resolver. These
// helpers only compare Strings — they hardcode NO permission literal in their
// logic, so when Epic 2 wires `/me`, the registry changes in one place and this
// logic is untouched.

/// An opaque permission key. Not a hardcoded enum — the registry is
/// backend-owned (AD-17).
typedef PermissionKey = String;

/// Membership test. Pure, no side effects.
bool can(Set<PermissionKey> perms, PermissionKey key) => perms.contains(key);

/// Order list scope (AD-17, FR-18): `'all'` when the Account may see every
/// order, `'mine'` when it may see only its own, `'none'` when it holds NEITHER
/// key. "View all orders" and "own orders only" are two EXPLICIT keys in the
/// registry.
///
/// `'none'` (Story 5.3) mirrors web byte-for-byte — the parity drift-guard
/// compares both helpers. On mobile it does NOT hide a tab: the bottom nav is a
/// LOCKED 5-tab contract (UX-DR-15), so an account without either key still sees
/// Đơn hàng and gets the screen's error state from the backend 403 (AD-4).
String orderScope(Set<PermissionKey> perms) {
  if (can(perms, AppPerm.ordersViewAll)) return 'all';
  if (can(perms, AppPerm.ordersViewOwn)) return 'mine';
  return 'none';
}

/// A nav link carrying an optional permission gate (parity with web `NavLink`).
/// The mobile bottom-nav is LOCKED to 5 tabs (UX-DR-15) and is never filtered;
/// this type gates the filterable surfaces instead — the "Menu" list + in-screen
/// actions (Epic 3+).
class AppNavLink {
  const AppNavLink({
    required this.key,
    required this.label,
    this.icon,
    this.requires,
  });

  final String key;
  final String label;
  final String? icon;

  /// Permission this link requires; null = always visible.
  final PermissionKey? requires;
}

/// A nav section with gated links (parity with web `NavSection`).
class AppNavSection {
  const AppNavSection({required this.links, this.title});

  final String? title;
  final List<AppNavLink> links;

  AppNavSection copyWithLinks(List<AppNavLink> newLinks) =>
      AppNavSection(title: title, links: newLinks);
}

/// Filter a nav tree by permission (UX-DR-22): drop any link whose [requires]
/// is not in [perms], then drop any section left with zero links (no orphan
/// group header). Pure — returns a new list, never mutates the input.
List<AppNavSection> filterNav(
  List<AppNavSection> sections,
  Set<PermissionKey> perms,
) {
  return sections
      .map((section) => section.copyWithLinks(
            section.links
                .where((link) =>
                    link.requires == null || can(perms, link.requires!))
                .toList(),
          ))
      .where((section) => section.links.isNotEmpty)
      .toList();
}

/// Named permission keys used by the UI. Every value is a key from the canonical
/// backend registry (AD-17); Story 2.6 binds them to
/// `backend/openapi/permissions.json` via a drift-guard test
/// (permission-keys.test.mjs) so no value can drift, and app_permission_keys.g.dart
/// is the registry-derived SSOT for future imports. This is NOT the source of
/// truth; the backend always enforces every request (AD-4) — hiding UI is only
/// UX. When `/me` lands (Epic 2), the effective set is sourced from the session
/// provider, not the [demoPermissions] stub below, leaving [can] / [filterNav] /
/// [orderScope] / AppGate untouched.
class AppPerm {
  AppPerm._();

  /// May view ALL orders (vs only their own) — drives [orderScope] (FR-18).
  static const PermissionKey ordersViewAll = 'orders.view_all';

  /// May view ONLY their own orders — the `'mine'` scope (FR-18).
  static const PermissionKey ordersViewOwn = 'orders.view_own';

  /// May read the audit log — Super Admin only (FR-20).
  static const PermissionKey auditRead = 'audit.read';

  /// May manage account permissions (the Phân quyền screen, Epic 8).
  static const PermissionKey permissionsManage = 'permissions.manage';

  /// May view the finance dashboard numbers (FR-19, Epic 8).
  static const PermissionKey dashboardFinanceView = 'dashboard.finance_view';

  /// May manage customers — gates the Khách hàng surfaces + all customer screens (FR-29).
  static const PermissionKey customersManage = 'customers.manage';

  /// May configure the system (FR-35). Declared here for KEY parity even though the
  /// Cấu hình nguồn khách screen is web-only (DESIGN.md): the drift-guard deepEquals
  /// the web PERM and this AppPerm key lists IN ORDER, so a key added on one side
  /// only turns the guard red. Parity of KEYS is not parity of SCREENS.
  static const PermissionKey settingsManage = 'settings.manage';

  /// May move stock in/out — one of the two keys that open the Tồn kho screen (FR-25).
  static const PermissionKey inventoryManage = 'inventory.manage';

  /// May create/edit quotes — sale reads Khả dụng on the Tồn kho screen to promise stock (FR-25).
  static const PermissionKey quotesCreateEdit = 'quotes.create_edit';
}

/// STUB effective permission set — Epic 1 PLACEHOLDER ONLY (see [AppPerm]).
/// Models a demo manager: sees all orders + manages permissions, but is NOT a
/// Super Admin (so the Audit surface is gated OUT), demonstrating [filterNav].
/// Epic 2 sources this from `/me`.
const Set<PermissionKey> demoPermissions = {
  AppPerm.ordersViewAll,
  AppPerm.permissionsManage,
};
