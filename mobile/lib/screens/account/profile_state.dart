// hand-authored — Hồ sơ đổi mật khẩu state (Story 11.2), held by ProfileCubit.

import 'package:equatable/equatable.dart';

/// Every emit builds the whole state, so an error is cleared by leaving it out.
final class ProfileState extends Equatable {
  const ProfileState({this.error, this.done = false});

  /// Shown in the danger AppBanner above the fields.
  final String? error;

  /// The password was changed: the info AppBanner says the user must sign in again.
  final bool done;

  @override
  List<Object?> get props => [error, done];
}
