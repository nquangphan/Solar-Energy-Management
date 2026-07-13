import type { DomainEvent } from '../../events/domain-event';
import type { FeatureFlagKey } from './feature-flag-registry';

/**
 * Domain event của cờ tính năng (mirror `catalog/domain/product-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `FeatureFlagsService` publish qua `EventBus` port
 * SAU khi write commit; `AuditSubscriber` ghi `AuditLog` — producer KHÔNG gọi thẳng consumer
 * nào (AD-18).
 *
 * Bấm cờ là hành động NGHIỆP VỤ có hệ quả tiền bạc (bật giá sỉ cho toàn danh mục), nên nó
 * phải để lại dấu vết ai-bấm-khi-nào như mọi thay đổi khác.
 */

/** Trạng thái một cờ tại một thời điểm. */
export interface FeatureFlagSnapshot {
  readonly key: FeatureFlagKey;
  readonly enabled: boolean;
}

/**
 * Cờ được bật/tắt. `target.id` là chính TÊN CỜ — cờ không có id uuid riêng (tên là khoá).
 */
export class FeatureFlagToggled implements DomainEvent {
  readonly type = 'FeatureFlagToggled';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: FeatureFlagSnapshot,
    readonly after: FeatureFlagSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'FeatureFlag', id: after.key };
  }
}
