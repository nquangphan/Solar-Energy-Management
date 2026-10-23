// hand-authored — Hồ sơ đổi mật khẩu (Story 11.2, moved out of ProfileScreen's State).
// Validates locally, then changes the password through the injected [PasswordPort]:
// the current password trimmed, the new one as typed. Any port failure shows one
// fixed sentence (the screen never showed the adapter's message). A wrong current
// password keeps the session — that is the transport's job; this cubit never signs out.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/password_port.dart';
import 'profile_state.dart';

// Mirror of the backend policy (`IsPasswordPolicy`): ≥8 chars, at least one letter
// and one digit. Presentational only — the backend rejects regardless (AD-4).
final RegExp _passwordRe = RegExp(r'^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$');

class ProfileCubit extends Cubit<ProfileState> {
  ProfileCubit(this._port) : super(const ProfileState());

  final PasswordPort _port;

  /// True once the port changed the password; the screen then clears the three fields.
  Future<bool> submit({required String current, required String password, required String confirm}) async {
    // Clear a prior success banner so a later validation error can't render the
    // green "changed" banner alongside the red one.
    if (state.done) emit(const ProfileState());
    final String trimmed = current.trim();
    if (trimmed.isEmpty) {
      emit(const ProfileState(error: 'Nhập mật khẩu hiện tại.'));
      return false;
    }
    if (!_passwordRe.hasMatch(password)) {
      emit(const ProfileState(error: 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.'));
      return false;
    }
    if (password != confirm) {
      emit(const ProfileState(error: 'Xác nhận mật khẩu không khớp.'));
      return false;
    }
    emit(const ProfileState());
    try {
      await _port.changePassword(currentPassword: trimmed, newPassword: password);
      if (isClosed) return false;
      emit(const ProfileState(done: true));
      return true;
    } catch (_) {
      if (isClosed) return false;
      emit(const ProfileState(error: 'Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại.'));
      return false;
    }
  }

  /// "Huỷ": drops the error, keeps a success banner as it was.
  void clearError() => emit(ProfileState(done: state.done));
}
