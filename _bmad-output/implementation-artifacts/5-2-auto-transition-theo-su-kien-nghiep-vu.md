---
baseline_commit: d145e2be94de88f505f81bdec399da4f9fe4e418
---

# Story 5.2: Auto-transition theo sự kiện nghiệp vụ

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên backend**,
I want **cơ chế auto-transition đi qua cùng engine**,
so that **các bước tự nhảy theo sự kiện mà vẫn dùng chung guard + audit**.

> **⚠️ ĐÂY LÀ STORY MỞ CỬA CHO MODULE KHÁC, KHÔNG PHẢI STORY DỰNG LẠI ENGINE.**
> Story 5.1 đã dựng xong `evaluateTransition()` (bảng thuần domain) + `OrdersService.applyTransition()`
> (executor private) + event `StatusChanged` + source-guard. 5.2 **KHÔNG viết engine mới, KHÔNG
> viết bảng mới, KHÔNG viết guard mới.** 5.2 chỉ thêm **một đường vào công khai** để module
> ngoài (`payments/` ở 7.2, `inventory/` ở 6.x) chạm được đúng engine đó, cộng mapping
> "mốc thanh toán → sự kiện" thuần domain.
>
> **⚠️ `payments/` CHƯA TỒN TẠI.** `PaymentSchedule`/`Installment`/`Payment` là Story 7.1/7.2.
> Story này **TUYỆT ĐỐI KHÔNG** tạo entity, bảng, migration hay endpoint thanh toán nào.
> Viết ra một cái `PaymentSchedule` ở đây = story THẤT BẠI (vi phạm "mỗi story tạo/sửa CHỈ
> entity/file nó cần; không phụ thuộc story sau" — `project-context.md` L84).

## Acceptance Criteria

1. **Given** một sự kiện nghiệp vụ (vd đủ đợt cọc đầu), **When** hệ thống xử lý, **Then** gọi
   CÙNG `applyTransition()` để tự sang trạng thái tương ứng (vd "Đã cọc") — auto và manual
   dùng chung một entry point (FR-8, AD-11).
2. **Given** mapping đợt→trạng thái, **When** cấu hình, **Then** mapping gắn theo Lịch thanh
   toán và được engine tra khi auto-transition (FR-8).
3. **Given** `payments/` và `inventory/`, **When** cần đổi status, **Then** GỌI
   `applyTransition()`, không bao giờ ghi `Order.status` trực tiếp (AD-11).

[Source: `_bmad-output/planning-artifacts/epics.md#Story 5.2` L490-495 — verbatim]

### AC bổ sung (dẫn xuất — bắt buộc để đóng story)

4. **Given** một module ngoài `orders/`, **When** cần auto-transition, **Then** có **ĐÚNG MỘT**
   method công khai để gọi; `OrdersModule` export `OrdersService`; source-guard 5.1 (đã có,
   không sửa) vẫn xanh ⇒ không tồn tại con đường ghi status thứ hai.
5. **Given** một auto-transition đã thành công, **When** gọi lại cùng sự kiện (retry mạng /
   ghi nhận thanh toán lặp), **Then** **no-op**: không đổi status, **không publish
   `StatusChanged` lần hai**, không sinh dòng audit thứ hai — và **không** ném 409
   (NFR-1 "thao tác tiền idempotent, an toàn khi retry").
6. **Given** auto-transition, **When** chạy, **Then** **KHÔNG có đường bypass quyền**: engine
   nhận **chính bộ quyền của actor kích hoạt**, không có tham số "chạy với toàn quyền", không
   có nhánh nào gọi engine với `actorPermissions` được tự chế trong `orders/`.

[Source: `ARCHITECTURE-SPINE.md#AD-11` (auto và manual chung một entry point) · `#AD-7` (mọi
transition permission-gated và ghi Audit) · `prd.md#FR-8` · `epics.md#Story 7.2` (caller thật đầu tiên)]

## Tasks / Subtasks

### Task 1 — Mapping "mốc thanh toán → sự kiện" thuần domain (AC: 2)

- [x] Tạo `backend/src/orders/domain/auto-transition-map.ts` — **DOMAIN THUẦN: KHÔNG import
      Nest/Prisma**, cùng khuôn `allowed-transition.ts`.
- [x] Khai `MOC_TU_DONG` — enum **tường minh** các mốc của Lịch thanh toán sinh ra transition:
      `coc: 'coc'` (đã thu đủ đợt cọc đầu) · `tatToan: 'tat_toan'` (đã thu đủ toàn bộ).
      **CHỈ hai mốc này.** Mốc nào không nằm trong bảng transition thì không có chỗ để map —
      thêm mốc thứ ba bây giờ là bịa.
- [x] Export hàm **thuần** `suKienChoMoc(moc: MocTuDong): TransitionEvent` →
      `coc → SU_KIEN.duCoc` · `tatToan → SU_KIEN.hoanThanh`.
- [x] ⚠️ **Ranh giới với 7.1 phải ghi vào TSDoc:** file này là **hợp đồng**, không phải nơi lưu
      cấu hình. Story 7.1 sẽ gắn giá trị `MocTuDong` lên từng `Installment` (cột cấu hình) và
      7.2 truyền nó vào; 5.2 **không** tạo cột, không tạo bảng, không migration.
- [x] ⚠️ **KHÔNG map `tatToan` thẳng tới một trạng thái đích.** Map tới **sự kiện**; đích đến
      là của bảng transition, không của mapping — `hoan_thanh` có 3 dòng `from` khác nhau
      (`nghiemthu`, `dagiao`, `dachot`+cờ Thiết bị), bảng tự chọn đúng dòng theo `from` hiện tại.

### Task 2 — Cổng no-op idempotent, thuần domain (AC: 5)

- [x] Thêm vào `allowed-transition.ts` hàm **thuần** `daTaiDich(status: string, event: TransitionEvent): boolean`
      → true khi tồn tại một dòng trong `ALLOWED_TRANSITIONS` có `event` khớp **và** `to === status`.
- [x] Ý nghĩa: "đơn đã ở chính cái đích mà sự kiện này nhắm tới" ⇒ retry, không phải xung đột.
- [x] ⚠️ **KHÔNG hardcode cặp status/event trong service.** Suy từ bảng — bảng là nguồn chân lý
      duy nhất; hardcode ở call-site là điểm drift thứ hai đúng cái loại 5.1 vừa đóng.
- [x] ⚠️ Không dùng `daTaiDich` cho transition **thủ công** (5.5) — ở đó "đã ở đích" là bấm nhầm
      lần hai, hợp đồng có thể khác. Story này chỉ dùng nó ở đường auto.

### Task 3 — Entry point công khai DUY NHẤT (AC: 1, 4, 5, 6)

- [x] Thêm **một** public method vào `backend/src/orders/orders.service.ts`:
      `async chuyenTrangThaiTuDong(input: { orderId, event, actorAccountId, actorPermissions }): Promise<void>`.
- [x] Chữ ký nhận `actorPermissions: ReadonlySet<string>` **từ caller** — giống hệt cách
      `confirm`/`revise`/`applyDiscount` nhận (controller resolve tươi mỗi request qua
      `AccountPermissionsService`). **KHÔNG** inject `AccountPermissionsService` vào
      `OrdersService`: bất biến "OrdersService có ĐÚNG hai dependency (`PrismaService`,
      `EventBus`)" phải giữ nguyên [Source: 5-1 Dev Notes §Project Structure Notes].
