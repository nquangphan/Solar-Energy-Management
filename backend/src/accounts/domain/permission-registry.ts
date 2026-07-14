/**
 * Registry quyền CHÍNH TẮC — nguồn chân lý DUY NHẤT cho mọi permission key (AD-17),
 * do `accounts/domain` sở hữu. Ba bên tiêu thụ CHUNG danh sách này: FE gating (qua
 * artifact sinh tự động, Story 2.6), BE guard (Story 2.5), noti resolver (Epic 9).
 *
 * BẤT BIẾN (AD-17): đây là NƠI DUY NHẤT được phép chứa permission string literal.
 * Mọi nơi khác `import { PERM }` (định danh, KHÔNG literal). Source-guard
 * `no-permission-literal-outside-registry.spec.ts` fail nếu literal quyền lọt ra file
 * khác trong `src/`.
 *
 * Đây là DOMAIN thuần (không phụ thuộc Infra/Prisma): chỉ hằng số + type.
 *
 * Naming key: `domain.action` snake_case (xem CONVENTIONS.md#Permission registry). 4 key
 * ✱ giữ NGUYÊN VĂN literal FE stub Story 1.10 (`web/…/permissions.ts` +
 * `mobile/…/app_permissions.dart`) để Story 2.6 chỉ đổi *nguồn* (stub → artifact), KHÔNG
 * đổi *chuỗi* — action item Epic 1 retro. Bộ key đầy đủ ánh xạ ma trận PRD FR-18 §4.6,
 * cộng 3 key nhóm tính năng mới từ PRD §5 (`settings.manage`, `system.feature_flags`,
 * `costs.view`) → tổng 20 key.
 */

/**
 * Định danh có tên → chuỗi key chính tắc. `as const` giữ literal narrow để suy
 * `PermissionKey`. Mọi consumer dùng `PERM.xxx` (KHÔNG viết lại chuỗi).
 */
export const PERM = {
  /** ✱ Xem TẤT CẢ đơn (vs chỉ đơn của mình) — khớp FE `PERM.ordersViewAll`. */
  ordersViewAll: 'orders.view_all',
  /** ✱ Chỉ xem đơn CỦA MÌNH — entry tường minh #2 (AC-2); FE suy scope từ có/không `orders.view_all`. */
  ordersViewOwn: 'orders.view_own',
  /** ✱ Xem Audit log — chỉ Super Admin (AC-3, FR-20) — khớp FE `PERM.auditRead`. */
  auditRead: 'audit.read',
  /** ✱ Quản lý account & phân quyền (màn Phân quyền, Epic 8) — khớp FE `PERM.permissionsManage`. */
  permissionsManage: 'permissions.manage',
  /** Tạo/sửa báo giá. */
  quotesCreateEdit: 'quotes.create_edit',
  /** Chốt đơn. */
  ordersConfirm: 'orders.confirm',
  /** Áp chiết khấu. */
  discountsApply: 'discounts.apply',
  /** Duyệt chiết khấu. */
  discountsApprove: 'discounts.approve',
  /** Chuyển bước thi công. */
  constructionTransition: 'construction.transition',
  /** Xác nhận giao hàng. */
  deliveryConfirm: 'delivery.confirm',
  /** Ghi nhận thanh toán. */
  paymentsRecord: 'payments.record',
  /** Sửa danh mục & giá. */
  catalogManage: 'catalog.manage',
  /** Sinh hợp đồng. */
  contractsGenerate: 'contracts.generate',
  /** Xem dashboard tài chính. */
  dashboardFinanceView: 'dashboard.finance_view',
  /** Quản lý khách hàng. */
  customersManage: 'customers.manage',
  /** Nhập/Xuất kho. */
  inventoryManage: 'inventory.manage',
  /** Tạo/xuất hoá đơn. */
  invoicesManage: 'invoices.manage',
  /** Cấu hình hệ thống (danh mục nguồn khách, thuế suất VAT) — Story 3.5, E8. */
  settingsManage: 'settings.manage',
  /** Cờ tính năng cấp nghiệp vụ (cờ giá phân tầng FR-15) — CHỈ người vận hành app. */
  systemFeatureFlags: 'system.feature_flags',
  /** Xem giá vốn & lợi nhuận (`Product.costPrice`, báo cáo lợi nhuận gộp). */
  costsView: 'costs.view',
  /** ĐỌC danh mục (sản phẩm, gói vật tư) — người dựng báo giá cần, tách khỏi `catalog.manage`. */
  catalogView: 'catalog.view',
} as const;

