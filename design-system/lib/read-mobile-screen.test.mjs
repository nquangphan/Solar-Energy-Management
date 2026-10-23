import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readMobileScreen } from './read-mobile-screen.mjs';

function withTree(files, check) {
  const root = mkdtempSync(join(tmpdir(), 'read-mobile-screen-'));
  mkdirSync(join(root, 'screens/auth'), { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, 'screens/auth', name), text);
  try {
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("joins the screen with its own cubit/state/bloc files, sorted, and nothing else", () => {
  withTree(
    {
      'login_screen.dart': 'SCREEN',
      'login_state.dart': 'STATE',
      'login_cubit.dart': 'CUBIT',
      'login_bloc.dart': 'BLOC',
      'forgot_password_screen.dart': 'OTHER SCREEN',
      'forgot_password_cubit.dart': 'OTHER CUBIT',
      'helpers.dart': 'HELPER',
      'notes.md': 'NOTES',
    },
    (root) => {
      assert.equal(readMobileScreen(root, 'screens/auth/login_screen.dart'), 'SCREEN\nBLOC\nCUBIT\nSTATE');
      assert.equal(readMobileScreen(root, 'screens/auth/forgot_password_screen.dart'), 'OTHER SCREEN\nOTHER CUBIT');
    },
  );
});

test('a logic file goes to the longest matching screen name', () => {
  withTree(
    {
      'order_screen.dart': 'ORDER',
      'order_cubit.dart': 'ORDER CUBIT',
      'order_list_screen.dart': 'LIST',
      'order_list_cubit.dart': 'LIST CUBIT',
    },
    (root) => {
      assert.equal(readMobileScreen(root, 'screens/auth/order_screen.dart'), 'ORDER\nORDER CUBIT');
      assert.equal(readMobileScreen(root, 'screens/auth/order_list_screen.dart'), 'LIST\nLIST CUBIT');
    },
  );
});

test('a cubit that belongs to no screen of its folder throws (it would hide from every guard)', () => {
  withTree({ 'login_screen.dart': 'SCREEN', 'auth_cubit.dart': 'CUBIT' }, (root) => {
    assert.throws(() => readMobileScreen(root, 'screens/auth/login_screen.dart'), /auth_cubit\.dart .* belong to no \*_screen\.dart/);
  });
});

test('a missing screen or a non-screen file throws (a guard must never read an empty text)', () => {
  withTree({ 'login_cubit.dart': 'CUBIT', 'helpers.dart': 'HELPER' }, (root) => {
    assert.throws(() => readMobileScreen(root, 'screens/auth/login_screen.dart'), /mobile screen not found/);
    assert.throws(() => readMobileScreen(root, 'screens/auth/helpers.dart'), /not a \*_screen\.dart file/);
  });
});
