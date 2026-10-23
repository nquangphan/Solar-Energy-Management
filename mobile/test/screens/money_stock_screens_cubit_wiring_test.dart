// Screen ↔ cubit wiring of the payment, stock, contract and invoice screens (Story
// 11.4) that no older widget test pins: each one is a render read or a button the
// mutation sweep could break while every other lane stayed green.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/contracts_port.dart';
import 'package:pns_mobile/design_system/session/fake_contracts_port.dart';
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/fake_payments_port.dart';
import 'package:pns_mobile/design_system/session/fake_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/payments_port.dart';
import 'package:pns_mobile/design_system/shell/app_tabs.dart';
import 'package:pns_mobile/screens/contracts/contracts_screen.dart';
import 'package:pns_mobile/screens/inventory/inventory_screen.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_screen.dart';
import 'package:pns_mobile/screens/payments/payment_schedule_screen.dart';

import 'contracts/recording_contracts_port.dart';
import 'inventory/recording_stock_vouchers_port.dart';
import 'payments/recording_payments_port.dart';
import 'recording_port_calls.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(400.0, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder.first);
  await tester.pumpAndSettle();
  await tester.tap(finder.first);
  await tester.pumpAndSettle();
}

/// The text input of the `AppField` with [label] (`AppField` paints its label upper-cased).
Finder _input(String label) => find
    .descendant(of: find.widgetWithText(AppField, label.toUpperCase()), matching: find.byType(EditableText))
    .first;

/// How many times [method] reached the port.
int _calls(RecordingPortCalls port, String method) => port.log.where((String m) => m == method).length;

/// Whether the [AppButton] labelled [label] can be pressed.
bool _enabled(WidgetTester tester, String label) =>
    tester.widget<AppButton>(find.widgetWithText(AppButton, label).first).onPressed != null;

