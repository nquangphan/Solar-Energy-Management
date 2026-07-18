/**
 * Hạn bảo hành và trạng thái bảo hành của MỘT dòng vật tư — DOMAIN THUẦN: không Nest, không
 * Prisma, không `new Date()` bên trong. Mốc hiện tại đi vào bằng tham số `now`, nên test biên
 * là phép so số xác định chứ không phụ thuộc lúc chạy.
 *
 * Backend là nơi DUY NHẤT tính mấy con số này: cả web lẫn mobile đều không có thư viện ngày,
 * nên hai bản cài đặt "start + N tháng" ở client là hai cơ hội lệch nhau trên đúng loại số học
 * có bẫy (31/01 + 1 tháng = ?). Client chỉ render kết quả.
 */

/** Còn ≤ ngần này ngày thì tính là "sắp hết" — đổi ngưỡng là sửa đúng dòng này. */
export const NGUONG_SAP_HET_NGAY = 90;

const MS_MOI_NGAY = 24 * 60 * 60 * 1000;

export type TrangThaiBaoHanh = 'con_han' | 'sap_het' | 'het_han';

/**
 * `startAt` + `months` tháng, trả về mốc NGÀY ở `00:00:00Z`.
 *
 * Phần giờ bị cắt vì đây là mốc ngày: để giờ khác 0 là mời gọi lỗi lệch múi khi client cắt
 * chuỗi ISO để hiển thị. Ngày tràn khỏi tháng đích bị KẸP về ngày cuối tháng đích (31/01 + 1
 * tháng ⇒ 28/02, không phải 03/03 như `setUTCMonth` thuần) — bảo hành không được dài thêm chỉ
 * vì tháng đích ngắn hơn.
 */
export function tinhHanBaoHanh(startAt: Date, months: number): Date {
  const nam = startAt.getUTCFullYear();
  const thang = startAt.getUTCMonth();
  const ngay = startAt.getUTCDate();

  const ngayCuoiThangDich = new Date(
    Date.UTC(nam, thang + months + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(nam, thang + months, Math.min(ngay, ngayCuoiThangDich)),
  );
}

/**
 * Số ngày còn lại tới `endAt`, **âm khi đã quá hạn**. Đây là số điều khiển trạng thái.
 *
 * Cả hai mốc được cắt về đầu ngày UTC trước khi trừ: "còn mấy ngày" là câu hỏi về NGÀY, và
 * một phép trừ mang phần giờ sẽ cho `0.4 ngày` rồi làm tròn thành ranh giới sai.
 */
export function soNgayConLai(endAt: Date, now: Date): number {
  const dauNgay = (d: Date): number =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((dauNgay(endAt) - dauNgay(now)) / MS_MOI_NGAY);
}

/**
 * Trạng thái từ SỐ NGÀY còn lại (không nhận `Date` — biên khi đó là phép so int thuần).
 *
 * `0` là ngày hết hạn và vẫn còn hạn: khách gọi tới đúng hôm đó vẫn được bảo hành.
 */
export function trangThaiBaoHanh(ngayConLai: number): TrangThaiBaoHanh {
  if (ngayConLai < 0) return 'het_han';
  if (ngayConLai <= NGUONG_SAP_HET_NGAY) return 'sap_het';
  return 'con_han';
}

/**
 * Số tháng TRỌN còn lại, làm tròn XUỐNG — chỉ để dựng câu "Còn 5 năm". Kẹp sàn 0 vì nhánh hết
 * hạn render chuỗi cố định, không đưa số âm qua formatter.
 *
 * Đếm theo LỊCH (năm/tháng/ngày), không chia số ngày cho độ dài tháng trung bình. Phép chia đó
 * mất đúng một tháng ở mọi mốc tròn năm — một bảo hành 5 năm tra ngay hôm chốt cho
 * `1826 / 30.436875 = 59.99 ⇒ 59`, và vì `formatWarrantyMonths` chỉ in "năm" khi chia hết 12,
 * chip đọc ra "Còn 59 tháng" thay vì "Còn 5 năm" suốt vòng đời của mọi dòng.
 */
export function soThangConLai(endAt: Date, now: Date): number {
  const thang =
    (endAt.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (endAt.getUTCMonth() - now.getUTCMonth());
  // Chưa tới ngày tương ứng trong tháng đích ⇒ tháng đó chưa TRỌN.
  const tron = endAt.getUTCDate() < now.getUTCDate() ? thang - 1 : thang;
  return tron > 0 ? tron : 0;
}
