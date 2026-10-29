// AuditLogScreen (Story 8.5): what renders follows what the backend sent —
// "Hệ thống" for a system actor, money through formatVnd, a status through its
// label — plus the screen ↔ cubit wiring (filter tabs, date fields, pager,
// Thử lại) and the screen torn down while the port is still answering.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/generated/models/audit_change_dto.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/audit_logs_port.dart';
import 'package:pns_mobile/design_system/session/fake_audit_logs_port.dart';
import 'package:pns_mobile/design_system/shell/app_tabs.dart';
import 'package:pns_mobile/screens/audit/audit_log_screen.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

/// The phone frame has a fixed height: scroll the body to [finder] before tapping it.
Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(400.0, 3200.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

/// A target-type filter tab (the bottom nav also says "Đơn hàng").
Finder _tab(String label) =>
    find.descendant(of: find.byType(AppTabs), matching: find.text(label));

Finder _field(String label) => find.descendant(
  of: find.byWidgetPredicate((w) => w is AppField && w.label == label),
  matching: find.byType(EditableText),
);

/// Every call waits until the test answers it, or fails while [failures] > 0.
class _HeldPort implements AuditLogsPort {
  final List<Completer<AuditLogPage>> pending = <Completer<AuditLogPage>>[];

  @override
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  }) {
    final Completer<AuditLogPage> reply = Completer<AuditLogPage>();
    pending.add(reply);
    return reply.future;
  }
}

class _FailOncePort extends FakeAuditLogsPort {
  bool failed = false;

  @override
  Future<AuditLogPage> listAuditLogs({
    AuditTargetType? targetType,
    String? from,
    String? to,
    int? page,
  }) async {
    if (!failed) {
      failed = true;
      calls.add((targetType: targetType, from: from, to: to, page: page));
      throw const AuditLogsPortException('Không kết nối được máy chủ.');
    }
    return super.listAuditLogs(
      targetType: targetType,
      from: from,
      to: to,
      page: page,
    );
  }
}

