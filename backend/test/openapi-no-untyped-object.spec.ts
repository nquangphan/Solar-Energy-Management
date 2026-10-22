import { readFileSync } from 'node:fs';
import { OPENAPI_OUTPUT_PATH } from '../src/openapi/openapi-document';

/**
 * A DTO property declared `@ApiProperty()` without an explicit `type` on a `string | null` (or
 * `number | null`, `Date | null`) field is reflected by Swagger as a bare `type: "object"`.
 * `openapi-typescript` turns that into `Record<string, never>`, so the generated web/mobile
 * types become unusable for that field (`create({ nationalId: '079…' })` stops compiling) and
 * the only "fix" left on the client is a cast or a hand-written type — exactly what AD-12 forbids.
 *
 * The scan covers every schema in the committed spec (the drift-guard keeps that file equal to
 * the code), so a field added later without `type` is caught too.
 */

interface PropertySchema {
  type?: string;
  properties?: unknown;
  additionalProperties?: unknown;
  $ref?: string;
  allOf?: unknown;
}

/**
 * Bare objects tolerated in the spec. Empty: every `X | null` field now declares its `type`.
 * Adding an entry is a contract regression to fix at the DTO, not a place to park it.
 */
const KNOWN_UNTYPED: readonly string[] = [];

/** A node Swagger emitted as `type: "object"` with nothing that says WHICH object. */
function isBareObject(node: PropertySchema): boolean {
  return (
    node.type === 'object' &&
    node.properties === undefined &&
    node.additionalProperties === undefined &&
    node.$ref === undefined &&
    node.allOf === undefined
  );
}

/**
 * Walks the WHOLE document, not only top-level schema properties: an array's `items`, a
 * nested inline schema or a query parameter's `schema` reflected bare is the same
 * `Record<string, never>` on the client. A component property is named `Schema.property`
 * (the allowlist's form); any other node by its JSON path.
 */
function scanDocument(document: unknown): {
  scanned: number;
  untyped: string[];
} {
  let scanned = 0;
  const untyped: string[] = [];
  const walk = (node: unknown, path: string[]): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, [...path, String(i)]));
      return;
    }
    const isComponentProperty =
      path.length === 5 &&
      path[0] === 'components' &&
      path[1] === 'schemas' &&
      path[3] === 'properties';
    if (isComponentProperty) scanned += 1;
    if (isBareObject(node as PropertySchema)) {
      untyped.push(
        isComponentProperty ? `${path[2]}.${path[4]}` : path.join('.'),
      );
    }
    for (const [key, child] of Object.entries(node))
      walk(child, [...path, key]);
  };
  walk(document, []);
  return { scanned, untyped };
}

function scanSpec(): { scanned: number; untyped: string[] } {
  return scanDocument(
    JSON.parse(readFileSync(OPENAPI_OUTPUT_PATH, 'utf8')) as unknown,
  );
}

describe('OpenAPI has no untyped object property (AD-12 generated client types)', () => {
  const { scanned, untyped } = scanSpec();

  it('scans the whole spec, not an empty document', () => {
    // Measured 2026-10-22: 529 properties. A broken path or an empty spec must fail here
    // instead of making the scan vacuously green.
    expect(scanned).toBeGreaterThanOrEqual(500);
  });

  it('no property is a bare `type: "object"`', () => {
    expect(untyped).toEqual([]);
  });

  it('sees a bare object nested in array items and in a query parameter (walk not blind)', () => {
    // Top-level-only scanning would miss the last two; the typed ones must stay unflagged.
    const fragment = {
      components: {
        schemas: {
          A: {
            type: 'object',
            properties: {
              bare: { type: 'object' },
              typed: { type: 'string', nullable: true },
              ref: {
                type: 'object',
                allOf: [{ $ref: '#/components/schemas/B' }],
              },
              list: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      paths: {
        '/x': {
          get: { parameters: [{ name: 'q', schema: { type: 'object' } }] },
        },
      },
    };
    expect(scanDocument(fragment)).toEqual({
      scanned: 4,
      untyped: [
        'A.bare',
        'components.schemas.A.properties.list.items',
        'paths./x.get.parameters.0.schema',
      ],
    });
  });

  it('the allowlist stays empty (nothing may be parked as bare)', () => {
    expect(KNOWN_UNTYPED).toEqual([]);
  });
});
