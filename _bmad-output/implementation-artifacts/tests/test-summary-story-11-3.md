# Test Automation Summary — Story 11.3 (Chuyển BLoC màn đơn hàng và báo giá)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-23 · **Người chạy:** Đại Ca
**Framework:** Flutter `flutter_test` + `bloc_test` (mobile), `node --test` (design-system). Không có API mới vì đây là refactor thuần mobile, backend/web không đổi.
**Kết quả:** mobile **1127/1127** xanh (1116 trước QA + 11 ca mới) · `flutter analyze` sạch · design-system **510/510** xanh.

## Phạm vi

Dev đã phủ AC 7–16: 5 file `bloc_test` (172 ca), 19 ca tháo màn, 12 ca wiring, cùng sweep 151 mutant cubit và 31 mutant màn. QA không viết thêm ca cubit (sweep của dev đã giết 142/151, 9 còn lại là mutant tương đương có lý do). QA tập trung vào **dây nối màn → cubit**: chạy sweep **31 mutant mới** ở 5 file màn, mỗi mutant gỡ hoặc đổi đúng một lời gọi `_cubit.x(...)`, rồi chạy lane hẹp (`test/screens/orders` + `order_routes_test` + `signed_in_app_test` + wiring + tháo màn). Vòng 1: **20 ĐỎ, 11 sống**.

## Gap phát hiện & auto-apply (+11 ca, cùng file `mobile/test/screens/order_screens_cubit_wiring_test.dart`)

| # | AC | Mutant sống | Vì sao là gap | Ca mới |
|---|----|-------------|---------------|--------|
| 1 | 2 | D6 `_cubit.reloadAfterReturn()` → `_cubit.load(showSkeleton: false)` | Quay về từ màn con phải đọc lại **cả** stock-out và tab Ảnh (nếu đã mở). `order_routes_test` chỉ đo `get` | Chi tiết: quay về ⇒ `get`/`getStockIssue`/`listAttachments` đều 2 lần |
| 2 | 4 | D4b huỷ đơn xong ⇒ `load(showSkeleton: false)` | Story §1: huỷ xong tải lại **có** skeleton, khác với lúc quay về. Không ca nào đo skeleton | Chi tiết: giữ `get` ⇒ `AppSkeleton` hiện, có kiểm luôn lý do gửi đi |
| 3 | 4 | D2 nút "Thử lại" ở màn 404 → `() {}` | Ca 404 cũ chỉ kiểm chữ, không bấm | Chi tiết: bấm Thử lại ⇒ `get` lần 2 |
| 4 | 4 | S3 bỏ `_dangGui ? null :` ở `onTap` bước | Đang gửi mà chạm bước khác vẫn đổi lựa chọn và xoá lỗi | Chuyển trạng thái: giữ `transition`, chạm "Đang giao" ⇒ lựa chọn vẫn là "Đang thi công" |
| 5 | 4 | A1 "Thử lại" duyệt chiết khấu → `() {}` | Ca cũ không có nhánh lỗi tải danh sách | Duyệt CK: lỗi ⇒ Thử lại ⇒ 2 `listPendingDiscounts`, dòng hiện |
| 6 | 4 | A2 bỏ `_cubit.clearReasonError()` | Lỗi "Lý do là bắt buộc…" còn lại sau khi đã gõ lý do và mở dialog | Duyệt CK: lỗi biến mất khi dialog mở, 0 request resolve |
| 7 | 4 | A3 bỏ `_reasonCtl.clear()` khi chạm dòng | Chạm lại một dòng phải xoá ô lý do | Duyệt CK: gõ lý do, chạm lại dòng ⇒ ô rỗng |
| 8 | 3 | Q2 `applyDiscount(note: '')` | Ca 4.7 cũ chỉ kiểm `amount` | Báo giá: dialog gửi đúng `(500000, 'Khách quen')` |
| 9 | 4 | Q3 `scopeDelivery: !checked` | Ca cờ phạm vi cũ chỉ bấm "Thi công" | Báo giá: bấm "Vận chuyển" ⇒ gửi giá trị đã đảo và chỉ cờ đó |
| 10 | 3 | Q8 `onUnitPriceChange` → `{}` | Chưa ca nào gõ đơn giá trên dòng giỏ có thể sửa giá | Báo giá: dòng tự do, gõ 1500 ⇒ `updateLine(lineId, unitPrice: 1500)` |
| 11 | 4 | Q11 `onRetry: _cubit.refresh` → `() {}` | Text-guard `orders.test.mjs` canh **chữ**, nhưng không ca widget nào bấm | Báo giá: đổi cờ bị từ chối ⇒ Thử lại ⇒ `get` đầu tiên, banner biến mất |

