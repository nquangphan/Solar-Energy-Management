---
baseline_commit: 356314c
---

# Story 1.2: Hệ thống icon SVG sprite inline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên nền tảng**,
I want **một bộ icon SVG sprite inline dùng chung**,
so that **mọi màn dùng icon nhất quán, không phụ thuộc asset ngoài, chạy giống nhau trên web và Flutter**.

## Acceptance Criteria

1. **Given** yêu cầu icon self-contained, **When** dựng sprite, **Then** mỗi icon định nghĩa **một lần** dạng `<symbol id="ic-*">` và dùng qua `<svg class="icn"><use href="#ic-*"/></svg>`, với `stroke:currentColor` / `stroke-width:2` / `fill:none`, **0 external ref** (UX-DR-18).
2. **Given** các ngữ cảnh dùng, **When** render icon, **Then** hỗ trợ **biến thể kích thước 18/22/16/15/14/13px** và icon **thừa kế màu chữ ngữ cảnh** (teal khi active, muted khi thường).
3. **Given** danh sách symbol yêu cầu, **When** kiểm bộ icon, **Then** đủ tập tên canonical (46 symbol — xem "Tập symbol canonical" trong Dev Notes) **And** **không dùng emoji hoặc icon raster**.

## Tasks / Subtasks

- [x] **Task 1 — Chốt nguồn icon chính tắc dùng chung (SSOT) (AC: 1, 3)**
  - [x] Trích **verbatim** toàn bộ 46 `<symbol id="ic-*">` từ nguồn thị giác duy nhất `mockups/all-screens.html` (khối sprite tại dòng ~335: `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>…</defs></svg>`). **Không tự vẽ lại path**; khi lệch giữa mockup và prose DESIGN.md → **mockup thắng**.
  - [x] Đặt nguồn chính tắc tại `design-system/icons/icons.json` (map `name → { viewBox, body }`, giữ nguyên `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap/linejoin="round"` như mockup). Đây là **single source of truth**; web và mobile **derive** từ đây, không copy tay hai nơi (theo đúng pattern token của Story 1.1 — xem "Tái dùng hạ tầng").
  - [x] Giữ nguyên các icon **trùng path có chủ đích** trong mockup: `ic-product≡ic-inventory`, `ic-contract≡ic-file`, `ic-users≡ic-customer`. **Không "sửa" cho khác nhau** — mockup thắng.
- [x] **Task 2 — Phát sprite web + component Icon (AC: 1, 2)**
  - [x] Generator (`design-system/icons/build-icons.mjs`, zero external dep — như `build-tokens.mjs`) sinh output web tại `web/src/design-system/icons/`:
    - Sprite inline dựng **một lần** (chuỗi `<svg …><defs><symbol id="ic-*">…</defs></svg>`) để mount đầu DOM.
    - Component `Icon` (React/TS) render `<svg class="icn"><use href="#ic-{name}"/></svg>`; prop `name` giới hạn theo union type từ tập canonical (không cho tên tự do).
  - [x] Khai báo CSS `.icn` + biến thể **verbatim** từ mockup (dòng 318–319): `svg.icn{width:18px;height:18px;stroke-width:2;flex:none;vertical-align:middle;fill:none;stroke:currentColor}` và `.icn-xs{width:13px;height:13px}`. Cung cấp đủ **6 kích thước canonical 18/22/16/15/14/13px** (mặc định 18; 13 qua `.icn-xs`; 22/16/15/14 là size prop hoặc utility class). `stroke:currentColor` bảo đảm icon **thừa kế `color`** ngữ cảnh (teal khi active, muted khi thường) — **không** hardcode màu icon.
- [x] **Task 3 — Phát bộ icon Flutter tương đương (parity) (AC: 1, 2, 3)**
  - [x] Generator sinh output mobile tại `mobile/lib/design_system/icons/app_icons.dart`: một map/registry `name → SVG string` (bọc mỗi symbol thành `<svg viewBox…>…</svg>` đầy đủ, giữ `stroke="currentColor"`), **cùng 46 tên** như web.
  - [x] Widget `AppIcon(name, {size, color})`: render SVG string với **currentColor thừa kế** màu chữ ngữ cảnh (icon lấy màu từ `color` truyền vào hoặc `DefaultTextStyle`/`IconTheme`), mặc định size 18; hỗ trợ 22/16/15/14/13. **0 external ref / 0 network asset** — dữ liệu icon bundle trong app.
  - [x] **Quyết định cơ chế render SVG ở Flutter là điểm cần chốt** — xem "Quyết định thiết kế" + "Câu hỏi mở". Khuyến nghị `flutter_svg` (currentColor thật + 0 asset ngoài). Nếu dev-story HALT vì thêm dependency, dừng và hỏi (như Story 1.1 đã lưu ý). → **Chốt `flutter_svg ^2.3.0`** (fetch thành công, không HALT).
