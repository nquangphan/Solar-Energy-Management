---
baseline_commit: 13408c1
---

# Story 7.1: Cấu hình Lịch thanh toán nhiều đợt (chặn đợt đầu 0%)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền ghi nhận thanh toán (`payments.record`),
I want cấu hình Lịch thanh toán của một Đơn đã chốt thành nhiều đợt (vd 20/70/10), một đợt 100% hoặc tuỳ chỉnh, mỗi đợt theo % hoặc số tiền kèm mô tả điều kiện,
so that đơn có kế hoạch thu tiền rõ ràng, khớp tổng sau VAT, và Story 7.2 có sẵn các đợt để ghi nhận tiền + tự chuyển trạng thái.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-21, sau commit `13408c1`)

- **Chưa có gì của thanh toán.** `backend/src/payments/` CHƯA tồn tại; `schema.prisma` không có `PaymentSchedule`/`Installment`/`Payment`. Spine vẽ sẵn quan hệ `ORDER ||--|| PAYMENT_SCHEDULE`, `PAYMENT_SCHEDULE ||--o{ INSTALLMENT`, `INSTALLMENT ||--o{ PAYMENT` và module `payments/  # PaymentSchedule, Installment, Payment; auto-transition trigger (FR-11, FR-12, FR-8)` [Source: ARCHITECTURE-SPINE.md#Backend module tree, ERD]. Story này tạo **CHỈ** `PaymentSchedule` + `Installment`; `Payment` là của 7.2.
- **Hợp đồng mốc → sự kiện đã có từ 5.2** — `backend/src/orders/domain/auto-transition-map.ts`: `MOC_TU_DONG = { coc: 'coc', tatToan: 'tat_toan' }`, `suKienChoMoc()`. Docstring nói rõ: *"7.1 sở hữu **giá trị**: gắn một `MocTuDong` lên từng `Installment` của Lịch thanh toán (cột cấu hình). File này KHÔNG tạo cột."* ⇒ 7.1 PHẢI có cột `milestone` trên `Installment`, giá trị lấy từ `MOC_TU_DONG` (KHÔNG literal mới). KHÔNG sửa file `auto-transition-map.ts`.
- **Tổng sau VAT của Đơn KHÔNG lưu cột** — tính bằng `computeOrderTotals()` (`orders/domain/order-totals.ts`, hàm pricing DUY NHẤT, AD-16). Luật phân giải đầu vào (vatRate/applyVat/discountAmount theo snapshot version hay giá trị sống) hiện nằm **riêng tư** trong `QuoteExportService.exportQuote()` (`backend/src/orders/quote-export.service.ts:80-98`, mô tả ở docstring đầu file dòng 25-30). Dòng hiệu lực + giá đã phân giải (snapshot-first, live cho `baogia`) lấy qua `OrdersService.getScoped()` (`orders.service.ts:1829`) → `viewOf()` → `toViews()`.
- **Phạm vi đơn:** `OrdersService.findScopedOrThrow()` (private, `orders.service.ts:1776`) — ngoài phạm vi ⇒ 404 CÙNG thông điệp với không tồn tại. Cửa công khai cho service khác: `assertScoped()` / `getScoped()`. `OrdersModule` ĐÃ `exports: [OrdersService]` với lý do ghi sẵn cho `payments/` (`orders.module.ts` docstring) — `payments` import `OrdersModule`, KHÔNG bao giờ chiều ngược lại.
- **Khoá dòng:** `lockOrderRow` (`orders.service.ts:559`) = `tx.$queryRaw\`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE\`` — private. Thứ tự khoá toàn hệ thống: `orders` FOR UPDATE là op ĐẦU TIÊN [Source: backend/CONVENTIONS.md#Khoá dòng & test đồng thời].
- **Quyền:** `PERM.paymentsRecord = 'payments.record'` (label "Ghi nhận thanh toán", group `payments`) đã có trong `accounts/domain/permission-registry.ts:48,104`; preset `ADMIN`/`SUPER_ADMIN` + 2 preset khác (`role-presets.ts:38,68,82`) đã mang key này. **KHÔNG thêm key quyền mới** (ma trận PRD §4.6 chỉ có "Ghi nhận thanh toán" cho cả cụm thanh toán — PRD dòng 266) ⇒ `permissions.json` + generated FE keys KHÔNG đổi.
- **Settings/feature flag:** `SettingsService.vatRatePercent()` (`settings/settings.service.ts:28`), cờ giá phân tầng resolve ở controller (`OrdersController.tieredPricingEnabled()` `orders.controller.ts:133`) — khuôn "controller resolve tươi mỗi request rồi truyền số xuống service".
- **Error:** `AppException(errorCode, status, message, fieldErrors?)` — KHÔNG có `details`. Mã có sẵn: `VALIDATION_ERROR`/`NOT_FOUND`/`CONFLICT`… (`common/errors/error-code.ts`).
- **Event/Audit:** `AuditSubscriber.handle(event)` ghi MỌI `DomainEvent` (generic). Khuôn event: `orders/domain/order-events.ts` (`OrderCancelled`: `target = { type: 'Order', id: orderId }`).
- **Client:** web `web/src/screens/orders/OrderDetailScreen.tsx` có ĐÚNG 3 tab và comment dòng 97-99 *"Thanh toán + Hợp đồng/Hoá đơn are Epic 7 — rendering an empty tab for a feature that does not exist promises the user something nobody built"*; prop tuỳ chọn `onChangeStatus?: () => void` (nút chỉ render khi có prop) là khuôn để thêm lối vào màn Thanh toán. Mobile tương đương `mobile/lib/screens/orders/order_detail_screen.dart` (`onChangeStatus` dòng 87-97, 383-397). Transport đi qua **port tiêm + fake** (`web/src/design-system/session/*-port.ts` + `fake-*-port.ts`; mobile `mobile/lib/design_system/session/*_port.dart` + `fake_*_port.dart`). Chưa có router/HTTP adapter (TD-38) — giữ khuôn port + fake.
- **Tiền phía client:** `<Money>`/`formatVnd` (web, `web/src/design-system/components/Money.tsx`, `format-vnd.ts`), `MoneyText`/`formatVnd` (Flutter). Guard `design-system/money/money-render-guard.test.mjs` đọc danh sách field tiền TỪ `openapi.json` (`money-fields.mjs`: property số có description chứa "đồng") ⇒ **mọi field tiền mới trong DTO phải có description nói "số nguyên đồng"** thì guard mới canh được.
- **UX đã vẽ** (`ux-designs/…/mockups/all-screens.html:2463+`, `#s-payments`, web + mobile, route minh hoạ `/don-hang/DH-2048/thanh-toan`): header "DH-2048 · CÔNG NỢ / Lịch thanh toán"; khối "Tiến độ công nợ" (Đã thu / Còn lại / Tổng đơn 83.010.960đ); bảng "Các đợt thanh toán" cột `Đợt · Số tiền · Trạng thái` — `Đợt 1 · Cọc 20%` 16.602.192, `Đợt 2 · Thi công 70%` 58.107.672 *"Đến hạn khi thi công"*, `Đợt 3 · Nghiệm thu 10%` 8.301.096 *"Đến hạn khi bàn giao"*; form "Ghi nhận thanh toán · Đợt 2". **Khối Tiến độ công nợ / trạng thái Đã thu–Chưa thu / form Ghi nhận là của 7.2** — 7.1 chỉ dựng phần Lịch (xem + sửa). EXPERIENCE.md:39 (`s-payments` — "Cấu hình Lịch, ghi nhận từng đợt"), :85/:121 (Dialog chỉ cho hành động có hệ quả tiền — ghi thanh toán, không phải lưu lịch), :172-176 (flow Kế toán Lan; *"tổng các đợt lệch tổng sau VAT → cảnh báo"*).
- **Kiểm số mockup** (đã chạy tay, phải khớp test): 83.010.960 × 20% = 16.602.192; × 70% = 58.107.672; × 10% = 8.301.096; tổng = 83.010.960 — chia hết, không dư.

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Mô hình dữ liệu (migration mới `20261021130000_add_payment_schedules`).**

```prisma
/// Lịch thanh toán của MỘT Đơn (FR-11) — tối đa một lịch mỗi đơn (`orderId` unique).
model PaymentSchedule {
  id           String        @id @default(uuid())
  orderId      String        @unique @map("order_id")
  order        Order         @relation(fields: [orderId], references: [id])
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  installments Installment[]

  @@map("payment_schedules")
}

/// Một đợt thanh toán. `amount` = số nguyên đồng ĐÃ PHÂN GIẢI lúc lưu (AD-10).
/// `percent` = % người dùng nhập (null nếu nhập số tiền). `milestone` = mốc tự động
/// (`MOC_TU_DONG` của 5.2) do SERVER gán theo vị trí — 7.2 đọc cột này.
model Installment {
  id            String          @id @default(uuid())
  scheduleId    String          @map("schedule_id")
  schedule      PaymentSchedule @relation(fields: [scheduleId], references: [id])
  seq           Int
  percent       Int?
  amount        Int
  conditionNote String          @map("condition_note")
  milestone     String?
  createdAt     DateTime        @default(now()) @map("created_at")

  @@unique([scheduleId, seq])
  @@map("installments")
}
```
- Thêm `paymentSchedule PaymentSchedule?` vào `model Order`.
- **CHECK viết tay trong migration** (Prisma không model CHECK — [Source: project-context.md#Testing]): `installments_amount_positive` (`amount > 0`), `installments_percent_range` (`percent IS NULL OR percent BETWEEN 1 AND 100`), `installments_seq_positive` (`seq >= 1`), `installments_milestone_known` (`milestone IS NULL OR milestone IN ('coc','tat_toan')`). `amount > 0` biến luật "đợt đầu không được 0" thành bất biến DB, không chỉ lời hứa ở app.
- FK mặc định (Restrict) — KHÔNG cascade. Lịch không bao giờ bị xoá ở 7.1 (chỉ thay đợt).
- **KHÔNG** lưu `basisTotal`/`orderVersionId` trên lịch (YAGNI): độ lệch so với tổng đơn được tính lại MỖI lần đọc, nên đơn mở lại/re-chốt đổi tổng thì lịch tự hiện cảnh báo lệch.

**D2 — Phân giải số tiền: domain THUẦN `backend/src/payments/domain/payment-schedule.ts`** (không Nest/Prisma, khuôn `orders/domain/*`).
- Input mỗi đợt: **đúng một** trong `percent` (Int 1..100) hoặc `amount` (Int ≥ 1, ≤ 2_000_000_000) + `conditionNote`.
- `amount_i = Math.floor((orderTotal * percent_i) / 100)` — số học NGUYÊN (`orderTotal * percent` là tích hai số nguyên, < 2^53; KHÔNG `Math.round(x * 0.2)`, KHÔNG nhân số thực).
- **Phần dư làm tròn:** CHỈ khi MỌI đợt nhập theo % VÀ Σpercent = 100 ⇒ đợt CUỐI nhận `orderTotal − Σ(các đợt trước)` để Σ = orderTotal tuyệt đối. Trộn %/số tiền hoặc Σ% ≠ 100 ⇒ không bù (lệch sẽ hiện qua cảnh báo D4). Test ví dụ dư: total 100.000.001, 20/70/10 ⇒ 20.000.000 / 70.000.000 / 10.000.001.
- **Mốc tự động gán theo vị trí (server, KHÔNG nhận từ client):** đợt 1 ⇒ `MOC_TU_DONG.coc`; nếu có ≥ 2 đợt, đợt cuối ⇒ `MOC_TU_DONG.tatToan`; đợt giữa ⇒ `null`. Lịch 1 đợt (100%) ⇒ đợt duy nhất mang `coc`. Lý do: FR-8 "đủ đợt cọc đầu ⇒ Đã cọc" ⇒ đợt đầu LUÔN là cọc (đó cũng là lý do luật chặn đợt đầu 0%); để client tự gán mốc mở ra cấu hình vô nghĩa (hai đợt `coc`, `coc` ở đợt 3) mà không ai cần. Cách 7.2 suy "tất toán" cho lịch 1 đợt là việc của 7.2 (ghi Câu hỏi mở 1).
- **Luật chặn đợt đầu 0%** (AC4): hàm domain trả lỗi có cấu trúc `{ field: 'installments.0.percent' | 'installments.0.amount', code: 'firstInstallmentZero' }` khi đợt 1 phân giải ra `amount <= 0`; đợt `i > 0` phân giải ra ≤ 0 (vd 1% của tổng rất nhỏ) ⇒ `{ field: 'installments.{i}.amount', code: 'resolvedZero' }`. Service dịch sang `AppException(VALIDATION_ERROR, 400, 'Lịch thanh toán không hợp lệ.', fieldErrors)` với message tiếng Việt từng field (vd *"Đợt đầu (cọc) phải lớn hơn 0."*). Chặn tại **cấu hình** (lúc lưu lịch) — đúng như AC; không có đường "áp lịch vào đơn" riêng ở thiết kế này.
- Hàm trả `{ installments: ResolvedInstallment[]; scheduledTotal: number }` — `scheduledTotal = Σ amount` tính ở ĐÂY, client không cộng.

**D3 — Tổng sau VAT: KHÔNG viết bộ phân giải thứ hai.**
- Trích luật phân giải `quote-export.service.ts:80-98` (vatRate/applyVat/discountAmount) thành hàm thuần `resolveOrderTotals(...)` trong `orders/domain/order-totals.ts` (gọi `computeOrderTotals` bên trong — vẫn MỘT hàm pricing, AD-16). `QuoteExportService` chuyển sang gọi hàm này (hành vi không đổi; test 4.8 hiện có phải xanh nguyên).
- Thêm method công khai `OrdersService.getScopedTotal(callerAccountId, perms, orderId, vatRatePercent, tieredPricingEnabled): Promise<{ order: Order; total: number }>` — đi qua `findScopedOrThrow` (404 cùng thông điệp), nạp `viewOf` + `orderVersion` hiệu lực, gọi `resolveOrderTotals`. Đơn 0 dòng ⇒ total 0 (không ném — GET vẫn phải trả được).
- `payments` controller resolve `vatRatePercent` + `tieredPricingEnabled` TƯƠI mỗi request (khuôn `OrdersController`) ⇒ `PaymentsModule` import `OrdersModule`, `SettingsModule`, `FeatureFlagsModule`.

**D4 — Cảnh báo lệch tổng = LƯU ĐƯỢC + cảnh báo (không chặn).**
- FR-11 + AC2: *"cảnh báo nếu tổng ≠ tổng sau VAT"* — cảnh báo, không chặn. PUT hợp lệ luôn lưu; response mang `orderTotal`, `scheduledTotal`, `difference` (= `orderTotal − scheduledTotal`, server tính, có thể âm), `totalMatches` (boolean). GET trả cùng các field (tính lại với tổng HIỆN TẠI của đơn) ⇒ đơn mở lại/re-chốt làm lệch thì màn tự hiện cảnh báo.
- Client hiển thị `<Banner>` cảnh báo khi `totalMatches === false`, in `orderTotal`/`scheduledTotal`/`difference` qua `<Money>`/`MoneyText` — **client CẤM tự cộng/trừ** (guard money + AD-16).
- Vì sao không "xác nhận trước khi lưu" (EXPERIENCE.md:176): client không được cộng tiền nên muốn cảnh báo TRƯỚC lưu phải thêm một endpoint preview stateless hoặc vòng 409-rồi-gửi-lại. Cả hai là bề mặt API thêm cho một cảnh báo không chặn; lưu-rồi-cảnh-báo vẫn sửa lại được ngay trên cùng màn. Ghi Câu hỏi mở 2.

**D5 — Khi nào được sửa lịch.**
- `PUT` chỉ khi `order.status ∈ {dachot, dacoc, thicong, nghiemthu, danggiao, dagiao}` (dùng hằng `TRANG_THAI_*` của `orders/domain/order-status.ts`, KHÔNG literal) — đơn đã có snapshot giá nên tổng ổn định. `baogia`/`choduyet` (tổng còn sống) và `hoanthanh`/`huy` (đóng) ⇒ `409 CONFLICT` *"Chỉ cấu hình lịch thanh toán khi đơn đã chốt và chưa đóng."*
- `GET` được ở MỌI trạng thái (đọc). Response có `editable: boolean` = status thuộc tập trên — server quyết, client chỉ ẩn/hiện nút Sửa (kèm `can(payments.record)`).
- Khi 7.2 thêm `Payment`, sửa đợt đã có tiền sẽ đụng FK Restrict ⇒ 7.2 PHẢI đổi luật sửa (ghi Câu hỏi mở 3). 7.1 KHÔNG dựng trước cho 7.2.

**D6 — Ghi = THAY TOÀN BỘ dưới khoá dòng đơn** (`backend/src/payments/payment-schedules.service.ts`).
Thứ tự BẮT BUỘC trong `replace(...)`:
1. `orders.getScopedTotal(...)` — phạm vi TRƯỚC mọi thao tác (404 ngoài phạm vi/không tồn tại); lấy `order` + `total`.
2. Kiểm status (D5) ⇒ 409.
3. `resolveInstallments(total, dto.installments)` (D2) ⇒ 400 + fieldErrors nếu lỗi. Lỗi validate xảy ra TRƯỚC khi mở tx (từ chối không tốn khoá).
4. `this.prisma.$transaction(async (tx) => …)`:
   a. `await tx.$queryRaw\`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE\`` — op ĐẦU TIÊN.
   b. Đọc LẠI `tx.order.findUnique({ select: { status, currentVersionId } })`: status rời tập D5 hoặc `currentVersionId` khác lần đọc ở bước 1 ⇒ `409 CONFLICT` *"Đơn vừa thay đổi — tải lại rồi cấu hình lại lịch."* (tổng ở bước 1 đã không còn là tổng của đơn).
   c. Đọc lịch hiện có (`paymentSchedule.findUnique({ where: { orderId }, include: { installments: { orderBy: { seq: 'asc' } } } })`). **Nếu danh sách đợt mới GIỐNG HỆT** (cùng số đợt; từng đợt cùng `percent`, `amount`, `conditionNote`, `milestone`) ⇒ không ghi, không event, trả view hiện tại (double-click Lưu không đẻ 2 dòng audit).
   d. `paymentSchedule.upsert({ where: { orderId }, create: { orderId }, update: {} })` (chạm `updatedAt` bằng `update: { updatedAt: new Date() }` nếu cần) → `installment.deleteMany({ where: { scheduleId } })` → `installment.createMany({ data })` — `data` luôn ≥ 1 phần tử (DTO `ArrayMinSize(1)`), vẫn giữ guard "không gọi createMany với mảng rỗng" theo khuôn [memory: prisma7 empty createMany].
5. SAU commit: `eventBus.publish(new PaymentScheduleConfigured(actorAccountId, orderId, before, after, occurredAt))` — `before` = danh sách đợt cũ (hoặc `null` nếu lần đầu), `after` = danh sách mới; mỗi phần tử `{ seq, percent, amount, conditionNote, milestone }` — không bí mật. Đúng MỘT lần publish (test `toHaveBeenCalledTimes(1)`).
- Lý do khoá: `deleteMany + createMany` KHÔNG phải replace nguyên tử dưới READ COMMITTED — hai PUT đồng thời ⇒ dòng trùng `seq` (P2002 ⇒ 500) hoặc đợt bị nhân đôi; `upsert` lần đầu đồng thời ⇒ P2002 trên `order_id` unique [memory: atomic replace needs FOR UPDATE]. Khoá `orders` (không khoá `payment_schedules`) vì lịch có thể chưa tồn tại và vì 7.2 sẽ ghi `Payment` + transition dưới CÙNG khoá này (AD-11 F-3).
- Service KHÔNG ghi bảng nào của aggregate đơn (`order`/`orderVersion`/`orderLineItem`/…); KHÔNG chạm `Order.status`.

**D7 — API (contract TIẾNG ANH, luật 8).**
- `GET /orders/:id/payment-schedule` — `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)`; phạm vi do service (404).
- `PUT /orders/:id/payment-schedule` — `@RequirePermissions(PERM.paymentsRecord)` + `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)` (khuôn 5.3: thiếu quyền xem đơn thì không thể có phạm vi). PUT vì là THAY toàn bộ tài nguyên con duy nhất của đơn (idempotent theo nghĩa HTTP). Trả 200 + view.
- `:id` validate `ParseUUIDPipe` (khuôn các route `/orders/:id/...` hiện có — kiểm controller orders để chép đúng pipe đang dùng).
- Request `ReplacePaymentScheduleRequestDto { installments: InstallmentInputDto[] }` — `@ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => InstallmentInputDto)`.
  `InstallmentInputDto { percent?: number (@IsOptional @IsInt @Min(1) @Max(100)); amount?: number (@IsOptional @IsInt @Min(1) @Max(2_000_000_000), description "số nguyên đồng"); conditionNote: string (@IsString, trim, 1..200) }`. "Đúng một trong percent/amount" kiểm ở domain D2 (field `installments.{i}.percent`, code `exactlyOneOf`) — vì class-validator không diễn đạt XOR gọn. Message `@Min(1)` của `percent`/`amount` viết tiếng Việt rõ nghĩa (*"Mỗi đợt phải lớn hơn 0."*) — chính đây là nơi đợt đầu 0% bị chặn khi client gửi 0 trực tiếp; D2 chặn trường hợp % phân giải ra 0 đồng.
- Response `PaymentScheduleResponseDto { orderId: string; configured: boolean; editable: boolean; orderTotal: number; scheduledTotal: number; difference: number; totalMatches: boolean; installments: InstallmentResponseDto[]; updatedAt: string | null }`; `InstallmentResponseDto { seq: number; percent: number | null; amount: number; conditionNote: string; milestone: 'coc' | 'tat_toan' | null }`. **Description của `orderTotal`, `scheduledTotal`, `difference`, `amount` phải chứa "số nguyên đồng"** (để `money-fields.mjs` tự thu vào guard). Chưa cấu hình ⇒ `configured: false`, `installments: []`, `scheduledTotal: 0`, `difference = orderTotal`, `totalMatches: false`, `updatedAt: null` — 200, KHÔNG 404 (đơn tồn tại, chỉ là chưa có lịch).
- Chạy `npm run openapi:gen` — drift-guard byte-for-byte.

**D8 — Module & guard.**
- `backend/src/payments/payments.module.ts` (imports `OrdersModule`, `SettingsModule`, `FeatureFlagsModule`; KHÔNG import `PrismaModule`/`EventsModule` — `@Global`), `payment-schedules.controller.ts`, `payment-schedules.service.ts`, `domain/payment-schedule.ts`, `domain/payment-schedule-events.ts`, `dto/*.ts`. Đăng ký `PaymentsModule` trong `app.module.ts`.
- Mở rộng source-guard `backend/test/no-unscoped-order-write.spec.ts` để canh thêm `src/payments/payment-schedules.service.ts` với lời gọi phạm vi `/this\.orders\.(?:getScopedTotal|getScoped|assertScoped)\s*\(/` và mẫu "chạm đơn" thêm `\.(?:paymentSchedule|installment)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(` + `\$queryRaw`. Guard đang đọc từ `ORDERS_DIR` — tách đường dẫn theo từng mục `FILE_CANH` (đường tương đối từ `src/`). Assert chống-guard-rỗng hiện có phải tiếp tục đếm cả file mới (method `replace`/`get` được trích, thân > 0).
- `no-order-status-write-outside-transition`, `no-handler-without-require-permissions`, `no-permission-literal-outside-registry`, `naming-convention`, `no-direct-side-effect-outside-eventbus` phải xanh nguyên (không nới).

**D9 — Client (web + mobile, port + fake, parity).**
- **Port:** web `web/src/design-system/session/payments-port.ts` (`PaymentsPort { getSchedule(orderId): Promise<PaymentSchedule>; replaceSchedule(orderId, input): Promise<PaymentSchedule> }`, type mirror DTO field-for-field, lỗi validation mang `fieldErrors` theo khuôn port hiện có — chép cách `stock-vouchers-port.ts` biểu diễn lỗi) + `fake-payments-port.ts` (fake tính `amount` bằng ĐÚNG luật D2 — hoặc trả số cố định khớp mockup; KHÔNG để fake dạy client tự tính: logic tính chỉ trong fake, màn không chứa phép tính). Mobile `mobile/lib/design_system/session/payments_port.dart` + `fake_payments_port.dart`.
- **Màn:** web `web/src/screens/payments/PaymentScheduleScreen.tsx` (+ `payment-schedule.css` chỉ khi cần class mới, dùng token), mobile `mobile/lib/screens/payments/payment_schedule_screen.dart`. Props: `port`, `orderId`, `onBack?`.
  - Chế độ XEM: tiêu đề "Lịch thanh toán"; Table cột `Đợt · Điều kiện · Tỉ lệ · Số tiền` — nhãn đợt `Đợt {seq}` + hậu tố mốc (`· Cọc` khi `milestone === 'coc'`, `· Tất toán` khi `tat_toan`); tỉ lệ hiện `{percent}%` hoặc `—`; số tiền qua `<Money>`/`MoneyText`. Dòng tổng: "Tổng lịch" `scheduledTotal`, "Tổng đơn (sau VAT)" `orderTotal`. `totalMatches === false && configured` ⇒ `<Banner>` cảnh báo: *"Tổng các đợt lệch tổng đơn sau VAT {difference}."* (số qua Money). Chưa cấu hình ⇒ `EmptyState` *"Đơn chưa có lịch thanh toán."* + nút "Cấu hình lịch" (nếu được sửa).
  - Nút "Sửa lịch"/"Cấu hình lịch" chỉ render khi `schedule.editable && can(PERMISSION_KEYS.paymentsRecord)` (web: `PERMISSION_KEYS`/`can()`; mobile: **`AppPermissionKeys`**, KHÔNG `AppPerm` — [memory: mobile screens use AppPermissionKeys]). Không quyền/không editable ⇒ chỉ xem.
  - Chế độ SỬA: mẫu nhanh `20/70/10` (3 đợt, % 20/70/10, điều kiện mặc định "Cọc khi ký hợp đồng" / "Khi thi công" / "Khi nghiệm thu, bàn giao"), `100%` (1 đợt, "Thanh toán toàn bộ"), `Tuỳ chỉnh` (giữ nguyên các dòng đang có). Mỗi dòng: chọn kiểu `%`/`Số tiền`, ô số, ô điều kiện, nút xoá dòng (≥ 1 dòng); nút "Thêm đợt" (≤ 12). Mẫu nhanh CHỈ điền con số % người dùng sẽ gõ — không tính tiền.
  - **Ô trống KHÔNG được ép thành 0** [memory: blank-required-number-coerced-to-zero]: ô số trống ⇒ KHÔNG gửi key đó (backend trả `exactlyOneOf`); gõ "0" ⇒ gửi `0` (backend trả 400 đợt đầu). Test cả hai.
  - Lưu ⇒ `replaceSchedule`; thành công ⇒ về chế độ xem với view server trả (có thể kèm Banner lệch). 400 ⇒ map `fieldErrors` `installments.{i}.(percent|amount|conditionNote)` vào đúng dòng/ô; 409 ⇒ thông báo message server + nút tải lại. Chống double-submit (nút disable khi đang lưu).
  - KHÔNG dựng khối "Tiến độ công nợ", trạng thái đợt Đã thu/Chưa thu, form Ghi nhận — 7.2.
- **Lối vào:** `OrderDetailScreen` (web) + `order_detail_screen.dart` (mobile) thêm prop tuỳ chọn `onOpenPaymentSchedule` — nút "Thanh toán" chỉ render khi có prop (khuôn `onChangeStatus`). KHÔNG thêm tab thứ 4 (comment dòng 97-99 vẫn đúng: tab Thanh toán đầy đủ cần cả 7.2) — chỉ cập nhật comment cho khớp sự thật mới.

### 3. Phạm vi

- **TRONG:** `PaymentSchedule` + `Installment` + migration/CHECK; domain phân giải; `GET`/`PUT /orders/:id/payment-schedule`; event `PaymentScheduleConfigured`; trích `resolveOrderTotals` + `OrdersService.getScopedTotal`; mở rộng guard phạm vi; màn web + mobile + port/fake + lối vào từ chi tiết đơn; test các lane.
- **NGOÀI:** `Payment`, ghi nhận thanh toán, trạng thái thanh toán đơn, auto-transition `du_coc` (7.2); hợp đồng (7.3); hoá đơn (7.4/7.5); mẫu lịch dùng chung cấu hình ở `system_settings` (không ai yêu cầu); báo cáo công nợ (Phase sau, PRD dòng 515); router/HTTP adapter thật (TD-38).

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:612-618`)

- **Given** một Đơn, **When** cấu hình lịch, **Then** tạo `PaymentSchedule` + `Installment` hỗ trợ nhiều đợt (vd 20/70/10), một đợt 100%, hoặc tuỳ chỉnh; mỗi đợt có % hoặc số tiền + mô tả điều kiện (FR-11).
- **Given** tổng các đợt, **When** lưu, **Then** cảnh báo nếu tổng ≠ tổng sau VAT của Đơn (FR-11).
- **Given** tiền các đợt, **When** tính, **Then** là integer đồng, không float (AD-10).
- **Given** cấu hình lịch thanh toán, **When** đợt đầu = 0% (hoặc 0 tiền), **Then** **chặn** — không cho lưu lịch có đợt đầu 0%; luật này chặn tại **cấu hình** (khi tạo lịch), KHÔNG tại lúc áp vào đơn (§3 Plan).

### AC dẫn xuất (đo được)

1. **AC-1 (tạo nhiều đợt):** `PUT` lịch 20/70/10 trên đơn `dachot` tổng 83.010.960 ⇒ 200, `installments` = `[{seq:1, percent:20, amount:16602192, milestone:'coc'}, {seq:2, percent:70, amount:58107672, milestone:null}, {seq:3, percent:10, amount:8301096, milestone:'tat_toan'}]`, `scheduledTotal = orderTotal = 83010960`, `difference = 0`, `totalMatches = true`; DB có 1 `payment_schedules` + 3 `installments`.
2. **AC-2 (một đợt 100% + tuỳ chỉnh + trộn kiểu):** lịch 1 đợt `percent:100` ⇒ 1 đợt `amount = orderTotal`, `milestone:'coc'`. Lịch trộn `[{amount: 30_000_000}, {percent: 50}, {amount: …}]` lưu được, mỗi đợt giữ đúng kiểu đã nhập (`percent` null với đợt nhập số tiền).
3. **AC-3 (thay toàn bộ):** `PUT` lần 2 với 2 đợt trên đơn đã có lịch 3 đợt ⇒ còn ĐÚNG 2 dòng `installments` (seq 1..2), `payment_schedules` vẫn 1 dòng cùng `id`.
4. **AC-4 (cảnh báo lệch, không chặn):** lịch có Σ ≠ tổng (vd 20/70 hoặc số tiền tay lệch 1 đồng) ⇒ 200, lưu vào DB, `totalMatches:false`, `difference` = `orderTotal − scheduledTotal` đúng dấu. `GET` sau khi đơn được mở lại + sửa dòng + chốt lại (tổng đổi) ⇒ `totalMatches:false` với tổng MỚI. Web + mobile hiện Banner cảnh báo với 3 số qua Money.
5. **AC-5 (integer, không float, phần dư):** tổng 100.000.001 với 20/70/10 ⇒ 20.000.000 / 70.000.000 / 10.000.001, Σ = tổng; mọi `amount` là `Number.isInteger`. Unit test domain gọi hàm THẬT trên nhiều tổng (kể cả số lẻ, tổng nhỏ) — không fixture số gõ tay [memory: handpicked fixture numbers hide formula bugs].
6. **AC-6 (chặn đợt đầu 0):** `installments[0].percent = 0` ⇒ 400 `VALIDATION_ERROR`, `fieldErrors[].field = 'installments.0.percent'`; `installments[0].amount = 0` ⇒ 400 field `installments.0.amount`; % đợt đầu phân giải ra 0 đồng (đơn tổng rất nhỏ, vd tổng 50, `percent: 1`) ⇒ 400 field `installments.0.amount` code `firstInstallmentZero`. Không dòng nào được ghi, không event. Ghi thẳng DB một `installments.amount = 0` ⇒ vi phạm CHECK (lane DB).
7. **AC-7 (đúng một kiểu):** đợt có cả `percent` lẫn `amount`, hoặc không có cái nào ⇒ 400 field `installments.{i}.percent` code `exactlyOneOf`. `installments: []` ⇒ 400; 13 đợt ⇒ 400; `conditionNote` rỗng/toàn space/> 200 ký tự ⇒ 400 field `installments.{i}.conditionNote`.
8. **AC-8 (trạng thái):** `PUT` trên đơn `baogia`/`choduyet`/`hoanthanh`/`huy` ⇒ 409; `GET` trên các đơn đó ⇒ 200 với `editable:false`. `PUT` trên mỗi trạng thái trong tập D5 ⇒ 200.
9. **AC-9 (quyền + phạm vi):** thiếu `payments.record` ⇒ `PUT` 403; có `payments.record` + `orders.view_own` nhưng không phải owner/assignee ⇒ `PUT` và `GET` 404 với CÙNG message như id không tồn tại; id không phải UUID ⇒ 400. Source-guard phạm vi mở rộng ĐỎ khi gỡ lời gọi `this.orders.getScopedTotal(` khỏi `replace` (mutation, `cp` backup — KHÔNG `git checkout` [memory]).
10. **AC-10 (khoá + đồng thời — lane DB):** ca interleaving ép thật: tx A giữ `SELECT … FROM orders … FOR UPDATE` **và đã ghi** (xoá + chèn đợt của lịch đó) nhưng chưa commit; gọi `replace` B song song; commit A ⇒ kết quả cuối = ĐÚNG tập đợt của B (đếm dòng + danh sách seq), không P2002, không 500. Gỡ `FOR UPDATE` (mutation) ⇒ ca này ĐỎ. Thêm ca "tạo lịch lần đầu đồng thời" (hai `replace` trên đơn chưa có lịch) ⇒ đúng 1 `payment_schedules`. [CONVENTIONS#Khoá dòng; memory: fk-key-share-masks-missing-row-lock — tx A phải GHI đúng thứ B đọc].
11. **AC-11 (re-check trong tx):** đơn bị chuyển sang `huy` (hoặc `currentVersionId` đổi) giữa bước đọc phạm vi và bước khoá ⇒ 409, không ghi (unit test mock-forced; lane DB nếu dựng được interleaving).
12. **AC-12 (audit qua event):** `PUT` thành công ⇒ `eventBus.publish` gọi ĐÚNG 1 lần (`toHaveBeenCalledTimes(1)`) với `PaymentScheduleConfigured`, `target {type:'Order', id}`, `before` (null lần đầu / danh sách cũ), `after` (danh sách mới); publish SAU commit (mock `$transaction` phải CHẠY callback rồi mới resolve/reject — [memory: mockRejectedValue tx hides publish-order bugs]). Lỗi validate/409/404 ⇒ 0 publish. `PUT` lặp lại payload y hệt ⇒ 200, 0 ghi, 0 publish.
13. **AC-13 (tổng dùng chung):** `resolveOrderTotals` là đường DUY NHẤT phân giải đầu vào tổng; `QuoteExportService` gọi nó (test 4.8 xanh nguyên, không sửa assert); `orderTotal` của lịch = tổng in trên báo giá PDF cho cùng đơn (unit test so hai đường cho một fixture có chiết khấu + VAT).
14. **AC-14 (contract):** `openapi.json` regen có 2 route mới tiếng Anh + DTO mới; `money-fields.mjs` tự thu `orderTotal`/`scheduledTotal`/`difference`/`amount` (kiểm bằng test hiện có của guard money — chạy `cd design-system && npm test`). `permissions.json` KHÔNG đổi.
15. **AC-15 (client):** web — ca mới trong `web/src/test/screens-render.test.tsx` (guard đếm số file `*Screen.tsx` phải khớp) + test hành vi `web/src/test/payment-schedule-screen.test.tsx` (xem, mẫu 20/70/10, lưu, Banner lệch, map fieldErrors vào dòng, ô trống ⇒ key vắng, gõ "0" ⇒ gửi 0, nút Sửa ẩn khi thiếu quyền / `editable:false`, chống double-submit); mobile — widget test `mobile/test/screens/payments/payment_schedule_screen_test.dart` cùng bộ ca + màn ở 320/360 px không tràn; parity guard `design-system/screens/payment-schedule.test.mjs` (cùng nhãn tiếng Việt hai nền tảng, không có chữ "Ghi nhận" trên màn 7.1). Nút "Thanh toán" ở chi tiết đơn chỉ render khi có prop (test cả hai nền tảng).

---

## Tasks / Subtasks

- [x] **T1 — Schema + migration** (AC 1-3, 6, 10)
  - [x] T1.1 Thêm `PaymentSchedule`, `Installment`, quan hệ `Order.paymentSchedule` vào `backend/prisma/schema.prisma` (docstring tiếng Anh theo luật 8).
  - [x] T1.2 Migration `backend/prisma/migrations/20261021130000_add_payment_schedules/migration.sql` sinh bằng `npx prisma migrate dev --create-only` rồi thêm 4 CHECK tay (D1). Kiểm `prisma migrate diff` bằng cờ Prisma 7 `--from-schema/--to-schema` [memory].
  - [x] T1.3 `npx prisma migrate deploy` lên `pns-postgres:5433` (CHỈ DB local này).
- [x] **T2 — Domain thuần** (AC 1, 2, 5, 6, 7)
  - [x] T2.1 `backend/src/payments/domain/payment-schedule.ts`: `resolveInstallments(orderTotal, inputs)` + `isSameSchedule(a, b)` + hằng `EDITABLE_ORDER_STATUSES` (từ `TRANG_THAI_*`) + `MAX_INSTALLMENTS = 12`; mốc từ `MOC_TU_DONG`.
  - [x] T2.2 `backend/src/payments/domain/payment-schedule-events.ts`: `PaymentScheduleConfigured implements DomainEvent`.
  - [x] T2.3 `backend/test/payment-schedule.spec.ts`: mockup 20/70/10, phần dư, 100%, trộn kiểu, Σ% ≠ 100, đợt đầu 0 (cả 3 dạng), đợt giữa phân giải 0, XOR, mốc theo vị trí (1 đợt, 2 đợt, 5 đợt), số nguyên mọi đầu ra (vòng lặp nhiều tổng ngẫu nhiên cố định seed).
- [x] **T3 — Tổng đơn dùng chung** (AC 13)
  - [x] T3.1 Trích `resolveOrderTotals` vào `orders/domain/order-totals.ts`; `QuoteExportService` gọi nó.
  - [x] T3.2 `OrdersService.getScopedTotal(...)` (qua `findScopedOrThrow`); test unit + so khớp với tổng báo giá.
- [x] **T4 — Service + controller + module** (AC 1-4, 6-12)
  - [x] T4.1 DTO `backend/src/payments/dto/{replace-payment-schedule-request,installment-input,payment-schedule-response,installment-response}.dto.ts` (description field tiền có "số nguyên đồng").
  - [x] T4.2 `payment-schedules.service.ts` (`get`, `replace` theo D6).
  - [x] T4.3 `payment-schedules.controller.ts` (D7), `payments.module.ts`, đăng ký `app.module.ts`.
  - [x] T4.4 Unit `backend/test/payment-schedules.service.spec.ts` (thứ tự scope → status → validate → tx[khoá đầu tiên → re-check → ghi] → publish sau commit; no-op khi y hệt; 0 publish khi lỗi; createMany không gọi với mảng rỗng).
  - [x] T4.5 e2e `backend/test/payment-schedules.e2e.spec.ts` qua `initAppOnLoopback` (`backend/test/util/listen-loopback.ts`): 200/400 fieldErrors/403/404/409, UUID pipe, response shape.
  - [x] T4.6 Lane DB `backend/test/payment-schedules.db.integration.spec.ts`: AC-1/3/6(CHECK)/8 trên Postgres thật + 2 ca interleaving AC-10 + mutation gỡ `FOR UPDATE` phải ĐỎ (ghi kết quả vào Completion Notes).
- [x] **T5 — Guard + contract** (AC 9, 14)
  - [x] T5.1 Mở rộng `backend/test/no-unscoped-order-write.spec.ts` (D8) + mutation chứng minh ĐỎ.
  - [x] T5.2 `npm run openapi:gen`; drift-guard xanh; `permissions.json` không đổi.
- [x] **T6 — Web** (AC 4, 15)
  - [x] T6.1 `payments-port.ts` + `fake-payments-port.ts` (+ export ở `session/index.ts` nếu các port khác được export ở đó).
  - [x] T6.2 `web/src/screens/payments/PaymentScheduleScreen.tsx` (+ css nếu cần, class phải có rule thật — guard `css-class-coverage`).
  - [x] T6.3 Nút "Thanh toán" tuỳ chọn ở `OrderDetailScreen.tsx` + cập nhật comment dòng 97-99.
  - [x] T6.4 Ca render trong `screens-render.test.tsx` + `payment-schedule-screen.test.tsx`; `cd web && npm run typecheck && npm test && npm run build`.
- [x] **T7 — Mobile** (AC 4, 15)
  - [x] T7.1 `payments_port.dart` + `fake_payments_port.dart`.
  - [x] T7.2 `mobile/lib/screens/payments/payment_schedule_screen.dart` (widget design-system, `MoneyText`, `AppPermissionKeys`).
  - [x] T7.3 Nút "Thanh toán" tuỳ chọn ở `order_detail_screen.dart`.
  - [x] T7.4 Widget test (bắt buộc) + `cd mobile && flutter analyze && flutter test`. `dart format` chỉ với `-o none --set-exit-if-changed` hoặc đúng file mình sửa [memory: dart format writes files].
- [x] **T8 — Parity + 5 lane** (AC 14, 15)
  - [x] T8.1 `design-system/screens/payment-schedule.test.mjs` (có assert chống-guard-rỗng).
  - [x] T8.2 Chạy đủ 5 lane: `cd backend && npm test` · `npm run test:db` · `cd design-system && npm test` · web (typecheck/test/build) · mobile (analyze/test). Lint backend: so baseline bằng stash [memory: backend lint đỏ sẵn 162] — không nhận lỗi prettier có sẵn là của mình, nhưng file MỚI phải sạch.

---

## Dev Notes

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác trong story

[Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`, commit `13408c1`]
1. Mọi đường ghi đơn mới qua kiểm phạm vi người gọi giống `backend/src/orders` ⇒ D6 bước 1 + guard D8.
2. (Tồn kho — không chạm ở story này.)
3. Màn web mới: ca trong `screens-render.test.tsx`; `cd web && npm run typecheck && npm test && npm run build`.
4. Màn mobile mới BẮT BUỘC widget test.
5. Source-guard mới/mở rộng phải có assert chống-guard-rỗng.
6. App e2e dùng `initAppOnLoopback`.
7. KHÔNG `git push`; `git add` đường dẫn cụ thể, không `-A`; `package-lock.json` phải `git add -f` nếu đổi.
8. Code tiếng Anh (biến/hàm/class/file/comment/test/log/commit); CHỈ chuỗi hiển thị tiếng Việt. Route/DTO/port mới tiếng Anh. Không đổi tên hàng loạt symbol tiếng Việt cũ (`MOC_TU_DONG`, `TRANG_THAI_*` dùng nguyên tên).
9. TIỀN: số nguyên đồng; hiển thị qua `<Money>`/`MoneyText`/`formatVnd` (`83.010.960 đ`); ô NHẬP tiền vẫn gõ số thô. (Phần Payment idempotent + Payment↔transition là 7.2 — nhưng khoá `orders` FOR UPDATE ở 7.1 là CÙNG khoá 7.2 sẽ dùng.)
10. (Hợp đồng — 7.3.)

### Files sẽ đổi / tạo

| File | Loại | Ghi chú |
|---|---|---|
| `backend/prisma/schema.prisma` | UPDATE | +2 model, +relation `Order.paymentSchedule` |
| `backend/prisma/migrations/20261021130000_add_payment_schedules/migration.sql` | NEW | + 4 CHECK tay |
| `backend/src/payments/{payments.module,payment-schedules.controller,payment-schedules.service}.ts` | NEW | |
| `backend/src/payments/domain/{payment-schedule,payment-schedule-events}.ts` | NEW | thuần |
| `backend/src/payments/dto/*.dto.ts` | NEW | 4 DTO |
| `backend/src/app.module.ts` | UPDATE | import `PaymentsModule` |
| `backend/src/orders/domain/order-totals.ts` | UPDATE | + `resolveOrderTotals` (không đổi `computeOrderTotals`) |
| `backend/src/orders/quote-export.service.ts` | UPDATE | gọi `resolveOrderTotals` — hành vi y nguyên |
| `backend/src/orders/orders.service.ts` | UPDATE | + `getScopedTotal` công khai; KHÔNG đụng method khác |
| `backend/test/no-unscoped-order-write.spec.ts` | UPDATE | canh thêm file payments |
| `backend/test/payment-schedule.spec.ts`, `payment-schedules.service.spec.ts`, `payment-schedules.e2e.spec.ts`, `payment-schedules.db.integration.spec.ts` | NEW | |
| `backend/openapi/openapi.json` | REGEN | `npm run openapi:gen` |
| `web/src/design-system/session/{payments-port,fake-payments-port}.ts` | NEW | |
| `web/src/screens/payments/PaymentScheduleScreen.tsx` (+css) | NEW | |
| `web/src/screens/orders/OrderDetailScreen.tsx` | UPDATE | prop `onOpenPaymentSchedule?` + comment tab |
| `web/src/test/screens-render.test.tsx`, `web/src/test/payment-schedule-screen.test.tsx` | UPDATE/NEW | |
| `mobile/lib/design_system/session/{payments_port,fake_payments_port}.dart` | NEW | |
| `mobile/lib/screens/payments/payment_schedule_screen.dart` | NEW | |
| `mobile/lib/screens/orders/order_detail_screen.dart` | UPDATE | callback `onOpenPaymentSchedule` |
| `mobile/test/screens/payments/payment_schedule_screen_test.dart` | NEW | |
| `design-system/screens/payment-schedule.test.mjs` | NEW | parity |

### Hiện trạng phải giữ

- `computeOrderTotals` chữ ký + hành vi không đổi; mọi test `order-totals.spec.ts`, báo giá 4.8 xanh nguyên.
- `OrderDetailScreen`/`order_detail_screen` không prop mới ⇒ render y hệt hôm nay (nút mới chỉ hiện khi truyền prop). Test chi tiết đơn hiện có xanh nguyên.
- `auto-transition-map.ts`, `allowed-transition.ts`, `applyTransition` — KHÔNG đụng.
- Không route `/orders/...` cũ nào đổi; `OrdersController` không thêm handler (route mới nằm ở controller của `payments/`). Kiểm hai controller cùng prefix `orders` không va route trong Nest (`@Controller('orders')` ở `PaymentSchedulesController` với path `:id/payment-schedule` — chạy e2e cả route orders cũ để chắc).

### Tình huống biên đã tính

- Đơn 0 dòng đã `dachot` (TD-35) ⇒ tổng 0 ⇒ mọi % phân giải 0 ⇒ 400 đợt đầu; số tiền tay ⇒ lưu được + cảnh báo lệch. Chấp nhận (đơn 0 dòng là nợ riêng).
- Đơn không áp VAT (`vatMode`) ⇒ `orderTotal` = tổng không thuế — vẫn đúng nghĩa "tổng sau VAT" (VAT = 0) qua `resolveOrderTotals`.
- Chiết khấu đã duyệt ⇒ tổng sau chiết khấu + VAT — cùng con số báo giá in.
- Σ% > 100 (60/60) ⇒ lưu + cảnh báo `difference` âm. Không chặn (FR-11 chỉ cảnh báo).
- `conditionNote` trim trước khi lưu; so "giống hệt" (D6.c) dùng giá trị đã trim.
- Đơn mở lại (`dachot → baogia`) ⇒ lịch giữ nguyên, `editable:false` tới khi chốt lại; sau re-chốt tổng mới ⇒ `GET` báo lệch.
- Trùng request đồng thời ⇒ xếp hàng sau khoá; request sau thấy lịch của request trước và (nếu payload y hệt) no-op.

### Kiểm thử — luật dự án áp dụng trực tiếp

- `FOR UPDATE` chỉ đo được ở lane DB; tx giữ khoá trong test phải GHI đúng thứ primitive đọc (`installments` của lịch), không giữ khoá trần [CONVENTIONS#Khoá dòng; memory fk-key-share-masks / atomic-replace].
- Mutation: `cp` backup rồi sửa, chạy, khôi phục — KHÔNG `git checkout` (code story chưa commit). Mutant phải compile [memory: mutation must compile or false RED]. Mutate từng lớp phòng thủ: (a) gỡ `FOR UPDATE` ⇒ ca interleaving ĐỎ; (b) gỡ lời gọi scope ⇒ guard + e2e 404 ĐỎ; (c) bỏ bù phần dư ⇒ unit domain ĐỎ; (d) bỏ luật đợt đầu ở domain ⇒ ca "% phân giải ra 0" ĐỎ (DTO `@Min(1)` không bắt được ca này — đừng tưởng đó là mutant tương đương); (e) bỏ re-check trong tx ⇒ unit AC-11 ĐỎ. Ghi bảng kết quả vào Completion Notes.
- Publish: `toHaveBeenCalledTimes(1)`, không `mock.calls[0]` [memory]. Mock `$transaction` chạy callback.
- AC về mã HTTP (400/403/404/409) đo ở lane e2e qua ValidationPipe thật — không pin lệch AC thành test xanh [memory: dev pins AC deviation].
- Web: text-guard không thấy lỗi cú pháp — `npm run typecheck` là cổng thật.
- Lane DB cần Docker: nếu `pns-postgres` tắt thì `docker start pns-postgres`; nếu daemon không lên từ shell agent, viết spec, báo lane CHƯA chạy và nhờ Đại Ca mở Docker Desktop [memory: db lane needs Docker Desktop GUI]. KHÔNG ghi lên DB nào khác.

### Previous Story Intelligence (Epic 6 — 6.7, 6.6, 6.4)

- **Khoá:** khuôn op-đầu-tiên `SELECT id FROM orders … FOR UPDATE` rồi đọc LẠI trạng thái trong tx (6.7 D2 bước 1-2) — áp nguyên cho D6.
- **Test khoá false-green 2 lần ở 6.7** (FK KEY SHARE / UPDATE cùng dòng chặn hộ) — chính vì vậy AC-10 đòi tx A GHI đợt rồi mới commit, và assert số dòng cuối, không assert thời gian.
- **Reviewer 6.7 tự nhận mutation ĐỎ mà thật ra xanh** — chạy lại mọi mutation tự mình, đừng chép bảng.
- **Contract tiếng Anh** cho code mới (6.4 quyết định B): `/stock-vouchers/:id/return`, `issueForOrderInTx` — áp cho `/orders/:id/payment-schedule`, `replace`, `getScopedTotal`.
- **6.3:** ô số bắt buộc trống bị ép 0 ⇒ backend nhận; áp cho ô %/số tiền (D9).
- **6.3:** màn mobile dùng `AppPermissionKeys`, không `AppPerm` — guard ghost-key không thấy `AppPerm.*` (TD-46).
- **Epic 5/6:** widget test mobile dùng nhãn DÀI NHẤT ở 320/360 px (TD-33) — nhãn đợt "Đợt 12 · Tất toán" + điều kiện 200 ký tự.

### Git intelligence (5 commit gần nhất)

- `13408c1` docs(epic-7): quyết định Payment↔transition (spine AD-11) + pháp nhân hợp đồng — nguồn của D6 (khoá chung với 7.2).
- `a66c649`, `98fd6dc`: đóng Epic 6, đồng bộ spine/epics/project-context (luật ngôn ngữ, Money formatter, lane DB).
- `02f9d94` (6.7), `f8b4a1e` (6.6): khuôn subscriber/ledger/khoá + test interleaving — tham chiếu cho T4.6.
- Commit của story này: `feat(story-7.1): ...` tiếng Anh, không nhắc AI, `git add` đúng đường dẫn.

### Latest tech notes

- Không thêm thư viện. Stack ghim trong `project-context.md` (NestJS 11.1.27, Prisma 7.8.0 + adapter-pg, React 19.2.7, Flutter 3.44). Prisma 7: Json nullable dùng `Prisma.JsonNull` (không cần ở đây); `migrate diff` dùng `--from-schema/--to-schema`; P2003 chỉ có tag khi INSERT. class-validator: `@ValidateNested({ each: true })` + `@Type(() => …)` bắt buộc cho mảng object (thiếu `@Type` ⇒ phần tử không được validate, lọt im lặng).

### Project Structure Notes

- Module `payments/` khớp cây spine; contract `orders/:id/payment-schedule` là sub-resource của đơn (CONVENTIONS: route danh từ, kebab-case). Bảng `payment_schedules`/`installments` snake_case số nhiều.
- Biến thể có chủ đích: controller của `payments/` khai `@Controller('orders')` để phục vụ sub-resource — ghi lý do ở docstring controller (spine chỉ ràng buộc module sở hữu entity, không ràng buộc prefix route).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Mốc `tat_toan` cho lịch 1 đợt:** 7.1 gán `coc` cho đợt duy nhất. 7.2 cần quyết đơn chỉ-Thiết-bị trả 100% một lần thì bắn `du_coc` rồi `hoan_thanh` (hai cạnh) hay chỉ `du_coc`. Mặc định: để 7.2 quyết theo bảng transition.
2. **Cảnh báo lệch TRƯỚC khi lưu (EXPERIENCE.md:176):** mặc định lưu-rồi-cảnh-báo (D4). Nếu Đại Ca muốn hỏi xác nhận trước khi lưu, thêm endpoint preview stateless kiểu `preview-total` ở story sau.
3. **Sửa lịch sau khi đã có `Payment` (7.2):** thay toàn bộ sẽ đụng FK. Mặc định cho 7.2: khoá các đợt đã có tiền (chỉ sửa đợt chưa thu) hoặc chặn sửa khi đã có tiền — 7.2 quyết.
4. **Cấu hình lịch ở `baogia`:** mặc định KHÔNG (tổng còn sống). Nếu Sale cần dựng lịch trước khi chốt để đưa vào hợp đồng nháp, mở rộng tập D5 ở story sau.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:609-618`] — Epic 7, Story 7.1 AC.
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md:74,184-199,266,515`] — Lịch thanh toán, FR-11/12, ma trận quyền, công nợ Phase sau.
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`] — AD-10 (dòng 103-107), AD-11 + quyết 2026-10-21 Payment↔transition (112-115), AD-16 (145), AD-18 (157), ERD (236-238), module tree (450), mapping mốc (494).
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md:39,85,109,121,150,170-176`; `mockups/all-screens.html:2463+` `#s-payments`].
- [Source: `backend/src/orders/domain/auto-transition-map.ts`] — `MOC_TU_DONG`, ranh giới 5.2/7.1/7.2.
- [Source: `backend/src/orders/domain/order-totals.ts`; `backend/src/orders/quote-export.service.ts:25-30,80-98`] — hàm pricing + luật phân giải.
- [Source: `backend/src/orders/orders.service.ts:120-137,495-560,1776-1840`; `orders.module.ts`] — phạm vi, khoá, export cho payments.
- [Source: `backend/test/no-unscoped-order-write.spec.ts`] — guard phạm vi ghi.
- [Source: `backend/CONVENTIONS.md`] — đặt tên, OpenAPI, quyền, envelope, EventBus, khoá dòng.
- [Source: `_bmad-output/project-context.md`] — luật toàn dự án, Money formatter, 5 lane.
- [Source: `_bmad-output/implementation-artifacts/epic-6-retro-2026-10-21.md` §6, §8] — chuẩn bị Epic 7, F-3/F-5, TD-35/38/40.
- [Source: `_bmad-output/story-automator/extra-instructions-7-dev.txt`] — luật bắt buộc 1-10.
- [Source: `design-system/money/money-fields.mjs`] — field tiền tự thu từ OpenAPI.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) — mobile T7 qua subagent fullstack-developer cùng model

### Debug Log References

- `prisma migrate diff --from-migrations` đòi shadow DB ⇒ sinh SQL bằng `--from-config-datasource --to-schema` (DB local đã ở migration mới nhất), rồi thêm 4 CHECK tay; diff sau deploy = rỗng.
- Fixture `getScopedTotal` "0 dòng" ban đầu đỏ (−866.662): version còn snapshot chiết khấu mà không có dòng — fixture phi thực tế; đổi thành đơn chưa có bản hiệu lực (`currentVersionId: null`).
- Money guard bắt `${i.amount}` ở màn mobile (prefill ô nhập) ⇒ prefill qua helper `_digits(int)`; web truyền số thẳng vào `value` của input (không chuyển chuỗi).
- Guard `order-detail.test.mjs` cấm chuỗi "Thanh toán" thô + regex khối action mobile cũ ⇒ cập nhật: vẫn cấm TAB "Thanh toán" (kiểm danh sách tab, đúng 3 tab), thêm ca (e.6) nút "Thanh toán" chỉ render khi có callback.
- Mobile dùng `Color(0xFF8A5C08)` ad-hoc cho số tiền trong Banner ⇒ gỡ, dùng style mặc định `MoneyText` (AD-13).

### Completion Notes List

- **Backend:** model `PaymentSchedule` + `Installment` (migration `20261021130000_add_payment_schedules`, 4 CHECK tay); domain thuần `resolveInstallments` (floor nguyên, bù dư cho đợt cuối khi toàn % và Σ=100, mốc theo vị trí từ `MOC_TU_DONG`, chặn đợt đầu ≤ 0 `firstInstallmentZero`, đợt giữa `resolvedZero`, XOR `exactlyOneOf`) + `isSameSchedule`; event `PaymentScheduleConfigured`; `resolveOrderTotals` trích từ `QuoteExportService` (hành vi giữ nguyên, test 4.8 xanh không sửa) + `OrdersService.getScopedTotal`; `PaymentSchedulesService.get/replace` theo D6 (scope → status 409 → validate 400 → tx[`orders` FOR UPDATE đầu tiên → re-check status/currentVersionId → no-op nếu y hệt → upsert/deleteMany/createMany] → publish 1 lần sau commit); `GET`/`PUT /orders/:id/payment-schedule` (`ParseUUIDPipe`, quyền theo D7); `PaymentsModule` import thêm `AccountsModule` (controller resolve quyền người gọi tươi mỗi request — khuôn `StockVouchersController`). `permissions.json` không đổi.
- **Guard phạm vi** `no-unscoped-order-write` mở rộng sang `payments/payment-schedules.service.ts` (đường dẫn theo `src/`), thêm mẫu chạm-đơn `paymentSchedule|installment` ghi, `paymentSchedule.find*`, `$queryRaw`; anti-blind trích `replace`/`get`.
- **Web:** `payments-port.ts` + `fake-payments-port.ts` (fake KHÔNG tính tiền — trả số đóng hộp khớp mockup), `PaymentScheduleScreen.tsx` + `payment-schedule.css`, nút "Thanh toán" tuỳ chọn ở `OrderDetailScreen` (comment tab cập nhật).
- **Mobile (subagent):** port/fake/màn tương đương + nút ở `order_detail_screen.dart`; màn nhận thêm `perms` (khuôn `order_detail_screen`/`inventory_screen`).
- **Parity guard** `design-system/screens/payment-schedule.test.mjs`: 30 nhãn tiếng Việt chung hai nền tảng, cấm "Ghi nhận", cấm số học tiền ở screen/port/fake (có ca sanity), cổng nút Sửa = `editable && paymentsRecord`, mobile dùng `AppPermissionKeys`.
- **5 lane (2026-10-21, sau lần format cuối):** backend `npm test` 100 suite / 1933 test xanh · `npm run test:db` 22 suite / 250 test xanh (Postgres `pns-postgres:5433`) · `design-system npm test` 455/455 · web typecheck sạch, vitest 8 file / 106 test, build OK · mobile `flutter analyze` sạch, `flutter test` 366 xanh. OpenAPI regen (+285 dòng, 2 route), drift-guard xanh; `money-fields.mjs` tự thu `orderTotal`/`scheduledTotal`/`difference`/`amount` (đã kiểm), không thu `percent`/`seq`.
- **Lint backend:** file mới/sửa sạch ESLint + Prettier; lỗi prettier duy nhất ở `quote-export.service.ts` (dòng gọi `fileMeta`) có sẵn ở HEAD — không format lan cả file.
- **Mutation (tự chạy, `cp` backup, không `git checkout`, mutant đều compile):**

| # | Đột biến | Kết quả |
|---|---|---|
| a | Gỡ `FOR UPDATE` trong `replace` | Lane DB ĐỎ 2 ca: interleaving holder-ghi-đợt (P2002 `schedule_id, seq` — đúng lý do) + ca huỷ dưới khoá (re-check). Ca "2 lần lưu đầu song song" vẫn xanh dưới mutant (không ép được interleaving) — ca chính AC-10 đã ĐỎ |
| b | Gỡ `this.orders.getScopedTotal(` khỏi `replace` (thay bằng `findUnique` trần) | Guard phạm vi ĐỎ (2 ca) + e2e 404 phạm vi ĐỎ (13 ca e2e đỏ) |
| c | Bỏ bù phần dư đợt cuối | Unit domain ĐỎ (2 ca: 100.000.001 và vòng lặp seed) |
| d | `amount <= 0` → `amount < 0` (bỏ chặn đợt đầu 0) | 7 ca ĐỎ (domain + service + e2e `firstInstallmentZero`) |
| e | Re-check trong tx chỉ còn `fresh === null` | Unit AC-11 ĐỎ 3 ca (huy / baogia / version mới) |
| web | Bỏ `can(paymentsRecord)` / bỏ `editable` / ép ô trống thành 0 | Mỗi đột biến ĐỎ đúng 1 ca tương ứng |

- **Câu hỏi mở** giữ nguyên mặc định trong Dev Notes (1–4). Thêm: Banner lệch hiện số `difference`; hai số còn lại (`Tổng lịch`, `Tổng đơn (sau VAT)`) nằm ở dòng tổng ngay dưới bảng — đủ 3 số qua Money theo AC-4.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)
- `_bmad-output/implementation-artifacts/7-1-cau-hinh-lich-thanh-toan-nhieu-dot.md` (UPDATE)
- `backend/prisma/schema.prisma` (UPDATE)
- `backend/prisma/migrations/20261021130000_add_payment_schedules/migration.sql` (NEW)
- `backend/src/app.module.ts` (UPDATE)
- `backend/src/orders/domain/order-totals.ts` (UPDATE)
- `backend/src/orders/orders.service.ts` (UPDATE)
- `backend/src/orders/quote-export.service.ts` (UPDATE)
- `backend/src/payments/payments.module.ts` (NEW)
- `backend/src/payments/payment-schedules.controller.ts` (NEW)
- `backend/src/payments/payment-schedules.service.ts` (NEW)
- `backend/src/payments/domain/payment-schedule.ts` (NEW)
- `backend/src/payments/domain/payment-schedule-events.ts` (NEW)
- `backend/src/payments/dto/installment-input.dto.ts` (NEW)
- `backend/src/payments/dto/installment-response.dto.ts` (NEW)
- `backend/src/payments/dto/payment-schedule-response.dto.ts` (NEW)
- `backend/src/payments/dto/replace-payment-schedule-request.dto.ts` (NEW)
- `backend/openapi/openapi.json` (REGEN)
- `backend/test/no-unscoped-order-write.spec.ts` (UPDATE)
- `backend/test/order-scoped-total.spec.ts` (NEW)
- `backend/test/payment-schedule.spec.ts` (NEW)
- `backend/test/payment-schedules.service.spec.ts` (NEW)
- `backend/test/payment-schedules.e2e.spec.ts` (NEW)
- `backend/test/payment-schedules.db.integration.spec.ts` (NEW)
- `design-system/screens/order-detail.test.mjs` (UPDATE)
- `design-system/screens/payment-schedule.test.mjs` (NEW)
- `web/src/design-system/session/payments-port.ts` (NEW)
- `web/src/design-system/session/fake-payments-port.ts` (NEW)
- `web/src/design-system/session/index.ts` (UPDATE)
- `web/src/screens/payments/PaymentScheduleScreen.tsx` (NEW)
- `web/src/screens/payments/payment-schedule.css` (NEW)
- `web/src/screens/orders/OrderDetailScreen.tsx` (UPDATE)
- `web/src/test/screens-render.test.tsx` (UPDATE)
- `web/src/test/payment-schedule-screen.test.tsx` (NEW)
- `mobile/lib/design_system/session/payments_port.dart` (NEW)
- `mobile/lib/design_system/session/fake_payments_port.dart` (NEW)
- `mobile/lib/design_system/session/session.dart` (UPDATE)
- `mobile/lib/screens/payments/payment_schedule_screen.dart` (NEW)
- `mobile/lib/screens/orders/order_detail_screen.dart` (UPDATE)
- `mobile/test/screens/payments/payment_schedule_screen_test.dart` (NEW)
- `mobile/test/screens/orders/order_detail_screen_test.dart` (UPDATE)

## Senior Developer Review (AI)

_Reviewer: Đại Ca (AI review qua /ck:code-review + bmad-story-automator-review) — 2026-10-21_

**Kết quả:** Approve sau khi sửa. 0 CRITICAL; mọi AC 1–15 có bằng chứng (test + mã); mọi task [x] có thật. Git ⇄ File List khớp (ngoài `_bmad-output/` và `.githooks/` — không thuộc story, không review).

**Mutation tự chạy lại (cp backup, không git checkout, mutant compile):**

| Đột biến | Kết quả |
|---|---|
| Gỡ `FOR UPDATE` trong `replace` | Lane DB ĐỎ 2 ca (holder-ghi-đợt; huỷ dưới khoá) — khớp bảng dev |
| Bỏ `getScopedTotal` ở `replace` (thay `findUniqueOrThrow` trần) | Guard phạm vi ĐỎ 2 ca + e2e 404 phạm vi ĐỎ |
| Bỏ `getScopedTotal` ở `get` | Guard phạm vi ĐỎ + e2e 404 phạm vi ĐỎ |
| Nới trần `amountTooLarge` (×10) | Unit domain ĐỎ + lane DB ĐỎ (`PrismaClientKnownRequestError` — đúng lỗi gốc) |

**Findings (đã sửa hết):**

1. **HIGH — Tràn INT4 ⇒ 500 trên đơn lớn.** `installments.amount` là INT4 (≤ 2.147.483.647) nhưng đợt nhập theo % phân giải `floor(total × % / 100)` không có trần; DTO chỉ chặn số tiền gõ tay. Đơn ≥ ~2,15 tỉ đồng (hệ thương mại vài trăm kWp) với 100% ⇒ driver ném lỗi ⇒ 500 thay vì field error. Đã chứng minh trên Postgres thật. Sửa: domain thêm mã `amountTooLarge` (field `installments.{i}.amount`) khi đợt > `MAX_INSTALLMENT_AMOUNT`; message tiếng Việt dùng chung với DTO. Test: unit biên (4.000.000.002 / 4.000.000.000) + chia 40/30/30 trên 5 tỉ; lane DB đơn 4,32 tỉ: 100% ⇒ 400 không ghi, 40/30/30 ⇒ lưu đúng 3 số. Ghi chú cho 7.2: `Payment.amount` cũng sẽ gặp trần này.
2. **MEDIUM — Schema chèn giữa docstring `Attachment`.** Hai model mới nằm giữa khối `///` của `model Attachment` ⇒ nửa đầu docstring Attachment dính vào `PaymentSchedule`. Đã dời hai model lên trước khối docstring Attachment; `prisma validate` OK, `migrate diff` vẫn rỗng (chỉ comment).
3. **LOW — Thông điệp tiếng Anh tới client.** `@Max(MAX_INSTALLMENT_AMOUNT)` dùng message mặc định class-validator ("amount must not be greater than…") — chuỗi hiển thị phải tiếng Việt (luật 8). Đã thêm message.
4. **LOW — Parity web ↔ mobile ở chế độ Sửa.** Web: nút "Tuỳ chỉnh" không có handler, nút mẫu không có trạng thái chọn; đổi kiểu % ⇄ Số tiền GIỮ con số đã gõ (20% thành 20 đồng). Mobile làm đúng cả ba. Đã sửa web cho khớp (mẫu đang chọn = `primary` + `aria-pressed`, thêm/xoá/đổi kiểu ⇒ về "Tuỳ chỉnh", đổi kiểu xoá số). +2 test web.
5. **LOW — OpenAPI:** mô tả 400 của PUT thêm `amountTooLarge`; regen, drift-guard xanh.

**Không sửa (đã cân, ghi lý do):** `resolveInstallments().scheduledTotal` trùng với phép cộng trong `viewOf` (cùng ở backend, không sai); lệch bố cục Banner (web trên bảng, mobile dưới dòng tổng) — nhãn/hành vi giống nhau, guard parity xanh; `prisma format --check` đỏ có sẵn ở HEAD.

**5 lane sau sửa (2026-10-21):** backend `npm test` 100 suite / 1946 xanh · `npm run test:db` 251/251 (pns-postgres:5433) · design-system 455/455 · web typecheck sạch, vitest 111/111, build OK · mobile analyze sạch, flutter test 367 xanh. ESLint file payments + test sửa: sạch.

## Change Log

- 2026-10-21 — Dev story 7.1: Lịch thanh toán nhiều đợt (schema + migration CHECK, domain phân giải, `GET`/`PUT /orders/:id/payment-schedule` dưới khoá `orders`, `resolveOrderTotals` dùng chung với báo giá, guard phạm vi mở rộng, màn web + mobile + parity guard). Status → review.
- 2026-10-21 — Code review (AI): sửa tràn INT4 đợt theo % (`amountTooLarge`), dời model khỏi docstring `Attachment`, message tiếng Việt cho trần số tiền, parity chế độ Sửa web; mutation FOR UPDATE/scope chạy lại ĐỎ. Status → done.
