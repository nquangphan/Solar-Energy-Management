---
baseline_commit: 60d57eec77af64e10aab92e0f9fbaa5c47c10033
---

# Story 2.7: Domain Event port (EventBus) + NotificationDispatcher no-op + audit subscriber

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên nền tảng**,
I want **một `EventBus` port DUY NHẤT với dispatcher no-op/log và subscriber ghi Audit**,
so that **các epic sau publish domain event mà KHÔNG cần biết bộ gửi, và audit là cross-cutting qua event — lắp bộ FCM thật (Epic 9) không phải mở lại code chức năng nào**.

## Acceptance Criteria

1. **Given** yêu cầu tách side-effect khỏi producer, **When** khai báo nền tảng, **Then** có **MỘT `EventBus` port DUY NHẤT** (định nghĩa ở nền backend); bản đầu `NotificationDispatcher` là **no-op/log**; producer chỉ `eventBus.publish(event)` — **KHÔNG** gọi FCM/notification/audit trực tiếp (AD-18).
2. **Given** một domain event được publish qua port, **When** audit subscriber chạy, **Then** ghi một `AuditLog` **bất biến, append-only** mang đủ **ai (actor) / gì (loại event) / đối tượng (target) / khi nào (thời điểm) / trước→sau (before/after)**; bản ghi chỉ **Super Admin** được đọc (AD-8, FR-20 phần *ghi*). Không có đường code nào **sửa/xoá** `AuditLog` sau khi ghi (append-only).
3. **Given** Epic 9 lắp bộ gửi sau, **When** thay `NotificationDispatcher` no-op bằng bộ FCM thật, **Then** **KHÔNG** phải mở lại code chức năng nào của E4–E7: producer vẫn `eventBus.publish` như cũ; chỉ implementation của subscriber đổi (AD-18).

**Bằng chứng "done" (backend, kiểm được HERMETIC — không cần Postgres cho phần bắt buộc):**
- **Port tồn tại + fan-out:** `EventBus` là abstract/port (DI token); implementation mặc định `InProcessEventBus` fan-out một event tới **mọi** subscriber đã đăng ký. Publish một event giả → **cả** `NotificationDispatcher` **và** `AuditSubscriber` được gọi đúng một lần với đúng event (unit, mock subscriber).
- **Cô lập lỗi subscriber:** một subscriber ném lỗi trong `handle` → các subscriber còn lại **vẫn** được gọi; lỗi được **log** (KHÔNG nuốt im lặng), `publish` không sập vì một consumer hỏng (unit).
- **NotificationDispatcher no-op:** `handle(event)` chỉ **log** (Logger), KHÔNG gọi mạng/FCM/HTTP (không có `firebase-admin` trong deps — Epic 9). Unit assert: gọi Logger, KHÔNG side-effect ngoài (mock Logger).
- **AuditSubscriber ghi AuditLog đúng 5 chiều:** `handle(event)` → `AuditService.record` → `prisma.auditLog.create` với mapping đúng: `eventType`=gì, `actorAccountId`=ai (nullable cho system event), `targetType`/`targetId`=đối tượng, `occurredAt`=khi nào, `before`/`after`=trước→sau (unit, mock Prisma — assert `create` gọi đúng data shape).
- **Append-only:** `AuditService` **KHÔNG** expose `update`/`delete`; model `AuditLog` chỉ được `create` (không có code path ghi đè). Source-guard/review khẳng định không có `auditLog.update|delete|upsert` trong `src/`.
- **Decoupling producer (AD-18) chứng minh end-to-end:** một *test producer* chỉ inject `EventBus` và gọi `publish` → audit persisted + notification dispatched, mà producer **không** biết gì về Prisma/FCM/audit. Nếu đổi `NotificationDispatcher` sang bản khác, test producer KHÔNG đổi (AC-3).
- **Source-guard AD-18:** test quét `src/` (bỏ comment): (a) **KHÔNG** import `firebase-admin` ngoài `notifications/`; (b) **KHÔNG** module nào inject/`import` trực tiếp `NotificationDispatcher`/`AuditSubscriber`/`AuditService` ngoài module sở hữu — producer phải đi qua `EventBus` (mirror `no-manual-prisma-client.spec.ts`).
- **Migration `audit_logs`:** `schema.prisma` thêm model `AuditLog` (+ `@@map("audit_logs")`, cột snake_case); migration mới sinh qua `prisma migrate dev` (KHÔNG sửa tay SQL, KHÔNG tạo lại bảng `accounts`/`sessions`/`account_permissions`).
- **KHÔNG endpoint mới:** 2.7 **không** thêm controller/route/DTO HTTP → `openapi/openapi.json` **không đổi**; `openapi-drift.spec.ts` xanh **không cần** regen. Registry quyền **không đổi** → `permissions.json` không đụng. Endpoint đọc Audit (`audit.read`-gated) là **Story 8.5** — KHÔNG làm ở đây.
- Lint/format/`nest build` sạch; toàn bộ suite hiện có (auth/me/error-envelope/…) **vẫn xanh** (không regression); test mới hermetic (không Postgres).

## Tasks / Subtasks

