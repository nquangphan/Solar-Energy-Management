---
baseline_commit: 18e0dc0
---

# Story 1.3: React — Button, Card, Frame, Field

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên web**,
I want **các component nền React (Button, Card, Frame, Field) dựng từ token dùng chung**,
so that **mọi màn web dựng từ component chuẩn, phẳng, không style ad-hoc**.

## Acceptance Criteria

1. **Given** token màu/spacing, **When** dựng Button, **Then** có biến thể **outline mặc định** (viền teal 1.5px, nền trắng, chữ `teal-700` 800), `--primary`, `--accent` (lime-050 + viền lime), `--ghost` (viền line), `--danger` và size `--sm`, `--wide` (UX-DR-5).
2. **Given** yêu cầu Card/Frame, **When** dựng, **Then** Card = nền trắng + viền `line` + bo `lg`; Frame = viền `ink` 1.5px kèm `.frame-label` micro-uppercase nổi trên đường viền (UX-DR-6).
3. **Given** yêu cầu Field, **When** dựng, **Then** viền `line` 1.5px, bo DEFAULT, focus đổi viền sang teal **không glow**, có `.flabel` micro-uppercase muted phía trên và biến thể `.field-lg` cho form đăng nhập (UX-DR-9).
4. **Given** quy tắc "Viền nét", **When** render mọi component trên, **Then** **tuyệt đối phẳng, không drop-shadow/gradient** (UX-DR-4).

## Tasks / Subtasks

- [x] **Task 1 — Phát CSS component verbatim từ nguồn thị giác (AC: 1, 2, 3, 4)**
  - [x] Tạo `web/src/design-system/components/components.css` chứa các rule component **copy verbatim** từ khối CSS trong `mockups/all-screens.html` (dòng 61–88): `.btn` + biến thể/size, `.card` + `--ink`/`--teal`, `.frame` + `.frame-label` + `.frame.on-bg`, `.field` + `::placeholder` + `:focus` + `.field-lg`, `.flabel`, `.fgroup`. Xem bảng "Đặc tả CSS verbatim" trong Dev Notes. **Không tự chế giá trị** — khi lệch giữa mockup và prose → **mockup thắng**.
  - [x] **Remap tên biến radius (gotcha bắt buộc):** mockup dùng `var(--r)` / `var(--r-sm)` / `var(--r-lg)`, nhưng tầng token Story 1.1 phát ra `--radius` / `--radius-sm` / `--radius-lg` (xác minh: `web/src/design-system/tokens/tokens.css`). **Component CSS phải tham chiếu đúng tên biến token đã ship** (`--radius*`), KHÔNG re-declare biến radius, KHÔNG sửa file token 1.1. Giá trị (10/8/12px) không đổi → "mockup thắng" về giá trị vẫn được giữ.
  - [x] Giữ **verbatim** các hằng riêng của component không nằm trong token set: `.field::placeholder{color:#9fb2ad}` (màu placeholder), `.btn .icn{width:15px;height:15px}` (size icon trong nút — kết nối với Icon của Story 1.2). Mockup thắng.
  - [x] **Viền nét (AC-4):** KHÔNG thêm bất kỳ `box-shadow`/`shadow`/`gradient`/`background-image` nào; focus của Field chỉ đổi màu viền sang teal + `outline:none`, **không glow/ring**. Phân cấp chỉ bằng viền 1.5px + màu nền token.
