# Test Automation Summary — Story 4.7 (Áp chiết khấu + duyệt chiết khấu)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic, mock Prisma — không cần Postgres)
**Kết quả:** backend **905/905** xanh (54 suite, 901 → 905, +4 test mới) · mobile/design-system không đụng file → giữ kết quả dev phase (189 + analyze sạch · 289 xanh)

## Phạm vi

Story đã có bộ test dev-phase rất dày (24 unit + 6 e2e + 10 widget + guard file mới 13 test,
negative assert đã mutation-check 2 nhánh ở dev phase). QA phase rà gap coverage theo 8 AC,
phát hiện **4 gap** — tất cả backend unit — và auto-apply toàn bộ.

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | #2 | Từ chối THẮNG cổng approval nhưng đơn KHÔNG ở `choduyet` (bất biến gãy, `gate.count !== 1`) ⇒ lỗi nổi lên → rollback TOÀN tx, KHÔNG event | Nhánh phòng thủ orders.service.ts (throw trong nhánh reject) chưa test nào chạm — gỡ throw là approval bị resolve trong khi đơn kẹt `choduyet` mà suite vẫn xanh | ✅ `orders.service.spec.ts` (**mutation-checked**: Mutant A `if (false)` nuốt bất biến → RED → revert `cp`) |
| 2 | #2 | Retry TỪ CHỐI trên approval đã `tu_choi` KHÔNG kèm reason ⇒ 200 idempotent (check idempotency đứng TRƯỚC validate reason) + pin `orderBy createdAt desc` ở CALL ĐẦU (điểm đọc quyết định) | Chỉ retry `dong_y` được test; đảo thứ tự 2 check là retry-reject 400 sai (NFR SM-1 gãy) mà không test nào đỏ; "approval MỚI NHẤT" là hợp đồng thật sau áp-lại nhưng orderBy chưa được pin | ✅ `orders.service.spec.ts` (**mutation-checked ×2**: Mutant B bỏ `orderBy` → RED; Mutant C hoán vị reason-check lên trước idempotency, tsc sạch → RED → revert `cp`, `cmp` byte-identical) |
| 3 | #1 | Áp LẠI sau từ chối: approval `tu_choi` cũ KHÔNG chặn — cổng chỉ nhìn `Order.status`, tạo approval MỚI `cho_duyet`, view compose bản mới nhất | Dev Notes hứa "user áp lại → approval mới đè vai trò mới nhất" nhưng không test nào dựng đơn `baogia` CÓ approval resolved cũ rồi áp lại | ✅ `orders.service.spec.ts` |
| 4 | #3 | `computeOrderTotals` biên triệt tiêu: `discountAmount == subtotal` ⇒ `vatBase 0`, VAT 0, total 0 | Service cho phép amount == subtotal (đã test tầng service) nhưng totals-level chưa pin kết quả biên — half-up trên vatBase 0 phải ra 0 tròn | ✅ `order-totals.spec.ts` |

**Bài học mutation nảy ra trong phase này:** assert `toHaveBeenCalledWith` cho `findFirst` bị
**false-green** dưới Mutant B vì `viewOf` cũng gọi `findFirst` với orderBy khớp (đúng bài
"mutation hits one layer") — siết thành `toHaveBeenNthCalledWith(1, …)` pin đúng điểm đọc
quyết định của `resolveDiscount` rồi mutant mới lộ.

