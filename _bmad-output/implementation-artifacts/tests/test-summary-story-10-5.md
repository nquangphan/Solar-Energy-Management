# Test Automation Summary — Story 10.5 (web adapter đơn/kho/tiền/chứng từ + nút chi tiết đơn theo quyền)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** Vitest 4 + Testing Library (web, `MemoryRouter` + fake port; adapter qua harness transport thật `http-adapter-harness.ts`)
**Kết quả:** web `typecheck` sạch · `npm test` **35 file / 388 test** xanh (trước QA 35 / 381, +7)

## Phạm vi

Story đã có sẵn 50 ca adapter (6 file `http-*-port.test.ts`), router 12a–f, composition root, guard link công khai, e2e backend `UUID_PARAM` + CORS. QA dò từng AC + từng callback điều hướng trong `AppRoutes.tsx` / từng nhánh fallback trong adapter, rồi mutate để xác nhận có ca đỏ. Chỉ thêm ca cho chỗ **mutant sống sót** trước QA.

## Gap phát hiện & auto-apply (+7 ca)

| # | AC | Gap (mutant sống trước QA) | Đã vá |
|---|----|-----|-------|
| 1 | AC-12 (D9) | `OrdersListScreen.onOpen` ("Xem" dòng đơn ⇒ `/orders/:id`) không có test — luồng chính danh sách → chi tiết | ✅ `app-routes.test.tsx` "the list row Xem opens that order's detail…" (+ back chi tiết ⇒ `/orders`) |
| 2 | AC-12 (D10) | `onChangeStatus` ⇒ `/orders/:id/transition` và back của `OrderStatusChangeScreen` ⇒ chi tiết | ✅ ca "Chuyển trạng thái opens…" (đơn đã chốt để nút thật sự hiện) |
| 3 | AC-12 (D9) | back của `PaymentScheduleScreen` / `ContractsScreen` ⇒ chi tiết đơn | ✅ ca "back from Thanh toán and from Hợp đồng…" |
| 4 | AC-12 (D9) | `InvoicesScreen.onOpenInvoice` ⇒ `/orders/:id/invoices/:invoiceId` (chỉ có ca phủ định) + back chi tiết hoá đơn ⇒ danh sách hoá đơn | ✅ ca "invoices.manage: Xem on an invoice opens its detail…" |
| 5 | AC-12 (D9) | back của `StockVouchersScreen` ⇒ `/inventory` | ✅ ca "back from Phiếu kho returns to /inventory" |
| 6 | D4 | `exportQuote` fallback `image/png` / `application/pdf` khi response thiếu `Content-Type` | ✅ `http-orders-port.test.ts` |
| 7 | D7 | `Content-Disposition` có header nhưng **không khớp** `filename="…"` (vd `filename*=UTF-8''…`) ⇒ fallback `${contractId}.pdf` | ✅ `http-contracts-port.test.ts` |

## Mutation (backup `cp`, khôi phục + `diff -q` sau mỗi mutant; mọi mutant compile)

| # | Mutant | Kết quả |
|---|---|---|
| M1 | list `onOpen` ⇒ `/orders` | ĐỎ 1/28 |
| M2 | detail `onBack` ⇒ `orderPath(id)` | ĐỎ 1/28 |
| M3 | `onChangeStatus` ⇒ payments path | ĐỎ 1/28 |
| M4 | transition `onBack` ⇒ `/orders` | ĐỎ 1/28 |
| M5 | payments `onBack` ⇒ `/orders` | ĐỎ 1/28 |
| M6 | contracts `onBack` ⇒ `/orders` | ĐỎ 1/28 |
| M7 | `onOpenInvoice` ⇒ danh sách hoá đơn | ĐỎ 1/28 |
| M8 | invoice detail `onBack` ⇒ chi tiết đơn | ĐỎ 1/28 |
| M9 | vouchers `onBack` ⇒ `/orders` | lần 1 **SỐNG** — mutant tương đương trong fixture (account chỉ `inventory.manage` ⇒ gate đẩy `/orders` về landing `/inventory`); sửa fixture thêm `orders.view_all` (landing `/orders`) ⇒ ĐỎ 1/28 |
| M10 | fallback mime báo giá ⇒ `application/octet-stream` | ĐỎ 1/29 |
| M11 | regex `Content-Disposition` nới nhận `filename*=` | ĐỎ 1/6 |

## Không thêm (đã phủ — tránh padding)

Multipart transition/attachments + replay 401, idempotency key body/không header/2 lần cùng khoá, vắng `amount`, unwrap `items`, `issueStock` 200/201, envelope lỗi mỗi port (story 10a–g); gate 3 nút + URL gõ tay + `/orders/new` vs `:id` + Duyệt chiết khấu + Kho (12a–f); landing KE_TOAN; app-entry `/orders` qua fetch; guard link công khai; e2e backend `UUID_PARAM` 6 controller + CORS expose. Backend không đổi trong QA ⇒ không chạy lại lane backend.

## Coverage

- Adapter: 6/6 port, mọi method ≥1 ca thành công; mọi nhánh fallback của `download.ts` / `quoteFile` có ca.
- Router: 11/11 route đơn/kho; mọi callback điều hướng trong `AppRoutes.tsx` cho route 10.5 (onOpen, onAdd, onOpenDiscountApprovals, onBack ×6, onChangeStatus, onOpenPaymentSchedule/Contracts/Invoices, onOpenInvoice, onOpenVouchers) có ca đỏ khi sai đích — trừ `CreateQuoteScreen.onDone` (cần đi trọn wizard; đã đo ở smoke tay AC-18).

## Next Steps

- `CreateQuoteScreen.onDone ⇒ orderPath(order.id)` chỉ được chứng minh bằng smoke tay; nếu muốn khoá bằng test cần một ca đi trọn wizard trên fake.