- [x] **Task 4 — Test parity chống lệch icon (AC: 1, 2, 3)**
  - [x] Test (Node) khẳng định **tập tên** ở `icons.json` ≡ tập tên web ≡ tập tên mobile — **đủ và đúng 46 symbol**, không thiếu/thừa (đây là AC-3 lõi).
  - [x] Test khẳng định **mọi** symbol có `stroke="currentColor"`, `stroke-width="2"`, `fill="none"` và **0 external ref** (không `http(s):`, không `xlink:href` trỏ ngoài, không `<image>`/`<use href="http…">`) (AC-1).
  - [x] Test (Dart, `flutter test`) khẳng định registry `AppIcons` có đủ 46 tên và không tên lạ; smoke render `AppIcon` không lỗi.
  - [x] **Cập nhật test glob**: `design-system/package.json` script test hiện là `node --test "tokens/**/*.test.mjs"` — mở rộng để bao cả `icons/**` (ví dụ `"**/*.test.mjs"` hoặc thêm pattern). Nếu không, test icon **sẽ không chạy** (gotcha Node 24 từ Story 1.1).

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này **CHỈ** giao **hệ thống icon sprite**: 46 symbol canonical + component/widget render icon + biến thể kích thước + thừa kế currentColor + test parity. Đây là hạ tầng để các story sau tiêu thụ.
- **Ngoài phạm vi (thuộc story khác — KHÔNG làm ở đây):**
  - Component **dùng** icon: Button/Field (1.3), Banner icon trái (1.5), giỏ hàng/upload/share (1.6), Topbar back/action (1.8), **Bottom-nav + FAB `ic-plus`** (1.8), Sidebar/toolbar search (1.9). Story 1.2 **chỉ** cung cấp primitive icon; **không** dựng các component đó.
  - Các kích thước **component-specific** không nằm trong 6 canonical (ví dụ `.thumb .icn` 20px, `.share-app .ic .icn` 24px trong mockup) là hằng riêng của component tương ứng → định nghĩa ở story đó, **không** phải biến thể nền của 1.2.
  - Màu icon theo trạng thái active/muted **của một component cụ thể** (ví dụ `.botnav-item .icn{color:#a9bab5}` → active `var(--teal)`) thuộc component đó; 1.2 chỉ bảo đảm cơ chế `currentColor` để component tô màu qua `color`.
- **Nhưng:** bộ icon 1.2 phải **đủ 46 tên ngay** để các story sau dùng mà không phải bổ sung symbol.

### Tái dùng hạ tầng Story 1.1 — KHÔNG tạo trùng (DRY, scout-before-code)

- Story 1.1 đã tạo package `design-system/` (`package.json`, `type: module`, scripts `build`/`test`, **zero external dep**, generator `build-tokens.mjs`, parity `parity.test.mjs`). **Mở rộng cùng package/cây này**, đừng dựng package thứ hai.
- Bố cục mirror tokens 1-1 (giữ nhất quán):
  - Nguồn chung: `design-system/icons/icons.json` + `design-system/icons/build-icons.mjs` + `design-system/icons/parity.test.mjs`.
  - Web: `web/src/design-system/icons/` (sprite + component `Icon`).
  - Mobile: `mobile/lib/design_system/icons/app_icons.dart` (+ widget `AppIcon`).
- Generator giữ **phong cách của `build-tokens.mjs`**: thuần Node, không thêm dependency web (Style Dictionary đã bị loại ở 1.1 để giữ KISS/YAGNI).
- **Gotcha test runner (từ 1.1):** Node 24 cần glob cho `node --test` (`"…/**/*.test.mjs"`), không nhận thư mục trần. Sửa `package.json` để glob bao cả `icons/**` (Task 4).

### Kiến trúc & nguyên tắc bắt buộc

