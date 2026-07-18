import {
  PERM,
  type PermissionKey,
} from '../../accounts/domain/permission-registry';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_CHO_DUYET,
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_HOAN_THANH,
  TRANG_THAI_HUY,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_THI_CONG,
  type OrderStatusKey,
} from './order-status';

/**
 * BẢNG CHUYỂN TRẠNG THÁI HỢP LỆ + hàm đánh giá guard — DOMAIN THUẦN: KHÔNG import
 * Nest/Prisma, không async, không side effect (unit-test được không cần mock).
 *
 * Đây là "nơi duy nhất đánh giá guard" mà AD-11 đòi: hợp lệ hay không quyết ở đây, còn việc
 * THỰC SỰ ghi `Order.status` nằm ở executor `OrdersService.applyTransition()` — Domain không
 * được phụ thuộc Infrastructure nên một hàm ở đây không thể tự ghi DB. Hai nửa, một hợp đồng.
 *
 * Bảng là HỢP ĐỒNG, không phải code chết: nó khai đủ vòng đời đơn (kể cả các bước chưa có
 * call-site), nên thêm một call-site sau này là chọn một `SU_KIEN` có sẵn chứ không phải phát
 * minh luật mới ở chỗ khác.
 *
 * ⚠️ Bước "Lên lịch thi công" đã bị BỎ khỏi vòng đời — bộ khoá chính tắc là 10.
 */

/** Ba cờ phạm vi của Đơn — quyết định nhánh nào của vòng đời được đi (FR-2, AD-7). */
export interface OrderScopeFlags {
  readonly thietBi: boolean;
  readonly thiCong: boolean;
  readonly vanChuyen: boolean;
}

/**
 * Sự kiện chuyển trạng thái — enum TƯỜNG MINH, KHÔNG phải free string: caller chọn một sự
 * kiện có tên, không tự mô tả đích đến (đích đến là của bảng, không của caller).
 */
export const SU_KIEN = {
  /** Áp chiết khấu + gửi duyệt. */
  apChietKhau: 'ap_chiet_khau',
  /** Từ chối chiết khấu — trả đơn về Báo giá để sửa. */
  tuChoiChietKhau: 'tu_choi_chiet_khau',
  /** Chốt đơn — đóng băng giá. */
  chot: 'chot',
  /** Mở lại đơn đã chốt để sửa (sinh bản mới). */
  moLai: 'mo_lai',
  /** Đã nhận đủ cọc (tự động theo sự kiện thanh toán). */
  duCoc: 'du_coc',
  /** Bắt đầu thi công. */
  batDauThiCong: 'bat_dau_thi_cong',
  /** Thi công xong, chuyển sang nghiệm thu. */
  xongThiCong: 'xong_thi_cong',
  /** Xuất hàng đi giao. */
  batDauGiao: 'bat_dau_giao',
  /** Đã giao tới khách. */
  xongGiao: 'xong_giao',
  /** Kết thúc đơn — hoàn thành. */
  hoanThanh: 'hoan_thanh',
  /** Huỷ đơn. */
  huy: 'huy',
} as const;

/** Union mọi sự kiện hợp lệ. */
export type TransitionEvent = (typeof SU_KIEN)[keyof typeof SU_KIEN];

/** Một dòng của bảng: từ đâu, sự kiện gì, tới đâu, cần quyền gì, cần cờ nào bật. */
export interface TransitionRule {
  readonly event: TransitionEvent;
  readonly from: OrderStatusKey;
  readonly to: OrderStatusKey;
  readonly requires: PermissionKey;
  /** Cờ phạm vi phải BẬT thì nhánh này mới đi được; vắng = không phụ thuộc cờ. */
  readonly scopeGuard?: keyof OrderScopeFlags;
}

/** Lý do từ chối — thứ tự ưu tiên phản ánh thứ tự đánh giá, xem `evaluateTransition`. */
export type TransitionRejection = 'not_in_table' | 'scope' | 'permission';

