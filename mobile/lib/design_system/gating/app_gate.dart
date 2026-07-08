// hand-authored — Flutter gating primitive (Story 1.10, mirror web
// web/src/design-system/gating/Gate.tsx `Gate`).

import 'package:flutter/widgets.dart';

import 'app_permissions.dart';

/// Renders [child] only when [perms] includes [requires]; otherwise renders a
/// zero-size `SizedBox.shrink()` — a gated-out surface simply DISAPPEARS and
/// takes NO space. There is no "blocked" state, no greyed/disabled control, no
/// opacity/ignore-pointer trick (UX-DR-22).
///
/// This is UX gating ONLY (AD-4): the backend enforces every request regardless.
/// Hiding a control here is convenience, never a security boundary.
class AppGate extends StatelessWidget {
  const AppGate({
    super.key,
    required this.perms,
    required this.requires,
    required this.child,
  });

  /// The effective permission set (Epic 1 = stub, Epic 2 = `/me`).
  final Set<PermissionKey> perms;

  /// The permission key [child] requires.
  final PermissionKey requires;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return can(perms, requires) ? child : const SizedBox.shrink();
  }
}
