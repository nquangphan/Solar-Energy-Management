// The payment, stock, contract and invoice screens torn down while their port call
// is still in flight (Story 11.4). Under BLoC the cubit closes with the widget, so
// the late answer — success or failure — must neither throw (emit after close) nor
// fire the screen's callback, nor open the share sheet.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/session/fake_invoices_port.dart';
import 'package:pns_mobile/design_system/session/fake_payments_port.dart';
import 'package:pns_mobile/screens/contracts/contracts_screen.dart';
import 'package:pns_mobile/screens/inventory/inventory_screen.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_screen.dart';
import 'package:pns_mobile/screens/invoices/invoice_detail_screen.dart';
import 'package:pns_mobile/screens/invoices/invoices_screen.dart';
import 'package:pns_mobile/screens/payments/payment_schedule_screen.dart';

import 'contracts/recording_contracts_port.dart';
import 'inventory/recording_stock_vouchers_port.dart';
import 'invoices/recording_invoices_port.dart';
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
  await tester.pump();
}

Finder _inDialog(String label) => find.descendant(of: find.byType(AppConfirmDialog), matching: find.text(label));

/// Removes the screen, then answers the pending call with [error] (or the fake's value).
Future<void> _leaveThenAnswer(WidgetTester tester, Completer<Object?> pending, Object? error) async {
  await tester.pumpWidget(const SizedBox());
  error == null ? pending.complete() : pending.completeError(error);
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
}

PaymentScheduleScreen _payments(RecordingPaymentsPort port, {ValueChanged<String>? onOrderStatusChanged}) =>
    PaymentScheduleScreen(
      port: port,
      orderId: 'DH-2048',
      perms: const {AppPermissionKeys.paymentsRecord},
      onOrderStatusChanged: onOrderStatusChanged,
      newKey: () => 'key-1',
    );

