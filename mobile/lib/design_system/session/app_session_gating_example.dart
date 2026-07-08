// hand-authored — DEMO compose point (Story 2.6, Task 5, mirror web
// SessionGatingExample.tsx). The real Menu screen is Epic 3+; this minimal widget
// demonstrates the ONE wiring the story delivers: the filterable Menu list + the
// revenue surface gated by the `/me` session scope, NOT by the Epic 1
// `demoPermissions` stub. The locked 5-tab bottom nav is untouched (UX-DR-15) —
// gating never applies to it.
//
// GATING IS UX ONLY (AD-4): the hidden Audit row / shrunk revenue is convenience;
// the backend enforces every request (Story 2.5).

import 'package:flutter/widgets.dart';

import '../components/error_state.dart';
import '../components/skeleton.dart';
import '../gating/app_gate.dart';
import '../gating/app_permissions.dart';
import '../tokens/app_tokens.dart';
import 'app_session.dart';

/// The filterable Menu content (parity with web `SIDEBAR_NAV` admin section).
/// The 5 bottom-nav tabs are NOT here — they are locked in app_bottom_nav.dart.
const List<AppNavSection> kMenuSections = [
  AppNavSection(
    title: 'Quản trị',
    links: [
      AppNavLink(key: 'permissions', label: 'Phân quyền', requires: AppPerm.permissionsManage),
      AppNavLink(key: 'audit', label: 'Audit', requires: AppPerm.auditRead),
      AppNavLink(key: 'profile', label: 'Hồ sơ'),
    ],
  ),
];

/// Renders the Menu filtered by the session scope's perms + a revenue figure
/// gated behind `dashboard.finance_view`. Loading → `AppSkeleton`; error →
/// `AppErrorState` (design-system widgets, AD-13 — no ad-hoc UI).
///
/// The gating primitives are UNCHANGED (Story 1.10 promise): `filterNav`/`AppGate`
/// keep their signatures; only the SOURCE of `perms` is now the scope.
class AppSessionGatingExample extends StatelessWidget {
  const AppSessionGatingExample({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = PermissionsScope.of(context);

    if (scope.status == SessionStatus.loading) {
      return const AppSkeleton(width: 200.0);
    }
    if (scope.status == SessionStatus.error) {
      return const AppErrorState(message: 'Không tải được quyền');
    }

    final sections = filterNav(kMenuSections, scope.perms);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final section in sections) ...[
          if (section.title != null) Text(section.title!),
          for (final link in section.links) Text(link.label),
        ],
        AppGate(
          perms: scope.perms,
          requires: AppPerm.dashboardFinanceView,
          child: const Text('1.250.000.000 ₫',
              style: TextStyle(fontFamily: AppTokens.fontFamily)),
        ),
      ],
    );
  }
}
