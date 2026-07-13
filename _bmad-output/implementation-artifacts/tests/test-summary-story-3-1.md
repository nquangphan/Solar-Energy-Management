# Test Automation Summary — Story 3.1 (CRUD Sản phẩm & giá + 4 cột mới)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-13 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic — override `PrismaService`, ký JWT thật, không cần Postgres)
**Kết quả:** 35 suite / **294 test** xanh (278 → 294, +16 test vá gap) · lint + format:check sạch, drift-guard OpenAPI xanh

## Phạm vi

Story 3.1 là **backend-only** — 5 route `/products`, không có màn web/mobile ⇒ **không sinh E2E browser test**; bao phủ đúng chỗ rủi ro là **API e2e qua HTTP thật** (`backend/test/products.e2e.spec.ts`). Unit `products.service.spec.ts` đã phủ tầng service từ dev-story; QA pass này chỉ bổ sung những gì **chỉ tầng HTTP mới chứng minh được** (guard toàn cục, ValidationPipe, ép kiểu query, exception filter dựng envelope, event đi thật tới `AuditSubscriber`).

## Khoảng trống đã phát hiện & vá (16 test mới, tất cả trong `products.e2e.spec.ts`)

| # | Gap | Vì sao nguy hiểm | Test vá |
|---|---|---|---|
| 1 | `?includeInactive` **chưa từng đi qua dây** | Controller so **chuỗi** (`includeInactive === 'true'`), unit test gọi service bằng **boolean** ⇒ nối sai dây vẫn xanh toàn bộ. Lật cờ = lộ sản phẩm đã ẩn (hoặc giấu sản phẩm còn bán) | 3 test: không query · `=true` · `=false` — assert thẳng `where` gửi xuống Prisma |
| 2 | Ghi `costPrice` khi **CÓ** `costs.view` chưa có test HTTP | Cả suite cũ chỉ chứng minh đường **từ chối**. Gate siết quá tay (403 cả người có quyền) ⇒ không ai đặt được giá vốn, mà không suite nào đỏ | POST + PATCH kèm `costPrice` ⇒ 201/200, giá vốn có trong response **và** trong payload ghi DB |
| 3 | `GET /products` (danh sách) với `costs.view` chưa có test | Đường `findOne` có test; đường `.map(stripCostPrice)` của danh sách thì không — strip nhầm toàn bộ list vẫn xanh | GET list ⇒ mọi phần tử mang `costPrice` |
| 4 | PATCH happy-path + audit `before`/`after` | Trục của story là "sửa giá bất kỳ lúc nào". Không có test ⇒ PATCH hỏng/không ghi audit vẫn xanh | PATCH giá ⇒ 200 + `AuditLog.eventType = ProductUpdated`, `before.price ≠ after.price` |
| 5 | `sku` trùng ⇒ 409 chưa đi qua exception filter | Unit chỉ chứng minh service **ném** `AppException(CONFLICT)`. Filter dựng envelope sai ⇒ FE không chỉ được đúng ô nhập | POST P2002 ⇒ 409, `body.fieldErrors[0].field === 'sku'`, **không** ghi audit |
| 6 | `warrantyMonths: null` chưa đi qua `ValidationPipe` | AC-2 cấm chặn null (công lắp = không bảo hành). `@IsOptional()` bỏ qua null ở runtime — nhưng chỉ HTTP chứng minh được pipe không nuốt nó | POST `warrantyMonths: null` ⇒ 201, ghi DB `null` |
| 7 | 404 cho PATCH/DELETE | Chỉ GET 404 có test. Sửa/xoá id không tồn tại có thể âm thầm tạo mới / ghi audit rỗng | PATCH + DELETE id lạ ⇒ 404, **không** ghi DB, **không** ghi audit |
| 8 | DELETE chưa khẳng định event tới audit | Soft-delete là quyết định nhạy của story; xoá mà audit không ghi = mất dấu vết | DELETE ⇒ `eventType = ProductDeactivated`, `before.isActive: true → after: false` |
| 9 | POST thiếu field bắt buộc | Không có test ⇒ DTO rơi mất `@IsNotEmpty` vẫn xanh | POST chỉ có `price` ⇒ 400, `fieldErrors` chứa `name`/`sku`/`unit` |
| 10 | Field ngoài DTO (`isActive`, `id`) lọt xuống DB | `isActive` chỉ được đổi qua DELETE. Nếu lọt qua POST/PATCH ⇒ **bật lại sản phẩm đã ẩn / tạo sản phẩm ẩn** mà không qua đường soft-delete nào | POST + PATCH kèm `isActive` ⇒ payload ghi DB **không có** key đó |
| 11 | `costPrice: 0` không quyền ⇒ 403 chưa test ở HTTP | `0` là **giá trị**, không phải "vắng mặt". Đổi check sang truthy ⇒ người không quyền đặt được giá vốn về 0 | POST `costPrice: 0` thiếu `costs.view` ⇒ 403, `prisma.product.create` không được gọi |

