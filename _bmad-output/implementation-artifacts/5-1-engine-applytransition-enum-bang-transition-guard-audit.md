---
baseline_commit: 63af740766d7e3f3f475b5a683f29339bd456ab2
---

# Story 5.1: Engine `applyTransition()` — enum + bảng transition + guard + audit

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên backend**,
I want **một hàm `applyTransition()` duy nhất ghi `Order.status`**,
so that **mọi chuyển trạng thái đi qua một chỗ đánh giá guard và ghi audit**.

> **⚠️ ĐÂY LÀ STORY TÍCH HỢP, KHÔNG PHẢI STORY DỰNG MỚI.** Bốn call-site đang chạy trong
> production-code (`confirm`, `revise`, `applyDiscount`, `resolveDiscount`-reject) phải bị
> **NUỐT** vào engine, giữ nguyên từng hợp đồng idempotency/audit/event/thông điệp lỗi của
> chúng. Viết engine trên giấy trắng rồi để 4 call-site cũ nguyên chỗ = story THẤT BẠI.
> Retro Epic 4 §7: *"Story 5.1 gánh tải bất thường… nên có cổng review riêng và mutation-test
> trên lane DB là bắt buộc"* [Source: `_bmad-output/implementation-artifacts/epic-4-retro-2026-07-17.md#7`].

## Acceptance Criteria

1. **Given** trạng thái là enum tường minh + allowed-transition table, **When** gọi
   `applyTransition({order, event, actorPermissions, scopeFlags})`, **Then** đây là con đường
   code DUY NHẤT ghi `Order.status`; transition chỉ hợp lệ khi qua bảng + gate theo cờ phạm vi
   + permission (AD-7, AD-11, FR-7, FR-9).
2. **Given** một transition được áp, **When** ghi, **Then** đây là nơi duy nhất đánh giá guard
   và nơi duy nhất phát bản ghi Audit + publish event `StatusChanged` (from→to, ai, khi nào)
   (AD-11, AD-18, FR-9).
3. **Given** actor thiếu permission, **When** gọi transition, **Then** bị từ chối với envelope
   lỗi chuẩn, không đổi status (AD-4, FR-9).

[Source: `_bmad-output/planning-artifacts/epics.md#Story 5.1` L483-488 — verbatim]

### AC bổ sung (dẫn xuất từ retro Epic 4 D-1/P-1 — bắt buộc để đóng story)

4. **Given** codebase sau story, **When** chạy source-guard mới, **Then** **KHÔNG call-site nào
   ngoài `applyTransition()` ghi `Order.status`** — ngoại lệ DUY NHẤT được allowlist là
   `create()` (INSERT `baogia` lúc tạo đơn, không phải transition).
5. **Given** lane DB, **When** gỡ khoá dòng (`FOR UPDATE`) khỏi engine, **Then** test race
   **ĐỎ** (mutation-verify bắt buộc, không được false-green).
6. **Given** cả bốn hành động cũ, **When** gọi lại sau khi đã thành công, **Then** hợp đồng
   idempotency của từng cái **giữ nguyên byte-for-byte**: `confirm` 200 no-op · `revise` 200
   no-op · `applyDiscount` **luôn 409** · `resolveDiscount` cùng-quyết-định 200 / ngược 409.

[Source: `epic-4-retro-2026-07-17.md#8` D-1; `#6` P-1; `#5` TD-22/TD-23]

## Tasks / Subtasks

### Task 1 — Hoàn thiện bộ hằng trạng thái (AC: 1)

- [x] Thêm 7 hằng còn thiếu vào `backend/src/orders/domain/order-status.ts`:
      `TRANG_THAI_DA_COC='dacoc'`, `TRANG_THAI_THI_CONG='thicong'`, `TRANG_THAI_NGHIEM_THU='nghiemthu'`,
      `TRANG_THAI_DANG_GIAO='danggiao'`, `TRANG_THAI_DA_GIAO='dagiao'`,
      `TRANG_THAI_HOAN_THANH='hoanthanh'`, `TRANG_THAI_HUY='huy'`.
- [x] ⚠️ Khoá thi công là **`thicong`**, KHÔNG phải `dangthicong` (union đã khoá, khớp từng byte
      với `StatusKey` chip design-system).
- [x] Cập nhật doc header: bỏ câu "bảng transition KHÔNG sống ở đây" → trỏ sang file bảng mới.
- [x] KHÔNG đổi `OrderStatusKey` union (10 khoá đã khớp `StatusChip.tsx` — đổi sẽ vỡ parity guard).

### Task 2 — Bảng allowed-transition thuần domain (AC: 1, 3)

- [x] Tạo `backend/src/orders/domain/allowed-transition.ts` — **DOMAIN THUẦN: KHÔNG import
      Nest/Prisma** (spine L34; convention spine đặt tên đúng file này làm ví dụ kebab-case).
- [x] Khai báo `type TransitionEvent` (enum sự kiện tường minh, không phải free string).
- [x] Khai báo bảng: mỗi entry `{ event, from, to, requires: PermissionKey, scopeGuard? }`.
- [x] Export `evaluateTransition({ order, event, actorPermissions, scopeFlags })` → union
      `{ ok: true; to: OrderStatusKey }` | `{ ok: false; reason: 'not_in_table' | 'scope' | 'permission' }`.
      Hàm **thuần**, không async, không side effect — unit-test được không cần mock.
- [x] Thứ tự đánh giá **cố định**: (1) cặp `from→event` có trong bảng? (2) cờ phạm vi cho phép?
      (3) actor có permission? — sai thứ tự sẽ lộ thông tin trạng thái cho actor thiếu quyền.
- [x] Bảng phải phủ 4 transition đang chạy (Task 4) + các transition Epic 5/6/7 sẽ dùng, theo
      state machine spine (xem *Bảng transition chuẩn tắc* trong Dev Notes).

### Task 3 — Executor `applyTransition()` trong service (AC: 1, 2, 5)

- [x] Thêm **private method DUY NHẤT** `applyTransition()` trong `backend/src/orders/orders.service.ts`.
      Đây là **method DUY NHẤT toàn codebase** có `status` trong `data` của một lệnh ghi Prisma
      trên `order` (trừ `create()`).
- [x] Chữ ký: nhận `tx` (Prisma transaction client) + `{ order, event, actorPermissions, scopeFlags, sentinel }`.
      Chạy **BÊN TRONG** `$transaction` của caller — KHÔNG tự mở transaction riêng.
- [x] Thân hàm, đúng thứ tự:
  - [x] 1. `evaluateTransition(...)` → nếu `ok: false` ném `AppException` envelope chuẩn
        (403 permission / 409 not_in_table / 409 scope) — **trước** khi đụng DB.
  - [x] 2. `await tx.$queryRaw\`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE\`` —
        khoá dòng đơn, op **đầu tiên** chạm DB.
  - [x] 3. `tx.order.updateMany({ where: { id, status: <from quan sát được> }, data: { status: to } })`.
  - [x] 4. `if (count === 0) throw sentinel` — sentinel do caller truyền vào (giữ nguyên 4
        sentinel hiện có, bắt theo **identity** không phải `instanceof`).
  - [x] 5. Trả về object `StatusChanged` event **chưa publish** — caller publish SAU commit (AD-18).
- [x] ⚠️ `where.status` dùng **giá trị quan sát được** (`before.status`) ở `confirm()` —
      `confirm` hợp lệ từ CẢ `baogia` LẪN `choduyet`; hardcode literal sẽ vỡ nhánh `choduyet`.
