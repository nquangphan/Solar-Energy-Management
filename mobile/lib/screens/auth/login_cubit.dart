// hand-authored — Đăng nhập (Story 11.1, moved out of LoginScreen's State).
// Validates emptiness locally, then signs in by phone (10.9) through the
// injected [AuthPort] with the RAW number, only trimmed — the backend alone
// normalizes it (AD-9). The password is sent as typed. A 400
// `fieldErrors.phone` goes under the phone field; any other ApiError message
// is shown verbatim.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../api/api_error.dart';
import '../../design_system/session/auth_port.dart';
import 'login_state.dart';

class LoginCubit extends Cubit<LoginState> {
  LoginCubit(this._port) : super(const LoginState());

  final AuthPort _port;

  /// True once the port accepted the credentials; the screen then emits "signed in".
  Future<bool> submit({required String phone, required String password}) async {
    if (state.busy) return false;
    // Local validation is emptiness only (the number's format is the backend's call,
    // AD-9). Same Vietnamese copy as web for label parity.
    if (phone.trim().isEmpty || password.trim().isEmpty) {
      emit(const LoginState(error: 'Nhập đủ số điện thoại và mật khẩu.'));
      return false;
    }
    emit(const LoginState(busy: true));
    try {
      await _port.login(phone: phone.trim(), password: password);
      if (isClosed) return false;
      emit(const LoginState());
      return true;
    } catch (e) {
      if (isClosed) return false;
      final String? fieldMessage = e is ApiError ? _phoneMessageOf(e) : null;
      if (fieldMessage != null) {
        emit(LoginState(phoneError: fieldMessage));
      } else {
        // A non-ApiError would carry an English runtime message — never show it.
        emit(LoginState(error: e is ApiError ? e.message : kGenericErrorMessage));
      }
      return false;
    }
  }

  /// The FIRST backend message about `phone`, or null (same rule as web).
  String? _phoneMessageOf(ApiError e) {
    for (final f in e.fieldErrors ?? const []) {
      if (f.field == 'phone') return f.message;
    }
    return null;
  }
}
