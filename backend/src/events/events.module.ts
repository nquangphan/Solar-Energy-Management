import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus';
import { InProcessEventBus } from './in-process-event-bus';

/**
 * EventsModule — `@Global` để MỌI module domain (E3+) inject `EventBus` publish domain
 * event mà không cần import lại (mirror `PrismaModule` @Global). Provide implementation
 * mặc định `InProcessEventBus` qua class token `EventBus` và export port.
 *
 * EventsModule KHÔNG biết consumer nào tồn tại — consumer (`AuditSubscriber`,
 * `NotificationDispatcher`) TỰ đăng ký `onModuleInit` (decoupled thật; thêm consumer =
 * thêm module, KHÔNG sửa EventsModule).
 */
@Global()
@Module({
  providers: [{ provide: EventBus, useClass: InProcessEventBus }],
  exports: [EventBus],
})
export class EventsModule {}
