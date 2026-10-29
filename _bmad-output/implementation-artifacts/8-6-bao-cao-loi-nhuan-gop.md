---
baseline_commit: dfd78e1c93153348c951e26600ae9fde2202c45a
---

# Story 8.6: Báo cáo lợi nhuận gộp — một bảng, bốn cách nhóm (bằng chip)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a quản lý hoặc kế toán (account có quyền `costs.view`),
I want báo cáo lợi nhuận gộp trên vật tư,
so that nắm hiệu suất kinh doanh từ nhiều góc độ.

## Acceptance Criteria

1. **Một endpoint, một bảng, bốn cách nhóm (FR-37, §4):** `GET /reports/profit?groupBy=order|month|assignee|source&period=month|year|custom&from&to` trả `{ groupBy, from, to, totals, rows }`. `groupBy` mặc định `order`. Web + mobile là **MỘT màn** với hàng chip/seg chọn cách nhóm — KHÔNG dựng bốn màn/route:
   - `order` — mỗi hàng một đơn (số đơn `BG-XXXXXXXX` qua `quoteNumberOf`, tên khách, tên người phụ trách, tên nguồn, ngày xuất kho).
   - `month` — mỗi hàng một tháng (giờ VN) của **ngày xuất kho**.
   - `assignee` — mỗi hàng một `Order.assigneeAccountId` (tên hiển thị); đơn chưa giao gom một hàng `key: null`, nhãn "Chưa giao người phụ trách".
   - `source` — mỗi hàng một `Order.sourceId` (tên nguồn khách, kể cả nguồn đã `active: false`).
2. **Công thức (FR-37, AD-20):** mỗi đơn: `revenue = Σ(unitPriceSnapshot × qty) − discountAmount` (chiết khấu đã duyệt snapshot trên version, `null` ⇒ 0; TRƯỚC VAT), `cost = Σ(costPriceSnapshot × qty)`, `grossProfit = revenue − cost`. Không chiết khấu ⇒ đúng nguyên văn `Σ(unitPriceSnapshot − costPriceSnapshot) × qty`. Dòng không có giá vốn đã có `costPriceSnapshot = unitPriceSnapshot` từ lúc xuất (`lineCostSnapshot`) ⇒ lãi dòng 0, công thức không nhánh `if`. Hàng nhóm + `totals` = tổng cộng các đơn của nhóm; `marginPct` = `round_half_up(grossProfit × 100 / revenue)` số nguyên, `null` khi `revenue ≤ 0`. Mọi phép tính ở backend; client chỉ hiển thị (AD-2).
3. **Chỉ đơn đã xuất kho (FR-37, AD-20):** đơn có mặt KHI VÀ CHỈ KHI có phiếu xuất (`stock_vouchers.type = 'xuat'`, `order_id` không null) và không ở trạng thái `huy`. Dòng tính là dòng của **version gắn với phiếu xuất** (`stock_vouchers.order_version_id`). Đơn đã chốt chưa xuất, đơn chỉ có công lắp/dòng tự do (không bao giờ có phiếu xuất), đơn huỷ sau xuất ⇒ KHÔNG có trong báo cáo. Kỳ lọc trên ngày xuất (`stock_vouchers.created_at`, giờ VN).
4. **Kỳ:** `period=month` (mặc định) = ngày 1 → hôm nay VN; `year` = 01/01 → hôm nay VN; `custom` cần cả `from` và `to` (`YYYY-MM-DD`, ngày VN, hai đầu tính cả). `custom` thiếu `from`/`to` ⇒ 400 `fieldErrors` trỏ đúng ô; `from > to` ⇒ 400 `fieldErrors.to`; `from`/`to` gửi kèm `month`/`year` ⇒ 400 (không lặng lẽ bỏ); sai định dạng/giá trị lạ ⇒ 400 câu tiếng Việt. Response trả `from`/`to` đã phân giải.
5. **KPI + Table (UX-DR-12, UX-DR-10, §4):** trên cùng một dòng 4 KPI — Doanh thu, Giá vốn, Lợi nhuận gộp (accent), Biên % — từ `totals`. Dưới là Table, cột số canh phải `.mono`; tiền qua `<Money>`/`formatVnd` (web) và `MoneyText`/`formatVnd` (Flutter), định dạng đủ chữ số `83.010.960 đ` (không rút gọn "1,28 tỷ"); biên hiện `24%`, `null` ⇒ `—`. Đủ trạng thái loading (skeleton) / rỗng ("Chưa có đơn đã xuất kho trong kỳ này.") / lỗi có Thử lại.
6. **Nhãn bắt buộc (§4):** màn web và mobile hiển thị nguyên văn `Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung.` (Banner info) và notecard "Đơn chưa xuất kho không có trong báo cáo." — guard design-system canh cả hai nền tảng.
7. **Gate theo `costs.view` (§5, AD-4, AD-17):** endpoint `@RequirePermissions(PERM.costsView)`, quyền đọc FRESH mỗi request. Thiếu `costs.view` ⇒ 403 — kể cả account có `orders.view_all` + `dashboard.finance_view` (preset `KE_TOAN` trừ `costs.view`). Web: mục sidebar "Lợi nhuận" (nhóm "Báo cáo") chỉ hiện khi có `costs.view`, route `/reports/profit` gate cùng dữ liệu nav; mobile: Menu → "Báo cáo lợi nhuận" chỉ hiện khi có quyền, route gate cùng `kMobileMenu`. Thiếu quyền gõ thẳng đường dẫn ⇒ về landing.

## Tasks / Subtasks

- [x] **T1 — Backend domain thuần (AC: 1, 2, 4)**
  - [x] `backend/src/dashboard/domain/profit-report.ts`: `PROFIT_GROUP_BY = ['order','month','assignee','source'] as const`; `PROFIT_PERIODS = ['month','year','custom'] as const`; type `OrderProfitRow` (một đơn: `orderId, issuedAt: Date, issuedMonth: 'YYYY-MM', customerName, assigneeAccountId|null, assigneeDisplayName|null, sourceId, sourceName, revenue, cost`); `profitFigures(revenue, cost)` ⇒ `{ revenue, cost, grossProfit, marginPct }` (half-up thuần integer — khuôn `estimatedMarginPct` ở `orders.service.ts:3129-3136`, kể cả lợi nhuận âm); `groupProfitRows(rows, groupBy)` ⇒ hàng nhóm (luật thứ tự + nhãn ở Dev Notes); `profitTotals(rows)`.
  - [x] `profitPeriodRange(period, now)` cạnh `periodRange` trong `dashboard-period.ts` (thêm `year`, tái dùng `todayInVietnam` + `DateRange`; KHÔNG viết lại `vietnamRangeToInstants`).
  - [x] Unit `backend/test/profit-report.spec.ts`: công thức (không chiết khấu = công thức AC nguyên văn; có chiết khấu; dòng công lắp lãi 0), `marginPct` (half-up, âm, `revenue = 0` ⇒ null), 4 cách nhóm (thứ tự, gom `assignee` null, nhãn tháng `10/2026`), **bất biến Σ hàng = totals** cho cả 4 cách nhóm. Số kỳ vọng in từ hàm thật (luật 20), không gõ tay số dẫn xuất.
