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

- FR-1..FR-6: Epic 4 — Báo giá/giỏ hàng, cờ phạm vi, VAT, chốt+snapshot, versioning
- FR-7, FR-8, FR-9, FR-10: Epic 5 — máy trạng thái, auto-transition, danh sách/follow-up
- FR-11, FR-12: Epic 7 — lịch thanh toán + ghi nhận (chặn đợt đầu 0%)
- FR-13: Epic 7 — sinh hợp đồng
- FR-14, FR-15: Epic 3 — danh mục vật tư (+ cột costPrice, tracksStock, priceEditable, warrantyMonths) + giá phân tầng
- FR-16, FR-17, FR-18: Epic 8 — phân quyền/account (engine ở Epic 2, luật không-leo-thang ở E2); phân quyền gate cấu hình ngôn ngữ (settings.manage)
- FR-19: Epic 8 — dashboard
- FR-20: Epic 8 — audit log (màn xem, gate theo quyền audit.read); ghi audit cross-cutting E3–E7
- FR-21: Epic 4 — xuất PDF + share
- FR-22: Epic 1 (UI đăng nhập demo) + Epic 2 (auth thật + quyền, 20 quyền)
- FR-23, FR-24: Epic 5 — đính kèm ảnh
- FR-25, FR-26: Epic 6 — tồn kho (hai con số onHand+reserved), phiếu kho (+ bình quân gia quyền), chặn ở xuất không chốt, StockMovement idempotent, phiếu nhập trả
- FR-27, FR-28: Epic 7 — hoá đơn (DB + PDF)
- FR-29: Epic 3 — khách hàng (SĐT khoá chính, + sourceId/sourceNote; danh mục Nguồn khách E3.5; gói vật tư E3.6)
- FR-30, FR-31, FR-32, FR-33, FR-34: Epic 9 — thông báo đẩy
- FR-35: Epic 3 — nguồn khách (3.5, 3.3) · Epic 4 — snapshot `Order.sourceId` (4.1)
- FR-36: Epic 4 — bảo hành theo dòng (4.9) · Epic 5 — tra cứu theo SĐT (5.9)
- FR-37: Epic 6 — giá vốn & snapshot lúc xuất (6.3, 6.4) · Epic 8 — báo cáo lợi nhuận gộp (8.6)
- Epic 10 (chạy TRƯỚC Epic 8): không FR mới — nối client web/mobile vào backend cho FR-1..FR-29 (FR-22 đăng nhập thật), thống nhất contract tiếng Anh (TD-38, TD-39)
- Epic 11 (chạy sau Epic 10, TRƯỚC Epic 8): không FR mới. Chuyển state mobile sang BLoC, giữ nguyên hành vi các FR đã có trên mobile (đóng H-4)


## Epic List

## Epic List

### Epic 1: Design System & App Shell (làm trước — AD-13)
Dựng tầng design system từ DESIGN.md cho CẢ web lẫn mobile trước mọi màn tính năng: token → thư viện component React (web) → thư viện widget Flutter (mobile) → app shell (topbar, bottom-nav 5-tab + FAB, sidebar, frame, icon SVG sprite) → màn Đăng nhập dựng thật để chứng minh design system dùng được. Thêm chip "Đã giao" vào 9 chip trạng thái (10 chip). Ship kèm 1 màn, không phải thư viện treo kệ.
**FRs covered:** FR-22 (UI đăng nhập, demo) · UX-DR-1..27

### Epic 2: Nền tảng Backend & Đăng nhập/Quyền
Backend skeleton (NestJS + PostgreSQL + OpenAPI sinh-từ-code + error-envelope + central error handler); xác thực JWT access+refresh thật; permission registry (20 quyền: 17 cũ + 3 mới: settings.manage, system.feature_flags, costs.view) + endpoint /me + UI gating theo quyền; quên mật khẩu; hồ sơ; luật không-leo-thang quyền (không cấp quyền mình không có, không sửa account mang quyền mình không có); source-guard (mọi handler không @Public phải có @RequirePermissions). CHỪA SẴN **Domain Event port + Notification dispatcher (no-op/log)** để các epic sau publish event — producer không gọi FCM trực tiếp.
**FRs covered:** FR-22

### Epic 3: Danh mục vật tư & Khách hàng & Nguồn khách & Gói vật tư
CRUD sản phẩm + giá phân tầng (sau cờ) + cột mới (costPrice, tracksStock, priceEditable, warrantyMonths); CRUD khách hàng (SĐT E.164 khoá chính, thêm sourceId/sourceNote) + tra SĐT chọn/tạo mới inline; danh mục Nguồn khách (5 dòng seed, gate settings.manage); gói vật tư (ProductGroup/ProductGroupItem checklist).
**FRs covered:** FR-14, FR-15, FR-29

### Epic 4: Báo giá, Chốt & Duyệt chiết khấu (trái tim)
Giỏ hàng + cờ phạm vi + VAT qua /orders/preview-total; chốt + snapshot giá; sửa đơn = bản update + lịch sử; xuất PDF + share ảnh; chọn/tạo khách inline; áp + duyệt chiết khấu. Mỗi hành động **publish domain event** (OrderConfirmed, DiscountRequested/Resolved…).
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-21

### Epic 5: Vòng đời đơn & Thi công & Bảo hành (nhánh cá nhân)
applyTransition engine gate theo cờ + auto-transition; danh sách đơn (+ follow-up + empty/loading/error); chi tiết đơn (stepper + tabs + lịch sử bản update); chuyển trạng thái + đính kèm ảnh (optional); huỷ đơn kèm lý do (publish `OrderCancelled` làm seam cho tồn kho Epic 6.7); nhánh Thi công (bỏ "Lên lịch", Đang thi công→Nghiệm thu); tra cứu bảo hành theo SĐT. **Publish StatusChanged + OrderCancelled event.**
**FRs covered:** FR-7, FR-8, FR-9, FR-10, FR-23, FR-24, FR-36

### Epic 6: Giao hàng & Tồn kho (nhánh bỏ mối)
Nhánh Giao hàng (Đang giao→Đã giao, gate cờ Thiết bị) dùng lại engine E5; tồn kho hiện tại (onHand + reserved + khả dụng); phiếu nhập/xuất + bình quân gia quyền giá vốn; xuất kho gắn đơn (một đơn một phiếu, snapshot costPriceSnapshot lúc xuất); chặn ở khâu xuất (không chặn chốt); StockMovement ledger (idempotent); phiếu nhập trả khi huỷ đơn đã xuất (**publish StockOutBlocked/StockIssued event**).
**FRs covered:** FR-25, FR-26

### Epic 7: Thanh toán, Hợp đồng & Hoá đơn
Lịch thanh toán nhiều đợt; ghi nhận đợt → auto chuyển trạng thái (**publish DepositRecorded/PaymentRecorded event**); sinh HĐ Thi công/Mua bán (PDF); tạo hoá đơn (lưu DB + PDF).
**FRs covered:** FR-11, FR-12, FR-13, FR-27, FR-28

### Epic 10: Nối dây client (chạy TRƯỚC Epic 8 — chèn bởi correct-course 2026-10-22)
**Thứ tự chạy: Epic 7 → Epic 10 → Epic 8 → Epic 9.** Số 10 chỉ để không đánh số lại Epic 8/9. Thống nhất contract tiếng Anh (đổi route/tham số/field DTO tiếng Việt) TRƯỚC khi client thật dùng; web có client sinh từ `openapi.json` + tầng transport + phiên đăng nhập + composition root + router + adapter HTTP thay fake cho mọi port; mobile có app shell `main.dart` + `android/`/`ios/` + client Dart sinh + điều hướng + adapter; nối callback theo quyền cho nút Thanh toán/Hợp đồng/Hoá đơn ở chi tiết đơn. Không thêm FR mới — làm cho FR-1..FR-29 đã có backend dùng được đầu-cuối. [Source: `sprint-change-proposal-2026-10-22.md`]
**FRs covered:** FR-22 (đăng nhập thật trên hai client; từ 10.9 đăng nhập bằng SĐT) · đưa FR-1..FR-29 lên client thật · AD-12 (client sinh từ OpenAPI) · AD-5 (FE xử lý envelope một chỗ)

### Epic 11: Chuyển mobile sang BLoC (chạy TRƯỚC Epic 8, chèn bởi correct-course 2026-10-23)
**Thứ tự chạy: Epic 7 → Epic 10 → Epic 11 → Epic 8 → Epic 9.** Đại Ca chốt 2026-10-23 (đóng H-4 retro E10): mobile BẮT BUỘC dùng BLoC (`flutter_bloc` + `bloc_test`), chuyển hết 19 màn `StatefulWidget` ở `mobile/lib/screens/` cùng state cấp app (pha phiên của `PnsApp`, `PermissionsProvider`) sang Cubit/Bloc trước Epic 8. Màn chỉ render state và gửi sự kiện; chỉ cubit gọi port; cubit nhận port qua constructor từ composition root. Tách bộ sinh client Dart ra package riêng để `bloc_test` giải được trên Flutter 3.35 (client sinh giữ nguyên từng byte). Guard "màn không gọi port" có allowlist co dần, rỗng ở 11.4. Không đổi hành vi người dùng thấy; test widget hiện có là lưới an toàn. Không FR mới. [Source: `sprint-change-proposal-2026-10-23.md`]
**FRs covered:** không FR mới. Giữ nguyên hành vi FR-1..FR-29, FR-36 trên mobile · AD-12 (luật state mobile) · AD-13 (màn vẫn dùng design system)

### Epic 8: Quản trị — Dashboard, Phân quyền, Audit & Báo cáo lợi nhuận
Dashboard doanh thu/đơn theo trạng thái; màn phân quyền (ma trận per-account + áp preset role, luật không-leo-thang) + form account; màn xem Audit log (gate theo quyền audit.read, không role); báo cáo lợi nhuận gộp (một bảng, bốn cách nhóm: đơn/tháng/sale/nguồn khách, dòng KPI trên cùng, nhãn bắt buộc). (Ghi audit là cross-cutting, nhúng ở E3–E7.) **Mobile: BLoC từ đầu** (correct-course 2026-10-23): màn mobile của epic này (8.1 Trang chủ, 8.5 Audit qua Menu…) dựng Cubit/Bloc theo luật Epic 11, nằm trong guard "màn không gọi port". Chạy sau Epic 11.
**FRs covered:** FR-16, FR-17, FR-18, FR-19, FR-20

### Epic 9: Thông báo đẩy (lắp bộ gửi phía sau port)
Firebase mobile (FCM + Crashlytics + Analytics + Remote Config); đăng ký device token; **subscribe domain event → resolve người nhận THEO QUYỀN (AD-15/17) + người phụ trách đơn → gửi FCM**; hộp thư in-app; bật/tắt theo loại; nhắc theo lịch (báo giá sắp hết hạn, lead nguội). Không đụng lại logic nghiệp vụ E4–E7. **Mobile: BLoC từ đầu** (correct-course 2026-10-23): màn và state mobile của epic này (đăng ký token qua cubit phiên, hộp thư, tuỳ chọn thông báo) dựng Cubit/Bloc theo luật Epic 11, nằm trong guard "màn không gọi port".
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

### Story 1.12: Thêm chip trạng thái "Đã giao" vào design system (9 → 10 chip)
As a lập trình viên nền tảng, I want thêm chip trạng thái "Đã giao" (`dagiao`) vào StatusChip trên cả web và mobile, So that vòng đời đơn có đủ bước giao hàng và parity test cập nhật.
**Acceptance Criteria:**
- **Given** 9 chip trạng thái đã có, **When** thêm chip mới, **Then** thêm chip `dagiao: 'Đã giao'` với bộ 3 hex fg/bg/border đúng theo quy tắc thiết kế "Viền nét" và màu Năng Lượng Sạch; tổng cộng 10 chip (UX-DR-8).
- **Given** file `web/src/design-system/components/StatusChip.tsx`, **When** sửa, **Then** thêm `dagiao` vào enum/object status colors, không sửa 9 chip cũ (ad-hoc additive, không breaking) (UX-DR-8).
- **Given** thư viện widget Flutter, **When** cập nhật tương đương, **Then** thêm widget `DaGiaoChip` hoặc tương đương trên mobile, cùng bộ màu (UX-DR-8).
- **Given** parity test (`design-system/session/parity.test.mjs`), **When** chạy, **Then** kiểm 10 chip match toàn bộ trên cả web và mobile, không thiếu hoặc sai màu (UX-DR-27).

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

### Story 2.9: Ba quyền mới vào registry + role-presets + bất biến test + sinh lại openapi/permissions.json
As a lập trình viên backend, I want thêm ba quyền mới (`settings.manage`, `system.feature_flags`, `costs.view`) vào registry chính tắc + cập nhật role-presets + thêm bất biến test, So that phân quyền phủ toàn bộ nhóm tính năng mới.
**Acceptance Criteria:**
- **Given** ba quyền mới từ PRD §5, **When** append vào `permission-registry.ts`, **Then** thêm cuối registry theo thứ tự deterministic: `settings.manage` (cấu hình danh mục), `system.feature_flags` (cờ tính năng), `costs.view` (xem giá vốn & lợi nhuận) **And** không đổi thứ tự 17 key cũ (AD-17).
- **Given** `role-presets.ts`, **When** cập nhật, **Then** thêm `costs.view` vào preset `ADMIN`, `KE_TOAN`, `QUAN_LY`; thêm `settings.manage` **chỉ** vào `ADMIN` (→ `SUPER_ADMIN` thừa hưởng qua spread; không `QUAN_LY`/`KE_TOAN`/roles khác — cấu hình doanh nghiệp là việc của chủ, theo PRD §5); `system.feature_flags` **chỉ** ở `SUPER_ADMIN`, không append ở `ADMIN_PRESET` (AC-3) **And** sửa comment sai dòng ~13 (câu "một account Admin được chỉ định là Super Admin" sai — nên là "SUPER_ADMIN = người vận hành app, ngoài tổ chức khách") (FR-18, AC-3).
- **Given** bất biến `system.feature_flags`, **When** test ở `role-presets.spec.ts`, **Then** viết test khẳng định `system.feature_flags` KHÔNG nằm ở `ADMIN_PRESET`, chỉ append vào `SUPER_ADMIN` (cùng khuôn test `audit.read`) (AC-3).
- **Given** ba quyền mới thêm vào registry, **When** build, **Then** artifact `openapi/permissions.json` được sinh lại, cập nhật danh sách key + định nghĩa (AD-12, AD-17).

