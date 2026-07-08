// Native Flutter behaviour tests for the app-shell layer (Story 1.8, Task 5 —
// AC-1/2, AD-1/2). The shell only EMITS intent: back/action/tab/FAB fire their
// callbacks and nothing else — no navigation, no widget-tree mutation.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/icons/app_icons.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';

Widget _host(Widget child) => MaterialApp(
      home: Scaffold(body: Center(child: child)),
    );

Finder _iconNamed(String name) =>
    find.byWidgetPredicate((w) => w is AppIcon && w.name == name);

void main() {
  group('AppTopbar callbacks', () {
    testWidgets('tap back → onBack fires once', (tester) async {
      var back = 0;
      await tester.pumpWidget(_host(
        AppTopbar(title: 'T', onBack: () => back++),
      ));

      await tester.tap(_iconNamed('ic-chevron-left'));
      await tester.pump();
      expect(back, 1);
    });

    testWidgets('tap action → onAction fires', (tester) async {
      var act = 0;
      await tester.pumpWidget(_host(
        AppTopbar(
          title: 'T',
          action: const Text('Đăng nhập'),
          onAction: () => act++,
        ),
      ));

      await tester.tap(find.text('Đăng nhập'));
      await tester.pump();
      expect(act, 1);
    });

    testWidgets('tap an AppIcon action → onAction fires', (tester) async {
      var act = 0;
      await tester.pumpWidget(_host(
        AppTopbar(
          title: 'T',
          action: const AppIcon('ic-more', size: 15.0),
          onAction: () => act++,
        ),
      ));

      await tester.tap(_iconNamed('ic-more'));
      await tester.pump();
      expect(act, 1);
    });
  });

  group('AppBottomNav callbacks', () {
    testWidgets('tap an ordinary tab → onSelect(index)', (tester) async {
      final selected = <int>[];
      await tester.pumpWidget(_host(
        AppBottomNav(activeIndex: 0, onSelect: selected.add),
      ));

      await tester.tap(find.text('Đơn hàng')); // index 1
      await tester.tap(find.text('Kho')); // index 3
      await tester.tap(find.text('Menu')); // index 4
      await tester.pump();
      expect(selected, [1, 3, 4]);
    });

    testWidgets('tap FAB → onCreateQuote, never onSelect', (tester) async {
      var create = 0;
      final selected = <int>[];
      await tester.pumpWidget(_host(
        AppBottomNav(
          activeIndex: 0,
          onSelect: selected.add,
          onCreateQuote: () => create++,
        ),
      ));

      await tester.tap(find.text('Tạo'));
      await tester.pump();
      expect(create, 1);
      expect(selected, isEmpty);
    });

    testWidgets('tapping the TOP of the raised FAB ring fires onCreateQuote',
        (tester) async {
      // Regression: the FAB used to be raised with Transform.translate, which
      // overflowed the nav's hit bounds — the top ~22px of the ring was dead.
      var create = 0;
      await tester.pumpWidget(_host(
        AppBottomNav(activeIndex: 0, onCreateQuote: () => create++),
      ));

      // A point well above the ic-plus centre, inside the raised ring — this is
      // the band that was previously not hit-testable.
      final center = tester.getCenter(_iconNamed('ic-plus'));
      await tester.tapAt(Offset(center.dx, center.dy - 24));
      await tester.pump();
      expect(create, 1);
    });

    testWidgets('tapping a tab with a null onSelect does not throw',
        (tester) async {
      await tester.pumpWidget(_host(const AppBottomNav(activeIndex: 0)));
      // Callbacks are optional — a caller may render a read-only nav.
      await tester.tap(find.text('Kho'));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  });

  group('Shell has no router / no side effects (AD-1/2)', () {
    testWidgets('tapping a tab does not mutate the widget tree', (tester) async {
      await tester.pumpWidget(_host(
        AppMobileShell(
          topbar: const AppTopbar(title: 'Trang chủ'),
          body: const Text('Thân'),
          bottomNav: AppBottomNav(activeIndex: 0, onSelect: (_) {}),
        ),
      ));

      // Nav is stateless: after tapping, the same tree is shown — no route push.
      await tester.tap(find.text('Kho'));
      await tester.pump();
      expect(find.text('Thân'), findsOneWidget);
      expect(find.text('Menu'), findsOneWidget);
      expect(find.byType(Navigator), findsOneWidget); // only MaterialApp's own
    });
  });

  group('Auth screen assembly (AC-4)', () {
    testWidgets('Quên mật khẩu: topbar back + "Đăng nhập" action, no bottom-nav',
        (tester) async {
      var back = 0;
      var toLogin = 0;
      await tester.pumpWidget(_host(
        AppMobileShell(
          topbar: AppTopbar(
            title: 'Quên mật khẩu',
            onBack: () => back++,
            action: const Text('Đăng nhập'),
            onAction: () => toLogin++,
          ),
          body: const Text('Nhập email để đặt lại'),
        ),
      ));

      // Auth flow: nav is dropped, topbar stays with a back + text action.
      expect(find.byType(AppBottomNav), findsNothing);
      expect(find.text('Quên mật khẩu'), findsOneWidget);
      expect(find.text('Nhập email để đặt lại'), findsOneWidget);

      await tester.tap(find.text('Đăng nhập'));
      await tester.tap(_iconNamed('ic-chevron-left'));
      await tester.pump();
      // Both affordances only EMIT intent — the shell never navigates.
      expect(toLogin, 1);
      expect(back, 1);
    });
  });
}
