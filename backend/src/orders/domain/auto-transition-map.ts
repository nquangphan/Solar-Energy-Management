import { SU_KIEN, type TransitionEvent } from './allowed-transition';

/**
 * MAPPING "mốc Lịch thanh toán → sự kiện chuyển trạng thái" — DOMAIN THUẦN: KHÔNG import
 * Nest/Prisma, không async, không side effect (cùng khuôn `allowed-transition.ts`).
 *
 * ĐÂY LÀ HỢP ĐỒNG, KHÔNG PHẢI NƠI LƯU CẤU HÌNH. Ranh giới với Epic 7:
 *  - 5.2 (file này) sở hữu **hình dạng**: mốc nào sinh ra sự kiện nào.
 *  - 7.1 sở hữu **giá trị**: gắn một `MocTuDong` lên từng `Installment` của Lịch thanh toán
 *    (cột cấu hình). File này KHÔNG tạo cột, KHÔNG tạo bảng, KHÔNG migration.
 *  - 7.2 sở hữu **thời điểm gọi**: khi ghi nhận thanh toán làm một đợt vừa đủ, `payments/`
 *    dịch mốc sang sự kiện bằng `suKienChoMoc()` rồi gọi
 *    `OrdersService.chuyenTrangThaiTuDong()`.
 *
 * ⚠️ Mốc ánh xạ tới SỰ KIỆN, KHÔNG tới trạng thái đích. Đích đến là của bảng transition:
 * `hoanThanh` có ba dòng `from` khác nhau (`nghiemthu`, `dagiao`, `dachot` + cờ Thiết bị) và
 * bảng tự chọn đúng dòng theo trạng thái hiện tại. Map thẳng tới một đích sẽ đóng băng đúng
 * một nhánh và âm thầm giết hai nhánh còn lại.
 */

/**
 * Các mốc của Lịch thanh toán SINH RA chuyển trạng thái — enum TƯỜNG MINH, chỉ hai mốc.
 *
 * Mốc nào không có dòng tương ứng trong bảng transition thì không có chỗ để map; thêm mốc
 * thứ ba khi Lịch thanh toán thật chưa tồn tại là bịa. Nếu 7.1 phát hiện một mốc nữa thực sự
 * sinh transition, thêm một dòng ở đây là đủ.
 */
export const MOC_TU_DONG = {
  /** Đã thu đủ đợt cọc đầu. */
  coc: 'coc',
  /** Đã thu đủ toàn bộ giá trị đơn. */
  tatToan: 'tat_toan',
} as const;

/** Union mọi mốc hợp lệ. */
export type MocTuDong = (typeof MOC_TU_DONG)[keyof typeof MOC_TU_DONG];

/**
 * Mốc ⇒ sự kiện. Hàm THUẦN, TOÀN PHẦN: `switch` trên union đã hẹp nên thêm một mốc mới mà
 * quên nhánh sẽ ĐỎ ngay ở typecheck (`suKien` không nhận `never`), không lọt tới runtime.
 */
export function suKienChoMoc(moc: MocTuDong): TransitionEvent {
  switch (moc) {
    case MOC_TU_DONG.coc:
      return SU_KIEN.duCoc;
    case MOC_TU_DONG.tatToan:
      return SU_KIEN.hoanThanh;
  }
}
