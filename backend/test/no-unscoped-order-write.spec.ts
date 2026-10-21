import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripToCode } from './util/strip-to-code';

/**
 * Source-guard: MỌI method công khai chạm vào một đơn ĐÃ CÓ (đọc trần, khoá dòng, engine
 * transition, mở tx, ghi Prisma lên đơn/dòng/chiết khấu/ảnh) phải đi qua đường đọc có phạm vi
 * TRƯỚC thao tác đầu tiên đó — ngoài allowlist có lý do.
 *
 * Lỗ mà guard này đóng: đường ghi từng đọc đơn bằng `findOrThrow(id)` trần, nên người chỉ có
 * `orders.view_own` không XEM được đơn người khác nhưng SỬA/CHỐT được nếu biết id. Một method
 * ghi mới chỉ cần copy-paste `findOrThrow` là mở lại lỗ — guard biến "không xem được thì không
 * sửa được" thành bất biến kiểm chứng được.
 *
 * Trích thân method theo khuôn đã prettier: header ở thụt 2 khoảng trắng, thân kết thúc ở dòng
 * `  }` ĐẦU TIÊN sau header. KHÔNG đếm ngoặc từ header: kiểu trả về `Promise<{ … }>` có `{`
 * riêng và từng làm một guard khác trích nhầm 20 ký tự rồi LUÔN XANH — nên file này có assert
 * chống-guard-rỗng ở dưới.
 */
