import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard AD-11 (cùng khuôn 7 guard hiện có): quét `src/` → **KHÔNG lệnh ghi Prisma nào
 * trên `order` được mang `status` trong `data`**, ngoài hai chỗ được allowlist tường minh.
 *
 * Đây là thứ biến "applyTransition là con đường DUY NHẤT ghi Order.status" từ một lời hứa
 * trong TSDoc thành một bất biến kiểm chứng được. Không có guard này, điểm ghi thứ hai chỉ
 * cần một lần copy-paste là lọt vào, và mọi guard permission/audit của engine bị đi vòng.
 *
 * Dùng `stripToCode` (bỏ comment VÀ string) vì thứ bị cấm ở đây là một **định danh** trong
 * cấu trúc code (`status` làm key của `data`), không phải một chuỗi. Hệ quả phải nhớ: viết
 * `'dachot'` trong regex sẽ KHÔNG BAO GIỜ khớp — string đã bị xoá sạch trước khi quét.
 *
 * Tìm lệnh ghi bằng máy quét cân bằng ngoặc, KHÔNG bằng regex `\{[^}]*\}`: dạng regex ấy cắt
 * sớm ở dấu `}` đầu tiên nên một `data` có object lồng (hoặc một generic `Array<{…}>` chen
 * giữa) sẽ bị đọc hụt và guard xanh giả.
 */
