---
baseline_commit: 47761e7
---

# Story 10.7: Mobile: điều hướng và adapter danh mục, khách, tài khoản

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a nhân viên hiện trường,
I want chuyển giữa các tab và màn có sẵn với dữ liệu thật, chỉ thấy mục có quyền,
so that tra khách, danh mục, bảo hành ngay tại công trình.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Story này là **bản sao mobile của web 10.4** (composition root + router + adapter me/password/customers/catalog/warranty) đặt trên nền **10.6** (transport, phiên, `PnsApp`, `main.dart`). Khuôn web đã qua review + smoke — **chép luật, không chép cú pháp**. Đọc trước: `web/src/api/http-{me,password,customers,catalog,warranty}-port.ts`, `web/src/app/routes.ts`, `web/src/test/composition-root.test.ts`, story `10-4-…md` (Tinh chỉnh + Senior Review) và `10-6-…md` (§7 D8–D13, Senior Review "Ghi cho 10.7").

### 1. Hiện trạng (scout 2026-10-22, sau commit `47761e7` = Story 10.6 done)

| Bề mặt | Hiện trạng |
|---|---|
| `mobile/lib/main.dart` | Composition root duy nhất: `SessionStore` → `Transport` → `PnsApiClient(transport.dio)` → `HttpAuthPort` → `PnsApp(auth, sessionExpired)`. `ConfigErrorApp` khi thiếu `API_BASE_URL`. Không import fake/barrel |
| `mobile/lib/app/pns_app.dart` | `MaterialApp(home: AppPhoneFrameScope(bare: true, child: Scaffold(...)))`; phase `restoring → signedOut ↔ signedIn`; signedIn = trang tạm "Đã đăng nhập." + Đăng xuất (cờ `_loggingOut`). Comment: "Story 10.7 replaces the signed-in surface with go_router + PermissionsProvider" |
| `mobile/lib/api/` | `transport.dart` (Dio duy nhất, Bearer, envelope → `ApiError`, refresh single-flight, `call<T>()` gỡ `DioException` để adapter không import dio), `api_error.dart`, `session_store.dart`, `http_auth_port.dart`, `generated/**` (11 client, 139 model) |
| Port trong phạm vi (`lib/design_system/session/`) | `me_port.dart` (`MeResponse` **khai tay**, TODO thay bằng type sinh), `password_port.dart` (3 method), `customers_port.dart` (`Customer`/`CustomerSource`/`CustomerLookup`/`CustomerPage`/`CreateCustomerInput` **khai tay, tên cũ** `sdt`, `cccd`; `CustomerPortException(message, fieldErrors: Map)`), `catalog_port.dart` (`CatalogProduct`/`CatalogGroup`/`CatalogGroupItem`/`CatalogGroupDetail` khai tay, `int`), `warranty_port.dart` (`WarrantyLookup.sdt`, `WarrantyCustomer.sdt`, `WarrantyOrder.chotAt` **tên cũ**, ngày là `String`, `warrantyStatus` là `String`; `WarrantyPortException`). Fake tương ứng `fake_*_port.dart` cùng thư mục, re-export qua barrel `session.dart` |
| `PermissionsProvider` (`app_session.dart`) | `InheritedWidget` `PermissionsScope {status, perms, me}`; gọi `MePort.fetchMe()` **một lần** trong `initState`; lỗi ⇒ `SessionStatus.error`. **Chưa ai dựng nó ở app thật** |
| Màn trong phạm vi | `screens/customers/{customer_list,customer_detail,customer_pick}_screen.dart`, `screens/warranty/warranty_lookup_screen.dart`, `screens/account/profile_screen.dart` (đọc `PermissionsScope.of(context).me`, port `PasswordPort`), `screens/auth/forgot_password_screen.dart` (port `PasswordPort`, `onBackToLogin`). **Không có màn Menu, không có màn Trang chủ** trên mobile |
| `AppBottomNav` (`shell/app_bottom_nav.dart`) | Khoá 5 tab (UX-DR-15), `onSelect`/`onCreateQuote` tuỳ chọn. **18 màn** tự dựng `const AppBottomNav(activeIndex: …)` **không callback** ⇒ bấm tab hiện không làm gì. Hằng `kMenuTabIndex = 4` (customer_pick), `kOrdersTabIndex = 1` (discount_approval), `kInventoryTabIndex = 3` (inventory), `_menuTabIndex = 4` (profile) |
| Gating (`gating/app_permissions.dart`) | `AppNavLink {key,label,icon,requires}` — **không có `requiresAny`** (web có, `permissions.ts:47`); `filterNav` chỉ xét `requires`. `kMenuSections` hiện chỉ là DEMO trong `app_session_gating_example.dart` (Phân quyền/Audit/Hồ sơ) — guard parity ghim file demo đó, **không sửa nó** |
| Lỗi tới màn | Màn bắt **nominal**: `err is CustomerPortException ? err.message : …`, `err is WarrantyPortException`; Hồ sơ/Quên mật khẩu `catch (_)` ⇒ câu chung. Adapter HTTP sẽ nhận `ApiError` từ `transport.call` |
| Client sinh (khác tay ở chỗ nào) | Số là `num` (không `int`); ngày là `DateTime`; `CreateCustomerRequestDto.custType` là enum `CreateCustomerRequestDtoCustType`; `WarrantyLineItemDto.warrantyStatus` là enum `WarrantyLineItemDtoWarrantyStatus`; `CustomerSourceResponseDto` có thêm `active`; `ProductResponseDto` có `costPrice` |
| Retrofit sinh path | `'/customers/${phone}'` — **KHÔNG encode** tham số path (bẫy 4) |
| Guard design-system đang đọc file mobile | `session/parity.test.mjs` (bảng file đôi; dòng 435–457 warranty đọc tên field **trong text** `warranty_port.dart`; dòng 466–510 `dinhDangNgay` phải `substring(0, 10)`; dòng 520 `final MeResponse? me;`), `screens/customers.test.mjs:398–417` (bảng `WEB_TO_MOBILE_FIELD = { nationalId: 'cccd' }` — **xoá ở 10.7**), `screens/{profile,forgot-password,warranty-lookup,customers,orders}.test.mjs`, `lib/web-mobile-contract-map.mjs` (của đơn/kho — **không đụng**, xoá ở 10.8) |
| Toolchain | Flutter **3.35.0 / Dart 3.9.0**. Lane baseline: `flutter test` **523** xanh, `flutter analyze` sạch; design-system **497**; web **432** |

### 2. 🔥 BẪY SỐ 1 — `go_router` mới nhất KHÔNG cài được trên Flutter 3.35

Đo pub.dev 2026-10-22: `go_router 18.x` cần **Dart ^3.12 / Flutter ≥ 3.44**; `17.3.0–17.5.0` cần Dart ^3.10 / Flutter ≥ 3.38; **`17.2.3` là bản cuối chạy được** (Dart ^3.9.0, Flutter ≥ 3.35.0, phát hành 2026-05-01).

- Thêm bằng `flutter pub add go_router:^17.2.3` (pub tự chọn 17.2.3). **Cấm** nâng Flutter, **cấm** `dependency_overrides`. Ghi version thật vào Debug Log và vào bullet G-5 của epics.md.
- `pubspec.lock` commit cùng story; `mobile/.flutter-plugins-dependencies` nếu đổi thì commit (giữ track như 10.6).
- KHÔNG chạy `dart format` toàn package (memory `dart-format-writes-files-cascade`) — chỉ format file mình tạo/sửa, kiểm bằng `-o none`.

### 3. 🔥 BẪY SỐ 2 — type sinh ≠ type khai tay: đổi tên **và** đổi kiểu

AD-12 + AC-4: port mobile dùng **type sinh** (như web 10.4 dùng alias `Schemas['…']`). Dart: `typedef Customer = CustomerResponseDto;`. Kéo theo:

| Đổi | Ở đâu bị ảnh hưởng | Phải làm |
|---|---|---|
| `sdt` → `phone`, `cccd` → `nationalId` (Customer, CreateCustomerInput, CustomerLookup) | 3 màn khách, fake, test | Đổi caller; **method port giữ tên** (`lookup(String sdt)` → đổi tên tham số thành `phone` cho đồng bộ web? — web vẫn `lookup(sdt: string)`; **giữ `sdt`** tên tham số để guard parity dòng 435 không đổi, chỉ đổi field) |
| `WarrantyLookup.sdt`/`WarrantyCustomer.sdt` → `phone`; `WarrantyOrder.chotAt` → `confirmedAt` | màn bảo hành, fake, test | Đổi caller |
| Ngày `String` → `DateTime` (`warrantyStartAt`, `warrantyEndAt`, `confirmedAt`, `createdAt`) | `dinhDangNgay(String?)` | Đổi thành `dinhDangNgay(DateTime? d)` = `d == null ? '—' : d.toUtc().toIso8601String().substring(0, 10)` rồi đảo `DD/MM/YYYY` như cũ. **KHÔNG `toLocal()`** — `warrantyEndAt` là `00:00:00Z`, đổi sang giờ máy (UTC+7) vẫn cùng ngày nhưng `…T17:00:00Z` sẽ nhảy ngày. Fake dựng ngày bằng **`DateTime.utc(…)`** (dùng `DateTime(…)` local thì `toUtc()` lùi 7 giờ ⇒ lùi một ngày ⇒ test đỏ đúng chỗ, nhưng đừng "sửa" bằng cách bỏ `toUtc()`). Guard parity dòng 487 (`substring(0, 10)`, `'—'`) vẫn xanh không sửa |
| `int` → `num` (`remainingDays`, `remainingMonths`, `warrantyMonths`, `sortOrder`, `total/page/pageSize`, `expiresInSeconds`) | `formatWarrantyMonths(int)`, so sánh `>= 1`, countdown | Chuyển `.toInt()` ở **điểm dùng** (giá trị là số nguyên từ backend). Guard parity dòng 510 (`remainingMonths >= 1`, `remainingDays > 0`) phải vẫn khớp nguyên văn — viết `line.remainingMonths >= 1`, không bọc biểu thức khác. Guard dòng 425 (`~/ 12`) giữ |
| `warrantyStatus` `String` → enum `WarrantyLineItemDtoWarrantyStatus` | `switch (line.warrantyStatus)` | `switch` theo enum; nhánh `$unknown` ⇒ nhãn/màu trung tính (backend thêm giá trị mới không crash) — có test |
| `CreateCustomerInput.custType` → enum `CreateCustomerRequestDtoCustType` | customer_pick `_custType` (String `kCaNhan`/`kThuongMai`) | Map ở chỗ dựng input: `CreateCustomerRequestDtoCustType.fromJson(_custType)`. Response `Customer.custType` vẫn `String` (spec không khai enum) |
| `CustomerSource` có thêm `active` | select tạo khách | Giữ hành vi web 10.4: `listSources()` gọi `includeInactive: true` (chi tiết/tra cứu vẫn ra tên nguồn đã tắt), **select tạo khách chỉ hiện nguồn `active`** — `customer_pick_screen.dart:411` hiện lặp **mọi** `_sources` (fake chỉ trả nguồn đang bật nên chưa lộ) ⇒ thêm lọc `source.active` ở select, `CustomerFacts` vẫn tra tên trên toàn bộ danh sách; widget test với một nguồn `active: false` |
| `MeResponse` | `PermissionsScope.me`, Hồ sơ | `typedef MeResponse = MeResponseDto;` — field trùng tên, không đổi caller. Guard dòng 520 `final MeResponse? me;` giữ |
| Catalog | `CatalogProduct` web là `Pick<…>` (bỏ `costPrice`); Dart **không có Pick** | `CatalogGroupItem` = `typedef … = ProductGroupItemResponseDto;` (web alias nguyên). `CatalogProduct`, `CatalogGroup`, `CatalogGroupDetail` **giữ class chiếu hẹp** (lý do tồn tại: không mang `costPrice` — header comment ghi rõ là *projection*, không phải bản chép DTO); adapter dựng **từng field** từ DTO sinh, đổi `num` → `int` bằng `.toInt()` cho `price`/`warrantyMonths` (để `create_quote_screen.dart` không đổi). Guard (AC-12) kiểm field của projection ⊂ property của DTO trong spec và **không có `costPrice`** |

