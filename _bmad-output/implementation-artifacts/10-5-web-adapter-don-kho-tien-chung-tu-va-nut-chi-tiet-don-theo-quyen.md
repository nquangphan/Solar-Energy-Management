---
baseline_commit: 1a7b708
---

# Story 10.5: Web: adapter đơn, kho, tiền, chứng từ và nút chi tiết đơn theo quyền

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a nhân viên bán hàng/kế toán trên web,
I want đi trọn luồng báo giá → chốt → thanh toán → hợp đồng → hoá đơn với backend thật,
so that web dùng được đầu-cuối cho đơn hàng.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-22, sau commit `1a7b708` = Story 10.4 done)

| Bề mặt | Hiện trạng |
|---|---|
| `web/src/main.tsx` | Composition root (10.4): `session` → `transport` → `client` → 8 adapter `new Http*Port(client)` gom vào `ports: AppPorts`. 10.5 thêm 6 adapter vào ĐÚNG chỗ này |
| `web/src/app/routes.ts` | `NAV_ROUTES = { customers, warranty, settings, profile }`; `AVAILABLE_NAV_KEYS` = key của bảng ⇒ `orders`/`inventory` đang **ẩn** khỏi sidebar. Thêm key ⇒ sidebar + landing tự đổi (KE_TOAN có `orders.view_all` ⇒ landing thành `/orders`) |
| `web/src/app/AppRoutes.tsx` | `AppPorts` 8 port; `gate(key, el)` = `openable.has(key) ? el : <Navigate to={landing}/>`; route con kế thừa gate cha (khuôn `/customers/:phone`) |
| Port trong phạm vi (`web/src/design-system/session/`) | `orders-port.ts` (757 dòng, 26 method), `inventory-port.ts` (`listStock`), `stock-vouchers-port.ts` (4 method), `payments-port.ts` (3), `contracts-port.ts` (3), `invoices-port.ts` (5). **Mọi type dữ liệu khai tay, còn tên field tiếng Việt cũ** (10.2 đã đổi trên contract) |
| Method tên tiếng Việt (§6.8) | `OrdersPort.chuyenTrangThai(orderId, event, anh)`, `huyDon(orderId, lyDo)`, `listAnh`, `themAnh`, `xoaAnh`, `anhBytes` |
| Caller của 6 method đó (web) | `screens/orders/OrderDetailScreen.tsx`, `screens/orders/OrderStatusChangeScreen.tsx`, `design-system/session/fake-orders-port.ts`, `test/order-stock-issue.test.tsx` |
| Guard design-system ghim tên cũ ở **cả web lẫn mobile** | `design-system/session/parity.test.mjs` (dòng ~282–321, ~500–513), `screens/order-transition.test.mjs:214-219`, `screens/order-cancel.test.mjs:129-146`, `screens/order-attachments.test.mjs:186`, + `order-detail.test.mjs` (18 chỗ field cũ), `inventory.test.mjs` (10), `stock-vouchers.test.mjs`, `orders.test.mjs`, `lib/stock-figures.mjs`. **Mobile giữ tên cũ tới 10.8** |
| Màn trong phạm vi (đã có, chưa route) | `OrdersListScreen {port, onOpen?, onAdd?}`, `CreateQuoteScreen {ordersPort, catalogPort, customersPort, onDone?}`, `OrderDetailScreen {port, orderId, onBack?, onChangeStatus?, onOpenPaymentSchedule?, onOpenContracts?, onOpenInvoices?}`, `OrderStatusChangeScreen {port, orderId, onBack?, onDone?}`, `DiscountApprovalScreen {ordersPort}`, `InventoryScreen {port, onOpenVouchers?}` (đã tự gate `inventory.manage` cho nút), `StockVouchersScreen {port, inventoryPort, onBack?}`, `PaymentScheduleScreen {port, orderId, onBack?, onOrderStatusChanged?, newKey?}`, `ContractsScreen {port, orderId, onBack?}`, `InvoicesScreen {port, orderId, onBack?, onOpenInvoice?}`, `InvoiceDetailScreen {port, orderId, invoiceId, onBack?}` |
| 3 nút chi tiết đơn | `OrderDetailScreen.tsx:484-499` render "Thanh toán"/"Hợp đồng"/"Hoá đơn" **chỉ khi có callback** — chưa caller nào truyền |
| Field `type: object` trần còn lại (bàn giao 10.4) | allowlist `backend/test/openapi-no-untyped-object.spec.ts:27-34`: `OrderListItemDto.assigneeAccountId`, `OrderVersionItemDto.{confirmedAt, createdByAccountId, createdByDisplayName}`, `AttachmentItemDto.{statusFrom, statusTo}` ⇒ `schema.d.ts` sinh `Record<string, never> \| null` (6 chỗ, dòng ~1729, 1819-1822, 2148-2150) |
| Harness test adapter | `web/src/test/http-adapter-harness.ts` (`setupHarness`, `json`, `envelope`, `requests[]`) — dùng lại, KHÔNG viết harness mới |

### 2. 🔥 BẪY SỐ 1 — 6 field `object` trần (bàn giao 10.4) phải về 0

Cùng bệnh 10.4: `@ApiProperty` của field `string | null` không khai `type` ⇒ spec `type: object` ⇒ type sinh `Record<string, never>`. Alias port type vào type sinh mà chưa sửa ⇒ `version.createdByDisplayName ?? '—'` không compile.

- Sửa ở nguồn: `backend/src/orders/dto/order-list-item.dto.ts` (`assigneeAccountId`), `order-version-item.dto.ts` (`confirmedAt` = `type: String, format: 'date-time', nullable: true`; `createdByAccountId`, `createdByDisplayName` = `type: String, nullable: true`), `attachment-response.dto.ts` (`statusFrom`, `statusTo` = `type: String, nullable: true`). Theo đúng khuôn 10.4 đã dùng (đọc `warranty-lookup-response.dto.ts` `confirmedAt`). **Chỉ metadata Swagger** — không đổi tên, validator, hành vi.
- `cd backend && npm run openapi:gen` ⇒ đọc diff: chỉ 6 field đổi `type`/`nullable`/`format`. Rồi `cd web && npm run api:gen`. Cùng commit.
- Guard: **xoá cả 6 dòng** khỏi `KNOWN_UNTYPED`. Allowlist rỗng ⇒ sửa test cho đúng: ca "mỗi entry còn trần" không được thành vacuous-pass im lặng — đổi thành assert `KNOWN_UNTYPED` rỗng **và** `untyped` rỗng; chống-rỗng (≥500 property quét) giữ nguyên. Sửa comment đầu allowlist (không còn "Story 10.5"). Mutant: bỏ `type: String` ở `OrderVersionItemDto.createdByDisplayName` + regen ⇒ ĐỎ.
- `grep -c "Record<string, never>" web/src/api/generated/schema.d.ts` ⇒ còn đúng **2** (`webhooks`, `$defs` — khung chuẩn của openapi-typescript, không phải field).

### 3. 🔥 BẪY SỐ 2 — đổi tên method/field ở web, mobile chưa đổi (tới 10.8)

10.4 đã gặp và giải bằng bảng ánh xạ một chiều `WEB_TO_MOBILE_FIELD = { nationalId: 'cccd' }` trong `design-system/screens/customers.test.mjs`. 10.5 có ~30 field + 6 method ⇒ **một bảng dùng chung**, không chép vào 9 file test:

```js
// design-system/lib/web-mobile-contract-map.mjs (MỚI)
// Web follows the contract (Story 10.5); mobile keeps the old names until Story 10.8.
// Delete this file in 10.8 — every entry must still be used (asserted by its users).
export const WEB_TO_MOBILE_METHOD = {
  transition: 'chuyenTrangThai', cancel: 'huyDon', listAttachments: 'listAnh',
  addAttachments: 'themAnh', removeAttachment: 'xoaAnh', attachmentBytes: 'anhBytes',
};
export const WEB_TO_MOBILE_FIELD = { /* steps: 'buoc', nextSteps: 'buocKeTiep', progress: 'trangThai', canCancel: 'coTheHuy', … */ };
```

- Luật: guard nào đang so một tên ở CẢ HAI nền tảng thì phía web dùng tên mới, phía mobile tra bảng; guard nào chỉ soi web thì đổi sang tên mới. **KHÔNG xoá assert, KHÔNG nới regex** để cho qua. Mỗi entry của bảng phải được ít nhất một guard dùng (thêm một test trong chính file `.mjs` hoặc ở guard dùng nó: tập key đã tra ⊇ tập key của bảng).
- Field nào của bảng 10.4 (`WEB_TO_MOBILE_FIELD` trong `customers.test.mjs`) giữ nguyên chỗ cũ — không bắt buộc gộp; nếu gộp thì cùng commit và giữ assert "mỗi entry được dùng".
- Chữ ký mới (ghim bởi guard sau khi sửa): `transition(orderId: string, event: string, files: File[]): Promise<StatusChangeResult>`, `cancel(orderId: string, reason: string): Promise<void>`, `listAttachments(orderId)`, `addAttachments(orderId, files: File[])`, `removeAttachment(orderId, attachmentId)`, `attachmentBytes(orderId, attachmentId): Promise<Blob>`. Tham số `anh`/`lyDo` đổi theo tên field contract (`files`/`reason`). Guard `order-cancel.test.mjs:142` (lý do bắt buộc, không optional) và `parity.test.mjs:287` (transition không nhận đích) giữ nguyên ý — chỉ đổi tên.
- Chạy `cd design-system && npm test` NGAY sau khi đổi tên port, trước khi viết adapter — đọc từng đỏ, sửa đúng chỗ.

### 4. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — File mới / đổi:**

```
web/src/api/http-orders-port.ts           # OrdersPort (26 method)
web/src/api/http-inventory-port.ts        # InventoryPort
web/src/api/http-stock-vouchers-port.ts   # StockVouchersPort
web/src/api/http-payments-port.ts         # PaymentsPort
web/src/api/http-contracts-port.ts        # ContractsPort
web/src/api/http-invoices-port.ts         # InvoicesPort
web/src/api/download.ts                   # (nếu cần) helper đọc Content-Disposition → File — dùng chung contracts/invoices/quote
web/src/app/routes.ts, AppRoutes.tsx      # thêm route orders/inventory + route con
web/src/main.tsx                          # +6 adapter
```

