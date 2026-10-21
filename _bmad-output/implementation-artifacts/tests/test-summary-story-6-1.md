# Test Automation Summary — Story 6.1 (Nhánh Giao hàng: `dacoc → dagiao` tự lấy, gate nhiều cờ)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-21 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic, mock Prisma, `initAppOnLoopback`)
**Kết quả:** backend `npm test` 79 suite / **1516 test** xanh (trước QA: 1513)

## Phạm vi

Story đổi máy trạng thái ở domain (`allowed-transition.ts`); không màn nào đổi. Dev đã viết sẵn
domain (105 ca), executor (+5), e2e (+8), DB lane (+1). QA rà theo AC, chỉ vá lỗ còn hở ở lane HTTP.

## Gap phát hiện & auto-apply (`backend/test/orders.e2e.spec.ts`, describe "nhánh giao hàng đi hết chuỗi qua dây")

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC-3 | Tự lấy qua dây chưa kiểm vết audit: `AuditSubscriber` thật ghi đúng MỘT `StatusChanged` `dacoc→dagiao` | ✅ +1 ca |
| 2 | AC-5 | Phía đọc của cờ phủ định: đơn 3 cờ ở `dacoc` — `/vong-doi` không được chào `xong_giao` (mới chỉ kiểm POST ⇒ 409) | ✅ +1 ca (`buocKeTiep` = đúng `[bat_dau_thi_cong, bat_dau_giao]`) |
| 3 | AC-1 / Câu hỏi mở #2 | Đơn Thi công + Thiết bị, không Vận chuyển ở `dacoc` ⇒ hai nhánh song song qua dây; POST `xong_giao` ⇒ 200 `dagiao` | ✅ +1 ca |
| 4 | AC-7 | Ở `danggiao` (3 cờ), `/vong-doi` chưa kiểm bước kế = đúng `[xong_giao → dagiao]` | ✅ mở rộng ca có sẵn |

**Mutation kiểm canh:** bỏ `vanChuyen: false` khỏi dòng `dacoc → dagiao` ⇒ 2 ca e2e đỏ (409 có sẵn + ca #2 mới). Backup bằng `cp`, đã khôi phục, `cmp` khớp.

**Không thêm (đã phủ — tránh padding):** AC-2 (`scopeThietBi=false` không dựng được qua API — bằng chứng ở lane domain), AC-4/AC-10/AC-11 (domain), AC-9 (executor: publish sau commit, `toHaveBeenCalledTimes(1)`, tx chạy thân rồi ném), AC-8 (403 đã có).

**Không thêm có chủ đích:** test cho nhánh tự lấy của hai fake port demo (web/mobile). Không API công khai nào của fake đưa đơn tới `dacoc` (đợt cọc thuộc Epic 7), nên phải thêm cửa hậu chỉ để test. Mobile `_orders` là private theo library, không truy cập được từ test. Sẽ kiểm được khi Epic 7 có đường ghi cọc.

## Coverage theo AC (lane chứng minh)

| AC | Lane |
|----|------|
| AC-1 | domain + e2e (tự lấy, 3 cờ, Thi công + tự lấy) |
| AC-2 | domain |
| AC-3 | executor + e2e (ảnh, audit) + DB |
| AC-4, AC-10, AC-11 | domain |
| AC-5 | domain + executor + e2e (POST 409, `/vong-doi` không chào) |
| AC-6, AC-7, AC-8 | e2e |
| AC-9 | executor |

Endpoint: `GET /orders/:id/vong-doi`, `POST /orders/:id/chuyen-trang-thai` — 2/2 phủ cho nhánh giao.

## Kết quả chạy

- `npx jest test/orders.e2e.spec.ts -t "nhánh giao hàng đi hết chuỗi qua dây"` ⇒ 11/11
- `cd backend && npm test` ⇒ 79/79 suite, 1516/1516
- ESLint/Prettier: không lỗi mới trong đoạn đã thêm (drift của file nằm ngoài đoạn này, có sẵn)

## Bước tiếp theo

- Epic 7 (ghi cọc): thêm ca demo tự lấy cho fake port web + mobile khi đơn đã tới được `dacoc`.
- Story 6.4: hook phiếu xuất theo đích `to === 'dagiao'` (hai cạnh vào).
