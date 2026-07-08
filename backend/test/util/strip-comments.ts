/**
 * Bỏ CHỈ comment (`//…`, `/* … *\/`) khỏi file TS, GIỮ NGUYÊN string/template literal.
 *
 * Khác `stripToCode` (bỏ CẢ string): source-guard "không literal ngoài registry" cần
 * SOI string literal (`'orders.view_all'`) nên KHÔNG được bỏ string — chỉ bỏ comment để
 * TSDoc nhắc key mà không false-positive. Cùng máy trạng thái quét trái→phải: khi gặp
 * string thì COPY nguyên (kể cả nội dung) thay vì nuốt; `//`/`/*` bên trong string không
 * mở comment; escape `\` trong string được bỏ qua đúng.
 */
export function stripComments(source: string): string {
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
      out += c;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') {
          out += source[i];
          i++;
        }
        out += source[i];
        i++;
      }
      out += source[i]; // quote đóng
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
