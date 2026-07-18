---
baseline_commit: 4b0c90f9f5b92b5a05bad39f69bc8aaef9da9ea9
---

# Story 5.9: Tra cứu bảo hành theo SĐT khách hàng

Status: done

## Story

As a người chịu trách nhiệm bảo hành,
I want tra cứu bảo hành theo SĐT khách để hỗ trợ khách hàng,
so that biết đơn nào/item nào còn hạn bảo hành khi khách đang gọi tới.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Đây là story **DỰNG TÍNH NĂNG MỚI** (khác 5.8 vốn chỉ đóng lane test). Chạm cả ba nền tảng: backend + web + mobile. Nhưng **phần lớn nguyên liệu đã có sẵn** — dưới đây là danh sách những thứ **CẤM viết lại**.

### 1. Dữ liệu bảo hành ĐÃ CÓ TRONG DB từ Story 4.9 — không migration, không field mới

`backend/prisma/schema.prisma:432,436`:

```prisma
warrantyMonths       Int?         @map("warranty_months")
warrantyStartAt      DateTime?    @map("warranty_start_at")
```

Comment `:416` ghi rõ: `warrantyStartAt` = **ngày DÒNG ĐÓ chốt LẦN ĐẦU** (FR-36), đóng băng khi còn null lúc chốt (`orders.service.ts:1658-1659`), `revise()` copy nguyên si (`:1778`).

⚠️ **Đừng đọc lướt notecard mockup.** `all-screens.html#s-warranty-lookup` viết *"Mốc bảo hành tính từ ngày chốt đơn"*. Câu đó **không sai về chủ trương** — spine AD-20 (`:166`) nói y hệt: *"Bảo hành mốc từ ngày chốt đơn là quyết định có ý thức (đơn thi công chốt tháng 1, nghiệm thu tháng 4 → mất 3 tháng bảo hành)"* — ý là mốc lấy theo **ngày chốt**, KHÔNG phải ngày nghiệm thu.

Nó chỉ **thiếu một chữ**: chốt của **DÒNG ĐÓ**, không phải chốt của **ĐƠN**. Cùng AD-20 `:166` nói tiếp: *"warrantyStartAt đặt theo dòng, dòng cũ giữ ngày cũ, không gia hạn hết bảo hành"*. PRD FR-36 và màn báo giá (mockup `:1900`) đều ghi bản đầy đủ.

Hệ quả **duy nhất** cho story này: hai dòng cùng một Đơn **được phép** có `warrantyStartAt` khác nhau (dòng thêm ở version sau lấy ngày sau). Test **phải** có một case như vậy (AC-6). Story này chỉ **đọc** field, không đổi semantics.

**KHÔNG có migration trong story này.** Nếu bạn đang viết file trong `backend/prisma/migrations/`, bạn đi sai.

### 2. Hàm chuẩn hoá SĐT ĐÃ CÓ — dùng lại, cấm viết bản thứ hai

`backend/src/customers/domain/phone.ts:19` — `normalizeVnPhone(raw): string | null`. Doc-comment của chính nó (`:6-9`) đã ra lệnh: *"Đây là hàm DUY NHẤT của hệ thống biết cách biến SĐT thô thành khoá chính của `Customer` (AD-9) … hai chỗ chuẩn hoá là hai cơ hội lệch nhau, và lệch ở đây nghĩa là hai bản ghi cho cùng một người."*

`orders.service.ts:346` đã import thẳng hàm này — có tiền lệ, làm y hệt.

⚠️ `CustomersService.normalizeOrThrow` (`customers.service.ts:64-82`) là **`private`** — không gọi được từ ngoài. Bạn cần **lặp lại đúng cái envelope** đó ở chỗ mới (copy chuỗi từ source, đừng gõ lại từ trí nhớ):

```ts
throw new AppException(ErrorCode.VALIDATION_ERROR, 400, 'Số điện thoại không hợp lệ.', [
  { field: 'sdt', code: 'isPhoneNumber',
    message: 'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).' },
]);
```

Đây là **trường hợp duy nhất** được phép lặp trong story này, và chỉ vì method gốc là private. **Không** đổi `normalizeOrThrow` thành public để "dùng chung" — nó là cửa ghi của module `customers`, mở nó ra là mở một mặt tiếp xúc mới ngoài scope.

### 3. Formatter "5 năm / 18 tháng" ĐÃ CÓ ở BA nơi — cấm viết cái thứ tư

| Nền tảng | File | Symbol |
| --- | --- | --- |
| Backend | `backend/src/orders/quote/quote-template.ts:71` | `formatWarranty(months)` |
| Web | `web/src/design-system/components/CartLineRow.tsx:15` | `formatWarrantyMonths` |
| Mobile | `mobile/lib/design_system/components/cart_line_row.dart:32` | `formatWarrantyMonths` |

Quy tắc (PRD FR-36): `months % 12 === 0 ? "${months/12} năm" : "${months} tháng"`, `null` ⇒ `''`. Ba bản được ghim bởi `design-system/session/parity.test.mjs:332-339`.

⚠️ **Bẫy web**: `formatWarrantyMonths` **KHÔNG** được export từ barrel `web/src/design-system/components/index.ts` (mobile thì có, `components.dart:33`). Màn mới phải import thẳng từ `CartLineRow`, **hoặc** thêm đúng một dòng re-export vào barrel. Chọn cách nào cũng được — nhưng nếu thêm vào barrel, kiểm lại `design-system` test còn xanh.

⚠️ **Bẫy Dart**: phải `~/` (integer division). `60 / 12` trong Dart ra `5.0` ⇒ `"5.0 năm"`. Bản hiện có đã đúng — đừng "sửa" nó.

⚠️ **Formatter này chỉ ra MỘT đơn vị.** `143` ⇒ `"143 tháng"`, **không phải** `"11 năm 11 tháng"`. Mockup vẽ chuỗi ghép (`Còn 11 năm 11 tháng`) — **story chấp nhận lệch chỗ này**, xem "Nhãn hiển thị" ở Dev Notes. Viết formatter thứ tư để ghép năm+tháng là **ngoài phạm vi 5.9** (kéo theo 3 bản + ghim parity). Nếu Đại Ca muốn đúng mockup từng chữ, xem Câu hỏi mở #6.

⚠️ `formatWarrantyMonths(0)` trả `"0 năm"` (0 chia hết 12). Đừng để giá trị 0/âm chạy qua nó — nhánh `het_han` render chuỗi cố định, không gọi formatter.

### 4. Endpoint lookup theo SĐT ĐÃ CÓ TIỀN LỆ — chép hình dạng, đừng phát minh

`GET /customers/lookup` (`customers.controller.ts:106-127`, story 3.4). Ba điều phải bê nguyên:

1. **Route order trap** — comment `:101-105` cảnh báo: `@Get('lookup')` phải khai **TRƯỚC** `@Get(':sdt')`, không thì `:sdt` nuốt chuỗi `"lookup"` và trả 404 trông như lỗi dữ liệu. `orders.controller.ts` có `@Get(':id')` ⇒ **route mới của story này phải khai trước nó**. Có e2e khẳng định chuyện này ở phía customers — story này cũng phải có (AC-9).
2. **Không tìm thấy ⇒ 200, KHÔNG phải 404.** `CustomerLookupResponseDto:7-10`. Khách không tồn tại là **kết quả hợp lệ** của một phép tra, không phải lỗi.
3. **DTO query**: `@IsString() @IsNotEmpty() @MaxLength(32)` (`lookup-customer-query.dto.ts`).

### 5. Client CẤM tự tính — cả tiền, cả ngày

AD-16 cấm client làm số học tiền; AD-2 nói *"client chỉ hiển thị kết quả"*. Story này áp cùng tinh thần cho **ngày tháng**, vì lý do rất cụ thể:

- **Không nền tảng nào có sẵn thư viện ngày.** Mobile **không có** dep `intl`, zero `DateTime`/`DateFormat` trong `lib/`. Web không có date lib. Timestamps hiện đang được mang đi dưới dạng **chuỗi ISO thô**.
- Tự nặn `start + N tháng` ở hai client = **hai bản cài đặt của cùng một quy tắc**, và tháng là loại số học có bẫy thật (31/01 + 1 tháng = ?).

⇒ **Backend tính hết**: `warrantyEndAt`, `warrantyStatus`, `remainingMonths`. Client **chỉ render**. Xem AC-3/AC-4.

### 6. Web KHÔNG có tsc, KHÔNG có lint, KHÔNG có test runner

