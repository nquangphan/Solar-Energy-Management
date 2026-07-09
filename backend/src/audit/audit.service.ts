import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DomainEvent } from '../events/domain-event';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `AuditService` — đường GHI audit append-only (AD-8). Map 5 chiều của một domain event
 * sang một bản ghi `AuditLog` bất biến qua `prisma.auditLog.create`.
 *
 * APPEND-ONLY là bất biến: service này CHỈ expose `record` (create) — KHÔNG `update`/
 * `delete`/`upsert`. Không có đường code nào sửa/xoá audit sau khi ghi.
 *
 * CHỈ chạm DB qua `PrismaService` (AD-1) — KHÔNG `new PrismaClient()`. Đọc audit (chỉ
 * Super Admin, gate `audit.read`) là Story 8.5, KHÔNG thuộc đây.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: DomainEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        eventType: event.type,
        actorAccountId: event.actorAccountId ?? null,
        targetType: event.target?.type ?? null,
        targetId: event.target?.id ?? null,
        before: toJsonInput(event.before),
        after: toJsonInput(event.after),
        occurredAt: event.occurredAt,
      },
    });
  }
}

/**
 * `before`/`after` là `unknown` (E4+ tự quyết shape) → chuẩn hoá an toàn cho cột `Json?`:
 * `undefined` → bỏ field (Prisma không ghi cột); `null` → `Prisma.JsonNull` (JSON null);
 * giá trị khác → `Prisma.InputJsonValue`.
 *
 * `null` PHẢI đi qua `Prisma.JsonNull`: kiểu cột nullable Json KHÔNG nhận `null` trần
 * (`NullableJsonNullValueInput | InputJsonValue | undefined`). Ép `null as InputJsonValue`
 * là dối kiểu — Prisma có thể siết validate và ném; lỗi đó bị EventBus cô lập + nuốt vào
 * log ⇒ MẤT audit trong im lặng. Nhánh `null` vì vậy phải được kiểm bởi type-checker.
 */
function toJsonInput(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  // `before`/`after` là `unknown` theo hợp đồng → cast thu hẹp là không tránh khỏi.
  return value as Prisma.InputJsonValue;
}
