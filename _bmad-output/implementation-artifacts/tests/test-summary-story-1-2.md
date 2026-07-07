# Tóm tắt Tự động hoá Test — Story 1.2 (Hệ thống icon SVG sprite inline)

**Tính năng:** Bộ icon SVG sprite inline dùng chung — 46 symbol canonical, derive từ một SSOT (`design-system/icons/icons.json`) ra web (React sprite + `Icon`) và mobile (Flutter registry + `AppIcon`).
**Ngày:** 2026-07-07
**Loại test:** Contract / parity + runtime guard. Story chỉ giao **primitive icon** — không có API endpoint, không có màn tương tác — nên "E2E" ở đây là **hợp đồng icon chéo nền tảng** cộng smoke-render widget.

## Framework phát hiện

- **Web / SSOT:** Node.js built-in test runner (`node --test`), zero-dep. Node 24 tự strip type khi import `.ts` → test được chạy **thẳng module web generated** mà không cần build/tooling web. Chạy: `cd design-system && npm test`.
- **Mobile:** `flutter test`. Chạy: `cd mobile && flutter test`.
- Giữ nguyên framework sẵn có của repo (không thêm dependency).

## Khoảng trống phát hiện & đã lấp (auto-apply)

Bộ test có sẵn (Story 1.2 dev) đã phủ tốt **parity tên**, **self-contained qua chuỗi file committed**, **size scale**, **currentColor**, **trùng path chủ đích**. Các khoảng trống dưới đây là **hành vi có trong code nhưng chưa test nào chạm tới**:

| # | Khoảng trống | Đã lấp bằng |
|---|---|---|
| 1 | Module web generated (`sprite.ts`) **chưa từng được import runtime** — mọi test cũ chỉ regex chuỗi file committed | `sprite.test.mjs` import thật `ICON_NAMES` / `ICON_SIZES` / `ICON_SPRITE` |
| 2 | Hợp đồng **"mount một lần"** của `ICON_SPRITE` (đúng một `<svg><defs>` bọc) chưa được khẳng định (AC-1) | `sprite.test.mjs` T3 |
| 3 | Quyết định open-question #2 (**chỉ `ic-ban`, không alias `ic-warning`**) chưa bị test khoá | `sprite.test.mjs` T1 |
| 4 | **`viewBox="0 0 24 24"` đồng nhất** 46 symbol (completion note khẳng định, test chưa) | `sprite.test.mjs` T5 |
| 5 | **Size mặc định 18px** của `AppIcon` render ra `SvgPicture` chưa được khẳng định (AC-2) | `app_icons_test.dart` — "defaults to the 18px canonical size" |
| 6 | `AppIcon(size:)` render **đúng size yêu cầu** trên widget tree | `app_icons_test.dart` — "renders the requested size verbatim" |
| 7 | Guard **`assert(svg != null)`** khi tên icon lạ chưa được test | `app_icons_test.dart` — "unknown name trips the debug assert" |

## Test đã sinh

### Node runtime suite — `design-system/icons/sprite.test.mjs` (MỚI)

| # | Test | AC |
|---|---|---|
| 1 | `ICON_NAMES` export đúng 46 tên canonical, không có `ic-warning` | 3 |
| 2 | `ICON_SIZES` export đúng 6 size, mặc định 18 dẫn đầu | 2 |
| 3 | `ICON_SPRITE` là **một** mount point self-contained (đúng 1 `<svg>`, 1 `<defs>`, mở/đóng đúng wrapper ẩn) | 1 |
| 4 | Mọi tên canonical có `<symbol id>` để `<use href="#ic-*">` trỏ tới | 1 |
| 5 | 46 symbol cùng `viewBox 0 0 24 24`, **0 external ref** trên sprite runtime | 1 |

### Flutter suite — `mobile/test/design_system/icons/app_icons_test.dart` (MỞ RỘNG)

| # | Test | AC |
|---|---|---|
| 1 | `AppIcon` mặc định render `SvgPicture` ở **18px** | 2 |
| 2 | `AppIcon(size:)` render đúng size (vd 14px) verbatim | 2 |
| 3 | Tên icon lạ → **AssertionError** (debug guard) | — |

## Kết quả chạy

- **Node:** `cd design-system && npm test` → **22/22 pass** (17 cũ + 5 mới icon runtime; token suite không hồi quy).
- **Flutter:** `cd mobile && flutter test test/design_system/icons/app_icons_test.dart` → **9/9 pass** (6 cũ + 3 mới).

## Độ phủ

- **AC-1 (self-contained, sprite/use, 0 external ref):** phủ ở cả tầng chuỗi committed (parity) **và** tầng module runtime (mới) + registry Flutter.
- **AC-2 (6 size + currentColor):** size scale, size mặc định 18, render đúng size, thừa kế màu — phủ web + mobile.
- **AC-3 (đủ 46 tên, không emoji/raster, parity):** phủ ở json ≡ web ≡ mobile + runtime `ICON_NAMES`.

## Giới hạn đã biết (không lấp trong story này)

- **`Icon.tsx` (web) chứa JSX** → Node type-stripping **không** thực thi JSX, và repo **chưa có tooling test web** (scaffold-only, đúng như ghi chú review của story). Test render React sẽ cần thêm framework → ngoài phạm vi tầng design-system zero-dep. Logic `size → class` của `Icon.tsx` vẫn được **drift-guard** (committed == fresh regeneration) bảo vệ. → Nên bổ sung khi story dựng web tooling xuất hiện.

## Next Steps

- Chạy cả hai suite trong CI (`npm test` + `flutter test`).
- Khi có web test tooling: thêm render test cho `Icon.tsx` (size→class, `<use href>`, passthrough `className`).
