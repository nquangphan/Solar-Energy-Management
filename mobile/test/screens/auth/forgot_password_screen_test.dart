// Native Flutter widget test for the Quên mật khẩu screen (Story 2.8 — AC-3).
// Mirrors mobile/test/screens/auth/login_screen_test.dart: pump the real screen
// with an injected FakePasswordPort and assert it composes the shipped widgets,
// carries no bottom-nav (UX-DR-15), walks the two-step flow, and surfaces every
// validation failure through an AppBanner (the Field has no error slot).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_password_port.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';
import 'package:pns_mobile/screens/auth/forgot_password_screen.dart';

// Scaffold supplies the Material ancestor AppField's TextField needs; the real
// app entry (app-runtime story) provides its own Material surface.
Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

Widget _screen({Object? throwWith, VoidCallback? onBackToLogin}) =>
    _host(ForgotPasswordScreen(
      port: FakePasswordPort(throwWith: throwWith),
      onBackToLogin: onBackToLogin,
    ));

/// Tap the AppButton carrying [label]. Targeting the BUTTON (not the bare text)
/// matters: "Gửi mã" is also a stepper label, so `find.text` matches twice.
Future<void> _tapLabel(WidgetTester tester, String label) async {
  // The card scrolls; bring the action into view before tapping it.
  final finder = find.widgetWithText(AppButton, label);
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
  await tester.pump();
}

/// Unmount so `dispose()` cancels the countdown Timer — a pending periodic timer
/// fails the test teardown, which is exactly the leak we want to catch.
Future<void> _unmount(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
}

