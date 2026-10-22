// The web-type readers resolve what a port type REALLY is: an exact alias reads the DTO, a
// Pick/Omit reads the narrowed field set, and anything glued on by hand fails loudly instead of
// being reported as the bare DTO (which would let an invented field or a rate slip past a guard).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generatedFields, webAliasDto, webTypeFields } from './web-contract-types.mjs';

const DTO = 'UpdateOrderRequestDto';

test('the generated reader sees the DTO (not blind)', () => {
  const fields = Object.keys(generatedFields(DTO));
  for (const f of ['vatMode', 'kWp', 'validityNote', 'scopeConstruction']) assert.ok(fields.includes(f), f);
});

test('webAliasDto accepts only an exact alias', () => {
  assert.equal(webAliasDto(`export type X = Schemas['${DTO}'];`, 'X'), DTO);
  for (const src of [
    `export type X = Schemas['${DTO}'] & { invented?: string };`,
    `export type X = Pick<Schemas['${DTO}'], 'kWp'> & { vatRate?: number };`,
    `export type X = Omit<Schemas['${DTO}'], 'kWp'>;`,
    `export type X = Partial<Schemas['${DTO}']>;`,
  ]) {
    assert.throws(() => webAliasDto(src, 'X'), /exactly as a generated contract type/, src);
  }
});

test('webTypeFields resolves Pick and Omit to the fields the type really has', () => {
  assert.deepEqual(
    Object.keys(webTypeFields(`export type X = Pick<\n  Schemas['${DTO}'],\n  'vatMode' | 'kWp'\n>;`, 'X')).sort(),
    ['kWp', 'vatMode'],
  );
  const omitted = Object.keys(webTypeFields(`export type X = Omit<Schemas['${DTO}'], 'kWp'>;`, 'X'));
  assert.ok(!omitted.includes('kWp') && omitted.includes('vatMode'));
  assert.deepEqual(webTypeFields(`export type X = Schemas['${DTO}'];`, 'X'), generatedFields(DTO));
});

test('webTypeFields refuses a hand-added field and a key the DTO lacks', () => {
  assert.throws(() => webTypeFields(`export type X = Pick<Schemas['${DTO}'], 'kWp'> & { vatRate?: number };`, 'X'), /Pick\/Omit/);
  assert.throws(() => webTypeFields(`export type X = Schemas['${DTO}'] & { invented?: string };`, 'X'), /Pick\/Omit/);
  assert.throws(() => webTypeFields(`export type X = Pick<Schemas['${DTO}'], 'vatRate'>;`, 'X'), /has no field vatRate/);
});
