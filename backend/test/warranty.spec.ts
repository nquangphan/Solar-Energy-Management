import {
  NGUONG_SAP_HET_NGAY,
  soNgayConLai,
  soThangConLai,
  tinhHanBaoHanh,
  trangThaiBaoHanh,
} from '../src/orders/domain/warranty';

const ngay = (iso: string): Date => new Date(iso);

describe('tinhHanBaoHanh', () => {
  it('cộng số tháng và trả mốc NGÀY ở 00:00:00Z', () => {
    expect(
      tinhHanBaoHanh(ngay('2026-01-15T10:30:00.000Z'), 12).toISOString(),
    ).toBe('2027-01-15T00:00:00.000Z');
  });

  it('số tháng không chia hết 12 vẫn cộng đúng', () => {
    expect(
      tinhHanBaoHanh(ngay('2026-01-15T00:00:00.000Z'), 18).toISOString(),
    ).toBe('2027-07-15T00:00:00.000Z');
  });

  it('kẹp về ngày cuối tháng đích khi tháng đích ngắn hơn', () => {
    // JS thuần cho 03/03; bảo hành không được dài thêm chỉ vì lịch.
    expect(
      tinhHanBaoHanh(ngay('2026-01-31T00:00:00.000Z'), 1).toISOString(),
    ).toBe('2026-02-28T00:00:00.000Z');
  });

  it('kẹp đúng vào năm nhuận', () => {
    expect(
      tinhHanBaoHanh(ngay('2024-01-31T00:00:00.000Z'), 1).toISOString(),
    ).toBe('2024-02-29T00:00:00.000Z');
  });

  it('kẹp khi tháng đích có 30 ngày', () => {
    expect(
      tinhHanBaoHanh(ngay('2026-03-31T00:00:00.000Z'), 1).toISOString(),
    ).toBe('2026-04-30T00:00:00.000Z');
  });

  it('không mutate tham số đầu vào', () => {
    const start = ngay('2026-01-31T08:00:00.000Z');
    tinhHanBaoHanh(start, 60);
    expect(start.toISOString()).toBe('2026-01-31T08:00:00.000Z');
  });
});

describe('soNgayConLai', () => {
  it('đếm theo NGÀY, bỏ phần giờ của mốc hiện tại', () => {
    expect(
      soNgayConLai(
        ngay('2026-07-20T00:00:00.000Z'),
        ngay('2026-07-18T23:59:59.000Z'),
      ),
    ).toBe(2);
  });

  it('trả 0 đúng hôm hết hạn', () => {
    expect(
      soNgayConLai(
        ngay('2026-07-18T00:00:00.000Z'),
        ngay('2026-07-18T13:00:00.000Z'),
      ),
    ).toBe(0);
  });

  it('trả số ÂM khi đã quá hạn', () => {
    expect(
      soNgayConLai(
        ngay('2026-07-18T00:00:00.000Z'),
        ngay('2026-07-19T01:00:00.000Z'),
      ),
    ).toBe(-1);
  });
});

describe('trangThaiBaoHanh', () => {
  it('ngưỡng "sắp hết" là 90 ngày', () => {
    expect(NGUONG_SAP_HET_NGAY).toBe(90);
  });

  it.each([
    [91, 'con_han'],
    [NGUONG_SAP_HET_NGAY, 'sap_het'],
    [1, 'sap_het'],
    [0, 'sap_het'],
    [-1, 'het_han'],
    [-400, 'het_han'],
  ])('còn %s ngày ⇒ %s', (ngayConLai, mongDoi) => {
    expect(trangThaiBaoHanh(ngayConLai as number)).toBe(mongDoi);
  });
});

describe('soThangConLai', () => {
  it('làm tròn XUỐNG số tháng TRỌN', () => {
    // Chưa qua ngày 15 của tháng đích ⇒ tháng đó chưa trọn.
    expect(
      soThangConLai(
        ngay('2026-02-14T00:00:00.000Z'),
        ngay('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe(0);
    expect(
      soThangConLai(
        ngay('2026-02-15T00:00:00.000Z'),
        ngay('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe(1);
    expect(
      soThangConLai(
        ngay('2027-01-14T00:00:00.000Z'),
        ngay('2026-01-15T00:00:00.000Z'),
      ),
    ).toBe(11);
  });

  /**
   * Đếm theo LỊCH, không chia số ngày cho độ dài tháng trung bình: một bảo hành 5 năm tra
   * NGAY hôm chốt phải đọc ra "5 năm". Chia ngày cho 30.436875 trả 59 ở đúng ca này, và vì
   * `formatWarrantyMonths` chỉ in "năm" khi chia hết 12, chip sẽ đọc "Còn 59 tháng" trọn đời.
   */
  it.each([
    ['2031-01-15T00:00:00.000Z', 60],
    ['2028-01-15T00:00:00.000Z', 24],
    ['2038-01-15T00:00:00.000Z', 144],
  ])(
    'mốc tròn năm %s ⇒ %i tháng chẵn, không hụt một tháng',
    (endAt, mongDoi) => {
      expect(
        soThangConLai(ngay(endAt as string), ngay('2026-01-15T00:00:00.000Z')),
      ).toBe(mongDoi);
    },
  );

  it('không trả số âm — nhánh hết hạn không dựng câu thời lượng', () => {
    expect(
      soThangConLai(
        ngay('2025-08-01T00:00:00.000Z'),
        ngay('2026-07-18T00:00:00.000Z'),
      ),
    ).toBe(0);
  });

  it('còn vài ngày ⇒ 0 tháng trọn (màn phải đổi sang câu theo NGÀY)', () => {
    expect(
      soThangConLai(
        ngay('2029-01-15T00:00:00.000Z'),
        ngay('2028-12-20T00:00:00.000Z'),
      ),
    ).toBe(0);
  });
});