/** Union mọi key hợp lệ (`'orders.view_all' | 'orders.view_own' | …`). */
export type PermissionKey = (typeof PERM)[keyof typeof PERM];

/** Một mục trong registry: key chính tắc + nhãn tiếng Việt (màn Phân quyền E8) + nhóm hiển thị. */
export interface PermissionEntry {
  readonly key: PermissionKey;
  readonly label: string;
  readonly group: string;
}

/**
 * Danh sách quyền chính tắc — thứ tự này QUYẾT ĐỊNH thứ tự artifact sinh tự động
 * (`openapi/permissions.json`, deterministic). Nguồn: ma trận PRD FR-18 §4.6.
 */
export const PERMISSIONS: readonly PermissionEntry[] = [
  { key: PERM.ordersViewAll, label: 'Xem tất cả đơn', group: 'orders' },
  { key: PERM.ordersViewOwn, label: 'Chỉ xem đơn của mình', group: 'orders' },
  { key: PERM.auditRead, label: 'Xem Audit log (Super Admin)', group: 'audit' },
  {
    key: PERM.permissionsManage,
    label: 'Quản lý account & phân quyền',
    group: 'accounts',
  },
  { key: PERM.quotesCreateEdit, label: 'Tạo/sửa báo giá', group: 'quotes' },
  { key: PERM.ordersConfirm, label: 'Chốt đơn', group: 'orders' },
  { key: PERM.discountsApply, label: 'Áp chiết khấu', group: 'discounts' },
  { key: PERM.discountsApprove, label: 'Duyệt chiết khấu', group: 'discounts' },
  {
    key: PERM.constructionTransition,
    label: 'Chuyển bước thi công',
    group: 'construction',
  },
  { key: PERM.deliveryConfirm, label: 'Xác nhận giao hàng', group: 'delivery' },
  { key: PERM.paymentsRecord, label: 'Ghi nhận thanh toán', group: 'payments' },
  { key: PERM.catalogManage, label: 'Sửa danh mục & giá', group: 'catalog' },
  { key: PERM.contractsGenerate, label: 'Sinh hợp đồng', group: 'contracts' },
  {
    key: PERM.dashboardFinanceView,
    label: 'Xem dashboard tài chính',
    group: 'dashboard',
  },
  {
    key: PERM.customersManage,
    label: 'Quản lý khách hàng',
    group: 'customers',
  },
  { key: PERM.inventoryManage, label: 'Nhập/Xuất kho', group: 'inventory' },
  { key: PERM.invoicesManage, label: 'Tạo/xuất hoá đơn', group: 'invoices' },
  { key: PERM.settingsManage, label: 'Cấu hình hệ thống', group: 'settings' },
  {
    key: PERM.systemFeatureFlags,
    label: 'Cờ tính năng (vận hành app)',
    group: 'system',
  },
  { key: PERM.costsView, label: 'Xem giá vốn & lợi nhuận', group: 'costs' },
  { key: PERM.catalogView, label: 'Xem danh mục vật tư', group: 'catalog' },
];

/** Mọi key chính tắc theo thứ tự registry (nguồn cho source-guard + validate). */
export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map(
  (entry) => entry.key,
);

const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(PERMISSION_KEYS);

/** Type-guard: `value` có phải một key trong registry không (dùng validate ở tầng app). */
export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}
