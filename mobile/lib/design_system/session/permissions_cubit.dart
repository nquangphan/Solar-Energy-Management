// hand-authored — the `/me` state behind PermissionsProvider (Story 11.1).
// Fetches `/me` once and maps it to the gating permission set; the tree still
// reads it through PermissionsScope (app_session.dart).
//
// GATING IS UX ONLY (AD-4): the backend enforces every request (Story 2.5).

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../gating/app_permissions.dart';
import 'app_session.dart';
import 'me_port.dart';

/// The three fields PermissionsScope exposes.
final class PermissionsState extends Equatable {
  const PermissionsState({this.status = SessionStatus.loading, this.perms = const {}, this.me});

  final SessionStatus status;
  final Set<PermissionKey> perms;

  /// The raw `/me` identity (null until ready, or on error).
  final MeResponse? me;

  @override
  List<Object?> get props => [status, perms, me];
}

class PermissionsCubit extends Cubit<PermissionsState> {
  PermissionsCubit(this._port) : super(const PermissionsState());

  final MePort _port;

  Future<void> load() async {
    try {
      final me = await _port.fetchMe();
      // A retry or a sign-out replaces this cubit while `/me` is in flight.
      if (isClosed) return;
      emit(PermissionsState(status: SessionStatus.ready, perms: toPermissionSet(me), me: me));
    } catch (_) {
      if (isClosed) return;
      emit(const PermissionsState(status: SessionStatus.error));
    }
  }
}
