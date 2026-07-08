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

  it('không có `new PrismaClient(` trong src/ (Prisma là điểm truy cập DUY NHẤT)', () => {
    const offenders = collectTsFiles(SRC_DIR).filter((file) =>
      FORBIDDEN.test(stripToCode(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });
});
