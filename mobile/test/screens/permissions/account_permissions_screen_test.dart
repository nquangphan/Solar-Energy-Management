// AccountPermissionsScreen (Story 8.2): the checklist ticks the stored set; a
// preset picked from the sheet changes the ticks without calling the port; Lưu
// sends the whole draft; both combinations that 403 mid-flow show the banner and
// disable Lưu; a non-grantable box and a read-only account cannot be changed; a
// refused save shows the backend sentence and keeps the ticks; torn down while
// pending.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';
import 'package:pns_mobile/design_system/shell/app_bottom_nav.dart';
import 'package:pns_mobile/design_system/shell/app_topbar.dart';
import 'package:pns_mobile/screens/permissions/account_permissions_screen.dart';

import 'held_accounts_port.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(400.0, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

AppCheckbox _box(WidgetTester tester, String label) =>
    tester.widget<AppCheckbox>(find.widgetWithText(AppCheckbox, label));

Future<FakeAccountsPort> _open(
  WidgetTester tester, {
  AccountPermissionSummary? account,
}) async {
  _tall(tester);
  final port = FakeAccountsPort(accounts: [account ?? demoAccount()]);
  await tester.pumpWidget(
    _host(AccountPermissionsScreen(port: port, accountId: kDemoWorkerId)),
  );
  await tester.pumpAndSettle();
  return port;
}

Future<void> _tapLabel(WidgetTester tester, String label) async {
  await tester.tap(find.widgetWithText(AppCheckbox, label));
  await tester.pumpAndSettle();
}

Future<void> _save(WidgetTester tester) async {
  await tester.tap(find.text('Lưu'));
  await tester.pumpAndSettle();
}

const String _gapBanner = 'dependency-gaps';

