---
baseline_commit: 11cde47912da529a63e1e0ff56eff661e5ede115
---

# Story 2.2: Error envelope thống nhất + xử lý lỗi tập trung

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên**,
I want **một exception filter trung tâm dựng envelope lỗi thống nhất và FE handle ở một chỗ**,
so that **mọi lỗi có cùng shape, không rải rác try/catch**.

## Acceptance Criteria

1. **Given** một lỗi bất kỳ ở backend, **When** filter trung tâm bắt, **Then** trả envelope `{ code (string enum có tài liệu), message, fieldErrors?: Array<{field, code, message}>, traceId }` + HTTP status chuẩn (AD-5).
2. **Given** yêu cầu một nơi dựng envelope, **When** kiểm code controller, **Then** KHÔNG controller nào tự nặn envelope; chỉ exception filter tạo (AD-5).
3. **Given** FE web/mobile, **When** nhận lỗi, **Then** một API interceptor duy nhất parse envelope và map `fieldErrors` vào field tương ứng (AD-5).

## Tasks / Subtasks

- [x] **Task 1 — Tạo `common/` + enum mã lỗi có tài liệu (AC: 1)**
  - [x] Tạo thư mục MỚI `backend/src/common/` (spine vẽ `common/` cho error envelope/exception filter/interceptor/guard — AD-4, AD-5). Story 2.1 **cố ý chưa** tạo folder rỗng; **story này là chủ sở hữu `common/`**.
  - [x] `common/errors/error-code.ts`: khai một **enum/`as const` mã lỗi** — `code` trong envelope là **string** lấy từ đây (AD-5 "enum có tài liệu"). Bộ khởi đầu **tối giản (YAGNI)**, chỉ mã cần cho skeleton + lỗi hạ tầng chung; story sau thêm mã domain của mình:
    - `VALIDATION_ERROR` (400 — DTO/ValidationPipe), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL` (500 — lỗi không lường trước).
    - Mỗi mã có **TSDoc mô tả** (đây là "tài liệu" của enum); là chuỗi ổn định, cross-repo (FE map theo mã, không theo message). **KHÔNG** đổi/xoá mã đã publish mà không cân nhắc breaking FE.
  - [x] **KHÔNG** nhét mã lỗi domain (pricing, transition, permission, stock…) vào đây — mỗi story domain sau tự khai mã của nó, tái dùng cùng enum pattern. Ghi rõ điều này trong TSDoc + `CONVENTIONS.md#Error envelope`.
- [x] **Task 2 — DTO envelope + field error cho OpenAPI (AC: 1, 3)**
  - [x] `common/errors/dto/field-error.dto.ts`: `FieldErrorDto { field: string, code: string, message: string }` với `@ApiProperty` (mirror mẫu `HealthResponseDto` — khai tường minh để OpenAPI có schema thật).
  - [x] `common/errors/dto/error-envelope.dto.ts`: `ErrorEnvelopeDto { code: string, message: string, fieldErrors?: FieldErrorDto[], traceId: string }` với `@ApiProperty` (đánh dấu `fieldErrors` `required: false`; `@ApiProperty({ type: [FieldErrorDto] })`). Đây là **hợp đồng lỗi cross-repo** — FE gen type từ đây (AC-3).
  - [x] Đảm bảo hai DTO **luôn xuất hiện trong `components.schemas`**: đã dùng `extraModels: [ErrorEnvelopeDto, FieldErrorDto]` ở tham số thứ 3 của `SwaggerModule.createDocument` trong `buildOpenApiDocument` (drift-guard ổn định vì cả gen lẫn test dùng chung hàm này).
