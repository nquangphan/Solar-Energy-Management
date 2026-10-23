# Test Automation Summary — Story 11.2 (Chuyển BLoC màn khách hàng, bảo hành, hồ sơ)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-23 · **Người chạy:** Đại Ca
**Framework:** Flutter `flutter_test` + `bloc_test` (mobile), `node --test` (design-system). Không API mới (refactor thuần mobile — backend/web không đổi).
**Kết quả:** mobile **910/910** xanh (901 trước QA + 9 ca mới) · `flutter analyze` sạch · design-system **510/510** xanh.

## Phạm vi

Dev đã phủ AC 10–15 bằng 5 file `bloc_test` + file ca tháo màn (14 ca) + bảng đột biến AC 7–9. QA soát lại từng ca so với AC và hành vi cũ ở `21302e1`, tìm chỗ **mutant sống sót**: cubit test chưa kiểm một giá trị đi ra port, hoặc dây nối màn → cubit không có ca widget nào canh.

## Gap phát hiện & auto-apply (+9 ca mới, 1 fixture siết)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | 11 | SĐT truyền vào `port.get` không được kiểm | `get(_sdt.trim())` vẫn xanh; fixture `'0903 176 968'` không có khoảng trắng đầu/cuối ⇒ lần đầu mutant **tương đương** | `customer_detail_cubit_test`: fixture `' 0903 176 968 '` + `expect(ok.gets, …)`; `RecordingCustomersPort.gets` |
| 2 | 10 / D1 | Khi tải lại, loading/error phải giữ `items/total/pageSize` cũ — chưa có ca | emit loading với `items: const []` vẫn xanh | `customer_list_cubit_test` +1 ca |
| 3 | 12 | `name` gửi thô — chưa kiểm | `name.trim()` vẫn xanh | `customer_pick_cubit_test`: tên có khoảng trắng + `expect(body.name, …)`, thêm `sourceNote` |
| 4 | 12 | Tra không thấy (`found:false`) ⇒ `result` — chỉ có ca tìm thấy | `result: found.found ? found : null` vẫn xanh | +1 `blocTest` (`lookupResult` thay được trong helper) |
| 5 | 12 / D3 | `loadSources` trả lời **sau** lần tra/mở form phải giữ `result/creating` | `initState` gọi `loadSources` song song với thao tác người dùng; bỏ `result: state.result` vẫn xanh | +1 ca |
| 6 | 14 | Thứ tự kiểm validate (hiện tại → chính sách → xác nhận) | mỗi ca cũ chỉ phạm một luật ⇒ đổi thứ tự vẫn xanh | `profile_cubit_test` +1 `blocTest` phạm nhiều luật |
| 7 | 13 / D4 | "Không vé — câu trả lời về sau thắng" (giữ y hành vi cũ) | thêm vé/chặn lặng lẽ đổi hành vi, không ca nào canh | `warranty_lookup_cubit_test` +1 ca (port trả theo thứ tự tuỳ ý) |
| 8 | 1 / 2 | Ô tìm kiếm danh sách → `cubit.search(_q.text)` | chưa ca widget nào gõ vào ô tìm | **mới** `test/screens/menu_screens_cubit_wiring_test.dart` |
| 9 | 1 | "Thử lại" ở danh sách khách gọi lại `load` | ca cũ chỉ kiểm nút **hiện** | như trên |
| 10 | 1 / 2 | "Huỷ" ở form tạo khách → `cancelCreate`, không gửi gì | không ca nào bấm Huỷ ở màn pick | như trên |
| 11 | 1 | "Thử lại" ở bảo hành gửi lại SĐT đã gõ, thô | ca cũ chỉ kiểm nút hiện | như trên |

**Không thêm (đã phủ — tránh padding):** đóng sớm ok/lỗi cả 5 cubit (dev, có mutant `isClosed` trong `catch`); vé sai thứ tự danh sách (dev, fixture 2 trang khác nhau); `onAdd` → danh sách tải lại (`signed_in_app_test` "+ Thêm khách … re-read and shows the new customer"); Thử lại ở chi tiết (ca cũ "a failed detail load offers a retry that actually reloads"); `fieldErrors.phone` dưới ô SĐT (ca widget cũ + `signed_in_app_test`).

