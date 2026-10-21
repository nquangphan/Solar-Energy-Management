import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard (mirror source-guard Epic 1): quét `src/` và cấm khởi tạo
 * PrismaClient trực tiếp ở bất kỳ đâu. Chỉ `PrismaService` (extends PrismaClient)
 * được mở kết nối DB — không module domain nào tự tạo client riêng (AD-1, chống
 * nhiều nguồn kết nối/sự thật).
 *
 * Quét trên CODE đã strip comment (`stripToCode`, dùng chung `test/util/`): comment/tài
 * liệu được phép nhắc tới chuỗi bị cấm mà không gây false-positive — chỉ code thật
 * mới tính.
 */
describe('source-guard: chỉ PrismaService chạm DB (AD-1)', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  const FORBIDDEN = /new\s+PrismaClient\s*\(/;

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

  it('guard thực sự quét src/ (không xanh giả vì tập quét rỗng)', () => {
    const files = collectTsFiles(SRC_DIR);
    // Đo thật: 166 file .ts. Ngưỡng 120 chừa chỗ cho việc gộp file nhưng đỏ khi tập quét co lại.
    expect(files.length).toBeGreaterThanOrEqual(120);
    expect(files.some((f) => f.endsWith('prisma/prisma.service.ts'))).toBe(
      true,
    );
    expect(FORBIDDEN.test('const c = new PrismaClient({});')).toBe(true);
  });

  it('catches a construction broken across lines, ignores one mentioned in a comment', () => {
    expect(
      FORBIDDEN.test(stripToCode('const c = new\n  PrismaClient(\n  {},\n);')),
    ).toBe(true);
    expect(
      FORBIDDEN.test(stripToCode('// never call new PrismaClient() here')),
    ).toBe(false);
  });

  it('không có `new PrismaClient(` trong src/ (Prisma là điểm truy cập DUY NHẤT)', () => {
    const offenders = collectTsFiles(SRC_DIR).filter((file) =>
      FORBIDDEN.test(stripToCode(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });
});
