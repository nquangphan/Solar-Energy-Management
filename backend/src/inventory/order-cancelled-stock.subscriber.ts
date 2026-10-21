import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { DomainEvent } from '../events/domain-event';
import { EventBus, type EventSubscriber } from '../events/event-bus';
import { StockVouchersService } from './stock-vouchers.service';

/**
 * Releases what a cancelled order still holds in the stock ledger.
 *
 * `OrderCancelled` is the ONLY seam between cancelling and stock: the cancel path itself never
 * touches stock. Matched by `event.type` + `event.target` (the `DomainEvent` contract), not by
 * importing the event class from `orders/` — dependencies stay one-way (`orders → inventory`).
 *
 * Runs after the cancel committed; a failure leaves the hold in place. It is logged HERE with
 * the order id (the bus log names only the event type), so the stuck order can be found, and
 * rethrown so the bus still isolates it. The release is idempotent: rerunning
 * `releaseForCancelledOrder(orderId)` is safe. Stock already issued is NOT put back here —
 * only a counted return voucher does that.
 */
@Injectable()
export class OrderCancelledStockSubscriber
  implements EventSubscriber, OnModuleInit
{
  private readonly logger = new Logger(OrderCancelledStockSubscriber.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly stockVouchers: StockVouchersService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    const target = event.target;
    if (event.type !== 'OrderCancelled' || target?.type !== 'Order') return;
    try {
      await this.stockVouchers.releaseForCancelledOrder(target.id);
    } catch (err) {
      this.logger.error(
        `Cancelled order ${target.id} still holds stock: release failed, rerun releaseForCancelledOrder`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