/** Kết quả đánh giá: đích đến, hoặc lý do từ chối. */
export type TransitionResult =
  | { readonly ok: true; readonly to: OrderStatusKey }
  | { readonly ok: false; readonly reason: TransitionRejection };

/**
 * Bảng chuyển trạng thái CHÍNH TẮC. Cặp `(from, event)` là KHOÁ — không được trùng, nếu
 * trùng thì đích đến mơ hồ (có test khẳng định).
 *
 * Quyền của các bước sau `dachot` dùng lại key SẴN CÓ trong registry theo ngữ nghĩa gần nhất
 * (`payments.record` cho bước do tiền quyết, `construction.transition` cho nhánh thi công,
 * `delivery.confirm` cho nhánh giao hàng) — bộ 21 key không đổi vì story này.
 */
export const ALLOWED_TRANSITIONS: readonly TransitionRule[] = [
  {
    event: SU_KIEN.apChietKhau,
    from: TRANG_THAI_BAO_GIA,
    to: TRANG_THAI_CHO_DUYET,
    requires: PERM.discountsApply,
  },
  {
    event: SU_KIEN.tuChoiChietKhau,
    from: TRANG_THAI_CHO_DUYET,
    to: TRANG_THAI_BAO_GIA,
    requires: PERM.discountsApprove,
  },
  {
    event: SU_KIEN.chot,
    from: TRANG_THAI_BAO_GIA,
    to: TRANG_THAI_DA_CHOT,
    requires: PERM.ordersConfirm,
  },
  {
    // Chốt từ `choduyet` còn đòi approval `dong_y` — điều kiện DỮ LIỆU, không phải điều kiện
    // trạng thái, nên nó ở lại call-site chứ không vào bảng.
    event: SU_KIEN.chot,
    from: TRANG_THAI_CHO_DUYET,
    to: TRANG_THAI_DA_CHOT,
    requires: PERM.ordersConfirm,
  },
  {
    // Mở lại chỉ có MỘT tác dụng là cho phép sửa ⇒ cùng quyền với mọi đường sửa.
    event: SU_KIEN.moLai,
    from: TRANG_THAI_DA_CHOT,
    to: TRANG_THAI_BAO_GIA,
    requires: PERM.quotesCreateEdit,
  },
  {
    event: SU_KIEN.duCoc,
    from: TRANG_THAI_DA_CHOT,
    to: TRANG_THAI_DA_COC,
    requires: PERM.paymentsRecord,
  },
  {
    event: SU_KIEN.batDauThiCong,
    from: TRANG_THAI_DA_COC,
    to: TRANG_THAI_THI_CONG,
    requires: PERM.constructionTransition,
    scopeGuard: 'thiCong',
  },
  {
    event: SU_KIEN.xongThiCong,
    from: TRANG_THAI_THI_CONG,
    to: TRANG_THAI_NGHIEM_THU,
    requires: PERM.constructionTransition,
    scopeGuard: 'thiCong',
  },
  {
    event: SU_KIEN.batDauGiao,
    from: TRANG_THAI_DA_COC,
    to: TRANG_THAI_DANG_GIAO,
    requires: PERM.deliveryConfirm,
    scopeGuard: 'vanChuyen',
  },
  {
    // KHÔNG gate cờ ở bước RA: cờ đã được kiểm ở bước VÀO (`dacoc → danggiao` đòi Vận
    // chuyển). Gate bước ra bằng một cờ KHÁC (Thiết bị) sẽ nhốt vĩnh viễn mọi đơn có Vận
    // chuyển mà không có Thiết bị: vào được `danggiao` rồi không còn đường nào đi tiếp.
    event: SU_KIEN.xongGiao,
    from: TRANG_THAI_DANG_GIAO,
    to: TRANG_THAI_DA_GIAO,
    requires: PERM.deliveryConfirm,
  },
  {
    event: SU_KIEN.hoanThanh,
    from: TRANG_THAI_NGHIEM_THU,
    to: TRANG_THAI_HOAN_THANH,
    requires: PERM.constructionTransition,
  },
  {
    event: SU_KIEN.hoanThanh,
    from: TRANG_THAI_DA_GIAO,
    to: TRANG_THAI_HOAN_THANH,
    requires: PERM.deliveryConfirm,
  },
  {
    // Đơn CHỈ bán thiết bị, đủ tiền, không thi công không giao — đóng thẳng từ `dachot`.
    event: SU_KIEN.hoanThanh,
    from: TRANG_THAI_DA_CHOT,
    to: TRANG_THAI_HOAN_THANH,
    requires: PERM.paymentsRecord,
    scopeGuard: 'thietBi',
  },
  {
    event: SU_KIEN.huy,
    from: TRANG_THAI_BAO_GIA,
    to: TRANG_THAI_HUY,
    requires: PERM.quotesCreateEdit,
  },
  {
    event: SU_KIEN.huy,
    from: TRANG_THAI_DA_CHOT,
    to: TRANG_THAI_HUY,
    requires: PERM.quotesCreateEdit,
  },
  {
    event: SU_KIEN.huy,
    from: TRANG_THAI_DA_COC,
    to: TRANG_THAI_HUY,
    requires: PERM.quotesCreateEdit,
  },
];

