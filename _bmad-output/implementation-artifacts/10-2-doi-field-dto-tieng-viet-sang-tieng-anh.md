---
baseline_commit: bf4e520
---

# Story 10.2: Đổi field DTO tiếng Việt sang tiếng Anh

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a lập trình viên client,
I want mọi field request/response trên contract là tiếng Anh,
so that type sinh từ OpenAPI ở web/mobile thống nhất một ngôn ngữ ngay từ đầu.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-22, sau commit `bf4e520` = Story 10.1 done)

- **Refactor contract thuần, chỉ backend** (+ hai test parity ở `design-system/`). Không đổi DB, không đổi enum value, không đổi hành vi. 0 consumer HTTP (web 13 port + fake, mobile 11 port + fake, không ai gọi `fetch`/`dio`) ⇒ đổi cứng, không alias (mặc định §6.4).
- **`openapi.json` hôm nay:** 108 schema, 527 lần xuất hiện property (đo bằng `jq '[.components.schemas|..|objects|select(has("properties"))|.properties|keys[]]|length'`). Không có property nào chỉ nằm trong schema inline lồng nhau; không path nào có requestBody/response inline có `properties`.
- **32 tên property tiếng Việt thật sự có trong spec** (đo bằng `jq`, cột phải = schema chứa nó):

| Cũ → Mới | Schema có field |
|---|---|
| `sdt` → `phone` | `CreateCustomerRequestDto`, `UpdateCustomerRequestDto` (`@IsAbsent`), `CustomerResponseDto`, `CustomerLookupResponseDto`, `WarrantyCustomerDto`, `WarrantyLookupResponseDto` |
| `customerSdt` → `customerPhone` | `CreateOrderRequestDto`, `OrderResponseDto`, `OrderListItemDto`, `DiscountPendingItemDto`, `InvoiceDetailResponseDto` |
| `cccd` → `nationalId` | `CreateCustomerRequestDto`, `UpdateCustomerRequestDto`, `CustomerResponseDto` |
| `chotAt` → `confirmedAt` | `OrderVersionItemDto`, `WarrantyOrderDto` |
| `buoc` → `steps`, `buocKeTiep` → `nextSteps`, `coTheHuy` → `canCancel` | `OrderLifecycleResponseDto` |
| `trangThai` → `progress` | `OrderLifecycleStepDto` (đã có `status` ⇒ tinh chỉnh có sẵn trong bảng) |
| `coTheXoa` → `canDelete`, `nguoiTaiLen` → `uploadedBy` | `AttachmentItemDto` |
| `soAnhDaLuu` → `savedAttachmentCount` | `AttachmentUploadResponseDto`, `StatusChangeResponseDto` |
| `laBanHienLuc` → `isCurrent`, `thayDoi` → `changes` | `OrderVersionItemDto` |
| `soDong` → `lineCount` | `OrderVersionItemDto`, `StockVoucherSummaryDto`, `StockVoucherDetailDto` |
| `them`/`xoa`/`doiSoLuong` → `added`/`removed`/`qtyChanged` | `ThayDoiBanUpdateDto` |
| `ten` → `name`, `tu` → `from`, `den` → `to` | `ten`: `CanMuaViewDto`, `StockItemViewDto`, `StockVoucherLineResponseDto`, `ThayDoiSoLuongDto`; `tu`/`den`: `ThayDoiSoLuongDto` |
| `donVi` → `unit` | `CanMuaViewDto`, `StockItemViewDto`, `StockVoucherLineResponseDto` |
| `khaDung` → `available`, `tinhTrang` → `stockStatus` | `StockItemViewDto` |
| `canNhap` → `toPurchase` | `CanMuaViewDto`, `StockItemViewDto` |
| `danhSachCanMua` → `purchaseList` | `StockListResponseDto` |
| `ma` → `code`, `nguoiTao` → `createdBy`, `tongSoLuong` → `totalQty` | `ma`: `StockVoucherSummaryDto`, `StockVoucherDetailDto`, `StockVoucherReturnOfDto`, `StockVoucherReturnRefDto`; hai field còn lại: Summary + Detail |
| `lyDo` → `reason` | `CancelOrderRequestDto` |
| `scopeThiCong`/`scopeThietBi`/`scopeVanChuyen` → `scopeConstruction`/`scopeEquipment`/`scopeDelivery` | `OrderResponseDto` (cả 3), `UpdateOrderRequestDto` (Thi công + Vận chuyển) |
| schema `ThayDoiBanUpdateDto` → `VersionChangesDto`, `ThayDoiSoLuongDto` → `QtyChangeDto`, `CanMuaViewDto` → `PurchaseNeedViewDto` | `order-version-item.dto.ts:4,21`, `stock-list-response.dto.ts:54` |

  Không đụng độ tên trong cùng DTO (đã kiểm từng schema: `StockItemViewDto` chưa có `name`/`unit`/`available`; `OrderStockCheckLineDto.available` là schema khác).
- **File DTO chứa các field trên** (18 file): `customers/dto/{create-customer-request,update-customer-request,customer-response,customer-lookup-response}.dto.ts`; `orders/dto/{create-order-request,update-order-request,cancel-order-request,order-response,order-list-item,discount-pending-item,order-lifecycle-response,order-version-item,attachment-response,status-change-response,warranty-lookup-response}.dto.ts`; `inventory/dto/{stock-list-response,stock-voucher-response}.dto.ts`; `invoices/dto/invoice-detail-response.dto.ts`.

### 2. 🔥 BẪY SỐ 1 — cast `as XxxDto` làm đổi tên DTO thành "xanh giả"

App **không** có `ClassSerializerInterceptor`/`plainToInstance` ⇒ **JSON trả về = đúng các key của object controller return**. Nhiều controller trả object của service qua cast:

- `orders.controller.ts`: `create` :173, `findOne` :332, `update` :432, `confirm` :479, `reopen` :520, `applyDiscount` :565, `resolveDiscount` :609 (`as OrderResponseDto` — object là **row Prisma** `OrderView = Order & {...}` có `customerSdt`, `scopeThiCong`…), `pendingDiscountApprovals` :234, `warrantyLookup` :269, `list` :304, `listVersions` :393, stock-issue :996/:1084 (`voucher: anGiaVonDongPhieu(...)`).
- `customers.controller.ts` :80, :98, :126, :151, :183 (row Prisma `Customer` có `sdt`, `cccd`).
- `inventory/stock-items.controller.ts:45`, `stock-vouchers.controller.ts:96,137,157,186`.
- `invoices`: `invoices.service.ts:213` dựng view với `customerSdt: snapshot.customerSdt`.

Đổi tên property trong class DTO **chỉ đổi spec**. Runtime vẫn gửi `customerSdt`. Kết quả: drift-guard xanh, guard tên mới xanh, `tsc` có thể vẫn xanh (cast có thể qua kiểm "comparable" hoặc dev chữa TS2352 bằng `as unknown as`) ⇒ **spec nói `customerPhone`, server gửi `customerSdt`**. Client sinh ở 10.3/10.6 sẽ đọc `undefined`. Đây là lỗi duy nhất của story có thể đi qua mọi lane nếu không chặn đúng cách. Cách chặn ở D2 + AC 9.

