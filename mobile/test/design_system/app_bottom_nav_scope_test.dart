// AppBottomNavScope (Story 10.7): the signed-in app hands every bottom nav its tab
// intent through the scope; a bar outside any scope stays inert; a bar's own
// handler wins over the scope.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';

Widget _host(Widget child) => MaterialApp(
  home: Scaffold(body: Center(child: child)),
);

void main() {
  testWidgets('under a scope, tapping Menu emits onSelect(4) and the FAB emits onCreateQuote', (tester) async {
    final selected = <int>[];
    var created = 0;
    await tester.pumpWidget(
      _host(
        AppBottomNavScope(
          onSelect: selected.add,
          onCreateQuote: () => created++,
          child: const AppBottomNav(activeIndex: 4),
        ),
      ),
    );

    await tester.tap(find.text('Menu'));
    await tester.tap(find.text('Đơn hàng'));
    await tester.tap(find.text('Tạo'));
    await tester.pump();
    expect(selected, [4, 1]);
    expect(created, 1);
  });

  testWidgets('without a scope, taps do nothing and nothing throws', (tester) async {
    await tester.pumpWidget(_host(const AppBottomNav(activeIndex: 4)));
    await tester.tap(find.text('Menu'));
    await tester.tap(find.text('Tạo'));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('a bar\'s own handlers win over the scope', (tester) async {
    final fromScope = <int>[];
    final own = <int>[];
    var scopeCreated = 0;
    var ownCreated = 0;
    await tester.pumpWidget(
      _host(
        AppBottomNavScope(
          onSelect: fromScope.add,
          onCreateQuote: () => scopeCreated++,
          child: AppBottomNav(activeIndex: 0, onSelect: own.add, onCreateQuote: () => ownCreated++),
        ),
      ),
    );

    await tester.tap(find.text('Kho'));
    await tester.tap(find.text('Tạo'));
    await tester.pump();
    expect(own, [3]);
    expect(fromScope, isEmpty);
    expect([ownCreated, scopeCreated], [1, 0]);
  });
}
