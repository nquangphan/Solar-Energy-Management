import { normalizeVnPhone } from '../src/customers/domain/phone';

/**
 * Chuẩn hoá SĐT là chỗ ĐẮT NHẤT để sai của Epic 3: SĐT là KHOÁ CHÍNH của `Customer`, nên
 * hai dạng thô của cùng một số mà ra hai chuỗi khác nhau = hai bản ghi cho cùng một người,
 * đúng cái AD-9 tồn tại để chặn. Vì vậy bảng ca dưới đây canh HAI chiều:
 *
 *  - HỘI TỤ: mọi dạng thô người dùng gõ thật (có dấu cách, dấu chấm, có/không mã quốc gia)
 *    phải phân giải về ĐÚNG MỘT chuỗi E.164.
 *  - TỪ CHỐI: rác không được lọt vào làm PK (`null` ⇒ tầng trên trả 400).
 *
 * Số CỐ ĐỊNH VN phải HỢP LỆ — khách Thương mại hay dùng số công ty. Đây chính là ca mà một
 * regex "10 chữ số bắt đầu bằng 0" sẽ từ chối oan, và là lý do story chọn `libphonenumber-js`.
 */
describe('normalizeVnPhone', () => {
  describe('hội tụ về một dạng E.164 duy nhất', () => {
    const DI_DONG = '+84912345678';
    const cases: readonly [string, string][] = [
      ['0912345678', DI_DONG],
      ['0912 345 678', DI_DONG],
      ['0912.345.678', DI_DONG],
      ['0912-345-678', DI_DONG],
      ['+84912345678', DI_DONG],
      ['+84 912 345 678', DI_DONG],
      ['84912345678', DI_DONG],
      ['  0912345678  ', DI_DONG],
    ];

    for (const [raw, expected] of cases) {
      it(`"${raw}" ⇒ ${expected}`, () => {
        expect(normalizeVnPhone(raw)).toBe(expected);
      });
    }

    it('số CỐ ĐỊNH VN (khách Thương mại) hợp lệ — KHÔNG bị từ chối oan', () => {
      expect(normalizeVnPhone('02838221234')).toBe('+842838221234');
      expect(normalizeVnPhone('028 3822 1234')).toBe('+842838221234');
    });
  });

  describe('từ chối (⇒ null, tầng trên trả 400)', () => {
    const rac: readonly (string | null | undefined)[] = [
      'abc',
      '',
      '   ',
      '123',
      '09123456789012345678',
      '+16505550123', // số Mỹ — ngoài VN
      '0012345678',
      null,
      undefined,
    ];

    for (const raw of rac) {
      it(`${JSON.stringify(raw)} ⇒ null`, () => {
        expect(normalizeVnPhone(raw as string)).toBeNull();
      });
    }
  });

  it('idempotent — chuẩn hoá lại chuỗi đã chuẩn hoá không đổi (PK ổn định qua nhiều lần ghi)', () => {
    const once = normalizeVnPhone('0912345678');
    expect(normalizeVnPhone(once as string)).toBe(once);
  });
});
