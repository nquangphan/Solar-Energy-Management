// Native Flutter render + token guard for the widget parity layer (Story 1.7,
// Task 7 — AC-1). Every widget pumps without error and carries the canonical
// AppTokens colours / sizes mirrored from components.css.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/icons/app_icons.dart';
import 'package:pns_mobile/design_system/tokens/app_tokens.dart';

Widget _host(Widget child) => MaterialApp(
      home: Scaffold(body: Center(child: child)),
    );

/// True if any Container in the tree paints [color] as its decoration fill.
bool _hasFill(WidgetTester tester, Color color) {
  return tester.widgetList<Container>(find.byType(Container)).any((c) {
    final d = c.decoration;
    return d is BoxDecoration && d.color == color;
  });
}

/// True if any Container in the tree has a border side of [color].
bool _hasBorder(WidgetTester tester, Color color) {
  return tester.widgetList<Container>(find.byType(Container)).any((c) {
    final d = c.decoration;
    return d is BoxDecoration && d.border?.top.color == color;
  });
}

void main() {
  group('AppButton (mirror .btn)', () {
    testWidgets('renders all 5 variants + 2 sizes without error',
        (tester) async {
      for (final v in AppButtonVariant.values) {
        for (final s in AppButtonSize.values) {
          await tester.pumpWidget(_host(
            AppButton(label: 'X', variant: v, size: s, onPressed: () {}),
          ));
          expect(find.text('X'), findsOneWidget);
        }
      }
    });

    testWidgets('primary fills teal, accent borders lime', (tester) async {
      await tester.pumpWidget(_host(
        const AppButton(label: 'P', variant: AppButtonVariant.primary),
      ));
      expect(_hasFill(tester, AppTokens.teal), isTrue);

      await tester.pumpWidget(_host(
        const AppButton(label: 'A', variant: AppButtonVariant.accent),
      ));
      expect(_hasFill(tester, AppTokens.lime050), isTrue);
      expect(_hasBorder(tester, AppTokens.lime), isTrue);
    });

    testWidgets('icon slot renders at 15px', (tester) async {
      await tester.pumpWidget(_host(
        const AppButton(label: 'S', icon: 'ic-share'),
      ));
      final icon = tester.widget<AppIcon>(find.byType(AppIcon));
      expect(icon.size, 15.0);
    });
  });

  group('AppCard / AppFrame', () {
    testWidgets('card variants swap border colour', (tester) async {
      await tester.pumpWidget(_host(
        const AppCard(variant: AppCardVariant.ink, child: Text('c')),
      ));
      expect(_hasBorder(tester, AppTokens.ink), isTrue);
    });

    testWidgets('frame paints its label over the border', (tester) async {
      await tester.pumpWidget(_host(
        const AppFrame(label: 'thông tin', child: Text('body')),
      ));
      expect(find.text('THÔNG TIN'), findsOneWidget);
      expect(find.text('body'), findsOneWidget);
    });
  });

  group('AppField (mirror .field)', () {
    testWidgets('renders label + input, teal cursor', (tester) async {
      await tester.pumpWidget(_host(
        const AppField(label: 'Tên', placeholder: 'nhập tên'),
      ));
      expect(find.text('TÊN'), findsOneWidget);
      final tf = tester.widget<TextField>(find.byType(TextField));
      expect(tf.cursorColor, AppTokens.teal);
    });
  });

  group('AppStatusChip (mirror .chip--*)', () {
    // Expected labels are spelled out here rather than read from kStatusLabels:
    // asserting find.text(kStatusLabels[status]!) reads the label from the very
    // map under test, so it passes no matter what that map contains. "Đã giao"
    // and "Đang giao" differ by one letter, which is exactly the drift a
    // self-referential assertion cannot see.
    const expectedLabels = <StatusKey, String>{
      StatusKey.baogia: 'Báo giá',
      StatusKey.choduyet: 'Chờ duyệt',
      StatusKey.dachot: 'Đã chốt',
      StatusKey.dacoc: 'Đã cọc',
      StatusKey.thicong: 'Đang thi công',
      StatusKey.nghiemthu: 'Nghiệm thu',
      StatusKey.danggiao: 'Đang giao',
      StatusKey.dagiao: 'Đã giao',
      StatusKey.hoanthanh: 'Hoàn thành',
      StatusKey.huy: 'Huỷ',
    };

    testWidgets('renders all 10 states with the canonical Vietnamese label',
        (tester) async {
      expect(expectedLabels.length, StatusKey.values.length);
      for (final status in StatusKey.values) {
        await tester.pumpWidget(_host(AppStatusChip(status: status)));
        expect(find.text(expectedLabels[status]!), findsOneWidget);
      }
    });

    testWidgets('baogia carries its exact triplet', (tester) async {
      await tester.pumpWidget(_host(
        const AppStatusChip(status: StatusKey.baogia),
      ));
      expect(_hasFill(tester, const Color(0xFFEAF3F1)), isTrue);
      expect(_hasBorder(tester, const Color(0xFFCFE5E0)), isTrue);
    });

    // The 10th chip, render-verified end to end: the key really paints its own
    // triplet. parity.test.mjs proves the hex appears in the Dart SOURCE; this
    // proves StatusKey.dagiao actually resolves to it at runtime, and that it is
    // not wearing danggiao's cyan or hoanthanh's green.
    testWidgets('dagiao carries its exact triplet and label', (tester) async {
      await tester.pumpWidget(_host(
        const AppStatusChip(status: StatusKey.dagiao),
      ));
      expect(find.text('Đã giao'), findsOneWidget);
      expect(find.text('Đang giao'), findsNothing);
      expect(_hasFill(tester, const Color(0xFFDDF3EA)), isTrue);
      expect(_hasBorder(tester, const Color(0xFFB7E5D4)), isTrue);
      // Not the neighbouring states' fills.
      expect(_hasFill(tester, const Color(0xFFDEF1F6)), isFalse);
      expect(_hasFill(tester, const Color(0xFFDEF3E6)), isFalse);
    });
  });

  group('AppCustomerTypeChip / AppScopeFlag', () {
    testWidgets('scope-flag off strikes through its label', (tester) async {
      await tester.pumpWidget(_host(
        const AppScopeFlag(label: 'Mái tôn', on: false),
      ));
      final txt = tester.widget<Text>(find.text('Mái tôn'));
      expect(txt.style?.decoration, TextDecoration.lineThrough);
    });

    testWidgets('customer-type chip fills lime050', (tester) async {
      await tester.pumpWidget(_host(
        const AppCustomerTypeChip(label: 'Đại lý'),
      ));
      expect(_hasFill(tester, AppTokens.lime050), isTrue);
    });

    testWidgets('scope-flag on is teal and not struck through', (tester) async {
      await tester.pumpWidget(_host(
        const AppScopeFlag(label: 'Mái tôn', on: true),
      ));
      final txt = tester.widget<Text>(find.text('Mái tôn'));
      expect(txt.style?.color, AppTokens.teal700);
      expect(txt.style?.decoration, isNot(TextDecoration.lineThrough));
    });
  });

  group('AppBanner (mirror .banner)', () {
    testWidgets('all 3 tones render with their fill', (tester) async {
      await tester.pumpWidget(_host(
        const AppBanner(message: 'w', tone: AppBannerTone.warn),
      ));
      expect(_hasFill(tester, const Color(0xFFFBF0DA)), isTrue);
      await tester.pumpWidget(_host(
        const AppBanner(message: 'i', tone: AppBannerTone.info),
      ));
      expect(_hasFill(tester, const Color(0xFFDEF1F6)), isTrue);
      await tester.pumpWidget(_host(
        const AppBanner(message: 'd', tone: AppBannerTone.danger),
      ));
      expect(_hasFill(tester, const Color(0xFFFAE6E6)), isTrue);
    });
  });

  group('AppTable (mirror .table)', () {
    testWidgets('header fills surface2 and renders uppercase labels',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppTable(
          columns: [AppTableColumn('Tên'), AppTableColumn('SL', numeric: true)],
          rows: [
            AppTableRow([AppTableCellText('A'), AppTableCellText('1')]),
          ],
        ),
      ));
      expect(_hasFill(tester, AppTokens.surface2), isTrue);
      expect(find.text('TÊN'), findsOneWidget);
    });
  });

  group('AppStepper (mirror .step)', () {
    testWidgets('done/current/gate all render', (tester) async {
      await tester.pumpWidget(_host(
        const AppStepper(steps: [
          AppStepItem(label: 'Báo giá', state: AppStepState.done),
          AppStepItem(label: 'Chờ duyệt', state: AppStepState.current),
          AppStepItem(label: 'Chốt', state: AppStepState.gate),
        ]),
      ));
      expect(find.text('Báo giá'), findsOneWidget);
      expect(find.text('Chờ duyệt'), findsOneWidget);
      // current node ring is drawn as a teal050 double-border container.
      expect(_hasFill(tester, AppTokens.teal050), isTrue);
    });

    testWidgets('non-done nodes show the 1-based number, done shows a check',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppStepper(steps: [
          AppStepItem(label: 'A', state: AppStepState.done),
          AppStepItem(label: 'B', state: AppStepState.current),
          AppStepItem(label: 'C', state: AppStepState.gate),
          AppStepItem(label: 'D'), // defaults to upcoming
        ]),
      ));
      // done (index 0) renders a check, NOT the number 1.
      expect(find.text('1'), findsNothing);
      expect(
        find.byWidgetPredicate((w) => w is AppIcon && w.name == 'ic-check'),
        findsOneWidget,
      );
      // current / gate / upcoming render their 1-based numbers (2, 3, 4).
      expect(find.text('2'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
    });
  });

  group('AppKpi (mirror .kpi)', () {
    testWidgets('value renders at 23px/900', (tester) async {
      await tester.pumpWidget(_host(
        const AppKpi(label: 'Doanh thu', value: '1.2 tỷ', delta: '+5%'),
      ));
      final v = tester.widget<Text>(find.text('1.2 tỷ'));
      expect(v.style?.fontSize, 23.0);
      expect(v.style?.fontWeight, FontWeight.w900);
    });
  });

  group('AppBarChart (mirror .chart)', () {
    List<double> barHeights(WidgetTester tester) => tester
        .widgetList<Container>(find.byType(Container))
        .where((c) =>
            c.decoration is BoxDecoration &&
            (c.decoration! as BoxDecoration).color == AppTokens.teal)
        .map((c) => c.constraints!.maxHeight)
        .toList();

    testWidgets('one column per item with its label and count, in order',
        (tester) async {
      await tester.pumpWidget(_host(const SizedBox(
        width: 300,
        child: AppBarChart(items: [
          AppBarChartItem(label: 'Báo giá', value: 12),
          AppBarChartItem(label: 'Chờ duyệt', value: 4),
        ]),
      )));
      expect(find.text('Báo giá'), findsOneWidget);
      expect(find.text('Chờ duyệt'), findsOneWidget);
      expect(find.text('12'), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('Báo giá')).dx,
        lessThan(tester.getTopLeft(find.text('Chờ duyệt')).dx),
      );
    });

    testWidgets('columns scale against the largest count (120 − 14 px area)',
        (tester) async {
      await tester.pumpWidget(_host(const SizedBox(
        width: 300,
        child: AppBarChart(items: [
          AppBarChartItem(label: 'a', value: 8),
          AppBarChartItem(label: 'b', value: 2),
          AppBarChartItem(label: 'c', value: 0),
        ]),
      )));
      expect(barHeights(tester), [106.0, 106.0 * 25 / 100, 106.0 * 2 / 100]);
    });

    testWidgets('all zeros ⇒ minimum height, no NaN', (tester) async {
      await tester.pumpWidget(_host(const SizedBox(
        width: 300,
        child: AppBarChart(items: [
          AppBarChartItem(label: 'a', value: 0),
          AppBarChartItem(label: 'b', value: 0),
        ]),
      )));
      expect(barHeights(tester), [106.0 * 2 / 100, 106.0 * 2 / 100]);
      expect(tester.takeException(), isNull);
    });
  });

  group('list-state widgets', () {
    testWidgets('skeleton fills surface2 with 6px radius', (tester) async {
      await tester.pumpWidget(_host(const AppSkeleton(width: 100)));
      final c = tester.widget<Container>(find.byType(Container).first);
      final d = c.decoration as BoxDecoration;
      expect(d.color, AppTokens.surface2);
      expect(d.borderRadius, BorderRadius.circular(6.0));
    });

    testWidgets('empty state shows prop copy + action', (tester) async {
      await tester.pumpWidget(_host(
        AppEmptyState(
          title: 'Chưa có đơn nào',
          message: 'Bấm Tạo để bắt đầu.',
          icon: 'ic-orders',
          action: AppButton(label: 'Tạo', onPressed: () {}),
        ),
      ));
      expect(find.text('Chưa có đơn nào'), findsOneWidget);
      expect(find.text('Bấm Tạo để bắt đầu.'), findsOneWidget);
      expect(find.text('Tạo'), findsOneWidget);
    });

    testWidgets('error state reuses a danger banner + retry', (tester) async {
      await tester.pumpWidget(_host(
        AppErrorState(message: 'Lỗi mạng', onRetry: () {}),
      ));
      expect(find.byType(AppBanner), findsOneWidget);
      expect(find.text('Lỗi mạng'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);
    });

    testWidgets('error state without onRetry shows no retry button',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppErrorState(message: 'Lỗi mạng'),
      ));
      expect(find.text('Lỗi mạng'), findsOneWidget);
      expect(find.text('Thử lại'), findsNothing);
    });
  });
}
