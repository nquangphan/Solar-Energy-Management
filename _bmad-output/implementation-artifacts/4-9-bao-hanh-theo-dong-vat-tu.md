---
baseline_commit: d82b20a348a955030ae10681688648cc51f6b008
---

# Story 4.9: Bảo hành theo dòng vật tư (warrantyMonths field + warranty start date)

Status: done

## Story

As a người tạo báo giá,
I want cấu hình bảo hành cho từng dòng vật tư và lưu mốc bảo hành,
so that biết khi nào hết hạn bảo hành cho khách (FR-36).

## Acceptance Criteria

1. **Sửa bảo hành theo dòng (FR-36, §3):** **Given** dòng catalog thường (`priceEditable=false`) hoặc dòng tự do (`productId` null), **When** `PATCH /orders/:id/line-items/:lineId` với field MỚI `warrantyMonths` (int ≥ 1 hoặc `null` — null nghĩa "bỏ bảo hành", là GIÁ TRỊ nghiệp vụ hợp lệ), **Then** dòng lưu giá trị mới và response `warrantyMonths` phản ánh ngay. **Given** dòng catalog `priceEditable=true` (công lắp/phí lắp đặt), **When** request có `warrantyMonths`, **Then** backend GIỮ `null` — bỏ qua field im lặng, KHÔNG 400 (§3 nguyên văn: "KHÔNG viết validation chặn — chỉ để null, không hiện ô"). Mutation vẫn qua `assertMutable` như mọi sửa dòng — sau chốt 409, tức "snapshot lúc chốt" đã thoả bằng bất biến có sẵn (đúng khuôn 4.5 AC#3). KHÔNG endpoint mới, KHÔNG quyền mới (route PATCH line có sẵn, `quotes.create_edit`).
2. **Mặc định + ép null lúc addLine (§3):** **Given** thêm dòng catalog, **When** `addLine`, **Then** `warrantyMonths = product.priceEditable ? null : product.warrantyMonths` — SỬA copy vô-điều-kiện hiện tại (`orders.service.ts:1259`): sản phẩm công lắp/phí lắp KHÔNG BAO GIỜ mang bảo hành lên dòng, kể cả khi catalog lỡ có `warrantyMonths` (form Sản phẩm cho nhập field này với MỌI product). Dòng tự do giữ `warrantyMonths: null` lúc add như hiện tại (nhập sau qua link trên row — AC #4). `AddLineItemRequestDto` KHÔNG thêm field (KISS — flow là add rồi sửa trong row; form Dòng tự do không đổi).
3. **`warrantyStartAt` đóng băng theo DÒNG lúc chốt lần đầu (FR-36):** **Given** Đơn được Chốt (`confirm()` — 4.5) hoặc bản update được re-chốt (4.6), **When** transaction ghi snapshot per-line, **Then** mỗi dòng có `warrantyStartAt === null` nhận `warrantyStartAt = chotAt` (CÙNG hằng `chotAt` đã ghi lên `OrderVersion` — một timestamp, không `new Date()` thứ hai — bài học review 4.8); dòng có sẵn giá trị GIỮ NGUYÊN (không ghi lại). Áp cho MỌI dòng kể cả dòng không bảo hành — mốc là thuộc tính "dòng chốt lần đầu", độc lập với việc có `warrantyMonths` hay không (xem Quyết định spec). `revise()` (4.6) đã copy `warrantyStartAt` as-is sang version mới (`orders.service.ts:787` + comment L716 "4.9 chỉ đặt khi null lúc chốt") — ZERO sửa `revise()`; hệ quả tự nhiên: re-chốt bản update → hàng cũ giữ ngày cũ, hàng mới thêm nhận ngày mới. Nhánh idempotent/retry/race của `confirm()` KHÔNG ghi gì (giữ nguyên 4.5). `warrantyStartAt` KHÔNG expose ra response DTO/port/view (màn tra cứu 5.9 tự mở khi đến lượt — khuôn 4.5 "chotAt để màn sau tự mở").
4. **UI cột Bảo hành 2 nền tảng (UX mockup s-quote, parity):** **Given** bảng giỏ hàng màn Tạo báo giá, **Then** thêm cột header `Bảo hành` (giữa SL và Đơn giá — khớp mockup); `CartLineRow`/`AppCartLineRow` render ô bảo hành theo loại dòng: (a) catalog thường + editable → input số tháng (inputMode numeric, commit-on-blur khuôn kWp/qty, rỗng = null) → gọi port `updateLine(orderId, lineId, {warrantyMonths})`; (b) catalog `priceEditable=true` → chữ `Không có` muted, KHÔNG input, KHÔNG nhắc (mockup dòng Công lắp đặt); (c) dòng tự do editable chưa có bảo hành → link `+ Thêm bảo hành` (mockup L1453), bấm → hiện input (state cục bộ component); đã có → input như (a); (d) read-only (sau chốt / thiếu quyền sửa) → text format theo AC #5, null → rỗng (riêng công lắp vẫn `Không có`). Lỗi port → Banner + state giỏ NGUYÊN (pattern k), không success toast. Nhãn tĩnh byte-identical web↔mobile. Widget test mobile BẮT BUỘC (C-4) gồm error case.
5. **Format hiển thị "X năm"/"X tháng" (§3):** **Given** `warrantyMonths` non-null, **Then** hiển thị `"{n/12} năm"` khi chia hết 12, `"{n} tháng"` khi không, null → rỗng — helper twin `formatWarrantyMonths` ở 2 nền tảng, CÙNG LUẬT với backend `formatWarranty` (`quote-template.ts:70–74`, đã có từ 4.8 — 3 nơi một luật, backend KHÔNG sửa). ⚠️ Dart PHẢI dùng `months ~/ 12` (int division — `60 / 12` ra `5.0` → "5.0 năm" SAI); web `months / 12` an toàn khi đã kiểm chia hết.
6. **Guards + parity + hồ sơ sinh:** `orders.test.mjs`: (e) += nhãn byte-identical `Bảo hành`, `+ Thêm bảo hành`, `Không có`; (c.2) KHÔNG method port mới (tái dùng `updateLine`). `parity.test.mjs` block 4.9: field `warrantyMonths` trong `UpdateOrderLineInput` 2 phía + twin tokens formatter. Component twins sửa → `components/parity.test.mjs` + behavior/invariant guard hiện có phải xanh lại (KHÔNG thêm số học tiền vào CartLineRow — bất biến tiền của component giữ nguyên). OpenAPI regen (DTO đổi); `permissions.json` + registry ZERO-change. Negative assert mới PHẢI mutation-check (bẻ code thật → RED → revert `cp`).

## Tasks / Subtasks

- [x] Task 1: Backend — addLine ép null + DTO update (AC: #1, #2)
  - [x] `update-line-item-request.dto.ts`: field `warrantyMonths?: number | null` — `@IsOptional()` + `@ValidateIf(o => o.warrantyMonths !== null)` + `@IsInt()` + `@Min(1)`; ⚠️ KHÔNG dùng `IsOptionalNotNull` (doc decorator `is-optional-not-null.decorator.ts:14` nói rõ: null là giá trị hợp lệ cho warrantyMonths). Swagger `@ApiPropertyOptional({nullable: true})` mô tả rule công-lắp-bị-bỏ-qua.
  - [x] `orders.service.ts` `updateLine()` (L1297–1346): nhận `warrantyMonths` trong input type; build data: có mặt trong input VÀ KHÔNG PHẢI (dòng catalog `before.productId !== null && before.priceEditable`) → ghi; ngược lại bỏ qua im lặng. Phân biệt "không gửi" vs "gửi null" bằng `'warrantyMonths' in input` / `!== undefined` (khuôn partial hand-written hiện có).
  - [x] `orders.service.ts` `addLine()` L1259: `warrantyMonths: product.priceEditable ? null : product.warrantyMonths`. Dòng tự do L1276 giữ nguyên `null`.
  - [x] Cập nhật doc comment đầu `add-line-item-request.dto.ts` (L18–19 đang nói "copy warrantyMonths từ Product" — thêm vế trừ priceEditable).
- [x] Task 2: Backend — `confirm()` ghi `warrantyStartAt` (AC: #3)
  - [x] ⚠️ Vòng per-line trong tx lặp trên `lineSnapshots` (`for (const snap of lineSnapshots)` L668) — mảng này build ở L610–644 CHỈ mang `id`/`unitPriceSnapshot`/`catalogPriceSnapshot`, KHÔNG có `warrantyStartAt`. Bước 1: thêm `warrantyStartAt: line.warrantyStartAt` vào từng object khi build `lineSnapshots` (nguồn `lines` L578 là full row — đã có field). Bước 2: per-line update L668–676 += spread có điều kiện `...(snap.warrantyStartAt === null ? { warrantyStartAt: chotAt } : {})` — dùng hằng `chotAt` L646 (đồng bộ với `OrderVersion.chotAt`).
  - [x] Sửa comment schema `schema.prisma:397` ("null tới 4.9") → mô tả hành vi thật: "đóng băng = ngày dòng chốt lần đầu; revise copy as-is". KHÔNG migration (cột có sẵn từ `20260716000000_add_orders`), KHÔNG sửa `revise()`.
- [x] Task 3: OpenAPI regen (AC: #1, #6)
  - [x] `cd backend && npm run openapi:gen` (DTO update-line đổi shape); `openapi-drift.spec.ts` snapshot cập nhật nếu cần. `permissions.json` không đổi (drift-guard bắt).
- [x] Task 4: Backend tests (AC: #1–#3)
  - [x] `orders.service.spec.ts`: (a) addLine catalog priceEditable + product CÓ `warrantyMonths` (fixture MỚI — vd PHI_LAP có warrantyMonths 12 trong catalog) → line ghi `warrantyMonths: null` (assert payload create); (b) addLine catalog thường → copy như cũ (regression); (c) updateLine set 24 / set null / không gửi → payload đúng từng case (không gửi → data KHÔNG chứa key); (d) updateLine trên dòng công lắp gửi `warrantyMonths: 12` → payload KHÔNG chứa `warrantyMonths`, KHÔNG lỗi; (e) updateLine dòng tự do set 18 → ghi; (f) confirm lần đầu: MỌI line update chứa `warrantyStartAt` = ĐÚNG instance `chotAt` của version (assert cùng giá trị Date); (g) confirm bản update sau revise: fixture 1 dòng `warrantyStartAt: NGAY_BH` (đã có khuôn 4.6 L1496) + 1 dòng null → CHỈ dòng null nhận `warrantyStartAt`, dòng cũ payload KHÔNG chứa key (mutant "ghi đè mọi dòng" phải RED); (h) nhánh idempotent retry → không update nào.
  - [x] `orders.e2e.spec.ts`: PATCH line `warrantyMonths: 24` → 200 response `warrantyMonths: 24`; PATCH `warrantyMonths: null` → 200 null; PATCH `warrantyMonths: 0` và `-5` → 400 fieldErrors; PATCH dòng công lắp `warrantyMonths: 12` → 200 nhưng `warrantyMonths` vẫn null; sau chốt PATCH warranty → 409 (đóng băng); response GET không lộ `warrantyStartAt` (negative assert body).
  - [x] Fixtures unit/e2e có sẵn warranty fields (`PIN_580W.warrantyMonths: 144` L78, `DONG_CATALOG.warrantyStartAt: null` L107) — tái dùng.
- [x] Task 5: FE ports + fakes 2 nền tảng (AC: #1, #4)
  - [x] `orders-port.ts` `UpdateOrderLineInput` (L120–125) += `warrantyMonths?: number | null` (TS phân biệt vắng mặt vs null tự nhiên). ⚠️ Twin Dart KHÔNG dùng plain `int?` — `UpdateOrderLineInput` hiện tại (L174–186) là plain-nullable (`null` = "không gửi", fake L266 làm `?? before` = KEEP), tức KHÔNG gửi được `null` = "bỏ bảo hành" (AC #1 cần). Dùng khuôn SENTINEL tri-state của `UpdateOrderMetaInput` NGAY TRONG FILE (`orders_port.dart` L198–231, `kMetaFieldAbsent`): field `warrantyMonths` default sentinel — absent / số / null-clear.
  - [x] Fakes twin logic: `fake-orders-port.ts` `updateLine` (L197–215) += rule y backend (catalog priceEditable → bỏ qua; còn lại ghi kể cả null); `addLine` L175 += ép null theo `product.priceEditable`; mobile `fake_orders_port.dart` L213/L267 twin (updateLine xử sentinel 3 nhánh, KHÔNG `?? before` cho warrantyMonths; nhánh free-line ~L219–230 ghi tường minh `warrantyMonths: null` cho cân xứng web L187). KHÔNG mô phỏng `warrantyStartAt` trong fake (client không đọc — như 4.5 không mô phỏng freeze giá).
- [x] Task 6: CartLineRow twins + formatter (AC: #4, #5)
  - [x] Web `CartLineRow.tsx`: props mới — đề xuất `warrantyMonths: number | null`, `warrantyMode: 'input' | 'none' | 'link'` (screen derive: catalog priceEditable → `'none'`; tự do && null → `'link'`; còn lại → `'input'`), `warrantyEditable: boolean`, `onWarrantyChange?: (months: number | null) => void`; render: `'none'` → span muted `Không có`; `'link'` → nút text `+ Thêm bảo hành` (state cục bộ lật sang input); `'input'` && editable → bare input numeric commit-on-blur (component này là NƠI DUY NHẤT được bare input); read-only → text `formatWarrantyMonths(warrantyMonths)`. Export helper `formatWarrantyMonths` từ chính file component. ⚠️ Guard component (`behavior-components.test.mjs` L81) cấm `toFixed`/`toLocaleString`/mọi `*` trong CartLineRow — formatter chỉ dùng `%`/`/` + template string.
  - [x] Mobile `cart_line_row.dart` twin: cell mới theo khuôn `_numberCell` (L165–191); `~/ 12` cho năm; nhãn byte-identical.
  - [x] KHÔNG thêm variant Button mới (không có variant `link` — dùng text button/ghost sm hoặc GestureDetector text theo khuôn micro-link hiện có; đừng đụng `ButtonVariant`).
  - [x] Component tests hiện có (`behavior-components.test.mjs`, `components/parity.test.mjs`, mobile `invariant_guard_test.dart`) phải xanh lại; bổ sung assert twin formatter + nhãn nếu block component parity đòi.
- [x] Task 7: Web screen (AC: #4)
  - [x] `CreateQuoteScreen.tsx`: header bảng L625–631 += `<th>Bảo hành</th>` (vị trí khớp mockup: sau SL, trước Đơn giá); render `CartLineRow` L634–650 truyền 4 props mới (derive `warrantyMode` từ `line.productId`/`line.priceEditable` — LƯU Ý dòng tự do có `priceEditable=true` server-set, phân biệt công lắp bằng `productId !== null && line.priceEditable`); handler `handleWarrantyChange` khuôn `handleQtyChange` L272 (gọi `updateLine` → `setOrder`, lỗi → Banner pattern k). Form Dòng tự do (Sheet L963–1007) KHÔNG đổi.
  - [x] CSS nếu cần vào `orders.css` — 0 shadow/gradient, token (guard f).
- [x] Task 8: Mobile screen + widget tests (AC: #4)
  - [x] `create_quote_screen.dart`: truyền props mới vào `AppCartLineRow` (render L1029+) + handler `_updateWarranty` khuôn `_updateQty` L348. `_openFreeLineForm` KHÔNG đổi.
  - [x] `create_quote_screen_test.dart` += widget tests (khuôn test L483 "dòng priceEditable=false: sửa được SL nhưng KHÔNG có input đơn giá"): (a) dòng catalog thường editable → có input bảo hành, nhập 24 blur → fake nhận `updateLine` với `warrantyMonths: 24`; (b) dòng công lắp → thấy `Không có`, KHÔNG input bảo hành; (c) dòng tự do → thấy `+ Thêm bảo hành`, tap → input hiện, nhập 18 → port nhận 18; (d) port throw → Banner + giỏ nguyên; (e) read-only (đơn `dachot`) → text `2 năm` (fixture 24 tháng) không input. `ensureVisible` TRƯỚC tap; `dart format -o none --set-exit-if-changed` CHỈ file sửa.
- [x] Task 9: Guards design-system (AC: #6)
  - [x] `orders.test.mjs`: (e) += 3 nhãn byte-identical (`Bảo hành`, `+ Thêm bảo hành`, `Không có`); cân nhắc negative assert "màn KHÔNG tự format năm/tháng — chỉ gọi formatter" nếu viết sạch được; MỌI negative assert mới mutation-check (bẻ → RED → revert `cp`, KHÔNG `git checkout`).
  - [x] `parity.test.mjs` block 4.9: `warrantyMonths` trong cặp `UpdateOrderLineInput` twins + twin tokens `formatWarrantyMonths` (khuôn block 4.7/4.8).
  - [x] `cd design-system && npm test`. Guard quét TEXT kể cả comment — tránh chuỗi cấm (`shadow`/`gradient`/`* 8`/`0.08`/`Math.floor(`/`reduce(`/`~/ 100`) trong code LẪN comment; `% 12`/`~/ 12` KHÔNG bị cấm (đã kiểm guard hiện hành).
- [x] Task 10: Chạy lane + hồ sơ story (AC: tất cả)
  - [x] `cd backend && npm test` (hermetic, không cần Postgres/R2/Chromium); `cd mobile && flutter test && flutter analyze`; `cd design-system && npm test`. Baseline hiện tại: backend 946/946 (57 suite) · design-system 290/290 · mobile 193/193 — flake đã biết `customer-sources`/`customers`/`me.e2e`/`error-envelope`: đỏ không liên quan → rerun trước khi sửa.
  - [x] KHÔNG migration mới → DB lane không bắt buộc; action item 4.4 (migrate deploy thật) vẫn treo — nếu Docker khả dụng thì `npm run test:db` luôn thể, không lên thì ghi Debug Log, KHÔNG loay hoay.
  - [x] Tick tasks, điền Dev Agent Record + File List + Change Log (SAU QA phase — bài học 4.2/4.3).

## Dev Notes

### Quyết định spec đã chốt (đọc trước khi code — có thể veto)

- **`warrantyStartAt` ghi cho MỌI dòng null lúc chốt (kể cả dòng không bảo hành):** ngữ nghĩa cột = "ngày dòng này chốt lần đầu" (PRD FR-36 nguyên văn "đóng băng lúc DÒNG ĐÓ chốt lần đầu" — vô điều kiện). Hệ quả có chủ đích: dòng tự do chốt không bảo hành, sau đó bản update thêm `warrantyMonths` → hạn tính từ ngày dòng chốt ĐẦU (không phải ngày thêm bảo hành) — conservative cho công ty, nhất quán với quyết định PRD "mốc từ ngày chốt, khách mất phần chênh, Đại Ca chấp nhận". Điều kiện `warrantyMonths !== null` sẽ tạo ngữ nghĩa lai căng + thêm nhánh test — YAGNI.
- **KHÔNG expose `warrantyStartAt` ra API/port/view:** không màn nào Phase-1-tới-giờ hiển thị nó; 5.9 (tra cứu theo SĐT) là consumer đầu tiên và tự mở qua endpoint riêng của nó. Khuôn y hệt 4.5 giấu `chotAt`/`catalogPriceSnapshot`. E2e có negative assert body không lộ field.
- **Công lắp bị bỏ qua IM LẶNG, không 400:** §3 quyết định khách nguyên văn "KHÔNG viết validation chặn — chỉ để null, không hiện ô". UI không render input cho dòng này nên chỉ client lạ mới gửi field — giữ null là hàng rào đủ; 400 mới là vi phạm spec.
- **Phân biệt loại dòng — bẫy `priceEditable`:** dòng TỰ DO cũng có `priceEditable=true` (server ép lúc add — `orders.service.ts:1275`, fake web L187). Rule "không bảo hành" CHỈ áp cho catalog công lắp: `productId !== null && priceEditable`. Dòng tự do (`productId === null`) ĐƯỢC có bảo hành optional. Sai điều kiện này = dòng tự do mất link Thêm bảo hành — viết test bắt cả 2 phía.
- **`AddLineItemRequestDto` không thêm field:** UI không có chỗ nhập warranty lúc add (catalog picker không hỏi; form Dòng tự do giữ nguyên — mockup đặt link `+ Thêm bảo hành` trên ROW sau khi add, L1453). Một đường ghi duy nhất qua `updateLine` = ít DTO surface, ít test, đủ AC.
- **"Snapshot lúc chốt" cho `warrantyMonths` = `assertMutable`, không cột mới:** y nguyên quyết định 4.5 AC#3 — giá trị sống trên dòng từ lúc add/sửa, sau chốt mọi mutation 409; `revise()` copy nguyên sang version mới rồi bản mới lại sửa được. KHÔNG re-snapshot gì ở `confirm()` cho warrantyMonths.
- **Formatter 3 nơi một luật, KHÔNG chia sẻ code qua biên giới:** backend `formatWarranty` (quote-template) đã đúng luật từ 4.8 — không sửa, không import chéo; web/mobile mỗi bên một helper twin nhỏ (parity guard pin). Đây là format ĐƠN VỊ THỜI GIAN, không phải số học tiền — không vi phạm AD-16/guard h (đã đối chiếu regex guard: `* 8`, `0.08`, `Math.floor(`, `reduce(`, `~/ 100` — không cái nào khớp `% 12`/`~/ 12`).
- **Vị trí cột:** mockup s-quote xếp `Món / SL / Kho / Bảo hành / Đơn giá / Thành tiền` — cột Kho là Epic 6, chưa dựng → 4.9 chèn Bảo hành giữa SL và Đơn giá. Read-only null → rỗng (khớp báo giá PDF 4.8 null → rỗng); riêng công lắp giữ `Không có` muted mọi trạng thái (mockup L1573 ghi chú "không bảo hành" ngay trên dòng Công lắp).

### Hiện trạng code (đã scout 2 nhánh song song, tin được)

**Backend — 2 cột ĐÃ TỒN TẠI, KHÔNG migration:**
- `schema.prisma`: `OrderLineItem` L398–423 — `warrantyMonths Int?` L411, `warrantyStartAt DateTime?` L415, comment L397 "warrantyStartAt null tới 4.9"; cột tạo từ migration `20260716000000_add_orders` (SQL L69). `Product` L124–142: `priceEditable` L132, `warrantyMonths Int?` L133 (comment L123: nullable có chủ đích — công lắp không bảo hành).
- `orders.service.ts` (1464 dòng): `addLine` L1186–1294 — catalog copy `warrantyMonths: product.warrantyMonths` L1259 (điểm sửa AC #2), tự do `warrantyMonths: null` L1276 + `priceEditable: true` L1275 (⚠️ bẫy phân biệt loại dòng); `updateLine` L1297–1346 — data hiện chỉ `qty/unitPrice/note/isFlexible` L1327–1332 (điểm sửa AC #1), `unitPrice` gate `before.priceEditable` L1308–1322 (khuôn gate theo `before`); `assertMutable` L275; `confirm()` L544–704 — `chotAt = new Date()` L646, interactive tx L648–677, per-line update L668–676 CHỈ ghi 2 snapshot giá (điểm sửa AC #3); `revise()` L731+ — copy map L772–789 có `warrantyMonths: line.warrantyMonths` L783 + `warrantyStartAt: line.warrantyStartAt` L787, doc L714–717 ghi sẵn "4.9 chỉ đặt khi null lúc chốt" — ZERO sửa; `toViews` L1405–1463 trả `warrantyMonths` L1458, KHÔNG có `warrantyStartAt` trong `OrderLineView` (L114) — giữ nguyên; `PRODUCT_QUOTE_SELECT` L83–91 có `warrantyMonths: true`, KHÔNG costPrice — giữ nguyên.
- DTO: `add-line-item-request.dto.ts` L30–99 (doc L18–19 cần cập nhật vế priceEditable); `update-line-item-request.dto.ts` L20–52 — partial VIẾT TAY, "CẤM PartialType" L13–14; ⚠️ `IsOptionalNotNull` (catalog/dto) doc L14 CẤM dùng cho warrantyMonths — null là giá trị hợp lệ, dùng `@IsOptional` + `@ValidateIf(o => o.warrantyMonths !== null)` + `@IsInt` + `@Min(1)`; `order-line-item-response.dto.ts` L51–57 ĐÃ có `warrantyMonths` (mô tả sẵn "hành vi thuộc Story 4.9") — response không đổi shape.
- Event: `OrderLineSnapshot` (`order-events.ts:45`) có `warrantyMonths`, không `warrantyStartAt` — KHÔNG đổi (audit không cần mốc; YAGNI).
- `quote-template.ts`: `formatWarranty` L70–74 (null → '', %12 → "X năm", else "X tháng"), render cột L172 — 4.8 đã xong, KHÔNG sửa; công lắp sau 4.9 chắc chắn null → cột rỗng trên PDF, đúng PRD FR-21 L316.
- Testing: `orders.service.spec.ts` (2558 dòng) — hermetic mock repos L113–151, tx interactive mock L184–188, assert PAYLOAD từng op (doc L21–31); fixtures có sẵn `PIN_580W.warrantyMonths: 144` L78, `DONG_CATALOG.warrantyStartAt: null` L107; describe confirm L1142 (assert per-line update payload L1184+ — test mới AC#3 cắm vào đây), describe revise L1473 — fixture `warrantyStartAt: NGAY_BH` L1496 + assert copy-as-is L1585–1628 (nền cho test (g)). `orders.e2e.spec.ts` (2281 dòng) — app Nest thật + ValidationPipe thật (test 400 DTO chạy thật), Prisma mock, `givenPermissions(...)` L203. `npm run test:db` regex `\.db\.integration\.spec\.ts$` — story này không cần spec DB mới (không ràng buộc DB mới).

**FE — `warrantyMonths` ĐÃ chảy backend→port→line shape, chưa hiển thị/ghi được:**
- Web `orders-port.ts`: `OrderLine` L40–53 có `productId: string | null` L?, `priceEditable` L47, `warrantyMonths: number | null` L50 (đã nhận, chưa render); `UpdateOrderLineInput` L120–125 (điểm sửa — thêm field); `AddOrderLineInput` L109–117 KHÔNG đổi. Twin `orders_port.dart`: `OrderLine` L36–64 (warrantyMonths L47/61), `UpdateOrderLineInput` L174–186 (xem khuôn tri-state vắng-mặt-vs-null của `unitPrice`/`note` trong chính file).
- Fakes: web `fake-orders-port.ts` — addLine copy warranty L175, tự do `priceEditable: true` L186 + `warrantyMonths: null` L187, `updateLine` L197–215 (điểm sửa twin-rule); ⚠️ formula VAT L216–234 bị guard h.3 pin — ĐỪNG đụng vùng đó; mobile `fake_orders_port.dart` — copy L213, updateLine giữ warranty L267.
- Màn web `CreateQuoteScreen.tsx` (1029 dòng): header bảng L623–629 (Món/SL/Đơn giá/Thành tiền — chèn cột), `CartLineRow` render L634–650 (đã truyền `priceEditable={editable && line.priceEditable}` ~L641 — khuôn derive), handlers `handleQtyChange` L272 / `handleUnitPriceChange` L282 (khuôn cho `handleWarrantyChange`), form Dòng tự do L963–1007 KHÔNG đổi, commit-on-blur khuôn kWp L574–581.
- Màn mobile `create_quote_screen.dart` (1261 dòng): `AppCartLineRow` render L1029+, `_updateQty` L348 khuôn handler, `_openFreeLineForm` L772–838 KHÔNG đổi, khuôn Focus(onFocusChange) commit-on-blur L950–960. LƯU Ý: mobile là StatefulWidget + port tiêm (KHÔNG BLoC) — theo pattern repo, đừng du nhập bloc.
- Component twins: web `CartLineRow.tsx` (props L4–25, NƠI DUY NHẤT được bare `<input className="field">`; sub-line `flag`/`meta` L62–73 là khuôn text phụ); mobile `cart_line_row.dart` (`AppCartLineRow` props L22–71, `_numberCell` L165–191, cần `id` cho Dismissible key). Sửa 2 file này đụng: `design-system/components/parity.test.mjs`, `behavior-components.test.mjs`, mobile `invariant_guard_test.dart` (pin bất biến tiền của CartLineRow) — cập nhật, giữ bất biến.
- KHÔNG variant Button `link`: web `ButtonVariant = default|primary|accent|ghost|danger` (Button.tsx:6), mobile twin — đừng thêm variant (đụng component parity vô cớ); link `+ Thêm bảo hành` = text control nhỏ trong cell.
- KHÔNG helper format nào tồn tại client-side (zero Intl/NumberFormat trong web/src + mobile/lib — tiền đang render integer thô) — `formatWarrantyMonths` là helper format ĐẦU TIÊN, đặt trong file component CartLineRow mỗi bên, parity pin twin.
- Guards: `orders.test.mjs` (463 dòng) — (e) nhãn byte-identical L146–215 (điểm thêm 3 nhãn); money-math negatives L245–273 (`% 12`/`~/ 12` không khớp regex nào — đã đối chiếu); port-call reachability L114–127 (`updateLine` đã có — không thêm); status-literal ban (hằng import từ port). `parity.test.mjs` — twin-file map L24–45, block per-story L138/166/179 (khuôn block 4.9).
- Lanes baseline: backend 946/946 (57 suite) · design-system 290/290 · mobile 193/193 + analyze sạch.

### Bài học từ story trước (4.1–4.8)

- Assert PAYLOAD từng op (`where`/`data` — key VẮNG MẶT cũng phải assert), không đếm mock call; fixture CON SỐ PHÂN BIỆT.
- Mutant PHẢI compile; revert bằng `cp` backup, KHÔNG `git checkout` (story code chưa commit); negative assert guard mới mutation-check cả 2 nhánh.
- Widget test mobile BẮT BUỘC màn sửa (C-4) gồm error case; `ensureVisible` TRƯỚC tap; `dart format -o none --set-exit-if-changed <file>`.
- Lỗi thao tác → Banner + KHÔNG wipe giỏ (pattern k); KHÔNG success toast.
- OpenAPI regen sau đổi DTO; registry/permissions.json không đụng.
- Guard quét TEXT kể cả comment — đừng viết chuỗi cấm trong comment; regex brace `[^}]*` false-green với generic lồng — dùng `[\s\S]*?\n\}` nếu viết guard mới.
- MỘT timestamp cho một sự kiện — đừng `new Date()` hai lần (finding 4.8: occurredAt ≠ exportedAt).
- Backend lane flake đã biết (`customer-sources`/`customers`/`me.e2e`/`error-envelope`) — đỏ không liên quan thì rerun trước khi sửa.
- Docker Desktop không lên từ shell headless — DB lane không chạy được thì ghi Debug Log, không loay hoay.
- `resolve_customization.py` fail máy này (Python < 3.11) — merge workflow tay.
- Dev Agent Record điền SAU QA phase.

### Web research

Không thư viện/API mới — stack pin sẵn (NestJS 11.1.27, Prisma 7.8.0, React 19.2.7, Flutter 3.44). Story chỉ dùng cột DB có sẵn + class-validator decorators có sẵn. Gotcha ngôn ngữ duy nhất: Dart `/` trả double (`60 / 12 == 5.0`) — dùng `~/` cho hiển thị năm (đã ghi AC #5).

### Project Structure Notes

- File MỚI: **KHÔNG có** — story chỉ mở rộng file hiện hữu (không migration, không module, không route, không port method, không permission).
- File SỬA: `backend/prisma/schema.prisma` (CHỈ comment L397), `backend/src/orders/{orders.service.ts, dto/update-line-item-request.dto.ts, dto/add-line-item-request.dto.ts (doc)}`, `backend/openapi/openapi.json` (regen), `backend/test/{orders.service.spec.ts, orders.e2e.spec.ts, openapi-drift.spec.ts (nếu snapshot đổi)}`, `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts}`, `web/src/design-system/components/CartLineRow.tsx`, `web/src/screens/orders/CreateQuoteScreen.tsx` (+`orders.css` nếu cần), `mobile/lib/design_system/session/{orders_port.dart, fake_orders_port.dart}`, `mobile/lib/design_system/components/cart_line_row.dart`, `mobile/lib/screens/orders/create_quote_screen.dart`, `mobile/test/screens/orders/create_quote_screen_test.dart` (+ component test mobile nếu invariant guard đòi), `design-system/screens/orders.test.mjs`, `design-system/session/parity.test.mjs`, `design-system/components/parity.test.mjs` + `behavior-components.test.mjs` (nếu pin CartLineRow đổi).
- KHÔNG đụng: `revise()`/`toViews()` semantics (copy/read có sẵn đúng), `quote-template.ts`/`quote-export.service.ts` (4.8 xong), `order-totals.ts`/`line-amount.ts`/`price-resolution.ts`, `order-events.ts` (snapshot shape giữ nguyên), `permission-registry.ts` + `permissions.json` + PERM generated, `AddOrderLineInput` twins, form Dòng tự do 2 nền tảng, `ButtonVariant`/`AppButtonVariant`, formula fake bị h.3 pin, mọi thứ tra cứu bảo hành (5.9)/order detail (5.4)/kho (Epic 6).
- Naming: không file mới nên không đặt tên file; field/DTO tiếng Anh `warrantyMonths` (đã thống nhất toàn codebase); nhãn UI tiếng Việt byte-identical; KHÔNG mã story trong comment/test name (nói bất biến, không nói "4.9").

### Phạm vi để lại (tường minh — KHÔNG làm ở story này)

- (a) **Tra cứu bảo hành theo SĐT** + tính hạn còn lại + trạng thái Còn hạn/Sắp hết/Hết hạn = **Story 5.9** (consumer đầu tiên của `warrantyStartAt` — sẽ expose field khi đó).
- (b) **Hiển thị ngày bắt đầu/hết hạn bảo hành** trên màn chi tiết đơn = 5.4; trên báo giá PDF không có (mẫu thật chỉ có cột thời hạn).
- (c) **Phiếu yêu cầu bảo hành / vòng đời / nhắc sắp hết hạn** = Phase sau (PRD L517–518).
- (d) Cột Kho trong bảng giỏ hàng (mockup có) = Epic 6.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.9 L471–478] — 5 AC gốc; Epic 4 header L407–408; Story 4.5 L445 (warranty snapshot lúc chốt); Story 5.9 L540–545 (consumer tra cứu — KHÔNG làm); Epic 6 L598 (phụ thuộc ngược — không liên quan 4.9)
- [Source: prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-36 L467–476] — consequences testable: 2 cột, đóng băng theo DÒNG lúc chốt lần đầu + lý do version-mới-gia-hạn-oan, tháng int + format năm/tháng, công lắp null không ô không validation, tự do link ẩn, Phase 1 chỉ tra cứu, mốc-từ-ngày-chốt là quyết định có ý thức; L66+L105 (định nghĩa Dòng có trường Bảo hành); FR-21 L316 (cột Bảo hành PDF rỗng khi null — 4.8 đã làm)
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#§3 L89–100] — quyết định khách NGUYÊN VĂN (mốc theo dòng, công lắp "KHÔNG viết validation chặn", link "+ Thêm bảo hành", chấp nhận mất 3 tháng so nghiệm thu)
- [Source: ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-quote L1389–1465] — bảng dòng: cột Bảo hành, "12 năm"/"2 năm" mono, dòng Công lắp "Không có" muted + ghi chú "không bảo hành" L1573, dòng tự do link "+ Thêm bảo hành" L1453; L1888–1900 + L4478+ (s-order-detail/s-warranty-lookup — Epic 5, chỉ tham khảo)
- [Source: _bmad-output/implementation-artifacts/4-5-chot-don-snapshot-gia.md] — confirm() tx + cổng atomic + khuôn test payload; quyết định "warranty đóng băng = assertMutable, không cột mới"; "warrantyStartAt KHÔNG đụng (4.9)"
- [Source: _bmad-output/implementation-artifacts/4-8-xuat-chia-se-bao-gia-pdf-anh.md] — formatWarranty backend + bài học MỘT-timestamp + flake lanes + baseline 946/290/193
- [Source: backend/src/orders/orders.service.ts L646, L668–676, L714–717, L772–789, L1259, L1275–1276, L1297–1346] — điểm sửa chính xác + invariant comment "4.9 chỉ đặt khi null lúc chốt" viết sẵn từ 4.6

## Câu hỏi tồn đọng (không chặn dev — dev dùng mặc định đã ghi, Đại Ca trả lời khi rảnh)

1. **Mốc bảo hành khi thêm bảo hành SAU chốt lần đầu** (dòng tự do chốt không bảo hành → bản update thêm 12 tháng): mặc định hạn tính từ ngày dòng chốt ĐẦU (conservative, khớp PRD "mốc từ ngày chốt"). Nếu Đại Ca muốn "tính từ lần chốt có bảo hành đầu tiên" thì đổi điều kiện ghi thành `warrantyStartAt === null && warrantyMonths !== null` — nói trước khi 5.9 lên màn là được, dữ liệu tự đúng từ đó.
2. **Chữ "Không có" cho dòng công lắp ở trạng thái read-only**: mặc định giữ "Không có" mọi trạng thái (khớp mockup); các dòng khác null → rỗng. Veto được bằng một câu.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (claude-opus-4-8) — BMAD dev-story workflow

### Debug Log References

- **Backend lanes hermetic:** `backend/npm test` 959/959 (57 suite) — không cần Postgres/R2/Chromium. Flake `customer-sources`/`me.e2e` không xuất hiện lần chạy này.
- **DB lane KHÔNG chạy:** story không thêm migration/ràng buộc DB mới (2 cột `warrantyMonths`/`warrantyStartAt` có sẵn từ migration `20260716000000_add_orders`) → `npm run test:db` không bắt buộc; Docker headless không lên (bài học `db-lane-needs-docker-desktop-gui`) — không loay hoay.
- **Mutation-check (bẻ code thật → RED → revert `cp`):**
  - `confirm()` bỏ guard `snap.warrantyStartAt === null` (ghi đè mọi dòng) → test (g) re-chốt RED ✓
  - `addLine` bỏ ternary `product.priceEditable ? null` → test addLine công lắp RED ✓
  - `updateLine` bỏ guard `!warrantyLocked` → test updateLine công lắp RED ✓
  - `cart_line_row.dart` `~/ 12` → `/ 12` → parity guard `~/ 12` RED ✓
  - `cart_line_row.dart` đổi label render `+ Thêm bảo hành` → orders.test.mjs (e.2) RED (SAU khi sửa guard strip comment — false-green ban đầu do nhãn nằm trong comment; bài học `text-guard`) ✓
- **Widget test mobile bẫy tìm ô đúng:** dòng tự do có 3 TextField (SL/bảo hành/đơn giá) — `.last` bắt nhầm ô đơn giá; tìm ô bảo hành qua `find.bySemanticsLabel('Bảo hành (tháng)')`. Sheet dòng tự do cuộn trong 260px → `scrollUntilVisible` nút "Thêm dòng" (ensureVisible không đủ, tap miss).

### Completion Notes List

- **AC #1 (sửa bảo hành theo dòng):** DTO `warrantyMonths?: number | null` dùng `@IsOptional` + `@ValidateIf(o => o.warrantyMonths !== null)` + `@IsInt` + `@Min(1)` (KHÔNG `IsOptionalNotNull` — null là giá trị nghiệp vụ). `updateLine()` ghi có điều kiện: bỏ qua im lặng cho dòng công lắp (`before.productId !== null && before.priceEditable`), phân biệt "không gửi" (`!== undefined`) vs "gửi null".
- **AC #2 (ép null lúc addLine):** `addLine` catalog → `product.priceEditable ? null : product.warrantyMonths`; dòng tự do giữ `null`. Fake 2 nền tảng twin.
- **AC #3 (đóng băng warrantyStartAt):** `confirm()` — `lineSnapshots` giờ mang `warrantyStartAt`; per-line update spread có điều kiện ghi `chotAt` (CÙNG instance với `OrderVersion.chotAt` — một timestamp một sự kiện) CHỈ khi dòng còn null. `revise()` ZERO sửa (copy as-is có sẵn). Không expose ra response/port/view (5.9 tự mở).
- **AC #4/#5 (UI + format):** cột `Bảo hành` (web `<th>`, giữa SL và Đơn giá); `CartLineRow`/`AppCartLineRow` render 4 mode (input/none/link/read-only) qua props mới `warrantyMonths`/`warrantyMode`/`warrantyEditable`/`onWarrantyChange`. Helper twin `formatWarrantyMonths` ("X năm"/"X tháng"/rỗng) — Dart dùng `~/ 12`. Mobile dùng sentinel tri-state `kLineFieldAbsent` cho null-clear. Lỗi port → Banner, giỏ nguyên (bất biến k).
- **AC #6 (guards):** orders.test.mjs +1 block nhãn (strip comment), parity.test.mjs +1 block twin field/formatter, OpenAPI regen (shape update-line đổi). `permissions.json`/registry ZERO-change.
- **Lanes:** backend 959/959 · mobile 198/198 (+ flutter analyze sạch) · design-system 292/292. Baseline trước: 946/193/290 → +13 backend, +5 mobile, +2 design-system.

### File List

- `backend/prisma/schema.prisma` (comment `warrantyStartAt`)
- `backend/src/orders/dto/update-line-item-request.dto.ts` (field `warrantyMonths`)
- `backend/src/orders/dto/add-line-item-request.dto.ts` (doc comment)
- `backend/src/orders/orders.service.ts` (`addLine`/`updateLine`/`confirm` per-line snapshot)
- `backend/openapi/openapi.json` (regen)
- `backend/test/orders.service.spec.ts` (addLine/updateLine/confirm warranty cases)
- `backend/test/orders.e2e.spec.ts` (PATCH warranty e2e + chốt warrantyStartAt + GET không lộ)
- `web/src/design-system/session/orders-port.ts` (`UpdateOrderLineInput.warrantyMonths`)
- `web/src/design-system/session/fake-orders-port.ts` (addLine/updateLine warranty rule)
- `web/src/design-system/components/CartLineRow.tsx` (cột bảo hành + `formatWarrantyMonths`)
- `web/src/screens/orders/CreateQuoteScreen.tsx` (header `Bảo hành` + `handleWarrantyChange`)
- `mobile/lib/design_system/session/orders_port.dart` (`UpdateOrderLineInput` sentinel tri-state)
- `mobile/lib/design_system/session/fake_orders_port.dart` (addLine/updateLine warranty rule)
- `mobile/lib/design_system/components/cart_line_row.dart` (`_WarrantyCell` + `formatWarrantyMonths` + enum)
- `mobile/lib/design_system/components/components.dart` (export `AppWarrantyMode`/`formatWarrantyMonths`)
- `mobile/lib/screens/orders/create_quote_screen.dart` (props bảo hành + `_updateWarranty`)
- `mobile/test/screens/orders/create_quote_screen_test.dart` (5 widget test bảo hành)
- `design-system/screens/orders.test.mjs` (block nhãn bảo hành, strip comment)
- `design-system/session/parity.test.mjs` (block 4.9 twin field + formatter)

## Change Log

- 2026-07-17: Story 4.9 tạo bởi create-story workflow — ultimate context engine analysis hoàn tất (scout backend/FE song song + PRD FR-36 + §3 quyết định khách + mockup s-quote + bài học 4.1–4.8); validator fresh-context đối chiếu 40+ file:line refs với code thật, fix 2 bẫy (sentinel tri-state Dart cho null-clear, lineSnapshots không mang warrantyStartAt). KHÔNG migration — 2 cột có sẵn từ 4.1. Status: ready-for-dev.
- 2026-07-17: Dev-story hoàn tất 10 task. Backend: DTO `warrantyMonths` + `updateLine`/`addLine` ghi có điều kiện (công lắp bỏ qua im lặng) + `confirm()` đóng băng `warrantyStartAt` per-line (cùng instance `chotAt`). FE: cột Bảo hành 2 nền tảng, `CartLineRow` twin + `formatWarrantyMonths` (Dart `~/`), sentinel tri-state Dart cho null-clear. Guards: nhãn + parity twin, OpenAPI regen. 5 mutation-check qua (gồm sửa 1 false-green comment trong guard nhãn). Lanes: backend 959/959 · mobile 198/198 + analyze sạch · design-system 292/292. Status: review.
- 2026-07-17: Adversarial code review (auto-fix mode). Đối chiếu 6 AC + 10 task + File List với code thật và git: mọi AC IMPLEMENTED, mọi task [x] có bằng chứng, File List khớp git chính xác (19 file nguồn). Lanes chạy lại: backend 960/960 (57 suite) · mobile 199/199 + analyze sạch · design-system 292/292. Test AC#3 xác nhận identity `chotAt` (một timestamp một sự kiện) + mutant "ghi đè mọi dòng" RED; guard strip-comment + pin `~/ 12` + sentinel tri-state đều thật. 0 CRITICAL/HIGH/MEDIUM → không sửa code. 2 quan sát LOW (bất đối xứng sync input web vs `didUpdateWidget` mobile — không quan sát được lỗi vì warranty chỉ đổi qua chính input này; test/comment mang mã story — khớp quy ước codebase hiện hữu) không cần sửa. Status: done.
