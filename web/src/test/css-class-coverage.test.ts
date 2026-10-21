// Guard: mọi className TĨNH dùng trong web/src phải có rule CSS thật trong một
// stylesheet của web/src (bài học 5.6: 8 class không tồn tại ⇒ caption dính liền,
// mọi lane xanh). Đọc nguồn qua import.meta.glob `?raw` ⇒ không cần fs/@types/node.
//
// "Tĩnh" = chuỗi literal ở ba dạng: `className="…"`; literal trong biểu thức
// `className={…}` (vd `cond ? 'navlink active' : 'navlink'`); literal trong mảng
// `[...].filter(Boolean).join(' ')` của component. KHÔNG quét được: template
// `chip--${status}`, class truyền qua prop/biến từ nơi khác — giới hạn đã biết.
import { describe, expect, it } from 'vitest';

const tsxSources = import.meta.glob('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const cssSources = import.meta.glob('../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Tên class xuất hiện trong PHẦN SELECTOR của mọi rule (bỏ comment, bỏ khối khai báo). */
export function definedClasses(css: Record<string, string>): Set<string> {
  const out = new Set<string>();
  for (const text of Object.values(css)) {
    const noComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of noComments.matchAll(/([^{}]+)\{/g)) {
      const prelude = m[1];
      if (prelude.trim().startsWith('@')) continue; // @media/@supports: không phải selector
      for (const c of prelude.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) out.add(c[1]);
    }
  }
  return out;
}

/** Mỗi class tĩnh kèm file dùng nó. */
export function usedStaticClasses(tsx: Record<string, string>): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>();
  const add = (cls: string, file: string) => {
    if (!used.has(cls)) used.set(cls, new Set());
    used.get(cls)!.add(file);
  };
  for (const [file, text] of Object.entries(tsx)) {
    const literals: string[] = [];
    // Literal là toán hạng so sánh (`tone === 'danger' && …`) là GIÁ TRỊ prop, không phải class.
    const quoted = (src: string) =>
      [...src.replace(/[!=]==\s*(['"])[^'"]*\1/g, '').matchAll(/'([^'`]*)'|"([^"`]*)"/g)].map(
        (q) => q[1] ?? q[2] ?? '',
      );
    for (const m of text.matchAll(/className="([^"]*)"/g)) literals.push(m[1]);
    for (const m of text.matchAll(/className=\{([^{}]*)\}/g)) literals.push(...quoted(m[1]));
    for (const m of text.matchAll(/\[([^\]]*)\]\s*\.filter\(Boolean\)\s*\.join\(' '\)/g)) {
      literals.push(...quoted(m[1]));
    }
    for (const lit of literals) {
      for (const cls of lit.split(/\s+/)) if (cls !== '') add(cls, file);
    }
  }
  return used;
}

/**
 * Class chỉ làm "móc" ngữ nghĩa, KHÔNG cần rule: kiểu đã đến từ cha. Mỗi mục phải
 * nêu lý do; test bên dưới đỏ nếu mục nào hết được dùng hoặc đã có rule (chống mục nát).
 */
const HOOK_ONLY: Record<string, string> = {
  'checkbox-label': 'span chữ trong <label class="checkbox">; font/màu kế thừa từ .checkbox',
  'sc-step': '<li> trong .sc-steps (flex column, list-style:none); kiểu nằm ở .sc-step-label',
};

describe('className tĩnh ⇒ có rule CSS thật', () => {
  const defined = definedClasses(cssSources);
  const used = usedStaticClasses(tsxSources);

  it('chống guard rỗng: quét được file + class ở cả hai phía', () => {
    expect(Object.keys(tsxSources).length).toBeGreaterThan(40);
    expect(Object.keys(cssSources).length).toBeGreaterThan(10);
    expect(used.size).toBeGreaterThan(100);
    expect(defined.size).toBeGreaterThan(100);
    // Một mẫu biết trước cho MỖI dạng literal — regex dạng nào hỏng thì mẫu đó rơi.
    expect(used.has('login-card')).toBe(true); // className="…"
    expect(used.has('navlink')).toBe(true); // className={cond ? '…' : '…'}
    expect(used.has('field-lg')).toBe(true); // ['field', … && 'field-lg'].filter(Boolean).join(' ')
    expect(defined.has('btn')).toBe(true);
  });

  it('không class nào thiếu rule', () => {
    const missing = [...used]
      .filter(([cls]) => !defined.has(cls) && !(cls in HOOK_ONLY))
      .map(([cls, files]) => `${cls}  ←  ${[...files].map((f) => f.replace('../', '')).join(', ')}`)
      .sort();
    expect(missing).toEqual([]);
  });

  it('danh sách HOOK_ONLY không mục: mỗi mục vẫn được dùng và vẫn chưa có rule', () => {
    for (const cls of Object.keys(HOOK_ONLY)) {
      expect(used.has(cls), `${cls} không còn dùng — gỡ khỏi HOOK_ONLY`).toBe(true);
      expect(defined.has(cls), `${cls} đã có rule — gỡ khỏi HOOK_ONLY`).toBe(false);
    }
  });
});
