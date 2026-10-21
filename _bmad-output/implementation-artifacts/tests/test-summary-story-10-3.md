# Test Automation Summary — Story 10.3 (web: client sinh từ OpenAPI, phiên đăng nhập, lỗi một chỗ)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** Vitest 4 (jsdom + `@testing-library/react`; lane transport chạy `node` env), `fetch` stub bằng `vi.fn` — không mạng thật
**Kết quả:** web `typecheck` xanh · `npm test` 17 file / **241 test** xanh (230 → 241, +11 ca) · `build` xanh, `dist` không chứa `localhost:3000`

## Phạm vi

Dev đã phủ dày: transport (4 ca AC-6 + 9 ca AC-12 + abort), session-store chặn storage, `ApiError` gán vào 4 kiểu
`*PortError` không cast, `HttpAuthPort` 8 ca, `LoginScreen` 5 ca, drift-guard client sinh, guard mạng, CORS e2e
(preflight allowed/evil, request thật 400, rỗng ⇒ tắt) + unit `corsOptionsFromEnv`. Backend không đụng.

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | 4, 12c/i | Mọi test transport dùng base `http://api.test` (không path). Base thật trong `main.tsx` là `/api` ⇒ `routeOf` phải bỏ tiền tố `/api` mới nhận ra 5 đường public | Đột biến `routeOf` giữ nguyên path ⇒ `/api/auth/login` bị gắn Bearer và 401 sai mật khẩu kích refresh; **bộ test cũ vẫn xanh hết** | `transport.test.ts`: nhóm "relative /api base" 2 ca (public không Bearer/không refresh; route thường có Bearer + refresh đi `/api/auth/refresh`) |
| 2 | 4 (D6) | Nhánh "401 về sau khi request khác đã refresh xong ⇒ phát lại, không refresh lần hai" (`current !== sentToken`) không có ca riêng; ca "hai 401 đồng thời" chỉ đi nhánh `refreshing` đang chạy | Bỏ kiểm token cũ ⇒ refresh thừa (backend rotate ⇒ phát sinh replay refresh token) mà mọi lane xanh | `transport.test.ts`: ca request chậm nhận 401 sau khi request nhanh đã refresh ⇒ đúng 1 refresh, 4 lượt `/me` |
| 3 | 4 (biên story) | 401 body không phải envelope (proxy) trên route thường vẫn phải refresh — biên đã nêu, chưa test | Ghim "quyết theo status, không theo code" | `transport.test.ts`: ca 401 text thô ⇒ 1 refresh, phát lại OK |
| 4 | 4 (D6) | Refresh 200 nhưng body thiếu cặp token ⇒ phải hết phiên, không lưu rác | `isAuthTokens` nới lỏng ⇒ lưu `refreshToken` undefined, mọi lane xanh | `transport.test.ts`: ca refresh `{accessToken}` ⇒ `SESSION_EXPIRED_MESSAGE`, expired 1 lần, xoá cả hai token |
| 5 | 4, 21 | **`main.tsx` (luồng app thật) không có test nào**: restore lúc khởi động, đăng nhập qua form ⇒ khung đã đăng nhập, Đăng xuất | AC-21 smoke tay thành công chưa chạy; không gì canh việc nối session + transport + client + port + màn | `app-entry.test.tsx` (mới, 6 ca): không token ⇒ Đăng nhập, 0 lời gọi; đăng nhập form ⇒ "Đã đăng nhập." + lưu refresh; sai mật khẩu ⇒ Banner nguyên văn, không lưu; reload token sống ⇒ khôi phục với **đúng 1** refresh dù StrictMode chạy effect 2 lần; reload token chết ⇒ Đăng nhập + xoá key; Đăng xuất ⇒ `POST /auth/logout {refreshToken}` + về Đăng nhập + xoá key |

Ghi chú kỹ thuật: Node 24 có `localStorage` toàn cục riêng (chưa cấu hình ⇒ `undefined`) đè lên của jsdom ⇒ `app-entry`
stub `localStorage` bằng `memoryStorage()`; `main.tsx` đọc đúng stub (ca rotate thấy `refresh-2`).

## Kiểm chứng test mới bằng đột biến (backup `cp`, mọi mutant qua `tsc --noEmit`, khôi phục + `cmp` sạch)

| Mutant | Kết quả |
|---|---|
| `routeOf` giữ nguyên path (không bỏ base `/api`) | ĐỎ 2 ca (transport base `/api` + app-entry sai mật khẩu); ca cũ vẫn xanh ⇒ đúng lỗ gap 1 |
| Luôn refresh khi 401 (bỏ kiểm token cũ) | ĐỎ ca gap 2 |
| `isAuthTokens` chỉ kiểm `accessToken` | ĐỎ ca gap 4 |
| `main.tsx`: nút Đăng xuất không gọi `authPort.logout()` | ĐỎ ca Đăng xuất |
| `main.tsx`: bỏ qua kết quả `restoreSession` | ĐỎ 2 ca (reload token sống, Đăng xuất) |
| `main.tsx`: `onLoggedIn` không chuyển khung | ĐỎ ca đăng nhập form |

## Test theo file

- [x] `web/src/test/transport.test.ts`: +5 ca (2 nhóm mới); `setup()` nhận thêm `baseUrl` (mặc định giữ `BASE`)
- [x] `web/src/test/app-entry.test.tsx` (mới): 6 ca luồng app thật qua `main.tsx`

## Coverage

- AC-1…AC-6, AC-8…AC-17: có test tự động (dev + QA). AC-4 nay phủ cả base `/api` thật và luồng app.
- Luồng UI web của story: 3/3 (Đăng nhập, khôi phục phiên, Đăng xuất) có test cấp app; Quên mật khẩu vẫn fake (ngoài phạm vi 10.3).
- Endpoint backend mới: 0 (story chỉ thêm CORS — đã có e2e + unit của dev).

## Next Steps

- AC-21 smoke tay phần **đăng nhập thành công / reload giữ phiên / Đăng xuất trên backend thật** vẫn chưa chạy (Dev Agent Record). Test `app-entry` phủ logic phía web, không thay được smoke với backend thật — cần chạy theo luật (13): account smoke riêng trong Postgres 5433, `JWT_ACCESS_SECRET` tạm qua biến môi trường.
