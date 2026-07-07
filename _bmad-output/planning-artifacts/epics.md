---
stepsCompleted: ['step-01', 'step-02', 'step-03', 'step-04']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md
---

# Phương Nam Solar — Phase 1 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Phương Nam Solar — Phase 1, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: Create and build an Order (cart-style): authorized user creates a new Order, picks Customer + Customer type, and adds/edits/removes line items (catalog-referenced or free-text/package lines), with subtotal/VAT/total recalculating instantly on every quantity/line change without manual save.
FR-2: Scope flags & Customer type: Customer type loads default scope-flag preset (Cá nhân = all 3 flags on: Thiết bị/Thi công/Vận chuyển; Thương mại = only Thiết bị on), and each flag is independently toggleable per Order while type is retained as a reporting label.
FR-3: VAT & totals: Order computes and displays subtotal / VAT amount / total-after-VAT; VAT rate is configurable (default 8%) with a per-Order "apply VAT or not" tick that zeroes tax when unchecked.
FR-4: Order metadata: Order stores kWp capacity and quote validity period (e.g. "48h from PO date"), displayed on the quote (Phase 1 display-only, no auto-lock/reminder on expiry).
FR-5: Chốt (finalize) Order & price snapshot: authorized user finalizes to "Đã chốt"; the system snapshots every line's unit price so later catalog price edits do not change finalized-order prices, while pre-finalize orders always take latest catalog prices.
FR-6: Edit finalized Order (new version + history): reopening a finalized Order creates a new update version instead of overwriting; the Order detail page shows the full version history (who/when/what), re-snapshots prices on re-finalize, and the latest version is the effective one.
FR-7: Scope-flag-gated state machine: the system only allows/shows lifecycle steps valid for the Order's scope flags (no construction steps without Thi công flag; no delivery steps without Vận chuyển flag; equipment-only order goes Báo giá → Đã chốt → payment → Hoàn thành).
FR-8: Event-driven state transitions: certain statuses auto-advance on the matching business event (e.g. recording the full first deposit installment auto-moves the Order to "Đã cọc"), with installment→status mapping configured per payment schedule.
FR-9: Manual transitions + approval (permission-controlled): only accounts with the corresponding permission perform human-driven steps; approval-gated steps require an account with approval permission; every transition writes an Audit log entry (who/when/from→to).
FR-10: Follow-up watchlist: unfinalized "Báo giá" Orders appear in a follow-up list that can be filtered/viewed for nurturing, never auto-deleted or hidden.
FR-11: Configure payment schedule: authorized user defines installments (percentage or fixed amount + condition text), supporting multi-installment templates (e.g. 20/70/10), single 100%, or custom; the installments' sum must equal total-after-VAT (warn on mismatch).
FR-12: Record payment: authorized user records money per installment, updating the Order's payment status, writing Audit log, and possibly auto-advancing status (FR-8).
FR-13: Generate Construction/Sales contract: authorized user generates a contract from an Order (Thi công flag → HĐ Thi công; equipment-only → HĐ Mua bán), auto-filled with parties, line items/prices, total, payment schedule, quote reference, exported as PDF from a static-template with fixed clauses (only dynamic data filled).
FR-14: CRUD Products & prices: authorized user adds/edits/removes Products and updates prices at any time; changes reflect immediately in in-progress (unfinalized) quotes, never retroactively for finalized orders (FR-5), and all product/price changes write Audit log.
FR-15: Tiered pricing (behind a flag): system supports retail/wholesale prices hidden behind an on/off flag (default off); off = one price per product; on = price tier selectable by context (e.g. by Customer type).
FR-16: Account management: Admin creates/edits/deactivates Accounts, selecting a Role preset at creation to load the default permission set.
FR-17: Per-account permissions (override preset): the effective permission set is stored on the Account; applying a Role preset only loads values, after which individual permissions can be ticked/unticked; editing one Account's permissions does not affect other Accounts of the same Role, and changing a Role preset later does not retroactively change existing Accounts.
FR-18: Configurable permissions for actions & approvals: each status-transition permission and each approval permission (discount + other approval-gated steps) is a configurable matrix entry (not hardcoded); "view all orders" vs "view only my orders" is one matrix permission; every discount requires approval by an account with discount-approval permission (no self-approval limit), and a pending approval auto-pushes to approvers (FR-31).
FR-19: Operations dashboard: authorized user views revenue by day/week/month, order counts, and order totals grouped by status; only accounts with financial-dashboard permission see revenue figures.
FR-20: Write & query Audit log: the system records every data-mutating action (create/edit/delete, transition, approval, payment, price change) with who/what/object/when/before→after; records are immutable (no edit/delete); only the designated Super Admin account may view the Audit log.
FR-21: Export & share quote: after finalize (and when needed), the user exports the quote (PDF or preferentially an IMAGE) and shares via the system native share bottom sheet (web: share/download similarly); exports carry signature blocks (preparer/director) plus company logo and info per the real template.
FR-22: Login & session: user logs in; the session applies the Account's exact effective permission set; UI hides/shows features by effective permission; app is online-only (no offline mode in Phase 1).
FR-23: Attach images on transition: when performing a status transition, the user may attach zero or more images as evidence for that step; images bind to the exact transition (order, from→to, timestamp) and are recorded in that transition's Audit log; upload is always optional at every step.
FR-24: Attach supplementary images in Order detail: authorized user adds/removes attachments in the Order detail outside the transition flow; all Order images (per-step + supplementary) are viewable with timestamp + uploader; deletion is restricted to the uploader or an account with order-edit permission; add/delete writes Audit log; mobile captures directly or picks from gallery, web picks a file.
FR-25: Stock in/out & inventory: authorized user creates stock vouchers (in/out) updating per-Product on-hand quantity; stock-in increases, stock-out decreases; current on-hand is viewable per Product; every voucher writes Audit log (who/when/qty/product).
FR-26: Stock-out linked to Order: a stock-out voucher can be linked to an Order (material delivery / construction issue), created from the Order's material lines; when on-hand is insufficient the system WARNS and BLOCKS (no over-issue); Phase 1 manages a single warehouse.
FR-27: Create Invoice from Order: authorized user creates an Invoice for an Order, pulling customer (tax code/MST), lines, VAT, and total from the Order; stores the Invoice (internal invoice number, date, order link) and writes Audit log.
FR-28: View & export Invoice: authorized user reviews a created Invoice (number, date, total) and exports/shares it as PDF.
FR-29: Customer management (phone as primary key): authorized user creates/edits/looks-up Customers with SĐT (phone) as the unique system-wide primary key; Cá nhân stores name/CCCD/address/phone, Thương mại stores name/MST/address/phone/bank account; during order creation a phone lookup either reuses the matched Customer (pre-filling data) or shows "Create new customer" inline; duplicate phones are blocked; Customer data flows into Orders (FR-1), Contracts (FR-13), and Invoices (FR-27).
FR-30: Register device for push: an Account registers/removes an FCM Device token on login/logout; one Account may hold many Device tokens; invalid/logged-out tokens are removed.
FR-31: Event-based notification dispatch: the system sends push to the correct recipients per the notification matrix when an event occurs; recipients are resolved by PERMISSION (per-account matrix §4.6), NOT by role, plus the order's owner/assignee; content is never pushed to accounts lacking view permission for that order (filtered by "view all orders" vs "my orders"); each notification carries a deep-link to the relevant screen/order.
FR-32: In-app inbox: an Account views notification history in-app, with read/unread state and an unread-count badge, stored per account.
FR-33: Notification preferences: an Account enables/disables push per notification type.
FR-34: Scheduled reminders: a background job emits notification #11 (quote nearing expiry) and #12 (cold lead) per configurable time thresholds.

### NonFunctional Requirements