- [x] Thân hàm, đúng thứ tự (khuôn copy từ `confirm()` L666-865):
  - [x] 1. `const before = await this.findOrThrow(orderId)` (ngoài tx).
  - [x] 2. **Fast-path no-op:** `if (daTaiDich(before.status, event)) return;` — không mở
        transaction, không publish. Đây là AC-5.
  - [x] 3. `const occurredAt = new Date()` — **MỘT timestamp cho MỘT sự kiện**.
  - [x] 4. `$transaction` interactive: gọi `this.applyTransition(tx, { order: before, event,
        actorPermissions, actorAccountId, sentinel: TU_DONG_GATE_THUA, occurredAt })` làm op
        ĐẦU TIÊN; trả `StatusChanged` ra ngoài callback.
  - [x] 5. Catch **theo identity** (`if (error !== TU_DONG_GATE_THUA) throw error`) → đọc lại
        đơn → nếu `daTaiDich(current.status, event)` ⇒ **return no-op** (kẻ thua cuộc đua đã
        thấy kết quả mình muốn); ngược lại ⇒ ném lại `AppException` 409 envelope chuẩn.
  - [x] 6. Publish `statusChanged` **SAU commit** (AD-18). Chỉ MỘT event — auto-transition
        **không** có event nghiệp vụ đi kèm ở story này; `DepositRecorded`/`PaymentRecorded`
        là của 7.2 và do `payments/` publish, không phải `orders/`.
- [x] Thêm sentinel cấp module `const TU_DONG_GATE_THUA = new Error('tu-dong-gate-thua');`
      cạnh 4 sentinel hiện có (L201-229), kèm TSDoc cùng khuôn.
- [x] TSDoc method phải nói rõ: **auto và manual dùng chung `applyTransition()`** — method này
      chỉ sở hữu phần *transaction + no-op + publish*, không sở hữu một luật transition nào.
- [x] ⚠️ **KHÔNG** thêm tham số kiểu `boolean bypassPermission` / `SYSTEM_PERMISSIONS`. Sự kiện
      auto luôn có con người ở đầu nguồn (người ghi nhận thanh toán có `payments.record`, đúng
      quyền mà dòng `duCoc` đòi) ⇒ pass-through là đủ và giữ audit truy được về người thật (AC-6).

### Task 4 — Mở cửa module (AC: 3, 4)

- [x] `backend/src/orders/orders.module.ts`: thêm `exports: [OrdersService]`.
- [x] Ghi lý do vào TSDoc module: `payments/` (7.2) và `inventory/` (6.x) **phải** đi qua
      `OrdersService.chuyenTrangThaiTuDong()`; đó là lý do duy nhất service được export.
- [x] ⚠️ **KHÔNG** tạo `payments.module.ts` / `inventory.module.ts` để "chứng minh nó dùng
      được". Không có consumer thật trong story này — chứng minh bằng test, không bằng module rỗng.
- [x] ⚠️ **KHÔNG viết source-guard mới.** `backend/test/no-order-status-write-outside-transition.spec.ts`
      (5.1) đã quét **toàn bộ `src/`** với allowlist khoá theo cặp `(method, lệnh ghi)` ⇒ một
      `payments/` tương lai ghi `order.updateMany({ data: { status } })` sẽ ĐỎ ngay. AC-3 được
      guard đó phục vụ sẵn; viết guard thứ hai là trùng lặp.
- [x] Chạy lại guard đó và ghi kết quả vào Debug Log (nó là bằng chứng của AC-3, không phải nền).

### Task 5 — Trả nợ L-1 từ review 5.1: `updateLine`/`removeLine` đọc lại con trỏ version trong tx

- [x] Bối cảnh: review 5.1 sửa `addLine` (MEDIUM-3) nhưng **cố ý để lại** `updateLine` L1521 và
      `removeLine` L1588 cùng lớp lỗi, kèm câu **"đề nghị gộp vào 5.2"**
      [Source: `5-1-…md#Senior Developer Review` §🟢 LOW L-1].
- [x] Hiện trạng: cả hai đã có `$transaction` + khoá + `assertMutable(findOrThrowIn(tx, …))`,
      nhưng `lineId` được validate theo con trỏ `currentVersionId` đọc **NGOÀI** tx ⇒ một cặp
      `chot` + `mo_lai` chen giữa để lại thao tác trên dòng của bản **đã bị thay thế** (dữ liệu
      mồ côi, không lỗi nào nổi lên).
- [x] Sửa: lấy `currentVersionIdOrThrow(trongTx)` từ chính object đọc trong tx (khuôn đã có ở
      `addLine` L1479-1485) và validate `lineId` thuộc bản đó **trước** khi ghi.
- [x] ⚠️ Đây là **sửa lỗi có chủ đích được giao lại**, không phải scope creep — nhưng nếu nó
      làm phình story quá 1 ngày công thì **báo lại** thay vì làm dở.

### Task 6 — Test (AC: 1-6)

- [x] **Unit thuần domain** — mở rộng `backend/test/allowed-transition.spec.ts` + tạo
      `backend/test/auto-transition-map.spec.ts`:
  - [x] `suKienChoMoc` trả đúng sự kiện cho cả hai mốc; mọi giá trị `MOC_TU_DONG` đều có ánh xạ
        (exhaustive — lặp qua `Object.values`, không liệt kê tay).
  - [x] Sự kiện do mapping trả về **phải tồn tại** trong `ALLOWED_TRANSITIONS` (test liên kết
        hai bảng — chống mapping trỏ vào sự kiện chết).
  - [x] `daTaiDich`: đúng cho `('dacoc', duCoc)` và cả 3 `from` của `hoanThanh`; **sai** cho
        `('dachot', duCoc)`; **sai** cho một sự kiện không có dòng nào `to === status`.
