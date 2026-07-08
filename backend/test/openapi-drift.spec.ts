import { existsSync, readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import {
  OPENAPI_OUTPUT_PATH,
  buildOpenApiDocument,
  getBackendVersion,
  serializeOpenApiDocument,
} from '../src/openapi/openapi-document';
import { createOpenApiApp } from '../scripts/openapi-app-context';

/**
 * Drift-guard OpenAPI (mirror drift-guard byte-for-byte của design-system):
 * regen document in-memory từ CHÍNH code rồi so **byte-for-byte** với
 * `openapi/openapi.json` đã commit. Nếu ai sửa tay spec hoặc quên chạy
 * `npm run openapi:gen` sau khi đổi DTO/controller → test fail (AC-2 "cấm sửa tay").
 */
describe('OpenAPI drift-guard (AD-12)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createOpenApiApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('openapi/openapi.json khớp byte-for-byte với spec sinh từ code', () => {
    expect(existsSync(OPENAPI_OUTPUT_PATH)).toBe(true);

    const committed = readFileSync(OPENAPI_OUTPUT_PATH, 'utf8');
    const regenerated = serializeOpenApiDocument(buildOpenApiDocument(app));

    expect(regenerated).toBe(committed);
  });

  it('spec chứa path /health với response schema thật (không path rỗng)', () => {
    const document = buildOpenApiDocument(app);
    expect(document.paths['/health']).toBeDefined();
    expect(document.components?.schemas?.HealthResponseDto).toBeDefined();
  });

  it('spec chứa ErrorEnvelopeDto + FieldErrorDto trong components.schemas (AC-1/AC-3)', () => {
    // Hợp đồng lỗi cross-repo phải luôn xuất hiện để FE gen được type (dù chưa endpoint
    // nào tham chiếu) — chứng minh `extraModels` hoạt động.
    const document = buildOpenApiDocument(app);
    expect(document.components?.schemas?.ErrorEnvelopeDto).toBeDefined();
    expect(document.components?.schemas?.FieldErrorDto).toBeDefined();
  });

  it('spec version = version backend (AC-2 "versioned")', () => {
    // AC-2 yêu cầu spec "versioned": version của OpenAPI doc phải bám version
    // backend (package.json), không hardcode rời rạc.
    const document = buildOpenApiDocument(app);
    expect(document.info.version).toBe(getBackendVersion());
  });
});
