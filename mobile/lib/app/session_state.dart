// hand-authored — the app session phase (Story 11.1), held by SessionCubit.

import 'package:equatable/equatable.dart';

enum SessionPhase { restoring, signedOut, forgotPassword, signedIn }

/// One class, not a sealed family: [signInCount] lives on through every phase.
final class SessionState extends Equatable {
  const SessionState({this.phase = SessionPhase.restoring, this.signInCount = 0});

  final SessionPhase phase;

  /// Bumped on every entry into the signed-in app (and on a retry of `/me`): the
  /// permissions provider is rebuilt and fetches `/me` for THIS session.
  final int signInCount;

  SessionState copyWith({SessionPhase? phase, int? signInCount}) =>
      SessionState(phase: phase ?? this.phase, signInCount: signInCount ?? this.signInCount);

  @override
  List<Object?> get props => [phase, signInCount];
}