- [x] **T2 — Backend đọc + endpoint (AC: 1, 2, 3, 4, 7)**
  - [x] `backend/src/dashboard/profit-report.service.ts` (`ProfitReportService.report(query, now)`): **MỘT** `$queryRaw` trả mỗi đơn đã xuất trong kỳ một dòng (SQL mẫu ở Dev Notes — `::bigint` TRƯỚC phép nhân, lọc `type = 'xuat'`, `status <> 'huy'`, join lines theo `sv.order_version_id`), đổi `bigint` → `number` ở một điểm, rồi `groupProfitRows` + `profitTotals`. Không N+1, không pricing thứ hai.
  - [x] DTO (`backend/src/dashboard/dto/`): `profit-report-query.dto.ts` (`groupBy?` `@IsIn`, `period?` `@IsIn`, `from?`/`to?` `@IsISO8601({strict:true})` + `@Matches(/^\d{4}-\d{2}-\d{2}$/)` câu tiếng Việt như `list-audit-logs-query.dto.ts`); `profit-report-response.dto.ts`; `profit-report-row.dto.ts`; `profit-figures.dto.ts`. Field tiếng Anh; field tiền `type: 'integer'` + description có cụm "số nguyên đồng" (để `money-fields.mjs` tự nhận); `marginPct` description KHÔNG chứa chữ "đồng"; mọi `string | null` khai `type: String, nullable: true` (guard `openapi-no-untyped-object`).
  - [x] Luật kỳ ở service/controller: `custom` thiếu ô ⇒ `AppException(VALIDATION_ERROR, 400, …, [{ field: 'from'|'to', … }])`; `from > to` ⇒ `fieldErrors.to` câu "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." (khuôn `audit-log-read.service.ts`); `from`/`to` kèm `month`/`year` ⇒ 400 `fieldErrors.from` "Chỉ gửi ngày khi chọn kỳ tuỳ chọn.".
  - [x] `backend/src/dashboard/profit-report.controller.ts`: `@Controller('reports')`, `@Get('profit')` + `@RequirePermissions(PERM.costsView)` + `@ApiOkResponse/@ApiBadRequestResponse/@ApiForbiddenResponse` (khuôn `dashboard.controller.ts`). `DashboardModule` thêm controller + provider (imports giữ nguyên `AccountsModule`; KHÔNG cần `OrdersModule` cho service mới — đọc thẳng Prisma, `quoteNumberOf` là hàm domain thuần import được).
  - [x] `npm run openapi:gen` ⇒ `backend/openapi/openapi.json`; kiểm `moneyFields()` nhận `revenue`, `cost`, `grossProfit` và KHÔNG nhận `marginPct`/`orderCount`.
  - [x] Test: `backend/test/profit-report.service.spec.ts` (mock Prisma: một lần `$queryRaw` — `toHaveBeenCalledTimes(1)`; bigint → number; kỳ `custom`/`month`/`year` ra đúng tham số), `backend/test/profit-report.e2e.spec.ts` qua `initAppOnLoopback` (200 với `costs.view`; 403 với `orders.view_all` + `dashboard.finance_view` + `payments.record` nhưng thiếu `costs.view`; các ca 400 ở AC 4 + `groupBy=foo`; tập khoá response là tập con contract — memory `response-key-set-assert-mock-rows`), `backend/test/profit-report.db.integration.spec.ts` (Postgres thật — ca bắt buộc ở Testing).
- [x] **T3 — Web (AC: 1, 5, 6, 7)**
  - [x] `npm run api:gen` ⇒ `web/src/api/generated/schema.d.ts`.
  - [x] Port `web/src/design-system/session/profit-report-port.ts` (type = alias type sinh; `getProfitReport(query)`), `fake-profit-report-port.ts` (seed đủ 4 cách nhóm, có `assignee` null, `marginPct` null và âm), export ở `session/index.ts`; adapter `web/src/api/http-profit-report-port.ts`; ráp ở `web/src/main.tsx`.
  - [x] `SIDEBAR_NAV` thêm section `{ title: 'Báo cáo', links: [{ key: 'profit', icon: 'ic-status', label: 'Lợi nhuận', requires: PERM.costsView }] }` giữa section đầu và "Quản trị" (mockup `s-profit-report`); `NAV_ROUTES.profit = '/reports/profit'`; route trong `AppRoutes.tsx`.
  - [x] `web/src/screens/reports/ProfitReportScreen.tsx` (+ `reports.css` chỉ token): Topbar eyebrow "BÁO CÁO", 4 `Kpi` (`mono`, Lợi nhuận gộp `accent`), `Banner` info nhãn bắt buộc, Toolbar "Nhóm theo:" + `Seg` 4 lựa chọn (Theo đơn / Theo tháng / Theo sale / Theo nguồn khách) + `Seg` kỳ (Tháng này / Năm nay / Tuỳ chọn) + 2 `Field type="date"` khi Tuỳ chọn (`min`/`max` theo đầu kia, khuôn `AuditLogScreen.tsx`), `Table` cột theo cách nhóm (Dev Notes), notecard. Vé chống trả lời muộn như màn Audit. KHÔNG nút "Xuất Excel", KHÔNG delta "so tháng trước".
  - [x] Test: `web/src/test/profit-report-screen.test.tsx` (render KPI + nhãn bắt buộc; đổi nhóm gửi đúng `groupBy` + cột đổi; Tuỳ chọn gửi `period=custom&from&to`; `marginPct` null ⇒ `—`; tiền qua formatter; rỗng; lỗi + Thử lại), `http-profit-report-port.test.ts`, ca render trong `screens-render.test.tsx`, `app-routes.test.tsx` (hiện với `costs.view`, ẩn + gõ `/reports/profit` về landing khi thiếu), `composition-root.test.ts` nếu nó liệt kê port.
- [x] **T4 — Mobile Cubit (AC: 1, 5, 6, 7)**
  - [x] `cd mobile && dart run tool/generate_api.dart`; `mobile/lib/design_system/session/{profit_report_port,fake_profit_report_port}.dart` (typedef = DTO sinh); `mobile/lib/api/http_profit_report_port.dart`; `AppPorts.profitReport` + ráp ở `main.dart`.
  - [x] Menu: `kMobileMenu` thêm `AppNavLink(key: 'profit', label: 'Báo cáo lợi nhuận', subtitle: 'Lợi nhuận gộp trên vật tư', icon: 'ic-status', requires: AppPermissionKeys.costsView)` SAU `warranty`, TRƯỚC `permissions` (thứ tự mockup `s-menu`); `kProfitReportPath = '/reports/profit'` + `kNavRoutes['profit']` (`app_routes.dart`); route ở `signed_in_app.dart`.
  - [x] `mobile/lib/screens/reports/{profit_report_screen,profit_report_cubit,profit_report_state}.dart` — chỉ cubit gọi port; state `final class` + `Equatable`; 4 `AppKpi` lưới 2×2; `AppBanner` nhãn bắt buộc; `AppTabs` cách nhóm (Đơn / Tháng / Sale / Nguồn) + `AppTabs` kỳ (Tháng này / Năm nay / Tuỳ chọn); Tuỳ chọn ⇒ 2 `AppField` gõ `YYYY-MM-DD` (controller ở `State`, chỉ gửi ngày có thật — khứ hồi `DateTime` như `audit_log_cubit.dart` `_parseDay`); danh sách hàng (mockup: dòng 1 nhãn đậm `.mono`, dòng 2 phụ — order: nguồn · người phụ trách · DT; nhóm khác: số đơn · DT; phải: LN gộp + biên).
  - [x] Test: `mobile/test/screens/reports/profit_report_cubit_test.dart` (bloc_test checklist Testing), `profit_report_screen_test.dart` (render nhãn bắt buộc + KPI, wiring tab/kỳ/ngày/Thử lại, tháo màn khi port chờ, `marginPct` null ⇒ `—`), `mobile/test/api/http_profit_report_port_test.dart`, cập nhật `app_routes_test.dart`, `signed_in_app_test.dart`, `pns_app_test.dart`, `test/app/support/app_harness.dart`.
- [x] **T5 — Design-system guard (AC: 5, 6, 7)**
  - [x] `design-system/screens/profit-report.test.mjs`: (a) nhãn bắt buộc nguyên văn có ở màn web và mobile (đọc qua `readMobileScreen`), là **literal đứng riêng** (không thoả bằng chuỗi con của câu dài hơn — memory `nested-label-parity-guard-blind`); (b) màn web + mobile không tự tính tiền/biên (không `revenue -`, `- cost`, `* 100`, `/ revenue` trên field contract); (c) 4 khoá `groupBy` web ↔ mobile bằng nhau và khớp `PROFIT_GROUP_BY` backend (chống rỗng = 4); (d) không `toLocaleString`/`Intl`/`NumberFormat`. Mỗi assert có đột biến ĐỎ ghi trong Completion Notes.
  - [x] `menu-nav-parity.test.mjs` xanh với entry `profit` (key/requires khớp web); `gating.test.mjs` vẫn xanh; `money-render-guard` phủ hai màn mới (đột biến in `{row.revenue}` / `'${row.revenue}'` ⇒ ĐỎ).