- [x] **Unit service** — mở rộng `backend/test/orders.service.spec.ts`:
  - [x] Đường thành công: assert **payload** từng op trong tx (`where`/`data`, key VẮNG MẶT
        cũng assert), **KHÔNG đếm mock call**; `StatusChanged.actorAccountId` = actor truyền vào.
  - [x] No-op fast-path: đơn đã `dacoc` + sự kiện `duCoc` ⇒ **không mở transaction nào**,
        **không publish gì** (assert `$transaction` và `eventBus.publish` không được gọi).
  - [x] Thiếu quyền: `actorPermissions` rỗng ⇒ **403 envelope chuẩn**, **không khoá dòng nào,
        không lệnh ghi nào** (AC-6 — bằng chứng không có bypass).
  - [x] Sai cờ phạm vi: `tatToan` trên đơn `dachot` **không** cờ Thiết bị ⇒ 409 `scope`; đơn có
        cờ Thiết bị ⇒ đi được. (Đơn thi công tất toán ở `dachot` **phải** bị từ chối — nó
        hoàn thành qua `nghiemthu`, không đi tắt.)
  - [x] Sự kiện ngoài bảng từ trạng thái hiện tại (vd `duCoc` khi đang `baogia`) ⇒ 409, status
        không đổi.
- [x] **DB lane** — mở rộng `backend/test/orders.db.integration.spec.ts`:
  - [x] **Đua thật:** hai `chuyenTrangThaiTuDong(duCoc)` chạy song song trên cùng đơn ⇒ đúng
        **MỘT** lần đổi status, **MỘT** `StatusChanged`, kẻ thua trả về no-op (không ném).
        Dùng khuôn 12 vòng đua **không delay** (`setTimeout` ép thứ tự = false-green, bài học
        5.1 Debug Log), precedent `discount-approvals.db.integration.spec.ts`.
  - [x] **L-1 (Task 5):** `updateLine` đua với cặp `chot`+`mo_lai` ⇒ không dòng nào bị ghi vào
        bản đã chết.
- [x] **KHÔNG có e2e** — story này không thêm endpoint HTTP nào (xem Task 7). Đừng dựng
      controller giả để có cớ viết e2e.
- [x] **Mutation-verify bắt buộc** — mỗi lần: `cp` backup → bẻ code thật → chạy → khẳng định
      ĐỎ → revert bằng `cp`. **TUYỆT ĐỐI KHÔNG `git checkout`** (code story chưa commit).
      Mutant **phải compile**.

  | # | Mutant | Kỳ vọng |
  |---|--------|---------|
  | M1 | Bỏ fast-path `daTaiDich` | ĐỎ ở test no-op (retry hoá 409) |
  | M2 | Bỏ nhánh no-op **sau sentinel** (ném 409 luôn) | ĐỎ ở test đua DB |
  | M3 | Thay `actorPermissions` truyền vào bằng set chứa mọi key | ĐỎ ở test 403 |
  | M4 | Đổi `suKienChoMoc('coc')` → `SU_KIEN.hoanThanh` | ĐỎ ở unit domain |
  | M5 | `daTaiDich` trả `to === status` → `from === status` | ĐỎ ở unit domain + no-op |
  | M6 | Gỡ đọc lại `currentVersionId` trong tx của `updateLine` | ĐỎ ở test DB L-1 |

- [x] **Lane phải chạy:** `cd backend && npm test` (hermetic) · `npm run test:db` (**cần Docker
      Desktop bật bằng GUI — từ shell headless KHÔNG lên được**; không chạy được thì ghi rõ vào
      Debug Log và **không loay hoay**) · `npx eslint` trên file của story.
- [x] Baseline phải giữ hoặc vượt: **hermetic 59 suite / 1010 test** · **DB 8 suite / 58 test**.
- [x] **D-4:** điền số lane vào Dev Agent Record **SAU** QA phase, khớp số `npm test` thật.

### Task 7 — Việc KHÔNG thuộc story này (chống scope creep)

- [x] **KHÔNG** tạo `PaymentSchedule`/`Installment`/`Payment`, không cột mới, **không migration**
      (7.1/7.2).
- [x] **KHÔNG** thêm endpoint HTTP nào. Chuyển trạng thái thủ công qua API là **5.5**;
      auto-transition không có mặt HTTP theo định nghĩa.
- [x] **KHÔNG** regen OpenAPI (không DTO nào đổi) — chạy `openapi-drift.spec.ts` để xác nhận
      nó vẫn xanh mà không cần regen.
- [x] **KHÔNG** thêm permission key mới — `payments.record` đã có trong registry (L48) và bảng
      transition đã dùng nó cho `duCoc`/`hoanThanh`-từ-`dachot`. Registry giữ **21 key**;
      thêm key kéo theo chuỗi regen 5 bước + 4 drift-guard.
- [x] **KHÔNG** đụng web/mobile — story **thuần backend**, không màn hình nào.
- [x] **KHÔNG** sửa bảng `ALLOWED_TRANSITIONS` (trừ khi test ngõ cụt bắt được lỗi thật — khi đó
      báo cáo, đừng lặng lẽ sửa).
- [x] **KHÔNG** đụng `assertMutable`, `create()`, hay 4 call-site đã nuốt ở 5.1.

## Dev Notes

### Bất biến kiến trúc ràng buộc story

- **AD-11** `[ASSUMPTION]`: *"…Auto-transition và manual transition dùng **chung một entry
  point**; auto-transition là hệ quả của sự kiện nghiệp vụ, đi qua cùng bảng này."*
  ⚠️ "Chung một entry point" ở đây = chung **`applyTransition()`**, KHÔNG phải chung method
  công khai với `confirm`/`revise`. Task 3 thêm một *cửa vào*, engine vẫn là một.
  [Source: `ARCHITECTURE-SPINE.md#AD-11` L108-112]
- **AD-7** `[ADOPTED]`: *"Một số transition tự nhảy theo sự kiện nghiệp vụ (ghi đủ đợt cọc →
  Đã cọc); **mọi** transition đều permission-gated và ghi Audit."* — chữ "mọi" là lý do AC-6
  cấm bypass. [Source: `ARCHITECTURE-SPINE.md#AD-7`]
