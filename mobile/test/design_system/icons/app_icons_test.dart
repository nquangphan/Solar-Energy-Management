// Native Flutter guard for the shared icon sprite (Story 1.2, Task 4, mobile).
//
// Asserts the mobile icon registry carries exactly the 46 canonical names with
// no stray entry, that every SVG string is self-contained stroke=currentColor
// markup with 0 external references, and that AppIcon renders without error.
// Cross-platform equality vs icons.json is enforced by
// design-system/icons/parity.test.mjs.

import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/icons/app_icons.dart';

// The canonical 46-name set, verbatim from the mockup (UX-DR-18).
const canonical = <String>{
  'ic-home', 'ic-orders', 'ic-invoice', 'ic-inventory', 'ic-warehouse', 'ic-menu',
  'ic-customer', 'ic-users', 'ic-user', 'ic-product', 'ic-catalog', 'ic-payment',
  'ic-contract', 'ic-audit', 'ic-permissions', 'ic-status', 'ic-plus', 'ic-minus',
  'ic-check', 'ic-close', 'ic-edit', 'ic-trash', 'ic-copy', 'ic-send', 'ic-share',
  'ic-download', 'ic-external', 'ic-refresh', 'ic-search', 'ic-filter', 'ic-sort',
  'ic-more', 'ic-bell', 'ic-mail', 'ic-phone', 'ic-camera', 'ic-image', 'ic-file',
  'ic-clock', 'ic-info', 'ic-alert', 'ic-ban', 'ic-chevron-left', 'ic-chevron-right',
  'ic-chevron-down', 'ic-sun',
};

void main() {
  test('registry has exactly the 46 canonical icons, no stray names (AC-3)', () {
    expect(AppIcons.registry.length, 46);
    expect(AppIcons.names.length, 46);
    expect(AppIcons.registry.keys.toSet(), canonical);
    expect(AppIcons.names.toSet(), canonical);
  });

  test('every icon is self-contained currentColor SVG, 0 external ref (AC-1)', () {
    final banned = RegExp(r'https?:|xlink:href|<image|url\(', caseSensitive: false);
    for (final entry in AppIcons.registry.entries) {
      final svg = entry.value;
      expect(svg.contains('stroke="currentColor"'), isTrue, reason: '${entry.key} not currentColor');
      expect(svg.contains('stroke-width="2"'), isTrue, reason: '${entry.key} missing stroke-width=2');
      expect(svg.contains('fill="none"'), isTrue, reason: '${entry.key} missing fill=none');
      expect(banned.hasMatch(svg), isFalse, reason: '${entry.key} has an external reference');
    }
  });

  test('intentional duplicate icons keep identical bodies (mockup wins)', () {
    expect(AppIcons.registry['ic-product'], AppIcons.registry['ic-inventory']);
    expect(AppIcons.registry['ic-contract'], AppIcons.registry['ic-file']);
    expect(AppIcons.registry['ic-users'], AppIcons.registry['ic-customer']);
  });

  test('the six canonical sizes are exposed (AC-2)', () {
    expect(AppIcons.defaultSize, 18.0);
    expect(AppIcons.sizes, [18.0, 22.0, 16.0, 15.0, 14.0, 13.0]);
  });

  testWidgets('AppIcon smoke-renders and inherits colour via colorFilter (AC-2)', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: DefaultTextStyle(
          style: TextStyle(color: Color(0xFF0E9F8E)),
          child: AppIcon('ic-home'),
        ),
      ),
    );
    expect(find.byType(AppIcon), findsOneWidget);
    expect(find.byType(SvgPicture), findsOneWidget);
  });

  testWidgets('AppIcon accepts an explicit colour and size (AC-2)', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: AppIcon('ic-plus', size: 22.0, color: Color(0xFF0E9F8E)),
      ),
    );
    expect(find.byType(SvgPicture), findsOneWidget);
  });

  testWidgets('AppIcon defaults to the 18px canonical size (AC-2)', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: AppIcon('ic-home'),
      ),
    );
    final rendered = tester.widget<SvgPicture>(find.byType(SvgPicture));
    expect(rendered.width, AppIcons.defaultSize);
    expect(rendered.height, AppIcons.defaultSize);
  });

  testWidgets('AppIcon renders the requested size verbatim (AC-2)', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: AppIcon('ic-plus', size: 14.0),
      ),
    );
    final rendered = tester.widget<SvgPicture>(find.byType(SvgPicture));
    expect(rendered.width, 14.0);
    expect(rendered.height, 14.0);
  });

  testWidgets('AppIcon with an unknown name trips the debug assert', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: AppIcon('ic-does-not-exist'),
      ),
    );
    expect(tester.takeException(), isAssertionError);
  });
}
