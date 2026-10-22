// The whole app over the real HTTP adapters + transport, with a FakeAdapter as the
// backend (Story 10.6, signed-in adapters 10.7 and 10.8). Only the socket is fake.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/api/generated/pns_api_client.dart';
import 'package:pns_mobile/api/http_auth_port.dart';
import 'package:pns_mobile/api/http_catalog_port.dart';
import 'package:pns_mobile/api/http_contracts_port.dart';
import 'package:pns_mobile/api/http_customers_port.dart';
import 'package:pns_mobile/api/http_inventory_port.dart';
import 'package:pns_mobile/api/http_invoices_port.dart';
import 'package:pns_mobile/api/http_me_port.dart';
import 'package:pns_mobile/api/http_orders_port.dart';
import 'package:pns_mobile/api/http_password_port.dart';
import 'package:pns_mobile/api/http_payments_port.dart';
import 'package:pns_mobile/api/http_stock_vouchers_port.dart';
import 'package:pns_mobile/api/http_warranty_port.dart';
import 'package:pns_mobile/api/session_store.dart';
import 'package:pns_mobile/api/transport.dart';
import 'package:pns_mobile/app/app_ports.dart';
import 'package:pns_mobile/app/pns_app.dart';

import '../../api/support/fake_http.dart';

class TestApp {
  TestApp(FakeHandler handler) : adapter = FakeAdapter(handler) {
    transport = Transport(
      baseUrl: 'http://backend.test',
      session: session,
      adapter: adapter,
      onSessionExpired: () => expired.value++,
    );
    client = PnsApiClient(transport.dio);
    widget = PnsApp(
      auth: HttpAuthPort(client, session, transport),
      ports: AppPorts(
        me: HttpMePort(client, transport),
        password: HttpPasswordPort(client, transport),
        customers: HttpCustomersPort(client, transport),
        warranty: HttpWarrantyPort(client, transport),
        catalog: HttpCatalogPort(client, transport),
        orders: HttpOrdersPort(client, transport),
        inventory: HttpInventoryPort(client, transport),
        stockVouchers: HttpStockVouchersPort(client, transport),
        payments: HttpPaymentsPort(client, transport),
        contracts: HttpContractsPort(client, transport),
        invoices: HttpInvoicesPort(client, transport),
      ),
      sessionExpired: expired,
    );
  }

  final FakeAdapter adapter;
  final MemoryKeyValueStore store = MemoryKeyValueStore();
  late final SessionStore session = SessionStore(store);
  final ValueNotifier<int> expired = ValueNotifier<int>(0);
  late final Transport transport;
  late final PnsApiClient client;
  late final PnsApp widget;
}

/// Dio runs on real timers inside the widget test's fake async: pump in small steps.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

Map<String, Object?> meBody(
  List<String> permissions, {
  String displayName = 'Nhân viên A',
  String email = 'nv@pns.solar',
}) => {'id': 'acc-$email', 'email': email, 'displayName': displayName, 'permissions': permissions};