- **AD-18**: publish domain event qua `EventBus` **sau commit**; producer KHÔNG gọi
  audit/FCM trực tiếp. [Source: `ARCHITECTURE-SPINE.md#AD-18`]
- **AD-5**: envelope do `AllExceptionsFilter` dựng — service chỉ ném `AppException`.
- **NFR-1 / convention spine**: *"thao tác tiền (ghi thanh toán, chốt) idempotent, an toàn khi
  retry"* — AC-5 là hệ quả trực tiếp, vì caller đầu tiên của cửa này chính là ghi nhận thanh toán.
- **`project-context.md` L84**: *"Mỗi story tạo/sửa CHỈ entity/file nó cần; không phụ thuộc
  story sau."* — nền của Task 7.

### Engine đã có sẵn — ĐỌC TRƯỚC KHI VIẾT DÒNG NÀO

| Thứ | Ở đâu | Trạng thái |
|---|---|---|
| Bảng transition (16 dòng, phủ trọn 10 khoá) | `src/orders/domain/allowed-transition.ts` | ✅ xong 5.1 — **không sửa** |
| `evaluateTransition()` thuần | cùng file L220-237 | ✅ xong — thứ tự `not_in_table → scope → permission` là quyết định bảo mật, không đảo |
| `SU_KIEN.duCoc` (`dachot → dacoc`, đòi `payments.record`) | cùng file L134-138 | ✅ **đã khai sẵn cho story này** |
| `SU_KIEN.hoanThanh` (3 dòng `from`) | cùng file L169-188 | ✅ đã khai sẵn |
| Executor `applyTransition(tx, …)` private | `src/orders/orders.service.ts` L357-411 | ✅ xong — **gọi lại, không viết lại** |
| `StatusChanged` (`actorAccountId` **optional**) | `src/orders/domain/order-events.ts` L256-269 | ✅ xong |
| `lockOrderRow` / `findOrThrowIn` / `currentVersionIdOrThrow` | service L336 / L289 / L318 | ✅ dùng lại |
| Source-guard "chỉ `applyTransition` ghi status" | `test/no-order-status-write-outside-transition.spec.ts` | ✅ xong — **AC-3 dựa vào nó, không viết guard thứ hai** |

Khuôn để copy nguyên si cho Task 3: `confirm()` L666-865 — fast-path idempotent ngoài tx →
`$transaction` với engine là op đầu → catch sentinel theo identity → đọc lại → publish sau commit.

### ⚠️ Ba quyết định đã tuyên bố (KHÔNG hỏi lại, KHÔNG tự đảo)

**(1) Actor của auto-transition là CON NGƯỜI kích hoạt, không phải "hệ thống".**
`StatusChanged.actorAccountId` cho phép `undefined` với nghĩa "hệ thống tự chạy"
[Source: `order-events.ts` L253-254]. Story này **không dùng nhánh đó**: mọi caller Phase 1
(`payments/` 7.2, `inventory/` 6.x) đều xuất phát từ một request có người bấm, và người đó
**đã** cầm đúng quyền mà bảng đòi (`payments.record` cho `duCoc`). Truyền quyền thật qua ⇒
gate AD-7 còn hiệu lực **và** audit truy được về người thật.
`undefined` để dành cho trigger thật sự vô chủ (nhắc theo lịch, Story 9.6) — chưa dùng ở đây.
**Hệ quả cấm:** không có tham số bypass, không có hằng "toàn quyền" trong `orders/` (AC-6, M3).

**(2) Mapping là HỢP ĐỒNG THUẦN, cấu hình là của 7.1.**
AC-2 nói mapping "gắn theo Lịch thanh toán" — nhưng Lịch thanh toán chưa tồn tại. Chia đôi:
5.2 sở hữu **hình dạng** (`MocTuDong` → `TransitionEvent`, thuần, test không cần mock); 7.1 sở
hữu **giá trị** (cột trên `Installment`) và 7.2 sở hữu **thời điểm gọi**. Đây là cách duy nhất
thoả AC-2 mà không nhập khẩu schema của epic sau.
Nếu Đại Ca muốn hoãn hẳn AC-2 sang 7.1 thì Task 1 bỏ được — **nêu ở Câu hỏi mở, không tự quyết**.

**(3) `daTaiDich` chỉ phục vụ đường AUTO.**
Ở đường thủ công (5.5), "đã ở đích rồi" nhiều khả năng là người bấm hai lần và hợp đồng UI có
thể muốn báo lỗi. Đừng vội tổng quát hoá cổng no-op ra cho mọi transition — YAGNI, và nó là
quyết định UX chưa ai ra.

### Chuỗi gọi mà 7.2 sẽ viết (KHÔNG viết trong story này — chỉ để hiểu đường)

```
PaymentsService.ghiNhan(...)            ← Story 7.2, chưa tồn tại
  └─ $transaction: tạo Payment, cập nhật đợt
  └─ (sau commit) nếu đợt vừa đủ ⇒
       ordersService.chuyenTrangThaiTuDong({          ← Task 3 của story NÀY
         orderId, event: suKienChoMoc(moc),           ← Task 1
         actorAccountId, actorPermissions,
       })
         └─ OrdersService.applyTransition(tx, …)      ← 5.1, không sửa
              └─ evaluateTransition(…)                ← 5.1, thuần
```

⚠️ **Ranh giới transaction:** `chuyenTrangThaiTuDong` **tự mở transaction của nó**, không chạy
trong tx của caller. Lý do: `payments/` không được cầm `tx` của `orders/` (hai module, hai
aggregate) và engine cần khoá dòng đơn ở đúng phạm vi của nó. Hệ quả phải biết: giữa "ghi
Payment commit" và "status đổi" có một khe — chấp nhận được vì cửa này **idempotent** (AC-5),
nên 7.2 retry được. Ghi rõ đánh đổi này vào TSDoc.

### Permission — KHÔNG cần key mới

Registry `src/accounts/domain/permission-registry.ts` giữ **21 key**; `paymentsRecord:
'payments.record'` đã có ở L48/L104 và bảng transition đã dùng nó cho `duCoc` (L137) và cho
`hoanThanh`-từ-`dachot` (L186). Không đụng registry ⇒ **không** chạy chuỗi regen 5 bước
(`permissions:gen` → `build:permissions` → web `PERM` + mobile `AppPerm` → `permissions-drift.spec.ts`
hardcode `toHaveLength(21)`). ⚠️ Không CI job nào chạy cả backend lẫn design-system ⇒ nếu buộc
phải thêm key thì phải chạy tay cả hai lane [Source: 5-1 Dev Notes §Permission].

