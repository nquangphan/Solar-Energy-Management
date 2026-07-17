import type { QuoteTemplateData } from '../src/orders/quote/quote-template';
import { buildQuoteHtml } from '../src/orders/quote/quote-template';

/**
 * Template báo giá (Story 4.8, FR-21) — hàm THUẦN, test không cần browser/Nest/Prisma.
 * Labels theo MẪU THẬT (docs/2. Thương mại/Báo giá thương mại.xlsx); template CHỈ FORMAT
 * — mọi con số nhận từ input đã tính sẵn (AD-16).
 */
describe('buildQuoteHtml (unit, thuần)', () => {
  const DATA_CO_BAN: QuoteTemplateData = {
    quoteNo: 'BG-1A2B3C4D',
    exportedAt: new Date('2026-07-17T03:00:00Z'),
    validityNote: '31/07/2026',
    kWp: 5.5,
    scopeThietBi: true,
    scopeThiCong: false,
    scopeVanChuyen: true,
    customer: {
      name: 'Nguyễn Văn A',
      sdt: '+84912345678',
      address: '12 Lê Lợi, Dĩ An',
      taxCode: '0312345678',
    },
    lines: [
      {
        name: 'Tấm pin 580W',
        unit: 'Tấm',
        qty: 10,
        unitPrice: 7686200,
        amount: 76862000,
        warrantyMonths: 60,
      },
      {
        name: 'Inverter hybrid',
        unit: 'Bộ',
        qty: 1,
        unitPrice: 15000000,
        amount: 15000000,
        warrantyMonths: 18,
      },
      {
        name: 'Công lắp đặt',
        unit: 'Gói',
        qty: 1,
        unitPrice: 3000000,
        amount: 3000000,
        warrantyMonths: null,
      },
    ],
    totals: {
      subtotal: 94862000,
      discountAmount: 2000000,
      vatAmount: 7428960,
      total: 100290960,
    },
    vatRate: 8,
    applyVat: true,
  };

  it('labels mẫu thật hiện diện: title, tên công ty, MST, khối chữ ký 2 cột', () => {
    const html = buildQuoteHtml(DATA_CO_BAN);
    expect(html).toContain('BÁO GIÁ KIÊM ĐƠN ĐẶT HÀNG');
    expect(html).toContain(
      'CÔNG TY TNHH GIẢI PHÁP NĂNG LƯỢNG MẶT TRỜI PHƯƠNG NAM',
    );
    expect(html).toContain('Mã số thuế: 3702893374');
    expect(html).toContain('Người lập phiếu');
    expect(html).toContain('(Ký, họ tên)');
    expect(html).toContain('Giám đốc');
    expect(html).toContain('(Ký, họ tên, đóng dấu)');
    expect(html).toContain('Điều khoản thanh toán: thanh toán 100% xuất hàng tại kho');
    expect(html).toContain('TK THANH TOÁN:');
    // Cột bảng đúng mẫu + cột Bảo hành mới (quyết định khách L200).
    for (const cot of [
      'STT',
      'Tên hàng',
      'Đơn vị tính',
      'Số lượng',
      'Đơn giá',
      'Thành tiền',
      'Bảo hành',
      'TỔNG CỘNG',
    ]) {
      expect(html).toContain(cot);
    }
    // Metadata đơn.
    expect(html).toContain('Số: BG-1A2B3C4D');
    expect(html).toContain('Hiệu lực đến: 31/07/2026');
    expect(html).toContain('Công suất: 5.5 kWp');
    // Ngày xuất 2026-07-17T03:00Z = 17/07/2026 giờ VN (UTC+7).
    expect(html).toContain('Ngày: 17/07/2026');
  });

  it('cột Bảo hành: 60 → "5 năm", 18 → "18 tháng", null → rỗng', () => {
    const html = buildQuoteHtml(DATA_CO_BAN);
    expect(html).toContain('5 năm');
    expect(html).toContain('18 tháng');
    // Dòng warrantyMonths null KHÔNG được rò chuỗi 'null' ra HTML.
    expect(html).not.toContain('null');
  });

  it('tick phạm vi đúng theo 3 cờ scope: bật ☑ (&#9745;), tắt ☐ (&#9744;)', () => {
    const html = buildQuoteHtml(DATA_CO_BAN);
    expect(html).toContain('&#9745; Cung cấp thiết bị');
    expect(html).toContain('&#9744; Cung cấp thi công');
    expect(html).toContain('&#9745; Cung cấp vận chuyển');
  });

  it('số format dấu chấm ngàn kiểu 76.862.000', () => {
    const html = buildQuoteHtml(DATA_CO_BAN);
    expect(html).toContain('76.862.000');
    expect(html).toContain('94.862.000');
    expect(html).toContain('7.428.960');
    expect(html).toContain('100.290.960');
    expect(html).toContain('VAT (8%)');
  });

  it('dòng Chiết khấu CHỈ hiện khi > 0', () => {
    const coChietKhau = buildQuoteHtml(DATA_CO_BAN);
    expect(coChietKhau).toContain('Chiết khấu');
    expect(coChietKhau).toContain('-2.000.000');

    const khongChietKhau = buildQuoteHtml({
      ...DATA_CO_BAN,
      totals: {
        subtotal: 94862000,
        discountAmount: 0,
        vatAmount: 7588960,
        total: 102450960,
      },
    });
    expect(khongChietKhau).not.toContain('Chiết khấu');
  });

  it("applyVat false → label 'VAT' trần (không kèm phần trăm), số 0 format sạch", () => {
    const html = buildQuoteHtml({
      ...DATA_CO_BAN,
      applyVat: false,
      totals: {
        subtotal: 94862000,
        discountAmount: 2000000,
        vatAmount: 0,
        total: 92862000,
      },
    });
    expect(html).not.toContain('VAT (');
    // Hàng VAT vẫn hiện với 0 + tổng đúng input (template chỉ FORMAT, không tự tính).
    expect(html).toContain('VAT');
    expect(html).toContain('92.862.000');
  });

  it('escape HTML dữ liệu động — tên khách chứa <b> không thành tag', () => {
    const html = buildQuoteHtml({
      ...DATA_CO_BAN,
      customer: {
        ...DATA_CO_BAN.customer,
        name: '<b>Khách "đặc biệt"</b>',
      },
      lines: [
        {
          ...DATA_CO_BAN.lines[0],
          name: 'Pin <script>alert(1)</script>',
        },
      ],
    });
    expect(html).not.toContain('<b>Khách');
    expect(html).toContain('&lt;b&gt;Khách &quot;đặc biệt&quot;&lt;/b&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('Pin &lt;script&gt;');
  });

  it('🔴 output KHÔNG chứa chuỗi costPrice — giá vốn không có cửa nào lên báo giá', () => {
    const html = buildQuoteHtml(DATA_CO_BAN);
    expect(html).not.toContain('costPrice');
  });

  it('validityNote/kWp/địa chỉ/MST khách null → ô rỗng, không rò "null"', () => {
    const html = buildQuoteHtml({
      ...DATA_CO_BAN,
      validityNote: null,
      kWp: null,
      customer: {
        name: 'Khách lẻ',
        sdt: '+84900000001',
        address: null,
        taxCode: null,
      },
    });
    expect(html).not.toContain('null');
    expect(html).toContain('Hiệu lực đến: </span>');
  });
});
