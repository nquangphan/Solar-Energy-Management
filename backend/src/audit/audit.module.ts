import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditSubscriber } from './audit.subscriber';

/**
 * AuditModule — đường GHI audit append-only (AD-8). `AuditSubscriber` tự đăng ký vào
 * `EventBus` (@Global) khi module init; `AuditService` ghi qua `PrismaService` (@Global).
 * Cả `EventBus` lẫn `PrismaService` đều global nên KHÔNG cần import lại ở đây.
 *
 * KHÔNG export gì — producer KHÔNG được inject `AuditService`/`AuditSubscriber` trực tiếp
 * (source-guard AD-18 enforce); mọi audit đi qua `EventBus.publish`.
 */
@Module({
  providers: [AuditService, AuditSubscriber],
})
export class AuditModule {}
