// hand-authored — widget test for the Phiếu kho screen (Story 6.3).
//
// Every state goes through the REAL screen with ports: loading, error + retry,
// empty, data; the detail of a voucher with and without `unitCost`; the create
// sheet (Nhập ↔ Xuất hides the cost field and drops it from the payload; a 409
// lands under the right line); the LONGEST product name at 320/360px; and the
// Phiếu kho entry on the Tồn kho screen, gated on `inventory.manage`.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/gating/app_permissions.dart';
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/fake_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/stock_vouchers_port.dart';
import 'package:pns_mobile/screens/inventory/inventory_screen.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_screen.dart';

/// Never completes — holds the screen in `loading`.
class _TreoPort extends FakeStockVouchersPort {
  @override
  Future<StockVoucherList> listVouchers({String? type}) =>
      Completer<StockVoucherList>().future;
}

/// Fails the first list call, answers the demo list afterwards — counts calls.
class _LoiRoiDuocPort extends FakeStockVouchersPort {
  int soLanGoi = 0;

  @override
  Future<StockVoucherList> listVouchers({String? type}) {
    soLanGoi++;
    if (soLanGoi == 1) throw Exception('mạng lỗi');
    return super.listVouchers(type: type);
  }
}

/// Records every create payload.
class _GhiPort extends FakeStockVouchersPort {
  final List<CreateStockVoucherInput> daGui = <CreateStockVoucherInput>[];

  @override
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input) {
    daGui.add(input);
    return super.createVoucher(input);
  }
}

/// Holds every create call open — counts how many reached the port.
class _TreoTaoPort extends FakeStockVouchersPort {
  int soLanTao = 0;

  @override
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input) {
    soLanTao++;
    return Completer<StockVoucherDetail>().future;
  }
}

/// Every create call throws something that is NOT the AD-5 envelope.
class _MatMangPort extends FakeStockVouchersPort {
  @override
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input) =>
      Future<StockVoucherDetail>.error(Exception('mất mạng'));
}

const String _kTenDaiNhat = 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha';

Widget _host(StockVouchersPort port) => MaterialApp(
      home: Scaffold(
        body: StockVouchersScreen(
          port: port,
          inventoryPort: const FakeInventoryPort(),
        ),
      ),
    );

Finder _o(String label) => find.descendant(
      // `AppField` paints its label upper-cased.
      of: find.widgetWithText(AppField, label.toUpperCase()),
      matching: find.byType(EditableText),
    );