Mọi typedef **phải** trỏ type trong `lib/api/generated/models/` — tức `design_system/session/*_port.dart` sẽ import `../../api/generated/models/…dart`. Đây là hướng phụ thuộc web cũng có (`design-system/session/*.ts` import `api/generated/schema`), chấp nhận. **Không** import `package:dio` hay `transport.dart` từ `design_system/`.

### 4. 🔥 BẪY SỐ 3 — lỗi nominal: `ApiError` không phải `CustomerPortException`

Màn kiểm `err is CustomerPortException` / `err is WarrantyPortException`. Adapter HTTP nhận `ApiError` ⇒ nếu ném thẳng, màn rơi vào nhánh câu chung và **mất** `message` + `fieldErrors` của backend (vd "Số điện thoại đã tồn tại" dưới ô SĐT) — mọi lane vẫn xanh vì test màn dùng fake.

**Cách làm (mặc định tuyên bố trước, D3):** adapter đổi lỗi **ở một chỗ mỗi adapter** — `transport.call` → `on ApiError catch (e) => throw CustomerPortException(e.message, fieldErrors: fieldErrorMap(e))`. Thêm `Map<String, String> fieldErrorMap(ApiError e)` vào `lib/api/api_error.dart` (field → message, **giữ message đầu tiên** của mỗi field, giống web). Không đổi màn, không đổi chữ ký port. `PasswordPort`/`MePort`/`CatalogPort` không có kiểu lỗi riêng ⇒ ném nguyên `ApiError` (màn đang `catch (_)`). Khuôn này là khuôn 10.8 dùng cho `OrderPortException`/`PaymentsPortError`/… — viết gọn, đặt tên rõ.

Test adapter (AC-3) phải chứng minh **qua màn hoặc qua kiểu**: ca lỗi envelope 409 `fieldErrors[{field:'phone'}]` ⇒ ném `CustomerPortException` với `fieldErrors['phone']` = message nguyên văn. Mutant "ném nguyên `ApiError`" ⇒ ĐỎ.

### 5. 🔥 BẪY SỐ 4 — SĐT E.164 trong path và query

- Path: retrofit sinh `'/customers/${phone}'` **không encode**. `+84903176968` đi được (Express không đổi `+` trong path) nhưng chuỗi người dùng gõ có `/`, `?`, `#`, khoảng trắng sẽ đổi route. Web: `openapi-fetch` encode (`%2B`). **Adapter `get()` truyền `Uri.encodeComponent(phone)`**; test bằng adapter HTTP giả: request path là `/customers/%2B84903176968`; với `0903/176` path là `/customers/0903%2F176` (không thành 2 segment). Kiểm Dio không encode lần hai (`%252B` ⇒ ĐỎ).
- Query: `lookup` / warranty `?phone=+84…` — Dio encode query bằng `Uri.encodeQueryComponent` ⇒ `+` thành `%2B` (đúng; `+` trần sẽ thành khoảng trắng ở server). Test khoá lại: query nhận được giải mã ra `+84903176968`.
- Router: path `/customers/:phone` — dựng bằng `Uri.encodeComponent`, đọc `state.pathParameters['phone']` (go_router đã giải mã). Test điều hướng tới khách có `+`.

### 6. 🔥 BẪY SỐ 5 — phiên "sống lại" sau Đăng xuất (nợ ghi ở Senior Review 10.6)

Review 10.6: nếu Đăng xuất chạy **trong lúc** một refresh đang bay, refresh xong `setTokens` lại sau `clear()` ⇒ máy còn refresh token mới, phiên sống lại. 10.6 không với tới (trang tạm không gọi API); **10.7 thêm lời gọi nền `/me` ngay sau đăng nhập/khởi động ⇒ với tới được.** Web cùng khuôn (`web/src/api/transport.ts:117`, `session-store.ts`).

**Sửa cho CẢ HAI nền tảng (D9):** session store đếm **thế hệ phiên** (`int generation`, tăng ở `clear()` và ở `setTokens` từ login — không tăng ở `setTokens` của refresh); transport chụp `generation` trước khi gọi `POST /auth/refresh`, chỉ `setTokens` nếu generation **chưa đổi**, ngược lại coi như refresh hỏng **im lặng** (không `onSessionExpired` — người dùng đã chủ động đăng xuất). Test hai nền tảng: refresh treo bằng `Completer`/promise thủ công → logout → thả refresh trả 200 ⇒ store rỗng (cả secure store/`localStorage`), request đang chờ ném hết phiên, `onSessionExpired` **0 lần**. Mutant bỏ kiểm generation ⇒ ĐỎ ở cả web lẫn mobile.

### 7. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Cây file:**

```
mobile/pubspec.yaml, pubspec.lock                     # + go_router ^17.2.3 (bẫy 1)
mobile/lib/api/http_me_port.dart                      # MỚI
mobile/lib/api/http_password_port.dart                # MỚI
mobile/lib/api/http_customers_port.dart               # MỚI (đổi lỗi D3, encode path bẫy 4)
mobile/lib/api/http_catalog_port.dart                 # MỚI (projection từng field, lọc search phía adapter)
mobile/lib/api/http_warranty_port.dart                # MỚI (đổi lỗi D3)
mobile/lib/api/api_error.dart                         # + fieldErrorMap()
mobile/lib/api/session_store.dart, transport.dart     # thế hệ phiên (bẫy 5)
mobile/lib/app/app_routes.dart                        # MỚI — bảng route thuần (D4)
mobile/lib/app/signed_in_app.dart                     # MỚI — PermissionsProvider + GoRouter (D5)
mobile/lib/app/pns_app.dart                           # nhận bộ port; signedOut có Quên mật khẩu; signedIn → SignedInApp
mobile/lib/main.dart                                  # dựng 4 adapter mới (catalog: xem D8)
mobile/lib/design_system/gating/app_permissions.dart  # + AppNavLink.requiresAny, filterNav xét any-of (parity web)
mobile/lib/design_system/shell/app_bottom_nav.dart    # + AppBottomNavScope (D6)
mobile/lib/design_system/shell/app_menu_nav.dart      # MỚI — kMobileMenu (D7), export qua shell.dart
mobile/lib/screens/menu/menu_screen.dart              # MỚI — màn Menu (s-menu)
mobile/lib/design_system/session/{me,customers,catalog,warranty}_port.dart  # typedef type sinh (bẫy 2)
mobile/lib/design_system/session/fake_{me,customers,catalog,warranty}_port.dart  # viết lại theo type sinh
mobile/lib/screens/customers/*.dart, warranty/warranty_lookup_screen.dart   # tên/kiểu mới
mobile/test/api/http_{me,password,customers,catalog,warranty}_port_test.dart  # MỚI
mobile/test/app/{app_routes,signed_in_app,composition_root}_test.dart        # MỚI
mobile/test/screens/menu/menu_screen_test.dart        # MỚI
web/src/api/{session-store,transport}.ts + test       # thế hệ phiên (bẫy 5)
design-system/session/parity.test.mjs, design-system/screens/customers.test.mjs, design-system/lib/  # guard đọc type sinh mobile (D10)
```

**D2 — Adapter** (bản Dart của adapter web 10.4, mỗi file một class `Http…Port implements …Port`, constructor `(PnsApiClient client, Transport transport)`, mọi lời gọi qua `transport.call(() => …)`, không import `package:dio`):
- `HttpMePort.fetchMe()` → `client.auth.meControllerMe()`.
- `HttpPasswordPort`: `requestResetCode(email)` → `authControllerForgotPassword(body: ForgotPasswordRequestDto(email))` trả `expiresInSeconds.toInt()`; `resetPassword` → `authControllerResetPassword`; `changePassword` → `changePasswordControllerChangePassword` (401 mật khẩu hiện tại sai: transport refresh+phát lại 1 lần rồi ném `ApiError`, **không** đăng xuất — luật 10.6 (j)).
- `HttpCustomersPort`: `lookup(sdt)` → `customersControllerLookup(phone: sdt)` (thô — AD-9, không chuẩn hoá); `list(...)` → `customersControllerList(q, custType: CustType.fromJson?, page, pageSize)` (map `custType` String → enum `CustType`; null giữ null); `get(sdt)` → `customersControllerFindOne(phone: Uri.encodeComponent(sdt))`; `create(input)` → `customersControllerCreate(body: input)`; `listSources()` → `customerSourcesControllerFindAll(includeInactive: true)`.
- `HttpCatalogPort`: `listProducts({search})` → `productsControllerFindAll()` rồi dựng `CatalogProduct` **từng field** (không `costPrice`), lọc name/SKU `toLowerCase().contains` phía adapter khi `search` không rỗng (`GET /products` không có tham số tìm — y web); `listGroups()` → `productGroupsControllerFindAll()`; `getGroup(id)` → `productGroupsControllerFindOne(id: id)` (đã đối chiếu `lib/api/generated/catalog/catalog_client.dart:64,88`).
- `HttpWarrantyPort.lookup(sdt)` → `ordersControllerWarrantyLookup(phone: sdt)`; `found: false` là 200 bình thường.
- Body rỗng/lạ: `transport.call<T>()` hiện **chỉ bắt `DioException`** (`transport.dart`, đọc 2026-10-22) ⇒ lỗi parse của `fromJson` (`TypeError`, `FormatException`, `CheckedFromJsonException`) lọt thẳng ra màn, không phải `ApiError`. Thêm nhánh bắt **ở `call`** (một chỗ, không ở từng adapter): lỗi không phải `ApiError`/cancel ⇒ `ApiError(kGenericErrorMessage)`. Test: response 200 thiếu field bắt buộc ⇒ `ApiError` câu chung.

