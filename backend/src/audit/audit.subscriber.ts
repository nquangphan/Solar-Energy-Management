import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { DomainEvent } from '../events/domain-event';
import { EventBus, type EventSubscriber } from '../events/event-bus';
import { AuditService } from './audit.service';

/**
 * `AuditSubscriber` — consumer ghi audit cho MỌI domain event (AD-8, AD-18).
 *
 * TỰ đăng ký vào `EventBus` port ở `onModuleInit` (decoupled: EventsModule KHÔNG biết
 * audit tồn tại). `handle` uỷ thác cho `AuditService.record` — subscriber mỏng, logic
 * ghi nằm ở service. Lỗi ghi (nếu có) được `InProcessEventBus` cô lập + log, KHÔNG làm
 * sập producer.
 */
@Injectable()
export class AuditSubscriber implements EventSubscriber, OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    await this.auditService.record(event);
  }
}
