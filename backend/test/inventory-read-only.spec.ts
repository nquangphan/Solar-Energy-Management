import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rawSqlWritePattern } from './util/raw-sql-write';
import { stripComments } from './util/strip-comments';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard tồn kho — hai bất biến:
 *
 * (a) VĨNH VIỄN: KHÔNG model nào có cột `reserved`. Hàng đã hứa là `SUM(StockMovement.qty)`
 *     (AD-19); một cột cộng-trừ trôi khi retry chốt/xuất. ERD vẽ cột đó trên `StockItem` — guard
 *     này chặn người "làm theo ERD", kể cả khi đặt cột sang `Product`.
 * (b) Trong `src/inventory/**`, lệnh ghi Prisma — kể cả SQL thô (`$queryRaw` chạy được `UPDATE`)
 *     và `$transaction` — CHỈ được nằm ở các file trong `FILE_DUOC_GHI`. Mỗi file đó PHẢI ghi
 *     dưới khoá: chứa `FOR UPDATE` và dạng interactive `$transaction(async` (dạng mảng không đọc
 *     được trạng thái sau khoá). Đường đọc `stock-items.service.ts` mãi đọc thuần — the ONLY,
 *     NARROW exception: an array-form `$transaction([` WITH `RepeatableRead` (the `onHand` and
 *     `reserved` reads share one snapshot); every write and the interactive form stay banned. Thêm một
 *     đường ghi tồn mới ⇒ thêm file vào `FILE_DUOC_GHI`, nó tự chịu cùng luật khoá. Lệnh ghi
 *     trong file đó phải đi qua `tx` của transaction: một `this.prisma.<model>.<ghi>(` nằm NGOÀI
 *     khoá, nên khoá có cũng như không.
 * (c) `src/inventory/**` KHÔNG ghi aggregate đơn (đơn/version/dòng/chiết khấu/ảnh/xuất báo giá).
 *     Ghi đơn phải đi qua `src/orders` — nơi `no-unscoped-order-write` buộc kiểm phạm vi người
 *     gọi trước; guard đó chỉ quét `src/orders`, nên một lệnh ghi đơn ở đây sẽ lọt.
 *
 * (a) đọc schema RAW (không strip — `stripToCode` là bộ quét TS, không hiểu Prisma); (b) quét
 * code đã strip comment/string để docstring nhắc `create(` không làm đỏ oan — NGOẠI TRỪ luật
 * `FOR UPDATE`: câu SQL nằm trong template literal mà `stripToCode` xoá, nên đọc RAW.
 */