**D2 — Type port = type sinh (AD-12, khuôn 10.4 D8).** Mọi `interface` khai field contract trong 6 file port thành alias/`Pick`/phép chiếu của `components['schemas'][…]` (type-only import từ `../../api/generated/schema`). Ví dụ: `Order = OrderResponseDto`, `OrderLine = OrderLineItemResponseDto`, `OrderListItem = OrderListItemDto`, `OrderPage = OrderListResponseDto`, `OrderLifecycle = OrderLifecycleResponseDto`, `OrderVersionItem = OrderVersionItemDto`, `AttachmentItem = AttachmentItemDto`, `StatusChangeResult = StatusChangeResponseDto`, `StockItemView = StockItemViewDto`, `StockList = StockListResponseDto`, `StockVoucher* = StockVoucher*Dto`, `PaymentSchedule = PaymentScheduleResponseDto`, `RecordPaymentResult = RecordPaymentResponseDto`, `ContractsOverview = ContractsOverviewResponseDto`, `InvoiceDetail = InvoiceDetailResponseDto`… Query type lấy từ `paths[...]['get']['parameters']['query']` (khuôn `CustomerListQuery`).
- **Giữ ngoài type sinh** (không phải contract hoặc là input riêng của port): interface port, `*PortError`, `QuoteExportFile(s)` (bytes do adapter dựng), hằng số `ORDER_STATUS_*`/`EVENT_*`/`DISCOUNT_*`, input có field cố ý vắng — xem D6.
- **Tên field đổi theo contract** ở port, fake, màn, test web: bảng §4.2 proposal (`customerSdt→customerPhone`, `scopeThietBi/ThiCong/VanChuyen→scopeEquipment/Construction/Delivery`, `buoc→steps`, `buocKeTiep→nextSteps`, `trangThai→progress`, `coTheHuy→canCancel`, `coTheXoa→canDelete`, `nguoiTaiLen→uploadedBy`, `soAnhDaLuu→savedAttachmentCount`, `laBanHienLuc→isCurrent`, `chotAt→confirmedAt`, `soDong→lineCount`, `thayDoi→changes`, `them/xoa/doiSoLuong→added/removed/qtyChanged`, `ten/tu/den→name/from/to`, `ten/donVi→name/unit` (kho), `khaDung→available`, `canNhap→toPurchase`, `tinhTrang→stockStatus`, `danhSachCanMua→purchaseList`, `ma→code`, `nguoiTao→createdBy`, `tongSoLuong→totalQty`, `returnOf.ma/returnVoucher.ma→code`, `InvoiceDetail.customerSdt→customerPhone`). Type `TinhTrangTon`/`LoaiPhieu` đổi thành alias union sinh (`StockItemViewDto['stockStatus']`, `…['type']`) — **giá trị enum giữ nguyên** (`du/het/am`, `nhap/xuat` — §6.6).
- Đổi tên type cũ tiếng Việt (`TinhTrangTon`, `LoaiPhieu`, `CanMuaView`) sang tên tiếng Anh là được phép (symbol đang sửa) nhưng KHÔNG bắt buộc; nếu đổi thì đổi cùng mọi caller + mobile map.
- Comment `TODO(app-runtime…)` ở đầu 6 port: sửa cho đúng hiện trạng (adapter ở `web/src/api/http-*-port.ts`).

**D3 — Adapter: khuôn chung (y hệt 10.4 D6).** `constructor(private readonly client: ApiClient)`; mỗi method một lời gọi `this.client.<VERB>('<path sinh>', { params: { path, query }, body })`; không `try/catch` đổi lỗi; `data` rỗng ở nhánh thành công ⇒ `throw new ApiError(GENERIC_ERROR_MESSAGE)`; 204 (`DELETE line-items/{lineId}`, `DELETE attachments/{attachmentId}`) không đòi `data`; không logic nghiệp vụ, không tính tiền, không chuẩn hoá SĐT. Response được **dựng tường minh** khi port type là phép chiếu (không spread object có thể mang field ngoài port — bài học `costPrice` 10.4).

**D4 — Map đặc biệt (đã đối chiếu `openapi.json`):**

| Port.method | Request | Ghi chú |
|---|---|---|
| `OrdersPort.listVersions(id)` | `GET /orders/{id}/versions` | response `{items}` ⇒ trả `data.items` |
| `.listAttachments(id)` | `GET /orders/{id}/attachments` | response `{items}` ⇒ `data.items` |
| `.addAttachments(id, files)` | `POST /orders/{id}/attachments` multipart, field **`files`** (tinh chỉnh 10.2) | response `AttachmentUploadResponseDto` bị bỏ (port `void`) |
| `.transition(id, event, files)` | `POST /orders/{id}/transition` multipart: `event` + 0..n `files` | 0 file là đường thường (FR-23) — không gửi part `files` rỗng |
| `.cancel(id, reason)` | `POST /orders/{id}/cancel` `{reason}` | response bỏ (port `void`) |
| `.removeAttachment` | `DELETE …/attachments/{attachmentId}` 204 | |
| `.attachmentBytes` | `GET …/attachments/{attachmentId}` `parseAs: 'blob'` | Blob giữ `type` của response (jpeg/png/webp/heic) |
| `.exportQuote(id)` | `POST /orders/{id}/export-quote` → `QuoteExportResponseDto{image,pdf}` (fileName) → `GET /orders/{id}/quote/image` + `/quote/pdf` `parseAs: 'arrayBuffer'` | `QuoteExportFile = { fileName (từ metadata), mimeType (từ `Content-Type` response, fallback `image/png`/`application/pdf`), bytes: new Uint8Array(buf) }` |
| `.updateScopeFlags` / `.updateOrderMeta` | cùng `PATCH /orders/{id}` | hai method giữ nguyên (mỗi call site nói rõ nhóm field) |
| `.confirmOrder` / `.reviseOrder` | `POST …/confirm` / `POST …/reopen` | |
| `.issueStock(id)` | `POST /orders/{id}/stock-issue` | spec có cả 200 (đã xuất, replay) và 201 — openapi-fetch trả `data` cho cả hai; test cả hai |
| `.list(query)` | `GET /orders?status&followUp&page&pageSize` | bỏ key `undefined` (khuôn 10.4 8b); `followUp` là `boolean` |
| `InventoryPort.listStock({q})` | `GET /stock-items?q` | |
| `StockVouchersPort.listVouchers({type,isReturn})` | `GET /stock-vouchers` | `isReturn` để type sinh quyết (boolean hay chuỗi — đọc `paths`, không ép `String()`) |
| `.createReturnVoucher(originId, i)` | `POST /stock-vouchers/{id}/return` | |
| `PaymentsPort.getSchedule/replaceSchedule` | `GET`/`PUT /orders/{id}/payment-schedule` | |
| `.recordPayment(id, input)` | `POST /orders/{id}/payments` | **`idempotencyKey` đi nguyên vẹn trong body** (CORS chỉ cho `Authorization`/`Content-Type` — không chuyển sang header) — xem D6 |
| `ContractsPort.downloadContractPdf(id, cid)` | `GET /orders/{id}/contracts/{contractId}/pdf` `parseAs: 'blob'` | trả `File` tên từ `Content-Disposition` (D7) |
| `InvoicesPort.exportInvoicePdf` / `downloadInvoicePdf` | `POST` / `GET /orders/{id}/invoices/{invoiceId}/pdf` | download trả `File` (D7) |

- **Multipart:** dựng `FormData` trong adapter; truyền qua option `body` + `bodySerializer: (b) => b` (hoặc cách openapi-fetch 0.17 hỗ trợ — **đọc source openapi-fetch 0.17** bằng Read tool trên `web/node_modules/openapi-fetch/dist/index.js`; Bash bị hook chặn chữ `node_modules`). Test BẮT BUỘC assert `Request` nhận được có `content-type` bắt đầu `multipart/form-data; boundary=` (không phải `application/json`) và `await request.formData()` có đúng `event` + số part `files` + tên file. Transport `request.clone()` cho phát lại 401 — có 1 ca: transition 401 → refresh → phát lại vẫn mang đủ file.
- **Nhị phân:** `parseAs: 'blob' | 'arrayBuffer'` của openapi-fetch; transport đã ném `ApiError` ở non-ok trước khi tới đây ⇒ 404 "chưa xuất PDF" của hoá đơn vẫn là envelope.

**D5 — Tải file: object URL / share, không link công khai (AC-2, §6.18).** Màn đã có sẵn đường hiển thị: `OrderDetailScreen` dựng `URL.createObjectURL(blob)` cho ảnh (và revoke), `ContractsScreen`/`InvoiceDetailScreen`/`CreateQuoteScreen` dùng `shareFiles({ files, fallbackDownload: true })` (`design-system/components/share.ts`). Adapter chỉ trả `Blob`/`File`/bytes — **không** dựng URL R2, **không** `window.open(url_backend)` (link không kèm Bearer ⇒ 401, và là link công khai trá hình). Guard: `web/src/api/` + `web/src/screens/` không chứa `r2.`/`cloudflarestorage`/`presign` (thêm vào guard composition root hoặc test riêng, chống-rỗng).

**D6 — Input cố ý vắng field (giữ contract của màn 7.1/7.2):** `RecordPaymentInput.amount?` và `InstallmentInput.percent?/amount?` — màn **bỏ** ô trống thay vì gửi 0 (bài học `blank-required-number-coerced-to-zero`). `RecordPaymentRequestDto.amount` là required trong spec ⇒ port input giữ `Omit<RecordPaymentRequestDto, 'amount'> & { amount?: number }`; adapter gửi body như port nhận (một chỗ nới kiểu duy nhất, có comment: "a blank amount is the server's to reject — 400 `fieldErrors.amount`, never a client 0"). Test: input không `amount` ⇒ JSON body không có key `amount`; response 400 `fieldErrors[{field:'amount'}]` ⇒ reject `ApiError` đúng field.

**D7 — Tên file tải về.** `Content-Disposition: attachment; filename="<ASCII>"` (backend đảm bảo ASCII: `contracts/domain/contract-number.ts:18`, `invoices/domain/invoice-file.ts:10`). Adapter đọc header bằng `response.headers.get('content-disposition')` (openapi-fetch trả `response` cùng `data`), regex `filename="([^"]+)"`; vắng/không khớp ⇒ fallback `${contractId}.pdf` / `${invoiceId}.pdf`. **Cross-origin:** header này chỉ đọc được khi CORS expose ⇒ thêm `exposedHeaders: ['Content-Disposition']` vào `corsOptionsFromEnv` (`backend/src/common/http/cors.ts`) + assert ở test CORS sẵn có (e2e origin được phép ⇒ response có `access-control-expose-headers` chứa `Content-Disposition`). Dev dùng proxy vite (cùng origin) nên smoke không đo được điểm này — test là bằng chứng.

**D8 — `ParseUUIDPipe` trả câu tiếng Việt (TD bàn giao từ 10.4).** 26 chỗ `ParseUUIDPipe` trong 6 controller (orders, payments ×2, contracts, invoices, stock-vouchers) trả `"Validation failed (uuid is expected)"` ⇒ path `/orders/abc` từ thanh địa chỉ web hiện câu tiếng Anh. Sửa MỘT chỗ: hằng/factory trong `backend/src/common/validation/` (vd `export const UUID_PARAM = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Mã định danh không hợp lệ.') })` — **đúng câu `isUuid` trong `BUILT_IN_MESSAGES`**, một câu cho một luật), thay mọi `ParseUUIDPipe` trần ở 6 controller. Envelope vẫn do filter dựng (AD-5) — `exceptionFactory` chỉ trả exception. Kiểm `all-exceptions.filter.ts` lấy `message` của `BadRequestException` thế nào trước khi chọn dạng; nếu filter cần `fieldErrors` thì để `fieldErrors` rỗng (lỗi path param, không phải field body). Test: e2e một route mỗi controller với id `abc` ⇒ 400 `VALIDATION_ERROR` + message tiếng Việt; source-guard nhỏ: không còn `new ParseUUIDPipe(` / `ParseUUIDPipe)` trần trong `src/**/*.controller.ts` ngoài factory (chống-rỗng: ≥6 controller quét, factory phải được dùng ≥26 lần). **Lỗi parse JSON body của Express giữ là TD** (client sinh luôn gửi JSON hợp lệ) — ghi một dòng Dev Notes.