**`web/` không có `package.json`.** Màn web mới **không có test của riêng nó** — thứ duy nhất canh nó là:

- source-guard `design-system/screens/<tên>.test.mjs` — **đọc file dạng TEXT THÔ** (đây là TD-1);
- `backend/test/web-source-parses.spec.ts` — chỉ kiểm parse được.

⚠️ Bài học 4.x: **`.tsx` sai cú pháp lọt qua MỌI lane** nếu không có ai parse nó. Sau khi viết màn web, chạy `cd backend && npx jest web-source-parses` để chắc file parse được, trước khi tin bất kỳ màu xanh nào khác.

⚠️ Source-guard so khớp trên **CODE ĐÃ STRIP COMMENT**, không phải text hoàn toàn thô: `design-system/screens/order-cancel.test.mjs:42-49` định nghĩa `stripTsx`/`stripDart` và áp trước mọi assert (`backend/test/no-controller-error-envelope.spec.ts:11` cũng vậy). Guard mới **phải dùng lại đúng cặp helper đó** — tự viết bản strip thứ hai là mở đường cho hai guard lệch nhau. Hệ quả thực dụng: token bị cấm **được phép** nằm trong comment giải thích, nhưng **không** được nằm trong code.

---

## Quyết định đã chốt trong story này (đọc kỹ — đây là phần dev hay đoán sai)

Bốn điểm dưới đây **không có trong spine, không có trong UX doc**. Story chốt sẵn để dev không phải đoán. Lý do ghi kèm; nếu Đại Ca muốn đổi, xem "Câu hỏi còn mở".

| # | Quyết định | Lý do |
| --- | --- | --- |
| QĐ-1 | Ngưỡng **"Sắp hết" = còn ≤ 90 ngày**, khai bằng hằng có tên `NGUONG_SAP_HET_NGAY = 90` ở domain backend, **một chỗ duy nhất**. | Không tài liệu nào định nghĩa ngưỡng (đã grep toàn bộ `epics.md`, `prd.md`, `EXPERIENCE.md`, `DESIGN.md`, mockup). 90 ngày = 3 tháng, đủ để khách kịp xử lý. Đặt tên hằng để đổi sau là sửa một dòng. **KHÔNG** làm nó thành config/feature-flag — YAGNI, và Phase 1 không có màn cấu hình cho nó. |
| QĐ-2 | Gate quyền = `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`. **KHÔNG thêm khoá quyền mới.** | Registry (`permission-registry.ts`) có **21 khoá, không khoá nào về bảo hành**. Thêm khoá mới kéo theo regen 2 package (`backend npm run permissions:gen` → `design-system npm run build:permissions`) và guard parity `permission-keys.test.mjs` so `deepEqual` **theo thứ tự** — một nguồn lỗi lớn, đổi lấy giá trị bằng 0 ở Phase 1. Dữ liệu trả về **là nội dung đơn**, nên quyền đọc đơn là đúng loại quyền. |
| QĐ-3 | Kết quả **tôn trọng phạm vi đọc đơn hiện hành**: thiếu `orders.view_all` ⇒ chỉ thấy đơn mình `owner`/`assignee`. Dùng **đúng mệnh đề** của `findScopedOrThrow` (`orders.service.ts:1246-1254`). | Nhất quán với MỌI đường đọc đơn khác. Bịa một đường vòng qua phạm vi trong story tra cứu = tạo lỗ IDOR ngay cạnh nơi story 5.3 vừa bịt nó (`ListOrdersQueryDto:9-11` cấm client tự truyền scope param). |
| QĐ-4 | Backend tính `warrantyEndAt` / `warrantyStatus` / `remainingMonths`; client chỉ render. | Xem mục 🛑 §5. |

---

## Acceptance Criteria

### AC gốc (nguyên văn từ `epics.md:540-545`)

- **AC-1** — **Given** màn Tra cứu bảo hành, **When** nhập SĐT, **Then** backend chuẩn hoá E.164, tìm Khách hàng, trả danh sách đơn của khách với item có bảo hành (§3).
- **AC-2** — **Given** danh sách kết quả, **When** chọn Đơn, **Then** hiển thị: mỗi dòng vật tư + ngày bảo hành bắt đầu + số tháng bảo hành + hạn bảo hành (tính = ngày bắt đầu + số tháng) + trạng thái "Còn hạn" / "Sắp hết" / "Hết hạn" (§3).
- **AC-3** — **Given** Phase 1, **When** tra cứu, **Then** chỉ hiển thị thông tin bảo hành, KHÔNG tạo phiếu yêu cầu bảo hành hay vòng đời bảo hành (§3).

### AC bổ sung (dẫn xuất — đây là phần đo được)

- **AC-4** — `GET /orders/tra-cuu-bao-hanh?sdt=0903176968` ⇒ **200**. Backend chuẩn hoá qua `normalizeVnPhone` trước khi tra: `0903176968`, `+84903176968`, `84903176968`, `0903.176.968` **cùng trả một kết quả**. SĐT rác ⇒ **400** `VALIDATION_ERROR` + `fieldErrors[0].field === 'sdt'` (đo ở lane e2e — đây là lane DUY NHẤT đi qua ValidationPipe + exception filter).
- **AC-5** — SĐT hợp lệ nhưng **không có khách** ⇒ **200** với `{ found: false, sdt: '<E.164>', customer: null, orders: [] }`. **KHÔNG 404.**
- **AC-6** — Mỗi dòng trả về mang: `name`, `qty`, `unit`, `warrantyMonths`, `warrantyStartAt` (ISO, UTC), `warrantyEndAt` (ISO, UTC) = `warrantyStartAt` cộng `warrantyMonths` tháng, `remainingDays` (int, **âm khi đã hết hạn** — đây là số điều khiển `warrantyStatus`), `remainingMonths` (int, làm tròn **xuống** từ `remainingDays`, chỉ dùng để dựng câu hiển thị), `warrantyStatus` ∈ `'con_han' | 'sap_het' | 'het_han'`. Test **phải** có fixture một đơn với **hai dòng `warrantyStartAt` khác nhau** và assert `warrantyEndAt` của chúng khác nhau — đây là bằng chứng mốc theo DÒNG chứ không theo Đơn (FR-36).
  ⚠️ `remainingDays` là **bắt buộc**, không phải thừa: ranh giới AC-8 tính bằng NGÀY, còn `remainingMonths` của một dòng còn 1 ngày là `0` — không diễn đạt nổi biên. Client **không** tự suy status từ hai số này; nó đọc `warrantyStatus`.
- **AC-7** — Lọc ở **tầng API**: dòng có `warrantyMonths === null` **hoặc** `warrantyStartAt === null` **không** xuất hiện trong kết quả. Đơn không còn dòng nào có bảo hành **không** xuất hiện trong `orders[]`. (Công lắp / phí lắp đặt là dòng như vậy — schema comment `:125` xác nhận `warrantyMonths` nullable CÓ CHỦ ĐÍCH.)
  ⚠️ **Đây là lệch có ý thức so với mockup.** Mockup web (`all-screens.html:4538`) **vẫn vẽ** dòng "Công lắp đặt" ở dạng mờ với ô `Không có` / `—` / `Dịch vụ — không bảo hành`; mockup mobile thì **bỏ hẳn** (đếm "7 vật tư có bảo hành"). Story chọn **bỏ hẳn ở cả hai** vì: (a) endpoint là "tra cứu bảo hành", trả dòng không bảo hành là nhiễu; (b) hai nền tảng phải parity, và mockup tự mâu thuẫn ở chính điểm này. Xem Câu hỏi mở #7.
- **AC-8** — Ranh giới `warrantyStatus`, khoá bằng test biên (dùng ngày cố định inject vào service, **không** dùng `new Date()` sống trong assert):
  | Còn lại | Kỳ vọng |
  | --- | --- |
  | > 90 ngày | `con_han` |
  | đúng 90 ngày | `sap_het` |
  | 1 ngày | `sap_het` |
  | 0 ngày (đúng hôm hết hạn) | `sap_het` |
  | −1 ngày (quá hạn) | `het_han` |
