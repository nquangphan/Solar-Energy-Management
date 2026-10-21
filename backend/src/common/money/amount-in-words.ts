/**
 * Integer dong → Vietnamese words for the "(Bằng chữ: …)" lines of a contract and the
 * "Số tiền viết bằng chữ" line of an invoice — PURE DOMAIN. Shared here, not owned by either
 * module, so `contracts/` and `invoices/` stay independent of each other.
 *
 * Wording follows the two company templates: group units `ngàn`/`triệu`/`tỷ`; `mươi`/`mười`;
 * `mốt` (1 after tens ≥ 2); `lăm` (5 after tens ≥ 1); `lẻ` (tens 0, units ≠ 0); a non-leading
 * group is read in full ("không trăm …"); an all-zero group is skipped; 0 ⇒ "Không đồng".
 *
 * Accepts integers 0 ≤ n < 10^15. Anything else is a programming error (money is integer dong
 * computed by the server), so it throws `RangeError` instead of printing a wrong sentence.
 */

const DIGITS = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
] as const;

const BILLION = 1_000_000_000;
const UPPER_BOUND = 1_000_000_000_000_000;

/** Reads 0..999. `full` = not the leading group, so the hundreds are always spoken. */
function readTriple(value: number, full: boolean): string[] {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const words: string[] = [];
  const hundredsSpoken = full || hundreds > 0;
  if (hundredsSpoken) words.push(DIGITS[hundreds], 'trăm');
  if (tens === 0) {
    if (units !== 0 && hundredsSpoken) words.push('lẻ');
  } else if (tens === 1) {
    words.push('mười');
  } else {
    words.push(DIGITS[tens], 'mươi');
  }
  if (units === 1 && tens >= 2) words.push('mốt');
  else if (units === 5 && tens >= 1) words.push('lăm');
  else if (units !== 0) words.push(DIGITS[units]);
  return words;
}

/** Reads 0 < value < 10^9 as triệu/ngàn/units groups. */
function readBelowBillion(value: number, leading: boolean): string[] {
  const groups = [
    { value: Math.floor(value / 1_000_000), unit: 'triệu' },
    { value: Math.floor((value % 1_000_000) / 1000), unit: 'ngàn' },
    { value: value % 1000, unit: '' },
  ];
  const words: string[] = [];
  let first = leading;
  for (const group of groups) {
    if (group.value === 0) {
      continue;
    }
    words.push(...readTriple(group.value, !first));
    if (group.unit !== '') words.push(group.unit);
    first = false;
  }
  return words;
}

function readWords(value: number, leading: boolean): string[] {
  if (value < BILLION) return readBelowBillion(value, leading);
  const billions = Math.floor(value / BILLION);
  const rest = value % BILLION;
  const words = [...readWords(billions, leading), 'tỷ'];
  if (rest > 0) words.push(...readBelowBillion(rest, false));
  return words;
}

export function amountInWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0 || amount >= UPPER_BOUND) {
    throw new RangeError(`amountInWords: out of range: ${amount}`);
  }
  if (amount === 0) return 'Không đồng';
  const sentence = `${readWords(amount, true).join(' ')} đồng`;
  return sentence.charAt(0).toLocaleUpperCase('vi') + sentence.slice(1);
}
