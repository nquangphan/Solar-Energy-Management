# Dashboard vận hành và báo cáo lãi gộp

> Flow `dashboard-reports`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow dashboard-reports` in ra đúng danh sách đó.

## Mục đích

Hai màn đọc, không ghi, không event, không audit:

- **Dashboard vận hành** (FR-19, Trang chủ): trong kỳ `day` / `week` / `month` (theo giờ Việt Nam, kết thúc hôm nay):
  tiền đã thu, số đơn tạo mới, và số đơn theo từng trạng thái.
- **Báo cáo lãi gộp trên vật tư** (FR-37, AD-20): MỘT bảng lợi nhuận gộp của các đơn đã xuất kho, gom theo đơn, theo tháng,
  theo người phụ trách hoặc theo nguồn khách. Kỳ là tháng này, năm nay hoặc khoảng tự chọn.

Backend tính mọi con số (AD-2); web và mobile chỉ hiển thị. Hai khối của dashboard được gate riêng và trả `null` khi thiếu quyền,
và truy vấn tương ứng không chạy.

## Điểm vào

HTTP (JWT; `PermissionsGuard` toàn cục):

- `GET /dashboard/summary?period=day|week|month` — `DashboardController.summary`, mặc định `month`.
  `@RequireAnyPermissions(orders.view_all, orders.view_own, dashboard.finance_view)`. `period` khác ⇒ 400 `VALIDATION_ERROR`.
- `GET /reports/profit?groupBy=order|month|assignee|source&period=month|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD` —
  `ProfitReportController.profit`, `@RequirePermissions(costs.view)`. Mặc định `groupBy=order`, `period=month`.
  Kỳ `custom` cần đủ `from` và `to` theo thứ tự; gửi ngày cùng kỳ preset bị từ chối, không bị bỏ qua lặng lẽ.

Màn hình:

- Web: `DashboardScreen` (`web/src/screens/dashboard/DashboardScreen.tsx`) và `ProfitReportScreen` (`web/src/screens/reports/ProfitReportScreen.tsx`).
- Mobile: `DashboardScreen` + `DashboardCubit` (`mobile/lib/screens/dashboard/`), `ProfitReportScreen` + `ProfitReportCubit` (`mobile/lib/screens/reports/`).
- Biểu đồ cột: `BarChart` (web) và `bar_chart.dart` (mobile) trong design system; vẽ số đếm, không tính.

## Các bước

**A. Dashboard**

1. `backend/src/dashboard/dashboard.controller.ts` → `summary` gọi `DashboardService.summary` với scope đơn của người gọi
   (`OrdersService.scopeWhere`, cùng phạm vi với `GET /orders`) và quyền tươi (`AccountPermissionsService`).
2. `backend/src/dashboard/dashboard.service.ts` → `summary`: `dashboard.finance_view` ⇒ tính `revenue` bằng `revenue(from, to)`, không thì `null`
   và không chạy truy vấn tiền; có quyền xem đơn ⇒ đếm đơn tạo trong kỳ và đếm theo trạng thái, không thì `null`.
3. `backend/src/dashboard/domain/dashboard-period.ts`: kỳ = từ hôm nay trở về trước (`day`: hôm nay; `week`: thứ Hai → hôm nay;
   `month`: ngày 1 → hôm nay), theo UTC+7 (quyết định G-6).
4. `revenue` là tiền ĐÃ THU trong kỳ, cộng trên toàn công ty (không lọc theo phạm vi), đọc từ `payments.paid_on` (DATE đã là ngày Việt Nam).
   Tổng có thể vượt INT4 nên đọc `bigint` và đổi thành `number` đúng một chỗ.
5. Số theo trạng thái là ảnh chụp toàn bộ phễu, KHÔNG lọc theo kỳ.

**B. Báo cáo lãi gộp**

1. `backend/src/dashboard/profit-report.controller.ts` → `profit` gọi `ProfitReportService.report`.
2. `backend/src/dashboard/profit-report.service.ts` → `report`: một truy vấn duy nhất (không N+1), chỉ đọc. Đơn được tính khi và chỉ khi
   có phiếu xuất kho và không bị huỷ; dòng lấy theo version của PHIẾU XUẤT, không theo `current_version_id`; kỳ lọc theo ngày xuất.
   Toàn công ty: chỉ `costs.view` là cổng, phạm vi đơn không thu hẹp.
3. Trong SQL: `::bigint` đặt TRƯỚC phép nhân (`int4 * int4` tràn trên dòng trên 2.147.483.647 đồng); doanh thu trừ chiết khấu đã duyệt
   chụp trên version, trước VAT; dòng không có ảnh giá vốn thì lấy giá bán (lợi nhuận 0, không bị thổi phồng).
4. `backend/src/dashboard/domain/profit-report.ts` (thuần): `profitFigures` (doanh thu, giá vốn, lãi gộp, biên %, số đơn),
   `profitTotals`, `groupProfitRows` theo bốn cách gom; nhãn dòng dựng ở đây để web và mobile in cùng chữ.
   Người phụ trách trống ⇒ `UNASSIGNED_LABEL` ("Chưa giao người phụ trách").
5. Kỳ `month` / `year` là từ ngày 1 (hoặc 1/1) đến hôm nay; `custom` nhận đủ hai ngày, cả hai đều được tính (bao gồm ngày cuối).

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| Không có quyền tài chính ⇒ `revenue` là `null` và truy vấn tiền không chạy | `DashboardService.summary` | `dashboard.service.spec.ts` ("without dashboard.finance_view …"), `dashboard.e2e.spec.ts` ("THI_CONG … no money query runs") |
| Không có quyền xem đơn ⇒ số đơn là `null` và không có truy vấn đơn | `DashboardService.summary` | `dashboard.service.spec.ts` ("without any order read permission …") |
| Báo cáo lãi gộp chỉ đọc: không ghi, không event, không khoá | `ProfitReportService` | `profit-report.service.spec.ts` ("runs exactly one query …") |
| Đơn tính lãi = đơn có phiếu xuất và chưa huỷ; dòng lấy theo version của phiếu xuất | SQL trong `profit-report.service.ts` | `profit-report.db.integration.spec.ts` |
| Phép nhân tiền ép `bigint` trước; không tràn trên dòng lớn | SQL `::bigint` | `profit-report.db.integration.spec.ts`, `profit-report.spec.ts` |
| Lãi gộp không trừ chiết khấu vào giá vốn; dòng lắp đặt có doanh thu và giá vốn nhưng không có lãi | `profitFigures`, `profitTotals` | `profit-report.spec.ts` |
| Thiếu `costs.view` ⇒ 403 và không đọc gì | decorator `@RequirePermissions(costs.view)` | `profit-report.e2e.spec.ts` ("every order and finance permission but costs.view ⇒ 403") |
| Quyền được đọc tươi mỗi request | `AccountPermissionsService` | `profit-report.e2e.spec.ts` ("permissions are read fresh on every request") |
| Client không tính lại số liệu | text-guard màn | `design-system/screens/dashboard.test.mjs`, `design-system/screens/profit-report.test.mjs` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/dashboard/dashboard.controller.ts` | Route `GET /dashboard/summary` | `DashboardController.summary` |
| `backend/src/dashboard/dashboard.service.ts` | Tính khối dashboard, gate từng khối | `DashboardService` (`summary`, `revenue`) |
| `backend/src/dashboard/dashboard.module.ts` | Module; import `OrdersModule` (scope đơn) và `AccountsModule` (quyền tươi) | `DashboardModule` |
| `backend/src/dashboard/domain/dashboard-period.ts` | Kỳ dashboard và khoảng ngày UTC+7 | `DASHBOARD_PERIODS`, `DashboardPeriod` |
| `backend/src/dashboard/dto/dashboard-summary-query.dto.ts`, `dashboard-summary-response.dto.ts`, `dashboard-status-count.dto.ts` | Query và response dashboard | `DashboardSummaryQueryDto`, `DashboardSummaryResponseDto`, `DashboardStatusCountDto` |
| `backend/src/dashboard/profit-report.controller.ts` | Route `GET /reports/profit` | `ProfitReportController.profit` |
| `backend/src/dashboard/profit-report.service.ts` | Truy vấn đơn đã xuất, gom nhóm | `ProfitReportService` (`report`, `issuedOrders`) |
| `backend/src/dashboard/domain/profit-report.ts` | Công thức lãi gộp, gom nhóm, nhãn (thuần) | `profitFigures`, `profitTotals`, `groupProfitRows`, `PROFIT_GROUP_BY`, `PROFIT_PERIODS`, `UNASSIGNED_LABEL`, `OrderProfitRow`, `ProfitGroupRow` |
| `backend/src/dashboard/dto/profit-report-query.dto.ts`, `profit-report-response.dto.ts`, `profit-report-row.dto.ts`, `profit-figures.dto.ts` | Query và response báo cáo | `ProfitReportQueryDto`, `ProfitReportResponseDto`, `ProfitReportRowDto`, `ProfitFiguresDto` |
| `mobile/lib/screens/dashboard/dashboard_screen.dart`, `dashboard_cubit.dart`, `dashboard_state.dart` | Trang chủ mobile | `DashboardScreen`, `DashboardCubit` |
| `mobile/lib/screens/reports/profit_report_screen.dart`, `profit_report_cubit.dart`, `profit_report_state.dart` | Báo cáo lãi gộp mobile | `ProfitReportScreen`, `ProfitReportCubit` |
| `mobile/lib/design_system/session/dashboard_port.dart`, `fake_dashboard_port.dart`, `profit_report_port.dart`, `fake_profit_report_port.dart` | Port và fake mobile | `DashboardPort`, `ProfitReportPort`, `DashboardPortException`, `ProfitReportPortException` |
| `mobile/lib/api/http_dashboard_port.dart`, `mobile/lib/api/http_profit_report_port.dart` | Port thật qua client sinh tự động | `HttpDashboardPort`, `HttpProfitReportPort` |
| `mobile/lib/design_system/components/bar_chart.dart` | Biểu đồ cột (design system) | `AppBarChart` |
| `web/src/screens/dashboard/DashboardScreen.tsx`, `web/src/screens/dashboard/dashboard.css` | Trang chủ web và style | `DashboardScreen` |
| `web/src/screens/reports/ProfitReportScreen.tsx`, `web/src/screens/reports/reports.css` | Báo cáo lãi gộp web và style | `ProfitReportScreen` |
| `web/src/design-system/session/dashboard-port.ts`, `fake-dashboard-port.ts`, `profit-report-port.ts`, `fake-profit-report-port.ts` | Port và fake web | `DashboardPort`, `ProfitReportPort`, `FakeDashboardPort`, `FakeProfitReportPort` |
| `web/src/api/http-dashboard-port.ts`, `web/src/api/http-profit-report-port.ts` | Port thật web | `HttpDashboardPort`, `HttpProfitReportPort` |
| `web/src/design-system/components/BarChart.tsx` | Biểu đồ cột web (design system) | `BarChart` |