**D3 — Đổi lỗi** (bẫy 3): helper `fieldErrorMap` + `on ApiError catch` trong `HttpCustomersPort`/`HttpWarrantyPort`. Cancel (`DioException` cancel) đi nguyên.

**D4 — `lib/app/app_routes.dart`** (thuần, tương đương `web/src/app/routes.ts`): path tiếng Anh `kMenuPath = '/menu'`, `kCustomersPath = '/customers'`, `kCustomerLookupPath = '/customers/lookup'`, `customerPath(phone) = '/customers/${Uri.encodeComponent(phone)}'`, `kWarrantyPath = '/warranty'`, `kProfilePath = '/profile'`; `const Map<String, String> kNavRoutes = {'customers': …, 'warranty': …, 'profile': …}`; `openableKeys(perms)` = key của `filterNav(kMobileMenu, perms)` có trong `kNavRoutes`; `landingPath(perms)` = **`/menu`** ở 10.7 (tab duy nhất có màn — xem D6); `isOpenable(location, perms)`. Gate route dùng **chung dữ liệu** với Menu (`kMobileMenu`), không bảng quyền thứ hai (AD-17).

**D5 — `SignedInApp`** (`lib/app/signed_in_app.dart`):
- `PnsApp` khi `signedIn` dựng `PermissionsProvider(key: ValueKey(_signInCount), port: me, child: SignedInApp(...))`. `_signInCount` tăng mỗi lần vào `signedIn` (đăng nhập/khôi phục) ⇒ đổi account là provider mới, **không** dính quyền account trước (test: đăng nhập A (có `customers.manage`) → đăng xuất → đăng nhập B (không) ⇒ Menu không có Khách hàng).
- `SignedInApp` đọc `PermissionsScope.of(context)`: `loading` ⇒ skeleton (như restoring); `error` ⇒ `AppErrorState` + nút "Thử lại" (tăng key ⇒ fetch lại) + "Đăng xuất"; `ready` ⇒ `MaterialApp.router` … **Chọn đơn giản nhất làm được:** tạo `GoRouter` **một lần** trong `State` khi `ready` (quyền cố định trong một phiên — fetch `/me` một lần, như web), `initialLocation: landingPath(perms)`, **chỉ đăng ký route mà `openableKeys(perms)` cho mở** (+ `/menu`, `/profile` luôn có); path lạ/thiếu quyền ⇒ `redirect` về `landingPath` (dùng `onException` hoặc `redirect` top-level — chọn một, test cả hai ca). `dispose` router khi State bị huỷ.
- Một `MaterialApp` hay hai: `PnsApp` hiện trả `MaterialApp(home: …)`. Được phép: `PnsApp` giữ `MaterialApp` cho restoring/signedOut và `SignedInApp` trả `MaterialApp.router` (đổi gốc ở ranh giới đăng nhập/đăng xuất là chấp nhận được), **hoặc** một `MaterialApp.router` duy nhất — chọn cách ít code, ghi Completion Notes. Bắt buộc ở mọi trang: `AppPhoneFrameScope(bare: true)` + `Scaffold(backgroundColor: AppTokens.surface)` (memory `mobile-app-root-needs-scaffold-keyboard` — bỏ Scaffold ⇒ bàn phím che form; giữ test `viewInsets` của 10.6 và thêm một ca cho một màn có form trong router, vd tra cứu bảo hành).
- Màn con mở bằng `context.push` (nút back Android pop về màn trước); đổi tab bằng `context.go`. Test: từ `/customers/:phone` bấm back hệ thống (`tester.binding.handlePopRoute()`) ⇒ về danh sách.
- `sessionExpired` (10.6) vẫn đưa về Đăng nhập từ bất kỳ route nào.

**D6 — Bottom-nav phát ý định qua scope (khuôn `SidebarNavContext` web 10.4, `AppPhoneFrameScope` 10.6):** thêm `AppBottomNavScope extends InheritedWidget { ValueChanged<int>? onSelect; VoidCallback? onCreateQuote; }` trong `app_bottom_nav.dart`, export qua `shell.dart`. `AppBottomNav.build`: dùng `onSelect ?? AppBottomNavScope.maybeOf(context)?.onSelect` (tương tự FAB). **Không sửa 18 màn**, không đổi literal/khóa 5 tab, shell vẫn không import router (chỉ `SignedInApp` đặt scope). Ánh xạ ở 10.7:
  - tab 4 **Menu** ⇒ `go('/menu')`;
  - tab 0 Trang chủ, 1 Đơn hàng, 3 Kho, FAB Tạo ⇒ **chưa nối** (`null` ⇒ bấm không làm gì) — Đơn hàng/Kho/FAB cần adapter orders/inventory của **10.8**; Trang chủ cần màn dashboard của **Epic 8 (8.1)**. Không làm màn giữ chỗ (quyết web 10.4), không đặt fake vào composition root. **Đây là tinh chỉnh AC-1 phải ghi vào epics.md (G-5):** "điều hướng nối 5 tab và FAB tới màn thật" được đáp ứng dần — 10.7 nối Menu + toàn bộ màn con của Menu; 10.8 nối Đơn hàng/Kho/FAB; Trang chủ ở 8.1.
  - Widget test: dưới scope, bấm tab Menu gọi `onSelect(4)`; không scope ⇒ không ném; prop riêng của widget **thắng** scope.

**D7 — Menu (`s-menu`, EXPERIENCE.md:30, mockup `all-screens.html#s-menu`):**
- Dữ liệu `kMobileMenu` (`lib/design_system/shell/app_menu_nav.dart`, `List<AppNavSection>`) — mục **có màn mobile ở 10.7**: `customers` "Khách hàng" · "Tra & quản lý theo SĐT" · `ic-customer` · `requires: customers.manage`; `warranty` "Tra cứu bảo hành" · "Theo SĐT khách" · `ic-phone` · `requiresAny: [orders.view_all, orders.view_own]`; `profile` "Hồ sơ" · "Thông tin & đổi mật khẩu" · `ic-user` · không gate. Mục **không có màn mobile** (Danh mục vật tư, Kho → 10.8/tab Kho, Báo cáo, Cấu hình [web-only], Phân quyền, Audit [Epic 8]) **ẩn** (như web 10.4 ẩn mục chưa có route). Key/`requires`/`requiresAny` **phải trùng** `SIDEBAR_NAV` web cho cùng key (guard D10). Dùng `AppPermissionKeys.x` (memory `mobile-screens-use-apppermissionkeys-not-appperm` — `AppPerm.x` làm ghost-key guard đỏ); nếu `AppNavLink` cần thêm trường mô tả phụ (`subtitle`) thì thêm tuỳ chọn, không phá `kMenuSections` demo.
- `AppNavLink` thêm `final List<PermissionKey>? requiresAny;` + `filterNav` giữ link khi `(requires == null || can) && (requiresAny == null || any can)` — y nguyên `web/src/design-system/gating/permissions.ts:84–91`; cập nhật `design-system/components/gating.test.mjs` nếu nó so hai bên (đọc trước).
- `MenuScreen({required List<AppNavSection> sections, required ValueChanged<String> onOpen, required VoidCallback? onLogout})` — nhận **danh sách đã lọc** từ `SignedInApp` (màn không tự lọc, không biết router), đọc `PermissionsScope.of(context).me` cho thẻ danh tính (displayName + email — **không** bịa vai trò/SĐT như mockup, backend không trả). Dựng từ widget có sẵn (`AppPhoneFrame` + `AppMobileShell` + `AppTopbar(eyebrow: 'ĐIỀU HƯỚNG', title: 'Menu')` + `AppBottomNav(activeIndex: 4)` + `AppCard`/`AppIcon`/`AppButton`), **không style ad-hoc**, 0 `BoxShadow`/`elevation` (guard Viền nét). Mỗi dòng: icon trong ô vuông, tiêu đề đậm, mô tả `muted`, chevron phải; chạm cả dòng ⇒ `onOpen(key)`; vùng chạm ≥ `AppTokens.tapTargetMin`. Cuối: `AppButton` danger wide "Đăng xuất" (cờ busy như 10.6 R2 — bấm đôi ⇒ 1 `POST /auth/logout`). Không còn trang tạm "Đã đăng nhập." (xoá cùng test của nó, thay bằng test Menu).
- Hồ sơ **không** thêm nút Đăng xuất (mockup đặt ở Menu; web để ở Hồ sơ vì web không có Menu) — ghi Completion Notes.

