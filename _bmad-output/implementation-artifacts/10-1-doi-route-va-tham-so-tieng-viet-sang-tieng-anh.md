---
baseline_commit: a1a4edc
---

# Story 10.1: Đổi route và tham số tiếng Việt sang tiếng Anh

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a lập trình viên client,
I want mọi route và tham số API là tiếng Anh trước khi web/mobile gọi thật,
so that không phải đổi contract (breaking change) sau khi đã có consumer.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-22, sau commit `a1a4edc`, lô chuẩn bị G-3/G-4 đã xong)

- **Story này là refactor contract thuần, chỉ ở backend.** Không đổi DB, không đổi enum value, không đổi hành vi. 0 consumer HTTP: web có 13 port + fake, mobile có 11 port + fake, **không ai gọi `fetch`/`dio`** ⇒ đổi cứng, không alias (mặc định §6.4).
- **`openapi.json` hôm nay** (`jq -r '.paths|keys[]' backend/openapi/openapi.json`): 59 path, có **15 path tiếng Việt** + `/customers/{sdt}` = 16 dòng của bảng §4.2. Tham số tên `sdt` có **4 chỗ**: path `GET|PATCH /customers/{sdt}` và query `GET /customers/lookup?sdt=` + `GET /orders/tra-cuu-bao-hanh?sdt=`.
- **Nơi khai route:**
  - `backend/src/orders/orders.controller.ts` (`@Controller('orders')`): `@Get('cho-duyet-chiet-khau')` :209, `@Get('tra-cuu-bao-hanh')` :246, `@Get(':id/vong-doi')` :335, `@Get(':id/phien-ban')` :366, `@Post(':id/chot')` :438, `@Post(':id/mo-lai')` :486, `@Post(':id/ap-chiet-khau')` :525, `@Post(':id/duyet-chiet-khau')` :569, `@Post(':id/xuat-bao-gia')` :723, `@Get(':id/bao-gia/anh')` :764, `@Get(':id/bao-gia/pdf')` :796, `@Post(':id/chuyen-trang-thai')` :849, `@Post(':id/huy')` :915, `@Get(':id/anh')` :1093, `@Post(':id/anh')` :1130, `@Delete(':id/anh/:attachmentId')` :1186, `@Get(':id/anh/:attachmentId')` :1226.
  - `backend/src/customers/customers.controller.ts`: `@Get('lookup')` :106 (query `LookupCustomerQueryDto.sdt`), `@Get(':sdt')` :129 + `@ApiParam({ name: 'sdt' })` :131 + `@Param('sdt')` :150, `@Patch(':sdt')` :154 + `@ApiParam` :156 + `@Param('sdt')` :176.
  - Query DTO: `backend/src/orders/dto/warranty-lookup-query.dto.ts` (`sdt`), `backend/src/customers/dto/lookup-customer-query.dto.ts` (`sdt`). Query DTO **không** sinh `components.schemas` — Nest swagger trải field thành `parameters[]` ⇒ guard field của 10.2 (soi `components.schemas`) KHÔNG BAO GIỜ thấy hai tham số này. Vì vậy cả hai thuộc 10.1.
  - `payments/`, `payment-schedules/`, `contracts/`, `invoices/`, `inventory/` cũng `@Controller('orders')` hoặc riêng, nhưng **route của chúng đã tiếng Anh** — không đụng.
- **operationId tiếng Việt** (`jq '[.paths[][]|.operationId]'`): Nest swagger đặt `operationId = <Controller>_<tên method handler>`. Sáu cái tiếng Việt: `OrdersController_traCuuBaoHanh` (:261), `OrdersController_chuyenTrangThai` (:885), `OrdersController_huyDon` (:941), `StockItemsController_lietKe` (`inventory/stock-items.controller.ts:44`), `StockVouchersController_lietKe` (`inventory/stock-vouchers.controller.ts:152`), `StockVouchersController_chiTiet` (:178). Bộ sinh Dart dự kiến ở 10.6 (`swagger_parser`) đặt tên method theo operationId ⇒ đây là contract. Không test nào gọi các handler này theo tên (đã grep `test/`); service method (`OrdersService.traCuuBaoHanh`, `huyDon`…) KHÔNG đổi.
- **Bẫy thứ tự route Nest (so theo thứ tự khai):** `pending-discount-approvals` và `warranty-lookup` là route TĨNH, phải nằm TRƯỚC `@Get(':id')` (giữ đúng vị trí hiện tại, chỉ đổi chuỗi). `customers/lookup` phải nằm trước `:phone` (comment :102 + e2e `customers.e2e.spec.ts:403`).
- **Bẫy "route cũ ⇒ 404":**
  - Route cũ **có thêm segment** (`POST /orders/:id/chot`, `GET /orders/:id/vong-doi`, `/anh`…) không khớp handler nào ⇒ Nest ném `NotFoundException` qua filter toàn cục ⇒ envelope `NOT_FOUND` (`all-exceptions.filter.ts:142`). Guard JWT **không chạy** vì không route nào khớp ⇒ 404 kể cả khi không có token. Chưa có e2e nào chứng minh chuyện này, nên story phải đo, không được giả định.
  - Route cũ **tĩnh một segment** `GET /orders/cho-duyet-chiet-khau` và `GET /orders/tra-cuu-bao-hanh` sau khi đổi sẽ **bị `@Get(':id')` nuốt** (`id = 'tra-cuu-bao-hanh'`). Hệ quả: không token ⇒ **401**, có token có quyền xem ⇒ `getScoped` tra `orders.id` (cột `String`, không `@db.Uuid` — `schema.prisma:473`) ra null ⇒ **404 NOT_FOUND "không tìm thấy đơn"**. Vẫn là 404 envelope chuẩn, nhưng e2e cho hai route này PHẢI gọi kèm account có `orders.view_*`, nếu không sẽ thấy 401 và tưởng AC gãy.
  - `GET|PATCH /customers/{sdt}` → `{phone}` chỉ đổi **tên** tham số, hình dạng URL giữ nguyên ⇒ `/customers/0912345678` vẫn chạy đúng. AC "route cũ ⇒ 404" **không áp** cho dòng này.
  - Query cũ `?sdt=` lên route mới: `ValidationPipe` có `whitelist: true`, **không** `forbidNonWhitelisted` (`common/validation/validation-pipe.factory.ts:17`) ⇒ `sdt` bị cắt lặng, `phone` thiếu ⇒ **400 `VALIDATION_ERROR`, `fieldErrors[].field = 'phone'`**. Đây là ca e2e thật cho "tham số mới tên `phone`".
