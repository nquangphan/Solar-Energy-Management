// DashboardScreen (Story 8.1): what renders follows what the backend sent —
// no Doanh thu at all when `revenue` is null, no order blocks when the counts
// are null — plus the screen ↔ cubit wiring (period tabs, Thử lại, reload
// signal) and the screen torn down while the port is still answering.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/dashboard_port.dart';
import 'package:pns_mobile/design_system/session/fake_dashboard_port.dart';
import 'package:pns_mobile/design_system/shell/app_bottom_nav.dart';
import 'package:pns_mobile/design_system/shell/app_tabs.dart';
import 'package:pns_mobile/screens/dashboard/dashboard_screen.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

/// AppKpi paints its label upper-cased; find it by the label the screen passed.
Finder _kpi(String label) =>
    find.byWidgetPredicate((w) => w is AppKpi && w.label == label);

final Finder _chartFrame = find.byWidgetPredicate(
  (w) => w is AppFrame && w.label == 'Đơn theo trạng thái',
);

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(400.0, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

DashboardSummary _with({int? revenue, int? newOrders, bool byStatus = true}) =>
    DashboardSummary(
      period: kDemoDashboardSummary.period,
      from: kDemoDashboardSummary.from,
      to: kDemoDashboardSummary.to,
      revenue: revenue,
      newOrderCount: newOrders,
      ordersByStatus: byStatus ? kDemoDashboardSummary.ordersByStatus : null,
    );

/// Records each call; with [hold] the call waits until the test answers it.
class _RecordingPort implements DashboardPort {
  _RecordingPort({this.hold = false, this.failures = 0});

  final bool hold;
  int failures;
  final List<DashboardPeriod> calls = <DashboardPeriod>[];
  final List<Completer<DashboardSummary>> pending =
      <Completer<DashboardSummary>>[];

  @override
  Future<DashboardSummary> getSummary(DashboardPeriod period) {
    calls.add(period);
    if (hold) {
      final Completer<DashboardSummary> reply = Completer<DashboardSummary>();
      pending.add(reply);
      return reply.future;
    }
    if (failures > 0) {
      failures--;
      return Future<DashboardSummary>.error(
        const DashboardPortException('Lỗi máy chủ.'),
      );
    }
    return Future<DashboardSummary>.value(kDemoDashboardSummary);
  }
}

void main() {
  testWidgets(
    'with revenue: the accent KPI shows it through formatVnd; the chart has all ten statuses',
    (tester) async {
      _tall(tester);
      await tester.pumpWidget(
        _host(DashboardScreen(port: FakeDashboardPort())),
      );
      await tester.pumpAndSettle();

      expect(find.text('Tổng quan vận hành'), findsOneWidget);
      expect(
        tester.widget<AppBottomNav>(find.byType(AppBottomNav)).activeIndex,
        0,
      );
      expect(find.text('1.240.000.000 đ'), findsOneWidget);
      final revenueKpi = tester.widget<AppKpi>(_kpi('Doanh thu tháng này'));
      expect(revenueKpi.accent, isTrue);
      expect(_kpi('Đơn mới tháng này'), findsOneWidget);
      expect(find.text('01/10/2026 – 23/10/2026'), findsOneWidget);
      expect(_chartFrame, findsOneWidget);
      final chart = tester.widget<AppBarChart>(find.byType(AppBarChart));
      expect(chart.items.map((i) => i.label).toList(), [
        'Báo giá',
        'Chờ duyệt',
        'Đã chốt',
        'Đã cọc',
        'Đang thi công',
        'Nghiệm thu',
        'Đang giao',
        'Đã giao',
        'Hoàn thành',
        'Huỷ',
      ]);
      expect(chart.items.map((i) => i.value).toList(), [
        12,
        4,
        9,
        11,
        7,
        3,
        2,
        1,
        15,
        0,
      ]);
    },
  );

  testWidgets(
    'revenue null ⇒ no Doanh thu anywhere, the order count still shows',
    (tester) async {
      _tall(tester);
      await tester.pumpWidget(
        _host(DashboardScreen(port: FakeDashboardPort(_with(newOrders: 37)))),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('DOANH THU'), findsNothing);
      expect(
        find.byWidgetPredicate(
          (w) => w is AppKpi && w.label.contains('Doanh thu'),
        ),
        findsNothing,
      );
      expect(find.byType(AppKpi), findsOneWidget);
      expect(tester.widget<AppKpi>(_kpi('Đơn mới tháng này')).value, '37');
      expect(find.byType(AppBarChart), findsOneWidget);
    },
  );

  testWidgets(
    'order blocks null ⇒ no order KPI and no chart, revenue still shows',
    (tester) async {
      _tall(tester);
      await tester.pumpWidget(
        _host(
          DashboardScreen(
            port: FakeDashboardPort(_with(revenue: 5000000, byStatus: false)),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('5.000.000 đ'), findsOneWidget);
      expect(_kpi('Đơn mới tháng này'), findsNothing);
      expect(_chartFrame, findsNothing);
      expect(find.byType(AppBarChart), findsNothing);
    },
  );

  testWidgets(
    'tapping a period tab asks the cubit ⇒ the port gets that period, the labels follow',
    (tester) async {
      _tall(tester);
      final port = _RecordingPort();
      await tester.pumpWidget(_host(DashboardScreen(port: port)));
      await tester.pumpAndSettle();
      expect(port.calls, [Period.month]);

      await tester.tap(find.text('Tuần'));
      await tester.pumpAndSettle();
      expect(port.calls, [Period.month, Period.week]);
      expect(_kpi('Doanh thu tuần này'), findsOneWidget);

      await tester.tap(find.text('Ngày'));
      await tester.pumpAndSettle();
      expect(port.calls, [Period.month, Period.week, Period.day]);
      expect(_kpi('Đơn mới hôm nay'), findsOneWidget);
      expect(tester.widget<AppTabs>(find.byType(AppTabs)).activeKey, 'day');
    },
  );

  testWidgets(
    'while a new period loads, the old figures are not shown under the new label',
    (tester) async {
      _tall(tester);
      final port = _RecordingPort(hold: true);
      await tester.pumpWidget(_host(DashboardScreen(port: port)));
      port.pending.single.complete(kDemoDashboardSummary);
      await tester.pumpAndSettle();
      expect(find.text('1.240.000.000 đ'), findsOneWidget);

      await tester.tap(find.text('Tuần'));
      await tester.pump();
      expect(port.calls, [Period.month, Period.week]);
      expect(find.text('1.240.000.000 đ'), findsNothing);
      expect(find.byType(AppKpi), findsNothing);
      expect(find.byType(AppSkeleton), findsWidgets);
    },
  );

  testWidgets('a port error shows AppErrorState; Thử lại reads once more', (
    tester,
  ) async {
    _tall(tester);
    final port = _RecordingPort(failures: 1);
    await tester.pumpWidget(_host(DashboardScreen(port: port)));
    await tester.pumpAndSettle();
    expect(find.text('Không tải được số liệu.'), findsOneWidget);

    await tester.tap(find.widgetWithText(AppButton, 'Thử lại'));
    await tester.pumpAndSettle();
    expect(port.calls, [Period.month, Period.month]);
    expect(find.text('1.240.000.000 đ'), findsOneWidget);
  });

  testWidgets('403 ⇒ an empty state without Thử lại', (tester) async {
    _tall(tester);
    final port = _RecordingPort(hold: true);
    await tester.pumpWidget(_host(DashboardScreen(port: port)));
    port.pending.single.completeError(
      const DashboardPortException('Không có quyền.', forbidden: true),
    );
    await tester.pumpAndSettle();
    expect(find.text('Không có số liệu cho tài khoản này'), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Thử lại'), findsNothing);
  });

  testWidgets(
    'the reload signal reads once more; a new signal replaces the old one',
    (tester) async {
      final port = _RecordingPort();
      final ValueNotifier<int> first = ValueNotifier<int>(0);
      final ValueNotifier<int> second = ValueNotifier<int>(0);
      addTearDown(first.dispose);
      addTearDown(second.dispose);
      await tester.pumpWidget(
        _host(DashboardScreen(port: port, reloadSignal: first)),
      );
      await tester.pumpAndSettle();
      first.value++;
      await tester.pumpAndSettle();
      expect(port.calls, hasLength(2));

      await tester.pumpWidget(
        _host(DashboardScreen(port: port, reloadSignal: second)),
      );
      await tester.pumpAndSettle();
      first.value++;
      await tester.pumpAndSettle();
      expect(
        port.calls,
        hasLength(2),
        reason: 'the old signal no longer reads',
      );
      second.value++;
      await tester.pumpAndSettle();
      expect(port.calls, hasLength(3));
    },
  );

  for (final outcome in ['answers', 'fails']) {
    testWidgets(
      'left while the figures load, then the port $outcome ⇒ no crash; the signal no longer reads',
      (tester) async {
        final port = _RecordingPort(hold: true);
        final ValueNotifier<int> signal = ValueNotifier<int>(0);
        addTearDown(signal.dispose);
        await tester.pumpWidget(
          _host(DashboardScreen(port: port, reloadSignal: signal)),
        );
        expect(port.calls, [Period.month]);

        await tester.pumpWidget(_host(const SizedBox()));
        if (outcome == 'answers') {
          port.pending.single.complete(kDemoDashboardSummary);
        } else {
          port.pending.single.completeError(
            const DashboardPortException('Lỗi máy chủ.'),
          );
        }
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        signal.value++;
        await tester.pump();
        expect(port.calls, [Period.month]);
      },
    );
  }
}
