// Generator for the web API types (Story 10.3, AD-12).
//
// backend/openapi/openapi.json is generated FROM the backend code; this script
// derives the web contract types from it with openapi-typescript. The output is
// committed. src/test/api-client-drift.test.ts calls the SAME buildApiSchema()
// and fails when the committed file no longer matches (byte-for-byte) — one
// function for both, so the CLI header of openapi-typescript can never make the
// generator and the guard disagree.
//
// Run from web/: `npm run api:gen`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const SPEC_PATH = resolve(webRoot, '../backend/openapi/openapi.json');

export const OUT_PATH = resolve(webRoot, 'src/api/generated/schema.d.ts');

const REGEN = 'cd web && npm run api:gen';
const GEN_NOTE = `GENERATED from backend/openapi/openapi.json — do not edit by hand; regen: \`${REGEN}\`.`;

/** The full text of schema.d.ts derived from the current backend spec. */
export async function buildApiSchema() {
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
  const ast = await openapiTS(spec);
  return `// ${GEN_NOTE}\n/* eslint-disable */\n\n${astToString(ast)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, await buildApiSchema());
  console.log(`wrote ${OUT_PATH}`);
}
