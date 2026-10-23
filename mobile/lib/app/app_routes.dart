// hand-authored — the signed-in route table (Story 10.7, mirror web/src/app/routes.ts).
// Pure: paths, which nav key owns which path, and the permission gate — read
// from the SAME data the Menu and the bottom-nav tabs render (kMobileMenu,
// kMobileTabLinks), never from a second permission table (AD-17). The router
// (signed_in_app.dart) only consults it.
import '../design_system/gating/app_permission_keys.g.dart';
import '../design_system/gating/app_permissions.dart';
import '../design_system/shell/app_menu_nav.dart';

const String kHomePath = '/dashboard';
const String kMenuPath = '/menu';
const String kCustomersPath = '/customers';
const String kCustomerLookupPath = '/customers/lookup';
const String kWarrantyPath = '/warranty';
const String kProfilePath = '/profile';
const String kOrdersPath = '/orders';
const String kInventoryPath = '/inventory';

/// Child routes of `orders`; the static ones are registered before `/orders/:id`.
const String kOrderNewPath = '/orders/new';
const String kDiscountApprovalsPath = '/orders/discount-approvals';

/// Child route of `inventory`: the Phiếu kho screen.
const String kStockVouchersPath = '/inventory/vouchers';

/// A customer's detail. The phone is escaped: an E.164 `+` (or a stray `/`)
/// stays inside one path segment; the router hands the screen the decoded value.
String customerPath(String phone) => '$kCustomersPath/${Uri.encodeComponent(phone)}';

String orderPath(String id) => '$kOrdersPath/${Uri.encodeComponent(id)}';
String orderTransitionPath(String id) => '${orderPath(id)}/transition';
String orderPaymentsPath(String id) => '${orderPath(id)}/payments';
String orderContractsPath(String id) => '${orderPath(id)}/contracts';
String orderInvoicesPath(String id) => '${orderPath(id)}/invoices';
String orderInvoicePath(String id, String invoiceId) =>
    '${orderInvoicesPath(id)}/${Uri.encodeComponent(invoiceId)}';

/// Nav key (Menu entry or bottom-nav tab) → the screen it opens. An entry
/// without a route here is not shown.
const Map<String, String> kNavRoutes = {
  'home': kHomePath,
  'orders': kOrdersPath,
  'inventory': kInventoryPath,
  'customers': kCustomersPath,
  'warranty': kWarrantyPath,
  'profile': kProfilePath,
};

/// A child route that needs one permission more than its parent's gate: the key
/// of the endpoint its screen is built on (web `gateWith`). Checked by path
/// segments (empty ones ignored, so a trailing `/` changes nothing), and
/// `/orders/<id>/invoices/<invoiceId>` inherits the invoices key.
PermissionKey? subRoutePermission(String location) {
  final segments = [
    for (final s in Uri.parse(location).pathSegments)
      if (s.isNotEmpty) s,
  ];
  if (segments.length < 2) return null;
  final [root, child, ...] = segments;
  if (root == 'inventory' && child == 'vouchers') return AppPermissionKeys.inventoryManage;
  if (root != 'orders') return null;
  if (child == 'new') return AppPermissionKeys.quotesCreateEdit;
  if (child == 'discount-approvals') return AppPermissionKeys.discountsApprove;
  if (segments.length >= 3) {
    if (segments[2] == 'contracts') return AppPermissionKeys.contractsGenerate;
    if (segments[2] == 'invoices') return AppPermissionKeys.invoicesManage;
  }
  return null;
}

/// The nav keys [perms] may open — the gate the Menu, the tabs and the router share.
Set<String> openableKeys(Set<PermissionKey> perms) => {
  for (final section in filterNav([...kMobileMenu, const AppNavSection(links: kMobileTabLinks)], perms))
    for (final link in section.links)
      if (kNavRoutes.containsKey(link.key)) link.key,
};

/// Where a signed-in session starts: Trang chủ (like the web). It needs no
/// permission; the dashboard itself shows only the blocks the backend sends.
String landingPath(Set<PermissionKey> perms) => kHomePath;

/// Whether [location] (a path) may be shown to [perms]: the Menu always, any other
/// path only under a route the account may open, plus the child route's own
/// permission. An unknown path is not openable.
bool isOpenable(String location, Set<PermissionKey> perms) {
  if (location == kMenuPath) return true;
  final keys = openableKeys(perms);
  for (final entry in kNavRoutes.entries) {
    final path = entry.value;
    if (location == path || location.startsWith('$path/')) {
      final extra = subRoutePermission(location);
      return keys.contains(entry.key) && (extra == null || can(perms, extra));
    }
  }
  return false;
}
