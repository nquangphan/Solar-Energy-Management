import { maPhieu, tinhGiaVonBinhQuan } from '../src/inventory/domain/gia-von';

describe('tinhGiaVonBinhQuan', () => {
  it('bình quân gia quyền giữa hàng cũ và lô nhập mới', () => {
    expect(
      tinhGiaVonBinhQuan({
        onHandTruoc: 10,
        giaVonTruoc: 2_000_000,
        qtyNhap: 40,
        donGiaNhap: 2_110_000,
      }),
    ).toBe(2_088_000);
  });

  it('làm tròn nửa lên ở MỘT điểm cuối cùng (100.5 ⇒ 101)', () => {
    expect(
      tinhGiaVonBinhQuan({
        onHandTruoc: 1,
        giaVonTruoc: 100,
        qtyNhap: 1,
        donGiaNhap: 101,
      }),
    ).toBe(101);
  });

  it('phần lẻ dưới nửa làm tròn xuống (100.25 ⇒ 100)', () => {
    expect(
      tinhGiaVonBinhQuan({
        onHandTruoc: 3,
        giaVonTruoc: 100,
        qtyNhap: 1,
        donGiaNhap: 101,
      }),
    ).toBe(100);
  });

  it('chưa có hàng cũ ⇒ bỏ giá vốn cũ, lấy đúng giá nhập', () => {
    expect(
      tinhGiaVonBinhQuan({
        onHandTruoc: 0,
        giaVonTruoc: 999,
        qtyNhap: 5,
        donGiaNhap: 300,
      }),
    ).toBe(300);
  });

  it('onHand trước âm (không thể có nhờ CHECK) vẫn không ném — lấy giá nhập', () => {
    expect(
      tinhGiaVonBinhQuan({
        onHandTruoc: -3,
        giaVonTruoc: 999,
        qtyNhap: 5,
        donGiaNhap: 300,
      }),
    ).toBe(300);
  });

  it('biên tràn số: số lượng và đơn giá cực đại vẫn ra số nguyên chính xác', () => {
    const ketQua = tinhGiaVonBinhQuan({
      onHandTruoc: 1_000_000,
      giaVonTruoc: 2_147_483_647,
      qtyNhap: 1_000_000,
      donGiaNhap: 2_147_483_646,
    });
    expect(Number.isSafeInteger(ketQua)).toBe(true);
    expect(ketQua).toBe(2_147_483_647);
  });
});

describe('maPhieu', () => {
  it('phiếu nhập: PK-N + seq pad 4 chữ số', () => {
    expect(maPhieu('nhap', 119)).toBe('PK-N-0119');
  });

  it('phiếu xuất: PK-X + seq pad 4 chữ số', () => {
    expect(maPhieu('xuat', 96)).toBe('PK-X-0096');
  });

  it('seq quá 9999 không bị cắt', () => {
    expect(maPhieu('nhap', 12345)).toBe('PK-N-12345');
  });
});