- **AC-9** — Route `GET /orders/tra-cuu-bao-hanh` được khai **TRƯỚC** `@Get(':id')`; e2e chứng minh nó **không** rơi vào handler `:id` (nếu rơi, response sẽ là 404 "Không tìm thấy đơn hàng: tra-cuu-bao-hanh").
- **AC-10** — Phạm vi (QĐ-3): actor có `orders.view_all` thấy **mọi** đơn của khách; actor chỉ có `orders.view_own` thấy **chỉ** đơn mình owner/assignee — cùng một SĐT, hai actor, hai kết quả khác nhau, cùng **200**. Actor **không có cả hai quyền** ⇒ **403** `FORBIDDEN`.
- **AC-11** — Dòng đọc từ **bản hiệu lực**: chỉ line item thuộc `Order.currentVersionId` (AD-6 — *"con trỏ chân lý DUY NHẤT … 'bản hiệu lực' KHÔNG BAO GIỜ suy ra bằng timestamp hay số đếm version"*). Test phải có đơn **≥ 2 version** và assert dòng của version cũ **không** lọt vào kết quả.
- **AC-12** — Phase 1 read-only (AC-3 đo được): **không** endpoint POST/PATCH/DELETE nào được thêm cho bảo hành; **không** model Prisma mới; **không** migration. Khoá bằng test bất biến (xem Task 4). `git diff --stat backend/prisma/` rỗng là **mục Debug Log**, không phải AC-gate — không lane nào chạy được nó.
- **AC-13** — Màn web `WarrantyLookupScreen.tsx` + màn mobile `warranty_lookup_screen.dart` render được từ port giả, có đủ **4 state**: rỗng ban đầu / loading / không tìm thấy / có kết quả. Mobile có widget test thật; web có source-guard `.mjs` + parse check.
- **AC-14** — Port hai nền tảng **cùng hợp đồng** (`WarrantyPort.lookup(sdt)`), ghim bởi `design-system/session/parity.test.mjs`. Client **không** chuẩn hoá SĐT — gửi chuỗi thô (AD-9). Guard cấm literal chuẩn hoá SĐT trong màn.
- **AC-15** — Mọi gate hiện có giữ xanh: `cd backend && npm test && npm run build && npm run openapi:gen` (openapi **CÓ** drift — story này thêm endpoint, phải commit file sinh), `cd design-system && npm test`, `cd mobile && flutter test && flutter analyze`.
  ⚠️ `npm run lint` có **162 error nợ CÓ SẴN** (160 `prettier/prettier`, 27 file). AC là **"story thêm 0 error mới"**, không phải "lint xanh". Đo baseline bằng `git stash` các file của story rồi so số.

---

## Tasks / Subtasks

- [x] **Task 1 — Domain thuần: tính hạn + trạng thái (AC-6, AC-8)**
  - [x] Tạo `backend/src/orders/domain/warranty.ts` — **DOMAIN THUẦN**: không Nest, không Prisma, không `new Date()` bên trong (nhận `now` làm tham số ⇒ test biên xác định được).
  - [x] Export: `NGUONG_SAP_HET_NGAY = 90`; `tinhHanBaoHanh(startAt: Date, months: number): Date`; `soNgayConLai(endAt: Date, now: Date): number` (**âm khi quá hạn** — số điều khiển); `trangThaiBaoHanh(soNgayConLai: number): 'con_han' | 'sap_het' | 'het_han'` (nhận SỐ NGÀY, không nhận Date — biên AC-8 khi đó là phép so int thuần, test không phụ thuộc múi giờ); `soThangConLai(soNgayConLai: number): number` (làm tròn xuống, chỉ để hiển thị).
  - [x] Cộng tháng bằng `setUTCMonth` trên bản **copy** của Date (đừng mutate tham số). Xử lý tràn ngày cuối tháng: `31/01 + 1 tháng` ⇒ JS cho `03/03`. **Kẹp về ngày cuối của tháng đích** (`28/02`) — bảo hành không được dài thêm vì lịch. Viết test đúng case này.
  - [x] Test `backend/test/warranty.spec.ts`: bảng biên AC-8 + case tràn tháng + `warrantyMonths` không chia hết 12.

- [x] **Task 2 — DTO + service (AC-4, AC-5, AC-6, AC-7, AC-10, AC-11)**
  - [x] DTO in: `backend/src/orders/dto/warranty-lookup-query.dto.ts` — `sdt!: string` với `@IsString() @IsNotEmpty() @MaxLength(32)` (chép `lookup-customer-query.dto.ts`).
  - [x] DTO out: `backend/src/orders/dto/warranty-lookup-response.dto.ts` — `{ found, sdt, customer, orders: WarrantyOrderDto[] }`; `WarrantyOrderDto { id, maDon?, status, chotAt, lineItems: WarrantyLineItemDto[] }`; `WarrantyLineItemDto` theo AC-6.
    ⚠️ Field nullable **phải** khai `type` TƯỜNG MINH (`@ApiPropertyOptional({ type: String, nullable: true })`) — union `string | null` sinh `"type":"object"` làm hỏng codegen. Bug này đã sửa một lần ở 3.6, **đừng tái phạm**; doc-comment `order-line-item-response.dto.ts:3-5` ghi lại.
  - [x] `orders.service.ts` — thêm `traCuuBaoHanh(callerAccountId, quyen, sdtTho)`:
    1. `normalizeVnPhone(sdtTho)` ⇒ `null` thì ném envelope ở mục 🛑 §2.
    2. `customer.findUnique({ where: { sdt } })` ⇒ null thì trả `{ found: false, sdt, customer: null, orders: [] }` (AC-5).
    3. Query đơn: `where: { customerSdt: sdt, AND: <mệnh đề scope> }`. **Mệnh đề scope copy đúng từ `findScopedOrThrow:1246-1254`** — thiếu `orders.view_all` thì thêm `{ OR: [{ ownerAccountId }, { assigneeAccountId }] }`.
    4. Dòng: `orderLineItem.findMany({ where: { orderVersionId: { in: <currentVersionId của các đơn> }, warrantyMonths: { not: null }, warrantyStartAt: { not: null } } })` (AC-7, AC-11).
       ⚠️ Đơn có `currentVersionId === null` (chưa chốt) ⇒ **bỏ qua**, đừng để `undefined` lọt vào `in`.
    5. Map qua domain Task 1 với `now` lấy **một lần** ở đầu method (mọi dòng so cùng một mốc).
    6. Bỏ đơn còn 0 dòng (AC-7).
  - [x] ⚠️ **CẤM tự dựng error envelope trong controller/service** ngoài `AppException`. Guard `backend/test/no-controller-error-envelope.spec.ts` fail nếu chuỗi `traceId` xuất hiện trong `*.controller.ts`/`*.service.ts` (AD-5).

- [x] **Task 3 — Controller + route order (AC-4, AC-9, AC-10)**
  - [x] `orders.controller.ts`: `@Get('tra-cuu-bao-hanh')` khai **TRƯỚC** `@Get(':id')` (route đó ở **`:259`**), kèm comment giải thích bẫy.
    ⚠️ **File này đã có kỷ luật đó sẵn, đừng chép từ module khác**: `@Get('cho-duyet-chiet-khau')` ở `:198`, và comment ở `:225` ghi *"Route TĨNH `@Get()` root — khai TRƯỚC `@Get(':id')` theo kỷ luật thứ tự route của file này."* Chèn route mới vào khoảng **`:198`–`:232`**, cùng cụm route tĩnh. (`customers.controller.ts:101-105` là tiền lệ cùng loại ở module khác, đọc thêm nếu cần.)
  - [x] `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)` (QĐ-2). ⚠️ Guard `no-handler-without-require-permissions.spec.ts` fail nếu thiếu decorator; `no-permission-literal-outside-registry.spec.ts` fail nếu gõ literal `'orders.view_all'` thay vì `PERM.ordersViewAll`.
  - [x] Swagger: `@ApiOkResponse` + `@ApiBadRequestResponse(ErrorEnvelopeDto)` + `@ApiForbiddenResponse(ErrorEnvelopeDto)`, mô tả rõ "luôn 200 kể cả không tìm thấy".
  - [x] `npm run openapi:gen` — file **SẼ** đổi (story này thêm endpoint). Commit nó. `openapi-drift.spec.ts` so byte-for-byte.

