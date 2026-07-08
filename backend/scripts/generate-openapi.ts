import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  OPENAPI_OUTPUT_PATH,
  buildOpenApiDocument,
  serializeOpenApiDocument,
} from '../src/openapi/openapi-document';
import { createOpenApiApp } from './openapi-app-context';

/**
 * Sinh artifact `openapi/openapi.json` TỪ code NestJS (AD-12) — build artifact,
 * versioned. Không cần server/DB chạy. Chạy qua `npm run openapi:gen`.
 *
 * Đổi contract API = sửa DTO/controller rồi chạy lại script này; drift-guard test
 * sẽ fail nếu artifact commit không khớp code (hoặc bị sửa tay).
 */
async function generate(): Promise<void> {
  const app = await createOpenApiApp();
  try {
    const document = buildOpenApiDocument(app);
    mkdirSync(dirname(OPENAPI_OUTPUT_PATH), { recursive: true });
    writeFileSync(OPENAPI_OUTPUT_PATH, serializeOpenApiDocument(document));
    console.log(`OpenAPI spec written to ${OPENAPI_OUTPUT_PATH}`);
  } finally {
    await app.close();
  }
}

generate().catch((error) => {
  console.error('Failed to generate OpenAPI spec:', error);
  process.exitCode = 1;
});
