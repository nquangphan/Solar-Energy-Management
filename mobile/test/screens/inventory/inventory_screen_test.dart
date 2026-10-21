// hand-authored — widget test for the Tồn kho screen (Story 6.2).
//
// Every state is driven through the REAL screen with ports: loading (a port
// that has not answered), error + retry, empty, and data in all three statuses.
// The purchase-list "hidden" case uses a fixture WITH items that are simply not
// negative — an all-empty fixture would hide the block for the wrong reason.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/inventory_port.dart';
import 'package:pns_mobile/design_system/shell/app_bottom_nav.dart';
import 'package:pns_mobile/screens/inventory/inventory_screen.dart';

/// Never completes — holds the screen in `loading` so the state is observable.
class _TreoPort implements InventoryPort {
  @override
  Future<StockList> listStock({String? q}) => Completer<StockList>().future;
}

/// Fails the first call, answers the demo list afterwards — counts calls.
class _LoiRoiDuocPort implements InventoryPort {
  int soLanGoi = 0;

  @override
  Future<StockList> listStock({String? q}) async {
    soLanGoi++;
    if (soLanGoi == 1) throw Exception('mạng lỗi');
    return kDemoStockList;
  }
}

const String _kTenDaiNhat = 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha';

/// `AppFrame` renders its label upper-cased (mirror `.frame-label`).
const String _kNhanCanMua = 'DANH SÁCH CẦN MUA · GỘP MỌI KHẢ DỤNG ÂM';

Widget _host(InventoryPort port) => MaterialApp(
      home: Scaffold(body: InventoryScreen(port: port)),
    );

void main() {
  testWidgets('loading: cổng chưa trả lời ⇒ skeleton, chưa có thẻ nào',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_TreoPort()));
    await tester.pump();

    expect(find.byType(AppSkeleton), findsWidgets);
    expect(find.byType(AppCard), findsNothing);
  });

  testWidgets('error: hiện lỗi; bấm Thử lại gọi lại cổng và ra dữ liệu',
      (WidgetTester tester) async {
    final _LoiRoiDuocPort port = _LoiRoiDuocPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    expect(find.text('Không tải được tồn kho.'), findsOneWidget);
    expect(port.soLanGoi, 1);

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();

    expect(port.soLanGoi, 2);
    expect(find.text('Không tải được tồn kho.'), findsNothing);
    expect(find.text('Tấm pin AE 630W'), findsOneWidget);
  });

  testWidgets('empty: không sản phẩm nào ⇒ câu rỗng, không bảng cần mua',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const FakeInventoryPort(
      StockList(items: <StockItemView>[], danhSachCanMua: <CanMuaView>[]),
    )));
    await tester.pumpAndSettle();

    expect(
      find.text('Chưa có sản phẩm nào theo dõi tồn kho.'),
      findsOneWidget,
    );
    expect(find.byType(AppTable), findsNothing);
  });

  testWidgets(
      'dữ liệu ba tình trạng: âm hiện "Cần nhập", KHÔNG hiện số âm; viền theo tình trạng',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const FakeInventoryPort()));
    await tester.pumpAndSettle();

    expect(find.text('Cần nhập 15'), findsOneWidget);
    expect(find.text('-15'), findsNothing);
    expect(find.textContaining('-15'), findsNothing);
    expect(
      find.text('Còn 5 · Đã hứa 20 · Cần nhập 15 bộ'),
      findsOneWidget,
    );
    expect(
      find.text('Còn 42 · Đã hứa 14 · Khả dụng 28 tấm'),
      findsOneWidget,
    );
    expect(find.text('Đủ'), findsNWidgets(2));
    expect(find.text('Hết khả dụng'), findsOneWidget);
    expect(find.text('Âm'), findsNWidgets(2));

    final List<AppCardVariant> vien = tester
        .widgetList<AppCard>(find.byType(AppCard))
        .map((AppCard c) => c.variant)
        .toList();
    expect(vien, <AppCardVariant>[
      AppCardVariant.danger,
      AppCardVariant.line,
      AppCardVariant.danger,
      AppCardVariant.warn,
      AppCardVariant.line,
    ]);

    final AppBottomNav nav = tester.widget(find.byType(AppBottomNav));
    expect(nav.activeIndex, kInventoryTabIndex);
  });

  testWidgets('danh sách cần mua hiện khi backend trả món âm',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const FakeInventoryPort()));
    await tester.pumpAndSettle();

    expect(
      find.text(_kNhanCanMua),
      findsOneWidget,
    );
    expect(find.text('15 bộ'), findsOneWidget);
    expect(find.text('2 bình'), findsOneWidget);
  });

  testWidgets('danh sách cần mua ẩn khi có sản phẩm nhưng không món nào âm',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const FakeInventoryPort(
      StockList(
        items: <StockItemView>[
          StockItemView(
            productId: 'prod-pin-ae-630',
            ten: 'Tấm pin AE 630W',
            sku: 'PIN-AE-630',
            donVi: 'tấm',
            onHand: 42,
            reserved: 14,
            khaDung: 28,
            canNhap: 0,
            tinhTrang: 'du',
          ),
        ],
        danhSachCanMua: <CanMuaView>[],
      ),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Tấm pin AE 630W'), findsOneWidget);
    expect(
      find.text(_kNhanCanMua),
      findsNothing,
    );
  });

  for (final double width in <double>[320.0, 360.0]) {
    testWidgets('tên sản phẩm dài nhất dàn trang được ở ${width}px',
        (WidgetTester tester) async {
      tester.view.physicalSize = Size(width, 1600.0);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(const FakeInventoryPort()));
      await tester.pumpAndSettle();

      // Thẻ VÀ dòng bảng cần mua đều mang tên dài nhất — cả hai đã thật sự render.
      expect(find.text(_kTenDaiNhat), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    });
  }
}