**D9 — Route (`app/routes.ts` + `AppRoutes.tsx`), path tiếng Anh, gate tái dùng `filterNav`:**

| Nav key / route con | Path | Màn | Gate |
|---|---|---|---|
| `orders` | `/orders` | `OrdersListScreen` (`onOpen` ⇒ `orderPath(id)`; `onAdd` chỉ truyền khi `can(perms, PERM.quotesCreateEdit)` ⇒ `/orders/new`) | any-of `orders.view_all/own` (từ `SIDEBAR_NAV`) |
| con | `/orders/new` | `CreateQuoteScreen` (`ordersPort`, `catalogPort`, `customersPort`; `onDone(order)` ⇒ `orderPath(order.id)`) | `orders` + `quotes.create_edit` |
| con | `/orders/discount-approvals` | `DiscountApprovalScreen` | `orders` + `discounts.approve` |
| con | `/orders/:id` | `OrderDetailScreen` (D10) | `orders` |
| con | `/orders/:id/transition` | `OrderStatusChangeScreen` (`onBack`/`onDone` ⇒ `orderPath(id)`) | `orders` |
| con | `/orders/:id/payments` | `PaymentScheduleScreen` (`onBack` ⇒ chi tiết) | `orders` |
| con | `/orders/:id/contracts` | `ContractsScreen` | `orders` + `contracts.generate` |
| con | `/orders/:id/invoices` | `InvoicesScreen` (`onOpenInvoice(iid)` ⇒ `/orders/:id/invoices/:invoiceId`) | `orders` + `invoices.manage` |
| con | `/orders/:id/invoices/:invoiceId` | `InvoiceDetailScreen` | như trên |
| `inventory` | `/inventory` | `InventoryScreen` (`onOpenVouchers` ⇒ `/inventory/vouchers`; màn tự ẩn nút khi thiếu `inventory.manage`) | any-of `inventory.manage`/`quotes.create_edit` (từ `SIDEBAR_NAV`) |
| con | `/inventory/vouchers` | `StockVouchersScreen` (`inventoryPort`; `onBack` ⇒ `/inventory`) | `inventory` + `inventory.manage` |

- Thêm `orders: '/orders'`, `inventory: '/inventory'` vào `NAV_ROUTES` (thứ tự key trong object không quyết landing — landing theo thứ tự `SIDEBAR_NAV`). Route con gate bằng gate cha **và** `can(perms, PERM.x)` (hằng registry, không literal — AD-17); thiếu quyền ⇒ `<Navigate to={landing} replace/>` như route cha.
- **Route tĩnh khai TRƯỚC `/orders/:id`** (`new`, `discount-approvals`) — react-router 8 xếp hạng theo độ cụ thể nên vẫn đúng, nhưng test 10b phải mở `/orders/new` và chứng minh không render chi tiết đơn id `new`.
- `orderPath(id)` = `` `/orders/${encodeURIComponent(id)}` `` (khuôn `customerPath`). Param đọc qua `useParams` trong wrapper route nhỏ (khuôn `CustomerDetailRoute`).
- **Nút "+ Tạo đơn" hiện render VÔ ĐIỀU KIỆN** (`OrdersListScreen.tsx:130` và trong `EmptyState` dòng ~160, `onClick={onAdd}`) ⇒ `onAdd` vắng = nút chết. Sửa màn: render cả hai nút chỉ khi `onAdd` có (EmptyState vắng `action` + đổi câu "Bấm ➕Tạo để bắt đầu." chỉ khi có nút — đọc guard `design-system/screens/orders.test.mjs` trước khi đổi chuỗi). Test: account thiếu `quotes.create_edit` không thấy "+ Tạo đơn" ở cả danh sách có dòng lẫn danh sách rỗng (fixture có quyền thì THẤY — memory `widget-test-gate-unreachable-outer-condition`).
- **Lối vào màn duyệt chiết khấu:** `OrdersListScreen` thêm prop **tuỳ chọn** `onOpenDiscountApprovals?: () => void` ⇒ khi có, render một `<Button variant="ghost" type="button">Duyệt chiết khấu</Button>` cạnh nút tạo đơn (dùng class sẵn có, không className mới). Router chỉ truyền khi `can(perms, PERM.discountsApprove)`. Không thêm key sidebar (đụng `SIDEBAR_NAV` + parity mobile Story 1.9).

**D10 — 3 nút chi tiết đơn theo quyền (AC-4, §6.19).** Wrapper `OrderDetailRoute`:
- `onChangeStatus` ⇒ `/orders/:id/transition` — luôn truyền (màn tự ẩn khi `nextSteps` rỗng — quyết của backend).
- `onOpenPaymentSchedule` ⇒ `/orders/:id/payments` — **mọi account vào được route `orders`** (`GET /orders/{id}/payment-schedule` = `@RequireAnyPermissions(orders.view_all, orders.view_own)`; ghi/cấu hình trong màn đã gate `payments.record`).
- `onOpenContracts` chỉ khi `can(perms, PERM.contractsGenerate)` (`contracts.controller.ts:57` `@RequirePermissions(PERM.contractsGenerate)`).
- `onOpenInvoices` chỉ khi `can(perms, PERM.invoicesManage)` (`invoices.controller.ts:66`).
- Vắng quyền ⇒ prop `undefined` ⇒ nút **vắng mặt** (UX-DR-22), và route đích cũng gate (gõ URL tay ⇒ về landing). Backend vẫn chặn (AD-4).
- `onBack` ⇒ `/orders`.

**D11 — Composition root.** `main.tsx` thêm `orders: new HttpOrdersPort(client)`, `inventory`, `stockVouchers`, `payments`, `contracts`, `invoices` vào `ports`; `AppPorts` thêm 6 field (bỏ comment "Built for the quote pickers… (Story 10.5)" ở `catalog` — giờ đã dùng). Guard `composition-root.test.ts` tự kiểm dương đếm **14** `new Http…Port(` (8 + 6) — sửa số, không nới.

**D12 — Fake (§6.20).** 6 fake trong phạm vi (`fake-{orders,inventory,stock-vouchers,payments,contracts,invoices}-port.ts`) viết lại theo type mới + method mới; vẫn chỉ export từ khối "TEST/DEMO-ONLY" của `index.ts`; chỉ test/demo dùng. `screens-render.test.tsx` vẫn render qua fake (`SCREEN_COUNT = 19` — không thêm file `*Screen.tsx`).

### 5. Hiện trạng phải giữ (guard sẽ đỏ nếu quên)

- Money: client không tính tiền — mọi tổng/đợt/hoá đơn chỉ qua `<Money>` từ số backend trả (AD-2/AD-16); guard `design-system/money/money-render-guard.test.mjs` + `money-fields` xanh không nới. Đừng viết chữ "đồng" trong mô tả số không phải tiền (bài học 7.3). Adapter không cộng/trừ/làm tròn số nào.
- `no-network-outside-transport.test.ts`: adapter chỉ `client.*`; `FormData`/`Blob`/`URL.createObjectURL` không phải lời gọi mạng — nhưng `fetch(`/`XMLHttpRequest`/`navigator.sendBeacon` cấm ngoài transport.
- `composition-root.test.ts`: không `Fake*Port`/`DEMO_*` trên đường production (main, `app/`, `api/`, `screens/`, `design-system/{components,shell}`); AC-14 cũ (port phải import `api/generated/schema`) mở rộng cho 6 port mới — chống-rỗng ≥12 file.
- `css-class-coverage.test.ts`: không className mới (dùng component sẵn có).
- `screens-render.test.tsx` + test màn hiện có (`order-stock-issue`, `quote-stock-check`, `inventory-screen`, `stock-vouchers-screen`, `payment-schedule-screen`, `contracts-screen`, `invoices-screen`, `invoice-detail-screen`) đổi fixture theo field mới — **không xoá ca**.
- Guard trạng thái: `ORDER_STATUS_DACHOT`/`EVENT_DELIVERED`/`DISCOUNT_*` vẫn là hằng ở port, màn không có literal (guard Story 4.6).
- Luật tồn kho / phạm vi backend: story **không** thêm đường ghi đơn/tồn kho mới ở backend (chỉ metadata Swagger, `ParseUUIDPipe`, CORS expose). Lane DB phải xanh không đổi.
- Ngôn ngữ: code/comment/test name tiếng Anh; chuỗi UI tiếng Việt.

### 6. Phạm vi

**TRONG:** 6 adapter + test; type port = type sinh + đổi field/method web (port, fake, màn, test web, guard design-system qua bảng một chiều); 6 field `object` + guard về rỗng; `ParseUUIDPipe` tiếng Việt; CORS expose `Content-Disposition`; route orders/inventory + route con + gate; 3 nút theo quyền + lối vào duyệt chiết khấu; composition root +6; smoke đầu-cuối; docs G-5.

