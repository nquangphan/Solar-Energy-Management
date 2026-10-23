// The Menu screens torn down while their port call is still in flight (Story 11.2).
// Under BLoC the cubit closes with the widget, so the late answer — success or
// failure — must neither throw (emit after close) nor fire the screen's callback.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/app_session.dart';
import 'package:pns_mobile/design_system/session/me_port.dart';
import 'package:pns_mobile/design_system/session/password_port.dart';
import 'package:pns_mobile/design_system/session/warranty_port.dart';
import 'package:pns_mobile/screens/account/profile_screen.dart';
import 'package:pns_mobile/screens/customers/customer_detail_screen.dart';
import 'package:pns_mobile/screens/customers/customer_list_screen.dart';
import 'package:pns_mobile/screens/customers/customer_pick_screen.dart';
import 'package:pns_mobile/screens/warranty/warranty_lookup_screen.dart';

import 'customers/recording_customers_port.dart';

class _PendingWarrantyPort implements WarrantyPort {
  final Completer<WarrantyLookup> reply = Completer<WarrantyLookup>();
  int lookups = 0;

  @override
  Future<WarrantyLookup> lookup(String sdt) {
    lookups++;
    return reply.future;
  }
}

class _PendingPasswordPort implements PasswordPort {
  final Completer<void> reply = Completer<void>();
  int changes = 0;

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) {
    changes++;
    return reply.future;
  }

  @override
  Future<int> requestResetCode(String phone) async => 300;

  @override
  Future<void> resetPassword({required String phone, required String code, required String newPassword}) async {}
}

const MeResponse _me = MeResponse(id: 'acc-1', email: 'a@b.c', phone: null, displayName: 'A', permissions: []);

Widget _host(Widget child) => MaterialApp(
      home: PermissionsScope(status: SessionStatus.ready, perms: const {}, me: _me, child: Scaffold(body: child)),
    );

Future<void> _tapLabel(WidgetTester tester, String label) async {
  final finder = find.widgetWithText(AppButton, label).first;
  await tester.ensureVisible(finder);
  // Settle first: a focused field may still be scrolling itself into view.
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Removes the screen, then answers the pending call with [error] (or a value).
Future<void> _leaveThenAnswer(WidgetTester tester, Completer<void> pending, Object? error) async {
  await tester.pumpWidget(const SizedBox());
  error == null ? pending.complete() : pending.completeError(error);
  await tester.pump();
  expect(tester.takeException(), isNull);
}

void main() {
  for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
    testWidgets('Khách hàng left while the list loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingCustomersPort(hold: true);
      await tester.pumpWidget(_host(CustomerListScreen(port: port)));
      expect(port.log, ['list']);
      await _leaveThenAnswer(tester, port.pending.single, error);
    });

    testWidgets('Chi tiết khách left while the customer loads, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingCustomersPort(hold: true);
      await tester.pumpWidget(_host(CustomerDetailScreen(port: port, sdt: '0903')));
      expect(port.log, ['get']);
      await _leaveThenAnswer(tester, port.pending.single, error);
    });

    testWidgets('Tra SĐT left while the sources load, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingCustomersPort(hold: true);
      await tester.pumpWidget(_host(CustomerPickScreen(port: port)));
      expect(port.log, ['listSources']);
      await _leaveThenAnswer(tester, port.pending.single, error);
    });

    testWidgets('Tra SĐT left during a lookup, then the port $outcome ⇒ no crash', (tester) async {
      final port = RecordingCustomersPort(hold: true);
      await tester.pumpWidget(_host(CustomerPickScreen(port: port)));
      port.pending.single.complete();
      await tester.pump();
      await tester.enterText(find.byType(TextField).first, '0903 176 968');
      await _tapLabel(tester, 'Tra cứu');
      expect(port.log, ['listSources', 'lookup']);
      await _leaveThenAnswer(tester, port.pending.last, error);
    });

    testWidgets('Tra SĐT left while saving a new customer, then the port $outcome ⇒ no crash, no onSelect',
        (tester) async {
      final port = RecordingCustomersPort(hold: true);
      var selected = 0;
      await tester.pumpWidget(_host(CustomerPickScreen(port: port, onSelect: (_) => selected++)));
      port.pending.single.complete();
      await tester.pump();
      await tester.enterText(find.byType(TextField).first, '0903 176 968');
      await _tapLabel(tester, 'Tra cứu');
      port.pending.last.complete();
      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Không phải khách này? Tạo khách hàng mới →');
      await _tapLabel(tester, 'Lưu khách hàng');
      expect(port.log, ['listSources', 'lookup', 'create']);

      await _leaveThenAnswer(tester, port.pending.last, error);
      expect(selected, 0);
    });

    testWidgets('Tra cứu bảo hành left during a lookup, then the port $outcome ⇒ no crash', (tester) async {
      final port = _PendingWarrantyPort();
      await tester.pumpWidget(_host(WarrantyLookupScreen(port: port)));
      await tester.enterText(find.byType(TextField).first, '0903 176 968');
      await _tapLabel(tester, 'Tra cứu');
      expect(port.lookups, 1);

      await tester.pumpWidget(const SizedBox());
      error == null
          ? port.reply.complete(const WarrantyLookup(found: false, phone: '+84903176968', customer: null, orders: []))
          : port.reply.completeError(error);
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('Hồ sơ left while the password change is pending, then the port $outcome ⇒ no crash',
        (tester) async {
      final port = _PendingPasswordPort();
      await tester.pumpWidget(_host(ProfileScreen(port: port)));
      await tester.enterText(find.byType(TextField).at(0), 'MatKhauCu1');
      await tester.enterText(find.byType(TextField).at(1), 'MatKhau123');
      await tester.enterText(find.byType(TextField).at(2), 'MatKhau123');
      await _tapLabel(tester, 'Cập nhật mật khẩu');
      expect(port.changes, 1);
      await _leaveThenAnswer(tester, port.reply, error);
    });
  }
}
