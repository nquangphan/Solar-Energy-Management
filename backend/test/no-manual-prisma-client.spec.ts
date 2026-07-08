import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Source-guard (mirror source-guard Epic 1): quét `src/` và cấm khởi tạo
 * PrismaClient trực tiếp ở bất kỳ đâu. Chỉ `PrismaService` (extends PrismaClient)
 * được mở kết nối DB — không module domain nào tự tạo client riêng (AD-1, chống
 * nhiều nguồn kết nối/sự thật).
 *
 * Quét trên CODE đã strip comment (mirror action-item retro Epic 1): comment/tài
 * liệu được phép nhắc tới chuỗi bị cấm mà không gây false-positive — chỉ code thật
 * mới tính.
 */
describe('source-guard: chỉ PrismaService chạm DB (AD-1)', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  const FORBIDDEN = /new\s+PrismaClient\s*\(/;

  // Giữ lại CHỈ vùng CODE để quét. Dùng máy trạng thái quét trái→phải (KHÔNG dùng
  // hai lần replace regex độc lập — đổi thứ tự chỉ hoán vị false-negative giữa URL
  // trong string và dấu nháy trong comment). Bỏ nguyên comment và string/template
  // literal, chỉ append ký tự code:
  //  - comment/docstring nhắc `new PrismaClient(` KHÔNG tính (chống false-positive).
  //  - `//` hay dấu nháy BÊN TRONG string literal không mở comment/không nuốt code
  //    (chống false-negative). Escape `\` trong string được bỏ qua đúng.
  function stripToCode(source: string): string {
    let out = '';
    let i = 0;
    const n = source.length;
    while (i < n) {
      const c = source[i];
      const next = source[i + 1];
      if (c === '/' && next === '/') {
        i += 2;
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && next === '*') {
        i += 2;
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        i++;
        while (i < n && source[i] !== quote) {
          if (source[i] === '\\') i++; // bỏ qua ký tự escape
          i++;
        }
        i++; // bỏ qua quote đóng
        continue;
      }
      out += c;
      i++;
    }
    return out;
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

  it('không có `new PrismaClient(` trong src/ (Prisma là điểm truy cập DUY NHẤT)', () => {
    const offenders = collectTsFiles(SRC_DIR).filter((file) =>
      FORBIDDEN.test(stripToCode(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });
});
