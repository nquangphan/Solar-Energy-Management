/**
 * Bộ khoá trạng thái của MỘT hồ sơ duyệt chiết khấu (`DiscountApproval.status`, FR-18).
 *
 * DOMAIN THUẦN (không Nest/Prisma). Lưu String + validate tầng app — khuôn underscore của
 * `vatMode`. Phân biệt với `Order.status` (`choduyet` là trạng thái ĐƠN; `cho_duyet` là
 * trạng thái của hồ sơ duyệt): đơn ở `choduyet` có đúng một approval `cho_duyet`; sau đồng ý
 * đơn Ở NGUYÊN `choduyet` (Chốt là hành động riêng), sau từ chối đơn về `baogia` và approval
 * `tu_choi` nằm lại làm hồ sơ.
 */

/** Đang chờ người có `discounts.approve` quyết. */
export const CHIET_KHAU_CHO_DUYET = 'cho_duyet';

/** Đã đồng ý — đơn được phép Chốt với giá đã giảm. */
export const CHIET_KHAU_DONG_Y = 'dong_y';

/** Đã từ chối — đơn trả về Báo giá, lý do nằm ở `resolveNote`. */
export const CHIET_KHAU_TU_CHOI = 'tu_choi';

/** Union 3 trạng thái chính tắc của hồ sơ duyệt chiết khấu. */
export type DiscountApprovalStatus =
  | typeof CHIET_KHAU_CHO_DUYET
  | typeof CHIET_KHAU_DONG_Y
  | typeof CHIET_KHAU_TU_CHOI;
