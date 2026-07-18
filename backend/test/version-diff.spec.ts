import {
  diffDong,
  type DongToiThieu,
} from '../src/orders/domain/version-diff';

/**
 * Unit DOMAIN THUẦN — `diffDong` không async, không Prisma.
 *
 * Ca quan trọng nhất là ca CHỐNG FALSE-POSITIVE: đổi giá KHÔNG được tính là "đổi". Trước Chốt,
 * đơn giá là live-resolve từ danh mục, nên một diff so giá sẽ kêu lên với mọi bản mỗi lần
 * danh mục lên giá — và một lịch sử kêu sai là một lịch sử không ai đọc nữa.
 */
describe('version-diff (domain thuần)', () => {
  function dong(p: Partial<DongToiThieu> & { name: string }): DongToiThieu {
    return {
      productId: null,
      unit: 'cái',
      qty: 1,
      displayOrder: 0,
      ...p,
    };
  }

  it('bản đầu tiên ⇒ cả ba mảng rỗng — KHÔNG phải "thêm tất cả dòng"', () => {
    // Bản gốc không so với cái gì cả. Caller (`listVersions`) truyền RỖNG cả hai phía cho
    // bản `versionNo` nhỏ nhất; nếu truyền `([], dòngCủaBảnGốc)` thì lịch sử sẽ mở đầu bằng
    // "thêm 12 dòng" — một sự kiện chưa từng xảy ra với người dùng.
    expect(diffDong([], [])).toEqual({ them: [], xoa: [], doiSoLuong: [] });
  });

  it('thêm dòng ⇒ tên dòng nằm trong `them`', () => {
    const truoc = [dong({ name: 'Tấm pin', productId: 'p1' })];
    const sau = [
      dong({ name: 'Tấm pin', productId: 'p1' }),
      dong({ name: 'Inverter', productId: 'p2', displayOrder: 1 }),
    ];
    expect(diffDong(truoc, sau)).toEqual({
      them: ['Inverter'],
      xoa: [],
      doiSoLuong: [],
    });
  });

  it('xoá dòng ⇒ tên dòng nằm trong `xoa`', () => {
    const truoc = [
      dong({ name: 'Tấm pin', productId: 'p1' }),
      dong({ name: 'Inverter', productId: 'p2', displayOrder: 1 }),
    ];
    const sau = [dong({ name: 'Tấm pin', productId: 'p1' })];
    expect(diffDong(truoc, sau)).toEqual({
      them: [],
      xoa: ['Inverter'],
      doiSoLuong: [],
    });
  });

  it('đổi số lượng ⇒ `doiSoLuong` ghi từ bao nhiêu sang bao nhiêu', () => {
    const truoc = [dong({ name: 'Tấm pin', productId: 'p1', qty: 10 })];
    const sau = [dong({ name: 'Tấm pin', productId: 'p1', qty: 14 })];
    expect(diffDong(truoc, sau)).toEqual({
      them: [],
      xoa: [],
      doiSoLuong: [{ ten: 'Tấm pin', tu: 10, den: 14 }],
    });
  });

  it('CHỐNG FALSE-POSITIVE: đổi giá/đơn giá KHÔNG phải một thay đổi — diff rỗng', () => {
    // `DongToiThieu` cố tình KHÔNG có trường tiền: một diff không nhìn thấy giá thì không thể
    // báo động vì giá. Ca này khoá lại điều đó ở mức hành vi.
    const truoc = [dong({ name: 'Tấm pin', productId: 'p1', qty: 10 })];
    const sau = [dong({ name: 'Tấm pin', productId: 'p1', qty: 10 })];
    expect(diffDong(truoc, sau)).toEqual({
      them: [],
      xoa: [],
      doiSoLuong: [],
    });
  });

  it('dòng tự do trùng (tên, đơn vị) ⇒ ghép cặp theo displayOrder tăng dần, tất định', () => {
    const truoc = [
      dong({ name: 'Công lắp', qty: 2, displayOrder: 1 }),
      dong({ name: 'Công lắp', qty: 5, displayOrder: 0 }),
    ];
    const sau = [
      dong({ name: 'Công lắp', qty: 5, displayOrder: 0 }),
      dong({ name: 'Công lắp', qty: 3, displayOrder: 1 }),
    ];
    // Cặp displayOrder 0: 5→5 (không đổi); cặp displayOrder 1: 2→3.
    expect(diffDong(truoc, sau)).toEqual({
      them: [],
      xoa: [],
      doiSoLuong: [{ ten: 'Công lắp', tu: 2, den: 3 }],
    });
  });

  it('dư ra khi trùng khoá ⇒ tính là thêm (bản sau nhiều hơn) hoặc xoá (bản sau ít hơn)', () => {
    const mot = [dong({ name: 'Công lắp', qty: 1 })];
    const hai = [
      dong({ name: 'Công lắp', qty: 1 }),
      dong({ name: 'Công lắp', qty: 1, displayOrder: 1 }),
    ];
    expect(diffDong(mot, hai).them).toEqual(['Công lắp']);
    expect(diffDong(hai, mot).xoa).toEqual(['Công lắp']);
  });

  it('dòng catalog ghép theo productId, KHÔNG theo tên — đổi tên hiển thị không phải thêm+xoá', () => {
    const truoc = [dong({ name: 'Tấm pin 550W', productId: 'p1', qty: 4 })];
    const sau = [dong({ name: 'Tấm pin 550Wp', productId: 'p1', qty: 4 })];
    expect(diffDong(truoc, sau)).toEqual({
      them: [],
      xoa: [],
      doiSoLuong: [],
    });
  });
});
