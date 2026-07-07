---
name: 'Phương Nam Solar Phase 1'
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: layered client-server (backend là chủ sở hữu duy nhất của DB + nghiệp vụ)
scope: 'Phase 1 — app quản lý nội bộ Phương Nam Solar: Web (React) + Mobile (Flutter) là REST client thuần; Backend (NestJS) sở hữu DB + toàn bộ business logic; file/ảnh trên Cloudflare R2; design system per-platform là deliverable đầu tiên; push/notifications qua Firebase FCM (mobile) + hộp thư in-app. Governs FR-1..FR-34.'
status: final
created: '2026-07-07'
updated: '2026-07-07'
binds: [FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34]
sources:
  - ../../prds/prd-Solar-Energy-Management-2026-07-06/prd.md
  - ../../ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md
  - ../../ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md
companions: []
---

# Architecture Spine — Phương Nam Solar Phase 1

## Design Paradigm

**Layered client-server.** Backend là biên nghiệp vụ và là chủ sở hữu **DUY NHẤT** của dữ liệu; hai client (Web React, Mobile Flutter) chỉ render + gọi REST. Không client nào chạm DB hay giữ business rule.

Bốn tầng backend (ánh xạ sang NestJS module namespace):

| Tầng | Trách nhiệm | Namespace |
| --- | --- | --- |
| API (Presentation) | REST controllers, DTO/validation, OpenAPI | `*/*.controller.ts`, `common/` (guards, interceptors, exception filter) |
| Application | orchestration nghiệp vụ, transaction, auto-transition | `*/*.service.ts` |
| Domain | quy tắc thuần: pricing/VAT, snapshot, allowed-transition, permission eval | `*/domain/` (rules, state-machine, value objects) |
| Infrastructure | truy cập DB, R2, JWT | `prisma/`, `storage/`, `auth/` |

Quy tắc phụ thuộc: chảy vào trong (API → Application → Domain); Domain không phụ thuộc Infrastructure.

## Invariants & Rules

```mermaid
flowchart TD
    Clients["Web (React) / Mobile (Flutter)"] --> API["API layer — controllers"]
    API --> App["Application layer — services"]
    App --> Domain["Domain layer — rules, state machine"]
    App --> Infra["Infrastructure — Prisma, R2, JWT"]
    Infra --> DB[("PostgreSQL")]
    Infra --> R2[("Cloudflare R2")]
```

### AD-1 — Ranh giới client/server: backend là chủ DB duy nhất `[ADOPTED]`

- **Binds:** `all` (FR-1..FR-29)
- **Prevents:** FE query thẳng DB; hai nguồn sự thật; logic rò xuống client.
- **Rule:** Web và Mobile chỉ giao tiếp qua REST API. Mọi truy cập dữ liệu đi qua backend. Chỉ backend giữ credential DB.

### AD-2 — Mọi business rule thực thi ở backend `[ADOPTED]`

- **Binds:** FR-1, FR-3, FR-5, FR-7, FR-8, FR-9, FR-11, FR-12, FR-15, FR-17, FR-18, FR-25, FR-26
- **Prevents:** client tự tính giá/VAT/tồn/quyền rồi lệch với server.
- **Rule:** pricing/VAT, snapshot giá lúc chốt, chuyển trạng thái, phân quyền, tồn kho, duyệt chiết khấu — tất cả tính và quyết ở backend; client chỉ hiển thị kết quả.

### AD-3 — File/ảnh ở Cloudflare R2, không ở đĩa VPS `[ADOPTED]`

- **Binds:** FR-21, FR-23, FR-24
- **Prevents:** phình đĩa VPS; mất file khi rebuild VPS; client truy cập storage không kiểm soát.
- **Rule:** binary lưu R2 (S3-compatible). DB chỉ lưu metadata + object key. Upload/đọc qua backend (signed URL hoặc proxy); không public bucket.

### AD-4 — UI gating theo quyền, backend luôn enforce `[ADOPTED]`

- **Binds:** FR-16, FR-17, FR-18, FR-22
- **Prevents:** coi ẩn/disable ở client là lớp bảo mật; bypass quyền bằng gọi API trực tiếp.
- **Rule:** backend trả **effective permission set** qua `/me` (và khi login) để client ẩn/disable control. Nhưng backend enforce từng quyền server-side ở **mọi** request — client gating chỉ là UX.

