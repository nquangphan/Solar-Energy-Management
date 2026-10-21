---
baseline_commit: 7d4fcc7
---

# Story 7.3: Sinh Hợp đồng Thi công / Mua bán (PDF)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền sinh hợp đồng (`contracts.generate`),
I want sinh Hợp đồng từ một Đơn đã chốt — HĐ Thi công khi đơn có cờ Thi công, HĐ Mua bán khi đơn chỉ Thiết bị — ra file PDF theo đúng 2 mẫu thật của công ty,
so that có văn bản ký kết điền sẵn hai bên, danh mục/giá, tổng tiền, lịch thanh toán và số báo giá, không ai phải gõ tay lại từ đơn.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-22, sau commit `7d4fcc7` — 7.2 done)

- **Quyền đã có:** `PERM.contractsGenerate = 'contracts.generate'` (`backend/src/accounts/domain/permission-registry.ts`, nhãn "Sinh hợp đồng", group `contracts`). **KHÔNG thêm key mới** ⇒ `permissions.json` không đổi.
- **Module `contracts/` chưa tồn tại.** Spine đã đặt chỗ: `contracts/  # sinh HĐ Thi công / Mua bán → PDF (FR-13)`, bảng module "Sinh hợp đồng (FR-13) → `contracts/`, AD-3"; ERD `ORDER ||--o{ CONTRACT : generates` (MỘT đơn NHIỀU hợp đồng).
- **Pipeline PDF có sẵn (Story 4.8)** — TÁI DÙNG, không viết lại:
  - `backend/src/orders/quote/quote-renderer.port.ts` — `QuoteRendererPort.render(html) → { pdf, image }` (abstract class kiêm DI token).
  - `backend/src/orders/quote/puppeteer-quote-renderer.ts` — Chromium singleton **lazy-launch**, `import('puppeteer')` **động** (puppeteer 25 ESM-only — import tĩnh làm vỡ MỌI suite hermetic qua `app.module` [memory: puppeteer25-esm-lazy-import-jest]). Bind ở `OrdersModule.providers`, **CHƯA export**.
  - `backend/src/orders/quote/quote-template.ts` — `buildQuoteHtml` thuần + helper **private** `escapeHtml`, `formatMoney` (`76.862.000`), `formatWarranty`, `formatDateVn` (UTC+7), `loadAssets`/`buildFontFaces` (font Be Vietnam Pro base64 từ `backend/assets/fonts/`, logo `assets/quote/logo.png` nếu có — hiện KHÔNG có logo).
  - `backend/src/orders/quote-export.service.ts` — khuôn thứ tự **render → upload → ghi DB → publish**, scope qua `this.orders.getScoped()` TRƯỚC mọi thứ, proxy tải file qua `assertScoped()` TRƯỚC khi chạm R2 (AD-3, bucket không public). Số báo giá in trên báo giá = `` `BG-${orderId.slice(0, 8).toUpperCase()}` `` (tính inline dòng ~97).
  - `backend/src/storage/storage.port.ts` (`putObject/getObject/deleteObject`), `StorageModule` (KHÔNG @Global; docstring đã nói "hợp đồng (7.3) tái dùng sau").
- **Cấu hình hệ thống (Story 4.4):** bảng `system_settings` (`key` PK, `value` String); `settings/domain/setting-registry.ts` (`SETTING`, `SETTING_DEFAULTS` — hiện ĐÚNG MỘT key `vat.rate_percent`, docstring "YAGNI: đúng MỘT setting"); `SettingsService` (2 dep: Prisma + EventBus; vắng row = default; `upsert`; publish `SystemSettingChanged(actor, before, after, occurredAt)` SAU write); `SettingsController` `GET/PATCH /settings/vat-rate` gate `settings.manage`. Web: `web/src/design-system/session/settings-port.ts` (**WEB-ONLY có chủ đích** — cấu hình là việc bàn giấy, mobile không có màn cấu hình) + `fake-settings-port.ts`; màn `web/src/screens/settings/CustomerSourceConfigScreen.tsx` có Frame "Thuế suất VAT" dưới bảng nguồn khách (không có Tabs — AD-13).
- **Hằng `COMPANY_INFO`** (`orders/quote/company-info.ts`) chứa tên/MST/địa chỉ/STK công ty cho **báo giá** — quyết định 4.8 "KHÔNG SystemSetting (YAGNI)". Story này **KHÔNG đổi báo giá**; hợp đồng đọc pháp nhân từ `system_settings` theo quyết định F-4 (xem D3). Hai nguồn song song là chủ đích có ghi lại (Câu hỏi mở 4).
- **Dữ liệu đơn/khách:** `OrderView` từ `OrdersService.getScoped()` mang `status`, `currentVersionId`, `customerSdt`, `kWp`, `scopeThietBi`(luôn `true` — `ScopePreset.scopeThietBi: true`), `scopeThiCong`, `scopeVanChuyen`, `lineItems[]` (`name, unit, qty, unitPrice, amount, warrantyMonths` — **snapshot-first**, amount server tính). `Customer`: `sdt` (E.164, PK), `name`, `cccd?`, `taxCode?`, `address?`, `bankAccount?`, `custType`. `OrderVersion`: `versionNo`, `vatRate`, `vatMode`, `discountAmount` (snapshot khi chốt). Tổng tiền: `resolveOrderTotals({ lines, version, order, fallbackVatRate })` (`orders/domain/order-totals.ts:94`) — MỘT hàm (AD-16).
- **Lịch thanh toán (7.1/7.2):** `PaymentSchedule` (unique `orderId`) + `Installment` (`seq`, `percent?`, `amount` Int, `conditionNote`, `milestone`). `EDITABLE_ORDER_STATUSES` (`payments/domain/payment-schedule.ts:37`) = `dachot, dacoc, thicong, nghiemthu, danggiao, dagiao`; `RECORDABLE_ORDER_STATUSES` = trên ∪ `hoanthanh`.
- **Màn chi tiết đơn:** web `OrderDetailScreen.tsx:87,481-489` / mobile `order_detail_screen.dart:89,102,390-410` có nút "Thanh toán" render khi caller truyền callback `onOpenPaymentSchedule` (7.1). Guard `design-system/screens/order-detail.test.mjs:258-273,358-366` khoá **đúng 3 tab** + cổng nút theo callback. ⇒ Hợp đồng vào bằng **nút** "Hợp đồng" cùng khuôn, KHÔNG thêm tab.
- **UX đã vẽ** (`ux-designs/…/mockups/all-screens.html:2622-2740`, `#s-contract`; EXPERIENCE.md:40): topbar "Sinh hợp đồng" (eyebrow `DH-xxxx · HỢP ĐỒNG`), frame **"Trường động đưa vào HĐ"** (`Loại HĐ · Hai bên "A: Khách · B: Phương Nam" · Vật tư "4 dòng · snapshot đơn" · Tổng tiền · Lịch TT "20/70/10" · Số BG`), banner info *"Điều khoản là template tĩnh; sinh HĐ ghi Audit log. Bản xuất có logo + khối chữ ký."*, nút primary **"Xuất PDF hợp đồng"**. Số HĐ mẫu: `HĐTC-2048/2026`, tham chiếu `BG-2048`. **Mockup ghi rõ Bên A = Khách (Chủ đầu tư), Bên B = Phương Nam (Nhà thầu).**
- **Hai mẫu thật đã trích** (D5) — trong CẢ HAI, **Phương Nam là BÊN B**, khách là BÊN A.

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Loại hợp đồng do SERVER suy từ cờ, không cho chọn.**
- `contractTypeFor({ scopeThiCong }) → 'construction' | 'sale'`: `scopeThiCong === true` ⇒ `construction` (HĐ Thi công); ngược lại ⇒ `sale` (HĐ Mua bán). Vì `scopeThietBi` luôn `true` (bất biến `ScopePreset`), "chỉ Thiết bị" ⇔ `!scopeThiCong` — không có trường hợp thứ ba. `scopeVanChuyen` không ảnh hưởng loại.
- Mockup vẽ Seg "HĐ Thi công | HĐ Mua bán" chọn được; AC FR-13 nói loại **theo cờ** ⇒ màn hiện loại dạng nhãn/chip chỉ đọc, **không Seg** (không có lựa chọn thật để đưa cho người dùng; một Seg chọn được sẽ mời in sai loại). Ghi ở Completion Notes là lệch có chủ đích so với mockup.
- Hằng `CONTRACT_TYPE = { construction: 'construction', sale: 'sale' } as const` ở `contracts/domain/contract-type.ts` — KHÔNG literal rải rác.

**D2 — Mô hình dữ liệu (migration mới `backend/prisma/migrations/20261022120000_add_contracts/migration.sql`).**

