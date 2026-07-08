---
baseline_commit: 694293f
---

# Story 1.10: Primitive gating theo quyền + accessibility floor + parity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên nền tảng**,
I want **một tầng gating chính tắc dùng chung — primitive `Gate` + helper `can()`/`filterNav()`/`orderScope()` trên CẢ web (React) lẫn mobile (Flutter) — nhận một BỘ QUYỀN hiệu lực (Epic 1 dùng stub, Epic 2 nối `/me`) để ẩn/hiện bề mặt theo quyền (KHÔNG disable xám), cùng một tầng accessibility floor (touch target ≥ 48dp/44pt, `aria-label`/`Semantics` cho nút icon-only, Esc đóng overlay trên cùng, chip trạng thái mang nhãn chữ, tiền/VAT đọc đủ ở cỡ chữ lớn), và test parity cross-platform khẳng định gating + a11y hành xử y hệt trên hai nền tảng**,
so that **mọi màn nghiệp vụ về sau (Đăng nhập 1.11, Dashboard/Đơn/Khách/Danh mục/Kho/Phân quyền/Audit ở Epic 3–8) chỉ cần lắp component design-system là ĐÃ gating đúng quyền + tiếp cận được ngay + đồng nhất web↔mobile — không dev nào phải tự chế logic ẩn/hiện, tự bịa chuỗi quyền, hay bỏ sót a11y; và khi Epic 2 có `/me` thật thì chỉ thay nguồn quyền, KHÔNG phải viết lại gating**.

## Acceptance Criteria

1. **AC-1 — Primitive gating theo quyền (UX-DR-22, FR-22, AD-4/AD-17):** **Given** một bộ quyền hiệu lực truyền vào (Epic 1 = stub, Epic 2 = `/me`), **When** render nav/nút, **Then**:
   - Có primitive `Gate` (web `<Gate>`, Flutter `Gate`) nhận điều kiện quyền → **render children nếu đủ quyền, render KHÔNG GÌ CẢ (null / `SizedBox.shrink()`) nếu thiếu** — tuyệt đối KHÔNG dựng "màn chặn", KHÔNG disable xám, KHÔNG `opacity`/`pointer-events:none` (bề mặt thiếu quyền đơn giản BIẾN MẤT).
   - Có helper thuần `can(perms, key)` (kiểm tra membership) + `filterNav(sections, perms)` → **lọc bỏ link mà `requires` không nằm trong `perms`, rồi bỏ luôn section rỗng** (không để lại tiêu đề nhóm trơ trọi); mục **Audit ẩn với mọi người trừ Super Admin**; hàm là **key-agnostic** (chỉ so string, KHÔNG hardcode chuỗi quyền trong thân logic).
   - Có helper `orderScope(perms)` → trả `'all'` nếu có quyền "xem tất cả đơn", ngược lại `'mine'` — hai quyền này là **hai entry tường minh** trong bộ quyền (AD-17), chi phối phạm vi Danh sách đơn ở Epic 5.
   - `NavLink` (Sidebar web) được mở rộng field `requires?: PermissionKey` để `filterNav` lọc; `SIDEBAR_NAV` gán `requires` cho từng mục (Audit ⇒ quyền Super Admin, Phân quyền ⇒ quyền quản trị account, v.v.).
   - **Bộ quyền stub** (`DEMO_PERMISSIONS`) sống ở **MỘT nơi duy nhất mỗi nền tảng**, đánh dấu rõ "placeholder Epic 1 — Epic 2 thay bằng registry sinh-từ-code (AD-17), KHÔNG phải nguồn chân lý". Gating là **thuần trình bày / UX** — comment nêu rõ backend luôn enforce mọi request (AD-4), ẩn UI KHÔNG phải bảo mật.

2. **AC-2 — Accessibility floor (UX-DR-26):** **Given** chuẩn accessibility, **When** kiểm/áp lên component, **Then**:
   - **Touch target ≥ 48dp (Flutter) / ≥ 44px (web)** cho MỌI control tương tác (`.btn`, `.navlink`, `.seg a`, `.tabs a`, `.topbar-back`, `.topbar-action`, nút icon-only): thêm tầng floor (web: `min-height`/`min-width` áp qua một tầng CSS a11y; mobile: hằng `AppTokens.tapTargetMin = 48` + `ConstrainedBox`/`minimumSize`) — **giữ nguyên kích thước THỊ GIÁC mockup**, chỉ mở rộng vùng chạm (hit area) khi phần tử nhỏ hơn floor (vd `.topbar-back` 28×28 vẫn vẽ 28px nhưng vùng chạm ≥ 44px).
   - **Nút icon-only có nhãn**: mọi `<button>` chỉ chứa `<Icon>` có `aria-label` (web) / `Semantics(label:…, button:true)` (Flutter) — rà & bổ sung chỗ còn thiếu (vd `ShareButton` web hiện dựa vào text label "Share"; nếu render icon-only phải có `aria-label`).
   - **Keyboard trên web**: Esc đóng overlay trên cùng (Dialog/Sheet đã có — khẳng định bằng test, KHÔNG regress); form thao tác được toàn bàn phím (input/nút là phần tử focus-được thật, KHÔNG `<div onClick>`); Tab theo thứ tự đọc (DOM order khớp thị giác — không `tabindex` dương phá thứ tự).
   - **Chip trạng thái mang nhãn chữ** (không chỉ màu) — `StatusChip` đã render label; khẳng định không có biến thể "chỉ dot". **Tiền/VAT đọc đủ ở cỡ chữ lớn**: `.mono`/số tiền KHÔNG bị cắt (`overflow:hidden`+`text-overflow:ellipsis` cấm trên ô tiền; cho `white-space:nowrap` + không giới hạn width phá số).
   - Contrast ink-trên-surface đạt AA: token đã chuẩn (Story 1.1) — story này KHÔNG đổi token, chỉ khẳng định qua reference (không cần đo lại runtime).