### AD-5 — Error envelope thống nhất + xử lý lỗi tập trung `[ADOPTED]`

- **Binds:** `all`
- **Prevents:** mỗi endpoint một kiểu lỗi; FE rải rác try/catch; controller tự nặn envelope lệch shape.
- **Rule:** MỘT shape envelope `{ code, message, fieldErrors?, traceId }` + HTTP status chuẩn, trong đó `code` là **string** lấy từ một **enum mã lỗi có tài liệu**, và `fieldErrors` là `Array<{ field: string, code: string, message: string }>`. Một **exception filter trung tâm** là **nơi DUY NHẤT** tạo envelope — không controller nào tự dựng envelope bằng tay. FE handle ở MỘT chỗ (API interceptor).

### AD-6 — Đơn hợp nhất báo giá + đơn hàng `[ADOPTED]`

- **Binds:** FR-1, FR-5, FR-6, FR-10
- **Prevents:** nhân đôi dữ liệu báo giá ↔ đơn; đứt liên kết lịch sử; hai chủ sở hữu line-item; "bản hiệu lực" suy ra mập mờ theo thời điểm/số đếm.
- **Rule:** báo giá và đơn là MỘT entity `Order`, phân biệt bằng `status`. Line item thuộc về **đúng MỘT chủ sở hữu**: `OrderVersion` sở hữu **TẤT CẢ** line item; `Order` **không** sở hữu line item trực tiếp. `Order.currentVersionId` (FK → `OrderVersion`) là **con trỏ chân lý DUY NHẤT** tới bản hiệu lực; "bản hiệu lực" **không bao giờ** suy ra bằng timestamp hay số đếm version. Mọi lần đọc dòng đơn / tổng tiền đều **phân giải qua `currentVersionId`**. "Chốt" là một transition snapshot giá line-item. Sửa sau chốt = tạo `OrderVersion` mới (không ghi đè), trỏ `currentVersionId` sang bản mới, giữ lịch sử.

### AD-7 — Hybrid state machine gate theo 3 cờ phạm vi `[ADOPTED]`

- **Binds:** FR-7, FR-8, FR-9, FR-23
- **Prevents:** đơn chỉ-thiết-bị vẫn hiện bước thi công/giao hàng; chuyển bước tuỳ tiện.
- **Rule:** vòng đời đơn gate theo cờ Thiết bị/Thi công/Vận chuyển. Một số transition tự nhảy theo sự kiện nghiệp vụ (ghi đủ đợt cọc → Đã cọc); mọi transition đều permission-gated và ghi Audit.

### AD-8 — RBAC theo từng account `[ADOPTED]`

- **Binds:** FR-16, FR-17, FR-18, FR-20
- **Prevents:** đổi định nghĩa Role hồi tố account đã tạo; mọi Admin xem được Audit.
- **Rule:** nguồn chân lý = bộ quyền lưu trên từng Account. Role = preset áp lúc tạo (nạp giá trị, không ràng buộc sau). Quyền xem Audit log chỉ dành cho một account **Super Admin** được chỉ định.

### AD-9 — Khách hàng định danh bằng SĐT `[ADOPTED]`

- **Binds:** FR-29
- **Prevents:** trùng khách; SĐT không nhất quán giữa Đơn/Hợp đồng/Hoá đơn; client chuẩn hoá lệch nhau.
- **Rule:** SĐT là khoá chính của `Customer`, duy nhất toàn hệ thống, với **đúng MỘT định dạng chuẩn = E.164** (`+84…`). Chuẩn hoá **chỉ** diễn ra ở backend domain `customers`; client gửi chuỗi thô, **không bao giờ** tự chuẩn hoá. Tạo đơn tra theo SĐT (FR-29 lookup-or-create) chạy **cùng một bộ chuẩn hoá** trước khi kiểm tra tính duy nhất: trùng → dùng lại; không thấy → tạo mới tại chỗ.

### AD-10 — Tiền lưu integer minor units (đồng) `[ADOPTED]`

