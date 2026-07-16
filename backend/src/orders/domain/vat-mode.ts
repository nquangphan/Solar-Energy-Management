/**
 * Registry tick áp VAT trên Đơn (FR-3) — DOMAIN THUẦN (không Nest/Prisma), cùng khuôn
 * `scope-preset.ts`/`customer-type.ts`. String trong DB (nhất quán `Order.status`/`custType`,
 * KHÔNG Postgres enum); bộ khoá sống Ở MỘT NƠI này — literal ngoài registry là mầm bug
 * chính tả ("khong_vat" gõ nhầm thành cờ luôn-có-VAT mà không ai thấy).
 */

/** Định danh có tên → giá trị chính tắc. `as const` giữ literal narrow để suy `VatMode`. */
export const VAT_MODE = {
  /** Có tính VAT — mặc định mọi đơn mới (ghi TƯỜNG MINH lúc tạo, không dựa DB default). */
  coVat: 'co_vat',
  /** Không tính VAT — `vatAmount = 0`, `total = subtotal`. */
  khongVat: 'khong_vat',
} as const;

/** Union mọi giá trị hợp lệ. */
export type VatMode = (typeof VAT_MODE)[keyof typeof VAT_MODE];

/** Danh sách giá trị chính tắc — nguồn cho `@IsIn` ở DTO. */
export const VAT_MODES: readonly VatMode[] = [
  VAT_MODE.coVat,
  VAT_MODE.khongVat,
];

/**
 * Đơn này có tính VAT không. `null` ⇒ CÓ: đơn tạo TRƯỚC 4.4 có `vatMode` null và preview
 * hiện hành đã luôn tính VAT cho chúng (`applyVat: true`) — đổi hành vi là đổi tiền của
 * đơn cũ. Đơn MỚI luôn ghi `'co_vat'` tường minh (bài học preset 4.3 — default DB không
 * mang ngữ nghĩa).
 */
export function vatApplies(mode: string | null): boolean {
  return mode !== VAT_MODE.khongVat;
}
