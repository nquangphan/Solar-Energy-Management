import { resolve } from 'node:path';
import { PERMISSIONS } from './domain/permission-registry';

/**
 * Nguồn CHÂN LÝ dựng artifact quyền TỪ registry (AD-12/AD-17), mirror
 * `openapi-document.ts`. Cả script `generate-permissions.ts` (ghi artifact) lẫn
 * drift-guard test (so byte-for-byte) dùng CHUNG hàm ở đây → output nhất quán.
 *
 * `openapi/permissions.json` là artifact SINH TỰ ĐỘNG — CẤM SỬA TAY. Đổi bộ quyền =
 * sửa `permission-registry.ts` rồi chạy `npm run permissions:gen`. FE (Story 2.6)
 * gen key từ artifact này (web TS + Flutter).
 */

/** Đường dẫn artifact quyền dùng chung cross-repo (FE gen client từ đây). */
export const PERMISSIONS_OUTPUT_PATH = resolve(
  __dirname,
  '../../openapi/permissions.json',
);

/** Một entry trong artifact: đúng bộ field cần cho FE gating + màn Phân quyền. */
export interface PermissionArtifactEntry {
  key: string;
  label: string;
  group: string;
}

/** Dựng artifact (mảng deterministic theo thứ tự registry) từ registry. */
export function buildPermissionsArtifact(): PermissionArtifactEntry[] {
  return PERMISSIONS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    group: entry.group,
  }));
}

/**
 * Chuỗi hoá deterministic để so byte-for-byte (drift-guard) + newline cuối (POSIX).
 * Thay đổi format phải đồng bộ cả script gen lẫn test — cả hai gọi hàm này.
 */
export function serializePermissionsArtifact(
  artifact: PermissionArtifactEntry[],
): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
