# Test Automation Summary — Story 10.2 (đổi field DTO tiếng Việt sang tiếng Anh)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic, `AppModule` thật + Prisma mock), guard đọc `openapi/openapi.json`
**Kết quả:** backend `npx jest` 117 suite / **2460 test** xanh (2459 → 2460, +1 ca, +2 nhóm assert) · eslint 2 file đã sửa: 0 error (3 warning có sẵn, không nằm ở dòng mới)

## Phạm vi

Chỉ backend (refactor contract), không có UI ⇒ không có E2E trình duyệt. Dev đã phủ dày: guard schema/property
(chống rỗng + ca dương/âm tổng hợp), "key mới có + key cũ vắng" cho 13 họ response của AC 9, mọi ca `fieldErrors`
của AC 10 (`reason`, `customerPhone` + gửi tên cũ `customerSdt`, `phone` create/409/PATCH `@IsAbsent`,
`nationalId`, `files` 0 file, file dưới tên cũ `anh` ⇒ 400 trên route attachments).

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | 10 | Field form cũ `anh` chỉ được thử trên `POST /orders/{id}/attachments`; `POST /orders/{id}/transition` là `FilesInterceptor` thứ hai, không có ca nào | Route transition đổi lại `'anh'` vẫn qua mọi ca hiện có ngoài ca đếm ảnh; không ca nào khoá "tên cũ ⇒ 400 envelope, không chuyển trạng thái, không lưu gì" | `orders.e2e.spec.ts`: ca mới `a file under the old form field \`anh\` ⇒ 400 envelope, no transition, nothing stored` |
| 2 | 9 | `returnOf` của phiếu kho chỉ assert `toMatchObject` (key mới), không assert `returnOf.ma` vắng | `toMatchObject` không thấy key thừa; hàm map lồng giữ cả `ma` thì mọi lane xanh | `stock-vouchers.e2e.spec.ts`: `returnOf` không có `ma` ở POST return và GET detail |
| 3 | 9 | GET detail phiếu kho (`/stock-vouchers/{id}`) không assert vắng `ma/soDong/tongSoLuong/nguoiTao` (chỉ ca POST có) | Hai đường gọi hàm map khác nhau ở controller | `stock-vouchers.e2e.spec.ts`: vòng `not.toHaveProperty` ở ca GET detail return |

Kèm theo: sửa 2 chuỗi test còn tên cũ (JSDoc `post()` nói field `anh`, tên ca `soAnhDaLuu 0` → `savedAttachmentCount 0`).

**Không thêm (đã phủ):** Customer (create/list/get/patch/lookup), Order detail + PATCH, OrderList, DiscountPending,
WarrantyLookup (`customer.phone`, `orders[].confirmedAt`), Lifecycle (`buoc/buocKeTiep/coTheHuy/trangThai` vắng),
Versions (vắng 4 key + `changes`/`qtyChanged` so `toEqual` chính xác), Attachments list/upload, transition
(`Object.keys` chính xác), StockList (`toEqual` chính xác), phiếu kho summary/lines (`toEqual`), stock-issue `voucher`,
InvoiceDetail (`toEqual` chính xác với `customerPhone`).

## Kiểm chứng test mới bằng đột biến (backup `cp`, khôi phục + `cmp` sạch)

| Mutant | Kết quả |
|---|---|
| `orders.controller.ts` transition `FilesInterceptor('files')` → `'anh'` | ĐỎ (ca mới; ca attachments vẫn xanh ⇒ đúng là lỗ của gap 1) |
| `toStockVoucherDetailDto` rò thêm `ma` vào `returnOf` | ĐỎ 2 ca (POST return + GET detail) |

## Test theo file

- [x] `backend/test/orders.e2e.spec.ts`: +1 ca (transition + field cũ `anh`), sửa 2 chuỗi tên cũ
- [x] `backend/test/stock-vouchers.e2e.spec.ts`: +assert key cũ vắng (top-level + `returnOf`) ở 2 ca có sẵn

## Coverage (AC 9 / AC 10)

- Họ response AC 9: **13/13** có assert "mới có + cũ vắng" ở tầng runtime (sau vá: cả hai đường phiếu kho + `returnOf`)
- Ca `fieldErrors` AC 10: **9/9** (thêm transition `anh` ⇒ 2/2 route multipart)

## Lane

- Backend `npx jest`: 117 / 2460 xanh. Không đụng `src/`, design-system, web, mobile ⇒ không chạy lại các lane đó.

## Next Steps

- Chạy `bmad-code-review` cho story 10.2.
