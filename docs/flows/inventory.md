# Tồn kho, giữ hàng và phiếu kho

> Flow `inventory`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow inventory` in ra đúng danh sách đó.

## Mục đích

Theo dõi hàng trong kho theo từng sản phẩm bằng hai con số độc lập (FR-25, AD-19): **Tồn thật**
(`onHand`, chỉ phiếu kho làm nó đổi) và **Đã hứa** (`reserved`, hàng giữ cho đơn đã chốt).
**Khả dụng** = `onHand − reserved` (có thể âm) là con số sale dùng để hứa với khách; phần âm thành
"Cần nhập" và danh sách cần mua. Flow này phục vụ:

- **Thủ kho** (`inventory.manage`): xem tồn, lập phiếu nhập/xuất tự do, xuất kho theo đơn, lập
  phiếu nhập trả khi đơn đã xuất bị huỷ.
- **Sale** (`quotes.create_edit`): xem Khả dụng và cảnh báo thiếu hàng sớm ngay trên màn báo giá.
- **Người giao hàng** (`delivery.confirm`): xem trước phiếu xuất mà bước "Đã giao" sẽ tạo.

Giữ hàng xảy ra khi chốt đơn và **không bao giờ chặn** chốt đơn vì thiếu hàng; chặn thiếu hàng chỉ
nằm ở khâu xuất kho. Huỷ đơn giải phóng phần giữ qua event, không tự cộng lại `onHand`.

Phần đơn hàng (tạo/sửa/chốt/mở lại/chuyển trạng thái) thuộc flow `orders`; trang này chỉ tả phần
tồn kho trong `orders.controller.ts` / `orders.service.ts` và các port đơn ở web/mobile.

## Điểm vào

HTTP (mọi route cần JWT; quyền do `PermissionsGuard` toàn cục kiểm qua decorator):

- `GET /stock-items` — `StockItemsController.lietKe`, `@RequireAnyPermissions(inventory.manage, quotes.create_edit)`.
  Query `q` (tên/SKU), `productIds` (CSV hoặc lặp tham số, từng phần tử phải là UUID).
- `POST /stock-vouchers` — `StockVouchersController.create`, `inventory.manage`. Phiếu nhập/xuất tự do.
- `POST /stock-vouchers/:id/return` — `StockVouchersController.createReturn`, `inventory.manage`. Phiếu nhập trả.
- `GET /stock-vouchers` — `StockVouchersController.lietKe`, `inventory.manage`. Lọc `type=nhap|xuat`, `isReturn=true|false`; tối đa 100 phiếu, không phân trang.
- `GET /stock-vouchers/:id` — `StockVouchersController.chiTiet`, `inventory.manage`.
- `GET /orders/:id/stock-issue` — `OrdersController.getStockIssue`, `@RequireAnyPermissions(inventory.manage, delivery.confirm)`. Xem trước phiếu xuất theo đơn.
- `POST /orders/:id/stock-issue` — `OrdersController.issueStock`, `inventory.manage`. Xuất kho theo đơn, không đổi trạng thái; 201 khi vừa tạo phiếu, 200 khi đơn đã xuất rồi.
- `GET /orders/:id/stock-check` — `OrdersController.getStockCheck`, `@RequireAnyPermissions(quotes.create_edit, inventory.manage)`. Cảnh báo tồn sớm cho màn báo giá.
- Gián tiếp qua flow `orders`: `POST /orders/:id/chot` (giữ hàng), `POST /orders/:id/mo-lai`
  (chặn mở lại đơn đã xuất), `POST /orders/:id/chuyen-trang-thai` (bước "Đã giao" xuất kho; đóng
  `hoanthanh` giải phóng phần còn giữ), `POST /orders/:id/huy` (phát `OrderCancelled`).

Event: `OrderCancelledStockSubscriber` nghe `OrderCancelled` trên `EventBus`.

Màn hình (chưa nối vào app thật: web chưa có router/port HTTP, `web/src/main.tsx` chỉ là shell demo
auth; mobile chưa có `main.dart`; mọi màn chạy trên fake port):

- Web: `InventoryScreen` (Tồn kho), `StockVouchersScreen` (Phiếu kho); khối `StockIssuePreview` trong
  `OrderStatusChangeScreen` (bước "Đã giao") và `OrderDetailScreen` ("Phiếu xuất"); cảnh báo tồn trong
  `CreateQuoteScreen`.
- Mobile: `InventoryScreen`, `StockVouchersScreen`; `StockIssuePreview` trong
  `order_status_change_screen.dart` và `order_detail_screen.dart`; cảnh báo tồn trong `create_quote_screen.dart`.

## Các bước

**A. Đọc tồn (Tồn kho)**

1. `backend/src/inventory/stock-items.controller.ts` → `StockItemsController.lietKe`: nhận `StockListQueryDto`, gọi service.
2. `backend/src/inventory/stock-items.service.ts` → `StockItemsService.lietKeTonKho`: một `$transaction([...])` dạng mảng `RepeatableRead` gồm `product.findMany` (include `stockItem`) và `stockMovement.groupBy` `_sum.qty` theo `stockItemId` — `onHand` và `reserved` cùng một ảnh chụp, không N+1. Tập sản phẩm = (theo dõi tồn VÀ đang bán) HOẶC còn dòng tồn khác 0. `q` được escape `%`/`_` (`thoatLike`) trước `contains`.
3. `backend/src/inventory/domain/ton-kho.ts` → `tinhTonKho`: tính `khaDung`, `canNhap`, `tinhTrang` (`du`/`het`/`am`); service ghép `danhSachCanMua` (sắp theo `canNhap` giảm dần).

**B. Phiếu nhập/xuất tự do**

1. `backend/src/inventory/stock-vouchers.controller.ts` → `StockVouchersController.create`: validate `CreateStockVoucherRequestDto` (nhập bắt buộc `unitCost`, xuất cấm `unitCost`, không lặp sản phẩm), gọi `taoPhieu`, rồi che giá vốn bằng `anGiaVonDongPhieu` nếu thiếu `costs.view` (resolve tươi qua `AccountPermissionsService`).
2. `backend/src/inventory/stock-vouchers.service.ts` → `StockVouchersService.taoPhieu`: tx interactive; lệnh đầu là `SELECT id FROM products WHERE id = ANY(…) ORDER BY id FOR UPDATE`; sản phẩm thiếu ⇒ 404.
3. Cùng hàm: xuất ⇒ `insufficientStockError` so `qty` với `onHand` đọc SAU khoá (`issueShortfall`), thiếu ⇒ ném `InsufficientStockException` (409, `INSUFFICIENT_STOCK` theo `lines.{i}.qty`); nhập ⇒ sản phẩm phải `tracksStock && isActive`, không thì 409 `PRODUCT_NOT_STOCKABLE`.
4. Cùng hàm: mỗi dòng `stockItem.upsert` `onHand` mới (dòng tồn sinh lười); phiếu nhập cập nhật `Product.costPrice` theo `tinhGiaVonBinhQuan` (`domain/gia-von.ts`), phiếu xuất giữ nguyên giá vốn và lấy `unitCost` = giá vốn hiện hành; tạo `StockVoucher` + `StockVoucherLine`.
5. Sau commit publish `StockVoucherCreated`; nếu bị từ chối vì thiếu tồn thì publish `StockOutBlocked` SAU rollback rồi ném lại lỗi.

**C. Giữ hàng khi chốt / mở lại đơn**

1. `backend/src/orders/orders.service.ts` → `OrdersService.confirm`: trong cùng tx chốt (đã khoá dòng `orders`), sau khi ghi snapshot giá gọi `StockVouchersService.reserveForOrderInTx`.
2. `backend/src/inventory/stock-vouchers.service.ts` → `reserveForOrderInTx`: đọc ledger của đơn, tìm version cũ còn giữ (`SUM > 0`); khoá `products` (gồm cả sản phẩm chỉ còn ở phần giữ cũ); ghi dòng `release` âm đúng bằng phần còn giữ; rồi ghi một dòng `reserve` dương cho mỗi sản phẩm của `stockIssueLines` (bỏ qua nếu `(orderVersionId, stockItemId, 'reserve')` đã có — idempotent). Không kiểm, không chặn thiếu hàng, không chạm `onHand`.
3. `backend/src/orders/orders.service.ts` → `OrdersService.revise`: mở lại KHÔNG chạm ledger (phần giữ của version cũ vẫn hiệu lực tới lần chốt lại); nếu version hiện tại đã có phiếu xuất ⇒ 409 `REVISE_AFTER_ISSUE_MESSAGE`.

**D. Cảnh báo tồn trên báo giá**

1. `backend/src/orders/orders.controller.ts` → `OrdersController.getStockCheck` → `OrdersService.getStockCheck`: `findScopedOrThrow` trước (ngoài phạm vi ⇒ 404); version hiện tại đã xuất ⇒ `lines: []`; ngược lại đọc dòng đơn có `productId`.
2. `backend/src/inventory/stock-items.service.ts` → `StockItemsService.checkOrderLines`: một tx mảng `RepeatableRead` đọc `onHand`, tổng ledger và phần của CHÍNH đơn này; `reserved` = tổng − phần của đơn; gộp dòng theo `stockIssueLines`; `quoteStockLine` (`domain/stock-shortfall.ts`) cho `available`, `shortfall`, `status` (`enough`/`short`). Chỉ cảnh báo, không chặn Chốt.

**E. Xuất kho theo đơn**

1. `backend/src/orders/orders.controller.ts` → `OrdersController.getStockIssue` → `OrdersService.getStockIssue`: đã xuất ⇒ trả `voucher`; chưa ⇒ `StockVouchersService.previewOrderIssue` (đọc thường, không khoá) trả dòng + `onHand` + `shortfall`; backend tính `canIssue` (trạng thái thuộc `STOCK_ISSUE_STATUSES` = `dachot`, `dacoc`, `danggiao`, `thicong`, `nghiemthu`, có dòng theo dõi tồn, có `inventory.manage`), `blocked`, `untrackedItems`.
2. `OrdersController.issueStock` → `OrdersService.issueStock`: scope → `assertStockIssuable` → tx [`lockOrderRow` (khoá `orders`) → đọc lại + kiểm lại trạng thái → `issueStockIfNeeded`] → publish `StockIssued` SAU commit. Đơn đã xuất ⇒ trả phiếu cũ, không ghi, `created: false` (200).
3. `OrdersService.issueStockIfNeeded` (private, dùng chung cho đường xuất riêng và bước "Đã giao" trong `chuyenTrangThaiThuCong`): đã có phiếu cho `(orderId, orderVersionId)` ⇒ trả về; gọi `StockVouchersService.issueForOrderInTx`; kiểm `inventory.manage` DƯỚI khoá (thiếu ⇒ 403); đóng băng `costPriceSnapshot` của MỌI dòng version hiện tại bằng `lineCostSnapshot` (dòng theo dõi tồn = `unitCost` phiếu xuất, AD-20).
4. `backend/src/inventory/stock-vouchers.service.ts` → `issueForOrderInTx`: chạy trong tx của `orders/` (không mở tx, không publish); khoá `products ORDER BY id FOR UPDATE`; `stockIssueLines`; thiếu tồn ⇒ `InsufficientStockException`; trừ `onHand`; ghi dòng ledger `xuat` âm bằng đúng phần đơn đang giữ (`aggregate` theo đơn + sản phẩm, không theo `qty` xuất); tạo phiếu `xuat` gắn `orderId`/`orderVersionId`; trả `costByProduct` và event `StockIssued` dựng sẵn.
5. Bị từ chối vì thiếu tồn (đường riêng hoặc "Đã giao") ⇒ tx rollback (cả chuyển trạng thái và ảnh), `OrdersService.publishIfStockOutBlocked` publish `StockOutBlocked` đúng một lần rồi ném lại lỗi.
6. Đóng đơn `dachot → hoanthanh` và `nghiemthu → hoanthanh`: `applyTransition` gọi `assertNoUnissuedStockInTx` (còn dòng theo dõi tồn chưa xuất ⇒ 409 `STOCK_NOT_ISSUED_MESSAGE`); vào `hoanthanh` thì `releaseHeldForOrderInTx` giải phóng phần còn giữ trong cùng tx.

**F. Huỷ đơn và phiếu nhập trả**

1. `backend/src/orders/orders.service.ts` → `OrdersService.huyDon`: không chạm tồn kho; publish `StatusChanged` rồi `OrderCancelled` sau commit.
2. `backend/src/inventory/order-cancelled-stock.subscriber.ts` → `OrderCancelledStockSubscriber.handle`: khớp `event.type === 'OrderCancelled'` và `target.type === 'Order'` (không import class từ `orders/`), gọi `releaseForCancelledOrder`; lỗi thì log kèm `orderId` rồi ném lại.
3. `backend/src/inventory/stock-vouchers.service.ts` → `releaseForCancelledOrder`: tx riêng, khoá `orders` trước, đọc lại trạng thái — không phải `huy` thì bỏ qua; `releaseHeldForOrderInTx` ghi `release` âm cho mọi `(version, item)` còn giữ (mọi version, không lọc `tracksStock`). Idempotent; không đụng `onHand`.
4. `StockVouchersController.createReturn` → `StockVouchersService.createReturnVoucher`: đọc phiếu gốc (phải là `xuat` gắn đơn, đơn đã `huy`, chưa có phiếu trả); khoá `products` của phiếu gốc rồi kiểm lại; dòng chỉ được là sản phẩm có trên phiếu gốc (`NOT_ON_ORIGIN_VOUCHER`) và không quá số đã xuất (`RETURN_EXCEEDS_ISSUED`); cộng `onHand` đúng số đếm được, `unitCost` = giá vốn dòng phiếu gốc, giá vốn bình quân dịch như mọi phiếu nhập; không ghi ledger, không ghi bảng đơn; publish `StockVoucherCreated` (có `returnOfVoucherId`, `orderId`). Mã phiếu `PK-NT-xxxx` (`maPhieu`).

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| Không có cột `reserved` ở bất kỳ model nào; `reserved = SUM(StockMovement.qty)` theo `stockItemId` | `StockItemsService` (`groupBy _sum`), schema | `backend/test/inventory-read-only.spec.ts` (a); `stock-items.db.integration.spec.ts` (SUM thật) |
| Ledger `stock_movements` chỉ thêm, không sửa/xoá: giải phóng = thêm dòng `release`/`xuat` âm | `stock-vouchers.service.ts` chỉ gọi `stockMovement.create` | `stock-reservation.db.integration.spec.ts` ("old rows never updated"), `stock-cancel-return.db.integration.spec.ts` (append-only); không có source-guard riêng cấm `update`/`delete` |
| Dấu của `qty` cố định theo loại: `reserve > 0`, `release`/`xuat < 0` | CHECK `stock_movements_qty_sign`, `STOCK_MOVEMENT_TYPE` | `stock-reservation.db.integration.spec.ts` |
| Một version giữ một sản phẩm đúng một lần | unique `(order_version_id, stock_item_id, type)` + skip trong `reserveForOrderInTx` | `stock-reservation.spec.ts`, `stock-reservation.db.integration.spec.ts` (confirm song song ⇒ 1 dòng) |
| Thứ tự khoá toàn hệ thống: `orders … FOR UPDATE` trước, rồi MỘT câu `products … ORDER BY id FOR UPDATE` (khoá `products`, không khoá `stock_items`) | `lockOrderRow`, mọi hàm ghi tồn trong `StockVouchersService` | `stock-vouchers.service.spec.ts`, `stock-reservation.spec.ts`, `stock-cancel-release.spec.ts`, `order-stock-issue.spec.ts` (thứ tự op); lane DB ép interleaving ở `stock-vouchers`, `stock-reservation`, `order-stock-issue`, `stock-cancel-return`, `stock-out-blocked` `.db.integration.spec.ts`. Xem [Khoá dòng & test đồng thời](../../backend/CONVENTIONS.md) |
| Ghi tồn chỉ ở `stock-vouchers.service.ts`, dưới `FOR UPDATE` + `$transaction(async`, qua `tx`; `stock-items.service.ts` chỉ đọc (ngoại lệ hẹp: tx mảng `RepeatableRead`); `inventory/` không ghi bảng đơn | cấu trúc module | `backend/test/inventory-read-only.spec.ts` (b), (c) |
| Không chặn thiếu hàng khi chốt; chỉ chặn ở xuất kho, với số `onHand` đọc DƯỚI khoá | `reserveForOrderInTx` không kiểm; `insufficientStockError` trong `taoPhieu`/`issueForOrderInTx` | `stock-reservation.db.integration.spec.ts` ("short stock does NOT block"), `stock-out-blocked.db.integration.spec.ts` (ca FORCED đọc dưới khoá) |
| Mỗi lần xuất bị chặn ⇒ đúng một `StockOutBlocked`, publish SAU rollback; không ghi gì | `taoPhieu`, `publishIfStockOutBlocked` | `order-stock-issue.spec.ts`, `stock-vouchers.service.spec.ts`, `stock-out-blocked.db.integration.spec.ts` |
| `onHand >= 0`; dòng phiếu `qty > 0`, `unit_cost >= 0` | CHECK `stock_items_on_hand_non_negative`, `stock_voucher_lines_*` | `stock-vouchers.db.integration.spec.ts` |
| Một đơn, một phiếu xuất cho mỗi version; xuất lại là no-op (NFR-1) | unique `(order_id, order_version_id)`, `findOrderIssueVoucher` dưới khoá `orders` | `order-stock-issue.spec.ts`, `order-stock-issue.db.integration.spec.ts` (hai lần xuất song song ⇒ 1 phiếu) |
| Phiếu gắn đơn chỉ là `xuat`; phiếu trả là `nhap` không mang cặp đơn; mỗi phiếu xuất có tối đa một phiếu trả | CHECK `stock_vouchers_order_pair`, `stock_vouchers_order_only_xuat`, `stock_vouchers_return_is_stock_in`, unique `return_of_voucher_id` | `order-stock-issue.db.integration.spec.ts`, `stock-cancel-return.db.integration.spec.ts` |
| Stock + giá vốn dòng đơn + trạng thái đơn commit cùng nhau; giá vốn đóng băng lúc XUẤT, không lúc Chốt | tx thuộc `OrdersService`; `issueForOrderInTx` không mở tx | `order-stock-issue.db.integration.spec.ts`, `order-stock-issue.spec.ts` |
| Đường huỷ (`huyDon`) không chạm tồn; giải phóng chỉ qua `OrderCancelled`; huỷ không tự cộng `onHand` | `OrderCancelledStockSubscriber`, `releaseForCancelledOrder` | `backend/test/no-stock-write-in-cancel.spec.ts`, `stock-cancel-release.spec.ts`, `stock-cancel-return.db.integration.spec.ts` |
| Mở lại không giải phóng; chốt lại giải phóng version cũ đúng phần còn giữ (kể cả sản phẩm đã thôi theo dõi tồn) | `revise`, `reserveForOrderInTx` | `stock-reservation.spec.ts`, `stock-reservation.db.integration.spec.ts` |
| Cảnh báo báo giá không tính phần giữ của chính đơn; đơn đã xuất ⇒ không cảnh báo | `checkOrderLines`, `getStockCheck` | `order-stock-check.spec.ts`, `stock-out-blocked.db.integration.spec.ts` |
| Giá vốn che theo `costs.view`: thiếu quyền ⇒ key `unitCost` vắng hẳn (kể cả response của lệnh tạo); GHI giá nhập không cần `costs.view` | `anGiaVonDongPhieu` ở controller | `stock-vouchers.e2e.spec.ts`, `order-stock-issue.e2e.spec.ts` |
| Client không tính số tồn nào (AD-2): không trừ/so `onHand`, `reserved`, `qty`… | màn web/mobile chỉ render số backend | `design-system/screens/{inventory,stock-vouchers,stock-issue,quote-stock-check}.test.mjs` (regex `STOCK_PAIR` trong `design-system/lib/stock-figures.mjs`) |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/inventory/stock-items.controller.ts` | Route đọc tồn | `StockItemsController.lietKe` |
| `backend/src/inventory/stock-vouchers.controller.ts` | Route phiếu kho, che giá vốn | `StockVouchersController.create`, `createReturn`, `lietKe`, `chiTiet` |
| `backend/src/inventory/inventory.module.ts` | Module; export hai service cho `orders/` | `InventoryModule` |
| `backend/src/inventory/stock-items.service.ts` | Đường đọc tồn + cảnh báo báo giá | `StockItemsService.lietKeTonKho`, `checkOrderLines` |
| `backend/src/inventory/stock-vouchers.service.ts` | Đường ghi tồn duy nhất | `StockVouchersService.taoPhieu`, `issueForOrderInTx`, `reserveForOrderInTx`, `createReturnVoucher`, `releaseForCancelledOrder`, `releaseHeldForOrderInTx`, `lockTrackedProductsInTx`, `findOrderIssueVoucher`, `previewOrderIssue`, `lietKePhieu`, `chiTietPhieu` |
| `backend/src/inventory/order-cancelled-stock.subscriber.ts` | Giải phóng phần giữ khi đơn huỷ | `OrderCancelledStockSubscriber.handle` |
| `backend/src/inventory/insufficient-stock.exception.ts` | Lỗi 409 thiếu tồn mang dòng bị chặn | `InsufficientStockException`, `INSUFFICIENT_STOCK_MESSAGE` |
| `backend/src/inventory/domain/ton-kho.ts` | Nơi duy nhất tính Khả dụng | `tinhTonKho`, `TINH_TRANG_TON` |
| `backend/src/inventory/domain/stock-shortfall.ts` | Nơi duy nhất so số lượng với tồn | `issueShortfall`, `quoteStockLine` |
| `backend/src/inventory/domain/stock-issue-lines.ts` | Dòng phiếu xuất theo đơn (gộp theo sản phẩm, thứ tự chuẩn) | `stockIssueLines` |
| `backend/src/inventory/domain/gia-von.ts` | Giá vốn bình quân, mã phiếu, mã lỗi dòng | `tinhGiaVonBinhQuan`, `maPhieu`, `LOAI_PHIEU`, `INSUFFICIENT_STOCK`, `PRODUCT_NOT_STOCKABLE`, `DUPLICATE_PRODUCT`, `NOT_ON_ORIGIN_VOUCHER`, `RETURN_EXCEEDS_ISSUED` |
| `backend/src/inventory/domain/stock-movement-type.ts` | Loại dòng ledger | `STOCK_MOVEMENT_TYPE` |
| `backend/src/inventory/domain/stock-voucher-visibility.ts` | Che `unitCost` theo quyền | `anGiaVonDongPhieu` |
| `backend/src/inventory/domain/stock-voucher-events.ts` | Event phiếu tự do / phiếu trả | `StockVoucherCreated` |
| `backend/src/inventory/domain/stock-issued-event.ts` | Event xuất kho theo đơn | `StockIssued` |
| `backend/src/inventory/domain/stock-out-blocked-event.ts` | Event xuất bị chặn | `StockOutBlocked` |
| `backend/src/inventory/dto/create-stock-voucher-request.dto.ts` | Body phiếu nhập/xuất | `CreateStockVoucherRequestDto`, `StockVoucherLineRequestDto`, `QTY_TOI_DA`, `DON_GIA_TOI_DA` |
| `backend/src/inventory/dto/create-return-voucher-request.dto.ts` | Body phiếu nhập trả | `CreateReturnVoucherRequestDto`, `ReturnVoucherLineRequestDto` |
| `backend/src/inventory/dto/stock-list-query.dto.ts`, `backend/src/inventory/dto/stock-voucher-list-query.dto.ts` | Query đọc tồn / danh sách phiếu | `StockListQueryDto`, `StockVoucherListQueryDto` |
| `backend/src/inventory/dto/stock-list-response.dto.ts` | Response tồn | `StockListResponseDto`, `StockItemViewDto`, `CanMuaViewDto` |
| `backend/src/inventory/dto/stock-voucher-response.dto.ts` | Response phiếu | `StockVoucherDetailDto`, `StockVoucherSummaryDto`, `StockVoucherListResponseDto`, `StockVoucherLineResponseDto`, `StockVoucherReturnOfDto`, `StockVoucherReturnRefDto` |
| `backend/src/orders/orders.controller.ts` (phần tồn) | Route tồn theo đơn | `OrdersController.getStockIssue`, `getStockCheck`, `issueStock` |
| `backend/src/orders/orders.service.ts` (phần tồn) | Chủ tx xuất theo đơn, giữ hàng khi chốt | `OrdersService.issueStock`, `getStockIssue`, `getStockCheck`, `issueStockIfNeeded`, `publishIfStockOutBlocked`, `assertNoUnissuedStockInTx`, `confirm`, `revise`, `huyDon`, `STOCK_ISSUE_STATUSES` |
| `backend/src/orders/dto/order-stock-issue-response.dto.ts` | Response xem trước / kết quả xuất | `OrderStockIssueViewDto`, `OrderStockIssueLineDto`, `OrderStockIssueResultDto` |
| `backend/src/orders/dto/order-stock-check-response.dto.ts` | Response cảnh báo báo giá | `OrderStockCheckDto`, `OrderStockCheckLineDto` |
| `backend/prisma/migrations/20261021080000_add_stock_items_and_movements/migration.sql` | Bảng `stock_items`, `stock_movements` | — |
| `backend/prisma/migrations/20261021090000_add_stock_vouchers/migration.sql` | Bảng phiếu + dòng, CHECK `on_hand >= 0`, `qty > 0`, `unit_cost >= 0` | — |
| `backend/prisma/migrations/20261021100000_add_stock_voucher_order_link/migration.sql` | Cột `order_id`/`order_version_id`, unique một đơn một phiếu, CHECK cặp đơn + chỉ `xuat` | — |
| `backend/prisma/migrations/20261021110000_add_stock_movement_reservation_keys/migration.sql` | Unique `(order_version_id, stock_item_id, type)`, CHECK `stock_movements_qty_sign` | — |
| `backend/prisma/migrations/20261021120000_add_stock_voucher_return_link/migration.sql` | Cột `return_of_voucher_id` (unique, FK), CHECK `stock_vouchers_return_is_stock_in` | — |
| `web/src/screens/inventory/InventoryScreen.tsx` | Màn Tồn kho web (chỉ đọc) | `InventoryScreen` |
| `web/src/screens/inventory/StockVouchersScreen.tsx` | Màn Phiếu kho web: danh sách, chi tiết, form tạo, phiếu nhập trả | `StockVouchersScreen` |
| `web/src/screens/inventory/format-gio.ts` | Hiển thị giờ UTC+7 cố định | `ngayNgan`, `ngayGio` |
| `web/src/screens/inventory/inventory.css`, `web/src/screens/inventory/stock-vouchers.css` | Style hai màn kho | — |
| `web/src/screens/orders/stock-issue-preview.tsx` | Khối xem trước phiếu xuất (dùng ở "Đã giao" và chi tiết đơn) | `StockIssuePreview`, `rowErrors` |
| `web/src/screens/orders/stock-issue.css` | Style khối xem trước | — |
| `web/src/design-system/session/inventory-port.ts` | Port `GET /stock-items` | `InventoryPort.listStock`, `StockItemView`, `StockList` |
| `web/src/design-system/session/stock-vouchers-port.ts` | Port phiếu kho | `StockVouchersPort` (`listVouchers`, `getVoucher`, `createVoucher`, `createReturnVoucher`) |
| `web/src/design-system/session/orders-port.ts` (phần tồn) | Port tồn theo đơn | `OrdersPort.getStockIssue`, `issueStock`, `getStockCheck`, `OrderStockIssueView`, `OrderStockCheck` |
| `web/src/design-system/session/fake-inventory-port.ts`, `web/src/design-system/session/fake-stock-vouchers-port.ts` | Fake port + dữ liệu demo | `FakeInventoryPort`, `DEMO_STOCK_LIST`, `FakeStockVouchersPort`, `DEMO_STOCK_VOUCHERS` |
| `mobile/lib/screens/inventory/inventory_screen.dart` | Màn Tồn kho mobile | `InventoryScreen` |
| `mobile/lib/screens/inventory/stock_vouchers_screen.dart` | Màn Phiếu kho mobile (form + sheet nhập trả) | `StockVouchersScreen`, `ngayNgan`, `ngayGio` |
| `mobile/lib/screens/orders/stock_issue_preview.dart` | Khối xem trước phiếu xuất mobile | `StockIssuePreview`, `rowErrors` |
| `mobile/lib/design_system/session/inventory_port.dart`, `mobile/lib/design_system/session/stock_vouchers_port.dart` | Port mobile | `InventoryPort`, `StockVouchersPort`, `StockVoucherPortException` |
| `mobile/lib/design_system/session/orders_port.dart` (phần tồn) | Port tồn theo đơn mobile | `OrdersPort.getStockIssue`, `issueStock`, `getStockCheck` |
| `mobile/lib/design_system/session/fake_inventory_port.dart`, `mobile/lib/design_system/session/fake_stock_vouchers_port.dart` | Fake port mobile | `FakeInventoryPort`, `FakeStockVouchersPort` |
| `design-system/lib/stock-figures.mjs` | Regex dùng chung cho guard "client không tính số tồn" | `STOCK_PAIR` |

## Dữ liệu

- Bảng ghi: `stock_items` (`on_hand`, một dòng/sản phẩm, sinh lười bằng `upsert`), `stock_movements`
  (ledger giữ hàng: `reserve`/`release`/`xuat`), `stock_vouchers` (phiếu `nhap`/`xuat`, `seq` SERIAL cho mã
  `PK-N-`/`PK-X-`/`PK-NT-`, liên kết đơn và phiếu trả), `stock_voucher_lines`; `products.cost_price` (giá vốn
  bình quân, chỉ phiếu nhập/nhập trả đổi); `order_line_items.cost_price_snapshot` (ghi bởi `OrdersService`
  lúc xuất).
- Bảng đọc / khoá: `products` (khoá `FOR UPDATE`, đọc `tracksStock`, `isActive`), `orders` (khoá
  `FOR UPDATE`, đọc trạng thái), `order_versions`, `order_line_items`, `accounts` (người tạo phiếu).
- Sự kiện phát: `StockVoucherCreated` (phiếu tự do, phiếu nhập trả), `StockIssued` (xuất theo đơn — không
  kèm `StockVoucherCreated`), `StockOutBlocked` (xuất bị chặn, `target` = đơn nếu có). Tất cả publish sau
  commit/rollback (AD-18); `AuditSubscriber` ghi `audit_logs`.
- Sự kiện nghe: `OrderCancelled` (do `OrdersService.huyDon` phát) → `OrderCancelledStockSubscriber`.
- Gọi ngoài: không có.

## Flow liên quan

- orders: chủ của đơn, version, dòng đơn, trạng thái; mở tx cho xuất theo đơn và giữ hàng khi chốt, gọi primitive `...InTx` của `inventory/` (chiều phụ thuộc một chiều `orders → inventory`).
- catalog: `Product` (`tracksStock`, `isActive`, `costPrice`); phiếu nhập là nơi duy nhất gõ giá vốn.
- domain-events-audit: `EventBus`, `AuditSubscriber` ghi audit cho ba event tồn kho; `OrderCancelled` là đường nối huỷ đơn ↔ giải phóng.
- accounts-permissions: key `inventory.manage`, `costs.view`, `quotes.create_edit`, `delivery.confirm`; `AccountPermissionsService` resolve `costs.view` mỗi request.
- auth-session: JWT, `PermissionsGuard`, `@RequirePermissions` / `@RequireAnyPermissions`.
- backend-platform: `PrismaService`, error envelope (`AppException`, `ErrorCode`), `ValidationPipe`.
- design-system: component, shell, gating (`can`, `filterNav`, `PERM`) cho màn kho; text-guard trong `design-system/screens/`.

## Tests

Backend, hermetic (chạy trong `npm test`):

- `backend/test/ton-kho.spec.ts`, `backend/test/stock-shortfall.spec.ts`, `backend/test/stock-issue-lines.spec.ts`, `backend/test/gia-von.spec.ts`: domain thuần — Khả dụng/`tinhTrang`, biên `qty === onHand`, gộp dòng + thứ tự chuẩn, giá vốn bình quân làm tròn một điểm và mã phiếu.
- `backend/test/stock-items.service.spec.ts`: không N+1, không lệnh ghi, luật tập sản phẩm/sắp xếp, hai lệnh đọc chung một tx `RepeatableRead`.
- `backend/test/stock-vouchers.service.spec.ts`: khoá `products` là op đầu tiên, lỗi nghiệp vụ không ghi gì, phiếu xuất không đổi giá vốn, event đúng một lần sau commit (mock chạy thân tx rồi mới ném).
- `backend/test/stock-reservation.spec.ts`: `reserveForOrderInTx` — thứ tự op, giải phóng đúng phần version cũ giữ, chọn dòng theo `stockIssueLines`, skip idempotent, không mở tx/publish/đụng `onHand`.
- `backend/test/stock-cancel-release.spec.ts`: giải phóng khi huỷ/hoàn thành — khoá `orders` trước, đọc lại trạng thái, giải phóng mọi version, nhánh no-op.
- `backend/test/stock-return-voucher.spec.ts`: `createReturnVoucher` — kiểm lại sau khoá, giá vốn lấy từ dòng phiếu gốc, mọi từ chối không ghi/không publish, không ghi ledger.
- `backend/test/order-stock-issue.spec.ts`: phần xuất kho của `OrdersService` — thứ tự op, khoá `orders` trước primitive, giá vốn dòng ghi sau primitive, mỗi event đúng một lần, `StockOutBlocked` sau rollback.
- `backend/test/order-stock-check.spec.ts`: `getStockCheck` — scope là op đầu, chỉ đưa dòng có sản phẩm của version hiện tại, chỉ đọc.
- `backend/test/stock-items.e2e.spec.ts`, `backend/test/stock-vouchers.e2e.spec.ts`, `backend/test/order-stock-issue.e2e.spec.ts`, `backend/test/order-stock-check.e2e.spec.ts`: tầng HTTP với JWT thật và Prisma override — gate theo preset thật, `ParseUUIDPipe`/`ValidationPipe`, 201/200/409 + `fieldErrors`, che `unitCost` khi thiếu `costs.view`, phạm vi đơn (404), đúng một dòng audit `StockIssued`.

Backend, lane DB (`*.db.integration.spec.ts`, tự skip khi không có `DATABASE_URL`; chạy `npm run test:db`):

- `backend/test/stock-items.db.integration.spec.ts`: `SUM` có dấu theo đúng `stockItemId`, sản phẩm chưa có dòng tồn ra 0/0, lọc `insensitive`, unique `product_id`, FK RESTRICT.
- `backend/test/stock-vouchers.db.integration.spec.ts`: khoá `products` thật sự nối đuôi hai đường ghi, bind `= ANY(${ids})`, rollback cả phiếu, CHECK `on_hand >= 0`, `seq` SERIAL.
- `backend/test/stock-reservation.db.integration.spec.ts`: giữ hàng khi chốt, chốt song song ⇒ một bộ dòng, chốt lại giải phóng version cũ (append-only), không chặn thiếu hàng, unique + CHECK dấu, ép interleaving trên khoá `products` (cả sản phẩm chỉ còn ở phần giữ cũ).
- `backend/test/order-stock-issue.db.integration.spec.ts`: stock + phiếu + giá vốn dòng + trạng thái commit cùng nhau, giá vốn lúc xuất, hai lần xuất song song ⇒ một phiếu, không deadlock với phiếu tự do.
- `backend/test/stock-out-blocked.db.integration.spec.ts`: xuất bị chặn (tự do, xuất riêng, "Đã giao") rollback hết và để đúng một dòng audit `StockOutBlocked`, số trên event đọc dưới khoá, chốt không bị chặn, cảnh báo báo giá trừ phần giữ của chính đơn.
- `backend/test/stock-cancel-return.db.integration.spec.ts`: huỷ qua bus thật giải phóng (mọi version, không cộng `onHand`), hoàn thành giải phóng phần còn giữ, phiếu nhập trả (giá vốn gốc, bình quân, một dòng audit), unique/CHECK/FK mới, hai phiếu trả song song ⇒ một phiếu.

Backend, source-guard:

- `backend/test/inventory-read-only.spec.ts`: không model nào có cột `reserved`; chỉ `stock-vouchers.service.ts` được ghi, phải có `FOR UPDATE` + tx interactive và ghi qua `tx`; `inventory/` không ghi bảng đơn.
- `backend/test/no-stock-write-in-cancel.spec.ts`: thân `huyDon()` không nhắc `StockMovement`/`StockItem`/`onHand`/`reserved`.

Design-system (`node --test`, text-guard + parity web/mobile):

- `design-system/screens/inventory.test.mjs`, `design-system/screens/stock-vouchers.test.mjs`, `design-system/screens/stock-issue.test.mjs`, `design-system/screens/quote-stock-check.test.mjs`: client không so/ghép hai số tồn và không nhân tiền (`STOCK_PAIR`, kèm ca "guard không rỗng"), port/fake không mang giá vốn sản phẩm, port tồn không có đường ghi, nhãn giống hệt từng byte giữa web và mobile (UX-DR-27), màu chỉ từ token, nút xác nhận khoá theo `blocked` và lỗi dòng đặt theo `lines.{i}.qty`.

Web (vitest + jsdom):

- `web/src/test/inventory-screen.test.tsx`: loading/error/empty, Thử lại, ô tìm gửi `q`, chống trả lời cũ vẽ đè, khối cần mua, mục "Kho" ở sidebar theo gate OR.
- `web/src/test/stock-vouchers-screen.test.tsx`: chi tiết phiếu (cột giá vốn chỉ khi có field), payload theo loại, lỗi 409 đúng dòng, chống bấm Lưu hai lần, lối vào từ màn Tồn kho theo quyền.
- `web/src/test/order-stock-issue.test.tsx`: bước "Đã giao" hiện bảng xem trước, đơn đã xuất hiện mã phiếu, 409 đặt lỗi dưới đúng dòng, nút "Xuất kho" chống bấm đôi.
- `web/src/test/quote-stock-check.test.tsx`: nhãn từng dòng theo `status`, một câu cảnh báo cho mỗi sản phẩm thiếu, "Chốt" không bị chặn, đọc lỗi chỉ ẩn gợi ý.

Mobile (flutter widget test):

- `mobile/test/screens/inventory/inventory_screen_test.dart`, `mobile/test/screens/inventory/stock_vouchers_screen_test.dart`: mọi trạng thái qua màn thật + port, form Nhập ↔ Xuất bỏ field giá vốn, 409 dưới đúng dòng, tên dài nhất ở 320/360px.
- `mobile/test/screens/orders/order_stock_issue_test.dart`, `mobile/test/screens/orders/quote_stock_check_test.dart`: bản mobile của hai test web tương ứng, fixture bật mọi điều kiện bao ngoài.
