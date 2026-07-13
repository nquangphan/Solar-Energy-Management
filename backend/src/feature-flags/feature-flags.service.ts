import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import { FeatureFlagToggled } from './domain/feature-flag-events';
import {
  FEATURE_FLAGS,
  type FeatureFlagKey,
} from './domain/feature-flag-registry';

/**
 * Đọc/ghi cờ tính năng NGHIỆP VỤ — nguồn chân lý là bảng `feature_flags` trên DB (AD-14),
 * KHÔNG Firebase Remote Config, KHÔNG biến môi trường, KHÔNG hằng số trong code.
 *
 * Truy vấn CHỈ qua `PrismaService` (AD-1); side-effect CHỈ qua `EventBus` port (AD-18) —
 * KHÔNG inject `AuditService`/`NotificationDispatcher`.
 *
 * VẮNG DÒNG = TẮT (fail-closed). Không dòng seed nào phải nhớ tạo: bật cờ là `upsert`.
 *
 * TẮT CỜ KHÔNG XOÁ DỮ LIỆU. Service này chỉ chạm bảng `feature_flags` — nó không có đường
 * nào tới `product_prices`, nên "tắt cờ" không thể xoá bậc thang giá dù muốn. Bậc thang ngủ
 * đông; bật lại cờ là có ngay. Đó là một hệ quả kiến trúc, không phải một nhánh `if`.
 */

/** Trạng thái một cờ trả cho client: key + nhãn + bật/tắt. */
export interface FeatureFlagState {
  readonly key: FeatureFlagKey;
  readonly label: string;
  readonly enabled: boolean;
}

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Cờ có đang bật không. Vắng dòng ⇒ `false` — KHÔNG ném lỗi: một cờ chưa ai bấm bao giờ là
   * trạng thái BÌNH THƯỜNG (hệ thống mới cài), không phải lỗi cấu hình.
   */
  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const row = await this.prisma.featureFlag.findUnique({ where: { key } });
    return row?.enabled ?? false;
  }

  /**
   * MỌI cờ trong registry kèm trạng thái — không phải "mọi dòng có trong DB". Cờ chưa từng
   * được bấm không có dòng nào, nhưng nó vẫn là một cờ hợp lệ và phải hiện ra (với
   * `enabled: false`); trả theo DB sẽ khiến cờ mới thêm vào registry vô hình với client cho
   * tới lần bấm đầu tiên.
   */
  async listAll(): Promise<FeatureFlagState[]> {
    const rows = await this.prisma.featureFlag.findMany();
    const enabledByKey = new Map(rows.map((row) => [row.key, row.enabled]));
    return FEATURE_FLAGS.map((entry) => ({
      key: entry.key,
      label: entry.label,
      enabled: enabledByKey.get(entry.key) ?? false,
    }));
  }

  /**
   * Bật/tắt một cờ. `upsert` vì dòng có thể chưa tồn tại (mặc định TẮT = vắng dòng).
   *
   * Caller (controller) đã kiểm `key` thuộc registry — service nhận `FeatureFlagKey` đã hẹp
   * kiểu, không tự tạo cờ lạ.
   */
  async setEnabled(
    actorAccountId: string,
    key: FeatureFlagKey,
    enabled: boolean,
  ): Promise<FeatureFlagState> {
    const before = await this.isEnabled(key);

    const row = await this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled },
      update: { enabled },
    });

    // SAU khi write commit — audit là consumer best-effort; publish trước/trong write sẽ ghi
    // nhật ký cho một sự việc có thể chưa xảy ra (AD-18).
    await this.eventBus.publish(
      new FeatureFlagToggled(
        actorAccountId,
        { key, enabled: before },
        { key, enabled: row.enabled },
        new Date(),
      ),
    );

    const entry = FEATURE_FLAGS.find((candidate) => candidate.key === key);
    return {
      key,
      label: entry?.label ?? key,
      enabled: row.enabled,
    };
  }
}
