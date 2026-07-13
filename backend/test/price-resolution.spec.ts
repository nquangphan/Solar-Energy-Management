import { resolveUnitPrice } from '../src/catalog/domain/price-resolution';

/**
 * Unit `resolveUnitPrice` — PURE, KHÔNG mock gì (không Nest, không Prisma, không EventBus).
 *
 * Đây là hàm Story 4.1 sẽ gọi để auto-điền đơn giá lúc pick sản phẩm vào báo giá. Nó quyết
 * định TIỀN, nên phủ đúng chỗ dễ sai: biên `<=` (mua ĐÚNG bằng ngưỡng thì đã ăn bậc đó),
 * chốt chặn cờ TẮT, và độc lập thứ tự mảng `tiers`.
 */

const BASE_PRICE = 2_450_000;

/** Bậc thang thực tế: mua ≥10 ăn giá sỉ, mua ≥50 ăn giá sỉ sâu hơn. */
const TIERS = [
  { minQty: 10, price: 2_300_000 },
  { minQty: 50, price: 2_150_000 },
];

const ON = true;
const OFF = false;

describe('resolveUnitPrice (pure)', () => {
  describe('luật 1 — cờ TẮT là chốt chặn ĐẦU TIÊN', () => {
    it('cờ TẮT + CÓ tiers + mua rất nhiều ⇒ vẫn trả basePrice (bỏ qua hoàn toàn tiers)', () => {
      // Bất biến của epic: "cờ TẮT ⇒ mỗi sản phẩm MỘT giá duy nhất". Dòng ProductPrice có thể
      // vẫn nằm trong DB (tắt cờ không xoá dữ liệu) — hàm phải LỜ chúng đi, không phải tin
      // rằng caller đã lọc hộ.
      expect(
        resolveUnitPrice({
          basePrice: BASE_PRICE,
          tiers: TIERS,
          quantity: 100,
          tieredPricingEnabled: OFF,
        }),
      ).toBe(BASE_PRICE);
    });
  });

  describe('luật 2 — không tier nào khớp ⇒ basePrice', () => {
    it('mua DƯỚI bậc thấp nhất ⇒ basePrice', () => {
      expect(
        resolveUnitPrice({
          basePrice: BASE_PRICE,
          tiers: TIERS,
          quantity: 9,
          tieredPricingEnabled: ON,
        }),
      ).toBe(BASE_PRICE);
    });

    it('tiers rỗng ⇒ basePrice (sản phẩm chưa cấu hình mức nào)', () => {
      expect(
        resolveUnitPrice({
          basePrice: BASE_PRICE,
          tiers: [],
          quantity: 100,
          tieredPricingEnabled: ON,
        }),
      ).toBe(BASE_PRICE);
    });
  });

  describe('luật 3 — chọn tier có minQty LỚN NHẤT mà vẫn <= quantity', () => {
    it('quantity ĐÚNG BẰNG minQty ⇒ đã ăn bậc đó (biên là <=, KHÔNG phải <)', () => {
      // Lỗi off-by-one kinh điển: mua đúng 10 mà vẫn tính giá lẻ. `minQty` nghĩa là "mua TỪ
      // 10 trở lên", nên 10 phải khớp.
      expect(
        resolveUnitPrice({
          basePrice: BASE_PRICE,
          tiers: TIERS,
          quantity: 10,
          tieredPricingEnabled: ON,
        }),
      ).toBe(2_300_000);
    });

    it('mua vượt bậc cao nhất ⇒ ăn bậc cao nhất', () => {
      expect(
        resolveUnitPrice({
          basePrice: BASE_PRICE,
          tiers: TIERS,
          quantity: 999,
          tieredPricingEnabled: ON,
        }),
      ).toBe(2_150_000);
    });

    it('mua giữa hai bậc ⇒ ăn bậc thấp hơn (11 chưa tới ngưỡng 50)', () => {
      expect(
        resolveUnitPrice({
          basePrice: BASE_PRICE,
          tiers: TIERS,
          quantity: 11,
          tieredPricingEnabled: ON,
        }),
      ).toBe(2_300_000);
    });

    it('tiers ĐẢO LỘN thứ tự ⇒ vẫn chọn đúng bậc cao nhất khớp (không phụ thuộc thứ tự)', () => {
      // Hàm KHÔNG được giả định mảng đã sắp xếp. `tiers[tiers.length - 1]` sẽ trả 2_300_000 ở
      // đây — sai. Prisma có `orderBy`, nhưng Story 4.1 có thể gọi hàm này với mảng từ nguồn
      // khác; hàm phải tự bảo vệ mình.
      const shuffled = [
        { minQty: 50, price: 2_150_000 },
        { minQty: 10, price: 2_300_000 },
      ];

      expect(
        resolveUnitPrice({
          basePrice: BASE_PRICE,
          tiers: shuffled,
          quantity: 60,
          tieredPricingEnabled: ON,
        }),
      ).toBe(2_150_000);
    });
  });

  it('trả nguyên integer đồng — không làm tròn, không nhân chia (AD-10)', () => {
    const result = resolveUnitPrice({
      basePrice: BASE_PRICE,
      tiers: [{ minQty: 2, price: 1_999_999 }],
      quantity: 3,
      tieredPricingEnabled: ON,
    });

    expect(result).toBe(1_999_999);
    expect(Number.isInteger(result)).toBe(true);
  });
});
