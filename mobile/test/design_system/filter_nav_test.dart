// filterNav (Story 10.7): the two gate shapes of the web twin — `requires` (all-of,
// one key) and `requiresAny` (any-of) — plus the empty-section drop, and the
// mobile Menu data filtered per account.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/gating/gating.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';

const _sections = [
  AppNavSection(
    links: [
      AppNavLink(key: 'open', label: 'Open'),
      AppNavLink(key: 'all', label: 'All', requires: 'a.read'),
      AppNavLink(key: 'any', label: 'Any', requiresAny: ['b.read', 'c.read']),
      AppNavLink(key: 'both', label: 'Both', requires: 'a.read', requiresAny: ['b.read', 'c.read']),
    ],
  ),
  AppNavSection(
    title: 'Admin',
    links: [AppNavLink(key: 'admin', label: 'Admin', requires: 'z.manage')],
  ),
];

List<String> _keys(List<AppNavSection> sections) => [
  for (final s in sections)
    for (final l in s.links) l.key,
];

void main() {
  test('requiresAny keeps a link when the account holds any one of the keys', () {
    expect(_keys(filterNav(_sections, {'b.read'})), ['open', 'any']);
    expect(_keys(filterNav(_sections, {'c.read'})), ['open', 'any']);
    expect(_keys(filterNav(_sections, {})), ['open']);
  });

  test('requires and requiresAny together need both to hold', () {
    expect(_keys(filterNav(_sections, {'a.read'})), ['open', 'all']);
    expect(_keys(filterNav(_sections, {'a.read', 'c.read'})), ['open', 'all', 'any', 'both']);
  });

  test('a section left with no link is dropped, title and all', () {
    final filtered = filterNav(_sections, {'a.read'});
    expect(filtered, hasLength(1));
    expect(filterNav(_sections, {'z.manage'}).last.title, 'Admin');
  });

  group('kMobileMenu', () {
    List<String> menu(Set<String> perms) => _keys(filterNav(kMobileMenu, perms));

    test('no permission ⇒ only Hồ sơ', () => expect(menu({}), ['profile']));
    test('customers.manage ⇒ + Khách hàng', () => expect(menu({'customers.manage'}), ['customers', 'profile']));
    test('either order read key ⇒ + Tra cứu bảo hành', () {
      expect(menu({'orders.view_own'}), ['warranty', 'profile']);
      expect(menu({'orders.view_all'}), ['warranty', 'profile']);
    });
  });
}
