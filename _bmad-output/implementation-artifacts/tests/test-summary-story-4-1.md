# Test Automation Summary — Story 4.1 (Tạo Đơn + giỏ hàng Order/OrderVersion/OrderLineItem)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend hermetic) · `node --test` (design-system guard) · `flutter test` (widget)
**Kết quả:** backend orders 2 suite / **47 test** xanh · mobile orders **8 test** xanh · prettier + dart format + analyze sạch

## Phạm vi

Story 4.1 dev xong với coverage dày sẵn (unit 19 + e2e 21 + DB-lane 5 + guard 12 + widget 7 sau khi vá).
Giống lần chạy Story 3.5: việc của workflow là **gap analysis** — đối chiếu từng AC với code path
thực tế đang được exercise, vá lỗ trong test đã viết. Không cần sửa production code — code đúng,
test thiếu.

## Gap phát hiện & auto-apply (6 gap → +7 test)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| G1 | AC-5 | Sửa `unitPrice` trên dòng `priceEditable=true` **thành công** | Mọi lớp chỉ test đường 400 (dòng không-editable); nửa DƯƠNG của "giá sửa được" chưa được chứng minh — mutant chặn-mọi-unitPrice vẫn xanh | ✅ unit (+1): payload ghi giá mới, response trả giá đã lưu, KHÔNG tra lại danh mục |
| G2 | AC-1 | Nhánh pointer null: `get()` ⇒ `lineItems []`; `addLine` ⇒ 409 "Đơn chưa có bản hiệu lực" | Code path dữ-liệu-hỏng có thật (`orders.service.ts:186-193`, `:249-255`), 0 coverage | ✅ unit (+2) |
| G3 | AC-2 | PATCH `note: null` xoá ghi chú | Comment service hứa "`note: null` xoá ghi chú" nhưng không test nào gửi null — hoán `null`/`undefined` là mất chức năng | ✅ unit (+1): `null` đi TỚI Prisma data |
| G4 | AC-2 | PATCH `{"qty": null, "isFlexible": null}` ⇒ 400; `{"note": null}` ⇒ 200 | Invariant chống-`PartialType` của `@IsOptionalNotNull` (lý do DTO viết tay) chỉ chứng minh được qua ValidationPipe thật; refactor sang PartialType sẽ không làm test nào đỏ | ✅ e2e (+1): cả hai nửa chặn/cho-qua |
| G5 | AC-2 | `@MaxLength` name 500 / unit 50 / note 2000 trên add-line | Cùng loại gap Story 3.5 từng tìm: constraint có trong DTO, 0 request chạm | ✅ e2e (+1): 1 request vượt cả 3 trần ⇒ fieldErrors đủ 3 field |
| G6 | AC-2 | Mobile: sửa qty **thành công** ⇒ `amount` mới do fake-backend trả | Widget test chỉ có đường LỖI của updateLine; "sửa số lượng cho mọi dòng" chưa có bằng chứng render số backend sau sửa | ✅ widget (+1): qty 1→5 ⇒ `12250000` (số của port, màn không tự nhân) |

**Không thêm (đã cân nhắc, ghi lại có chủ đích):**
- e2e cho 400-unitPrice-trên-dòng-không-editable: logic sống ở service, unit đã phủ cả addLine
  lẫn updateLine; ValidationPipe không tham gia luật này nên e2e không thêm sự thật mới.
- `removeLine` 404 dòng version cũ: dùng chung `findLineOrThrow` đã test qua updateLine.
- Dedup `Set` trong `toViews`: tối ưu nội bộ, không phải hợp đồng.
- DB lane: 5 case sẵn đủ 3 sự thật DB của story (FK vòng, snapshot sourceId, RESTRICT) — vẫn chờ
  Postgres cục bộ (`npm run test:db` khi có DB), không phải gap của lần chạy này.

## Test theo file

### Unit — `backend/test/orders.service.spec.ts` (15 → 19)
- [x] **MỚI** get() pointer null ⇒ lineItems rỗng, không truy vấn dòng
- [x] **MỚI** addLine pointer null ⇒ 409, DB không bị ghi
- [x] **MỚI** sửa unitPrice dòng editable thành công — payload + response + không tra danh mục
- [x] **MỚI** `note: null` xoá ghi chú — null tới Prisma, khác undefined
- [x] (cũ) tạo đơn transaction 3 op / snapshot sourceId / guard status / event sau commit / giá sống FR-5 / chống leak costPrice

### E2E — `backend/test/orders.e2e.spec.ts` (19 → 21)
- [x] **MỚI** PATCH null-trên-cột-NOT-NULL ⇒ 400 đủ fieldErrors; note null ⇒ 200 (hai nửa của `@IsOptionalNotNull`)
- [x] **MỚI** vượt trần độ dài name/unit/note ⇒ 400 fieldErrors đủ 3 field
- [x] (cũ) 401/403 fail-closed 5 route / happy path / TD-21 trim / envelope AD-5 / 409 đã chốt

### Widget — `mobile/test/screens/orders/create_quote_screen_test.dart` (7 → 8)
- [x] **MỚI** sửa qty thành công ⇒ amount mới là số fake-backend trả (`12250000`), không rơi nhánh lỗi
- [x] (cũ) render / thêm catalog / không input giá khi priceEditable=false / dòng tự do / gói vật tư / swipe xoá / lỗi nguyên văn

### Không đổi
- `backend/test/orders.db.integration.spec.ts` (5 case, chờ Postgres) · `design-system/screens/orders.test.mjs` (12 guard)

## Coverage

- Backend endpoint: **5/5** route orders phủ 401/403/happy/error envelope; mọi nhánh `AppException`
  trong `orders.service.ts` giờ có ít nhất 1 test trực tiếp (trước thiếu 2 nhánh pointer-null).
- Validation DTO: đủ cả 3 lớp luật — bắt buộc theo dạng dòng (`@ValidateIf`), null-trên-NOT-NULL
  (`@IsOptionalNotNull`), trần độ dài (`@MaxLength`).
- UI mobile: 8/8 hành vi AC-2..AC-5 có widget test (thêm nửa dương của sửa-dòng).

## Xác minh

```
cd backend && npx jest test/orders.service.spec.ts test/orders.e2e.spec.ts  # 47/47 xanh
cd mobile  && flutter test test/screens/orders/create_quote_screen_test.dart # 8/8 xanh
prettier --check ✓ · dart format -o none ✓ · flutter analyze ✓
```

## Next Steps

- Chạy `npm run test:db` khi Postgres cục bộ lên (nợ môi trường từ phiên dev, không phải nợ test).
- CI 4 lane (C-3) tự chạy các suite này trên push.
