import type { DomainEvent } from '../../events/domain-event';
import type { TransitionEvent } from '../../orders/domain/allowed-transition';

/**
 * Payment domain events — PURE DOMAIN. Published through `EventBus` AFTER the transaction
 * commits, exactly once per recorded payment; `AuditSubscriber` records them (AD-18).
 *
 * `target` is the ORDER, so an order's audit trail stays complete under one target. The note is
 * NOT carried (it may hold customer details); `paymentId` is enough to trace the row.
 *
 * Two classes rather than one parameterised by `type`: AD-18 names both events and later
 * subscribers (notifications) subscribe by name.
 */

/** Outcome of the automatic transition a payment triggered. */
export interface AutoTransitionOutcome {
  readonly event: TransitionEvent;
  readonly outcome: 'applied' | 'already' | 'skipped';
  /** Why it was skipped (the refusal message); null otherwise. */
  readonly message: string | null;
}

export interface PaymentRecordedBefore {
  readonly installmentSeq: number;
  readonly installmentPaid: number;
  readonly orderPaid: number;
}

export interface PaymentRecordedAfter {
  readonly paymentId: string;
  readonly installmentSeq: number;
  readonly amount: number;
  readonly paidOn: string;
  readonly method: string;
  readonly installmentPaid: number;
  readonly orderPaid: number;
  /** Every automatic transition this payment attempted, in order (empty when none). */
  readonly autoTransitions: readonly AutoTransitionOutcome[];
}

/** A payment against the deposit installment (milestone `coc`). */
export class DepositRecorded implements DomainEvent {
  readonly type = 'DepositRecorded';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    readonly before: PaymentRecordedBefore,
    readonly after: PaymentRecordedAfter,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
  }
}

/** A payment against any other installment. */
export class PaymentRecorded implements DomainEvent {
  readonly type = 'PaymentRecorded';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    readonly before: PaymentRecordedBefore,
    readonly after: PaymentRecordedAfter,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
  }
}
