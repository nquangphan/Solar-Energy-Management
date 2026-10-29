// Guard: main.tsx is the web's ONE composition root (AD-12 client rule).
//
//  - No fake port or demo payload reaches the production path: main.tsx, the app
//    layer (app/) and the HTTP layer (api/) never name one or import a fake module.
//  - Only main.tsx builds the transport, the generated client and the HTTP adapters
//    (tests excepted): a second place assembling ports is a second session.
//  - The ports whose data types are contract types alias the GENERATED schema
//    instead of declaring the contract by hand.
//
// Reads sources as text (import.meta.glob `?raw`), with comments dropped by the same
// helper as the network guard. Not blind: it must scan enough files and must still
// see the real calls in main.tsx.
import { describe, expect, it } from 'vitest';

import { codeOnly, withoutComments } from './source-text';

const sources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const MAIN = '../main.tsx';
const isTest = (path: string) => path.startsWith('./');
const isProductionPath = (path: string) =>
  path === MAIN || path.startsWith('../app/') || (path.startsWith('../api/') && !path.startsWith('../api/generated/'));

const productionPath = Object.entries(sources).filter(([path]) => isProductionPath(path));
// What production renders: a screen or a shared component defaulting a prop to a fake port
// would ship that fake with main.tsx itself clean. (session/ is where fakes and demos live.)
const RENDERED_DIRS = ['../screens/', '../design-system/components/', '../design-system/shell/'];
const renderedPath = Object.entries(sources).filter(([path]) => RENDERED_DIRS.some((dir) => path.startsWith(dir)));

