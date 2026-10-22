// Native Flutter widget test for the Quên mật khẩu screen (Story 2.8 — AC-3).
// Mirrors mobile/test/screens/auth/login_screen_test.dart: pump the real screen
// with an injected FakePasswordPort and assert it composes the shipped widgets,
// carries no bottom-nav (UX-DR-15), walks the two-step flow, and surfaces every
// validation failure through an AppBanner (the Field has no error slot). Since
// 10.9 the identifier is a RAW phone and step 2 never echoes it.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/api/generated/models/field_error_dto.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/password_port.dart';
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
      expect(find.text('Số điện thoại đã đăng ký'.toUpperCase()), findsOneWidget);
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

    testWidgets('empty phone surfaces an AppBanner error (AC-3)', (tester) async {
      await tester.pumpWidget(_screen());
      expect(find.byType(AppBanner), findsNothing);

      await _tapLabel(tester, 'Gửi mã');

      expect(find.byType(AppBanner), findsOneWidget);
      expect(find.text('Nhập số điện thoại đã đăng ký.'), findsOneWidget);
    });

    testWidgets('the phone field opens the phone keyboard', (tester) async {
      await tester.pumpWidget(_screen());
      final TextField phone = tester.widget<TextField>(find.byType(TextField).at(0));
      expect(phone.keyboardType, TextInputType.phone);
    });

    testWidgets('400 fieldErrors.phone ⇒ the message sits right under the phone field', (tester) async {
      const message = 'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).';
      await tester.pumpWidget(_host(ForgotPasswordScreen(
        port: _RecordingPasswordPort(
          requestError: ApiError('Số điện thoại không hợp lệ.', status: 400, fieldErrors: const [
            FieldErrorDto(field: 'phone', code: 'isPhoneNumber', message: message),
          ]),
        ),
      )));

      await tester.enterText(find.byType(TextField).at(0), 'abc');
      await _tapLabel(tester, 'Gửi mã');

      expect(find.text(message), findsOneWidget);
      expect(find.text('Không gửi được mã. Thử lại sau.'), findsNothing);
      final double phoneY = tester.getTopLeft(find.byType(TextField).at(0)).dy;
      final double errorY = tester.getTopLeft(find.text(message)).dy;
      final double buttonY = tester.getTopLeft(find.widgetWithText(AppButton, 'Gửi mã')).dy;
      expect(phoneY < errorY && errorY < buttonY, isTrue);
    });

    testWidgets('sends the raw phone; step 2 neither echoes it nor claims a code was sent',
        (tester) async {
      final port = _RecordingPasswordPort();
      await tester.pumpWidget(_host(ForgotPasswordScreen(port: port)));

      await tester.enterText(find.byType(TextField).at(0), ' 0912 345 678 ');
      await _tapLabel(tester, 'Gửi mã');

      expect(port.requested, ['0912 345 678']);
      // Three fields now: mã, mật khẩu mới, xác nhận.
      expect(find.byType(AppField), findsNWidgets(3));
      expect(find.text('Đặt lại mật khẩu'), findsOneWidget);
      expect(
        find.text('Nếu số điện thoại đã đăng ký, mã 6 số sẽ được gửi tới số đó. Mã có hiệu lực 5 phút.'),
        findsOneWidget,
      );
      expect(find.textContaining('678'), findsNothing);
      expect(find.text('Gửi lại mã sau 05:00'), findsOneWidget);

      await _unmount(tester);
    });

    testWidgets('countdown ticks down and the Timer is cancelled on dispose',
        (tester) async {
      await tester.pumpWidget(_screen());
      await tester.enterText(find.byType(TextField).at(0), '0912 345 678');
      await _tapLabel(tester, 'Gửi mã');

      expect(find.text('Gửi lại mã sau 05:00'), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Gửi lại mã sau 04:59'), findsOneWidget);

      // If dispose() forgot `_timer.cancel()`, teardown fails on a pending Timer.
      await _unmount(tester);
    });

    Future<void> toStep2(WidgetTester tester, {Object? throwWith}) async {
      await tester.pumpWidget(_screen(throwWith: throwWith));
      await tester.enterText(find.byType(TextField).at(0), '0912 345 678');
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

      await tester.enterText(find.byType(TextField).at(0), '0912 345 678');
      await _tapLabel(tester, 'Gửi mã');
      await tester.enterText(find.byType(TextField).at(0), '123456');
      await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
      await tester.enterText(find.byType(TextField).at(2), 'MatKhau123');
      await _tapLabel(tester, 'Đặt lại mật khẩu');

      expect(backToLogin, 1);
      await _unmount(tester);
    });

    testWidgets('step 2 resets with the same raw phone typed in step 1', (tester) async {
      final port = _RecordingPasswordPort();
      await tester.pumpWidget(_host(ForgotPasswordScreen(port: port)));

      await tester.enterText(find.byType(TextField).at(0), ' 0912 345 678 ');
      await _tapLabel(tester, 'Gửi mã');
      await tester.enterText(find.byType(TextField).at(0), '123456');
      await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
      await tester.enterText(find.byType(TextField).at(2), 'MatKhau123');
      await _tapLabel(tester, 'Đặt lại mật khẩu');

      expect(port.resets, [
        (phone: '0912 345 678', code: '123456', newPassword: 'MatKhau123'),
      ]);
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

/// Records the phone each request/reset carries; [requestError] models a 400.
class _RecordingPasswordPort implements PasswordPort {
  _RecordingPasswordPort({this.requestError});

  final Object? requestError;
  final List<String> requested = <String>[];
  final List<({String phone, String code, String newPassword})> resets = [];

  @override
  Future<int> requestResetCode(String phone) async {
    requested.add(phone);
    if (requestError != null) throw requestError!;
    return 300;
  }

  @override
  Future<void> resetPassword({required String phone, required String code, required String newPassword}) async {
    resets.add((phone: phone, code: code, newPassword: newPassword));
  }

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {}
}
