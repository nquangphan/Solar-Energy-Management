import { CUST_TYPE, type CustType } from '../../customers/domain/customer-type';

/**
 * Preset cờ phạm vi theo Loại khách (FR-2) — DOMAIN THUẦN (không Nest/Prisma), cùng khuôn
 * `order-totals.ts`. `OrdersService.create` spread kết quả vào payload tạo Order để cờ được
 * ghi TƯỜNG MINH — DB default `true/false/false` trùng preset Thương mại chỉ là ngẫu nhiên,
 * KHÔNG mang ngữ nghĩa preset.
 *
 * `scopeThietBi` type literal `true` (không phải boolean): mọi đơn đều có vật tư
 * (EXPERIENCE.md §Máy trạng thái) — bất biến này còn được DTO update loại field ra ngoài.
 */
export interface ScopePreset {
  readonly scopeThietBi: true;
  readonly scopeThiCong: boolean;
  readonly scopeVanChuyen: boolean;
}

const PRESET_BY_CUST_TYPE: Readonly<Record<CustType, ScopePreset>> = {
  // Cá nhân: trọn gói thiết bị + thi công + vận chuyển.
  [CUST_TYPE.caNhan]: {
    scopeThietBi: true,
    scopeThiCong: true,
    scopeVanChuyen: true,
  },
  // Thương mại: chỉ bán thiết bị; Vận chuyển tuỳ chọn — bật tay sau, Thi công tắt (FR-2).
  [CUST_TYPE.thuongMai]: {
    scopeThietBi: true,
    scopeThiCong: false,
    scopeVanChuyen: false,
  },
};

/** Bộ cờ phạm vi khởi tạo cho Đơn của một Loại khách. */
export function scopePresetFor(custType: CustType): ScopePreset {
  return PRESET_BY_CUST_TYPE[custType];
}
