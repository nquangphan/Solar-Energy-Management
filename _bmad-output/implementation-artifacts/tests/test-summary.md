# Test Automation Summary — Story 2.5 (`/me` + guard quyền server-side)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-09 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic — không cần Postgres)
**Kết quả:** 20 suite / **120 test** xanh · lint + format sạch

## Phạm vi

Backend-only feature (không UI). Sinh test **API/e2e** cho `GET /me`, hai guard toàn cục
(`JwtAuthGuard`, `PermissionsGuard`) và các decorator (`@Public`, `@RequirePermissions`,
`@CurrentAccount`). E2E dùng `AppModule` thật + override `PrismaService` no-op + mock service,
ký JWT thật bằng `JwtService` cùng secret (`await import()` động sau khi set `JWT_ACCESS_SECRET`).

## Gap phát hiện & auto-apply (2 test mở rộng, +3 case)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | AC-1 | `/me` khi effective set **rỗng** → `200 { permissions: [] }` | Happy path chỉ phủ set có phần tử; hành vi mảng rỗng tất định (FE dựng `PermissionSet` từ đó) chưa kiểm | ✅ `test/me.e2e.spec.ts` (+1 case) |
| 2 | AC-1 | Param decorator `@CurrentAccount` | Story đánh dấu optional, trước đó thiếu; chỉ được phủ **gián tiếp** qua `/me` | ✅ `test/auth-decorators.spec.ts` (+2 case: trả `request.account` / vắng → `undefined`) |

**Không thêm (đã phủ — tránh padding):** AND-semantics nhiều key (unit `permissions.guard.spec`),
account `isActive=false` → 401 (unit + e2e), sort tất định (case 200 đã đảo thứ tự input),
regression `@Public` cho `/health` + `/auth/*` (đã chứng minh end-to-end ở `auth.e2e.spec` +
`health.spec` chạy qua guard toàn cục).

## Test theo file

### API / E2E — `test/me.e2e.spec.ts`
- [x] `GET /me` không header → 401 envelope `UNAUTHENTICATED` (+ `traceId`, KHÔNG `fieldErrors`)
- [x] `GET /me` Bearer rác → 401 (verify fail, envelope generic)
- [x] `GET /me` Bearer hợp lệ → 200 shape đúng, `permissions` sorted, KHÔNG `passwordHash`
- [x] **(mới)** `GET /me` account không quyền → 200 `permissions: []`
- [x] `GET /me` account `isActive=false` → 401
- [x] `@RequirePermissions` thiếu quyền → 403 `FORBIDDEN`
- [x] `@RequirePermissions` đủ quyền → 200
- [x] Route guarded không token → 401 (chặn trước cả check quyền)

### Unit guard — `test/jwt-auth.guard.spec.ts`, `test/permissions.guard.spec.ts`
- [x] JwtAuthGuard: `@Public` skip · thiếu/sai/empty Bearer → 401 · verify throw → 401 (không leak) ·
  account null/inactive → 401 · hợp lệ → gắn `request.account` (KHÔNG `passwordHash`)
- [x] PermissionsGuard: `@Public` skip · không metadata → pass · `[]` → pass · đủ (AND) → pass ·
  thiếu ≥1 → 403 · `request.account` vắng → 401 fail-closed

### Unit decorator — `test/auth-decorators.spec.ts`
- [x] `@Public` set `IS_PUBLIC_KEY=true`
- [x] `@RequirePermissions(PERM.x, PERM.y)` set mảng đúng thứ tự · không tham số → `[]`
- [x] **(mới)** `@CurrentAccount` trả `request.account` · vắng → `undefined`

## Coverage theo AC

- **AC-1** (`/me` trả effective set): e2e shape + sorted + **empty-set (mới)** + no-leak `passwordHash`;
  `@CurrentAccount` unit **(mới)** ✅
- **AC-2** (enforce mỗi request 401/403): unit + e2e cả hai guard, gọi thẳng thiếu quyền → 403 ✅
- **AC-3** (client gating chỉ UX): guard toàn cục fail-closed là ranh giới duy nhất; route test-only
  chứng minh server từ chối bất kể client ✅

## Kết quả chạy

```
cd backend && npx jest
Test Suites: 20 passed, 20 total
Tests:       120 passed, 120 total   (baseline 117 → +3, 0 regression)
lint: sạch · format:check: sạch (không literal quyền — dùng PERM.*, AD-17)
```

## Bước tiếp theo

- Integration cần Postgres: đọc `account_permissions` thật qua `/me`, kiểm `isActive` DB thật — chạy khi CI có DB.
- Story 2.6 nối FE gating vào `/me` (web/mobile) — sẽ có e2e/UI phía FE.

## Câu hỏi tồn đọng

- Không. Gap đã vá theo yêu cầu "auto-apply". Coverage còn lại (đọc DB thật) là **integration** đúng
  thiết kế hermetic 2.3/2.4/2.5 — không refactor production chỉ để test.
