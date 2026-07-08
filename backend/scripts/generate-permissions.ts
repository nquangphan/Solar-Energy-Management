import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  PERMISSIONS_OUTPUT_PATH,
  buildPermissionsArtifact,
  serializePermissionsArtifact,
} from '../src/accounts/permissions-artifact';

/**
 * Sinh artifact `openapi/permissions.json` TỪ registry quyền (AD-12/AD-17) — build
 * artifact, không cần server/DB. Chạy qua `npm run permissions:gen`.
 *
 * Đổi bộ quyền = sửa `permission-registry.ts` rồi chạy lại script này; drift-guard test
 * fail nếu artifact commit không khớp registry (hoặc bị sửa tay).
 */
function generate(): void {
  const artifact = serializePermissionsArtifact(buildPermissionsArtifact());
  mkdirSync(dirname(PERMISSIONS_OUTPUT_PATH), { recursive: true });
  writeFileSync(PERMISSIONS_OUTPUT_PATH, artifact);
  console.log(`Permissions artifact written to ${PERMISSIONS_OUTPUT_PATH}`);
}

try {
  generate();
} catch (error) {
  console.error('Failed to generate permissions artifact:', error);
  process.exitCode = 1;
}
