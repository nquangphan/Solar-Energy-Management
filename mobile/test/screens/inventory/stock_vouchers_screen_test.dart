// hand-authored — widget test for the Phiếu kho screen (Story 6.3).
//
// Every state goes through the REAL screen with ports: loading, error + retry,
// empty, data; the detail of a voucher with and without `unitCost`; the create
// sheet (Nhập ↔ Xuất hides the cost field and drops it from the payload; a 409
// lands under the right line); the LONGEST product name at 320/360px; and the
// Phiếu kho entry on the Tồn kho screen, gated on `inventory.manage`.

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/gating/app_permission_keys.g.dart';
import 'package:pns_mobile/design_system/gating/app_permissions.dart';
import 'package:pns_mobile/design_system/session/fake_inventory_port.dart';
import 'package:pns_mobile/design_system/session/fake_stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/session/stock_vouchers_port.dart';
import 'package:pns_mobile/design_system/shell/app_tabs.dart';
import 'package:pns_mobile/screens/inventory/inventory_screen.dart';
import 'package:pns_mobile/screens/inventory/stock_vouchers_screen.dart';

/// Never completes — holds the screen in `loading`.
class _TreoPort extends FakeStockVouchersPort {
  @override
  Future<StockVoucherList> listVouchers({String? type, bool? isReturn}) =>
      Completer<StockVoucherList>().future;
}

/// Fails the first list call, answers the demo list afterwards — counts calls.
class _LoiRoiDuocPort extends FakeStockVouchersPort {
  int soLanGoi = 0;

