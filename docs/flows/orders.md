# Báo giá và đơn hàng

> Flow `orders`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow orders` in ra đúng danh sách đó.

## Mục đích

Một Đơn (`Order`) là báo giá kiêm đơn đặt hàng, đi từ lúc nhân viên kinh doanh lập giỏ hàng cho khách tới khi đơn hoàn thành hoặc bị huỷ. Flow này lo: tạo đơn và giỏ dòng báo giá, tính tổng tiền (một hàm duy nhất, integer đồng), chốt đơn (đóng băng giá), mở lại để sửa (sinh bản update mới), chiết khấu có người duyệt, chuyển trạng thái theo bảng 10 trạng thái, huỷ đơn có lý do, ảnh đính kèm lên R2, xuất báo giá PDF/ảnh và tra cứu bảo hành theo SĐT. Người dùng gồm kinh doanh (`quotes.create_edit`), người chốt (`orders.confirm`), người duyệt chiết khấu (`discounts.approve`), thi công, giao hàng, kế toán và kho (xem đơn qua `orders.view_all`/`orders.view_own`).

Phần tồn kho trên đơn (kiểm tồn sớm ở màn báo giá, xuất kho theo đơn, giữ chỗ lúc chốt, nhả chỗ lúc huỷ/hoàn thành) nằm chung file `orders.controller.ts`/`orders.service.ts` và các port orders nhưng thuộc flow `inventory` ([inventory.md](inventory.md)). Doc này chỉ nói phía đơn hàng và trỏ sang đó.

Quy ước chung (AD-x, envelope lỗi, đặt tên): [backend/CONVENTIONS.md](../../backend/CONVENTIONS.md), [_bmad-output/project-context.md](../../_bmad-output/project-context.md).

## Điểm vào

HTTP (`OrdersController`, `@Controller('orders')`, mọi route cần JWT). Route tĩnh khai TRƯỚC `:id` có chủ đích (đặt sau thì `:id` nuốt chuỗi và trả 404 giả).

| Method + path | Quyền (decorator) | Handler → service |
|---|---|---|
| `POST /orders` | `quotes.create_edit` | `create` → `OrdersService.create` |
| `POST /orders/preview-total` (200) | `quotes.create_edit` | `previewTotal` → `OrdersService.previewTotal` |
| `GET /orders/cho-duyet-chiet-khau` | `discounts.approve` | `listPendingDiscounts` |
| `GET /orders/tra-cuu-bao-hanh?sdt=` | any `orders.view_all`, `orders.view_own` | `traCuuBaoHanh` |
| `GET /orders` | any `orders.view_all`, `orders.view_own` | `list` |
| `GET /orders/:id` | any `orders.view_*` | `findOne` → `getScoped` |
| `GET /orders/:id/vong-doi` | any `orders.view_*` | `lifecycle` |
| `GET /orders/:id/phien-ban` | any `orders.view_*` | `listVersions` |
| `PATCH /orders/:id` | `quotes.create_edit` | `update` (cờ phạm vi + vatMode/kWp/validityNote) |
| `POST /orders/:id/chot` (200) | `orders.confirm` | `confirm` |
| `POST /orders/:id/mo-lai` (200) | `quotes.create_edit` | `revise` |
| `POST /orders/:id/ap-chiet-khau` (200) | `discounts.apply` | `applyDiscount` |
| `POST /orders/:id/duyet-chiet-khau` (200) | `discounts.approve` | `resolveDiscount` |
| `POST /orders/:id/line-items` | `quotes.create_edit` | `addLine` |
| `PATCH /orders/:id/line-items/:lineId` | `quotes.create_edit` | `updateLine` |
| `DELETE /orders/:id/line-items/:lineId` (204) | `quotes.create_edit` | `removeLine` |
| `POST /orders/:id/xuat-bao-gia` (200) | `quotes.create_edit` | `exportQuote` → `QuoteExportService.exportQuote` |
| `GET /orders/:id/bao-gia/anh`, `GET /orders/:id/bao-gia/pdf` | `quotes.create_edit` | `downloadQuoteImage`/`downloadQuotePdf` → `QuoteExportService.getExportFile` |
| `POST /orders/:id/chuyen-trang-thai` (200, multipart `anh`) | any `construction.transition`, `delivery.confirm`, `payments.record` | `chuyenTrangThai` → `chuyenTrangThaiThuCong` |
| `POST /orders/:id/huy` (200) | `quotes.create_edit` | `huyDon` |
| `GET /orders/:id/anh`, `GET /orders/:id/anh/:attachmentId` | any `orders.view_*` | `listAttachments`/`downloadAttachment` → `danhSachAnh`/`anhDinhKem` |
| `POST /orders/:id/anh` (201, multipart), `DELETE /orders/:id/anh/:attachmentId` (204) | any `quotes.create_edit`, `construction.transition`, `delivery.confirm`, `payments.record` | `addAttachments`/`removeAttachment` → `themAnh`/`xoaAnh` |
| `GET /orders/:id/stock-check`, `GET /orders/:id/stock-issue`, `POST /orders/:id/stock-issue` | xem flow `inventory` | `getStockCheck`/`getStockIssue`/`issueStock` |

Cửa vào nội bộ: `OrdersService.chuyenTrangThaiTuDong()` (export qua `OrdersModule.exports`) cho lane tự động; hiện chưa có caller production (`payments/` của Epic 7 chưa có), chỉ test gọi.

Màn hình (cùng cặp web/mobile, nhãn tiếng Việt giống từng byte):

- Tạo báo giá: `web/src/screens/orders/CreateQuoteScreen.tsx` → `CreateQuoteScreen`; `mobile/lib/screens/orders/create_quote_screen.dart` → `CreateQuoteScreen`.
- Danh sách đơn: `OrdersListScreen.tsx` → `OrdersListScreen`; `order_list_screen.dart` → `OrderListScreen`.
- Chi tiết đơn (tab Thông tin / Lịch sử update / Ảnh, stepper vòng đời, nút Huỷ đơn): `OrderDetailScreen.tsx`, `order_detail_screen.dart` → `OrderDetailScreen`.
- Chuyển trạng thái kèm ảnh: `OrderStatusChangeScreen.tsx`, `order_status_change_screen.dart` → `OrderStatusChangeScreen`.
- Duyệt chiết khấu: `DiscountApprovalScreen.tsx`, `discount_approval_screen.dart` → `DiscountApprovalScreen`.
- Tra cứu bảo hành: `web/src/screens/warranty/WarrantyLookupScreen.tsx`, `mobile/lib/screens/warranty/warranty_lookup_screen.dart` → `WarrantyLookupScreen`.

Các màn orders nối vào app thật qua `HttpOrdersPort` và `HttpWarrantyPort` (web và mobile), được dựng ở composition root (flow `app-shell`); test dùng `FakeOrdersPort` và `FakeWarrantyPort`.

## Các bước

Tạo đơn, giỏ hàng và tổng tạm tính

1. `backend/src/orders/orders.service.ts` → `OrdersService.create`: chuẩn hoá SĐT bằng `normalizeVnPhone` (sai ⇒ 400, chưa có khách ⇒ 404), tạo `Order` (`status = 'baogia'`, `ownerAccountId` = người gọi, `sourceId`/`custType` snapshot từ `Customer`, cờ phạm vi theo `scopePresetFor`, `vatMode = 'co_vat'`) + `OrderVersion` số 1 + gắn `currentVersionId` trong MỘT `$transaction`; publish `OrderCreated` sau commit.
2. `backend/src/orders/orders.service.ts` → `OrdersService.previewTotal`: hàm thuần, không chạm DB, không event. Client gửi lại các dòng backend đã trả + `vatMode` + `discountAmount`; tiền tính bằng `computeOrderTotals`, thuế suất do controller đọc từ `SettingsService.vatRatePercent()`. Chiết khấu vượt subtotal ⇒ 400.
3. `backend/src/orders/orders.service.ts` → `OrdersService.update`: chỉ khi `baogia`; đổi cờ `scopeThiCong`/`scopeVanChuyen` (publish `OrderScopeChanged`) và/hoặc `vatMode`/`kWp`/`validityNote` (publish `OrderMetaChanged`). Body rỗng ⇒ trả view, không ghi.

Dòng hàng

4. `backend/src/orders/orders.service.ts` → `addLine`/`updateLine`/`removeLine`: đọc đơn qua `findScopedOrThrow`, mở tx, `lockOrderRow` rồi `assertMutable` lại trong tx (chỉ `baogia`). Dòng catalog copy `name`/`unit`/`priceEditable`/`warrantyMonths` từ `Product` và lấy giá qua `resolveUnitPrice` (catalog); client chỉ được gửi `unitPrice` khi `priceEditable = true`, ngược lại 400. Dòng tự do nhập tay. Publish `OrderLineAdded`/`OrderLineUpdated`/`OrderLineRemoved`.
5. `backend/src/orders/orders.service.ts` → `toViews`: trước chốt, dòng catalog không sửa giá trả giá SỐNG; sau chốt ưu tiên `unitPriceSnapshot`. `amount` của dòng = `lineAmount()`.

Chốt, mở lại và version

6. `backend/src/orders/orders.service.ts` → `confirm`: từ `baogia`, hoặc từ `choduyet` khi approval mới nhất là `dong_y`. Đơn 0 dòng ⇒ 400; đã `dachot` ⇒ 200 idempotent. Trong một tx: `applyTransition(SU_KIEN.chot)`, đọc lại con trỏ version dưới khoá (đổi ⇒ 409), đọc lại dòng, ghi `unitPriceSnapshot`/`catalogPriceSnapshot` từng dòng, `warrantyStartAt` cho dòng chưa có mốc, ghi `vatRate`/`vatMode`/`chotAt`/`discountAmount` lên `OrderVersion`, rồi giữ chỗ tồn (`reserveForOrderInTx`, xem `inventory`). Publish `OrderConfirmed` rồi `StatusChanged`.
7. `backend/src/orders/orders.service.ts` → `revise`: `dachot → baogia` qua engine; tạo `OrderVersion` `versionNo + 1`, copy toàn bộ dòng (snapshot giá null, giữ `warrantyStartAt`), trỏ `currentVersionId` sang bản mới. Bản cũ không bị sửa. Đơn đang `baogia` ⇒ no-op; đơn đã xuất kho ⇒ từ chối (`REVISE_AFTER_ISSUE_MESSAGE`). Publish `OrderRevised` + `StatusChanged`.
8. `backend/src/orders/orders.service.ts` → `listVersions` + `backend/src/orders/domain/version-diff.ts` → `diffDong`: lịch sử bản update tăng dần, `laBanHienLuc` so với con trỏ, diff dòng thêm/bớt/đổi số lượng (không so giá), không trả tiền.

Chiết khấu và duyệt chiết khấu

9. `backend/src/orders/orders.service.ts` → `applyDiscount`: validate `amount ≤ subtotal` qua `computeOrderTotals`, đơn 0 dòng ⇒ 400; trong tx `applyTransition(SU_KIEN.apChietKhau)` (`baogia → choduyet`) rồi tạo `DiscountApproval` `cho_duyet`. Thua cổng ⇒ 409. Publish `DiscountRequested`.
10. `backend/src/orders/orders.service.ts` → `resolveDiscount`: cổng atomic `updateMany` trên chính dòng approval (`cho_duyet` → `dong_y`/`tu_choi`). Từ chối bắt buộc lý do và đưa đơn về `baogia` qua `applyTransition(SU_KIEN.tuChoiChietKhau)`; đồng ý giữ đơn ở `choduyet` (Chốt là bước riêng). Cùng quyết định lặp lại ⇒ 200, ngược quyết định ⇒ 409. Publish `DiscountResolved`.
11. `backend/src/orders/orders.service.ts` → `listPendingDiscounts`: hàng chờ duyệt, có phạm vi; `estimatedMarginPct` chỉ có khi người gọi có thêm `costs.view` (controller resolve tươi), thiếu ⇒ null hết.

Chuyển trạng thái tay và tự động

12. `backend/src/orders/domain/allowed-transition.ts` → `ALLOWED_TRANSITIONS` + `evaluateTransition`: bảng 17 dòng (sự kiện, from, to, quyền, `scopeGuard` theo cờ Thiết bị/Thi công/Vận chuyển). `buocVongDoi`, `buocKeTiep`, `coTheHuy` dựng dữ liệu cho `GET /:id/vong-doi` để client không tự suy.
13. `backend/src/orders/orders.service.ts` → `applyTransition` (private): evaluate → `lockOrderRow` → (đóng `dachot`/`nghiemthu → hoanthanh` thì kiểm đã xuất kho) → `updateMany` theo status quan sát được → thua thì ném sentinel của caller → `hoanthanh` thì nhả chỗ giữ tồn. Trả `StatusChanged` chưa publish.
14. `backend/src/orders/orders.service.ts` → `chuyenTrangThaiThuCong`: phạm vi → chỉ nhận `SU_KIEN_THU_CONG` (`bat_dau_thi_cong`, `xong_thi_cong`, `bat_dau_giao`, `xong_giao`, `hoan_thanh`) → pre-check `evaluateTransition` → `kiemTraAnh` → upload R2 → tx (engine + `attachment.createMany` với `statusFrom`/`statusTo`/`occurredAt`) → publish. Bấm hai lần ⇒ 409. Bước `xong_giao` xuất kho trong cùng tx (`issueStockIfNeeded`, xem `inventory`).
15. `backend/src/orders/orders.service.ts` → `chuyenTrangThaiTuDong` + `backend/src/orders/domain/auto-transition-map.ts` → `suKienChoMoc`: lane tự động (mốc `coc` ⇒ `du_coc`, `tat_toan` ⇒ `hoan_thanh`); đã ở đích ⇒ no-op im lặng, quyền là của actor thật do caller truyền.

Huỷ đơn

16. `backend/src/orders/orders.service.ts` → `huyDon`: lý do trim ≥ 3 ký tự (DTO ≤ 500), pre-check, tx gồm `applyTransition(SU_KIEN.huy)` + `update` `cancelReason`/`cancelledAt` (không ghi `status`). Huỷ được từ `baogia`, `dachot`, `dacoc`; đã `huy` ⇒ 409. Publish `StatusChanged` rồi `OrderCancelled`; nhả chỗ giữ/phiếu nhập trả do subscriber của `inventory` nghe `OrderCancelled`.

Ảnh đính kèm (R2 qua `StoragePort`)

17. `backend/src/orders/orders.service.ts` → `themAnh`: phạm vi → mảng rỗng ⇒ 400 → `kiemTraAnh` (≤ 10 ảnh, ≤ 10 MB, mime jpeg/png/webp/heic) → `storage.putObject` key `attachments/{orderId}/{id}.{ext}` (đuôi suy từ mime) → `attachment.createMany` với ba cột toạ độ null → publish `AttachmentAdded`. Multer ở controller đặt trần gấp đôi (`TRAN_CUNG_SO_ANH`, `TRAN_CUNG_KICH_THUOC_BYTE`) để lỗi người dùng thật về tới domain và nhận 400.
18. `backend/src/orders/orders.service.ts` → `danhSachAnh`/`anhDinhKem`/`xoaAnh`: đọc qua backend (bucket không public, `objectKey` không vào DTO); xoá được khi là người tải lên hoặc có `quotes.create_edit` (`xoaDuocAnh`); xoá DB trước, publish `AttachmentRemoved`, rồi xoá R2 (lỗi R2 chỉ log).

Xuất báo giá

19. `backend/src/orders/quote-export.service.ts` → `QuoteExportService.exportQuote`: `getScoped` (phạm vi + giá snapshot-first), 0 dòng ⇒ 400; totals qua `computeOrderTotals` với `vatRate`/`vatMode`/`discountAmount` của version nếu đã chốt, không thì giá trị hiện hành; `buildQuoteHtml` → `QuoteRendererPort.render` → `putObject` hai key cố định `quotes/{orderId}/bao-gia.png|.pdf` → `quoteExport.upsert` (một bản mới nhất mỗi đơn) → publish `QuoteExported`.
20. `backend/src/orders/quote/quote-template.ts` → `buildQuoteHtml`: chỉ format (escape HTML, dấu chấm ngàn), thông tin công ty từ `COMPANY_INFO`, font Be Vietnam Pro nhúng base64 từ `backend/assets/fonts/`; logo `backend/assets/quote/logo.png` nếu có (hiện không có trong repo ⇒ in tên công ty dạng chữ).
21. `backend/src/orders/quote/puppeteer-quote-renderer.ts` → `PuppeteerQuoteRenderer.render`: Chromium headless lazy (dynamic `import('puppeteer')`, launch ở lần render đầu, `--no-sandbox` khi `PUPPETEER_NO_SANDBOX=1`), viewport A4, xuất PDF A4 + PNG full page.
22. `backend/src/orders/quote-export.service.ts` → `getExportFile`: `assertScoped` trước, chưa xuất ⇒ 404, đọc bytes từ R2 và stream về client.

Tra cứu bảo hành

23. `backend/src/orders/orders.service.ts` → `traCuuBaoHanh` + `backend/src/orders/domain/warranty.ts`: chuẩn hoá SĐT, luôn 200 (`found: false` khi không có khách), chỉ đơn trong phạm vi và dòng có bảo hành của bản hiệu lực; `tinhHanBaoHanh`, `soNgayConLai`, `soThangConLai`, `trangThaiBaoHanh` (`con_han`/`sap_het`/`het_han`, ngưỡng `NGUONG_SAP_HET_NGAY = 90`) tính ở backend. Chỉ đọc, không event.

Danh sách, lọc, phạm vi

24. `backend/src/orders/orders.service.ts` → `list`: lọc `status` (10 khoá) hoặc `followUp=true` (đơn `baogia`; gửi cả hai ⇒ 400), phân trang `page`/`pageSize` (mặc định 20, tối đa 100), sắp `createdAt desc`, `total` cùng ảnh chụp với `items`; không trả tiền hay giá vốn.
25. `backend/src/orders/orders.service.ts` → `findScopedOrThrow` + `dieuKienPhamVi`: `orders.view_all` thấy mọi đơn; còn lại chỉ đơn mình là `owner` hoặc `assignee`. Mệnh đề nằm trong `where.AND`.
26. Client: các màn gọi `OrdersPort`/`WarrantyPort` (`web/src/design-system/session/orders-port.ts`, `mobile/lib/design_system/session/orders_port.dart`…) và vẽ nguyên số backend trả; không số học tiền, không tự suy bước vòng đời hay quyền.

## Bất biến

| Bất biến | Nơi enforce trong code | Test canh |
|---|---|---|
| Chỉ `applyTransition()` đổi `Order.status`; ngoại lệ duy nhất là INSERT `'baogia'` trong `create()`. `huyDon` ghi `cancelReason` bằng lệnh `update` không có `status`. | `OrdersService.applyTransition` | source-guard `no-order-status-write-outside-transition.spec.ts` (allowlist `applyTransition` và `create`); `orders.service.spec.ts` (`applyTransition — engine…`) |
| Luật được chuyển hay không chỉ sống ở bảng thuần `ALLOWED_TRANSITIONS`/`evaluateTransition`; lane tay chỉ nhận 5 sự kiện `SU_KIEN_THU_CONG`; `chot`/`mo_lai`/`huy`/`ap_chiet_khau`/`du_coc` có cửa riêng. | `domain/allowed-transition.ts`, `chuyenTrangThaiThuCong` | `allowed-transition.spec.ts`, `order-status-change.spec.ts`, `order-status-change.db.integration.spec.ts` |
| Engine chỉ nhận bộ quyền của actor thật, resolve tươi qua `AccountPermissionsService.listForAccount`; không có hằng toàn quyền. | `quyenCuaNguoiGoi` trong controller | `no-fabricated-actor-permissions.spec.ts` (flow `accounts-permissions`) |
| `OrderVersion` sở hữu mọi dòng; `Order.currentVersionId` là con trỏ duy nhất tới bản hiệu lực; mở lại sinh bản `versionNo + 1`, bản cũ không bị sửa; `@@unique([orderId, versionNo])`. | `create`, `revise`, `listVersions` | `orders.service.spec.ts` (con trỏ bản hiệu lực, `revise`), `orders.db.integration.spec.ts` (FK vòng, L-1), `version-diff.spec.ts`, `order-version-actor.db.integration.spec.ts` |
| Giá đóng băng lúc Chốt: `unitPriceSnapshot`/`catalogPriceSnapshot` trên dòng, `vatRate`/`vatMode`/`chotAt`/`discountAmount` trên version, dòng đọc lại dưới khoá. Giá vốn (`costPriceSnapshot`) đóng băng lúc xuất kho, không lúc chốt. | `confirm`, `lineCostSnapshot` | `orders.service.spec.ts` (`confirm…`), `orders.db.integration.spec.ts` (TOCTOU chốt đua thêm dòng), `discount-approvals.db.integration.spec.ts` (AC-3), `cost-snapshot.spec.ts` |
| Nội dung đơn chỉ sửa được ở `baogia` (409 nếu khác), kiểm lại trong tx sau khoá. | `assertMutable` | `orders.service.spec.ts` (guard trạng thái, mutator khoá dòng) |
| Tiền là integer đồng; MỘT hàm `computeOrderTotals` (Σ `lineAmount`, trừ chiết khấu trước VAT, half-up `Math.floor((vatBase * vatRate + 50) / 100)` tại một điểm). Client và template báo giá không tính tiền. | `domain/order-totals.ts`, `domain/line-amount.ts` | `order-totals.spec.ts`, `quote-template.spec.ts`, `design-system/screens/orders.test.mjs` (no money math), `discount-approval.test.mjs` |
| Phạm vi dữ liệu: mọi đường đọc-theo-id và lần đọc đầu của mọi đường ghi đi qua `findScopedOrThrow`; ngoài phạm vi và không tồn tại cùng một 404; mệnh đề nằm trong `where.AND`. | `findScopedOrThrow`, `dieuKienPhamVi`, `assertScoped` | source-guard `no-unscoped-order-write.spec.ts`; `orders-detail-scope*.spec.ts`, `orders-list-scope.spec.ts`, `orders-list.db.integration.spec.ts`, `orders-write-scope*.spec.ts`, `orders.e2e.spec.ts` |
| Quyền `orders.view_*` chỉ mở các route ĐỌC; mọi đường ghi giữ quyền riêng. | decorator trên `OrdersController` | source-guard `orders-read-gate.spec.ts` |
| Khoá: mọi đường đọc-rồi-ghi trên một đơn lấy `SELECT id FROM orders WHERE id = … FOR UPDATE` làm thao tác đầu trong tx; thứ tự khoá toàn hệ thống `orders → products`. | `lockOrderRow` | `orders.service.spec.ts` (`… lấy khoá FOR UPDATE trước khi ghi`), `orders.db.integration.spec.ts`; `order-stock-issue.db.integration.spec.ts` (flow `inventory`) |
| Cổng atomic `updateMany` theo status quan sát được; bên thua rollback bằng sentinel riêng mỗi lane (bắt theo identity): chốt/mở lại lặp ⇒ 200 idempotent, lane tay/huỷ/áp chiết khấu ⇒ 409, lane tự động ⇒ no-op. | `CHOT_GATE_THUA`, `THU_CONG_GATE_THUA`, `HUY_GATE_THUA`… | `orders.service.spec.ts`, `orders.db.integration.spec.ts` (auto-transition đua thật), `discount-approvals.db.integration.spec.ts` |
| Side-effect chỉ qua `EventBus.publish` SAU commit; service không gọi audit trực tiếp. | mọi mutator | `orders.service.spec.ts` (publish sau commit), `no-direct-side-effect-outside-eventbus.spec.ts` (flow `domain-events-audit`) |
| Đường huỷ không chạm tồn kho; nhả chỗ đi qua `OrderCancelled`. | `huyDon` | `no-stock-write-in-cancel.spec.ts` (flow `inventory`), `order-cancel.spec.ts` |
| Ảnh: validate trước khi lên R2; xoá DB trước R2; key R2 không lộ ra DTO; luật xoá chỉ ở backend (`coTheXoa`). | `themAnh`, `xoaAnh`, `kiemTraAnh` | `attachment-limits.spec.ts`, `order-attachments.spec.ts`, `order-attachments.db.integration.spec.ts`, `design-system/screens/order-attachments.test.mjs` |
| `OrdersModule` export `OrdersService` (cửa `chuyenTrangThaiTuDong` cho module khác). | `orders.module.ts` | `orders-module-wiring.spec.ts` |
| Bảo hành chỉ đọc: không đường ghi phiếu bảo hành ở backend lẫn port. | `traCuuBaoHanh` | `warranty-readonly.spec.ts`, `design-system/screens/warranty-lookup.test.mjs` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/orders/orders.controller.ts` | Controller HTTP mọi route `/orders` (gồm 3 route tồn kho của `inventory`); resolve cờ giá, thuế suất, quyền tươi mỗi request | `OrdersController` |
| `backend/src/orders/orders.service.ts` | Nghiệp vụ đơn: tạo, dòng, chốt, mở lại, chiết khấu, engine trạng thái, huỷ, ảnh, danh sách, bảo hành (và xuất kho theo đơn, xem `inventory`) | `OrdersService`, `applyTransition`, `findScopedOrThrow`, `lockOrderRow` |
| `backend/src/orders/orders.module.ts` | Wiring module, bind `QuoteRendererPort` → Puppeteer, export `OrdersService` | `OrdersModule` |
| `backend/src/orders/quote-export.service.ts` | Pipeline xuất báo giá và proxy tải file | `QuoteExportService` |
| `backend/src/orders/quote/quote-renderer.port.ts` | Port render HTML → PDF + PNG | `QuoteRendererPort` |
| `backend/src/orders/quote/puppeteer-quote-renderer.ts` | Adapter Chromium headless, lazy | `PuppeteerQuoteRenderer` |
| `backend/src/orders/quote/quote-template.ts` | Template HTML báo giá, nhúng font/logo | `buildQuoteHtml`, `QuoteTemplateData` |
| `backend/src/orders/quote/company-info.ts` | Hằng thông tin công ty trên báo giá | `COMPANY_INFO` |
| `backend/assets/fonts/BeVietnamPro-Regular.ttf`, `backend/assets/fonts/BeVietnamPro-SemiBold.ttf` | Font nhúng vào báo giá (đọc bởi `loadAssets`) | — |
| `backend/src/orders/domain/allowed-transition.ts` | Bảng chuyển trạng thái + guard thuần, dữ liệu vòng đời | `SU_KIEN`, `ALLOWED_TRANSITIONS`, `evaluateTransition`, `SU_KIEN_THU_CONG`, `buocVongDoi`, `buocKeTiep`, `coTheHuy`, `daTaiDich` |
| `backend/src/orders/domain/auto-transition-map.ts` | Mốc thanh toán → sự kiện | `MOC_TU_DONG`, `suKienChoMoc` |
| `backend/src/orders/domain/order-status.ts` | 10 khoá trạng thái | `OrderStatusKey`, `TRANG_THAI_*`, `ORDER_STATUS_KEYS` |
| `backend/src/orders/domain/order-totals.ts`, `backend/src/orders/domain/line-amount.ts` | Hàm pricing duy nhất | `computeOrderTotals`, `lineAmount`, `VAT_RATE_MAC_DINH` |
| `backend/src/orders/domain/vat-mode.ts` | Registry tick VAT | `VAT_MODE`, `VAT_MODES`, `vatApplies` |
| `backend/src/orders/domain/scope-preset.ts` | Preset cờ phạm vi theo loại khách | `scopePresetFor` |
| `backend/src/orders/domain/discount-approval-status.ts` | Trạng thái hồ sơ duyệt chiết khấu | `CHIET_KHAU_CHO_DUYET`, `CHIET_KHAU_DONG_Y`, `CHIET_KHAU_TU_CHOI` |
| `backend/src/orders/domain/cost-snapshot.ts` | Giá vốn đóng băng lên dòng lúc xuất kho | `lineCostSnapshot` |
| `backend/src/orders/domain/version-diff.ts` | Diff dòng giữa hai bản update | `diffDong`, `ThayDoiBanUpdate` |
| `backend/src/orders/domain/warranty.ts` | Số học ngày bảo hành | `tinhHanBaoHanh`, `soNgayConLai`, `soThangConLai`, `trangThaiBaoHanh` |
| `backend/src/orders/domain/attachment-limits.ts` | Giới hạn và validate ảnh, tên file an toàn | `SO_ANH_TOI_DA`, `KICH_THUOC_TOI_DA_BYTE`, `MIME_CHO_PHEP`, `kiemTraAnh`, `tenFileAnToan`, `duoiTuMime` |
| `backend/src/orders/domain/order-events.ts` | Domain event của đơn | `OrderCreated`, `StatusChanged`, `OrderCancelled`… |
| `backend/src/orders/dto/*.ts` (25 file của flow) | DTO request/response có validate + Swagger: tạo/sửa đơn, dòng, preview-total, chiết khấu, trạng thái, huỷ, ảnh, danh sách, version, vòng đời, xuất báo giá, bảo hành | `CreateOrderRequestDto`, `UpdateOrderRequestDto`, `AddLineItemRequestDto`, `PreviewTotalRequestDto`, `ListOrdersQueryDto`, `StatusChangeRequestDto`, `CancelOrderRequestDto`, `OrderResponseDto`, `QuoteExportResponseDto`, `WarrantyLookupResponseDto`… (hai file `order-stock-*-response.dto.ts` thuộc `inventory`) |
| `backend/prisma/migrations/20260716000000_add_orders/migration.sql` | Bảng `orders`, `order_versions`, `order_line_items` | — |
| `backend/prisma/migrations/20260717020000_add_discount_approvals/migration.sql` | Bảng `discount_approvals`, cột `order_versions.discount_amount` | — |
| `backend/prisma/migrations/20260717040000_add_quote_exports/migration.sql` | Bảng `quote_exports` | — |
| `backend/prisma/migrations/20260718000000_add_order_list_indexes/migration.sql` | Index `orders.status`, `orders.assignee_account_id` | — |
| `backend/prisma/migrations/20260718020000_add_order_version_created_by/migration.sql` | Cột `order_versions.created_by_account_id` | — |
| `backend/prisma/migrations/20260718060000_add_attachments/migration.sql` | Bảng `attachments` | — |
| `backend/prisma/migrations/20260718070000_add_order_cancel_reason/migration.sql` | Cột `orders.cancel_reason`, `orders.cancelled_at` | — |
| `web/src/design-system/session/orders-port.ts`, `mobile/lib/design_system/session/orders_port.dart` | Hợp đồng client ↔ `/orders` (một cặp sinh đôi) | `OrdersPort`, `Order`, `OrderLine`, `OrderLifecycle`, `OrderPortError` / `OrderPortException` |
| `web/src/design-system/session/fake-orders-port.ts`, `mobile/lib/design_system/session/fake_orders_port.dart` | Fake port cho demo/test (dữ liệu demo, mô phỏng lỗi) | `FakeOrdersPort` |
| `web/src/design-system/session/warranty-port.ts`, `mobile/lib/design_system/session/warranty_port.dart` | Hợp đồng tra cứu bảo hành | `WarrantyPort`, `WarrantyLookup` |
| `web/src/design-system/session/fake-warranty-port.ts`, `mobile/lib/design_system/session/fake_warranty_port.dart` | Fake port bảo hành | `FakeWarrantyPort` |
| `web/src/screens/orders/*.tsx` (5 màn của flow) | Màn web: tạo báo giá, danh sách, chi tiết, chuyển trạng thái, duyệt chiết khấu (`stock-issue-preview.tsx` thuộc `inventory`) | `CreateQuoteScreen`, `OrdersListScreen`, `OrderDetailScreen`, `OrderStatusChangeScreen`, `DiscountApprovalScreen` |
| `web/src/screens/orders/*.css` (`orders.css`, `orders-list.css`, `order-detail.css`, `order-status-change.css`, `discount-approval.css`) | Style riêng từng màn, dùng token | — |
| `web/src/screens/warranty/WarrantyLookupScreen.tsx`, `warranty-lookup.css`, `format-ngay.ts` | Màn tra cứu bảo hành web; `formatNgay` cắt chuỗi ISO thành `dd/mm/yyyy` (không thư viện ngày) | `WarrantyLookupScreen`, `formatNgay` |
| `mobile/lib/screens/orders/*.dart` (5 màn của flow) | Màn mobile tương ứng (`stock_issue_preview.dart` thuộc `inventory`) | `CreateQuoteScreen`, `OrderListScreen`, `OrderDetailScreen`, `OrderStatusChangeScreen`, `DiscountApprovalScreen` |
| `mobile/lib/screens/warranty/warranty_lookup_screen.dart` | Màn tra cứu bảo hành mobile | `WarrantyLookupScreen` |

