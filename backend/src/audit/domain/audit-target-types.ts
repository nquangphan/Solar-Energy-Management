/**
 * Every `target.type` a domain event carries (FR-20) — the values the audit screen filters on.
 * PURE DOMAIN. `audit-event-labels.spec.ts` scans the event sources so this list equals the set
 * actually published; the web and mobile filter labels are checked against it by a
 * design-system guard.
 */
export const AUDIT_TARGET_TYPES = [
  'Order',
  'Account',
  'Product',
  'ProductGroup',
  'Customer',
  'CustomerSource',
  'StockVoucher',
  'FeatureFlag',
  'SystemSetting',
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];
