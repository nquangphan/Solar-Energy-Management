import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard: a controller validates a UUID path param only through `UUID_PARAM`
 * (`common/validation/uuid-param.ts`). A bare `ParseUUIDPipe` — the class passed to `@Param` or a
 * fresh `new ParseUUIDPipe(...)` — answers Nest's English "Validation failed (uuid is expected)",
 * which the web shows as-is. Scans code only (comments and strings stripped).
 */
describe('source-guard: UUID path params use UUID_PARAM, never a bare ParseUUIDPipe', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  const FORBIDDEN = /\bParseUUIDPipe\b/;
  // `stripToCode` drops the param-name literal, so the name is not part of the match.
  const USE = /@Param\([^()]*,\s*UUID_PARAM\s*\)/g;

  function controllers(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...controllers(full));
      else if (entry.name.endsWith('.controller.ts')) files.push(full);
    }
    return files;
  }

  const sources = controllers(SRC_DIR).map((file) => ({
    file,
    code: stripToCode(readFileSync(file, 'utf8')),
  }));

  it('scans every controller and sees the factory in use (not blind)', () => {
    // Measured 2026-10-22: 18 controllers; 20 UUID params in 6 of them.
    expect(sources.length).toBeGreaterThanOrEqual(15);
    const uses = sources.map(({ code }) => code.match(USE)?.length ?? 0);
    expect(uses.filter((n) => n > 0).length).toBeGreaterThanOrEqual(6);
    expect(uses.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(20);
    // The regex sees both forms it forbids.
    expect(FORBIDDEN.test("@Param('id', ParseUUIDPipe) id: string")).toBe(true);
    expect(
      FORBIDDEN.test('@Param(\'id\', new ParseUUIDPipe({ version: "4" }))'),
    ).toBe(true);
  });

  it('no controller references ParseUUIDPipe directly', () => {
    expect(
      sources
        .filter(({ code }) => FORBIDDEN.test(code))
        .map(({ file }) => file),
    ).toEqual([]);
  });
});
