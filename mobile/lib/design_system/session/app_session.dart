// hand-authored — mobile session mapping + provider/scope (Story 2.6, mirror web
// web/src/design-system/session/session.ts + PermissionsProvider.tsx).
//
// Maps the `/me` payload to the gating permission set and exposes it to the
// widget tree via an InheritedWidget, so the gating primitives
// (`filterNav`/`AppGate`/`orderScope`) read the REAL set — replacing the Epic 1
// `demoPermissions` stub as the session source. The state is held by
// PermissionsCubit (Story 11.1); PermissionsScope stays the API that reads it.
//
// GATING IS UX ONLY (AD-4): this set decides what the UI shows; the backend
// enforces every request (Story 2.5). This layer holds NO business logic and
// touches NO DB (AD-1/2) — it only calls the port and maps the payload.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../gating/app_permissions.dart';
// Prefixed alias so the `orderScope` getter can call the primitive `orderScope`
// function without the instance member shadowing it.
import '../gating/app_permissions.dart' as gating;
import 'me_port.dart';
import 'permissions_cubit.dart';

/// Provider status: awaiting `/me`, ready with perms, or the fetch failed.
enum SessionStatus { loading, ready, error }

/// Map the `/me` permission list to the gating permission set (AD-12: "the FE
/// builds the PermissionSet from this array"). Pure.
///
/// This set is for UX GATING ONLY (AD-4): the backend enforces every request
/// (Story 2.5). Never treat a hidden nav item / shrunk AppGate as access control.
Set<PermissionKey> toPermissionSet(MeResponse me) => me.permissions.toSet();

/// InheritedWidget exposing the effective session `{ status, perms, me }` to the
/// tree. Read it with `PermissionsScope.of(context)`.
class PermissionsScope extends InheritedWidget {
  const PermissionsScope({
    super.key,
    required this.status,
    required this.perms,
    this.me,
    required super.child,
  });

  final SessionStatus status;
  final Set<PermissionKey> perms;

  /// The raw `/me` identity (null until ready, or on error). The Hồ sơ screen
  /// reads `displayName`/`email` from here rather than fetching `/me` a second
  /// time — the provider already has the payload.
  final MeResponse? me;

  /// Order-list scope selector (AC-3, FR-18): `'all'` vs `'mine'`, ready for
  /// Epic 5. Same pure `orderScope(perms)` from the gating primitive — only its
  /// SOURCE changed from stub to `/me`.
  String get orderScope => gating.orderScope(perms);

  static PermissionsScope of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<PermissionsScope>();
    assert(scope != null, 'No PermissionsScope found — wrap the tree in a PermissionsProvider');
    return scope!;
  }

  @override
  bool updateShouldNotify(PermissionsScope oldWidget) =>
      status != oldWidget.status ||
      perms != oldWidget.perms ||
      me != oldWidget.me;
}

/// Fetches `/me` once via [port], maps it to a permission set, and provides it to
/// [child] through a [PermissionsScope]. While `status == loading` the shell
/// shows an `AppSkeleton`; on failure `status == error` and the shell shows an
/// `AppBanner`/`AppErrorState` (design-system widgets — no ad-hoc UI, AD-13). No
/// caching/persistence (YAGNI): the session is in-memory.
class PermissionsProvider extends StatelessWidget {
  const PermissionsProvider({
    super.key,
    required this.port,
    required this.child,
  });

  /// Injected transport (real HTTP port in app-runtime; [FakeMePort] in tests).
  final MePort port;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => PermissionsCubit(port)..load(),
      child: BlocBuilder<PermissionsCubit, PermissionsState>(
        builder: (context, state) => PermissionsScope(
          status: state.status,
          perms: state.perms,
          me: state.me,
          child: child,
        ),
      ),
    );
  }
}
