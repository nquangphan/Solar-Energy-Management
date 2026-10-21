// hand-authored — widget test for the Hoá đơn bán hàng screen (Story 7.4).
//
// Everything goes through the REAL screen with the fake port: the source frame,
// blocked / already-invoiced banners, the confirm dialog, the in-flight guard, the
// server-message banner, the list and the load states, plus the longest labels at
// 320/360px.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_invoices_port.dart';
import 'package:pns_mobile/design_system/session/invoices_port.dart';
import 'package:pns_mobile/screens/invoices/invoices_screen.dart';

const String _kOrderId = 'DH-2048';
const String _kBlocked = 'Đơn chưa có dòng vật tư — không tạo hoá đơn được.';
const String _kInfo =
    'Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).';

final InvoiceSummary _existing = InvoiceSummary(
  id: 'inv-old',
  invoiceNo: 'HD-2026-0007',
  versionNo: 2,
  // 2026-10-21 18:30 UTC is already 22/10 in Vietnam.
  issuedAt: DateTime.utc(2026, 10, 21, 18, 30),
  customerName: 'VP Công Chứng Lê Đình Thao',
  customerTaxCode: '0316552018',
  vatRate: 8,
  applyVat: true,
  subtotal: 76862000,
  discountAmount: 0,
  vatAmount: 6148960,
  total: 83010960,
  lineCount: 4,
);

class _GatedPort extends FakeInvoicesPort {
  final Completer<void> gate = Completer<void>();

  @override
  Future<InvoiceSummary> createInvoice(String orderId) async {
    createCalls.add(orderId);
    await gate.future;
    return _existing;
  }
}

class _PendingPort extends FakeInvoicesPort {
  _PendingPort(this._future);

  final Future<InvoicesOverview> _future;

  @override
  Future<InvoicesOverview> getOverview(String orderId) => _future;
}

