---
baseline_commit: e10f35f0fb537a9da71278164850e76892b20adc
---

# Story 2.6: Nối UI gating vào `/me` trên hai nền tảng

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người dùng nội bộ**,
I want **UI web và mobile lấy bộ quyền hiệu lực từ `/me` rồi dựng nav/nút/scope theo đúng quyền của tôi (thay bộ quyền stub Epic 1 bằng nguồn thật `/me`), thông qua một tầng session/permission-provider chung nuôi các primitive gating có sẵn (`Gate`/`can`/`filterNav`/`orderScope`) — và bộ key quyền phía FE được suy TỪ artifact registry chính tắc `permissions.json` (một nguồn, cấm literal drift, AD-17)**,
so that **tôi chỉ thấy đúng việc mình được phép (mục Audit ẩn nếu không có `audit.read`; số doanh thu ẩn nếu không có `dashboard.finance_view`; danh sách đơn thu về phạm vi "tất cả" hay "của mình" theo `orders.view_all`/`orders.view_own`), hai nền tảng gating từ CÙNG một nguồn quyền — trong khi bảo mật thật vẫn nằm ở guard server-side mỗi request (AD-4), ẩn UI chỉ là UX**.

## Acceptance Criteria

1. **AC-1 — Nguồn quyền = `/me`, không còn stub (FR-22, UX-DR-22, AD-4/AD-12/AD-17):** **Given** primitive gating Epic 1 (Story 1.10) đang chạy trên bộ quyền stub `DEMO_PERMISSIONS`/`demoPermissions`, **When** một phiên đăng nhập được thiết lập, **Then**:
   - Mỗi nền tảng có **một tầng session/permission-provider** giữ `PermissionSet` hiệu lực, **dựng từ payload `/me`** (`MeResponseDto { id, email, displayName, permissions: string[] }`) — map `permissions: string[]` → `PermissionSet` (`ReadonlySet<PermissionKey>` web / `Set<PermissionKey>` mobile). Web: React context + hook (`usePermissions()`); mobile: một provider/scope (InheritedWidget hoặc Cubit, theo tiền lệ BLoC) đọc được từ widget tree.
   - Việc **lấy `/me`** đi qua **một cổng (port) tiêm được** (`MePort`/repository interface, chữ ký `fetchMe(): Promise<MeResponse>` / `Future<MeResponse>`). Bản story này cung cấp port + mapping + provider + một impl test (fake) trả payload shape `MeResponseDto`; **impl HTTP thật + gắn Bearer token** được lắp khi app-runtime/login-network land (xem Ranh giới phạm vi). Provider phơi trạng thái tối thiểu: `loading | ready(perms) | error` để UI biết chờ/hiển-thị-lỗi.
   - Các consumer gating **chuyển từ stub sang provider**: nơi nào Epic 1 dùng `DEMO_PERMISSIONS`/`demoPermissions` thì Epic 2 đọc `PermissionSet` từ provider. `Gate`/`can`/`filterNav`/`orderScope` **KHÔNG đổi chữ ký/logic** — chỉ đổi **nguồn** bộ quyền (đúng lời hứa Story 1.10: "Epic 2 thay nguồn, không viết lại gating").
   - **Stub bị gỡ khỏi đường chạy thật:** `DEMO_PERMISSIONS`/`demoPermissions` không còn được consumer sản xuất nào import; nếu giữ lại thì **chỉ cho story/demo/test** và đánh dấu rõ (không phải nguồn phiên thật).

2. **AC-2 — Nav + bề mặt nhạy cảm gating theo quyền (UX-DR-22):** **Given** một `PermissionSet` từ `/me`, **When** render shell/nav và bề mặt nhạy cảm, **Then**:
   - **Web nav:** shell dựng Sidebar qua `filterNav(SIDEBAR_NAV, perms)` **từ provider** (không truyền cứng). Account **không có `audit.read`** ⇒ mục **Audit biến mất** (không disable xám); không có `permissions.manage` ⇒ mục **Phân quyền biến mất**; section "Quản trị" rỗng thì **bỏ luôn tiêu đề** (đã là hành vi `filterNav`).
   - **Mobile:** nội dung điều hướng lọc được (danh sách "Menu" / mục quản trị) chạy `filterNav` từ provider; **bottom-nav 5 tab vẫn khoá cứng** (UX-DR-15) — gating **KHÔNG** áp cho 5 tab.
   - **Bề mặt "doanh thu":** một `<Gate requires={PERM.dashboardFinanceView}>` / `AppGate(requires: AppPerm.dashboardFinanceView)` bọc phần hiển thị số tài chính ⇒ **thiếu quyền = render null / `SizedBox.shrink()`** (số doanh thu biến mất). Story 2.6 chứng minh **pattern + provider** ở tầng primitive/test (màn Dashboard đầy đủ = Epic 8/FR-19 sẽ gate qua chính provider này).

3. **AC-3 — Phạm vi danh sách đơn theo quyền (UX-DR-22, FR-18, AD-17):** **Given** hai key tường minh `orders.view_all` vs `orders.view_own`, **When** UI cần phạm vi danh sách đơn, **Then** `orderScope(perms)` **đọc từ provider** trả `'all'` nếu có `orders.view_all`, ngược lại `'mine'`. Story 2.6 phơi giá trị scope này qua provider (helper/selector) để **màn Danh sách đơn (Epic 5)** tiêu thụ; chứng minh bằng test (perms có `orders.view_all` → `'all'`; chỉ có `orders.view_own` → `'mine'`).

4. **AC-4 — Key quyền FE suy từ registry chính tắc, cấm drift (AD-17 — đóng action item Epic 1):** **Given** artifact `backend/openapi/permissions.json` là nguồn 17 key chính tắc, **When** FE khai/dùng permission key, **Then**:
   - Bộ hằng key quyền phía FE (web + mobile) **được suy/generate từ `permissions.json`** (SSOT + generator, mẫu design-system token generator), **KHÔNG** hand-type độc lập; hoặc — nếu giữ hằng viết tay — có **drift-guard test** khẳng định **mọi** key FE dùng ∈ `permissions.json` (byte-for-byte). Kết quả: FE gating, BE guard, noti resolver **cùng một danh sách key** (AD-17, "ba bên tiêu thụ y hệt").
   - `SIDEBAR_NAV.requires` + mọi `Gate.requires` chỉ dùng **định danh từ bộ key suy-từ-registry** (KHÔNG chuỗi literal rải rác). Ba key hiện dùng (`orders.view_all`, `audit.read`, `permissions.manage`) **đã khớp** registry; story bổ sung `dashboard.finance_view` (+ `orders.view_own` nếu cần cho scope) từ chính registry.

