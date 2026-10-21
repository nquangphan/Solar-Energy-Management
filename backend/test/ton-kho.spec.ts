import { tinhTonKho } from '../src/inventory/domain/ton-kho';

describe('tinhTonKho', () => {
  it('còn dư ⇒ khả dụng dương, không cần nhập, tình trạng "du"', () => {
    expect(tinhTonKho({ onHand: 12, reserved: 4 })).toEqual({
      onHand: 12,
      reserved: 4,
      khaDung: 8,
      canNhap: 0,
      tinhTrang: 'du',
    });
  });

  it('đã hứa vừa hết hàng thật ⇒ khả dụng 0, tình trạng "het"', () => {
    expect(tinhTonKho({ onHand: 7, reserved: 7 })).toEqual({
      onHand: 7,
      reserved: 7,
      khaDung: 0,
      canNhap: 0,
      tinhTrang: 'het',
    });
  });

  it('hứa nhiều hơn hàng thật ⇒ khả dụng âm, cần nhập đúng phần thiếu, tình trạng "am"', () => {
    expect(tinhTonKho({ onHand: 5, reserved: 20 })).toEqual({
      onHand: 5,
      reserved: 20,
      khaDung: -15,
      canNhap: 15,
      tinhTrang: 'am',
    });
  });

  it('chưa có hàng và chưa hứa gì ⇒ toàn 0, tình trạng "het"', () => {
    expect(tinhTonKho({ onHand: 0, reserved: 0 })).toEqual({
      onHand: 0,
      reserved: 0,
      khaDung: 0,
      canNhap: 0,
      tinhTrang: 'het',
    });
  });

  it('kho trống nhưng đã hứa ⇒ cần nhập bằng đúng số đã hứa', () => {
    expect(tinhTonKho({ onHand: 0, reserved: 3 })).toMatchObject({
      khaDung: -3,
      canNhap: 3,
      tinhTrang: 'am',
    });
  });

  it('thiếu đúng 1 là biên âm, dư đúng 1 là biên "du"', () => {
    expect(tinhTonKho({ onHand: 4, reserved: 5 })).toMatchObject({
      khaDung: -1,
      canNhap: 1,
      tinhTrang: 'am',
    });
    expect(tinhTonKho({ onHand: 5, reserved: 4 })).toMatchObject({
      khaDung: 1,
      canNhap: 0,
      tinhTrang: 'du',
    });
  });
});
