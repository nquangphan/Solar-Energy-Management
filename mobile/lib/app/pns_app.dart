// hand-authored — the mobile app shell (Story 10.6, signed-in app Story 10.7).
// Restores the session at start-up, then switches between Đăng nhập (with Quên
// mật khẩu) and the signed-in app. It only sees ports: tokens and HTTP stay
// behind them.
//
// Each sign-in gets a fresh PermissionsProvider (keyed by a counter), so a second
// account on the same phone never sees the first account's permissions.
import 'package:flutter/material.dart';

import '../design_system/session/app_session.dart';
import '../design_system/session/auth_port.dart';
import '../design_system/session/customers_port.dart';
import '../design_system/session/me_port.dart';
import '../design_system/session/password_port.dart';
import '../design_system/session/warranty_port.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/login_screen.dart';
import 'app_chrome.dart';
import 'signed_in_app.dart';

enum _Phase { restoring, signedOut, forgotPassword, signedIn }

class PnsApp extends StatefulWidget {
  const PnsApp({
    super.key,
    required this.auth,
    required this.me,
    required this.password,
    required this.customers,
    required this.warranty,
    this.sessionExpired,
  });

  final AuthPort auth;
  final MePort me;
  final PasswordPort password;
  final CustomersPort customers;
  final WarrantyPort warranty;

  /// Fires when the transport could not renew the session (refresh refused).
  final Listenable? sessionExpired;

  @override
  State<PnsApp> createState() => _PnsAppState();
}

class _PnsAppState extends State<PnsApp> {
  _Phase _phase = _Phase.restoring;
  bool _loggingOut = false;

  /// Bumped on every entry into the signed-in app (and on a retry of `/me`): the
  /// permissions provider is rebuilt and fetches `/me` for THIS session.
  int _signInCount = 0;

  @override
  void initState() {
    super.initState();
    widget.sessionExpired?.addListener(_onSessionExpired);
    _restore();
  }

  @override
  void dispose() {
    widget.sessionExpired?.removeListener(_onSessionExpired);
    super.dispose();
  }

  Future<void> _restore() async {
    bool restored;
    try {
      restored = await widget.auth.restoreSession();
    } catch (_) {
      restored = false;
    }
    if (!mounted) return;
    if (restored) {
      _signIn();
    } else {
      setState(() => _phase = _Phase.signedOut);
    }
  }

  void _signIn() => setState(() {
        _signInCount++;
        _phase = _Phase.signedIn;
      });

  void _onSessionExpired() {
    if (mounted && _phase == _Phase.signedIn) setState(() => _phase = _Phase.signedOut);
  }

  Future<void> _logout() async {
    // Offline, the logout call waits out the connect timeout: a second tap must not send a second one.
    if (_loggingOut) return;
    _loggingOut = true;
    try {
      await widget.auth.logout();
    } finally {
      _loggingOut = false;
      if (mounted) setState(() => _phase = _Phase.signedOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_phase == _Phase.signedIn) {
      return PermissionsProvider(
        key: ValueKey<int>(_signInCount),
        port: widget.me,
        child: SignedInApp(
          password: widget.password,
          customers: widget.customers,
          warranty: widget.warranty,
          onLogout: _logout,
          onRetry: () => setState(() => _signInCount++),
        ),
      );
    }
    return MaterialApp(
      key: const ValueKey<String>('signed-out'),
      debugShowCheckedModeBanner: false,
      title: kAppTitle,
      home: appPage(_body()),
    );
  }

  Widget _body() {
    switch (_phase) {
      case _Phase.restoring:
      case _Phase.signedIn:
        return const SessionSkeleton();
      case _Phase.signedOut:
        return LoginScreen(
          port: widget.auth,
          onLoggedIn: _signIn,
          onForgotPassword: () => setState(() => _phase = _Phase.forgotPassword),
        );
      case _Phase.forgotPassword:
        // The Android back button returns to Đăng nhập (this is not a route of its own,
        // so without this it would close the app).
        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) setState(() => _phase = _Phase.signedOut);
          },
          child: ForgotPasswordScreen(
            port: widget.password,
            onBackToLogin: () => setState(() => _phase = _Phase.signedOut),
          ),
        );
    }
  }
}