3. **AC-3 — Full parity cross-platform (UX-DR-27):** **Given** cùng hành vi gating + a11y floor, **When** dựng trên web và mobile, **Then** đạt full parity — `Gate`/`can`/`filterNav`/`orderScope` có **API tương đương** (cùng tên khái niệm, cùng ngữ nghĩa "thiếu quyền = biến mất") và **cùng bộ quyền-khái niệm** trên hai nền tảng; a11y floor (giá trị 48/44, danh sách control được áp) khớp hai bên; test parity khẳng định gating + a11y song sinh (như `parity.test.mjs`/`shell-parity.test.mjs` đã lập cho token/component/shell). Bottom-nav mobile **VẪN khoá cứng 5 tab** (UX-DR-15) — gating áp cho **nội dung Menu + nút hành động + sidebar web**, KHÔNG cho 5 tab cố định.

## Tasks / Subtasks

> **Naming & module boundary (chốt — theo tiền lệ 1.3–1.9):** web dùng **PascalCase file + component, KHÔNG prefix `App`**; Flutter dùng **snake_case file + prefix `App`** để tránh đụng Material. Gating là **biên module mới**: web `web/src/design-system/gating/` (song song `components/`, `shell/`, `icons/`, `tokens/`), Flutter `mobile/lib/design_system/gating/`. A11y floor **KHÔNG** là module riêng — là tầng mỏng: web `web/src/design-system/a11y/a11y.css` + mobile hằng trong `app_tokens.dart` + bổ sung tại control.

- [x] **Task 1 — Web gating primitive: `gating/permissions.ts` (AC: 1, 3)**
  - [x] Tạo `web/src/design-system/gating/permissions.ts`. Khai báo `export type PermissionKey = string` (key-agnostic — KHÔNG union cứng, vì registry chính tắc do backend sở hữu ở Epic 2, AD-17) và `export type PermissionSet = ReadonlySet<PermissionKey>`.
  - [x] `export function can(perms: PermissionSet, key: PermissionKey): boolean` → `perms.has(key)`. Thuần, không side effect.
  - [x] `export function orderScope(perms: PermissionSet): 'all' | 'mine'` → `can(perms, PERM.ordersViewAll) ? 'all' : 'mine'`. "Xem tất cả đơn" và "đơn của mình" là hai khái niệm tường minh (AD-17).
  - [x] `export function filterNav(sections, perms)` → với mỗi section, giữ link nếu `link.requires == null || can(perms, link.requires)`; **bỏ section có `links` rỗng sau lọc** (không để tiêu đề nhóm trơ). Trả mảng section mới (thuần, không mutate input).
  - [x] **Bộ quyền stub** `export const PERM = { ... } as const` — MỘT nơi duy nhất chứa các key demo (`ordersViewAll`, `auditRead`, `permissionsManage`, … đủ cho `SIDEBAR_NAV`) + `export const DEMO_PERMISSIONS: PermissionSet`. Comment BẮT BUỘC: "STUB Epic 1 — Epic 2 thay bằng permission registry sinh-từ-code (AD-17). Đây KHÔNG phải nguồn chân lý; backend luôn enforce (AD-4); ẩn UI chỉ là UX."

- [x] **Task 2 — Web `Gate.tsx` primitive (AC: 1, 3)**
  - [x] Tạo `web/src/design-system/gating/Gate.tsx` — `export function Gate({ perms, requires, children }: GateProps)`. Props: `{ perms: PermissionSet; requires: PermissionKey; children: ReactNode }`.
  - [x] Render `can(perms, requires) ? <>{children}</> : null` — thiếu quyền ⇒ **render null**. TUYỆT ĐỐI KHÔNG dựng placeholder/disabled/opacity. Docstring nêu rõ: đây là UX gating (AD-4), backend vẫn enforce.

- [x] **Task 3 — Mở rộng `Sidebar` + `SIDEBAR_NAV` cho gating (AC: 1, 3)**
  - [x] Sửa `web/src/design-system/shell/Sidebar.tsx`: thêm field `requires?: PermissionKey` vào interface `NavLink` (import type từ `../gating/permissions`). KHÔNG đổi render logic Sidebar (Sidebar vẫn render nguyên `sections` nhận vào — caller gọi `filterNav(SIDEBAR_NAV, perms)` TRƯỚC khi truyền). Đây là điểm đã chừa sẵn ở Story 1.9 (comment "Story 1.10 gates it per-permission").
  - [x] Gán `requires` cho các mục `SIDEBAR_NAV` cần quyền: `audit` ⇒ `PERM.auditRead` (Super Admin), `permissions` ⇒ `PERM.permissionsManage`; các mục thường (home/orders/customers/catalog/inventory/profile) để trống (`requires` undefined = luôn hiện) hoặc gán quyền tương ứng nếu đã có key stub. Giữ thứ tự & nhãn verbatim mockup.

