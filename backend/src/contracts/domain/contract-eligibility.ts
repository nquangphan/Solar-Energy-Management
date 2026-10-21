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
 * When a contract may be generated — PURE DOMAIN. The overview (`generatable`/`blockedReason`)
 * and the POST (400/409) call the SAME function, so the screen never promises what the server
 * then refuses.
 *
 * Nothing here depends on the company legal entity: a missing setting prints "Chưa cấu hình"
 * and never blocks (F-4).
 */

/**
 * Confirmed orders only: prices are snapshotted at confirm, so the printed total is stable.
 * `baogia`/`choduyet` still have a live total; `huy` is never signed. `hoanthanh` may reprint.
 */
export const CONTRACT_ORDER_STATUSES: ReadonlySet<string> = new Set([
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_THI_CONG,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_HOAN_THANH,
]);

export const CONTRACT_BLOCKED_MESSAGE = {
  status: 'Chỉ sinh hợp đồng khi đơn đã chốt và chưa huỷ.',
  noLines: 'Đơn chưa có dòng vật tư — không sinh hợp đồng được.',
  noSchedule:
    'Đơn chưa có lịch thanh toán — cấu hình lịch trước khi sinh hợp đồng.',
  scheduleMismatch:
    'Tổng các đợt thanh toán lệch tổng đơn — sửa lịch trước khi sinh hợp đồng.',
} as const;

export interface ContractBlocker {
  readonly status: 400 | 409;
  readonly message: string;
}

export interface ContractEligibilityInput {
  readonly status: string;
  readonly lineCount: number;
  readonly hasSchedule: boolean;
  /** Σ installment amounts (integer dong). */
  readonly scheduleTotal: number;
  /** After-VAT order total from `resolveOrderTotals` (integer dong). */
  readonly orderTotal: number;
}

/**
 * First reason the order cannot get a contract, or `null`. Fixed order: status → lines →
 * schedule exists → schedule adds up. A schedule that does not add up to the total is saved
 * with a warning (7.1), but a legal document whose installments do not sum to its stated value
 * is wrong, so it blocks here.
 */
export function contractBlocker(
  input: ContractEligibilityInput,
): ContractBlocker | null {
  if (!CONTRACT_ORDER_STATUSES.has(input.status)) {
    return { status: 409, message: CONTRACT_BLOCKED_MESSAGE.status };
  }
  if (input.lineCount === 0) {
    return { status: 400, message: CONTRACT_BLOCKED_MESSAGE.noLines };
  }
  if (!input.hasSchedule) {
    return { status: 409, message: CONTRACT_BLOCKED_MESSAGE.noSchedule };
  }
  if (input.scheduleTotal !== input.orderTotal) {
    return { status: 409, message: CONTRACT_BLOCKED_MESSAGE.scheduleMismatch };
  }
  return null;
}

/**
 * Short schedule summary for the screen: every installment by percent ⇒ `"20/70/10"`; any
 * installment by amount ⇒ `"3 đợt"`; no schedule ⇒ `null`.
 */
export function scheduleLabelOf(
  installments: ReadonlyArray<{ readonly percent: number | null }> | null,
): string | null {
  if (installments === null || installments.length === 0) return null;
  if (installments.every((installment) => installment.percent !== null)) {
    return installments.map((installment) => installment.percent).join('/');
  }
  return `${installments.length} đợt`;
}