### Story 2.10: Luật không-leo-thang quyền + source-guard trong account-permissions.service.ts
As a lập trình viên backend, I want thực thi luật không-leo-thang (không cấp quyền mình không có, không sửa/vô hiệu hoá account mang quyền mình không có) + source-guard, So that phân quyền an toàn không cho chủ tự gia tăng quyền hay xoá Super Admin.
**Acceptance Criteria:**
- **Given** hành động cấp quyền cho account khác ở `setForAccount()`, **When** execute, **Then** kiểm: người gọi có toàn bộ quyền chuẩn bị cấp không? KHÔNG → từ chối (luật #1: không cấp quyền mình không có) **And** publish event ghi Audit khi cấp quyền (AD-18, FR-18).
- **Given** hành động sửa/vô hiệu hoá account, **When** execute, **Then** kiểm: account target có quyền mà người gọi không có không? CÓ → từ chối; KHÔNG → cho sửa (luật #2: không sửa account mang quyền mình không có) (FR-18).
- **Given** source-guard tại `CONVENTIONS.md:137`, **When** scan (dùng test `src/**/*.controller.ts`), **Then** khẳng định: "mọi handler không @Public phải có @RequirePermissions"—nếu handler public quay mà quên permission guard, test fail (AD-4, NFR-7) **And** Story này phải xong TRƯỚC Epic 3 (vì E3+ đụng giá vốn `Product.costPrice`, nếu route quên permission → mọi user đọc được giá vốn).

## Epic 3: Danh mục vật tư & Khách hàng
_CRUD sản phẩm + giá phân tầng (sau cờ); CRUD khách hàng (SĐT E.164 khoá chính) + tra SĐT chọn/tạo mới inline (FR-14, FR-15, FR-29)._

### Story 3.1: CRUD Sản phẩm & giá + cột mới (costPrice, tracksStock, priceEditable, warrantyMonths)
As a người có quyền sửa danh mục, I want thêm/sửa/xoá Sản phẩm và cập nhật giá bất kỳ lúc nào, So that báo giá luôn lấy giá mới nhất từ danh mục.
**Acceptance Criteria:**
- **Given** quyền "sửa danh mục & giá", **When** tạo/sửa/xoá Sản phẩm (tên, đơn vị, giá), **Then** thay đổi lưu vào entity `Product` và phản ánh ngay vào báo giá đang dựng (chưa chốt) **And** thêm cột: `costPrice` (giá vốn, integer đồng), `tracksStock` (boolean — pin/inverter/battery/dây=true; công lắp/phí lắp=false), `priceEditable` (phí lắp đặt=true; tấm pin=false), `warrantyMonths` (bảo hành mặc định tính bằng tháng, nullable) (FR-14, §2, §3).
- **Given** một Đơn đã chốt, **When** sửa giá danh mục, **Then** KHÔNG hồi tố đơn đã chốt (FR-14, ánh xạ FR-5).
- **Given** mọi thay đổi Sản phẩm/giá, **When** lưu, **Then** publish domain event → ghi Audit log (ai/gì/trước→sau) (FR-14, AD-18).

### Story 3.2: Giá phân tầng sau cờ
As a người có quyền sửa danh mục, I want bật/tắt giá phân tầng (lẻ/sỉ), So that hệ thống hỗ trợ nhiều mức giá khi cần mà mặc định vẫn đơn giản.
**Acceptance Criteria:**
- **Given** cờ giá phân tầng mặc định TẮT, **When** xem Sản phẩm, **Then** mỗi Sản phẩm một giá duy nhất (FR-15).
- **Given** cờ giá phân tầng BẬT, **When** cấu hình giá, **Then** lưu nhiều mức qua entity `ProductPrice` và chọn mức theo ngữ cảnh (vd theo Loại khách) (FR-15).
- **Given** cờ là business flag, **When** lưu, **Then** cờ nằm trong DB là nguồn chân lý, không đặt ở Remote Config (AD-14).

### Story 3.3: CRUD Khách hàng — SĐT E.164 khoá chính, chặn trùng, thêm sourceId/sourceNote
As a người có quyền quản lý khách hàng, I want tạo/sửa Khách hàng với SĐT là khoá chính chuẩn hoá E.164 và ghi nguồn, So that mỗi khách định danh duy nhất và biết khách từ đâu.
**Acceptance Criteria:**
- **Given** một SĐT thô do client gửi, **When** backend lưu Khách hàng, **Then** domain `customers` chuẩn hoá về E.164 (`+84…`) — client KHÔNG tự chuẩn hoá; PK của `Customer` là SĐT chuẩn hoá (AD-9).
- **Given** Loại khách, **When** nhập dữ liệu, **Then** Cá nhân lưu họ tên/CCCD/địa chỉ/SĐT; Thương mại lưu tên/MST/địa chỉ/SĐT/tài khoản NH (FR-29).
- **Given** một SĐT đã tồn tại (sau chuẩn hoá), **When** tạo khách trùng SĐT, **Then** hệ thống chặn tạo trùng (một SĐT = một Khách hàng) (FR-29) **And** thay đổi khách ghi Audit qua event.
- **Given** Khách hàng mới, **When** nhập dữ liệu, **Then** `sourceId` (FK → `CustomerSource`) **bắt buộc, KHÔNG có mặc định** trên form; `sourceNote` (mô tả tự do) **bắt buộc KHI nguồn có cờ `isOther`** (§1).

### Story 3.4: Tra SĐT chọn/tạo khách inline + màn danh sách/chi tiết khách
As a người có quyền quản lý khách hàng, I want tra SĐT để chọn khách cũ hoặc tạo mới ngay tại chỗ, So that dựng đơn nhanh mà không rời màn.
**Acceptance Criteria:**
- **Given** một SĐT nhập trong luồng tra cứu, **When** backend tra, **Then** chạy cùng bộ chuẩn hoá E.164 trước khi kiểm tra tính duy nhất; trùng → trả khách cũ để điền sẵn (AD-9, FR-29).
- **Given** SĐT không tìm thấy, **When** hiển thị kết quả, **Then** hiện "SĐT chưa có trong hệ thống." + nút "Tạo khách hàng mới" inline (FR-29, UX-DR-19).
- **Given** màn Danh sách khách + Chi tiết khách, **When** dựng, **Then** dùng Table + trạng thái empty/loading/error, xem được thông tin theo Loại khách; parity web+mobile (FR-29).

### Story 3.5: Danh mục Nguồn khách — CRUD + Seed + Cấu hình (gate `settings.manage`)
As a người có quyền cấu hình hệ thống, I want quản lý danh mục Nguồn khách (bảng `CustomerSource`), So that mỗi khách ghi rõ nguồn mà nó đến.
**Acceptance Criteria:**
- **Given** danh mục Nguồn khách, **When** backend seed, **Then** tạo 5 dòng: Facebook, Zalo, Fanpage, Đại lý, Khác, mỗi dòng có `name`, `description` (một câu để phân biệt, vd "Fanpage — khách inbox trang công ty"), `active` (boolean), `sortOrder` (int), `isOther` (boolean — **chỉ một** dòng có `isOther=true`) (§1).
- **Given** dòng Nguồn "Khác" có `isOther=true`, **When** xử lý, **Then** backend nhận biết "Khác" bằng cờ `isOther`, KHÔNG bằng so chuỗi tên; dòng này KHÔNG xoá, KHÔNG deactivate được (§1).
- **Given** sửa Nguồn khách, **When** đổi tên, **Then** ghi Audit log (không chặn được việc đổi nghĩa, chỉ ghi vết) (§1, AD-18).
- **Given** xoá Nguồn khách, **When** soft-delete, **Then** set `active=false` (hard delete bị chặn, vì khách cũ vẫn trỏ vào) (§1).
- **Given** màn cấu hình Nguồn khách, **When** render, **Then** gate bởi quyền `settings.manage` (chỉ user có quyền này mới xem được); dùng Table + button CRUD (FR-18, AD-17, UX-DR-10).

### Story 3.6: Gói vật tư — ProductGroup/ProductGroupItem + Checklist trên UI
As a người có quyền sửa danh mục, I want tạo gói vật tư là danh sách sản phẩm con, So that user chọn gói → hiện list item → tick → thành dòng.
**Acceptance Criteria:**
- **Given** khái niệm Gói vật tư, **When** thiết kế, **Then** Gói là **checklist trên UI**, KHÔNG phải sản phẩm, KHÔNG phải dòng tự do; entity `ProductGroup` + `ProductGroupItem { productId }` (§2).
- **Given** user chọn gói, **When** dựng báo giá, **Then** hiện danh sách sản phẩm con, user tick từng item, **mỗi item tick thành một `OrderLineItem` bình thường** trỏ vào `Product` thật (KHÔNG snapshot, KHÔNG BOM, KHÔNG lưu gói lên Đơn) (§2).
- **Given** item gói được tick, **When** thêm, **Then** user nhập số lượng, giá = giá item × số lượng, KHÔNG có giá trọn gói mặc định (§2).
- **Given** gói vật tư, **When** xem chi tiết đơn, **Then** gói KHÔNG hiển thị (in PDF), chỉ thấy dòng item tách ra từ gói (Phase 1 KHÔNG BOM, không cần) (§2).

## Epic 4: Báo giá, Chốt & Duyệt chiết khấu (trái tim)
_Giỏ hàng + cờ phạm vi + VAT qua `/orders/preview-total`; chốt + snapshot giá; sửa đơn = bản update mới + lịch sử; xuất PDF + share ảnh; áp + duyệt chiết khấu. Mỗi hành động nghiệp vụ publish domain event (AD-18). FR-1..6, FR-21._

### Story 4.1: Tạo Đơn + dựng giỏ hàng + snapshot Order.sourceId (Order/OrderVersion/OrderLineItem)
As a người có quyền tạo báo giá, I want tạo Đơn mới và thêm/sửa/xoá Dòng báo giá, So that dựng báo giá kiểu giỏ hàng ngay tại hiện trường.
**Acceptance Criteria:**
- **Given** mô hình dữ liệu, **When** tạo Đơn, **Then** `OrderVersion` sở hữu TẤT CẢ line item, `Order` không sở hữu line trực tiếp; `Order` có `ownerAccountId` + `assigneeAccountId` (nullable); mọi đọc dòng phân giải qua `currentVersionId` (AD-6, AD-15).
- **Given** một Dòng báo giá, **When** thêm/sửa/xoá, **Then** hỗ trợ dòng pick từ Sản phẩm (auto-điền đơn giá theo danh mục hiện tại, trước chốt) và dòng tự do/gói nhập tay (tên nhiều dòng, đơn vị, số lượng, đơn giá, diễn giải); cờ "linh động/dự kiến" chỉ hiển thị (FR-1, UX-DR-24).
- **Given** tạo Đơn, **When** lưu, **Then** publish domain event `OrderCreated` qua EventBus (AD-18) **And** chọn Khách hàng qua tra SĐT (Epic 3).
- **Given** tạo Đơn từ Khách hàng có `sourceId`, **When** lưu Đơn, **Then** **snapshot `Order.sourceId` lúc tạo**, copy từ `Customer.sourceId` (lý do: khách quay lại qua kênh khác thì `Customer.sourceId` đổi, nhưng đơn cũ phải giữ nguyên kênh đã mang nó về — cùng bài học với `unitPriceSnapshot`, FR-5) (§1).
- **Given** dòng phí lắp đặt (Product có `priceEditable=true`), **When** thêm vào đơn, **Then** dòng này có `priceEditable=true`, giá có thể sửa; gói vật tư đẻ ra dòng trỏ Product thật (mỗi item gói thành một dòng item bình thường) (§2).

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

### Story 4.5: Chốt Đơn + snapshot giá + warranty + giá catalog song song giá đã sửa
As a người có quyền chốt đơn, I want bấm Chốt để đóng băng giá, So that giá đã báo cho khách không đổi khi danh mục thay đổi sau này.
**Acceptance Criteria:**
- **Given** một Đơn "Báo giá", **When** bấm Chốt (qua dialog xác nhận nêu "Chốt sẽ đóng băng giá"), **Then** snapshot đơn giá mọi Dòng vào `OrderVersion.OrderLineItem.unitPriceSnapshot` và snapshot `vatRate`+`vatMode` hiệu lực lên `OrderVersion`; `currentVersionId` trỏ bản này; Đơn → "Đã chốt" (FR-5, AD-6, AD-16).
- **Given** sau Chốt, **When** sửa giá danh mục, **Then** giá các Dòng của đơn đã chốt KHÔNG đổi (FR-5).
- **Given** mỗi Dòng báo giá, **When** chốt, **Then** snapshot `OrderLineItem.warrantyMonths` (giá trị bảo hành, mặc định từ `Product.warrantyMonths`, sửa được lúc lên đơn) lên `OrderVersion` (§3).
- **Given** dòng có `priceEditable=true` (phí lắp), **When** lưu, **Then** `OrderLineItem` lưu **song song** giá catalog (từ `Product.unitPrice`) và giá đã sửa (`unitPriceSnapshot` lúc chốt); chênh lệch không nằm trong bóng tối để audit chiết khấu (§2).
- **Given** thao tác tiền, **When** Chốt bị retry, **Then** idempotent, không chốt/ghi trùng; publish domain event `OrderConfirmed` qua EventBus (NFR-1, AD-18).

### Story 4.6: Sửa Đơn đã chốt — bản update mới + re-snapshot reserved (re-chốt KHÔNG chặn thiếu tồn — xem 6.5)
As a người có quyền sửa đơn, I want sửa đơn đã chốt bằng cách sinh bản update mới, So that giữ nguyên lịch sử và không ghi đè bản cũ.
**Acceptance Criteria:**
- **Given** một Đơn đã chốt, **When** mở lại để sửa, **Then** tạo `OrderVersion` MỚI (không ghi đè), repoint `Order.currentVersionId` sang bản mới, giữ các bản cũ (FR-6, AD-6).
- **Given** bản update mới được chốt lại, **When** re-finalize, **Then** re-snapshot giá + vatRate/vatmode lên bản mới **AND** ghi dòng `release` cho phần version cũ đang giữ, ghi `reserve` mới theo số lượng update (ledger append-only, Story 6.6); tính lại `reserved` theo version mới; không đủ khả dụng → **VẪN cho re-chốt** — Đại Ca chốt (`docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md`): chốt và re-chốt không bao giờ chặn, chặn nằm ở khâu xuất kho (Story 6.5) (§2, FR-26).
- **Given** trang chi tiết Đơn, **When** xem lịch sử, **Then** thấy bản nào/ai/khi nào/đổi gì; sửa đơn publish event `OrderRevised` + ghi Audit (FR-6, AD-18).

### Story 4.7: Áp chiết khấu + duyệt chiết khấu (biên ước tính)
As a người có quyền áp chiết khấu, I want áp chiết khấu và gửi đi duyệt, So that giảm giá cho khách theo đúng quy trình kiểm soát.
**Acceptance Criteria:**
- **Given** một Đơn, **When** áp chiết khấu, **Then** Đơn → "Chờ duyệt chiết khấu" và tạo `DiscountApproval`; publish event `DiscountRequested` (không đẩy FCM trực tiếp) (FR-18, AD-18).
- **Given** một chiết khấu chờ duyệt, **When** người có quyền duyệt chiết khấu Đồng ý/Từ chối kèm lý do, **Then** Đơn chuyển tương ứng (duyệt → được Chốt; từ chối → về Báo giá); publish `DiscountResolved`; mọi bước ghi Audit (FR-18).
- **Given** màn Duyệt chiết khấu, **When** dựng, **Then** dùng Dialog xác nhận có hệ quả (UX-DR-20); không có hạn mức tự quyết — mọi chiết khấu phải duyệt.
- **Given** người duyệt chiết khấu xem Đơn, **When** duyệt, **Then** thấy **biên ước tính** = `(unitPrice − Product.costPrice) / unitPrice`, đọc thẳng `Product.costPrice` hiện hành **với nhãn rõ ràng là ước tính** (chưa xuất kho → chưa biết giá vốn thật); lý do: Đại Ca cho chốt khi thiếu tồn, giá vốn lúc chốt là giá của hàng chưa mua (§3).

### Story 4.8: Xuất & chia sẻ báo giá (PDF + ảnh)
As a người có quyền tạo báo giá, I want xuất báo giá PDF/hình ảnh và chia sẻ qua native share, So that gửi ngay cho khách qua Zalo tại hiện trường.
**Acceptance Criteria:**
- **Given** một Đơn (sau chốt hoặc khi cần), **When** xuất, **Then** tạo PDF và ưu tiên IMAGE báo giá, có khối chữ ký (Người lập/Giám đốc) + logo & thông tin công ty theo mẫu (FR-21).
- **Given** file xuất, **When** lưu, **Then** binary ở Cloudflare R2, DB chỉ lưu metadata + object key; đọc qua signed URL/proxy, không public bucket (AD-3).
- **Given** nút Share, **When** bấm, **Then** mở native share sheet ưu tiên hình ảnh; web = share/download tương đương (FR-21, UX-DR-21).

### Story 4.9: Bảo hành theo dòng vật tư (warrantyMonths field + warranty start date)
As a người tạo báo giá, I want cấu hình bảo hành cho từng dòng vật tư và lưu mốc bảo hành, So that biết khi nào hết hạn bảo hành cho khách.
**Acceptance Criteria:**
- **Given** mỗi Dòng báo giá, **When** sửa, **Then** có ô bảo hành (đơn vị tháng, `OrderLineItem.warrantyMonths`, snapshot lúc chốt), mặc định từ `Product.warrantyMonths`, sửa được lúc lên đơn (§3).
- **Given** dòng Công lắp / Phí lắp đặt (Product có `priceEditable=true` hoặc công lắp), **When** thêm, **Then** ô bảo hành **ẩn** (đặt `warrantyMonths=null`), không hiện input, không nhắc bảo hành; dòng tự do tương tự (§3).
- **Given** dòng Bảo hành tách (nếu khách mua thêm bảo hành), **When** thêm, **Then** link ô "Thêm bảo hành" (dòng tự do có thể nhập `warrantyMonths` nếu cần, không bắt buộc) (§3).
- **Given** mỗi dòng chốt, **When** lần đầu tiên Đơn chốt, **Then** **đóng băng `OrderLineItem.warrantyStartAt`** = ngày chốt của **DÒNG ĐÓ** (không phải ngày chốt Đơn) — lý do: nếu tạo version mới sửa một dòng ghi chú tháng 6 sẽ tạo version mới và gia hạn bảo hành toàn đơn; đặt mốc trên dòng thì hàng cũ giữ ngày cũ, hàng mới thêm lấy ngày mới (§3).
- **Given** mỗi dòng có bảo hành, **When** hiển thị, **Then** lưu **tháng** (int); UI hiển thị "5 năm" khi `warrantyMonths` chia hết 12, "18 tháng" khi không (§3).

## Epic 5: Vòng đời đơn & Thi công & Bảo hành (nhánh cá nhân)
_applyTransition engine gate theo cờ + permission + audit; auto-transition; danh sách đơn (+follow-up, empty/loading/error); chi tiết đơn (stepper/tabs/lịch sử); chuyển trạng thái + ảnh optional; huỷ kèm lý do; nhánh Thi công; tra cứu bảo hành theo SĐT. Publish StatusChanged + OrderCancelled. FR-7,8,9,10,23,24,36._

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

### Story 5.7: Huỷ đơn kèm lý do (giải phóng tồn → Epic 6.7)
As a người có quyền, I want huỷ đơn kèm lý do, So that đóng đơn không tiếp tục mà vẫn lưu vết ai huỷ / khi nào / vì sao.
**Acceptance Criteria:**
- **Given** một Đơn ở trạng thái cho phép huỷ, **When** người có quyền huỷ, **Then** đi qua `applyTransition()` sang "Huỷ", bắt buộc nhập lý do (FR-9, AD-11).
- **Given** hành động huỷ, **When** xác nhận, **Then** qua Dialog nêu hậu quả; lý do lưu thành cột đọc được trên Đơn (`cancelReason`/`cancelledAt`), không chỉ trong AuditLog; ghi Audit + publish `StatusChanged` **và** `OrderCancelled` (mang `orderId`, `orderVersionId`, `lyDo`, `statusTruocHuy`) làm **seam** cho tồn kho (UX-DR-19, UX-DR-20, AD-18, PRD §4.11).
- **Given** đường huỷ đơn, **When** cài đặt, **Then** **KHÔNG** chứa bất kỳ lệnh ghi tồn kho nào (`StockMovement`, `StockItem`, `onHand`, `reserved`) — khoá bằng source-guard; giải phóng `reserved` và phiếu nhập trả **thuộc Story 6.7**, subscribe `OrderCancelled` (AD-19).
- **Given** huỷ, **When** xác nhận, **Then** publish `StatusChanged` + ghi Audit.

### Story 5.8: Nhánh Thi công — bỏ "Lên lịch" (Đang thi công → Nghiệm thu)
As a người có quyền chuyển bước thi công, I want các bước thi công chỉ hiện khi cờ Thi công bật, So that đơn có thi công đi đúng chuỗi, đơn không thi công không lộ bước thừa.
**Acceptance Criteria:**
- **Given** Đơn bật cờ Thi công, **When** sau "Đã cọc", **Then** engine cho các bước Đang thi công → Nghiệm thu qua allowed-transition table (bỏ bước "Lên lịch thi công" không còn) (FR-7, AD-7, §2).
- **Given** Đơn KHÔNG bật cờ Thi công, **When** dựng vòng đời, **Then** không có bước thi công nào xuất hiện (FR-7).
- **Given** mỗi bước thi công (Đang thi công, Nghiệm thu), **When** chuyển, **Then** đi qua `applyTransition()` (permission + audit + event), cho đính kèm ảnh optional (FR-9, FR-23).

### Story 5.9: Tra cứu bảo hành theo SĐT khách hàng
As a người chịu trách nhiệm bảo hành, I want tra cứu bảo hành theo SĐT khách để hỗ trợ khách hàng, So that biết đơn nào/item nào còn hạn bảo hành.
**Acceptance Criteria:**
- **Given** màn Tra cứu bảo hành, **When** nhập SĐT, **Then** backend chuẩn hoá E.164, tìm Khách hàng, trả danh sách đơn của khách với item có bảo hành (§3).
- **Given** danh sách kết quả, **When** chọn Đơn, **Then** hiển thị: mỗi dòng vật tư + ngày bảo hành bắt đầu + số tháng bảo hành + hạn bảo hành (tính = ngày bắt đầu + số tháng) + trạng thái "Còn hạn" / "Sắp hết" / "Hết hạn" (§3).
- **Given** Phase 1, **When** tra cứu, **Then** chỉ hiển thị thông tin bảo hành, KHÔNG tạo phiếu yêu cầu bảo hành hay vòng đời bảo hành (§3).

## Epic 6: Giao hàng & Tồn kho (nhánh bỏ mối)
_Nhánh Giao hàng dùng lại engine E5; tồn kho hiện tại; phiếu nhập/xuất; xuất kho gắn đơn; chặn khi thiếu tồn (publish StockOutBlocked). FR-25, FR-26._

### Story 6.1: Nhánh Giao hàng — "Đã giao" gate theo cờ Thiết bị (Đang giao → Đã giao)
As a người có quyền xác nhận giao hàng, I want các bước giao hàng chỉ hiện khi Đơn có hàng hoá (cờ Thiết bị), So that đơn bỏ mối đi đúng chuỗi giao hàng.
**Acceptance Criteria:**
- **Given** Đơn bật cờ Thiết bị (có hàng hoá), **When** sau "Đã cọc" và nếu có cờ Vận chuyển, **Then** engine cho bước Đang giao → Đã giao; nếu KHÔNG cờ Vận chuyển, **Then** thẳng sang Đã giao (khách tự tới lấy) (FR-7, AD-7, §2).
- **Given** Đơn KHÔNG cờ Thiết bị (chỉ công lắp, không hàng), **When** dựng vòng đời, **Then** không có bước giao hàng nào xuất hiện (FR-7, §2).
- **Given** "Đã giao" trạng thái, **When** chuyển, **Then** xác nhận phiếu xuất kho + trừ tồn + ghi Audit + publish `StatusChanged`, đính kèm ảnh optional (FR-9, FR-23, AD-18, §2).

### Story 6.2: Tồn kho hiện tại — hai con số `onHand` + `reserved` + khả dụng
As a người có quyền nhập/xuất kho, I want xem tồn hiện tại theo Sản phẩm (on-hand + reserved + khả dụng), So that biết còn bao nhiêu để cấp mà không xuất quá.
**Acceptance Criteria:**
- **Given** mỗi Sản phẩm, **When** xem Tồn kho, **Then** hiển thị:
  - `onHand` — hàng thật trong kho (từ entity `StockItem`, chỉ phiếu nhập/xuất kho được đụng)
  - `reserved` — hàng đã hứa cho đơn đã chốt (tổng của `StockMovement`, không phải biến cộng-trừ)
  - **Khả dụng = `onHand` − `reserved`** — con số sale nhìn thấy, có thể âm
  - (một kho duy nhất ở Phase 1) (FR-25, §2).
- **Given** khả dụng âm, **When** hiển thị, **Then** hiện dạng `"Còn 5 · Đã hứa 20 · Cần nhập 15"` thay vì hiện số âm trần trụi; cảnh báo ngay khi thêm dòng vào báo giá (§2).
- **Given** gộp sản phẩm khả dụng âm, **When** tính danh sách cần mua, **Then** mỗi sản phẩm với khả dụng âm = cần nhập số lượng tương ứng (§2).
- **Given** màn Tồn kho, **When** dựng, **Then** dùng Table + trạng thái empty/loading/error, số canh phải `.mono`, parity web+mobile (FR-25, UX-DR-10).

### Story 6.3: Phiếu nhập/xuất kho + giá vốn + bình quân gia quyền
As a người có quyền nhập/xuất kho, I want tạo Phiếu kho nhập/xuất cập nhật tồn và giá vốn, So that tồn kho luôn khớp thực tế, lợi nhuận tính đúng.
**Acceptance Criteria:**
- **Given** một Phiếu kho, **When** tạo nhập/xuất, **Then** entity `StockVoucher` + `StockVoucherLine`; nhập tăng tồn, xuất giảm tồn on-hand (FR-25, §2).
- **Given** tạo phiếu nhập kho, **When** nhập, **Then** `StockVoucherLine.unitCost` **bắt buộc** (giá nhập đơn vị, integer đồng); sau khi lưu phiếu, hệ thống tự tính **bình quân gia quyền** → cập nhật `Product.costPrice` (một chỗ gõ, không phải nhớ sửa hai nơi) (§4).
- **Given** tồn đầu kỳ, **When** triển khai, **Then** user gõ một phiếu nhập tồn đầu kỳ lúc go-live; nếu quên, báo cáo lợi nhuận tháng đầu rỗng (§4).
- **Given** mỗi Phiếu kho, **When** lưu, **Then** ghi Audit (ai/khi nào/số lượng/sản phẩm) qua event (FR-25, AD-18).

### Story 6.4: Xuất kho gắn Đơn — MỘT Đơn MỘT phiếu xuất + snapshot costPriceSnapshot lúc xuất
As a người có quyền nhập/xuất kho, I want tạo phiếu xuất từ các Dòng vật tư của Đơn (một đơn một phiếu), So that cấp vật tư/giao hàng khớp đúng đơn.
**Acceptance Criteria:**
- **Given** một Đơn có cờ Vận chuyển/Thi công, **When** tạo phiếu xuất, **Then** **MỘT Đơn chỉ có MỘT phiếu xuất** (unique trên `(orderId, orderVersionId)`), phiếu xuất tạo được từ các Dòng vật tư của Đơn và gắn `orderId` (FR-26, §2).
- **Given** tạo phiếu xuất và xác nhận (gắn transition "Đã giao"), **When** xuất kho, **Then** **snapshot `OrderLineItem.costPriceSnapshot`** = giá vốn lúc XUẤT KHO, không phải lúc chốt — lý do: Đại Ca cho chốt khi thiếu tồn, giá vốn lúc chốt là giá hàng **chưa mua**; giá bán snapshot lúc chốt (lời hứa), giá vốn snapshot lúc xuất (sự thật) (§4).
- **Given** phiếu xuất gắn đơn, **When** lưu + xác nhận, **Then** ghi Audit + liên kết đơn truy được; publish `StockIssued` event (FR-26, AD-18).

### Story 6.5: Chặn khi thiếu tồn — ở khâu XUẤT, KHÔNG chặn chốt
As a người có quyền nhập/xuất kho, I want hệ thống cảnh báo và chặn khi tồn không đủ lúc xuất, So that không xuất quá tồn gây sai lệch kho.
**Acceptance Criteria:**
- **Given** một Đơn chốt khi thiếu tồn, **When** lưu Đơn, **Then** CHO CHỐT (không chặn lúc chốt) — cảnh báo sớm ngay lúc thêm dòng vào báo giá ("Kho còn 5"), nhưng chốt không chặn (§2).
- **Given** một phiếu xuất vượt tồn hiện có, **When** lưu, **Then** hệ thống CẢNH BÁO và **CHẶN ở khâu XUẤT KHO**, không cho xuất quá tồn, hiển thị "Không đủ tồn — không thể xuất quá số tồn hiện có." (FR-26, §2, UX-DR-19).
- **Given** một lần xuất bị chặn, **When** xử lý, **Then** publish event `StockOutBlocked` qua EventBus (không đẩy FCM trực tiếp) (AD-18).
- **Given** thao tác xuất, **When** kiểm tồn, **Then** kiểm và trừ tồn thực hiện ở backend, client chỉ hiển thị kết quả (AD-2).

### Story 6.6: Giữ chỗ tồn khi chốt đơn — StockMovement ledger idempotent
As a lập trình viên tồn kho, I want giữ chỗ tồn lúc chốt đơn bằng `StockMovement` ledger, So that `reserved` chính xác khi re-chốt.
**Acceptance Criteria:**
- **Given** chốt Đơn lần đầu, **When** lưu, **Then** tạo `StockMovement` với `orderId`, `orderVersionId`, số lượng item vật tư; `reserved` là **tổng của `StockMovement`**, KHÔNG phải biến cộng-trừ (§2).
- **Given** `StockMovement` unique trên `(orderVersionId, stockItemId, type)` (ledger theo từng sản phẩm; cặp `(orderId, orderVersionId)` là unique của phiếu xuất, không dùng được cho ledger — sửa ở 6.6), **When** chốt/re-chốt, **Then** thao tác tiền **idempotent** — gọi Chốt API hai lần không tạo movement trùng; lần đầu tạo, lần thứ hai skip hoặc update (NFR-1, §2).
- **Given** sửa Đơn → tạo version mới + re-chốt, **When** re-finalize, **Then** ghi dòng `release` cho version cũ, ghi `reserve` theo version mới — không xoá dòng ledger (Story 4.6).
- **Phụ thuộc:** story này **sửa luồng chốt của Epic 4** nhưng phải nằm ở Epic 6 vì cần `StockItem` (6.2) tồn tại trước. Hệ quả: Epic 4 chưa xong hẳn khi hết Story 4.9 — hành vi giữ chỗ tồn lúc chốt chỉ hoàn chỉnh sau story này.

### Story 6.7: Phiếu nhập trả khi huỷ đơn đã xuất kho
As a người quản lý tồn kho, I want tạo phiếu nhập trả khi huỷ đơn đã xuất, So that tồn lên lại chính xác khi đơn bị huỷ.
**Acceptance Criteria:**
- **Given** Đơn huỷ **SAU khi xuất kho** (đã giảm `onHand`), **When** xác nhận huỷ, **Then** KHÔNG tự cộng tồn; phải tạo **phiếu nhập trả** từ phiếu xuất lúc đó để lên tồn lại (§2).
- **Given** phiếu nhập trả, **When** tạo, **Then** entity `StockVoucher` loại "nhập", gắn phiếu xuất gốc, cùng giá vốn (`unitCost` = `costPriceSnapshot` lúc xuất) để báo cáo lợi nhuận không lệch (§2, §4).
- **Given** tạo phiếu trả, **When** lưu, **Then** tăng lại `onHand`, ghi Audit, gắn link Đơn huỷ (FR-24, AD-18).
- **Given** đường huỷ đơn đã ship ở Story 5.7 KHÔNG chạm tồn kho (khoá bằng source-guard), **When** nối tồn kho vào, **Then** story này **subscribe event `OrderCancelled`** (mang `orderId`, `orderVersionId`, `lyDo`, `statusTruocHuy`) — đây là seam duy nhất; **không** thêm lệnh ghi tồn vào `huyDon()` (AD-11, AD-18).
- **Given** Đơn huỷ **TRƯỚC khi xuất kho**, **When** xử lý `OrderCancelled`, **Then** ghi dòng `release` ở cấp đơn (mọi version còn giữ, không xoá dòng ledger) → **giải phóng `reserved`** ngay; mọi cạnh vào `hoanthanh` cũng release phần còn giữ trong cùng tx (chuyển từ Story 5.7 sang đây vì ledger chưa tồn tại ở Epic 5) (AD-19).

## Epic 7: Thanh toán, Hợp đồng & Hoá đơn
_Lịch thanh toán nhiều đợt; ghi nhận đợt → auto chuyển trạng thái (publish DepositRecorded/PaymentRecorded); sinh HĐ Thi công/Mua bán (PDF); tạo hoá đơn (DB + PDF). FR-11,12,13,27,28._

### Story 7.1: Cấu hình Lịch thanh toán nhiều đợt (chặn đợt đầu 0%)
As a người có quyền, I want cấu hình Lịch thanh toán các đợt (%/số tiền + điều kiện), So that đơn có kế hoạch thu tiền rõ ràng.
**Acceptance Criteria:**
- **Given** một Đơn, **When** cấu hình lịch, **Then** tạo `PaymentSchedule` + `Installment` hỗ trợ nhiều đợt (vd 20/70/10), một đợt 100%, hoặc tuỳ chỉnh; mỗi đợt có % hoặc số tiền + mô tả điều kiện (FR-11).
- **Given** tổng các đợt, **When** lưu, **Then** cảnh báo nếu tổng ≠ tổng sau VAT của Đơn (FR-11).
- **Given** tiền các đợt, **When** tính, **Then** là integer đồng, không float (AD-10).
- **Given** cấu hình lịch thanh toán, **When** đợt đầu = 0% (hoặc 0 tiền), **Then** **chặn** — không cho lưu lịch có đợt đầu 0%; luật này chặn tại **cấu hình** (khi tạo lịch), KHÔNG tại lúc áp vào đơn (§3 Plan).

### Story 7.2: Ghi nhận thanh toán → auto chuyển trạng thái
As a người có quyền ghi nhận thanh toán, I want ghi tiền theo từng đợt và để trạng thái tự nhảy, So that công nợ và vòng đời đơn tự cập nhật không cần thao tác riêng.
**Acceptance Criteria:**
- **Given** một đợt thanh toán, **When** ghi nhận (qua Dialog xác nhận), **Then** tạo `Payment`, cập nhật trạng thái thanh toán của Đơn, ghi Audit (FR-12, UX-DR-20).
- **Given** ghi đủ đợt cọc đầu, **When** xử lý, **Then** gọi `applyTransition()` để Đơn tự sang "Đã cọc" (không ghi status trực tiếp) (FR-8, FR-12, AD-11).
- **Given** thao tác tiền, **When** retry, **Then** idempotent, không ghi trùng; publish event `DepositRecorded`/`PaymentRecorded` qua EventBus (NFR-1, AD-18).
- **Given** `Payment` được ghi và transition tự động bị chặn 409 (vd đóng đơn khi chưa xuất đủ kho), **When** xử lý, **Then** `Payment` insert + `chuyenTrangThaiTuDong()`/`applyTransition()` chạy trong MỘT transaction dưới khoá dòng đơn (`SELECT ... FOR UPDATE` trên `orders` trước); `Payment` VẪN commit, transition bị bỏ qua + log + publish event nghiệp vụ, không rollback tiền (F-3, TD-40; [Source: ARCHITECTURE-SPINE AD-11]). Test khoá theo luật F-5 trong `backend/CONVENTIONS.md`.
- **Given** lần ghi làm **mọi** đợt đủ tiền **và** tổng đã thu ≥ tổng đơn, **When** xử lý, **Then** thử `hoan_thanh` trong cùng tx, bất kể đợt vừa ghi là đợt nào; lịch 1 đợt chỉ bắn `du_coc`; mốc bị từ chối 403/409 thì `skipped`, không tự bắn lại (quyết khi review 7.2, 2026-10-22; [Source: ARCHITECTURE-SPINE AD-11]).

### Story 7.3: Sinh Hợp đồng Thi công / Mua bán (PDF)
As a người có quyền sinh hợp đồng, I want sinh HĐ từ Đơn theo loại phù hợp, So that có văn bản ký kết điền sẵn dữ liệu đơn.
**Acceptance Criteria:**
- **Given** cờ phạm vi của Đơn, **When** sinh hợp đồng, **Then** Đơn có cờ Thi công → HĐ Thi công; Đơn chỉ Thiết bị → HĐ Mua bán (FR-13).
- **Given** template tĩnh, **When** sinh, **Then** chỉ điền dữ liệu động (hai bên, danh mục/giá, tổng, lịch thanh toán, tham chiếu số báo giá); điều khoản cố định không sửa theo đơn (FR-13).
- **Given** thông tin pháp nhân công ty (tên công ty, MST, địa chỉ, người đại diện, chức danh; in ở **Bên B**, khách là Bên A, theo đúng hai mẫu thật — Story 7.3), **When** sinh hợp đồng, **Then** đọc từ `system_settings` (cùng khuôn VAT ở story 4.4), seed rỗng; hợp đồng vẫn xuất được, ô chưa cấu hình hiện "Chưa cấu hình", không bao giờ chặn (F-4).
- **Given** điều khoản tĩnh, **When** dựng template, **Then** trích từ hai mẫu có sẵn: HĐ Thi công [Source: `docs/1. Khảo sát lắp đặt/HĐ THI CÔNG CT .docx`], HĐ Mua bán [Source: `docs/2. Thương mại/HDMB CT QTS l2.pdf`].
- **Given** file PDF, **When** lưu, **Then** binary ở R2, DB lưu metadata + object key; entity `Contract` gắn `orderId`; sinh hợp đồng ghi Audit (FR-13, AD-3).

### Story 7.4: Tạo Hoá đơn từ Đơn (lưu DB)
As a người có quyền tạo hoá đơn, I want tạo Hoá đơn từ Đơn, So that lưu chứng từ hoá đơn nội bộ gắn đơn.
**Acceptance Criteria:**
- **Given** một Đơn, **When** tạo Hoá đơn, **Then** entity `Invoice` lấy khách hàng (MST), các Dòng, VAT, tổng tiền từ Đơn; lưu số hoá đơn nội bộ + ngày + link Đơn (FR-27).
- **Given** hoá đơn tạo, **When** lưu, **Then** ghi Audit qua event; tiền là integer đồng (FR-27, AD-10, AD-18).
- **Given** thông tin pháp nhân công ty trong `system_settings`, **When** lập hoá đơn, **Then** chép 7 trường người bán vào hoá đơn (snapshot) trong cùng tx dưới khoá dòng đơn; sửa settings sau đó không đổi hoá đơn đã lập; trường trống chép trống, không chặn (quyết 2026-10-22, Story 7.4).

### Story 7.5: Xem & xuất Hoá đơn PDF
As a người có quyền, I want xem lại và xuất PDF Hoá đơn, So that in/gửi hoá đơn khi cần.
**Acceptance Criteria:**
- **Given** một Hoá đơn đã tạo, **When** xem, **Then** hiển thị số, ngày, tổng tiền, gắn đúng Đơn (FR-28).
- **Given** hoá đơn, **When** xuất, **Then** tạo PDF, binary ở R2, chia sẻ/download tương tự báo giá (FR-28, AD-3).
- **Given** PDF hoá đơn, **When** render, **Then** in "Số tiền viết bằng chữ" dưới Tổng cộng (helper dùng chung `backend/src/common/money/amount-in-words.ts`); PDF render **một lần** dưới khoá dòng hoá đơn, lần xuất sau trả file đã lưu (quyết 2026-10-22, Story 7.5).

## Epic 10: Nối dây client (chạy TRƯỚC Epic 8)
_Chèn bởi correct-course 2026-10-22 (G-1 = F-2; TD-38, TD-39). **Chạy sau Epic 7, TRƯỚC Epic 8** — số 10 chỉ để giữ nguyên key story Epic 8/9. Thứ tự nội bộ: 10.1 → 10.2 (contract tiếng Anh) → 10.3 → 10.4 → 10.5 (web) → 10.6 → 10.7 → 10.8 (mobile). Lô chuẩn bị trước commit đầu 10.1: G-3 (TD-50, race sinh hợp đồng — action item, không phải story), G-4, G-5. Bảng đổi tên và 24 mặc định tuyên bố trước: [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §4.2, §6]._

### Story 10.1: Đổi route và tham số tiếng Việt sang tiếng Anh
As a lập trình viên client, I want mọi route và tham số API là tiếng Anh trước khi web/mobile gọi thật, So that không phải đổi contract (breaking change) sau khi đã có consumer.
**Acceptance Criteria:**
- **Given** 16 route tiếng Việt hiện có (`cho-duyet-chiet-khau`, `tra-cuu-bao-hanh`, `anh`, `ap-chiet-khau`, `duyet-chiet-khau`, `bao-gia/anh`, `bao-gia/pdf`, `xuat-bao-gia`, `chot`, `chuyen-trang-thai`, `huy`, `mo-lai`, `phien-ban`, `vong-doi`…), **When** đổi tên, **Then** route mới đúng từng dòng bảng đổi tên; method HTTP, quyền `@RequirePermissions`, phạm vi đọc/ghi đơn và hành vi giữ nguyên [Source: sprint-change-proposal-2026-10-22.md §4.2].
- **Given** tham số `sdt` (path `/customers/{sdt}`, query `?sdt=` của tra cứu bảo hành), **When** đổi, **Then** thành `phone`; chuẩn hoá E.164 vẫn chỉ ở backend `customers/domain` (AD-9).
- **Given** 0 consumer HTTP, **When** đổi, **Then** đổi cứng, KHÔNG giữ alias route cũ (mặc định §6.4); gọi route cũ ⇒ 404 envelope chuẩn (AD-5).
- **Given** `openapi.json` là build artifact, **When** đổi xong, **Then** sinh lại bằng script có sẵn, drift-guard xanh; KHÔNG sửa tay spec (AD-12).
- **Given** source-guard/e2e đang so chuỗi route, **When** đổi, **Then** cập nhật theo route mới và thêm một guard: không path nào trong `openapi.json` chứa segment thuộc danh sách route tiếng Việt cũ, có assert chống-guard-rỗng (E-7); mutant thêm lại một route cũ ⇒ ĐỎ.
- **Given** spine và `project-context.md` còn ví dụ route cũ, **When** story commit, **Then** ví dụ được cập nhật trong cùng commit (G-5).
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.1 — ghi vào bảng §4.2 khối "Tinh chỉnh 10.1"):** query `GET /customers/lookup?sdt=` cũng đổi thành `?phone=`; sáu `operationId` tiếng Việt đổi bằng tên method handler controller (`OrdersController_warrantyLookup|transition|cancel`, `StockItemsController_list`, `StockVouchersController_list|findOne`), tên method service giữ; lỗi chuẩn hoá SĐT của service trỏ `fieldErrors[].field = 'phone'` cho input path/query, body `POST /customers` vẫn `sdt` tới 10.2; query cũ `?sdt=` ⇒ 400 `VALIDATION_ERROR` trỏ `phone`; guard `no-vietnamese-api-contract.spec.ts` soi cả tên tham số và `operationId`.

### Story 10.2: Đổi field DTO tiếng Việt sang tiếng Anh
As a lập trình viên client, I want mọi field request/response trên contract là tiếng Anh, So that type sinh từ OpenAPI ở web/mobile thống nhất một ngôn ngữ ngay từ đầu.
**Acceptance Criteria:**
- **Given** ~30 field DTO tiếng Việt (`sdt`, `customerSdt`, `cccd`, `chotAt`, `buoc`, `buocKeTiep`, `trangThai`, `coTheHuy`, `lyDo`, `laBanHienLuc`, `thayDoi`, `ten`, `donVi`, `khaDung`, `ma`, `nguoiTao`, `scopeThiCong`…) và 3 tên schema (`ThayDoiBanUpdateDto`, `ThayDoiSoLuongDto`, `CanMuaViewDto`), **When** đổi, **Then** theo đúng bảng đổi tên; tinh chỉnh nào (vd trùng tên trong cùng DTO) phải ghi lại vào bảng trong cùng commit (G-5) [Source: sprint-change-proposal-2026-10-22.md §4.2].
- **Given** cột/bảng DB và enum value nghiệp vụ (khoá trạng thái, khoá event, loại khách, loại phiếu, `tinhTrang`), **When** đổi field, **Then** KHÔNG đổi — chỉ đổi tên trên contract; không migration (mặc định §6.6, §6.7).
- **Given** validation trả `fieldErrors[].field`, **When** request sai, **Then** `field` mang tên mới (vd `reason`, không còn `lyDo`) — e2e qua `ValidationPipe` chứng minh (AD-5).
- **Given** `openapi.json` sinh lại, **When** chạy guard mới, **Then** không property nào trong `components.schemas` thuộc danh sách tên tiếng Việt cũ, có assert chống-guard-rỗng; mutant đổi ngược một field ⇒ ĐỎ.
- **Given** fake port web/mobile còn chép tay tên cũ, **When** story này xong, **Then** KHÔNG sửa client (chưa consumer HTTP); fake được viết lại theo type sinh ở 10.3/10.6 — ghi rõ trong Dev Notes để review không coi là drift.
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.2 — ghi vào bảng §4.2 khối "Tinh chỉnh 10.2"):** field form multipart `anh` đổi thành `files` (transition + ảnh bổ sung; spec có `StatusChangeRequestDto.files` optional và schema mới `AttachmentUploadRequestDto` với `files` required); `fieldErrors[].field` do service ném dùng tên field mới (`customerPhone`, `reason`, `phone`, `nationalId`, `files`); `FORBIDDEN_FIELDS` theo tên DTO (`nationalId`); response dựng qua hàm map `to…Dto` ở ranh giới controller, service/domain/Prisma/event giữ tên cũ; guard `no-vietnamese-api-contract.spec.ts` soi cả tên schema và mọi property (kể cả inline).

