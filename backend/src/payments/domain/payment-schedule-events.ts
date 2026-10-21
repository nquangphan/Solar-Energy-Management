import type { DomainEvent } from '../../events/domain-event';
import type { ResolvedInstallment } from './payment-schedule';

/**
 * Payment-schedule domain events — PURE DOMAIN. Published through `EventBus` AFTER the
 * transaction commits; `AuditSubscriber` records them (AD-18).
 *
 * `target` is the ORDER, so an order's audit trail stays complete under one target.
 */

/** A schedule was created or its installments replaced. `before` is null on first configure. */
export class PaymentScheduleConfigured implements DomainEvent {
  readonly type = 'PaymentScheduleConfigured';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    readonly before: readonly ResolvedInstallment[] | null,
    readonly after: readonly ResolvedInstallment[],
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
  }
}
