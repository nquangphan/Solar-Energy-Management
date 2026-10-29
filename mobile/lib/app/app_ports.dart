// hand-authored — every port the signed-in app consumes, as ONE value (Story 10.8,
// mirror of the web `AppPorts`). Built only by the composition root (main.dart)
// and handed down unchanged: eleven ports through two widgets one parameter at a
// time would be eleven chances to wire the wrong one.
import '../design_system/session/accounts_port.dart';
import '../design_system/session/audit_logs_port.dart';
import '../design_system/session/catalog_port.dart';
import '../design_system/session/contracts_port.dart';
import '../design_system/session/customers_port.dart';
import '../design_system/session/dashboard_port.dart';
import '../design_system/session/inventory_port.dart';
import '../design_system/session/invoices_port.dart';
import '../design_system/session/me_port.dart';
import '../design_system/session/orders_port.dart';
import '../design_system/session/password_port.dart';
import '../design_system/session/payments_port.dart';
import '../design_system/session/stock_vouchers_port.dart';
import '../design_system/session/warranty_port.dart';

class AppPorts {
  const AppPorts({
    required this.me,
    required this.password,
    required this.customers,
    required this.warranty,
    required this.catalog,
    required this.orders,
    required this.inventory,
    required this.stockVouchers,
    required this.payments,
    required this.contracts,
    required this.invoices,
    required this.dashboard,
    required this.accounts,
    required this.auditLogs,
  });

  final MePort me;
  final PasswordPort password;
  final CustomersPort customers;
  final WarrantyPort warranty;
  final CatalogPort catalog;
  final OrdersPort orders;
  final InventoryPort inventory;
  final StockVouchersPort stockVouchers;
  final PaymentsPort payments;
  final ContractsPort contracts;
  final InvoicesPort invoices;
  final DashboardPort dashboard;
  final AccountsPort accounts;
  final AuditLogsPort auditLogs;
}
