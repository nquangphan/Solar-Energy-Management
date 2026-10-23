// hand-authored — Quên mật khẩu (Story 11.1, moved out of ForgotPasswordScreen's
// State): the two-step flow, its validation and the resend countdown.
//
// VALIDATION HERE IS UX ONLY (AD-4). The backend owns every real rule: attempt
// ceiling, single-use, expiry, phone normalization (AD-9 — the RAW number is
// sent), and the neutral response that hides whether a number is registered.
// Never branch on "does this account exist" — step 2 never echoes it.

import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../api/api_error.dart';
import '../../design_system/session/password_port.dart';
import 'forgot_password_state.dart';

final RegExp _codeRe = RegExp(r'^[0-9]{6}$');
// Mirror of the backend policy (`IsPasswordPolicy`): ≥8 chars, at least one
// letter and one digit. Presentational only — the backend rejects regardless.
final RegExp _passwordRe = RegExp(r'^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$');

class ForgotPasswordCubit extends Cubit<ForgotPasswordState> {
  ForgotPasswordCubit(this._port) : super(const ForgotPasswordState());

  final PasswordPort _port;
  Timer? _timer;

  Future<void> requestCode(String phone) async {
    if (phone.trim().isEmpty) {
      emit(state.withMessages(error: 'Nhập số điện thoại đã đăng ký.'));
      return;
    }
    emit(state.withMessages());
    try {
      final int expiresInSeconds = await _port.requestResetCode(phone.trim());
      if (isClosed) return;
      emit(state.copyWith(step: ForgotStep.verify, remaining: expiresInSeconds));
      _startCountdown();
    } catch (e) {
      if (isClosed) return;
      // A number the backend could not parse belongs under its field; anything
      // else gets the one generic message.
      final String? fieldMessage = e is ApiError ? _phoneMessageOf(e) : null;
      if (fieldMessage != null) {
        emit(state.withMessages(phoneError: fieldMessage));
      } else {
        emit(state.withMessages(error: 'Không gửi được mã. Thử lại sau.'));
      }
    }
  }

  /// True once the backend accepted the new password; the screen then returns to login.
  Future<bool> reset({
    required String phone,
    required String code,
    required String password,
    required String confirm,
  }) async {
    if (!_codeRe.hasMatch(code.trim())) {
      emit(state.withMessages(error: 'Mã xác thực gồm đúng 6 chữ số.'));
      return false;
    }
    if (!_passwordRe.hasMatch(password)) {
      emit(state.withMessages(error: 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.'));
      return false;
    }
    if (password != confirm) {
      emit(state.withMessages(error: 'Xác nhận mật khẩu không khớp.'));
      return false;
    }
    emit(state.withMessages());
    try {
      await _port.resetPassword(phone: phone.trim(), code: code.trim(), newPassword: password);
      return !isClosed;
    } catch (_) {
      if (isClosed) return false;
      // ONE message for every backend failure — the API deliberately does not say
      // which branch failed, and neither do we.
      emit(state.withMessages(error: 'Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.'));
      return false;
    }
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      // Stop at zero — a perpetual periodic timer keeps firing forever and leaves
      // a pending timer that outlives the screen.
      if (isClosed || state.remaining <= 0) {
        timer.cancel();
        return;
      }
      emit(state.copyWith(remaining: state.remaining - 1));
    });
  }

  /// The FIRST backend message about `phone`, or null (same rule as web).
  String? _phoneMessageOf(ApiError e) {
    for (final f in e.fieldErrors ?? const []) {
      if (f.field == 'phone') return f.message;
    }
    return null;
  }

  @override
  Future<void> close() {
    // Not optional: a surviving Timer keeps emitting after the screen is gone
    // (and `flutter test` fails on the pending timer).
    _timer?.cancel();
    return super.close();
  }
}