void main() {
  testWidgets(
    'renders who, action, when, target and before → after of every record',
    (tester) async {
      _tall(tester);
      await tester.pumpWidget(_host(AuditLogScreen(port: FakeAuditLogsPort())));
      await tester.pumpAndSettle();

      expect(find.text('Trần Kinh Doanh'), findsOneWidget);
      expect(find.text('Lê Kế Toán'), findsOneWidget);
      expect(find.text('Hệ thống'), findsOneWidget);
      // An actor whose account is gone shows its id.
      expect(find.text('33333333'), findsOneWidget);
      expect(find.text('Chốt đơn'), findsOneWidget);
      expect(find.text('status: Báo giá → Đã chốt'), findsOneWidget);
      expect(find.text('orderPaid: 0 đ → 83.010.960 đ'), findsOneWidget);
      expect(find.text('status: Đã chốt → Đã cọc'), findsOneWidget);
      expect(find.text('Đơn hàng 9f8e7d6c'), findsNWidgets(3));
      expect(find.text('30/10/2026 · 10:05'), findsOneWidget);
      expect(find.text('Trang 1/3'), findsOneWidget);
      expect(
        find.text('Bản ghi bất biến — chỉ đọc, không sửa/xoá.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'only a money change with an integer value goes through the formatter; an unknown target type keeps its id',
    (tester) async {
      _tall(tester);
      final AuditLogEntry entry = AuditLogEntry(
        id: 'a1b2c3d4-0000-4000-8000-0000000000aa',
        eventType: 'StockVoucherCreated',
        eventLabel: 'Lập phiếu kho',
        actorAccountId: null,
        actorDisplayName: null,
        targetType: AuditTargetType.$unknown,
        targetId: '7e6d5c4b-1111-4222-8333-444455556666',
        occurredAt: DateTime.utc(2026, 10, 30, 3, 5),
        changes: const <AuditChangeDto>[
          AuditChangeDto(
            field: 'lines[0].qty',
            before: '5',
            after: '10',
            isMoney: false,
          ),
          AuditChangeDto(
            field: 'lines[0].unitCost',
            before: '1.5',
            after: '99999999999999999999',
            isMoney: true,
          ),
          // int.tryParse reads hex: only plain decimal digits are an amount.
          AuditChangeDto(
            field: 'lines[1].unitCost',
            before: '0x10',
            after: null,
            isMoney: true,
          ),
          AuditChangeDto(
            field: 'lines[0].giaVonSau',
            before: '-500000',
            after: '1500000',
            isMoney: true,
          ),
        ],
      );
      await tester.pumpWidget(
        _host(
          AuditLogScreen(
            port: FakeAuditLogsPort(items: <AuditLogEntry>[entry], total: 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('lines[0].qty: 5 → 10'), findsOneWidget);
      expect(
        find.text('lines[0].unitCost: 1.5 → 99999999999999999999'),
        findsOneWidget,
      );
      expect(find.text('lines[1].unitCost: 0x10 → —'), findsOneWidget);
      expect(
        find.text('lines[0].giaVonSau: -500.000 đ → 1.500.000 đ'),
        findsOneWidget,
      );
      expect(find.text('7e6d5c4b'), findsOneWidget);
    },
  );

  testWidgets('no edit, delete or export control and no role wording', (
    tester,
  ) async {
    _tall(tester);
    await tester.pumpWidget(_host(AuditLogScreen(port: FakeAuditLogsPort())));
    await tester.pumpAndSettle();
    final List<String?> labels = tester
        .widgetList<AppButton>(find.byType(AppButton))
        .map((b) => b.label)
        .toList();
    expect(labels, ['Trước', 'Sau']);
    expect(find.textContaining('Super Admin'), findsNothing);
  });

  testWidgets(
    'a tab, a full date and the pager each send their query; filters return to page 1',
    (tester) async {
      _tall(tester);
      final port = FakeAuditLogsPort();
      await tester.pumpWidget(_host(AuditLogScreen(port: port)));
      await tester.pumpAndSettle();
      expect(port.calls.single, (
        targetType: null,
        from: null,
        to: null,
        page: 1,
      ));

      await _tap(tester, find.text('Sau'));
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        targetType: null,
        from: null,
        to: null,
        page: 2,
      ));

      await _tap(tester, _tab('Sản phẩm'));
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        targetType: AuditTargetType.product,
        from: null,
        to: null,
        page: 1,
      ));

      await tester.enterText(_field('Từ ngày'), '2026-10-0');
      await tester.pumpAndSettle();
      expect(port.calls, hasLength(3));
      await tester.enterText(_field('Từ ngày'), '2026-10-01');
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: null,
        page: 1,
      ));

      await tester.enterText(_field('Đến ngày'), '2026-10-30');
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        targetType: AuditTargetType.product,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 1,
      ));

      await _tap(tester, _tab('Tất cả'));
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        targetType: null,
        from: '2026-10-01',
        to: '2026-10-30',
        page: 1,
      ));
    },
  );

  testWidgets('every one of the nine target types is a filter tab', (
    tester,
  ) async {
    _tall(tester);
    await tester.pumpWidget(
      _host(AuditLogScreen(port: FakeAuditLogsPort(items: const []))),
    );
    await tester.pumpAndSettle();
    for (final String label in <String>[
      'Tất cả',
      ...kAuditTargetLabels.values,
    ]) {
      expect(_tab(label), findsOneWidget, reason: label);
    }
    expect(kAuditTargetLabels, hasLength(9));
  });

  testWidgets('an empty book and an empty filtered view say different things', (
    tester,
  ) async {
    _tall(tester);
    await tester.pumpWidget(
      _host(AuditLogScreen(port: FakeAuditLogsPort(items: const [], total: 0))),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chưa có bản ghi nào'), findsOneWidget);
    await _tap(tester, _tab('Phiếu kho'));
    await tester.pumpAndSettle();
    expect(find.text('Không có bản ghi phù hợp'), findsOneWidget);
  });

  testWidgets('a failure shows the backend sentence and Thử lại loads again', (
    tester,
  ) async {
    _tall(tester);
    final port = _FailOncePort();
    await tester.pumpWidget(_host(AuditLogScreen(port: port)));
    await tester.pumpAndSettle();
    expect(find.text('Không kết nối được máy chủ.'), findsOneWidget);
    await _tap(tester, find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.text('Trần Kinh Doanh'), findsOneWidget);
    expect(port.calls, hasLength(2));
  });

  testWidgets('loading shows skeletons, not records', (tester) async {
    _tall(tester);
    final port = _HeldPort();
    await tester.pumpWidget(_host(AuditLogScreen(port: port)));
    await tester.pump();
    expect(find.byType(AppSkeleton), findsWidgets);
    expect(find.text('Trần Kinh Doanh'), findsNothing);
    port.pending.single.complete(
      AuditLogPage(items: kDemoAuditLogs, total: 4, page: 1, pageSize: 20),
    );
    await tester.pumpAndSettle();
    expect(find.text('Trần Kinh Doanh'), findsOneWidget);
    expect(find.text('Trang 1/1'), findsNothing);
  });

  testWidgets(
    'torn down while the port is still answering ⇒ no error after the answer',
    (tester) async {
      _tall(tester);
      final port = _HeldPort();
      await tester.pumpWidget(_host(AuditLogScreen(port: port)));
      await tester.pump();
      await tester.pumpWidget(_host(const SizedBox.shrink()));
      port.pending.single.complete(
        AuditLogPage(items: kDemoAuditLogs, total: 4, page: 1, pageSize: 20),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('the pager walks back and forth and stops at both ends', (
    tester,
  ) async {
    _tall(tester);
    final port = FakeAuditLogsPort();
    await tester.pumpWidget(_host(AuditLogScreen(port: port)));
    await tester.pumpAndSettle();
    AppButton button(String label) => tester
        .widgetList<AppButton>(find.byType(AppButton))
        .singleWhere((b) => b.label == label);

    expect(find.text('Trang 1/3'), findsOneWidget);
    expect(button('Trước').onPressed, isNull);
    await _tap(tester, find.text('Sau'));
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Sau'));
    await tester.pumpAndSettle();
    expect(find.text('Trang 3/3'), findsOneWidget);
    expect(button('Sau').onPressed, isNull);
    await _tap(tester, find.text('Trước'));
    await tester.pumpAndSettle();
    expect(find.text('Trang 2/3'), findsOneWidget);
    expect(port.calls.map((q) => q.page), <int?>[1, 2, 3, 2]);
  });
}