describe('source-guard: tồn kho chỉ ghi dưới khoá, không cột reserved', () => {
  const SCHEMA = resolve(__dirname, '../prisma/schema.prisma');
  const INVENTORY = resolve(__dirname, '../src/inventory');

  /** Khối `model <ten> { … }` — `\n\}` đóng khối ở đầu dòng, không dừng ở `}` lồng. */
  function khoiModel(schema: string, ten: string): string {
    return (
      new RegExp(`\\nmodel ${ten} \\{[\\s\\S]*?\\n\\}`).exec(schema)?.[0] ?? ''
    );
  }

  /** Mọi khối `model … { … }` của schema. */
  function moiKhoiModel(schema: string): string[] {
    return schema.match(/\nmodel \w+ \{[\s\S]*?\n\}/g) ?? [];
  }

  /** Dòng khai trường có tên chứa `reserved` (mọi biến thể: `reserved`, `reservedQty`…). */
  const TRUONG_RESERVED = /^\s*\w*reserved\w*\s/im;

  /** Every Prisma write form (`*AndReturn` included); whitespace allowed after the dot. */
  const LENH_GHI =
    /\.\s*(?:create(?:Many(?:AndReturn)?)?|update(?:Many(?:AndReturn)?)?|upsert|delete(?:Many)?)\s*\(|\$executeRaw|\$queryRaw|\$transaction/;

  function fileTs(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return fileTs(p);
      return e.name.endsWith('.ts') ? [p] : [];
    });
  }

  describe('(a) không model nào có trường reserved', () => {
    it('chống guard rỗng: trích được khối StockItem và nó chứa onHand', () => {
      const khoi = khoiModel(readFileSync(SCHEMA, 'utf8'), 'StockItem');
      expect(khoi).toContain('onHand');
    });

    it('bộ dò bắt được một trường reserved giả', () => {
      const gia = '\nmodel StockItem {\n  onHand   Int\n  reserved Int\n}\n';
      expect(TRUONG_RESERVED.test(khoiModel(gia, 'StockItem'))).toBe(true);
    });

    it('chống guard rỗng: trích được mọi model, gồm Product và StockMovement', () => {
      const khoi = moiKhoiModel(readFileSync(SCHEMA, 'utf8'));
      expect(khoi.length).toBeGreaterThan(10);
      for (const ten of ['Product', 'StockItem', 'StockMovement']) {
        expect(khoi.some((k) => k.startsWith(`\nmodel ${ten} {`))).toBe(true);
      }
    });

    it('schema thật: không model nào khai trường reserved', () => {
      const viPham = moiKhoiModel(readFileSync(SCHEMA, 'utf8')).filter((k) =>
        TRUONG_RESERVED.test(k),
      );
      expect(viPham).toEqual([]);
    });
  });

  describe('(b) src/inventory chỉ ghi ở file được phép, dưới khoá FOR UPDATE', () => {
    /** Tên file (basename) được phép ghi tồn. */
    const FILE_DUOC_GHI = ['stock-vouchers.service.ts'];
    const DOC_THUAN = 'stock-items.service.ts';

    const laFileDuocGhi = (f: string): boolean =>
      FILE_DUOC_GHI.some((ten) => f.endsWith(`/${ten}`));

    /**
     * The read path is excused EXACTLY ONE form: `$transaction([` + `RepeatableRead`. Strip the
     * array form and rescan ⇒ any write or `$transaction(async` is still caught by `LENH_GHI`.
     */
    const TX_MANG = /\$transaction\(\s*\[/g;
    function viPhamDuongDoc(code: string): boolean {
      const coTxMang = new RegExp(TX_MANG.source).test(code);
      if (coTxMang && !/\bRepeatableRead\b/.test(code)) return true;
      return LENH_GHI.test(code.replace(TX_MANG, ''));
    }

    /** Câu khoá trong template SQL — đọc trên mã RAW. */
    const KHOA_FOR_UPDATE = /\bFOR\s+UPDATE\b/;
    const TX_INTERACTIVE = /\$transaction\(\s*async\b/;
    /** Ghi thẳng trên client gốc — tức là ngoài transaction đang giữ khoá. */
    const GHI_NGOAI_TX =
      /this\s*\.\s*prisma\s*\.\s*\w+\s*\.\s*(?:create(?:Many(?:AndReturn)?)?|update(?:Many(?:AndReturn)?)?|upsert|delete(?:Many)?)\s*\(|this\s*\.\s*prisma\s*\.\s*\$(?:executeRaw|queryRaw)/;

    it('chống guard rỗng: tập quét gồm cả đường đọc và mọi file được phép ghi', () => {
      const files = fileTs(INVENTORY);
      expect(files.some((f) => f.endsWith(`/${DOC_THUAN}`))).toBe(true);
      for (const ten of FILE_DUOC_GHI) {
        expect(files.some((f) => f.endsWith(`/${ten}`))).toBe(true);
      }
    });

    it('bộ dò bắt được lệnh ghi giả, bỏ qua lệnh ghi nằm trong comment/chuỗi', () => {
      expect(
        LENH_GHI.test(stripToCode('await this.prisma.stockItem.create({});')),
      ).toBe(true);
      expect(
        LENH_GHI.test(
          stripToCode('await this.prisma.$queryRaw`UPDATE stock_items`;'),
        ),
      ).toBe(true);
      expect(
        LENH_GHI.test(
          stripToCode("await this.prisma.$queryRawUnsafe('DELETE');"),
        ),
      ).toBe(true);
      expect(
        LENH_GHI.test(stripToCode("// .create(\nconst s = '.upsert(';")),
      ).toBe(false);
    });

    it('bộ dò khoá: bắt thiếu FOR UPDATE và transaction dạng mảng', () => {
      expect(
        KHOA_FOR_UPDATE.test(
          'tx.$queryRaw`SELECT id FROM products FOR UPDATE`',
        ),
      ).toBe(true);
      expect(
        KHOA_FOR_UPDATE.test('tx.$queryRaw`SELECT id FROM products`'),
      ).toBe(false);
      expect(
        TX_INTERACTIVE.test('this.prisma.$transaction(async (tx) =>'),
      ).toBe(true);
      expect(TX_INTERACTIVE.test('this.prisma.$transaction([a, b])')).toBe(
        false,
      );
    });

    it('bộ dò ghi ngoài tx: bắt this.prisma.<model>.<ghi>, bỏ qua tx.<ghi> và đọc', () => {
      expect(
        GHI_NGOAI_TX.test('await this.prisma.stockItem.updateMany({})'),
      ).toBe(true);
      expect(GHI_NGOAI_TX.test('await this.prisma.$executeRaw`UPDATE`')).toBe(
        true,
      );
      expect(GHI_NGOAI_TX.test('await tx.stockItem.upsert({})')).toBe(false);
      expect(
        GHI_NGOAI_TX.test('await this.prisma.stockVoucher.findMany({})'),
      ).toBe(false);
      expect(
        GHI_NGOAI_TX.test('await this.prisma.$transaction(async (tx) =>'),
      ).toBe(false);
    });

    it('catches the syntax variants: *AndReturn writes, a prettier chain outside the tx', () => {
      for (const code of [
        'await tx.stockItem.updateManyAndReturn({ where: {}, data: {} });',
        'await tx.stockMovement.createManyAndReturn({ data: [] });',
      ]) {
        expect(LENH_GHI.test(stripToCode(code))).toBe(true);
      }
      for (const code of [
        'await this.prisma\n      .stockItem\n      .update({ where: {} });',
        'await this.prisma.stockItem.updateManyAndReturn({ where: {} });',
        'await this.prisma\n      .$executeRaw`UPDATE stock_items SET on_hand = 0`;',
      ]) {
        expect(GHI_NGOAI_TX.test(stripToCode(code))).toBe(true);
      }
      // A method merely named like a write is not a Prisma write.
      expect(LENH_GHI.test(stripToCode('this.createVoucherView(v);'))).toBe(
        false,
      );
    });

    it('read-path detector: excuses the RepeatableRead array tx, catches every other variant', () => {
      const RR = 'Prisma.TransactionIsolationLevel.RepeatableRead';
      expect(
        viPhamDuongDoc(
          `await this.prisma.$transaction([a(), b()], { isolationLevel: ${RR} });`,
        ),
      ).toBe(false);
      expect(
        viPhamDuongDoc('await this.prisma.$transaction([a(), b()]);'),
      ).toBe(true);
      expect(
        viPhamDuongDoc(
          `await this.prisma.$transaction(async (tx) => a(), { isolationLevel: ${RR} });`,
        ),
      ).toBe(true);
      expect(
        viPhamDuongDoc(
          `await this.prisma.$transaction([a()], { isolationLevel: ${RR} });\nawait this.prisma.stockItem.update({});`,
        ),
      ).toBe(true);
      expect(viPhamDuongDoc('await this.prisma.product.findMany({});')).toBe(
        false,
      );
    });

    it('anti-empty-guard: the real read path has the RepeatableRead array tx', () => {
      const code = stripToCode(
        readFileSync(join(INVENTORY, DOC_THUAN), 'utf8'),
      );
      expect(new RegExp(TX_MANG.source).test(code)).toBe(true);
      expect(code).toContain('RepeatableRead');
    });

    it('outside the allowed files: no write, no transaction (read path: only the RepeatableRead array tx)', () => {
      const viPham = fileTs(INVENTORY).filter((f) => {
        if (laFileDuocGhi(f)) return false;
        const code = stripToCode(readFileSync(f, 'utf8'));
        return f.endsWith(`/${DOC_THUAN}`)
          ? viPhamDuongDoc(code)
          : LENH_GHI.test(code);
      });
      expect(viPham).toEqual([]);
    });

    it('file được phép ghi: khoá FOR UPDATE + transaction interactive', () => {
      for (const f of fileTs(INVENTORY).filter(laFileDuocGhi)) {
        const raw = readFileSync(f, 'utf8');
        const code = stripToCode(raw);
        expect(LENH_GHI.test(code)).toBe(true);
        expect(TX_INTERACTIVE.test(code)).toBe(true);
        // Khoá phải nằm trong một câu `$queryRaw` thật, không chỉ trong docstring.
        const cauKhoa = raw.match(/\$queryRaw[^`]*`[^`]*`/g) ?? [];
        expect(cauKhoa.some((c) => KHOA_FOR_UPDATE.test(c))).toBe(true);
      }
    });

    it('file được phép ghi: mọi lệnh ghi đi qua tx, không ghi trên this.prisma', () => {
      const viPham = fileTs(INVENTORY).filter(
        (f) =>
          laFileDuocGhi(f) &&
          GHI_NGOAI_TX.test(stripToCode(readFileSync(f, 'utf8'))),
      );
      expect(viPham).toEqual([]);
    });
  });

  describe('(c) src/inventory không ghi aggregate đơn', () => {
    const GHI_DON =
      /\.\s*(?:order|orderVersion|orderLineItem|discountApproval|attachment|quoteExport)\s*\.\s*(?:create(?:Many(?:AndReturn)?)?|update(?:Many(?:AndReturn)?)?|upsert|delete(?:Many)?)\s*\(/;

    /** Raw SQL lives in literals that `stripToCode` empties: matched on comment-stripped source. */
    const RAW_GHI_DON = rawSqlWritePattern([
      'orders',
      'order_versions',
      'order_line_items',
      'discount_approvals',
      'attachments',
      'quote_exports',
    ]);

    function ghiDon(source: string): boolean {
      return (
        GHI_DON.test(stripToCode(source)) ||
        RAW_GHI_DON.test(stripComments(source))
      );
    }

    it('chống guard rỗng: quét được file ghi tồn', () => {
      expect(
        fileTs(INVENTORY).some((f) => f.endsWith('/stock-vouchers.service.ts')),
      ).toBe(true);
    });

    it('bộ dò bắt được lệnh ghi đơn giả, bỏ qua đọc và model khác', () => {
      expect(GHI_DON.test('await tx.order.updateMany({})')).toBe(true);
      expect(GHI_DON.test('await this.prisma.orderLineItem.create({})')).toBe(
        true,
      );
      expect(GHI_DON.test('await tx.order.findUnique({})')).toBe(false);
      expect(GHI_DON.test('await tx.stockVoucher.create({})')).toBe(false);
    });

    it('catches the syntax variants: prettier chain, *AndReturn, raw SQL; ignores a comment', () => {
      for (const code of [
        'await tx\n      .order\n      .update({ where: {}, data: {} });',
        'await tx.orderLineItem.updateManyAndReturn({ data: {} });',
        'await tx.$executeRaw`UPDATE orders SET status = ${s} WHERE id = ${id}`;',
        'await tx.$executeRawUnsafe(\'DELETE FROM "order_line_items" WHERE id = $1\', id);',
      ]) {
        expect(ghiDon(code)).toBe(true);
      }
      for (const code of [
        'await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`;',
        '// never UPDATE orders from inventory',
        'await tx.$executeRaw`UPDATE stock_items SET on_hand = 0`;',
      ]) {
        expect(ghiDon(code)).toBe(false);
      }
    });

    it('mọi file src/inventory: không lệnh ghi đơn', () => {
      const viPham = fileTs(INVENTORY).filter((f) =>
        ghiDon(readFileSync(f, 'utf8')),
      );
      expect(viPham).toEqual([]);
    });
  });
});
