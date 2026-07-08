# Backend Conventions — Phương Nam Solar

Hợp đồng đặt tên & quy ước cho **mọi** story backend. Nguồn: `ARCHITECTURE-SPINE.md#Consistency Conventions` + `project-context.md#Coding style`. Khi mâu thuẫn: **spine thắng**.

## Đặt tên (AC-3)

| Concern | Quy ước | Ví dụ |
|---|---|---|
| Entity (Prisma model) | **PascalCase** | `Order`, `OrderLineItem`, `Account` |
| Bảng DB | **snake_case số nhiều** (qua `@@map`) | `orders`, `order_line_items`, `accounts` |
| File | **kebab-case** | `prisma.service.ts`, `allowed-transition.ts` |
| REST route | **danh từ số nhiều, kebab-case** | `/orders`, `/orders/{id}/line-items` |
| Action nghiệp vụ | **POST sub-resource** (không phải verb ở path) | `POST /orders/{id}/chot` |
| ID | **UUID v4** mọi entity — **trừ** `Customer` (PK = SĐT chuẩn hoá **E.164**, chỉ chuẩn hoá ở backend `customers`, AD-9) | `id: uuid` |
| Tiền | **integer đồng** — KHÔNG float/decimal (AD-10) | `unitPriceSnapshot: int` |
| Ngày giờ | **ISO-8601 UTC** lưu DB; client hiển thị UTC+7 | `2026-07-08T09:00:00.000Z` |

> `GET /health` là ngoại lệ có chủ ý: endpoint **hạ tầng**, không phải resource nghiệp vụ → không áp quy ước danh từ số nhiều.

## Prisma `@@map` / `@map` (khi thêm model ở story sau)

Entity Prisma PascalCase → map sang bảng snake_case số nhiều. Skeleton (2.1) **chưa** khai model nào; đây là mẫu cho story sở hữu entity (Account = 2.4, Order = E4…):

```prisma
model Account {
  id    String @id @default(uuid())
  // ...
  @@map("accounts")
}

model OrderLineItem {
  id             String @id @default(uuid())
  unitPriceSnapshot Int  @map("unit_price_snapshot")
  // ...
  @@map("order_line_items")
}
```

## OpenAPI — SINH TỪ CODE, CẤM SỬA TAY (AD-12)

- `openapi/openapi.json` là **artifact SINH TỰ ĐỘNG** từ code NestJS (controller + DTO là **chân lý**). Đây là **hợp đồng cross-repo DUY NHẤT**: cả web lẫn mobile gen/validate client từ file này.
- **CẤM sửa tay** spec. Đổi contract = sửa DTO/controller rồi chạy:

  ```bash
  npm run openapi:gen
  ```

- **Drift-guard**: test regen in-memory rồi so **byte-for-byte** với file đã commit. Quên regen hoặc sửa tay → test fail (mirror drift-guard byte-for-byte của design-system Epic 1).
- Version của spec = version backend (`package.json`) → spec versioned.

## Lint / format (bắt buộc)

- ESLint (flat config) + Prettier. Chạy: `npm run lint`, `npm run format`.
- Không "mỗi người/file một kiểu".

## Bất biến kiến trúc chạm tới backend skeleton

- **AD-1** — chỉ `prisma/PrismaService` chạm DB; chỉ backend giữ credential (`DATABASE_URL` trong `.env` gitignored). Cấm module domain tự `new PrismaClient()` (source-guard test enforce).
- **AD-12** — OpenAPI sinh từ code, cấm sửa tay (ở trên).
- Tầng: API → Application → Domain → Infrastructure; Domain KHÔNG phụ thuộc Infrastructure.
