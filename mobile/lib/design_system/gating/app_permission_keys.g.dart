// GENERATED from backend/openapi/permissions.json — do not edit by hand; regen: `cd design-system && npm run build:permissions`.
// ignore_for_file: constant_identifier_names

/// Canonical FE permission keys, derived from the backend registry (AD-17). FE
/// gating, BE guard and the noti resolver all consume this same list. Gating is
/// UX only (AD-4) — the backend enforces every request regardless.
class AppPermissionKeys {
  AppPermissionKeys._();

  static const String ordersViewAll = 'orders.view_all';
  static const String ordersViewOwn = 'orders.view_own';
  static const String auditRead = 'audit.read';
  static const String permissionsManage = 'permissions.manage';
  static const String quotesCreateEdit = 'quotes.create_edit';
  static const String ordersConfirm = 'orders.confirm';
  static const String discountsApply = 'discounts.apply';
  static const String discountsApprove = 'discounts.approve';
  static const String constructionTransition = 'construction.transition';
  static const String deliveryConfirm = 'delivery.confirm';
  static const String paymentsRecord = 'payments.record';
  static const String catalogManage = 'catalog.manage';
  static const String contractsGenerate = 'contracts.generate';
  static const String dashboardFinanceView = 'dashboard.finance_view';
  static const String customersManage = 'customers.manage';
  static const String inventoryManage = 'inventory.manage';
  static const String invoicesManage = 'invoices.manage';
  static const String settingsManage = 'settings.manage';
  static const String systemFeatureFlags = 'system.feature_flags';
  static const String costsView = 'costs.view';
}