describe('source-guard: chỉ applyTransition ghi Order.status (AD-11)', () => {
  const SRC_DIR = resolve(__dirname, '../src');

  /** Lệnh ghi Prisma có thể mang `data` — `create` cũng nằm đây rồi lọc bằng allowlist. */
  const LENH_GHI = ['create', 'createMany', 'update', 'updateMany', 'upsert'];

  /**
   * Hai chỗ ĐƯỢC PHÉP mang `status` trong `data` của một lệnh ghi trên `order` — khoá theo
   * CẶP (method, lệnh ghi), KHÔNG theo tên method trần:
   *  - `applyTransition` — CHÍNH là engine, tức là bất biến chứ không phải ngoại lệ.
   *  - `create` + đúng lệnh `order.create` — INSERT trạng thái khởi tạo lúc tạo đơn. Không
   *    phải chuyển trạng thái: không có `from`, không có gì để gate, không có vết from→to.
   *
   * Vì sao phải kèm tên lệnh ghi: `create` là tên method PHỔ BIẾN NHẤT trong codebase (mọi
   * service/controller đều có một cái). Allowlist tên trần sẽ tha cho một `order.updateMany`
   * đổi status nằm trong bất kỳ `create()` nào của bất kỳ module nào — đúng cái lỗ mà AC-4
   * nói là không có.
   */
  const CHO_PHEP = new Set(['applyTransition|*', 'create|create']);

  /** Cặp này có được tha không? Engine tha mọi lệnh ghi; `create` chỉ tha đúng INSERT. */
  function duocPhep(method: string, lenhGhi: string): boolean {
    return CHO_PHEP.has(`${method}|*`) || CHO_PHEP.has(`${method}|${lenhGhi}`);
  }

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

  /** Từ vị trí `(`, trả về nội dung tham số tới `)` khớp (đếm cân bằng cả `(` lẫn `{`). */
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

  /** Object literal đứng sau `data:` có mang key `status` không? */
  function dataCoStatus(thamSo: string): boolean {
    const re = /\bdata\s*:\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(thamSo)) !== null) {
      const than = docThamSo(thamSo, m.index + m[0].length - 1);
      if (/(^|[\s,{])status\s*:/.test(than)) return true;
    }
    return false;
  }

  /** Tên method (thành viên class) bao quanh vị trí `viTri`, hoặc `<top-level>`. */
  function methodBaoQuanh(code: string, viTri: number): string {
    const re =
      /\n {2}(?:private |protected |public )?(?:async )?([A-Za-z_$][\w$]*)\s*\(/g;
    let ten = '<top-level>';
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      if (m.index > viTri) break;
      ten = m[1];
    }
    return ten;
  }

  /** Mọi lệnh ghi trên `order` mang `status` trong `data`, kèm method + tên lệnh ghi. */
  function timDiemGhiStatus(
    code: string,
  ): { method: string; lenhGhi: string }[] {
    const ket: { method: string; lenhGhi: string }[] = [];
    const re = new RegExp(`\\.order\\.(${LENH_GHI.join('|')})\\s*\\(`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const moNgoac = m.index + m[0].length - 1;
      if (dataCoStatus(docThamSo(code, moNgoac))) {
        ket.push({ method: methodBaoQuanh(code, m.index), lenhGhi: m[1] });
      }
    }
    return ket;
  }

  it('không file src/ nào ghi Order.status ngoài applyTransition (ngoại lệ: create lúc INSERT)', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(SRC_DIR)) {
      for (const diem of timDiemGhiStatus(
        stripToCode(readFileSync(file, 'utf8')),
      )) {
        if (!duocPhep(diem.method, diem.lenhGhi)) {
          offenders.push(`${file} → ${diem.method}() : order.${diem.lenhGhi}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('guard THỰC SỰ quét src/ (không xanh giả vì danh sách file rỗng)', () => {
    const files = collectTsFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    // Và nó thực sự nhìn thấy engine: đúng chỗ được allowlist phải bị máy quét BẮT ĐƯỢC,
    // nếu không thì "0 offender" chỉ có nghĩa là máy quét mù.
    const service = files.find((f) => f.endsWith('orders/orders.service.ts'));
    expect(service).toBeDefined();
    const methods = timDiemGhiStatus(
      stripToCode(readFileSync(service as string, 'utf8')),
    ).map((d) => d.method);
    expect(methods).toContain('applyTransition');
    expect(methods).toContain('create');
  });

  describe('máy quét bắt đúng thứ nó phải bắt (guard không rỗng ruột)', () => {
    it('bắt lệnh ghi status ở một method khác', () => {
      const mau = [
        'class X {',
        '  async huyDon(id: string) {',
        '    await this.prisma.order.updateMany({',
        '      where: { id },',
        '      data: { status: TRANG_THAI_HUY },',
        '    });',
        '  }',
        '}',
      ].join('\n');
      expect(timDiemGhiStatus(stripToCode(mau))).toEqual([
        { method: 'huyDon', lenhGhi: 'updateMany' },
      ]);
    });

    it('bắt được kể cả khi `data` có object LỒNG đứng trước (chống cắt sớm ở `}`)', () => {
      const mau = [
        'class X {',
        '  async lachLuat(id: string) {',
        '    await this.prisma.order.update({',
        '      where: { id },',
        '      data: {',
        '        currentVersion: { connect: { id: v } },',
        '        status: moi,',
        '      },',
        '    });',
        '  }',
        '}',
      ].join('\n');
      expect(timDiemGhiStatus(stripToCode(mau))).toEqual([
        { method: 'lachLuat', lenhGhi: 'update' },
      ]);
    });

    it('KHÔNG tha một `create()` ĐỔI status — allowlist khoá theo cặp (method, lệnh ghi)', () => {
      // `create` là tên method phổ biến nhất codebase; tha tên trần là mở cửa cho một điểm
      // ghi thứ hai núp trong `create()` của bất kỳ module nào.
      const mau = [
        'class X {',
        '  async create(id: string) {',
        '    await this.prisma.order.updateMany({',
        '      where: { id },',
        '      data: { status: TRANG_THAI_DA_CHOT },',
        '    });',
        '  }',
        '}',
      ].join('\n');
      const [diem] = timDiemGhiStatus(stripToCode(mau));
      expect(diem).toEqual({ method: 'create', lenhGhi: 'updateMany' });
      expect(duocPhep(diem.method, diem.lenhGhi)).toBe(false);
      // Còn đúng INSERT lúc tạo đơn thì vẫn được tha.
      expect(duocPhep('create', 'create')).toBe(true);
    });

    it('KHÔNG bắt lệnh ghi chỉ ĐỌC status trong `where` (đó không phải ghi)', () => {
      const mau = [
        'class X {',
        '  async doiConTro(id: string) {',
        '    await this.prisma.order.updateMany({',
        '      where: { id, status: TRANG_THAI_BAO_GIA },',
        '      data: { currentVersionId: v },',
        '    });',
        '  }',
        '}',
      ].join('\n');
      expect(timDiemGhiStatus(stripToCode(mau))).toEqual([]);
    });

    it('KHÔNG bắt lệnh ghi status trên model KHÁC (vd discountApproval)', () => {
      const mau = [
        'class X {',
        '  async duyet(id: string) {',
        '    await tx.discountApproval.updateMany({',
        '      where: { id },',
        '      data: { status: CHIET_KHAU_DONG_Y },',
        '    });',
        '  }',
        '}',
      ].join('\n');
      expect(timDiemGhiStatus(stripToCode(mau))).toEqual([]);
    });

    it('KHÔNG bắt thứ nằm trong COMMENT (stripToCode đã xoá)', () => {
      const mau = [
        'class X {',
        '  async voCan(id: string) {',
        '    // this.prisma.order.update({ data: { status: x } })',
        '    return id;',
        '  }',
        '}',
      ].join('\n');
      expect(timDiemGhiStatus(stripToCode(mau))).toEqual([]);
    });
  });
});