- **Binds:** FR-3, FR-5, FR-11, FR-12, FR-27
- **Prevents:** sai số float; lệch tổng tiền/VAT/đợt thanh toán.
- **Rule:** mọi giá trị tiền là **integer đồng** (không thập phân, không float). Tính VAT/tổng bằng số nguyên; làm tròn theo quy tắc cố định ở Domain.

### AD-11 — State machine tường minh: enum + bảng transition `[ASSUMPTION]`

- **Binds:** FR-7, FR-8, FR-9
- **Prevents:** logic trạng thái rải rác dạng if/else; transition ngầm định không kiểm soát được; `payments/`/`inventory/` tự ghi status; guard/audit trùng lặp.
- **Rule:** trạng thái là enum tường minh; transition hợp lệ khai báo trong một **allowed-transition table** gate theo cờ phạm vi + permission. **MỘT hàm transition DUY NHẤT** thuộc `orders/domain` với chữ ký cố định `applyTransition({order, event, actorPermissions, scopeFlags}) → newState | rejection` là **con đường code DUY NHẤT** ghi `Order.status`; `payments/` và `inventory/` **gọi hàm này** (không bao giờ ghi status trực tiếp). Đây cũng là **nơi duy nhất** đánh giá guard permission + cờ phạm vi và **nơi duy nhất** phát bản ghi Audit. Auto-transition và manual transition dùng **chung một entry point**; auto-transition là hệ quả của sự kiện nghiệp vụ, đi qua cùng bảng này.

### AD-12 — API REST + OpenAPI, Auth JWT access+refresh `[ASSUMPTION]`

- **Binds:** FR-22, `all` (contract API)
- **Prevents:** lệch contract giữa backend và client; sửa tay spec làm spec lệch code; mobile không được ràng vào contract; session không revoke được.
- **Rule:** API là REST. OpenAPI spec được **SINH TỪ backend NestJS** (code là chân lý, spec là **build artifact**), được **versioned + publish** làm **hợp đồng cross-repo DUY NHẤT**; **CẢ web LẪN mobile** đều sinh/validate client dựa trên spec này (mobile cũng vậy, không chỉ web). **Cấm sửa tay** spec. Auth dùng JWT access token (ngắn hạn) + refresh token; `/me` trả effective permission set.

### AD-13 — Design-system-first: một tầng design system trước mọi màn `[ADOPTED]`

- **Binds:** `all` (mọi màn Web + Mobile)
- **Prevents:** web-mobile lệch nhau; mỗi màn style riêng; drift khỏi DESIGN.md.
- **Rule:** tầng design system từ `DESIGN.md` là deliverable **ĐẦU TIÊN**, dựng cho cả hai nền tảng — thư viện component React (web) và thư viện widget Flutter (mobile) — cả hai tuân **cùng một hợp đồng thị giác** DESIGN.md (token màu, style Viền nét, 9 chip trạng thái, bộ icon SVG, topbar/botnav/frame). MỌI màn bắt buộc dùng lại component/token của design system; **cấm style ad-hoc**.

### AD-14 — Firebase mobile + push tập trung `[ADOPTED]`

- **Binds:** FR-30, FR-31, FR-32, FR-33, FR-34
- **Prevents:** business logic rò xuống Remote Config; push logic rải rác khắp service.
- **Rule:** mobile tích hợp Firebase FCM (push), Crashlytics, Analytics, Remote Config. Backend có **một** module `notifications/` gửi push qua `firebase-admin` khi có sự kiện nghiệp vụ + job nhắc theo lịch; entity `DeviceToken` gắn theo `Account` (nhiều token/account). Remote Config **CHỈ** cho config/feature-flag cấp app — **KHÔNG** thay business flag ở backend (vd cờ giá phân tầng vẫn ở DB, là nguồn chân lý nghiệp vụ).

### AD-15 — Đích thông báo xác định theo QUYỀN, không theo role `[ADOPTED]`

