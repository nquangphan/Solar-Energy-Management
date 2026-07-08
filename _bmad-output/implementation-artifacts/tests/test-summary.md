# Tóm tắt QA Automation — Story 1.10 (Primitive gating + Accessibility floor + Parity)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Người chạy:** Đại Ca
**Tính năng:** tầng gating (`gating/`) + a11y floor (`a11y/a11y.css` + `AppTokens.tapTargetMin`) web (React) & mobile (Flutter).

## Bối cảnh & khung test

Web (`web/src/`) **không có tsc/runtime build** (đúng tiền lệ Story 1.3–1.9) → không thể chạy E2E trình duyệt / import TS trực tiếp. Khung test chuẩn tắc là **Node text-guard** (`node --test "**/*.test.mjs"` trong `design-system/`). Toàn bộ test bổ sung bám pattern này — **KHÔNG** thêm transpiler/test-runner mới (theo quyết định YAGNI của story). Mobile Flutter đã `dart analyze` sạch (lượt QA này chỉ thêm file test, không đụng Dart source).

## Khoảng trống phát hiện & auto-apply (7 gap, bám 3 AC)

| # | AC | Gap (trước không có guard) | Test đã thêm |
|---|----|----------------------------|--------------|
| 1 | AC-1 | Wiring `SIDEBAR_NAV`: `audit ⇒ PERM.auditRead` (chỉ Super Admin, FR-20), `permissions ⇒ PERM.permissionsManage`, field `NavLink.requires?` | `gating.test.mjs` (e) |
| 2 | AC-1 | Bộ quyền stub 2 nền tảng **loại** `auditRead` (Audit gates out) nhưng có `ordersViewAll`+`permissionsManage` | `gating.test.mjs` (f) |
| 3 | AC-1 | `key-agnostic`: literal quyền chỉ xuất hiện trong registry stub, KHÔNG lọt vào thân `filterNav`/`orderScope` | `gating.test.mjs` (d) mở rộng |
| 4 | AC-2 | Parity mobile: nút icon-only `image_upload.dart` (add/remove) có `Semantics(button, label)` | `a11y-floor.test.mjs` |
| 5 | AC-2 | "Tiền/VAT không bị cắt": `.mono` / `.table .num` KHÔNG `overflow:hidden`/`ellipsis` | `a11y-floor.test.mjs` |
| 6 | AC-2 | Floor web phủ thêm `.topbar-action` + `.modal-head button` | `a11y-floor.test.mjs` mở rộng |
| 7 | AC-3 | Bottom-nav mobile **giữ khoá cứng** — KHÔNG bị chèn gating (`filterNav`/`AppGate`/`requires`) vào 5 tab (UX-DR-15) | `parity.test.mjs` |

## Test đã sinh / mở rộng

### Gating (AC-1/3) — `design-system/components/gating.test.mjs`
- [x] Thêm (e) wiring `SIDEBAR_NAV`, (f) demo-set loại `auditRead`; mở rộng (d) guard literal xuất hiện **đúng 1 lần** trong registry (không lọt vào helper logic).

### Accessibility floor (AC-2/3) — `design-system/components/a11y-floor.test.mjs`
- [x] Thêm guard `Semantics` icon-only mobile, guard money-không-cắt; mở rộng danh sách control web floor (`.topbar-action`, `.modal-head button`).

### Parity cross-platform (AC-3) — `design-system/components/parity.test.mjs`
- [x] Thêm guard bottom-nav ungated (khoá cứng 5 tab, UX-DR-15).

## Coverage theo AC

- **AC-1 (gating):** Gate render-null · `can`/`filterNav`/`orderScope` · drop section rỗng · stub-marked (AD-17) + UX-only (AD-4) · key-agnostic · **wiring SIDEBAR_NAV + demo-set (Audit ẩn trừ Super Admin)** ✅
- **AC-2 (a11y floor):** floor 44px web / 48dp mobile · aria-label web + **Semantics mobile** · **money-không-cắt** · Esc đóng overlay (đã có `behavior-components.test.mjs`) ✅
- **AC-3 (parity):** gating song sinh 2 nền tảng · floor lệch giá trị **có chủ đích** (44≠48, dp≠px) · **bottom-nav khoá cứng ungated** ✅
- **API test:** N/A — tầng design-system thuần trình bày (AD-1/2: không mạng/router/nghiệp vụ), không endpoint.

## Kết quả chạy

```
cd design-system && npm test        # node --test "**/*.test.mjs"
→ tests 140 · pass 140 · fail 0     (baseline 135 + 5 khối mới · 0 regression)
```

## Bước tiếp theo

- Chạy suite trong CI (`npm --prefix design-system test`).
- Correctness runtime (import/exec TS thật) nối khi có build ở Epic 2+ (`/me` thật thay `DEMO_PERMISSIONS`).
- Bổ sung edge case khi màn nghiệp vụ Epic 3–8 lắp component gating thực tế.

## Câu hỏi tồn đọng

- Không. Story 1.10 vốn ở `review`; workflow này chỉ mở rộng coverage, không đổi contract gating/a11y.