### Story 10.3: Web: client sinh từ OpenAPI, phiên đăng nhập và xử lý lỗi một chỗ
As a người dùng web, I want đăng nhập thật vào backend và mọi lỗi API hiển thị nhất quán, So that web là client REST thật thay vì demo fake.
**Acceptance Criteria:**
- **Given** `backend/openapi/openapi.json`, **When** chạy script sinh client web, **Then** type + client có type được sinh vào thư mục generated của `web/` (mặc định `openapi-typescript` + `openapi-fetch`); cấm khai tay type contract (AD-12); drift-guard: sinh lại phải ra đúng byte, lệch ⇒ `npm test` ĐỎ.
- **Given** tầng transport duy nhất, **When** client gọi API, **Then** chỉ transport được gọi `fetch`; guard quét `web/src` không lời gọi mạng nào ngoài transport (chống-guard-rỗng).
- **Given** response lỗi, **When** transport nhận, **Then** parse envelope `{ code, message, fieldErrors, traceId }` ở ĐÚNG một chỗ và ném lỗi có type mà màn dùng sẵn (AD-5); body không phải envelope ⇒ lỗi chung tiếng Việt, không crash.
- **Given** port đăng nhập mới (login/refresh/logout, tên tiếng Anh) và màn `LoginScreen` có sẵn, **When** đăng nhập đúng, **Then** access token giữ trong bộ nhớ, refresh token trong `localStorage`; gặp 401 thì refresh **một lần** cho mọi request đang chờ rồi phát lại; refresh hỏng ⇒ xoá phiên, về Đăng nhập; logout gọi `POST /auth/logout` (mặc định §6.13, §6.15).
- **Given** web chạy khác origin, **When** cấu hình, **Then** base URL từ `VITE_API_BASE_URL`; dev dùng proxy vite; backend bật CORS theo allowlist env `CORS_ORIGINS` (rỗng ⇒ tắt) có test e2e cho origin được phép và bị từ chối (mặc định §6.16, §6.17).
- **Given** test transport, **When** chạy vitest, **Then** có ca: envelope 400 + fieldErrors, 401 → refresh → phát lại, hai 401 đồng thời chỉ một lần refresh, refresh 401 → đăng xuất.
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.3):** đăng nhập **chỉ bằng email** (account không có SĐT; `LoginRequestDto.email` là `@IsEmail`) — copy web + mobile đổi thành "Email đăng nhập" / "Tài khoản phải là email hợp lệ.", đăng nhập bằng SĐT cần story backend riêng; `openapi-typescript@7.13.0` khai peer `typescript ^5` nên `web/package.json` dùng `overrides` trỏ `$typescript` (TS 6), cấm `--legacy-peer-deps`; adapter HTTP nằm ở `web/src/api/` (transport, session-store, client, `http-*-port.ts`), interface port vẫn ở `design-system/session/`; port đăng nhập là `AuthPort { login, restoreSession, logout }` — `restoreSession` thay cho method `refresh` công khai, refresh chỉ do transport làm (single-flight); 401 không refresh trên 5 đường `/auth/{login,refresh,logout,forgot-password,reset-password}`, mỗi request phát lại tối đa một lần (phát lại vẫn 401 ⇒ ném lỗi, giữ phiên — ca `change-password` sai mật khẩu hiện tại).