**NGOÀI (đừng làm):** mobile (10.6–10.8 — chỉ đọc tên cũ qua bảng map); đổi giá trị enum; màn mới (dashboard, phân quyền, audit); màn sửa báo giá đã tồn tại (mở lại đơn `baogia` từ chi tiết — câu hỏi mở 1); sửa lịch đã thu (TD-51), khoản điều chỉnh (TD-52); lỗi parse JSON Express (TD); `PaymentScheduleScreen.onOrderStatusChanged` không cần nối (màn tự tải lại lịch; chi tiết đơn tải lại khi quay về).

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md` Story 10.5)

1. **Given** port orders, inventory, stock-vouchers, payments, contracts, invoices, **When** dùng adapter, **Then** cài bằng client sinh; method tiếng Việt (`chuyenTrangThai`, `huyDon`, `themAnh`, `xoaAnh`, `listAnh`, `anhBytes`) đổi sang tiếng Anh cùng mọi caller (mặc định §6.8).
2. **Given** upload ảnh và tải PDF/ảnh, **When** gọi, **Then** upload multipart qua backend (AD-3), tải nhị phân kèm Bearer rồi mở/tải bằng object URL; không link công khai (mặc định §6.18).
3. **Given** ghi thanh toán, **When** gửi, **Then** khoá idempotency do port sinh được truyền nguyên vẹn; retry cùng khoá không ghi trùng (NFR-1).
4. **Given** chi tiết đơn, **When** router render `OrderDetailScreen`, **Then** truyền `onOpenPaymentSchedule` cho mọi account xem được đơn, `onOpenContracts` chỉ khi có `contracts.generate`, `onOpenInvoices` chỉ khi có `invoices.manage` — khớp `@RequirePermissions` của endpoint chính màn đích; test cho cả account đủ và thiếu quyền (mặc định §6.19, UX-DR-22).
5. **Given** backend + `pns-postgres` chạy local, **When** smoke đầu-cuối bằng account seed có quyền, **Then** tạo báo giá → chốt → cấu hình lịch → ghi thanh toán → sinh HĐ → lập + xuất hoá đơn thành công; kết quả ghi vào Dev Agent Record (mặc định §6.21).
6. **Given** client không tính tiền (AD-2, AD-16), **When** hiển thị tổng, **Then** chỉ hiện số backend trả qua `<Money>`; guard tiền hiện có vẫn xanh.

### AC dẫn xuất (đo được)

7. **Bẫy 1** (mục 2): `jq` ⇒ 0 property `type:"object"` trần trong `openapi.json`; `schema.d.ts` còn đúng 2 `Record<string, never>` (`webhooks`, `$defs`); `KNOWN_UNTYPED` rỗng và guard assert rỗng (không vacuous); mutant bỏ `type` ở `OrderVersionItemDto.createdByDisplayName` + regen ⇒ ĐỎ; e2e orders hiện có xanh **không sửa assert**.
8. **Đổi tên method + field** (mục 3, D2): `grep -rnE "chuyenTrangThai|huyDon|themAnh|xoaAnh|listAnh|anhBytes" web/src` ⇒ rỗng; `grep -rnE "\.(buoc|buocKeTiep|trangThai|coTheHuy|coTheXoa|nguoiTaiLen|soAnhDaLuu|laBanHienLuc|soDong|thayDoi|khaDung|canNhap|tinhTrang|danhSachCanMua|nguoiTao|tongSoLuong|customerSdt|scopeThiCong|scopeThietBi|scopeVanChuyen|chotAt)\b" web/src` ⇒ rỗng (state/biến cục bộ của form không phải field contract thì được, nhưng tên mới viết tiếng Anh). `design-system/lib/web-mobile-contract-map.mjs` tồn tại, mỗi entry được dùng (assert); `cd design-system && npm test` xanh **không xoá assert nào** (đếm số test trước/sau: không giảm).
9. **Type port = type sinh:** 6 file port không còn `interface`/`type X = {…}` khai field contract tay (trừ interface port, `*PortError`, `QuoteExportFile(s)`, input D6); guard AC-14 của `composition-root.test.ts` phủ ≥12 file port.
10. **Mỗi adapter** (`web/src/test/http-<port>-port.test.ts`, `// @vitest-environment node`, harness `http-adapter-harness.ts`): mỗi method ≥1 ca thành công assert method + path + query/body của `Request` + kết quả map; mỗi port ≥1 ca envelope lỗi ⇒ `ApiError` đúng `status/code/message/fieldErrors`; đếm bằng `toHaveBeenCalledTimes`. Ca riêng:
    - a. `transition('o1','xong_giao',[f1,f2])` ⇒ `POST /orders/o1/transition`, `content-type` `multipart/form-data; boundary=…`, `formData.get('event') === 'xong_giao'`, `getAll('files')` 2 file đúng tên; `transition(…, [])` ⇒ không có part `files`; 401 → refresh → phát lại vẫn đủ part.
    - b. `addAttachments` multipart field `files`; `cancel('o1','Khách đổi ý')` ⇒ body `{"reason":"Khách đổi ý"}`, resolve `undefined`; 400 `fieldErrors[{field:'reason'}]` ⇒ reject đúng field.
    - c. `attachmentBytes` ⇒ `Blob` đúng `type`; `downloadContractPdf` ⇒ `File` tên từ `Content-Disposition`, fallback `${contractId}.pdf` khi vắng header; `downloadInvoicePdf` 404 envelope ⇒ `ApiError` 404.
    - d. `exportQuote` ⇒ đúng thứ tự `POST export-quote`, `GET quote/image`, `GET quote/pdf` (3 lời gọi); `fileName` từ metadata; bytes khớp.
    - e. `recordPayment` ⇒ body chứa đúng `idempotencyKey` được truyền (byte-for-byte), KHÔNG header idempotency; gọi hai lần cùng input ⇒ hai request cùng khoá; input không `amount` ⇒ body không key `amount` (D6).
    - f. `listVersions`/`listAttachments` unwrap `items`; `list({ status: 'baogia' })` ⇒ query không có `followUp/page/pageSize`; `issueStock` cả 200 và 201 đều resolve voucher.
    - g. `listStock({ q: 'pin' })` ⇒ query `q=pin`; `listVouchers({ type: 'xuat', isReturn: false })` ⇒ query đúng kiểu type sinh.
11. **Mutation adapter** (Dev Agent Record, backup `cp`, mutant compile được — memory `mutation-must-compile-or-false-red`): (i) `transition` gửi JSON thay multipart ⇒ 10a ĐỎ; (ii) `recordPayment` tự sinh `crypto.randomUUID()` thay khoá được truyền ⇒ 10e ĐỎ; (iii) `downloadContractPdf` bỏ đọc header (luôn fallback) ⇒ 10c ĐỎ; (iv) `listVersions` trả `data` thay `data.items` ⇒ tsc ĐỎ hoặc 10f ĐỎ (ghi rõ cái nào); (v) một adapter nuốt lỗi ⇒ ca envelope ĐỎ.
12. **Router + gate + 3 nút** (`web/src/test/app-routes.test.tsx` mở rộng, `MemoryRouter` + `PermissionsProvider` với `FakeMePort` + fake port):
    - a. Account có `orders.view_all` + `contracts.generate` + `invoices.manage`: sidebar có "Đơn hàng"; `/orders/:id` hiện cả 3 nút; bấm "Hợp đồng" ⇒ `ContractsScreen`, "Hoá đơn" ⇒ `InvoicesScreen`, "Thanh toán" ⇒ `PaymentScheduleScreen` với đúng `orderId`.
    - b. Account chỉ `orders.view_own`: chi tiết đơn có "Thanh toán", **không** "Hợp đồng"/"Hoá đơn"; gõ `/orders/o1/contracts` hoặc `/orders/o1/invoices` ⇒ không render màn đích, về landing; `/orders/new` không có `quotes.create_edit` ⇒ về landing; mở `/orders/new` với quyền ⇒ `CreateQuoteScreen`, không phải chi tiết đơn id `new`.
    - c. "Kho": account chỉ `quotes.create_edit` thấy "Kho", `InventoryScreen` không có nút Phiếu kho, `/inventory/vouchers` ⇒ về landing; account `inventory.manage` mở được `StockVouchersScreen`.
    - d. KE_TOAN-like (`orders.view_all` + `payments.record` + `invoices.manage`, không `customers.manage`) ⇒ landing `/orders` (10.4 tình huống biên — giờ đổi đúng như dự báo).
    - e. Nút "Duyệt chiết khấu" trên danh sách chỉ có khi `discounts.approve`; route `/orders/discount-approvals` gate cùng quyền.
    - f. `AVAILABLE_NAV_KEYS` có `orders`, `inventory` (assert từ chính `NAV_ROUTES`).
    - g. Mutant: truyền `onOpenContracts` vô điều kiện ⇒ 12b ĐỎ; bỏ gate quyền ở route `/orders/:id/invoices` ⇒ 12b ĐỎ; bỏ gate `inventory.manage` ở `/inventory/vouchers` ⇒ 12c ĐỎ.
13. **Composition root:** `main.tsx` 14 adapter; guard tự kiểm dương 14; mutant `new HttpOrdersPort(` trong `AppRoutes.tsx` ⇒ ĐỎ; `app-entry.test.tsx` thêm 1 ca: đăng nhập account có `orders.view_all` ⇒ landing `/orders` gọi `GET /orders` thật qua `fetch` stub.
14. **D5 guard link công khai:** `web/src/{api,screens}` không chứa `r2.`, `cloudflarestorage`, `presign`, `X-Amz-` (chống-rỗng ≥ số file quét); không `window.open(` trỏ URL backend trong màn đơn/chứng từ.
15. **D7 CORS expose:** `corsOptionsFromEnv` có `exposedHeaders: ['Content-Disposition']`; e2e CORS origin được phép ⇒ `access-control-expose-headers` chứa `Content-Disposition`; origin bị từ chối vẫn không có header CORS (ca cũ xanh).
16. **D8 `ParseUUIDPipe`:** e2e 6 controller id `abc` ⇒ 400 `VALIDATION_ERROR`, `message === 'Mã định danh không hợp lệ.'`; guard không còn `ParseUUIDPipe` trần ở controller (chống-rỗng); mutant đổi một chỗ về `ParseUUIDPipe` trần ⇒ guard ĐỎ.
17. 5 lane xanh: backend `npm test` (+ `npm run build`), `npm run test:db` (không đổi DB — xác nhận không vỡ), design-system `npm test`, web `npm run typecheck && npm test && npm run build`, mobile `flutter analyze && flutter test` (không đụng mobile — xác nhận). Backend lint: chỉ file mình sửa không thêm lỗi (lint toàn repo đỏ sẵn — memory `backend-lint-red-at-baseline`).
18. **Smoke tay** (AC-5 + luật 13, Dev Agent Record): backend local (`npm run build` → `npm run start:prod`, `JWT_ACCESS_SECRET` ngẫu nhiên ≥32 ký tự chỉ trên lệnh, KHÔNG đọc/sửa `.env`) + `pns-postgres` 5433 + `npm run dev` web, Playwright. Hai account smoke riêng (argon2id, chèn thẳng DB 5433): (A) `smoke-10-5-a@local.test` quyền đủ luồng: `orders.view_all`, `quotes.create_edit`, `orders.confirm`, `customers.manage`, `catalog.view`, `payments.record`, `contracts.generate`, `invoices.manage`, `inventory.manage`; (B) `smoke-10-5-b@local.test` chỉ `orders.view_own` + `quotes.create_edit`. Với A: Đơn hàng → Tạo báo giá (khách smoke SĐT `0900 000 105`, ≥1 sản phẩm danh mục) → Chốt → chi tiết đơn có 3 nút → Thanh toán: cấu hình lịch (vd 2 đợt %) → ghi một khoản (đo: bấm Ghi hai lần/ reload rồi gửi lại form cùng khoá không ra 2 dòng — kiểm bằng SQL đếm `payments`) → Hợp đồng: sinh + tải PDF (file mở được, tên đúng) → Hoá đơn: lập + xuất PDF + tải → chuyển trạng thái một bước kèm 1 ảnh → ảnh hiện trong gallery (object URL) → Kho: xem tồn, mở Phiếu kho. Với B: chi tiết đơn của mình chỉ có "Thanh toán"; gõ `/orders/<id>/contracts` ⇒ về landing. Dọn: xoá 2 account smoke (+session); dữ liệu nghiệp vụ smoke (khách, đơn, lịch, khoản thu, HĐ, hoá đơn, ảnh, phiếu kho nếu có) xoá bằng SQL trên `pns-postgres` theo thứ tự FK hoặc ghi rõ cái nào để lại + lý do (hoá đơn/khoản thu append-only có thể có trigger chặn — kiểm trước); object R2/storage local của ảnh/PDF smoke: ghi đường dẫn/khoá; tắt backend + vite (cổng 3000/5173 trống); xoá `.playwright-mcp/`. Docker chưa chạy ⇒ ghi "smoke chưa chạy" + nhờ Đại Ca bật Docker Desktop (memory `db-lane-needs-docker-desktop-gui`) — không giả kết quả.
19. G-5 cùng commit: bullet "Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.5)" vào `epics.md` Story 10.5 (tên method mới; bảng map web→mobile tới 10.8; route path; lối vào duyệt chiết khấu qua prop tuỳ chọn; `ParseUUIDPipe` một factory; CORS expose `Content-Disposition`; input vắng `amount` giữ ngữ nghĩa 7.2; mọi tinh chỉnh khác phát sinh); bỏ câu "(module đơn/tiền — 10.5)" về `ParseUUIDPipe` khỏi TD 10.4 nếu đã trả (sửa bằng ghi chú "đã trả ở 10.5", không xoá lịch sử); `project-context.md` dòng "Web tooling" (6 adapter đơn/tiền, guard object trần về rỗng, `UUID_PARAM`); `sprint-change-proposal-2026-10-22.md` không cần sửa trừ khi đổi một mặc định §6.

