# Tóm tắt kiểm thử tự động — Story 7.4 (Tạo Hoá đơn từ Đơn, lưu DB)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (e2e hermetic qua `initAppOnLoopback`) + lane DB Postgres; web Vitest + Testing Library; mobile flutter_test; design-system node:test
**Kết quả:** backend `npx jest` **113 suite / 2328 test** xanh (+11 so với 2317 lúc dev) · prettier + eslint sạch trên file đã sửa

## Phạm vi

Đã rà 11 AC dẫn xuất với các test dev đã viết: domain `invoice-domain.spec.ts`; unit `invoices.service.spec.ts`; e2e `invoices.e2e.spec.ts`; lane DB `invoices.db.integration.spec.ts`; guard `no-unscoped-order-write.spec.ts` + `orders-module-wiring.spec.ts`; web `invoices-screen.test.tsx` + `screens-render.test.tsx`; mobile `invoices_screen_test.dart` + `order_detail_screen_test.dart`; parity `design-system/screens/invoices.test.mjs` + `order-detail.test.mjs`.

Domain, unit, lane DB và UI đã phủ kín. Lỗ nằm ở tầng HTTP. Lane DB không chạy trong `npm test`, mà fixture e2e lại ghim cứng `discountAmount: null` và `vatMode: 'co_vat'` cho mọi bản đơn, chỉ có 2 dòng nhỏ, và chỉ đo trạng thái `dachot`/`hoanthanh`. Vì vậy chiết khấu, không VAT, tổng > INT4 và các trạng thái đã chốt đi tiếp chưa có ca nào đo qua JSON thật.

## Lỗ tìm được và đã vá

| # | AC | Lỗ | Đã vá |
|---|----|-----|-------|
| 1 | AC-1 | Chiết khấu đã duyệt chụp ở version ⇒ `discountAmount` snapshot, `total = subtotal − discount + VAT`: chỉ có ở domain | ✅ fixture: `versionSnapshot` (vatMode + discountAmount) reset mỗi ca; e2e: số kỳ vọng lấy từ `resolveOrderTotals` (không gõ tay), dòng DB mang BigInt đúng, overview `orderTotal` khớp |
| 2 | AC-1 | Đơn `applyVat:false` ⇒ `vatAmount = 0`: chỉ có ở lane DB | ✅ e2e: `khong_vat` ⇒ `applyVat:false`, `vatAmount 0`, `total = subtotal`, dòng DB `vatAmount 0n` |
| 3 | AC-6 | Tổng > 2.147.483.647 qua serialize JSON thật: chỉ có ở lane DB | ✅ e2e: 1 dòng 2 × 1.500.000.000 ⇒ 200, `subtotal 3.000.000.000`, `total` chính xác ở POST, overview `orderTotal` và `invoices[0].total`; dòng con `amount 3_000_000_000n` |
| 4 | AC-7 | Đơn đã chốt và đã đi tiếp (`dacoc`/`thicong`/`nghiemthu`/`danggiao`/`dagiao`) ⇒ tạo được: chỉ có ở domain/unit | ✅ e2e `it.each` 5 trạng thái: overview `creatable:true`, `blockedReason:null`, POST 200, 1 audit |
| 5 | AC-7 | Đơn 0 dòng bị từ chối: chưa kiểm "KHÔNG gọi `nextval`" và 0 audit (ca trạng thái đã có) | ✅ thêm `queryRaw` gọi đúng 1 lần (chỉ `FOR UPDATE`) + 0 audit `InvoiceCreated` |
| 6 | AC-3/AC-4 | Danh sách overview chưa so shape với body POST; năm trong `invoiceNo` chưa đối chiếu UTC+7 của `issuedAt` qua HTTP | ✅ e2e: `overview.invoices` toEqual `[POST body]`; `invoiceNo` = `HD-{năm UTC+7 của issuedAt}-0731` |
| 7 | AC-9 | `view_own` mới có ca assignee, chưa có ca owner; POST đơn không tồn tại với `view_all` chưa có ca riêng | ✅ e2e: owner ⇒ overview 200 + POST 200; POST id lạ ⇒ 404 `NOT_FOUND` cùng message, 0 khoá, 0 ghi, 0 audit |

