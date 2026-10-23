---
baseline_commit: b62c414bba01d5c5c6fe136b7f97d31ab5d85b64
---

# Story 8.1: Dashboard vận hành

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a người có quyền xem dashboard,
I want xem doanh thu theo ngày/tuần/tháng và đếm đơn theo trạng thái,
so that nắm toàn cảnh vận hành bất cứ lúc nào.

## Acceptance Criteria

1. **Mốc thời gian + số liệu.** Given mốc thời gian chọn (Ngày / Tuần / Tháng này — seg control như mockup `s-home`), When xem dashboard, Then hiển thị **doanh thu của kỳ** + **số đơn tạo trong kỳ** + **tổng hợp đơn theo từng Trạng thái** (đủ 10 trạng thái, thứ tự `ORDER_STATUS_KEYS`, trạng thái 0 đơn vẫn có mặt với số 0), dùng component KPI + component chart cột (FR-19, UX-DR-12). Đổi kỳ ⇒ gọi lại backend với kỳ mới.
2. **Gate tiền ở backend, không chỉ ở UI.** Given quyền `dashboard.finance_view`, When gọi `GET /dashboard/summary`, Then CHỈ account có quyền đó nhận `revenue` là số; account thiếu quyền nhận `revenue: null` (backend không gửi con số) và màn **không render** KPI doanh thu (ẩn hẳn, không ô xám/“—”) nhưng vẫn thấy đếm đơn (FR-19, UX-DR-22, AD-4). Quyền resolve **tươi từ DB** mỗi request (khuôn `accountPermissions.listForAccount`), không suy từ JWT.
3. **Đếm đơn theo phạm vi xem đơn.** Given account chỉ có `orders.view_own`, When xem dashboard, Then `newOrderCount` và `ordersByStatus` chỉ đếm đơn người gọi là owner HOẶC assignee — **cùng một mệnh đề phạm vi** với `GET /orders` (không viết lại mệnh đề); `orders.view_all` đếm toàn bộ. Account không có `orders.view_all` lẫn `orders.view_own` ⇒ `newOrderCount: null`, `ordersByStatus: null`, màn ẩn phần đếm đơn (AD-4, AD-15).
4. **Tính ở backend.** Given dữ liệu tổng hợp, When tính, Then mọi tổng/đếm/khoảng ngày tính ở `backend/src/dashboard/`; web/mobile chỉ hiển thị số backend trả (AD-2). Client KHÔNG cộng/trừ/so sánh tiền; chiều cao cột chart chỉ scale theo **số đơn** (không phải tiền).
5. **Đã chốt (G-6, 2026-10-22):** **doanh thu = Σ `Payment.amount` có `paidOn` trong kỳ**, kỳ tính theo giờ Việt Nam (UTC+7): Ngày = hôm nay VN; Tuần = thứ Hai → hôm nay VN; Tháng = ngày 1 → hôm nay VN. Không theo tổng đơn chốt. Response trả kèm `from`/`to` (`YYYY-MM-DD`, bao gồm cả hai đầu) để màn hiển thị kỳ đúng như backend đã tính.
6. **Tiền không tràn INT4.** Given tổng thanh toán trong kỳ vượt 2.147.483.647 đồng, When tính `revenue`, Then trả đúng số (SUM đọc dưới dạng BigInt, đổi sang number ở MỘT điểm), không 500 — có ca lane DB chứng minh.
7. **Hiển thị tiền.** Doanh thu hiển thị qua `<Money>`/`formatVnd` (web) và `formatVnd`/`MoneyText` (Flutter), định dạng `83.010.960 đ` — KHÔNG dùng kiểu rút gọn “1,24 tỷ” của mockup (luật hiển thị tiền 2026-10-21 thắng mockup). Guard tiền design-system (đã vá TD-76, commit `ee25426`) và guard “màn không gọi port” phủ màn mới — chứng minh bằng đột biến trên chính màn mới.
8. **Trang chủ thành màn đáp sau đăng nhập.** Web: mục sidebar `home` (Trang chủ, không cần quyền — đã có trong `SIDEBAR_NAV`) có route `/dashboard`, là `landingPath` cho mọi account. Mobile: tab Trang chủ (index 0, hiện đang không làm gì) mở màn Dashboard, `landingPath` mobile = Trang chủ. Đây là đổi hành vi có chủ đích (trước: đáp ở Đơn hàng/Menu) — ghi vào `epics.md` Story 8.1 trong cùng commit (luật 11).
9. **Parity web ↔ mobile.** Cùng endpoint, cùng nội dung (KPI doanh thu khi có quyền, KPI số đơn mới, chart đơn theo trạng thái, seg control kỳ), trạng thái loading/error/empty dùng component có sẵn (`Skeleton`/`ErrorState`/`EmptyState`). Mobile dựng bằng Cubit (BLoC từ đầu, Epic 8).

## Tasks / Subtasks

- [x] **T0 — Sổ sách trước code** (AC: —)
  - [x] Xác nhận TD-76/I-1 đã trả ở commit `ee25426` (`design-system/lib/money-arithmetic.mjs`), chạy `cd design-system && npm test` xanh, rồi đổi `status: open` → `done` cho hai dòng TD-76 và I-1 trong `sprint-status.yaml` kèm resolution trỏ commit. I-3 im lặng tới commit đầu 8.1 ⇒ mặc định thành quyết định: đổi `done` với resolution “mặc định thành quyết định”.
