---
baseline_commit: 11e14ff7d3b23ed8524e899d279361f34b1ca4a1
---

# Story 8.2: Màn phân quyền — ma trận per-account + áp preset Role

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Admin,
I want màn ma trận Quyền theo Account với nút áp preset Role,
so that cấp đúng quyền cho từng người nhanh gọn.

## Acceptance Criteria

1. **Danh sách account + ma trận quyền.** Given account có `permissions.manage`, When mở mục **Phân quyền** (web sidebar nhóm Quản trị, mobile Menu), Then thấy danh sách account (tên, SĐT, nhãn preset khớp hoặc "Tuỳ chỉnh", trạng thái vô hiệu nếu có); chọn một account ⇒ checklist toàn bộ quyền trong registry (nhãn tiếng Việt từ registry, nhóm theo `group`) với ô đang tick = bộ quyền lưu trên account (FR-17, AD-8). Account thiếu `permissions.manage` không thấy mục trong nav/menu, mở thẳng URL ⇒ về landing, backend 403 (AD-4, UX-DR-22).
2. **Áp preset chỉ nạp giá trị.** Given một account đang chọn, When bấm "Áp preset role" và chọn một preset, Then ma trận nạp đúng bộ quyền của preset **chưa lưu gì**; sau đó tick/bỏ từng ô rồi bấm **Lưu** mới gửi backend. Nguồn chân lý là bộ quyền trên account — backend KHÔNG lưu role của account, không có cột/bảng role (FR-17, AD-8).
3. **Lưu không lan sang account khác, preset không hồi tố.** Given sửa quyền account A, When lưu, Then chỉ `account_permissions` của A đổi; account B có cùng bộ quyền (cùng preset gốc) giữ nguyên. Đổi `ROLE_PRESETS` trong code sau này không đổi quyền account đã tạo (đã đúng theo thiết kế: preset là hằng số nạp một lần — có ca test chứng minh) (FR-17).
4. **Key chỉ từ registry.** Given ma trận quyền, When render, Then danh sách quyền, nhãn, nhóm và bộ quyền preset đến từ backend (registry `permission-registry.ts` + `role-presets.ts`); web/mobile không có literal quyền ngoài file key sinh (`PERMISSION_KEYS` / `AppPermissionKeys`) (AD-17). Body lưu chứa key ngoài registry ⇒ 400 có `fieldErrors[0].field = 'permissions'`.
5. **Luật không-leo-thang giữ nguyên (Story 2.10).** Given actor lưu quyền, When (a) cấp key actor không có, hoặc (b) sửa account đang mang key actor không có (vd ADMIN sửa SUPER_ADMIN), Then 403, không chạm DB. UI: ô actor không cấp được thì disable; account actor không sửa được thì ma trận chỉ đọc kèm lý do; preset chứa key actor không cấp được không xuất hiện trong danh sách preset. Mọi cờ "cấp được/sửa được" do **backend tính** và trả trong response, client không tự suy (AD-2).
6. **Không tự sửa quyền của chính mình.** Given actor chọn chính account của mình, When lưu, Then backend 403 "Không thể tự sửa quyền của chính mình." (chặn tự khoá mình khỏi màn Phân quyền / Super Admin duy nhất tự thu quyền); UI hiển thị account đó chỉ đọc. _(Quyết định mặc định của story — ghi vào `epics.md` 8.2, luật 11.)_
7. **Tổ hợp gây 403 giữa luồng (H-7 / TD-65) bị chặn, không chỉ cảnh báo.** Given bảng phụ thuộc quyền ở `accounts/domain` (`settings.manage` cần `customers.manage`; `quotes.create_edit` cần `customers.manage` **và** `catalog.view`), When ma trận có một quyền mà thiếu quyền nó cần, Then UI hiện `Banner` cảnh báo nêu tên cả hai quyền (vd "«Cấu hình hệ thống» cần thêm «Quản lý khách hàng»") và **disable Lưu**; nếu vẫn gửi (client cũ/curl) backend trả 400 `fieldErrors.permissions` cùng câu đó. Test cho CẢ HAI tổ hợp ghi trong epics (settings không kèm customers; quotes không kèm customers) ở unit domain + e2e + màn web + màn mobile. Test riêng: **mọi preset trong `ROLE_PRESETS` thoả bảng phụ thuộc** (preset có sẵn không bị ảnh hưởng). _(Chọn "chặn" thay vì "chỉ cảnh báo" — phương án chặt hơn; ghi `epics.md`.)_
8. **Ghi atomic dưới khoá + audit qua event.** Given hai lần lưu đồng thời cho cùng account (double-click, hai admin), When commit, Then bộ quyền cuối = đúng một trong hai payload (không trộn/nhân đôi, không 500 P2002); kiểm leo thang + phụ thuộc đọc quyền actor và target **dưới khoá** `SELECT id FROM accounts WHERE id = ANY(…) ORDER BY id FOR UPDATE`; account không tồn tại ⇒ 404. Lưu thành công ⇒ publish `AccountPermissionsChanged` SAU commit (AD-18; consumer audit có sẵn).
9. **Parity web ↔ mobile, BLoC.** Web: route `/permissions`, layout 2 cột (danh sách account | thẻ quyền) theo mockup `s-permissions`. Mobile: Menu → "Phân quyền" ⇒ màn danh sách account ⇒ màn quyền của account (topbar "Quyền · {tên}", nút Lưu), dựng bằng Cubit (chỉ cubit gọi port). Loading/lỗi/rỗng dùng `Skeleton`/`ErrorState`/`EmptyState`; lỗi 400/403 khi lưu hiện câu backend trả trên màn (không mất các ô đang tick).

## Tasks / Subtasks

