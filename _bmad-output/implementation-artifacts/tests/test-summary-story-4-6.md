# Test Automation Summary — Story 4.6 (Sửa Đơn đã chốt — bản update mới + lịch sử)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic, mock Prisma — không cần Postgres)
**Kết quả:** backend **861/861** xanh (54 suite, 858 → 861, +3 test mới + 1 test mở rộng) · mobile/design-system không đụng file → giữ kết quả dev phase (179 + analyze 0 issue · 275 xanh)

## Phạm vi

Story đã có bộ test dev-phase dày (7 unit + 4 e2e + 5 widget + 3 guard file). QA phase rà gap
coverage theo 6 AC, phát hiện **4 gap** — tất cả backend (unit ×2, e2e ×2) — và auto-apply
toàn bộ.

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | #1 | Con trỏ `currentVersionId` trỏ version **KHÔNG tồn tại** (dữ liệu hỏng) → 409, KHÔNG tx/event | Nhánh phòng thủ `currentVersion === null` (orders.service.ts) chưa có test nào chạm | ✅ `orders.service.spec.ts` |
| 2 | #1 | Bản hiệu lực **0 dòng** → tx vẫn trọn vẹn (version mới + repoint) nhưng KHÔNG gọi `createMany` rỗng | Guard `copies.length > 0` là gotcha Prisma 7 đã biết (bài học 3.6/4.5): CHỈ unit test bắt được nếu ai gỡ — chưa có test | ✅ `orders.service.spec.ts` (**mutation-checked**: gỡ guard thật → RED đúng assert `createMany).not.toHaveBeenCalled()` → revert `cp` backup → 67/67 xanh lại) |
| 3 | #1 | e2e: mo-lai trên đơn `'huy'` → **409 CONFLICT envelope chuẩn** qua exception filter, KHÔNG ghi/audit | 409 chỉ được chứng minh ở unit — chưa test nào chứng minh mapping qua controller/central filter (traceId, code) ở tầng HTTP | ✅ `orders.e2e.spec.ts` |
| 4 | #3 | e2e vòng đời bước 8: giá danh mục đổi **TIẾP sau re-chốt** (2_600_000 → 2_800_000) → GET giữ 2_600_000 | AC #3 nói nguyên văn "sau re-chốt sửa giá danh mục KHÔNG đổi giá bản mới" — lifecycle mới assert snapshot ĐÃ GHI trong DB giả, chưa chứng minh ĐƯỜNG ĐỌC frozen sau re-chốt | ✅ `orders.e2e.spec.ts` (mở rộng test vòng đời FR-6) |

**Không thêm (đã phủ — tránh padding):** happy payload từng op + versionNo n+1 không hardcode +
bảng copy 3 loại dòng + KHÔNG op chạm row cũ (unit a), thứ tự write→publish + before/after snapshot
(unit b), retry `baogia` idempotent không tx/event (unit c + e2e body-y-hệt-GET không double-audit),
race thua cổng ×2 nhánh (unit d), `huy`/`choduyet` 409 unit (e), view đọc bản MỚI + live-resolve
giá đã đổi — nghịch đảo FR-5 (unit f), 401/403 `orders.confirm` không thay `quotes.create_edit`
(e2e), 404 đơn ma (e2e), vòng đời FR-6 đầy đủ tạo→chốt→mở lại→sửa→re-chốt với mock stateful (e2e),
UI: 5 widget test mobile (happy/huỷ dialog/port throw/gate ẩn/baogia ẩn) + guard nhãn byte-identical
+ guard khoá ma chống replay bug 4.5 (đã mutation-check 2 nhánh ở dev phase) + parity `reviseOrder`.
`preview-total` sau mở lại: stateless (không đọc order) — không có gate để test riêng.

## Test theo file

### Unit — `backend/test/orders.service.spec.ts` (+2)
- [x] con trỏ bản hiệu lực trỏ version KHÔNG tồn tại ⇒ 409 CONFLICT, KHÔNG transaction, KHÔNG event
- [x] bản hiệu lực 0 dòng ⇒ tx trọn vẹn nhưng KHÔNG gọi createMany rỗng (gotcha Prisma 7 — mutation-checked)

### API / E2E — `backend/test/orders.e2e.spec.ts` (+1 test, +1 mở rộng)
- [x] đơn `'huy'` ⇒ 409 CONFLICT envelope chuẩn (code + traceId), KHÔNG ghi, KHÔNG audit
- [x] vòng đời FR-6 bước 8: giá danh mục đổi tiếp sau re-chốt ⇒ GET giữ giá đã đóng băng (đường đọc snapshot-first)

## Coverage sau QA

- AC #1 endpoint + tx 4 op + 403/404/409: **đủ** (thêm dangling-version 409, empty-lines guard, 409 HTTP envelope)
- AC #2 lịch sử bất biến: **đủ** (dev phase — negative assert KHÔNG op chạm row cũ, đã mutation-check dev phase)
- AC #3 sửa & re-chốt trên bản mới: **đủ** (thêm frozen-sau-re-chốt ở đường đọc; hai đợt đóng băng song song đã phủ)
- AC #4 idempotent + race + event sau commit: **đủ** (dev phase)
- AC #5 UI 2 nền tảng + fix gating 4.5: **đủ** (5 widget test + guard khoá ma; web không runtime — text-guard là lớp duy nhất, đã biết TD-1)
- AC #6 phạm vi để lại (6.6/5.4): **N/A** — không code, không test

## Lane

- `cd backend && npm test`: 861/861, 54 suite — xanh ngay lần đầu (không flake lần này)
- Mobile/design-system: không file nào đổi trong QA phase — kết quả dev phase còn hiệu lực (179 + 275)
- DB lane: vẫn không khả dụng (Docker headless — như Debug Log story); story không có migration mới nên không bắt buộc

## Unresolved

- Action item 4.4 còn treo: migration `20260717000000` chưa `migrate deploy` thật (chờ Postgres/Docker).