**Không thêm (đã phủ — tránh padding):** apply happy payload từng op + thứ tự write→publish +
event amount/note (unit), amount == subtotal biên trên tầng service, amount > subtotal 400, 0 dòng
400, double-tap 409, race cổng áp 409 không-idempotent (unit); resolve đồng ý KHÔNG op order /
từ chối CÓ op + resolveNote / thiếu reason 400 ×2 dạng / retry `dong_y` idempotent / ngược 409 /
không approval 409 / race 2 nhánh đọc-lại (unit); confirm-từ-choduyet snapshot `discountAmount`
+ 3 nhánh 409 + race reject-giữa-chừng + đường `baogia` giữ null — regression 4.5 (unit);
margin half-up biên 33.4/33.5 + null tự do/giá 0 + fence `costs.view` 2 chiều KHÔNG query
costPrice + danh sách rỗng (unit); VAT trên vatBase con số phân biệt 720k/800k + vắng-vs-0 +
`khong_vat` afterDiscount (totals); e2e: 401 loop 3 route mới, 403 chéo nghịch đảo proof, vòng
đời ĐỒNG Ý đầy đủ (áp→khoá sửa→list margin theo fence→duyệt→chốt snapshot→preview echo→mở lại
không mang chiết khấu), nhánh TỪ CHỐI + resolveNote + audit, retry duyệt body-y-hệt-GET không
double-audit, 404 đơn ma ×2, ValidationPipe amount 0/float/vắng + preview âm. **Không thêm test
margin âm (costPrice > unitPrice):** spec im lặng về case này — thêm là đoán hành vi, không phải
pin hợp đồng. Route static trước `:id` chứng minh gián tiếp qua e2e list 200. UI: 10 widget test
mobile đủ error case + guard 13 test mutation-checked 2 nhánh (dev phase) — không gap.

## Test theo file

### Unit — `backend/test/orders.service.spec.ts` (+3)
- [x] từ chối thắng cổng approval nhưng đơn KHÔNG ở choduyet (bất biến gãy) ⇒ lỗi nổi lên, rollback TOÀN tx, KHÔNG event (mutation-checked)
- [x] retry TỪ CHỐI trên approval đã tu_choi KHÔNG kèm reason ⇒ idempotent view, đọc approval MỚI NHẤT (nth-call pin orderBy), KHÔNG tx/event (mutation-checked ×2)
- [x] áp LẠI sau từ chối: approval tu_choi cũ không chặn — approval MỚI pending, view compose bản mới nhất

### Unit — `backend/test/order-totals.spec.ts` (+1)
- [x] discountAmount ĐÚNG BẰNG subtotal ⇒ vatBase 0, VAT 0, total 0 (biên triệt tiêu)

## Coverage sau QA

- AC #1 áp chiết khấu (tx + cổng + validate + 403/404/409): **đủ** (thêm áp-lại-sau-từ-chối)
- AC #2 duyệt/từ chối (cổng trên row approval + idempotency + reason): **đủ** (thêm bất-biến-gãy rollback, retry-reject không reason, pin orderBy desc)
- AC #3 chốt sau duyệt + pipeline tiền (vatBase/snapshot/preview echo): **đủ** (thêm biên triệt tiêu totals)
- AC #4 danh sách chờ duyệt + biên ước tính + fence `costs.view`: **đủ** (dev phase — 2 chiều có e2e)
- AC #5/#6 UI 2 nền tảng: **đủ** (10 widget test mobile gồm error case; web không runtime — text-guard là lớp duy nhất, TD-1 đã biết)
- AC #7 guards + parity + OpenAPI: **đủ** (dev phase, mutation-checked)
- AC #8 phạm vi để lại (Epic 9/5.1/…): **N/A** — không code, không test

## Lane

- `cd backend && npm test`: **905/905**, 54 suite. Lần đầu 1 đỏ `error-envelope.spec.ts` —
  chạy riêng 12/12 xanh, rerun full xanh ⇒ **flake mới ghi nhận** (cộng vào danh sách flake đã
  biết: customer-sources / customers / me.e2e).
- Mobile/design-system: QA phase không đổi file nào ngoài backend test — kết quả dev phase còn
  hiệu lực (mobile 189 + analyze sạch · design-system 289).
- DB lane: `docker info` fail (Docker Desktop không lên từ shell agent — bài học 4.4–4.6).
  Spec `discount-approvals.db.integration.spec.ts` viết sẵn từ dev phase, **CHƯA chạy**.
  Đại Ca bật Docker Desktop rồi `cd backend && npm run test:db`.

## Unresolved

- DB lane story 4.7 chưa chạy (Docker down) — cổng atomic race trên Postgres thật + FK P2003 + snapshot discountAmount chờ xác nhận.
- Action item 4.4 còn treo: các migration (giờ gồm `20260717020000_add_discount_approvals`) chưa `migrate deploy` thật.
