import {
  VAT_MODE,
  VAT_MODES,
  vatApplies,
} from '../src/orders/domain/vat-mode';

/**
 * Registry tick áp VAT (Story 4.4, FR-3) — hàm thuần, test exhaustive trên VAT_MODES
 * (khuôn `scope-preset.spec.ts`): thêm mode mới mà quên hành vi `vatApplies` là RED ngay.
 */
describe('vat-mode registry', () => {
  it('bộ khoá chính tắc: co_vat + khong_vat, VAT_MODES đủ cả hai', () => {
    expect(VAT_MODE.coVat).toBe('co_vat');
    expect(VAT_MODE.khongVat).toBe('khong_vat');
    expect(VAT_MODES).toEqual(['co_vat', 'khong_vat']);
  });

  describe('vatApplies', () => {
    it('null ⇒ true — đơn tạo TRƯỚC 4.4 (vatMode null) tính như CÓ VAT, khớp preview hiện hành', () => {
      expect(vatApplies(null)).toBe(true);
    });

    it("'co_vat' ⇒ true; 'khong_vat' ⇒ false", () => {
      expect(vatApplies(VAT_MODE.coVat)).toBe(true);
      expect(vatApplies(VAT_MODE.khongVat)).toBe(false);
    });

    it('exhaustive: mọi mode trong VAT_MODES trả boolean, và CHỈ khong_vat tắt VAT', () => {
      for (const mode of VAT_MODES) {
        expect(typeof vatApplies(mode)).toBe('boolean');
        expect(vatApplies(mode)).toBe(mode !== VAT_MODE.khongVat);
      }
    });
  });
});
