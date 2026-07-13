// RUNTIME tests for the web `FakeCustomerSourcesPort` (Story 3.5).
//
// Every other test guarding the web half of this story reads source files AS TEXT — it can
// prove a string is present, never that a line of code does what it claims. This file is
// different: it IMPORTS the port and RUNS it. Node strips the types (the file uses no TS-only
// syntax), so no bundler, no tsc, no JSDOM is needed.
//
// Why the fake deserves real tests even though it is not the server: the config screen renders
// against THIS object in every demo and in every future screen test. When it drifts from the
// backend's answers, the screen is exercised against a lie — the row lands in the wrong place,
// the flagged row looks switch-off-able, a cleared description comes back as the old one. The
// server stays right; the screen built on top of the fake does not. So the assertions below are
// deliberately the SAME rules the backend service is held to, applied to the stand-in.
//
// The fake is not where the rules are ENFORCED (AD-4: the server rejects these calls even if
// every line of the fake were deleted). It is where the rules are MODELLED.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeCustomerSourcesPort,
  DEMO_CUSTOMER_SOURCE_ROWS,
} from '../../web/src/design-system/session/fake-customer-sources-port.ts';

/** A fresh port each time — tests must not inherit each other's writes. */
function port(rows) {
  return rows === undefined
    ? new FakeCustomerSourcesPort()
    : new FakeCustomerSourcesPort(rows);
}

const KHAC = DEMO_CUSTOMER_SOURCE_ROWS.find((r) => r.isOther);
const DAI_LY = DEMO_CUSTOMER_SOURCE_ROWS.find((r) => !r.active);
const FACEBOOK = DEMO_CUSTOMER_SOURCE_ROWS.find((r) => r.name === 'Facebook');

/** The demo catalogue must itself model the seed: exactly one flagged row. */
test('demo catalogue carries EXACTLY ONE isOther row (the seed invariant, modelled)', () => {
  const flagged = DEMO_CUSTOMER_SOURCE_ROWS.filter((r) => r.isOther);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].name, 'Khác');
});

test('list() hides switched-off rows and sorts by sortOrder (dropdown for a NEW customer)', async () => {
  const rows = await port().list(false);

  assert.ok(
    rows.every((r) => r.active),
    'a switched-off row reached the new-customer dropdown',
  );
  assert.deepEqual(
    rows.map((r) => r.sortOrder),
    [...rows.map((r) => r.sortOrder)].sort((a, b) => a - b),
  );
});

test('list(true) includes switched-off rows — the config screen must see them to switch them back on', async () => {
  const rows = await port().list(true);

  assert.equal(rows.length, DEMO_CUSTOMER_SOURCE_ROWS.length);
  assert.ok(rows.some((r) => !r.active));
});

test('create() with no sortOrder appends to the END (max + 1) — the client never picks the order', async () => {
  const p = port();
  const highest = Math.max(...DEMO_CUSTOMER_SOURCE_ROWS.map((r) => r.sortOrder));

  const created = await p.create({ name: 'TikTok' });

  assert.equal(created.sortOrder, highest + 1);
});

test('create() honours sortOrder 0 — zero is a POSITION, not "absent"', async () => {
  const created = await port().create({ name: 'TikTok', sortOrder: 0 });

  assert.equal(created.sortOrder, 0);
});

test('create() always returns an ACTIVE row', async () => {
  const created = await port().create({ name: 'TikTok' });

  assert.equal(created.active, true);
});

test('create() NEVER sets the isOther flag — even when the caller pushes one in', async () => {
  const created = await port().create({ name: 'TikTok', isOther: true });

  assert.equal(created.isOther, false);
});

test('create() rejects a duplicate name with the error shape the screen pins to the field', async () => {
  await assert.rejects(
    () => port().create({ name: FACEBOOK.name }),
    (err) => {
      assert.match(err.message, /Đã có nguồn khách tên/);
      assert.equal(err.fieldErrors[0].field, 'name');
      return true;
    },
  );
});

test('update() leaves an ABSENT key alone, and clears the description on an explicit null', async () => {
  const p = port();

  const untouched = await p.update(FACEBOOK.id, { sortOrder: 7 });
  assert.equal(untouched.name, FACEBOOK.name, 'an absent name overwrote the stored one');
  assert.equal(untouched.description, FACEBOOK.description);

  const cleared = await p.update(FACEBOOK.id, { description: null });
  assert.equal(cleared.description, null, 'null must CLEAR the description, not be ignored');
});

test('update() honours sortOrder 0 (guards `??` against a `||` regression)', async () => {
  const updated = await port().update(FACEBOOK.id, { sortOrder: 0 });

  assert.equal(updated.sortOrder, 0);
});

// The crux of the whole design: "Khác" is recognised by the FLAG, never by its name — so the
// label is free to change and Story 3.3's "picked Khác ⇒ sourceNote required" rule survives it.
test('update() RENAMES the flagged row and the flag survives untouched', async () => {
  const p = port();

  const renamed = await p.update(KHAC.id, { name: 'Nguồn khác' });

  assert.equal(renamed.name, 'Nguồn khác');
  assert.equal(renamed.isOther, true, 'the flag fell off during a rename');
});

test('update() rejects a name already held by ANOTHER row, but lets a row keep its own', async () => {
  const p = port();

  await assert.rejects(() => p.update(FACEBOOK.id, { name: KHAC.name }));

  const same = await p.update(FACEBOOK.id, { name: FACEBOOK.name });
  assert.equal(same.name, FACEBOOK.name, 'a row was blocked from re-saving its own name');
});

test('deactivate() REFUSES the flagged row — switching it off would kill the sourceNote rule', async () => {
  const p = port();

  await assert.rejects(
    () => p.deactivate(KHAC.id),
    (err) => {
      assert.match(err.message, /Không tắt được nguồn "Khác"/);
      return true;
    },
  );

  const rows = await p.list(true);
  assert.equal(rows.find((r) => r.id === KHAC.id).active, true, 'the flagged row went dark anyway');
});

test('deactivate() switches a row OFF without deleting it — the row stays readable', async () => {
  const p = port();

  await p.deactivate(FACEBOOK.id);

  const all = await p.list(true);
  const gone = await p.list(false);
  assert.equal(
    all.find((r) => r.id === FACEBOOK.id).active,
    false,
    'the row was not switched off',
  );
  assert.ok(
    all.some((r) => r.id === FACEBOOK.id),
    'the row was DELETED — soft-delete is the only path (old customers still point at it)',
  );
  assert.ok(!gone.some((r) => r.id === FACEBOOK.id), 'a switched-off row still shows to a new customer');
});

test('reactivate() puts a switched-off row back into the new-customer dropdown', async () => {
  const p = port();

  const back = await p.reactivate(DAI_LY.id);

  assert.equal(back.active, true);
  const visible = await p.list(false);
  assert.ok(visible.some((r) => r.id === DAI_LY.id));
});

test('an unknown id is rejected on every write path, never silently ignored', async () => {
  const p = port();

  await assert.rejects(() => p.update('src-khong-co', { name: 'X' }));
  await assert.rejects(() => p.deactivate('src-khong-co'));
  await assert.rejects(() => p.reactivate('src-khong-co'));
});

test('an EMPTY catalogue is a real state: list is empty and the first row starts at 0', async () => {
  const p = port([]);

  assert.deepEqual(await p.list(true), []);

  const first = await p.create({ name: 'TikTok' });
  assert.equal(first.sortOrder, 0, 'the first row of an empty catalogue must be 0, not NaN');
});
