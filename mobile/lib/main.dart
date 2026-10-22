// hand-authored — the mobile composition root, the ONLY one (Story 10.6, AD-12;
// signed-in adapters Stories 10.7 and 10.8).
//
// Builds session store → transport → generated client → HTTP adapters and hands
// the ports to the app. The backend URL comes from the build only:
//   flutter run --dart-define=API_BASE_URL=<backend URL>
// Without it the app shows a configuration error and makes no request.
// No fake port is imported here (nor the session barrel, which re-exports them).
import 'package:flutter/material.dart';

import 'api/generated/pns_api_client.dart';
import 'api/http_auth_port.dart';
import 'api/http_catalog_port.dart';
import 'api/http_contracts_port.dart';
import 'api/http_customers_port.dart';
import 'api/http_inventory_port.dart';
import 'api/http_invoices_port.dart';
import 'api/http_me_port.dart';
import 'api/http_orders_port.dart';
import 'api/http_password_port.dart';
import 'api/http_payments_port.dart';
import 'api/http_stock_vouchers_port.dart';
import 'api/http_warranty_port.dart';
import 'api/session_store.dart';
import 'api/transport.dart';
import 'app/app_ports.dart';
import 'app/pns_app.dart';
import 'design_system/components/components.dart';
import 'design_system/tokens/app_tokens.dart';

const String apiBaseUrl = String.fromEnvironment('API_BASE_URL');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(buildApp(apiBaseUrl));
}

/// Wires the app for [baseUrl]; an empty one yields the configuration-error app (no transport, no request).
Widget buildApp(String baseUrl, {SecureKeyValueStore? secureStore}) {
  if (baseUrl.isEmpty) return const ConfigErrorApp();
  final session = SessionStore(secureStore ?? FlutterSecureStorageStore());
  // Bumped by the transport when a renewal fails; PnsApp listens and returns to Đăng nhập.
  final sessionExpired = ValueNotifier<int>(0);
  final transport = Transport(
    baseUrl: baseUrl,
    session: session,
    onSessionExpired: () => sessionExpired.value++,
  );
  final client = PnsApiClient(transport.dio);
  return PnsApp(
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
    sessionExpired: sessionExpired,
  );
}

class ConfigErrorApp extends StatelessWidget {
  const ConfigErrorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Phương Nam Solar',
      home: Material(
        color: AppTokens.surface,
        child: SafeArea(
          child: Padding(
            padding: EdgeInsets.all(18.0),
            child: AppErrorState(
              message: 'Chưa cấu hình địa chỉ máy chủ. Chạy lại với --dart-define=API_BASE_URL=…',
            ),
          ),
        ),
      ),
    );
  }
}
