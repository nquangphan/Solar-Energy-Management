---
baseline_commit: a324db0
---

# Story 1.9: App shell web — Sidebar + Web frame

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên web**,
I want **khung app web chuẩn — `WebFrame` (faux browser chrome + url pill), `Sidebar` (nav dọc 186px), bộ toolbar `Toolbar`/`Seg`/`Tabs`/`SearchField`, `Topbar` (parity web của `AppTopbar` mobile), và một scaffold `WebShell` lắp chúng lại — dựng từ chính token CSS + `Icon` sprite đã ship, phẳng "Viền nét", KHÔNG chứa business logic**,
so that **mọi màn web văn phòng (Đăng nhập 1.11, Dashboard/Đơn/Khách/Danh mục/Kho/Phân quyền/Audit ở Epic 3–8) nằm trong MỘT shell nhất quán, được nhận ra là CÙNG màn với mobile — chỉ khác khung (browser chrome vs phone frame) và điều hướng (sidebar vs bottom-nav) (UX-DR-27) — và không dev nào tự style ad-hoc, nhét router/nghiệp vụ vào shell, hay lệch khỏi mockup chuẩn tắc**.

## Acceptance Criteria

1. **AC-1 — Sidebar dọc 186px (UX-DR-16):** **Given** yêu cầu sidebar, **When** dựng `Sidebar`, **Then** thanh nav dọc **cố định `width:186px; flex:0 0 186px`**, nền `surface-2`, viền phải `line` 1.5px, padding 13/10; đầu là **brand2** (logo 26×26 viền `teal` 1.5px bo 7px chứa `Icon('ic-sun')` + chữ `.t` 12.5px/w900); các **`.navlink`** (padding 7/10, bo `radius-sm`=8px, 12px/w700 `ink-2`, gap 8, `Icon` 16px màu `#8fa39e`) với **active = nền `#fff` + viền `teal` 1.5px + chữ `teal-700` + icon `teal`**; các nhóm phân cách bằng **`.navsec`** (9px/w800 letter-spacing .1em UPPERCASE, màu `#a9bab5`, margin 12/10/5). Danh sách nav **truyền qua prop** (mảng section→link), có `activeKey` để tô active; bấm link **chỉ phát `onNavigate(key)`** — KHÔNG tự điều hướng, KHÔNG router. **KHÔNG** gating theo quyền ở đây (gating là Story 1.10 — sidebar chỉ render những gì caller truyền vào).

2. **AC-2 — Web frame / faux browser chrome (UX-DR-16):** **Given** yêu cầu web frame, **When** dựng `WebFrame`, **Then** vỏ **`.web`** `flex:1 1 760px; min-width:0`, viền `ink` 1.5px, bo `radius-lg`, `overflow:hidden`, nền `#fff`; **`.web-chrome`** (nền `surface-2`, viền dưới `line` 1.5px, padding 9/12, gap 10) chứa **`.web-dots`** = đúng **3 chấm** `<i>` (10×10, hình tròn, viền `line` 1.5px) + **`.web-url`** pill (nền `#fff`, viền `line` 1.5px, bo 999px, padding 4/12, 11px/w600 `muted`, nhận url qua prop); dưới chrome là **`.web-app`** (`display:flex; min-height:520px`) bọc `children` (sidebar + main). URL là prop hiển thị thuần — KHÔNG điều hướng thật.

3. **AC-3 — Toolbar controls (UX-DR-16):** **Given** yêu cầu toolbar, **When** dựng bộ toolbar, **Then**: (a) **`Toolbar`** = wrapper `.toolbar` (`display:flex; gap:8; flex-wrap:wrap; align-items:center; margin-bottom:14`), slot children; (b) **`SearchField`** = `.search` (`flex:1; min-width:160; position:relative`) chứa **icon SVG search** `.si` (`Icon('ic-search',16)` absolute trái, màu `#9fb2ad`) + `.field` design-system với `padding-left:32`; (c) **`Seg`** = segmented `.seg` (inline-flex, viền `line` 1.5px, bo `radius`, overflow hidden), mỗi mục `.seg a` (11.5px/w700 `ink-2`, padding 6/12, viền phải `line` 1.5px, mục cuối bỏ viền phải), **active = nền `teal` + chữ `#fff`**; nhận `options`+`activeKey`, bấm phát `onSelect(key)`; (d) **`Tabs`** = `.tabs` (flex gap2, viền dưới `line` 1.5px, margin-bottom 14, wrap), mỗi `.tabs a` (12px/w700 `muted`, padding 8/12, viền dưới 2px transparent, margin-bottom -1.5px), **active = chữ `teal-700` + viền dưới `teal`**; nhận `tabs`+`activeKey`, bấm phát `onSelect(key)`. Tất cả **chỉ phát callback**, KHÔNG tự đổi state điều hướng.