**Không thêm (đã phủ, tránh padding):** đóng sớm, vé, carry-over của 5 cubit (sweep của dev); `reloadSignal`, pager, `_openThenReload` của danh sách; "Thử lại" ở lỗi tải chi tiết, lỗi ảnh, lỗi lifecycle, lỗi preview xuất kho (20 mutant còn lại ĐỎ ngay ở vòng 1).

## Bảng đột biến (phía màn, 31 mutant)

Cách làm: `cp` backup ra scratchpad, sửa, chạy lane hẹp, rồi `cp` trả và kiểm `assert` nội dung bằng nguyên bản (không dùng `git checkout`). Sau cùng `cmp` cả 5 file màn với backup: giống hệt.

| Mutant | Vòng 1 | Sau QA |
|---|---|---|
| L1 Thử lại danh sách · L2 `setFilter(option[1])` | ĐỎ · ĐỎ | — |
| D1 Thử lại lỗi chi tiết · D3 Thử lại ảnh · D4 bỏ tải lại sau huỷ · D5 bỏ `loadStockIssue` sau xuất kho · D7 bỏ gate quyền stock-out · D8 bỏ xoá ảnh · D9 `openPhotos` → `loadPhotos` | ĐỎ ×7 | — |
| D2 · D4b · D6 | XANH ×3 | **ĐỎ ×3** |
| S1 Thử lại lifecycle · S2 Thử lại preview | ĐỎ ×2 | — |
| S3 | XANH | **ĐỎ** |
| A1 · A2 · A3 | XANH ×3 | **ĐỎ ×3** |
| Q1 Mở lại · Q3b sai cờ · Q4 VAT cố định · Q5 hiệu lực · Q6 bảo hành null · Q7 nút Thêm · Q9 xoá dòng · Q10 SL · Q12 bỏ `shareImpl` | ĐỎ ×9 | — |
| Q2 · Q3 · Q8 · Q11 | XANH ×4 | **ĐỎ ×4** |
| **Tổng** | **20/31 ĐỎ** | **31/31 ĐỎ** |

## Test theo file

- [x] `mobile/test/screens/order_screens_cubit_wiring_test.dart`: +11 ca (chi tiết 3, chuyển trạng thái 1 trong group mới, duyệt chiết khấu 3 trong group mới, tạo báo giá 4); header cập nhật. Không đụng helper hay fake dùng chung.

## Coverage theo AC

| AC | Trạng thái |
|---|---|
| 1 mỗi route một cubit | ✅ dev |
| 2 điều hướng 10.8 / đọc lại im lặng | ✅ + gap 1 |
| 3 tổng tiền từ preview, body thưa | ✅ + gap 8, 10 |
| 4 hành vi giữ nguyên, 143 ca cũ không đổi | ✅ + gap 2–7, 9, 11 |
| 5, 10 guard port | ✅ dev (12 mutant) |
| 6, 9 text-guard | ✅ dev (19 mutant) |
| 7, 11–15 `bloc_test` | ✅ dev (142/151 ĐỎ, 9 tương đương) |
| 16 tháo màn | ✅ dev (19 ca) |
| 17 test cũ không đụng | ✅ `git diff --stat 78c093e -- mobile/test/screens/orders mobile/test/app mobile/test/screens/customers` rỗng |

UI: 5/5 màn có ca widget + `bloc_test` + ca wiring. Dây nối màn → cubit: 31/31 mutant bị bắt. API: không áp dụng.

## Kết quả chạy

- `cd mobile && ~/fvm/default/bin/flutter analyze` → No issues found
- `~/fvm/default/bin/flutter test` → **1127/1127** xanh
- `cd design-system && npm test` → **510/510** xanh
- Không có backup nào trong repo (backup nằm ở scratchpad). File màn không đổi so với lúc dev bàn giao.

## Bước tiếp theo

- Code review 11.3 (`bmad-code-review`).
- Smoke emulator thuộc 11.4 (§6.17), **chưa chạy**.
- Hành vi đáng ngờ dev đã ghi (`setSheetState` khi sheet gói đã đóng, `searchProducts` không vé, `removePhoto` không kiểm giữa hai lời gọi): QA không đổi, cần Đại Ca quyết có ghi TD hay không.