### Story 10.4: Web: composition root, router và adapter danh mục, khách, cài đặt
As a người dùng web, I want điều hướng giữa các màn có sẵn với dữ liệu thật và chỉ thấy mục mình có quyền, So that dùng web cho danh mục, khách hàng, cấu hình thay Excel.
**Acceptance Criteria:**
- **Given** `web/src/main.tsx`, **When** khởi động, **Then** thành **composition root** duy nhất: tạo transport, ráp port với adapter HTTP, bọc `PermissionsProvider` từ `/me`; không import fake nào (guard, chống-guard-rỗng) [Source: ARCHITECTURE-SPINE AD-12].
- **Given** router (mặc định `react-router`), **When** đăng nhập xong, **Then** sidebar (Story 1.9) điều hướng tới màn thật; route của mục không có quyền không render và không có trong nav (UX-DR-22, AD-4); chưa đăng nhập ⇒ về Đăng nhập.
- **Given** port me, password, customers, customer-sources, catalog (sản phẩm, giá, gói vật tư), settings (VAT, pháp nhân), warranty, **When** dùng adapter, **Then** mỗi adapter cài đúng interface port hiện có bằng client sinh (10.3), không đổi chữ ký port mà màn đang dùng; method port tên tiếng Việt (nếu có) đổi sang tiếng Anh cùng caller.
- **Given** mỗi adapter, **When** test, **Then** có ca map response thành công + một ca lỗi envelope qua transport giả lập HTTP (không qua fake port).
- **Given** fake port, **When** dùng, **Then** chỉ còn trong test/demo, viết lại theo type sinh; smoke render mọi màn (`screens-render.test.tsx`) vẫn xanh.
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.4):** router `react-router@8.4.0` chế độ thư viện (`BrowserRouter` + `<Routes>` khai báo, không loader/action); điều hướng sidebar qua `SidebarNavContext` trong shell (`onNavigate` + `availableKeys`) — shell vẫn không import router, mục không có màn web (Trang chủ, Đơn hàng, Danh mục, Kho, Phân quyền, Audit) **ẩn** khỏi nav tới khi có route (Đơn hàng/Kho trở lại ở 10.5), không làm màn giữ chỗ; path route tiếng Anh (`/customers`, `/customers/lookup`, `/customers/:phone`, `/warranty`, `/settings`, `/profile`, `/login`, `/forgot-password`), gate route dùng chung dữ liệu gate của nav (`filterNav(SIDEBAR_NAV)`), `/`, path lạ và path thiếu quyền về route đầu tiên mở được theo thứ tự nav (không có ⇒ `/profile`); sửa metadata Swagger cho **14** field `string|number|Date | null` đang sinh `type: object` (nhóm khách, nguồn khách, sản phẩm, bảo hành — 2 DTO lồng `customer` vốn đã là `allOf/$ref`, không lỗi) + guard `openapi-no-untyped-object.spec.ts` với allowlist **6** field còn lại của module đơn cho 10.5 (`OrderListItemDto.assigneeAccountId`, `OrderVersionItemDto.{confirmedAt, createdByAccountId, createdByDisplayName}`, `AttachmentItemDto.{statusFrom, statusTo}`); type dữ liệu 6 port web = alias/`Pick` type sinh, field theo contract (`phone`, `nationalId`, `confirmedAt`) — mobile giữ tên cũ tới 10.7; `CatalogPort.listProducts(search)` lọc name/SKU phía adapter vì `GET /products` không có tham số tìm, adapter dựng từng field để `costPrice` không rời adapter; nút Đăng xuất ở Hồ sơ (prop tùy chọn `onLogout`).
- **Tinh chỉnh khi review (quyết 2026-10-22, Story 10.4):** `fieldErrors[].message` từ `ValidationPipe` luôn tiếng Việt — câu mặc định tiếng Anh của class-validator được dịch theo mã constraint ở MỘT chỗ (`common/validation/validation-pipe.factory.ts`, nơi đóng gói `fieldErrors` trước filter AD-5), message DTO tự viết giữ nguyên, constraint lạ ⇒ "Giá trị không hợp lệ."; `CustomersPort.listSources()` gọi `GET /customer-sources?includeInactive=true` để chi tiết/tra cứu vẫn hiện tên nguồn đã tắt, select tạo khách chỉ hiện nguồn đang bật; lỗi `fieldErrors.phone` hiện dưới ô SĐT. Ngoài phạm vi (TD): message tiếng Anh của `ParseUUIDPipe` và lỗi parse JSON body của Express (module đơn/tiền — 10.5). _(Ghi chú 2026-10-22: `ParseUUIDPipe` đã trả ở 10.5; lỗi parse JSON body vẫn là TD.)_

