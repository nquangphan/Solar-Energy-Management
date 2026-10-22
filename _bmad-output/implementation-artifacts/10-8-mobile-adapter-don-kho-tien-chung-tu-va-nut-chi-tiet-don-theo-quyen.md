---
baseline_commit: 78a2a2c
---

# Story 10.8: Mobile: adapter đơn, kho, tiền, chứng từ và nút chi tiết đơn theo quyền

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a nhân viên bán hàng/hiện trường,
I want tạo báo giá, chốt, chuyển trạng thái kèm ảnh, ghi thanh toán, xem HĐ/hoá đơn trên điện thoại với backend thật,
so that không cần quay về văn phòng.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Story này là **bản mobile của web 10.5** (6 adapter đơn/kho/tiền/chứng từ + route + 3 nút theo quyền) đặt trên nền **10.7** (go_router, `SignedInApp`, `AppBottomNavScope`, khuôn adapter + `*PortException`, guard composition root). Chép **luật**, không chép cú pháp. Đọc trước: `web/src/api/http-{orders,inventory,stock-vouchers,payments,contracts,invoices}-port.ts`, `web/src/app/{routes.ts,AppRoutes.tsx}` (dòng 166–315), story `10-5-…md` (§4 D2–D10, Review H-1/H-2/M-1..3), story `10-7-…md` (§3–§7, Review 1–7), `mobile/lib/api/{transport,http_customers_port,http_catalog_port}.dart`, `mobile/lib/app/{app_routes,signed_in_app,pns_app}.dart`.

### 1. Hiện trạng (scout 2026-10-22, sau commit `78a2a2c`; 10.7 done ở `4c0e4b6`)

| Bề mặt | Hiện trạng |
|---|---|
| Port trong phạm vi (`lib/design_system/session/`) | `orders_port.dart` (974 dòng, 26 method, ~30 class khai tay), `inventory_port.dart` (`listStock({q})`), `stock_vouchers_port.dart` (4 method), `payments_port.dart` (3), `contracts_port.dart` (3), `invoices_port.dart` (5). **Mọi type khai tay**, tiền/đếm là `int`, ngày là `String` (trừ `InvoiceSummary.issuedAt`, `InvoicePdfInfo.exportedAt` là `DateTime`), trạng thái/loại là `String` |
| Method tiếng Việt (§6.8) | `chuyenTrangThai(orderId, event, List<XFile> anh)`, `huyDon(orderId, lyDo)`, `listAnh`, `themAnh(orderId, files)`, `xoaAnh`, `anhBytes` (→ `Uint8List`) |
| Field tiếng Việt (bảng `design-system/lib/web-mobile-contract-map.mjs`, đúng danh sách cần đổi) | `customerSdt`→`customerPhone` (Order, OrderListItem, DiscountPendingItem, InvoiceDetail, CreateOrderInput); `scopeThietBi/ThiCong/VanChuyen`→`scopeEquipment/Construction/Delivery`; lifecycle `buoc/buocKeTiep/coTheHuy`→`steps/nextSteps/canCancel`, step `trangThai`→`progress`; `soAnhDaLuu`→`savedAttachmentCount`; attachment `nguoiTaiLen/coTheXoa`→`uploadedBy/canDelete`; version `laBanHienLuc/chotAt/soDong/thayDoi`→`isCurrent/confirmedAt/lineCount/changes`; changes `them/xoa/doiSoLuong`→`added/removed/qtyChanged`; qty change `ten/tu/den`→`name/from/to`; kho `ten/donVi/khaDung/canNhap/tinhTrang`→`name/unit/available/toPurchase/stockStatus`, `danhSachCanMua`→`purchaseList`; phiếu `ma/nguoiTao/soDong/tongSoLuong`→`code/createdBy/lineCount/totalQty`, dòng phiếu `ten/donVi`→`name/unit`, returnOf/returnVoucher `ma`→`code`; `UpdateScopeFlagsInput.scopeThiCong/scopeVanChuyen`→`scopeConstruction/scopeDelivery`. Kiểu `CanMuaView`→ alias `PurchaseNeedViewDto` |
| Lỗi port (màn bắt **nominal**) | `OrderPortException(message, {code, Map<String,String> fieldErrors})` — `order_detail_screen.dart:330` dựng trạng thái "không tìm thấy" từ `code == 'NOT_FOUND'`; `StockVoucherPortException(message, {List<StockVoucherFieldError> fieldErrors})`; `PaymentsPortError({code, message, List<FieldError>? fieldErrors})` (màn đọc `.code`/`.fieldErrors`, `payment_schedule_screen.dart:344,509`); `ContractsPortError({status, message})`; `InvoicesPortError({status, message})`. `InventoryPort`: không có lớp lỗi (màn `catch (_)`) |
| Fake | `fake_{orders(1366 dòng),inventory,stock_vouchers,payments,contracts,invoices}_port.dart`, barrel `session.dart` re-export mọi fake |
| Màn (đã có, **chưa route**) | `OrderListScreen {port, perms, onOpen?, onAdd?}` (**không có** `onOpenDiscountApprovals`), `CreateQuoteScreen {ordersPort, catalogPort, customersPort, perms, onDone(Order)?, shareImpl?}`, `OrderDetailScreen {port, orderId, onBack?, onChangeStatus?, onOpenPaymentSchedule?, onOpenContracts?, onOpenInvoices?, pick?, perms}` (3 nút :397–429 render **chỉ khi có callback**; "Phiếu xuất" gate `inventoryManage || deliveryConfirm` :261), `OrderStatusChangeScreen {port, orderId, onBack?, onDone(String)?, pick?}`, `DiscountApprovalScreen {ordersPort}`, `InventoryScreen {port, onOpenVouchers?, perms}` (tự gate nút phiếu `inventoryManage` :246), `StockVouchersScreen {port, inventoryPort, onBack?}`, `PaymentScheduleScreen {port, orderId, onBack?, perms, onOrderStatusChanged?, newKey}`, `ContractsScreen {port, orderId, onBack?, shareImpl?}`, `InvoicesScreen {port, orderId, onBack?, onOpenInvoice?}`, `InvoiceDetailScreen {port, orderId, invoiceId, onBack?, shareImpl?}` |
| Router (`lib/app/`) | `kNavRoutes = {customers, warranty, profile}` (key của **Menu**); `landingPath` luôn `/menu`; `isOpenable` = Menu hoặc đúng/con của route có key mở được; `_selectTab` chỉ nối tab 4; `AppBottomNavScope(onSelect: _selectTab)` — **`onCreateQuote` null**. `signed_in_app_test.dart:286–298` khẳng định tab 0/1/3/FAB **không làm gì** (10.8 sửa ca này cho 1/3/FAB, giữ ca tab 0) |
| `kMobileMenu` | chỉ `customers`, `warranty`, `profile`; **không** có `orders`/`inventory` (web `SIDEBAR_NAV`: `orders` any-of `orders.view_all/own`; `inventory` any-of `inventory.manage/quotes.create_edit`). Guard `design-system/components/menu-nav-parity.test.mjs` so key/`requires`/`requiresAny` với web |
| Composition root | `main.dart`: `SessionStore` → `Transport` → `PnsApiClient` → 5 adapter → `PnsApp(auth, me, password, customers, warranty, sessionExpired)`; comment :42 hẹn dựng `HttpCatalogPort` ở 10.8. `composition_root_test.dart`: ≥40 file quét, chỉ `main.dart` dựng `Http\w+Port(`, typedef ghim **`expect(aliased, 11)`** (:151) |
| Client sinh | Đủ method cho 6 port (xem bảng D4). `pubspec.yaml` đã có `image_picker ^1.1.2`, `share_plus ^10.1.4`; `AppShareFn`/`ImagePickFn` tiêm được trong test |
| Toolchain / lane baseline (sau review 10.7) | Flutter **3.35.0 / Dart 3.9.0**; mobile `flutter test` **608** + analyze sạch; design-system **504**; web **439** + typecheck + build; backend `npm test` **2504** (121 suite), `test:db` **322** (26 suite) |

### 2. 🔥 BẪY SỐ 1 — `paidOn` sinh ra `DateTime` ⇒ ghi thanh toán LUÔN 400

Spec khai `paidOn` `type: string, format: date` (2 chỗ: `RecordPaymentRequestDto`, `PaymentResponseDto`). `swagger_parser` biến `format: date` thành `DateTime`; `toJson` gửi `paidOn.toIso8601String()` = `"2026-10-21T00:00:00.000"` ⇒ backend `@Matches(/^\d{4}-\d{2}-\d{2}$/)` (`record-payment-request.dto.ts:54-56`) ⇒ **400 với mọi lần ghi thanh toán**. Fixture/fake không lộ; chỉ test adapter so body thật hoặc smoke mới thấy. Thêm: `DateTime.parse('2026-10-21')` (response) là **giờ máy** 00:00 — `toUtc()` lùi về hôm trước ở UTC+7.

**Cách sửa (mặc định tuyên bố trước, D11):** sửa **bản spec dẫn xuất mobile** — đúng khuôn 10.6 (`mobile/tool/generate_api.dart` `buildMobileSpec` đã đổi binary response): bỏ `format: date` trên schema `type: string, format: date` (giữ `string`) ⇒ `paidOn` sinh là `String` ở cả request lẫn response (khớp port tay hiện nay). Hàm trả thêm số lần đổi; **chống-rỗng:** đúng **2** (ít hơn ⇒ script ném, như `binaryRewrites == 0`). Spec backend **không đổi một byte**. Chạy `cd mobile && dart run tool/generate_api.dart`, diff chỉ được chạm 2 model (`record_payment_request_dto*`, `payment_response_dto*`) — đọc diff, ghi vào Debug Log. Drift-guard `generated_client_drift_test.dart` vẫn xanh (nó chạy lại chính script). Test thuần cho `buildMobileSpec`: input có 1 `format: date` + 1 `format: date-time` ⇒ chỉ cái đầu đổi. Ghi lý do vào bullet G-5 (spec dẫn xuất nay đổi 2 thứ). **Không** đổi `@ApiProperty` backend (format `date` là đúng contract).

### 3. 🔥 BẪY SỐ 2 — body sinh gửi `null` cho MỌI field ⇒ PATCH xoá dữ liệu

`toJson` sinh (json_serializable mặc định `includeIfNull: true`) ghi **mọi key**, kể cả `null`. Với PATCH, `null` và *vắng* là hai nghĩa khác nhau ở backend:
- `UpdateOrderRequestDto` (`PATCH /orders/{id}`, dùng chung cho `updateScopeFlags` và `updateOrderMeta`): `kWp: null`/`validityNote: null` = **xoá** (`update-order-request.dto.ts:55`). Bật cờ thi công bằng DTO sinh ⇒ gửi kèm `kWp: null, validityNote: null, vatMode: null, scopeDelivery: null` ⇒ **xoá kWp và ghi chú hiệu lực của đơn**. Mọi lane xanh (fake không đi qua JSON).
- `UpdateLineItemRequestDto`: `warrantyMonths: null` = **bỏ bảo hành** (`update-line-item-request.dto.ts:64-69`) ⇒ sửa số lượng một dòng sẽ xoá bảo hành dòng đó.
- Port mobile đã mô hình hoá ba trạng thái (`kLineFieldAbsent`, `kMetaFieldAbsent`, `UpdateOrderLineInput.hasWarrantyMonths`) — giữ nguyên các input này (hand-kept, D2).

**Cách sửa (D5):** retrofit sinh gọi `_data.addAll(body.toJson())` (đã đọc `orders_client.g.dart:218-219`) và lớp DTO sinh không `final` ⇒ trong `lib/api/sparse_bodies.dart` (MỚI) khai lớp con **riêng tư theo DTO** (`extends UpdateOrderRequestDto` / `UpdateLineItemRequestDto` / `AddLineItemRequestDto` / `PreviewTotalRequestDto` nếu cần) nhận tập key *có mặt* và `@override toJson()` = `super.toJson()..removeWhere((k, _) => !present.contains(k))`. Một chỗ, không sửa file sinh, không bỏ type sinh. `null` tường minh (xoá kWp/bảo hành) vẫn gửi `null` khi port nói có mặt.

