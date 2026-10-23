// hand-authored — Đăng nhập form state (Story 11.1), held by LoginCubit.

import 'package:equatable/equatable.dart';

/// Every emit builds the whole state, so an error is cleared by leaving it out.
final class LoginState extends Equatable {
  const LoginState({this.busy = false, this.error, this.phoneError});

  /// Sending: the button is disabled, so a second tap never sends a second request.
  final bool busy;

  /// Shown in the AppBanner above the form.
  final String? error;

  /// The first backend message about `phone`, shown under the phone field.
  final String? phoneError;

  @override
  List<Object?> get props => [busy, error, phoneError];
}
