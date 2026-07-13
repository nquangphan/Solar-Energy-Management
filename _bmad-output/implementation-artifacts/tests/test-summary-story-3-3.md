# Test Automation Summary — Story 3.3 (CRUD Khách hàng, SĐT E.164 khoá chính)

Ngày: 2026-07-13 · Framework: Jest + supertest (đã có sẵn) · Lane hermetic + lane DB thật (`npm run test:db`).

## Kết quả

| | Trước | Sau |
|---|---|---|
| Suite | 43 | 43 |
| Test hermetic (`npm test`) | 462 xanh / 6 skip | **486 xanh / 8 skip** (+24) |
| Lane DB thật (`npm run test:db`) | 6 xanh | **8 xanh** (+2) |
| Lint · format · build | xanh | xanh |

**Không sửa một dòng `src/` hay `prisma/` nào.** Toàn bộ thay đổi nằm trong 4 file test:
`customers.e2e.spec.ts` · `customers.service.spec.ts` · `customers.db.integration.spec.ts` ·
`openapi-drift.spec.ts`.

## Lỗ hổng đã vá (9)

Bộ test của story vốn đã dày (73 test, phủ tốt AC-1..AC-9). Chín chỗ dưới đây là những gì **không
ai canh** — mỗi cái đều được chứng minh bằng đột biến, không phải bằng cảm giác.

### 🔴 1. Cửa sau của AC-6: PATCH xoá được `sourceNote` của nguồn "Khác"

Luật "nguồn `isOther` ⇒ bắt buộc `sourceNote`" được kiểm ở `create()` và khi **đổi sang** nguồn mới.
Nhưng khách đang ở nguồn "Khác" mà `PATCH {"sourceNote": null}` thì sao? Không test nào hỏi.

Bản ghi kết thúc ở **đúng trạng thái AC-6 cấm** — chỉ là đi vòng qua cửa sau. Code hiện tại xử lý
đúng (`effective()` lấy giá trị hiệu lực sau PATCH), nhưng **không có test nào giữ nó lại**.

Đột biến: đổi `effective(dto.sourceNote, before.sourceNote)` → `dto.sourceNote ?? before.sourceNote`
(một cách viết rất tự nhiên, biên dịch sạch, coi `null` như "vắng mặt") ⇒ **2 ĐỎ** với test mới,
**0 ĐỎ** với bộ test cũ. Đây là lỗ hổng nghiêm trọng nhất tìm được.

### 🔴 2. `GET /customers` — cả một endpoint không có lấy một test

Danh sách khách chỉ được test ở ca **403**. Happy path, mảng rỗng, và `orderBy: { createdAt: 'desc' }`
chưa từng được assert — cả ở unit lẫn e2e. Thứ tự là hợp đồng, không phải trang trí: sale mở màn khách
để tìm người vừa nhập xong.

Đột biến: `desc` → `asc` ⇒ **2 ĐỎ** (unit + e2e). Trước đó: xanh trơn.

### 🔴 3. AC-12: hợp đồng OpenAPI chỉ được verify BẰNG MẮT

Story tự viết (Task 7): *"drift-guard xanh KHÔNG chứng minh hợp đồng đúng"* — rồi verify
`CustomerResponseDto` và `required = ['sdt','custType','name','sourceId']` bằng cách nhìn file. Không có
test nào. Drift-guard byte-for-byte xanh **y hệt** nếu code quên hẳn một route.

Đã thêm 3 test vào `openapi-drift.spec.ts`: 3 route + 4 schema `Customer*` có mặt · `required` đúng **4
field định danh** (ai thêm `@IsNotEmpty()` vào `cccd` là đổi hợp đồng của Story 3.4 mà không hay) · mọi
route khách hàng đòi bearer (đây là danh bạ khách: SĐT, CCCD, MST, tài khoản NH).

### 🔴 4. AC-10: seed idempotent — chưa có gì chứng minh

Lane DB chỉ đếm "≥ 5 dòng, đúng 1 `isOther`". **Chưa ai chạy seed lần thứ hai.** Đọc code thấy `upsert`
là chưa đủ — cái cần biết là chạy lại trên DB đang có dữ liệu thì chuyện gì xảy ra.

Test mới gọi **đúng lệnh người vận hành gọi** (`npx prisma db seed`) rồi đếm lại: số dòng không đổi,
vẫn đúng 1 `isOther`, và **id giữ nguyên** (khách cũ FK vào chúng — seed lại mà sinh id mới là mồ côi
cả bảng).

Đột biến: `upsert` → `create` trong `seed.ts` ⇒ **1 ĐỎ**. Trước đó: xanh.

### 5. UNIQUE `customer_sources.name` chưa kiểm ở DB thật