4. **AC-4 — Responsive breakpoint `max-width:900px`:** **Given** viewport thu hẹp ≤ 900px, **When** render shell, **Then** (verbatim mockup 310–315): `.web-app` chuyển **`flex-direction:column`** (xếp dọc); `.web .sidebar` thành **hàng ngang wrap** (`width:auto; flex:none; border-right:0; border-bottom:1.5px line; display:flex; flex-wrap:wrap; gap:4`); `.sidebar .brand2, .sidebar .navsec` chiếm **`width:100%`**; `.kpis` từ **4→2 cột** (`grid-template-columns:repeat(2,1fr)`). Base `.kpis` (4 cột) đã có sẵn ở `components.css` (Story 1.5) — story này CHỈ thêm override 2 cột trong khối media của shell.

5. **AC-5 — WebShell scaffold + Topbar parity + Viền nét + không business logic + parity mobile:** **Given** một màn nghiệp vụ, **When** dùng `WebShell`, **Then**: (a) `WebShell({ url, sidebar?, topbar?, children })` lắp `WebFrame` bọc `.web-app` = `sidebar` (nếu có) + `.main` (`flex:1; min-width:0; padding:18/20; nền #fff`) chứa `topbar` (nếu có) + `children`; **màn xác thực (Đăng nhập/Quên mật khẩu) truyền `sidebar={null}` → KHÔNG hiển thị sidebar** (parity với mobile `bottomNav:null`, UX-DR-15) — shell KHÔNG tự quyết định khi nào ẩn nav; (b) **`Topbar`** (parity web của `AppTopbar` — canonical `.topbar` mockup 232–241: back 28×28 viền `line` bo 8px + `Icon('ic-chevron-left',18)` `teal-700`; title 15px/w800 ls -.01em 1 dòng ellipsis + eyebrow 10px/w800 ls .1em UPPERCASE `teal` tuỳ chọn; action `teal-700` 12px/w800 hoặc `Icon` 15px; viền dưới `ink` 1.5px), back/action **chỉ phát `onBack`/`onAction`**; (c) **phẳng tuyệt đối** — CẤM `box-shadow`/`filter:drop-shadow`/gradient trong shell CSS; **web shell KHÔNG có FAB → 0 ngoại lệ shadow** (khác mobile 1.8 vốn được 1 ngoại lệ ring FAB); (d) **radius remap** — mọi `var(--r)`/`var(--r-sm)`/`var(--r-lg)` trong CSS gốc mockup phải đổi thành `var(--radius)`/`var(--radius-sm)`/`var(--radius-lg)` (khớp token layer đã ship, y như `components.css` Story 1.3); literal không phải var (`999px`, `50%`, `#8fa39e`, `#a9bab5`, `#9fb2ad`) giữ **verbatim mockup**; (e) shell **thuần trình bày** — KHÔNG gọi mạng, KHÔNG router, KHÔNG tính tiền/đổi trạng thái; chỉ phát ý định qua callback; đạt **full parity** với mobile 1.8 (UX-DR-27): cùng màn, khác khung + điều hướng.

## Tasks / Subtasks

> **Naming convention (chốt — theo web design-system đã ship):** web dùng **PascalCase file + component, KHÔNG tiền tố `App`** (đúng như `Button`, `Card`, `StatusChip`, `CartLineRow` hiện có — tiền tố `App` là đặc thù Flutter để tránh đụng Material, KHÔNG áp cho React). Vì vậy: `Topbar`, `Sidebar`, `WebFrame`, `Toolbar`, `Seg`, `Tabs`, `SearchField`, `WebShell`. Đặt shell ở **module riêng** `web/src/design-system/shell/` (song song `components/`, `icons/`, `tokens/`) + CSS `shell.css` + barrel `index.ts`. *(Ghi chú 1.8 nói "React AppTopbar/AppBottomNav/WebFrame" — đó là cách gọi tắt phía Flutter; tên web chính tắc bỏ prefix `App`; `AppBottomNav` phía web ↔ `Sidebar` vì web dùng nav dọc, không bottom-nav.)*

- [x] **Task 1 — `shell.css` (tầng CSS chuẩn tắc, AC: 1,2,3,4,5)**
  - [x] Tạo `web/src/design-system/shell/shell.css`. Chép **verbatim** khối shell từ mockup `all-screens.html`: `.topbar`/`.topbar-*` (232–241), `.web`/`.web-chrome`/`.web-dots`/`.web-url`/`.web-app` (272–280), `.web .sidebar`/`.brand2`/`.navlink`/`.navlink.active`/`.navsec` (282–293), `.main`/`.main-head`/`.toolbar`/`.search`/`.si`/`.seg`/`.tabs` (295–308), media `@media(max-width:900px)` (310–315) — nhưng CHỈ phần shell (`.web-app`, `.web .sidebar`, `.sidebar .brand2/.navsec`, `.kpis` override 2 cột).
  - [x] **Radius remap (BẮT BUỘC):** `var(--r-lg)`→`var(--radius-lg)` (`.web`), `var(--r-sm)`→`var(--radius-sm)` (`.navlink`), `var(--r)`→`var(--radius)` (`.seg`). Literal `999px`/`50%` (`.web-url`, `.web-dots i`) giữ nguyên. Đây là ĐIỂM DRIFT dễ sai — theo đúng note đầu `components.css`.
  - [x] Thêm header comment như `components.css`: "Hand-authored shell layer (Story 1.9). Copied verbatim from mockups/all-screens.html lines 232–315. Only change vs mockup: --r* → --radius* remap. MUST load AFTER tokens.css + icons.css."
  - [x] Icon size rules cho shell (mockup 321–322, 301): `.topbar-back .icn{18px}`, `.topbar-action .icn{15px}`, `.si .icn{16px}`, `.logo .icn{18px}`, `.navlink .icn{16px}` — thêm nếu chưa nằm trong `icons.css`/`components.css` (rà trước, KHÔNG trùng lặp).

