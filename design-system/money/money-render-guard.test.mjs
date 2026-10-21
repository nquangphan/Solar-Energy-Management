// Money-render guard. Money is displayed in ONE format on every screen,
// `83.010.960 đ`, and only through the design-system formatter:
//   web     <Money value={n} /> or formatVnd(n)  (web/src/design-system/components)
//   Flutter MoneyText(n)       or formatVnd(n)  (mobile/lib/design_system/components)
//
// This guard scans every web and Flutter screen/component source and fails when
// a money-valued field (money-fields.mjs, derived from the OpenAPI contract) is
// printed raw. The raw-render shapes it detects are the ones this repo used
// before money was formatted:
//   web     String(x.amount)        `${x.amount}`        x.amount.toString()
//           a JSX child whose value is the field: {x.amount}, {c ? x.amount : ''},
//           {x.unitCost ?? ''}, and bare props like {amount}
//   Flutter '${x.amount}'  '$amount'  x.amount.toString()
// It also bans locale formatting (toLocaleString / Intl / NumberFormat /
// toFixed): formatting goes through formatVnd only, so web and Flutter stay
// byte-identical (the shared fixture in vnd-format-cases.json pins both).
//
// Blind spots (by construction): a money value copied into a variable with a
// non-money name (`final giaVon = l.unitCost; Text('$giaVon')`) is invisible.
// Money INPUT fields (value={unitPrice} on an <input>, a TextEditingController)
// are deliberately not display and are not flagged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { assertScanned } from '../lib/assert-scanned.mjs';
import { EXTRA_MONEY_FIELDS, moneyFields, numericProperties, repoRoot } from './money-fields.mjs';

const MONEY_FIELDS = moneyFields();
const FIELD_ALT = MONEY_FIELDS.join('|');

// Receivers whose `.amount`/`.unitPrice` is NOT money: `fieldErrors.amount` is
// the backend's Vietnamese validation message for the amount input.
const NON_MONEY_RECEIVERS = new Set(['fieldErrors']);

// A field reference: an optional receiver chain then a money field name, e.g.
// `amount`, `line.amount`, `_totals!.subtotal`, `x?.unitCost`.
const REF = `(?<![\\w$.])((?:[\\w$]+[!?]?\\.)*)(${FIELD_ALT})(?![\\w$])`;

// Neutralise the sanctioned wrappers so a field inside them is not seen:
// formatVnd(…), MoneyText(…), <Money … />.
function removeCalls(code, name) {
  let out = '';
  let i = 0;
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  for (let m = re.exec(code); m !== null; m = re.exec(code)) {
    if (m.index < i) continue;
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < code.length && depth > 0) {
      if (code[j] === '(') depth += 1;
      else if (code[j] === ')') depth -= 1;
      j += 1;
    }
    out += code.slice(i, m.index) + `${name}()`;
    i = j;
    re.lastIndex = j;
  }
  return out + code.slice(i);
}

function neutralise(code) {
  let out = removeCalls(code, 'formatVnd');
  out = removeCalls(out, 'MoneyText');
  return out.replace(/<Money\b[^>]*\/>/g, '<Money/>');
}

const isMoneyRef = (receiverChain) => {
  const first = receiverChain.split(/[!?]?\./)[0];
  return !NON_MONEY_RECEIVERS.has(first);
};

// Same cuts as lib/strip-comments.mjs, but a block comment keeps its newlines so
// a reported line number points at the real source line.
const stripCommentsKeepLines = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, '')).replace(/\/\/.*$/gm, '');

const lineOf = (code, index) => code.slice(0, index).split('\n').length;

/** Content of the brace that opens at `open` (exclusive), or null. */
function braceContent(code, open) {
  let depth = 1;
  for (let j = open + 1; j < code.length; j += 1) {
    if (code[j] === '{') depth += 1;
    else if (code[j] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, j);
    }
  }
  return null;
}

/**
 * A JSX child brace: `{` reached from a `>` (not `=>`) through JSX text and
 * earlier balanced `{...}` children only. An attribute value (`=` first), a
 * call argument or an object literal (`(`, `,`, `;`, `=`) ends the walk.
 */
function isJsxChildBrace(code, open) {
  for (let k = open - 1; k >= 0; k -= 1) {
    const c = code[k];
    if (c === '>') return code[k - 1] !== '=';
    if (c === '}') {
      let depth = 1;
      while (depth > 0 && k > 0) {
        k -= 1;
        if (code[k] === '}') depth += 1;
        else if (code[k] === '{') depth -= 1;
      }
      if (depth > 0) return false;
      continue;
    }
    if ('<{=();,[]'.includes(c)) return false;
  }
  return false;
}

