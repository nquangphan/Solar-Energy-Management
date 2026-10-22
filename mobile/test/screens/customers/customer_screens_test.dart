// Native Flutter widget tests for the three Khách hàng screens (Story 3.4).
// Mirrors mobile/test/screens/account/profile_screen_test.dart.
//
// These exist because mobile CAN run them. The web half of this story is guarded
// only by text (no tsc/bundler/JSDOM yet), but Flutter has a real widget harness —
// so the behaviour the text-guard cannot see gets asserted here instead of taken on
// faith: that a miss renders the exact empty copy, that each customer type shows its
// OWN fields, and that a backend rejection reaches the user in the BACKEND'S words.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/screens/customers/customer_detail_screen.dart';
import 'package:pns_mobile/screens/customers/customer_list_screen.dart';
import 'package:pns_mobile/screens/customers/customer_pick_screen.dart';

/// A port that rejects every write the way the real backend does — with the AD-5
/// envelope. This is the only way to prove the screen shows the BACKEND'S sentence.
class _RejectingPort extends FakeCustomersPort {
  _RejectingPort(this.error, {this.rejectLookup = true});

  final CustomerPortException error;

  /// The create-form cases need the lookup to SUCCEED (a miss opens the form) and only
  /// the write to be refused.
  final bool rejectLookup;

  @override
  Future<CustomerLookup> lookup(String sdt) async {
    if (rejectLookup) throw error;
    return super.lookup(sdt);
  }

  @override
  Future<Customer> create(CreateCustomerInput input) async => throw error;
}

/// A port whose reads always fail — the list/detail error state.
class _FailingReadPort extends FakeCustomersPort {
  @override
  Future<CustomerPage> list({
    String? q,
    String? custType,
    int? page,
    int? pageSize,
  }) async =>
      throw StateError('network down');

  @override
  Future<Customer> get(String sdt) async => throw StateError('network down');
}

Widget _host(Widget screen) => MaterialApp(home: Scaffold(body: screen));

