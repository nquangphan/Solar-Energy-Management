# Test Automation Summary — Story 7.3 (Sinh Hợp đồng Thi công / Mua bán PDF)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (e2e hermetic qua `initAppOnLoopback`) + lane DB Postgres; web Vitest + Testing Library; mobile flutter_test; design-system node:test
**Kết quả:** backend `npx jest` **110 suite / 2230 test** xanh (+15 so với 2215 lúc dev) · prettier + eslint sạch trên 2 file sửa

## Phạm vi

Rà 15 AC dẫn xuất với test dev đã viết: domain `contract-domain.spec.ts`, `amount-in-words.spec.ts`, `company-legal-entity.spec.ts`; template `contract-template.spec.ts` (verbatim theo fixture nguồn); unit `contracts.service.spec.ts`, `settings.service.spec.ts`, `puppeteer-quote-renderer.spec.ts`; e2e `contracts.e2e.spec.ts`, `settings.e2e.spec.ts`; lane DB `contracts.db.integration.spec.ts`; web `contracts-screen.test.tsx` + `screens-render.test.tsx`; mobile `contracts_screen_test.dart` + `order_detail_screen_test.dart`; parity `design-system/screens/contracts.test.mjs`.

Domain/template/unit/UI phủ kín. Lỗ nằm ở tầng HTTP: vài nhánh chỉ có ở unit hoặc lane DB (lane DB không chạy trong `npm test`), và fixture e2e ghim cứng `versionNo: 1` cho mọi hợp đồng nên AC-8 "bản cũ giữ versionNo cũ" không đo được qua HTTP.

## Gap phát hiện & auto-apply

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-8 | Sửa đơn ⇒ version mới ⇒ hợp đồng mới mang `versionNo` mới, bản cũ giữ bản cũ: chỉ có ở lane DB; fixture e2e trả `versionNo: 1` cho mọi dòng | ✅ fixture: `VERSION_NO` theo `orderVersionId` (cả `orderVersion.findUnique` lẫn `contract.findMany`); e2e: 201 `versionNo` 1 → 2, dòng mang đúng `orderVersionId`, overview `versionNo: 2`, list `[[mới,2],[cũ,1]]` |
| 2 | AC-9 | Overview `generatable:false` + `blockedReason` cho nhánh noLines / noSchedule / mismatch chưa đo qua HTTP (mới có nhánh status); ca lịch không kiểm 0 render / 0 R2 / 0 audit | ✅ e2e `it.each` 3 nhánh: message, 0 `renderPdf`, 0 object, 0 `create`, 0 audit, overview cùng message |
| 3 | AC-9 | Đơn đã chốt và đã đi tiếp (`dacoc`/`thicong`/`nghiemthu`/`danggiao`/`dagiao`) ⇒ sinh được: chỉ domain, HTTP mới có `dachot` + `hoanthanh` | ✅ e2e `it.each` 5 trạng thái ⇒ 201, overview `generatable` |
| 4 | AC-6 | `occurredAt === createdAt` của response + payload audit chỉ có ở unit | ✅ e2e: audit `occurredAt` = `res.body.createdAt`, `after` = `{contractId, contractNo, contractType, orderVersionId, fileName}` khớp response; dòng DB khớp số + tên file |
| 5 | AC-10 | Có `contracts.generate` nhưng THIẾU cả `orders.view_all` lẫn `view_own` ⇒ 403 (`@RequireAnyPermissions`) chưa có ca nào | ✅ e2e `it.each` 3 route ⇒ 403, 0 render, 0 lookup hợp đồng |
| 6 | AC-10 (chiều dương) | `view_own` mới có ca owner (chỉ POST); assignee chưa có | ✅ e2e: assignee ⇒ overview 200, POST 201, tải PDF 200 đúng bytes |
| 7 | AC-5 | Qua HTTP mới có "7 field đổi ⇒ 7 upsert"; chưa có "đổi 2 key ⇒ đúng 2 upsert + 2 audit before→after" và "PUT y hệt (chỉ khác khoảng trắng) ⇒ 0 tx, 0 upsert, 0 audit" | ✅ e2e `settings.e2e.spec.ts`: cả hai, audit kiểm `targetId` + `before`/`after` từng key |

## Đột biến kiểm ca mới (cp backup, không git checkout, đã khôi phục — `cmp` khớp)

| Mutant | Kết quả |
|---|---|
| `contracts.service.ts` overview: `versionNo` của từng hợp đồng lấy từ version HIỆN TẠI | ĐỎ 1 — gap 1 (trước khi vá: sống ở `npm test`) |
| `contracts.controller.ts`: bỏ `@RequireAnyPermissions` khỏi POST | ĐỎ 1 — gap 5 |
| `settings.service.ts`: audit `before` = giá trị mới | ĐỎ 1 — gap 7 |
| `contracts.service.ts` overview: `generatable: true` cố định | ĐỎ 6 — gap 2 + ca status cũ |

Không đột biến: gap 3, 6 (ca dương — hỏng scope/blocker là đỏ), gap 4 (`new Date()` thay `issuedAt` trùng mili-giây ⇒ mutant không ổn định; unit dev đã giết).

## Test theo file (phần mới)

### API / E2E — `backend/test/contracts.e2e.spec.ts` (29 → 43 ca)
- [x] confirmed order already moved on (dacoc / thicong / nghiemthu / danggiao / dagiao) ⇒ 201, overview generatable
- [x] no lines / no schedule / schedule off total ⇒ nothing rendered, stored or audited; overview gives the same reason
- [x] the audit row carries the response timestamp, number and file name
- [x] order revised after the first contract ⇒ the new one prints the new version, the old keeps its own
- [x] GET overview / POST generate / GET pdf with contracts.generate but neither orders.view_all nor view_own ⇒ 403
- [x] assignee with view_own ⇒ overview, generate and download all allowed

### API / E2E — `backend/test/settings.e2e.spec.ts` (26 → 27 ca)
- [x] configured entity: PUT changing 2 fields ⇒ 2 upserts, 2 audit rows before→after; same body again ⇒ no write, no audit

## Coverage

- Endpoint: `GET/POST /orders/:id/contracts`, `GET /orders/:id/contracts/:contractId/pdf`, `GET/PUT /settings/company-legal-entity` — **5/5** có e2e cho 200/201 / 400 / 401 / 403 (thiếu quyền chức năng VÀ thiếu quyền xem) / 404 (ngoài phạm vi, hợp đồng đơn khác) / 409.
- Nhánh blocker qua HTTP: status (3) · noLines · noSchedule · mismatch — **6/6**, cả POST lẫn overview.
- Backend AC-1 → AC-14: **14/14** có test (domain + template + unit + e2e + lane DB + guard).
- UI AC-15: web + mobile + parity guard **3/3**; mọi ca hành vi có ở cả hai nền tảng — không thêm.

## Kết quả chạy

- `cd backend && npx jest test/contracts.e2e.spec.ts` → 43/43 · `npx jest test/settings.e2e.spec.ts` → 27/27 · `npx jest` → 110 suite / 2230 test · `prettier --check` + `eslint` 2 file sạch
- Web, mobile, design-system: KHÔNG chạy lại (không đụng file nào; dev đã chạy xanh).
- Lane DB: KHÔNG chạy lại (không đụng file nào ở đó; dev đã chạy xanh 285/285).

## Bước tiếp theo

- Code review story 7.3.

## Câu hỏi tồn đọng

- Không có.
