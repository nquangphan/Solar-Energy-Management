---
baseline_commit: a0f2b96de6d57785782ae64fa2dea9e7778a1259
---

# Story 4.8: Xuất & chia sẻ báo giá (PDF + ảnh)

Status: done

## Story

As a người có quyền tạo báo giá,
I want xuất báo giá PDF/hình ảnh và chia sẻ qua native share,
so that gửi ngay cho khách qua Zalo tại hiện trường (FR-21).

## Acceptance Criteria

1. **Hạ tầng storage R2 (AD-3):** Module MỚI `backend/src/storage/` (spine L449): `StoragePort` abstract class làm DI token (khuôn EventBus — xem `events/event-bus.ts`) với `putObject(key, body: Buffer, contentType): Promise<void>` + `getObject(key): Promise<{body: Buffer, contentType: string}>` (không tìm thấy → throw NotFound domain error); adapter `R2StorageAdapter` dùng `@aws-sdk/client-s3` (`S3Client` với `region: 'auto'`, `endpoint: R2_ENDPOINT`, credentials từ env, **BẮT BUỘC `requestChecksumCalculation: 'WHEN_REQUIRED'` + `responseChecksumValidation: 'WHEN_REQUIRED'`** — SDK ≥3.729.0 mặc định CRC32 làm R2 trả lỗi `x-amz-checksum-algorithm not implemented`). Env MỚI: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. **App PHẢI boot và `npm test` PHẢI hermetic khi vắng toàn bộ env R2** — client S3 khởi tạo LAZY ở lần dùng đầu, thiếu env lúc dùng → lỗi message rõ ràng; KHÔNG fail-fast ở main.ts.
2. **Renderer + template MỘT nguồn (FR-21):** Port `QuoteRendererPort` (abstract class, sống `orders/quote/`): `render(html): Promise<{pdf: Buffer, image: Buffer}>`; adapter `PuppeteerQuoteRenderer`: browser singleton **lazy-launch ở lần render đầu** (KHÔNG launch trong constructor — hermetic test không được đụng Chromium), `page.setContent(html)` → `page.pdf({format: 'A4', printBackground: true})` + `page.screenshot({fullPage: true, type: 'png'})`, đóng browser ở `onModuleDestroy`. Template là **pure function** `buildQuoteHtml(data: QuoteTemplateData): string` tại `orders/quote/quote-template.ts` — unit-test được không cần browser. Nội dung theo **mẫu thật** (labels verbatim từ `docs/2. Thương mại/Báo giá thương mại.xlsx`, xem Dev Notes): header thông tin công ty + chỗ logo; title `BÁO GIÁ KIÊM ĐƠN ĐẶT HÀNG`; Số (`BG-` + 8 ký tự đầu orderId upper), Ngày (ngày xuất), `Hiệu lực đến` (= `validityNote`), `Công suất: {kWp} kWp`; 3 dòng tick phạm vi `Cung cấp thiết bị`/`Cung cấp thi công`/`Cung cấp vận chuyển` theo 3 cờ scope; thông tin khách (tên/SĐT/địa chỉ/MST từ `Customer`); bảng dòng cột `STT · Tên hàng · Đơn vị tính · Số lượng · Đơn giá · Thành tiền · Bảo hành` (**cột Bảo hành theo FR-21 + quyết định khách L200**: `warrantyMonths` chia hết 12 → "X năm", khác → "X tháng", null → rỗng); TỔNG CỘNG + dòng `Chiết khấu` (chỉ khi > 0) + VAT + tổng sau VAT; điều khoản thanh toán + TK ngân hàng (verbatim); khối chữ ký 2 cột `Người lập phiếu (Ký, họ tên)` / `Giám đốc (Ký, họ tên, đóng dấu)`. **Template ZERO số học tiền**: thành tiền dòng = `OrderLineView.amount` (server đã tính), totals = output `computeOrderTotals` — template chỉ FORMAT (dấu chấm ngàn kiểu `76.862.000`); response/template **KHÔNG chứa costPrice dưới bất kỳ dạng nào**. Font tiếng Việt bundle trong `backend/assets/fonts/` (Be Vietnam Pro Regular+SemiBold, OFL) embed base64 qua `@font-face` — render giống nhau trên mac dev lẫn VPS Linux.
3. **Endpoint Xuất (FR-21, AD-3, AD-18):** `POST /orders/:id/xuat-bao-gia` `@RequirePermissions(PERM.quotesCreateEdit)` `@HttpCode(200)`, service MỚI `QuoteExportService` (orders module — KHÔNG sửa `orders.service.ts`, giữ bất biến "đúng 2 dep" của nó): (a) load `OrdersService.get(id, tieredPricingEnabled)` (404 đơn ma tự có) + query `Customer` (tên/địa chỉ/MST) + version hiện hành (vatRate/vatMode/discountAmount snapshot); 0 dòng → 400 (khuôn confirm-empty-lines); (b) totals qua **`computeOrderTotals` (MỘT hàm — AD-16)**: `vatRate`/`applyVat` từ version snapshot khi đã chốt, else `Order.vatMode` + vatRate controller truyền từ settings (mirror cách `confirm()` resolve); `discountAmount` = `version.discountAmount` ?? (status ≠ `baogia` và approval mới nhất `cho_duyet`/`dong_y` → amount, else 0 — mirror `refreshTotals` FE 4.7); (c) `buildQuoteHtml` → `renderer.render` → `storage.putObject` ×2 với **key deterministic** `quotes/{orderId}/bao-gia.png` + `.pdf` (render mới ĐÈ file cũ — không rác R2) → upsert row `QuoteExport` (unique `orderId`) metadata `{orderVersionId, imageSize, pdfSize, fileName, createdByAccountId}` — **thứ tự: render → upload → upsert → publish**; fail ở bước nào dừng ở đó, KHÔNG event khi chưa thành công trọn vẹn; (d) publish `QuoteExported` qua EventBus (AD-18 — AuditSubscriber tự ghi, KHÔNG gọi audit trực tiếp). Response JSON metadata: `{orderId, orderVersionId, exportedAt, image: {fileName, size}, pdf: {fileName, size}}` — bytes KHÔNG nằm trong response này. `fileName` = `bao-gia-{orderId8}.png|.pdf` (khuôn mockup `bao-gia-BG-2048.png`).
4. **Endpoint Tải (proxy — AD-3):** `GET /orders/:id/bao-gia/anh` + `GET /orders/:id/bao-gia/pdf` `@RequirePermissions(PERM.quotesCreateEdit)` — backend **proxy stream** bytes từ R2 (KHÔNG presigned URL công khai — quyết định spec, xem Dev Notes; không public bucket): đọc `QuoteExport` row (chưa xuất → 404) → `storage.getObject` → trả đúng `Content-Type` (`image/png`/`application/pdf`) + `Content-Disposition: attachment; filename="..."`. Route là sub-resource của `:id` — không collision static-route; Swagger khai binary response (`@ApiOkResponse` schema `type: string, format: binary` + `@ApiProduces`). Thiếu quyền → 403; 401 fail-closed như mọi route.
5. **FE port 2 nền tảng + fakes:** `orders-port.ts` += type `QuoteExportFile {fileName, mimeType, bytes: Uint8Array}` / `QuoteExportFiles {image: QuoteExportFile, pdf: QuoteExportFile}` + method `exportQuote(orderId: string): Promise<QuoteExportFiles>` (chỉ nhận id — khớp khuôn parity confirmOrder, KHÔNG Input type rỗng). Twin `orders_port.dart`: `Future<QuoteExportFiles> exportQuote(String orderId)`, bytes `Uint8List` (import `dart:typed_data`). Fakes 2 nền tảng: trả bytes demo TĨNH (PNG 1×1 hardcode + `%PDF-1.4` minimal) + fileName từ orderId — **ZERO số học tiền trong fake path này** (guard h); đơn 0 dòng → throw (twin backend 400).
6. **UI 2 nền tảng (UX-DR-20, UX-DR-21, parity):** Nút `Chia sẻ báo giá` trên màn Tạo báo giá 2 nền tảng (hàng nút khu Chốt, Gate `quotesCreateEdit`, hiện khi order tồn tại VÀ `lineItems.length > 0`, MỌI trạng thái — FR-21 "sau Chốt và khi cần"), **KHÔNG ConfirmDialog** (share không phải hành động hệ quả tiền — UX-DR-20 native share đi thẳng): web handler `shareBusy` → `exportQuote(orderId)` → dựng `File` ×2 → `shareFiles({files: [image, pdf], title: fileName, fallbackDownload: true})` (component Story 1.6 — ưu tiên ảnh đứng TRƯỚC pdf trong mảng, fallback tự download ảnh khi trình duyệt không share file được); web thêm nút `Tải PDF` (outline, web-only): `exportQuote` → `shareFiles({files: [pdf], fallbackDownload: true})` (desktop unsupported → tải PDF). Mobile twin: `_shareBusy` → `exportQuote` → `XFile.fromData` ×2 (mimeType đúng) → `(widget.shareImpl ?? platformShareXFiles)(files, title: ...)` — screen nhận constructor param `AppShareFn? shareImpl` (khuôn injectable của `AppShareButton` — test không đụng platform channel); KHÔNG nút Tải PDF mobile (share sheet có sẵn Lưu ảnh/Drive). Lỗi port → Banner + state NGUYÊN (pattern k), user huỷ share sheet KHÔNG phải lỗi (share.ts đã nuốt AbortError / `AppShareResult.dismissed`). Widget test mobile BẮT BUỘC (C-4): (a) có quyền + ≥1 dòng → nút hiện, tap → fake port `exportQuote` gọi đúng 1 lần + `shareImpl` nhận đúng 2 file thứ tự [ảnh, pdf]; (b) thiếu `quotes.create_edit` → nút KHÔNG render; (c) 0 dòng → nút KHÔNG render; (d) port throw → Banner + state nguyên.
7. **Guards + parity + hồ sơ sinh:** `orders.test.mjs`: (c.2) += `exportQuote`; (e) += nhãn `Chia sẻ báo giá` (byte-identical 2 nền tảng); nhãn `Tải PDF` assert riêng nhánh web (web-only — đừng nhét vào mảng chung 2 nền tảng); guard h/h.2 tự áp lên code mới (bytes handling không phải số học tiền — nhưng tránh chuỗi cấm kể cả trong comment). `parity.test.mjs` block 4.8: cặp chữ ký `exportQuote` + twin type tokens (`QuoteExportFile`/`QuoteExportFiles`). `permissions.json` + registry **ZERO-change** (tái dùng `quotes.create_edit` — không key mới, không regen FE keys); OpenAPI regen (`npm run openapi:gen`) — `openapi-drift.spec.ts` cập nhật snapshot. Backend source-guards tự áp: handler mới có `@RequirePermissions`; `QuoteExportService` publish qua EventBus port (guard no-direct-side-effect); AuditSubscriber += mapping `QuoteExported`.
8. **Phạm vi để lại (tường minh — KHÔNG làm ở story này):** (a) **share link công khai cho khách** (mockup s-share "Chép link `pns.vn/bg/2048`") — KHÔNG có trong FR-21 consequences, mọi truy cập file vẫn sau JWT; khách nhận file qua Zalo/share, không qua link; (b) hợp đồng PDF = **7.3**, hoá đơn PDF = **7.5** — tái dùng `storage/` + khuôn renderer/template của story này (7.5 ghi "chia sẻ/download tương tự báo giá"); (c) module `attachments/` (đính kèm ảnh FR-23/24) = **5.5/5.6**; (d) đánh số báo giá chính thức "BG-xxxx" — không FR Phase 1, dùng `BG-{orderId8}`; (e) retention/dọn file R2 = vận hành (spine deferred); (f) push/noti khi xuất — không có trong noti matrix.