### Test lane & khuôn có sẵn

| Lane | Lệnh | Nhận diện |
|------|------|-----------|
| Hermetic | `cd backend && npm test` | `*.spec.ts`, **ignore** `*.db.integration.spec.ts`; mock Prisma |
| DB thật | `cd backend && npm run test:db` | `--runInBand`, chỉ `*.db.integration.spec.ts`; cần `DATABASE_URL` + Docker Desktop bật **bằng GUI** |
| Lint | `cd backend && npm run lint` | ⚠️ **ĐỎ SẴN 90 lỗi `prettier/prettier`** ngoài phạm vi story — chỉ lint file của story |

Jest config nằm **inline trong `backend/package.json`** (không có `jest.config.js`).

### Bài học tích luỹ (áp dụng trực tiếp — đọc kỹ, đã trả giá rồi)

- **Test đua có delay là false-green.** `setTimeout` ép thứ tự ⇒ không chạm cửa sổ nguy hiểm;
  12 vòng đua **tự do, không delay** mới lộ lỗi thật (5.1 đã bắt được một TOCTOU thật nhờ đúng
  chỗ này).
- **Mutation phải làm ĐỎ đúng tầng.** Một mutant xanh có thể vì **tầng phòng thủ khác** đang
  gánh, không phải vì test yếu — khi đó **báo cáo sự thật** (như M1 của 5.1), đừng bịa test
  để tick ô.
- Assert **payload** từng op, key VẮNG MẶT cũng assert; **không đếm mock call**.
- Mutant **phải compile**; revert bằng `cp` backup, **KHÔNG `git checkout`**.
- Guard quét TOÀN VĂN như text ⇒ **đừng viết chuỗi bị cấm trong comment** (false-positive tái diễn).
- **MỘT timestamp cho MỘT sự kiện** — đừng gọi `new Date()` hai lần cho một hành động.
- Prisma 7: giữ guard `createMany` mảng rỗng; nullable Json dùng `Prisma.JsonNull`.
- Flake backend đã biết (`customer-sources.e2e`, `customers`, `me.e2e`, `error-envelope`,
  `orders.e2e`) — đỏ ở đó mà không liên quan thì **rerun trước khi sửa**.
- Docker Desktop **không lên được từ shell headless** — DB lane không chạy thì ghi Debug Log.
- `resolve_customization.py` fail trên máy này (Python < 3.11) — merge workflow block bằng tay.
- Điền Dev Agent Record **SAU** QA phase (D-4).

### Project Structure Notes

- **File mới:** `backend/src/orders/domain/auto-transition-map.ts` ·
  `backend/test/auto-transition-map.spec.ts`.
- **File sửa:** `backend/src/orders/domain/allowed-transition.ts` (thêm `daTaiDich`) ·
  `backend/src/orders/orders.service.ts` (sentinel + entry point + Task 5) ·
  `backend/src/orders/orders.module.ts` (`exports`) · `backend/test/allowed-transition.spec.ts` ·
  `backend/test/orders.service.spec.ts` · `backend/test/orders.db.integration.spec.ts`.
- **Không lệch chuẩn nào.** Cả hai file domain mới đều kebab-case, thuần, không import
  Nest/Prisma — đúng quy ước spine (`allowed-transition.ts` chính là ví dụ được spine nêu tên).
- **Không migration.** `Order.status` là `String`, không phải enum DB; story không thêm cột nào.
- `OrdersService` giữ **ĐÚNG hai** dependency (`PrismaService`, `EventBus`).

### Nợ kỹ thuật story này đóng

- **L-1** (review 5.1) — `updateLine`/`removeLine` ghi theo con trỏ version đọc ngoài tx →
  đóng bằng Task 5.
- Mở cửa cho **7.2** và **6.x** mà không để chúng phải phát minh đường ghi status riêng.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.2` L490-495] — user story + 3 AC verbatim
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 5` L480-545] · [`#Story 7.1` L608-614, `#Story 7.2` L616-622] — caller thật đầu tiên
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-8` L168-171] — mapping đợt→trạng thái là `[ASSUMPTION]` cấu hình theo Lịch
- [Source: `prd.md#9 Assumptions Index` L549] · [`#8` L538] — mapping chi tiết vẫn là câu hỏi mở cấp PRD
- [Source: `ARCHITECTURE-SPINE.md#AD-11` L108-112, `#AD-7`, `#AD-5`, `#AD-18`]
- [Source: `_bmad-output/project-context.md`] L44 (chỉ `applyTransition` đổi status), L50 (EventBus), L69-71 (scout-before-code), L75-80 (testing), L84 (không phụ thuộc story sau)
- [Source: `_bmad-output/implementation-artifacts/5-1-engine-applytransition-enum-bang-transition-guard-audit.md`] — §Senior Developer Review L-1 (giao lại cho 5.2), §Debug Log (false-green test đua, M1), §Completion Notes (hai tầng permission)
- [Source: `backend/src/orders/domain/allowed-transition.ts`] L45-71 (`SU_KIEN`), L99-207 (bảng), L220-237 (`evaluateTransition`)
- [Source: `backend/src/orders/orders.service.ts`] L201-229 (4 sentinel), L251-254 (đúng 2 dependency), L289 (`findOrThrowIn`), L318, L336 (`lockOrderRow`), L357-411 (executor), L666-865 (`confirm` — khuôn), L1479-1485 (`addLine` đọc lại con trỏ trong tx), L1521, L1588
- [Source: `backend/src/orders/domain/order-events.ts`] L253-269 (`StatusChanged`)
- [Source: `backend/src/accounts/domain/permission-registry.ts`] L48, L104 (`payments.record`)
- [Source: `backend/test/no-order-status-write-outside-transition.spec.ts`] — guard phục vụ AC-3

### Stack (đã xác minh từ `backend/package.json`)

NestJS 11.1.27 · Prisma 7.8.0 pin cứng + adapter `@prisma/adapter-pg` 7.8.0 · TypeScript 5.7 ·
Jest 30 + ts-jest 29.4 · Node 24. **Không thêm dependency mới.**

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

**Lane đã chạy (số thật, sau khi lint --fix):**

