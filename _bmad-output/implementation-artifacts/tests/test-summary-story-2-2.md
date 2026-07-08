# Test Automation Summary — Story 2.2 (Error envelope thống nhất + xử lý lỗi tập trung)

Workflow: `bmad-qa-generate-e2e-tests` · Framework: **Jest + Supertest + @nestjs/testing** (đã có sẵn) · Ngày: 2026-07-08

Backend chạy runtime thật (Node 24 / Nest 11 / Jest) → test là e2e/integration thật, hermetic (chỉ import `CommonModule` + controller CHỈ-TEST; không cần PostgreSQL).

## Baseline (dev-story) — 16 test

| File | Cover |
|---|---|
| `backend/test/error-envelope.spec.ts` | e2e AC-1: `NotFoundException`→404 `NOT_FOUND`; `AppException(CONFLICT)`→409; lỗi thường→500 `INTERNAL` generic (không leak `SECRET_STACK_DETAIL`); body sai DTO→400 `VALIDATION_ERROR`+`fieldErrors[{field,code,message}]` |
| `backend/test/no-controller-error-envelope.spec.ts` | source-guard AC-2: không controller/service nào nhắc `traceId` (chỉ filter dựng envelope) |
| `backend/test/health.spec.ts` | DB-unreachable → envelope `INTERNAL` 500 generic + `traceId`, không leak "DB unreachable" (align 2.2) |
| `backend/test/openapi-drift.spec.ts` | AC-1/AC-3: `ErrorEnvelopeDto`+`FieldErrorDto` có trong `components.schemas` (FE gen type) |

## QA workflow bổ sung — +6 test (gap analysis vs 3 AC)

Phân tích hai bảng map của filter (`statusToErrorCode`, `resolveTraceId`) cho thấy nhiều nhánh đã hiện thực nhưng chưa có test.

| Gap phát hiện | AC | Test thêm (`error-envelope.spec.ts`) |
|---|---|---|
| `UNAUTHORIZED→UNAUTHENTICATED` (401) chưa test — mã enum chỉ khai, chưa được exercise | AC-1 | `UnauthorizedException` → 401 + `UNAUTHENTICATED` |
| `FORBIDDEN→FORBIDDEN` (403) chưa test — nhánh map cho guard quyền 2.4/2.5 | AC-1 | `ForbiddenException` → 403 + `FORBIDDEN` |
| CONFLICT mới test qua `AppException`; nhánh `HttpException` chuẩn Nest chưa | AC-1 | `ConflictException` chuẩn Nest → 409 + `CONFLICT` |
| Nhánh `default → INTERNAL` (status không nằm trong bảng map) chưa test | AC-1 | `HttpException(418)` → giữ 418 + fallback `INTERNAL` |
| `resolveTraceId` tái dùng `x-request-id` (Open Question #2 — trace xuyên tầng) **0 test** | AC-1 | Header `x-request-id` được phản chiếu vào `traceId` |
| Nhánh tự sinh UUID chưa được assert tường minh (không hằng số cứng) | AC-1 | Không header → 2 request cho 2 `traceId` khác nhau, không rỗng |

## Coverage theo Acceptance Criteria

- **AC-1 (envelope thống nhất + status chuẩn):** mọi nhánh của `AllExceptionsFilter` được phủ — `AppException` (CONFLICT), `HttpException` Nest (`NOT_FOUND`/`UNAUTHENTICATED`/`FORBIDDEN`/`CONFLICT`/`VALIDATION_ERROR`), status không map (fallback `INTERNAL` giữ status), lỗi thường (500 generic, không leak). Cả hai nhánh `traceId` (tái dùng header / tự sinh) được assert.
- **AC-2 (chỉ filter dựng envelope):** source-guard `no-controller-error-envelope.spec.ts` (quét code đã strip comment, cấm `traceId` ngoài filter/DTO) + drift-guard OpenAPI byte-for-byte.
- **AC-3 (hợp đồng lỗi publish qua OpenAPI):** `ErrorEnvelopeDto`+`FieldErrorDto` có trong `components.schemas` → FE gen type. *Interceptor FE parse/map hoãn sang Story 2.3 cùng client HTTP đầu tiên (đăng nhập) — không có runtime FE để test ở 2.2 (Open Question #1).*

## Kết quả

```
Test Suites: 7 passed, 7 total
Tests:       22 passed, 22 total   (16 baseline + 6 QA)
```

`npx eslint test/error-envelope.spec.ts` sạch.

Ghi chú: log `ERROR [AllExceptionsFilter] … Lỗi không lường trước` + stack `DB unreachable`/`SECRET_STACK_DETAIL` khi chạy suite là **noise mong đợi** từ nhánh 500 INTERNAL (filter log đầy đủ server-side kèm `traceId`, không leak ra response) — không phải test fail.

## Next Steps

- Story 2.3: hiện thực "một interceptor duy nhất" parse envelope + map `fieldErrors` cùng client HTTP đầu tiên; thêm test luồng lỗi đăng nhập thật ném `UNAUTHENTICATED`.
- Khi story domain thêm mã lỗi mới vào enum → thêm nhánh test tương ứng theo cùng pattern e2e này.