- [x] **T6 — Tài liệu + lane (mọi AC)**
  - [x] `epics.md` Story 8.6 thêm khối "_Quyết định giữa story (2026-10-30, Story 8.6)_" chép các quyết định ở Dev Notes (luật 11). Spine: dòng 557 "Dashboard & báo cáo (FR-19)" → "(FR-19, FR-37)" và AD-20 (b) thêm "đơn có mặt khi có phiếu xuất và không huỷ; doanh thu trừ chiết khấu đã duyệt, trước VAT".
  - [x] 5 lane: backend `npm test` + `npm run test:db` (`npx prisma migrate deploy` trước), design-system `npm test`, web `npm run typecheck && npm test && npm run build`, mobile `flutter analyze && flutter test`. ESLint + Prettier sạch trên file backend của story (cả repo đỏ sẵn — memory `backend-lint-red-at-baseline`).
  - [x] Smoke web + emulator (luật 13, 17, 18) — xem Testing "Smoke".

## Dev Notes

### Luật dự án (Trợ Lý, Epic 8) — bắt buộc

Đọc nguyên văn `_bmad-output/story-automator/extra-instructions-8-review.txt` (luật 1–20). Với story này nổi bật:
- (20) **SỐ LIỆU:** tính ở backend; lợi nhuận theo công thức epics 8.6; fixture số dẫn xuất KHÔNG gõ tay — chạy hàm thật in ra; có ca DB cho truy vấn tổng hợp.
- (9) tiền số nguyên đồng, hiển thị qua formatter có sẵn (`83.010.960 đ`).
- (3) màn web mới ⇒ ca `screens-render.test.tsx`; (4) màn mobile mới ⇒ widget test; (5) guard mới có chống-guard-rỗng; (6) e2e qua `initAppOnLoopback`; (7) không push, `git add` đường dẫn cụ thể; (8) code/comment/tên test tiếng Anh, chỉ chuỗi UI/lỗi tiếng Việt; (11) quyết định giữa story → `epics.md` + spine cùng commit; (13) smoke account riêng, JWT secret tạm trên dòng lệnh, KHÔNG đọc `.env`; (17) chỉ kill PID/serial của mình; (18) Cubit + bloc_test + đột biến guard "màn không gọi port" trên màn mới; (19) key quyền chỉ từ registry, gate theo quyền.
- Luật (1)(2) không áp: story CHỈ ĐỌC, không ghi đơn/tồn/tiền, không publish event, không khoá.

### Quyết định phạm vi (đọc trước khi code — chép vào `epics.md`)

- **Một endpoint `GET /reports/profit`**, trong module `dashboard/` (spine dòng 557: "Dashboard & báo cáo → `dashboard/`"). Route tiếng Anh; KHÔNG `/bao-cao/loi-nhuan` của mockup.
- **"Đã xuất kho" = có phiếu xuất của đơn** (`type = 'xuat'`, `order_id` không null; unique `(order_id, order_version_id)` ⇒ tối đa một phiếu mỗi version, và đơn đã xuất không `mo_lai` được ⇒ thực tế một phiếu mỗi đơn). KHÔNG dùng "mọi dòng có `costPriceSnapshot`": đơn chỉ-dịch-vụ đi nhánh Đã giao vẫn được ghi `costPriceSnapshot` (= giá bán) mà không có phiếu và không có mốc ngày xuất — báo cáo "trên vật tư" không có vật tư nào để đo. Đơn chỉ công lắp/dòng tự do vì thế không bao giờ có mặt (lãi 0 nên không đổi lợi nhuận, chỉ tránh kéo biên % xuống).
- **Đơn huỷ (`huy`) sau xuất bị loại:** không còn là doanh thu; hàng lên lại qua phiếu nhập trả. Không đọc phiếu nhập trả.
- **Doanh thu = sau chiết khấu đã duyệt, trước VAT** (Trợ Lý chốt mặc định, cần Đại Ca xác nhận — xem Câu hỏi mở): `Σ(unitPriceSnapshot × qty) − COALESCE(order_versions.discount_amount, 0)` của version đã xuất (đúng `vatBase` của `computeOrderTotals`, `order-totals.ts:51`). Lý do: banner mockup hứa app báo "ÍT hơn sự thật, cố ý"; bỏ qua chiết khấu sẽ báo NHIỀU hơn sự thật. VAT là tiền thu hộ nhà nước, không phải doanh thu. Đơn không chiết khấu ⇒ số đúng nguyên văn công thức AC.
- **Mốc thời gian = ngày xuất** (`stock_vouchers.created_at`, cột TIMESTAMP không tz giữ UTC — memory `created-at-timestamp-without-tz-prisma-utc`): lọc kỳ + nhóm tháng đều trên mốc này (giá vốn đóng băng lúc xuất — AD-20). Không theo ngày chốt, không theo `paidOn` (khác doanh thu dashboard 8.1 — hai con số "doanh thu" khác nghĩa là cố ý; nhãn KPI ghi "Doanh thu (đơn đã xuất)" nếu cần phân biệt — chọn nhãn "Doanh thu" theo mockup, tooltip không bắt buộc).
- **Toàn công ty, không thu hẹp theo phạm vi xem đơn** (cùng quyết định doanh thu 8.1): quyền tài chính `costs.view` là cổng duy nhất. Hàng KHÔNG link sang chi tiết đơn ⇒ không cần `PERMISSION_REQUIRES`/`PERMISSION_REQUIRES_ANY` cho `costs.view` (TD-65 không phát sinh). Mọi preset có `costs.view` (SUPER_ADMIN, ADMIN, QUAN_LY, KE_TOAN) đều có `orders.view_all`.
- **Kỳ:** `month` (mặc định) / `year` / `custom` (`from`+`to`). Nhóm theo tháng có nghĩa với `year`/`custom`; với `month` là một hàng — chấp nhận.
- **Không phân trang**: ~20 user, đơn/tháng cỡ chục–trăm; trả mọi hàng. Mobile dùng `ListView.builder`.
- **`marginPct` số nguyên** half-up (khuôn `estimatedMarginPct` có sẵn, hiển thị `24%` như màn duyệt chiết khấu), không phải `25,1%` của mockup — một định dạng phần trăm cho cả app.
- **Nhãn hàng ở backend** (`label`, một nguồn cho web + mobile): order ⇒ `quoteNumberOf(orderId)`; month ⇒ `MM/YYYY`; assignee ⇒ `displayName` hoặc "Chưa giao người phụ trách"; source ⇒ `CustomerSource.name`. `orders.assignee_account_id` có FK tới `accounts` (relation `OrderAssignee`) và account không bị xoá (chỉ vô hiệu hoá) ⇒ tên luôn có; account vô hiệu hoá vẫn hiện tên.
- **Bỏ khỏi story (không có AC):** nút "Xuất Excel", delta "+2,3% so tháng trước", KPI rút gọn "1,28 tỷ"/"322 tr" (tiền đủ chữ số — quyết định 8.1), seg "07/2026" chọn tháng bất kỳ (thay bằng Tuỳ chọn hai ngày), link hàng → chi tiết đơn. Muốn thêm là story riêng.

### Hợp đồng đề xuất (contract-first, sinh OpenAPI từ DTO)

```
GET /reports/profit?groupBy=order&period=custom&from=2026-07-01&to=2026-07-31
200 {
  groupBy: 'order', from: '2026-07-01', to: '2026-07-31',
  totals: { revenue, cost, grossProfit, marginPct: int|null, orderCount },
  rows: [{
    key: string|null,            // orderId | 'YYYY-MM' | accountId (null = chưa giao) | sourceId
    label: string,               // xem Quyết định
    revenue, cost, grossProfit, marginPct: int|null, orderCount,
    customerName: string|null,   // chỉ groupBy=order, nhóm khác null
    assigneeDisplayName: string|null,
    sourceName: string|null,
    issuedAt: string|null        // ISO-8601 UTC, chỉ groupBy=order
  }]
}
```
- Tên DTO đề xuất: `ProfitReportResponseDto`, `ProfitReportRowDto`, `ProfitFiguresDto`; enum OpenAPI đặt tên tường minh (`ProfitGroupBy`, `ProfitPeriod` — bài học 8.5: enum không tên ⇒ client Dart sinh tên chung trùng nhau).
- Tiền là `integer` (number JS, an toàn tới 2^53); tổng vượt INT4 là bình thường.