// In a JSX child expression, the field is RENDERED when it sits in a value
// position: the whole expression, a ternary branch, or a `??`/`||`/`&&` operand
// at the end — not when it is only compared (`x.unitCost !== undefined`).
const VALUE_POSITION = new RegExp(
  `(?:^|\\?(?![.?])|:|&&|\\?\\?|\\|\\|)\\s*${REF}\\s*(?=$|:|\\?\\?|\\|\\|)`,
  'g',
);

/**
 * Raw money renders in one source file. `kind` is 'web' or 'dart'. Returns
 * `["<line>: <shape>: <snippet>", ...]`.
 */
export function findRawMoneyRenders(src, kind) {
  const code = neutralise(stripCommentsKeepLines(src));
  const hits = [];
  const add = (index, shape, snippet) => hits.push(`${lineOf(code, index)}: ${shape}: ${snippet.trim()}`);

  // Locale formatting is banned everywhere: formatting goes through formatVnd only.
  for (const m of code.matchAll(/\btoLocaleString\b|\bIntl\.|\bNumberFormat\b|\btoFixed\s*\(|package:intl\//g)) {
    add(m.index, 'locale-format', m[0]);
  }
  // x.amount.toString()
  for (const m of code.matchAll(new RegExp(`${REF}\\s*\\.\\s*toString\\s*\\(`, 'g'))) {
    if (isMoneyRef(m[1])) add(m.index, 'toString', m[0]);
  }
  // `${x.amount}` (TS template / Dart interpolation)
  for (const m of code.matchAll(new RegExp(`\\$\\{\\s*${REF}\\s*\\}`, 'g'))) {
    if (isMoneyRef(m[1])) add(m.index, 'interpolation', m[0]);
  }

  if (kind === 'dart') {
    // '$amount' — bare Dart interpolation of a money-named identifier.
    for (const m of code.matchAll(new RegExp(`\\$(${FIELD_ALT})(?![\\w$])`, 'g'))) {
      add(m.index, 'interpolation', m[0]);
    }
    return hits;
  }

  // String(x.amount)
  for (const m of code.matchAll(new RegExp(`\\bString\\(\\s*${REF}\\s*\\)`, 'g'))) {
    if (isMoneyRef(m[1])) add(m.index, 'String()', m[0]);
  }
  // {x.amount} as a JSX child (value position only).
  for (let open = code.indexOf('{'); open !== -1; open = code.indexOf('{', open + 1)) {
    if (!isJsxChildBrace(code, open)) continue;
    const content = braceContent(code, open);
    if (content === null) continue;
    const flat = content.trim();
    for (const m of flat.matchAll(VALUE_POSITION)) {
      if (isMoneyRef(m[1])) add(open, 'jsx-child', `{${flat.length > 80 ? `${flat.slice(0, 80)}…` : flat}}`);
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// The scan set: every web and Flutter screen/component source.
// ---------------------------------------------------------------------------

function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

// Not render code: the formatter itself, data ports/fakes (records, no UI),
// generated permission keys.
const SKIP_WEB = /(?:format-vnd\.ts|-port\.ts|\.generated\.ts|\.test\.tsx?)$/;
const SKIP_DART = /(?:money_text\.dart|_port\.dart|\.g\.dart)$/;

const webFiles = [
  ...walk(resolve(repoRoot, 'web/src/screens'), ['.tsx', '.ts']),
  ...walk(resolve(repoRoot, 'web/src/design-system'), ['.tsx', '.ts']),
].filter((f) => !SKIP_WEB.test(f));
const dartFiles = [
  ...walk(resolve(repoRoot, 'mobile/lib/screens'), ['.dart']),
  ...walk(resolve(repoRoot, 'mobile/lib/design_system'), ['.dart']),
].filter((f) => !SKIP_DART.test(f));

test('money field list is derived from the OpenAPI contract and is not empty', () => {
  // Anti-blind: a broken derivation would make every scan below vacuous.
  assertScanned(MONEY_FIELDS, 8, 'money fields');
  for (const f of ['unitPrice', 'amount', 'subtotal', 'vatAmount', 'total', 'unitCost', 'costPrice', 'price', 'discountAmount', 'afterDiscount']) {
    assert.ok(MONEY_FIELDS.includes(f), `money field list must include ${f}`);
  }
  // Quantities / counts / percentages must not be swept in as money.
  for (const f of ['qty', 'onHand', 'reserved', 'vatRate', 'minQty', 'warrantyMonths', 'estimatedMarginPct']) {
    assert.ok(!MONEY_FIELDS.includes(f), `${f} is not money and must not be in the list`);
  }
  // Each documented extra must still exist in the contract (no rot).
  const props = numericProperties();
  for (const f of EXTRA_MONEY_FIELDS) {
    assert.ok(props.has(f), `extra money field ${f} no longer exists in openapi.json — update money-fields.mjs`);
  }
});

test('the guard scans every web and Flutter screen/component file (anti-empty)', () => {
  // Measured 2026-10-21: web 64, Flutter 51 — floors set a little lower.
  assertScanned(webFiles, 55, 'web screen/component files');
  assertScanned(dartFiles, 45, 'Flutter screen/component files');
  // The screens themselves must be in the set, not just design-system.
  assert.ok(webFiles.some((f) => f.endsWith('CreateQuoteScreen.tsx')), 'web screens must be scanned');
  assert.ok(dartFiles.some((f) => f.endsWith('create_quote_screen.dart')), 'Flutter screens must be scanned');
});

test('self-test: the guard flags every known raw-render shape and passes the sanctioned ones', () => {
  const webBad = [
    '<dd className="num mono">{String(totals.subtotal)}</dd>',
    '<td className="od-mono">{line.amount}</td>',
    '<td className="num strong mono">{amount}</td>',
    "<td>{l.unitCost !== undefined ? l.unitCost : ''}</td>",
    "<td className=\"num mono\">{l.unitCost ?? ''}</td>",
    '<span>{product.sku} · <span className="mono">{product.price}</span></span>',
    '<p>Giá {l.qty} · {l.unitCost}</p>',
    '<p>{l.qty}{l.unitCost}</p>',
    '<p>{l.qty} {l.unitCost ?? \'\'}</p>',
    'const label = `Tổng ${totals.total}`;',
    'const s = line.amount.toString();',
    'const s = n.toLocaleString("vi-VN");',
    'const f = new Intl.NumberFormat("vi-VN");',
  ];
  for (const snippet of webBad) {
    assert.ok(findRawMoneyRenders(snippet, 'web').length > 0, `web guard must flag: ${snippet}`);
  }
  const dartBad = [
    "Text('${item.amount}', style: _mono),",
    "_SummaryRow(label: 'Giá gốc', value: '${selected.subtotal}'),",
    "value: _totals == null ? '—' : '${_totals!.total}',",
    "child: Text('$amount'),",
    "Text('Giá ${l.qty} · ${l.unitCost}'),",
    "Text('Giá ${l.qty} · $amount đ'),",
    'AppTableCellText(l.unitCost.toString()),',
    "import 'package:intl/intl.dart';",
  ];
  for (const snippet of dartBad) {
    assert.ok(findRawMoneyRenders(snippet, 'dart').length > 0, `Flutter guard must flag: ${snippet}`);
  }
  const webGood = [
    '<dd className="num mono">{totals ? <Money value={totals.subtotal} /> : \'—\'}</dd>',
    '<td><Money value={line.amount} /></td>',
    "<td>{l.unitCost !== undefined ? <Money value={l.unitCost} /> : ''}</td>",
    '{stockIssue.voucher.lines.some((l) => l.unitCost !== undefined) && (<th>Giá vốn</th>)}',
    '<input value={unitPrice} onChange={(e) => onUnitPriceChange?.(Number(e.target.value))} />',
    '{fieldErrors.amount && <Banner tone="danger">{fieldErrors.amount}</Banner>}',
    'const label = `Tổng ${formatVnd(totals.total)}`;',
    '<td>{line.qty}</td>',
    '<p>Giá {l.qty} · <Money value={x.amount} /></p>',
    '<p>{l.qty} <input value={x.unitPrice} onChange={f} /></p>',
    'const a = foo({l.qty}, {x.amount});',
    'const a = {x.amount};',
  ];
  for (const snippet of webGood) {
    assert.deepEqual(findRawMoneyRenders(snippet, 'web'), [], `web guard must NOT flag: ${snippet}`);
  }
  const dartGood = [
    'MoneyText(item.amount, style: _mono),',
    "value: _totals == null ? '—' : formatVnd(_totals!.total),",
    "'${product.sku} · ${product.unit} · ${formatVnd(product.price)}',",
    "AppTableCellText('${l.qty}'),",
    "unitPrice: int.tryParse(_freeUnitPrice.text) ?? 0,",
  ];
  for (const snippet of dartGood) {
    assert.deepEqual(findRawMoneyRenders(snippet, 'dart'), [], `Flutter guard must NOT flag: ${snippet}`);
  }
});

test('no web screen/component renders a money field raw (use <Money> / formatVnd)', () => {
  const violations = webFiles.flatMap((f) =>
    findRawMoneyRenders(readFileSync(f, 'utf8'), 'web').map((h) => `${relative(repoRoot, f)}:${h}`),
  );
  assert.deepEqual(violations, [], `raw money renders on web — display money via <Money value={n} /> or formatVnd(n):\n${violations.join('\n')}`);
});

test('no Flutter screen/widget renders a money field raw (use MoneyText / formatVnd)', () => {
  const violations = dartFiles.flatMap((f) =>
    findRawMoneyRenders(readFileSync(f, 'utf8'), 'dart').map((h) => `${relative(repoRoot, f)}:${h}`),
  );
  assert.deepEqual(violations, [], `raw money renders on Flutter — display money via MoneyText(n) or formatVnd(n):\n${violations.join('\n')}`);
});
