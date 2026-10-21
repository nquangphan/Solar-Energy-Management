import type { DomainEvent } from '../../events/domain-event';
import type { ContractType } from './contract-type';

/**
 * Domain events of contracts (AD-18). `ContractsService` publishes via the `EventBus` port AFTER
 * the contract row is written; `AuditSubscriber` records it — the producer never calls audit.
 *
 * `target` is the ORDER, so an order's audit trail stays complete under one target. The payload
 * carries no customer or company data — only what identifies the generated document.
 */
export class ContractGenerated implements DomainEvent {
  readonly type = 'ContractGenerated';

  readonly target: { readonly type: string; readonly id: string };

  readonly after: {
    readonly contractId: string;
    readonly contractNo: string;
    readonly contractType: ContractType;
    readonly orderVersionId: string;
    readonly fileName: string;
  };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    contract: {
      readonly contractId: string;
      readonly contractNo: string;
      readonly contractType: ContractType;
      readonly orderVersionId: string;
      readonly fileName: string;
    },
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
    this.after = { ...contract };
  }
}