## Bảng đột biến kiểm chứng ca mới

`cp` backup → sửa → chạy file test → `cp` trả + `cmp` (không `git checkout`). Mỗi chuỗi chèn đã `grep` lại.

| Mutant | File | Test | Kết quả |
|---|---|---|---|
| M1 `_port.get(_sdt.trim())` | customer_detail_cubit | detail cubit | lần 1 **XANH** (mutant tương đương với fixture) ⇒ siết fixture ⇒ ĐỎ `+7 -1` |
| M2 loading `items: const []` | customer_list_cubit | list cubit | ĐỎ `+14 -1` |
| M3 `name: name.trim()` | customer_pick_cubit | pick cubit | ĐỎ `+20 -1` |
| M4 `result: found.found ? found : null` | customer_pick_cubit | pick cubit | ĐỎ `+20 -1` |
| M5 bỏ `result: state.result` ở `loadSources` | customer_pick_cubit | pick cubit | ĐỎ `+20 -1` |
| M6 regex chỉ kiểm khi `password == confirm` | profile_cubit | profile cubit | ĐỎ `+9 -1` |
| M7 bỏ qua trả lời khi đã `Ready` (vé giả) | warranty_lookup_cubit | warranty cubit | ĐỎ `+7 -1` |
| M8 `cubit.search('')` | customer_list_screen | wiring | ĐỎ `+3 -1` |
| M9 `onRetry: () {}` | customer_list_screen | wiring | ĐỎ `+3 -1` |
| M10 Huỷ → `_cubit.startCreate` | customer_pick_screen | wiring | ĐỎ `+3 -1` |
| M11 `onRetry: () {}` | warranty_lookup_screen | wiring | ĐỎ `+3 -1` |

## Test theo file

- [x] `mobile/test/screens/customers/recording_customers_port.dart` — thêm `gets`, `lookupResult` thay được
- [x] `mobile/test/screens/customers/customer_detail_cubit_test.dart` — SĐT thô tới `get`
- [x] `mobile/test/screens/customers/customer_list_cubit_test.dart` — tải lại giữ dòng qua loading + error
- [x] `mobile/test/screens/customers/customer_pick_cubit_test.dart` — tên thô, tra không thấy, nguồn về muộn giữ trạng thái
- [x] `mobile/test/screens/account/profile_cubit_test.dart` — thứ tự validate
- [x] `mobile/test/screens/warranty/warranty_lookup_cubit_test.dart` — không vé, trả lời sau cùng thắng
- [x] **mới** `mobile/test/screens/menu_screens_cubit_wiring_test.dart` — 4 ca widget dây nối màn → cubit

## Coverage theo AC

| AC | Trạng thái |
|---|---|
| 1 màn chỉ render + gửi sự kiện | ✅ + 4 ca dây nối (gap 8–11) |
| 2 pick/hồ sơ giữ hành vi | ✅ (ca cũ + gap 5, 10) |
| 3, 9 guard port | ✅ dev (mutant 9a–9i) |
| 4, 7, 8 text-guard | ✅ dev (mutant 7a–8h) |
| 5 widget cũ xanh + `bloc_test` mỗi cubit | ✅ |
| 6 lane mobile + design-system, analyze | ✅ 910 / 510, sạch |
| 10–14 cubit | ✅ + gap 1–7 |
| 15 tháo màn | ✅ dev (14 ca) |
| 16 test cũ không đụng | ✅ `git diff --stat 21302e1 -- mobile/test/screens/{customers,warranty,account,orders} mobile/test/app` rỗng (chỉ file mới/helper mới của story) |

UI features (5 màn): 5/5 có ca widget + `bloc_test`. API: không áp dụng.

## Kết quả chạy

- `cd mobile && ~/fvm/default/bin/flutter analyze` → No issues found
- `~/fvm/default/bin/flutter test` → **910/910** xanh
- `cd design-system && npm test` → **510/510** xanh
- Không còn file backup trong repo (backup ở scratchpad, đã xoá)

## Bước tiếp theo

- Code review story 11.2 (`/ck:code-review`).
- Smoke emulator thuộc 11.4 (§6.17) — chưa chạy.

## Câu hỏi tồn đọng

Không có.