- [x] **Task 4 — Test backend (AC-4→AC-12)**
  - [x] `backend/test/warranty-lookup.spec.ts` (lane unit, service): chuẩn hoá 4 dạng SĐT ⇒ một kết quả; không tìm thấy ⇒ `found:false`; lọc dòng không bảo hành; **hai dòng khác `warrantyStartAt` ⇒ hai `warrantyEndAt`** (AC-6); đơn 2 version ⇒ chỉ dòng bản hiệu lực (AC-11); phạm vi `view_own` thu hẹp mệnh đề `where` (AC-10).
  - [x] `backend/test/orders.e2e.spec.ts` (UPDATE): 200 happy path; 400 + `fieldErrors[0].field === 'sdt'` với SĐT rác; 403 khi thiếu cả hai quyền; **AC-9** — route không rơi vào `:id`.
    ⚠️ Bootstrap e2e: đặt `process.env.JWT_ACCESS_SECRET` ở **top-level module**, rồi `await import('../src/app.module')` **động** trong `beforeAll` (static import hoist ⇒ `JwtModule.register` vỡ). Helper có sẵn: `givenPermissions(...keys)` `:255-257`, `token()` `:259-261`.
  - [x] `backend/test/warranty-readonly.spec.ts` (AC-12): bất biến — trong `orders.controller.ts`, **mọi** handler có path chứa `bao-hanh` phải mang decorator `@Get` (không `@Post`/`@Patch`/`@Delete`/`@Put`); và `schema.prisma` không có model nào khớp `/^model Warranty/m`.
    ⚠️ Đừng phát biểu là *"không route nào trỏ `bao-hanh`"* — route của chính story này là `tra-cuu-bao-hanh`, guard sẽ đỏ ngay trên tính năng nó bảo vệ. Bất biến là **động từ đọc**, không phải sự vắng mặt.
    ⚠️ Diễn đạt bất biến trực tiếp ("Phase 1 chỉ đọc"), **không** nhắc mã story/AC trong tên test.

- [x] **Task 5 — Port + fake, hai nền tảng (AC-14)**
  - [x] `web/src/design-system/session/warranty-port.ts` + `fake-warranty-port.ts`; `mobile/lib/design_system/session/warranty_port.dart` + `fake_warranty_port.dart`.
  - [x] Hợp đồng: `lookup(String sdt) -> WarrantyLookup`. Doc-comment **phải** ghi "client không bao giờ tự chuẩn hoá SĐT" (mẫu: `customers-port.ts:5-9`).
  - [x] Fake port: dữ liệu mẫu bám mockup — khách `2 đơn có bảo hành`, có ít nhất một dòng `het_han` và một dòng `sap_het` để màn render đủ nhánh.
  - [x] `design-system/session/parity.test.mjs` (UPDATE): ghim hai port cùng shape.

- [x] **Task 6 — Màn web (AC-13)**
  - [x] `web/src/screens/warranty/WarrantyLookupScreen.tsx` + `warranty-lookup.css`. **Dùng lại** component design system: `Field` (input SĐT), `Card` (`--teal` cho tóm tắt khách), `Frame` (một frame / đơn), `Table`, `EmptyState`, `ErrorState`, `Skeleton`. **CẤM style ad-hoc** (AD-13).
  - [x] Cột theo mockup: `Vật tư | SL | Bảo hành | Hết hạn | Còn lại`.
  - [x] `formatWarrantyMonths` import từ `CartLineRow` (hoặc thêm re-export vào barrel — xem 🛑 §3).
  - [x] **Pill trạng thái bảo hành — KHÔNG có primitive dùng lại được, và đây là cách xử đúng.** Barrel web (`components/index.ts`) chỉ có chip **chuyên dụng**: `StatusChip` (10 trạng thái ĐƠN, không phải bảo hành), `CustomerTypeChip`, `ScopeFlag` — không có `Chip` tổng quát (mobile thì **có** `AppChip`, `chip.dart:12`; đây là lệch parity có sẵn, không phải việc của story này).
    ⇒ Render pill **ngay trong màn** bằng `<span className="chip …">` — dùng lại class `.chip` và token `--ok` / `--warn` / `--danger` đã có trong `components.css`. **Đây KHÔNG phải style ad-hoc** theo AD-13: nó tiêu thụ token + class của design system, không chế token mới. **CẤM** thêm component vào barrel design system (kéo theo ghim parity + widget test twin — phạm vi story khác) và **CẤM** hard-code mã màu hex.
    ⚠️ `.pill` trong mockup **không tồn tại** trong `web/src/design-system/` (grep = 0). Đừng chép selector từ mockup; class thật là `.chip`.
  - [x] Sidebar: thêm mục `{ key: 'warranty', icon: 'ic-phone', label: 'Tra cứu bảo hành', requiresAny: [PERM.ordersViewAll, PERM.ordersViewOwn] }` vào `SIDEBAR_NAV` (`web/src/design-system/shell/Sidebar.tsx:60-87`). Đặt ở section thứ nhất, sau `inventory`. `ic-phone` **đã có** trong icon SSOT (`design-system/icons/icons.json:58`) và chính mockup dùng nó cho mục này (`all-screens.html:905`) — dùng thẳng, không cần icon mới.
  - [x] `cd backend && npx jest web-source-parses` — bắt buộc, web không có tsc (🛑 §6).

- [x] **Task 7 — Màn mobile + widget test (AC-13)**
  - [x] `mobile/lib/screens/warranty/warranty_lookup_screen.dart`. Layout theo mockup mobile: `AppField` "SĐT khách" → `AppCard` teal tóm tắt → nhóm theo đơn → một dòng / vật tư, pill bên phải.
    ⚠️ **`AppListRow` KHÔNG TỒN TẠI.** `list-row` là class CSS của mockup, không phải widget. Widget thật trong barrel (`components.dart`): `AppCard` / `AppCardVariant` / `AppFrame`, `AppTable` / `AppTableRow` / `AppTableColumn` / `AppTableCellText`, `AppCartLineRow`, `AppField`, `AppEmptyState`, `AppErrorState`, `AppSkeleton`. Dựng dòng vật tư bằng `AppTableRow` trong `AppCard` — **đừng phát minh widget mới** (AD-13).
    ⚠️ Pill dùng **`AppChip`** (`chip.dart:12`) — chip tổng quát, caller truyền màu; lấy màu từ token `app_tokens.dart`, **không** hard-code hex. Đây là widget mobile ĐÃ CÓ mà web không có bản tương ứng (xem Task 6).
  - [x] Vào màn qua **tab Menu** (mockup `:904-908`), không phải bottom-nav tab riêng.
  - [x] `mobile/test/screens/warranty/warranty_lookup_screen_test.dart`. Mẫu: `mobile/test/screens/orders/order_detail_cancel_test.dart:101-120` — `_host()` trả `MaterialApp(home: Scaffold(body: Screen(port: ...)))`, `_tap()` gọi `ensureVisible` + `pumpAndSettle` trước.
    ⚠️ Bài học 5.7: fixture phải bật **MỌI điều kiện bao ngoài**, không thì assert bên trong xanh giả vì container ngoài đã false.
  - [x] Test đủ 4 state của AC-13 + một dòng `het_han` hiển thị khác `con_han`.

- [x] **Task 8 — Source-guard cho hai màn (AC-14)**
  - [x] `design-system/screens/warranty-lookup.test.mjs`. Mẫu: `order-cancel.test.mjs` — **dùng lại `stripTsx`/`stripDart`** của nó (`:42-49`), assert trên code đã strip comment.
  - [x] Guard cấm — trong **cả hai** file màn — những thứ sau:
    - Chuẩn hoá SĐT ở client: `'+84'`, `libphonenumber`, `replace(/\D` (AD-9 — client gửi chuỗi THÔ).
    - **Số học ngày tháng**: `setMonth`, `setUTCMonth`, `addMonths`, `Duration(days:`, `DateTime.now()`, `Date.now()` (QĐ-4 — backend tính hết).
    - Ngưỡng nghiệp vụ hard-code ở client: số `90`, chuỗi `NGUONG_SAP_HET`.
  - [x] ⚠️ **Guard KHÔNG được cấm literal `'con_han'`/`'sap_het'`/`'het_han'`.** Màn buộc phải viết ba chuỗi đó để ánh xạ `warrantyStatus` → màu chip và → nhãn tiếng Việt; cấm chúng là ra lệnh cho dev viết một màn không viết được. Thứ nguy hiểm cần chặn là **TỰ SUY RA** trạng thái, mà cách chặn đúng là cấm số học ngày + cấm ngưỡng 90 ở trên. Một màn `switch (line.warrantyStatus)` là **đúng kiến trúc**, không phải vi phạm.
  - [x] ⚠️ Bài học "source-guard mutate for false-PASS": sau khi guard xanh, **cố tình vi phạm** nó (nhét `'+84'` vào màn web) và xác nhận guard **ĐỎ**. Guard tự-sanity-test chỉ bắt được cái tác giả nó tưởng tượng ra.

