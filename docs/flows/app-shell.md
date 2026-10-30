# Vỏ ứng dụng: khởi động, định tuyến, menu và ports

> Flow `app-shell`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow app-shell` in ra đúng danh sách đó.

## Mục đích

Lớp nối các màn của cả hai client với nhau, không chứa nghiệp vụ:

- **Composition root**: nơi duy nhất dựng adapter thật và đưa xuống cây widget/component. Màn và application layer chỉ nhận port,
  không tự tạo adapter (AD-12).
- **Định tuyến và gating**: đường dẫn nào mở được, theo quyền của tài khoản. Menu, thanh điều hướng và router cùng đọc MỘT bảng dữ liệu,
  nên không có bảng quyền thứ hai để lệch.
- **Phase phiên**: đăng nhập / quên mật khẩu / đã đăng nhập, do session giữ (xem flow `auth-session`).

Quyền được đọc từ `/me` (flow `accounts-permissions`); vỏ không tự suy quyền từ vai trò.

## Điểm vào

Mobile (Flutter):

- `mobile/lib/main.dart` — composition root DUY NHẤT: dựng session store → transport → client sinh tự động → các HTTP adapter →
  `AppPorts` → `PnsApp`. Đây là nơi duy nhất trong mobile tạo port thật.
- `mobile/lib/app/pns_app.dart` — `PnsApp`: render theo phase phiên (Đăng nhập, Quên mật khẩu, hoặc app đã đăng nhập);
  chỉ thấy port, không thấy token hay HTTP.
- `mobile/lib/app/signed_in_app.dart` — `SignedInApp`: router của mọi màn đã đăng nhập, dựng sau khi biết quyền (`/me`).

Web:

- `web/src/main.tsx` (điểm vào chung với `auth-session`) dựng adapter và truyền `AppPorts` xuống.
- `web/src/app/AppRoutes.tsx` — application layer: route, gating và điều hướng sidebar; nhận port từ composition root, không tự dựng adapter.

## Các bước

**A. Khởi động mobile**

1. `mobile/lib/main.dart` tạo `SessionStore` (access token trong bộ nhớ, refresh token trong secure storage — flow `api-client`), `Transport`, client sinh tự động, các `Http*Port`.
2. Gom mọi port vào `AppPorts` (`mobile/lib/app/app_ports.dart`) — 15 port: `me`, `password`, `customers`, `warranty`, `catalog`, `orders`,
   `inventory`, `stockVouchers`, `payments`, `contracts`, `invoices`, `dashboard`, `accounts`, `auditLogs`, `profitReport`.
   Phiên đăng nhập do `SessionCubit` giữ qua `AuthPort`, nên không nằm trong `AppPorts`.
3. `mobile/lib/app/session_cubit.dart` (flow `auth-session`) khôi phục phiên lúc khởi động và quyết định phase; `PnsApp` render theo phase.
4. Khi đã đăng nhập, `SignedInApp` đọc `/me`, rồi chỉ dựng các route mà quyền cho phép.

**B. Định tuyến và gating mobile**

1. `mobile/lib/design_system/shell/app_menu_nav.dart` là dữ liệu menu (bản Dart của `SIDEBAR_NAV` web): `kMobileMenu` (các mục của trang Menu) và `kMobileTabLinks` (các tab dưới), mỗi mục có khoá và quyền.
   Thanh điều hướng dưới bị khoá ở 5 tab (UX-DR-15), nên gating diễn ra ở danh sách Menu.
2. `mobile/lib/app/app_routes.dart` đọc CHÍNH `kMobileMenu` và `kMobileTabLinks` để quyết định đường dẫn nào thuộc khoá nào và khoá nào mở được (không có bảng quyền thứ hai);
   các hằng `k…Path` (ví dụ `kHomePath = '/dashboard'`, `kProfitReportPath = '/reports/profit'`, `kAccountNewPath`) là đường dẫn duy nhất.
3. `mobile/lib/screens/menu/menu_screen.dart` (+ `menu_cubit.dart`): trang Menu liệt kê mục mà tài khoản được mở, cùng đăng xuất.

**C. Định tuyến web**

1. `web/src/app/routes.ts`: `NAV_ROUTES` là bảng khoá ⇄ đường dẫn (`home` → `/dashboard`, `orders` → `/orders`, `profit` → `/reports/profit`,
   `permissions` → `/permissions`, `audit` → `/audit`, `profile` → `/profile`, …); `AVAILABLE_NAV_KEYS` là tập khoá; `pathOfKey` tra ngược.
2. Một route mở khi `filterNav(SIDEBAR_NAV, perms)` còn có link mang đúng khoá đó: không có bảng quyền thứ hai.
3. Chưa đăng nhập: `SignedOutRoutes` chỉ mở Đăng nhập và Quên mật khẩu; mọi đường dẫn khác về Đăng nhập.
4. `/`, đường dẫn lạ hoặc đường dẫn bị gate chặn ⇒ về route mở được đầu tiên, không có thì về Hồ sơ.
5. `AppPorts` (web, `AppRoutes.tsx`) gồm 18 port: `auth`, `me`, `password`, `customers`, `customerSources`, `catalog`, `settings`,
   `warranty`, `orders`, `inventory`, `stockVouchers`, `payments`, `contracts`, `invoices`, `dashboard`, `accounts`, `auditLogs`, `profitReport`.

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| Chỉ composition root dựng adapter thật (mobile: `main.dart`; web: `main.tsx`) | cấu trúc + guard | `mobile/test/app/composition_root_test.dart`, `web/src/test/composition-root.test.ts` |
| Route và mục menu cùng đọc một bảng; không có bảng quyền riêng cho router | `app_routes.dart` đọc `app_menu_nav.dart` (`kMobileMenu`, `kMobileTabLinks`); `routes.ts` (`NAV_ROUTES`, `filterNav`) | `mobile/test/app/app_routes_test.dart`, `web/src/test/app-routes.test.tsx`, `design-system/components/menu-nav-parity.test.mjs` |
| Chưa đăng nhập không thấy route nào ngoài Đăng nhập và Quên mật khẩu | `SignedOutRoutes` (web), `PnsApp` (mobile) | `mobile/test/app/pns_app_test.dart`, `web/src/test/app-entry.test.tsx` |
| Màn không tự gọi mạng; port đang chờ mà màn bị huỷ không làm lỗi | cấu trúc; guard cho từng màn | `mobile/test/app/unmount_while_port_pending_test.dart`, `mobile/test/screens/unmount_while_port_pending_menu_screens_test.dart` |
| Mục menu và tab bị gate theo quyền | `filterNav`, `kMobileMenu` | `mobile/test/screens/menu/menu_screen_test.dart`, `web/src/test/sidebar-nav-context.test.tsx` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `mobile/lib/main.dart` | Composition root mobile (dựng adapter thật, một lần) | `main` |
| `mobile/lib/app/pns_app.dart` | Shell theo phase phiên | `PnsApp` |
| `mobile/lib/app/signed_in_app.dart` | Router mọi màn đã đăng nhập | `SignedInApp` |
| `mobile/lib/app/app_chrome.dart` | Khung chung của mọi trang (Scaffold cho ô nhập và bàn phím) | `appPage`, `SessionSkeleton` |
| `mobile/lib/app/app_ports.dart` | Gom 15 port thành một giá trị | `AppPorts` |
| `mobile/lib/app/app_routes.dart` | Bảng đường dẫn và gating (đọc dữ liệu menu) | các hằng `k…Path` (ví dụ `kHomePath`, `kProfitReportPath`) |
| `mobile/lib/design_system/shell/app_menu_nav.dart` | Dữ liệu menu (bản Dart của `SIDEBAR_NAV`) | `kMobileMenu`, `kMobileTabLinks` |
| `mobile/lib/screens/menu/menu_screen.dart`, `mobile/lib/screens/menu/menu_cubit.dart` | Trang Menu | `MenuScreen`, `MenuCubit` |
| `web/src/app/AppRoutes.tsx` | Route, gating, điều hướng sidebar; `AppPorts` | `AppRoutes`, `SignedOutRoutes`, `AppPorts` |
| `web/src/app/routes.ts` | Bảng khoá ⇄ đường dẫn | `NAV_ROUTES`, `AVAILABLE_NAV_KEYS`, `pathOfKey`, `LOGIN_PATH` |

Các cubit và state của `mobile/lib/app/session_cubit.dart` và `session_state.dart` thuộc flow `auth-session`.

## Dữ liệu

- Không có dữ liệu bền. Trạng thái chỉ là phase phiên và trang đang mở trong bộ nhớ.
- Quyền tươi từ `/me` (flow `accounts-permissions`), đọc khi vào app đã đăng nhập.
- Gọi ngoài: không có. Mọi I/O đi qua port.

## Flow liên quan

- auth-session: phase phiên, đăng nhập, `SessionCubit`, `AuthPort`.
- accounts-permissions: `/me` và khoá quyền; `design-system` gating (`Gate`, `Gate.tsx`).
- api-client: transport và session store đứng sau mọi port thật.
- design-system: shell (`WebShell`, `AppMobileShell`, `AppBottomNav`), `SIDEBAR_NAV`.
- Mọi flow nghiệp vụ: mỗi màn được đăng ký trong bảng route tại đây.

## Tests

Mobile:

- `mobile/test/app/app_routes_test.dart`, `mobile/test/app/order_routes_test.dart`: bảng đường dẫn, gating, route đơn hàng.
- `mobile/test/app/composition_root_test.dart`: cấu trúc composition root.
- `mobile/test/app/pns_app_test.dart`, `mobile/test/app/signed_in_app_test.dart`: render theo phase và router đã đăng nhập.
- `mobile/test/app/unmount_while_port_pending_test.dart`, `mobile/test/screens/unmount_while_port_pending_menu_screens_test.dart`: huỷ màn khi port chưa trả lời.
- `mobile/test/screens/menu/menu_cubit_test.dart`, `mobile/test/screens/menu/menu_screen_test.dart`, `mobile/test/screens/menu_screens_cubit_wiring_test.dart`.

Web:

- `web/src/test/app-entry.test.tsx`, `web/src/test/app-routes.test.tsx`, `web/src/test/sidebar-nav-context.test.tsx`, `web/src/test/composition-root.test.ts`.

Guard chung:

- `design-system/components/menu-nav-parity.test.mjs`: menu web và mobile có cùng mục và cùng khoá.
