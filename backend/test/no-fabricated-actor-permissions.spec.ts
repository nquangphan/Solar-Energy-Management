import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard AD-7: **engine transition chỉ được nhận bộ quyền CỦA ACTOR THẬT.**
 *
 * `no-order-status-write-outside-transition` đã đóng đường ghi `Order.status` vòng qua engine.
 * Nhưng còn một đường vòng thứ hai mà guard đó không thấy: gọi ĐÚNG engine, với một bộ quyền
 * TỰ CHẾ. Kết quả y hệt việc không có guard nào — transition qua được mọi cổng, audit ghi tên
 * một người chưa từng có quyền ấy — mà mọi test hành vi vẫn xanh, vì hành vi đúng như code viết.
 *
 * Hai hình dạng bị cấm, tương ứng hai cách tự chế thực tế:
 *  1. Dựng bộ quyền NGAY TẠI call-site (`actorPermissions: new Set([...])`) — bắt bằng cách
 *     đòi giá trị phải là một ĐỊNH DANH/đường dẫn thuộc tính, tức một thứ nhận từ nơi khác.
 *  2. Dựng một hằng "toàn quyền" ở đâu đó rồi truyền tên hằng đó vào (qua được luật 1 vì tên
 *     hằng cũng là định danh) — bắt bằng cách cấm mọi biểu thức lấy nội dung permission
 *     registry ra làm tập hợp.
 *
 * ⚠️ HAI CỬA, KHÔNG PHẢI MỘT. Engine `applyTransition` là `private`, nên trong `orders/` nó là
 * cửa duy nhất. Nhưng `chuyenTrangThaiTuDong()` là cửa CÔNG KHAI mở cho `payments/` (7.2) và
 * `inventory/` (6.x): một module ngoài tự chế bộ quyền rồi gọi cửa đó đạt đúng hiệu quả bypass
 * mà guard này sinh ra để chặn — engine vẫn được gọi "đúng cách", chỉ là với quyền bịa. Quét
 * cả hai, nếu không thì guard chỉ canh cái cửa đã khoá sẵn và bỏ ngỏ cái cửa vừa mở.
 *
 * Cũng vì thế luật 2 quét TOÀN `src/`, không riêng `src/orders/`: hằng "toàn quyền" đặt ở
 * `src/payments/` rồi truyền sang cũng là cùng một cú bypass. Nơi DUY NHẤT được phép dựng bộ
 * quyền là `accounts/` (`AccountPermissionsService` đọc quyền THẬT của account từ DB) — chỗ đó
 * dựng từ `rows`, không từ registry, nên không dính luật này.
 *
 * Dùng `stripToCode` (bỏ comment VÀ string) như 8 guard hiện có: thứ bị cấm là CẤU TRÚC code,
 * không phải một chuỗi ký tự — nhắc `new Set` trong TSDoc không được làm guard đỏ.
 */
