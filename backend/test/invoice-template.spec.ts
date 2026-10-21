import { amountInWords } from '../src/common/money/amount-in-words';
import {
  invoiceFileName,
  invoicePdfKey,
} from '../src/invoices/domain/invoice-file';
import {
  buildInvoiceHtml,
  NOT_CONFIGURED_LABEL,
  type InvoiceTemplateData,
} from '../src/invoices/invoice-template';
import { lineAmount } from '../src/orders/domain/line-amount';
import { computeOrderTotals } from '../src/orders/domain/order-totals';
import { formatMoney } from '../src/orders/quote/quote-template';

/**
 * `buildInvoiceHtml` — pure template tests (no browser). Line amounts and totals come from the
 * REAL pricing functions, not hand-typed numbers (mockup order: 76.862.000 + VAT 8% = 83.010.960).
 */

const RAW_LINES = [
  { name: 'Tấm pin AE 630W', unit: 'Tấm', qty: 14, unitPrice: 2_583_000 },
  {
    name: 'Inverter Solplanet ASW8000-S',
    unit: 'Bộ',
    qty: 1,
    unitPrice: 18_500_000,
  },
  { name: 'Vật tư (gói)', unit: 'Gói', qty: 1, unitPrice: 12_400_000 },
  { name: 'Công lắp đặt', unit: 'Gói', qty: 1, unitPrice: 9_800_000 },
];

const SELLER = {
  legalName: 'CÔNG TY NLMT PHƯƠNG NAM',
  taxCode: '0312998771',
  address: '',
  representative: 'Nguyễn Văn Giám',
  representativeTitle: 'Giám đốc',
  phone: '',
  bankAccount: '',
};

function fixture(
  overrides: Partial<InvoiceTemplateData> & { discount?: number } = {},
): InvoiceTemplateData {
  const { discount, ...rest } = overrides;
  const applyVat = rest.applyVat ?? true;
  const totals = computeOrderTotals({
    lines: RAW_LINES,
    vatRate: 8,
    applyVat,
    discountAmount: discount ?? 0,
  });
  return {
    invoiceNo: 'HD-2026-0731',
    issuedAt: new Date('2026-07-05T18:30:00Z'), // 06/07/2026 in UTC+7
    quoteNo: 'BG-3F2A9B1C',
    versionNo: 2,
    seller: SELLER,
    customer: {
      name: 'VP Công Chứng Lê Đình Thao',
      sdt: '+84901234567',
      taxCode: '0316552018',
      address: '122 Trần Não, TP. Thủ Đức',
    },
    lines: RAW_LINES.map((line) => ({
      ...line,
      amount: lineAmount(line.unitPrice, line.qty),
    })),
    vatRate: 8,
    applyVat,
    ...totals,
    ...rest,
  };
}

