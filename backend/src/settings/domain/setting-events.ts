import type { DomainEvent } from '../../events/domain-event';
import type { SettingKey } from './setting-registry';

/**
 * Domain event của cấu hình hệ thống (mirror `feature-flags/domain/feature-flag-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `SettingsService` publish qua `EventBus` port SAU
 * khi write commit; `AuditSubscriber` ghi `AuditLog` — producer KHÔNG gọi thẳng consumer nào
 * (AD-18).
 *
 * Đổi thuế suất VAT là hành động NGHIỆP VỤ có hệ quả tiền bạc (đổi cách tính thuế của MỌI báo
 * giá từ đó về sau), nên nó phải để lại dấu vết ai-đổi-khi-nào như mọi thay đổi khác.
 */

/** Trạng thái một setting tại một thời điểm. `value` là String thô như trong bảng. */
export interface SystemSettingSnapshot {
  readonly key: SettingKey;
  readonly value: string;
}

/**
 * Setting được thay đổi. `target.id` là chính KEY — setting không có id uuid riêng (key là
 * khoá). `before.value` với row chưa từng tồn tại = default từ registry (giá trị HIỆU LỰC
 * trước đó, không phải "null" — audit đọc được "8 → 10" thay vì "? → 10").
 */
export class SystemSettingChanged implements DomainEvent {
  readonly type = 'SystemSettingChanged';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: SystemSettingSnapshot,
    readonly after: SystemSettingSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'SystemSetting', id: after.key };
  }
}
