# Test Automation Summary — Story 2.1 (Skeleton backend + Prisma + OpenAPI)

Workflow: `bmad-qa-generate-e2e-tests` · Framework: **Jest + Supertest + @nestjs/testing** (đã có sẵn) · Ngày: 2026-07-08

Backend chạy runtime thật (Node 24 / Nest 11 / Jest) → test là e2e/integration thật, hermetic (stub Prisma, không cần PostgreSQL trong CI).

## Baseline (dev-story) — 6 test

| File | Cover |
|---|---|
| `backend/test/health.spec.ts` | `GET /health` 200 + shape + ping DB (happy path, AC-1/AC-2) |
| `backend/test/prisma-wiring.spec.ts` | `PrismaModule` @Global + `PrismaService` inject được (AC-1) |
| `backend/test/no-manual-prisma-client.spec.ts` | source-guard: cấm `new PrismaClient(` ngoài PrismaService (AC-1) |
| `backend/test/openapi-drift.spec.ts` | drift-guard byte-for-byte + path `/health` có schema thật (AC-2) |

## QA workflow bổ sung — +4 test (gap analysis vs 3 AC)

| Gap phát hiện | AC | Test thêm |
|---|---|---|
| `/health` chưa có **error case** — chưa chứng minh endpoint thật sự phụ thuộc DB | AC-1 | `health.spec.ts` › khi `$queryRaw` reject → trả ≥500, KHÔNG báo `database: 'up'` |
| Chưa guard scope skeleton — route nghiệp vụ có leak không | AC-1 | `health.spec.ts` › `GET /accounts` → 404 (chỉ có endpoint hạ tầng) |
| Invariant "versioned" của spec chưa được assert | AC-2 | `openapi-drift.spec.ts` › `spec.info.version === package.json version` |
| Convention file kebab-case (AC-3) chưa có guard tự động | AC-3 | `naming-convention.spec.ts` › mọi file `src/**/*.ts` là kebab-case |

## Coverage theo Acceptance Criteria

- **AC-1 (DB owner duy nhất):** wiring + source-guard + happy-path ping + **error-path ping** + scope-guard route → chuỗi AD-1 được kiểm cả chiều thành công lẫn thất bại.
- **AC-2 (OpenAPI sinh-từ-code, versioned, cấm sửa tay):** drift-guard byte-for-byte + schema thật + **assert versioned**.
- **AC-3 (convention đặt tên):** file kebab-case guard tự động (phần enforce được ở skeleton chưa-có-model); còn lại là hợp đồng tài liệu trong `CONVENTIONS.md`, sẽ enforce khi model đầu land (Story 2.4 — `@@map` snake_case số nhiều).

## Kết quả

```
Test Suites: 5 passed, 5 total
Tests:       10 passed, 10 total   (6 baseline + 4 QA)
```

`npm run lint` sạch · `npm run format:check` sạch.

Ghi chú: log `[ExceptionsHandler] Error: DB unreachable` khi chạy suite là **noise mong đợi** từ test DB-down (Nest log exception đã bị catch) — không phải test fail.

## Next Steps

- Enforce AC-3 phần model (`@@map` snake_case số nhiều, entity PascalCase) khi Story 2.4 thêm entity `Account` đầu tiên.
- Khi Story 2.2 thêm exception filter + error envelope (AD-5), cập nhật assertion error-path `/health` để khớp shape lỗi chuẩn thay vì chỉ status ≥500.
