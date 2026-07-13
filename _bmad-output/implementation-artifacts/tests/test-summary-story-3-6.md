# Test Automation Summary — Story 3.6 (Gói vật tư — `ProductGroup` / `ProductGroupItem`)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-14 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic) + lane DB Postgres thật
**Kết quả:** 47 suite / **683 test** xanh (baseline 674 ⇒ **+9, 0 regression**) · lane DB **34** xanh · lint + format + build sạch

## Phạm vi

Story 3.6 là **backend-only** (7 route REST, **KHÔNG dựng màn nào**) ⇒ **không có E2E trình duyệt để
sinh**. Tầng "end-to-end" của story này là **e2e HTTP qua `supertest`**: `AppModule` thật + guard toàn
cục + `ValidationPipe` + thứ tự route + serialize, chỉ override `PrismaService`.

Ba suite đã có sẵn từ dev-story (`.service.spec` · `.e2e.spec` · `.db.integration.spec`) và **đều
xanh**. Vì vậy công việc ở đây là **phân tích lỗ hổng**, không viết lại từ đầu.

## Gap phát hiện & auto-apply (9 case mới, tất cả vào `test/product-groups.e2e.spec.ts`)

Tiêu chí: một gap chỉ tính là **THẬT** nếu **đột biến dòng code sản xuất mà nó canh vẫn để cả suite
XANH**. Mỗi gap dưới đây được kiểm bằng đột biến — mutant **biên dịch sạch** (`npm run build`) trước
khi chạy, vì mutant lỗi TS làm cả suite đỏ và **chứng minh 0**. Khôi phục bằng **`cp` từ backup**,
KHÔNG `git checkout` (code story chưa commit).

| # | AC | Gap | Vì sao là gap | Đột biến kiểm chứng | Kết quả |
|---|----|-----|---------------|---------------------|---------|
| A | AC-3 | `?includeInactive=` chưa ca nào gửi qua HTTP | Chuỗi query → boolean **chỉ xảy ra ở controller**; unit test gọi thẳng `findAll(boolean)` nên **không bao giờ chạy qua dòng đó**, e2e thì chưa từng gửi query param ⇒ dòng này **hoàn toàn trần** | `includeInactive === 'true'` → `Boolean(includeInactive)` | ✅ **ĐỎ** đúng 1 ca. Trước khi vá: gói **đã tắt rò ra picker** qua `?includeInactive=false` mà **cả suite vẫn xanh** |
| B | AC-3 | `@MaxLength(100/500)` chưa ca nào chạm | Cột `name`/`description` là **TEXT** trong Postgres (`migration.sql`) ⇒ **DB không có trần** ⇒ DTO là hàng rào **duy nhất** chặn tên gói 10MB | gỡ `@MaxLength` khỏi create DTO (2 field) + update DTO (`name`) | ✅ **ĐỎ** đúng 3 ca |
| C | AC-4 | `PUT :id/items` thiếu `productIds` | `undefined` xuống service ⇒ `for...of undefined` trong `assertNoDuplicateProductId` ném TypeError ⇒ **500 lộ stack** thay vì 400 | thêm `@IsOptional()` vào `productIds` | ✅ **ĐỎ** với đúng `Received: 500` |
| D | AC-3 | `PATCH { isActive }` (ca song sinh của `POST` đã có) | AC-3 **CẤM** `isActive` trong body sửa | — | ⚠️ **Không phải false-PASS độc nhất** — xem ghi chú #2 |

**Không sửa một dòng code sản xuất nào** — code đúng, chỉ test thiếu.

### 🔴 Hai giả định ban đầu SAI, đã sửa theo bằng chứng (không giấu)

1. **`@IsArray()` KHÔNG phải thứ chặn 500 ở gap C.** Giả định đầu là gỡ `@IsArray()` sẽ làm ca đó đỏ.
   **Đột biến nói ngược: KHÔNG đỏ** — `@IsUUID('4', { each: true })` đã tự chặn `undefined`. Thứ thật
   sự giữ ranh giới 400-vs-500 là việc `productIds` **BẮT BUỘC có mặt** (không `@IsOptional()`).
   Comment trong test **đã sửa lại theo bằng chứng**, không giữ lý do sai.
2. **Gap D không có đột biến một-dòng nào chỉ mình nó bắt.** Unit spec đã assert payload ghi
   (`expect(data).not.toHaveProperty('isActive')`). Ca e2e mới là **phòng thủ theo tầng** (chứng minh
   `whitelist: true` lột `isActive` khỏi body HTTP) + **đối xứng** với ca `POST` đã có, và nó mã hoá
   thẳng AC-3. **Giữ lại, nhưng không tính là gap false-PASS** như A/B/C.

## Không thêm (đã phủ — tránh padding)

- 403 thiếu `catalog.manage` cho **cả 7 route** · `costPrice` vắng mặt trong body · thứ tự khai route
  (`:id/reactivate`, `:id/items` không bị `:id` nuốt) · 409 trùng tên · `name` rỗng ⇒ 400 — **đã có**.
- 404 cho `PATCH`/`DELETE`/`reactivate`/`PUT items` — **unit đã phủ** ở tầng service; thêm bản e2e chỉ
  là trùng lặp.
- Lane DB: `@@unique` cặp · `ON DELETE CASCADE`/`RESTRICT` · atomic-replace 3→0→2 · giá vốn không rời
  Postgres thật — **đã có, không tìm thấy ràng buộc DB nào còn hở**.

## Coverage theo AC

- **API: 7/7 route** có e2e (403 · happy path · lỗi tới hạn).
- **AC 1-6, 8-10:** có ca canh ✅
- **AC-7** (ràng buộc **phủ định**: "gói không dính vào Đơn"): **không test được ở story này** — bảng
  `Order` chưa tồn tại nên không có gì để assert vắng mặt. Đúng như story ghi: đây là **hợp đồng bàn
  giao cho Story 4.1**, không phải lỗ hổng test.
- **E2E trình duyệt: 0** — đúng phạm vi (không có màn nào).
- Bất biến an ninh trung tâm (**`costPrice` không rời server qua cửa gói**) được canh ở **cả ba tầng**:
  unit (soi `select` truyền vào Prisma), e2e (soi body qua dây), lane DB (soi payload đọc từ Postgres
  thật, nơi `costPrice` CÓ giá trị).

## Kết quả chạy

```
cd backend
npm test              → 47 suite / 683 test xanh   (baseline 674 ⇒ +9, 0 regression)
npm run test:db       → 3 suite / 34 test xanh     (Postgres thật — không đụng, không regression)
npm run lint          → sạch
npm run format:check  → sạch
npm run build         → sạch (nest build = cổng type)
```

## Bước tiếp theo

- Màn quản lý gói (story riêng, cần mockup mới) sẽ cần **E2E trình duyệt thật** — chưa có màn thì chưa
  có gì để test.
- ⚠️ **7 ca 403 sẽ phải sửa khi Story 4.1 nới quyền.** `THO_KS` (người dựng báo giá) không có
  `catalog.manage` ⇒ picker sẽ 403. Test hiện tại khẳng định **hành vi đúng của code hôm nay**. Đó là
  dấu hiệu tốt: khi ai đó nới quyền, các ca này **đỏ và ép họ nhìn thấy quyết định đó**.

## Câu hỏi tồn đọng

- Không. Toàn bộ gap đã auto-apply theo yêu cầu. Hai giả định sai đã được đột biến bóc ra và sửa lại
  trong chính comment của test.
