import { existsSync, readFileSync } from 'node:fs';
import {
  PERMISSIONS_OUTPUT_PATH,
  buildPermissionsArtifact,
  serializePermissionsArtifact,
} from '../src/accounts/permissions-artifact';
import { PERM } from '../src/accounts/domain/permission-registry';

/**
 * Drift-guard artifact quyền (mirror `openapi-drift.spec.ts`): regen artifact in-memory
 * TỪ registry rồi so **byte-for-byte** với `openapi/permissions.json` đã commit → fail
 * nếu ai sửa tay artifact hoặc quên `npm run permissions:gen` sau khi đổi registry
 * (AD-12 "cấm sửa tay"). Hermetic — không cần Postgres.
 */
describe('permissions artifact drift-guard (AD-12, AD-17)', () => {
  it('openapi/permissions.json khớp byte-for-byte với artifact sinh từ registry', () => {
    expect(existsSync(PERMISSIONS_OUTPUT_PATH)).toBe(true);

    const committed = readFileSync(PERMISSIONS_OUTPUT_PATH, 'utf8');
    const regenerated = serializePermissionsArtifact(
      buildPermissionsArtifact(),
    );

    expect(regenerated).toBe(committed);
  });

  it('artifact chứa 4 key FE-stub (orders.view_all/view_own/audit.read/permissions.manage)', () => {
    const keys = buildPermissionsArtifact().map((entry) => entry.key);
    expect(keys).toContain(PERM.ordersViewAll);
    expect(keys).toContain(PERM.ordersViewOwn);
    expect(keys).toContain(PERM.auditRead);
    expect(keys).toContain(PERM.permissionsManage);
  });

  it('file commit có 21 entry, 4 key mới ở CUỐI đúng thứ tự (AC-4)', () => {
    // Soi CHÍNH file FE tiêu thụ (không phải bản regen in-memory): nếu artifact commit
    // thiếu key mới hoặc lệch thứ tự, FE gen sai key mà không suite nào khác bắt được.
    const committed = JSON.parse(
      readFileSync(PERMISSIONS_OUTPUT_PATH, 'utf8'),
    ) as { key: string; label: string; group: string }[];

    expect(committed).toHaveLength(21);
    expect(committed.slice(-4)).toEqual([
      { key: 'settings.manage', label: 'Cấu hình hệ thống', group: 'settings' },
      {
        key: 'system.feature_flags',
        label: 'Cờ tính năng (vận hành app)',
        group: 'system',
      },
      { key: 'costs.view', label: 'Xem giá vốn & lợi nhuận', group: 'costs' },
      { key: 'catalog.view', label: 'Xem danh mục vật tư', group: 'catalog' },
    ]);
  });
});
