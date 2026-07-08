import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Naming-convention guard cho AC-3 (mirror triết lý guard byte-for-byte Epic 1):
 * mọi file `.ts` trong `src/` phải là kebab-case (`prisma.service.ts`,
 * `health-response.dto.ts`) — cấm camelCase/PascalCase/snake_case. Đây là hợp đồng
 * đặt tên cho mọi story backend sau; guard tự động chặn lệch ở CI thay vì review tay.
 *
 * [Source: ARCHITECTURE-SPINE.md#Consistency Conventions — file kebab-case]
 */
describe('naming-convention: file src/ là kebab-case (AC-3)', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  // Mỗi segment ngăn bởi `.` (vd health.controller.ts → ['health','controller'])
  // phải là kebab-case: chỉ chữ thường/số, nối bằng `-`. Chặn `_`, chữ hoa.
  const KEBAB_SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

  function isKebabFileName(fileName: string): boolean {
    // Bỏ đuôi `.ts`, các phần còn lại (name + qualifier như `.dto`/`.module`)
    // đều phải là kebab-case segment.
    const segments = fileName.replace(/\.ts$/, '').split('.');
    return segments.every((segment) => KEBAB_SEGMENT.test(segment));
  }

  it('không có file src/ nào lệch kebab-case', () => {
    const offenders = collectTsFiles(SRC_DIR)
      .map((file) => file.slice(SRC_DIR.length + 1))
      .filter((relative) => {
        const fileName = relative.split('/').pop() as string;
        return !isKebabFileName(fileName);
      });
    expect(offenders).toEqual([]);
  });
});
