/**
 * Registry cấu hình hệ thống CHÍNH TẮC — nguồn chân lý DUY NHẤT cho mọi key setting (mirror
 * `feature-flags/domain/feature-flag-registry.ts`), do `settings/domain` sở hữu.
 *
 * BẤT BIẾN: đây là NƠI DUY NHẤT được phép chứa chuỗi key setting. Mọi nơi khác
 * `import { SETTING }` (định danh, KHÔNG literal) — rải `'vat.rate_percent'` khắp code là
 * cách một lần gõ sai chính tả biến thành "config luôn default" mà không ai thấy.
 *
 * Đây là DOMAIN thuần (không Nest/Prisma): chỉ hằng số + type.
 *
 * AD-14: config NGHIỆP VỤ sống trên DB. Bảng `system_settings` giữ TRẠNG THÁI (value);
 * registry này giữ DANH SÁCH key hợp lệ + DEFAULT. Row vắng = default — KHÔNG cần seed.
 *
 * Value bảng là String — parse theo kiểu ở service (`Number(value)` cho vat.rate_percent).
 *
 * YAGNI: đúng MỘT setting. Không dựng framework settings tổng quát (kiểu động, schema
 * validation per-key, nhóm/tab) — không ai yêu cầu, một bảng key/value là đủ.
 */

/** Định danh có tên → chuỗi key chính tắc. `as const` giữ literal narrow để suy `SettingKey`. */
export const SETTING = {
  /** Thuế suất VAT (%) áp cho báo giá (FR-3) — Int 0..100, mặc định 8. */
  vatRatePercent: 'vat.rate_percent',
} as const;

/** Union mọi key setting hợp lệ. */
export type SettingKey = (typeof SETTING)[keyof typeof SETTING];

/**
 * Default cho từng key khi bảng `system_settings` CHƯA có row — giá trị hiệu lực từ ngày đầu
 * cài hệ thống, không cần seed.
 */
export const SETTING_DEFAULTS: Readonly<Record<SettingKey, string>> = {
  [SETTING.vatRatePercent]: '8',
};
