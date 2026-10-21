import type { DomainEvent } from '../../events/domain-event';

/**
 * An order-bound stock-out took effect (FR-26, AD-18) — PURE DOMAIN: no Nest/Prisma.
 *
 * The write path BUILDS the event inside the transaction and returns it; `OrdersService`
 * publishes it AFTER commit (only it knows when the commit happens). An order-bound
 * voucher emits ONLY this event — no `StockVoucherCreated` alongside: one action, one
 * business audit row.
 */

/** One voucher line with on-hand before/after and the reservation released for the order. */
export interface StockIssuedLineSnapshot {
  readonly productId: string;
  readonly qty: number;
  readonly unitCost: number;
  readonly onHandBefore: number;
  readonly onHandAfter: number;
  readonly reservedReleased: number;
}

export interface StockIssuedSnapshot {
  readonly id: string;
  readonly code: string;
  readonly orderId: string;
  readonly orderVersionId: string;
  readonly lines: readonly StockIssuedLineSnapshot[];
}

export class StockIssued implements DomainEvent {
  readonly type = 'StockIssued';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: StockIssuedSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'StockVoucher', id: after.id };
  }
}