- [x] **Task 3 — Exception filter trung tâm: NƠI DUY NHẤT dựng envelope (AC: 1, 2)**
  - [x] `common/errors/app.exception.ts`: base `AppException extends HttpException` mang `errorCode: ErrorCode` + `fieldErrors?` + `message` + HTTP status. Đây là cách code nghiệp vụ **ném lỗi có mã** mà **không tự dựng envelope** (filter mới dựng). Story sau `throw new AppException(ErrorCode.X, status, msg)`.
  - [x] `common/errors/all-exceptions.filter.ts`: `@Catch()` global filter — **nơi DUY NHẤT** tạo envelope (AD-5). Map:
    - `AppException` → dùng `errorCode`/`fieldErrors`/status của nó.
    - `HttpException` chuẩn của Nest (`NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `ConflictException`, `BadRequestException`…) → map theo HTTP status sang `ErrorCode` tương ứng + giữ HTTP status của exception.
    - Lỗi **không lường trước** (Error thường) → `ErrorCode.INTERNAL` + HTTP 500 + message **generic** ("Lỗi hệ thống"), **KHÔNG leak** stack/chi tiết nội bộ ra response; **log đầy đủ server-side** (kèm traceId để tra).
  - [x] Sinh `traceId` mỗi request: tái dùng header `x-request-id` nếu có (trace xuyên tầng), else `crypto.randomUUID()` (node:crypto, UUID v4). Trả `traceId` trong envelope + gắn vào log dòng lỗi INTERNAL.
  - [x] Đăng ký filter qua `APP_FILTER` provider trong `common/common.module.ts` (DI-friendly, tự áp cho MỌI app-context runtime/OpenAPI/e2e) — chốt Open Question #3. `main.ts` không còn `useGlobalFilters/Pipes`.
- [x] **Task 4 — ValidationPipe → `fieldErrors` có cấu trúc (AC: 1)**
  - [x] `common/validation/validation-pipe.factory.ts`: `ValidationPipe` (`whitelist`/`transform`) + **`exceptionFactory`** map `ValidationError[]` → **một `AppException(VALIDATION_ERROR)`** mang `fieldErrors` (`{ field: dotted-path, code: constraint-key, message }`, phẳng cả `children`); **filter mới dựng envelope** (giữ AD-5).
  - [x] Giữ nguyên `whitelist: true`/`transform: true`. Đăng ký pipe qua `APP_PIPE` trong `CommonModule` → runtime (`main.ts`) và mọi app-context test/OpenAPI dùng **cùng** một instance cấu hình (triệt lệch runtime↔test).
- [x] **Task 5 — Source-guard: cấm controller tự nặn envelope (AC: 2)**
  - [x] Trích `stripToCode` state-machine thành helper dùng chung `backend/test/util/strip-to-code.ts` (2.1 `no-manual-prisma-client.spec.ts` nay import từ đây — DRY, **không viết lại** parser).
  - [x] `backend/test/no-controller-error-envelope.spec.ts`: quét `src/**/*.controller.ts` + `*.service.ts` trên **code đã strip comment**; **fail nếu** xuất hiện `traceId` (chỉ filter/DTO được nhắc — field **chỉ** envelope có → bằng chứng dựng envelope tay ở nơi khác).
- [x] **Task 6 — Regen OpenAPI + drift-guard (AC: 1, 3)**
  - [x] Chạy `npm run openapi:gen` → `openapi/openapi.json` giờ chứa `ErrorEnvelopeDto` + `FieldErrorDto` trong `components.schemas` (artifact regen committed, AD-12).
  - [x] `openapi-drift.spec.ts`: giữ so byte-for-byte + thêm assert `components.schemas.ErrorEnvelopeDto` & `FieldErrorDto` **tồn tại** (chứng minh FE gen được type — AC-3). Không sửa tay spec.
- [x] **Task 7 — e2e cho các nhánh lỗi (AC: 1)**
  - [x] `backend/test/error-envelope.spec.ts` (supertest + Nest testing, hermetic — chỉ import `CommonModule` + controller CHỈ-TEST, không cần PostgreSQL): `NotFoundException` → 404 + `NOT_FOUND` + `traceId`; `AppException(CONFLICT)` → 409 + đúng mã; lỗi thường → 500 + `INTERNAL` + message generic (**assert KHÔNG chứa** `SECRET_STACK_DETAIL`); body sai DTO → 400 + `VALIDATION_ERROR` + `fieldErrors[{field,code,message}]`. Assert **shape envelope thống nhất** (`code/message/traceId`) ở mọi nhánh.
  - [x] Cập nhật assert lỗi ở `health.spec.ts` (DB-unreachable): nay khớp envelope `INTERNAL` 500 + message generic + `traceId` + **không leak** "DB unreachable" (mạnh hơn, không làm yếu). Bỏ `useGlobalPipes` thủ công (nay áp qua `APP_PIPE`).
  - [x] Chạy `npm run lint` + `npm test` + `npm run build` **sạch**; regen OpenAPI trước khi chạy drift-guard.

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này **CHỈ** dựng **cơ chế xử lý lỗi tập trung** ở backend: `common/` + enum mã lỗi + `ErrorEnvelopeDto`/`FieldErrorDto` (publish qua OpenAPI) + **một** exception filter trung tâm (nơi DUY NHẤT dựng envelope) + ValidationPipe→fieldErrors + guard/e2e. **Không** giao tính năng nghiệp vụ, **không** thêm mã lỗi domain.
- **Ngoài phạm vi (thuộc story khác — ĐỪNG làm ở đây):**
  - **Auth/JWT + lỗi đăng nhập** (`auth/`) → **Story 2.3**. 2.2 chỉ **định nghĩa** `UNAUTHENTICATED`/`FORBIDDEN` sẵn trong enum; 2.3 mới *ném* chúng từ luồng auth thật.
  - **Permission registry + guard quyền server-side** → **2.4/2.5** (guard sẽ `throw ForbiddenException`/`AppException(FORBIDDEN)` → filter dựng envelope; 2.2 không tạo guard quyền).
  - **Mã lỗi domain** (pricing/VAT, `applyTransition`, snapshot, chặn tồn, trùng SĐT…) → story sở hữu tương ứng (E3+). Mỗi story tự khai mã của nó theo cùng enum pattern.
  - **Guard/interceptor khác trong `common/`** (auth guard, logging interceptor) → story cần chúng tạo; 2.2 chỉ tạo **exception filter** (+ helper tối thiểu filter cần).
- **FE interceptor (AC-3) — quyết định phạm vi:** web/mobile **hiện chưa có tầng HTTP client nào** (web: chỉ `web/src/design-system/`, **chưa** có tooling runtime/tsc/bundler — xác nhận project-context "web tooling tới hết Epic 1"; mobile: chỉ `mobile/lib/design_system/` + `screens/auth`, **không** có Dio/http client). **Chưa có interceptor để gắn vì chưa có client gọi API.** Cuộc gọi FE→API **thật đầu tiên** là **đăng nhập (Story 2.3)**. Vì vậy 2.2 **publish hợp đồng envelope ngay** (DTO trong OpenAPI + tài liệu shape) để FE gen type; **hiện thực "một interceptor duy nhất parse envelope + map fieldErrors" land cùng client HTTP đầu tiên ở 2.3** (single-handling-point là **ràng buộc bắt buộc** ghi vào hợp đồng, không phải rải rác try/catch). Đây là lựa chọn KISS/YAGNI, khớp build-order + tiền lệ 2.1 (hoãn web runtime "nối khi dựng web app Epic 2"). **Xem Open Questions #1 — cần chủ dự án xác nhận** hoặc yêu cầu làm interceptor ngay ở 2.2.

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-5 — Error envelope thống nhất + xử lý lỗi tập trung:** MỘT shape `{ code, message, fieldErrors?, traceId }` + HTTP status chuẩn; `code` là **string** từ **enum mã lỗi có tài liệu**; `fieldErrors: Array<{ field, code, message }>`. **Một exception filter trung tâm là NƠI DUY NHẤT tạo envelope** — không controller nào tự dựng. FE handle ở MỘT chỗ (API interceptor). [Source: ARCHITECTURE-SPINE.md#AD-5, epics.md#Additional Requirements]
- **AD-12 — OpenAPI sinh-từ-code, cấm sửa tay:** thêm `ErrorEnvelopeDto`/`FieldErrorDto` = sửa **code** rồi `npm run openapi:gen`; **CẤM sửa tay** `openapi.json`; drift-guard so byte-for-byte. FE gen client (type lỗi) từ spec này. [Source: ARCHITECTURE-SPINE.md#AD-12]
- **Layered (4 tầng):** filter/interceptor/guard/DTO envelope thuộc tầng **API (`common/`)**. Domain **không** phụ thuộc Infrastructure; `AppException` là hợp đồng lỗi để Application/Domain ném lên, filter (API) dịch sang envelope. [Source: ARCHITECTURE-SPINE.md#Design Paradigm, #Backend module tree]
- **Contract-first:** BE định nghĩa shape lỗi **trước** → publish qua OpenAPI → FE gen type. Không bên nào tự bịa field lỗi. [Source: project-context.md#API Contract]
- **KHÔNG leak nội bộ:** lỗi 500 trả message generic + `INTERNAL`; chi tiết/stack chỉ log server-side (kèm traceId). An toàn > tiện debug ở client (project-context "khi phân vân chọn phương án chặt hơn").

### Đọc file bị SỬA (bắt buộc — trước khi code)

Story này **UPDATE** vài file skeleton 2.1. Đọc kỹ, giữ hành vi hiện có:

- `backend/src/main.ts` — hiện: `import 'dotenv/config'` (phải giữ **đứng đầu**, trước import đọc `process.env`), `NestFactory.create`, `ValidationPipe` global (`whitelist`+`transform`), validate `PORT`, `app.listen`. **2.2 thêm:** `useGlobalFilters` + `exceptionFactory` cho ValidationPipe. **Giữ:** thứ tự dotenv, validate PORT, ValidationPipe options.
- `backend/src/app.module.ts` — hiện: chỉ import `PrismaModule` + `HealthModule`; **cố ý KHÔNG import module domain**. **2.2 thêm:** `CommonModule` (nếu dùng `APP_FILTER` provider). **KHÔNG** import module domain khác.
- `backend/src/openapi/openapi-document.ts` — hiện: `buildOpenApiDocument(app)` = `DocumentBuilder`+`SwaggerModule.createDocument(app, config)`; `serializeOpenApiDocument` (JSON 2-space + newline cuối, **deterministic** cho drift-guard). **2.2 thêm:** `extraModels` cho envelope DTO nếu chọn cách đó — sửa **cùng một hàm** (cả gen lẫn drift test gọi chung → không lệch).
- `backend/scripts/openapi-app-context.ts` (chưa đọc — **đọc trước khi sửa**) + `backend/test/health.spec.ts`/`openapi-drift.spec.ts` — nếu filter đăng ký qua `main.ts` (không qua module), app-context OpenAPI/e2e phải áp **cùng** filter/pipe để test phản ánh runtime. Ưu tiên `APP_FILTER` trong `CommonModule` để tự áp cho mọi app-context (DI-friendly).

### Tái dùng (scout-before-code — DRY)

- **`stripToCode` state-machine** đã tồn tại ở `backend/test/no-manual-prisma-client.spec.ts` (parser bỏ comment/string, chống false-positive/negative — đã qua review đối kháng 2.1, obs 14430/14438). **Tái dùng cho source-guard 2.2** — cân nhắc trích thành `backend/test/util/strip-to-code.ts` để cả hai guard import (surgical: chỉ trích nếu không phá test 2.1). **KHÔNG viết lại parser mới.**
- **Mẫu DTO + `@ApiProperty`** ở `health-response.dto.ts`; **mẫu drift-guard** ở `openapi-drift.spec.ts`; **mẫu naming-guard** ở `naming-convention.spec.ts`. Envelope DTO/test mirror các mẫu này — không phát minh phong cách mới.
- **Không tạo trùng:** chưa có `common/`, chưa có filter/enum lỗi nào (xác nhận: `find backend/src` chỉ có `prisma/ health/ openapi/`). Đây là code MỚI, không đè.

### Convention (CONVENTIONS.md — hợp đồng backend)

- File **kebab-case** (`all-exceptions.filter.ts`, `error-code.ts`, `error-envelope.dto.ts`) — `naming-convention.spec.ts` sẽ fail nếu lệch. Class **PascalCase** (`AllExceptionsFilter`, `ErrorEnvelopeDto`, `AppException`).
- `code`/`fieldErrors[].code` là **string enum** (không số). `traceId` string (UUID v4). Không tiền/ngày ở story này nên bỏ qua quy ước integer-đồng/ISO-8601 (không liên quan).
- Cập nhật `CONVENTIONS.md` (hoặc thêm `common/README`): tài liệu **shape envelope + danh sách mã lỗi** (đây là "enum có tài liệu" của AD-5) + luật "chỉ filter dựng envelope; code nghiệp vụ ném `AppException`/HttpException".

### Tra cứu kỹ thuật (pin version — khớp 2.1)

- **NestJS 11.1.27** — dùng `@Catch()` + `ExceptionFilter`/`ArgumentsHost` (API filter Nest 11 giữ nguyên chữ ký cổ điển). `APP_FILTER` token từ `@nestjs/core`. `HttpException.getStatus()`/`getResponse()`.
- **class-validator 0.15 / class-transformer 0.5** (đã có ở 2.1) — `ValidationError` có `.property` + `.constraints` (map → `fieldErrors`). Không thêm lib mới.
- **`@nestjs/swagger` 11.4.5** — `@ApiExtraModels`/`extraModels` (tham số thứ 3 của `createDocument`) để ép DTO vào `components.schemas`. `@ApiProperty({ type: [FieldErrorDto], required: false })`.
- **`crypto.randomUUID()`** (node:crypto, Node 24) cho `traceId` — **không** thêm dependency `uuid`.
- **KHÔNG** thêm phụ thuộc ngoài phạm vi (không jwt/passport/pino… — thuộc story sau; logger dùng `Logger` sẵn của Nest cho log lỗi server-side).

### Project Structure Notes

- Cây mục tiêu — 2.2 tạo phần **in đậm**:
  - `backend/src/common/` → **`errors/error-code.ts`**, **`errors/app.exception.ts`**, **`errors/all-exceptions.filter.ts`**, **`errors/dto/error-envelope.dto.ts`**, **`errors/dto/field-error.dto.ts`**, (**`common.module.ts`** nếu dùng `APP_FILTER`).
  - UPDATE: `backend/src/main.ts` (global filter + exceptionFactory), `backend/src/app.module.ts` (`CommonModule` nếu có), `backend/src/openapi/openapi-document.ts` (extraModels), `backend/openapi/openapi.json` (**regen**), `backend/CONVENTIONS.md` (tài liệu envelope/mã lỗi).
  - Test MỚI: `backend/test/error-envelope.spec.ts`, `backend/test/no-controller-error-envelope.spec.ts`, (`backend/test/util/strip-to-code.ts` nếu trích helper). UPDATE test 2.1 nếu envelope đổi shape lỗi `/health`.
- **Biến thể có chủ đích:** 2.1 cố ý **không** tạo `common/` (không có filter để chứa — folder rỗng đầu cơ là anti-pattern). **2.2 tạo `common/`** đúng lúc có nội dung. Không tạo `guards/`/`interceptors/` rỗng — story cần mới tạo.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — 3 AC verbatim (envelope shape + status; chỉ filter dựng; FE một interceptor map fieldErrors).
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — envelope `{ code (documented enum string), message, fieldErrors?, traceId }` + standard HTTP status; ONE central exception filter là nơi duy nhất build; FE handle ONE place (API interceptor) (AD-5).
- [Source: ARCHITECTURE-SPINE.md#AD-5] — shape + `code` string enum có tài liệu + `fieldErrors: Array<{field,code,message}>`; exception filter trung tâm là nơi DUY NHẤT tạo envelope.
- [Source: ARCHITECTURE-SPINE.md#Backend module tree] — `common/` = error envelope, exception filter, interceptors, guards (AD-4, AD-5).
- [Source: ARCHITECTURE-SPINE.md#AD-12] — OpenAPI sinh-từ-code, artifact versioned, cấm sửa tay; FE gen client từ spec.
- [Source: _bmad-output/project-context.md] — bất biến AD-5 (một central filter), contract-first (BE định error shape trước), coding style/lint, hiện trạng web tooling (chưa runtime), không leak nội bộ / chọn phương án chặt hơn.
- [Source: _bmad-output/implementation-artifacts/2-1-skeleton-backend-prisma-openapi-sinh-tu-code.md] — Ranh giới 2.1 ghi rõ "Error envelope + exception filter (AD-5) → Story 2.2"; mẫu DTO/`@ApiProperty`, drift-guard byte-for-byte, source-guard `stripToCode`, ValidationPipe đã bật, artifact `openapi/openapi.json`.
- [Source: _bmad-output/implementation-artifacts/tests/test-summary-story-2-1.md] — QA 2.1 note "cập nhật error assertion ở Story 2.2".

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (BMAD dev-story workflow)

### Debug Log References

- `npm run openapi:gen` → `openapi/openapi.json` regenerated (thêm `ErrorEnvelopeDto` + `FieldErrorDto` vào `components.schemas`).
- `npx jest` → 7 suites / 16 tests PASS (baseline 5/10 + 2 suite mới + 6 test mới). Log `ERROR [AllExceptionsFilter]` ở nhánh boom/DB-unreachable là **có chủ đích** — chứng minh lỗi INTERNAL được log đầy đủ server-side (không leak ra response).
- `npm run lint` clean; `npm run build` clean.

### Completion Notes List

- **AC-1 ✅** — `AllExceptionsFilter` (`@Catch()` global qua `APP_FILTER`) dựng envelope `{ code, message, fieldErrors?, traceId }` + HTTP status chuẩn cho mọi nhánh (AppException / HttpException Nest / lỗi thường). e2e phủ 404/409/500/400.
- **AC-2 ✅** — Filter là **nơi DUY NHẤT** dựng envelope; `no-controller-error-envelope.spec.ts` enforce (fail nếu controller/service nhắc `traceId`). Dùng chung `stripToCode` với source-guard 2.1 (trích `test/util/strip-to-code.ts`).
- **AC-3 (một phần — hợp đồng) ✅ / (interceptor) HOÃN → 2.3** — Publish hợp đồng envelope ngay qua OpenAPI (`ErrorEnvelopeDto`+`FieldErrorDto` trong `components.schemas` nhờ `extraModels`) để FE gen type. **Hiện thực "một interceptor duy nhất parse envelope + map fieldErrors" hoãn sang Story 2.3** cùng client HTTP đầu tiên (đăng nhập) — web/mobile hiện **chưa có tầng HTTP client** để gắn. Quyết định theo Open Question #1 (KISS/YAGNI, khớp build-order + tiền lệ 2.1). **Cần chủ dự án xác nhận.**
- **Quyết định Open Questions:** #1 publish-hợp-đồng-ngay/hoãn-interceptor-2.3 (trên); #2 `traceId` = `x-request-id` nếu có, else `randomUUID()`; #3 đăng ký filter+pipe qua `APP_FILTER`/`APP_PIPE` trong `CommonModule` (DI-friendly, tự áp mọi app-context → triệt lệch runtime↔test). Mở rộng #3 sang cả ValidationPipe (`APP_PIPE`) để cùng một cấu hình chạy ở runtime lẫn test.
- **Không thêm dependency** (dùng `node:crypto`, `Logger` Nest sẵn có; không uuid/jwt/pino). Mã lỗi domain để story sở hữu tự khai (YAGNI).

### File List

**Mới (`backend/src/common/`):**
- `backend/src/common/common.module.ts`
- `backend/src/common/errors/error-code.ts`
- `backend/src/common/errors/app.exception.ts`
- `backend/src/common/errors/all-exceptions.filter.ts`
- `backend/src/common/errors/dto/error-envelope.dto.ts`
- `backend/src/common/errors/dto/field-error.dto.ts`
- `backend/src/common/validation/validation-pipe.factory.ts`

**Mới (test):**
- `backend/test/error-envelope.spec.ts`
- `backend/test/no-controller-error-envelope.spec.ts`
- `backend/test/util/strip-to-code.ts` (helper dùng chung, không phải suite)

**Sửa:**
- `backend/src/main.ts` — bỏ `useGlobalPipes` (nay qua `APP_PIPE` trong `CommonModule`).
- `backend/src/app.module.ts` — import `CommonModule`.
- `backend/src/openapi/openapi-document.ts` — `extraModels` cho 2 DTO envelope.
- `backend/CONVENTIONS.md` — thêm mục "Error envelope — MỘT shape, MỘT nơi dựng (AD-5)".
- `backend/openapi/openapi.json` — regen (artifact, +57 dòng: 2 schema envelope).
- `backend/test/health.spec.ts` — align error assertion với envelope mới + bỏ pipe thủ công.
- `backend/test/openapi-drift.spec.ts` — assert 2 DTO envelope tồn tại trong schemas.
- `backend/test/no-manual-prisma-client.spec.ts` — import `stripToCode` từ `test/util/` (DRY).

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Tạo story context 2.2 (error envelope + xử lý lỗi tập trung): phạm vi `common/` + enum mã lỗi có tài liệu + `ErrorEnvelopeDto`/`FieldErrorDto` (OpenAPI) + exception filter trung tâm (nơi duy nhất dựng envelope) + ValidationPipe→fieldErrors + source-guard "controller không dựng envelope" + e2e các nhánh lỗi + regen/drift-guard OpenAPI. Ghi quyết định phạm vi FE interceptor (publish hợp đồng ngay, hiện thực interceptor cùng client HTTP đầu tiên ở 2.3 — Open Question #1). |
| 2026-07-08 | Hiện thực 2.2: tạo `common/` (enum mã lỗi, `AppException`, `AllExceptionsFilter`, DTO envelope, ValidationPipe factory, `CommonModule`); đăng ký filter+pipe qua `APP_FILTER`/`APP_PIPE`; `extraModels` publish 2 DTO qua OpenAPI (regen); source-guard AC-2 + trích `stripToCode` helper (DRY); e2e 4 nhánh lỗi; align `health.spec` với envelope mới. Lint/test/build sạch (7 suites/16 tests). Status → review. |

## Open Questions

1. **FE interceptor (AC-3) làm ở 2.2 hay 2.3?** Web/mobile **chưa có tầng HTTP client** (web chưa có runtime tooling; mobile chưa có Dio/http) → **chưa có gì để gắn interceptor**. Cuộc gọi FE→API thật đầu tiên là đăng nhập (2.3). Story này **publish hợp đồng envelope ngay** (DTO trong OpenAPI + tài liệu) và **đề xuất hiện thực "một interceptor duy nhất" cùng client HTTP đầu tiên (2.3)** như ràng buộc bắt buộc. **Cần chủ dự án xác nhận** phương án này, hoặc yêu cầu làm interceptor tối thiểu ngay ở 2.2 (rủi ro: speculative, không có runtime web để test).
2. **`traceId`: sinh mới hay nhận header?** Đề xuất: tái dùng `x-request-id` nếu client/proxy gửi, else `crypto.randomUUID()`. Chốt nếu hạ tầng VPS có convention request-id sẵn (ảnh hưởng tracing xuyên tầng về sau).
3. **Đăng ký filter: `useGlobalFilters` (main.ts) hay `APP_FILTER` (CommonModule)?** `APP_FILTER` DI-friendly (inject `Logger`) + tự áp cho mọi app-context test/OpenAPI. Đề xuất `APP_FILTER`; xác nhận trước khi Story 2.3+ thêm filter/guard khác vào `common/`.