  @override
  Future<StockVoucherList> listVouchers({String? type, bool? isReturn}) {
    soLanGoi++;
    if (soLanGoi == 1) throw Exception('mạng lỗi');
    return super.listVouchers(type: type, isReturn: isReturn);
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

/// Records the arguments of every list call.
class _ListRecordingPort extends FakeStockVouchersPort {
  _ListRecordingPort(super.data);

  final List<({String? type, bool? isReturn})> listCalls =
      <({String? type, bool? isReturn})>[];

  @override
  Future<StockVoucherList> listVouchers({String? type, bool? isReturn}) {
    listCalls.add((type: type, isReturn: isReturn));
    return super.listVouchers(type: type, isReturn: isReturn);
  }
}

/// Records every return-voucher payload; optionally refuses with [failure].
class _ReturnRecordingPort extends _ListRecordingPort {
  _ReturnRecordingPort(super.data, {this.failure, this.gate});

  final StockVoucherPortException? failure;

  /// When set, the request stays in flight until it completes.
  final Future<void>? gate;
  final List<
      ({
        String origin,
        String? note,
        List<CreateReturnVoucherLineInput> lines
      })> returnCalls = <({
    String origin,
    String? note,
    List<CreateReturnVoucherLineInput> lines
  })>[];

  @override
  Future<StockVoucherDetail> createReturnVoucher(
    String originVoucherId, {
    String? note,
    required List<CreateReturnVoucherLineInput> lines,
  }) async {
    returnCalls.add((origin: originVoucherId, note: note, lines: lines));
    await gate;
    final StockVoucherPortException? e = failure;
    if (e != null) throw e;
    return super.createReturnVoucher(originVoucherId, note: note, lines: lines);
  }
}

const StockVoucherCreator _kActor = StockVoucherCreator(
  id: 'acc-kho-binh',
  displayName: 'Kho/Giao hàng (Bình)',
);

StockVoucherLine _line(String ten, int qty, {int? unitCost}) =>
    StockVoucherLine(
      productId: 'prod-${ten.hashCode}',
      name: ten,
      sku: 'SKU',
      unit: 'bộ',
      qty: qty,
      unitCost: unitCost,
    );

const String _kNameA = 'Tấm pin AE 630W';
const String _kNameB = 'Biến tần hybrid ba pha 10kW';

/// Order-bound stock-out of three products; [canReturn] is the backend's call.
StockVoucherDetail _stockOut({
  required String id,
  required String code,
  required bool canReturn,
  StockVoucherReturnRef? returnVoucher,
  List<StockVoucherLine>? lines,
}) {
  final List<StockVoucherLine> ds = lines ??
      <StockVoucherLine>[
        _line(_kNameA, 5),
        _line(_kNameB, 3),
        _line(_kTenDaiNhat, 2),
      ];
  return StockVoucherDetail(
    id: id,
    code: code,
    type: StockVoucherDetailDtoType.xuat,
    orderId: 'ord-huy-1',
    createdAt: DateTime.utc(2026, 7, 4, 2, 30),
    createdBy: _kActor,
    lineCount: ds.length,
    totalQty: ds.fold<int>(0, (int t, StockVoucherLine l) => t + l.qty.toInt()),
    note: null,
    canReturn: canReturn,
    returnVoucher: returnVoucher,
    lines: ds,
  );
}

StockVoucherDetail _returnVoucher() => StockVoucherDetail(
      id: 'pk-nt-0004',
      code: 'PK-NT-0004',
      type: StockVoucherDetailDtoType.nhap,
      createdAt: DateTime.utc(2026, 7, 6, 1, 5),
      createdBy: _kActor,
      lineCount: 1,
      totalQty: 4,
      returnOfVoucherId: 'pk-x-huy',
      returnOf: const StockVoucherReturnOf(
        id: 'pk-x-huy',
        code: 'PK-X-0095',
        orderId: 'ord-huy-1',
      ),
      note: 'Hỏng 1 tấm',
      canReturn: false,
      lines: <StockVoucherLine>[_line(_kNameA, 4, unitCost: 2110000)],
    );

List<StockVoucherDetail> _returnFixture() => <StockVoucherDetail>[
      _returnVoucher(),
      _stockOut(id: 'pk-x-huy', code: 'PK-X-0095', canReturn: true),
      _stockOut(id: 'pk-x-khong', code: 'PK-X-0090', canReturn: false),
    ];

Finder _tab(String label) => find.descendant(
      of: find.byType(AppTabs),
      matching: find.text(label),
    );

/// The "Nhận lại" inputs of the open return sheet, in displayed order.
Finder get _receivedInputs => find.descendant(
      of: find.byWidgetPredicate(
          (Widget w) => w is AppField && w.semanticsLabel == 'Nhận lại'),
      matching: find.byType(EditableText),
    );

String _inputValue(WidgetTester tester, int i) =>
    tester.widget<EditableText>(_receivedInputs.at(i)).controller.text;

Future<void> _openReturnSheet(
    WidgetTester tester, StockVouchersPort port) async {
  await tester.pumpWidget(_host(port));
  await tester.pumpAndSettle();
  await _bam(tester, find.text('PK-X-0095'));
  await _bam(tester, find.widgetWithText(AppButton, 'Tạo phiếu nhập trả'));
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

  testWidgets('a voucher type this build does not know: neutral chip, no sign, no direction note',
      (tester) async {
    _manHinhCao(tester);
    final Map<String, Object?> json =
        jsonDecode(jsonEncode(kDemoStockVouchers.first.toJson())) as Map<String, Object?>;
    final StockVoucherDetail unknown =
        StockVoucherDetail.fromJson(<String, Object?>{...json, 'type': 'loai_moi', 'returnOfVoucherId': null});
    await tester.pumpWidget(_host(FakeStockVouchersPort(<StockVoucherDetail>[unknown])));
    await tester.pumpAndSettle();

    final String qty = '${unknown.totalQty.toInt()}';
    expect(find.widgetWithText(AppChip, '—'), findsOneWidget);
    expect(find.widgetWithText(AppChip, 'Nhập'), findsNothing);
    expect(find.widgetWithText(AppChip, 'Xuất'), findsNothing);
    expect(find.text(qty), findsOneWidget, reason: 'no guessed + / − sign');

    await _bam(tester, find.text(unknown.code));
    expect(find.text('+$qty'), findsNothing);
    expect(find.text('−$qty'), findsNothing);
    expect(find.byType(AppBanner), findsNothing, reason: 'no stock-in/out note for an unknown type');
    expect(tester.takeException(), isNull);
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
    expect(port.daGui[0].type.json, 'nhap');
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
    expect(port.daGui[1].type.json, 'xuat');
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
    expect(port.daGui[0].type.json, 'nhap');
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

  group('Return vouchers', () {
    testWidgets(
        'four tabs call the right filter: Nhập = nhap+false, Nhập trả = true',
        (tester) async {
      _manHinhCao(tester);
      final _ListRecordingPort port = _ListRecordingPort(kDemoStockVouchers);
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();

      for (final String label in <String>[
        'Tất cả',
        'Nhập',
        'Xuất',
        'Nhập trả'
      ]) {
        expect(_tab(label), findsOneWidget);
      }
      expect(port.listCalls.last, (type: null, isReturn: null));

      await _bam(tester, _tab('Nhập'));
      expect(port.listCalls.last, (type: 'nhap', isReturn: false));
      await _bam(tester, _tab('Xuất'));
      expect(port.listCalls.last, (type: 'xuat', isReturn: null));
      await _bam(tester, _tab('Nhập trả'));
      expect(port.listCalls.last, (type: null, isReturn: true));
    });

    testWidgets('the "Nhập trả" chip only on a row with returnOfVoucherId',
        (tester) async {
      _manHinhCao(tester);
      await tester.pumpWidget(_host(FakeStockVouchersPort(_returnFixture())));
      await tester.pumpAndSettle();

      final Finder chip = find.widgetWithText(AppChip, 'Nhập trả');
      expect(chip, findsOneWidget);
      final Finder returnRow = find.ancestor(
          of: find.text('PK-NT-0004'), matching: find.byType(Row));
      expect(find.descendant(of: returnRow, matching: chip), findsOneWidget);
      // A return voucher shows ONLY "Nhập trả" — never "Nhập" beside it.
      expect(
          find.descendant(
              of: returnRow, matching: find.widgetWithText(AppChip, 'Nhập')),
          findsNothing);
      expect(find.widgetWithText(AppChip, 'Nhập'), findsNothing);

      // Same in the detail header.
      await _bam(tester, find.text('PK-NT-0004'));
      expect(find.widgetWithText(AppChip, 'Nhập trả'), findsNWidgets(2));
      expect(find.widgetWithText(AppChip, 'Nhập'), findsNothing);
    });

    testWidgets(
        'the button shows only when canReturn; a canReturn=false voucher has none',
        (tester) async {
      _manHinhCao(tester);
      await tester.pumpWidget(_host(FakeStockVouchersPort(_returnFixture())));
      await tester.pumpAndSettle();

      // Detail loaded, order-bound voucher: every enclosing condition is on.
      await _bam(tester, find.text('PK-X-0090'));
      expect(find.text('Gắn đơn'), findsOneWidget);
      expect(find.text('Tạo phiếu nhập trả'), findsNothing);

      await _bam(tester, find.text('PK-X-0095'));
      expect(find.text('Gắn đơn'), findsOneWidget);
      expect(find.text('Tạo phiếu nhập trả'), findsOneWidget);
    });

    testWidgets(
        'a stock-out that has a return ⇒ Phiếu nhập trả row that opens it',
        (tester) async {
      _manHinhCao(tester);
      final List<StockVoucherDetail> data = <StockVoucherDetail>[
        _returnVoucher(),
        _stockOut(
          id: 'pk-x-huy',
          code: 'PK-X-0095',
          canReturn: false,
          returnVoucher:
              const StockVoucherReturnRef(id: 'pk-nt-0004', code: 'PK-NT-0004'),
        ),
      ];
      await tester.pumpWidget(_host(FakeStockVouchersPort(data)));
      await tester.pumpAndSettle();
      await _bam(tester, find.text('PK-X-0095'));

      expect(find.text('Phiếu nhập trả'), findsOneWidget);
      expect(find.text('Tạo phiếu nhập trả'), findsNothing);
      // List row + KV row: tap the KV row (the last one) to open the return voucher.
      await _bam(tester, find.text('PK-NT-0004').last);
      expect(find.text('Phiếu xuất gốc'), findsOneWidget);
    });

    testWidgets(
        'sheet: Nhận lại starts at the issued qty, with the exact spec copy',
        (tester) async {
      _manHinhCao(tester);
      await _openReturnSheet(tester, FakeStockVouchersPort(_returnFixture()));

      expect(find.text('Tạo phiếu nhập trả'), findsWidgets);
      expect(
        find.text(
            'Đơn đã huỷ sau khi xuất kho. Tồn kho không tự cộng lại — hàng chỉ về kho khi có người đếm và xác nhận phiếu này.'),
        findsOneWidget,
      );
      expect(find.text('Sản phẩm'), findsWidgets);
      expect(find.text('Đã xuất'), findsOneWidget);
      expect(find.text('Nhận lại'), findsOneWidget);
      expect(
        find.text(
            'Nhận lại ít hơn đã xuất là chuyện bình thường (hàng đã cắt, đã lắp, hỏng). Nhập đúng số đếm được — không ép cho khớp.'),
        findsOneWidget,
      );
      expect(
        find.text(
            'Xác nhận → cộng tồn thật đúng số đếm được, Audit ghi người nhận. Không sửa/xoá sau khi lưu.'),
        findsOneWidget,
      );
      expect(
          find.widgetWithText(AppButton, 'Xác nhận nhập trả'), findsOneWidget);
      expect(<String>[for (int i = 0; i < 3; i++) _inputValue(tester, i)],
          <String>['5', '3', '2']);
    });

    testWidgets(
        'a 0 row is not sent; other qtys are sent as typed; the note goes along',
        (tester) async {
      _manHinhCao(tester);
      final _ReturnRecordingPort port = _ReturnRecordingPort(_returnFixture());
      await _openReturnSheet(tester, port);

      await tester.enterText(_receivedInputs.at(0), '0');
      await tester.enterText(_receivedInputs.at(1), '2');
      await tester.enterText(_o('Ghi chú'), 'Hỏng 1 bộ');
      await _bam(tester, find.widgetWithText(AppButton, 'Xác nhận nhập trả'));

      expect(port.returnCalls, hasLength(1));
      expect(port.returnCalls[0].origin, 'pk-x-huy');
      expect(port.returnCalls[0].note, 'Hỏng 1 bộ');
      expect(port.returnCalls[0].lines.map((l) => l.qty).toList(), <int>[2, 2]);
      // The sheet is gone and the NEW voucher is open in the detail.
      expect(find.text('Xác nhận nhập trả'), findsNothing);
      expect(find.text('PK-NT-0005'), findsWidgets);
      expect(find.text('Nhập trả · từ đơn huỷ'), findsOneWidget);
      expect(find.text('Tạo phiếu nhập trả'), findsNothing);
      // The origin has its return voucher now and offers no second return.
      await _bam(tester, find.text('PK-X-0095').first);
      expect(find.text('Tạo phiếu nhập trả'), findsNothing);
      expect(find.text('Phiếu nhập trả'), findsOneWidget);
    });

    testWidgets('every row 0 ⇒ button disabled, port not called',
        (tester) async {
      _manHinhCao(tester);
      final _ReturnRecordingPort port = _ReturnRecordingPort(_returnFixture());
      await _openReturnSheet(tester, port);

      for (int i = 0; i < 3; i++) {
        await tester.enterText(_receivedInputs.at(i), '0');
      }
      await tester.pump();
      final Finder nut = find.widgetWithText(AppButton, 'Xác nhận nhập trả');
      expect(tester.widget<AppButton>(nut).onPressed, isNull);
      expect(port.returnCalls, isEmpty);
    });

    testWidgets(
        'a blank row ⇒ error under it, port NOT called (blank is never coerced to 0)',
        (tester) async {
      _manHinhCao(tester);
      final _ReturnRecordingPort port = _ReturnRecordingPort(_returnFixture());
      await _openReturnSheet(tester, port);

      await tester.enterText(_receivedInputs.at(1), '');
      await _bam(tester, find.widgetWithText(AppButton, 'Xác nhận nhập trả'));

      expect(find.text('Nhập số nhận lại (0 nếu không nhận lại).'),
          findsOneWidget);
      expect(port.returnCalls, isEmpty);
    });

    testWidgets(
        'RETURN_EXCEEDS_ISSUED: the submitted index maps back to the right displayed row when a 0 row precedes it',
        (tester) async {
      _manHinhCao(tester);
      const String message = 'Chỉ xuất 3, không nhận lại được 9.';
      final _ReturnRecordingPort port = _ReturnRecordingPort(
        _returnFixture(),
        failure: const StockVoucherPortException(
          'Số nhận lại vượt số đã xuất.',
          fieldErrors: <StockVoucherFieldError>[
            StockVoucherFieldError(
              field: 'lines.0.qty',
              code: 'RETURN_EXCEEDS_ISSUED',
              message: message,
            ),
          ],
        ),
      );
      await _openReturnSheet(tester, port);

      // Displayed row 0 is 0 (not sent) ⇒ displayed row 1 is lines.0 of the sent array.
      await tester.enterText(_receivedInputs.at(0), '0');
      await tester.enterText(_receivedInputs.at(1), '9');
      await _bam(tester, find.widgetWithText(AppButton, 'Xác nhận nhập trả'));

      expect(port.returnCalls[0].lines, hasLength(2));
      expect(find.text(message), findsOneWidget);
      final double yError = tester.getTopLeft(find.text(message)).dy;
      final double yRow0 = tester.getTopLeft(_receivedInputs.at(0)).dy;
      final double yRow1 = tester.getTopLeft(_receivedInputs.at(1)).dy;
      final double yRow2 = tester.getTopLeft(_receivedInputs.at(2)).dy;
      expect(yError, greaterThan(yRow1));
      expect(yError, lessThan(yRow2));
      expect(yError, greaterThan(yRow0));
      // The sheet stays open for correction.
      expect(
          find.widgetWithText(AppButton, 'Xác nhận nhập trả'), findsOneWidget);
    });

    testWidgets(
        'return voucher detail: Loại, Gắn đơn, Phiếu xuất gốc, Người nhận, cost',
        (tester) async {
      _manHinhCao(tester);
      await tester.pumpWidget(_host(FakeStockVouchersPort(_returnFixture())));
      await tester.pumpAndSettle();
      await _bam(tester, find.text('PK-NT-0004'));

      expect(find.text('Nhập trả · từ đơn huỷ'), findsOneWidget);
      expect(find.text('Gắn đơn'), findsOneWidget);
      expect(find.text('ord-huy-1'), findsOneWidget);
      expect(find.text('Phiếu xuất gốc'), findsOneWidget);
      // List row + the "Phiếu xuất gốc" KV row.
      expect(find.text('PK-X-0095'), findsNWidgets(2));
      expect(find.text('Người nhận'), findsOneWidget);
      expect(find.text('Hỏng 1 tấm'), findsOneWidget);
      expect(find.text('2.110.000 đ'), findsOneWidget);
      expect(find.text('Tạo phiếu nhập trả'), findsNothing);
    });

    testWidgets(
        'saving from another tab lands on "Tất cả" with the new voucher listed',
        (tester) async {
      _manHinhCao(tester);
      final _ReturnRecordingPort port = _ReturnRecordingPort(_returnFixture());
      await tester.pumpWidget(_host(port));
      await tester.pumpAndSettle();
      await _bam(tester, find.text('PK-X-0095'));
      await _bam(tester, _tab('Xuất'));
      await _bam(tester, find.widgetWithText(AppButton, 'Tạo phiếu nhập trả'));
      await _bam(tester, find.widgetWithText(AppButton, 'Xác nhận nhập trả'));

      expect(port.listCalls.last, (type: null, isReturn: null));
      // List row + detail header: the new voucher is in the list, not only opened.
      expect(find.text('PK-NT-0005'), findsNWidgets(2));
      expect(find.text('Nhập trả · từ đơn huỷ'), findsOneWidget);
    });

    testWidgets('double submit ⇒ the port is called exactly once',
        (tester) async {
      _manHinhCao(tester);
      final Completer<void> gate = Completer<void>();
      final _ReturnRecordingPort port =
          _ReturnRecordingPort(_returnFixture(), gate: gate.future);
      await _openReturnSheet(tester, port);

      final Finder confirm =
          find.widgetWithText(AppButton, 'Xác nhận nhập trả');
      await tester.ensureVisible(confirm);
      await tester.pumpAndSettle();
      await tester.tap(confirm);
      await tester.tap(confirm);
      await tester.pump();
      expect(port.returnCalls, hasLength(1));

      gate.complete();
      await tester.pumpAndSettle();
      expect(port.returnCalls, hasLength(1));
    });

    testWidgets(
        'closing the sheet while the request is in flight is blocked; the result is not lost',
        (tester) async {
      _manHinhCao(tester);
      final Completer<void> gate = Completer<void>();
      final _ReturnRecordingPort port =
          _ReturnRecordingPort(_returnFixture(), gate: gate.future);
      await _openReturnSheet(tester, port);

      await _bam(tester, find.widgetWithText(AppButton, 'Xác nhận nhập trả'));
      expect(port.returnCalls, hasLength(1));

      // Close button, barrier tap and the system back are all ignored while sending.
      await tester.tap(find.byWidgetPredicate(
          (Widget w) => w is AppButton && w.icon == 'ic-close'));
      await tester.tapAt(const Offset(10.0, 10.0));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Xác nhận nhập trả'), findsOneWidget);

      gate.complete();
      await tester.pumpAndSettle();
      expect(find.text('Xác nhận nhập trả'), findsNothing);
      expect(find.text('Nhập trả · từ đơn huỷ'), findsOneWidget);
      expect(find.text('PK-NT-0005'), findsWidgets);
    });

    for (final double width in <double>[320.0, 360.0]) {
      testWidgets('no overflow at ${width}px: list, return detail, sheet',
          (tester) async {
        tester.view.physicalSize = Size(width, 1400.0);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(_host(FakeStockVouchersPort(_returnFixture())));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);

        await _bam(tester, find.text('PK-NT-0004'));
        expect(tester.takeException(), isNull);

        await _bam(tester, find.text('PK-X-0095').first);
        await _bam(
            tester, find.widgetWithText(AppButton, 'Tạo phiếu nhập trả'));
        expect(find.text(_kTenDaiNhat), findsWidgets);
        await tester.enterText(_receivedInputs.at(2), '');
        await tester.enterText(_receivedInputs.at(0), '999');
        await _bam(tester, find.widgetWithText(AppButton, 'Xác nhận nhập trả'));
        expect(find.text('Nhập số nhận lại (0 nếu không nhận lại).'),
            findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('InventoryScreen — lối vào Phiếu kho', () {
    testWidgets('có callback + inventory.manage ⇒ nút Phiếu kho gọi callback',
        (tester) async {
      int soLanMo = 0;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: InventoryScreen(
            port: const FakeInventoryPort(),
            onOpenVouchers: () async => soLanMo++,
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
            onOpenVouchers: () async {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tấm pin AE 630W'), findsOneWidget);
      expect(find.text('Phiếu kho'), findsNothing);
    });
  });
}