**D8 — Composition root (`main.dart`) + guard (AC-4):**
- `buildApp` dựng thêm `HttpMePort`, `HttpPasswordPort`, `HttpCustomersPort`, `HttpWarrantyPort` và truyền vào `PnsApp`. `HttpCatalogPort` có code + test ở 10.7 nhưng **chưa có màn nào ở router dùng** (màn dùng nó là `CreateQuoteScreen` = FAB 10.8) ⇒ **không** dựng trong `main.dart` ở 10.7 (YAGNI; một tham số không ai đọc là code chết) — 10.8 nối cùng FAB. Ghi vào bullet G-5.
- `LoginScreen.onForgotPassword` nối `ForgotPasswordScreen(port: HttpPasswordPort, onBackToLogin: …)` (nợ 10.6). Sau khi đặt lại mật khẩu thành công màn đã tự quay về Đăng nhập? — đọc `forgot_password_screen.dart`, giữ hành vi màn.
- Guard `mobile/test/app/composition_root_test.dart` (khuôn `web/src/test/composition-root.test.ts`, đọc file như text, bỏ comment bằng bộ bỏ comment hiểu chuỗi đã có trong `test/api/no_network_outside_transport_test.dart` — tách ra `test/support/` nếu cần dùng chung, không viết bộ thứ hai):
  - (a) `lib/main.dart`, `lib/app/**`, `lib/api/**` (trừ `generated/`), `lib/screens/**`, `lib/design_system/{components,shell}/**`: **không** identifier `Fake\w*Port`, **không** import `…/fake_*.dart`, **không** import barrel `design_system/session/session.dart` (barrel re-export fake);
  - (b) chỉ `main.dart` gọi `Transport(`, `PnsApiClient(`, `SessionStore(`, `Http\w+Port(` (định nghĩa class không tính; test được miễn);
  - (c) port file trong phạm vi khai type bằng `typedef X = …Dto;` cho mọi type có DTO tương ứng (`MeResponse`, `Customer`, `CustomerSource`, `CustomerLookup`, `CustomerPage`, `CreateCustomerInput`, `WarrantyCustomer`, `WarrantyLine`, `WarrantyOrder`, `WarrantyLookup`, `CatalogGroupItem`) và **không** còn `class` nào trùng tên đó;
  - **chống-guard-rỗng:** số file quét ≥ 40; (b) **phải** thấy ≥ 1 lời gọi thật mỗi mẫu trong `main.dart`; (c) đếm đúng 11 typedef.
  - Mutation bắt buộc (backup `cp`, KHÔNG `git checkout`, mutant phải biên dịch): import `fake_me_port.dart` vào `main.dart` dùng `FakeMePort()`; `import '../design_system/session/session.dart'` vào `signed_in_app.dart`; `HttpCustomersPort(` trong `signed_in_app.dart`; `class Customer {…}` khai tay lại ⇒ ĐỎ cả 4.

**D9 — Thế hệ phiên** (bẫy 5) — mobile `SessionStore.generation` + `Transport` refresh; web `createSessionStore().generation` + `transport.ts`. Không đổi chữ ký public đang dùng ngoài `api/`.

**D10 — Guard design-system đọc type sinh mobile:**
- Thêm helper `design-system/lib/mobile-contract-types.mjs` (khuôn `web-contract-types.mjs`): `mobileAliasDto(portSrc, typeName)` đọc `typedef X = YDto;`, `mobileDtoFields(dto)` đọc field của class sinh trong `mobile/lib/api/generated/models/<snake>.dart` (hoặc thẳng từ `openapi.json` — **chọn openapi.json** nếu đơn giản hơn: typedef trỏ DTO thì field = property của schema; khẳng định DTO tồn tại cả hai nơi). Chống-rỗng: assert đọc được ≥ 1 field.
- `session/parity.test.mjs` warranty (dòng 447–457): mobile đọc qua helper thay cho `mobPort.includes(field)`; giữ toàn bộ assert khác. Không nới assert nào.
- `screens/customers.test.mjs:398–417`: **xoá** bảng `WEB_TO_MOBILE_FIELD = { nationalId: 'cccd' }` (mobile giờ là `customer.nationalId`), giữ assert `orDash(customer.<field>)` cho cả hai nền tảng.
- Guard mới: `kMobileMenu` key/`requires`/`requiresAny` == mục cùng key trong `SIDEBAR_NAV` web (đọc text `Sidebar.tsx`); chống-rỗng: so được ≥ 3 mục. Mutant đổi `requiresAny` của warranty mobile thành chỉ `ordersViewAll` ⇒ ĐỎ.
- Projection catalog (bẫy 2): field của `CatalogProduct`/`CatalogGroup`/`CatalogGroupDetail` ⊂ property schema tương ứng trong `openapi.json`, không có `costPrice`.
- `lib/web-mobile-contract-map.mjs` **không đụng** (của đơn/kho, 10.8).

### 8. Phạm vi

**TRONG:** `go_router` + `SignedInApp` + bảng route; `AppBottomNavScope`; `AppNavLink.requiresAny`; `kMobileMenu` + `MenuScreen`; 5 adapter (me, password, customers, catalog, warranty) + test; type sinh cho 4 port + viết lại 4 fake + đổi caller; `fieldErrorMap`; Quên mật khẩu nối thật; Đăng xuất ở Menu; guard composition root; guard design-system (D10); thế hệ phiên cả web + mobile; smoke emulator; docs G-5.