- [x] **Task 2 — Component React có prop biến thể typed (AC: 1, 2, 3)**
  - [x] `Button.tsx`: prop `variant?: 'default' | 'primary' | 'accent' | 'ghost' | 'danger'` (mặc định `default` = outline) + `size?: 'sm' | 'wide'` (optional, không set = size chuẩn) → map sang class `btn` + `btn--{variant}` + `btn--{size}`. Render `<button>` gốc, spread `...rest` (type/onClick/disabled/aria-*), truyền `children` (cho phép đặt `<Icon>` bên trong — CSS `.btn .icn` tự ép 15px). **Union type chặn biến thể tự do** (theo pattern `Icon`/`IconName` của 1.2).
  - [x] `Card.tsx`: prop `variant?: 'default' | 'ink' | 'teal'` → `card` + `card--{variant}`. Render `<div>` bọc `children`, spread `...rest`.
  - [x] `Frame.tsx`: prop `label: string` (nội dung `.frame-label`) + `onBg?: boolean` (thêm class `on-bg` khi frame nằm trên nền `--bg`). Render `<div class="frame [on-bg]"><span class="frame-label">{label}</span>{children}</div>`.
  - [x] `Field.tsx`: prop `label?: string` (render `.flabel` phía trên khi có) + `size?: 'lg'` (thêm `field-lg`) + gói trong `.fgroup`. Render `<input class="field [field-lg]">`; forward `...rest` (value/onChange/placeholder/type/id...). Khi có `label`, nối `htmlFor`/`id` cho a11y (labeled form field — UX-DR-26). **Không** tự thêm glow/validation UI (ngoài phạm vi).
  - [x] `index.ts` barrel export: `Button`, `Card`, `Frame`, `Field` (+ type props) để story sau import một cửa.
- [x] **Task 3 — Import CSS đúng thứ tự tầng (AC: 1, 2, 3, 4)**
  - [x] Bảo đảm `components.css` được nạp **sau** `tokens.css` (component phụ thuộc biến token). Ghi chú thứ tự nạp trong barrel/README ngắn hoặc comment đầu file (chưa có bundler/entry web — xem "Câu hỏi mở"). **Không** dựng bundler/tsconfig đầy đủ ở story này trừ khi cần để test chạy.
- [x] **Task 4 — Test drift-guard chống lệch mockup + Viền nét (AC: 1, 2, 3, 4)**
  - [x] Thêm `design-system/components/components.test.mjs` (Node, zero-dep — theo pattern `icons/parity.test.mjs`) đọc `web/src/design-system/components/components.css` dạng text và khẳng định:
    - Có đủ **selector + biến thể**: `.btn`, `.btn--primary`, `.btn--accent`, `.btn--ghost`, `.btn--danger`, `.btn--sm`, `.btn--wide`, `.card`, `.card--ink`, `.card--teal`, `.frame`, `.frame-label`, `.field`, `.field-lg`, `.flabel` (AC-1/2/3 — thiếu một biến thể là fail).
    - **Đặc tả lõi verbatim:** `.btn` có `border:1.5px solid var(--teal)` + `background:var(--surface)` + `color:var(--teal-700)`; `.btn--accent` refs `--lime-050`/`--lime`; `.card` có `border:1.5px solid var(--line)` + `border-radius:var(--radius-lg)`; `.frame` có `border:1.5px solid var(--ink)`; `.field:focus` đổi `border-color:var(--teal)` + `outline:none` (AC-1/2/3).
    - **Viền nét (AC-4):** file **không** chứa `box-shadow`, `shadow`, `gradient`, hay `background-image` (drift-guard chống ad-hoc elevation).
    - **Không dùng biến radius chưa remap:** file **không** chứa `var(--r)`/`var(--r-sm)`/`var(--r-lg)` (bắt lỗi copy nguyên si quên remap → sẽ vỡ vì token layer không định nghĩa các biến này).
  - [x] Test chạy qua `cd design-system && npm test` (glob `**/*.test.mjs` từ 1.2 đã bao `components/**` — xác minh, không cần sửa glob). Test phải **fail** nếu ai đổi/xoá một rule component mà lệch mockup.

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này **CHỈ WEB (React)** — giao **4 component nền**: Button, Card, Frame, Field (+ CSS component + test drift-guard). Đây là hạ tầng thị giác web để các màn/component sau tiêu thụ.
- **Ngoài phạm vi (thuộc story khác — KHÔNG làm ở đây):**
  - **Flutter/mobile parity** cho các component này → **Story 1.7** (thư viện widget Flutter tương đương). 1.3 **không** đụng `mobile/`.
  - Chip / Status-chip (9 trạng thái) / `.ktype` / `.scope-flag` → **Story 1.4**.
  - Table / Stepper / KPI / **Banner** (Banner có icon trái) → **Story 1.5**.
  - Hành vi giỏ hàng, trạng thái list (loading/empty/error), overlay/dialog, share, upload ảnh → **Story 1.6**.
  - App shell: Topbar (back/action dùng Button `--sm`), Bottom-nav + FAB, Sidebar/toolbar search (`.search .field` padding-left) → **Story 1.8/1.9**. Các size/màu **component-specific** đó định nghĩa ở story tương ứng, KHÔNG phải nền của 1.3.
  - Màn Đăng nhập thật (dùng Field `.field-lg` + Button `--primary --wide`) → **Story 1.11**. 1.3 chỉ cung cấp primitive; **không** dựng màn.
