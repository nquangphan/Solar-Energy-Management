// hand-authored — widget test for the Tra cứu bảo hành screen (Story 5.9).
//
// The four states of AC-13 are driven through the REAL screen with fake ports:
// initial (nothing typed), loading (a port that has not answered yet), not found,
// and a result. Plus the branch that matters most to a staffer on the phone —
// an expired line must not read like a live one.
//
// Lesson from 5.7: the fixture must satisfy EVERY enclosing condition, otherwise
// an inner assert goes green because an outer container was already false.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/warranty_port.dart';
import 'package:pns_mobile/design_system/tokens/app_tokens.dart';
import 'package:pns_mobile/screens/warranty/warranty_lookup_screen.dart';

const String _kSdt = '+84903176968';

class _KetQuaPort implements WarrantyPort {
  const _KetQuaPort(this.ketQua);

  final WarrantyLookup ketQua;

  @override
  Future<WarrantyLookup> lookup(String sdt) async => ketQua;
}

/// Never completes — holds the screen in `loading` so the state is observable.
class _TreoPort implements WarrantyPort {
  @override
  Future<WarrantyLookup> lookup(String sdt) => Completer<WarrantyLookup>().future;
}

class _LoiPort implements WarrantyPort {
  @override
  Future<WarrantyLookup> lookup(String sdt) async =>
      throw const WarrantyPortException('Số điện thoại không hợp lệ.');
}

WarrantyLine _dong({
  required String id,
  required String name,
  required WarrantyLineItemDtoWarrantyStatus trangThai,
  required int remainingMonths,
  required int remainingDays,
  DateTime? warrantyEndAt,
}) {
  return WarrantyLine(
    id: id,
    name: name,
    qty: 2,
    unit: 'tấm',
    warrantyMonths: 60,
    warrantyStartAt: DateTime.utc(2026, 2, 10),
    warrantyEndAt: warrantyEndAt ?? DateTime.utc(2038, 2, 10),
    remainingDays: remainingDays,
    remainingMonths: remainingMonths,
    warrantyStatus: trangThai,
  );
}

WarrantyLookup _coKetQua(List<WarrantyLine> dong) => WarrantyLookup(
      found: true,
      phone: _kSdt,
      customer: const WarrantyCustomer(
        phone: _kSdt,
        name: 'Nguyễn Văn A',
        custType: 'CA_NHAN',
      ),
      orders: <WarrantyOrder>[
        WarrantyOrder(
          id: 'ord-2026-014',
          status: 'nghiem_thu',
          confirmedAt: DateTime.utc(2026, 2, 10),
          lineItems: dong,
        ),
      ],
    );

Widget _host(WarrantyPort port) => MaterialApp(
      home: Scaffold(body: WarrantyLookupScreen(port: port)),
    );

Future<void> _tra(WidgetTester tester) async {
  final Finder nut = find.widgetWithText(AppButton, 'Tra cứu');
  await tester.ensureVisible(nut);
  await tester.pumpAndSettle();
  await tester.tap(nut);
}

