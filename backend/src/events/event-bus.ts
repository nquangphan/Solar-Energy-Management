import type { DomainEvent } from './domain-event';

/**
 * Hợp đồng consumer: một subscriber xử lý domain event. Subscriber tự đăng ký vào
 * `EventBus` (thường ở `onModuleInit`) — EventBus KHÔNG cần biết trước consumer nào.
 */
export interface EventSubscriber {
  handle(event: DomainEvent): void | Promise<void>;
}

/**
 * `EventBus` — PORT DUY NHẤT phát domain event (AD-18).
 *
 * Abstract class kiêm DI token: producer inject `EventBus` và CHỈ gọi `publish(event)`;
 * producer KHÔNG gọi FCM/notification/audit trực tiếp và KHÔNG biết implementation nào
 * đứng sau. Consumer (`AuditSubscriber`, `NotificationDispatcher`) `subscribe` để nhận
 * fan-out. Đổi implementation (queue/retry ở Epic 9…) KHÔNG đụng producer — đó là giá
 * trị cốt lõi của port.
 *
 * Implementation mặc định: `InProcessEventBus` (fan-out đồng bộ, cô lập lỗi).
 */
export abstract class EventBus {
  abstract publish(event: DomainEvent): Promise<void>;
  abstract subscribe(subscriber: EventSubscriber): void;
}
