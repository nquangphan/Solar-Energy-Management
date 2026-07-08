# Tổng kết QA Automated Tests — Story 1.8 (App shell mobile)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Người dùng:** Đại Ca
**Framework:** `flutter_test` (widget render + tương tác thật trên VM) · `node:test` (parity mockup)

Story 1.8 đã có bộ test khá đầy đủ (render + hành vi + source-guard + parity). Workflow này rà theo 5 Acceptance Criteria, phát hiện **10 lỗ hổng coverage** cho hành vi/đặc tả đã ghi trong AC nhưng **chưa có test**, và **tự động vá** vào các file test sẵn có (surgical — không tạo file trùng, không sửa widget source).

## Lỗ hổng đã phát hiện & vá (10)

| # | AC | Lỗ hổng | File bổ sung |
|---|----|---------|--------------|
| 1 | AC-1 | Nút back thiếu test `Semantics(label: 'Quay lại')` (accessibility) | `shell_render_test.dart` |
| 2 | AC-1 | `action` nhận `AppIcon` (biến thể icon) — trước chỉ test `Text` | `shell_render_test.dart` |
| 3 | AC-1 | Không render eyebrow khi `eyebrow: null` (nhánh optional) | `shell_render_test.dart` |
| 4 | AC-3 | PhoneFrame áp **giá trị mặc định** `9:41` / `5G · 82%` khi bỏ trống | `shell_render_test.dart` |
| 5 | AC-3 | Notch 116×22 thực sự render (trước chỉ có guard nguồn) | `shell_render_test.dart` |
| 6 | AC-4 | `AppMobileShell` ẩn topbar khi `topbar: null` (màn Đăng nhập) | `shell_render_test.dart` |
| 7 | AC-4 | Body **cuộn thật** (`.pscroll` / `SingleChildScrollView`) khi tràn | `shell_render_test.dart` |
| 8 | AC-1 | Chạm `action` dạng icon → `onAction` bắn | `shell_behavior_test.dart` |
| 9 | AC-2 | Chạm tab khi `onSelect: null` → không ném lỗi (null-safe) | `shell_behavior_test.dart` |
| 10 | AC-4 | E2E ghép màn "Quên mật khẩu" (topbar back + action "Đăng nhập", KHÔNG botnav; chỉ phát ý định) | `shell_behavior_test.dart` |

## Test đã sinh

### E2E / Widget (Flutter)
- [x] `mobile/test/design_system/shell_render_test.dart` — +6 test render (a11y, action-icon, eyebrow-null, defaults phone, notch 116×22, topbar-null, body cuộn)
- [x] `mobile/test/design_system/shell_behavior_test.dart` — +4 test hành vi (action-icon callback, tab null-safe, E2E màn Quên mật khẩu)

> Không sinh API test: shell là tầng trình bày thuần (AD-1/2), không có endpoint. Đúng phạm vi.

## Coverage (theo AC)
- **AC-1 Topbar:** title/eyebrow/back/action + a11y "Quay lại" + biến thể icon + callback → **đủ**
- **AC-2 Bottom-nav:** 5 tab khoá · FAB · active-tint · callback · FAB≠onSelect · null-safe → **đủ**
- **AC-3 Phone frame:** 330/bo40 · kính 700/bo32 · notch 116×22 · status bar + defaults → **đủ**
- **AC-4 Scaffold:** ghép 3 mảnh · ẩn topbar/botnav khi null · body cuộn · E2E auth → **đủ**
- **AC-5 Bất biến:** source-guard (0 shadow trừ ring FAB · 5 tab khoá · 0 network/router · hex chuẩn tắc) + parity mockup → **đủ (giữ nguyên)**

## Kết quả chạy
| Suite | Lệnh | Trước | Sau |
|---|---|---|---|
| Flutter widget | `cd mobile && flutter test` | 80/80 | **90/90** ✅ |
| Flutter analyze | `cd mobile && flutter analyze` | clean | **clean** ✅ |
| Parity mockup (Node) | `node --test design-system/components/**/*.test.mjs` | 76/76 | **76/76** ✅ (0 hồi quy) |

## Bước tiếp theo
- Chạy cả hai bộ trong CI.
- Khi Story 1.9 (shell web React) xong: mở rộng `shell-parity.test.mjs` thành parity cross-platform (Flutter ↔ React ↔ mockup) như ghi chú trong file.

## Câu hỏi tồn đọng
- Không. Story 1.8 vốn ở `review`; workflow này chỉ mở rộng coverage, không đổi contract widget.