- [x] **Task 2 — `Sidebar.tsx` (AC: 1, 5)**
  - [x] Tạo `web/src/design-system/shell/Sidebar.tsx` — `export function Sidebar(...)`. Props: `{ sections: NavSection[]; activeKey?: string; onNavigate?: (key: string) => void; brand?: { icon?: IconName; label: string } }`. Type `NavSection = { title?: string; links: NavLink[] }`, `NavLink = { key: string; icon: IconName; label: string }`.
  - [x] Render `<nav className="sidebar">`: brand2 (`Icon` mặc định `ic-sun` + `brand.label` mặc định "Phương Nam") → với mỗi section: nếu `section.title` → `<div className="navsec">{title}</div>`; mỗi link → `<a className={active? 'navlink active':'navlink'}>` chứa `<Icon name={link.icon} size={16}/>` + label; onClick → `onNavigate?.(link.key)` + `preventDefault` (không nhảy href thật). Dùng `href="#"` hoặc bỏ href (nút điều hướng thuần callback) — **KHÔNG** router.
  - [x] Export hằng `SIDEBAR_NAV` (bộ nav chuẩn tắc theo mockup 601–610: Trang chủ/Đơn hàng/Khách hàng/Danh mục/Kho + section "Quản trị": Phân quyền/Audit/Hồ sơ) để màn/Story 1.10 lọc theo quyền. Sidebar **không** tự chứa danh sách cứng — nhận qua prop (khác bottom-nav mobile khoá cứng, vì nav web bị gating ở 1.10).

- [x] **Task 3 — `WebFrame.tsx` (AC: 2, 5)**
  - [x] Tạo `web/src/design-system/shell/WebFrame.tsx` — `export function WebFrame({ url, children })`. Props: `{ url: string; children: ReactNode }`.
  - [x] Render `<div className="web">` → `<div className="web-chrome">` chứa `<div className="web-dots"><i/><i/><i/></div>` (đúng 3 `<i>`) + `<div className="web-url">{url}</div>`; rồi `<div className="web-app">{children}</div>`. URL hiển thị thuần, KHÔNG là link.

- [x] **Task 4 — `Topbar.tsx` (parity web của AppTopbar) (AC: 5)**
  - [x] Tạo `web/src/design-system/shell/Topbar.tsx` — `export function Topbar(...)`. Props: `{ title: string; eyebrow?: string; onBack?: () => void; action?: ReactNode; onAction?: () => void }`.
  - [x] Render `<div className="topbar">`: nếu `onBack` → `<button className="topbar-back" aria-label="Quay lại" onClick={onBack}><Icon name="ic-chevron-left" size={18}/></button>`; giữa `<div className="topbar-title">` chứa (nếu `eyebrow`) `<span className="topbar-eyebrow">{eyebrow}</span>` rồi `{title}`; phải (nếu `action`) `<div className="topbar-action" onClick={onAction}>{action}</div>` (nhận `Text` hoặc `<Icon size={15}/>`). Eyebrow hiển thị **verbatim** (mockup truyền sẵn chữ hoa — KHÔNG ép `.toUpperCase()`, để parity với mobile 1.8). Back/action **chỉ callback**, KHÔNG tự điều hướng.
  - [x] `.topbar-back` render `<button>` (không `<a href>`) để phát callback + có `aria-label` (accessibility floor sẽ siết ở 1.10, nhưng icon-only cần label ngay).

- [x] **Task 5 — Toolbar controls: `Toolbar` / `Seg` / `Tabs` / `SearchField` (AC: 3, 5)**
  - [x] `web/src/design-system/shell/Toolbar.tsx` — `export function Toolbar({ children, className })` → `<div className={['toolbar', className].filter(Boolean).join(' ')}>{children}</div>`.
  - [x] `web/src/design-system/shell/Seg.tsx` — props `{ options: {key:string;label:string}[]; activeKey?: string; onSelect?: (key:string)=>void }` → `<div className="seg">` map `<a className={active?'active':undefined} onClick={()=>onSelect?.(key)}>{label}</a>`. `preventDefault`.
  - [x] `web/src/design-system/shell/Tabs.tsx` — props `{ tabs: {key:string;label:string}[]; activeKey?: string; onSelect?: (key:string)=>void }` → `<div className="tabs">` map `<a className={active?'active':undefined} onClick={()=>onSelect?.(key)}>{label}</a>`. `preventDefault`.
  - [x] `web/src/design-system/shell/SearchField.tsx` — props kế thừa `InputHTMLAttributes` + `{ }` → `<div className="search"><span className="si"><Icon name="ic-search" size={16}/></span><input className="field" {...rest}/></div>` (Field từ `.field`; `.si` là icon absolute; placeholder/value/onChange chảy qua `...rest`).

