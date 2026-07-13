# Test Automation Summary — Story 3.2 (Giá phân tầng sau cờ)

Ngày: 2026-07-13 · Framework: Jest + supertest (đã có sẵn) · Hermetic, không cần Postgres.

## Kết quả

| | Trước | Sau |
|---|---|---|
| Suite | 39 | 39 |
| Test | 355 | **366** (+11) |
| Lint · format · build | xanh | xanh |

Không sửa một dòng `src/` nào — toàn bộ thay đổi nằm trong `backend/test/product-prices.e2e.spec.ts`.

## Phát hiện quan trọng nhất: 2 test AC-5 có sẵn đang XANH GIẢ

Story dùng test `GET /products/:id` (cờ TẮT ⇒ body không có key `prices`) làm bằng chứng cho AC-5 —
bất biến trung tâm của story ("cờ TẮT ⇒ mỗi sản phẩm một giá duy nhất", enforce ở backend theo AD-4).

**Test đó không chứng minh được gì.** Mock `prisma.product` trả cứng một object vốn đã không có key
`prices` và **lờ đi tham số `include`**. `not.toHaveProperty('prices')` xanh vì mock nghèo dữ liệu,
không phải vì service tôn trọng cờ.

Kiểm bằng đột biến: ép `tieredPriceInclude()` **luôn** trả `include` (bỏ hẳn điều kiện cờ) ⇒
**29/29 test vẫn xanh**. Mutation-test (c) trong story chỉ bắt được unit test của
`products.service.spec.ts` (assert tham số `include`); đường HTTP thì không ai canh.

**Đã sửa:** mock `product.findUnique`/`findMany` giờ bắt chước đúng ngữ nghĩa Prisma — chỉ đính
`prices` khi truy vấn có `include.prices`. Chạy lại đúng đột biến đó ⇒ **2 test ĐỎ**. Các test "cờ BẬT"
cũng bỏ luôn override thủ công, nên chúng thật sự đi qua dây `cờ → include → payload`.

## Test đã thêm (11)

**Đường đi thành công còn thiếu**

- `GET /products/:productId/prices` ⇒ 200 + sắp xếp `minQty` asc + hợp đồng payload chỉ `id`/`minQty`/`price`
  (endpoint duy nhất của story chưa từng trả 200 qua dây thật — trước đó chỉ có test 403).
- `GET /products/:productId/prices` sản phẩm không tồn tại ⇒ 404 (trước chỉ có ở unit).
- `GET /products/:productId/prices` khi cờ TẮT ⇒ vẫn đọc được bậc thang ngủ đông. Ghim hành vi cố ý:
  cờ chặn đường GHI (409) và chặn `prices` rò vào payload sản phẩm, **không** làm mù màn cấu hình.

**AC-5 trên danh sách (trước chỉ ghim `/:id`)**

- `GET /products` cờ TẮT ⇒ mọi phần tử không có key `prices`.
- `GET /products` cờ BẬT ⇒ mỗi phần tử mang bậc thang của nó.
- (`findMany` và `findUnique` là hai call-site khác nhau — sửa đúng một chỗ là bug.)

**Bài học HIGH của review 3.1, áp cho DTO giá mới** — trước đó chỉ ghim cho `enabled: null`

- `prices: null` · `minQty: null` · `price: null` ⇒ 400, không lọt xuống cột NOT NULL.
  Xác nhận thật: thêm `@IsOptional()` vào `price` ⇒ đúng 1 test ĐỎ.
- `price` âm ⇒ 400 (`@Min(0)` trước đó chưa bao giờ chạy).
- Thiếu hẳn key `prices` trong body ⇒ 400. Body rỗng KHÁC `{"prices": []}`: một cái là quên gõ,
  một cái là cố ý xoá bậc thang — đoán hộ người dùng ở đây là một request lỗi xoá sạch giá sỉ.

**Cờ hai chiều**

- `PATCH /feature-flags/:key` với `enabled: false` ⇒ 200 + `enabled=false`. Trước chỉ test chiều BẬT;
  chiều TẮT mới là chiều đưa cả danh mục về một giá.

## Coverage

| Endpoint | 2xx | 400 | 403 | 404 | 409 |
|---|---|---|---|---|---|
| `GET /feature-flags` | ✅ | — | n/a (`@AuthenticatedOnly`, có test 401) | — | — |
| `PATCH /feature-flags/:key` | ✅ bật + tắt | ✅ | ✅ | ✅ | — |
| `GET /products/:productId/prices` | ✅ | — | ✅ | ✅ | — |
| `PUT /products/:productId/prices` | ✅ (có mức + `[]`) | ✅ | ✅ | ✅ | ✅ |
| `GET /products` · `/products/:id` (key `prices`) | ✅ cờ BẬT/TẮT | — | — | — | — |

Story backend-only ⇒ không có E2E giao diện.

## Còn lại

- Ràng buộc tầng DB (`@@unique([productId, minQty])`, FK `onDelete: Cascade`) **vẫn chưa được kiểm** —
  migration sinh offline, chưa từng `migrate deploy`. Nợ có sẵn của repo, không phải của story này;
  test hermetic không thể trả nợ đó. Đến hạn ở Story 3.3 ("chặn trùng SĐT" là ràng buộc DB).
- Xanh giả kiểu này (mock giả định giàu hơn code) sẽ tái diễn ở mọi story có `include`/`select` điều kiện.
  Đáng cân nhắc một helper mock Prisma tôn trọng `include` khi Epic 4 bắt đầu.
</content>
