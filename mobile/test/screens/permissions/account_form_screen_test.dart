// AccountFormScreen (Story 8.3): wiring screen ↔ cubit (typed text + taps reach
// the port raw), Lưu disabled until every field is filled and a preset chosen,
// the backend's field error under the right input with every value kept, edit
// mode without password/preset, a read-only account, back blocked while saving,
// and the screen torn down while the port is still answering.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';
import 'package:pns_mobile/design_system/shell/app_topbar.dart';
import 'package:pns_mobile/screens/permissions/account_form_screen.dart';

import 'held_accounts_port.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(400.0, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

/// AppField renders its label upper-cased; match the widget's own label instead.
Finder _field(String label) =>
    find.byWidgetPredicate((w) => w is AppField && w.label == label);

Finder _input(String label) =>
    find.descendant(of: _field(label), matching: find.byType(EditableText));

String _text(WidgetTester tester, String label) =>
    tester.widget<EditableText>(_input(label)).controller.text;

AppButton _saveButton(WidgetTester tester) =>
    tester.widget<AppButton>(find.widgetWithText(AppButton, 'Lưu account'));

/// The phone frame has a fixed height: scroll the target into view first.
Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pump();
}

Future<void> _type(WidgetTester tester, String label, String value) async {
  await tester.enterText(_input(label), value);
  await tester.pump();
}

Future<void> _fill(WidgetTester tester) async {
  await _type(tester, 'Họ tên', 'Phạm Văn E');
  await _type(tester, 'Số điện thoại', '0912 345 678');
  await _type(tester, 'Email', 'e@local.test');
  await _type(tester, 'Mật khẩu ban đầu', 'MatKhau123');
}

Future<void> _choose(WidgetTester tester, String preset) async {
  await _tap(tester, find.byKey(const ValueKey<String>('preset-picker')));
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(AppButton, preset).last);
  await tester.pumpAndSettle();
}

Future<void> _save(WidgetTester tester) =>
    _tap(tester, find.widgetWithText(AppButton, 'Lưu account'));

Future<HeldAccountsPort> _openCreate(
  WidgetTester tester, {
  List<String>? done,
}) async {
  _tall(tester);
  final port = HeldAccountsPort();
  await tester.pumpWidget(
    _host(AccountFormScreen(port: port, onDone: done?.add, onBack: () {})),
  );
  port.options.last.complete(demoOptions());
  await tester.pumpAndSettle();
  return port;
}

