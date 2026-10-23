// Screens and providers torn down while their port call is still in flight
// (Story 11.1). Under BLoC the cubit closes with the widget, so the late answer
// must neither throw (emit after close) nor fire the screen's "done" callback.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/api_error.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/session.dart';
import 'package:pns_mobile/screens/auth/forgot_password_screen.dart';
import 'package:pns_mobile/screens/auth/login_screen.dart';

class _PendingAuthPort implements AuthPort {
  final Completer<void> reply = Completer<void>();

  @override
  Future<void> login({required String phone, required String password}) => reply.future;

  @override
  Future<bool> restoreSession() async => false;

  @override
  Future<void> logout() async {}
}

/// The code request answers at once (with [codeReply] when set); the reset waits for [resetReply].
class _PendingPasswordPort implements PasswordPort {
  Completer<int>? codeReply;
  final Completer<void> resetReply = Completer<void>();
  int codeRequests = 0;
  int resets = 0;

  @override
  Future<int> requestResetCode(String phone) async {
    codeRequests++;
    return codeReply?.future ?? 300;
  }

  @override
  Future<void> resetPassword({required String phone, required String code, required String newPassword}) {
    resets++;
    return resetReply.future;
  }

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {}
}

class _PendingMePort implements MePort {
  final Completer<MeResponse> reply = Completer<MeResponse>();

  @override
  Future<MeResponse> fetchMe() => reply.future;
}

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

Future<void> _tapLabel(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label);
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
}

void main() {
  for (final (outcome, Object? error) in [('accepted', null), ('refused', ApiError('Sai mật khẩu.', status: 401))]) {
    testWidgets('Đăng nhập left while signing in, then $outcome ⇒ no crash, no "signed in"', (tester) async {
      final port = _PendingAuthPort();
      var loggedIn = 0;
      await tester.pumpWidget(_host(LoginScreen(port: port, onLoggedIn: () => loggedIn++)));
      await tester.enterText(find.byType(TextField).at(0), '0901 234 567');
      await tester.enterText(find.byType(TextField).at(1), 'pw');
      await _tapLabel(tester, 'Đăng nhập');

      await tester.pumpWidget(const SizedBox());
      error == null ? port.reply.complete() : port.reply.completeError(error);
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(loggedIn, 0);
    });
  }

  testWidgets('Quên mật khẩu left while the code is being sent ⇒ no crash, no countdown left running',
      (tester) async {
    final port = _PendingPasswordPort()..codeReply = Completer<int>();
    await tester.pumpWidget(_host(ForgotPasswordScreen(port: port)));
    await tester.enterText(find.byType(TextField).at(0), '0901 234 567');
    await _tapLabel(tester, 'Gửi mã');
    expect(port.codeRequests, 1);

    await tester.pumpWidget(const SizedBox());
    port.codeReply!.complete(300);
    await tester.pump(const Duration(seconds: 2));

    // A countdown started after close would also leave a pending timer, which fails teardown.
    expect(tester.takeException(), isNull);
  });

  testWidgets('Quên mật khẩu left while the reset is pending ⇒ no crash, no return to login', (tester) async {
    final port = _PendingPasswordPort();
    var backToLogin = 0;
    await tester.pumpWidget(_host(ForgotPasswordScreen(port: port, onBackToLogin: () => backToLogin++)));
    await tester.enterText(find.byType(TextField).at(0), '0901 234 567');
    await _tapLabel(tester, 'Gửi mã');
    await tester.pump();
    await tester.enterText(find.byType(TextField).at(0), '123456');
    await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
    await tester.enterText(find.byType(TextField).at(2), 'MatKhau123');
    await _tapLabel(tester, 'Đặt lại mật khẩu');
    expect(port.resets, 1);

    await tester.pumpWidget(const SizedBox());
    port.resetReply.complete();
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(backToLogin, 0);
  });

  for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
    testWidgets('PermissionsProvider removed (sign-out / retry) before /me $outcome ⇒ no crash', (tester) async {
      final port = _PendingMePort();
      await tester.pumpWidget(MaterialApp(home: PermissionsProvider(port: port, child: const SizedBox())));

      await tester.pumpWidget(const SizedBox());
      error == null ? port.reply.complete(kDemoMe) : port.reply.completeError(error);
      await tester.pump();

      expect(tester.takeException(), isNull);
    });
  }
}