Migration dùng chung (mục `shared`): `20260717000000_add_system_settings_and_order_metadata` thêm `orders.vat_mode`/`k_wp`/`validity_note` cùng bảng `system_settings` (flow `system-settings`).

## Dữ liệu

- Bảng: ghi `orders`, `order_versions`, `order_line_items`, `discount_approvals`, `quote_exports`, `attachments`; đọc `customers` (SĐT, `sourceId`, `custType`, thông tin in báo giá), `products` + `product_prices` (giá, `PRODUCT_QUOTE_SELECT` không có `costPrice`; `costPrice` chỉ đọc riêng cho biên ước tính khi có `costs.view`), `accounts` (`displayName` người tạo bản/người xin chiết khấu). `system_settings` và `feature_flags` đọc gián tiếp qua `SettingsService`/`FeatureFlagsService` ở controller. Bảng tồn kho (`stock_items`, `stock_movements`, `stock_vouchers`…) do `inventory` ghi trong tx của đơn.
- Sự kiện (`backend/src/orders/domain/order-events.ts`, publish qua `EventBus` sau commit): `OrderCreated`, `OrderLineAdded`, `OrderLineUpdated`, `OrderLineRemoved`, `OrderScopeChanged`, `OrderMetaChanged`, `OrderConfirmed`, `OrderRevised`, `DiscountRequested`, `DiscountResolved`, `QuoteExported`, `StatusChanged`, `AttachmentAdded`, `AttachmentRemoved`, `OrderCancelled`. `AuditSubscriber` ghi `audit_logs`; `OrderCancelledStockSubscriber` (`inventory`) nghe `OrderCancelled`. Phía tồn kho còn publish `StockIssued`/`StockOutBlocked` (flow `inventory`).
- Gọi ngoài: Cloudflare R2 qua `StoragePort` (`putObject`/`getObject`/`deleteObject`; key `attachments/{orderId}/{id}.{ext}` và `quotes/{orderId}/bao-gia.png|.pdf`); Chromium headless qua `puppeteer` trong `PuppeteerQuoteRenderer`.

