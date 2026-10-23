// hand-authored — the mobile app shell (Story 10.6, signed-in app Story 10.7,
// ports as one AppPorts value Story 10.8, session in SessionCubit Story 11.1).
// Renders the session phase: Đăng nhập (with Quên mật khẩu) or the signed-in
// app. It only sees ports: tokens and HTTP stay behind them.
//
// Each sign-in gets a fresh PermissionsProvider (keyed by a counter), so a second
// account on the same phone never sees the first account's permissions.
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../design_system/session/app_session.dart';
import '../design_system/session/auth_port.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/login_screen.dart';
import 'app_chrome.dart';
import 'app_ports.dart';
import 'session_cubit.dart';
import 'session_state.dart';
import 'signed_in_app.dart';

class PnsApp extends StatelessWidget {
  const PnsApp({
    super.key,
    required this.auth,
    required this.ports,
    this.sessionExpired,
  });

  final AuthPort auth;
  final AppPorts ports;

  /// Fires when the transport could not renew the session (refresh refused).
  final Listenable? sessionExpired;

  @override
  Widget build(BuildContext context) {
    final Widget phases = BlocBuilder<SessionCubit, SessionState>(builder: _build);
    final Listenable? expired = sessionExpired;
    return BlocProvider(
      create: (_) => SessionCubit(auth, sessionExpired: expired)..restore(),
      // A cubit's new state reaches BlocBuilder a microtask later. The expiry signal
      // also rebuilds here, so the frame is scheduled in the same turn as the
      // signal (as setState did) and that frame already shows Đăng nhập.
      child: expired == null ? phases : ListenableBuilder(listenable: expired, builder: (_, _) => phases),
    );
  }

  Widget _build(BuildContext context, SessionState state) {
    final session = context.read<SessionCubit>();
    if (state.phase == SessionPhase.signedIn) {
      return PermissionsProvider(
        key: ValueKey<int>(state.signInCount),
        port: ports.me,
        child: SignedInApp(
          ports: ports,
          onLogout: session.logout,
          onRetry: session.retryPermissions,
        ),
      );
    }
    return MaterialApp(
      key: const ValueKey<String>('signed-out'),
      debugShowCheckedModeBanner: false,
      title: kAppTitle,
      home: appPage(_body(state.phase, session)),
    );
  }

  Widget _body(SessionPhase phase, SessionCubit session) {
    switch (phase) {
      case SessionPhase.restoring:
      case SessionPhase.signedIn:
        return const SessionSkeleton();
      case SessionPhase.signedOut:
        return LoginScreen(
          port: auth,
          onLoggedIn: session.signedIn,
          onForgotPassword: session.showForgotPassword,
        );
      case SessionPhase.forgotPassword:
        // The Android back button returns to Đăng nhập (this is not a route of its own,
        // so without this it would close the app).
        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) session.backToLogin();
          },
          child: ForgotPasswordScreen(
            port: ports.password,
            onBackToLogin: session.backToLogin,
          ),
        );
    }
  }
}
