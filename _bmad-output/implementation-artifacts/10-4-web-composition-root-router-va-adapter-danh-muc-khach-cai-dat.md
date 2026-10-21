---
baseline_commit: cb30dee
---

# Story 10.4: Web: composition root, router và adapter danh mục, khách, cài đặt

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người dùng web,
I want điều hướng giữa các màn có sẵn với dữ liệu thật và chỉ thấy mục mình có quyền,
so that dùng web cho danh mục, khách hàng, cấu hình thay Excel.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-22, sau commit `cb30dee` = Story 10.3 done)

| Bề mặt | Hiện trạng |
|---|---|
| `web/src/main.tsx` | Tạo `session` + `transport` + `client` + `HttpAuthPort` ở top-level; state `'restoring' \| 'login' \| 'forgot' \| 'signedIn'`; `'signedIn'` là khung tối thiểu "Đã đăng nhập." + nút Đăng xuất. Quên mật khẩu vẫn chạy `FakePasswordPort` (**import fake từ entry** — 10.4 phải gỡ). Không router, không `PermissionsProvider` |
| `web/src/api/` | `transport.ts` (nơi DUY NHẤT gọi `fetch`), `client.ts` (`createApiClient(transport, baseUrl)` → `ApiClient`), `api-error.ts` (`ApiError`), `session-store.ts`, `http-auth-port.ts` (khuôn adapter), `generated/schema.d.ts` (sinh, drift-guard) |
| Port trong phạm vi 10.4 (`web/src/design-system/session/`) | `MePort.fetchMe`, `PasswordPort {requestResetCode, resetPassword, changePassword}`, `CustomersPort {lookup, list, get, create, listSources}`, `CustomerSourcesPort {list, create, update, deactivate, reactivate}`, `CatalogPort {listProducts, listGroups, getGroup}`, `SettingsPort {getVatRate, updateVatRate, getCompanyLegalEntity, updateCompanyLegalEntity}`, `WarrantyPort.lookup`. **Không method tên tiếng Việt** trong 7 port này |
| Type dữ liệu của port | **Khai tay** (vi phạm AD-12 "cấm khai tay type contract"), còn tên field cũ: `Customer.sdt/cccd`, `CreateCustomerInput.sdt/cccd`, `CustomerLookup.sdt`, `WarrantyCustomer.sdt`, `WarrantyLookup.sdt`, `WarrantyOrder.chotAt` ⇒ backend 10.2 đã trả `phone/nationalId/confirmedAt` |
| Màn | Mỗi màn văn phòng TỰ render `WebShell` + `<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="…"/>` **không truyền `onNavigate`** ⇒ bấm sidebar không làm gì. 19 file `*Screen.tsx` |
| `Sidebar.tsx` | Thuần trình bày: `<a href="#">` + `preventDefault` + `onNavigate?.(key)`. `SIDEBAR_NAV` có 10 key: `home, orders, customers, catalog, inventory, warranty, settings, permissions, audit, profile`; gate quyền nằm trên **dữ liệu link** (`requires`/`requiresAny`) |
| Màn web có sẵn ứng với key | `customers` (List/Detail/Pick), `warranty`, `settings` (`CustomerSourceConfigScreen` = Nguồn khách + VAT + pháp nhân), `profile`. `orders`/`inventory` có màn nhưng adapter là 10.5. **`home`, `catalog`, `permissions`, `audit`: KHÔNG có màn web nào** (catalog chỉ có port đọc cho picker của `CreateQuoteScreen`; dashboard/phân quyền/audit là Epic 8) |
| Đăng xuất | Chỉ có ở khung tạm của `main.tsx`; `ProfileScreen` không có nút |
| Guard có sẵn liên quan | `no-network-outside-transport.test.ts` (chỉ `api/transport.ts` gọi mạng; `openapi-fetch` chỉ ở `api/client.ts`), `screens-render.test.tsx` (`SCREEN_COUNT = 19`), `css-class-coverage.test.ts`, `api-client-drift.test.ts`, `app-entry.test.tsx` (main.tsx đầu-cuối với `fetch` stub). design-system: `components/shell-tsx.test.mjs` (**shell cấm import router**, `Sidebar` phải khớp regex `/onNavigate\?\.\(/`), `session/parity.test.mjs`, `screens/customers.test.mjs`, `screens/warranty-lookup.test.mjs`, `screens/profile.test.mjs` |

### 2. 🔥 BẪY SỐ 1 — 25 field trong `openapi.json` là `type: object` ⇒ type sinh là `Record<string, never>`

Đo thật: field `string | null` / DTO lồng `X | null` khai `@ApiProperty` **không có `type:`** ⇒ reflection của Swagger ra `type: "object"` ⇒ `openapi-typescript` sinh `Record<string, never>`. Ví dụ trong `schema.d.ts` hiện tại:

```ts
CreateCustomerRequestDto: { phone: string; nationalId?: Record<string, never>; taxCode?: Record<string, never>; … }
WarrantyOrderDto:         { confirmedAt?: Record<string, never> | null; … }
```

⇒ Alias port type vào type sinh mà không sửa thì `create({ nationalId: '079…' })` **không compile**, `order.confirmedAt.slice(0,10)` không compile. Đừng "chữa" bằng cast/`as unknown as` hay khai tay lại type — đó là đúng cái AD-12 cấm.

**Sửa ở nguồn (backend DTO), cho đúng các module của 10.4** (danh sách đo bằng `jq` trên `openapi.json`):

| Schema | Field |
|---|---|
| `CreateCustomerRequestDto` | `nationalId`, `taxCode`, `address`, `bankAccount`, `sourceNote` |
| `UpdateCustomerRequestDto` | `nationalId`, `taxCode`, `address`, `bankAccount`, `sourceNote` |
| `CustomerLookupResponseDto` | `customer` (DTO lồng, nullable) |
| `CreateCustomerSourceRequestDto` | `description` |
| `WarrantyLookupResponseDto` | `customer` (DTO lồng, nullable) |
| `WarrantyOrderDto` | `confirmedAt` |
| `CreateProductRequestDto`, `UpdateProductRequestDto` | `warrantyMonths` |

- Cách sửa: thêm `type` tường minh — `@ApiPropertyOptional({ type: String, nullable: true, … })` (giữ nguyên `description`/`example` đang có), `type: Number` cho `warrantyMonths`, `type: () => CustomerResponseDto` / `WarrantyCustomerDto` + `nullable: true` cho DTO lồng; `confirmedAt` là `Date` ⇒ `type: String, format: 'date-time'` (JSON ra chuỗi ISO, khớp các field ngày khác trong spec — kiểm `createdAt` của `CustomerResponseDto` để theo đúng khuôn đang dùng).
- **KHÔNG đổi tên field, không đổi validator, không đổi hành vi** — chỉ metadata Swagger ⇒ e2e/unit hiện có phải xanh y nguyên.
- Sinh lại: `cd backend && npm run openapi:gen` (drift-guard backend), rồi `cd web && npm run api:gen` (drift-guard web) — **cùng commit**.
- 9 field còn lại (`OrderResponseDto.discount`, `OrderListItemDto.assigneeAccountId`, `OrderVersionItemDto.{confirmedAt, createdByAccountId, createdByDisplayName}`, `AttachmentItemDto.{statusFrom, statusTo}`, `RecordPaymentResponseDto.autoTransition`, `InvoiceDetailResponseDto.pdf`) thuộc module của **10.5** — KHÔNG sửa ở đây, ghi vào Dev Notes 10.5 qua mục "Câu hỏi mở / bàn giao".
- Thêm **guard backend** chặn tái phát (`backend/test/openapi-no-untyped-object.spec.ts` hoặc mở rộng spec drift sẵn có): mọi property `type: "object"` không `properties`/`additionalProperties`/`$ref`/`allOf` trong các schema thuộc danh sách trên ⇒ ĐỎ. Allowlist là đúng 9 field của 10.5 (khai tường minh, mỗi dòng ghi "Story 10.5"), mọi field ngoài allowlist ⇒ đỏ — nên field mới thêm sau này cũng bị bắt. Chống-rỗng: số property quét ≥ 500 và tự kiểm dương: allowlist ≠ rỗng ⇒ trước khi 10.5 sửa, quét PHẢI thấy đúng 9 phần tử allowlist (assert từng cái còn hiện diện, để allowlist không giữ field đã sửa). Mutant: xoá `type: String` ở `CreateCustomerRequestDto.nationalId` + regen ⇒ ĐỎ.

### 3. 🔥 BẪY SỐ 2 — Sidebar nằm TRONG từng màn, shell cấm import router

Router ở composition root không với tới `<Sidebar>` (19 màn tự render nó, không truyền `onNavigate`). Hai cách sai:
- Thêm prop `onNavigate` vào 17 màn ⇒ đổi chữ ký mọi màn, màn nào quên thì sidebar chết ở đúng màn đó (chính lý do `filterNav` đặt gate trên dữ liệu — comment `permissions.ts`).
- Import `react-router` vào `Sidebar.tsx` ⇒ `shell-tsx.test.mjs` ĐỎ (shell thuần trình bày, AD-1/2).

**Cách đúng (D3):** context trình bày trong shell, không biết gì về router:

```ts
// design-system/shell/Sidebar.tsx (thêm)
export interface SidebarNavValue {
  /** Emits the clicked key; the app layer maps it to a route. */
  onNavigate?: (key: string) => void;
  /** Keys the app can open. Absent = every key (Story 1.9 behaviour, tests/demo). */
  availableKeys?: ReadonlySet<string>;
}
export const SidebarNavContext = createContext<SidebarNavValue>({});
```