**NGOÀI (đừng làm):** adapter orders/inventory/stock-vouchers/payments/contracts/invoices, nối tab Đơn hàng/Kho/FAB, `CreateQuoteScreen` vào router, đổi tên method/field mobile của đơn/kho + xoá `web-mobile-contract-map.mjs` (**10.8**); màn Trang chủ/dashboard, Phân quyền, Audit (**Epic 8**); màn sửa khách (không có trên mobile, `onEdit` để `null`); màn quản lý danh mục/nguồn khách/cấu hình (web-only); BLoC/Cubit (giữ `InheritedWidget` — quyết 2.6); làm mới `/me` theo chu kỳ; đăng nhập bằng SĐT; build/ký iOS; nâng Flutter; nút back ở topbar các màn con (Android back qua router là đủ — Câu hỏi mở 3).

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:724-730`)

1. **Given** bottom-nav 5 tab cố định (Story 1.8), **When** đăng nhập xong, **Then** điều hướng (mặc định `go_router`) nối 5 tab và FAB tới màn thật; không đổi số tab; mục thiếu quyền không xuất hiện (UX-DR-15, UX-DR-22). _(Tinh chỉnh D6: 10.7 nối tab Menu + màn con; Đơn hàng/Kho/FAB ở 10.8; Trang chủ ở 8.1 — ghi G-5.)_
2. **Given** port me, password, catalog, customers, warranty, **When** dùng adapter, **Then** cài đúng interface port hiện có bằng client sinh (10.6); tên method tiếng Việt (nếu có) đổi sang tiếng Anh cùng caller.
3. **Given** mỗi adapter, **When** test, **Then** có ca thành công + một ca lỗi envelope qua HTTP giả lập; widget test hiện có vẫn xanh.
4. **Given** composition root `main.dart`, **When** khởi động, **Then** không import fake nào (guard, chống-guard-rỗng); fake chỉ còn trong test, viết lại theo type sinh.

### AC dẫn xuất (đo được)

5. **Toolchain (bẫy 1):** `go_router` khoá đúng `17.2.3` trong `pubspec.lock`; Flutter máy vẫn 3.35.0; không `dependency_overrides`; `flutter analyze` sạch.
6. **Type sinh (bẫy 2, AC-4):** 11 typedef của D8(c); không còn class khai tay trùng tên; `grep -rn "\bsdt\b\|cccd\|chotAt" mobile/lib --include='*.dart'` ngoài `lib/api/generated/` chỉ còn **tên tham số** `sdt` của method port/màn (không field nào); ngày bảo hành hiển thị đúng `DD/MM/YYYY` với `DateTime.utc(2030, 1, 1)` và với `DateTime.parse('2030-01-01T00:00:00Z')` trong TZ máy UTC+7; `warrantyStatus` `$unknown` ⇒ không crash, nhãn trung tính.
7. **Adapter (AC-2, AC-3, D2):** mỗi adapter một file test dùng `Transport` thật + `HttpClientAdapter` giả (`test/api/support/fake_http.dart`), đếm request: ca 200 map đúng (đúng method + path + query/body); ca lỗi envelope (4xx `{code,message,fieldErrors}`) ⇒ đúng kiểu lỗi port (customers/warranty: `*PortException` với `message` + `fieldErrors['phone']` nguyên văn; me/password/catalog: `ApiError`). Thêm: customers `get('+84903176968')` ⇒ path `/customers/%2B84903176968`, `get('0903/176')` ⇒ 1 segment; `lookup('+84…')` ⇒ server nhận query giải mã đúng `+84…`; `listSources` gửi `includeInactive=true`; catalog: không `costPrice` trên kết quả (kiểu không có field đó) + lọc search name/SKU, search rỗng ⇒ đủ danh sách; password `changePassword` 401 → 1 refresh → phát lại 401 ⇒ ném `ApiError`, **phiên giữ nguyên**; warranty `found: false` ⇒ trả kết quả, không ném. Mutant: adapter customers ném nguyên `ApiError` ⇒ ĐỎ; bỏ `Uri.encodeComponent` ⇒ ĐỎ; bỏ `includeInactive` ⇒ ĐỎ.
8. **Router + gate (AC-1, D4, D5):** `test/app/app_routes_test.dart` (thuần): `openableKeys` theo 4 bộ quyền (rỗng ⇒ chỉ `profile`; `customers.manage` ⇒ + customers; `orders.view_own` ⇒ + warranty; `orders.view_all` ⇒ + warranty); `landingPath` = `/menu`. `test/app/signed_in_app_test.dart` (widget, port HTTP giả lập hoặc fake **trong test**): sau đăng nhập vào Menu; Menu chỉ hiện mục có quyền (fixture bật đủ điều kiện ngoài — memory `widget-test-gate-unreachable-outer-condition`: ca "ẩn" phải có ca "hiện" cùng fixture trừ đúng một quyền); mở Khách hàng ⇒ `CustomerListScreen` với dữ liệu từ port; chạm một khách ⇒ chi tiết khách có `+` trong SĐT; back hệ thống ⇒ về danh sách; `go('/customers')` khi thiếu `customers.manage` ⇒ về `/menu`; path lạ ⇒ `/menu`; bấm tab Menu từ màn con ⇒ `/menu`; bấm Đơn hàng/Kho/Trang chủ/FAB ⇒ không đổi route, không ném; đổi account A→B ⇒ quyền B (D5); `/me` lỗi ⇒ màn lỗi + "Thử lại" gọi lại `/me` đúng 1 lần nữa; `sessionExpired` từ một màn con ⇒ Đăng nhập.
9. **Bottom-nav scope (D6):** widget test 3 ca (scope phát, không scope không ném, prop thắng scope); `shell-parity.test.mjs`, `shell_render_test.dart`, `shell_behavior_test.dart` xanh **không sửa assert**; guard parity "session example không chạm AppBottomNav" (`parity.test.mjs:552`) xanh.
10. **Menu (D7):** `test/screens/menu/menu_screen_test.dart`: render đủ mục được truyền, mô tả, thẻ displayName/email từ `PermissionsScope`; chạm dòng ⇒ `onOpen(key)`; Đăng xuất bấm đôi khi logout treo ⇒ 1 lời gọi; 0 `BoxShadow`/`elevation` trong file; chiều rộng 320 không tràn (`tester.takeException()` null). `AppNavLink.requiresAny` + `filterNav` có test thuần (any-of; kết hợp `requires` + `requiresAny`; section rỗng bị bỏ).
11. **Quên mật khẩu + Đăng xuất (D7, D8):** widget test `PnsApp`: Đăng nhập → link "Quên mật khẩu" ⇒ màn Quên mật khẩu, gửi mã ⇒ `POST /auth/forgot-password` đúng body; quay lại ⇒ Đăng nhập. Menu → Đăng xuất ⇒ `POST /auth/logout`, store rỗng, về Đăng nhập. Test cũ "Đã đăng nhập." được **thay** (không để test chết), số test tổng vẫn tăng.
12. **Guard composition root (AC-4, D8):** `test/app/composition_root_test.dart` (a)(b)(c) + chống-rỗng; 4 mutant D8 ĐỎ. Guard mạng 10.6 (`no_network_outside_transport_test.dart`) vẫn xanh — adapter mới không import `package:dio`; `parseEnvelope(` vẫn chỉ ở `transport.dart`.
13. **Thế hệ phiên (bẫy 5, D9):** test mobile (`transport_test.dart` hoặc `session_store_test.dart`) + web (`web/src/test/…transport…`): logout giữa refresh ⇒ store rỗng, 0 `onSessionExpired`, request chờ ném hết phiên; refresh bình thường vẫn lưu cả hai token (ca 10.6 (d) xanh). Mutant bỏ kiểm generation ⇒ ĐỎ ở cả hai nền tảng.
14. **Guard design-system (D10):** `npm test` xanh, số test **tăng**; warranty parity đọc type sinh mobile qua helper (chống-rỗng); `WEB_TO_MOBILE_FIELD` của customers đã xoá; guard Menu ↔ `SIDEBAR_NAV` + mutant ĐỎ; guard projection catalog; không xoá/nới assert nào khác.
15. **Smoke emulator thật** (luật 12–14 automator, memory `emulator-snapshot-boot-hangs-adb-install`, `smoke-headless-share-and-db-lane-wipe`): `pns-postgres` 5433 (chạy smoke **sau** `npm run test:db` hoặc seed lại — lane DB xoá sạch DB), backend `npm run start:prod` với `JWT_ACCESS_SECRET` ngẫu nhiên ≥ 32 ký tự **trên lệnh** (không đọc/sửa `.env`), AVD `Pixel_9_Pro` cold boot `-no-snapshot`, `flutter run`/APK debug `--dart-define=API_BASE_URL=http://10.0.2.2:3000`. Hai account smoke riêng (argon2id, mật khẩu ngẫu nhiên, chèn SQL thẳng vào 5433; script chặn DB khác `localhost:5433`): `smoke-10-7-a@local.test` có `customers.manage` + `orders.view_own`, `smoke-10-7-b@local.test` không quyền. (i) A đăng nhập ⇒ Menu có Khách hàng, Tra cứu bảo hành, Hồ sơ; (ii) Khách hàng: danh sách (seed ≥ 1 khách bằng SQL hoặc tạo qua màn), tra SĐT `0903…` ⇒ tạo khách mới thành công, mở chi tiết khách mới (SĐT `+84…` trong path); tạo trùng SĐT ⇒ lỗi hiện **dưới ô SĐT** nguyên văn backend; (iii) Tra cứu bảo hành SĐT lạ ⇒ "không tìm thấy" (200 `found:false`); (iv) Hồ sơ hiện tên/email của A; (v) tắt hẳn app, mở lại ⇒ vào thẳng Menu (1 lần rotate trong `sessions`); (vi) Đăng xuất ⇒ Đăng nhập, phiên revoked; (vii) B đăng nhập ⇒ Menu **chỉ** Hồ sơ; (viii) Quên mật khẩu: gửi mã ⇒ countdown hiện, 1 dòng `password_reset_codes` mới. Dọn: xoá 2 account smoke + khách smoke + mã reset, gỡ app, bật lại verifier nếu tắt, tắt emulator/backend mình bật, cổng 3000 trống; không dùng `kidy-dev-*`, không gọi dịch vụ ngoài localhost. Ghi kết quả từng bước vào Dev Agent Record.
16. **5 lane xanh:** mobile `flutter analyze` sạch + `flutter test` (> 523, không xoá test cũ trừ test trang tạm được thay ở AC-11); design-system `npm test` (> 497); web `npm run typecheck && npm test && npm run build` (> 432 — thêm ca thế hệ phiên); backend `npm test` + `npm run test:db` (không đổi backend — xác nhận `openapi.json` byte không đổi).
17. **G-5 cùng commit:** bullet "Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.7)" vào `epics.md` Story 10.7 (go_router 17.2.3; nối tab theo D6 — Menu ở 10.7, Đơn hàng/Kho/FAB ở 10.8, Trang chủ ở 8.1; Menu chỉ hiện mục có màn mobile; type sinh qua `typedef`, catalog giữ projection không `costPrice`; lỗi HTTP đổi sang `*PortException` ở adapter; `HttpCatalogPort` nối ở 10.8; Đăng xuất ở Menu; thế hệ phiên web + mobile); thêm một dòng vào Story 10.8 nhắc nối tab 1/3/FAB + landing `/orders` khi có quyền xem đơn; `project-context.md` chỉ sửa nếu có câu sai (vd mô tả mobile "trang tạm Đã đăng nhập") — đọc trước.

---

## Tasks / Subtasks

- [x] **T1 — go_router** (AC-5, bẫy 1): `flutter pub add go_router:^17.2.3`; analyze + test vẫn 523 xanh trước khi viết code mới
- [x] **T2 — Type sinh cho 4 port + fake + caller** (AC-6, bẫy 2): typedef; projection catalog; viết lại 4 fake (ngày `DateTime.utc`); đổi 3 màn khách + màn bảo hành + test của chúng; `flutter test` xanh trước khi sang adapter
- [x] **T3 — `fieldErrorMap` + 5 adapter + test** (AC-2, AC-3, AC-7, bẫy 3, bẫy 4, D2, D3); mutation 3 mutant AC-7
- [x] **T4 — Thế hệ phiên mobile + web** (AC-13, bẫy 5, D9) + mutation hai nền tảng
- [x] **T5 — Gating any-of + `kMobileMenu` + `AppBottomNavScope`** (AC-9, AC-10, D6, D7)
- [x] **T6 — `MenuScreen` + widget test** (AC-10)
- [x] **T7 — `app_routes.dart` + `SignedInApp` + `PnsApp` (Quên mật khẩu, thay trang tạm)** (AC-1, AC-8, AC-11, D4, D5)
- [x] **T8 — `main.dart` + guard composition root** (AC-4, AC-12, D8) + 4 mutant
- [x] **T9 — Guard design-system** (AC-14, D10) + mutant Menu↔Sidebar
- [x] **T10 — APK debug + smoke emulator** (AC-15)
- [x] **T11 — 5 lane + G-5** (AC-16, AC-17); File List đúng từng đường dẫn (`git status -uall`), `git add` đường dẫn cụ thể; story → `review`

---

## Dev Notes

### Smoke đầu-cuối (Trợ Lý, 2026-10-22) — bắt buộc trước khi chuyển review

- backend/.env thiếu JWT_ACCESS_SECRET hợp lệ và mật khẩu seed nằm trong .env: KHÔNG đọc/sửa .env. Chạy backend bằng biến tạm ngay trên lệnh (JWT_ACCESS_SECRET ngẫu nhiên ≥32 ký tự), Postgres local 5433.
- Tạo account smoke RIÊNG (smoke-<story>@local.test, mật khẩu ngẫu nhiên, băm argon2id như backend, quyền vừa đủ) thẳng vào DB local; không đổi account có sẵn; xoá account smoke + tắt backend/vite khi xong.
- Smoke luồng chính của story trên client thật (web: vite + trình duyệt; mobile: chạy được thì chạy, không thì ghi rõ chưa chạy và vì sao).


### Quyết định đã chốt — không bàn lại

- Mặc định §6.12 (go_router, gắn bottom-nav 5 tab, không đổi số tab), §6.20 (fake giữ cho test/demo, viết lại theo type sinh), AD-12 "Luật client" (một composition root, adapter trên client sinh, chỉ transport gọi mạng, không fake ở composition root), AD-4/UX-DR-22 (gating là UX, mục thiếu quyền **biến mất**, không xám).
- Khuôn web 10.4: route tiếng Anh, gate route dùng chung dữ liệu với nav, mục chưa có màn **ẩn**, không màn giữ chỗ; `listSources` `includeInactive=true`; `listProducts` lọc phía adapter, dựng từng field để `costPrice` không rời adapter; `fieldErrors[].message` từ backend luôn tiếng Việt ⇒ hiện nguyên văn.
- Luật 401/refresh của 10.6 giữ nguyên; chỉ thêm kiểm thế hệ phiên.
- `InheritedWidget`/`StatefulWidget`, không BLoC (quyết 2.6, nhắc lại ở 10.6). project-context ghi "Clean Architecture + BLoC" — **không** áp ở Epic 10.
- Luật ngôn ngữ: code/comment/tên test tiếng Anh; chỉ chuỗi UI tiếng Việt (nhãn Menu lấy nguyên văn mockup).

### Hiện trạng phải giữ

- 523 test mobile; đặc biệt `login_screen_test.dart`, `shell_render_test.dart` (khung mockup mặc định), `pns_app_test.dart` ca bàn phím (`viewInsets`) + logout bấm đôi + restore/expired (chuyển sang Menu thay "Đã đăng nhập."), `transport_test.dart` 16 ca, `no_network_outside_transport_test.dart`, `generated_client_drift_test.dart` (không sửa file sinh, không regen nếu spec không đổi).
- Guard design-system: `components/shell-parity.test.mjs` (literal khung + 5 tab), `session/parity.test.mjs` (bảng file đôi, `MeResponse? me`, warranty formatter `substring(0, 10)` + `'—'`, câu "còn bao lâu", demo không chạm AppBottomNav), `screens/*.test.mjs` (nhãn hai bên giống byte — **không đổi chuỗi UI** của màn có sẵn), `permissions/permission-keys.test.mjs`, `money/money-render-guard.test.mjs`.
- `app_session_gating_example.dart` + `kMenuSections` demo giữ nguyên (guard ghim).
- Web: chỉ đổi `session-store.ts`/`transport.ts` (+ test); 432 test web + build xanh.
- Backend và `openapi.json` không đổi một byte; `lib/api/generated/**` không đổi.

### Tình huống biên đã tính

- `/me` lỗi mạng sau khi restore thành công ⇒ màn lỗi + Thử lại/Đăng xuất (không kẹt skeleton). `/me` 401 ⇒ transport refresh → hỏng ⇒ `sessionExpired` ⇒ Đăng nhập.
- Account không quyền nào ⇒ Menu chỉ Hồ sơ (+ Đăng xuất); landing `/menu`.
- Đổi account trên cùng máy ⇒ provider mới (D5).
- Đăng xuất giữa refresh ⇒ không sống lại (bẫy 5).
- SĐT có `+`, `/`, khoảng trắng ⇒ path đúng một segment (bẫy 4).
- Nguồn khách đã tắt ⇒ chi tiết vẫn ra tên; select tạo khách không có nó.
- `warrantyStatus` giá trị lạ ⇒ `$unknown`, không crash.
- Bấm tab chưa nối ⇒ không làm gì (không ném, không route lạ).

### Kiểm thử — luật dự án áp dụng trực tiếp

- Màn mobile mới ⇒ widget test (luật 4; memory `mobile-screens-need-widget-tests`): `MenuScreen`, `SignedInApp`.
- Source-guard mới ⇒ chống-guard-rỗng (luật 5) + mutate thứ được bảo vệ, đòi ĐỎ (memory `source-guards-mutate-for-false-pass`, `guard-positive-selfcheck-matches-signature` — tự kiểm dương phải khớp **lời gọi thật** trong `main.dart`, không khớp chữ ký class).
- Mutant phải biên dịch (memory `mutation-must-compile-or-false-red`); backup `cp`, không `git checkout` (memory `mutation-test-never-git-checkout`); chạy mỗi mutant in dòng tổng `+N -M` (memory `zsh-command-var-no-word-split-mutation`: gọi lệnh qua hàm/array, không qua `$VAR`).
- Đếm request bằng số lần adapter HTTP giả nhận (memory `publish-count-unasserted-duplicate-survives`).
- Fixture số/ngày: chạy hàm thật in ra chuỗi người dùng thấy (memory `handpicked-fixture-numbers-hide-formula-bugs`) — đặc biệt `dinhDangNgay` với `DateTime`.
- Widget test chạy Dio trong fake-async: dùng vòng `tester.pump(10ms)` như 10.6 (Debug Log 10.6), không `runAsync`.
- Hook `scout-block` chặn lệnh Bash có chữ `build`/`dist` (memory `scout-block-hook-dist-build-words`): `flutter build apk` chạy qua script viết bằng Write tool (như 10.6); backend `npm run start:prod`.

### Previous Story Intelligence (10.6 commit `47761e7`; 10.4 commit `1a7b708`)

- 10.6: `transport.call<T>()` là ranh giới duy nhất gỡ `DioException`; adapter **không** import dio; `PnsApp` nhận `Listenable? sessionExpired`; `buildApp(baseUrl, {secureStore})` để test được — giữ chữ ký, thêm tham số tuỳ chọn nếu cần tiêm adapter HTTP giả cho test app. Review 10.6: R1 Scaffold (bàn phím), R2 logout bấm đôi, R3 guard mạng thêm loader ảnh mạng, nợ "phiên sống lại" ⇒ bẫy 5 ở đây.
- 10.6 Debug Log: widget test với Dio cần `pump(10ms)` lặp; drift-guard sinh lại mất ~16s; smoke emulator: cold boot + tạm tắt verifier rồi bật lại.
- 10.4: router web gate bằng `filterNav(SIDEBAR_NAV)`; `fieldErrors.phone` hiện dưới ô SĐT; mục chưa có màn ẩn; `CatalogPort.listProducts` lọc phía adapter; review 10.4 thêm dịch message `ValidationPipe` sang tiếng Việt (backend) ⇒ mobile chỉ hiện nguyên văn.
- 10.5: tên field/method đơn/kho mobile giữ cũ qua `web-mobile-contract-map.mjs` tới 10.8 — **không đụng**.

### Git intelligence

- 5 commit gần nhất (`8d40504` → `47761e7`) đều Epic 10. Khuôn commit `feat(story-10.x): …` tiếng Anh; `git add` đường dẫn cụ thể (không `git add mobile/`); `pubspec.lock` không bị ignore; `package-lock.json` web nếu đổi phải `git add -f` (story này không thêm dep web); `.git/info/exclude` loại mọi `.gitignore` (memory `git-info-exclude-drops-all-gitignore-files`). KHÔNG push.

### Latest tech notes (đo 2026-10-22)

- `go_router`: 17.2.3 = bản cuối cho Dart 3.9/Flutter 3.35 (bẫy 1). API dùng: `GoRouter(initialLocation, routes, redirect, onException, refreshListenable)`, `GoRoute(path, builder)`, `context.go/push`, `state.pathParameters` (đã giải mã). `MaterialApp.router(routerConfig: router)`. Router tạo trong `State`, `dispose()` khi huỷ.
- Client sinh (`swagger_parser 1.45.0`): mọi `number` ⇒ `num`, `date-time` ⇒ `DateTime` (json_serializable `DateTime.parse` — chuỗi `…Z` cho `isUtc == true`), enum inline ⇒ enum riêng có `$unknown` + `fromJson`; path param không encode (bẫy 4).

### Project Structure Notes

- `lib/app/` (route + app đã đăng nhập) song song `web/src/app/`; `lib/api/http_*_port.dart` song song `web/src/api/http-*-port.ts`; `kMobileMenu` ở `design_system/shell/` song song `SIDEBAR_NAV` ở `web/src/design-system/shell/Sidebar.tsx`.
- Lệch có chủ đích so với web: (1) lỗi nominal ⇒ adapter đổi `ApiError` → `*PortException` (web structural, không cần); (2) catalog giữ projection class vì Dart không có `Pick`; (3) bottom-nav khoá 5 tab ⇒ gating ở Menu, không ở tab; (4) Đăng xuất ở Menu (web ở Hồ sơ); (5) landing `/menu` (web: mục openable đầu tiên của sidebar).
- `design_system/session/*_port.dart` import `../../api/generated/models/…` — hướng phụ thuộc giống web (port import schema sinh).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. Tab Trang chủ/Đơn hàng/Kho/FAB bấm không phản hồi tới 10.8/8.1 (mặc định D6). Muốn tạm thời hiện thông báo "Sắp có" thì quyết — trái quyết "không màn giữ chỗ" của web 10.4.
2. Landing sau đăng nhập là Menu ở 10.7; 10.8 đổi thành Đơn hàng khi account có quyền xem đơn (giống web landing `/orders`).
3. Màn con (chi tiết khách, tra cứu, bảo hành, Hồ sơ) chưa có nút back trên topbar; Android dùng nút back hệ thống. iOS (không là tiêu chí Epic 10) sẽ cần nút này.
4. Đăng xuất chỉ ở Menu (theo mockup). Web để ở Hồ sơ.
5. Hồ sơ mobile hiện câu lỗi chung khi đổi mật khẩu sai (màn `catch (_)`); hiện message backend cần đổi màn — ngoài phạm vi.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 10 — Story 10.4 (tinh chỉnh + review), 10.6 (tinh chỉnh), 10.7, 10.8]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §4.4, §6.12, §6.14, §6.15, §6.17, §6.20, §6.21]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-4, AD-9, AD-12 (Luật client), AD-13, AD-17]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md:29-30,53` (Trang chủ, Menu, điều hướng); `DESIGN.md:244` (bottom-nav); `mockups/all-screens.html#s-menu`]
- [Source: `_bmad-output/implementation-artifacts/10-6-mobile-app-shell-android-ios-client-dart-sinh-tu-openapi-va-phien-dang-nhap.md` §7 D8–D13, Senior Developer Review]
- [Source: `_bmad-output/implementation-artifacts/10-4-web-composition-root-router-va-adapter-danh-muc-khach-cai-dat.md`]
- [Source: `web/src/api/http-{me,password,customers,catalog,warranty}-port.ts`, `web/src/app/routes.ts`, `web/src/test/composition-root.test.ts`, `web/src/design-system/gating/permissions.ts:40-92`, `web/src/design-system/shell/Sidebar.tsx:75-117`, `web/src/api/{transport,session-store}.ts`]
- [Source: `mobile/lib/{main.dart,app/pns_app.dart,api/*.dart}`, `mobile/lib/design_system/session/{me,password,customers,catalog,warranty}_port.dart` + fake, `app_session.dart`, `mobile/lib/design_system/shell/app_bottom_nav.dart`, `mobile/lib/design_system/gating/app_permissions.dart`, `mobile/lib/screens/{customers,warranty,account,auth}/*.dart`]
- [Source: `mobile/lib/api/generated/{auth,customers,catalog,orders}/*_client.dart`, `generated/models/{me_response,customer_*,warranty_*,product_*}_dto.dart`]
- [Source: `design-system/session/parity.test.mjs:27-50,425-560`, `design-system/screens/customers.test.mjs:390-420`, `design-system/lib/web-contract-types.mjs`]
- [Source: pub.dev `go_router` versions API (2026-10-22) — 17.2.3 env `sdk ^3.9.0, flutter >=3.35.0`]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- T1: `flutter pub add go_router:^17.2.3` ⇒ pub chọn **17.2.3** (pubspec.lock); Flutter 3.35.0 / Dart 3.9.0 không đổi; baseline 523 xanh + analyze sạch trước khi code.
- Guard design-system `warranty-lookup.test.mjs` đòi literal `con_han/sap_het/het_han` trong code màn ⇒ màn `switch (line.warrantyStatus.json)` (enum sinh, `$unknown.json == null` rơi `default` màu `muted`) — không nới guard.
- Guard `shell-parity` cấm chữ "sidebar" trong file shell mobile (kể cả comment) ⇒ đổi lời comment `AppBottomNavScope`.
- Widget test router: `settle` 100ms ngắn hơn hiệu ứng chuyển trang ⇒ 2 bottom-nav cùng lúc; thêm `pumpAndSettle` sau điều hướng. `routerDelegate.currentConfiguration.uri` không phản ánh route `push` ⇒ dùng `GoRouter.state.uri`.
- Mutation (backup `cp` ở scratchpad, không `git checkout`, mỗi mutant in dòng tổng): adapter customers ném nguyên `ApiError` / bỏ `Uri.encodeComponent` / bỏ `includeInactive` / warranty ném nguyên `ApiError` / `Transport.call` bỏ nhánh bắt lỗi parse ⇒ ĐỎ; thế hệ phiên mobile + web: bỏ kiểm trước `setTokens`, bỏ kiểm trước `clear`, `clear` không tăng ⇒ ĐỎ; "đăng nhập không tăng" ban đầu SỐNG ⇒ thêm ca "đăng nhập thay phiên giữa refresh, 200 về muộn không ghi đè" ⇒ ĐỎ (cả hai nền tảng); scope bottom-nav bị bỏ qua / scope thắng prop / `any`→`every` ⇒ ĐỎ; Menu bỏ cờ busy ⇒ ĐỎ; router bỏ redirect / tab Menu không nối / chi tiết bằng `go` / path không escape / provider không key theo lần đăng nhập / Thử lại no-op / Quên mật khẩu không nối ⇒ ĐỎ; 4 mutant D8 (main dùng `FakeMePort`, `signed_in_app` import barrel, `signed_in_app` dựng `HttpCustomersPort`, `class Customer` khai tay) ⇒ ĐỎ đúng assert (test guard chỉ đọc text, không biên dịch `lib/`); guard design-system: `CatalogProduct` thêm `costPrice` / field bịa, `WarrantyLine` trỏ sai DTO, `class Customer`, Facts bỏ `nationalId`, Menu warranty mất `view_own` / customers bỏ gate / sai key ⇒ ĐỎ; màn pick bỏ lọc `active` / bỏ lỗi `phone` dưới ô SĐT ⇒ ĐỎ.
- `dart format` repo không sạch sẵn (file 10.6 lệch ở mọi bề rộng) ⇒ chỉ format **file mới** `-l 120` (khuôn 10.6), file cũ chỉ sửa tay, không chạy format toàn package.
- `test:db` chạy với `DATABASE_URL` trỏ thẳng `pns-postgres:5433` trên lệnh (thông số từ cấu hình container, không đọc `.env`).
- APK debug: `--dart-define=API_BASE_URL=http://10.0.2.2:3000`, 11s, 168.588.935 byte (chạy qua script vì hook chặn chữ "build"). AVD `Pixel_9_Pro` cold boot `-no-snapshot`, cài qua adb ngay (verifier của AVD vốn đã 0 — không đổi).