- [x] **Task 6 — `WebShell.tsx` scaffold + barrel `index.ts` (AC: 4, 5)**
  - [x] `web/src/design-system/shell/WebShell.tsx` — `export function WebShell({ url, sidebar, topbar, children })`. Props: `{ url: string; sidebar?: ReactNode; topbar?: ReactNode; children: ReactNode }`.
  - [x] Render `<WebFrame url={url}>{sidebar}{<div className="main">{topbar}{children}</div>}</WebFrame>` — `sidebar` là slot (`<Sidebar/>` hoặc `null` cho auth); `.main` bọc topbar + content. **Auth truyền `sidebar={null}`** → không render sidebar (parity mobile). WebShell KHÔNG tự bọc gating/router.
  - [x] Barrel `web/src/design-system/shell/index.ts` export 8 component + type: `Topbar`, `Sidebar` (+ `SIDEBAR_NAV`, `NavSection`, `NavLink`), `WebFrame`, `Toolbar`, `Seg`, `Tabs`, `SearchField`, `WebShell`. **KHÔNG** re-export tokens/icons/components (import trực tiếp như `components/index.ts`). Thêm note CSS load order: `shell.css` sau `tokens.css`+`icons.css`+`components.css`.

- [x] **Task 7 — Test: drift-guard CSS + parity cross-platform (AC: tất cả)**
  - [x] Tạo `design-system/components/shell-web.test.mjs` (mẫu `components.test.mjs`): đọc `web/src/design-system/shell/shell.css` dạng text, khẳng định:
    - (a) **selectors tồn tại**: `.topbar`, `.topbar-back`, `.topbar-title`, `.topbar-eyebrow`, `.topbar-action`, `.web`, `.web-chrome`, `.web-dots`, `.web-url`, `.web-app`, `.sidebar` (hoặc `.web .sidebar`), `.brand2`, `.navlink`, `.navlink.active`, `.navsec`, `.main`, `.toolbar`, `.search`, `.seg`, `.seg a.active`, `.tabs`, `.tabs a.active`, `@media(max-width:900px)`.
    - (b) **khai báo verbatim mockup**: sidebar `width:186px;flex:0 0 186px`, `background:var(--surface-2)`, `border-right:1.5px solid var(--line)`; `.navlink.active` `background:#fff` + `border:1.5px solid var(--teal)` + `color:var(--teal-700)`; `.web` `border:1.5px solid var(--ink)`; `.web-url` `border-radius:999px`; `.seg a.active` `background:var(--teal);color:#fff`; `.tabs a.active` `border-bottom-color:var(--teal)`; `.topbar` `border-bottom:1.5px solid var(--ink)`.
    - (c) **radius remap**: shell.css chứa `var(--radius-lg)`/`var(--radius-sm)`/`var(--radius)` và **KHÔNG** chứa `var(--r-lg)`/`var(--r-sm)`/`var(--r)` (regex `var\(--r[-)]` phải fail).
    - (d) **Viền nét (0 shadow)**: shell.css **KHÔNG** chứa `box-shadow`, `drop-shadow`, `gradient`, `filter:` (web shell 0 ngoại lệ — không FAB).
    - (e) **breakpoint**: khối media chứa `.web-app{flex-direction:column}`, sidebar `width:auto` + `border-bottom:1.5px`, `.kpis{grid-template-columns:repeat(2,1fr)}`.
  - [x] Tạo `design-system/components/shell-tsx.test.mjs`: đọc các `.tsx` shell dạng text, khẳng định **thuần trình bày**: KHÔNG `import` router (`react-router`, `next/`, `history`), KHÔNG `fetch(`/`axios`/`XMLHttpRequest`, KHÔNG `box-shadow`/style shadow inline; `Sidebar`/`Seg`/`Tabs`/`Topbar` chỉ phát callback (`onNavigate`/`onSelect`/`onBack`/`onAction`); `WebFrame` render đúng **3** `<i>` (regex đếm `<i />`/`<i>` = 3); `Topbar` back là `<button` có `aria-label`.
  - [x] **Mở rộng `design-system/components/shell-parity.test.mjs`** thành cross-platform thực sự (theo đúng TODO ghi ở đầu file 1.8): thêm khối đọc `web/src/design-system/shell/shell.css` + `Topbar.tsx` và khẳng định hằng chuẩn tắc khớp Flutter ↔ web ↔ mockup: **topbar** border-bottom `ink` 1.5px + back 28px + eyebrow ls .1em (cả web `.topbar` lẫn Flutter `app_topbar.dart`); **frame parity** (web `.web` viền ink + bo radius-lg ↔ Flutter phone `#0C1512` bo 40 — khác hình nhưng cùng vai "khung"), ghi rõ trong comment rằng web-only là `sidebar/seg/tabs/web-chrome`, mobile-only là `botnav/phone/fab`, **chung** là `topbar`. Sửa comment "does not exist yet" ở đầu file thành trạng thái đã có web.

