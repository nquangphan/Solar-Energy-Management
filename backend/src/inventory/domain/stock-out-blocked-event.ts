import type { DomainEvent } from '../../events/domain-event';

/**
 * A stock-out was refused for insufficient stock (FR-26, AD-18) — PURE DOMAIN: no Nest/Prisma.
 *
 * The refusal throws inside the transaction, so nothing commits; this event records the fact
 * "someone tried to issue and was blocked". Whoever owns the transaction publishes it AFTER
 * the rollback, exactly once per refused attempt. Consumers (audit now, push notification #10
 * later) subscribe — the producer never calls them directly.
 */

/** One refused line — `onHand` is the figure read UNDER the products lock. */
export interface StockOutBlockedLine {
  readonly productId: string;
  readonly qty: number;
  readonly onHand: number;
}

export interface StockOutBlockedSnapshot {
  /** Present only for an order-bound stock-out — a free-standing voucher omits the key. */
  readonly orderId?: string;
  readonly orderVersionId?: string;
  /** Only the short lines. */
  readonly lines: readonly StockOutBlockedLine[];
}

export class StockOutBlocked implements DomainEvent {
  readonly type = 'StockOutBlocked';

  readonly target?: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: StockOutBlockedSnapshot,
    readonly occurredAt: Date,
  ) {
    if (after.orderId !== undefined) {
      this.target = { type: 'Order', id: after.orderId };
    }
  }
}