Đó là ràng buộc mà `upsert`-theo-`name` đứng lên. Không có nó, seed idempotent chỉ là may rủi. Nay
kiểm bằng Postgres thật (insert trùng tên ⇒ `P2002`).

### 6. Trần `@MaxLength` chỉ canh `name`

`cccd`(20) · `taxCode`(20) · `address`(500) · `bankAccount`(100) · `sourceNote`(500) đều có trần trong
DTO nhưng **không field nào có test** ⇒ gỡ một `@MaxLength` cũng không ai đỏ, cái trần chỉ còn là bình
luận (đúng bài học HIGH của review 3.2). Nay mỗi field một test vượt trần.

Đột biến: gỡ `@MaxLength(20)` khỏi `cccd` ⇒ **1 ĐỎ**.

### 7. Field bắt buộc VẮNG MẶT (khác với `null`)

Ca `null` được canh kỹ. Ca **thiếu hẳn field** thì chỉ `sourceId` có test — `sdt`/`custType`/`name` đi
lọt. Nay cả bốn đều có.

### 8. `sdt` sai KIỂU ở tầng HTTP

`@IsString()` là thứ duy nhất chắn giữa một mảng/số/object lồng và `normalizeVnPhone()`. Không test =
không ai biết khi nó bị gỡ. Nay: số · mảng · object lồng ⇒ 400.

Bổ sung cùng khối: `sdt: ''` và chuỗi 20 chữ số ở tầng HTTP (unit có, e2e thiếu); `GET /customers/abc`
⇒ **400** chứ không phải 404 (SĐT rác chưa từng là khoá hợp lệ).

### 9. `PATCH {}` body rỗng

Mọi field `undefined` — không được 500. Nay có test.

## Chứng minh test có RĂNG (mutation)

Test mới xanh ngay lần chạy đầu ⇒ bắt buộc phải kiểm xanh-thật hay xanh-giả. Bốn đột biến, mỗi cái
**biên dịch sạch** (một mutant không biên dịch được thì làm cả suite đỏ và không chứng minh gì — bài học
của chính story này):

| Đột biến | Bộ test CŨ | Bộ test MỚI |
|---|---|---|
| `findAll` sắp `asc` thay vì `desc` | xanh | **2 ĐỎ** |
| `assertSourceNote` đọc `dto.sourceNote ?? before` (coi `null` là vắng mặt) | xanh | **2 ĐỎ** |
| Gỡ `@MaxLength(20)` khỏi `cccd` | xanh | **1 ĐỎ** |
| `seed.ts` dùng `create` thay `upsert` | xanh | **1 ĐỎ** |

Cả 4 file `src/`/`prisma/` đã khôi phục **byte-for-byte** (verify bằng `diff`).

## Độ phủ theo AC

| AC | Trạng thái |
|---|---|
| AC-1 chuẩn hoá E.164 · AC-2 SĐT rác ⇒ 400 | phủ (+ kiểu sai, chuỗi rỗng, GET rác ⇒ 400) |
| AC-3 chặn trùng (409 + PK thật) | phủ |
| AC-4 hai loại khách | phủ (+ trần chuỗi mọi field) |
| AC-5 `sourceId` bắt buộc | phủ (+ vắng mặt vs `null`) |
| AC-6 `sourceNote` khi `isOther` | **vá cửa sau PATCH** |
| AC-7 `sdt` bất biến | phủ (+ PATCH rỗng) |
| AC-8 EventBus ⇒ Audit | phủ |
| AC-9 ràng buộc DB thật | phủ (+ UNIQUE `name`) |
| AC-10 `CustomerSource` + seed | **vá idempotency chạy-thật** |
| AC-11 quyền | phủ |
| AC-12 OpenAPI | **vá — hợp đồng nay có test, không còn verify bằng mắt** |
| `GET /customers` | **vá — trước đó trống** |

## Việc cần Đại Ca biết

- **`auth.e2e.spec.ts` đỏ 2 test đúng MỘT lần** (`POST /auth/login` kỳ vọng 200) ở lần chạy full suite
  đầu tiên, rồi tự xanh lại. **Không tái hiện được** sau 6 lần chạy (kể cả `--runInBand`), và suite đó
  xanh khi chạy riêng. Không liên quan diff này (em không đụng `auth/`), nhưng nó là **flake có thật** —
  nếu tái diễn ở CI thì đáng truy, đừng cho là nhiễu.
- Lane DB vẫn **tự skip khi vắng `DATABASE_URL`** ⇒ `npm test` giữ nguyên hermetic. Test seed mới spawn
  `npx prisma db seed` thật (timeout 180s) nên nó **chỉ** chạy trong `npm run test:db`.