/** Text content with tags stripped and whitespace collapsed. */
function text(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

describe('buildInvoiceHtml', () => {
  it('prints the title, number, UTC+7 issue date and the linked order', () => {
    const body = text(buildInvoiceHtml(fixture()));
    expect(body).toContain('HOÁ ĐƠN BÁN HÀNG');
    expect(body).toContain('Số HĐ HD-2026-0731');
    expect(body).toContain(
      'Ngày lập: 06/07/2026 · Gắn đơn: BG-3F2A9B1C (bản 2)',
    );
  });

  it('prints the seller snapshot and "Chưa cấu hình" for empty fields without throwing', () => {
    const body = text(buildInvoiceHtml(fixture()));
    expect(body).toContain('CÔNG TY NLMT PHƯƠNG NAM');
    expect(body).toContain('MST: 0312998771');
    expect(body).toContain(`Địa chỉ: ${NOT_CONFIGURED_LABEL}`);
    expect(body).toContain(`Điện thoại: ${NOT_CONFIGURED_LABEL}`);
    expect(body).toContain(`Tài khoản ngân hàng: ${NOT_CONFIGURED_LABEL}`);

    const blank = text(
      buildInvoiceHtml(
        fixture({
          seller: {
            legalName: '  ',
            taxCode: '',
            address: '',
            representative: '',
            representativeTitle: '',
            phone: '',
            bankAccount: '',
          },
        }),
      ),
    );
    expect(blank.match(/Chưa cấu hình/g)).toHaveLength(5);
  });

  it('prints the representative under GIÁM ĐỐC and both sign titles', () => {
    const body = text(buildInvoiceHtml(fixture()));
    expect(body).toContain('NGƯỜI LẬP PHIẾU');
    expect(body).toMatch(/GIÁM ĐỐC Nguyễn Văn Giám Giám đốc/);
  });

  it('prints the customer with tax code and address', () => {
    const body = text(buildInvoiceHtml(fixture()));
    expect(body).toContain('Khách hàng: VP Công Chứng Lê Đình Thao');
    expect(body).toContain('MST: 0316552018');
    expect(body).toContain('Địa chỉ: 122 Trần Não, TP. Thủ Đức');
    expect(body).toContain('Điện thoại: +84901234567');
  });

  it('prints "Không có MST" and drops the address line when the snapshot has neither', () => {
    const html = buildInvoiceHtml(
      fixture({
        customer: {
          name: 'Khách lẻ',
          sdt: '+84900000000',
          taxCode: null,
          address: null,
        },
      }),
    );
    const block = /<div class="customer-block">([\s\S]*?)<table/.exec(html);
    expect(block).not.toBeNull();
    const customer = text(block![1]);
    expect(customer).toContain('MST: Không có MST');
    expect(customer).not.toContain('Địa chỉ');
  });

  it('prints every line in order with the formatted stored amounts', () => {
    const data = fixture();
    const body = text(buildInvoiceHtml(data));
    let cursor = -1;
    data.lines.forEach((line, index) => {
      const row = `${index + 1} ${line.name} ${line.unit} ${formatMoney(line.qty)} ${formatMoney(line.unitPrice)} ${formatMoney(line.amount)}`;
      const at = body.indexOf(row);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    });
    // The first line is the mockup's 14 × 2.583.000.
    expect(body).toContain('Tấm pin AE 630W Tấm 14 2.583.000 36.162.000');
  });

  it('prints totals with VAT and the amount in words of the stored total', () => {
    const data = fixture();
    const body = text(buildInvoiceHtml(data));
    expect(body).toContain(`Tổng trước VAT ${formatMoney(data.subtotal)}`);
    expect(body).toContain(`VAT (8%) ${formatMoney(data.vatAmount)}`);
    expect(body).toContain(`Tổng thanh toán ${formatMoney(data.total)}`);
    expect(body).toContain('Tổng thanh toán 83.010.960');
    expect(body).toContain(
      `Số tiền viết bằng chữ: ${amountInWords(data.total)}`,
    );
    expect(body).not.toContain('Chiết khấu');
  });

  it('prints a discount row only when the discount is above zero', () => {
    const data = fixture({ discount: 1_862_000 });
    const body = text(buildInvoiceHtml(data));
    expect(body).toContain(`Chiết khấu -${formatMoney(1_862_000)}`);
    expect(body).toContain(`Tổng thanh toán ${formatMoney(data.total)}`);
  });

  it('prints "VAT (không áp)" when VAT does not apply', () => {
    const data = fixture({ applyVat: false });
    const body = text(buildInvoiceHtml(data));
    expect(body).toContain(`VAT (không áp) ${formatMoney(0)}`);
    expect(body).not.toContain('VAT (8%)');
    expect(body).toContain(`Tổng thanh toán ${formatMoney(data.subtotal)}`);
  });

  it('escapes every dynamic string', () => {
    const html = buildInvoiceHtml(
      fixture({
        invoiceNo: 'HD-<b>',
        customer: {
          name: '<script>alert(1)</script>',
          sdt: '+849<s>',
          taxCode: 'A&B',
          address: '<i>x</i>',
        },
        lines: [
          {
            name: '<script>x</script>',
            unit: '<u>',
            qty: 1,
            unitPrice: 1,
            amount: 1,
          },
        ],
        quoteNo: 'BG-<q>',
        seller: {
          ...SELLER,
          legalName: 'Công ty <b>X</b>',
          representative: '<em>rep</em>',
          representativeTitle: '<em>title</em>',
          address: '<em>addr</em>',
          phone: '<em>phone</em>',
          bankAccount: '<em>bank</em>',
        },
      }),
    );
    for (const raw of ['rep', 'title', 'addr', 'phone', 'bank']) {
      expect(html).toContain(`&lt;em&gt;${raw}&lt;/em&gt;`);
    }
    expect(html).not.toContain('<em>');
    expect(html).toContain('+849&lt;s&gt;');
    expect(html).toContain('BG-&lt;q&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
    expect(html).toContain('&lt;u&gt;');
    expect(html).toContain('HD-&lt;b&gt;');
    expect(html).toContain('Công ty &lt;b&gt;X&lt;/b&gt;');
  });

  it('prints each seller field under its own label', () => {
    const body = text(
      buildInvoiceHtml(
        fixture({
          seller: {
            legalName: 'CÔNG TY NLMT PHƯƠNG NAM',
            taxCode: '0312998771',
            address: '12 Nguyễn Văn Bảo, Gò Vấp',
            representative: 'Nguyễn Văn An',
            representativeTitle: 'Phó giám đốc',
            phone: '028 3899 1234',
            bankAccount: '0071001234567 Vietcombank',
          },
        }),
      ),
    );
    expect(body).toContain('MST: 0312998771');
    expect(body).toContain('Địa chỉ: 12 Nguyễn Văn Bảo, Gò Vấp');
    expect(body).toContain('Điện thoại: 028 3899 1234');
    expect(body).toContain('Tài khoản ngân hàng: 0071001234567 Vietcombank');
    expect(body).toContain('GIÁM ĐỐC Nguyễn Văn An Phó giám đốc');
    expect(body).not.toContain(NOT_CONFIGURED_LABEL);
  });

  it('prints no cost price and no warranty', () => {
    const body = text(buildInvoiceHtml(fixture()));
    expect(body).not.toMatch(/giá vốn|costPrice|Bảo hành/i);
  });

  it('is an A4 document with the internal-invoice footer', () => {
    const html = buildInvoiceHtml(fixture());
    expect(html).toContain('@page { size: A4;');
    expect(text(html)).toContain(
      'Hoá đơn nội bộ — không phải hoá đơn điện tử.',
    );
  });
});

describe('invoice file', () => {
  it('names the file in ASCII from the invoice number, without extension', () => {
    const name = invoiceFileName('HD-2026-0731');
    expect(name).toBe('hoa-don-HD-2026-0731');
    expect(/^[\x20-\x7e]+$/.test(name)).toBe(true);
  });

  it('derives a deterministic R2 key per invoice', () => {
    const key = invoicePdfKey('order-1', 'invoice-1');
    expect(key).toBe('invoices/order-1/invoice-1.pdf');
    expect(invoicePdfKey('order-1', 'invoice-1')).toBe(key);
  });
});