- [x] **Task 1 — Domain event contract + `EventBus` port (DOMAIN thuần, AC: 1)**
  - [x] `src/events/domain-event.ts`: khai base `DomainEvent` — interface bất biến (`readonly`) mang **5 chiều audit**:
    ```ts
    export interface DomainEvent {
      readonly type: string;                 // "gì" — tên loại event (vd 'OrderConfirmed'); concrete event do story sở hữu đặt
      readonly occurredAt: Date;             // "khi nào" — thời điểm nghiệp vụ xảy ra
      readonly actorAccountId?: string;      // "ai" — account gây ra (undefined = system/auto-transition)
      readonly target?: { readonly type: string; readonly id: string }; // "đối tượng" (vd { type:'Order', id })
      readonly before?: unknown;             // "trước" — trạng thái trước (optional)
      readonly after?: unknown;              // "sau"  — trạng thái sau  (optional)
    }
    ```
    Đây là **DOMAIN thuần** — KHÔNG import Nest/Prisma/Infra. Concrete event (OrderConfirmed, DiscountResolved, PaymentRecorded, StatusChanged, StockOutBlocked… — AD-18) do **story sở hữu** (E4–E7) khai riêng, `extends`/conform `DomainEvent`. 2.7 CHỈ khai **base contract** (YAGNI: không khai trước event chưa có producer).
  - [x] `src/events/event-bus.ts`: khai **port** + hợp đồng subscriber:
    - `export interface EventSubscriber { handle(event: DomainEvent): void | Promise<void>; }`
    - `export abstract class EventBus { abstract publish(event: DomainEvent): Promise<void>; abstract subscribe(subscriber: EventSubscriber): void; }` — abstract class **kiêm DI token** (Nest inject bằng class token; producer inject `EventBus`, KHÔNG biết implementation). **MỘT** port duy nhất (AD-18).
  - [x] `EventBus` là **con đường DUY NHẤT** phát domain event; producer (E4+) inject `EventBus` và gọi `publish`. Ghi 1 dòng TSDoc: "AD-18 — producer KHÔNG gọi FCM/notification/audit trực tiếp; publish qua port này, consumer subscribe".

- [x] **Task 2 — `InProcessEventBus`: implementation mặc định fan-out + cô lập lỗi (AC: 1, 3)**
  - [x] `src/events/in-process-event-bus.ts` (`@Injectable()` `implements EventBus`... hay `extends EventBus`): giữ mảng `subscribers: EventSubscriber[]`; `subscribe(s)` push; `publish(event)` **await lần lượt** từng subscriber trong `try/catch` **cô lập** — một subscriber ném lỗi → **log** (`Logger.error` kèm `event.type`) và **tiếp tục** các subscriber còn lại (một consumer hỏng KHÔNG chặn consumer khác, KHÔNG sập producer). Đồng bộ in-process (bản đầu no-op/log — AD-18; KHÔNG cần queue/broker cho ~20 user, YAGNI).
  - [x] `src/events/events.module.ts` (`@Global()` `@Module`): provide `{ provide: EventBus, useClass: InProcessEventBus }`, **export** `EventBus`. Global để **mọi** module domain (E3+) inject `EventBus` publish mà không cần import lại (mirror `PrismaModule` `@Global`). EventsModule **không** biết consumer nào — consumer tự đăng ký (Task 3, 4).
  - [x] Đăng ký `EventsModule` vào `AppModule.imports` (nền tảng — như `PrismaModule`/`CommonModule`).

- [x] **Task 3 — `audit/`: AuditLog entity + AuditService (append-only) + AuditSubscriber (AC: 2)**
  - [x] `schema.prisma` **thêm model** `AuditLog` (KHÔNG tạo lại bảng cũ):
    ```prisma
    /// Nhật ký kiểm toán BẤT BIẾN, append-only (AD-8, spine "AuditLog append-only").
    /// Ghi bởi AuditSubscriber khi có domain event; đọc CHỈ Super Admin (endpoint read = Story 8.5).
    /// `actorAccountId` lưu dạng String (KHÔNG FK cascade) để bản ghi lịch sử SỐNG SÓT khi
    /// account bị vô hiệu/xoá — audit là snapshot bất biến, không đổi theo vòng đời account.
    model AuditLog {
      id             String   @id @default(uuid())
      eventType      String   @map("event_type")          // "gì"
      actorAccountId String?  @map("actor_account_id")     // "ai" (null = system/auto)
      targetType     String?  @map("target_type")          // "đối tượng" — loại
      targetId       String?  @map("target_id")            // "đối tượng" — id
      before         Json?                                  // "trước"
      after          Json?                                  // "sau"
      occurredAt     DateTime @map("occurred_at")           // "khi nào" (thời điểm nghiệp vụ)
      createdAt      DateTime @default(now()) @map("created_at") // khi ghi (server)
      @@index([actorAccountId])
      @@index([targetType, targetId])
      @@map("audit_logs")
    }
    ```
    Chạy `npm run prisma:migrate:dev` (đặt tên migration mô tả hành vi, vd `add_audit_logs` — KHÔNG nhét số story/mã plan vào tên) rồi `npm run prisma:generate`. **KHÔNG** sửa tay SQL migration.
  - [x] `src/audit/audit.service.ts` (`@Injectable()`): `async record(event: DomainEvent): Promise<void>` → map 5 chiều event sang `prisma.auditLog.create({ data: {...} })`. **CHỈ** truy cập DB qua `PrismaService` (AD-1). **KHÔNG** khai `update`/`delete`/`upsert` — append-only là bất biến (AC-2). `before`/`after` unknown → serialize an toàn vào cột `Json` (Prisma nhận `Prisma.InputJsonValue`; `undefined` → bỏ field, `null` → JSON null).
  - [x] `src/audit/audit.subscriber.ts` (`@Injectable() implements EventSubscriber, OnModuleInit`): `constructor(eventBus: EventBus, auditService: AuditService)`; `onModuleInit() { this.eventBus.subscribe(this); }` — **tự đăng ký** vào port khi module init (decoupled: EventsModule không biết audit tồn tại). `handle(event)` → `await this.auditService.record(event)`.
  - [x] `src/audit/audit.module.ts` (`@Module`): providers `[AuditService, AuditSubscriber]`. `EventBus` (global) + `PrismaService` (global) inject được, KHÔNG cần import. Đăng ký `AuditModule` vào `AppModule.imports`.

- [x] **Task 4 — `notifications/`: NotificationDispatcher no-op/log subscriber (AC: 1, 3)**
  - [x] `src/notifications/notification-dispatcher.ts` (`@Injectable() implements EventSubscriber, OnModuleInit`): `constructor(eventBus: EventBus)`; `onModuleInit() { this.eventBus.subscribe(this); }`. `handle(event)` = **NO-OP bản đầu**: chỉ `Logger.log('domain event: ' + event.type)` (bằng chứng port hoạt động), **KHÔNG** gọi FCM/HTTP/mạng. TSDoc ghi rõ: "Bản đầu no-op/log (AD-18); Epic 9 THAY implementation này bằng bộ gửi FCM thật qua `firebase-admin` — producer KHÔNG đổi (AC-3)".
  - [x] `src/notifications/notifications.module.ts` (`@Module`): providers `[NotificationDispatcher]`. Đăng ký vào `AppModule.imports`.
  - [x] **Ranh giới Epic 9 (đừng làm ở đây):** KHÔNG cài `firebase-admin`, KHÔNG entity `DeviceToken`/`Notification`, KHÔNG resolver người-nhận-theo-quyền (AD-15), KHÔNG job scheduler. 2.7 CHỈ chừa **seam** (subscriber no-op) để Epic 9 lắp bộ gửi.

