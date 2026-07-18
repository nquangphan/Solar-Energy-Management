import * as OrderStatus from '../src/orders/domain/order-status';
import { ORDER_STATUS_KEYS } from '../src/orders/domain/order-status';

/**
 * Chốt chặn RUNTIME cho `ORDER_STATUS_KEYS`.
 *
 * Vì sao không phải compile-time: cả 10 hằng đều được annotate `: OrderStatusKey`, nên kiểu
 * của chúng đã nới rộng thành cả union. `as const satisfies readonly OrderStatusKey[]` vì thế
 * cho ra phần tử kiểu `OrderStatusKey` chứ không phải literal, và mọi mẹo kiểu
 * `Record<OrderStatusKey, true>` dựng từ mảng này đều xanh giả — nó luôn "thấy" đủ union bất
 * kể mảng thiếu phần tử nào.
 *
 * Nên đối chiếu HAI CHIỀU với tập export `TRANG_THAI_*` đọc qua namespace import: thêm hằng mà
 * quên mảng ⇒ đỏ; xoá phần tử khỏi mảng mà hằng còn ⇒ đỏ.
 */
describe('ORDER_STATUS_KEYS — bộ khoá trạng thái dạng mảng runtime', () => {
  const hangTrangThai = Object.entries(OrderStatus)
    .filter(
      ([ten, giaTri]) =>
        ten.startsWith('TRANG_THAI_') && typeof giaTri === 'string',
    )
    .map(([ten, giaTri]) => [ten, giaTri as string] as const);

  it('có đúng 10 phần tử, không trùng lặp', () => {
    expect(ORDER_STATUS_KEYS).toHaveLength(10);
    expect(new Set(ORDER_STATUS_KEYS).size).toBe(10);
  });

  it('khoá thi công là `thicong`, KHÔNG phải `dangthicong` (ngõ cụt đã dính ở 5.1)', () => {
    expect(ORDER_STATUS_KEYS).toContain('thicong');
    expect(ORDER_STATUS_KEYS).not.toContain('dangthicong');
  });

  it('guard thực sự đọc được các hằng (không xanh giả vì danh sách rỗng)', () => {
    expect(hangTrangThai.length).toBe(10);
  });

  it('MỌI hằng TRANG_THAI_* đều có mặt trong ORDER_STATUS_KEYS', () => {
    const thieu = hangTrangThai
      .filter(
        ([, giaTri]) =>
          !(ORDER_STATUS_KEYS as readonly string[]).includes(giaTri),
      )
      .map(([ten]) => ten);
    expect(thieu).toEqual([]);
  });

  it('MỌI phần tử của ORDER_STATUS_KEYS đều là giá trị của một hằng TRANG_THAI_*', () => {
    const giaTriHang = new Set(hangTrangThai.map(([, giaTri]) => giaTri));
    const thua = ORDER_STATUS_KEYS.filter((key) => !giaTriHang.has(key));
    expect(thua).toEqual([]);
  });

  it('số lượng hằng và số phần tử mảng bằng nhau (hai chiều khép kín)', () => {
    expect(ORDER_STATUS_KEYS.length).toBe(hangTrangThai.length);
  });
});
