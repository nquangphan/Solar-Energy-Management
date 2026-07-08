import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PERM,
  PERMISSION_KEYS,
} from '../src/accounts/domain/permission-registry';

/**
 * Cross-repo drift-guard (Epic 1 retro action item): registry backend PHẢI khớp
 * **byte-for-byte** với literal FE stub Story 1.10 để Story 2.6 chỉ đổi *nguồn* (stub →
 * artifact), KHÔNG đổi *chuỗi*. `permission-registry.spec.ts` chỉ so với literal
 * HARDCODE trong chính test — KHÔNG đọc file FE thật; nếu ai đổi tên literal ở FE
 * (vd `orders.viewAll`), không test backend nào bắt được. Test này đọc CHÍNH file FE
 * stub (web TS + Flutter) và khẳng định mọi literal quyền FE đang khai ∈ registry.
 *
 * Hermetic — chỉ đọc file, không cần Postgres. Monorepo: `web/` + `mobile/` nằm cạnh
 * `backend/`. File FE thiếu = fail rõ ràng (drift-guard KHÔNG được im lặng xanh).
 */
describe('registry ↔ FE stub parity (Epic 1 retro action item, AC-1)', () => {
  const REPO_ROOT = resolve(__dirname, '../..');
  const WEB_STUB = resolve(
    REPO_ROOT,
    'web/src/design-system/gating/permissions.ts',
  );
  const MOBILE_STUB = resolve(
    REPO_ROOT,
    'mobile/lib/design_system/gating/app_permissions.dart',
  );

  /**
   * Rút mọi literal hình dạng `domain.action` snake_case trong dấu nháy (`'…'`/`"…"`)
   * — chính là permission key. Import path/chuỗi khác KHÔNG khớp pattern này.
   */
  function extractPermissionLiterals(source: string): string[] {
    const matches = source.matchAll(
      /['"]([a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*)['"]/g,
    );
    return [...new Set([...matches].map((m) => m[1]))];
  }

  // 3 literal FE stub thực sự khai (view_own là entry backend-tường-minh AC-2, FE suy
  // scope từ có/không view_all nên KHÔNG khai literal riêng).
  const EXPECTED_FE_LITERALS = [
    PERM.ordersViewAll,
    PERM.auditRead,
    PERM.permissionsManage,
  ];

  for (const [name, path] of [
    ['web', WEB_STUB],
    ['mobile', MOBILE_STUB],
  ] as const) {
    describe(`${name} stub`, () => {
      it('file FE stub tồn tại (drift-guard không im lặng xanh)', () => {
        expect(existsSync(path)).toBe(true);
      });

      it('mọi permission literal FE khai đều ∈ registry backend (byte-for-byte)', () => {
        const literals = extractPermissionLiterals(readFileSync(path, 'utf8'));
        expect(literals.length).toBeGreaterThan(0);
        for (const literal of literals) {
          expect(PERMISSION_KEYS).toContain(literal);
        }
      });

      it('khai đủ 3 literal FE-stub khớp registry (bắt FE rename/xoá key)', () => {
        const literals = extractPermissionLiterals(readFileSync(path, 'utf8'));
        for (const expected of EXPECTED_FE_LITERALS) {
          expect(literals).toContain(expected);
        }
      });
    });
  }
});