- [x] **Task 5 — Wiring `AppModule` + source-guard AD-18 (AC: 1, 3)**
  - [x] `src/app.module.ts`: thêm `EventsModule`, `AuditModule`, `NotificationsModule` vào `imports` (giữ `CommonModule`, `PrismaModule`, `HealthModule`, `AuthModule`). Cập nhật TSDoc root module: "EventsModule (port AD-18, @Global) + Audit/Notifications subscriber tự đăng ký onModuleInit".
  - [x] `test/no-direct-side-effect-outside-eventbus.spec.ts` (**source-guard AD-18**, mirror `no-manual-prisma-client.spec.ts` + `stripToCode`): quét `src/` trên **code đã strip comment**:
    - Cấm `from 'firebase-admin'` / `require('firebase-admin')` **ngoài** `src/notifications/`.
    - Cấm import/inject `NotificationDispatcher`, `AuditSubscriber`, `AuditService` **ngoài** module sở hữu (`src/notifications/`, `src/audit/`) — producer phải publish qua `EventBus`, KHÔNG gọi consumer trực tiếp.
    - (Cho phép `EventBus`, `DomainEvent`, `EventSubscriber` import ở bất kỳ đâu — đó là port công khai.)

- [x] **Task 6 — Test hermetic (AC: 1, 2, 3)**
  - [x] **Unit `InProcessEventBus`** `test/in-process-event-bus.spec.ts`: `subscribe` rồi `publish` → subscriber `handle` được gọi đúng 1 lần với đúng event; nhiều subscriber → **tất cả** được gọi; một subscriber ném lỗi → subscriber khác **vẫn** chạy + lỗi được log (spy Logger), `publish` **không** reject; không subscriber → `publish` no-op không lỗi.
  - [x] **Unit `AuditService`** `test/audit.service.spec.ts` (mock `PrismaService`): `record(event)` gọi `prisma.auditLog.create` **một lần** với `data` map đúng 5 chiều (eventType/actorAccountId/targetType/targetId/before/after/occurredAt); event thiếu `actorAccountId`/`target` → cột tương ứng `null`/undefined (system event). Khẳng định **không** gọi `update`/`delete`.
  - [x] **Unit `AuditSubscriber`** `test/audit.subscriber.spec.ts`: `onModuleInit` → gọi `eventBus.subscribe(this)` (mock EventBus); `handle(event)` → gọi `auditService.record(event)` (mock).
  - [x] **Unit `NotificationDispatcher`** `test/notification-dispatcher.spec.ts`: `onModuleInit` → `subscribe`; `handle(event)` → gọi Logger (spy), **KHÔNG** side-effect khác (no-op). Chứng minh AC-1 "no-op/log".
  - [x] **Integration decoupling (AC-3)** `test/event-bus.integration.spec.ts` (`Test.createTestingModule` gồm `EventsModule`+`AuditModule`+`NotificationsModule`, override `PrismaService` bằng mock ghi in-memory/spy `auditLog.create`): dựng một **test producer** chỉ inject `EventBus` → `await eventBus.publish(fakeEvent)` → assert `auditLog.create` được gọi (audit persisted) **và** Logger notification được gọi. Producer **không** tham chiếu Prisma/audit/notification → chứng minh AD-18 decoupling; đổi dispatcher KHÔNG đụng producer.
  - [x] **Regression:** `npm test` toàn bộ — mọi suite hiện có (auth/me/guard/error-envelope/naming/openapi-drift/permissions…) **vẫn xanh**; `openapi-drift` xanh **không** regen (không endpoint mới). Toàn bộ test 2.7 **hermetic** (mock Prisma, không Postgres) — mirror 2.3/2.4/2.5.

- [x] **Task 7 — CONVENTIONS.md + README (AC: 1, 2, 3)**
  - [x] `CONVENTIONS.md` thêm mục **"Domain Event & EventBus (AD-18)"**: producer publish qua **một** `EventBus` port (`eventBus.publish(event)`), **CẤM** gọi FCM/notification/audit trực tiếp; consumer (`AuditSubscriber` ghi log, `NotificationDispatcher` no-op→FCM Epic 9) **subscribe** port, tự đăng ký `onModuleInit`; `AuditLog` **append-only** (chỉ `create`, đọc chỉ Super Admin — read = 8.5); source-guard `no-direct-side-effect-outside-eventbus` enforce. Nhấn: thêm chức năng nghiệp vụ có hệ quả (E4+) = **định nghĩa concrete `DomainEvent` + publish**, KHÔNG tự gọi side-effect.
  - [x] `README.md`: một dòng "Domain event qua `EventBus` port (AD-18): publish trong service nghiệp vụ; audit + notification là subscriber; `AuditLog` append-only".

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

Story này **CHỈ** dựng **hạ tầng event: port + hai subscriber nền + entity AuditLog**. Cụ thể:

