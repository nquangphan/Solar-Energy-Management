# Test Automation Summary — Story 8.1 (Dashboard vận hành)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-23 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend e2e qua `initAppOnLoopback`), Vitest + Testing Library (web), Flutter `flutter_test` + `bloc_test` (mobile), `node --test` (design-system).
**Kết quả:** backend **2574/2574** · web typecheck sạch, vitest **460/460** · mobile `flutter analyze` sạch, **1354/1354** · design-system **524/524**. Tất cả xanh.

## Phạm vi

Dev đã phủ AC 1–9 ở cả 4 lane: unit kỳ thời gian (ranh giới VN, năm nhuận, qua năm), unit service (gate từng khối, mảng `scopeWhere` truyền nguyên), e2e (preset thật, 400 `fieldErrors.period`, 403, `revenue: null` trong body), DB lane (SUM > INT4, `paid_on` đúng kỳ, `created_at` nửa mở, `view_own`), màn web/mobile + cubit + guard tiền/port, cùng sweep đột biến backend và cubit ghi trong Dev Agent Record. QA không viết lại phần đó.

QA chạy **sweep đột biến độc lập phía màn + dây nối app** (12 mutant: 6 web, 6 mobile) và một mutant phía backend (route bị mở `@Public`). Lane hẹp: web `dashboard-screen` + `screens-render` + `app-routes` + guard `screens/dashboard.test.mjs`; mobile `test/screens/dashboard` + `signed_in_app_test` + guard.

Vòng 1: **4 ĐỎ, 8 sống** (W5 chỉ guard design-system bắt — chấp nhận, đúng lane của luật AD-2).

## Gap phát hiện & auto-apply

| # | AC | Mutant sống | Vì sao là gap | Ca mới / assert thêm |
|---|----|-------------|---------------|-----------------------|
| 1 | 1, 9 | W4 web bỏ `setState('loading')` khi đổi kỳ | Đổi Tháng → Tuần: màn vẫn `ready` với số của THÁNG nhưng nhãn đã đổi "Doanh thu tuần này" ⇒ hiển thị sai số tiền cho kỳ | web "while a new period loads, the old figures are not shown under the new label" |
| 2 | 1, 9 | M6 mobile nhánh `loading` vẽ `state.summary` cũ (cubit vẫn giữ summary lúc loading) | Cùng lỗi #1 bên mobile | mobile cùng tên ca (giữ port, chạm Tuần ⇒ không `AppKpi`, có `AppSkeleton`) |
| 3 | 8 | M4 bỏ `_homeReload.value++` trong `_selectTab` | Chạm lại Trang chủ khi đang ở Trang chủ không đọc lại số liệu; màn có `reloadSignal` nhưng dây nối app chưa ca nào đo | `signed_in_app_test` "tapping Trang chủ while on it reads the figures again" (đếm `/dashboard/summary` 1 → 2) |
| 4 | 1, 9 | M1 KPI Đơn mới mobile in `'0'` | Ca cũ chỉ kiểm nhãn KPI, không kiểm giá trị (web có ca bắt — W1 ĐỎ) | assert `AppKpi.value == '37'` trong ca "revenue null" |
| 5 | 1 | W2 / M2 seg/tab kỳ luôn sáng "Tháng này" | Người dùng không thấy kỳ đang chọn | assert `className == 'active'` (web) / `AppTabs.activeKey == 'day'` (mobile) trong ca đổi kỳ |
| 6 | 8 | W6 sidebar sáng mục khác / M5 bottom nav `activeIndex: 3` | Trang chủ là màn đáp nhưng thanh điều hướng chỉ sai chỗ | web ca "Trang chủ is the active sidebar link"; mobile assert `AppBottomNav.activeIndex == 0` |
| 7 | 2 | (thiếu ca) không token | Route có thể bị gắn `@Public()` — e2e các module khác có khuôn "không token ⇒ 401", dashboard chưa có | e2e "no token ⇒ 401, and nothing is read"; mutant `@Public()` ⇒ ca này ĐỎ (Expected 401) |

