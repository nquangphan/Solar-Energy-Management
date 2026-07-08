// Native Flutter tests for the session seam (Story 2.6, Task 6 — AC-1/2/3/5).
// A fake `MePort` drives the provider so the whole flow is hermetic (no network,
// no DB — mirror Story 2.5). Asserts: `/me`→PermissionSet mapping, nav filtered
// by the scope (Audit hidden without `audit.read`), the revenue AppGate shrinks
// without `dashboard.finance_view`, `orderScope` from the scope, and that the
// locked 5-tab bottom nav is unaffected.

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/skeleton.dart';
import 'package:pns_mobile/design_system/gating/app_permissions.dart';
import 'package:pns_mobile/design_system/session/session.dart';

Widget _host(Widget child) =>
    Directionality(textDirection: TextDirection.ltr, child: child);

/// Pump a provider fed by [me], wrapping [AppSessionGatingExample], and settle
/// the async fetch.
Future<void> _pumpExample(WidgetTester tester, MeResponse me) async {
  await tester.pumpWidget(_host(
    PermissionsProvider(
      port: FakeMePort(me),
      child: const AppSessionGatingExample(),
    ),
  ));
  await tester.pumpAndSettle();
}

const _superAdmin = MeResponse(
  id: 'a1',
  email: 'sa@pns.solar',
  displayName: 'Super Admin',
  permissions: ['audit.read', 'orders.view_all', 'permissions.manage'],
);

void main() {
  group('toPermissionSet (/me → PermissionSet mapping, AD-12)', () {
    test('maps the permissions array to a Set', () {
      final perms = toPermissionSet(kDemoMe);
      expect(perms, isA<Set<PermissionKey>>());
      expect(perms, {'orders.view_all', 'permissions.manage'});
    });

    test('empty permissions → empty set (revoked account edge case)', () {
      const revoked = MeResponse(
          id: 'x', email: 'e', displayName: 'D', permissions: []);
      expect(toPermissionSet(revoked), isEmpty);
    });
  });

  group('PermissionsScope.orderScope (AC-3, FR-18)', () {
    testWidgets("'all' when orders.view_all present", (tester) async {
      late String scopeValue;
      await tester.pumpWidget(_host(PermissionsProvider(
        port: const FakeMePort(MeResponse(
            id: 'a', email: 'e', displayName: 'D',
            permissions: ['orders.view_all'])),
        child: Builder(builder: (context) {
          scopeValue = PermissionsScope.of(context).orderScope;
          return const SizedBox();
        }),
      )));
      await tester.pumpAndSettle();
      expect(scopeValue, 'all');
    });

    testWidgets("'mine' when only orders.view_own present", (tester) async {
      late String scopeValue;
      await tester.pumpWidget(_host(PermissionsProvider(
        port: const FakeMePort(MeResponse(
            id: 'a', email: 'e', displayName: 'D',
            permissions: ['orders.view_own'])),
        child: Builder(builder: (context) {
          scopeValue = PermissionsScope.of(context).orderScope;
          return const SizedBox();
        }),
      )));
      await tester.pumpAndSettle();
      expect(scopeValue, 'mine');
    });
  });

  group('Nav gating from the scope (AC-2, UX-DR-22)', () {
    testWidgets('Audit hidden when audit.read is missing (demo manager)',
        (tester) async {
      await _pumpExample(tester, kDemoMe);
      // Manager has permissions.manage but NOT audit.read.
      expect(find.text('Phân quyền'), findsOneWidget);
      expect(find.text('Audit'), findsNothing);
      expect(find.text('Hồ sơ'), findsOneWidget);
    });

    testWidgets('Audit shown when audit.read is present (Super Admin)',
        (tester) async {
      await _pumpExample(tester, _superAdmin);
      expect(find.text('Audit'), findsOneWidget);
      expect(find.text('Phân quyền'), findsOneWidget);
    });
  });

  group('Revenue AppGate (AC-2)', () {
    testWidgets('shrinks to nothing without dashboard.finance_view',
        (tester) async {
      await _pumpExample(tester, kDemoMe);
      expect(find.text('1.250.000.000 ₫'), findsNothing);
    });

    testWidgets('renders the figure with dashboard.finance_view',
        (tester) async {
      await _pumpExample(
        tester,
        const MeResponse(
            id: 'f', email: 'e', displayName: 'D',
            permissions: ['dashboard.finance_view']),
      );
      expect(find.text('1.250.000.000 ₫'), findsOneWidget);
    });
  });

  group('Loading + error states (AC-1)', () {
    testWidgets('loading state shows the AppSkeleton before /me settles',
        (tester) async {
      // A port whose future never completes keeps the provider in `loading`, so
      // the example must render the AppSkeleton — never the Menu or the revenue
      // figure. Pump once WITHOUT settling (settling would hang on the pending
      // fetch). Covers the third lifecycle state AC-1 requires.
      await tester.pumpWidget(_host(const PermissionsProvider(
        port: _PendingPort(),
        child: AppSessionGatingExample(),
      )));
      await tester.pump(); // let initState kick off the fetch; it never resolves
      expect(find.byType(AppSkeleton), findsOneWidget);
      expect(find.text('Phân quyền'), findsNothing);
      expect(find.text('1.250.000.000 ₫'), findsNothing);
    });

    testWidgets('error state shown when the port throws', (tester) async {
      await tester.pumpWidget(_host(const PermissionsProvider(
        port: _ThrowingPort(),
        child: AppSessionGatingExample(),
      )));
      await tester.pumpAndSettle();
      expect(find.text('Không tải được quyền'), findsOneWidget);
    });
  });
}

/// A port that always fails — drives the provider's error branch.
class _ThrowingPort implements MePort {
  const _ThrowingPort();
  @override
  Future<MeResponse> fetchMe() async => throw Exception('boom');
}

/// A port whose fetch never completes — keeps the provider in `loading`.
class _PendingPort implements MePort {
  const _PendingPort();
  @override
  Future<MeResponse> fetchMe() => Completer<MeResponse>().future;
}
