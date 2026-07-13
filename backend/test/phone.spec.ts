import {
  normalizeVnPhone,
  phoneSearchNeedle,
} from '../src/customers/domain/phone';

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

/**
 * Needle để TÌM KIẾM (khác hẳn `normalizeVnPhone`, vốn để LÀM KHOÁ).
 *
 * Người dùng gõ MỘT PHẦN số ở dạng nội địa (`0903`), nhưng PK lưu là E.164 (`+84903176968`) —
 * không có số `0` sau mã quốc gia. Nên `contains` chuỗi người dùng gõ nguyên xi sẽ TRƯỢT MỌI ca
 * số nội địa: chuỗi `'0903'` không hề nằm trong `'+84903176968'`.
 *
 * Bỏ `0` đứng đầu là điều làm phép tìm kiếm hoạt động. Đây là lý do hàm này tồn tại tách khỏi
 * `normalizeVnPhone`: một cái phải phân giải ĐẦY ĐỦ và từ chối rác, cái kia phải chấp nhận một
 * TIỀN TỐ dở dang và không bao giờ ném.
 */
describe('phoneSearchNeedle', () => {
  const cases: readonly [string, string][] = [
    ['0903176968', '903176968'],
    ['0903', '903'],
    ['+84903176968', '84903176968'],
    ['84903176968', '84903176968'],
    ['0903 176 968', '903176968'],
    ['0903.176.968', '903176968'],
    // Chữ ⇒ needle rỗng. Tầng gọi PHẢI bỏ hẳn nhánh `sdt` khi thấy `''` — một `contains: ''`
    // khớp MỌI dòng, tức biến bộ lọc thành no-op mà không ai thấy.
    ['Hoà', ''],
    ['Nguyễn Văn A', ''],
    ['', ''],
    ['0', ''],
    ['00', ''],
    ['000', ''],
  ];

  for (const [raw, needle] of cases) {
    it(`"${raw}" ⇒ "${needle}"`, () => {
      expect(phoneSearchNeedle(raw)).toBe(needle);
    });
  }

  it('needle của SĐT nội địa NẰM TRONG chuỗi E.164 đã lưu (điều làm tìm kiếm chạy được)', () => {
    // Đây là bất biến thật, không phải chi tiết cài đặt: nếu nó vỡ thì `q='0903'` không bao giờ
    // tìm ra khách có PK `+84903176968`, và cả AC-3 sụp.
    const pk = normalizeVnPhone('0903176968') as string;
    expect(pk).toBe('+84903176968');
    expect(pk.includes(phoneSearchNeedle('0903176968'))).toBe(true);
    expect(pk.includes(phoneSearchNeedle('0903'))).toBe(true);
  });
});
