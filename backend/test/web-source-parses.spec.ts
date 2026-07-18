import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as ts from 'typescript';

/**
 * Source-guard: MỌI file nguồn của `web/` phải PARSE ĐƯỢC.
 *
 * Web chưa có tsc/bundler/JSDOM (TD-1) ⇒ một file `.tsx` sai cú pháp KHÔNG làm đỏ lane nào:
 * text-guard ở `design-system/screens/` đọc file như CHUỖI, nên nó vẫn thấy đủ `<Stepper>`,
 * đủ nhãn, đủ `port.get(` và báo XANH cho một màn không tồn tại khi chạy. Bốn lane xanh
 * trong khi màn chết là kịch bản có thật, không phải giả định: một comment JSX `{/* … *\/}`
 * đặt nhầm vào GIỮA danh sách attribute (`<WebShell a={…} {/* … *\/} b={…}>`) đã lọt qua
 * cả bốn lane — JSX chỉ cho `{...spread}` ở vị trí đó, comment phải là `//`.
 *
 * Guard sống ở lane backend vì đây là lane DUY NHẤT đã có compiler TypeScript trong tay
 * (`design-system/` cố ý không có dependency nào). Khuôn đọc-file-ngoài-backend đã có sẵn:
 * `permission-registry-fe-stub-parity.spec.ts`.
 *
 * Đây là kiểm tra CÚ PHÁP, không phải typecheck: nó không cần `tsconfig` của web, không cần
 * resolve import, và không thay thế được tsc thật khi TD-1 được đóng.
 */
describe('source-guard: mọi file nguồn web parse được (TD-1 — web không có tsc)', () => {
  const WEB_SRC = resolve(__dirname, '../../web/src');

  /** Mọi file `.ts`/`.tsx` dưới `web/src`, đệ quy. */
  function nguonWeb(thuMuc: string): string[] {
    const ra: string[] = [];
    for (const muc of readdirSync(thuMuc, { withFileTypes: true })) {
      const duongDan = join(thuMuc, muc.name);
      if (muc.isDirectory()) ra.push(...nguonWeb(duongDan));
      else if (/\.tsx?$/.test(muc.name)) ra.push(duongDan);
    }
    return ra;
  }

  const files = nguonWeb(WEB_SRC);

  it('quét được toàn bộ cây nguồn web — guard rỗng là guard giả PASS', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith('.tsx'))).toBe(true);
  });

  it('không file nào có lỗi cú pháp', () => {
    const loi: string[] = [];
    for (const duongDan of files) {
      const nguon = readFileSync(duongDan, 'utf8');
      const sf = ts.createSourceFile(
        duongDan,
        nguon,
        ts.ScriptTarget.ESNext,
        true,
        duongDan.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      // `parseDiagnostics` là API nội bộ của SourceFile — chỉ chứa lỗi CÚ PHÁP.
      const chuanDoan =
        (sf as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] })
          .parseDiagnostics ?? [];
      for (const d of chuanDoan) {
        const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
        loi.push(
          `${relative(WEB_SRC, duongDan)}:${line + 1}:${character + 1} — ` +
            ts.flattenDiagnosticMessageText(d.messageText, ' '),
        );
      }
    }
    expect(loi).toEqual([]);
  });
});
