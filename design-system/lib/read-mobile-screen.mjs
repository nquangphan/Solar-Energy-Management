import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/** Files whose logic moved out of a mobile screen (Story 11.1, BLoC). */
const LOGIC_FILE = /_(cubit|state|bloc)\.dart$/;
const SCREEN_FILE = /_screen\.dart$/;

/**
 * The text of one mobile screen for a text-guard: the screen file + its own
 * `<screen>_cubit.dart` / `<screen>_state.dart` / `<screen>_bloc.dart` files (sorted by name, joined
 * with `\n`). Once a screen's logic moves to a cubit, a guard reading only the screen
 * file goes blind: "must contain" asserts turn red, "must not contain" asserts turn
 * falsely green.
 *
 * Only the screen's OWN logic files are read (`login_screen.dart` ⇒ `login_*`): a sibling
 * screen's cubit in the same folder would satisfy this screen's "must contain" asserts
 * (`auth/forgot_password_cubit.dart` says "Quên mật khẩu" for a login screen that lost its
 * link). A logic file that belongs to no `*_screen.dart` of its folder throws, so a
 * misnamed cubit can never hide from every guard.
 *
 * @param {string} repoRoot
 * @param {string} relPath screen file from the repo root, e.g. `mobile/lib/screens/auth/login_screen.dart`
 * @returns {string}
 */
export function readMobileScreen(repoRoot, relPath) {
  const screen = resolve(repoRoot, relPath);
  if (!existsSync(screen)) throw new Error(`mobile screen not found: ${relPath}`);
  if (!SCREEN_FILE.test(basename(screen))) throw new Error(`not a *_screen.dart file: ${relPath}`);
  const dir = dirname(screen);
  const names = readdirSync(dir);
  const stems = names.filter((name) => SCREEN_FILE.test(name)).map((name) => name.replace(SCREEN_FILE, '_'));
  // Longest stem wins: `order_list_cubit.dart` belongs to `order_list_screen.dart`, not `order_screen.dart`.
  const ownerOf = (name) =>
    stems.filter((stem) => name.startsWith(stem)).sort((a, b) => b.length - a.length)[0];
  const logic = names.filter((name) => LOGIC_FILE.test(name));
  const orphans = logic.filter((name) => ownerOf(name) === undefined);
  if (orphans.length > 0) {
    throw new Error(`${orphans.join(', ')} in ${dir} belong to no *_screen.dart — name them <screen>_cubit.dart / <screen>_state.dart`);
  }
  const own = basename(screen).replace(SCREEN_FILE, '_');
  const mine = logic.filter((name) => ownerOf(name) === own).sort();
  return [screen, ...mine.map((name) => join(dir, name))].map((p) => readFileSync(p, 'utf8')).join('\n');
}