void _screen(WidgetTester tester, [double width = 400.0]) {
  tester.view.physicalSize = Size(width, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Future<void> _pump(WidgetTester tester, InvoicesPort port) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: InvoicesScreen(port: port, orderId: _kOrderId),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

/// Opens the confirm dialog from the primary button.
Future<void> _openDialog(WidgetTester tester) =>
    _tap(tester, find.widgetWithText(AppButton, 'Tạo hoá đơn'));

Finder _dialogConfirm() => find.descendant(
      of: find.byType(AppConfirmDialog),
      matching: find.text('Tạo hoá đơn'),
    );

void main() {
  testWidgets('source frame shows snapshot version, customer, MST and total',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, FakeInvoicesPort());

    expect(find.text('Hoá đơn bán hàng'), findsOneWidget);
    expect(find.text('HOÁ ĐƠN'), findsOneWidget);
    expect(find.text('Tạo hoá đơn từ đơn'.toUpperCase()), findsOneWidget);
    for (final String label in <String>[
      'Nguồn',
      'Khách hàng',
      'MST khách',
      'Tổng tiền',
      'Số HĐ nội bộ',
    ]) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('Bản 1 (snapshot)'), findsOneWidget);
    expect(find.text('VP Công Chứng Lê Đình Thao'), findsOneWidget);
    expect(find.text('0316552018'), findsOneWidget);
    expect(find.text('Tự cấp khi tạo'), findsOneWidget);
    final MoneyText total =
        tester.widget<MoneyText>(find.byType(MoneyText).first);
    expect(total.value, 83010960);
    expect(find.text('83.010.960 đ'), findsOneWidget);
    expect(find.text(_kInfo), findsOneWidget);
  });

  testWidgets('no tax code ⇒ "Không có MST"', (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, FakeInvoicesPort(customerTaxCode: null));
    expect(find.text('Không có MST'), findsOneWidget);
  });

  testWidgets('creatable false ⇒ blockedReason banner and no button',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(
        tester, FakeInvoicesPort(creatable: false, blockedReason: _kBlocked));
    expect(find.text(_kBlocked), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Tạo hoá đơn'), findsNothing);
  });

  testWidgets('current invoice ⇒ banner with its number and no button',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(
      tester,
      FakeInvoicesPort(
        creatable: false,
        currentInvoiceId: 'inv-old',
        initial: <InvoiceSummary>[_existing],
      ),
    );
    expect(find.text('Bản đơn hiện hành đã có hoá đơn HD-2026-0007.'),
        findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Tạo hoá đơn'), findsNothing);
  });

  testWidgets('tap ⇒ confirm dialog with the snapshot version',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = FakeInvoicesPort();
    await _pump(tester, port);

    await _openDialog(tester);

    expect(find.text('Tạo hoá đơn?'), findsOneWidget);
    expect(
      find.text(
          'Hoá đơn chụp lại bản 1 của đơn và không sửa được sau khi tạo.'),
      findsOneWidget,
    );
    expect(find.text('Huỷ'), findsOneWidget);
    expect(port.createCalls, isEmpty);
  });

  testWidgets('Huỷ ⇒ zero create calls', (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = FakeInvoicesPort();
    await _pump(tester, port);

    await _openDialog(tester);
    await _tap(tester, find.text('Huỷ'));

    expect(port.createCalls, isEmpty);
    expect(find.byType(AppConfirmDialog), findsNothing);
  });

  testWidgets('confirm ⇒ one create call, reload, list shows the new invoice',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = FakeInvoicesPort();
    await _pump(tester, port);
    expect(find.text('Chưa tạo hoá đơn nào.'), findsOneWidget);

    await _openDialog(tester);
    await _tap(tester, _dialogConfirm());

    expect(port.createCalls, <String>[_kOrderId]);
    expect(port.overviewCalls.length, 2);
    expect(find.text('Chưa tạo hoá đơn nào.'), findsNothing);
    expect(find.text('HD-2026-0001 · Bản 1 · 22/10/2026'), findsOneWidget);
    expect(find.text('Bản đơn hiện hành đã có hoá đơn HD-2026-0001.'),
        findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Tạo hoá đơn'), findsNothing);
  });

  testWidgets('double confirm tap in flight ⇒ one create call',
      (WidgetTester tester) async {
    _screen(tester);
    final _GatedPort port = _GatedPort();
    await _pump(tester, port);

    await _openDialog(tester);
    await tester.tap(_dialogConfirm());
    await tester.pump();
    await tester.tap(_dialogConfirm(), warnIfMissed: false);
    await tester.pump();

    expect(port.createCalls.length, 1);
    // The page button is disabled while the call is in flight.
    expect(
      tester
          .widget<AppButton>(
              find.widgetWithText(AppButton, 'Tạo hoá đơn').first)
          .onPressed,
      isNull,
    );
    port.gate.complete();
    await tester.pumpAndSettle();
    expect(port.createCalls.length, 1);
  });

  testWidgets('409 ⇒ server message verbatim and overview reloaded',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = FakeInvoicesPort(
      createError: const InvoicesPortError(
          status: 409, message: 'Bản đơn hiện hành đã có hoá đơn.'),
    );
    await _pump(tester, port);

    await _openDialog(tester);
    await _tap(tester, _dialogConfirm());

    expect(find.text('Bản đơn hiện hành đã có hoá đơn.'), findsOneWidget);
    expect(port.overviewCalls.length, 2);
    expect(find.widgetWithText(AppButton, 'Tạo hoá đơn'), findsOneWidget);
  });

  testWidgets('non-envelope error ⇒ Vietnamese fallback',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port =
        FakeInvoicesPort(createError: StateError('boom'));
    await _pump(tester, port);

    await _openDialog(tester);
    await _tap(tester, _dialogConfirm());

    expect(
        find.text('Không tạo được hoá đơn. Vui lòng thử lại.'), findsOneWidget);
  });

  testWidgets(
      'lost response whose invoice was created ⇒ reload shows it, no failure banner',
      (WidgetTester tester) async {
    _screen(tester);
    final _LostResponsePort port = _LostResponsePort();
    await _pump(tester, port);

    await _openDialog(tester);
    await _tap(tester, _dialogConfirm());

    expect(find.text('Bản đơn hiện hành đã có hoá đơn HD-2026-0001.'),
        findsOneWidget);
    expect(
        find.text('Không tạo được hoá đơn. Vui lòng thử lại.'), findsNothing);
  });

  testWidgets('failed reload after a failed create keeps the last good view',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port = FakeInvoicesPort(
      createError:
          const InvoicesPortError(status: 400, message: 'Lỗi dữ liệu.'),
    );
    await _pump(tester, port);

    await _openDialog(tester);
    port.overviewError = StateError('down');
    await _tap(tester, _dialogConfirm());

    expect(find.text('Lỗi dữ liệu.'), findsOneWidget);
    expect(find.text('Bản 1 (snapshot)'), findsOneWidget);
    expect(find.text('Thử lại'), findsNothing);
  });

  testWidgets('list line shows number · version · UTC+7 date and the total',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(
      tester,
      FakeInvoicesPort(
        creatable: false,
        currentInvoiceId: 'inv-old',
        initial: <InvoiceSummary>[_existing],
      ),
    );
    expect(find.text('Hoá đơn đã tạo'.toUpperCase()), findsOneWidget);
    expect(find.text('HD-2026-0007 · Bản 2 · 22/10/2026'), findsOneWidget);
    // Source frame total + list total.
    expect(find.byType(MoneyText), findsNWidgets(2));
  });

  testWidgets('loading ⇒ skeleton', (WidgetTester tester) async {
    _screen(tester);
    final Completer<InvoicesOverview> never = Completer<InvoicesOverview>();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: InvoicesScreen(
              port: _PendingPort(never.future), orderId: _kOrderId),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(AppSkeleton), findsWidgets);
    expect(find.widgetWithText(AppButton, 'Tạo hoá đơn'), findsNothing);
  });

  testWidgets('load error ⇒ error state, "Thử lại" reloads',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeInvoicesPort port =
        FakeInvoicesPort(overviewError: StateError('down'));
    await _pump(tester, port);
    expect(find.text('Thử lại'), findsOneWidget);

    port.overviewError = null;
    await _tap(tester, find.text('Thử lại'));

    expect(port.overviewCalls.length, 2);
    expect(find.widgetWithText(AppButton, 'Tạo hoá đơn'), findsOneWidget);
  });

  for (final double width in <double>[320.0, 360.0]) {
    final InvoiceSummary longInvoice = InvoiceSummary(
      id: 'inv-long',
      invoiceNo: 'HD-2026-123456',
      versionNo: 12,
      issuedAt: DateTime.utc(2026, 10, 21, 18, 30),
      customerName: 'N' * 80,
      vatRate: 8,
      applyVat: true,
      subtotal: 76862000,
      discountAmount: 0,
      vatAmount: 6148960,
      total: 83010960,
      lineCount: 4,
    );

    testWidgets('longest labels do not overflow at ${width.toInt()}px',
        (WidgetTester tester) async {
      _screen(tester, width);
      await _pump(
        tester,
        FakeInvoicesPort(
          customerName: 'N' * 80,
          initial: <InvoiceSummary>[longInvoice],
        ),
      );
      expect(tester.takeException(), isNull);

      await _openDialog(tester);
      expect(tester.takeException(), isNull);
    });

    testWidgets(
        'blocked reason and current-invoice banners fit at '
        '${width.toInt()}px', (WidgetTester tester) async {
      _screen(tester, width);
      await _pump(
        tester,
        FakeInvoicesPort(
          customerName: 'N' * 80,
          creatable: false,
          blockedReason: _kBlocked,
          currentInvoiceId: 'inv-long',
          initial: <InvoiceSummary>[longInvoice],
        ),
      );
      expect(find.text(_kBlocked), findsOneWidget);
      expect(find.text(_kInfo), findsOneWidget);
      expect(
        find.text('Bản đơn hiện hành đã có hoá đơn HD-2026-123456.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  }
}

/// Creates the invoice, then loses the response (a non-envelope error).
class _LostResponsePort extends FakeInvoicesPort {
  @override
  Future<InvoiceSummary> createInvoice(String orderId) async {
    await super.createInvoice(orderId);
    throw StateError('connection reset');
  }
}
