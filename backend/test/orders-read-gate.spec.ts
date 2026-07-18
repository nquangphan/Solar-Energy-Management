import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripComments } from './util/strip-comments';

/**
 * Source-guard: BỘ GATE của `orders.controller.ts` — quyền `orders.view_*` chỉ được mở cho
 * đường ĐỌC.
 *
 * Story 5.4 nới gate ba route đọc từ `quotes.create_edit` sang
 * `RequireAnyPermissions(orders.view_all, orders.view_own)` — đúng, vì KE_TOAN/THI_CONG/KHO_GIAO
 * thấy đơn trong danh sách nhưng bấm vào thì 403. Nhưng cái gì nới được thì nới tiếp được: quyền
 * `orders.view_*` là quyền XEM, và một mutator (`PATCH /:id`, `chot`, `mo-lai`, `line-items`)
 * lỡ mang gate xem là trao quyền GHI cho mọi người chỉ được phép nhìn.
 *
 * `no-handler-without-require-permissions.spec.ts` chỉ hỏi "có khai quyền không", KHÔNG hỏi
 * "khai quyền NÀO" — nới một mutator sang gate xem đi lọt qua nó, lọt qua `openapi-drift`
 * (openapi.json không chứa thông tin quyền) và lọt qua mọi e2e hiện có. Guard này đóng đúng
 * khoảng đó, ở mức mà một test hành vi không với tới: quan hệ VERB ↔ GATE.
 *
 * Đây là bộ đếm, không phải danh sách trắng chép tay: thêm route đọc mới thì cập nhật
 * `ROUTE_DOC_MO_QUYEN_XEM` — cập nhật có chủ đích, khác với nới nhầm.
 */
describe('source-guard: gate `orders.view_*` chỉ mở cho đường ĐỌC (AC-5)', () => {
  const NGUON = resolve(__dirname, '../src/orders/orders.controller.ts');
  const code = stripComments(readFileSync(NGUON, 'utf8'));

  /** Decorator định tuyến + đường dẫn của nó, theo đúng thứ tự khai trong file. */
  const KHAI_ROUTE =
    /^\s*@(All|Get|Post|Put|Patch|Delete|Options|Head|Search)\(([^)]*)\)/;
  const GATE_XEM =
    /@RequireAnyPermissions\(\s*PERM\.ordersViewAll\s*,\s*PERM\.ordersViewOwn\s*\)/;
  const GATE_KHAC = /@Require(?:Any)?Permissions\(/;

  /**
   * Mỗi route = (verb, path, có mang gate xem không). Gate đứng NGAY SAU decorator định tuyến
   * trong file này, nên đọc tới decorator route kế tiếp là đủ; không cần parse cả class.
   */
  function docBoRoute(): {
    verb: string;
    duongDan: string;
    gateXem: boolean;
    coGate: boolean;
  }[] {
    const dong = code.split('\n');
    const routes: {
      verb: string;
      duongDan: string;
      gateXem: boolean;
      coGate: boolean;
    }[] = [];
    for (let i = 0; i < dong.length; i++) {
      const khop = KHAI_ROUTE.exec(dong[i]);
      if (khop === null) continue;
      const khoiGate: string[] = [];
      for (let j = i + 1; j < dong.length; j++) {
        if (KHAI_ROUTE.test(dong[j])) break;
        khoiGate.push(dong[j]);
      }
      const khoi = khoiGate.join('\n');
      routes.push({
        verb: khop[1],
        duongDan: khop[2].replace(/['"]/g, '').trim(),
        gateXem: GATE_XEM.test(khoi),
        coGate: GATE_KHAC.test(khoi),
      });
    }
    return routes;
  }

  /**
   * Bảy route đọc được phép mang gate xem: danh sách (5.3), ba route của màn chi tiết (5.4),
   * proxy đọc ảnh đính kèm (5.5) và danh sách ảnh của đơn (5.6) — ảnh của đơn là dữ liệu của
   * đơn, nên nó chịu đúng phạm vi và đúng gate của đơn; service `findScopedOrThrow` TRƯỚC khi
   * chạm dữ liệu ảnh hay R2 — và tra cứu bảo hành (5.9): dữ liệu trả về LÀ nội dung đơn, đã
   * thu hẹp theo cùng mệnh đề phạm vi, nên nó dùng đúng gate của đơn thay vì đẻ khoá quyền mới.
   * Danh sách này là HỢP ĐỒNG — thêm dòng vào đây là một quyết định, không phải một lần trượt tay.
   */
  const ROUTE_DOC_MO_QUYEN_XEM = new Set([
    'Get ',
    'Get :id',
    'Get :id/vong-doi',
    'Get :id/phien-ban',
    'Get :id/anh/:attachmentId',
    'Get :id/anh',
    'Get tra-cuu-bao-hanh',
  ]);

  const routes = docBoRoute();
  const khoaCua = (r: { verb: string; duongDan: string }) =>
    `${r.verb} ${r.duongDan}`;

  it('regex đọc được TOÀN BỘ route của controller — guard rỗng là guard giả PASS', () => {
    // 18 route hiện có. Nếu regex trượt, mọi assert dưới đây thành vô nghĩa mà vẫn xanh.
    expect(routes.length).toBeGreaterThanOrEqual(18);
    expect(routes.every((r) => r.coGate)).toBe(true);
  });

  it('ba route của màn chi tiết mang ĐÚNG gate OR(view_all, view_own) — AC-5', () => {
    for (const duongDan of [':id', ':id/vong-doi', ':id/phien-ban']) {
      const route = routes.find((r) => khoaCua(r) === `Get ${duongDan}`);
      expect(route).toBeDefined();
      expect(route?.gateXem).toBe(true);
    }
  });

  it('KHÔNG mutator nào mang gate xem — quyền XEM không được mở đường GHI', () => {
    const viPham = routes
      .filter((r) => r.verb !== 'Get' && r.gateXem)
      .map(khoaCua);
    expect(viPham).toEqual([]);
  });

  it('chỉ đúng bộ route đọc đã chốt mới mang gate xem — route đọc khác giữ gate riêng', () => {
    // `GET /:id/bao-gia/anh` + `/pdf` vẫn là `quotes.create_edit` (luồng người dựng đơn):
    // 5.4 chỉ mở màn chi tiết, không mở đường xuất báo giá.
    const mangGateXem = routes.filter((r) => r.gateXem).map(khoaCua);
    expect(new Set(mangGateXem)).toEqual(ROUTE_DOC_MO_QUYEN_XEM);
  });
});