### Story 10.5: Web: adapter đơn, kho, tiền, chứng từ và nút chi tiết đơn theo quyền
As a nhân viên bán hàng/kế toán trên web, I want đi trọn luồng báo giá → chốt → thanh toán → hợp đồng → hoá đơn với backend thật, So that web dùng được đầu-cuối cho đơn hàng.
**Acceptance Criteria:**
- **Given** port orders, inventory, stock-vouchers, payments, contracts, invoices, **When** dùng adapter, **Then** cài bằng client sinh; method tiếng Việt (`chuyenTrangThai`, `huyDon`, `themAnh`, `xoaAnh`, `listAnh`, `anhBytes`) đổi sang tiếng Anh cùng mọi caller (mặc định §6.8).
- **Given** upload ảnh và tải PDF/ảnh, **When** gọi, **Then** upload multipart qua backend (AD-3), tải nhị phân kèm Bearer rồi mở/tải bằng object URL; không link công khai (mặc định §6.18).
- **Given** ghi thanh toán, **When** gửi, **Then** khoá idempotency do port sinh được truyền nguyên vẹn; retry cùng khoá không ghi trùng (NFR-1).
- **Given** chi tiết đơn, **When** router render `OrderDetailScreen`, **Then** truyền `onOpenPaymentSchedule` cho mọi account xem được đơn, `onOpenContracts` chỉ khi có `contracts.generate`, `onOpenInvoices` chỉ khi có `invoices.manage` — khớp `@RequirePermissions` của endpoint chính màn đích; test cho cả account đủ và thiếu quyền (mặc định §6.19, UX-DR-22).
- **Given** backend + `pns-postgres` chạy local, **When** smoke đầu-cuối bằng account seed có quyền, **Then** tạo báo giá → chốt → cấu hình lịch → ghi thanh toán → sinh HĐ → lập + xuất hoá đơn thành công; kết quả ghi vào Dev Agent Record (mặc định §6.21).
- **Given** client không tính tiền (AD-2, AD-16), **When** hiển thị tổng, **Then** chỉ hiện số backend trả qua `<Money>`; guard tiền hiện có vẫn xanh.
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.5):** 6 method port web đổi tên theo contract — `transition(orderId, event, files)`, `cancel(orderId, reason)`, `listAttachments`, `addAttachments`, `removeAttachment`, `attachmentBytes`; type dữ liệu 6 port (orders, inventory, stock-vouchers, payments, contracts, invoices) = alias/`Pick` type sinh, field theo contract (`customerPhone`, `scopeEquipment/Construction/Delivery`, `steps/nextSteps/canCancel`, `progress`, `uploadedBy/canDelete`, `isCurrent/confirmedAt/lineCount/changes`, `name/unit/available/toPurchase/stockStatus/purchaseList`, `code/createdBy/totalQty`…), giá trị enum giữ nguyên; mobile giữ tên cũ tới 10.8 qua bảng map MỘT chiều theo DTO `design-system/lib/web-mobile-contract-map.mjs` (mỗi entry tự kiểm còn sống, xoá ở 10.8); route `/orders`, `/orders/new`, `/orders/discount-approvals`, `/orders/:id`, `/orders/:id/{transition,payments,contracts,invoices}`, `/orders/:id/invoices/:invoiceId`, `/inventory`, `/inventory/vouchers` (route con gate cha + quyền endpoint chính của màn qua `PERMISSION_KEYS`); `onOpenContracts` chỉ khi `contracts.generate`, `onOpenInvoices` chỉ khi `invoices.manage`, `onOpenPaymentSchedule` cho mọi account xem đơn; lối vào Duyệt chiết khấu là prop tuỳ chọn `OrdersListScreen.onOpenDiscountApprovals` (không thêm mục sidebar); nút "+ Tạo đơn" chỉ render khi có `onAdd`; Đơn hàng đứng đầu sidebar ⇒ account có quyền xem đơn landing `/orders`; `ParseUUIDPipe` gom về MỘT hằng `UUID_PARAM` (`common/validation/uuid-param.ts`, câu `isUuid` "Mã định danh không hợp lệ.") + guard `no-bare-parse-uuid-pipe.spec.ts` (đo thật 20 tham số ở 6 controller, không phải 26); CORS expose `Content-Disposition` (thư viện `cors` gửi header expose cho mọi origin, origin bị từ chối vẫn không có `allow-origin`); `RecordPaymentInput.amount` optional — ô trống không gửi, server trả 400 `fieldErrors.amount`, giữ ngữ nghĩa 7.2; 6 field `object` trần về 0, allowlist `openapi-no-untyped-object` rỗng; thêm `enum` cho `OrderResponseDto.vatMode` (echo sang `preview-total` đúng kiểu); generator web `defaultNonNullable: false` (field request có `default` là optional — `isFlexible`, `tracksStock`, `priceEditable`).

### Story 10.6: Mobile: app shell, android/ios, client Dart sinh từ OpenAPI và phiên đăng nhập
As a nhân viên hiện trường, I want app mobile cài được trên điện thoại và đăng nhập thật, So that dùng app thay vì demo.
**Acceptance Criteria:**
- **Given** `mobile/` chưa có app-runtime, **When** dựng, **Then** có `lib/main.dart` là composition root duy nhất + thư mục `android/` và `ios/`; `flutter build apk --debug` chạy được; `ios/` có mặt và `flutter analyze` sạch, build iOS không là tiêu chí (mặc định §6.22).
- **Given** `openapi.json`, **When** chạy script sinh client Dart (mặc định bộ sinh Dart thuần, ưu tiên `swagger_parser`, HTTP qua `dio`), **Then** client + model được sinh, cấm khai tay type contract (AD-12); drift-guard sinh lại ra đúng byte. Nếu phải đổi công cụ, ghi lý do vào spine/proposal cùng commit (G-5).
- **Given** tầng transport Dart, **When** gọi API, **Then** chỉ transport chạm mạng (guard quét `mobile/lib`, chống-guard-rỗng); envelope AD-5 parse ở một chỗ; base URL từ `--dart-define=API_BASE_URL`.
- **Given** port đăng nhập mới + màn Đăng nhập Flutter có sẵn, **When** đăng nhập, **Then** refresh token trong `flutter_secure_storage`, access token trong bộ nhớ; 401 ⇒ refresh một lần cho mọi request chờ; refresh hỏng ⇒ về Đăng nhập (mặc định §6.14, §6.15).
- **Given** test, **When** `flutter test`, **Then** có ca transport: envelope 400 + fieldErrors, 401 → refresh → phát lại, refresh hỏng → đăng xuất; widget test màn Đăng nhập với port giả lập HTTP.
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.6):** Flutter thật trên máy là **3.35.0 / Dart 3.9.0** (không phải 3.44), không nâng trong story; `pubspec.yaml` sdk `^3.8.0` + `dio ^5.11.1`, `retrofit ^4.10.0`, `json_annotation ^4.12.0`, `flutter_secure_storage ^10.3.4`, dev `swagger_parser ^1.45.0`, `build_runner ^2.15.1`, `retrofit_generator ^10.3.2`, `json_serializable ^6.14.1` và **ghim `source_helper: 1.3.13`** (1.4.0 xung đột extension với json_serializable 6.14.1 ⇒ build script không biên dịch; bỏ ghim khi SDK ≥ 3.12), không `dependency_overrides`; bộ sinh vẫn `swagger_parser` (không đổi công cụ) nhưng đọc **bản spec dẫn xuất** do `mobile/tool/generate_api.dart` (`buildMobileSpec`) dựng: chỉ đổi `type: string` → `integer` ở schema `format: binary` của **response** khác `application/json` (8 content trên 5 route) để tải file sinh `Stream<Uint8List>` thay vì `Stream<String>` giải mã UTF-8; spec backend không đổi; bản dẫn xuất nằm ở `mobile/.dart_tool/pns_api/` (không commit); drift-guard trong `flutter test` chạy lại chính script trong thư mục tạm và so từng byte; `applicationId`/`namespace` Android **và** bundle iOS đều `com.twops.solar` (Đại Ca chốt 2026-10-22; muốn `com.2ps.solar` nhưng Android cấm đoạn bắt đầu bằng số — Flutter tự đổi thành `com.u2ps.solar` — nên hai bên cùng dùng `com.twops.solar`), nhãn app "Phương Nam Solar", manifest main có `INTERNET` + `allowBackup="false"`, HTTP cleartext chỉ ở manifest debug; `AppPhoneFrame` có chế độ "trần" qua `AppPhoneFrameScope(bare: true)` do app thật đặt ở gốc (màn chạy tràn màn hình trong `SafeArea`, test/demo giữ khung mockup); Quên mật khẩu trên mobile **chưa nối** ở 10.6 (`onForgotPassword: null`, nối cùng adapter password ở 10.7 — không đặt fake vào composition root); thiếu `API_BASE_URL` ⇒ màn lỗi cấu hình, không request; trang đã đăng nhập tạm là "Đã đăng nhập." + Đăng xuất (10.7 thay bằng điều hướng).

### Story 10.7: Mobile: điều hướng và adapter danh mục, khách, tài khoản
As a nhân viên hiện trường, I want chuyển giữa các tab và màn có sẵn với dữ liệu thật, chỉ thấy mục có quyền, So that tra khách, danh mục, bảo hành ngay tại công trình.
**Acceptance Criteria:**
- **Given** bottom-nav 5 tab cố định (Story 1.8), **When** đăng nhập xong, **Then** điều hướng (mặc định `go_router`) nối 5 tab và FAB tới màn thật; không đổi số tab; mục thiếu quyền không xuất hiện (UX-DR-15, UX-DR-22).
- **Given** port me, password, catalog, customers, warranty, **When** dùng adapter, **Then** cài đúng interface port hiện có bằng client sinh (10.6); tên method tiếng Việt (nếu có) đổi sang tiếng Anh cùng caller.
- **Given** mỗi adapter, **When** test, **Then** có ca thành công + một ca lỗi envelope qua HTTP giả lập; widget test hiện có vẫn xanh.
- **Given** composition root `main.dart`, **When** khởi động, **Then** không import fake nào (guard, chống-guard-rỗng); fake chỉ còn trong test, viết lại theo type sinh.
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.7):** `go_router` khoá **17.2.3** (bản cuối cho Flutter 3.35 / Dart 3.9; 17.3+ cần Dart 3.10), không nâng Flutter, không `dependency_overrides`; nối tab **dần**: 10.7 nối tab **Menu** + mọi màn con của Menu, Đơn hàng/Kho/FAB Tạo nối ở **10.8**, Trang chủ ở **8.1** — tab chưa nối bấm không làm gì (không màn giữ chỗ); bottom-nav nhận ý định qua `AppBottomNavScope` (prop riêng của widget thắng scope, shell không import router, không sửa 18 màn); Menu (`kMobileMenu`) **chỉ hiện mục có màn mobile** — Khách hàng (`customers.manage`), Tra cứu bảo hành (any-of `orders.view_all`/`orders.view_own`), Hồ sơ — gate trùng `SIDEBAR_NAV` web theo key (guard `menu-nav-parity.test.mjs`); `AppNavLink` có `requiresAny` + `subtitle`; route tiếng Anh `/menu`, `/customers`, `/customers/lookup`, `/customers/:phone` (SĐT `Uri.encodeComponent`), `/warranty`, `/profile`, landing `/menu`; path lạ/thiếu quyền ⇒ redirect top-level về landing dùng chung gate với Menu; màn con `push` (back Android pop), tab `go`; `PermissionsProvider` dựng lại mỗi lần đăng nhập (đổi account không dính quyền cũ), `/me` lỗi ⇒ màn lỗi + Thử lại/Đăng xuất; type dữ liệu port me/customers/warranty = `typedef` type sinh (10 typedef) + `CatalogGroupItem` typedef, `CatalogProduct`/`CatalogGroup`/`CatalogGroupDetail` giữ **class projection** không `costPrice` (Dart không có `Pick`; guard field ⊂ DTO); field theo contract (`phone`, `nationalId`, `confirmedAt`, ngày `DateTime` UTC, số `num` → `.toInt()` ở điểm dùng, `warrantyStatus` enum sinh — `$unknown` ⇒ màu trung tính); adapter customers/warranty đổi `ApiError` → `CustomerPortException`/`WarrantyPortException` ở **một chỗ mỗi adapter** (`fieldErrorMap`: message đầu tiên mỗi field), me/password/catalog ném `ApiError`; `Transport.call` bắt lỗi parse body 2xx ⇒ `ApiError` câu chung; select tạo khách chỉ hiện nguồn `active` (`listSources` gửi `includeInactive=true`), lỗi field `phone` hiện dưới ô SĐT (như web); `HttpCatalogPort` có code + test nhưng **chưa dựng trong `main.dart`** (không màn nào ở router dùng — nối cùng FAB ở 10.8); Quên mật khẩu nối thật từ Đăng nhập; Đăng xuất ở **Menu** (web để ở Hồ sơ); **thế hệ phiên** web + mobile: store đếm `generation` (tăng ở đăng nhập và `clear`, không tăng khi refresh), refresh xong mà generation đã đổi (đăng xuất/đăng nhập khác giữa chừng) thì không ghi token, không xoá phiên, không báo hết phiên. **Chốt thêm ở review 10.7:** đăng xuất xoá phiên cục bộ **trước** khi gọi `POST /auth/logout`, và refresh trả 200 sau khi thế hệ phiên đã đổi thì **thu hồi** refresh token mới (best-effort `POST /auth/logout`) — server không còn phiên mồ côi; refresh đang bay chỉ được chia sẻ trong **cùng** thế hệ phiên (phiên mới tự refresh riêng); `fieldErrors` nhiều message cùng một field ⇒ **cả web và mobile hiện message ĐẦU** (web `fieldErrorsOf` ở CustomerPick/CreateQuote đổi theo); chọn/tạo khách ở `/customers/lookup` ⇒ form rời stack, chi tiết khách mở trên danh sách và danh sách tải lại; back Android ở Quên mật khẩu về Đăng nhập.

