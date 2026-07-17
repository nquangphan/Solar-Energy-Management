---
baseline_commit: e524050965b7bf9c3e55d0039e30d512726d7fb4
---

# Story 4.6: Sửa Đơn đã chốt — bản update mới + lịch sử

Status: done

## Story

As a người có quyền sửa đơn,
I want sửa đơn đã chốt bằng cách sinh bản update mới,
so that giữ nguyên lịch sử và không ghi đè bản cũ (FR-6).

## Acceptance Criteria

1. **Endpoint Mở lại + version mới (FR-6, AD-6):** **Given** Đơn ở `dachot`, **When** `POST /orders/:id/mo-lai` bởi người có `quotes.create_edit`, **Then** trong MỘT interactive transaction: (a) cổng atomic `updateMany({where: {id, status: 'dachot'}, data: {status: 'baogia'}})` + `count === 1`; (b) tạo `OrderVersion` MỚI `versionNo = versionNo hiện hành + 1` (`vatRate`/`vatMode`/`chotAt` = null — bản đang sửa chưa đóng băng thuế); (c) copy TOÀN BỘ dòng của bản hiệu lực sang bản mới theo bảng copy (Dev Notes) — `unitPriceSnapshot`/`catalogPriceSnapshot`/`costPriceSnapshot` = null, `warrantyMonths`/`warrantyStartAt`/`displayOrder` copy nguyên; (d) repoint `Order.currentVersionId` sang bản mới. Response `OrderResponseDto` với `status: 'baogia'` + lines của bản MỚI (snapshot null → `toViews` live-resolve lại giá danh mục hiện tại — hành vi trước-chốt FR-5). Thiếu quyền → 403 (`orders.confirm` KHÔNG thay thế được); đơn không tồn tại → 404; trạng thái khác `dachot`/`baogia` → 409.
2. **Giữ lịch sử — bản cũ bất biến (FR-6, AD-6):** **Given** đơn đã mở lại, **Then** version cũ + dòng cũ + mọi snapshot cũ giữ NGUYÊN (KHÔNG update/delete op nào chạm row cũ trong tx); `@@unique([orderId, versionNo])` giữ dãy version; "bản hiệu lực" CHỈ phân giải qua `currentVersionId`, không bao giờ qua timestamp/số đếm. FR-6 "các bản cũ vẫn truy được" chứng minh ở tầng service/DB bằng test (đọc lại version cũ thấy snapshot nguyên vẹn).
3. **Sửa & re-chốt trên bản mới (FR-5, FR-6, AD-16):** **Given** đơn đã mở lại (`baogia`), **Then** mọi mutation hiện có hoạt động lại nguyên trạng (`assertMutable` pass — add/update/remove line, PATCH meta/scope, preview-total) và ghi vào bản MỚI; **When** re-chốt qua `POST /orders/:id/chot` HIỆN CÓ (ZERO thay đổi `confirm()`), **Then** re-snapshot giá + `vatRate`/`vatMode`/`chotAt` lên bản MỚI (nó là `currentVersionId`); sau re-chốt sửa giá danh mục KHÔNG đổi giá bản mới; version cũ vẫn mang snapshot CŨ của nó (hai đợt đóng băng song song tồn tại — đường đọc per-line 4.5 đã thiết kế sẵn cho chính điều này).
4. **Idempotent + event (NFR-1, AD-18):** **Given** Đơn ĐÃ ở `baogia`, **When** gọi `POST /orders/:id/mo-lai` (retry/double-tap), **Then** 200 trả view hiện tại — KHÔNG version mới, KHÔNG event. **Given** 2 request mo-lai ĐỒNG THỜI, **Then** đúng MỘT version mới sinh ra (bên thua `count === 0` → rollback toàn tx kể cả version đã create → đọc lại `baogia` → trả idempotent). Mở lại THẬT publish `OrderRevised` (actor, before/after `OrderSnapshot` — `currentVersionId` cũ→mới + status `dachot`→`baogia` tự nói "bản nào/ai/khi nào") qua EventBus SAU commit — audit ghi qua AuditSubscriber (FR-6 "Audit log ghi ai sửa"), KHÔNG gọi audit trực tiếp.
5. **UI hai nền tảng (UX-DR-20, UX-DR-22, parity):** **Given** màn Tạo báo giá, đơn ở `dachot` (so qua HẰNG import từ port — guard n cấm literal `'dachot'` trong màn), người dùng có `quotes.create_edit`, **Then** có nút "Mở lại để sửa" (vị trí hàng nút dưới khối Tổng kết, chỗ nút Chốt khi editable); bấm → ConfirmDialog/AppConfirmDialog nêu hệ quả (câu byte-identical Dev Notes, tone primary — không destructive); xác nhận → port `reviseOrder(orderId)` → `setOrder(kết quả)` → màn TỰ bật lại editable (`status: 'baogia'`) → user sửa → re-chốt bằng nút Chốt 4.5; KHÔNG toast. Huỷ dialog → không gọi port. Thiếu quyền → nút KHÔNG hiển thị. Lỗi port → Banner + state cũ NGUYÊN VẸN (pattern k). Widget test mobile BẮT BUỘC (C-4) gồm error case. **KÈM fix bug 4.5 (web):** `PERM.ordersConfirm` KHÔNG TỒN TẠI trong `PERM` (7 khoá) → `Gate requires=undefined` → nút Chốt web KHÔNG BAO GIỜ render → không fix thì AC #3 chết trên web. Fix: màn web dùng `PERMISSION_KEYS` (generated, đủ 21 khoá — twin đúng với mobile đang dùng `AppPermissionKeys`); thêm guard chặn tái diễn (Task 8).
6. **Phạm vi để lại (tường minh — KHÔNG làm ở story này):** (a) Nửa tồn kho của AC epics ("huỷ `StockMovement` version cũ, tạo movement mới, tính lại `reserved`, chặn re-chốt khi thiếu khả dụng") thuộc **Story 6.6** — epics.md L592–598 nói nguyên văn story đó "sửa luồng chốt của Epic 4 nhưng phải nằm ở Epic 6 vì cần `StockItem` (6.2) tồn tại trước"; codebase CHƯA có model tồn kho nào. Seam cho 6.6: re-chốt đi qua `confirm()` + `OrderConfirmed` event — 6.6 móc vào đó, story này không chừa hook rỗng (YAGNI). (b) MÀN lịch sử bản update ("bản nào/ai/khi nào/đổi gì") là **Story 5.4** (epics L504–508 own verbatim) — story này bảo đảm DỮ LIỆU đã đủ: version rows (`versionNo`, `createdAt`, `chotAt`) + audit `OrderRevised`/`OrderConfirmed` (actor, occurredAt, before/after mang version pointer); KHÔNG dựng endpoint đọc versions/DTO mới khi chưa có màn tiêu thụ (đúng tiền lệ 4.5 không expose `chotAt`).

## Tasks / Subtasks

