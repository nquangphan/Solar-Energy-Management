// hand-authored — the signed-in route table (Story 10.7, mirror web/src/app/routes.ts).
// Pure: paths, which Menu key owns which path, and the permission gate — read
// from the SAME data the Menu renders (kMobileMenu), never from a second
// permission table (AD-17). The router (signed_in_app.dart) only consults it.
import '../design_system/gating/app_permissions.dart';
import '../design_system/shell/app_menu_nav.dart';

const String kMenuPath = '/menu';
const String kCustomersPath = '/customers';
const String kCustomerLookupPath = '/customers/lookup';
const String kWarrantyPath = '/warranty';
const String kProfilePath = '/profile';

/// A customer's detail. The phone is escaped: an E.164 `+` (or a stray `/`)
/// stays inside one path segment; the router hands the screen the decoded value.
String customerPath(String phone) => '$kCustomersPath/${Uri.encodeComponent(phone)}';

/// Menu key → the screen it opens. A Menu entry without a route here is not shown.
const Map<String, String> kNavRoutes = {
  'customers': kCustomersPath,
  'warranty': kWarrantyPath,
  'profile': kProfilePath,
};

/// The Menu keys [perms] may open — the gate the Menu and the router share.
Set<String> openableKeys(Set<PermissionKey> perms) => {
  for (final section in filterNav(kMobileMenu, perms))
    for (final link in section.links)
      if (kNavRoutes.containsKey(link.key)) link.key,
};

/// Where a signed-in session starts. The Menu for now: it is the one tab with
/// screens behind it until the orders/stock tabs are wired.
String landingPath(Set<PermissionKey> perms) => kMenuPath;

/// Whether [location] (a path) may be shown to [perms]: the Menu always, any other
/// path only under a route the account may open. An unknown path is not openable.
bool isOpenable(String location, Set<PermissionKey> perms) {
  if (location == kMenuPath) return true;
  final keys = openableKeys(perms);
  for (final entry in kNavRoutes.entries) {
    final path = entry.value;
    if (location == path || location.startsWith('$path/')) return keys.contains(entry.key);
  }
  return false;
}