- [x] Cập nhật doc header service (L71-74): bỏ "BỐN điểm ghi status tạm thời" → phát biểu bất
      biến mới. **KHÔNG viết mã story ("5.1") vào comment** — nói bất biến, không nói story id.

### Task 4 — NUỐT bốn call-site (AC: 1, 4, 6) — **tim của story**

- [x] **4a. `confirm()`** (`orders.service.ts:653-660`): thay block `tx.order.updateMany` bằng
      `applyTransition(...)`. Giữ nguyên trong cùng tx: `tx.orderVersion.update` (vatRate,
      `vatMode ?? 'co_vat'`, chotAt, discountAmount) + vòng lặp `tx.orderLineItem.update`
      (unitPriceSnapshot, catalogPriceSnapshot, `warrantyStartAt: chotAt` **chỉ khi đang null**).
      Giữ nguyên: fast-path idempotent, gate 409 `choduyet` thiếu `dong_y`, 400 khi 0 dòng,
      catch `CHOT_GATE_THUA` + re-read, publish `OrderConfirmed` sau commit.
- [x] **4b. `revise()`** (`:804-809`): thay block. Gate transition phải **vẫn là op đầu tiên**
      trong tx (rollback rẻ). Giữ: `orderVersion.create(versionNo+1)`, `createMany` copies
      **có guard `copies.length > 0`** (Prisma 7 empty-createMany), repoint `currentVersionId`,
      sentinel `MO_LAI_GATE_THUA`, publish `OrderRevised`.
- [x] **4c. `applyDiscount()`** (`:921-937`): thay block. ⚠️ Gate status **đang kiêm bất biến
      "một approval pending mỗi đơn"** — sau khi nuốt, bất biến đó phải VẪN được cổng atomic
      bảo vệ (viết test riêng khẳng định 2 request đua nhau ⇒ đúng 1 `DiscountApproval`).
      Giữ: `discountApproval.create` trong cùng tx, sentinel `AP_CK_GATE_THUA`, **luôn 409**
      khi thua cổng (KHÔNG idempotent — body mang `amount`), publish `DiscountRequested`.
- [x] **4d. `resolveDiscount()`** (`:1025-1049`): ⚠️ **BẤT ĐỐI XỨNG — đọc kỹ.** Cổng atomic ở đây
      nằm trên dòng `DiscountApproval`, KHÔNG phải dòng `Order`. Thứ tự bắt buộc giữ nguyên:
      (1) `tx.discountApproval.updateMany` gate + `DUYET_CK_GATE_THUA`; (2) **chỉ nhánh reject**
      gọi `applyTransition` cho `choduyet → baogia`; (3) giữ nguyên assertion bất biến
      (`count !== 1` ⇒ ném lỗi huỷ cả tx) — engine phải bộc lộ được `count` hoặc caller giữ
      assertion riêng. Nhánh ĐỒNG Ý **KHÔNG đổi status** — không gọi engine.
- [x] Xoá 4 comment `"5.1 nuốt block này"` (`orders.service.ts` L73-74, 517-518, 720-721, 862, 968-969)
      và câu tương ứng ở `backend/src/orders/dto/order-response.dto.ts:51`.
- [x] **KHÔNG đụng** `create()` L327 (`status: TRANG_THAI_BAO_GIA` lúc INSERT — không phải
      transition, nằm ngoài engine theo thiết kế).
- [x] **KHÔNG đụng** `assertMutable()` (L275-282) — nó chỉ ĐỌC status, là guard sửa-nội-dung,
      không phải transition.

### Task 5 — Event `StatusChanged` (AC: 2)

- [x] Thêm class `StatusChanged` vào `backend/src/orders/domain/order-events.ts`, theo đúng
      khuôn hiện có: `readonly type = 'StatusChanged'`, `target = { type: 'Order', id: orderId }`,
      mang `before`/`after` là `OrderSnapshot` (from→to tự kể chuyện), `actorAccountId`,
      `occurredAt`. `actorAccountId` **optional** — `undefined` = hệ thống/auto-transition (5.2).
- [x] **KHÔNG gọi `AuditService` trực tiếp** (AD-18) — publish event, `AuditSubscriber` ghi log.
- [x] **Quyết định đã tuyên bố:** `StatusChanged` publish **THÊM**, không thay thế 4 event
      nghiệp vụ hiện có (`OrderConfirmed`, `OrderRevised`, `DiscountRequested`, `DiscountResolved`).
      Lý do: 4 event kia mang payload nghiệp vụ (`amount`, `note`, `approved`, `reason`) mà Epic 9
      (FCM) cần và đã có test khẳng định; xoá chúng = regression. Hệ quả tường minh: **một lần chốt
      sinh 2 dòng audit** (`OrderConfirmed` + `StatusChanged`) — chấp nhận, vì `StatusChanged` là
      vết from→to chính tắc mà AD-11 đòi và là vết DUY NHẤT mà 5.2/6.x/7.x sẽ có.
- [x] **MỘT timestamp cho một sự kiện** — dùng lại cùng một `new Date()` cho cả 2 event của cùng
      một hành động, đừng gọi `new Date()` hai lần (finding 4.8: `occurredAt ≠ exportedAt`).

### Task 6 — Đóng TOCTOU bằng khoá dòng (AC: 5) — **cẩn thận false-green**

- [x] Khoá `FOR UPDATE` trong engine (Task 3 bước 2) **chỉ đóng được một nửa cửa sổ**. Nửa còn
      lại: `addLine`/`updateLine`/`removeLine`/`update` hiện **không có transaction và không
      khoá gì cả** (`orders.service.ts:1199, 1318, 1380, 459` — đọc `findOrThrow` → `assertMutable`
      → ghi, không tx). Một `addLine` xen giữa lúc `confirm` đọc dòng và lúc commit vẫn chèn
      được dòng chưa-snapshot.
- [x] Vì vậy: bọc 4 mutator dòng/nội-dung vào `$transaction` interactive và cho mỗi cái lấy
      **cùng một khoá** `SELECT id FROM orders WHERE id = $1 FOR UPDATE` làm op đầu tiên,
      **sau** `assertMutable` (đọc lại status bên trong tx sau khi có khoá — đọc ngoài tx là
      lời hứa suông).
- [x] ⚠️ **Bài học đã ghi:** khoá một phía là false-green. Nếu chỉ engine khoá mà mutator không
      khoá, test race vẫn có thể xanh nhờ tầng phòng thủ khác (cổng atomic `updateMany`) —
      xanh KHÔNG chứng minh khoá hoạt động. Mutation-test phải gỡ khoá ở **cả hai phía** và
      khẳng định ĐỎ ở test tương ứng.
