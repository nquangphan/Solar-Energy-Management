// QA source-guard for the hand-authored data/feedback React components (Story 1.5).
//
// The component CSS is covered by components.test.mjs (drift-guard on the
// stylesheet). This file guards the TSX SOURCE instead — the React contracts the
// CSS drift-guard can't see: the Stepper state union (no disabled/grayed, AC-2/
// UX-DR-11) and its done→tick/else→number rule, the dropped-last `.bar`, the
// Banner tone default + modifier mapping (AC-4), the KPI accent/mono class
// composition (AC-3), the Table thin-wrapper contract (AC-1), and barrel
// completeness. There is no JSX build/typecheck in the repo (web has no
// bundler/tsc — see Story 1.5 Dev Notes), so these read each .tsx as text and
// assert the invariants statically, exactly as the CSS drift-guard reads the
// stylesheet. Any edit that invents a step state, flips done→number, forwards a
// handler onto the read-only Stepper, or drops a barrel export fails here — no
// runtime render needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root
const COMPONENTS_DIR = resolve(repoRoot, 'web/src/design-system/components');

const read = (name) => readFileSync(resolve(COMPONENTS_DIR, name), 'utf8');

// Strip // line comments and /* */ block comments so negative scans inspect real
// code only — the components' own docstrings mention forbidden things (handlers,
// "applyTransition") while explaining why they are absent, which must not trip a
// guard.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const table = read('Table.tsx');
const stepper = read('Stepper.tsx');
const kpi = read('Kpi.tsx');
const banner = read('Banner.tsx');
const barrel = read('index.ts');

const stepperCode = stripComments(stepper);

// ---------------------------------------------------------------------------
// Table (AC-1) — a thin wrapper, NOT a Th/Td/Tr component tree.
// ---------------------------------------------------------------------------

// (1) Renders a native <table className="table …"> and joins/forwards className +
// the rest props — screens write their own thead/tbody/tr/td (the CSS targets
// `.table th/td/tr` directly).
test('Table renders <table className="table …"> and forwards className + rest (AC-1)', () => {
  assert.ok(/<table\b/.test(table), 'Table must render a native <table> element');
  assert.ok(
    /\[\s*'table'\s*,\s*className\s*\]\.filter\(Boolean\)\.join\(' '\)/.test(table),
    "Table must join classes as ['table', className].filter(Boolean).join(' ')",
  );
  assert.ok(/\{\s*\.\.\.rest\s*\}/.test(table), 'Table must forward {...rest} onto the <table>');
});

// (2) No Th/Td/Tr sub-components (YAGNI — the CSS never needs them; the story
// forbids building them). Guard against the tree being re-introduced.
test('Table exposes no Th/Td/Tr sub-components (YAGNI, AC-1)', () => {
  assert.ok(
    !/export\s+(?:function|const)\s+(?:Th|Td|Tr)\b/.test(table),
    'Table.tsx must not declare Th/Td/Tr sub-components — CSS targets .table th/td/tr directly',
  );
});

// ---------------------------------------------------------------------------
// Stepper (AC-2 / UX-DR-11) — read-only, no disabled variant.
// ---------------------------------------------------------------------------

// (3) StepState union is EXACTLY done|current|gate. This is what blocks a
// `disabled`/`grayed` variant at the type level: inapplicable steps are dropped
// from `steps` by the caller, never rendered dimmed (UX-DR-11, AC-2).
test('StepState union declares exactly done|current|gate — no disabled/grayed (AC-2)', () => {
  const union = stepper.match(/export type StepState\s*=([\s\S]*?);/);
  assert.ok(union, 'StepState union type must be declared and exported');
  const members = [...union[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...members].sort(),
    ['current', 'done', 'gate'],
    'StepState must be exactly {done, current, gate} — no invented/disabled state',
  );
});

