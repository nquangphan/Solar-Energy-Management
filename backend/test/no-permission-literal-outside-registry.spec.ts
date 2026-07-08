import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from './util/strip-comments';
import { PERMISSION_KEYS } from '../src/accounts/domain/permission-registry';

/**
 * Source-guard AD-17 (mirror `no-manual-prisma-client.spec.ts`): quét `src/` → CHỈ
 * `permission-registry.ts` được chứa permission string literal. Mọi nơi khác import
 * `PERM` (định danh) — cấm literal quyền rải rác.
 *
 * Dùng `stripComments` (GIỮ string, chỉ bỏ comment) — KHÁC `stripToCode` (bỏ cả string):
 * guard này SOI string literal nên phải giữ string; bỏ comment để TSDoc nhắc
 * `orders.view_all` mà không false-positive.
 *
 * Nguồn so sánh = CHÍNH các key registry (không match mọi chuỗi có dấu chấm) → route
 * path (`/auth/login`) hay chuỗi khác KHÔNG bị tính là offender (chống false-positive).
 */
describe('source-guard: không permission literal ngoài registry (AD-17)', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  const REGISTRY_FILE = 'permission-registry.ts';

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

  /** File chứa ít nhất một key registry dưới dạng string literal (`'key'`/`"key"`/`` `key` ``)? */
  function hasPermissionLiteral(code: string): boolean {
    return PERMISSION_KEYS.some(
      (key) =>
        code.includes(`'${key}'`) ||
        code.includes(`"${key}"`) ||
        code.includes(`\`${key}\``),
    );
  }

  it('chỉ permission-registry.ts chứa literal quyền; mọi src/ khác import PERM', () => {
    const offenders = collectTsFiles(SRC_DIR)
      .filter((file) => !file.endsWith(REGISTRY_FILE))
      .filter((file) =>
        hasPermissionLiteral(stripComments(readFileSync(file, 'utf8'))),
      );
    expect(offenders).toEqual([]);
  });

  it('guard THẬT SỰ bắt được literal (chống guard "chết" luôn xanh)', () => {
    // Sanity: một key registry nhúng thẳng trong code phải bị bắt.
    const sample = `const x = '${PERMISSION_KEYS[0]}';`;
    expect(hasPermissionLiteral(stripComments(sample))).toBe(true);
    // Comment nhắc key thì KHÔNG (đã strip).
    const commented = `// dùng ${PERMISSION_KEYS[0]} ở đây\nconst y = 1;`;
    expect(hasPermissionLiteral(stripComments(commented))).toBe(false);
  });
});