- **AD-13 (Design-system-first):** icon sprite là một mảnh của hợp đồng thị giác DESIGN.md, dựng cho **cả hai nền tảng trước mọi màn**; mọi màn/component sau **cấm** nhét emoji/icon raster/asset ngoài — phải dùng bộ icon này. [Source: ARCHITECTURE-SPINE.md#AD-13]
- **NFR-9 / UX-DR-27 (một design system, hai nền tảng):** icon phải **"hoạt động giống hệt trên Web và Flutter"** — cùng bộ tên, cùng hình, cùng cơ chế currentColor. Đây là lý do có test parity: **một nguồn, không lệch**. [Source: DESIGN.md#Icon System, epics.md#NFR-9]
- **Thuần front-end:** story không chạm backend/DB/business logic — chỉ tầng trình bày design-system. [Source: project-context.md]
- **Nguồn thị giác duy nhất:** khối sprite trong `mockups/all-screens.html`. DESIGN.md ghi "khi xung đột, mockup thắng" → **copy verbatim path từ mockup, không tự nhớ/tự vẽ**. [Source: DESIGN.md#Icon System]

### Tập symbol canonical (46) — verbatim theo mockup [Source: mockups/all-screens.html dòng ~335, UX-DR-18]

`ic-home ic-orders ic-invoice ic-inventory ic-warehouse ic-menu ic-customer ic-users ic-user ic-product ic-catalog ic-payment ic-contract ic-audit ic-permissions ic-status ic-plus ic-minus ic-check ic-close ic-edit ic-trash ic-copy ic-send ic-share ic-download ic-external ic-refresh ic-search ic-filter ic-sort ic-more ic-bell ic-mail ic-phone ic-camera ic-image ic-file ic-clock ic-info ic-alert ic-ban ic-chevron-left ic-chevron-right ic-chevron-down ic-sun`

**Ghi chú disambiguation (quan trọng — tránh sai tên):**
- AC/DESIGN.md viết **"ic-warning/ic-ban"** và **"ic-warning(ic-ban)"** — nhưng **id thật trong mockup là `ic-ban`** (không có symbol `ic-warning`). Dùng **`ic-ban`** làm tên chính tắc (mockup thắng). Nếu muốn giữ chữ `ic-warning` cho ai quen tên, chỉ được thêm dạng **alias** trỏ về `ic-ban`, **không** nhân đôi symbol.
- DESIGN.md dòng 254 nói "45 symbol" nhưng mockup thực có **46 symbol duy nhất** — lấy **46** theo mockup (nguồn thị giác thắng).
- Trùng path có chủ đích (giữ nguyên): `ic-product`=`ic-inventory` (khối 3D), `ic-contract`=`ic-file` (tài liệu), `ic-users`=`ic-customer` (nhóm người). Đây là chủ ý mockup, **không** phải lỗi cần sửa.

### Kích thước & currentColor — verbatim [Source: mockups/all-screens.html dòng 318–331, DESIGN.md#Icon System, AC-2]

- **Base `.icn`:** `width:18px;height:18px;stroke-width:2;flex:none;vertical-align:middle;fill:none;stroke:currentColor`.
- **6 biến thể canonical (AC-2):** `18` (mặc định) · `22` (botnav/FAB) · `16` (search/sidebar/banner) · `15` (button/topbar-action) · `14` (num/step/tick trong bảng) · `13` (`.icn-xs`).
- **currentColor:** vì `stroke:currentColor`, icon **tự lấy `color` của ngữ cảnh** — component set `color` (teal khi active, muted khi thường), icon theo đó. 1.2 **không** hardcode màu icon nào.
- Web: mặc định 18 qua `svg.icn`; 13 qua `.icn-xs`. Cung cấp cách chọn 22/16/15/14 (size prop trên `Icon` hoặc utility class) — để component sau dùng đúng size mà **không** tự viết CSS icon.
- Mobile: `AppIcon(size:)` nhận đúng thang 18/22/16/15/14/13; mặc định 18. Màu qua `color` (currentColor), mặc định thừa kế.

### Quyết định thiết kế — render SVG ở Flutter (điểm rủi ro chính của story)

Bối cảnh: web dùng inline `<use href>` là tự nhiên; Flutter **không** có cơ chế `<use>`/sprite gốc, nhưng AC đòi **"chạy giống nhau"** + **currentColor** + **0 external ref**.

- **Khuyến nghị:** dùng `flutter_svg` (`SvgPicture.string(...)`) render SVG string từ `app_icons.dart`. `flutter_svg` hỗ trợ **currentColor thật** qua `SvgTheme(currentColor: ...)` / `colorFilter`, và dữ liệu là **string bundle sẵn** → thoả "0 external ref, 0 network asset". Giữ parity vì cả hai nền tảng render **cùng markup SVG** từ SSOT.
- **Phương án thay thế:** hand-port 46 icon sang `CustomPainter`/`Path`. Loại vì: 46 icon × nhiều path → nặng, dễ sai, **phá parity** (không còn cùng nguồn markup). Không khuyến nghị.
- **Lưu ý dependency:** `flutter_svg` là dep **mobile** (không phải web) — hợp lệ vì render SVG cần renderer thật; khác với token 1.1 (hằng thuần, zero-dep). Nếu chính sách "zero-dep" chặn, dev-story **HALT và hỏi** thay vì tự chế painter. Ghim version tương thích Flutter 3.44 khi thêm vào `mobile/pubspec.yaml`.

### Testing standards [Source: project-context.md#Testing, Story 1.1 pattern]

- **Parity là bắt buộc** (như 1.1): test khẳng định `icons.json` ≡ web ≡ mobile về **tập tên (đúng 46)**; test khẳng định mọi symbol `stroke=currentColor`/`stroke-width=2`/`fill=none` và **0 external ref**.
- Web/Node: `design-system/icons/parity.test.mjs`, chạy qua `npm test` (glob đã sửa để bao `icons/**`).
- Mobile/Dart: `mobile/test/design_system/icons/app_icons_test.dart` — đủ 46 tên, không tên lạ, smoke-render `AppIcon`.
- Test phải **fail nếu ai thêm/bớt/đổi tên icon một nền tảng mà quên nền kia** — đó là giá trị chống-drift.

### Project Structure Notes

- **Surgical (project-context.md#Scout-before-code):** chỉ tạo file tối thiểu để sprite/icon compile + test trên mỗi nền tảng. **Không** dựng sẵn component tiêu thụ icon (để story 1.3/1.5/1.6/1.8/1.9).
- Cây web (`web/src/design-system/`) và mobile (`mobile/lib/design_system/`) đã tồn tại từ 1.1 (thư mục `tokens/`). Thêm **anh em** `icons/` cạnh `tokens/`, **không** đụng file token 1.1.
- Mobile hiện là scaffold token-test tối thiểu (`pubspec.yaml`). Nếu thêm `flutter_svg`, cập nhật `pubspec.yaml` + `pubspec.lock` tối thiểu để icon test chạy; **không** scaffold app đầy đủ (để 1.7/1.8).

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Icon System] — quy tắc sprite, style chuẩn, thang size, tập tên. **Nguồn thị giác thắng khi xung đột.**
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html] — khối sprite dòng ~335 (**46 `<symbol>` verbatim**) + CSS `.icn`/`.icn-xs` dòng 318–331. Copy path từ đây.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — user story + 3 AC (UX-DR-18 + size/name).
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-18] — full spec sprite inline, danh sách tên, cấm emoji/raster.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-13] — design-system-first, cùng hợp đồng thị giác hai nền tảng.
- [Source: _bmad-output/implementation-artifacts/1-1-tang-token-dung-chung-mau-spacing-radius-quy-tac-vien-net.md] — pattern SSOT + zero-dep generator + parity test + gotcha `node --test` glob; hạ tầng `design-system/` để tái dùng.
- [Source: _bmad-output/project-context.md] — stack version, testing, scout-before-code, thuần front-end.

