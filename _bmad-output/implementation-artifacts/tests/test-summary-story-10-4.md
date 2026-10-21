# Test Automation Summary — Story 10.4 (web composition root, router, adapter danh mục/khách/cài đặt)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** Vitest 4 + Testing Library (jsdom) — khuôn có sẵn của web; e2e = `main.tsx` thật + `fetch` stub (không mạng, không fake port)
**Kết quả:** web 27 file / **309 test** xanh (trước 302, +7) · `typecheck` sạch · `build` OK

## Phạm vi

Dev đã phủ dày: 7 adapter (36 ca, mỗi port có ca thành công + ca envelope), guard composition root, `SidebarNavContext`, `app-routes` 7 ca, `app-entry` 10 ca. QA chỉ vá chỗ **luồng người dùng** còn hở — không thêm ca trùng.

## Gap phát hiện & auto-apply (7 ca)

| # | AC | Gap | Bằng chứng là gap | Đã vá |
|---|----|-----|-------------------|-------|
| 1 | AC-2, D4 | Route con `/customers/lookup` và `/customers/:phone` kế thừa gate `customers` — không ca nào kiểm | Mutant gỡ gate route con ⇒ 23 ca cũ xanh | ✅ `app-routes.test.tsx` — account `orders.view_own` mở cả 2 path ⇒ `/warranty`, không render màn, `customers.get` 0 lần |
| 2 | Biên E.164 | Deep link / reload `/customers/%2B84…` (chỉ có qua click) | — | ✅ `app-routes.test.tsx` — `get('+84903176968')` đúng 1 lần, path giữ `%2B` |
| 3 | D4 callback | `onAdd` ⇒ `/customers/lookup`, `onSelect` ⇒ chi tiết: chưa test | Mutant `onSelect` no-op / bỏ `onAdd` ⇒ ca cũ xanh | ✅ `app-routes.test.tsx` — "+ Thêm khách" → tra `0903 176 968` (thô) → "Dùng khách này" → chi tiết |
| 4 | AC-2 | `SignedOutRoutes`: path lạ ⇒ `/login` (chỉ đo qua main) | — | ✅ `app-routes.test.tsx` |
| 5 | D4 | "Quay lại đăng nhập" ⇒ `/login` chưa test | Mutant bỏ `onBackToLogin` ⇒ ca cũ xanh | ✅ `app-routes.test.tsx` |
| 6 | D5 | Nút Đăng xuất ở màn lỗi `/me` chỉ kiểm **có hiện**, không kiểm bấm | Mutant bỏ `onClick={onLogout}` ⇒ ca cũ xanh | ✅ `app-entry.test.tsx` — `POST /auth/logout` 1 lần, về `/login`, token bị xoá |
| 7 | AC-1/3/11 | Không ca đầu-cuối nào chạy dữ liệu khách/cấu hình thật qua adapter (chỉ `EMPTY_PAGE`) | — | ✅ `app-entry.test.tsx` — danh sách từ `GET /customers` (Bearer token mới), Xem ⇒ `GET /customers/%2B84903176968`, Cấu hình ⇒ `GET /customer-sources?includeInactive=true` + VAT `8%` + pháp nhân |

**Không thêm (đã phủ):** ca envelope từng adapter, encode `+`, `costPrice` không lọt, 401 đổi mật khẩu không expire phiên, gate `/settings`, landing `/`, A→B đổi quyền, refresh hỏng giữa phiên, `/me` gọi 2 lần do StrictMode.

## Mutation kiểm ca mới (backup `cp`, mutant compile được, đã khôi phục — `diff` rỗng)

| Mutant (`web/src/app/AppRoutes.tsx`) | Kết quả |
|---|---|
| Route `/customers/lookup` gate `'profile'` (luôn mở) | ca 1 ĐỎ, 23 ca khác xanh |
| Route `/customers/:phone` bỏ `gate(...)` | ca 1 ĐỎ |
| `onSelect` no-op | ca 3 ĐỎ |
| Bỏ `onAdd` | ca 3 ĐỎ |
| Nút Đăng xuất màn lỗi bỏ `onClick` | ca 6 ĐỎ |
| Bỏ `onBackToLogin` | ca 5 ĐỎ |

Lần đầu mutant gỡ gate route lookup bằng regex không compile ⇒ đỏ toàn bộ (đỏ giả) — đã làm lại bằng mutant compile được ở trên.

## Test theo file

### E2E (composition root) — `web/src/test/app-entry.test.tsx` (+2)
- [x] Đăng xuất ở màn lỗi `/me` ⇒ logout thật + về Đăng nhập
- [x] Dữ liệu thật đầu-cuối: danh sách → chi tiết (`%2B`) → Cấu hình (nguồn + VAT + pháp nhân)

### E2E (lớp ứng dụng) — `web/src/test/app-routes.test.tsx` (+5)
- [x] Route con khách kế thừa gate
- [x] Deep link chi tiết khách E.164
- [x] Thêm khách → tra cứu → chọn → chi tiết
- [x] `SignedOutRoutes`: path lạ ⇒ `/login`
- [x] Quên mật khẩu ⇄ Đăng nhập

### API (adapter) — giữ nguyên 7 file `http-*-port.test.ts` của dev (36 ca)

## Coverage

- Adapter/API: 7/7 port, 22/22 method port có ca thành công (đối chiếu tên test); mỗi port ≥1 ca envelope lỗi.
- Route: 7/7 route đăng nhập (`/customers`, `/customers/lookup`, `/customers/:phone`, `/warranty`, `/settings`, `/profile`, `*`) + 3/3 route chưa đăng nhập; gate có ca cho mọi route có gate.
- Callback điều hướng D4: 6/6 (`onOpen`, `onAdd`, `onSelect`, `onForgotPassword`, `onBackToLogin`, `onLoggedIn`).
- Luồng phiên D5: khôi phục / đăng nhập / `/me` lỗi (thử lại + đăng xuất) / đăng xuất / đổi account / hết phiên — đủ.

## Kết quả chạy

- `cd web && npm run typecheck` — sạch
- `npm test` — 27 file / 309 test xanh
- `npm run build` — OK
- Không đụng backend / design-system / mobile ⇒ không chạy lại các lane đó.

## Bước tiếp theo

- Review story (`bmad-code-review`).
- 10.5 thêm route `orders`/`inventory`: thêm ca gate route con tương tự ca 1.

## Câu hỏi tồn đọng

- Không có.
