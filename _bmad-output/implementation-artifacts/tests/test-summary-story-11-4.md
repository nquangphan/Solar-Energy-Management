# Test Automation Summary — Story 11.4 (Chuyển BLoC màn thanh toán, kho, hợp đồng, hoá đơn và khoá guard)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-23 · **Người chạy:** Đại Ca
**Framework:** Flutter `flutter_test` + `bloc_test` (mobile), `node --test` (design-system). Không có API mới: refactor thuần mobile, backend/web không đổi.
**Kết quả:** mobile **1327/1327** xanh (1324 dev bàn giao + 3 ca mới) · `flutter analyze` sạch · design-system **510/510** xanh.

## Phạm vi

Dev đã phủ AC 9–17: 6 file `bloc_test` (155 ca), 24 ca tháo màn, 12 ca wiring, guard port (14 mutant) + text-guard (26 mutant), sweep 339 mutant (326 ĐỎ, 13 tương đương). QA không viết thêm ca cubit. QA chạy **sweep độc lập phía màn**: 45 mutant ở 6 file màn, mỗi mutant gỡ/đổi đúng một dây nối màn → cubit (nút, `onRetry`, getter render, đối số gửi đi, cờ khoá nút khi đang gửi, `retarget`, listener `reloadSignal`, sheet phiếu kho). Lane hẹp: `test/screens/{payments,inventory,contracts,invoices}` + wiring + tháo màn + `test/app` (433 ca, ~8 s/mutant).

Vòng 1: **40 ĐỎ, 4 sống**, 1 bỏ qua (neo P4 trùng chuỗi với P3 — sửa neo rồi chạy lại ⇒ ĐỎ).

## Gap phát hiện & auto-apply (+3 ca, `mobile/test/screens/money_stock_screens_cubit_wiring_test.dart`, group "Lịch thanh toán")

| # | AC | Mutant sống | Vì sao là gap | Ca mới |
|---|----|-------------|---------------|--------|
| 1 | 2, 3 | P6 bỏ `_recording ? null :` ở nút **Huỷ** form ghi nhận | Huỷ khi đang ghi ⇒ `recordFor = null`, form mất trong khi request đang bay; khoá idempotency bị bỏ ⇒ mở lại đợt sinh khoá mới (rủi ro ghi 2 lần, NFR-1). Không ca nào bấm/kiểm Huỷ lúc đang ghi | "while a payment is recorded, Huỷ and every installment's Ghi nhận are disabled" (giữ `recordPayment`) |
| 2 | 2 | P15 bỏ `_recording ? null :` ở nút **Ghi nhận** từng đợt | Đang ghi mà mở đợt khác ⇒ đổi khoá + form giữa chừng | Cùng ca #1 (mọi nút "Ghi nhận" ngoài dialog đều tắt) |
| 3 | 3 | P8 bỏ `_saving ? null :` ở nút **Huỷ** sửa lịch | Huỷ khi đang lưu ⇒ thoát form, lỗi trả về sau không có chỗ hiện | "while the schedule is saved, Huỷ is disabled" (giữ `replaceSchedule`) |
| 4 | 2 | P14 `paidOn: _recordDate.text` → `_todayIso()` | Ô Ngày thu mặc định là hôm nay ⇒ mọi ca cũ không phân biệt được; gõ ngày khác vẫn gửi hôm nay | "the Ngày thu typed is the date sent" (gõ `2026-10-01` ⇒ `paidOn == '2026-10-01'`) |

**Không thêm (đã phủ, tránh padding):** đóng sớm, vé, carry-over, khoá idempotency retry của 6 cubit (sweep dev); 40 mutant còn lại ĐỎ ngay vòng 1.

## Bảng đột biến (phía màn, 45 mutant)

Cách làm: `cp` backup ra scratchpad, sửa, chạy lane hẹp, `cp` trả + `filecmp` nội dung bằng nguyên bản sau mỗi mutant (không dùng `git checkout`). Không có mutant không compile.