void main() {
  for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
    testWidgets('Lịch thanh toán left while the schedule loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingPaymentsPort()..held.add('getSchedule');
      await tester.pumpWidget(_host(_payments(port)));
      expect(port.log, ['getSchedule']);
      await _leaveThenAnswer(tester, port.pendingOf('getSchedule'), error);
    });

    testWidgets('Lịch thanh toán left while a payment is sent, then the port $outcome ⇒ no crash, no status callback',
        (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured)..held.add('recordPayment');
      final List<String> reported = <String>[];
      await tester.pumpWidget(_host(_payments(port, onOrderStatusChanged: reported.add)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Ghi nhận'));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Ghi nhận đợt 1'));
      await tester.pumpAndSettle();
      await _tap(tester, _inDialog('Ghi nhận'));
      expect(port.log, ['getSchedule', 'recordPayment']);
      await _leaveThenAnswer(tester, port.pendingOf('recordPayment'), error);
      expect(reported, isEmpty);
    });

    testWidgets('Lịch thanh toán left while the schedule is saved, then the port $outcome ⇒ no crash', (tester) async {
      _tall(tester);
      final port = RecordingPaymentsPort(initial: demoPaymentScheduleConfigured)..held.add('replaceSchedule');
      await tester.pumpWidget(_host(_payments(port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Sửa lịch'));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('Lưu lịch'));
      expect(port.log, ['getSchedule', 'replaceSchedule']);
      await _leaveThenAnswer(tester, port.pendingOf('replaceSchedule'), error);
    });

    testWidgets('Tồn kho left while the stock loads, then the port $outcome ⇒ no crash; the signal no longer reads',
        (tester) async {
      final port = RecordingStockVouchersPort()..held.add('listStock');
      final ValueNotifier<int> signal = ValueNotifier<int>(0);
      addTearDown(signal.dispose);
      await tester.pumpWidget(_host(InventoryScreen(port: port, reloadSignal: signal)));
      expect(port.log, ['listStock']);
      await _leaveThenAnswer(tester, port.pendingOf('listStock'), error);
      signal.value++;
      await tester.pump();
      expect(port.log, ['listStock']);
    });

    testWidgets('Phiếu kho left while the list loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingStockVouchersPort()..held.add('listVouchers');
      await tester.pumpWidget(_host(StockVouchersScreen(port: port, inventoryPort: port)));
      expect(port.log, ['listVouchers']);
      await _leaveThenAnswer(tester, port.pendingOf('listVouchers'), error);
    });

    testWidgets('Phiếu kho left while a voucher loads, then the port $outcome ⇒ no crash', (tester) async {
      _tall(tester);
      final port = RecordingStockVouchersPort()..held.add('getVoucher');
      await tester.pumpWidget(_host(StockVouchersScreen(port: port, inventoryPort: port)));
      await tester.pumpAndSettle();
      await _tap(tester, find.text('PK-X-0095'));
      expect(port.log, ['listVouchers', 'getVoucher']);
      await _leaveThenAnswer(tester, port.pendingOf('getVoucher'), error);
    });

    testWidgets('Sinh hợp đồng left while the overview loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingContractsPort()..held.add('getOverview');
      await tester.pumpWidget(_host(ContractsScreen(port: port, orderId: 'DH-2048')));
      expect(port.log, ['getOverview']);
      await _leaveThenAnswer(tester, port.pendingOf('getOverview'), error);
    });

    testWidgets('Sinh hợp đồng left while a contract is generated, then the port $outcome ⇒ no crash, no share',
        (tester) async {
      _tall(tester);
      final port = RecordingContractsPort()..held.add('generateContract');
      final share = RecordingShare();
      await tester.pumpWidget(_host(ContractsScreen(port: port, orderId: 'DH-2048', shareImpl: share.call)));
      await tester.pumpAndSettle();
      await _tap(tester, find.widgetWithText(AppButton, 'Xuất PDF hợp đồng'));
      expect(port.log, ['getOverview', 'generateContract']);
      await _leaveThenAnswer(tester, port.pendingOf('generateContract'), error);
      expect(share.calls, isEmpty);
      expect(port.log, ['getOverview', 'generateContract']);
    });

    testWidgets('Hoá đơn left while the overview loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingInvoicesPort()..held.add('getOverview');
      await tester.pumpWidget(_host(InvoicesScreen(port: port, orderId: 'DH-2048')));
      expect(port.log, ['getOverview']);
      await _leaveThenAnswer(tester, port.pendingOf('getOverview'), error);
    });

    testWidgets('Hoá đơn left while the invoice is created, then the port $outcome ⇒ no crash, no re-read',
        (tester) async {
      _tall(tester);
      final port = RecordingInvoicesPort()..held.add('createInvoice');
      await tester.pumpWidget(_host(InvoicesScreen(port: port, orderId: 'DH-2048')));
      await tester.pumpAndSettle();
      await _tap(tester, find.widgetWithText(AppButton, 'Tạo hoá đơn'));
      await tester.pumpAndSettle();
      await _tap(tester, _inDialog('Tạo hoá đơn'));
      expect(port.log, ['getOverview', 'createInvoice']);
      await _leaveThenAnswer(tester, port.pendingOf('createInvoice'), error);
      expect(port.log, ['getOverview', 'createInvoice']);
    });

    testWidgets('Xem hoá đơn left while the invoice loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingInvoicesPort(details: [demoInvoiceDetail()])..held.add('getInvoice');
      await tester.pumpWidget(_host(InvoiceDetailScreen(port: port, orderId: 'DH-2048', invoiceId: 'invoice-1')));
      expect(port.log, ['getInvoice']);
      await _leaveThenAnswer(tester, port.pendingOf('getInvoice'), error);
    });

    testWidgets('Xem hoá đơn left while the PDF is exported, then the port $outcome ⇒ no crash, no share',
        (tester) async {
      _tall(tester);
      final port = RecordingInvoicesPort(details: [demoInvoiceDetail()])..held.add('exportInvoicePdf');
      final share = RecordingShare();
      await tester.pumpWidget(_host(
          InvoiceDetailScreen(port: port, orderId: 'DH-2048', invoiceId: 'invoice-1', shareImpl: share.call)));
      await tester.pumpAndSettle();
      await _tap(tester, find.widgetWithText(AppButton, 'Xuất PDF'));
      expect(port.log, ['getInvoice', 'exportInvoicePdf']);
      await _leaveThenAnswer(tester, port.pendingOf('exportInvoicePdf'), error);
      expect(share.calls, isEmpty);
    });
  }
}
