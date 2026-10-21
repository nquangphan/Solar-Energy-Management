// Parity lane for the money formatter. ONE fixture table (vnd-format-cases.json)
// is the contract for both clients:
//   - web: this file imports the real web/src/design-system/components/format-vnd.ts
//     (Node strips the types) and checks every case byte-for-byte;
//   - Flutter: mobile/test/design_system/components/money_text_test.dart reads the
//     SAME json and checks the Dart formatVnd — asserted below so the two lanes
//     cannot drift onto separate tables.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertScanned } from '../lib/assert-scanned.mjs';
import { stripComments } from '../lib/strip-comments.mjs';
import { repoRoot } from './money-fields.mjs';
import { formatVnd } from '../../web/src/design-system/components/format-vnd.ts';

const FIXTURE = 'design-system/money/vnd-format-cases.json';
const { cases } = JSON.parse(readFileSync(resolve(repoRoot, FIXTURE), 'utf8'));
const webSrc = readFileSync(resolve(repoRoot, 'web/src/design-system/components/format-vnd.ts'), 'utf8');
const dartSrc = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/components/money_text.dart'), 'utf8');
const flutterTest = readFileSync(
  resolve(repoRoot, 'mobile/test/design_system/components/money_text_test.dart'),
  'utf8',
);

test('the fixture covers the decided boundary values', () => {
  assertScanned(cases, 9, 'money format cases');
  const inputs = cases.map((c) => c.input);
  for (const v of [0, 5, 999, 1000, 1000000, 83010960, 1250000000, -1500000, 999999999999]) {
    assert.ok(inputs.includes(v), `fixture must include ${v}`);
  }
  // The decided format, spelled out: "." groups, ONE U+0020 space, lowercase "đ".
  for (const { expected } of cases) {
    assert.match(expected, /^-?\d{1,3}(?:\.\d{3})* đ$/, `"${expected}" breaks the "83.010.960 đ" format`);
  }
});

test('web formatVnd matches every fixture case byte-for-byte', () => {
  for (const { input, expected } of cases) {
    assert.equal(formatVnd(input), expected, `formatVnd(${input})`);
  }
  assert.equal(formatVnd(-0), '0 đ', '-0 must display as 0 đ');
});

test('web formatVnd throws on non-integer / non-finite / unsafe input (never guesses)', () => {
  for (const bad of [1.5, -0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => formatVnd(bad), RangeError, `formatVnd(${bad}) must throw`);
  }
});

test('the Flutter test consumes the SAME fixture and runs formatVnd over it', () => {
  assert.ok(flutterTest.includes(FIXTURE.replace('design-system/', '')), 'money_text_test.dart must read vnd-format-cases.json');
  assert.ok(/formatVnd\(/.test(flutterTest), 'money_text_test.dart must call formatVnd');
});

test('both formatters group by string only — no locale API, no arithmetic', () => {
  for (const [name, src] of [['format-vnd.ts', webSrc], ['money_text.dart', dartSrc]]) {
    const code = stripComments(src);
    assert.ok(
      !/toLocaleString|\bIntl\b|NumberFormat|package:intl\/|toFixed/.test(code),
      `${name} must not use locale formatting — formatting goes through formatVnd only`,
    );
    assert.ok(!/value\s*[-+*/%~]|[-+*/%]\s*value\b|Math\./.test(code), `${name} must not do arithmetic on the money value`);
  }
});