### 3. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Bảng §4.2 là nguồn chân lý + một tinh chỉnh ghi lại theo G-5.** Đổi đúng 32 field + 3 schema của bảng "Field và schema DTO (10.2)" trong `sprint-change-proposal-2026-10-22.md`. Tinh chỉnh duy nhất (mặc định 10.1 đã tuyên bố ở "Câu hỏi mở 1" của story 10.1): **field form multipart `anh` → `files`** trên `POST /orders/{id}/transition` và `POST /orders/{id}/attachments` (`FilesInterceptor('anh', …)` ở `orders.controller.ts:857`, `:1139`; `fieldErrors` `field: 'anh'` ở `orders.service.ts:1592` và `orders/domain/attachment-limits.ts:99`). Lý do: tên field form là contract client multipart gửi lên; để tiếng Việt thì 10.3/10.5 sẽ gửi `anh` mãi. Ghi vào bảng §4.2 một khối "Tinh chỉnh 10.2" + bullet "Tinh chỉnh khi làm story" ở `epics.md` Story 10.2, **cùng commit**.

**D2 — Đổi tên ở RANH GIỚI controller, không đổi service/domain** (Jev 0.92). Quy tắc:
- **Response:** service, domain, view interface của service (`OrderListRow`, `OrderVersionRow`, `WarrantyLookupView`, `DiscountPendingView`, `StockListView`/`CanMuaView`, view phiếu kho, `TonKho`, `ThayDoiBanUpdate`) **giữ nguyên tên**. Mỗi response DTO có field đổi tên được dựng bằng **một hàm map có kiểu trả về tường minh**, ví dụ `export function toOrderResponseDto(view: OrderView): OrderResponseDto`, đặt **trong chính file DTO** của nó (không thêm thư mục mới; repo chưa có quy ước mapper — file DTO đã sở hữu hình dạng). Controller gọi hàm map thay cho `as XxxDto` ở **mọi** chỗ trả DTO đó (danh sách §2). Dùng chung hàm map cho DTO lồng (vd `toStockVoucherDetailDto` dùng ở `stock-vouchers.controller.ts` và cả hai chỗ `voucher:` của `orders.controller.ts`; `toCustomerResponseDto` dùng cho list, lookup, findOne, update, create).
- Hàm map **liệt kê từng field** (không `...spread` row Prisma). Spread sẽ kéo theo field DB không thuộc DTO và giữ luôn key cũ. Với `OrderResponseDto`, liệt kê đúng property mà class DTO khai.
- **CẤM** `as unknown as XxxDto` hoặc `as XxxDto` mới ở các handler đã đụng. Nếu TS báo lỗi ở hàm map thì sửa hàm map.
- **Request:** class request DTO đổi tên field. Service đang nhận DTO trực tiếp ⇒ đổi **đúng dòng đọc field** (`dto.customerSdt` → `dto.customerPhone`, `dto.sdt`/`dto.cccd` ở `customers.service.ts:189,203,238,250`, `dto.scopeThiCong/scopeVanChuyen` ở `orders.service.ts:2197,2216-2217`). Ghi xuống Prisma vẫn dùng tên cột Prisma (`customerSdt: sdt`, `cccd: dto.nationalId`). `cancel`: controller :950 `lyDo: dto.reason` (input nội bộ của `huyDon` giữ `lyDo`).
- **Mã `fieldErrors[].field` do service ném phải là tên field client gửi** (AD-5): `orders.service.ts:500` `'customerSdt'` → `'customerPhone'`; `:1374` `'lyDo'` → `'reason'`; `customers.service.ts:189` (create) + `:357` (trùng PK) `'sdt'` → `'phone'` ⇒ mọi caller của `normalizeOrThrow` giờ đều truyền `'phone'` — bỏ tham số `field` và union `'sdt' | 'phone'` (code đang sửa); `customer-type.ts:29` `FORBIDDEN_FIELDS[THUONG_MAI] = ['cccd']` → `['nationalId']` (mảng này được so với key của DTO ở `customers.service.ts:154` — đổi DTO mà không đổi mảng là khách Thương mại gửi kèm CCCD sẽ **lọt** thay vì 400); `'anh'` → `'files'` (D1).
- **KHÔNG đổi:** model/field Prisma (`customerSdt`, `scopeThiCong`, `chotAt`, `sdt`, `cccd` — tên field Prisma cũng là code đã có, đổi là đụng ~70 chỗ trong `orders.service.ts` và không thuộc contract); event + payload audit (`orderSnapshot()` `orders.service.ts:306-321`, `customer-events.ts`, `ma: ketQua.ma` trong event kho `stock-vouchers.service.ts:412,857`) — audit log là lịch sử đã ghi, đổi key làm lệch audit cũ (§6.6); snapshot JSON đã đóng băng trong DB (hợp đồng `contracts.service.ts:223-225` `sdt/cccd`, hoá đơn `invoice-snapshot.ts:13,40,77` `customerSdt`) — đọc row cũ phải còn chạy; enum value (`tinhTrang` vẫn `du`/`het`/`am`, `progress` vẫn `done`/`current`/`upcoming`); tên method service/port; nhãn hiển thị tiếng Việt; description tiếng Việt trong `@ApiProperty` (là tài liệu — chỉ sửa token tên field cũ nằm trong description, vd "`laBanHienLuc` phân giải qua…" → "`isCurrent` …").

**D3 — Mở rộng guard có sẵn `backend/test/no-vietnamese-api-contract.spec.ts`** (không tạo file mới; cùng một bất biến "contract tiếng Anh"):
- `OLD_SCHEMA_PROPERTIES` = 32 tên cũ của bảng + `'anh'`. `OLD_SCHEMA_NAMES = ['ThayDoiBanUpdateDto', 'ThayDoiSoLuongDto', 'CanMuaViewDto']`.
- Quét **đệ quy** mọi object có `properties` trong `components.schemas` (kể cả trong `allOf`/`items`/lồng) **và** mọi schema inline trong `paths.*.*.requestBody`/`responses` (multipart D1 có thể sinh inline). So **khớp nguyên key** (`OLD_SCHEMA_PROPERTIES.includes(key)`), KHÔNG substring: `tu`, `ma`, `ten`, `den` nằm trong rất nhiều tên tiếng Anh (`status`, `name`, `tenant`…) (memory `nested-label-parity-guard-blind`).
- Kiểm cả `$ref` trỏ tới tên schema cũ và key của `components.schemas`.
- **Chống guard rỗng (E-7):** số schema quét ≥ 100, số property quét ≥ 450 (đo hôm nay 108 / 527 — ghi con số đo SAU khi đổi vào comment, như guard đang làm cho path/param). Ca tự kiểm trên document tổng hợp: `{ components: { schemas: { ThayDoiBanUpdateDto: { properties: { them: {} } }, X: { properties: { nested: { properties: { lyDo: {} } } } } } }, paths: { '/x': { post: { requestBody: { content: { 'multipart/form-data': { schema: { properties: { anh: {} } } } } } } } } }` ⇒ đủ 4 vi phạm (schema name, `them`, `lyDo` lồng, `anh` inline); và `{ properties: { status: {}, name: {}, tenant: {} } }` ⇒ 0 vi phạm.
- Thông báo lỗi nêu `schema.property` vi phạm. Tên `describe`/`it`/comment tiếng Anh, giải thích bất biến, không nhắc mã story/AC.