Future<void> _bam(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

void _manHinhCao(WidgetTester tester, [double width = 400.0]) {
  tester.view.physicalSize = Size(width, 1400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

void main() {
  testWidgets('loading: cổng chưa trả lời ⇒ skeleton', (tester) async {
    await tester.pumpWidget(_host(_TreoPort()));
    await tester.pump();

    expect(find.byType(AppSkeleton), findsWidgets);
    expect(find.text('PK-N-0119'), findsNothing);
  });

  testWidgets('error ⇒ thông báo; Thử lại gọi lại cổng và ra danh sách',
      (tester) async {
    final _LoiRoiDuocPort port = _LoiRoiDuocPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    expect(find.text('Không tải được phiếu kho.'), findsOneWidget);
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();

    expect(port.soLanGoi, 2);
    expect(find.text('PK-N-0119'), findsOneWidget);
  });

  testWidgets('empty ⇒ câu mời tạo phiếu', (tester) async {
    await tester
        .pumpWidget(_host(FakeStockVouchersPort(<StockVoucherDetail>[])));
    await tester.pumpAndSettle();

    expect(
      find.text('Chưa có phiếu kho nào. Bấm Tạo phiếu để bắt đầu.'),
      findsOneWidget,
    );
  });

  testWidgets(
      'có dữ liệu: hàng phiếu có mã, tổng SL có dấu, người · ngày UTC+7',
      (tester) async {
    _manHinhCao(tester);
    await tester.pumpWidget(_host(FakeStockVouchersPort()));
    await tester.pumpAndSettle();

    expect(find.text('GẦN ĐÂY'), findsOneWidget);
    expect(find.text('PK-N-0119'), findsOneWidget);
    expect(find.text('+50'), findsOneWidget);
    expect(find.text('−15'), findsOneWidget);
    // 2026-07-05T23:30Z là 06/07 giờ Việt Nam.
    expect(find.text('Kho/Giao hàng (Bình) · 06/07'), findsNWidgets(2));
  });

  testWidgets('chi tiết phiếu nhập: giờ, ghi chú, +SL, cột giá vốn, notecard',
      (tester) async {
    _manHinhCao(tester);
    await tester.pumpWidget(_host(FakeStockVouchersPort()));
    await tester.pumpAndSettle();
    await _bam(tester, find.text('PK-N-0119'));

    expect(find.text('06/07/2026 · 08:05'), findsOneWidget);
    expect(find.text('Nhập từ nhà cung cấp'), findsOneWidget);
    expect(find.text('+40'), findsOneWidget);
    expect(find.text('GIÁ VỐN / ĐV'), findsOneWidget);
    expect(find.text('2.110.000 đ'), findsOneWidget);
    expect(find.textContaining('không được bỏ trống'), findsOneWidget);
  });

  testWidgets('chi tiết không unitCost ⇒ không cột giá vốn, không ô "0"',
      (tester) async {
    _manHinhCao(tester);
    await tester.pumpWidget(_host(FakeStockVouchersPort()));
    await tester.pumpAndSettle();
    await _bam(tester, find.text('PK-X-0096'));

    expect(find.text('−14'), findsOneWidget);
    expect(find.text('Xuất kho · không gắn đơn'), findsOneWidget);
    expect(find.text('GIÁ VỐN / ĐV'), findsNothing);
    expect(find.text('0'), findsNothing);
    expect(find.text('0 đ'), findsNothing);
  });

  testWidgets(
      'form Nhập gửi unitCost nguyên; chọn Xuất ẩn ô giá vốn và bỏ unitCost',
      (tester) async {
    _manHinhCao(tester);
    final _GhiPort port = _GhiPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(tester, find.widgetWithText(AppButton, 'Tồn đầu kỳ'));
    await _bam(
        tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
    await tester.enterText(_o('SL'), '40');
    await tester.enterText(_o('Giá vốn / đv *'), '2.110.000');
    await _bam(tester, find.widgetWithText(AppButton, 'Lưu phiếu'));

    expect(port.daGui, hasLength(1));
    expect(port.daGui[0].type, 'nhap');
    expect(port.daGui[0].note, 'Tồn đầu kỳ');
    expect(port.daGui[0].lines[0].qty, 40);
    expect(port.daGui[0].lines[0].unitCost, 2110000);
    // Sheet đóng, phiếu mới được chọn.
    expect(find.text('Tạo phiếu kho'), findsNothing);
    expect(find.text('PK-N-0120'), findsWidgets);

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(
        tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
    expect(_o('Giá vốn / đv *'), findsOneWidget);
    await _bam(tester, find.widgetWithText(AppButton, 'Xuất'));
    expect(_o('Giá vốn / đv *'), findsNothing);
    await tester.enterText(_o('SL'), '3');
    await _bam(tester, find.widgetWithText(AppButton, 'Lưu phiếu'));

    expect(port.daGui, hasLength(2));
    expect(port.daGui[1].type, 'xuat');
    expect(port.daGui[1].lines[0].unitCost, isNull);
  });

  testWidgets(
      '409 xuất quá tồn ⇒ message backend + lỗi dưới đúng dòng, sheet còn mở',
      (tester) async {
    _manHinhCao(tester);
    await tester.pumpWidget(_host(FakeStockVouchersPort()));
    await tester.pumpAndSettle();

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(tester, find.widgetWithText(AppButton, 'Xuất'));
    await _bam(tester,
        find.widgetWithText(AppButton, 'Battery LiFePO4 10kWh · Còn 0 bình'));
    await tester.enterText(_o('SL'), '1');
    await _bam(tester, find.widgetWithText(AppButton, 'Lưu phiếu'));

    expect(
      find.textContaining('Không đủ tồn — không thể xuất quá số tồn hiện có.'),
      findsOneWidget,
    );
    expect(find.text('Còn 0 bình, không xuất được 1.'), findsOneWidget);
    expect(find.text('Tạo phiếu kho'), findsOneWidget);
  });

  testWidgets('phiếu nhập để trống giá vốn ⇒ unitCost null (không bịa 0)',
      (tester) async {
    _manHinhCao(tester);
    final _GhiPort port = _GhiPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(
        tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
    await tester.enterText(_o('SL'), '2');
    await _bam(tester, find.widgetWithText(AppButton, 'Lưu phiếu'));

    expect(port.daGui, hasLength(1));
    expect(port.daGui[0].type, 'nhap');
    expect(port.daGui[0].lines[0].unitCost, isNull);
  });

  testWidgets('giá vốn gõ 0 thật ⇒ vẫn gửi unitCost 0', (tester) async {
    _manHinhCao(tester);
    final _GhiPort port = _GhiPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(
        tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
    await tester.enterText(_o('SL'), '2');
    await tester.enterText(_o('Giá vốn / đv *'), '0');
    await _bam(tester, find.widgetWithText(AppButton, 'Lưu phiếu'));

    expect(port.daGui[0].lines[0].unitCost, 0);
  });

  testWidgets('lỗi không phải envelope ⇒ báo lỗi, nút Lưu phiếu bật lại',
      (tester) async {
    _manHinhCao(tester);
    await tester.pumpWidget(_host(_MatMangPort()));
    await tester.pumpAndSettle();

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(
        tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
    await tester.enterText(_o('SL'), '1');
    await tester.enterText(_o('Giá vốn / đv *'), '1');
    final Finder luu = find.widgetWithText(AppButton, 'Lưu phiếu');
    await _bam(tester, luu);

    expect(find.text('Không lưu được phiếu. Thử lại.'), findsOneWidget);
    expect(tester.widget<AppButton>(luu).onPressed, isNotNull);
    expect(find.text('Tạo phiếu kho'), findsOneWidget);
  });

  testWidgets(
      'bỏ dòng sau lỗi ⇒ lỗi theo chỉ số dòng không rơi sang sản phẩm khác',
      (tester) async {
    _manHinhCao(tester);
    await tester.pumpWidget(_host(FakeStockVouchersPort()));
    await tester.pumpAndSettle();

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(tester, find.widgetWithText(AppButton, 'Xuất'));
    await _bam(tester,
        find.widgetWithText(AppButton, 'Battery LiFePO4 10kWh · Còn 0 bình'));
    await _bam(
        tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
    await tester.enterText(_o('SL').first, '1');
    await tester.enterText(_o('SL').last, '1');
    await _bam(tester, find.widgetWithText(AppButton, 'Lưu phiếu'));
    expect(find.text('Còn 0 bình, không xuất được 1.'), findsOneWidget);

    // Nút thùng rác của dòng đầu (Battery).
    await _bam(
      tester,
      find
          .byWidgetPredicate(
              (Widget w) => w is AppButton && w.icon == 'ic-trash')
          .first,
    );

    expect(find.text('Còn 0 bình, không xuất được 1.'), findsNothing);
    expect(
      find.textContaining('Không đủ tồn — không thể xuất quá số tồn hiện có.'),
      findsNothing,
    );
  });

  testWidgets('đang gửi ⇒ nút Lưu phiếu tắt; bấm hai lần chỉ gọi cổng một lần',
      (tester) async {
    _manHinhCao(tester);
    final _TreoTaoPort port = _TreoTaoPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    await _bam(tester, find.text('Tạo phiếu'));
    await _bam(
        tester, find.widgetWithText(AppButton, 'Tấm pin AE 630W · Còn 42 tấm'));
    await tester.enterText(_o('SL'), '1');
    await tester.enterText(_o('Giá vốn / đv *'), '1');
    final Finder luu = find.widgetWithText(AppButton, 'Lưu phiếu');
    await tester.ensureVisible(luu);
    await tester.pump();
    await tester.tap(luu);
    await tester.pump();
    await tester.tap(luu, warnIfMissed: false);
    await tester.pump();

    expect(port.soLanTao, 1);
    expect(tester.widget<AppButton>(luu).onPressed, isNull);
  });

  for (final double width in <double>[320.0, 360.0]) {
    testWidgets(
        'tên sản phẩm DÀI NHẤT ở chi tiết và form không tràn ở ${width}px',
        (tester) async {
      tester.view.physicalSize = Size(width, 800.0);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(FakeStockVouchersPort()));
      await tester.pumpAndSettle();
      await _bam(tester, find.text('PK-N-0118'));
      expect(find.text(_kTenDaiNhat), findsOneWidget);
      expect(tester.takeException(), isNull);

      await _bam(tester, find.text('Tạo phiếu'));
      await _bam(
          tester, find.widgetWithText(AppButton, '$_kTenDaiNhat · Còn 5 bộ'));
      expect(_o('Giá vốn / đv *'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  group('InventoryScreen — lối vào Phiếu kho', () {
    testWidgets('có callback + inventory.manage ⇒ nút Phiếu kho gọi callback',
        (tester) async {
      int soLanMo = 0;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: InventoryScreen(
            port: const FakeInventoryPort(),
            onOpenVouchers: () => soLanMo++,
            perms: const <PermissionKey>{AppPermissionKeys.inventoryManage},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Phiếu kho'));
      expect(soLanMo, 1);
    });

    testWidgets('thiếu inventory.manage ⇒ không có nút, dù có callback',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: InventoryScreen(
            port: const FakeInventoryPort(),
            onOpenVouchers: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tấm pin AE 630W'), findsOneWidget);
      expect(find.text('Phiếu kho'), findsNothing);
    });
  });
}
