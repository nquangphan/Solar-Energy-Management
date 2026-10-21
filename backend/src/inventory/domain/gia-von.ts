/**
 * Giá vốn bình quân gia quyền + mã phiếu kho — DOMAIN THUẦN: không Nest, không Prisma.
 *
 * Đây là NƠI DUY NHẤT tính giá vốn bình quân và ghép mã phiếu (AD-2): client chỉ hiển thị số
 * và chuỗi backend trả.
 */

export const LOAI_PHIEU = ['nhap', 'xuat'] as const;

/** `nhap` = cộng `onHand`; `xuat` = trừ `onHand`. `qty` dòng phiếu luôn dương. */
export type LoaiPhieu = (typeof LOAI_PHIEU)[number];

/** `fieldErrors[].code` của phiếu kho — KHÔNG phải mã envelope chung (`ErrorCode`). */
export const INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK';
export const PRODUCT_NOT_STOCKABLE = 'PRODUCT_NOT_STOCKABLE';
export const DUPLICATE_PRODUCT = 'DUPLICATE_PRODUCT';
/** A return line names a product that is not on the origin stock-out. */
export const NOT_ON_ORIGIN_VOUCHER = 'NOT_ON_ORIGIN_VOUCHER';
/** A return line takes back more than the origin stock-out issued. */
export const RETURN_EXCEEDS_ISSUED = 'RETURN_EXCEEDS_ISSUED';

/**
 * Giá vốn mới sau một lô nhập, tiền integer đồng (AD-10), làm tròn MỘT điểm ở cuối
 * (`Math.round` trên số dương = nửa lên).
 *
 * `onHandTruoc <= 0` ⇒ không có hàng cũ để bình quân: lấy đúng giá nhập. Nếu không, một
 * `costPrice` gõ tay trên sản phẩm chưa từng nhập sẽ kéo lệch giá của lô hàng thật đầu tiên.
 *
 * Tràn số: DTO giới hạn `qtyNhap ≤ 1_000_000` và giá ≤ 2_147_483_647 (Int32 cột `cost_price`)
 * ⇒ `qtyNhap × donGiaNhap` ≤ ~2.1e15. `onHandTruoc` thì CỘNG DỒN qua nhiều phiếu, không bị DTO
 * chặn: tử số chính xác khi `onHandTruoc × giaVonTruoc` < `Number.MAX_SAFE_INTEGER` (9e15) — tức
 * tới ~4 triệu đv ngay cả ở giá trần — xa ngoài tồn thật của một kho.
 */
export function tinhGiaVonBinhQuan(input: {
  onHandTruoc: number;
  giaVonTruoc: number;
  qtyNhap: number;
  donGiaNhap: number;
}): number {
  const { onHandTruoc, giaVonTruoc, qtyNhap, donGiaNhap } = input;
  if (onHandTruoc <= 0) return donGiaNhap;
  return Math.round(
    (onHandTruoc * giaVonTruoc + qtyNhap * donGiaNhap) /
      (onHandTruoc + qtyNhap),
  );
}

/**
 * Mã phiếu hiển thị: `PK-N-0119` (nhập) / `PK-X-0096` (xuất) / `PK-NT-0004` (return voucher —
 * a `nhap` counted back from a cancelled order's stock-out); quá 4 chữ số thì không cắt.
 */
export function maPhieu(
  type: LoaiPhieu,
  seq: number,
  isReturn = false,
): string {
  const prefix = isReturn ? 'NT' : type === 'nhap' ? 'N' : 'X';
  return `PK-${prefix}-${String(seq).padStart(4, '0')}`;
}
