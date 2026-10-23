// AccountListScreen (Story 8.2): each row shows the name, phone, the backend's
// preset label (or "Tuỳ chỉnh") and "Đã vô hiệu"; tapping opens the account and
// the list reads again when it closes; error + Thử lại; torn down while pending.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';
import 'package:pns_mobile/design_system/shell/app_bottom_nav.dart';
import 'package:pns_mobile/screens/permissions/account_list_screen.dart';

import 'held_accounts_port.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets(
    'rows show name, phone, preset label or Tuỳ chỉnh, and Đã vô hiệu',
    (tester) async {
      final port = FakeAccountsPort(
        accounts: [
          demoAccount(),
          demoAccount(
            id: 'super',
            displayName: 'Chủ Super',
            phone: null,
            matchingPreset: RolePreset.superAdmin,
            matchingPresetLabel: 'Super Admin',
            editable: false,
          ),
          demoAccount(
            id: 'custom',
            displayName: 'Lan Custom',
            matchingPreset: null,
            matchingPresetLabel: null,
            isActive: false,
          ),
        ],
      );
      await tester.pumpWidget(_host(AccountListScreen(port: port)));
      await tester.pumpAndSettle();

      expect(find.text('Phân quyền & tài khoản'), findsOneWidget);
      expect(find.text('Bình Thợ'), findsOneWidget);
      expect(find.text('+84900000002'), findsNWidgets(2));
      expect(find.text('Thợ khảo sát'), findsOneWidget);
      expect(find.text('Super Admin'), findsOneWidget);
      expect(find.text('Tuỳ chỉnh'), findsOneWidget);
      expect(find.text('Đã vô hiệu'), findsOneWidget);
      // Reached from Menu, the fifth tab.
      expect(
        tester.widget<AppBottomNav>(find.byType(AppBottomNav)).activeIndex,
        4,
      );
    },
  );

  testWidgets(
    'tapping a row opens it and the list reads again when it closes',
    (tester) async {
      final port = FakeAccountsPort();
      final Completer<void> closed = Completer<void>();
      final opened = <String>[];
      await tester.pumpWidget(
        _host(
          AccountListScreen(
            port: port,
            onOpen: (id) {
              opened.add(id);
              return closed.future;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(port.listCalls, 1);

      await tester.tap(find.text('Bình Thợ'));
      await tester.pumpAndSettle();
      expect(opened, [kDemoWorkerId]);
      expect(port.listCalls, 1);

      closed.complete();
      await tester.pumpAndSettle();
      expect(port.listCalls, 2);
    },
  );

  testWidgets('a refusal shows the backend sentence; Thử lại reads again', (
    tester,
  ) async {
    final port = HeldAccountsPort();
    await tester.pumpWidget(_host(AccountListScreen(port: port)));
    expect(find.byType(AppSkeleton), findsWidgets);
    port.lists.last.completeError(
      const AccountsPortException('Bạn không có quyền.'),
    );
    await tester.pumpAndSettle();
    expect(find.text('Bạn không có quyền.'), findsOneWidget);

    await tester.tap(find.text('Thử lại'));
    await tester.pump();
    expect(port.lists, hasLength(2));
    port.lists.last.complete(<AccountPermissionSummary>[]);
    await tester.pumpAndSettle();
    expect(find.byType(AppEmptyState), findsOneWidget);
  });

  testWidgets(
    'torn down while the list is loading: a late answer does not throw',
    (tester) async {
      final port = HeldAccountsPort();
      await tester.pumpWidget(_host(AccountListScreen(port: port)));
      await tester.pumpWidget(_host(const SizedBox()));
      port.lists.last.complete([demoAccount()]);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
}