- [x] **Task 4 — Mobile gating primitive: `gating/app_permissions.dart` + `gating/app_gate.dart` (AC: 1, 3)**
  - [x] Tạo `mobile/lib/design_system/gating/app_permissions.dart`: `typedef PermissionKey = String;` + `class PermissionSet` (bọc `Set<String>`) hoặc dùng `Set<String>` trực tiếp; `bool can(Set<String> perms, String key)`; `String orderScope(Set<String> perms)` (`'all'`/`'mine'`); `List<AppNavSection> filterNav(...)` **nếu** mobile có cấu trúc nav lọc được (xem Task 5 — bottom-nav khoá cứng, nên filterNav áp cho **danh sách Menu**, không cho 5 tab). Hằng `AppPerm` + `demoPermissions` với **cùng comment stub AD-17/AD-4** như web.
  - [x] Tạo `mobile/lib/design_system/gating/app_gate.dart`: `class AppGate extends StatelessWidget` — props `{ required Set<String> perms, required String requires, required Widget child }`; `build` → `can(perms, requires) ? child : const SizedBox.shrink()`. Thiếu quyền ⇒ **không chiếm chỗ**.
  - [x] Thêm barrel `mobile/lib/design_system/gating/gating.dart` export cả hai (mẫu `shell/shell.dart`, `components/components.dart`).

- [x] **Task 5 — Accessibility floor: touch target (AC: 2, 3)**
  - [x] **Web:** Tạo `web/src/design-system/a11y/a11y.css` — tầng floor áp `min-height:44px` (và `min-width:44px` cho control vuông/icon-only) lên `.btn`, `.navlink`, `.seg a`, `.tabs a`, `.topbar-back`, `.topbar-action`, `.modal-head button` (nút đóng), nút `.si`/icon-only khác. Với phần tử phải giữ kích thước thị giác nhỏ (vd `.topbar-back` 28×28): mở rộng vùng chạm bằng `min-height/min-width:44px` + `display:inline-flex;align-items:center;justify-content:center` (giữ icon 28px ở giữa) HOẶC pseudo-element `::after` phủ 44px — chọn cách KHÔNG phá layout mockup (ghi rõ cách chọn trong comment). Header comment: "A11y floor (Story 1.10, UX-DR-26): touch target ≥44px. Load AFTER components.css + shell.css. KHÔNG đổi màu/viền/kích-thước-thị-giác — chỉ nới vùng chạm."
  - [x] **Mobile:** Thêm `static const double tapTargetMin = 48.0;` vào `AppTokens` (`app_tokens.dart`). Áp floor cho `AppButton` (bọc `ConstrainedBox(constraints: BoxConstraints(minHeight: tapTargetMin))` quanh `Container`, giữ padding thị giác) + `AppBottomNav` item/FAB (đảm bảo vùng chạm ≥48 — hiện `Expanded` + padding, kiểm & nới nếu thiếu) + `app_topbar.dart` back button. Giữ kích thước thị giác; chỉ đảm bảo hit area.
  - [x] Cập nhật barrel/CSS-load-order note (web `a11y.css` sau `components.css`+`shell.css`; ghi trong `gating` barrel hoặc `a11y.css` header). KHÔNG tạo bundler entry (YAGNI — chưa có).

- [x] **Task 6 — Accessibility floor: labels + keyboard + số tiền (AC: 2)**
  - [x] **Web icon-only labels:** rà mọi `<button>` chỉ chứa `<Icon>` trong `web/src/design-system/{components,shell}`. Đã có: `Topbar` back, `Sheet`/`Dialog` close, `CartLineRow` (số lượng/đơn giá/xoá), `ImageUpload` xoá. Rà `ShareButton` (nếu icon-only phải thêm `aria-label`), và bất kỳ nút icon-only nào khác — **bổ sung `aria-label` tiếng Việt** chỗ thiếu. KHÔNG đổi hành vi, chỉ thêm nhãn.
  - [x] **Mobile Semantics:** rà nút icon-only Flutter (`app_topbar.dart` back đã có `Semantics`; `app_bottom_nav`, `share_button.dart`, `image_upload.dart`) — bổ sung `Semantics(label:…, button:true)` chỗ thiếu.
  - [x] **Số tiền/cỡ chữ lớn:** rà `.mono`/ô tiền trong `components.css` (Table `.num`, KPI value, CartLineRow tổng) — đảm bảo KHÔNG `overflow:hidden`+`ellipsis` cắt số; nếu có, sửa để số hiển thị đủ (`white-space:nowrap`, không giới hạn width phá số). Ghi rõ nếu không có gì phải sửa (chỉ khẳng định).
  - [x] **Keyboard:** KHÔNG thêm code mới — khẳng định Dialog/Sheet đã bắt `Escape` (Story 1.6), input là phần tử focus-được. Task test (Task 7) chốt guard.