- **Binds:** FR-31, FR-34
- **Prevents:** targeting theo role (lệch khi đổi quyền); rò thông tin đơn cho account không có quyền xem; "người phụ trách/được giao" suy diễn lại lệch với bộ lọc "đơn của mình".
- **Rule:** người nhận push xác định theo **QUYỀN** (ma trận phân quyền per-account §4.6, qua AD-8), **KHÔNG** theo role: đẩy cho account có Quyền tương ứng **+** người phụ trách/được giao đơn. Quyền sở hữu/giao đơn định nghĩa bằng **đúng hai trường trên `Order`**: `ownerAccountId` (người tạo/phụ trách) và `assigneeAccountId` (nullable, nếu người được giao khác người tạo). **CẢ** bộ lọc permission "xem đơn của mình" **LẪN** việc chọn đích noti "người phụ trách/được giao" của AD-15 đều phân giải off **chính hai trường này** — một định nghĩa, hai bên tiêu thụ, không suy diễn lại. Luôn lọc theo quyền xem đơn ("xem tất cả đơn" vs "đơn của mình") — không đẩy nội dung đơn cho account không có quyền xem. Đổi ai giữ quyền nào thì người nhận noti tự đổi theo, không sửa cấu hình noti.

### AD-16 — Pricing & VAT: một thuật toán, một bộ tính `[ADOPTED]`

- **Binds:** FR-1, FR-3, FR-5
- **Prevents:** tổng tiền client ≠ backend; lệch giữa làm-tròn-từng-dòng và làm-tròn-trên-tổng; đổi VAT hệ thống làm sai hồi tố đơn đã chốt.
- **Rule:** ghim thuật toán tiền chính xác: `subtotal = Σ(unitPrice × qty)` theo **integer đồng**; `VAT = round-half-up(subtotal × vatRate)` ở mức **GRAND-SUBTOTAL** — **MỘT điểm làm tròn duy nhất**, `vatRate` phân giải **một lần**. Đây là **hàm pricing DUY NHẤT** trong `orders/domain`. Xem trước giỏ hàng realtime (FR-1) tính bằng **CHÍNH hàm backend đó** qua endpoint stateless `POST /orders/preview-total`; client **CẤM** làm số học tiền — chỉ hiển thị integer trả về. Lúc chốt, **snapshot `vatRate` (và `vatMode`) hiệu lực** lên `OrderVersion` để việc đổi rate hệ thống sau này không sửa hồi tố đơn đã chốt.

### AD-17 — Registry quyền chính tắc: một nguồn, ba bên tiêu thụ `[ADOPTED]`

- **Binds:** AD-4, AD-8, AD-15
- **Prevents:** lệch chính tả key quyền giữa ba bên tiêu thụ (FE gating, BE guard, notification resolver); permission literal rải rác ngoài registry.
- **Rule:** **MỘT enum/registry quyền DUY NHẤT** do backend `accounts/domain` sở hữu, publish dưới dạng **artifact sinh tự động**, được **CẢ ba** bên tiêu thụ y hệt nhau: (a) UI gating ở FE, (b) request guard ở BE, (c) notification resolver của AD-15. **Không** permission string literal nào được tồn tại **ngoài** registry. "Xem tất cả đơn" và "đơn của mình" là **hai entry tường minh** trong registry.

### AD-18 — Domain event qua một EventBus port `[ADOPTED]`