void main() {
  testWidgets('Phiếu kho: the tab tapped is the tab shown active', (tester) async {
    _tall(tester);
    await tester.pumpWidget(_host(StockVouchersScreen(port: FakeStockVouchersPort(), inventoryPort: const FakeInventoryPort())));
    await tester.pumpAndSettle();
    expect(tester.widget<AppTabs>(find.byType(AppTabs)).activeKey, 'all');
    await _tap(tester, find.descendant(of: find.byType(AppTabs), matching: find.text('Nhập trả')));
    expect(tester.widget<AppTabs>(find.byType(AppTabs)).activeKey, 'nhaptra');
  });

  testWidgets('Sinh hợp đồng: both buttons are disabled while a contract is generated', (tester) async {
    _tall(tester);
    final ContractSummary existing = await FakeContractsPort().generateContract('DH-2048');
    final port = RecordingContractsPort(initial: [existing])..held.add('generateContract');
    await tester.pumpWidget(_host(ContractsScreen(port: port, orderId: 'DH-2048', shareImpl: RecordingShare().call)));
    await tester.pumpAndSettle();
    expect(_enabled(tester, 'Xuất PDF hợp đồng'), isTrue);
    expect(_enabled(tester, 'Tải PDF'), isTrue);
    await tester.tap(find.widgetWithText(AppButton, 'Xuất PDF hợp đồng'));
    await tester.pump();
    expect(_enabled(tester, 'Xuất PDF hợp đồng'), isFalse);
    expect(_enabled(tester, 'Tải PDF'), isFalse);
    port.pendingOf('generateContract').complete();
    await tester.pumpAndSettle();
    expect(_enabled(tester, 'Xuất PDF hợp đồng'), isTrue);
  });

  group('Tồn kho', () {
    testWidgets('the reload signal reads the stock exactly once more', (tester) async {
      final port = RecordingStockVouchersPort();
      final ValueNotifier<int> signal = ValueNotifier<int>(0);
      addTearDown(signal.dispose);
      await tester.pumpWidget(_host(InventoryScreen(port: port, reloadSignal: signal)));
      await tester.pumpAndSettle();
      expect(_calls(port, 'listStock'), 1);
      signal.value++;
      await tester.pumpAndSettle();
      expect(_calls(port, 'listStock'), 2);
    });

    testWidgets('a new reload signal replaces the old one', (tester) async {
      final port = RecordingStockVouchersPort();
      final ValueNotifier<int> first = ValueNotifier<int>(0);
      final ValueNotifier<int> second = ValueNotifier<int>(0);
      addTearDown(first.dispose);
      addTearDown(second.dispose);
      await tester.pumpWidget(_host(InventoryScreen(port: port, reloadSignal: first)));
      await tester.pumpAndSettle();
      await tester.pumpWidget(_host(InventoryScreen(port: port, reloadSignal: second)));
      await tester.pumpAndSettle();
      first.value++;
      await tester.pumpAndSettle();
      expect(_calls(port, 'listStock'), 1, reason: 'the old signal no longer reads');
      second.value++;
      await tester.pumpAndSettle();
      expect(_calls(port, 'listStock'), 2);
    });

    testWidgets('back from Phiếu kho ⇒ the stock is read once more', (tester) async {
      final port = RecordingStockVouchersPort();
      var opened = 0;
      await tester.pumpWidget(_host(InventoryScreen(
        port: port,
        perms: const {AppPermissionKeys.inventoryManage},
        onOpenVouchers: () async => opened++,
      )));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Phiếu kho'));
      await tester.pumpAndSettle();
      expect(opened, 1);
      expect(_calls(port, 'listStock'), 2);
    });
  });

  group('Phiếu kho', () {
    testWidgets('Thử lại on a failed voucher reads that voucher again', (tester) async {
      _tall(tester);
      final port = RecordingStockVouchersPort()..errors['getVoucher'] = StateError('offline');
      await tester.pumpWidget(_host(StockVouchersScreen(port: port, inventoryPort: port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('PK-X-0095'));
      expect(find.text('Không tải được chi tiết phiếu.'), findsOneWidget);
      port.errors.remove('getVoucher');
      await _tap(tester, find.text('Thử lại'));
      final List<List<Object?>> reads = port.argsOf('getVoucher');
      expect(reads, hasLength(2));
      expect(reads[1], reads[0], reason: 'the same voucher, read again');
      expect(find.text('Không tải được chi tiết phiếu.'), findsNothing);
    });

    testWidgets('a voucher created from tab Xuất keeps tab Xuất, re-reads its filter, then opens it', (tester) async {
      _tall(tester);
      final port = RecordingStockVouchersPort();
      await tester.pumpWidget(_host(StockVouchersScreen(port: port, inventoryPort: port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.descendant(of: find.byType(AppTabs), matching: find.text('Xuất')));
      await _tap(tester, find.text('Tạo phiếu'));
      await _tap(tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
      await tester.enterText(_input('SL'), '40');
      await tester.enterText(_input('Giá vốn / đv *'), '2110000');
      await _tap(tester, find.widgetWithText(AppButton, 'Lưu phiếu'));
      expect(tester.widget<AppTabs>(find.byType(AppTabs)).activeKey, 'xuat');
      expect(port.argsOf('listVouchers').last, ['xuat', null]);
      expect(port.log.last, 'getVoucher');
    });

    testWidgets('the create sheet searches the products for what is typed', (tester) async {
      _tall(tester);
      final port = RecordingStockVouchersPort();
      await tester.pumpWidget(_host(StockVouchersScreen(port: port, inventoryPort: port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Tạo phiếu'));
      expect(port.argsOf('listStock'), [
        [''],
      ]);
      await tester.enterText(_input('Tìm sản phẩm để thêm dòng'), 'AE');
      await tester.pumpAndSettle();
      expect(port.argsOf('listStock').last, ['AE']);
    });
  });

  group('Lịch thanh toán', () {
    PaymentScheduleScreen screen(RecordingPaymentsPort port) => PaymentScheduleScreen(
          port: port,
          orderId: 'DH-2048',
          perms: const {AppPermissionKeys.paymentsRecord},
          newKey: () => 'key-1',
        );

    testWidgets('another installment\'s form starts with no note and a bank transfer', (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(screen(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Ghi nhận'));
      await tester.enterText(_input('Ghi chú'), 'ghi chú cũ');
      await _tap(tester, find.widgetWithText(AppButton, 'Tiền mặt'));
      await _tap(tester, find.widgetWithText(AppButton, 'Huỷ'));
      await _tap(tester, find.text('Ghi nhận').at(1));
      await _tap(tester, find.text('Ghi nhận đợt 2'));
      await _tap(tester, find.descendant(of: find.byType(AppConfirmDialog), matching: find.text('Ghi nhận')));
      final RecordPaymentInput sent = port.argsOf('recordPayment').single[1] as RecordPaymentInput;
      expect(sent.installmentId, 'inst-2');
      expect(sent.note, isNull);
      expect(sent.method, 'bank_transfer');
    });

    PaymentsPortError refusal({bool general = true}) => PaymentsPortError(
          code: 'VALIDATION_FAILED',
          message: 'Dữ liệu không hợp lệ.',
          fieldErrors: [
            const FieldError(field: 'installments.1.percent', code: 'invalid', message: 'Lỗi tỉ lệ đợt 2.'),
            if (general) const FieldError(field: 'installments', code: 'invalid', message: 'Lỗi chung của lịch.'),
          ],
        );

    Future<void> saveRefused(WidgetTester tester, RecordingPaymentsPort port) async {
      await tester.pumpWidget(_host(screen(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Sửa lịch'));
      await _tap(tester, find.text('Lưu lịch'));
    }

    testWidgets('a template clears the row errors and the form banner', (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured, replyToReplace: refusal());
      await saveRefused(tester, port);
      expect(find.text('Lỗi tỉ lệ đợt 2.'), findsOneWidget);
      expect(find.text('Lỗi chung của lịch.'), findsOneWidget);
      await _tap(tester, find.widgetWithText(AppButton, '20/70/10'));
      expect(find.text('Lỗi tỉ lệ đợt 2.'), findsNothing);
      expect(find.text('Lỗi chung của lịch.'), findsNothing);
    });

    testWidgets('removing a row clears the row errors (they would point at the wrong rows)', (tester) async {
      _tall(tester);
      final port =
          RecordingPaymentsPort(initial: demoPaymentScheduleConfigured, replyToReplace: refusal(general: false));
      await saveRefused(tester, port);
      expect(find.text('Lỗi tỉ lệ đợt 2.'), findsOneWidget);
      await _tap(tester, find.widgetWithText(AppButton, 'Xoá đợt'));
      expect(find.text('Lỗi tỉ lệ đợt 2.'), findsNothing);
    });

    testWidgets('Huỷ closes the edit form', (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(screen(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Sửa lịch'));
      expect(find.text('Lưu lịch'), findsOneWidget);
      await _tap(tester, find.widgetWithText(AppButton, 'Huỷ'));
      expect(find.text('Lưu lịch'), findsNothing);
      expect(find.text('Sửa lịch'), findsOneWidget);
      expect(port.log, ['getSchedule']);
    });

    /// Whether every [AppButton] labelled [label] outside the confirm dialog is disabled.
    bool allDisabledOutsideDialog(WidgetTester tester, String label) {
      final Iterable<AppButton> buttons = tester
          .widgetList<AppButton>(find.widgetWithText(AppButton, label))
          .where((AppButton b) => find
              .descendant(of: find.byType(AppConfirmDialog), matching: find.byWidget(b))
              .evaluate()
              .isEmpty);
      expect(buttons, isNotEmpty, reason: 'no "$label" button on screen');
      return buttons.every((AppButton b) => b.onPressed == null);
    }

    testWidgets('while a payment is recorded, Huỷ and every installment\'s Ghi nhận are disabled', (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured)..held.add('recordPayment');
      await tester.pumpWidget(_host(screen(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Ghi nhận'));
      await _tap(tester, find.text('Ghi nhận đợt 1'));
      await tester.tap(find.descendant(of: find.byType(AppConfirmDialog), matching: find.text('Ghi nhận')));
      await tester.pump();
      expect(port.argsOf('recordPayment'), hasLength(1));
      expect(allDisabledOutsideDialog(tester, 'Huỷ'), isTrue);
      expect(allDisabledOutsideDialog(tester, 'Ghi nhận'), isTrue);
      port.pendingOf('recordPayment').complete();
      await tester.pumpAndSettle();
    });

    testWidgets('while the schedule is saved, Huỷ is disabled', (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured)..held.add('replaceSchedule');
      await tester.pumpWidget(_host(screen(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Sửa lịch'));
      await tester.ensureVisible(find.text('Lưu lịch'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lưu lịch'));
      await tester.pump();
      expect(port.argsOf('replaceSchedule'), hasLength(1));
      expect(_enabled(tester, 'Huỷ'), isFalse);
      port.pendingOf('replaceSchedule').complete();
      await tester.pumpAndSettle();
      expect(find.text('Lưu lịch'), findsNothing);
    });

    testWidgets('a row removed while the schedule is saved ⇒ the error of that row reaches the form banner',
        (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured)..held.add('replaceSchedule');
      await tester.pumpWidget(_host(screen(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Sửa lịch'));
      await _tap(tester, find.widgetWithText(AppButton, '20/70/10'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppButton, 'Xoá đợt'), findsNWidgets(3));
      await tester.ensureVisible(find.text('Lưu lịch'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lưu lịch'));
      await tester.pump();
      expect(port.argsOf('replaceSchedule'), hasLength(1));
      await tester.ensureVisible(find.widgetWithText(AppButton, 'Xoá đợt').last);
      await tester.tap(find.widgetWithText(AppButton, 'Xoá đợt').last);
      await tester.pump();
      expect(find.widgetWithText(AppButton, 'Xoá đợt'), findsNWidgets(2));
      port.pendingOf('replaceSchedule').completeError(const PaymentsPortError(
        code: 'VALIDATION_FAILED',
        message: 'Dữ liệu không hợp lệ.',
        fieldErrors: [FieldError(field: 'installments.2.amount', code: 'invalid', message: 'Số tiền phải lớn hơn 0.')],
      ));
      await tester.pumpAndSettle();
      expect(find.text('Số tiền phải lớn hơn 0.'), findsOneWidget);
    });

    testWidgets('the Ngày thu typed is the date sent', (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(screen(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Ghi nhận'));
      await tester.enterText(_input('Ngày thu'), '2026-10-01');
      await _tap(tester, find.text('Ghi nhận đợt 1'));
      await _tap(tester, find.descendant(of: find.byType(AppConfirmDialog), matching: find.text('Ghi nhận')));
      final RecordPaymentInput sent = port.argsOf('recordPayment').single[1] as RecordPaymentInput;
      expect(sent.paidOn, '2026-10-01');
    });
  });
}
