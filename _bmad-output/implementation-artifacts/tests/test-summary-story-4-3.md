# Test Automation Summary — Story 4.3 (Cờ phạm vi & Loại khách preset)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend, hermetic mock Prisma) · flutter test (mobile) · node --test (design-system)
**Kết quả:** backend 51 suite / **776 test** xanh (+3 test QA mới) · mobile 163 test + analyze sạch (không đổi) · design-system 268 test (không đổi)

## Phạm vi

Feature 4.3 = preset cờ phạm vi theo `custType` lúc tạo Đơn + `PATCH /orders/:id` toggle
Thi công/Vận chuyển + chip UI parity 2 nền tảng. Web KHÔNG có runtime/tsc (nợ tooling đã ghi
trong project-context) → không có browser E2E; lớp "E2E" của dự án = backend e2e spec
(AppModule thật + ValidationPipe thật + guard thật) + widget test mobile + text-guard.

## Gap phát hiện & auto-apply (3 test mới)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | AC-3 | PATCH `{scopeThietBi: false}` → whitelist strip im lặng ⇒ 200, KHÔNG ghi, KHÔNG audit, cờ vẫn `true` | DTO doc + story notes TUYÊN BỐ "whitelist strip" nhưng không test nào chứng minh không có đường ghi tới cờ bất biến | ✅ `backend/test/orders.e2e.spec.ts` |
| 2 | AC-2 | PATCH smuggle `custType` kèm cờ hợp lệ ⇒ `custType` bị strip, payload ghi CHỈ chứa 2 cờ (`toHaveBeenCalledWith` khớp toàn bộ), response `custType` không đổi | AC ghi "custType KHÔNG đổi" nhưng chưa có test chặn đường đổi qua PATCH | ✅ `backend/test/orders.e2e.spec.ts` |
| 3 | AC-2 | Cả 2 cờ trong MỘT lần PATCH ⇒ `data` mang cả hai, view phản ánh cả hai | Service test chỉ phủ partial single-field; nhánh both-fields chưa kiểm | ✅ `backend/test/orders.service.spec.ts` |

**Mutation-check gap #1 (negative assert mới):** mở đường ghi thật (thêm `scopeThietBi` vào
DTO + empty-check + `data` của service) → test RED đúng chỗ (`orderRepo.update` bị gọi) →
revert bằng cp backup, diff xác nhận restore nguyên vẹn. Gap #2/#3 là value-assert trên mock
call (khớp toàn bộ object) — cấu trúc tự chứng minh, không cần mutation.

**Không thêm (đã phủ — tránh padding):**
- Preset: unit exhaustive trên `CUST_TYPES` (`scope-preset.spec.ts`) + assert TOÀN BỘ payload create cho CA_NHAN/THUONG_MAI (service spec).
- 401/403: bảng fail-closed e2e đã gồm `PATCH /orders/:id`.
- 400 (`"yes"`, `null`), 409 ngoài `baogia`, 404, body rỗng, event before→after + thứ tự write→publish, audit qua AuditSubscriber: đã có ở service + e2e từ dev phase.
- UI: 4 widget test mobile (2 preset + toggle partial đúng 1 cờ + port throw giữ giỏ/giữ state) + text-guard (nhãn byte-identical, đúng 2 toggle không có control Thiết bị, chip tĩnh, toggle không gọi preview-total — đã mutation-check 6 nhánh ở dev phase).

## Test theo file

### API / E2E — `backend/test/orders.e2e.spec.ts` (+2)
- [x] PATCH `scopeThietBi: false` bị whitelist strip IM LẶNG ⇒ 200, không ghi, không audit, cờ vẫn true
- [x] PATCH smuggle `custType` ⇒ strip: payload ghi chỉ 2 cờ, `custType` giữ `CA_NHAN`

### Unit service — `backend/test/orders.service.spec.ts` (+1)
- [x] Cả 2 cờ trong một lần PATCH ⇒ `data` mang cả hai, view phản ánh cả hai

## Coverage (feature 4.3)

- API: `POST /orders` (preset) + `PATCH /orders/:id` — 2/2 endpoint liên quan phủ đủ happy + 400/401/403/404/409 + 2 defense-boundary case mới.
- UI: 2/2 nền tảng (mobile widget test chạy thật; web qua text-guard — giới hạn tooling đã biết, không phải gap story).

## Next Steps

- Không có — 3 lane test đều xanh; gap boundary đã vá và mutation-check.