### Thứ tự + cột theo cách nhóm

| groupBy | Thứ tự hàng | Cột web (sau cột nhãn) |
|---|---|---|
| `order` | `issuedAt desc, orderId desc` | Đơn · Khách · Sale · Nguồn · Ngày xuất · Doanh thu · Giá vốn · Lợi nhuận gộp · Biên |
| `month` | `key desc` (tháng mới trước) | Tháng · Số đơn · Doanh thu · Giá vốn · Lợi nhuận gộp · Biên |
| `assignee` | `grossProfit desc, label asc` (null gom một hàng, xếp theo cùng luật) | Sale · Số đơn · … |
| `source` | `grossProfit desc, label asc` | Nguồn khách · Số đơn · … |

Ngày xuất hiển thị bằng helper có sẵn `ngayNgan()` (web `web/src/screens/inventory/format-gio.ts`; mobile twin ở `stock_vouchers_screen.dart` hoặc file chung nếu 8.5 đã tách — kiểm trước, KHÔNG viết lại). CẤM `toLocaleString`/`Intl`.

### SQL mẫu (một truy vấn, mỗi đơn một dòng)

```sql
SELECT o.id AS "orderId", sv.created_at AS "issuedAt",
       to_char(sv.created_at + interval '7 hours', 'YYYY-MM') AS "issuedMonth",
       c.name AS "customerName", o.assignee_account_id AS "assigneeAccountId",
       a.display_name AS "assigneeDisplayName", o.source_id AS "sourceId", s.name AS "sourceName",
       (SUM(li.unit_price_snapshot::bigint * li.qty) - COALESCE(MAX(v.discount_amount), 0))::bigint AS revenue,
       SUM(COALESCE(li.cost_price_snapshot, li.unit_price_snapshot)::bigint * li.qty)::bigint AS cost
FROM stock_vouchers sv
JOIN orders o ON o.id = sv.order_id
JOIN order_versions v ON v.id = sv.order_version_id
JOIN order_line_items li ON li.order_version_id = sv.order_version_id
JOIN customers c ON c.sdt = o.customer_sdt
JOIN customer_sources s ON s.id = o.source_id
LEFT JOIN accounts a ON a.id = o.assignee_account_id
WHERE sv.type = 'xuat' AND sv.order_id IS NOT NULL AND o.status <> 'huy'
  AND sv.created_at >= ${fromInstant} AND sv.created_at < ${toExclusive}
GROUP BY o.id, sv.id, c.name, a.display_name, s.name
```
- `fromInstant`/`toExclusive` từ `vietnamRangeToInstants` — so cột TIMESTAMP-không-tz với `Date` Prisma (UTC) như `dashboard.service.ts` làm với `orders.created_at`. Kiểm bằng ca DB ranh giới, đừng tin mẫu.
- **`::bigint` TRƯỚC phép nhân** (memory `int4-money-column-percent-overflow`): `int4 * int4` của Postgres ném "integer out of range" khi một dòng > 2,15 tỉ ⇒ 500. Ca DB bắt buộc.
- `COALESCE(cost_price_snapshot, unit_price_snapshot)`: bất biến là mọi dòng version đã xuất có `costPriceSnapshot` (ghi cùng tx `issueStockIfNeeded`, `orders.service.ts:1307-1319`); COALESCE chỉ là lưới — lãi 0, không bao giờ thổi phồng.
- Prisma 7: `$queryRaw` tagged template (tham số hoá), cast kết quả `bigint` → `Number` ở một điểm (khuôn `dashboard.service.ts:revenue`). Tên cột trả về dùng alias `"camelCase"` có ngoặc kép.

### Trạng thái hiện tại các file sẽ sửa (đã đọc)

- `backend/src/dashboard/dashboard.module.ts`: `imports: [OrdersModule, AccountsModule]`, `controllers: [DashboardController]`, `providers: [DashboardService]`. Thêm `ProfitReportController` + `ProfitReportService`; doc comment module cập nhật (FR-37). Giữ nguyên dashboard 8.1.
- `backend/src/dashboard/domain/dashboard-period.ts`: `DASHBOARD_PERIODS = ['day','week','month']`, `periodRange`, `vietnamRangeToInstants`, `addDays` (private). KHÔNG đổi `DASHBOARD_PERIODS` (contract 8.1); thêm `profitPeriodRange` riêng (hoặc file `profit-period.ts`) tái dùng `todayInVietnam`. Test `dashboard-period.spec.ts` phải xanh nguyên.
- `backend/src/dashboard/dashboard.controller.ts`: khuôn controller (resolve quyền FRESH qua `AccountPermissionsService.listForAccount`). Controller mới chỉ cần `@RequirePermissions(PERM.costsView)` (guard toàn cục đọc quyền tươi — xem `RequirePermissions` decorator, như `audit.controller.ts`).
- `backend/src/orders/domain/quote-number.ts`: `quoteNumberOf(orderId)` ⇒ `BG-XXXXXXXX` — import, không sao chép.
- `backend/src/orders/domain/cost-snapshot.ts` + `orders.service.ts:1238-1320` (`issueStockIfNeeded`): giá vốn MỌI dòng của version hiện tại đóng băng lúc xuất; đơn không có dòng theo dõi tồn ⇒ không phiếu. Story KHÔNG sửa đường này.
- `backend/src/accounts/domain/permission-registry.ts:66,125`: `costsView: 'costs.view'`, nhãn "Xem giá vốn & lợi nhuận" — giữ nguyên, KHÔNG thêm key.
- `web/src/design-system/shell/Sidebar.tsx` `SIDEBAR_NAV`: section đầu (home…warranty) + "Quản trị" (settings, permissions, audit, profile). Thêm section "Báo cáo" ở giữa. `gating.test.mjs` (e) regex `key:'audit'…requires: PERM.auditRead` / `key:'permissions'…` — entry mới đặt trước "Quản trị" không làm lệch match; chạy lại để chắc. `landingPath` theo thứ tự sidebar — `home` không cần quyền ⇒ landing không đổi.
- `web/src/app/routes.ts` `NAV_ROUTES` (thêm `profit`), `AVAILABLE_NAV_KEYS` tự suy.
- `mobile/lib/design_system/shell/app_menu_nav.dart` `kMobileMenu`: customers, warranty, permissions, audit, profile — chèn `profit` sau warranty. Comment đầu file: key/requires phải khớp web (guard `menu-nav-parity.test.mjs`).
- `mobile/lib/app/app_routes.dart` (`kNavRoutes`, `isOpenable` qua `openableKeys`), `mobile/lib/app/app_ports.dart` (thêm `profitReport` ⇒ cập nhật mọi chỗ dựng `AppPorts`: `main.dart`, harness, `signed_in_app_test`, `pns_app_test`).
- Màn mẫu để chép khuôn (KHÔNG import chéo logic): web `web/src/screens/audit/AuditLogScreen.tsx` (Seg, ngày `min`/`max`, vé, lỗi + Thử lại) và `web/src/screens/dashboard/DashboardScreen.tsx` (Kpi); mobile `mobile/lib/screens/audit/*` (cubit, `_parseDay`, AppTabs) và `mobile/lib/screens/dashboard/*` (AppKpi).
- Mockup `ux-designs/…/mockups/all-screens.html:4202-4341` (`s-profit-report`), Menu mobile dòng 909-913.

### Kiến trúc phải tuân

