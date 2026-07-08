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
});