void main() {
  testWidgets('state rỗng ban đầu: mời nhập SĐT, chưa có bảng nào',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const _KetQuaPort(
      WarrantyLookup(found: false, phone: _kSdt, customer: null, orders: <WarrantyOrder>[]),
    )));
    await tester.pumpAndSettle();

    expect(
      find.text('Nhập số điện thoại khách để tra cứu bảo hành.'),
      findsOneWidget,
    );
    expect(find.byType(AppTable), findsNothing);
  });

  testWidgets('state loading: cổng chưa trả lời ⇒ skeleton',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_TreoPort()));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pump();

    expect(find.byType(AppSkeleton), findsWidgets);
    expect(find.byType(AppTable), findsNothing);
  });

  testWidgets('state không tìm thấy: 200 found:false ⇒ câu KHÔNG mời tạo khách',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(const _KetQuaPort(
      WarrantyLookup(found: false, phone: _kSdt, customer: null, orders: <WarrantyOrder>[]),
    )));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pumpAndSettle();

    expect(find.text('SĐT chưa có trong hệ thống.'), findsOneWidget);
    // Màn tra bảo hành KHÔNG mời tạo khách — CTA đó sai ngữ cảnh ở đây.
    expect(find.textContaining('Tạo khách'), findsNothing);
  });

  testWidgets('state có kết quả: khách + bảng dòng, ngày hiển thị DD/MM/YYYY',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_KetQuaPort(_coKetQua(<WarrantyLine>[
      _dong(
        id: 'l1',
        name: 'Tấm pin JA Solar 580W',
        trangThai: WarrantyLineItemDtoWarrantyStatus.conHan,
        remainingMonths: 138,
        remainingDays: 4224,
      ),
    ]))));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pumpAndSettle();

    expect(find.textContaining('Nguyễn Văn A'), findsOneWidget);
    expect(find.byType(AppTable), findsOneWidget);
    expect(find.text('Tấm pin JA Solar 580W ×2'), findsOneWidget);
    expect(find.textContaining('đến 10/02/2038'), findsOneWidget);
  });

  testWidgets('dòng het_han đọc KHÁC dòng con_han — không phải cùng một câu',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_KetQuaPort(_coKetQua(<WarrantyLine>[
      _dong(
        id: 'l1',
        name: 'Tấm pin JA Solar 580W',
        trangThai: WarrantyLineItemDtoWarrantyStatus.conHan,
        remainingMonths: 60,
        remainingDays: 1826,
      ),
      _dong(
        id: 'l2',
        name: 'Ắc quy lưu trữ 5kWh',
        trangThai: WarrantyLineItemDtoWarrantyStatus.hetHan,
        // Hết hạn ⇒ backend đã kẹp sàn 0; màn KHÔNG được đưa số đó qua formatter.
        remainingMonths: 0,
        remainingDays: -351,
        warrantyEndAt: DateTime.utc(2025, 8, 1),
      ),
    ]))));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pumpAndSettle();

    expect(find.text('Còn 5 năm'), findsOneWidget);
    expect(find.text('Hết hạn'), findsOneWidget);
    // "Còn 0 năm" là chuỗi mà nhánh het_han sẽ in ra nếu ai đó bỏ case cố định.
    expect(find.text('Còn 0 năm'), findsNothing);
  });

  /// Dòng sắp hết hạn là dòng khách đang gọi tới để hỏi, và nó là dòng có
  /// `remainingMonths == 0` — `formatWarrantyMonths(0)` trả `"0 năm"`, nên câu
  /// theo THÁNG phải nhường chỗ cho câu theo NGÀY dưới mốc một tháng trọn.
  testWidgets('dòng còn dưới một tháng đọc theo NGÀY, không phải "Còn 0 năm"',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_KetQuaPort(_coKetQua(<WarrantyLine>[
      _dong(
        id: 'l1',
        name: 'Tủ điện AC 3 pha',
        trangThai: WarrantyLineItemDtoWarrantyStatus.sapHet,
        remainingMonths: 0,
        remainingDays: 26,
        warrantyEndAt: DateTime.utc(2029, 1, 15),
      ),
    ]))));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pumpAndSettle();

    expect(find.text('Còn 26 ngày'), findsOneWidget);
    expect(find.text('Còn 0 năm'), findsNothing);
  });

  testWidgets('đúng hôm hết hạn vẫn còn bảo hành ⇒ KHÔNG in "Còn 0 ngày"',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_KetQuaPort(_coKetQua(<WarrantyLine>[
      _dong(
        id: 'l1',
        name: 'Tủ điện AC 3 pha',
        trangThai: WarrantyLineItemDtoWarrantyStatus.sapHet,
        remainingMonths: 0,
        remainingDays: 0,
        warrantyEndAt: DateTime.utc(2026, 7, 18),
      ),
    ]))));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pumpAndSettle();

    expect(find.text('Hết hạn hôm nay'), findsOneWidget);
    expect(find.text('Còn 0 ngày'), findsNothing);
  });

  testWidgets('lỗi từ cổng ⇒ hiện NGUYÊN VĂN thông điệp backend + nút Thử lại',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_LoiPort()));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pumpAndSettle();

    expect(find.text('Số điện thoại không hợp lệ.'), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Thử lại'), findsOneWidget);
  });

  testWidgets('an unknown status from a newer backend renders neutrally, never crashes',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_KetQuaPort(_coKetQua(<WarrantyLine>[
      _dong(
        id: 'l1',
        name: 'Tấm pin JA Solar 580W',
        trangThai: WarrantyLineItemDtoWarrantyStatus.fromJson('tam_dung'),
        remainingMonths: 60,
        remainingDays: 1826,
      ),
    ]))));
    await tester.pumpAndSettle();

    await _tra(tester);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    final AppChip chip = tester.widget<AppChip>(find.widgetWithText(AppChip, 'Còn 5 năm'));
    expect(chip.foreground, AppTokens.muted);
  });

  group('dinhDangNgay', () {
    test('a UTC midnight prints its own calendar day', () {
      expect(dinhDangNgay(DateTime.utc(2030, 1, 1)), '01/01/2030');
      expect(dinhDangNgay(DateTime.parse('2030-01-01T00:00:00Z')), '01/01/2030');
    });

    test('the same instant held as device-local time still prints the UTC day', () {
      // 00:00Z is 07:00 in UTC+7; read locally a 17:00Z instant would jump a day.
      expect(dinhDangNgay(DateTime.parse('2030-01-01T00:00:00Z').toLocal()), '01/01/2030');
      expect(dinhDangNgay(DateTime.parse('2029-12-31T17:00:00Z').toLocal()), '31/12/2029');
    });

    test('a missing date is the em dash', () {
      expect(dinhDangNgay(null), '—');
    });
  });
}