**Stack liên quan:** React (Web) 19.2.7 · Flutter (Mobile) 3.44 · Node.js 24 LTS. Web/Node: **không** cần dep ngoài (inline SVG + generator thuần). Mobile: **`flutter_svg`** (khuyến nghị) để render SVG string + currentColor — xem "Quyết định thiết kế". [Source: ARCHITECTURE-SPINE.md#Stack, project-context.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8, 1M context)

### Debug Log References

- `node design-system/icons/build-icons.mjs` → sinh 4 output (web sprite/css/component + mobile dart).
- `cd design-system && npm test` → 17/17 pass (7 icon parity + 10 token, không hồi quy).
- `cd mobile && flutter test` → 10/10 pass (6 icon + 4 token).
- `flutter pub add flutter_svg` → resolve `flutter_svg 2.3.0` thành công (network/pub sẵn sàng) → **không** cần HALT.
- Rebuild lại + `git status` → generated files idempotent (không diff), xác nhận drift-guard hợp lệ.

### Completion Notes List

- **SSOT verbatim:** 46 `<symbol>` trích thẳng từ `mockups/all-screens.html` (dòng ~335) vào `design-system/icons/icons.json` — không tự vẽ path. Xác minh chương trình: đúng 46 tên, khớp **chính xác** tập canonical (0 thiếu, 0 thừa), mọi symbol cùng `viewBox="0 0 24 24"` + cùng bộ stroke attrs.
- **Một nguồn, hai nền tảng (NFR-9/UX-DR-27):** generator zero-dep `build-icons.mjs` (theo phong cách `build-tokens.mjs`) derive cả web lẫn mobile từ `icons.json`. Web: `sprite.ts` (sprite inline + `IconName`/`IconSize` union) + `icons.css` (`.icn` verbatim + biến thể) + `Icon.tsx`. Mobile: `app_icons.dart` (registry SVG string + widget `AppIcon`).
- **AC-1 (self-contained):** test khẳng định mọi symbol/SVG có `stroke="currentColor"`, `stroke-width="2"`, `fill="none"` và **0 external ref** (chặn `http(s):`, `xlink:href`, `<image>`, `url(`), body toàn ASCII (không emoji/raster).
- **AC-2 (size + currentColor):** đủ 6 size canonical 18/22/16/15/14/13 — web qua `.icn`(18)/`.icn-xs`(13)/`.icn-{22,16,15,14}` + prop `size` trên `Icon`; mobile qua `AppIcon(size:)`. Icon thừa kế màu ngữ cảnh: web `stroke:currentColor`; mobile resolve `color ?? DefaultTextStyle ?? IconTheme` rồi `ColorFilter.mode(..., srcIn)`. Không hardcode màu icon.
- **AC-3 (đủ tập & chống-drift):** parity test (Node) khẳng định `icons.json` ≡ web ≡ mobile đúng 46 tên; drift-guard so committed == fresh regeneration — sửa 1 nền quên nền kia sẽ **fail**. Dart test khẳng định registry đủ 46, không tên lạ, smoke-render `AppIcon` OK.
- **Trùng path có chủ đích giữ nguyên:** `ic-product≡ic-inventory`, `ic-contract≡ic-file`, `ic-users≡ic-customer` (test khẳng định body bằng nhau — mockup thắng).
- **Câu hỏi mở #1 (render Flutter):** chốt `flutter_svg ^2.3.0` (currentColor thật + 0 asset ngoài, giữ parity vì cùng markup SVG). Fetch thành công nên proceed, không tự chế `CustomPainter`.
- **Câu hỏi mở #2 (alias `ic-warning`):** **không** expose alias — chỉ dùng `ic-ban` theo mockup (mockup thắng). `icons.json` có sẵn field `aliases: {}` (rỗng) làm điểm mở rộng nếu sau này cần, không nhân đôi symbol.
- **Gotcha Node 24 (từ 1.1):** đổi glob test `package.json` → `"**/*.test.mjs"` để bao `icons/**`; thêm script `build:icons`.
- **Ghi chú review:** web hiện chưa có tooling TS/build (scaffold-only như 1.1) nên không có `tsc` để typecheck — file web được bảo vệ bằng parity drift-guard; typecheck web sẽ có ở story dựng web tooling.

### File List

**Mới (nguồn — hand-authored):**
- `design-system/icons/icons.json` — SSOT: 46 symbol verbatim + attrs + size scale.
- `design-system/icons/build-icons.mjs` — generator zero-dep (web + mobile).
- `design-system/icons/parity.test.mjs` — parity/self-contained guards (Node).
- `mobile/test/design_system/icons/app_icons_test.dart` — guard registry + smoke render (Dart).

**Mới (generated — không sửa tay):**
- `web/src/design-system/icons/sprite.ts`
- `web/src/design-system/icons/icons.css`
- `web/src/design-system/icons/Icon.tsx`
- `mobile/lib/design_system/icons/app_icons.dart`

**Sửa:**
- `design-system/package.json` — test glob `**/*.test.mjs` + scripts `build:icons`/`build:tokens`.
- `mobile/pubspec.yaml` — thêm `flutter_svg: ^2.3.0`.
- `mobile/pubspec.lock` — resolve dependency tree cho `flutter_svg`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-2` → `review`.

### Change Log

- 2026-07-07: Triển khai hệ thống icon SVG sprite inline — SSOT `icons.json` (46 symbol verbatim), generator zero-dep sinh sprite/component web + registry/widget Flutter (`flutter_svg`), test parity chống-drift (Node 17/17, Flutter 10/10). Status → review.

## Câu hỏi mở (giải quyết trước hoặc trong khi dev)

1. **Cơ chế render icon ở Flutter:** dùng `flutter_svg` (khuyến nghị — currentColor thật, 0 asset ngoài, giữ parity) hay tự chế `CustomPainter`? Nếu chính sách zero-dep chặn `flutter_svg`, **HALT và hỏi** trước khi tự port 46 icon.
2. **Alias `ic-warning`:** có cần expose alias `ic-warning → ic-ban` cho DX (khớp prose DESIGN.md) không, hay chỉ dùng đúng `ic-ban` theo mockup? (Mặc định: chỉ `ic-ban`; alias chỉ thêm nếu muốn, không nhân đôi symbol.)
</content>
</invoke>
