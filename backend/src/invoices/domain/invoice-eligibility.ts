import {
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_HOAN_THANH,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_THI_CONG,
} from '../../orders/domain/order-status';

/**
 * When an invoice may be created — PURE DOMAIN. The overview (`creatable`/`blockedReason`) and
 * the POST (400/409) call the SAME function, so the screen never promises what the server then
 * refuses.
 *
 * Nothing here depends on the customer's tax code (an individual has none), the payment schedule
 * or the amount collected.
 */

/**
 * Confirmed orders only: prices are snapshotted at confirm, so the invoiced total is stable.
 * `baogia`/`choduyet` still have a live total; `huy` is never invoiced; `hoanthanh` may be
 * (invoices are often issued at settlement). Same set as the contract statuses on purpose —
 * both mean "the price is frozen" — but declared here so `invoices/` never depends on
 * `contracts/`.
 */
export const INVOICE_ORDER_STATUSES: ReadonlySet<string> = new Set([
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_THI_CONG,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_HOAN_THANH,
]);

export const INVOICE_BLOCKED_MESSAGE = {
  status: 'Chỉ tạo hoá đơn khi đơn đã chốt và chưa huỷ.',
  noLines: 'Đơn chưa có dòng vật tư — không tạo hoá đơn được.',
} as const;

export interface InvoiceBlocker {
  readonly status: 400 | 409;
  readonly message: string;
}

export interface InvoiceEligibilityInput {
  readonly status: string;
  readonly lineCount: number;
}

/** First reason the order cannot get an invoice, or `null`. Fixed order: status → lines. */
export function invoiceBlocker(
  input: InvoiceEligibilityInput,
): InvoiceBlocker | null {
  if (!INVOICE_ORDER_STATUSES.has(input.status)) {
    return { status: 409, message: INVOICE_BLOCKED_MESSAGE.status };
  }
  if (input.lineCount === 0) {
    return { status: 400, message: INVOICE_BLOCKED_MESSAGE.noLines };
  }
  return null;
}