---

## Tasks / Subtasks

- [x] **T1 — Backend: 6 field `object` + guard rỗng** (AC 7)
  - [x] Sửa `@ApiProperty*` 6 field ở 3 DTO (mục 2); `npm run openapi:gen`, đọc diff; `cd web && npm run api:gen`.
  - [x] `openapi-no-untyped-object.spec.ts`: allowlist rỗng + assert rỗng; mutant.
- [x] **T2 — Backend: `ParseUUIDPipe` tiếng Việt + CORS expose** (AC 15, 16)
  - [x] Factory trong `common/validation/`; thay 26 chỗ ở 6 controller; e2e + guard + mutant.
  - [x] `cors.ts` `exposedHeaders`; assert e2e CORS.
  - [x] `npm test` + `npm run build` backend; lint file sửa.
- [x] **T3 — Đổi tên port web + type sinh + fake + màn + guard design-system** (AC 1, 8, 9)
  - [x] 6 port: alias type sinh (D2), 6 method tiếng Anh, TODO comment.
  - [x] `design-system/lib/web-mobile-contract-map.mjs`; sửa guard design-system dùng bảng; `npm test` design-system (đếm test không giảm).
  - [x] 6 fake; màn `OrderDetail/OrderStatusChange/OrdersList/CreateQuote/DiscountApproval/Inventory/StockVouchers/PaymentSchedule/Contracts/Invoices/InvoiceDetail` theo field mới; test web theo fixture mới.
  - [x] `cd web && npm run typecheck && npm test`.
- [x] **T4 — 6 adapter + test** (AC 2, 3, 10, 11, 14)
  - [x] Đọc `openapi-fetch` 0.17 về `bodySerializer`/`parseAs` (Read tool).
  - [x] `web/src/api/http-{orders,inventory,stock-vouchers,payments,contracts,invoices}-port.ts` (+ `download.ts` nếu dùng chung).
  - [x] 6 file test + mutation.
- [x] **T5 — Route + 3 nút + composition root** (AC 4, 12, 13)
  - [x] `routes.ts` (`orders`, `inventory`, `orderPath`, path con), `AppRoutes.tsx` (wrapper `OrderDetailRoute`… gate con), `OrdersListScreen.onOpenDiscountApprovals?`.
  - [x] `main.tsx` +6 adapter; `AppPorts`; guard 14; `app-entry.test.tsx` ca landing `/orders`.
  - [x] `app-routes.test.tsx` 12a–g + mutant.
  - [x] `npm run build` web; quét bundle không `localhost:3000` (Grep tool hoặc script node — hook chặn chữ build/dist trong Bash).
- [x] **T6 — Docs G-5 + 5 lane + smoke** (AC 5, 17, 18, 19)
  - [x] `epics.md`, `project-context.md`.
  - [x] 5 lane; smoke tay; Dev Agent Record (bảng mutant, số lane, smoke, dọn dẹp).
  - [x] `git check-ignore -v` từng file mới (memory `.gitignore assets/`).

---

## Dev Notes

### Smoke đầu-cuối (Trợ Lý, 2026-10-22) — bắt buộc trước khi chuyển review

- backend/.env thiếu JWT_ACCESS_SECRET hợp lệ và mật khẩu seed nằm trong .env: KHÔNG đọc/sửa .env. Chạy backend bằng biến tạm ngay trên lệnh (JWT_ACCESS_SECRET ngẫu nhiên ≥32 ký tự), Postgres local 5433.
- Tạo account smoke RIÊNG (smoke-<story>@local.test, mật khẩu ngẫu nhiên, băm argon2id như backend, quyền vừa đủ) thẳng vào DB local; không đổi account có sẵn; xoá account smoke + tắt backend/vite khi xong.
- Smoke luồng chính của story trên client thật (web: vite + trình duyệt).
- **Storage cho smoke (đã scout):** `StorageModule` chỉ có `R2StorageAdapter` (`backend/src/storage/r2-storage.adapter.ts`, S3Client đọc `R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET`, thiếu ⇒ ném khi đọc/ghi file). Xuất báo giá, ảnh đính kèm, sinh HĐ, xuất PDF hoá đơn ĐỀU ghi storage. Luật 12 cấm gọi dịch vụ ngoài localhost ⇒ **KHÔNG dùng R2 thật**. Mặc định: một S3-compatible chạy local (vd container MinIO trên `127.0.0.1:9000`, bucket smoke riêng), truyền 4 biến `R2_*` **trên lệnh** như `JWT_ACCESS_SECRET` (không sửa `.env`). Adapter không bật `forcePathStyle` — nếu SDK dựng URL virtual-host không tới được MinIO, **không** sửa adapter production chỉ để smoke chạy; ghi rõ bước nhị phân nào không chạy được + lỗi đo được, chạy hết phần còn lại (lịch, khoản thu, overview HĐ/hoá đơn, lập hoá đơn). Dừng + xoá container + bucket smoke khi xong.
- **Không dùng container `kidy-dev-*`** (dự án khác, kể cả `kidy-dev-minio`). Cần MinIO thì dựng container RIÊNG `pns-minio-smoke` (cổng 9100), xoá khi xong.
- **PDF render cần Chrome:** puppeteer trên máy này chưa tải Chrome — đặt `PUPPETEER_EXECUTABLE_PATH` trỏ Chrome hệ thống trên lệnh (memory `puppeteer-smoke-render-system-chrome`).

### Quyết định đã chốt — không bàn lại

- Đổi tên method port tiếng Việt ngay ở story adapter (§6.8). Mobile giữ tên cũ tới 10.8 — bảng map một chiều, không đổi mobile ở đây.
- Gating 3 nút theo §6.19 (khớp `@RequirePermissions` endpoint chính màn đích); gating là UX, backend enforce mọi request (AD-4).
- Tải nhị phân kèm Bearer qua transport, mở bằng object URL/share; không link công khai (§6.18, E-9, AD-3).
- Idempotency key do màn/port sinh MỘT lần mỗi lần mở form (`PaymentScheduleScreen.newKey`, Story 7.2) — adapter chỉ chuyển, không sinh.
- Fake giữ cho test/demo, viết lại theo type sinh (§6.20). Router chế độ thư viện (§6.11). Composition root duy nhất (AD-12).

### Files sẽ đổi / tạo

| File | Đổi gì |
|---|---|
| `backend/src/orders/dto/{order-list-item,order-version-item,attachment-response}.dto.ts` | `type` cho 6 field |
| `backend/src/common/validation/<uuid-param>.ts` (MỚI) + 6 controller | `ParseUUIDPipe` tiếng Việt |
| `backend/src/common/http/cors.ts` | `exposedHeaders` |
| `backend/openapi/openapi.json` | sinh lại |
| `backend/test/openapi-no-untyped-object.spec.ts`, test CORS e2e sẵn có, e2e/guard `ParseUUIDPipe` (MỚI) | |
| `web/src/api/generated/schema.d.ts` | sinh lại |
| `web/src/api/http-{orders,inventory,stock-vouchers,payments,contracts,invoices}-port.ts` (+ `download.ts`) | MỚI |
| `web/src/design-system/session/{orders,inventory,stock-vouchers,payments,contracts,invoices}-port.ts` + 6 fake + `index.ts` (nếu đổi tên type export) | type sinh, method/field mới |
| `web/src/screens/{orders,inventory,payments,contracts,invoices}/*.tsx` | field/method mới; `OrdersListScreen.onOpenDiscountApprovals?` |
| `web/src/app/{routes.ts,AppRoutes.tsx}`, `web/src/main.tsx` | route + 3 nút + 6 adapter |
| `web/src/test/http-*-port.test.ts ×6` (MỚI), `app-routes.test.tsx`, `app-entry.test.tsx`, `composition-root.test.ts`, test màn đơn/kho/tiền/chứng từ, `screens-render.test.tsx` | |
| `design-system/lib/web-mobile-contract-map.mjs` (MỚI) + `session/parity.test.mjs`, `screens/{order-transition,order-cancel,order-attachments,order-detail,inventory,stock-vouchers,orders}.test.mjs`, `lib/stock-figures.mjs` | tên mới phía web, tên cũ mobile qua bảng |
| `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/project-context.md` | G-5 |

### Tình huống biên đã tính

- **`/orders/new` vs `/orders/:id`:** route tĩnh phải thắng; test chứng minh (12b).
- **Đơn ngoài phạm vi (`orders.view_own`) mở bằng URL:** backend 404 envelope ⇒ `OrderDetailScreen` hiện lỗi theo `code` (đã có từ 5.4) — không thêm logic.
- **Id rác trên URL (`/orders/abc`):** trước D8 là 400 tiếng Anh; sau D8 là "Mã định danh không hợp lệ." hiển thị nguyên văn.
- **Ghi thanh toán: mạng rớt sau khi server commit:** màn giữ khoá (7.2) ⇒ bấm lại gửi cùng khoá ⇒ server replay, `autoTransition` null — adapter không được tạo khoá mới ở retry (mutant 11-ii).
- **Phát lại 401 với multipart/blob:** transport `request.clone()` trước khi gửi — body FormData clone được; có ca 10a.
- **`Content-Disposition` cross-origin:** cần `exposedHeaders` (D7); dev proxy cùng origin nên smoke không lộ lỗi này.
- **Upload ảnh HEIC lớn:** giới hạn 10 ảnh × 10 MB là của backend (Multer limit cao hơn ngưỡng contract — memory `multer-limits-bypass-error-envelope`); adapter không kiểm trước.
- **StrictMode effect ×2:** màn tải dữ liệu 2 lần ở dev/test — chấp nhận như 10.4; không bỏ StrictMode.
- **Hoá đơn tải trước khi xuất:** 404 envelope ⇒ màn đã có nhánh (`InvoiceDetailScreen`), adapter không đặc cách.
- **`issueStock` 200 vs 201:** cả hai là thành công (replay vs lần đầu).