## Flow liên quan

- auth-session: JWT, `@CurrentAccount` cấp `account.id` cho mọi handler.
- accounts-permissions: `PERM`, `@RequirePermissions`/`@RequireAnyPermissions`, `AccountPermissionsService.listForAccount`; guard `no-fabricated-actor-permissions`.
- catalog: `Product`, bảng giá bậc và `resolveUnitPrice`; nhóm hàng thêm vào giỏ thành dòng thường.
- customers: `Customer` theo SĐT, `normalizeVnPhone`, nguồn khách được snapshot; màn tạo báo giá dùng lại `CustomerPickScreen`.
- inventory: kiểm tồn sớm, xuất kho theo đơn, giữ chỗ lúc chốt, nhả chỗ lúc huỷ/hoàn thành, giá vốn dòng lúc xuất.
- system-settings: thuế suất VAT (`SettingsService.vatRatePercent`) và cờ `FLAG.catalogTieredPricing`.
- domain-events-audit: `EventBus`, `AuditSubscriber`, `audit_logs`.
- backend-platform: `PrismaService`, `StoragePort`/R2, `AppException` + `AllExceptionsFilter`, OpenAPI.
- design-system: component/widget, `StatusChip`, shell, guard màn `design-system/screens/*.test.mjs`.
- build-ci: CI chạy các lane test bên dưới.