```prisma
/// A generated contract PDF of one order (FR-13). Append-only: every generation is a new row with
/// a new number — a contract already printed and signed is never overwritten. Bytes live in R2
/// (AD-3); this row keeps the key + metadata only.
model Contract {
  id                 String       @id @default(uuid())
  /// Global serial reserved BEFORE rendering (the number is printed inside the PDF).
  seq                Int          @unique @default(autoincrement())
  orderId            String       @map("order_id")
  order              Order        @relation(fields: [orderId], references: [id], onDelete: Restrict)
  orderVersionId     String       @map("order_version_id")
  orderVersion       OrderVersion @relation(fields: [orderVersionId], references: [id], onDelete: Restrict)
  type               String
  contractNo         String       @unique @map("contract_no")
  pdfKey             String       @map("pdf_key")
  pdfSize            Int          @map("pdf_size")
  fileName           String       @map("file_name")
  createdByAccountId String       @map("created_by_account_id")
  createdBy          Account      @relation("ContractCreatedBy", fields: [createdByAccountId], references: [id], onDelete: Restrict)
  createdAt          DateTime     @default(now()) @map("created_at")

  @@index([orderId])
  @@index([orderVersionId])
  @@map("contracts")
}
```
- Back-relation `contracts Contract[]` ở `Order`, `OrderVersion`, `Account` (`@relation("ContractCreatedBy")`). Đặt model **sau `Payment`**, KHÔNG chèn giữa khối `///` của model khác (bài học 7.1 review #2).
- **CHECK viết tay** trong migration: `contracts_type_known` (`type IN ('construction','sale')`), `contracts_pdf_size_positive` (`pdf_size > 0`).
- Vì sao bảng nhiều dòng (không upsert MỘT dòng/đơn như `QuoteExport`): hợp đồng là chứng từ pháp lý — bản đã in/ký không được bị đè; sửa đơn sau chốt (bản update 4.6) rồi sinh lại = hợp đồng MỚI, số MỚI, bản cũ vẫn tải được.
- Sinh SQL: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (cách 7.1/7.2 chạy được; Prisma 7 KHÔNG có `--from-schema-datamodel` [memory: prisma7-migrate-diff-flag-rename]) rồi thêm 2 CHECK; `npx prisma migrate deploy` CHỈ lên `pns-postgres:5433`; diff sau deploy = rỗng.

**D3 — Pháp nhân công ty (Bên B) từ `system_settings` — quyết định F-4, KHÔNG chặn.**
- **Nhãn bên:** epics/F-4 viết "thông tin pháp nhân **bên A**" nhưng cả 2 mẫu thật + mockup đặt công ty ở **BÊN B** (HĐTC: "BÊN NHẬN THẦU (BÊN B)"; HĐMB: "BÊN B (BÊN BÁN)"). Nội dung quyết định F-4 là *thông tin pháp nhân CÔNG TY đọc từ settings* — giữ nguyên nội dung đó, **in đúng nhãn của mẫu: công ty = Bên B, khách = Bên A**. Đây là chỗ story nguồn lệch tài liệu gốc [memory: story-devnotes-drift-from-spine]; ghi Câu hỏi mở 1. KHÔNG được in công ty là Bên A.
- **7 key mới** trong `SETTING` (registry là nơi DUY NHẤT chứa chuỗi key — import `SETTING`, không literal):
  `company.legal_name`, `company.tax_code`, `company.address`, `company.representative`, `company.representative_title`, `company.phone`, `company.bank_account`. `SETTING_DEFAULTS` = `''` cho cả 7 (**seed rỗng — vắng row = chưa cấu hình**, không migration seed). 5 key đầu là danh sách của AC; `phone` + `bank_account` thêm vì cả hai mẫu in "Điện thoại"/"Tài khoản số" của Bên B và HĐTC điều 3.2 in "STK …" — đọc từ cùng nguồn thay vì trộn hằng `COMPANY_INFO` (hai nguồn cho cùng một pháp nhân trong MỘT văn bản là thứ sẽ lệch). Cập nhật docstring registry (bỏ câu "đúng MỘT setting", giữ tinh thần không dựng framework).
- `SettingsService`:
  - `companyLegalEntity(): Promise<CompanyLegalEntity>` — MỘT `findMany({ where: { key: { in: [...7 key] } } })`, vắng row ⇒ `''`. Type `CompanyLegalEntity { legalName, taxCode, address, representative, representativeTitle, phone, bankAccount }` (string, có thể rỗng) khai ở `settings/domain/company-legal-entity.ts` (thuần) + hàm `missingLegalEntityFields(entity) → string[]` trả **nhãn tiếng Việt** của ô rỗng sau trim theo thứ tự cố định (`Tên công ty`, `Mã số thuế`, `Địa chỉ`, `Người đại diện`, `Chức danh`, `Điện thoại`, `Tài khoản ngân hàng`).
  - `updateCompanyLegalEntity(actorAccountId, input)` — trim từng field; so với giá trị HIỆU LỰC; `$transaction` các `upsert` của key ĐỔI; **SAU commit** publish `SystemSettingChanged` **một event cho mỗi key đổi** (shape event có sẵn, `before.value` = giá trị hiệu lực cũ, có thể `''`); không key nào đổi ⇒ 0 ghi, 0 event. Trả entity sau ghi. Giữ đúng 2 dependency (Prisma + EventBus).
- `SettingsController` thêm `GET /settings/company-legal-entity` + `PUT /settings/company-legal-entity`, CẢ HAI `@RequirePermissions(PERM.settingsManage)` (khuôn vat-rate). DTO tiếng Anh `CompanyLegalEntityDto` (request = response, 7 field): mỗi field `@IsString` + `@MaxLength(200)` (message tiếng Việt), **bắt buộc có mặt** (PUT thay toàn bộ; chuỗi rỗng hợp lệ = xoá cấu hình ô đó). KHÔNG `@IsOptional` (bài học 3.1: null lọt xuống thành 500).
- Khi in: ô pháp nhân rỗng ⇒ in **"Chưa cấu hình"** (hằng `NOT_CONFIGURED_LABEL` ở `contracts/domain/`), hợp đồng VẪN sinh — không bao giờ 409/400 vì pháp nhân (AC F-4).

**D4 — API hợp đồng (contract tiếng Anh, luật 8). Controller mới `backend/src/contracts/contracts.controller.ts`, `@Controller('orders')`** (khuôn `PaymentSchedulesController` — docstring ghi lý do prefix: spine gắn module SỞ HỮU entity, không gắn prefix route; path không đụng route nào của `OrdersController`).
- Cả 3 handler: `@RequirePermissions(PERM.contractsGenerate)` + `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`; `:id` và `:contractId` qua `ParseUUIDPipe`; quyền người gọi resolve TƯƠI (`accountPermissions.listForAccount`), VAT + cờ giá phân tầng resolve tươi rồi truyền xuống (khuôn controller 7.1).
- `GET /orders/:id/contracts` ⇒ 200 `ContractsOverviewResponseDto`:
  - `contractType: 'construction' | 'sale'`
  - `generatable: boolean`, `blockedReason: string | null` (message tiếng Việt y hệt message 409/400 mà POST sẽ trả — MỘT hàm domain sinh, D6)
  - `quoteNo: string` (D7), `versionNo: number`, `customerName: string`, `lineCount: number`
  - `orderTotal: number` — description chứa **"số nguyên đồng"** (để `design-system/money/money-fields.mjs` thu vào guard)
  - `scheduleLabel: string | null` — server dựng: mọi đợt có `percent` ⇒ `"20/70/10"`; có đợt theo số tiền ⇒ `"3 đợt"`; chưa có lịch ⇒ `null`
  - `missingPartyFields: string[]` (D3)
  - `contracts: ContractResponseDto[]` (mới nhất trước — `createdAt desc, seq desc`)
- `POST /orders/:id/contracts` ⇒ **201** `ContractResponseDto` (tạo resource định danh mới — khác `:id/xuat-bao-gia` đè file nên 200). Body rỗng.
- `GET /orders/:id/contracts/:contractId/pdf` ⇒ 200 bytes `application/pdf`, `Content-Disposition: attachment; filename="<fileName>.pdf"` (khuôn `downloadQuotePdf`, `StreamableFile`, `@ApiProduces('application/pdf')`).
- `ContractResponseDto { id, contractNo, contractType, versionNo, fileName, pdfSize, createdAt }` — `pdfSize`/`versionNo`/`lineCount` description **KHÔNG** chứa "số nguyên đồng" (guard money sẽ coi là tiền).
- Lỗi: 400 (`:id`/`:contractId` không UUID; đơn 0 dòng — message *"Đơn chưa có dòng vật tư — không sinh hợp đồng được."*), 403, 404 (đơn ngoài phạm vi/không tồn tại — CÙNG message `getScoped`; hợp đồng không thuộc đơn này ⇒ *"Không tìm thấy hợp đồng."*), 409 `CONFLICT` (D6). Mô tả OpenAPI liệt kê đủ nhánh như PUT 7.1.

**D5 — Template tĩnh, CHỈ điền dữ liệu động (FR-13). Trích VERBATIM từ 2 mẫu.**
- File:
  - `backend/src/contracts/contract-template.ts` — `buildContractHtml(data: ContractTemplateData): string` **thuần** (test được không browser/Nest/Prisma; ZERO số học tiền — mọi số đã tính sẵn; KHÔNG nhận giá vốn dưới bất kỳ dạng nào).
  - `backend/src/contracts/clauses/construction-clauses.ts` và `sale-clauses.ts` — hằng chuỗi điều khoản tĩnh, chép **nguyên văn** (giữ chính tả/viết hoa gốc, khuôn `COMPANY_INFO`). Header docstring ghi nguồn + ngày trích.
  - Nguồn: HĐ Thi công `docs/1. Khảo sát lắp đặt/HĐ THI CÔNG CT .docx` (trích bằng `textutil -convert txt`); HĐ Mua bán `docs/2. Thương mại/HDMB CT QTS l2.pdf` (trích bằng `pdftotext -layout`). Dev TỰ trích lại và đối chiếu — không chép từ story này.
- **Phân định tĩnh / động — HĐ Thi công (`construction`):**

| Phần | Tĩnh (verbatim) | Động |
|---|---|---|
| Đầu | Quốc hiệu "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc", tiêu đề "HỢP ĐỒNG THI CÔNG", 3 dòng "Căn cứ…" | `Số: {contractNo}`; "Hôm nay, ngày {dd} tháng {MM} năm {yyyy}" (UTC+7) |
| Bên A "BÊN GIAO THẦU (BÊN A)" | nhãn | khách: tên, Địa chỉ, Điện thoại, Số CCCD, Mã số thuế |
| Bên B "BÊN NHẬN THẦU (BÊN B)" | nhãn | pháp nhân D3: tên, Đại diện + Chức vụ, Địa chỉ, Điện thoại, Mã số thuế, Tài khoản số |
| Điều 1 | câu khung "Bên A đồng ý giao cho Bên B thi công, lắp đặt trọn gói hệ thống điện mặt trời tại địa điểm: …", "Vật tư thi công gồm:" | địa chỉ khách; công suất `{kWp} kWp` nếu có; **bảng dòng** (STT · Tên hàng · ĐVT · Số lượng · Đơn giá · Thành tiền · Bảo hành); "(Chi tiết báo giá số: {quoteNo} kèm theo)" |
| Điều 2 | mục "2. Tiến độ thi công: …10 ngày…" | giá trị HĐ: dòng Tổng cộng / Chiết khấu (nếu > 0) / VAT (x%) / **Tổng sau VAT** + "(Bằng chữ: …)" |
| Điều 3 | "Hồ sơ bao gồm…", đoạn giải trình | 3.1: mỗi đợt một dòng (D8); 3.2: "STK {bank_account}" |
| Điều 4 | toàn bộ (bàn giao, nghiệm thu, bảo hành công trình) | — |
| Điều 5 | toàn bộ trách nhiệm hai bên | danh sách hàng tập kết + bảo hành: một gạch đầu dòng cho mỗi dòng có `warrantyMonths` (`+ {name}, Bảo hành {formatWarranty}.`) thay cho 3 dòng sản phẩm cụ thể của mẫu |
| Điều 6, 7, 8 | toàn bộ | — |
| Chữ ký | "ĐẠI DIỆN BÊN A" / "ĐẠI DIỆN BÊN B" | tên khách / tên người đại diện (rỗng ⇒ "Chưa cấu hình") |

- **Phân định — HĐ Mua bán (`sale`):**

| Phần | Tĩnh | Động |
|---|---|---|
| Đầu | Quốc hiệu, "HỢP ĐỒNG MUA BÁN", 3 dòng "Căn cứ…", câu "Hai bên đồng ý ký kết hợp đồng kinh tế…" | `Số`, "Hôm nay, ngày … tại TP. Hồ Chí Minh" |
| Bên A "BÊN A (BÊN MUA)" | nhãn | khách: tên, Địa chỉ, Điện thoại, Mã Số Thuế, Tài khoản số, Đại diện + Chức Vụ (KHÔNG có dữ liệu ⇒ ô điền tay) |
| Bên B "BÊN B (BÊN BÁN)" | nhãn | pháp nhân D3 đủ 7 ô |
| Điều 1.1 | tiêu đề | bảng dòng + tổng (như trên) + "Tổng giá trị hợp đồng bao gồm thuế GTGT: {total} VNĐ (Bằng chữ: …)" (không áp VAT ⇒ "Tổng giá trị hợp đồng: … VNĐ (Bằng chữ: …)") |
| Điều 1.2 | gạch đầu "Bên Mua thanh toán… chuyển khoản…" | thay câu "100% …" của mẫu bằng danh sách đợt (D8) |
| Điều 2, 3 | toàn bộ | — |
| Điều 4 | các gạch đầu chung (tiêu chuẩn nhà sản xuất, miễn trừ, 03 ngày làm việc…) | một gạch đầu mỗi dòng có `warrantyMonths` thay cho 2 dòng sản phẩm cụ thể của mẫu |
| Điều 5, 6, 7, 8 | toàn bộ | — |
| Chữ ký | | tên khách / tên đại diện |

- **Ô trống:** dữ liệu KHÁCH thiếu (`cccd`, `taxCode`, `address`, `bankAccount` null; đại diện/chức vụ khách HĐMB luôn thiếu) ⇒ in dòng chấm **"……………………"** để điền tay khi ký (KHÔNG in "Chưa cấu hình" — đó là nhãn của cấu hình công ty, D3). Mọi chuỗi động qua `escapeHtml`.
- Số trong văn bản: định dạng `formatMoney` có sẵn (`145.000.000`) — một kiểu cho cả hai loại (mẫu HĐMB dùng dấu phẩy là khác biệt trình bày, không phải điều khoản).
- **TÁI DÙNG helper 4.8:** `export` `escapeHtml`, `formatMoney`, `formatWarranty`, `formatDateVn`, `loadAssets`, `buildFontFaces` khỏi `quote-template.ts` (chỉ thêm từ khoá `export`, KHÔNG đổi thân hàm, `buildQuoteHtml` không đổi byte nào) rồi import vào `contract-template.ts`. KHÔNG chép lần hai.
- Layout nhiều trang: `@page { size: A4; margin: 18mm 16mm; }`, body KHÔNG đặt `width: 794px` cố định như báo giá; bảng `page-break-inside: auto`, `tr { page-break-inside: avoid; }`; khối chữ ký `page-break-inside: avoid`. Font Be Vietnam Pro qua `buildFontFaces(loadAssets())`. Không logo (chưa có file) — mockup có logo nhưng `assets/quote/logo.png` không tồn tại; đường đọc logo có sẵn tự bật khi Đại Ca thả file vào.

**D6 — Điều kiện sinh (domain thuần `backend/src/contracts/domain/contract-eligibility.ts`).**
- `CONTRACT_ORDER_STATUSES` = `dachot, dacoc, thicong, nghiemthu, danggiao, dagiao, hoanthanh` — dựng từ hằng `TRANG_THAI_*` (không literal). Lý do: giá đã snapshot từ lúc Chốt (AD-6/AD-20); `baogia`/`choduyet` tổng còn sống; `huy` không ký hợp đồng. `hoanthanh` cho in lại.
- `contractBlocker({ status, lineCount, hasSchedule, scheduleTotal, orderTotal }) → { status: 400 | 409; message } | null`, thứ tự kiểm cố định:
  1. status ∉ tập ⇒ 409 *"Chỉ sinh hợp đồng khi đơn đã chốt và chưa huỷ."*
  2. `lineCount === 0` ⇒ 400 *"Đơn chưa có dòng vật tư — không sinh hợp đồng được."* (đơn `dachot` 0 dòng là có thật — TD-35)
  3. chưa có lịch ⇒ 409 *"Đơn chưa có lịch thanh toán — cấu hình lịch trước khi sinh hợp đồng."* (hợp đồng PHẢI có điều khoản thanh toán — FR-13 liệt kê lịch là dữ liệu bắt buộc)
  4. `scheduleTotal !== orderTotal` ⇒ 409 *"Tổng các đợt thanh toán lệch tổng đơn — sửa lịch trước khi sinh hợp đồng."* (7.1 cho lưu lịch lệch chỉ cảnh báo; nhưng văn bản pháp lý in "Đợt 1 … đồng" cộng không ra "Tổng giá trị hợp đồng" là sai. Hệ quả đã biết: đơn mở lại + đã có tiền ⇒ lịch khoá ⇒ không sinh được — Câu hỏi mở 2.)
- `GET` overview dùng CÙNG hàm ⇒ `generatable = blocker === null`, `blockedReason = blocker?.message ?? null`. POST ném `AppException(ErrorCode.CONFLICT|VALIDATION_ERROR, status, message)` từ CÙNG kết quả. KHÔNG có điều kiện nào về pháp nhân (D3).

**D7 — Số báo giá và số hợp đồng.**
- **Số báo giá dùng chung:** tạo `backend/src/orders/domain/quote-number.ts` `quoteNumberOf(orderId) = \`BG-${orderId.slice(0, 8).toUpperCase()}\``; `QuoteExportService` thay biểu thức inline bằng hàm này (đổi 1 dòng, output y hệt — test 4.8 phải xanh nguyên). Hợp đồng in CÙNG số với báo giá khách đang cầm (AC "tham chiếu số báo giá").
- **Số hợp đồng:** `formatContractNo(type, seq, issuedAt)` (`contracts/domain/contract-number.ts`) = `HĐTC-{seq}/{yyyy}` hoặc `HĐMB-{seq}/{yyyy}` — khuôn mockup `HĐTC-2048/2026`; `yyyy` theo **UTC+7** (31/12 17:30 UTC = năm sau). `seq` toàn cục, không reset theo năm (unique đơn giản; reset theo năm là tính năng chưa ai đòi).
- **Giữ chỗ `seq` TRƯỚC khi render** (số được in TRONG PDF): `SELECT nextval(pg_get_serial_sequence('contracts', 'seq')) AS seq` qua `$queryRaw` (Postgres trả `bigint` ⇒ `Number(...)`), rồi `contract.create({ data: { id, seq, … } })` với `seq` tường minh. Lỗi sau khi giữ chỗ ⇒ thủng số (chấp nhận — số nội bộ, không phải số hoá đơn thuế). KHÔNG `count()+1` (hai request song song ra cùng số ⇒ P2002).
- **Tên file ASCII** (header `Content-Disposition` không mang được `Đ`): `hop-dong-thi-cong-{seq}` / `hop-dong-mua-ban-{seq}` (không đuôi; route thêm `.pdf` — khuôn `fileName` của `QuoteExport`).
- **Key R2:** `contracts/{orderId}/{contractId}.pdf` — `contractId = randomUUID()` (node:crypto) sinh ở app TRƯỚC upload, ghi làm `id` của dòng. Mỗi lần sinh một key mới, không đè.

**D8 — Dòng thanh toán trong hợp đồng.**
- Đọc `paymentSchedule.findUnique({ where: { orderId }, include: { installments: { orderBy: { seq: 'asc' } } } })` — đọc trực tiếp qua Prisma (chỉ cần `seq/percent/amount/conditionNote`; KHÔNG import `PaymentsModule` — tránh vòng phụ thuộc và cái view tiền đã thu không liên quan).
- Mỗi đợt: có `percent` ⇒ `+ Đợt {seq}: {percent}% giá trị hợp đồng với số tiền là: {formatMoney(amount)} đồng ({amountInWords(amount)}) — {conditionNote}.`; theo số tiền ⇒ `+ Đợt {seq}: Thanh toán số tiền {…} đồng ({…}) — {conditionNote}.` (câu theo khuôn HĐTC 3.1, `conditionNote` đã escape; rỗng ⇒ bỏ phần "— …").
- `scheduleLabel` (D4) và `scheduleTotal = Σ installment.amount` (cộng ở JS, number) dựng từ cùng lần đọc.

**D9 — Số tiền bằng chữ: `backend/src/contracts/domain/amount-in-words.ts` `amountInWords(n: number): string`.**
- Thuần, nhận số nguyên ≥ 0 (< 10^15; ném `RangeError` ngoài miền — lỗi lập trình, không phải input người dùng), trả câu viết hoa chữ đầu, kết bằng `" đồng"`. Đơn vị nhóm: `ngàn`, `triệu`, `tỷ` (mẫu dùng "ngàn"). Luật: `mươi`/`mười`; `mốt` (1 sau hàng chục ≥ 2); `lăm` (5 sau hàng chục ≥ 1); `lẻ` (hàng chục 0, hàng đơn vị ≠ 0 — mẫu dùng "lẻ"); nhóm giữa đầy đủ "không trăm"; nhóm toàn 0 bỏ qua; `0 ⇒ "Không đồng"`.
- **Fixture BẮT BUỘC lấy từ 2 mẫu thật** (không tự suy [memory: handpicked-fixture-numbers]):
  - `145000000` ⇒ `"Một trăm bốn mươi lăm triệu đồng"`
  - `29000000` ⇒ `"Hai mươi chín triệu đồng"`
  - `14500000` ⇒ `"Mười bốn triệu năm trăm ngàn đồng"`
  - `101500000` ⇒ `"Một trăm lẻ một triệu năm trăm ngàn đồng"`
  - `50275000` ⇒ `"Năm mươi triệu hai trăm bảy mươi lăm ngàn đồng"`
  (mẫu có dấu phẩy/"./." trang trí — test so câu đã chuẩn hoá theo luật trên; ghi rõ trong test.) Thêm biên: `0`, `5`, `10`, `15`, `21`, `25`, `105`, `1005000` (`"Một triệu không trăm lẻ năm ngàn đồng"`), `1000000000`, `2147483647`, và `83010960` (tổng đơn mockup).

**D10 — Service `backend/src/contracts/contracts.service.ts`. Thứ tự `generate(...)` BẮT BUỘC:**
1. `this.orders.getScoped(actor, perms, orderId, tieredPricingEnabled)` — phạm vi TRƯỚC mọi thứ (404 cùng message).
2. Đọc song song: `customer` (theo `customerSdt`), `orderVersion` (theo `currentVersionId`; null ⇒ coi như 0 dòng), lịch + đợt (D8), `settings.companyLegalEntity()`. (`SettingsService` inject vào `ContractsService` — module `contracts` import `SettingsModule`.)
3. `resolveOrderTotals({ lines, version, order: view, fallbackVatRate })` ⇒ `totals`, `vatRate`, `applyVat`.
4. `contractBlocker(...)` ⇒ ném 400/409.
5. `issuedAt = new Date()`; giữ chỗ `seq` (D7); `contractNo`; `contractId = randomUUID()`; `type = contractTypeFor(view)`.
6. `html = buildContractHtml({...})`; `pdf = await this.renderer.renderPdf(html)`.
7. `await this.storage.putObject(key, pdf, 'application/pdf')`.
8. `await this.prisma.contract.create({ data })`.
9. **SAU khi ghi thành công:** `eventBus.publish(new ContractGenerated(...))` ĐÚNG 1 lần.
10. Trả `ContractResponseDto`.
- Fail ở bước nào dừng ở đó: 0 event khi chưa trọn vẹn; fail ở bước 8 ⇒ bytes mồ côi ở R2 (vô hình với mọi endpoint — chấp nhận, đúng triết lý `StoragePort`). KHÔNG mở `$transaction`, KHÔNG khoá `orders`: story không ghi gì vào aggregate đơn; PDF phản ánh trạng thái lúc đọc, và `orderVersionId` ghi lại chính xác bản đã in.
- `overview(...)`: `getScoped` ⇒ cùng helper đọc bước 2-4 (trích private method dùng chung `loadInputs`, KHÔNG chép) + `contract.findMany({ where: { orderId }, include: { orderVersion: { select: { versionNo: true } } }, orderBy: [...] })`.
- `getPdf(actor, perms, orderId, contractId)`: `this.orders.assertScoped(...)` TRƯỚC; `contract.findFirst({ where: { id: contractId, orderId } })` — null ⇒ 404 *"Không tìm thấy hợp đồng."* (hợp đồng của đơn KHÁC trả cùng 404, không xác nhận tồn tại); `storage.getObject(pdfKey)`.
- Dependency: `OrdersService`, `PrismaService`, `EventBus`, `StoragePort`, `QuoteRendererPort`, `SettingsService`. KHÔNG `AuditService`/`NotificationDispatcher` (AD-18; guard `no-direct-side-effect-outside-eventbus`).

**D11 — Renderer: thêm `renderPdf`, export port, KHÔNG thêm browser thứ hai.**
- `QuoteRendererPort` thêm `abstract renderPdf(html: string): Promise<Buffer>`; `PuppeteerQuoteRenderer.renderPdf` dùng CÙNG `resolveBrowser()` (cùng singleton, cùng lazy import), `page.setContent(html, { waitUntil: 'load' })`, `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`, `page.close()` trong `finally`. KHÔNG screenshot (hợp đồng nhiều trang không cần ảnh share; `render()` của báo giá giữ nguyên).
- `OrdersModule.exports: [OrdersService, QuoteRendererPort]` — cập nhật docstring `exports` (lý do thứ hai: `contracts/` dùng chung renderer để không launch Chromium thứ hai). KHÔNG bind lại renderer trong `ContractsModule`.
- Mọi stub `QuoteRendererPort` trong test hiện có (`quote-export.service.spec.ts`, `order-scoped-total.spec.ts`, các e2e `overrideProvider(QuoteRendererPort)`) phải vẫn compile/xanh — nếu stub dạng `as unknown as QuoteRendererPort` thì không cần sửa; e2e mới của contracts override bằng stub có `renderPdf` trả `Buffer.from('%PDF-1.4 test')`.
- Tên port giữ `QuoteRendererPort` (đổi tên là refactor lan 8 file — ngoài scope); docstring port bổ sung "dùng cho cả hợp đồng (7.3)".

**D12 — Event `backend/src/contracts/domain/contract-events.ts`: `ContractGenerated`** (khuôn `QuoteExported`/`PaymentScheduleConfigured`): `type = 'ContractGenerated'`, `target = { type: 'Order', id: orderId }` (audit của đơn liền mạch), `actorAccountId`, `after = { contractId, contractNo, contractType, orderVersionId, fileName }`, `occurredAt = issuedAt` (audit và response cùng timestamp). Không đưa dữ liệu khách/pháp nhân vào payload. `AuditSubscriber` tự ghi (AD-18) — KHÔNG gọi audit trực tiếp.

**D13 — Module `backend/src/contracts/contracts.module.ts`:** `imports: [OrdersModule, StorageModule, SettingsModule, FeatureFlagsModule, AccountsModule]`; `controllers: [ContractsController]`; `providers: [ContractsService]`. Đăng ký `ContractsModule` trong `app.module.ts` (sau `PaymentsModule`). `orders/` KHÔNG BAO GIỜ import `contracts/` (vòng). Docstring liệt kê lý do từng import (khuôn `payments.module.ts`).

**D14 — Client (web + mobile parity; port + fake; màn MỚI).**
- **Port** (method tiếng Anh, type mirror DTO field-for-field):
  - web `web/src/design-system/session/contracts-port.ts` + `fake-contracts-port.ts`; mobile `mobile/lib/design_system/session/contracts_port.dart` + `fake_contracts_port.dart` (+ export ở `session.dart`, web `index.ts` nếu các port khác export ở đó).
  - `getOverview(orderId) → ContractsOverview`; `generateContract(orderId) → ContractSummary`; `downloadContractPdf(orderId, contractId)` → web `File`, mobile `ContractPdfFile { bytes, fileName }` (khuôn `QuoteExportFiles`). Lỗi reject theo envelope AD-5 (`message`, `status`).
  - Fake: số đóng hộp (tổng, label "20/70/10"), danh sách hợp đồng trong bộ nhớ, `generateContract` thêm một bản số tăng dần; có cấu hình để trả `generatable:false` + `blockedReason`, và `missingPartyFields` không rỗng. KHÔNG phép tính tiền trong màn (guard).
- **Màn mới** web `web/src/screens/contracts/ContractsScreen.tsx` + `contracts.css`; mobile `mobile/lib/screens/contracts/contracts_screen.dart`:
  - Topbar "Sinh hợp đồng" (eyebrow `HỢP ĐỒNG`), nút back qua prop `onBack`.
  - Frame **"Trường động đưa vào HĐ"**: `Loại HĐ` (`HĐ Thi công` / `HĐ Mua bán` theo `contractType` — map nhãn ở client là trình bày), `Hai bên` `A: {customerName} · B: Phương Nam`, `Vật tư` `{lineCount} dòng · snapshot đơn`, `Tổng tiền` qua `<Money>`/`MoneyText`, `Lịch TT` `scheduleLabel`, `Số BG` `quoteNo`.
  - Banner info cố định: *"Điều khoản là template tĩnh; sinh HĐ ghi Audit log."*
  - `missingPartyFields` không rỗng ⇒ Banner cảnh báo: *"Thông tin pháp nhân chưa cấu hình: {nhãn nối ", "}. Hợp đồng vẫn xuất được — các ô này in “Chưa cấu hình”."* (KHÔNG khoá nút).
  - `generatable:false` ⇒ Banner cảnh báo `blockedReason` và **ẩn** nút (không gray-disabled — UX-DR-22 tinh thần "không clutter").
  - Nút primary **"Xuất PDF hợp đồng"** ⇒ `generateContract` ⇒ `downloadContractPdf` ⇒ web: share/download như báo giá (`navigator.share` có `files` ⇒ share, else tải xuống qua object URL); mobile: `share_plus` `XFile.fromData` (khuôn `create_quote_screen.dart:490-520`). Disable khi đang chạy (chống double-submit — mỗi lần bấm là MỘT hợp đồng mới, D2). KHÔNG ConfirmDialog (sinh văn bản không phải hành động tiền/dữ liệu không đảo ngược — UX-DR-20 chỉ cho tiền/dữ liệu hệ quả).
  - Danh sách **"Hợp đồng đã sinh"**: mỗi bản `Số HĐ · Loại · Bản {versionNo} · Ngày sinh dd/MM/yyyy (UTC+7)` + nút "Tải PDF". Rỗng ⇒ EmptyState *"Chưa sinh hợp đồng nào."*; loading = Skeleton; lỗi = ErrorState + "Thử lại".
  - 400/409 từ POST ⇒ Banner message server nguyên văn (AD-5) + tải lại overview.
- **Lối vào:** `OrderDetailScreen` thêm prop `onOpenContracts?: () => void` ⇒ Button **"Hợp đồng"** trong `od-actions` cạnh "Thanh toán" (điều kiện bao `od-actions` thêm `|| onOpenContracts`); mobile `onOpenContracts` ⇒ `AppButton(label: 'Hợp đồng')` trong `Wrap`. Caller chỉ truyền callback khi `can(contractsGenerate)` (mobile `AppPermissionKeys` — [memory: mobile-screens-use-apppermissionkeys-not-appperm]). Giữ đúng 3 tab.
- **Web Cấu hình:** `SettingsPort` thêm `getCompanyLegalEntity()` / `updateCompanyLegalEntity(input)`; fake lưu bộ nhớ (khởi đầu toàn chuỗi rỗng — mirror seed rỗng); `CustomerSourceConfigScreen.tsx` thêm Frame **"Thông tin pháp nhân (in trên hợp đồng)"** dưới Frame VAT: 7 `<Field>` (`Tên công ty`, `Mã số thuế`, `Địa chỉ`, `Người đại diện`, `Chức danh`, `Điện thoại`, `Tài khoản ngân hàng`) + nút "Lưu thông tin pháp nhân" (disabled khi đang gửi), lỗi 400 map `fieldErrors` theo tên field. KHÔNG mobile (port settings web-only có chủ đích).
- **Parity / guard design-system:**
  - Mới `design-system/screens/contracts.test.mjs` (khuôn `payment-schedule.test.mjs`): 2 màn + 2 port + 2 fake tồn tại; màn chỉ nói chuyện qua port; nhãn tiếng Việt byte-identical hai nền tảng (bảng nhãn ở Dev Notes); tiền chỉ qua Money/MoneyText; không literal quyền; không số học tiền ở màn/port/fake; KHÔNG có Seg chọn loại; assert chống-guard-rỗng.
  - `order-detail.test.mjs`: thêm ca nút "Hợp đồng" chỉ render khi có `onOpenContracts` (cả hai nền tảng), giữ "đúng 3 tab".
  - `settings-customer-sources.test.mjs`: thêm nhãn mới vào bảng nhãn; ca Frame pháp nhân dùng `<Field>`/`<Button>`; vẫn không Tabs.
  - Màn web mới ⇒ thêm ca render vào `web/src/test/screens-render.test.tsx` (guard đếm số file màn sẽ ĐỎ nếu quên).

### 3. Phạm vi

- **TRONG:** `Contract` + migration/CHECK; domain `contract-type`, `contract-number`, `contract-eligibility`, `amount-in-words`, `contract-events`; `company-legal-entity` + 7 key settings + `GET/PUT /settings/company-legal-entity`; template + 2 file điều khoản verbatim; `renderPdf` + export port; `quoteNumberOf` dùng chung; `contracts/` module (3 route); guard phạm vi mở rộng; OpenAPI regen; web (màn hợp đồng, nút ở chi tiết đơn, Frame pháp nhân ở Cấu hình) + mobile (màn hợp đồng, nút ở chi tiết đơn) + port/fake + test; parity guard.
- **NGOÀI:** chọn tay loại hợp đồng; sửa điều khoản theo đơn; chữ ký số/đóng dấu điện tử; xoá/huỷ hợp đồng đã sinh; reset số theo năm; đổi báo giá sang đọc pháp nhân từ settings (Câu hỏi mở 4); màn cấu hình pháp nhân trên mobile; preview văn bản đầy đủ trong client (mockup vẽ đoạn trích — client không dựng lại template; nguồn văn bản duy nhất là PDF backend); hoá đơn (7.4/7.5); router/HTTP adapter thật (TD-38); notification (Epic 9).

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:628-635`)

- **Given** cờ phạm vi của Đơn, **When** sinh hợp đồng, **Then** Đơn có cờ Thi công → HĐ Thi công; Đơn chỉ Thiết bị → HĐ Mua bán (FR-13).
- **Given** template tĩnh, **When** sinh, **Then** chỉ điền dữ liệu động (hai bên, danh mục/giá, tổng, lịch thanh toán, tham chiếu số báo giá); điều khoản cố định không sửa theo đơn (FR-13).
- **Given** thông tin pháp nhân bên A (tên công ty, MST, địa chỉ, người đại diện, chức danh), **When** sinh hợp đồng, **Then** đọc từ `system_settings` (cùng khuôn VAT ở story 4.4), seed rỗng; hợp đồng vẫn xuất được, ô chưa cấu hình hiện "Chưa cấu hình", không bao giờ chặn (F-4). *(Nhãn bên in theo mẫu thật: pháp nhân công ty = Bên B — D3.)*
- **Given** điều khoản tĩnh, **When** dựng template, **Then** trích từ hai mẫu có sẵn: HĐ Thi công [Source: `docs/1. Khảo sát lắp đặt/HĐ THI CÔNG CT .docx`], HĐ Mua bán [Source: `docs/2. Thương mại/HDMB CT QTS l2.pdf`].
- **Given** file PDF, **When** lưu, **Then** binary ở R2, DB lưu metadata + object key; entity `Contract` gắn `orderId`; sinh hợp đồng ghi Audit (FR-13, AD-3).

### AC dẫn xuất (đo được)

1. **AC-1 (loại theo cờ):** đơn `scopeThiCong:true` ⇒ `POST` 201 `contractType:'construction'`, `contractNo` khớp `/^HĐTC-\d+\/\d{4}$/`, HTML truyền vào renderer chứa "HỢP ĐỒNG THI CÔNG" và KHÔNG chứa "HỢP ĐỒNG MUA BÁN"; đơn `scopeThiCong:false` ⇒ `'sale'`, `HĐMB-…`, ngược lại. `GET` overview trả cùng `contractType` trước khi sinh. Unit `contractTypeFor` 2 ca.
2. **AC-2 (điều khoản verbatim):** test template: với MỖI loại, mọi tiêu đề "ĐIỀU 1".."ĐIỀU 8" của mẫu xuất hiện, và ít nhất một câu đặc trưng nguyên văn của từng điều tĩnh có mặt (vd HĐTC Điều 6.4 "…bên vi phạm sẽ bị phạt 8% giá trị hợp đồng."; HĐMB Điều 5.1 "…lãi suất chậm thanh toán là 0,05%/ngày…"; Điều 7.2 "…Tòa án nhân dân có thẩm quyền tại Thành phố Hồ Chí Minh…"). Hai đơn khác nhau (khác khách, dòng, tiền, lịch) ⇒ phần điều khoản tĩnh (cắt bỏ các vùng động) **giống hệt byte** — điều khoản không đổi theo đơn. Không còn dữ liệu cụ thể của mẫu gốc lọt vào văn bản (KHÔNG chứa "DƯƠNG VĂN ĐỨC", "THORNOVA 570W", "QUỐC THỊNH", "BG00342", "145.000.000", "50,275,000").
3. **AC-3 (dữ liệu động):** HTML chứa: tên/địa chỉ/SĐT/CCCD/MST khách (đã escape — tên `<b>X</b>` không thành tag), mọi dòng (tên, ĐVT, SL, đơn giá, thành tiền đúng `amount` server tính), Tổng cộng / Chiết khấu (chỉ khi > 0) / VAT (x%) / Tổng sau VAT = đúng output `resolveOrderTotals` (fixture tổng 83.010.960), "Bằng chữ" của tổng = `amountInWords(total)`, mỗi đợt lịch đúng `seq/percent/amount/conditionNote` + bằng chữ, `quoteNo` = `quoteNumberOf(orderId)` = đúng số in trên báo giá 4.8 của cùng đơn (test so với `QuoteExportService` / `buildQuoteHtml` cùng fixture), ngày lập theo UTC+7. KHÔNG chứa giá vốn (`costPrice`/`costPriceSnapshot` không có trong `ContractTemplateData`).
4. **AC-4 (pháp nhân từ settings, không chặn):** `system_settings` vắng mọi key `company.*` ⇒ `POST` vẫn 201; HTML Bên B in "Chưa cấu hình" ở đủ 7 ô; overview `missingPartyFields` = 7 nhãn đúng thứ tự. `PUT /settings/company-legal-entity` đặt tên + MST ⇒ lần sinh sau in đúng 2 giá trị đó, 5 ô còn lại "Chưa cấu hình", `missingPartyFields` còn 5. Công ty in ở nhãn **BÊN B** (`BÊN NHẬN THẦU (BÊN B)` / `BÊN B (BÊN BÁN)`), khách ở **BÊN A**. Dữ liệu khách thiếu (cccd/taxCode/address/bankAccount null) in dòng chấm, KHÔNG in "Chưa cấu hình".
5. **AC-5 (settings API):** `GET` khi chưa cấu hình ⇒ 200 7 field `''`; `PUT` đủ 7 field ⇒ 200 entity đã trim; thiếu field / field `null` / số / > 200 ký tự ⇒ 400 + `fieldErrors` (message tiếng Việt); thiếu `settings.manage` ⇒ 403 cả GET lẫn PUT. Đổi 2 key ⇒ đúng 2 `SystemSettingChanged` (`toHaveBeenCalledTimes(2)`), `before.value` = giá trị hiệu lực cũ (`''` lần đầu); PUT y hệt lần hai ⇒ 0 upsert, 0 event. Lane DB: 2 dòng `system_settings` + 2 dòng audit `SystemSettingChanged` target `{type:'SystemSetting', id:<key>}`. `GET/PATCH /settings/vat-rate` không đổi hành vi (test 4.4 xanh nguyên).
6. **AC-6 (R2 + metadata + audit):** `POST` thành công ⇒ `storage.putObject` 1 lần với key `contracts/{orderId}/{id}.pdf` + `'application/pdf'` + đúng bytes renderer trả; 1 dòng `contracts` (`orderId`, `orderVersionId` = `currentVersionId` lúc sinh, `type`, `contractNo`, `pdfKey`, `pdfSize` = `pdf.length`, `fileName` ASCII `hop-dong-thi-cong-{seq}`/`hop-dong-mua-ban-{seq}`, `createdByAccountId`); `eventBus.publish` **đúng 1 lần** `ContractGenerated` target `{type:'Order', id:orderId}`, `occurredAt === createdAt` của response. Lane DB: 1 dòng audit `ContractGenerated`. `GET …/:contractId/pdf` trả đúng bytes, `Content-Type: application/pdf`, `Content-Disposition` chứa `filename="hop-dong-…pdf"`.
7. **AC-7 (thứ tự + thất bại):** unit: scope → đọc → blocker → giữ seq → render → upload → create → publish. Renderer ném ⇒ 0 `putObject`, 0 `create`, 0 publish; upload ném ⇒ 0 `create`, 0 publish; `create` ném ⇒ 0 publish. Không có `$transaction` / khoá `orders` trong `generate` (assert mock không được gọi).
8. **AC-8 (sinh lại = bản mới):** sinh 2 lần cùng đơn ⇒ 2 dòng, 2 `seq` khác nhau, 2 `contractNo` khác nhau, 2 key khác nhau; bản 1 vẫn tải được. Sửa đơn sau chốt (bản update 4.6 ⇒ `currentVersionId` mới) rồi sinh ⇒ bản mới mang `versionNo` mới, bản cũ giữ `versionNo` cũ. Overview liệt kê mới nhất trước. Lane DB: 2 `generate` song song (`Promise.all`) ⇒ 2 dòng, `seq`/`contractNo` khác nhau, không P2002/500 (nextval là nguồn số — mutant `count()+1` phải ĐỎ ca này hoặc unit tương đương).
9. **AC-9 (điều kiện sinh):** đơn `baogia`/`choduyet`/`huy` ⇒ 409 *"Chỉ sinh hợp đồng khi đơn đã chốt và chưa huỷ."*; đơn đã chốt 0 dòng ⇒ 400; chưa có lịch ⇒ 409 *"Đơn chưa có lịch thanh toán — …"*; lịch lệch tổng ⇒ 409 *"Tổng các đợt thanh toán lệch tổng đơn — …"*; mọi từ chối ⇒ 0 render, 0 upload, 0 dòng, 0 publish. Overview của các đơn đó trả `generatable:false` + `blockedReason` = ĐÚNG message tương ứng (cùng hàm). Đơn `hoanthanh` ⇒ sinh được. Mã HTTP đo ở lane e2e qua `ValidationPipe`/filter thật [memory: dev-pins-ac-deviation-as-green-test].
10. **AC-10 (quyền + phạm vi):** thiếu `contracts.generate` ⇒ 403 trên cả 3 route; người chỉ có `orders.view_own` không phải owner/assignee ⇒ 404 CÙNG message đơn không tồn tại (cả overview, POST, tải PDF); `contractId` của đơn KHÁC trong phạm vi ⇒ 404 *"Không tìm thấy hợp đồng."* và KHÔNG gọi `storage.getObject`; id không UUID ⇒ 400. Source-guard phạm vi ĐỎ khi gỡ `this.orders.getScoped(` khỏi `generate`/`overview` hoặc `this.orders.assertScoped(` khỏi `getPdf` (mutation, `cp` backup — KHÔNG `git checkout` [memory: mutation-test-never-git-checkout]).
11. **AC-11 (bằng chữ):** `amountInWords` khớp đủ 5 fixture lấy từ 2 mẫu thật + các biên D9; số âm / không nguyên / ≥ 10^15 ⇒ `RangeError`.
12. **AC-12 (số hợp đồng):** `formatContractNo('construction', 7, new Date('2026-12-31T17:30:00Z'))` ⇒ `'HĐTC-7/2027'`; `('sale', 7, 2026-12-31T16:59:59Z)` ⇒ `'HĐMB-7/2026'`. `quoteNumberOf` dùng ở CẢ `QuoteExportService` lẫn hợp đồng (grep/test), test 4.8 xanh nguyên.
13. **AC-13 (renderer):** `renderPdf` dùng chung singleton (`resolveBrowser`) — unit với puppeteer giả hoặc kiểm bằng đọc code (không launch Chromium trong test hermetic); `render()` báo giá không đổi; `OrdersModule` export `QuoteRendererPort`; `ContractsModule` KHÔNG khai provider renderer. **Smoke tay (không commit):** dev render 1 HĐ Thi công + 1 HĐ Mua bán thật ra scratchpad bằng Chromium thật, mở xem: tiếng Việt đúng font, ngắt trang không cắt dòng bảng/khối chữ ký, ghi kết quả vào Completion Notes.
14. **AC-14 (contract OpenAPI):** `npm run openapi:gen` có `GET/POST /orders/{id}/contracts`, `GET /orders/{id}/contracts/{contractId}/pdf`, `GET/PUT /settings/company-legal-entity`, DTO tiếng Anh; drift-guard byte-for-byte xanh; `money-fields.mjs` thu `orderTotal`, KHÔNG thu `pdfSize`/`versionNo`/`lineCount`/`seq` (`cd design-system && npm test`); `permissions.json` KHÔNG đổi.
15. **AC-15 (client):** web `web/src/test/contracts-screen.test.tsx` + mobile `mobile/test/screens/contracts/contracts_screen_test.dart` cùng bộ ca: frame trường động hiện đủ 6 mục (tổng qua Money/MoneyText); nhãn loại theo `contractType` (2 ca); banner pháp nhân thiếu hiện khi `missingPartyFields` không rỗng và nút VẪN hiện; `generatable:false` ⇒ banner `blockedReason` + nút ẨN; bấm "Xuất PDF hợp đồng" ⇒ `generateContract` 1 lần rồi `downloadContractPdf` với id vừa sinh; bấm 2 lần nhanh ⇒ 1 lời gọi (disable in-flight); 409 ⇒ banner message server; danh sách đã sinh + "Tải PDF" gọi đúng `contractId`; empty/loading/error + "Thử lại". Mobile thêm 320/360 px không tràn với nhãn dài nhất (`HĐMB-123456/2026`, tên khách 80 ký tự, `blockedReason` dài nhất). `OrderDetailScreen` (cả hai): nút "Hợp đồng" chỉ khi có `onOpenContracts` — fixture BẬT mọi điều kiện bao ngoài `od-actions` khác TẮT để chứng minh chính `onOpenContracts` mở khối [memory: widget-test-gate-unreachable-outer-condition]. Web Cấu hình: Frame pháp nhân load 7 ô, Lưu gọi `updateCompanyLegalEntity` đúng payload đã nhập, map `fieldErrors`. `screens-render.test.tsx` có ca `ContractsScreen`. Parity guard D14 xanh và có assert chống-guard-rỗng.

---

## Tasks / Subtasks

- [x] **T1 — Schema + migration** (AC 6, 8)
  - [x] T1.1 Model `Contract` + back-relation `Order`/`OrderVersion`/`Account` trong `backend/prisma/schema.prisma` (docstring tiếng Anh, đặt sau `Payment`).
  - [x] T1.2 `backend/prisma/migrations/20261022120000_add_contracts/migration.sql` sinh bằng `migrate diff --from-config-datasource --to-schema` + 2 CHECK tay.
  - [x] T1.3 `npx prisma migrate deploy` lên `pns-postgres:5433` (CHỈ DB này); diff sau deploy rỗng.
- [x] **T2 — Domain thuần** (AC 1, 9, 11, 12)
  - [x] T2.1 `backend/src/contracts/domain/{contract-type,contract-number,contract-eligibility,amount-in-words,contract-events}.ts` + `NOT_CONFIGURED_LABEL`.
  - [x] T2.2 `backend/src/orders/domain/quote-number.ts` + thay inline ở `quote-export.service.ts`.
  - [x] T2.3 `backend/src/settings/domain/company-legal-entity.ts` (type + `missingLegalEntityFields`) + 7 key vào `setting-registry.ts` (+ docstring).
  - [x] T2.4 Unit `backend/test/contract-domain.spec.ts` (type, number + biên năm UTC+7, blocker đủ 4 nhánh + thứ tự, `scheduleLabel`), `backend/test/amount-in-words.spec.ts` (fixture mẫu thật + biên), `backend/test/company-legal-entity.spec.ts`.
- [x] **T3 — Settings pháp nhân** (AC 4, 5)
  - [x] T3.1 `SettingsService.companyLegalEntity()` / `updateCompanyLegalEntity()` (D3).
  - [x] T3.2 DTO `backend/src/settings/dto/company-legal-entity.dto.ts` + 2 handler trong `settings.controller.ts`.
  - [x] T3.3 Cập nhật `backend/test/settings.service.spec.ts`, `settings.e2e.spec.ts` (200/400/403, vat-rate không đổi) và `settings.db.integration.spec.ts` (dòng + audit theo key).
- [x] **T4 — Template + renderer** (AC 2, 3, 4, 13)
  - [x] T4.1 `export` 6 helper trong `quote-template.ts` (không đổi thân).
  - [x] T4.2 `backend/src/contracts/clauses/{construction,sale}-clauses.ts` — tự trích lại từ 2 file `docs/` (lệnh ở D5), verbatim, ghi nguồn + ngày.
  - [x] T4.3 `backend/src/contracts/contract-template.ts` `buildContractHtml` (bảng phân định D5, CSS nhiều trang).
  - [x] T4.4 `QuoteRendererPort.renderPdf` + `PuppeteerQuoteRenderer.renderPdf`; `OrdersModule.exports` + docstring.
  - [x] T4.5 Unit `backend/test/contract-template.spec.ts` (AC-2/3/4: verbatim, tĩnh giống byte giữa 2 đơn, không rò dữ liệu mẫu, escape, "Chưa cấu hình", dòng chấm cho khách, không giá vốn).
- [x] **T5 — Service + controller + module** (AC 1, 6-10)
  - [x] T5.1 DTO `backend/src/contracts/dto/{contract-response,contracts-overview-response}.dto.ts`.
  - [x] T5.2 `backend/src/contracts/contracts.service.ts` (D10, helper `loadInputs` dùng chung).
  - [x] T5.3 `backend/src/contracts/contracts.controller.ts` (D4) + `contracts.module.ts` (D13) + đăng ký `app.module.ts`.
  - [x] T5.4 Unit `backend/test/contracts.service.spec.ts` (AC-7 thứ tự + thất bại từng bước, `toHaveBeenCalledTimes`; seq qua `$queryRaw`; key/fileName; 404 hợp đồng đơn khác không chạm R2).
  - [x] T5.5 e2e `backend/test/contracts.e2e.spec.ts` qua `initAppOnLoopback` (override `QuoteRendererPort` bằng stub có `renderPdf` + `StoragePort` bằng `backend/test/util/fake-storage.ts` có sẵn — KHÔNG R2 thật): 200/201/400/403/404/409 từng nhánh, shape, header tải PDF; route cũ `/orders/:id/xuat-bao-gia`, `/payment-schedule`, `/payments` vẫn chạy.
  - [x] T5.6 Lane DB `backend/test/contracts.db.integration.spec.ts`: CHECK đứng riêng (ghi thẳng ⇒ vi phạm), sinh thật (renderer/storage fake) ⇒ dòng + audit `ContractGenerated`, 2 sinh song song ⇒ seq/số khác nhau, settings PUT ⇒ dòng + audit, version mới ⇒ `versionNo` mới.
- [x] **T6 — Guard + contract** (AC 10, 14)
  - [x] T6.1 `backend/test/no-unscoped-order-write.spec.ts`: thêm `FILE_CANH` `{ file: 'contracts/contracts.service.ts', goiPhamVi: /this\.orders\.(?:getScoped|assertScoped)\s*\(/ }`; `CHAM_DON` thêm `/\.contract\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|find(?:Unique|First|Many)|count)\s*\(/` và `/this\.renderer\.\w+\s*\(/`; anti-blind trích thân `generate` (> 0, chứa `.contract.create(`) và `getPdf` (chứa `storage.getObject(`). Viết lời gọi liền một dòng — KHÔNG chain `.create(...).catch()` để prettier không tách `.contract\n.create(` [memory: prettier-chain-blinds-scope-guard]. Mutation chứng minh ĐỎ.
  - [x] T6.2 Kiểm guard `no-direct-side-effect-outside-eventbus`, `no-handler-without-require-permissions`, `no-permission-literal-outside-registry`, `naming-convention` xanh với file mới (không nới guard).
  - [x] T6.3 `npm run openapi:gen`; drift-guard xanh; `permissions.json` không đổi.
- [x] **T7 — Web** (AC 15)
  - [x] T7.1 `contracts-port.ts` + `fake-contracts-port.ts`; `settings-port.ts` + `fake-settings-port.ts` (pháp nhân).
  - [x] T7.2 `web/src/screens/contracts/ContractsScreen.tsx` + `contracts.css` (chỉ class có rule thật — guard css-class-coverage).
  - [x] T7.3 `OrderDetailScreen.tsx` prop `onOpenContracts` + nút; `CustomerSourceConfigScreen.tsx` Frame pháp nhân.
  - [x] T7.4 Test `web/src/test/contracts-screen.test.tsx`, ca render ở `screens-render.test.tsx`, ca Cấu hình; `cd web && npm run typecheck && npm test && npm run build`.
- [x] **T8 — Mobile** (AC 15)
  - [x] T8.1 `contracts_port.dart` + `fake_contracts_port.dart` (+ `session.dart`).
  - [x] T8.2 `mobile/lib/screens/contracts/contracts_screen.dart` (widget design-system, `MoneyText`, `AppPermissionKeys` ở caller, share qua `share_plus`).
  - [x] T8.3 `order_detail_screen.dart` prop `onOpenContracts` + nút.
  - [x] T8.4 Widget test `mobile/test/screens/contracts/contracts_screen_test.dart` + ca nút ở test chi tiết đơn; `cd mobile && flutter analyze && flutter test`. `dart format` chỉ `-o none --set-exit-if-changed` hoặc đúng file mình sửa [memory: dart-format-writes-files-cascade].
- [x] **T9 — Parity + 5 lane** (AC 14, 15)
  - [x] T9.1 `design-system/screens/contracts.test.mjs` (mới), cập nhật `order-detail.test.mjs`, `settings-customer-sources.test.mjs`.
  - [x] T9.2 Đủ 5 lane cùng working tree: `cd backend && npm test` · `npm run test:db` · `cd design-system && npm test` · web typecheck/test/build · mobile analyze/test. Lint backend so baseline bằng stash [memory: backend-lint-red-at-baseline] — file MỚI phải sạch eslint/prettier.
  - [x] T9.3 Smoke render PDF thật (AC-13), ghi Completion Notes.

---

## Dev Notes

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác

[Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`; `sprint-status.yaml` action item F-4]
1. Mọi đường ghi/đọc đơn mới qua kiểm phạm vi ⇒ D10 bước 1 + guard T6.1.
2. Tồn kho: story này KHÔNG chạm tồn kho.
3. Màn web mới ⇒ ca ở `screens-render.test.tsx`; chạy typecheck/test/build.
4. Màn mobile mới ⇒ widget test bắt buộc [memory: mobile-screens-need-widget-tests].
5. Guard mới/mở rộng có assert chống-guard-rỗng.
6. e2e dùng `initAppOnLoopback` (`backend/test/util/listen-loopback.ts`).
7. KHÔNG `git push`; `git add` đường dẫn cụ thể, không `-A`; `package-lock.json` `git add -f` nếu đổi (story này KHÔNG thêm thư viện).
8. Code tiếng Anh (biến/hàm/file/comment/test/log/commit); chỉ chuỗi hiển thị tiếng Việt; route/DTO/port mới tiếng Anh (`/contracts`, `generateContract`, `company-legal-entity`). Không đổi tên symbol tiếng Việt cũ (`TRANG_THAI_*`, `getScoped`, `quyenCuaNguoiGoi`…).
9. Tiền số nguyên đồng; hiển thị qua `<Money>`/`MoneyText` (`83.010.960 đ`) — trong PDF dùng `formatMoney` của template backend (trình bày, không phải số học).
10. **HỢP ĐỒNG:** pháp nhân từ `system_settings` (khuôn VAT 4.4), seed rỗng, ô trống "Chưa cấu hình", không chặn; điều khoản tĩnh trích từ 2 file `docs/`; PDF dùng pipeline Puppeteer có sẵn (lazy import) + `StoragePort`; test KHÔNG upload R2 thật (adapter giả); route tiếng Anh `/contracts`.

### Files sẽ đổi / tạo

| File | Loại | Ghi chú |
|---|---|---|
| `backend/prisma/schema.prisma` | UPDATE | + `Contract`, back-relation `Order`/`OrderVersion`/`Account` |
| `backend/prisma/migrations/20261022120000_add_contracts/migration.sql` | NEW | + 2 CHECK tay |
| `backend/src/contracts/contracts.{module,controller,service}.ts` | NEW | 3 route |
| `backend/src/contracts/contract-template.ts` | NEW | thuần |
| `backend/src/contracts/clauses/{construction,sale}-clauses.ts` | NEW | verbatim |
| `backend/src/contracts/domain/{contract-type,contract-number,contract-eligibility,amount-in-words,contract-events}.ts` | NEW | thuần |
| `backend/src/contracts/dto/{contract-response,contracts-overview-response}.dto.ts` | NEW | |
| `backend/src/app.module.ts` | UPDATE | + `ContractsModule` |
| `backend/src/orders/orders.module.ts` | UPDATE | export `QuoteRendererPort` + docstring |
| `backend/src/orders/quote/quote-renderer.port.ts`, `puppeteer-quote-renderer.ts` | UPDATE | + `renderPdf` |
| `backend/src/orders/quote/quote-template.ts` | UPDATE | chỉ thêm `export` cho 6 helper |
| `backend/src/orders/domain/quote-number.ts` | NEW | `quoteNumberOf` |
| `backend/src/orders/quote-export.service.ts` | UPDATE | 1 dòng → `quoteNumberOf` |
| `backend/src/settings/domain/setting-registry.ts` | UPDATE | + 7 key, docstring |
| `backend/src/settings/domain/company-legal-entity.ts` | NEW | type + nhãn ô thiếu |
| `backend/src/settings/settings.{service,controller}.ts` | UPDATE | + 2 method, 2 handler |
| `backend/src/settings/dto/company-legal-entity.dto.ts` | NEW | |
| `backend/test/no-unscoped-order-write.spec.ts` | UPDATE | canh `contracts.service.ts` |
| `backend/test/{contract-domain,amount-in-words,company-legal-entity,contract-template,contracts.service,contracts.e2e,contracts.db.integration}.spec.ts` | NEW | |
| `backend/test/settings.{service,e2e,db.integration}.spec.ts` | UPDATE | pháp nhân |
| `backend/openapi/openapi.json` | REGEN | |
| `web/src/design-system/session/{contracts-port,fake-contracts-port}.ts` | NEW | |
| `web/src/design-system/session/{settings-port,fake-settings-port}.ts` | UPDATE | pháp nhân |
| `web/src/screens/contracts/{ContractsScreen.tsx,contracts.css}` | NEW | |
| `web/src/screens/orders/OrderDetailScreen.tsx` | UPDATE | nút "Hợp đồng" |
| `web/src/screens/settings/CustomerSourceConfigScreen.tsx` (+ `settings.css` nếu cần class) | UPDATE | Frame pháp nhân |
| `web/src/test/{contracts-screen.test.tsx,screens-render.test.tsx}` | NEW/UPDATE | |
| `mobile/lib/design_system/session/{contracts_port,fake_contracts_port}.dart`, `session.dart` | NEW/UPDATE | |
| `mobile/lib/screens/contracts/contracts_screen.dart` | NEW | |
| `mobile/lib/screens/orders/order_detail_screen.dart` | UPDATE | nút "Hợp đồng" |
| `mobile/test/screens/contracts/contracts_screen_test.dart` + test chi tiết đơn | NEW/UPDATE | |
| `design-system/screens/{contracts,order-detail,settings-customer-sources}.test.mjs` | NEW/UPDATE | |

### Nhãn hiển thị chung (byte-identical web ↔ mobile)

`Sinh hợp đồng` · `HỢP ĐỒNG` (eyebrow) · `Trường động đưa vào HĐ` · `Loại HĐ` · `HĐ Thi công` · `HĐ Mua bán` · `Hai bên` · `Vật tư` · `dòng · snapshot đơn` · `Tổng tiền` · `Lịch TT` · `Số BG` · `Điều khoản là template tĩnh; sinh HĐ ghi Audit log.` · `Thông tin pháp nhân chưa cấu hình: ` · `Hợp đồng vẫn xuất được — các ô này in “Chưa cấu hình”.` · `Xuất PDF hợp đồng` · `Hợp đồng đã sinh` · `Bản ` · `Tải PDF` · `Chưa sinh hợp đồng nào.` · `Thử lại` · `Hợp đồng` (nút ở chi tiết đơn). Web-only Cấu hình: `Thông tin pháp nhân (in trên hợp đồng)` · `Tên công ty` · `Mã số thuế` · `Địa chỉ` · `Người đại diện` · `Chức danh` · `Điện thoại` · `Tài khoản ngân hàng` · `Lưu thông tin pháp nhân`.

### Hiện trạng phải giữ

- `buildQuoteHtml`, `QuoteExportService` hành vi + output y nguyên (chỉ `quoteNumberOf` thay biểu thức tương đương). Mọi test 4.8 xanh.
- `QuoteRendererPort.render` không đổi; Chromium vẫn một singleton lazy; boot app + test hermetic không bao giờ launch Chromium.
- `GET/PATCH /settings/vat-rate` y nguyên; `SettingsService` vẫn 2 dependency.
- `OrderDetailScreen`/`order_detail_screen`: đúng 3 tab; nút "Thanh toán" giữ nguyên; thêm nút không làm tràn 320 px (đã dùng `Wrap`).
- Không route cũ nào đổi; `OrdersController` không thêm handler.

### Tình huống biên đã tính

- **Đơn mở lại (`mo_lai`) sau khi đã sinh hợp đồng:** hợp đồng cũ giữ nguyên (append-only), overview ⇒ `generatable:false` (status `baogia`) cho tới khi chốt lại.
- **Lịch theo số tiền** (không percent) ⇒ dòng đợt in "Thanh toán số tiền …"; `scheduleLabel` = "N đợt".
- **Không áp VAT** (`applyVat:false`) ⇒ dòng VAT in nhãn "VAT" giá trị 0 như báo giá; câu tổng HĐMB không nói "bao gồm thuế GTGT".
- **`kWp` null** ⇒ bỏ cụm công suất (không in "null kWp" — khác báo giá đang in ` kWp` trống; không sửa báo giá).
- **Tên khách / ghi chú đợt chứa HTML** ⇒ escape (test).
- **Tổng > INT4:** tổng chỉ tính ở JS và in ra; không ghi tổng vào cột nào ⇒ không tràn [memory: int4-money-column-percent-overflow]. `pdfSize` INT4 đủ (PDF ≪ 2 GB).
- **Dòng có `warrantyMonths` null** ⇒ không vào danh sách bảo hành Điều 5/Điều 4; cột Bảo hành trong bảng để trống (khuôn `formatWarranty`).
- **`nextval` trả `bigint`** ⇒ `Number(row.seq)`; test type ở lane DB.
- **Hai người sinh cùng lúc** ⇒ 2 hợp đồng 2 số (đúng — không có "một hợp đồng duy nhất mỗi đơn").

### Kiểm thử — luật dự án áp dụng trực tiếp

- Publish/putObject/create: `toHaveBeenCalledTimes(n)`, không `mock.calls[0]` [memory: publish-count-unasserted-duplicate-survives].
- Mutation (`cp` backup, mutant PHẢI compile [memory: mutation-must-compile-or-false-red]): (a) gỡ `getScoped` khỏi `generate` ⇒ guard + e2e 404 ĐỎ; (b) gỡ `assertScoped` khỏi `getPdf` ⇒ guard + e2e ĐỎ; (c) bỏ `orderId` khỏi `where` của `contract.findFirst` ⇒ e2e "hợp đồng đơn khác" ĐỎ; (d) đảo mapping loại (`!scopeThiCong`) ⇒ AC-1 ĐỎ; (e) publish TRƯỚC `create` ⇒ unit "create ném ⇒ 0 publish" ĐỎ; (f) `seq = count()+1` ⇒ DB song song ĐỎ (nếu không ép được interleaving, ghi lại và chứng minh ở unit [memory: db-race-test-cannot-reach-short-pretx-window]); (g) bỏ nhánh lịch lệch tổng ⇒ AC-9 ĐỎ; (h) đổi "Chưa cấu hình" thành chặn 409 ⇒ AC-4 ĐỎ; (i) sửa 1 chữ trong file điều khoản ⇒ test verbatim ĐỎ. Kiểm mutant không tương đương ngữ nghĩa trong fixture [memory: mutation-semantically-equivalent-false-survivor]. Ghi bảng kết quả TỰ CHẠY vào Completion Notes.
- Text-guard soi chuỗi route/nhãn phải đọc RAW file, không qua `stripToCode` (nó xoá string literal) [memory: striptocode-deletes-string-literals].
- Guard regex lồng generic: dùng mẫu trích thân method theo prettier như guard phạm vi hiện có, không `\{[^}]*\}` [memory: text-guard-brace-regex-nested-generics].
- Web `.tsx` lỗi cú pháp có thể qua text-guard ⇒ luôn chạy `npm run typecheck` + `npm test` của web [memory: web-tsx-syntax-error-passes-all-lanes].
- Lane DB cần Docker: `docker start pns-postgres`; daemon không lên từ shell agent ⇒ viết spec, báo lane CHƯA chạy, nhờ Đại Ca mở Docker Desktop [memory: db-lane-needs-docker-desktop-gui]. KHÔNG ghi DB nào khác. `describe.skip` không tách lane — lane DB tách bằng `testPathIgnorePatterns` (`*.db.integration.spec.ts`) [memory].
- Reviewer song song mutate cùng file ⇒ kiểm lại finding trên file hiện tại [memory: parallel-reviewers-mutation-collide].
- File asset mới dưới `backend/assets/` (nếu có): `git check-ignore` — `.gitignore` `assets/` nuốt thư mục [memory: dot-gitignore-assets-swallows-backend-assets]. Story này không cần asset mới.

### Previous Story Intelligence (7.2, 7.1, 4.8, Epic 6)

- **7.2:** khuôn controller `@Controller('orders')` trong module ngoài `orders/`; quyền resolve tươi; guard phạm vi `FILE_CANH`/`CHAM_DON` + anti-blind theo method; prettier tách chain ⇒ guard mù (dùng lời gọi liền); message class-validator tiếng Việt cho MỌI decorator (7.1 review #3); e2e đầu tiên 400 khắp nơi vì id fake không phải UUID ⇒ fake dùng UUID thật; Web `Banner` không có tone `ok` (dùng `info`); mobile `AppFrame` in nhãn HOA ⇒ widget test tìm `'…'.toUpperCase()`; ngày hiển thị theo UTC+7 ở cả hai nền tảng.
- **7.1:** đừng chèn model giữa khối `///`; `migrate diff --from-config-datasource --to-schema`; Money guard bắt `${x.amount}` — prefill/hiển thị tiền chỉ qua component; mobile cấm `Color(0x…)` ad-hoc.
- **4.8:** pipeline render → upload → ghi → publish; key deterministic cho báo giá (hợp đồng thì KHÔNG — mỗi bản một key); font bundle base64; Puppeteer lazy import; `--no-sandbox` qua env `PUPPETEER_NO_SANDBOX=1` trên VPS; route proxy tải file sau JWT + scope, không presigned URL.
- **6.4 (quyết định B):** contract tiếng Anh cho code mới [memory: english-code-includes-api-contracts].
- **6.3:** mobile dùng `AppPermissionKeys`, không `AppPerm`.
- **Epic 5/6:** widget test mobile với nhãn DÀI NHẤT ở 320/360 px; flaky đã biết ngoài phạm vi: `web/src/test/stock-vouchers-screen.test.tsx` khi máy bận.

### Git intelligence (5 commit gần nhất)

- `7d4fcc7` feat(story-7.2): Payment idempotent + auto-transition cùng tx — khuôn controller/guard/e2e/DB của `payments/` mà `contracts/` mirror.
- `f711499` feat(story-7.1): lịch nhiều đợt — `PaymentSchedule`/`Installment` mà hợp đồng đọc (D8).
- `13408c1` docs(epic-7): quyết định F-3/F-4 — nguồn D3 (pháp nhân từ settings, không chặn) + luật 10.
- `a66c649`, `98fd6dc`: đóng Epic 6, đồng bộ project-context.
- Commit story này: `feat(story-7.3): ...` tiếng Anh, không nhắc AI, `git add` đúng đường dẫn.

### Latest tech notes

- KHÔNG thêm thư viện (backend/web/mobile). Stack ghim trong `project-context.md` (NestJS 11.1.27, Prisma 7.8.0 + adapter-pg, React 19.2.7, Flutter 3.44); puppeteer đã có (4.8), `share_plus ^10.1.4` đã có ở mobile.
- Puppeteer `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })` — khi `preferCSSPageSize` bật, `@page { size; margin }` trong CSS thắng option `format`; KHÔNG truyền `margin` option song song (hai nguồn lệch nhau). `page.setContent(html, { waitUntil: 'load' })` đủ vì font inline base64.
- Prisma 7 `$queryRaw` trả `bigint` cho `nextval` ⇒ `Number()`; set `seq` tường minh khi `create` dù cột `@default(autoincrement())` (Postgres không tự đẩy sequence khi giá trị đến từ `nextval` của chính sequence đó — đã lấy rồi nên không trùng). P2002/P2003 tag chỉ đáng tin khi INSERT [memory: prisma7-p2003-only-on-insert].
- class-validator: `@IsString({ message })`, `@MaxLength(200, { message })`; KHÔNG `@IsOptional` cho field bắt buộc.
- Web share file: `navigator.canShare?.({ files })` trước `navigator.share`; fallback `URL.createObjectURL` + thẻ `a[download]` (đọc cách `CreateQuoteScreen.tsx:486-530` đã làm, dùng lại helper nếu có).

### Project Structure Notes

- Module `contracts/` khớp spine (`contracts/ # sinh HĐ Thi công / Mua bán → PDF`). Route `orders/:id/contracts` là sub-resource của đơn (CONVENTIONS: danh từ số nhiều, kebab-case); bảng `contracts` snake_case số nhiều; file kebab-case.
- Biến thể có chủ đích: `contracts/` dùng chung `QuoteRendererPort` export từ `orders/` (không tách module `pdf/` riêng — một consumer thứ hai chưa đủ lý do tách; nếu 7.5 hoá đơn cần nữa thì cân nhắc đổi tên/tách ở đó).
- Helper format HTML sống ở `orders/quote/quote-template.ts` và được `contracts/` import — chấp nhận cho tới khi có consumer thứ ba (7.5).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Nhãn Bên A/B của pháp nhân:** epics + F-4 ghi "pháp nhân bên A", nhưng 2 mẫu thật + mockup đặt công ty ở **Bên B**. Mặc định: in theo mẫu (công ty = Bên B), nội dung F-4 (đọc settings, không chặn) giữ nguyên. Nếu Đại Ca muốn công ty là Bên A thì phải sửa cả 2 mẫu gốc — báo lại.
2. **Lịch lệch tổng ⇒ chặn sinh hợp đồng (409):** mặc định chặn vì văn bản pháp lý không được cộng sai. Hệ quả: đơn mở lại khi đã có tiền (lịch khoá — 7.2 Câu hỏi mở 2) không sinh hợp đồng được cho tới khi có tính năng sửa phần lịch chưa thu. Nếu muốn cho sinh kèm cảnh báo, đổi nhánh 4 của `contractBlocker` thành cảnh báo trong overview.
3. **Chưa có lịch ⇒ chặn (409):** mặc định chặn. Thay thế: in câu thanh toán tĩnh của mẫu ("100% …") khi chưa có lịch.
4. **Hai nguồn thông tin công ty:** báo giá vẫn dùng hằng `COMPANY_INFO` (quyết định 4.8), hợp đồng dùng `system_settings`. Đề xuất story nhỏ sau: báo giá đọc cùng settings (đổi 4.8) để một chỗ sửa.
5. **Lỗi đánh số trong mẫu HĐ Thi công:** Điều 4 dùng mục "5.1/5.2" (mẫu gốc). Mặc định chép verbatim; nếu Đại Ca muốn sửa thành 4.1/4.2 thì sửa trong file điều khoản (một chỗ).
6. **Điều khoản có số cụ thể của từng vụ** ("10 ngày" thi công, "12 tháng" bảo hành công trình, "Hàng sẵn kho", phạt 8%/5%): mặc định tĩnh theo AC. Nếu cần chỉnh theo đơn ⇒ thêm trường động (story riêng, cần đổi AC FR-13).
7. **Đại diện/chức vụ khách là công ty (HĐMB):** `Customer` không có trường này ⇒ in dòng chấm điền tay. Thêm trường vào khách là story riêng (đụng Epic 3).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:176-178,609-635`] — Epic 7, Story 7.3 AC.
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md:207-213,398,551`] — FR-13, dữ liệu khách chảy vào hợp đồng, giả định mapping cờ.
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`] — AD-3 (R2, proxy), AD-4, AD-5, AD-10, AD-12, AD-14 (settings trên DB), AD-16, AD-17, AD-18; ERD `ORDER ||--o{ CONTRACT`; module tree `contracts/` (dòng 451, 477).
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md:40,148`; `mockups/all-screens.html:2622-2740` `#s-contract`].
- [Source: `docs/1. Khảo sát lắp đặt/HĐ THI CÔNG CT .docx`; `docs/2. Thương mại/HDMB CT QTS l2.pdf`] — điều khoản tĩnh + nhãn bên.
- [Source: `backend/src/orders/quote-export.service.ts`, `orders/quote/{quote-template,quote-renderer.port,puppeteer-quote-renderer,company-info}.ts`, `orders/orders.module.ts`] — pipeline 4.8.
- [Source: `backend/src/settings/{settings.service,settings.controller}.ts`, `settings/domain/{setting-registry,setting-events}.ts`] — khuôn settings 4.4.
- [Source: `backend/src/payments/payment-schedules.controller.ts`, `payments/payments.module.ts`, `payments/domain/payment-schedule.ts:37`] — khuôn controller/module 7.1-7.2, tập trạng thái.
- [Source: `backend/src/orders/orders.service.ts:1830-1910`] — `findScopedOrThrow`, `assertScoped`, `getScoped`, `getScopedTotal`.
- [Source: `backend/src/orders/domain/order-totals.ts:94`; `orders/domain/scope-preset.ts`] — `resolveOrderTotals`, bất biến `scopeThietBi: true`.
- [Source: `backend/test/no-unscoped-order-write.spec.ts:29-80`] — guard phạm vi.
- [Source: `backend/CONVENTIONS.md` mục Đặt tên, Prisma `@@map`, OpenAPI, Permission registry, Error envelope, Domain Event] .
- [Source: `web/src/screens/orders/OrderDetailScreen.tsx:87,481-489`; `mobile/lib/screens/orders/order_detail_screen.dart:89-102,390-410`; `design-system/screens/order-detail.test.mjs:258-273,358-366`] — lối vào bằng nút.
- [Source: `web/src/design-system/session/settings-port.ts`; `web/src/screens/settings/CustomerSourceConfigScreen.tsx:99-372`] — màn Cấu hình web-only.
- [Source: `_bmad-output/implementation-artifacts/7-2-ghi-nhan-thanh-toan-auto-chuyen-trang-thai.md`, `7-1-cau-hinh-lich-thanh-toan-nhieu-dot.md`, `4-8-xuat-chia-se-bao-gia-pdf-anh.md`] — learnings.
- [Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`] — luật 1-10.
- [Source: `_bmad-output/project-context.md`] — luật toàn dự án.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) — controller; web (T7) và mobile (T8) giao 2 subagent fullstack-developer chạy song song, controller nghiệm thu + sửa + parity guard.

### Debug Log References

- Trích 2 mẫu: `textutil -convert txt` (HĐTC) + `pdftotext -layout` (HĐMB). Script đối chiếu: 137/137 chuỗi điều khoản là chuỗi con NGUYÊN VĂN của nguồn (chuẩn hoá NFC + khoảng trắng). Nguồn .docx dùng ký tự tổ hợp (NFD) ở "THẦU" — file điều khoản giữ NFC; so sánh phải `normalize('NFC')`.
- `prettier --write` trên `settings.db.integration.spec.ts` thụt lề lại cả file (nợ prettier có sẵn ở baseline) ⇒ khôi phục bản gốc, chỉ thêm khối mới. `quote-export.service.ts` cũng bẩn prettier từ baseline (dòng `new QuoteExported(...)`), không đụng.
- Mô tả OpenAPI `ContractResponseDto.versionNo` ban đầu "…in vào hợp **đồng**" ⇒ `money-fields.mjs` (`/đồng/i`) coi `versionNo` là tiền ⇒ guard tiền ĐỎ cả `OrderDetailScreen` cũ. Đổi mô tả thành "Số thứ tự bản đơn (version) đã in." + regen. Ca AC-14 trong `contracts.test.mjs` khoá `versionNo/pdfSize/lineCount/seq` KHÔNG phải tiền.
- Puppeteer chưa tải Chrome (`~/.cache/puppeteer` trống) ⇒ smoke render bằng Chrome hệ thống qua `PUPPETEER_EXECUTABLE_PATH`; KHÔNG cài browser.

### Completion Notes List

- **Backend:** bảng `contracts` append-only (migration `20261022120000_add_contracts` + 2 CHECK tay, deploy CHỈ lên `pns-postgres:5433`, diff sau deploy rỗng); domain thuần `contract-type` (loại theo `scopeThiCong`, + `NOT_CONFIGURED_LABEL`), `contract-number` (`HĐTC/HĐMB-{seq}/{yyyy UTC+7}`, tên file ASCII, key R2 mỗi bản một key), `contract-eligibility` (`contractBlocker` 4 nhánh thứ tự cố định + `scheduleLabelOf`), `amount-in-words`, `contract-events` (`ContractGenerated`, target Order); `quoteNumberOf` dùng chung với `QuoteExportService` (output y nguyên, test 4.8 xanh); 7 key `company.*` seed rỗng + `SettingsService.companyLegalEntity/updateCompanyLegalEntity` (1 findMany; chỉ key đổi; 1 tx; 1 event/key SAU commit; vẫn 2 dependency) + `GET/PUT /settings/company-legal-entity`; template thuần + 2 file điều khoản verbatim; `QuoteRendererPort.renderPdf` (cùng singleton Chromium) + `OrdersModule` export port; `ContractsModule` 3 route `@Controller('orders')`, `ContractsService` đúng thứ tự scope → đọc → blocker → `nextval` → render → upload → create → publish, không `$transaction`, không khoá `orders`.
- **Web (T7) / Mobile (T8):** port + fake + màn "Sinh hợp đồng" hai nền tảng, nút "Hợp đồng" ở chi tiết đơn (`onOpenContracts`, vẫn đúng 3 tab), Frame pháp nhân ở màn Cấu hình web. Controller sửa thêm: comment tiếng Việt trong `CustomerSourceConfigScreen.tsx` → tiếng Anh; chuỗi lỗi dự phòng mobile đồng bộ byte với web ("Không xuất được hợp đồng. Vui lòng thử lại.").
- **Lệch có chủ đích so với mockup:** Loại HĐ hiển thị nhãn chỉ đọc, KHÔNG Seg chọn loại (D1 — server suy từ cờ; guard `contracts.test.mjs` khoá). Công ty in ở **Bên B**, khách **Bên A** theo 2 mẫu thật (Câu hỏi mở 1 vẫn mở).
- **Guard cập nhật có chủ đích:** `orders-module-wiring.spec.ts` khoá exports = `[OrdersService, QuoteRendererPort]` (trước: chỉ `OrdersService`) + ca `ContractsModule` chỉ provide `ContractsService`; `order-detail.test.mjs` bỏ 'Hợp đồng' khỏi danh sách cấm RAW-TEXT (như "Thanh toán" ở 7.1) nhưng vẫn cấm TAB 'Hợp đồng' + ca mới cổng nút theo `onOpenContracts` và khối `od-actions` mở theo callback; `no-unscoped-order-write.spec.ts` canh `contracts/contracts.service.ts` (CHAM_DON + `.contract.*`, `this.renderer.*`, `this.loadInputs(`) + anti-blind theo method.
- **Verbatim chặt hơn story yêu cầu:** commit text trích của 2 mẫu làm fixture (`backend/test/fixtures/contract-templates/`) — test khẳng định MỌI chuỗi trong 2 file điều khoản là chuỗi con của nguồn, nên sửa 1 chữ ở câu BẤT KỲ (không chỉ câu được chọn mẫu) cũng ĐỎ.
- **Lane DB race:** ban đầu mutant `seq = count()+1` SỐNG ở lane DB (2 `generate` song song không xen kẽ thật). Sửa ca test: renderer giả chặn ở barrier tới khi CẢ HAI request đã giữ số ⇒ mutant ĐỎ (P2002). Ca unit `nextval` cũng giết mutant này.
- **Bảng mutation TỰ CHẠY** (`cp` backup, mutant phải compile, khôi phục kiểm lại):

| Mutant | Lane | Kết quả |
|---|---|---|
| (a) đọc `contract` trước `getScoped` trong `generate` | guard phạm vi | ĐỎ |
| (a) `generate` bỏ quyền người gọi (ép view_all) | e2e 404 view_own | ĐỎ |
| (b) `assertScoped` đặt SAU `storage.getObject` trong `getPdf` | guard + e2e | ĐỎ / ĐỎ |
| (c) `findFirst` bỏ `orderId` khỏi `where` | e2e hợp đồng đơn khác | ĐỎ |
| (d) đảo mapping loại | domain + e2e | ĐỎ (7 ca) |
| (e) publish TRƯỚC create | unit | ĐỎ |
| (f) `seq = count()+1` | unit / DB (sau khi thêm barrier) | ĐỎ / ĐỎ |
| (g) bỏ nhánh lịch lệch tổng | domain + e2e | ĐỎ |
| (h) pháp nhân thiếu ⇒ chặn 409 | e2e + unit | ĐỎ (20 ca) |
| (i) 1 chữ ở câu được chọn mẫu (8%→9%) | template | ĐỎ |
| (i) 1 chữ ở câu KHÔNG chọn mẫu (Điều 7.3) | template (fixture nguồn) | ĐỎ |
| `updateCompanyLegalEntity` ghi cả 7 key | unit + e2e | ĐỎ |
| bỏ cổng `onOpenContracts` khỏi `od-actions` (web / mobile) | vitest / widget test | ĐỎ / ĐỎ |
| `contracts.test.mjs`: tiền thô, lệch nhãn, nút không ẩn, số học tiền | design-system | ĐỎ cả 4 |

  Mutant "bỏ qua blocker trong generate" (`=== undefined`) KHÔNG compile (TS narrowing) ⇒ bỏ, hành vi đã được (g)/(h) + ca 409 e2e phủ.
- **Smoke render thật (AC-13):** Chrome hệ thống, đơn 14 dòng + 3 đợt; HĐ Thi công 4 trang A4 (119.977 B), HĐ Mua bán 4 trang (120.469 B). `pdffonts`: Be Vietnam Pro Regular + SemiBold nhúng (CID, có unicode) — tiếng Việt đúng; header bảng lặp sang trang 2, không dòng nào bị cắt ngang trang, khối chữ ký nguyên một trang. File chỉ ở scratchpad, không commit.
- **5 lane cùng working tree:** backend `npm test` 110 suite / 2215 test xanh; `npm run test:db` 24 suite / 285 test xanh; design-system 469/469; web typecheck + vitest 9 file / 149 test + build xanh; mobile `flutter analyze` 0 issue + `flutter test` 407 xanh. ESLint + Prettier sạch trên mọi file backend MỚI; 2 file cũ bẩn prettier từ baseline (`quote-export.service.ts`, `settings.db.integration.spec.ts`) không đụng định dạng. `permissions.json` không đổi; OpenAPI có `GET/POST /orders/{id}/contracts`, `GET /orders/{id}/contracts/{contractId}/pdf`, `GET/PUT /settings/company-legal-entity`.
- **Còn mở (ngoài phạm vi, đã ghi):** chưa có composition root/router thật (TD-38) ⇒ chưa có caller nào truyền `onOpenContracts` theo `can(contractsGenerate)` trên web/mobile — màn và nút sẵn sàng, wiring theo quyền làm khi có router. Câu hỏi mở 1–7 giữ mặc định của story. Production cần Chrome cho puppeteer (`npx puppeteer browsers install chrome` hoặc `PUPPETEER_EXECUTABLE_PATH`) — cùng điều kiện với báo giá 4.8.

### File List

**Backend — mới**
- `backend/prisma/migrations/20261022120000_add_contracts/migration.sql`
- `backend/src/contracts/contracts.module.ts`
- `backend/src/contracts/contracts.controller.ts`
- `backend/src/contracts/contracts.service.ts`
- `backend/src/contracts/contract-template.ts`
- `backend/src/contracts/clauses/construction-clauses.ts`
- `backend/src/contracts/clauses/sale-clauses.ts`
- `backend/src/contracts/domain/contract-type.ts`
- `backend/src/contracts/domain/contract-number.ts`
- `backend/src/contracts/domain/contract-eligibility.ts`
- `backend/src/contracts/domain/amount-in-words.ts`
- `backend/src/contracts/domain/contract-events.ts`
- `backend/src/contracts/dto/contract-response.dto.ts`
- `backend/src/contracts/dto/contracts-overview-response.dto.ts`
- `backend/src/orders/domain/quote-number.ts`
- `backend/src/settings/domain/company-legal-entity.ts`
- `backend/src/settings/dto/company-legal-entity.dto.ts`
- `backend/test/amount-in-words.spec.ts`
- `backend/test/company-legal-entity.spec.ts`
- `backend/test/contract-domain.spec.ts`
- `backend/test/contract-template.spec.ts`
- `backend/test/contracts.service.spec.ts`
- `backend/test/contracts.e2e.spec.ts`
- `backend/test/contracts.db.integration.spec.ts`
- `backend/test/puppeteer-quote-renderer.spec.ts`
- `backend/test/fixtures/contract-templates/hd-thi-cong.txt`
- `backend/test/fixtures/contract-templates/hd-mua-ban.txt`

**Backend — sửa**
- `backend/prisma/schema.prisma`
- `backend/openapi/openapi.json` (regen)
- `backend/src/app.module.ts`
- `backend/src/orders/orders.module.ts`
- `backend/src/orders/quote-export.service.ts`
- `backend/src/orders/quote/quote-renderer.port.ts`
- `backend/src/orders/quote/puppeteer-quote-renderer.ts`
- `backend/src/orders/quote/quote-template.ts`
- `backend/src/settings/domain/setting-registry.ts`
- `backend/src/settings/settings.service.ts`
- `backend/src/settings/settings.controller.ts`
- `backend/test/no-unscoped-order-write.spec.ts`
- `backend/test/orders-module-wiring.spec.ts`
- `backend/test/settings.service.spec.ts`
- `backend/test/settings.e2e.spec.ts`
- `backend/test/settings.db.integration.spec.ts`

**Web**
- `web/src/design-system/session/contracts-port.ts` (mới)
- `web/src/design-system/session/fake-contracts-port.ts` (mới)
- `web/src/design-system/session/index.ts`
- `web/src/design-system/session/settings-port.ts`
- `web/src/design-system/session/fake-settings-port.ts`
- `web/src/screens/contracts/ContractsScreen.tsx` (mới)
- `web/src/screens/contracts/contracts.css` (mới)
- `web/src/screens/orders/OrderDetailScreen.tsx`
- `web/src/screens/settings/CustomerSourceConfigScreen.tsx`
- `web/src/test/contracts-screen.test.tsx` (mới)
- `web/src/test/screens-render.test.tsx`

**Mobile**
- `mobile/lib/design_system/session/contracts_port.dart` (mới)
- `mobile/lib/design_system/session/fake_contracts_port.dart` (mới)
- `mobile/lib/design_system/session/session.dart`
- `mobile/lib/screens/contracts/contracts_screen.dart` (mới)
- `mobile/lib/screens/orders/order_detail_screen.dart`
- `mobile/test/screens/contracts/contracts_screen_test.dart` (mới)
- `mobile/test/screens/orders/order_detail_screen_test.dart`

**Design-system guard**
- `design-system/screens/contracts.test.mjs` (mới)
- `design-system/screens/order-detail.test.mjs`
- `design-system/screens/settings-customer-sources.test.mjs`

**Tracking**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/7-3-sinh-hop-dong-thi-cong-mua-ban-pdf.md`

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI review, /ck:code-review + bmad-story-automator-review) · 2026-10-22 · **Outcome: Approve (sau khi sửa)**

Git ↔ File List: khớp (ngoài phạm vi: `.githooks/`, `backend/.claude/`, 2 file `docs/*.xlsx` — không thuộc story). 15 AC đối chiếu code + test: đạt. Không task [x] nào khống.

**Findings & xử lý**

| # | Mức | Finding | Xử lý |
|---|---|---|---|
| 1 | HIGH | Số HĐ cấp bằng `nextval` NGOÀI khoá; `generate` đọc trạng thái/lịch không khoá ⇒ TOCTOU: lịch bị thay / đơn mở lại / bản sửa chốt lại giữa lúc đọc và lúc ghi vẫn in HĐ theo dữ liệu cũ. Trái luật 7.3 của Đại Ca ("số hợp đồng tuần tự phải dưới khoá, có ca DB interleaving") | `generate` chạy trong MỘT `$transaction` (timeout 30 s vì render+upload nằm trong): op đầu `SELECT id FROM orders WHERE id = … FOR UPDATE`, đọc lại `status`/`currentVersionId` dưới khoá (version đổi ⇒ 409 *"Đơn vừa thay đổi — tải lại rồi sinh lại hợp đồng."*; status mới đi qua `contractBlocker`), đọc lịch/khách/version qua tx, rồi `nextval` → render → upload → `create`; publish SAU commit. **Lệch có chủ đích so với D10/AC-7 ("không $transaction, không khoá orders")** — luật Đại Ca thắng. |
| 2 | HIGH | Ca DB "2 sinh song song" dùng barrier trên CÙNG đơn — sẽ deadlock khi có khoá dòng đơn | Tách: barrier trên 2 đơn KHÁC nhau (mutant `count()+1` vẫn ĐỎ) + ca cùng đơn tuần tự hoá bởi khoá; thêm 2 ca **FORCED interleaving** (holder giữ khoá sửa số tiền đợt 1 / mở lại đơn ⇒ `generate` CHỜ rồi 409, 0 dòng) |
| 3 | MEDIUM | Web Cấu hình: Lưu pháp nhân khi GET chưa về/thất bại gửi 7 chuỗi rỗng ⇒ PUT thay toàn bộ ⇒ xoá sạch pháp nhân đã cấu hình | Form chỉ hiện khi đã tải xong; tải lỗi ⇒ ErrorState "Không tải được thông tin pháp nhân." + "Thử lại"; 2 ca test |
| 4 | MEDIUM | Web + mobile: sinh OK nhưng tải/chia sẻ lỗi ⇒ banner "Vui lòng thử lại" ⇒ bấm lại sinh HĐ THỨ HAI | Tách bước tải: *"Đã sinh hợp đồng {số} nhưng chưa tải được — bấm “Tải PDF” trong danh sách."* (byte-identical hai nền tảng); ca test web + mobile |
| 5 | LOW | Web hiện text tiếng Anh của lỗi JS/DOM (share bị từ chối); reload sau 409 lỗi ⇒ ErrorState che mất message 409 (mobile giữ view cũ) | `messageOf` chỉ nhận envelope (không phải `Error`/`DOMException`), fallback *"Không tải được file hợp đồng. Vui lòng thử lại."* (cả mobile); reload sau hành động giữ view tốt cuối; 2 ca test |
| 6 | LOW | Web test chưa đo UTC+7 (fixture 03:00Z cùng ngày) | Fixture 18:30Z ⇒ 22/10 |
| 7 | LOW | Ca web "nút Hợp đồng vắng khi không có callback" xanh hiển nhiên (`od-actions` không mở) | Thêm ca mở `od-actions` bằng `onOpenPaymentSchedule`, vẫn không có "Hợp đồng" |
| 8 | LOW | Fake port lệch backend/nhau: web `HĐTC-000001/2026`, file `HDTC-…`; `versionNo = seq`; mobile đảo `initial` | Fake theo shape backend (`HĐTC-{seq}/2026`, `hop-dong-thi-cong-{seq}`, `versionNo` = bản đơn); mobile giữ thứ tự port (mới nhất trước) + ca test thứ tự |

**Không đổi (có lý do):** `updateCompanyLegalEntity` đọc `before` ngoài khoá — cùng khuôn `updateVatRate` 4.4 (màn quản trị, sửa đồng thời hiếm; chỉ ảnh hưởng `before` trong audit). Nhãn loại HĐ lạ trên web: kiểu `ContractType` đóng theo enum backend.

**Kiểm luật Đại Ca (tự chạy, `cp` backup, không `git checkout`):**
- Gỡ `FOR UPDATE` khỏi `generate` ⇒ lane DB 2 ca interleaving ĐỎ; khôi phục ⇒ xanh.
- Chèn đọc `contract.count` trước `getScoped` trong `generate` ⇒ guard phạm vi ĐỎ; gỡ `assertScoped` khỏi `getPdf` ⇒ guard + 2 ca e2e ĐỎ.
- Gỡ tách bước tải sau khi sinh (web / mobile) ⇒ vitest / widget test ĐỎ; gỡ cổng "đã tải xong" của form pháp nhân ⇒ vitest ĐỎ.
- R2: không lane nào upload thật — e2e contracts override `StoragePort` bằng `fakeStorage`, lane DB truyền `fakeStorage` thẳng, unit dùng mock; lane hermetic không nạp `.env` và `.env` local không có biến `R2_*` (adapter thật ném "Thiếu cấu hình R2" nếu lỡ bị gọi).

**Lane sau sửa (cùng working tree):** backend `npm test` 110 suite / 2233 xanh · `npm run test:db` 288 xanh (pns-postgres:5433) · design-system 469/469 · web typecheck + vitest 155 + build xanh · mobile `flutter analyze` 0 issue + `flutter test` 410 xanh. ESLint/Prettier sạch trên file contracts đã sửa.

## Change Log

- 2026-10-22 — Dev story 7.3: sinh Hợp đồng Thi công / Mua bán PDF (bảng `contracts` append-only, 3 route `/orders/{id}/contracts`, pháp nhân công ty từ `system_settings` + `GET/PUT /settings/company-legal-entity`, template verbatim 2 mẫu thật, `renderPdf` dùng chung Chromium), màn "Sinh hợp đồng" web + mobile, nút "Hợp đồng" ở chi tiết đơn, Frame pháp nhân ở Cấu hình web; guard phạm vi/parity mở rộng; 5 lane xanh. Status → review.
- 2026-10-22 — Code review (AI): sinh HĐ chạy trong tx khoá dòng đơn (FOR UPDATE op đầu, đọc lại trạng thái/version/lịch dưới khoá, số HĐ cấp dưới khoá, publish sau commit) + 2 ca DB interleaving; sửa client: form pháp nhân không lưu được khi chưa tải, lỗi tải sau khi sinh không mời sinh lại, fallback lỗi tiếng Việt, fake theo shape backend. Status → done.
