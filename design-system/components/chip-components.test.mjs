// QA source-guard for the hand-authored chip React components (Story 1.4).
//
// The chip CSS is covered by components.test.mjs (drift-guard on the stylesheet).
// This file guards the TSX SOURCE instead: the read-only invariant (AC-3 /
// UX-DR-23), the StatusKey/label contract (AC-2), the flag variants (AC-1), and
// barrel completeness. There is no JSX build/typecheck in the repo (web has no
// bundler/tsc — see Story 1.4 Dev Notes), so these read each .tsx as text and
// assert the invariants statically, exactly as the CSS drift-guard reads the
// stylesheet. Any edit that turns a chip into a control, drops a canonical label,
// or breaks a barrel export fails here — no runtime render needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root
const COMPONENTS_DIR = resolve(repoRoot, 'web/src/design-system/components');

const read = (name) => readFileSync(resolve(COMPONENTS_DIR, name), 'utf8');

// Strip // line comments and /* */ block comments so the read-only scan inspects
// real code only — the components' own docstrings mention "onClick"/"role" while
// explaining that they are forbidden, which must not trip the guard.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const statusChip = read('StatusChip.tsx');
const customerTypeChip = read('CustomerTypeChip.tsx');
const scopeFlag = read('ScopeFlag.tsx');
const barrel = read('index.ts');

const CHIP_SOURCES = [
  ['StatusChip.tsx', statusChip],
  ['CustomerTypeChip.tsx', customerTypeChip],
  ['ScopeFlag.tsx', scopeFlag],
];

// Comment-free code bodies for the read-only guard (see stripComments above).
const CHIP_CODE = CHIP_SOURCES.map(([name, src]) => [name, stripComments(src)]);

// The 9 canonical states + their verbatim labels (AC-2 / DESIGN.md#Status-chip).
const STATUS_LABELS = [
  ['baogia', 'Báo giá'],
  ['choduyet', 'Chờ duyệt'],
  ['dachot', 'Đã chốt'],
  ['dacoc', 'Đã cọc'],
  ['thicong', 'Đang thi công'],
  ['nghiemthu', 'Nghiệm thu'],
  ['danggiao', 'Đang giao'],
  ['hoanthanh', 'Hoàn thành'],
  ['huy', 'Huỷ'],
];

// (1) Read-only invariant — the crux of AC-3 / UX-DR-23 and the easiest mistake
// to make: none of the 3 chip components may become an interactive control. No
// click/key handlers, no <button>, no role/tabindex, no ...rest spread that
// could forward a handler. Applies to ALL three chip components.
test('chip components carry no interactive handlers/roles (AC-3, UX-DR-23)', () => {
  const banned = [
    /\bon[A-Z]\w*\s*[=:]/, // ANY event handler prop/attr: onClick, onKeyDown, onPointerDown, onFocus, …
    /<button\b/i,
    /role\s*[=:]/i,
    /tabindex/i, // matches tabIndex + tabindex
    /\{\s*\.\.\./, // ANY JSX/object spread ({...rest}, {...props}, {...anything}) that could forward a handler
  ];
  for (const [name, code] of CHIP_CODE) {
    for (const pattern of banned) {
      assert.ok(
        !pattern.test(code),
        `${name} must not contain ${pattern} — chip is read-only, never a control (AC-3)`,
      );
    }
  }
});

// (2) Each chip renders a static <span> (a11y baseline + read-only render, AC-1/3).
test('every chip component renders a <span> element', () => {
  for (const [name, src] of CHIP_SOURCES) {
    assert.ok(/<span\b/.test(src), `${name} must render a <span> (static, read-only)`);
  }
});

// (3) StatusKey union declares exactly the 9 canonical states — no more, no less.
// The union is what blocks ad-hoc/invented statuses at the type level (AC-2).
test('StatusKey union declares exactly the 9 canonical states (AC-2)', () => {
  const unionBody = statusChip.match(/export type StatusKey\s*=([\s\S]*?);/);
  assert.ok(unionBody, 'StatusKey union type must be declared and exported');
  const members = [...unionBody[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...members].sort(),
    STATUS_LABELS.map(([k]) => k).sort(),
    'StatusKey must be exactly the 9 canonical keys (no invented/missing state)',
  );
});

// (4) STATUS_LABELS maps every state to its verbatim canonical label (AC-2).
// Drift-guard against a screen-specific label ("Chờ duyệt CK") leaking in as the
// default, or a label being dropped/renamed.
test('STATUS_LABELS carries the verbatim canonical label for all 9 states (AC-2)', () => {
  for (const [key, label] of STATUS_LABELS) {
    const re = new RegExp(`${key}\\s*:\\s*'${label}'`);
    assert.ok(re.test(statusChip), `STATUS_LABELS.${key} must be '${label}' (canonical, verbatim)`);
  }
});

// (5) StatusChip composes the chip classes and defaults to the canonical label
// (AC-1/2): "chip", "chip--{status}", the .dot accent, and a label override that
// falls back to STATUS_LABELS.
test('StatusChip composes chip classes + defaults to canonical label (AC-1/2)', () => {
  assert.ok(/['"]chip['"]/.test(statusChip), 'StatusChip must apply the base "chip" class');
  assert.ok(/chip--\$\{status\}/.test(statusChip), 'StatusChip must apply "chip--${status}"');
  assert.ok(/className="dot"/.test(statusChip), 'StatusChip must render the .dot accent span');
  assert.ok(
    /label\s*\?\?\s*STATUS_LABELS\[status\]/.test(statusChip),
    'StatusChip must default the display text to STATUS_LABELS[status]',
  );
});

// (6) ScopeFlag toggles the on/off class from its boolean prop (AC-1 —
// "on = teal, off = strike-through"). It is a display flag, not a toggle.
test('ScopeFlag maps the `on` prop to the on/off class (AC-1)', () => {
  assert.ok(/['"]scope-flag['"]/.test(scopeFlag), 'ScopeFlag must apply the base "scope-flag" class');
  assert.ok(
    /on\s*\?\s*'on'\s*:\s*'off'/.test(scopeFlag),
    "ScopeFlag must select 'on'/'off' from the boolean `on` prop",
  );
});

// (7) CustomerTypeChip renders the .ktype pill (AC-1).
test('CustomerTypeChip applies the .ktype class (AC-1)', () => {
  assert.ok(/['"]ktype['"]/.test(customerTypeChip), 'CustomerTypeChip must apply the "ktype" class');
});

// (8) Barrel completeness — the whole chip layer must be re-exported so screens
// can consume it (StatusChip + STATUS_LABELS + the 2 flags + their types).
test('index.ts re-exports the full chip layer', () => {
  const required = [
    'StatusChip',
    'STATUS_LABELS',
    'StatusChipProps',
    'StatusKey',
    'CustomerTypeChip',
    'CustomerTypeChipProps',
    'ScopeFlag',
    'ScopeFlagProps',
  ];
  for (const name of required) {
    assert.ok(barrel.includes(name), `index.ts must export ${name}`);
  }
});