- Trong `Sidebar`: đổi tham số `onNavigate` thành `onNavigate: onNavigateProp`, rồi `const nav = useContext(SidebarNavContext); const onNavigate = onNavigateProp ?? nav.onNavigate;` — lời gọi vẫn là `onNavigate?.(key)` ⇒ regex guard giữ nguyên. Prop thắng context (giữ hành vi cũ cho caller truyền tay).
- Lọc thêm `link => !nav.availableKeys || nav.availableKeys.has(link.key)` **sau** `sections` (bỏ section rỗng giống `filterNav`). Gate quyền vẫn là `filterNav` ở màn — context chỉ thêm "app có màn này chưa".
- Export `SidebarNavContext` + type qua `shell/index.ts`. Không router, không `useNavigate` trong shell.
- Thêm ca vào design-system `components/shell-behavior.test.mjs` (hoặc vitest web): prop thắng context; `availableKeys` bỏ link và section rỗng.

### 4. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — File mới / đổi:**

```
web/src/api/http-me-port.ts                 # MePort
web/src/api/http-password-port.ts           # PasswordPort
web/src/api/http-customers-port.ts          # CustomersPort
web/src/api/http-customer-sources-port.ts   # CustomerSourcesPort
web/src/api/http-catalog-port.ts            # CatalogPort
web/src/api/http-settings-port.ts           # SettingsPort
web/src/api/http-warranty-port.ts           # WarrantyPort
web/src/app/routes.ts                       # nav key ⇄ path, MỘT bảng
web/src/app/AppRoutes.tsx                   # <Routes> + gate quyền + Sidebar context; nhận ports qua props
web/src/main.tsx                            # composition root (viết lại)
```

`web/src/app/` = tầng ứng dụng (router, màn ráp với port). **Không** dựng adapter ở đó — `AppRoutes` nhận `ports: AppPorts` từ `main.tsx` (spine AD-12: composition root là nơi DUY NHẤT ráp port với adapter).

**D2 — Router:** `react-router@8.4.0` (dep runtime, ghim chính xác như mọi dep web). Đo 2026-10-22: 8.4.0 phát hành 2026-09-15 (8.5.0 mới 3 ngày — chọn bản ≥ 2 tuần), peer `react/react-dom >=19.2.7` (web đang 19.2.7 ✓), `engines.node >=22.22` ✓, export từ `'react-router'`: `BrowserRouter`, `MemoryRouter`, `Routes`, `Route`, `Navigate`, `Outlet`, `useNavigate`, `useParams`. **Chế độ thư viện** (mặc định §6.11): `BrowserRouter` + `<Routes>` khai báo — KHÔNG `createBrowserRouter`/`RouterProvider`/loader/action, không SSR, không framework mode. `npm i -E react-router@8.4.0`, không `--legacy-peer-deps`; `package-lock.json` `git add -f`.

**D3 — Điều hướng sidebar:** mục 3.

**D4 — Bảng route (`app/routes.ts`) — path tiếng Anh (code), nhãn hiển thị vẫn ở `SIDEBAR_NAV`:**

| Nav key | Path | Màn | Gate (lấy từ link `SIDEBAR_NAV`) |
|---|---|---|---|
| `customers` | `/customers` | `CustomerListScreen` | `customers.manage` |
| (con) | `/customers/lookup` | `CustomerPickScreen` (nút "Thêm" của danh sách) | như `customers` |
| (con) | `/customers/:phone` | `CustomerDetailScreen` (`sdt` = `decodeURIComponent(phone)`) | như `customers` |
| `warranty` | `/warranty` | `WarrantyLookupScreen` | any-of `orders.view_all`/`orders.view_own` |
| `settings` | `/settings` | `CustomerSourceConfigScreen` | `settings.manage` |
| `profile` | `/profile` | `ProfileScreen` | không gate |
| — | `/login`, `/forgot-password` | màn auth (`sidebar={null}`) | chỉ khi CHƯA đăng nhập |

- **Gate route = cùng dữ liệu gate nav**: một route mở được ⇔ `filterNav(SIDEBAR_NAV, perms)` còn link có key đó. Không viết lại danh sách quyền lần hai trong `routes.ts` (AD-17: cấm literal quyền ngoài registry; một nguồn gate). Route con kế thừa key cha.
- `availableKeys` truyền vào `SidebarNavContext` = tập key có route ở bảng này ⇒ `orders`/`inventory` ẩn tới 10.5 (10.5 thêm route ⇒ hiện lại), `home`/`catalog`/`permissions`/`audit` ẩn tới khi có màn. **Không** làm màn "đang xây dựng" (màn giả, không có dữ liệu thật).
- `/` và path lạ ⇒ `<Navigate replace>` tới **route đầu tiên user được mở** theo thứ tự `SIDEBAR_NAV` (vd KE_TOAN không có `customers.manage` ⇒ vào `/warranty`); không có gì ⇒ `/profile` (luôn mở được). Path có quyền nhưng thiếu quyền ⇒ cùng đích đó (route không render — UX-DR-22, AD-4). Backend vẫn chặn mọi request (403 ⇒ màn hiện lỗi envelope).
- Chưa đăng nhập + path bất kỳ ⇒ `/login` (giữ path định vào trong `state` là KHÔNG cần — YAGNI; đăng nhập xong về `/`).
- Callback màn → điều hướng: `CustomerListScreen.onOpen(phone)` ⇒ `/customers/${encodeURIComponent(phone)}` (E.164 có `+`), `onAdd` ⇒ `/customers/lookup`; `CustomerPickScreen.onSelect(c)` ⇒ `/customers/${encodeURIComponent(c.phone)}`; `ForgotPasswordScreen.onBackToLogin` ⇒ `/login`; `LoginScreen.onForgotPassword` ⇒ `/forgot-password`, `onLoggedIn` ⇒ `/`. `CustomerDetailScreen.onEdit`: **không truyền** (chưa có màn sửa khách — câu hỏi mở 2).

**D5 — Composition root (`main.tsx`) — luồng phiên:**
- Top-level (ngoài React, một lần): `session`, `transport`, `client`, rồi **mọi** adapter `new Http*Port(client, …)` gom vào `const ports: AppPorts = { auth, me, password, customers, customerSources, catalog, settings, warranty }`. `catalog` chưa màn nào dùng ở 10.4 (picker của `CreateQuoteScreen` nối ở 10.5) — vẫn dựng để AC-3 đủ, **không** dựng route cho nó.
- `App`: `status: 'restoring' | 'signedOut' | 'signedIn'` (thay 4 view của 10.3). `restoring` ⇒ `null` như 10.3. `onSessionExpired` ⇒ `signedOut` (router đưa về `/login`).
- `signedIn` ⇒ `<PermissionsProvider key={sessionKey} port={ports.me}>` bọc `AppRoutes`. `key` tăng mỗi lần đăng nhập ⇒ `/me` được gọi lại cho account mới (provider chỉ fetch lúc mount — đăng xuất A rồi đăng nhập B mà không remount ⇒ B thấy quyền của A).
- `usePermissions().status`: `loading` ⇒ `<Skeleton>` trong `WebShell sidebar={null}`; `error` ⇒ `<ErrorState message="Không tải được thông tin tài khoản." onRetry={…} />` ("Thử lại" tăng `sessionKey` ⇒ remount ⇒ gọi `/me` lại) + nút Đăng xuất (đừng nhốt user ở màn lỗi). Props thật: `ErrorState { message, onRetry?, retryLabel? }`, `Skeleton { width?, height?, radius?, className? }` (bài học: `Skeleton` từng bị dùng sai prop).
- Đăng xuất: `ProfileScreen` thêm prop **tùy chọn** `onLogout?: () => void` ⇒ khi có, render `<Button variant="ghost" type="button">Đăng xuất</Button>` (`ButtonVariant` chỉ có `default|primary|accent|ghost|danger` — không có `secondary`) dưới thẻ Hồ sơ. Root truyền `async () => { await ports.auth.logout(); setStatus('signedOut'); }`. Prop tùy chọn ⇒ không đổi chữ ký màn với caller cũ; `profile.test.mjs` chỉ đòi các nhãn có sẵn tồn tại ⇒ nhãn thêm không làm đỏ. Mobile twin của nút này là việc 10.7 — ghi một dòng comment.
- Xoá khung tạm "Đã đăng nhập." của 10.3 (thay bằng router).
- Comment đầu `main.tsx` viết lại: đây LÀ composition root (AD-12).

**D6 — Adapter: khuôn chung (theo `http-auth-port.ts`):**
- `constructor(private readonly client: ApiClient)`; mỗi method một lời gọi `this.client.GET|POST|PATCH|PUT|DELETE('<path>', { params: { path, query }, body })` — path + type từ `paths` sinh, **không** khai tay URL template ghép chuỗi.
- Lỗi: transport đã ném `ApiError` trước khi tới adapter ⇒ adapter **không** `try/catch` để đổi lỗi (lỗi đi nguyên tới màn; `ApiError` là siêu tập `*PortError` — đã chứng minh ở 10.3 AC-11). `data` rỗng ở nhánh thành công ⇒ `throw new ApiError(GENERIC_ERROR_MESSAGE)` (khuôn `HttpAuthPort.login`). Với 204 (`DELETE /customer-sources/{id}`, `POST /auth/reset-password`, `/auth/change-password`) **không** đòi `data`.
- Không logic nghiệp vụ, không chuẩn hoá SĐT (AD-9), không tính toán — chỉ map tham số → request và response → kiểu port.

**D7 — Map từng port (đã đối chiếu `openapi.json`):**

