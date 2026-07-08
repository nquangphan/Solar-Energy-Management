import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { FieldErrorDto } from '../common/errors/dto/field-error.dto';

/**
 * Nguồn CHÂN LÝ để dựng OpenAPI document TỪ code NestJS (AD-12). Cả script
 * `generate-openapi.ts` (ghi artifact) lẫn drift-guard test (so byte-for-byte)
 * dùng CHUNG hàm ở đây → output nhất quán, không lệch.
 *
 * File `openapi/openapi.json` là artifact SINH TỰ ĐỘNG — CẤM SỬA TAY. Đổi contract
 * = sửa DTO/controller rồi chạy `npm run openapi:gen`.
 */

/** Đường dẫn artifact OpenAPI dùng chung cross-repo (web/mobile gen client từ đây). */
export const OPENAPI_OUTPUT_PATH = resolve(
  __dirname,
  '../../openapi/openapi.json',
);

const PACKAGE_JSON_PATH = resolve(__dirname, '../../package.json');

/** Version backend (package.json) → set làm version của spec (AC-2 "versioned"). */
export function getBackendVersion(): string {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/** Build OpenAPI document từ chính code (controller/DTO là chân lý). */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Phương Nam Solar API')
    .setDescription(
      'Hợp đồng API cross-repo cho web + mobile. Spec SINH TỪ code NestJS — CẤM SỬA TAY.',
    )
    .setVersion(getBackendVersion())
    .build();

  // `extraModels`: ép `ErrorEnvelopeDto` + `FieldErrorDto` vào `components.schemas` dù
  // chưa endpoint nào tham chiếu — hợp đồng lỗi cross-repo (AD-5) để FE gen type ngay (AC-3).
  return SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorEnvelopeDto, FieldErrorDto],
  });
}

/**
 * Chuỗi hoá deterministic để so byte-for-byte (drift-guard). Thêm newline cuối
 * theo thói quen POSIX. Bất kỳ thay đổi format nào phải đồng bộ ở cả script gen
 * lẫn test — vì cả hai gọi hàm này.
 */
export function serializeOpenApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