- **Nhưng:** 4 component phải **đủ biến thể/size ngay** để story sau dùng mà không phải bổ sung.

### Tái dùng hạ tầng Story 1.1 + 1.2 — KHÔNG tạo trùng (DRY, scout-before-code)

- **Package `design-system/`** đã tồn tại (từ 1.1): `type: module`, zero external dep, scripts `build`/`test`, glob test `**/*.test.mjs` (đã sửa ở 1.2). **Mở rộng cùng package**: thêm `design-system/components/components.test.mjs`. Đừng dựng package/test-runner thứ hai.
- **Cây web** `web/src/design-system/` đã có `tokens/` (1.1) và `icons/` (1.2). Thêm **anh em** `components/` cạnh chúng — **không** đụng file token/icon đã ship.
- **Consume, không re-declare:** Button/Card/Frame/Field tham chiếu biến token (`--teal`, `--teal-700`, `--lime`, `--lime-050`, `--line`, `--ink`, `--ink-2`, `--surface`, `--muted`, `--danger`, `--font`, `--radius`, `--radius-sm`, `--radius-lg`) do `tokens.css` phát. Verify tên biến trong `web/src/design-system/tokens/tokens.css` **trước** khi viết (đặc biệt `--radius*` — xem gotcha).
- **Pattern component:** noi theo `Icon.tsx` (1.2) — React function component, prop union-typed chặn giá trị tự do, spread `...rest` xuống element gốc, className ghép bằng `[...].filter(Boolean).join(' ')`, file có header `// hand-authored` (component 1.3 là **hand-authored**, không generated — khác token/icon vì không có SSOT đa nền).
- **KHÔNG cần generator/SSOT JSON cho 1.3:** token (1.1) và icon (1.2) có SSOT vì phải derive **2 nền tảng**; component 1.3 **chỉ web** → hand-author CSS/TSX verbatim + test drift-guard là đủ (KISS/YAGNI). Flutter parity (1.7) sẽ dựng widget riêng, cùng token/hình, cùng đặc tả — không copy CSS.

### Kiến trúc & nguyên tắc bắt buộc