- **Field multipart `anh`** (`FilesInterceptor('anh', …)` ở :857 và :1139; field `anh` trong `StatusChangeRequestDto`) KHÔNG có trong bảng §4.2 và không phải route/tham số URL ⇒ **giữ nguyên trong 10.1**, chuyển cho 10.2 quyết (xem Câu hỏi mở 1). Đổi route `/anh` → `/attachments` không đụng tên field form.
- **Guard/test đang so chuỗi route** (phải cập nhật, không được nới):
  - `backend/test/orders-read-gate.spec.ts:77-86` — `ROUTE_DOC_MO_QUYEN_XEM` là HỢP ĐỒNG 7 khoá (`'Get :id/vong-doi'`, `'Get :id/phien-ban'`, `'Get :id/anh/:attachmentId'`, `'Get :id/anh'`, `'Get tra-cuu-bao-hanh'`…), regex đọc decorator trong controller; :99 lặp `[':id', ':id/vong-doi', ':id/phien-ban']`. Đổi đúng sang khoá mới, KHÔNG thêm/bớt khoá.
  - `backend/test/openapi-drift.spec.ts:118, 233-234` (`/customers/{sdt}`), `:358-370` (`xuat-bao-gia`, `bao-gia/anh`, `bao-gia/pdf`).
  - e2e: `orders.e2e.spec.ts` (~139 chỗ, gồm danh sách fail-closed :444+ và tên `describe`), `customers.e2e.spec.ts` (13), `order-stock-issue.e2e.spec.ts` (:518, :597, :614), `invoices.e2e.spec.ts` (:712-716), `contracts.e2e.spec.ts` (:802-806), `orders-detail-scope.db.integration.spec.ts:252` (tên test).
  - `design-system/session/parity.test.mjs:181, 194, 251` — chỉ là chuỗi thông báo assert (`POST :id/chot`…), sửa chữ.
- **Comment/doc nhắc route cũ** (sửa đúng token route, KHÔNG viết lại cả comment, KHÔNG dịch comment tiếng Việt có sẵn): `backend/src/**` ~22 file (DTO header như `warranty-lookup-response.dto.ts:4`, `orders.service.ts:279,1325,1488,1557,1656,1820`, `customers.service.ts:62`, `allowed-transition.ts:302-306`, `is-absent.decorator.ts:4`…); `web/src/design-system/session/{orders-port,warranty-port,fake-orders-port}.ts`; `mobile/lib/design_system/session/{orders_port,warranty_port,fake_orders_port}.dart`. Không đổi chữ ký/hành vi client nào.
- **KHÔNG phải route API — để nguyên:** `web/src/screens/orders/CreateQuoteScreen.tsx:580` (`url="app.phuongnamsolar.vn/bao-gia/tao-moi"`) và `DiscountApprovalScreen.tsx:117` là thanh địa chỉ giả của khung demo; `mobile/test/.../order_status_change_screen_test.dart:112` (`/tmp/anh-$i.jpg`) là tên file. Enum/khoá sự kiện `chot`, `mo_lai`, `huy`, `ap_chiet_khau`, hằng `MO_LAI_GATE_THUA` (`orders.service.ts:337`) là mã nghiệp vụ/nội bộ — giữ (mặc định §6.6). ERD trong spine (`chotAt`, `sdt PK` :285, :299) là cột DB — giữ (§6.7).
- **Docs còn ví dụ route cũ (G-5, cùng commit):** `backend/CONVENTIONS.md:14` (`/orders/{id}/chot`, `/huy`, `/tra-cuu-bao-hanh` "giữ tới khi refactor riêng"); spine `ARCHITECTURE-SPINE.md:187` (câu cuối "Route tiếng Việt cũ đổi ở Story 10.1/10.2"); `_bmad-output/project-context.md:87` ("contract cũ tiếng Việt giữ tới khi refactor riêng"). Spine AD-12 (:125) và mục Deferred codegen (:574) **đã** được correct-course cập nhật — không đụng.

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Bảng đổi tên = nguồn chân lý, cộng hai tinh chỉnh ghi lại theo G-5.** Đổi đúng 16 dòng §4.2 của `sprint-change-proposal-2026-10-22.md`. Thêm hai mục mà bảng sót (Jev 0.98, khớp luật "tham số" + "tinh chỉnh phải ghi vào bảng cùng commit"):
1. `GET /customers/lookup?sdt=` → `?phone=` (query param thứ ba; guard 10.2 không thấy được, lý do ở §1).
2. Sáu operationId tiếng Việt → tiếng Anh bằng cách **đổi tên method handler trong controller** (không đổi service):

| Handler cũ | Handler mới ⇒ operationId |
|---|---|
| `OrdersController.traCuuBaoHanh` | `warrantyLookup` ⇒ `OrdersController_warrantyLookup` |
| `OrdersController.chuyenTrangThai` | `transition` ⇒ `OrdersController_transition` |
| `OrdersController.huyDon` | `cancel` ⇒ `OrdersController_cancel` |
| `StockItemsController.lietKe` | `list` ⇒ `StockItemsController_list` |
| `StockVouchersController.lietKe` | `list` ⇒ `StockVouchersController_list` |
| `StockVouchersController.chiTiet` | `findOne` ⇒ `StockVouchersController_findOne` |

Hai mục này PHẢI được thêm vào bảng §4.2 của proposal (một khối "Tinh chỉnh 10.1") trong CÙNG commit story.

**D2 — Không alias, không redirect, không deprecation header.** 0 consumer (mặc định §6.4). Route cũ biến mất khỏi controller và khỏi spec.

**D3 — Đổi decorator, giữ nguyên mọi thứ khác trên handler.** Cùng vị trí khai (thứ tự route), cùng `@RequirePermissions`/`@RequireAnyPermissions`, cùng `@HttpCode`, `@UseInterceptors`, `ParseUUIDPipe` (nếu có), `@Api*` response. Biến cục bộ `@Param('sdt') sdt` đổi thành `@Param('phone') phone` (code đang sửa ⇒ tên tiếng Anh); `@ApiParam({ name: 'phone', … })` giữ description/example.

**D4 — Guard mới `backend/test/no-vietnamese-api-contract.spec.ts`** (hermetic, lane `npm test`):
- Đọc **file commit** `openapi/openapi.json` (drift-guard đã chứng minh file = code; guard này chỉ soi nội dung).
- Ba danh sách cấm, khai thành hằng trong file test:
  - `OLD_PATH_SEGMENTS = ['cho-duyet-chiet-khau','tra-cuu-bao-hanh','anh','ap-chiet-khau','duyet-chiet-khau','bao-gia','xuat-bao-gia','chot','chuyen-trang-thai','huy','mo-lai','phien-ban','vong-doi']` — so theo **segment nguyên** (`path.split('/')`, bỏ `{}`), KHÔNG `includes` chuỗi con (bài học `nested-label-parity-guard-blind`: `anh` nằm trong nhiều từ khác).
  - `OLD_PARAM_NAMES = ['sdt']` — soi `name` của mọi `parameters[]` (path + query) VÀ placeholder `{sdt}` trong path.
  - `OLD_OPERATION_SUFFIXES = ['traCuuBaoHanh','chuyenTrangThai','huyDon','lietKe','chiTiet']` — so phần sau `_` của `operationId`.
