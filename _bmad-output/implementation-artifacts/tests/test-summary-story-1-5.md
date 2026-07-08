# Tóm tắt Tự động hoá Test — Story 1.5 (Table, Stepper, KPI, Banner)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Tính năng:** Tầng data/feedback web (Story 1.5) — `Table` (bảng dày `.table`), `Stepper` (node/bar, state `done|current|gate`), `Kpi` (`accent`/`mono`), `Banner` (tone `warn|info|danger`).

**Loại test:** Source-guard tĩnh trên `.tsx` (đọc mã nguồn dạng text, khẳng định bất biến hợp đồng React) — cùng kỹ thuật với drift-guard CSS và source-guard chip của Story 1.4. Repo **chưa có** bundler/tsc/React runtime (quyết định YAGNI cấp story), nên "E2E" ở đây là **hợp đồng nguồn component**, không phải render DOM. Đây là khoảng trống test đã được Testing Standards của story ghi nhận ("QA automation có thể bổ sung source-guard TSX sau").

## Khoảng trống phát hiện (đã auto-apply)

Trước workflow: 4 component có drift-guard **CSS** (`components.test.mjs`) nhưng **không** có source-guard **TSX** — khác với tầng chip 1.4 (`chip-components.test.mjs`). Các hợp đồng React sau đây chưa test nào bảo vệ:

- Union `StepState = done|current|gate` — chặn biến thể `disabled`/`grayed` ở cấp type (UX-DR-11).
- Quy tắc render `.bul`: `done → ic-check`, còn lại → số 1-based; `.bar` bỏ ở step cuối.
- Stepper là **đọc-only** (AD-11): không handler, không `<button>`, không đụng `Order.status`.
- Banner `tone` mặc định `warn` (base class), `info`/`danger` → `banner--${tone}`; icon optional.
- KPI ghép class `accent` + `mono`, render delta có điều kiện.
- Barrel `index.ts` re-export đủ tầng 1.5 (component + type).

## Test đã tạo

### Source-guard TSX (E2E-equivalent cho design-system layer)

- [x] `design-system/components/data-feedback-components.test.mjs` — 12 test, hợp đồng nguồn 4 component + barrel:
  - **Table (AC-1):** render `<table className="table …">`, ghép + forward `className` và `...rest`; không có sub-component `Th/Td/Tr` (YAGNI).
  - **Stepper (AC-2/UX-DR-11):** union đúng `done|current|gate`; `.bul` = `ic-check` khi `done` else số `i+1`; `.bar` bỏ khi `isLast`; đủ markup `stepper/node/bul/st-label`; đọc-only (không handler/button/status mutation — AD-11).
  - **KPI (AC-3):** ghép `['kpi', accent && 'accent']` + `['k-v', mono && 'mono']`; delta render có điều kiện; đủ markup `k-l/k-v`.
  - **Banner (AC-4):** union `warn|info|danger`; mặc định `warn` (base, không modifier), `info/danger → banner--${tone}`; icon optional (`{icon && <Icon>}`).
  - **Barrel:** `index.ts` export đủ `Table/TableProps`, `Stepper/StepperProps/StepItem/StepState`, `Kpi/KpiProps`, `Banner/BannerProps/BannerTone`.

### Đã có sẵn (không đụng)

- `components.test.mjs` — drift-guard CSS 4 component (selector + verbatim lõi + remap radius + rào box-shadow nới cho ring stepper).
- `chip-components.test.mjs` — source-guard TSX tầng chip (Story 1.4).

## Coverage

- Component React Story 1.5: **4/4** có source-guard TSX (Table, Stepper, Kpi, Banner).
- Hợp đồng đã khoá: Stepper state union + render rule + read-only; Banner tone default/modifier; KPI accent/mono; Table wrapper contract; barrel completeness.
- API tests: **không áp dụng** (story thuần front-end trình bày, không endpoint — AD-1/AD-2).
- E2E render DOM: **hoãn** (repo chưa có bundler/tsc/React runtime — YAGNI cấp story).

## Kết quả chạy

`cd design-system && npm test` → **61/61 pass, 0 fail** (49 → 61, +12 test mới). Không hồi quy token/icon/Story 1.3/1.4.

Negative-check đã xác minh guard **không rỗng**: chèn tạm `disabled` vào union `StepState` → test "StepState union declares exactly done|current|gate" **fail** đúng như mong đợi; revert → 61/61 pass.

## Next Steps

- Chạy suite trong CI (cùng `npm test`).
- Khi web-app story sau dựng bundler/tsc/React runtime, bổ sung render-DOM test (Playwright/Vitest) cho tương tác thực; source-guard hiện tại vẫn giữ để khoá hợp đồng nguồn.
