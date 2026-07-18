# Test Automation Summary — Story 5.6 (Đính kèm ảnh bổ sung trong chi tiết đơn)

Ngày: 2026-07-18 · Workflow: `bmad-qa-generate-e2e-tests` · Framework: Jest + Supertest (đã có sẵn)

Story 5.6 vào workflow này khi lane unit/hermetic **đã dày** (26 ca ở
`backend/test/order-attachments.spec.ts`) và lane e2e đã có 5 ca. Việc của vòng này là tìm phần
**chỉ lane HTTP đo được** mà 5 ca kia còn bỏ trống, rồi bịt lại.

## Khoảng trống đã phát hiện và đã bịt

| # | Khoảng trống | Vì sao unit KHÔNG thấy | Ca đã thêm |
|---|---|---|---|
| 1 | Trần cứng multer của **route ảnh bổ sung** chưa ai canh | `FilesInterceptor` chỉ chạy ở tầng transport; unit gọi thẳng service nên hạ trần xuống bằng ngưỡng hợp đồng vẫn xanh 100% | 2 ca: 11 ảnh ⇒ 400 `maxCount`; ảnh > 10 MB ⇒ 400 `maxSize` (không 500/413) |
| 2 | AC-5 phạm vi chưa đo **qua dây** trên ba route mới | Unit khẳng định `AppException` mang 404; cái người dùng nhận là do `AllExceptionsFilter` dựng — 5.5 có tiền lệ hai con số lệch nhau | 3 ca: GET/POST/DELETE với đơn của người khác ⇒ 404 + `Không tìm thấy đơn hàng`, không chạm `findMany`, không byte lên storage, không xoá |
| 3 | **`deleteObject` vô hình ở lane e2e** — stub storage không có method này, lời gọi ném `TypeError` rồi bị chính `try/catch` của service nuốt ⇒ xoá R2 không được kiểm chứng ở đâu trên dây | Không phải giới hạn của unit mà là **lỗ hổng của fixture e2e**: bỏ hẳn lệnh `deleteObject` mà toàn bộ 165 ca e2e cũ vẫn xanh | Thêm `deleteObject` vào `storageStub` + 2 ca: 204 ⇒ object rời storage đúng `objectKey`; R2 reject sau commit ⇒ **vẫn 204** |

## Đột biến — chứng minh ca mới biết đỏ

Hoàn tác bằng `cp`, không `git checkout` (code story chưa commit).

| Đột biến | Kết quả |
|---|---|
| `TRAN_CUNG_SO_ANH`/`TRAN_CUNG_KICH_THUOC_BYTE` = ngưỡng hợp đồng (bỏ ×2) | **4 đỏ** — 2 ca mới của 5.6 + 2 ca cũ của 5.5 |
| Bỏ `findScopedOrThrow` khỏi `danhSachAnh()` | **1 đỏ** — đúng ca AC-5 của route GET |
| Bỏ hẳn `storage.deleteObject(row.objectKey)` | **1 đỏ** — ca AC-8 mới. *Trước vòng này đột biến đó sống sót toàn bộ lane e2e.* |

Mọi đột biến đều compile được (giữ chữ ký bằng `void <tham số>`), nên cái đỏ là test bắt hành vi,
không phải suite chết vì cú pháp.

## File đã sửa

- `backend/test/orders.e2e.spec.ts` — `storageStub.deleteObject` (jest.fn, xoá khỏi `storageMap`)
  + 7 ca mới trong `describe('Story 5.6 — ảnh bổ sung qua dây')`.

Không tạo file test mới: cả ba khoảng trống thuộc lane e2e đang có, tách file sẽ phải nhân bản
toàn bộ bộ mock repo + `storageMap`.

## Lane đã chạy

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend hermetic | `cd backend && npm test` | **72 suite / 1271 test xanh** (+7) |
| Backend e2e (riêng) | `npx jest orders.e2e` | **172 test xanh** (165 → 172) |
| Typecheck | `npx tsc --noEmit` | sạch |

**Lane CHƯA chạy:** `cd backend && npm run test:db` — `docker info` báo daemon chưa lên, và
`open -a Docker` từ shell agent không tạo được socket. Spec
`backend/test/order-attachments.db.integration.spec.ts` đã viết sẵn từ phase dev và tự skip khi
vắng `DATABASE_URL`; 3 checkbox của lane đó trong story vẫn để trống có chủ đích — **không giả xanh**.
Cần Đại Ca bật Docker Desktop từ GUI rồi chạy lại lane này.

Không chạy lại lane FE (`design-system npm test`, `mobile flutter test`) vì vòng này **không đụng**
file nào của web/mobile.

## Coverage sau vòng này

- **Route ảnh 5.6: 3/3** có e2e (GET danh sách · POST · DELETE), mỗi route đủ happy path + ca lỗi.
- **AC đo được ở tầng HTTP: AC-4, AC-5, AC-7, AC-8, AC-9, AC-10** — đều có ít nhất một ca qua dây.
- AC còn lại (AC-1/2/3/6/11 phần logic, AC-12→16 phần UI) do lane unit backend, `flutter test`
  và text-guard design-system canh, đã xanh từ phase dev.

## Câu hỏi còn treo

1. Lane DB (`test:db`) cần Docker bật thủ công — có chạy trước khi đóng story 5.6 không, hay để
   nợ tiếp như 5.5?
