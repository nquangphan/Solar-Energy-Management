import { Injectable, Logger } from '@nestjs/common';
import type { DomainEvent } from './domain-event';
import { EventBus, type EventSubscriber } from './event-bus';

/**
 * `InProcessEventBus` — implementation mặc định của `EventBus` port (AD-18).
 *
 * Fan-out ĐỒNG BỘ in-process: `publish` await lần lượt từng subscriber trong `try/catch`
 * CÔ LẬP — một subscriber ném lỗi → `Logger.error` (KHÔNG nuốt im lặng) rồi TIẾP TỤC các
 * subscriber còn lại; `publish` KHÔNG reject vì một consumer hỏng. Vì sao cô lập:
 * notification hỏng KHÔNG được làm mất audit và ngược lại; producer không nên sập vì một
 * side-effect phụ.
 *
 * Đồng bộ in-process (không queue/broker) đủ cho quy mô Phase 1 (~20 user, online-only —
 * YAGNI). Nếu sau cần đảm bảo delivery/ordering, đổi implementation port này (producer
 * KHÔNG đổi).
 */
@Injectable()
export class InProcessEventBus extends EventBus {
  private readonly logger = new Logger(InProcessEventBus.name);
  private readonly subscribers: EventSubscriber[] = [];

  subscribe(subscriber: EventSubscriber): void {
    this.subscribers.push(subscriber);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const subscriber of this.subscribers) {
      try {
        await subscriber.handle(event);
      } catch (err) {
        // Cô lập lỗi: log rồi tiếp tục — một consumer hỏng KHÔNG chặn consumer khác
        // và KHÔNG làm sập producer.
        this.logger.error(
          `Subscriber lỗi khi xử lý domain event '${event.type}'`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
