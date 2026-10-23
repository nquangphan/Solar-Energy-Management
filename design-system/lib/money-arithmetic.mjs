/**
 * Regex fragments for the "client computes no money" text-guards. A money name and
 * its operator are rarely adjacent in real code: a cast, a null-aware access or a
 * default sits between them (`orderTotal.toInt() - x`, `y - (s?.paidTotal ?? 0)`).
 * A ban that needs the name right next to the operator is blind to all of those.
 */

/**
 * What may follow a money name before the operator: `!`, `.x` / `?.x`, `()`, `[i]`,
 * `?? 0`, a closing `)`.
 */
export const AFTER_FIGURE = String.raw`(?:!|\??\.\w+|\(\)|\[[^\]\n]*\]|\s*\?\?\s*[\w.]+|\s*\))*`;

/** What may precede a money name after the operator: `(`, `s?.`, `x!.`, `a[i].`. */
export const BEFORE_FIGURE = String.raw`[\s(]*[\w.!?\[\]]*`;

/**
 * The two bans: arithmetic ON a money figure (figure left of the operator) and
 * arithmetic ONTO one (figure right of it). `money` is a regex alternation; matched
 * case-insensitively inside a word, so `amount` also covers `paidAmount`.
 *
 * @param {string} money e.g. `(?:amount|orderTotal)`
 * @returns {Array<[RegExp, string]>}
 */
export function moneyArithmeticBans(money) {
  return [
    [new RegExp(String.raw`\b\w*${money}\w*${AFTER_FIGURE}\s*[-+*/]\s*[\w(]`, 'i'), 'arithmetic on a money figure'],
    [new RegExp(String.raw`[-+*/]${BEFORE_FIGURE}${money}\b`, 'i'), 'arithmetic onto a money figure'],
  ];
}