- [x] **Task 7 — Test: gating + a11y + parity cross-platform (AC: tất cả)**
  - [x] Tạo `design-system/components/gating.test.mjs` (mẫu `components.test.mjs` — text-guard, vì web chưa có tsc/runtime): đọc `permissions.ts`/`Gate.tsx` (web) + `app_permissions.dart`/`app_gate.dart` (mobile) dạng text, khẳng định:
    - (a) **Gate render-null pattern**: web `Gate` chứa `? ` + `: null` (thiếu quyền = null), Flutter `AppGate` chứa `SizedBox.shrink()`; **KHÔNG** chứa `disabled`/`opacity`/`pointer-events` trong Gate (không disable xám).
    - (b) **filterNav bỏ section rỗng**: web `filterNav` chứa logic lọc `links` + bỏ section rỗng (regex tìm `.filter(` + kiểm `links.length`); `orderScope` trả `'all'`/`'mine'`.
    - (c) **stub được đánh dấu**: cả hai file quyền chứa chuỗi ghi chú stub/registry/AD-17 (guard chống ai đó coi stub là canonical) + ghi chú backend-enforce (AD-4).
    - (d) **key-agnostic**: `can` chỉ `.has(`/membership, KHÔNG hardcode chuỗi quyền literal trong thân `can`/`filterNav`.
  - [x] Tạo `design-system/components/a11y-floor.test.mjs`: đọc `a11y.css` (web) + `app_tokens.dart`/`button.dart` (mobile), khẳng định: web floor có `min-height:44px` áp lên `.btn`/`.navlink`/`.topbar-back`/`.seg a`/`.tabs a`; mobile có `tapTargetMin = 48` + `AppButton` dùng nó (`minHeight`/`ConstrainedBox`); rà file components/shell web: **mọi `<button>` icon-only có `aria-label`** (regex tìm `<button` … `<Icon` không kèm text ⇒ phải có `aria-label` — hoặc liệt kê danh sách nút icon-only đã biết và assert từng file chứa `aria-label`).
  - [x] **Mở rộng `design-system/components/parity.test.mjs`** (hoặc thêm khối vào `shell-parity.test.mjs`): khẳng định gating song sinh — web có `gating/` với `Gate`+`can`+`filterNav`+`orderScope` VÀ mobile có `gating/` tương đương; a11y floor giá trị khớp (web 44 / mobile 48 là quyết định có chủ đích — dp≠px, ghi comment); cập nhật "Surface ownership" comment thêm dòng gating (shared khái niệm, per-platform impl).
  - [x] Chạy `node --test "design-system/**/*.test.mjs"`: pass toàn bộ (114 test Story 1.9 + test mới) — **0 regression**.

- [x] **Task 8 — Verify + cập nhật tài liệu (AC: tất cả)**
  - [x] Chạy `npm --prefix design-system test` (hoặc `node --test "design-system/**/*.test.mjs"`): toàn bộ pass.
  - [x] Web KHÔNG có tsc/runtime build (web/ chỉ `src/`, như Story 1.3–1.9) → guard bằng Node text-test đúng pattern đã lập; ghi rõ trong Completion Notes. Nếu repo phát sinh tsc/analyze cho mobile (rà `mobile/analysis_options.yaml`) → chạy `dart analyze` cho file mới; nếu không có toolchain → ghi rõ đã guard bằng text-test.
  - [x] Cập nhật `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-10-...` → `review` khi dev xong (do dev-story/code-review làm, KHÔNG ở create-story).

## Dev Notes

### Bối cảnh & nguồn chân lý
- App nội bộ Phương Nam Solar, 3 client tách biệt; story này đụng **cả web React lẫn mobile Flutter** (tầng design-system chung, không đụng backend — chưa có). Nguồn UI/hành vi: `EXPERIENCE.md` (§"Phân quyền hiển thị theo quyền", §"Accessibility Floor" — **spine thắng khi xung đột hành vi**), `DESIGN.md` (token/Viền nét). Kiến trúc: `ARCHITECTURE-SPINE.md` (AD-4, AD-17).
- **Build-order design-system-first (AD-13):** gating + a11y là tầng design-system, dựng TRƯỚC màn tính năng. Story 1.8 = shell mobile (done); 1.9 = shell web (done); **1.10 = primitive gating + a11y floor + parity (this)**; 1.11 = màn Đăng nhập dùng shell + demo. Story 1.9 đã **chừa sẵn** hook gating: `Sidebar` nhận nav qua prop (không khoá cứng) đúng để 1.10 lọc; comment `Sidebar.tsx`/`index.ts` ghi rõ "Story 1.10 gates it per-permission".
- **Epic 1 = stub, Epic 2 = thật:** epic AC nói "Epic 1 dùng stub, Epic 2 nối `/me`". Vì registry quyền chính tắc do **backend `accounts/domain` sở hữu & sinh-từ-code** (AD-17) và backend chưa tồn tại, story này KHÔNG được tạo enum quyền "chính tắc" cạnh tranh. Giải pháp: **primitive key-agnostic** (chỉ so string) + **một bộ stub đánh dấu rõ** để Epic 2 thay bằng artifact registry. Khi Epic 2 land: thay `DEMO_PERMISSIONS`/`PERM` + giá trị `requires` trong `SIDEBAR_NAV`, KHÔNG sửa logic `Gate`/`can`/`filterNav`.