void main() {
  group('ForgotPasswordScreen (Story 2.8)', () {
    testWidgets('step 1 composes stepper + one field + primary button (AC-3)',
        (tester) async {
      await tester.pumpWidget(_screen());

      expect(find.byType(AppStepper), findsOneWidget);
      expect(find.byType(AppField), findsOneWidget);
      expect(find.text('Quên mật khẩu'), findsOneWidget);
      // AppField renders its label micro-uppercased (Dart `.toUpperCase()`),
      // unlike web's CSS text-transform which leaves the DOM text intact.
      expect(find.text('Email đã đăng ký'.toUpperCase()), findsOneWidget);
      expect(find.text('Gửi mã'), findsWidgets);
      expect(find.text('Quay lại đăng nhập'), findsOneWidget);
    });

    testWidgets('auth screen has no bottom-nav / mobile shell (UX-DR-15)',
        (tester) async {
      await tester.pumpWidget(_screen());

      expect(find.byType(AppPhoneFrame), findsOneWidget);
      // A back-topbar IS allowed here (it returns to login) — the NAV is not.
      expect(find.byType(AppTopbar), findsOneWidget);
      expect(find.byType(AppBottomNav), findsNothing);
      expect(find.byType(AppMobileShell), findsNothing);
    });

    testWidgets('empty email surfaces an AppBanner error (AC-3)', (tester) async {
      await tester.pumpWidget(_screen());
      expect(find.byType(AppBanner), findsNothing);

      await _tapLabel(tester, 'Gửi mã');

      expect(find.byType(AppBanner), findsOneWidget);
      expect(find.text('Nhập email đã đăng ký.'), findsOneWidget);
    });

    testWidgets('malformed email surfaces the format error', (tester) async {
      await tester.pumpWidget(_screen());

      await tester.enterText(find.byType(TextField).at(0), 'khong-phai-email');
      await _tapLabel(tester, 'Gửi mã');

      expect(find.text('Email không hợp lệ.'), findsOneWidget);
    });

    testWidgets('valid email advances to step 2 with the code-sent banner',
        (tester) async {
      await tester.pumpWidget(_screen());

      await tester.enterText(find.byType(TextField).at(0), 'nguyen@example.com');
      await _tapLabel(tester, 'Gửi mã');

      // Three fields now: mã, mật khẩu mới, xác nhận.
      expect(find.byType(AppField), findsNWidgets(3));
      expect(find.text('Đặt lại mật khẩu'), findsOneWidget);
      // The email is masked client-side; the code itself never came back.
      expect(
        find.text('Đã gửi mã 6 số đến ng•••@example.com. Mã có hiệu lực 5 phút.'),
        findsOneWidget,
      );
      expect(find.text('Gửi lại mã sau 05:00'), findsOneWidget);

      await _unmount(tester);
    });

    testWidgets('countdown ticks down and the Timer is cancelled on dispose',
        (tester) async {
      await tester.pumpWidget(_screen());
      await tester.enterText(find.byType(TextField).at(0), 'nguyen@example.com');
      await _tapLabel(tester, 'Gửi mã');

      expect(find.text('Gửi lại mã sau 05:00'), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Gửi lại mã sau 04:59'), findsOneWidget);

      // If dispose() forgot `_timer.cancel()`, teardown fails on a pending Timer.
      await _unmount(tester);
    });

    Future<void> toStep2(WidgetTester tester, {Object? throwWith}) async {
      await tester.pumpWidget(_screen(throwWith: throwWith));
      await tester.enterText(find.byType(TextField).at(0), 'nguyen@example.com');
      await _tapLabel(tester, 'Gửi mã');
    }

    testWidgets('code that is not 6 digits surfaces a banner', (tester) async {
      await toStep2(tester);

      await tester.enterText(find.byType(TextField).at(0), '12ab');
      await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
      await tester.enterText(find.byType(TextField).at(2), 'MatKhau123');
      await _tapLabel(tester, 'Đặt lại mật khẩu');

      expect(find.text('Mã xác thực gồm đúng 6 chữ số.'), findsOneWidget);
      await _unmount(tester);
    });

    testWidgets('weak new password surfaces the policy banner', (tester) async {
      await toStep2(tester);

      await tester.enterText(find.byType(TextField).at(0), '123456');
      await tester.enterText(find.byType(TextField).at(1), 'yeuqua');
      await tester.enterText(find.byType(TextField).at(2), 'yeuqua');
      await _tapLabel(tester, 'Đặt lại mật khẩu');

      expect(find.text('Mật khẩu tối thiểu 8 ký tự, có chữ và số.'), findsOneWidget);
      await _unmount(tester);
    });

    testWidgets('confirmation mismatch surfaces a banner', (tester) async {
      await toStep2(tester);

      await tester.enterText(find.byType(TextField).at(0), '123456');
      await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
      await tester.enterText(find.byType(TextField).at(2), 'MatKhau456');
      await _tapLabel(tester, 'Đặt lại mật khẩu');

      expect(find.text('Xác nhận mật khẩu không khớp.'), findsOneWidget);
      await _unmount(tester);
    });

    testWidgets('backend rejection surfaces ONE generic message (anti-enumeration)',
        (tester) async {
      // The API refuses to say WHICH branch failed (bad code / expired / too many
      // attempts). The screen must not invent a distinction either.
      await toStep2(tester, throwWith: Exception('401'));

      await tester.enterText(find.byType(TextField).at(0), '123456');
      await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
      await tester.enterText(find.byType(TextField).at(2), 'MatKhau123');
      await _tapLabel(tester, 'Đặt lại mật khẩu');

      expect(
        find.text('Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.'),
        findsOneWidget,
      );
      await _unmount(tester);
    });

    testWidgets('successful reset hands control back to login', (tester) async {
      var backToLogin = 0;
      await tester.pumpWidget(_host(ForgotPasswordScreen(
        port: const FakePasswordPort(),
        onBackToLogin: () => backToLogin++,
      )));

      await tester.enterText(find.byType(TextField).at(0), 'nguyen@example.com');
      await _tapLabel(tester, 'Gửi mã');
      await tester.enterText(find.byType(TextField).at(0), '123456');
      await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
      await tester.enterText(find.byType(TextField).at(2), 'MatKhau123');
      await _tapLabel(tester, 'Đặt lại mật khẩu');

      expect(backToLogin, 1);
      await _unmount(tester);
    });

    testWidgets('both new-password fields mask their input (AC-3)', (tester) async {
      await toStep2(tester);

      // Field order on step 2: mã (0), mật khẩu mới (1), xác nhận (2).
      expect(tester.widget<TextField>(find.byType(TextField).at(0)).obscureText, isFalse);
      expect(tester.widget<TextField>(find.byType(TextField).at(1)).obscureText, isTrue);
      expect(tester.widget<TextField>(find.byType(TextField).at(2)).obscureText, isTrue);

      await _unmount(tester);
    });
  });
}
