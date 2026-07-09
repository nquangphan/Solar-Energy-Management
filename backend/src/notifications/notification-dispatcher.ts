import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { DomainEvent } from '../events/domain-event';
import { EventBus, type EventSubscriber } from '../events/event-bus';

/**
 * `NotificationDispatcher` — consumer gửi push tập trung (AD-14, AD-18).
 *
 * BẢN ĐẦU NO-OP/LOG: `handle` CHỈ `Logger.log` (bằng chứng port hoạt động), KHÔNG gọi
 * FCM/HTTP/mạng (không có `firebase-admin` trong deps). TỰ đăng ký vào `EventBus` port ở
 * `onModuleInit`.
 *
 * Epic 9 THAY implementation này bằng bộ gửi FCM thật (`firebase-admin` + resolver
 * người-nhận-theo-quyền AD-15 + deep-link) — producer KHÔNG đổi vì vẫn `eventBus.publish`
 * (AC-3). Đây chính là seam để "lắp bộ gửi sau không mở lại code chức năng".
 */
@Injectable()
export class NotificationDispatcher implements EventSubscriber, OnModuleInit {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(private readonly eventBus: EventBus) {}

  onModuleInit(): void {
    this.eventBus.subscribe(this);
  }

  handle(event: DomainEvent): void {
    this.logger.log(`domain event: ${event.type}`);
  }
}
