// Native Flutter tests for AppTabs (Story 5.4) — the mobile twin of the web
// `shell/Tabs.tsx`.
//
// Like the rest of the shell, AppTabs only EMITS intent: tapping fires
// `onSelect(key)` and changes nothing itself (AD-1/2). The active marker is a
// style difference, so the test asserts the two tabs really do render
// differently rather than trusting that a colour was passed somewhere.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/shell/app_tabs.dart';
import 'package:pns_mobile/design_system/tokens/app_tokens.dart';

const List<AppTabItem> _tabs = <AppTabItem>[
  AppTabItem(key: 'a', label: 'Thông tin'),
  AppTabItem(key: 'b', label: 'Lịch sử update'),
  AppTabItem(key: 'c', label: 'Ảnh'),
];

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

TextStyle _styleOf(WidgetTester tester, String label) =>
    tester.widget<Text>(find.text(label)).style!;

void main() {
  testWidgets('renders every tab it was given', (WidgetTester tester) async {
    await tester.pumpWidget(_host(const AppTabs(tabs: _tabs, activeKey: 'a')));

    for (final AppTabItem tab in _tabs) {
      expect(find.text(tab.label), findsOneWidget);
    }
  });

  testWidgets('the active tab is styled differently from the inactive ones',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const AppTabs(tabs: _tabs, activeKey: 'b')));

    final TextStyle active = _styleOf(tester, 'Lịch sử update');
    final TextStyle inactive = _styleOf(tester, 'Thông tin');

    expect(active.color, AppTokens.teal700);
    expect(inactive.color, AppTokens.muted);
    expect(active.fontWeight, FontWeight.w800);
    expect(inactive.fontWeight, FontWeight.w600);
  });

  testWidgets('tap fires onSelect with THAT tab key — and nothing else',
      (WidgetTester tester) async {
    final List<String> selected = <String>[];
    await tester.pumpWidget(
      _host(
        AppTabs(
          tabs: _tabs,
          activeKey: 'a',
          onSelect: (String key) => selected.add(key),
        ),
      ),
    );

    await tester.tap(find.text('Lịch sử update'));
    await tester.pumpAndSettle();

    expect(selected, <String>['b']);
    // Purely presentational: the widget does not adopt the tapped key itself —
    // the caller owns that state (AD-1/2).
    expect(_styleOf(tester, 'Lịch sử update').color, AppTokens.muted);
  });

  testWidgets('without onSelect a tap is inert, not a crash',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const AppTabs(tabs: _tabs, activeKey: 'a')));

    await tester.tap(find.text('Ảnh'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('a long label set scrolls instead of overflowing a phone width',
      (WidgetTester tester) async {
    // Labels are byte-identical with web (UX-DR-27), and two full Vietnamese
    // labels already exceed a phone width — shortening them here would break
    // parity, so the row scrolls on its own axis.
    tester.view.physicalSize = const Size(1080, 2340); // ~360dp at dpr 3
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_host(const AppTabs(tabs: _tabs, activeKey: 'a')));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