| Port.method | Request | Response → port |
|---|---|---|
| `MePort.fetchMe()` | `GET /me` | `MeResponseDto` (y hệt `MeResponse`) |
| `PasswordPort.requestResetCode(email)` | `POST /auth/forgot-password {email}` | `ForgotPasswordResponseDto` → `{ expiresInSeconds }` |
| `.resetPassword(i)` | `POST /auth/reset-password {email, code, newPassword}` | void (204) |
| `.changePassword(i)` | `POST /auth/change-password {currentPassword, newPassword}` | void. **401 "Mật khẩu hiện tại không đúng" KHÔNG đăng xuất** — transport 10.3 đã lo (phát lại 1 lần rồi ném) |
| `CustomersPort.lookup(sdt)` | `GET /customers/lookup?phone=<thô>` | `CustomerLookupResponseDto` |
| `.list(q)` | `GET /customers?q&custType&page&pageSize` (bỏ key `undefined`) | `CustomerListResponseDto` |
| `.get(sdt)` | `GET /customers/{phone}` (openapi-fetch tự encode path param — **kiểm** `+` ra `%2B`; nếu không, ca test sẽ bắt) | `CustomerResponseDto` |
| `.create(i)` | `POST /customers` body `CreateCustomerRequestDto` | `CustomerResponseDto` |
| `.listSources()` | `GET /customer-sources` (không `includeInactive` ⇒ chỉ nguồn đang bật, đúng cho form tạo khách) | `CustomerSourceResponseDto[]` |
| `CustomerSourcesPort.list(includeInactive)` | `GET /customer-sources?includeInactive=true\|false` (spec khai `boolean` ⇒ truyền nguyên `boolean`, openapi-fetch tự ra `true`/`false`) | `CustomerSourceResponseDto[]` |
| `.create/.update/.reactivate` | `POST /customer-sources`, `PATCH /customer-sources/{id}`, `POST /customer-sources/{id}/reactivate` | `CustomerSourceResponseDto` |
| `.deactivate(id)` | `DELETE /customer-sources/{id}` | void |
| `CatalogPort.listProducts(search?)` | `GET /products` (mặc định chỉ hàng đang bán) | `ProductResponseDto[]` → `CatalogProduct` (**bỏ `costPrice`**, xem dưới) |
| `.listGroups()` | `GET /product-groups` | `ProductGroupResponseDto[]` → `CatalogGroup` |
| `.getGroup(id)` | `GET /product-groups/{id}` | `ProductGroupDetailResponseDto` → `CatalogGroupDetail` |
| `SettingsPort.getVatRate()` / `updateVatRate(p)` | `GET` / `PATCH /settings/vat-rate {ratePercent}` | `VatRateResponseDto.ratePercent` |
| `.getCompanyLegalEntity()` / `updateCompanyLegalEntity(i)` | `GET` / `PUT /settings/company-legal-entity` | `CompanyLegalEntityDto` |
| `WarrantyPort.lookup(sdt)` | `GET /orders/warranty-lookup?phone=<thô>` | `WarrantyLookupResponseDto` |

- **`listProducts(search)`: backend KHÔNG có tham số tìm** (`GET /products` chỉ có `includeInactive`). Adapter gọi một lần rồi lọc theo `name`/`sku` chứa chuỗi (không phân biệt hoa thường) — **đúng hành vi `FakeCatalogPort` hiện có** (dòng 107-117). Đây là lọc hiển thị trên danh sách backend trả, không phải luật nghiệp vụ. Danh mục ~ vài trăm dòng, ~20 user ⇒ chấp nhận; ghi comment.
- **`costPrice` không được rời adapter**: `ProductResponseDto.costPrice` có trong response khi caller có `costs.view`. `CatalogProduct` là phép chiếu — dựng object tường minh từng field (không spread `...p`), để `costPrice` không lọt vào state màn. Test assert `'costPrice' in result[0] === false` với response có `costPrice`.

**D8 — Type dữ liệu port = type sinh (AD-12, AC-5):**
- Mỗi type dữ liệu trong 7 port trở thành alias/phép chiếu của `components['schemas'][…]` từ `../../api/generated/schema` (type-only import — không kéo runtime vào design-system):
  - `MeResponse = MeResponseDto`; `Customer = CustomerResponseDto`; `CustomerSource = CustomerSourceResponseDto` (thêm field `active` — vô hại); `CustomerLookup`, `CustomerPage`, `CreateCustomerInput = CreateCustomerRequestDto` (sau khi sửa Bẫy 1); `CustomerSourceRow = CustomerSourceResponseDto`; `Create/UpdateCustomerSourceInput = …RequestDto`; `CompanyLegalEntity = CompanyLegalEntityDto`; `Warranty* = Warranty*Dto`; `CatalogProduct = Pick<ProductResponseDto, 'id'|'name'|'sku'|'unit'|'price'|'priceEditable'|'warrantyMonths'|'isActive'>` (không có `costPrice`); `CatalogGroup = Pick<ProductGroupResponseDto, 'id'|'name'|'description'|'isActive'>`; `CatalogGroupItem = ProductGroupItemResponseDto`.
  - `CustomerListQuery`: lấy từ `paths['/customers']['get']['parameters']['query']`.
  - `WarrantyLine.warrantyStatus`: spec là `string` ⇒ màn giữ `switch` hiện có + nhánh `default` an toàn (không throw) — **đọc** `WarrantyLookupScreen.tsx:68` trước khi đổi.
- **Tên field đổi theo contract** (đây là hệ quả của 10.2, không phải đổi chữ ký method): `sdt→phone`, `cccd→nationalId`, `chotAt→confirmedAt` ở `customers-port.ts`, `warranty-port.ts`, hai fake, và mọi màn đọc chúng: `CustomerListScreen` (`customer.sdt` dòng 187), `CustomerDetailScreen`, `CustomerPickScreen` (cả `fieldErrors.cccd` dòng 218 ⇒ `fieldErrors.nationalId`, và lỗi SĐT giờ về `field: 'phone'`), `WarrantyLookupScreen`, `CreateQuoteScreen` (chỉ `picked.sdt` ⇒ `picked.phone` khi gọi `ordersPort.create({ customerSdt: … })` — `OrdersPort` giữ nguyên tới 10.5).
- **Chữ ký method giữ nguyên**, kể cả tên tham số `lookup(sdt: string)` (guard parity web↔mobile ghim chuỗi này — mục 5).
- Interface `*PortError` của 7 port: giữ (màn đang dùng; `ApiError` gán được vào chúng).
- Comment `TODO(app-runtime…)` ở đầu 7 port: sửa cho đúng hiện trạng (adapter ở `web/src/api/http-*-port.ts`).

**D9 — Fake (AC-5):** 7 fake trong phạm vi viết lại theo type mới (field `phone`/`nationalId`/`confirmedAt`, `CustomerSource.active`), vẫn export từ `index.ts` khối "TEST/DEMO-ONLY". Chỉ test/demo dùng. Fake của 10.5 (orders, inventory, …) KHÔNG đụng.

### 5. Hiện trạng phải giữ (guard sẽ đỏ nếu quên)

- `design-system/session/parity.test.mjs`: bảng twin file + `lookup(sdt: string)` cho warranty (dòng 352), 5 method customers. **Mobile chưa đổi field tới 10.7** ⇒ chỗ guard so tên FIELD giữa hai nền tảng phải học bảng ánh xạ một chiều "web theo contract, mobile còn tên cũ tới 10.7": `screens/customers.test.mjs:399` (`orDash(customer.cccd` ở cả hai) ⇒ web dùng `nationalId`. Làm như `CONTRACT_TO_CLIENT_FIELD` của 10.2: bảng nhỏ, **mỗi entry phải được dùng** (assert), comment "xoá khi mobile 10.7 đổi". KHÔNG nới guard bằng cách bỏ field.
- `screens/warranty-lookup.test.mjs` và `customers.test.mjs` có thể ghim chuỗi `sdt`/`chotAt` trong màn web — chạy `cd design-system && npm test` ngay sau khi đổi field, sửa đúng chỗ, không xoá assert.
- `shell-tsx.test.mjs`: shell không import router; `Sidebar` khớp `/onNavigate\?\.\(/`.
- `screens-render.test.tsx`: `SCREEN_COUNT = 19` — không thêm file `*Screen.tsx` (`AppRoutes.tsx` không đuôi `Screen`); render vẫn qua fake (đây là lane trình bày). Fixture đổi field mới.
- `no-network-outside-transport.test.ts`: adapter KHÔNG gọi `fetch`, chỉ `client.*`; `openapi-fetch` chỉ ở `client.ts`.
- `css-class-coverage.test.ts`: ưu tiên KHÔNG thêm className mới (dùng component sẵn có).
- `app-entry.test.tsx` (10.3): viết lại theo luồng mới (đăng nhập ⇒ `/me` ⇒ màn đích; Đăng xuất từ Hồ sơ). Stub `fetch` phải có `GET /me`.
- `profile.test.mjs`: không `<button>` trần (dùng `<Button>`), không literal quyền.
- Money guard: story không hiển thị tiền mới; đừng viết chữ "đồng" trong mô tả số không phải tiền (bài học 7.3).
- Ngôn ngữ: code/comment/test name tiếng Anh; chuỗi UI tiếng Việt.

### 6. Phạm vi

**TRONG:** 7 adapter + test; type port = type sinh + đổi field ở màn/fake trong phạm vi; sửa metadata Swagger 15 field (Bẫy 1) + regen 2 nơi + guard; `react-router`; `SidebarNavContext`; `app/routes.ts` + `AppRoutes.tsx`; `main.tsx` composition root + `PermissionsProvider`; nút Đăng xuất ở Hồ sơ; guard composition root; docs G-5.

