# Tóm tắt Tự động hoá Test — Story 1.3 (Button, Card, Frame, Field)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Tính năng:** Tầng component design-system web (Story 1.3).

**Loại test:** Drift-guard hợp đồng thị giác (đọc `components.css` dạng text, khẳng định đặc tả verbatim khớp mockup + Viền nét). Story chỉ giao **4 component nền web** — không có API endpoint, không có web app đang chạy — nên "E2E" ở đây là **hợp đồng CSS component chống lệch mockup**, đúng pattern Story 1.1/1.2.

## Framework phát hiện

- **Node.js built-in test runner** (`node --test`), zero-dependency, file `*.test.mjs`. Chạy: `cd design-system && npm test` (glob `**/*.test.mjs`).
- **Không sinh API test** — Story 1.3 thuần front-end trình bày, không backend/endpoint (AD-16).
- **Không sinh browser E2E** — repo chưa có web app/bundler đang chạy. Story đã **chốt hoãn** JSX render test tới story có web tooling (YAGNI). Không đảo ngược quyết định đó ở đây.

## Test đã mở rộng — `design-system/components/components.test.mjs`

Giữ nguyên 4 test cũ; **thêm 4 test mới** để vá khoảng trống coverage so với AC:

| # | Test | AC |
|---|------|-----|
| Mới | `Button variants keep their verbatim declarations` — primary (nền teal + `#fff`), accent text `--lime-600`, ghost (line/ink-2), danger, `--wide` width:100%, `.btn .icn` 15px (nối Icon 1.2) | 1 |
| Mới | `Card/Frame variants keep their verbatim declarations` — giá trị `.card--ink`/`--teal`, `.frame-label` nổi trên viền (`position:absolute;top:-8px`), `.frame.on-bg` phủ `--bg` | 2 |
| Mới | `Field/label keep their verbatim declarations` — `.field::placeholder{#9fb2ad}`, `.field-lg` size đăng nhập, selector `.field.focus`, `.flabel` micro-uppercase + muted | 3 |
| Mới | `every var() referenced in components.css is defined in tokens.css` — **guard tích hợp chéo file**, tổng quát hoá gotcha `--r*`: mọi typo/biến chưa ship (vd `var(--teel)`) nay làm fail suite. Noi theo pattern parity token/icon. Đã xác minh **không rỗng** (bắt được `var(--teel)`). | 1/2/3/4 |

## Khoảng trống đã phát hiện & vá (auto-apply)

| Gap | AC | Trước | Sau |
|-----|-----|-------|-----|
| G1 | 1 | Biến thể Button (primary/ghost/danger/accent-text/wide/`.btn .icn`) chỉ kiểm selector, giá trị đổi vẫn pass | Pin giá trị verbatim từng biến thể |
| G2 | 2 | `.card--ink/--teal` border-color, `.frame-label` toạ độ nổi, `.frame.on-bg` nền chưa kiểm | Pin đủ giá trị |
| G3 | 3 | `.field::placeholder`, `.field-lg` size, `.field.focus`, `.flabel` uppercase/muted chưa kiểm | Pin đủ giá trị |
| G4 | 1/2/3/4 | Không có guard "mọi `var(--X)` tồn tại trong tokens.css" — lớp lỗi `--r*` chỉ bị chặn theo tên cụ thể | Test integrity chéo file, tổng quát |

## Coverage

- **Selector + biến thể (AC-1/2/3):** đủ (test cũ) → nay **kèm giá trị verbatim** từng biến thể.
- **Viền nét (AC-4):** 0 shadow/gradient/background-image — giữ.
- **Remap radius `--r*` → `--radius*`:** giữ.
- **Tích hợp token chéo file:** mọi `var()` trong `components.css` phải tồn tại trong `tokens.css` — **mới**.
- **Logic React `.tsx`:** chưa có (hoãn — xem dưới).

**Kết quả chạy:** `30 test, 30 pass, 0 fail` (26 → +4). Không hồi quy suite token (1.1) / icon (1.2).

## Giới hạn đã biết (kế thừa, đã hoãn — không phải gap mới)

4 component React (`Button/Card/Frame/Field.tsx`) chưa có test render/ánh xạ prop runtime. Việc này cần JSX transform + React/jsdom mà repo cố tình chưa đưa vào (chưa có bundler/tsc — quyết định YAGNI cấp story). **Không** scaffold ở đây để tránh over-engineering. Hợp đồng class mà component phát ra (`.btn--*`, `.card--*`, `field-lg`, …) được ghim gián tiếp bởi drift-guard: mọi class phát ra đều phải tồn tại trong `components.css`. Test JSX render đầy đủ thuộc về story dựng web tooling.

## Bước tiếp theo

- Chạy trong CI: `cd design-system && npm test` (repo chưa có pipeline CI — greenfield).
- Khi có bundler/tsc web: thêm JSX render test cho 4 component (prop → class, `Field` nối `label`↔`htmlFor` a11y, spread `...rest`).