describe('source-guard: đường ghi đơn phải đi qua phạm vi trước', () => {
  const SRC_DIR = resolve(__dirname, '../src');

  /**
   * Mỗi file được canh + lời gọi "đọc có phạm vi" của file đó. `QuoteExportService` không có
   * `findScopedOrThrow` riêng — nó đi qua `OrdersService.getScoped()` / `assertScoped()`.
   * `PaymentSchedulesService` and `PaymentsService` (outside `orders/`) go through
   * `OrdersService.getScopedTotal()`.
   * Paths are relative to `src/`.
   */
  const FILE_CANH: readonly { file: string; goiPhamVi: RegExp }[] = [
    {
      file: 'orders/orders.service.ts',
      goiPhamVi: /this\.findScopedOrThrow\s*\(/,
    },
    {
      file: 'orders/quote-export.service.ts',
      goiPhamVi: /this\.orders\.(?:getScoped|assertScoped)\s*\(/,
    },
    {
      file: 'payments/payment-schedules.service.ts',
      goiPhamVi: /this\.orders\.(?:getScopedTotal|getScoped|assertScoped)\s*\(/,
    },
    {
      file: 'payments/payments.service.ts',
      goiPhamVi: /this\.orders\.getScopedTotal\s*\(/,
    },
    {
      file: 'contracts/contracts.service.ts',
      goiPhamVi: /this\.orders\.(?:getScoped|assertScoped)\s*\(/,
    },
    {
      file: 'invoices/invoices.service.ts',
      goiPhamVi: /this\.orders\.(?:getScoped|assertScoped)\s*\(/,
    },
  ];

  /**
   * Thao tác chạm vào một đơn đã có: đọc trần, khoá dòng, engine, tx, đọc/ghi R2, ghi Prisma
   * (model của aggregate đơn) — phạm vi phải đứng TRƯỚC thao tác ĐẦU TIÊN trong số này.
   */
  const CHAM_DON: readonly RegExp[] = [
    /this\.findOrThrow\s*\(/,
    /this\.findOrThrowIn\s*\(/,
    /this\.lockOrderRow\s*\(/,
    /this\.applyTransition\s*\(/,
    /\.\$transaction\s*\(/,
    /this\.storage\.putObject\s*\(/,
    // Đọc bytes R2 / hồ sơ xuất của một đơn cũng là chạm đơn: proxy tải file ngoài phạm vi là
    // rò y như sửa ngoài phạm vi.
    /this\.storage\.getObject\s*\(/,
    /\.quoteExport\.find(?:Unique|First)\s*\(/,
    // Order-bound stock (read or write) also touches the order: previewing the stock-out of an
    // out-of-scope order leaks just like issuing it.
    /this\.stockVouchers\.\w+\s*\(/,
    // The quote stock warning is read per order too: out of scope must be refused before it.
    /this\.stockItems\.\w+\s*\(/,
    /\.(?:order|orderVersion|orderLineItem|discountApproval|attachment|quoteExport)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
    // The payment schedule belongs to one order: reading or writing it, or taking a raw row
    // lock, touches that order.
    /\.(?:paymentSchedule|installment)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
    /\.paymentSchedule\.find(?:Unique|First)\s*\(/,
    // A payment belongs to one order: reading or writing payments touches that order, and so
    // do the in-tx transition door and the shared schedule view.
    /\.payment\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|find(?:Unique|First|Many)|count|groupBy|aggregate)\s*\(/,
    /this\.orders\.autoTransitionInTx\s*\(/,
    /this\.(?:schedules\.)?viewFor\s*\(/,
    /\.\$queryRaw\b/,
    // A contract belongs to one order: reading or writing contract rows, rendering its PDF, or
    // reading the inputs it is built from (customer, version, schedule) touches that order.
    /\.contract\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|find(?:Unique|First|Many)|count)\s*\(/,
    /this\.renderer\.\w+\s*\(/,
    /this\.loadInputs\s*\(/,
    // An invoice belongs to one order: reading or writing invoice rows (the replay lookup
    // included) touches that order.
    /\.invoice\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|find(?:Unique|First|Many)|count)\s*\(/,
    /\.invoiceLine\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|find(?:Unique|First|Many)|count)\s*\(/,
  ];

  /**
   * ALLOWLIST — method được chạm đơn mà KHÔNG qua phạm vi, kèm lý do:
   *  - `create`: tạo đơn MỚI — chưa có đơn nào để thu hẹp; owner = chính người gọi.
   *  - `chuyenTrangThaiTuDong`: đường HỆ THỐNG (auto-transition từ event nghiệp vụ, vd ghi
   *    nhận thanh toán) — không có người gọi để lấy phạm vi; quyền vẫn do engine gate.
   *  - `autoTransitionInTx`: runs INSIDE the caller's tx, after the caller locked the order;
   *    its only caller (`PaymentsService.record`, guarded below) scopes first.
   *  - `viewFor`: the shared schedule view builder; it takes an order the caller ALREADY scoped
   *    (`get` here and `PaymentsService.record`, both guarded) and is never routed directly.
   *  - `list`: KHÔNG ghi — `$transaction([count, findMany])` dạng mảng chỉ để đọc nhất quán;
   *    phạm vi danh sách tự nằm trong `where` của nó (canh bởi `orders-list-scope.spec.ts`).
   */
  const CHO_PHEP: Readonly<Record<string, string>> = {
    'orders/orders.service.ts#create': 'tạo đơn mới — chưa có đơn để scope',
    'orders/orders.service.ts#chuyenTrangThaiTuDong':
      'đường hệ thống từ event, không có caller người dùng',
    'orders/orders.service.ts#autoTransitionInTx':
      "inside the caller's tx; the caller (payments record) scopes first",
    'payments/payment-schedules.service.ts#viewFor':
      'view builder over an order the caller already scoped',
    'orders/orders.service.ts#list':
      'chỉ đọc (tx mảng count+findMany), phạm vi nằm trong where của list',
  };

  interface Method {
    readonly ten: string;
    readonly congKhai: boolean;
    readonly than: string;
  }

  /**
   * Thành viên class (thụt 2) kèm thân tới dòng `  }` đầu tiên sau header. Chỉ quét TỪ khai
   * báo `class` trở đi: hàm top-level của file cũng có câu lệnh thụt 2 (`  if (`…).
   */
  function trichMethod(toanFile: string): Method[] {
    const moClass = /\bclass\s+[A-Za-z_$][\w$]*[^{]*\{/.exec(toanFile);
    const code = moClass === null ? '' : toanFile.slice(moClass.index);
    const re =
      /\n {2}(private |protected |public )?(?:async )?([A-Za-z_$][\w$]*)\s*\(/g;
    const ket: Method[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const ten = m[2];
      if (ten === 'constructor') continue;
      const dau = m.index + 1;
      const cuoi = code.indexOf('\n  }\n', dau);
      const than = code.slice(dau, cuoi === -1 ? code.length : cuoi);
      ket.push({
        ten,
        congKhai: m[1] === undefined || m[1] === 'public ',
        than,
      });
    }
    return ket;
  }

  /** Vị trí thao tác chạm-đơn đầu tiên trong thân, hoặc -1. */
  function viTriChamDau(than: string): number {
    let dau = -1;
    for (const re of CHAM_DON) {
      const m = re.exec(than);
      if (m !== null && (dau === -1 || m.index < dau)) dau = m.index;
    }
    return dau;
  }

  /** Method công khai chạm đơn mà phạm vi KHÔNG đứng trước thao tác chạm đầu tiên. */
  function viPham(code: string, goiPhamVi: RegExp): string[] {
    const ket: string[] = [];
    for (const method of trichMethod(code)) {
      if (!method.congKhai) continue;
      const cham = viTriChamDau(method.than);
      if (cham === -1) continue;
      const phamVi = goiPhamVi.exec(method.than);
      if (phamVi === null || phamVi.index > cham) ket.push(method.ten);
    }
    return ket;
  }

  function docFile(file: string): string {
    return stripToCode(readFileSync(resolve(SRC_DIR, file), 'utf8'));
  }

  it('không method công khai nào chạm đơn trước khi đi qua phạm vi (ngoài allowlist)', () => {
    const offenders: string[] = [];
    for (const { file, goiPhamVi } of FILE_CANH) {
      for (const ten of viPham(docFile(file), goiPhamVi)) {
        if (CHO_PHEP[`${file}#${ten}`] === undefined) {
          offenders.push(`${file}#${ten}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('allowlist không thừa: mỗi mục vẫn THẬT SỰ là một method chạm đơn không phạm vi', () => {
    // Mục allowlist "chết" (method đã được scope hoặc đổi tên) là chỗ trống để một method
    // MỚI trùng tên lọt qua — gỡ nó ngay khi không còn cần.
    const conViPham = new Set<string>();
    for (const { file, goiPhamVi } of FILE_CANH) {
      for (const ten of viPham(docFile(file), goiPhamVi)) {
        conViPham.add(`${file}#${ten}`);
      }
    }
    expect(Object.keys(CHO_PHEP).filter((k) => !conViPham.has(k))).toEqual([]);
  });

  describe('chống guard rỗng — máy quét THẤY đúng thứ nó canh', () => {
    it('trích được đủ method công khai của OrdersService, thân không bị cắt cụt', () => {
      const methods = trichMethod(docFile('orders/orders.service.ts'));
      const congKhai = methods.filter((m) => m.congKhai);
      expect(congKhai.length).toBeGreaterThan(20);
      // Method có kiểu trả về `Promise<{ … }>` (khuôn từng làm guard khác cắt cụt): thân
      // phải chứa CẢ lời gọi phạm vi lẫn transaction phía sau.
      const huyDon = congKhai.find((m) => m.ten === 'huyDon');
      expect(huyDon?.than).toMatch(/this\.findScopedOrThrow\s*\(/);
      expect(huyDon?.than).toMatch(/\.\$transaction\s*\(/);
    });

    it('nhận diện ĐỦ các đường ghi đơn là "chạm đơn" — kể cả 8 đường vừa được scope', () => {
      const chamDon = trichMethod(docFile('orders/orders.service.ts'))
        .filter((m) => m.congKhai && viTriChamDau(m.than) !== -1)
        .map((m) => m.ten);
      expect(chamDon.length).toBeGreaterThanOrEqual(16);
      expect(chamDon).toEqual(
        expect.arrayContaining([
          'update',
          'confirm',
          'revise',
          'applyDiscount',
          'resolveDiscount',
          'addLine',
          'updateLine',
          'removeLine',
          'chuyenTrangThaiThuCong',
          'huyDon',
          'themAnh',
          'xoaAnh',
          'create',
          'chuyenTrangThaiTuDong',
          'issueStock',
          'getStockIssue',
          'getStockCheck',
        ]),
      );
      const xuat = trichMethod(docFile('orders/quote-export.service.ts'))
        .filter((m) => m.congKhai && viTriChamDau(m.than) !== -1)
        .map((m) => m.ten);
      expect(xuat).toEqual(
        expect.arrayContaining(['exportQuote', 'getExportFile']),
      );
    });

    it('extracts the public methods of PaymentSchedulesService with full bodies, all touching the order', () => {
      const methods = trichMethod(
        docFile('payments/payment-schedules.service.ts'),
      ).filter((m) => m.congKhai);
      const replace = methods.find((m) => m.ten === 'replace');
      const get = methods.find((m) => m.ten === 'get');
      expect(replace?.than).toMatch(/this\.orders\.getScopedTotal\s*\(/);
      expect(replace?.than).toMatch(/\.\$transaction\s*\(/);
      expect(replace?.than).toMatch(/\.installment\.createMany\s*\(/);
      expect(viTriChamDau(replace?.than ?? '')).toBeGreaterThan(-1);
      // `get` reads through the shared view builder, which reads the schedule.
      expect(get?.than).toMatch(/this\.viewFor\s*\(/);
      expect(viTriChamDau(get?.than ?? '')).toBeGreaterThan(-1);
      const viewFor = methods.find((m) => m.ten === 'viewFor');
      expect(viewFor?.than).toMatch(/\.paymentSchedule\.findUnique\s*\(/);
    });

    it('extracts PaymentsService.record with its full body: scope, tx and the payment insert', () => {
      const record = trichMethod(docFile('payments/payments.service.ts')).find(
        (m) => m.congKhai && m.ten === 'record',
      );
      expect(record?.than.length).toBeGreaterThan(0);
      expect(record?.than).toMatch(/this\.orders\.getScopedTotal\s*\(/);
      expect(record?.than).toMatch(/\.payment\.create\s*\(/);
      expect(record?.than).toMatch(/this\.orders\.autoTransitionInTx\s*\(/);
      expect(viTriChamDau(record?.than ?? '')).toBeGreaterThan(-1);
    });

    it('extracts the public methods of ContractsService with full bodies, all touching the order', () => {
      const methods = trichMethod(docFile('contracts/contracts.service.ts'));
      const generate = methods.find((m) => m.congKhai && m.ten === 'generate');
      const overview = methods.find((m) => m.congKhai && m.ten === 'overview');
      const getPdf = methods.find((m) => m.congKhai && m.ten === 'getPdf');
      expect(generate?.than.length).toBeGreaterThan(0);
      expect(generate?.than).toMatch(/this\.orders\.getScoped\s*\(/);
      expect(generate?.than).toMatch(/\.contract\.create\s*\(/);
      expect(generate?.than).toMatch(/this\.renderer\.renderPdf\s*\(/);
      expect(overview?.than).toMatch(/\.contract\.findMany\s*\(/);
      expect(getPdf?.than).toMatch(/this\.orders\.assertScoped\s*\(/);
      expect(getPdf?.than).toMatch(/this\.storage\.getObject\s*\(/);
      for (const m of [generate, overview, getPdf]) {
        expect(viTriChamDau(m?.than ?? '')).toBeGreaterThan(-1);
      }
    });

    it('extracts the public methods of InvoicesService with full bodies, all touching the order', () => {
      const methods = trichMethod(docFile('invoices/invoices.service.ts'));
      const create = methods.find((m) => m.congKhai && m.ten === 'create');
      const overview = methods.find((m) => m.congKhai && m.ten === 'overview');
      expect(create?.than.length).toBeGreaterThan(0);
      expect(create?.than).toMatch(/this\.orders\.getScoped\s*\(/);
      expect(create?.than).toMatch(/\.invoice\.findUnique\s*\(/);
      expect(create?.than).toMatch(/\.invoice\.create\s*\(/);
      expect(create?.than).toMatch(/this\.loadInputs\s*\(/);
      expect(overview?.than).toMatch(/\.invoice\.findMany\s*\(/);
      for (const m of [create, overview]) {
        expect(viTriChamDau(m?.than ?? '')).toBeGreaterThan(-1);
      }
    });

    it('BẮT an invoice read placed before the scoped read', () => {
      const mau = [
        'class X {',
        '  async create(actor: string, q: Set<string>, id: string) {',
        '    await this.prisma.invoice.count({ where: {} });',
        '    await this.orders.getScoped(actor, q, id, false);',
        '  }',
        '}',
        '',
      ].join('\n');
      expect(
        viPham(mau, /this\.orders\.(?:getScoped|assertScoped)\s*\(/),
      ).toEqual(['create']);
    });

    it('BẮT a contract read placed before the scoped read', () => {
      const mau = [
        'class X {',
        '  async getPdf(actor: string, q: Set<string>, id: string) {',
        '    await this.prisma.contract.findFirst({ where: {} });',
        '    await this.orders.assertScoped(actor, q, id);',
        '  }',
        '}',
        '',
      ].join('\n');
      expect(
        viPham(mau, /this\.orders\.(?:getScoped|assertScoped)\s*\(/),
      ).toEqual(['getPdf']);
    });

    it('BẮT a payment read placed before the scoped read', () => {
      const mau = [
        'class X {',
        '  async record(actor: string, q: Set<string>, id: string) {',
        '    await this.prisma.payment.findUnique({ where: {} });',
        '    await this.orders.getScopedTotal(actor, q, id, 8, false);',
        '  }',
        '}',
        '',
      ].join('\n');
      expect(viPham(mau, /this\.orders\.getScopedTotal\s*\(/)).toEqual([
        'record',
      ]);
    });

    it('BẮT a schedule write placed before the scoped read', () => {
      const mau = [
        'class X {',
        '  async replace(actor: string, q: Set<string>, id: string) {',
        '    await this.prisma.installment.deleteMany({ where: {} });',
        '    await this.orders.getScopedTotal(actor, q, id, 8, false);',
        '  }',
        '}',
        '',
      ].join('\n');
      expect(
        viPham(
          mau,
          /this\.orders\.(?:getScopedTotal|getScoped|assertScoped)\s*\(/,
        ),
      ).toEqual(['replace']);
    });

    it('BẮT method ghi dùng findOrThrow trần', () => {
      const mau = [
        'class X {',
        '  async suaLen(actor: string, id: string): Promise<{ a: number }> {',
        '    const don = await this.findOrThrow(id);',
        '    await this.prisma.$transaction(async (tx) => {});',
        '  }',
        '}',
        '',
      ].join('\n');
      expect(viPham(mau, /this\.findScopedOrThrow\s*\(/)).toEqual(['suaLen']);
    });

    it('BẮT method gọi phạm vi SAU khi đã chạm đơn (thứ tự sai cũng là lỗ)', () => {
      const mau = [
        'class X {',
        '  async suaMuon(actor: string, q: Set<string>, id: string) {',
        '    await this.prisma.orderLineItem.delete({ where: { id } });',
        '    await this.findScopedOrThrow(actor, q, id);',
        '  }',
        '}',
        '',
      ].join('\n');
      expect(viPham(mau, /this\.findScopedOrThrow\s*\(/)).toEqual(['suaMuon']);
    });

    it('THA method scope trước rồi mới đọc lại trần / mở tx; bỏ qua method private', () => {
      const mau = [
        'class X {',
        '  async dung(actor: string, q: Set<string>, id: string) {',
        '    await this.findScopedOrThrow(actor, q, id);',
        '    await this.prisma.$transaction(async (tx) => {});',
        '    await this.findOrThrow(id);',
        '  }',
        '  private async noiBo(id: string) {',
        '    await this.findOrThrow(id);',
        '  }',
        '}',
        '',
      ].join('\n');
      expect(viPham(mau, /this\.findScopedOrThrow\s*\(/)).toEqual([]);
    });
  });
});