- [x] **Task 8 — Verify + cập nhật tài liệu (AC: tất cả)**
  - [x] Chạy `npm --prefix design-system test` (hoặc `node --test "design-system/**/*.test.mjs"`): toàn bộ pass gồm 98 test parity cũ (Story 1.8) — **0 regression** — + test mới của 1.9.
  - [x] Nếu repo có typecheck web (rà `tsconfig`): chạy; nếu KHÔNG có build web (hiện tại: web/ chỉ có `src/`, không `package.json`/`tsconfig` — validate qua Node text-test như Story 1.3–1.6), ghi rõ trong Completion Notes rằng React runtime/tsc chưa có, guard bằng Node text-test đúng pattern đã lập.
  - [x] Cập nhật `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-9-...` → `review` khi dev xong (do dev-story/code-review làm, KHÔNG ở create-story).

## Dev Notes

### Bối cảnh & nguồn chân lý
- App nội bộ Phương Nam Solar, 3 client tách biệt; story này chỉ đụng **web React**. Nguồn UI: `DESIGN.md` + mockup `all-screens.html` (**mockup thắng khi xung đột**), hành vi: `EXPERIENCE.md`. Kiến trúc: `ARCHITECTURE-SPINE.md` (AD-1..18).
- **Build-order design-system-first (AD-13):** app shell là tầng design-system, dựng TRƯỚC màn tính năng. Story 1.8 = shell mobile (đã done); **Story 1.9 = shell web (this)**; Story 1.10 = primitive gating theo quyền (sẽ gate sidebar/nav); Story 1.11 = màn Đăng nhập dùng shell chứng minh.
- **Story 1.8 đã chốt parity là 1.9:** ghi chú `shell-parity.test.mjs` + dev notes 1.8 nói rõ "Parity web (AppTopbar/AppBottomNav/WebFrame React) là Story 1.9". Vì vậy 1.9 hoàn tất phía web + biến parity test Flutter-với-mockup thành **cross-platform thực sự**.

### Phụ thuộc đã có — TÁI DÙNG, KHÔNG dựng lại (scout-before-code)
- **Token CSS (Story 1.1):** `web/src/design-system/tokens/tokens.css` → biến `--teal`, `--teal-700`, `--surface-2`, `--ink`, `--ink-2`, `--muted`, `--line`, `--radius`(10), `--radius-sm`(8), `--radius-lg`(12), `--radius-full`, `--font`. Shell CSS **chỉ tham chiếu var**, KHÔNG khai token mới. Literal shell không có trong token (`#8fa39e` icon nghỉ navlink, `#a9bab5` navsec, `#9fb2ad` placeholder/search icon, `999px` pill, `50%` dot) = hằng chuẩn tắc mockup, giữ verbatim.
- **Icon sprite (Story 1.2):** `web/src/design-system/icons/Icon.tsx` → `<Icon name size/>` (render `<use href="#ic-*"/>`, màu currentColor). Icon shell cần **đã có sẵn**: `ic-sun`, `ic-home`, `ic-orders`, `ic-customer`, `ic-catalog`, `ic-warehouse`, `ic-permissions`, `ic-audit`, `ic-user`, `ic-chevron-left`, `ic-search`. Dùng `IconName` type (chặn tên sai) — KHÔNG hardcode `<svg>` thủ công.
- **Component `.field` (Story 1.3):** `SearchField` **tái dùng class `.field`** (đã có ở `components.css`), chỉ bọc `.search`+`.si`. KHÔNG dựng input mới.
- **Mẫu component web (Story 1.3–1.6) để bắt chước style:** `Button.tsx` (union type chặn variant ad-hoc, emit className, `...rest` chảy qua), `StatusChip.tsx` (map literal→class), `Dialog.tsx`/`Sheet.tsx` (callback-only overlay). Đọc `Button.tsx` + `index.ts` trước khi viết — theo đúng khuôn: hàm function component, PascalCase, TSX + className, CSS ở file .css riêng.
- **`.kpis` grid (Story 1.5):** base 4 cột đã có ở `components.css:126`. Story này CHỈ thêm override 2 cột trong media của `shell.css`. **KHÔNG** đụng `components.css`.

### Vị trí file (module boundary)
- Shell là **biên module mới** → `web/src/design-system/shell/` (song song `components/`, `icons/`, `tokens/`). File mới:
  - `shell/shell.css` (tầng CSS chuẩn tắc)
  - `shell/Topbar.tsx`, `shell/Sidebar.tsx`, `shell/WebFrame.tsx`, `shell/Toolbar.tsx`, `shell/Seg.tsx`, `shell/Tabs.tsx`, `shell/SearchField.tsx`, `shell/WebShell.tsx`
  - `shell/index.ts` (barrel)
  - Test Node: `design-system/components/shell-web.test.mjs`, `shell-tsx.test.mjs`; **mở rộng** `design-system/components/shell-parity.test.mjs`.
- **KHÔNG** đụng `components/index.ts` / `components.css` (shell tách riêng). **KHÔNG** sửa component Story 1.3–1.6. **KHÔNG** sửa Flutter shell 1.8 (chỉ đọc `app_topbar.dart` cho parity test).