### Completion Notes List

- **T1–T9 đã làm và test**, theo D1–D10. Lệch có chủ đích (ghi G-5 trong epics.md):
  - `MenuScreen.onLogout` là `Future<void> Function()?` (không phải `VoidCallback?`) để màn tự giữ cờ busy và test bấm đôi ở mức màn; `PnsApp._logout` cũng chặn gọi lại.
  - Gate router: **redirect top-level** (`isOpenable`) đăng ký mọi route — một cơ chế cho cả thiếu quyền lẫn path lạ (test cả hai ca + ca chứng có quyền mở được).
  - Hai `MaterialApp`: `PnsApp` (restoring/signedOut/Quên mật khẩu) và `SignedInApp` (`MaterialApp.router` khi `ready`; skeleton/lỗi `/me` là `MaterialApp` thường), có key riêng; khung chung tách `lib/app/app_chrome.dart` (`appPage` = bare frame + `Scaffold` — bàn phím; `SessionSkeleton`). Test bàn phím 10.6 giữ + thêm ca form trong router (Tra cứu bảo hành).
  - `fieldErrorMap` giữ **message đầu tiên** mỗi field theo câu chữ story; ghi chú: web `fieldErrorsOf` thực tế giữ message cuối (không sửa web — ngoài phạm vi).
  - Màn pick khách thêm `_fieldError('phone')` dưới ô SĐT (web đã có ở 10.4; mobile thiếu) và lọc nguồn `active` trong select; key lỗi CCCD đổi `cccd` → `nationalId` (tên field backend từ 10.2); biến controller `_cccd` → `_nationalId`.
  - Guard design-system `orders.test.mjs` cập nhật regex `picked.sdt` → `picked.phone` (cùng độ chặt, theo đổi field); `customers.test.mjs` xoá bảng `WEB_TO_MOBILE_FIELD`; parity warranty đọc type sinh mobile qua `mobile-contract-types.mjs`; thêm guard projection catalog, guard 10 typedef port, guard `menu-nav-parity`.
  - Lexer đọc Dart tách sang `test/support/dart_source.dart`, dùng chung guard mạng 10.6 + guard composition root (không viết bộ thứ hai).
  - Hồ sơ **không** có nút Đăng xuất (Đăng xuất ở Menu theo mockup).
  - `HttpCatalogPort` có code + test, chưa dựng trong `main.dart` (YAGNI; nối cùng FAB ở 10.8).
