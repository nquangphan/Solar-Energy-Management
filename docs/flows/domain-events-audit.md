# Domain event, nhật ký audit và thông báo

> Flow `domain-events-audit`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow domain-events-audit` in ra đúng danh sách đó.

## Mục đích

Hạ tầng side-effect cross-cutting theo AD-18: service nghiệp vụ chỉ `publish` một `DomainEvent` qua MỘT port
`EventBus`; các consumer tự đăng ký sẽ lo ghi nhật ký audit bất biến (`audit_logs`, AD-8) và gửi thông báo.
Producer không biết consumer nào tồn tại, nên kênh gửi thật (Epic 9) lắp vào sau mà không mở lại code chức
năng. Luật gốc: [`backend/CONVENTIONS.md`](../../backend/CONVENTIONS.md) mục "Domain Event & EventBus (AD-18,
Story 2.7)".

Giới hạn đã biết (theo code và CONVENTIONS):

- `NotificationDispatcher` bản đầu chỉ `Logger.log` loại event; chưa có FCM/email/SMS, `firebase-admin` chưa
  nằm trong dependencies. Hệ quả: mã đặt lại mật khẩu chưa tới tay người dùng.
- Audit ghi **best-effort**: producer publish sau commit, `InProcessEventBus` nuốt + log lỗi consumer ⇒ nếu
  `AuditService.record` ném, thay đổi nghiệp vụ đã commit nhưng không có dòng `audit_logs`.
- Chưa có đường ĐỌC audit (endpoint gate `audit.read` là Story 8.5). Flow này không thêm route nào.
- Bus in-process, fan-out tuần tự, không queue/retry/dead-letter (đủ cho Phase 1).

## Điểm vào

Không có route, màn hình hay CLI. Flow được kích hoạt khi:

- Một service nghiệp vụ gọi `eventBus.publish(event)` (inject `EventBus` từ `EventsModule` `@Global`).
- Khởi động app: `onModuleInit` của `AuditSubscriber` và `NotificationDispatcher` gọi `eventBus.subscribe(this)`.
  `AppModule` import `EventsModule`, `AuditModule`, `NotificationsModule`.

## Các bước

1. `backend/src/events/domain-event.ts` → `DomainEvent`: hợp đồng 5 chiều audit — `type`, `occurredAt`,
   `actorAccountId?` (vắng = hệ thống), `target?` `{ type, id }`, `before?`/`after?`. Domain thuần, không
   import Nest/Prisma. Concrete event do flow sở hữu tự khai (vd `auth/domain/password-events.ts`).
2. `backend/src/events/event-bus.ts` → `EventBus` (abstract class kiêm DI token) + `EventSubscriber`
   (`handle(event)`).
3. `backend/src/events/events.module.ts` → `EventsModule`: `@Global`, bind `EventBus` → `InProcessEventBus`.
4. `backend/src/audit/audit.subscriber.ts` → `AuditSubscriber.onModuleInit`: tự đăng ký;
   `backend/src/notifications/notification-dispatcher.ts` → `NotificationDispatcher.onModuleInit`: tương tự.
5. Producer (ở flow khác) commit giao dịch rồi gọi `EventBus.publish(event)`.
6. `backend/src/events/in-process-event-bus.ts` → `InProcessEventBus.publish`: lần lượt `await
   subscriber.handle(event)` theo thứ tự đăng ký, mỗi subscriber trong `try/catch` riêng; lỗi được
   `Logger.error` kèm `event.type`, subscriber sau vẫn chạy, `publish` không reject.
7. `AuditSubscriber.handle` → `backend/src/audit/audit.service.ts` → `AuditService.record`:
   `prisma.auditLog.create` map 5 chiều sang cột; `toJsonInput` bỏ field khi `undefined`, đổi `null` thành
   `Prisma.JsonNull`, giữ giá trị falsy (`false`, `0`). Lỗi DB được ném lại cho bus xử lý.
8. `NotificationDispatcher.handle`: chỉ log `domain event: <type>` (no-op, đồng bộ).

## Bất biến

| Bất biến | Nơi enforce | Test / guard |
|----------|-------------|--------------|
| `audit_logs` append-only: trong `src/` chỉ được `auditLog.create`, cấm `update`/`updateMany`/`delete`/`deleteMany`/`upsert` | `AuditService` | `audit-log-append-only.spec.ts` (source-guard), `audit.service.spec.ts` |
| `NotificationDispatcher`, `AuditSubscriber`, `AuditService`, `InProcessEventBus` chỉ được tham chiếu trong thư mục sở hữu; producer chỉ biết `EventBus` | quy ước AD-18 | `no-direct-side-effect-outside-eventbus.spec.ts` |
| `firebase-admin` không được import ngoài `src/notifications/` và chưa có trong dependencies | quy ước Epic 9 seam | `no-direct-side-effect-outside-eventbus.spec.ts` |
| Một consumer lỗi không chặn consumer khác và không làm `publish` reject; lỗi được log, không nuốt im lặng | `InProcessEventBus.publish` | `in-process-event-bus.spec.ts`, `event-bus.integration.spec.ts` |
| Fan-out tuần tự theo thứ tự đăng ký | `InProcessEventBus.publish` | `in-process-event-bus.spec.ts` |
| `AuditService`/`AuditSubscriber` ném lại lỗi (không nuốt); bus là nơi duy nhất cô lập | `AuditService.record`, `AuditSubscriber.handle` | `audit.service.spec.ts`, `audit.subscriber.spec.ts` |
| Ghi đúng 5 chiều, event hệ thống ⇒ `actor_account_id` null, `null` JSON ghi `Prisma.JsonNull` | `AuditService.record`, `toJsonInput` | `audit.service.spec.ts` |
| `actor_account_id` không có FK ⇒ dòng audit sống sót khi account bị vô hiệu/xoá | migration `add_audit_logs` | (schema; không có test riêng) |
| Payload event không chứa bí mật (mật khẩu, hash, mã) vì `audit_logs` vĩnh viễn | concrete event ở flow sở hữu | vd `password-events.spec.ts` (flow auth-session) |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/events/domain-event.ts` | Hợp đồng event 5 chiều | `DomainEvent` |
| `backend/src/events/event-bus.ts` | Port + interface subscriber | `EventBus`, `EventSubscriber` |
| `backend/src/events/in-process-event-bus.ts` | Implementation in-process, cô lập lỗi | `InProcessEventBus` |
| `backend/src/events/events.module.ts` | Module `@Global` bind port | `EventsModule` |
| `backend/src/audit/audit.service.ts` | Ghi `audit_logs` (chỉ `create`) | `AuditService`, `toJsonInput` |
| `backend/src/audit/audit.subscriber.ts` | Consumer audit | `AuditSubscriber` |
| `backend/src/audit/audit.module.ts` | Module audit | `AuditModule` |
| `backend/src/notifications/notification-dispatcher.ts` | Consumer thông báo (log) | `NotificationDispatcher` |
| `backend/src/notifications/notifications.module.ts` | Module thông báo | `NotificationsModule` |
| `backend/prisma/migrations/20260709000000_add_audit_logs/migration.sql` | Tạo `audit_logs` + index `(actor_account_id)`, `(target_type, target_id)` | — |