/// Tap the BUTTON carrying [label] — several labels (`Cá nhân`, `Xem`) also appear as
/// chips or rows, so the finder names the button explicitly.
Future<void> _tap(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  group('CustomerPickScreen (Story 3.4)', () {
    testWidgets(
        'a phone with no customer shows the exact empty copy + inline create',
        (WidgetTester tester) async {
      await tester
          .pumpWidget(_host(CustomerPickScreen(port: FakeCustomersPort())));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '0999888777');
      await _tap(tester, 'Tra cứu');

      // The copy EXPERIENCE.md mandates — and the way forward it mandates with it.
      expect(find.text('SĐT chưa có trong hệ thống.'), findsOneWidget);
      expect(find.text('Tạo khách hàng mới'), findsOneWidget);
      expect(find.text('Không tìm thấy kết quả'), findsNothing);
    });

    testWidgets(
        'a known phone shows the match card and hands the customer to onSelect',
        (WidgetTester tester) async {
      Customer? picked;
      await tester.pumpWidget(_host(CustomerPickScreen(
        port: FakeCustomersPort(),
        onSelect: (Customer c) => picked = c,
      )));
      await tester.pumpAndSettle();

      // Typed the way a human types it — the raw string, not the E.164 key.
      await tester.enterText(find.byType(TextField).first, '0903176968');
      await _tap(tester, 'Tra cứu');

      expect(find.text('Khách cũ — trùng khớp'), findsOneWidget);
      expect(find.text('Nguyễn Văn A'), findsOneWidget);

      await _tap(tester, 'Dùng khách này');
      expect(picked?.phone, '+84903176968');
    });

    testWidgets(
        'a rejected lookup shows the BACKEND message, not one invented here (AC-2)',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerPickScreen(
        port: _RejectingPort(const CustomerPortException(
          'Số điện thoại không hợp lệ.',
          fieldErrors: {
            'sdt':
                'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).'
          },
        )),
      )));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, 'abc');
      await _tap(tester, 'Tra cứu');

      // The client owns no phone rule (AD-9), so it owns no words for one: the sentence
      // on screen must be the server's. A generic "try again" would bury the reason.
      expect(find.text('Số điện thoại không hợp lệ.'), findsOneWidget);
      expect(find.text('Không thực hiện được. Thử lại.'), findsNothing);
    });

    testWidgets(
        'a rejected create pins each field error to the field it names (AC-4)',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerPickScreen(
        port: _RejectingPort(
          const CustomerPortException(
            'Nguồn "Khác" phải ghi rõ ở ô ghi chú nguồn.',
            fieldErrors: {
              'sourceNote': 'Chọn nguồn "Khác" thì phải ghi rõ nguồn thực tế.'
            },
          ),
          rejectLookup: false,
        ),
      )));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '0999888777');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Tạo khách hàng mới');
      // Pick the isOther source, which is the case the backend rejects a missing note
      // for — and the case in which the note input is on screen to carry the error.
      await _tap(tester, 'Khác');
      await _tap(tester, 'Lưu khách hàng');

      expect(find.text('Nguồn "Khác" phải ghi rõ ở ô ghi chú nguồn.'),
          findsOneWidget);
      expect(
        find.text('Chọn nguồn "Khác" thì phải ghi rõ nguồn thực tế.'),
        findsOneWidget,
      );
    });

    testWidgets(
        '"Ghi rõ nguồn" appears only for a source carrying the isOther flag (AC-4)',
        (WidgetTester tester) async {
      await tester
          .pumpWidget(_host(CustomerPickScreen(port: FakeCustomersPort())));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '0999888777');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Tạo khách hàng mới');

      // No source chosen yet ⇒ the note field is not offered.
      expect(find.text('GHI RÕ NGUỒN'), findsNothing);

      // 'Facebook' does NOT carry isOther — still nothing.
      await _tap(tester, 'Facebook');
      expect(find.text('GHI RÕ NGUỒN'), findsNothing);

      // The demo catalogue's isOther source does. The FLAG decides it, not the name.
      await _tap(tester, 'Khác');
      expect(find.text('GHI RÕ NGUỒN'), findsOneWidget);
    });
  });

  group('CustomerPickScreen over the generated contract (Story 10.7)', () {
    const List<CustomerSource> withRetired = <CustomerSource>[
      CustomerSource(id: 'src-facebook', name: 'Facebook', active: true, isOther: false, sortOrder: 1),
      CustomerSource(id: 'src-retired', name: 'Hội chợ 2025', active: false, isOther: false, sortOrder: 2),
    ];

    testWidgets('the create select offers only active sources',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerPickScreen(port: FakeCustomersPort(sources: withRetired))));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '0999888777');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Tạo khách hàng mới');

      expect(find.widgetWithText(AppButton, 'Facebook'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Hội chợ 2025'), findsNothing);
    });

    testWidgets('a customer filed under a switched-off source still shows its name',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerDetailScreen(
        port: FakeCustomersPort(
          sources: withRetired,
          customers: <Customer>[
            Customer(
              phone: '+84903176968',
              custType: 'CA_NHAN',
              name: 'Khách hội chợ',
              sourceId: 'src-retired',
              createdAt: DateTime.utc(2026, 7, 13),
              updatedAt: DateTime.utc(2026, 7, 13),
            ),
          ],
        ),
        sdt: '+84903176968',
      )));
      await tester.pumpAndSettle();

      expect(find.text('Hội chợ 2025'), findsOneWidget);
    });

    testWidgets('a phone field error lands under the SĐT input, verbatim',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerPickScreen(
        port: _RejectingPort(
          const CustomerPortException(
            'Số điện thoại đã tồn tại.',
            fieldErrors: {'phone': 'Đã có khách hàng với số điện thoại này.'},
          ),
          rejectLookup: false,
        ),
      )));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '0999888777');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Tạo khách hàng mới');
      await _tap(tester, 'Facebook');
      await _tap(tester, 'Lưu khách hàng');

      final Finder fieldError = find.widgetWithText(AppBanner, 'Đã có khách hàng với số điện thoại này.');
      expect(fieldError, findsOneWidget);
      // Under the SĐT field, above the Tra cứu button.
      expect(
        tester.getTopLeft(fieldError).dy,
        lessThan(tester.getTopLeft(find.widgetWithText(AppButton, 'Tra cứu')).dy),
      );
    });

    testWidgets('a national-id field error lands under the CCCD input',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerPickScreen(
        port: _RejectingPort(
          const CustomerPortException(
            'Dữ liệu không hợp lệ.',
            fieldErrors: {'nationalId': 'CCCD phải có 12 chữ số.'},
          ),
          rejectLookup: false,
        ),
      )));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '0999888777');
      await _tap(tester, 'Tra cứu');
      await _tap(tester, 'Tạo khách hàng mới');
      await _tap(tester, 'Facebook');
      await _tap(tester, 'Lưu khách hàng');

      expect(find.text('CCCD phải có 12 chữ số.'), findsOneWidget);
    });
  });

  group('CustomerFacts — each type sees only its own fields (AC-6)', () {
    testWidgets('a Cá nhân shows CCCD and never MST / Tài khoản NH',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerDetailScreen(
        port: FakeCustomersPort(),
        sdt: '+84903176968',
      )));
      await tester.pumpAndSettle();

      expect(find.text('CCCD'), findsOneWidget);
      expect(find.text('MST'), findsNothing);
      expect(find.text('TÀI KHOẢN NH'), findsNothing);
      expect(find.text('KHÁCH · CÁ NHÂN'), findsOneWidget);
    });

    testWidgets('a Thương mại shows MST + Tài khoản NH and never CCCD',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerDetailScreen(
        port: FakeCustomersPort(),
        sdt: '+84912345678',
      )));
      await tester.pumpAndSettle();

      expect(find.text('MST'), findsOneWidget);
      expect(find.text('TÀI KHOẢN NH'), findsOneWidget);
      expect(find.text('CCCD'), findsNothing);
      expect(find.text('KHÁCH · THƯƠNG MẠI'), findsOneWidget);
      // This customer sits on the isOther source, so the note is part of the truth.
      expect(find.text('GHI RÕ NGUỒN'), findsOneWidget);
      expect(find.text('Khách cũ giới thiệu'), findsOneWidget);
    });

    testWidgets(
        'an empty nullable field renders — , never a blank and never "null"',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerDetailScreen(
        port: FakeCustomersPort(customers: <Customer>[
          Customer(
            phone: '+84903176968',
            custType: 'CA_NHAN',
            name: 'Khách không địa chỉ',
            sourceId: 'src-facebook',
            createdAt: DateTime.utc(2026, 7, 13),
            updatedAt: DateTime.utc(2026, 7, 13),
          ),
        ]),
        sdt: '+84903176968',
      )));
      await tester.pumpAndSettle();

      // ĐỊA CHỈ and CCCD are both empty on this customer: the rows STAY, carrying —,
      // because "this customer has no address" is information the user needs.
      expect(find.text('ĐỊA CHỈ'), findsOneWidget);
      expect(find.text('—'), findsNWidgets(2));
      expect(find.text('null'), findsNothing);
    });

    testWidgets('a failed detail load offers a retry that actually reloads',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerDetailScreen(
        port: _FailingReadPort(),
        sdt: '+84903176968',
      )));
      await tester.pumpAndSettle();

      expect(find.text('Thử lại'), findsOneWidget);
    });
  });

  group('CustomerListScreen (Story 3.4)', () {
    testWidgets('renders one row per customer — name, phone, type chip, Xem',
        (WidgetTester tester) async {
      String? opened;
      await tester.pumpWidget(_host(CustomerListScreen(
        port: FakeCustomersPort(),
        onOpen: (String sdt) => opened = sdt,
      )));
      await tester.pumpAndSettle();

      expect(find.text('Nguyễn Văn A'), findsOneWidget);
      expect(find.text('+84903176968'), findsOneWidget);
      expect(find.text('Công ty TNHH Hoà Phát'), findsOneWidget);
      expect(find.text('Xem'), findsNWidgets(2));

      await _tap(tester, 'Xem');
      expect(opened, isNotNull);
    });

    testWidgets('an empty catalogue shows the empty state, not an empty table',
        (WidgetTester tester) async {
      await tester.pumpWidget(_host(CustomerListScreen(
        port: FakeCustomersPort(customers: const <Customer>[]),
      )));
      await tester.pumpAndSettle();

      expect(find.text('Chưa có khách hàng nào'), findsOneWidget);
      expect(find.text('Thêm khách đầu tiên để bắt đầu tạo báo giá.'),
          findsOneWidget);
    });

    testWidgets('a failed load shows the error state with a retry',
        (WidgetTester tester) async {
      await tester
          .pumpWidget(_host(CustomerListScreen(port: _FailingReadPort())));
      await tester.pumpAndSettle();

      expect(find.text('Không tải được danh sách khách hàng.'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);
    });

    testWidgets(
        'the type filter asks the BACKEND — it does not filter in memory (AD-1)',
        (WidgetTester tester) async {
      await tester
          .pumpWidget(_host(CustomerListScreen(port: FakeCustomersPort())));
      await tester.pumpAndSettle();

      expect(find.text('Công ty TNHH Hoà Phát'), findsOneWidget);

      await _tap(tester, 'Cá nhân');
      await tester.pumpAndSettle();

      // The port re-queried with custType — the commercial customer is gone.
      expect(find.text('Nguyễn Văn A'), findsOneWidget);
      expect(find.text('Công ty TNHH Hoà Phát'), findsNothing);
    });

    testWidgets(
        'pages through a result set larger than one page — Trước/Sau + Trang X/Y (C-9)',
        (WidgetTester tester) async {
      // 25 customers, pageSize defaults to 20 ⇒ two pages. The backend slices;
      // the screen only asks for a page and renders what it is handed.
      final List<Customer> many = List<Customer>.generate(
        25,
        (int i) => Customer(
          phone: '+8490300${(i + 10).toString().padLeft(4, '0')}',
          custType: 'CA_NHAN',
          name: 'Khách số $i',
          sourceId: 'src-fb',
          createdAt: DateTime.utc(2026, 1, 1),
          updatedAt: DateTime.utc(2026, 1, 1),
        ),
      );
      await tester.pumpWidget(
          _host(CustomerListScreen(port: FakeCustomersPort(customers: many))));
      await tester.pumpAndSettle();

      // Page 1 of 2: 20 rows, the indicator, and both controls.
      expect(find.text('Trang 1/2'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Xem'), findsNWidgets(20));

      // Advancing asks the backend for page 2, which returns the 5-row tail.
      await _tap(tester, 'Sau');
      expect(find.text('Trang 2/2'), findsOneWidget);
      expect(find.widgetWithText(AppButton, 'Xem'), findsNWidgets(5));
    });
  });
}
