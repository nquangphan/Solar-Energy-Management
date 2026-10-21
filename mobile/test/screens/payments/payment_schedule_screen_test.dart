// hand-authored — widget test for the Lịch thanh toán screen (Story 7.1).
//
// Everything goes through the REAL screen with ports: the configured / empty /
// mismatch views, the templates, what is actually SENT (blank number ⇒ key
// absent, typed "0" ⇒ 0), server field errors landing under the right row, the
// 409 path, permission and `editable` gating, the double-submit guard, and the
// longest labels at 320/360px. Payment recording: the debt block, per-installment
// status, the "Ghi nhận" gate (`recordable` AND payments.record), the confirm
// dialog before any call, the idempotency key kept across retries and renewed
// per opened form, outcome banners, field errors, 409, double submit.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/gating/app_permissions.dart';
import 'package:pns_mobile/design_system/session/fake_payments_port.dart';
import 'package:pns_mobile/design_system/session/payments_port.dart';
import 'package:pns_mobile/screens/payments/payment_schedule_screen.dart';

const Set<PermissionKey> _kCanRecord = <PermissionKey>{
  AppPermissionKeys.paymentsRecord,
};

/// Holds every replace call open until [gate] completes.
class _GatedPort extends FakePaymentsPort {
  _GatedPort() : super(initial: demoPaymentScheduleEmpty);

  final Completer<PaymentSchedule> gate = Completer<PaymentSchedule>();

  @override
  Future<PaymentSchedule> replaceSchedule(
    String orderId,
    ReplacePaymentScheduleInput input,
  ) {
    replaceCalls.add(input);
    return gate.future;
  }
}

Widget _host(
  PaymentsPort port, {
  Set<PermissionKey> perms = _kCanRecord,
  ValueChanged<String>? onOrderStatusChanged,
  String Function()? newKey,
}) =>
    MaterialApp(
      home: Scaffold(
        body: PaymentScheduleScreen(
          port: port,
          orderId: 'DH-2048',
          perms: perms,
          onOrderStatusChanged: onOrderStatusChanged,
          newKey: newKey ?? _keys(),
        ),
      ),
    );

/// Deterministic keys: key-1, key-2, … one per opened form.
String Function() _keys() {
  int n = 0;
  return () => 'key-${++n}';
}

/// [base] with a different `recordable`.
PaymentSchedule _withRecordable(PaymentSchedule s,
        {required bool recordable}) =>
    PaymentSchedule(
      orderId: s.orderId,
      configured: s.configured,
      editable: s.editable,
      orderTotal: s.orderTotal,
      scheduledTotal: s.scheduledTotal,
      difference: s.difference,
      totalMatches: s.totalMatches,
      paidTotal: s.paidTotal,
      remainingTotal: s.remainingTotal,
      paidPercent: s.paidPercent,
      paymentStatus: s.paymentStatus,
      recordable: recordable,
      installments: s.installments,
      updatedAt: s.updatedAt,
    );