describe('source-guard: engine transition nhận quyền THẬT của actor (AD-7)', () => {
  const SRC_DIR = resolve(__dirname, '../src');

  function collectTsFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectTsFiles(full));
      } else if (entry.name.endsWith('.ts')) {
        files.push(full);
      }
    }
    return files;
  }

  /** Từ vị trí `(`, trả nội dung tham số tới `)` khớp (đếm cân bằng cả `(`, `{`, `[`). */
  function docThamSo(code: string, moNgoac: number): string {
    let sau = 0;
    for (let i = moNgoac; i < code.length; i++) {
      const c = code[i];
      if (c === '(' || c === '{' || c === '[') sau++;
      else if (c === ')' || c === '}' || c === ']') {
        sau--;
        if (sau === 0) return code.slice(moNgoac + 1, i);
      }
    }
    return code.slice(moNgoac + 1);
  }

  /**
   * Giá trị truyền cho `actorPermissions` ở mỗi call-site đưa quyền vào engine: engine private
   * `this.applyTransition(` VÀ cửa công khai `.chuyenTrangThaiTuDong(` mà module ngoài gọi.
   * Shorthand (`actorPermissions,`) trả về chính tên biến — đó là pass-through hợp lệ.
   *
   * Khai báo method (`async chuyenTrangThaiTuDong(input: {`) không khớp vì luật đòi dấu `.`
   * đứng trước — chỉ LỜI GỌI mới bị soi.
   */
  function docGiaTriQuyen(code: string): string[] {
    const giaTri: string[] = [];
    const re = /\bthis\.applyTransition\s*\(|\.chuyenTrangThaiTuDong\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const thamSo = docThamSo(code, m.index + m[0].length - 1);
      const key = /\bactorPermissions\s*(:)?/.exec(thamSo);
      if (key === null) {
        giaTri.push('<THIẾU>');
        continue;
      }
      if (key[1] === undefined) {
        giaTri.push('actorPermissions');
        continue;
      }
      // Đọc biểu thức tới dấu `,` hoặc `}` ở ĐỘ SÂU 0 — `new Set([a, b])` không bị cắt ở dấu
      // phẩy bên trong.
      const sauDauHai = key.index + key[0].length;
      let sau = 0;
      let ket = thamSo.length;
      for (let i = sauDauHai; i < thamSo.length; i++) {
        const c = thamSo[i];
        if (c === '(' || c === '{' || c === '[') sau++;
        else if (c === ')' || c === '}' || c === ']') {
          if (sau === 0) {
            ket = i;
            break;
          }
          sau--;
        } else if (c === ',' && sau === 0) {
          ket = i;
          break;
        }
      }
      giaTri.push(thamSo.slice(sauDauHai, ket).trim());
    }
    return giaTri;
  }

  /** Định danh trần hoặc đường dẫn thuộc tính — thứ NHẬN được, không phải thứ DỰNG ra. */
  const LA_DUONG_DAN = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

  /** Biểu thức lấy nội dung permission registry ra làm tập hợp (hình dạng "toàn quyền"). */
  function timDungTapQuyen(code: string): string[] {
    const ket: string[] = [];
    const re = /\bnew Set\s*\(|\bObject\.values\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const than = docThamSo(code, m.index + m[0].length - 1);
      if (/\bPERM\b/.test(than)) ket.push(`${m[0].trim()}${than.trim()})`);
    }
    return ket;
  }

  it('mọi call-site applyTransition truyền quyền NHẬN ĐƯỢC, không dựng tại chỗ', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(SRC_DIR)) {
      for (const gt of docGiaTriQuyen(
        stripToCode(readFileSync(file, 'utf8')),
      )) {
        if (!LA_DUONG_DAN.test(gt)) offenders.push(`${file} → ${gt}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('không nơi nào trong src/ dựng tập hợp từ permission registry', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(SRC_DIR)) {
      for (const bt of timDungTapQuyen(
        stripToCode(readFileSync(file, 'utf8')),
      )) {
        offenders.push(`${file} → ${bt}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('guard THỰC SỰ quét được engine (không xanh giả vì máy quét mù)', () => {
    const service = join(SRC_DIR, 'orders', 'orders.service.ts');
    const giaTri = docGiaTriQuyen(stripToCode(readFileSync(service, 'utf8')));
    // 5 call-site: chuyenTrangThaiTuDong, confirm, revise, applyDiscount, resolveDiscount.
    expect(giaTri.length).toBeGreaterThanOrEqual(5);
    // Và cửa auto (Story 5.2) truyền thẳng tham số của caller, không qua trung gian nào.
    expect(giaTri).toContain('input.actorPermissions');
  });

  describe('máy quét bắt đúng thứ nó phải bắt (guard không rỗng ruột)', () => {
    it('bắt bộ quyền dựng NGAY tại call-site', () => {
      const mau = [
        'class X {',
        '  async tuDong(id: string) {',
        '    await this.applyTransition(tx, {',
        '      order,',
        '      event,',
        '      actorPermissions: new Set([PERM.paymentsRecord, PERM.ordersConfirm]),',
        '      actorAccountId,',
        '    });',
        '  }',
        '}',
      ].join('\n');
      const [gt] = docGiaTriQuyen(stripToCode(mau));
      // Dấu phẩy BÊN TRONG `new Set([...])` không được cắt biểu thức làm đôi.
      expect(gt).toBe('new Set([PERM.paymentsRecord, PERM.ordersConfirm])');
      expect(LA_DUONG_DAN.test(gt)).toBe(false);
    });

    it('bắt bộ quyền tự chế truyền vào CỬA CÔNG KHAI (đường của payments/ ở 7.2)', () => {
      // Module ngoài không chạm `applyTransition` được (nó private) — nó gọi cửa auto. Quét
      // sót cửa này là bỏ ngỏ đúng con đường mà story 5.2 vừa mở.
      const mau = [
        'class FakePaymentsService {',
        '  async ghiNhan(orderId: string, actorAccountId: string) {',
        '    await this.ordersService.chuyenTrangThaiTuDong({',
        '      orderId,',
        '      event: SU_KIEN.duCoc,',
        '      actorAccountId,',
        '      actorPermissions: new Set(Object.values(PERM)),',
        '    });',
        '  }',
        '}',
      ].join('\n');
      const [gt] = docGiaTriQuyen(stripToCode(mau));
      expect(gt).toBe('new Set(Object.values(PERM))');
      expect(LA_DUONG_DAN.test(gt)).toBe(false);
    });

    it('bắt hằng "toàn quyền" dựng NGOÀI orders/ rồi truyền vào cửa công khai', () => {
      // Luật 2 phải quét toàn `src/`: đẩy hằng sang `src/payments/` là cùng một cú bypass.
      const mau = [
        'const TOAN_QUYEN = new Set(Object.values(PERM));',
        'class FakePaymentsService {',
        '  async ghiNhan(orderId: string) {',
        '    await this.ordersService.chuyenTrangThaiTuDong({ actorPermissions: TOAN_QUYEN });',
        '  }',
        '}',
      ].join('\n');
      expect(docGiaTriQuyen(stripToCode(mau))).toEqual(['TOAN_QUYEN']);
      expect(timDungTapQuyen(stripToCode(mau))).toHaveLength(2);
    });

    it('bắt hằng "toàn quyền" dù nó được truyền vào dưới dạng một định danh sạch', () => {
      const mau = [
        'const TOAN_QUYEN = new Set(Object.values(PERM));',
        'class X {',
        '  async tuDong(id: string) {',
        '    await this.applyTransition(tx, { actorPermissions: TOAN_QUYEN });',
        '  }',
        '}',
      ].join('\n');
      // Luật 1 tha nó — nó đúng là một định danh.
      expect(docGiaTriQuyen(stripToCode(mau))).toEqual(['TOAN_QUYEN']);
      // Luật 2 mới là thứ bắt được: chỗ hằng ấy được DỰNG.
      expect(timDungTapQuyen(stripToCode(mau))).toHaveLength(2);
    });

    it('THA pass-through hợp lệ: định danh trần, shorthand, và đường dẫn thuộc tính', () => {
      const mau = [
        'class X {',
        '  async a() { await this.applyTransition(tx, { actorPermissions }); }',
        '  async b() { await this.applyTransition(tx, { actorPermissions: input.actorPermissions }); }',
        '  async c() { await this.applyTransition(tx, { actorPermissions: quyen }); }',
        '}',
      ].join('\n');
      for (const gt of docGiaTriQuyen(stripToCode(mau))) {
        expect(LA_DUONG_DAN.test(gt)).toBe(true);
      }
    });

    it('THA `new Set` dedup id thường — chỉ tập hợp DỰNG TỪ registry mới bị cấm', () => {
      const mau = 'const ids = [...new Set(lines.map((l) => l.productId))];';
      expect(timDungTapQuyen(stripToCode(mau))).toEqual([]);
    });

    it('KHÔNG đỏ vì một chuỗi/comment nhắc tới hình dạng bị cấm', () => {
      const mau = [
        '// actorPermissions: new Set(Object.values(PERM)) là thứ bị cấm.',
        'const ghiChu = "actorPermissions: new Set(Object.values(PERM))";',
        'class X {',
        '  async a() { await this.applyTransition(tx, { actorPermissions }); }',
        '}',
      ].join('\n');
      const code = stripToCode(mau);
      expect(timDungTapQuyen(code)).toEqual([]);
      expect(docGiaTriQuyen(code)).toEqual(['actorPermissions']);
    });
  });
});