NFR-1: Reliability (priority #1): integrity of all money/price/order data with no data loss; financial operations are idempotent and safe to retry; this is the primary acceptance criterion (SM-1 — target zero critical business errors in real operation).
NFR-2: Data correctness: business flows run smoothly and data sent out is exactly correct, driving quote-error rate (wrong item/quantity/price) toward zero (SM-3).
NFR-3: Realtime cart performance: the cart total (subtotal/VAT/total) updates instantly on every line change.
NFR-4: Field mobile usability: the app runs smoothly on a phone in the field; totals and the Chốt button are readable under outdoor sunlight; touch targets ≥ 48dp/44pt for gloved/rapid rooftop use.
NFR-5: Speed target: reduce quote turnaround from ~2 days to within a single survey visit (minutes) (SM-2).
NFR-6: Security — authentication & JWT session: login required; JWT access + refresh tokens; session applies the Account's exact permission set.
NFR-7: Security — per-request permission enforcement: backend enforces every permission server-side on every request; client hide/disable gating is UX only and never trusted as a security layer.
NFR-8: Security — moderate posture with immutable audit: internal ~20-user tool not exposed externally; append-only immutable Audit log as the transparency/evidence backbone.
NFR-9: Shared design system consistency: Web (React) and Mobile (Flutter) share one design system — same tokens, same component language; the same screen is recognizable on both platforms.
NFR-10: Scale & infrastructure: ~20 internal users on a single VPS; solo-dev build team, so favor simplicity and minimal complex-infrastructure dependencies.
NFR-11: Online-only: the app requires network connectivity; no offline mode in Phase 1.
NFR-12: Language: the entire interface is Vietnamese; status labels are verbatim business nouns from the Glossary.
NFR-13: Adoption target: 20/20 employees use the app instead of Excel for all new quotes (SM-4), with zero audit/approval steps skipped for speed (SM-C1).

### Additional Requirements

- **STARTER / BUILD-ORDER: design-system-first (AD-13) — build the shared design-system libraries FIRST, before any feature screen.** Deliver a React component library (web) and a Flutter widget library (mobile), both conforming to the single DESIGN.md visual contract (color tokens, "Viền nét" flat/no-shadow style, the 9 status chips, the SVG icon sprite, topbar/bottom-nav/frame). Every feature screen must reuse design-system components/tokens; ad-hoc styling is forbidden.
- PostgreSQL 18.4 + NestJS 11 backend is the SOLE owner of the database and all business logic (AD-1); clients never touch the DB or hold business rules; only the backend holds DB credentials.
- All business rules execute on the backend (AD-2): pricing/VAT, price snapshot on finalize, transitions, permissions, inventory, discount approval — computed and decided server-side; clients only display results.
- REST API with OpenAPI generated FROM the backend as the single versioned cross-repo contract (AD-12); spec is a build artifact (code is truth), hand-editing forbidden; BOTH web and mobile generate/validate their clients from this spec.
- Auth via JWT access token (short-lived) + refresh token; `/me` returns the effective permission set (AD-12); UI gating derives from `/me`, backend still enforces per request (AD-4).
- Files/images stored on Cloudflare R2 (S3-compatible), not on VPS disk (AD-3); DB stores only metadata + object key; upload/read via backend signed URL or proxy; no public bucket.
- Single `applyTransition({order, event, actorPermissions, scopeFlags})` function in `orders/domain` is the ONLY code path that writes `Order.status`; `payments/` and `inventory/` call it (never write status directly); it is the sole place evaluating permission/scope guards and the sole place emitting transition Audit records; auto- and manual transitions share this one entry point (AD-7, AD-11).
- Explicit state machine: status is an explicit enum with an allowed-transition table gated by scope flags + permission (AD-11).
- Single pricing/VAT function in `orders/domain` (AD-16): `subtotal = Σ(unitPrice × qty)` in integer đồng; `VAT = round-half-up(subtotal × vatRate)` at grand-subtotal level with ONE rounding point and vatRate resolved once; realtime cart preview uses this SAME backend function via stateless `POST /orders/preview-total`; clients are forbidden from doing money arithmetic; effective vatRate + vatMode snapshotted onto OrderVersion at finalize so later system-rate changes are not retroactive.
- Canonical Permission registry (AD-17): ONE permission enum/registry owned by backend `accounts/domain`, published as a generated artifact, consumed identically by (a) FE UI gating, (b) BE request guards, (c) the AD-15 notification resolver; no permission string literal may exist outside the registry; "view all orders" and "my orders" are two explicit registry entries.
- Per-account RBAC (AD-8): source of truth is the permission set on each Account; Role is a preset applied at creation only; Audit-log view permission belongs only to a designated Super Admin account.
- Firebase on mobile: FCM (push), Crashlytics, Analytics, Remote Config (AD-14); Remote Config is ONLY for app-level config/feature-flags, never business flags (business flags stay in DB as the source of truth).
- Backend `notifications/` module sends push via `firebase-admin` on business events + a scheduled reminder job (needs a job scheduler, e.g. NestJS Schedule/cron); entity `DeviceToken` bound to Account (many tokens/account); `Notification` inbox entity per account (AD-14).
- Notification targeting resolved by PERMISSION not role (AD-15): owner/assignee defined by exactly two `Order` fields — `ownerAccountId` and nullable `assigneeAccountId`; both the "my orders" permission filter and the notification owner/assignee target resolve off these same two fields (one definition, two consumers); always filtered by order-view permission.
- Unified error envelope `{ code (documented enum string), message, fieldErrors?: Array<{field, code, message}>, traceId }` + standard HTTP status; ONE central exception filter is the only place that builds the envelope (no controller builds it by hand); FE handles it in ONE place (API interceptor) (AD-5).
- Unified quote–order entity `Order` distinguished by `status` (AD-6); `OrderVersion` owns ALL line items (`Order` does not own line items directly); `Order.currentVersionId` (FK → OrderVersion) is the SINGLE source-of-truth pointer to the effective version — never inferred from timestamp or version count; all line/total reads resolve through `currentVersionId`; finalize is a price-snapshot transition; post-finalize edit creates a new OrderVersion (no overwrite) and repoints `currentVersionId`.
- Customer phone (SĐT) normalized to E.164 (`+84…`) BACKEND-ONLY in `customers` domain (AD-9); clients send raw strings and never normalize; the FR-29 lookup-or-create runs the same normalization before the uniqueness check; `Customer` PK is the normalized phone (all other entities use UUID v4).
- All money values are integer đồng — no float, no decimal (AD-10); VAT/total computed with integers; rounding by a fixed Domain rule.
- Immutable append-only Audit log (who/what/object/when/before→after) for every business mutation; read only by Super Admin (AD-8, FR-20).
- Three separate clients/repos: backend API (NestJS), React web app, Flutter mobile app — web/mobile are pure REST clients rendering + calling the API.
- Dates stored ISO-8601 UTC; clients display Vietnam time (UTC+7). Naming conventions: PascalCase entities, snake_case plural tables, kebab-case files, plural-noun REST routes with business actions as POST sub-resources (e.g. `/orders/{id}/chot`).
- Deferred to implementation (not blocking story extraction): final status label list + installment→status mapping detail; image size/format limits; CI/CD & VPS provider; monitoring/backup; token TTL/rotation; web browser push (Phase later); scheduled-reminder time thresholds; job scheduler choice.

### UX Design Requirements

UX-DR-1: Implement the "Năng Lượng Sạch" color token set exactly as canonical hex (teal `#0E9F8E`, teal-700 `#0B8578`, teal-050 `#E6F6F4`, lime `#A3E635`, lime-600 `#7DB800`, lime-050 `#F1FBDD`, ink `#0C1F1C`, ink-2 `#334E49`, muted `#4E6B66`, line `#DBEBE7`, bg `#F4FAF8`, surface `#FFFFFF`, surface-2 `#ECF6F3`, semantic ok/warn/danger/info) as shared design tokens on both platforms.
UX-DR-2: Implement the spacing scale (4/6/8/12/16/22/26px, gutter 12px, page-x 22px, pscroll 12px) and radius scale (sm 8px, DEFAULT 10px, lg 12px, full 9999px) as shared tokens; pill (full) is reserved for chips/pills only.
UX-DR-3: Implement the typography role scale as tokens: Display 23px/900/-.02em, Title 15px/800/-.01em, Body 13.5px/400/1.42, Meta 11–12.5px/600–700, Micro 10px/800/.1em uppercase teal; money/quantity/order-code use `.mono` tabular-nums right-aligned.
UX-DR-4: Enforce the "Viền nét" (blueprint) elevation rule: absolutely flat, NO drop-shadows or gradients; hierarchy comes only from 1.5px borders (line → teal/ink) and background tone steps (bg → surface → surface-2); modals/sheets float via a 1.5px ink border, not shadow.
UX-DR-5: Build the Button component with all variants: outline default (teal 1.5px border, white bg, teal-700 800 text), `--primary` (teal bg, white text), `--accent` (lime-050 bg, lime border), `--ghost` (line border), `--danger` (red border/text), and sizes `--sm` and `--wide`.
UX-DR-6: Build the Card and Frame components: Card (white bg, line border, lg radius); Frame (ink 1.5px border with a floating micro-uppercase `.frame-label` on the border — the technical-drawing motif).
UX-DR-7: Build the Chip / Status-chip component: full-radius pill, 1.5px border, 11px/700 text, 6px `.dot` matching text color; plus `.ktype` (customer-type, lime border) and `.scope-flag` (on = teal, off = dim strikethrough) variants.
UX-DR-8: Implement all 9 canonical order-status chips with their exact bg/fg/border hex triplets and verbatim labels — Báo giá, Chờ duyệt, Đã chốt, Đã cọc, Đang thi công, Nghiệm thu, Đang giao, Hoàn thành, Huỷ — as the only allowed status colors (no new/altered status hex).
UX-DR-9: Build the Field component: 1.5px line border, DEFAULT radius, focus border→teal (no glow), micro-uppercase muted `.flabel` above; include `.field-lg` for login forms.
UX-DR-10: Build the Table component: dense, header bg surface-2 + micro uppercase, cell bottom-border line 1px, zebra rows `#F7FBFA`, numeric columns right-aligned (`.num`), strong values bold ink.
UX-DR-11: Build the Stepper component: 26px round nodes joined by 1.5px bars; `done` = solid teal white check, `current` = teal border + teal-050 ring, `gate` = dashed dim border; micro step labels under nodes; gated (inapplicable) steps are HIDDEN entirely, not grayed-disabled.
UX-DR-12: Build the KPI component: line border lg radius, micro-uppercase label + 23px/900 display value + `ok`-colored delta; `.accent` variant (teal border, teal-050 bg).
UX-DR-13: Build the Banner component: 1.5px border + soft semantic bg (default warn/orange, `--info` teal, `--danger` red) with a left SVG icon.
UX-DR-14: Build the mobile Topbar: back button (bordered, sm radius) + 15px/800 title (optional micro eyebrow) + right teal-700 action; ink 1.5px bottom border.
UX-DR-15: Build the Bottom-nav with a hard-locked 5 tabs — Trang chủ · Đơn hàng · ➕Tạo báo giá (FAB) · Kho · Menu — where the FAB is a 46px round teal button with 3px white ring + teal-700 1.5px ring, raised `-22px` above the bar, thin SVG `ic-plus`; active tab text+icon turns teal; auth screens have no bottom-nav.
UX-DR-16: Build the Web Sidebar + Web frame: fixed 186px surface-2 sidebar (brand + navlinks with active = teal border + white bg + micro-uppercase `.navsec` groups) and a faux browser chrome frame (chrome + 3 dots + url pill) wrapping `.web-app`; toolbar with SVG-icon search, segmented `.seg` control (active teal bg), teal-underline tabs.
UX-DR-17: Build the Phone frame presentation shell (body `#0C1512` 40px radius, glass 32px radius 700px tall, notch, faux status bar) for the mobile version of each screen.
UX-DR-18: Implement the inline SVG icon sprite system (Lucide-style thin-line, self-contained, zero external refs): define once as `<symbol id="ic-*">`, use via `<svg class="icn"><use href="#ic-*"/></svg>`, `stroke:currentColor` / `stroke-width:2` / `fill:none`; size variants 18/22/16/15/14/13px; provide the named symbol set (ic-home, ic-orders, ic-invoice, ic-inventory, ic-warehouse, ic-menu, ic-customer, ic-users, ic-user, ic-product, ic-catalog, ic-payment, ic-contract, ic-audit, ic-permissions, ic-status, ic-plus, ic-minus, ic-check, ic-close, ic-edit, ic-trash, ic-copy, ic-send, ic-share, ic-download, ic-external, ic-refresh, ic-search, ic-filter, ic-sort, ic-more, ic-bell, ic-mail, ic-phone, ic-camera, ic-image, ic-file, ic-clock, ic-info, ic-alert, ic-warning/ic-ban, ic-chevron-left/right/down, ic-sun); no emoji or raster icons.
UX-DR-19: Implement the list-state patterns with Vietnamese microcopy: Loading = skeleton rows matching layout; Empty = short Vietnamese sentence + primary action (e.g. "Chưa có đơn nào. Bấm ➕Tạo để bắt đầu."); Error = specific message + "Thử lại"; Confirm = consequence-stating dialog (e.g. "Chốt sẽ đóng băng giá"); phone-search-empty = "SĐT chưa có trong hệ thống." + inline "Tạo khách hàng mới" button.
UX-DR-20: Implement the Bottom-sheet vs Dialog rule: bottom sheet (mobile) for quick choices / native share; Dialog (web + mobile) for consequential money/data actions (Chốt, Huỷ, Duyệt, record payment); overlays stack at most one level.
UX-DR-21: Implement the native share sheet for quote sharing (system native share, preferring the quote IMAGE, or PDF; web = equivalent share/download).
UX-DR-22: Implement permission-based UI gating (FR-22): show/hide features by the Account's effective permission (no gray-disabled clutter); forbidden surfaces simply do not appear in nav; Audit log menu hidden from all but Super Admin; "view all orders" vs "my orders" governs the order-list scope; both platforms derive gating from the backend `/me` permission set.
UX-DR-23: Status chip is read-only — never tap a chip to change status; status changes go through the dedicated transition screen; steppers reflect scope-gated lifecycle.
UX-DR-24: Cart line-item behavior: editing quantity/unit-price recalculates the total immediately with no manual save; catalog-picked lines auto-fill unit price from current catalog; free-text/package lines are hand-entered; "linh động/dự kiến" flag is display-only (no pricing effect); support swipe/button line delete.
UX-DR-25: Image upload UX: mobile captures directly or picks from gallery, web picks a file; upload is always optional at every transition and in order detail.
UX-DR-26: Accessibility floor: touch targets ≥ 48dp/44pt; outdoor-readable contrast (ink on surface holds AA; status chips carry text labels, not color-only); web keyboard support (Tab reading order, Esc closes top dialog/sheet, full keyboard forms); labeled form fields + `aria-label` on icon-only buttons (share/back/FAB); money/VAT fully readable at large text sizes.
UX-DR-27: Both platforms conform to DESIGN.md as one shared design system (same tokens, same components); the same business screen must be recognizable on web and mobile, differing only in frame (browser chrome vs phone frame) and navigation (sidebar vs bottom-nav); every business screen has full web+mobile parity.

### FR Coverage Map

### FR Coverage Map

- FR-1..FR-6: Epic 4 — Báo giá/giỏ hàng, cờ phạm vi, VAT, chốt+snapshot, versioning
- FR-7, FR-8, FR-9, FR-10: Epic 5 — máy trạng thái, auto-transition, danh sách/follow-up
- FR-11, FR-12: Epic 7 — lịch thanh toán + ghi nhận
- FR-13: Epic 7 — sinh hợp đồng
- FR-14, FR-15: Epic 3 — danh mục vật tư + giá phân tầng
- FR-16, FR-17, FR-18: Epic 8 — phân quyền/account (engine ở Epic 2)
- FR-19: Epic 8 — dashboard
- FR-20: Epic 8 — audit log (màn xem); ghi audit cross-cutting E3–E7
- FR-21: Epic 4 — xuất PDF + share
- FR-22: Epic 1 (UI đăng nhập demo) + Epic 2 (auth thật + quyền)
- FR-23, FR-24: Epic 5 — đính kèm ảnh
- FR-25, FR-26: Epic 6 — tồn kho + phiếu kho + chặn thiếu tồn
- FR-27, FR-28: Epic 7 — hoá đơn (DB + PDF)
- FR-29: Epic 3 — khách hàng (SĐT khoá chính)
- FR-30, FR-31, FR-32, FR-33, FR-34: Epic 9 — thông báo đẩy


## Epic List

## Epic List

### Epic 1: Design System & App Shell (làm trước — AD-13)
Dựng tầng design system từ DESIGN.md cho CẢ web lẫn mobile trước mọi màn tính năng: token → thư viện component React (web) → thư viện widget Flutter (mobile) → app shell (topbar, bottom-nav 5-tab + FAB, sidebar, frame, icon SVG sprite) → màn Đăng nhập dựng thật để chứng minh design system dùng được. Ship kèm 1 màn, không phải thư viện treo kệ.
**FRs covered:** FR-22 (UI đăng nhập, demo) · UX-DR-1..27

### Epic 2: Nền tảng Backend & Đăng nhập/Quyền
Backend skeleton (NestJS + PostgreSQL + OpenAPI sinh-từ-code + error-envelope + central error handler); xác thực JWT access+refresh thật; permission registry + endpoint /me + UI gating theo quyền; quên mật khẩu; hồ sơ. CHỪA SẴN **Domain Event port + Notification dispatcher (no-op/log)** để các epic sau publish event — producer không gọi FCM trực tiếp.
**FRs covered:** FR-22

### Epic 3: Danh mục vật tư & Khách hàng
CRUD sản phẩm + giá phân tầng (sau cờ); CRUD khách hàng (SĐT E.164 khoá chính) + tra SĐT chọn/tạo mới inline.
**FRs covered:** FR-14, FR-15, FR-29

### Epic 4: Báo giá, Chốt & Duyệt chiết khấu (trái tim)
Giỏ hàng + cờ phạm vi + VAT qua /orders/preview-total; chốt + snapshot giá; sửa đơn = bản update + lịch sử; xuất PDF + share ảnh; chọn/tạo khách inline; áp + duyệt chiết khấu. Mỗi hành động **publish domain event** (OrderConfirmed, DiscountRequested/Resolved…).
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-21

### Epic 5: Vòng đời đơn & Thi công (nhánh cá nhân)
applyTransition engine gate theo cờ + auto-transition; danh sách đơn (+ follow-up + empty/loading/error); chi tiết đơn (stepper + tabs + lịch sử bản update); chuyển trạng thái + đính kèm ảnh (optional); huỷ đơn; nhánh Thi công (Khảo sát→Lên lịch→Đang thi công→Nghiệm thu). **Publish StatusChanged event.**
**FRs covered:** FR-7, FR-8, FR-9, FR-10, FR-23, FR-24

### Epic 6: Giao hàng & Tồn kho (nhánh bỏ mối)
Nhánh Giao hàng (Đang giao→Đã giao) dùng lại engine E5; tồn kho hiện tại; phiếu nhập/xuất; xuất kho gắn đơn; chặn khi thiếu tồn (**publish StockOutBlocked event**).
**FRs covered:** FR-25, FR-26

### Epic 7: Thanh toán, Hợp đồng & Hoá đơn
Lịch thanh toán nhiều đợt; ghi nhận đợt → auto chuyển trạng thái (**publish DepositRecorded/PaymentRecorded event**); sinh HĐ Thi công/Mua bán (PDF); tạo hoá đơn (lưu DB + PDF).
**FRs covered:** FR-11, FR-12, FR-13, FR-27, FR-28

### Epic 8: Quản trị — Dashboard, Phân quyền & Audit
Dashboard doanh thu/đơn theo trạng thái; màn phân quyền (ma trận per-account + áp preset role) + form account; màn xem Audit log (chỉ Super Admin). (Ghi audit là cross-cutting, nhúng ở E3–E7.)
**FRs covered:** FR-16, FR-17, FR-18, FR-19, FR-20

### Epic 9: Thông báo đẩy (lắp bộ gửi phía sau port)
Firebase mobile (FCM + Crashlytics + Analytics + Remote Config); đăng ký device token; **subscribe domain event → resolve người nhận THEO QUYỀN (AD-15/17) + người phụ trách đơn → gửi FCM**; hộp thư in-app; bật/tắt theo loại; nhắc theo lịch (báo giá sắp hết hạn, lead nguội). Không đụng lại logic nghiệp vụ E4–E7.
**FRs covered:** FR-30, FR-31, FR-32, FR-33, FR-34


## Epic Details

## Epic 1: Design System & App Shell (làm trước — AD-13)
_Dựng tầng design system từ DESIGN.md cho CẢ web lẫn mobile TRƯỚC mọi màn tính năng: token → thư viện component React → thư viện widget Flutter → app shell → màn Đăng nhập dựng thật để chứng minh design system dùng được (AD-13). Không style ad-hoc._

### Story 1.1: Tầng token dùng chung (màu, spacing, radius, quy tắc "Viền nét")
As a lập trình viên nền tảng, I want một tầng design token chính tắc dùng chung cho cả web (React) và mobile (Flutter), So that mọi component sau này tham chiếu cùng một nguồn màu/spacing/typography, không hardcode giá trị.
**Acceptance Criteria:**
- **Given** bảng màu "Năng Lượng Sạch" trong DESIGN.md, **When** khai báo token màu, **Then** đủ 14 nhóm màu canonical đúng hex (teal `#0E9F8E`, teal-700 `#0B8578`, teal-050 `#E6F6F4`, lime `#A3E635`, lime-600 `#7DB800`, lime-050 `#F1FBDD`, ink `#0C1F1C`, ink-2 `#334E49`, muted `#4E6B66`, line `#DBEBE7`, bg `#F4FAF8`, surface `#FFFFFF`, surface-2 `#ECF6F3`, semantic ok/warn/danger/info) **And** cùng giá trị hex xuất hiện trên cả hai nền tảng, không lệch (UX-DR-1).
- **Given** yêu cầu spacing/radius, **When** khai báo token, **Then** spacing scale 4/6/8/12/16/22/26px + gutter 12px + page-x 22px + pscroll 12px, radius sm 8px / DEFAULT 10px / lg 12px / full 9999px **And** `full` (pill) chỉ được dùng cho chip/pill (UX-DR-2).
- **Given** thang typography, **When** khai báo token role, **Then** có Display 23px/900/-.02em, Title 15px/800/-.01em, Body 13.5px/400/1.42, Meta 11–12.5px/600–700, Micro 10px/800/.1em uppercase teal, và style `.mono` tabular-nums canh phải cho tiền/số lượng/mã đơn (UX-DR-3).
- **Given** quy tắc elevation "Viền nét", **When** định nghĩa nền tảng thị giác, **Then** KHÔNG có token shadow/gradient trang trí; phân cấp chỉ bằng viền 1.5px (line → teal/ink) và bậc nền bg → surface → surface-2 (UX-DR-4).

### Story 1.2: Hệ thống icon SVG sprite inline
As a lập trình viên nền tảng, I want một bộ icon SVG sprite inline dùng chung, So that mọi màn dùng icon nhất quán, không phụ thuộc asset ngoài, chạy giống nhau trên web và Flutter.
**Acceptance Criteria:**
- **Given** yêu cầu icon self-contained, **When** dựng sprite, **Then** mỗi icon định nghĩa một lần dạng `<symbol id="ic-*">` và dùng qua `<svg class="icn"><use href="#ic-*"/></svg>`, `stroke:currentColor` / `stroke-width:2` / `fill:none`, 0 external ref (UX-DR-18).
- **Given** các ngữ cảnh dùng, **When** render icon, **Then** hỗ trợ biến thể kích thước 18/22/16/15/14/13px và icon thừa kế màu chữ ngữ cảnh (teal khi active, muted khi thường).
- **Given** danh sách symbol yêu cầu, **When** kiểm bộ icon, **Then** đủ tập tên: ic-home, ic-orders, ic-invoice, ic-inventory, ic-warehouse, ic-menu, ic-customer, ic-users, ic-user, ic-product, ic-catalog, ic-payment, ic-contract, ic-audit, ic-permissions, ic-status, ic-plus, ic-minus, ic-check, ic-close, ic-edit, ic-trash, ic-copy, ic-send, ic-share, ic-download, ic-external, ic-refresh, ic-search, ic-filter, ic-sort, ic-more, ic-bell, ic-mail, ic-phone, ic-camera, ic-image, ic-file, ic-clock, ic-info, ic-alert, ic-warning/ic-ban, ic-chevron-left/right/down, ic-sun **And** không dùng emoji hoặc icon raster.

### Story 1.3: React — Button, Card, Frame, Field
As a lập trình viên web, I want các component nền React (Button, Card, Frame, Field) từ token dùng chung, So that mọi màn web dựng từ component chuẩn, phẳng, không style ad-hoc.
**Acceptance Criteria:**
- **Given** token màu/spacing, **When** dựng Button, **Then** có biến thể outline mặc định (viền teal 1.5px, nền trắng, chữ teal-700 800), `--primary`, `--accent` (lime-050 + viền lime), `--ghost` (viền line), `--danger` và size `--sm`, `--wide` (UX-DR-5).
- **Given** yêu cầu Card/Frame, **When** dựng, **Then** Card = nền trắng + viền line + bo lg; Frame = viền ink 1.5px kèm `.frame-label` micro-uppercase nổi trên đường viền (UX-DR-6).
- **Given** yêu cầu Field, **When** dựng, **Then** viền line 1.5px, bo DEFAULT, focus đổi viền sang teal không glow, có `.flabel` micro-uppercase muted phía trên và biến thể `.field-lg` cho form đăng nhập (UX-DR-9).
- **Given** quy tắc Viền nét, **When** render mọi component trên, **Then** tuyệt đối phẳng, không drop-shadow/gradient (UX-DR-4).

### Story 1.4: React — Chip, Status-chip (9 trạng thái), chip chỉ đọc
As a lập trình viên web, I want component Chip/Status-chip với đủ 9 trạng thái canonical, So that mọi nơi hiển thị trạng thái đơn dùng đúng một bộ màu, không tự chế.
**Acceptance Criteria:**
- **Given** token chip, **When** dựng Chip, **Then** pill bo full, viền 1.5px, chữ 11px/700, có `.dot` 6px cùng màu chữ, kèm biến thể `.ktype` (viền lime) và `.scope-flag` (on = teal, off = gạch ngang mờ) (UX-DR-7).
- **Given** 9 trạng thái đơn, **When** render status chip, **Then** đủ 9 chip đúng bộ 3 hex bg/fg/border và nhãn verbatim — Báo giá `#EAF3F1/#3A5450/#CFE5E0`, Chờ duyệt `#FBF0DA/#8A5C08/#EFD9A8`, Đã chốt `#DCF3EF/#0B7264/#B7E5DD`, Đã cọc `#E7F5D9/#4B7A15/#CDE9AC`, Đang thi công `#FCEAD4/#985B08/#F2D3A6`, Nghiệm thu `#E4EEFA/#345C9C/#C4D8F0`, Đang giao `#DEF1F6/#0C6B84/#B7E0EB`, Hoàn thành `#DEF3E6/#137A4C/#B7E5CA`, Huỷ `#FAE6E6/#B22C2C/#F0C7C7` (UX-DR-8) **And** không có màu trạng thái nào khác được phép.
- **Given** status chip, **When** người dùng bấm vào chip, **Then** chip KHÔNG đổi trạng thái (chỉ đọc); đổi trạng thái đi qua màn chuyển trạng thái riêng (UX-DR-23).

### Story 1.5: React — Table, Stepper, KPI, Banner
As a lập trình viên web, I want các component dữ liệu/phản hồi (Table, Stepper, KPI, Banner), So that màn danh sách, chi tiết và dashboard dựng từ component chuẩn.
**Acceptance Criteria:**
- **Given** yêu cầu Table, **When** dựng, **Then** dày, header nền surface-2 + micro uppercase, ô viền dưới line 1px, hàng zebra `#F7FBFA`, cột số canh phải `.num`, giá trị mạnh in đậm ink (UX-DR-10).
- **Given** yêu cầu Stepper, **When** dựng, **Then** node tròn 26px nối bằng thanh 1.5px; `done` = teal đặc tick trắng, `current` = viền teal + ring teal-050, `gate` = viền đứt mờ, nhãn bước micro dưới node **And** bước gate (không áp dụng) bị ẩn hẳn, không disable xám (UX-DR-11).
- **Given** yêu cầu KPI, **When** dựng, **Then** viền line bo lg, nhãn micro-uppercase + giá trị display 23px/900 + delta màu `ok`, có biến thể `.accent` (viền teal, nền teal-050) (UX-DR-12).
- **Given** yêu cầu Banner, **When** dựng, **Then** viền 1.5px + nền semantic dịu (mặc định warn/cam, `--info` teal, `--danger` đỏ) với icon SVG bên trái (UX-DR-13).

### Story 1.6: React — hành vi giỏ hàng, trạng thái danh sách, overlay, share, upload
As a lập trình viên web, I want các mẫu tương tác (dòng giỏ hàng, trạng thái list, dialog/bottom-sheet, share, upload ảnh), So that các màn tính năng dùng lại hành vi chuẩn thay vì tự cài.
**Acceptance Criteria:**
- **Given** component dòng giỏ hàng, **When** sửa số lượng/đơn giá, **Then** tổng tính lại ngay không cần lưu thủ công; dòng pick từ Sản phẩm auto-điền đơn giá theo danh mục, dòng tự do/gói nhập tay, cờ "linh động/dự kiến" chỉ hiển thị, hỗ trợ swipe/nút xoá dòng (UX-DR-24).
- **Given** các mẫu trạng thái list, **When** render, **Then** Loading = skeleton rows khớp layout; Empty = câu Việt ngắn + hành động chính (vd "Chưa có đơn nào. Bấm ➕Tạo để bắt đầu."); Error = thông báo cụ thể + "Thử lại"; Confirm = dialog nêu hậu quả; phone-search-empty = "SĐT chưa có trong hệ thống." + nút "Tạo khách hàng mới" (UX-DR-19).
- **Given** quy tắc overlay, **When** mở overlay, **Then** bottom sheet (mobile) cho lựa chọn nhanh/native share; Dialog (web + mobile) cho hành động tiền/dữ liệu có hệ quả (Chốt, Huỷ, Duyệt, ghi thanh toán); overlay chồng tối đa một cấp (UX-DR-20).
- **Given** yêu cầu chia sẻ, **When** mở share, **Then** dùng native share sheet ưu tiên hình ảnh (hoặc PDF); web = share/download tương đương (UX-DR-21).
- **Given** upload ảnh, **When** người dùng thêm ảnh, **Then** mobile chụp trực tiếp/chọn thư viện, web chọn file; upload luôn optional (UX-DR-25).

### Story 1.7: Flutter — thư viện widget tương đương (parity component)
As a lập trình viên mobile, I want thư viện widget Flutter phản chiếu đúng bộ component React từ cùng token, So that cùng một màn nghiệp vụ nhận ra được trên cả web và mobile.
**Acceptance Criteria:**
- **Given** tầng token dùng chung (Story 1.1) và icon sprite (Story 1.2), **When** dựng widget Flutter, **Then** Button/Card/Frame/Field/Chip+9 status chip/Table/Stepper/KPI/Banner đều có mặt, cùng token màu/spacing/radius/typography, phẳng không shadow (UX-DR-5..13).
- **Given** hành vi giỏ hàng/upload/overlay, **When** dùng trên mobile, **Then** dòng giỏ hàng recalc realtime, upload optional (chụp/thư viện), bottom-sheet vs dialog theo đúng quy tắc (UX-DR-24, UX-DR-25, UX-DR-20).
- **Given** cùng một màn mẫu dựng bằng cả React và Flutter, **When** so sánh, **Then** nhận ra là cùng màn — chỉ khác khung và điều hướng (UX-DR-27).

### Story 1.8: App shell mobile — Topbar, Bottom-nav 5 tab + FAB, Phone frame
As a lập trình viên mobile, I want khung app mobile chuẩn (topbar, bottom-nav 5 tab + FAB, phone frame), So that mọi màn mobile nằm trong một shell nhất quán.
**Acceptance Criteria:**
- **Given** yêu cầu Topbar, **When** dựng, **Then** nút back (viền, bo sm) + tiêu đề 15px/800 (eyebrow micro tuỳ chọn) + action phải teal-700, viền dưới ink 1.5px (UX-DR-14).
- **Given** yêu cầu Bottom-nav, **When** dựng, **Then** khoá cứng 5 tab Trang chủ · Đơn hàng · ➕Tạo báo giá (FAB) · Kho · Menu; FAB là nút tròn 46px nền teal, vành trắng 3px + ring teal-700 1.5px, nhô `-22px`, dấu cộng SVG `ic-plus`, tab active đổi chữ+icon sang teal (UX-DR-15) **And** màn xác thực không có bottom-nav.
- **Given** yêu cầu trình bày mobile, **When** dựng phone frame, **Then** thân `#0C1512` bo 40px, kính bo 32px cao 700px, có notch + status bar giả (UX-DR-17).

### Story 1.9: App shell web — Sidebar + Web frame
As a lập trình viên web, I want khung app web (sidebar cố định + faux browser frame + toolbar), So that mọi màn web nằm trong một shell nhất quán.
**Acceptance Criteria:**
- **Given** yêu cầu sidebar, **When** dựng, **Then** sidebar cố định 186px nền surface-2 với brand + navlink (active = viền teal + nền trắng) + nhóm `.navsec` micro-uppercase (UX-DR-16).
- **Given** yêu cầu web frame, **When** dựng, **Then** faux browser chrome (chrome + 3 chấm + url pill) bao `.web-app` **And** toolbar có search icon SVG, segmented `.seg` (active nền teal), tabs gạch chân teal (UX-DR-16).
- **Given** breakpoint `max-width:900px`, **When** thu hẹp, **Then** layout xếp dọc, KPI 4→2 cột, sidebar chuyển hàng ngang wrap.

### Story 1.10: Primitive gating theo quyền + accessibility floor + parity
As a lập trình viên nền tảng, I want primitive ẩn/hiện theo bộ quyền + chuẩn accessibility + kiểm parity, So that mọi màn về sau gating và tiếp cận được ngay, cùng chuẩn trên hai nền tảng.
**Acceptance Criteria:**
- **Given** một bộ quyền hiệu lực truyền vào (Epic 1 dùng stub, Epic 2 nối `/me`), **When** render nav/nút, **Then** bề mặt không có quyền đơn giản KHÔNG xuất hiện (không disable xám); mục Audit ẩn với người không phải Super Admin; "xem tất cả đơn" vs "đơn của mình" chi phối phạm vi list; cả hai nền tảng gating từ cùng nguồn quyền (UX-DR-22).
- **Given** accessibility floor, **When** kiểm component, **Then** touch target ≥ 48dp/44pt; contrast ink-trên-surface đạt AA; chip trạng thái mang nhãn chữ (không chỉ màu); web hỗ trợ Tab theo thứ tự đọc, Esc đóng overlay trên cùng, form thao tác toàn bàn phím; nút icon-only có `aria-label`; tiền/VAT đọc đủ ở cỡ chữ lớn (UX-DR-26).
- **Given** cùng một màn nghiệp vụ, **When** dựng trên web và mobile, **Then** đạt full parity — chỉ khác khung (browser chrome vs phone frame) và điều hướng (sidebar vs bottom-nav) (UX-DR-27).

### Story 1.11: Màn Đăng nhập dựng thật (demo design system)
As a người dùng nội bộ, I want màn Đăng nhập dựng bằng chính design system, So that hệ thống chứng minh thư viện dùng được thật, không phải component treo kệ.
**Acceptance Criteria:**
- **Given** thư viện component/token đã có, **When** dựng màn Đăng nhập trên cả web và mobile, **Then** dùng Field `.field-lg`, Button `--primary --wide`, không style ad-hoc, có link "Quên mật khẩu" **And** màn xác thực không hiển thị bottom-nav/sidebar nav (UX-DR-9, UX-DR-15).
- **Given** đây là bản demo UI (FR-22 phần giao diện), **When** người dùng nhập SĐT/email + mật khẩu, **Then** form validate rỗng/định dạng và hiển thị vùng lỗi bằng component Banner/field-error — logic xác thực thật nối ở Epic 2 (FR-22).
- **Given** cả hai nền tảng, **When** so sánh màn Đăng nhập, **Then** nhận ra là cùng một màn (parity), khác khung + điều hướng (UX-DR-27).

## Epic 2: Nền tảng Backend & Đăng nhập/Quyền
_Backend skeleton (NestJS + PostgreSQL + OpenAPI sinh-từ-code + error-envelope tập trung); JWT access+refresh; permission registry + `/me` + UI gating; quên mật khẩu; hồ sơ. Chừa sẵn Domain Event port + NotificationDispatcher (no-op/log) để các epic sau publish event (AD-18)._

### Story 2.1: Skeleton backend + Prisma + OpenAPI sinh-từ-code
As a lập trình viên backend, I want skeleton NestJS + PostgreSQL (Prisma) với OpenAPI sinh tự động từ code, So that có nền chung và một hợp đồng API duy nhất cho web + mobile.
**Acceptance Criteria:**
- **Given** yêu cầu chủ sở hữu DB duy nhất, **When** dựng backend, **Then** chỉ `prisma/PrismaService` truy cập DB, chỉ backend giữ credential DB, client không có đường chạm DB (AD-1).
- **Given** API REST, **When** build, **Then** OpenAPI spec được SINH TỪ code NestJS như build artifact, versioned + publish; cấm sửa tay spec; web và mobile đều sinh/validate client từ spec này (AD-12).
- **Given** convention dự án, **When** đặt tên, **Then** entity PascalCase, bảng snake_case số nhiều, file kebab-case, route danh từ số nhiều + action nghiệp vụ là POST sub-resource; tiền là integer đồng; ngày ISO-8601 UTC.

### Story 2.2: Error envelope thống nhất + xử lý lỗi tập trung
As a lập trình viên, I want một exception filter trung tâm dựng envelope lỗi thống nhất và FE handle ở một chỗ, So that mọi lỗi có cùng shape, không rải rác try/catch.
**Acceptance Criteria:**
- **Given** một lỗi bất kỳ ở backend, **When** filter trung tâm bắt, **Then** trả envelope `{ code (string enum có tài liệu), message, fieldErrors?: Array<{field, code, message}>, traceId }` + HTTP status chuẩn (AD-5).
- **Given** yêu cầu một nơi dựng envelope, **When** kiểm code controller, **Then** KHÔNG controller nào tự nặn envelope; chỉ exception filter tạo (AD-5).
- **Given** FE web/mobile, **When** nhận lỗi, **Then** một API interceptor duy nhất parse envelope và map `fieldErrors` vào field tương ứng (AD-5).

### Story 2.3: Đăng nhập JWT access+refresh
As a người dùng nội bộ, I want đăng nhập thật với JWT access + refresh, So that phiên áp đúng danh tính và có thể làm mới token an toàn.
**Acceptance Criteria:**
- **Given** thông tin đăng nhập hợp lệ, **When** đăng nhập, **Then** backend cấp access token ngắn hạn + refresh token; đăng nhập sai trả envelope lỗi chuẩn (NFR-6, AD-12).
- **Given** access token hết hạn, **When** gọi refresh, **Then** cấp access token mới; đăng xuất thu hồi phiên phía client (AD-12).
- **Given** app online-only, **When** mất mạng, **Then** hiển thị lỗi cụ thể + "Thử lại", không có offline mode (FR-22, NFR-11).

### Story 2.4: Registry quyền chính tắc + lưu quyền theo account
As a lập trình viên nền tảng, I want một registry quyền duy nhất do `accounts/domain` sở hữu và lưu bộ quyền trên từng Account, So that ba bên (FE gating, BE guard, notification resolver) dùng chung một danh sách key quyền.
**Acceptance Criteria:**
- **Given** yêu cầu registry, **When** khai báo quyền, **Then** một enum/registry duy nhất publish dạng artifact sinh tự động; không permission string literal nào tồn tại ngoài registry (AD-17).
- **Given** mô hình RBAC per-account, **When** lưu quyền, **Then** nguồn chân lý là bộ quyền trên `Account` (entity Account + AccountPermission); "xem tất cả đơn" và "đơn của mình" là hai entry tường minh trong registry (AD-8, AD-17).
- **Given** Super Admin, **When** khai báo quyền xem Audit, **Then** quyền này chỉ gắn cho một account Super Admin được chỉ định (AD-8).

### Story 2.5: Endpoint `/me` + guard quyền server-side mỗi request
As a người dùng nội bộ, I want `/me` trả bộ quyền hiệu lực và backend enforce quyền mỗi request, So that UI biết ẩn/hiện gì còn bảo mật vẫn nằm ở server.
**Acceptance Criteria:**
- **Given** phiên hợp lệ, **When** gọi `/me`, **Then** trả effective permission set của Account từ registry (AD-4, AD-12).
- **Given** một request tới endpoint có quyền, **When** guard chạy, **Then** backend enforce quyền server-side mỗi request; gọi trực tiếp API mà thiếu quyền bị từ chối bất kể client hiển thị gì (AD-4, NFR-7).
- **Given** client gating, **When** đánh giá, **Then** ẩn/disable ở client chỉ là UX, không được coi là lớp bảo mật (AD-4).

### Story 2.6: Nối UI gating vào `/me` trên hai nền tảng
As a người dùng nội bộ, I want UI ẩn/hiện chức năng theo bộ quyền `/me`, So that tôi chỉ thấy đúng việc của mình, không rối.
**Acceptance Criteria:**
- **Given** primitive gating Epic 1 (Story 1.10), **When** đăng nhập, **Then** web và mobile lấy quyền từ `/me` và dựng nav/nút theo đó (FR-22, UX-DR-22).
- **Given** account không có quyền xem Audit, **When** render nav, **Then** mục Audit không xuất hiện; account thiếu "xem dashboard tài chính" không thấy số doanh thu (UX-DR-22).
- **Given** quyền "xem tất cả đơn" vs "đơn của mình", **When** vào danh sách đơn, **Then** phạm vi hiển thị theo đúng quyền (UX-DR-22).

### Story 2.7: Domain Event port (EventBus) + NotificationDispatcher no-op + audit subscriber
As a lập trình viên nền tảng, I want một EventBus port duy nhất với dispatcher no-op/log và subscriber ghi Audit, So that các epic sau publish domain event mà không cần biết bộ gửi, và audit là cross-cutting qua event.
**Acceptance Criteria:**
- **Given** yêu cầu tách side-effect, **When** khai báo nền tảng, **Then** có một `EventBus` port duy nhất; bản đầu NotificationDispatcher là no-op/log; producer không gọi FCM/notification trực tiếp (AD-18).
- **Given** một domain event được publish, **When** subscriber audit chạy, **Then** ghi AuditLog bất biến append-only (ai/gì/đối tượng/khi nào/trước→sau), chỉ Super Admin đọc được (AD-8, FR-20 ghi).
- **Given** Epic 9 lắp bộ gửi sau, **When** thay dispatcher no-op bằng bộ FCM thật, **Then** không phải mở lại code chức năng nào của E4–E7 (AD-18).

### Story 2.8: Quên mật khẩu + Hồ sơ & đổi mật khẩu
As a người dùng nội bộ, I want đặt lại mật khẩu qua mã và xem/sửa hồ sơ + đổi mật khẩu, So that tôi tự khôi phục truy cập và quản lý tài khoản của mình.
**Acceptance Criteria:**
- **Given** màn Quên mật khẩu, **When** người dùng yêu cầu đặt lại, **Then** hệ thống gửi mã và cho đặt mật khẩu mới; thao tác lỗi trả envelope chuẩn.
- **Given** màn Hồ sơ, **When** người dùng đổi mật khẩu, **Then** kiểm mật khẩu cũ, cập nhật mật khẩu mới, ghi Audit qua event.
- **Given** cả hai màn, **When** dựng, **Then** dùng component design system (Field, Button, Banner), parity web+mobile.

## Epic 3: Danh mục vật tư & Khách hàng
_CRUD sản phẩm + giá phân tầng (sau cờ); CRUD khách hàng (SĐT E.164 khoá chính) + tra SĐT chọn/tạo mới inline (FR-14, FR-15, FR-29)._

### Story 3.1: CRUD Sản phẩm & giá
As a người có quyền sửa danh mục, I want thêm/sửa/xoá Sản phẩm và cập nhật giá bất kỳ lúc nào, So that báo giá luôn lấy giá mới nhất từ danh mục.
**Acceptance Criteria:**
- **Given** quyền "sửa danh mục & giá", **When** tạo/sửa/xoá Sản phẩm (tên, đơn vị, giá), **Then** thay đổi lưu vào entity `Product` và phản ánh ngay vào báo giá đang dựng (chưa chốt) (FR-14).
- **Given** một Đơn đã chốt, **When** sửa giá danh mục, **Then** KHÔNG hồi tố đơn đã chốt (FR-14, ánh xạ FR-5).
- **Given** mọi thay đổi Sản phẩm/giá, **When** lưu, **Then** publish domain event → ghi Audit log (ai/gì/trước→sau) (FR-14, AD-18).

### Story 3.2: Giá phân tầng sau cờ
As a người có quyền sửa danh mục, I want bật/tắt giá phân tầng (lẻ/sỉ), So that hệ thống hỗ trợ nhiều mức giá khi cần mà mặc định vẫn đơn giản.
**Acceptance Criteria:**
- **Given** cờ giá phân tầng mặc định TẮT, **When** xem Sản phẩm, **Then** mỗi Sản phẩm một giá duy nhất (FR-15).
- **Given** cờ giá phân tầng BẬT, **When** cấu hình giá, **Then** lưu nhiều mức qua entity `ProductPrice` và chọn mức theo ngữ cảnh (vd theo Loại khách) (FR-15).
- **Given** cờ là business flag, **When** lưu, **Then** cờ nằm trong DB là nguồn chân lý, không đặt ở Remote Config (AD-14).

### Story 3.3: CRUD Khách hàng — SĐT E.164 khoá chính, chặn trùng
As a người có quyền quản lý khách hàng, I want tạo/sửa Khách hàng với SĐT là khoá chính chuẩn hoá E.164, So that mỗi khách định danh duy nhất và nhất quán khắp hệ thống.
**Acceptance Criteria:**
- **Given** một SĐT thô do client gửi, **When** backend lưu Khách hàng, **Then** domain `customers` chuẩn hoá về E.164 (`+84…`) — client KHÔNG tự chuẩn hoá; PK của `Customer` là SĐT chuẩn hoá (AD-9).
- **Given** Loại khách, **When** nhập dữ liệu, **Then** Cá nhân lưu họ tên/CCCD/địa chỉ/SĐT; Thương mại lưu tên/MST/địa chỉ/SĐT/tài khoản NH (FR-29).
- **Given** một SĐT đã tồn tại (sau chuẩn hoá), **When** tạo khách trùng SĐT, **Then** hệ thống chặn tạo trùng (một SĐT = một Khách hàng) (FR-29) **And** thay đổi khách ghi Audit qua event.

### Story 3.4: Tra SĐT chọn/tạo khách inline + màn danh sách/chi tiết khách
As a người có quyền quản lý khách hàng, I want tra SĐT để chọn khách cũ hoặc tạo mới ngay tại chỗ, So that dựng đơn nhanh mà không rời màn.
**Acceptance Criteria:**
- **Given** một SĐT nhập trong luồng tra cứu, **When** backend tra, **Then** chạy cùng bộ chuẩn hoá E.164 trước khi kiểm tra tính duy nhất; trùng → trả khách cũ để điền sẵn (AD-9, FR-29).
- **Given** SĐT không tìm thấy, **When** hiển thị kết quả, **Then** hiện "SĐT chưa có trong hệ thống." + nút "Tạo khách hàng mới" inline (FR-29, UX-DR-19).
- **Given** màn Danh sách khách + Chi tiết khách, **When** dựng, **Then** dùng Table + trạng thái empty/loading/error, xem được thông tin theo Loại khách; parity web+mobile (FR-29).

## Epic 4: Báo giá, Chốt & Duyệt chiết khấu (trái tim)
_Giỏ hàng + cờ phạm vi + VAT qua `/orders/preview-total`; chốt + snapshot giá; sửa đơn = bản update mới + lịch sử; xuất PDF + share ảnh; áp + duyệt chiết khấu. Mỗi hành động nghiệp vụ publish domain event (AD-18). FR-1..6, FR-21._

### Story 4.1: Tạo Đơn + dựng giỏ hàng (Order/OrderVersion/OrderLineItem)
As a người có quyền tạo báo giá, I want tạo Đơn mới và thêm/sửa/xoá Dòng báo giá, So that dựng báo giá kiểu giỏ hàng ngay tại hiện trường.
**Acceptance Criteria:**
- **Given** mô hình dữ liệu, **When** tạo Đơn, **Then** `OrderVersion` sở hữu TẤT CẢ line item, `Order` không sở hữu line trực tiếp; `Order` có `ownerAccountId` + `assigneeAccountId` (nullable); mọi đọc dòng phân giải qua `currentVersionId` (AD-6, AD-15).
- **Given** một Dòng báo giá, **When** thêm/sửa/xoá, **Then** hỗ trợ dòng pick từ Sản phẩm (auto-điền đơn giá theo danh mục hiện tại, trước chốt) và dòng tự do/gói nhập tay (tên nhiều dòng, đơn vị, số lượng, đơn giá, diễn giải); cờ "linh động/dự kiến" chỉ hiển thị (FR-1, UX-DR-24).
- **Given** tạo Đơn, **When** lưu, **Then** publish domain event `OrderCreated` qua EventBus (AD-18) **And** chọn Khách hàng qua tra SĐT (Epic 3).

### Story 4.2: Xem trước tổng realtime qua `POST /orders/preview-total`
As a người có quyền tạo báo giá, I want tổng tiền cập nhật tức thì khi sửa dòng, So that chốt giá cùng khách ngay tại chỗ mà không lệch với backend.
**Acceptance Criteria:**
- **Given** giỏ hàng đang dựng, **When** sửa số lượng/đơn giá/dòng, **Then** client gọi stateless `POST /orders/preview-total` và chỉ hiển thị integer trả về — client CẤM làm số học tiền (AD-16, FR-1, NFR-3).
- **Given** thuật toán tiền, **When** backend tính, **Then** `subtotal = Σ(unitPrice × qty)` theo integer đồng và preview dùng CHÍNH hàm pricing domain (một bộ tính) (AD-10, AD-16).
- **Given** tổng preview, **When** hiển thị, **Then** Tổng trước VAT / Tiền VAT / Tổng sau VAT cập nhật ngay không cần lưu thủ công (FR-1, FR-3, UX-DR-24).

### Story 4.3: Cờ phạm vi & Loại khách (preset)
As a người có quyền tạo báo giá, I want chọn Loại khách để nạp preset cờ và bật/tắt từng cờ, So that vòng đời đơn khớp phạm vi thực tế của đơn.
**Acceptance Criteria:**
- **Given** chọn Loại khách "Cá nhân", **When** áp preset, **Then** mặc định bật cả 3 cờ Thiết bị/Thi công/Vận chuyển; "Thương mại" → chỉ Thiết bị (FR-2).
- **Given** preset đã nạp, **When** người dùng bật/tắt từng cờ trên Đơn, **Then** sửa được độc lập với preset; Loại khách giữ làm nhãn báo cáo (FR-2).
- **Given** cờ phạm vi lưu trên `Order` (`scopeThietBi/scopeThiCong/scopeVanChuyen`), **When** đọc, **Then** giá trị là nguồn cho gate state machine ở Epic 5 (AD-7).

### Story 4.4: VAT cấu hình + tick áp VAT + metadata Đơn
As a người có quyền tạo báo giá, I want cấu hình VAT (tick áp/không, thuế suất) và nhập kWp + hạn hiệu lực, So that báo giá thể hiện đúng thuế và thông tin đơn.
**Acceptance Criteria:**
- **Given** tick "không tính VAT", **When** tính tổng, **Then** tiền thuế = 0, tổng sau VAT = tổng trước VAT; tick "có tính VAT" → áp thuế suất cấu hình (mặc định 8%) (FR-3).
- **Given** thuật toán VAT, **When** backend tính, **Then** `VAT = round-half-up(subtotal × vatRate)` ở mức GRAND-SUBTOTAL với MỘT điểm làm tròn duy nhất, `vatRate` phân giải một lần (AD-16).
- **Given** metadata Đơn, **When** nhập, **Then** lưu công suất kWp và hạn hiệu lực báo giá (vd "48h kể từ ngày lên PO"), hiển thị trên báo giá (Phase 1 chỉ hiển thị, không auto khoá) (FR-4).

### Story 4.5: Chốt Đơn + snapshot giá
As a người có quyền chốt đơn, I want bấm Chốt để đóng băng giá, So that giá đã báo cho khách không đổi khi danh mục thay đổi sau này.
**Acceptance Criteria:**
- **Given** một Đơn "Báo giá", **When** bấm Chốt (qua dialog xác nhận nêu "Chốt sẽ đóng băng giá"), **Then** snapshot đơn giá mọi Dòng vào `OrderVersion.OrderLineItem.unitPriceSnapshot` và snapshot `vatRate`+`vatMode` hiệu lực lên `OrderVersion`; `currentVersionId` trỏ bản này; Đơn → "Đã chốt" (FR-5, AD-6, AD-16).
- **Given** sau Chốt, **When** sửa giá danh mục, **Then** giá các Dòng của đơn đã chốt KHÔNG đổi (FR-5).
- **Given** thao tác tiền, **When** Chốt bị retry, **Then** idempotent, không chốt/ghi trùng; publish domain event `OrderConfirmed` qua EventBus (NFR-1, AD-18).

### Story 4.6: Sửa Đơn đã chốt — bản update mới + lịch sử
As a người có quyền sửa đơn, I want sửa đơn đã chốt bằng cách sinh bản update mới, So that giữ nguyên lịch sử và không ghi đè bản cũ.
**Acceptance Criteria:**
- **Given** một Đơn đã chốt, **When** mở lại để sửa, **Then** tạo `OrderVersion` MỚI (không ghi đè), repoint `Order.currentVersionId` sang bản mới, giữ các bản cũ (FR-6, AD-6).
- **Given** bản update mới được chốt lại, **When** re-finalize, **Then** re-snapshot giá + vatRate/vatMode lên bản mới; bản mới nhất (theo `currentVersionId`) là bản hiệu lực, không suy ra bằng timestamp/số đếm (FR-6, AD-6).
- **Given** trang chi tiết Đơn, **When** xem lịch sử, **Then** thấy bản nào/ai/khi nào/đổi gì; sửa đơn publish event `OrderRevised` + ghi Audit (FR-6, AD-18).

### Story 4.7: Áp chiết khấu + duyệt chiết khấu
As a người có quyền áp chiết khấu, I want áp chiết khấu và gửi đi duyệt, So that giảm giá cho khách theo đúng quy trình kiểm soát.
**Acceptance Criteria:**
- **Given** một Đơn, **When** áp chiết khấu, **Then** Đơn → "Chờ duyệt chiết khấu" và tạo `DiscountApproval`; publish event `DiscountRequested` (không đẩy FCM trực tiếp) (FR-18, AD-18).
- **Given** một chiết khấu chờ duyệt, **When** người có quyền duyệt chiết khấu Đồng ý/Từ chối kèm lý do, **Then** Đơn chuyển tương ứng (duyệt → được Chốt; từ chối → về Báo giá); publish `DiscountResolved`; mọi bước ghi Audit (FR-18).
- **Given** màn Duyệt chiết khấu, **When** dựng, **Then** dùng Dialog xác nhận có hệ quả (UX-DR-20); không có hạn mức tự quyết — mọi chiết khấu phải duyệt.

### Story 4.8: Xuất & chia sẻ báo giá (PDF + ảnh)
As a người có quyền tạo báo giá, I want xuất báo giá PDF/hình ảnh và chia sẻ qua native share, So that gửi ngay cho khách qua Zalo tại hiện trường.
**Acceptance Criteria:**
- **Given** một Đơn (sau chốt hoặc khi cần), **When** xuất, **Then** tạo PDF và ưu tiên IMAGE báo giá, có khối chữ ký (Người lập/Giám đốc) + logo & thông tin công ty theo mẫu (FR-21).
- **Given** file xuất, **When** lưu, **Then** binary ở Cloudflare R2, DB chỉ lưu metadata + object key; đọc qua signed URL/proxy, không public bucket (AD-3).
- **Given** nút Share, **When** bấm, **Then** mở native share sheet ưu tiên hình ảnh; web = share/download tương đương (FR-21, UX-DR-21).

## Epic 5: Vòng đời đơn & Thi công (nhánh cá nhân)
_applyTransition engine gate theo cờ + permission + audit; auto-transition; danh sách đơn (+follow-up, empty/loading/error); chi tiết đơn (stepper/tabs/lịch sử); chuyển trạng thái + ảnh optional; huỷ; nhánh Thi công. Publish StatusChanged. FR-7,8,9,10,23,24._

### Story 5.1: Engine `applyTransition()` — enum + bảng transition + guard + audit
As a lập trình viên backend, I want một hàm `applyTransition()` duy nhất ghi `Order.status`, So that mọi chuyển trạng thái đi qua một chỗ đánh giá guard và ghi audit.
**Acceptance Criteria:**
- **Given** trạng thái là enum tường minh + allowed-transition table, **When** gọi `applyTransition({order, event, actorPermissions, scopeFlags})`, **Then** đây là con đường code DUY NHẤT ghi `Order.status`; transition chỉ hợp lệ khi qua bảng + gate theo cờ phạm vi + permission (AD-7, AD-11, FR-7, FR-9).
- **Given** một transition được áp, **When** ghi, **Then** đây là nơi duy nhất đánh giá guard và nơi duy nhất phát bản ghi Audit + publish event `StatusChanged` (from→to, ai, khi nào) (AD-11, AD-18, FR-9).
- **Given** actor thiếu permission, **When** gọi transition, **Then** bị từ chối với envelope lỗi chuẩn, không đổi status (AD-4, FR-9).

### Story 5.2: Auto-transition theo sự kiện nghiệp vụ
As a lập trình viên backend, I want cơ chế auto-transition đi qua cùng engine, So that các bước tự nhảy theo sự kiện mà vẫn dùng chung guard + audit.
**Acceptance Criteria:**
- **Given** một sự kiện nghiệp vụ (vd đủ đợt cọc đầu), **When** hệ thống xử lý, **Then** gọi CÙNG `applyTransition()` để tự sang trạng thái tương ứng (vd "Đã cọc") — auto và manual dùng chung một entry point (FR-8, AD-11).
- **Given** mapping đợt→trạng thái, **When** cấu hình, **Then** mapping gắn theo Lịch thanh toán và được engine tra khi auto-transition (FR-8).
- **Given** `payments/` và `inventory/`, **When** cần đổi status, **Then** GỌI `applyTransition()`, không bao giờ ghi `Order.status` trực tiếp (AD-11).

### Story 5.3: Danh sách đơn + follow-up + trạng thái list
As a người có quyền xem đơn, I want danh sách đơn lọc theo trạng thái và xem đơn chưa chốt để follow-up, So that theo dõi và chăm đơn không sót.
**Acceptance Criteria:**
- **Given** quyền "xem tất cả đơn" vs "đơn của mình", **When** mở danh sách, **Then** phạm vi lọc theo `ownerAccountId`/`assigneeAccountId` đúng quyền (AD-15, UX-DR-22).
- **Given** đơn ở trạng thái "Báo giá" chưa chốt, **When** lọc follow-up, **Then** hiển thị trong danh sách theo dõi, không tự xoá/ẩn (FR-10).
- **Given** các trạng thái list, **When** render, **Then** Loading = skeleton; Empty = "Chưa có đơn nào. Bấm ➕Tạo để bắt đầu."; Error = thông báo cụ thể + "Thử lại" (UX-DR-19).

### Story 5.4: Chi tiết đơn — stepper gate + tabs + lịch sử bản update
As a người có quyền xem đơn, I want màn chi tiết đơn với stepper, tabs và lịch sử bản update, So that nắm nhanh đơn đang ở đâu và đã qua những gì.
**Acceptance Criteria:**
- **Given** cờ phạm vi của Đơn, **When** dựng stepper, **Then** chỉ hiện các bước hợp lệ; bước không áp dụng bị ẩn hẳn (không disable xám); bước hiện tại nổi bật teal, bước đã qua có tick (FR-7, UX-DR-11).
- **Given** đơn có nhiều bản update, **When** xem tab lịch sử, **Then** thấy bản nào/ai/khi nào/đổi gì, bản hiệu lực phân giải qua `currentVersionId` (FR-6, AD-6).
- **Given** status chip trong màn, **When** bấm, **Then** chip chỉ đọc — không đổi trạng thái qua chip (UX-DR-23).

### Story 5.5: Chuyển trạng thái thủ công + đính kèm ảnh optional
As a người có quyền chuyển trạng thái, I want chọn bước kế và đính kèm ảnh bằng chứng, So that ghi nhận tiến trình có bằng chứng khi cần.
**Acceptance Criteria:**
- **Given** màn Chuyển trạng thái, **When** người có quyền chọn bước kế, **Then** đi qua `applyTransition()` (guard + audit + event `StatusChanged`) (FR-9, AD-11).
- **Given** một lần chuyển, **When** đính kèm, **Then** gắn ≥0 ảnh cho đúng bước (đơn, from→to, thời điểm), ảnh ghi vào Audit của bước; upload luôn optional (FR-23, UX-DR-25).
- **Given** file ảnh, **When** lưu, **Then** binary ở R2, DB lưu metadata + object key (AD-3).

### Story 5.6: Đính kèm ảnh bổ sung trong chi tiết đơn
As a người có quyền, I want thêm/xoá ảnh bổ sung trong chi tiết đơn ngoài luồng chuyển trạng thái, So that lưu bằng chứng linh hoạt bất cứ lúc nào.
**Acceptance Criteria:**
- **Given** chi tiết đơn, **When** xem ảnh, **Then** thấy toàn bộ ảnh (theo bước + bổ sung) kèm mốc thời gian + người tải; entity `Attachment` gắn `Order` + `accountId` (FR-24).
- **Given** một ảnh, **When** xoá, **Then** chỉ người đã tải lên hoặc người có quyền chỉnh sửa đơn mới xoá được; thêm/xoá ghi Audit (FR-24).
- **Given** upload, **When** thêm ảnh, **Then** mobile chụp/chọn thư viện, web chọn file; binary ở R2 (FR-24, AD-3, UX-DR-25).

### Story 5.7: Huỷ đơn kèm lý do
As a người có quyền, I want huỷ đơn kèm lý do, So that đóng đơn không tiếp tục mà vẫn lưu vết.
**Acceptance Criteria:**
- **Given** một Đơn ở trạng thái cho phép huỷ, **When** người có quyền huỷ, **Then** đi qua `applyTransition()` sang "Huỷ", bắt buộc nhập lý do (FR-9, AD-11).
- **Given** hành động huỷ, **When** xác nhận, **Then** qua Dialog nêu hậu quả; ghi Audit + publish `StatusChanged` (UX-DR-20, AD-18).

### Story 5.8: Nhánh Thi công (Lên lịch → Đang thi công → Nghiệm thu)
As a người có quyền chuyển bước thi công, I want các bước thi công chỉ hiện khi cờ Thi công bật, So that đơn có thi công đi đúng chuỗi, đơn không thi công không lộ bước thừa.
**Acceptance Criteria:**
- **Given** Đơn bật cờ Thi công, **When** sau "Đã cọc", **Then** engine cho các bước Lên lịch thi công → Đang thi công → Nghiệm thu qua allowed-transition table (FR-7, AD-7).
- **Given** Đơn KHÔNG bật cờ Thi công, **When** dựng vòng đời, **Then** không có bước thi công nào xuất hiện (FR-7).
- **Given** mỗi bước thi công, **When** chuyển, **Then** đi qua `applyTransition()` (permission + audit + event), cho đính kèm ảnh optional (FR-9, FR-23).

## Epic 6: Giao hàng & Tồn kho (nhánh bỏ mối)
_Nhánh Giao hàng dùng lại engine E5; tồn kho hiện tại; phiếu nhập/xuất; xuất kho gắn đơn; chặn khi thiếu tồn (publish StockOutBlocked). FR-25, FR-26._

### Story 6.1: Nhánh Giao hàng (Đang giao → Đã giao)
As a người có quyền xác nhận giao hàng, I want các bước giao hàng chỉ hiện khi cờ Vận chuyển bật, So that đơn bỏ mối đi đúng chuỗi giao hàng.
**Acceptance Criteria:**
- **Given** Đơn bật cờ Vận chuyển, **When** sau "Đã cọc", **Then** engine cho bước Đang giao hàng → Đã giao qua cùng `applyTransition()` (FR-7, AD-11).
- **Given** Đơn KHÔNG bật cờ Vận chuyển, **When** dựng vòng đời, **Then** không có bước giao hàng nào xuất hiện (FR-7).
- **Given** mỗi bước giao, **When** chuyển, **Then** permission-gated + ghi Audit + publish `StatusChanged`, đính kèm ảnh optional (FR-9, FR-23, AD-18).

### Story 6.2: Tồn kho hiện tại theo Sản phẩm
As a người có quyền nhập/xuất kho, I want xem tồn hiện tại theo Sản phẩm, So that biết còn bao nhiêu trước khi xuất.
**Acceptance Criteria:**
- **Given** mỗi Sản phẩm, **When** xem Tồn kho, **Then** hiển thị on-hand hiện tại từ entity `StockItem` (một kho duy nhất ở Phase 1) (FR-25).
- **Given** màn Tồn kho, **When** dựng, **Then** dùng Table + trạng thái empty/loading/error, số canh phải `.mono`, parity web+mobile (FR-25, UX-DR-10).

### Story 6.3: Phiếu nhập/xuất kho
As a người có quyền nhập/xuất kho, I want tạo Phiếu kho nhập/xuất cập nhật tồn, So that tồn kho luôn khớp thực tế và có lưu vết.
**Acceptance Criteria:**
- **Given** một Phiếu kho, **When** tạo nhập/xuất, **Then** entity `StockVoucher` + `StockVoucherLine`; nhập tăng tồn, xuất giảm tồn on-hand (FR-25).
- **Given** mỗi Phiếu kho, **When** lưu, **Then** ghi Audit (ai/khi nào/số lượng/sản phẩm) qua event (FR-25, AD-18).

### Story 6.4: Xuất kho gắn Đơn
As a người có quyền nhập/xuất kho, I want tạo phiếu xuất từ các Dòng vật tư của Đơn, So that cấp vật tư/giao hàng khớp đúng đơn.
**Acceptance Criteria:**
- **Given** một Đơn có cờ Vận chuyển/Thi công, **When** tạo phiếu xuất, **Then** phiếu xuất tạo được từ các Dòng vật tư của Đơn và gắn `orderId` (FR-26).
- **Given** phiếu xuất gắn đơn, **When** lưu, **Then** ghi Audit + liên kết đơn truy được (FR-26).

### Story 6.5: Chặn khi thiếu tồn
As a người có quyền nhập/xuất kho, I want hệ thống cảnh báo và chặn khi tồn không đủ, So that không xuất quá tồn gây sai lệch kho.
**Acceptance Criteria:**
- **Given** một phiếu xuất vượt tồn hiện có, **When** lưu, **Then** hệ thống CẢNH BÁO và CHẶN, không cho xuất quá tồn, hiển thị "Không đủ tồn — không thể xuất quá số tồn hiện có." (FR-26, UX-DR-19).
- **Given** một lần xuất bị chặn, **When** xử lý, **Then** publish event `StockOutBlocked` qua EventBus (không đẩy FCM trực tiếp) (AD-18).
- **Given** thao tác xuất, **When** kiểm tồn, **Then** kiểm và trừ tồn thực hiện ở backend, client chỉ hiển thị kết quả (AD-2).

## Epic 7: Thanh toán, Hợp đồng & Hoá đơn
_Lịch thanh toán nhiều đợt; ghi nhận đợt → auto chuyển trạng thái (publish DepositRecorded/PaymentRecorded); sinh HĐ Thi công/Mua bán (PDF); tạo hoá đơn (DB + PDF). FR-11,12,13,27,28._

### Story 7.1: Cấu hình Lịch thanh toán nhiều đợt
As a người có quyền, I want cấu hình Lịch thanh toán các đợt (%/số tiền + điều kiện), So that đơn có kế hoạch thu tiền rõ ràng.
**Acceptance Criteria:**
- **Given** một Đơn, **When** cấu hình lịch, **Then** tạo `PaymentSchedule` + `Installment` hỗ trợ nhiều đợt (vd 20/70/10), một đợt 100%, hoặc tuỳ chỉnh; mỗi đợt có % hoặc số tiền + mô tả điều kiện (FR-11).
- **Given** tổng các đợt, **When** lưu, **Then** cảnh báo nếu tổng ≠ tổng sau VAT của Đơn (FR-11).
- **Given** tiền các đợt, **When** tính, **Then** là integer đồng, không float (AD-10).

### Story 7.2: Ghi nhận thanh toán → auto chuyển trạng thái
As a người có quyền ghi nhận thanh toán, I want ghi tiền theo từng đợt và để trạng thái tự nhảy, So that công nợ và vòng đời đơn tự cập nhật không cần thao tác riêng.
**Acceptance Criteria:**
- **Given** một đợt thanh toán, **When** ghi nhận (qua Dialog xác nhận), **Then** tạo `Payment`, cập nhật trạng thái thanh toán của Đơn, ghi Audit (FR-12, UX-DR-20).
- **Given** ghi đủ đợt cọc đầu, **When** xử lý, **Then** gọi `applyTransition()` để Đơn tự sang "Đã cọc" (không ghi status trực tiếp) (FR-8, FR-12, AD-11).
- **Given** thao tác tiền, **When** retry, **Then** idempotent, không ghi trùng; publish event `DepositRecorded`/`PaymentRecorded` qua EventBus (NFR-1, AD-18).

### Story 7.3: Sinh Hợp đồng Thi công / Mua bán (PDF)
As a người có quyền sinh hợp đồng, I want sinh HĐ từ Đơn theo loại phù hợp, So that có văn bản ký kết điền sẵn dữ liệu đơn.
**Acceptance Criteria:**
- **Given** cờ phạm vi của Đơn, **When** sinh hợp đồng, **Then** Đơn có cờ Thi công → HĐ Thi công; Đơn chỉ Thiết bị → HĐ Mua bán (FR-13).
- **Given** template tĩnh, **When** sinh, **Then** chỉ điền dữ liệu động (hai bên, danh mục/giá, tổng, lịch thanh toán, tham chiếu số báo giá); điều khoản cố định không sửa theo đơn (FR-13).
- **Given** file PDF, **When** lưu, **Then** binary ở R2, DB lưu metadata + object key; entity `Contract` gắn `orderId`; sinh hợp đồng ghi Audit (FR-13, AD-3).

### Story 7.4: Tạo Hoá đơn từ Đơn (lưu DB)
As a người có quyền tạo hoá đơn, I want tạo Hoá đơn từ Đơn, So that lưu chứng từ hoá đơn nội bộ gắn đơn.
**Acceptance Criteria:**
- **Given** một Đơn, **When** tạo Hoá đơn, **Then** entity `Invoice` lấy khách hàng (MST), các Dòng, VAT, tổng tiền từ Đơn; lưu số hoá đơn nội bộ + ngày + link Đơn (FR-27).
- **Given** hoá đơn tạo, **When** lưu, **Then** ghi Audit qua event; tiền là integer đồng (FR-27, AD-10, AD-18).

### Story 7.5: Xem & xuất Hoá đơn PDF
As a người có quyền, I want xem lại và xuất PDF Hoá đơn, So that in/gửi hoá đơn khi cần.
**Acceptance Criteria:**
- **Given** một Hoá đơn đã tạo, **When** xem, **Then** hiển thị số, ngày, tổng tiền, gắn đúng Đơn (FR-28).
- **Given** hoá đơn, **When** xuất, **Then** tạo PDF, binary ở R2, chia sẻ/download tương tự báo giá (FR-28, AD-3).

## Epic 8: Quản trị — Dashboard, Phân quyền & Audit
_Dashboard doanh thu/đơn theo trạng thái; màn phân quyền (ma trận per-account + áp preset role) + form account; màn xem Audit log (chỉ Super Admin). Ghi audit là cross-cutting, đã emit ở E3–E7. FR-16,17,18,19,20._

### Story 8.1: Dashboard vận hành
As a người có quyền xem dashboard, I want xem doanh thu theo ngày/tuần/tháng và đếm đơn theo trạng thái, So that nắm toàn cảnh vận hành bất cứ lúc nào.
**Acceptance Criteria:**
- **Given** mốc thời gian chọn, **When** xem dashboard, **Then** hiển thị doanh thu theo ngày/tuần/tháng + số lượng đơn + tổng hợp đơn theo từng Trạng thái, dùng KPI + chart component (FR-19, UX-DR-12).
- **Given** quyền "xem dashboard tài chính", **When** render, **Then** chỉ account có quyền mới thấy số liệu doanh thu; account thiếu quyền vẫn xem được đếm đơn nhưng không thấy tiền (FR-19, UX-DR-22).
- **Given** dữ liệu tổng hợp, **When** tính, **Then** tính ở backend (`dashboard/`), client chỉ hiển thị (AD-2).

### Story 8.2: Màn phân quyền — ma trận per-account + áp preset Role
As a Admin, I want màn ma trận Quyền theo Account với nút áp preset Role, So that cấp đúng quyền cho từng người nhanh gọn.
**Acceptance Criteria:**
- **Given** một Account chọn, **When** áp preset Role, **Then** nạp giá trị quyền mặc định rồi cho tick/bỏ từng ô; nguồn chân lý là bộ quyền trên Account, không phải Role (FR-17, AD-8).
- **Given** sửa quyền một Account, **When** lưu, **Then** KHÔNG ảnh hưởng Account khác cùng Role; đổi định nghĩa preset Role sau này không hồi tố Account đã tạo (FR-17).
- **Given** ma trận quyền, **When** render, **Then** dùng key từ registry chính tắc (Epic 2), không literal ngoài registry (AD-17).

### Story 8.3: Form tạo/sửa/vô hiệu hoá Account
As a Admin, I want tạo/sửa/vô hiệu hoá Account và chọn Role preset lúc tạo, So that quản lý người dùng nội bộ.
**Acceptance Criteria:**
- **Given** tạo Account, **When** chọn Role preset, **Then** nạp bộ quyền mặc định của preset vào Account (FR-16).
- **Given** một Account, **When** vô hiệu hoá, **Then** account không đăng nhập được nhưng dữ liệu/lịch sử giữ nguyên (FR-16).
- **Given** thay đổi account, **When** lưu, **Then** ghi Audit qua event (FR-16, AD-18).

### Story 8.4: Cấu hình ma trận quyền hành động & duyệt
As a Admin, I want mỗi quyền chuyển trạng thái và quyền duyệt là một mục ma trận cấu hình được, So that phân quyền linh hoạt không hardcode.
**Acceptance Criteria:**
- **Given** các quyền hành động/duyệt, **When** cấu hình, **Then** mỗi quyền chuyển từng Trạng thái + quyền duyệt (chiết khấu và bước cần duyệt) là entry cấu hình được, không hardcode (FR-18).
- **Given** phạm vi xem đơn, **When** khai báo, **Then** "xem tất cả đơn" và "đơn của mình" là hai entry tường minh trong registry (FR-18, AD-17).
- **Given** một chiết khấu, **When** áp, **Then** cần duyệt bởi account có quyền duyệt chiết khấu (không hạn mức tự quyết) (FR-18).

### Story 8.5: Màn xem Audit log (chỉ Super Admin)
As a Super Admin, I want xem nhật ký Audit bất biến, So that có bằng chứng minh bạch mọi hành động.
**Acceptance Criteria:**
- **Given** AuditLog append-only (đã ghi cross-cutting ở E2–E7), **When** xem, **Then** mỗi bản ghi có ai/làm gì/đối tượng/khi nào/trước→sau; bản ghi không sửa/xoá được (FR-20, AD-8).
- **Given** quyền xem Audit, **When** render nav, **Then** CHỈ account Super Admin thấy mục Audit; mọi account khác không thấy trong nav/menu (FR-20, UX-DR-22).
- **Given** màn Audit, **When** dựng, **Then** dùng Table + bộ lọc theo thời gian/đối tượng, parity web (mobile qua Menu) (FR-20).

## Epic 9: Thông báo đẩy (lắp bộ gửi phía sau port)
_Firebase mobile (FCM/Crashlytics/Analytics/Remote Config); đăng ký device token; subscribe domain event → resolve người nhận THEO QUYỀN (AD-15/17) + người phụ trách đơn, lọc theo quyền xem → gửi FCM; hộp thư in-app; bật/tắt theo loại; nhắc theo lịch. Lắp sau EventBus port của Epic 2 — không mở lại E4–E7. FR-30,31,32,33,34._

### Story 9.1: Thiết lập Firebase mobile
As a lập trình viên mobile, I want tích hợp Firebase (FCM/Crashlytics/Analytics/Remote Config), So that mobile nhận push và có telemetry cơ bản.
**Acceptance Criteria:**
- **Given** app Flutter, **When** cấu hình Firebase, **Then** tích hợp FCM (push), Crashlytics, Analytics, Remote Config (AD-14).
- **Given** Remote Config, **When** dùng, **Then** CHỈ cho config/feature-flag cấp app — KHÔNG thay business flag (business flag ở DB là nguồn chân lý) (AD-14).

### Story 9.2: Đăng ký/gỡ Device token
As a người dùng nội bộ, I want thiết bị đăng ký/gỡ token khi đăng nhập/đăng xuất, So that push đến đúng thiết bị của tôi.
**Acceptance Criteria:**
- **Given** đăng nhập, **When** app lấy FCM token, **Then** đăng ký vào entity `DeviceToken` gắn `accountId`; một account có nhiều token (FR-30).
- **Given** đăng xuất hoặc token không hợp lệ, **When** xử lý, **Then** gỡ token khỏi hệ thống (FR-30).

### Story 9.3: Resolve người nhận theo QUYỀN + gửi FCM (subscribe event)
As a người dùng nội bộ, I want nhận push đúng theo quyền và vai trò với đơn, So that đúng người biết việc mà không lộ đơn cho người không có quyền xem.
**Acceptance Criteria:**
- **Given** một domain event (đã publish ở E4–E7 qua EventBus), **When** `notifications/` subscribe, **Then** resolve người nhận THEO QUYỀN (ma trận per-account §4.6, qua registry AD-17) + `ownerAccountId`/`assigneeAccountId` của Đơn (AD-15, FR-31).
- **Given** người nhận resolve xong, **When** lọc, **Then** luôn lọc theo quyền xem đơn ("xem tất cả đơn" vs "đơn của mình") off cùng hai trường owner/assignee — không đẩy nội dung đơn cho account không có quyền xem (AD-15, FR-31).
- **Given** danh sách người nhận cuối, **When** gửi, **Then** gửi FCM qua `firebase-admin`, payload mang `{ type, targetId, deeplink }` mở đúng màn/đơn; bộ gửi này thay dispatcher no-op mà không mở lại code E4–E7 (FR-31, AD-18).

### Story 9.4: Hộp thư in-app (đã đọc/chưa đọc + badge)
As a người dùng nội bộ, I want xem lịch sử thông báo trong app với trạng thái đọc và badge, So that không bỏ lỡ việc kể cả khi không thấy push.
**Acceptance Criteria:**
- **Given** một noti gửi tới account, **When** lưu, **Then** entity `Notification` theo account với trạng thái đã đọc/chưa đọc (FR-32).
- **Given** hộp thư, **When** mở, **Then** hiển thị lịch sử noti + badge đếm chưa đọc; bấm noti mở deep-link đúng màn/đơn (FR-32).
- **Given** web (Phase 1 không push trình duyệt), **When** dùng, **Then** web dùng hộp thư in-app + badge tương đương (FR-32).

### Story 9.5: Tuỳ chọn thông báo theo loại
As a người dùng nội bộ, I want bật/tắt push theo từng loại noti, So that chỉ nhận thông báo tôi quan tâm.
**Acceptance Criteria:**
- **Given** danh sách loại noti, **When** người dùng bật/tắt một loại, **Then** lưu preference theo account (FR-33).
- **Given** một loại đã tắt, **When** có event loại đó, **Then** không gửi push cho account đó nhưng vẫn tôn trọng lọc quyền (FR-33).

### Story 9.6: Nhắc theo lịch (báo giá sắp hết hạn, lead nguội)
As a người phụ trách đơn, I want nhận nhắc khi báo giá sắp hết hạn hoặc lead nguội, So that chăm đơn kịp thời không để nguội.
**Acceptance Criteria:**
- **Given** job nền theo lịch, **When** tới ngưỡng cấu hình, **Then** phát noti #11 (báo giá sắp hết hiệu lực) và #12 (lead nguội) tới người phụ trách đơn (FR-34).
- **Given** noti nhắc, **When** resolve người nhận, **Then** đi qua cùng resolver theo quyền + owner/assignee, lọc theo quyền xem đơn (AD-15, FR-34).
- **Given** ngưỡng thời gian, **When** cấu hình, **Then** ngưỡng "sắp hết hạn" và "lead nguội" là config, không hardcode (FR-34).