### Spec chuẩn tắc (rút verbatim từ mockup `all-screens.html` 232–315) — khớp byte-cho-byte (sau remap `--r*`→`--radius*`)
```
.topbar        flex · gap 10 · padding 10/13 · border-bottom 1.5px ink · bg #fff
.topbar-back   28×28 · border 1.5px line · radius 8(→--radius-sm) · bg #fff · teal-700 · icn 18
.topbar-title  flex1 · 15px/800 ls -.01em · 1 dòng ellipsis
.topbar-eyebrow block · 10px/800 ls .1em UPPERCASE · teal
.topbar-action 12px/800 · teal-700 (hoặc icn 15)
.web           flex 1 1 760 · min-w 0 · border 1.5px ink · radius (→--radius-lg) · overflow hidden · bg #fff
.web-chrome    flex · gap 10 · padding 9/12 · bg surface-2 · border-bottom 1.5px line
.web-dots i    10×10 · circle(50%) · border 1.5px line   (đúng 3 chấm)
.web-url       flex1 · bg #fff · border 1.5px line · radius 999px(pill) · padding 4/12 · 11px/600 muted
.web-app       flex · min-height 520
.web .sidebar  w186 · flex 0 0 186 · border-right 1.5px line · bg surface-2 · padding 13/10
.brand2        flex · gap 8 · margin 2/4/14   · logo 26×26 border teal radius 7 · .t 12.5px/900
.navlink       flex · gap 8 · padding 7/10 · radius 8(→--radius-sm) · 12px/700 ink-2 · mb 2 · icn 16 #8fa39e
.navlink.active bg #fff · border 1.5px teal · color teal-700   · .active .icn teal
.navsec        9px/800 ls .1em UPPERCASE · #a9bab5 · margin 12/10/5
.main          flex1 · min-w 0 · padding 18/20 · bg #fff
.toolbar       flex · gap 8 · wrap · align center · mb 14
.search        flex1 · min-w 160 · relative   · .search .field padding-left 32 · .si left 11 #9fb2ad icn 16
.seg           inline-flex · border 1.5px line · radius (→--radius) · overflow hidden
.seg a         11.5px/700 ink-2 · padding 6/12 · border-right 1.5px line (last: 0) · .active bg teal #fff
.tabs          flex · gap 2 · border-bottom 1.5px line · mb 14 · wrap
.tabs a        12px/700 muted · padding 8/12 · border-bottom 2px transparent · mb -1.5 · .active teal-700 + border teal
@media(max-width:900px): .web-app column · sidebar hàng ngang wrap (w auto, border-right 0, border-bottom 1.5px line, flex wrap gap 4) · brand2/navsec w100% · .kpis 2 cột
```
Nav chuẩn tắc sidebar (mockup 601–610): `Trang chủ`(ic-home) · `Đơn hàng`(ic-orders) · `Khách hàng`(ic-customer) · `Danh mục`(ic-catalog) · `Kho`(ic-warehouse) — section **"Quản trị"** — `Phân quyền`(ic-permissions) · `Audit`(ic-audit) · `Hồ sơ`(ic-user). Brand: `ic-sun` + "Phương Nam".

### Bất biến phải giữ (AD / UX-DR)
- **AD-13:** shell dùng lại token/icon/component đã ship; CẤM style ad-hoc (chỉ literal shell chuẩn tắc được phép).
- **UX-DR-16:** sidebar 186px surface-2 + navlink active viền teal/nền trắng + navsec micro-uppercase; web frame chrome + 3 chấm + url pill; toolbar search-icon + seg (active teal) + tabs (underline teal). **Byte-cho-byte mockup.**
- **UX-DR-14 (topbar):** parity web của topbar — cùng spec back/title/eyebrow/action như mobile.
- **Viền nét (UX-DR-4..13):** phẳng, **0 shadow/gradient** — web shell **KHÔNG có ngoại lệ nào** (mobile 1.8 có 1 ngoại lệ ring FAB; web không FAB).
- **Không business logic (AD-1/2/4/11):** shell thuần trình bày; điều hướng/nghiệp vụ do màn/router ở tầng trên; shell chỉ phát callback ý định. KHÔNG mạng, KHÔNG router, KHÔNG tính tiền/đổi trạng thái. **Gating theo quyền là UX-DR-22 / Story 1.10** — KHÔNG cài ở đây (sidebar nhận nav qua prop để 1.10 lọc).
- **UX-DR-27 (parity):** cùng màn nghiệp vụ web ↔ mobile, chỉ khác khung (browser chrome vs phone frame) + điều hướng (sidebar vs bottom-nav).