**Không thêm (đã phủ, tránh padding):** quyền resolve tươi mỗi request (các ca e2e cùng account đổi preset liên tiếp ⇒ cache theo account sẽ đỏ), mặc định `month`, vé chống trả lời cũ, 403 ⇒ EmptyState, đóng sớm cubit, BigInt/INT4, ranh giới ngày VN.

## Bảng đột biến (QA)

Cách làm: `cp` backup ra scratchpad, sửa bằng script (neo phải khớp đúng 1 lần, kiểm chuỗi chèn đã có), chạy lane, `cp` trả + `filecmp` bằng nguyên bản. Không `git checkout`, không mutant nào lỗi compile.

| Mutant | Vòng 1 | Sau QA |
|---|---|---|
| W1 web KPI Đơn mới `value={0}` | ĐỎ | — |
| W3 web dòng kỳ `from` → `to` | ĐỎ | — |
| W5 web cột chart `value: 1` | ĐỎ (guard design-system) | — |
| M3 mobile dòng kỳ `from` → `to` | ĐỎ | — |
| W2 · W4 · W6 | XANH ×3 | **ĐỎ ×3** |
| M1 · M2 · M4 · M5 · M6 | XANH ×5 | **ĐỎ ×5** |
| B1 backend `@Public()` trên `GET /dashboard/summary` | (chưa có ca) | **ĐỎ** (ca 401) |
| **Tổng** | **4/12** | **13/13 ĐỎ** |

## Test theo file

- [x] `backend/test/dashboard.e2e.spec.ts`: +1 ca (401). prettier + eslint sạch.
- [x] `web/src/test/dashboard-screen.test.tsx`: +2 ca (sidebar active, không lộ số cũ khi đổi kỳ) + 2 assert seg active trong ca đổi kỳ.
- [x] `mobile/test/screens/dashboard/dashboard_screen_test.dart`: +1 ca (không lộ số cũ khi đổi kỳ) + assert `AppBottomNav.activeIndex`, `AppKpi.value`, `AppTabs.activeKey`.
- [x] `mobile/test/app/signed_in_app_test.dart`: +1 ca (chạm lại Trang chủ đọc lại). File lệch `dart format` từ HEAD (kiểu dòng dài) — giữ nguyên, không format cả file.

Không sửa mã nguồn sản phẩm; mọi file màn/controller trả về đúng nguyên bản sau sweep.

## Coverage theo AC

| AC | Trạng thái |
|---|---|
| 1 kỳ + số liệu + đổi kỳ gọi lại | ✅ dev + gap 1, 2, 4, 5 |
| 2 gate tiền ở backend, quyền tươi | ✅ dev + gap 7 |
| 3 phạm vi đếm đơn | ✅ dev (unit + DB lane, mutant scope ĐỎ) |
| 4 tính ở backend | ✅ dev (guard + W5) |
| 5 kỳ VN, `from`/`to` | ✅ dev (unit + DB) + W3/M3 |
| 6 SUM > INT4 | ✅ dev (DB lane) |
| 7 hiển thị tiền | ✅ dev (guard tiền, đột biến trên màn mới) |
| 8 Trang chủ là màn đáp | ✅ dev + gap 3, 6 |
| 9 parity web ↔ mobile | ✅ dev + gap 1, 2 (cùng hành vi loading hai nền tảng) |

API: 1/1 endpoint (`GET /dashboard/summary`) — 200 ×3 tổ hợp quyền, 400, 401, 403. UI: 2/2 màn (web + mobile), cả hai có ca render/quyền/đổi kỳ/lỗi/403/loading; dây nối app: landing + tab Trang chủ + đọc lại.

## Kết quả chạy

- `cd backend && npm test` → 126 suite / **2574** xanh (DB lane không chạy lại — QA không đụng truy vấn; dev chạy 330/330)
- `cd web && npm run typecheck && npm test` → sạch · **460/460**
- `cd mobile && flutter analyze && flutter test` → sạch · **1354/1354**
- `cd design-system && npm test` → **524/524**

## Bước tiếp theo

- Code review 8.1 (`bmad-code-review`).
- Smoke web/emulator: dev đã chạy (Dev Agent Record) — QA không chạy lại.