- [x] **Task 9 — Chạy đủ gate (AC-15)**
  - [x] Hẹp trước: `cd backend && npx jest warranty` → rồi `npx jest orders.e2e` → rồi cả suite `npm test`.
  - [x] `cd backend && npm run build && npm run openapi:gen` (commit file sinh).
  - [x] `cd design-system && npm test`; `cd mobile && flutter test && flutter analyze`.
  - [x] `npm run lint`: đo baseline bằng `git stash` file story, so số **trước/sau**. Ghi con số thật vào Debug Log — **không** tuyên bố "lint xanh".
  - [x] Lane DB (`npm run test:db`) **cần Docker Desktop GUI**, thường không lên được từ shell agent. Nếu không chạy được ⇒ **báo là chưa chạy**, không tuyên bố xanh. Mọi AC phải đo được ở `npm test` không cần Docker.

- [x] **Task 10 — Kiểm chứng test KHÔNG xanh giả (bắt buộc)**
  - [x] Mutation trên **source** (không phải trên test), chạy lại, xác nhận **ĐỎ**, khôi phục:
    | Mutation | Test phải đỏ |
    | --- | --- |
    | `NGUONG_SAP_HET_NGAY` 90 → 0 | biên `sap_het` (AC-8) |
    | Bỏ điều kiện `warrantyStartAt: { not: null }` khỏi query | lọc dòng (AC-7) |
    | Đổi query dòng từ `currentVersionId` sang "version mới nhất theo `versionNo`" | AC-11 |
    | Gỡ mệnh đề scope `OR: [owner, assignee]` | AC-10 |
    | Đổi `found: false` ⇒ ném 404 | AC-5 |
  - [x] ⚠️ Mutation **phải compile được**, không thì cả suite đỏ vì lý do khác và chẳng chứng minh gì.
  - [x] ⚠️ **TUYỆT ĐỐI không `git checkout`** để khôi phục — code story chưa commit, checkout xoá sạch. `cp` backup trước khi mutate.
  - [x] ⚠️ Nếu một mutation vẫn XANH: có thể một **lớp phòng thủ khác** đã cứu nó. Mutate luôn lớp đó rồi kết luận.

---

## Dev Notes

### Hình dạng dữ liệu (đọc trước khi viết query)

`backend/prisma/schema.prisma`:

- `Customer` `:295` — **`sdt String @id`**: SĐT LÀ khoá chính, dạng E.164. `orders Order[]`.
- `Order` `:332` — `customerSdt` (FK → `Customer.sdt`, có `@@index([customerSdt])` ⇒ query theo SĐT rẻ), `currentVersionId String? @unique`, `status`, `ownerAccountId`, `assigneeAccountId`.
- `OrderVersion` `:384` — `versionNo`, `chotAt DateTime?`, `lineItems OrderLineItem[]`.
- `OrderLineItem` `:419` — `name`, `unit`, `qty`, `productId`, `warrantyMonths Int?` `:432`, `warrantyStartAt DateTime? :436`.

**Bản hiệu lực = `Order.currentVersionId`, chấm hết.** Schema comment `:314-316` (*"currentVersionId là CON TRỎ CHÂN LÝ DUY NHẤT … KHÔNG suy từ timestamp/đếm version"*) và AD-6 đều cấm suy ra bằng timestamp/đếm version. Tiền lệ đọc dòng: `orders.service.ts:1360`, `:2234` — `where: { orderVersionId: order.currentVersionId }`.

### Ngày giờ

Spine `Consistency Conventions:182`: `ISO-8601 UTC lưu trong DB; client hiển thị theo giờ VN (UTC+7)`.

⇒ Backend trả **ISO UTC**, và **`warrantyEndAt` phải đặt về `00:00:00Z`** — nó là mốc NGÀY, phần giờ không mang thông tin; để giờ khác 0 là mời gọi lỗi lệch múi khi client cắt chuỗi.

Client **không có date lib** (🛑 §5), nên hiển thị bằng phép cắt chuỗi ISO `YYYY-MM-DD` → `DD/MM/YYYY`. Vì `warrantyEndAt` đã ở `00:00:00Z`, phép cắt này **không lệch ngày**.

⚠️ Helper này **chưa tồn tại ở đâu cả** (grep: 0 `toLocaleDateString`/`split('T')` trong `web/src/screens/`, 0 `DateTime`/`DateFormat` trong `mobile/lib/`). Nó sẽ là code mới viết **hai lần** — đúng loại trùng lặp mà 🛑 §5 chống. Vì vậy **đặt đúng chỗ và ghim lại**:

- web: `web/src/screens/warranty/format-ngay.ts`
- mobile: hàm top-level `dinhDangNgay()` trong `warranty_lookup_screen.dart`

Cặp này **phải được thêm vào `design-system/session/parity.test.mjs`** cùng lúc với port (Task 5) — hai bản một quy tắc, ghim như `formatWarrantyMonths` đã được ghim. Đừng để nó trôi thành hai cách hiểu.

### Nhãn hiển thị — mockup và epic KHÔNG khớp, đây là cách xử

| Nguồn | Nói gì |
| --- | --- |
| `epics.md:544` (AC gốc) | trạng thái danh từ: `"Còn hạn"` / `"Sắp hết"` / `"Hết hạn"` |
| mockup `#s-warranty-lookup` | pill hiển thị **thời lượng**: `Còn 11 năm 11 tháng`, `Hết hạn 4 tháng trước` |

**Cách xử: backend trả cả hai loại dữ liệu, màn ghép thành ba nhãn.**

| `warrantyStatus` | Nhãn chip | Màu (token) |
| --- | --- | --- |
| `con_han` | `Còn {formatWarrantyMonths(remainingMonths)}` | `--ok` |
| `sap_het` | `Còn {formatWarrantyMonths(remainingMonths)}` | `--warn` |
| `het_han` | `Hết hạn` (chuỗi cố định) | `--danger` |

Ba điểm phải hiểu đúng, nếu không sẽ ra chuỗi vô nghĩa:

1. **Chấp nhận lệch mockup về chuỗi ghép.** Mockup vẽ `Còn 11 năm 11 tháng`; `formatWarrantyMonths` chỉ ra một đơn vị ⇒ thực tế là `Còn 143 tháng`. Story chọn **không** viết formatter thứ tư (3 bản + ghim parity, cho một chuỗi hiển thị). Xem Câu hỏi mở #6.
2. **Nhánh `het_han` KHÔNG gọi formatter.** `formatWarrantyMonths(0)` ⇒ `"0 năm"`; mockup mobile bản thân nó cũng chỉ in chữ `Hết hạn`. Bỏ luôn câu "hết hạn N tháng trước" — nó cần số âm đi qua một formatter không thiết kế cho số âm.
3. **`warrantyStatus` do backend quyết, màn chỉ ánh xạ.** `sap_het` và `con_han` hiển thị cùng một câu, **khác nhau ở màu** — nên đừng suy màu từ `remainingMonths`, suy từ `warrantyStatus`.

Chip: xem Task 6 (web: `.chip` + token, trong màn) và Task 7 (mobile: `AppChip`). `.pill` của mockup **không tồn tại** trong code.

### Copy cho state rỗng — UX không định nghĩa, story chốt

Mockup chỉ vẽ happy path. Precedent gần nhất (`EXPERIENCE.md#State Patterns`) là *"SĐT chưa có trong hệ thống." + nút "Tạo khách hàng mới"* — **CTA đó sai ngữ cảnh** ở đây (màn tra bảo hành không nên mời tạo khách). Chốt:

| State | Copy |
| --- | --- |
| Chưa nhập gì | `Nhập số điện thoại khách để tra cứu bảo hành.` |
| Không có khách | `SĐT chưa có trong hệ thống.` (không CTA) |
| Có khách, không đơn nào có bảo hành | `Khách này chưa có vật tư nào còn theo dõi bảo hành.` |
| Lỗi | thông báo cụ thể + `Thử lại` (`EXPERIENCE.md#State Patterns`, quy ước toàn hệ) |

Giọng văn: `EXPERIENCE.md#Voice and Tone` — "Con số + động từ", **cấm** đăng ký kiểu `"Lỗi" / "Error 400"`.

### Lane test — lane nào chứng minh được gì

| Lane | Lệnh | Chứng minh được | Bẫy |
| --- | --- | --- | --- |
| Domain unit | `npx jest warranty` | biên ngưỡng, cộng tháng, tràn cuối tháng | không chạm HTTP |
| Service unit | `npx jest warranty-lookup` | shape query, mệnh đề scope, lọc dòng | mock Prisma ⇒ không chứng minh SQL chạy thật |
| e2e in-memory | `npx jest orders.e2e` | **mã HTTP + ValidationPipe + envelope + route order** | lane DUY NHẤT đo được AC về mã HTTP |
| DB integration | `npm run test:db` | round-trip Postgres thật | **cần Docker GUI** — KHÔNG tính là bằng chứng AC |
| Web parse | `npx jest web-source-parses` | `.tsx` parse được | web không có tsc |
| Source-guard | `cd design-system && npm test` | text thô của màn | không render gì — không thay được widget test |