- **Binds:** all (mọi hành động nghiệp vụ có hệ quả), AD-14 (notifications)
- **Prevents:** producer gọi FCM/notification trực tiếp; retrofit "gọi push" vào từng chức năng ở cuối dự án; logic side-effect rải rác.
- **Rule:** Mọi hành động nghiệp vụ có hệ quả (chốt, duyệt chiết khấu, ghi cọc/thanh toán, chuyển trạng thái, chặn xuất tồn…) **publish một domain event** qua **MỘT `EventBus` port duy nhất** (định nghĩa ở nền backend, bản đầu no-op/log). Producer **KHÔNG** gọi FCM/notification/audit trực tiếp. Các consumer (notifications gửi push theo AD-15, audit ghi log) **subscribe** port. Port + điểm publish được chừa sẵn ngay khi build mỗi chức năng; bộ gửi lắp sau không cần mở lại code chức năng.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Đặt tên entity | PascalCase entity (`Order`, `OrderLineItem`); bảng snake_case số nhiều (`order_line_items`) |
| Đặt tên file | kebab-case (`orders.service.ts`, `allowed-transition.ts`) |
| REST route | danh từ số nhiều, kebab-case (`/orders/{id}/line-items`); action nghiệp vụ là sub-resource POST (`/orders/{id}/chot`) |
| ID | UUID v4 cho tất cả entity, **trừ** `Customer` (PK = SĐT chuẩn hoá **E.164** `+84…`, chuẩn hoá chỉ ở backend `customers`, AD-9) |
| Ngày giờ | ISO-8601 UTC lưu trong DB; client hiển thị theo giờ VN (UTC+7) |
| Tiền | integer đồng (AD-10); không float, không decimal |
| Error shape | `{ code: string (enum có tài liệu), message, fieldErrors?: Array<{ field, code, message }>, traceId }` + HTTP status; chỉ exception filter trung tâm tạo envelope (AD-5) |
| Auth | JWT access+refresh; Bearer header; `/me` trả permission set (AD-12) |
| Permission enforce | guard server-side mỗi request; client gating chỉ UX (AD-4) |
| Logging / Audit | AuditLog bất biến (ai/gì/đối tượng/khi nào/trước→sau) cho mọi mutation nghiệp vụ; append-only; đọc chỉ Super Admin |
| Idempotency | thao tác tiền (ghi thanh toán, chốt) idempotent, an toàn khi retry (NFR SM-1) |
| Push / Notification | người nhận resolve qua permission engine (AD-8/AD-15), không theo role; payload mang `type` + deep-link (`{ type, targetId, deeplink }`) mở đúng màn/đơn; lọc theo quyền xem đơn (AD-15) |

## Stack

| Name | Version |
| --- | --- |
| Node.js | 24 LTS (Active LTS) |
| NestJS | 11.1.27 |
| PostgreSQL | 18.4 |
| Prisma ORM `[ASSUMPTION]` | 7.8.0 |
| React (Web) | 19.2.7 |
| Flutter (Mobile) | 3.44 |
| Object storage | Cloudflare R2 (S3-compatible) |
| firebase-admin (Node, backend push) | 14.1.0 |
| Flutter Firebase — firebase_core | 4.11.0 |
| Flutter Firebase — firebase_messaging | 16.1.0 |
| Flutter Firebase — firebase_crashlytics | 5.2.4 |
| Flutter Firebase — firebase_analytics | 12.1.1 |
| Flutter Firebase — firebase_remote_config | 6.5.3 |
| Design system (per-platform, built first) | React component lib (web) + Flutter widget lib (mobile), cùng hợp đồng DESIGN.md (AD-13) |

## Structural Seed

### Core-entity ERD

```mermaid
erDiagram
    ACCOUNT ||--o{ ACCOUNT_PERMISSION : has
    PERMISSION ||--o{ ACCOUNT_PERMISSION : "granted in"
    ROLE ||--o{ ROLE_PERMISSION : presets
    PERMISSION ||--o{ ROLE_PERMISSION : "in"
    ACCOUNT }o--|| ROLE : "seeded by"
    ACCOUNT ||--o{ AUDIT_LOG : writes
    ACCOUNT ||--o{ DISCOUNT_APPROVAL : approves
    ACCOUNT ||--o{ ATTACHMENT : uploads
    ACCOUNT ||--o{ DEVICE_TOKEN : registers
    ACCOUNT ||--o{ NOTIFICATION : receives
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--o{ ORDER_VERSION : versions
    ORDER ||--o| ORDER_VERSION : "current version"
    ORDER_VERSION ||--o{ ORDER_LINE_ITEM : owns
    ORDER ||--|| PAYMENT_SCHEDULE : has
    PAYMENT_SCHEDULE ||--o{ INSTALLMENT : "split into"
    INSTALLMENT ||--o{ PAYMENT : "recorded by"
    ORDER ||--o{ CONTRACT : generates
    ORDER ||--o{ INVOICE : generates
    ORDER ||--o{ DISCOUNT_APPROVAL : requests
    ORDER ||--o{ ATTACHMENT : has
    ORDER ||--o{ STOCK_VOUCHER : "issue for"
    PRODUCT ||--o{ PRODUCT_PRICE : "tiered by"
    PRODUCT ||--o{ ORDER_LINE_ITEM : "referenced by"
    PRODUCT ||--|| STOCK_ITEM : "stock of"
    PRODUCT ||--o{ STOCK_VOUCHER_LINE : moves
    STOCK_VOUCHER ||--o{ STOCK_VOUCHER_LINE : contains
    ORDER {
        uuid id
        string status
        uuid currentVersionId FK
        uuid ownerAccountId FK
        uuid assigneeAccountId FK
        bool scopeThietBi
        bool scopeThiCong
        bool scopeVanChuyen
        string custType
        int kWp
        string vatMode
    }
    ORDER_VERSION {
        uuid id
        uuid orderId FK
        int versionNo
        int vatRate
        string vatMode
        datetime chotAt
    }
    ORDER_LINE_ITEM {
        uuid id
        uuid orderVersionId FK
        int unitPriceSnapshot
        int qty
    }
    CUSTOMER {
        string sdt PK
        string custType
    }
    DEVICE_TOKEN {
        uuid id
        uuid accountId FK
        string fcmToken
        string platform
        datetime createdAt
    }
    NOTIFICATION {
        uuid id
        uuid accountId FK
        string type
        string payload
        string deeplink
        bool read
        datetime createdAt
    }
```

