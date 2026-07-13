import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from './util/strip-comments';

/**
 * Source-guard AD-4/NFR-7 (mirror `no-permission-literal-outside-registry.spec.ts`):
 * quét `src/**\/*.controller.ts` → MỌI handler HTTP phải khai tường minh một trong ba:
 * `@Public()` · `@RequirePermissions(...)` · `@AuthenticatedOnly()`.
 *
 * Vì sao cần: authn fail-closed, nhưng authz thì KHÔNG — `PermissionsGuard` cho qua khi
 * metadata quyền rỗng ⇒ route nghiệp vụ QUÊN khai quyền = mọi user đã đăng nhập đọc
 * được (Epic 3 thêm `Product.costPrice`). Guard này trả món nợ đó TRƯỚC khi route
 * nghiệp vụ đầu tiên xuất hiện.
 *
 * `stripComments` là BẮT BUỘC: docstring của `me.controller.ts` /
 * `change-password.controller.ts` chứa nguyên văn chuỗi `@RequirePermissions` — quét raw
 * text sẽ khiến hai handler đó giả PASS ngay cả khi thiếu decorator. Dùng `stripComments`
 * (GIỮ string, bỏ comment), KHÔNG `stripToCode` (bỏ cả string ⇒ mất `@Post('login')`).
 */
