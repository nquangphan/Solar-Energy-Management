// hand-authored — Quên mật khẩu state (Story 11.1), held by ForgotPasswordCubit.

import 'package:equatable/equatable.dart';

enum ForgotStep { request, verify }

final class ForgotPasswordState extends Equatable {
  const ForgotPasswordState({this.step = ForgotStep.request, this.error, this.phoneError, this.remaining = 0});

  final ForgotStep step;

  /// Shown in the AppBanner above the step.
  final String? error;

  /// The first backend message about `phone`, shown under the phone field.
  final String? phoneError;

  /// Seconds left on the resend countdown.
  final int remaining;

  /// Keeps both messages (a countdown tick must not clear the banner).
  ForgotPasswordState copyWith({ForgotStep? step, int? remaining}) =>
      ForgotPasswordState(step: step ?? this.step, error: error, phoneError: phoneError, remaining: remaining ?? this.remaining);

  /// Replaces both messages: one left out is cleared.
  ForgotPasswordState withMessages({String? error, String? phoneError}) =>
      ForgotPasswordState(step: step, error: error, phoneError: phoneError, remaining: remaining);

  @override
  List<Object?> get props => [step, error, phoneError, remaining];
}
