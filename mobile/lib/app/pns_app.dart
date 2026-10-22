// hand-authored — the mobile app shell (Story 10.6). Restores the session at
// start-up, then switches between Đăng nhập and a minimal signed-in surface.
// It only sees the [AuthPort]: tokens and HTTP stay behind the port.
//
// Story 10.7 replaces the signed-in surface with go_router + PermissionsProvider.
import 'package:flutter/material.dart';

import '../design_system/components/components.dart';
import '../design_system/session/auth_port.dart';
import '../design_system/shell/app_phone_frame.dart';
import '../design_system/tokens/app_tokens.dart';
import '../screens/auth/login_screen.dart';

enum _Phase { restoring, signedOut, signedIn }

class PnsApp extends StatefulWidget {
  const PnsApp({super.key, required this.auth, this.sessionExpired});

  final AuthPort auth;

  /// Fires when the transport could not renew the session (refresh refused).
  final Listenable? sessionExpired;

  @override
  State<PnsApp> createState() => _PnsAppState();
}

class _PnsAppState extends State<PnsApp> {
  _Phase _phase = _Phase.restoring;
  bool _loggingOut = false;

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
    if (mounted) setState(() => _phase = restored ? _Phase.signedIn : _Phase.signedOut);
  }

  void _onSessionExpired() {
    if (mounted && _phase != _Phase.signedOut) setState(() => _phase = _Phase.signedOut);
  }

  Future<void> _logout() async {
    // Offline, the logout call waits out the connect timeout: a second tap must not send a second one.
    setState(() => _loggingOut = true);
    try {
      await widget.auth.logout();
    } finally {
      if (mounted) {
        setState(() {
          _loggingOut = false;
          _phase = _Phase.signedOut;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Phương Nam Solar',
      home: AppPhoneFrameScope(
        bare: true,
        // Scaffold: the Material ancestor TextField (AppField) needs, and it lifts the
        // body above the on-screen keyboard so the form's lower fields stay reachable.
        child: Scaffold(backgroundColor: AppTokens.surface, body: _body()),
      ),
    );
  }

  Widget _body() {
    switch (_phase) {
      case _Phase.restoring:
        return const AppPhoneFrame(
          child: Padding(
            padding: EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppSkeleton(height: 56.0),
                SizedBox(height: AppTokens.space12),
                AppSkeleton(),
                SizedBox(height: AppTokens.space12),
                AppSkeleton(),
              ],
            ),
          ),
        );
      case _Phase.signedOut:
        return LoginScreen(
          port: widget.auth,
          onLoggedIn: () => setState(() => _phase = _Phase.signedIn),
        );
      case _Phase.signedIn:
        return AppPhoneFrame(
          child: Padding(
            padding: const EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const AppBanner(tone: AppBannerTone.info, message: 'Đã đăng nhập.'),
                const SizedBox(height: AppTokens.space16),
                AppButton(label: 'Đăng xuất', wide: true, onPressed: _loggingOut ? null : _logout),
              ],
            ),
          ),
        );
    }
  }
}