| Lane | Lệnh | Kết quả |
|------|------|---------|
| Hermetic | `cd backend && npm test` | **62 suite / 1044 test — XANH** (baseline 59/1010 ⇒ +3 suite, +34 test; trong đó dev phase +1 suite/+22 test, QA phase +2 suite/+12 test) |
| DB thật | `cd backend && npm run test:db` | **8 suite / 61 test — XANH** (baseline 8/58 ⇒ +3 test, QA phase không thêm). Docker Desktop ĐANG BẬT ở phiên này nên lane chạy được, không phải ghi nợ như 5.1. |
| Lint | `npx eslint` trên 8 file của story | **XANH** (11 lỗi `prettier/prettier` do dev sinh ra đã `--fix`; 90 lỗi có sẵn ngoài phạm vi story không đụng tới) |
| Typecheck | `npx tsc --noEmit` | XANH |
| Guard AC-3 | `no-order-status-write-outside-transition.spec.ts` | **XANH** — quét toàn `src/`, không điểm ghi `Order.status` thứ hai nào sau khi `OrdersModule` export service |
| Task 7 | `openapi-drift.spec.ts` + `permissions-drift.spec.ts` | **23 test XANH mà KHÔNG cần regen** — không DTO nào đổi, registry giữ nguyên 21 key |

**RED-first đã xác nhận từng bước** (không phải viết test sau code):
- Task 1/2: 2 suite ĐỎ vì thiếu module/export → GREEN sau khi hiện thực.
- Task 3: `TS2339 Property 'chuyenTrangThaiTuDong' does not exist` → GREEN.
- Task 5: 2 test L-1 ĐỎ trên code hiện hành ⇒ **lỗi L-1 là THẬT, không phải lo xa** → GREEN sau khi đọc lại con trỏ trong tx.

**Mutation-verify (backup bằng `cp`, KHÔNG `git checkout` — code story chưa commit; mọi mutant đều compile):**

| # | Mutant | Kỳ vọng | Thực tế |
|---|--------|---------|---------|
| M1 | Bỏ fast-path `daTaiDich` | ĐỎ ở test no-op | ✅ **ĐỎ** — retry hoá 409 |
| M2 | Bỏ nhánh no-op sau sentinel | ĐỎ ở test đua DB | ✅ **ĐỎ** ở DB lane (1 suite thất bại) |
| M3 | Thay `actorPermissions` bằng set toàn quyền | ĐỎ ở test 403 | ✅ **ĐỎ** — 2 test (bộ rỗng + thiếu đúng `payments.record`) |
| M4 | `suKienChoMoc('coc')` → `hoanThanh` | ĐỎ ở unit domain | ✅ **ĐỎ** |
| M5 | `daTaiDich`: `to === status` → `from === status` | ĐỎ ở unit domain + no-op | ✅ **ĐỎ** — 12 test qua 2 suite |
| M6 | Gỡ đọc lại `currentVersionId` trong tx của `updateLine` | ĐỎ ở test DB L-1 | ⚠️ **XANH ở DB lane, ĐỎ ở unit hermetic** — xem dưới |

**⚠️ M6 — báo cáo trung thực, KHÔNG bịa test để tick ô** (theo Dev Notes §Bài học: "mutant xanh có thể vì tầng phòng thủ khác đang gánh"):

Test đua DB L-1 **không chạm được** cửa sổ nguy hiểm. Lý do cấu trúc, không phải test yếu: cửa sổ đòi **toàn bộ** `chot` + `mo_lai` (hàng chục query, sinh version mới, copy dòng, repoint) lọt trọn vẹn vào khe pre-tx của `updateLine` — khe đó chỉ có **2 query**. 12 vòng đua tự do không vòng nào rơi trúng; thực tế kẻ thua luôn dừng ở `assertMutable` ⇒ 409, đúng như test khẳng định.

Tầng **thực sự gánh** L-1 là **unit hermetic** `L-1: con trỏ bản hiệu lực cũng phải đọc LẠI trong tx` — nó ép được đúng interleaving bằng mock (`findUnique` lần 1 trả bản cũ, lần 2 trả bản đã repoint), và M6 làm nó **ĐỎ ngay**. Test DB L-1 vẫn giữ vì nó khẳng định một bất biến khác có giá trị (thay đổi của `updateLine` thành công **phải** nhìn thấy được ở bản hiệu lực), chỉ là nó không phải cái bắt M6.

Không thêm `setTimeout` để "ép" test DB đỏ — đó đúng là false-green mà 5.1 đã trả giá.

### Completion Notes List

- **AC-1** — `OrdersService.chuyenTrangThaiTuDong()` gọi CHÍNH `applyTransition()` mà `confirm`/`revise`/`applyDiscount` đi qua. Không viết engine mới, không bảng mới, không guard mới. Test khẳng định payload cổng atomic là `where: { id, status: 'dachot' }` / `data: { status: 'dacoc' }` — đích do bảng quyết, không do call-site chế.
- **AC-2** — `auto-transition-map.ts` thuần domain (không import Nest/Prisma): `MOC_TU_DONG` đúng hai mốc (`coc`, `tatToan`), `suKienChoMoc()` map tới **sự kiện**, không tới trạng thái đích. `switch` trên union hẹp ⇒ thêm mốc mà quên nhánh sẽ ĐỎ ở typecheck. Test liên kết hai bảng: mọi sự kiện do mapping trả về đều có dòng thật trong `ALLOWED_TRANSITIONS` (chống trỏ vào sự kiện chết).
- **AC-3** — `OrdersModule` export `OrdersService`; source-guard 5.1 (không sửa một dòng) vẫn xanh khi quét toàn `src/` ⇒ không tồn tại đường ghi `Order.status` thứ hai. KHÔNG tạo `payments.module.ts`/`inventory.module.ts` rỗng để "chứng minh".
- **AC-4** — ĐÚNG MỘT public method cho module ngoài. `OrdersService` giữ **đúng hai** dependency (`PrismaService`, `EventBus`) — `actorPermissions` nhận từ caller, không inject `AccountPermissionsService`.
- **AC-5** — Idempotent hai tầng: fast-path `daTaiDich()` ngoài tx (không mở transaction, không khoá, không publish) **và** nhánh no-op sau sentinel cho kẻ thua cuộc đua. Test DB 12 vòng đua tự do: đúng MỘT lần đổi status, đúng MỘT `StatusChanged`, **không** lần gọi nào ném. Test "gọi lại sau khi đã tới đích" còn assert `updatedAt` không đổi ở tầng DB — bằng chứng không lệnh ghi nào chạm dòng đơn.
- **AC-6** — Không tham số bypass, không hằng toàn quyền trong `orders/`. `actorPermissions` pass-through nguyên vẹn; bộ rỗng ⇒ 403 **trước** op DB đầu tiên (không khoá, không ghi, không event). M3 chứng minh test này load-bearing.
- **Task 5 (nợ L-1)** — `updateLine`/`removeLine` giờ đọc lại con trỏ version **trong tx** và validate `lineId` thuộc bản đó trước khi ghi. Tách `findLineOrThrowIn(tx, versionId, lineId)`; `findLineOrThrow` cũ delegate sang nó ⇒ một hiện thực, không nhân đôi luật 404. Lỗi được chứng minh có thật bằng RED trước khi sửa.
- **`daTaiDich` chỉ dùng ở đường AUTO** — TSDoc ghi rõ không tổng quát hoá sang transition thủ công (5.5); "đã ở đích" ở đó là quyết định UX chưa ai ra.
- **Task 7 giữ trọn** — không entity/bảng/migration thanh toán, không endpoint HTTP, không regen OpenAPI, không permission key mới (registry vẫn 21 key), không đụng web/mobile, không sửa `ALLOWED_TRANSITIONS`, không đụng `assertMutable`/`create()`/4 call-site của 5.1.