- **Chống guard rỗng (E-7):** assert số path quét ≥ 50, số parameter quét ≥ 40 (đo thật hôm nay: 59 path, 77 parameter, 82 operationId — ghi con số đo được vào comment như `openapi-drift.spec.ts:40`), số operationId quét ≥ 70; và ca tự kiểm: hàm phát hiện chạy trên một document tổng hợp `{ paths: { '/orders/{id}/chot': { post: { operationId: 'X_huyDon', parameters: [{ in: 'query', name: 'sdt' }] } } } }` phải trả đủ ba vi phạm; và `'/orders/{id}/attachments'` KHÔNG bị bắt (chống bắt nhầm chuỗi con).
- Thông báo lỗi liệt kê đúng path/param/operationId vi phạm.

**D5 — Ca e2e cho route cũ ⇒ 404** đặt ở `orders.e2e.spec.ts` (một `describe` mới, `it.each`) và `customers.e2e.spec.ts`:
- Route cũ nhiều segment (đủ 13 dòng còn lại của bảng): gọi **có token hợp lệ** (để không lẫn 401) ⇒ `404`, `body.code === 'NOT_FOUND'`, có `traceId`; và KHÔNG mock service nào bị gọi (`expect(<mock>).not.toHaveBeenCalled()` trên mock prisma/service đã có trong file).
- `GET /orders/cho-duyet-chiet-khau`, `GET /orders/tra-cuu-bao-hanh?sdt=…` với account có `orders.view_all` ⇒ 404 `NOT_FOUND` (bị `:id` nuốt — ghi rõ trong tên test vì sao là 404 chứ không phải lỗi route).
- Query cũ: `GET /orders/warranty-lookup?sdt=0903176968` và `GET /customers/lookup?sdt=0903176968` ⇒ `400 VALIDATION_ERROR`, có `fieldErrors` với `field: 'phone'`.

### 3. Phạm vi