void main() {
  testWidgets('topbar, preset label and the stored set ticked', (tester) async {
    await _open(tester);
    expect(find.text('Quyền · Bình Thợ'), findsOneWidget);
    expect(find.text('QUẢN TRỊ'), findsOneWidget);
    expect(find.text('Thợ khảo sát'), findsOneWidget);
    expect(
      find.text('Preset chỉ nạp mặc định; tick/bỏ từng quyền bên dưới.'),
      findsOneWidget,
    );
    expect(_box(tester, 'Tạo/sửa báo giá').checked, isTrue);
    expect(_box(tester, 'Cấu hình hệ thống').checked, isFalse);
    // Reached from Menu, the fifth tab.
    expect(
      tester.widget<AppBottomNav>(find.byType(AppBottomNav)).activeIndex,
      4,
    );
  });

  testWidgets(
    'while a save is pending: Lưu, the boxes, Áp preset role and back are disabled, a second tap sends nothing',
    (tester) async {
      _tall(tester);
      final port = HeldAccountsPort();
      int backs = 0;
      await tester.pumpWidget(
        _host(
          AccountPermissionsScreen(
            port: port,
            accountId: kDemoWorkerId,
            onBack: () => backs++,
          ),
        ),
      );
      PopScope<dynamic> popScope() => tester.widget<PopScope<dynamic>>(
        find.descendant(
          of: find.byType(AccountPermissionsScreen),
          matching: find.byWidgetPredicate((w) => w is PopScope),
        ),
      );
      port.lists.last.complete([demoAccount()]);
      port.options.last.complete(demoOptions());
      await tester.pumpAndSettle();

      await _save(tester);
      expect(port.updateCalls, hasLength(1));
      expect(tester.widget<AppTopbar>(find.byType(AppTopbar)).onAction, isNull);
      await _save(tester);
      expect(port.updateCalls, hasLength(1));
      for (final AppCheckbox box in tester.widgetList<AppCheckbox>(
        find.byType(AppCheckbox),
      )) {
        expect(box.disabled, isTrue, reason: box.label);
      }
      expect(
        tester
            .widget<AppButton>(find.widgetWithText(AppButton, 'Áp preset role'))
            .onPressed,
        isNull,
      );
      // Leaving now would reload the list before the save commits.
      tester.widget<AppTopbar>(find.byType(AppTopbar)).onBack!();
      expect(backs, 0);
      expect(popScope().canPop, isFalse);

      port.updates.last.complete(demoAccount());
      await tester.pumpAndSettle();
      expect(
        tester.widget<AppTopbar>(find.byType(AppTopbar)).onAction,
        isNotNull,
      );
      expect(_box(tester, 'Cấu hình hệ thống').disabled, isFalse);
      expect(popScope().canPop, isTrue);
      tester.widget<AppTopbar>(find.byType(AppTopbar)).onBack!();
      expect(backs, 1);
    },
  );

  testWidgets(
    'a preset from the sheet changes the ticks only; Lưu then sends the whole draft',
    (tester) async {
      final port = await _open(tester);
      await tester.tap(find.text('Áp preset role'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(AppButton, 'Kế toán'));
      await tester.pumpAndSettle();

      expect(_box(tester, 'Tạo/sửa báo giá').checked, isFalse);
      expect(_box(tester, 'Quản lý khách hàng').checked, isTrue);
      expect(port.updateCalls, isEmpty);

      await _save(tester);
      expect(port.updateCalls, hasLength(1));
      expect(port.updateCalls.single.$1, kDemoWorkerId);
      expect(port.updateCalls.single.$2, [
        AppPermissionKeys.customersManage,
        AppPermissionKeys.catalogView,
      ]);
      expect(find.text('Đã lưu quyền.'), findsOneWidget);
    },
  );

  testWidgets(
    'settings.manage without customers.manage ⇒ banner names both, Lưu sends nothing',
    (tester) async {
      final port = await _open(tester);
      await _tapLabel(tester, 'Cấu hình hệ thống');
      await _tapLabel(tester, 'Quản lý khách hàng');
      await _tapLabel(tester, 'Tạo/sửa báo giá');

      final banner = tester.widget<AppBanner>(
        find.byKey(const ValueKey<String>(_gapBanner)),
      );
      expect(
        banner.message,
        '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».',
      );
      await _save(tester);
      expect(port.updateCalls, isEmpty);

      await _tapLabel(tester, 'Quản lý khách hàng');
      expect(find.byKey(const ValueKey<String>(_gapBanner)), findsNothing);
      await _save(tester);
      expect(port.updateCalls, hasLength(1));
    },
  );

  testWidgets(
    'quotes.create_edit without customers.manage ⇒ banner, Lưu sends nothing',
    (tester) async {
      final port = await _open(tester);
      await _tapLabel(tester, 'Quản lý khách hàng');

      final banner = tester.widget<AppBanner>(
        find.byKey(const ValueKey<String>(_gapBanner)),
      );
      expect(
        banner.message,
        '«Tạo/sửa báo giá» cần thêm «Quản lý khách hàng».',
      );
      await _save(tester);
      expect(port.updateCalls, isEmpty);
    },
  );

  testWidgets('a permission the caller cannot grant is a disabled box', (
    tester,
  ) async {
    await _open(tester);
    expect(_box(tester, 'Xem Audit log (Super Admin)').disabled, isTrue);
    expect(_box(tester, 'Cấu hình hệ thống').disabled, isFalse);
    await _tapLabel(tester, 'Xem Audit log (Super Admin)');
    expect(_box(tester, 'Xem Audit log (Super Admin)').checked, isFalse);
  });

  testWidgets(
    'a read-only account: reason shown, every box disabled, no preset button, Lưu sends nothing',
    (tester) async {
      final port = await _open(
        tester,
        account: demoAccount(
          editable: false,
          readOnlyReason: 'Đây là tài khoản của bạn.',
        ),
      );
      expect(find.text('Đây là tài khoản của bạn.'), findsOneWidget);
      expect(find.text('Áp preset role'), findsNothing);
      for (final AppCheckbox box in tester.widgetList<AppCheckbox>(
        find.byType(AppCheckbox),
      )) {
        expect(box.disabled, isTrue);
      }
      await _save(tester);
      expect(port.updateCalls, isEmpty);
    },
  );

  testWidgets('a refused save shows the backend sentence and keeps the ticks', (
    tester,
  ) async {
    final port = await _open(tester);
    port.updateError = const AccountsPortException(
      'Không thể cấp quyền bạn không có: audit.read',
    );
    await _tapLabel(tester, 'Cấu hình hệ thống');
    await _save(tester);

    expect(
      find.text('Không thể cấp quyền bạn không có: audit.read'),
      findsOneWidget,
    );
    expect(_box(tester, 'Cấu hình hệ thống').checked, isTrue);
  });

  testWidgets(
    'torn down while saving or loading: a late answer does not throw',
    (tester) async {
      _tall(tester);
      final port = HeldAccountsPort();
      await tester.pumpWidget(
        _host(AccountPermissionsScreen(port: port, accountId: kDemoWorkerId)),
      );
      port.lists.last.complete([demoAccount()]);
      port.options.last.complete(demoOptions());
      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Cấu hình hệ thống');
      await _save(tester);
      expect(port.updateCalls, hasLength(1));

      await tester.pumpWidget(_host(const SizedBox()));
      port.updates.last.complete(demoAccount());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      final again = HeldAccountsPort();
      await tester.pumpWidget(
        _host(AccountPermissionsScreen(port: again, accountId: kDemoWorkerId)),
      );
      await tester.pumpWidget(_host(const SizedBox()));
      again.lists.last.completeError(StateError('late'));
      again.options.last.complete(demoOptions());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    '"Sửa account" only on an editable account; coming back reads again without a skeleton',
    (tester) async {
      _tall(tester);
      final readOnly = FakeAccountsPort(
        accounts: [
          demoAccount(
            editable: false,
            readOnlyReason: 'Đây là tài khoản của bạn.',
          ),
        ],
      );
      await tester.pumpWidget(
        _host(
          AccountPermissionsScreen(
            port: readOnly,
            accountId: kDemoWorkerId,
            onEdit: () async {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppButton, 'Sửa account'), findsNothing);

      final port = HeldAccountsPort();
      final Completer<void> closed = Completer<void>();
      var opened = 0;
      await tester.pumpWidget(
        _host(
          AccountPermissionsScreen(
            key: const ValueKey<String>('editable'),
            port: port,
            accountId: kDemoWorkerId,
            onEdit: () {
              opened++;
              return closed.future;
            },
          ),
        ),
      );
      port.lists.last.complete([demoAccount()]);
      port.options.last.complete(demoOptions());
      await tester.pumpAndSettle();
      final edit = find.widgetWithText(AppButton, 'Sửa account');
      await tester.ensureVisible(edit);
      await tester.tap(edit);
      await tester.pumpAndSettle();
      expect(opened, 1);

      closed.complete();
      await tester.pump();
      expect(port.lists, hasLength(2));
      expect(find.byType(AppSkeleton), findsNothing);
      expect(find.text('Quyền · Bình Thợ'), findsOneWidget);
      port.lists.last.complete([demoAccount(displayName: 'Bình Mới')]);
      port.options.last.complete(demoOptions());
      await tester.pumpAndSettle();
      expect(find.text('Quyền · Bình Mới'), findsOneWidget);
    },
  );
}
