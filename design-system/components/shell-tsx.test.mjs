// Source-guard for the web SHELL React components (Story 1.9, Task 7).
//
// The shell must stay PURE PRESENTATION (AD-1/2): no router, no network, no
// elevation, callbacks only. Web has no tsc/runtime build (Story 1.3-1.6
// pattern), so this reads the .tsx files as text and asserts those invariants
// structurally. Any drift toward routing/fetching/business logic breaks here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root
const shellDir = resolve(repoRoot, 'web/src/design-system/shell');
const read = (f) => readFileSync(resolve(shellDir, f), 'utf8');

const FILES = [
  'Topbar.tsx', 'Sidebar.tsx', 'WebFrame.tsx', 'Toolbar.tsx',
  'Seg.tsx', 'Tabs.tsx', 'SearchField.tsx', 'WebShell.tsx',
];
const sources = Object.fromEntries(FILES.map((f) => [f, read(f)]));

// (1) No router — the shell emits intent, the app layer routes (AD-1/2).
test('no router imports anywhere in the shell', () => {
  for (const [file, src] of Object.entries(sources)) {
    assert.ok(!/react-router|from\s+['"]next\/|from\s+['"]history['"]/.test(src),
      `${file} must not import a router`);
  }
});

// (2) No network — shell never calls out.
test('no network calls anywhere in the shell', () => {
  for (const [file, src] of Object.entries(sources)) {
    assert.ok(!/\bfetch\s*\(|\baxios\b|XMLHttpRequest/.test(src),
      `${file} must not perform network calls`);
  }
});

// (3) No ad-hoc elevation — flat "Viền nét".
test('no inline shadow/elevation anywhere in the shell', () => {
  for (const [file, src] of Object.entries(sources)) {
    assert.ok(!/box-shadow|boxShadow|drop-shadow/i.test(src),
      `${file} must not add inline shadow`);
  }
});

// (4) Interactive controls emit callbacks only.
test('Sidebar/Seg/Tabs/Topbar are callback-only', () => {
  assert.match(sources['Sidebar.tsx'], /onNavigate\?\.\(/, 'Sidebar must emit onNavigate');
  assert.match(sources['Seg.tsx'], /onSelect\?\.\(/, 'Seg must emit onSelect');
  assert.match(sources['Tabs.tsx'], /onSelect\?\.\(/, 'Tabs must emit onSelect');
  assert.match(sources['Topbar.tsx'], /onClick=\{onBack\}/, 'Topbar back must emit onBack');
  assert.match(sources['Topbar.tsx'], /onClick=\{onAction\}/, 'Topbar action must emit onAction');
  // Anchor-based controls preventDefault so href="#" never jumps.
  for (const f of ['Sidebar.tsx', 'Seg.tsx', 'Tabs.tsx']) {
    assert.match(sources[f], /preventDefault\(\)/, `${f} must preventDefault on anchor click`);
  }
});

// (5) WebFrame renders EXACTLY 3 chrome dots.
test('WebFrame renders exactly 3 dots', () => {
  const dots = sources['WebFrame.tsx'].match(/<i\s*\/?>/g) ?? [];
  assert.equal(dots.length, 3, `WebFrame must render exactly 3 <i> dots, found ${dots.length}`);
});

// (6) Topbar back is a <button> with an aria-label (icon-only a11y floor).
test('Topbar back is a labelled button', () => {
  const src = sources['Topbar.tsx'];
  assert.match(src, /<button[^>]*className="topbar-back"/, 'Topbar back must be a <button className="topbar-back">');
  assert.match(src, /className="topbar-back"[^>]*aria-label=|aria-label=[^>]*className="topbar-back"/,
    'Topbar back <button> must have an aria-label');
});
