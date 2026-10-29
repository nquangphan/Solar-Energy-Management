---
baseline_commit: cef52d64b3469bd00a08d35fd537ae83bf754883
---

# Story 8.4: Cấu hình ma trận quyền hành động & duyệt

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Admin,
I want mỗi quyền chuyển trạng thái và quyền duyệt là một mục ma trận cấu hình được,
so that phân quyền linh hoạt không hardcode.

## Acceptance Criteria

1. **Mỗi bước chuyển trạng thái + duyệt gate bằng đúng một entry registry, không gate thứ hai chép tay.** Given `ALLOWED_TRANSITIONS` (`orders/domain/allowed-transition.ts`), When một bước được đánh giá ở bất kỳ cửa nào (engine `applyTransition`, `buocKeTiep`, `coTheHuy`, gate route), Then quyền của bước = `rule.requires` — một key trong `PERMISSIONS`, tick/bỏ được per-account ở ma trận 8.2 (`grantable` theo luật không-leo-thang). Gate cửa `POST /orders/:id/transition` **suy từ bảng** (tập `requires` của các dòng có `event ∈ SU_KIEN_THU_CONG`), không còn danh sách ba `PERM.x` chép tay ở controller. Duyệt / từ chối chiết khấu gate `discounts.approve`; `discounts.apply` không thay được. Không đường nào trong `backend/src` quyết quyền theo tên role/preset (`ROLE_PRESETS`/`RolePreset`/`'SUPER_ADMIN'` chỉ sống ở `accounts/`) — có source-guard (FR-18, AD-8, AD-11, AD-17).
2. **Hai phạm vi xem đơn là hai entry tường minh.** Given registry, When khai báo, Then `orders.view_all` ("Xem tất cả đơn") và `orders.view_own` ("Chỉ xem đơn của mình") là hai entry riêng có trong `permissions.json`, `PERM` web, `AppPermissionKeys` mobile và cả hai hiện thành hai ô trong ma trận — test ghim (dùng test có sẵn nếu đã phủ; không thì thêm) (FR-18, AD-17).
3. **Mọi chiết khấu cần người có quyền duyệt, không hạn mức tự quyết.** Given đơn `baogia` được áp chiết khấu (`discounts.apply`), When người áp không có `discounts.approve`, Then đơn ở `choduyet`, `POST /:id/resolve-discount` của người đó ⇒ 403; `POST /:id/confirm` từ `choduyet` chỉ thành công khi approval mới nhất là `dong_y`; **không** có đường nào (số tiền nhỏ, % nhỏ, người áp có quyền chốt) tự chuyển approval sang `dong_y` hay chốt thẳng đơn đang có chiết khấu chờ duyệt. Test ghim từng nhánh (dùng ca có sẵn của 4.7 nếu đã phủ — liệt kê tên ca trong Dev Agent Record; thiếu nhánh nào thì thêm) (FR-18, PRD Non-goals "không hạn mức tự quyết").
4. **Ma trận cho Admin thấy mỗi quyền điều khiển bước nào.** Given `GET /accounts/permission-options`, When trả `permissions`, Then mỗi `PermissionOptionDto` có thêm `transitions: Array<{ event, from, to }>` = MỌI dòng `ALLOWED_TRANSITIONS` có `requires === key`, đúng thứ tự bảng (rỗng với quyền không điều khiển bước nào). Web + mobile hiện một dòng phụ dưới nhãn quyền khi mảng không rỗng: `Chuyển: Báo giá → Đã chốt · Chờ duyệt → Đã chốt` (nhãn trạng thái lấy từ `STATUS_LABELS` của `StatusChip.tsx` / `kStatusLabels` của `status_chip.dart` có sẵn — `thicong` = "Đang thi công"; key lạ ⇒ `—`; cặp `from → to` trùng nhau chỉ hiện một lần). Client không tự suy bước nào cần quyền nào (AD-2) (FR-18).
5. **Quyền hành động phải kèm quyền đọc mà luồng của nó cần — chặn như TD-65 (H-7).** Given bảng phụ thuộc `accounts/domain/permission-dependencies.ts`, When lưu bộ quyền (`PUT /accounts/{id}/permissions`), Then:
   - Thêm khái niệm **"cần ít nhất một trong"** (`PERMISSION_REQUIRES_ANY`): mỗi quyền hành động trên đơn — `quotes.create_edit`, `orders.confirm`, `discounts.apply`, `construction.transition`, `delivery.confirm`, `payments.record`, `contracts.generate`, `invoices.manage`, `inventory.manage` — cần ít nhất một trong `orders.view_all`, `orders.view_own` (mọi màn của các luồng này mở từ danh sách/chi tiết đơn gate `RequireAnyPermissions(view_all, view_own)`; thiếu cả hai ⇒ 403 ngay bước đầu). Trước khi chốt danh sách, dev **xác minh từng key** bằng cách lần route web + mobile của luồng tới endpoint đầu tiên nó gọi; key nào có luồng chạy trọn không cần đơn thì bỏ khỏi danh sách và ghi bằng chứng (file:dòng) vào Dev Notes.
   - Thêm vào `PERMISSION_REQUIRES` (AND, có sẵn): `discounts.approve` cần `orders.view_all` (hàng chờ duyệt lọc theo phạm vi xem đơn — `listPendingDiscounts` dùng `dieuKienPhamVi`; người duyệt chỉ `view_own` không bao giờ thấy yêu cầu của người khác); `catalog.manage` cần `catalog.view` (màn danh mục liệt kê qua `GET /products`, `/product-groups` gate `catalog.view`).
   - Thiếu ⇒ 400 `fieldErrors.permissions`, một câu mỗi quyền thiếu: phần AND như cũ, phần ANY là `một trong «X», «Y»` — vd «Chốt đơn» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình». · «Duyệt chiết khấu» cần thêm «Xem tất cả đơn». · «Tạo/sửa báo giá» cần thêm «Quản lý khách hàng», một trong «Xem tất cả đơn», «Chỉ xem đơn của mình». UI (web + mobile) hiện banner cùng câu, Lưu disabled (khuôn 8.2). `PermissionOptionDto` thêm `requiresAnyOf: string[]` (rỗng = không ràng buộc). **Mọi** `ROLE_PRESETS` thoả bảng mới (test). Account cũ đang vi phạm không bị sửa tự động — bị chặn ở lần lưu sau (như 8.2).
6. **Không hồi quy, đủ cổng.** Gate thực thi không đổi với mọi preset (đơn, chiết khấu, thanh toán, kho, hợp đồng, hoá đơn chạy y như trước); `buocKeTiep`/`coTheHuy`/stepper không đổi kết quả; fixture test cũ nào lưu bộ quyền nay vi phạm bảng phụ thuộc thì sửa fixture cho đúng luật mới (không nới luật). 5 lane xanh; OpenAPI + client sinh web/mobile regen cùng commit; quyết định giữa story ghi `epics.md` 8.4 cùng commit (luật 11).

## Tasks / Subtasks

