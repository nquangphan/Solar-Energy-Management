// hand-authored — the app session (Story 11.1, moved out of PnsApp's State).
// Restores the session at start-up, switches between Đăng nhập, Quên mật khẩu
// and the signed-in app, and signs out. It only sees the AuthPort: tokens and
// HTTP stay behind it.

import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../design_system/session/auth_port.dart';
import 'session_state.dart';

class SessionCubit extends Cubit<SessionState> {
  /// [sessionExpired] fires when the transport could not renew the session.
  SessionCubit(this._auth, {Listenable? sessionExpired})
      : _sessionExpired = sessionExpired,
        super(const SessionState()) {
    _sessionExpired?.addListener(_onExpired);
  }

  final AuthPort _auth;
  final Listenable? _sessionExpired;

  /// Not rendered, so not state: it only drops a second logout tap.
  bool _loggingOut = false;

  Future<void> restore() async {
    bool restored;
    try {
      restored = await _auth.restoreSession();
    } catch (_) {
      restored = false;
    }
    if (isClosed) return;
    if (restored) {
      signedIn();
    } else {
      emit(state.copyWith(phase: SessionPhase.signedOut));
    }
  }

  void signedIn() =>
      emit(state.copyWith(phase: SessionPhase.signedIn, signInCount: state.signInCount + 1));

  void showForgotPassword() => emit(state.copyWith(phase: SessionPhase.forgotPassword));

  void backToLogin() => emit(state.copyWith(phase: SessionPhase.signedOut));

  /// `/me` failed: a new count rebuilds the permissions provider, which fetches again.
  void retryPermissions() => emit(state.copyWith(signInCount: state.signInCount + 1));

  Future<void> logout() async {
    // Offline, the logout call waits out the connect timeout: a second tap must not send a second one.
    if (_loggingOut) return;
    _loggingOut = true;
    try {
      await _auth.logout();
    } finally {
      _loggingOut = false;
      if (!isClosed) emit(state.copyWith(phase: SessionPhase.signedOut));
    }
  }

  void _onExpired() {
    if (!isClosed && state.phase == SessionPhase.signedIn) {
      emit(state.copyWith(phase: SessionPhase.signedOut));
    }
  }

  @override
  Future<void> close() {
    _sessionExpired?.removeListener(_onExpired);
    return super.close();
  }
}