- [x] **T1 — Domain kỳ thời gian** (AC: #5)
  - [x] `backend/src/dashboard/domain/dashboard-period.ts` (thuần, không Nest/Prisma): `DASHBOARD_PERIODS = ['day','week','month'] as const`, `type DashboardPeriod`, hàm `periodRange(period, now: Date): { from: string; to: string }` trả `YYYY-MM-DD` theo giờ VN — **tái dùng `todayInVietnam`** từ `backend/src/payments/domain/payment.ts`, không viết lại phép +7h. Tuần bắt đầu thứ Hai.
  - [x] Hàm đổi kỳ ngày VN → nửa mở `[fromInstant, toExclusiveInstant)` cho cột `orders.created_at` (timestamptz): `from` 00:00 +07:00 = `from − 1 ngày` 17:00Z; `toExclusive` = `(to + 1 ngày)` 00:00 +07:00.
  - [x] Unit test `backend/test/dashboard-period.spec.ts`: ranh giới 23:30 VN Chủ nhật (= 16:30Z), 00:10 VN thứ Hai (= 17:10Z Chủ nhật), ngày 1 tháng, 31/12 → 01/01, tháng 2 năm nhuận, `now` là thứ Hai (tuần = 1 ngày). Kỳ vọng là chuỗi ngày viết tay theo lịch (đầu vào là mốc giờ), KHÔNG lấy từ chính hàm.
- [x] **T2 — Mệnh đề phạm vi dùng chung** (AC: #3)
  - [x] Trong `OrdersService` (`backend/src/orders/orders.service.ts:1856` `dieuKienPhamVi`, đang `private`): thêm một method public mỏng (vd `scopeWhere(callerAccountId, perms): Prisma.OrderWhereInput[]`) trả CHÍNH mệnh đề đó — không copy điều kiện owner/assignee sang module khác. `OrdersService` đã được export khỏi `OrdersModule`.
- [x] **T3 — Module `dashboard/`** (AC: #1–#6)
  - [x] `backend/src/dashboard/dashboard.module.ts` (import `OrdersModule`, `AccountsModule` hoặc module đang cung cấp `AccountPermissionsService` — xem cách `OrdersController.quyenCuaNguoiGoi` lấy quyền), đăng ký trong `backend/src/app.module.ts`.
  - [x] `dashboard.controller.ts`: `@Get('summary')` dưới `@Controller('dashboard')`, `@RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn, PERM.dashboardFinanceView)` (guard `no-handler-without-require-permissions`), `@CurrentAccount()`, quyền resolve tươi từ DB, `@ApiOkResponse` + operationId tiếng Anh.
  - [x] `dto/dashboard-summary-query.dto.ts`: `period` `@IsOptional() @IsIn(DASHBOARD_PERIODS)`, mặc định `month`.
  - [x] `dto/dashboard-summary-response.dto.ts`: `period`, `from`, `to` (string, `YYYY-MM-DD`), `revenue: number | null` (mô tả PHẢI chứa “đồng” để `money-fields.mjs` nhận là field tiền; `type: 'integer'` + `nullable: true` tường minh — guard `openapi-no-untyped-object`), `newOrderCount: number | null`, `ordersByStatus: DashboardStatusCountDto[] | null` với `{ status, count }`. Mô tả của các field đếm KHÔNG được chứa chữ “đồng” (kể cả “hợp đồng”) — xem gotcha `money-fields /đồng/i`.
  - [x] `dashboard.service.ts`:
    - revenue (chỉ khi có `dashboard.finance_view`): `$queryRaw` `SELECT COALESCE(SUM(amount),0)::bigint FROM payments WHERE paid_on BETWEEN $from::date AND $to::date` → BigInt → `Number(...)` ở một điểm. Revenue KHÔNG thu hẹp theo phạm vi đơn (dashboard tài chính = toàn công ty; ai có quyền tài chính thấy toàn bộ). Ghi rõ trong comment.
    - `newOrderCount` (chỉ khi có quyền đọc đơn): `prisma.order.count({ where: { AND: [createdAt trong khoảng, ...orders.scopeWhere(...)] } })`.
    - `ordersByStatus` (chỉ khi có quyền đọc đơn): `prisma.order.groupBy({ by: ['status'], _count: true, where: { AND: scopeWhere } })` — **ảnh chụp hiện tại, không lọc theo kỳ** (toàn cảnh pipeline; mockup: tổng các cột 58 ≠ “Số đơn/tháng 37”) — rồi điền đủ 10 khoá theo `ORDER_STATUS_KEYS`, thiếu ⇒ 0.
  - [x] Unit `backend/test/dashboard.service.spec.ts` (mock Prisma): thiếu finance ⇒ `revenue` null và **không chạy** query tiền; thiếu quyền đọc đơn ⇒ đếm null và không query order; `view_own` ⇒ `where.AND` chứa đúng mệnh đề `scopeWhere` (assert truyền nguyên mảng, không chỉ “có OR”); 10 khoá đủ + thứ tự.
  - [x] E2E `backend/test/dashboard.e2e.spec.ts` (app thật qua `initAppOnLoopback`, ValidationPipe thật): 400 + `fieldErrors.period` khi `period=year`; 403 khi không có cả 3 quyền; shape response khớp contract (assert tập key là tập con của contract, không exact — gotcha mock rows).
  - [x] DB lane `backend/test/dashboard.db.integration.spec.ts` (Postgres 5433): (a) tổng > INT4 (vd 2 payment mỗi cái gần trần `MAX_INSTALLMENT_AMOUNT`, cộng nhiều đợt) trả đúng; (b) payment `paidOn` ngày hôm qua / đầu tuần / ngày cuối tháng trước rơi đúng kỳ; (c) đơn tạo lúc 23:30 VN ngày D−1 (16:30Z) KHÔNG rơi vào “Ngày” D, đơn 00:10 VN ngày D có; (d) `view_own` không đếm đơn người khác, đếm đơn mình là assignee. Fixture số dẫn xuất: chạy hàm thật in ra, không gõ tay.
  - [x] `cd backend && npm run openapi:gen` → `backend/openapi/openapi.json` (drift-guard).
- [x] **T4 — Component chart cột (design system)** (AC: #1, #9)
  - [x] Web `web/src/design-system/components/BarChart.tsx` + rule `.chart`/`.chart .bar`/`.bar span` trong `components.css` theo mockup (`all-screens.html:154-157`: cao 150px, cột teal bo trên 5px, nhãn 9.5px muted dưới cột). Props: `items: { label: string; value: number }[]`. Không shadow/gradient (guard Viền nét — không viết các chữ đó cả trong comment). Export qua `components/index.ts`.
  - [x] Flutter `mobile/lib/design_system/components/bar_chart.dart` (`AppBarChart`, cùng props, cao 120 như frame phone mockup), export qua `components.dart`. Chỉ dùng `AppTokens` (không màu literal mới).
  - [x] Đọc `design-system/components/parity.test.mjs`, `components.test.mjs`, `data-feedback-components.test.mjs` để biết cách đăng ký component mới vào guard parity/CSS; thêm test component cả hai bên (web vitest, Flutter widget test). Giá trị 0 hết ⇒ cột cao tối thiểu, không chia 0.
- [x] **T5 — Web** (AC: #1–#4, #7–#9)
  - [x] `cd web && npm run api:gen`.
  - [x] Port `web/src/design-system/session/dashboard-port.ts` (type = alias type sinh từ `schema.d.ts`, guard composition-root đòi) + `fake-dashboard-port.ts` (chỉ cho test), export qua `session/index.ts`; adapter `web/src/api/http-dashboard-port.ts` qua client sinh (chỉ `transport.ts` chạm mạng); ráp trong `web/src/main.tsx`.
  - [x] `web/src/app/routes.ts`: `NAV_ROUTES` thêm `home: '/dashboard'` ĐẦU bảng ⇒ `landingPath` = `/dashboard`. Nối route trong `AppRoutes.tsx`. Cập nhật có chủ đích các ca `web/src/test/app-routes.test.tsx` đang coi ‘Trang chủ’ là mục ẩn (`:93`) và đang kỳ vọng đáp ở `/orders`.
  - [x] `web/src/screens/dashboard/DashboardScreen.tsx` (+ css riêng nếu cần, mọi className tĩnh phải có rule CSS thật): topbar “Tổng quan vận hành”, seg Ngày/Tuần/Tháng này, KPI “Doanh thu {kỳ}” (accent, `<Money>`, chỉ khi `revenue !== null`), KPI “Đơn mới {kỳ}”, `Frame` “Đơn theo trạng thái” + `BarChart` (nhãn từ `STATUS_LABELS`), dòng phụ hiển thị kỳ `from`–`to`. Lưới KPI dùng `.kpis` sẵn có.
  - [x] Ca render trong `web/src/test/screens-render.test.tsx` (guard đếm file màn) + test màn: có/không quyền tài chính (không quyền ⇒ không có chữ “Doanh thu” trong DOM), đổi kỳ gọi port với kỳ mới, lỗi port ⇒ `ErrorState` có thử lại.
  - [x] Text-guard design-system cho màn mới: `design-system/screens/dashboard.test.mjs` — tiền qua `Money`/`formatVnd`, cấm số học trên `revenue` (dùng `design-system/lib/money-arithmetic.mjs`), có assert chống-guard-rỗng; đột biến: chèn `revenue * 2`/`String(x.revenue)` vào màn web + cubit mobile ⇒ ĐỎ.
- [x] **T6 — Mobile (Cubit)** (AC: #1–#4, #7–#9)
  - [x] `cd mobile && dart run tool/generate_api.dart`.
  - [x] Port `mobile/lib/design_system/session/dashboard_port.dart` (`typedef DashboardSummary = DashboardSummaryResponseDto;` — guard composition root) + `fake_dashboard_port.dart`; adapter `mobile/lib/api/http_dashboard_port.dart`; thêm `dashboard` vào `AppPorts` (`mobile/lib/app/app_ports.dart`) và ráp trong `main.dart`; thêm `test/api/http_dashboard_port_test.dart`.
  - [x] `mobile/lib/screens/dashboard/dashboard_cubit.dart` + `dashboard_state.dart` (sealed/final + Equatable; state giữ `period` + summary/lỗi) + `dashboard_screen.dart` (chỉ render + gửi sự kiện; cubit qua constructor/`BlocProvider`). Cubit có vé chống trả lời cũ khi đổi kỳ nhanh (bài học TD-75).
  - [x] Router: `kHomePath` trong `app_routes.dart`, `kNavRoutes['home']`, `AppNavLink(key: 'home', label: 'Trang chủ')` vào `kMobileTabLinks` (không requires — khớp web), `landingPath` = `kHomePath`; `signed_in_app.dart` `_selectTab` index 0 ⇒ `kHomePath` (sửa comment “Trang chủ has no screen yet”). Kiểm `design-system/components/menu-nav-parity.test.mjs` vẫn xanh.
  - [x] Tests: `test/screens/dashboard/dashboard_cubit_test.dart` (bloc_test theo checklist project-context: ca đầu / thành công / lỗi port / đóng sớm cả nhánh thành công lẫn lỗi; seed mọi field khác mặc định; kỳ vọng dựng field-by-field bằng constructor; fake trả khác nhau mỗi lần; hai lần đổi kỳ chồng nhau ⇒ chỉ lần mới hiện) + `dashboard_screen_test.dart` (có/không quyền tài chính, chart 10 cột, wiring màn ↔ cubit, tháo màn khi port còn chờ — thêm vào `test/app/unmount_while_port_pending_test.dart` nếu đó là chỗ gom). Cập nhật có chủ đích `test/app/app_routes_test.dart`/`signed_in_app_test.dart` cho landing + tab 0.
- [x] **T7 — Tài liệu + cổng** (AC: #8)
  - [x] `epics.md` Story 8.1: ghi quyết định giữa story (route `/dashboard` + landing Trang chủ; `ordersByStatus` là ảnh chụp không theo kỳ; revenue toàn công ty không theo phạm vi đơn; tuần bắt đầu thứ Hai; bỏ delta “▲ % so kỳ trước” và “Đơn gần đây” khỏi Phase này — xem Dev Notes). Spine: `dashboard/` đã có trong module tree — không cần sửa AD.
  - [x] Chạy đủ 5 lane: `cd backend && npm test && npm run test:db`; `cd design-system && npm test`; `cd web && npm run typecheck && npm test && npm run build`; `cd mobile && flutter analyze && flutter test`. Lint backend đỏ sẵn (nợ prettier) — đo baseline bằng stash, chỉ chịu lỗi mới của file mình.
  - [x] Smoke web (bắt buộc) theo luật (13): backend local cổng riêng + account smoke riêng có SĐT; đăng nhập ⇒ đáp ở `/dashboard`; account có/không `dashboard.finance_view` (thấy/không thấy doanh thu); đổi kỳ; reload giữ phiên; đăng xuất; dọn account + chỉ kill PID mình bật. Smoke emulator Trang chủ (chỉ emulator do mình bật, cold boot `-no-snapshot`), không chạy được thì ghi rõ lý do.

## Dev Notes

### Luật dự án (Trợ Lý, Epic 8) — bắt buộc

- LUẬT DỰ ÁN BẮT BUỘC (Đại Ca chốt): (1) Mọi đường ghi đơn mới phải qua kiểm phạm vi người gọi (scope) giống các đường ghi trong backend/src/orders. (2) Mọi thao tác tồn kho (onHand/reserved/phiếu nhập-xuất/ledger) phải khoá SELECT ... FOR UPDATE trong transaction và có test lane DB (npm run test:db; Postgres local cổng 5433, container pns-postgres; nếu tắt: docker start pns-postgres). KHÔNG ghi lên DB nào khác. (3) Màn web mới: thêm ca vào web screens-render.test.tsx; chạy cd web && npm run typecheck && npm test && npm run build. (4) Mọi màn mobile mới bắt buộc có widget test. (5) Source-guard mới phải có assert chống-guard-rỗng. (6) App e2e dùng initAppOnLoopback (backend/test/util/listen-loopback.ts). (7) KHÔNG git push; git add đường dẫn cụ thể, không dùng -A; package-lock.json phải git add -f. Đọc _bmad-output/project-context.md trước khi code.
- (8) NGÔN NGỮ: mọi thứ thuộc code viết tiếng Anh (tên biến/hàm/class/file, comment, docstring, tên test, log, commit message); CHỈ chuỗi hiển thị cho người dùng (UI, thông báo lỗi trả client) dùng tiếng Việt. Contract API MỚI (route, field DTO, method port) cũng tiếng Anh. Không đổi tên hàng loạt symbol tiếng Việt có sẵn.
- (11) QUYẾT ĐỊNH GIỮA STORY: mọi mặc định/quyết định tuyên bố trong lúc làm story mà đổi hành vi hay contract phải cập nhật epics.md (story đó) và spine (nếu đụng AD) TRONG CÙNG commit story. (12) EPIC 10 NỐI DÂY: theo sprint-change-proposal-2026-10-22.md (§4.2 bảng đổi tên, §6 mặc định); đổi route/field cứng, không alias; giữ mã enum nghiệp vụ và tên cột DB; chỉ tầng transport gọi mạng, fake không import vào composition root; dependency mới phải ghi trong package.json/pubspec và lockfile (package-lock.json git add -f); KHÔNG gọi backend/dịch vụ nào ngoài localhost; smoke đầu-cuối chạy trên backend local (node dist/main + Postgres 5433), tắt tiến trình mình bật.
- (13) SMOKE ĐĂNG NHẬP THẬT: backend/.env thiếu JWT_ACCESS_SECRET hợp lệ và mật khẩu seed nằm trong .env (KHÔNG đọc .env). Chạy backend smoke bằng biến môi trường tạm ghi đè ngay trên lệnh (JWT_ACCESS_SECRET ngẫu nhiên ≥32 ký tự), không sửa .env. Tạo một account smoke RIÊNG (vd smoke-<story>@local.test, mật khẩu ngẫu nhiên, preset quyền cần thiết) thẳng vào Postgres local 5433 bằng script Prisma, băm mật khẩu đúng thuật toán backend đang dùng, có SĐT (đăng nhập bằng SĐT từ 10.9); KHÔNG đổi account có sẵn; xoá/vô hiệu hoá account smoke khi xong. Smoke đủ: đăng nhập thành công, reload giữ phiên, đăng xuất + luồng chính của story.
- (9) TIỀN (Epic 7): tiền là số nguyên đồng (không float); Payment ghi idempotent dưới khoá dòng đơn (SELECT id FROM orders ... FOR UPDATE là op đầu tiên), có ca DB interleaving theo CONVENTIONS mục Khoá dòng; Payment + chuyển trạng thái tự động cùng một tx, transition bị chặn 409 thì Payment VẪN ghi, transition bỏ qua + log + event, không rollback tiền. Hiển thị tiền dùng formatter/Money component có sẵn (83.010.960 đ).
- (17) DỌN TIẾN TRÌNH: CHỈ kill đúng PID mình bật (ghi PID lúc khởi động); CẤM pkill/killall theo mẫu tên; CẤM gửi lệnh tắt tới emulator/thiết bị không do mình bật (adb -s <serial của mình>); backend smoke chạy cổng riêng, không đụng tiến trình/container của dự án khác.
- (18) EPIC 8 BLoC + GUARD: mọi màn mobile mới dựng bằng Cubit (port qua constructor từ main.dart, chỉ cubit gọi port), có bloc_test theo checklist project-context mục Testing (seed mọi field khác mặc định, kỳ vọng field-by-field không qua copyWith, fake trả khác nhau mỗi lần, đóng sớm cả nhánh lỗi, ca tháo màn + wiring). Guard "màn không gọi port" (allowlist rỗng) và guard tiền phải phủ màn mới — chứng minh bằng đột biến trên màn mới. Smoke web bắt buộc; smoke emulator cho màn mobile mới (chỉ emulator do mình bật, tắt đúng serial đó), không chạy được thì ghi rõ vì sao.
- (19) QUYỀN (8.2–8.5): key quyền chỉ từ registry; thêm key thì sinh lại cả PERM web lẫn AppPermissionKeys mobile (npm run permissions:gen) và chạy lane design-system + mobile; giữ luật không-leo-thang (2.10); gate theo QUYỀN không theo role; xử lý tổ hợp TD-65 (ghi chú trong epics.md 8.2/8.4). (20) SỐ LIỆU (8.1, 8.6): tính ở backend; doanh thu = Σ Payment.amount theo paidOn (UTC+7); lợi nhuận theo công thức epics 8.6; fixture số dẫn xuất KHÔNG gõ tay — chạy hàm thật in ra; có ca DB cho truy vấn tổng hợp.


### Quyết định phạm vi (đọc trước khi code)

- **Một endpoint, một kỳ:** `GET /dashboard/summary?period=day|week|month` (mặc định `month`). Không có series theo ngày, không delta so kỳ trước, không “Đơn gần đây”. Lý do: AC chỉ đòi doanh thu theo kỳ + đếm đơn + theo trạng thái; delta “▲ 18%” là phép tính trên tiền (phải ở backend) và không có AC; “Đơn gần đây” đã có ở màn Đơn hàng (`GET /orders`). YAGNI — ghi vào `epics.md` để Đại Ca thấy; nếu muốn thêm thì là story/thay đổi riêng.
- **Mockup vs luật tiền:** mockup ghi “1,24 tỷ”, “312 tr”. Luật hiển thị tiền (Đại Ca chốt 2026-10-21) bắt buộc `formatVnd` đầy đủ ⇒ `1.240.000.000 đ`. KPI web có `mono`; mobile `AppKpi.value` là `String` ⇒ truyền `formatVnd(summary.revenue!)` sau khi đã kiểm null ở chỗ quyết định render.
- **`paidOn` là cột DATE** (`schema.prisma:709`, Prisma trả UTC midnight; `payment-schedules.service.ts:106-111` đọc phần ngày bằng `toISOString().slice(0,10)`). Ngày đã là ngày VN do người ghi nhập (`isFutureDate` so với `todayInVietnam`) ⇒ lọc `BETWEEN from AND to` trên chuỗi ngày là đúng, KHÔNG dịch +7h lần nữa cho payments. Chỉ `orders.created_at` (timestamptz) mới cần đổi khoảng ngày VN → instant UTC.
- **Gate:** endpoint mở cho ai có ít nhất một trong `orders.view_all`, `orders.view_own`, `dashboard.finance_view`; mỗi khối số liệu tự null theo quyền của nó. Mọi preset hiện có đều có `orders.view_all` hoặc `orders.view_own` (`role-presets.ts`), nên ai cũng thấy đếm đơn; Thợ KS/Thi công/Kho không có `dashboard.finance_view` ⇒ không thấy tiền (EXPERIENCE.md:148, :185). Sidebar `home` không có `requires` ⇒ account hiếm hoi thiếu cả ba quyền sẽ thấy màn lỗi 403 — xử lý: màn hiển thị `EmptyState` “Không có số liệu cho tài khoản này” khi port trả 403 (không văng ErrorState thử lại vô hạn). Ghi một ca test.
- **Permission key:** `PERM.dashboardFinanceView = 'dashboard.finance_view'` đã có trong registry (`backend/src/accounts/domain/permission-registry.ts`), web `PERM.dashboardFinanceView` (`web/src/design-system/gating/permissions.ts:114`) và mobile `AppPermissionKeys` (sinh). **Không thêm key mới** ⇒ không cần `permissions:gen`. Mobile màn dùng `AppPermissionKeys.x`, không `AppPerm.x` (ghost-key guard).
- Màn KHÔNG tự kiểm quyền tài chính để quyết hiện doanh thu — nó dựa vào `revenue !== null` từ backend (một nguồn sự thật). Gate nav vẫn từ `/me` như các màn khác.

### Trạng thái hiện tại các file sẽ sửa (đã đọc)

- `web/src/app/routes.ts`: `NAV_ROUTES` = orders, customers, inventory, warranty, settings, profile; `landingPath` = route mở được đầu tiên theo thứ tự sidebar ⇒ thêm `home` đầu bảng làm mọi account đáp ở `/dashboard` (home không gate). Giữ: gate route dùng `filterNav(SIDEBAR_NAV)`, không bảng quyền thứ hai.
- `web/src/design-system/shell/Sidebar.tsx:78`: `{ key: 'home', icon: 'ic-home', label: 'Trang chủ' }` đã có, đang bị ẩn vì `AVAILABLE_NAV_KEYS` không có `home`. Không sửa `SIDEBAR_NAV`.
- `mobile/lib/app/app_routes.dart`: `kNavRoutes` không có home; `landingPath` = orders hoặc Menu; `openableKeys` gộp `kMobileMenu` + `kMobileTabLinks`.
- `mobile/lib/app/signed_in_app.dart:272-290` `_selectTab`: index 0 ⇒ `null` (không làm gì). Giữ: `_ordersReload`/`_inventoryReload` khi bấm tab Đơn hàng/Kho; nếu Dashboard cần đọc lại khi bấm lại tab Trang chủ thì làm cùng khuôn `reloadSignal` (KHÔNG `router.refresh()`).
- `mobile/lib/design_system/shell/app_bottom_nav.dart`: 5 tab KHOÁ CỨNG (UX-DR-15) — không sửa danh sách tab.
- `backend/src/orders/orders.service.ts:1830-1867`: `findScopedOrThrow` + `dieuKienPhamVi` (private). Chỉ thêm method public bọc lại; không đổi hành vi đường đọc/ghi đơn hiện có. Guard `no-unscoped-order-write` chỉ canh đường ghi — dashboard chỉ đọc.
- Components có sẵn: web `Kpi` (`label`, `value: ReactNode`, `delta?`, `accent?`, `mono?`), `Money`, `formatVnd`, `StatusChip`/`STATUS_LABELS`, `Frame`, `Skeleton`, `ErrorState`, `EmptyState`; Flutter `AppKpi` (`value: String`), `MoneyText`, `kStatusLabels` (`status_chip.dart:45`). **Chưa có chart** ở cả hai nền tảng ⇒ T4 dựng mới (AD-13: component trước màn).

### Kiến trúc phải tuân

- AD-1/AD-2: client chỉ hiển thị. AD-4: backend enforce (revenue null từ server). AD-10: tiền integer đồng; SUM có thể vượt INT4 ⇒ BigInt rồi đổi một điểm (cùng khuôn tổng hoá đơn Epic 7). AD-12: OpenAPI sinh từ code, regen web + mobile cùng commit. AD-13: component chart vào design system trước. AD-17: chỉ `PERM.x`/`AppPermissionKeys.x`.
- Contract mới tiếng Anh: route `dashboard/summary`, field `period/from/to/revenue/newOrderCount/ordersByStatus/status/count`, method port `getSummary(period)` (guard `no-vietnamese-api-contract`). Câu hiển thị/lỗi tiếng Việt.
- Lỗi validate qua `createValidationPipe` (câu tiếng Việt từ `BUILT_IN_MESSAGES`; `isIn` đã có trong bảng: “Giá trị không nằm trong danh sách cho phép.” — `validation-pipe.factory.ts:79`).
- `AccountPermissionsService` export từ `AccountsModule` (`backend/src/accounts/accounts.module.ts:13`). `MAX_INSTALLMENT_AMOUNT = 2_000_000_000` (`payments/domain/payment-schedule.ts:28`) ⇒ hai payment ở trần đã vượt INT4 cho ca DB (a).
- Không publish domain event (chỉ đọc), không audit.

### Testing — bẫy đã biết (memory dự án)

- Fixture số dẫn xuất gõ tay che lỗi công thức ⇒ in từ hàm thật.
- `money-fields.mjs` dùng `/đồng/i` trên description ⇒ field đếm không được có “hợp đồng/đồng”; field `revenue` PHẢI có “đồng” (vd “Tổng tiền đã thu trong kỳ — số nguyên đồng”), và kiểm `moneyFields()` có `revenue` sau khi regen.
- Text-guard đọc màn mobile phải qua `readMobileScreen` (đọc cả `dashboard_cubit.dart`/`dashboard_state.dart`).
- Đột biến: backup bằng `cp`, khôi phục `cp`+`cmp`, KHÔNG `git checkout`; không pipe lệnh mutant; grep chuỗi đã chèn trước khi tin “sống”; mutant phải compile.
- Đột biến bắt buộc cho story này: bỏ `...scopeWhere` ở count/groupBy ⇒ ca DB (d) + unit ĐỎ; bỏ gate finance (luôn tính revenue) ⇒ unit + e2e ĐỎ; đổi `::bigint` thành bỏ cast/đọc number ⇒ ca DB (a) ĐỎ; đổi đầu tuần thành Chủ nhật ⇒ unit T1 ĐỎ; bỏ `+1 ngày` ở `toExclusive` ⇒ ca DB (c) ĐỎ.
- Web vitest: Node 24 `localStorage` che jsdom — dùng `memoryStorage()` như các test sẵn có.
- Cubit: `Equatable` bỏ state trùng ⇒ fake trả khác nhau mỗi lần; một `pump()` sau tín hiệu Listenable có thể không đủ dưới BLoC.
- Smoke: dọn chỉ PID/serial của mình; `uiautomator dump` xoá `/sdcard/ui.xml` trước mỗi lần; DB lane xoá sạch `pns-postgres` ⇒ seed smoke bằng SQL sau `test:db`.

### Project Structure Notes

- Mới: `backend/src/dashboard/{dashboard.module.ts,dashboard.controller.ts,dashboard.service.ts,domain/dashboard-period.ts,dto/*.ts}`; `backend/test/dashboard*.spec.ts`; `web/src/screens/dashboard/DashboardScreen.tsx`; `web/src/design-system/components/BarChart.tsx`; `web/src/design-system/session/{dashboard-port.ts,fake-dashboard-port.ts}`; `web/src/api/http-dashboard-port.ts`; `mobile/lib/screens/dashboard/{dashboard_screen,dashboard_cubit,dashboard_state}.dart`; `mobile/lib/design_system/components/bar_chart.dart`; `mobile/lib/design_system/session/{dashboard_port,fake_dashboard_port}.dart`; `mobile/lib/api/http_dashboard_port.dart`; `design-system/screens/dashboard.test.mjs`.
- Sửa: `backend/src/app.module.ts`, `backend/src/orders/orders.service.ts` (method public), `backend/openapi/openapi.json` (sinh), `web/src/api/generated/schema.d.ts` (sinh), `mobile/lib/api/generated/**` (sinh), `web/src/main.tsx`, `web/src/app/routes.ts`, `web/src/app/AppRoutes.tsx`, `web/src/design-system/components/{index.ts,components.css}`, `web/src/design-system/session/index.ts`, `web/src/test/{screens-render,app-routes}.test.tsx`, `mobile/lib/main.dart`, `mobile/lib/app/{app_ports,app_routes,signed_in_app}.dart`, `mobile/lib/design_system/shell/app_menu_nav.dart`, `mobile/lib/design_system/components/components.dart`, `epics.md`, `sprint-status.yaml`.
- File code tên tiếng Anh, kebab-case (TS) / snake_case (Dart). File mới gitignore? `git check-ignore` mọi file mới trước khi add (gotcha `.git/info/exclude`, `assets/`). `git add` đường dẫn cụ thể; không push.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1: Dashboard vận hành] — AC gốc + G-6
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8] — “Mobile: BLoC từ đầu”
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#Backend module tree] — `dashboard/` (dòng 537), Capability map FR-19 → `dashboard/`, AD-4 (dòng 557)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-home] — dòng 591-790 (web + phone), CSS `.kpis/.kpi/.chart` dòng 146-157, 313
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md] — dòng 29 (màn `s-home`), 53 (điều hướng), 148/185 (ai không thấy dashboard tài chính)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md] — KPI dòng 241, lưới KPI 4→2 dòng 205-207
- [Source: _bmad-output/story-automator/extra-instructions-8-review.txt] — luật (3)(4)(5)(6)(7)(8)(11)(13)(17)(18)(20)
- [Source: _bmad-output/implementation-artifacts/epic-11-retro-2026-10-23.md#6, #8] — lô chuẩn bị I-1/I-3, checklist cubit
- [Source: _bmad-output/project-context.md] — mục Testing, Critical Don't-Miss (hiển thị tiền, Epic 7 BigInt)
- [Source: backend/src/payments/domain/payment.ts:81] — `todayInVietnam`
- [Source: backend/src/orders/domain/order-status.ts] — `ORDER_STATUS_KEYS`

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- Lane cuối (2026-10-23): backend `npm test` 126 suite / 2573 test xanh; `npm run test:db` 28 suite / 330 test xanh; design-system 524/524; web typecheck 0 lỗi, vitest 40 file / 458 test, build OK; mobile `flutter analyze` sạch, `flutter test` 1352 xanh.
- Lint backend: `eslint` + `prettier` trên mọi file backend em chạm (src/dashboard, test/dashboard*, orders.service.ts, app.module.ts) sạch; nợ prettier có sẵn của repo không đổi (không chạy `npm run lint` toàn repo).
- Đột biến backend (cp backup, cmp khôi phục): bỏ scope ở `count` ⇒ unit + DB ĐỎ; bỏ scope ở `groupBy` ⇒ unit + DB ĐỎ; bỏ gate tài chính ⇒ unit (`without dashboard.finance_view`) + e2e (`THI_CONG`) ĐỎ; `::bigint` → `::int` ⇒ DB (a) ĐỎ (`integer out of range`); bỏ hẳn cast ⇒ SỐNG — mutant tương đương (Postgres `SUM(integer)` vốn trả `bigint`); đầu tuần Chủ nhật ⇒ unit T1 ĐỎ (5 ca); bỏ `+1 ngày` ở `toExclusive` ⇒ unit + DB (c) ĐỎ.
- Đột biến frontend: web `revenue * 2` / `String(summary.revenue)` ⇒ design-system ĐỎ; web bỏ `revenue !== null` ⇒ guard + vitest ĐỎ; web bỏ vé ⇒ vitest ĐỎ; cubit chèn `(state.summary?.revenue ?? 0) * 2` / `'${state.summary?.revenue}'` ⇒ design-system ĐỎ; màn mobile gọi `widget.port.getSummary` ⇒ `no_port_call_in_screens_test` ĐỎ; cubit bỏ vé (nhánh thành công / nhánh lỗi), bỏ `isClosed` nhánh lỗi, giữ kỳ cũ khi loading, bỏ summary lúc loading/lỗi, ready dùng kỳ cố định, bỏ cờ forbidden ⇒ bloc_test ĐỎ; màn mobile bỏ `revenue != null` ⇒ widget test ĐỎ. Bỏ `isClosed` ở nhánh thành công ⇒ SỐNG — mutant tương đương đã biết (emit sau close ném trong `try`, `catch` kiểm `isClosed` rồi return).
- Đột biến guard component: xoá rule `.chart*` ⇒ design-system ĐỎ; dời `bar_chart.dart` ⇒ parity ĐỎ.
- Smoke web (backend local cổng 3181 PID 70361 với JWT secret tạm, vite 5181 PID 70709, 2 account smoke có SĐT, argon2id): đăng nhập ⇒ đáp `/dashboard`; Kế toán thấy `83.010.960 đ` + 2 đơn + chart 10 cột; Tuần = 19/10–23/10 (thứ Hai); reload giữ phiên; đăng xuất về `/login`; Thi công không có KPI doanh thu, đếm 1 đơn (được giao); `curl` xác nhận body `revenue: null`, `period=year` ⇒ 400. Tắt đúng 2 PID, xoá account/dữ liệu smoke.
- Smoke emulator: `Pixel_9_Pro` cold boot `-no-snapshot` serial `emulator-5584` (do em bật, không thiết bị nào khác đang chạy), APK debug `API_BASE_URL=http://10.0.2.2:3181`: đáp Trang chủ, Kế toán thấy `83.010.960 đ`, đổi Tuần ra 19/10–23/10, tab Đơn hàng ↔ Trang chủ chạy, đăng xuất qua Menu, Thi công không có DOANH THU, mở lại app giữ phiên. Gỡ app, `adb -s emulator-5584 emu kill`, tắt backend PID 76203, dọn dữ liệu.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- T0: TD-76/I-1 xác nhận trả ở `ee25426` + `b62c414` (design-system 515/515 lúc đầu story) ⇒ `done`; I-3 mặc định thành quyết định ⇒ `done`.
- Backend: `GET /dashboard/summary?period=day|week|month` trong module mới `dashboard/`. Kỳ tính theo ngày VN (tái dùng `todayInVietnam`), tuần từ thứ Hai; `orders.created_at` lọc nửa mở `[00:00+07, ngày sau 00:00+07)`; `payments.paid_on` (DATE) lọc thẳng chuỗi ngày. Revenue = `SUM(amount)::bigint` → `Number` một điểm, chỉ chạy khi có `dashboard.finance_view`, toàn công ty. Đếm đơn dùng `OrdersService.scopeWhere` (method public mỏng bọc CHÍNH `dieuKienPhamVi`). `ordersByStatus` ảnh chụp đủ 10 trạng thái. Quyền resolve tươi mỗi request.
- Design system: `BarChart` (web) / `AppBarChart` (Flutter) — cột scale theo SỐ ĐẾM, số trên cột, nhãn dưới cột (nhãn neo `top` để chữ dài xuống dòng không đè cột), toàn 0 ⇒ cột tối thiểu 2%, không chia 0. Đăng ký vào guard parity/CSS/barrel.
- Web: port + fake + adapter + ráp `main.tsx`; route `home: '/dashboard'` ⇒ landing mọi account; màn `DashboardScreen` (Seg kỳ, KPI doanh thu chỉ khi `revenue !== null`, KPI đơn mới, Frame + BarChart, dòng kỳ `from – to`, vé chống trả lời cũ, 403 ⇒ EmptyState không thử lại).
- Mobile: port (typedef type sinh) + fake + adapter (403 ⇒ `forbidden`) + `AppPorts`/`main.dart`; `DashboardCubit` (vé, isClosed) + `DashboardState` (final + Equatable, giữ period/status/summary) + `DashboardScreen` (chỉ render + gửi sự kiện, `reloadSignal` khi bấm lại tab). Router: `kHomePath = '/dashboard'`, tab `home` không gate, `landingPath` = Trang chủ, `_selectTab(0)` mở Dashboard.
- Đổi hành vi có chủ đích (AC #8): mọi đường bị gate/không tồn tại giờ đáp `/dashboard` thay vì Đơn hàng/Menu/Hồ sơ ⇒ đã cập nhật có chủ đích các ca `app-routes.test.tsx`, `app-entry.test.tsx`, `composition-root.test.ts` (15 adapter), `app_routes_test.dart`, `pns_app_test.dart`, `signed_in_app_test.dart`, `order_routes_test.dart` (helper vào tab Đơn hàng sau khi đáp Trang chủ), `menu-nav-parity.test.mjs` (tab `home`).
- Lệch nhỏ so với mockup/story, ghi trong `epics.md`: mobile chọn kỳ bằng `AppTabs` (chưa có seg control Flutter; nhãn trùng web); số đếm hiện trên cột còn nhãn trạng thái dưới cột (10 trạng thái trên màn điện thoại không đủ chỗ cho "nhãn · số"); bỏ delta "▲ %" và "Đơn gần đây".
- Guard mới `design-system/screens/dashboard.test.mjs`: nhãn chung hai nền tảng, tiền chỉ qua Money/formatVnd và chỉ khi khác null, cột chart = `s.count`, cấm số học/in thô/locale/`finance_view` trên màn + cubit + state (thêm ban `~/` Dart vì helper chung không có), ca sanity bắt đúng mẫu và cho qua mẫu hợp lệ, chống-guard-rỗng.
- Ghi chú: em đã xoá `backend/dist` (output build do em tạo cho smoke, gitignore). Chưa commit/push.

### File List

**Mới**

- backend/src/dashboard/dashboard.controller.ts
- backend/src/dashboard/dashboard.module.ts
- backend/src/dashboard/dashboard.service.ts
- backend/src/dashboard/domain/dashboard-period.ts
- backend/src/dashboard/dto/dashboard-status-count.dto.ts
- backend/src/dashboard/dto/dashboard-summary-query.dto.ts
- backend/src/dashboard/dto/dashboard-summary-response.dto.ts
- backend/test/dashboard-period.spec.ts
- backend/test/dashboard.db.integration.spec.ts
- backend/test/dashboard.e2e.spec.ts
- backend/test/dashboard.service.spec.ts
- design-system/screens/dashboard.test.mjs
- mobile/lib/api/generated/dashboard/dashboard_client.dart
- mobile/lib/api/generated/dashboard/dashboard_client.g.dart
- mobile/lib/api/generated/models/dashboard_status_count_dto.dart
- mobile/lib/api/generated/models/dashboard_status_count_dto.g.dart
- mobile/lib/api/generated/models/dashboard_status_count_dto_status.dart
- mobile/lib/api/generated/models/dashboard_summary_response_dto.dart
- mobile/lib/api/generated/models/dashboard_summary_response_dto.g.dart
- mobile/lib/api/generated/models/dashboard_summary_response_dto_period.dart
- mobile/lib/api/generated/models/period.dart
- mobile/lib/api/http_dashboard_port.dart
- mobile/lib/design_system/components/bar_chart.dart
- mobile/lib/design_system/session/dashboard_port.dart
- mobile/lib/design_system/session/fake_dashboard_port.dart
- mobile/lib/screens/dashboard/dashboard_cubit.dart
- mobile/lib/screens/dashboard/dashboard_screen.dart
- mobile/lib/screens/dashboard/dashboard_state.dart
- mobile/test/api/http_dashboard_port_test.dart
- mobile/test/screens/dashboard/dashboard_cubit_test.dart
- mobile/test/screens/dashboard/dashboard_screen_test.dart
- web/src/api/http-dashboard-port.ts
- web/src/design-system/components/BarChart.tsx
- web/src/design-system/session/dashboard-port.ts
- web/src/design-system/session/fake-dashboard-port.ts
- web/src/screens/dashboard/DashboardScreen.tsx
- web/src/screens/dashboard/dashboard.css
- web/src/test/bar-chart.test.tsx
- web/src/test/dashboard-screen.test.tsx
- web/src/test/http-dashboard-port.test.ts

**Sửa**

- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/planning-artifacts/epics.md
- backend/openapi/openapi.json
- backend/src/app.module.ts
- backend/src/orders/orders.service.ts
- design-system/components/components.test.mjs
- design-system/components/data-feedback-components.test.mjs
- design-system/components/menu-nav-parity.test.mjs
- design-system/components/parity.test.mjs
- mobile/lib/api/generated/export.dart
- mobile/lib/api/generated/pns_api_client.dart
- mobile/lib/app/app_ports.dart
- mobile/lib/app/app_routes.dart
- mobile/lib/app/signed_in_app.dart
- mobile/lib/design_system/components/components.dart
- mobile/lib/design_system/shell/app_menu_nav.dart
- mobile/lib/main.dart
- mobile/test/app/app_routes_test.dart
- mobile/test/app/order_routes_test.dart
- mobile/test/app/pns_app_test.dart
- mobile/test/app/signed_in_app_test.dart
- mobile/test/app/support/app_harness.dart
- mobile/test/design_system/components/components_render_test.dart
- web/src/api/generated/schema.d.ts
- web/src/app/AppRoutes.tsx
- web/src/app/routes.ts
- web/src/design-system/components/components.css
- web/src/design-system/components/index.ts
- web/src/design-system/session/index.ts
- web/src/main.tsx
- web/src/test/app-entry.test.tsx
- web/src/test/app-routes.test.tsx
- web/src/test/composition-root.test.ts
- web/src/test/screens-render.test.tsx

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI review qua `/ck:code-review` + bmad-story-automator-review) — 2026-10-23
**Kết quả:** Approve sau khi sửa. 0 CRITICAL, 0 HIGH, 1 MEDIUM, 2 LOW — đã sửa hết.

### Đối chiếu
- AC #1–#9: IMPLEMENTED (đọc code + test từng AC). Mọi task [x] có bằng chứng trong code. File List khớp git (ngoài `.githooks/` và 2 file `.xlsx` trong `docs/` — không thuộc story, không đụng).
- Luật (1) đường ghi đơn: story chỉ ĐỌC đơn — không có đường ghi mới. Luật (2) tồn kho/FOR UPDATE: không có thao tác tồn kho ⇒ không áp dụng.
- Đột biến tự chạy lại (cp backup, khôi phục + `cmp`): bỏ scope ở `count` ⇒ unit + DB ĐỎ; bỏ scope ở `groupBy` ⇒ unit + DB ĐỎ; `scopeWhere` trả `[]` ⇒ DB ĐỎ; bỏ nhánh assignee của `dieuKienPhamVi` ⇒ DB ĐỎ (6 ca); bỏ gate tài chính ⇒ unit + e2e ĐỎ; bỏ `+1 ngày` ở `toExclusive` ⇒ unit + DB ĐỎ; màn mobile gọi `widget.port.getSummary` ⇒ `no_port_call_in_screens_test` ĐỎ; web `Number(revenue).toFixed`, mobile `revenue!.toString()` ⇒ design-system ĐỎ.
- Kiểm thực nghiệm: `orders.created_at` là `TIMESTAMP(3)` (không múi giờ); probe trong tx đặt `SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'` cho thấy Prisma tự điền `now()` theo UTC ⇒ phép lọc nửa mở giờ VN của dashboard đúng bất kể múi giờ session DB.

### Findings (đã sửa)
1. **[MEDIUM] AC #3 chỉ đúng nhờ hai bản sao trùng nhau.** `OrdersService.list()` (`GET /orders`) tự chép mệnh đề owner/assignee thay vì gọi `dieuKienPhamVi`, nên comment của `scopeWhere` (“count không thể lệch khỏi GET /orders”) sai — sửa một bên thì bên kia lệch mà không test nào báo. Sửa: `list()` dựng `dieuKien` từ `this.dieuKienPhamVi(...)` (hành vi y hệt). Chứng minh: một đột biến trên `dieuKienPhamVi` giờ làm ĐỎ cùng lúc `orders-list-scope.spec` (2), `orders-list.db` và `dashboard.db`. [backend/src/orders/orders.service.ts `list()`]
2. **[LOW] Guard `dashboard.test.mjs` mù với tổng không kiểu.** Ban “summing figures” chỉ bắt `.fold<`; chèn `.fold(0, (int a, s) => a + s.count)` vào `dashboard_cubit.dart` ⇒ 524/524 vẫn xanh. Sửa: regex `\.reduce\s*\(|\.fold\s*[<(]|\.sum\b` + 3 mẫu sanity (`fold(0, …)`, `.sum`, `reduce`). Đột biến lại ⇒ ĐỎ. [design-system/screens/dashboard.test.mjs]
3. **[LOW] Comment sai kiểu cột.** `dashboard-period.ts`, `dashboard-period.spec.ts`, `dashboard.db.integration.spec.ts` ghi `orders.created_at` là `timestamptz`; migration là `TIMESTAMP(3)` giữ UTC. Sửa comment/tên describe cho đúng.

### Ghi nhận, không sửa (ngoài phạm vi)
- `OrdersService.lookupByPhone` (tra cứu bảo hành) vẫn chép tay mệnh đề phạm vi — có từ trước, không thuộc AC 8.1; nên gom về `dieuKienPhamVi` trong một thay đổi riêng.
- `payments.paid_on` / `orders.created_at` chưa có index; dashboard giờ là màn đáp của mọi account. Với khối lượng Phase 1 chưa đáng một migration — theo dõi khi dữ liệu lớn.

### Lane sau khi sửa
- backend `npm test` 126 suite / 2574 xanh; `npm run test:db` 28 suite / 330 xanh; `tsc --noEmit` sạch; eslint + prettier sạch trên file đụng tới.
- design-system 524/524; web typecheck 0 lỗi, vitest 40 file / 460, build OK; mobile `flutter analyze` sạch, `flutter test` 1354 xanh.
- Không chạy lại smoke: phần sửa không đổi UI/contract (refactor tương đương ở backend + guard + comment), đã phủ bằng lane unit/DB.

## Change Log

- 2026-10-23: Dev Story 8.1 — dashboard vận hành backend `/dashboard/summary` + chart design system + màn web/mobile (Cubit) + Trang chủ thành màn đáp sau đăng nhập; quyết định giữa story ghi vào `epics.md`; TD-76/I-1/I-3 đóng. Status → review.
- 2026-10-23: Code review (AI) — 3 finding (1 MEDIUM, 2 LOW) đã sửa: `GET /orders` dùng chung `dieuKienPhamVi`, guard tổng của dashboard bắt `fold(`/`.sum`, comment kiểu cột `created_at`. Status → done.