- [x] **T1 — Domain: gate suy từ bảng + bước theo quyền** (AC: #1, #4)
  - [x] `allowed-transition.ts`: export `MANUAL_TRANSITION_PERMISSIONS: readonly PermissionKey[]` = tập `requires` (dedup, giữ thứ tự xuất hiện) của các dòng có `event ∈ SU_KIEN_THU_CONG`. Kỳ vọng hiện tại `[construction.transition, delivery.confirm, payments.record]` — **chạy hàm thật in ra** rồi mới ghim trong test, không gõ tay (memory "handpicked fixture").
  - [x] Cùng file: `transitionsGovernedBy(key: PermissionKey): readonly { event; from; to }[]` — lọc `ALLOWED_TRANSITIONS` theo `requires === key`, giữ thứ tự bảng. Đọc bảng, không chép bảng (AD-11).
  - [x] Unit `backend/test/allowed-transition.spec.ts` (mở rộng): `MANUAL_TRANSITION_PERMISSIONS` = đúng tập suy từ bảng (so với phép lọc độc lập trong test); mọi `rule.requires` ∈ `PERMISSION_KEYS`; `transitionsGovernedBy` của mỗi key gộp lại = đúng toàn bảng (không dòng nào rơi, không dòng nào lặp); key không điều khiển bước nào ⇒ rỗng.
- [x] **T2 — Controller transition dùng tập suy ra** (AC: #1)
  - [x] `orders.controller.ts:880-886`: `@RequireAnyPermissions(...MANUAL_TRANSITION_PERMISSIONS)`; sửa comment khối (lý do gate cửa vẫn đúng: chỉ key của lane thủ công; giờ suy từ bảng nên thêm cạnh thủ công là gate tự theo).
  - [x] `RequireAnyPermissions = (...keys) => SetMetadata(KEY, keys)` (`require-any-permission.decorator.ts`) ⇒ spread mảng runtime hoạt động. Đọc `permissions.guard.ts` xác nhận mảng **rỗng** fail-closed (403/500 lúc khởi động, không mở cửa). Nếu decorator với `[]` mở cửa ⇒ thêm assert `length > 0` lúc nạp module (ném khi bảng mất hết cạnh thủ công) + unit.
  - [x] Guard `no-handler-without-require-permissions.spec.ts` chỉ dò sự có mặt của decorator — chạy lại xác nhận xanh; `no-permission-literal-outside-registry` không ảnh hưởng (không literal mới).
  - [x] E2E `backend/test/orders.e2e.spec.ts` (nơi có sẵn ca `POST /orders/:id/transition`; unit domain ở `order-status-change.spec.ts`): account chỉ có `orders.view_own` + `construction.transition` vẫn qua cửa; account chỉ `quotes.create_edit` + `orders.confirm` + view ⇒ 403 ở cửa (không đổi hành vi). Đột biến: bỏ một key khỏi `MANUAL_TRANSITION_PERMISSIONS` (vd lọc bỏ `payments.record`) ⇒ ca thợ chỉ `payments.record` đóng đơn chỉ-thiết-bị ⇒ ĐỎ.
- [x] **T3 — Source-guard: không quyết quyền theo role** (AC: #1)
  - [x] Mới `backend/test/no-role-based-authorization.spec.ts` (khuôn `no-permission-literal-outside-registry.spec.ts`, dùng helper strip comment có sẵn): cấm `ROLE_PRESETS`, `RolePreset`, `ROLE_PRESET_KEYS`, `matchingPreset`, literal `'SUPER_ADMIN'|'ADMIN'|'QUAN_LY'|'KE_TOAN'|'THO_KS'|'THI_CONG'|'KHO_GIAO'` trong `backend/src/**` **ngoài** `backend/src/accounts/**` (DTO/service accounts dùng hợp lệ để áp/hiển thị preset). Literal role phải đọc RAW (memory "stripToCode xoá string literal") — strip comment chứ không strip chuỗi. Có ca sanity (đoạn code giả dùng `ROLE_PRESETS` ở `orders/` ⇒ offender; comment nhắc `SUPER_ADMIN` ⇒ không offender) + assert chống-guard-rỗng (số file quét > 0, có ít nhất một file `accounts/` chứa token bị cấm để chứng minh scanner thấy được nó). Hiện trạng đã sạch (`grep -rln "RolePreset\|'SUPER_ADMIN'\|ROLE_PRESETS" backend/src | grep -v accounts/` rỗng lúc tạo story). `prisma/seed.ts` ngoài `src/` — không quét. Đột biến: chèn `if (ROLE_PRESETS.ADMIN…)` vào `orders.service.ts` ⇒ ĐỎ.
- [x] **T4 — Bảng phụ thuộc "ít nhất một trong" + entry mới** (AC: #5)
  - [x] `permission-dependencies.ts`: thêm `PERMISSION_REQUIRES_ANY: Partial<Record<PermissionKey, readonly PermissionKey[]>>` (comment tiếng Anh: vì sao — chi tiết/danh sách đơn gate OR hai phạm vi; mỗi entry một lý do ngắn như hai entry TD-65 có sẵn) theo danh sách AC-5 **sau khi** xác minh từng key; thêm vào `PERMISSION_REQUIRES`: `[PERM.discountsApprove]: [PERM.ordersViewAll]`, `[PERM.catalogManage]: [PERM.catalogView]`. Sửa comment đầu file (bảng giờ có hai dạng).
  - [x] `MissingDependency` thêm `missingAnyOf: PermissionKey[]` (rỗng khi đã có ít nhất một, hoặc không ràng buộc; khi thiếu = cả nhóm, giữ thứ tự khai báo trong bảng — `[view_all, view_own]`). `missingDependencies` lọc entry có `missing.length > 0 || missingAnyOf.length > 0`; giữ sort theo key.
  - [x] `dependencyMessage`: `«A» cần thêm ` + các phần nối `, `: từng `«L»` của `missing` (như cũ) rồi, nếu `missingAnyOf` không rỗng, `một trong «X», «Y»`; kết thúc `.`. Câu cũ của hai entry TD-65 **không đổi** khi không có phần ANY (test 8.2 giữ nguyên chuỗi) — nhưng `quotes.create_edit` nay có phần ANY nên câu của nó đổi khi thiếu phạm vi xem; cập nhật kỳ vọng các test 8.2 tương ứng bằng chuỗi in ra từ hàm thật.
  - [x] `account-permissions.service.ts` (`setForAccount` + `permissionOptions`): dùng `missingDependencies` mới (đường 400 không đổi chỗ, chỉ thêm nhánh ANY); `permissionOptions` trả `requiresAnyOf: [...(PERMISSION_REQUIRES_ANY[key] ?? [])]` và `transitions: transitionsGovernedBy(key)`. Lưu ý chiều phụ thuộc module: `accounts` import `orders/domain/allowed-transition.ts` (domain thuần) — `orders/domain` đã import `accounts/domain/permission-registry` ⇒ kiểm không tạo vòng import runtime (chỉ cần `allowed-transition.ts` không import gì của `accounts` ngoài `permission-registry`). Nếu vòng, đặt `transitionsGovernedBy` ở `orders/domain` và để controller/service accounts gọi qua import trực tiếp file domain — không qua `OrdersService`/module Nest.
  - [x] Unit `backend/test/permission-dependencies.spec.ts` (mở rộng): từng key ANY thiếu cả hai phạm vi ⇒ đúng `missingAnyOf`; có `view_own` hoặc `view_all` ⇒ rỗng; `discounts.approve` chỉ `view_own` ⇒ `missing: [view_all]`; `catalog.manage` không `catalog.view` ⇒ gap; câu ghép AND + ANY đúng chuỗi; **mọi** `ROLE_PRESETS` ⇒ `[]`; mọi key (khoá + giá trị) của cả hai bảng ∈ registry; không key nào tự phụ thuộc chính nó.
  - [x] `backend/src/accounts/dto/permission-options-response.dto.ts`: `PermissionOptionDto.requiresAnyOf!: string[]` (`@ApiProperty({ type: [String], description: 'Phải có ít nhất một trong các quyền này (rỗng = không ràng buộc).' })`), `transitions!: PermissionTransitionDto[]` — DTO mới cùng file `{ event: string; from: string; to: string }` (`@ApiProperty` có `type` tường minh — guard `openapi-no-untyped-object`; tên tiếng Anh — guard `no-vietnamese-api-contract`: tên field tiếng Anh, giá trị là mã enum nghiệp vụ có sẵn như `bat_dau_thi_cong`/`thicong` — được phép, giống `StatusChangeRequestDto.event`). `cd backend && npm run openapi:gen`. Registry KHÔNG đổi ⇒ không `permissions:gen`.
  - [x] E2E `backend/test/accounts-permissions.e2e.spec.ts` (mở rộng): `permission-options` — `orders.confirm` có `requiresAnyOf` = `[view_all, view_own]`, `construction.transition` có `transitions` chứa `bat_dau_thi_cong`/`xong_thi_cong`/`hoan_thanh(nghiemthu→hoanthanh)`, `audit.read` có `transitions: []`; tập key mỗi option ⊆ contract (memory "response key-set"). `PUT` bộ `['orders.confirm']` ⇒ 400 đúng câu; `['orders.confirm','orders.view_own']` ⇒ 200; `['discounts.approve','orders.view_own']` ⇒ 400 câu `«Xem tất cả đơn»`.
  - [x] Rà mọi test/DB fixture lưu bộ quyền qua `setForAccount`/`PUT …/permissions` (`grep -rn "setForAccount\|/permissions'" backend/test`): bộ nào nay vi phạm ⇒ thêm quyền phụ thuộc vào fixture (không nới luật). Fixture **ghi thẳng** `account_permissions` qua Prisma (không qua service) không bị ảnh hưởng — để nguyên.
- [x] **T5 — Web** (AC: #4, #5)
  - [x] `cd web && npm run api:gen`. Type `PermissionOption` là alias type sinh (guard composition root) ⇒ tự có `requiresAnyOf`, `transitions`. Cập nhật `fake-accounts-port.ts` (seed thật: vài option có `requiresAnyOf`/`transitions` không rỗng) và fixture test liên quan cho đủ field bắt buộc.
  - [x] `PermissionsScreen.tsx` `dependencyWarnings`: thêm phần ANY y câu backend (thứ tự: AND theo key, rồi `một trong …` theo thứ tự `requiresAnyOf`); gap = có AND thiếu **hoặc** không giữ phần tử nào của `requiresAnyOf` (khi mảng không rỗng). Cập nhật comment dòng 8 + 51.
  - [x] Dòng phụ dưới mỗi `Checkbox` có `transitions.length > 0`: `<span className="perm-transitions">Chuyển: {…}</span>` (rule CSS thật trong `permissions.css` — guard className; token màu muted có sẵn, cỡ chữ nhỏ; không style ad-hoc ngoài token). Nhãn trạng thái từ `STATUS_LABELS` (đã export, `web/src/design-system/components/StatusChip.tsx:22`) — không chép map thứ hai; key lạ ⇒ `—`; cặp `from → to` trùng (hai dòng `chot`… khác `from` thì không trùng) chỉ hiện một lần; nối ` · `. Không đổi `Checkbox` primitive.
  - [x] Tests `web/src/test/permissions-screen.test.tsx`: `dependencyWarnings` — thiếu cả hai phạm vi ⇒ câu ANY; có một ⇒ không câu; AND + ANY ghép đúng chuỗi; Lưu disabled khi gap ANY; dòng "Chuyển: …" hiện đúng nhãn cho option có `transitions`, vắng cho option rỗng; key trạng thái lạ ⇒ `—`. `screens-render.test.tsx` không thêm màn (màn có sẵn) — chạy lại.
- [x] **T6 — Mobile (Cubit có sẵn)** (AC: #4, #5)
  - [x] `cd mobile && dart run tool/generate_api.dart` (máy mới: `dart pub get` trong `mobile/tool/codegen` trước). `typedef` port giữ nguyên ⇒ field mới tự có.
  - [x] `account_permissions_state.dart` `dependencyGaps`: thêm phần ANY y câu backend + web (cùng thứ tự, cùng dấu câu). `canSave` dùng chung getter ⇒ tự chặn.
  - [x] `account_permissions_screen.dart`: dòng phụ "Chuyển: …" dưới ô quyền khi `transitions` không rỗng — nhãn từ `kStatusLabels` (`mobile/lib/design_system/components/status_chip.dart:45`, top-level public) qua enum `StatusKey` (`StatusKey.values.byName` trong try/catch hoặc dò theo `.name`) — không chép map; key lạ ⇒ `—`; text style token có sẵn (`AppTokens`/typography của design system), không hardcode màu/cỡ. Màn chỉ render state (guard `no_port_call_in_screens_test`).
  - [x] `fake_accounts_port.dart` + fixture test cập nhật đủ field. Tests: `bloc_test` / unit cho `dependencyGaps` (thiếu ANY ⇒ câu; có một ⇒ rỗng; ghép AND + ANY; `canSave` false khi gap ANY); widget test màn: dòng "Chuyển: …" hiện đúng nhãn, vắng khi rỗng, key lạ ⇒ `—`. Kỳ vọng field-by-field, fake trả khác nhau mỗi lần (checklist project-context).
- [x] **T7 — Guard parity + tài liệu + cổng** (AC: #4–#6)
  - [x] `design-system/screens/permissions.test.mjs` (đọc mobile qua `readMobileScreen`): literal đứng riêng "Chuyển: " và `một trong ` có mặt ở **cả** web lẫn mobile (neo khớp câu lệnh/literal nguyên văn, không chuỗi con của câu dài hơn — memory "nested label"); màn web + state/screen mobile không chứa literal mã trạng thái tự map nhãn (vd `'thicong'` cạnh `'Thi công'`) — nhãn phải qua map của StatusChip (chọn neo cụ thể, có mẫu sanity + assert chống-guard-rỗng). Đột biến: xoá phần `một trong` khỏi mobile ⇒ ĐỎ; chép map nhãn vào `PermissionsScreen.tsx` ⇒ ĐỎ.
  - [x] `epics.md` Story 8.4 — "Quyết định giữa story" (luật 11): xem mục Quyết định phạm vi dưới đây (diễn giải "cấu hình được", không thêm key mới, gate route suy từ bảng, `PERMISSION_REQUIRES_ANY` + hai entry AND mới, `transitions` trong options, tự duyệt chiết khấu giữ nguyên). Spine: không đổi AD (ghi chú AD-17 không cần sửa).
  - [x] Chạy đủ 5 lane: `cd backend && npm test && npm run test:db`; `cd design-system && npm test`; `cd web && npm run typecheck && npm test && npm run build`; `cd mobile && flutter analyze && flutter test`. Lint backend đỏ sẵn (memory) — chỉ chịu ESLint/Prettier sạch trên file mình chạm.
  - [x] Smoke web (luật 13): backend local cổng riêng + JWT secret tạm trên dòng lệnh (KHÔNG đọc/sửa `.env`), account smoke ADMIN riêng có SĐT; `/permissions` → chọn một thợ → ô "Chuyển bước thi công" hiện "Chuyển: Đã cọc → Đang thi công · Đang thi công → Nghiệm thu · Nghiệm thu → Hoàn thành"; bỏ tick "Chỉ xem đơn của mình" ⇒ banner "… cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình»." + Lưu disabled; tick lại ⇒ lưu được. Smoke emulator (chỉ emulator mình bật, cold boot `-no-snapshot`, `adb -s <serial>`): Menu → Phân quyền → account → thấy dòng "Chuyển: …" + banner tương tự. Không chạy được ⇒ ghi rõ lane chưa chạy, báo Đại Ca. Dọn account smoke, kill đúng PID, tắt đúng serial.

## Dev Notes

### Luật dự án (Trợ Lý, Epic 8) — bắt buộc

Toàn văn `_bmad-output/story-automator/extra-instructions-8-review.txt` — đọc trước khi code. Áp trực tiếp: (3) chạy web lane (màn có sẵn, không thêm ca render); (4)(18) màn mobile sửa vẫn Cubit, widget test + bloc_test theo checklist, guard "màn không gọi port" phủ; (5) source-guard mới có assert chống-guard-rỗng; (6) e2e `initAppOnLoopback`; (7) không push, `git add` đường dẫn cụ thể, `package-lock.json` `-f`; (8) code + contract tiếng Anh, chuỗi hiển thị tiếng Việt; (11) quyết định giữa story vào `epics.md` cùng commit; (13) smoke đăng nhập thật bằng account riêng có SĐT; (17) chỉ kill PID/serial mình bật; (19) key quyền chỉ từ registry, giữ luật không-leo-thang 2.10, gate theo QUYỀN, TD-65 cho quyền hành động. (1)(2)(9)(12)(20) không áp (không ghi đơn/tồn/tiền).

### Quyết định phạm vi (mặc định tuyên bố — ghi `epics.md` 8.4 cùng commit)

- **"Cấu hình được" = tick/bỏ key per-account ở ma trận 8.2, KHÔNG sửa bảng transition lúc chạy.** Đã tuyên bố trước ở retro Epic 7 §7 (`epic-7-retro-2026-10-22.md:225`): sửa `ALLOWED_TRANSITIONS` lúc chạy (bảng DB, màn sửa cạnh) phá AD-11 (một bảng chính tắc trong code, stepper/`buocKeTiep`/`coTheHuy` suy từ nó). Bảng đã khai `requires` bằng key registry ⇒ mỗi bước + duyệt đã là "entry" ma trận. Story này làm cho điều đó **kiểm chứng được và nhìn thấy được**: gate route suy từ bảng (AC-1), guard cấm quyết theo role (AC-1), ma trận hiện bước mỗi quyền điều khiển (AC-4).
- **Không thêm key quyền mới (không tách "Bắt đầu thi công" / "Nghiệm thu"… thành key riêng).** Ma trận PRD FR-18 (`prd.md:258-276`) chính là đặc tả các entry: "Chuyển bước thi công", "Xác nhận giao hàng", "Ghi nhận thanh toán"… — một key mỗi nhánh. Tách key = đổi registry + `permissions.json` + PERM web + AppPermissionKeys mobile + mọi preset + account đang có (migration dữ liệu quyền) — không AC nào đòi. Nếu Đại Ca muốn tách một bước (vd chỉ QL được đóng `nghiemthu → hoanthanh`), đó là story/thay đổi riêng: thêm key, đổi `requires` của đúng dòng, `transitions` trong ma trận tự hiện đúng (AC-4 làm việc đó rẻ).
- **TD-65 cho quyền hành động bằng CHẶN (khuôn 8.2), thêm dạng "ít nhất một trong".** Bảng AND hiện có không diễn đạt được "`view_all` HOẶC `view_own`"; đòi cứng `view_own` sai với preset Kế toán/QL/Admin (chỉ `view_all`, cố ý — 8.2 quyết định `PERMISSION_IMPLIES`). Dùng `PERMISSION_IMPLIES` cho bảng phụ thuộc thì client phải biết thêm bảng implies — `requiresAnyOf` tường minh, một field, client chỉ hiển thị. `discounts.approve` đòi `view_all` (AND) vì hàng chờ duyệt lọc theo phạm vi xem (`orders.service.ts` `listPendingDiscounts` dùng `dieuKienPhamVi`) — người duyệt chỉ `view_own` không thấy yêu cầu của ai khác ⇒ quyền vô dụng. `catalog.manage` đòi `catalog.view`: mọi GET danh mục gate `catalog.view` (`products.controller.ts:110-111,141-142`, `product-groups.controller.ts:63-64,190-191`, `product-prices.controller.ts:38-39`). Mọi preset đã thoả (đọc `role-presets.ts`: mỗi preset có đúng một phạm vi xem; mọi preset có `catalog.manage` đều có `catalog.view`; `discounts.approve` chỉ ở QL/Admin, cả hai `view_all`) — test vẫn bắt buộc.
- **Tự duyệt chiết khấu giữ nguyên hành vi hiện có:** account có cả `discounts.apply` lẫn `discounts.approve` (QL, Admin) duyệt được chiết khấu do chính mình áp. AC chỉ đòi "duyệt bởi account có quyền duyệt", và chặn tự duyệt sẽ khiến Admin/QL (người duyệt duy nhất trong công ty ~20 người) phải chờ người khác. "Không hạn mức tự quyết" = không có ngưỡng tự động duyệt — AC-3 ghim điều đó. Ghi vào câu hỏi mở cho Đại Ca.
- **`transitions` gồm cả cạnh tự động** (`du_coc` của `payments.record`): đó là sự thật — ghi đủ cọc làm đơn chuyển `dachot → dacoc`. Hiển thị chỉ là thông tin, không có nút.
- **Ngoài phạm vi:** sửa bảng transition lúc chạy; key quyền mới; hạn mức chiết khấu tự quyết (Phase sau — PRD `prd.md:509`); bảng "Ma trận Quyền × 6 role" (đã bỏ ở 8.2); màn Audit (8.5); push cho người duyệt (Epic 9 — đã có event `DiscountRequested`).

### Trạng thái hiện tại các file sẽ sửa (đã đọc)

- `backend/src/orders/domain/allowed-transition.ts` (494 dòng): `SU_KIEN` (11 sự kiện, tên tiếng Việt — giữ, không đổi tên symbol cũ), `TransitionRule { event, from, to, requires, scopeGuard? }`, `ALLOWED_TRANSITIONS` (17 dòng), `thoaCoPhamVi`, `evaluateTransition` (thứ tự cố định: bảng → cờ → quyền — KHÔNG đảo), `daTaiDich`, `SU_KIEN_THU_CONG` (5 sự kiện), `buocKeTiep`, `coTheHuy`, `buocVongDoi`. Quyền dùng: `discounts.apply` (áp), `discounts.approve` (từ chối), `orders.confirm` (chốt ×2), `quotes.create_edit` (mở lại, huỷ ×3), `payments.record` (đủ cọc, đóng đơn chỉ-thiết-bị), `construction.transition` (bắt đầu/xong thi công, đóng từ nghiệm thu), `delivery.confirm` (bắt đầu/xong giao ×2, đóng từ đã giao). Code MỚI tên tiếng Anh (`MANUAL_TRANSITION_PERMISSIONS`, `transitionsGovernedBy`).
- `backend/src/orders/orders.controller.ts:880-886`: `@RequireAnyPermissions(PERM.constructionTransition, PERM.deliveryConfirm, PERM.paymentsRecord)` + comment "GATE CỬA đúng BA key mà `SU_KIEN_THU_CONG` thực sự cần" — đây là bản chép tay sẽ thay. Các route khác (`confirm` `orders.confirm`, `reopen`/`cancel` `quotes.create_edit`, `apply-discount` `discounts.apply`, `resolve-discount` + `pending-discount-approvals` `discounts.approve`) là cửa riêng mỗi sự kiện — giữ `@RequirePermissions(PERM.x)` (một key, khớp `requires` của dòng bảng; có thể thêm unit ghim "key route = `requires` của dòng bảng tương ứng" nếu rẻ — đọc metadata qua `Reflector` như e2e có sẵn, không bắt buộc).
- `backend/src/orders/orders.service.ts`: `resolveDiscount` (≈2829) — `findScopedOrThrow` → approval mới nhất → retry cùng decision 200 / ngược 409 → từ chối cần `reason` → tx: cổng atomic trên `DiscountApproval` rồi `applyTransition(tuChoiChietKhau)` ở nhánh từ chối → publish `DiscountResolved` sau commit. Không có kiểm "người duyệt ≠ người áp" (xem quyết định). `listPendingDiscounts` (≈3057) lọc `order: { AND: dieuKienPhamVi }`. `findScopedOrThrow`/`dieuKienPhamVi` (≈1830): thiếu `view_all` ⇒ owner HOẶC assignee — kể cả khi không có `view_own` (route đọc thì 403 ở guard). Không sửa service này.
- `backend/src/accounts/domain/permission-dependencies.ts`: `PERMISSION_REQUIRES` (2 entry), `MissingDependency { key, missing }`, `missingDependencies(keys)` (sort key + sort missing), `dependencyMessage(gap, labelOf)` ⇒ `«A» cần thêm «B», «C».`. Comment "Action/approval permissions added later extend THIS table".
- `backend/src/accounts/domain/permission-escalation.ts`: `PERMISSION_IMPLIES` (`view_all ⇒ view_own`, CHỈ cho luật không-leo-thang) — không dùng cho bảng phụ thuộc, không sửa.
- `backend/src/accounts/account-permissions.service.ts`: `permissionOptions` (≈233) map `PERMISSIONS` → `{ key, label, group, requires, grantable }` + presets cấp trọn được; `setForAccount` gọi `missingDependencies` ⇒ 400 `fieldErrors.permissions` (khoá `accounts` FOR UPDATE, `assertStillManages` dưới khoá — commit `cef52d6`; không đổi thứ tự kiểm).
- `backend/src/accounts/dto/permission-options-response.dto.ts`: `PermissionOptionDto { key, label, group, requires: string[], grantable }`.
- `backend/src/accounts/domain/role-presets.ts`: 7 preset; ADMIN/QUAN_LY/KE_TOAN `view_all`, THO_KS/THI_CONG/KHO_GIAO `view_own`; SUPER_ADMIN = ADMIN + `audit.read` + `system.feature_flags`.
- `web/src/screens/permissions/PermissionsScreen.tsx`: `dependencyWarnings(options, draft)` export (dòng 54-68, câu ghép phía client từ `requires`), checklist `options.permissions.map(<Checkbox label …/>)` (≈266-275), banner warn + Lưu disabled theo `warnings.length`. `permissions.css`: `.perm-checklist`, `.perm-card-body`…
- `mobile/lib/screens/permissions/account_permissions_state.dart:48-73`: getter `dependencyGaps` + `canSave`; `account_permissions_screen.dart:166-223` banner `ValueKey('dependency-gaps')`.
- Map nhãn trạng thái: web `STATUS_LABELS: Record<StatusKey, string>` (`StatusChip.tsx:22`, export sẵn), mobile `kStatusLabels: Map<StatusKey, String>` (`status_chip.dart:45`, public). Cả hai đã dùng được — KHÔNG sửa file design system. Nhãn `thicong` là "Đang thi công".

### Kiến trúc phải tuân

- AD-11 (một bảng transition, mọi thứ suy từ bảng), AD-17 (`PERM.x` / `PERMISSION_KEYS.x` / `AppPermissionKeys.x`, không literal; KHÔNG `AppPerm.x` ở màn mobile — memory), AD-8 (quyền trên account là nguồn chân lý, role chỉ là preset), AD-21 + đường đỏ `settings.manage` (không đụng gate màn Phân quyền — vẫn `permissions.manage`), AD-2 (client hiển thị `requiresAnyOf`/`transitions` backend gửi, không tự suy), AD-4 (ẩn/disable chỉ là UX — 400 ở backend là chặn thật), AD-12 (OpenAPI sinh; regen web + mobile cùng commit), AD-5 (`AppException` + `fieldErrors`).
- Contract mới tiếng Anh: `PermissionOptionDto.requiresAnyOf: string[]`, `PermissionOptionDto.transitions: PermissionTransitionDto[]`, `PermissionTransitionDto { event, from, to }`. Field bắt buộc (luôn có, có thể rỗng) — mobile không cần `sparse_bodies.dart` (response, không phải request).

### Testing — bẫy đã biết (memory dự án)

- Fixture số/chuỗi dẫn xuất (`MANUAL_TRANSITION_PERMISSIONS`, câu `dependencyMessage`, danh sách `transitions` mỗi key) **chạy hàm thật in ra** rồi ghim; test so với phép tính độc lập từ bảng, không chép kết quả từ code đang test.
- Guard mới: ship kèm danh sách biến thể cú pháp nó phải bắt (import `ROLE_PRESETS`, `RolePreset` trong type, literal role trong chuỗi `"SUPER_ADMIN"` nháy kép / template) + đột biến đưa lại thứ thật ⇒ ĐỎ; literal phải đọc raw (stripToCode xoá string literal); assert chống-guard-rỗng.
- Text-guard web↔mobile: nhãn phải là literal đứng riêng; `readMobileScreen` đọc cả `_state.dart` (câu `một trong` nằm ở state); anchor không khớp dòng khai báo/field initializer.
- Permission parity: không thêm key ⇒ không cần `permissions:gen`; nếu lỡ đổi registry thì phải regen cả PERM web lẫn AppPermissionKeys mobile (memory "PERM/AppPerm key parity", "Permission registry needs 2 regens").
- E2E: response key-set ⊆ contract (mock row thiếu field); `initAppOnLoopback`; route tĩnh `permission-options` vẫn khai trước `:id`.
- Mobile: `Equatable` bỏ state trùng ⇒ fake trả khác nhau; kỳ vọng field-by-field (không `copyWith`); `dart format` chỉ `-o none --set-exit-if-changed` hoặc đúng file mình sửa (memory — không cascade).
- Web: Node 24 `localStorage` ⇒ `memoryStorage()`; luôn `npm run typecheck` (lỗi cú pháp `.tsx` lọt guard text); mọi className tĩnh mới có rule CSS thật.
- Đột biến bắt buộc (cp backup, khôi phục `cp` + `cmp`, KHÔNG `git checkout`; mutant phải compile; không pipe lệnh mutant; grep literal đã chèn trước khi tin "sống"): bỏ một key khỏi `MANUAL_TRANSITION_PERMISSIONS` ⇒ e2e ĐỎ; `transitionsGovernedBy` bỏ lọc `requires` ⇒ unit + e2e ĐỎ; bỏ một entry `PERMISSION_REQUIRES_ANY` (mỗi key một lần — memory "mutation một dòng bỏ sót dòng anh em") ⇒ unit ĐỎ; `missingDependencies` bỏ nhánh ANY ⇒ unit + e2e ĐỎ; web/mobile bỏ nhánh ANY ở banner ⇒ test màn ĐỎ; chèn `ROLE_PRESETS` vào `orders/` ⇒ guard ĐỎ; xoá dòng "Chuyển:" ở một nền tảng ⇒ test màn + text-guard ĐỎ. Mutant nào sống ⇒ kiểm tương đương ngữ nghĩa trước (memory) rồi bịt bằng test.
- Smoke: `test:db` xoá sạch `pns-postgres` ⇒ seed account smoke SAU `test:db`; hook scout chặn `node dist/main` ⇒ `npm run start:prod`; `uiautomator dump` xoá `/sdcard/ui.xml` trước mỗi lần.

### Previous Story Intelligence (8.3 + follow-up)

- Khuôn đã chạy: port/fake/adapter accounts, `AccountsPortException`, `held_accounts_port.dart`, vé tải chống trả lời cũ, câu lỗi backend hiện nguyên. Tái dùng, không dựng lại.
- Review 8.3 bắt lỗi "luật chỉ đúng ở preset": test thu gần sạch quyền nên không thấy lỗ thu RIÊNG một key. Áp cho story này: ca phụ thuộc phải thử **từng** key ANY thiếu riêng lẻ, và ca giữ đúng một trong hai phạm vi (không chỉ ca "không có gì").
- Prettier web: file mới `--single-quote --print-width 120`; KHÔNG chạy prettier mặc định lên file cũ. Backend theo prettier của backend.
- Commit follow-up `cef52d6` đưa `assertStillManages` vào `account-permissions.service.ts` dùng chung create/update/setForAccount — giữ thứ tự: khoá → `assertStillManages` → luật #1/#2 → phụ thuộc → ghi.

### Git Intelligence

- `cef52d6 fix(accounts): re-check permissions.manage on the under-lock read…`; `7987202 feat(story-8.3)`; `098df7a feat(story-8.2)` — `permission-dependencies.ts`, `permission-options`, màn ma trận hai nền tảng. Commit theo khuôn `feat(story-8.4): …` tiếng Anh, không tham chiếu AI.

### Project Structure Notes

- Mới: `backend/test/no-role-based-authorization.spec.ts`.
- Sửa: `backend/src/orders/domain/allowed-transition.ts`, `backend/src/orders/orders.controller.ts`, `backend/src/accounts/domain/permission-dependencies.ts`, `backend/src/accounts/account-permissions.service.ts`, `backend/src/accounts/dto/permission-options-response.dto.ts`, `backend/openapi/openapi.json` (sinh), `backend/test/{allowed-transition.spec.ts,permission-dependencies.spec.ts,accounts-permissions.e2e.spec.ts,orders.e2e.spec.ts}` + fixture vi phạm luật mới; `web/src/api/generated/schema.d.ts` (sinh), `web/src/design-system/session/fake-accounts-port.ts`, `web/src/screens/permissions/{PermissionsScreen.tsx,permissions.css}`, `web/src/test/permissions-screen.test.tsx`; `mobile/lib/api/generated/**` (sinh), `mobile/lib/design_system/session/fake_accounts_port.dart`, `mobile/lib/screens/permissions/{account_permissions_state.dart,account_permissions_screen.dart}`, mobile tests tương ứng; `design-system/screens/permissions.test.mjs`; `_bmad-output/planning-artifacts/epics.md`; `sprint-status.yaml`.
- KHÔNG đụng: `permission-registry.ts`, `permissions.json`, 2 file key generated, `role-presets.ts` (chỉ đọc trong test), `permission-escalation.ts`, `evaluateTransition` thứ tự kiểm, `applyTransition`, logic `resolveDiscount`/`applyDiscount`/`confirm`.
- `git check-ignore` file mới trước khi add (gotcha `.git/info/exclude`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.4] — AC gốc + ghi chú H-7/TD-65; #Story 8.2 quyết định giữa story ("Story 8.4 thêm entry vào CÙNG bảng"); Epic 8 header (Mobile BLoC từ đầu)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-18 L250-276] — "quyền chuyển từng Trạng thái và quyền Duyệt … config được, không hardcode"; hai phạm vi xem đơn; mọi chiết khấu cần duyệt, không hạn mức tự quyết; ma trận quyền × preset; L496/L509 hạn mức tự quyết = Phase sau
- [Source: ARCHITECTURE-SPINE.md#AD-8 L91-93, #AD-11, #AD-17 L152-156, #AD-21, bảng Consistency "Đường đỏ settings.manage" L198]
- [Source: _bmad-output/implementation-artifacts/epic-7-retro-2026-10-22.md:225] — diễn giải mặc định "cấu hình được = gán khoá cho account qua ma trận 8.2, không sửa bảng lúc chạy"
- [Source: _bmad-output/implementation-artifacts/epic-10-retro-2026-10-23.md:147,208] — TD-65, H-7
- [Source: _bmad-output/implementation-artifacts/8-2-man-phan-quyen-ma-tran-per-account-ap-preset-role.md] — khuôn bảng phụ thuộc, banner, `permission-options`
- [Source: _bmad-output/implementation-artifacts/8-3-form-tao-sua-vo-hieu-hoa-account.md] — khuôn review, đột biến, smoke
- [Source: _bmad-output/implementation-artifacts/4-7-ap-chiet-khau-duyet-chiet-khau.md] — luồng áp/duyệt chiết khấu, test có sẵn để ghim AC-3
- [Source: backend/src/orders/domain/allowed-transition.ts; backend/src/orders/orders.controller.ts:880-886; backend/src/accounts/domain/{permission-dependencies,permission-escalation,role-presets,permission-registry}.ts; backend/src/accounts/account-permissions.service.ts:233-258] — đọc trực tiếp lúc tạo story
- [Source: _bmad-output/story-automator/extra-instructions-8-review.txt] — luật dự án Epic 8

### Câu hỏi mở (cho Đại Ca — không chặn dev, mặc định đã tuyên bố)

1. Có cấm **tự duyệt** chiết khấu (người áp ≠ người duyệt) không? Mặc định: không cấm (QL/Admin tự áp tự duyệt được).
2. Có cần tách quyền chuyển **từng** bước thành key riêng (vd "Nghiệm thu → Hoàn thành" chỉ QL) không? Mặc định: không — một key mỗi nhánh theo ma trận PRD; tách sau là story riêng.

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, bmad-dev-story)

### Debug Log References

- `@RequireAnyPermissions()` rỗng ⇒ `PermissionsGuard` coi là "chỉ cần đăng nhập" (`permissions.guard.ts:59-63`) ⇒ thêm `manualTransitionPermissions()` ném lúc nạp module khi bảng mất hết cạnh thủ công + unit.
- Fake mobile nhân bản DTO qua `fromJson(o.toJson())`: `toJson` không đệ quy với `transitions` (json_serializable không `explicitToJson`) ⇒ `_TypeError`; sửa clone qua `jsonDecode(jsonEncode(o))` ở `fake_accounts_port.dart` + `held_accounts_port.dart`. Production không ảnh hưởng (Dio đưa Map vào `fromJson`).
- Widget test mobile: fake dài hơn ⇒ ô quyền nằm dưới vùng bị che ⇒ tap trượt; `_tapLabel` thêm `ensureVisible`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- ✅ T1: `MANUAL_TRANSITION_PERMISSIONS` (suy từ bảng, in ra từ hàm thật = `[construction.transition, delivery.confirm, payments.record]`), `manualTransitionPermissions()` ném khi rỗng, `transitionsGovernedBy()` — `backend/src/orders/domain/allowed-transition.ts`; unit trong `allowed-transition.spec.ts`.
- ✅ T2: `POST /orders/:id/transition` gate `@RequireAnyPermissions(...MANUAL_TRANSITION_PERMISSIONS)`; e2e "door gate derived from the table (Story 8.4)" (view_own + construction ⇒ 200; chỉ payments.record đóng đơn chỉ-thiết-bị ⇒ 200; quotes + confirm ⇒ 403 cửa).
- ✅ T3: `backend/test/no-role-based-authorization.spec.ts` — 7 biến thể bắt, 4 biến thể bỏ qua, chống-guard-rỗng (role-presets.ts phải bị phát hiện).
- ✅ T4: `PERMISSION_REQUIRES_ANY` (8 key), AND thêm `discounts.approve → view_all`, `catalog.manage → catalog.view`; `missingAnyOf`; câu ghép AND + "một trong"; `PermissionOptionDto.requiresAnyOf` + `transitions` (`PermissionTransitionDto`); OpenAPI regen. **Xác minh danh sách ANY:** mọi luồng của 8 key là route con `/orders/...` (web `routes.ts` — `ORDER_NEW_PATH`, `orderTransitionPath`, `orderPaymentsPath`, `orderContractsPath`, `orderInvoicesPath`; gate cha `Sidebar.tsx:83` `requiresAny [view_all, view_own]`; mobile `app_menu_nav.dart:30,55`), backend payments/contracts/invoices gate `RequireAnyPermissions(view_all, view_own)` (`payments.controller.ts:50-51`, `contracts.controller.ts:51-52`, `invoices.controller.ts:66-67`). **`inventory.manage` bị loại:** Tồn kho + phiếu nhập chạy trọn không cần đơn — `stock-items.controller.ts:31-32` (`inventory.manage`|`quotes.create_edit`), `stock-vouchers.controller.ts:58-59,133-134`, web `Sidebar.tsx` link `inventory` `requiresAny [inventoryManage, quotesCreateEdit]`, mobile `app_menu_nav.dart:60`.
- ✅ Fixture: 2 ca 8.2 (`quotes.create_edit` thiếu AND) ở `account-permissions.service.spec.ts` + `accounts-permissions.e2e.spec.ts` thêm `orders.view_own` (không nới luật). DB-lane fixtures đã thoả luật mới (đọc từng bộ: KE_TOAN, KHO_GIAO, Y có view_all, …).
- ✅ AC-3 (ca có sẵn 4.7 + 1 ca mới): `orders.e2e.spec.ts` "403 chéo: áp với CHỈ quotes.create_edit; duyệt + list với CHỈ discounts.apply"; `orders.service.spec.ts` "approval còn cho_duyet ⇒ 409 'Chiết khấu chưa được duyệt'", "approval tu_choi (dữ liệu kẹt bất thường) ⇒ 409", "đơn choduyet KHÔNG có approval nào ⇒ 409", "approval dong_y ⇒ cổng where dùng status QUAN SÁT (choduyet)…", "happy: payload từng op — cổng baogia→choduyet, create đúng row approval…" (actor TOAN_QUYEN vẫn `cho_duyet`); **mới:** "no self-approval threshold: a 1-đồng discount by an actor holding every permission still waits as cho_duyet".
- ✅ T5 web: `dependencyWarnings` phần ANY, `transitionsLine` (nhãn từ `STATUS_LABELS`, dedupe cặp, key lạ ⇒ `—`), `.perm-item`/`.perm-transitions` CSS token; fake seed giá trị thật backend; 6 ca test mới.
- ✅ T6 mobile: `dependencyGaps` phần ANY, `permissionTransitionsLine` (qua `statusKeyOf` + `kStatusLabels`), typedef `PermissionTransition`; fake thêm phạm vi xem + `construction.transition`, preset fake khớp preset thật; unit + widget test mới; fixture JSON `signed_in_app_test`/`http_accounts_port_test` đủ field.
- ✅ T7 guard `design-system/screens/permissions.test.mjs`: "một trong "/"Chuyển: " phải MỞ string literal ở cả hai nền tảng; nhãn trạng thái phải qua map StatusChip (map parse từ `StatusChip.tsx`, chống-guard-rỗng ≥10 entry). `epics.md` 8.4 ghi quyết định giữa story.
- **Đột biến (cp backup, khôi phục cmp, mutant đều compile):** bỏ `payments.record` khỏi tập cửa ⇒ e2e ĐỎ; `transitionsGovernedBy` bỏ lọc ⇒ 4 ĐỎ; gỡ TỪNG entry ANY (8 lần) ⇒ unit ĐỎ mỗi lần; gỡ 2 entry AND mới ⇒ ĐỎ; `missingDependencies` bỏ nhánh ANY ⇒ 11 ĐỎ (unit + e2e); chèn `ROLE_PRESETS` vào `orders.service.ts` ⇒ guard ĐỎ; web bỏ nhánh ANY ⇒ 4 ĐỎ, bỏ dòng "Chuyển" ⇒ 1 ĐỎ; mobile bỏ nhánh ANY ⇒ 4 ĐỎ, bỏ dòng "Chuyển" ⇒ 2 ĐỎ; guard: xoá "một trong" mobile / chép map nhãn vào web / xoá "Chuyển:" web ⇒ mỗi cái ĐỎ.
- **5 lane:** backend `npm test` 132 suites / 2730 pass; `npm run test:db` 30 suites / 347 pass; design-system 538/538; web typecheck sạch, vitest 43 files / 517 pass, bundle OK; mobile `flutter analyze` sạch, `flutter test` 1458 pass. ESLint/Prettier: file chạm sạch phần mình sửa (2 lỗi prettier có sẵn ở HEAD trong `allowed-transition.ts:475`, `allowed-transition.spec.ts:682` — không đụng); `signed_in_app_test.dart` chưa dart-format từ HEAD — không format lại.
- **Smoke web** (backend `npm run start` cổng 3084 + JWT secret tạm trên dòng lệnh, vite 5184, 2 account smoke argon2id có SĐT): đăng nhập SĐT ⇒ dashboard; reload `/permissions` giữ phiên; chọn thợ ⇒ "Chuyển bước thi công" hiện "Chuyển: Đã cọc → Đang thi công · Đang thi công → Nghiệm thu · Nghiệm thu → Hoàn thành"; bỏ "Chỉ xem đơn của mình" ⇒ banner «Chuyển bước thi công» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình». + Lưu disabled; tick lại ⇒ Lưu được; curl PUT trực tiếp ⇒ 400 đúng câu (ANY + `discounts.approve` chỉ view_own); đăng xuất ⇒ /login. **Smoke emulator** (Pixel_9_Pro cold boot `-no-snapshot`, serial riêng emulator-5586): Menu → Phân quyền → thợ ⇒ dòng "Chuyển: …"; bỏ view_own ⇒ banner cùng câu, Lưu không bấm được; tick lại ⇒ "Đã lưu quyền.". Dọn: xoá 2 account smoke, kill đúng PID backend/vite/flutter, `emu kill` đúng serial, bật lại `verifier_verify_adb_installs=1` (8.3 để tắt).
- Câu hỏi mở cho Đại Ca giữ nguyên (tự duyệt chiết khấu; tách quyền từng bước) — mặc định đã áp.

### File List

- _bmad-output/implementation-artifacts/8-4-cau-hinh-ma-tran-quyen-hanh-dong-duyet.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/planning-artifacts/epics.md
- backend/openapi/openapi.json
- backend/src/accounts/account-permissions.service.ts
- backend/src/accounts/domain/permission-dependencies.ts
- backend/src/accounts/dto/permission-options-response.dto.ts
- backend/src/orders/domain/allowed-transition.ts
- backend/src/orders/orders.controller.ts
- backend/test/account-permissions.service.spec.ts
- backend/test/accounts-permissions.e2e.spec.ts
- backend/test/allowed-transition.spec.ts
- backend/test/no-role-based-authorization.spec.ts (mới)
- backend/test/orders.e2e.spec.ts
- backend/test/orders.service.spec.ts
- backend/test/permission-dependencies.spec.ts
- design-system/screens/permissions.test.mjs
- mobile/lib/api/generated/export.dart (sinh)
- mobile/lib/api/generated/models/permission_option_dto.dart (sinh)
- mobile/lib/api/generated/models/permission_option_dto.g.dart (sinh)
- mobile/lib/api/generated/models/permission_transition_dto.dart (sinh, mới)
- mobile/lib/api/generated/models/permission_transition_dto.g.dart (sinh, mới)
- mobile/lib/design_system/session/accounts_port.dart
- mobile/lib/design_system/session/fake_accounts_port.dart
- mobile/lib/screens/permissions/account_permissions_screen.dart
- mobile/lib/screens/permissions/account_permissions_state.dart
- mobile/test/api/http_accounts_port_test.dart
- mobile/test/app/signed_in_app_test.dart
- mobile/test/screens/permissions/account_permissions_cubit_test.dart
- mobile/test/screens/permissions/account_permissions_screen_test.dart
- mobile/test/screens/permissions/held_accounts_port.dart
- web/src/api/generated/schema.d.ts (sinh)
- web/src/design-system/components/Checkbox.tsx (review: prop `describedBy`)
- web/src/design-system/session/fake-accounts-port.ts
- web/src/screens/permissions/PermissionsScreen.tsx
- web/src/screens/permissions/permissions.css
- web/src/test/permissions-screen.test.tsx

## Senior Developer Review (AI)

- **Reviewer:** Đại Ca (bmad-story-automator-review + /ck:code-review + một code-reviewer độc lập cho web/mobile) — 2026-10-30
- **Outcome:** Approve sau khi sửa. 0 CRITICAL, 0 HIGH; 2 MEDIUM, 6 LOW — đã sửa hết.
- **Git vs File List:** khớp (thêm `web/src/design-system/components/Checkbox.tsx` do fix review). `.githooks/` + `docs/*.xlsx` untracked không thuộc story.
- **AC:** #1–#6 IMPLEMENTED (đối chiếu code + test). Mọi task [x] có bằng chứng.

### Findings & fixes

1. **[MEDIUM] AC-1 "không gate thứ hai chép tay" chưa kiểm chứng được cho các cửa riêng** — `confirm`/`reopen`/`cancel`/`apply-discount`/`resolve-discount` vẫn `@RequirePermissions(PERM.x)` gõ tay; đổi `requires` một dòng bảng thì cửa lệch mà không test nào đỏ. **Fix:** e2e `every dedicated door gates exactly the requires of its table rows` (`orders.e2e.spec.ts`) đọc metadata `REQUIRE_PERMISSIONS_KEY` của từng handler = tập `requires` của sự kiện trong `ALLOWED_TRANSITIONS` (đúng 1 key), và metadata `REQUIRE_ANY_PERMISSION_KEY` của `transition` = `MANUAL_TRANSITION_PERMISSIONS`. Đột biến `confirm` → `PERM.quotesCreateEdit` ⇒ ĐỎ.
2. **[MEDIUM] a11y (AC-4): dòng "Chuyển: …" web không gắn với ô quyền** — screen reader chỉ đọc nhãn ô. **Fix:** `Checkbox` thêm prop tuỳ chọn `describedBy` → `aria-describedby` trên `<input>` (không đổi hình/hành vi cũ); màn gắn id `perm-steps-<key>`. Test: ô có bước ⇒ description = đúng dòng; ô không bước ⇒ không attribute. Đột biến gỡ wiring ⇒ ĐỎ.
3. **[LOW] Dedupe cặp theo nhãn, không theo key** (web + mobile) — hai key lạ khác nhau cùng đích bị gộp thành một. **Fix:** dedupe theo `from|to` thô; test mới mỗi nền tảng. Đột biến dedupe theo nhãn ⇒ ĐỎ.
4. **[LOW] Guard nhãn trạng thái mù với map không nháy** (`{ thicong: 'Thi công' }`, `{StatusKey.thicong: …}`, `case StatusKey.x:`) **và cấm nhầm nhãn đứng riêng** (nút "Huỷ" hợp lệ sẽ đỏ). **Fix:** `statusLiterals` bắt key ở dạng literal / key-mục-map / case; bỏ cấm nhãn đứng riêng; ca sanity mới. Đột biến chèn map không nháy vào màn web + state mobile ⇒ ĐỎ mỗi cái.
5. **[LOW] Style dòng "Chuyển" lệch nền tảng** — web thiếu `--text-meta-fontweight`, thụt 26px (lệch 1px so với box 18 + gap 9); mobile không thụt. **Fix:** web token weight + 27px có comment nguồn; mobile `left: 27`.
6. **[LOW] Comment dòng quá dài** ở `account-permissions.service.ts` (`permissionOptions`) và header `PermissionsScreen.tsx` — gói lại.
7. **[LOW] Bằng chứng loại `inventory.manage`** nằm ở Completion Notes thay vì Dev Notes như AC-5 nói — chấp nhận (nội dung đủ file:dòng, đã chép vào `epics.md` 8.4); không chuyển chỗ.

### Kiểm luật dự án (đột biến, cp backup + cmp, không git checkout)

- Khoá `FOR UPDATE` ở `setForAccount` (đường chạy kiểm phụ thuộc mới) gỡ ⇒ `account-permissions.db.integration.spec.ts` 3 ĐỎ.
- Guard phạm vi `POST /:id/transition` (cửa vừa đổi gate): `findScopedOrThrow` nhận thêm `view_all` ⇒ unit/e2e 1 ĐỎ, lane DB (`orders-write-scope` + `order-status-change`) 2 ĐỎ.
- Luật (1)(2)(9)(12)(20): không có đường ghi đơn/tồn/tiền mới. (3) màn có sẵn, không thêm ca render. (5) guard mới `no-role-based-authorization` có chống-guard-rỗng (đã đọc). (6) e2e qua `initAppOnLoopback` có sẵn. (8) code + tên test mới tiếng Anh. (19) không đổi registry.

### Lane sau fix

backend `npm test` 132 suites / 2731 pass; `npm run test:db` 30 / 347 pass (trước đột biến); design-system 538/538; web typecheck sạch, vitest 43 files / 518 pass, build OK; mobile `flutter analyze` sạch, `flutter test` 1460 pass. Smoke web/emulator do dev chạy trước review; fix review chỉ là a11y/dedupe/style có test phủ — smoke KHÔNG chạy lại.

## Change Log

- 2026-10-29: Story 8.4 created (bmad-create-story) — Status ready-for-dev.
- 2026-10-30: Story 8.4 implemented (bmad-dev-story) — gate cửa transition suy từ bảng, guard cấm quyết quyền theo role, bảng phụ thuộc "ít nhất một trong" + 2 entry AND, `requiresAnyOf`/`transitions` trong permission-options, dòng "Chuyển: …" + banner ANY trên web/mobile; 5 lane xanh, smoke web + emulator. Status → review.
- 2026-10-30: Code review (story-automator-review) — 2 MEDIUM + 6 LOW, sửa hết (pin cửa riêng = `requires` của bảng, `aria-describedby` dòng Chuyển, dedupe theo key, guard map nhãn không nháy, style token); Status → done.