5. **AC-5 — Gating chỉ UX; parity web↔mobile (AD-4, UX-DR-27):** **Given** mô hình bảo mật, **When** đánh giá, **Then** ẩn/null UI **KHÔNG phải bảo mật** — backend enforce mọi request (Story 2.5); comment ở tầng provider/port nêu rõ điều này (không ai được coi "ẩn nav Audit" là kiểm soát truy cập). Tầng session/provider + mapping `/me`→`PermissionSet` + cách wiring gating đạt **full parity** khái niệm giữa web (React context/hook) và mobile (provider/scope); test parity khẳng định song sinh.

**Bằng chứng "done" (kiểm được KHÔNG cần app-runtime/DB — theo kỷ luật FE text-guard + `flutter test` như Epic 1):**
- **Web (text-guard, vì `web/` chưa có tsc/bundler — xem Gotchas):** file provider/hook + `MePort` + mapping tồn tại; consumer gating đọc provider, **không** import `DEMO_PERMISSIONS` ở đường sản xuất; `filterNav`/`Gate`/`orderScope` chữ ký không đổi; bộ key FE suy-từ-registry (hoặc drift-guard) khớp `permissions.json`; guard chống literal quyền ngoài bộ key.
- **Mobile (`flutter test` + `flutter analyze`):** provider/scope + `MePort` + mapping biên dịch sạch; test widget dựng shell/menu với fake port trả `permissions` → nav lọc đúng (Audit ẩn khi thiếu `audit.read`); `AppGate(dashboardFinanceView)` render `SizedBox.shrink()` khi thiếu quyền; `orderScope` đúng; **bottom-nav vẫn 5 tab** (không đổi).
- **Parity test** (mẫu `parity.test.mjs`/`shell-parity.test.mjs`): web có `session/`(provider+port+mapping) VÀ mobile có tương đương; mapping `/me`→PermissionSet song sinh; key FE hai bên cùng suy từ `permissions.json`.
- **Drift/source-guard:** nếu dùng generator → output generated byte-for-byte khớp (regen từ `permissions.json`); mọi `requires`/`Gate.requires` dùng định danh, không literal; `DEMO_PERMISSIONS`/`demoPermissions` (nếu còn) đánh dấu test/demo-only.
- **0 regression:** toàn bộ test design-system Node (`node --test "design-system/**/*.test.mjs"`) + `mobile/ flutter test` + `flutter analyze` xanh; primitive Story 1.10 không đổi hành vi.

## Tasks / Subtasks

> **Ranh giới module & naming (theo tiền lệ 1.3–1.11 + 2.5):** web = **PascalCase.tsx / camelCase.ts** trong module mới `web/src/design-system/session/` (hoặc `web/src/session/` — xem Project Structure Notes); mobile = **snake_case + prefix `App`** trong `mobile/lib/design_system/session/` (hoặc `mobile/lib/session/`). Generator/artifact SSOT ở `backend/` (nguồn `permissions.json`) hoặc `design-system/` nếu tái dùng hạ tầng generator Epic 1. **KHÔNG** đổi chữ ký `Gate`/`can`/`filterNav`/`orderScope` (Story 1.10) — chỉ đổi **nguồn** bộ quyền.

