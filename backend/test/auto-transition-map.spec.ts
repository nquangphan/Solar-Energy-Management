import {
  ALLOWED_TRANSITIONS,
  SU_KIEN,
} from '../src/orders/domain/allowed-transition';
import {
  MOC_TU_DONG,
  suKienChoMoc,
  type MocTuDong,
} from '../src/orders/domain/auto-transition-map';

/**
 * Unit DOMAIN THUẦN — mapping "mốc thanh toán → sự kiện" (AC-2). Không mock gì: hàm không
 * async, không side effect.
 *
 * Hai bất biến đắt nhất ở đây:
 *  1. Mapping TOÀN PHẦN — mọi giá trị `MOC_TU_DONG` đều có ánh xạ (lặp qua `Object.values`,
 *     không liệt kê tay: thêm mốc thứ ba mà quên map thì test phải ĐỎ, không phải im lặng).
 *  2. Sự kiện trả về phải TỒN TẠI trong bảng transition — mapping trỏ vào một sự kiện chết
 *     là một auto-transition không bao giờ chạy được, và không lane nào khác nhìn thấy.
 */
describe('auto-transition-map (domain thuần)', () => {
  it('mỗi mốc ánh xạ đúng sự kiện đã tuyên bố', () => {
    expect(suKienChoMoc(MOC_TU_DONG.coc)).toBe(SU_KIEN.duCoc);
    expect(suKienChoMoc(MOC_TU_DONG.tatToan)).toBe(SU_KIEN.hoanThanh);
  });

  it('mapping TOÀN PHẦN: mọi giá trị MOC_TU_DONG đều có ánh xạ', () => {
    const hopLeSuKien = new Set<string>(Object.values(SU_KIEN));
    for (const moc of Object.values(MOC_TU_DONG)) {
      const suKien = suKienChoMoc(moc as MocTuDong);
      expect(hopLeSuKien.has(suKien)).toBe(true);
    }
  });

  it('sự kiện do mapping trả về đều CÓ DÒNG trong bảng transition (không trỏ vào sự kiện chết)', () => {
    for (const moc of Object.values(MOC_TU_DONG)) {
      const suKien = suKienChoMoc(moc as MocTuDong);
      expect(ALLOWED_TRANSITIONS.some((rule) => rule.event === suKien)).toBe(
        true,
      );
    }
  });

  it('CHỈ hai mốc — mốc thứ ba là cấu hình của Lịch thanh toán (7.1), không phải của hợp đồng này', () => {
    expect(Object.values(MOC_TU_DONG).sort()).toEqual(['coc', 'tat_toan']);
  });
});
