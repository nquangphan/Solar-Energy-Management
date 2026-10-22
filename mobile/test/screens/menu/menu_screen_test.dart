// MenuScreen (Story 10.7): renders the rows it is handed with their subtitle, the
// /me identity, emits the key of the row tapped, guards Đăng xuất against a double
// tap, stays flat (Viền nét) and fits a 320pt-wide phone.
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/gating.dart';
import 'package:pns_mobile/design_system/session/app_session.dart';
import 'package:pns_mobile/design_system/session/me_port.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';
import 'package:pns_mobile/screens/menu/menu_screen.dart';

const MeResponse _me = MeResponse(
  id: 'acc-1',
  email: 'hung@phuongnam.solar',
  phone: null,
  displayName: 'Trần Văn Hùng',
  permissions: ['customers.manage', 'orders.view_own'],
);

Widget _host(Widget screen) => MaterialApp(
  home: Scaffold(
    body: PermissionsScope(status: SessionStatus.ready, perms: _me.permissions.toSet(), me: _me, child: screen),
  ),
);

void main() {
  testWidgets('renders every row handed in, with its subtitle, and the /me identity', (tester) async {
    await tester.pumpWidget(_host(MenuScreen(sections: kMobileMenu, onOpen: (_) {}, onLogout: () async {})));

    for (final text in [
      'Khách hàng',
      'Tra & quản lý theo SĐT',
      'Tra cứu bảo hành',
      'Theo SĐT khách',
      'Hồ sơ',
      'Thông tin & đổi mật khẩu',
      'Trần Văn Hùng',
      'hung@phuongnam.solar',
    ]) {
      expect(find.text(text), findsOneWidget, reason: text);
    }
    expect(find.widgetWithText(AppButton, 'Đăng xuất'), findsOneWidget);
  });

  testWidgets('renders only the rows it is handed — the screen does not filter', (tester) async {
    await tester.pumpWidget(
      _host(MenuScreen(sections: filterNav(kMobileMenu, const {}), onOpen: (_) {}, onLogout: () async {})),
    );
    expect(find.text('Hồ sơ'), findsOneWidget);
    expect(find.text('Khách hàng'), findsNothing);
    expect(find.text('Tra cứu bảo hành'), findsNothing);
  });

  testWidgets('tapping anywhere on a row emits its key', (tester) async {
    final opened = <String>[];
    await tester.pumpWidget(_host(MenuScreen(sections: kMobileMenu, onOpen: opened.add, onLogout: () async {})));

    await tester.tap(find.text('Theo SĐT khách'));
    await tester.tap(find.text('Khách hàng'));
    await tester.pump();
    expect(opened, ['warranty', 'customers']);
  });

  testWidgets('every row is at least the minimum tap target tall', (tester) async {
    await tester.pumpWidget(_host(MenuScreen(sections: kMobileMenu, onOpen: (_) {}, onLogout: () async {})));
    final row = find.ancestor(of: find.text('Hồ sơ'), matching: find.byType(GestureDetector)).first;
    expect(tester.getSize(row).height, greaterThanOrEqualTo(48.0));
  });

  testWidgets('Đăng xuất tapped twice while the logout is pending ⇒ one call', (tester) async {
    final release = Completer<void>();
    var calls = 0;
    await tester.pumpWidget(
      _host(
        MenuScreen(
          sections: kMobileMenu,
          onOpen: (_) {},
          onLogout: () {
            calls++;
            return release.future;
          },
        ),
      ),
    );

    final logout = find.widgetWithText(AppButton, 'Đăng xuất');
    await tester.ensureVisible(logout);
    await tester.tap(logout);
    await tester.pump();
    await tester.tap(logout);
    await tester.pump();
    release.complete();
    await tester.pump();
    expect(calls, 1);
  });

  testWidgets('fits a 320pt-wide phone without overflow', (tester) async {
    addTearDown(tester.view.reset);
    tester.view.physicalSize = Size(320.0 * tester.view.devicePixelRatio, 640.0 * tester.view.devicePixelRatio);
    await tester.pumpWidget(_host(MenuScreen(sections: kMobileMenu, onOpen: (_) {}, onLogout: () async {})));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  test('the screen source stays flat: no shadow, no elevation', () {
    final src = File('lib/screens/menu/menu_screen.dart').readAsStringSync();
    expect(src.contains('BoxShadow'), isFalse);
    expect(src.contains('elevation'), isFalse);
    // Anti-blind: the file read is the screen itself.
    expect(src.contains('class MenuScreen'), isTrue);
  });
}
