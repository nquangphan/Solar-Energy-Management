import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONSTRUCTION_CLAUSES } from '../src/contracts/clauses/construction-clauses';
import { SALE_CLAUSES } from '../src/contracts/clauses/sale-clauses';
import {
  buildContractHtml,
  FILL_IN_LINE,
  type ContractTemplateData,
} from '../src/contracts/contract-template';
import { amountInWords } from '../src/contracts/domain/amount-in-words';
import {
  CONTRACT_TYPE,
  NOT_CONFIGURED_LABEL,
  type ContractType,
} from '../src/contracts/domain/contract-type';
import { computeOrderTotals } from '../src/orders/domain/order-totals';
import { escapeHtml } from '../src/orders/quote/quote-template';

/**
 * `buildContractHtml` — pure template tests (no browser). Totals come from the REAL pricing
 * function, not hand-typed numbers: 76.862.000 + VAT 8% = 83.010.960 (the mockup total).
 */

const EMPTY_COMPANY = {
  legalName: '',
  taxCode: '',
  address: '',
  representative: '',
  representativeTitle: '',
  phone: '',
  bankAccount: '',
};

function fixture(
  type: ContractType,
  overrides: Partial<ContractTemplateData> = {},
): ContractTemplateData {
  const lines = [
    {
      name: 'Hệ 10kWp trọn gói',
      unit: 'Bộ',
      qty: 1,
      unitPrice: 76_862_000,
      amount: 76_862_000,
      warrantyMonths: 120,
    },
  ];
  return {
    type,
    contractNo:
      type === CONTRACT_TYPE.construction ? 'HĐTC-7/2026' : 'HĐMB-7/2026',
    issuedAt: new Date('2026-10-21T18:30:00Z'), // 22/10/2026 in UTC+7
    quoteNo: 'BG-3F2A9B1C',
    kWp: 10,
    customer: {
      name: 'Nguyễn Văn Khách',
      sdt: '+84901234567',
      address: '12 Lê Lợi, Q1',
      cccd: '079000000001',
      taxCode: '0300000001',
      bankAccount: '0011 tại VCB',
    },
    company: EMPTY_COMPANY,
    lines,
    totals: computeOrderTotals({ lines, vatRate: 8, applyVat: true }),
    vatRate: 8,
    applyVat: true,
    installments: [
      { seq: 1, percent: 20, amount: 16_602_192, conditionNote: 'Ký hợp đồng' },
      { seq: 2, percent: 70, amount: 58_107_672, conditionNote: 'Thi công' },
      { seq: 3, percent: 10, amount: 8_301_096, conditionNote: '' },
    ],
    ...overrides,
  };
}

/** The document with every filled-in region cut out. */
function staticPart(html: string): string {
  return html.replace(/<!--d-->[\s\S]*?<!--\/d-->/g, '');
}

/** Plain text of the document (tags dropped, entities of the escaped text decoded). */
function text(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

const ALL_TYPES = [CONTRACT_TYPE.construction, CONTRACT_TYPE.sale] as const;

/** Every string of a clause object, recursively. */
function clauseStrings(clauses: unknown): string[] {
  const all: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') all.push(v);
    else if (v !== null && typeof v === 'object')
      Object.values(v).forEach(walk);
  };
  walk(clauses);
  return all;
}

/**
 * Whitespace-collapsed, NFC text (the .docx uses combining marks in places; PDF lines wrap).
 * Bullet glyphs of the source are layout, not wording.
 */
function normalised(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\n\s*o /g, ' ')
    .replace(/[\s\u00a0\u2022]+/g, ' ')
    .trim();
}

describe('clause files are verbatim copies of the company templates', () => {
  // Plain-text extractions of the two source documents, committed as fixtures:
  // `textutil -convert txt "docs/1. Khảo sát lắp đặt/HĐ THI CÔNG CT .docx"` and
  // `pdftotext -layout "docs/2. Thương mại/HDMB CT QTS l2.pdf"` (2026-10-22).
  const source = (file: string) =>
    normalised(
      readFileSync(
        resolve(__dirname, 'fixtures/contract-templates', file),
        'utf8',
      ),
    );

  it.each([
    ['construction', CONSTRUCTION_CLAUSES, 'hd-thi-cong.txt'],
    ['sale', SALE_CLAUSES, 'hd-mua-ban.txt'],
  ] as const)(
    '%s: every clause string appears word for word in the source',
    (_type, clauses, file) => {
      const text = source(file);
      const strings = clauseStrings(clauses);
      expect(strings.length).toBeGreaterThan(60);
      expect(strings.filter((s) => !text.includes(normalised(s)))).toEqual([]);
    },
  );
});

