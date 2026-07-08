/**
 * Giữ lại CHỈ vùng CODE của một file TS để source-guard quét (dùng chung bởi mọi
 * source-guard: `no-manual-prisma-client`, `no-controller-error-envelope`, …). Máy
 * trạng thái quét trái→phải (KHÔNG dùng hai lần replace regex độc lập — đổi thứ tự chỉ
 * hoán vị false-negative giữa chuỗi trong string và dấu nháy trong comment). Bỏ nguyên
 * comment và string/template literal, chỉ append ký tự code:
 *  - comment/docstring nhắc chuỗi bị cấm KHÔNG tính (chống false-positive).
 *  - `//` hay dấu nháy BÊN TRONG string literal không mở comment/không nuốt code
 *    (chống false-negative). Escape `\` trong string được bỏ qua đúng.
 *
 * Đã qua review đối kháng ở Story 2.1 (obs 14430/14438) — TÁI DÙNG, không viết lại.
 */
export function stripToCode(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      i += 2;
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') i++; // bỏ qua ký tự escape
        i++;
      }
      i++; // bỏ qua quote đóng
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