- **AD-13 (Design-system-first):** component React là mảnh tiếp theo của hợp đồng thị giác DESIGN.md, dựng **trước mọi màn**; mọi màn sau **cấm style ad-hoc** — phải dùng 4 component này + token. [Source: ARCHITECTURE-SPINE.md#AD-13, project-context.md]
- **Thuần front-end trình bày:** story **không** chạm backend/DB/business logic — chỉ tầng component design-system. Button không nhét logic nghiệp vụ; Field không tự validate/tính toán (client không tính tiền — AD-16). [Source: project-context.md]
- **Nguồn thị giác duy nhất:** khối CSS trong `mockups/all-screens.html` (dòng 61–88). DESIGN.md ghi "khi xung đột, mockup thắng" → **copy verbatim, không tự nhớ/tự chế**. [Source: DESIGN.md#Components]
- **Naming/convention:** file kebab-case cho JS/TS (nhưng component React theo quy ước PascalCase filename như `Icon.tsx` đã ship — **giữ nhất quán với 1.2**: `Button.tsx`/`Card.tsx`/`Frame.tsx`/`Field.tsx`). Web = React function components + hooks. [Source: project-context.md#Coding style]
- **A11y floor (UX-DR-26):** Field có `label` phải nối `htmlFor`/`id`; Button icon-only (nếu có ở story sau) cần `aria-label` — 1.3 chỉ cần bảo đảm Field label hợp lệ và Button forward `aria-*` qua `...rest`. [Source: epics.md#UX-DR-26]

### Đặc tả CSS verbatim (nguồn: mockups/all-screens.html dòng 61–88) [Source: mockups/all-screens.html, UX-DR-4/5/6/9]

> **Copy verbatim các declaration dưới đây.** Chỉ đổi **tên biến radius** `--r`/`--r-sm`/`--r-lg` → `--radius`/`--radius-sm`/`--radius-lg` (token 1.1). Mọi giá trị khác giữ nguyên.

**Button (AC-1):**
```css
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  border:1.5px solid var(--teal);background:var(--surface);color:var(--teal-700);
  font-weight:800;font-size:13px;border-radius:var(--radius);padding:9px 15px;cursor:pointer}
.btn--primary{background:var(--teal);color:#fff;border-color:var(--teal)}
.btn--accent{background:var(--lime-050);color:var(--lime-600);border-color:var(--lime)}
.btn--ghost{border-color:var(--line);color:var(--ink-2)}
.btn--danger{border-color:var(--danger);color:var(--danger)}
.btn--sm{padding:5px 10px;font-size:11.5px;border-radius:var(--radius-sm)}
.btn--wide{width:100%}
.btn .icn{width:15px;height:15px}   /* icon trong nút — kết nối Icon (1.2) */
```
- Ghi chú: `--primary` chữ `#fff` (trắng) là verbatim mockup (không phải token) — giữ nguyên. `--accent` dùng `--lime-600` cho chữ (khớp mockup dòng 66).

**Card + Frame (AC-2):**
```css
.card{background:var(--surface);border:1.5px solid var(--line);border-radius:var(--radius-lg)}
.card--ink{border-color:var(--ink)}
.card--teal{border-color:var(--teal)}
.frame{position:relative;border:1.5px solid var(--ink);border-radius:var(--radius-lg);background:var(--surface)}
.frame > .frame-label{position:absolute;top:-8px;left:14px;background:var(--surface);padding:0 8px;
  font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink)}
.frame.on-bg > .frame-label{background:var(--bg)}
```
- `.frame-label` là "chữ ký kỹ thuật" (technical-drawing motif) nổi trên viền: `position:absolute;top:-8px` + nền phủ (surface hoặc bg qua `.on-bg`) để "cắt" đường viền. `.card--ink`/`.card--teal` là biến thể viền nhấn có trong mockup — giữ.

**Field (AC-3):**
```css
.field{display:block;width:100%;border:1.5px solid var(--line);border-radius:var(--radius);
  background:var(--surface);padding:10px 12px;font-size:13.5px;color:var(--ink);font-family:var(--font)}
.field::placeholder{color:#9fb2ad}
.field:focus,.field.focus{border-color:var(--teal);outline:none}
.field-lg{padding:13px 14px;font-size:15px}
.flabel{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 5px}
.fgroup{margin-bottom:13px}
```
- **Focus = đổi viền teal + `outline:none`, KHÔNG glow/ring** (AC-4 Viền nét). `.field::placeholder{color:#9fb2ad}` là hằng riêng component (không có trong token) — verbatim mockup. `.field-lg` cho form đăng nhập (Story 1.11).

### Gotcha bắt buộc xử lý

- **Radius var mismatch (chính):** mockup `var(--r*)` ≠ token layer `var(--radius*)`. Xác minh: `grep radius web/src/design-system/tokens/tokens.css` → chỉ có `--radius-sm/--radius/--radius-lg/--radius-full`; **không** có `--r*`. Nếu copy nguyên `var(--r)` component sẽ **mất bo góc** (biến undefined). Test Task 4 chặn lỗi này. **Không** thêm alias `--r*` vào token 1.1 (surgical — sửa lan man file story khác).
- **Web chưa có tooling TS/build (từ 1.2 review):** chưa có `tsc`/bundler/entry web → **không typecheck** được `.tsx` ở story này. Component được bảo vệ bằng **drift-guard test đọc CSS** + review thủ công TSX. **Không** scaffold bundler/tsconfig chỉ để typecheck (YAGNI) — để story dựng web app (1.11) hoặc khi thật cần. Ghi rõ deviation này trong Completion Notes.
- **Node 24 test glob (từ 1.1/1.2):** `design-system/package.json` đã dùng `"**/*.test.mjs"` → tự bao `components/**`. **Xác minh** rồi mới thêm test; không cần sửa glob.

### Testing standards [Source: project-context.md#Testing, Story 1.1/1.2 pattern]

- **Drift-guard là bắt buộc** (như 1.1/1.2): test (Node) đọc `components.css` khẳng định đủ selector/biến thể + đặc tả lõi verbatim + **0 shadow/gradient** + **0 `var(--r*)` chưa remap**. Test phải **fail** nếu component lệch mockup hoặc vi phạm Viền nét.
- **Component render test (JSX) hoãn:** giống 1.2 (JSX không test được với tooling Node zero-dep hiện tại) — không dựng web test infra ở đây. Ghi là known limitation, defer tới story có web tooling.
- Chạy: `cd design-system && npm test` (mong đợi pass toàn bộ, không hồi quy token/icon). **Không** cần `flutter test` (story web-only).

### Project Structure Notes

- **Surgical (project-context.md#Scout-before-code):** chỉ tạo file tối thiểu để component compile-về-hình + test drift-guard. **Không** dựng màn, không dựng Flutter, không bundler.
- Đường dẫn đề xuất (mirror `tokens/`, `icons/`):
  - Component web: `web/src/design-system/components/` → `components.css`, `Button.tsx`, `Card.tsx`, `Frame.tsx`, `Field.tsx`, `index.ts`.
  - Test drift-guard: `design-system/components/components.test.mjs` (Node, đọc file web dạng text — như `icons/parity.test.mjs` đọc `sprite.ts`).
- **Không** đụng `web/src/design-system/tokens/*` và `web/src/design-system/icons/*` (đã ship, đã test). Chỉ **thêm** thư mục `components/`.

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html] — khối CSS component dòng 61–88 (`.btn/.card/.frame/.field/.flabel`) + `.btn .icn` dòng 324. **Nguồn thị giác thắng khi xung đột. Copy verbatim.**
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Components] — quy tắc Button/Card/Frame/Field + Viền nét (không shadow/gradient).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — user story + 4 AC (UX-DR-4/5/6/9).
- [Source: _bmad-output/planning-artifacts/epics.md] — UX-DR-5 (Button), UX-DR-6 (Card/Frame), UX-DR-9 (Field), UX-DR-4 (Viền nét).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-13] — design-system-first, cấm style ad-hoc.
- [Source: _bmad-output/implementation-artifacts/1-1-tang-token-dung-chung-mau-spacing-radius-quy-tac-vien-net.md] — token layer + tên biến CSS (`--radius*`, `--font`, màu); hạ tầng `design-system/` + parity test để tái dùng.
- [Source: _bmad-output/implementation-artifacts/1-2-he-thong-icon-svg-sprite-inline.md] — pattern component web (`Icon.tsx` union-typed), glob test `**/*.test.mjs`, cây `web/src/design-system/`, kết nối `.btn .icn` 15px; ghi chú "web chưa có tsc".
- [Source: web/src/design-system/tokens/tokens.css] — danh sách biến token đã ship (verify tên trước khi consume).
- [Source: _bmad-output/project-context.md] — stack version, thuần front-end, Design-system-first, testing, scout-before-code.

**Stack liên quan:** React (Web) 19.2.7 · Node.js 24 LTS. **Không** cần dependency web ngoài (CSS thuần + React function components + test Node zero-dep). Story web-only — **không** đụng Flutter/`mobile/`. [Source: ARCHITECTURE-SPINE.md#Stack, project-context.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8, 1M context)

### Debug Log References

- Drift-guard RED→GREEN: test viết trước, fail (thiếu `components.css`) → tạo CSS → pass.
- Bẫy false-positive: header comment ban đầu chứa chữ "shadow"/"gradient" khiến test quét text AC-4 fail. Đã đổi câu chữ comment (rule CSS vốn đã sạch) → pass. Rút ra: drift-guard quét toàn văn bản file, kể cả comment.

### Completion Notes List

- **Task 1 + 4 (CSS + drift-guard):** `components.css` copy verbatim từ `mockups/all-screens.html` (dòng 61–88 + `.btn .icn` dòng 324). Chỉ remap radius var `--r/--r-sm/--r-lg` → `--radius/--radius-sm/--radius-lg` (token 1.1); mọi giá trị khác giữ nguyên gồm `#fff` (btn--primary), `--lime-600` (btn--accent), `#9fb2ad` (placeholder). Test `components.test.mjs` (Node zero-dep) khẳng định đủ 15 selector/biến thể + đặc tả lõi + 0 shadow/gradient/background-image + 0 `var(--r*)`.
- **Task 2 (React):** `Button/Card/Frame/Field.tsx` hand-authored theo pattern `Icon.tsx` — prop union-typed, spread `...rest`, className `[...].filter(Boolean).join(' ')`. `variant='default'` không thêm class modifier (base rule). `Field` nối `htmlFor`/`id` (dùng `useId` fallback) khi có `label` (a11y UX-DR-26); không tự thêm glow/validation. `index.ts` barrel export 4 component + type.
- **Task 3 (thứ tự nạp CSS):** ghi hợp đồng "components.css nạp SAU tokens.css" trong header `components.css` + comment `index.ts`. Không dựng bundler/entry (YAGNI — chưa có web app; Câu hỏi mở #1 → hoãn tới story dựng web app).
- **ACs:** AC-1 (Button đủ biến thể/size) ✓, AC-2 (Card/Frame + frame-label) ✓, AC-3 (Field + focus teal no-glow + field-lg + flabel) ✓, AC-4 (Viền nét, 0 elevation) ✓ — verify bằng drift-guard.
- **Known limitation (kế thừa 1.2):** repo chưa có `tsc`/bundler → **không typecheck** được `.tsx` ở story này; component được bảo vệ bằng drift-guard đọc CSS + review thủ công TSX. JSX render test hoãn tới story có web tooling. Không đụng `mobile/` (Flutter parity → Story 1.7).
- **Câu hỏi mở:** #1 (cơ chế nạp CSS) → chốt hoãn, chỉ ghi thứ tự trong comment. #2 (Field bọc label) → chốt một `Field` nhận `label?` (không label = input trần), gói `.fgroup` khi có label.

### File List

- `web/src/design-system/components/components.css` (mới)
- `web/src/design-system/components/Button.tsx` (mới)
- `web/src/design-system/components/Card.tsx` (mới)
- `web/src/design-system/components/Frame.tsx` (mới)
- `web/src/design-system/components/Field.tsx` (mới)
- `web/src/design-system/components/index.ts` (mới)
- `design-system/components/components.test.mjs` (mới)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (sửa: 1-3 → in-progress → review)

## Change Log

- 2026-07-08: Hoàn tất Story 1.3 — CSS component verbatim (Button/Card/Frame/Field) remap radius var, 4 component React typed + barrel, drift-guard test (4 test, suite 26/26 pass). Status → review.

## Câu hỏi mở (giải quyết trước hoặc trong khi dev)

1. **Nạp CSS component:** chưa có bundler/entry web trong repo (scaffold-only từ 1.1/1.2). Chốt cơ chế nạp `components.css` sau `tokens.css` bây giờ (import barrel / một file entry design-system) hay hoãn tới story dựng web app (1.11)? Mặc định: hoãn — chỉ ghi thứ tự nạp trong comment/README ngắn, không dựng bundler (YAGNI).
2. **`Field` bọc label:** `Field` render kèm `.flabel` + `.fgroup` (component đầy đủ) hay tách `Field` (chỉ input) + `FieldGroup` (label+input)? Mặc định đề xuất: một `Field` nhận prop `label?` (không có label → chỉ input trần), gói `.fgroup` khi có label — KISS, đủ cho form đăng nhập 1.11.