describe('buildContractHtml', () => {
  describe('AC-1 — the title follows the type', () => {
    it('construction ⇒ HỢP ĐỒNG THI CÔNG only', () => {
      const html = buildContractHtml(fixture(CONTRACT_TYPE.construction));
      expect(html).toContain('HỢP ĐỒNG THI CÔNG');
      expect(html).not.toContain('HỢP ĐỒNG MUA BÁN');
    });

    it('sale ⇒ HỢP ĐỒNG MUA BÁN only', () => {
      const html = buildContractHtml(fixture(CONTRACT_TYPE.sale));
      expect(html).toContain('HỢP ĐỒNG MUA BÁN');
      expect(html).not.toContain('HỢP ĐỒNG THI CÔNG');
    });
  });

  describe('AC-2 — static clauses, verbatim', () => {
    it.each([
      [
        CONTRACT_TYPE.construction,
        [
          'ĐIỀU 1: NỘI DUNG HỢP ĐỒNG',
          'ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG',
          'ĐIỀU 3: THANH TOÁN.',
          'ĐIỀU 4: BÀN GIAO NGHIỆM THU, BẢO HÀNH.',
          'ĐIỀU 5: TRÁCH NHIỆM CỦA CÁC BÊN.',
          'ĐIỀU 6: CHẤM DỨT HỢP ĐỒNG TRƯỚC THỜI HẠN.',
          'ĐIỀU 7: BẤT KHẢ KHÁNG.',
          'ĐIỀU 8: ĐIỀU KHOẢN CHUNG.',
        ],
      ],
      [
        CONTRACT_TYPE.sale,
        [
          'ĐIỀU 1: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC VÀ ĐIỀU KIỆN THANH TOÁN',
          'ĐIỀU 2: THỜI GIAN VÀ ĐỊA ĐIỂM GIAO HÀNG.',
          'ĐIỀU 3: TRÁCH NHIỆM CỦA CÁC BÊN.',
          'ĐIỀU 4: BẢO HÀNH SẢN PHẨM',
          'ĐIỀU 5: ĐIỀU KHOẢN PHẠT VI PHẠM HỢP ĐỒNG',
          'ĐIỀU 6: SỰ KIỆN BẤT KHẢ KHÁNG',
          'ĐIỀU 7: GIẢI QUYẾT TRANH CHẤP',
          'Điều 8: ĐIỀU KHOẢN CHUNG',
        ],
      ],
    ])(
      '%s carries the 8 article headings of its template',
      (type, headings) => {
        const body = text(buildContractHtml(fixture(type)));
        for (const h of headings) expect(body).toContain(h);
      },
    );

    // One characteristic sentence per static article, typed from the source documents.
    it.each([
      [
        CONTRACT_TYPE.construction,
        [
          'Thời gian thi công và bàn giao công trình 10 ngày kể từ khi Bên B nhận được tạm ứng của Bên A.',
          'tuy nhiên việc bổ sung sẽ không làm chậm trễ việc thanh toán theo thời hạn mà hợp đồng đã quy định.',
          'Thời gian bảo hành Công trình là mười hai (12) tháng kể từ ngày ký Biên bản nghiệm thu bàn giao công trình đưa vào sử dụng, chi phí di chuyển >50km',
          'Hàng hóa tập kế xuống công trình: Tấm pin và inverter phải đầy đủ CO, CQ (scan)',
          'Đồng thời bên vi phạm sẽ bị phạt 8% giá trị hợp đồng.',
          'có nhiệm vụ phải thông báo cho bên kia về sự kiện bất khả kháng trong vòng bảy (7) ngày ngay sau khi sự kiện bất khả kháng xảy ra.',
          'mỗi bên giữ một (01) bản chính có giá trị pháp lý như nhau.',
        ],
      ],
      [
        CONTRACT_TYPE.sale,
        [
          'Bên Mua thanh toán cho Bên Bán bằng hình thức chuyển khoản vào tài khoản do Bên Bán chỉ định.',
          'Phương thức giao nhận: Bên Mua tự chịu chi phí và điều động phương tiện vận chuyển đến kho của Bên Bán để nhận hàng.',
          'Chịu trách nhiệm về mọi rủi ro đối với hàng hóa kể từ thời điểm hàng được bốc lên phương tiện vận chuyển của Bên Mua tại kho Bên Bán.',
          'Trong vòng 03 ngày làm việc kể từ khi nhận được thông báo của Bên Mua về lỗi hàng hóa, Bên Bán phải phản hồi và tiến hành kiểm tra, khắc phục.',
          'Bên Mua phải chịu lãi suất chậm thanh toán là 0,05%/ngày trên số tiền chậm thanh toán.',
          'Chậm nhất trong vòng 03 [ba] ngày kể từ lúc xảy ra Sự kiện bất khả kháng',
          'giải quyết tại Tòa án nhân dân có thẩm quyền tại Thành phố Hồ Chí Minh để giải quyết theo quy định của pháp luật Việt Nam.',
          'Hợp đồng này được ký làm 02 (hai) bản có giá trị như nhau, mỗi bên giữ 01 (một) bản',
        ],
      ],
    ])('%s carries its static sentences verbatim', (type, sentences) => {
      const body = text(buildContractHtml(fixture(type)));
      for (const s of sentences) expect(body).toContain(s);
    });

    it.each(ALL_TYPES)(
      '%s: every clause string of its clause file is in the document',
      (type) => {
        const clauses =
          type === CONTRACT_TYPE.construction
            ? CONSTRUCTION_CLAUSES
            : SALE_CLAUSES;
        const html = buildContractHtml(fixture(type));
        const all = clauseStrings(clauses);
        expect(all.length).toBeGreaterThan(30);
        for (const s of all) expect(html).toContain(escapeHtml(s));
      },
    );

    it.each(ALL_TYPES)(
      '%s: the static part is byte-identical for two different orders',
      (type) => {
        const a = buildContractHtml(fixture(type));
        const otherLines = [
          {
            name: 'Tấm pin 580W',
            unit: 'tấm',
            qty: 20,
            unitPrice: 2_500_000,
            amount: 50_000_000,
            warrantyMonths: null,
          },
          {
            name: 'Inverter 10kW',
            unit: 'bộ',
            qty: 1,
            unitPrice: 30_000_000,
            amount: 30_000_000,
            warrantyMonths: 60,
          },
        ];
        const b = buildContractHtml(
          fixture(type, {
            contractNo: 'HĐXX-999/2027',
            issuedAt: new Date('2027-03-01T03:00:00Z'),
            quoteNo: 'BG-AAAAAAAA',
            kWp: null,
            customer: {
              name: 'Trần Thị B',
              sdt: '+84987654321',
              address: null,
              cccd: null,
              taxCode: null,
              bankAccount: null,
            },
            company: { ...EMPTY_COMPANY, legalName: 'CÔNG TY X' },
            lines: otherLines,
            totals: computeOrderTotals({
              lines: otherLines,
              vatRate: 10,
              applyVat: true,
              discountAmount: 1_000_000,
            }),
            vatRate: 10,
            installments: [
              { seq: 1, percent: null, amount: 85_900_000, conditionNote: 'x' },
            ],
          }),
        );
        expect(a).not.toBe(b);
        expect(staticPart(a)).toBe(staticPart(b));
        expect(staticPart(a).length).toBeGreaterThan(5000);
      },
    );

    it.each(ALL_TYPES)(
      '%s: no sample data of the original templates leaks in',
      (type) => {
        const html = buildContractHtml(fixture(type));
        for (const leaked of [
          'DƯƠNG VĂN ĐỨC',
          'THORNOVA 570W',
          'QUỐC THỊNH',
          'BG00342',
          '145.000.000',
          '50,275,000',
          'NGUYỄN VĂN TRÀM',
          '3702893374',
        ]) {
          expect(html).not.toContain(leaked);
        }
      },
    );
  });

  describe('AC-3 — dynamic data', () => {
    it.each(ALL_TYPES)(
      '%s: customer, lines, totals in words, installments, quote no, date',
      (type) => {
        const data = fixture(type);
        const body = text(buildContractHtml(data));
        expect(body).toContain('Nguyễn Văn Khách');
        expect(body).toContain('12 Lê Lợi, Q1');
        expect(body).toContain('+84901234567');
        expect(body).toContain('0300000001');
        expect(body).toContain('Hệ 10kWp trọn gói');
        expect(body).toContain('76.862.000');
        expect(body).toContain('6.148.960');
        expect(body).toContain('83.010.960');
        expect(body).toContain('VAT (8%)');
        expect(body).toContain(`(Bằng chữ: ${amountInWords(83_010_960)})`);
        expect(body).toContain(
          '+ Đợt 1: 20% giá trị hợp đồng với số tiền là: 16.602.192 đồng (Mười sáu triệu sáu trăm lẻ hai ngàn một trăm chín mươi hai đồng) — Ký hợp đồng.',
        );
        expect(body).toContain('+ Đợt 2: 70% giá trị hợp đồng');
        // Empty condition note ⇒ no trailing "— …".
        expect(body).toContain(
          `+ Đợt 3: 10% giá trị hợp đồng với số tiền là: 8.301.096 đồng (${amountInWords(8_301_096)}).`,
        );
        expect(body).toContain('(Chi tiết báo giá số: BG-3F2A9B1C kèm theo)');
        expect(body).toContain('Hôm nay, ngày 22 tháng 10 năm 2026');
        expect(body).toContain('HĐ');
        // Discount row only when > 0.
        expect(body).not.toContain('Chiết khấu');
      },
    );

    it('construction: CCCD, capacity, warranty bullet', () => {
      const body = text(buildContractHtml(fixture(CONTRACT_TYPE.construction)));
      expect(body).toContain('079000000001');
      expect(body).toContain('12 Lê Lợi, Q1, công suất 10 kWp.');
      expect(body).toContain('+ Hệ 10kWp trọn gói, Bảo hành 10 năm.');
    });

    it('construction: kWp null ⇒ no capacity phrase, never "null kWp"', () => {
      const body = text(
        buildContractHtml(fixture(CONTRACT_TYPE.construction, { kWp: null })),
      );
      expect(body).not.toContain('kWp.');
      expect(body).not.toContain('null');
    });

    it('sale: customer bank account, total sentence with VAT, warranty bullet', () => {
      const body = text(buildContractHtml(fixture(CONTRACT_TYPE.sale)));
      expect(body).toContain('0011 tại VCB');
      expect(body).toContain(
        `Tổng giá trị hợp đồng bao gồm thuế GTGT: 83.010.960 VNĐ (Bằng chữ: ${amountInWords(83_010_960)})`,
      );
      expect(body).toContain('- Hệ 10kWp trọn gói, bảo hành 10 năm.');
    });

    it('sale without VAT ⇒ "Tổng giá trị hợp đồng:" without "bao gồm thuế GTGT"', () => {
      const lines = fixture(CONTRACT_TYPE.sale).lines;
      const body = text(
        buildContractHtml(
          fixture(CONTRACT_TYPE.sale, {
            applyVat: false,
            totals: computeOrderTotals({ lines, vatRate: 8, applyVat: false }),
          }),
        ),
      );
      expect(body).toContain('Tổng giá trị hợp đồng: 76.862.000 VNĐ');
      expect(body).not.toContain('bao gồm thuế GTGT');
    });

    it('discount > 0 ⇒ Chiết khấu row', () => {
      const lines = fixture(CONTRACT_TYPE.construction).lines;
      const body = text(
        buildContractHtml(
          fixture(CONTRACT_TYPE.construction, {
            totals: computeOrderTotals({
              lines,
              vatRate: 8,
              applyVat: true,
              discountAmount: 862_000,
            }),
          }),
        ),
      );
      expect(body).toContain('Chiết khấu -862.000');
    });

    it('installment by amount ⇒ "Thanh toán số tiền …"', () => {
      const body = text(
        buildContractHtml(
          fixture(CONTRACT_TYPE.construction, {
            installments: [
              {
                seq: 1,
                percent: null,
                amount: 83_010_960,
                conditionNote: 'Một lần',
              },
            ],
          }),
        ),
      );
      expect(body).toContain(
        `+ Đợt 1: Thanh toán số tiền 83.010.960 đồng (${amountInWords(83_010_960)}) — Một lần.`,
      );
    });

    it.each(ALL_TYPES)(
      '%s: HTML in customer name / line name / note is escaped',
      (type) => {
        const html = buildContractHtml(
          fixture(type, {
            customer: {
              ...fixture(type).customer,
              name: '<b>X</b>',
            },
            lines: [
              {
                ...fixture(type).lines[0],
                name: '<script>alert(1)</script>',
              },
            ],
            installments: [
              {
                seq: 1,
                percent: 100,
                amount: 83_010_960,
                conditionNote: '<i>n</i>',
              },
            ],
          }),
        );
        expect(html).not.toContain('<b>X</b>');
        expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<i>n</i>');
      },
    );

    it('the template data type has no cost-price field', () => {
      const keys = [
        ...Object.keys(fixture(CONTRACT_TYPE.sale)),
        ...Object.keys(fixture(CONTRACT_TYPE.sale).lines[0]),
      ];
      expect(keys.join(',')).not.toMatch(/cost/i);
    });
  });

  describe('AC-4 — parties: company is BÊN B from settings, customer is BÊN A', () => {
    it.each([
      [
        CONTRACT_TYPE.construction,
        'BÊN GIAO THẦU (BÊN A):',
        'BÊN NHẬN THẦU (BÊN B):',
      ],
      [CONTRACT_TYPE.sale, 'BÊN A (BÊN MUA):', 'BÊN B (BÊN BÁN):'],
    ])(
      '%s: nothing configured ⇒ "Chưa cấu hình" in all 7 company cells, customer under BÊN A',
      (type, labelA, labelB) => {
        const body = text(buildContractHtml(fixture(type as ContractType)));
        const partyA = body.slice(body.indexOf(labelA), body.indexOf(labelB));
        const partyB = body.slice(
          body.indexOf(labelB),
          body.indexOf('Hai bên'),
        );
        expect(partyA).toContain('Nguyễn Văn Khách');
        expect(partyA).not.toContain(NOT_CONFIGURED_LABEL);
        expect(partyB.split(NOT_CONFIGURED_LABEL).length - 1).toBe(7);
      },
    );

    it.each(ALL_TYPES)(
      '%s: configured name + tax code print; the other 5 stay "Chưa cấu hình"',
      (type) => {
        const body = text(
          buildContractHtml(
            fixture(type, {
              company: {
                ...EMPTY_COMPANY,
                legalName: 'CÔNG TY TNHH PHƯƠNG NAM TEST',
                taxCode: '9999999999',
              },
            }),
          ),
        );
        const labelB =
          type === CONTRACT_TYPE.construction
            ? 'BÊN NHẬN THẦU (BÊN B):'
            : 'BÊN B (BÊN BÁN):';
        const partyB = body.slice(
          body.indexOf(labelB),
          body.indexOf('Hai bên'),
        );
        expect(partyB).toContain(`${labelB} CÔNG TY TNHH PHƯƠNG NAM TEST`);
        expect(partyB).toContain('9999999999');
        expect(partyB.split(NOT_CONFIGURED_LABEL).length - 1).toBe(5);
      },
    );

    it.each(ALL_TYPES)(
      '%s: missing customer data prints a dotted line, never "Chưa cấu hình"',
      (type) => {
        const body = text(
          buildContractHtml(
            fixture(type, {
              company: {
                legalName: 'A',
                taxCode: 'B',
                address: 'C',
                representative: 'D',
                representativeTitle: 'E',
                phone: 'F',
                bankAccount: 'G',
              },
              customer: {
                name: 'Khách',
                sdt: '+84900000000',
                address: null,
                cccd: null,
                taxCode: null,
                bankAccount: null,
              },
            }),
          ),
        );
        expect(body).toContain(FILL_IN_LINE);
        expect(body).not.toContain(NOT_CONFIGURED_LABEL);
      },
    );

    it('company representative signs for BÊN B', () => {
      const body = text(
        buildContractHtml(
          fixture(CONTRACT_TYPE.construction, {
            company: { ...EMPTY_COMPANY, representative: 'Ông Đại Diện' },
          }),
        ),
      );
      expect(body).toMatch(
        /ĐẠI DIỆN BÊN A Nguyễn Văn Khách ĐẠI DIỆN BÊN B Ông Đại Diện/,
      );
    });
  });
});
