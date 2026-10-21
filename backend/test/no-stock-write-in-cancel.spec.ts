import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rawSqlWritePattern } from './util/raw-sql-write';
import { stripComments } from './util/strip-comments';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard AC-11 (Story 5.7): **đường huỷ đơn KHÔNG được chạm tồn kho** — không
 * `StockMovement`, không `StockItem`, không `onHand`, không `reserved`.
 *
 * Vì sao một guard chứ không chỉ một quyết định phạm vi ghi trong story: AC gốc đòi "huỷ
 * trước khi xuất kho ⇒ giải phóng reserved" và "huỷ sau khi xuất kho ⇒ KHÔNG tự cộng tồn,
 * phải tạo phiếu nhập trả". Không model tồn kho nào tồn tại ở thời điểm này (Epic 6.6), nên
 * nửa đầu chưa làm được, còn nửa sau là một mệnh lệnh PHỦ ĐỊNH có hiệu lực NGAY: đường huỷ
 * không được tự ý cộng/trừ tồn. Guard này giữ mệnh lệnh đó khi Epic 6 tới — người viết 6.7
 * sẽ nối vào event `OrderCancelled` thay vì nhét lệnh ghi tồn vào giữa `huyDon()`.
 *
 * Quét trên `stripToCode` (bỏ comment VÀ string): `reserved`/`onHand` là từ trần và chính
 * docstring giải thích guard này có nhắc tới chúng — không strip thì guard đỏ vì lời giải
 * thích của chính nó.
 */