Tách lane bằng config, không bằng `describe.skip`: `backend/package.json:81-84` (`testPathIgnorePatterns` loại `.db.integration.spec.ts`) ⇒ `npm test` không bao giờ kéo lane DB kể cả khi `DATABASE_URL` đã export.

### Project Structure Notes

**NEW**
- `backend/src/orders/domain/warranty.ts`
- `backend/src/orders/dto/warranty-lookup-query.dto.ts`
- `backend/src/orders/dto/warranty-lookup-response.dto.ts`
- `backend/test/warranty.spec.ts`, `backend/test/warranty-lookup.spec.ts`, `backend/test/warranty-readonly.spec.ts`
- `web/src/design-system/session/warranty-port.ts`, `fake-warranty-port.ts`
- `web/src/screens/warranty/WarrantyLookupScreen.tsx`, `warranty-lookup.css`, `format-ngay.ts`
- `mobile/lib/design_system/session/warranty_port.dart`, `fake_warranty_port.dart`
- `mobile/lib/screens/warranty/warranty_lookup_screen.dart`
- `mobile/test/screens/warranty/warranty_lookup_screen_test.dart`
- `design-system/screens/warranty-lookup.test.mjs`

**UPDATE**
- `backend/src/orders/orders.service.ts`, `orders.controller.ts`
- `backend/openapi/openapi.json` (sinh — commit)
- `backend/test/orders.e2e.spec.ts`
- `web/src/design-system/shell/Sidebar.tsx`
- `web/src/design-system/session/index.ts` — **đừng quên**: MỌI port đều được re-export từ barrel này (`me-port`, `customers-port`, `orders-port`, `catalog-port`, kèm các fake). Bỏ sót thì `warranty-port` là port duy nhất nằm ngoài barrel.
- `design-system/session/parity.test.mjs`

**KHÔNG migration. KHÔNG model Prisma mới. KHÔNG khoá quyền mới.**

Quy ước tên: `backend/src/**` **kebab-case** (guard `backend/test/naming-convention.spec.ts`); web screen PascalCase `.tsx` + kebab `.css`; mobile snake_case `.dart`; test mobile mirror đường dẫn `lib/`.

⚠️ Module tree trong spine **không có** `warranty/`. Đó là lý do mọi thứ backend nằm trong `orders/` — spine mô tả `orders/` sở hữu *"Order hợp nhất, line items, versions, state machine, snapshot"*. Tạo module mới = drift khỏi spine. **Đừng tạo `backend/src/warranty/`.**

### Ranh giới với story khác

- **Phiếu yêu cầu bảo hành / vòng đời bảo hành** — Phase sau, PRD FR-36 loại trừ tường minh. AC-3 + AC-12 là hàng rào.
- **Nhắc sắp hết hạn (notification)** — Phase sau. PRD FR-36 nêu rõ *"không nhắc sắp hết hạn"*. Story này **hiển thị** state `sap_het`, **không** gửi thông báo nào, **không** đụng module `notifications/`.
- **`warrantyMonths` lúc lên đơn / `warrantyStartAt` đóng băng** — Story 4.9, đã done. Story này chỉ **đọc**.
- **Danh sách đơn / lọc đơn** — Story 5.3. Không tái sử dụng `ListOrdersQueryDto`, không mở rộng nó.

---

## Bài học từ story trước (áp thẳng vào story này)

Bốn bài học đã được nhúng thẳng vào Task 4 / 9 / 10 (lane e2e cho mã HTTP; mutation bắt buộc; đừng tin lane DB; nợ lint đo bằng stash). Ba cái còn lại, chưa có chỗ nào khác nhắc:

1. **Widget/e2e test xanh giả vì điều kiện bao ngoài** (5.7). Fixture phải bật MỌI điều kiện bao ngoài, không thì assert bên trong không đo gì.
2. **Story doc lệch khỏi spine nó trích** (5.1). Trước khi chép một con số/tên từ story cũ hay từ chính story này, `grep` lại.
3. **Đếm số lần gọi, không chỉ đọc `calls[0]`** (5.8 review). Nếu thêm assert nào trên mock, dùng `toHaveBeenCalledTimes`.

---

## Câu hỏi còn mở

1. **Ngưỡng "Sắp hết" = 90 ngày do story chốt (QĐ-1), không có nguồn nào.** Con số khác (60? 30?) ⇒ sửa một hằng + bảng biên AC-8.
2. **Epic liệt kê state "Sắp hết"; PRD FR-36 và notecard mockup nói Phase 1 "không nhắc sắp hết hạn".** Story đọc là: **hiển thị** state thì có, **gửi thông báo** thì không ("nhắc" = notification). Nếu ý là Phase 1 chỉ hai state, bỏ QĐ-1 và AC-8 rút còn hai dòng.
3. **QĐ-3 có thể chặn đúng người cần dùng.** Nhân viên trực tổng đài không owner/assignee đơn nào sẽ tra ra rỗng. Cách đúng khi đó là **cấp `orders.view_all` cho preset của họ** (`role-presets.ts`, một dòng) chứ không mở lỗ trong endpoint. Cần xác nhận preset nào.
4. **Màn không có trong IA chính tắc.** `EXPERIENCE.md#Information Architecture` liệt kê 25 màn, không có màn này; nó chỉ tồn tại trong `mockups/all-screens.html` (phần "PHÁT SINH 10/07/2026"). Sidebar web trong mockup **không** có mục bảo hành và còn đánh dấu "Khách hàng" active. Story chốt: thêm mục sidebar (Task 6). Nếu Đại Ca muốn giữ EXPERIENCE.md bất biến, cần một chỉnh sửa tài liệu riêng ngoài phạm vi 5.9.
5. **Notecard mockup ghi thiếu chính xác mốc bảo hành** ("từ ngày chốt đơn" thay vì "từ ngày DÒNG ĐÓ chốt lần đầu"). Chủ trương thì đúng và khớp spine AD-20 — chỉ thiếu một chữ. Story này không sửa mockup; nếu muốn chính xác từng chữ thì là một việc riêng.
6. **Chuỗi thời lượng lệch mockup.** Mockup vẽ `Còn 11 năm 11 tháng`; formatter đã có chỉ ra một đơn vị ⇒ thực tế `Còn 143 tháng`. Đúng mockup từng chữ cần formatter thứ tư (backend + web + mobile + ghim parity) — story cố ý không làm. Nếu Đại Ca thấy `143 tháng` khó đọc với khách, đây là việc nên tách riêng chứ không nhét vào 5.9.
7. **Dòng không có bảo hành: bỏ hẳn hay hiện mờ?** AC-7 chọn **bỏ hẳn ở cả hai nền tảng**. Mockup web vẽ dòng "Công lắp đặt" mờ với chữ `Dịch vụ — không bảo hành`, mockup mobile bỏ hẳn — mockup tự mâu thuẫn. Nếu Đại Ca muốn giữ dòng mờ (để nhân viên đọc đủ nội dung đơn cho khách), API phải trả cả dòng không bảo hành kèm cờ phân biệt, và AC-7 đảo lại.