### Phụ thuộc đã có — TÁI DÙNG, KHÔNG dựng lại (scout-before-code)
- **Sidebar + SIDEBAR_NAV (Story 1.9):** `web/src/design-system/shell/Sidebar.tsx` — `NavLink { key, icon, label }`, `SIDEBAR_NAV` (5 mục + section "Quản trị": Phân quyền/Audit/Hồ sơ). Story này **chỉ thêm `requires?`** vào `NavLink` + gán cho SIDEBAR_NAV; KHÔNG đổi render. `filterNav(SIDEBAR_NAV, perms)` chạy ở caller/màn (Epic 3+), Sidebar vẫn "render nguyên sections nhận vào".
- **Bottom-nav mobile khoá cứng (Story 1.8):** `app_bottom_nav.dart` — 5 tab qua hằng nội bộ `_tabs`, KHÔNG prop. UX-DR-15 khoá cứng ⇒ **gating KHÔNG áp cho 5 tab**; gating áp cho **nội dung "Menu" (tab index 4) + nút hành động trong màn**. Đừng phá khoá cứng bottom-nav.
- **Overlay Esc (Story 1.6):** `Dialog.tsx`/`Sheet.tsx` đã bắt `Escape` (listener trên `document`, đóng overlay trên cùng, overlay ≤1 cấp). A11y AC chỉ **khẳng định bằng test**, KHÔNG viết lại.
- **StatusChip (Story 1.4):** đã render `<span className="dot"/>` + label chữ (không chỉ màu) — thỏa "chip mang nhãn chữ". Khẳng định, không sửa.
- **ScopeFlag (Story 1.4):** `.scope-flag on/off` (on = teal, off = gạch mờ) — hiển thị bật/tắt quyền dạng chip, **KHÔNG phải toggle**. Là component TRÌNH BÀY ma trận quyền (dùng ở màn Phân quyền Epic 8); KHÔNG nhầm với gating primitive (gating = ẩn/hiện bề mặt). Có thể tham chiếu nhưng story này KHÔNG dựng ma trận.
- **Token (Story 1.1):** màu ink/surface đã đạt AA (UX-DR-1) — a11y contrast thỏa qua token, story KHÔNG đổi token. Thêm `tapTargetMin` là hằng LAYOUT (không phải màu), đặt trong `AppTokens`.
- **A11y đã có sẵn (rà trước khi thêm):** `aria-label` web: `Topbar` back ("Quay lại"), `Dialog`/`Sheet` close, `CartLineRow` (Số lượng/Đơn giá/Xoá dòng), `ImageUpload` (Xoá ảnh). `Semantics` mobile: `app_topbar` back, `button.dart`, `field.dart`. Story chỉ **lấp lỗ hổng** (nút icon-only còn thiếu label + touch floor), KHÔNG thêm trùng.

### Vị trí file (module boundary)
- **Web (mới):** `web/src/design-system/gating/permissions.ts`, `gating/Gate.tsx`, `gating/index.ts` (barrel); `web/src/design-system/a11y/a11y.css`.
- **Web (sửa nhỏ, có chủ đích):** `shell/Sidebar.tsx` (+`requires?` field & gán SIDEBAR_NAV) — điểm 1.9 đã chừa; `components/ShareButton.tsx` + các nút icon-only còn thiếu `aria-label`; `components/components.css` (chỉ nếu ô tiền đang bị cắt — nới, KHÔNG đổi màu/viền).
- **Mobile (mới):** `mobile/lib/design_system/gating/app_permissions.dart`, `gating/app_gate.dart`, `gating/gating.dart` (barrel).
- **Mobile (sửa nhỏ):** `tokens/app_tokens.dart` (+`tapTargetMin`); `components/button.dart` + `shell/app_bottom_nav.dart` + `shell/app_topbar.dart` (áp floor/Semantics chỗ thiếu).
- **Test:** mới `design-system/components/gating.test.mjs`, `a11y-floor.test.mjs`; **mở rộng** `parity.test.mjs` (hoặc `shell-parity.test.mjs`) cho gating parity.
- **KHÔNG** tạo app entry/router/màn (màn Đăng nhập + wiring ở 1.11). **KHÔNG** đụng logic tính tiền/trạng thái (chưa có, backend). **KHÔNG** dựng ma trận quyền (Epic 8).

### Spec chuẩn tắc (từ EXPERIENCE.md §Phân quyền + §Accessibility Floor, UX-DR-22/26/27)
```
GATING (UX-DR-22):
  - Ẩn/hiện theo QUYỀN hiệu lực của Account (FR-22) — KHÔNG disable xám gây rối.
  - Bề mặt bị cấm KHÔNG dựng "màn chặn" — đơn giản KHÔNG xuất hiện trong nav.
  - Audit log: CHỈ Super Admin — sidebar/menu ẩn mục này với mọi người khác (FR-20).
  - "Xem tất cả đơn" vs "chỉ đơn của mình" = một Quyền trong ma trận, chi phối phạm vi Danh sách đơn (FR-18).
  - Cả hai nền tảng gating từ CÙNG nguồn quyền (Epic 2: /me). Client gating chỉ UX — backend enforce mọi request (AD-4).
  - Registry quyền chính tắc = backend accounts/domain, sinh-từ-code, ba bên tiêu thụ y hệt (FE gating / BE guard / noti resolver); cấm permission literal ngoài registry (AD-17).

ACCESSIBILITY FLOOR (UX-DR-26):
  - Touch target ≥ 48dp (Flutter) / ≥ 44pt (web) — dùng được ngoài hiện trường/đeo găng.
  - Contrast ngoài trời: ink-trên-surface đạt AA (token đã chuẩn); chip trạng thái KHÔNG chỉ màu (kèm nhãn chữ).
  - Keyboard web: Tab theo thứ tự đọc; Esc đóng dialog/sheet trên cùng; form thao tác toàn bàn phím.
  - Form labels: mọi trường có nhãn + role/state; nút icon-only (share/back/FAB) có aria-label.
  - Tiền/VAT đọc đủ, KHÔNG bị cắt ở cỡ chữ lớn.

PARITY (UX-DR-27): cùng màn nghiệp vụ web↔mobile — chỉ khác khung + điều hướng; một design system.
```

