import { lineAmount } from './line-amount';

/**
 * Hàm pricing DUY NHẤT của Đơn (AD-10/AD-16) — DOMAIN THUẦN (không Nest/Prisma/EventBus).
 *
 * Đây là bản nâng cấp của "hạt giống" `line-amount.ts`: subtotal = Σ `lineAmount()` từng
 * dòng (tái dùng seed, KHÔNG viết lại phép nhân), VAT làm tròn half-up THUẦN INTEGER tại
 * ĐÚNG MỘT điểm — grand-subtotal, không per-line. MỌI đường tính tổng tiền Đơn PHẢI gọi
 * hàm này: preview realtime (4.2), tick/áp thuế suất cấu hình (4.4), Chốt snapshot (4.5) —
 * CẤM bộ tính thứ hai, client CẤM số học tiền.
 *
 * `Math.floor((subtotal * vatRate + 50) / 100)` là half-up thuần số nguyên — CẤM
 * `Math.round(subtotal * vatRate / 100)` (phép chia float trước khi round có thể lệch ULP).
 * `vatRate` là Int PHẦN TRĂM (8 = 8%) — khớp cột `OrderVersion.vatRate Int?` mà 4.5 snapshot.
 * Tràn số không đáng lo: tiền int đồng thực tế × 500 dòng vẫn xa 2^53.
 */

/** Thuế suất mặc định 8% (PRD FR-3) — 4.4 thay chỗ RESOLVE bằng config, không đổi chữ ký hàm. */
export const VAT_RATE_MAC_DINH = 8;

export interface OrderTotalsInput {
  readonly lines: ReadonlyArray<{ unitPrice: number; qty: number }>;
  /** Phần trăm nguyên (8 = 8%). */
  readonly vatRate: number;
  readonly applyVat: boolean;
  /** Chiết khấu int đồng trên Đơn (FR-18) — trừ TRƯỚC VAT; mặc định 0 = không chiết khấu. */
  readonly discountAmount?: number;
}

export interface OrderTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly vatAmount: number;
  readonly total: number;
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  let subtotal = 0;
  for (const line of input.lines) {
    subtotal += lineAmount(line.unitPrice, line.qty);
  }
  // Chiết khấu trừ thẳng subtotal thành vatBase — thuế tính trên số tiền thực thu (4.7).
  // VẪN MỘT hàm pricing, VẪN MỘT điểm làm tròn (AD-16): half-up trên vatBase.
  const discountAmount = input.discountAmount ?? 0;
  const vatBase = subtotal - discountAmount;
  const vatAmount = input.applyVat
    ? Math.floor((vatBase * input.vatRate + 50) / 100)
    : 0;
  return { subtotal, discountAmount, vatAmount, total: vatBase + vatAmount };
}
