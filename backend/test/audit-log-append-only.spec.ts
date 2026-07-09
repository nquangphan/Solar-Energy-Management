import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard: `AuditLog` là nhật ký BẤT BIẾN, append-only (AD-8) — sau khi ghi, KHÔNG
 * đường code nào được sửa/xoá.
 *
 * `AuditService` chỉ expose `record` (→ `create`), nhưng `PrismaService` là `@Global` và
 * được inject ở nhiều module: bất kỳ module nào cũng có thể gọi thẳng
 * `prisma.auditLog.deleteMany(...)`/`.update(...)` mà không guard nào chặn. Bất biến
 * append-only vì thế phải được enforce ở SOURCE, không chỉ bằng "hiện chưa ai gọi".
 *
 * Quét `src/` trên code đã bỏ comment + string (`stripToCode`): chỉ code thật mới tính,
 * doc nhắc `auditLog.update` KHÔNG false-positive. `create` là lối ghi DUY NHẤT hợp lệ.
 * (Đọc audit — chỉ Super Admin — là story riêng, không thuộc guard này.)
 */
describe('source-guard: AuditLog append-only (AD-8)', () => {
  const SRC_DIR = resolve(__dirname, '../src');

  /** Mọi API Prisma sửa/xoá một bản ghi đã ghi. `create`/`createMany` KHÔNG bị cấm. */
  const MUTATING_AUDIT_CALL =
    /\bauditLog\s*\.\s*(update|updateMany|delete|deleteMany|upsert)\b/;

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
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('regex bắt mọi lối sửa/xoá, bỏ qua `create` và nhắc trong doc', () => {
    const violations = [
      `await this.prisma.auditLog.update({ where: { id } });`,
      `await this.prisma.auditLog.updateMany({ where: {} });`,
      `await this.prisma.auditLog.delete({ where: { id } });`,
      `await prisma.auditLog.deleteMany({ where: { targetId } });`,
      `await prisma.auditLog.upsert({ where: { id } });`,
      `await prisma.auditLog . delete({ where: { id } });`,
    ];
    for (const source of violations) {
      expect(MUTATING_AUDIT_CALL.test(stripToCode(source))).toBe(true);
    }

    const allowed = [
      `await this.prisma.auditLog.create({ data });`,
      `/** KHÔNG được gọi auditLog.delete sau khi ghi */\nconst x = 1;`,
    ];
    for (const source of allowed) {
      expect(MUTATING_AUDIT_CALL.test(stripToCode(source))).toBe(false);
    }
  });

  it('không có lối sửa/xoá AuditLog nào trong src/ (chỉ được `create`)', () => {
    const offenders = allFiles.filter((file) =>
      MUTATING_AUDIT_CALL.test(stripToCode(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });
});