## Dữ liệu

- Không có bảng mới. Dashboard đọc `orders`, `payments` (theo `paid_on`). Báo cáo lãi đọc, trong một câu SQL:
  `stock_vouchers` (phiếu xuất), `order_versions` (version của phiếu), `order_line_items` (dòng của version, kèm ảnh giá vốn),
  `orders`, `customers`, `customer_sources` và `accounts` (nhóm và nhãn).
- Đọc từ flow khác: `orders` (scope, phiếu xuất), `customers` và `customer-sources` (nhóm theo nguồn), `accounts-permissions` (quyền tươi).
- Sự kiện: không có. Không ghi audit.
- Gọi ngoài: không có.

## Flow liên quan

- orders: phạm vi đơn (`scopeWhere`) và trạng thái đơn.
- inventory: phiếu xuất kho là điều kiện đưa một đơn vào báo cáo lãi.
- payments: số tiền đã thu trên dashboard.
- accounts-permissions: `dashboard.finance_view`, `costs.view`, `orders.view_*`.
- design-system: `BarChart` và token; text-guard của màn.

## Tests

Backend, hermetic (`npm test`):

- `backend/test/dashboard-period.spec.ts`: kỳ `day` / `week` / `month` theo UTC+7 (gồm 31/12 giờ UTC).
- `backend/test/dashboard.service.spec.ts`: gate từng khối; phạm vi `view_own` gắn đúng `scopeWhere`; truy vấn tiền bị chặn theo kỳ.
- `backend/test/dashboard.e2e.spec.ts`: HTTP; 401 khi thiếu token; 400 cho `period` không hợp lệ; ba vai trò với bộ quyền khác nhau.
- `backend/test/profit-report.spec.ts`: bốn cách gom, ba kỳ, chiết khấu, dòng lắp đặt, làm tròn biên.
- `backend/test/profit-report.service.spec.ts`: một truy vấn; mặc định; kỳ năm; kỳ tự chọn gồm cả ngày cuối.
- `backend/test/profit-report.e2e.spec.ts`: HTTP; 403 khi thiếu `costs.view` dù có mọi quyền khác; quyền đọc tươi.

Backend, lane DB (`*.db.integration.spec.ts`, `npm run test:db`):

- `backend/test/dashboard.db.integration.spec.ts`, `backend/test/profit-report.db.integration.spec.ts`: truy vấn của dashboard và báo cáo lãi chạy trên Postgres thật.

Web, mobile và guard giao diện:

- `design-system/screens/dashboard.test.mjs`, `design-system/screens/profit-report.test.mjs`: text-guard của màn.
- `web/src/test/dashboard-screen.test.tsx`, `web/src/test/profit-report-screen.test.tsx`, `web/src/test/bar-chart.test.tsx`, `web/src/test/http-dashboard-port.test.ts`, `web/src/test/http-profit-report-port.test.ts`.
- `mobile/test/screens/dashboard/dashboard_cubit_test.dart`, `mobile/test/screens/dashboard/dashboard_screen_test.dart`, `mobile/test/screens/reports/profit_report_cubit_test.dart`, `mobile/test/screens/reports/profit_report_screen_test.dart`, `mobile/test/api/http_dashboard_port_test.dart`, `mobile/test/api/http_profit_report_port_test.dart`.
