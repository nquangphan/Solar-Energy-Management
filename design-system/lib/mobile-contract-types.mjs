// Reads the mobile's contract types where they now live (Story 10.7, every data port since 10.8): a Dart port declares
// `typedef Customer = CustomerResponseDto;`, so the fields are those of the generated class in
// `mobile/lib/api/generated/models/`, i.e. the schema's properties in openapi.json (the client is
// generated from it, drift-guarded byte-for-byte in `flutter test`). Twin of web-contract-types.mjs.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC_PATH = resolve(repoRoot, 'backend/openapi/openapi.json');
const MODELS_DIR = resolve(repoRoot, 'mobile/lib/api/generated/models');

const snake = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/**
 * The generated DTO a Dart port type IS: `typedef X = SomeDto;` and nothing more. A hand-written
 * `class X` (or a typedef to anything that is not a generated model) fails.
 */
export function mobileAliasDto(portSrc, typeName) {
  const match = new RegExp(`^typedef ${typeName} = (\\w+);$`, 'm').exec(portSrc);
  assert.ok(match, `mobile port must declare ${typeName} exactly as a generated contract type (typedef ${typeName} = …Dto;)`);
  const dto = match[1];
  const model = resolve(MODELS_DIR, `${snake(dto)}.dart`);
  assert.ok(existsSync(model), `${typeName} aliases ${dto}, which is not a generated model (${snake(dto)}.dart missing)`);
  assert.ok(readFileSync(model, 'utf8').includes(`class ${dto} {`), `${snake(dto)}.dart does not declare class ${dto}`);
  return dto;
}

/** The source of the generated Dart model of `dto` (`mobile/lib/api/generated/models/<snake>.dart`). */
export function mobileDtoSource(dto) {
  const model = resolve(MODELS_DIR, `${snake(dto)}.dart`);
  assert.ok(existsSync(model), `${dto} is not a generated model (${snake(dto)}.dart missing)`);
  const src = readFileSync(model, 'utf8');
  assert.ok(src.includes(`class ${dto} {`), `${snake(dto)}.dart does not declare class ${dto}`);
  return src;
}

/** The property names of a schema in openapi.json — the fields of the generated Dart class. */
export function mobileDtoFields(dto) {
  const schema = JSON.parse(readFileSync(SPEC_PATH, 'utf8')).components.schemas[dto];
  assert.ok(schema, `openapi.json has no schema ${dto}`);
  const fields = Object.keys(schema.properties ?? {});
  assert.ok(fields.length > 0, `${dto} read with no property (reader went blind)`);
  return fields;
}

/**
 * The `final` fields a hand-written Dart class declares in its own body (a projection class such
 * as `CatalogProduct`), plus those of the class it `extends` when that class is in the same file.
 */
export function mobileClassFields(src, className) {
  const decl = new RegExp(`^class ${className}(?: extends (\\w+))? \\{\\n([\\s\\S]*?)\\n\\}`, 'm').exec(src);
  assert.ok(decl, `mobile source has no class ${className}`);
  const own = [...decl[2].matchAll(/^ {2}final [\w<>?, ]+? (\w+);$/gm)].map((m) => m[1]);
  const inherited = decl[1] ? mobileClassFields(src, decl[1]) : [];
  const fields = [...inherited, ...own];
  assert.ok(fields.length > 0, `class ${className} read with no field (reader went blind)`);
  return fields;
}