### Bất biến phải giữ (AD / UX-DR)
- **AD-4 (gating chỉ là UX):** ẩn/disable UI theo quyền **KHÔNG phải bảo mật** — backend enforce mọi request. Comment mọi primitive gating để không ai nhầm đây là kiểm soát truy cập thật.
- **AD-17 (registry chính tắc):** quyền do backend sở hữu, sinh-từ-code, Epic 2. Story 1.10 dùng **stub đánh dấu rõ** + primitive key-agnostic; "xem tất cả đơn"/"đơn của mình" là hai entry tường minh. KHÔNG bịa enum canonical cạnh tranh.
- **AD-1/2 (client không business logic):** gating là trình bày; KHÔNG mạng, KHÔNG router, KHÔNG tính tiền/đổi trạng thái. `Gate` chỉ render/ẩn.
- **AD-13 (design-system-first):** dùng lại token/component/shell đã ship; CẤM style ad-hoc. A11y floor là tầng mỏng dùng token, không hardcode màu.
- **UX-DR-15 (bottom-nav khoá cứng):** 5 tab mobile cố định — gating KHÔNG áp cho chúng.
- **UX-DR-27 (parity):** web ↔ mobile cùng khái niệm gating + a11y floor; chỉ khác impl per-platform (React vs Flutter, px vs dp).

### Gotchas (từ Story 1.3–1.9 + đặc thù gating/a11y)
1. **"Thiếu quyền = BIẾN MẤT", KHÔNG disable xám:** đây là điểm sai kinh điển. `Gate` thiếu quyền phải `return null` / `SizedBox.shrink()` — KHÔNG `disabled`, KHÔNG `opacity:.4`, KHÔNG `pointer-events:none`. `filterNav` bỏ hẳn link + section rỗng. Test (a) chặn regression.
2. **Stub KHÔNG phải canonical (AD-17):** bộ quyền Epic 1 là placeholder. Đánh dấu rõ trong code + test (c) guard. Đừng để dev sau tưởng `PERM`/`DEMO_PERMISSIONS` là registry thật → nhân bản literal khắp nơi. Epic 2 thay một chỗ.
3. **Gating chỉ UX, KHÔNG bảo mật (AD-4):** phải comment. Ai đó có thể tưởng ẩn nút Audit = an toàn — KHÔNG; backend `/audit` vẫn phải guard. Story chỉ làm UX layer.
4. **Touch floor giữ kích thước THỊ GIÁC mockup:** mockup `.topbar-back` 28×28, FAB 46px, chip nhỏ — a11y floor nới **vùng chạm** ≥44/48 chứ KHÔNG phóng to hình. Dùng `min-height/min-width` + căn giữa (icon giữ 28px) hoặc hit-area pseudo. Đừng phá parity byte-for-byte của shell (test shell-web/shell-parity Story 1.9 vẫn phải pass — a11y floor ở FILE RIÊNG `a11y.css`, load sau, KHÔNG sửa `shell.css`/`components.css` màu-viền-size).
5. **dp ≠ px (parity giá trị 48 vs 44):** Flutter dùng dp (48), web dùng px/pt (44). Đây KHÔNG phải drift — là chuẩn nền tảng (Material 48dp, Apple/WCAG 44pt). Ghi comment ở parity test để không bị "sửa cho khớp".
6. **Bottom-nav khoá cứng ≠ gating được:** đừng thêm prop nav vào `app_bottom_nav.dart` để "gating 5 tab". 5 tab cố định (UX-DR-15). Gating áp cho Menu + action, không cho bottom-nav.
7. **Sidebar đã chừa sẵn — chỉ thêm `requires?`:** Story 1.9 cố ý để Sidebar nhận `sections` qua prop. 1.10 thêm field + caller lọc; KHÔNG nhét `perms` prop vào Sidebar (Sidebar vẫn "render nguyên gì nhận vào" — tách concern: lọc là `filterNav`, hiển thị là `Sidebar`).
8. **A11y CSS load order:** `a11y.css` phải load SAU `components.css`+`shell.css` (nó override min-size của `.btn`/`.navlink`). Ghi contract trong header + `gating/index.ts` (như `shell/index.ts`). KHÔNG tạo bundler entry.
9. **Số tiền KHÔNG bị cắt:** rà `.num`/`.mono`/KPI/tổng — nếu có `overflow:hidden`+`ellipsis` trên ô tiền, số dài (vd "1.234.567.890 đ") bị "…". Sửa để hiện đủ. Nếu không có ellipsis trên ô tiền → chỉ khẳng định, không đổi.
10. **Web chưa có tsc/runtime:** gating logic là TS thuần nhưng KHÔNG chạy được (web/ chỉ `src/`, không `package.json`/`tsconfig`) — guard bằng **Node text-test** đọc source dạng chuỗi (đúng contract Story 1.3–1.9). KHÔNG thêm test runner/transpile mới (YAGNI). Logic đúng-hay-sai được guard qua text-pattern + parity; correctness runtime nối khi có build (Epic 2+). Ghi rõ giới hạn này trong Completion Notes như Story 1.9.

### Testing standards
- Web **không có React runtime/tsc build** — như Story 1.3–1.9, guard bằng **Node text-test** (`design-system/**/*.test.mjs`, chạy `node --test`). Mobile: nếu có `dart analyze` chạy được thì chạy cho file mới; nếu không → text-test.
- Bắt buộc test: **gating drift/source-guard** (Gate render-null, filterNav bỏ section rỗng, orderScope, stub-marked, key-agnostic), **a11y floor** (min 44/48 áp đúng control, icon-only có label), **parity cross-platform** (gating + a11y song sinh web↔mobile). Mẫu: `components.test.mjs` (drift-guard), `parity.test.mjs`/`shell-parity.test.mjs` (cross-platform).
- Chạy `node --test "design-system/**/*.test.mjs"` — **0 regression** với 114 test Story 1.9.

