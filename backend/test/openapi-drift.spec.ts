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

  it('spec chứa 3 route /auth/* + schema auth (FE gen được client đăng nhập, AD-12)', () => {
    const document = buildOpenApiDocument(app);
    expect(document.paths['/auth/login']).toBeDefined();
    expect(document.paths['/auth/refresh']).toBeDefined();
    expect(document.paths['/auth/logout']).toBeDefined();
    expect(document.components?.schemas?.LoginRequestDto).toBeDefined();
    expect(document.components?.schemas?.AuthTokensDto).toBeDefined();
    expect(document.components?.schemas?.RefreshRequestDto).toBeDefined();
    expect(document.components?.schemas?.LogoutRequestDto).toBeDefined();
  });

  it('spec chứa 3 route mật khẩu + DTO (FE gen được client quên/đổi mật khẩu, AD-12)', () => {
    const document = buildOpenApiDocument(app);
    expect(document.paths['/auth/forgot-password']).toBeDefined();
    expect(document.paths['/auth/reset-password']).toBeDefined();
    expect(document.paths['/auth/change-password']).toBeDefined();
    expect(
      document.components?.schemas?.ForgotPasswordRequestDto,
    ).toBeDefined();
    expect(
      document.components?.schemas?.ForgotPasswordResponseDto,
    ).toBeDefined();
    expect(document.components?.schemas?.ResetPasswordRequestDto).toBeDefined();
    expect(
      document.components?.schemas?.ChangePasswordRequestDto,
    ).toBeDefined();
  });

  it('chỉ /auth/change-password yêu cầu bearer; quên/đặt-lại mật khẩu là công khai (AD-4)', () => {
    // Hợp đồng hiển thị trong spec: người QUÊN mật khẩu chưa có token, nên hai route kia
    // phải công khai; còn ĐỔI mật khẩu bắt buộc phiên hợp lệ. Spec lệch = FE gen sai client.
    const document = buildOpenApiDocument(app);
    expect(document.paths['/auth/change-password'].post?.security).toEqual([
      { bearer: [] },
    ]);
    expect(
      document.paths['/auth/forgot-password'].post?.security,
    ).toBeUndefined();
    expect(
      document.paths['/auth/reset-password'].post?.security,
    ).toBeUndefined();
  });

  it('KHÔNG response schema nào phơi mã xác thực hay passwordHash', () => {
    // Mã rời server qua kênh gửi, không bao giờ qua response; `passwordHash` không bao giờ
    // rời server. Nếu ai thêm field đó vào một DTO response, spec sẽ tố giác ngay.
    const document = buildOpenApiDocument(app);
    const responseDtos = [
      'ForgotPasswordResponseDto',
      'AuthTokensDto',
      'MeResponseDto',
    ];
    for (const name of responseDtos) {
      const schema = JSON.stringify(document.components?.schemas?.[name]);
      expect(schema).not.toMatch(/passwordHash/);
      expect(schema).not.toMatch(/"code"/);
    }
  });

  it('spec chứa 3 route khách hàng + 4 schema Customer* (FE gen được client khách hàng, AD-12)', () => {
    // Drift-guard byte-for-byte ở trên chỉ chứng minh spec KHỚP code — nó xanh y hệt nếu code
    // quên hẳn một route. Hợp đồng CÓ MẶT là một khẳng định khác, và phải được viết ra.
    const document = buildOpenApiDocument(app);
    expect(document.paths['/customers']).toBeDefined();
    expect(document.paths['/customers/{sdt}']).toBeDefined();
    expect(document.paths['/customer-sources']).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateCustomerRequestDto).toBeDefined();
    expect(schemas.UpdateCustomerRequestDto).toBeDefined();
    expect(schemas.CustomerResponseDto).toBeDefined();
    expect(schemas.CustomerSourceResponseDto).toBeDefined();
  });

  it('CreateCustomerRequestDto đòi ĐÚNG 4 field định danh — không siết thêm', () => {
    // Bộ field bắt buộc là một QUYẾT ĐỊNH có chủ đích: Story 3.4 tạo khách INLINE giữa lúc dựng
    // báo giá, nên bắt gõ CCCD/MST lúc tạo sẽ giết chính luồng đó. Ai thêm một `@IsNotEmpty()`
    // vào `cccd` sẽ đổi hợp đồng của 3.4 mà không hay — test này chặn đúng chỗ ấy.
    const document = buildOpenApiDocument(app);
    const schema = document.components?.schemas?.CreateCustomerRequestDto as {
      required?: string[];
    };

    expect([...(schema.required ?? [])].sort()).toEqual([
      'custType',
      'name',
      'sdt',
      'sourceId',
    ]);
  });

  it('MỌI route khách hàng đòi bearer — không route nào công khai (AD-4)', () => {
    // Đây là danh bạ khách: SĐT, CCCD, MST, tài khoản ngân hàng. Một route quên guard là đường
    // cho mọi người đã đăng nhập đọc trọn danh bạ. Spec là nơi cái quên đó lộ ra.
    const document = buildOpenApiDocument(app);
    const operations = [
      document.paths['/customers'].post,
      document.paths['/customers'].get,
      document.paths['/customers/{sdt}'].get,
      document.paths['/customers/{sdt}'].patch,
      document.paths['/customer-sources'].get,
    ];

    for (const operation of operations) {
      expect(operation?.security).toEqual([{ bearer: [] }]);
    }
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
