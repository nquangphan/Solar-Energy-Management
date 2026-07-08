# Tóm tắt Test — Story 1.11 (Màn Đăng nhập dựng thật — demo design system)

**Workflow:** bmad-dev-story · **Ngày:** 2026-07-08 · **Người chạy:** Đại Ca
**Tính năng:** màn Đăng nhập (`screens/auth/`) dựng bằng chính design-system (Field/Button/Card/Banner/Icon + shell) trên web (React) & mobile (Flutter). UI-only, auth thật ở Epic 2.

## Bối cảnh & khung test

Web (`web/src/`) **không có tsc/runtime build** (tiền lệ Story 1.3–1.10) → màn `.tsx` guard bằng **Node text-test** (`design-system/**/*.test.mjs`). Mobile có Flutter SDK trong môi trường này → chạy **widget test + `flutter analyze`** thật. Không thêm test-runner/transpiler/router (YAGNI).

## Test đã thêm (bám 3 AC)

### Source-guard + parity — `design-system/screens/login.test.mjs` (8 khối, mới)
| # | AC | Guard |
|---|----|-------|
| a | AC-1 | Web LoginScreen import Field/Button/Card/Banner/Icon từ design-system; có `size="lg"`, `variant="primary"`, `size="wide"`, `type="password"`, Banner `tone="danger"` |
| b | AC-1 | Mobile compose barrel `components.dart`: `AppFieldSize.large`, `AppButtonVariant.primary`, `wide:true`, `AppBannerTone.danger`, `obscureText:true` |
| c | AC-1/3 | Web no-nav: `sidebar={null}`, KHÔNG `<Sidebar>` (UX-DR-15) |
| d | AC-1/3 | Mobile no-nav: dùng `AppPhoneFrame`, KHÔNG `AppMobileShell`/`AppTopbar`/`AppBottomNav` |
| e | AC-3 | Cả hai file tồn tại (parity coverage) |
| f | AC-3 | 7 nhãn Việt byte-identical hai nền tảng (Đăng nhập, Tài khoản, Mật khẩu, Quên mật khẩu, Phương Nam Solar, Số điện thoại hoặc email, Nhập mật khẩu) — UX-DR-27 |
| g | AC-1 | Link "Quên mật khẩu" trên cả hai |
| h | AC-1 | Viền nét: `login.css` 0 shadow/gradient; `login_screen.dart` 0 BoxShadow/elevation |

### Flutter widget test — `mobile/test/screens/auth/login_screen_test.dart` (7 khối)
- [x] Compose: 2 `AppField` + `AppButton` "Đăng nhập" + brand "Phương Nam Solar" + link "Quên mật khẩu?" + icon `ic-sun` (AC-1).
- [x] No-nav: có `AppPhoneFrame`; KHÔNG `AppTopbar`/`AppBottomNav`/`AppMobileShell` (UX-DR-15).
- [x] Validate rỗng: submit rỗng → `AppBanner` "Nhập đủ tài khoản và mật khẩu." hiện (AC-2).

### Sửa nhỏ design-system — `mobile/lib/design_system/components/field.dart`
- [x] Thêm prop `obscureText` (parity với web `type="password"`). Surgical — mọi test cũ pass.

## Bổ sung QA workflow (bmad-qa-generate-e2e-tests — gap discovery, auto-apply)

Rà 3 AC so với hành vi thật đã cài: cả web lẫn mobile có **3 nhánh validate** (rỗng · sai định dạng · hợp lệ) nhưng test cũ chỉ phủ nhánh rỗng. Đã tự-áp các gap sau:

### Flutter widget test — 4 khối mới (chạy runtime thật, SDK có sẵn)
- [x] **Sai định dạng (AC-2):** tài khoản "not-an-account" + mật khẩu → `AppBanner` "Tài khoản phải là số điện thoại hoặc email hợp lệ." (nhánh format trước đây chưa test đâu cả).
- [x] **Happy path SĐT (AC-2):** ép lỗi trước, rồi nhập "0912345678" + mật khẩu → banner biến mất (vùng lỗi được clear).
- [x] **Happy path email (AC-2):** "a@b.co" + mật khẩu → không banner.
- [x] **Che mật khẩu (AC-1):** field mật khẩu có `obscureText == true` (xác nhận masking ở runtime, không chỉ guard chuỗi).

### Source-guard + parity — `login.test.mjs` (khối mới + mở rộng parity)
- [x] **Web validate copy (AC-2):** assert `LoginScreen.tsx` chứa CẢ hai câu lỗi (rỗng + sai định dạng) — trước chỉ guard `tone="danger"`.
- [x] **Parity copy lỗi (AC-3):** thêm 2 câu lỗi vào danh sách nhãn byte-identical → 9 nhãn (chống drift diacritics giữa 2 nền tảng, vì copy lỗi cũng là user-facing).

## Kết quả chạy

```
cd design-system && node --test "**/*.test.mjs"
→ tests 149 · pass 149 · fail 0   (baseline 140 Story 1.10 + 8 dev-story + 1 QA · 0 regression)

cd mobile && flutter test                       (full suite)
→ +97 · All tests passed          (baseline 90 + 3 dev-story + 4 QA · 0 regression)

cd mobile && flutter analyze test/screens/auth/login_screen_test.dart
→ No issues found!
```

## Coverage theo AC

- **AC-1 (compose từ design-system + no-nav + che mật khẩu):** import guard 2 nền tảng · `field-lg`/`primary`/`wide` · `sidebar={null}`/`AppPhoneFrame` trực tiếp · Viền nét · `obscureText` runtime ✅
- **AC-2 (validate presentational + Banner):** cả 3 nhánh — rỗng, sai định dạng, hợp lệ (clear lỗi) — phủ ở widget test; web guard cả hai câu lỗi + Banner `tone="danger"` ✅
- **AC-3 (parity web↔mobile):** cả hai file tồn tại · **9** nhãn Việt byte-identical (gồm 2 câu lỗi validate) · no-nav hai bên ✅

## Câu hỏi tồn đọng

- Không. Auth thật (JWT access+refresh, `/me` gating) nối ở Epic 2 (Story 2.3); màn `s-forgot` = Story 2.8 (ở đây chỉ có link). Correctness runtime web nối khi có build ở Epic 2+.
