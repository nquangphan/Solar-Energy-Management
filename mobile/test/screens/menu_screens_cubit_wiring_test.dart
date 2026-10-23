// The Menu screens' controls reach their cubit (Story 11.2). The cubit tests prove
// what each method does; these prove the SCREEN still calls it — the search box,
// Thử lại and Huỷ have no other widget case that would notice the wire coming off.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/warranty_port.dart';
import 'package:pns_mobile/screens/customers/customer_list_screen.dart';
import 'package:pns_mobile/screens/customers/customer_pick_screen.dart';
import 'package:pns_mobile/screens/warranty/warranty_lookup_screen.dart';

import 'customers/recording_customers_port.dart';

/// Rejects every lookup, recording the phone it was asked for.
class _FailingWarrantyPort implements WarrantyPort {
  final List<String> calls = [];

  @override
  Future<WarrantyLookup> lookup(String sdt) async {
    calls.add(sdt);
    throw const WarrantyPortException('Số điện thoại không hợp lệ.');
  }
}

Widget _host(Widget screen) => MaterialApp(home: Scaffold(body: screen));

Future<void> _tap(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Khách hàng: typing in the search box queries the backend with that text, from page 1', (tester) async {
    final port = RecordingCustomersPort();
    await tester.pumpWidget(_host(CustomerListScreen(port: port)));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, '0903');
    await tester.pumpAndSettle();

    expect(port.listCalls, [(q: null, custType: null, page: 1), (q: '0903', custType: null, page: 1)]);
  });

  testWidgets('Khách hàng: Thử lại after a failed load asks the backend again', (tester) async {
    final port = RecordingCustomersPort(error: StateError('offline'));
    await tester.pumpWidget(_host(CustomerListScreen(port: port)));
    await tester.pumpAndSettle();
    expect(find.text('Không tải được danh sách khách hàng.'), findsOneWidget);

    await _tap(tester, 'Thử lại');

    expect(port.listCalls, hasLength(2));
  });

  testWidgets('Tra SĐT: Huỷ closes the create form without sending anything', (tester) async {
    final port = RecordingCustomersPort();
    await tester.pumpWidget(_host(CustomerPickScreen(port: port)));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '0903 176 968');
    await _tap(tester, 'Tra cứu');
    await _tap(tester, 'Không phải khách này? Tạo khách hàng mới →');
    expect(find.widgetWithText(AppButton, 'Lưu khách hàng'), findsOneWidget);

    await _tap(tester, 'Huỷ');

    expect(find.widgetWithText(AppButton, 'Lưu khách hàng'), findsNothing);
    expect(port.log, ['listSources', 'lookup']);
  });

  testWidgets('Tra cứu bảo hành: Thử lại sends the typed phone again, raw', (tester) async {
    final port = _FailingWarrantyPort();
    await tester.pumpWidget(_host(WarrantyLookupScreen(port: port)));
    await tester.enterText(find.byType(TextField).first, ' 0903 176 968 ');
    await _tap(tester, 'Tra cứu');
    expect(find.text('Số điện thoại không hợp lệ.'), findsOneWidget);

    await _tap(tester, 'Thử lại');

    expect(port.calls, [' 0903 176 968 ', ' 0903 176 968 ']);
  });
}