- [x] **T1 — Domain thuần** (AC: #2, #3, #5, #7)
  - [x] `backend/src/accounts/domain/role-presets.ts`: thêm `ROLE_PRESET_KEYS` (thứ tự hiển thị: THO_KS, THI_CONG, KE_TOAN, KHO_GIAO, QUAN_LY, ADMIN, SUPER_ADMIN — như cột mockup + Super Admin cuối) và `ROLE_PRESET_LABELS: Record<RolePreset, string>` (`Thợ khảo sát`, `Đội thi công`, `Kế toán`, `Kho/Giao hàng`, `Quản lý/Sếp`, `Admin`, `Super Admin`). Hàm thuần `matchingPreset(perms: ReadonlySet<PermissionKey>): RolePreset | null` (so tập bằng nhau tuyệt đối; nhiều preset trùng tập là không thể — có test).
  - [x] File mới `backend/src/accounts/domain/permission-dependencies.ts`: `PERMISSION_REQUIRES: Partial<Record<PermissionKey, readonly PermissionKey[]>>` = `{ [PERM.settingsManage]: [PERM.customersManage], [PERM.quotesCreateEdit]: [PERM.customersManage, PERM.catalogView] }` (comment tiếng Anh nêu luồng gây 403: settings screen lists customer sources via `GET /customer-sources` gated `customers.manage`; quote builder looks customers up + reads catalog) và `missingDependencies(keys): { key, missing: PermissionKey[] }[]` (sorted, tất định). Chỉ dùng `PERM.x` (guard `no-permission-literal-outside-registry`). Story 8.4 sẽ thêm entry cho quyền hành động vào CÙNG bảng này.
  - [x] Unit `backend/test/permission-dependencies.spec.ts`: hai tổ hợp TD-65 trả đúng `missing`; đủ phụ thuộc ⇒ rỗng; **mọi** `ROLE_PRESETS` ⇒ rỗng; mọi key trong bảng (khoá + giá trị) ∈ registry. Mở rộng `role-presets.spec.ts`: `matchingPreset` cho từng preset, tập lệch một key ⇒ null, `ROLE_PRESET_KEYS` phủ đủ union `RolePreset`.
- [x] **T2 — Service ghi dưới khoá** (AC: #4–#8)
  - [x] Sửa `AccountPermissionsService.setForAccount(actor, target, keys)` (người gọi duy nhất hiện tại là test — `grep -rn setForAccount backend/src` trước khi sửa): đổi sang interactive `$transaction(async (tx) => …)`: op đầu `tx.$queryRaw` `SELECT id FROM accounts WHERE id = ANY(${[actor, target]}::text[]) ORDER BY id FOR UPDATE` (cột `accounts.id` là `TEXT` — `20260708000000_init_auth_accounts_sessions/migration.sql:6`, KHÔNG cast `uuid[]`; `ORDER BY id` để không deadlock); target không có trong kết quả ⇒ 404 `NOT_FOUND`; đọc quyền actor + target **qua `tx`** dưới khoá; rồi theo thứ tự fail-closed: key ngoài registry (400) → actor = target (403, AC #6) → luật #2 (403) → luật #1 (403) → phụ thuộc thiếu (400 `fieldErrors: [{ field: 'permissions', code: 'PERMISSION_DEPENDENCY', message }]`) → `deleteMany` + `createMany` (giữ guard mảng rỗng — memory Prisma 7 empty createMany). Publish `AccountPermissionsChanged` SAU commit (giữ y nguyên). Xem cách `AppException` mang `fieldErrors` ở chỗ khác (`grep -rn "fieldErrors" backend/src --include=*.ts | head`) — dùng đúng khuôn có sẵn, không dựng envelope ở controller (guard `no-controller-error-envelope`).
  - [x] Câu lỗi (tiếng Việt, hiển thị cho người dùng): self-edit "Không thể tự sửa quyền của chính mình."; phụ thuộc "«{label A}» cần thêm «{label B}»." (nhãn từ `PERMISSIONS`); giữ nguyên câu leo thang hiện có.
  - [x] Thêm `AccountsService.listWithPermissions()` (hoặc method trong `AccountPermissionsService` — chọn chỗ đang sở hữu bảng; KHÔNG để controller chạm Prisma): `findMany` `accounts` include `permissions`, `orderBy displayName`, trả `{ id, displayName, phone, email, isActive, permissions }`. KHÔNG trả `passwordHash`.
  - [x] Cập nhật `account-permissions.service.spec.ts` (mock `$transaction(async cb)` phải **chạy callback** với tx giả — gotcha mock reject tx), thêm ca: self-edit 403, target không tồn tại 404, phụ thuộc thiếu 400 + `fieldErrors`, thứ tự kiểm (key lạ thắng self-edit; self-edit thắng leo thang), quyền đọc qua `tx` không qua `this.prisma`, publish đúng 1 lần (`toHaveBeenCalledTimes(1)`) chỉ khi thành công.
- [x] **T3 — Controller + DTO + OpenAPI** (AC: #1, #2, #4–#8)
  - [x] `backend/src/accounts/accounts.controller.ts` (`@Controller('accounts')`, `@ApiTags('accounts')`, `@ApiBearerAuth()`), đăng ký trong `AccountsModule` (`controllers: [...]`). Mọi handler `@RequirePermissions(PERM.permissionsManage)` (guard `no-handler-without-require-permissions`), `@CurrentAccount()`; quyền actor resolve tươi từ DB (không JWT).
    - `GET /accounts` → `AccountPermissionSummaryDto[]`: `id`, `displayName`, `phone` (`string | null`, `type: 'string', nullable: true` tường minh — guard `openapi-no-untyped-object`), `email`, `isActive`, `permissions: string[]` (sorted), `matchingPreset` (enum `ROLE_PRESET_KEYS` | null), `editable: boolean` (= target ≠ actor VÀ `keysBlockingActorFromTarget` rỗng), `readOnlyReason: string | null` (câu tiếng Việt: "Đây là tài khoản của bạn." / "Tài khoản mang quyền bạn không có: …").
    - `GET /accounts/permission-options` (khai **trước** mọi route `:id` sau này) → `{ permissions: [{ key, label, group, requires: string[], grantable: boolean }], presets: [{ key, label, permissions: string[] }] }`; `grantable` = actor có key đó; `presets` CHỈ gồm preset actor cấp được trọn (`keysActorCannotGrant` rỗng) — ADMIN không thấy SUPER_ADMIN.
    - `PUT /accounts/:id/permissions` (`UUID_PARAM` từ `common/validation/uuid-param.ts`, guard `no-bare-parse-uuid-pipe`), body `UpdateAccountPermissionsRequestDto { permissions: string[] }` (`@IsArray()`, `@IsString({ each: true })` — key ngoài registry để service trả 400 có `fieldErrors.permissions`; nếu dùng `@IsIn(PERMISSION_KEYS, { each: true })` thì câu đã có trong `BUILT_IN_MESSAGES` — chọn một, assert field ở e2e) → trả `AccountPermissionSummaryDto` của target sau khi lưu. Mọi tên route/field/operationId tiếng Anh (guard `no-vietnamese-api-contract`).
  - [x] `cd backend && npm run openapi:gen` (drift-guard `openapi.json`). Registry KHÔNG đổi ⇒ không cần `permissions:gen` (nếu lỡ đổi registry: chạy cả `npm run permissions:gen` lẫn `cd design-system && npm run build:permissions` — memory 2 lần regen).
  - [x] E2E `backend/test/accounts-permissions.e2e.spec.ts` (`initAppOnLoopback`, ValidationPipe thật, mock Prisma như các e2e khác): 403 khi thiếu `permissions.manage` cả 3 route; `GET /accounts` không có `passwordHash` + tập key ⊆ contract; `permission-options` của ADMIN không có preset SUPER_ADMIN và `audit.read` có `grantable: false`; PUT key lạ ⇒ 400 `fieldErrors[0].field === 'permissions'`; PUT hai tổ hợp TD-65 ⇒ 400 có câu phụ thuộc; PUT self ⇒ 403; PUT `:id` không phải UUID ⇒ 400 câu tiếng Việt; PUT hợp lệ ⇒ 200 + body summary.
  - [x] DB lane `backend/test/account-permissions.db.integration.spec.ts` (Postgres 5433): (a) A và B cùng preset THO_KS; sửa A ⇒ B nguyên vẹn (AC #3); (b) **interleaving thật** theo CONVENTIONS "Khoá dòng": tx giữ khoá đã `deleteMany`+`createMany` bộ X cho target nhưng chưa commit, lời gọi service với bộ Y chạy song song ⇒ sau cả hai, `account_permissions` của target **đúng bằng** Y (assert danh sách key cuối, không đo thời gian); đột biến gỡ `FOR UPDATE` ⇒ ĐỎ (bộ trộn X∪Y hoặc P2002); (c) ADMIN thu quyền một account trong lúc account đó (là actor khác) đang lưu — ít nhất một ca chứng minh quyền actor đọc dưới khoá (đột biến đọc actor qua `this.prisma` ngoài tx ⇒ ĐỎ; nếu ca không với tới được cửa sổ ngắn thì ghi rõ và phủ bằng unit mock-forced — memory "DB race test can't reach a short pre-tx window"); (d) target không tồn tại ⇒ 404, không ghi gì; (e) audit log có đúng 1 dòng `AccountPermissionsChanged` sau lưu thành công.
- [x] **T4 — Web** (AC: #1, #2, #4–#7, #9)
  - [x] `cd web && npm run api:gen`.
  - [x] Port `web/src/design-system/session/accounts-port.ts` (`listAccounts()`, `getPermissionOptions()`, `updatePermissions(id, permissions)`; type = alias type sinh từ `schema.d.ts`) + `fake-accounts-port.ts` (chỉ test; fake trả khác nhau mỗi lần), export `session/index.ts`; adapter `web/src/api/http-accounts-port.ts` qua client sinh; ráp trong `web/src/main.tsx`; test `web/src/test/http-accounts-port.test.ts` theo khuôn `http-dashboard-port.test.ts`; cập nhật `composition-root.test.ts` (đếm adapter 15 → 16).
  - [x] `web/src/app/routes.ts`: `NAV_ROUTES.permissions = '/permissions'` (sidebar entry `permissions` đã có, `requires: PERM.permissionsManage`, đang ẩn vì chưa có route — `Sidebar.tsx:113`); nối route trong `AppRoutes.tsx` bằng `gate('permissions', …)`. Cập nhật có chủ đích `app-routes.test.tsx` nếu đang coi "Phân quyền" là mục ẩn.
  - [x] `web/src/screens/permissions/PermissionsScreen.tsx` (+ `permissions.css`, mọi className tĩnh phải có rule thật): topbar eyebrow "QUẢN TRỊ" + "Phân quyền & tài khoản"; cột trái `Frame` "Tài khoản" (row chọn được, nhãn preset `matchingPreset` → label từ `presets`/"Tuỳ chỉnh", "Đã vô hiệu" khi `!isActive`); cột phải `Card` "Quyền của account": nút "Áp preset role" (menu chọn preset từ `presets`; nạp vào state nháp), nút **Lưu** (`variant="primary"`), `Banner` info "Áp preset chỉ nạp giá trị mặc định…" như mockup, lưới `Checkbox` theo `group`; ô `grantable: false` disable; account `editable: false` ⇒ toàn bộ chỉ đọc + `Banner` `readOnlyReason`; `Banner` cảnh báo phụ thuộc tính từ `requires` của options (đây là hiển thị dữ liệu backend trả, không phải luật mới) và disable Lưu khi còn thiếu; lỗi lưu hiện câu backend. Không dựng nút "Tạo account" (Story 8.3) và không dựng bảng "Ma trận Quyền × 6 role" của mockup (không có AC — ghi epics). Đổi account khi có thay đổi chưa lưu: bỏ nháp (đơn giản), ghi rõ trong Dev Notes nếu chọn khác.
  - [x] Ca render trong `web/src/test/screens-render.test.tsx` (guard đếm file màn) + `web/src/test/permissions-screen.test.tsx`: chọn account ⇒ tick đúng; áp preset ⇒ ô đổi nhưng `updatePermissions` CHƯA gọi; Lưu gửi đúng mảng; hai tổ hợp TD-65 ⇒ banner + Lưu disabled; ô `grantable:false` disabled; account `editable:false` chỉ đọc; lỗi 403 từ port ⇒ câu lỗi hiện, ô giữ nguyên; trả lời cũ khi đổi account nhanh không đè (vé).
  - [x] Text-guard `design-system/screens/permissions.test.mjs`: màn web + cubit/state mobile không chứa literal quyền dạng `'xxx.yyy'` khớp registry (đọc key từ `backend/openapi/permissions.json`), không tự so tập quyền actor (cấm `can(` / `perms.has(` để quyết `grantable`/`editable` trên màn này — dữ liệu đó từ backend), nhãn chung hai nền tảng ("Phân quyền & tài khoản", "Áp preset role", "Lưu"); có assert chống-guard-rỗng + mẫu sanity; đột biến chèn literal `'audit.read'` vào màn web / cubit mobile ⇒ ĐỎ.
- [x] **T5 — Mobile (Cubit)** (AC: #1, #2, #4–#7, #9)
  - [x] `cd mobile && dart run tool/generate_api.dart`.
  - [x] Port `mobile/lib/design_system/session/accounts_port.dart` (`typedef` type sinh — guard composition root) + `fake_accounts_port.dart`; adapter `mobile/lib/api/http_accounts_port.dart` (đổi `ApiError` 400/403 → exception mang `message` + `fieldErrors` ở một chỗ, khuôn `fieldErrorMap` của customers); `AppPorts` + `main.dart`; `test/api/http_accounts_port_test.dart`.
  - [x] Router: `kPermissionsPath = '/permissions'` + `permissionAccountPath(id)` trong `app_routes.dart`, `kNavRoutes['permissions']`; `kMobileMenu` thêm `AppNavLink(key: 'permissions', label: 'Phân quyền', subtitle: 'Tài khoản & quyền', icon: 'ic-permissions', requires: AppPermissionKeys.permissionsManage)` — key/requires khớp web (guard `menu-nav-parity.test.mjs`). Dùng `AppPermissionKeys.x`, KHÔNG `AppPerm.x` (ghost-key guard).
  - [x] `mobile/lib/screens/permissions/`: `account_list_{screen,cubit,state}.dart` (danh sách + nhãn preset) và `account_permissions_{screen,cubit,state}.dart` (topbar "Quyền · {tên}" + Lưu, card tên + nhãn preset, nút "Áp preset role" mở `AppSheet` chọn preset, banner info, checklist `AppCheckbox` dạng list-row, banner phụ thuộc + disable Lưu, chỉ đọc khi `editable == false`). Cubit giữ `draft` (Set key) tách khỏi `saved`; quay lại danh sách sau lưu ⇒ danh sách đọc lại (khuôn callback `Future` của 10.8). Không dựng nút "Xem ma trận quyền × role".
  - [x] Tests: `bloc_test` cho cả hai cubit theo checklist project-context (đầu / thành công / lỗi port / đóng sớm cả nhánh thành công lẫn lỗi; seed mọi field khác mặc định; kỳ vọng field-by-field bằng constructor, không `copyWith`; fake trả khác nhau mỗi lần; áp preset không gọi port; lưu lỗi giữ `draft`); widget test hai màn (wiring màn ↔ cubit, hai tổ hợp TD-65 ⇒ banner + Lưu disabled, ô không cấp được disabled, chỉ đọc); ca tháo màn khi port còn chờ (gom vào `test/app/unmount_while_port_pending_test.dart` nếu đó là chỗ gom); cập nhật `app_routes_test.dart` (Menu có/không mục Phân quyền theo quyền).
- [x] **T6 — Tài liệu + cổng** (AC: tất cả)
  - [x] `epics.md` Story 8.2: ghi quyết định giữa story — TD-65 xử lý bằng **chặn** (bảng phụ thuộc ở `accounts/domain`, backend 400 + UI disable Lưu), cộng `catalog.view` cho `quotes.create_edit`; cấm tự sửa quyền mình; preset trả từ `GET /accounts/permission-options`, không lưu role trên account; bỏ bảng "Ma trận Quyền × 6 role" và nút "Xem ma trận quyền × role" của mockup. (`H-7` trong sprint-status đã `done` — không sửa.) `backend/CONVENTIONS.md` mục Permission registry: thêm một dòng về `PERMISSION_REQUIRES` (8.4 dùng tiếp).
  - [x] Chạy đủ 5 lane: `cd backend && npm test && npm run test:db`; `cd design-system && npm test`; `cd web && npm run typecheck && npm test && npm run build`; `cd mobile && flutter analyze && flutter test`. Lint backend đỏ sẵn — chỉ chịu eslint/prettier sạch trên file mình chạm.
  - [x] Smoke web (luật 13): backend local cổng riêng + JWT secret tạm; 2 account smoke riêng có SĐT (một ADMIN, một THO_KS); ADMIN mở `/permissions`, chọn THO_KS, áp preset Kế toán ⇒ ô đổi, bỏ `customers.manage` khi còn `quotes.create_edit` ⇒ banner + Lưu disabled, sửa lại rồi Lưu ⇒ reload thấy đúng; account smoke THO_KS đăng nhập lại thấy quyền mới qua `/me`; không thấy preset Super Admin; reload giữ phiên; đăng xuất. Smoke emulator (chỉ emulator mình bật, cold boot `-no-snapshot`, tắt đúng serial): Menu → Phân quyền → lưu một thay đổi. Dọn account smoke, kill đúng PID.

## Dev Notes

### Luật dự án (Trợ Lý, Epic 8) — bắt buộc

Toàn văn ở `_bmad-output/story-automator/extra-instructions-8-review.txt` — đọc trước khi code. Áp trực tiếp cho story này: (3) màn web mới vào `screens-render.test.tsx`; (4) màn mobile mới có widget test; (5) source-guard mới có assert chống-guard-rỗng; (6) e2e dùng `initAppOnLoopback`; (7) không push, `git add` đường dẫn cụ thể, `package-lock.json` `-f`; (8) code + contract tiếng Anh, chuỗi hiển thị tiếng Việt; (11) quyết định giữa story vào `epics.md` cùng commit; (13) smoke đăng nhập thật bằng account riêng có SĐT, không đọc `.env`; (17) chỉ kill PID/serial mình bật; (18) Cubit + bloc_test checklist + guard "màn không gọi port" phủ màn mới (đột biến chứng minh); (19) key quyền chỉ từ registry, giữ luật không-leo-thang 2.10, gate theo QUYỀN, xử lý TD-65. Luật (1)(2)(9)(20) không áp (không ghi đơn/tồn kho/tiền).

### Quyết định phạm vi (đọc trước khi code)

- **Không có role trên Account.** `schema.prisma` `model Account` không có cột role và `role-presets.ts` nói rõ preset là hằng số (AD-8, Open Question #3). Nhãn "Thợ khảo sát" ở danh sách mockup ⇒ backend tính `matchingPreset` (tập quyền bằng đúng một preset) hoặc `null` ⇒ màn hiện "Tuỳ chỉnh". Không thêm migration.
- **Áp preset là thao tác client trên state nháp**, dữ liệu preset từ backend (`permission-options.presets`). Không có endpoint "apply preset" — lưu luôn là `PUT …/permissions` với bộ đầy đủ (thay thế toàn bộ, khuôn `setForAccount` có sẵn). Lý do: AC "nạp giá trị rồi cho tick/bỏ" ⇒ người dùng phải sửa được trước khi lưu.
- **Ai cấp được gì do backend nói.** `grantable` (per key), `editable` + `readOnlyReason` (per account), danh sách `presets` đã lọc — cùng hàm domain `permission-escalation.ts` mà service dùng để chặn. Client chỉ hiển thị (AD-2) — không viết lại luật 2.10 ở web/mobile.
- **TD-65 — chọn CHẶN.** Epic cho phép "cảnh báo hoặc ẩn/hạ cấp màn phụ thuộc". Chỉ cảnh báo vẫn để lưu được tổ hợp gây 403 giữa luồng; ẩn/hạ cấp phải sửa màn Cấu hình + Tạo báo giá ở cả hai nền tảng (lan scope). Chặn ở một chỗ (domain + 400) là chặt nhất và nhỏ nhất. Bằng chứng phụ thuộc: `customer-sources.controller.ts:62` `GET /customer-sources` gate `customers.manage` mà màn Cấu hình (`CustomerSourceConfigScreen.tsx:202` `port.list(true)`) gọi; `CreateQuoteScreen` dùng `customersPort` (tra/tạo khách — `customers.controller.ts` toàn `customers.manage`) và `catalogPort.listProducts/listGroups` (`catalog.view`; lỗi bị nuốt thành danh sách rỗng ⇒ hỏng im lặng). Mọi preset hiện có đã thoả (THO_KS, QUAN_LY, ADMIN, SUPER_ADMIN có đủ cả `customers.manage` + `catalog.view`; KE_TOAN/THI_CONG/KHO_GIAO không có `quotes.create_edit`/`settings.manage`). Account cũ đang vi phạm không bị sửa tự động — chỉ bị chặn khi lưu lần sau (banner hiện ngay khi mở).
- **Không tự sửa mình.** Chỉ có một SUPER_ADMIN (seed); tự bỏ `permissions.manage` = không ai cấp lại được. Rẻ, an toàn; sửa quyền của mình phải nhờ người khác có đủ quyền.
- **Ngoài phạm vi:** tạo/sửa/vô hiệu hoá account, nút "Tạo account" (8.3); quyền hành động/duyệt mới (8.4); màn Audit (8.5); bảng "Ma trận Quyền × 6 role" (mockup web) và nút "Xem ma trận quyền × role" (mockup mobile) — không có AC, ghi `epics.md`. Phiên đang mở của account bị đổi quyền: guard đọc quyền tươi mỗi request (`permissions.guard.ts:75`) ⇒ backend có hiệu lực ngay; UI của người đó cập nhật khi `/me` tải lại (G-2/TD-9 chấp nhận — không push realtime).

### Trạng thái hiện tại các file sẽ sửa (đã đọc)

- `backend/src/accounts/account-permissions.service.ts`: `listForAccount` (đọc) + `setForAccount` (validate registry → luật #2 → luật #1 → `$transaction([deleteMany, createMany?])` → publish sau commit). **Lỗ hổng:** không khoá dòng (memory "Atomic replace needs FOR UPDATE": `setForAccount` "not yet assessed") — READ COMMITTED làm hai lần lưu đồng thời trộn bộ quyền hoặc P2002 ⇒ 500; quyền actor/target đọc NGOÀI tx (TOCTOU); target không tồn tại ⇒ FK P2003 ⇒ 500. T2 sửa cả ba. Giữ: thứ tự kiểm, comment luật #2 ("kiểm bộ HIỆN TẠI của target"), guard `createMany` rỗng, publish sau commit, payload event chỉ id + key.
- `backend/src/accounts/accounts.service.ts`: chỉ `findByPhone`/`findById`/`updatePasswordHash`; comment ghi "CRUD đầy đủ thuộc Epic 8 — không thêm method chưa có người gọi" ⇒ method list mới có người gọi (controller) là hợp lệ. KHÔNG thêm create/update account (8.3).
- `backend/src/accounts/accounts.module.ts`: chưa có controller. Export giữ nguyên (auth, dashboard đang import).
- `backend/src/accounts/domain/role-presets.ts`: 7 preset, `SUPER_ADMIN` = ADMIN + `audit.read` + `system.feature_flags`. Không đổi nội dung preset.
- `backend/src/accounts/domain/permission-escalation.ts`: `keysActorCannotGrant`, `keysBlockingActorFromTarget` — tái dùng cho `grantable`/`editable`/lọc preset, không viết lại.
- `web/src/design-system/shell/Sidebar.tsx:113`: `{ key: 'permissions', icon: 'ic-permissions', label: 'Phân quyền', requires: PERM.permissionsManage }` đã có trong nhóm Quản trị; ẩn vì `AVAILABLE_NAV_KEYS` (routes.ts) chưa có `permissions`. Không sửa `SIDEBAR_NAV`.
- `web/src/app/routes.ts`: `NAV_ROUTES` = home, orders, customers, inventory, warranty, settings, profile. Thêm `permissions` SAU `settings` (thứ tự sidebar) — `landingPath` không đổi vì `home` đứng đầu.
- `mobile/lib/design_system/shell/app_menu_nav.dart`: `kMobileMenu` = customers, warranty, profile. Thêm `permissions` trước `profile` (thứ tự web: Quản trị trước Hồ sơ).
- Component có sẵn: web `Checkbox`, `Banner`, `Card`, `Frame`, `Button`, `Sheet`, `Skeleton`, `ErrorState`, `EmptyState`; Flutter `AppCheckbox` (`checkbox.dart`), `AppBanner`, `AppCard`, `AppSheet`, `AppButton`, … — đọc props trước khi dùng, không tạo component mới trừ khi thiếu thật (AD-13).

### Kiến trúc phải tuân

- AD-8: quyền trên account là nguồn chân lý; preset chỉ nạp. AD-17: key qua `PERM.x` (backend), `PERMISSION_KEYS.x` (web), `AppPermissionKeys.x` (mobile); nhãn từ registry. AD-4: backend enforce, UI ẩn chỉ là UX. AD-5: lỗi qua central filter, `fieldErrors` qua `AppException`. AD-18: publish sau commit, không gọi audit trực tiếp. AD-12: OpenAPI sinh từ code, regen web + mobile cùng commit. AD-1: controller không chạm Prisma.
- Contract mới tiếng Anh: routes `accounts`, `accounts/permission-options`, `accounts/{id}/permissions`; fields `displayName, phone, email, isActive, permissions, matchingPreset, editable, readOnlyReason, key, label, group, requires, grantable, presets`; operationId từ tên handler tiếng Anh (`list`, `permissionOptions`, `updatePermissions`). Giá trị enum preset (`THO_KS`, …) là mã nghiệp vụ có sẵn — giữ.
- Thứ tự khoá: story chỉ khoá `accounts` (không chạm `orders`/`products`) ⇒ không xung đột thứ tự toàn hệ thống; khoá nhiều account luôn `ORDER BY id`.

### Testing — bẫy đã biết (memory dự án)

- Khoá dòng: `Promise.all` hai lời gọi và "giữ khoá trần rồi assert chưa xong" đều **xanh giả** khi gỡ `FOR UPDATE`; insert `account_permissions` lấy `FOR KEY SHARE` trên `accounts` (FK) ⇒ holder phải **ghi** `account_permissions` (deleteMany+createMany) chưa commit, rồi assert danh sách key cuối.
- Mock `$transaction` phải chạy callback (mockRejected/không chạy thân tx che bug thứ tự publish); `publish` assert `toHaveBeenCalledTimes(1)`.
- Prisma 7: `createMany` rỗng giữ guard; P2003 chỉ ở INSERT và là `DriverAdapterError` không tag — dùng 404 kiểm dưới khoá thay vì bắt P2003.
- Đột biến bắt buộc: gỡ `FOR UPDATE` ⇒ DB (b) ĐỎ; đọc quyền target qua `this.prisma` ngoài tx ⇒ unit ĐỎ; bỏ kiểm self-edit ⇒ unit + e2e ĐỎ; bỏ từng entry `PERMISSION_REQUIRES` (mỗi entry một mutant: settings→customers, quotes→customers, quotes→catalog) ⇒ unit + e2e ĐỎ; bỏ lọc preset theo actor ⇒ e2e ĐỎ; `grantable: true` cố định ⇒ e2e ĐỎ; web/mobile bỏ disable Lưu khi thiếu phụ thuộc ⇒ test màn ĐỎ; áp preset gọi luôn port ⇒ test màn/bloc ĐỎ; màn mobile gọi `widget.port.x` ⇒ `no_port_call_in_screens_test` ĐỎ. Backup `cp`, khôi phục `cp` + `cmp`, KHÔNG `git checkout`; mutant phải compile; không pipe lệnh mutant; grep chuỗi đã chèn trước khi tin "sống".
- Text-guard soi chuỗi: `stripToCode` xoá cả string literal — guard soi literal quyền phải đọc raw; nhãn lồng (`'Lưu'` nằm trong câu dài hơn) phải khớp literal đứng riêng. Guard text đọc màn mobile qua `readMobileScreen` (cả `*_cubit.dart`/`*_state.dart`), và mỗi màn đọc đúng file logic của chính nó.
- Web vitest: Node 24 `localStorage` che jsdom ⇒ `memoryStorage()`. Web `.tsx` lỗi cú pháp có thể lọt guard text ⇒ luôn chạy `npm run typecheck`.
- Cubit: `Equatable` bỏ state trùng ⇒ fake trả khác nhau mỗi lần; xoá từng `x: state.x` một (carry-over sweep) — seed mọi field khác mặc định; `go_router` `pushReplacement` làm rơi future của `push` ⇒ pop rồi push.
- Smoke: `test:db` xoá sạch `pns-postgres` ⇒ seed account smoke bằng SQL/Prisma SAU `test:db`; hook scout chặn `node dist/main` ⇒ `npm run start:prod`; `uiautomator dump` xoá `/sdcard/ui.xml` trước mỗi lần.

### Project Structure Notes

- Mới: `backend/src/accounts/{accounts.controller.ts,domain/permission-dependencies.ts,dto/*.ts}`; `backend/test/{permission-dependencies.spec.ts,accounts-permissions.e2e.spec.ts,account-permissions.db.integration.spec.ts}`; `web/src/screens/permissions/{PermissionsScreen.tsx,permissions.css}`; `web/src/design-system/session/{accounts-port.ts,fake-accounts-port.ts}`; `web/src/api/http-accounts-port.ts`; `web/src/test/{permissions-screen.test.tsx,http-accounts-port.test.ts}`; `mobile/lib/screens/permissions/{account_list,account_permissions}_{screen,cubit,state}.dart`; `mobile/lib/design_system/session/{accounts_port,fake_accounts_port}.dart`; `mobile/lib/api/http_accounts_port.dart`; mobile tests tương ứng; `design-system/screens/permissions.test.mjs`.
- Sửa: `backend/src/accounts/{accounts.module.ts,accounts.service.ts,account-permissions.service.ts,domain/role-presets.ts}`, `backend/test/{account-permissions.service.spec.ts,role-presets.spec.ts}`, `backend/openapi/openapi.json` (sinh), `backend/CONVENTIONS.md`, `web/src/api/generated/schema.d.ts` (sinh), `mobile/lib/api/generated/**` (sinh), `web/src/{main.tsx,app/routes.ts,app/AppRoutes.tsx,design-system/session/index.ts}`, `web/src/test/{screens-render.test.tsx,composition-root.test.ts,app-routes.test.tsx}`, `mobile/lib/{main.dart,app/app_ports.dart,app/app_routes.dart,design_system/shell/app_menu_nav.dart}`, mobile app tests, `design-system/components/menu-nav-parity.test.mjs` (nếu đếm mục), `epics.md`, `sprint-status.yaml`.
- File code tên tiếng Anh, kebab-case (TS) / snake_case (Dart). `git check-ignore` mọi file mới trước khi add (gotcha `.git/info/exclude`, `assets/`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2] — AC gốc + ghi chú bắt buộc H-7/TD-65; #Story 8.4 (cùng khuôn phụ thuộc), #Story 8.5 (cấp `audit.read` qua màn này)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md] — FR-16, FR-17, FR-18
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md] — AD-4, AD-8, AD-17, AD-18
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-permissions] — dòng 4733-4888 (web 2 cột + phone)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md] — dòng 30 (Menu → Phân quyền), 49, 83 (ma trận), 144-150, 182-183
- [Source: _bmad-output/implementation-artifacts/epic-10-retro-2026-10-23.md] — TD-65 (dòng 147), H-7 (dòng 208)
- [Source: _bmad-output/implementation-artifacts/2-4-registry-quyen-chinh-tac-luu-quyen-theo-account.md], [2-10-luat-khong-leo-thang-quyen-source-guard-require-permissions.md] — registry, `setForAccount`, luật không-leo-thang
- [Source: _bmad-output/implementation-artifacts/8-1-dashboard-van-hanh.md] — khuôn port/adapter/cubit/guard màn mới Epic 8
- [Source: backend/CONVENTIONS.md#Khoá dòng & test đồng thời (Epic 6)] — dòng 182-188
- [Source: _bmad-output/project-context.md] — Testing (checklist cubit), Critical Don't-Miss

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (controller: backend, web, design-system, docs, smoke) + fork cùng model (mobile T5).

### Debug Log References

- Preset ADMIN không có `orders.view_own` ⇒ theo luật 2.10 nguyên văn Admin không cấp được preset Thợ KS/Thi công/Kho, không sửa được account mang `view_own`. Đại Ca chốt phương án A: `PERMISSION_IMPLIES` (`orders.view_all` ⇒ `orders.view_own`) chỉ trong luật leo thang. Ghi `epics.md`.
- Admin xem account Super Admin: preset SUPER_ADMIN bị lọc khỏi `presets` ⇒ client không tra được nhãn ⇒ thêm `matchingPresetLabel` (backend tính) vào summary.
- `health.spec.ts` dùng `/accounts` làm route không tồn tại ⇒ đổi sang `/no-such-route`.
- Mobile: `(a, b).wait` bọc lỗi trong `ParallelWaitError` ⇒ màn hiện câu chung thay câu backend; test bắt, sửa ở cubit.
- Prettier mặc định đổi nháy kép + định dạng lại file web cũ ⇒ khôi phục 6 file từ HEAD, áp lại đúng phần sửa; file mới định dạng `--single-quote --print-width 120` như code xung quanh.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Backend:** `role-presets.ts` thêm `ROLE_PRESET_KEYS`/`ROLE_PRESET_LABELS`/`matchingPreset`; `permission-dependencies.ts` (`PERMISSION_REQUIRES`, `missingDependencies`, `dependencyMessage`); `permission-escalation.ts` thêm `PERMISSION_IMPLIES`/`grantableBy`. `setForAccount` chuyển sang interactive tx: key lạ (400 `fieldErrors.permissions`) → tự sửa (403) → khoá `accounts` FOR UPDATE `ANY(…::text[]) ORDER BY id` → 404 → đọc quyền actor + target qua `tx` → luật #2 → luật #1 → phụ thuộc (400 `PERMISSION_DEPENDENCY`) → deleteMany + createMany (giữ guard rỗng) → publish sau commit. `summaries`/`summary`/`permissionOptions` đặt trong `AccountPermissionsService` (chỗ sở hữu bảng quyền; `AccountsService` không đổi). `AccountsController`: `GET /accounts`, `GET /accounts/permission-options`, `PUT /accounts/:id/permissions` (`UUID_PARAM`), mọi handler `permissions.manage`. Body DTO `@IsArray @IsString({each})`, key lạ do service trả 400.
- **Web:** port/fake/adapter accounts, route `/permissions` gate `permissions`, `PermissionsScreen` 2 cột (danh sách | thẻ quyền), sheet preset chỉ nạp nháp, banner phụ thuộc + Lưu disabled, ô `grantable:false` disabled, `editable:false` chỉ đọc + `readOnlyReason`, lỗi lưu hiện câu backend giữ nguyên ô, vé chống trả lời cũ khi đổi account. Đổi account thì bỏ nháp.
- **Mobile (Cubit):** port/fake/adapter (`AccountsPortException`), route `/permissions` + `/permissions/:id`, mục Menu "Phân quyền" (`AppPermissionKeys.permissionsManage`), `account_list_*` + `account_permissions_*` (topbar "Quyền · {tên}" + Lưu, sheet preset, banner, checklist, chỉ đọc). Quay lại danh sách sau lưu ⇒ đọc lại. Ca tháo màn khi port còn chờ nằm trong test màn (file gom `unmount_while_port_pending_test.dart` chỉ chứa màn auth/session).
- **Tests:** backend unit (`permission-dependencies`, `role-presets`, `permission-escalation`, `account-permissions.service` — mock tx chạy callback, publish `toHaveBeenCalledTimes(1)`), e2e 17 ca, DB lane 5 ca (A/B cùng preset; interleaving holder ghi chưa commit ⇒ đúng bộ Y; thu quyền actor đang lưu ⇒ 403; 404; đúng 1 dòng audit). Web: adapter 4, màn 10, render + routes. Mobile: adapter 5, cubit 26, màn 12, routes 4. Design-system: `permissions.test.mjs` (7) + parity Menu.
- **Đột biến (cp backup, cmp khôi phục, không git checkout):** backend 11/11 ĐỎ (gỡ FOR UPDATE ⇒ DB đỏ 2 ca; đọc actor trước khoá ⇒ DB + unit đỏ; đọc target qua `this.prisma` ⇒ unit đỏ; bỏ self-edit ⇒ unit + e2e; bỏ lọc preset ⇒ e2e; `grantable: true` ⇒ e2e; bỏ từng entry phụ thuộc ×3 ⇒ unit + e2e). Web 4/4 ĐỎ (Lưu không chặn phụ thuộc, preset gọi port, bỏ `grantable`, trả lời lưu cũ đè). Text-guard: literal quyền chèn vào màn web, `perms.has(` ở web, literal trong 2 cubit mobile ⇒ ĐỎ. Mobile 16/17 ĐỎ (màn gọi port ⇒ `no_port_call_in_screens_test` đỏ); 1 sống: bỏ `if (isClosed) return;` sau lưu — tương đương (nhánh lỗi tự nuốt emit-sau-close, như 11.1).
- **Lane (2026-10-23):** backend `npm test` 2624/2624 (+ e2e sau sửa lint 17/17); `npm run test:db` 335/335; design-system 531/531; web typecheck + 476/476 + build; mobile `flutter analyze` sạch + 1401/1401. ESLint sạch trên file backend đã chạm (lint toàn repo đỏ sẵn).
- **Smoke web** (backend `npm run start` cổng 3182 JWT tạm, vite 5182, 2 account smoke có SĐT, argon2id): Admin đăng nhập ⇒ `/dashboard`; reload `/permissions` giữ phiên; nhãn Admin/Thợ khảo sát; sheet preset không có Super Admin; ô Audit/Cờ disabled; áp Kế toán + tick báo giá + bỏ khách hàng ⇒ banner «Tạo/sửa báo giá» cần thêm «Quản lý khách hàng». + Lưu disabled; tick lại ⇒ Lưu; reload thấy "Tuỳ chỉnh"; `/me` của thợ = Kế toán + `quotes.create_edit`; thợ gọi `GET /accounts` ⇒ 403; account của mình "Đây là tài khoản của bạn." chỉ đọc; đăng xuất về `/login`. Console chỉ lỗi favicon 404 (sẵn có).
- **Smoke emulator** (Pixel_9_Pro cold boot `-no-snapshot`, serial `emulator-5590` do em bật, không thiết bị nào khác; backend cổng 3183): đăng nhập ⇒ Trang chủ; Menu → Phân quyền ⇒ danh sách; mở Thợ ⇒ "Quyền · Smoke Thợ 8.2"; sheet 6 preset; áp Đội thi công + tick báo giá ⇒ banner «Tạo/sửa báo giá» cần thêm «Xem danh mục vật tư», «Quản lý khách hàng». + Lưu không bấm được; bỏ tick ⇒ Lưu ⇒ nhãn "Đội thi công", quay lại danh sách đã đọc lại; DB = `construction.transition` + `orders.view_own`; mở lại app giữ phiên; đăng xuất qua Menu. Dọn: gỡ app, `adb -s emulator-5590 emu kill`, kill đúng PID backend/vite, xoá account smoke, xoá `.playwright-mcp/`. Output biên dịch backend (gitignore) do `nest start` sinh còn lại.
- Báo cáo mobile chi tiết: `plans/reports/mobile-261023-1548-story-8-2-permissions-report.md`. Chưa commit/push.

### File List

- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/planning-artifacts/epics.md
- backend/CONVENTIONS.md
- backend/openapi/openapi.json
- backend/src/accounts/account-permissions.service.ts
- backend/src/accounts/accounts.module.ts
- backend/src/accounts/domain/permission-escalation.ts
- backend/src/accounts/domain/role-presets.ts
- backend/test/account-permissions.service.spec.ts
- backend/test/health.spec.ts
- backend/test/permission-escalation.spec.ts
- backend/test/role-presets.spec.ts
- design-system/components/menu-nav-parity.test.mjs
- mobile/lib/api/generated/export.dart
- mobile/lib/api/generated/pns_api_client.dart
- mobile/lib/app/app_ports.dart
- mobile/lib/app/app_routes.dart
- mobile/lib/app/signed_in_app.dart
- mobile/lib/design_system/shell/app_menu_nav.dart
- mobile/lib/main.dart
- mobile/test/app/app_routes_test.dart
- mobile/test/app/pns_app_test.dart
- mobile/test/app/signed_in_app_test.dart
- mobile/test/app/support/app_harness.dart
- web/src/api/generated/schema.d.ts
- web/src/app/AppRoutes.tsx
- web/src/app/routes.ts
- web/src/design-system/session/index.ts
- web/src/main.tsx
- web/src/test/app-routes.test.tsx
- web/src/test/composition-root.test.ts
- web/src/test/screens-render.test.tsx
- backend/src/accounts/accounts.controller.ts
- backend/src/accounts/domain/permission-dependencies.ts
- backend/src/accounts/dto/account-permission-summary.dto.ts
- backend/src/accounts/dto/permission-options-response.dto.ts
- backend/src/accounts/dto/update-account-permissions-request.dto.ts
- backend/test/account-permissions.db.integration.spec.ts
- backend/test/accounts-permissions.e2e.spec.ts
- backend/test/permission-dependencies.spec.ts
- design-system/screens/permissions.test.mjs
- mobile/lib/api/generated/accounts/accounts_client.dart
- mobile/lib/api/generated/accounts/accounts_client.g.dart
- mobile/lib/api/generated/models/account_permission_summary_dto.dart
- mobile/lib/api/generated/models/account_permission_summary_dto.g.dart
- mobile/lib/api/generated/models/permission_option_dto.dart
- mobile/lib/api/generated/models/permission_option_dto.g.dart
- mobile/lib/api/generated/models/permission_options_response_dto.dart
- mobile/lib/api/generated/models/permission_options_response_dto.g.dart
- mobile/lib/api/generated/models/role_preset.dart
- mobile/lib/api/generated/models/role_preset_option_dto.dart
- mobile/lib/api/generated/models/role_preset_option_dto.g.dart
- mobile/lib/api/generated/models/update_account_permissions_request_dto.dart
- mobile/lib/api/generated/models/update_account_permissions_request_dto.g.dart
- mobile/lib/api/http_accounts_port.dart
- mobile/lib/design_system/session/accounts_port.dart
- mobile/lib/design_system/session/fake_accounts_port.dart
- mobile/lib/screens/permissions/account_list_cubit.dart
- mobile/lib/screens/permissions/account_list_screen.dart
- mobile/lib/screens/permissions/account_list_state.dart
- mobile/lib/screens/permissions/account_permissions_cubit.dart
- mobile/lib/screens/permissions/account_permissions_screen.dart
- mobile/lib/screens/permissions/account_permissions_state.dart
- mobile/test/api/http_accounts_port_test.dart
- mobile/test/screens/permissions/account_list_cubit_test.dart
- mobile/test/screens/permissions/account_list_screen_test.dart
- mobile/test/screens/permissions/account_permissions_cubit_test.dart
- mobile/test/screens/permissions/account_permissions_screen_test.dart
- mobile/test/screens/permissions/held_accounts_port.dart
- web/src/api/http-accounts-port.ts
- web/src/design-system/session/accounts-port.ts
- web/src/design-system/session/fake-accounts-port.ts
- web/src/screens/permissions/PermissionsScreen.tsx
- web/src/screens/permissions/permissions.css
- web/src/test/http-accounts-port.test.ts
- web/src/test/permissions-screen.test.tsx
- _bmad-output/implementation-artifacts/8-2-man-phan-quyen-ma-tran-per-account-ap-preset-role.md

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 5.5 cho Đại Ca (bmad-story-automator-review + /ck:code-review, 2 code-reviewer subagents for web and mobile) · **Date:** 2026-10-23 · **Outcome:** Approve (after fixes)

**Git vs File List:** khớp (`.githooks/`, `docs/*.xlsx` không thuộc story; `_bmad-output/**` loại khỏi review).

**AC:** 1–9 IMPLEMENTED. AC1 "nhóm theo `group`" hiểu là thứ tự liền nhóm, không tiêu đề (mockup phẳng; 16 nhóm / 22 quyền; `group` không có nhãn) — ghi `epics.md` 8.2.

**Kiểm luật dự án:** (1)(2)(9)(20) không áp (không ghi đơn/tồn/tiền). Khoá `accounts` FOR UPDATE: đột biến lại lane DB — gỡ `FOR UPDATE` ⇒ 2 ĐỎ; bỏ actor khỏi tập khoá ⇒ 1 ĐỎ (ca thu quyền actor); bỏ target ⇒ 4 ĐỎ. (21) `PERMISSION_IMPLIES` chỉ trong luật leo thang — đã ghi `epics.md` 8.2.

**Findings (đã sửa hết):**
- [MEDIUM] Mobile gửi nguyên `draft` (gồm key lưu trên account mà không còn trong registry) — web lọc theo `options` ⇒ account mang key cũ bị kẹt 400 vĩnh viễn trên mobile. Sửa: `account_permissions_cubit.dart` gửi theo thứ tự ma trận, chỉ key có trong `options`; test key lạ không được gửi.
- [MEDIUM] Web: đổi account khi đang lưu ⇒ lỗi lưu của account cũ bị nuốt im lặng; trả lời muộn đè ô vừa tick sau A→B→A. Sửa: `PermissionsScreen.tsx` disable danh sách account khi `saving` (bỏ `selectedRef`); test hàng bị khoá + lỗi hiện đúng account.
- [LOW] Mobile: quay lại khi đang lưu ⇒ danh sách đọc lại trước khi lưu commit (nhãn preset cũ). Sửa: `PopScope(canPop: !saving)` + nút back bỏ qua khi đang lưu; widget test.
- [LOW] Mobile: áp preset giữ banner lỗi lưu cũ (web xoá). Sửa: `applyPreset` xoá `saveError`.
- [LOW] Web: câu phụ thuộc nhiều quyền thiếu khác thứ tự backend (comment "TWIN" sai). Sửa: sắp gap + key thiếu theo key; test hai gap.
- [LOW] Test xanh giả: draft sau lưu lấy từ phản hồi backend (web + mobile) — fake trả đúng bộ đã gửi. Sửa: phản hồi khác bộ gửi.
- [LOW] Vé tải web (`loadTicket`) không có test — thêm ca StrictMode mount đôi.
- [LOW] Nhánh lỗi của vé tải (2 cubit mobile) không có test — thêm ca tải cũ lỗi sau tải mới.
- [LOW] Adapter mobile thiếu ca mất mạng — thêm.
- Không sửa (đã xét): lưu bộ trùng bộ cũ vẫn ghi audit (bản ghi đúng hành động admin, vô hại); câu key lạ trộn Anh-Việt có từ 2.4 (ngoài phạm vi).

**Đột biến sau sửa (cp backup, cmp khôi phục):** web 4/4 ĐỎ (hàng không khoá, bỏ vé tải, bỏ sort key thiếu, bỏ draft từ phản hồi); mobile 7/7 ĐỎ (lọc key, xoá lỗi khi áp preset, chặn back, PopScope, vé lỗi danh sách, vé lỗi ma trận, draft từ phản hồi) — đã xác nhận đỏ do assert, không do lỗi biên dịch.

**Lane sau sửa (2026-10-23):** backend `npm test` 2624/2624; `npm run test:db` 335/335 (backend không đổi sau lần chạy); design-system 531/531; web typecheck + 482/482 + build; mobile `flutter analyze` sạch + 1407/1407. Smoke web/emulator: không chạy lại — các sửa là khoá UI khi đang lưu, phủ bằng widget/vitest + đột biến; smoke đầu-cuối của dev còn hiệu lực cho luồng chính.

## Change Log

- 2026-10-23: Senior Developer Review (AI) — 0 HIGH, 2 MEDIUM, 9 LOW; all fixed (web rows locked while saving, mobile back blocked while saving, mobile sends registry keys only, preset clears save error, dependency sentence order = backend, stronger tests). Status → done.
- 2026-10-23: Story 8.2 implemented — permissions screen (web + mobile Cubit), `/accounts` API with row-locked save, permission dependency table (TD-65 blocked), self-edit refused, `orders.view_all` covers `orders.view_own` for escalation, `matchingPresetLabel` in the summary contract. Status → review.
