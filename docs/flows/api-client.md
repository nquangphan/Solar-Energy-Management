# Lớp gọi API HTTP: transport, lỗi, lưu phiên và tải file

> Flow `api-client`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow api-client` in ra đúng danh sách đó.

## Mục đích

Đường mạng DUY NHẤT của cả hai client (AD-12). Mọi port HTTP thật (`Http*Port`, thuộc flow của từng miền) đi qua transport;
màn không bao giờ thấy token, `fetch`, `Dio` hay JSON thô:

- **Transport** gắn `Authorization: Bearer`, đổi lỗi HTTP thành `ApiError` (envelope AD-5 chỉ được đọc ở đây), và gia hạn phiên khi gặp 401.
- **Lỗi** là một kiểu duy nhất (`ApiError`) với `message`, `code`, `fieldErrors`, `status`. Ba thông báo dự phòng khớp byte-for-byte giữa web và mobile.
- **Lưu phiên**: access token chỉ trong bộ nhớ; refresh token nằm trong kho bền (localStorage trên web, secure storage trên mobile), để tải lại vẫn đăng nhập.
- **Tải file** (PDF, ảnh) đi qua client có token, không bao giờ qua link công khai (AD-3).
- **Body gửi đi**: chỉ có các khoá người dùng đã đặt, và khoá idempotency cho các lệnh ghi tiền.

Client sinh tự động từ `backend/openapi/openapi.json` không thuộc phần viết tay (xem Files).

## Điểm vào

- `web/src/api/transport.ts` — `createTransport`: transport web, đưa vào `openapi-fetch` qua `transport.fetch`.
- `mobile/lib/api/transport.dart` — `Transport`: transport mobile, dựng `Dio` và gắn interceptor; `call<T>` bọc mọi lời gọi.

Cả hai đều được composition root gọi một lần: `web/src/main.tsx`, `mobile/lib/main.dart` (flow `app-shell`).

## Các bước

**A. Một lời gọi HTTP (web và mobile giống nhau)**

1. Client sinh tự động (`createApiClient` ở `web/src/api/client.ts`; retrofit trên mobile) chuyển request cho transport.
2. Transport gắn `Authorization: Bearer <access>`, trừ các route công khai (`PUBLIC_AUTH_PATHS` / `kPublicAuthPaths`: đăng nhập, refresh, …).
3. Response không ok ⇒ `parseEnvelope` đọc envelope AD-5 ⇒ `toApiError` / `parseEnvelope` (mobile) dựng `ApiError`. Adapter chỉ nhận `data` hoặc `ApiError`.
4. 401 trên route thường ⇒ MỘT lần refresh dùng chung cho mọi request đang chờ; mỗi request được replay TỐI ĐA MỘT lần.
   401 trên route công khai (sai mật khẩu, refresh hỏng, đổi mật khẩu sai) KHÔNG kích hoạt refresh; lỗi đó được trả về như câu trả lời.
5. Chỉ refresh HỎNG mới xoá phiên và báo "phiên hết hạn" (`SESSION_EXPIRED_MESSAGE`); replay vẫn 401 thì giữ phiên và trả `ApiError`.

**B. Lưu phiên**

1. `web/src/api/session-store.ts` — `createSessionStore`: access token trong bộ nhớ; refresh token trong `localStorage` dưới `REFRESH_TOKEN_KEY`.
2. `mobile/lib/api/session_store.dart` — `SessionStore`: access token trong bộ nhớ; refresh token qua `SecureKeyValueStore` (`FlutterSecureStorageStore` trên thiết bị).

**C. Tải file**

1. `web/src/api/download.ts` — `downloadedFile`, `fileNameOf`: lấy byte qua client có token, rồi mở bằng object URL.
2. `mobile/lib/api/bytes.dart` — `collectBytes`: gom stream của lệnh tải thành một buffer; lỗi giữa chừng vẫn là `ApiError` vì chạy bên trong `transport.call`.

**D. Body gửi đi**

1. `mobile/lib/api/sparse_bodies.dart`: các hàm `…Body` (ví dụ `scopeFlagsBody`, `lineUpdateBody`, `stockVoucherBody`) chỉ đưa vào các khoá người dùng đã đặt.
   json_serializable mặc định ghi cả `null`; backend phân biệt `null` (xoá) với khoá vắng (không đổi), nên không thể gửi `null` thay cho khoá vắng.
2. `mobile/lib/design_system/session/idempotency_key.dart` — `newIdempotencyKey`: UUID v4 sinh MỘT lần cho mỗi form mở, dùng cho mọi lệnh ghi tiền (thanh toán, hoá đơn, phiếu kho).
   Web dùng `crypto.randomUUID()` tương ứng.

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| Chỉ transport gọi mạng (web: `fetch`; mobile: `Dio`) | `transport.ts`, `transport.dart` | `web/src/test/no-network-outside-transport.test.ts`, `mobile/test/api/no_network_outside_transport_test.dart` |
| Chỉ transport dựng `ApiError` từ response | `parseEnvelope` / `toApiError`, `transport.dart` | `web/src/test/http-port-errors.test.ts`, `mobile/test/api/http_port_errors_test.dart`, `mobile/test/api/api_error_test.dart` |
| Ba thông báo dự phòng khớp giữa web và mobile | `NETWORK_ERROR_MESSAGE`, `SESSION_EXPIRED_MESSAGE`, `kNetworkErrorMessage`, … | `design-system/session/parity.test.mjs` (flow `auth-session`) |
| Mỗi request được replay tối đa một lần; một refresh dùng chung cho mọi request chờ | `transport.ts`, `transport.dart` (`_renewOnce`, `_refreshing`) | `web/src/test/transport.test.ts`, `mobile/test/api/transport_test.dart` |
| Route công khai không refresh | `PUBLIC_AUTH_PATHS` / `kPublicAuthPaths` | `web/src/test/transport.test.ts`, `mobile/test/api/transport_test.dart` |
| Access token không ghi xuống đĩa; refresh token chỉ ở kho bền | `session-store.ts`, `session_store.dart` | `mobile/test/api/session_store_test.dart`, `web/src/test/transport.test.ts` |
| Client sinh tự động khớp contract đã commit | `generated_client_drift_test.dart`, `api-client-drift.test.ts` | `mobile/test/api/generated_client_drift_test.dart`, `web/src/test/api-client-drift.test.ts` |
| Không tải file bằng link công khai | `download.ts`, `bytes.dart` | `web/src/test/no-public-file-link.test.ts` |
| Thiếu key vs khoá null không bị lẫn | `sparse_bodies.dart` | `mobile/test/api/sparse_bodies_test.dart` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `web/src/api/transport.ts` | Transport web: bearer, lỗi, refresh 401 | `createTransport`, `Transport`, `TransportOptions`, `PUBLIC_AUTH_PATHS` |
| `web/src/api/client.ts` | Client typed đọc `paths` của schema sinh tự động | `createApiClient`, `ApiClient` |
| `web/src/api/generated/schema.d.ts` | Kiểu `paths` / `components` sinh từ `backend/openapi/openapi.json` bằng `npm run api:gen` (`scripts/generate-api.mjs`); KHÔNG sửa tay | `paths`, `components` |
| `web/src/api/api-error.ts` | Lỗi duy nhất của adapter và đọc envelope | `ApiError`, `parseEnvelope`, `GENERIC_ERROR_MESSAGE`, `NETWORK_ERROR_MESSAGE`, `SESSION_EXPIRED_MESSAGE` |
| `web/src/api/session-store.ts` | Lưu token web | `createSessionStore`, `SessionStore`, `SessionTokens`, `REFRESH_TOKEN_KEY` |
| `web/src/api/download.ts` | Tải file qua client có token | `downloadedFile`, `fileNameOf` |
| `mobile/lib/api/transport.dart` | Transport mobile: Dio, bearer, lỗi, refresh 401 | `Transport`, `kPublicAuthPaths` |
| `mobile/lib/api/api_error.dart` | Lỗi duy nhất của adapter (mobile) | `ApiError`, `parseEnvelope`, `kGenericErrorMessage`, `kNetworkErrorMessage`, `kSessionExpiredMessage` |
| `mobile/lib/api/session_store.dart` | Lưu token mobile | `SessionStore`, `SecureKeyValueStore`, `FlutterSecureStorageStore`, `kRefreshTokenKey` |
| `mobile/lib/api/sparse_bodies.dart` | Body chỉ có khoá người dùng đặt | `scopeFlagsBody`, `orderMetaBody`, `lineUpdateBody`, `addLineBody`, `previewTotalBody`, `stockVoucherBody` |
| `mobile/lib/api/bytes.dart` | Gom stream tải file thành buffer | `collectBytes` |
| `mobile/lib/design_system/session/idempotency_key.dart` | Khoá idempotency cho lệnh ghi tiền | `newIdempotencyKey` |
| `mobile/lib/api/generated/**` (ngoài phạm vi viết tay; sinh bởi generator của client mobile) | Client retrofit và model sinh từ `openapi.json` | — |

## Dữ liệu

- Không có bảng. Dữ liệu bền duy nhất của phía client là refresh token (localStorage hoặc secure storage).
- Nguồn contract: `backend/openapi/openapi.json` (sinh từ code backend, flow `backend-platform`); mọi kiểu client suy ra từ đó.
- Gọi ngoài: không có. Đích gọi là API backend.

## Flow liên quan

- auth-session: refresh, logout và đăng nhập đi qua transport; `PUBLIC_AUTH_PATHS` là danh sách của flow đó.
- app-shell: composition root dựng transport, session store và client một lần.
- backend-platform: envelope lỗi AD-5 và `openapi.json` là nguồn contract.
- Mọi flow có port HTTP (`Http*Port`): accounts-permissions, catalog, customers, orders, inventory, payments, contracts, invoices, dashboard-reports, domain-events-audit, system-settings.
- build-ci: `web/src/vite-env.d.ts` khai báo biến môi trường đọc bởi client (`VITE_*`).

## Tests

Web:

- `web/src/test/transport.test.ts`: envelope 400 thành `ApiError` kèm `fieldErrors`; body không phải envelope (HTML 502) ra thông báo chung; lỗi mạng ra thông báo mạng; bearer chỉ gắn cho route thường; 401 ⇒ một lần refresh ⇒ replay.
- `web/src/test/http-port-errors.test.ts`: lỗi HTTP thành `ApiError` cho các port.
- `web/src/test/api-client-drift.test.ts`: client khớp schema sinh tự động.
- `web/src/test/no-network-outside-transport.test.ts`, `web/src/test/no-public-file-link.test.ts`: guard đường mạng và link công khai.

Mobile:

- `mobile/test/api/transport_test.dart`: envelope 400, body không phải envelope, lỗi kết nối, 401 ⇒ refresh ⇒ replay, hai 401 đồng thời dùng chung MỘT refresh, refresh bị từ chối xoá phiên.
- `mobile/test/api/api_error_test.dart`, `mobile/test/api/http_port_errors_test.dart`, `mobile/test/api/http_stack_loopback_test.dart` (HTTP trên loopback).
- `mobile/test/api/session_store_test.dart`, `mobile/test/api/sparse_bodies_test.dart`.
- `mobile/test/api/no_network_outside_transport_test.dart`, `mobile/test/api/generated_client_drift_test.dart`.
