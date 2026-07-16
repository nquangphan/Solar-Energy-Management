import { CUST_TYPE, CUST_TYPES } from '../src/customers/domain/customer-type';
import { scopePresetFor } from '../src/orders/domain/scope-preset';

/**
 * Preset cờ phạm vi theo Loại khách (Story 4.3, FR-2) — hàm thuần, test exhaustive
 * trên registry CUST_TYPES để thêm loại khách mới mà quên preset là RED ngay.
 */
describe('scopePresetFor', () => {
  it('CA_NHAN → cả 3 cờ bật (Thiết bị + Thi công + Vận chuyển)', () => {
    expect(scopePresetFor(CUST_TYPE.caNhan)).toEqual({
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: true,
    });
  });

  it('THUONG_MAI → chỉ Thiết bị bật (Vận chuyển bật tay sau nếu cần)', () => {
    expect(scopePresetFor(CUST_TYPE.thuongMai)).toEqual({
      scopeThietBi: true,
      scopeThiCong: false,
      scopeVanChuyen: false,
    });
  });

  it('exhaustive: mọi loại khách trong CUST_TYPES đều có preset và Thiết bị luôn bật', () => {
    for (const custType of CUST_TYPES) {
      const preset = scopePresetFor(custType);
      expect(preset.scopeThietBi).toBe(true);
      expect(typeof preset.scopeThiCong).toBe('boolean');
      expect(typeof preset.scopeVanChuyen).toBe('boolean');
    }
  });
});
