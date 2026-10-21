import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rawSqlWritePattern } from './util/raw-sql-write';
import { stripComments } from './util/strip-comments';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard AC-3 (mirror `no-manual-prisma-client.spec.ts`): KHÔNG BAO GIỜ xoá cứng một dòng
 * `customerSource` ở bất kỳ đâu trong `src/`. Tắt (`active: false`) là đường DUY NHẤT.
 *
 * Vì sao cần một guard SOURCE chứ không phải một unit test: mock Prisma nhận `delete()` mà không
 * kêu ca một tiếng, nên một test hermetic KHÔNG THỂ chứng minh "không có đường xoá cứng" — nó chỉ
 * chứng minh service HIỆN TẠI không gọi. Và FK `ON DELETE RESTRICT` chỉ chặn khi ĐÃ có khách trỏ
 * vào: xoá một nguồn CHƯA ai dùng sẽ thành công êm ru, rồi biến mất khỏi lịch sử. Luật này phải
 * được canh ở tầng source, trên toàn `src/`, không riêng file service.
 *
 * Cái mất khi xoá cứng: câu trả lời cho "khách này từ đâu tới" bốc hơi, và báo cáo lợi nhuận theo
 * nguồn (Epic 8) thủng một mảng — không phải một lựa chọn phong cách.
 *
 * Quét trên `stripToCode` (bỏ CẢ comment lẫn string) ⇒ TSDoc nhắc `delete()` để giải thích luật
 * KHÔNG làm guard đỏ oan.
 */
describe('source-guard: KHÔNG BAO GIỜ hard-delete customerSource (AC-3)', () => {
  const SRC_DIR = resolve(__dirname, '../src');

  /**
   * `prisma.customerSource.delete(...)` / `.deleteMany(...)`, kể cả khi biến trung gian đứng
   * giữa (`this.prisma.customerSource`, `tx.customerSource`, …) và khi xuống dòng giữa các
   * chấm. Bám vào `customerSource` + `.delete`/`.deleteMany` — đúng cái cột cần bảo vệ.
   */
  const HARD_DELETE = /\bcustomerSource\s*\.\s*(?:delete|deleteMany)\s*\(/;

  /** Raw SQL lives in literals that `stripToCode` empties: matched on comment-stripped source. */
  const RAW_HARD_DELETE = rawSqlWritePattern(['customer_sources'], ['delete']);

  function isHardDelete(source: string): boolean {
    return (
      HARD_DELETE.test(stripToCode(source)) ||
      RAW_HARD_DELETE.test(stripComments(source))
    );
  }

  function collectTsFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectTsFiles(full));
      } else if (entry.name.endsWith('.ts')) {
        files.push(full);
      }
    }
    return files;
  }

  const allFiles = collectTsFiles(SRC_DIR);

  it('guard thực sự quét src/ (không xanh giả vì danh sách file rỗng)', () => {
    // Đo thật: 166 file .ts; ngưỡng 120 đỏ khi bộ duyệt thư mục co lại.
    expect(allFiles.length).toBeGreaterThanOrEqual(120);
    // Và file service nguồn khách — nơi cám dỗ nằm — CHẮC CHẮN nằm trong tầm quét.
    expect(
      allFiles.some((f) => f.endsWith('customers/customer-sources.service.ts')),
    ).toBe(true);
  });

  it('KHÔNG file nào trong src/ gọi customerSource.delete()/deleteMany()', () => {
    const viPham = allFiles.filter((file) =>
      isHardDelete(readFileSync(file, 'utf8')),
    );

    expect(viPham.map((f) => f.slice(SRC_DIR.length + 1))).toEqual([]);
  });

  it('regex bắt được đúng thứ nó phải bắt (guard không rỗng ruột)', () => {
    // Không có ca này thì một regex gõ sai sẽ xanh vĩnh viễn và không ai hay.
    for (const mau of [
      'await this.prisma.customerSource.delete({ where: { id } });',
      'prisma.customerSource.deleteMany({ where: { active: false } })',
      'tx.customerSource\n  .delete({ where: { id } })',
    ]) {
      expect(HARD_DELETE.test(mau)).toBe(true);
    }
    // ...và KHÔNG bắt nhầm đường hợp lệ.
    for (const lanhTinh of [
      'await this.prisma.customerSource.update({ data: { active: false } });',
      'await this.prisma.customer.delete({ where: { sdt } });',
    ]) {
      expect(HARD_DELETE.test(lanhTinh)).toBe(false);
    }
  });

  it('catches a raw SQL hard delete, ignores raw deactivation and a comment', () => {
    for (const code of [
      'await tx.$executeRaw`DELETE FROM customer_sources WHERE id = ${id}`;',
      'await tx.$executeRawUnsafe(\'DELETE FROM "customer_sources" WHERE id = $1\', id);',
      'await this.prisma.$executeRaw`TRUNCATE TABLE customer_sources`;',
    ]) {
      expect(isHardDelete(code)).toBe(true);
    }
    for (const code of [
      'await tx.$executeRaw`UPDATE customer_sources SET active = false WHERE id = ${id}`;',
      '// never DELETE FROM customer_sources: deactivate instead',
      'await tx.$executeRaw`DELETE FROM customers WHERE sdt = ${sdt}`;',
    ]) {
      expect(isHardDelete(code)).toBe(false);
    }
  });
});
