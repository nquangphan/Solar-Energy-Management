// Guard: api/transport.ts is the ONLY file under web/src that may touch the
// network (AD-12 client rule), and api/client.ts the only one that may create an
// openapi-fetch client (one created elsewhere without `fetch: transport.fetch`
// falls back to globalThis.fetch). Any other path would skip the bearer, the
// refresh and the AD-5 envelope parsing.
//
// Reads every .ts/.tsx as text (import.meta.glob `?raw`, no fs), strips comments
// (string-aware, so a `//` inside a string hides nothing), then matches the
// forbidden shapes. Identifier rules run on code with quoted strings emptied (a
// UI text or a test name saying "fetch" is not a call); access/import rules run
// with strings kept (`globalThis['fetch']`, `from 'axios'`). Not blind: it must
// scan the whole tree AND must still see each allowed file's own binding.
import { describe, expect, it } from 'vitest';

import { codeOnly, withoutComments } from './source-text';

const sources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TRANSPORT = '../api/transport.ts';
const CLIENT = '../api/client.ts';
const SELF = './no-network-outside-transport.test.ts';

type Rule = { name: string; pattern: RegExp; on: 'code' | 'raw'; allowedIn: string };

const GLOBAL = String.raw`(?:window|globalThis|self)`;
const MEMBER = String.raw`\s*(?:\?\.|\.|\[\s*['"\x60])\s*`;

const RULES: Rule[] = [
  // `fetch` as a value: a call, `.call`/`.bind`, an alias (`const f = fetch`). Not a
  // property (`client.fetch`), an object key (`fetch: x`) or a type (`typeof fetch`).
  { name: 'fetch', pattern: /(?<![.\w$])(?<!typeof\s+)fetch\b(?!\s*:)/, on: 'code', allowedIn: TRANSPORT },
  { name: 'global.fetch', pattern: new RegExp(`\\b${GLOBAL}${MEMBER}fetch\\b`), on: 'raw', allowedIn: TRANSPORT },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/, on: 'code', allowedIn: TRANSPORT },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/, on: 'code', allowedIn: TRANSPORT },
  { name: 'WebSocket', pattern: /\bWebSocket\b/, on: 'code', allowedIn: TRANSPORT },
  { name: 'EventSource', pattern: /\bEventSource\b/, on: 'code', allowedIn: TRANSPORT },
  { name: 'axios', pattern: /\baxios\b/, on: 'raw', allowedIn: TRANSPORT },
  { name: 'openapi-fetch', pattern: /['"\x60]openapi-fetch['"\x60]/, on: 'raw', allowedIn: CLIENT },
];

function violations(source: string): string[] {
  const text = { raw: withoutComments(source), code: codeOnly(source) };
  return RULES.filter((r) => r.pattern.test(text[r.on])).map((r) => r.name);
}

const scanned = Object.entries(sources).filter(
  ([path]) => !path.startsWith('../api/generated/') && path !== SELF,
);

describe('no network call outside the transport', () => {
  it('scans the whole web/src tree (not blind)', () => {
    expect(scanned.length).toBeGreaterThanOrEqual(100);
    expect(scanned.some(([path]) => path === TRANSPORT)).toBe(true);
    expect(scanned.some(([path]) => path === CLIENT)).toBe(true);
  });

  it("still recognises the allowed files' own bindings (patterns not blind)", () => {
    // The real access, not merely the `fetch(request)` method signature of the interface.
    expect(violations(sources[TRANSPORT])).toContain('global.fetch');
    expect(violations(sources[CLIENT])).toEqual(['openapi-fetch']);
  });

  it('catches every forbidden shape', () => {
    const cases: [string, string][] = [
      ["await fetch('/x')", 'fetch'],
      ['fetch (url)', 'fetch'],
      ['fetch.call(null, u)', 'fetch'],
      ['const f = fetch; f(u)', 'fetch'],
      ['window.fetch(url)', 'global.fetch'],
      ["globalThis['fetch'](u)", 'global.fetch'],
      ['window?.fetch(u)', 'global.fetch'],
      ['new XMLHttpRequest()', 'XMLHttpRequest'],
      ['navigator.sendBeacon(u, b)', 'sendBeacon'],
      ['navigator?.sendBeacon(u)', 'sendBeacon'],
      ["new WebSocket('ws://x')", 'WebSocket'],
      ['new window.WebSocket(u)', 'WebSocket'],
      ["new EventSource('/s')", 'EventSource'],
      ["import axios from 'axios'", 'axios'],
      ["import createClient from 'openapi-fetch'", 'openapi-fetch'],
      ["const p = 'a//b'; fetch('/x')", 'fetch'],
      ['const s = `${fetch(u)}`', 'fetch'],
    ];
    for (const [code, rule] of cases) expect(violations(code), code).toContain(rule);
  });

  it('ignores comments, strings, properties, keys and types', () => {
    expect(
      violations(
        [
          "// fetch('/x')",
          '/* new XMLHttpRequest() */',
          "const u = 'http://h';",
          'client.fetch(request); prefetch(x);',
          'createClient({ baseUrl, fetch: transport.fetch });',
          'let f: typeof fetch;',
          "it('fetch fails', () => {}); vi.stubGlobal('fetch', stub);",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('no file outside its allowed one calls the network or creates a client', () => {
    const offenders = scanned
      .map(([path, code]) => ({
        path,
        found: violations(code).filter((name) => RULES.find((r) => r.name === name)!.allowedIn !== path),
      }))
      .filter(({ found }) => found.length > 0);
    expect(offenders).toEqual([]);
  });
});