### Gotchas (từ Story 1.3–1.8 + đặc thù shell web)
1. **Radius remap là điểm drift số 1:** mockup dùng `var(--r)`/`var(--r-sm)`/`var(--r-lg)` NHƯNG token đã ship là `--radius*`. QUÊN remap = CSS gãy im lặng (var không tồn tại → radius 0). `components.css` Story 1.3 đã remap; làm y hệt. Test (c) chặn regression.
2. **`.web-url` pill = `999px` literal, KHÔNG `--radius-full`:** giữ verbatim mockup (999px), đừng "chuẩn hoá" sang token — parity test so byte.
3. **Đúng 3 chấm `.web-dots`:** mockup `<i></i><i></i><i></i>`. KHÔNG map từ array (dễ lệch số) — render cứng 3 `<i>` hoặc `[0,1,2].map`. Test đếm = 3.
4. **`.si` search icon absolute + `.field` padding-left 32:** icon nằm trong `.search` (relative), `.field` chừa chỗ trái 32px. Đừng đặt icon trong input.
5. **Eyebrow uppercase:** mockup truyền sẵn chữ hoa (vd "XIN CHÀO, ANH TÚ · QUẢN LÝ"); hiển thị **verbatim** — KHÔNG ép `.toUpperCase()` trong component (đồng bộ quyết định 1.8, giữ parity + cho phép caller truyền hoa/thường).
6. **`.navlink`/`.seg a`/`.tabs a` là `<a>` trong mockup (điều hướng anchor) — nhưng shell KHÔNG router:** render `<a>` cho đúng CSS/semantic nhưng `onClick` gọi callback + `e.preventDefault()`; KHÔNG dùng `href` thật để nhảy. `Topbar` back là `<button>` (hành động, không điều hướng) + `aria-label`.
7. **Sidebar KHÔNG khoá cứng (khác bottom-nav):** bottom-nav mobile khoá 5 tab qua hằng nội bộ (không prop) vì cố định; **sidebar web nhận nav qua prop** vì Story 1.10 gate theo quyền (Audit ẩn với non-Super-Admin, v.v.). Đừng copy pattern "khoá cứng" của bottom-nav sang sidebar. Export `SIDEBAR_NAV` làm bộ mặc định để lọc.
8. **CSS load order:** `shell.css` phải import SAU `tokens.css` (cần var) + `icons.css` + `components.css` (dùng `.field`, `.kpis`). Ghi contract trong `index.ts` (như `components/index.ts`), KHÔNG tạo bundler/entry (chưa có, YAGNI).
9. **Container/inline-style:** đừng nhét style inline shadow/elevation; mọi phân cấp bằng viền + bậc nền (bg → surface → surface-2). Test (d) chặn `box-shadow`/`filter`/`gradient`.

### Testing standards
- Web hiện **không có React runtime/tsc build** (web/ chỉ `src/`, không `package.json`/`tsconfig`) — như Story 1.3–1.6, guard bằng **Node text-test** đọc CSS/TSX dạng chuỗi (`design-system/**/*.test.mjs`, chạy `node --test`). Đây là contract chống drift đã lập, KHÔNG cần thêm test runner mới.
- Bắt buộc test cho shell (nền mọi màn): **drift-guard CSS** (selectors + khai báo verbatim + radius remap + 0 shadow + breakpoint), **source-guard TSX** (0 router/network, callback-only, 3 dots, back là button+aria-label), **parity cross-platform** (topbar chung Flutter↔web↔mockup; đánh dấu web-only vs mobile-only).
- Chạy `node --test "design-system/**/*.test.mjs"` — **0 regression** với 98 test parity Story 1.8. Xem mẫu: `components.test.mjs` (drift-guard), `parity.test.mjs` (cross-platform), `shell-parity.test.mjs` (mockup-anchored, có sẵn TODO mở rộng web).

### Project Structure Notes
- Tuân cấu trúc `web/src/design-system/{tokens,icons,components,shell}` — thêm `shell/` là biên tự nhiên, song song mobile `mobile/lib/design_system/shell/`. Không phá cấu trúc, không xung đột.
- Không tạo app entry/router ở story này (shell là thư viện component; wiring app thật + màn Đăng nhập ở 1.11; gating ở 1.10). Chỉ cấp component + CSS + test.
- File web = **PascalCase.tsx** (đúng convention web đã ship), CSS kebab `shell.css`. Không mâu thuẫn project-context (kebab cho file JS/TS chung, nhưng web component design-system đã chốt PascalCase từ 1.3 — theo tiền lệ local).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.9] — user story + AC (UX-DR-16 + breakpoint 900px).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html] — **CSS 232–315** (spec chuẩn tắc shell: topbar/web/sidebar/toolbar/seg/tabs/media) + **markup 594–630** (web-chrome + sidebar navlinks + main/topbar/toolbar). **Nguồn thị giác duy nhất; mockup thắng khi xung đột.**
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md] — UX-DR-16 (web shell), UX-DR-14 (topbar), token/Viền nét.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md] — AD-1/2/4 (client không chứa business logic/không enforce quyền), AD-13 (design-system-first).
- [Source: _bmad-output/project-context.md] — stack (React 19.2.7), Viền nét, không style ad-hoc, scout-before-code.
- [Source: web/src/design-system/components/Button.tsx + index.ts + components.css] — khuôn component web (function + className + `...rest`), radius remap, CSS load-order contract.
- [Source: web/src/design-system/icons/Icon.tsx] — `<Icon name size/>` + `IconName` (icon shell đã có sẵn).
- [Source: mobile/lib/design_system/shell/app_topbar.dart] — spec topbar chung để parity (đọc, KHÔNG sửa).
- [Source: design-system/components/shell-parity.test.mjs] — parity mockup-anchored có sẵn (đầu file có TODO "extend with React side khi 1.9 lands").
- [Source: _bmad-output/implementation-artifacts/1-8-app-shell-mobile-topbar-bottom-nav-5-tab-fab-phone-frame.md] — story mobile song sinh: convention shell module, source-guard, parity Node, gotchas, quyết định eyebrow verbatim + no-router.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code dev-story workflow)

