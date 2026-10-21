// hand-authored — widget test for the Lịch thanh toán screen (Story 7.1).
//
// Everything goes through the REAL screen with ports: the configured / empty /
// mismatch views, the templates, what is actually SENT (blank number ⇒ key
// absent, typed "0" ⇒ 0), server field errors landing under the right row, the
// 409 path, permission and `editable` gating, the double-submit guard, and the
// longest labels at 320/360px.

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
}) =>
    MaterialApp(
      home: Scaffold(
        body: PaymentScheduleScreen(
          port: port,
          orderId: 'DH-2048',
          perms: perms,
        ),
      ),
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
    expect(find.text('Đợt 1 · Cọc'), findsOneWidget);
    expect(find.text('Đợt 2'), findsOneWidget);
    expect(find.text('Đợt 3 · Tất toán'), findsOneWidget);
    expect(find.text('20%'), findsOneWidget);
    expect(find.text('Khi thi công'), findsOneWidget);
    expect(find.text('16.602.192 đ'), findsOneWidget);
    expect(find.text('58.107.672 đ'), findsOneWidget);
    expect(find.text('8.301.096 đ'), findsOneWidget);
    expect(find.text('Tổng lịch'), findsOneWidget);
    expect(find.text('Tổng đơn (sau VAT)'), findsOneWidget);
    // Both totals equal 83.010.960 đ.
    expect(find.text('83.010.960 đ'), findsNWidgets(2));
    expect(find.text('Tổng các đợt lệch tổng đơn sau VAT'), findsNothing);
    expect(find.text('Sửa lịch'), findsOneWidget);
    expect(find.textContaining('Ghi nhận'), findsNothing);
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
      installments: <Installment>[
        Installment(
          seq: 1,
          amount: 1000,
          conditionNote: 'Một lần',
          milestone: 'coc',
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
    expect(find.text('Đợt 1 · Cọc'), findsOneWidget);
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
    expect(find.text('Đợt 3 · Tất toán'), findsOneWidget);
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
      installments: <Installment>[
        Installment(seq: 1, percent: 40, amount: 40, conditionNote: 'A'),
        Installment(seq: 2, amount: 60, conditionNote: 'B'),
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
      expect(find.text('Đợt 1 · Cọc'), findsOneWidget);
      expect(find.text('Sửa lịch'), findsNothing);
    });

    testWidgets('paymentsRecord but editable=false ⇒ absent',
        (WidgetTester tester) async {
      _screen(tester);
      await tester.pumpWidget(_host(FakePaymentsPort(
        initial: _withEditable(demoPaymentScheduleConfigured, editable: false),
      )));
      await tester.pumpAndSettle();
      expect(find.text('Đợt 1 · Cọc'), findsOneWidget);
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
    expect(find.text('Đợt 1 · Cọc'), findsOneWidget);
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
        installments: <Installment>[
          for (int i = 1; i <= 12; i++)
            Installment(
              seq: i,
              percent: i == 12 ? null : 1,
              amount: 83010960,
              conditionNote: longNote,
              milestone: i == 12 ? 'tat_toan' : (i == 1 ? 'coc' : null),
            ),
        ],
      );
      await tester.pumpWidget(_host(FakePaymentsPort(initial: long)));
      await tester.pumpAndSettle();
      expect(find.text('Đợt 12 · Tất toán'), findsOneWidget);
      expect(tester.takeException(), isNull);

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