### Story 10.8: Mobile: adapter đơn, kho, tiền, chứng từ và nút chi tiết đơn theo quyền
As a nhân viên bán hàng/hiện trường, I want tạo báo giá, chốt, chuyển trạng thái kèm ảnh, ghi thanh toán, xem HĐ/hoá đơn trên điện thoại với backend thật, So that không cần quay về văn phòng.
**Acceptance Criteria:**
- **Given** port orders, inventory, stock-vouchers, payments, contracts, invoices, **When** dùng adapter, **Then** cài bằng client sinh; method tiếng Việt đổi sang tiếng Anh cùng caller (mặc định §6.8).
- **Given** chụp/chọn ảnh và chia sẻ PDF/ảnh, **When** gọi, **Then** upload multipart qua backend (AD-3); tải nhị phân kèm Bearer rồi chuyển byte cho `share_plus` (UX-DR-21, mặc định §6.18).
- **Given** chi tiết đơn mobile, **When** điều hướng render màn, **Then** nút Thanh toán/Hợp đồng/Hoá đơn có callback theo cùng luật quyền như web 10.5 (mặc định §6.19); widget test cho account đủ và thiếu quyền.
- **Given** ghi thanh toán, **When** gửi, **Then** khoá idempotency truyền nguyên vẹn; retry không ghi trùng (NFR-1).
- **Given** backend + `pns-postgres` local và emulator Android, **When** smoke đầu-cuối, **Then** đăng nhập → tạo báo giá → chốt → ghi thanh toán → xem HĐ/hoá đơn → chia sẻ PDF thành công; ghi vào Dev Agent Record (mặc định §6.21).
- **Ghi từ Story 10.7:** nối tab **Đơn hàng** (1), **Kho** (3) và FAB **Tạo** (`CreateQuoteScreen`, dựng `HttpCatalogPort` trong `main.dart` lúc này) qua `AppBottomNavScope` trong `SignedInApp`; thêm route + key vào `kNavRoutes`; landing đổi thành `/orders` khi account có quyền xem đơn (giống web), còn lại `/menu`.
- **Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.8):** spec dẫn xuất mobile (`buildMobileSpec`) nay đổi thêm **schema `format: date`** (bỏ `format`, giữ `string` — đúng 2 chỗ `paidOn`, ít hơn ⇒ script dừng) để `paidOn` sinh `String`: `DateTime` sinh gửi `2026-10-21T00:00:00.000` ⇒ backend `@Matches` trả 400 mọi lần ghi thanh toán; spec backend không đổi; body request đi qua `mobile/lib/api/sparse_bodies.dart` (lớp con riêng của DTO sinh, `toJson` chỉ giữ key có mặt) cho `PATCH /orders/:id` (cờ phạm vi/metadata — DTO trần gửi `kWp: null` ⇒ **xoá kWp**), `PATCH` dòng (`warrantyMonths: null` = bỏ bảo hành), `POST` dòng, `preview-total` (field `IsOptionalNotNull` ⇒ `null` là 400) và **`POST /stock-vouchers`** (phiếu **xuất** phải VẮNG `unitCost`, `null` là 400 — bẫy phát hiện khi làm, story chưa ghi); upload ảnh: `Transport.uploadPart` dựng part từ **byte** (phát lại 401 clone được) với content type của picker, không có thì Dio tự suy theo đuôi tên file (dio 5.9 `lookupMediaType`) — bỏ bảng đuôi→mime dự kiến ở adapter vì trùng; tải nhị phân `Stream<Uint8List>` gom trong `transport.call` (`collectBytes`), tên file lấy từ **metadata** (báo giá: `export-quote`; HĐ: overview `fileName` + `.pdf`, không có ⇒ `<contractId>.pdf`; hoá đơn: chi tiết `pdf.fileName`, không có ⇒ `<invoiceId>.pdf`); `AppShareFn` thêm `fileNames` ⇒ `fileNameOverrides` của share_plus vì trên Android/iOS `XFile.fromData(name:)` không giữ tên (chooser hiện tên UUID — lỗi tiềm ẩn từ 4.8/7.3/7.5, lộ khi smoke); `recordPayment`: khoá idempotency đi nguyên trong body, `amount` vắng ⇒ adapter ném lỗi field `amount` (`isInt`, câu backend), 0 request; lỗi port đổi ở **một chỗ mỗi adapter** (orders/stock-vouchers/payments/contracts/invoices; inventory ném nguyên `ApiError`); 55 type port = `typedef` type sinh (giữ tay: input ba trạng thái, `RecordPaymentInput`, file tải, lớp lỗi); `kMobileTabLinks` (orders any-of xem đơn, inventory any-of `inventory.manage`/`quotes.create_edit`, trùng `SIDEBAR_NAV`) — tab/FAB account không mở được **bấm không làm gì**; landing `/orders` khi xem được đơn, còn lại `/menu`; route con gate thêm quyền (`/orders/new` `quotes.create_edit`, `/orders/discount-approvals` `discounts.approve`, `…/contracts` `contracts.generate`, `…/invoices[/:id]` `invoices.manage`, `/inventory/vouchers` `inventory.manage`); `OrderListScreen.onOpenDiscountApprovals` (nút "Duyệt chiết khấu") và "+ Tạo đơn" chỉ khi có `onAdd` (cả trạng thái rỗng, như web); callback mở màn con **có ghi** trả `Future` và màn dưới tải lại khi màn con đóng (chi tiết đơn, danh sách đơn, Tồn kho); form báo giá chốt ⇒ pop rồi push chi tiết; mở form bằng FAB ⇒ danh sách đơn dựng lại (khoá theo lượt) khi form đóng; `AppPorts` gom 11 port (main.dart dựng 12 adapter, gồm `HttpCatalogPort`); enum `$unknown` ⇒ nhãn trung tính `—` (mobile lệch web ở `stockStatus` lạ: web rơi vào "Đủ"); xoá `design-system/lib/web-mobile-contract-map.mjs` — guard parity đọc tên contract hai bên (`mobileAliasDto`/`mobileDtoSource`). **Chốt review (2026-10-22):** bấm tab Đơn hàng/Kho (`go` bỏ các màn đã push mà không hoàn tất future của chúng) và đóng đơn mới mở sau khi chốt báo giá ⇒ danh sách đơn/Tồn kho đọc lại qua tín hiệu `reloadSignal` (`Listenable`) do `SignedInApp` giữ — thay cách đổi key + `router.refresh()` (gọi lúc pop đang lắng lại áp vị trí cũ ⇒ back không về danh sách); chi tiết đơn đọc lại **im lặng** khi quay về (không nháy skeleton, lỗi thì giữ dữ liệu đang hiện); gate route con đọc theo segment (dấu `/` cuối không làm rơi quyền con); giá trị enum lạ: loại HĐ ⇒ `—` (không đoán "HĐ Mua bán"), loại phiếu kho ⇒ chip `—`, số lượng không dấu, không ghi chú nhập/xuất (mobile lệch web có chủ đích như `stockStatus`), `vatMode` lạ của đơn ⇒ preview-total bỏ field (không gửi lại giá trị lạ ⇒ 400); nút "Ghi nhận" với trạng thái đợt lạ GIỮ như web (`!= 'paid'`, guard parity ghim; backend kiểm `recordable`).

### Story 10.9: Đăng nhập bằng số điện thoại (thay email)
As a nhân viên, I want đăng nhập bằng số điện thoại của mình, So that không phải nhớ email công ty. [Đại Ca chốt 2026-10-22: **chỉ SĐT**, bỏ đăng nhập bằng email; chạy sau 10.8, trước retro Epic 10]
**Acceptance Criteria:**
- **Given** bảng `Account` chỉ có `email`, **When** migration, **Then** thêm cột `phone` (E.164, `@unique`, nullable vì account cũ chưa có số); `email` GIỮ làm thông tin liên hệ, không còn là định danh đăng nhập.
- **Given** `POST /auth/login`, **When** gửi `{ phone, password }`, **Then** backend chuẩn hoá SĐT bằng đúng helper AD-9 của khách (`backend/src/customers/domain/phone.ts`, chuyển ra `common/` nếu cần dùng chung) rồi mới tra; số không phân giải được ⇒ 400 + `fieldErrors.phone`; sai SĐT/mật khẩu/account chưa có SĐT/inactive ⇒ cùng 401 `AUTH_FAILED_MESSAGE` (không dò được SĐT nào tồn tại); field `email` trong body login bị từ chối (400), không lặng lẽ bỏ qua.
- **Given** quên/đặt lại mật khẩu, **When** `POST /auth/forgot-password` + `/auth/reset-password`, **Then** định danh cũng là `phone` (cùng chuẩn hoá, cùng body trả giống hệt nhau dù số tồn tại hay không); kênh gửi mã giữ nguyên như hiện tại.
- **Given** seed, **When** `npx prisma db seed`, **Then** đọc thêm `SEED_ADMIN_PHONE` (bắt buộc cùng `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`); `.env.example` + `backend/README.md` cập nhật; KHÔNG đọc/sửa `backend/.env`.
- **Given** `GET /me`, **When** gọi, **Then** trả thêm `phone`; `openapi.json` sinh lại, client web + Dart sinh lại (drift-guard xanh).
- **Given** màn Đăng nhập + Quên mật khẩu web và mobile, **When** dùng, **Then** ô "Số điện thoại" (bàn phím số trên mobile, `autocomplete="tel"` trên web) thay ô email; gửi chuỗi THÔ, client không tự chuẩn hoá (AD-9); lỗi `fieldErrors.phone` hiện dưới ô; bỏ `maskEmail` ở mobile, câu xác nhận không lộ số có tồn tại hay không.
- **Given** test, **When** 5 lane, **Then** ca unit + e2e login bằng SĐT nhiều dạng (`0912 345 678`, `+84912345678`), ca email-trong-body ⇒ 400, ca account chưa có SĐT ⇒ 401 cùng message; ca DB: hai account trùng SĐT ⇒ unique vi phạm; widget test mobile + vitest web cho ô SĐT; smoke thật đăng nhập bằng SĐT trên web và emulator.
- **Quyết định chốt khi làm story (2026-10-22):** `email` trong body bị 400 `isAbsent` ở CẢ BA route `/auth/login|forgot-password|reset-password` (kể cả `email: null`), field ẩn khỏi OpenAPI (`@ApiHideProperty`) để client sinh không bao giờ gửi; số không phân giải được ⇒ 400 `fieldErrors.phone` ở cả ba route, TRƯỚC khi tra account; câu xác nhận bước 2 Quên mật khẩu = "Nếu số điện thoại đã đăng ký, mã 6 số sẽ được gửi tới số đó. Mã có hiệu lực 5 phút." (không nhắc lại số đã gõ); client chỉ validate rỗng; seed: vắng cả ba biến ⇒ bỏ qua, thiếu một ⇒ ném, `SEED_ADMIN_PHONE` không hợp lệ ⇒ ném.
- **Ngoài phạm vi:** form tạo/sửa account (Epic 8 — form account Epic 8 phải BẮT BUỘC SĐT, ghi vào Story 8.x khi viết); OTP SMS; đăng nhập bằng email song song.

