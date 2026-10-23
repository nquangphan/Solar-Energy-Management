# Test Automation Summary — Story 8.3 (Form tạo/sửa/vô hiệu hoá Account)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-23 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend e2e qua `initAppOnLoopback`), Vitest + Testing Library (web), Flutter `flutter_test` + `bloc_test` (mobile), `node --test` (design-system).
**Kết quả:** web typecheck sạch, vitest **511/511** · mobile `flutter analyze` sạch, **1449/1449** · design-system **534/534** · backend lane hẹp (`accounts-crud.e2e` + `accounts.service` + `account-events`) **41/41**. Tất cả xanh.

## Phạm vi

Dev đã phủ AC 1–7 ở cả 5 lane: domain event (không lọt mật khẩu/hash), service (mock tx chạy callback, thứ tự kiểm, đọc quyền qua `tx`, thu hồi phiên, P2002 → field), e2e (gate, 400 ×7 dạng, 403 ×3, 404, 409, PUT có `password` ⇒ 400, `permission-options` không bị `:id` nuốt), DB lane (preset, E.164, lowercase, tạo đồng thời cùng SĐT/email, vô hiệu hoá + kích hoạt lại, interleaving khoá, thu quyền actor khi đang ghi), màn web/mobile + cubit + text-guard. Dev Agent Record ghi sweep đột biến backend 11, web 5, mobile 7 + carry-over 26, guard 5. QA không viết lại phần đó.

QA chạy **sweep đột biến độc lập** (23 mutant: 12 web, 9 mobile, 2 backend) vào chỗ dev chưa đột biến: kiểm ô trống từng field, lỗi field của email/họ tên/mật khẩu, kích hoạt lại, Huỷ/back, retry khi tải lỗi, điều hướng sau form sửa, action Lưu trên topbar mobile, nút preset khi đang lưu, summary trả về của backend.

Vòng 1: **2 ĐỎ (backend), 21 sống** (12/12 web, 9/9 mobile). Không mutant nào tương đương — cả 21 là lỗi người dùng thấy được.

## Gap phát hiện & auto-apply

| # | AC | Mutant sống | Vì sao là gap | Ca mới |
|---|----|-------------|---------------|--------|
| 1 | 2, 7 | W1/W2 web bỏ kiểm trống Họ tên / SĐT · W3 bỏ `.trim()` | Ca cũ chỉ xoá mật khẩu ⇒ Lưu bật với tên/SĐT trống hoặc toàn dấu cách | web "Lưu is disabled while the name, phone or email is blank or only spaces" |
| 2 | 2 | M1/M9 mobile bỏ kiểm trống Họ tên / SĐT · M2 bỏ kiểm mật khẩu | Ca cũ chỉ xoá Email | mobile "Lưu is disabled while the name, phone or password is blank" |
| 3 | 2 | W4/W5 web không hiện lỗi dưới ô Email / Họ tên | Chỉ ca SĐT + mật khẩu được kiểm; 409 email (AC 2) không hiện ở đâu cả | web (sửa) "field errors on the name and the email land under each input" |
| 4 | 2 | M3/M4 mobile không hiện lỗi dưới ô Email / Mật khẩu | Như #3 bên mobile | mobile "field errors on the email and the password sit under each input" (kiểm cả vị trí y) |
| 5 | 4 | W6 web nút "Kích hoạt" không đổi gì · M5 mobile cờ nào cũng gửi `setActive(false)` | Kích hoạt lại không làm được trên UI; mọi ca cũ chỉ bấm Tạm khoá | web + mobile "Kích hoạt on a deactivated account sends isActive true" |
| 6 | 7 | W7 Huỷ không gọi `onCancel` · W8 nút back topbar không gọi `onCancel` | `onCancel={() => {}}` trong mọi ca ⇒ không ca nào thấy nút thoát chết | web "Huỷ and the topbar back both leave through onCancel, nothing sent" |
| 7 | 7 | W9 web "Thử lại" không làm gì · M7 mobile `onRetry: null` | Chưa ca nào cho lần tải đầu hỏng | web + mobile "a failed load … Thử lại loads again" |
| 8 | 1, 3 | W10/W11 rời form sửa (lưu / huỷ) về `/permissions` mà không chọn lại account | Chỉ luồng tạo được kiểm ở mức route | web app-routes "leaving the edit form — saved or cancelled — lands on /permissions with that account selected" |
| 9 | 2 | W12 lưu lại không xoá lỗi cũ | Câu "SĐT đã thuộc…" vẫn hiện trong lúc lần lưu sau đang chạy | web "saving again clears the previous error while the new save is in flight" |
| 10 | 7 | M6 action "Lưu" trên topbar mobile không bao giờ gửi | Ca cũ chỉ assert `onAction == null` khi chưa đủ | mobile "the topbar Lưu sends the same create as the button" |
| 11 | 7 | M8 nút chọn preset vẫn bấm được khi đang lưu | Ca "đang lưu" chỉ kiểm Lưu + PopScope | assert thêm `preset-picker.onPressed == null` trong ca "while saving" |

