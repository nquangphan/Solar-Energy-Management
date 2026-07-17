/**
 * Bộ khoá trạng thái Đơn — COPY NGUYÊN VĂN từ `StatusKey` của chip design-system
 * (`web/src/design-system/components/StatusChip.tsx`), nguồn chân lý nhãn/màu 10 trạng thái.
 * Lưu ý: khoá thi công là `thicong` (KHÔNG phải `dangthicong`).
 *
 * DOMAIN THUẦN (không Nest/Prisma). `Order.status` lưu String + validate tầng app — nhất quán
 * `Customer.custType`/`AccountPermission.permission`: bộ khoá evolve không cần migration enum.
 *
 * Story 4.1 CHỈ gán `TRANG_THAI_BAO_GIA` lúc INSERT. Mọi THAY ĐỔI status thuộc
 * `applyTransition()` (Story 5.1, AD-11) — bảng transition KHÔNG sống ở đây.
 */

/** 10 trạng thái chính tắc của Đơn — khớp từng byte với `StatusKey` chip. */
export type OrderStatusKey =
  | 'baogia'
  | 'choduyet'
  | 'dachot'
  | 'dacoc'
  | 'thicong'
  | 'nghiemthu'
  | 'danggiao'
  | 'dagiao'
  | 'hoanthanh'
  | 'huy';

/** Trạng thái khởi tạo của mọi Đơn — giá trị DUY NHẤT mà Story 4.1 được phép ghi. */
export const TRANG_THAI_BAO_GIA: OrderStatusKey = 'baogia';

/** Chờ duyệt chiết khấu (FR-18) — nội dung đơn đóng băng suốt kỳ duyệt (`assertMutable`). */
export const TRANG_THAI_CHO_DUYET: OrderStatusKey = 'choduyet';

/** Đơn đã Chốt — giá đã đóng băng bằng snapshot (FR-5, Story 4.5). */
export const TRANG_THAI_DA_CHOT: OrderStatusKey = 'dachot';
