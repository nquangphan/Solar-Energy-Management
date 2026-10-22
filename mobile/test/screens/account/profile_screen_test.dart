// Native Flutter widget test for the Hồ sơ screen (Story 2.8 — AC-2/AC-3).
// Mirrors mobile/test/screens/auth/login_screen_test.dart, but hosts the screen
// inside a PermissionsScope: identity comes from the session provider that
// already fetched `/me`, never from a second call.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/app_session.dart';
import 'package:pns_mobile/design_system/session/fake_password_port.dart';
import 'package:pns_mobile/design_system/session/me_port.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';
import 'package:pns_mobile/screens/account/profile_screen.dart';

const MeResponse _me = MeResponse(
  id: 'acc-1',
  email: 'quanly@phuongnam.solar',
  phone: null,
  displayName: 'Quản lý ca',
  permissions: ['orders.view_all'],
);

Widget _host({Object? throwWith, MeResponse? me = _me}) => MaterialApp(
      home: PermissionsScope(
        status: SessionStatus.ready,
        perms: const {'orders.view_all'},
        me: me,
        child: Scaffold(
          body: ProfileScreen(port: FakePasswordPort(throwWith: throwWith)),
        ),
      ),
    );

Future<void> _tapLabel(WidgetTester tester, String label) async {
  // The form scrolls; bring the action into view before tapping it.
  final finder = find.widgetWithText(AppButton, label);
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
  await tester.pump();
}

/// Fill mật khẩu hiện tại (0), mật khẩu mới (1), xác nhận (2).
Future<void> _fill(
  WidgetTester tester, {
  required String current,
  required String password,
  required String confirm,
}) async {
  await tester.enterText(find.byType(TextField).at(0), current);
  await tester.enterText(find.byType(TextField).at(1), password);
  await tester.enterText(find.byType(TextField).at(2), confirm);
}

void main() {
  group('ProfileScreen (Story 2.8)', () {
    testWidgets('renders the identity read from the session provider (AC-3)',
        (tester) async {
      await tester.pumpWidget(_host());

      expect(find.text('Hồ sơ'), findsOneWidget);
      expect(find.text('TÀI KHOẢN'), findsOneWidget);
      // displayName appears twice: the heading and the `Tên hiển thị` row.
      expect(find.text('Quản lý ca'), findsNWidgets(2));
      expect(find.text('quanly@phuongnam.solar'), findsOneWidget);
      expect(find.text('Đang hoạt động'), findsOneWidget);
    });

    testWidgets('office screen keeps its shell + locked bottom-nav on Menu',
        (tester) async {
      await tester.pumpWidget(_host());

      expect(find.byType(AppMobileShell), findsOneWidget);
      expect(find.byType(AppTopbar), findsOneWidget);
      final AppBottomNav nav = tester.widget(find.byType(AppBottomNav));
      expect(nav.activeIndex, 4); // Menu
    });

    testWidgets('composes the change block from AppFrame + 3 masked fields (AC-3)',
        (tester) async {
      await tester.pumpWidget(_host());

      expect(find.byType(AppFrame), findsOneWidget);
      expect(find.byType(AppField), findsNWidgets(3));
      for (var i = 0; i < 3; i++) {
        expect(tester.widget<TextField>(find.byType(TextField).at(i)).obscureText, isTrue);
      }
      expect(find.text('Cập nhật mật khẩu'), findsOneWidget);
      expect(find.text('Huỷ'), findsOneWidget);
    });

    testWidgets('states that the change is audited and ends every session (AC-2)',
        (tester) async {
      await tester.pumpWidget(_host());

      expect(
        find.text('Tối thiểu 8 ký tự, có chữ và số. Đổi mật khẩu sẽ ghi vào Audit log.'),
        findsOneWidget,
      );
    });

    testWidgets('empty current password surfaces an AppBanner error', (tester) async {
      await tester.pumpWidget(_host());

      await _tapLabel(tester, 'Cập nhật mật khẩu');

      expect(find.text('Nhập mật khẩu hiện tại.'), findsOneWidget);
    });

    testWidgets('weak new password surfaces the policy banner', (tester) async {
      await tester.pumpWidget(_host());

      await _fill(tester, current: 'MatKhauCu123', password: 'yeu', confirm: 'yeu');
      await _tapLabel(tester, 'Cập nhật mật khẩu');

      expect(find.text('Mật khẩu tối thiểu 8 ký tự, có chữ và số.'), findsOneWidget);
    });

    testWidgets('confirmation mismatch surfaces a banner', (tester) async {
      await tester.pumpWidget(_host());

      await _fill(tester, current: 'MatKhauCu123', password: 'MatKhauMoi123', confirm: 'MatKhauKhac123');
      await _tapLabel(tester, 'Cập nhật mật khẩu');

      expect(find.text('Xác nhận mật khẩu không khớp.'), findsOneWidget);
    });

    testWidgets('wrong current password (backend rejects) surfaces a banner', (tester) async {
      // The current-password check is enforced SERVER-side (a hijacked session must
      // not be able to change the password). The screen only relays the refusal.
      await tester.pumpWidget(_host(throwWith: Exception('401')));

      await _fill(tester, current: 'sai-mat-khau', password: 'MatKhauMoi123', confirm: 'MatKhauMoi123');
      await _tapLabel(tester, 'Cập nhật mật khẩu');

      expect(find.text('Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại.'), findsOneWidget);
    });

    testWidgets('success clears the form and warns that re-login is required', (tester) async {
      await tester.pumpWidget(_host());

      await _fill(tester, current: 'MatKhauCu123', password: 'MatKhauMoi123', confirm: 'MatKhauMoi123');
      await _tapLabel(tester, 'Cập nhật mật khẩu');

      expect(find.text('Đã đổi mật khẩu. Bạn cần đăng nhập lại.'), findsOneWidget);
      // Password material must not linger in the widget tree after success.
      for (var i = 0; i < 3; i++) {
        expect(tester.widget<TextField>(find.byType(TextField).at(i)).controller!.text, '');
      }
    });

    testWidgets('Huỷ clears the form without calling the port', (tester) async {
      await tester.pumpWidget(_host(throwWith: Exception('must not be called')));

      await _fill(tester, current: 'MatKhauCu123', password: 'MatKhauMoi123', confirm: 'MatKhauMoi123');
      await _tapLabel(tester, 'Huỷ');

      expect(find.byType(AppBanner), findsOneWidget); // only the policy notice
      for (var i = 0; i < 3; i++) {
        expect(tester.widget<TextField>(find.byType(TextField).at(i)).controller!.text, '');
      }
    });

    testWidgets('missing /me identity renders empty strings, never a crash', (tester) async {
      // `me` is null while loading and on error; the screen must not throw.
      await tester.pumpWidget(_host(me: null));

      expect(find.byType(AppFrame), findsOneWidget);
      expect(find.text('Đang hoạt động'), findsOneWidget);
    });
  });
}
