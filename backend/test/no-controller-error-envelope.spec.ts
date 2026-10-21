import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard AC-2 (mirror source-guard 2.1): CHỈ `AllExceptionsFilter` được dựng error
 * envelope (AD-5). Không controller/service nào tự nặn envelope.
 *
 * Dấu hiệu chọn: `traceId` — field CHỈ envelope có. Controller/service nghiệp vụ ném
 * `AppException`/`HttpException`; filter mới gắn `traceId` và dựng shape. Nếu một
 * controller/service nhắc `traceId` (trên CODE đã strip comment) → bằng chứng có nơi
 * khác dựng envelope tay → fail.
 *
 * Loại trừ đúng phạm vi: DTO envelope (`error-envelope.dto.ts`) và filter
 * (`all-exceptions.filter.ts`) ĐƯỢC phép chứa `traceId` — guard chỉ quét
 * `*.controller.ts` / `*.service.ts`.
 */
describe('source-guard: chỉ exception filter dựng envelope (AD-5, AC-2)', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  const FORBIDDEN = /traceId/;

  function collectGuardedFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectGuardedFiles(full));
      } else if (
        entry.name.endsWith('.controller.ts') ||
        entry.name.endsWith('.service.ts')
      ) {
        files.push(full);
      }
    }
    return files;
  }

  it('guard thực sự quét controller + service (không xanh giả vì tập quét rỗng)', () => {
    const files = collectGuardedFiles(SRC_DIR);
    // Đo thật: 28 file (12 controller + 16 service). Ngưỡng 20 chừa chỗ cho việc gộp/xoá file
    // nhưng vẫn đỏ khi bộ trích trả rỗng hoặc chỉ còn một nhúm file.
    expect(files.length).toBeGreaterThanOrEqual(20);
    expect(files.some((f) => f.endsWith('.controller.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('.service.ts'))).toBe(true);
    // Chính filter nhắc `traceId` — nếu regex mù thì nó sẽ không thấy thứ nó canh.
    expect(FORBIDDEN.test('const e = { traceId };')).toBe(true);
  });

  it('không controller/service nào nhắc `traceId` (chỉ filter dựng envelope)', () => {
    const offenders = collectGuardedFiles(SRC_DIR).filter((file) =>
      FORBIDDEN.test(stripToCode(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });
});