---

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.9: Tra cứu bảo hành theo SĐT khách hàng] — AC gốc (`:540-545`)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.9] — `warrantyMonths`/`warrantyStartAt` semantics (`:471-478`)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-36: Bảo hành theo dòng vật tư] — mốc theo DÒNG; quy tắc "5 năm"/"18 tháng"; loại trừ Phase 1
- [Source: .../ARCHITECTURE-SPINE.md#AD-6] — `currentVersionId` là con trỏ chân lý DUY NHẤT tới bản hiệu lực
- [Source: .../ARCHITECTURE-SPINE.md#AD-9] — SĐT là PK `Customer`, E.164, chuẩn hoá CHỈ ở backend, client gửi chuỗi thô
- [Source: .../ARCHITECTURE-SPINE.md#AD-5] — một shape envelope, exception filter trung tâm là nơi DUY NHẤT tạo envelope
- [Source: .../ARCHITECTURE-SPINE.md#AD-12] — OpenAPI sinh từ code, cấm sửa tay
- [Source: .../ARCHITECTURE-SPINE.md#AD-13] — design-system-first, mọi màn dùng lại component/token, cấm style ad-hoc
- [Source: .../ARCHITECTURE-SPINE.md#AD-17] — registry quyền là SSOT, không permission literal ngoài registry
- [Source: .../ARCHITECTURE-SPINE.md#AD-20] — hai mốc đóng băng; version mới không gia hạn bảo hành dòng cũ
- [Source: .../ARCHITECTURE-SPINE.md#Consistency Conventions] — REST kebab-case, ISO-8601 UTC + hiển thị UTC+7, error shape
- [Source: .../ARCHITECTURE-SPINE.md#Backend module tree (NestJS)] — không có module `warranty/`; `orders/` sở hữu line items + versions
- [Source: .../ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-warranty-lookup] — layout web/mobile, cột bảng, pill, entry point qua tab Menu
- [Source: .../ux-designs/.../EXPERIENCE.md#State Patterns] — quy ước loading/empty/error
- [Source: .../ux-designs/.../EXPERIENCE.md#Foundation] — full parity web + mobile cho mọi màn nghiệp vụ
- [Source: backend/prisma/schema.prisma:125, 295, 314-316, 332-337, 364, 384, 416, 419-436]
- [Source: backend/src/customers/domain/phone.ts:3-19]
- [Source: backend/src/customers/customers.service.ts:64-82] — envelope 400 cho SĐT sai
- [Source: backend/src/customers/customers.controller.ts:101-127] — tiền lệ route lookup + bẫy thứ tự route
- [Source: backend/src/orders/orders.controller.ts:198, 225, 259] — kỷ luật route tĩnh trước `@Get(':id')` trong chính file sẽ sửa
- [Source: web/src/design-system/components/index.ts] — barrel: không có `Chip` tổng quát; `mobile/lib/design_system/components/chip.dart:12` — `AppChip` thì có
- [Source: design-system/screens/order-cancel.test.mjs:42-49] — `stripTsx`/`stripDart`, mẫu source-guard
- [Source: design-system/icons/icons.json:58] — `ic-phone` đã tồn tại trong icon SSOT
- [Source: backend/src/orders/orders.service.ts:1241-1268] — `findScopedOrThrow`, mệnh đề phạm vi
- [Source: backend/src/orders/dto/order-line-item-response.dto.ts:1-12] — quy ước DTO nullable phải khai `type`
- [Source: web/src/design-system/shell/Sidebar.tsx:60-87] — `SIDEBAR_NAV` + tiền lệ tái dùng icon
- [Source: _bmad-output/implementation-artifacts/5-8-nhanh-thi-cong-dang-thi-cong-nghiem-thu.md] — story trước: bài học mutation-test, lane DB, nợ lint

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

**Gate đã chạy (18/07/2026)**

| Lane | Lệnh | Kết quả |
| --- | --- | --- |
| Backend unit + e2e + guard | `cd backend && npm test` | **1405 pass / 77 suite** (trước story: 1391) |
| Backend build | `npm run build` | xanh |
| OpenAPI | `npm run openapi:gen` | `openapi.json` ĐỔI (thêm endpoint) — đã commit; `openapi-drift.spec.ts` xanh |
| Source-guard + parity | `cd design-system && npm test` | **378 pass / 0 fail** |
| Mobile | `cd mobile && flutter test` | **260 pass**; `flutter analyze` → No issues |
| Web parse | `cd backend && npx jest web-source-parses` | xanh (web không có tsc) |
| **DB integration** | `npm run test:db` | **CHƯA CHẠY** — cần Docker Desktop GUI, không lên được từ shell agent. Mọi AC đều đo được ở `npm test`. |

**Nợ lint — đo bằng số thật, không tuyên bố "lint xanh"**

- Baseline trước story: **162 error** (160 `prettier/prettier`).
- Ngay sau khi viết code: `174 error` ⇒ story thêm **12**, toàn bộ nằm trong 3 file MỚI.
- Chạy `npx prettier --write` **chỉ trên 3 file đó** (không đụng nợ có sẵn của `orders.service.ts`/`orders.controller.ts`/`orders.e2e.spec.ts`) ⇒ về **162 error**.
- ⇒ **Story thêm 0 error mới.** Nợ 162 vẫn còn nguyên, không thuộc phạm vi story này.

**Mutation testing (Task 10) — backup bằng `cp`, KHÔNG `git checkout`**

| Mutation trên source | Lane | Kết quả |
| --- | --- | --- |
| `NGUONG_SAP_HET_NGAY` 90 → 0 | `jest warranty` | **ĐỎ** (3 test biên) |
| Bỏ `warrantyStartAt: { not: null }` khỏi query dòng | `jest warranty-lookup` | **ĐỎ** |
| Đổi query dòng `currentVersionId` → theo `orderId` (suy bản hiệu lực từ đơn) | `jest warranty-lookup` | **ĐỎ** |
| Gỡ mệnh đề scope `OR: [owner, assignee]` | `jest warranty-lookup` | **ĐỎ** |
| `found: false` ⇒ ném 404 | `jest warranty-lookup` + `jest orders.e2e` | **ĐỎ** cả hai lane |
| Nhét `'+84'` vào màn web (kiểm chứng source-guard) | `design-system npm test` | **ĐỎ** đúng assert AD-9 |

⚠️ **Một mutation đầu tiên SỐNG SÓT và đó là lỗi của mutation, không phải của test.** Bản đầu đổi `order.currentVersionId` thành `order.currentVersion?.id` — trong fixture hai giá trị này là MỘT, nên mutation tương đương ngữ nghĩa và chẳng chứng minh gì. Bản đúng (đọc dòng theo `orderId` thay vì theo con trỏ) giết được test ngay. Ghi lại vì đây là cách một vòng mutation dễ tự lừa nhất.

Sau vòng mutation, thêm một test nữa cho AC-11 (`dòng của version CŨ không gom được vào đơn nào`) — trước đó AC-11 chỉ được đo qua hình dạng `where`, chưa đo phép GOM.

**Hai lệch so với story spec, đều có lý do đo được**

1. `test/warranty-readonly.spec.ts` **không dùng** `stripToCode` như story yêu cầu: helper đó xoá NGUYÊN string literal, mà route path chính là string literal ⇒ quét bản đã strip là quét tập rỗng và luôn xanh. Guard quét raw, có comment ghi rõ lý do. Test `expect(baoHanh.length).toBeGreaterThan(0)` chặn đúng kiểu guard-rỗng đó.
2. Bảng mobile dựng **2 cột** (Vật tư + Còn lại) thay vì 4-5 cột như web. Mockup mobile vốn là list-row 2 cột; ép 5 cột vào khung 330pt làm `AppChip` tràn 76px trong widget test (font test rộng hơn font thật). Chip thêm `FittedBox(scaleDown)` để nhãn dài (`Còn 138 tháng`) không bị cắt — đây là layout, không phải widget mới.

`orders-read-gate.spec.ts` phải cập nhật: guard đó là **hợp đồng có chủ đích** — mọi route đọc mang gate `orders.view_*` phải khai tường minh trong `ROUTE_DOC_MO_QUYEN_XEM`. Đã thêm `'Get tra-cuu-bao-hanh'` kèm lý do.

### Completion Notes List

- **Không migration, không model Prisma, không khoá quyền mới** — đúng AC-12. `git diff backend/prisma/` rỗng.
- Backend tính hết: `warrantyEndAt` (kẹp về ngày cuối tháng đích — `31/01 + 1 tháng ⇒ 28/02`, có test cả năm nhuận), `remainingDays` (âm khi quá hạn), `remainingMonths` (sàn 0), `warrantyStatus`. Domain thuần nhận `now` làm tham số nên biên AC-8 là phép so int xác định.
- Ngưỡng `NGUONG_SAP_HET_NGAY = 90` khai đúng MỘT chỗ ở domain backend; source-guard cấm số `90` xuất hiện trong cả hai màn.
- Chuẩn hoá SĐT dùng lại `normalizeVnPhone`; envelope 400 chép đúng chuỗi từ `customers.service.ts` (method gốc là `private`, không đổi nó thành public).
- Phạm vi đọc copy đúng mệnh đề `findScopedOrThrow`: `view_all` thấy mọi đơn của khách, chỉ `view_own` thấy đơn mình owner/assignee, thiếu cả hai ⇒ 403.
- Route `@Get('tra-cuu-bao-hanh')` khai trong cụm route tĩnh, TRƯỚC `@Get(':id')`; e2e chứng minh nó không rơi vào handler `:id` (assert thêm `orderRepo.findFirst` không hề được gọi).
- Port hai nền tảng cùng hợp đồng `lookup(sdt)`; cặp helper ngày `formatNgay()` / `dinhDangNgay()` được ghim trong `parity.test.mjs` cùng lúc với port — cả hai là phép CẮT CHUỖI ISO, không parse Date (client không có date lib).
- Nhãn chip: `con_han`/`sap_het` cùng câu `Còn {formatWarrantyMonths(remainingMonths)}`, khác **màu**; `het_han` là chuỗi cố định `Hết hạn` (không đưa số 0 qua formatter). Lệch mockup ở chuỗi ghép "11 năm 11 tháng" là **cố ý** — xem Câu hỏi mở #6.
- Source-guard **không** cấm literal `'con_han'/'sap_het'/'het_han'`; ngược lại nó ĐÒI cả ba có mặt, vì màn phải ánh xạ trạng thái ra nhãn. Việc này khiến màn web phải viết `case 'con_han':` tường minh thay vì chỉ `default:` — guard bắt được đúng chỗ đó lúc chạy lần đầu.
- Sidebar web thêm mục `warranty` dùng `ic-phone` (icon đã có trong SSOT, mockup cũng dùng đúng icon này cho mục này). Mobile vào màn qua tab Menu.

### File List

**NEW**

- `backend/src/orders/domain/warranty.ts`
- `backend/src/orders/dto/warranty-lookup-query.dto.ts`
- `backend/src/orders/dto/warranty-lookup-response.dto.ts`
- `backend/test/warranty.spec.ts`
- `backend/test/warranty-lookup.spec.ts`
- `backend/test/warranty-readonly.spec.ts`
- `design-system/screens/warranty-lookup.test.mjs`
- `web/src/design-system/session/warranty-port.ts`
- `web/src/design-system/session/fake-warranty-port.ts`
- `web/src/screens/warranty/WarrantyLookupScreen.tsx`
- `web/src/screens/warranty/warranty-lookup.css`
- `web/src/screens/warranty/format-ngay.ts`
- `mobile/lib/design_system/session/warranty_port.dart`
- `mobile/lib/design_system/session/fake_warranty_port.dart`
- `mobile/lib/screens/warranty/warranty_lookup_screen.dart`
- `mobile/test/screens/warranty/warranty_lookup_screen_test.dart`

**UPDATE**

- `backend/src/orders/orders.service.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/openapi/openapi.json` (sinh — commit)
- `backend/test/orders.e2e.spec.ts`
- `backend/test/orders-read-gate.spec.ts`
- `design-system/session/parity.test.mjs`
- `web/src/design-system/session/index.ts`
- `web/src/design-system/shell/Sidebar.tsx`
- `mobile/lib/design_system/session/session.dart`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-19 · **Kết quả:** Approve sau khi sửa 2 lỗi hiển thị

File List khớp git 1-1 (26 file, không thừa không thiếu). AC-4→AC-12 đo được thật ở lane đúng: e2e đi qua ValidationPipe cho mã HTTP, unit bắt hình dạng `where`, `it.each` bốn dạng SĐT khẳng định khoá tra đã chuẩn hoá TRƯỚC khi `findUnique`. Guard `warranty-readonly` quét raw có chủ đích và tự chặn kiểu guard-rỗng. Không migration, không model, không khoá quyền mới — AC-12 sạch.

**Hai lỗi tìm được, cùng nằm ở nhãn chip, cùng thoát mọi lane vì fixture tự né:**

**1. `remainingMonths` hụt đúng một tháng ở mọi mốc tròn năm (HIGH).** `soThangConLai` chia số ngày cho độ dài tháng trung bình `30.436875`. Bảo hành 5 năm tra NGAY hôm chốt cho `1826 / 30.436875 = 59.99 ⇒ 59`, và vì `formatWarrantyMonths` chỉ in "năm" khi chia hết 12, chip đọc **"Còn 59 tháng"** thay vì "Còn 5 năm" — trọn đời dòng đó. Bảo hành 2 năm ⇒ "Còn 23 tháng". Test cũ ghim chính hành vi sai (`soThangConLai(365) === 11`), và fixture 144 tháng vô tình rơi đúng số chia hết nên không ai thấy.
⇒ Đếm theo LỊCH (năm/tháng/ngày), trừ 1 khi chưa tới ngày tương ứng trong tháng đích. Chữ ký đổi thành `soThangConLai(endAt, now)`.

**2. Dòng sắp hết hạn đọc ra "Còn 0 năm" (HIGH).** `formatWarrantyMonths(0)` trả `"0 năm"` — story đã cảnh báo đúng cái bẫy này nhưng chỉ chặn ở nhánh `het_han`. Nhánh `sap_het` vẫn đưa 0 qua formatter, nên dòng còn 26 ngày — **đúng dòng khách gọi tới để hỏi** — hiện "Còn 0 năm" trên CẢ hai màn. Cả hai fake port đều ship sẵn dòng đó (`line-ac`, 14 ngày, `remainingMonths: 0`), và widget test chỉ phủ `con_han`/`het_han` nên không lane nào chạm tới.
⇒ Dưới một tháng trọn thì câu chuyển sang số NGÀY backend đã gửi; `remainingDays === 0` là ngày hết hạn mà dòng VẪN còn bảo hành nên in `Hết hạn hôm nay` (không phải "Còn 0 ngày"). Không phép tính nào thêm ở client — mọi số vẫn là số backend trả (QĐ-4 giữ nguyên).

**Sửa kèm test (mutation ĐỎ cả hai):**

| Mutation khôi phục code cũ | Lane | Kết quả |
| --- | --- | --- |
| `soThangConLai` quay về chia `30.436875` | `jest warranty` | **ĐỎ** 2 test |
| `_conLai` đưa thẳng `remainingMonths` qua formatter | `flutter test` | **ĐỎ** — không tìm thấy "Còn 26 ngày" / "Hết hạn hôm nay" |

Web không có widget test, nên thoả thuận nhãn hai màn được ghim ở `parity.test.mjs` — đó là lane DUY NHẤT nhìn thấy nửa web của giao kèo này.

**Lệch spec có ý thức:** AC-6 viết `remainingMonths` = "làm tròn xuống từ `remainingDays`". Cơ chế đó chính là nguyên nhân lỗi 1, trong khi mục đích AC-6 tự khai là "chỉ dùng để dựng câu hiển thị". Giữ mục đích, đổi cơ chế. `remainingDays` không đổi — nó vẫn là số điều khiển `warrantyStatus`, mọi biên AC-8 nguyên vẹn.

**Ghi nhận không sửa (LOW, ngoài phạm vi):** `include: { currentVersion: true }` nạp cả bản ghi version trong khi chỉ cần `chotAt` — `select` sẽ gọn hơn, nhưng đây là mẫu đang dùng ở các đường đọc khác, đổi riêng chỗ này là lệch nhịp.

**Gate sau khi sửa:** backend `npm test` **1410 pass / 77 suite**; `npm run build` xanh; `openapi:gen` không drift thêm; `design-system npm test` **379 pass**; `flutter test` **262 pass** + `flutter analyze` No issues; `npx jest web-source-parses` xanh; lint về đúng **162** baseline (0 error mới). Lane DB vẫn **CHƯA CHẠY** — cần Docker Desktop GUI.

## Change Log

| Ngày | Thay đổi |
| --- | --- |
| 2026-07-19 | Review: sửa 2 lỗi nhãn chip. `soThangConLai` đếm theo lịch thay vì chia ngày cho tháng trung bình (bảo hành 5 năm không còn đọc ra "Còn 59 tháng"); dòng dưới một tháng trọn đọc theo NGÀY thay vì "Còn 0 năm", đúng hôm hết hạn đọc "Hết hạn hôm nay". +4 test domain, +2 widget test mobile, +1 ghim nhãn parity (lane duy nhất thấy nửa web). Mutation ĐỎ cả hai. Lint giữ baseline 162. |
| 2026-07-18 | Dựng tra cứu bảo hành theo SĐT: domain tính hạn/trạng thái, `GET /orders/tra-cuu-bao-hanh` (đọc thuần, theo phạm vi quyền đọc đơn), port + màn web + màn mobile, source-guard hai màn. 14 test mới ở backend (6 domain-biên/tràn tháng, 8 service), 5 e2e, 2 bất biến read-only, 6 widget test mobile, 1 file source-guard. Mutation 6/6 ĐỎ. Lint: +0 error mới (baseline 162 giữ nguyên). Lane DB chưa chạy — cần Docker GUI. |