void _screen(WidgetTester tester, [double width = 400.0]) {
  tester.view.physicalSize = Size(width, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

/// The text input of the `AppField` with [label] on row [row] (`AppField` paints
/// its label upper-cased).
Finder _input(String label, [int row = 0]) => find
    .descendant(
      of: find.widgetWithText(AppField, label.toUpperCase()).at(row),
      matching: find.byType(EditableText),
    )
    .first;

Map<String, Object> _json(ReplacePaymentScheduleInput i) => i.toJson();

PaymentSchedule _withEditable(PaymentSchedule s, {required bool editable}) =>
    PaymentSchedule(
      orderId: s.orderId,
      configured: s.configured,
      editable: editable,
      orderTotal: s.orderTotal,
      scheduledTotal: s.scheduledTotal,
      difference: s.difference,
      totalMatches: s.totalMatches,
      paidTotal: s.paidTotal,
      remainingTotal: s.remainingTotal,
      paidPercent: s.paidPercent,
      paymentStatus: s.paymentStatus,
      recordable: s.recordable,
      installments: s.installments,
      updatedAt: s.updatedAt,
    );

void main() {
  testWidgets('configured view: labels, milestones, formatted money, totals',
      (WidgetTester tester) async {
    _screen(tester);
    await tester.pumpWidget(
        _host(FakePaymentsPort(initial: demoPaymentScheduleConfigured)));
    await tester.pumpAndSettle();

    expect(find.text('Lịch thanh toán'), findsOneWidget);
    for (final String h in <String>['ĐỢT', 'ĐIỀU KIỆN', 'TỈ LỆ', 'SỐ TIỀN']) {
      expect(find.text(h), findsOneWidget);
    }
    expect(find.text('Đợt 1 · Cọc'), findsNWidgets(2));
    expect(find.text('Đợt 2'), findsNWidgets(2));
    expect(find.text('Đợt 3 · Tất toán'), findsNWidgets(2));
    expect(find.text('20%'), findsOneWidget);
    expect(find.text('Khi thi công'), findsOneWidget);
    expect(find.text('16.602.192 đ'), findsOneWidget);
    expect(find.text('58.107.672 đ'), findsOneWidget);
    expect(find.text('8.301.096 đ'), findsOneWidget);
    expect(find.text('Tổng lịch'), findsOneWidget);
    expect(find.text('Tổng đơn (sau VAT)'), findsOneWidget);
    // Schedule total, order total after VAT, and the debt block's remaining and
    // order total (nothing paid yet).
    expect(find.text('83.010.960 đ'), findsNWidgets(4));
    expect(find.text('Tổng các đợt lệch tổng đơn sau VAT'), findsNothing);
    expect(find.text('Sửa lịch'), findsOneWidget);
    expect(find.text('Ghi nhận'), findsNWidgets(3));
  });

  testWidgets('an amount-typed installment shows "—" for the percent',
      (WidgetTester tester) async {
    _screen(tester);
    const PaymentSchedule s = PaymentSchedule(
      orderId: 'DH-2048',
      configured: true,
      editable: true,
      orderTotal: 1000,
      scheduledTotal: 1000,
      difference: 0,
      totalMatches: true,
      paidTotal: 0,
      remainingTotal: 1000,
      paidPercent: 0,
      paymentStatus: 'unpaid',
      recordable: true,
      installments: <Installment>[
        Installment(
          id: 'i1',
          seq: 1,
          amount: 1000,
          conditionNote: 'Một lần',
          milestone: 'coc',
          paidAmount: 0,
          remainingAmount: 1000,
          status: 'unpaid',
          payments: <Payment>[],
        ),
      ],
    );
    await tester.pumpWidget(_host(FakePaymentsPort(initial: s)));
    await tester.pumpAndSettle();
    expect(find.text('—'), findsOneWidget);
  });

  testWidgets('empty state with "Cấu hình lịch"', (WidgetTester tester) async {
    _screen(tester);
    await tester.pumpWidget(_host(FakePaymentsPort()));
    await tester.pumpAndSettle();

    expect(find.text('Đơn chưa có lịch thanh toán.'), findsOneWidget);
    expect(find.text('Cấu hình lịch'), findsOneWidget);
    expect(find.text('Tổng các đợt lệch tổng đơn sau VAT'), findsNothing);
  });

  testWidgets('mismatch banner carries the difference via MoneyText',
      (WidgetTester tester) async {
    _screen(tester);
    await tester.pumpWidget(
        _host(FakePaymentsPort(initial: demoPaymentScheduleMismatch)));
    await tester.pumpAndSettle();

    expect(find.text('Tổng các đợt lệch tổng đơn sau VAT'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(AppBanner),
        matching: find.text('8.301.096 đ'),
      ),
      findsOneWidget,
    );
    expect(find.text('74.709.864 đ'), findsOneWidget);
  });

  testWidgets('load failure shows the error state and "Thử lại" reloads',
      (WidgetTester tester) async {
    _screen(tester);
    final _FlakyPort port = _FlakyPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    expect(find.text('Không tải được lịch thanh toán.'), findsOneWidget);

    await _tap(tester, find.text('Thử lại'));
    expect(find.text('Đợt 1 · Cọc'), findsNWidgets(2));
    expect(port.calls, 2);
  });

  testWidgets('template 20/70/10 then save sends exactly three percent rows',
      (WidgetTester tester) async {
    _screen(tester);
    final FakePaymentsPort port = FakePaymentsPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Cấu hình lịch'));
    await _tap(tester, find.text('20/70/10'));
    await _tap(tester, find.text('Lưu lịch'));

    expect(port.replaceCalls, hasLength(1));
    expect(_json(port.replaceCalls.single), <String, Object>{
      'installments': <Map<String, Object>>[
        <String, Object>{'percent': 20, 'conditionNote': 'Cọc khi ký hợp đồng'},
        <String, Object>{'percent': 70, 'conditionNote': 'Khi thi công'},
        <String, Object>{
          'percent': 10,
          'conditionNote': 'Khi nghiệm thu, bàn giao',
        },
      ],
    });
    // Back to view mode with the RETURNED schedule.
    expect(find.text('Lưu lịch'), findsNothing);
    expect(find.text('Đợt 3 · Tất toán'), findsNWidgets(2));
    expect(find.text('Sửa lịch'), findsOneWidget);
  });

  testWidgets('template 100% fills one row', (WidgetTester tester) async {
    _screen(tester);
    final FakePaymentsPort port = FakePaymentsPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Cấu hình lịch'));
    await _tap(tester, find.text('100%'));
    await _tap(tester, find.text('Lưu lịch'));

    expect(_json(port.replaceCalls.single), <String, Object>{
      'installments': <Map<String, Object>>[
        <String, Object>{'percent': 100, 'conditionNote': 'Thanh toán toàn bộ'},
      ],
    });
  });

  testWidgets('a response that mismatches is shown with the banner after save',
      (WidgetTester tester) async {
    _screen(tester);
    final FakePaymentsPort port =
        FakePaymentsPort(replyToReplace: demoPaymentScheduleMismatch);
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Cấu hình lịch'));
    await _tap(tester, find.text('Lưu lịch'));
    expect(find.text('Tổng các đợt lệch tổng đơn sau VAT'), findsOneWidget);
  });

  testWidgets('blank number ⇒ the key is ABSENT from the payload',
      (WidgetTester tester) async {
    _screen(tester);
    final FakePaymentsPort port = FakePaymentsPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Cấu hình lịch'));
    await tester.enterText(_input('Điều kiện'), 'Cọc');
    await _tap(tester, find.text('Lưu lịch'));

    final Map<String, Object> row =
        (_json(port.replaceCalls.single)['installments']! as List<Object>)
            .single as Map<String, Object>;
    expect(row.containsKey('percent'), isFalse);
    expect(row.containsKey('amount'), isFalse);
    expect(row['conditionNote'], 'Cọc');
  });

  testWidgets('typed "0" is sent as 0, in either kind',
      (WidgetTester tester) async {
    _screen(tester);
    final FakePaymentsPort port = FakePaymentsPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Cấu hình lịch'));
    await tester.enterText(_input('Tỉ lệ (%)'), '0');
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Lưu lịch'));

    // The first save already left edit mode (canned reply); edit again as amount.
    await _tap(tester, find.text('Sửa lịch'));
    await _tap(tester, find.text('Số tiền').first);
    await tester.enterText(_input('Số tiền (đồng)'), '0');
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Lưu lịch'));

    final List<Object> first =
        _json(port.replaceCalls[0])['installments']! as List<Object>;
    expect((first.single as Map<String, Object>)['percent'], 0);
    final List<Object> second =
        _json(port.replaceCalls[1])['installments']! as List<Object>;
    final Map<String, Object> amountRow = second.first as Map<String, Object>;
    expect(amountRow['amount'], 0);
    expect(amountRow.containsKey('percent'), isFalse);
  });

  testWidgets('"Tuỳ chỉnh" keeps the rows being edited',
      (WidgetTester tester) async {
    _screen(tester);
    await tester.pumpWidget(_host(FakePaymentsPort()));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Cấu hình lịch'));
    await _tap(tester, find.text('20/70/10'));
    await tester.enterText(_input('Tỉ lệ (%)', 1), '65');
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Tuỳ chỉnh'));

    String text(String label, int row) =>
        tester.widget<EditableText>(_input(label, row)).controller.text;
    expect(<String>[for (int r = 0; r < 3; r++) text('Tỉ lệ (%)', r)],
        <String>['20', '65', '10']);
    expect(text('Điều kiện', 2), 'Khi nghiệm thu, bàn giao');
  });

  testWidgets('number inputs keep digits only', (WidgetTester tester) async {
    _screen(tester);
    await tester.pumpWidget(_host(FakePaymentsPort()));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Cấu hình lịch'));
    await tester.enterText(_input('Tỉ lệ (%)'), 'a1b2.5');
    await tester.pumpAndSettle();
    expect(
      tester.widget<EditableText>(_input('Tỉ lệ (%)')).controller.text,
      '125',
    );
  });

  testWidgets('editing a configured schedule prefills percent and amount rows',
      (WidgetTester tester) async {
    _screen(tester);
    const PaymentSchedule mixed = PaymentSchedule(
      orderId: 'DH-2048',
      configured: true,
      editable: true,
      orderTotal: 100,
      scheduledTotal: 100,
      difference: 0,
      totalMatches: true,
      paidTotal: 0,
      remainingTotal: 100,
      paidPercent: 0,
      paymentStatus: 'unpaid',
      recordable: true,
      installments: <Installment>[
        Installment(
          id: 'i1',
          seq: 1,
          percent: 40,
          amount: 40,
          conditionNote: 'A',
          paidAmount: 0,
          remainingAmount: 40,
          status: 'unpaid',
          payments: <Payment>[],
        ),
        Installment(
          id: 'i2',
          seq: 2,
          amount: 60,
          conditionNote: 'B',
          paidAmount: 0,
          remainingAmount: 60,
          status: 'unpaid',
          payments: <Payment>[],
        ),
      ],
    );
    await tester.pumpWidget(_host(FakePaymentsPort(initial: mixed)));
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Sửa lịch'));
    expect(
      tester.widget<EditableText>(_input('Tỉ lệ (%)')).controller.text,
      '40',
    );
    expect(
      tester.widget<EditableText>(_input('Số tiền (đồng)')).controller.text,
      '60',
    );
    expect(tester.widget<EditableText>(_input('Điều kiện', 1)).controller.text,
        'B');
  });

  testWidgets('add row stops at 12 and delete stops at 1',
      (WidgetTester tester) async {
    _screen(tester);
    await tester.pumpWidget(_host(FakePaymentsPort()));
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Cấu hình lịch'));

    AppButton button(String label) =>
        tester.widget<AppButton>(find.widgetWithText(AppButton, label).first);
    expect(button('Xoá đợt').onPressed, isNull);

    for (int i = 0; i < 11; i++) {
      await _tap(tester, find.text('Thêm đợt'));
    }
    expect(find.text('Xoá đợt'), findsNWidgets(12));
    expect(button('Thêm đợt').onPressed, isNull);

    await _tap(tester, find.text('Xoá đợt').first);
    expect(find.text('Xoá đợt'), findsNWidgets(11));
    expect(button('Thêm đợt').onPressed, isNotNull);
  });

  testWidgets('400 fieldErrors land under the right row and field',
      (WidgetTester tester) async {
    _screen(tester);
    final FakePaymentsPort port = FakePaymentsPort(
      replyToReplace: const PaymentsPortError(
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        fieldErrors: <FieldError>[
          FieldError(
            field: 'installments.1.percent',
            code: 'INVALID',
            message: 'Tỉ lệ phải từ 1 đến 100',
          ),
          FieldError(
            field: 'installments.2.conditionNote',
            code: 'REQUIRED',
            message: 'Nhập điều kiện',
          ),
          FieldError(
            field: 'installments',
            code: 'TOO_MANY',
            message: 'Tối đa 12 đợt',
          ),
        ],
      ),
    );
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Cấu hình lịch'));
    await _tap(tester, find.text('20/70/10'));
    await _tap(tester, find.text('Lưu lịch'));

    Finder inRow(int row, String text) => find.descendant(
        of: find.byType(AppCard).at(row), matching: find.text(text));
    expect(inRow(1, 'Tỉ lệ phải từ 1 đến 100'), findsOneWidget);
    expect(inRow(2, 'Nhập điều kiện'), findsOneWidget);
    expect(inRow(0, 'Tỉ lệ phải từ 1 đến 100'), findsNothing);
    expect(inRow(0, 'Nhập điều kiện'), findsNothing);
    expect(find.text('Tối đa 12 đợt'), findsOneWidget);
    // Still in edit mode, save enabled again.
    expect(find.text('Lưu lịch'), findsOneWidget);
  });

  testWidgets('409 shows the server message and "Tải lại" reloads out of edit',
      (WidgetTester tester) async {
    _screen(tester);
    final FakePaymentsPort port = FakePaymentsPort(
      replyToReplace: const PaymentsPortError(
        code: 'CONFLICT',
        message: 'Đơn đã đổi, hãy tải lại.',
      ),
    );
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Cấu hình lịch'));
    await _tap(tester, find.text('Lưu lịch'));

    expect(find.text('Đơn đã đổi, hãy tải lại.'), findsOneWidget);
    expect(find.text('Tải lại'), findsOneWidget);

    await _tap(tester, find.text('Tải lại'));
    expect(find.text('Lưu lịch'), findsNothing);
    expect(find.text('Đơn đã đổi, hãy tải lại.'), findsNothing);
    expect(find.text('Đơn chưa có lịch thanh toán.'), findsOneWidget);
  });

  group('edit button gating', () {
    testWidgets('control: editable + paymentsRecord ⇒ shown',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(
          _host(FakePaymentsPort(initial: demoPaymentScheduleConfigured)));
      await tester.pumpAndSettle();
      expect(find.text('Sửa lịch'), findsOneWidget);
    });

    testWidgets('editable but without paymentsRecord ⇒ absent',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(_host(
        FakePaymentsPort(initial: demoPaymentScheduleConfigured),
        perms: const <PermissionKey>{},
      ));
      await tester.pumpAndSettle();
      expect(find.text('Đợt 1 · Cọc'), findsNWidgets(2));
      expect(find.text('Sửa lịch'), findsNothing);
    });

    testWidgets('paymentsRecord but editable=false ⇒ absent',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(_host(FakePaymentsPort(
        initial: _withEditable(demoPaymentScheduleConfigured, editable: false),
      )));
      await tester.pumpAndSettle();
      expect(find.text('Đợt 1 · Cọc'), findsNWidgets(2));
      expect(find.text('Sửa lịch'), findsNothing);
    });

    testWidgets('empty state without paymentsRecord ⇒ no "Cấu hình lịch"',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(
          _host(FakePaymentsPort(), perms: const <PermissionKey>{}));
      await tester.pumpAndSettle();
      expect(find.text('Đơn chưa có lịch thanh toán.'), findsOneWidget);
      expect(find.text('Cấu hình lịch'), findsNothing);
    });

    testWidgets('empty state with editable=false ⇒ no "Cấu hình lịch"',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(_host(FakePaymentsPort(
        initial: _withEditable(demoPaymentScheduleEmpty, editable: false),
      )));
      await tester.pumpAndSettle();
      expect(find.text('Đơn chưa có lịch thanh toán.'), findsOneWidget);
      expect(find.text('Cấu hình lịch'), findsNothing);
    });
  });

  testWidgets('double submit: two taps reach the port once',
      (WidgetTester tester) async {
    _screen(tester);
    final _GatedPort port = _GatedPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Cấu hình lịch'));
    await _tap(tester, find.text('20/70/10'));

    await _tap(tester, find.text('Lưu lịch'));
    expect(find.text('Đang lưu…'), findsOneWidget);
    expect(
      tester
          .widget<AppButton>(find.widgetWithText(AppButton, 'Đang lưu…'))
          .onPressed,
      isNull,
    );
    await tester.tap(find.text('Đang lưu…'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(port.replaceCalls, hasLength(1));

    port.gate.complete(demoPaymentScheduleConfigured);
    await tester.pumpAndSettle();
    expect(find.text('Đợt 1 · Cọc'), findsNWidgets(2));
  });

  group('record a payment', () {
    Future<void> openForm(WidgetTester tester, [int index = 0]) async {
      await _tap(tester, find.text('Ghi nhận').at(index));
    }

    Future<void> confirm(WidgetTester tester, int seq) async {
      await _tap(tester, find.text('Ghi nhận đợt $seq'));
      await _tap(
        tester,
        find.descendant(
          of: find.byType(AppConfirmDialog),
          matching: find.text('Ghi nhận'),
        ),
      );
    }

    testWidgets(
        'debt block, status chips and payment lines come from the backend',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(
          _host(FakePaymentsPort(initial: demoPaymentScheduleDepositPaid)));
      await tester.pumpAndSettle();
      expect(find.text('TIẾN ĐỘ CÔNG NỢ'), findsOneWidget);
      expect(find.text('Đã thu'), findsNWidgets(2)); // debt row + chip
      expect(find.text('66.408.768 đ'), findsOneWidget);
      expect(find.text('20% / 100%'), findsOneWidget);
      expect(find.text('Còn lại'), findsOneWidget);
      expect(find.text('Tổng đơn'), findsOneWidget);
      expect(find.text('Chưa thu'), findsNWidgets(2));
      expect(find.text('Thu 02/07 · Chuyển khoản ·'), findsOneWidget);
      // the paid deposit has no button, the two unpaid ones do
      expect(find.text('Ghi nhận'), findsNWidgets(2));
    });

    testWidgets('no "Ghi nhận" without payments.record (recordable, unpaid)',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(_host(
        FakePaymentsPort(initial: demoPaymentScheduleConfigured),
        perms: const <PermissionKey>{},
      ));
      await tester.pumpAndSettle();
      expect(find.text('Chưa thu'), findsNWidgets(3));
      expect(find.text('Ghi nhận'), findsNothing);
    });

    testWidgets('no "Ghi nhận" when recordable=false (with permission, unpaid)',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(_host(FakePaymentsPort(
        initial:
            _withRecordable(demoPaymentScheduleConfigured, recordable: false),
      )));
      await tester.pumpAndSettle();
      expect(find.text('Chưa thu'), findsNWidgets(3));
      expect(find.text('Ghi nhận'), findsNothing);
    });

    testWidgets(
        'form prefills remaining + today + transfer; cancelling the dialog sends nothing',
        (WidgetTester tester) async {
      _screen(tester);
      final FakePaymentsPort port =
          FakePaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      expect(find.text('GHI NHẬN THANH TOÁN · ĐỢT 1'), findsOneWidget);
      expect(
        tester.widget<EditableText>(_input('Số tiền thu')).controller.text,
        '16602192',
      );
      expect(
        tester.widget<EditableText>(_input('Ngày thu')).controller.text,
        matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')),
      );
      expect(
        tester
            .widget<AppButton>(find.widgetWithText(AppButton, 'Chuyển khoản'))
            .variant,
        AppButtonVariant.primary,
      );

      await _tap(tester, find.text('Ghi nhận đợt 1'));
      expect(
        find.text(
            'Ghi nhận 16.602.192 đ cho Đợt 1?\nKhi đủ đợt cọc, đơn sẽ tự chuyển sang Đã cọc.'),
        findsOneWidget,
      );
      await _tap(
        tester,
        find.descendant(
          of: find.byType(AppConfirmDialog),
          matching: find.text('Huỷ'),
        ),
      );
      expect(find.byType(AppConfirmDialog), findsNothing);
      expect(port.recordCalls, isEmpty);
    });

    testWidgets(
        'a non-deposit installment: the dialog never promises the Đã cọc move',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(
          _host(FakePaymentsPort(initial: demoPaymentScheduleConfigured)));
      await tester.pumpAndSettle();
      await openForm(tester, 1);
      await _tap(tester, find.text('Ghi nhận đợt 2'));
      expect(find.byType(AppConfirmDialog), findsOneWidget);
      expect(find.text('Ghi nhận 58.107.672 đ cho Đợt 2?'), findsOneWidget);
      expect(find.textContaining('Khi đủ đợt cọc'), findsNothing);
    });

    testWidgets(
        'confirm sends exactly the form, shows the applied banner, reports the status',
        (WidgetTester tester) async {
      _screen(tester);
      final List<String> reported = <String>[];
      final FakePaymentsPort port =
          FakePaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(port, onOrderStatusChanged: reported.add));
      await tester.pumpAndSettle();
      await openForm(tester);
      await _tap(tester, find.text('Tiền mặt'));
      await tester.enterText(_input('Ghi chú'), 'Khách đưa tại công trình');
      final String paidOn =
          tester.widget<EditableText>(_input('Ngày thu')).controller.text;
      await confirm(tester, 1);

      expect(
          port.recordCalls.map((RecordPaymentInput c) => c.toJson()),
          <Map<String, Object>>[
            <String, Object>{
              'idempotencyKey': 'key-1',
              'installmentId': 'inst-1',
              'amount': 16602192,
              'paidOn': paidOn,
              'method': 'cash',
              'note': 'Khách đưa tại công trình',
            },
          ]);
      expect(find.text('Đơn đã chuyển sang Đã cọc.'), findsOneWidget);
      expect(find.text('GHI NHẬN THANH TOÁN · ĐỢT 1'), findsNothing);
      expect(find.text('Thu 02/07 · Chuyển khoản ·'), findsOneWidget);
      expect(reported, <String>['dacoc']);
    });

    testWidgets(
        'retry after a network error keeps the key; a new form gets a new key',
        (WidgetTester tester) async {
      _screen(tester);
      int attempt = 0;
      final FakePaymentsPort port = FakePaymentsPort(
        initial: demoPaymentScheduleConfigured,
        replyToRecord: () async {
          attempt++;
          if (attempt == 1) throw Exception('network down');
          return demoRecordDepositResult;
        },
      );
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await confirm(tester, 1);
      expect(find.text('Không ghi nhận được thanh toán. Vui lòng thử lại.'),
          findsOneWidget);
      await confirm(tester, 1);
      expect(find.text('Đơn đã chuyển sang Đã cọc.'), findsOneWidget);
      await openForm(tester);
      await confirm(tester, 2);
      expect(
        port.recordCalls.map((RecordPaymentInput c) => c.idempotencyKey),
        <String>['key-1', 'key-1', 'key-2'],
      );
    });

    testWidgets(
        'pressing "Ghi nhận" again on the open installment after a network error keeps the form and its key',
        (WidgetTester tester) async {
      _screen(tester);
      int attempt = 0;
      final FakePaymentsPort port = FakePaymentsPort(
        initial: demoPaymentScheduleConfigured,
        replyToRecord: () async {
          attempt++;
          if (attempt == 1) throw Exception('network down');
          return demoRecordDepositResult;
        },
      );
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await tester.enterText(_input('Số tiền thu'), '10000000');
      await tester.pumpAndSettle();
      await confirm(tester, 1);
      expect(find.text('Không ghi nhận được thanh toán. Vui lòng thử lại.'),
          findsOneWidget);
      await openForm(tester);
      expect(
        tester.widget<EditableText>(_input('Số tiền thu')).controller.text,
        '10000000',
      );
      await confirm(tester, 1);
      expect(
        port.recordCalls.map((RecordPaymentInput c) => c.idempotencyKey),
        <String>['key-1', 'key-1'],
      );
    });

    testWidgets(
        'a retry that replays a payment whose response was lost still reports the order status',
        (WidgetTester tester) async {
      _screen(tester);
      final List<String> reported = <String>[];
      int attempt = 0;
      final FakePaymentsPort port = FakePaymentsPort(
        initial: demoPaymentScheduleConfigured,
        replyToRecord: () async {
          attempt++;
          if (attempt == 1) throw Exception('network down');
          return RecordPaymentResult(
            payment: demoRecordDepositResult.payment,
            schedule: demoRecordDepositResult.schedule,
            orderStatus: demoRecordDepositResult.orderStatus,
          );
        },
      );
      await tester.pumpWidget(_host(port, onOrderStatusChanged: reported.add));
      await tester.pumpAndSettle();
      await openForm(tester);
      await confirm(tester, 1);
      expect(reported, isEmpty);
      await confirm(tester, 1);
      expect(reported, <String>['dacoc']);
    });

    testWidgets('an amount too long to be a number disables the button',
        (WidgetTester tester) async {
      _screen(tester);
      final FakePaymentsPort port =
          FakePaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await tester.enterText(_input('Số tiền thu'), '1' * 25);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<AppButton>(find.widgetWithText(AppButton, 'Ghi nhận đợt 1'))
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('the note is capped at 200 characters as it is typed',
        (WidgetTester tester) async {
      _screen(tester);
      final FakePaymentsPort port =
          FakePaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await tester.enterText(_input('Ghi chú'), 'a' * 250);
      await tester.pumpAndSettle();
      await confirm(tester, 1);
      expect(port.recordCalls.single.note, 'a' * 200);
    });

    test('the fake refuses a used key with another payload, like the backend',
        () async {
      final FakePaymentsPort port =
          FakePaymentsPort(initial: demoPaymentScheduleConfigured);
      RecordPaymentInput input(int amount) => RecordPaymentInput(
            idempotencyKey: 'key-x',
            installmentId: demoPaymentScheduleConfigured.installments[0].id,
            amount: amount,
            paidOn: '2026-10-21',
            method: 'bank_transfer',
          );
      await port.recordPayment('DH-2048', input(1000));
      expect(
        (await port.recordPayment('DH-2048', input(1000))).autoTransition,
        isNull,
      );
      await expectLater(
        port.recordPayment('DH-2048', input(2000)),
        throwsA(isA<PaymentsPortError>()
            .having((PaymentsPortError e) => e.code, 'code', 'CONFLICT')),
      );
    });

    testWidgets('closing the form discards its key',
        (WidgetTester tester) async {
      _screen(tester);
      final FakePaymentsPort port =
          FakePaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await _tap(tester, find.text('Huỷ'));
      await openForm(tester);
      await confirm(tester, 1);
      expect(
        port.recordCalls.map((RecordPaymentInput c) => c.idempotencyKey),
        <String>['key-2'],
      );
    });

    testWidgets('a blank amount is never sent as 0: the button is disabled',
        (WidgetTester tester) async {
      _screen(tester);
      final FakePaymentsPort port =
          FakePaymentsPort(initial: demoPaymentScheduleConfigured);
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await tester.enterText(_input('Số tiền thu'), '');
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<AppButton>(find.widgetWithText(AppButton, 'Ghi nhận đợt 1'))
            .onPressed,
        isNull,
      );
      expect(port.recordCalls, isEmpty);
    });

    testWidgets('skipped ⇒ warning banner with the reason; status not reported',
        (WidgetTester tester) async {
      _screen(tester);
      final List<String> reported = <String>[];
      final FakePaymentsPort port = FakePaymentsPort(
        initial: demoPaymentScheduleConfigured,
        replyToRecord: const RecordPaymentResult(
          payment: Payment(
            id: 'pay-3',
            installmentId: 'inst-3',
            amount: 8301096,
            paidOn: '2026-10-21',
            method: 'bank_transfer',
            recordedAt: '2026-10-21T03:00:00.000Z',
          ),
          schedule: demoPaymentScheduleConfigured,
          orderStatus: 'nghiemthu',
          autoTransition: AutoTransitionResult(
            event: 'hoan_thanh',
            outcome: 'skipped',
            message:
                'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.',
          ),
        ),
      );
      await tester.pumpWidget(_host(port, onOrderStatusChanged: reported.add));
      await tester.pumpAndSettle();
      await openForm(tester, 2);
      await confirm(tester, 3);
      expect(
        find.text(
            'Đã ghi nhận tiền. Trạng thái đơn chưa đổi: Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.'),
        findsOneWidget,
      );
      expect(reported, isEmpty);
    });

    testWidgets(
        '400 field errors land under amount and date; the form stays open',
        (WidgetTester tester) async {
      _screen(tester);
      final FakePaymentsPort port = FakePaymentsPort(
        initial: demoPaymentScheduleConfigured,
        replyToRecord: const PaymentsPortError(
          code: 'VALIDATION_ERROR',
          message: 'Khoản thu không hợp lệ.',
          fieldErrors: <FieldError>[
            FieldError(
                field: 'amount',
                code: 'exceedsRemaining',
                message: 'Số tiền thu vượt phần còn lại của đợt.'),
            FieldError(
                field: 'paidOn',
                code: 'futureDate',
                message: 'Ngày thu không được sau hôm nay.'),
            FieldError(
                field: 'method',
                code: 'isIn',
                message: 'Phương thức thu không hợp lệ.'),
          ],
        ),
      );
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await confirm(tester, 1);
      expect(
          find.text('Số tiền thu vượt phần còn lại của đợt.'), findsOneWidget);
      expect(find.text('Ngày thu không được sau hôm nay.'), findsOneWidget);
      expect(
        find.text('Khoản thu không hợp lệ.\nPhương thức thu không hợp lệ.'),
        findsOneWidget,
      );
      expect(find.text('GHI NHẬN THANH TOÁN · ĐỢT 1'), findsOneWidget);
    });

    testWidgets('409 ⇒ server message + "Tải lại" reloads and closes the form',
        (WidgetTester tester) async {
      _screen(tester);
      final FakePaymentsPort port = FakePaymentsPort(
        initial: demoPaymentScheduleConfigured,
        replyToRecord: const PaymentsPortError(
          code: 'CONFLICT',
          message: 'Lịch thanh toán vừa thay đổi — tải lại rồi ghi nhận lại.',
        ),
      );
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await confirm(tester, 1);
      expect(
          find.text('Lịch thanh toán vừa thay đổi — tải lại rồi ghi nhận lại.'),
          findsOneWidget);
      await _tap(tester, find.text('Tải lại'));
      expect(find.text('GHI NHẬN THANH TOÁN · ĐỢT 1'), findsNothing);
      expect(find.text('TIẾN ĐỘ CÔNG NỢ'), findsOneWidget);
    });

    testWidgets('double submit: one request while in flight, button disabled',
        (WidgetTester tester) async {
      _screen(tester);
      final Completer<RecordPaymentResult> gate =
          Completer<RecordPaymentResult>();
      final FakePaymentsPort port = FakePaymentsPort(
        initial: demoPaymentScheduleConfigured,
        replyToRecord: () => gate.future,
      );
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await openForm(tester);
      await confirm(tester, 1);
      expect(
        tester
            .widget<AppButton>(find.widgetWithText(AppButton, 'Đang ghi nhận…'))
            .onPressed,
        isNull,
      );
      await tester.tap(find.text('Đang ghi nhận…'), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(port.recordCalls, hasLength(1));
      gate.complete(demoRecordDepositResult);
      await tester.pumpAndSettle();
      expect(find.text('Đơn đã chuyển sang Đã cọc.'), findsOneWidget);
    });
  });

  for (final double width in <double>[320.0, 360.0]) {
    testWidgets('longest labels do not overflow at ${width.toInt()}px',
        (WidgetTester tester) async {
      _screen(tester, width);
      final String longNote = List<String>.filled(200, 'x').join();
      final PaymentSchedule long = PaymentSchedule(
        orderId: 'DH-2048',
        configured: true,
        editable: true,
        orderTotal: 83010960,
        scheduledTotal: 74709864,
        difference: -8301096,
        totalMatches: false,
        paidTotal: 999999999,
        remainingTotal: -999999999,
        paidPercent: 100,
        paymentStatus: 'partial',
        recordable: true,
        installments: <Installment>[
          for (int i = 1; i <= 12; i++)
            Installment(
              id: 'i$i',
              seq: i,
              percent: i == 12 ? null : 1,
              amount: 83010960,
              conditionNote: longNote,
              milestone: i == 12 ? 'tat_toan' : (i == 1 ? 'coc' : null),
              paidAmount: 1,
              remainingAmount: 83010959,
              status: 'partial',
              payments: <Payment>[
                Payment(
                  id: 'p$i',
                  installmentId: 'i$i',
                  amount: 1999999999,
                  paidOn: '2026-12-31',
                  method: 'bank_transfer',
                  note: longNote,
                  recordedAt: '2026-12-31T00:00:00.000Z',
                ),
              ],
            ),
        ],
      );
      await tester.pumpWidget(_host(FakePaymentsPort(initial: long)));
      await tester.pumpAndSettle();
      expect(find.text('Đợt 12 · Tất toán'), findsNWidgets(2));
      expect(tester.takeException(), isNull);

      expect(find.text('Thu một phần'), findsNWidgets(12));
      await _tap(tester, find.text('Ghi nhận').last);
      // AppFrame paints its label upper-cased.
      expect(
        find.text('Ghi nhận thanh toán · Đợt 12'.toUpperCase()),
        findsOneWidget,
      );
      await tester.enterText(_input('Ghi chú'), longNote);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await _tap(tester, find.text('Ghi nhận đợt 12'));
      expect(find.byType(AppConfirmDialog), findsOneWidget);
      expect(tester.takeException(), isNull);
      await _tap(tester, find.text('Huỷ').last);

      await _tap(tester, find.text('Sửa lịch'));
      expect(find.text('Xoá đợt'), findsNWidgets(12));
      expect(tester.takeException(), isNull);
    });
  }
}

/// Fails the first read, answers the configured demo afterwards.
class _FlakyPort extends FakePaymentsPort {
  _FlakyPort() : super(initial: demoPaymentScheduleConfigured);

  int calls = 0;

  @override
  Future<PaymentSchedule> getSchedule(String orderId) {
    calls++;
    if (calls == 1) throw Exception('network down');
    return super.getSchedule(orderId);
  }
}
