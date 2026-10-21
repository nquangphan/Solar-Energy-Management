// hand-authored — the ONE money formatter on web. Its Flutter twin is
// `formatVnd` in mobile/lib/design_system/components/money_text.dart; both are
// pinned byte-for-byte to design-system/money/vnd-format-cases.json.

/**
 * Format an integer amount of đồng for display: `83010960` → `"83.010.960 đ"`,
 * `0` → `"0 đ"`, `-1500000` → `"-1.500.000 đ"` ("." groups thousands, then ONE
 * regular space and a lowercase "đ").
 *
 * Presentation only, never arithmetic (AD-10/16): the digits come from
 * `String(value)` and are grouped by string manipulation. Intl /
 * toLocaleString / NumberFormat are deliberately not used — their output
 * differs per runtime/locale, and the Flutter twin must produce the exact same
 * bytes.
 *
 * Money is an integer number of đồng (AD-10). Anything else (a fraction, NaN,
 * ±Infinity, or an integer beyond Number.MAX_SAFE_INTEGER whose digits are no
 * longer exact) THROWS a RangeError instead of rendering a guess: a fractional
 * amount means the backend contract broke, and showing "1.234,5 đ" or "NaN đ"
 * would hide that.
 */
export function formatVnd(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`formatVnd expects a safe integer amount of đồng, got ${String(value)}`);
  }
  // String(-0) is "0", so -0 renders as "0 đ".
  const raw = String(value);
  const negative = raw.startsWith('-');
  const digits = negative ? raw.slice(1) : raw;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped} đ`;
}