| Màn | Mutant | Vòng 1 | Sau QA |
|---|---|---|---|
| Thanh toán | P1 bỏ `load` initState · P2 Thử lại · P3 Tải lại (xung đột ghi nhận) · P5 Huỷ ghi nhận no-op · P7 Lưu lịch bật khi lưu · P9 bỏ `startEdit` · P10 bỏ kết quả `openRecord` · P11 bỏ `onOrderStatusChanged` · P12 note rỗng · P13 method cố định · P16 nút xác nhận bật khi ghi · P17–P20 getter outcome/recordFieldErrors/recordConflict/conflict | ĐỎ ×15 | — |
| Thanh toán | P4 Tải lại (xung đột lịch) | bỏ qua (neo trùng) | **ĐỎ** |
| Thanh toán | P6 · P8 · P14 · P15 | XANH ×4 | **ĐỎ ×4** |
| Tồn kho | I1 Thử lại · I2 bỏ `addListener` initState · I3 bỏ `removeListener` dispose | ĐỎ ×3 | — |
| Phiếu kho | S1 chạm phiếu · S2 link phiếu nhập trả · S3 Thử lại danh sách · S4 `fromReturn: false` · S5/S6 không mở phiếu vừa tạo (trả hàng/tạo) · S7 sai phiếu gốc · S8 bỏ ghi chú trả hàng | ĐỎ ×8 | — |
| Hợp đồng | C1 Thử lại · C2 Tải PDF sai id · C3 Tải PDF bật khi bận · C4 getter error | ĐỎ ×4 | — |
| Hoá đơn | V1 Thử lại · V2 `onConfirm` no-op · V3 getter busy · V4 getter error | ĐỎ ×4 | — |
| Chi tiết HĐ | D1 Thử lại · D2 bỏ `retarget` · D3 bỏ so `invoiceId` · D4 Xuất PDF bật khi bận · D5 getter error · D6 bỏ `shareImpl` | ĐỎ ×6 | — |
| **Tổng** | | **40/45 ĐỎ** (+1 bỏ qua) | **45/45 ĐỎ** |

## Test theo file

- [x] `mobile/test/screens/money_stock_screens_cubit_wiring_test.dart`: +3 ca + helper cục bộ `allDisabledOutsideDialog` trong group. Không đụng fake/recording port dùng chung, không sửa file test cũ (AC 17 giữ nguyên).

## Coverage theo AC

| AC | Trạng thái |
|---|---|
| 1 mỗi route một cubit, `reloadSignal` | ✅ dev (I2/I3 ĐỎ) |
| 2 khoá idempotency, `amount` trống, luật `!= 'paid'` | ✅ dev + gap 1, 2, 4 |
| 3 phiếu xuất / PDF / 139 ca cũ không đổi | ✅ dev + gap 3 |
| 4, 10 guard port allowlist rỗng | ✅ dev (14 mutant) |
| 5, 9 text-guard | ✅ dev (26 mutant) |
| 6, 11–14 `bloc_test` | ✅ dev (326/339 ĐỎ, 13 tương đương) |
| 7 smoke emulator | ✅ dev đã chạy (Dev Agent Record) — QA không chạy lại |
| 15 tháo màn | ✅ dev (24 ca) |
| 16 danh sách StatefulWidget | ✅ dev |
| 17 test cũ không đụng | ✅ QA chỉ sửa file test mới của story |

UI: 6/6 màn có ca widget + `bloc_test` + ca wiring. Dây nối màn → cubit: 45/45 mutant bị bắt. API: không áp dụng.

## Kết quả chạy

- `cd mobile && ~/fvm/default/bin/flutter analyze` → No issues found
- `~/fvm/default/bin/flutter test` → **1327/1327** xanh
- `cd design-system && npm test` → **510/510** xanh
- Không có backup trong repo (backup ở scratchpad). File màn/cubit không đổi so với lúc dev bàn giao.

## Bước tiếp theo

- Code review 11.4 (`bmad-code-review`).
- Ghi nhận chưa rõ từ smoke của dev: emulator `kidy_cam_fix` (emulator-5556, dự án khác) cũng tắt sau khi dọn — Đại Ca kiểm.
