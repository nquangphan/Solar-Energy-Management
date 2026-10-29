import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { stripComments } from './util/strip-comments';

/**
 * Source-guard (FR-18, AD-8): authorization is decided by PERMISSION keys only. A role is a
 * preset loaded into an account's permissions, never a runtime check — so role presets and
 * role names may live only in `src/accounts/` (where presets are applied and displayed).
 *
 * Reads comment-stripped RAW source (`stripComments` keeps string literals): a role literal
 * such as `'SUPER_ADMIN'` is a string, and `stripToCode` would erase exactly what this guard
 * must see. Comments mentioning a role are not offenders.
 *
 * Syntax variants it must catch: an import or use of `ROLE_PRESETS` / `ROLE_PRESET_KEYS` /
 * `matchingPreset`, the `RolePreset` type, and a role name as a single-, double- or
 * back-quoted literal.
 */
describe('source-guard: no role-based authorization outside accounts/', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  const ACCOUNTS_DIR = join(SRC_DIR, 'accounts') + sep;

  const FORBIDDEN_IDENTIFIERS = [
    'ROLE_PRESETS',
    'ROLE_PRESET_KEYS',
    'RolePreset',
    'matchingPreset',
  ];
  const ROLE_NAMES = [
    'SUPER_ADMIN',
    'ADMIN',
    'QUAN_LY',
    'KE_TOAN',
    'THO_KS',
    'THI_CONG',
    'KHO_GIAO',
  ];
  const IDENTIFIER_RE = new RegExp(
    `\\b(${FORBIDDEN_IDENTIFIERS.join('|')})\\b`,
  );
  const ROLE_LITERAL_RE = new RegExp(`(['"\`])(${ROLE_NAMES.join('|')})\\1`);

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

  function decidesByRole(source: string): boolean {
    const code = stripComments(source);
    return IDENTIFIER_RE.test(code) || ROLE_LITERAL_RE.test(code);
  }

  it('no file outside src/accounts/ references a role preset or a role name', () => {
    const offenders = collectTsFiles(SRC_DIR)
      .filter((file) => !file.startsWith(ACCOUNTS_DIR))
      .filter((file) => decidesByRole(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC_DIR, file));
    expect(offenders).toEqual([]);
  });

  it('the scan is not blind: it walks src/ and sees the forbidden tokens inside accounts/', () => {
    const files = collectTsFiles(SRC_DIR);
    expect(files.length).toBeGreaterThanOrEqual(120);
    const outside = files.filter((file) => !file.startsWith(ACCOUNTS_DIR));
    expect(outside.length).toBeGreaterThan(100);
    // The presets file itself must trip the detector — proves the scanner reads real source.
    const presets = files.find((file) =>
      file.endsWith(join('accounts', 'domain', 'role-presets.ts')),
    );
    expect(presets).toBeDefined();
    expect(decidesByRole(readFileSync(presets!, 'utf8'))).toBe(true);
  });

  it.each([
    [
      'import of ROLE_PRESETS',
      "import { ROLE_PRESETS } from '../accounts/domain/role-presets';",
    ],
    ['use of ROLE_PRESET_KEYS', 'const all = ROLE_PRESET_KEYS.length;'],
    ['RolePreset in a type', 'function f(role: RolePreset): void {}'],
    ['matchingPreset call', 'const p = matchingPreset(keys);'],
    ['single-quoted role', "if (account.role === 'SUPER_ADMIN') return true;"],
    ['double-quoted role', 'if (role === "ADMIN") return true;'],
    ['back-quoted role', 'if (role === `KE_TOAN`) return true;'],
  ])('catches %s', (_name, code) => {
    expect(decidesByRole(code)).toBe(true);
  });

  it.each([
    [
      'a role named in a line comment',
      '// only SUPER_ADMIN has audit.read\nconst x = 1;',
    ],
    ['a role named in a block comment', "/* preset 'ADMIN' */ const y = 2;"],
    ['a longer identifier containing a role', 'const ADMIN_PRESET_SIZE = 3;'],
    ['a longer string containing a role', "const s = 'NOT_ADMIN_ROLE';"],
  ])('ignores %s', (_name, code) => {
    expect(decidesByRole(code)).toBe(false);
  });
});