describe('source-guard: đường huỷ đơn không chạm tồn kho (AC-11, Story 5.7)', () => {
  const SERVICE = resolve(__dirname, '../src/orders/orders.service.ts');

  /** Định danh tồn kho bị cấm trong thân `huyDon()` — cả hai lối viết hoa/thường. */
  const CAM = /StockMovement|stockMovement|StockItem|stockItem|onHand|reserved/;

  /**
   * Raw SQL writing a stock table. It lives in literals that `stripToCode` empties, so it is
   * matched on the body extracted from comment-stripped source instead.
   */
  const RAW_STOCK_WRITE = rawSqlWritePattern([
    'stock_items',
    'stock_movements',
  ]);

  /** Does the `huyDon()` body of `source` touch stock (Prisma identifier or raw SQL)? */
  function huyDonChamTon(source: string): boolean {
    return (
      CAM.test(thanMethod(stripToCode(source), 'huyDon')) ||
      RAW_STOCK_WRITE.test(thanMethod(stripComments(source), 'huyDon'))
    );
  }

  /**
   * Thân của method `ten` trong `code` (đã stripToCode), lấy bằng máy quét CÂN BẰNG NGOẶC.
   *
   * ⚠️ KHÔNG dùng `\{[^}]*\}`: dạng đó dừng ở dấu `}` lồng đầu tiên, mà thân `huyDon()` có
   * object literal lồng (`throw new AppException(..., [ { field: ... } ])`) — regex ngây thơ
   * cắt ở đó và bỏ qua toàn bộ phần sau, tức bỏ qua đúng chỗ một lệnh ghi tồn sẽ nằm.
   *
   * ⚠️ VÀ `{` đầu tiên sau ngoặc tham số KHÔNG phải thân hàm: `huyDon()` khai kiểu trả về
   * `Promise<{ status; occurredAt }>`, nên `{` đó thuộc KIỂU. Nhận diện bằng ký tự đứng
   * trước: `{` mở thân luôn theo sau `)`/`>`/`}` của phần khai báo, còn `{` của kiểu theo sau
   * `:`, `<`, `|`, `&` hoặc `,`.
   */
  function thanMethod(code: string, ten: string): string {
    const khai = new RegExp(`\\n {2}(?:async )?${ten}\\s*\\(`).exec(code);
    if (khai === null) return '';
    let i = khai.index + khai[0].length - 1;
    let tron = 0;
    for (; i < code.length; i++) {
      if (code[i] === '(') tron++;
      else if (code[i] === ')') {
        tron--;
        if (tron === 0) break;
      }
    }
    let moThan = -1;
    for (let j = i + 1; j < code.length; j++) {
      if (code[j] !== '{') continue;
      let k = j - 1;
      while (k >= 0 && /\s/.test(code[k])) k--;
      if (':<|&,'.includes(code[k])) {
        // `{` của một kiểu — nhảy qua trọn cụm rồi tìm tiếp.
        let nhon = 0;
        for (; j < code.length; j++) {
          if (code[j] === '{') nhon++;
          else if (code[j] === '}' && --nhon === 0) break;
        }
        continue;
      }
      moThan = j;
      break;
    }
    if (moThan === -1) return '';
    let nhon = 0;
    for (let j = moThan; j < code.length; j++) {
      if (code[j] === '{') nhon++;
      else if (code[j] === '}') {
        nhon--;
        if (nhon === 0) return code.slice(moThan + 1, j);
      }
    }
    return '';
  }

  function thanHuyDon(): string {
    return thanMethod(stripToCode(readFileSync(SERVICE, 'utf8')), 'huyDon');
  }

  it('thân `huyDon()` không chứa bất kỳ định danh tồn kho nào', () => {
    expect(thanHuyDon()).not.toMatch(CAM);
    expect(huyDonChamTon(readFileSync(SERVICE, 'utf8'))).toBe(false);
  });

  it('guard THỰC SỰ đọc được thân `huyDon()` (không xanh giả vì trích ra chuỗi rỗng)', () => {
    const than = thanHuyDon();
    expect(than.length).toBeGreaterThan(500);
    // Và nó đọc tới CUỐI thân, không cắt sớm ở object literal đầu tiên: `OrderCancelled`
    // được dựng ở gần cuối method.
    expect(than).toContain('OrderCancelled');
    expect(than).toContain('findScopedOrThrow');
    // The comment-stripped extraction (raw SQL scan) reads to the end too: string literals with
    // braces must not cut it short.
    const raw = thanMethod(
      stripComments(readFileSync(SERVICE, 'utf8')),
      'huyDon',
    );
    expect(raw.length).toBeGreaterThan(500);
    expect(raw).toContain('OrderCancelled');
  });

  describe('meta-test chống xanh giả — guard phải ĐỎ khi có gì để bắt', () => {
    /** Bản sao nguồn có nhét một lệnh ghi tồn vào giữa thân `huyDon()`. */
    function nguonDaNhiem(): string {
      const goc = readFileSync(SERVICE, 'utf8');
      // Neo phải DUY NHẤT và nằm TRONG `huyDon()`: `const occurredAt = new Date();` có ở cả
      // ba lane, `replace` sẽ nhét vào lane đầu tiên và meta-test xanh giả.
      const neo = 'const lyDo = input.lyDo.trim();';
      expect(goc.split(neo)).toHaveLength(2);
      return goc.replace(
        neo,
        `await this.prisma.stockItem.update({ data: { onHand: 1 } });\n    ${neo}`,
      );
    }

    it('nhét lệnh ghi tồn vào thân `huyDon()` ⇒ guard BẮT ĐƯỢC', () => {
      const than = thanMethod(stripToCode(nguonDaNhiem()), 'huyDon');
      expect(than).toMatch(CAM);
    });

    it('chỉ NHẮC `reserved` trong comment ⇒ guard vẫn XANH (không false-positive)', () => {
      const mau = [
        'class X {',
        '  async huyDon(id: string) {',
        '    // Giải phóng `reserved` thuộc Epic 6.7 — KHÔNG làm ở đây.',
        '    /* onHand cũng vậy: StockMovement chưa tồn tại. */',
        '    return id;',
        '  }',
        '}',
      ].join('\n');
      expect(thanMethod(stripToCode(mau), 'huyDon')).not.toMatch(CAM);
    });

    it('catches a raw SQL stock write in the body, ignores one mentioned in a comment', () => {
      const body = (line: string) =>
        [
          'class X {',
          '  async huyDon(id: string): Promise<{ status: string }> {',
          `    ${line}`,
          '    return { status: id };',
          '  }',
          '}',
        ].join('\n');
      for (const line of [
        'await tx.$executeRaw`UPDATE stock_items SET on_hand = on_hand + 1 WHERE id = ${id}`;',
        'await tx.$executeRawUnsafe(\'INSERT INTO "stock_movements" (id) VALUES ($1)\', id);',
      ]) {
        expect(huyDonChamTon(body(line))).toBe(true);
      }
      expect(
        huyDonChamTon(body('// never UPDATE stock_items here (Epic 6.7)')),
      ).toBe(false);
    });

    it('máy trích thân KHÔNG cắt sớm ở `}` lồng (nếu cắt, lệnh cấm phía sau sẽ lọt)', () => {
      const mau = [
        'class X {',
        '  async huyDon(id: string): Promise<{ status: string }> {',
        '    const x = { a: { b: 1 } };',
        '    await this.prisma.stockMovement.create({ data: { orderId: id } });',
        '    return { status: x };',
        '  }',
        '}',
      ].join('\n');
      expect(thanMethod(stripToCode(mau), 'huyDon')).toMatch(CAM);
    });
  });
});