### Kiểm thử — luật dự án áp dụng trực tiếp

- Mutation: backup `cp`, **không** `git checkout` (code story chưa commit — memory). Mutant phải compile. Ghi bảng mutant → kết quả. Mutant tương đương ngữ nghĩa trong fixture = sống sót giả (memory 5.9) — kiểm trước khi đổ lỗi test.
- `toHaveBeenCalledTimes`, không `mock.calls[0]` để đếm (memory 5.8).
- Guard mới: chống-rỗng + tự kiểm dương khớp **lời gọi thật**, không khớp chữ ký (memory 10.3 `guard-positive-selfcheck-matches-signature`); stripToCode xoá string literal — guard soi chuỗi (`r2.`, `presign`) phải đọc raw text bỏ comment, không strip string (memory `striptocode-deletes-string-literals`).
- Harness: một storage cho session (memory `session-store-factory-new-storage-false-red`); Node 24 `localStorage` che jsdom ⇒ `memoryStorage()`.
- Fixture số dẫn xuất gõ tay che lỗi công thức (memory 5.9 review) — test adapter chỉ map, không assert số "đúng nghiệp vụ"; số tiền trong fixture là số backend giả lập, không tự tính.
- Widget/màn: fixture phải bật mọi điều kiện bao ngoài nút (memory `widget-test-gate-unreachable-outer-condition`) — ca "không có nút Hợp đồng" phải là đơn mà account đủ quyền THẤY nút (cùng fixture, chỉ khác quyền), nếu không thì xanh giả.
- zsh: lệnh trong biến không word-split — vòng lặp mutant dùng function/array, in `Tests:` mỗi mutant.
- Hook scout-block chặn chữ `dist`/`build`/`node_modules` trong lệnh Bash: dùng `npm run start:prod`, Read/Grep tool.
- Lane DB cần Docker Desktop GUI; agent không tự bật được.

### Previous Story Intelligence (10.4, commit `1a7b708`)

- Khuôn adapter: `HttpCatalogPort` (dựng từng field), `HttpCustomersPort.get` (openapi-fetch tự encode path param — đã đo `+` ⇒ `%2B`). 7 adapter, 36 ca, harness dùng chung.
- Bẫy 1 đo thật ra 14 (không phải 15) và allowlist 6 (không phải 9): `allOf/$ref` không phải trần. 10.5 đo lại bằng `jq` trước khi sửa — nếu khác 6, sửa theo số đo, ghi vào Debug Log.
- `AppRoutes` chờ `/me` xong mới render route (reload `/settings` không bị đẩy đi) — route mới hưởng sẵn.
- Review 10.4: ValidationPipe đã dịch message tiếng Việt cho MỌI DTO (`BUILT_IN_MESSAGES`, `isUuid` = "Mã định danh không hợp lệ."); guard fake quét cả `screens/` + `design-system/{components,shell}`; guard OpenAPI đi đệ quy toàn document; test `stock-vouchers-screen.test.tsx` từng flaky (`findAllByText` trả sớm) — dùng `waitFor(... toHaveLength(n))`.
- Câu hỏi mở 10.4 còn treo: account `settings.manage` thiếu `customers.manage` nhận 403 nguồn khách — không thuộc 10.5.
- Lane sau 10.4: backend 120 suite / 2500; DB 26 / 322; design-system 487/487; web 28 file / 315; mobile 455.

### Git intelligence

- `bf4e520` (10.1), `8d40504` (10.2), `cb30dee` (10.3), `1a7b708` (10.4): mỗi story MỘT commit `feat(story-10.x): …` tiếng Anh, gồm story file + sprint-status + docs G-5. `git add` đường dẫn cụ thể, không `-A`; `package-lock.json` `git add -f` (story này không thêm dependency — nếu thêm thì ghim chính xác). Push là bước tay của Đại Ca.

### Latest tech notes

- Không thêm dependency. `openapi-fetch@0.17.0`: `parseAs: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream'`; `bodySerializer` theo request; trả `{ data, error, response }` — `response.headers` dùng cho `Content-Disposition`/`Content-Type`. Xác nhận hành vi với `FormData` (header `Content-Type` phải để trình duyệt/undici tự đặt boundary) bằng cách đọc source cài sẵn + test 10a — không đoán.
- `react-router@8.4.0` (10.4): `useParams` trả segment đã decode.

### Project Structure Notes