- **Trong:** 16 route + 4 chỗ tham số `sdt` + 6 operationId; sinh lại `openapi.json`; cập nhật test/guard so chuỗi route; guard mới; e2e route cũ; comment nhắc route cũ (backend + port/fake client, chỉ token route); docs G-5.
- **Ngoài (đừng làm):** field DTO request/response (`sdt` trong body/response, `customerSdt`, `lyDo`, `trangThai`…) ⇒ **10.2**; field multipart `anh` ⇒ 10.2 quyết; tên method port web/mobile (`chuyenTrangThai`, `huyDon`, `themAnh`…) ⇒ 10.5/10.8; tên method service; enum value; cột DB; CORS ⇒ 10.3; mọi thay đổi hành vi.

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:663-668`)

1. **Given** 16 route tiếng Việt hiện có (`cho-duyet-chiet-khau`, `tra-cuu-bao-hanh`, `anh`, `ap-chiet-khau`, `duyet-chiet-khau`, `bao-gia/anh`, `bao-gia/pdf`, `xuat-bao-gia`, `chot`, `chuyen-trang-thai`, `huy`, `mo-lai`, `phien-ban`, `vong-doi`…), **When** đổi tên, **Then** route mới đúng từng dòng bảng đổi tên; method HTTP, quyền `@RequirePermissions`, phạm vi đọc/ghi đơn và hành vi giữ nguyên [Source: sprint-change-proposal-2026-10-22.md §4.2].
2. **Given** tham số `sdt` (path `/customers/{sdt}`, query `?sdt=` của tra cứu bảo hành), **When** đổi, **Then** thành `phone`; chuẩn hoá E.164 vẫn chỉ ở backend `customers/domain` (AD-9).
3. **Given** 0 consumer HTTP, **When** đổi, **Then** đổi cứng, KHÔNG giữ alias route cũ (mặc định §6.4); gọi route cũ ⇒ 404 envelope chuẩn (AD-5).
4. **Given** `openapi.json` là build artifact, **When** đổi xong, **Then** sinh lại bằng script có sẵn, drift-guard xanh; KHÔNG sửa tay spec (AD-12).
5. **Given** source-guard/e2e đang so chuỗi route, **When** đổi, **Then** cập nhật theo route mới và thêm một guard: không path nào trong `openapi.json` chứa segment thuộc danh sách route tiếng Việt cũ, có assert chống-guard-rỗng (E-7); mutant thêm lại một route cũ ⇒ ĐỎ.
6. **Given** spine và `project-context.md` còn ví dụ route cũ, **When** story commit, **Then** ví dụ được cập nhật trong cùng commit (G-5).

### AC dẫn xuất (đo được)

7. `jq -r '.paths|keys[]' backend/openapi/openapi.json` ra **đúng** 16 path mới của bảng (`/orders/pending-discount-approvals`, `/orders/warranty-lookup`, `/orders/{id}/attachments`, `/orders/{id}/attachments/{attachmentId}`, `/orders/{id}/apply-discount`, `/orders/{id}/resolve-discount`, `/orders/{id}/quote/image`, `/orders/{id}/quote/pdf`, `/orders/{id}/export-quote`, `/orders/{id}/confirm`, `/orders/{id}/transition`, `/orders/{id}/cancel`, `/orders/{id}/reopen`, `/orders/{id}/versions`, `/orders/{id}/lifecycle`, `/customers/{phone}`), tổng số path **vẫn là 58** (scout ghi nhầm 59; đo lại bằng `jq` trên `a1a4edc` ra 58), và tập method của mỗi path mới bằng tập method của path cũ tương ứng (vd `/orders/{id}/attachments` = `get,post`; `/attachments/{attachmentId}` = `delete,get`).
8. Với mọi operation được đổi đường dẫn, **khối security + response codes + requestBody** trong spec giống hệt bản cũ — kiểm bằng `jq` so `.paths[old]` (từ `git show a1a4edc:backend/openapi/openapi.json`) với `.paths[new]` sau khi bỏ `operationId` và thay `sdt`→`phone` ở `parameters` của 4 chỗ; khác biệt duy nhất được phép là `operationId` của 6 handler D1 và tên tham số. Ghi lệnh + kết quả vào Dev Agent Record.
9. Không `parameters[].name === 'sdt'` nào trong spec; `GET /customers/lookup` và `GET /orders/warranty-lookup` có query `phone` (required); `/customers/{phone}` có path param `phone`.
10. Không operationId nào kết thúc bằng `traCuuBaoHanh|chuyenTrangThai|huyDon|lietKe|chiTiet`; sáu operationId mới đúng bảng D1.
11. e2e: route cũ ⇒ 404 `NOT_FOUND` envelope cho cả 15 dòng orders (D5, kể cả hai route bị `:id` nuốt, gọi kèm account có quyền xem); query cũ `?sdt=` ⇒ 400 với `fieldErrors[].field === 'phone'` ở cả hai route lookup; `/customers/0912345678` (GET/PATCH) vẫn chạy như trước.
12. `orders-read-gate.spec.ts` vẫn khẳng định đúng 7 khoá đọc mở quyền xem (tên mới); không khoá nào được thêm/bớt; `routes.length ≥ 18` vẫn xanh.
13. Guard D4 xanh; **mutation bắt buộc** (ghi kết quả vào Dev Agent Record, backup bằng `cp`, KHÔNG `git checkout`):
    - M1: đổi một decorator về route cũ (vd `@Post(':id/confirm')` → `':id/chot'`), chạy `npm run openapi:gen`, chạy guard ⇒ **ĐỎ** đúng ca segment; khôi phục + regen ⇒ `cmp` sạch.
    - M2: đổi `@Param/@ApiParam` của `/customers/:phone` về `sdt` (hoặc field query DTO về `sdt`), regen ⇒ guard **ĐỎ** đúng ca param.
    - M3: đổi tên một handler về `huyDon`, regen ⇒ guard **ĐỎ** đúng ca operationId.
    - M4: làm rỗng bộ trích path (vd `Object.keys({})`) ⇒ ca chống-rỗng **ĐỎ**.
    - M5 (không regen): đổi một decorator về route cũ, KHÔNG regen ⇒ drift-guard ĐỎ (chứng minh hai lớp độc lập; ghi rõ lớp nào bắt).
14. `grep -rnE` bộ mẫu route cũ (lệnh ở Tasks 8) trên `backend/src backend/test web/src/design-system mobile/lib design-system backend/CONVENTIONS.md` chỉ còn: danh sách cấm của guard D4, ca e2e route cũ, và các ngoại lệ đã nêu ở §1 ("KHÔNG phải route API").
15. 5 lane xanh trên máy: backend `npm test`, `npm run test:db` (cần Docker + `pns-postgres`, memory `db-lane-needs-docker-desktop-gui`), design-system, web (`npm run typecheck && npm test`), mobile (`flutter test` + `flutter analyze` — chỉ đổi comment nhưng vẫn chạy). `npm run build` backend xanh. Lint: so với baseline đo bằng stash (memory `backend-lint-red-at-baseline`), không thêm lỗi mới ở file đã sửa.

## Tasks / Subtasks

- [x] **Task 1 — Đo baseline trước khi sửa** (AC: 8, 15)
  - [x] `cp backend/openapi/openapi.json` ra scratchpad làm bản so (AC 8); ghi số path (59), số parameter, số operationId.
  - [x] Chạy backend `npm test` ghi số suite/test; đo baseline lint bằng `git stash` (memory `backend-lint-red-at-baseline`).
- [x] **Task 2 — Đổi route orders** (AC: 1, 3, 7, 8)
  - [x] `orders.controller.ts`: đổi 17 decorator theo bảng §4.2 (§1 có số dòng); giữ nguyên vị trí khai (hai route tĩnh vẫn trước `@Get(':id')`).
  - [x] Đổi 3 handler `traCuuBaoHanh`→`warrantyLookup`, `chuyenTrangThai`→`transition`, `huyDon`→`cancel` (chỉ tên method controller; lời gọi `this.orders.traCuuBaoHanh(...)`/`huyDon(...)` của service giữ nguyên).
  - [x] `WarrantyLookupQueryDto.sdt` → `phone`; cập nhật chỗ controller đọc `query.sdt`. Giữ `@IsString/@IsNotEmpty/@MaxLength(32)` + `@ApiProperty` (description/example).
- [x] **Task 3 — Đổi customers** (AC: 2, 9, 11)
  - [x] `@Get(':sdt')`/`@Patch(':sdt')` → `':phone'`, `@ApiParam({ name: 'phone' })`, `@Param('phone') phone`. Chuẩn hoá vẫn ở `customers.service` → `customers/domain` (AD-9) — không thêm chuẩn hoá ở controller.
  - [x] `LookupCustomerQueryDto.sdt` → `phone`; controller `query.phone`. Comment "PHẢI khai TRƯỚC `@Get(':sdt')`" (:102) đổi token thành `:phone`.
  - [x] KHÔNG đụng `UpdateCustomerRequestDto.sdt` (`@IsAbsent`, field body) và `CustomerResponseDto.sdt` — thuộc 10.2.
- [x] **Task 4 — Đổi operationId inventory** (AC: 10)
  - [x] `stock-items.controller.ts:44` `lietKe`→`list`; `stock-vouchers.controller.ts:152` `lietKe`→`list`, `:178` `chiTiet`→`findOne`. Kiểm không trùng tên method sẵn có trong cùng class.
- [x] **Task 5 — Sinh lại spec** (AC: 4, 7–10)
  - [x] `cd backend && npm run openapi:gen`; không sửa tay `openapi.json`.
  - [x] Chạy lệnh `jq` của AC 7–10, so bản cũ/mới theo AC 8; dán kết quả rút gọn vào Dev Agent Record.
- [x] **Task 6 — Cập nhật test/guard đang so chuỗi route** (AC: 5, 11, 12)
  - [x] `orders-read-gate.spec.ts`: 7 khoá → `'Get :id/lifecycle'`, `'Get :id/versions'`, `'Get :id/attachments/:attachmentId'`, `'Get :id/attachments'`, `'Get warranty-lookup'` (+ `'Get '`, `'Get :id'` giữ); mảng :99; comment :12, :114.
  - [x] `openapi-drift.spec.ts`: `/customers/{phone}`, `/orders/{id}/export-quote`, `/orders/{id}/quote/image`, `/orders/{id}/quote/pdf` (đổi cả tên biến cục bộ tiếng Việt `anhGet` → `imageGet` vì đang sửa dòng đó).
  - [x] e2e: `orders.e2e.spec.ts`, `customers.e2e.spec.ts`, `order-stock-issue.e2e.spec.ts`, `invoices.e2e.spec.ts`, `contracts.e2e.spec.ts`; tên test ở `orders-detail-scope.db.integration.spec.ts:252`. Query `?sdt=` trong e2e → `?phone=`. Chỉ đổi URL/tên; KHÔNG đổi assert hành vi. Nếu một assert phải đổi khác ngoài chuỗi URL ⇒ dừng, đó là dấu hiệu đổi hành vi.
  - [x] `design-system/session/parity.test.mjs:181,194,251`: chuỗi thông báo → `POST :id/confirm`, `POST :id/reopen`, `POST :id/export-quote`.
- [x] **Task 7 — Guard mới + e2e route cũ** (AC: 3, 5, 11, 13)
  - [x] Tạo `backend/test/no-vietnamese-api-contract.spec.ts` theo D4 (tên `describe`/`it` tiếng Anh, comment tiếng Anh, giải thích bất biến, không nhắc mã plan/AC).
  - [x] Thêm `describe` route cũ ⇒ 404 trong `orders.e2e.spec.ts` (`it.each` 15 dòng, D5) và ca `?sdt=` ⇒ 400 `field: 'phone'` ở `orders.e2e.spec.ts` + `customers.e2e.spec.ts`.
  - [x] Chạy M1–M5 (AC 13), ghi bảng kết quả.
- [x] **Task 8 — Comment nhắc route cũ** (AC: 14)
  - [x] Sửa token route trong comment ở `backend/src/**` (≈22 file), `web/src/design-system/session/{orders-port,warranty-port,fake-orders-port}.ts`, `mobile/lib/design_system/session/{orders_port,warranty_port,fake_orders_port}.dart`. Chỉ đổi chuỗi route (`/orders/:id/chot` → `/orders/:id/confirm`…), không dịch/viết lại comment, không đổi code.
  - [x] Kiểm: `grep -rnE "cho-duyet-chiet-khau|tra-cuu-bao-hanh|/anh\b|/anh/|ap-chiet-khau|duyet-chiet-khau|bao-gia/|xuat-bao-gia|/chot\b|chuyen-trang-thai|/huy\b|mo-lai|phien-ban|vong-doi|:sdt|\{sdt\}|\?sdt=" backend/src backend/test web/src mobile/lib mobile/test design-system backend/CONVENTIONS.md` — mọi dòng còn lại phải thuộc ngoại lệ AC 14 (lưu ý `mo-lai` khớp cả hằng `'mo-lai-gate-thua'`, `\{sdt\}` khớp `${sdt}` trong thông báo lỗi — là ngoại lệ hợp lệ).
- [x] **Task 9 — Docs cùng commit (G-5)** (AC: 6)
  - [x] `backend/CONVENTIONS.md:14`: bỏ câu "Route/field tiếng Việt có sẵn (`/orders/{id}/chot`, `/huy`, `/tra-cuu-bao-hanh`) giữ tới khi refactor riêng"; thay bằng: route + tham số đã tiếng Anh từ 10.1, field DTO tiếng Việt cũ đổi ở 10.2; enum value giữ.
  - [x] Spine `ARCHITECTURE-SPINE.md:187`: câu cuối → "Route/tham số tiếng Việt cũ đã đổi ở Story 10.1; field DTO đổi ở Story 10.2".
  - [x] `_bmad-output/project-context.md:87`: "contract cũ tiếng Việt giữ tới khi refactor riêng" → route/tham số/operationId đã tiếng Anh (10.1); field DTO tiếng Việt cũ giữ tới 10.2.
  - [x] `sprint-change-proposal-2026-10-22.md` §4.2: thêm khối "Tinh chỉnh 10.1" (query `customers/lookup?phone=` + bảng 6 operationId của D1).
- [x] **Task 10 — 5 lane + build** (AC: 15)
  - [x] backend `npm test`, `npm run build`, `npm run test:db`; design-system; web `npm run typecheck && npm test`; mobile `flutter test` + `flutter analyze`. Lint so baseline. Không `dart format` ghi file (memory `dart-format-writes-files-cascade`: dùng `-o none`).

## Dev Notes

### Quyết định đã chốt — không bàn lại

- Đại Ca (2026-10-21 22:33) + correct-course 2026-10-22: Epic 10 chạy trước Epic 8; bảng §4.2 là nguồn chân lý; đổi cứng không alias (§6.4); enum value và cột DB giữ (§6.6, §6.7); tên method port client đổi ở 10.5/10.8 (§6.8).
- Luật ngôn ngữ (`project-context.md:87`): code mới/đang sửa viết tiếng Anh (tên biến, test, comment mới); **không** đổi tên hàng loạt symbol tiếng Việt có sẵn ngoài phạm vi story. Áp dụng ở đây: biến `sdt` ở hai handler customers đổi thành `phone` (đang sửa đúng dòng đó); không đổi `quyenCuaNguoiGoi`, `FileDaTaiLen`, `TRAN_CUNG_SO_ANH`… dù nằm cạnh.
- Story này tuyên bố hai tinh chỉnh (D1) — đã qua `jev_judge` (0.98 cả hai) — phải vào bảng §4.2 cùng commit (G-5).

### Files sẽ đổi / tạo

| File | Đổi gì |
|---|---|
| `backend/src/orders/orders.controller.ts` | 17 decorator route, 3 tên handler, `query.phone`, token route trong comment |
| `backend/src/orders/dto/warranty-lookup-query.dto.ts` | `sdt` → `phone` |
| `backend/src/customers/customers.controller.ts` | `:sdt` → `:phone`, `@ApiParam`, `@Param`, `query.phone`, comment :102 |
| `backend/src/customers/dto/lookup-customer-query.dto.ts` | `sdt` → `phone` |
| `backend/src/inventory/stock-items.controller.ts`, `stock-vouchers.controller.ts` | tên handler |
| `backend/src/**` (DTO/service/domain còn lại, ≈18 file) | chỉ token route trong comment |
| `backend/openapi/openapi.json` | SINH LẠI |
| `backend/test/no-vietnamese-api-contract.spec.ts` | **MỚI** |
| `backend/test/orders-read-gate.spec.ts`, `openapi-drift.spec.ts`, 5 file e2e, 1 db spec | chuỗi route |
| `design-system/session/parity.test.mjs` | chuỗi thông báo |
| `web/src/design-system/session/*.ts` (3), `mobile/lib/design_system/session/*.dart` (3) | chỉ comment |
| `backend/CONVENTIONS.md`, spine, `project-context.md`, `sprint-change-proposal-2026-10-22.md` | docs G-5 |

### Hiện trạng phải giữ

- Gating: mỗi handler giữ nguyên `@RequirePermissions`/`@RequireAnyPermissions` (vd `POST :id/attachments` vẫn `RequireAnyPermissions(quotesCreateEdit, constructionTransition, deliveryConfirm, paymentsRecord)`; `quote/image|pdf` vẫn `quotes.create_edit` — `orders-read-gate.spec.ts:114`). Guard `no-handler-without-require-permissions` vẫn xanh.
- Phạm vi đơn: mọi đường đọc/ghi vẫn qua `findScopedOrThrow`/mệnh đề phạm vi; guard `no-unscoped-order-write` không đổi.
- Multer: interceptor `FilesInterceptor('anh', TRAN_CUNG_SO_ANH, { limits })` giữ nguyên, ngưỡng giữ (memory `multer-limits-bypass-error-envelope`).
- Route `stock-issue`, `stock-check`, `line-items`, `preview-total`, payments/contracts/invoices: không đụng.

### Tình huống biên đã tính

- Hai route tĩnh cũ bị `:id` nuốt (§1) ⇒ 404 chỉ khi có token có quyền; không token ⇒ 401. Test phải chọn đúng.
- Route cũ đi qua `@Get(':id')` vẫn chạy `quyenCuaNguoiGoi` + `getScoped` (đọc DB mock) — e2e ca này không được assert "không chạm service"; chỉ ca nhiều segment mới assert không mock nào bị gọi.
- `/customers/{phone}` vẫn khớp `/customers/lookup`? Không: `lookup` khai trước. Ca e2e `customers.e2e.spec.ts:403` chứng minh — chỉ đổi tên test (`:sdt` → `:phone`).
- Query `?phone=` gửi kèm `?sdt=` ⇒ `sdt` bị whitelist cắt, `phone` dùng bình thường — không cần test riêng.
- operationId trùng: Nest báo trùng chỉ khi cùng controller + cùng tên method; `list`/`findOne` mới trong `StockVouchersController` phải không trùng method có sẵn (`create`, `createReturn`).

### Kiểm thử — luật dự án áp dụng trực tiếp

- Guard mới phải có assert chống-rỗng + ca tự kiểm dương/âm (memory `source-guards-mutate-for-false-pass`, `nested-label-parity-guard-blind`).
- Mutation: backup bằng `cp`, không `git checkout` (memory `mutation-test-never-git-checkout`); mutant phải compile (memory `mutation-must-compile-or-false-red`); một mutant xanh có thể vì lớp phòng thủ khác bắt — M5 làm rõ lớp nào (memory `mutation-hits-one-layer-only`).
- AC về mã HTTP chỉ đo được ở lane e2e qua ValidationPipe thật (memory `dev-pins-ac-deviation-as-green-test`); không ghim độ lệch AC thành test xanh.
- Lane DB: cần Docker Desktop GUI; nếu không lên được, viết rõ "lane DB chưa chạy" và hỏi Đại Ca (memory `db-lane-needs-docker-desktop-gui`). Story này không thêm ca DB, chỉ đổi tên một `it`.
- Supertest dùng `listen-loopback` sẵn có trong e2e — giữ.

### Previous Story Intelligence

- Story đầu Epic 10; story liền trước là 7.5 + lô chuẩn bị (commit `a1a4edc`): G-4 vừa làm cứng 7 guard Prisma theo biến thể cú pháp (xuống dòng quanh dấu chấm, `*OrThrow`, `*AndReturn`, SQL thô qua `test/util/raw-sql-write.ts`). Story này không chạm các guard đó, nhưng `orders-read-gate.spec.ts` dùng regex đọc decorator — sau khi prettier định dạng lại controller (nếu dòng decorator dài ra), chạy lại guard để chắc regex còn đọc đủ ≥ 18 route.
- Epic 7 retro §3.5: fake port lệch backend ở cả 5 story — lý do Epic 10 tồn tại. 10.1 KHÔNG sửa fake theo contract mới (chỉ comment); 10.3/10.6 viết lại fake theo type sinh.

### Git intelligence (5 commit gần nhất)

- `a1a4edc` fix(contracts) + harden source guards — mẫu commit: guard mới đi cùng ca "catches…" và mutant; CONVENTIONS cập nhật cùng commit.
- `68e8726` docs(epic-10) — proposal + epics + spine AD-12 (nguồn của story này).
- `77dab27` docs(epic-7) retro; `de6d6e5` 7.5; `66afdfe` 7.4.
- Commit đề xuất: `refactor(api): rename Vietnamese routes, params and operation ids to English` (conventional, không nhắc AI/mã plan).

### Latest tech notes

- Không thêm thư viện. `@nestjs/swagger` đang dùng sinh `operationId` mặc định `${ControllerName}_${methodKey}` — đổi tên method là cách đổi operationId không cần `@ApiOperation({ operationId })`. Không cần tra web.

### Project Structure Notes

- File test mới kebab-case trong `backend/test/` (guard `naming-convention` chỉ soi `src/`, nhưng giữ cùng quy ước).
- Không file mới ở `src/`.

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. Field multipart `anh` (`FilesInterceptor('anh')`, `StatusChangeRequestDto.anh`) không có trong bảng §4.2. Mặc định: giữ ở 10.1; 10.2 đổi thành `files` và ghi vào bảng (tên form field là contract mà client multipart sẽ gửi).
2. `POST /orders/{id}/anh` không có `requestBody` trong spec (chỉ `chuyen-trang-thai` có `StatusChangeRequestDto`) — client sinh ở 10.3/10.6 sẽ không biết form field. Không thuộc 10.1 (không đổi hành vi spec ngoài tên); ghi lại để 10.2/10.3 thêm `@ApiBody`.

### References

- `_bmad-output/planning-artifacts/epics.md:657-668` — Epic 10, Story 10.1
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §3 (thứ tự, lô chuẩn bị), §4.2 (bảng đổi tên), §6.4, §6.6, §6.7, §6.8
- `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-5 (:72), AD-9 (:97), AD-12 (:120-125), Consistency Conventions (:187)
- `_bmad-output/project-context.md:63, 87`
- `backend/CONVENTIONS.md:12-14`
- `backend/test/openapi-drift.spec.ts`, `backend/test/orders-read-gate.spec.ts`, `backend/src/common/errors/all-exceptions.filter.ts:133-147`, `backend/src/common/validation/validation-pipe.factory.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (G-3, G-4 done; G-5 áp từ 10.1)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- Baseline (trước khi sửa): backend `npm test` 116 suite / 2417 test xanh; `eslint .` 88 error (cây backend chưa sửa ⇒ đo thẳng, không cần stash); spec **58 path** (story ghi 59 — đếm sai lúc scout), 77 parameter, 82 operationId. Bản so: `scratchpad/openapi.before.json` (= `a1a4edc`).
- AC 7 — `jq -r '.paths|keys[]'`: 58 → 58; bỏ 16 path cũ, thêm đúng 16 path mới của bảng (diff tập = rỗng). Method từng cặp: `attachments` = get,post; `attachments/{attachmentId}` = delete,get; `customers/{phone}` = get,patch; còn lại 1 method, khớp cũ.
- AC 8 — so từng cặp cũ/mới trên `{security, responses (bỏ description), requestBody, parameters{name,in,required,schema} (sdt→phone)}`: **16/16 SAME**. Path KHÔNG đổi tên: giống hệt sau khi bỏ `operationId`, trừ query `customers/lookup` `sdt`→`phone`. `components`: chỉ khác 2 description có nhắc route (`…/transition`, `qua /confirm`).
- AC 9 — `parameters[].name == "sdt"`: 0. `GET /customers/lookup`, `GET /orders/warranty-lookup`: query `phone` required; `/customers/{phone}` get+patch: path `phone`.
- AC 10 — operationId đuôi `traCuuBaoHanh|chuyenTrangThai|huyDon|lietKe|chiTiet`: 0; diff operationId đúng 6 dòng bảng D1; tổng vẫn 82.
- AC 13 mutation (backup `cp`, khôi phục + regen ⇒ `cmp` sạch cả 4 file + spec):

| Mutant | Kết quả |
|---|---|
| M1 `@Post(':id/confirm')`→`':id/chot'` + regen | guard ĐỎ: `path /orders/{id}/chot: segment "chot"` |
| M2a `:phone`→`:sdt` (GET, ApiParam, @Param) + regen | guard ĐỎ: placeholder `{sdt}` + path parameter `sdt` |
| M2b `LookupCustomerQueryDto.phone`→`sdt` + regen | guard ĐỎ: `GET /customers/lookup: query parameter "sdt"` |
| M3 handler `cancel`→`huyDon` + regen | guard ĐỎ: `operationId "OrdersController_huyDon"` |
| M4 bộ trích path rỗng | ĐỎ 2 ca: chống-rỗng + ca tự kiểm tổng hợp |
| M5 route cũ, KHÔNG regen | guard XANH (đọc file commit), **drift-guard ĐỎ** — hai lớp độc lập, lớp drift bắt |
| (thêm) `field` service `'phone'`→`'sdt'` ở từng caller customers (findOne/update/lookup) và warranty | mỗi mutant ĐỎ (1/7/1 và 2 test) |

- Lane: backend `npm test` 117 suite / 2441 test; `npm run build` xanh; `test:db` 26 suite / 322 test (Docker `pns-postgres` đang chạy); design-system 487/487; web typecheck xanh + vitest 195/195; mobile `flutter analyze` 0 issue + `flutter test` 454 xanh. Lint 88 → 75 error, so theo file: không file nào thêm lỗi (5 file đã sửa còn đỏ prettier là nợ sẵn ở baseline, số lỗi không đổi; `orders.e2e.spec.ts` hết 13 lỗi vì prettier chạy trên file đã sửa).

### Completion Notes List

- 16 route + 4 chỗ `sdt` + 6 operationId đổi đúng bảng §4.2 + D1; decorator giữ nguyên vị trí (hai route tĩnh vẫn trước `@Get(':id')`, `customers/lookup` vẫn trước `:phone`), quyền/HttpCode/interceptor/pipe không đổi. Không alias. Spec sinh lại bằng `npm run openapi:gen`.
- **Lệch so với story (đã qua `jev_judge`, B, 0.95):** lỗi `isPhoneNumber` do service ném (sau ValidationPipe) vẫn trỏ `field: 'sdt'` ⇒ cùng endpoint trả `phone` (pipe) và `sdt` (service). Sửa: `CustomersService.normalizeOrThrow(raw, field)` — create body truyền `'sdt'` (field body, 10.2), findOne/update/lookup truyền `'phone'`; `OrdersService.traCuuBaoHanh` trỏ `'phone'`. Đây là đổi assert ngoài chuỗi URL (story bảo "dừng") nhưng chính là tên tham số mới (AC 2/11), nên làm và ghi vào khối "Tinh chỉnh 10.1" của proposal. Thêm ca unit `findOne / update with an invalid path phone ⇒ fieldErrors point at phone`.
- Guard `warranty-readonly.spec.ts` lọc route theo chuỗi `bao-hanh` — sau đổi thành `warranty` (bất biến giữ: mọi route bảo hành là `@Get`). Story không liệt kê file này.
- e2e query `.query({ sdt })` (không bắt được bằng grep URL) đổi thành `phone`; `it.each(['anh','pdf'])` của tải báo giá → `['image','pdf']`.
- Guard mới `no-vietnamese-api-contract.spec.ts` (D4): segment nguyên, param path+query + placeholder, đuôi operationId; chống-rỗng (≥50/40/70, đo 58/77/82); ca tổng hợp bắt đủ 3 loại + ca `attachments`/`quote/image` không bị bắt.
- e2e route cũ: 15 ca nhiều segment ⇒ 404 `NOT_FOUND` + `traceId`, guard quyền không chạy, 0 lời gọi prisma mock; 2 ca bị `:id` nuốt (account `orders.view_all`, `findUnique` null) ⇒ 404; `?sdt=` ⇒ 400 `phone` ở `orders/warranty-lookup` và `customers/lookup`. `/customers/0912345678` GET/PATCH: các e2e có sẵn vẫn xanh.
- AC 14 grep còn lại đều là ngoại lệ: danh sách cấm của guard + ca e2e route cũ; `${sdt}` trong thông báo lỗi; hằng `'mo-lai-gate-thua'`; thanh địa chỉ giả `CreateQuoteScreen`/`DiscountApprovalScreen`; `/tmp/anh-$i.jpg`; `value={sdt}` (biến UI); fixture text-guard `no-hard-delete-customer-source.spec.ts:104`.
- Giữ (ngoài phạm vi): `FilesInterceptor('anh')`/field `anh`, `quote-export.service` `kind: 'anh'`, key R2 `bao-gia.png`, tên method service, field DTO body/response.
- Docs G-5: `CONVENTIONS.md:14`, spine :187, `project-context.md:87`, proposal §4.2 khối "Tinh chỉnh 10.1".

### File List

- `backend/openapi/openapi.json` (sinh lại)
- `backend/src/orders/orders.controller.ts`
- `backend/src/orders/orders.service.ts`
- `backend/src/orders/domain/allowed-transition.ts`
- `backend/src/orders/dto/apply-discount-request.dto.ts`
- `backend/src/orders/dto/attachment-response.dto.ts`
- `backend/src/orders/dto/cancel-order-request.dto.ts`
- `backend/src/orders/dto/cancel-order-response.dto.ts`
- `backend/src/orders/dto/discount-pending-item.dto.ts`
- `backend/src/orders/dto/order-lifecycle-response.dto.ts`
- `backend/src/orders/dto/order-versions-response.dto.ts`
- `backend/src/orders/dto/quote-export-response.dto.ts`
- `backend/src/orders/dto/resolve-discount-request.dto.ts`
- `backend/src/orders/dto/status-change-request.dto.ts`
- `backend/src/orders/dto/status-change-response.dto.ts`
- `backend/src/orders/dto/warranty-lookup-query.dto.ts`
- `backend/src/orders/dto/warranty-lookup-response.dto.ts`
- `backend/src/customers/customers.controller.ts`
- `backend/src/customers/customers.service.ts`
- `backend/src/customers/dto/customer-lookup-response.dto.ts`
- `backend/src/customers/dto/customer-response.dto.ts`
- `backend/src/customers/dto/is-absent.decorator.ts`
- `backend/src/customers/dto/lookup-customer-query.dto.ts`
- `backend/src/customers/dto/update-customer-request.dto.ts`
- `backend/src/inventory/stock-items.controller.ts`
- `backend/src/inventory/stock-vouchers.controller.ts`
- `backend/test/no-vietnamese-api-contract.spec.ts` (mới)
- `backend/test/orders.e2e.spec.ts`
- `backend/test/customers.e2e.spec.ts`
- `backend/test/customers.service.spec.ts`
- `backend/test/order-stock-issue.e2e.spec.ts`
- `backend/test/invoices.e2e.spec.ts`
- `backend/test/contracts.e2e.spec.ts`
- `backend/test/orders-detail-scope.db.integration.spec.ts`
- `backend/test/orders-read-gate.spec.ts`
- `backend/test/openapi-drift.spec.ts`
- `backend/test/warranty-lookup.spec.ts`
- `backend/test/warranty-readonly.spec.ts`
- `backend/CONVENTIONS.md`
- `design-system/session/parity.test.mjs`
- `web/src/design-system/session/orders-port.ts`
- `web/src/design-system/session/warranty-port.ts`
- `web/src/design-system/session/fake-orders-port.ts`
- `mobile/lib/design_system/session/orders_port.dart`
- `mobile/lib/design_system/session/warranty_port.dart`
- `mobile/lib/design_system/session/fake_orders_port.dart`
- `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/10-1-doi-route-va-tham-so-tieng-viet-sang-tieng-anh.md`
- `_bmad-output/implementation-artifacts/tests/test-summary-story-10-1.md` (QA automation)
- `_bmad-output/planning-artifacts/epics.md` (review: tinh chỉnh giữa story vào Story 10.1)

## Senior Developer Review (AI)

**Người review:** Đại Ca (tự động, story-automator review) · **Ngày:** 2026-10-22 · **Lớp chính:** `/ck:code-review` (spec compliance + code-reviewer subagent chỉ đọc) · **Kết quả:** Approve sau khi sửa.

**Git vs File List:** khớp 49 file sửa + guard mới; thiếu `test-summary-story-10-1.md` (bổ sung). `.githooks/`, `backend/.claude/`, `docs/*.xlsx`, `_bmad-output/story-automator/*` không thuộc story.

**AC:** 1–15 IMPLEMENTED. Spec so với `a1a4edc`: chỉ khác path key, 4 chỗ `sdt`→`phone`, 6 operationId, 5 description nhắc route. Thứ tự route giữ (route tĩnh trước `:id`, `lookup` trước `:phone`). Không token route cũ nào sót trong code/doc ngoài ngoại lệ AC 14.

**Luật dự án đã bẻ thử (backup `cp`, khôi phục + `cmp` sạch):**

| Mutant | Kết quả |
|---|---|
| `cancel`: quyền người gọi → toàn bộ `PERM` (bỏ phạm vi) | ĐỎ (1 test) |
| `transition`: như trên | ĐỎ (5 test) |
| `POST attachments`: như trên | ĐỎ (1 test) |
| `lockOrderRow` bỏ `FOR UPDATE` → lane DB | ĐỎ (stock-issue FORCED interleaving + TOCTOU chốt) |
| Alias thật `@Get(['pending-discount-approvals','cho-duyet-chiet-khau'])` | ĐỎ (200 thay vì 404) — sau khi sửa F2 |
| Alias thật `@Get(['warranty-lookup','tra-cuu-bao-hanh'])` | ĐỎ (400 thay vì 404) |
| (ghi chú) hai `@Get` chồng nhau | mutant tương đương — decorator trên ghi đè, alias không được đăng ký; không tính |

Luật (2) tồn kho, (3) web screen, (4) mobile screen, (6) loopback: story không thêm thao tác kho / màn mới / app e2e mới — không áp. Lint: các lỗi prettier còn lại ở 5 file đã sửa là nợ có sẵn ở `a1a4edc` (đếm từng file, base = now).

**Findings và xử lý:**

- [MEDIUM][Fixed] Luật 11: tinh chỉnh giữa story (query `customers/lookup?phone=`, 6 operationId, `fieldErrors` `phone` cho input path/query) chỉ ghi vào proposal §4.2, chưa ghi vào `epics.md` Story 10.1 → thêm bullet "Tinh chỉnh khi làm story".
- [MEDIUM][Fixed] Ca e2e "GET /orders/%s ⇒ 404 (swallowed by GET /orders/:id)" không kiểm điều tên test tuyên bố; chỉ assert 404. Thêm assert `orderRepo.findFirst` nhận `where.AND` chứa `{ id: <segment cũ> }`. Lần thử đầu assert `findUnique` thì đỏ, vì fake scoped đọc lại qua `findUnique(ORDER_ID)`; đã sửa đúng điểm đo.
- [LOW][Fixed] Tên test "no guard and no DB call" nói quá (chỉ quan sát lookup quyền, JWT guard không quan sát được khi gửi token hợp lệ) → "no permission lookup and no DB call"; ca không token ⇒ 404 đã có riêng.
- [LOW][Fixed] AC 7 ghi tổng 59 path; đo thật 58 ở cả bản cũ và bản mới → sửa chữ AC.
- [LOW][Không sửa] Guard D4 chỉ cấm đúng tên cũ; một route tiếng Việt MỚI (`huy-don`, `soDienThoai`) sẽ lọt. AC 5/10 chỉ đòi danh sách cũ; route không dấu không phân biệt được tiếng Việt/Anh một cách máy móc nếu không có từ điển; luật ngôn ngữ cho code mới do review canh. Ghi lại để 10.2 cân nhắc khi thêm guard field.

## Change Log

- 2026-10-22 — Đổi 16 route, tham số `sdt`→`phone` (4 chỗ) và 6 operationId sang tiếng Anh, không alias; spec sinh lại; lỗi chuẩn hoá SĐT trỏ đúng tên input (`phone` cho path/query); guard `no-vietnamese-api-contract` + e2e route cũ ⇒ 404 / `?sdt=` ⇒ 400; docs G-5 + tinh chỉnh vào bảng §4.2. Status → review.
- 2026-10-22 — Code review (AI): 2 MEDIUM + 2 LOW đã sửa (epics.md tinh chỉnh 10.1; ca e2e route tĩnh cũ kiểm đúng đường `:id`; tên test; AC 7 = 58 path), 1 LOW ghi lại không sửa. Mutation scope ×3, `FOR UPDATE`, alias route cũ ×2 đều ĐỎ. Status → done.