void main() {
  testWidgets(
    'create: typed text, preset and flag reach the port raw; the id goes to onDone',
    (tester) async {
      final done = <String>[];
      final port = await _openCreate(tester, done: done);
      expect(find.text('Tạo tài khoản'), findsOneWidget);
      expect(find.text('ACCOUNT'), findsOneWidget);
      expect(
        find.text('Preset nạp quyền mặc định; chỉnh thêm ở màn Phân quyền.'),
        findsOneWidget,
      );
      await _fill(tester);
      await _choose(tester, 'Thợ khảo sát');
      await _tap(tester, find.byKey(const ValueKey<String>('active-false')));

      await _save(tester);
      expect(port.createCalls.single.toJson(), {
        'displayName': 'Phạm Văn E',
        'phone': '0912 345 678',
        'email': 'e@local.test',
        'password': 'MatKhau123',
        'preset': 'THO_KS',
        'isActive': false,
      });
      port.accountWrites.last.complete(demoAccount(id: 'new-3'));
      await tester.pumpAndSettle();
      expect(done, ['new-3']);
    },
  );

  testWidgets(
    'Lưu is disabled until a preset is chosen and no field is blank',
    (tester) async {
      await _openCreate(tester);
      await _fill(tester);
      expect(_saveButton(tester).onPressed, isNull);
      expect(tester.widget<AppTopbar>(find.byType(AppTopbar)).onAction, isNull);
      await _choose(tester, 'Kế toán');
      expect(_saveButton(tester).onPressed, isNotNull);
      expect(find.widgetWithText(AppButton, 'Kế toán'), findsOneWidget);
      await _type(tester, 'Email', '   ');
      expect(_saveButton(tester).onPressed, isNull);
    },
  );

  testWidgets('Lưu is disabled while the name, phone or password is blank', (
    tester,
  ) async {
    await _openCreate(tester);
    await _fill(tester);
    await _choose(tester, 'Kế toán');
    for (final (String label, String blank, String value) in [
      ('Họ tên', '   ', 'Phạm Văn E'),
      ('Số điện thoại', '   ', '0912 345 678'),
      ('Mật khẩu ban đầu', '', 'MatKhau123'),
    ]) {
      await _type(tester, label, blank);
      expect(_saveButton(tester).onPressed, isNull, reason: label);
      await _type(tester, label, value);
      expect(_saveButton(tester).onPressed, isNotNull, reason: label);
    }
  });

  testWidgets('the topbar Lưu sends the same create as the button', (
    tester,
  ) async {
    final port = await _openCreate(tester);
    await _fill(tester);
    await _choose(tester, 'Thợ khảo sát');

    tester.widget<AppTopbar>(find.byType(AppTopbar)).onAction!();
    await tester.pump();

    expect(port.createCalls.single.toJson(), {
      'displayName': 'Phạm Văn E',
      'phone': '0912 345 678',
      'email': 'e@local.test',
      'password': 'MatKhau123',
      'preset': 'THO_KS',
      'isActive': true,
    });
  });

  testWidgets('a failed load shows the error; Thử lại loads again', (
    tester,
  ) async {
    _tall(tester);
    final port = HeldAccountsPort();
    await tester.pumpWidget(_host(AccountFormScreen(port: port)));
    port.options.last.completeError(StateError('offline'));
    await tester.pumpAndSettle();
    expect(find.text('Không tải được dữ liệu tài khoản.'), findsOneWidget);
    expect(_field('Họ tên'), findsNothing);

    await _tap(tester, find.text('Thử lại'));
    expect(port.options, hasLength(2));
    port.options.last.complete(demoOptions());
    await tester.pumpAndSettle();
    expect(_field('Họ tên'), findsOneWidget);
  });

  testWidgets(
    'field errors on the email and the password sit under each input',
    (tester) async {
      final port = await _openCreate(tester);
      await _fill(tester);
      await _choose(tester, 'Thợ khảo sát');
      await _save(tester);
      port.accountWrites.last.completeError(
        const AccountsPortException(
          'Dữ liệu không hợp lệ.',
          fieldErrors: {
            'email': 'Email đã thuộc tài khoản khác.',
            'password': 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.',
          },
        ),
      );
      await tester.pumpAndSettle();

      final email = find.byKey(const ValueKey<String>('field-error-email'));
      final password = find.byKey(
        const ValueKey<String>('field-error-password'),
      );
      expect(
        find.descendant(
          of: email,
          matching: find.text('Email đã thuộc tài khoản khác.'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: password,
          matching: find.text('Mật khẩu tối thiểu 8 ký tự, có chữ và số.'),
        ),
        findsOneWidget,
      );
      final double emailY = tester.getTopLeft(email).dy;
      expect(emailY, greaterThan(tester.getTopLeft(_input('Email')).dy));
      expect(
        emailY,
        lessThan(tester.getTopLeft(_input('Mật khẩu ban đầu')).dy),
      );
      expect(
        tester.getTopLeft(password).dy,
        greaterThan(tester.getTopLeft(_input('Mật khẩu ban đầu')).dy),
      );
      expect(find.text('Dữ liệu không hợp lệ.'), findsNothing);
      expect(_text(tester, 'Email'), 'e@local.test');
    },
  );

  testWidgets(
    'a 409 on the phone sits under the phone field; every value stays',
    (tester) async {
      final port = await _openCreate(tester);
      await _fill(tester);
      await _choose(tester, 'Thợ khảo sát');
      await _save(tester);
      port.accountWrites.last.completeError(
        const AccountsPortException(
          'Số điện thoại đã thuộc tài khoản khác.',
          fieldErrors: {'phone': 'Số điện thoại đã thuộc tài khoản khác.'},
        ),
      );
      await tester.pumpAndSettle();

      final error = find.byKey(const ValueKey<String>('field-error-phone'));
      expect(
        find.descendant(
          of: error,
          matching: find.text('Số điện thoại đã thuộc tài khoản khác.'),
        ),
        findsOneWidget,
      );
      final double y = tester.getTopLeft(error).dy;
      expect(y, greaterThan(tester.getTopLeft(_input('Số điện thoại')).dy));
      expect(y, lessThan(tester.getTopLeft(_input('Email')).dy));
      expect(_text(tester, 'Số điện thoại'), '0912 345 678');
      expect(_text(tester, 'Họ tên'), 'Phạm Văn E');
      expect(_text(tester, 'Mật khẩu ban đầu'), 'MatKhau123');
      expect(find.widgetWithText(AppButton, 'Thợ khảo sát'), findsOneWidget);
      expect(_saveButton(tester).onPressed, isNotNull);
    },
  );

  testWidgets('a refusal without a field shows its sentence above the form', (
    tester,
  ) async {
    final port = await _openCreate(tester);
    await _fill(tester);
    await _choose(tester, 'Thợ khảo sát');
    await _save(tester);
    port.accountWrites.last.completeError(
      const AccountsPortException('Không thể cấp quyền bạn không có: x'),
    );
    await tester.pumpAndSettle();
    expect(
      find.widgetWithText(AppBanner, 'Không thể cấp quyền bạn không có: x'),
      findsOneWidget,
    );
  });

  testWidgets('while saving: Lưu disabled and back is blocked', (tester) async {
    _tall(tester);
    final port = HeldAccountsPort();
    var backs = 0;
    await tester.pumpWidget(
      _host(AccountFormScreen(port: port, onBack: () => backs++)),
    );
    port.options.last.complete(demoOptions());
    await tester.pumpAndSettle();
    await _fill(tester);
    await _choose(tester, 'Thợ khảo sát');
    await _save(tester);

    expect(_saveButton(tester).onPressed, isNull);
    expect(
      tester
          .widget<AppButton>(
            find.byKey(const ValueKey<String>('preset-picker')),
          )
          .onPressed,
      isNull,
    );
    expect(
      tester
          .widget<PopScope>(find.byWidgetPredicate((w) => w is PopScope))
          .canPop,
      isFalse,
    );
    tester.widget<AppTopbar>(find.byType(AppTopbar)).onBack!();
    expect(backs, 0);
    await _save(tester);
    expect(port.createCalls, hasLength(1));

    port.accountWrites.last.completeError(StateError('boom'));
    await tester.pumpAndSettle();
    tester.widget<AppTopbar>(find.byType(AppTopbar)).onBack!();
    expect(backs, 1);
  });

  testWidgets(
    'edit: fields loaded, no password and no preset, four fields sent',
    (tester) async {
      _tall(tester);
      final port = FakeAccountsPort();
      final done = <String>[];
      await tester.pumpWidget(
        _host(
          AccountFormScreen(
            port: port,
            accountId: kDemoWorkerId,
            onDone: done.add,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Sửa tài khoản'), findsOneWidget);
      expect(_text(tester, 'Họ tên'), 'Bình Thợ');
      expect(_text(tester, 'Số điện thoại'), '+84900000002');
      expect(_field('Mật khẩu ban đầu'), findsNothing);
      expect(find.text('Role preset'), findsNothing);

      await _type(tester, 'Họ tên', 'Bình Mới');
      await _tap(tester, find.byKey(const ValueKey<String>('active-false')));
      await _save(tester);
      await tester.pumpAndSettle();

      final (String id, UpdateAccountInput input) =
          port.updateAccountCalls.single;
      expect(id, kDemoWorkerId);
      expect(input.toJson(), {
        'displayName': 'Bình Mới',
        'phone': '+84900000002',
        'email': '$kDemoWorkerId@example.com',
        'isActive': false,
      });
      expect(done, [kDemoWorkerId]);
    },
  );

  testWidgets('edit: Kích hoạt on a deactivated account sends isActive true', (
    tester,
  ) async {
    _tall(tester);
    final port = HeldAccountsPort();
    await tester.pumpWidget(
      _host(AccountFormScreen(port: port, accountId: kDemoWorkerId)),
    );
    port.lists.last.complete([demoAccount(isActive: false)]);
    await tester.pumpAndSettle();
    expect(find.text('● Tạm khoá'), findsOneWidget);

    await _tap(tester, find.byKey(const ValueKey<String>('active-true')));
    expect(find.text('● Kích hoạt'), findsOneWidget);
    await _save(tester);

    final (String id, UpdateAccountInput input) =
        port.updateAccountCalls.single;
    expect(id, kDemoWorkerId);
    expect(input.isActive, isTrue);
  });

  testWidgets('edit: a read-only account shows why and has no form', (
    tester,
  ) async {
    _tall(tester);
    await tester.pumpWidget(
      _host(
        AccountFormScreen(port: FakeAccountsPort(), accountId: kDemoSelfId),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Không sửa được tài khoản này.'), findsOneWidget);
    expect(find.text('Đây là tài khoản của bạn.'), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Lưu account'), findsNothing);
  });

  testWidgets(
    'torn down while saving or loading: a late answer does not throw',
    (tester) async {
      final port = await _openCreate(tester);
      await _fill(tester);
      await _choose(tester, 'Thợ khảo sát');
      await _save(tester);
      await tester.pumpWidget(_host(const SizedBox()));
      port.accountWrites.last.complete(demoAccount());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      final again = HeldAccountsPort();
      await tester.pumpWidget(
        _host(AccountFormScreen(port: again, accountId: kDemoWorkerId)),
      );
      await tester.pumpWidget(_host(const SizedBox()));
      again.lists.last.completeError(StateError('late'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
}