- **Trong phạm vi:** base `DomainEvent` contract (5 chiều audit, domain thuần); `EventBus` port (abstract/DI token) + `InProcessEventBus` (fan-out đồng bộ, cô lập lỗi) + `EventsModule` (@Global); `audit/` (model `AuditLog` + migration + `AuditService.record` append-only + `AuditSubscriber` tự đăng ký); `notifications/` (`NotificationDispatcher` **no-op/log** tự đăng ký); wiring `AppModule`; source-guard AD-18; test hermetic (unit + integration decoupling); CONVENTIONS/README.
- **Ngoài phạm vi (story/epic khác — ĐỪNG làm ở đây):**
  - **Concrete domain events** (`OrderConfirmed`, `DiscountRequested/Resolved`, `DepositRecorded`, `PaymentRecorded`, `StatusChanged`, `StockOutBlocked`) + **điểm publish thật** trong service nghiệp vụ → **story sở hữu ở E4–E7** (mỗi chức năng khai concrete event + publish khi build). 2.7 CHỈ khai **base contract** + port + subscriber; KHÔNG có producer thật (chưa có `orders/`/`payments/`/`inventory/`).
  - **Bộ gửi FCM thật** (`firebase-admin`, `DeviceToken`/`Notification` entity, resolver người-nhận-theo-QUYỀN AD-15, deep-link payload, job nhắc theo lịch) → **Epic 9**. 2.7 CHỈ chừa seam `NotificationDispatcher` no-op để Epic 9 **thay implementation** (AC-3).
  - **Endpoint đọc Audit** (`GET` danh sách/chi tiết audit, gate `@RequirePermissions(PERM.auditRead)`, chỉ Super Admin) → **Story 8.5**. 2.7 CHỈ ghi (`create`); KHÔNG read endpoint, KHÔNG controller, KHÔNG DTO HTTP → `openapi.json` không đổi.
  - **Registry quyền / `account_permissions` / `/me` / guard** → xong 2.4/2.5/2.6. 2.7 KHÔNG đụng `permission-registry.ts`/`permissions.json`/guard. (`audit.read` đã tồn tại trong registry từ 2.4 — 2.7 KHÔNG thêm key.)
  - **Queue/message broker/outbox/retry bền** → ngoài phạm vi Phase 1 (in-process đồng bộ đủ cho ~20 user, online-only; YAGNI). Nếu sau cần đảm bảo delivery/ordering, đổi **implementation** `EventBus` (port không đổi) — đó chính là giá trị của port.

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-18 — Domain event qua MỘT EventBus port:** **ĐÂY là story hiện thực hóa AD-18.** Mọi hành động nghiệp vụ có hệ quả (E4+) publish domain event qua **một** port; producer **KHÔNG** gọi FCM/notification/audit trực tiếp; consumer subscribe. Port + subscriber chừa sẵn NGAY (bản đầu no-op/log) để "bộ gửi lắp sau không cần mở lại code chức năng". [Source: ARCHITECTURE-SPINE.md#AD-18, project-context.md#gotchas "KHÔNG gọi FCM/audit trực tiếp — publish domain event"]
- **AD-8 — AuditLog append-only, đọc chỉ Super Admin:** audit là nguồn kiểm toán bất biến (ai/gì/đối tượng/khi nào/trước→sau) cho mọi mutation nghiệp vụ; append-only; đọc chỉ Super Admin. 2.7 dựng **đường ghi** (subscriber) + entity; đường đọc gate `audit.read` là 8.5. [Source: ARCHITECTURE-SPINE.md#AD-8, #Consistency Conventions "Logging/Audit: AuditLog bất biến … append-only; đọc chỉ Super Admin"]
- **AD-14 — Push tập trung, business flag KHÔNG rò xuống:** `notifications/` là **một** module gửi push; bản đầu no-op. Remote Config/FCM là Epic 9 — KHÔNG kéo vào đây. [Source: ARCHITECTURE-SPINE.md#AD-14]
- **AD-1 — Chỉ `PrismaService` chạm DB:** `AuditService` ghi qua `PrismaService`, KHÔNG `new PrismaClient()`. Source-guard `no-manual-prisma-client` sẽ bắt vi phạm. [Source: ARCHITECTURE-SPINE.md#AD-1, backend/CONVENTIONS.md#Bất biến]
- **AD-5 — Envelope trung tâm:** lỗi trong subscriber (vd audit ghi DB fail) được **log** server-side (Logger), KHÔNG dựng envelope trong subscriber; nếu publish nằm trong luồng HTTP của producer và lỗi bong lên, `AllExceptionsFilter` (2.2) lo envelope. 2.7 **cô lập** lỗi subscriber để một consumer hỏng không sập luồng producer (xem "Thiết kế port"). [Source: ARCHITECTURE-SPINE.md#AD-5]
- **Layered:** `DomainEvent` = **Domain thuần** (không import Infra/Nest). `EventBus` port khai ở tầng nền; `InProcessEventBus`/`AuditService`/subscriber = Application/Infra (được Nest DI). Domain KHÔNG phụ thuộc Infrastructure. [Source: ARCHITECTURE-SPINE.md#Design Paradigm]
- **Naming/convention:** entity `AuditLog` PascalCase → bảng `audit_logs` snake_case số nhiều (`@@map`); cột snake_case (`@map`); file kebab-case (`in-process-event-bus.ts`, `audit.subscriber.ts`); ID UUID v4; ngày ISO-8601 UTC. [Source: backend/CONVENTIONS.md#Đặt tên, `naming-convention.spec.ts`]

### Đọc file bị SỬA / mở rộng (bắt buộc — trước khi code)

Giữ hành vi hiện có (2.1–2.6); 2.7 **UPDATE**:

- `backend/src/app.module.ts` — hiện: `imports: [CommonModule, PrismaModule, HealthModule, AuthModule]`. **2.7 thêm:** `EventsModule`, `AuditModule`, `NotificationsModule`. KHÔNG đổi module cũ, KHÔNG đổi thứ tự guard (guard sống trong `AuthModule`). [đọc file: `src/app.module.ts` — 19 dòng, đã đọc]
- `backend/prisma/schema.prisma` — hiện: `Account`, `AccountPermission`, `Session`. **2.7 thêm:** model `AuditLog` (bảng MỚI `audit_logs`). **KHÔNG** tạo lại/đổi 3 model cũ; migration mới CHỈ `CREATE TABLE audit_logs` (+ index). [đọc file: `prisma/schema.prisma` — đã đọc]
- `backend/CONVENTIONS.md`, `backend/README.md` — thêm mục EventBus/Audit.
- **KHÔNG đụng:** `permission-registry.ts`/`role-presets.ts`/`permissions.json` (registry không đổi), `account-permissions.service.ts`, `auth/*` (guard/`/me`/JWT), `common/errors/*`, `openapi/*` (không endpoint mới → không regen), `seed.ts` (không seed audit), migration cũ.

### Tái dùng (scout-before-code — DRY)

- **`PrismaService`** (2.1, `@Global` `PrismaModule`) — `AuditService` inject để ghi `auditLog`. KHÔNG tạo client/kết nối mới. [Source: backend/src/prisma/prisma.service.ts, prisma.module.ts]
- **`@Global` module pattern** — mirror `PrismaModule` cho `EventsModule` (port dùng khắp nơi, inject không cần import lại). [Source: backend/src/prisma/prisma.module.ts]
- **Module registration pattern** — mirror cách `AppModule` import module + cách `AuthModule` gom providers/exports; subscriber tự đăng ký `onModuleInit` (Nest lifecycle chuẩn). [Source: backend/src/app.module.ts, backend/src/accounts/accounts.module.ts]
- **`Logger` (@nestjs/common)** — mirror `AllExceptionsFilter` dùng `private readonly logger = new Logger(X.name)` để log lỗi subscriber + no-op notification. KHÔNG `console.log`. [Source: backend/src/common/errors/all-exceptions.filter.ts:31]
- **Source-guard pattern** — mirror `no-manual-prisma-client.spec.ts` (dùng `collectTsFiles` + `stripToCode` từ `test/util/strip-to-code.ts`) cho guard AD-18 mới. KHÔNG viết cơ chế quét mới. [Source: backend/test/no-manual-prisma-client.spec.ts, test/util/strip-to-code.ts]
- **Test hermetic pattern** — unit: mock Prisma/Logger/subscriber; integration: `Test.createTestingModule` override `PrismaService` no-op (mirror `me.e2e.spec.ts`/`auth.e2e.spec.ts`). KHÔNG Postgres cho phần bắt buộc. [Source: backend/test/me.e2e.spec.ts, auth.e2e.spec.ts]
- **Không tạo trùng:** chưa có `events/`/`audit/`/`notifications/` module, chưa có `EventBus`/`AuditLog`/`NotificationDispatcher` (grep `src/` = NONE). Code MỚI. [Source: file tree; grep xác nhận]

### Thiết kế port (chốt để dev nhất quán)

- **Port = abstract class kiêm DI token:** `EventBus` (abstract) là contract; `InProcessEventBus` là implementation mặc định provide qua `{ provide: EventBus, useClass: InProcessEventBus }`. Producer inject `EventBus` (không biết implementation) — đổi implementation (Epic 9 queue, retry…) KHÔNG đụng producer. Đây là **giá trị cốt lõi** của AD-18.
- **Đăng ký subscriber — self-register `onModuleInit` (KHÔNG multi-provider token):** consumer (`AuditSubscriber`/`NotificationDispatcher`) gọi `eventBus.subscribe(this)` trong `onModuleInit`. Ưu điểm: **EventsModule không cần biết consumer nào tồn tại** (decoupled thật; thêm consumer = thêm module, không sửa EventsModule); tránh rắc rối multi-provider cross-module. `EventBus` global → subscriber inject được ở bất kỳ module nào. *(Phương án khác: `EVENT_SUBSCRIBER` multi-inject token — xem Open Question #1.)*
- **Fan-out đồng bộ + cô lập lỗi:** `publish` await từng subscriber trong `try/catch` riêng; một subscriber ném → log + tiếp tục (consumer độc lập). **Vì sao cô lập:** notification hỏng KHÔNG được làm mất audit, và ngược lại; producer không nên sập vì side-effect phụ. **Đánh đổi:** audit ghi lỗi bị "nuốt" (chỉ log) — với Phase 1 chấp nhận (chưa có producer thật; khi producer đầu tiên land ở E4, quyết coupling transaction nếu cần — xem Open Question #2). In-process đồng bộ (không queue) đủ cho ~20 user online-only (YAGNI).
- **`AuditLog.actorAccountId` = String KHÔNG FK cascade:** audit là **snapshot lịch sử bất biến** — phải sống sót khi account bị vô hiệu/xoá (Epic 8). Lưu id dạng String + index (KHÔNG relation `onDelete: Cascade/SetNull` để không mất "ai"). Spine ERD vẽ quan hệ `ACCOUNT ||--o{ AUDIT_LOG` là **khái niệm**; hiện thực denormalized id bảo toàn tính bất biến. *(Open Question #3.)*
- **`before`/`after` kiểu `Json?`:** mềm dẻo cho mọi loại event (E4+ tự quyết shape). 2.7 KHÔNG ràng schema cứng cho payload (concrete event chưa tồn tại). `unknown` ở TS → `Prisma.InputJsonValue` khi ghi.

### Chiến lược test (DB vs hermetic — mirror 2.3/2.4/2.5)

- **Bắt buộc + luôn chạy được (hermetic, không Postgres):** unit `InProcessEventBus` (fan-out, cô lập lỗi, log — mock subscriber/Logger); unit `AuditService` (map 5 chiều → `create` — mock Prisma); unit `AuditSubscriber`/`NotificationDispatcher` (self-register + handle — mock); integration decoupling (override `PrismaService` no-op/spy, publish qua `EventBus` thật từ test producer). Toàn bộ event bus = logic thuần + service mock ⇒ mock được hết.
- **Integration cần Postgres** (ghi `audit_logs` thật, đọc lại xác minh cột) — chạy khi có DB; **đừng để suite fail vì thiếu DB** (hermetic phủ đủ AC). [Source: project-context.md#Testing]
- **Regression bắt buộc:** toàn suite hiện có xanh; `openapi-drift` xanh KHÔNG regen (bằng chứng 2.7 không đụng HTTP surface).
- **Prisma 7 gotcha (nhắc lại):** `auditLog.create` **đơn** (không `createMany`) → KHÔNG dính lỗi empty-`createMany` của Prisma 7 + adapter-pg (memory `prisma7-empty-createmany-atomic-replace`). Không cần transaction rỗng-guard.

### Previous Story Intelligence (2.6 vừa done + mạch backend 2.1–2.5)

- **2.6 (nối UI gating vào `/me`)** là story FE (web+mobile) — KHÔNG chạm backend event. Bài học chuyển tiếp: generator/artifact byte-for-byte discipline (permission keys) — 2.7 KHÔNG sinh artifact FE, nhưng giữ kỷ luật "sửa nguồn rồi regen" cho migration (KHÔNG sửa tay SQL). [Source: 2-6-…md]
- **2.5 (guard + `/me`)** dựng `@RequirePermissions(PERM.auditRead)` cơ chế — endpoint đọc Audit (8.5) sẽ **dùng lại** cơ chế này; 2.7 chỉ cần đảm bảo `AuditLog` ghi đủ dữ liệu cho 8.5 hiển thị. `audit.read` **đã** trong registry (2.4) → 2.7 KHÔNG thêm key. [Source: 2-5-…md, permission-registry.ts]
- **Kỷ luật hermetic-first:** 2.3/2.4/2.5 đều 100% hermetic, không Postgres cho phần bắt buộc — 2.7 giữ nguyên (event bus dễ mock hơn cả). [Source: 2-5-…md#Chiến lược test]
- **Chốt Open Question theo mặc định YOLO** rồi ghi rõ ở Completion Notes (không lừa dối nhánh-không-chọn) — làm như 2.4/2.5.
- **Source-guard là lưới an toàn kiến trúc:** 2.4 dựng `no-permission-literal-outside-registry`, 2.1 dựng `no-manual-prisma-client` — 2.7 **thêm** `no-direct-side-effect-outside-eventbus` (mirror cùng cơ chế `stripToCode`). Tránh viết chuỗi bị cấm (`firebase-admin`) trong comment code `src/` (false-positive — guard strip comment nên an toàn, nhưng nhất quán). [Source: backend/test/no-*.spec.ts]

### Git Intelligence (5 commit gần nhất)

`60d57ee feat(story-2.6)` · `e10f35f feat(story-2.5)` · `e60ef01 feat(story-2.4)` · `3b77460 feat(story-2.3)` · `7be0495 feat(story-2.2)`. Pattern: mỗi story = một commit conventional `feat(story-X.Y): <mô tả tiếng Việt>`, KHÔNG tham chiếu AI. Backend Epic 2 dựng tăng dần: skeleton(2.1)→envelope(2.2)→JWT(2.3)→registry(2.4)→enforce+`/me`(2.5)→FE gating(2.6)→**EventBus port + audit/noti seam(2.7)**. 2.7 khép phần **nền tảng** Epic 2: chừa seam side-effect cho E4–E9 lắp vào không mở lại code. Commit đề xuất: `feat(story-2.7): EventBus port + NotificationDispatcher no-op + audit subscriber`.

### Latest Tech Notes (versions từ project-context)

- **NestJS 11.1.27** — `OnModuleInit` lifecycle hook chuẩn để subscriber self-register; abstract class làm DI token (`{ provide: EventBus, useClass: ... }`) là pattern Nest chính thống. `@Global()` module cho port dùng chung (như `PrismaModule`). KHÔNG cần `@nestjs/event-emitter` (thêm dep = thừa; in-process fan-out tự viết ~30 dòng, kiểm soát cô lập lỗi + await tốt hơn; port tự sở hữu contract, không ràng vào lib event bên thứ ba). [Source: project-context.md#Stack]
- **Prisma 7.8.0 + adapter-pg** — `Json?` cột dùng `Prisma.InputJsonValue`; `create` đơn không dính gotcha empty-`createMany`. Migration qua `prisma migrate dev` (adapter-pg; connection ở `prisma.config.ts`). [Source: backend/prisma/schema.prisma header, package.json scripts]
- **Node 24 LTS** — async `publish`/`handle`, `OnModuleInit` async OK.

### Project Structure Notes

Cây mục tiêu — 2.7 tạo phần **in đậm**:

- `backend/src/events/` → **`domain-event.ts`**, **`event-bus.ts`** (port + `EventSubscriber`), **`in-process-event-bus.ts`**, **`events.module.ts`** (@Global).
- `backend/src/audit/` → **`audit.service.ts`** (record, append-only), **`audit.subscriber.ts`**, **`audit.module.ts`**.
- `backend/src/notifications/` → **`notification-dispatcher.ts`** (no-op/log), **`notifications.module.ts`**.
- `backend/prisma/schema.prisma` → UPDATE (thêm model `AuditLog`); **migration MỚI** `prisma/migrations/*_add_audit_logs/`.
- `backend/src/app.module.ts` → UPDATE (import 3 module mới).
- Test MỚI: `test/in-process-event-bus.spec.ts`, `test/audit.service.spec.ts`, `test/audit.subscriber.spec.ts`, `test/notification-dispatcher.spec.ts`, `test/event-bus.integration.spec.ts`, `test/no-direct-side-effect-outside-eventbus.spec.ts`.
- UPDATE: `CONVENTIONS.md`, `README.md`.

### Project Structure Notes — Alignment & Variances

- **Alignment:** `notifications/` + `audit/` module khớp spine module-tree (`notifications/ = FCM sender…`, `audit/ = AuditLog append-only, đọc chỉ Super Admin`). `EventBus` port khớp AD-18 "định nghĩa ở nền backend, bản đầu no-op/log". `AuditLog` bảng `audit_logs` khớp naming convention + `naming-convention.spec.ts`.
- **Variance có chủ đích:** spine module-tree KHÔNG liệt kê thư mục `events/` riêng (AD-18 chỉ nói "port ở nền backend"). 2.7 đặt port ở **`src/events/`** (module riêng, @Global) thay vì nhét vào `common/` — vì port là khái niệm nền tảng độc lập, nhiều domain tiêu thụ; `common/` hiện là "tầng API dùng chung (filter/pipe/guard)". Đây là biến thể **có lý do** (cohesion + đúng vai trò nền tảng), không mâu thuẫn bất biến (AD-18 = "một port duy nhất", vị trí file thứ yếu). *(Open Question #4.)*

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7] — 3 AC verbatim (EventBus port duy nhất + NotificationDispatcher no-op + producer không gọi trực tiếp; domain event → audit subscriber ghi AuditLog append-only chỉ Super Admin đọc; Epic 9 thay dispatcher không mở lại code E4–E7).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 overview] — "Chừa sẵn Domain Event port + NotificationDispatcher (no-op/log) để các epic sau publish event (AD-18)".
- [Source: ARCHITECTURE-SPINE.md#AD-18] — mọi hành động nghiệp vụ có hệ quả publish domain event qua MỘT `EventBus` port (bản đầu no-op/log); producer KHÔNG gọi FCM/notification/audit trực tiếp; consumer subscribe; port + điểm publish chừa sẵn, bộ gửi lắp sau không mở lại code.
- [Source: ARCHITECTURE-SPINE.md#AD-8 + #Consistency Conventions] — AuditLog bất biến (ai/gì/đối tượng/khi nào/trước→sau) cho mọi mutation nghiệp vụ; append-only; đọc chỉ Super Admin.
- [Source: ARCHITECTURE-SPINE.md#AD-14] — notifications tập trung một module; Remote Config/FCM Epic 9; business flag KHÔNG rò xuống Remote Config.
- [Source: ARCHITECTURE-SPINE.md#AD-1, #AD-5, #Design Paradigm] — chỉ `PrismaService` chạm DB; envelope trung tâm; layered (Domain không phụ thuộc Infra).
- [Source: ARCHITECTURE-SPINE.md#Backend module tree] — `audit/`, `notifications/` module namespace; `prisma/` điểm truy cập DB duy nhất.
- [Source: backend/CONVENTIONS.md] — naming (entity PascalCase → bảng snake_case số nhiều @@map; file kebab-case; UUID); OpenAPI sinh-từ-code cấm sửa tay (2.7 không đụng vì không endpoint); source-guard pattern.
- [Source: backend/src/app.module.ts] — imports hiện tại; 2.7 thêm 3 module.
- [Source: backend/prisma/schema.prisma] — `Account`/`AccountPermission`/`Session` + Prisma 7 adapter-pg header (datasource chỉ provider; migration qua prisma.config.ts).
- [Source: backend/src/prisma/prisma.service.ts, prisma.module.ts] — `PrismaService` (@Global) — `AuditService` inject.
- [Source: backend/src/common/errors/all-exceptions.filter.ts] — `Logger` pattern; envelope trung tâm (subscriber log lỗi, không dựng envelope).
- [Source: backend/test/no-manual-prisma-client.spec.ts, test/util/strip-to-code.ts] — source-guard pattern (mirror cho AD-18 guard).
- [Source: backend/src/accounts/domain/permission-registry.ts] — `audit.read` (`PERM.auditRead`) đã tồn tại (2.4); read endpoint gate quyền này = Story 8.5, KHÔNG phải 2.7.
- [Source: PRD#FR-20] — Audit log (phần *ghi* thuộc 2.7 qua event; phần *đọc* Super Admin thuộc Epic 8/8.5).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8, 1M context)

### Debug Log References

- Integration decoupling test lỗi DI đầu tiên: `AuditModule` inject `PrismaService` nhưng test module KHÔNG import `PrismaModule` (@Global) → token không resolve. Sửa: import `PrismaModule` vào test rồi `overrideProvider(PrismaService).useValue(mock)` — mirror `me.e2e.spec.ts`.
- Migration sinh OFFLINE (không Postgres cục bộ): `prisma migrate diff --from-schema <prev> --to-schema` (prev = schema bỏ model `AuditLog`) → delta CHỈ `audit_logs` (KHÔNG đụng bảng cũ). `--from-migrations` bị chặn vì cần shadow DB — dùng from-schema thay thế (mirror chiến lược 2.3/2.4).
- Prettier chỉnh format 3 file (audit.service.ts, 2 spec) — `npm run format`; lint + build sau đó sạch.

### Completion Notes List

- **AC-1 (EventBus port DUY NHẤT + no-op dispatcher):** `EventBus` abstract class kiêm DI token (`src/events/event-bus.ts`); `InProcessEventBus` fan-out đồng bộ + cô lập lỗi provide qua `{ provide: EventBus, useClass: InProcessEventBus }` (@Global `EventsModule`). `NotificationDispatcher.handle` chỉ `Logger.log` — KHÔNG mạng/FCM (không có `firebase-admin` trong deps). Producer chỉ `eventBus.publish` — source-guard enforce.
- **AC-2 (AuditLog append-only, đủ 5 chiều):** model `AuditLog` (bảng `audit_logs`, migration `20260709000000_add_audit_logs`); `AuditService.record` map eventType/actorAccountId/targetType/targetId/before/after/occurredAt → `prisma.auditLog.create` ĐƠN. Service CHỈ expose `create` — KHÔNG `update`/`delete`/`upsert` (bất biến). `actorAccountId` String no-FK để audit sống sót khi account vô hiệu/xoá.
- **AC-3 (thay dispatcher không mở lại code):** integration test dựng `TestProducer` chỉ inject `EventBus` → `publish` → audit persisted + notification dispatched; producer KHÔNG tham chiếu Prisma/audit/notification → đổi implementation dispatcher KHÔNG đụng producer.
- **Source-guard AD-18** (`no-direct-side-effect-outside-eventbus.spec.ts`): cấm `firebase-admin` ngoài `notifications/` (quét trên bản CHỈ-bỏ-comment vì import specifier là string — `stripToCode` bỏ luôn string nên không bắt được); cấm tham chiếu `NotificationDispatcher`/`AuditSubscriber`/`AuditService` ngoài module sở hữu (dùng `stripToCode` cho check định danh).
- **Không HTTP-surface drift:** `openapi.json`/`permissions.json` UNCHANGED (không controller/route/DTO/permission key mới); `openapi-drift` + `permissions-drift` xanh không regen. `audit.read` đã có sẵn trong registry (2.4) — KHÔNG thêm key; endpoint đọc Audit = Story 8.5.
- **Test:** 6 suite mới (5 unit/integration + 1 source-guard), toàn HERMETIC (mock Prisma/Logger, không Postgres). Full suite: **26 suites / 134 tests passing** (0 regression). Lint + `nest build` + `format:check` sạch.
- **Open Questions — chốt mặc định YOLO:** (1) self-register `onModuleInit` (không multi-provider token) — decoupled thật; (2) cô lập lỗi + log, chốt coupling transaction ở E4 khi có producer thật; (3) `actorAccountId` String no-FK — audit bất biến sống sót vòng đời account; (4) port đặt ở `src/events/` (module @Global riêng) thay vì `common/`.

### File List

**Mới (src):**
- `backend/src/events/domain-event.ts`
- `backend/src/events/event-bus.ts`
- `backend/src/events/in-process-event-bus.ts`
- `backend/src/events/events.module.ts`
- `backend/src/audit/audit.service.ts`
- `backend/src/audit/audit.subscriber.ts`
- `backend/src/audit/audit.module.ts`
- `backend/src/notifications/notification-dispatcher.ts`
- `backend/src/notifications/notifications.module.ts`

**Mới (test):**
- `backend/test/in-process-event-bus.spec.ts`
- `backend/test/audit.service.spec.ts`
- `backend/test/audit.subscriber.spec.ts`
- `backend/test/notification-dispatcher.spec.ts`
- `backend/test/event-bus.integration.spec.ts`
- `backend/test/no-direct-side-effect-outside-eventbus.spec.ts`

**Mới (migration):**
- `backend/prisma/migrations/20260709000000_add_audit_logs/migration.sql`

**Sửa:**
- `backend/prisma/schema.prisma` (thêm model `AuditLog`)
- `backend/src/app.module.ts` (import `EventsModule`/`AuditModule`/`NotificationsModule`)
- `backend/CONVENTIONS.md` (mục "Domain Event & EventBus")
- `backend/README.md` (mục domain event)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-09 | **Triển khai 2.7 (→ review):** `EventBus` port (abstract/DI token) + `InProcessEventBus` (fan-out đồng bộ, cô lập lỗi, @Global `EventsModule`) + base `DomainEvent` (5 chiều audit, domain thuần); `audit/` (model `AuditLog` append-only + migration `20260709000000_add_audit_logs` + `AuditService.record` chỉ-create + `AuditSubscriber` self-register); `notifications/` (`NotificationDispatcher` no-op/log self-register); wiring `AppModule` (3 module mới); source-guard AD-18 (`no-direct-side-effect-outside-eventbus`); 6 suite test hermetic (unit bus/service/subscriber/dispatcher + integration decoupling AC-3). Full suite 26/134 xanh, 0 regression; lint/build/format sạch; `openapi.json`/`permissions.json` KHÔNG đổi (không endpoint/permission mới). CONVENTIONS/README thêm mục EventBus/Audit. Chốt 4 Open Question theo mặc định YOLO (self-register / cô lập lỗi / String no-FK / port `events/`). |
| 2026-07-09 | Tạo story context 2.7 (Domain Event port + NotificationDispatcher no-op + audit subscriber): phạm vi = base `DomainEvent` contract (5 chiều audit, domain thuần) + `EventBus` port (abstract/DI token) + `InProcessEventBus` (fan-out đồng bộ, cô lập lỗi) + `EventsModule` @Global + `audit/` (model `AuditLog` append-only + migration + `AuditService.record` + `AuditSubscriber` self-register) + `notifications/` (`NotificationDispatcher` no-op/log self-register) + wiring `AppModule` + source-guard AD-18 (`no-direct-side-effect-outside-eventbus`) + test hermetic (unit bus/service/subscriber + integration decoupling) + CONVENTIONS/README. Hiện thực AD-18/AD-8: producer publish qua một port, consumer subscribe, audit append-only; Epic 9 thay dispatcher no-op bằng FCM không mở lại code E4–E7 (AC-3). Ngoài phạm vi: concrete event + điểm publish thật (E4–E7), bộ gửi FCM/DeviceToken/resolver (Epic 9), endpoint đọc Audit gate `audit.read` (Story 8.5). KHÔNG endpoint mới → openapi.json không đổi. 4 Open Question: (1) self-register onModuleInit vs multi-provider token; (2) coupling transaction audit↔producer khi có producer thật (E4); (3) `actorAccountId` String vs FK relation; (4) vị trí port `events/` vs `common/`. Mặc định YOLO: self-register / cô lập lỗi (quyết coupling ở E4) / String no-FK / module `events/` riêng. |

## Open Questions

1. **Đăng ký subscriber: self-register `onModuleInit` hay `EVENT_SUBSCRIBER` multi-inject token?** Đề xuất **self-register** — EventsModule không cần biết consumer nào (decoupled thật, thêm consumer = thêm module không sửa nền); tránh rắc rối multi-provider cross-module với `@Global`. Multi-token gọn hơn về "khai báo" nhưng buộc mọi subscriber provide vào scope EventBus. Mặc định YOLO: **self-register onModuleInit**.
2. **Audit ghi có nằm CÙNG transaction với producer không (khi có producer thật ở E4)?** 2.7 chưa có producer → publish fan-out đồng bộ **cô lập lỗi** (audit fail chỉ log). Khi build producer đầu tiên (Chốt đơn E4), cân nhắc: audit trong cùng `$transaction` với mutation (đảm bảo audit-hoặc-rollback) vs after-commit (đơn giản, audit best-effort). Đề xuất **quyết ở E4** theo yêu cầu compliance thực; 2.7 giữ port linh hoạt (đổi implementation không đụng producer). Mặc định: **cô lập lỗi + log**, chốt coupling ở E4.
3. **`AuditLog.actorAccountId`: String denormalized hay FK relation tới `Account`?** Đề xuất **String + index, KHÔNG FK cascade** — audit bất biến phải sống sót khi account vô hiệu/xoá (Epic 8); FK `onDelete` nào cũng rủi ro mất "ai". Spine ERD vẽ quan hệ là khái niệm. Mặc định YOLO: **String no-FK**. *(Nếu chủ dự án muốn ràng buộc tham chiếu, dùng FK `onDelete: Restrict` — chặn xoá account có audit.)*
4. **Vị trí `EventBus` port: `src/events/` (module riêng @Global) hay `src/common/`?** Đề xuất **`events/`** — port là khái niệm nền tảng độc lập nhiều domain tiêu thụ; `common/` hiện là tầng API dùng chung (filter/pipe/guard). Spine module-tree không liệt kê `events/` riêng nhưng AD-18 chỉ nói "nền backend". Mặc định: **`events/`**.
