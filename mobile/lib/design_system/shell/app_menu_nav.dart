// hand-authored — the mobile Menu's navigation data (Story 10.7, mockup
// all-screens.html#s-menu). Mobile twin of web `SIDEBAR_NAV` (Sidebar.tsx): the
// bottom nav is LOCKED to 5 tabs (UX-DR-15), so permission gating happens here,
// on the Menu list, and the signed-in router gates its routes on the SAME data
// (AD-17) — never on a second permission table.
//
// Only entries that have a mobile screen are listed: an item with nowhere to go
// is hidden, not greyed (UX-DR-22, same rule as the web). Keys, `requires` and
// `requiresAny` match the web entry with the same key (design-system guard).

import '../gating/app_permission_keys.g.dart';
import '../gating/app_permissions.dart';

const List<AppNavSection> kMobileMenu = [
  AppNavSection(
    links: [
      AppNavLink(
        key: 'customers',
        label: 'Khách hàng',
        subtitle: 'Tra & quản lý theo SĐT',
        icon: 'ic-customer',
        requires: AppPermissionKeys.customersManage,
      ),
      // What the lookup returns IS order content — hence the two order read keys.
      AppNavLink(
        key: 'warranty',
        label: 'Tra cứu bảo hành',
        subtitle: 'Theo SĐT khách',
        icon: 'ic-phone',
        requiresAny: [AppPermissionKeys.ordersViewAll, AppPermissionKeys.ordersViewOwn],
      ),
      AppNavLink(key: 'profile', label: 'Hồ sơ', subtitle: 'Thông tin & đổi mật khẩu', icon: 'ic-user'),
    ],
  ),
];

/// The bottom-nav tabs that open a screen (Đơn hàng = 1, Kho = 3). The bar stays
/// locked to five tabs (UX-DR-15), so a tab is never hidden: one the account may
/// not open does nothing when tapped, and its route sends the account back to its
/// landing page. Keys and gates match the web `SIDEBAR_NAV` entries with the same
/// key (design-system guard).
const List<AppNavLink> kMobileTabLinks = [
  AppNavLink(
    key: 'orders',
    label: 'Đơn hàng',
    requiresAny: [AppPermissionKeys.ordersViewAll, AppPermissionKeys.ordersViewOwn],
  ),
  AppNavLink(
    key: 'inventory',
    label: 'Kho',
    requiresAny: [AppPermissionKeys.inventoryManage, AppPermissionKeys.quotesCreateEdit],
  ),
];