## Mở rộng: số báo giá, đính kèm, tra cứu bảo hành và port thật

- `backend/src/orders/domain/quote-number.ts` (`quoteNumberOf`): số báo giá in trên PDF là 8 ký tự đầu của id đơn, viết hoa.
- `backend/src/orders/dto/attachment-upload-request.dto.ts`: body upload ảnh đính kèm đơn.
- Trạng thái của các màn đơn và bảo hành trên mobile nằm trong cubit/state riêng (`*_cubit.dart`, `*_state.dart`);
  màn chỉ render, mọi lời gọi qua port.
- Tra cứu bảo hành gửi SĐT thô; backend là nơi chuẩn hoá duy nhất (AD-9).

| Đường dẫn | Vai trò |
|-----------|---------|
| `backend/src/orders/domain/quote-number.ts` | Số báo giá từ id đơn (`quoteNumberOf`) |
| `backend/src/orders/dto/attachment-upload-request.dto.ts` | Body upload ảnh đính kèm |
| `mobile/lib/screens/orders/create_quote_cubit.dart`, `create_quote_state.dart` | Trạng thái màn Tạo báo giá (mobile) |
| `mobile/lib/screens/orders/discount_approval_cubit.dart`, `discount_approval_state.dart` | Trạng thái màn Duyệt chiết khấu (mobile) |
| `mobile/lib/screens/orders/order_detail_cubit.dart`, `order_detail_state.dart` | Trạng thái màn Chi tiết đơn (mobile) |
| `mobile/lib/screens/orders/order_list_cubit.dart`, `order_list_state.dart` | Trạng thái màn Danh sách đơn (mobile) |
| `mobile/lib/screens/orders/order_status_change_cubit.dart`, `order_status_change_state.dart` | Trạng thái màn Chuyển trạng thái (mobile) |
| `mobile/lib/screens/warranty/warranty_lookup_cubit.dart`, `warranty_lookup_state.dart` | Trạng thái màn Tra cứu bảo hành (mobile) |
| `mobile/lib/api/http_orders_port.dart`, `mobile/lib/api/http_warranty_port.dart` | Port thật (mobile) |
| `web/src/api/http-orders-port.ts`, `web/src/api/http-warranty-port.ts` | Port thật (web) |

