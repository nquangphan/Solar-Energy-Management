/**
 * Khả dụng của MỘT sản phẩm từ hai con số độc lập (AD-19) — DOMAIN THUẦN: không Nest, không
 * Prisma.
 *
 * Đây là NƠI DUY NHẤT tính `onHand − reserved` (AD-2): web và mobile chỉ render số trả về và
 * rẽ nhánh theo `tinhTrang`. Hai bản cài đặt phép trừ ở client là hai cơ hội lệch nhau đúng ở
 * con số sale dùng để hứa hàng.
 */

export const TINH_TRANG_TON = ['du', 'het', 'am'] as const;

/** `du` = còn khả dụng · `het` = khả dụng đúng 0 · `am` = đã hứa vượt hàng thật. */
export type TinhTrangTon = (typeof TINH_TRANG_TON)[number];

export interface TonKho {
  onHand: number;
  reserved: number;
  /** `onHand − reserved` — CÓ THỂ ÂM. */
  khaDung: number;
  /** Phần thiếu phải nhập: `−khaDung` khi âm, ngược lại `0`. Không bao giờ âm. */
  canNhap: number;
  tinhTrang: TinhTrangTon;
}

export function tinhTonKho(input: {
  onHand: number;
  reserved: number;
}): TonKho {
  const { onHand, reserved } = input;
  const khaDung = onHand - reserved;
  return {
    onHand,
    reserved,
    khaDung,
    canNhap: khaDung < 0 ? -khaDung : 0,
    tinhTrang: khaDung > 0 ? 'du' : khaDung === 0 ? 'het' : 'am',
  };
}
