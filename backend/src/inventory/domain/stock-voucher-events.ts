import type { DomainEvent } from '../../events/domain-event';
import type { LoaiPhieu } from './gia-von';

/**
 * Domain event của phiếu kho (FR-25, AD-18) — DOMAIN THUẦN: không Nest/Prisma.
 *
 * `StockVouchersService` publish SAU khi transaction commit; `AuditSubscriber` ghi `AuditLog`.
 * Audit ghi SỰ THẬT ĐẦY ĐỦ (cả giá vốn trước/sau) — người xem nhật ký đã bị gate `audit.read`.
 */

/** Một dòng phiếu kèm số tồn/giá vốn trước–sau khi phiếu có hiệu lực. */
export interface StockVoucherLineSnapshot {
  readonly productId: string;
  readonly qty: number;
  readonly unitCost: number;
  readonly onHandTruoc: number;
  readonly onHandSau: number;
  readonly giaVonTruoc: number;
  readonly giaVonSau: number;
}

export interface StockVoucherSnapshot {
  readonly id: string;
  readonly ma: string;
  readonly type: LoaiPhieu;
  readonly note: string | null;
  readonly lines: readonly StockVoucherLineSnapshot[];
  /** Return voucher only: the origin stock-out it counts stock back from. */
  readonly returnOfVoucherId?: string;
  /** Return voucher only: the cancelled order of the origin stock-out. */
  readonly orderId?: string;
}

/** Phiếu kho mới có hiệu lực — phiếu không sửa/xoá nên không có trạng thái "trước". */
export class StockVoucherCreated implements DomainEvent {
  readonly type = 'StockVoucherCreated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: StockVoucherSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'StockVoucher', id: after.id };
  }
}
