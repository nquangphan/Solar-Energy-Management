/**
 * Bộ khoá trạng thái Đơn — COPY NGUYÊN VĂN từ `StatusKey` của chip design-system
 * (`web/src/design-system/components/StatusChip.tsx`), nguồn chân lý nhãn/màu 10 trạng thái.
 * Lưu ý: khoá thi công là `thicong` (KHÔNG phải `dangthicong`).
 *
 * DOMAIN THUẦN (không Nest/Prisma). `Order.status` lưu String + validate tầng app — nhất quán
 * `Customer.custType`/`AccountPermission.permission`: bộ khoá evolve không cần migration enum.
 *
 * `create()` CHỈ gán `TRANG_THAI_BAO_GIA` lúc INSERT. Mọi THAY ĐỔI status đi qua
 * `applyTransition()` (AD-11). Bảng chuyển trạng thái hợp lệ sống ở `allowed-transition.ts`
 * cùng thư mục — file này chỉ giữ BỘ KHOÁ, không giữ luật chuyển.
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

/** Đã nhận đủ tiền cọc — cửa vào nhánh thi công / giao hàng. */
export const TRANG_THAI_DA_COC: OrderStatusKey = 'dacoc';

/** Đang thi công — khoá là `thicong`, KHÔNG phải `dangthicong` (khớp từng byte với chip). */
export const TRANG_THAI_THI_CONG: OrderStatusKey = 'thicong';

/** Đã thi công xong, chờ/đang nghiệm thu. */
export const TRANG_THAI_NGHIEM_THU: OrderStatusKey = 'nghiemthu';

/** Hàng đang trên đường giao. */
export const TRANG_THAI_DANG_GIAO: OrderStatusKey = 'danggiao';

/** Hàng đã giao tới khách. */
export const TRANG_THAI_DA_GIAO: OrderStatusKey = 'dagiao';

/** Đơn hoàn thành — trạng thái kết thúc thành công. */
export const TRANG_THAI_HOAN_THANH: OrderStatusKey = 'hoanthanh';

/** Đơn bị huỷ — trạng thái kết thúc thất bại. */
export const TRANG_THAI_HUY: OrderStatusKey = 'huy';

/**
 * 10 khoá trạng thái dạng MẢNG runtime — `@IsIn` cần GIÁ TRỊ để so, còn `OrderStatusKey`
 * là union type nên bị xoá sạch lúc compile.
 *
 * Dựng từ CHÍNH 10 hằng bên trên, không gõ lại literal: đổi tên một hằng thành compile
 * error thay vì trôi âm thầm. Thêm hằng mới mà quên mảng thì `order-status.spec.ts` đỏ —
 * mảng và tập hằng `TRANG_THAI_*` được đối chiếu hai chiều ở đó, vì mọi hằng đều được
 * annotate `: OrderStatusKey` nên kiểu của chúng đã nới rộng thành cả union và KHÔNG có
 * cách nào bắt thiếu phần tử lúc compile.
 */
export const ORDER_STATUS_KEYS = [
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_CHO_DUYET,
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_THI_CONG,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_HOAN_THANH,
  TRANG_THAI_HUY,
] as const satisfies readonly OrderStatusKey[];