### Order state machine (gate theo cờ phạm vi)

```mermaid
stateDiagram-v2
    state "Báo giá (nháp)" as BaoGia
    state "Chờ duyệt chiết khấu" as ChoDuyet
    state "Đã chốt" as DaChot
    state "Đã cọc" as DaCoc
    state "Lên lịch thi công" as LenLich
    state "Đang thi công" as DangTC
    state "Nghiệm thu" as NghiemThu
    state "Đang giao hàng" as DangGiao
    state "Đã giao" as DaGiao
    state "Hoàn thành" as HoanThanh
    state "Huỷ" as Huy
    [*] --> BaoGia
    BaoGia --> ChoDuyet : áp chiết khấu
    ChoDuyet --> BaoGia : từ chối
    ChoDuyet --> DaChot : duyệt then Chốt
    BaoGia --> DaChot : Chốt (snapshot giá)
    DaChot --> DaCoc : auto (đủ đợt cọc)
    DaCoc --> LenLich : cờ Thi công
    LenLich --> DangTC
    DangTC --> NghiemThu
    DaCoc --> DangGiao : cờ Vận chuyển
    DangGiao --> DaGiao
    NghiemThu --> HoanThanh
    DaGiao --> HoanThanh
    DaChot --> HoanThanh : chỉ Thiết bị (đủ tiền)
    BaoGia --> Huy
    DaChot --> Huy
    DaCoc --> Huy
    HoanThanh --> [*]
    Huy --> [*]
```

### Deployment / container

```mermaid
flowchart LR
    subgraph ClientTier["Client (online-only)"]
        Web["Web SPA (React) — static host"]
        Mobile["Mobile app (Flutter)"]
    end
    subgraph VPS["VPS"]
        API["Backend API (NestJS)"]
        DB[("PostgreSQL")]
    end
    R2[("Cloudflare R2 — object storage")]
    Web -- "HTTPS REST" --> API
    Mobile -- "HTTPS REST" --> API
    API -- "SQL (Prisma)" --> DB
    API -- "signed URL / proxy" --> R2
    Web -. "signed URL GET/PUT" .-> R2
    Mobile -. "signed URL GET/PUT" .-> R2
```

### Backend module tree (NestJS)

```text
backend/
  src/
    common/         # error envelope, exception filter, interceptors, guards (AD-4, AD-5)
    auth/           # JWT access+refresh, /me effective permissions (AD-12)
    accounts/       # Account, Role preset, Permission matrix (AD-8)
    customers/      # Customer, SĐT là PK (AD-9)
    catalog/        # Product + tiered price (FR-14, FR-15)
    orders/         # Order hợp nhất, line items, versions, state machine, snapshot (AD-6, AD-7, AD-11)
    discounts/      # DiscountApproval (FR-18)
    payments/       # PaymentSchedule, Installment, Payment; auto-transition trigger (FR-11, FR-12, FR-8)
    contracts/      # sinh HĐ Thi công / Mua bán → PDF (FR-13)
    invoices/       # Invoice (DB + PDF) (FR-27, FR-28)
    inventory/      # StockItem, StockVoucher(+lines), chặn xuất quá tồn (FR-25, FR-26)
    attachments/    # R2 upload/proxy + metadata (AD-3)
    audit/          # AuditLog append-only, đọc chỉ Super Admin (FR-20)
    notifications/  # FCM sender qua firebase-admin, DeviceToken registry, Notification inbox, nhắc theo lịch (cần job scheduler, vd NestJS Schedule/cron); người nhận resolve qua permission engine (AD-14, AD-15, FR-30..34)
    dashboard/      # doanh thu / đếm đơn theo trạng thái (FR-19)
    prisma/         # PrismaService — điểm truy cập DB duy nhất (AD-1)
    storage/        # R2 client wrapper (AD-3)
```

