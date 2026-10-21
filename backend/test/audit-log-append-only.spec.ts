import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rawSqlWritePattern } from './util/raw-sql-write';
import { stripComments } from './util/strip-comments';
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

  /**
   * Mọi API Prisma sửa/xoá một bản ghi đã ghi, `updateManyAndReturn` included (a bare
   * `updateMany\b` alternative cannot match it). `create`/`createMany` KHÔNG bị cấm.
   */
  const MUTATING_AUDIT_CALL =
    /\bauditLog\s*\.\s*(?:update(?:Many(?:AndReturn)?)?|delete(?:Many)?|upsert)\b/;

  /** Raw SQL lives in literals that `stripToCode` empties: matched on comment-stripped source. */
  const RAW_MUTATION = rawSqlWritePattern(['audit_logs'], ['update', 'delete']);

  function isMutation(source: string): boolean {
    return (
      MUTATING_AUDIT_CALL.test(stripToCode(source)) ||
      RAW_MUTATION.test(stripComments(source))
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
      `await this.prisma.auditLog\n      .deleteMany({ where: { targetId } });`,
      `await tx.auditLog.updateManyAndReturn({ where: {}, data: {} });`,
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

  it('catches a raw SQL update/delete, ignores a raw insert, a read and a comment', () => {
    for (const source of [
      'await tx.$executeRaw`UPDATE audit_logs SET payload = ${p} WHERE id = ${id}`;',
      'await tx.$executeRawUnsafe(\'DELETE FROM "audit_logs" WHERE id = $1\', id);',
      'await this.prisma.$executeRaw`TRUNCATE audit_logs`;',
    ]) {
      expect(isMutation(source)).toBe(true);
    }
    for (const source of [
      'await tx.$executeRaw`INSERT INTO audit_logs (id) VALUES (${id})`;',
      'await tx.$queryRaw`SELECT id FROM audit_logs WHERE id = ${id}`;',
      '// never UPDATE audit_logs after the insert',
    ]) {
      expect(isMutation(source)).toBe(false);
    }
  });

  it('không có lối sửa/xoá AuditLog nào trong src/ (chỉ được `create`)', () => {
    const offenders = allFiles.filter((file) =>
      isMutation(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
