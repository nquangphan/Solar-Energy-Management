// Behaviour/composition guard for the web SHELL React components (Story 1.9).
//
// Complements shell-tsx.test.mjs (which proves the shell stays pure — no
// router/network/shadow) by pinning the *behaviour the ACs specify*: the
// canonical default nav, the brand defaults, the active-state selection logic
// (which item lights up), the shell-context icon sizes, and how each control
// composes its DOM. Web has no tsc/runtime build (Story 1.3-1.6 pattern), so
// these read the .tsx sources as text and assert the invariants structurally.
// Any drift in the wiring the app layer depends on breaks here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root
const shellDir = resolve(repoRoot, 'web/src/design-system/shell');
const read = (f) => readFileSync(resolve(shellDir, f), 'utf8');

// --- Sidebar: canonical default nav (Story 1.10 gates THIS set) -------------
test('SIDEBAR_NAV holds the 8 canonical links in order (AC-1, Task 2)', () => {
  const src = read('Sidebar.tsx');
  // Every link is the canonical key -> icon -> label triple (mockup 601-610).
  const links = [
    ['home', 'ic-home', 'Trang chủ'],
    ['orders', 'ic-orders', 'Đơn hàng'],
    ['customers', 'ic-customer', 'Khách hàng'],
    ['catalog', 'ic-catalog', 'Danh mục'],
    ['inventory', 'ic-warehouse', 'Kho'],
    ['permissions', 'ic-permissions', 'Phân quyền'],
    ['audit', 'ic-audit', 'Audit'],
    ['profile', 'ic-user', 'Hồ sơ'],
  ];
  let cursor = src.indexOf('SIDEBAR_NAV');
  assert.ok(cursor >= 0, 'SIDEBAR_NAV must be exported');
  for (const [key, icon, label] of links) {
    const re = new RegExp(`key:\\s*'${key}',\\s*icon:\\s*'${icon}',\\s*label:\\s*'${label}'`);
    const at = src.slice(cursor).search(re);
    assert.ok(at >= 0, `SIDEBAR_NAV missing/mis-ordered link ${key} -> ${icon} -> ${label}`);
    cursor += at + 1; // enforce declared order
  }
  // The admin group is a titled section (`.navsec` "Quản trị").
  assert.match(src, /title:\s*'Quản trị'/, 'SIDEBAR_NAV must have the "Quản trị" section');
});

// --- Sidebar: brand defaults + active-state selection ----------------------
test('Sidebar defaults brand to ic-sun + "Phương Nam" (AC-1)', () => {
  const src = read('Sidebar.tsx');
  assert.match(src, /brand\?\.icon\s*\?\?\s*'ic-sun'/, 'brand icon must default to ic-sun');
  assert.match(src, /brand\?\.label\s*\?\?\s*'Phương Nam'/, 'brand label must default to "Phương Nam"');
});

test('Sidebar tints only the activeKey link (AC-1)', () => {
  const src = read('Sidebar.tsx');
  assert.match(
    src,
    /link\.key === activeKey \? 'navlink active' : 'navlink'/,
    'Sidebar must add "active" only to the link whose key === activeKey',
  );
  // Resting icon 16px; brand logo 18px.
  assert.match(src, /<Icon name=\{link\.icon\} size=\{16\}/, 'navlink icon must be size 16');
  assert.match(src, /<Icon name=\{brandIcon\} size=\{18\}/, 'brand logo icon must be size 18');
});

// --- Seg / Tabs: active-state selection ------------------------------------
test('Seg marks only the activeKey option active (AC-3)', () => {
  const src = read('Seg.tsx');
  assert.match(
    src,
    /opt\.key === activeKey \? 'active' : undefined/,
    'Seg must set class "active" only on the option whose key === activeKey',
  );
});

test('Tabs marks only the activeKey tab active (AC-3)', () => {
  const src = read('Tabs.tsx');
  assert.match(
    src,
    /tab\.key === activeKey \? 'active' : undefined/,
    'Tabs must set class "active" only on the tab whose key === activeKey',
  );
});

// --- Topbar: conditional render + chevron ----------------------------------
test('Topbar renders back/eyebrow/action conditionally (AC-5)', () => {
  const src = read('Topbar.tsx');
  assert.match(src, /\{onBack && \(/, 'back button must render only when onBack is provided');
  assert.match(src, /\{action && \(/, 'action must render only when action is provided');
  assert.match(src, /\{eyebrow && \(?\s*<span className="topbar-eyebrow">\{eyebrow\}<\/span>/,
    'eyebrow must render as .topbar-eyebrow only when provided');
  assert.match(src, /<Icon name="ic-chevron-left" size=\{18\}/, 'back must use ic-chevron-left at size 18');
});

// --- WebFrame: url is display-only text, never a link (AC-2) ----------------
test('WebFrame shows the url as plain .web-url text, not an anchor (AC-2)', () => {
  const src = read('WebFrame.tsx');
  assert.match(src, /<div className="web-url">\{url\}<\/div>/, '.web-url must be a text div showing {url}');
  assert.ok(!/<a[\s>]/.test(src), 'WebFrame must not render an anchor (url is display-only)');
});

// --- SearchField: composes .search > .si icon + reused .field, rest passthru -
test('SearchField wraps the shipped .field with an .si search icon (AC-3b)', () => {
  const src = read('SearchField.tsx');
  assert.match(src, /className="search"/, 'must wrap in .search');
  assert.match(src, /<span className="si">/, 'must render the .si icon slot');
  assert.match(src, /<Icon name="ic-search" size=\{16\}/, '.si must hold ic-search at size 16');
  assert.match(src, /\['field', className\]/, 'input must reuse the shipped .field class (Story 1.3)');
  assert.match(src, /<input className=\{cls\} \{\.\.\.rest\}/, 'native input props must flow via ...rest');
});

// --- WebShell: assembles the frame + .main, sidebar as an optional slot -----
test('WebShell assembles WebFrame > [sidebar?] + .main[topbar? + children] (AC-5a)', () => {
  const src = read('WebShell.tsx');
  assert.match(src, /<WebFrame url=\{url\}>/, 'WebShell must render WebFrame with the url');
  assert.match(src, /\{sidebar\}\s*<div className="main">/, 'sidebar slot must sit before .main');
  assert.match(src, /<div className="main">\s*\{topbar\}\s*\{children\}/, '.main must wrap topbar then children');
});

// --- Toolbar: layout-only wrapper, merges optional className ----------------
test('Toolbar is a .toolbar wrapper that merges an optional className', () => {
  const src = read('Toolbar.tsx');
  assert.match(src, /\['toolbar', className\]\.filter\(Boolean\)\.join\(' '\)/,
    'Toolbar must merge "toolbar" with an optional className');
});
