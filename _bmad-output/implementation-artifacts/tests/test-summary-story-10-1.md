# Test Automation Summary — Story 10.1 (đổi route/tham số/operationId tiếng Việt sang tiếng Anh)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic, `AppModule` thật + Prisma mock), guard đọc `openapi/openapi.json`
**Kết quả:** backend `npm test` 117 suite / **2447 test** xanh (2441 → 2447, +6) · eslint 3 file đã sửa: 0 error

## Phạm vi

Chỉ backend (refactor contract), không có UI ⇒ không có E2E trình duyệt. Dev đã phủ: guard
`no-vietnamese-api-contract` (danh sách cấm + chống rỗng + ca tổng hợp), 15 route cũ nhiều segment ⇒ 404,
2 route cũ bị `:id` nuốt ⇒ 404, `?sdt=` ⇒ 400 `phone` ở cả hai route lookup, đổi URL trong mọi e2e.

## Gap phát hiện & auto-apply (+6 ca)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | 7 | Guard chỉ soi **vắng** token cũ, không soi **có mặt** 16 path mới | Route đổi tên mà biến mất hoặc rơi một method (vd `attachments` mất `post`) thì guard vẫn xanh | `no-vietnamese-api-contract.spec.ts`: 16 path ↔ tập method |
| 2 | 10 | Không ca nào khẳng định 6 operationId mới | operationId là tên method Dart sinh ở 10.6; đổi thành tên khác vẫn qua guard cấm | `no-vietnamese-api-contract.spec.ts`: `arrayContaining` 6 id |
| 3 | 1, 11 | Không e2e happy path `GET /orders/warranty-lookup?phone=` | Route mới chỉ được thử ở ca 400; không ca nào chứng minh `phone` tới tận service và chuẩn hoá E.164 | `orders.e2e.spec.ts`: 200 + `findUnique({ sdt: '+84…' })` |
| 4 | 2, 11 | Lỗi `isPhoneNumber` từ service (sau pipe) ở warranty-lookup chỉ có unit | Đổi `field` service là lệch so với story (dev tự sửa) — mã HTTP + envelope chỉ đo được ở lane e2e | `orders.e2e.spec.ts`: `?phone=abc` ⇒ 400 `[{field:'phone', code:'isPhoneNumber'}]` |
| 5 | 2, 11 | `GET /customers/abc` chỉ kiểm 400, không kiểm `field`; `PATCH /customers/abc` không có ca nào | Cùng endpoint có thể trả `sdt` (service) dù tham số tên `phone` | `customers.e2e.spec.ts`: thêm assert `field==='phone'` cho GET, ca mới cho PATCH |
| 6 | 3 | Story §1 nói route cũ ⇒ 404 **kể cả không token**, chưa ca nào đo | Ca có sẵn luôn gửi token; nếu route cũ lại khớp handler có guard thì sẽ là 401 | `orders.e2e.spec.ts`: `POST /orders/:id/chot` không token ⇒ 404 |

**Không thêm (đã phủ):** 404 cho từng route cũ (it.each 15 + 2), `?sdt=` ⇒ 400 (2 route), `/customers/0912345678`
GET/PATCH chạy đúng (e2e sẵn có), 7 khoá đọc ở `orders-read-gate`, drift-guard file = code.

## Kiểm chứng test mới bằng đột biến (backup `cp`, khôi phục + `cmp` sạch)

| Mutant | Kết quả |
|---|---|
| `CustomersService.update` `field 'phone'`→`'sdt'` | ĐỎ (ca PATCH mới) |
| `CustomersService.findOne` `field 'phone'`→`'sdt'` | ĐỎ (assert GET mới) |
| `OrdersService.traCuuBaoHanh` `field 'phone'`→`'sdt'` | ĐỎ (ca warranty `abc`) |
| `openapi.json`: `/orders/{id}/reopen` → `/reopenx` | ĐỎ (ca path mới) — guard cấm vẫn xanh, đúng là gap 1 |
| `openapi.json`: `StockItemsController_list` → `_listAll` | ĐỎ (ca operationId) |

## Test theo file

- [x] `backend/test/no-vietnamese-api-contract.spec.ts` — +2 ca (path mới + method; operationId mới)
- [x] `backend/test/orders.e2e.spec.ts` — +3 ca (không token ⇒ 404; warranty-lookup 200; warranty-lookup `abc` ⇒ 400 `phone`)
- [x] `backend/test/customers.e2e.spec.ts` — +1 ca (PATCH `abc` ⇒ 400 `phone`), +1 assert (GET `abc` field `phone`)

## Coverage theo AC

- AC 1 (route mới, hành vi giữ): e2e sẵn có trên mọi route mới + warranty-lookup 200 ✅
- AC 2 (`sdt`→`phone`, chuẩn hoá ở backend): 4 chỗ đều có ca 400 `phone`, 2 ca chuẩn hoá E.164 ✅
- AC 3 (không alias, 404 envelope): 17 ca có token + 1 ca không token ✅
- AC 4 (sinh lại spec): drift-guard ✅
- AC 5 (guard + chống rỗng + mutant): guard D4 + M1–M5 của dev ✅
- AC 7 (16 path, method giữ): ca mới ✅ · AC 9 (`sdt` vắng): guard ✅ · AC 10 (6 operationId): ca mới ✅
- AC 11, 12: ✅ · AC 6, 8, 14, 15: kiểm tay/docs/lane — ngoài phạm vi workflow này

## Bước tiếp theo

- Chạy `bmad-code-review` cho 10.1.
- Lane DB/web/mobile/design-system không chạy lại: lần này chỉ sửa test backend hermetic.