- AD-1/AD-2: client chỉ hiển thị số backend trả — kể cả biên %, nhãn hàng, nhãn tháng. AD-4: backend enforce `costs.view`; ẩn nav chỉ là UX. AD-5: lỗi qua `AppException`/`createValidationPipe` (câu tiếng Việt). AD-10: tiền integer đồng. AD-12: OpenAPI sinh từ code, regen web + mobile cùng commit, cấm sửa tay. AD-13: chỉ component/token có sẵn (web `Kpi`, `Banner`, `Table`, `Seg`, `Toolbar`, `Field`, `Money`, `Skeleton`, `EmptyState`, `ErrorState`, `Frame`; Flutter `AppKpi`, `AppBanner`, `AppTabs`, `AppField`, `MoneyText`, `AppCard`, `AppSkeleton`, `AppEmptyState`, `AppErrorState`). AD-17: `PERM.costsView` / `AppPermissionKeys.costsView` (KHÔNG `AppPerm.x` trong màn mobile — memory `mobile-screens-use-apppermissionkeys-not-appperm`). AD-20: chỉ đọc `costPriceSnapshot`, đơn chưa xuất không có.
- Guard `no-vietnamese-api-contract`: route `reports/profit`, query `groupBy, period, from, to`, field `groupBy, from, to, totals, rows, key, label, revenue, cost, grossProfit, marginPct, orderCount, customerName, assigneeDisplayName, sourceName, issuedAt` — tiếng Anh; enum value `order|month|assignee|source`, `month|year|custom` tiếng Anh. Description tiếng Việt OK.
- `money-fields.mjs` lấy field tiền theo `/đồng/i` trên description ⇒ `revenue`/`cost`/`grossProfit` PHẢI có "số nguyên đồng" (để guard tiền canh); `marginPct`/`orderCount` KHÔNG được chứa "đồng" (kể cả "hợp đồng" — memory `money-fields-dong-matches-hop-dong`). Lưu ý `revenue` đã là field tiền của dashboard 8.1 — tên trùng là chủ ý.
- Guard "màn không gọi port" (mobile, allowlist rỗng) phủ màn mới; màn web chỉ nhận port qua props từ composition root.

### Testing — ca bắt buộc + bẫy đã biết

**Lane DB `profit-report.db.integration.spec.ts` (Postgres thật, seed qua service/SQL thật — không mock):**
1. Đơn đã xuất có mặt; đơn đã chốt chưa xuất KHÔNG; đơn chỉ công lắp (Đã giao, có `costPriceSnapshot` nhưng không phiếu) KHÔNG; đơn xuất rồi huỷ KHÔNG.
2. Công thức: đơn có dòng theo dõi tồn + dòng công lắp (lãi dòng 0) + chiết khấu đã duyệt ⇒ `revenue/cost/grossProfit` khớp giá trị in từ `profitFigures` (luật 20).
3. **Dòng > INT4** (`unit_price_snapshot × qty` > 2.147.483.647) ⇒ 200 đúng số, không 500.
4. Ranh giới ngày VN: phiếu xuất lúc `23:59:59+07` ngày cuối kỳ có mặt, `00:00:00+07` ngày sau KHÔNG; nhóm tháng: phiếu `2026-07-31T17:30:00Z` (= 01/08 VN) vào tháng `2026-08`.
5. Lấy dòng theo **version của phiếu**, không theo `currentVersionId` (seed: dòng ở version khác của cùng đơn không được cộng).
6. 4 cách nhóm trên cùng bộ dữ liệu: Σ hàng = `totals`; `assignee` null gom một hàng; nguồn đã `active: false` vẫn hiện tên.
- Đột biến bắt buộc (cp backup, khôi phục + `cmp`, KHÔNG `git checkout`; mutant phải compile; không pipe lệnh mutant; zsh: dùng hàm/mảng, in `Tests:` mỗi mutant): bỏ `::bigint` ⇒ ca 3 ĐỎ; bỏ `status <> 'huy'` ⇒ ca 1 ĐỎ; bỏ `sv.type = 'xuat'` — phiếu nhập trả không mang `order_id` (`createReturnVoucher` chỉ ghi `returnOfVoucherId`) nên mutant này tương đương khi còn lọc `order_id IS NOT NULL`: ghi "tương đương" kèm lý do, đừng ép test; join lines theo `o.current_version_id` ⇒ ca 5 ĐỎ; bỏ `- discount` ⇒ ca 2 ĐỎ; `+ interval '7 hours'` → `0 hours` ⇒ ca 4 ĐỎ; `toExclusive` không `+1 ngày` (sửa tạm hàm dùng chung) ⇒ ca 4 ĐỎ; `@RequirePermissions(PERM.ordersViewAll)` ⇒ e2e 403 ĐỎ; bỏ `profit` khỏi `NAV_ROUTES`/`kNavRoutes` ⇒ test route ĐỎ; màn mobile gọi `widget.port…` ⇒ `no_port_call_in_screens_test` ĐỎ; xoá nhãn bắt buộc ở một nền tảng ⇒ guard T5 ĐỎ.
- Kiểm tương đương trước khi đổ lỗi test (memory `mutation-semantically-equivalent-false-survivor`): vd đổi thứ tự sắp khi fixture chỉ có một hàng là no-op ⇒ fixture phải ≥ 2 hàng khác nhau mỗi cách nhóm.
- Fixture số dẫn xuất (tổng, biên) không gõ tay — memory `handpicked-fixture-numbers-hide-formula-bugs`.
- e2e: assert tập con khoá contract; `$queryRaw` mock trả `bigint` thật (`10n`) để bắt quên `Number()`.
- **Web vitest:** Node 24 `localStorage` che jsdom ⇒ `memoryStorage()`; `.tsx` lỗi cú pháp có thể qua guard text — typecheck + render là lưới thật.
- **Cubit (luật 18, project-context Testing):** ca đầu / thành công / lỗi port / đóng sớm cả nhánh thành công lẫn lỗi; đổi cách nhóm / kỳ gửi lại đúng query; vé cũ bị bỏ (fake trả KHÁC nhau mỗi lần — Equatable); seed MỌI field khác mặc định, kỳ vọng field-by-field bằng constructor (không `copyWith`); quét carry-over (xoá từng `x: state.x` ⇒ ĐỎ); `isClosed` sau await trong try là mutant tương đương (memory `cubit-close-error-path-untested`); một `pump()` sau emit có thể không đủ.
- Text-guard mobile đọc qua `readMobileScreen` (cả cubit/state); neo dương khớp câu lệnh, không khớp dòng khai báo hay chuỗi con.

**Smoke (luật 13/17/18):** backend `npm run start` cổng riêng (không `node dist/main` — hook chặn chữ `dist`), JWT secret tạm trên dòng lệnh, KHÔNG đọc `.env`. `npm run test:db` XOÁ sạch `pns-postgres` ⇒ seed smoke SAU lane DB. Hai account smoke riêng (argon2id như backend, có SĐT): `smoke-8-6-profit` (preset `KE_TOAN` — có `costs.view` + quyền ghi nhận đủ để tạo dữ liệu, hoặc thêm quyền cần thiết) và `smoke-8-6-plain` (KE_TOAN bỏ `costs.view`). Dữ liệu: tạo khách + đơn + chốt + xuất kho qua API thật (cần phiếu nhập tồn trước — `inventory.manage`), KHÔNG insert số báo cáo bằng SQL. Kiểm: KPI khớp curl; đổi 4 cách nhóm; Tuỳ chọn khoảng ngày; plain không thấy mục, gõ `/reports/profit` ⇒ `/dashboard`, curl ⇒ 403. Emulator: cold boot `-no-snapshot`, serial riêng, `rm /sdcard/ui.xml` trước mỗi dump, bật lại `verifier_verify_adb_installs` nếu tắt. **Dọn:** xoá chuỗi đơn smoke (phiếu, dòng, version, đơn, khách) để lane DB lần sau không ĐỎ (memory `smoke-residue-order-breaks-db-lane`), vô hiệu hoá + xoá phiên 2 account; kill đúng PID/serial đã ghi.

### Project Structure Notes