/**
 * Transition này có được phép không? Hàm THUẦN — không async, không chạm DB, không log.
 *
 * THỨ TỰ ĐÁNH GIÁ CỐ ĐỊNH, đây là quyết định bảo mật:
 *  1. Cặp `(from, event)` có trong bảng? — không thì `not_in_table`.
 *  2. Cờ phạm vi cho phép? — không thì `scope`.
 *  3. Actor có permission? — không thì `permission`.
 *
 * Đảo (3) lên trước sẽ nói cho một actor KHÔNG có quyền biết đơn đang ở trạng thái nào (trả
 * `permission` thay vì `not_in_table` là một bit thông tin rò ra). Giữ nguyên thứ tự này.
 */
export function evaluateTransition(input: {
  readonly order: { readonly status: string };
  readonly event: TransitionEvent;
  readonly actorPermissions: ReadonlySet<string>;
  readonly scopeFlags: OrderScopeFlags;
}): TransitionResult {
  const rule = ALLOWED_TRANSITIONS.find(
    (row) => row.from === input.order.status && row.event === input.event,
  );
  if (rule === undefined) return { ok: false, reason: 'not_in_table' };
  if (rule.scopeGuard !== undefined && !input.scopeFlags[rule.scopeGuard]) {
    return { ok: false, reason: 'scope' };
  }
  if (!input.actorPermissions.has(rule.requires)) {
    return { ok: false, reason: 'permission' };
  }
  return { ok: true, to: rule.to };
}

/**
 * Đơn ĐÃ Ở CHÍNH CÁI ĐÍCH mà sự kiện này nhắm tới chưa? Hàm THUẦN — suy từ BẢNG, không từ
 * một danh sách cặp status/event chép tay ở call-site (bảng là nguồn chân lý duy nhất; một
 * bảng thứ hai là điểm drift).
 *
 * Dùng cho cổng no-op của đường AUTO (Story 5.2): sự kiện thanh toán tới lần thứ hai (retry
 * mạng, ghi nhận lặp) mà đơn đã ở đích ⇒ đó là RETRY, không phải xung đột — trả no-op, không
 * 409, không event thứ hai (NFR-1: thao tác tiền idempotent).
 *
 * ⚠️ KHÔNG dùng cho transition THỦ CÔNG (5.5): ở đó "đã ở đích" nhiều khả năng là người bấm
 * hai lần và hợp đồng UI có thể muốn báo lỗi. Tổng quát hoá sớm là một quyết định UX chưa ai ra.
 *
 * `hoanThanh` có ba dòng `from` cùng đích — `some` phủ cả ba mà không cần biết đơn đã đi
 * nhánh nào.
 */
export function daTaiDich(status: string, event: TransitionEvent): boolean {
  return ALLOWED_TRANSITIONS.some(
    (row) => row.event === event && row.to === status,
  );
}