## Epic 11: Chuyển mobile sang BLoC (chạy TRƯỚC Epic 8)
_Chèn bởi correct-course 2026-10-23 (H-4 retro Epic 10, Đại Ca chốt: BLoC bắt buộc, chuyển hết màn cũ trước Epic 8). **Chạy sau Epic 10, TRƯỚC Epic 8.** Thứ tự nội bộ: 11.1 (nền + guard + phiên + đăng nhập/menu) → 11.2 → 11.3 → 11.4 (guard khoá, allowlist rỗng). H-5 (guard ship kèm mutant + danh sách biến thể) áp từ guard của 11.1. Luật chung cho mọi story: màn chỉ render state + gửi sự kiện; chỉ cubit/bloc gọi port; cubit nhận port qua constructor (`main.dart` → `AppPorts` → constructor màn giữ nguyên chữ ký → `BlocProvider`); Cubit mặc định; state bất biến `Equatable` (`sealed` khi pha khác nhau); test widget hiện có không đổi finder/expect/fake; thêm `bloc_test` cho logic; không đổi hành vi người dùng thấy, không đổi port/adapter/transport/client sinh/router. 20 mặc định tuyên bố trước: [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` §6]._

### Story 11.1: Nền BLoC: dependency, guard màn không gọi port, phiên và màn đăng nhập
As a lập trình viên mobile, I want nền BLoC (dependency, quy ước, guard) cùng phiên, quyền và các màn đăng nhập/menu chạy bằng Cubit, So that mọi màn sau chuyển theo cùng một khuôn đã được khoá bằng test.
**Acceptance Criteria:**
- **Given** Flutter 3.35.0 / Dart 3.9.0 trên máy, **When** thêm dependency, **Then** `mobile/pubspec.yaml` có `flutter_bloc: ^9.1.1`, `equatable: ^3.0.0` và dev `bloc_test: ^10.0.0`; `flutter pub get` giải được (probe 2026-10-23: `bloc 9.2.1`, `test 1.26.2`); **không** `dependency_overrides`, không nâng Flutter, không thêm `get_it`/`freezed`/`hydrated_bloc`/`bloc_concurrency` (mặc định §6.2).
- **Given** `bloc_test` (qua package `test`) không giải chung được với `json_serializable 6.14.1` (cần `analyzer >= 10`) dưới ghim `test_api 0.7.6` của `flutter_test`, **When** thêm `bloc_test`, **Then** 5 dev dep sinh client (`swagger_parser`, `build_runner`, `retrofit_generator`, `json_serializable`, ghim `source_helper: 1.3.13`) chuyển sang package Dart thuần `mobile/tool/codegen/` (pubspec + lock riêng, **cùng version**); `dart run tool/generate_api.dart` (lệnh giữ nguyên) chạy `swagger_parser` + `build_runner` trong package đó và ghi ra `mobile/lib/api/generated`; client sinh **giống từng byte** bản đang commit; `generated_client_drift_test.dart` chạy theo đường dẫn mới và vẫn so từng byte; runtime `dio`/`retrofit`/`json_annotation` giữ nguyên; **không hạ version toolchain** (hạ làm 10 test API đỏ, mặc định §6.3).
- **Given** `PnsApp` giữ pha phiên trong `State` (`restoring/signedOut/forgotPassword/signedIn`, `_loggingOut`, `_signInCount`, nghe `sessionExpired`), **When** chuyển, **Then** `SessionCubit` (nhận `AuthPort` qua constructor) giữ các pha đó; `PnsApp` chỉ render theo state; hết phiên vẫn về Đăng nhập; `pns_app_test.dart` xanh không đổi finder/expect.
- **Given** `PermissionsProvider` gọi `/me` trong `State`, **When** chuyển, **Then** `PermissionsCubit` (nhận `MePort`) gọi `/me`; `PermissionsScope.of(context)` **giữ nguyên làm API đọc quyền** cho `AppGate`/`filterNav`/`orderScope` (không sửa primitive gating); cubit dựng lại mỗi lần đăng nhập (đổi account không dính quyền cũ); `/me` lỗi ⇒ màn lỗi + Thử lại/Đăng xuất như hiện tại; `session_test.dart`, `signed_in_app_test.dart` xanh.
- **Given** `LoginScreen`, `ForgotPasswordScreen`, `MenuScreen`, **When** chuyển, **Then** mỗi màn có một cubit (`LoginCubit`, `ForgotPasswordCubit`, `MenuCubit` hoặc trạng thái đăng xuất đọc từ `SessionCubit`) giữ đang gửi/lỗi/`fieldErrors.phone`/bước; **constructor public của màn giữ nguyên chữ ký**; `TextEditingController`/`FocusNode` được ở lại `State` (mặc định §6.9); test widget auth (27 ca) + menu (7 ca) xanh không đổi finder/expect/fake.
- **Given** guard mới `mobile/test/screens/no_port_call_in_screens_test.dart`, **When** chạy `flutter test`, **Then** trong `mobile/lib/screens/**` chỉ `*_cubit.dart`/`*_bloc.dart` được gọi method trên port; guard bắt `port.x(`, `widget.port.x(`, port tên khác (`ordersPort`, `inventoryPort`, `catalogPort`…), alias cục bộ, tear-off không ngoặc, `.call(`; allowlist liệt kê **16 file màn chưa chuyển**, mỗi entry **tự kiểm còn vi phạm** (màn đã sạch mà còn trong allowlist ⇒ ĐỎ); chống guard rỗng: số file màn quét ≥ 20 **và** có ít nhất một file cubit gọi port; **đột biến** (H-5): thêm lại một lời gọi port vào `login_screen.dart` theo từng biến thể ⇒ ĐỎ (mặc định §6.13).
- **Given** text-guard `design-system/screens/login.test.mjs` và `forgot-password.test.mjs` đọc file màn mobile theo đường dẫn, **When** logic dời sang cubit, **Then** guard đọc file màn + `*_cubit.dart`/`*_state.dart` cùng thư mục **của chính màn đó theo tên** (`<screen>_cubit.dart`, §6.15; file logic không thuộc màn nào ⇒ helper ném — review 11.1, proposal §7.6); không nới regex, không xoá assert; đột biến đưa mẫu bị cấm vào file cubit ⇒ ĐỎ (mặc định §6.14).
- **Given** mỗi cubit mới, **When** `flutter test`, **Then** có ca `bloc_test`: trạng thái đầu; thành công; lỗi port ⇒ state lỗi mang đúng câu tiếng Việt từ adapter; phản hồi port về sau `close` ⇒ không ném, không `emit` (mặc định §6.10).
- **Given** quy ước mới, **When** story commit, **Then** đầu `app_session.dart` bỏ câu "InheritedWidget (not flutter_bloc) keeps this dependency-free"; `flutter analyze` sạch; lane mobile + design-system xanh; quyết định giữa story ghi vào proposal 2026-10-23 cùng commit (G-5).

### Story 11.2: Chuyển BLoC màn khách hàng, bảo hành, hồ sơ
As a nhân viên hiện trường, I want màn khách hàng, tra cứu bảo hành và hồ sơ chạy bằng Cubit mà vẫn y như cũ, So that phần Menu của app theo một khuôn duy nhất trước khi Epic 8 thêm màn.
**Acceptance Criteria:**
- **Given** `customer_list_screen.dart`, `customer_detail_screen.dart`, `customer_pick_screen.dart`, `warranty_lookup_screen.dart`, `profile_screen.dart`, **When** chuyển, **Then** mỗi màn một cubit cạnh file màn (`CustomerListCubit`, `CustomerDetailCubit`, `CustomerPickCubit`, `WarrantyLookupCubit`, `ProfileCubit`) nhận `CustomersPort`/`WarrantyPort`/`PasswordPort` qua constructor; màn chỉ render state + gửi sự kiện; constructor public của màn giữ nguyên chữ ký.
- **Given** tra SĐT chọn/tạo khách inline (`customer_pick`), **When** chuyển, **Then** giữ nguyên: select tạo khách chỉ hiện nguồn `active`, lỗi `fieldErrors.phone` dưới ô SĐT, chọn/tạo xong rời form và danh sách tải lại; hồ sơ đổi mật khẩu giữ "sai mật khẩu hiện tại ⇒ giữ phiên".
- **Given** guard "màn không gọi port", **When** story xong, **Then** allowlist bớt đúng 5 entry trên (tự kiểm: entry nào còn sót ⇒ ĐỎ); đột biến thêm lại lời gọi port vào `customer_pick_screen.dart` ⇒ ĐỎ.
- **Given** text-guard `customers.test.mjs`, `warranty-lookup.test.mjs`, `profile.test.mjs`, **When** logic dời sang cubit, **Then** guard đọc cả `*_cubit.dart`/`*_state.dart` cùng thư mục; đột biến đưa mẫu bị cấm (vd `AppPerm.`) vào file cubit ⇒ ĐỎ.
- **Given** test widget khách (18 ca), bảo hành (12), hồ sơ (11) và `signed_in_app_test`, **When** chạy, **Then** xanh, không đổi finder/expect/fake; mỗi cubit có `bloc_test` (đầu, thành công, lỗi port, đóng sớm).
- **Given** 5 lane, **When** story commit, **Then** mobile + design-system xanh, `flutter analyze` sạch; backend/web không đổi.

### Story 11.3: Chuyển BLoC màn đơn hàng và báo giá
As a nhân viên bán hàng/hiện trường, I want danh sách đơn, chi tiết đơn, chuyển trạng thái, duyệt chiết khấu và tạo báo giá chạy bằng Cubit mà luồng không đổi, So that phần lõi của app theo khuôn BLoC trước khi Epic 8/9 nối thêm vào đơn.
**Acceptance Criteria:**
- **Given** `order_list_screen.dart`, `order_detail_screen.dart` (3 State), `order_status_change_screen.dart`, `discount_approval_screen.dart`, `create_quote_screen.dart`, **When** chuyển, **Then** mỗi route một cubit (`OrderListCubit`, `OrderDetailCubit`, `OrderStatusChangeCubit`, `DiscountApprovalCubit`, `CreateQuoteCubit`; State con của chi tiết đơn dùng cubit màn hoặc giữ State thuần UI) nhận `OrdersPort`/`CatalogPort`/`CustomersPort` qua constructor; constructor public của màn giữ nguyên chữ ký; `stock_issue_preview.dart` (không state) giữ nguyên.
- **Given** hành vi điều hướng chốt ở 10.8 (`reloadSignal` của danh sách đơn, chi tiết đơn **đọc lại im lặng** khi quay về và giữ dữ liệu nếu lỗi, callback màn con trả `Future` để màn dưới tải lại, form báo giá chốt ⇒ pop rồi push chi tiết), **When** chuyển, **Then** giữ nguyên từng điểm: `reloadSignal` vào cubit thành một lời gọi tải lại; `order_routes_test.dart` xanh không đổi.
- **Given** giỏ hàng tạo báo giá, **When** sửa số lượng/đơn giá, **Then** tổng vẫn lấy từ `POST /orders/preview-total`, client không tính tiền (AD-2, AD-16); thứ tự và số lượng request preview giữ như cũ; body thưa (`sparse_bodies.dart`) giữ nguyên; text-guard tiền vẫn xanh.
- **Given** chuyển trạng thái kèm ảnh, huỷ đơn kèm lý do, ảnh đính kèm, xuất báo giá + chia sẻ, chặn thiếu tồn khi xuất, **When** chuyển, **Then** hành vi giữ nguyên; test widget đơn (143 ca ở `test/screens/orders/`) xanh không đổi finder/expect/fake.
- **Given** guard "màn không gọi port", **When** story xong, **Then** allowlist bớt đúng 5 entry (tự kiểm); đột biến thêm lại lời gọi port vào `order_detail_screen.dart` (cả dạng `widget.port` và alias cục bộ) ⇒ ĐỎ.
- **Given** text-guard `orders.test.mjs`, `orders-list.test.mjs`, `order-detail.test.mjs`, `order-transition.test.mjs`, `order-cancel.test.mjs`, `order-attachments.test.mjs`, `discount-approval.test.mjs`, `quote-stock-check.test.mjs`, `stock-issue.test.mjs`, **When** logic dời sang cubit, **Then** guard đọc cả file cubit/state cùng thư mục; đột biến đưa phép tính trên field tiền vào `create_quote_cubit.dart` ⇒ guard tiền ĐỎ.
- **Given** mỗi cubit, **When** `flutter test`, **Then** có `bloc_test`: đầu, thành công, lỗi port, đóng sớm; thêm ca riêng cho đọc lại im lặng (lỗi ⇒ giữ dữ liệu cũ) và preview-total về sai thứ tự (chỉ kết quả mới nhất được hiện).
- **Given** 5 lane, **When** story commit, **Then** mobile + design-system xanh, `flutter analyze` sạch.

### Story 11.4: Chuyển BLoC màn thanh toán, kho, hợp đồng, hoá đơn và khoá guard
As a kế toán/thủ kho trên điện thoại, I want lịch thanh toán, tồn kho, phiếu kho, hợp đồng và hoá đơn chạy bằng Cubit mà vẫn y như cũ, So that 100% màn mobile theo khuôn BLoC và Epic 8 bắt đầu trên nền sạch.
**Acceptance Criteria:**
- **Given** `payment_schedule_screen.dart`, `inventory_screen.dart`, `stock_vouchers_screen.dart` (3 State), `contracts_screen.dart`, `invoices_screen.dart`, `invoice_detail_screen.dart`, **When** chuyển, **Then** mỗi route một cubit (`PaymentScheduleCubit`, `InventoryCubit`, `StockVouchersCubit`, `ContractsCubit`, `InvoicesCubit`, `InvoiceDetailCubit`) nhận port qua constructor; constructor public của màn giữ nguyên chữ ký; `reloadSignal` của Tồn kho giữ hành vi.
- **Given** ghi thanh toán, **When** gửi, **Then** khoá idempotency do port sinh vẫn truyền nguyên vẹn, retry không ghi trùng (NFR-1); `amount` trống ⇒ lỗi field `amount`, 0 request; nút "Ghi nhận" giữ luật `!= 'paid'` (guard parity ghim).
- **Given** phiếu xuất kho, tải + chia sẻ PDF hợp đồng/hoá đơn, **When** chuyển, **Then** giữ nguyên: phiếu xuất VẮNG `unitCost`, tên file lấy từ metadata (`fileNameOverrides`), giá trị enum lạ ⇒ `—`; test widget thanh toán (42), kho (39), hợp đồng (20), hoá đơn (38) xanh không đổi finder/expect/fake.
- **Given** guard "màn không gọi port", **When** story xong, **Then** allowlist **rỗng** và guard cấm thêm entry mới (allowlist không rỗng ⇒ ĐỎ); `grep -rl "extends StatefulWidget" mobile/lib/screens` chỉ còn màn có State thuần UI, mỗi màn còn lại ghi một dòng lý do trong Dev Notes; đột biến thêm lại lời gọi port vào `payment_schedule_screen.dart` ⇒ ĐỎ.
- **Given** text-guard `payment-schedule.test.mjs`, `inventory.test.mjs`, `stock-vouchers.test.mjs`, `contracts.test.mjs`, `invoices.test.mjs`, **When** logic dời sang cubit, **Then** guard đọc cả file cubit/state; đột biến đưa `AppPerm.` hoặc phép tính trên field tiền vào `payment_schedule_cubit.dart` ⇒ ĐỎ.
- **Given** mỗi cubit, **When** `flutter test`, **Then** có `bloc_test`: đầu, thành công, lỗi port, đóng sớm; thêm ca ghi thanh toán retry cùng khoá idempotency.
- **Given** màn hợp đồng / hoá đơn / chi tiết hoá đơn đã rời cây khi port còn chờ (sinh hợp đồng, tải PDF, tạo hoá đơn, xuất PDF), **When** port trả lời, **Then** không đọc lại overview/hoá đơn và **không mở hộp chia sẻ** — lệch có chủ đích khỏi bản cũ (bản cũ mở hộp chia sẻ đè lên màn người dùng đã chuyển sang; chứng từ vẫn sinh ở backend, vào lại màn bấm "Tải PDF"/"Xuất PDF"); chi tiết hoá đơn vẫn tải PDF nhưng không chia sẻ; thanh toán, Tồn kho, phiếu kho giữ nguyên số request. [Source: `sprint-change-proposal-2026-10-23.md` §10.6]
- **Given** backend + `pns-postgres` local và emulator Android, **When** smoke, **Then** đăng nhập → danh sách đơn → chi tiết → thanh toán → hợp đồng/hoá đơn → chia sẻ PDF thành công như smoke 10.8; ghi vào Dev Agent Record. Emulator không chạy được ⇒ ghi rõ lane chưa chạy, báo Đại Ca, không coi là đạt (mặc định §6.17).
- **Given** epic xong, **When** story commit, **Then** `project-context.md` bỏ câu "màn trong allowlist vẫn là StatefulWidget gọi port"; 5 lane xanh; `flutter analyze` sạch.

## Epic 8: Quản trị — Dashboard, Phân quyền & Audit
_Dashboard doanh thu/đơn theo trạng thái; màn phân quyền (ma trận per-account + áp preset role) + form account; màn xem Audit log (chỉ Super Admin). Ghi audit là cross-cutting, đã emit ở E3–E7. FR-16,17,18,19,20._

_**Mobile: BLoC từ đầu** (correct-course 2026-10-23, Epic 11). **Chạy sau Epic 11.** Mọi màn mobile mới của Epic 8 (8.1 Trang chủ, 8.5 Audit qua Menu, và màn khác nếu story thêm) dựng bằng Cubit/Bloc. Cubit nhận port qua constructor từ `main.dart` và là nơi duy nhất gọi port; màn chỉ render state + gửi sự kiện; logic có `bloc_test`. Guard "màn không gọi port" (allowlist rỗng từ 11.4) phủ màn mới. [Source: `sprint-change-proposal-2026-10-23.md` §6]_

### Story 8.1: Dashboard vận hành
As a người có quyền xem dashboard, I want xem doanh thu theo ngày/tuần/tháng và đếm đơn theo trạng thái, So that nắm toàn cảnh vận hành bất cứ lúc nào.
**Acceptance Criteria:**
- **Given** mốc thời gian chọn, **When** xem dashboard, **Then** hiển thị doanh thu theo ngày/tuần/tháng + số lượng đơn + tổng hợp đơn theo từng Trạng thái, dùng KPI + chart component (FR-19, UX-DR-12).
- **Given** quyền "xem dashboard tài chính", **When** render, **Then** chỉ account có quyền mới thấy số liệu doanh thu; account thiếu quyền vẫn xem được đếm đơn nhưng không thấy tiền (FR-19, UX-DR-22).
- **Given** dữ liệu tổng hợp, **When** tính, **Then** tính ở backend (`dashboard/`), client chỉ hiển thị (AD-2).
- _Đã chốt (G-6, 2026-10-22, mặc định thành quyết định):_ **doanh thu = Σ `Payment.amount` theo `paidOn`** (giờ UTC+7 khi gom ngày/tuần/tháng), không theo tổng đơn chốt. Tiền hiển thị qua formatter/Money component có sẵn (`83.010.960 đ`); guard tiền design-system (đã vá TD-76) phủ màn mới.
- _Quyết định giữa story (2026-10-23, Story 8.1):_
  - **Trang chủ là màn đáp sau đăng nhập** cho MỌI account: web route `/dashboard` (mục sidebar `home`, không cần quyền), mobile tab Trang chủ (index 0) mở Dashboard. Mọi đường bị gate/không tồn tại cũng đáp về `/dashboard` (trước: Đơn hàng hoặc Menu/Hồ sơ).
  - **Một endpoint, một kỳ:** `GET /dashboard/summary?period=day|week|month` (mặc định `month`), mở cho ai có ít nhất một trong `orders.view_all`, `orders.view_own`, `dashboard.finance_view`; mỗi khối tự `null` theo quyền của nó (backend không gửi số). Thiếu cả ba ⇒ 403 ⇒ màn hiện "Không có số liệu cho tài khoản này" (không thử lại).
  - **Kỳ:** Ngày = hôm nay VN; **Tuần bắt đầu thứ Hai**; Tháng = ngày 1 → hôm nay VN; response trả `from`/`to`.
  - **Doanh thu toàn công ty**, không thu hẹp theo phạm vi đơn: ai có quyền tài chính thấy mọi khoản thu. Số đơn mới + đơn theo trạng thái dùng CHÍNH mệnh đề phạm vi của `GET /orders`.
  - **`ordersByStatus` là ảnh chụp hiện tại**, không lọc theo kỳ (đủ 10 trạng thái, thiếu ⇒ 0); "Đơn mới" mới lọc theo kỳ.
  - **Bỏ khỏi Phase này:** delta "▲ % so kỳ trước" và khối "Đơn gần đây" của mockup (không có AC; delta là phép tính tiền phải làm ở backend; "Đơn gần đây" đã có ở màn Đơn hàng). Muốn thêm là story/thay đổi riêng.
  - Tiền hiển thị đủ chữ số (`1.240.000.000 đ`), không rút gọn "1,24 tỷ" như mockup. Mobile chọn kỳ bằng `AppTabs` (chưa có seg control Flutter), nhãn trùng web.

### Story 8.2: Màn phân quyền — ma trận per-account + áp preset Role
As a Admin, I want màn ma trận Quyền theo Account với nút áp preset Role, So that cấp đúng quyền cho từng người nhanh gọn.
**Acceptance Criteria:**
- **Given** một Account chọn, **When** áp preset Role, **Then** nạp giá trị quyền mặc định rồi cho tick/bỏ từng ô; nguồn chân lý là bộ quyền trên Account, không phải Role (FR-17, AD-8).
- **Given** sửa quyền một Account, **When** lưu, **Then** KHÔNG ảnh hưởng Account khác cùng Role; đổi định nghĩa preset Role sau này không hồi tố Account đã tạo (FR-17).
- **Given** ma trận quyền, **When** render, **Then** dùng key từ registry chính tắc (Epic 2), không literal ngoài registry (AD-17).
- _Ghi chú bắt buộc (H-7 / TD-65):_ ma trận tuỳ chỉnh tạo được tổ hợp gây 403 giữa luồng — `settings.manage` không kèm `customers.manage` (phần nguồn khách ở màn Cấu hình), `quotes.create_edit` không kèm `customers.manage` (`/orders/new` bước tra khách). Story phải xử lý tổ hợp này (cảnh báo phụ thuộc trong ma trận hoặc ẩn/hạ cấp phần màn phụ thuộc) và có test cho cả hai tổ hợp; preset có sẵn không bị ảnh hưởng.
- _Quyết định giữa story (2026-10-23, Story 8.2):_
  - **TD-65 xử lý bằng CHẶN, không chỉ cảnh báo:** bảng phụ thuộc `PERMISSION_REQUIRES` ở `accounts/domain/permission-dependencies.ts` — `settings.manage` cần `customers.manage`; `quotes.create_edit` cần `customers.manage` **và** `catalog.view` (màn tạo báo giá đọc danh mục, lỗi bị nuốt thành danh sách rỗng). Lưu bộ thiếu phụ thuộc ⇒ backend 400 `fieldErrors.permissions` câu "«A» cần thêm «B»."; UI hiện banner cùng câu và disable Lưu. Mọi preset có sẵn thoả bảng (có test). Account cũ đang vi phạm không bị sửa tự động — bị chặn khi lưu lần sau. Story 8.4 thêm entry vào CÙNG bảng.
  - **Không tự sửa quyền của chính mình** (403 "Không thể tự sửa quyền của chính mình."): chặn Super Admin duy nhất tự khoá mình khỏi màn Phân quyền; UI hiện account của mình chỉ đọc.
  - **`orders.view_all` bao hàm `orders.view_own` khi xét leo thang** (Đại Ca chốt): preset ADMIN cố ý không mang `orders.view_own` (mỗi preset đúng một phạm vi xem đơn), nên theo luật 2.10 nguyên văn Admin không cấp được preset Thợ KS/Thi công/Kho và không sửa được account mang `orders.view_own`. Bảng `PERMISSION_IMPLIES` ở `permission-escalation.ts` chỉ nới hai luật không-leo-thang cho cặp này; guard quyền vẫn so key nguyên văn; preset không đổi.
  - **Preset trả từ backend, không lưu role trên account:** `GET /accounts/permission-options` trả registry (nhãn, nhóm, `requires`, `grantable`) + các preset người gọi cấp được TRỌN (Admin không thấy Super Admin); `GET /accounts` trả mỗi account kèm `matchingPreset`/`matchingPresetLabel` (bộ quyền trùng khít một preset, không thì "Tuỳ chỉnh"), `editable` + `readOnlyReason`. Áp preset là thao tác nháp phía client; lưu luôn là `PUT /accounts/{id}/permissions` với bộ đầy đủ, ghi dưới khoá `accounts` FOR UPDATE (người sửa + account bị sửa, `ORDER BY id`), đọc quyền cả hai dưới khoá; account không có ⇒ 404.
  - **Bỏ khỏi story:** bảng "Ma trận Quyền × 6 role" (mockup web) và nút "Xem ma trận quyền × role" (mockup mobile) — không có AC. Nút "Tạo account" thuộc Story 8.3. Đổi account khi đang có thay đổi chưa lưu thì bỏ nháp.
  - **"Nhóm theo `group`" = thứ tự, không tiêu đề nhóm** (review 8.2): mockup là checklist phẳng; registry 22 quyền / 16 nhóm (đa số một quyền) và `group` là mã tiếng Anh không có nhãn ⇒ backend trả `permissions` xếp liền theo nhóm, web + mobile hiển thị đúng thứ tự đó, không thêm tiêu đề/contract `groupLabel`.
  - **Đang lưu thì khoá điều hướng** (review 8.2): web disable danh sách account tới khi lưu xong (lỗi luôn hiện trên đúng account); mobile chặn nút quay lại + cử chỉ back (danh sách đọc lại sau khi lưu commit). Lưu chỉ gửi key có trong `permission-options` (key cũ ngoài registry trên account bị bỏ thay vì làm mọi lần lưu 400) — cả hai nền tảng.

### Story 8.3: Form tạo/sửa/vô hiệu hoá Account
As a Admin, I want tạo/sửa/vô hiệu hoá Account và chọn Role preset lúc tạo, So that quản lý người dùng nội bộ.
**Acceptance Criteria:**
- **Given** tạo Account, **When** chọn Role preset, **Then** nạp bộ quyền mặc định của preset vào Account (FR-16).
- **Given** một Account, **When** vô hiệu hoá, **Then** account không đăng nhập được nhưng dữ liệu/lịch sử giữ nguyên (FR-16).
- **Given** thay đổi account, **When** lưu, **Then** ghi Audit qua event (FR-16, AD-18).
- **Given** form tạo/sửa account, **When** lưu, **Then** SĐT BẮT BUỘC (đăng nhập bằng SĐT từ Story 10.9) — chuẩn hoá `normalizeVnPhone` (E.164), unique (`accounts_phone_key`, P2002 ⇒ 409/400 trỏ ô `phone`).
- _Đã chốt (G-2 / TD-9, mặc định thành quyết định):_ Phase 1 chấp nhận access token cũ sống ≤15 phút sau đổi mật khẩu/đổi quyền/đăng xuất; vô hiệu hoá thì tức thời (JwtAuthGuard kiểm `isActive` mỗi request). Không làm denylist. Ghi vào `backend/CONVENTIONS.md` mục Auth nếu chưa có.
- _Quyết định giữa story (2026-10-23, Story 8.3):_
  - **Email bắt buộc trong form** (mockup chỉ có tên/SĐT/preset/trạng thái): `accounts.email` là NOT NULL `@unique` và `/me` + Hồ sơ đọc `email: string`; cho nullable kéo theo migration + đổi contract. Backend trim + lowercase như seed; trùng ⇒ 409 `fieldErrors.email`.
  - **Mật khẩu ban đầu do admin đặt lúc tạo** (chính sách 8 ký tự, có chữ và số — câu backend). Form sửa không có ô mật khẩu; gửi `password` trong `PUT` ⇒ 400 (không lặng lẽ bỏ). Admin đặt lại mật khẩu người khác ngoài phạm vi.
  - **Tạo nhận `preset`, không nhận bộ quyền:** `POST /accounts { displayName, phone, email, password, preset, isActive }` — backend nạp `ROLE_PRESETS[preset]` cùng transaction; preset người gọi không cấp trọn ⇒ 403 (luật #1). Tạo xong đáp vào ma trận quyền của account mới (web `/permissions` chọn sẵn qua state điều hướng; mobile pop form rồi push ma trận).
  - **Sửa = `PUT /accounts/{id}` đủ 4 field** (`displayName, phone, email, isActive`), bộ quyền không đổi. Không tự sửa/vô hiệu hoá chính mình (403 "Không thể tự sửa tài khoản của chính mình."); account mang quyền người gọi không có ⇒ 403 (luật #2); nút "Sửa account" theo `editable` của `GET /accounts`.
  - **Vô hiệu hoá = `isActive: false` trong form sửa:** MỖI lần lưu ở trạng thái tạm khoá (không chỉ lúc chuyển kích hoạt → khoá) thu hồi mọi phiên còn sống của account cùng transaction — account bị khoá bằng đường khác vẫn có thể còn phiên; kích hoạt lại không làm sống lại refresh token cũ; không xoá gì khác.
  - **Quyền người gọi kiểm lại dưới khoá:** sau khi khoá, actor phải còn `permissions.manage` (đọc qua `tx`), không thì 403 "Không đủ quyền thực hiện" — một lần thu `permissions.manage` commit trong lúc chờ khoá thắng, kể cả khi actor vẫn cấp được preset / target mang ít quyền hơn.
  - **Email trim trước khi validate** (`@Transform` ở DTO): dấu cách thừa từ bàn phím không thành "Email không hợp lệ.".
  - **Trùng SĐT/email nhận diện bằng tra lại sau P2002** (không đọc `meta` của Prisma 7, không kiểm trước khi ghi) ⇒ 409 `fieldErrors.phone` / `.email` cả khi hai lần tạo đồng thời.
  - **Một event mỗi lần lưu:** `AccountCreated` (`after` = hồ sơ + bộ quyền + preset) / `AccountUpdated` (`before` đọc dưới khoá, `after`); payload không mật khẩu/hash/token.
  - **Route form:** web `/permissions/new`, `/permissions/:id/edit`; mobile cùng đường dẫn, khai trước `/permissions/:id`; cả hai thừa gate Phân quyền. Trạng thái chọn bằng hai cờ `ScopeFlag`/`AppScopeFlag` đặt trong phần tử bấm được của màn (primitive giữ nguyên cờ hiển thị).

### Story 8.4: Cấu hình ma trận quyền hành động & duyệt
As a Admin, I want mỗi quyền chuyển trạng thái và quyền duyệt là một mục ma trận cấu hình được, So that phân quyền linh hoạt không hardcode.
**Acceptance Criteria:**
- **Given** các quyền hành động/duyệt, **When** cấu hình, **Then** mỗi quyền chuyển từng Trạng thái + quyền duyệt (chiết khấu và bước cần duyệt) là entry cấu hình được, không hardcode (FR-18).
- **Given** phạm vi xem đơn, **When** khai báo, **Then** "xem tất cả đơn" và "đơn của mình" là hai entry tường minh trong registry (FR-18, AD-17).
- **Given** một chiết khấu, **When** áp, **Then** cần duyệt bởi account có quyền duyệt chiết khấu (không hạn mức tự quyết) (FR-18).
- _Ghi chú (H-7 / TD-65):_ quyền hành động mới thêm vào ma trận phải khai phụ thuộc quyền đọc mà luồng của nó cần (cùng khuôn xử lý TD-65 ở 8.2), không để lộ 403 giữa luồng.
- _Quyết định giữa story (2026-10-30, Story 8.4):_
  - **"Cấu hình được" = tick/bỏ key per-account ở ma trận 8.2, KHÔNG sửa bảng transition lúc chạy** (AD-11 giữ một bảng chính tắc trong code). Mỗi dòng `ALLOWED_TRANSITIONS` khai `requires` bằng key registry ⇒ mỗi bước + duyệt đã là một entry ma trận. **Không thêm key mới** (một key mỗi nhánh theo ma trận PRD FR-18); tách quyền từng bước là story riêng.
  - **Gate cửa `POST /orders/:id/transition` suy từ bảng:** `MANUAL_TRANSITION_PERMISSIONS` = tập `requires` của các dòng có sự kiện thuộc lane thủ công (hiện `construction.transition`, `delivery.confirm`, `payments.record`); bảng mất hết cạnh thủ công ⇒ app ném lúc nạp (decorator rỗng sẽ mở cửa cho mọi account). Source-guard cấm `ROLE_PRESETS`/`RolePreset`/tên role ngoài `src/accounts/`.
  - **TD-65 cho quyền hành động — bảng "ít nhất một trong" `PERMISSION_REQUIRES_ANY`:** `quotes.create_edit`, `orders.confirm`, `discounts.apply`, `construction.transition`, `delivery.confirm`, `payments.record`, `contracts.generate`, `invoices.manage` cần một trong `orders.view_all`/`orders.view_own` (mọi màn của các luồng này mở từ danh sách/chi tiết đơn). `inventory.manage` KHÔNG vào bảng: Tồn kho + phiếu nhập chạy trọn không cần đơn (`stock-items.controller.ts` gate `inventory.manage`|`quotes.create_edit`, `stock-vouchers.controller.ts` gate `inventory.manage`). Thêm vào bảng AND: `discounts.approve` cần `orders.view_all` (hàng chờ duyệt lọc theo phạm vi xem đơn), `catalog.manage` cần `catalog.view`. Câu 400: «Chốt đơn» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình». Mọi preset thoả cả hai bảng (test).
  - **Contract:** `PermissionOptionDto` thêm `requiresAnyOf: string[]` và `transitions: PermissionTransitionDto[]` (`{ event, from, to }` — mọi dòng bảng mà key điều khiển, kể cả cạnh tự động `du_coc`). Web + mobile hiện dòng "Chuyển: Báo giá → Đã chốt · …" dưới ô quyền, nhãn từ map StatusChip.
  - **Tự duyệt chiết khấu giữ nguyên:** account có cả `discounts.apply` lẫn `discounts.approve` duyệt được chiết khấu mình áp; "không hạn mức tự quyết" = không ngưỡng tự duyệt (chiết khấu 1 đồng vẫn `cho_duyet` — có test).

### Story 8.5: Màn xem Audit log (gate theo quyền `audit.read`, không theo role)
As a người có quyền `audit.read`, I want xem nhật ký Audit bất biến, So that có bằng chứng minh bạch mọi hành động.
**Acceptance Criteria:**
- **Given** AuditLog append-only (đã ghi cross-cutting ở E2–E7), **When** xem, **Then** mỗi bản ghi có ai/làm gì/đối tượng/khi nào/trước→sau; bản ghi không sửa/xoá được (FR-20, AD-8).
- **Given** quyền xem Audit, **When** render nav, **Then** CHỈ account có quyền `audit.read` thấy mục Audit; mọi account khác không thấy trong nav/menu **— gate theo QUYỀN, KHÔNG theo role** (FR-20, UX-DR-22, §5).
- **Given** quyền `audit.read` ban đầu chỉ ở `SUPER_ADMIN` preset, **When** cấp, **Then** admin có thể cấp `audit.read` cho account bất kỳ qua màn Phân quyền (Story 8.2); cấp/gỡ quyền này giữ nguyên luật không-leo-thang (Story 2.10) (FR-20, AC-3).
- **Given** màn Audit, **When** dựng, **Then** dùng Table + bộ lọc theo thời gian/đối tượng, parity web (mobile qua Menu) (FR-20).
- _Quyết định giữa story (2026-10-30, Story 8.5):_
  - **Một endpoint đọc** `GET /audit-logs?targetType&from&to&page&pageSize` (mặc định 20, trần 100; mới nhất trước `occurredAt desc, id desc`). Không endpoint chi tiết, không lọc theo actor/targetId, không tìm kiếm tự do; ô "Lọc theo account, đối tượng…" và nút **"Xuất CSV"** của mockup không có AC ⇒ bỏ (story riêng nếu cần). Gate `@RequirePermissions(audit.read)`, quyền đọc FRESH mỗi request; preset `ADMIN` đầy đủ hay `settings.manage` không mở được (403).
  - **`from`/`to` là ngày VN `YYYY-MM-DD`, hai đầu tính cả**, lọc nửa mở trên `occurredAt` (UTC+7, tái dùng `vietnamRangeToInstants`); `from > to` ⇒ 400 `fieldErrors.to` (`INVALID_DATE_RANGE`); `targetType` một trong 9 loại `AUDIT_TARGET_TYPES` (enum OpenAPI `AuditTargetType`). Thêm index `audit_logs(occurred_at)`.
  - **Nhãn hành động ở backend** (`eventLabel`, `AUDIT_EVENT_LABELS` đủ 47 event type — test quét `readonly type = '…'`; type lạ ⇒ trả chính mã); **nhãn 9 loại đối tượng ở client** (cần trước khi có dữ liệu cho chip lọc), web ↔ mobile giống hệt (guard design-system `audit-log.test.mjs`).
  - **"Trước → Sau" là diff phẳng backend tính** (`changes: { field, before, after, isMoney }[]`), không trả JSON thô. _(Review 2026-10-30 sửa: trước đây object lồng/mảng hiện thành JSON thô ⇒ tiền trong `lines[]` của phiếu kho, bậc giá, lịch thanh toán KHÔNG qua formatter.)_ Hai bên được trải thành **đường dẫn lá** (`status`, `lines[0].unitCost`, `[1].price`; scalar trần ⇒ `field: ''`); giữ lá khác nhau hoặc chỉ có một bên (thứ tự lá `after` rồi lá chỉ ở `before`); một bên vắng ⇒ bên đó `null`; giá trị thành chuỗi, cắt 500 ký tự + `…`. `isMoney` do backend gắn theo **khoá cuối** của đường dẫn thuộc `AUDIT_MONEY_FIELDS` (⊇ tập field tiền của contract — guard so hai tập); client hiện qua formatter tiền (`83.010.960 đ`) khi là số nguyên thập phân an toàn, `field === 'status'` khoá đã biết ⇒ nhãn StatusChip.
  - **Giá vốn theo `costs.view` (Review 2026-10-30):** payload audit giữ đủ giá vốn (audit ghi sự thật), nhưng `GET /audit-logs` loại mọi lá có khoá cuối thuộc `AUDIT_COST_FIELDS` (`costPrice`, `unitCost`, `giaVonTruoc`, `giaVonSau`) khi người đọc thiếu `costs.view` (resolve tươi mỗi request, cùng luật `stripCostPrice` / phiếu kho) — cấp `audit.read` không được mở cửa sau tới giá vốn. Mặc định không đổi gì với `SUPER_ADMIN` (có cả hai quyền).
  - **Ô ngày mobile (Review 2026-10-30):** chỉ lọc khi ô chứa ngày có thật `YYYY-MM-DD` (hoặc trống); ngày không tồn tại (`2026-02-30`) coi như đang gõ, không gửi. Web: picker `type="date"` bị chặn `min`/`max` theo đầu kia của khoảng.
  - **Ai:** `actorAccountId` null ⇒ "Hệ thống"; account không còn ⇒ `actorDisplayName: null`, client hiện id rút gọn. Tên tra bằng MỘT truy vấn account cho cả trang. **Đối tượng:** nhãn loại + id (UUID rút 8 ký tự, SĐT đủ), không tra tên đối tượng. **Giờ:** `occurredAt`, hiển thị qua `ngayGio()` có sẵn.
  - **Nhãn quyền `audit.read` đổi thành "Xem Audit log"** (không gắn role); không thêm key quyền, không thêm `PERMISSION_REQUIRES`. Mobile: Menu → "Audit log" (`/audit`), Cubit.

### Story 8.6: Báo cáo lợi nhuận gộp — một bảng, bốn cách nhóm (bằng chip)
As a quản lý hoặc kế toán, I want báo cáo lợi nhuận gộp trên vật tư, So that nắm hiệu suất kinh doanh từ nhiều góc độ.
**Acceptance Criteria:**
- **Given** báo cáo lợi nhuận, **When** dựng, **Then** **MỘT bảng duy nhất** với dữ liệu lợi nhuận, **BỐN cách nhóm** chọn bằng chip hoặc tab (KHÔNG dựng bốn màn riêng):
  - Nhóm theo **Đơn** (mỗi hàng một đơn)
  - Nhóm theo **Tháng** (mỗi hàng một tháng)
  - Nhóm theo **Sale** (`assigneeAccountId` — người phụ trách)
  - Nhóm theo **Nguồn khách** (`Order.sourceId`) (§4).
- **Given** bảng báo cáo, **When** render, **Then** có **dòng KPI trên cùng** hiển thị: Doanh thu tổng, Giá vốn tổng, Lợi nhuận gộp tổng, Biên % (dùng component KPI, Story 1.5); dùng Table với số canh phải `.mono` (UX-DR-12, UX-DR-10, §4).
- **Given** dữ liệu lợi nhuận, **When** tính, **Then** công thức: `Lợi nhuận gộp = Σ(unitPriceSnapshot − costPriceSnapshot) × qty` cho mỗi dòng; đơn chưa xuất kho KHÔNG có trong báo cáo (chưa lãi gì); dòng không có giá vốn (công lắp/phí lắp/dòng tự do) → đặt `costPriceSnapshot = unitPriceSnapshot` → lãi dòng = 0 (§4).
- **Given** màn báo cáo, **When** render, **Then** hiển thị **nhãn bắt buộc**: `"Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung."` (§4).
- **Given** quyền xem báo cáo, **When** gate, **Then** gate theo `costs.view` (quyền mới Story 2.9); nếu không có quyền không hiển thị mục báo cáo (§5).

## Epic 9: Thông báo đẩy (lắp bộ gửi phía sau port)
_Firebase mobile (FCM/Crashlytics/Analytics/Remote Config); đăng ký device token; subscribe domain event → resolve người nhận THEO QUYỀN (AD-15/17) + người phụ trách đơn, lọc theo quyền xem → gửi FCM; hộp thư in-app; bật/tắt theo loại; nhắc theo lịch. Lắp sau EventBus port của Epic 2 — không mở lại E4–E7. FR-30,31,32,33,34._

_**Mobile: BLoC từ đầu** (correct-course 2026-10-23, Epic 11). Mọi màn/state mobile mới của Epic 9 (đăng ký/gỡ token gắn vào `SessionCubit`, hộp thư in-app + badge, tuỳ chọn thông báo, mở deep-link) dựng bằng Cubit/Bloc. Cubit nhận port qua constructor từ `main.dart` và là nơi duy nhất gọi port; màn chỉ render state + gửi sự kiện; logic có `bloc_test`. Guard "màn không gọi port" (allowlist rỗng từ 11.4) phủ màn mới. [Source: `sprint-change-proposal-2026-10-23.md` §6]_

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