### Project Structure Notes
- Thêm `gating/` (web + mobile) là **biên module tự nhiên** song song `components/`/`shell/`/`icons/`/`tokens/` — không phá cấu trúc, không xung đột. `a11y/a11y.css` là tầng mỏng (một file CSS + hằng token), KHÔNG cần module riêng.
- File web = **PascalCase.tsx / camelCase.ts** (`Gate.tsx`, `permissions.ts`), CSS kebab (`a11y.css`); Flutter = **snake_case + prefix App** (`app_gate.dart`, `app_permissions.dart`). Theo tiền lệ 1.3–1.9, không mâu thuẫn project-context.
- Sửa `Sidebar.tsx`/`button.dart`/`app_tokens.dart`/`components.css` là **surgical, đúng scope** (thêm field/floor/label) — KHÔNG refactor phần không liên quan; test cũ phải pass.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.10] — user story + 3 AC (UX-DR-22/26/27).
- [Source: _bmad-output/planning-artifacts/epics.md#UX Design Requirements] — UX-DR-22 (gating), UX-DR-26 (accessibility floor), UX-DR-27 (parity), UX-DR-15 (bottom-nav khoá cứng).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md] — §"Accessibility Floor" (131–139), §"Phân quyền hiển thị theo quyền" (141–149): ẩn không disable, Audit chỉ Super Admin, scope đơn, bề mặt cấm không dựng màn chặn.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md] — AD-4 (UI gating theo quyền, backend luôn enforce), AD-17 (registry quyền chính tắc backend-owned, sinh-từ-code, ba bên tiêu thụ; "xem tất cả"/"đơn mình" là hai entry), AD-1/2 (client không business logic), AD-13 (design-system-first).
- [Source: web/src/design-system/shell/Sidebar.tsx + index.ts] — `NavLink`/`SIDEBAR_NAV` + comment "Story 1.10 gates it per-permission" (điểm chừa sẵn).
- [Source: mobile/lib/design_system/shell/app_bottom_nav.dart] — bottom-nav khoá cứng 5 tab (UX-DR-15) — gating KHÔNG áp.
- [Source: web/src/design-system/components/Dialog.tsx + Sheet.tsx] — Esc đóng overlay trên cùng (a11y keyboard đã có, chỉ khẳng định).
- [Source: web/src/design-system/components/StatusChip.tsx] — chip đã mang nhãn chữ (a11y).
- [Source: web/src/design-system/components/Button.tsx + components.css `.btn`] — `.btn` hiện `padding:9px 15px` (~36px < 44px floor) → cần floor a11y.
- [Source: mobile/lib/design_system/components/button.dart] — `AppButton` padding vertical 9 (< 48dp) → cần `tapTargetMin`.
- [Source: web/src/design-system/components/ScopeFlag.tsx] — chip on/off quyền (trình bày ma trận, KHÔNG phải gating primitive — phân biệt rõ).
- [Source: design-system/components/parity.test.mjs + shell-parity.test.mjs] — mẫu parity cross-platform (mở rộng cho gating).
- [Source: _bmad-output/implementation-artifacts/1-9-app-shell-web-sidebar-web-frame.md] — story shell web song sinh: convention module, source-guard, parity Node, no-router, quyết định testing text-guard khi chưa có runtime.
- [Source: _bmad-output/project-context.md] — AD-4/AD-13/AD-17, Viền nét, scout-before-code, không style ad-hoc, stack (React 19.2.7 / Flutter 3.44).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (dev-story workflow).

### Debug Log References

- Full suite: `npm --prefix design-system test` → **135 pass / 0 fail** (125 baseline Story 1.9 + 10 mới; 0 regression).
- Mobile: `dart analyze lib/design_system` → **No issues found!** (fvm dart, package đã resolve).
- Token regen: `node design-system/tokens/build-tokens.mjs` → web token files không đổi; `app_tokens.dart` sinh lại có `tapTargetMin = 48.0`.

### Completion Notes List

**Gating (AC-1/3):**
- Web `gating/permissions.ts`: `PermissionKey = string` (key-agnostic, AD-17), `PermissionSet = ReadonlySet`, `can` = `perms.has(key)` (không literal trong thân), `orderScope` → `'all'`/`'mine'`, `filterNav` generic (không import Sidebar → không vòng lặp import) lọc link theo `requires` + bỏ section rỗng. `PERM`/`DEMO_PERMISSIONS` đánh dấu STUB Epic 1 (AD-17) + gating chỉ UX, backend enforce (AD-4).
- Web `gating/Gate.tsx`: thiếu quyền ⇒ `return null` (không disable/opacity/pointer-events). `gating/index.ts` barrel + note load-order a11y.css.
- `Sidebar.tsx`: thêm `requires?: PermissionKey` vào `NavLink`; `SIDEBAR_NAV` gán `audit ⇒ PERM.auditRead` (Super Admin), `permissions ⇒ PERM.permissionsManage`. KHÔNG đổi render (caller vẫn `filterNav` trước).
- Mobile `gating/app_permissions.dart` (typedef `PermissionKey`, `can`/`orderScope`/`filterNav` + `AppNavSection`/`AppNavLink` để filterNav có cấu trúc nav lọc — bottom-nav 5 tab vẫn khoá cứng, không đụng), `gating/app_gate.dart` (`AppGate` → `SizedBox.shrink()` khi thiếu quyền), `gating/gating.dart` barrel. Cùng comment stub/AD-17/AD-4 như web.

**A11y floor (AC-2/3):**
- Web `a11y/a11y.css` (tầng riêng, load SAU components.css+shell.css — KHÔNG đổi màu/viền/size): `.btn`/`.navlink`/`.seg a`/`.tabs a`/`.modal-head button` floor `min-height:44px`; `.topbar-back`/`.topbar-action` giữ box vẽ nhỏ, mở hit-area ≥44 bằng `::after` phủ giữa. Không phá byte-parity shell/component (file tách rời).
- **Quyết định có chủ đích (lệch story text, đã xử đúng kỹ thuật):** story bảo thêm `tapTargetMin` vào `app_tokens.dart`, nhưng file đó **GENERATED từ `design-tokens.json`** và có drift-guard byte-for-byte (`tokens/parity.test.mjs` test (1)). Sửa tay ⇒ vỡ test + mất khi rebuild. Đã thêm `a11y.tapTargetMinDp = 48` vào **SSOT `design-tokens.json`** + generator `build-tokens.mjs` (buildDart) → `AppTokens.tapTargetMin = 48.0` sinh hợp lệ, drift-guard vẫn xanh. Web floor 44 vẫn ở `a11y.css` (không phải token). dp≠px là chủ ý (Material 48 vs WCAG/Apple 44) — ghi comment 2 nơi để không ai "sửa cho khớp".
- Mobile: `AppButton` bọc `ConstrainedBox(minHeight: tapTargetMin)` (giữ padding thị giác); `app_topbar` back giữ box 28×28 (mockup) nhưng hit-area ≥48 qua `SizedBox(tapTargetMin)+Center`. Bottom-nav item (~51px) + FAB đã ≥48 — chỉ khẳng định, không đổi (UX-DR-15 giữ khoá cứng).

**Labels + keyboard + tiền (AC-2):**
- Web: rà mọi `<button>` icon-only — Topbar (Quay lại), Dialog (closeLabel), Sheet (Đóng), CartLineRow (Xoá dòng), ImageUpload (Xoá ảnh) **đã đủ** `aria-label`; ShareButton có text label "Share" nên **không** icon-only. Lỗ hổng duy nhất: input file add-tile `ImageUpload` → thêm `aria-label="Thêm ảnh"` (parity với mobile).
- Mobile: `image_upload.dart` nút xoá (ic-close) + add-tile (ic-plus) icon-only còn thiếu → thêm `Semantics(button:true, label:…)`. Các nút khác (topbar back, button, share) đã có Semantics/text.
- **Tiền/số:** rà `.mono`/`.num`/KPI value/CartLineRow tổng — **KHÔNG** ô tiền nào dính `overflow:hidden`+`ellipsis` (`.mono` = tabular-nums + right-align; chỉ `.topbar-title`/`.modal`/`.sheet` có clip nhưng không phải ô tiền). Không cần sửa — chỉ khẳng định.
- **Keyboard:** Dialog/Sheet đã bắt `Escape` (Story 1.6), input là phần tử focus-được thật — KHÔNG thêm code; test khẳng định (a11y-floor guard các control là phần tử focus-được).

**Giới hạn testing (như Story 1.3–1.9):** web KHÔNG có tsc/runtime build (web/ chỉ `src/`), nên gating logic + a11y được guard bằng **Node text-test** (`gating.test.mjs`, `a11y-floor.test.mjs`, khối gating trong `parity.test.mjs`). Correctness runtime nối khi có build (Epic 2+). Mobile được `dart analyze` xác nhận biên dịch sạch.

### File List

**Web — mới:**
- `web/src/design-system/gating/permissions.ts`
- `web/src/design-system/gating/Gate.tsx`
- `web/src/design-system/gating/index.ts`
- `web/src/design-system/a11y/a11y.css`

**Web — sửa:**
- `web/src/design-system/shell/Sidebar.tsx` (thêm `requires?` + gán `SIDEBAR_NAV`)
- `web/src/design-system/components/ImageUpload.tsx` (aria-label add-tile input)

**Mobile — mới:**
- `mobile/lib/design_system/gating/app_permissions.dart`
- `mobile/lib/design_system/gating/app_gate.dart`
- `mobile/lib/design_system/gating/gating.dart`

**Mobile — sửa:**
- `mobile/lib/design_system/components/button.dart` (ConstrainedBox floor)
- `mobile/lib/design_system/components/image_upload.dart` (Semantics remove + add)
- `mobile/lib/design_system/shell/app_topbar.dart` (hit-area ≥48 cho back)
- `mobile/lib/design_system/tokens/app_tokens.dart` (GENERATED — `tapTargetMin`)

**Design-system (SSOT + generator + test):**
- `design-system/tokens/design-tokens.json` (thêm `a11y` section)
- `design-system/tokens/build-tokens.mjs` (buildDart emit `tapTargetMin`)
- `design-system/components/gating.test.mjs` (mới)
- `design-system/components/a11y-floor.test.mjs` (mới)
- `design-system/components/parity.test.mjs` (thêm khối gating + a11y parity)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Story 1.10 dev-story: primitive gating (`Gate`/`can`/`filterNav`/`orderScope`) web+mobile, a11y floor (touch ≥44/48, aria-label/Semantics icon-only), parity cross-platform. `tapTargetMin` đi qua SSOT+generator (không sửa tay file generated). 10 test mới, 135 pass / 0 fail, `dart analyze` sạch. Status → review. |