### File List

**Mới:**
- `backend/src/orders/domain/auto-transition-map.ts`
- `backend/test/auto-transition-map.spec.ts`

**Sửa:**
- `backend/src/orders/domain/allowed-transition.ts` — thêm hàm thuần `daTaiDich()`
- `backend/src/orders/orders.service.ts` — sentinel `TU_DONG_GATE_THUA`, public `chuyenTrangThaiTuDong()`, tách `findLineOrThrowIn()`, `updateLine`/`removeLine` đọc lại con trỏ version trong tx
- `backend/src/orders/orders.module.ts` — `exports: [OrdersService]` + lý do trong TSDoc
- `backend/test/allowed-transition.spec.ts` — 5 test cho `daTaiDich`
- `backend/test/orders.service.spec.ts` — 10 test `chuyenTrangThaiTuDong` + 3 test L-1
- `backend/test/orders.db.integration.spec.ts` — 2 test đua auto-transition + 1 test L-1
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 5-2 → review

**Review phase sửa (code review, không đụng `src/`):**
- `backend/test/no-fabricated-actor-permissions.spec.ts` — guard quét thêm cửa CÔNG KHAI
  `chuyenTrangThaiTuDong` (không chỉ engine private) + luật "toàn quyền" quét toàn `src/`
- `backend/test/allowed-transition.spec.ts` — +1 bất biến: cổng no-op không được nuốt transition hợp lệ

**QA phase thêm (bmad-qa-generate-e2e-tests, không đụng `src/`):**
- `backend/test/no-fabricated-actor-permissions.spec.ts` — **mới**, source-guard AC-6: engine chỉ nhận quyền của actor thật
- `backend/test/orders-module-wiring.spec.ts` — **mới**, AC-4: `OrdersModule` export `OrdersService`
- `backend/test/orders.service.spec.ts` — +1 test AD-18 (`publish` SAU commit ở cửa auto)
- `_bmad-output/implementation-artifacts/tests/test-summary-story-5-2.md` — biên bản QA

## Change Log

| Ngày | Thay đổi |
|------|----------|
| 2026-07-18 | Mapping mốc thanh toán → sự kiện (thuần domain, hợp đồng cho 7.1/7.2); cổng no-op `daTaiDich()` suy từ bảng transition |
| 2026-07-18 | Entry point công khai duy nhất `chuyenTrangThaiTuDong()` — auto và manual dùng chung `applyTransition()`, idempotent hai tầng, quyền pass-through không bypass |
| 2026-07-18 | `OrdersModule` export `OrdersService` để `payments/` (7.2) và `inventory/` (6.x) không phải phát minh đường ghi status riêng |
| 2026-07-18 | Đóng nợ L-1 từ review 5.1: `updateLine`/`removeLine` validate dòng theo con trỏ version đọc TRONG tx (lỗi được chứng minh bằng test ĐỎ trước khi sửa) |
| 2026-07-18 | Test: +22 hermetic (60 suite/1032), +3 DB (8 suite/61); mutation-verify M1–M5 ĐỎ đúng tầng, M6 báo cáo trung thực (ĐỎ ở unit, DB lane không chạm được cửa sổ) |
| 2026-07-18 | Review: guard AC-6 quét thêm CỬA CÔNG KHAI `chuyenTrangThaiTuDong` (probe chứng minh một `payments/` tự chế bộ quyền lọt qua guard cũ) + luật "toàn quyền" quét toàn `src/`; thêm bất biến chống cổng no-op nuốt transition hợp lệ. Hermetic 62/1047, DB 8/61 |
| 2026-07-18 | QA phase: +12 hermetic (62 suite/1044) vá 3 gap cấu trúc — guard AC-6 (quyền tự chế ở call-site engine), wiring AC-4 (`exports`), AD-18 (publish sau commit ở cửa auto); cả 3 mutation-verify ĐỎ đúng tầng. Dựng lại M1 theo yêu cầu của QA 5.1: khoá engine vẫn XANH ở lane DB — tiền đề "caller đọc-rồi-ghi trong engine" không xảy ra ở 5.2, chuyển câu hỏi sang 5.5 |

## Senior Developer Review (AI)

**Reviewer:** Code review tự động (adversarial) · **Ngày:** 2026-07-18 · **Kết luận: APPROVE**

**Lane tự chạy lại, KHÔNG tin số trong story:** hermetic **62 suite / 1044 test XANH** và DB
**8 suite / 61 test XANH** — khớp CHÍNH XÁC con số Dev Agent Record khai. File List khớp
`git status` từng file (12/12). Lint file story: XANH. Typecheck: XANH.

### 🔴 CRITICAL: không có

Mọi task `[x]` đều có bằng chứng thật; 6 AC đều IMPLEMENTED. Task 7 (chống scope creep) giữ
trọn: không migration, không entity thanh toán, không endpoint, không permission key mới
(registry vẫn 21), không đụng web/mobile, `ALLOWED_TRANSITIONS` không sửa một dòng.

### 🟡 MEDIUM-1 — Guard AC-6 canh cái cửa đã khoá, bỏ ngỏ cái cửa vừa mở **[ĐÃ SỬA]**

`no-fabricated-actor-permissions.spec.ts` (QA phase) chỉ quét call-site `this.applyTransition(`
và chỉ cấm dựng tập quyền trong `src/orders/`. Nhưng `applyTransition` là **private** — module
ngoài không chạm tới được. Cửa mà `payments/` (7.2) thực sự gọi là `chuyenTrangThaiTuDong()`,
và cửa đó **không được quét**.

