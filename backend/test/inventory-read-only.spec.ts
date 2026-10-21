import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard tồn kho — hai bất biến:
 *
 * (a) VĨNH VIỄN: KHÔNG model nào có cột `reserved`. Hàng đã hứa là `SUM(StockMovement.qty)`
 *     (AD-19); một cột cộng-trừ trôi khi retry chốt/xuất. ERD vẽ cột đó trên `StockItem` — guard
 *     này chặn người "làm theo ERD", kể cả khi đặt cột sang `Product`.
 * (b) TẠM THỜI: `src/inventory/**` chưa có lệnh ghi Prisma nào — kể cả SQL thô (`$queryRaw`
 *     chạy được `UPDATE`, và `stripToCode` xoá nội dung template nên không soi được câu SQL).
 *     Khi đường phiếu kho tới, nới (b) cho đúng những file ghi dưới `SELECT … FOR UPDATE` —
 *     KHÔNG xoá (a).
 *
 * (a) đọc schema RAW (không strip — `stripToCode` là bộ quét TS, không hiểu Prisma); (b) quét
 * code đã strip comment/string để docstring nhắc `create(` không làm đỏ oan.
 */
describe('source-guard: tồn kho đọc thuần, không cột reserved', () => {
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

  const LENH_GHI =
    /\.(?:create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/;

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

  describe('(b) src/inventory không có lệnh ghi Prisma', () => {
    it('chống guard rỗng: quét được file service', () => {
      const files = fileTs(INVENTORY);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith('stock-items.service.ts'))).toBe(
        true,
      );
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

    it('mọi file src/inventory: không lệnh ghi, không transaction', () => {
      const viPham = fileTs(INVENTORY).filter((f) =>
        LENH_GHI.test(stripToCode(readFileSync(f, 'utf8'))),
      );
      expect(viPham).toEqual([]);
    });
  });
});
