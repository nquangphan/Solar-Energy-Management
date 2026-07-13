import { PERM, type PermissionKey } from './permission-registry';

/**
 * Role preset — bộ Quyền mặc định NẠP LÚC TẠO account, KHÔNG ràng buộc runtime (AD-8,
 * FR-17: "áp preset chỉ nạp giá trị, sau đó tick/bỏ từng quyền được"). Phase 1 = HẰNG
 * SỐ CODE, KHÔNG bảng `Role`/`RolePermission` DB (YAGNI ~20 user — Open Question #3).
 *
 * DOMAIN thuần: import key từ `permission-registry.ts` (định danh `PERM.xxx`, KHÔNG
 * literal). Nguồn ánh xạ: ma trận PRD FR-18 §4.6.
 *
 * BẤT BIẾN AC-3: **CHỈ `SUPER_ADMIN`** chứa `audit.read` **và** `system.feature_flags`;
 * mọi preset khác KHÔNG. Test `role-presets.spec.ts` khẳng định. `SUPER_ADMIN` = toàn bộ
 * quyền Admin + hai key riêng đó; `SUPER_ADMIN` = người vận hành app, ngoài tổ chức khách.
 *
 * Quy ước view scope (AC-2): role KHÔNG có `orders.view_all` được cấp `orders.view_own`
 * (vẫn xem được đơn của mình) — hai entry tường minh, FE suy scope từ có/không view_all.
 */
export type RolePreset =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'QUAN_LY'
  | 'KE_TOAN'
  | 'THO_KS'
  | 'THI_CONG'
  | 'KHO_GIAO';

/**
 * Cột "Admin" ma trận FR-18 + `settings.manage`/`costs.view` (PRD §5). KHÔNG gồm
 * `audit.read` lẫn `system.feature_flags` — hai key đó riêng của Super Admin.
 */
const ADMIN_PRESET: readonly PermissionKey[] = [
  PERM.quotesCreateEdit,
  PERM.ordersConfirm,
  PERM.discountsApply,
  PERM.discountsApprove,
  PERM.constructionTransition,
  PERM.deliveryConfirm,
  PERM.paymentsRecord,
  PERM.catalogManage,
  PERM.contractsGenerate,
  PERM.ordersViewAll,
  PERM.dashboardFinanceView,
  PERM.customersManage,
  PERM.inventoryManage,
  PERM.invoicesManage,
  PERM.permissionsManage,
  PERM.settingsManage,
  PERM.costsView,
];

export const ROLE_PRESETS: Record<RolePreset, readonly PermissionKey[]> = {
  // Cao nhất: toàn bộ Admin + `audit.read` + `system.feature_flags` (AC-3). Một account
  // duy nhất (seed) — người vận hành app.
  SUPER_ADMIN: [...ADMIN_PRESET, PERM.auditRead, PERM.systemFeatureFlags],
  // Cột "Admin": mọi quyền vận hành + phân quyền + cấu hình + giá vốn; KHÔNG audit,
  // KHÔNG cờ tính năng.
  ADMIN: ADMIN_PRESET,
  // Cột "QL/Sếp": như Admin nhưng KHÔNG `permissions.manage`, KHÔNG `settings.manage`
  // (cấu hình doanh nghiệp là việc của chủ — PRD §5); có `costs.view`.
  QUAN_LY: [
    PERM.quotesCreateEdit,
    PERM.ordersConfirm,
    PERM.discountsApply,
    PERM.discountsApprove,
    PERM.constructionTransition,
    PERM.deliveryConfirm,
    PERM.paymentsRecord,
    PERM.catalogManage,
    PERM.contractsGenerate,
    PERM.ordersViewAll,
    PERM.dashboardFinanceView,
    PERM.customersManage,
    PERM.inventoryManage,
    PERM.invoicesManage,
    PERM.costsView,
  ],
  // Cột "Kế toán": thanh toán, danh mục, hợp đồng, xem tất cả đơn, dashboard, khách, hoá
  // đơn, giá vốn & lợi nhuận. KHÔNG `settings.manage`.
  KE_TOAN: [
    PERM.paymentsRecord,
    PERM.catalogManage,
    PERM.contractsGenerate,
    PERM.ordersViewAll,
    PERM.dashboardFinanceView,
    PERM.customersManage,
    PERM.invoicesManage,
    PERM.costsView,
  ],
  // Cột "Thợ KS": báo giá, chốt đơn, áp chiết khấu, hợp đồng, khách; KHÔNG view_all → view_own.
  THO_KS: [
    PERM.quotesCreateEdit,
    PERM.ordersConfirm,
    PERM.discountsApply,
    PERM.contractsGenerate,
    PERM.customersManage,
    PERM.ordersViewOwn,
  ],
  // Cột "Thi công": chuyển bước thi công; KHÔNG view_all → view_own.
  THI_CONG: [PERM.constructionTransition, PERM.ordersViewOwn],
  // Cột "Kho/Giao": giao hàng, nhập/xuất kho; KHÔNG view_all → view_own.
  KHO_GIAO: [PERM.deliveryConfirm, PERM.inventoryManage, PERM.ordersViewOwn],
};