- **Ghi nhận không sửa (ngoài phạm vi):** màn chi tiết khách vẫn hiện "Sửa" ở topbar dù `onEdit == null` (bấm không làm gì — không có màn sửa khách mobile); danh sách khách không tự tải lại khi quay về sau khi tạo khách (màn cũ giữ state); Android back ở màn Quên mật khẩu (ngoài router) thoát app thay vì về Đăng nhập — dùng nút "Quay lại đăng nhập".
- **Smoke emulator (AC-15) — ĐÃ CHẠY** trên `pns-postgres` 5433 (sau `test:db`, seed lại bằng SQL), backend `npm run start:prod` với `JWT_ACCESS_SECRET` ngẫu nhiên 64 hex + `DATABASE_URL` 5433 trên lệnh (không đọc/sửa `.env`), AVD `Pixel_9_Pro` cold boot, APK debug; điều khiển bằng `adb input` + `uiautomator dump` + ảnh chụp. Account riêng `smoke-10-7-a@local.test` (`customers.manage` + `orders.view_own`) và `smoke-10-7-b@local.test` (không quyền), argon2id, mật khẩu ngẫu nhiên, chèn SQL thẳng vào container `pns-postgres`; 1 khách seed `+84911222333`.
  - (i) A đăng nhập ⇒ Menu: thẻ "Smoke 10.7 A"/email, đúng 3 mục Khách hàng, Tra cứu bảo hành, Hồ sơ + Đăng xuất; bottom-nav 5 tab.
  - (ii) Khách hàng: danh sách thật hiện khách seed; "Xem" ⇒ chi tiết `+84911222333`; back hệ thống ⇒ về danh sách (back lần nữa ⇒ Menu). "+ Thêm khách" ⇒ tra `0903 555 777` ⇒ "SĐT chưa có trong hệ thống." ⇒ tạo khách (Facebook) ⇒ mở chi tiết khách mới `+84903555777` (DB có dòng). Tra lại ⇒ "Khách cũ — trùng khớp"; "Không phải khách này? Tạo mới" ⇒ Lưu ⇒ dưới ô SĐT: "Số điện thoại này đã thuộc về một khách hàng khác." + banner "Số điện thoại đã có khách hàng: +84903555777" (nguyên văn backend).
  - (iii) Tab Menu từ màn con ⇒ `/menu`; tab Đơn hàng ⇒ không đổi; Tra cứu bảo hành `0999888777` ⇒ "SĐT chưa có trong hệ thống." (200 `found:false`).
  - (iv) Hồ sơ hiện "Smoke 10.7 A" / `smoke-10-7-a@local.test`.
  - (v) `am force-stop` (pid rỗng) rồi mở lại ⇒ vào thẳng Menu; `sessions` của A: 2/2 hoạt động ⇒ 2/3 (1 dòng revoked + 1 mới = đúng 1 lần rotate; 1 dòng còn lại là phiên `curl` kiểm tra đăng nhập trước smoke).
  - (vi) Đăng xuất ⇒ Đăng nhập; phiên app của A revoked (còn 1/3 = phiên curl).
  - (vii) B đăng nhập ⇒ Menu **chỉ** Hồ sơ (+ Đăng xuất), thẻ "Smoke 10.7 B".
  - (viii) Quên mật khẩu (email A) ⇒ "Đã gửi mã 6 số đến sm•••@local.test…", countdown "Gửi lại mã sau 04:52"; `password_reset_codes` của A 0 ⇒ 1; "Quay lại đăng nhập" ⇒ Đăng nhập.
  - Dọn: `DELETE` 2 khách smoke + 2 account (cascade phiên, quyền, mã reset) ⇒ đếm lại 0/0/0/0/0; gỡ app; verifier giữ nguyên 0; tắt emulator; tắt backend, cổng 3000 trống; xoá file mật khẩu tạm. Không dùng `kidy-dev-*`, không gọi dịch vụ ngoài localhost.
- **5 lane:** mobile `flutter analyze` sạch + `flutter test` **600** (523 → 600; test trang tạm "Đã đăng nhập." được thay bằng Menu, không xoá test khác); design-system **504/504** (497 → 504); web `typecheck` 0 lỗi + **435** test (432 → 435) + `vite build` OK; backend `npm test` **2504/2504** (121 suite) + `npm run test:db` **322/322** (26 suite); backend không diff, `openapi.json` không đổi, `lib/api/generated/**` không đổi (drift-guard xanh).

### File List