**Đã chứng minh bằng probe, không phải suy đoán:** dựng một `FakePaymentsService` trong `src/`
gọi `chuyenTrangThaiTuDong({ actorPermissions: new Set(Object.values(PERM)) })` ⇒ guard **XANH
8/8**. Đó đúng là kịch bản AC-6 cấm ("không nhánh nào gọi engine với `actorPermissions` tự
chế"), đạt được mà không một test nào đỏ.

Sửa: (1) máy quét đọc cả `.chuyenTrangThaiTuDong(`; (2) luật "toàn quyền" quét toàn `src/` chứ
không riêng `orders/` — đặt hằng ở `src/payments/` rồi truyền sang là cùng một cú bypass.
Xác minh lại: probe biến thể inline ⇒ **ĐỎ 2 test**; probe biến thể hằng-ngoài-orders ⇒ **ĐỎ**.
Probe đã xoá. `accounts/` không dính (dựng từ `rows` DB, không từ registry).

### 🟢 LOW-1 — Cổng no-op có thể nuốt một transition hợp lệ nếu bảng mọc thêm dòng **[ĐÃ SỬA]**

`daTaiDich(status, event)` đúng khi tồn tại dòng `to === status`. Nếu bảng có cả `X: a → b` lẫn
`X: b → c` thì đơn ở `b` gặp `X` bị fast-path trả no-op — một bước hợp lệ biến mất IM LẶNG.
Bảng hôm nay **không** có cặp nào như vậy (đã kiểm 16 dòng), nên đây là rào chắn tương lai, không
phải lỗi đang sống. Đã thêm bất biến khoá lại; mutation-verify bằng cách chèn dòng
`duCoc: dacoc → thicong` ⇒ **ĐỎ**, revert bằng `cp`.

### 🟢 LOW-2 — Fast-path no-op chạy TRƯỚC kiểm quyền (không sửa — đúng thiết kế đã tuyên bố)

Đơn đã ở đích ⇒ `return` trước khi engine xét quyền, nên caller không quyền nhận `void` thay vì
403 (một bit rò: biết đơn có ở đích không). Đây là **thứ tự story chỉ định tường minh** (Task 3
thân hàm bước 1→2) và là điều kiện để AC-5 "không mở transaction" thành lập. Không đảo trong
review. Rủi ro thật thấp: cửa này không có mặt HTTP, caller là module nội bộ đã gate quyền của
nó. Nếu 5.5 mở transition thủ công qua API thì xét lại ở đó.

### 🟢 LOW-3 — `suKienChoMoc` toàn phần ở COMPILE-TIME, không phải runtime (bàn giao cho 7.1)

`switch` không `default`: giá trị ngoài union ⇒ trả `undefined` lúc chạy. Vô hại hôm nay (không
caller nào). Nhưng 7.1 sẽ lưu `MocTuDong` thành **cột chuỗi** — đọc ra rồi cast là qua mặt được
typecheck, và `event: undefined` sẽ rơi xuống 409 khó hiểu thay vì lỗi cấu hình rõ ràng.
**7.1 phải validate giá trị cột theo `MOC_TU_DONG` tại biên đọc DB.** Không sửa ở đây: hàm và
TSDoc là quyết định thiết kế của story, và biên validate thuộc về nơi dữ liệu vào hệ thống.

### 🟢 LOW-4 — `_bmad-output/story-automator/orchestration-*.md` đổi nhưng không có trong File List

Sổ sách của automator, không phải sản phẩm story. Ghi nhận, không sửa.

### Điểm đã kiểm và KHÔNG có vấn đề

- **M6 báo cáo trung thực** — kiểm lại: gỡ đọc-lại con trỏ trong tx của `updateLine` thì test
  unit L-1 ĐỎ thật. Dev nói đúng, DB lane không chạm được cửa sổ đó; **không** thêm `setTimeout`
  để ép đỏ là quyết định đúng.
- **Test đua DB không delay**, 12 vòng, assert cả `updatedAt` ở tầng DB — không false-green.
- **Thứ tự publish sau commit** (AD-18) có test thứ tự thật, không đếm mock call.
- **`OrdersService` giữ đúng 2 dependency**; `exports` có wiring test bằng metadata.
- **Sentinel bắt theo identity**, không `instanceof` — cùng khuôn 4 sentinel của 5.1.

### Lane sau khi sửa

| Lane | Kết quả |
|------|---------|
| Hermetic | **62 suite / 1047 test XANH** (+3 test của review) |
| DB thật | **8 suite / 61 test XANH** |
| Lint + typecheck file review | XANH |

## Câu hỏi mở (không chặn dev — trả lời khi review)

1. **AC-2 chia đôi có được không?** 5.2 khai hình dạng mapping (`MocTuDong` → sự kiện), 7.1 gắn
   giá trị lên `Installment`. Phương án khác: hoãn hẳn AC-2 sang 7.1 và 5.2 chỉ giao cửa vào.
   Mặc định đang chọn **chia đôi** (Task 1). Im lặng ⇒ giữ mặc định.
2. **Hai mốc auto (`coc`, `tat_toan`) đã đủ chưa?** PRD §8 câu 2 vẫn liệt "mapping đợt→trạng
   thái chi tiết" là câu hỏi mở cấp PRD. Nếu Lịch thanh toán thật có mốc thứ ba sinh transition,
   nói ở 7.1 — 5.2 thêm một dòng enum là xong.
3. **Cửa sổ giữa "Payment commit" và "status đổi"** (hai transaction) — chấp nhận vì idempotent.
   Nếu Đại Ca muốn nguyên tử tuyệt đối thì phải để `payments/` cầm `tx` của `orders/`, tức phá
   ranh giới module — **không khuyến nghị**.
4. **Kế thừa từ 5.1, vẫn mở:** ① AD-11 nên nâng `[ASSUMPTION]` → `[ADOPTED]` trong spine;
   ② "đơn `dachot` với 0 dòng" (cổng 0-dòng của `confirm` nằm ngoài tx) — đổi hành vi nên cần
   Đại Ca quyết, **không** gộp vào story này; ③ D-6/TD-1 (web chưa có typecheck/runtime test)
   đến hạn ở 5.3/5.4/5.5 — 5.2 thuần backend nên không bị chặn; ④ D-2 (CI Actions xanh thật)
   càng cấp thiết vì lane DB tiếp tục lớn lên.