- [x] Precedent để copy: `backend/src/catalog/product-prices.service.ts:100` và
      `product-groups.service.ts:338`. ⚠️ Khác biệt: hai chỗ đó dùng `$transaction([ops])` dạng
      mảng (`this.prisma.$queryRaw\`…\`` là phần tử #0); `orders/` dùng **interactive** tx nên
      phải là `await tx.$queryRaw\`…\`` bên trong callback.

### Task 7 — Source-guard "không ai ghi status ngoài engine" (AC: 4)

- [x] Tạo `backend/test/no-order-status-write-outside-transition.spec.ts`, cùng khuôn 7 guard
      hiện có (`SRC_DIR = resolve(__dirname, '../src')`, `collectTsFiles` đệ quy, `FORBIDDEN`
      regex, `expect(offenders).toEqual([])`).
- [x] Dùng `stripToCode` (`backend/test/util/strip-to-code.ts`) — thứ bị cấm là **biểu thức
      gọi/định danh**, không phải chuỗi.
- [x] ⚠️ **Bẫy 1:** `stripToCode` xoá luôn string literal ⇒ regex bắt `'dachot'` sẽ KHÔNG BAO GIỜ
      khớp. Phải bắt định danh `status` nằm trong object `data:` của lệnh ghi trên `order`.
- [x] ⚠️ **Bẫy 2:** regex brace `\{[^}]*\}` cắt sớm ở generic/object lồng ⇒ false-green. Dùng
      dạng `\{[\s\S]*?\n\}`.
- [x] ⚠️ **Bẫy 3:** `create()` L327 hợp lệ ghi `status` lúc INSERT ⇒ phải allowlist tường minh
      (theo tên method hoặc theo `order.create` vs `order.update*`), và ghi rõ lý do allowlist.
- [x] **Bắt buộc 2 meta-test** (mọi guard hiện có đều có, thiếu là xanh giả):
  - [x] `it('guard thực sự quét src/ (không xanh giả vì danh sách file rỗng)')` — khẳng định
        danh sách file **khác rỗng**.
  - [x] `it('regex bắt được đúng thứ nó phải bắt (guard không rỗng ruột)')` — nạp mẫu vi phạm
        inline ⇒ regex phải khớp; nạp mẫu trong comment ⇒ phải KHÔNG khớp.
- [x] Mutation-check guard: thêm tạm một lệnh ghi status ở file khác ⇒ guard phải ĐỎ; revert.

### Task 8 — Test (AC: 1-6)

- [x] **Unit thuần domain** — `backend/test/allowed-transition.spec.ts`: bảng + `evaluateTransition`,
      không mock gì. Phủ: mỗi cặp hợp lệ; cặp không có trong bảng ⇒ `not_in_table`; cờ phạm vi
      tắt ⇒ `scope`; thiếu permission ⇒ `permission`; **thứ tự ưu tiên** (thiếu cả quyền lẫn
      không có trong bảng ⇒ trả `not_in_table` trước, không lộ thông tin).
- [x] **Unit service** — mở rộng `backend/test/orders.service.spec.ts` (2767 dòng, đã có):
      khẳng định thứ tự op trong tx `[lock, updateMany, …]`; assert **payload** `where`/`data`
      từng op (key VẮNG MẶT cũng phải assert), **KHÔNG đếm mock call**; fixture dùng con số
      phân biệt được.
- [x] **E2E hermetic** — `backend/test/orders.e2e.spec.ts`: 403 envelope chuẩn khi thiếu
      permission, **status không đổi**; 409 envelope khi transition ngoài bảng. ⚠️ `AppModule`
      phải import **động** trong `beforeAll` (JwtModule đọc env lúc import — static import làm đỏ cả suite).
- [x] **DB lane** — `backend/test/orders.db.integration.spec.ts` +
      `discount-approvals.db.integration.spec.ts` (template có sẵn: đã có test "hai applyDiscount
      ĐUA NHAU ⇒ đúng MỘT approval"): thêm test race cho `confirm` vs `addLine` đồng thời ⇒
      dòng chèn muộn KHÔNG lọt vào đơn đã chốt. Dùng helper `await một nhịp()` (precedent
      `product-prices.db.integration.spec.ts:57`) để ép interleaving.
- [x] **Mutation-verify bắt buộc (P-1)** — mỗi lần: `cp` backup → bẻ code thật → chạy → khẳng
      định ĐỎ → revert bằng `cp`. **TUYỆT ĐỐI KHÔNG `git checkout`** (code story chưa commit).
      Mutant **phải compile** (mutant không compile làm đỏ mọi suite và không chứng minh gì).
      Danh sách tối thiểu:
  - [ ] Gỡ `FOR UPDATE` khỏi engine ⇒ test race DB ĐỎ. **KHÔNG ĐẠT — xem Debug Log.**
        Mutation chạy rồi: lane DB vẫn 57/57 XANH. Khoá trong engine là dư thừa vì
        `updateMany` ngay sau đó tự lấy row write lock ở đúng vị trí ấy. Không test nào
        phân biệt được — báo cáo thay vì bịa test.
  - [x] Gỡ `FOR UPDATE` khỏi `addLine` ⇒ test race DB ĐỎ.
  - [x] Gỡ check permission trong `evaluateTransition` ⇒ unit + e2e 403 ĐỎ.
  - [x] Gỡ check cờ phạm vi ⇒ unit ĐỎ.
  - [x] Đổi `where: { status: before.status }` → literal `'baogia'` trong `confirm` ⇒ test
        nhánh `choduyet → dachot` ĐỎ.
  - [x] Thêm một lệnh ghi status ngoài engine ⇒ source-guard Task 7 ĐỎ.
- [x] **Lane phải chạy:** `cd backend && npm test` (hermetic) · `npm run test:db` (cần Docker
      Desktop bật bằng GUI — từ shell headless KHÔNG lên được; nếu không chạy được thì ghi rõ
      vào Debug Log và **không loay hoay**) · `npm run lint`.
- [x] Baseline phải giữ hoặc vượt: **backend 960/960 (57 suite)**; DB lane 8 suite / 56 test.
- [x] **D-4:** điền số lane vào Dev Agent Record **SAU** QA phase, khớp số `npm test` thật.

### Task 9 — Việc KHÔNG thuộc story này (chống scope creep)

- [x] KHÔNG thêm endpoint chuyển trạng thái thủ công (Story 5.5).
- [x] KHÔNG làm auto-transition theo sự kiện thanh toán/tồn kho (Story 5.2).
- [x] KHÔNG đụng web/mobile — story này **thuần backend**, không màn hình nào.
- [x] KHÔNG thêm permission key mới nếu không cần (xem Dev Notes §Permission — 4 transition
      hiện có đã dùng key sẵn có; thêm key kéo theo chuỗi regen 5 bước + 4 drift-guard).
- [x] KHÔNG regen OpenAPI nếu không có DTO nào đổi.

## Dev Notes

### Bất biến kiến trúc ràng buộc story

- **AD-11** `[ASSUMPTION]`: *"MỘT hàm transition DUY NHẤT thuộc `orders/domain` với chữ ký cố
  định `applyTransition({order, event, actorPermissions, scopeFlags}) → newState | rejection`
  là con đường code DUY NHẤT ghi `Order.status`; `payments/` và `inventory/` gọi hàm này…
  Đây cũng là nơi duy nhất đánh giá guard permission + cờ phạm vi và nơi duy nhất phát bản ghi
  Audit. Auto-transition và manual transition dùng chung một entry point."*
  [Source: `ARCHITECTURE-SPINE.md#AD-11`]
- **AD-7** `[ADOPTED]`: vòng đời gate theo cờ Thiết bị/Thi công/Vận chuyển; mọi transition
  permission-gated và ghi Audit. [Source: `ARCHITECTURE-SPINE.md#AD-7`]
- **AD-18**: producer **KHÔNG** gọi FCM/notification/audit trực tiếp — publish domain event qua
  `EventBus` port, consumer subscribe. [Source: `ARCHITECTURE-SPINE.md#AD-18`]
- **AD-5**: envelope `{ code, message, fieldErrors?, traceId }`; **exception filter trung tâm là
  nơi DUY NHẤT tạo envelope** — không controller nào tự dựng. [Source: `ARCHITECTURE-SPINE.md#AD-5`]
- **AD-4**: backend enforce quyền server-side ở **mọi** request; gating UI chỉ là UX.
- **AD-6**: `Order.currentVersionId` là con trỏ chân lý DUY NHẤT tới bản hiệu lực — không suy
  ra bằng timestamp/số đếm. `revise()` phải giữ nguyên hành vi repoint.
- **AD-17**: không permission string literal nào tồn tại ngoài registry.
- **Idempotency** (convention spine): *"thao tác tiền (ghi thanh toán, chốt) idempotent, an toàn
  khi retry"* — AC #6 là hệ quả trực tiếp.
- **Audit**: *"AuditLog bất biến (ai/gì/đối tượng/khi nào/trước→sau) cho mọi mutation nghiệp vụ;
  append-only; đọc chỉ Super Admin."*

### ⚠️ Hai căng thẳng kiến trúc — quyết định đã tuyên bố (không hỏi lại)

**(1) Domain thuần vs "hàm duy nhất ghi status".**
Spine L34 cấm Domain phụ thuộc Infrastructure ⇒ một hàm trong `orders/domain` **không thể** tự
ghi DB. Nhưng AD-11 gọi nó là "con đường code DUY NHẤT ghi `Order.status`".

**Quyết định:** tách hai nửa, cả hai đều bắt buộc:
- `orders/domain/allowed-transition.ts` — **bảng + `evaluateTransition()` thuần** (quyết định
  hợp lệ/không, không biết Prisma). Đây là "nơi duy nhất đánh giá guard" của AD-11.
- `OrdersService.applyTransition()` — **executor private duy nhất** thực sự ghi. Đây là "con
  đường code duy nhất ghi status" của AD-11, và source-guard Task 7 là cái làm cho câu đó
  thành sự thật kiểm chứng được, không phải lời hứa.

Đây là cách duy nhất thoả cả hai ràng buộc. Ghi lý do vào comment (nói bất biến, không nói story id).

**(2) "Nơi duy nhất phát Audit" (AD-11) vs "producer không gọi audit trực tiếp" (AD-18).**
**Quyết định:** engine **publish event `StatusChanged`**, `AuditSubscriber` ghi `AuditLog`.
Engine là nơi duy nhất *sinh ra* event transition; nó không bao giờ chạm `AuditService`. Đây
đúng là cách Epic 4 đã hoà giải cho cả 4 call-site — giữ nguyên khuôn.

### Bảng transition chuẩn tắc (nguồn để dựng Task 2)

Chưa artifact nào khoá bảng đầy đủ — **story này là nơi bảng được viết ra lần đầu**. Dựng từ
state machine spine + FR-7 + Story 5.8:

```
baogia    --áp chiết khấu-->  choduyet     (discounts.apply)
choduyet  --từ chối-------->  baogia       (discounts.approve)
baogia    --chốt----------->  dachot       (orders.confirm)
choduyet  --chốt----------->  dachot       (orders.confirm; cần approval 'dong_y')
dachot    --mở lại--------->  baogia       (quotes.create_edit)
dachot    --auto đủ cọc---->  dacoc        (5.2)
dacoc     --------------->    thicong      [cờ Thi công]        (construction.transition)
thicong   --------------->    nghiemthu    [cờ Thi công]        (construction.transition)
dacoc     --------------->    danggiao     [cờ Vận chuyển]      (delivery.confirm)
danggiao  --------------->    dagiao       [cờ Thiết bị]        (delivery.confirm)
nghiemthu --------------->    hoanthanh
dagiao    --------------->    hoanthanh
dachot    --------------->    hoanthanh    [chỉ Thiết bị, đủ tiền]
baogia|dachot|dacoc  --huỷ-->  huy          (5.7)
```

⚠️ **Bước "Lên lịch thi công" đã bị BỎ** (Story 5.8 AC-1) — `EXPERIENCE.md` còn vẽ nó là tài
liệu cũ. Bộ khoá chính tắc là **10** (`DESIGN.md` + `order-status.ts`); con số "9 chip" ở
`epics.md#UX-DR-8` là drift cũ, `epics.md#Epic 1` đã sửa thành 10.
[Source: `ARCHITECTURE-SPINE.md#state machine` L374-404; `prd.md#FR-7`; `epics.md#Story 5.8`]

**Phạm vi Task 2:** khai báo đủ bảng ở trên, nhưng **chỉ 4 transition đầu + mở lại** có
call-site thật trong story này. Phần còn lại là khai báo cho 5.2/5.5/5.7/5.8/6.x dùng — khai
báo bảng đầy đủ là YAGNI-an-toàn vì bảng chính là hợp đồng, không phải code chết.

### Bốn call-site phải nuốt — trạng thái hiện tại

Tất cả trong `backend/src/orders/orders.service.ts`:

| # | Method | Dòng ghi | Transition | Cổng atomic đặt ở | Sentinel | Idempotency |
|---|--------|----------|------------|-------------------|----------|-------------|
| A | `confirm()` L544-716 | **654-659** | `baogia`\|`choduyet` → `dachot` | dòng `Order` (`status: before.status`) | `CHOT_GATE_THUA` (L186) | retry ⇒ **200 no-op** |
| B | `revise()` L743-857 | **805-808** | `dachot` → `baogia` | dòng `Order` | `MO_LAI_GATE_THUA` (L193) | retry ⇒ **200 no-op** |
| C | `applyDiscount()` L873-962 | **922-925** | `baogia` → `choduyet` | dòng `Order` (kiêm bất biến 1-approval) | `AP_CK_GATE_THUA` (L201) | **luôn 409** |
| D | `resolveDiscount()` L976-1087 | **1039-1042** | `choduyet` → `baogia` (**chỉ nhánh reject**) | dòng **`DiscountApproval`** ⚠️ | `DUYET_CK_GATE_THUA` (L208) | cùng quyết định 200 / ngược 409 |

**Đặc điểm chung phải giữ:**
- Cả 4 dùng `$transaction(async (tx) => …)` **interactive** (dạng mảng không abort được op sau
  khi `count === 0`).
- Cả 4 publish **SAU commit**, không bao giờ trong tx.
- 4 sentinel là object `Error` cấp module, bắt bằng **so sánh identity** (`if (error !== X) throw error`),
  KHÔNG `instanceof`.
- `orderSnapshot(order)` (L162-179) dựng payload before/after.

**⚠️ D không đối xứng với A/B/C.** Một helper "một cỡ vừa tất" giả định cổng nằm trên
`Order.status` sẽ **âm thầm làm yếu D**: ở D, cổng thắng trước là dòng approval, còn lệnh ghi
`Order` là *hệ quả* kèm assertion bất biến `count !== 1` huỷ cả tx. Giữ nguyên thứ tự đó.

### Permission — nhiều khả năng KHÔNG cần key mới

Registry `backend/src/accounts/domain/permission-registry.ts` (21 key) đã có:
`orders.confirm`, `quotes.create_edit`, `discounts.apply`, `discounts.approve`,
`construction.transition`, `delivery.confirm`, `orders.view_all`, `orders.view_own`.

Mapping controller hiện tại (`orders.controller.ts`): `:id/chot` → `PERM.ordersConfirm` (L230) ·
`:id/mo-lai` → `PERM.quotesCreateEdit` (L277) · `:id/ap-chiet-khau` → `PERM.discountsApply` (L315) ·
`:id/duyet-chiet-khau` → `PERM.discountsApprove` (L358). Bảng transition **dùng lại đúng các key
này** ⇒ không cần đụng registry.

**Nếu buộc phải thêm key** (chỉ khi thật sự cần), chuỗi 5 bước, thiếu bước nào cũng drift:
1. `permission-registry.ts` — thêm vào **cả** `PERM` **và** mảng `PERMISSIONS`.
2. `cd backend && npm run permissions:gen` → `backend/openapi/permissions.json`.
3. `cd design-system && npm run build:permissions` → sinh **cả hai**:
   `web/src/design-system/gating/permission-keys.generated.ts` và
   `mobile/lib/design_system/gating/app_permission_keys.g.dart`.
4. Nếu key được gọi tên trong gating UI: sửa tay `web/.../gating/permissions.ts` (`PERM`) và
   `mobile/.../gating/app_permissions.dart` (`AppPerm`) — hai file phải khớp key-for-key.
5. `backend/test/permissions-drift.spec.ts` **hardcode `toHaveLength(21)`** + 4 entry cuối ⇒ phải sửa.

⚠️ **Không CI job nào chạy cả backend lẫn design-system** ⇒ backend xanh vẫn có thể để lại
file generated FE cũ. Phải chạy tay cả hai lane.

### Test lane & khuôn có sẵn

Jest config nằm **inline trong `backend/package.json`** (không có `jest.config.js`).

| Lane | Lệnh | Nhận diện | Ghi chú |
|------|------|-----------|---------|
| Hermetic | `cd backend && npm test` | `*.spec.ts`, **ignore** `*.db.integration.spec.ts` | mock Prisma, không cần Postgres |
| DB thật | `cd backend && npm run test:db` | `--runInBand`, chỉ `*.db.integration.spec.ts` | cần `DATABASE_URL` + Docker Desktop bật **bằng GUI** |
| Lint | `cd backend && npm run lint` | eslint | |

7 source-guard hiện có làm khuôn cho Task 7: `no-manual-prisma-client`, `no-controller-error-envelope`,
`no-permission-literal-outside-registry`, `no-direct-side-effect-outside-eventbus`,
`no-handler-without-require-permissions`, `audit-log-append-only`, `naming-convention`.

Helper: `backend/test/util/strip-to-code.ts` (bỏ comment **và** chuỗi — dùng khi cấm *định danh*)
· `backend/test/util/strip-comments.ts` (bỏ comment, **giữ** chuỗi — dùng khi cấm *chuỗi*).

### Bài học tích luỹ từ Epic 4 (áp dụng trực tiếp)

- Assert **payload** từng op (`where`/`data`, key VẮNG MẶT cũng assert), **không đếm mock call** —
  test đếm call vẫn xanh khi hai field hoán đổi.
- Mutant **phải compile**; revert bằng `cp` backup, **KHÔNG `git checkout`** (code story chưa commit).
- Guard quét TOÀN VĂN như text ⇒ **đừng viết chuỗi bị cấm trong comment** (false-positive tái diễn).
- Regex brace `[^}]*` false-green với generic lồng ⇒ dùng `[\s\S]*?\n\}`.
- **MỘT timestamp cho một sự kiện** — đừng gọi `new Date()` hai lần.
- Prisma 7: `createMany` với mảng rỗng ⇒ giữ guard `length > 0`; nullable Json dùng
  `Prisma.JsonNull`, không phải `null` trần.
- Flake backend đã biết (`customer-sources.e2e`, `customers`, `me.e2e`, `error-envelope`, D-5 còn mở) —
  đỏ ở đó mà không liên quan thì **rerun trước khi sửa**.
- Docker Desktop **không lên được từ shell headless** — DB lane không chạy được thì ghi Debug Log,
  không loay hoay.
- `resolve_customization.py` fail trên máy này (Python < 3.11) — merge workflow block bằng tay.
- Điền Dev Agent Record **SAU** QA phase (D-4).

### Project Structure Notes

- File mới: `backend/src/orders/domain/allowed-transition.ts` (kebab-case — spine nêu đúng tên
  file này làm ví dụ quy ước), `backend/test/allowed-transition.spec.ts`,
  `backend/test/no-order-status-write-outside-transition.spec.ts`.
- File sửa: `backend/src/orders/domain/order-status.ts`, `order-events.ts`,
  `backend/src/orders/orders.service.ts`, `backend/src/orders/dto/order-response.dto.ts` (comment),
  `backend/test/orders.service.spec.ts`, `orders.e2e.spec.ts`, `orders.db.integration.spec.ts`,
  `discount-approvals.db.integration.spec.ts`.
- **Không lệch chuẩn nào.** `DiscountApproval` sống trong module `orders` (không phải `discounts/`)
  là lệch **có chủ đích đã chốt ở 4.7**, chính vì AD-11: tách ra sẽ đặt người-ghi-status thứ ba
  ngoài `orders`. Story này củng cố quyết định đó, không đảo.
- `OrdersService` có **đúng hai** dependency (`PrismaService`, `EventBus`) — bất biến tường minh.
  `applyTransition` nhận `actorPermissions`/`scopeFlags` **qua tham số** (đúng chữ ký AD-11);
  **KHÔNG** inject `AccountPermissionsService` vào service.
- KHÔNG có migration nào trong story này (`Order.status` là `String`, không phải enum DB).

### Nợ kỹ thuật story này đóng

- **TD-22** — 4 điểm ghi `Order.status` rải rác → đóng bằng Task 4 + Task 7.
- **TD-23** — TOCTOU 3 cửa sổ đọc-dòng→commit → đóng bằng Task 6.
- **D-1 / P-1** (retro Epic 4) → đóng khi AC #4 và #5 đều verify được.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.1` L483-488] — user story + 3 AC verbatim
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 5` L480-545] — 9 story, cross-story context
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-7`, `#FR-9`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-11`] L108-112
- [Source: `ARCHITECTURE-SPINE.md#AD-4`, `#AD-5`, `#AD-6`, `#AD-7`, `#AD-17`, `#AD-18`, `#AD-20`]
- [Source: `ARCHITECTURE-SPINE.md#Consistency Conventions`] L176-190; `#state machine` L374-404
- [Source: `_bmad-output/project-context.md`] L44 (chỉ `applyTransition` đổi status), L50 (`StatusChanged`), L69-71 (scout-before-code), L75-80 (testing)
- [Source: `_bmad-output/implementation-artifacts/epic-4-retro-2026-07-17.md#3.1`, `#3.2`, `#5` TD-22/TD-23, `#6` P-1, `#7`, `#8` D-1/D-4/D-5]
- [Source: `_bmad-output/implementation-artifacts/4-9-bao-hanh-theo-dong-vat-tu.md`] — bài học 4.1-4.8, baseline lane
- [Source: `backend/src/orders/orders.service.ts`] L71-74, 162-179, 186-208, 275-282, 327, 653-660, 804-809, 921-937, 1025-1049, 1199, 1318, 1380
- [Source: `backend/src/orders/domain/order-status.ts`, `order-events.ts`]
- [Source: `backend/src/catalog/product-prices.service.ts:100`] — precedent `FOR UPDATE`
- [Source: `backend/test/product-prices.db.integration.spec.ts:123`] — precedent test khoá dòng

### Stack (đã xác minh từ `backend/package.json`)

NestJS 11.1.27 · Prisma (client + CLI) **7.8.0** pin cứng, adapter `@prisma/adapter-pg` 7.8.0 ·
TypeScript 5.7 · Jest 30 + ts-jest 29.4 · Node types 24. Không thêm dependency mới trong story này.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Debug Log References

**Lane đã chạy (số thật, sau QA phase — D-4):**

| Lane | Lệnh | Trước story | Sau story |
|------|------|-------------|-----------|
| Hermetic | `cd backend && npm test` | 57 suite / 960 test | **59 suite / 1010 test** ✅ |
| DB thật | `cd backend && npm run test:db` | 8 suite / 56 test | **8 suite / 58 test** ✅ |

> Số hermetic 1008 → **1010** sau review: +2 test (ngõ cụt bảng transition, allowlist guard
> theo cặp). DB lane chạy lại sau sửa `addLine`: vẫn 8 suite / 58 test xanh.
| Lint | `npx eslint src/orders test/orders*.spec.ts …` | — | **0 lỗi trên file của story** ✅ |

⚠️ `npm run lint` toàn repo ĐỎ SẴN TỪ TRƯỚC story này: 90 lỗi `prettier/prettier` trên các file
không thuộc phạm vi story (`quote-export.service.ts`, `storage/`, `vat-mode.spec.ts`, …). Đã
KHÔNG sửa (ngoài phạm vi). Đề nghị chạy `npm run format` trong một commit dọn dẹp riêng.

⚠️ Flake đã biết tái diễn: `/customers` taxCode-400 và `/orders` 403-line-items đỏ ở một lần
chạy, rerun XANH ngay — đúng danh sách flake trong Dev Notes, không liên quan story.

**Mutation-verify (P-1) — `cp` backup, KHÔNG `git checkout`:**

| # | Mutant | Kỳ vọng | Thực tế |
|---|--------|---------|---------|
| M1 | Gỡ `FOR UPDATE` khỏi **engine** | ĐỎ | 🔴 **XANH — không đạt, xem dưới** |
| M2 | Gỡ `FOR UPDATE` khỏi **`addLine`** | ĐỎ | ✅ ĐỎ (1 fail) |
| M3 | Gỡ check permission trong `evaluateTransition` | ĐỎ | ✅ ĐỎ (2 fail: unit domain + unit service 403) |
| M4 | Gỡ check cờ phạm vi | ĐỎ | ✅ ĐỎ (2 fail) |
| M5 | `where.status` → literal `'baogia'` | ĐỎ | ✅ ĐỎ (5 fail) |
| M6 | Thêm điểm ghi status ngoài engine | ĐỎ | ✅ ĐỎ (guard bắt `huyDonLau()`) |

Mọi mutant đều compile được. Sau mỗi lần: revert bằng `cp` rồi chạy lại để xác nhận XANH.

**QA phase bổ sung 3 mutant** (chi tiết ở `tests/test-summary-story-5-1.md`):

| # | Mutant | Kỳ vọng | Thực tế |
|---|--------|---------|---------|
| M-A | Gỡ `FOR UPDATE` khỏi **`updateLine`** | ĐỎ | ✅ ĐỎ (1 fail, lane DB) |
| M-B | Gộp `scope` vào chung thông điệp `not_in_table` | ĐỎ | ✅ ĐỎ (1 fail) |
| M-C | `permission` 403 → 409 | ĐỎ | ✅ ĐỎ (4 fail / 2 suite) |

**🔴 M1 KHÔNG ĐẠT — và đây là phát hiện, không phải test yếu.**
Gỡ `await this.lockOrderRow(tx, order.id)` khỏi `applyTransition()` để lane DB **vẫn 57/57
xanh**. Lý do đã truy đến gốc: op ngay sau khoá là `tx.order.updateMany` trên CHÍNH dòng đó,
mà `UPDATE` tự lấy row write lock. Hai câu lệnh nằm sát nhau nên trật tự khoá y hệt nhau dù
có `FOR UPDATE` tường minh hay không — **không test nào phân biệt được**. Khoá trong engine là
belt-and-braces, KHÔNG phải thứ đang gánh tải. Đã giữ lại (đồng bộ khuôn khoá cho các caller
tương lai của engine ở 5.2/5.5, những chỗ có thể đọc-rồi-ghi bên trong engine), nhưng ghi rõ
ở đây thay vì bịa ra một test giả để tick ô.

**🔴 Test race BAN ĐẦU là FALSE-GREEN — đã sửa, và nó lộ ra một lỗi thật.**
Bản đầu dùng `setTimeout(5ms)` ép `addLine` chạy sau: cả M1 LẪN M2 đều xanh ⇒ test không chạm
được cửa sổ nguy hiểm. Viết lại thành **12 vòng đua tự do, không delay** thì test **ĐỎ NGAY
TRÊN CODE ĐANG VIẾT** — lộ ra lỗi TOCTOU thật (TD-23): `confirm()` đọc danh sách dòng **NGOÀI**
tx, nên một `addLine` commit trong khoảng giữa để lại một dòng `unitPriceSnapshot = null` trong
một đơn đã `dachot` — tức giá của đơn đã chốt vẫn tự đổi theo danh mục. Đã sửa: `confirm()` đọc
dòng + resolve giá danh mục **BÊN TRONG** tx, sau khoá. Kiểm 0-dòng ⇒ 400 giữ nguyên vị trí
fast-path ngoài tx (hợp đồng cũ không đổi: 400 mà không mở transaction).

### Completion Notes List

- **AC-1 ✅** `applyTransition()` là con đường DUY NHẤT đổi `Order.status`; enum sự kiện tường
  minh (`SU_KIEN`) + bảng `ALLOWED_TRANSITIONS` phủ trọn vòng đời 10 khoá; gate theo cờ phạm vi
  + permission. Nuốt đủ 4 call-site.
- **AC-2 ✅** Engine là nơi duy nhất đánh giá guard (`evaluateTransition`) và là nơi duy nhất
  SINH event `StatusChanged`; nó KHÔNG chạm `AuditService` — publish qua `EventBus`,
  `AuditSubscriber` ghi log (AD-18). Có e2e đi qua `AuditSubscriber` THẬT.
- **AC-3 ✅** Thiếu permission ⇒ 403 envelope chuẩn do `AllExceptionsFilter` dựng, **trước khi
  đụng DB** (unit khẳng định không một khoá nào bị lấy, không dòng nào bị ghi).
- **AC-4 ✅** Source-guard mới quét `src/`, allowlist tường minh đúng 2 chỗ (`applyTransition`,
  `create`). Dùng máy quét cân bằng ngoặc thay regex `\{[^}]*\}` (regex ấy cắt sớm ở object
  lồng ⇒ xanh giả). Có 2 meta-test bắt buộc + 3 test âm tính.
- **AC-5 ⚠️** Khoá dòng có thật ở CẢ hai phía và **phía mutator đã chứng minh là load-bearing**
  (M2 ĐỎ). Phía engine KHÔNG chứng minh được (M1) — lý do kỹ thuật ở Debug Log. Đổi lại, quá
  trình mutation lộ ra và đã đóng một lỗi TOCTOU thật mà AC này nhắm tới.
- **AC-6 ✅** Bốn hợp đồng idempotency giữ nguyên: toàn bộ test 4.5–4.7 cũ vẫn xanh không sửa
  assertion nào về idempotency. `confirm` 200 no-op · `revise` 200 no-op · `applyDiscount` luôn
  409 · `resolveDiscount` cùng-quyết-định 200 / ngược 409.

**Quyết định kỹ thuật đáng chú ý:**

1. **Hai nửa của AD-11.** `orders/domain/allowed-transition.ts` giữ bảng + hàm THUẦN (không
   Nest/Prisma, unit-test không cần mock); `OrdersService.applyTransition()` là executor duy
   nhất thực sự ghi. Đây là cách duy nhất thoả cả "Domain không phụ thuộc Infrastructure" lẫn
   "một hàm duy nhất ghi status".
2. **`actorPermissions` truyền qua tham số**, controller resolve tươi mỗi request
   (`AccountPermissionsService`). `OrdersService` giữ ĐÚNG 2 dependency như bất biến đã tuyên.
3. **Hai tầng permission là CÓ CHỦ Ý, và một tầng hiện đang che tầng kia.** Ở cả 4 endpoint,
   key của `@RequirePermissions` TRÙNG key trong bảng transition ⇒ guard HTTP luôn bắn 403
   trước, engine không bao giờ có cơ hội. Hệ quả **phải biết**: mutation M3 (gỡ check permission
   trong engine) làm ĐỎ unit test nhưng **KHÔNG** làm đỏ e2e — không phải vì test yếu mà vì
   tầng phòng thủ thứ hai đang gánh. Tầng engine chỉ thực sự cần khi 5.2/5.5 dispatch nhiều
   transition qua một endpoint.
4. **`StatusChanged` publish THÊM, không thay thế** 4 event nghiệp vụ (giữ payload `amount`/
   `note`/`approved`/`reason` cho Epic 9). Hệ quả tường minh: một lần chốt ⇒ 2 dòng audit.
5. **MỘT timestamp cho MỘT sự kiện** — mỗi hành động dùng lại đúng một `new Date()` cho cả
   `chotAt`/`resolvedAt` lẫn `occurredAt` của cả hai event; có test khẳng định hai event cùng
   `occurredAt`.
6. **Nhánh TỪ CHỐI của `resolveDiscount` giữ nguyên bất đối xứng.** Cổng thắng-thua vẫn ở row
   `DiscountApproval`; engine chạy SAU, và sentinel truyền vào chính là lỗi "bất biến gãy" ⇒
   không bắt ⇒ huỷ toàn tx. Nhánh ĐỒNG Ý không gọi engine (có test khẳng định không khoá,
   không ghi status).
7. **Không thêm permission key nào** — 4 transition dùng lại key sẵn có; registry vẫn 21 key,
   không chạy chuỗi regen 5 bước. Không migration. Không đụng web/mobile.
8. **Mock `tx` trong test giờ dùng CHÍNH bộ repo mock** (cùng object, khác tên) — đúng sự thật
   của Prisma và giữ cho assertion cũ còn đúng khi lệnh ghi chuyển vào trong tx. Bẫy đã cắn một
   lần: khai `mockResolvedValue` hai lần cho cùng một mock trong `beforeEach` sẽ ghi đè nhau.

**Việc CHƯA làm (cố ý, ngoài phạm vi):** endpoint chuyển trạng thái thủ công (5.5),
auto-transition (5.2), huỷ đơn (5.7), UI. Bảng đã khai sẵn các transition đó nhưng chưa có
call-site — quyền của chúng dùng key gần nghĩa nhất trong registry và 5.2/5.5/5.7 nên xác nhận
lại khi có call-site thật.

### File List

**Mới:**

- `backend/src/orders/domain/allowed-transition.ts`
- `backend/test/allowed-transition.spec.ts`
- `backend/test/no-order-status-write-outside-transition.spec.ts`

**Sửa:**

- `backend/src/orders/domain/order-status.ts`
- `backend/src/orders/domain/order-events.ts`
- `backend/src/orders/orders.service.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/src/orders/dto/order-response.dto.ts`
- `backend/openapi/openapi.json` (regen — mô tả `status` trong DTO đổi)
- `backend/test/orders.service.spec.ts`
- `backend/test/orders.e2e.spec.ts`
- `backend/test/orders.db.integration.spec.ts`
- `backend/test/discount-approvals.db.integration.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Ngày | Thay đổi |
|------|----------|
| 2026-07-18 | Engine `applyTransition()` + bảng transition thuần domain + event `StatusChanged` + source-guard "không ai ghi status ngoài engine". Nuốt 4 call-site (`confirm`, `revise`, `applyDiscount`, `resolveDiscount`-reject) giữ nguyên hợp đồng idempotency. |
| 2026-07-18 | Đóng TOCTOU (TD-23): khoá `FOR UPDATE` + đọc lại status TRONG tx cho 4 mutator nội dung; `confirm()` đọc dòng + resolve giá danh mục BÊN TRONG tx — sửa lỗi thật do test race sắc hơn phát hiện. |
| 2026-07-18 | Đóng TD-22: source-guard khiến "applyTransition là điểm ghi status duy nhất" thành bất biến kiểm chứng được. |
| 2026-07-18 | Review: bỏ gate cờ Thiết bị ở `danggiao → dagiao` (nhốt vĩnh viễn đơn chỉ có Vận chuyển; spine không gate bước này) + test bất biến "không ngõ cụt" quét cả 7 bộ cờ. |
| 2026-07-18 | Review: source-guard khoá allowlist theo cặp (method, lệnh ghi) — tên `create` trần tha nhầm 10 method cùng tên trong `src/`. |
| 2026-07-18 | Review: `addLine` đọc lại `currentVersionId` TRONG tx — khoá mà vẫn dùng con trỏ version ngoài tx thì `chot`+`mo_lai` chen giữa làm dòng mới rơi vào bản đã chết. |

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-18 · **Kết luận: APPROVE** (0 CRITICAL)

File List khớp `git status` **từng file, không thừa không thiếu** — không có claim rỗng.
Lane hermetic tự chạy lại xác nhận đúng con số story khai (59 suite/1008 trước review).

### 🔴 HIGH-1 — Ngõ cụt trong bảng transition: đơn kẹt vĩnh viễn ở `danggiao` — ĐÃ SỬA

`allowed-transition.ts` gate bước RA `danggiao → dagiao` bằng cờ **Thiết bị**, trong khi bước
VÀO `dacoc → danggiao` chỉ đòi cờ **Vận chuyển**. Đơn có Vận chuyển mà KHÔNG có Thiết bị vào
được `danggiao` rồi **không còn đường nào đi tiếp** — không `hoanthanh`, và bảng cũng không
cho `huy` từ `danggiao`. Đơn kẹt vĩnh viễn, không một call-site nào cứu được.

Nguồn được story trích dẫn (`ARCHITECTURE-SPINE.md#state machine` L374-404) vẽ
`DangGiao --> DaGiao` **KHÔNG nhãn cờ** — nhãn `[cờ Thiết bị]` là drift phát sinh ở bảng
Dev Notes rồi chép vào code. Sửa = bỏ `scopeGuard` cho `xongGiao`, khớp lại spine.

*(`xongThiCong` cũng thừa `scopeGuard: 'thiCong'` so với spine, nhưng KHÔNG phải ngõ cụt —
vào được `thicong` thì cờ Thi công tất yếu đã bật. Để nguyên, không đụng.)*

**Test chặn tái phát:** `allowed-transition.spec.ts` — "không trạng thái nào là ngõ cụt":
loang từ `baogia` cho **cả 7 bộ cờ khả dĩ**, khẳng định mọi trạng thái tới được đều còn đường
ra tới `hoanthanh`/`huy` với ĐÚNG bộ cờ đó. Đây là thuộc tính của CẢ bảng — không một test
call-site đơn lẻ nào nhìn thấy nó.
**Mutation-verify:** trả `scopeGuard: 'thietBi'` về ⇒ test ĐỎ đúng 1 fail; `cp` revert ⇒ xanh.

### 🟡 MEDIUM-2 — Source-guard AC-4 rộng hơn điều AC-4 tuyên bố — ĐÃ SỬA

Allowlist là `new Set(['applyTransition', 'create'])`, khớp theo **tên method trần**. `create`
là tên method phổ biến nhất codebase — `grep` ra **10 method tên `create`** trong `src/`
(customers, catalog, orders… cả service lẫn controller). Bất kỳ cái nào trong 10 chỗ đó viết
`order.updateMany({ data: { status } })` thì guard **vẫn xanh**, tức bất biến "chỉ
`applyTransition` đổi status" vẫn thủng đúng cái kiểu copy-paste mà guard sinh ra để chặn.

Sửa: khoá allowlist theo **cặp (method, lệnh ghi)** — `applyTransition` được mọi lệnh ghi;
`create` **chỉ** được đúng `order.create` (INSERT, không có `from` để gate).
**Test chặn tái phát:** case âm tính mới — `create()` gọi `order.updateMany` đổi status ⇒
`duocPhep()` phải trả `false`, trong khi `create`+`order.create` vẫn `true`.

### 🟡 MEDIUM-3 — `addLine` khoá đúng nhưng vẫn ghi theo con trỏ version CŨ — ĐÃ SỬA

Task 6 sửa đúng nửa status: `addLine` lấy khoá rồi đọc LẠI status trong tx. Nhưng
`versionId` vẫn là giá trị đọc **ngoài** tx. Một cặp `chot` + `mo_lai` chen vào cửa sổ đó đưa
status **VỀ LẠI** `baogia` (nên `assertMutable` trong tx vẫn qua) **và** đã repoint
`currentVersionId` sang bản mới ⇒ dòng được chèn vào **bản đã chết**: biến mất khỏi báo giá,
không một lỗi nào nổi lên. Đọc lại status mà không đọc lại con trỏ là đóng nửa cửa.

Sửa: `currentVersionIdOrThrow` đọc từ chính object đã lấy trong tx, dùng cho cả truy vấn
`displayOrder` lẫn `orderVersionId` của dòng mới. Lane DB chạy lại: 8 suite / 58 test xanh.

### 🟢 LOW — ghi nhận, KHÔNG sửa (nêu để 5.x biết)

- **L-1 `updateLine`/`removeLine` cùng lớp lỗi với MEDIUM-3** nhưng hệ quả nhẹ hơn nhiều:
  chúng thao tác trên `lineId` đã validate thuộc bản hiệu lực, nên kết quả xấu nhất là sửa/xoá
  một dòng của bản đã bị thay thế (dữ liệu mồ côi), không phải mất dữ liệu người dùng vừa nhập.
  Sửa triệt để = validate lại `lineId` theo con trỏ trong tx — đề nghị gộp vào 5.2.
- **L-2 Source-guard mù với raw SQL.** `stripToCode` xoá sạch chuỗi/template ⇒ một
  `$executeRaw` dạng `UPDATE orders SET status = …` sẽ đi lọt. Guard `no-manual-prisma-client`
  che một phần. Chấp nhận: chưa có tiền lệ raw-write trong repo.

### ✅ Xác nhận các claim khác của story (đã kiểm, không phải tin lời)

- **AC-6 idempotency** giữ nguyên byte-for-byte: `confirm`/`revise` fast-path + sentinel
  re-read còn nguyên; `applyDiscount` vẫn **luôn 409**; `resolveDiscount` giữ **bất đối xứng**
  đúng như Dev Notes cảnh báo — cổng thắng-thua ở dòng `DiscountApproval`, engine chạy SAU,
  sentinel là lỗi bất biến gãy (KHÔNG bắt ⇒ huỷ toàn tx), nhánh ĐỒNG Ý không gọi engine.
- **M1 (khoá engine không chứng minh được)** là báo cáo TRUNG THỰC, không phải test yếu:
  `updateMany` ngay sau đó tự lấy row write lock ở đúng vị trí ấy. Giữ khoá + ghi rõ thay vì
  bịa test là xử lý đúng. KHÔNG hạ status vì việc này.
- **AD-18** engine không hề chạm `AuditService`; `audit.service.ts` ghi theo `event.type`
  generic nên `StatusChanged` vào audit không cần sửa subscriber.
- **MỘT timestamp cho MỘT sự kiện** đúng ở cả 4 call-site (`chotAt`/`moLaiAt`/`apAt`/`quyetAt`
  dùng lại cho cả `occurredAt` của hai event).

**Lane sau review:** hermetic **59 suite / 1010 test** ✅ · DB **8 suite / 58 test** ✅ ·
lint **0 lỗi trên file story** (90 lỗi `prettier/prettier` toàn repo là nợ CÓ TRƯỚC story, đã
xác nhận nằm ngoài phạm vi — vẫn đề nghị một commit `npm run format` riêng).

⚠️ `orders.e2e.spec.ts` đỏ 1 lần ở lần chạy đầu, chạy riêng + chạy lại full đều XANH — đúng
flake đã liệt kê trong Dev Notes, không liên quan thay đổi nào của review.

## Câu hỏi mở (không chặn dev — trả lời khi review)

1. **AD-11 vẫn là `[ASSUMPTION]`, chưa `[ADOPTED]`.** Story này hiện thực hoá nó thành code +
   source-guard. Đề nghị nâng lên `[ADOPTED]` trong `ARCHITECTURE-SPINE.md` khi story done.
2. **Hai dòng audit mỗi transition** (`StatusChanged` + event nghiệp vụ) — đã chọn có chủ đích
   để không regression Epic 9. Nếu Đại Ca muốn một dòng duy nhất, phải quyết TRƯỚC Epic 9.
3. **D-6 (TD-1) đến hạn lần 4** — Epic 5 thêm ≥3 màn web. Story 5.1 thuần backend nên không bị
   chặn, nhưng 5.3/5.4/5.5 thì có. Mặc định tuyên bố trước: giữ text-guard-only cho web, widget
   test bắt buộc cho mobile; im lặng ⇒ mặc định thành quyết định.
4. **D-2 (CI Actions xanh thật)** vẫn mở. Story này thêm test lane DB mới ⇒ càng cần CI thật để
   khỏi phụ thuộc Docker cục bộ.
5. **[QA phát hiện] Cửa sổ "đơn `dachot` với 0 dòng" vẫn mở.** Cổng 0-dòng của `confirm` nằm ở
   fast-path NGOÀI transaction, nên một `removeLine` commit giữa fast-path và lúc engine lấy
   khoá vẫn để lại đơn đã chốt không còn dòng nào — khoá không đóng được vì cổng đặt sai phía.
   Sửa = chuyển kiểm 0-dòng vào TRONG tx sau khoá, nhưng hợp đồng cũ là "400 mà KHÔNG mở
   transaction" ⇒ đổi hành vi, cần Đại Ca quyết. QA phase KHÔNG tự sửa.
