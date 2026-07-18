# Test Automation Summary — Story 5.5

**Chuyển trạng thái thủ công + đính kèm ảnh optional** · 2026-07-18 · baseline `71c7c3c`

## Gap đã phát hiện và đóng

Story 5.5 ship 27 test hermetic ở tầng **service/domain**, nhưng **không test nào ở lane
`*.e2e.spec.ts`** — lane HTTP thật (guard + pipe + interceptor + filter). Hai route mới cũng
vắng mặt trong danh sách "authn/authz fail-closed trên MỌI route" của `orders.e2e.spec.ts`.

| # | Gap | Vì sao lane cũ mù | Đã đóng bằng |
|---|---|---|---|
| G1 | `FilesInterceptor` (multer) chưa từng chạy trong bất kỳ test nào | Unit test gọi thẳng `OrdersService` ⇒ multer không tồn tại ở đó | 3 test `AC-9 giữ được envelope 400 dù đi qua multer` |
| G2 | 2 route mới không có trong route inventory fail-closed | Danh sách là mảng viết tay, thêm route không tự vào | +2 entry ⇒ +4 test (401 / 403) |
| G3 | `ValidationPipe` trên field text của form multipart chưa được chứng minh | Body multipart đi đường khác body JSON | 2 test `ValidationPipe trên field text` |
| G4 | `StreamableFile` → header thật chưa đo | Unit chỉ khẳng định service trả buffer | 3 test `AC-8 — proxy đọc bytes` |
| G5 | `buocKeTiep` trên response `/vong-doi` chưa đo qua dây | Unit gọi `service.lifecycle()` trực tiếp | 2 test `AC-4/AC-11` |

**Tổng: +27 test** trong `backend/test/orders.e2e.spec.ts` (149 test, trước 122).

## Xác thực bằng đột biến

Đột biến quan trọng nhất — hạ trần cứng interceptor xuống **bằng** giới hạn hợp đồng
(`TRAN_CUNG_SO_ANH = SO_ANH_TOI_DA`, bỏ `* 2`). Đây là thay đổi **trông như dọn dẹp hợp lý**:
xoá một hằng số nhân 2 khó hiểu để "khớp hợp đồng".

| Lane | Kết quả dưới đột biến |
|---|---|
| `order-status-change.spec.ts` + `attachment-limits.spec.ts` (43 test) | **XANH HẾT** — hoàn toàn mù |
| `orders.e2e.spec.ts` (test mới) | **2 ĐỎ**, đúng hai test nhắm vào nó |

Chế độ hỏng: multer ném trước handler ⇒ envelope mất `fieldErrors`
(`TypeError: Cannot read properties of undefined`) ⇒ AC-9 chết im lặng.
Mutant **compile được** (`tsc --noEmit` sạch) trước khi tin kết quả; hoàn tác bằng `cp`.

## Lệch hợp đồng phát hiện được — CHỜ ĐẠI CA QUYẾT, chưa sửa

**AC-13 nói 409 CONFLICT; qua dây thật trả 400 VALIDATION_ERROR.**

`@IsIn(SU_KIEN_THU_CONG)` ở `StatusChangeRequestDto` chặn `chot`/`mo_lai`/`huy`/`du_coc`/
`ap_chiet_khau` ngay tại `ValidationPipe`, nên whitelist 409 trong service **không bao giờ tới
lượt** cho năm sự kiện đó. Unit test khẳng định 409 và xanh — vì nó bỏ qua pipe.
`@ApiConflictResponse` của route (và do đó `openapi.json`) đang quảng cáo 409 cho ca này.

- **Bất biến an toàn VẪN ĐÚNG:** không bao giờ 2xx, `Order.status` không đổi, không byte nào
  lên storage. Test `AC-13` canh đúng bất biến đó và **không** phụ thuộc mã lỗi.
- Một test riêng **ghim con số 400 hiện tại** kèm docstring, để đổi chủ ý là đỏ, không im lặng.
- Ba lựa chọn: (a) giữ 400, sửa AC-13 + `@ApiConflictResponse` + regen OpenAPI;
  (b) bỏ `@IsIn`, để service trả 409 đúng AC; (c) giữ nguyên, coi 400 và 409 đều đạt.

## Coverage

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend hermetic | `cd backend && npx jest` | **71 suite / 1224 test xanh** (trước: 1197) |
| Backend typecheck | `npx tsc --noEmit` | sạch |
| Backend DB lane | `cd backend && npm run test:db` | **CHƯA CHẠY — Docker daemon down** |

Route Story 5.5 phủ ở lane e2e: **2/2**
(`POST /orders/:id/chuyen-trang-thai`, `GET /orders/:id/anh/:attachmentId`) + mở rộng
`GET /orders/:id/vong-doi`.

## Next Steps

1. **Đại Ca quyết độ lệch 400↔409 của AC-13** (ba lựa chọn ở trên).
2. **Bật Docker Desktop bằng tay** rồi `cd backend && npm run test:db` — `open -a Docker` từ
   shell agent không tạo được socket. 4 checkbox lane DB của story vẫn để trống có chủ đích;
   `order-status-change.db.integration.spec.ts` đã viết sẵn, compile sạch, chưa từng chạy.
</content>