**D4 — Parity design-system: giữ test, dịch qua MỘT bảng tường minh** (Jev 0.98). AC epics: KHÔNG sửa client ở story này. Nhưng hai test so port client với contract backend sẽ đỏ:
- `design-system/session/parity.test.mjs:531-576` ("stock-vouchers port … field for field with openapi.json") đọc spec, đòi mọi property của 11 schema phiếu kho xuất hiện trong cả hai port ⇒ `code`, `createdBy`, `lineCount`, `totalQty` (và `name`/`unit` theo nghĩa phiếu) sẽ không có trong port.
- `design-system/screens/order-detail.test.mjs:507-547` đọc `backend/src/orders/dto/order-version-item.dto.ts`, đòi DTO + port web + port mobile cùng một danh sách `VERSION_ITEM_FIELDS` (`laBanHienLuc`, `chotAt`, `soDong`, `thayDoi`).
Cách làm: phía backend/spec dùng tên MỚI; phía client so qua một bảng `CONTRACT_TO_CLIENT_FIELD` (tên contract mới → tên port client cũ) khai trong test, mỗi entry **phải được dùng** ít nhất một lần (assert, chống bảng thối), comment nói rõ: client port còn tên cũ cho tới khi port được thay bằng type sinh từ OpenAPI; khi đó xoá bảng (không ghi mã story vào comment — luật Stable Code Artifacts). Không xoá, không nới phần so sánh. Test parity giữa hai twin với danh sách gõ tay (`parity.test.mjs:521`, inventory) không đọc backend ⇒ giữ, chỉ sửa câu comment "Field names mirror the backend DTO word for word" (giờ sai) thành "mirror the client twin; the backend names differ until the ports use generated types".

**D5 — e2e chứng minh RUNTIME, không chỉ spec.** Với mỗi họ response DTO có field đổi tên, ít nhất một ca e2e qua `ValidationPipe`/controller thật (mock Prisma như file hiện có) assert `body.<mới>` có mặt **và** `body.<cũ>` là `undefined` (lồng thì assert ở cấp lồng: `body.items[0].changes.qtyChanged[0].from`, `body.voucher.createdBy`, `body.customer.phone`…). Request: ca 400 chứng minh `fieldErrors[].field` mang tên mới (`reason`, `customerPhone`, `phone`, `nationalId`, `files`), và ca gửi tên cũ ⇒ không được chấp nhận như tên mới (vd `POST /orders/{id}/cancel` body `{ lyDo: '…' }` ⇒ 400 `field: 'reason'` vì `lyDo` bị whitelist cắt).

### 4. Phạm vi