describe('source-guard: mọi handler không @Public phải khai quyền (AD-4)', () => {
  const SRC_DIR = resolve(__dirname, '../src');
  /**
   * TOÀN BỘ decorator định tuyến của Nest — KHÔNG chỉ 5 verb quen thuộc. Thiếu `@All`
   * (đăng ký MỌI verb), `@Options`, `@Head`, `@Search` ⇒ handler khai bằng chúng vô hình
   * với guard: không khai quyền vẫn xanh. Thêm verb mới vào đây khi Nest thêm.
   */
  const HTTP_METHOD =
    /^\s*@(All|Get|Post|Put|Patch|Delete|Options|Head|Search)\b/;
  /**
   * Dòng khai method của class: 2 space indent, kèm modifier (`public`/`private`/
   * `protected`) và/hoặc `async`, có thể mang generic. Regex hẹp hơn thực tế ⇒ handler
   * không đóng được: khi đó guard báo offender (fail-closed), không im lặng bỏ qua.
   */
  const METHOD_SIGNATURE =
    /^\s{2}(?:(?:public|private|protected)\s+)?(?:async\s+)?[A-Za-z_]\w*(?:<[^>]*>)?\s*\(/;
  const CLASS_DECLARATION =
    /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s/;
  const CLASS_END = /^\}/;
  const DECLARATIONS = [
    '@RequirePermissions(',
    '@AuthenticatedOnly(',
    '@Public(',
  ];

  function collectControllerFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectControllerFiles(full));
      } else if (entry.name.endsWith('.controller.ts')) {
        files.push(full);
      }
    }
    return files;
  }

  /**
   * Handler thiếu cả ba khai báo.
   *
   * Quét theo KHỐI: mọi dòng kể từ ranh giới trước (dòng khai class, hoặc dòng khai
   * method của handler liền trước) được gom vào khối của handler đang xét. Nhờ vậy thứ tự
   * decorator KHÔNG quan trọng — `@RequirePermissions` đứng TRÊN `@Get` vẫn được tính,
   * đúng như TS/Nest hiểu. Khối reset ở mỗi dòng khai method ⇒ handler trần không "mượn"
   * được khai báo của handler bên dưới.
   *
   * Khai báo cấp CLASS (`@Public`/`@RequirePermissions`/`@AuthenticatedOnly` đứng trước
   * `class X`) miễn mọi handler của **chính class đó** — đúng ngữ nghĩa runtime
   * `Reflector.getAllAndOverride([handler, class])`. Tính riêng cho TỪNG class: một file
   * chứa hai controller thì `@Public()` của class đầu KHÔNG được miễn cho class sau.
   */
  function findOffenders(source: string): string[] {
    const lines = stripComments(source).split('\n');
    const declared = (block: readonly string[]) =>
      DECLARATIONS.some((decl) => block.join('\n').includes(decl));

    const offenders: string[] = [];
    let block: string[] = [];
    let httpLine: string | null = null;
    let classDeclaresPermissions = false;

    // Handler mở bằng @Get/@Post… nhưng guard không đọc được dòng khai method của nó.
    // Fail-closed: báo offender để người sửa hoặc mở rộng `METHOD_SIGNATURE`, thay vì im
    // lặng bỏ qua một handler mà guard không hiểu.
    const flushUnrecognized = () => {
      if (httpLine !== null && !classDeclaresPermissions) {
        offenders.push(`(không nhận diện được method sau ${httpLine.trim()})`);
      }
      httpLine = null;
    };

    for (const line of lines) {
      if (CLASS_DECLARATION.test(line)) {
        flushUnrecognized();
        classDeclaresPermissions = declared(block);
        block = [];
        continue;
      }
      if (CLASS_END.test(line)) {
        flushUnrecognized();
        classDeclaresPermissions = false;
        block = [];
        continue;
      }
      if (HTTP_METHOD.test(line)) {
        // Đã có một @Get/@Post chờ method mà lại gặp cái kế ⇒ handler trước không đóng.
        if (httpLine !== null) {
          flushUnrecognized();
          block = [];
        }
        httpLine = line;
        block.push(line);
        continue;
      }
      if (METHOD_SIGNATURE.test(line)) {
        if (
          httpLine !== null &&
          !classDeclaresPermissions &&
          !declared(block)
        ) {
          offenders.push(line.trim());
        }
        block = [];
        httpLine = null;
        continue;
      }
      block.push(line);
    }
    flushUnrecognized();
    return offenders;
  }

  const controllers = collectControllerFiles(SRC_DIR);

  it('guard thực sự quét controller (không xanh giả vì danh sách rỗng)', () => {
    expect(controllers.length).toBeGreaterThan(0);
  });

  it('mọi handler HTTP trong src/ đều khai @Public / @RequirePermissions / @AuthenticatedOnly', () => {
    const offenders = controllers.flatMap((file) =>
      findOffenders(readFileSync(file, 'utf8')).map(
        (handler) => `${file} → ${handler}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  describe('guard THẬT SỰ bắt được handler trần (chống guard "chết" luôn xanh)', () => {
    const wrap = (body: string) =>
      `@Controller()\nexport class SampleController {\n${body}\n}\n`;

    it('handler @Get() trần → offender', () => {
      const source = wrap(
        `  @Get('things')\n  async things() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual(['async things() {']);
    });

    it('handler có @RequirePermissions → không offender', () => {
      const source = wrap(
        `  @Get('things')\n  @RequirePermissions(PERM.ordersViewAll)\n  async things() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual([]);
    });

    it('handler có @AuthenticatedOnly → không offender', () => {
      const source = wrap(
        `  @Get('things')\n  @AuthenticatedOnly()\n  async things() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual([]);
    });

    it('@Public() cấp class → mọi handler của CHÍNH class đó exempt', () => {
      const source = `@Public()\n@Controller()\nexport class SampleController {\n  @Get('things')\n  async things() {\n    return [];\n  }\n}\n`;
      expect(findOffenders(source)).toEqual([]);
    });

    it('decorator CHỈ nằm trong comment → VẪN offender (chứng minh stripComments chạy)', () => {
      const source = wrap(
        `  @Get('things')\n  // @RequirePermissions(PERM.ordersViewAll)\n  async things() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual(['async things() {']);
    });

    it('handler trần KHÔNG "mượn" được @RequirePermissions của handler bên dưới', () => {
      // Cửa sổ decorator phải đóng ở handler kế. Nếu nó chạy tiếp, `things()` trần sẽ
      // thấy `@RequirePermissions` của `secrets()` và giả PASS — đúng kiểu chết-mà-xanh
      // mà AC-4 tồn tại để chống.
      const source = wrap(
        `  @Get('things')\n  async things() {\n    return [];\n  }\n\n  @Get('secrets')\n  @RequirePermissions(PERM.costsView)\n  async secrets() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual(['async things() {']);
    });

    it('handler có modifier (`public async`) vẫn được nhận diện — có khai quyền ⇒ không offender', () => {
      const source = wrap(
        `  @Get('things')\n  @RequirePermissions(PERM.costsView)\n  public async things() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual([]);
    });

    it('handler `public async` trần đứng trước handler có khai quyền → VẪN offender', () => {
      const source = wrap(
        `  @Get('things')\n  public async things() {\n    return [];\n  }\n\n  @Get('secrets')\n  @RequirePermissions(PERM.costsView)\n  async secrets() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual(['public async things() {']);
    });

    it('guard không đọc được dòng khai method → offender (fail-closed, không im lặng bỏ qua)', () => {
      // Dạng handler ngoài tầm `METHOD_SIGNATURE` (vd property arrow function). Guard
      // KHÔNG được coi là "đã khai quyền" chỉ vì không hiểu cú pháp.
      const source = wrap(
        `  @Get('things')\n  things = async () => {\n    return [];\n  };`,
      );
      expect(findOffenders(source)).toEqual([
        "(không nhận diện được method sau @Get('things'))",
      ]);
    });

    // `@All` đăng ký MỌI verb — handler trần khai bằng nó là bề mặt rộng NHẤT có thể, mà
    // guard chỉ soi 5 verb quen thuộc thì lại vô hình. `@Options`/`@Head`/`@Search` cùng
    // lỗ hổng. Một test cho từng verb: quên verb nào, verb đó đỏ.
    for (const verb of ['All', 'Options', 'Head', 'Search']) {
      it(`handler @${verb}() trần → offender (verb ngoài 5 cái quen thuộc vẫn phải bị soi)`, () => {
        const source = wrap(
          `  @${verb}('leak')\n  async leak() {\n    return [];\n  }`,
        );
        expect(findOffenders(source)).toEqual(['async leak() {']);
      });
    }

    it('khai quyền đứng TRÊN @Get (thứ tự decorator không đổi ngữ nghĩa) → không offender', () => {
      const source = wrap(
        `  @AuthenticatedOnly()\n  @Get('things')\n  async things() {\n    return [];\n  }`,
      );
      expect(findOffenders(source)).toEqual([]);
    });

    it('@RequirePermissions cấp class → mọi handler của class đó được miễn (đúng getAllAndOverride)', () => {
      const source = `@RequirePermissions(PERM.costsView)\n@Controller()\nexport class SampleController {\n  @Get('things')\n  async things() {\n    return [];\n  }\n}\n`;
      expect(findOffenders(source)).toEqual([]);
    });

    it('class thứ HAI trong file KHÔNG thừa hưởng @Public() của class đầu', () => {
      // Miễn trừ cấp class phải tính RIÊNG cho từng class. Miễn cả file theo `@Public()`
      // của class đầu ⇒ controller thứ hai lọt lưới hoàn toàn — guard chết mà vẫn xanh.
      const source =
        `@Public()\n@Controller('health')\nexport class HealthController {\n  @Get()\n  async ping() {\n    return 'ok';\n  }\n}\n\n` +
        `@Controller('secrets')\nexport class SecretsController {\n  @Get()\n  async leak() {\n    return [];\n  }\n}\n`;
      expect(findOffenders(source)).toEqual(['async leak() {']);
    });
  });
});