/** Fake ports, demo payloads and fake modules — identifiers on code, the import path on raw text. */
function fakeReferences(source: string): string[] {
  const code = codeOnly(source);
  const raw = withoutComments(source);
  const found = [
    ...(code.match(/\bFake\w*Port\b/g) ?? []),
    ...(code.match(/\bDEMO_[A-Z_]+\b/g) ?? []),
    ...(raw.match(/from\s+['"][^'"]*\bfake-[^'"]*['"]/g) ?? []),
    ...(raw.match(/import\(\s*['"][^'"]*\bfake-[^'"]*['"]\s*\)/g) ?? []),
  ];
  return found;
}

/** Calls that assemble the session/ports (definitions — `function createTransport(` — are not calls). */
const ASSEMBLY = [
  /(?<!function\s+)\bcreateTransport\s*\(/g,
  /(?<!function\s+)\bcreateApiClient\s*\(/g,
  /\bnew\s+Http\w+Port\s*\(/g,
];

function assemblyCalls(source: string): string[] {
  const code = codeOnly(source);
  return ASSEMBLY.flatMap((pattern) => code.match(pattern) ?? []);
}

/** The port files whose data types must come from the generated schema. */
const GENERATED_TYPE_PORTS = [
  'customers-port.ts',
  'customer-sources-port.ts',
  'warranty-port.ts',
  'settings-port.ts',
  'catalog-port.ts',
  'me-port.ts',
  'orders-port.ts',
  'inventory-port.ts',
  'stock-vouchers-port.ts',
  'payments-port.ts',
  'contracts-port.ts',
  'invoices-port.ts',
  'accounts-port.ts',
].map((file) => `../design-system/session/${file}`);

/** Hand-written on purpose: the quote files are bytes the adapter assembles, not a contract payload. */
const NON_CONTRACT_INTERFACES = ['QuoteExportFile', 'QuoteExportFiles'];

/**
 * The one request type widened by hand on purpose: a blank payment amount stays absent so the
 * server rejects it (400 `fieldErrors.amount`) instead of the client sending 0.
 */
const WIDENED_INPUTS = ['RecordPaymentInput'];

/**
 * `type X = …` whose right-hand side holds an object literal — bare (`{ … }`), wrapped
 * (`Readonly<{ … }>`) or glued onto a generated type (`Dto & { … }`): a contract shape typed by
 * hand. Quoted path keys (`paths['/orders/{id}']`) are not literals.
 */
function handWrittenTypeAliases(source: string): string[] {
  return [...source.matchAll(/\btype\s+(\w+)\s*=([^;]*);/g)]
    .filter((m) => m[2].replace(/'[^']*'/g, "''").includes('{'))
    .map((m) => m[1]);
}

describe('composition root (main.tsx)', () => {
  it('scans main.tsx, app/ and api/ (not blind)', () => {
    expect(productionPath.length).toBeGreaterThanOrEqual(10);
    expect(productionPath.some(([path]) => path === MAIN)).toBe(true);
    expect(productionPath.some(([path]) => path.startsWith('../app/'))).toBe(true);
  });

  it('main.tsx really builds the transport, wraps the PermissionsProvider and builds all 18 adapters', () => {
    const code = codeOnly(sources[MAIN]);
    expect(code).toMatch(/(?<!function\s+)\bcreateTransport\s*\(/);
    expect(code).toMatch(/<PermissionsProvider\b/);
    expect(code.match(/\bnew\s+Http\w+Port\s*\(/g) ?? []).toHaveLength(18);
  });

  it('recognises every fake shape (patterns not blind)', () => {
    const cases = [
      "import { FakeMePort } from './design-system/session';",
      "import { DEMO_ME } from './design-system/session';",
      "import { x } from './design-system/session/fake-me-port';",
      "const m = await import('./design-system/session/fake-me-port');",
      'const port = new FakeCustomersPort();',
    ];
    for (const code of cases) expect(fakeReferences(code), code).not.toEqual([]);
    expect(fakeReferences("// FakeMePort\nconst label = 'Fake data';")).toEqual([]);
  });

  it('scans the rendered screens and shared components (not blind)', () => {
    for (const dir of RENDERED_DIRS) expect(renderedPath.some(([path]) => path.startsWith(dir)), dir).toBe(true);
    expect(renderedPath.length).toBeGreaterThanOrEqual(19);
  });

  it('no screen or shared component reaches for a fake port or demo payload', () => {
    const offenders = renderedPath
      .map(([path, code]) => ({ path, found: fakeReferences(code) }))
      .filter(({ found }) => found.length > 0);
    expect(offenders).toEqual([]);
  });

  it('no fake port, demo payload or fake module on the production path', () => {
    const offenders = productionPath
      .map(([path, code]) => ({ path, found: fakeReferences(code) }))
      .filter(({ found }) => found.length > 0);
    expect(offenders).toEqual([]);
  });

  it('recognises the assembly calls but not their definitions', () => {
    expect(assemblyCalls('const t = createTransport({ baseUrl });')).toHaveLength(1);
    expect(assemblyCalls('const c = createApiClient(t, b);')).toHaveLength(1);
    expect(assemblyCalls('new HttpCustomersPort(client)')).toHaveLength(1);
    expect(assemblyCalls('export function createTransport({ baseUrl }) {}')).toEqual([]);
    expect(assemblyCalls('export function createApiClient(transport, baseUrl) {}')).toEqual([]);
  });

  it('only main.tsx assembles the transport, the client and the adapters', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => path !== MAIN && !isTest(path) && !path.startsWith('../api/generated/'))
      .map(([path, code]) => ({ path, found: assemblyCalls(code) }))
      .filter(({ found }) => found.length > 0);
    expect(offenders).toEqual([]);
  });

  it('contract data types in the ports alias the generated schema, not a hand-written copy', () => {
    expect(GENERATED_TYPE_PORTS.length).toBeGreaterThanOrEqual(12);
    for (const path of GENERATED_TYPE_PORTS) {
      const raw = withoutComments(sources[path] ?? '');
      expect(raw, path).toMatch(/import type \{[^}]*\bcomponents\b[^}]*\} from '\.\.\/\.\.\/api\/generated\/schema';/);
      // Only the port interface itself and its error shape stay hand-written.
      const interfaces = [...raw.matchAll(/\binterface\s+(\w+)/g)].map((m) => m[1]);
      for (const name of interfaces.filter((n) => !NON_CONTRACT_INTERFACES.includes(n))) {
        expect(name, `${path} declares interface ${name}`).toMatch(/(?:Port|PortError)$/);
      }
      // A type alias spelled as an object literal is the same hand-written contract under another keyword.
      expect(handWrittenTypeAliases(raw).filter((name) => !WIDENED_INPUTS.includes(name)), path).toEqual([]);
    }
  });

  it('every widened input is still widened (the exception cannot outlive its reason)', () => {
    const declared = GENERATED_TYPE_PORTS.flatMap((path) => handWrittenTypeAliases(withoutComments(sources[path] ?? '')));
    expect(declared).toEqual(WIDENED_INPUTS);
  });

  it('recognises a hand-written object type alias but not an alias of the generated schema', () => {
    expect(handWrittenTypeAliases('export type Customer = { phone: string };')).toEqual(['Customer']);
    expect(handWrittenTypeAliases('type Row = Readonly<{ id: string }>;')).toEqual(['Row']);
    expect(handWrittenTypeAliases("export type Customer = Schemas['CustomerResponseDto'];")).toEqual([]);
    expect(handWrittenTypeAliases("export type P = Pick<Schemas['ProductResponseDto'], 'id' | 'name'>;")).toEqual([]);
    expect(handWrittenTypeAliases("export type I = Omit<Schemas['XDto'], 'amount'> & {\n  amount?: number;\n};")).toEqual(['I']);
    expect(handWrittenTypeAliases("export type Q = NonNullable<paths['/orders/{id}']['get']['parameters']['query']>;")).toEqual([]);
  });
});