## Mutation test — chứng minh test không "chết luôn xanh"

Gieo đúng loại bug mỗi test nhắm tới, sau đó khôi phục nguyên trạng (`npm test` 294/294 xanh lại):

| Mutation | Kết quả |
|---|---|
| Lật cờ query: `includeInactive === 'true'` → `!== 'true'` | **3 test đỏ** (gap #1) ✅ |
| Tắt `whitelist: true` ở `ValidationPipe` | **0 test đỏ** — xem ghi chú dưới |
| Service chuyển tiếp `isActive` từ body xuống Prisma (whitelist vẫn bật) | **đúng 1 test đỏ** (gap #10) ✅ |

**Ghi chú về mutation "tắt whitelist":** không test nào đỏ, và điều đó **đúng** — bất biến "field ngoài DTO không lọt xuống DB" được phòng thủ **hai lớp**: pipe loại field lạ khỏi DTO, **và** service liệt kê tay từng cột xuống Prisma. Phá một lớp thì lớp kia vẫn giữ. Mutation thứ ba phá đúng lớp còn lại và test đỏ ngay ⇒ test canh **kết quả** (payload ghi DB), không canh cơ chế — đúng thứ ta muốn. `describe` đã đổi tên cho khớp bản chất (không gọi nó là test "whitelist").

## Coverage

- **API endpoint:** 5/5 route `/products` phủ đủ (auth 401 · authz 403 trên cả 5 · happy path · 400 · 404 · 409 · 204).
- **AC:** AC-2 (int đồng, null hợp lệ) · AC-3 (guard 5 route) · AC-4 (gate 2 chiều `costPrice`) · AC-6 (3 event tới audit) — phủ ở tầng HTTP. AC-1/AC-5/AC-7 phủ bằng migration + kiến trúc + drift-guard (không phải thứ e2e chứng minh được).
- **E2E browser:** 0 — story không có UI (đúng phạm vi).

## Giới hạn còn nguyên (KHÔNG được tuyên bố đã kiểm)

- **Ràng buộc `@unique` trên `sku` vẫn chưa từng chạy thật.** Test 409 chỉ chứng minh service **dịch đúng** `P2002` thành envelope khi Prisma ném ra — nó **không** chứng minh Postgres từ chối `sku` trùng. Toàn bộ suite hermetic (mock Prisma); migration sinh offline, chưa từng `migrate deploy`. Nợ này đến hạn ở **Story 3.3** (chặn trùng SĐT = ràng buộc DB thật).
- Không có integration test chạm DB thật ⇒ FK/PK/unique của cả 5 migration đều chưa được kiểm.

## Next Steps

- Chạy suite trong CI (chưa có pipeline).
- Trả nợ DB-constraint trước/tại Story 3.3: dựng Postgres ephemeral (testcontainers hoặc docker compose) + 1 integration test khẳng định `sku` trùng thật sự bị DB từ chối.