## Đột biến kiểm ca mới (sao lưu bằng `cp`, không `git checkout`, đã khôi phục — `cmp` khớp)

| Mutant | Bộ ca mới | Bộ ca cũ (27) |
|---|---|---|
| `invoice-snapshot.ts`: `discountAmount: 0` | ĐỎ 1 (lỗ 1) | xanh — sống |
| `invoice-snapshot.ts`: `applyVat: true` cố định | ĐỎ 1 (lỗ 2) | xanh — sống |
| `invoice-eligibility.ts`: bỏ `dacoc` khỏi tập trạng thái (thay bằng `dachot` trùng, vẫn compile) | ĐỎ 1 (lỗ 4) | xanh — sống |
| `invoices.service.ts`: lấy `nextval` TRƯỚC khi xét blocker | ĐỎ 6 (thêm ca 0 dòng của lỗ 5) | ĐỎ 4 |

Không đột biến: lỗ 3 (mutant `row.total` bigint đã bị ca dev giết, mutant f), lỗ 6 (năm UTC+7: không qua được ranh giới năm khi `issuedAt` = giờ thật ⇒ mutant UTC sẽ là tương đương, biên năm đã đo ở domain), lỗ 7 (ca dương / chạm `OrdersService` dùng chung).

## Test theo file (phần mới)

### API / E2E — `backend/test/invoices.e2e.spec.ts` (27 → 38 ca)
- [x] overview lists the created invoice with the very body POST returned; number year = UTC+7 year of issuedAt
- [x] approved discount frozen on the version ⇒ copied; total = subtotal − discount + VAT
- [x] order without VAT ⇒ applyVat false, vatAmount 0, total = subtotal
- [x] order above INT4 (2 × 1.500.000.000) ⇒ 200, exact JSON numbers in POST and overview
- [x] confirmed order already moved on (dacoc / thicong / nghiemthu / danggiao / dagiao) ⇒ overview creatable, POST 200
- [x] owner (not assignee) with view_own ⇒ overview 200, POST 200
- [x] POST on an unknown order with view_all ⇒ 404, nothing locked or written
- [x] (sửa ca cũ) confirmed order without lines ⇒ thêm 0 `nextval`, 0 audit

## Mức phủ

- Endpoint: `GET/POST /orders/:id/invoices`: **2/2** có e2e cho 200 (tạo + gửi lại) / 400 (UUID, 0 dòng) / 401 / 403 (thiếu `invoices.manage`; thiếu cả `view_all` lẫn `view_own`) / 404 (ngoài phạm vi, đơn lạ) / 409 (trạng thái ×3, đơn vừa đổi bản).
- Biến thể tiền qua HTTP: có VAT · không VAT · chiết khấu · > INT4: **4/4**.
- Trạng thái qua HTTP: được tạo 7/7 (`dachot`…`hoanthanh`); bị chặn 3/3 (`baogia`, `choduyet`, `huy`).
- Backend AC-1 → AC-10: **10/10** có test (domain + unit + e2e + lane DB + guard).
- UI AC-11: web + mobile + parity guard **3/3**. Mọi ca hành vi đều có ở cả hai nền tảng nên không thêm ca.

## Kết quả chạy

- `cd backend && npx jest test/invoices.e2e.spec.ts` → 38/38 · `npx jest` → 113 suite / 2328 test · `prettier --check` + `eslint` sạch trên `invoices.e2e.spec.ts`
- Web, mobile, design-system: KHÔNG chạy lại (không đụng file nào; dev đã chạy xanh).
- Lane DB: KHÔNG chạy lại (không đụng file nào; dev đã chạy xanh 305/305).

## Bước tiếp theo

- Code review story 7.4.

## Câu hỏi tồn đọng

- Không có.