Test BẮT BUỘC so **JSON body chính xác** (map bằng nhau, không `containsKey` lẻ) cho: `updateScopeFlags(scopeConstruction: true)` ⇒ `{"scopeConstruction":true}`; `updateOrderMeta(kWp: null có mặt)` ⇒ `{"kWp":null}`; `updateOrderMeta` vắng kWp ⇒ không key `kWp`; `updateLine(qty: 3)` ⇒ `{"qty":3}`; `updateLine(warrantyMonths: null có mặt)` ⇒ `{"warrantyMonths":null}`; `addLine` dòng catalog ⇒ không key `name/unit/unitPrice` khi port không đặt. Mutant "dùng DTO sinh trần" ⇒ ĐỎ.

### 4. 🔥 BẪY SỐ 3 — multipart: không import dio + mime ảnh

- Method sinh nhận `List<MultipartFile>` (kiểu của **dio**); guard `no_network_outside_transport_test.dart:21` cấm `import 'package:dio/` ngoài `transport.dart`. **Không** nới guard. Cách làm (D6): `Transport` thêm method công khai dựng part, vd `MultipartFile uploadPart(Uint8List bytes, {required String fileName, String? contentType})` (dựng bằng `MultipartFile.fromBytes(..., contentType: DioMediaType.parse(...))`); adapter gọi `files.map(...)` và để Dart **suy kiểu** `List<MultipartFile>` — không cần import dio trong adapter. `fromBytes` (không phải stream) vì phát lại 401 cần `FormData.clone()` (`transport.dart:145`) — clone part dạng stream ném.
- **Mime:** backend chỉ nhận mime **khai báo trên part** thuộc `image/jpeg|png|webp|heic` (`backend/src/orders/domain/attachment-limits.ts:26-31,109`). `MultipartFile.fromBytes` mặc định `application/octet-stream` ⇒ **400 "Chỉ nhận ảnh …" với mọi ảnh**. `XFile.mimeType` của `image_picker` trên Android thường **null**. Adapter lấy `xfile.mimeType` nếu có, không thì suy từ đuôi `name`/`path` (`.jpg/.jpeg`→`image/jpeg`, `.png`, `.webp`, `.heic`); không suy được ⇒ gửi không `contentType` (backend trả 400 nguyên văn, client không tự chặn). Bảng đuôi→mime đặt ở adapter orders (một chỗ).
- `event` sinh là enum `Enum0` (5 sự kiện lane thủ công + `$unknown`); `Enum0.fromJson(event)`; `toString()` trả đúng chuỗi json (đã đọc `models/enum0.dart`). 0 ảnh ⇒ truyền `files: null` (không part rỗng — FR-23, khuôn web 10a).
- Test (adapter giả HTTP đọc body multipart): `content-type` bắt đầu `multipart/form-data; boundary=`; part `event` = `xong_giao`; 2 part `files` đúng `filename` và **`Content-Type: image/jpeg`** khi `XFile.mimeType == null` mà tên `.jpg`; 0 ảnh ⇒ không part `files`; 401 → refresh → phát lại vẫn đủ part. `XFile.fromData(bytes, name:, mimeType:)` dựng ảnh test. Mutant: bỏ `contentType` ⇒ ĐỎ; part từ stream ⇒ ca phát lại ĐỎ.

### 5. 🔥 BẪY SỐ 4 — tải nhị phân là `Stream<Uint8List>`, không có header

Method tải sinh (`ordersControllerDownloadAttachment`, `…DownloadQuoteImage/Pdf`, `contractsControllerDownloadPdf`, `invoicesControllerDownloadPdf`) trả **`Stream<Uint8List>`** (10.6 dẫn xuất spec để có kiểu này), **không** trả `Response` ⇒ không đọc được `Content-Type`/`Content-Disposition`.
- Gom byte: helper thuần (vd `Future<Uint8List> collectBytes(Stream<Uint8List>)` trong `lib/api/`, không import dio) **bên trong** `transport.call(() => collectBytes(stream))` — request chỉ chạy khi lắng nghe stream, nên lỗi (`DioException`) nổi lên trong `call` ⇒ `ApiError`. Transport đã đọc body lỗi dạng stream (`_readBody`, `transport.dart:180-188`) ⇒ 404 envelope của "hoá đơn chưa xuất PDF" vẫn ra đúng `message`. Test: 200 ⇒ đúng byte; 404 envelope ⇒ `InvoicesPortError(status: 404, message: …nguyên văn)`; 401 → refresh → phát lại ⇒ byte đúng.
- **Tên file (D7):** không có header ⇒ lấy từ **metadata backend**: `exportQuote` = `POST export-quote` (`image.fileName`, `pdf.fileName`) → `GET quote/image` → `GET quote/pdf` (3 lời gọi, đúng thứ tự, như web); `mimeType` = loại `@ApiProduces` của route (`image/png`, `application/pdf` — `orders.controller.ts:797,829`). `downloadContractPdf(orderId, contractId)` = `GET …/contracts` (overview) lấy `fileName` của đúng `contractId` → `GET …/contracts/{contractId}/pdf`; không thấy ⇒ fallback `'$contractId.pdf'`. `downloadInvoicePdf` = `GET …/invoices/{invoiceId}` (`pdf?.fileName`) → `GET …/pdf`; vắng ⇒ `'$invoiceId.pdf'`. Không đổi chữ ký port. Test thứ tự + fallback; đếm request.
- Chia sẻ: màn đã dựng `XFile.fromData(bytes, name: fileName, mimeType: …)` rồi `AppShareFn` (share_plus) — adapter chỉ trả byte (AD-3, §6.18). **Không** URL R2/presign, không mở URL backend ngoài app (link không kèm Bearer).

### 6. 🔥 BẪY SỐ 5 — màn chồng trên stack giữ state cũ (bài học review 10.7 #3)

