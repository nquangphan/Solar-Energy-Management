# Test Automation Summary — Story 8.6 (Báo cáo lợi nhuận gộp, gate theo `costs.view`)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-30 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (hermetic, `initAppOnLoopback`) · web Vitest + Testing Library · mobile `flutter_test` + `bloc_test`
**Kết quả:** lane đã sửa xanh (backend 139 suite / 2827, web typecheck sạch + 47 file / 556). Lane DB, design-system, mobile không chạy lại: không sửa test hay code ở các lane đó.

## Phạm vi

Dev đã phủ dày (unit domain, service, e2e, DB 6 ca bắt buộc + đột biến SQL, web, mobile Cubit + màn, guard design-system). QA chỉ thêm ca còn trống. Mỗi ca mới có đột biến chứng minh ĐỎ mà **ca cũ không bắt** (cp backup → khôi phục + `cmp`).

## Gap phát hiện & auto-apply (5 ca, 3 nhóm)

| # | AC | Gap | Đã vá | Đột biến ⇒ ĐỎ |
|---|----|-----|-------|---------------|
| 1 | 1, 4 | Mọi ca `period=custom` ở e2e đều là 400 — chưa ca hợp lệ nào đi qua ValidationPipe thật ⇒ 200 | `backend/test/profit-report.e2e.spec.ts` — `?groupBy=month&period=custom&from=2026-07-01&to=2026-07-31` ⇒ 200, `from/to` phân giải, tham số instant `01/07 00:00+07` → `01/08 00:00+07` | controller bỏ `groupBy` khi chuyển query ⇒ ĐỎ (17 ca cũ vẫn xanh) |
| 2 | 1 | Ca 200 cũ chỉ gửi `groupBy=order` = giá trị mặc định ⇒ controller làm rơi `groupBy` vẫn xanh | cùng file, `it.each`: `groupBy=assignee`, `groupBy=source&period=year`, `period=month` ⇒ 200 + `groupBy` trả về đúng | cùng đột biến trên ⇒ 2 ca ĐỎ |
| 3 | 5 | Web: yêu cầu cũ **LỖI** về muộn (vé ở nhánh `catch`) — chỉ có ca trả lời THÀNH CÔNG về muộn (bài học 8.5) | `web/src/test/profit-report-screen.test.tsx` — bảng nhóm mới vẫn hiện, không câu lỗi, không nút Thử lại | bỏ `if (ticket !== latest.current) return;` trong `catch` ⇒ ĐỎ (13 ca cũ xanh) |
| 4 | 4, 5 | Web: yêu cầu còn bay khi chuyển sang Tuỳ chọn (awaitingDates) — mobile có ca này, web không | cùng file — trả lời muộn không vẽ KPI/bảng, vẫn "Chọn từ ngày và đến ngày" | tăng vé SAU nhánh awaitingDates ⇒ ĐỎ (13 ca cũ xanh) |

**Đột biến loại bỏ (không tính làm bằng chứng):** hỏng regex `@Matches` của `from` ⇒ 3 ca 400 cũ đã ĐỎ (tập `fieldErrors` lệch) — ca mới không phải lưới duy nhất.

**Không thêm (đã phủ — tránh padding):** 401/403 ×3 + quyền đọc tươi; 11 ca 400; công thức, half-up, Σ hàng = totals ×4 cách nhóm; mọi ca DB (huỷ, chưa xuất, INT4, version phiếu, ranh giới ngày VN, tháng VN, assignee null, nguồn retired); web nhóm/kỳ/ngày `min`/`max`/rỗng/lỗi/Thử lại/trả lời thành công muộn; mobile Cubit (carry-over, vé cả hai nhánh, awaitingDates, đóng sớm cả hai nhánh, `_parseDay`) + màn (tab/kỳ/ngày/Thử lại/skeleton/tháo màn); route + nav gate web/mobile; guard nhãn bắt buộc/không tự tính/parity `groupBy`/tiền.

## Coverage theo AC

| AC | Phủ |
|----|-----|
| 1 Một endpoint, 4 cách nhóm | domain, service, e2e (+ 3 `groupBy` qua HTTP), DB ×4, web + mobile chip/tab |
| 2 Công thức | domain (không/có chiết khấu, công lắp lãi 0, biên), DB (chiết khấu, INT4) |
| 3 Chỉ đơn đã xuất | DB (chưa xuất, công lắp, huỷ sau xuất, version phiếu) |
| 4 Kỳ | domain + service (month/year/custom), e2e 400 ×11 + custom hợp lệ 200, DB ranh giới |
| 5 KPI + Table | web/mobile render, formatter, `—`, rỗng, lỗi + Thử lại, vé chống trả lời muộn (thành công / lỗi / awaitingDates) cả hai nền tảng |
| 6 Nhãn bắt buộc | web/mobile render + guard design-system literal đứng riêng |
| 7 Gate `costs.view` | e2e 401/403/fresh, route + nav web/mobile |

API endpoint: 1/1. Màn: 2/2 (web + mobile).

## Kết quả chạy

- backend `npm test`: 139 suite / 2827 xanh (e2e profit 16 → 20); ESLint + Prettier sạch trên file e2e
- web `npm run typecheck` sạch; `vitest run` 47 file / 556 (screen 13 → 15)
- design-system, mobile, lane DB: không chạy lại (không đổi)

## Bước tiếp theo

- Code review story 8.6 (`bmad-code-review`).
- Câu hỏi mở của story (trừ chiết khấu, đơn chỉ công lắp, biên số nguyên) vẫn chờ Đại Ca xác nhận.