## Dữ liệu

- Bảng: `audit_logs` (model `AuditLog`) — chỉ INSERT. Cột: `event_type`, `actor_account_id`, `target_type`,
  `target_id`, `before`/`after` (JSONB), `occurred_at` (thời điểm nghiệp vụ), `created_at` (lúc ghi).
- Sự kiện: flow này không phát event; nó subscribe MỌI `DomainEvent`. Các class đang được khai trong
  `backend/src`:
  - accounts/auth: `AccountPermissionsChanged`, `PasswordResetRequested`, `PasswordResetCompleted`,
    `PasswordChanged`;
  - catalog: `ProductCreated`, `ProductUpdated`, `ProductDeactivated`, `ProductGroupCreated`,
    `ProductGroupUpdated`, `ProductGroupDeactivated`, `ProductGroupReactivated`, `ProductGroupItemsReplaced`,
    `ProductPricesReplaced`;
  - customers: `CustomerCreated`, `CustomerUpdated`, `CustomerSourceCreated`, `CustomerSourceUpdated`,
    `CustomerSourceDeactivated`, `CustomerSourceReactivated`;
  - orders: `OrderCreated`, `OrderConfirmed`, `OrderRevised`, `OrderCancelled`, `OrderMetaChanged`,
    `OrderScopeChanged`, `OrderLineAdded`, `OrderLineUpdated`, `OrderLineRemoved`, `StatusChanged`,
    `DiscountRequested`, `DiscountResolved`, `QuoteExported`, `AttachmentAdded`, `AttachmentRemoved`;
  - inventory: `StockIssued`, `StockOutBlocked`, `StockVoucherCreated`;
  - system-settings: `SystemSettingChanged`, `FeatureFlagToggled`.
- Gọi ngoài: không (chưa có kênh push/email/SMS).

## Flow liên quan

- auth-session: producer `PasswordResetRequested` / `PasswordResetCompleted` / `PasswordChanged`;
  `PasswordResetRequested` là seam gửi mã reset.
- accounts-permissions: producer `AccountPermissionsChanged`; quyền `audit.read` (chỉ `SUPER_ADMIN`) dành cho
  đường đọc audit tương lai.
- catalog, customers, orders, inventory, system-settings: producer các event liệt kê ở trên.
- backend-platform: `PrismaService`/`PrismaModule`, `AppModule` nối ba module của flow này.

## Tests

**Backend hermetic (Jest, mock Prisma)**

- `backend/test/in-process-event-bus.spec.ts`: fan-out đủ subscriber, tuần tự, lỗi (kể cả không phải
  `Error`) được log từng cái, không subscriber ⇒ no-op.
- `backend/test/audit.service.spec.ts`: shape `auditLog.create`, event hệ thống, falsy, `Prisma.JsonNull`,
  ném lại lỗi, không gọi update/delete/upsert.
- `backend/test/audit.subscriber.spec.ts`: tự đăng ký ở `onModuleInit`, chuyển tiếp sang `record`, ném lại lỗi.
- `backend/test/notification-dispatcher.spec.ts`: tự đăng ký, chỉ `Logger.log` kèm `event.type`.
- `backend/test/event-bus.integration.spec.ts`: dựng `EventsModule` + `AuditModule` + `NotificationsModule`
  thật với `PrismaService` giả; producer chỉ inject `EventBus` ⇒ audit được ghi và notification được gọi;
  audit lỗi thì notification vẫn chạy. Tên có "integration" nhưng là lane hermetic, KHÔNG cần Postgres.

**Source-guard**

- `backend/test/audit-log-append-only.spec.ts`: quét `src/` tìm lối sửa/xoá `auditLog` (có ca chứng minh
  regex bắt được và không false-positive với doc).
- `backend/test/no-direct-side-effect-outside-eventbus.spec.ts`: `firebase-admin` ngoài `notifications/`,
  tham chiếu consumer/implementation bus ngoài thư mục sở hữu.

Flow này không có ca `*.db.integration.spec.ts` riêng. Dòng `audit_logs` thật trên Postgres chỉ được kiểm
gián tiếp ở lane DB của flow khác (vd `order-status-change.db.integration.spec.ts`,
`order-attachments.db.integration.spec.ts` dựng bus và `AuditService` thật).