**Không thêm (đã phủ):** B1 PUT trả summary của actor ⇒ e2e ĐỎ; B2 POST trả summary của actor ⇒ unit + e2e ĐỎ. Mặc định "Kích hoạt" khi tạo đã có ở `screens-render` (`aria-pressed="true"`).

## Bảng đột biến (QA)

Cách làm: script `cp` backup ra scratchpad, neo phải khớp đúng 1 lần, kiểm chuỗi chèn đã có, chạy lane, `cp` trả + `filecmp` bằng nguyên bản. Không `git checkout`, không mutant nào lỗi compile. Sau sweep: `cmp` 4 file nguồn với backup ⇒ nguyên vẹn.

Lane hẹp: web `account-form-screen` + `screens-render` + `app-routes` + `permissions-screen`; mobile `test/screens/permissions` + `test/app`; backend `accounts-crud.e2e` + `accounts.service` + `account-events`.

| Mutant | Vòng 1 | Sau QA |
|---|---|---|
| B1 · B2 | ĐỎ ×2 | — |
| W1 … W12 | XANH ×12 | **ĐỎ ×12** |
| M1 … M9 | XANH ×9 | **ĐỎ ×9** |
| **Tổng** | **2/23 ĐỎ** | **23/23 ĐỎ** |

## Test theo file

- [x] `web/src/test/account-form-screen.test.tsx`: +6 ca (trống/dấu cách từng ô, tải lỗi + Thử lại, Huỷ/back, lưu lại xoá lỗi cũ, kích hoạt lại, lỗi field Họ tên + Email); `renderForm` trả thêm `onCancel` spy. Prettier (`--single-quote --print-width 120`) sạch.
- [x] `web/src/test/app-routes.test.tsx`: +1 ca (rời form sửa bằng Lưu / Huỷ ⇒ `/permissions` chọn đúng account). Cảnh báo prettier còn lại ở dòng 536 (`SignedOutRoutes`) có từ trước, không đụng.
- [x] `mobile/test/screens/permissions/account_form_screen_test.dart`: +5 ca (trống từng ô, Lưu topbar, tải lỗi + Thử lại, lỗi field Email + Mật khẩu, kích hoạt lại) + assert nút preset disabled khi đang lưu. `dart format` sạch, `flutter analyze` sạch.

Không sửa mã nguồn sản phẩm. Backend không đổi file nào.

## Coverage theo AC

| AC | Trạng thái |
|---|---|
| 1 tạo nạp preset, đáp vào ma trận | ✅ dev (unit + e2e + DB + route web/mobile) |
| 2 SĐT bắt buộc, chuẩn hoá backend, 409 phone/email, lỗi dưới đúng ô | ✅ dev + gap 1, 2, 3, 4, 9 |
| 3 sửa account, không đổi quyền, 403/404 | ✅ dev + gap 8 |
| 4 vô hiệu hoá thu hồi phiên, kích hoạt lại | ✅ dev (unit + e2e + DB) + gap 5 (UI kích hoạt lại) |
| 5 audit qua event, không lọt mật khẩu | ✅ dev (event spec + unit + DB) |
| 6 ghi dưới khoá, quyền đọc tươi | ✅ dev (unit mock-forced + DB interleaving) |
| 7 parity web ↔ mobile, Cubit, design system | ✅ dev + gap 6, 7, 10, 11 |

API: 2/2 endpoint mới (`POST /accounts`, `PUT /accounts/:id`) — 201/200, 400 ×8 dạng, 403 ×4 dạng, 404, 409 phone/email. UI: 2/2 màn form (web `AccountFormScreen`, mobile `account_form_screen` + cubit) — mỗi màn có ca tạo / sửa / kích hoạt lại / lỗi field từng ô / lỗi không field / tải lỗi + retry / đang lưu / chỉ đọc; dây nối: nút Tạo/Sửa ở màn Phân quyền, route web gate + quay về chọn account, route mobile `new` trước `:id`.

## Kết quả chạy

- `cd web && npm run typecheck && npm test` → sạch · **511/511**
- `cd mobile && flutter analyze && flutter test` → sạch · **1449/1449**
- `cd design-system && npm test` → **534/534**
- `cd backend && npx jest test/accounts-crud.e2e.spec.ts test/accounts.service.spec.ts test/account-events.spec.ts` → **41/41**

## Next Steps

- Chạy `bmad-code-review` cho story 8.3 (status `review`).
- DB lane backend không chạy lại (không đổi file backend).