- [x] Task 1: Backend domain — event `OrderRevised` (AC: #4)
  - [x] `orders/domain/order-events.ts`: event mới `OrderRevised` (actor, before/after `OrderSnapshot`, at — shape y hệt `OrderConfirmed` L138). `OrderSnapshot` ĐÃ có `currentVersionId` — không sửa interface.
- [x] Task 2: Backend `OrdersService.revise()` (AC: #1–#4)
  - [x] Method mới `revise(actorAccountId, orderId, tieredPricingEnabled): Promise<OrderView>` (KHÔNG cần `vatRatePercent` — không ghi thuế). Luồng: `findOrThrow` → nếu `status === TRANG_THAI_BAO_GIA` trả `viewOf` NGAY (idempotent, không event — đơn đang mở sẵn) → nếu khác `dachot` → 409 → đọc version hiện hành (`currentVersionIdOrThrow` → `orderVersion.findUnique` lấy `versionNo`) + lines bản hiệu lực → **interactive `$transaction`**: (1) cổng `tx.order.updateMany({where: {id, status: TRANG_THAI_DA_CHOT}, data: {status: TRANG_THAI_BAO_GIA}})`, `count === 0` → throw sentinel `MO_LAI_GATE_THUA` (khuôn `CHOT_GATE_THUA` L137); (2) `tx.orderVersion.create({id: uuid mới, orderId, versionNo: cũ + 1})`; (3) `tx.orderLineItem.createMany(copies)` theo bảng copy Dev Notes (guard `copies.length > 0` — logic-impossible rỗng nhưng Prisma 7 createMany rỗng là gotcha đã biết); (4) `tx.order.update({where: {id}, data: {currentVersionId: versionId mới}})`. Catch sentinel → đọc lại: `baogia` → trả view idempotent; khác → 409. Cổng đặt ĐẦU tx để bên thua abort trước khi create gì.
  - [x] Response: compose `{...before, status: TRANG_THAI_BAO_GIA, currentVersionId: versionId mới}` → `viewOf(composed)` đọc lines bản MỚI (caveat `updatedAt` cũ trong compose — tiền lệ 4.5 LOW, chấp nhận).
  - [x] Publish `OrderRevised(actor, before, after, new Date())` SAU commit, CHỈ nhánh mở-lại thật.
  - [x] Doc đầu file service: mục GHI STATUS cập nhật — `confirm()` + `revise()` là HAI điểm ghi status tạm thời, cùng đánh dấu "5.1 nuốt block này vào applyTransition()". `toViews`/`assertMutable`/`confirm()` KHÔNG sửa dòng code nào.
- [x] Task 3: Controller endpoint + OpenAPI (AC: #1)
  - [x] `orders.controller.ts`: `@Post(':id/mo-lai')` + `@HttpCode(200)` (không tạo resource theo nghĩa REST — khuôn `:id/chot`) + `@RequirePermissions(PERM.quotesCreateEdit)` (key CÓ SẴN — `permissions.json` KHÔNG đổi); handler resolve `tieredPricingEnabled()` (KHÔNG cần vatRate); Swagger đủ 200/403/404/409 theo mẫu handler `confirm`. KHÔNG DTO mới (body rỗng, response `OrderResponseDto`).
  - [x] Regen OpenAPI: `cd backend && npm run openapi:gen` (drift-guard so byte).
- [x] Task 4: Backend tests (AC: #1–#4)
  - [x] `orders.service.spec.ts`: (a) happy — assert PAYLOAD từng op: `updateMany` đúng `where {id, status: 'dachot'}` + `data {status: 'baogia'}`; `orderVersion.create` đúng `{orderId, versionNo: n+1}` (fixture versionNo 3 → 4, chứng minh không hardcode 2); `createMany` từng dòng copy đúng bảng (snapshot null cả 3 cột, `warrantyMonths`/`displayOrder`/`warrantyStartAt` carried, `unitPrice` giữ nguyên, id mới); `order.update` đúng `{currentVersionId: mới}`; KHÔNG có op update/delete nào nhắm version/line CŨ; (b) thứ tự `['write','publish']` — `OrderRevised` sau commit; (c) retry `baogia` → trả view, KHÔNG tx/KHÔNG event; (d) race: `updateMany` trả `count: 0` → đọc lại `baogia` → idempotent; đọc lại `huy` → 409; (e) `huy`/`choduyet` → 409 không tx; (f) view trả về đọc lines bản MỚI (mock lines theo `orderVersionId` mới) + `toViews` live-resolve vì snapshot null (giá catalog mock ĐÃ ĐỔI → view trả giá MỚI — nghịch đảo test FR-5 của 4.5).
  - [x] `orders.e2e.spec.ts`: 401 vắng token; 403 với `orders.confirm` (KHÔNG thay được `quotes.create_edit` — nghịch đảo proof 4.5); vòng đời FR-6 đầy đủ: tạo → add line → chốt → sửa giá catalog → mo-lai 200 `status: 'baogia'` + giá dòng = giá catalog MỚI (live) + version cũ vẫn nguyên snapshot CŨ (đọc qua mock state) + audit `OrderRevised`; sửa dòng → re-chốt qua `/chot` → 200 `dachot` + snapshot mới trên bản mới; retry mo-lai khi `baogia` → 200 body y hệt, audit KHÔNG ghi thêm; 404 đơn ma.
- [x] Task 5: FE ports + fakes + hằng trạng thái (AC: #5)
  - [x] `web/src/design-system/session/orders-port.ts`: method mới `reviseOrder(orderId: string): Promise<Order>` (map `POST /orders/:id/mo-lai`) + export hằng `ORDER_STATUS_DACHOT = 'dachot'` (màn import hằng này để so status — guard n cấm literal trong màn, literal sống ở port file là hợp lệ, fake 4.5 đã chứa `'dachot'`). Twin `orders_port.dart`: `Future<Order> reviseOrder(String orderId);` + `const String kOrderStatusDachot = 'dachot';`.
  - [x] Fakes 2 bên (twin logic): `reviseOrder` — `dachot` → trả Order mới `status: 'baogia'`; `baogia` → trả nguyên trạng (idempotent như backend); KHÔNG mô phỏng version/copy dòng trong fake (client không thấy khái niệm version — 4.1).
- [x] Task 6: Web UI + fix gating 4.5 (AC: #5)
  - [x] **Fix bug trước:** `CreateQuoteScreen.tsx` L33 đổi import `PERM` → `PERMISSION_KEYS` (barrel `design-system/gating` đã export cả hai — L21); L542 `requires={PERMISSION_KEYS.ordersConfirm}`. KHÔNG thêm khoá vào `PERM`/`AppPerm` hand-block (tránh churn parity — hai block đó là khoá nav/curated; màn dùng thẳng generated keys như mobile đã làm). Kiểm tra `orders.test.mjs` có assert chuỗi `PERM.ordersConfirm` không — nếu có thì đổi assert theo.
  - [x] Nút "Mở lại để sửa": render khi `order.status === ORDER_STATUS_DACHOT` (hằng import từ orders-port), bọc `<Gate perms={perms} requires={PERMISSION_KEYS.quotesCreateEdit}>`, đặt cùng vị trí hàng nút Chốt (dưới Frame Tổng kết — khi `dachot` thì nút Chốt đã ẩn vì `editable` false, không đụng nhau); bấm → `ConfirmDialog` (title "Mở lại để sửa", `consequence` = câu byte-identical Dev Notes, tone default/primary); xác nhận → `moLaiBusy` disable → `reviseOrder(order.id)` → `setOrder(kết quả)` (editable TỰ bật vì `status === 'baogia'`); lỗi → `setError` Banner + state cũ nguyên (pattern k); huỷ → đóng dialog không gọi port. KHÔNG success toast.
- [x] Task 7: Mobile UI + widget test (AC: #5)
  - [x] `create_quote_screen.dart`: nút "Mở lại để sửa" khi `order.status == kOrderStatusDachot` (hằng import), bọc `AppGate(perms: widget.perms, requires: AppPermissionKeys.quotesCreateEdit)`; bấm → `AppConfirmDialog` (consequence byte-identical, `confirmTone: AppButtonVariant.primary`); confirm → `_moLaiBusy` → `reviseOrder` → `setState` order mới (editable tự bật) ; lỗi → Banner + state nguyên. Param `perms` ĐÃ có từ 4.5 (default `const {}` = ẩn — fail-closed).
  - [x] Widget test `create_quote_screen_test.dart` (BẮT BUỘC C-4): fixture cần đơn ở `dachot` — dựng qua flow chốt của fake (perms có `ordersConfirm` + `quotesCreateEdit`) hoặc fake seed sẵn; test: (a) đơn `dachot` + perms có `quotesCreateEdit` → nút "Mở lại để sửa" hiện; bấm → dialog đúng chữ → confirm → fake nhận `reviseOrder(orderId)` đúng 1 lần, màn editable lại (field enabled, nút Chốt hiện lại nếu có quyền); (b) huỷ dialog → fake KHÔNG bị gọi; (c) port throw (subclass khuôn `_RejectingUpdatePort`) → Banner + state nguyên + nút còn đó; (d) perms KHÔNG có `quotes.create_edit` → nút không render; (e) đơn `baogia` → nút không render. `ensureVisible` TRƯỚC tap (bài học 4.3/4.4/4.5). `dart format -o none --set-exit-if-changed` CHỈ file đã sửa.
- [x] Task 8: Guards design-system (AC: #5)
  - [x] `design-system/screens/orders.test.mjs`: (c.2) thêm `reviseOrder` vào port-method list; (e) nhãn byte-identical mới: "Mở lại để sửa" + NGUYÊN CÂU consequence; guard n (cấm `'dachot'` trong màn) GIỮ NGUYÊN — màn dùng hằng import nên vẫn xanh; nếu thêm negative assert mới PHẢI mutation-check (bẻ code thật → RED → revert bằng `cp` backup, KHÔNG `git checkout`).
  - [x] `design-system/permissions/permission-keys.test.mjs`: guard MỚI chống tái diễn bug 4.5 — quét màn web tìm `PERM.(\w+)`/`PERMISSION_KEYS.(\w+)` và assert từng tên tồn tại trong block/file nguồn tương ứng; quét màn mobile tìm `AppPermissionKeys.(\w+)` assert tồn tại trong `.g.dart` (và `AppPerm.(\w+)` với hand-block nếu có). Mutation-check: tự bẻ màn tham chiếu khoá ma (chính là bug 4.5 replay) → RED → revert.
  - [x] `design-system/session/parity.test.mjs`: cặp `reviseOrder` web↔dart; KHÔNG input type mới (body rỗng — khuôn cấm `ConfirmOrderInput` của 4.5).
  - [x] Chạy `cd design-system && npm test`. Guard quét file như TEXT — tránh chuỗi cấm (`shadow`/`gradient`/`* 8`/`0.08`/`Math.floor(`/`reduce(`/`~/ 100`) kể cả trong comment.
- [x] Task 9: Chạy toàn bộ lane + hồ sơ story (AC: tất cả)
  - [x] `cd backend && npm test` (unit + e2e + 7 source-guard + drift openapi/permissions — `permissions.json` phải KHÔNG đổi).
  - [x] Story KHÔNG migration mới (schema 4.1 đã đủ: `versionNo` + `@@unique([orderId, versionNo])` + `OrderVersion.updatedAt` comment nói sẵn "4.5/4.6 ghi lên row này") — DB lane không bắt buộc; action item 4.4 (migration `20260717000000` chưa deploy thật) VẪN TREO — nếu Postgres khả dụng chạy `npm run test:db` luôn thể, ghi rõ nếu không (Docker headless không lên được — đừng loay hoay).
  - [x] `cd mobile && flutter test && flutter analyze`.
  - [x] `cd design-system && npm test`.
  - [x] Tick tasks, điền Dev Agent Record + File List + Change Log (SAU QA phase — bài học 4.2/4.3).

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Backend lane flake MỚI ghi nhận: `test/me.e2e.spec.ts` đỏ chập chờn khi jest chạy song song full-lane (8 fail → 1 fail → 0 fail qua 3 lần chạy; pass khi chạy riêng) — cùng họ flake `customer-sources`/`customers` đã biết nhưng suite này chưa có trong danh sách. Điều tra contention hạ tầng test (không thuộc code story nào) [backend/test/me.e2e.spec.ts]
- [ ] [AI-Review][LOW] Nhánh thua cổng `revise()`: nếu giữa lúc thua và đọc lại, đơn được mở-lại + re-chốt bởi actor khác → 409 với message "Chỉ mở lại được đơn đang ở trạng thái Đã chốt" trong khi status ĐANG `dachot` (retry của client sẽ thành công). Cửa sổ cực hiếm, cùng họ TOCTOU 4.5 — fix thật thuộc engine transition 5.1, không chữa ở đây [backend/src/orders/orders.service.ts:686]
- [ ] [AI-Review][LOW] Fake `reviseOrder` 2 nền tảng "hồi sinh" MỌI status khác `baogia` (kể cả `huy` giả định) thay vì 409 — đúng khuôn fake `confirmOrder` 4.5 (flip mọi status) và client chưa có luồng huỷ; khi story huỷ đơn xuất hiện thì siết cả CẶP fake cùng lúc [web/src/design-system/session/fake-orders-port.ts:243]

## Dev Notes

### Quyết định spec đã chốt (đọc trước khi code)

- **Mở lại = transition `dachot` → `baogia`, TÁI DÙNG toàn bộ máy sửa hiện có:** về `baogia` thì `assertMutable` pass lại, mọi endpoint sửa dòng/meta/preview hoạt động nguyên trạng, và re-chốt = `POST /orders/:id/chot` HIỆN CÓ không đổi một dòng (`confirm()` snapshot lên bất kỳ version nào `currentVersionId` trỏ tới). Story này KHÔNG thêm trạng thái mới, KHÔNG sửa `confirm()`/`toViews`/`assertMutable` — chỉ THÊM `revise()` + event + endpoint + UI. Đường đọc per-line của 4.5 (`unitPriceSnapshot !== null` → frozen, null → live) được thiết kế sẵn cho cảnh "version cũ đã chốt + version mới đang sửa cùng lúc" — 4.6 chỉ việc hưởng.
- **`revise()` là điểm ghi status TẠM THỜI thứ HAI** (cùng `confirm()` — AD-11 tension, quyết định có ý thức y hệt 4.5): epics xếp 4.6 trước 5.1 có chủ đích. Cùng khuôn: transition nghiệp vụ có gate quyền + audit + cổng atomic. Comment đánh dấu "5.1 nuốt block này vào applyTransition()". KHÔNG dựng bảng transition (YAGNI — 5.1 sở hữu).
- **Route `/orders/:id/mo-lai`:** khuôn spine "action nghiệp vụ là sub-resource POST" (`/orders/{id}/chot` verbatim). Method/event tiếng Anh: service `revise()`, event `OrderRevised` (epics verbatim), port `reviseOrder`. `@HttpCode(200)`.
- **Quyền = `quotes.create_edit` (quyết định, có thể veto):** epics nói "người có quyền sửa đơn" — đúng mô tả key `quotes.create_edit` ("Tạo/sửa báo giá"). Lý do chọn thay vì `orders.confirm`: mở lại chỉ có MỘT tác dụng là cho phép sửa, mà mọi endpoint sửa đều gate `quotes.create_edit` — người khởi động việc sửa chính là người sẽ sửa; lời hứa giá với khách (version cũ đã chốt) KHÔNG bị đụng, nó nằm nguyên trong lịch sử; còn tái-đóng-băng (re-chốt) vẫn cần `orders.confirm`. Registry KHÔNG thêm key mới (`permissions.json` không đổi — tránh double-regen backend/FE không CI nào chạy cả hai). E2e phải chứng minh `orders.confirm` một mình KHÔNG mở lại được (nghịch đảo proof 4.5).
- **Bảng copy dòng (AC #1c):**

  | Cột | Bản mới |
  |---|---|
  | `productId`, `name`, `unit`, `qty`, `unitPrice`, `priceEditable`, `isFlexible`, `note`, `warrantyMonths`, `displayOrder` | copy nguyên |
  | `unitPriceSnapshot`, `catalogPriceSnapshot` | `null` — dòng sống lại, `toViews` live-resolve (catalog `!priceEditable`) hoặc dùng `unitPrice` cache (phí lắp/tự do); re-chốt mới đóng băng lại |
  | `costPriceSnapshot` | `null` — snapshot giá vốn thuộc SỰ KIỆN xuất kho trên version ĐÃ xuất (AD-20, 6.4); bản mới chưa xuất gì |
  | `warrantyStartAt` | **copy nguyên** — AD-20/4.9: "hàng cũ giữ ngày cũ, hàng mới thêm lấy ngày mới"; hôm nay luôn null (4.9 chưa làm) nhưng copy-as-is để logic 4.9 ("chỉ đặt khi null lúc chốt") chạy đúng xuyên version, zero cost |
  | `id` | uuid mới; `orderVersionId` = version mới |

- **`versionNo` mới = versionNo bản hiệu lực + 1:** bản hiệu lực luôn mang versionNo lớn nhất (bất biến: version chỉ sinh từ `create()` = 1 và `revise()` = +1; bên thua race rollback nên không lệch); `@@unique([orderId, versionNo])` là backstop. Đọc versionNo qua `orderVersion.findUnique(currentVersionIdOrThrow(order))` TRƯỚC tx.
- **Cổng atomic đặt ĐẦU tx** (khác 4.5 chỉ ở vị trí): thua cổng thì abort trước khi create version/lines — rollback rẻ, không rác. Sentinel riêng `MO_LAI_GATE_THUA` (khuôn `CHOT_GATE_THUA` L137). Race mo-lai ↔ chot đồng thời: hai cổng `updateMany` điều kiện NGƯỢC nhau trên cùng row — Postgres READ COMMITTED re-check WHERE sau row lock → đúng một bên thắng, bên kia rollback sạch.
- **Idempotent kiểu 4.5:** fast-path `baogia` → trả `viewOf` ngay (đơn đang mở sẵn — gọi mo-lai trên đơn chưa từng chốt cũng rơi vào nhánh này, no-op vô hại, đối xứng với chot-retry-trên-dachot); trạng thái khác → 409. Cổng thật nằm TRONG tx.
- **`OrderRevised` đủ cho "ai/khi nào/bản nào" (FR-6):** FR-6 consequence giao "Audit log ghi ai sửa/đổi gì" cho audit; `OrderSnapshot` có `currentVersionId` → before/after tự nói version cũ→mới; AuditSubscriber ghi tự động. KHÔNG thêm cột `createdBy` lên `OrderVersion` (không migration); "đổi gì" chi tiết = so sánh dòng hai version, 5.4 tự tính khi dựng màn.
- **UI: nút "Mở lại để sửa" là nghịch đảo nút Chốt** — hiện khi `dachot`, biến mất khi `baogia` (nút Chốt hiện lại thế chỗ). So status bằng HẰNG import từ port file (guard n cấm literal `'dachot'` trong màn — literal sống ở `orders-port.ts`/`orders_port.dart` là hợp lệ, fake 4.5 đã chứa). Dialog tone primary (không destructive — không mất gì, bản cũ còn nguyên). Voice: không hô hào, không toast — màn tự bật editable là tín hiệu đủ.
- **Câu consequence byte-identical (guard e):** `Mở lại sẽ tạo bản cập nhật mới — giá các dòng tính lại theo danh mục hiện tại cho tới khi chốt lại; bản đã chốt vẫn nằm trong lịch sử.`
- **Fix bug gating 4.5 là điều kiện sống của AC #3 trên web:** `PERM` hand-block (`gating/permissions.ts`) chỉ 7 khoá nav — KHÔNG có `ordersConfirm`; màn 4.5 tham chiếu `PERM.ordersConfirm` = `undefined` → `Gate` fail-closed → nút Chốt web không bao giờ render (web không tsc — TD-1/C-4 — nên không gì bắt). Mobile không dính (dùng generated `AppPermissionKeys`). Fix chuẩn twin: web dùng generated `PERMISSION_KEYS` (đã export sẵn từ barrel). KHÔNG đút khoá vào `PERM`/`AppPerm` hand-block — hai block đó deepEqual theo THỨ TỰ trong parity guard, đụng vào là churn 2 phía vô ích. Guard mới Task 8 để lớp text-guard bắt được kiểu bug này từ nay về sau.

### Hiện trạng code (đã scout, tin được)

**Backend:**
- `orders.service.ts`: `orderSnapshot` L113–130 (có `currentVersionId` — đủ cho event); `CHOT_GATE_THUA` L137; `findOrThrow` L188; `assertMutable` L204–211 (comment sẵn "sửa sau chốt = version mới, Story 4.6"); `currentVersionIdOrThrow` L217; `create()` L236–284 (array-tx 3 op, uuid tiền-sinh — `revise()` dùng INTERACTIVE tx như `confirm()`, khác khuôn create); `viewOf` L314–329; `confirm()` L424–566 (khuôn interactive tx + sentinel + publish-sau-commit — copy nguyên khuôn); `toViews` L795–853 (per-line snapshot-first, KHÔNG sửa); `addLine` L576 (displayOrder max+1 theo `orderVersionId` — copy displayOrder nguyên là tương thích).
- `order-events.ts`: 7 event; `OrderConfirmed` L138 là khuôn copy cho `OrderRevised`.
- `order-status.ts`: `TRANG_THAI_BAO_GIA` + `TRANG_THAI_DA_CHOT` đã export đủ dùng.
- `orders.controller.ts`: khuôn handler `confirm` L192–233 (`@HttpCode(200)`, resolve flag, Swagger 4 mã lỗi); route static `preview-total` đứng trước `:id` — `:id/mo-lai` là sub-resource, không xung đột.
- Prisma: `Order.currentVersionId @unique` (L327–355); `OrderVersion` L360–375 (`versionNo`, `@@unique([orderId, versionNo])`, `vatRate/vatMode/chotAt` nullable, comment "sửa-sau-chốt đẻ version mới (4.6)"); `OrderLineItem` L388–413 (đủ cột copy). KHÔNG model tồn kho nào tồn tại — nửa StockMovement của epics AC là 6.6.
- Registry `permission-registry.ts`: `quotesCreateEdit` L35, `ordersConfirm` L37 — KHÔNG có key reopen riêng, không thêm.
- Test hiện trạng: `orders.service.spec.ts` (1432 dòng) mock `$transaction` ĐÃ nhận cả array lẫn callback-style (L174–183 — `txMock` có `order.updateMany`, `orderVersion.update`, `orderLineItem.update`; `revise()` cần thêm `orderVersion.create` + `orderLineItem.createMany` + `order.update` vào txMock); `orders.e2e.spec.ts` (1149 dòng) — `givenPermissions(...)` helper, AuditSubscriber thật; `orders.db.integration.spec.ts` đã chứng minh `@@unique([orderId, versionNo])` ở DB thật (L212).

**FE web:**
- `CreateQuoteScreen.tsx`: import gating L33 (`Gate, PERM` — ĐỔI thành `Gate, PERMISSION_KEYS`); `editable = order.status === 'baogia'` L388; nút Chốt + `ConfirmDialog` + `chotBusy` L510–560 vùng hàng nút (khuôn copy cho mo-lai); pattern k đã chuẩn; `usePermissions` → `perms`.
- Barrel `gating/index.ts`: L16 export `PERM`, L21 export `PERMISSION_KEYS` (generated, 21 khoá gồm `ordersConfirm`, `quotesCreateEdit`).
- `orders-port.ts`: 9 method (có `confirmOrder`) — thêm `reviseOrder` + hằng `ORDER_STATUS_DACHOT`; `Order.currentVersionId` đã ở type (client không dùng — giữ nguyên).
- Web KHÔNG tsc/bundler — text-guard là lớp bảo vệ duy nhất (chính vì thế bug PERM lọt 4.5).

**FE mobile:**
- `create_quote_screen.dart`: `perms` param + `AppGate` + `AppConfirmDialog` + `_chotBusy` từ 4.5 (khuôn copy y nguyên cho `_moLaiBusy`); `editable = order.status == 'baogia'` L692; gate Chốt dùng `AppPermissionKeys.ordersConfirm` L911 (generated — đúng chuẩn, không dính bug web).
- `orders_port.dart`: 9 method twin — thêm `reviseOrder` + `kOrderStatusDachot`; `kMetaFieldAbsent` sentinel đã có tiền lệ hằng trong port file.
- Widget test helpers: `_screen({perms})`, `_tap`, `_pickDemoCustomer`, port-subclass khuôn `_RecordingConfirmPort`/`_RejectingUpdatePort` — tái dùng khuôn cho `_RecordingRevisePort`.

**Guards:**
- `orders.test.mjs`: (c.2) port-method list 9 method → thêm `'reviseOrder'`; (e) label list byte-identical; **(n) L393 cấm literal `'dachot'` trong MÀN** (không quét port file) — hằng import là lối đi; (g) cấm permission literal trong màn (`PERMISSION_KEYS.x` không phải literal — hợp lệ); (h/h.2/h.3) cấm số học tiền — không đụng; (k) cấm reset order trong catch.
- `permission-keys.test.mjs`: (1) regen byte-check 2 file generated; (2) deepEqual `PERM` ↔ `AppPerm` theo thứ tự — KHÔNG đụng hai block này; (3) SIDEBAR_NAV resolve. Guard mới (Task 8) sống ở đây.
- Backend 7 source-guard: handler mới PHẢI `@RequirePermissions`; permission literal cấm ngoài registry; naming convention; openapi + permissions drift.

### Bài học từ story trước (4.1–4.5)

- Assert **payload ghi DB** (`data`/`where`) từng op, không đếm số lần gọi mock; test thứ tự `['write','publish']`.
- Fixture dùng **con số phân biệt** (4.5: snapshot ≠ cache ≠ giá sống) — test live-resolve sau mo-lai cần giá catalog mock ĐÃ ĐỔI khác cả `unitPrice` cache lẫn snapshot cũ để mutant nào cũng lộ.
- Mutant PHẢI compile — mutant không compile đỏ cả suite là RED giả (bài học 4.5); revert bằng `cp` backup, KHÔNG `git checkout` (story code chưa commit).
- Widget test mobile BẮT BUỘC mọi thay đổi màn (C-4), gồm error case; `ensureVisible` TRƯỚC tap (4.3/4.4/4.5 đều dính tap-miss); tap-miss warning pre-existing ~L406 test cũ — ngoài scope, đừng sửa lan.
- Lỗi thao tác màn Tạo báo giá → Banner + KHÔNG wipe giỏ/order (finding High 4.1, guard k).
- OpenAPI là artifact sinh — đổi route xong PHẢI `npm run openapi:gen`; `permissions.json` story này KHÔNG được đổi (drift-guard bắt).
- Backend lane flake đã biết (`customer-sources`/`customers` e2e) — đỏ không liên quan thì rerun trước khi sửa.
- `dart format` mặc định GHI đè hàng loạt — luôn `-o none --set-exit-if-changed <file>`.
- Dev Agent Record cập nhật SAU QA phase (finding 4.2/4.3).
- `resolve_customization.py` fail trên máy này (Python < 3.11) — merge workflow block tay.
- Docker Desktop không lên được trong phiên headless — DB lane không chạy được thì ghi rõ, đừng loay hoay.
- Guard quét file như TEXT kể cả comment — tránh chuỗi cấm trong comment; regex brace `[^}]*` false-green với generic lồng — guard mới dùng `[\s\S]*?\n\}`.
- Review follow-up 4.5 còn treo (LOW): TOCTOU mutation-đồng-thời quanh confirm → fix thật ở engine 5.1 — `revise()` cùng cửa sổ đọc-lines→tx tương tự, CHẤP NHẬN cùng lý do (cổng atomic chặn double-write, dòng chèn race hiếm sẽ được 5.1 khoá row); ghi nhận, không chữa ở đây.

### Web research

Không thư viện/API mới — stack pin sẵn (NestJS 11.1.27, Prisma 7.8.0, React 19.2.7, Flutter 3.44). Gotcha Prisma 7 áp cho story: (1) interactive `$transaction(async (tx) => …)` — throw trong callback tự rollback TOÀN tx (kể cả version đã create — chính là hành vi race cần); (2) `createMany` mảng RỖNG là gotcha đã biết → guard `length > 0` (logic-impossible ở đây vì đơn chốt luôn ≥1 dòng, nhưng guard rẻ và chỉ unit test bắt được nếu ai gỡ); (3) READ COMMITTED đủ cho cổng `updateMany` status-guard (UPDATE re-check WHERE sau row lock) — không cần FOR UPDATE cho luồng này.

### Project Structure Notes

- File MỚI: **KHÔNG có** — không migration, không module, không DTO, không port file mới (khớp khuôn 4.5).
- File SỬA: `backend/src/orders/{domain/order-events.ts, orders.service.ts, orders.controller.ts}`, `backend/openapi/openapi.json` (regen), `backend/test/{orders.service.spec.ts, orders.e2e.spec.ts}`, `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts}`, `web/src/screens/orders/CreateQuoteScreen.tsx` (+`orders.css` nếu cần — 0 shadow/gradient, token radius), `mobile/lib/design_system/session/{orders_port.dart, fake_orders_port.dart}`, `mobile/lib/screens/orders/create_quote_screen.dart`, `mobile/test/screens/orders/create_quote_screen_test.dart`, `design-system/screens/orders.test.mjs`, `design-system/permissions/permission-keys.test.mjs`, `design-system/session/parity.test.mjs`.
- KHÔNG đụng: `schema.prisma` + migrations (cột/constraint có sẵn từ 4.1), `order-status.ts` (2 hằng đủ dùng), `confirm()`/`toViews`/`assertMutable`/pricing domain (chỉ GỌI), `permission-registry.ts` + `permissions.json` + 2 file generated keys, `PERM`/`AppPerm` hand-block, `update()`/DTO hiện có, `StatusChip`/chip labels (`dachot` = "Đã chốt" có từ Epic 1), `warrantyStartAt`-logic (4.9) và mọi thứ tồn kho (6.6).
- Naming: route `/orders/:id/mo-lai` (khuôn spine sub-resource action); `revise()`/`OrderRevised`/`reviseOrder` nhất quán tiếng Anh như `confirm()`/`OrderConfirmed`/`confirmOrder`; hằng `ORDER_STATUS_DACHOT`/`kOrderStatusDachot` theo convention từng ngôn ngữ.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.6 L449–454] — 3 AC gốc; nửa StockMovement defer 6.6 theo [epics.md#Story-6.6 L592–598] (dependency note verbatim) + màn lịch sử thuộc [epics.md#Story-5.4 L504–508]
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-6 L131–137] — bản update mới + lịch sử + audit ai/đổi gì; #FR-5 — trước chốt ăn giá mới nhất (đường live sau mở lại)
- [Source: ARCHITECTURE-SPINE.md#AD-6] — "Sửa sau chốt = tạo OrderVersion mới (không ghi đè), trỏ currentVersionId sang bản mới, giữ lịch sử"; con trỏ chân lý duy nhất, không suy từ timestamp/số đếm; #AD-11 — applyTransition (5.1) là đích của điểm ghi status; #AD-16 — snapshot vatRate/vatMode hiệu lực lúc chốt (re-chốt ghi lên bản mới); #AD-18 — publish OrderRevised, không side-effect trực tiếp; #AD-19 — reserved/StockMovement (6.6, chỉ tham chiếu); #AD-20 — warrantyStartAt theo dòng, hàng cũ giữ ngày cũ (copy-as-is); #Consistency-Conventions — idempotency thao tác tiền (NFR SM-1) + audit trước→sau
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#§2-§3] — chốt lần đầu khi thiếu tồn CHO CHỐT nhưng re-chốt thiếu khả dụng bị chặn (asymmetry có chủ đích — 6.6 thực thi); warrantyStartAt đóng băng theo DÒNG
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md L108, L127] — "Sửa đơn đã chốt (FR-6): sinh bản update mới (không ghi đè), snapshot lại giá, giữ lịch sử; bản mới nhất là bản hiệu lực"; voice không hô hào (L57–70); Dialog xác nhận có hệ quả (UX-DR-20); gating ẩn theo quyền (UX-DR-22)
- [Source: _bmad-output/implementation-artifacts/4-5-chot-don-snapshot-gia.md] — khuôn interactive tx + sentinel + idempotent + publish-sau-commit; đường đọc per-line thiết kế sẵn cho 4.6; Review Follow-ups LOW (TOCTOU → 5.1)
- [Source: web/src/design-system/gating/permissions.ts + CreateQuoteScreen.tsx L33/L542] — bug PERM.ordersConfirm undefined (xác minh trực tiếp trong lúc tạo story này)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) — dev-story workflow, 2026-07-17.

### Debug Log References

- Backend lane: 54 suite / 858 test PASS (unit + e2e + 7 source-guard + drift openapi/permissions — `permissions.json` KHÔNG đổi, openapi regen +65 dòng cho `POST /orders/:id/mo-lai`).
- Mobile lane: 179 test PASS + `flutter analyze` 0 issue; `dart format -o none --set-exit-if-changed` 4 file đã sửa: 0 changed. Tap-miss warning pre-existing (~L406 test cũ) — ngoài scope, không đụng.
- Design-system lane: 275 test PASS.
- DB lane: KHÔNG chạy được — Docker daemon không lên trong phiên headless (đã biết từ 4.4/4.5), không có Postgres cục bộ. Story không có migration mới nên DB lane không bắt buộc; action item 4.4 (migration `20260717000000` chưa deploy thật) VẪN TREO.
- Mutation-check 1 (backend, negative assert "KHÔNG op nào chạm row cũ"): thêm `tx.orderVersion.update({where: {id: currentVersionId}, data: {chotAt: null}})` vào tx của `revise()` → test happy RED đúng chỗ → revert bằng `cp` backup → 65/65 xanh lại.
- Mutation-check 2 (guard mới permission-keys (4), replay bug 4.5): web đổi `PERMISSION_KEYS.ordersConfirm` → `PERM.ordersConfirm` → guard RED nêu đúng file+tên khoá ma; mobile đổi `AppPermissionKeys.quotesCreateEdit` → `quotesReopenGhost` → guard RED nhánh Dart; revert cả hai bằng `cp` backup → 275/275 xanh lại.

### Completion Notes List

- **Task 1–2 (backend):** `OrderRevised` event (khuôn `OrderConfirmed`); `OrdersService.revise()` — interactive tx với cổng atomic `updateMany({id, status: 'dachot'} → 'baogia')` đặt ĐẦU tx (sentinel `MO_LAI_GATE_THUA`), tạo `OrderVersion` versionNo+1 (vatRate/vatMode/chotAt null), `createMany` copy toàn bộ dòng theo bảng copy (3 cột snapshot = null, `warrantyStartAt` copy nguyên, id mới, guard `copies.length > 0` cho gotcha Prisma 7), repoint `currentVersionId`. Idempotent kiểu 4.5: `baogia` → trả view ngay, không tx/không event; race thua cổng → đọc lại → idempotent hoặc 409. Publish `OrderRevised` SAU commit, chỉ nhánh mở-lại thật. Doc đầu service cập nhật: `confirm()` + `revise()` là HAI điểm ghi status tạm thời, 5.1 nuốt vào `applyTransition()`. `toViews`/`assertMutable`/`confirm()` KHÔNG sửa dòng nào.
- **Task 3:** `@Post(':id/mo-lai')` + `@HttpCode(200)` + `@RequirePermissions(PERM.quotesCreateEdit)` (key có sẵn — registry không đổi), Swagger 200/403/404/409, không DTO mới; KHÔNG resolve vatRate (mở lại không ghi thuế). OpenAPI regen.
- **Task 4:** Unit (7 test mới): happy assert PAYLOAD từng op (versionNo 3→4 chứng minh không hardcode, copy đúng bảng từng cột cho 3 loại dòng, KHÔNG op chạm row cũ), thứ tự ['write','publish'], retry baogia, race count=0 → baogia/huy, huy+choduyet 409, view đọc bản MỚI + live-resolve giá catalog ĐÃ ĐỔI (2_600_000 ≠ snapshot cũ 2_400_000 ≠ cache 2_450_000 — nghịch đảo FR-5 của 4.5). E2e (4 test mới): 401; 403 với CHỈ `orders.confirm` (nghịch đảo proof 4.5); vòng đời FR-6 đầy đủ qua mock stateful (tạo → thêm dòng → chốt 2_450_000 → giá đổi → mo-lai 200 giá sống 2_600_000 + bản cũ nguyên snapshot + audit OrderRevised → sửa dòng → re-chốt qua `/chot` HIỆN CÓ → snapshot mới trên bản mới, bản cũ vẫn cũ); retry mo-lai body y hệt GET không audit; 404 đơn ma. Route mo-lai thêm vào loop fail-closed 401/403.
- **Task 5:** `reviseOrder(orderId)` + hằng `ORDER_STATUS_DACHOT`/`kOrderStatusDachot` trên 2 port twin; fake 2 bên: `dachot` → `baogia`, `baogia` → idempotent nguyên trạng, KHÔNG mô phỏng version/copy dòng (client không thấy version — 4.1).
- **Task 6 (web + fix bug 4.5):** import `PERM` → `PERMISSION_KEYS` (generated 21 khoá), `requires={PERMISSION_KEYS.ordersConfirm}` — nút Chốt web giờ render được (trước đó `PERM.ordersConfirm` = undefined → Gate fail-closed vĩnh viễn). KHÔNG đụng `PERM`/`AppPerm` hand-block. Không guard nào assert chuỗi `PERM.ordersConfirm` nên không phải đổi assert. Nút "Mở lại để sửa": `order.status === ORDER_STATUS_DACHOT` (hằng import) + Gate `quotesCreateEdit`, cùng vị trí hàng nút (`quote-chot-row` — không cần CSS mới), ConfirmDialog tone mặc định với câu consequence byte-identical, `moLaiBusy`, lỗi → Banner + state nguyên (pattern k), KHÔNG toast.
- **Task 7 (mobile):** khuôn y hệt Chốt 4.5: `_moLaiBusy` + `_reviseOrder()` + `_openMoLaiDialog()` (AppConfirmDialog, `confirmTone: primary`) + nút gate `AppGate(quotesCreateEdit)` khi `order.status == kOrderStatusDachot`. Widget test 5 case (C-4): (a) happy — dachot dựng qua flow chốt của fake, dialog đúng chữ, fake nhận đúng 1 lần, màn editable lại + nút Chốt hiện lại; (b) huỷ dialog → fake không bị gọi; (c) port throw → banner + state nguyên + nút còn đó; (d) thiếu `quotes.create_edit` (chỉ có ordersConfirm) → nút không render; (e) đơn baogia → nút không render. `ensureVisible` trước tap (helper `_tap` có sẵn).
- **Task 8 (guards):** orders.test.mjs — thêm `reviseOrder` vào port-method list (c.2), 2 nhãn byte-identical mới (e); guard n (cấm `\'dachot\'` trong màn) giữ nguyên và vẫn xanh vì màn dùng hằng import. permission-keys.test.mjs — guard MỚI (4) quét đệ quy màn web (`PERM.x`/`PERMISSION_KEYS.x`) + màn mobile (`AppPermissionKeys.x`/`AppPerm.x`), strip comment trước, assert từng TÊN tồn tại trong block/file nguồn — mutation-check 2 nhánh đều RED (xem Debug Log). parity.test.mjs — cặp `reviseOrder` web↔dart, cấm `ReviseOrderInput` (khuôn cấm `ConfirmOrderInput`), assert 2 hằng status sống ở PORT file.
- **Phạm vi để lại (AC #6):** nửa tồn kho → Story 6.6 (seam: re-chốt đi qua `confirm()` + `OrderConfirmed`, không hook rỗng); màn lịch sử version → Story 5.4 (dữ liệu đã đủ: version rows + audit `OrderRevised`/`OrderConfirmed` mang version pointer). KHÔNG endpoint đọc versions mới.
- **Ghi nhận (không chữa ở đây):** TOCTOU cửa sổ đọc-lines→tx của `revise()` cùng bản chất finding LOW 4.5 — cổng atomic chặn double-write, dòng chèn race hiếm sẽ được 5.1 khoá row (quyết định giữ nguyên từ review 4.5).

### File List

- backend/src/orders/domain/order-events.ts (sửa — event `OrderRevised`)
- backend/src/orders/orders.service.ts (sửa — `revise()` + sentinel `MO_LAI_GATE_THUA` + doc GHI STATUS)
- backend/src/orders/orders.controller.ts (sửa — handler `POST :id/mo-lai`)
- backend/openapi/openapi.json (regen)
- backend/test/orders.service.spec.ts (sửa — describe `revise` 7 test + mở rộng tx mock)
- backend/test/orders.e2e.spec.ts (sửa — describe `mo-lai` 4 test + route vào loop fail-closed + mở rộng tx mock)
- web/src/design-system/session/orders-port.ts (sửa — `reviseOrder` + `ORDER_STATUS_DACHOT`)
- web/src/design-system/session/fake-orders-port.ts (sửa — `reviseOrder` fake)
- web/src/screens/orders/CreateQuoteScreen.tsx (sửa — fix PERM→PERMISSION_KEYS + nút/dialog Mở lại)
- mobile/lib/design_system/session/orders_port.dart (sửa — `reviseOrder` + `kOrderStatusDachot`)
- mobile/lib/design_system/session/fake_orders_port.dart (sửa — `reviseOrder` fake)
- mobile/lib/screens/orders/create_quote_screen.dart (sửa — nút/dialog Mở lại + `_moLaiBusy`)
- mobile/test/screens/orders/create_quote_screen_test.dart (sửa — 5 widget test 4.6 + 2 port subclass + helper `_chotDonQuaFake`)
- design-system/screens/orders.test.mjs (sửa — c.2 + e)
- design-system/permissions/permission-keys.test.mjs (sửa — guard (4) chống khoá ma)
- design-system/session/parity.test.mjs (sửa — twin re-check `reviseOrder`)

## Senior Developer Review (AI)

**Ngày:** 2026-07-17 · **Reviewer:** Đại Ca (adversarial review workflow) · **Kết luận: APPROVE — Story done.**

- **Git vs File List:** 16/16 file nguồn khớp, 0 discrepancy (2 file `_bmad-output` ngoài phạm vi review).
- **AC:** 6/6 IMPLEMENTED, đối chiếu code + test thật: (1) `POST /orders/:id/mo-lai` — interactive tx với cổng atomic `updateMany({id, status:'dachot'}→'baogia')` đặt ĐẦU tx (sentinel `MO_LAI_GATE_THUA`), version mới `versionNo+1` không thuế, copy dòng đúng BẢNG (3 cột snapshot null, `warrantyStartAt`/`displayOrder` carried, id mới), repoint `currentVersionId`; 403/404/409 đủ, Swagger + OpenAPI regen khớp byte; (2) bất biến lịch sử — unit assert KHÔNG op update/delete nào chạm version/dòng CŨ + e2e đọc lại bản cũ thấy snapshot nguyên; (3) re-chốt qua `/chot` HIỆN CÓ (`confirm()` 0 dòng đổi), e2e vòng đời 8 bước chứng minh hai đợt đóng băng song song + giá đổi tiếp sau re-chốt không hồi tố; fix bug web 4.5 `PERM.ordersConfirm` undefined → `PERMISSION_KEYS` (nút Chốt web sống lại — điều kiện của AC #3); (4) idempotent `baogia` → 200 không tx/không event, race count-0 → đọc lại → idempotent/409, `OrderRevised` publish SAU commit (thứ tự `['write','publish']` assert), audit qua AuditSubscriber thật trong e2e; (5) UI 2 nền tảng nút "Mở lại để sửa" nghịch đảo nút Chốt, hằng `ORDER_STATUS_DACHOT`/`kOrderStatusDachot` import từ port (guard n xanh), ConfirmDialog câu consequence byte-identical (guard e), 5 widget test mobile gồm error case + cancel + 2 nhánh không-render; (6) scope để lại đúng cam kết — KHÔNG code tồn kho, KHÔNG endpoint đọc versions (openapi diff chỉ +1 route `mo-lai`).
- **Task audit:** 9/9 task [x] đều có bằng chứng thật trong diff — không task nào tick khống.
- **Verify độc lập:** backend **861/861** (54 suite — lần chạy đầu `me.e2e.spec.ts` đỏ 8 test do flake song song, pass khi chạy riêng + full-lane rerun sạch; suite này story không đụng), mobile **179/179** + `flutter analyze` 0 issue, design-system **275/275**. Mutation-replay độc lập guard chống khoá ma (bẻ web về `PERM.ordersConfirm` → guard (4) RED nêu đúng file + tên khoá → restore `cp`, guard xanh lại) — lớp bảo vệ duy nhất của web (không tsc) hoạt động thật. Web identifiers trong code mới (`syncMetaTexts`/`refreshTotals`/`messageOf`) đối chiếu tồn tại bằng tay. DB lane không chạy được (Docker headless — giới hạn phiên đã biết, story không có migration).
- **Findings:** 0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW → ghi action item ở "Review Follow-ups (AI)" (flake mới `me.e2e` cần vào danh sách flake đã biết; message 409 nhánh thua cổng ở cửa sổ double-race cực hiếm — 5.1 sở hữu; fake revive mọi status — đúng khuôn fake 4.5, siết khi có luồng huỷ). Không auto-fix vì cả 3 đều ngoài code story hoặc là quyết định spec/tiền lệ có chủ đích — đảo lại vi phạm rule review-audit.

## Change Log

- 2026-07-17: Adversarial code review (story-automator review workflow) — 6/6 AC verified against code, 9/9 task có bằng chứng, 3 lane rerun độc lập xanh (backend 861 — flake `me.e2e` không liên quan rerun sạch, mobile 179 + analyze 0, design-system 275), mutation-replay guard khoá-ma RED-then-green độc lập. 0 CRITICAL/HIGH/MEDIUM; 3 LOW ghi thành Review Follow-ups (flake me.e2e, message 409 double-race → 5.1, fake revive status → story huỷ đơn). Story APPROVED. Status: review → done.
- 2026-07-17: Story 4.6 tạo bởi create-story workflow — ultimate context engine analysis hoàn tất (3 scout song song: backend orders module, FE web/mobile + guards, spine/UX/PRD/quyết-định-nghiệp-vụ; xác minh trực tiếp bug PERM web). Scope tường minh: version mới + re-chốt tái dùng confirm() + OrderRevised + UI mở lại; nửa StockMovement defer 6.6, màn lịch sử defer 5.4. Status: ready-for-dev.
- 2026-07-17: Story 4.6 dev hoàn tất (dev-story workflow): backend `revise()` + `OrderRevised` + endpoint `POST /orders/:id/mo-lai`; FE 2 nền tảng nút "Mở lại để sửa" + fix bug gating 4.5 (web PERM→PERMISSION_KEYS); guard mới chống khoá ma + parity `reviseOrder`; 3 lane xanh (backend 858, mobile 179 + analyze, design-system 275); 2 mutation-check RED-then-revert; DB lane không chạy được (Docker headless) — story không có migration mới. Status: review.
- 2026-07-17: QA phase (qa-generate-e2e-tests workflow): rà coverage theo 6 AC, phát hiện 4 gap và auto-apply — unit dangling-version 409 + unit empty-lines guard Prisma 7 (mutation-checked: gỡ guard → RED → revert `cp`), e2e 409 envelope `'huy'` qua exception filter, e2e mở rộng vòng đời FR-6 bước 8 (giá đổi tiếp sau re-chốt → GET giữ giá đóng băng — vế AC #3). Backend 858 → 861/861 xanh (không flake). Mobile/design-system không đụng file — kết quả dev phase còn hiệu lực. Chi tiết: `tests/test-summary-story-4-6.md`.
