/**
 * Phân giải đơn giá theo bậc thang số lượng — DOMAIN THUẦN (không Nest/Prisma/EventBus).
 *
 * Đây là "API" mà Story 3.2 để lại cho Epic 4: Story 4.1 ("dòng pick từ Sản phẩm — auto-điền
 * đơn giá theo danh mục hiện tại") sẽ `import` thẳng hàm này. Viết nó cho NGƯỜI KHÁC dùng —
 * vì vậy nó không giả định gì về caller: không giả định `tiers` đã sắp xếp, không giả định
 * caller đã kiểm cờ hộ.
 *
 * Tiền là INTEGER ĐỒNG (AD-10/AD-16): hàm chỉ CHỌN một con số có sẵn, KHÔNG làm tròn, KHÔNG
 * nhân chia. Không có phép tính nào ở đây thì không có sai số nào ở đây.
 */

/** Một mức trong bậc thang: mua TỪ `minQty` trở lên thì đơn giá là `price`. */
export interface PriceTier {
  readonly minQty: number;
  readonly price: number;
}

export interface ResolveUnitPriceInput {
  /** Giá gốc `Product.price` — CHÍNH LÀ mức `minQty = 1` ngầm định. */
  readonly basePrice: number;
  /** Bậc thang đã cấu hình. KHÔNG cần sắp xếp trước. */
  readonly tiers: readonly PriceTier[];
  /** Số lượng đang mua. */
  readonly quantity: number;
  /** Cờ `catalog.tiered_pricing`. TẮT ⇒ bậc thang bị lờ đi hoàn toàn. */
  readonly tieredPricingEnabled: boolean;
}

/**
 * Ba luật, đúng thứ tự này:
 *
 *  1. Cờ TẮT ⇒ `basePrice`. Chốt chặn ĐẦU TIÊN — không thèm nhìn `tiers`. Tắt cờ KHÔNG xoá
 *     dòng `ProductPrice` (chúng ngủ đông trong DB), nên nếu bỏ nhánh này, một sản phẩm từng
 *     cấu hình giá sỉ sẽ vẫn ăn giá sỉ sau khi cờ đã tắt — bất biến "cờ TẮT ⇒ một giá duy
 *     nhất" vỡ âm thầm.
 *  2. Không tier nào có `minQty <= quantity` ⇒ `basePrice` (mua ít hơn ngưỡng thấp nhất).
 *  3. Ngược lại ⇒ `price` của tier có `minQty` LỚN NHẤT mà vẫn `<= quantity` — mua càng
 *     nhiều, ăn bậc càng cao. Hai tier TRÙNG `minQty` (bất thường về dữ liệu): giá THẤP thắng
 *     ⇒ kết quả KHÔNG phụ thuộc thứ tự mảng. `@@unique(productId, minQty)` chặn trùng ở đường
 *     DB, nhưng hàm này thuần và Story 4.1 có thể truyền `tiers` từ nguồn gộp khác — nên tie-break
 *     phải xác định NGAY TẠI ĐÂY, không dựa vào constraint ở tầng khác.
 */
export function resolveUnitPrice(input: ResolveUnitPriceInput): number {
  if (!input.tieredPricingEnabled) return input.basePrice;

  let best: PriceTier | null = null;
  for (const tier of input.tiers) {
    // `<=`: mua ĐÚNG BẰNG ngưỡng thì đã ăn bậc đó ("mua TỪ 10 trở lên").
    if (tier.minQty > input.quantity) continue;
    // Chọn max `minQty` — KHÔNG `tiers[tiers.length - 1]` (mảng có thể chưa sắp xếp). Trùng
    // `minQty` ⇒ giá THẤP thắng: làm phép chọn ĐỘC LẬP với thứ tự mảng.
    if (
      best === null ||
      tier.minQty > best.minQty ||
      (tier.minQty === best.minQty && tier.price < best.price)
    ) {
      best = tier;
    }
  }

  return best?.price ?? input.basePrice;
}
