import assert from 'node:assert/strict';

/**
 * Chống guard rỗng (E-7): một guard "không được có X" lặp qua tập các thứ nó quét; nếu bộ trích
 * (regex/glob/strip) hỏng và trả TẬP RỖNG thì vòng lặp không chạy lần nào và guard xanh vĩnh viễn.
 * Bọc tập được quét bằng hàm này: đỏ khi số phần tử quét được < `min`.
 *
 * `min` là số ĐO THẬT trên cây hiện tại, hạ lỏng một chút (xem comment ở nơi gọi) — đo TẬP ĐƯỢC
 * QUÉT, không phải số vi phạm (vi phạm luôn kỳ vọng 0).
 *
 * @template T
 * @param {readonly T[]} items
 * @param {number} min
 * @param {string} what
 * @returns {readonly T[]}
 */
export function assertScanned(items, min, what) {
  assert.ok(
    items.length >= min,
    `${what}: scanned ${items.length}, expected >= ${min} — the extractor went blind ` +
      `(an empty scan set makes a "must not contain" guard pass vacuously)`,
  );
  return items;
}

/**
 * Cùng ý với `assertScanned` nhưng cho source đã strip: `[[tên, code], ...]` — mỗi `code` phải còn
 * ít nhất `minChars` ký tự. Một bộ strip ăn nhầm (regex `/*` nuốt tới hết file, `//` cắt giữa dòng
 * code) làm "không được chứa X" xanh vì code đã bị xoá, không phải vì code sạch.
 *
 * @param {ReadonlyArray<readonly [string, string]>} entries
 * @param {number} minChars
 * @param {string} what
 */
export function assertCodeNotBlind(entries, minChars, what) {
  assertScanned(entries, 1, `${what} (entry count)`);
  for (const [name, code] of entries) {
    assert.ok(
      code.length >= minChars,
      `${what}: ${name} has only ${code.length} chars of code after stripping, expected >= ${minChars} — ` +
        `the stripper ate the source, so every "must not contain" check on it is vacuous`,
    );
  }
}
