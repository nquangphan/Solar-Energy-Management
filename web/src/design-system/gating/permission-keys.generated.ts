// GENERATED from backend/openapi/permissions.json — do not edit by hand; regen: `cd design-system && npm run build:permissions`.
/* eslint-disable */

/**
 * Canonical FE permission keys, derived from the backend registry (AD-17). FE
 * gating, BE guard and the noti resolver all consume this same list. Gating is
 * UX only (AD-4) — the backend enforces every request regardless.
 */
export const PERMISSION_KEYS = {
  ordersViewAll: 'orders.view_all',
  ordersViewOwn: 'orders.view_own',
  auditRead: 'audit.read',
  permissionsManage: 'permissions.manage',
  quotesCreateEdit: 'quotes.create_edit',
  ordersConfirm: 'orders.confirm',
  discountsApply: 'discounts.apply',
  discountsApprove: 'discounts.approve',
  constructionTransition: 'construction.transition',
  deliveryConfirm: 'delivery.confirm',
  paymentsRecord: 'payments.record',
  catalogManage: 'catalog.manage',
  contractsGenerate: 'contracts.generate',
  dashboardFinanceView: 'dashboard.finance_view',
  customersManage: 'customers.manage',
  inventoryManage: 'inventory.manage',
  invoicesManage: 'invoices.manage',
  settingsManage: 'settings.manage',
  systemFeatureFlags: 'system.feature_flags',
  costsView: 'costs.view',
  catalogView: 'catalog.view',
} as const;

/** camelCase key name (e.g. `ordersViewAll`). */
export type PermissionKeyName = keyof typeof PERMISSION_KEYS;