## Capability → Architecture Map

| Capability / Area (PRD) | Lives in | Governed by |
| --- | --- | --- |
| Báo giá kiêm đơn / giỏ hàng (FR-1..6) | `orders/` | AD-2, AD-6, AD-10, AD-11, AD-16 |
| VAT & tổng tiền (FR-3) | `orders/domain` (pricing) | AD-2, AD-10, AD-16 |
| Vòng đời & trạng thái (FR-7..10) | `orders/` state machine | AD-7, AD-11 |
| Thanh toán nhiều đợt (FR-11, FR-12) | `payments/` | AD-2, AD-7, AD-10 |
| Sinh hợp đồng (FR-13) | `contracts/` | AD-3 (PDF ở R2) |
| Danh mục vật tư & giá (FR-14, FR-15) | `catalog/` | AD-2, AD-10 |
| Phân quyền & tài khoản (FR-16..18) | `accounts/`, `auth/` | AD-4, AD-8, AD-17 |
| Dashboard & báo cáo (FR-19) | `dashboard/` | AD-4 |
| Audit log (FR-20) | `audit/` | AD-8 |
| Xuất & chia sẻ báo giá (FR-21) | `orders/`, `storage/` | AD-3 |
| Đăng nhập & phiên (FR-22) | `auth/` | AD-4, AD-12 |
| Đính kèm ảnh (FR-23, FR-24) | `attachments/` | AD-3 |
| Quản lý tồn kho (FR-25, FR-26) | `inventory/` | AD-2 |
| Hoá đơn (FR-27, FR-28) | `invoices/` | AD-3, AD-10 |
| Quản lý khách hàng (FR-29) | `customers/` | AD-9 |
| Thông báo đẩy (FR-30..34) | `notifications/` + entity `DeviceToken`/`Notification` | AD-14, AD-15; người nhận resolve qua permission engine (AD-8/AD-15) |
| Design system per-platform (mọi màn) | React component lib (web) + Flutter widget lib (mobile) | AD-13 |
| Xử lý lỗi & audit xuyên suốt | `common/`, `audit/` | AD-5, AD-8 |

## Deferred

- **Danh sách tên trạng thái cuối cùng** — khung state machine đã duyệt; verbatim label + mapping "đợt thanh toán → trạng thái" chi tiết chốt khi làm epics (§4.2, FR-8). State ở đây theo EXPERIENCE.md, chưa phải danh sách khoá.
- **Giới hạn định dạng/dung lượng ảnh** — nơi lưu đã chốt (R2, AD-3); giới hạn kích thước/định dạng + nén để lại cho implementation (FR-24).
- **CI/CD & môi trường triển khai** — VPS provider, pipeline, container/orchestration cụ thể chưa quyết (solo dev, ưu tiên đơn giản).
- **Monitoring / backup** — chiến lược backup Postgres, retention R2, alerting để lại cho vận hành.
- **Chi tiết OpenAPI codegen & auth token TTL** — access/refresh TTL, rotation, revocation cụ thể chốt ở implementation (AD-12).
- **Web push (trình duyệt)** — Phase sau; Phase 1 web dùng hộp thư in-app + badge, chưa push trình duyệt (§4.14, FR-31/32).
- **Ngưỡng thời gian nhắc theo lịch** — báo giá "sắp hết hiệu lực" báo trước bao lâu (noti #11) và "lead nguội" sau bao nhiêu ngày (noti #12) chốt khi làm epics (FR-34).
- **Chọn job scheduler** — NestJS Schedule vs cron ngoài vs queue cho job nhắc lịch để lại cho implementation (FR-34).
