# Test Automation Summary — Story 2.4 (Registry quyền chính tắc + lưu quyền theo account)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Người chạy:** Đại Ca
**Framework:** Jest + ts-jest (có sẵn trong `backend/`)

## Bối cảnh phạm vi test

Story 2.4 là feature **backend thuần, KHÔNG có bề mặt HTTP** (controller/`/me` = Story 2.5).
Vì vậy không có API/E2E theo nghĩa request HTTP để sinh; "end-to-end" ở đây = phủ đủ
**hợp đồng thật** của feature: registry SSOT, role-preset, service đọc/ghi quyền, artifact
sinh tự động, source-guard. Test giữ **hermetic** (mock Prisma, đọc file) — chạy được
không cần Postgres, mirror chiến lược Story 2.3.

## Gap phát hiện & đã tự động vá (auto-apply)

| # | AC | Gap | Rủi ro nếu bỏ | Đã vá |
|---|----|-----|---------------|-------|
| 1 | AC-1 | **Không test nào đọc file FE stub thật** để so registry byte-for-byte. `permission-registry.spec.ts` chỉ so literal HARDCODE trong chính test. | FE đổi tên literal (vd `orders.viewAll`) → không test backend nào bắt; Story 2.6 nối sai chuỗi. Đây là **action item Epic 1 retro** ("xác minh contract PermissionKey 1.10 khớp registry 2.4"). | ✅ `test/permission-registry-fe-stub-parity.spec.ts` (mới) |
| 2 | AC-2 | **`setForAccount([])`** (thu hồi tất cả quyền / vô hiệu account — thao tác Epic 8) chưa test. | Regression im lặng ở đường "bỏ tick hết"; không xác nhận vẫn atomic delete + createMany rỗng. | ✅ thêm case vào `test/account-permissions.service.spec.ts` |

## Test đã sinh / mở rộng

### Cross-repo drift-guard (mới)
- [x] `test/permission-registry-fe-stub-parity.spec.ts` — đọc CHÍNH `web/…/permissions.ts` +
  `mobile/…/app_permissions.dart`, khẳng định mọi permission literal FE ∈ registry backend
  (byte-for-byte) và đủ 3 literal FE-stub (`orders.view_all`/`audit.read`/`permissions.manage`).
  Fail rõ ràng nếu file FE thiếu (không im lặng xanh). *(view_own là entry backend-tường-minh
  AC-2, FE suy scope từ có/không view_all nên không khai literal riêng.)*

### Service data-API (mở rộng)
- [x] `test/account-permissions.service.spec.ts` — thêm case `setForAccount([])`: thu hồi
  toàn bộ quyền qua transaction atomic (delete + createMany rỗng).

## Coverage theo AC

- **AC-1 (registry SSOT + artifact + source-guard):** key duy nhất · đủ 4 key · naming snake_case ·
  17 key · type-guard · drift-guard artifact byte-for-byte · source-guard không literal ngoài
  registry · **+ parity với FE stub thật (mới)** ✅
- **AC-2 (RBAC per-account, view_all vs view_own):** hai entry tường minh · `listForAccount`
  (map→Set, rỗng) · `setForAccount` (validate key lạ→ném, atomic, khử trùng, **+ thu hồi tất cả**) ✅
- **AC-3 (`audit.read` chỉ Super Admin):** chỉ SUPER_ADMIN preset chứa `audit.read` · đúng một
  preset · mọi key ∈ registry. Bất biến hermetic mà seed phụ thuộc (preset ⊇ audit.read, dedup)
  đã phủ; phần ghi `account_permissions` end-to-end + seed super admin = **integration khi có
  Postgres** (đúng thiết kế 2.4/2.3 — KHÔNG refactor `seed.ts` chỉ để test) ✅
- **API/E2E HTTP:** N/A — Story 2.4 không có endpoint (guard/`/me` = Story 2.5).

## Kết quả chạy

```
cd backend && npx jest
Test Suites: 16 passed, 16 total   (baseline 15 → +1)
Tests:       92 passed, 92 total   (baseline 85 → +7, 0 regression)
lint: sạch · format:check: sạch
```

## Bước tiếp theo

- Chạy integration `account_permissions` end-to-end + seed super admin khi có Postgres (CI có DB).
- Story 2.5 build `/me` + `JwtAuthGuard` + `@RequirePermissions` → khi đó sinh API/E2E HTTP thật
  (status code, effective set, enforce theo quyền mỗi request — AD-4).

## Câu hỏi tồn đọng

- Không. Toàn bộ gap đã vá theo yêu cầu "auto-apply". Refactor `seed.ts` để unit-test được (thay
  vì integration) là **thay đổi production ngoài phạm vi sinh test** — cần chủ dự án quyết nếu muốn.
```