**NGOÀI (đừng làm):** adapter orders/inventory/stock-vouchers/payments/contracts/invoices + route của chúng + 3 nút chi tiết đơn (10.5); 9 field `object` của module đơn/tiền (10.5); màn quản lý danh mục, dashboard, phân quyền, audit (không có màn); màn sửa khách (`onEdit`); mobile (10.6–10.8); đổi `WebFrame` pill URL giả (`app.phuongnamsolar.vn/...` — trình bày của design system, giữ nguyên); refresh chủ động; nhớ path định vào trước khi đăng nhập.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md` Story 10.4)

1. **Given** `web/src/main.tsx`, **When** khởi động, **Then** thành **composition root** duy nhất: tạo transport, ráp port với adapter HTTP, bọc `PermissionsProvider` từ `/me`; không import fake nào (guard, chống-guard-rỗng) [Source: ARCHITECTURE-SPINE AD-12].
2. **Given** router (mặc định `react-router`), **When** đăng nhập xong, **Then** sidebar (Story 1.9) điều hướng tới màn thật; route của mục không có quyền không render và không có trong nav (UX-DR-22, AD-4); chưa đăng nhập ⇒ về Đăng nhập.
3. **Given** port me, password, customers, customer-sources, catalog (sản phẩm, giá, gói vật tư), settings (VAT, pháp nhân), warranty, **When** dùng adapter, **Then** mỗi adapter cài đúng interface port hiện có bằng client sinh (10.3), không đổi chữ ký port mà màn đang dùng; method port tên tiếng Việt (nếu có) đổi sang tiếng Anh cùng caller.
4. **Given** mỗi adapter, **When** test, **Then** có ca map response thành công + một ca lỗi envelope qua transport giả lập HTTP (không qua fake port).
5. **Given** fake port, **When** dùng, **Then** chỉ còn trong test/demo, viết lại theo type sinh; smoke render mọi màn (`screens-render.test.tsx`) vẫn xanh.

### AC dẫn xuất (đo được)

6. `web/package.json` có `"react-router": "8.4.0"` (chính xác, trong `dependencies`); `npm install` sạch không `--legacy-peer-deps`/`--force`; `package-lock.json` cập nhật + commit (`git add -f`).
7. **Guard composition root** (`web/src/test/composition-root.test.ts`, khuôn `import.meta.glob(..., { query: '?raw', eager: true })` + bỏ comment như guard mạng):
   - a. `main.tsx` và mọi file dưới `web/src/app/` + `web/src/api/` **không** chứa định danh `Fake\w*Port`, `DEMO_[A-Z_]+`, `DEMO_ME`, và không import module `fake-*`.
   - b. `createTransport(`, `createApiClient(` và `new Http\w+Port(` chỉ xuất hiện trong `main.tsx` (ngoài `web/src/test/`) — composition root là nơi DUY NHẤT ráp.
   - c. Chống-rỗng: số file quét ≥ 10; tự kiểm dương: `main.tsx` PHẢI khớp `createTransport(` **và** `PermissionsProvider` **và** đủ 8 `new Http…Port(` (auth + 7 port của 10.4).
   - d. Mutant: thêm `import { FakeMePort } from './design-system/session'` vào `main.tsx` ⇒ ĐỎ; `new HttpCustomersPort(` trong `AppRoutes.tsx` ⇒ ĐỎ; xoá `PermissionsProvider` khỏi `main.tsx` ⇒ ĐỎ.
8. **Mỗi adapter** (`web/src/test/http-<port>-port.test.ts`, `// @vitest-environment node`, dựng `createTransport` + `createApiClient` thật với `fetchImpl` = `vi.fn` — khuôn `http-auth-port.test.ts`): ≥1 ca thành công assert **method + path + query/body** của request (đọc từ `Request` mà `fetchImpl` nhận) và kết quả map; ≥1 ca envelope lỗi (400 `fieldErrors` hoặc 409/403) ⇒ reject `ApiError` mang đúng `status`/`code`/`message`/`fieldErrors`. Đếm lời gọi bằng `toHaveBeenCalledTimes`. Thêm các ca riêng:
   - a. `CustomersPort.get('+84903176968')` ⇒ path request là `/customers/%2B84903176968` (encode `+`); `lookup('0903 176 968')` ⇒ query `phone=0903+176+968` hoặc `%20` — **chuỗi thô, không chuẩn hoá** (AD-9).
   - b. `CustomersPort.list({ q: 'an' })` ⇒ query không chứa `custType`/`page` khi vắng.
   - c. `CatalogPort.listProducts('PIN')` với response 3 sản phẩm (1 khớp name, 1 khớp sku, 1 không) ⇒ 2 kết quả; mọi kết quả **không** có key `costPrice` dù response có.
   - d. `CustomerSourcesPort.list(true)` ⇒ query `includeInactive=true`; `deactivate` nhận 204 ⇒ resolve `undefined`.
   - e. `PasswordPort.changePassword` nhận 401 → refresh OK → phát lại 401 ⇒ reject `ApiError` 401, **không** gọi `onSessionExpired`.
   - f. `WarrantyPort.lookup` response `found:false` ⇒ resolve (không ném).
   - g. `SettingsPort.updateVatRate(10)` ⇒ body `{"ratePercent":10}`, resolve `10`.
9. Mutation adapter (ghi Dev Agent Record, backup `cp`, mutant compile được): (i) `CatalogPort` spread `...p` thay vì chiếu ⇒ ca 8c ĐỎ; (ii) `CustomersPort.get` tự ghép `` `/customers/${sdt}` `` không encode (nếu adapter phải tự làm) hoặc đổi `phone` → `sdt` trong `params` ⇒ ca 8a ĐỎ (hoặc tsc đỏ — ghi rõ cái nào); (iii) adapter nuốt lỗi (`catch { return … }`) ở một port ⇒ ca envelope của port đó ĐỎ.
10. **Router + gate** (`web/src/test/app-routes.test.tsx`, jsdom, `MemoryRouter` + `PermissionsProvider` với `FakeMePort` — test lớp ứng dụng, không phải composition root):
    - a. Account chỉ có `orders.view_own` (không `customers.manage`, không `settings.manage`): sidebar **không** có "Khách hàng", "Cấu hình", "Đơn hàng", "Kho", "Trang chủ", "Danh mục", "Phân quyền", "Audit"; có "Tra cứu bảo hành", "Hồ sơ". Mở `/customers` ⇒ không render `CustomerListScreen` (không có topbar "Khách hàng"), về `/warranty`.
    - b. Account đủ quyền: bấm "Khách hàng" ⇒ hiện `CustomerListScreen` (đã tải dữ liệu từ port); bấm dòng ⇒ `CustomerDetailScreen` với SĐT đúng (`+` qua được URL); "Cấu hình" ⇒ `CustomerSourceConfigScreen`.
    - c. `/` ⇒ route đầu tiên được mở theo thứ tự nav; account không quyền nghiệp vụ nào ⇒ `/profile`.
    - d. `availableKeys` của context = đúng tập key có route (assert bằng chính bảng `routes.ts`, không gõ lại tay).
    - e. Mutant: bỏ kiểm quyền ở route (`Route` render bất kể `filterNav`) ⇒ ca 10a ĐỎ; bỏ `availableKeys` ⇒ ca "không có Đơn hàng/Kho" ĐỎ.
11. **Composition root đầu-cuối** (`app-entry.test.tsx` viết lại; chỉ stub `fetch`): không refresh token ⇒ Đăng nhập; đăng nhập 200 ⇒ gọi `GET /me` **đúng 1 lần** (StrictMode cho phép effect chạy 2 lần — đếm và ghi đúng số đo được, giải thích nếu là 2) ⇒ hiện màn đích theo quyền `/me`; `/me` 500 ⇒ `ErrorState`, "Thử lại" gọi `/me` lần nữa; Đăng xuất ở Hồ sơ ⇒ `POST /auth/logout` + về Đăng nhập + `pns.refreshToken` bị xoá; đăng xuất A rồi đăng nhập B ⇒ `/me` gọi lại và sidebar theo quyền B; refresh hỏng giữa phiên ⇒ về Đăng nhập. Quên mật khẩu đi qua `POST /auth/forgot-password` thật (stub), **không** còn `FakePasswordPort`.
12. **Bẫy 1**: sau khi sửa, `jq` trên `openapi.json` ⇒ 0 property `type:"object"` trần trong 9 schema của mục 2; `schema.d.ts` không còn `Record<string, never>` ở các field đó (còn đúng 9 ở module 10.5). Guard backend mục 2 có chống-rỗng + tự kiểm allowlist + mutant ĐỎ. e2e customers/customer-sources/warranty/products hiện có xanh **không sửa assert**.
13. `SidebarNavContext`: test prop thắng context; `availableKeys` lọc link + bỏ section rỗng; `shell-tsx.test.mjs` xanh không nới regex.
14. Type port = type sinh: `customers-port.ts`, `warranty-port.ts`, `customer-sources-port.ts`, `settings-port.ts`, `catalog-port.ts`, `me-port.ts` **không còn** khối `interface` khai field contract bằng tay (chỉ alias/`Pick` từ `components['schemas']`, trừ `*PortError` và interface port). Kiểm bằng một assert trong guard 7 hoặc test riêng: các file này phải import `api/generated/schema` (chống-rỗng: ≥6 file).
15. Màn đọc field mới: `grep -rn "\.sdt\b\|\.cccd\b\|chotAt\|fieldErrors\.cccd" web/src/screens/{customers,warranty} web/src/design-system/session/{customers,warranty,fake-customers,fake-warranty}*` ⇒ rỗng (tham số `sdt` của method/props và state cục bộ `sdt` của form được phép — chỉ cấm đọc field contract cũ).
16. 5 lane xanh: backend `npm test` (+ `npm run build`), `npm run test:db` (không đổi DB — xác nhận không vỡ), design-system `npm test`, web `npm run typecheck && npm test && npm run build`, mobile `flutter analyze && flutter test` (không đụng mobile — xác nhận). Backend lint: chỉ file mình sửa không thêm lỗi (lint toàn repo đỏ sẵn từ baseline).
17. **Smoke tay** (luật 13, Dev Agent Record): backend local (`npm run build` → `npm run start:prod`, `JWT_ACCESS_SECRET` ngẫu nhiên ≥32 ký tự chỉ trên lệnh, KHÔNG đọc/sửa `.env`) + `pns-postgres` 5433 + `npm run dev` web, Playwright. Hai account smoke riêng tạo thẳng vào Postgres 5433 (băm **argon2id** như `PasswordService` — 10.3 đã đo backend dùng argon2, không phải bcrypt): (A) quyền `customers.manage` + `settings.manage` + `catalog.view` + `orders.view_all`; (B) chỉ `orders.view_own`. Với A: đăng nhập ⇒ sidebar có Khách hàng/Tra cứu bảo hành/Cấu hình/Hồ sơ, KHÔNG có Đơn hàng/Kho/Trang chủ/Danh mục; danh sách khách tải từ DB; tra SĐT + tạo khách mới (nguồn "Khác" ⇒ bắt nhập ghi chú, lỗi envelope hiện đúng ô); mở chi tiết khách; Cấu hình: đổi VAT rồi trả lại giá trị cũ, thêm/tắt/bật một nguồn khách smoke (tên riêng) rồi tắt lại; tra cứu bảo hành một SĐT; reload ⇒ giữ phiên + đúng route; Đăng xuất từ Hồ sơ. Với B: chỉ thấy Tra cứu bảo hành + Hồ sơ; gõ `/settings` ⇒ bị đưa về `/warranty`. Dọn: xoá 2 account smoke, nguồn khách smoke để **tắt** (không hard delete được — ghi tên vào Dev Agent Record), khách smoke tạo ra: ghi SĐT vào Dev Agent Record (không có API xoá khách; dùng SĐT giả rõ ràng dạng `0900 000 xxx`), trả VAT về giá trị ban đầu, tắt backend + vite. Docker chưa chạy ⇒ ghi "smoke chưa chạy" + nhờ Đại Ca bật Docker Desktop (không giả kết quả).
18. G-5 cùng commit: bullet "Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.4)" vào `epics.md` Story 10.4 (react-router 8.4.0 chế độ thư viện; `SidebarNavContext` + `availableKeys` ẩn mục chưa có màn; path route tiếng Anh; sửa metadata Swagger 15 field `object`; `listProducts` lọc phía adapter vì backend không có tham số tìm; nút Đăng xuất ở Hồ sơ); `project-context.md` dòng "Web tooling" (composition root + router + guard composition root); `sprint-change-proposal-2026-10-22.md` không cần sửa trừ khi đổi một mặc định §6.

---

## Tasks / Subtasks

- [x] **T1 — Bẫy 1: metadata Swagger + regen** (AC 12)
  - [x] Sửa `@ApiProperty`/`@ApiPropertyOptional` 15 field (mục 2) trong `backend/src/customers/dto/{create-customer-request,update-customer-request,customer-lookup-response,create-customer-source-request}.dto.ts`, `backend/src/orders/dto/warranty-lookup-response.dto.ts`, `backend/src/catalog/dto/{create,update}-product-request.dto.ts` (đã grep: DTO nguồn khách nằm trong `customers/dto/`).
  - [x] `cd backend && npm run openapi:gen` ⇒ diff chỉ đổi `type` của đúng các field đó (đọc diff, không chấp nhận thay đổi khác).
  - [x] `cd web && npm run api:gen`.
  - [x] Guard backend (mục 2) + mutant.
  - [x] `npm test` backend xanh không sửa assert e2e.
- [x] **T2 — Type port = type sinh + fake + màn** (AC 3, 5, 14, 15)
  - [x] 6 file port: alias/`Pick` từ `components['schemas']` (D8); comment TODO cập nhật.
  - [x] Fake trong phạm vi theo field mới (D9).
  - [x] Màn: `CustomerList/Detail/Pick`, `WarrantyLookup`, `CreateQuoteScreen` (`picked.phone`); `fieldErrors.cccd` ⇒ `nationalId`.
  - [x] design-system guard: bảng ánh xạ web→mobile tạm (mục 5), mỗi entry phải được dùng.
  - [x] `cd web && npm run typecheck && npm test`; `cd design-system && npm test`.
- [x] **T3 — 7 adapter + test** (AC 3, 4, 8, 9)
  - [x] `web/src/api/http-{me,password,customers,customer-sources,catalog,settings,warranty}-port.ts` (D6, D7).
  - [x] 7 file test (AC 8) + mutation (AC 9).
- [x] **T4 — Router + Sidebar context** (AC 2, 6, 10, 13)
  - [x] `npm i -E react-router@8.4.0`.
  - [x] `SidebarNavContext` trong `Sidebar.tsx` + export `shell/index.ts` + test (AC 13).
  - [x] `app/routes.ts` (bảng D4 + hàm "route đầu tiên được mở" dùng `filterNav(SIDEBAR_NAV, perms)`), `app/AppRoutes.tsx` (`AppPorts` type, `<Routes>`, gate, `SidebarNavContext.Provider` với `onNavigate` = `navigate(pathOf(key))` + `availableKeys`).
  - [x] `app-routes.test.tsx` (AC 10) + mutant.
- [x] **T5 — Composition root** (AC 1, 7, 11)
  - [x] `main.tsx` theo D5 (`BrowserRouter`, 3 trạng thái, `PermissionsProvider key`, loading/error, Đăng xuất); gỡ `FakePasswordPort`.
  - [x] `ProfileScreen` prop `onLogout?` (D5).
  - [x] `composition-root.test.ts` (AC 7) + mutant; viết lại `app-entry.test.tsx` (AC 11).
  - [x] `npm run build`; `grep -r localhost:3000` trên thư mục bundle ⇒ rỗng (hook chặn chữ "dist"/"build" trong Bash — dùng Grep tool, bài học scout-block).
- [x] **T6 — Docs G-5 + 5 lane + smoke** (AC 16, 17, 18)
  - [x] `epics.md` bullet tinh chỉnh; `project-context.md`.
  - [x] 5 lane; smoke tay; Dev Agent Record (bảng mutant, số lane, smoke, dọn dẹp).
  - [x] `git check-ignore -v` từng file mới (bài học `.gitignore` `assets/`).

---

## Dev Notes

### Smoke đầu-cuối (Trợ Lý, 2026-10-22) — bắt buộc trước khi chuyển review

- backend/.env thiếu JWT_ACCESS_SECRET hợp lệ và mật khẩu seed nằm trong .env: KHÔNG đọc/sửa .env. Chạy backend bằng biến tạm ngay trên lệnh (JWT_ACCESS_SECRET ngẫu nhiên ≥32 ký tự), Postgres local 5433.
- Tạo account smoke RIÊNG (smoke-<story>@local.test, mật khẩu ngẫu nhiên, băm argon2id như backend, quyền vừa đủ) thẳng vào DB local; không đổi account có sẵn; xoá account smoke + tắt backend/vite khi xong.
- Smoke luồng chính của story trên client thật (web: vite + trình duyệt; mobile: chạy được thì chạy, không thì ghi rõ chưa chạy và vì sao).


### Quyết định đã chốt — không bàn lại

- Router `react-router` chế độ thư viện (mặc định §6.11) — version ghim 8.4.0 (D2).
- Composition root duy nhất ở `main.tsx`; fake không được import từ đó (spine AD-12 "Luật client").
- Fake giữ lại cho test/demo, viết lại theo type sinh (mặc định §6.20).
- Gating là UX; backend enforce mọi request (AD-4). Gate route dùng chung dữ liệu gate của nav (một nguồn).
- Không có route/màn giả cho mục chưa có màn: ẩn khỏi nav (UX-DR-22 "bề mặt không dùng được thì không xuất hiện").

### Files sẽ đổi / tạo

| File | Đổi gì |
|---|---|
| `backend/src/**/dto/*` (9 DTO, mục 2) | thêm `type` cho `@ApiProperty*` |
| `backend/openapi/openapi.json` | sinh lại |
| `backend/test/openapi-no-untyped-object.spec.ts` | MỚI (guard Bẫy 1) |
| `web/package.json`, `web/package-lock.json` | `react-router` 8.4.0 |
| `web/src/api/generated/schema.d.ts` | sinh lại |
| `web/src/api/http-{me,password,customers,customer-sources,catalog,settings,warranty}-port.ts` | MỚI |
| `web/src/app/routes.ts`, `web/src/app/AppRoutes.tsx` | MỚI |
| `web/src/main.tsx` | composition root |
| `web/src/design-system/shell/Sidebar.tsx`, `shell/index.ts` | `SidebarNavContext` |
| `web/src/design-system/session/{me,customers,customer-sources,catalog,settings,warranty}-port.ts` | type = type sinh |
| `web/src/design-system/session/fake-{me,customers,customer-sources,catalog,settings,warranty}-port.ts` (+ `fake-password-port.ts` nếu type đổi) | field mới |
| `web/src/screens/customers/{CustomerList,CustomerDetail,CustomerPick}Screen.tsx`, `warranty/WarrantyLookupScreen.tsx`, `orders/CreateQuoteScreen.tsx` (1 dòng), `account/ProfileScreen.tsx` (`onLogout?`) | field mới / nút Đăng xuất |
| `web/src/test/{composition-root.test.ts, app-routes.test.tsx, http-*-port.test.ts ×7}` | MỚI |
| `web/src/test/{app-entry.test.tsx, screens-render.test.tsx}` + test màn khác dùng fixture khách/bảo hành | theo luồng/field mới |
| `design-system/screens/{customers,warranty-lookup}.test.mjs`, `design-system/session/parity.test.mjs`, `design-system/components/shell-*.test.mjs` | ánh xạ field web↔mobile tạm; ca context |
| `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/project-context.md` | G-5 |

### Tình huống biên đã tính

- **E.164 trong URL:** `+84…` ⇒ `encodeURIComponent` khi tạo path, `useParams` trả chuỗi đã decode (react-router decode param) — test 10b phải dùng SĐT có `+` để bắt lỗi encode đôi/thiếu.
- **Hai lần `/me` do StrictMode:** `PermissionsProvider` có cờ `alive`, request thứ hai vô hại; AC 11 ghi số đo thật, không ép bằng cách bỏ StrictMode.
- **`/me` 401 sau khi access hết hạn:** transport refresh ⇒ phát lại; refresh hỏng ⇒ `onSessionExpired` ⇒ `signedOut` ⇒ `/login`.
- **Đổi mật khẩu thành công thu hồi mọi phiên** (`auth.service.ts:146`): request kế tiếp 401 → refresh hỏng → về Đăng nhập. `ProfileScreen` đã hiện "Đã đổi mật khẩu. Bạn cần đăng nhập lại." — đúng thiết kế backend, không thêm logic.
- **Account bị bỏ quyền giữa phiên:** UI còn hiện mục cũ tới lần tải `/me` kế; backend trả 403 ⇒ màn hiện lỗi envelope. Chấp nhận (AD-4); không polling `/me` (YAGNI).
- **KE_TOAN có `orders.view_all` nhưng `orders`/`inventory` chưa có route ở 10.4** ⇒ landing là `/warranty`. 10.5 thêm route ⇒ landing tự đổi về `/orders` theo thứ tự nav, không sửa logic.
- **`includeInactive`**: spec `GET /customer-sources` khai `boolean` (đã kiểm), còn `GET /products`/`/product-groups` thì controller đọc chuỗi `=== 'true'` — luôn để type sinh quyết, không ép `String(...)` nếu type là `boolean`.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Mutation: backup `cp`, **không** `git checkout` (code story chưa commit). Mutant phải compile (non-compiling mutant = đỏ giả). Ghi bảng mutant → kết quả.
- `toHaveBeenCalledTimes`, không `mock.calls[0]` để đếm.
- Guard mới: chống-rỗng + tự kiểm dương khớp **lời gọi thật**, không khớp chữ ký/interface (bài học 10.3: tự kiểm dương khớp nhầm `fetch(request: Request)`).
- Node 24 `localStorage` che jsdom: dùng `memoryStorage()` (`web/src/test/memory-storage.ts`).
- zsh: lệnh trong biến không word-split — vòng lặp mutant dùng function/array.
- Lane DB cần Docker Desktop GUI; agent không tự bật được.
- Hook scout-block chặn chữ `dist`/`build` trong lệnh Bash: dùng `npm run start:prod`, Grep tool cho bundle.

### Previous Story Intelligence (10.3, commit `cb30dee`)

- Khuôn adapter: `HttpAuthPort` — constructor nhận `ApiClient`; transport đã ném `ApiError`; `data` rỗng ⇒ `ApiError(GENERIC_ERROR_MESSAGE)`.
- openapi-fetch 0.17 gọi `fetch(Request)`; lỗi ném từ fetch tuỳ biến đi nguyên `instanceof` tới caller.
- `ApiError` gán được vào `OrderPortError`/`ContractsPortError`/`CustomerPortError`/`InvoicesPortError` không cast; `PaymentsPortError.code` bắt buộc ⇒ không gán thẳng (10.5).
- Review 10.3: guard mạng từng mù 8 dạng cú pháp — guard composition root của story này phải bỏ comment theo token (dùng lại hàm của `no-network-outside-transport.test.ts` nếu tách được thành helper test; nếu tách, cả hai guard dùng chung).
- Smoke 10.3: backend `.env` local thiếu `JWT_ACCESS_SECRET` hợp lệ ⇒ tiêm qua biến môi trường trên lệnh; account smoke băm argon2id; StrictMode chạy effect 2 lần nhưng single-flight giữ 1 lần rotate.
- Lane sau 10.3: web 17 file / 245 test; design-system 487/487; backend 118 suite / 2470; DB 26 / 322; mobile 455.

### Git intelligence

- `bf4e520` (10.1), `8d40504` (10.2), `cb30dee` (10.3): mỗi story MỘT commit `feat(story-10.x): …` tiếng Anh, gồm story file + sprint-status + docs G-5. `git add` đường dẫn cụ thể, không `-A`; `package-lock.json` `git add -f`. Push là bước tay của Đại Ca.

### Latest tech notes (đo 2026-10-22)

- `react-router@8.4.0`: deps `@remix-run/route-pattern ^0.22.1`, `cookie-es ^3.1.1`; peer `react/react-dom >=19.2.7`; entry `.` có types ở `dist/production/index.d.ts`; export library-mode đầy đủ (mục D2). Không cần `react-router-dom` (gộp vào `react-router` từ v7).
- Nếu `npm i` báo peer lỗi với TS 6 hay `@types/react`, xử lý như 10.3 (`overrides`), **cấm** `--legacy-peer-deps`; ghi vào tinh chỉnh G-5.

### Project Structure Notes

- Ranh giới: `design-system/` (trình bày + interface port + fake), `api/` (transport + adapter HTTP), `app/` (router, ráp màn với port — MỚI), `main.tsx` (composition root). Spine không liệt kê cây web chi tiết; AD-12 đã có luật client ⇒ không sửa spine.
- `design-system/session/*-port.ts` import type từ `api/generated/schema` là phụ thuộc type-only từ design-system sang file sinh — chấp nhận (đó chính là "type sinh" AD-12 đòi); KHÔNG import runtime từ `api/` vào design-system.

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. Mục "Danh mục" (quản lý sản phẩm/giá/gói) không có màn web nào từ Epic 3 ⇒ 10.4 ẩn. Muốn có màn thì cần story riêng (ngoài Epic 10).
2. Nút "Sửa" ở `CustomerDetailScreen` không có màn sửa (`PATCH /customers/{phone}` có ở backend nhưng port không có method `update`) ⇒ nút không làm gì như trước. Cần story riêng hoặc ẩn nút khi `onEdit` vắng.
3. Bàn giao 10.5: 9 field `type: object` của module đơn/tiền (mục 2) + allowlist guard phải về 0 ở 10.5.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 10, Story 10.4]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §2.4, §4.4, §6.11, §6.20]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-4, AD-9, AD-12 "Luật client" (dòng 125), AD-17]
- [Source: `_bmad-output/planning-artifacts/epics.md` UX-DR-15, UX-DR-22 (dòng 112, 119)]
- [Source: `_bmad-output/project-context.md` §Testing "Web tooling", §Coding style ngôn ngữ]
- [Source: `_bmad-output/implementation-artifacts/10-3-web-client-sinh-tu-openapi-phien-dang-nhap-va-xu-ly-loi-mot-cho.md` D3–D8, D13, Review]
- [Source: `web/src/api/{client,http-auth-port,transport,api-error}.ts`, `web/src/main.tsx`]
- [Source: `web/src/design-system/shell/Sidebar.tsx`, `gating/permissions.ts` (`filterNav`, `PERM`), `session/PermissionsProvider.tsx`]
- [Source: `backend/openapi/openapi.json` — paths `/me`, `/auth/*password*`, `/customers*`, `/customer-sources*`, `/products`, `/product-groups*`, `/settings/*`, `/orders/warranty-lookup`]
- [Source: `design-system/components/shell-tsx.test.mjs`, `design-system/session/parity.test.mjs`, `design-system/screens/customers.test.mjs:399`]

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, bmad-dev-story)

### Debug Log References

- Bẫy 1 đo lại bằng `jq`: **14** field trần (không phải 15) — `CustomerLookupResponseDto.customer` và `WarrantyLookupResponseDto.customer` vốn đã là `allOf/$ref`, type sinh đúng. Module 10.5 còn **6** field trần (không phải 9): `OrderResponseDto.discount`, `RecordPaymentResponseDto.autoTransition`, `InvoiceDetailResponseDto.pdf` là `allOf/$ref` ⇒ không trần theo đúng định nghĩa guard. Allowlist guard = 6 field thật (allowlist 9 sẽ đỏ ở assert "mỗi entry còn trần").
- `openapi:gen` diff: đúng 14 × `type: object → string|number` + 13 `nullable` + 1 `format: date-time`, không thay đổi khác. Spec có 529 property.
- Harness test adapter lần đầu dùng `createSessionStore(() => memoryStorage())` ⇒ mỗi lần đọc một storage mới, mất refresh token ⇒ ca 8e đỏ giả ("phiên hết hạn"). Sửa harness giữ một storage — transport đúng hành vi (phát lại 401 rồi ném, không expire).
- Tách `withoutComments`/`codeOnly` sang `web/src/test/source-text.ts` (dùng chung guard mạng + guard composition root); comment ví dụ `${fetch(x)}` trong helper làm guard mạng tự bắt chính nó (regex literal làm lệch tokenizer) ⇒ đổi câu comment.
- Không có Grep tool trong phiên ⇒ quét bundle bằng script node ở scratchpad: 3 file, 0 chỗ `localhost:3000`.

### Completion Notes List

- **T1** — `type` tường minh cho 14 field ở 6 DTO (`create/update-customer-request`, `create-customer-source-request`, `create/update-product-request`, `warranty-lookup-response`); regen `openapi.json` + `schema.d.ts` (còn đúng 6 `Record<string, never>` ở module 10.5). Guard `backend/test/openapi-no-untyped-object.spec.ts`: quét mọi schema, chống-rỗng ≥500 property, allowlist 6 field "Story 10.5" và assert từng entry còn trần. Mutant: bỏ `type: String` ở `CreateCustomerRequestDto.nationalId` + regen ⇒ ĐỎ (`+ "CreateCustomerRequestDto.nationalId"`). e2e không sửa assert.
- **T2** — 6 port (`me, customers, customer-sources, catalog, settings, warranty`) = alias/`Pick` của `components['schemas']`; `CustomerListQuery` lấy từ `paths['/customers']['get']`. Chữ ký method giữ nguyên. Fake + màn đổi field `phone/nationalId/confirmedAt`; `CustomerSource.active` vào fake. `fake-orders-port.ts` (10.5) chỉ đổi 3 dòng bắt buộc theo type (`c.phone`, `warrantyMonths ?? null`). Màn: `custType` thu hẹp về union khi gửi (Seg vẫn trả string), `orDash` nhận `undefined` (field optional trong type sinh), `formatNgay(don.confirmedAt ?? null)`.
- Guard design-system chuyển từ soi chuỗi trong port web sang soi alias + `openapi.json`/`schema.d.ts` (không bỏ assert): `customers.test.mjs` (bảng một chiều `WEB_TO_MOBILE_FIELD = { nationalId: 'cccd' }`, mỗi entry phải dùng, xoá khi mobile 10.7), `orders.test.mjs` (`picked.phone` web), `session.test.mjs` (MeResponse alias + field trong `MeResponseDto` sinh), `parity.test.mjs` (input nguồn khách alias DTO ghi, DTO không có `isOther/active`; `WarrantyLine` alias + field từ spec). Mutant đã kiểm: bỏ `orDash(customer.nationalId)`, đổi alias MeResponse, đổi alias WarrantyLine ⇒ mỗi cái 1 ĐỎ.
- **T3** — 7 adapter `web/src/api/http-*-port.ts` theo khuôn `HttpAuthPort` (không try/catch, `data` rỗng ⇒ `ApiError(GENERIC)`, 204 không đòi data). `HttpCatalogPort` dựng từng field (không spread) + lọc name/SKU phía adapter. 7 file test + harness dùng chung (`http-adapter-harness.ts`, transport + client thật, `fetchImpl = vi.fn`): 36 ca, gồm 8a–8g.
- **AC 9 mutation** (backup `cp`):

| Mutant | tsc | Kết quả |
|---|---|---|
| Catalog `...p` thay vì chiếu | 0 lỗi | 2 ca ĐỎ (8c + ca không search) |
| `get`: `phone: encodeURIComponent(sdt)` (encode đôi) | 0 | ca 8a ĐỎ |
| `get`: `params: { path: { sdt } }` | 1 lỗi | ca 8a ĐỎ |
| Warranty nuốt lỗi (`catch { return found:false }`) | 0 | ca envelope ĐỎ |
| `list` tự điền `page: 1` | 0 | ca 8b ĐỎ |

- **T4** — `react-router@8.4.0` (`npm i -E`, không cờ peer). `SidebarNavContext` (`onNavigate` + `availableKeys`) trong `Sidebar.tsx`, prop thắng context; `shell-tsx.test.mjs` xanh không nới. `app/routes.ts` (bảng `NAV_ROUTES`, `openableKeys`/`landingPath` từ `filterNav(SIDEBAR_NAV)`), `app/AppRoutes.tsx` (`AppPorts`, `SignedOutRoutes`, `AppRoutes` chờ `/me` rồi mới render route — tránh reload `/settings` bị đẩy đi khi perms còn rỗng). `sidebar-nav-context.test.tsx` 4 ca, `app-routes.test.tsx` 7 ca. Mutant: bỏ gate route ⇒ 2 ĐỎ; bỏ `availableKeys` ⇒ 2 ĐỎ (+1 tsc import thừa); `customerPath` không encode ⇒ 1 ĐỎ; landing luôn `/profile` ⇒ 4 ĐỎ.
- **T5** — `main.tsx` viết lại thành composition root: 8 adapter top-level, `BrowserRouter`, 3 trạng thái, `PermissionsProvider key={sessionKey}` (tăng mỗi lần đăng nhập + "Thử lại"), `/me` loading ⇒ `Skeleton`, lỗi ⇒ `ErrorState` + Đăng xuất. `FakePasswordPort` đã gỡ. `ProfileScreen.onLogout?` (nút `ghost` trong thẻ Hồ sơ, dùng lại `.profile-actions`). Guard `composition-root.test.ts` 7 ca (a–c + AC 14). Mutant: `FakeMePort` vào main ⇒ ĐỎ; `new HttpCustomersPort(` trong `AppRoutes.tsx` ⇒ ĐỎ; bỏ `PermissionsProvider` ⇒ ĐỎ (+1 tsc `sessionKey` thừa); port settings khai `interface` tay ⇒ ĐỎ. `app-entry.test.tsx` viết lại 10 ca.
- **AC 11 — `/me` sau đăng nhập đo được 2 lần**: StrictMode (dev/test) mount → unmount → mount provider mới ⇒ effect chạy 2 lần; lần đầu bị bỏ (cờ `alive`). Bản production 1 lần. Không bỏ StrictMode.
- **5 lane (sau toàn bộ thay đổi)**: backend `npm test` 119 suite / 2473 test + `npm run build` exit 0; `npm run test:db` 26 suite / 322 test; design-system 487/487; web `typecheck` sạch + 27 file / 302 test + `build` (bundle không có `localhost:3000`); mobile `flutter analyze` sạch + 455 test. Lint backend trên 7 file mình sửa: sạch (sau `prettier --write` spec mới).
- **Smoke tay (AC 17) — ĐÃ CHẠY** (backend `npm run start:prod` với `JWT_ACCESS_SECRET` ngẫu nhiên trên lệnh, không đọc/sửa `.env`; `pns-postgres` 5433; vite 5173; Playwright). Account `smoke-10-4-a@local.test` (customers.manage, settings.manage, catalog.view, orders.view_all) và `smoke-10-4-b@local.test` (orders.view_own), băm argon2id, chèn thẳng DB local.
  - Chưa đăng nhập, mở `/settings` ⇒ `/login`.
  - A: đăng nhập ⇒ `/customers`; sidebar đúng Khách hàng / Tra cứu bảo hành / Cấu hình / Hồ sơ (không Đơn hàng/Kho/Trang chủ/Danh mục). Danh sách tải từ DB. Thêm khách ⇒ `/customers/lookup`, tra `0900 000 104` ⇒ "chưa có"; CCCD 25 ký tự ⇒ lỗi ghim dưới ô CCCD (field `nationalId`); nguồn "Khác" không ghi chú ⇒ lỗi ghim dưới "Ghi rõ nguồn"; lưu ⇒ `/customers/%2B84900000104`, chi tiết hiện CCCD/SĐT đúng. Cấu hình: VAT 8 → 10 → 8; thêm nguồn "Smoke 10.4 nguon" → tắt → bật lại → tắt. Tra cứu bảo hành SĐT trên ⇒ thẻ khách, "chưa có vật tư". Reload `/warranty` ⇒ giữ phiên + route. Hồ sơ → Đăng xuất ⇒ `/login`, `pns.refreshToken` bị xoá.
  - B: đăng nhập ⇒ `/warranty`, sidebar chỉ Tra cứu bảo hành + Hồ sơ; gõ `/settings` ⇒ về `/warranty`.
  - Console: chỉ `favicon.ico` 404, 2 response 400 cố ý, và cảnh báo VERBOSE `autocomplete` ở form đổi mật khẩu Hồ sơ (có sẵn từ 2.8).
  - Dọn: xoá 2 account smoke (DELETE 2, đếm lại 0); nguồn **"Smoke 10.4 nguon"** để **tắt** (`active=false`, không hard delete được); khách smoke **+84900000104** ("Smoke 10.4 Khach") còn lại (không có API xoá khách); VAT đã về 8; backend + vite đã tắt (cổng 3000/5173 trống); `.playwright-mcp/` đã xoá.
- **Ghi nhận ngoài phạm vi**: thông điệp lỗi `@MaxLength` của backend là mặc định class-validator tiếng Anh ("nationalId must be shorter than or equal to 20 characters") — hiển thị nguyên văn trên màn. Có sẵn từ trước, không đổi ở 10.4.
- **Bàn giao 10.5**: allowlist guard `openapi-no-untyped-object.spec.ts` = 6 field module đơn (đã ghi trong epics.md tinh chỉnh 10.4) — 10.5 sửa xong phải xoá khỏi allowlist (guard tự đỏ nếu field đã sửa còn trong allowlist). Route `orders`/`inventory` thêm vào `NAV_ROUTES` ⇒ sidebar + landing tự đổi.

### File List

- `_bmad-output/implementation-artifacts/10-4-web-composition-root-router-va-adapter-danh-muc-khach-cai-dat.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/project-context.md`
- `backend/openapi/openapi.json`
- `backend/src/catalog/dto/create-product-request.dto.ts`
- `backend/src/catalog/dto/update-product-request.dto.ts`
- `backend/src/customers/dto/create-customer-request.dto.ts`
- `backend/src/customers/dto/create-customer-source-request.dto.ts`
- `backend/src/customers/dto/update-customer-request.dto.ts`
- `backend/src/orders/dto/warranty-lookup-response.dto.ts`
- `backend/test/openapi-no-untyped-object.spec.ts` (mới)
- `design-system/screens/customers.test.mjs`
- `design-system/screens/orders.test.mjs`
- `design-system/session/parity.test.mjs`
- `design-system/session/session.test.mjs`
- `web/package.json`
- `web/package-lock.json`
- `web/src/api/generated/schema.d.ts`
- `web/src/api/http-catalog-port.ts` (mới)
- `web/src/api/http-customer-sources-port.ts` (mới)
- `web/src/api/http-customers-port.ts` (mới)
- `web/src/api/http-me-port.ts` (mới)
- `web/src/api/http-password-port.ts` (mới)
- `web/src/api/http-settings-port.ts` (mới)
- `web/src/api/http-warranty-port.ts` (mới)
- `web/src/app/AppRoutes.tsx` (mới)
- `web/src/app/routes.ts` (mới)
- `web/src/design-system/session/catalog-port.ts`
- `web/src/design-system/session/customer-sources-port.ts`
- `web/src/design-system/session/customers-port.ts`
- `web/src/design-system/session/fake-customers-port.ts`
- `web/src/design-system/session/fake-orders-port.ts`
- `web/src/design-system/session/fake-warranty-port.ts`
- `web/src/design-system/session/me-port.ts`
- `web/src/design-system/session/password-port.ts`
- `web/src/design-system/session/settings-port.ts`
- `web/src/design-system/session/warranty-port.ts`
- `web/src/design-system/shell/Sidebar.tsx`
- `web/src/design-system/shell/index.ts`
- `web/src/main.tsx`
- `web/src/screens/account/ProfileScreen.tsx`
- `web/src/screens/customers/CustomerListScreen.tsx`
- `web/src/screens/customers/CustomerPickScreen.tsx`
- `web/src/screens/orders/CreateQuoteScreen.tsx`
- `web/src/screens/warranty/WarrantyLookupScreen.tsx`
- `web/src/test/app-entry.test.tsx`
- `web/src/test/app-routes.test.tsx` (mới)
- `web/src/test/composition-root.test.ts` (mới)
- `web/src/test/http-adapter-harness.ts` (mới)
- `web/src/test/http-catalog-port.test.ts` (mới)
- `web/src/test/http-customer-sources-port.test.ts` (mới)
- `web/src/test/http-customers-port.test.ts` (mới)
- `web/src/test/http-me-port.test.ts` (mới)
- `web/src/test/http-password-port.test.ts` (mới)
- `web/src/test/http-settings-port.test.ts` (mới)
- `web/src/test/http-warranty-port.test.ts` (mới)
- `web/src/test/no-network-outside-transport.test.ts`
- `web/src/test/sidebar-nav-context.test.tsx` (mới)
- `web/src/test/source-text.ts` (mới)
- `backend/src/common/validation/validation-pipe.factory.ts` (review)
- `backend/test/validation-messages.spec.ts` (mới, review)
- `backend/test/error-envelope.spec.ts` (review)
- `backend/test/customers.e2e.spec.ts` (review — thêm assert message, không nới)
- `web/src/test/customer-screens.test.tsx` (mới, review)
- `web/src/test/stock-vouchers-screen.test.tsx` (review — sửa race)
- `web/src/screens/customers/CustomerDetailScreen.tsx` không đổi; `CustomerPickScreen.tsx`, `api/http-customers-port.ts`, `design-system/session/customers-port.ts`, `test/http-customers-port.test.ts`, `test/composition-root.test.ts`, `backend/test/openapi-no-untyped-object.spec.ts` sửa thêm ở review

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI, bmad-story-automator-review + /ck:code-review + 1 reviewer độc lập chỉ-đọc) — 2026-10-22
**Kết quả:** Approve sau khi sửa — 0 CRITICAL còn lại. AC 1–18 đối chiếu code + test: đạt. Task [x] đều có bằng chứng.

### Findings & xử lý (đã sửa hết, mỗi bản sửa có test + mutant ĐỎ, backup `cp`)

| # | Mức | Finding | Sửa | Mutant |
|---|---|---|---|---|
| 1 | HIGH | Lỗi validate backend hiện câu tiếng Anh mặc định của class-validator lên màn (`nationalId must be shorter than or equal to 20 characters`) — vi phạm luật UI tiếng Việt | Sửa tận gốc MỘT chỗ: `common/validation/validation-pipe.factory.ts` (nơi đóng gói `fieldErrors` trước filter AD-5) dịch câu mặc định theo mã constraint (`BUILT_IN_MESSAGES`, giữ số giới hạn), giữ message DTO tự viết, constraint lạ ⇒ "Giá trị không hợp lệ.". Áp cho MỌI DTO (không cần TD). Test `validation-messages.spec.ts` (pipe + decorator thật, 26 ca, chống-rỗng), assert message ở `error-envelope.spec.ts` + 5 ca trần độ dài `customers.e2e.spec.ts` | bỏ `toClientMessage` ⇒ 28 ĐỎ; fallback trả câu gốc ⇒ 2 ĐỎ |
| 2 | MEDIUM | `listSources()` chỉ lấy nguồn đang bật ⇒ khách thuộc nguồn admin đã tắt hiện "Nguồn khách: —" ở chi tiết/tra cứu | Adapter gọi `includeInactive=true`; select tạo khách lọc `active` | bỏ filter ⇒ ĐỎ; bỏ `includeInactive` ⇒ ĐỎ |
| 3 | MEDIUM | Guard AC-14 mù với `export type X = { … }` khai tay (chỉ soi `interface`) | `handWrittenTypeAliases` + tự kiểm dương/âm | thêm `type Draft = {…}` vào settings-port ⇒ ĐỎ |
| 4 | MEDIUM | Lane web flaky khi chạy song song: `stock-vouchers-screen.test.tsx` `findAllByText` trả ngay khi có 1 match | `waitFor(... toHaveLength(2))` | — (race) |
| 5 | MEDIUM | Dữ liệu smoke dev còn trong DB local 5433 (khách `+84900000104`, nguồn "Smoke 10.4 nguon") | Xoá bằng SQL trên `pns-postgres` (0 đơn tham chiếu), đếm lại 0 | — |
| 6 | LOW | Guard `openapi-no-untyped-object` chỉ soi property cấp một — bỏ sót `items` mảng / schema tham số | Đi đệ quy toàn document + ca tự kiểm trên mảnh spec dựng tay | chỉ đếm property cấp một ⇒ ĐỎ |
| 7 | LOW | Guard fake chỉ quét `main.tsx`/`app/`/`api/`; màn mặc định prop `= new Fake…Port()` lọt | Quét thêm `screens/`, `design-system/{components,shell}/` + chống-rỗng (≥19 file) | thêm `new FakeCustomersPort()` vào CustomerListScreen ⇒ ĐỎ |
| 8 | LOW | `fieldErrors.phone` khi tạo khách không hiện ở đâu (chỉ banner chung "Dữ liệu không hợp lệ") | Banner dưới ô SĐT + test | bỏ banner ⇒ ĐỎ |

### Không sửa (có lý do)

- Account có `settings.manage` mà thiếu `customers.manage` mở Cấu hình sẽ nhận 403 ở phần nguồn khách (`GET /customer-sources` gate `customers.manage`). Mọi preset có `settings.manage` (SUPER_ADMIN/ADMIN) đều có `customers.manage` ⇒ chỉ xảy ra với quyền tuỳ chỉnh; đổi gate là quyết định sản phẩm — **câu hỏi mở cho Đại Ca**.
- Deep link mất qua đăng nhập — D4 đã chốt YAGNI.
- Comment `// Story 10.5` trong allowlist guard — spec yêu cầu, khớp quy ước repo.
- TD: message tiếng Anh của `ParseUUIDPipe` và lỗi parse JSON body Express (module đơn/tiền, 10.5; client sinh luôn gửi JSON hợp lệ). Mobile: `listSources` cùng ngữ nghĩa — làm ở 10.7.
- Luật (1)/(2) scope + FOR UPDATE: story không thêm đường ghi đơn/tồn kho nào (diff `backend/src` = metadata Swagger 6 DTO + ValidationPipe) ⇒ không có guard phạm vi/khoá mới để bẻ; lane DB xanh xác nhận không vỡ. Luật (4): không có màn mobile mới. Luật (3): không có màn web mới (`SCREEN_COUNT` giữ 19).

### Xác minh sau sửa

- backend `npm test` 120 suite / 2500 test + `npm run build` exit 0; `npm run test:db` 26 / 322; design-system 487/487; web `typecheck` sạch + 28 file / 315 test + `build`; mobile `flutter analyze` sạch + 455 test. Lint 4 file backend mình sửa: sạch.
- Smoke thật (backend `start:prod`, `JWT_ACCESS_SECRET` ngẫu nhiên trên lệnh, không đọc/sửa `.env`; Postgres 5433; vite; Playwright), account riêng `smoke-10-4-review@local.test` (argon2id, 4 quyền): chưa đăng nhập `/settings` ⇒ `/login`; đăng nhập ⇒ `/customers`, nav Khách hàng/Tra cứu bảo hành/Cấu hình/Hồ sơ; reload giữ phiên + route; tạo khách CCCD 25 ký tự ⇒ "Tối đa 20 ký tự." dưới ô, 0 câu tiếng Anh; curl `POST /customers` ⇒ `isNotEmpty` "Không được để trống.", `isUuid` "Mã định danh không hợp lệ."; Đăng xuất ⇒ `/login`, `pns.refreshToken` null. Không tạo khách nào (đều 400). Dọn: xoá account smoke (+3 session), backend + vite tắt (3000/5173 trống), `.playwright-mcp/` xoá.

## Change Log
- 2026-10-22 — Review: ValidationPipe trả message tiếng Việt cho mọi constraint (một chỗ); nguồn khách đã tắt vẫn hiện tên; guard type-alias, guard fake mở rộng, guard OpenAPI đệ quy; sửa test flaky; hiện lỗi SĐT; dọn dữ liệu smoke DB local. Status → done.

- 2026-10-22 — Dev: composition root `main.tsx` + router `react-router` 8.4.0 + `SidebarNavContext`; 7 adapter HTTP (me, password, customers, customer-sources, catalog, settings, warranty) + test; type port = type sinh, field theo contract; sửa metadata Swagger 14 field + guard `openapi-no-untyped-object`; guard composition root; nút Đăng xuất ở Hồ sơ; smoke đầu-cuối 2 account chạy đủ. Status → review.
