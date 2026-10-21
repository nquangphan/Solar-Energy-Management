import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import {
  LEGAL_ENTITY_FIELDS,
  type CompanyLegalEntity,
} from './domain/company-legal-entity';
import { SystemSettingChanged } from './domain/setting-events';
import { SETTING, SETTING_DEFAULTS } from './domain/setting-registry';

/**
 * Đọc/ghi cấu hình hệ thống NGHIỆP VỤ — nguồn chân lý là bảng `system_settings` trên DB
 * (AD-14), KHÔNG biến môi trường, KHÔNG hằng số trong code.
 *
 * Truy vấn CHỈ qua `PrismaService` (AD-1); side-effect CHỈ qua `EventBus` port (AD-18) —
 * đúng 2 dependency, KHÔNG inject `AuditService`/`NotificationDispatcher`.
 *
 * VẮNG ROW = DEFAULT từ registry (vat.rate_percent → 8). Không dòng seed nào phải nhớ tạo:
 * đổi giá trị là `upsert`.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Thuế suất VAT (%) hiệu lực. Vắng row ⇒ default 8 — KHÔNG ném lỗi: hệ thống chưa ai cấu
   * hình bao giờ là trạng thái BÌNH THƯỜNG, không phải lỗi.
   */
  async vatRatePercent(): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: SETTING.vatRatePercent },
    });
    return Number(row?.value ?? SETTING_DEFAULTS[SETTING.vatRatePercent]);
  }

  /**
   * Đổi thuế suất VAT. `upsert` vì row có thể chưa tồn tại (default = vắng row).
   *
   * Controller đã validate `ratePercent` Int 0..100 — service nhận số đã sạch.
   */
  async updateVatRate(
    actorAccountId: string,
    ratePercent: number,
  ): Promise<number> {
    // `before` là giá trị HIỆU LỰC (row vắng → default) — audit đọc được "8 → 10".
    const before = await this.vatRatePercent();

    const value = String(ratePercent);
    const row = await this.prisma.systemSetting.upsert({
      where: { key: SETTING.vatRatePercent },
      create: { key: SETTING.vatRatePercent, value },
      update: { value },
    });

    // SAU khi write commit — audit là consumer best-effort; publish trước/trong write sẽ ghi
    // nhật ký cho một sự việc có thể chưa xảy ra (AD-18).
    await this.eventBus.publish(
      new SystemSettingChanged(
        actorAccountId,
        { key: SETTING.vatRatePercent, value: String(before) },
        { key: SETTING.vatRatePercent, value: row.value },
        new Date(),
      ),
    );

    return Number(row.value);
  }

  /**
   * Company legal entity printed on contracts (F-4). ONE read of the 7 keys; a missing row is
   * the registry default `''` (not configured) — never an error.
   */
  async companyLegalEntity(): Promise<CompanyLegalEntity> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: LEGAL_ENTITY_FIELDS.map(({ key }) => key) } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    return Object.fromEntries(
      LEGAL_ENTITY_FIELDS.map(({ field, key }) => [
        field,
        byKey.get(key) ?? SETTING_DEFAULTS[key],
      ]),
    ) as unknown as CompanyLegalEntity;
  }

  /**
   * Replace the company legal entity. Each field is trimmed and compared with its EFFECTIVE
   * value; only changed keys are upserted, in one transaction. AFTER commit, one
   * `SystemSettingChanged` per changed key (`before.value` = previous effective value, `''` the
   * first time). Nothing changed ⇒ no write, no event.
   */
  async updateCompanyLegalEntity(
    actorAccountId: string,
    input: CompanyLegalEntity,
  ): Promise<CompanyLegalEntity> {
    const before = await this.companyLegalEntity();
    const changes = LEGAL_ENTITY_FIELDS.map(({ field, key }) => ({
      key,
      before: before[field],
      after: input[field].trim(),
    })).filter((change) => change.after !== change.before);
    if (changes.length === 0) return before;

    await this.prisma.$transaction(
      changes.map(({ key, after }) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: after },
          update: { value: after },
        }),
      ),
    );

    const occurredAt = new Date();
    for (const change of changes) {
      await this.eventBus.publish(
        new SystemSettingChanged(
          actorAccountId,
          { key: change.key, value: change.before },
          { key: change.key, value: change.after },
          occurredAt,
        ),
      );
    }

    const after = { ...before };
    for (const { field } of LEGAL_ENTITY_FIELDS) {
      (after as Record<string, string>)[field] = input[field].trim();
    }
    return after;
  }
}
