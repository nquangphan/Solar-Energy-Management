/**
 * Registry cờ tính năng CHÍNH TẮC — nguồn chân lý DUY NHẤT cho mọi tên cờ (mirror
 * `accounts/domain/permission-registry.ts`), do `feature-flags/domain` sở hữu.
 *
 * BẤT BIẾN: đây là NƠI DUY NHẤT được phép chứa chuỗi tên cờ. Mọi nơi khác `import { FLAG }`
 * (định danh, KHÔNG literal) — rải `'catalog.tiered_pricing'` khắp code là cách một lần gõ
 * sai chính tả biến thành "cờ luôn TẮT" mà không ai thấy.
 *
 * Đây là DOMAIN thuần (không Nest/Prisma): chỉ hằng số + type.
 *
 * AD-14: cờ NGHIỆP VỤ sống trên DB, KHÔNG Firebase Remote Config. Bảng `feature_flags` giữ
 * TRẠNG THÁI (bật/tắt); registry này giữ DANH SÁCH cờ hợp lệ. Một key không có trong đây
 * KHÔNG phải là cờ — `PATCH /feature-flags/:key` với key lạ trả 404, không âm thầm tạo cờ mới.
 *
 * YAGNI: đúng MỘT cờ. Không dựng hệ thống feature-flag tổng quát (rollout %, targeting,
 * audience) — không ai yêu cầu, và một bảng key/value là đủ.
 */

/** Định danh có tên → chuỗi key chính tắc. `as const` giữ literal narrow để suy `FeatureFlagKey`. */
export const FLAG = {
  /** Giá phân tầng lẻ/sỉ (FR-15) — mặc định TẮT; bật/tắt gate bởi `system.feature_flags`. */
  catalogTieredPricing: 'catalog.tiered_pricing',
} as const;

/** Union mọi tên cờ hợp lệ. */
export type FeatureFlagKey = (typeof FLAG)[keyof typeof FLAG];

/** Một mục trong registry: key chính tắc + nhãn tiếng Việt (màn cấu hình hệ thống). */
export interface FeatureFlagEntry {
  readonly key: FeatureFlagKey;
  readonly label: string;
}

/**
 * Danh sách cờ chính tắc — thứ tự này QUYẾT ĐỊNH thứ tự `GET /feature-flags` (deterministic).
 */
export const FEATURE_FLAGS: readonly FeatureFlagEntry[] = [
  {
    key: FLAG.catalogTieredPricing,
    label: 'Giá phân tầng (lẻ/sỉ)',
  },
];

/** Mọi key chính tắc theo thứ tự registry. */
export const FEATURE_FLAG_KEYS: readonly FeatureFlagKey[] = FEATURE_FLAGS.map(
  (entry) => entry.key,
);

const FEATURE_FLAG_KEY_SET: ReadonlySet<string> = new Set(FEATURE_FLAG_KEYS);

/** Type-guard: `value` có phải một cờ trong registry không (validate ở tầng app). */
export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return FEATURE_FLAG_KEY_SET.has(value);
}
