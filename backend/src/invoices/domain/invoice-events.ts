import type { DomainEvent } from '../../events/domain-event';

/**
 * Domain events of invoices (AD-18). `InvoicesService` publishes via the `EventBus` port AFTER
 * the invoice row is committed; `AuditSubscriber` records it — the producer never calls audit.
 *
 * `target` is the ORDER, so an order's audit trail stays complete under one target. The payload
 * carries no customer data, and `total` is a plain `number` (a `bigint` cannot be serialised).
 */
export class InvoiceCreated implements DomainEvent {
  readonly type = 'InvoiceCreated';

  readonly target: { readonly type: string; readonly id: string };

  readonly after: {
    readonly invoiceId: string;
    readonly invoiceNo: string;
    readonly orderVersionId: string;
    readonly total: number;
  };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    invoice: {
      readonly invoiceId: string;
      readonly invoiceNo: string;
      readonly orderVersionId: string;
      readonly total: number;
    },
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
    this.after = { ...invoice };
  }
}

/**
 * The PDF of an invoice was rendered and stored for the first time. A later export returns the
 * stored file and publishes nothing. `occurredAt` is the stored row's `createdAt`, so the audit
 * row and the response carry one timestamp.
 */
export class InvoicePdfExported implements DomainEvent {
  readonly type = 'InvoicePdfExported';

  readonly target: { readonly type: string; readonly id: string };

  readonly after: {
    readonly invoiceId: string;
    readonly invoiceNo: string;
    readonly fileName: string;
  };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    pdf: {
      readonly invoiceId: string;
      readonly invoiceNo: string;
      readonly fileName: string;
    },
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
    this.after = { ...pdf };
  }
}