### Debug Log References

- `node --test "design-system/**/*.test.mjs"` → 114/114 pass, 0 fail (98 prior Story 1.8 parity/token/icon/component tests + 22 new shell tests, 0 regression).
- 1 fix during dev: the parity test's `toUpperCase` guard first matched the word inside the source *comments* (both `Topbar.tsx` and the read-only `app_topbar.dart` document the "no `.toUpperCase()`" rule). Fixed by stripping comments before asserting no real call — check now targets code only.

### Completion Notes List

- Built the web app-shell as a new module `web/src/design-system/shell/` (parallel to `components/`, `icons/`, `tokens/`): 8 React components + `shell.css` + barrel `index.ts`.
- `shell.css` copied **verbatim** from mockup `all-screens.html` 232–315 with the mandatory `--r*`→`--radius*` remap (the #1 drift point) — `.web`→`--radius-lg`, `.navlink`→`--radius-sm`, `.seg`→`--radius`. Literals kept verbatim (`999px` pill, `50%` dot, `#8fa39e`/`#a9bab5`/`#9fb2ad`). Web shell is 100% flat — **0 shadow/gradient/filter** (no FAB → no exception, unlike mobile 1.8's FAB ring).
- Shell-context icon sizes (`.topbar-back .icn`, `.topbar-action .icn`, `.si .icn`, `.logo .icn`) added to `shell.css` — scouted `icons.css`/`components.css` first, they were absent (those only cover `.btn/.banner/.table/.step`), so no duplication.
- All controls are **pure presentation** (AD-1/2): `Sidebar`/`Seg`/`Tabs` emit `onNavigate`/`onSelect` and `preventDefault` on their anchors; `Topbar` back/action emit `onBack`/`onAction`. No router, no network, no business logic.
- `Sidebar` takes nav via the `sections` prop (NOT hard-locked like mobile bottom-nav) so Story 1.10 can gate per-permission; `SIDEBAR_NAV` exported as the canonical default. `Topbar` back is a `<button>` with `aria-label="Quay lại"` (icon-only a11y floor). Eyebrow rendered verbatim — no `.toUpperCase()`, keeping byte-for-byte parity with mobile.
- `WebShell({url, sidebar?, topbar?, children})` assembles `WebFrame > .web-app = [sidebar?] + .main[topbar? + children]`; auth screens pass `sidebar={null}` (parity with mobile `bottomNav:null`, UX-DR-15). `WebFrame` renders exactly 3 chrome dots (rendered literally, not mapped).
- Reused shipped deps — token vars (1.1), `Icon`+`IconName` (1.2, all 11 shell icons already in the sprite), `.field` (1.3), `.kpis` 4-col base (1.5). No new tokens, no `components.css` edits, no Flutter 1.8 edits (read `app_topbar.dart` for parity only).
- **Testing:** web has no tsc/runtime build (web/ is `src/`-only, like Stories 1.3–1.6) — guarded by Node text-tests: `shell-web.test.mjs` (CSS drift: selectors + verbatim decls + radius remap + 0-shadow + 900px breakpoint), `shell-tsx.test.mjs` (source-guard: 0 router/network, callback-only, 3 dots, back=labelled button), and `shell-parity.test.mjs` extended from Flutter-vs-mockup into a true cross-platform check (shared `topbar` Flutter↔web↔mockup; web-only sidebar/seg/tabs/chrome; frame-role parity).

### File List

New:
- `web/src/design-system/shell/shell.css`
- `web/src/design-system/shell/Topbar.tsx`
- `web/src/design-system/shell/Sidebar.tsx`
- `web/src/design-system/shell/WebFrame.tsx`
- `web/src/design-system/shell/Toolbar.tsx`
- `web/src/design-system/shell/Seg.tsx`
- `web/src/design-system/shell/Tabs.tsx`
- `web/src/design-system/shell/SearchField.tsx`
- `web/src/design-system/shell/WebShell.tsx`
- `web/src/design-system/shell/index.ts`
- `design-system/components/shell-web.test.mjs`
- `design-system/components/shell-tsx.test.mjs`

Modified:
- `design-system/components/shell-parity.test.mjs` (extended to cross-platform: added web `.topbar`/`WebFrame` reads + shared-topbar / frame-role / web-only-surface assertions; header updated to reflect the web shell now exists)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`1-9-…` → in-progress → review)

## Change Log

- 2026-07-08 — Implemented Story 1.9 (web app shell): `Sidebar` + `WebFrame` + `Topbar` + toolbar controls (`Toolbar`/`Seg`/`Tabs`/`SearchField`) + `WebShell` scaffold, canonical `shell.css` (mockup-verbatim + radius remap), and drift/source/parity Node tests. 114/114 tests pass. Status → review.