- `_bmad-output/implementation-artifacts/10-7-mobile-dieu-huong-va-adapter-danh-muc-khach-tai-khoan.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/project-context.md`
- `design-system/components/menu-nav-parity.test.mjs` (mới)
- `design-system/lib/mobile-contract-types.mjs` (mới)
- `design-system/lib/mobile-contract-types.test.mjs` (mới)
- `design-system/screens/customers.test.mjs`
- `design-system/screens/orders.test.mjs`
- `design-system/session/parity.test.mjs`
- `mobile/pubspec.yaml`
- `mobile/pubspec.lock`
- `mobile/lib/main.dart`
- `mobile/lib/api/api_error.dart`
- `mobile/lib/api/session_store.dart`
- `mobile/lib/api/transport.dart`
- `mobile/lib/api/http_me_port.dart` (mới)
- `mobile/lib/api/http_password_port.dart` (mới)
- `mobile/lib/api/http_customers_port.dart` (mới)
- `mobile/lib/api/http_catalog_port.dart` (mới)
- `mobile/lib/api/http_warranty_port.dart` (mới)
- `mobile/lib/app/pns_app.dart`
- `mobile/lib/app/app_chrome.dart` (mới)
- `mobile/lib/app/app_routes.dart` (mới)
- `mobile/lib/app/signed_in_app.dart` (mới)
- `mobile/lib/design_system/gating/app_permissions.dart`
- `mobile/lib/design_system/session/me_port.dart`
- `mobile/lib/design_system/session/customers_port.dart`
- `mobile/lib/design_system/session/catalog_port.dart`
- `mobile/lib/design_system/session/warranty_port.dart`
- `mobile/lib/design_system/session/fake_customers_port.dart`
- `mobile/lib/design_system/session/fake_orders_port.dart`
- `mobile/lib/design_system/session/fake_warranty_port.dart`
- `mobile/lib/design_system/shell/app_bottom_nav.dart`
- `mobile/lib/design_system/shell/app_menu_nav.dart` (mới)
- `mobile/lib/design_system/shell/shell.dart`
- `mobile/lib/screens/menu/menu_screen.dart` (mới)
- `mobile/lib/screens/customers/customer_list_screen.dart`
- `mobile/lib/screens/customers/customer_pick_screen.dart`
- `mobile/lib/screens/orders/create_quote_screen.dart`
- `mobile/lib/screens/warranty/warranty_lookup_screen.dart`
- `mobile/test/support/dart_source.dart` (mới — lexer tách từ guard mạng)
- `mobile/test/api/support/api_stack.dart` (mới)
- `mobile/test/api/support/fake_http.dart`
- `mobile/test/api/http_me_port_test.dart` (mới)
- `mobile/test/api/http_password_port_test.dart` (mới)
- `mobile/test/api/http_customers_port_test.dart` (mới)
- `mobile/test/api/http_catalog_port_test.dart` (mới)
- `mobile/test/api/http_warranty_port_test.dart` (mới)
- `mobile/test/api/no_network_outside_transport_test.dart`
- `mobile/test/api/transport_test.dart`
- `mobile/test/app/support/app_harness.dart` (mới)
- `mobile/test/app/app_routes_test.dart` (mới)
- `mobile/test/app/composition_root_test.dart` (mới)
- `mobile/test/app/signed_in_app_test.dart` (mới)
- `mobile/test/app/pns_app_test.dart`
- `mobile/test/design_system/app_bottom_nav_scope_test.dart` (mới)
- `mobile/test/design_system/filter_nav_test.dart` (mới)
- `mobile/test/screens/menu/menu_screen_test.dart` (mới)
- `mobile/test/screens/customers/customer_screens_test.dart`
- `mobile/test/screens/warranty/warranty_lookup_screen_test.dart`
- `web/src/api/session-store.ts`
- `web/src/api/transport.ts`
- `web/src/test/transport.test.ts`
- `mobile/lib/api/http_auth_port.dart` (review)
- `web/src/api/http-auth-port.ts` (review)
- `web/src/screens/customers/CustomerPickScreen.tsx` (review)
- `web/src/screens/orders/CreateQuoteScreen.tsx` (review)
- `web/src/test/customer-screens.test.tsx` (review)
- `web/src/test/quote-stock-check.test.tsx` (review)

## Change Log

- 2026-10-22 — Story 10.7 dev: `go_router` 17.2.3 + `SignedInApp` (Menu, Khách hàng, Tra cứu bảo hành, Hồ sơ) gate bằng `kMobileMenu` dùng chung với Menu; `AppBottomNavScope` (tab Menu); `AppNavLink.requiresAny`; `MenuScreen`; 5 adapter HTTP mobile (me, password, customers, catalog, warranty) + test; type sinh cho 4 port + fake viết lại; `fieldErrorMap` + đổi lỗi `*PortException`; Quên mật khẩu nối thật; Đăng xuất ở Menu; guard composition root mobile; guard design-system đọc type sinh mobile + Menu↔Sidebar; thế hệ phiên web + mobile; smoke emulator 8 bước; G-5 epics.md + project-context.
- 2026-10-22 — Senior review (AI): 9 finding (1 HIGH, 4 MEDIUM, 4 LOW) đã sửa hết; story → done.

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 5.5 (bmad-story-automator-review + /ck:code-review, thêm 1 reviewer độc lập chỉ đọc) — 2026-10-22
**Kết quả:** Approve sau khi sửa. AC 1–17 đối chiếu với code + test: đạt (AC-15 smoke emulator của dev không chạy lại — luật 14(b), không có emulator trong review). Task [x] đều có bằng chứng. File List khớp `git status` (bổ sung 6 file review sửa).

### Finding đã sửa

1. **HIGH — luật 14(a): web giữ message CUỐI của field, mobile giữ ĐẦU.** `fieldErrorsOf` ở `web/src/screens/customers/CustomerPickScreen.tsx` và `web/src/screens/orders/CreateQuoteScreen.tsx` ghi đè ⇒ message cuối thắng. Sửa: duyệt ngược ⇒ message đầu thắng (cùng luật `fieldErrorMap` mobile). Test: `customer-screens.test.tsx` + `quote-stock-check.test.tsx` (ca 2 message cùng field); mobile đã có ca trong `http_customers_port_test.dart`. Mutant bỏ đảo ngược ⇒ ĐỎ cả 3 chỗ (web pick, web quote, mobile `fieldErrorMap`).
2. **MEDIUM — đăng xuất giữa lúc refresh đang bay để lại phiên sống trên server (web + mobile).** Hai đường: (a) refresh trả 200 sau `clear()` ⇒ token mới bị bỏ nhưng phiên server mới vẫn sống (logout gửi token cũ đã bị rotate — `auth.service.ts` chỉ thu hồi đúng hash); (b) refresh trả 200 trong lúc `POST /auth/logout` còn trên dây ⇒ generation chưa đổi ⇒ lưu R2 rồi `clear()` xoá ở máy, R2 vẫn sống ở server. Sửa: `logout()` xoá phiên cục bộ **trước** khi gọi server (`http_auth_port.dart`, `http-auth-port.ts`); `_renew`/`renew` thấy generation đã đổi mà có token mới ⇒ `POST /auth/logout` best-effort thu hồi. Test 2 nền tảng: ca "refresh trả lời trong lúc logout còn treo" + assert ca cũ gửi thu hồi `refresh-2`; ca refresh bị từ chối không gửi thu hồi thừa. Mutant bỏ thu hồi / đảo lại thứ tự logout ⇒ ĐỎ cả web lẫn mobile.
3. **MEDIUM — danh sách khách cũ sau khi tạo khách.** Router đẩy `/customers/lookup` lên trên danh sách; state danh sách giữ nguyên ⇒ khách mới không hiện khi quay về (web không bị vì route unmount). Sửa: `CustomerListScreen.onAdd` là `Future<void> Function()?`, xong luồng tạo ⇒ `_load()`. Test router: tạo khách → back ⇒ danh sách có khách mới. Mutant bỏ reload ⇒ ĐỎ.
4. **MEDIUM (test gap) — guard bấm đôi Đăng xuất của `PnsApp` không test nào canh** (màn Menu có cờ busy riêng; nút Đăng xuất ở màn lỗi `/me` dựa hoàn toàn vào guard). Thêm ca bấm đôi ở màn lỗi `/me`: 1 `POST /auth/logout` và không về Đăng nhập trước khi logout xong. Mutant bỏ guard ⇒ ĐỎ (ban đầu SỐNG vì sau khi đổi thứ tự logout, lần bấm thứ hai đọc token rỗng nên không gửi — mutant tương đương về số request; assert "không nhảy trước" là hành vi phân biệt).
5. **MEDIUM — Android back ở Quên mật khẩu đóng app** (dev ghi "ngoài phạm vi"; nhưng màn này do 10.7 nối vào). Sửa: `PopScope(canPop: false)` đưa về Đăng nhập. Test `handlePopRoute()` trả `true` + về `LoginScreen`. Mutant `canPop: true` ⇒ ĐỎ.
6. **LOW — form tạo khách còn trong back stack:** back từ chi tiết khách mới về form đã điền, Lưu lại ⇒ 409. Sửa: `onSelect` pop form rồi push chi tiết (không dùng `pushReplacement`: go_router 17.2.3 bỏ completer của route bị thay ⇒ future `push` của danh sách không bao giờ xong ⇒ không reload — đã đọc `parser.dart`). Mutant giữ form ⇒ ĐỎ.
7. **LOW — phiên mới nhập vào refresh đang bay của phiên cũ** (đăng xuất → đăng nhập trong lúc refresh cũ chưa về ⇒ 401 đầu tiên của phiên mới nhận kết quả hỏng của phiên cũ). Sửa: single-flight gắn generation (web + mobile), chỉ xoá con trỏ nếu đúng renewal của mình. Test 2 nền tảng; mutant chia sẻ bất kể generation ⇒ ĐỎ.
8. **LOW — File List thiếu file review sửa** — đã bổ sung.
9. **LOW — epics.md (luật 11)** — thêm "Chốt thêm ở review 10.7" vào bullet G-5 (thứ tự logout + thu hồi, single-flight theo generation, message đầu cả hai nền tảng, luồng tạo khách, back Quên mật khẩu).

### Ghi nhận, không sửa (có lý do)

- Nút "Sửa" ở chi tiết khách bấm không làm gì: có sẵn từ 3.4 và **giống hệt web** (`AppRoutes.tsx` không truyền `onEdit`); guard nhãn byte-identical giữ "Sửa" cả hai bên. Ẩn riêng mobile là lệch parity — để story màn sửa khách quyết.
- Luật 1–2 (scope guard đơn, `FOR UPDATE` tồn kho): story không đụng backend (`git diff HEAD -- backend` rỗng, `openapi.json` không đổi) ⇒ không có đường ghi đơn/tồn kho mới để bẻ.
- Prettier báo lệch ở các file web đã sửa: nền sẵn có ở HEAD (web không có cấu hình prettier), không phải lỗi mới.

### Mutation (backup `cp` ở scratchpad, không `git checkout`)

12 mutant cho fix review ⇒ ĐỎ hết (M8 cần thêm assert như trên). Kiểm lại mutant dev đã khai: main import barrel `session.dart`, `signed_in_app` gọi `HttpCustomersPort(`, bỏ `includeInactive`, bỏ encode path, customers ném nguyên `ApiError`, bỏ redirect, Menu warranty chỉ `view_all`, Menu customers bỏ gate ⇒ ĐỎ hết.

### Lane sau review

- mobile: `flutter analyze` sạch; `flutter test` **608** xanh (600 → 608).
- design-system: **504/504**.
- web: `typecheck` 0 lỗi; **439** test (435 → 439); `vite build` OK.
- backend: `npm test` **2504/2504** (121 suite); `npm run test:db` **322/322** (26 suite, `pns-postgres` 5433, `DATABASE_URL` trên lệnh, không đọc `.env`); `openapi.json` không đổi.