- Mới backend: `src/dashboard/{profit-report.controller.ts,profit-report.service.ts}`, `src/dashboard/domain/profit-report.ts` (+ `profitPeriodRange` trong `dashboard-period.ts` hoặc `domain/profit-period.ts`), `src/dashboard/dto/{profit-report-query,profit-report-response,profit-report-row,profit-figures}.dto.ts`; test `profit-report.spec.ts`, `profit-report.service.spec.ts`, `profit-report.e2e.spec.ts`, `profit-report.db.integration.spec.ts`. Không migration (index `stock_vouchers(created_at)` đã có).
- Mới web: `src/screens/reports/{ProfitReportScreen.tsx,reports.css}`, `src/design-system/session/{profit-report-port,fake-profit-report-port}.ts`, `src/api/http-profit-report-port.ts`, `src/test/{profit-report-screen.test.tsx,http-profit-report-port.test.ts}`.
- Mới mobile: `lib/screens/reports/{profit_report_screen,profit_report_cubit,profit_report_state}.dart`, `lib/design_system/session/{profit_report_port,fake_profit_report_port}.dart`, `lib/api/http_profit_report_port.dart`, generated `lib/api/generated/**`, test `test/screens/reports/*`, `test/api/http_profit_report_port_test.dart`.
- Mới design-system: `screens/profit-report.test.mjs`.
- Sửa: `backend/src/dashboard/{dashboard.module.ts,domain/dashboard-period.ts}`, `backend/openapi/openapi.json` (sinh), `web/src/{main.tsx,app/routes.ts,app/AppRoutes.tsx,design-system/shell/Sidebar.tsx,design-system/session/index.ts,api/generated/schema.d.ts}`, `web/src/test/{screens-render,app-routes}.test.tsx` (+ `composition-root.test.ts` nếu cần), `mobile/lib/{main.dart,app/app_ports.dart,app/app_routes.dart,app/signed_in_app.dart,design_system/shell/app_menu_nav.dart}`, `mobile/test/app/*`, `design-system/components/menu-nav-parity.test.mjs` (nếu liệt kê key), `epics.md`, spine, `sprint-status.yaml`.
- `git check-ignore` mọi file mới trước khi add (memory `.gitignore assets/`, `.git/info/exclude`).

### Câu hỏi mở (đã chọn mặc định, Đại Ca xác nhận khi review)

