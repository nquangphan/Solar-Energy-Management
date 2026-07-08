# Tóm tắt Tự động hoá Test — Story 1.4 (Chip, Status-chip 9 trạng thái, chip chỉ đọc)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Tính năng:** Tầng chip web (Story 1.4) — `StatusChip` (9 trạng thái canonical, đọc-only), `CustomerTypeChip` (`.ktype`), `ScopeFlag` (`.scope-flag`).

**Loại test:** Source-guard tĩnh trên `.tsx` (đọc mã nguồn dạng text, khẳng định bất biến) — cùng kỹ thuật với drift-guard CSS. Repo **chưa có** bundler/tsc/React runtime (quyết định YAGNI cấp story), nên "E2E" ở đây là **hợp đồng nguồn component** chống biến chip thành nút, không phải render DOM.

## Framework phát hiện

- **Node.js built-in test runner** (`node --test`), zero-dependency, file `*.test.mjs`. Chạy: `cd design-system && npm test` (glob `**/*.test.mjs`).
- **Không sinh API test** — Story 1.4 thuần front-end trình bày, không backend/endpoint.
- **Không sinh browser E2E** — repo chưa có web app/bundler. JSX render test đã **chốt hoãn** tới story có web tooling (không đảo ngược quyết định đó).

## Test đã tạo — `design-system/components/chip-components.test.mjs` (mới)

Giữ nguyên drift-guard CSS chip cũ (test 9–13 trong `components.test.mjs`); **thêm 8 test source-guard** vá khoảng trống lớn nhất: 3 component `.tsx` trước đây **không có** test tự động nào.

| # | Test | AC |
|---|------|-----|
| 1 | **Read-only guard** — 3 component KHÔNG chứa `onClick`/handler chuột-phím, `<button>`, `role`/`tabIndex`, `...rest` (quét mã đã strip comment) | 3 (UX-DR-23) |
| 2 | Mỗi chip render `<span>` tĩnh | 1/3 |
| 3 | Union `StatusKey` = **đúng 9** key canonical (chặn trạng thái tự chế) | 2 |
| 4 | `STATUS_LABELS` ánh xạ đủ 9 trạng thái → nhãn canonical verbatim | 2 |
| 5 | `StatusChip` ghép `chip chip--{status}` + `.dot`, mặc định nhãn = `STATUS_LABELS[status]` | 1/2 |
| 6 | `ScopeFlag` map prop `on` → class `on`/`off` | 1 |
| 7 | `CustomerTypeChip` gắn class `.ktype` | 1 |
| 8 | Barrel `index.ts` re-export đủ tầng chip (3 component + type) | — |

## Khoảng trống đã phát hiện & vá (auto-apply)

| Gap | AC | Trước | Sau |
|-----|-----|-------|-----|
| G1 | 3 | Bất biến **read-only** (chip không bao giờ là nút) — story ghi "verify bằng review thủ công", **không** test tự động. Đây là AC dễ mắc nhất | Guard tự động chặn `onClick`/`<button>`/`role`/`tabindex`/`...rest` trên cả 3 component |
| G2 | 2 | Union `StatusKey` + `STATUS_LABELS` chỉ được suy gián tiếp qua 9 class CSS; TS layer không kiểm | Pin đúng 9 key + nhãn canonical verbatim |
| G3 | 1 | Logic ghép class (`chip--{status}`+dot, `on`/`off`, `.ktype`) chưa kiểm | Pin hợp đồng render từng component |
| G4 | — | Barrel export tầng chip chưa kiểm — xoá 1 export vẫn qua drift-guard CSS | Kiểm đủ 3 component + type |

**Chống báo động giả:** guard read-only strip comment trước khi quét — docstring component có nhắc "onClick"/"role" (giải thích rằng bị cấm) nên không được làm fail test. Đây là bẫy Story 1.3 từng gặp.

## Coverage

- **Component chip (TSX):** 3/3 — read-only, ghép class, hợp đồng union/nhãn.
- **CSS chip:** 9/9 trạng thái + 2 biến thể cờ (drift-guard cũ).
- **Barrel export:** đủ.
- **Suite: 43/43 pass** (35 → +8). Không hồi quy token (1.1) / icon (1.2) / component 1.3.

## Guard là load-bearing (đã chứng minh)

Tiêm `onClick` thật vào JSX của `StatusChip` → suite **fail** đúng test read-only; revert → xanh lại. Guard bắt được vi phạm thực, không phải test rỗng.

## Giới hạn đã biết (kế thừa, đã hoãn — không phải gap mới)

Chưa có test render JSX runtime (prop → DOM) vì repo cố tình chưa có bundler/tsc/React (YAGNI cấp story). Guard khẳng định bất biến trên **mã nguồn**, không phải DOM thực. Thêm React + JSX transform chỉ để render 3 span tĩnh là over-engineering — thuộc story dựng web tooling.

## Bước tiếp theo

- Chạy trong CI: `cd design-system && npm test` (repo chưa có pipeline CI — greenfield).
- Khi có bundler/tsc web: nâng guard read-only thành render assertion thật, thêm test prop→DOM cho tầng chip.