## Tests

| Loại | File | Kiểm tra |
|---|---|---|
| Unit domain (hermetic) | `backend/test/allowed-transition.spec.ts`, `auto-transition-map.spec.ts`, `order-status.spec.ts`, `order-totals.spec.ts`, `vat-mode.spec.ts`, `scope-preset.spec.ts`, `cost-snapshot.spec.ts`, `version-diff.spec.ts`, `warranty.spec.ts`, `attachment-limits.spec.ts`, `quote-template.spec.ts` | Bảng transition và thứ tự đánh giá guard; map mốc → sự kiện; 10 khoá đủ hai chiều; pricing một điểm làm tròn; registry VAT/preset exhaustive; giá vốn dòng; diff không so giá; biên ngày bảo hành; giới hạn ảnh; template chỉ format, nhãn theo mẫu thật |
| Unit service (Prisma/EventBus mock) | `backend/test/orders.service.spec.ts`, `order-status-change.spec.ts`, `order-cancel.spec.ts`, `order-attachments.spec.ts`, `quote-export.service.spec.ts`, `warranty-lookup.spec.ts` | Payload ghi DB, publish sau commit, khoá FOR UPDATE trước ghi, chốt/mở lại/chiết khấu/engine/lane tự động; whitelist lane tay; lý do huỷ; luật xoá ảnh; thứ tự pipeline `render → put → put → write → publish`; query tra cứu bảo hành |
| Phạm vi (hermetic) | `backend/test/orders-detail-scope.spec.ts`, `orders-list-scope.spec.ts`, `orders-write-scope.spec.ts` | Hình dạng `where` có mệnh đề phạm vi trong `AND` cho đọc-theo-id, danh sách, đường ghi |
| Wiring | `backend/test/orders-module-wiring.spec.ts` | `OrdersModule` export `OrdersService` |
| E2E (HTTP thật, Prisma mock) | `backend/test/orders.e2e.spec.ts` | Authn/authz fail-closed mọi route, `ValidationPipe` + envelope lỗi, từng nhóm endpoint 4.1–5.9, ghi ngoài phạm vi ⇒ 404 |
| DB lane (Postgres thật) | `backend/test/orders.db.integration.spec.ts`, `discount-approvals.db.integration.spec.ts`, `quote-exports.db.integration.spec.ts`, `orders-list.db.integration.spec.ts`, `orders-detail-scope.db.integration.spec.ts`, `orders-write-scope.db.integration.spec.ts`, `order-version-actor.db.integration.spec.ts`, `order-status-change.db.integration.spec.ts`, `order-attachments.db.integration.spec.ts`, `order-cancel.db.integration.spec.ts` | Migration áp được, FK vòng Order ↔ OrderVersion, snapshot `sourceId`, TOCTOU chốt đua thêm dòng, đua auto-transition, cổng atomic approval, phạm vi trả đúng kết quả, transition + ảnh một tx, huỷ ghi lý do cùng tx |
| Source-guard | `backend/test/no-order-status-write-outside-transition.spec.ts`, `no-unscoped-order-write.spec.ts`, `orders-read-gate.spec.ts`, `warranty-readonly.spec.ts` | Chỉ engine ghi `Order.status`; method công khai đọc có phạm vi trước thao tác đầu; `orders.view_*` chỉ ở route đọc; bảo hành chỉ đọc |
| Guard màn (node --test) | `design-system/screens/orders.test.mjs`, `orders-list.test.mjs`, `order-detail.test.mjs`, `order-transition.test.mjs`, `order-cancel.test.mjs`, `order-attachments.test.mjs`, `discount-approval.test.mjs`, `warranty-lookup.test.mjs` | Màn có trên hai nền, ghép từ component có sẵn, chỉ đi qua port, nhãn giống từng byte, không literal quyền/trạng thái/sự kiện, không tính tiền/ngày, không tự suy bước từ cờ phạm vi |
| Widget test Flutter | `mobile/test/screens/orders/create_quote_screen_test.dart`, `order_list_screen_test.dart`, `order_detail_screen_test.dart`, `order_detail_attachments_test.dart`, `order_detail_cancel_test.dart`, `order_detail_long_status_test.dart`, `order_status_change_screen_test.dart`, `discount_approval_screen_test.dart`, `mobile/test/screens/warranty/warranty_lookup_screen_test.dart` | Trạng thái loading/ready/empty/lỗi/404, totals theo response preview, lọc follow-up, tab Ảnh lazy, nút Huỷ theo `coTheHuy`, chọn bước và gửi ảnh, nhãn trạng thái dài ở 320px, tra cứu bảo hành |