Web route unmount ⇒ quay lại là tải lại. go_router `push` giữ màn dưới nguyên state ⇒ sau khi **chuyển trạng thái** (transition), **ghi thanh toán** (có thể tự chuyển `dacoc` — `autoTransition`), **sinh HĐ/hoá đơn**, quay về chi tiết đơn vẫn hiện trạng thái/nút cũ; sau **Tạo báo giá**/**duyệt chiết khấu** danh sách đơn không có dòng mới. Mọi lane xanh nếu test không quay lại màn dưới.
- Đổi callback điều hướng của màn **mở màn con có ghi** thành `Future<void> Function()?` và tải lại khi future xong (khuôn `CustomerListScreen.onAdd` 10.7): `OrderDetailScreen.onChangeStatus/onOpenPaymentSchedule/onOpenContracts/onOpenInvoices`, `OrderListScreen.onOpen/onAdd/onOpenDiscountApprovals`. Router truyền `() => context.push(path)` (future của `push` xong khi màn con pop).
- `OrderStatusChangeScreen.onDone` ⇒ **`pop`** về chi tiết (không `go`, không `pushReplacement` — memory `go-router-pushreplacement-drops-push-future`: go_router 17.2.3 bỏ completer của route bị thay ⇒ chi tiết không bao giờ tải lại).
- `CreateQuoteScreen.onDone(order)` ⇒ `pop` form rồi `push(orderPath(order.id))` (khuôn `/customers/lookup` 10.7) ⇒ danh sách bên dưới tải lại, back từ chi tiết về danh sách, không về form đã chốt.
- Test router: chuyển trạng thái xong ⇒ chi tiết hiện trạng thái mới (fake/HTTP giả đổi status); ghi thanh toán tự chuyển `dacoc` ⇒ back ⇒ chi tiết `dacoc`; tạo báo giá ⇒ back ⇒ danh sách có đơn mới. Mutant bỏ reload / dùng `pushReplacement` ⇒ ĐỎ.

### 7. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Cây file:**

```
mobile/tool/generate_api.dart                                  # buildMobileSpec: + bỏ format:date (bẫy 1)
mobile/lib/api/generated/models/{record_payment_request_dto,payment_response_dto}{,.g}.dart  # sinh lại
mobile/lib/api/http_{orders,inventory,stock_vouchers,payments,contracts,invoices}_port.dart  # MỚI
mobile/lib/api/sparse_bodies.dart                              # MỚI (bẫy 2)
mobile/lib/api/bytes.dart                                      # MỚI collectBytes (bẫy 4) — hoặc đặt cạnh fieldErrorMap
mobile/lib/api/transport.dart                                  # + uploadPart (bẫy 3)
mobile/lib/api/api_error.dart                                  # (nếu cần) helper fieldErrors dạng List cho Payments/StockVoucher
mobile/lib/app/app_routes.dart                                 # route đơn/kho + gate con + landing /orders
mobile/lib/app/app_ports.dart                                  # MỚI (D10) bộ port gom
mobile/lib/app/signed_in_app.dart, pns_app.dart, mobile/lib/main.dart
mobile/lib/design_system/shell/app_menu_nav.dart               # + kMobileTabLinks (D9)
mobile/lib/design_system/session/{orders,inventory,stock_vouchers,payments,contracts,invoices}_port.dart  # typedef + tên mới
mobile/lib/design_system/session/fake_{orders,inventory,stock_vouchers,payments,contracts,invoices}_port.dart
mobile/lib/screens/{orders,inventory,payments,contracts,invoices}/*.dart                      # tên/kiểu mới; callback Future (bẫy 5)
mobile/test/api/http_*_port_test.dart ×6 + http_port_errors_test.dart (MỚI), test/api/generate_api_test.dart (nếu chưa có ca buildMobileSpec)
mobile/test/app/{app_routes,signed_in_app,composition_root,pns_app}_test.dart, test/screens/** (đổi fixture)
design-system/lib/web-mobile-contract-map.mjs + .test.mjs     # XOÁ
design-system/{session/parity,screens/*,components/menu-nav-parity}.test.mjs  # hai bên cùng tên contract
```

**D2 — Type port = type sinh (AD-12, AC-1, khuôn 10.7 bẫy 2).** `typedef X = YDto;` cho mọi type có DTO — đúng tên DTO (đã đối chiếu `lib/api/generated/models/`):

| Port | typedef |
|---|---|
| orders | `Order=OrderResponseDto`, `OrderLine=OrderLineItemResponseDto`, `OrderDiscount=OrderDiscountDto`, `OrderListItem=OrderListItemDto`, `OrderPage=OrderListResponseDto`, `OrderLifecycleStep=OrderLifecycleStepDto`, `OrderNextStep=OrderNextStepDto`, `OrderLifecycle=OrderLifecycleResponseDto`, `OrderStockIssueLine=OrderStockIssueLineDto`, `OrderStockIssueView=OrderStockIssueViewDto`, `OrderStockCheckLine=OrderStockCheckLineDto`, `OrderStockCheck=OrderStockCheckDto`, `OrderStockIssueResult=OrderStockIssueResultDto`, `StatusChangeResult=StatusChangeResponseDto`, `AttachmentItem=AttachmentItemDto`, `OrderVersionQtyChange=QtyChangeDto`, `OrderVersionChange=VersionChangesDto`, `OrderVersionItem=OrderVersionItemDto`, `CreateOrderInput=CreateOrderRequestDto`, `AddOrderLineInput=AddLineItemRequestDto`, `OrderTotals=PreviewTotalResponseDto`, `ApplyDiscountInput=ApplyDiscountRequestDto`, `ResolveDiscountInput=ResolveDiscountRequestDto`, `DiscountPendingLine=DiscountPendingLineDto`, `DiscountPendingItem=DiscountPendingItemDto`, `PreviewTotalInput=PreviewTotalRequestDto`, `PreviewTotalLine=PreviewTotalLineDto` |
| inventory | `StockItemView=StockItemViewDto`, `PurchaseNeedView=PurchaseNeedViewDto` (thay `CanMuaView` — đổi tên cùng caller), `StockList=StockListResponseDto` |
| stock-vouchers | `StockVoucherCreator=StockVoucherCreatorDto`, `StockVoucherSummary=StockVoucherSummaryDto`, `StockVoucherReturnOf=StockVoucherReturnOfDto`, `StockVoucherReturnRef=StockVoucherReturnRefDto`, `StockVoucherLine=StockVoucherLineResponseDto`, `StockVoucherDetail=StockVoucherDetailDto`, `StockVoucherList=StockVoucherListResponseDto`, `CreateStockVoucherLineInput=StockVoucherLineRequestDto`, `CreateStockVoucherInput=CreateStockVoucherRequestDto`, `CreateReturnVoucherLineInput=ReturnVoucherLineRequestDto` |
| payments | `Payment=PaymentResponseDto`, `Installment=InstallmentResponseDto`, `PaymentSchedule=PaymentScheduleResponseDto`, `InstallmentInput=InstallmentInputDto`, `ReplacePaymentScheduleInput=ReplacePaymentScheduleRequestDto`, `AutoTransitionResult=AutoTransitionResultDto`, `RecordPaymentResult=RecordPaymentResponseDto` |
| contracts | `ContractSummary=ContractResponseDto`, `ContractsOverview=ContractsOverviewResponseDto` |
| invoices | `InvoiceSummary=InvoiceResponseDto`, `InvoicesOverview=InvoicesOverviewResponseDto`, `InvoiceSeller=InvoiceSellerDto`, `InvoiceLine=InvoiceLineDto`, `InvoicePdfInfo=InvoicePdfResponseDto`, `InvoiceDetail=InvoiceDetailResponseDto` |

- **Giữ tay (có lý do, ghi comment đầu class):** interface port; 5 lớp lỗi port; `QuoteExportFile(s)`, `ContractPdfFile`, `InvoicePdfFile` (byte do adapter dựng, không phải contract); `UpdateOrderLineInput`, `UpdateScopeFlagsInput`, `UpdateOrderMetaInput` (ba trạng thái — bẫy 2); `RecordPaymentInput` (`amount` vắng được — D8); `StockVoucherFieldError`/`FieldError` (payload lỗi của lớp lỗi — có thể thay bằng `FieldErrorDto` nếu không đổi màn). Field của input giữ tay đổi theo contract (`scopeConstruction/scopeDelivery`).
- Một typedef đúng tên chưa tồn tại DTO (vd `DiscountPendingLineDto` khác hình) ⇒ đối chiếu field trước; khác hình thật thì giữ tay + ghi lý do, không ép. **Đếm thật** số typedef cuối cùng và ghim vào guard (`expect(aliased, 11 + N)`).
- Hệ quả kiểu (khuôn 10.7): `num`→`.toInt()` ở **điểm dùng** (`MoneyText`/`formatVnd` nhận `int` — không làm phép tính tiền, AD-2/AD-16); ngày `DateTime` (trừ `paidOn` sau bẫy 1; `StatusChangeResponseDto.occurredAt`, `CancelOrderResponseDto.occurredAt` là `String`) ⇒ hiển thị **giữ đúng chuỗi người dùng đang thấy hôm nay**: đưa `d.toUtc().toIso8601String()` vào formatter sẵn có (không đổi ngữ nghĩa ngày trong story này), fixture dùng `DateTime.utc(…)`; trạng thái/loại/phương thức là **enum sinh** ⇒ so bằng `.json` với hằng sẵn có (`kOrderStatusDachot`, `kEventDelivered`, `kDiscount*`, `kStockCheckShort` — guard 4.6 cấm literal trong màn), `$unknown` ⇒ nhãn/màu trung tính, không crash (test ít nhất một ca mỗi enum hiển thị: trạng thái đơn, `stockStatus`, `paymentStatus`); `StockVoucherDetail` không còn `extends StockVoucherSummary` — chỗ màn nhận chung hai kiểu thì đọc field cần thiết ở điểm dùng.
- Mọi typedef import `../../api/generated/models/…dart` (hướng phụ thuộc đã chấp nhận ở 10.7); **không** import `package:dio`/`transport.dart` từ `design_system/`. `orders_port.dart` vẫn import `image_picker` cho `XFile` (đầu vào ảnh).

**D3 — Method tiếng Anh (§6.8, AC-1)** — chữ ký như web 10.5: `transition(String orderId, String event, List<XFile> files)`, `cancel(String orderId, String reason)`, `listAttachments(orderId)`, `addAttachments(orderId, List<XFile> files)`, `removeAttachment(orderId, attachmentId)`, `attachmentBytes(orderId, attachmentId) → Uint8List`. Đổi cùng **mọi** caller (màn, fake, test, guard). Tham số `anh`/`lyDo` → `files`/`reason`; `fieldErrors` key của fake `'lyDo'/'anh'` → `'reason'/'files'` (đúng backend `orders.service.ts`). Grep cuối: `grep -rnE "chuyenTrangThai|huyDon|themAnh|xoaAnh|listAnh|anhBytes" mobile/lib mobile/test design-system` ⇒ rỗng.

**D4 — Adapter** (`Http…Port(PnsApiClient client, Transport transport)`, mọi lời gọi qua `transport.call`, không import dio, không logic nghiệp vụ, không tính tiền, không chuẩn hoá SĐT — AD-9):

| Port.method | Client sinh | Ghi chú |
|---|---|---|
| `OrdersPort.create` | `ordersControllerCreate(body:)` | `customerPhone` thô |
| `.get` / `.getLifecycle` | `FindOne` / `Lifecycle` | |
| `.list({status,followUp,page,pageSize})` | `ordersControllerList(status: Status.fromJson?, followUp, page, pageSize)` | `null` giữ `null` (retrofit bỏ query null); test query không có key thừa |
| `.listVersions` / `.listAttachments` | `ListVersions` / `ListAttachments` | unwrap `.items` |
| `.addLine` / `.updateLine` / `.removeLine` | `AddLine` / `UpdateLine` / `RemoveLine` (void) | body thưa (bẫy 2) |
| `.updateScopeFlags` / `.updateOrderMeta` | cùng `ordersControllerUpdate` | body thưa |
| `.previewTotal` | `PreviewTotal` | |
| `.confirmOrder` / `.reviseOrder` | `Confirm` / `Revise` | |
| `.applyDiscount` / `.resolveDiscount` / `.listPendingDiscounts` | tương ứng | |
| `.exportQuote` | `ExportQuote` → `DownloadQuoteImage` → `DownloadQuotePdf` | bẫy 4 |
| `.transition` / `.addAttachments` | multipart | bẫy 3; `addAttachments` bỏ response (port `void`) |
| `.cancel` | `Cancel(body: CancelOrderRequestDto(reason:))` | port `void` |
| `.removeAttachment` / `.attachmentBytes` | `RemoveAttachment` / `DownloadAttachment` | bẫy 4 |
| `.getStockIssue` / `.issueStock` / `.getStockCheck` | tương ứng | `issueStock` 200 (replay) và 201 đều thành công — test cả hai |
| `InventoryPort.listStock({q})` | `stockItemsControllerList(q:)` | |
| `StockVouchersPort.*` | `stockVouchersControllerList(type: Type.fromJson?, isReturn)` / `FindOne` / `Create` / `CreateReturn(id, body)` | |
| `PaymentsPort.getSchedule/replaceSchedule` | `paymentSchedulesControllerGet/Replace` | `InstallmentInputDto` gửi `percent: null`/`amount: null` là được (backend `isSet` coi null là vắng — `payment-schedule.ts:112`); test body |
| `.recordPayment` | `paymentsControllerRecord(body:)` | D8 |
| `ContractsPort.*` | `contractsControllerOverview/Generate/DownloadPdf` | tên file D7 |
| `InvoicesPort.*` | `invoicesControllerOverview/Create/Detail/ExportPdf/DownloadPdf` | tên file D7 |

**D5 — Body thưa:** bẫy 2.

**D6 — Upload:** bẫy 3.

**D7 — Tải + tên file:** bẫy 4.

**D8 — Ghi thanh toán (NFR-1, AC-4).** `idempotencyKey` do màn sinh **một lần mỗi lần mở form** (`PaymentScheduleScreen.newKey`, 7.2) — adapter **chỉ chuyển nguyên vẹn** trong body (không header — CORS/khuôn web), không bao giờ tự sinh. `RecordPaymentInput.amount` là `int?` (giữ tay, giữ ngữ nghĩa 7.2 "ô trống không phải 0"); DTO sinh bắt buộc `amount` ⇒ adapter **không bịa số**: `amount == null` ⇒ ném `PaymentsPortError(code: 'VALIDATION_ERROR', message: …, fieldErrors: [amount: 'Số tiền thu phải là số nguyên đồng.'])` (đúng câu backend `record-payment-request.dto.ts:42`), **0 request**. Màn hiện đã tự dừng khi ô trống (`payment_schedule_screen.dart:304-305`) nên đường này chỉ là chốt an toàn — test nó (0 request + đúng field). `paidOn` gửi chuỗi `YYYY-MM-DD` thô từ form (sau bẫy 1). Test: body có đúng `idempotencyKey` truyền vào (byte-for-byte), gọi 2 lần cùng input ⇒ 2 request cùng khoá, `paidOn` đúng `"2026-10-21"`; mutant tự sinh khoá ⇒ ĐỎ; mutant `amount ?? 0` ⇒ ĐỎ.

**D9 — Tab + route + gate (AC-3, ghi 10.7 trong epics).**
- Tab khoá cứng 5 (UX-DR-15) ⇒ không ẩn được tab; gate tab = **bấm không làm gì** khi account không mở được (như tab chưa nối ở 10.7), route đích vẫn redirect về landing. Dữ liệu gate tab: thêm `kMobileTabLinks` (`List<AppNavLink>`) trong `app_menu_nav.dart`: `orders` "Đơn hàng" `requiresAny [ordersViewAll, ordersViewOwn]`; `inventory` "Kho" `requiresAny [inventoryManage, quotesCreateEdit]` — **trùng** `SIDEBAR_NAV` web theo key; mở rộng `menu-nav-parity.test.mjs` so cả `kMobileTabLinks` (chống-rỗng: so được ≥ 5 mục tổng; mutant đổi `requiresAny` của `inventory` mobile ⇒ ĐỎ). Dùng `AppPermissionKeys.x` (memory `mobile-screens-use-apppermissionkeys-not-appperm`).
- `app_routes.dart` (tiếng Anh, khuôn web `routes.ts`): `kOrdersPath='/orders'`, `kOrderNewPath='/orders/new'`, `kDiscountApprovalsPath='/orders/discount-approvals'`, `orderPath(id)`, `orderTransitionPath`, `orderPaymentsPath`, `orderContractsPath`, `orderInvoicesPath`, `orderInvoicePath(id, invoiceId)` (id `Uri.encodeComponent`), `kInventoryPath='/inventory'`, `kStockVouchersPath='/inventory/vouchers'`. `kNavRoutes` + `orders`, `inventory`; `openableKeys` đọc **cả** `kMobileMenu` và `kMobileTabLinks` (một nguồn dữ liệu gate — AD-17). Route con cần quyền riêng: bảng thuần `kSubRoutePermission` (path prefix → `PermissionKey`) — `/orders/new` `quotesCreateEdit`, `/orders/discount-approvals` `discountsApprove`, `/orders/:id/contracts` `contractsGenerate`, `/orders/:id/invoices` (+ `/:invoiceId`) `invoicesManage`, `/inventory/vouchers` `inventoryManage`; `/transition`, `/payments` chỉ gate cha. `isOpenable` = gate cha **và** quyền con. Route tĩnh (`new`, `discount-approvals`) đăng ký **trước** `/orders/:id` (khuôn `/customers/lookup`) — test mở `/orders/new` ra `CreateQuoteScreen`, không phải chi tiết đơn id `new`.
- `landingPath(perms)` = `/orders` nếu `orders` mở được, ngược lại `/menu` (Câu hỏi mở 2 của 10.7, giống web).
- `_selectTab`: 1 ⇒ `go('/orders')`, 3 ⇒ `go('/inventory')` (chỉ khi key mở được), 4 ⇒ `go('/menu')`, 0 (Trang chủ) **giữ không làm gì** (Epic 8.1). `onCreateQuote` ⇒ `push('/orders/new')` chỉ khi mở được; không quyền ⇒ `null` (bấm không làm gì).
- Nút trong màn (khớp web 10.5 D9–D10, §6.19): `OrderListScreen.onAdd` chỉ khi `quotesCreateEdit`; **thêm** prop tuỳ chọn `OrderListScreen.onOpenDiscountApprovals` (nút ghost "Duyệt chiết khấu", nhãn byte-identical web — đọc `design-system/screens/orders-list.test.mjs` + `discount-approval.test.mjs` trước) chỉ khi `discountsApprove`; nút "+ Tạo đơn" chỉ render khi có `onAdd` (kiểm màn mobile hiện có render vô điều kiện không; khớp web). `OrderDetailScreen`: `onChangeStatus` luôn truyền (màn tự ẩn khi `nextSteps` rỗng), `onOpenPaymentSchedule` **mọi account xem được đơn**, `onOpenContracts` chỉ khi `contractsGenerate`, `onOpenInvoices` chỉ khi `invoicesManage`; `InventoryScreen.onOpenVouchers` truyền (màn tự gate `inventoryManage`); `InvoicesScreen.onOpenInvoice` ⇒ `orderInvoicePath`. `onBack` ⇒ `pop`. Gating là UX; backend enforce (AD-4).
- Thứ tự màn con: mở bằng `push` (back Android pop), đổi tab bằng `go` (khuôn 10.7). Bẫy 5 cho tải lại.

**D10 — Composition root + bộ port.** 11 port qua `PnsApp` → `SignedInApp` từng tham số là quá dài ⇒ thêm `lib/app/app_ports.dart`: `class AppPorts { final MePort me; … final CatalogPort catalog; final OrdersPort orders; … }` (giá trị thuần, khuôn `AppPorts` web), `PnsApp`/`SignedInApp` nhận `AppPorts` (+ `auth` riêng như hiện tại). `main.dart` dựng thêm `HttpCatalogPort` (nối FAB — hẹn ở 10.7) + 6 adapter mới. Guard `composition_root_test.dart`: chỉ `main.dart` gọi `Http\w+Port(` (đã có — giờ phủ 12 adapter); tự kiểm dương mở rộng danh sách lời gọi thật phải thấy trong `main.dart` (thêm `HttpOrdersPort`, `HttpPaymentsPort`, `HttpCatalogPort`); typedef: thêm 6 file port vào `generatedTypes` + ghim số đếm thật; `AppPorts` dựng ở `main.dart` là được (không phải `Http…Port`). Mutant: `HttpOrdersPort(` trong `signed_in_app.dart` ⇒ ĐỎ; `FakeOrdersPort()` trong `main.dart` ⇒ ĐỎ; `class Order {…}` khai tay lại ⇒ ĐỎ.

**D11 — Spec dẫn xuất:** bẫy 1.

**D12 — Đổi lỗi (khuôn 10.7 D3):** mỗi adapter **một** helper `_call<T>(Future<T> Function())` = `transport.call` + `on ApiError catch (e)` ⇒ lỗi port của nó: Orders ⇒ `OrderPortException(e.message, code: e.code, fieldErrors: fieldErrorMap(e))`; StockVouchers ⇒ `StockVoucherPortException(e.message, fieldErrors: [StockVoucherFieldError(field, code, message) …])` (giữ thứ tự, mọi dòng); Payments ⇒ `PaymentsPortError(code: e.code ?? '', message: e.message, fieldErrors: […])`; Contracts/Invoices ⇒ `…PortError(status: e.status ?? 0, message: e.message)`; Inventory ⇒ ném nguyên `ApiError` (màn `catch (_)`). Cancel (`DioException` cancel) đi nguyên. **Test lỗi phủ MỌI method** (bài học review 10.5 H-1): `test/api/http_port_errors_test.dart` — bảng ca theo từng port liệt kê **đủ** method (đếm khớp số method của interface — chống-rỗng: tổng = 26 + 1 + 4 + 3 + 3 + 5 = **42**), mỗi ca envelope 409 ⇒ đúng lớp lỗi, đúng `message`/`code`/`status`, đúng 1 request. Ca riêng: `get` 404 `NOT_FOUND` ⇒ `OrderPortException.code == 'NOT_FOUND'` (màn dựng trạng thái không tìm thấy); `cancel` 400 `fieldErrors[{field:'reason'}]` ⇒ `fieldErrors['reason']`; ghi thanh toán 400 `fieldErrors[{field:'paidOn'}]` ⇒ `PaymentsPortError.fieldErrors` có `paidOn`. Mutant "một adapter nuốt lỗi" / "ném nguyên `ApiError`" ⇒ ĐỎ.

**D13 — Fake (§6.20)** viết lại theo type sinh + method/field mới; ngày `DateTime.utc`; số là `num` hợp lệ; chỉ test/demo dùng (guard composition root). Không xoá ca test màn nào — đổi fixture.

**D14 — Guard design-system (xoá bảng tạm).**
- **Xoá** `design-system/lib/web-mobile-contract-map.mjs` + `web-mobile-contract-map.test.mjs` (header của nó hẹn xoá ở 10.8). Mọi guard đang `mobileField(dto, f)`/`mobileMethod(m)` (`session/parity.test.mjs` ~10 chỗ 334–748, `screens/{order-attachments,order-cancel,order-transition,inventory,order-detail}.test.mjs`) đổi sang **tên contract ở cả hai bên**; phía mobile đọc field qua `design-system/lib/mobile-contract-types.mjs` (`mobileAliasDto` + `mobileDtoFields` — khuôn 10.7) khi guard so **field** của type. **KHÔNG xoá assert, KHÔNG nới regex**; đếm số test design-system trước/sau: không giảm trừ đúng các test của file map đã xoá (ghi số vào Debug Log).
- Guard khác đọc file mobile đơn/kho/tiền (`screens/{contracts,invoices,payment-schedule,stock-vouchers,stock-issue,orders,orders-list,discount-approval,quote-stock-check}.test.mjs`, `lib/stock-figures.mjs`, `money/money-render-guard.test.mjs`): chạy `cd design-system && npm test` **ngay sau khi đổi tên port mobile**, trước khi viết adapter — đọc từng đỏ, sửa đúng chỗ (đổi tên field/method theo contract, cùng độ chặt).
- Nhãn UI hai nền tảng byte-identical (`screens/*.test.mjs`) — **không đổi chuỗi UI** màn có sẵn; nhãn mới ("Duyệt chiết khấu") lấy nguyên văn web.

### 8. Phạm vi

**TRONG:** spec dẫn xuất `format: date`; 6 adapter + `sparse_bodies` + `uploadPart` + gom byte + test (thành công từng method + lỗi phủ 42 method); type sinh cho 6 port + method/field tiếng Anh + fake + màn + test; callback `Future` + tải lại; `kMobileTabLinks` + route đơn/kho + gate con + landing `/orders`; tab 1/3 + FAB; `OrderListScreen.onOpenDiscountApprovals`; `AppPorts`; composition root 12 adapter + guard; xoá bảng map design-system + đổi guard; smoke emulator; G-5.

**NGOÀI (đừng làm):** backend (không đổi một byte — `openapi.json` giữ nguyên; nếu thấy cần đổi contract thì DỪNG và ghi câu hỏi); web (đã xong 10.5 — chỉ đụng nếu guard parity buộc, ghi lý do); màn Trang chủ/dashboard (8.1), Phân quyền, Audit (Epic 8); đăng nhập bằng SĐT (10.9); màn sửa báo giá đã lưu (câu hỏi mở 10.5 #1); sửa lịch đã thu / khoản điều chỉnh (TD-51/52); đổi giá trị enum (§6.6); nút back trên topbar màn con (iOS — ngoài Epic 10); nâng Flutter/go_router; BLoC.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md` Story 10.8)

1. **Given** port orders, inventory, stock-vouchers, payments, contracts, invoices, **When** dùng adapter, **Then** cài bằng client sinh; method tiếng Việt đổi sang tiếng Anh cùng caller (mặc định §6.8).
2. **Given** chụp/chọn ảnh và chia sẻ PDF/ảnh, **When** gọi, **Then** upload multipart qua backend (AD-3); tải nhị phân kèm Bearer rồi chuyển byte cho `share_plus` (UX-DR-21, mặc định §6.18).
3. **Given** chi tiết đơn mobile, **When** điều hướng render màn, **Then** nút Thanh toán/Hợp đồng/Hoá đơn có callback theo cùng luật quyền như web 10.5 (mặc định §6.19); widget test cho account đủ và thiếu quyền.
4. **Given** ghi thanh toán, **When** gửi, **Then** khoá idempotency truyền nguyên vẹn; retry không ghi trùng (NFR-1).
5. **Given** backend + `pns-postgres` local và emulator Android, **When** smoke đầu-cuối, **Then** đăng nhập → tạo báo giá → chốt → ghi thanh toán → xem HĐ/hoá đơn → chia sẻ PDF thành công; ghi vào Dev Agent Record (mặc định §6.21).
6. **Ghi từ Story 10.7:** nối tab **Đơn hàng** (1), **Kho** (3) và FAB **Tạo** (`CreateQuoteScreen`, dựng `HttpCatalogPort` trong `main.dart` lúc này) qua `AppBottomNavScope` trong `SignedInApp`; thêm route + key vào `kNavRoutes`; landing đổi thành `/orders` khi account có quyền xem đơn (giống web), còn lại `/menu`.

### AC dẫn xuất (đo được)

7. **Spec dẫn xuất (bẫy 1, D11):** `buildMobileSpec` bỏ `format: date` đúng 2 chỗ (ít hơn ⇒ ném); test thuần (date đổi, date-time giữ); `paidOn` sinh là `String` ở 2 model; diff `lib/api/generated/**` chỉ 2 model đó (+ `.g.dart`); `backend/openapi/openapi.json` không đổi byte; drift-guard xanh.
8. **Type sinh + đổi tên (D2, D3, AC-1):** bảng typedef D2 (ngoại lệ có lý do); `composition_root_test` ghim số typedef thật (11 + N) và phủ 10 file port; `grep -rnE "chuyenTrangThai|huyDon|themAnh|xoaAnh|listAnh|anhBytes" mobile design-system --include='*.dart' --include='*.mjs'` ⇒ rỗng; `grep -rnE "\.(customerSdt|scopeThietBi|scopeThiCong|scopeVanChuyen|buoc|buocKeTiep|coTheHuy|trangThai|soAnhDaLuu|nguoiTaiLen|coTheXoa|laBanHienLuc|chotAt|soDong|thayDoi|them|xoa|doiSoLuong|ten|tu|den|donVi|khaDung|canNhap|tinhTrang|danhSachCanMua|ma|nguoiTao|tongSoLuong)\b" mobile/lib mobile/test --include='*.dart'` ngoài `lib/api/generated/` ⇒ rỗng (biến/state cục bộ của màn không phải field contract thì được — vd state `_buocKeTiep` của `OrderDetailScreen` mà guard 5.5/5.7 ghim, như web 10.5 Debug Log); enum `$unknown` ⇒ nhãn trung tính, có test; ngày hiển thị giữ nguyên chuỗi cũ với fixture `DateTime.utc` **và** chuỗi `…Z` parse thật.
9. **Adapter (D4–D8, D12)** — mỗi adapter một file test (`Transport` thật + `test/api/support/fake_http.dart`/`api_stack.dart`), mỗi method ≥1 ca thành công assert method + path + query/body + kết quả map, đếm request:
   - a. multipart transition/addAttachments (bẫy 3: boundary, `event`, 2 part `files` tên + `image/jpeg` khi `mimeType` null, 0 ảnh ⇒ không part, 401 phát lại đủ part);
   - b. body thưa (bẫy 2: 6 ca JSON chính xác);
   - c. nhị phân (bẫy 4: byte đúng, 404 envelope ⇒ lỗi port đúng message, 401 phát lại; `exportQuote` 3 lời gọi đúng thứ tự + `fileName` từ metadata + mime theo route; contract/invoice tên file từ metadata + fallback);
   - d. thanh toán (D8: khoá nguyên vẹn, 2 lần cùng khoá, `paidOn` `"2026-10-21"`, `amount` null ⇒ lỗi field + 0 request);
   - e. `list` query không key thừa; `listVersions`/`listAttachments` unwrap `items`; `issueStock` 200 và 201; `listStock(q: 'pin')`; `listVouchers(type: 'xuat', isReturn: false)`; `cancel` body `{"reason":…}`.
   - f. `http_port_errors_test.dart` 42 method (D12) + ca riêng `NOT_FOUND`/`reason`/`paidOn`.
10. **Mutation adapter** (backup `cp`, KHÔNG `git checkout`, mutant phải biên dịch, mỗi mutant in dòng tổng): DTO trần thay body thưa ⇒ ĐỎ; bỏ `contentType` part ⇒ ĐỎ; part từ stream ⇒ ĐỎ (phát lại); `recordPayment` tự sinh khoá ⇒ ĐỎ; `amount ?? 0` ⇒ ĐỎ; tên file luôn fallback ⇒ ĐỎ; `exportQuote` bỏ một lời gọi/đổi thứ tự ⇒ ĐỎ; một adapter nuốt lỗi / ném nguyên `ApiError` ⇒ ĐỎ; bỏ đổi `format: date` ⇒ ĐỎ (test generator hoặc drift).
11. **Router + gate + 3 nút (AC-3, AC-6, D9)** — `test/app/app_routes_test.dart` (thuần): `openableKeys`/`isOpenable`/`landingPath` theo bộ quyền (rỗng ⇒ `/menu`, chỉ Hồ sơ; `orders.view_own` ⇒ landing `/orders`, `/orders/x/contracts` không mở; `quotes.create_edit` không quyền đơn ⇒ `inventory` mở, `orders` không, landing `/menu`; `inventory.manage` ⇒ `/inventory/vouchers` mở). `test/app/signed_in_app_test.dart` (widget, port HTTP giả hoặc fake **trong test**):
    - a. account `orders.view_all` + `contracts.generate` + `invoices.manage`: landing danh sách đơn; mở đơn ⇒ 3 nút; bấm từng nút ⇒ đúng màn với đúng `orderId`; back ⇒ chi tiết.
    - b. account chỉ `orders.view_own` (cùng fixture đơn, **chỉ khác quyền** — memory `widget-test-gate-unreachable-outer-condition`): có "Thanh toán", **không** "Hợp đồng"/"Hoá đơn"; `go('/orders/o1/contracts')` ⇒ về landing.
    - c. `/orders/new` không `quotes.create_edit` ⇒ landing; có quyền ⇒ `CreateQuoteScreen` (không phải chi tiết id `new`); FAB có quyền ⇒ mở form, thiếu ⇒ không đổi route, không ném.
    - d. tab Đơn hàng/Kho từ Menu ⇒ `/orders`/`/inventory`; tab thiếu quyền ⇒ không đổi route; tab Trang chủ ⇒ không đổi (giữ ca 10.7); `/inventory/vouchers` thiếu `inventory.manage` ⇒ landing, có ⇒ `StockVouchersScreen`.
    - e. nút "Duyệt chiết khấu" chỉ khi `discounts.approve` (+ route gate cùng quyền); "+ Tạo đơn" chỉ khi `quotes.create_edit` (danh sách có dòng lẫn rỗng).
    - f. tải lại (bẫy 5): chuyển trạng thái ⇒ chi tiết trạng thái mới; ghi thanh toán tự `dacoc` ⇒ back ⇒ chi tiết `dacoc`; tạo báo giá ⇒ chi tiết đơn mới, back ⇒ danh sách có đơn mới, back nữa không về form.
    - g. Mutant: `onOpenContracts` vô điều kiện ⇒ 11b ĐỎ; bỏ quyền con `/orders/:id/invoices` ⇒ ĐỎ; bỏ gate `/inventory/vouchers` ⇒ 11d ĐỎ; landing luôn `/menu` ⇒ ĐỎ; bỏ reload chi tiết ⇒ 11f ĐỎ; `pushReplacement` cho onDone tạo báo giá ⇒ 11f ĐỎ.
12. **Composition root (D10):** `main.dart` dựng 12 adapter (`HttpCatalogPort` có mặt); guard xanh với tự kiểm dương mở rộng; 3 mutant D10 ĐỎ; guard mạng 10.6 xanh (không adapter nào import dio; `parseEnvelope(` chỉ ở `transport.dart`/`api_error.dart`).
13. **Guard design-system (D9, D14):** file map + test của nó đã xoá; guard parity dùng tên contract hai bên; `menu-nav-parity` phủ `kMobileTabLinks` + mutant ĐỎ; `npm test` xanh, không assert nào bị xoá/nới ngoài file map (ghi số trước/sau).
14. **Smoke emulator thật (AC-5, luật 12–14 automator)** — chuẩn bị y 10.5/10.7: `pns-postgres` 5433 (smoke **sau** `npm run test:db` ⇒ DB trống, seed bằng SQL: account, 1 nguồn khách, 2 sản phẩm UUID hex — memory `smoke-headless-share-and-db-lane-wipe`); backend `npm run start:prod` với `JWT_ACCESS_SECRET` ngẫu nhiên ≥32 ký tự + `DATABASE_URL` 5433 + `R2_*` trỏ MinIO **riêng** `pns-minio-smoke` (cổng 9200, bucket `smoke-10-8`) + `PUPPETEER_EXECUTABLE_PATH` Chrome hệ thống — tất cả **trên lệnh**, KHÔNG đọc/sửa `backend/.env`; AVD `Pixel_9_Pro` cold boot `-no-snapshot`, APK debug `--dart-define=API_BASE_URL=http://10.0.2.2:3000` (lệnh có chữ "build" chạy qua script Write — memory `scout-block-hook-dist-build-words`); điều khiển `adb input` + `uiautomator dump` + `screencap`. Account `smoke-10-8-a@local.test` (argon2id, mật khẩu ngẫu nhiên): `orders.view_all`, `quotes.create_edit`, `orders.confirm`, `customers.manage`, `catalog.view`, `payments.record`, `contracts.generate`, `invoices.manage`, `inventory.manage`, **`delivery.confirm`** (thiếu là nút chuyển trạng thái ẩn — memory); `smoke-10-8-b@local.test`: `orders.view_own` + `quotes.create_edit` (đơn smoke gán `assignee` B bằng SQL). Các bước A: (i) đăng nhập ⇒ vào **Đơn hàng**; (ii) FAB ⇒ tra SĐT `0900 000 108` ⇒ tạo khách ⇒ thêm 2 dòng danh mục, tổng do backend ⇒ "Chia sẻ" báo giá ⇒ hộp chia sẻ Android mở (ghi tên file ảnh/PDF thấy trong chooser hoặc log) ⇒ Chốt ⇒ chi tiết đơn có 3 nút; (iii) Thanh toán: cấu hình lịch ⇒ ghi đợt 1 ⇒ SQL đếm `payments` = 1, đơn tự `dacoc`, back ⇒ chi tiết hiện `dacoc` (bẫy 5); đo retry: gửi lại cùng khoá (vd ngắt mạng emulator `svc wifi/data` sau khi bấm hoặc gọi lại bằng `curl` cùng khoá + token của phiên) ⇒ vẫn 1 dòng; (iv) Hợp đồng: sinh ⇒ chia sẻ PDF ⇒ chooser mở; (v) Hoá đơn: lập ⇒ chi tiết ⇒ xuất PDF ⇒ chia sẻ; (vi) chuyển trạng thái `bat_dau_giao` kèm 1 ảnh **chụp/chọn trên emulator** ⇒ request multipart thành công (SQL `attachments` +1, `content_type` `image/jpeg|png`), tab ảnh hiện ảnh (byte qua Bearer); (vii) Kho: tồn ⇒ Phiếu kho mở. B: (viii) landing Đơn hàng; chi tiết đơn được gán chỉ "Thanh toán"; FAB mở form (B có `quotes.create_edit`). Ghi kết quả từng bước. **Dọn:** 1 transaction SQL theo thứ tự FK (khuôn 10.5) cho dữ liệu smoke + 2 account (+ session); `audit_logs` append-only để lại (ghi số dòng); `docker rm -f pns-minio-smoke`; gỡ app; verifier AVD trả về như cũ; tắt emulator + backend (cổng 3000 trống); không dùng `kidy-dev-*`, không gọi dịch vụ ngoài localhost. Bước nào không chạy được ⇒ ghi rõ lỗi đo được, chạy hết phần còn lại, **không giả kết quả**.
15. **5 lane xanh:** mobile `flutter analyze` sạch + `flutter test` (> 608, không xoá ca cũ — ca 10.7 "tab Đơn hàng/Kho/FAB không làm gì" được **thay** bằng ca nối thật, giữ ca Trang chủ); design-system `npm test` (số test thay đổi chỉ do file map bị xoá + test mới — ghi rõ); web `npm run typecheck && npm test && npm run build` (439, không đổi); backend `npm test` (2504) + `npm run test:db` (322) — không đổi backend, `openapi.json` byte giữ nguyên.
16. **G-5 cùng commit:** bullet "Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.8)" vào `epics.md` Story 10.8 (spec dẫn xuất bỏ `format: date`; body thưa cho PATCH; `uploadPart` ở transport + suy mime; tên file từ metadata; `amount` vắng ⇒ lỗi field 0 request; `kMobileTabLinks` + gate tab = bấm không làm gì; landing `/orders`; `onOpenDiscountApprovals` mobile; callback `Future` + tải lại; `AppPorts`; xoá bảng map; mọi tinh chỉnh khác phát sinh); `project-context.md` đoạn Mobile: bỏ câu "Port mobile đơn/kho/tiền/chứng từ vẫn chạy fake và giữ tên field cũ tới 10.8", bỏ nhắc `web-mobile-contract-map.mjs`, thêm 1–2 câu về 12 adapter + body thưa + spec dẫn xuất — đọc trước, chỉ sửa câu sai.

---

## Tasks / Subtasks

- [x] **T1 — Spec dẫn xuất `format: date`** (AC-7, bẫy 1): `buildMobileSpec` + test thuần; regen; đọc diff (chỉ 2 model); `flutter test` + analyze xanh trước khi sang T2
- [x] **T2 — Port: typedef + method/field tiếng Anh** (AC-8, D2, D3): 6 port + 6 fake + màn + test màn; **ngay sau đó** `cd design-system && npm test` ⇒ xoá file map, đổi guard (D14); mobile + design-system xanh trước khi viết adapter
- [x] **T3 — Hạ tầng adapter** (bẫy 2–4): `sparse_bodies.dart`, `Transport.uploadPart`, gom byte, helper lỗi; test thuần
- [x] **T4 — 6 adapter + test** (AC-9, D4–D8, D12) + `http_port_errors_test.dart` (42 method) + mutation AC-10
- [x] **T5 — Route + gate + tab + landing** (AC-6, AC-11, D9): `kMobileTabLinks`, `app_routes.dart`, `_selectTab`, FAB, `OrderListScreen.onOpenDiscountApprovals`, nút "+ Tạo đơn" theo `onAdd`; parity guard (AC-13)
- [x] **T6 — Tải lại sau màn con** (bẫy 5): callback `Future`, pop-then-push; test 11f + mutant
- [x] **T7 — `AppPorts` + `main.dart` + guard composition root** (AC-12, D10) + 3 mutant
- [x] **T8 — APK debug + smoke emulator** (AC-5, AC-14)
- [x] **T9 — 5 lane + G-5** (AC-15, AC-16); File List đúng từng đường dẫn (`git status -uall`), `git check-ignore` file mới, `git add` đường dẫn cụ thể; story → `review`

---

## Dev Notes

### Smoke đầu-cuối (Trợ Lý, 2026-10-22) — bắt buộc trước khi chuyển review

- backend/.env thiếu JWT_ACCESS_SECRET hợp lệ và mật khẩu seed nằm trong .env: KHÔNG đọc/sửa .env. Chạy backend bằng biến tạm ngay trên lệnh (JWT_ACCESS_SECRET ngẫu nhiên ≥32 ký tự), Postgres local 5433.
- Tạo account smoke RIÊNG (smoke-<story>@local.test, mật khẩu ngẫu nhiên, băm argon2id như backend, quyền vừa đủ) thẳng vào DB local; không đổi account có sẵn; xoá account smoke + tắt backend khi xong.
- Smoke luồng chính của story trên client thật (mobile: emulator Android; chạy được thì chạy, không thì ghi rõ chưa chạy và vì sao).
- Storage: MinIO riêng `pns-minio-smoke` (cổng 9200 — 9100 có thể bị tiến trình dart chiếm), `R2_*` trên lệnh, adapter production không sửa (endpoint IP ⇒ SDK path-style); PDF cần `PUPPETEER_EXECUTABLE_PATH` Chrome hệ thống (memory `puppeteer-smoke-render-system-chrome`). Docker chưa chạy ⇒ nhờ Đại Ca bật Docker Desktop (memory `db-lane-needs-docker-desktop-gui`), không giả kết quả.

### Quyết định đã chốt — không bàn lại

- §6.8 (đổi method tiếng Việt ở story adapter), §6.18 (byte qua Bearer → `share_plus`, không link công khai), §6.19 (3 nút: Thanh toán mọi account xem đơn; Hợp đồng ↔ `contracts.generate`; Hoá đơn ↔ `invoices.manage`), §6.20 (fake giữ cho test/demo, viết lại theo type sinh), §6.21 (smoke trên máy), §6.6 (giá trị enum giữ nguyên tiếng Việt không dấu).
- AD-12 luật client: một composition root (`main.dart`), adapter trên client sinh, chỉ transport chạm mạng/dio, không fake ở đường production. AD-2/AD-16: client không tính tiền — mọi tổng/đợt/hoá đơn là số backend trả qua `MoneyText`/`formatVnd`; `.toInt()` là đổi kiểu, không phải phép tính. AD-3: upload qua backend. AD-4/UX-DR-22: gating là UX.
- Khuôn 10.7: `transport.call` là ranh giới gỡ `DioException`; lỗi port nominal đổi ở **một chỗ mỗi adapter**; `push` màn con / `go` đổi tab; pop-then-push thay `pushReplacement`; `InheritedWidget` (không BLoC — project-context ghi BLoC nhưng không áp ở Epic 10).
- Luật ngôn ngữ: code/comment/tên test tiếng Anh; chỉ chuỗi UI tiếng Việt.

### Hiện trạng phải giữ

- 608 test mobile (đặc biệt `transport_test.dart`, `no_network_outside_transport_test.dart`, `generated_client_drift_test.dart`, `pns_app_test.dart` bàn phím/logout bấm đôi/restore, `signed_in_app_test.dart` Menu/khách/bảo hành, 274 test màn đơn/kho/tiền/chứng từ — đổi fixture, không xoá ca).
- Guard design-system: `money/money-render-guard.test.mjs` + `money-fields` (đừng viết chữ "đồng" trong mô tả số không phải tiền — memory `money-fields-dong-matches-hop-dong`), `components/shell-parity.test.mjs` (5 tab, literal khung), `session/parity.test.mjs` (bảng file đôi), `screens/*.test.mjs` (nhãn byte-identical), `permissions/permission-keys.test.mjs` (ghost key — `AppPermissionKeys`), guard Viền nét (0 `BoxShadow`/`elevation`).
- `app_session_gating_example.dart` + `kMenuSections` demo giữ nguyên. `kMobileMenu` không thêm mục orders/inventory (tab không phải mục Menu).
- Backend, web, `openapi.json` không đổi. `lib/api/generated/**` chỉ đổi 2 model của bẫy 1.

### Tình huống biên đã tính

- Đơn ngoài phạm vi `orders.view_own` mở bằng deep path ⇒ backend 404 ⇒ `OrderPortException.code == 'NOT_FOUND'` ⇒ màn "không tìm thấy" (có sẵn từ 5.4).
- Id rác (`/orders/abc`) ⇒ 400 "Mã định danh không hợp lệ." (`UUID_PARAM` 10.5) hiện nguyên văn.
- Mạng rớt sau khi server commit thanh toán ⇒ màn giữ khoá ⇒ bấm lại cùng khoá ⇒ server replay (`autoTransition` null) — adapter không sinh khoá mới.
- Ảnh không đuôi/mime lạ ⇒ gửi không `contentType` ⇒ backend 400 `files[i]` nguyên văn; 11 ảnh ⇒ 400 `files` "Tối đa 10 ảnh…" (backend kiểm, client không chặn trước).
- 401 giữa upload/tải ⇒ refresh một lần + phát lại (FormData clone / stream body đọc lại).
- Hoá đơn tải trước khi xuất ⇒ 404 envelope ⇒ `InvoicesPortError(404)` — màn đã có nhánh.
- `issueStock` 200 (replay) vs 201 — cả hai thành công.
- Enum backend thêm giá trị mới ⇒ `$unknown` ⇒ nhãn trung tính, không crash.
- Tab Kho cho account chỉ `quotes.create_edit`: mở `InventoryScreen`, không nút Phiếu kho (màn tự gate), `/inventory/vouchers` ⇒ landing.
- Account không quyền đơn và không quyền kho: tab 1/3/FAB bấm không làm gì; landing `/menu`.
- Đăng xuất từ màn con sâu (`/orders/:id/payments`) ⇒ về Đăng nhập (sessionExpired/onLogout 10.7 giữ).

### Kiểm thử — luật dự án áp dụng trực tiếp

- Màn mobile đổi hành vi ⇒ widget test (memory `mobile-screens-need-widget-tests`); fixture bật mọi điều kiện bao ngoài nút (memory `widget-test-gate-unreachable-outer-condition`).
- Source-guard mới/sửa ⇒ chống-rỗng + tự kiểm dương khớp **lời gọi thật** (memory `guard-positive-selfcheck-matches-signature`); mutate thứ được bảo vệ, đòi ĐỎ (memory `source-guards-mutate-for-false-pass`).
- Mutant phải biên dịch (memory `mutation-must-compile-or-false-red`); backup `cp`, KHÔNG `git checkout` (memory `mutation-test-never-git-checkout`); vòng mutant gọi lệnh qua hàm/array, in dòng tổng `+N -M` mỗi mutant (memory `zsh-command-var-no-word-split-mutation`); mutant tương đương ngữ nghĩa trong fixture = sống sót giả — kiểm trước (memory `mutation-semantically-equivalent-false-survivor`).
- Đếm request bằng số lần HTTP giả nhận (memory `publish-count-unasserted-duplicate-survives`).
- Fixture số/ngày: chạy hàm thật in ra chuỗi người dùng thấy (memory `handpicked-fixture-numbers-hide-formula-bugs`); số tiền trong fixture là số backend giả lập — adapter test chỉ assert map, không assert "đúng nghiệp vụ".
- Widget test với Dio: vòng `tester.pump(10ms)` (10.6), `pumpAndSettle` sau điều hướng, đọc route bằng `GoRouter.state.uri` (10.7 Debug Log).
- `dart format` chỉ file mình tạo, kiểm `-o none` (memory `dart-format-writes-files-cascade`; repo không sạch format sẵn).
- Hook scout-block chặn chữ `build`/`dist`/`node_modules` trong lệnh Bash — dùng script Write tool cho APK; `npm run start:prod`.
- Emulator: cold boot `-no-snapshot`; adb install treo ⇒ tắt verifier tạm rồi bật lại (memory `emulator-snapshot-boot-hangs-adb-install`).

### Previous Story Intelligence

- **10.7** (`4c0e4b6`): khuôn adapter `HttpCustomersPort` (`_call` + `fieldErrorMap`, message ĐẦU mỗi field — web + mobile thống nhất ở review); `test/api/support/{api_stack,fake_http}.dart`, `test/app/support/app_harness.dart` dùng lại; `test/support/dart_source.dart` lexer dùng chung cho guard; review: logout xoá phiên cục bộ trước, refresh theo thế hệ phiên, danh sách tải lại sau form (bẫy 5 ở đây là cùng bệnh), pop-then-push, back Quên mật khẩu. `HttpCatalogPort` có code + test, chưa dựng ⇒ dựng ở 10.8.
- **10.5** (`14bf39e`): bảng ánh xạ một chiều + `web-contract-types.mjs`; review H-1 (test lỗi phủ mọi method), H-2/M-3 (reader alias chặt — mobile `mobileAliasDto` đòi `^typedef X = …;$` đúng một DTO), M-1 (đọc thân class đúng một lần); smoke: thiếu `delivery.confirm` ⇒ nút chuyển trạng thái ẩn; MinIO 9200; `canShare` headless (web only).
- **10.6** (`47761e7`): spec dẫn xuất `buildMobileSpec` (binary → `Stream<Uint8List>`) — bẫy 1 mở rộng đúng chỗ này; `source_helper` ghim 1.3.13; drift-guard chạy lại script (~16s).

### Git intelligence

- Commit gần nhất: `78a2a2c` (docs 10.9), `0f72d22` (applicationId `com.twops.solar`), `23cac5e`, `4c0e4b6` (10.7), `47761e7` (10.6). Mỗi story MỘT commit `feat(story-10.8): …` tiếng Anh gồm story file + sprint-status + docs G-5; `git add` đường dẫn cụ thể; `pubspec.lock` track (story không thêm dependency — `image_picker`/`share_plus` đã có); `.git/info/exclude` loại mọi `.gitignore` (memory) ⇒ `git check-ignore` file mới. KHÔNG push.

### Latest tech notes (đo 2026-10-22)

- Không thêm/nâng dependency. `go_router 17.2.3` (khoá, bản cuối cho Dart 3.9); `dio ^5.11.1`: `MultipartFile.fromBytes(bytes, filename:, contentType: DioMediaType.parse('image/jpeg'))`, `FormData.clone()` chỉ clone được part từ byte; `retrofit` sinh `@Part List<MultipartFile>` + `FormData` + `contentType: 'multipart/form-data'` (đã đọc `orders_client.g.dart:590-628`); `@DioResponseType(stream)` ⇒ `Stream<Uint8List>` qua `asyncExpand` — request chạy khi lắng nghe; `image_picker` `XFile.mimeType` thường null trên Android; `share_plus ^10.1.4` `Share.shareXFiles` (đã bọc trong `platformShareXFiles`).
- `swagger_parser 1.45.0`: `format: date` ⇒ `DateTime`, `number` ⇒ `num`, enum inline ⇒ enum riêng + `$unknown`, enum không tên ⇒ `Enum0`; `toJson` ghi mọi key (kể cả null).

### Project Structure Notes

- Ranh giới như 10.7: `design_system/` (trình bày + interface port + fake), `api/` (transport + adapter + helper body/byte), `app/` (route, ráp màn, `AppPorts`), `main.dart` (composition root). Song song web: `lib/api/http_*_port.dart` ↔ `web/src/api/http-*-port.ts`; `app_routes.dart` ↔ `routes.ts`; `kMobileTabLinks` ↔ mục `orders`/`inventory` của `SIDEBAR_NAV`.
- Lệch có chủ đích so với web (ghi G-5): (1) lỗi nominal ⇒ đổi sang lớp lỗi port ở adapter; (2) tab khoá cứng ⇒ thiếu quyền là bấm không làm gì, không ẩn; (3) tên file tải từ metadata (web đọc `Content-Disposition`) ⇒ contracts/invoices thêm 1 GET; (4) body thưa (web: openapi-fetch không thêm key vắng); (5) `amount` vắng bị chặn ở adapter (web gửi để server từ chối) vì DTO Dart bắt buộc field; (6) callback `Future` + tải lại (web unmount).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. Tab Đơn hàng/Kho/FAB với account thiếu quyền: bấm không làm gì (mặc định — tab khoá cứng). Muốn hiện thông báo "Không có quyền" thì quyết — trái UX-DR-22 "không xám/không lộn xộn".
2. `amount` vắng bị adapter chặn (0 request) thay vì để server trả 400 như web — cùng câu lỗi, khác nơi chặn. Muốn đúng tuyệt đối "server quyết" thì cần đổi `RecordPaymentRequestDto` sinh (spec dẫn xuất) — mặc định: không.
3. Tên file PDF hợp đồng/hoá đơn tốn thêm 1 GET metadata mỗi lần chia sẻ. Thay thế: đọc `Content-Disposition` bằng cách để spec dẫn xuất trả `HttpResponse` — phức tạp hơn, mặc định: không.
4. Không có lối mở lại màn soạn báo giá cho đơn `baogia` đã lưu (như web 10.5 câu hỏi 1) — ngoài phạm vi.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 10 — Story 10.5 (tinh chỉnh), 10.6 (tinh chỉnh — spec dẫn xuất), 10.7 (tinh chỉnh + chốt review), 10.8]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §4.2 bảng đổi tên, §6.6, §6.8, §6.18, §6.19, §6.20, §6.21, §6.22]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-2, AD-3, AD-4, AD-5, AD-9, AD-12 (Luật client), AD-16, AD-17]
- [Source: `_bmad-output/project-context.md` §Testing (Mobile 10.6/10.7), §Critical Don't-Miss (tiền, Epic 7)]
- [Source: `_bmad-output/implementation-artifacts/10-5-web-adapter-don-kho-tien-chung-tu-va-nut-chi-tiet-don-theo-quyen.md` §4 D2–D10, Review]
- [Source: `_bmad-output/implementation-artifacts/10-7-mobile-dieu-huong-va-adapter-danh-muc-khach-tai-khoan.md` §3–§7, Review 1–7]
- [Source: `mobile/lib/api/transport.dart:82-188` (call, FormData clone, `_readBody` stream); `mobile/tool/generate_api.dart:24-75` (`buildMobileSpec`)]
- [Source: `mobile/lib/api/generated/orders/orders_client.dart:139-215`, `orders_client.g.dart:218-219,590-628,836-864`, `models/{enum0,update_order_request_dto,update_line_item_request_dto,record_payment_request_dto,installment_input_dto}.g.dart`]
- [Source: `backend/src/payments/dto/record-payment-request.dto.ts:40-60`, `backend/src/orders/dto/{update-order-request,update-line-item-request}.dto.ts`, `backend/src/orders/domain/attachment-limits.ts:26-31,95-125`, `backend/src/payments/domain/payment-schedule.ts:112`, `backend/src/orders/orders.controller.ts:797,829,1264`]
- [Source: `mobile/lib/design_system/session/{orders,inventory,stock_vouchers,payments,contracts,invoices}_port.dart` + fake; `mobile/lib/screens/{orders,inventory,payments,contracts,invoices}/*.dart`; `mobile/lib/design_system/components/{image_upload,share_button}.dart`]
- [Source: `mobile/lib/app/{app_routes,signed_in_app,pns_app}.dart`, `mobile/lib/main.dart`, `mobile/test/app/{composition_root,signed_in_app}_test.dart`]
- [Source: `design-system/lib/{web-mobile-contract-map,mobile-contract-types}.mjs`, `design-system/session/parity.test.mjs`, `design-system/components/menu-nav-parity.test.mjs`, `design-system/screens/*.test.mjs`]
- [Source: `web/src/api/http-*-port.ts`, `web/src/app/{routes.ts,AppRoutes.tsx:166-315}`]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- **T1 spec dẫn xuất:** `buildMobileSpec` bỏ `format: date` (đếm `dateRewrites`, `main()` dừng nếu < 2). Regen: `git diff lib/api/generated` chỉ 4 file — `payment_response_dto{,.g}.dart`, `record_payment_request_dto{,.g}.dart` (`DateTime paidOn` → `String paidOn`, toJson gửi chuỗi thô). Test "undo" đổi sang so sâu (key `format` trả lại nằm cuối map). `openapi.json` không đổi byte.
- **T2 lỗi câm khi đổi sang type sinh:** so enum với chuỗi vẫn biên dịch nhưng luôn sai — 17 chỗ bắt bằng lint `unrelated_type_equality_checks`/`collection_methods_unrelated_type` (vd `_canRecord && i.status != 'paid'` luôn true, `s.status == kStockCheckShort` luôn false, `_kMethodLabels[p.method]` luôn null) ⇒ so `.json`. `${version.createdAt}` của `DateTime` in `2026-07-18 00:00:00.000Z` (khác chuỗi ISO cũ) ⇒ `.toUtc().toIso8601String()`; có test fixture `DateTime.utc` + JSON `…Z` parse thật. Test `expect(x.type, 'nhap')` đỏ với enum ⇒ `.json`.
- **T2 design-system:** trước 504 ⇒ sau 501 (−4 test của file map xoá, +1 `mobileDtoSource`) ⇒ 502 sau T5 (+1 ca parity tab). Không assert nào bị xoá ngoài file map; đổi `mobileField/mobileMethod` thành tên contract, field mobile đọc từ model sinh (`mobileAliasDto` + `mobileDtoSource`/`mobileDtoFields`), regex `MoneyText(x.y)` ⇒ `MoneyText(x.y.toInt())` (đổi kiểu, không phải số học). `stock-issue.test.mjs` bắt oan port mobile vì đường import `models/qty_change_dto.dart` khớp `/qty` ⇒ bỏ chỉ thị import/export khỏi text quét (pattern cấm giữ nguyên) + tự kiểm: mã sau import vẫn bị quét.
- **T3 bẫy mới (story chưa ghi):** backend `IsOptionalNotNull` ⇒ gửi `null` là 400 cho cờ phạm vi, `vatMode`, `qty`, `unitPrice`, `productId`, `discountAmount`; phiếu **xuất** phải vắng `unitCost` (`create-stock-voucher-request.dto.ts:44-60`). Vì vậy `sparse_bodies.dart` phủ thêm add-line, preview-total, create-stock-voucher (ngoài 2 PATCH của story). Smoke tạo phiếu xuất PK-X-10355 thành công.
- **T3/T4 mime:** dio 5.9 `MultipartFile` đã tự suy content type theo tên file (`multipart_file.dart:36-39`, gói `mime`) ⇒ bỏ bảng đuôi→mime dự kiến ở adapter (trùng); adapter chỉ truyền `XFile.mimeType` (cần khi content URI không đuôi). `XFile.fromData(name:)` trên IO bỏ qua `name` (lấy từ path) ⇒ test dùng `path:` như ảnh thật từ image_picker.
- **Mutation (cp backup, mutant phải biên dịch, in dòng tổng):** adapter M1 DTO trần PATCH đơn ĐỎ (+22 −1), M1b PATCH dòng ĐỎ, M1c phiếu kho ĐỎ (+4 −1), M2 bỏ contentType ĐỎ, M3 part từ stream ĐỎ (phát lại), M4 tự sinh khoá ĐỎ, M5 `amount ?? 0` ĐỎ, M6a/b tên file luôn fallback ĐỎ, M7a bỏ tải PDF / M7b đổi thứ tự / M7c tải trước export ĐỎ, M8a vouchers ném ApiError / M8b invoices lộ ApiError / M8c transition bỏ `_call` / M8d nuốt message / M8e bỏ code ĐỎ, M9 bỏ đổi format date ĐỎ. Hai mutant đầu tiên viết hỏng biên dịch (M5, M7a) và một mutant tương đương (M8b) — viết lại, không tính. Router R1–R15 ĐỎ; R10/R11 (tab/FAB bỏ gate) ban đầu SỐNG vì redirect về landing trùng vị trí — sửa test bấm từ màn khác landing ⇒ ĐỎ. D10a/b/c ĐỎ (guard đọc text, không biên dịch lib). Parity tab: hẹp `requiresAny` inventory mobile ⇒ ĐỎ. Share `fileNames` S1/S2 ĐỎ.
- **Smoke phát hiện:** chooser chia sẻ HĐ hiện tên UUID — `XFile.fromData(name:)` không giữ tên trên Android ⇒ `AppShareFn` thêm `fileNames` → `fileNameOverrides` (3 màn quote/HĐ/hoá đơn); chạy lại: `hop-dong-thi-cong-620.pdf`, `hoa-don-HD-2026-1573.pdf`.

### Completion Notes List

- 6 adapter HTTP mobile (`http_{orders,inventory,stock_vouchers,payments,contracts,invoices}_port.dart`) trên client sinh, mọi lời gọi qua `transport.call`, lỗi đổi ở một `_call` mỗi adapter; `sparse_bodies.dart`, `bytes.dart` (`collectBytes`), `Transport.uploadPart` (byte part).
- 6 port: 55 `typedef` type sinh + method/field tiếng Anh; giữ tay có comment: `UpdateOrderLineInput`, `UpdateScopeFlagsInput`, `UpdateOrderMetaInput`, `RecordPaymentInput`, `QuoteExportFile(s)`, `ContractPdfFile`, `InvoicePdfFile`, `StockVoucherFieldError`, `FieldError`, 5 lớp lỗi. Fake viết lại theo type sinh; `AppAttachmentItem` đổi prop `uploadedBy/canDelete` như web; helper riêng `_themAnh/_anhBytes/_xoaAnh` đổi tên để grep AC-8 rỗng. `$unknown` ⇒ `—` cho trạng thái đơn (danh sách), `stockStatus`, trạng thái đợt thanh toán.
- Router: `kMobileTabLinks`, route đơn/kho + `subRoutePermission`, landing `/orders`, tab 1/3/FAB, `AppPorts`, `main.dart` 12 adapter; `OrderListScreen.onOpenDiscountApprovals`, "+ Tạo đơn" theo `onAdd`; callback `Future` + tải lại ở chi tiết đơn, danh sách đơn, Tồn kho; FAB ⇒ danh sách dựng lại (`_ordersEpoch` + `router.refresh()`).
- Test mới: 6 file adapter + `http_port_errors_test.dart` (42 method, đối chiếu interface) + `sparse_bodies_test.dart` + `order_routes_test.dart` (12 ca AC-11) + ca `$unknown`/ngày; ca 10.7 đổi theo hành vi mới (landing, tab Đơn hàng nối thật), không xoá ca.
- **Smoke emulator (AC-14) — ĐÃ CHẠY** trên `pns-postgres` 5433 (trống sau `test:db` ⇒ seed SQL: 2 account argon2id mật khẩu ngẫu nhiên, 2 sản phẩm UUID + tồn), backend `npm run start:prod` với `JWT_ACCESS_SECRET` ngẫu nhiên 64 hex, `DATABASE_URL` 5433, `R2_*` → MinIO riêng `pns-minio-smoke` :9200 bucket `smoke-10-8`, `PUPPETEER_EXECUTABLE_PATH` Chrome hệ thống — tất cả trên lệnh, không đọc/sửa `.env`; AVD `Pixel_9_Pro` cold boot `-no-snapshot`, APK debug `API_BASE_URL=http://10.0.2.2:3000`; `adb input` + `uiautomator dump` + `screencap`.
  - (i) A đăng nhập ⇒ vào thẳng **Đơn hàng** (không có "Duyệt chiết khấu" — A thiếu `discounts.approve`).
  - (ii) FAB Tạo ⇒ tra `0900 000 108` ⇒ "SĐT chưa có" ⇒ tạo khách "Khach Smoke 108" ⇒ thêm 2 dòng danh mục (2 dòng vào DB qua add-line thưa), tổng backend 20.950.000 / VAT 1.676.000 / 22.626.000 đ ⇒ "Chia sẻ báo giá" ⇒ chooser "Sharing 2 files" (ảnh báo giá render thật; `quote_exports` file `bao-gia-0c61a852`) ⇒ Chốt ⇒ chi tiết đơn **Đã chốt** với Thanh toán/Hợp đồng/Hoá đơn.
  - (iii) Thanh toán: cấu hình lịch 20/70/10 (tổng lịch = tổng đơn) ⇒ ghi đợt 1 4.525.200 đ ⇒ `payments` = 1, `paid_on` `2026-10-22`, banner "Đơn đã chuyển sang Đã cọc."; retry cùng khoá bằng `curl` (token phiên curl) ⇒ HTTP 200, `autoTransition: null`, `payments` vẫn 1; back ⇒ chi tiết hiện **Đã cọc** (tải lại).
  - (iv) Hợp đồng: Xuất PDF ⇒ `HĐTC-620/2026` ⇒ chooser; lần đầu tên UUID (lỗi trên — sửa, APK mới) ⇒ `hop-dong-thi-cong-620.pdf`.
  - (v) Hoá đơn: tạo `HD-2026-1573` ⇒ Xem ⇒ Xuất PDF ⇒ chooser `hoa-don-HD-2026-1573.pdf`.
  - (vi) Chuyển trạng thái "Đang giao" kèm 1 ảnh chọn từ thư viện emulator (Photo picker) ⇒ `orders.status` = `danggiao`, `attachments` +1 (`image/jpeg`, 46281 B, `dacoc → danggiao`); về chi tiết hiện Đang giao; tab Ảnh hiện ảnh (byte qua Bearer).
  - (vii) Kho: Tồn kho 2 sản phẩm (Khả dụng trừ phần đã hứa) ⇒ Phiếu kho mở; thêm: tạo phiếu **xuất** 1 tấm ⇒ PK-X-10355 (body không `unitCost`).
  - (viii) B (`orders.view_own` + `quotes.create_edit`, đơn gán B bằng SQL): landing Đơn hàng, chi tiết đơn **chỉ** "Thanh toán"; FAB mở form tra cứu khách.
  - Ngoài kịch bản: mở lại app sau cài lại ⇒ khôi phục phiên, vào thẳng Đơn hàng. Phiên curl kiểm đăng nhập: 2 phiên thêm của A.
  - Dọn: 1 transaction SQL theo thứ tự FK ⇒ accounts/orders/customers/products/payments/attachments/vouchers/sessions = 0; `audit_logs` append-only để lại 38 dòng; `docker rm -f pns-minio-smoke`; gỡ app + xoá ảnh đẩy lên; verifier AVD vốn 0/0 (từ 10.7) giữ nguyên; tắt emulator + backend (cổng 3000 trống); xoá file mật khẩu/secret tạm. Không dùng `kidy-dev-*`, không gọi dịch vụ ngoài localhost.
- **5 lane:** mobile `flutter analyze` sạch + `flutter test` **733** (608 → 733, không xoá ca); design-system **502** (504 − 4 file map + 1 + 1); web typecheck + **439** + bundle; backend `npm test` **2504** (121 suite) + `test:db` **322** (26 suite); `openapi.json` không đổi byte.
- Lệch có chủ đích so với story: bỏ bảng mime ở adapter (dio tự suy); `sparse_bodies` phủ thêm 3 body; `AppShareFn.fileNames`; `subRoutePermission` là hàm (đường `/orders/:id/…` không biểu diễn được bằng tiền tố); Tồn kho cũng tải lại sau Phiếu kho (cùng bệnh bẫy 5); `stockStatus` `$unknown` mobile ⇒ `—` (web vẫn "Đủ").
- Ngoài phạm vi, chỉ ghi nhận: commit 10.7 `4c0e4b6` có 4 file backup `bk-*.dart` ở gốc repo (rác mutation) — không đụng.

### File List

- `_bmad-output/implementation-artifacts/10-8-mobile-adapter-don-kho-tien-chung-tu-va-nut-chi-tiet-don-theo-quyen.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/project-context.md`
- `design-system/components/menu-nav-parity.test.mjs`
- `design-system/lib/mobile-contract-types.mjs`
- `design-system/lib/mobile-contract-types.test.mjs`
- `design-system/lib/web-mobile-contract-map.mjs` (xoá)
- `design-system/lib/web-mobile-contract-map.test.mjs` (xoá)
- `design-system/screens/contracts.test.mjs`
- `design-system/screens/inventory.test.mjs`
- `design-system/screens/invoices.test.mjs`
- `design-system/screens/order-attachments.test.mjs`
- `design-system/screens/order-cancel.test.mjs`
- `design-system/screens/order-detail.test.mjs`
- `design-system/screens/order-transition.test.mjs`
- `design-system/screens/orders.test.mjs`
- `design-system/screens/payment-schedule.test.mjs`
- `design-system/screens/quote-stock-check.test.mjs`
- `design-system/screens/stock-issue.test.mjs`
- `design-system/session/parity.test.mjs`
- `mobile/tool/generate_api.dart`
- `mobile/lib/api/generated/models/payment_response_dto.dart`
- `mobile/lib/api/generated/models/payment_response_dto.g.dart`
- `mobile/lib/api/generated/models/record_payment_request_dto.dart`
- `mobile/lib/api/generated/models/record_payment_request_dto.g.dart`
- `mobile/lib/api/bytes.dart` (mới)
- `mobile/lib/api/sparse_bodies.dart` (mới)
- `mobile/lib/api/http_orders_port.dart` (mới)
- `mobile/lib/api/http_inventory_port.dart` (mới)
- `mobile/lib/api/http_stock_vouchers_port.dart` (mới)
- `mobile/lib/api/http_payments_port.dart` (mới)
- `mobile/lib/api/http_contracts_port.dart` (mới)
- `mobile/lib/api/http_invoices_port.dart` (mới)
- `mobile/lib/api/transport.dart`
- `mobile/lib/app/app_ports.dart` (mới)
- `mobile/lib/app/app_routes.dart`
- `mobile/lib/app/pns_app.dart`
- `mobile/lib/app/signed_in_app.dart`
- `mobile/lib/main.dart`
- `mobile/lib/design_system/components/attachment_gallery.dart`
- `mobile/lib/design_system/components/share_button.dart`
- `mobile/lib/design_system/shell/app_menu_nav.dart`
- `mobile/lib/design_system/session/orders_port.dart`
- `mobile/lib/design_system/session/inventory_port.dart`
- `mobile/lib/design_system/session/stock_vouchers_port.dart`
- `mobile/lib/design_system/session/payments_port.dart`
- `mobile/lib/design_system/session/contracts_port.dart`
- `mobile/lib/design_system/session/invoices_port.dart`
- `mobile/lib/design_system/session/fake_orders_port.dart`
- `mobile/lib/design_system/session/fake_inventory_port.dart`
- `mobile/lib/design_system/session/fake_stock_vouchers_port.dart`
- `mobile/lib/design_system/session/fake_payments_port.dart`
- `mobile/lib/design_system/session/fake_contracts_port.dart`
- `mobile/lib/design_system/session/fake_invoices_port.dart`
- `mobile/lib/screens/contracts/contracts_screen.dart`
- `mobile/lib/screens/inventory/inventory_screen.dart`
- `mobile/lib/screens/inventory/stock_vouchers_screen.dart`
- `mobile/lib/screens/invoices/invoice_detail_screen.dart`
- `mobile/lib/screens/invoices/invoices_screen.dart`
- `mobile/lib/screens/orders/create_quote_screen.dart`
- `mobile/lib/screens/orders/discount_approval_screen.dart`
- `mobile/lib/screens/orders/order_detail_screen.dart`
- `mobile/lib/screens/orders/order_list_screen.dart`
- `mobile/lib/screens/orders/order_status_change_screen.dart`
- `mobile/lib/screens/payments/payment_schedule_screen.dart`
- `mobile/test/api/build_mobile_spec_test.dart`
- `mobile/test/api/sparse_bodies_test.dart` (mới)
- `mobile/test/api/http_orders_port_test.dart` (mới)
- `mobile/test/api/http_inventory_port_test.dart` (mới)
- `mobile/test/api/http_stock_vouchers_port_test.dart` (mới)
- `mobile/test/api/http_payments_port_test.dart` (mới)
- `mobile/test/api/http_contracts_port_test.dart` (mới)
- `mobile/test/api/http_invoices_port_test.dart` (mới)
- `mobile/test/api/http_port_errors_test.dart` (mới)
- `mobile/test/api/support/contract_json.dart` (mới)
- `mobile/test/api/support/fake_http.dart`
- `mobile/test/app/order_routes_test.dart` (mới)
- `mobile/test/app/app_routes_test.dart`
- `mobile/test/app/composition_root_test.dart`
- `mobile/test/app/pns_app_test.dart`
- `mobile/test/app/signed_in_app_test.dart`
- `mobile/test/app/support/app_harness.dart`
- `mobile/test/design_system/components/behavior_interaction_test.dart`
- `mobile/test/screens/contracts/contracts_screen_test.dart`
- `mobile/test/screens/inventory/inventory_screen_test.dart`
- `mobile/test/screens/inventory/stock_vouchers_screen_test.dart`
- `mobile/test/screens/invoices/invoice_detail_screen_test.dart`
- `mobile/test/screens/invoices/invoices_screen_test.dart`
- `mobile/test/screens/orders/create_quote_screen_test.dart`
- `mobile/test/screens/orders/discount_approval_screen_test.dart`
- `mobile/test/screens/orders/order_detail_attachments_test.dart`
- `mobile/test/screens/orders/order_detail_cancel_test.dart`
- `mobile/test/screens/orders/order_detail_long_status_test.dart`
- `mobile/test/screens/orders/order_detail_screen_test.dart`
- `mobile/test/screens/orders/order_list_screen_test.dart`
- `mobile/test/screens/orders/order_status_change_screen_test.dart`
- `mobile/test/screens/orders/order_stock_issue_test.dart`
- `mobile/test/screens/orders/quote_stock_check_test.dart`
- `mobile/test/screens/payments/payment_schedule_screen_test.dart`

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI, `/ck:code-review` + 2 reviewer chỉ-đọc) · 2026-10-22 · **Kết quả: Approve sau khi sửa** — 0 CRITICAL, 0 HIGH; 4 MEDIUM + 6 LOW, sửa 9, bác 1 có lý do.

Phạm vi: diff chưa commit (mobile + design-system); backend/web **không đổi byte** (`git diff HEAD -- backend web` rỗng) ⇒ luật scope/FOR UPDATE/lane DB không áp. Task [x] và AC 1–16 đối chiếu code: đủ. File List khớp `git status` (ngoài `.githooks/`, 2 file `docs/*.xlsx` không thuộc story).

**MEDIUM (đã sửa)**
- **M1** Bấm tab Đơn hàng/Kho từ màn con có ghi ⇒ danh sách/Tồn kho hiện dữ liệu cũ: `go` bỏ các route đã push mà không hoàn tất future ⇒ `_openThenReload` không chạy. Sửa: `SignedInApp` giữ `ValueNotifier` `_ordersReload`/`_inventoryReload`, `_selectTab` báo trước khi `go`; `OrderListScreen`/`InventoryScreen` thêm `reloadSignal` (`Listenable`).
- **M2** Chốt báo giá ⇒ đơn mới mở ⇒ đổi trạng thái ⇒ back ⇒ danh sách không đọc lại (future của `push(orderPath)` bị bỏ). Sửa: `.then(_reloadOrders)`. Lúc sửa lộ thêm: cách cũ `_ordersEpoch` + `router.refresh()` gọi khi pop đang lắng **áp lại vị trí cũ** (`/orders/o2`) ⇒ back không về danh sách ⇒ bỏ hẳn, dùng chung `reloadSignal` (cả FAB).
- **M3 (test)** Test "401 phát lại" của tải PDF HĐ/hoá đơn chỉ phát lại lời gọi metadata (401 rơi vào GET đầu). Sửa: `renewingOnce(onlyPath:)` + assert PDF gọi 2 lần.
- **M4 (test)** Ánh xạ lỗi của 2 bước tải ảnh/PDF trong `exportQuote` không có test (409 đều rơi ở export). Sửa: 2 ca 404 envelope ở bước ảnh / bước PDF ⇒ `OrderPortException` đúng `code`/`message`.

**LOW (đã sửa)**
- **L1** `contractType` lạ ⇒ hiện "HĐ Mua bán" ⇒ nay `—`.
- **L2** Loại phiếu kho lạ ⇒ chip "Xuất", dấu `−`, ghi chú xuất ⇒ nay chip `—` (màu `muted`), số không dấu, không ghi chú (giữ literal `'+'`/`'−'` cho guard).
- **L4** `vatMode` lạ ⇒ preview-total gửi lại giá trị lạ (400) ⇒ nay bỏ field.
- **L5** Quay về chi tiết đơn nháy skeleton, reload lỗi xoá dữ liệu đang hiện ⇒ nay đọc lại im lặng, lỗi thì giữ (khuôn `InvoicesScreen`).
- **L6** `/orders/new/` (dấu `/` cuối) so khớp chính xác ⇒ có thể rơi quyền con ⇒ `subRoutePermission` đọc theo segment.
- **L7 (test)** `addAttachments` thiếu ca `image/jpeg` khi picker không có mime + 401 phát lại đủ part ⇒ đã thêm.

**Bác (có lý do)**
- **L3** Nút "Ghi nhận" với trạng thái đợt lạ: guard `design-system/screens/payment-schedule.test.mjs:135` ghim biểu thức byte-identical web (`!= 'paid'`); sửa một phía làm lệch web (web ngoài phạm vi); backend kiểm `recordable` + từ chối ghi sai.

**Mutation (cp backup, không git checkout, mutant biên dịch):** bỏ `_call` bước ảnh/PDF `exportQuote` ĐỎ ×2; bỏ báo tab orders/kho ĐỎ ×2; bỏ reload đơn mới ĐỎ; chi tiết reload có skeleton ĐỎ; gate con so khớp chính xác ĐỎ; nhãn HĐ đoán "Mua bán" ĐỎ; chip/dấu/ghi chú phiếu đoán hướng ĐỎ ×3; echo `vatMode` lạ ĐỎ. Tạo stream tải PDF ngoài `_call` SỐNG — **mutant tương đương**: phát lại 401 do interceptor `Transport._onError` gọi `dio.fetch(options)` bên trong, không gọi lại closure.

**Lane sau sửa:** mobile `flutter analyze` sạch + `flutter test` **746** (baseline đo lại trước review 735 — Debug Log ghi 733; +11 ca review); design-system **502**; backend/web không đổi so với lần chạy của dev (không chạy lại).

**Ghi chú:** reviewer test tự ghi 2 file memory riêng của agent vào `mobile/.claude/agent-memory/code-reviewer/` (untracked, không thuộc story — không add).

## Change Log

- 2026-10-22 — Story 10.8 dev: 6 adapter mobile (đơn, kho, phiếu kho, thanh toán, hợp đồng, hoá đơn) trên client sinh + body thưa + upload byte part + gom byte tải; spec dẫn xuất bỏ `format: date` (`paidOn` String); 6 port sang type sinh + method/field tiếng Anh, fake/màn/test đổi theo; route đơn/kho, tab Đơn hàng/Kho/FAB gate bằng `kMobileTabLinks`, landing `/orders`, 3 nút chi tiết đơn theo quyền, màn dưới tải lại sau màn con có ghi; `AppPorts` + composition root 12 adapter; xoá bảng map design-system; tên file chia sẻ qua `fileNameOverrides`; smoke emulator 8 bước; G-5 epics.md + project-context.
- 2026-10-22 — Code review: tab Đơn hàng/Kho và đơn mới sau báo giá báo danh sách/Tồn kho đọc lại qua `reloadSignal` (bỏ `router.refresh()`); chi tiết đơn đọc lại im lặng; gate route con theo segment; enum lạ (loại HĐ, loại phiếu, `vatMode`) trung tính; test 401 phát lại đúng lời tải PDF, lỗi tải `exportQuote`, `addAttachments`; story → done.
