// ProfitReportScreen: what renders follows what the backend sent —
// KPIs from totals, money through formatVnd, the margin as `N%` or `—`, the
// mandatory label — plus the screen ↔ cubit wiring (grouping tabs, period tabs,
// custom days, Thử lại) and the screen torn down while the port is answering.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_profit_report_port.dart';
import 'package:pns_mobile/design_system/session/profit_report_port.dart';
import 'package:pns_mobile/design_system/shell/app_tabs.dart';
import 'package:pns_mobile/screens/reports/profit_report_screen.dart';

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

/// A tab of either tab row (the bottom nav has labels of its own).
Finder _tab(String label) =>
    find.descendant(of: find.byType(AppTabs), matching: find.text(label));

Finder _field(String label) => find.descendant(
  of: find.byWidgetPredicate((w) => w is AppField && w.label == label),
  matching: find.byType(EditableText),
);

/// KPI label → printed value, in render order.
Map<String, String> _kpis(WidgetTester tester) => <String, String>{
  for (final AppKpi kpi in tester.widgetList<AppKpi>(find.byType(AppKpi)))
    kpi.label: kpi.value,
};

ProfitReport _report(List<ProfitReportRow> rows, {ProfitFigures? totals}) =>
    ProfitReport(
      groupBy: ProfitGroupBy.order,
      from: '2026-10-01',
      to: '2026-10-30',
      totals: totals ?? kDemoProfitTotals,
      rows: rows,
    );

/// Every call waits until the test answers it.
class _HeldPort implements ProfitReportPort {
  final List<Completer<ProfitReport>> pending = <Completer<ProfitReport>>[];

  @override
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  }) {
    final Completer<ProfitReport> reply = Completer<ProfitReport>();
    pending.add(reply);
    return reply.future;
  }
}

class _FailOncePort extends FakeProfitReportPort {
  bool failed = false;

  @override
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  }) async {
    if (!failed) {
      failed = true;
      calls.add((groupBy: groupBy, period: period, from: from, to: to));
      throw const ProfitReportPortException('Không kết nối được máy chủ.');
    }
    return super.getProfitReport(
      groupBy: groupBy,
      period: period,
      from: from,
      to: to,
    );
  }
}

class _AnswerPort implements ProfitReportPort {
  _AnswerPort(this.answer);

  final ProfitReport answer;

  @override
  Future<ProfitReport> getProfitReport({
    ProfitGroupBy? groupBy,
    ProfitPeriod? period,
    String? from,
    String? to,
  }) async => answer;
}

