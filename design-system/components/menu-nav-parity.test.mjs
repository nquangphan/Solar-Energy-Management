// Parity guard for the navigation gates (Story 10.7, tabs 10.8): every entry of the
// mobile Menu (kMobileMenu) and every wired bottom-nav tab (kMobileTabLinks, both in
// app_menu_nav.dart) carries the SAME key, `requires` and `requiresAny` as the web
// sidebar entry with that key (SIDEBAR_NAV, Sidebar.tsx). One permission
// gate per destination on both platforms (AD-17): an entry that opens on web but not
// on mobile (or the reverse) for the same account is a gate that drifted.
//
// Both sources are read as text; permission constants are resolved to their registry
// strings (web PERM.x, mobile AppPermissionKeys.x) so a renamed constant cannot hide
// a changed key.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const webPermSrc = read('web/src/design-system/gating/permissions.ts');
const webPerm = Object.fromEntries(
  [.../export const PERM = \{([\s\S]*?)\n\}/.exec(webPermSrc)[1].matchAll(/^\s+(\w+): '([^']+)',$/gm)].map((m) => [m[1], m[2]]),
);
const mobilePerm = Object.fromEntries(
  [...read('mobile/lib/design_system/gating/app_permission_keys.g.dart').matchAll(/static const String (\w+) = '([^']+)';/g)].map(
    (m) => [m[1], m[2]],
  ),
);

/** `{ key: { requires, requiresAny } }` of the gated links in [body], with constants resolved. */
function gates(body, linkPattern, constPrefix, perms) {
  const resolveKey = (expr) => {
    const name = new RegExp(`^${constPrefix}\\.(\\w+)$`).exec(expr.trim())?.[1];
    assert.ok(name && perms[name], `unresolvable permission constant ${expr}`);
    return perms[name];
  };
  const out = {};
  for (const [, link] of body.matchAll(linkPattern)) {
    const key = /key: '([^']+)'/.exec(link)?.[1];
    assert.ok(key, `nav link without a key: ${link}`);
    const requires = /requires: ([\w.]+)/.exec(link)?.[1];
    const any = /requiresAny: \[([^\]]*)\]/.exec(link)?.[1];
    out[key] = {
      requires: requires ? resolveKey(requires) : null,
      requiresAny: any ? any.split(',').filter((s) => s.trim()).map(resolveKey).sort() : null,
    };
  }
  return out;
}

const webNavSrc = stripComments(read('web/src/design-system/shell/Sidebar.tsx'));
const webNav = gates(
  /export const SIDEBAR_NAV: NavSection\[\] = \[([\s\S]*?)\n\];/.exec(webNavSrc)[1],
  /\{\s*(key: '[^']+'[\s\S]*?)\}/g,
  'PERM',
  webPerm,
);
const mobileNavSrc = stripComments(read('mobile/lib/design_system/shell/app_menu_nav.dart'));
const mobileNav = gates(
  /const List<AppNavSection> kMobileMenu = \[([\s\S]*?)\n\];/.exec(mobileNavSrc)[1],
  /AppNavLink\(([\s\S]*?)\),\n/g,
  'AppPermissionKeys',
  mobilePerm,
);
const mobileTabs = gates(
  // The last link ends the list (`),\n];`): add back the newline its pattern ends on.
  `${/const List<AppNavLink> kMobileTabLinks = \[([\s\S]*?)\n\];/.exec(mobileNavSrc)[1]}\n`,
  /AppNavLink\(([\s\S]*?)\),\n/g,
  'AppPermissionKeys',
  mobilePerm,
);

test('the readers resolve both nav tables (not blind)', () => {
  assert.ok(Object.keys(webPerm).length >= 8, 'web PERM read with too few keys');
  assert.ok(Object.keys(mobilePerm).length >= 8, 'mobile AppPermissionKeys read with too few keys');
  assert.ok(Object.keys(webNav).length >= 8, `SIDEBAR_NAV read with ${Object.keys(webNav).length} entries`);
  assert.deepEqual(Object.keys(mobileNav).sort(), ['customers', 'profile', 'warranty']);
  assert.deepEqual(Object.keys(mobileTabs).sort(), ['inventory', 'orders']);
  // A gate of each shape is actually read on both sides.
  assert.equal(webNav.customers.requires, 'customers.manage');
  assert.deepEqual(webNav.warranty.requiresAny, ['orders.view_all', 'orders.view_own']);
});

test('every mobile Menu entry and wired tab has the web sidebar gate for the same key', () => {
  let compared = 0;
  for (const [where, table] of [['Menu', mobileNav], ['tab', mobileTabs]]) {
    for (const [key, gate] of Object.entries(table)) {
      assert.ok(webNav[key], `mobile ${where} entry "${key}" has no web sidebar entry`);
      assert.deepEqual(gate, webNav[key], `mobile ${where} "${key}" gate differs from the web sidebar`);
      compared += 1;
    }
  }
  assert.ok(compared >= 5, `compared only ${compared} entries`);
  // Both any-of gates of the tabs are really read (not an empty requiresAny).
  assert.deepEqual(mobileTabs.inventory.requiresAny, ['inventory.manage', 'quotes.create_edit']);
});

test('a key is a Menu entry or a tab, never both (one gate per destination)', () => {
  for (const key of Object.keys(mobileTabs)) assert.ok(!(key in mobileNav), `"${key}" is both a Menu entry and a tab`);
});
