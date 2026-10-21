import {
  CHIET_KHAU_CHO_DUYET,
  CHIET_KHAU_DONG_Y,
} from './discount-approval-status';
import { lineAmount } from './line-amount';
import { TRANG_THAI_BAO_GIA } from './order-status';
import { vatApplies } from './vat-mode';

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

export interface OrderTotalsResolutionInput {
  readonly lines: ReadonlyArray<{ unitPrice: number; qty: number }>;
  /** Effective version snapshot fields; `null` when the order has no effective version. */
  readonly version: {
    readonly vatRate: number | null;
    readonly vatMode: string | null;
    readonly discountAmount: number | null;
  } | null;
  readonly order: {
    readonly status: string;
    readonly vatMode: string | null;
    /** Latest discount approval of the order, if any. */
    readonly discount: {
      readonly status: string;
      readonly amount: number;
    } | null;
  };
  /** Configured VAT rate, used only when the version has no snapshotted rate. */
  readonly fallbackVatRate: number;
}

export interface ResolvedOrderTotals {
  readonly totals: OrderTotals;
  readonly vatRate: number;
  readonly applyVat: boolean;
}

/**
 * The ONE place that decides the inputs of an order's after-VAT total, then calls
 * `computeOrderTotals` (still one pricing function, AD-16). Shared by the printed quote and the
 * payment schedule so both show the same number for the same order.
 *
 *  - vatRate/applyVat: version snapshot once confirmed, else `Order.vatMode` + configured rate.
 *  - discountAmount: version snapshot; without a snapshot, the latest approval counts when the
 *    order is past `baogia` and the approval is pending or approved; otherwise 0.
 */
export function resolveOrderTotals(
  input: OrderTotalsResolutionInput,
): ResolvedOrderTotals {
  const { version, order } = input;
  const vatRate = version?.vatRate ?? input.fallbackVatRate;
  const applyVat = vatApplies(version?.vatMode ?? order.vatMode);
  const discountAmount =
    version?.discountAmount ??
    (order.status !== TRANG_THAI_BAO_GIA &&
    order.discount !== null &&
    (order.discount.status === CHIET_KHAU_CHO_DUYET ||
      order.discount.status === CHIET_KHAU_DONG_Y)
      ? order.discount.amount
      : 0);
  const totals = computeOrderTotals({
    lines: input.lines,
    vatRate,
    applyVat,
    discountAmount,
  });
  return { totals, vatRate, applyVat };
}