void main() {
  testWidgets(
    'shows the four KPIs from totals, the mandatory label, the note and one row per order',
    (tester) async {
      _tall(tester);
      await tester.pumpWidget(
        _host(ProfitReportScreen(port: FakeProfitReportPort())),
      );
      await tester.pumpAndSettle();
      final Map<String, String> kpis = _kpis(tester);

      expect(kpis.keys, ['Doanh thu', 'Giá vốn', 'Lợi nhuận gộp', 'Biên gộp']);
      expect(kpis['Doanh thu'], formatVnd(kDemoProfitTotals.revenue));
      expect(kpis['Giá vốn'], formatVnd(kDemoProfitTotals.cost));
      expect(kpis['Lợi nhuận gộp'], formatVnd(kDemoProfitTotals.grossProfit));
      expect(kpis['Biên gộp'], '${kDemoProfitTotals.marginPct}%');
      final AppKpi accent = tester
          .widgetList<AppKpi>(find.byType(AppKpi))
          .singleWhere((k) => k.accent);
      expect(accent.label, 'Lợi nhuận gộp');

      expect(
        find.text(
          'Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung.',
        ),
        findsOneWidget,
      );
      expect(
        find.text('Đơn chưa xuất kho không có trong báo cáo.'),
        findsOneWidget,
      );

      final List<ProfitReportRow> rows = kDemoProfitRows[ProfitGroupBy.order]!;
      for (final ProfitReportRow row in rows) {
        expect(find.text(row.label), findsOneWidget, reason: row.label);
        expect(find.text(formatVnd(row.grossProfit)), findsOneWidget);
      }
      final ProfitReportRow first = rows.first;
      expect(
        find.text(
          '${first.sourceName} · ${first.assigneeDisplayName} · DT ${formatVnd(first.revenue)}',
        ),
        findsOneWidget,
      );
      expect(find.text('Xuất kho 01/10/2026 – 30/10/2026'), findsOneWidget);
    },
  );

  testWidgets(
    'a missing assignee and a null margin print —; a loss prints as the formatter does',
    (tester) async {
      _tall(tester);
      await tester.pumpWidget(
        _host(ProfitReportScreen(port: FakeProfitReportPort())),
      );
      await tester.pumpAndSettle();
      final List<ProfitReportRow> rows = kDemoProfitRows[ProfitGroupBy.order]!;
      final ProfitReportRow loss = rows[2];
      final ProfitReportRow noRevenue = rows[3];
      expect(loss.assigneeDisplayName, isNull);
      expect(loss.grossProfit, isNegative);
      expect(noRevenue.marginPct, isNull);
      expect(
        find.text('${loss.sourceName} · — · DT ${formatVnd(loss.revenue)}'),
        findsOneWidget,
      );
      expect(find.text(formatVnd(loss.grossProfit)), findsOneWidget);
      expect(find.text('${loss.marginPct}%'), findsOneWidget);
      expect(find.text('—'), findsOneWidget);
    },
  );

  testWidgets('a null total margin prints —', (tester) async {
    _tall(tester);
    await tester.pumpWidget(
      _host(
        ProfitReportScreen(
          port: _AnswerPort(
            _report(
              const <ProfitReportRow>[],
              totals: const ProfitFigures(
                revenue: 0,
                cost: 0,
                grossProfit: 0,
                marginPct: null,
                orderCount: 0,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(_kpis(tester)['Biên gộp'], '—');
  });

  testWidgets(
    'the grouping tabs, the period tabs and the custom days each send their query',
    (tester) async {
      _tall(tester);
      final port = FakeProfitReportPort();
      await tester.pumpWidget(_host(ProfitReportScreen(port: port)));
      await tester.pumpAndSettle();
      expect(port.calls.single, (
        groupBy: ProfitGroupBy.order,
        period: ProfitPeriod.month,
        from: null,
        to: null,
      ));

      await _tap(tester, _tab('Tháng'));
      await tester.pumpAndSettle();
      expect(port.calls.last.groupBy, ProfitGroupBy.month);
      final ProfitReportRow month = kDemoProfitRows[ProfitGroupBy.month]!.first;
      expect(find.text(month.label), findsOneWidget);
      expect(
        find.text('${month.orderCount} đơn · DT ${formatVnd(month.revenue)}'),
        findsOneWidget,
      );

      await _tap(tester, _tab('Sale'));
      await tester.pumpAndSettle();
      expect(port.calls.last.groupBy, ProfitGroupBy.assignee);
      expect(find.text('Chưa giao người phụ trách'), findsOneWidget);

      await _tap(tester, _tab('Nguồn'));
      await tester.pumpAndSettle();
      expect(port.calls.last.groupBy, ProfitGroupBy.source);

      await _tap(tester, _tab('Năm nay'));
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.year,
        from: null,
        to: null,
      ));

      final int before = port.calls.length;
      expect(_field('Từ ngày'), findsNothing);
      await _tap(tester, _tab('Tuỳ chọn'));
      await tester.pumpAndSettle();
      expect(find.text('Chọn từ ngày và đến ngày'), findsOneWidget);
      await tester.enterText(_field('Từ ngày'), '2026-07-0');
      await tester.pumpAndSettle();
      await tester.enterText(_field('Từ ngày'), '2026-07-01');
      await tester.pumpAndSettle();
      expect(port.calls, hasLength(before));
      await tester.enterText(_field('Đến ngày'), '2026-07-31');
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.custom,
        from: '2026-07-01',
        to: '2026-07-31',
      ));
      expect(find.text('Xuất kho 01/07/2026 – 31/07/2026'), findsOneWidget);

      await _tap(tester, _tab('Tháng này'));
      await tester.pumpAndSettle();
      expect(port.calls.last, (
        groupBy: ProfitGroupBy.source,
        period: ProfitPeriod.month,
        from: null,
        to: null,
      ));
      expect(_field('Từ ngày'), findsNothing);
    },
  );

  testWidgets(
    'an end day before the start ⇒ the range sentence, nothing sent',
    (tester) async {
      _tall(tester);
      final port = FakeProfitReportPort();
      await tester.pumpWidget(_host(ProfitReportScreen(port: port)));
      await tester.pumpAndSettle();
      await _tap(tester, _tab('Tuỳ chọn'));
      await tester.pumpAndSettle();
      await tester.enterText(_field('Từ ngày'), '2026-08-01');
      await tester.enterText(_field('Đến ngày'), '2026-07-31');
      await tester.pumpAndSettle();
      expect(port.calls, hasLength(1));
      expect(
        find.text('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'),
        findsOneWidget,
      );
      expect(find.text('Thử lại'), findsNothing);
    },
  );

  testWidgets('no issued order ⇒ the empty sentence', (tester) async {
    _tall(tester);
    await tester.pumpWidget(
      _host(
        ProfitReportScreen(
          port: _AnswerPort(_report(const <ProfitReportRow>[])),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chưa có đơn đã xuất kho trong kỳ này.'), findsOneWidget);
  });

  testWidgets('a failure shows the backend sentence and Thử lại loads again', (
    tester,
  ) async {
    _tall(tester);
    final port = _FailOncePort();
    await tester.pumpWidget(_host(ProfitReportScreen(port: port)));
    await tester.pumpAndSettle();
    expect(find.text('Không kết nối được máy chủ.'), findsOneWidget);
    expect(find.byType(AppKpi), findsNothing);
    await _tap(tester, find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.text('BG-9F8E7D6C'), findsOneWidget);
    expect(port.calls, hasLength(2));
  });

  testWidgets('loading shows skeletons, not rows', (tester) async {
    _tall(tester);
    final port = _HeldPort();
    await tester.pumpWidget(_host(ProfitReportScreen(port: port)));
    await tester.pump();
    expect(find.byType(AppSkeleton), findsWidgets);
    expect(find.byType(AppKpi), findsNothing);
    port.pending.single.complete(
      _report(kDemoProfitRows[ProfitGroupBy.order]!),
    );
    await tester.pumpAndSettle();
    expect(find.text('BG-9F8E7D6C'), findsOneWidget);
    expect(find.byType(AppSkeleton), findsNothing);
  });

  testWidgets(
    'torn down while the port is still answering ⇒ no error after the answer',
    (tester) async {
      _tall(tester);
      final port = _HeldPort();
      await tester.pumpWidget(_host(ProfitReportScreen(port: port)));
      await tester.pump();
      await tester.pumpWidget(_host(const SizedBox.shrink()));
      port.pending.single.complete(
        _report(kDemoProfitRows[ProfitGroupBy.order]!),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('no Excel export and no month-over-month delta', (tester) async {
    _tall(tester);
    await tester.pumpWidget(
      _host(ProfitReportScreen(port: FakeProfitReportPort())),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Excel'), findsNothing);
    expect(find.textContaining('so tháng trước'), findsNothing);
    for (final AppKpi kpi in tester.widgetList<AppKpi>(find.byType(AppKpi))) {
      expect(kpi.delta, isNull);
    }
  });
}
