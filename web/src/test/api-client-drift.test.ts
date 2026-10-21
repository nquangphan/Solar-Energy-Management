// @vitest-environment node
// Drift-guard for the generated API types (AD-12): the committed schema.d.ts must
// be exactly what buildApiSchema() derives from backend/openapi/openapi.json NOW.
// A backend contract change without `npm run api:gen` — or a hand edit of the
// generated file — turns this red. Same function as the generator script, so the
// two can never disagree on headers or formatting.
import { describe, expect, it } from 'vitest';

import { buildApiSchema } from '../../scripts/generate-api.mjs';
import committed from '../api/generated/schema.d.ts?raw';

describe('generated API schema', () => {
  it('matches the backend OpenAPI spec byte-for-byte', async () => {
    const fresh = await buildApiSchema();
    expect(committed === fresh).toBe(true);
  });

  it('is not blind: the output carries the real contract', async () => {
    const fresh = await buildApiSchema();
    expect(fresh).toContain('"/auth/login"');
    expect(fresh).toContain('ErrorEnvelopeDto');
    expect(fresh.split('\n').length).toBeGreaterThan(1000);
    expect(committed.length).toBeGreaterThan(0);
  });
});
