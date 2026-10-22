// Reads the web's contract types where they now live (Story 10.5): a web port declares
// `export type Order = Schemas['OrderResponseDto'];`, so the fields are in the generated
// `web/src/api/generated/schema.d.ts`, not in the port text. Guards that compare a type's
// fields on web and mobile resolve the web side through these helpers.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA_PATH = resolve(repoRoot, 'web/src/api/generated/schema.d.ts');

/**
 * The contract DTO a web port type IS: `export type X = Schemas['Dto'];` and nothing more. A
 * `Pick`/`Omit`, an `& { … }` or any wrapper fails — its fields are not the DTO's, so a guard
 * comparing "the DTO's fields" would vouch for a type it never read (use `webTypeFields`).
 */
export function webAliasDto(portSrc, typeName) {
  const match = new RegExp(`export type ${typeName} = Schemas\\['(\\w+)'\\];`).exec(portSrc);
  assert.ok(match, `web port must declare ${typeName} exactly as a generated contract type (= Schemas['…'];)`);
  return match[1];
}

/**
 * `{ field: optional }` of a web port type that is a generated DTO or a `Pick`/`Omit` of one —
 * the fields the type really has. Any other shape (an `& { … }` literal, a wrapper) fails.
 */
export function webTypeFields(portSrc, typeName) {
  const decl = new RegExp(`export type ${typeName} =([^;]*);`).exec(portSrc);
  assert.ok(decl, `web port must declare ${typeName}`);
  const rhs = decl[1].replace(/\s+/g, ' ').trim();
  const exact = /^Schemas\['(\w+)'\]$/.exec(rhs);
  if (exact) return generatedFields(exact[1]);
  const narrowed = /^(Pick|Omit)< ?Schemas\['(\w+)'\], ?('\w+'(?: ?\| ?'\w+')*) ?>$/.exec(rhs);
  assert.ok(narrowed, `web ${typeName} must be a generated type or a Pick/Omit of one, got: ${rhs}`);
  const [, kind, dto, keyList] = narrowed;
  const keys = [...keyList.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  const fields = generatedFields(dto);
  for (const key of keys) assert.ok(Object.hasOwn(fields, key), `${dto} has no field ${key}`);
  return Object.fromEntries(Object.entries(fields).filter(([name]) => keys.includes(name) === (kind === 'Pick')));
}

/** The member lines of a generated DTO (comments stripped) — for checks on a field's type. */
export function generatedBody(dto) {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const match = new RegExp(`\\n {8}${dto}: \\{\\n([\\s\\S]*?)\\n {8}\\};`).exec(schema);
  assert.ok(match, `schema.d.ts has no generated ${dto}`);
  return match[1].replace(/\/\*[\s\S]*?\*\//g, '');
}

/** `{ field: optional }` of a generated DTO — the type the web port really uses. */
export function generatedFields(dto) {
  return Object.fromEntries(
    [...generatedBody(dto).matchAll(/^ {12}(\w+)(\??):/gm)].map((m) => [m[1], m[2] === '?']),
  );
}