## Tasks / Subtasks

- [x] Task 1: Deps + assets (AC: #1, #2)
  - [x] `cd backend && npm i puppeteer @aws-sdk/client-s3` (puppeteer ^24 — tải Chromium ~170MB lúc install, chấp nhận; SDK S3 v3 mới nhất). KHÔNG lib nào khác (không sharp/pdfkit — một renderer duy nhất).
  - [x] Font: tải Be Vietnam Pro `Regular` + `SemiBold` TTF (google/fonts GitHub, OFL) vào `backend/assets/fonts/`; không tải được → dùng font-stack fallback + ghi Debug Log. Logo: template đọc `backend/assets/quote/logo.png` NẾU tồn tại (embed base64), KHÔNG có → render tên công ty dạng chữ (file logo thật chờ Đại Ca cung cấp — xem câu hỏi cuối story).
- [x] Task 2: Prisma schema + migration (AC: #3)
  - [x] `schema.prisma`: model `QuoteExport` → bảng `quote_exports`: `id String @id` (uuid tiền-sinh khuôn Order), `orderId String @unique` (**MỘT bộ file mới nhất mỗi Đơn** — upsert đè), `orderVersionId String`, `imageKey`/`pdfKey String`, `imageSize`/`pdfSize Int`, `fileName String`, `createdByAccountId String`, `createdAt`/`updatedAt` chuẩn; relation `Order`/`OrderVersion`/`Account` theo khuôn FK `DiscountApproval` (quan hệ đối ứng tên rõ trên Account); `@@index([orderVersionId])`.
  - [x] Migration offline `add_quote_exports`: `prisma migrate diff --from-schema ... --to-schema ... --script` (Prisma 7 KHÔNG còn `--from-schema-datamodel`); KHÔNG mã story trong tên migration.
- [x] Task 3: Module `storage/` (AC: #1)
  - [x] `storage/storage.port.ts` (abstract class `StoragePort` — DI token, khuôn `events/event-bus.ts`), `storage/r2-storage.adapter.ts` (S3Client lazy-init, checksum `WHEN_REQUIRED` ×2, `PutObjectCommand`/`GetObjectCommand`, `NoSuchKey` → domain NotFound), `storage/storage.module.ts` (provide + export), import vào `OrdersModule`.
  - [x] Doc comment đầu adapter: 4 env R2 + lý do checksum (SDK ≥3.729.0 vỡ R2) + không public bucket (AD-3).
- [x] Task 4: Template + renderer (AC: #2)
  - [x] `orders/quote/company-info.ts`: hằng thông tin công ty VERBATIM từ mẫu thật (Dev Notes) — tên, MST, 3 ĐC, điều khoản thanh toán, TK VIB, dòng nhà phân phối.
  - [x] `orders/quote/quote-template.ts`: `QuoteTemplateData` type + `buildQuoteHtml(data)` pure (escape HTML dữ liệu động!); helper format tiền dấu chấm ngàn + helper bảo hành ("X năm"/"X tháng"/rỗng); layout A4 theo mẫu (bảng viền nét — in trắng đen đẹp).
  - [x] `orders/quote/quote-renderer.port.ts` + `orders/quote/puppeteer-quote-renderer.ts` (lazy singleton, `onModuleDestroy` close; launch args `--no-sandbox` chỉ khi env `PUPPETEER_NO_SANDBOX=1` — VPS/container cần, mac dev không).
- [x] Task 5: `QuoteExportService` + controller + DTO + OpenAPI (AC: #3, #4)
  - [x] `orders/quote-export.service.ts`: deps `OrdersService` + `PrismaService` + `EventBus` + `StoragePort` + `QuoteRendererPort`; `exportQuote(actorAccountId, orderId, vatRatePercent, tieredPricingEnabled)` theo pipeline AC #3 (b)–(d); `getExportFile(orderId, kind: 'anh'|'pdf')` cho proxy. Doc đầu file: vì sao service riêng (orders.service giữ 2-dep), totals resolution rule.
  - [x] `order-events.ts`: event `QuoteExported` (actor, orderId, orderVersionId, fileName, occurredAt — KHÔNG cần before/after snapshot: export không đổi trạng thái đơn); `audit.subscriber.ts` += mapping (khuôn event hiện có).
  - [x] DTO: `quote-export-response.dto.ts` (shape AC #3). Controller += 3 route (AC #3, #4) — sub-resource `:id`, Swagger đủ 200/400/401/403/404 khuôn `chot`; 2 route GET binary (`@ApiProduces` + schema binary); vatRate/tier resolve per request như khuôn hiện có.
  - [x] Regen `npm run openapi:gen`; `permissions.json` KHÔNG đổi (drift-guard bắt).
- [x] Task 6: Backend tests (AC: #1–#4)
  - [x] `quote-template.spec.ts` (unit, MỚI): labels mẫu thật hiện diện (title, khối chữ ký 2 cột, tên công ty, MST); cột Bảo hành: 60 → `5 năm`, 18 → `18 tháng`, null → rỗng; tick scope đúng theo cờ; dòng Chiết khấu chỉ hiện khi > 0; số format `76.862.000`; escape HTML (tên khách chứa `<b>` không thành tag); **output KHÔNG chứa chuỗi `costPrice`**.
  - [x] `quote-export.service.spec.ts` (unit, MỚI — mock 5 dep): happy path assert PAYLOAD từng bước (renderer nhận html chứa số totals ĐÚNG từ `computeOrderTotals` với CON SỐ PHÂN BIỆT — subtotal 10_000_000, discount 1_000_000, rate 8 → VAT 720_000 xuất hiện trong html, mutant bỏ discount lộ ngay; putObject ×2 đúng key + contentType; upsert đúng where/create/update; publish `QuoteExported` SAU upsert — thứ tự `['render','put','put','write','publish']`); 0 dòng → 400 KHÔNG render; storage throw → propagate, KHÔNG upsert KHÔNG event; renderer throw → KHÔNG putObject; totals rule: đơn đã chốt dùng version snapshot vatRate/discount, đơn `baogia` dùng settings rate + discount 0.
  - [x] `orders.e2e.spec.ts`: override providers `StoragePort` (in-memory Map) + `QuoteRendererPort` (stub trả `Buffer.from('%PDF-1.4 stub')` + PNG magic bytes) trong testing module — **e2e KHÔNG đụng Chromium/R2**; 401 loop += 3 route mới; 403 thiếu `quotes.create_edit`; flow: tạo → add line → POST xuat-bao-gia (200 metadata đúng fileName/size) → GET anh (200, `content-type: image/png`, bytes magic PNG) → GET pdf (200, `application/pdf`, prefix `%PDF`) → audit có `QuoteExported`; đơn CHƯA xuất → GET 404; đơn 0 dòng → POST 400; xuất LẦN HAI → 200, vẫn MỘT row QuoteExport (upsert), key không đổi.
  - [x] DB-lane spec MỚI `quote-exports.db.integration.spec.ts` (tự skip khi vắng DATABASE_URL): FK P2003 orderId ma (assert message — bài học Prisma 7), unique orderId (upsert 2 lần = 1 row).
- [x] Task 7: FE ports + fakes 2 nền tảng (AC: #5)
  - [x] `orders-port.ts` += types + `exportQuote`; twin `orders_port.dart` (`dart:typed_data`). Fakes: bytes demo tĩnh (PNG 1×1 + `%PDF-1.4` minimal — hardcode mảng byte, KHÔNG lib), fileName `bao-gia-{id8}`, 0 dòng → throw `OrderPortError`/`OrderPortException`.
- [x] Task 8: Web UI (AC: #6)
  - [x] `CreateQuoteScreen.tsx`: state `shareBusy`; nút `Chia sẻ báo giá` + nút `Tải PDF` (hàng nút khu Chốt, Gate `PERMISSION_KEYS.quotesCreateEdit`, điều kiện `order && order.lineItems.length > 0`); handlers gọi `exportQuote` → `new File([bytes], fileName, {type: mimeType})` → `shareFiles` (import từ design-system barrel — component 1.6, KHÔNG tự viết download/navigator.share); lỗi → Banner pattern k, KHÔNG wipe order.
- [x] Task 9: Mobile UI + widget tests (AC: #6)
  - [x] `create_quote_screen.dart`: `_shareBusy` (khuôn `_chotBusy` L88), nút `Chia sẻ báo giá` (AppGate `AppPermissionKeys.quotesCreateEdit`), constructor param `AppShareFn? shareImpl`; handler `exportQuote` → `XFile.fromData(bytes, mimeType: ..., name: fileName)` ×2 → share [ảnh, pdf]; `ensureVisible` TRƯỚC tap trong test.
  - [x] `create_quote_screen_test.dart` += 4 case AC #6 (recording share fn + recording/rejecting port — tái dùng khuôn `_Recording*Port`); `dart format -o none --set-exit-if-changed` CHỈ file đã sửa.
- [x] Task 10: Guards design-system (AC: #7)
  - [x] `orders.test.mjs`: (c.2) += `exportQuote`; (e) += `Chia sẻ báo giá`; assert web-only `Tải PDF` (nhánh riêng, KHÔNG mảng chung); negative assert mới PHẢI mutation-check (bẻ code thật → RED → revert bằng `cp`, KHÔNG `git checkout`).
  - [x] `parity.test.mjs`: block 4.8 — cặp chữ ký `exportQuote(orderId: string): Promise<QuoteExportFiles>;` ↔ `Future<QuoteExportFiles> exportQuote(String orderId);` + twin tokens `QuoteExportFile`/`QuoteExportFiles` (khuôn block 4.7 L196–233).
  - [x] `cd design-system && npm test`. Guard quét TEXT kể cả comment — tránh chuỗi cấm (`shadow`/`gradient`/`* 8`/`0.08`/`Math.floor(`/`reduce(`/cụm `price * qty`) trong màn + comment.
- [x] Task 11: Chạy lane + hồ sơ story (AC: tất cả)
  - [x] `cd backend && npm test` (hermetic — PHẢI xanh không cần R2/Chromium/Postgres); `cd mobile && flutter test && flutter analyze`; `cd design-system && npm test`.
  - [x] Story CÓ migration mới → DB lane `npm run test:db` NÊN chạy; Docker Desktop headless thường KHÔNG lên (bài học 4.4–4.7) → không lên: ghi rõ "lane chưa chạy" trong Debug Log, KHÔNG loay hoay. Render thật (Puppeteer) chạy tay 1 lần nếu tiện (script nhỏ hoặc bật server local) — không bắt buộc lane.
  - [x] Tick tasks, điền Dev Agent Record + File List + Change Log (SAU QA phase — bài học 4.2/4.3).

## Dev Notes

### Quyết định spec đã chốt (đọc trước khi code — có thể veto)

- **MỘT template HTML → Puppeteer render CẢ PDF lẫn PNG:** yêu cầu cốt lõi là PDF *và* ảnh từ CÙNG layout (ưu tiên ảnh khi share — UX-DR-21); hai renderer riêng (pdfkit + canvas) = hai layout drift + tự xử font tiếng Việt hai lần. Puppeteer nặng (Chromium) nhưng NFR-10 "solo dev, ít phức tạp" nghiêng về MỘT đường render dễ bảo trì; ~20 user nội bộ, render 1–2s/lần chấp nhận (SM-2 "ra báo giá trong buổi khảo sát" vẫn thừa). Browser singleton lazy — hermetic test không bao giờ chạm.
- **Đọc file qua PROXY JWT, KHÔNG presigned URL công khai:** AD-3 cho phép cả hai ("signed URL hoặc proxy"). Chọn proxy vì: auth model giữ NGUYÊN một khối (JWT + permission guard mọi request — AD-4), không mở bề mặt URL sống-ngoài-auth, không xử expiry/rotate. 20 user nội bộ — stream qua Nest không là vấn đề. Mockup "Chép link `pns.vn/bg/2048`" là share-link công khai cho khách — KHÔNG có trong FR-21 consequences → seam để lại (AC #8a).
- **MỘT bộ file mới nhất mỗi Đơn (`QuoteExport` unique orderId, key deterministic, đè):** "bấm Xuất" lần n phản ánh nội dung HIỆN TẠI của đơn (trước chốt giá còn sống — cache theo version là SAI trước chốt); giữ mọi bản xuất cũ = rác R2 vô chủ + không FR nào cần lịch sử file (lịch sử bản update là 5.4, retention R2 là deferred vận hành). Upsert + đè key = idempotent-ish, không rác.
- **Quyền: tái dùng `quotes.create_edit`, KHÔNG key mới:** ma trận PRD L256–277 không có quyền xuất/chia sẻ riêng; persona story = "người có quyền tạo báo giá"; thêm key = đụng registry + regen 2 nền tảng + preset — vô cớ. Registry ZERO-change (khuôn 4.7).
- **`QuoteExportService` riêng, `orders.service.ts` ZERO sửa:** orders.service doc L48–75 tuyên bố bất biến "đúng 2 dependency (Prisma + EventBus)". Export cần thêm Storage + Renderer + OrdersService → service riêng trong cùng module orders (spine map FR-21 → `orders/` + `storage/`). Load đơn qua `OrdersService.get()` public (per-line snapshot-first resolve + discount view có sẵn — KHÔNG tự viết resolve thứ hai).
- **Totals trên báo giá = `computeOrderTotals` (AD-16) với resolution rule tường minh:** đã chốt → version snapshot (`vatRate`/`vatMode`/`discountAmount` trên `OrderVersion`); chưa chốt → `Order.vatMode` + vatRate settings per request + discount của approval hiệu lực khi status ≠ `baogia` (mirror `refreshTotals` FE 4.7 — thứ khách thấy trên màn = thứ in ra giấy). KHÔNG máy tính thứ hai; template chỉ format.
- **Event `QuoteExported` KHÔNG mang before/after snapshot:** export không đổi `Order.status` — không phải transition, không đụng AD-11; chỉ cần (actor, orderId, orderVersionId, fileName, occurredAt) cho audit "ai xuất gì lúc nào". Share phía client là hành động OS (không backend call) → không audit share — đúng phạm vi kiểm soát được.
- **Số báo giá `BG-{orderId8}`:** mẫu thật có ô "Số: BG0000" nhưng KHÔNG FR nào định nghĩa bộ đếm báo giá Phase 1; orderId là định danh thật duy nhất. 8 ký tự đầu UUID upper đủ phân biệt trong giao tiếp với khách. Đánh số chính thức = seam (AC #8d).
- **Thông tin công ty = hằng verbatim trong `company-info.ts`, KHÔNG SystemSetting mới:** AC không đòi cấu hình được; YAGNI — đổi thông tin = sửa hằng (hiếm). Đã trích VERBATIM từ mẫu thật (`docs/2. Thương mại/Báo giá thương mại.xlsx` → sharedStrings.xml):
  - Tên: `CÔNG TY TNHH GIẢI PHÁP NĂNG LƯỢNG MẶT TRỜI PHƯƠNG NAM`
  - `Mã số thuế: 3702893374`
  - `ĐC: 61/4C Đường Bùi Thị Xuân, KP Tân Phước, Phường Tân Đông Hiệp, TP Hồ Chí Minh, Việt Nam`
  - `ĐC Văn phòng đại diện: Khu phức hợp Charm city, Tầng 3 A01-03, số 115 đường DT 743C ,kp thống nhất, phường Dĩ An, TP HCM` (giữ nguyên chính tả gốc)
  - `ĐC Kho chính: 67 Đường số 9, Tân Đông Hiệp, Hồ Chí Minh, Việt Nam.`
  - Title: `BÁO GIÁ KIÊM ĐƠN ĐẶT HÀNG` · Cột: `STT · Tên hàng · Đơn vị tính · Số lượng · Đơn giá · Thành tiền` (+ `Bảo hành` MỚI) · `TỔNG CỘNG`
  - `Điều khoản thanh toán: thanh toán 100% xuất hàng tại kho`
  - `TK THANH TOÁN:` / `1. CÔNG TY: Tên TK: CÔNG TY TNHH GIẢI PHÁP NĂNG LƯỢNG MẶT TRỜI PHƯƠNG NAM : 123 222 039 tại Ngân hàng VIB - Chi Nhánh Dĩ An, Bình Dương`
  - Chữ ký: `Người lập phiếu` `(Ký, họ tên)` / `Giám đốc` `(Ký, họ tên, đóng dấu)`
  - Footer: `PHƯƠNG NAM SOLAR HIỆN LÀ NHÀ PHÂN PHỐI CHÍNH THỨC DÒNG SẢN PHẨM TẤM PIN CANADIAN THƯƠNG HIỆU CANADA, THORNOVA THƯƠNG HIỆU USA, JA THƯƠNG HIỆU JA SOLAR, AE THƯƠNG HIỆU AE SOLAR ĐỒNG THỜI LÀ ĐƠN VỊ BẢO HÀNH  EJOR, SAJ TẠI VIỆT NAM.`
  - Mẫu còn các ô `Tên khách hàng:`/`Ngày:`/`Số:`/`Hiệu lực đến`/`Loại tiền` `VNĐ`/`Công suất: ... kWp`/`Cung cấp thiết bị`/`Cung cấp thi công`/`Cung cấp vận chuyển`/`Địa chỉ:`/`Mã số thuế:`/`Điện thoại:` — map thẳng vào metadata Đơn (kWp, validityNote, 3 cờ scope) + Customer.
- **Nút hiện MỌI trạng thái khi ≥1 dòng:** FR-21 "Sau Chốt (và khi cần)" — trước chốt vẫn xuất được (báo giá nháp đưa khách xem); 0 dòng vô nghĩa → ẩn nút (backend vẫn 400 làm hàng rào thật — UI ẩn chỉ là UX, AD-4).
- **KHÔNG dialog xác nhận cho share:** UX-DR-20 phân loại native share = bottom sheet/đi thẳng, dialog chỉ cho hành động hệ quả tiền/dữ liệu. Export không đổi dữ liệu đơn.
- **Copy mockup STALE — bỏ:** panel web "Gửi Zalo/Email" như nút riêng + "Chép link" (s-share L2918–2927) — web dùng `shareFiles` (native share nếu có, fallback download) + `Tải PDF`; grid app share là việc của OS sheet, không tự vẽ (comment ShareButton L19–21 đã nói).

### Hiện trạng code (đã scout 3 nhánh song song, tin được)

**Backend — CHƯA CÓ GÌ về file/PDF/R2 (dựng mới toàn bộ):**
- `package.json`: KHÔNG pdf/image/S3 lib nào; deps NestJS 11.1.27 + Prisma 7.8.0 + argon2/class-validator/libphonenumber; script `test:db` regex `\.db\.integration\.spec\.ts$` (jest chính ignore).
- KHÔNG module storage/attachments/files; KHÔNG env R2 (env hiện đọc: JWT_ACCESS_SECRET, PORT, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, PASSWORD_RESET_*, DATABASE_URL); KHÔNG static-serving/multipart/CORS trong main.ts; KHÔNG cơ chế signed/proxy nào.
- JWT + Permissions guard áp TOÀN CỤC qua `APP_GUARD` (auth.module.ts L51–52) — route mới tự được bảo vệ, chỉ cần `@RequirePermissions`.
- `orders.controller.ts`: 12 route; khuôn resolve per request: `tieredPricingEnabled()` L72–74, vatRate `await this.settings.vatRatePercent()` (L126, L262), quyền phụ qua `accountPermissions.listForAccount` L152–154; static-route-trước-`:id` comment L102/L134; constructor 4 dep L65–70 (+= QuoteExportService).
- `orders.service.ts`: doc bất biến 2-dep L48–75 — KHÔNG SỬA FILE NÀY; `get(id, tieredPricingEnabled)` public L398 trả `OrderView` = Order & {lineItems: OrderLineView[] (có `amount` server-tính), discount: OrderDiscountView|null} (L104–137) — KHÔNG totals trong view; `PRODUCT_QUOTE_SELECT` L83–91 cố ý loại costPrice.
- `order-totals.ts`: `computeOrderTotals` L37–50, input `{lines: {unitPrice, qty}[], vatRate, applyVat, discountAmount?}`, output `{subtotal, discountAmount, vatAmount, total}` — MỘT điểm làm tròn `Math.floor((vatBase * vatRate + 50) / 100)`.
- `order-events.ts`: 10 event; khuôn event KHÔNG-transition đơn giản nhất xem `DiscountRequested` L180 (bỏ before/after cho QuoteExported — xem Quyết định); `audit.subscriber.ts` map event→audit row (`Prisma.JsonNull` cho null).
- Prisma models liên quan: `Order` L329–358 (customerSdt, currentVersionId, 3 cờ scope, kWp `k_wp` Float?, vatMode, validityNote), `OrderVersion` L365–382 (vatRate, vatMode, chotAt, discountAmount), `OrderLineItem` L395–420 (name/unit/qty/unitPrice/warrantyMonths/unitPriceSnapshot/displayOrder…), `Customer` L292–309 (PK `sdt`, name, address, taxCode), `DiscountApproval` L432 (khuôn FK/relation cho QuoteExport). Migration mới nhất: `20260717020000_add_discount_approvals`.
- `permission-registry.ts`: 21 key — `quotesCreateEdit = 'quotes.create_edit'` dùng cho MỌI route orders trừ chot/duyệt; KHÔNG key export.
- Guard `no-direct-side-effect-outside-eventbus.spec.ts`: cấm import firebase-admin ngoài notifications/ + cấm tham chiếu `AuditService`/`AuditSubscriber` ngoài audit/ — QuoteExportService publish qua `EventBus` là lối đi.
- Testing: `orders.e2e.spec.ts` — `givenPermissions(...keys)` L168–170 mock AccountPermissionsService; AuditSubscriber THẬT chạy trong e2e (audit assert được); txMock spec khuôn L129–136. Flake đã biết: `customer-sources`/`customers`/`me.e2e`/`error-envelope` — đỏ không liên quan thì rerun trước khi sửa.

**FE — hạ tầng share ĐÃ CÓ SẴN từ Story 1.6/1.7 (KHÔNG tự viết lại):**
- Web `design-system/components/share.ts`: `shareFiles({files, title, text, fallbackDownload}): Promise<'shared'|'downloaded'|'unsupported'>` — ưu tiên `navigator.canShare/share`, AbortError (user huỷ) nuốt trả 'shared', fallback download FILE ĐẦU TIÊN qua createObjectURL; comment L13–16: caller sắp `[image, pdf]`. `ShareButton.tsx` là trigger files-upfront — màn 4.8 export async rồi share nên gọi HÀM `shareFiles` trực tiếp (barrel export index.ts L81–82).
- Mobile `share_button.dart`: `AppShareFn` typedef injectable (L16–20), `platformShareXFiles` (share_plus `Share.shareXFiles`, files rỗng→unsupported, dismissed→dismissed, throw→unsupported KHÔNG ném ra ngoài); `pubspec.yaml` ĐÃ có `share_plus: ^10.1.4` + `image_picker: ^1.1.2`; barrel `components.dart` L38/L48 (re-export XFile).
- `orders-port.ts` (331 dòng): 13 method, hằng + types 4.7 đủ; twin `orders_port.dart` (443 dòng) y hệt; `OrderPortError {message, fieldErrors}` / `OrderPortException`. KHÔNG method export/share nào — `exportQuote` là method 14.
- Fakes: web `fake-orders-port.ts` (375 dòng — formula VAT L216–234 bị guard h.3 pin, ĐỪNG đụng), mobile twin; KHÔNG file/bytes handling nào hiện có.
- `CreateQuoteScreen.tsx` (947 dòng): hàng nút `quote-chot-row` L649–710 (Áp chiết khấu/Chốt L649–672, Chốt sau duyệt L677–691, Mở lại L697–710) — nút share vào khu này; busy pattern L100–120; `editable` L470; helpers `messageOf`/`fieldErrorsOf` cuối file. Màn orders chỉ có CreateQuote + DiscountApproval — KHÔNG màn OrderDetail (5.4) → share gắn vào CreateQuoteScreen.
- Mobile `create_quote_screen.dart` (1196 dòng): busy `_chotBusy` L88 khuôn; hàng nút L1084–1147; perms inject qua `widget.perms` L43/L55; test helpers `_screen({perms})`, `_tap` (ensureVisible sẵn), khuôn `_Recording*Port`/`_Rejecting*Port`.
- Permission keys generated: web `gating/permission-keys.generated.ts` L9–31 (LƯU Ý: thư mục `gating/`, không phải session/) + mobile `gating/app_permission_keys.g.dart` — 21 key có `quotesCreateEdit`; ghost-key scanner tự quét màn.
- Guards: `orders.test.mjs` 456 dòng — (c.2) L114–127 port-method list (regex `ordersPort[\s\S]{0,60}?\.${call}\(`); (e) L146–208 mảng nhãn; (g) L225–231 cấm permission literal; (h) L238–252 + (h.2) L258–267 + (h.3) L276–311 formula pin fake; (n) L420–434 cấm `'dachot'`/`'choduyet'`; (k) L438–456 catch-reset. `parity.test.mjs` 298 dòng — twin-file map L24–39; block 4.7 L196–233 là khuôn block 4.8; khuôn "method chỉ nhận id" L172–176. `behavior-components.test.mjs` + `components/parity.test.mjs` L217/L235 đã cover ShareButton/share.ts — KHÔNG đụng trừ khi sửa component (đừng sửa).
- Lanes hiện tại: backend **905/905** (54 suite) · design-system **289/289** · mobile **189/189** — baseline, mọi thứ phải xanh lại + test mới.

### Bài học từ story trước (4.1–4.7)

- Assert **payload từng op** (where/data/args), không đếm mock call; test thứ tự pipeline (`['render','put','put','write','publish']`); fixture CON SỐ PHÂN BIỆT (VAT-sau-discount ≠ VAT-không-discount).
- Mutant PHẢI compile; revert bằng `cp` backup, KHÔNG `git checkout` (story code chưa commit); negative assert guard mới PHẢI mutation-check cả 2 nhánh.
- Widget test mobile BẮT BUỘC mọi màn sửa (C-4) gồm error case; `ensureVisible` TRƯỚC tap; `dart format -o none --set-exit-if-changed <file>` (mặc định GHI đè hàng loạt).
- Lỗi thao tác → Banner + KHÔNG wipe order/giỏ (guard k); KHÔNG success toast.
- OpenAPI regen sau đổi route; permissions.json KHÔNG đổi story này — đừng đụng registry.
- Guard quét TEXT kể cả comment — tránh chuỗi cấm trong comment; regex brace `[^}]*` false-green với generic lồng — dùng `[\s\S]*?\n\}`.
- Prisma 7: migrate diff dùng `--from-schema/--to-schema`; P2003 (FK) chỉ trên INSERT và là DriverAdapterError không tag — assert message; nullable Json → `Prisma.JsonNull`.
- Docker Desktop headless không lên từ shell agent — DB lane không chạy được thì viết spec sẵn + ghi Debug Log, KHÔNG loay hoay.
- `resolve_customization.py` fail trên máy này (Python < 3.11) — merge workflow tay.
- Dev Agent Record điền SAU QA phase.

### Web research (đã xác minh 2026-07-17)

- **Puppeteer** (^24, npm `puppeteer`): chuẩn hiện hành cho HTML→PDF server-side — `page.setContent(html)` → `page.pdf({format: 'A4', printBackground: true})`; screenshot PNG cùng page. Install tải Chromium ~170MB. VPS Linux cần system libs Chromium (`apt` deps) + thường cần `--no-sandbox` trong container — gate bằng env `PUPPETEER_NO_SANDBOX` (mac dev không cần). Nguồn: pptr.dev/guides/pdf-generation.
- **@aws-sdk/client-s3 v3 + R2 — GOTCHA BẮT BUỘC XỬ:** từ 3.729.0 SDK mặc định gắn CRC32 checksum mà R2 chưa hỗ trợ → PutObject fail `Header 'x-amz-checksum-algorithm' ... not implemented`. Fix chính thức (Cloudflare docs): config S3Client `requestChecksumCalculation: 'WHEN_REQUIRED'` + `responseChecksumValidation: 'WHEN_REQUIRED'`. R2 endpoint `https://<account_id>.r2.cloudflarestorage.com`, `region: 'auto'`. Nguồn: developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3.
- Font Be Vietnam Pro: OFL, đủ glyph tiếng Việt, tải TTF từ repo google/fonts.

### Project Structure Notes

- File MỚI: `backend/prisma/migrations/<ts>_add_quote_exports/migration.sql`, `backend/src/storage/{storage.port.ts, r2-storage.adapter.ts, storage.module.ts}`, `backend/src/orders/quote/{company-info.ts, quote-template.ts, quote-renderer.port.ts, puppeteer-quote-renderer.ts}`, `backend/src/orders/quote-export.service.ts`, `backend/src/orders/dto/quote-export-response.dto.ts`, `backend/assets/fonts/*.ttf` (+ `backend/assets/quote/logo.png` nếu có file thật), `backend/test/{quote-template.spec.ts, quote-export.service.spec.ts, quote-exports.db.integration.spec.ts}`.
- File SỬA: `backend/package.json` (+2 dep), `backend/prisma/schema.prisma`, `backend/src/orders/{orders.module.ts, orders.controller.ts, domain/order-events.ts}`, `backend/src/audit/audit.subscriber.ts`, `backend/openapi/openapi.json` (regen), `backend/test/{orders.e2e.spec.ts, openapi-drift.spec.ts, audit.subscriber.spec.ts}`, `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts}`, `web/src/screens/orders/CreateQuoteScreen.tsx` (+`orders.css` nếu cần), `mobile/lib/design_system/session/{orders_port.dart, fake_orders_port.dart}`, `mobile/lib/screens/orders/create_quote_screen.dart`, `mobile/test/screens/orders/create_quote_screen_test.dart`, `design-system/screens/orders.test.mjs`, `design-system/session/parity.test.mjs`.
- KHÔNG đụng: `orders.service.ts` + `order-totals.ts` + `order-status.ts` + `assertMutable`/`toViews` (zero-change), `permission-registry.ts` + `permissions.json` + 2 file generated keys, `share.ts`/`ShareButton.tsx`/`share_button.dart` (component 1.6 dùng nguyên), formula fake bị h.3 pin, `StatusChip`, mọi thứ attachments/contracts/invoices/noti (5.x/7.x/9.x).
- Naming: route `/orders/:id/xuat-bao-gia`, `/orders/:id/bao-gia/anh`, `/orders/:id/bao-gia/pdf` (khuôn sub-resource tiếng Việt `chot`/`mo-lai`/`ap-chiet-khau`); bảng `quote_exports` snake_case số nhiều; code/method/event tiếng Anh `exportQuote`/`getExportFile`/`QuoteExported`; object key `quotes/{orderId}/bao-gia.{png|pdf}`; KHÔNG mã story trong tên migration/test/comment.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.8 L464–469] — 3 AC gốc; Epic 4 header L407–408; FR-21 restatement L40; UX-DR-19 L116, UX-DR-20 L117, UX-DR-21 L118; FR Coverage Map L136; Story 1.6 L232–238 (share behavior đã dựng); seam 7.3 L623–628 + 7.5 L636–640 ("chia sẻ/download tương tự báo giá" — 4.8 dựng pattern đầu tiên)
- [Source: prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-21 L310–316] — consequences testable: PDF + ưu tiên HÌNH ẢNH, native share sheet, web share/download, khối chữ ký + logo & thông tin công ty theo mẫu thật, cột Bảo hành từ `OrderLineItem.warrantyMonths` (rỗng khi null); climax journey L44 (share ảnh qua Zalo); L37 (khách không có account — chỉ nhận file); ma trận quyền L256–277 (KHÔNG quyền xuất riêng); SM-2 L526
- [Source: ARCHITECTURE-SPINE.md#AD-3 L60–64 verbatim] — binary ở R2, DB chỉ metadata + object key, đọc qua signed URL/proxy, không public bucket; module map L444/L449 (`storage/` wrapper; `attachments/` là FR-23/24 — KHÔNG phải story này); capability map L467 (FR-21 → `orders/` + `storage/`); deployment L418–424; deferred L480–482 (giới hạn ảnh + retention = để lại)
- [Source: ux-designs/.../EXPERIENCE.md L42 (`s-share`), L83–84 (bottom sheet vs dialog + share sheet ưu tiên ảnh), L138 (aria-label nút icon-only), L160 (climax share Zalo); mockups/all-screens.html L2872–2984 (s-share: file `bao-gia-BG-2048.png` pill "Ưu tiên", pdf "có chữ ký & logo"; entry points L1358/L1502/L1537/L1589 s-quote + L1904 s-order-detail) — LƯU Ý "Chép link"/grid app share trong mockup KHÔNG làm (xem Quyết định)]
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md L200 + L242] — báo giá PDF thêm cột Bảo hành; §3 L89–100 (format "5 năm"/"18 tháng", công lắp/phí null không hiện)
- [Source: docs/2. Thương mại/Báo giá thương mại.xlsx] — MẪU THẬT: labels + thông tin công ty đã trích verbatim vào Dev Notes (Quyết định spec); file giữ làm đối chiếu layout
- [Source: _bmad-output/implementation-artifacts/4-7-ap-chiet-khau-duyet-chiet-khau.md] — khuôn service/controller/DTO/e2e/guards/parity + bài học mutation/`cp`/flake lanes; `OrderView.discount` shape; refreshTotals echo rule
- [Source: pptr.dev/guides/pdf-generation + developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3] — page.pdf A4; R2 checksum `WHEN_REQUIRED` bắt buộc từ SDK 3.729.0

## Câu hỏi tồn đọng (không chặn dev — dev dùng mặc định đã ghi, Đại Ca trả lời khi rảnh)

1. **File logo thật**: chưa có trong repo — template fallback tên công ty dạng chữ; Đại Ca thả `backend/assets/quote/logo.png` rồi restart backend là hiện logo (không cần sửa code — assets cache 1 lần lúc render đầu).
2. **"Số điện thoại bán hàng"** trên mẫu: Phase 1 để trống (Account không có field SĐT) — chấp nhận hay muốn hằng hotline công ty trong `company-info.ts`?
3. **Share link công khai cho khách** ("Chép link" trong mockup): xác nhận để Phase sau (không FR) — nếu cần sớm thì thành story mới, cần quyết định bảo mật (token hết hạn?).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8, Claude Code)

### Debug Log References

- **Puppeteer 25.3.0 là ESM-only** (`type: module`, exports map `require` → chính file ESM, dựa vào `require(esm)` của Node ≥22): import tĩnh đầu file làm Jest (CJS transformer) vỡ ngay khi `app.module` được nạp trong test hermetic — dù render chưa bao giờ chạy. Fix: **dynamic `import('puppeteer')` LAZY trong `resolveBrowser()`** (không import tĩnh); hermetic test override port nên không bao giờ chạm module puppeteer. Story ghi `puppeteer ^24` — bản mới nhất lúc install là ^25, chấp nhận (SDK S3 3.1089.0).
- **`.gitignore` dòng `assets/` (marketing) nuốt luôn `backend/assets/`** → font bundle sẽ không bao giờ được commit, VPS deploy thiếu font. Fix: thêm exception `!backend/assets/` + `!backend/assets/**` (deliverable AC #2 đòi font trong repo).
- **AuditSubscriber/AuditService là GENERIC** (scout thực tế khác giả định story): `handle(event) → auditService.record(event)` map 5 chiều của MỌI `DomainEvent` — KHÔNG có bảng mapping per-event. `QuoteExported` conform `DomainEvent` là tự được audit → `audit.subscriber.ts` + `audit.subscriber.spec.ts` ZERO sửa (File SỬA dự kiến trong story không cần); e2e vẫn assert audit row `QuoteExported` được ghi bởi AuditSubscriber THẬT.
- **DB lane CHƯA CHẠY**: Docker Desktop không lên từ shell agent (`docker info` fail — bài học 4.4–4.7). Spec `quote-exports.db.integration.spec.ts` đã viết sẵn (tự skip khi vắng DATABASE_URL): unique orderId (upsert 2 lần = 1 row + P2002 khi INSERT trần), FK P2003 đơn ma. Đại Ca mở Docker Desktop rồi chạy `cd backend && npm run test:db`.
- **Render thật Puppeteer đã chạy tay 1 lần** (script scratchpad, ngoài lane): PDF 54.6KB + PNG 92.7KB, font Be Vietnam Pro render tiếng Việt sạch, layout đúng mẫu (đã xem ảnh). Lần chạy đầu screenshot throw 1 lần (transient), lần 2 OK — trong app browser là singleton sống lâu nên ít rủi ro hơn script one-shot.
- **XFile.fromData không expose lại `name`** (getter rỗng khi không có path) → widget test pin thứ tự [ảnh, pdf] bằng `mimeType`, không assert tên file qua XFile.
- Mutation checks: (1) service bẻ `discountAmount: 0` → 2 test RED (fixture số phân biệt bắt được) → revert cp; (2) guard (c.2) bẻ tên call `exportQuote` ở web → RED đúng assert; (3) parity 4.8 bẻ chữ ký web port → RED đúng assert; (4) negative `Tải PDF`-không-có-trên-mobile tự chứng minh RED thật khi comment mobile lỡ chứa nguyên văn chuỗi (guard quét TEXT kể cả comment — đã sửa comment).
- `package-lock.json` bị gitignore toàn repo (convention có sẵn) — 2 dep mới chỉ ghi nhận trong `package.json`.

### Completion Notes List

- **AC #1** — Module `storage/` MỚI: `StoragePort` abstract-class DI token (khuôn EventBus) + `R2StorageAdapter` (S3Client LAZY-init lần dùng đầu, checksum `WHEN_REQUIRED` ×2 chống gotcha SDK ≥3.729.0, `NoSuchKey`/404 → `AppException NOT_FOUND`, thiếu env → Error message tiếng Việt rõ ràng). App boot + `npm test` hermetic không cần env R2 (56 suite xanh không có env).
- **AC #2** — `buildQuoteHtml` pure function + `company-info.ts` hằng VERBATIM mẫu thật; cột Bảo hành "X năm"/"X tháng"/rỗng; dòng Chiết khấu chỉ khi > 0; format tiền regex dấu chấm ngàn (không số học tiền — template chỉ FORMAT); escape HTML mọi dữ liệu động; font Be Vietnam Pro Regular+SemiBold (OFL, google/fonts) embed base64, fallback font-stack khi thiếu file; logo đọc `backend/assets/quote/logo.png` NẾU tồn tại (hiện chưa có — render tên công ty dạng chữ). `PuppeteerQuoteRenderer`: browser singleton lazy-launch, `onModuleDestroy` close, `--no-sandbox` chỉ khi `PUPPETEER_NO_SANDBOX=1`.
- **AC #3** — `QuoteExportService` riêng (orders.service ZERO sửa, giữ bất biến 2-dep); totals resolution rule: `version.vatRate ?? settingsRate`, `vatApplies(version.vatMode ?? order.vatMode)`, `version.discountAmount ?? (status ≠ baogia && approval cho_duyet/dong_y → amount : 0)`; pipeline đúng thứ tự render → put ×2 → upsert → publish (unit test pin `['render','put','put','write','publish']`); key deterministic `quotes/{orderId}/bao-gia.png|.pdf`; event `QuoteExported` không before/after.
- **AC #4** — 2 route proxy GET `bao-gia/anh|pdf` trả `StreamableFile` đúng Content-Type + Content-Disposition attachment; chưa xuất → 404; Swagger binary schema + `@ApiProduces`; 401/403 fail-closed (nằm trong loop e2e mọi route).
- **AC #5** — Port 2 nền tảng: `QuoteExportFile/QuoteExportFiles` + `exportQuote(orderId)` (chỉ nhận id, không Input type); fakes trả PNG 1×1 + `%PDF-1.4` minimal TĨNH, 0 dòng → throw twin backend 400.
- **AC #6** — Web: nút `Chia sẻ báo giá` (ghost) + `Tải PDF` (default=outline base, web-only) hàng nút khu Chốt, Gate `quotesCreateEdit`, hiện mọi trạng thái khi ≥1 dòng, không ConfirmDialog, `shareBusy` chung, lỗi → Banner giữ state. Mobile twin: `shareImpl` constructor param injectable, `XFile.fromData` ×2 [ảnh, pdf], không nút tải riêng. 4 widget test C-4 đủ (a)–(d), tổng mobile 193/193.
- **AC #7** — Guards: (c.2) += `exportQuote`; (e) += `Chia sẻ báo giá` 2 nền tảng + nhánh riêng web-only `Tải PDF` (assert positive web + negative mobile); parity block 4.8 cặp chữ ký + twin tokens + `Uint8Array`/`Uint8List`/`dart:typed_data`. `permissions.json` + registry ZERO-change (drift-guard xanh); OpenAPI regen (+235 dòng, 3 route + 2 DTO); openapi-drift += assert 3 route + binary schema. Backend source-guards tự áp đều xanh.
- **AC #8** — Đúng phạm vi để lại: không share-link công khai, không attachments, không đánh số BG chính thức, không retention, không noti.
- **Lanes**: backend 934/934 (56 suite — baseline 905 + 29 mới, hermetic không cần R2/Chromium/Postgres) · design-system 290/290 · mobile 193/193 + `flutter analyze` sạch + `dart format` sạch. DB lane: spec sẵn, chưa chạy (Docker down — xem Debug Log).

### File List

**Mới:**
- backend/assets/fonts/BeVietnamPro-Regular.ttf
- backend/assets/fonts/BeVietnamPro-SemiBold.ttf
- backend/prisma/migrations/20260717040000_add_quote_exports/migration.sql
- backend/src/storage/storage.port.ts
- backend/src/storage/r2-storage.adapter.ts
- backend/src/storage/storage.module.ts
- backend/src/orders/quote/company-info.ts
- backend/src/orders/quote/quote-template.ts
- backend/src/orders/quote/quote-renderer.port.ts
- backend/src/orders/quote/puppeteer-quote-renderer.ts
- backend/src/orders/quote-export.service.ts
- backend/src/orders/dto/quote-export-response.dto.ts
- backend/test/quote-template.spec.ts
- backend/test/quote-export.service.spec.ts
- backend/test/quote-exports.db.integration.spec.ts
- backend/test/r2-storage.adapter.spec.ts (QA phase)

**Sửa:**
- .gitignore (exception `!backend/assets/` — xem Debug Log; LƯU Ý review: file `.gitignore` KHÔNG được git track — bị exclude cục bộ qua `.git/info/exclude`, nên sửa đổi này là local-only và vô hình với `git status`; fresh clone không có rule ignore nào → fonts vẫn commit bình thường)
- backend/package.json (+puppeteer ^25.3.0, +@aws-sdk/client-s3 ^3.1089.0)
- backend/prisma/schema.prisma (model QuoteExport + 3 relation đối ứng)
- backend/src/orders/orders.module.ts (import StorageModule, provide QuoteExportService + QuoteRendererPort)
- backend/src/orders/orders.controller.ts (+3 route, +QuoteExportService dep)
- backend/src/orders/domain/order-events.ts (+QuoteExported)
- backend/openapi/openapi.json (regen)
- backend/test/openapi-drift.spec.ts (+1 assert 3 route/binary)
- backend/test/orders.e2e.spec.ts (override StoragePort/QuoteRendererPort, +3 route loop 401/403, describe 4.8)
- web/src/design-system/session/orders-port.ts (+types +exportQuote)
- web/src/design-system/session/fake-orders-port.ts (+exportQuote demo bytes)
- web/src/screens/orders/CreateQuoteScreen.tsx (+shareBusy +2 handler +2 nút)
- mobile/lib/design_system/session/orders_port.dart (twin types + method + dart:typed_data)
- mobile/lib/design_system/session/fake_orders_port.dart (twin fake)
- mobile/lib/screens/orders/create_quote_screen.dart (+shareImpl param +_shareBusy +_shareQuote +nút)
- mobile/test/screens/orders/create_quote_screen_test.dart (+2 port test + 4 test 4.8)
- design-system/screens/orders.test.mjs ((c.2) +exportQuote; (e) +nhãn + nhánh web-only)
- design-system/session/parity.test.mjs (+block 4.8)

**Dự kiến trong story nhưng KHÔNG cần sửa (scout thực tế):** backend/src/audit/audit.subscriber.ts + backend/test/audit.subscriber.spec.ts (subscriber generic — không mapping per-event), web/src/screens/orders/orders.css (tái dùng `quote-chot-row` có sẵn), backend/assets/quote/logo.png (chờ Đại Ca cung cấp — thả file vào rồi RESTART backend là hiện logo: template cache assets module-level, đọc 1 lần ở lần render đầu, không cần sửa code).

## Senior Developer Review (AI)

**Ngày:** 2026-07-17 · **Reviewer:** Đại Ca (adversarial review tự động) · **Outcome: APPROVE — 0 CRITICAL, 0 HIGH sau fix**

**Phạm vi đã xác minh (đối chiếu claim ↔ git ↔ chạy thật):**
- Đọc TOÀN BỘ file trong File List + git diff; git ↔ File List khớp (19 file sửa + 16 file mới đều có mặt, không file ma).
- 8/8 AC IMPLEMENTED, 11/11 task [x] có bằng chứng code thật: storage lazy + checksum WHEN_REQUIRED ×2 (`r2-storage.adapter.ts:44-50`), pipeline đúng thứ tự render→put×2→upsert→publish (`quote-export.service.ts:124-145`, unit pin `['render','put','put','write','publish']`), totals resolution rule 3 vế đúng mirror confirm/refreshTotals, template escape HTML + zero số học tiền + không costPrice, 3 route có `@RequirePermissions` + Swagger binary, proxy JWT không presigned URL, parity/guards 4.8 đủ, registry/permissions.json ZERO-change.
- Lanes chạy lại lúc review: backend **946/946** (suite `customer-sources.e2e` timeout dưới tải full-lane → rerun riêng 38/38 xanh 1.9s — đúng flake đã biết trong Dev Notes) · design-system **290/290** · mobile **193/193** + `flutter analyze` sạch. DB lane: Docker vẫn down (`docker info` fail) — spec viết sẵn, CHƯA chạy.

**Findings (3) — đã fix tự động toàn bộ:**
1. **[MEDIUM][doc]** File List ghi `.gitignore` là file "Sửa" nhưng git KHÔNG track file này (bị exclude cục bộ qua `.git/info/exclude:10` — convention repo). Exception `!backend/assets/**` là local-only, vô hình với git; fresh clone không có rule ignore nào nên fonts vẫn commit được. → Fix: ghi rõ thực tế vào File List.
2. **[LOW][code]** `QuoteExported.occurredAt` dùng `new Date()` THỨ HAI tại publish — lệch `exportedAt` trong response (chênh thời gian render/upload). → Fix: dùng MỘT timestamp `exportedAt` cho cả event lẫn response (`quote-export.service.ts`); +1 assert unit `event.occurredAt === ketQua.exportedAt`. Re-run 101/101 xanh.
3. **[LOW][doc]** Claim "logo tự nhận khi thả file vào" không chính xác — `loadAssets()` cache module-level (cache cả sự vắng logo) nên cần RESTART backend. → Fix: sửa 3 chỗ trong story.

**Không phải issue (đã kiểm tra chủ động):** `@default(uuid())` trên QuoteExport nhất quán khuôn mọi model; `formatMoney(qty)` an toàn (qty là `Int` trong schema); `createdByAccountId` không đổi ở nhánh update là CHỦ ĐÍCH (doc schema: ai bấm Xuất lần đầu); Content-Disposition filename từ UUID — không header injection; DB-lane assert `code: 'P2003'` trên INSERT đúng bài học Prisma 7 (chỉ DELETE-restrict mới untagged).

## Change Log

- 2026-07-17 — Review (bmad-story-automator-review): APPROVE. 3 finding (1 MEDIUM doc + 2 LOW) fix tự động: đồng bộ `occurredAt`=`exportedAt` (+1 assert unit), sửa doc `.gitignore` local-exclude + logo cần restart. Lanes xác minh lại: backend 946/946 (flake customer-sources rerun xanh) · design-system 290/290 · mobile 193/193 + analyze sạch. DB lane vẫn chờ Docker. Status → done.
- 2026-07-17 — QA phase (qa-generate-e2e-tests): +12 test backend (934 → 946, 57 suite). Vá 4 gap: applyVat resolution 2 chiều (khong_vat chưa chốt + snapshot thắng Order.vatMode), discount `cho_duyet` vẫn trừ (mirror refreshTotals), nhánh phòng thủ customer/version null → 404, suite MỚI `r2-storage.adapter.spec.ts` (lazy-init, env message, checksum WHEN_REQUIRED — gotcha R2, NoSuchKey→404); +2 assert e2e (Content-Disposition pdf, exportedAt). 4 mutant RED-checked, revert `cp` diff sạch. Chi tiết: `tests/test-summary-story-4-8.md`.
- 2026-07-17 — Story 4.8 implemented (Amelia/dev-story): hạ tầng R2 `storage/` (lazy S3, checksum WHEN_REQUIRED), renderer Puppeteer MỘT template → PDF+PNG (font Be Vietnam Pro embed), `QuoteExportService` + 3 endpoint (`POST :id/xuat-bao-gia`, `GET :id/bao-gia/anh|pdf` proxy JWT), model `QuoteExport` (unique orderId, upsert đè) + migration offline, event `QuoteExported`, port/fake/UI 2 nền tảng (nút Chia sẻ báo giá + Tải PDF web-only, share [ảnh, pdf]), guards (c.2)/(e)/parity 4.8. Lanes: backend 934/934 · design-system 290/290 · mobile 193/193 + analyze/format sạch. DB lane viết sẵn, chưa chạy (Docker down). Status → review.