1. **Chiết khấu:** mặc định TRỪ chiết khấu đã duyệt khỏi doanh thu + lợi nhuận (lý do ở Quyết định). Phương án khác: đúng nguyên văn công thức AC (không trừ) — báo cao hơn thực thu với đơn có chiết khấu.
2. **Đơn chỉ công lắp/dịch vụ:** mặc định không có mặt (không phiếu xuất). Phương án khác: đưa vào với lãi 0 (kéo biên % xuống, cần mốc ngày khác).
3. **Biên %:** số nguyên (`24%`) cho thống nhất với màn duyệt chiết khấu; mockup ghi một chữ số thập phân.
4. **Ngày xuất trên bảng web (thêm lúc review):** giữ `DD/MM` (`ngayNgan`) như story chỉ định. Phương án khác: `DD/MM/YYYY` để Tuỳ chọn vắt qua năm không có hai ngày trùng chữ.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.6] — AC gốc; #Epic 8 (Mobile BLoC từ đầu); 8.1 quyết định (doanh thu toàn công ty, tiền đủ chữ số, bỏ delta)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-37] (dòng 478-491), FR-35 `Order.sourceId` snapshot (dòng 461-468), §6.2 "Báo cáo KPI Sale" ngoài phạm vi (dòng 516)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md] — AD-20 (dòng 170-174), module `dashboard/` (537, 557), AD-4, AD-17
- [Source: …/mockups/all-screens.html#s-profit-report] dòng 4202-4341; `#s-menu` dòng 909-913
- [Source: _bmad-output/implementation-artifacts/8-1-dashboard-van-hanh.md] — khuôn tổng hợp + `$queryRaw` bigint + kỳ VN
- [Source: _bmad-output/implementation-artifacts/8-5-man-xem-audit-log-chi-super-admin.md] — khuôn màn mới full-stack (port/adapter/route/Cubit/ngày/guard), enum OpenAPI đặt tên, bẫy smoke
- [Source: _bmad-output/story-automator/extra-instructions-8-review.txt] — luật dự án 1–20
- [Source: _bmad-output/project-context.md] — Testing, Critical Don't-Miss (tiền, formatter)
- [Source: backend/src/dashboard/*, backend/src/orders/domain/{cost-snapshot,order-totals,quote-number}.ts, backend/src/orders/orders.service.ts:1238-1320, 3120-3145, backend/prisma/schema.prisma (StockVoucher 248-268, Order 476-523, OrderVersion 534-558, OrderLineItem 573-594), backend/src/accounts/domain/{permission-registry,role-presets}.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Backend:** `GET /reports/profit` (`ProfitReportController` + `ProfitReportService` trong `dashboard/`), MỘT `$queryRaw` mỗi đơn đã xuất một dòng (lọc `type='xuat'`, `order_id` không null, `status <> 'huy'`; dòng join theo `sv.order_version_id`; `::bigint` trước phép nhân; doanh thu trừ `COALESCE(discount_amount,0)`; tháng VN `+ 7 hours`), bigint → number ở một điểm. Domain thuần `profit-report.ts` (`profitFigures` half-up integer kể cả âm, `groupProfitRows` 4 cách nhóm + nhãn + thứ tự, `profitTotals`); `profitPeriodRange(month|year)` cạnh `periodRange`. Luật kỳ: custom thiếu ngày ⇒ 400 `fieldErrors` mọi ô thiếu (`REQUIRED`), `from > to` ⇒ `fieldErrors.to` (`INVALID_DATE_RANGE`), ngày kèm month/year ⇒ 400 (`DATES_ONLY_FOR_CUSTOM`). DTO tiếng Anh, `revenue/cost/grossProfit` "số nguyên đồng" (moneyFields nhận), `marginPct/orderCount` không. Enum OpenAPI `ProfitGroupBy`, `ProfitPeriod`.
- **Phát sinh ngoài danh sách task (bắt buộc bởi guard có sẵn):** (1) `PERM.costsView` web + `AppPerm.costsView` mobile — guard `menu-nav-parity` đọc `requires: PERM.x` từ PERM tay, và memory parity PERM↔AppPerm; (2) `cost`, `grossProfit` thêm vào `AUDIT_MONEY_FIELDS` — guard `audit-log.test.mjs` đòi bộ tiền audit phủ mọi field tiền contract (không event nào mang hai khoá này; không thêm vào `AUDIT_COST_FIELDS`); (3) `menu-nav-parity.test.mjs` cập nhật danh sách key Menu + assert gate `profit`; (4) `composition-root.test.ts` 17 → 18 adapter.
- **Web:** port/fake/adapter + ráp `main.tsx`; sidebar section "Báo cáo" → "Lợi nhuận" (`requires: PERM.costsView`); `NAV_ROUTES.profit = '/reports/profit'`; màn `ProfitReportScreen` (4 Kpi, Banner nhãn bắt buộc, Seg nhóm + Seg kỳ, 2 Field date `min/max` khi Tuỳ chọn, Table cột theo cách nhóm, notecard composed `.pr-note`, vé chống trả lời muộn). Kỳ Tuỳ chọn chỉ gọi backend khi đủ 2 ngày (trạng thái chờ "Chọn từ ngày và đến ngày"). Số liệu fake in ra từ `profitTotals`/`groupProfitRows` thật (luật 20).
- **Mobile:** port/fake/adapter + `AppPorts.profitReport` + `main.dart`; Menu "Báo cáo lợi nhuận" sau warranty trước permissions; `kProfitReportPath` + `kNavRoutes['profit']`; route `signed_in_app.dart`; Cubit + state `final class` Equatable, `awaitingDates` cho Tuỳ chọn thiếu ngày (cũng bump vé để trả lời cũ không vẽ đè). **Lệch nhỏ so với Dev Notes:** dùng `Column` thay `ListView.builder` — `AppMobileShell` đã bọc body trong `SingleChildScrollView`, `ListView.builder` lồng trong đó phải `shrinkWrap` nên không lười được; giống khuôn màn Audit.
- **Design-system:** `screens/profit-report.test.mjs` — (a) nhãn bắt buộc + notecard là literal đứng riêng trên cả 2 nền tảng và được render; (b) cấm số học tiền/biên, `* 100`, `~/`, reduce/fold, locale format, luật quyền trong màn, Excel/delta; (c) 4 khoá groupBy web = mobile = backend `PROFIT_GROUP_BY`; (d) money field contract; chống guard rỗng (`assertCodeNotBlind`, `assertScanned` ≥ 4) + self-test matcher.
- **Đột biến (cp backup, khôi phục + cmp, không git checkout):** SQL — bỏ `::bigint` doanh thu ⇒ DB 13 ĐỎ; bỏ `::bigint` giá vốn ⇒ 13 ĐỎ; bỏ `status <> 'huy'` ⇒ 9 ĐỎ; join dòng theo `o.current_version_id` ⇒ 2 ĐỎ; bỏ `- discount` ⇒ 2 ĐỎ; `7 hours` → `0 hours` ⇒ 1 ĐỎ; `>=` → `>` ⇒ 6 ĐỎ; `toExclusive` không +1 ngày ⇒ 5 ĐỎ; bỏ `sv.type = 'xuat'` ⇒ XANH — **tương đương**: chỉ phiếu xuất của đơn ghi `order_id` (`issueForOrderInTx`), phiếu nhập trả (`returnOfVoucherId`) và phiếu tay không ghi, nên còn `order_id IS NOT NULL` là đủ. `@RequirePermissions(PERM.ordersViewAll)` ⇒ e2e 14 ĐỎ. Domain — `revenue <= 0`→`< 0`, bỏ half-up, đảo thứ tự tháng/lợi nhuận/đơn, bỏ tie-break nhãn, đảo nhãn tháng ⇒ đều ĐỎ. Guard T5 — xoá/đổi nhãn bắt buộc mobile, web, lồng nhãn trong literal dài hơn, xoá notecard mobile, banner không render nhãn, web tính `revenue - cost`, mobile `marginPct * 100`, mobile bỏ một tab nhóm, web `toLocaleString` ⇒ đều ĐỎ; money-render guard: web `{row.revenue}`, mobile `'${row.revenue}'` ⇒ ĐỎ. Route — bỏ `profit` khỏi `NAV_ROUTES` ⇒ app-routes ĐỎ; sidebar gate `ordersViewAll` ⇒ ĐỎ; bỏ khỏi `kNavRoutes` ⇒ mobile ĐỎ; màn mobile gọi `widget.port.getProfitReport()` ⇒ `no_port_call_in_screens_test` ĐỎ. Cubit — quét carry-over 13/13 `x: state.x` ⇒ ĐỎ; bỏ vé (2 nhánh) ⇒ ĐỎ; bỏ `isClosed` nhánh lỗi ⇒ ĐỎ; `isClosed` nhánh thành công ⇒ XANH — tương đương đã biết (emit sau close ném trong `try`, `catch` kiểm `isClosed`); `awaitingDates` không bump vé ⇒ ĐỎ.
- **5 lane:** backend `npm test` 139 suite / 2823 xanh; `npm run test:db` 32 / 366 xanh (chạy lại sau dọn smoke, vẫn xanh); design-system 554/554; web typecheck + vitest 554/554 + build xanh; mobile `flutter analyze` sạch + `flutter test` 1529 xanh. ESLint + Prettier sạch trên mọi file backend của story.
- **Smoke (backend `npm run start` cổng 3086, JWT tạm trên dòng lệnh, không đọc `.env`; 2 account riêng argon2id có SĐT: `smoke-8-6-profit` = KE_TOAN + quotes/confirm/inventory, `smoke-8-6-plain` = KE_TOAN bỏ `costs.view`):** dữ liệu qua API thật — sản phẩm theo dõi tồn (giá 3.250.000, vốn 2.610.000), phiếu nhập 20, khách, đơn 14 tấm + dòng công lắp 6.500.000, chốt, xuất kho. curl: 4 cách nhóm đều doanh thu 52.000.000 / giá vốn 43.040.000 / LN 8.960.000 / 17% (= công thức AC, công lắp lãi 0), custom đúng, plain 403, `from > to` 400 `fieldErrors.to`, ngày kèm month 400. Web (vite 5186 → 3086, Playwright): đăng nhập SĐT, sidebar có nhóm "Báo cáo / Lợi nhuận", KPI + nhãn + hàng khớp curl, reload giữ phiên, đổi 4 nhóm, Tuỳ chọn chờ đủ 2 ngày rồi lọc, kỳ rỗng ⇒ câu rỗng; đăng xuất; plain không thấy mục, gõ `/reports/profit` ⇒ `/dashboard`. Emulator (Pixel_9_Pro cold boot `-no-snapshot`, serial riêng `emulator-5586`, `verifier_verify_adb_installs` vốn 0 không đổi, `rm /sdcard/ui.xml` trước mỗi dump): Menu → Báo cáo lợi nhuận hiện 4 KPI + nhãn + hàng đúng số, tab Sale ⇒ "Chưa giao người phụ trách", Tuỳ chọn 2 ngày lọc đúng, mở lại app giữ phiên, đăng xuất; plain không có mục Menu. Dọn: tắt đúng emulator 5586, PID npm 13871 + Nest 13970 + vite 14509; xoá chuỗi smoke (2 phiếu + dòng, 2 movement, stock item, dòng/version/đơn, khách, sản phẩm, 9 phiên, 2 account).
- **Câu hỏi mở cho Đại Ca (giữ mặc định của story):** trừ chiết khấu đã duyệt khỏi doanh thu; đơn chỉ công lắp không có mặt; biên % số nguyên.

### File List

**Backend (mới):** `backend/src/dashboard/domain/profit-report.ts`, `backend/src/dashboard/profit-report.service.ts`, `backend/src/dashboard/profit-report.controller.ts`, `backend/src/dashboard/dto/profit-report-query.dto.ts`, `backend/src/dashboard/dto/profit-report-response.dto.ts`, `backend/src/dashboard/dto/profit-report-row.dto.ts`, `backend/src/dashboard/dto/profit-figures.dto.ts`, `backend/test/profit-report.spec.ts`, `backend/test/profit-report.service.spec.ts`, `backend/test/profit-report.e2e.spec.ts`, `backend/test/profit-report.db.integration.spec.ts`
**Backend (sửa):** `backend/src/dashboard/dashboard.module.ts`, `backend/src/dashboard/domain/dashboard-period.ts`, `backend/src/audit/domain/audit-changes.ts`, `backend/openapi/openapi.json` (sinh)
**Web (mới):** `web/src/screens/reports/ProfitReportScreen.tsx`, `web/src/screens/reports/reports.css`, `web/src/design-system/session/profit-report-port.ts`, `web/src/design-system/session/fake-profit-report-port.ts`, `web/src/api/http-profit-report-port.ts`, `web/src/test/profit-report-screen.test.tsx`, `web/src/test/http-profit-report-port.test.ts`
**Web (sửa):** `web/src/main.tsx`, `web/src/app/routes.ts`, `web/src/app/AppRoutes.tsx`, `web/src/design-system/shell/Sidebar.tsx`, `web/src/design-system/gating/permissions.ts`, `web/src/design-system/session/index.ts`, `web/src/api/generated/schema.d.ts` (sinh), `web/src/test/app-routes.test.tsx`, `web/src/test/screens-render.test.tsx`, `web/src/test/composition-root.test.ts`
**Mobile (mới):** `mobile/lib/screens/reports/profit_report_screen.dart`, `mobile/lib/screens/reports/profit_report_cubit.dart`, `mobile/lib/screens/reports/profit_report_state.dart`, `mobile/lib/design_system/session/profit_report_port.dart`, `mobile/lib/design_system/session/fake_profit_report_port.dart`, `mobile/lib/api/http_profit_report_port.dart`, `mobile/lib/api/generated/models/profit_figures_dto.dart`, `mobile/lib/api/generated/models/profit_figures_dto.g.dart`, `mobile/lib/api/generated/models/profit_group_by.dart`, `mobile/lib/api/generated/models/profit_period.dart`, `mobile/lib/api/generated/models/profit_report_response_dto.dart`, `mobile/lib/api/generated/models/profit_report_response_dto.g.dart`, `mobile/lib/api/generated/models/profit_report_row_dto.dart`, `mobile/lib/api/generated/models/profit_report_row_dto.g.dart`, `mobile/lib/api/generated/reports/reports_client.dart`, `mobile/lib/api/generated/reports/reports_client.g.dart`, `mobile/test/screens/reports/profit_report_cubit_test.dart`, `mobile/test/screens/reports/profit_report_screen_test.dart`, `mobile/test/api/http_profit_report_port_test.dart`
**Mobile (sửa):** `mobile/lib/main.dart`, `mobile/lib/app/app_ports.dart`, `mobile/lib/app/app_routes.dart`, `mobile/lib/app/signed_in_app.dart`, `mobile/lib/design_system/shell/app_menu_nav.dart`, `mobile/lib/design_system/gating/app_permissions.dart`, `mobile/lib/api/generated/export.dart` (sinh), `mobile/lib/api/generated/pns_api_client.dart` (sinh), `mobile/test/app/app_routes_test.dart`, `mobile/test/app/signed_in_app_test.dart`, `mobile/test/app/pns_app_test.dart`, `mobile/test/app/support/app_harness.dart`
**Design-system:** `design-system/screens/profit-report.test.mjs` (mới), `design-system/components/menu-nav-parity.test.mjs` (sửa)
**Review (sửa thêm):** `web/src/screens/inventory/format-gio.ts` (`formatPlainDay` dùng chung), `web/src/screens/dashboard/DashboardScreen.tsx` (dùng `formatPlainDay` thay bản sao `viDate`)
**Tài liệu:** `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/8-6-bao-cao-loi-nhuan-gop.md`


## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI review, /ck:code-review + 2 reviewer con web/mobile chỉ đọc) — 2026-10-30
**Kết quả:** Approve sau khi sửa. 0 CRITICAL, 0 HIGH; 2 MEDIUM + 8 LOW — đã sửa hết trừ 2 mục ghi ở dưới.

**Đối chiếu AC 1–7:** đủ. Công thức (AC 2) khớp ca DB với số chạy từ `profitFigures` + `money()` theo nguyên văn AC; trừ chiết khấu đã duyệt (snapshot lúc chốt, `orders.service.ts` confirm) — đúng quyết định đã ghi epics.md. Một đơn tối đa một phiếu xuất: `mo_lai` chỉ đi từ `dachot` (`allowed-transition.ts`), đơn đã xuất không có version mới ⇒ `GROUP BY o.id, sv.id` không nhân đôi.

**Đột biến SQL (cp backup + cmp, lane DB thật cổng 5433):** bỏ `::bigint` doanh thu ⇒ 13/13 ĐỎ; bỏ `::bigint` giá vốn ⇒ 14/14 ĐỎ; bỏ `status <> 'huy'` ⇒ 9 ĐỎ; dòng theo `o.current_version_id` (bỏ version đã xuất) ⇒ 3 ĐỎ; bỏ `- discount` ⇒ 2 ĐỎ; `7 hours`→`0 hours` ⇒ 1 ĐỎ; `>=`→`>` ⇒ 6 ĐỎ; `<`→`<=` ⇒ 4 ĐỎ; bỏ `COALESCE` giá vốn ⇒ 3 ĐỎ (sau sửa, trước XANH). Tương đương (đã chứng minh): bỏ `type = 'xuat'` — CHECK `stock_vouchers_order_only_xuat` của Postgres cấm phiếu khác `xuat` mang `order_id` (thử seed phiếu `nhap` có `order_id` ⇒ DB từ chối); bỏ `order_id IS NOT NULL` — `JOIN orders ON o.id = sv.order_id` đã loại null; bỏ `::bigint` ngoài cùng — `SUM(bigint)` trả `numeric`, `Number()` vẫn đúng. Gate: `@RequirePermissions(PERM.ordersViewAll | dashboardFinanceView)` ⇒ e2e 18/20 ĐỎ.

**Findings đã sửa:**
- [MEDIUM] Lưới `COALESCE(cost_price_snapshot, unit_price_snapshot)` không có test canh (đột biến bỏ COALESCE XANH ⇒ dòng thiếu giá vốn bị tính vốn 0, lãi thổi phồng). Thêm dòng `costPriceSnapshot: null` vào đơn `ISSUED_V1` + ca "a line without a cost snapshot counts at its selling price" (`profit-report.db.integration.spec.ts`).
- [MEDIUM] Tuỳ chọn với ngày kết thúc trước ngày bắt đầu (gõ tay vượt `min/max` trên web; mobile không chặn): gửi đi ⇒ 400 ⇒ màn lỗi toàn phần, "Thử lại" gửi lại đúng khoảng sai, kẹt. Sửa: web `LoadState 'reversedDates'`, mobile `ProfitReportStatus.reversedDates` — không gọi port, hiện câu backend "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.", vẫn bump vé. Test: web 2 ca (chỉ có ngày cuối vẫn chờ; ngày ngược), mobile 2 bloc_test + 1 ca vé trả lời muộn + 1 widget test. Đột biến bỏ chặn / gộp vào `awaitingDates` / bỏ kiểm `from` ⇒ ĐỎ.
- [LOW] `viDate` web sao chép nguyên văn giữa Dashboard và màn mới ⇒ gom thành `formatPlainDay` trong `format-gio.ts`.
- [LOW] Fake port (web + mobile) trả `from = 2026-09-01` cho mọi kỳ ⇒ "Tháng này" hiện 01/09–30/10. Nay `month` ⇒ `2026-10-01`, `year` ⇒ `2026-01-01`.
- [LOW] `ProfitReportResponseDto.groupBy` khai `string` ⇒ `ProfitGroupBy` (OpenAPI + client sinh không đổi — đã regen và so).
- [LOW] Comment `shownGroupBy` không giải thích vì sao có (không test nào canh được một khung hình) ⇒ thêm comment.
- [LOW] Comment code mới mang mã "Story 8.6" và nhãn tiếng Việt ⇒ bỏ mã story, đổi sang tiếng Anh trong 18 file mới/sửa của story (luật 8 + luật "không mã plan trong comment").
- [LOW] Test thiếu: vé trả lời muộn qua đổi kỳ và qua Thử lại (mobile) — đã thêm.

**Không sửa (ghi lý do):**
- [LOW] Ngày xuất trong bảng web dùng `ngayNgan` (`DD/MM`, không năm) — Tuỳ chọn vắt qua năm có thể có hai ngày trùng chữ. Story chỉ định `ngayNgan`; đổi cần Đại Ca chọn (câu hỏi mở 4).
- [LOW] Mobile gõ ngày không có thật (2026-02-30) bị bỏ qua lặng lẽ — cùng hành vi màn Audit 8.5; đổi riêng màn này tạo lệch giữa hai màn, nên để story UX chung.

**Lane sau sửa:** backend `npm test` 139 suite / 2827 xanh; `npm run test:db` 32 / 367 xanh; design-system 554/554; web typecheck + vitest 558/558 + build xanh; mobile `flutter analyze` sạch + `flutter test` 1535 xanh; Prettier + ESLint sạch trên file backend của story; `openapi:gen` + `api:gen` + `generate_api.dart` chạy lại không đổi client sinh. Smoke web/emulator KHÔNG chạy lại cho bản sửa review: các sửa chỉ là trạng thái client chặn khoảng ngày ngược + fake + comment, phủ bằng RTL/widget test và đột biến; smoke đầu-cuối của dev (ghi ở Completion Notes) vẫn là bằng chứng cho luồng chính.

### Change Log

- 2026-10-30: Story 8.6 implemented — `GET /reports/profit` (four groupings, month/year/custom period on the issue date, revenue after approved discount before VAT, only issued non-cancelled orders), web Lợi nhuận screen + mobile Báo cáo lợi nhuận Cubit screen gated on `costs.view`, design-system guard for the mandatory label / no client arithmetic / grouping parity; decisions recorded in epics.md + spine AD-20. Status → review.
- 2026-10-30: Senior Developer Review (AI) — 2 MEDIUM + 6 LOW fixed (null-cost line DB case, reversed custom range blocked on web + mobile, shared plain-day formatter, period-aware demo fakes, typed `groupBy`, story IDs out of comments, late-reply tests); 2 LOW left as open questions. Status → done.