// (4) `.bul` content rule: `done` → the white check icon (ic-check); every other
// state → the 1-based step number (index + 1). This is the core render contract.
test('Stepper .bul shows ic-check on done, else the 1-based number (AC-2)', () => {
  assert.ok(
    /step\.state\s*===\s*'done'/.test(stepperCode),
    "Stepper must branch on step.state === 'done'",
  );
  assert.ok(
    /name=["']ic-check["']/.test(stepperCode),
    "done step must render <Icon name=\"ic-check\" />",
  );
  assert.ok(/:\s*i\s*\+\s*1/.test(stepperCode), 'non-done steps must render the 1-based number (i + 1)');
});

// (5) The connecting `.bar` renders between steps and is dropped after the last.
test('Stepper drops the .bar after the last step (AC-2)', () => {
  assert.ok(
    /i\s*===\s*steps\.length\s*-\s*1/.test(stepperCode),
    'Stepper must compute an isLast (i === steps.length - 1)',
  );
  assert.ok(
    /!isLast\s*&&\s*<div className="bar"/.test(stepperCode),
    'Stepper must render <div className="bar" /> only when !isLast',
  );
});

// (6) Required Stepper DOM hooks the CSS drift-guard expects on the markup side.
test('Stepper renders the stepper/node/bul/st-label markup (AC-2)', () => {
  for (const cls of ['stepper', 'node', 'bul', 'st-label']) {
    assert.ok(
      new RegExp(`className=["'][^"']*\\b${cls}\\b`).test(stepper),
      `Stepper must render a .${cls} element`,
    );
  }
});

// (7) Display-only invariant (AD-11 / UX-DR-11): the Stepper only SHOWS the step
// sequence — it never becomes interactive and never mutates order status. No
// event handlers, no <button>, no status-transition call.
test('Stepper is display-only — no handlers/buttons/status mutation (AD-11)', () => {
  assert.ok(!/\bon[A-Z]\w*\s*[=:]/.test(stepperCode), 'Stepper must carry no event handlers');
  assert.ok(!/<button\b/i.test(stepperCode), 'Stepper must not render a <button>');
  assert.ok(
    !/applyTransition|setStatus|Order\.status/.test(stepperCode),
    'Stepper must not touch order status — display-only',
  );
});

// ---------------------------------------------------------------------------
// KPI (AC-3) — accent + mono class composition.
// ---------------------------------------------------------------------------

// (8) `accent` toggles the .accent modifier; `mono` toggles .mono on the .k-v
// value; the delta is rendered only when provided.
test('Kpi composes accent + mono classes and renders delta conditionally (AC-3)', () => {
  assert.ok(
    /\[\s*'kpi'\s*,\s*accent\s*&&\s*'accent'\s*\]/.test(kpi),
    "Kpi must build the card class as ['kpi', accent && 'accent']",
  );
  assert.ok(
    /\[\s*'k-v'\s*,\s*mono\s*&&\s*'mono'\s*\]/.test(kpi),
    "Kpi must build the value class as ['k-v', mono && 'mono']",
  );
  assert.ok(/\{delta\s*&&/.test(kpi), 'Kpi must render the .k-d delta only when delta is provided');
});

// (9) Required KPI DOM hooks (label/value markup).
test('Kpi renders the kpi/k-l/k-v markup (AC-3)', () => {
  for (const cls of ['k-l', 'k-v']) {
    assert.ok(
      new RegExp(`className=["'][^"']*\\b${cls}\\b|'${cls}'`).test(kpi),
      `Kpi must render a .${cls} element`,
    );
  }
});

// ---------------------------------------------------------------------------
// Banner (AC-4 / UX-DR-13) — tone default + optional icon.
// ---------------------------------------------------------------------------

// (10) BannerTone union is exactly warn|info|danger.
test('BannerTone union declares exactly warn|info|danger (AC-4)', () => {
  const union = banner.match(/export type BannerTone\s*=([\s\S]*?);/);
  assert.ok(union, 'BannerTone union type must be declared and exported');
  const members = [...union[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...members].sort(),
    ['danger', 'info', 'warn'],
    'BannerTone must be exactly {warn, info, danger}',
  );
});

// (11) `warn` is the default and the base class (NO modifier); info/danger add
// `banner--${tone}`. The icon slot is optional (a11y label carries meaning, not
// the icon — UX-DR-26).
test('Banner defaults to warn (base class) and maps info/danger to banner--tone (AC-4)', () => {
  assert.ok(/tone\s*=\s*'warn'/.test(banner), "Banner must default `tone` to 'warn'");
  assert.ok(
    /tone\s*!==\s*'warn'\s*&&\s*`banner--\$\{tone\}`/.test(banner),
    "Banner must add `banner--${tone}` only when tone !== 'warn'",
  );
  assert.ok(/\{icon\s*&&\s*<Icon\b/.test(banner), 'Banner must render the left <Icon> only when icon is set');
});

// ---------------------------------------------------------------------------
// Barrel (index.ts) — the whole data/feedback layer must be consumable.
// ---------------------------------------------------------------------------

// (12) Every Story 1.5 export (components + their types) is re-exported so
// screens (Epic 3–8) can import them from the design-system barrel.
test('index.ts re-exports the full data/feedback layer (Story 1.5)', () => {
  const required = [
    'Table',
    'TableProps',
    'Stepper',
    'StepperProps',
    'StepItem',
    'StepState',
    'Kpi',
    'KpiProps',
    'Banner',
    'BannerProps',
    'BannerTone',
  ];
  for (const name of required) {
    assert.ok(barrel.includes(name), `index.ts must export ${name}`);
  }
});