- Ranh giới giữ như 10.4: `design-system/` (trình bày + interface port + fake), `api/` (transport + adapter), `app/` (router, ráp màn), `main.tsx` (composition root). Không sửa spine (AD-12 đã có luật client; AD-3/AD-4/AD-5 không đổi). `design-system/lib/web-mobile-contract-map.mjs` là file tạm sống tới 10.8 — ghi rõ ở đầu file.

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. Không có lối mở lại màn soạn báo giá cho đơn `baogia` đã lưu (`CreateQuoteScreen` chỉ tạo đơn mới; chi tiết đơn không có nút "Sửa báo giá") ⇒ báo giá dở dang chỉ xem được ở chi tiết. Mặc định: ngoài phạm vi (cần prop `orderId` cho `CreateQuoteScreen` — story riêng).
2. `DiscountApprovalScreen` không có mục sidebar — mặc định lối vào là nút tuỳ chọn trên danh sách đơn (D9). Muốn mục sidebar riêng thì đổi `SIDEBAR_NAV` + mobile (Story 1.9 parity) ở story khác.
3. Dữ liệu smoke append-only (khoản thu, hoá đơn) có thể không xoá được bằng SQL nếu có trigger — ghi lại id còn lại trong Dev Agent Record.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 10, Story 10.5; tinh chỉnh 10.2/10.3/10.4]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §4.2 bảng đổi tên, §6.6, §6.8, §6.18, §6.19, §6.20, §6.21]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-2, AD-3, AD-4, AD-5, AD-12 "Luật client", AD-16, AD-17]
- [Source: `_bmad-output/project-context.md` §Testing "Web tooling", §Critical Don't-Miss (tiền, Epic 7)]
- [Source: `_bmad-output/implementation-artifacts/10-4-web-composition-root-router-va-adapter-danh-muc-khach-cai-dat.md` D4–D9, Dev Agent Record "Bàn giao 10.5", Review]
- [Source: `backend/openapi/openapi.json` — paths `/orders*`, `/stock-items`, `/stock-vouchers*`, `/orders/{id}/{payment-schedule,payments,contracts*,invoices*}`]
- [Source: `backend/src/{payments/payment-schedules,payments/payments,contracts/contracts,invoices/invoices,inventory/stock-vouchers,inventory/stock-items}.controller.ts` — `@RequirePermissions`/`@RequireAnyPermissions`]
- [Source: `backend/src/common/http/cors.ts`, `backend/src/common/validation/validation-pipe.factory.ts`, `backend/test/openapi-no-untyped-object.spec.ts:27-34`]
- [Source: `web/src/{main.tsx, app/routes.ts, app/AppRoutes.tsx, api/*.ts, test/http-adapter-harness.ts}`]
- [Source: `web/src/screens/orders/OrderDetailScreen.tsx:484-499`, `screens/payments/PaymentScheduleScreen.tsx:158-195`, `design-system/components/share.ts`]
- [Source: `design-system/session/parity.test.mjs`, `design-system/screens/{order-transition,order-cancel,order-attachments}.test.mjs`, `design-system/screens/customers.test.mjs` (`WEB_TO_MOBILE_FIELD` khuôn 10.4)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- Bẫy 1 đo lại bằng script đi toàn spec: đúng 6 field trần → 0 sau sửa; `schema.d.ts` còn 2 `Record<string, never>` (`webhooks`, `$defs`).
- `ParseUUIDPipe` đo thật **20** tham số `@Param(…, ParseUUIDPipe)` ở 6 controller (story ghi 26 vì đếm cả dòng import) ⇒ ngưỡng chống-rỗng guard = 20 tham số / 6 controller / ≥15 controller quét.
- Thư viện `cors` gửi `access-control-expose-headers` cho MỌI origin (kể cả bị từ chối); điều chặn trình duyệt là thiếu `allow-origin` ⇒ ca origin bị từ chối assert `allow-origin` vắng (ca preflight cũ giữ nguyên, xanh).
- Type sinh chặt hơn port tay: (a) `OrderResponseDto.vatMode` khai `string` còn `PreviewTotalRequestDto.vatMode` là enum ⇒ guard design-system ghim `vatMode: fetched.vatMode` không compile ⇒ thêm `enum: VAT_MODES` vào `@ApiPropertyOptional` của `OrderResponseDto.vatMode` (metadata Swagger, như T1); (b) openapi-typescript mặc định coi field request có `default` là bắt buộc (`isFlexible`, `tracksStock`, `priceEditable`) ⇒ `web/scripts/generate-api.mjs` truyền `defaultNonNullable: false` (diff schema.d.ts chỉ 3 field đó thành optional); (c) field `?: T | null` ⇒ 3 so sánh `!== null` trong màn đổi sang `!= null`, `stockHintOf` nhận `undefined`, filter danh sách đơn ép về union status sinh (có comment).
- Hook chặn đọc `node_modules` cả bằng Read ⇒ hành vi openapi-fetch với `FormData` đo bằng test 10a: `bodySerializer` trả `FormData` ⇒ request đi `multipart/form-data; boundary=…` (không còn `application/json`), phát lại sau 401 vẫn đủ part.
- Bảng map web→mobile khoá theo DTO (không bảng phẳng): `name→ten` đúng cho dòng kho nhưng `OrderLine.name` mobile cũng là `name`. Guard parity đọc field web từ `schema.d.ts` qua `design-system/lib/web-contract-types.mjs` (`webAliasDto` + `generatedFields`).
- Các guard phủ định soi tên cũ phía web (cờ phạm vi, `STOCK_NUM`, `lyDo?`) sẽ thành rỗng ⇒ mở rộng sang cả tên contract (chặt hơn, không nới).
- Màn: `OrderDetailScreen` giữ state cục bộ `buocKeTiep`/`coTheHuy` (không phải field contract; guard 5.5/5.7 ghim tên state đó) — chỉ field contract đổi tên.
- Lỗi parse JSON body của Express giữ là TD (client sinh luôn gửi JSON hợp lệ).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **T1** 6 DTO field khai `type: String` (+`format: date-time` cho `confirmedAt`); `KNOWN_UNTYPED = []`, test đổi thành assert `untyped` rỗng + allowlist rỗng; chống-rỗng ≥500 giữ.
- **T2** `UUID_PARAM` + `INVALID_UUID_MESSAGE` (dùng lại trong `BUILT_IN_MESSAGES.isUuid` — một câu một luật); 20 chỗ ở 6 controller; e2e sẵn có của 6 controller (`payments`, `payment-schedules`, `invoices`, `contracts`, `stock-vouchers`, `order-stock-issue` + `order-stock-check`) thêm assert `code` + `message === 'Mã định danh không hợp lệ.'`; guard `no-bare-parse-uuid-pipe.spec.ts`. CORS `exposedHeaders: ['Content-Disposition']` + 2 ca e2e.
- **T3** 6 port = alias/`Pick`/`Omit` type sinh; 6 method tiếng Anh; type `TinhTrangTon/LoaiPhieu/CanMuaView` → `StockStatus/VoucherType/PurchaseNeedView` (alias union sinh, giá trị enum giữ). Fake/màn/test web đổi theo field contract; `AttachmentGallery` prop `uploadedBy/canDelete`. Grep AC-8 (method + field) rỗng.
- **T4** 6 adapter + `download.ts`; 6 file test (`@vitest-environment node`, harness 10.4): orders 28 ca, inventory 3, stock-vouchers 5, payments 5, contracts 5, invoices 4 = 50 ca. Guard `no-public-file-link.test.ts` (r2./cloudflarestorage/presign/X-Amz-, `window.open` ở màn đơn/chứng từ; chống-rỗng ≥35 file).
- **T5** `NAV_ROUTES` + `orders`/`inventory`, helper path; `AppRoutes` route + `gateWith` (gate cha + quyền) + `ParamsRoute`; `OrdersListScreen.onOpenDiscountApprovals?`, nút "+ Tạo đơn" chỉ khi `onAdd`; `main.tsx` 14 adapter; guard composition-root 14 + AC-14 phủ 12 port (ngoại lệ `QuoteExportFile(s)`); `app-routes.test.tsx` +10 ca 12a–f (5 ca cũ đổi kỳ vọng landing `/warranty`→`/orders`, đúng dự báo 10.4, không xoá ca); `app-entry.test.tsx` +1 ca landing `/orders` qua fetch stub, 3 ca cũ đổi landing.
- **T6** docs G-5 (`epics.md` bullet tinh chỉnh 10.5 + ghi chú TD 10.4 "đã trả"; `project-context.md` Web tooling). `git check-ignore` 20 file mới: không file nào bị ignore.

**Bảng mutant (backup `cp`, mọi mutant compile — `tsc` 0 lỗi trừ khi ghi khác):**

| # | Mutant | Kết quả |
|---|---|---|
| T1 | bỏ `type: String` ở `OrderVersionItemDto.createdByDisplayName` + regen | ĐỎ 1/4 (`OrderVersionItemDto.createdByDisplayName` trong `untyped`) |
| T2 | một chỗ `payments.controller` về `ParseUUIDPipe` trần | ĐỎ 3 (guard ×2 + e2e message) |
| 11-i | `transition` serializer trả JSON | ĐỎ 3/28 (10a ×3) |
| 11-ii | `recordPayment` tự `crypto.randomUUID()` | ĐỎ 2/5 (10e) |
| 11-iii | không đọc `Content-Disposition` (header khác tên) | ĐỎ 1/5 (10c tên file) |
| 11-iv | `listVersions` trả `data` | **tsc ĐỎ** (1 lỗi); có cast để compile ⇒ 10f ĐỎ 1/28 |
| 11-v | `get` nuốt lỗi (`.catch`) | ĐỎ 1/28 (ca envelope 404) |
| 14 | chuỗi `r2.cloudflarestorage.com` trong adapter hoá đơn / `window.open` URL PDF trong `ContractsScreen` | ĐỎ 1/4 mỗi mutant |
| 12g | `onOpenContracts` vô điều kiện | ĐỎ (12b) |
| 12g | `/orders/:id/invoices` chỉ `gate` (bỏ quyền) | ĐỎ (12b) |
| 12g | `/inventory/vouchers` chỉ `gate` | ĐỎ (12c) |
| 13 | `new HttpOrdersPort(` trong `AppRoutes.tsx` | ĐỎ (composition-root "only main.tsx assembles") |

**5 lane (sau thay đổi code cuối):** backend `npm test` 121 suite / 2504 (trước 120/2500) + `npm run build` sạch + eslint các file sửa sạch; `npm run test:db` 26 / 322 (không đổi); design-system 490/490 (trước 487, +3 test của bảng map, không xoá assert); web `typecheck` sạch, `npm test` 35 file / 381 (trước 28/315), `npm run build` OK, bundle 0 `localhost:3000`; mobile `flutter analyze` sạch, `flutter test` 455 (không đụng mobile).

**Smoke đầu-cuối (AC-5/18) — ĐÃ CHẠY** (backend `npm run start:prod`, `JWT_ACCESS_SECRET` ngẫu nhiên trên lệnh, không đọc/sửa `.env`; `pns-postgres` 5433; MinIO riêng `pns-minio-smoke` — cổng **9200** vì 9100 đang bị một tiến trình dart khác chiếm, bucket `smoke-10-5`, `R2_*` trên lệnh, adapter production không sửa (endpoint IP ⇒ SDK đi path-style); `PUPPETEER_EXECUTABLE_PATH` = Chrome hệ thống; vite 5173; Playwright). DB local trống sau lane DB ⇒ chèn SQL: 2 account argon2id, 1 nguồn khách `Smoke 10.5 nguon`, 2 sản phẩm `SMK105-PIN`/`SMK105-INV`.
  - A `smoke-10-5-a@local.test` (9 quyền story): đăng nhập ⇒ `/orders`, sidebar Đơn hàng/Khách hàng/Kho/Tra cứu bảo hành/Hồ sơ; "+ Tạo đơn" ⇒ tra SĐT `0900 000 105` ⇒ tạo khách ⇒ đơn nháp; thêm 2 dòng danh mục, tổng do backend (17.500.000 + VAT 1.400.000 = 18.900.000 đ); "Tải PDF" báo giá ⇒ `POST export-quote` 200 → `GET quote/image` 200 → `GET quote/pdf` 200 (render + ghi MinIO thật); Chốt ⇒ về `/orders/:id`, "Đã chốt", có Thanh toán/Hợp đồng/Hoá đơn.
  - Thanh toán: cấu hình 20/70/10 (`PUT`), ghi đợt 1 với **mạng rớt giả lập sau khi server commit** (Playwright `route.fetch()` ⇒ 200 rồi `abort`): màn báo lỗi, bấm lại ⇒ 2 request **cùng** `idempotencyKey` `9c171d02-…`; SQL đếm `payments` của đơn = **1** (3.780.000), đơn tự sang `dacoc`.
  - Hợp đồng: sinh `POST 201` + `GET …/pdf 200`; Chromium headless có `navigator.canShare` nên `shareFiles` chờ hộp chia sẻ không bao giờ đóng (giới hạn môi trường, không phải adapter) ⇒ tắt `canShare` bằng init script ⇒ "Tải PDF" tải `hop-dong-thi-cong-549.pdf` (PDF 1.4, 3 trang, 87 KB, tên từ `Content-Disposition`).
  - Hoá đơn: tạo `HD-2026-1369`, "Xem" ⇒ `/orders/:id/invoices/:invoiceId`, "Xuất PDF" ⇒ tải `hoa-don-HD-2026-1369.pdf` (PDF 1.4, 1 trang).
  - Chuyển trạng thái kèm 1 ảnh: ở `dacoc` mọi bước kế tiếp cần `construction.transition`/`delivery.confirm` (A không có ⇒ nút ẩn đúng luật) ⇒ **cấp thêm `delivery.confirm` cho A** để đo; `bat_dau_giao` + 1 PNG ⇒ request `multipart/form-data; boundary=…`, đơn `danggiao`; tab Ảnh hiện ảnh qua `blob:` URL (64px, đúng ảnh).
  - Kho: Tồn kho đọc backend (2 sản phẩm âm, danh sách cần mua); "Phiếu kho" ⇒ `/inventory/vouchers`.
  - `/orders/abc/payments` ⇒ `GET …/payment-schedule` 400 `VALIDATION_ERROR` "Mã định danh không hợp lệ.".
  - B `smoke-10-5-b@local.test` (`orders.view_own` + `quotes.create_edit`; đơn smoke gán `assignee` B bằng SQL vì B không có `customers.manage` để tự tạo đơn): sidebar Đơn hàng/Kho/Tra cứu bảo hành/Hồ sơ; chi tiết đơn chỉ "Thanh toán"; gõ `/orders/<id>/contracts`, `/orders/<id>/invoices` ⇒ về `/orders`.
  - Console: chỉ favicon 404, lỗi mạng giả lập, 400 của id rác — đều do kịch bản.
  - **Dọn:** 1 transaction SQL theo thứ tự FK (không có trigger chặn): xoá payments, installments, payment_schedules, invoice_lines/pdfs, invoices, contracts, attachments, quote_exports, stock movements/vouchers của đơn, line items, versions, đơn, khách `+84900000105`, nguồn `Smoke 10.5 nguon`, 2 sản phẩm smoke, sessions + 2 account ⇒ đếm lại 0. **Để lại:** 21 dòng `audit_logs` (append-only, trail của smoke). Object MinIO mất cùng container: `docker rm -f pns-minio-smoke`. Backend + vite tắt (3000/5173 trống); `.playwright-mcp/` xoá; file PDF/PNG smoke chỉ nằm trong scratchpad phiên.

**Bàn giao / câu hỏi mở:**
- Câu hỏi mở 1–3 của story giữ nguyên mặc định (không có màn sửa báo giá đã lưu; Duyệt chiết khấu không có mục sidebar; audit log smoke để lại).
- `shareFiles` trên trình duyệt có Web Share (Chromium desktop) sẽ mở hộp chia sẻ thay vì tải — hành vi Story 7.3/4.8, không đổi ở đây.
- (Review) `/orders/new` chỉ gate `quotes.create_edit`; account tuỳ biến thiếu `customers.manage` sẽ gặp 403 ở bước tra khách — có nên gate thêm `customers.manage` không? (preset hiện tại không lộ.)
- Danh sách quyền smoke A của story thiếu một quyền chuyển trạng thái; lần smoke sau nên ghi kèm `delivery.confirm` (hoặc `construction.transition`).

### File List

**Backend**
- backend/src/common/validation/uuid-param.ts (mới)
- backend/src/common/validation/validation-pipe.factory.ts
- backend/src/common/http/cors.ts
- backend/src/orders/dto/order-list-item.dto.ts
- backend/src/orders/dto/order-version-item.dto.ts
- backend/src/orders/dto/attachment-response.dto.ts
- backend/src/orders/dto/order-response.dto.ts
- backend/src/orders/orders.controller.ts
- backend/src/payments/payments.controller.ts
- backend/src/payments/payment-schedules.controller.ts
- backend/src/invoices/invoices.controller.ts
- backend/src/contracts/contracts.controller.ts
- backend/src/inventory/stock-vouchers.controller.ts
- backend/openapi/openapi.json
- backend/test/no-bare-parse-uuid-pipe.spec.ts (mới)
- backend/test/openapi-no-untyped-object.spec.ts
- backend/test/cors.e2e.spec.ts
- backend/test/payments.e2e.spec.ts
- backend/test/payment-schedules.e2e.spec.ts
- backend/test/invoices.e2e.spec.ts
- backend/test/contracts.e2e.spec.ts
- backend/test/stock-vouchers.e2e.spec.ts
- backend/test/order-stock-issue.e2e.spec.ts
- backend/test/order-stock-check.e2e.spec.ts

**Web**
- web/scripts/generate-api.mjs
- web/src/api/generated/schema.d.ts
- web/src/api/download.ts (mới)
- web/src/api/http-orders-port.ts (mới)
- web/src/api/http-inventory-port.ts (mới)
- web/src/api/http-stock-vouchers-port.ts (mới)
- web/src/api/http-payments-port.ts (mới)
- web/src/api/http-contracts-port.ts (mới)
- web/src/api/http-invoices-port.ts (mới)
- web/src/main.tsx
- web/src/app/routes.ts
- web/src/app/AppRoutes.tsx
- web/src/design-system/components/AttachmentGallery.tsx
- web/src/design-system/session/{orders,inventory,stock-vouchers,payments,contracts,invoices}-port.ts
- web/src/design-system/session/fake-{orders,inventory,stock-vouchers,invoices}-port.ts
- web/src/design-system/session/index.ts
- web/src/screens/orders/{OrdersListScreen,CreateQuoteScreen,OrderDetailScreen,OrderStatusChangeScreen,DiscountApprovalScreen}.tsx
- web/src/screens/inventory/{InventoryScreen,StockVouchersScreen}.tsx
- web/src/screens/inventory/inventory.css (comment)
- web/src/test/http-{orders,inventory,stock-vouchers,payments,contracts,invoices}-port.test.ts (mới)
- web/src/test/http-port-errors.test.ts (mới — review)
- web/src/test/no-public-file-link.test.ts (mới)
- web/src/test/{app-routes,app-entry,screens-render,contracts-screen,inventory-screen,invoices-screen,order-stock-issue,payment-schedule-screen,quote-stock-check,stock-vouchers-screen}.test.tsx
- web/src/test/composition-root.test.ts

**Design-system**
- design-system/lib/web-mobile-contract-map.mjs (mới)
- design-system/lib/web-mobile-contract-map.test.mjs (mới)
- design-system/lib/web-contract-types.mjs (mới)
- design-system/lib/web-contract-types.test.mjs (mới — review)
- design-system/session/parity.test.mjs
- design-system/screens/{order-transition,order-cancel,order-attachments,order-detail,inventory,orders}.test.mjs

**Docs / tracking**
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/project-context.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/10-5-web-adapter-don-kho-tien-chung-tu-va-nut-chi-tiet-don-theo-quyen.md
- _bmad-output/implementation-artifacts/tests/test-summary-story-10-5.md (QA)

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI review, /ck:code-review + một agent con soi guard design-system) — 2026-10-22. **Kết quả:** Approve sau khi sửa — 0 CRITICAL, mọi finding HIGH/MEDIUM/LOW hợp lệ đã sửa.

**Đối chiếu:** AC 1–19 có bằng chứng trong code/test; task [x] khớp; File List khớp git (bổ sung 3 file: 2 test mới của review + test-summary QA). Luật dự án: story không thêm đường ghi đơn/tồn kho nào ở backend (chỉ metadata Swagger, `UUID_PARAM`, CORS expose) ⇒ luật (1)/(2) không có bề mặt mới để bẻ; lane DB chạy lại để xác nhận không vỡ.

**Mutation độc lập của reviewer (backup `cp`, không git checkout):**

| Mutant | Kết quả |
|---|---|
| `onOpenInvoices` vô điều kiện (AppRoutes) | ĐỎ (app-routes; tsc cũng đỏ vì biến thừa) |
| `onOpenPaymentSchedule` chỉ khi `contracts.generate` | ĐỎ |
| `/orders/new` bỏ gate `quotes.create_edit` | ĐỎ |
| `"+ Tạo đơn"` render vô điều kiện | ĐỎ |
| `recordPayment` tự `crypto.randomUUID()` | ĐỎ 2/5 |
| `fileNameOf` luôn fallback | ĐỎ 2/10 |
| `transition` bỏ `bodySerializer` (JSON) / chỉ gửi 1 file / `list` thêm `page` | ĐỎ |
| **`exportInvoicePdf` nuốt lỗi (`.catch`)** | **XANH — lỗ hổng** ⇒ sửa (H-1), sau sửa ĐỎ |
| `replaceSchedule` nuốt lỗi | ĐỎ sau sửa H-1 |
| CORS bỏ `exposedHeaders` | ĐỎ 2/12 |
| `UUID_PARAM` về `new ParseUUIDPipe()` mặc định | ĐỎ 10 (e2e message ×6 controller) |
| bỏ `UUID_PARAM` ở `createReturn` / `invoices.downloadPdf` | ĐỎ (e2e + guard đếm ≥20) |
| mobile `CanMuaView.ten`→`name` (map stale) | trước sửa XANH (agent) ⇒ sau sửa M-1 ĐỎ |
| `AttachmentGallery` `.canDelete`→`.coTheXoa` | trước sửa XANH ⇒ sau sửa M-2 ĐỎ |
| `UpdateOrderMetaInput = Pick<…> & { vatRate?: number }` | trước sửa XANH (tsc cũng xanh) ⇒ sau sửa H-2 ĐỎ (design-system + web composition-root) |
| `OrderVersionItem = Schemas[…] & { invented?: string }` | trước sửa XANH ⇒ sau sửa ĐỎ |

**Findings + sửa:**

- **H-1 [HIGH] Adapter nuốt lỗi không bị test bắt ở đa số method** — mỗi port chỉ 1 ca envelope; mutant `exportInvoicePdf` `.catch` sống sót. Sửa: `web/src/test/http-port-errors.test.ts` — bảng ca gõ kiểu `Record<keyof <Port>, …>` (thiếu method ⇒ không compile), 42 method của 6 adapter đều phải reject envelope 409 thành `ApiError` đúng `status/code/message`, `toHaveBeenCalledTimes(1)`; chống-rỗng đếm 42.
- **H-2 [HIGH] `webAliasDto` chỉ bắt `Schemas['X']` đầu tiên** ⇒ guard "không input nào mang VAT rate" và "đúng field AC-9 của version" mù với `& { … }`/`Pick`/`Omit`. Sửa: `webAliasDto` chỉ nhận alias đúng `= Schemas['X'];`; thêm `webTypeFields` giải `Pick`/`Omit` ra đúng tập field, mọi hình khác ném; `parity.test.mjs` dùng nó cho 2 input ghi (assert `UpdateOrderMetaInput` = đúng `kWp/validityNote/vatMode`); `lib/web-contract-types.test.mjs` tự kiểm (4 test: chấp/khước từng hình).
- **M-1 [MEDIUM] Test sống của bảng map không khoanh theo class mobile** — `ten`/`donVi`/`soDong`/`customerSdt` tìm thấy ở class khác ⇒ entry stale vẫn xanh. Sửa: `MOBILE_CLASS` (DTO → class mobile, `StockVoucherDetailDto` qua lớp cha), đọc thân class (khớp đúng một lần), + test chứng minh reader có phạm vi.
- **M-2 [MEDIUM] Quét "web không còn đọc tên cũ" chỉ phủ `session/` + `screens/`** (AC 8 nói cả `web/src`), tên method cũ chỉ soi `orders-port.ts`. Sửa: quét toàn `web/src` trừ `api/generated/` (chống-rỗng ≥120 file, phải gặp `AttachmentGallery.tsx` + `AppRoutes.tsx`), thêm tên method cũ.
- **M-3 [MEDIUM] Guard type-sinh của `composition-root.test.ts` mù với `Dto & { field }`** (regex chỉ bắt `= {`/`= W<{`). Sửa: bắt object literal ở bất cứ đâu trong vế phải (bỏ qua key path trong nháy), ngoại lệ tường minh `WIDENED_INPUTS = ['RecordPaymentInput']` (D6) + test "ngoại lệ vẫn còn lý do" + 2 mẫu tự kiểm.
- **L-1** ca `canCancel` (Story 5.7) đọc file thô ⇒ comment cũng thoả: giờ đọc code đã bỏ comment; web port kiểm qua `webTypeFields(OrderLifecycle)`.
- **L-2** helper chết `webFields` (chỉ còn sanity test của chính nó) xoá; sanity Dart giữ + thêm ca phủ định.
- **L-3** fake orders: tham số `lyDo`/`anh` → `reason`/`files`, `fieldErrors[].field` `'lyDo'`/`'anh'` → `'reason'`/`'files'` đúng backend (`orders.service.ts:1374,1592`); comment hỏng do đổi tên máy ("returns added" → "returns them").
- **L-4** field `?: T | null` của type sinh so `=== null` ⇒ vắng key sẽ hiện "undefined kWp"/mode bảo hành sai: 7 chỗ (`OrderDetailScreen` cancelReason/kWp, `CreateQuoteScreen` kWp/productId/warrantyMonths, `DiscountApprovalScreen` estimatedMarginPct/requestNote) đổi sang `== null`/`!= null` (backend hiện luôn gửi `null` ⇒ không đổi hành vi đo được).

**Không sửa (ghi lại):** `/orders/new` gate `quotes.create_edit` (D9) nhưng bước 1 gọi `GET /customers/lookup` cần `customers.manage` (+ `catalog.view` cho picker) ⇒ account tuỳ biến chỉ có `quotes.create_edit` thấy "+ Tạo đơn" rồi gặp 403 ở bước tra khách. Mọi preset có `quotes.create_edit` (ADMIN, QUAN_LY, THO_KS) đều có `customers.manage` + `catalog.view` ⇒ chỉ chạm account tự cấu hình; giữ D9 (khớp endpoint chính `POST /orders`), đưa vào câu hỏi mở.

**Lane sau review:** backend `npm test` 121 suite / 2504 + `npm run build` sạch (review không sửa backend); `npm run test:db` 26 / 322 (pns-postgres 5433); design-system 495/495 (trước review 490, +5); web `typecheck` sạch, `npm test` 36 file / 432 (trước review 35 / 388, +43 ca lỗi adapter +1 ca guard), `npm run build` OK; mobile `flutter analyze` sạch, `flutter test` 455 pass.

**Smoke:** không chạy lại — sửa của review chỉ chạm test/guard/fake và phép so `null` lỏng (tương đương khi backend gửi `null`); smoke đầu-cuối của dev giữ nguyên giá trị.

## Change Log

- 2026-10-22 — Story 10.5 dev: 6 adapter web (orders, inventory, stock-vouchers, payments, contracts, invoices) qua client sinh; port web = type sinh + tên method/field contract (mobile qua bảng map tới 10.8); route đơn/kho + 3 nút chi tiết đơn theo quyền + lối vào duyệt chiết khấu; composition root 14 adapter; backend: 6 field `object` trần về 0, `UUID_PARAM` tiếng Việt, CORS expose `Content-Disposition`, enum `vatMode`; smoke đầu-cuối chạy thật. Status → review.
- 2026-10-22 — Review (AI): 2 HIGH, 3 MEDIUM, 4 LOW — đều đã sửa (test lỗi phủ 42 method adapter; reader alias chặt + `webTypeFields`; bảng map kiểm theo class mobile + quét toàn `web/src`; guard type sinh bắt `& {…}`; fake/null-check). Status → done.
