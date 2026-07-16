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

  it('spec chứa 4 route khách hàng + 6 schema Customer* (FE gen được client khách hàng, AD-12)', () => {
    // Drift-guard byte-for-byte ở trên chỉ chứng minh spec KHỚP code — nó xanh y hệt nếu code
    // quên hẳn một route. Hợp đồng CÓ MẶT là một khẳng định khác, và phải được viết ra.
    const document = buildOpenApiDocument(app);
    expect(document.paths['/customers']).toBeDefined();
    expect(document.paths['/customers/lookup']).toBeDefined();
    expect(document.paths['/customers/{sdt}']).toBeDefined();
    expect(document.paths['/customer-sources']).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateCustomerRequestDto).toBeDefined();
    expect(schemas.UpdateCustomerRequestDto).toBeDefined();
    expect(schemas.CustomerResponseDto).toBeDefined();
    expect(schemas.CustomerSourceResponseDto).toBeDefined();
    expect(schemas.CustomerLookupResponseDto).toBeDefined();
    expect(schemas.CustomerListResponseDto).toBeDefined();
  });

  it('GET /customers trả ENVELOPE phân trang, KHÔNG phải mảng trần (đổi hợp đồng có chủ đích)', () => {
    // Hợp đồng này ĐỔI ở story 3.4 (đóng LOW #5 của review 3.3). Rẻ vì chưa có consumer — nhưng
    // "chưa có consumer" chỉ đúng một lần. Khẳng định tường minh để lần đổi sau ai cũng thấy.
    const document = buildOpenApiDocument(app);
    const schema = document.paths['/customers'].get?.responses?.['200'] as {
      content?: Record<string, { schema?: { $ref?: string } }>;
    };

    expect(schema.content?.['application/json']?.schema?.$ref).toBe(
      '#/components/schemas/CustomerListResponseDto',
    );

    const envelope = document.components?.schemas?.CustomerListResponseDto as {
      required?: string[];
    };
    expect([...(envelope.required ?? [])].sort()).toEqual([
      'items',
      'page',
      'pageSize',
      'total',
    ]);
  });

  it('CustomerLookupResponseDto khai đủ found/sdt/customer (FE điền sẵn form từ đây)', () => {
    const document = buildOpenApiDocument(app);
    const schema = document.components?.schemas?.CustomerLookupResponseDto as {
      required?: string[];
    };

    expect([...(schema.required ?? [])].sort()).toEqual([
      'customer',
      'found',
      'sdt',
    ]);
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

  it('spec chứa 4 route GHI nguồn khách + 2 DTO ghi (Story 3.5 — màn cấu hình gen được từ đây)', () => {
    // Drift-guard byte-for-byte chỉ chứng minh spec KHỚP code; nó xanh y hệt nếu code quên hẳn
    // một route. Hợp đồng CÓ MẶT là khẳng định khác — bài học lặp lại từ 3.2/3.3/3.4.
    const document = buildOpenApiDocument(app);
    expect(document.paths['/customer-sources'].post).toBeDefined();
    expect(document.paths['/customer-sources/{id}'].patch).toBeDefined();
    expect(document.paths['/customer-sources/{id}'].delete).toBeDefined();
    expect(
      document.paths['/customer-sources/{id}/reactivate'].post,
    ).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateCustomerSourceRequestDto).toBeDefined();
    expect(schemas.UpdateCustomerSourceRequestDto).toBeDefined();
  });

  it('🔴 DTO ghi nguồn khách KHÔNG phơi `isOther` / `active` — cờ "Khác" không có đường vào qua API', () => {
    // Bất biến "đúng một dòng isOther" không có index DB nào đứng sau: nó đứng được vì cờ KHÔNG
    // TỒN TẠI trong DTO ghi. Nếu ai đó thêm field ấy vào, chỗ này là nơi nó lộ ra — và cùng lúc
    // hợp đồng công khai sẽ nói với FE rằng cờ set được, điều không đúng.
    const document = buildOpenApiDocument(app);
    const schemas = document.components?.schemas ?? {};

    for (const name of [
      'CreateCustomerSourceRequestDto',
      'UpdateCustomerSourceRequestDto',
    ]) {
      const props = Object.keys(
        (schemas[name] as { properties?: Record<string, unknown> })
          .properties ?? {},
      );
      expect(props).not.toContain('isOther');
      expect(props).not.toContain('active');
    }

    // `name` bắt buộc lúc TẠO; lúc PATCH thì không (sửa mỗi mô tả là hợp lệ).
    const tao = schemas.CreateCustomerSourceRequestDto as {
      required?: string[];
    };
    expect(tao.required).toEqual(['name']);
  });

  it('MỌI route khách hàng đòi bearer — không route nào công khai (AD-4)', () => {
    // Đây là danh bạ khách: SĐT, CCCD, MST, tài khoản ngân hàng. Một route quên guard là đường
    // cho mọi người đã đăng nhập đọc trọn danh bạ. Spec là nơi cái quên đó lộ ra.
    const document = buildOpenApiDocument(app);
    const operations = [
      document.paths['/customers'].post,
      document.paths['/customers'].get,
      document.paths['/customers/lookup'].get,
      document.paths['/customers/{sdt}'].get,
      document.paths['/customers/{sdt}'].patch,
      document.paths['/customer-sources'].get,
      document.paths['/customer-sources'].post,
      document.paths['/customer-sources/{id}'].patch,
      document.paths['/customer-sources/{id}'].delete,
      document.paths['/customer-sources/{id}/reactivate'].post,
    ];

    for (const operation of operations) {
      expect(operation?.security).toEqual([{ bearer: [] }]);
    }
  });

  it('spec chứa 7 operation gói vật tư + 6 DTO (picker báo giá gen được client từ đây)', () => {
    // Drift-guard byte-for-byte chỉ chứng minh spec KHỚP code; nó xanh y hệt nếu code quên hẳn
    // một route. Hợp đồng CÓ MẶT là khẳng định khác — bài học lặp lại từ 3.2/3.3/3.4/3.5.
    const document = buildOpenApiDocument(app);
    expect(document.paths['/product-groups'].get).toBeDefined();
    expect(document.paths['/product-groups'].post).toBeDefined();
    expect(document.paths['/product-groups/{id}'].get).toBeDefined();
    expect(document.paths['/product-groups/{id}'].patch).toBeDefined();
    expect(document.paths['/product-groups/{id}'].delete).toBeDefined();
    expect(
      document.paths['/product-groups/{id}/reactivate'].post,
    ).toBeDefined();
    expect(document.paths['/product-groups/{id}/items'].put).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateProductGroupRequestDto).toBeDefined();
    expect(schemas.UpdateProductGroupRequestDto).toBeDefined();
    expect(schemas.ReplaceProductGroupItemsRequestDto).toBeDefined();
    expect(schemas.ProductGroupResponseDto).toBeDefined();
    expect(schemas.ProductGroupDetailResponseDto).toBeDefined();
    expect(schemas.ProductGroupItemResponseDto).toBeDefined();
  });

  it('🔴 KHÔNG DTO nào của gói vật tư phơi `costPrice` — giá vốn không có cửa mới nào để rời server', () => {
    // Đường `/products` gác giá vốn sau quyền `costs.view`. Gói là một CỬA MỚI vào cùng dữ liệu
    // sản phẩm, nên HỢP ĐỒNG CÔNG KHAI của nó phải nói rõ: gói không bao giờ mang giá vốn.
    //
    // ⚠️ Ca này canh HỢP ĐỒNG (file DTO), KHÔNG canh service. Dự án không có
    // `ClassSerializerInterceptor`, và controller ép kiểu object của service sang DTO — nên nếu ai
    // đổi `select` thành `include: { product: true }` mà không đụng file DTO, spec vẫn sạch và ca
    // này vẫn XANH. Cái rò TRÊN DÂY do e2e (`GET /product-groups/:id`, fixture có `costPrice`) và
    // lane DB (Postgres thật, cột có giá trị) canh. Ba lớp, ba chỗ khác nhau — đừng nhầm lớp.
    const document = buildOpenApiDocument(app);
    const schemas = document.components?.schemas ?? {};

    for (const name of [
      'ProductGroupResponseDto',
      'ProductGroupDetailResponseDto',
      'ProductGroupItemResponseDto',
    ]) {
      expect(JSON.stringify(schemas[name])).not.toMatch(/costPrice/);
    }

    // Và DTO ghi không phơi `isActive`: tắt/bật đi route riêng, không qua POST/PATCH tuỳ tiện.
    for (const name of [
      'CreateProductGroupRequestDto',
      'UpdateProductGroupRequestDto',
    ]) {
      const props = Object.keys(
        (schemas[name] as { properties?: Record<string, unknown> })
          .properties ?? {},
      );
      expect(props).not.toContain('isActive');
    }
  });

  it('MỌI operation gói vật tư đòi bearer — không route nào công khai (AD-4)', () => {
    const document = buildOpenApiDocument(app);
    const operations = [
      document.paths['/product-groups'].get,
      document.paths['/product-groups'].post,
      document.paths['/product-groups/{id}'].get,
      document.paths['/product-groups/{id}'].patch,
      document.paths['/product-groups/{id}'].delete,
      document.paths['/product-groups/{id}/reactivate'].post,
      document.paths['/product-groups/{id}/items'].put,
    ];

    for (const operation of operations) {
      expect(operation?.security).toEqual([{ bearer: [] }]);
    }
  });

  it('spec chứa POST /orders/preview-total + 3 schema PreviewTotal* (FE gen được client preview, AD-12)', () => {
    // Drift-guard byte-for-byte chỉ chứng minh spec KHỚP code; nó xanh y hệt nếu code quên
    // hẳn route. Hợp đồng CÓ MẶT là khẳng định khác — bài học lặp lại từ 3.2..3.5.
    const document = buildOpenApiDocument(app);
    expect(document.paths['/orders/preview-total'].post).toBeDefined();
    // Đòi bearer — preview cũng gate quyền như mọi route orders (AD-4).
    expect(document.paths['/orders/preview-total'].post?.security).toEqual([
      { bearer: [] },
    ]);

    const schemas = document.components?.schemas ?? {};
    expect(schemas.PreviewTotalRequestDto).toBeDefined();
    expect(schemas.PreviewTotalLineDto).toBeDefined();
    expect(schemas.PreviewTotalResponseDto).toBeDefined();

    // Response ĐỦ 3 field bắt buộc — client chỉ hiển thị, không suy diễn field nào (AD-16).
    const response = schemas.PreviewTotalResponseDto as { required?: string[] };
    expect([...(response.required ?? [])].sort()).toEqual([
      'subtotal',
      'total',
      'vatAmount',
    ]);
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
