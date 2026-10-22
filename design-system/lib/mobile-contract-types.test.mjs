// The mobile-type readers resolve what a Dart port type REALLY is: an exact typedef reads the
// generated DTO, a projection class reads the fields it declares, and a hand-written copy of a
// DTO fails loudly instead of being reported as the contract type.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mobileAliasDto, mobileClassFields, mobileDtoFields, mobileDtoSource } from './mobile-contract-types.mjs';

test('the spec reader sees the DTO (not blind)', () => {
  const fields = mobileDtoFields('CustomerResponseDto');
  for (const f of ['phone', 'nationalId', 'custType', 'sourceId']) assert.ok(fields.includes(f), f);
  assert.throws(() => mobileDtoFields('NoSuchDto'), /no schema NoSuchDto/);
});

test('mobileAliasDto accepts only a typedef to a generated model', () => {
  assert.equal(mobileAliasDto('typedef Customer = CustomerResponseDto;\n', 'Customer'), 'CustomerResponseDto');
  for (const src of [
    'class Customer {\n  final String phone;\n}\n',
    'typedef Customer = Map<String, Object?>;\n',
    '// typedef Customer = CustomerResponseDto;\n',
  ]) {
    assert.throws(() => mobileAliasDto(src, 'Customer'), /exactly as a generated contract type/, src);
  }
  assert.throws(() => mobileAliasDto('typedef Customer = HandWrittenCustomer;\n', 'Customer'), /not a generated model/);
});

test('mobileClassFields reads own and inherited final fields', () => {
  const src = [
    'class Base {',
    '  const Base({required this.id});',
    '',
    '  final String id;',
    '}',
    '',
    'class Child extends Base {',
    '  final List<Item> items;',
    '  final int? warrantyMonths;',
    '}',
  ].join('\n');
  assert.deepEqual(mobileClassFields(src, 'Child'), ['id', 'items', 'warrantyMonths']);
  assert.throws(() => mobileClassFields('class Empty {\n  const Empty();\n}', 'Empty'), /reader went blind/);
  assert.throws(() => mobileClassFields(src, 'Missing'), /no class Missing/);
});

test('mobileDtoSource reads the generated model class, and only a generated one', () => {
  assert.match(mobileDtoSource('OrderResponseDto'), /^class OrderResponseDto \{$/m);
  assert.match(mobileDtoSource('OrderResponseDto'), /final num\? kWp;/);
  assert.throws(() => mobileDtoSource('NoSuchDto'), /not a generated model/);
});