- **Trong:** 32 field + 3 schema + field form `anh`; hàm map ở ranh giới controller thay cast; dòng service đọc request DTO; mã `fieldErrors` do service ném; `@ApiBody`/`@ApiConsumes` cho hai endpoint multipart để spec có field `files` (xem Task 4); sinh lại `openapi.json`; mở rộng guard D3; e2e D5; cập nhật test so tên cũ (e2e, `openapi-drift.spec.ts:153-180`, unit test truyền request DTO); parity D4; docs G-5.
- **Ngoài (đừng làm):** sửa port/fake/màn web-mobile (AC 5 — fake viết lại theo type sinh ở 10.3/10.6; review KHÔNG coi tên cũ trong client là drift); đổi tên method port (10.5/10.8); CORS (10.3); field Prisma, cột DB, enum value, event/audit payload, snapshot JSON; đổi hành vi bất kỳ.

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:671-678`)

1. **Given** ~30 field DTO tiếng Việt (`sdt`, `customerSdt`, `cccd`, `chotAt`, `buoc`, `buocKeTiep`, `trangThai`, `coTheHuy`, `lyDo`, `laBanHienLuc`, `thayDoi`, `ten`, `donVi`, `khaDung`, `ma`, `nguoiTao`, `scopeThiCong`…) và 3 tên schema (`ThayDoiBanUpdateDto`, `ThayDoiSoLuongDto`, `CanMuaViewDto`), **When** đổi, **Then** theo đúng bảng đổi tên; tinh chỉnh nào (vd trùng tên trong cùng DTO) phải ghi lại vào bảng trong cùng commit (G-5) [Source: sprint-change-proposal-2026-10-22.md §4.2].
2. **Given** cột/bảng DB và enum value nghiệp vụ (khoá trạng thái, khoá event, loại khách, loại phiếu, `tinhTrang`), **When** đổi field, **Then** KHÔNG đổi — chỉ đổi tên trên contract; không migration (mặc định §6.6, §6.7).
3. **Given** validation trả `fieldErrors[].field`, **When** request sai, **Then** `field` mang tên mới (vd `reason`, không còn `lyDo`) — e2e qua `ValidationPipe` chứng minh (AD-5).
4. **Given** `openapi.json` sinh lại, **When** chạy guard mới, **Then** không property nào trong `components.schemas` thuộc danh sách tên tiếng Việt cũ, có assert chống-guard-rỗng; mutant đổi ngược một field ⇒ ĐỎ.
5. **Given** fake port web/mobile còn chép tay tên cũ, **When** story này xong, **Then** KHÔNG sửa client (chưa consumer HTTP); fake được viết lại theo type sinh ở 10.3/10.6 — ghi rõ trong Dev Notes để review không coi là drift.

### AC dẫn xuất (đo được)

6. `jq` trên spec sau khi sinh lại: tập property cũ ∩ spec = ∅ (cả 33 tên gồm `anh`); 3 schema mới `VersionChangesDto`, `QtyChangeDto`, `PurchaseNeedViewDto` có mặt, 3 tên cũ vắng; số schema vẫn 108 (+ tối đa 1 nếu Task 4 thêm DTO body multipart — ghi rõ); mỗi field mới nằm đúng schema của bảng §1 với cùng `type`/`required`/`nullable`/`enum`/`description` (trừ token tên field trong description). Lệnh so: dựng map đổi tên, áp lên `git show bf4e520:backend/openapi/openapi.json`, so với spec mới bằng `jq -S` ⇒ khác biệt chỉ còn phần requestBody multipart của Task 4. Ghi lệnh + kết quả vào Dev Agent Record.
7. `paths` không đổi: cùng 58 path, cùng method, cùng operationId, cùng tham số (10.1 đã khoá).
8. `migrations/` và `schema.prisma` không đổi (`git diff --stat bf4e520 -- backend/prisma` rỗng); không event/audit payload nào đổi key (`git diff` trên `*/domain/*-events.ts` và `orderSnapshot` rỗng).
9. **Runtime = spec:** không còn `as <Tên>Dto` (và không `as unknown as`) ở các handler trả DTO có field đổi tên (danh sách §2); `grep -nE "as (unknown as )?(Order|Customer|CustomerList|CustomerLookup|OrderList|DiscountPendingItem|WarrantyLookup|OrderVersions|StockList|StockVoucher[A-Za-z]*|InvoiceDetail[A-Za-z]*)Dto" backend/src` = 0 dòng (cast của DTO không đổi tên như `PreviewTotalResponseDto`, `ProductResponseDto` được phép giữ). e2e D5 xanh cho cả 13 họ response: Customer (create/list/get/patch/lookup), Order (detail + 1 action ghi), OrderList, DiscountPending, WarrantyLookup (top + `customer.phone` + `orders[].confirmedAt`), Lifecycle (`steps[].progress`, `nextSteps`, `canCancel`), Versions (`isCurrent`, `confirmedAt`, `lineCount`, `changes.added/removed/qtyChanged[].{name,from,to}`), Attachments list (`canDelete`, `uploadedBy`), Attachment upload + transition (`savedAttachmentCount`), StockList (`items[].{name,unit,available,toPurchase,stockStatus}`, `purchaseList[]`), StockVoucher summary/detail (`code`, `createdBy`, `lineCount`, `totalQty`, `lines[].{name,unit}`, `returnOf.code`), order stock-issue `voucher.code`, InvoiceDetail `customerPhone`.
10. `fieldErrors` tên mới, e2e: `cancel` thiếu/ngắn `reason` ⇒ 400 `field: 'reason'`; `POST /orders` SĐT sai ⇒ `customerPhone`; `POST /customers` SĐT sai ⇒ `phone`, trùng SĐT ⇒ 409 `field: 'phone'`; khách `THUONG_MAI` gửi `nationalId` ⇒ 400 `field: 'nationalId'`; `PATCH /customers/{phone}` gửi `phone` trong body ⇒ 400 (`@IsAbsent` trên field mới); upload 0 file ⇒ 400 `field: 'files'`; multipart gửi file dưới tên `anh` ⇒ không được nhận như `files` (Multer `LIMIT_UNEXPECTED_FILE` hoặc 400 — đo thật, ghi kết quả; KHÔNG được 500).
11. Guard D3 xanh; **mutation bắt buộc** (backup bằng `cp`, KHÔNG `git checkout` — memory `mutation-test-never-git-checkout`; khôi phục + regen ⇒ `cmp` sạch):
    - M1: đổi ngược một property response (vd `isCurrent` → `laBanHienLuc` trong DTO) + `npm run openapi:gen` ⇒ guard ĐỎ đúng `OrderVersionItemDto.laBanHienLuc`.
    - M2: đổi tên class `QtyChangeDto` → `ThayDoiSoLuongDto` + regen ⇒ guard ĐỎ ca schema name.
    - M3: làm rỗng bộ trích property ⇒ ca chống-rỗng ĐỎ.
    - M4 (runtime): một handler bỏ hàm map, trả lại object service bằng `as unknown as OrderVersionsResponseDto` ⇒ e2e D5 ĐỎ, guard D3 + drift XANH (chứng minh vì sao D5 tồn tại — memory `mutation-hits-one-layer-only`).
    - M5: `FORBIDDEN_FIELDS` về `['cccd']` ⇒ e2e `nationalId` ĐỎ.
    - M6: `field: 'reason'` → `'lyDo'` ở service ⇒ e2e ĐỎ.
    - M7: xoá một entry khỏi `CONTRACT_TO_CLIENT_FIELD` (D4) ⇒ design-system ĐỎ; thêm một entry thừa ⇒ ĐỎ (chống bảng thối).
    Mỗi mutant phải compile (memory `mutation-must-compile-or-false-red`).
12. `grep -rnwE "sdt|customerSdt|cccd|chotAt|buoc|buocKeTiep|trangThai|coTheHuy|coTheXoa|nguoiTaiLen|soAnhDaLuu|laBanHienLuc|soDong|thayDoi|them|xoa|doiSoLuong|donVi|khaDung|canNhap|tinhTrang|danhSachCanMua|nguoiTao|tongSoLuong|lyDo|scopeThiCong|scopeThietBi|scopeVanChuyen|ThayDoiBanUpdateDto|ThayDoiSoLuongDto|CanMuaViewDto" backend/src --include='*.dto.ts'` chỉ còn token trong comment giải thích cột DB (nếu có) — 0 property declaration. (`ten`/`tu`/`den`/`ma` kiểm riêng bằng `grep -nE "^\s+(ten|tu|den|ma)[!?]:" backend/src --include='*.dto.ts'` = 0.)
13. 5 lane xanh trên máy: backend `npm test`, `npm run build`, `npm run test:db` (cần Docker Desktop + `pns-postgres` — memory `db-lane-needs-docker-desktop-gui`; không lên được ⇒ ghi "lane DB chưa chạy" và hỏi Đại Ca), design-system `node --test`, web `npm run typecheck && npm test`, mobile `flutter analyze` + `flutter test` (client không đổi nhưng vẫn chạy). Lint: so baseline từng file (memory `backend-lint-red-at-baseline`), không thêm lỗi ở file đã sửa.
14. Docs G-5 cùng commit (Task 9).

## Tasks / Subtasks

- [x] **Task 1 — Baseline** (AC: 6, 13)
  - [x] `cp backend/openapi/openapi.json` ra scratchpad làm bản so; ghi số schema (108) và số property (527).
  - [x] Backend `npm test` ghi số suite/test; lint đếm theo file trước khi sửa.
- [x] **Task 2 — Response DTO + hàm map** (AC: 1, 6, 9)
  - [x] Đổi property + `@ApiProperty` trong các file DTO §1; đổi tên 3 class schema (và mọi import).
  - [x] Viết hàm map có kiểu trả về tường minh trong từng file DTO (D2), liệt kê từng field; DTO lồng gọi hàm map con (`toVersionChangesDto` → `toQtyChangeDto`; `toStockListResponseDto` → item + purchase need; `toStockVoucherDetailDto` → line/returnOf/returnVoucher/creator; `toWarrantyLookupResponseDto` → customer + order).
  - [x] Thay cast bằng hàm map ở mọi handler §2 (orders, customers, stock-items, stock-vouchers, stock-issue `voucher:`); `invoices`: map `customerPhone` ở ranh giới controller hoặc tại điểm dựng DTO detail, KHÔNG đổi type snapshot.
  - [x] Handler đã tự dựng object (`lifecycle` :359-363, `transition`/`addAttachments` `soAnhDaLuu` :901, :1174): đổi key trong literal.
- [x] **Task 3 — Request DTO + fieldErrors** (AC: 3, 10)
  - [x] `CreateCustomerRequestDto.phone/nationalId`, `UpdateCustomerRequestDto.phone` (`@IsAbsent`, sửa comment + thông báo nếu nhắc `sdt`) `/nationalId`, `CreateOrderRequestDto.customerPhone`, `UpdateOrderRequestDto.scopeConstruction/scopeDelivery`, `CancelOrderRequestDto.reason`; đổi đúng dòng service đọc chúng (D2).
  - [x] Mã `fieldErrors` do service ném (D2: `customerPhone`, `reason`, `phone`, `nationalId`, `files`); bỏ tham số `field` của `normalizeOrThrow`.
  - [x] `orders.service.spec.ts`, `customers.service.spec.ts`, `order-cancel.spec.ts`… chỉ đổi chỗ truyền request DTO / assert `fieldErrors`; KHÔNG đổi assert hành vi. Nếu một assert phải đổi ngoài tên ⇒ dừng, đó là dấu hiệu đổi hành vi.
- [x] **Task 4 — Multipart `anh` → `files`** (AC: 1, 10)
  - [x] `FilesInterceptor('files', TRAN_CUNG_SO_ANH, { limits })` ở :857 và :1139 — **ngưỡng `limits` giữ nguyên** (memory `multer-limits-bypass-error-envelope`: limit phải lớn hơn ngưỡng contract để lỗi ra envelope 400, không phải MulterError 500).
  - [x] Spec phải mô tả field `files` (mảng `string`/`binary`): `StatusChangeRequestDto` thêm `files` với `@ApiPropertyOptional({ type: 'array', items: { type: 'string', format: 'binary' } })` + `@IsOptional()` (whitelist không cắt gì vì Multer đưa file vào `req.files`, không vào body); `POST /orders/{id}/attachments` thêm `@ApiConsumes('multipart/form-data')` + `@ApiBody` (một DTO nhỏ `AttachmentUploadRequestDto { files }` trong `attachment-response.dto.ts` hoặc file DTO cạnh nó). Đây là thêm tài liệu, không đổi hành vi.
  - [x] `orders.service.ts:1592`, `attachment-limits.ts:99` `field: 'files'`; e2e/unit gửi `.attach('anh', …)` → `'files'`.
- [x] **Task 5 — Sinh lại spec** (AC: 6, 7, 8)
  - [x] `cd backend && npm run openapi:gen`; KHÔNG sửa tay `openapi.json` (AD-12). Chạy lệnh so AC 6–8, dán kết quả rút gọn vào Dev Agent Record.
  - [x] Sửa `test/openapi-drift.spec.ts:153-180` (danh sách field `CustomerLookupResponseDto`/`CustomerResponseDto` → `phone`, `nationalId`; comment :169).
- [x] **Task 6 — Guard D3** (AC: 4, 11)
  - [x] Mở rộng `backend/test/no-vietnamese-api-contract.spec.ts` theo D3 (hàm quét riêng cho schema, giữ nguyên phần path/param/operationId của 10.1).
- [x] **Task 7 — e2e D5** (AC: 3, 9, 10)
  - [x] Đổi key trong e2e có sẵn: `orders.e2e.spec.ts` (~131 chỗ khớp tên cũ — phần lớn là fixture Prisma mock `customerSdt`/`scopeThiCong`, những chỗ đó GIỮ vì là row Prisma; chỉ đổi body request và assert response), `customers.e2e.spec.ts`, `stock-items.e2e.spec.ts`, `stock-vouchers.e2e.spec.ts`, `order-stock-issue.e2e.spec.ts`, `invoices.e2e.spec.ts`, `invoice-document.e2e.spec.ts`, `contracts.e2e.spec.ts`.
  - [x] Thêm assert "key mới có, key cũ `undefined`" cho 13 họ AC 9 (gộp vào ca thành công có sẵn khi được, không nhân bản fixture) và ca 400/409 AC 10.
  - [x] Chạy M1–M7, ghi bảng kết quả.
- [x] **Task 8 — Parity design-system D4** (AC: 5, 11)
  - [x] `parity.test.mjs` (stock-vouchers) + `screens/order-detail.test.mjs` (version item) theo D4; comment inventory `:519-520`.
  - [x] KHÔNG sửa `web/src/**`, `mobile/lib/**`, `mobile/test/**`.
- [x] **Task 9 — Docs cùng commit (G-5)** (AC: 1, 14)
  - [x] `sprint-change-proposal-2026-10-22.md` §4.2: thêm khối "Tinh chỉnh 10.2" (field form `anh` → `files`; `fieldErrors` do service ném đổi theo tên field mới; `FORBIDDEN_FIELDS` theo tên DTO).
  - [x] `epics.md` Story 10.2: bullet "Tinh chỉnh khi làm story" (mẫu bullet của Story 10.1).
  - [x] `backend/CONVENTIONS.md:14`, `_bmad-output/project-context.md:87`, spine `ARCHITECTURE-SPINE.md:187`: câu "field DTO tiếng Việt cũ đổi ở/giữ tới Story 10.2" → "field DTO đã tiếng Anh từ Story 10.2 (guard `no-vietnamese-api-contract.spec.ts` soi cả schema)". Thêm vào CONVENTIONS một dòng quy ước: response DTO dựng bằng hàm map có kiểu tường minh, không cast `as XxxDto` object service/Prisma (lý do: không có serializer, cast làm spec lệch runtime).
- [x] **Task 10 — 5 lane + build** (AC: 13)
  - [x] Như AC 13. Không `dart format` ghi file (memory `dart-format-writes-files-cascade`).

## Dev Notes

### Quyết định đã chốt — không bàn lại

- Correct-course 2026-10-22: bảng §4.2 là nguồn chân lý; đổi cứng không alias (§6.4); enum value + cột DB giữ (§6.6, §6.7); method port client đổi ở 10.5/10.8 (§6.8); fake viết lại ở 10.3/10.6 (§6.20).
- **Client còn tên cũ là CÓ CHỦ ĐÍCH (AC 5).** Review KHÔNG coi `laBanHienLuc`, `ma`, `customerSdt`… trong `web/src`/`mobile/lib` là drift. Chỗ duy nhất so client với contract là bảng D4, có hạn xoá rõ ràng.
- D2 ranh giới controller: `jev_judge` 0.92. D4 bảng dịch: `jev_judge` 0.98. D1 `anh` → `files`: Jev không chắc (0.38); quyết theo mặc định đã tuyên bố ở story 10.1 (Câu hỏi mở 1) + mục tiêu story "mọi field request trên contract là tiếng Anh".
- Luật ngôn ngữ (`project-context.md:87`): code đang sửa ⇒ tiếng Anh (hàm map, biến mới); KHÔNG đổi tên hàng loạt symbol tiếng Việt cạnh đó (`vongDoi`, `ketQua`, `anGiaVonDongPhieu`, `lietKeTonKho`, `TonKho`, `ThayDoiBanUpdate`…).

### Files sẽ đổi / tạo

| File | Đổi gì |
|---|---|
| 18 file DTO §1 | property, class schema, hàm map `to…Dto` |
| `backend/src/orders/orders.controller.ts` | thay cast bằng hàm map; literal lifecycle/`soAnhDaLuu`; `dto.reason`; `FilesInterceptor('files')`; `@ApiConsumes`/`@ApiBody` |
| `backend/src/customers/customers.controller.ts` | thay 5 cast |
| `backend/src/inventory/stock-items.controller.ts`, `stock-vouchers.controller.ts` | thay cast |
| `backend/src/invoices/invoices.controller.ts` (hoặc điểm dựng DTO detail) | `customerPhone` |
| `backend/src/orders/orders.service.ts` | đọc `dto.customerPhone`, `dto.scopeConstruction/scopeDelivery`; `field` `customerPhone`/`reason`/`files` |
| `backend/src/customers/customers.service.ts`, `customers/domain/customer-type.ts` | đọc `dto.phone/nationalId`; `field: 'phone'`; `FORBIDDEN_FIELDS` |
| `backend/src/orders/domain/attachment-limits.ts` | `field: 'files'` |
| `backend/openapi/openapi.json` | SINH LẠI |
| `backend/test/no-vietnamese-api-contract.spec.ts` | mở rộng D3 |
| `backend/test/*.e2e.spec.ts` (8), `openapi-drift.spec.ts`, unit spec truyền request DTO | tên field + ca D5 |
| `design-system/session/parity.test.mjs`, `design-system/screens/order-detail.test.mjs` | D4 |
| `backend/CONVENTIONS.md`, spine, `project-context.md`, proposal §4.2, `epics.md` | docs G-5 |

### Hiện trạng phải giữ

- `@RequirePermissions`, phạm vi đơn (`findScopedOrThrow`), thứ tự route, `operationId` — không đụng (guard `no-handler-without-require-permissions`, `no-unscoped-order-write`, `orders-read-gate` vẫn xanh).
- Ẩn giá vốn: `anGiaVonDongPhieu` (`inventory/domain/stock-voucher-visibility.ts:8`) `delete` key `unitCost` khi thiếu `costs.view`. Gọi nó TRƯỚC hàm map, và hàm map chỉ chép `unitCost` khi key có mặt (`...('unitCost' in l ? { unitCost: l.unitCost } : {})`) — để test gọi thẳng controller/hàm map (không qua JSON) vẫn thấy key vắng. KHÔNG đảo thứ tự (map trước rồi mới ẩn): hàm ẩn có kiểu generic trên `lines`, đảo thứ tự vẫn compile.
- Field optional/nullable: DTO khai `?`/`nullable` thì hàm map giữ đúng (vd `voucher` vắng khi chưa xuất, `returnOf` vắng); đừng biến "vắng" thành `null` hay ngược lại — parity optionality ở `parity.test.mjs:603-618` đang khoá `OrderStockIssue*`.
- `OrderResponseDto`: liệt kê đủ mọi property class DTO khai (gồm `lineItems`, `discount`, `currentVersionId`…), đọc class trước khi viết; e2e hiện có trên `GET /orders/{id}` phải xanh không đổi assert ngoài tên.
- Ngày giờ: trả `Date` như hiện nay (Nest serialize ISO) — không tự `toISOString()` trong hàm map.

### Tình huống biên đã tính

- `PATCH /customers/{phone}` body có `sdt` cũ: whitelist cắt lặng (không `forbidNonWhitelisted`) ⇒ 200, khác trước (trước là 400 `@IsAbsent`). Chấp nhận: tên mới `phone` mới là field bị cấm; ghi vào Completion Notes, không thêm `forbidNonWhitelisted` (đổi hành vi toàn cục).
- `name`/`unit`/`available`/`code`/`from`/`to` đều trùng tên tiếng Anh ở schema KHÁC — không sao; guard so key cũ, không so key mới.
- Guard substring: `tu` ⊂ `status`, `ma` ⊂ `email`, `ten` ⊂ `tenant`/`content` ⇒ BẮT BUỘC so nguyên key (D3 có ca âm).
- Prettier có thể tách chuỗi `.create(...)` — không liên quan story này, nhưng hàm map nhiều dòng nên chạy `npx prettier --write` chỉ trên file đã sửa (memory `prettier-chain-blinds-scope-guard`).
- `money-fields.mjs` sinh tập field tiền từ spec theo tên/description; không field đổi tên nào là tiền (đã đo: `afterDiscount, amount, costPrice, difference, …, vatAmount`) — guard tiền không bị ảnh hưởng; nếu description field đổi tên có chữ "đồng" (memory `money-fields-dong-matches-hop-dong`) thì guard sẽ nói, đừng viết "đồng" vào description số đếm.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Guard phải có chống-rỗng + ca tự kiểm dương/âm (memory `source-guards-mutate-for-false-pass`, `nested-label-parity-guard-blind`).
- AC về mã HTTP/`fieldErrors` chỉ đo được ở lane e2e qua `ValidationPipe` thật (memory `dev-pins-ac-deviation-as-green-test`) — không ghim độ lệch AC thành test xanh.
- Mutation: `cp` backup, mutant compile, M4 chứng minh lớp runtime riêng (memory `mutation-hits-one-layer-only`).
- e2e dùng `test/util/listen-loopback.ts` có sẵn.
- Lane DB: story không thêm ca DB; DB spec gọi service trực tiếp nên phần lớn không đổi (D2 giữ service) — vẫn chạy toàn lane.

### Previous Story Intelligence (10.1, commit `bf4e520`)

- 10.1 tạo guard `no-vietnamese-api-contract.spec.ts` (path/param/operationId, chống-rỗng, ca tổng hợp) — mở rộng đúng file đó, giữ khuôn `scanContract` + hằng danh sách.
- 10.1 Review LOW để lại: guard chỉ cấm tên cũ, tên tiếng Việt MỚI sẽ lọt — vẫn đúng ở 10.2 (không có từ điển); luật ngôn ngữ cho code mới do review canh. Không mở rộng phạm vi.
- 10.1 phát hiện lỗi service ném `fieldErrors` trỏ tên cũ ⇒ D2 đã liệt kê sẵn mọi chỗ service ném `field` tên tiếng Việt (grep `field: '` toàn `src`).
- 10.1 phát hiện guard khác lọc theo chuỗi tiếng Việt (`warranty-readonly.spec.ts`) ⇒ trước khi chạy lane, `grep -rn` tên cũ trong `backend/test/*.spec.ts` không phải e2e (guard/source-guard) và xử lý từng chỗ.
- Mẫu commit: `refactor(api): rename Vietnamese DTO fields and schemas to English` (conventional, không nhắc AI/mã plan).

### Git intelligence

- `bf4e520` feat(story-10.1) — route/param/operationId + guard; `a1a4edc` harden source guards; `68e8726` docs(epic-10) proposal (nguồn bảng §4.2). Không thêm thư viện.

### Latest tech notes

- `@nestjs/swagger`: tên schema = tên class; đổi tên class là đổi schema. `@ApiProperty({ type: () => X })` cần cập nhật khi đổi tên class lồng. Multipart: `@ApiConsumes('multipart/form-data')` + `@ApiBody({ type: Dto })`; file mảng khai `type: 'array', items: { type: 'string', format: 'binary' }`. Không cần tra web (đều là API đã dùng trong repo hoặc tài liệu chuẩn của thư viện đang cài).

### Project Structure Notes

- Không file mới trong `src/` ngoài khả năng một DTO body multipart (đặt trong `orders/dto/`, kebab-case). Không file test mới (guard mở rộng file có sẵn).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. `PATCH /customers/{phone}` gửi `sdt` cũ giờ bị cắt lặng thay vì 400 (Tình huống biên). Mặc định: chấp nhận, ghi chú; muốn chặn tên cũ thì cần `forbidNonWhitelisted` toàn cục — việc riêng.
2. Nếu sau khi viết hàm map, `OrderResponseDto` lộ field Prisma đang trả mà DTO không khai (do trước đây cast spread cả row) ⇒ client hiện tại không dùng (0 consumer). Mặc định: hàm map chỉ trả field DTO khai; ghi danh sách field bị bỏ vào Completion Notes.

### References

- `_bmad-output/planning-artifacts/epics.md:671-678` — Story 10.2; `:657-668` Epic 10 + 10.1
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §4.2 (bảng field/schema + khối Tinh chỉnh 10.1), §6.4, §6.6, §6.7, §6.8, §6.20
- `_bmad-output/implementation-artifacts/10-1-doi-route-va-tham-so-tieng-viet-sang-tieng-anh.md` (Câu hỏi mở 1–2, Review LOW)
- Spine `ARCHITECTURE-SPINE.md` AD-5, AD-12, :187; `_bmad-output/project-context.md:87`; `backend/CONVENTIONS.md:14`
- `backend/test/no-vietnamese-api-contract.spec.ts`, `backend/test/openapi-drift.spec.ts:153-180`, `backend/src/common/validation/validation-pipe.factory.ts`
- `design-system/session/parity.test.mjs:515-630`, `design-system/screens/order-detail.test.mjs:498-547`

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, bmad-dev-story)

### Debug Log References

- Baseline (trước khi sửa, `bf4e520`): backend `npx jest` 117 suite / 2447 test xanh; ESLint 75 lỗi có sẵn (prettier); spec 108 schema / 527 property / 58 path.
- `npm run openapi:gen` sau khi đổi: **109 schema** (+1 `AttachmentUploadRequestDto`, Task 4), **529 property** (+2 `files`: `StatusChangeRequestDto.files`, `AttachmentUploadRequestDto.files`), 58 path.
- AC 6 — lệnh so: script node áp bảng đổi tên (32 property + 3 schema + `$ref` + `required`) lên `git show bf4e520:backend/openapi/openapi.json` rồi so sâu với spec mới. Khác biệt CÒN LẠI (đúng kỳ vọng): token tên field trong 5 description (`sdt`→`phone` ×3 ở `/customers`, `laBanHienLuc`→`isCurrent` ở `/orders/{id}/versions`, `buocKeTiep`→`nextSteps` ở `canCancel`, `canNhap`→`toPurchase` ở `purchaseList`) + phần multipart Task 4 (`/orders/{id}/attachments.post.requestBody` → `$ref AttachmentUploadRequestDto`, `StatusChangeRequestDto.properties.files`, schema `AttachmentUploadRequestDto`). Không lệch `type`/`required`/`nullable`/`enum`.
- AC 7 — `jq` paths/method/operationId/parameters của baseline vs mới: giống hệt (58 path).
- AC 8 — `git diff --stat bf4e520 -- backend/prisma` rỗng; `src/*/domain/*-events.ts` và `orderSnapshot()` không đổi.
- AC 9 — `grep -nE "as (unknown as )?(Order|Customer|…|InvoiceDetail[A-Za-z]*)Dto" backend/src` = 0 dòng. (`as unknown as` còn 2 chỗ ở `catalog/product-groups.controller.ts` — có sẵn, DTO không đổi tên, ngoài phạm vi.)
- AC 12 — 0 property declaration tên cũ trong `*.dto.ts` (`grep -nE "^\s+(…|ten|tu|den|ma)[!?]:"` = 0). Grep `-w` của AC vẫn khớp các dòng ĐỌC nguồn bên phải trong hàm map (`phone: customer.sdt`, `available: item.khaDung`…) và 2 comment giải thích cột DB — hệ quả trực tiếp của D2 (hàm map đặt trong file DTO), không phải property.
- Mutation (backup `cp`, khôi phục + regen ⇒ `cmp` spec sạch ở mọi ca):

| Mutant | Kết quả |
|---|---|
| M1 `isCurrent` → `laBanHienLuc` (DTO + hàm map) + regen | guard ĐỎ `property OrderVersionItemDto.laBanHienLuc` |
| M2 class `QtyChangeDto` → `ThayDoiSoLuongDto` + regen | guard ĐỎ `schema name "ThayDoiSoLuongDto"` + `$ref` từ `VersionChangesDto.qtyChanged` + ca "renamed schemas exist" |
| M3 bộ trích `properties` tắt | ca chống-rỗng ĐỎ |
| M4 `listVersions` trả lại object service `as unknown as OrderVersionsResponseDto` | e2e `/versions` ĐỎ; guard D3 XANH, drift XANH (lớp runtime riêng) |
| M5 `FORBIDDEN_FIELDS` về `['cccd']` | e2e `nationalId` ĐỎ |
| M6 `field: 'reason'` → `'lyDo'` ở `huyDon` | e2e cancel ĐỎ (3 ca) |
| M7 bỏ entry `createdBy` / thêm entry thừa (`parity.test.mjs`); bỏ `isCurrent` / thêm entry thừa (`order-detail.test.mjs`) | design-system ĐỎ cả 4 |

- 5 lane sau khi xong: backend `npx jest` **117 / 2459** xanh (+12 test), `npm run build` xanh, `tsc --noEmit` xanh; `npm run test:db` **26 suite / 322** xanh (Docker `pns-postgres`); design-system **487/487**; web `typecheck` xanh + `npm test` 195/195 (một lần đỏ 1 test khi chạy song song với lane DB + flutter; chạy lại 3/3 lần xanh; `web/` không có thay đổi nào); mobile `flutter analyze` 0 issue + `flutter test` all passed. Lint: 75 → 52 lỗi (prettier trên file đã sửa), không file nào tăng lỗi.

### Completion Notes List

- Đổi đúng 32 field + 3 schema của bảng §4.2 và field form `anh` → `files`. Response dựng qua hàm map `to…Dto` có kiểu trả về tường minh trong chính file DTO (liệt kê từng field, không spread), controller gọi hàm map thay cho mọi cast `as XxxDto` ở §2; `toStockVoucherDetailDto` dùng chung cho `stock-vouchers.controller.ts` và hai chỗ `voucher:` của `orders.controller.ts`, luôn gọi SAU `anGiaVonDongPhieu` và giữ key `unitCost`/`orderId`/`returnOfVoucherId`/`returnOf`/`returnVoucher` vắng khi nguồn vắng.
- `GET /orders/{id}/stock-issue`: bỏ `...view` + cast, liệt kê field (`voucher` vẫn vắng khi chưa xuất).
- `invoices`: `toInvoiceDetailResponseDto` ở controller; `InvoiceDetailView`/snapshot giữ `customerSdt` (PDF vẫn đọc `detail.customerSdt`).
- Request: DTO đổi tên; service đổi đúng dòng đọc (`dto.phone`, `dto.nationalId`, `dto.customerPhone`, `dto.scopeConstruction/scopeDelivery`; cancel `lyDo: dto.reason`). `fieldErrors` do service ném: `customerPhone`, `reason`, `phone` (create + 409 trùng), `nationalId` (qua `FORBIDDEN_FIELDS`), `files` / `files[i]`. `normalizeOrThrow` bỏ tham số `field`.
- Đo thật (AC 10): multipart gửi file dưới tên cũ `anh` ⇒ **400 `VALIDATION_ERROR` "Unexpected field - anh"** (Multer `LIMIT_UNEXPECTED_FILE` đi qua envelope), không 500 — đã khoá bằng e2e.
- Tình huống biên đã chấp nhận (Câu hỏi mở 1): `PATCH /customers/{phone}` body có `sdt` cũ giờ bị whitelist cắt lặng ⇒ 200 (tên bị cấm bây giờ là `phone`). Tương tự `POST /orders/{id}/cancel` với `{ lyDo }` ⇒ 400 `field: 'reason'`; `POST /orders` với `{ customerSdt }` ⇒ 400 `field: 'customerPhone'` (đều có e2e).
- Câu hỏi mở 2: `OrderResponseDto` khai đủ mọi cột scalar của model `Order` ⇒ hàm map không bỏ field nào client đang nhận (chỉ đổi tên). `DiscountPendingItemDto`, `WarrantyLookupResponseDto`, `OrderListItemDto`, phiếu kho: view service trùng đúng tập field DTO ⇒ không field nào bị bỏ.
- **AC 5 — client còn tên cũ là CÓ CHỦ ĐÍCH:** không sửa `web/src/**`, `mobile/lib/**`, `mobile/test/**`. Port/fake viết lại theo type sinh ở 10.3/10.6. Chỗ duy nhất so client với contract là hai bảng `CONTRACT_TO_CLIENT_FIELD` (D4) trong `design-system/session/parity.test.mjs` và `design-system/screens/order-detail.test.mjs` — mỗi entry phải được dùng; xoá bảng khi port dùng type sinh.
- Guard D3 mở rộng file có sẵn: quét đệ quy mọi node của `components.schemas` và mọi operation (requestBody/responses/parameters), so nguyên key, kiểm `$ref` tới tên schema cũ; chống-rỗng ≥ 100 schema / ≥ 450 property (đo 109 / 529); ca tự kiểm dương (4 vi phạm + `$ref` trong `items`/`allOf`) và âm (`status`/`name`/`tenant`).
- Docs G-5: khối "Tinh chỉnh 10.2" trong proposal §4.2; bullet "Tinh chỉnh khi làm story" ở `epics.md` Story 10.2; câu ngôn ngữ contract ở `CONVENTIONS.md`, `project-context.md`, spine; thêm dòng quy ước "Response DTO dựng bằng hàm map, không cast" vào `CONVENTIONS.md`.
- Comment mới viết tiếng Anh; comment tiếng Việt có sẵn chỉ sửa token tên field.

### File List

- `backend/src/customers/customers.controller.ts`
- `backend/src/customers/customers.service.ts`
- `backend/src/customers/domain/customer-type.ts`
- `backend/src/customers/dto/create-customer-request.dto.ts`
- `backend/src/customers/dto/customer-list-response.dto.ts`
- `backend/src/customers/dto/customer-lookup-response.dto.ts`
- `backend/src/customers/dto/customer-response.dto.ts`
- `backend/src/customers/dto/is-absent.decorator.ts`
- `backend/src/customers/dto/update-customer-request.dto.ts`
- `backend/src/inventory/dto/stock-list-response.dto.ts`
- `backend/src/inventory/dto/stock-voucher-response.dto.ts`
- `backend/src/inventory/stock-items.controller.ts`
- `backend/src/inventory/stock-vouchers.controller.ts`
- `backend/src/invoices/dto/invoice-detail-response.dto.ts`
- `backend/src/invoices/invoices.controller.ts`
- `backend/src/orders/domain/attachment-limits.ts`
- `backend/src/orders/dto/attachment-response.dto.ts`
- `backend/src/orders/dto/attachment-upload-request.dto.ts` (mới)
- `backend/src/orders/dto/cancel-order-request.dto.ts`
- `backend/src/orders/dto/create-order-request.dto.ts`
- `backend/src/orders/dto/discount-pending-item.dto.ts`
- `backend/src/orders/dto/order-lifecycle-response.dto.ts`
- `backend/src/orders/dto/order-list-item.dto.ts`
- `backend/src/orders/dto/order-list-response.dto.ts`
- `backend/src/orders/dto/order-response.dto.ts`
- `backend/src/orders/dto/order-version-item.dto.ts`
- `backend/src/orders/dto/order-versions-response.dto.ts`
- `backend/src/orders/dto/status-change-request.dto.ts`
- `backend/src/orders/dto/status-change-response.dto.ts`
- `backend/src/orders/dto/update-order-request.dto.ts`
- `backend/src/orders/dto/warranty-lookup-response.dto.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/src/orders/orders.service.ts`
- `backend/openapi/openapi.json` (sinh lại)
- `backend/test/no-vietnamese-api-contract.spec.ts`
- `backend/test/openapi-drift.spec.ts`
- `backend/test/attachment-limits.spec.ts`
- `backend/test/order-cancel.spec.ts`
- `backend/test/orders.service.spec.ts`
- `backend/test/orders-write-scope.spec.ts`
- `backend/test/customers.service.spec.ts`
- `backend/test/customers.e2e.spec.ts`
- `backend/test/orders.e2e.spec.ts`
- `backend/test/stock-items.e2e.spec.ts`
- `backend/test/stock-vouchers.e2e.spec.ts`
- `backend/test/order-stock-issue.e2e.spec.ts`
- `backend/test/invoice-document.e2e.spec.ts`
- `backend/test/orders.db.integration.spec.ts`
- `backend/test/orders-write-scope.db.integration.spec.ts`
- `backend/test/discount-approvals.db.integration.spec.ts`
- `backend/test/quote-exports.db.integration.spec.ts`
- `design-system/session/parity.test.mjs`
- `design-system/screens/order-detail.test.mjs`
- `backend/CONVENTIONS.md`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/10-2-doi-field-dto-tieng-viet-sang-tieng-anh.md`

### Senior Developer Review (AI)

Reviewer: Đại Ca (AI, `/ck:code-review` + subagent `code-reviewer` chỉ đọc) — 2026-10-22. Kết quả: **Approve sau khi sửa** (0 CRITICAL, 0 HIGH).

AC 1–14 đã đối chiếu với code. Mọi task đánh [x] đều có bằng chứng. File List khớp `git status`; file mới `attachment-upload-request.dto.ts` vẫn chưa track nên phải `git add` khi commit.

| # | Mức | Finding | Xử lý |
|---|---|---|---|
| 1 | MEDIUM | Các action ghi của Order (`POST /orders`, `confirm`, `revise`, `update`, discount ×2) chỉ assert key mới. Đặt lại cast `as unknown as OrderResponseDto` ở `create` thì e2e vẫn xanh và `customerSdt` lọt ra client. AC 9 đòi "Order detail + 1 action ghi". | Thêm `expectOrderResponseKeys` vào `orders.e2e.spec.ts`: không key nào ngoài tập `OrderResponseDto`. Áp cho `POST /orders` 201 và `confirm` 200. Mutant (compile được) đặt cast lại ở `create` ⇒ ĐỎ, ở `confirm` ⇒ ĐỎ. |
| 2 | MEDIUM | Description trên contract còn tên field cũ: `scopeThietBi` (PATCH `/orders/{id}`) và `coTheXoa` (GET attachments), nằm ở `orders.controller.ts`. | Đổi thành `scopeEquipment` / `canDelete`, sinh lại spec. `jq` trên mọi `description`/`summary` khớp nguyên từ 33 tên cũ ⇒ 0. |
| 3 | LOW | `AttachmentUploadRequestDto.files` khai optional, trong khi route từ chối 0 ảnh (400 `minCount`). Client sinh từ spec sẽ cho phép upload rỗng. | Đổi thành `@ApiProperty` + `files!`, spec có `required: ["files"]`. Proposal §4.2 và epics 10.2 đã ghi (luật 11). |
| 4 | LOW | Comment `customer-response.dto.ts` trộn Việt–Anh giữa câu. | Tách thành câu tiếng Anh riêng. |
| 5 | LOW | Prettier định dạng lại một số dòng không liên quan (description dài, `order-cancel.spec.ts`, `attachment-limits.spec.ts`). | Giữ: chỉ chạy prettier trên file đã sửa, lint giảm 75 → 52 lỗi, không file nào tăng. |

Kiểm luật dự án:
- **(1) Phạm vi:** story không thêm đường ghi đơn. Đã bẻ thử trên hai handler story đụng: `issueStock` bỏ `findScopedOrThrow` ⇒ 4 test ĐỎ; `getStockIssue` bỏ `findScopedOrThrow` ⇒ 2 test ĐỎ. Backup bằng `cp`, khôi phục xong `cmp` sạch.
- **(2) Khoá tồn kho:** story không đổi đường kho. Bẻ thử: bỏ `FOR UPDATE` trên `products` trong `issueForOrderInTx` (`stock-vouchers.service.ts:455`) ⇒ lane DB đỏ 3 ca (FORCED interleaving ở `order-stock-issue` và `stock-out-blocked`). Trước mutant, lane chạy xanh 322/322.
- **(3)/(4):** story không thêm màn web/mobile mới. **(5):** chống guard rỗng có sẵn (≥100 schema / ≥450 property) cùng ca tự kiểm dương và âm. **(6):** e2e dùng `initAppOnLoopback` có sẵn. **(8):** code mới viết tiếng Anh.
- Lane sau khi sửa: backend `npx jest` 117/2460, `npm run build` + `tsc --noEmit` xanh; `npm run test:db` 26/322; design-system 487/487; web typecheck + 195/195 + build; mobile `flutter analyze` 0 issue + `flutter test` all passed. ESLint ở các file sửa trong review: 0 lỗi.
- Reviewer đã kiểm lại: parity D4 không bị nới (bảng chỉ áp phía client, có assert mỗi entry được dùng); AC 10 đủ mọi ca; spec unit/DB chỉ đổi tên.

### Change Log

- 2026-10-22 — Đổi 32 field + 3 schema DTO tiếng Việt sang tiếng Anh và field form `anh` → `files`; response dựng qua hàm map ở ranh giới controller; `fieldErrors` theo tên mới; guard schema/property; e2e runtime = spec; parity design-system qua bảng dịch; docs G-5. Status → review.
- 2026-10-22 — Code review: assert e2e tập key `OrderResponseDto` cho action ghi (create + confirm); sửa 2 description còn tên cũ; `AttachmentUploadRequestDto.files` required; tách comment trộn ngôn ngữ; docs §4.2/epics ghi `files` required. Status → done.