- [x] **Task 1 — Bộ key quyền FE suy từ registry chính tắc (AC: 4)**
  - [x] Chọn cơ chế (mặc định YOLO = **generator**, xem Open Question #2): thêm generator zero-dep đọc `backend/openapi/permissions.json` → emit **web** `web/src/design-system/gating/permission-keys.generated.ts` (hằng key + type union optional) và **mobile** `mobile/lib/design_system/gating/app_permission_keys.g.dart`. Mẫu: design-system token generator (`design-system/tokens/build-tokens.mjs` — SSOT→web+mobile output, drift-guard byte-for-byte). Header generated: "GENERATED từ backend/openapi/permissions.json — KHÔNG sửa tay; regen bằng <lệnh>."
  - [x] Cập nhật `PERM` (web `gating/permissions.ts`) + `AppPerm` (mobile `gating/app_permissions.dart`): **tham chiếu/re-export** từ file generated thay vì hand-type 3 literal — HOẶC giữ `PERM`/`AppPerm` là view mỏng map tên-camelCase→key generated. Thêm `dashboardFinanceView` (`dashboard.finance_view`) + `ordersViewOwn` (`orders.view_own`) từ registry (dùng cho AC-2/AC-3). **KHÔNG** thêm key ngoài registry.
  - [x] **Nếu chọn drift-guard-test thay generator:** viết test khẳng định mọi key trong `PERM`/`AppPerm` (+ mọi `requires` trong `SIDEBAR_NAV`) ∈ tập key `permissions.json`; ghi rõ quyết định trong Completion Notes.
  - [x] Chạy generator (nếu có) + commit output; drift-guard xanh. Xác nhận 3 key cũ (`orders.view_all`/`audit.read`/`permissions.manage`) **không đổi giá trị** (byte-for-byte với stub cũ) ⇒ 0 regression cho `SIDEBAR_NAV`/test 1.10.

- [x] **Task 2 — Web: `MePort` + mapping `/me`→`PermissionSet` (AC: 1, 5)**
  - [x] Tạo module session web (`web/src/design-system/session/` hoặc `web/src/session/` — chốt ở Task 6/Project Structure). `me-port.ts`: `export interface MeResponse { id: string; email: string; displayName: string; permissions: string[] }` (**khớp `MeResponseDto`**; lý tưởng: import type từ OpenAPI client gen khi có — xem Open Question #3, hiện chưa có codegen nên khai type khớp contract + comment "khi có OpenAPI client, thay bằng type generated"). `export interface MePort { fetchMe(): Promise<MeResponse> }`.
  - [x] `session.ts` (hoặc `permissions-provider.ts`): hàm thuần `toPermissionSet(me: MeResponse): PermissionSet` → `new Set(me.permissions)` (readonly). Comment AD-4: "PermissionSet này chỉ để gating UX; backend enforce mọi request (Story 2.5)."
  - [x] `fake-me-port.ts` (test/demo): `MePort` trả payload cấu hình được (mặc định một manager: `['orders.view_all','permissions.manage']` — **cùng hình** demo cũ để test parity). Đánh dấu "test/demo-only — KHÔNG phải nguồn phiên thật."

- [x] **Task 3 — Web: PermissionsProvider (context) + `usePermissions()` (AC: 1, 2, 3)**
  - [x] `PermissionsProvider.tsx`: React context giữ `{ status: 'loading'|'ready'|'error', perms: PermissionSet }`. Nhận `MePort` (prop/inject) → `useEffect` gọi `fetchMe()` → `toPermissionSet` → `ready`; lỗi → `error` (dùng component Banner/ErrorState design-system để hiển thị, KHÔNG dựng UI ad-hoc). Trong lúc `loading` phơi cờ để shell hiện Skeleton (tái dùng `Skeleton` component).
  - [x] `usePermissions()` hook → trả `{ status, perms, orderScope: orderScope(perms) }` (selector `orderScope` sẵn cho AC-3). Docstring: nguồn quyền thật; gating chỉ UX (AD-4).
  - [x] `index.ts` barrel export provider/hook/port/mapping (mẫu `gating/index.ts`, `shell/index.ts`).

- [x] **Task 4 — Web: wiring shell/nav + bề mặt doanh thu qua provider (AC: 2, 3)**
  - [x] Điểm dựng nav (nơi caller lắp `<Sidebar>` vào `WebShell`): dùng `usePermissions()` → `filterNav(SIDEBAR_NAV, perms)` truyền vào `Sidebar.sections`. **KHÔNG** đổi `Sidebar.tsx` render (Story 1.9/1.10 đã chừa: Sidebar render nguyên `sections` nhận vào). Nếu chưa có "office screen" thật để đặt wiring (màn nghiệp vụ = Epic 3+), tạo **một điểm compose tối thiểu / hoặc cập nhật demo** thể hiện nav-gated-by-provider mà KHÔNG dựng router/app đầy đủ (giữ YAGNI — xem Ranh giới phạm vi & Open Question #1).
  - [x] Bề mặt doanh thu: demonstrate `<Gate perms={perms} requires={PERM.dashboardFinanceView}>…số…</Gate>` (thiếu quyền → null). Vì màn Dashboard = Epic 8, story chỉ chứng minh **pattern + provider** (test hoặc một surface tối thiểu), KHÔNG dựng dashboard đầy đủ.
  - [x] Gỡ `DEMO_PERMISSIONS` khỏi mọi consumer sản xuất; nếu LoginScreen/demo cần perms để minh hoạ, lấy qua `PermissionsProvider` + `fakeMePort` (đánh dấu demo).

- [x] **Task 5 — Mobile: `MePort` + mapping + provider/scope + wiring (AC: 1, 2, 3, 5)**
  - [x] Tạo module session mobile (`mobile/lib/design_system/session/` hoặc `mobile/lib/session/`). `me_port.dart`: `class MeResponse { final String id, email, displayName; final List<String> permissions; }` (khớp `MeResponseDto`); `abstract class MePort { Future<MeResponse> fetchMe(); }`. `app_session.dart`: `Set<PermissionKey> toPermissionSet(MeResponse me)`; provider/scope (`PermissionsScope extends InheritedWidget` **hoặc** `SessionCubit` nếu kéo `flutter_bloc` — xem Open Question #4, mặc định **InheritedWidget** để KHÔNG thêm dependency chưa cần, YAGNI) phơi `{ status, perms, orderScope }`.
  - [x] `fake_me_port.dart` (test/demo) song sinh web `fake-me-port.ts` (cùng payload mặc định). Đánh dấu test/demo-only.
  - [x] Wiring: nội dung Menu / mục quản trị mobile dựng qua `filterNav(sections, perms)` từ scope; `AppGate(perms: perms, requires: AppPerm.dashboardFinanceView, child: …)` cho bề mặt doanh thu. **KHÔNG** đụng `app_bottom_nav.dart` (5 tab khoá cứng — `assert(_tabs.length == 5)` giữ nguyên). `app_mobile_shell.dart`: nếu cần, đọc scope để dựng phần Menu — surgical, không phá slot hiện có.
  - [x] Barrel `session.dart` export (mẫu `gating.dart`/`shell.dart`).

- [x] **Task 6 — Test: mapping + provider + gating + parity + drift (AC: tất cả)**
  - [x] **Web (Node text-guard, `design-system/**/*.test.mjs`):** mẫu `gating.test.mjs`/`parity.test.mjs`. Khẳng định: (a) `session/` có `MePort` + `toPermissionSet` (map `permissions[]`→Set) + provider/hook; (b) consumer gating đọc provider, **KHÔNG** import `DEMO_PERMISSIONS` ở file sản xuất (regex quét import); (c) `filterNav`/`Gate`/`orderScope` chữ ký/logic **không đổi** (0 regression 1.10); (d) `DEMO_PERMISSIONS` (nếu còn) chỉ trong file test/demo + đánh dấu; (e) key FE suy-từ-registry: file generated tồn tại + drift byte-for-byte với `permissions.json` (hoặc drift-guard test key ⊆ registry); (f) không literal quyền ngoài bộ key trong `session/`+`gating/` (guard chuỗi).
  - [x] **Mobile (`flutter test`):** widget test dựng shell/menu bọc `PermissionsScope` + `fakeMePort`: perms thiếu `audit.read` → mục Audit **không** trong tree; perms có → có. `AppGate(dashboardFinanceView)` thiếu quyền → `SizedBox.shrink()` (không chiếm chỗ); `orderScope`: `{orders.view_all}`→'all', `{orders.view_own}`→'mine'. Khẳng định bottom-nav vẫn 5 tab (không đổi). `flutter analyze` sạch cho file mới.
  - [x] **Parity (`parity.test.mjs` mở rộng hoặc block mới):** web `session/`(port+mapping+provider) ↔ mobile `session/` tương đương; mapping `/me`→PermissionSet song sinh; cập nhật "Surface ownership" comment thêm dòng session (shared khái niệm, per-platform impl). Giá trị key hai bên cùng suy từ `permissions.json`.
  - [x] Chạy đủ: `node --test "design-system/**/*.test.mjs"` (0 regression với suite hiện tại) + `cd mobile && flutter test && flutter analyze`. Ghi số test pass ở Debug Log.

- [x] **Task 7 — Verify + tài liệu (AC: tất cả)**
  - [x] Nếu thêm generator: cập nhật README/CONVENTIONS design-system hoặc backend — một dòng "key quyền FE sinh từ `permissions.json` (`<lệnh regen>`); cấm sửa tay file generated" (mẫu ghi chú token generator + `openapi:gen`).
  - [x] `_bmad-output/implementation-artifacts/sprint-status.yaml`: `2-6-...` → `review` (do dev-story/code-review làm, KHÔNG ở create-story).
  - [x] Đóng **action item Epic 1** ("Xác minh contract PermissionKey/filterNav khớp registry enum trước khi code 2.6") trong Completion Notes: nêu 3 key cũ đã khớp byte-for-byte + AC-4 nay ràng buộc bằng generator/drift-guard nên drift **không thể tái diễn**.

## Dev Notes

### Ranh giới phạm vi (đọc TRƯỚC — quyết định scope quan trọng nhất của story)

**Bối cảnh then chốt:** Story 2.6 là story ĐẦU TIÊN nối FE↔`/me`. Nhưng **cả hai client hiện CHƯA có app-runtime**:
- **Web `web/`:** chỉ có `src/` (design-system + màn Login demo). **KHÔNG** `package.json`/`tsconfig`/bundler/`index.html`/router/HTTP client/token store. Chỉ được bảo vệ bằng **Node text-guard** ở `design-system/` (project-context: "web/ chỉ src/, CHƯA tsc/bundler → .tsx chưa typecheck/runtime-test; Correctness runtime web nối khi dựng web app; Đừng cố tsc web/ cho tới lúc đó").
- **Mobile `mobile/`:** có Flutter toolchain (`flutter test`/`analyze` chạy) nhưng `pubspec.yaml` là **"minimal scaffold"** — **KHÔNG** `http`/`dio`, **KHÔNG** `main.dart`, **KHÔNG** BLoC/repository/mạng. Màn Login demo (không mạng).

**Vì vậy "web và mobile lấy quyền từ /me" theo nghĩa đen sẽ đòi dựng NGUYÊN app-runtime (bundler + mount + router + HTTP client + login-lưu-token) trên cả hai nền tảng — vượt XA "nối gating vào /me" và mâu thuẫn deferral rõ ràng của project-context.** Đây là fork phạm vi thật (xem Open Question #1).

**Quyết định mặc định (YOLO — phương án kỷ luật, chặt hơn):** Story 2.6 = **tầng session/permission-provider (the seam)** buộc contract `/me` → gating `PermissionSet` trên hai nền tảng, với **transport tiêm được** (`MePort`) làm biên; impl HTTP thật + token lắp khi app-runtime/login-network land. Lý do:
- Tôn trọng deferral web-runtime của project-context + kỷ luật mọi story FE trước (1.3–1.11 guard bằng text-test/`flutter test`, KHÔNG dựng app-runtime).
- Buildable + testable NGAY hôm nay (text-guard web, `flutter test` mobile với fake port) — không cần Postgres/mạng.
- Thoả **ý đồ AC ở tầng gating**: nav/nút/scope suy từ `PermissionSet` của `/me`; Audit ẩn khi thiếu `audit.read`; doanh thu ẩn khi thiếu `dashboard.finance_view`; scope đơn theo `orders.view_all`/`orders.view_own`. Phần DUY NHẤT hoãn là ống HTTP thô + token — vốn chưa thể tồn tại khi client chưa có login-network/app-runtime.
- YAGNI/KISS: `MePort` là **một interface** (không phải "flexibility" đầu cơ) — biên tối thiểu để gating tiêu thụ `/me` mà không phải bịa cả app.

**TRONG phạm vi:** bộ key FE suy-từ-registry (AC-4, đóng action item); `MePort` + mapping `MeResponse`→`PermissionSet`; PermissionsProvider/hook (web) + provider/scope (mobile) với trạng thái `loading/ready/error`; chuyển consumer gating từ stub sang provider; wiring `filterNav`/`Gate`/`orderScope` vào shell/nav + bề mặt doanh thu (ở mức primitive/provider + điểm compose tối thiểu); fake port cho test/demo; test text-guard(web)+`flutter test`(mobile)+parity; tài liệu generator.

**NGOÀI phạm vi (ĐỪNG làm ở đây):**
- **Dựng app-runtime web** (Vite/bundler, `tsconfig`, `index.html`, ReactDOM mount, router) + **app-runtime mobile** (`main.dart`, `http`/`dio` dep, navigation) → story app-scaffold riêng (chưa tồn tại trong epics; nêu Open Question #1).
- **Login gọi mạng thật + lưu/refresh token phía client** (Story 2.3 mới làm BACKEND cấp token; client login vẫn demo). `MePort` impl HTTP thật gắn Bearer = phần của app-runtime/login-network.
- **OpenAPI client codegen cho FE** (sinh type/hàm gọi từ `openapi.json`) → khi dựng app-runtime; hiện khai `MeResponse` khớp contract + comment thay bằng type generated sau (Open Question #3).
- **Màn Phân quyền / ma trận per-account / form account** → Epic 8.
- **Màn Dashboard tài chính đầy đủ (FR-19)** → Epic 8; 2.6 chỉ chứng minh Gate pattern.
- **Màn Danh sách đơn + áp scope thật** → Epic 5; 2.6 chỉ phơi `orderScope` selector để E5 tiêu thụ.
- **Sửa registry/`account_permissions`/`/me` backend** → xong ở 2.4/2.5; 2.6 chỉ **tiêu thụ** `permissions.json` + shape `/me`.
- **Audit ghi truy cập / EventBus** → Story 2.7.

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-4 — Gating chỉ UX, backend enforce mọi request:** ẩn nav/null Gate **KHÔNG phải bảo mật**; Story 2.5 guard server-side là ranh giới thật. Comment tầng provider/port để không ai coi ẩn Audit = an toàn. [Source: ARCHITECTURE-SPINE.md#AD-4; 2-5-…md#AC-2/AC-3]
- **AD-17 — Registry chính tắc, ba bên tiêu thụ y hệt, cấm literal ngoài registry:** FE gating dùng **cùng** danh sách key với BE guard + noti resolver. AC-4 suy key FE từ `permissions.json` (SSOT) ⇒ drift **không thể** tái diễn. "Xem tất cả đơn"/"đơn của mình" là hai entry tường minh (`orders.view_all`/`orders.view_own`). [Source: ARCHITECTURE-SPINE.md#AD-17; backend/openapi/permissions.json]
- **AD-12 — `/me` trả effective permission set; OpenAPI sinh-từ-code:** FE dựng `PermissionSet` từ `MeResponseDto.permissions: string[]` (mô tả field: "FE dựng PermissionSet từ mảng này"). Type FE khớp contract; khi có codegen thì dùng type generated (cấm sửa tay spec). [Source: ARCHITECTURE-SPINE.md#AD-12; backend/openapi/openapi.json `/me`+`MeResponseDto`]
- **AD-1/2 — Client không business logic, không chạm DB:** provider chỉ **map + giữ** perms + gọi port; KHÔNG suy quyền, KHÔNG tính toán nghiệp vụ. Quyền hiệu lực do backend quyết (2.4/2.5). [Source: ARCHITECTURE-SPINE.md#AD-1/AD-2]
- **AD-13 — Design-system-first, cấm style ad-hoc:** UI trạng thái loading/error dùng `Skeleton`/`Banner`/`ErrorState` đã ship; KHÔNG dựng spinner/box ad-hoc. Provider là tầng logic-trình-bày, không thêm token/màu. [Source: project-context.md#Design-system]
- **UX-DR-15 — Bottom-nav mobile khoá cứng 5 tab:** gating **KHÔNG** áp cho 5 tab; chỉ cho Menu/mục quản trị/nút hành động. `assert(_tabs.length == 5)` giữ nguyên. [Source: 1-10-…md#Gotcha 6; app_bottom_nav.dart:67]
- **UX-DR-27 — Parity:** session/provider/mapping song sinh web(React context/hook)↔mobile(InheritedWidget/scope); test parity khẳng định. [Source: 1-10-…md#AC-3]

### Phụ thuộc đã có — TÁI DÙNG, KHÔNG dựng lại (scout-before-code)

- **Primitive gating Story 1.10 — KHÔNG viết lại, chỉ đổi nguồn quyền:**
  - Web `web/src/design-system/gating/permissions.ts`: `PermissionKey = string`, `PermissionSet = ReadonlySet<PermissionKey>`, `can(perms,key)`, `orderScope(perms)`, `filterNav<L,S>(sections,perms)` (generic, thuần), `PERM` (3 key stub), `DEMO_PERMISSIONS`. `Gate.tsx` (thiếu quyền→`null`). `index.ts` barrel.
  - Mobile `mobile/lib/design_system/gating/app_permissions.dart`: `typedef PermissionKey=String`, `can`, `orderScope`, `filterNav` (+ `AppNavSection`/`AppNavLink`), `AppPerm` (3 key), `demoPermissions`. `app_gate.dart` (`AppGate`→`SizedBox.shrink()`). `gating.dart` barrel.
  - **3 key stub ĐÃ khớp registry byte-for-byte:** `ordersViewAll='orders.view_all'`, `auditRead='audit.read'`, `permissionsManage='permissions.manage'` = `permissions.json` ⇒ Task 1 chuyển sang suy-từ-registry **không đổi giá trị** (0 regression `SIDEBAR_NAV`/test 1.10).
- **Shell nav (Story 1.9/1.10):**
  - Web `shell/Sidebar.tsx`: `NavLink { key, icon, label, requires? }`, `NavSection { title?, links }`, `SIDEBAR_NAV` (section chính [home/orders/customers/catalog/inventory] + "Quản trị" [permissions `requires:PERM.permissionsManage`, audit `requires:PERM.auditRead`, profile]). `Sidebar` render **nguyên `sections` nhận vào** — caller chạy `filterNav` TRƯỚC. `WebShell { url, sidebar?, topbar?, children }` — `sidebar` là slot.
  - Mobile `shell/app_mobile_shell.dart` (topbar + slot bottomNav) + `app_bottom_nav.dart` (5 tab khoá cứng incl "Menu"). Menu content list chưa có — 2.6 dựng phần lọc-được qua provider (KHÔNG đụng 5 tab).
- **Contract `/me` (Story 2.5):** `GET /me` (guard JWT) → `MeResponseDto { id, email, displayName, permissions: string[] }` (permissions **sorted**, mỗi phần tử ∈ `permissions.json`). Không lộ field nhạy cảm. FE map `permissions`→`Set`. [Source: 2-5-…md#AC-1; openapi.json:330 `MeResponseDto`]
- **Artifact registry (Story 2.4):** `backend/openapi/permissions.json` = 17 key `{key,label,group}` (nguồn chính tắc). Có sẵn `dashboard.finance_view`, `orders.view_own` cần cho AC-2/AC-3. Generator/seed pattern ở `backend/` (2.4). [Source: 2-4-…md; permissions.json]
- **Generator SSOT pattern (Epic 1):** `design-system/tokens/build-tokens.mjs` — zero-dep, đọc SSOT JSON → emit web(`tokens.ts/css`)+mobile(`app_tokens.dart`), drift-guard byte-for-byte. **Mẫu để suy key FE từ `permissions.json`** (Task 1). [Source: project-context.md#Design-system SSOT + generator]
- **Component trạng thái:** `Skeleton`/`Banner`/`ErrorState` (web `components/`), `AppSkeleton`/`AppBanner` (mobile) — dùng cho loading/error provider. KHÔNG dựng mới.
- **Không tạo trùng:** chưa có module `session/` nào (web/mobile) — code MỚI. Không có HTTP client/token store (đó là app-runtime, ngoài phạm vi).

### Thiết kế tầng session (chốt để dev nhất quán)

- **Một chiều phụ thuộc:** `session/` → `gating/` (session import `PermissionSet`/`filterNav`/`orderScope`/`PERM`), KHÔNG ngược. `gating/` giữ thuần/độc lập như 1.10 (test 1.10 không đổi).
- **`MePort` là biên (port), KHÔNG phải HTTP client:** interface một hàm `fetchMe()`. Bản story cấp: (a) type `MeResponse` khớp `MeResponseDto`; (b) `toPermissionSet` thuần; (c) `fakeMePort` cho test/demo. Impl HTTP thật (gắn `Authorization: Bearer <accessToken>`, parse envelope lỗi AD-5) = app-runtime/login-network (ngoài phạm vi) — comment TODO rõ ràng ở port.
- **Provider phơi tối thiểu:** `{ status: 'loading'|'ready'|'error', perms: PermissionSet, orderScope: 'all'|'mine' }`. `loading`→shell hiện `Skeleton`; `error`→`Banner`/`ErrorState` (message từ envelope khi có transport thật). KHÔNG cache/persist (YAGNI — session in-memory; refresh perms khi re-login = app-runtime).
- **Gỡ stub khỏi sản xuất:** consumer thật đọc provider; `DEMO_PERMISSIONS`/`demoPermissions` chỉ còn ở `fakeMePort`/test/demo (đánh dấu). Đây là điểm test (b) canh.
- **`orderScope` là selector, không state:** tính từ `perms` (thuần). Phơi qua provider cho E5 tiêu thụ; 2.6 không dựng màn đơn.

### Điểm sai kinh điển phải tránh (Gotchas)

1. **ĐỪNG dựng app-runtime/bundler/router/HTTP để "chạy được".** Web guard bằng **Node text-test** (như 1.3–1.11); mobile bằng `flutter test` + fake port. Dựng Vite/`http`/`main.dart` = ngoài phạm vi + mâu thuẫn deferral. Nếu thấy "cần fetch thật mới test được" → dùng `fakeMePort` (đó là lý do có port).
2. **ĐỪNG đổi chữ ký/logic `Gate`/`can`/`filterNav`/`orderScope`.** Story 1.10 đã hứa "Epic 2 thay nguồn, không viết lại gating". Chỉ đổi **nguồn** `PermissionSet` (stub→provider). Test 1.10 phải xanh nguyên.
3. **ĐỪNG hand-type lại key quyền.** AC-4: suy từ `permissions.json` (generator) hoặc drift-guard. 3 key cũ đã khớp — đừng vô tình đổi giá trị (vỡ `SIDEBAR_NAV`). Thêm key mới (`dashboard.finance_view`/`orders.view_own`) **từ registry**, không bịa.
4. **ĐỪNG coi ẩn UI là bảo mật (AD-4).** Comment mọi tầng session/port. Backend `/me`+guard (2.5) là ranh giới thật.
5. **ĐỪNG phá bottom-nav 5 tab khoá cứng (UX-DR-15).** Gating cho Menu/mục quản trị, KHÔNG cho 5 tab. `assert(_tabs.length==5)` giữ.
6. **Web chưa có tsc/runtime:** logic provider là TS thuần nhưng KHÔNG chạy được → guard bằng text-pattern + parity (đúng contract 1.3–1.11). Ghi giới hạn ở Completion Notes. KHÔNG thêm test runner/transpile mới (YAGNI).
7. **Mobile: đừng kéo `flutter_bloc` nếu chưa cần.** Provider = `InheritedWidget`/scope (mặc định) đủ cho gating; thêm BLoC dep = app-runtime concern (Open Question #4). Nếu chủ dự án muốn BLoC toàn app, để story app-scaffold quyết.
8. **`DEMO_PERMISSIONS` giá trị demo (manager: all-orders + manage-perms, KHÔNG audit):** giữ đúng hình này ở `fakeMePort` để test filterNav (Audit ẩn) song sinh với 1.10.
9. **Drift-guard generator (nếu dùng): tránh chuỗi bị cấm trong comment** (source-guard Epic 1 quét toàn văn) — không viết literal quyền lạ / chuỗi cấm trong file generated/test.

### Chiến lược test (mirror kỷ luật FE Epic 1 + hermetic 2.5)

- **Web = Node text-guard** (`design-system/**/*.test.mjs`, `node --test`): không React runtime/tsc. Guard: session module shape, consumer đọc provider (không stub sản xuất), primitive 1.10 bất biến, key suy-từ-registry/drift, parity. Mẫu: `gating.test.mjs`, `parity.test.mjs`, `components.test.mjs`.
- **Mobile = `flutter test` + `flutter analyze`:** widget test với `PermissionsScope`+`fakeMePort` (nav lọc, Gate null, orderScope), analyze sạch. Fake port ⇒ KHÔNG cần mạng/DB (hermetic, mirror 2.5).
- **0 regression:** suite design-system hiện tại + `flutter test` phải xanh; primitive 1.10 không đổi.
- **KHÔNG cần Postgres/mạng** — toàn bộ 2.6 hermetic (fake port). Correctness runtime thật nối khi app-runtime land.

### Previous Story Intelligence (2.5 — vừa done)

- **Chốt Open Question theo mặc định YOLO** rồi ghi rõ Completion Notes (không lừa dối subtask nhánh-không-chọn) — 2.6 làm tương tự (4 Open Question dưới).
- **`/me` contract chốt:** `MeResponseDto { id, email, displayName, permissions: string[] }`, permissions **sorted** ∈ registry, không field nhạy cảm. 2.6 map thẳng — KHÔNG kỳ vọng field khác (nếu cần `roles`/`createdAt` → BE thêm ở story sau, 2.5 Open Question #4 để tối giản).
- **Source-guard literal (AD-17):** BE bắt literal quyền kể cả trong DTO example (2.5 Debug Log: `example:['audit.read']`→ fail, sửa `PERM.auditRead`). FE 2.6 tương tự: dùng định danh key suy-từ-registry, KHÔNG literal.
- **Hermetic-first:** 2.5 117 test xanh không Postgres (fake service). 2.6 giữ kỷ luật (fake port).
- **Generator/artifact discipline (2.4/Epic 1):** thêm output generated → PHẢI regen + commit; drift-guard byte-for-byte fail nếu quên.

### Git Intelligence (5 commit gần nhất)

`e10f35f feat(story-2.5)` · `e60ef01 feat(story-2.4)` · `3b77460 feat(story-2.3)` · `7be0495 feat(story-2.2)` · `11cde47 feat(story-2.1)`. Pattern: mỗi story = một commit conventional `feat(story-X.Y): <mô tả tiếng Việt>`, KHÔNG tham chiếu AI. Mạch bảo mật Epic 2: 2.3 phát token → 2.4 lưu quyền → 2.5 verify+enforce+`/me` → **2.6 FE tiêu thụ `/me` để gating**. Commit đề xuất: `feat(story-2.6): Nối UI gating vào /me trên hai nền tảng`.

### Latest Tech Notes (versions từ project-context)

- **React 19.2.7 (web):** context + hook (`createContext`/`useContext`/`useEffect`) — không cần lib state ngoài. `usePermissions()` = custom hook thuần. Web CHƯA có bundler ⇒ text-guard.
- **Flutter 3.44 (mobile):** `InheritedWidget` cho provider (0 dep thêm); `flutter_bloc` chỉ thêm nếu chốt BLoC toàn app (Open Question #4). `pubspec` hiện KHÔNG có `http` — đừng thêm (transport = app-runtime).
- **Node 24 / zero-dep generator:** mẫu `build-tokens.mjs` cho generator key từ `permissions.json` (nếu chọn generator).
- **OpenAPI (2.5):** `openapi.json` có `/me`+`MeResponseDto`+bearer scheme — nguồn để (tương lai) codegen FE client; hiện khai type khớp tay + comment.

### Project Structure Notes — Alignment & Variances

- **Module mới `session/`:** đặt ở `web/src/design-system/session/` + `mobile/lib/design_system/session/` (cạnh `gating/`) **HAY** `web/src/session/` + `mobile/lib/session/` (ngoài design-system, vì session là app-concern không phải design token). **Mặc định YOLO: trong `design-system/session/`** để song sinh với `gating/` + tái dùng hạ tầng text-guard/parity Epic 1 (nhất quán barrel/test). *(Open Question #5 — nếu chủ dự án coi session là app-layer thuần, tách ra `web/src/session/`; khi app-runtime land có thể move.)* Ghi rõ lựa chọn.
- **Alignment:** `/me`→PermissionSet khớp AD-12 ("FE dựng PermissionSet từ mảng"); key suy-từ-registry khớp AD-17 (một nguồn); gating chỉ UX khớp AD-4; parity khớp UX-DR-27; dùng lại Skeleton/Banner khớp AD-13. File web PascalCase/camelCase, mobile snake_case+App — khớp naming 1.3–1.11.
- **Variance có chủ đích:** transport hoãn (port tiêm) vì app-runtime chưa tồn tại — **có lý do**, không vi phạm bất biến (bất biến = "gating từ nguồn `/me`, cấm literal, chỉ UX"; ống HTTP là chi tiết hạ tầng lắp sau). Ghi rõ.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] — user story + 3 AC (web+mobile lấy quyền từ `/me` dựng nav/nút; Audit ẩn thiếu quyền + doanh thu ẩn thiếu `dashboard.finance_view`; scope đơn `orders.view_all` vs `orders.view_own`; UX-DR-22, FR-22/FR-18/FR-20).
- [Source: ARCHITECTURE-SPINE.md#AD-4] — UI gating theo quyền, **backend luôn enforce mỗi request**; ẩn/disable chỉ UX.
- [Source: ARCHITECTURE-SPINE.md#AD-17] — registry chính tắc một nguồn, **ba bên tiêu thụ y hệt** (FE gating/BE guard/noti resolver), cấm literal ngoài registry; "xem tất cả đơn"/"đơn của mình" hai entry tường minh.
- [Source: ARCHITECTURE-SPINE.md#AD-12 + #Consistency Conventions] — `/me` trả permission set; OpenAPI sinh-từ-code (cấm sửa tay); JWT Bearer.
- [Source: ARCHITECTURE-SPINE.md#AD-1/AD-2, #AD-13] — client không business logic/không chạm DB; design-system-first, cấm style ad-hoc.
- [Source: backend/openapi/permissions.json] — 17 key chính tắc `{key,label,group}` (gồm `orders.view_all`, `orders.view_own`, `audit.read`, `permissions.manage`, `dashboard.finance_view`) — nguồn suy key FE (AC-4).
- [Source: backend/openapi/openapi.json `/me` + `MeResponseDto` (dòng 131, 330)] — shape `{ id, email, displayName, permissions: string[] }`; mô tả field permissions: "FE dựng `PermissionSet` từ mảng này".
- [Source: _bmad-output/implementation-artifacts/2-5-…md] — contract `/me` + guard enforce; kỷ luật hermetic (fake service), source-guard literal, "nối FE gating = 2.6, 2.5 KHÔNG đụng web/mobile".
- [Source: _bmad-output/implementation-artifacts/2-4-…md + permissions.json] — registry + generator/artifact discipline (regen+commit, drift byte-for-byte).
- [Source: _bmad-output/implementation-artifacts/1-10-…md] — primitive `Gate`/`can`/`filterNav`/`orderScope` + stub `PERM`/`DEMO_PERMISSIONS` "Epic 2 thay bằng `/me`, không viết lại gating"; UX-DR-15 bottom-nav khoá cứng; parity test pattern.
- [Source: web/src/design-system/gating/permissions.ts, Gate.tsx, index.ts] — primitive web (chữ ký giữ nguyên); 3 key stub khớp registry.
- [Source: web/src/design-system/shell/Sidebar.tsx (`SIDEBAR_NAV`, `NavLink.requires`), WebShell.tsx (`sidebar` slot)] — điểm dựng nav; caller chạy `filterNav` trước.
- [Source: mobile/lib/design_system/gating/app_permissions.dart, app_gate.dart, gating.dart] — primitive mobile (`AppPerm`/`filterNav`/`AppNavSection`); `demoPermissions`.
- [Source: mobile/lib/design_system/shell/app_bottom_nav.dart:67 (`assert(_tabs.length==5)`), app_mobile_shell.dart] — 5 tab khoá cứng; gating KHÔNG áp.
- [Source: design-system/tokens/build-tokens.mjs] — mẫu generator zero-dep SSOT→web+mobile + drift-guard (mẫu suy key FE từ `permissions.json`).
- [Source: _bmad-output/project-context.md] — deferral web-runtime ("Đừng cố tsc web/"), design-system SSOT+generator, scout-before-code, gating chỉ UX, cấm literal quyền.
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml `action_items` epic-1] — "Xác minh contract PermissionKey/filterNav (1.10) khớp registry enum (2.4) trước khi code 2.6" — AC-4 đóng action item này.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8, 1M context)

### Debug Log References

- `cd design-system && npm test` → **162/162 pass** (bao gồm 13 test mới 2.6: 3 drift-guard `permissions/permission-keys.test.mjs` + 6 source-guard `session/session.test.mjs` + 4 parity `session/parity.test.mjs`). 0 regression: `components/gating.test.mjs` + `components/parity.test.mjs` (Story 1.10) xanh nguyên.
- `cd mobile && flutter test` → **107/107 pass** (9 test mới `test/design_system/session_test.dart`; 98 test cũ Epic 1 không đổi).
- `cd mobile && flutter analyze` → **No issues found** (đã sửa 1 info `prefer_const_constructors` trong test).
- `npm run build:permissions` → regen `permission-keys.generated.ts` + `app_permission_keys.g.dart` từ `backend/openapi/permissions.json` (17 key); drift-guard byte-for-byte xanh.

### Completion Notes List

**Chốt Open Question (theo YOLO, ghi rõ nhánh-không-chọn):**
1. **Phạm vi = seam** (không dựng app-runtime/HTTP transport). `MePort` tiêm được là biên; impl HTTP thật + Bearer để TODO tới app-runtime/login-network. Buildable/testable ngay bằng text-guard(web) + `flutter test`(mobile) với fake port — tôn trọng deferral web-runtime của project-context.
2. **Cơ chế key = generator + drift-guard (KHÔNG re-export vào PERM).** Generator `design-system/permissions/build-permission-keys.mjs` emit file registry-derived (all 17 key) cho web+mobile. `PERM`/`AppPerm` GIỮ literal (chỉ THÊM `ordersViewOwn`+`dashboardFinanceView`) để test source-guard Story 1.10 (`gating.test.mjs`) xanh **byte-for-byte** (Gotcha 6). Drift-guard `permission-keys.test.mjs` khẳng định: (a) generated == registry byte-for-byte; (b) mọi `PERM`/`AppPerm` value ∈ registry; (c) mọi `SIDEBAR_NAV.requires` ∈ registry. ⇒ Không thể hand-type key ngoài registry mà không fail test — drift **không thể tái diễn** dù PERM vẫn viết tay. *(Nhánh không chọn: re-export PERM từ generated sẽ dời literal khỏi permissions.ts và vỡ `gating.test.mjs` (d)/(f) — vi phạm "1.10 xanh nguyên".)*
3. **Type `MeResponse` khai tay** khớp `MeResponseDto` + comment TODO thay bằng type OpenAPI-codegen khi có.
4. **Mobile provider = InheritedWidget** (`PermissionsProvider` StatefulWidget nạp `/me` → `PermissionsScope`), 0 dep thêm (không kéo `flutter_bloc`).
5. **Module ở `design-system/session/`** (web + mobile), song sinh `gating/`, tái dùng text-guard/parity Epic 1.

**Đóng action item Epic 1** ("Xác minh contract PermissionKey/filterNav (1.10) khớp registry enum (2.4) trước khi code 2.6"): 3 key cũ (`orders.view_all`/`audit.read`/`permissions.manage`) đã khớp registry byte-for-byte từ 1.10 (không đổi giá trị ⇒ 0 regression `SIDEBAR_NAV`). AC-4 nay RÀNG BUỘC bằng drift-guard test (mọi key FE ∈ `permissions.json`) + generator artifact ⇒ mismatch FE↔registry **không thể** lọt qua CI. Action item **đóng**.

**Bất biến giữ đúng:** `Gate`/`can`/`filterNav`/`orderScope` KHÔNG đổi chữ ký/logic (chỉ đổi nguồn stub→provider). `DEMO_PERMISSIONS`/`demoPermissions` giữ nguyên là stub-demo, KHÔNG import ở file session sản xuất (source-guard canh); demo payload chuyển vào `FakeMePort`/`kDemoMe`. Bottom-nav mobile vẫn khoá 5 tab (`assert(_tabs.length==5)`), gating KHÔNG áp — parity test canh. Comment AD-4 (gating chỉ UX, backend enforce) ở port/mapping/provider hai nền tảng.

**Giới hạn có chủ đích (variance):** web `session/` là TS thuần chưa chạy runtime (web/ chưa có tsc/bundler) → guard bằng Node text-pattern + parity như 1.3–1.11; correctness runtime web nối khi app-runtime land. Transport HTTP thật + Bearer + OpenAPI client-codegen = app-runtime/login-network (ngoài phạm vi story này).

### File List

**Mới — Generator + artifact (Task 1):**
- `design-system/permissions/build-permission-keys.mjs`
- `web/src/design-system/gating/permission-keys.generated.ts` (generated)
- `mobile/lib/design_system/gating/app_permission_keys.g.dart` (generated)

**Mới — Web session seam (Task 2–4):**
- `web/src/design-system/session/me-port.ts`
- `web/src/design-system/session/session.ts`
- `web/src/design-system/session/fake-me-port.ts`
- `web/src/design-system/session/PermissionsProvider.tsx`
- `web/src/design-system/session/use-permissions.ts`
- `web/src/design-system/session/SessionGatingExample.tsx`
- `web/src/design-system/session/index.ts`

**Mới — Mobile session seam (Task 5):**
- `mobile/lib/design_system/session/me_port.dart`
- `mobile/lib/design_system/session/app_session.dart`
- `mobile/lib/design_system/session/fake_me_port.dart`
- `mobile/lib/design_system/session/app_session_gating_example.dart`
- `mobile/lib/design_system/session/session.dart`

**Mới — Test (Task 6):**
- `design-system/permissions/permission-keys.test.mjs`
- `design-system/session/session.test.mjs`
- `design-system/session/parity.test.mjs`
- `mobile/test/design_system/session_test.dart`

**Sửa:**
- `web/src/design-system/gating/permissions.ts` (thêm `PERM.ordersViewOwn`+`PERM.dashboardFinanceView`; cập nhật comment registry-binding)
- `web/src/design-system/gating/index.ts` (export `PERMISSION_KEYS`/`PermissionKeyName`)
- `mobile/lib/design_system/gating/app_permissions.dart` (thêm `AppPerm.ordersViewOwn`+`AppPerm.dashboardFinanceView`)
- `mobile/lib/design_system/gating/gating.dart` (export `app_permission_keys.g.dart`)
- `design-system/package.json` (script `build:permissions` + gộp vào `build`)
- `backend/CONVENTIONS.md` (dòng generator key FE + drift-guard)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`2-6` → in-progress → review)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-09 | **Triển khai 2.6 (dev-story) — Status → review.** Generator `build-permission-keys.mjs` sinh key FE từ `permissions.json` (web+mobile) + drift-guard (AC-4, đóng action item Epic 1). Tầng `session/` hai nền tảng: `MePort` + `toPermissionSet(/me→PermissionSet)` + provider/hook (web React context) / provider+`PermissionsScope` (mobile InheritedWidget) + `FakeMePort`, trạng thái loading/ready/error (AC-1). Wiring nav qua `filterNav` + doanh thu qua `Gate`/`AppGate(dashboardFinanceView)` + `orderScope` selector (AC-2/AC-3). Gating chỉ UX, parity web↔mobile (AC-5). `PERM`/`AppPerm` thêm `ordersViewOwn`+`dashboardFinanceView`; `Gate`/`can`/`filterNav`/`orderScope` không đổi. Test: 162 Node (13 mới) + 107 flutter (9 mới) xanh, `flutter analyze` sạch, 0 regression Story 1.10. |
| 2026-07-09 | Tạo story context 2.6 (Nối UI gating vào `/me` trên hai nền tảng): phạm vi = tầng session/permission-provider buộc contract `/me` (`MeResponseDto.permissions`) → gating `PermissionSet` (thay stub `DEMO_PERMISSIONS`) trên web (React context/hook) + mobile (InheritedWidget/scope), qua `MePort` tiêm được (transport HTTP thật hoãn tới app-runtime/login-network); bộ key FE suy TỪ `permissions.json` (SSOT+generator/drift-guard, đóng action item Epic 1, AD-17); wiring `filterNav`(nav)/`Gate`(doanh thu)/`orderScope`(đơn) vào shell + fake port; test text-guard(web)+`flutter test`(mobile)+parity, hermetic 0 regression. Bối cảnh then chốt: cả hai client CHƯA có app-runtime (web chỉ `src/`, mobile pubspec minimal) → chọn seam thay vì dựng nguyên app (tôn trọng deferral project-context). 5 Open Question: (1) seam vs full app-runtime; (2) generator vs drift-guard-test cho key; (3) khai type `/me` tay vs OpenAPI codegen; (4) InheritedWidget vs flutter_bloc; (5) `design-system/session/` vs `session/` app-layer. Mặc định YOLO: seam / generator / khai-tay-có-TODO / InheritedWidget / `design-system/session/`. |

## Open Questions

1. **Phạm vi 2.6: chỉ tầng seam (gating↔`/me` qua `MePort` tiêm) hay dựng luôn app-runtime + transport HTTP thật?** Đề xuất **seam** — cả hai client chưa có app-runtime (web `web/` chỉ `src/`, không bundler/HTTP/router; mobile `pubspec` minimal, không `http`/`main.dart`); project-context **hoãn** web-runtime tường minh. Seam buildable/testable ngay (text-guard + fake port), thoả ý đồ AC ở tầng gating; transport HTTP thật + token = story app-scaffold/login-network riêng (chưa có trong epics). Full-runtime ở đây = swallow scope 3–4 story + mâu thuẫn deferral. **Mặc định YOLO: seam.** *(Nếu chủ dự án muốn dựng app-runtime ngay, tách story app-scaffold trước rồi 2.6 lắp transport.)*
2. **Key quyền FE: generator từ `permissions.json` hay drift-guard-test (giữ hằng tay)?** Đề xuất **generator** (DRY, mẫu design-system token, drift **không thể** tái diễn). Drift-guard-test nhẹ hơn (không thêm output generated) nhưng vẫn hand-type. **Mặc định: generator.**
3. **Type `MeResponse` FE: khai tay khớp contract hay chờ OpenAPI codegen?** Hiện **chưa có** FE codegen (app-runtime chưa dựng). Đề xuất **khai tay khớp `MeResponseDto` + comment TODO** thay bằng type generated khi có codegen. **Mặc định: khai tay + TODO.**
4. **Mobile provider: `InheritedWidget`/scope (0 dep) hay `flutter_bloc`?** Đề xuất **InheritedWidget** — đủ cho gating, KHÔNG kéo dep chưa cần (YAGNI); BLoC toàn app là quyết định app-scaffold. **Mặc định: InheritedWidget** (dễ đổi sang Cubit khi app-runtime chốt BLoC).
5. **Vị trí module session: `design-system/session/` hay `web/src/session/` + `mobile/lib/session/` (app-layer)?** Đề xuất **`design-system/session/`** — song sinh `gating/`, tái dùng text-guard/parity Epic 1. Nếu coi session là app-concern thuần thì tách ra app-layer (move dễ khi app-runtime land). **Mặc định: `design-system/session/`.**
