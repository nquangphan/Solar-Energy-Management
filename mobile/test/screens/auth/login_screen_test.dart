// Native Flutter widget test for the Đăng nhập screen (Story 1.11 — AC-1/2).
// Mirrors mobile/test/design_system/shell_render_test.dart: pump the real
// screen and assert it composes the shipped widgets, has no auth nav
// (UX-DR-15), and that empty-submit validation surfaces an AppBanner (AC-2).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/icons/app_icons.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';
import 'package:pns_mobile/screens/auth/login_screen.dart';

// Scaffold supplies the Material ancestor AppField's TextField needs; the real
// app entry (Epic 2) provides it via its own Material surface.
Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('LoginScreen (Story 1.11)', () {
    testWidgets('composes 2 AppField + primary AppButton + brand (AC-1)',
        (tester) async {
      await tester.pumpWidget(_host(const LoginScreen()));

      expect(find.byType(AppField), findsNWidgets(2));
      expect(find.byType(AppButton), findsOneWidget);
      expect(find.text('Đăng nhập'), findsOneWidget);
      expect(find.text('Phương Nam Solar'), findsOneWidget);
      expect(find.text('Quên mật khẩu?'), findsOneWidget);
      // Brand mark uses the canonical ic-sun icon.
      expect(
        find.byWidgetPredicate((w) => w is AppIcon && w.name == 'ic-sun'),
        findsOneWidget,
      );
    });

    testWidgets('auth screen has no topbar/bottom-nav (UX-DR-15)',
        (tester) async {
      await tester.pumpWidget(_host(const LoginScreen()));

      expect(find.byType(AppPhoneFrame), findsOneWidget);
      expect(find.byType(AppTopbar), findsNothing);
      expect(find.byType(AppBottomNav), findsNothing);
      expect(find.byType(AppMobileShell), findsNothing);
    });

    testWidgets('empty submit surfaces an AppBanner error (AC-2)',
        (tester) async {
      await tester.pumpWidget(_host(const LoginScreen()));

      // No error banner before submit.
      expect(find.byType(AppBanner), findsNothing);

      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(find.byType(AppBanner), findsOneWidget);
      expect(find.text('Nhập đủ tài khoản và mật khẩu.'), findsOneWidget);
    });

    testWidgets('malformed account surfaces the format error (AC-2)',
        (tester) async {
      await tester.pumpWidget(_host(const LoginScreen()));

      // Account is neither a phone (≥8 digits) nor a valid email.
      await tester.enterText(find.byType(TextField).at(0), 'not-an-account');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(find.byType(AppBanner), findsOneWidget);
      expect(
        find.text('Tài khoản phải là số điện thoại hoặc email hợp lệ.'),
        findsOneWidget,
      );
    });

    testWidgets('valid credentials clear the error region (AC-2 happy path)',
        (tester) async {
      await tester.pumpWidget(_host(const LoginScreen()));

      // First force an error so we can prove a valid submit clears it.
      await tester.tap(find.byType(AppButton));
      await tester.pump();
      expect(find.byType(AppBanner), findsOneWidget);

      await tester.enterText(find.byType(TextField).at(0), '0912345678');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.byType(AppButton));
      await tester.pump();

      // Valid phone + password ⇒ no banner (real auth wires in Epic 2).
      expect(find.byType(AppBanner), findsNothing);
    });

    testWidgets('valid email is accepted too (AC-2 happy path)',
        (tester) async {
      await tester.pumpWidget(_host(const LoginScreen()));

      await tester.enterText(find.byType(TextField).at(0), 'a@b.co');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.tap(find.byType(AppButton));
      await tester.pump();

      expect(find.byType(AppBanner), findsNothing);
    });

    testWidgets('password field masks its input (AC-1)', (tester) async {
      await tester.pumpWidget(_host(const LoginScreen()));

      // Field order: account (0), password (1).
      final TextField password =
          tester.widget<TextField>(find.byType(TextField).at(1));
      expect(password.obscureText, isTrue);
    });
  });
}
