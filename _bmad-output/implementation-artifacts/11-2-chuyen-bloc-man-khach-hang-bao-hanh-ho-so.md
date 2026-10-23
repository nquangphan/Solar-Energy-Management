---
baseline_commit: 21302e1
---

# Story 11.2: Chuyển BLoC màn khách hàng, bảo hành, hồ sơ

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a nhân viên hiện trường,
I want màn khách hàng, tra cứu bảo hành và hồ sơ chạy bằng Cubit mà vẫn y như cũ,
so that phần Menu của app theo một khuôn duy nhất trước khi Epic 8 thêm màn.

[Refactor thuần mobile theo khuôn 11.1. **Không đổi hành vi người dùng thấy**: chữ, bố cục, điều hướng, thứ tự và số lượng request giữ nguyên. Backend/web không đổi.]

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Đọc trước (theo thứ tự): `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` **§6 (20 mặc định, là luật) + §7 (quyết định khi làm 11.1)**; khuôn mẫu 11.1: `mobile/lib/screens/auth/{login_screen,login_cubit,login_state}.dart`, `mobile/test/screens/auth/login_cubit_test.dart`, `mobile/test/app/unmount_while_port_pending_test.dart`; 5 màn: `mobile/lib/screens/customers/{customer_list,customer_detail,customer_pick}_screen.dart`, `mobile/lib/screens/warranty/warranty_lookup_screen.dart`, `mobile/lib/screens/account/profile_screen.dart`; test widget: `mobile/test/screens/customers/customer_screens_test.dart`, `mobile/test/screens/warranty/warranty_lookup_screen_test.dart`, `mobile/test/screens/account/profile_screen_test.dart`, `mobile/test/app/signed_in_app_test.dart:140-280,409-430`; guard: `mobile/test/screens/no_port_call_in_screens_test.dart`, `design-system/lib/read-mobile-screen.mjs`, `design-system/screens/{customers,warranty-lookup,profile}.test.mjs`, `design-system/session/parity.test.mjs:527-565`.

### 1. Hiện trạng (scout 2026-10-23, HEAD `21302e1`)

| Màn | Port gọi (thứ tự) | State trong `State` hôm nay | Ghi chú phải giữ |
|---|---|---|---|
| `CustomerListScreen({key, required CustomersPort port, onOpen, Future<void> Function()? onAdd})` (335 dòng) | `port.list(q, custType, page)` mỗi lần: `initState`, **mỗi phím gõ** (`onChanged`), bấm lọc loại, Trước/Sau, Thử lại, sau khi `onAdd` xong | `_custType` (`'ALL'`/`kCaNhan`/`kThuongMai`), `_items`, `_page`, `_total`, `_pageSize` (mặc định 20), `_LoadState {loading, ready, error}`, `_latest` (vé chống trả lời sai thứ tự) | `q` rỗng ⇒ `null`; `'ALL'` ⇒ `custType: null`; đổi lọc/từ khoá ⇒ `_page = 1`; trả lời có vé cũ ⇒ bỏ (cả nhánh lỗi); rỗng + đang lọc (`q` không rỗng hoặc `custType != ALL`) ⇒ "Không có khách phù hợp", rỗng không lọc ⇒ "Chưa có khách hàng nào" + nút; pager chỉ hiện khi `ready`, có dòng, `totalPages > 1` |
| `CustomerDetailScreen({key, required port, required String sdt, onEdit})` (123) | `port.get(sdt)` **rồi** `port.listSources()` (tuần tự, không song song) | `_customer`, `_sources`, `_LoadState {loading, ready, error}` | eyebrow từ `custType` (khi chưa có khách ⇒ "KHÁCH · CÁ NHÂN"); lỗi ⇒ `AppErrorState('Không tải được danh sách khách hàng.', Thử lại)`; title `customer?.name ?? ''` |
| `CustomerPickScreen({key, required port, onSelect})` (542) | `initState`: `port.listSources()` (`.then/.catchError` — lỗi ⇒ danh sách rỗng, **không** báo lỗi); "Tra cứu" ⇒ `port.lookup(_sdt.text)` thô; "Lưu khách hàng" ⇒ `port.create(CreateCustomerInput(...))` | 7 controller; `_result`, `_error`, `_fieldErrors`, `_creating`, `_custType` (mặc định `kCaNhan`), `_sourceId` (`''`), `_sources` | Lỗi: `CustomerPortException` ⇒ `message` + `fieldErrors` nguyên văn; lỗi khác ⇒ `'Không thực hiện được. Thử lại.'` + map rỗng. Tra cứu: xoá lỗi + `_creating=false` trước khi gửi; lỗi ⇒ `_result=null`. Tạo: xoá lỗi trước khi gửi; thành công ⇒ `widget.onSelect?.call(created)`. Body tạo: `phone: _sdt.text` thô; `nationalId` chỉ khi Cá nhân và không rỗng; `taxCode`/`bankAccount` chỉ khi Thương mại và không rỗng; `address`/`sourceNote` khi không rỗng (**`sourceNote` gửi cả khi nguồn không `isOther`** — giữ); `sourceId: _sourceId` (kể cả `''`). Nút nguồn chỉ liệt kê `active`; "Ghi rõ nguồn" theo cờ `isOther`. **Không có cờ đang-gửi** — bấm hai lần gửi hai request (giữ, §6.11) |
| `WarrantyLookupScreen({key, required WarrantyPort port})` (272) | "Tra cứu"/Thử lại ⇒ `port.lookup(_sdt.text)` thô | `_LoadState {idle, loading, ready, error}`, `_ketQua`, `_loi` | Lỗi `WarrantyPortException` ⇒ `message` nguyên văn, khác ⇒ `'Không tra cứu được bảo hành.'`; **không** vé chống sai thứ tự, **không** chặn bấm khi đang tải (giữ y). `dinhDangNgay()` top-level public, `_conLai`, `_chipTrangThai` là hàm hiển thị |
| `ProfileScreen({key, required PasswordPort port})` (281) | "Cập nhật mật khẩu" ⇒ `port.changePassword(currentPassword: trim, newPassword: thô)` | 3 controller, `_error`, `_done` | Thứ tự: `_done` true ⇒ false trước; validate: hiện tại rỗng (sau trim) ⇒ "Nhập mật khẩu hiện tại."; `_passwordRe` sai ⇒ "Mật khẩu tối thiểu 8 ký tự, có chữ và số."; không khớp ⇒ "Xác nhận mật khẩu không khớp."; lỗi port **bất kỳ** ⇒ câu cố định "Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại." (**không** dùng message adapter — giữ, đây là hành vi cũ); thành công ⇒ xoá 3 ô + xoá lỗi + `_done=true`. "Huỷ" ⇒ xoá 3 ô + xoá lỗi, **không** gọi port, **không** đụng `_done`. Danh tính đọc `PermissionsScope.of(context)` (không gọi `/me`). "Sai mật khẩu hiện tại ⇒ giữ phiên" là việc của transport (`mobile/lib/api/transport.dart:13`, `http_password_port.dart:5`) — cubit chỉ cần **không** gọi đăng xuất/không đụng phiên |

Nơi dựng màn (không sửa): `mobile/lib/app/signed_in_app.dart:120-155` (router truyền `ports.customers|warranty|password`, `onAdd: () => context.push(kCustomerLookupPath)`, `onSelect` pop rồi push chi tiết); **`mobile/lib/screens/orders/create_quote_screen.dart:931`** nhúng `CustomerPickScreen(port: widget.customersPort, onSelect: ...)` làm bước 1 tạo báo giá (màn 11.3, vẫn trong allowlist) ⇒ test `test/screens/orders/create_quote_screen_test.dart` cũng là lưới an toàn của story này.

Top-level dùng chéo màn — **giữ nguyên chỗ, nguyên chữ ký**: ở `customer_pick_screen.dart`: `kMenuTabIndex`, `kCaNhan`, `kThuongMai`, `customerTypeLabel()`, `orDash()`, `class CustomerFacts` (import bởi list/detail/warranty/create_quote) và `class _MicroLabel` (private, `CustomerFacts` dùng; guard slice từ `class CustomerFacts` tới `class _MicroLabel`); ở `warranty_lookup_screen.dart`: `dinhDangNgay()`; ở `profile_screen.dart`: `_menuTabIndex = 4` (guard đòi đúng chữ).

### 2. 🔥 BẪY SỐ 1 — `profile.test.mjs` (g) sẽ ĐỎ OAN vì dòng import cubit

`design-system/screens/profile.test.mjs:183-187` quét `stripComments(mobile)` bằng `/['"][a-z_]+\.[a-z_]+['"]/` (chống literal quyền) **không bỏ dòng import**. Màn sau khi chuyển có `import 'profile_cubit.dart';` ⇒ `'profile_cubit.dart'` khớp ⇒ ĐỎ. Đây đúng lỗi `customers.test.mjs` (g) đã gặp và sửa từ Story 3.4 (bỏ specifier import trước khi quét — có comment giải thích tại `customers.test.mjs:283-289`). **Sửa:** áp đúng một dòng tiền xử lý đó cho profile (g): `code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '')` trước `registryLike.test`, kèm comment một câu (tiếng Anh) chỉ về customers. **Regex quyền giữ nguyên chữ** (không nới). Đột biến bắt buộc: chèn `final String k = 'orders.view_all';` vào `profile_cubit.dart` ⇒ ĐỎ. **Không** né bằng `import './profile_cubit.dart'` hay `package:` import (lách guard). Ghi quyết định vào proposal §8.

### 3. 🔥 BẪY SỐ 2 — text-guard customers ghim HÌNH DẠNG code, không chỉ chuỗi

`customers.test.mjs` đọc `customer_{pick,list,detail}_screen.dart`; sau khi đổi sang `readMobileScreen` (bắt buộc), các assert dưới đây quét **văn bản nối màn + cubit/state của chính màn đó** và **không được nới**:

| Assert | Đòi | Hệ quả thiết kế |
|---|---|---|
| (e.3) `stripDart(mobile.list)` khớp `/port\.list\([\s\S]*?page:\s*_page/` và `/_page = 1/` | lời gọi `list` truyền `page: _page`; có phép gán `_page = 1` | `CustomerListCubit` giữ **field private `int _page`** (+ `_q`, `_custType`) làm tham số truy vấn và gọi `_port.list(..., page: _page)`; về trang 1 bằng `_page = 1;`. State mang bản sao `page` để render |
| (l) `port\.lookup\(`, `port\.create\(`, `port\.listSources\(` (pick); `port\.list\(` (list); `port\.get\(`, `port\.listSources\(` (detail) | tên lời gọi | `_port.lookup(` khớp (chuỗi con `port.lookup(`). Đặt tên field port là `_port` như `LoginCubit` |
| (m) `mobile.pick` khớp `/onPressed: _lookup/`; `onChanged[^\n]{0,120}lookup` **không** có | nút Tra cứu gắn method `_lookup` | State của màn giữ method `_lookup` (không tham số) gọi cubit. ⇒ cubit phải đọc được từ State: tạo cubit trong `initState` làm field (`late final CustomerPickCubit _cubit = CustomerPickCubit(widget.port)..loadSources();`), `BlocProvider.value(value: _cubit, ...)`, `_cubit.close()` trong `dispose()` (xem D3) |
| (n) `/widget\.onSelect\?\.call\(created\)/`, `/onPressed: \(\) => widget\.onSelect\?\.call\(customer\)/` | callback gọi ở màn | `create(...)` trả `Future<Customer?>` (null khi lỗi/đã đóng) ⇒ màn: `final Customer? created = await _cubit.create(...); if (created != null && mounted) widget.onSelect?.call(created);` (khuôn trả giá trị của 11.1 §7.2) |
| (h.2) cấm `RegExp(`, `.replace(`, `+84`, regex literal, `(sdt|phone)….length <>=` | — | Cubit không kiểm/chuẩn hoá SĐT, không `length` trên SĐT |
| (i)/(j)/(k) slice `class CustomerFacts` → `class _MicroLabel` trong `mobile.pick` | `CustomerFacts` + `_MicroLabel` ở màn, đúng thứ tự | Không dời hai class này; `readMobileScreen` đặt file màn **đầu tiên** nên slice vẫn đúng |
| (g) chuỗi `'word.word'` sau khi bỏ import | — | không viết literal kiểu `'a.b'` trong cubit |
| (f) cấm `elevation`, `BoxShadow` | — | — |

`warranty-lookup.test.mjs` (đọc `MOBILE_SCREEN` qua `read` + `stripDart`): đổi sang `readMobileScreen`. Các assert dương (`warrantyStatus`, `con_han|sap_het|het_han`, `formatWarrantyMonths`, `AppTokens.*`) đang thoả **bởi hàm hiển thị ở màn** — giữ `_conLai`/`_chipTrangThai`/`_bangDon`/`dinhDangNgay` ở màn (map state → nhãn/màu là việc render). `parity.test.mjs:527-565` đọc **riêng file màn** (`dinhDangNgay`, `substring(0, 10)`, `remainingMonths >= 1`, `remainingDays > 0`, `Hết hạn hôm nay`) — không sửa guard đó; nếu dời các hàm này sang cubit nó sẽ ĐỎ ⇒ đó là tín hiệu "đừng dời".

`profile.test.mjs` (đọc `MOBILE_DART` bằng `readFileSync`): đổi biến `mobile` sang `readMobileScreen`. Assert dương "labels byte-identical" có cả 4 câu validate/lỗi ⇒ sau khi dời sang cubit chúng nằm ở file cubit, guard thấy nhờ helper. Assert (d) `PermissionsScope\.of\(context\)` + `\.me\b` + cấm `fetchMe(` ⇒ danh tính vẫn đọc ở màn. Assert (d.2) cấm `'Vai trò' | 'SĐT' | 'Đăng nhập gần nhất' | 'Tài khoản'` trong code đã bỏ comment ⇒ đừng viết các chữ đó trong code cubit/state (comment thì được). Assert `obscureText: true` đúng **3** lần ⇒ đừng chép lại ở cubit.

### 4. 🔥 BẪY SỐ 3 — `emit` không lên lịch frame; đếm `pump()` của test cũ là luật

`emit` tới `BlocBuilder` đi qua microtask; `tester.pump()` **không vẽ frame nếu chưa có frame nào được lên lịch** (11.1 §7.4, memory `cubit-emit-no-frame-single-pump`). Test cũ có chỗ chỉ một `pump()`: `warranty_lookup_screen_test.dart` "state loading" (`_tra` rồi **một** `pump()` ⇒ mong skeleton), `profile_screen_test.dart` `_tapLabel` (tap rồi **hai** `pump()`), `customer_screens_test.dart` `_tap` (`pumpAndSettle`). Login 11.1 đi qua với tap thường nên kỳ vọng xanh; **nếu đỏ thì sửa code, không sửa test** (ví dụ cập nhật trạng thái hiển thị đồng bộ trong `State` của màn trước khi gọi cubit, hay lên lịch frame như `ListenableBuilder` ở `PnsApp`) — ghi cách sửa vào proposal §8.

Lưu ý thêm: Equatable + bloc 9 **bỏ qua `emit` trùng state** (`==`). Generated DTO (`Customer`, `CustomerSource`, `WarrantyLookup`…) **không** override `==` (đã kiểm `customer_response_dto.dart`: 0 `operator ==`) ⇒ so theo instance; trong `bloc_test` dùng **cùng instance** từ fake port để `expect` khớp, hoặc dùng matcher (`isA<…>().having(...)`). Không thêm `==` vào file sinh (cấm sửa tay).

### 5. 🔥 BẪY SỐ 4 — đóng sớm: phải phủ CẢ nhánh lỗi

Memory `cubit-close-error-path-untested` (QA 11.1): ca "port trả lời sau `close`" chỉ viết cho nhánh thành công là **đột biến tương đương** — bỏ `if (isClosed) return` trong `try` vẫn xanh vì `StateError` bị chính `catch` nuốt. Mỗi cubit cần **cả hai** ca: thành công-sau-close và lỗi-sau-close; mutant phải nhắm `isClosed` trong `catch`. Thêm ca widget "màn bị tháo khi port còn chờ" theo khuôn `test/app/unmount_while_port_pending_test.dart` (đặt file mới `test/screens/customers/…`, không sửa file cũ) — đặc biệt `CustomerPickScreen.create` về muộn **không** được gọi `onSelect` (sẽ push route trên router đã đổi).

### 6. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

Khuôn chung (giống 11.1): file `lib/screens/<area>/<screen>_cubit.dart` + `<screen>_state.dart` cạnh màn, comment đầu `// hand-authored — … (Story 11.2, moved out of XScreen's State).`; cubit nhận port qua constructor, field `final XPort _port;`; mọi `await` port có `if (isClosed) return …;` trước **mọi** `emit` (cả `catch`); state `final class … extends Equatable`; câu tiếng Việt **byte-for-byte** như cũ; constructor public của màn **giữ nguyên chữ ký** (vẫn `const`); controller ở lại `State` (§6.9). Cubit mặc định, không `Bloc` (gõ-tới-đâu-lọc-tới-đó ở danh sách khách dùng vé `_latest` như cũ là đủ; không thêm debounce — đổi số request).

**D1 — `CustomerListCubit` + `CustomerListState`.**
- State: `CustomerListState {CustomerListStatus status (loading|ready|error); List<Customer> items; int page; int total; int pageSize; String custType; bool searching}` (một class + constructor đầy đủ; `searching` = `q` đang gửi không rỗng hoặc `custType != 'ALL'`, tính ở cubit để màn không phải đọc controller cho logic). Hằng `'ALL'` dời vào cubit/state (public `kAllCustTypes` hoặc giữ private trong cubit + màn so qua `state.custType`) — chọn một, ghi Completion Notes; nhãn lọc ở màn giữ nguyên.
- Cubit: field private `String _q = ''`, `String _custType = 'ALL'`, `int _page = 1`, `int _latest = 0`; `load()` (vé: `final int ticket = ++_latest; emit(loading…)`; `await _port.list(q: _q.isEmpty ? null : _q, custType: _custType == 'ALL' ? null : _custType, page: _page)`; `if (isClosed || ticket != _latest) return;` ở cả `try` lẫn `catch`); `search(String q)` ⇒ `_q = q; _page = 1; load()`; `setCustType(String t)` ⇒ `_custType = t; _page = 1; load()`; `goToPage(int p)` ⇒ `_page = p; load()`. Tạo bằng `BlocProvider(create: (_) => CustomerListCubit(widget.port)..load())`.
- **Giữ khi `loading`: `items/total/pageSize/page` cũ** (màn cũ chỉ đổi `_state`) — `emit` loading phải copy các field cũ; pager ẩn khi không `ready` nên người dùng không thấy khác, nhưng giữ để đúng tinh thần "không đổi state".
- Màn: `StatefulWidget` (giữ `_q`); `onChanged: (_) => cubit.search(_q.text)`; nút lọc `cubit.setCustType(option[0])`; Trước/Sau `cubit.goToPage(...)`; Thử lại `cubit.load`; `_add`: `await widget.onAdd!(); if (mounted) cubit.load();` (callback `onAdd` là điều hướng — ở màn). Lấy cubit trong `State` bằng field (như D3) hoặc truyền qua `BlocBuilder` builder `context.read` — dev chọn, nhưng `_add` cần cubit sau `await` ⇒ field là đơn giản nhất.

**D2 — `CustomerDetailCubit` + `CustomerDetailState`.** `sealed class CustomerDetailState` với `CustomerDetailLoading`, `CustomerDetailReady(Customer customer, List<CustomerSource> sources)`, `CustomerDetailError` (§6.7: pha khác hẳn ⇒ sealed). `CustomerDetailCubit(CustomersPort port, String sdt)`; `load()`: emit loading; `get(sdt)` **rồi** `listSources()` (tuần tự, giữ thứ tự request); lỗi bất kỳ ⇒ error. **Hành vi cũ khi Thử lại:** `_customer` cũ còn giữ nên eyebrow/title vẫn hiện khách cũ trong lúc loading/error sau lần ready trước — với sealed state, giữ bằng `CustomerDetailLoading({Customer? previous})`/`CustomerDetailError({Customer? previous})` **hoặc** chọn một class + `status` như D1. Ưu tiên: **một class + status** (`CustomerDetailState {status; Customer? customer; List<CustomerSource> sources}`) vì eyebrow/title đọc `customer` ở mọi pha — ghi lý do lệch §6.7 một dòng trong Completion Notes.

**D3 — `CustomerPickCubit` + `CustomerPickState`.**
- State: `CustomerPickState {List<CustomerSource> sources; CustomerLookup? result; String? error; Map<String, String> fieldErrors; bool creating}` (một class; `fieldErrors` mặc định `const {}`; dựng đủ field mỗi lần emit hoặc `copyWith` có sentinel để xoá về `null` — **đừng** `error ?? this.error`).
- Giữ ở `State` (thuần UI, không đến/đi port tới lúc submit): 7 controller, `_custType` (chọn loại), `_sourceId` (chọn nguồn). `_needsSourceNote` đọc `state.sources` + `_sourceId` (hàm thuần ở màn hoặc method tĩnh của cubit; giữ đọc **cờ `isOther`**, không so tên).
- Cubit: `loadSources()` (lỗi ⇒ `sources: const []`, không đặt `error`); `lookup(String raw)` ⇒ emit `{error:null, fieldErrors:{}, creating:false, result: giữ}` rồi `await _port.lookup(raw)` ⇒ `result`; lỗi ⇒ `result:null` + `_messagesOf(err)`; `startCreate()` / `cancelCreate()` ⇒ `creating` true/false; `Future<Customer?> create({required String phone, required String custType, required String name, required String nationalId, required String taxCode, required String address, required String bankAccount, required String sourceId, required String sourceNote})` — nhận chuỗi **thô** từ màn, cubit áp đúng luật null theo loại (bảng §1), xoá lỗi trước khi gửi, trả `created` hoặc `null` (lỗi ⇒ `_messagesOf`; đã đóng ⇒ `null`). Không thêm cờ busy (giữ số request).
- Màn: cubit là field `State` tạo trong `initState` (`CustomerPickCubit(widget.port)..loadSources()`), `BlocProvider.value` + `BlocBuilder`, `dispose()` gọi `_cubit.close()` **sau** dispose controller (thứ tự không quan trọng, nhưng phải có — `BlocProvider.value` không tự đóng). `void _lookup() => _cubit.lookup(_sdt.text);` (guard (m)). Nút "Dùng khách này" giữ nguyên `onPressed: () => widget.onSelect?.call(customer)` (guard (n)). Nút "Tạo khách hàng mới"/"Không phải khách này?…" ⇒ `_cubit.startCreate`; "Huỷ" ⇒ `_cubit.cancelCreate`.
- **Bẫy nhúng:** `create_quote_screen.dart:931` dựng `CustomerPickScreen` mới mỗi `build` khi `order == null` ⇒ widget giữ State theo vị trí cây; khi `_error != null` màn báo giá bọc nó vào `Column` ⇒ **State của pick bị dựng lại** (đã như vậy hôm nay — `listSources` gọi lại). Cubit field-trong-State giữ y vòng đời đó. `create_quote_screen_test.dart` phải xanh không đổi.

**D4 — `WarrantyLookupCubit` + `WarrantyLookupState`.** `sealed class WarrantyLookupState` với `WarrantyLookupIdle`, `WarrantyLookupLoading`, `WarrantyLookupReady(WarrantyLookup result)`, `WarrantyLookupError(String message)` (pha khác hẳn ⇒ sealed, §6.7). `lookup(String raw)`: emit loading → `await _port.lookup(raw)` → ready; lỗi ⇒ `err is WarrantyPortException ? err.message : 'Không tra cứu được bảo hành.'`. Không vé, không chặn bấm (giữ y). Màn: `StatefulWidget` (giữ `_sdt`), nút Tra cứu và `onRetry` đều gọi `cubit.lookup(_sdt.text)`; `_than()` switch trên sealed state (exhaustive, không `default`). Hàm hiển thị ở màn (bẫy 2).

**D5 — `ProfileCubit` + `ProfileState`.** State `ProfileState {String? error; bool done}` (một class, dựng đủ mỗi lần emit như `LoginState`). `_passwordRe` dời vào cubit (guard `profile.test.mjs` không ghim vị trí regex; kiểm lại bằng chạy). Cubit: `Future<bool> submit({required String current, required String password, required String confirm})` — giữ y thứ tự §1: nếu `state.done` ⇒ emit `done:false` trước; `current.trim()` rỗng ⇒ lỗi 1; `_passwordRe` ⇒ lỗi 2; khác `confirm` ⇒ lỗi 3; emit `error:null`; `await _port.changePassword(currentPassword: current.trim(), newPassword: password)`; `isClosed` ⇒ `false`; ok ⇒ emit `ProfileState(done: true)` + trả `true` ⇒ màn `clear()` 3 controller; lỗi **bất kỳ** ⇒ câu cố định, trả `false`. `clearError()` cho "Huỷ" (emit `error:null`, **giữ `done`**). Màn: `PermissionsScope.of(context)` ở `build` giữ nguyên (render danh tính), `_menuTabIndex = 4` giữ, 3 `obscureText: true` giữ; `_reset()` = clear 3 ô + `cubit.clearError()`. **Thứ tự cũ khi thành công:** xoá ô + xoá lỗi rồi `_done = true` cùng nhịp — trả `bool` giữ được (giống 11.1 D7).

**D6 — Guard `no_port_call_in_screens_test.dart`.** Xoá đúng 5 entry `'11.2'` khỏi `notMigrated` (còn 11). Không đổi detector. Ca (b) tự kiểm entry còn vi phạm sẽ bắt nếu sót. Ca (c) chống guard rỗng giữ nguyên (≥ 20 file màn; theo D10 11.1 `*_state.dart` được tính là file màn, `*_cubit.dart` thì không ⇒ số tăng thêm 5, vẫn ≥ 20). File `*_state.dart` mới cũng bị cấm gọi port — đừng để logic gọi port lọt vào state.

**D7 — Text-guard.** `customers.test.mjs`: `mobile` = `Object.fromEntries(... readMobileScreen(repoRoot, v))`. `warranty-lookup.test.mjs`: `mobileCode = stripDart(readMobileScreen(repoRoot, MOBILE_SCREEN))`. `profile.test.mjs`: `mobile = readMobileScreen(repoRoot, 'mobile/lib/screens/account/profile_screen.dart')` (giữ `existsSync(MOBILE_DART)` ca (a)) + bẫy 1. `assertCodeNotBlind` floor giữ nguyên. Không sửa `parity.test.mjs`, `orders.test.mjs:381` (chỉ đòi `create_quote_screen.dart` import pick screen — không đổi).

### 7. Phạm vi

- **Trong:** D1–D7; `bloc_test` cho 5 cubit; ca widget tháo-màn-khi-port-chờ cho 5 màn (file test mới); proposal 2026-10-23 thêm **§8 "Quyết định khi làm 11.2"** (bẫy 1 tiền xử lý import ở profile (g), D2 lệch sealed, D3 cubit-field-trong-State + `BlocProvider.value`, `'ALL'` đặt ở đâu, và mọi chỗ sửa code vì đếm `pump()`); `epics.md` Story 11.2 chỉ sửa nếu AC thực sự đổi (G-5/luật 11).
- **Ngoài:** 11 màn còn trong allowlist (11.3/11.4) — kể cả `create_quote_screen.dart` dù nó nhúng pick; `SignedInApp`/router/`app_routes.dart`; port/adapter/transport/client sinh; `PermissionsScope`; backend, web. Lỗi phát hiện ở tầng port/adapter ⇒ ghi TD, không sửa lẫn (§6.16). Smoke emulator thuộc 11.4 (§6.17) — story này không bắt buộc, ghi rõ "chưa chạy" trong Completion Notes.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md` Story 11.2)

1. **Given** `customer_list_screen.dart`, `customer_detail_screen.dart`, `customer_pick_screen.dart`, `warranty_lookup_screen.dart`, `profile_screen.dart`, **When** chuyển, **Then** mỗi màn một cubit cạnh file màn (`CustomerListCubit`, `CustomerDetailCubit`, `CustomerPickCubit`, `WarrantyLookupCubit`, `ProfileCubit`) nhận `CustomersPort`/`WarrantyPort`/`PasswordPort` qua constructor; màn chỉ render state + gửi sự kiện; constructor public của màn giữ nguyên chữ ký.
2. **Given** tra SĐT chọn/tạo khách inline (`customer_pick`), **When** chuyển, **Then** giữ nguyên: select tạo khách chỉ hiện nguồn `active`, lỗi `fieldErrors.phone` dưới ô SĐT, chọn/tạo xong rời form và danh sách tải lại; hồ sơ đổi mật khẩu giữ "sai mật khẩu hiện tại ⇒ giữ phiên".
3. **Given** guard "màn không gọi port", **When** story xong, **Then** allowlist bớt đúng 5 entry trên (tự kiểm: entry nào còn sót ⇒ ĐỎ); đột biến thêm lại lời gọi port vào `customer_pick_screen.dart` ⇒ ĐỎ.
4. **Given** text-guard `customers.test.mjs`, `warranty-lookup.test.mjs`, `profile.test.mjs`, **When** logic dời sang cubit, **Then** guard đọc cả `*_cubit.dart`/`*_state.dart` cùng thư mục; đột biến đưa mẫu bị cấm (vd `AppPerm.`) vào file cubit ⇒ ĐỎ.
5. **Given** test widget khách (18 ca), bảo hành (12), hồ sơ (11) và `signed_in_app_test`, **When** chạy, **Then** xanh, không đổi finder/expect/fake; mỗi cubit có `bloc_test` (đầu, thành công, lỗi port, đóng sớm).
6. **Given** 5 lane, **When** story commit, **Then** mobile + design-system xanh, `flutter analyze` sạch; backend/web không đổi.

### AC dẫn xuất (đo được)

7. **Đọc đúng file của chính màn** (AC 4, §7.6): 3 guard dùng `readMobileScreen` (không tự nối thư mục). Đột biến **xoá neo dương** (memory `text-guard-concat-sibling-files-false-green`), mỗi cái ⇒ ĐỎ: (a) xoá `_page = 1` khỏi `customer_list_cubit.dart` (thay bằng `_page = 0 + 1`, vẫn compile) ⇒ `customers.test.mjs` ĐỎ; (b) xoá câu `'Xác nhận mật khẩu không khớp.'` khỏi `profile_cubit.dart` (đổi chữ) ⇒ `profile.test.mjs` ĐỎ; (c) `warranty-lookup.test.mjs` không có neo dương nào dời sang cubit (mọi neo dương là hàm hiển thị ở màn) ⇒ việc guard đọc cubit được chứng minh bằng mutant âm ở AC 8; thêm một mutant xoá chữ `warrantyStatus` khỏi màn bảo hành ⇒ ĐỎ (màn vẫn là chỗ map trạng thái → nhãn/màu).
8. **Đột biến mẫu cấm vào cubit** (AC 4), mỗi cái ⇒ ĐỎ đúng guard: `customer_pick_cubit.dart` + `RegExp(r'^0')` (dùng trong code thật) ⇒ `customers.test.mjs`; `customer_detail_cubit.dart` + `elevation` (định danh trong code) ⇒ `customers.test.mjs`; `warranty_lookup_cubit.dart` + `DateTime.now()` ⇒ `warranty-lookup.test.mjs`; `warranty_lookup_cubit.dart` + `'+84'` ⇒ `warranty-lookup.test.mjs`; `profile_cubit.dart` + `fetchMe(` ⇒ `profile.test.mjs`; `profile_cubit.dart` + `'orders.view_all'` ⇒ `profile.test.mjs` (g) (bẫy 1); `customer_list_cubit.dart` + `AppPerm.ordersViewAll` ⇒ `permission-keys.test.mjs` (guard walk thấy cubit). Và **ca âm**: dòng `import 'profile_cubit.dart';` ở màn ⇒ `profile.test.mjs` (g) **xanh**.
9. **Đột biến guard port** (AC 3, H-5) — chèn vào `customer_pick_screen.dart` (mutant phải compile, dùng method có thật của `CustomersPort`), mỗi biến thể một lần ⇒ ĐỎ ca "no screen outside the allowlist…": (a) `widget.port.listSources();` (b) `final CustomersPort p = widget.port; p.listSources();` (c) tear-off `final f = widget.port.lookup;` (d) `widget.port.listSources.call();` (e) `final CustomersPort customersPort = widget.port; customersPort.lookup('');` (f) `widget.port.listSources().then((_) {});`. Thêm: (g) thêm lại `customers/customer_pick_screen.dart` vào allowlist ⇒ ĐỎ ca "every allowlist entry … still calls a port"; (h) `widget.port.changePassword(currentPassword: '', newPassword: '');` vào `profile_screen.dart` ⇒ ĐỎ; (i) `widget.port.lookup('');` vào `warranty_lookup_screen.dart` ⇒ ĐỎ. Ghi bảng (dòng `Tests:` / số ca đỏ mỗi mutant) vào Debug Log.
10. **`CustomerListCubit`** (`bloc_test`): đầu = loading; `load` ok ⇒ ready + items/page/total/pageSize từ port; port nhận `q: null` khi rỗng, `custType: null` khi `'ALL'`, `page: 1`; `search('0903')` ⇒ port nhận `q: '0903', page: 1`; `goToPage(2)` rồi `search('x')` ⇒ lần cuối `page: 1`; `setCustType(kCaNhan)` ⇒ `custType: 'CA_NHAN', page: 1`; **sai thứ tự**: hai `search` với `Completer`, trả lời lần 1 **sau** lần 2 ⇒ chỉ state của lần 2 (cả khi lần 1 lỗi muộn ⇒ không thành error); lỗi ⇒ error; `searching` đúng 4 tổ hợp; đóng sớm ok/lỗi ⇒ không emit, không ném.
11. **`CustomerDetailCubit`**: thứ tự request `get` rồi `listSources` (port ghi log thứ tự); `get` lỗi ⇒ error, **không** gọi `listSources`; ok ⇒ ready + customer + sources; Thử lại sau lỗi ⇒ loading rồi ready; đóng sớm ok/lỗi.
12. **`CustomerPickCubit`**: `loadSources` ok ⇒ sources; lỗi ⇒ `[]`, `error` null; `lookup` gửi chuỗi **thô** (`' 0903 176 968 '` nguyên văn); found/miss ⇒ `result`; `CustomerPortException` ⇒ `error = message`, `fieldErrors` nguyên map, `result` null; `StateError` ⇒ `'Không thực hiện được. Thử lại.'`, map rỗng; `lookup` khi `creating` ⇒ `creating:false`; `create` Cá nhân với `taxCode`/`bankAccount` đã gõ ⇒ body `taxCode: null, bankAccount: null`, `nationalId` có; Thương mại ⇒ `nationalId: null`; ô rỗng ⇒ `null`; `sourceNote` không rỗng gửi kể cả nguồn không `isOther`; `phone` thô; `create` ok ⇒ trả customer; lỗi ⇒ `null` + messages; `fieldErrors['phone']` giữ (màn đặt dưới ô SĐT — ca widget có sẵn phủ vị trí); đóng sớm `lookup`/`create` ok/lỗi ⇒ không emit, `create` trả `null`.
13. **`WarrantyLookupCubit`**: đầu idle; ok ⇒ loading, ready(result); `WarrantyPortException` ⇒ error(message nguyên văn); lỗi khác ⇒ `'Không tra cứu được bảo hành.'`; chuỗi gửi thô; đóng sớm ok/lỗi.
14. **`ProfileCubit`**: đầu `{error:null, done:false}`; 3 câu validate đúng chữ, 0 lời gọi port; `current` có khoảng trắng ⇒ port nhận bản trim, `password` không trim; ok ⇒ `done:true`, trả `true`; lỗi bất kỳ (kể cả `ApiError` có message riêng) ⇒ đúng câu cố định, trả `false`, **không** `done`; `submit` khi `done` ⇒ emit `done:false` trước câu lỗi validate; `clearError()` giữ `done`; đóng sớm ok/lỗi ⇒ trả `false`, không emit.
15. **Tháo màn khi port còn chờ** (file test mới, khuôn `unmount_while_port_pending_test.dart`): mỗi màn (list `list`, detail `get`, pick `listSources`/`lookup`/`create`, warranty `lookup`, profile `changePassword`) bị thay khỏi cây rồi port trả lời (ok và lỗi) ⇒ không ném; pick `create` về muộn ⇒ `onSelect` **không** được gọi.
16. **Lưới an toàn không bị đụng:** `git diff --stat 21302e1 -- mobile/test/screens/customers mobile/test/screens/warranty mobile/test/screens/account mobile/test/screens/orders mobile/test/app` chỉ có **file mới** — 0 dòng sửa trong file test cũ; `create_quote_screen_test.dart` + `order_routes_test.dart` xanh không đổi. Toàn lane mobile ≥ 830 ca cũ + ca mới, xanh.

---

## Tasks / Subtasks

- [x] **T1 — `ProfileCubit` (AC 1, 2, 5, 14)**: D5; `test/screens/account/profile_cubit_test.dart`. Làm trước vì nhỏ nhất, chạy `profile_screen_test.dart` + `signed_in_app_test.dart` ngay.
- [x] **T2 — `WarrantyLookupCubit` (AC 1, 5, 13)**: D4; `test/screens/warranty/warranty_lookup_cubit_test.dart`; xác nhận ca "state loading" (một `pump()`) xanh (bẫy 3).
- [x] **T3 — `CustomerDetailCubit` (AC 1, 5, 11)**: D2; `test/screens/customers/customer_detail_cubit_test.dart`.
- [x] **T4 — `CustomerListCubit` (AC 1, 5, 10)**: D1; `test/screens/customers/customer_list_cubit_test.dart`.
- [x] **T5 — `CustomerPickCubit` (AC 1, 2, 5, 12)**: D3; `test/screens/customers/customer_pick_cubit_test.dart`; chạy cả `test/screens/orders/create_quote_screen_test.dart`.
- [x] **T6 — Ca tháo màn (AC 15)**: `test/screens/customers/unmount_while_port_pending_test.dart` (hoặc một file cho cả 5 màn, đặt dưới `test/screens/` — chọn một, ghi Completion Notes).
- [x] **T7 — Guard port (AC 3, 9)**: D6; chạy đủ mutant AC 9 (cp backup, không `git checkout`), ghi bảng.
- [x] **T8 — Text-guard (AC 4, 7, 8)**: D7 + bẫy 1; chạy mutant AC 7–8, ghi bảng.
- [x] **T9 — Tài liệu**: proposal §8 (mục §7 phạm vi); `project-context.md` **không** sửa (câu allowlist bỏ ở 11.4).
- [x] **T10 — Cổng**: `cd mobile && ~/fvm/default/bin/flutter analyze` sạch; `~/fvm/default/bin/flutter test` xanh; `cd design-system && npm test` xanh; AC 16 `git diff --stat`; `dart format -o none --set-exit-if-changed` CHỈ trên file story chạm (repo không áp `dart format` — so với HEAD như 11.1, không ghi file); không còn file backup trong repo; `git status --short` chỉ có file của story (+ `.githooks/`, `docs/*.xlsx`, `_bmad-output/story-automator/*` chưa track — không thuộc story, không đụng).

---

## Dev Notes

### Quyết định đã chốt — không bàn lại

- §6 proposal là luật; §7 (11.1) là chi tiết hoá đã áp. Đặc biệt §6.6 (port qua constructor màn), §6.7 (state Equatable; lỗi port giữ câu adapter — **trừ hồ sơ**, nơi câu cố định là hành vi cũ và §6.11 thắng), §6.9 (controller ở `State`), §6.10 (`isClosed`), §6.11 (thứ tự + số request), §6.12 (test cũ không đổi finder/expect/fake), §6.15 (tên tiếng Anh, file cạnh màn).
- Ngôn ngữ (luật dự án 8): tên class/method/field/test, comment **tiếng Anh**; chỉ chuỗi người dùng thấy tiếng Việt. Symbol tiếng Việt có sẵn (`dinhDangNgay`, `_conLai`, `_chipTrangThai`, `_bangDon`, `_than`, `_tra`, `_ketQua`, `_loi`) — **không đổi tên hàng loạt**; hàm hiển thị ở màn giữ tên (parity guard ghim `dinhDangNgay`); state/cubit mới đặt tên tiếng Anh.
- Đừng "tiện tay" sửa hành vi đáng ngờ đã liệt kê ở §1 (không cờ busy ở tạo khách/tra bảo hành, `sourceNote` gửi khi nguồn không `isOther`, câu lỗi cố định ở hồ sơ, `sourceId: ''`). Thấy đáng sửa ⇒ ghi TD trong Completion Notes.

### Tình huống biên đã tính

- Danh sách khách: gõ nhanh `0`, `09`, `090` ⇒ 3 request (giữ), chỉ kết quả cuối hiện (vé). Trả lời lỗi của vé cũ đến muộn sau thành công của vé mới ⇒ bỏ.
- Danh sách khách sau `onAdd` (quay về từ màn tra/tạo): màn đã bị tháo (đăng xuất giữa chừng) ⇒ `mounted` false ⇒ không gọi `load`; cubit đã đóng ⇒ kể cả gọi cũng không emit.
- Pick: `create` thành công nhưng màn đã bị tháo ⇒ không `onSelect` (cả kiểm `mounted` ở màn lẫn `null` từ cubit).
- Pick nhúng trong tạo báo giá: dựng lại State khi `_error` của báo giá đổi ⇒ cubit mới, `listSources` gọi lại — như hôm nay.
- Bảo hành: bấm Tra cứu 2 lần nhanh ⇒ 2 request, kết quả về sau thắng (như hôm nay — không thêm vé).
- Hồ sơ: lỗi validate sau một lần thành công ⇒ banner xanh tắt rồi banner đỏ hiện (ca widget không có — `bloc_test` AC 14 phủ).
- Equatable dedupe: `load()` khi đang loading với cùng field ⇒ không emit thêm — không đổi gì người dùng thấy.

### Kiểm thử — luật dự án áp dụng trực tiếp

- `bloc_test` (`blocTest<XCubit, XState>(build:, act:, expect:, verify:)`; `expect` không gồm state đầu). Fake: dùng `FakeCustomersPort`/`FakeWarrantyPort`/`FakePasswordPort` (`lib/design_system/session/fake_*`) khi đủ; port ghi log/`Completer` viết tại test cho ca thứ tự + đóng sớm. Không thêm `mocktail`/`mockito` (§6.2).
- Ca đóng sớm trong `testWidgets` + `await cubit.close()` có listener ⇒ treo (memory) — viết `bloc_test`/`test` thường.
- Mutation: `cp` file ra scratchpad trước, `cp` ngược lại sau, `cmp` xác nhận; **không `git checkout`** (code story chưa commit). zsh: bọc lệnh test trong function, in dòng tổng kết mỗi mutant (memory `zsh-command-var-no-word-split-mutation`). Chèn chuỗi tiếng Việt bằng công cụ giữ UTF-8 (memory `mutation-script-unicode-escape-mangles-vietnamese`) và `grep` chuỗi đã chèn trước khi tin kết quả XANH.
- Mutant phải compile (memory `mutation-must-compile-or-false-red`).
- `dart format` ghi file kể cả `--set-exit-if-changed` ⇒ luôn `-o none`.
- Flutter: `~/fvm/default/bin/flutter`, `~/fvm/default/bin/dart` (không trên PATH). Máy mới: `dart pub get` trong `mobile/tool/codegen` một lần trước `flutter test` (drift test chạy `--offline`, §7.1).
- Lệnh lane: `cd mobile && ~/fvm/default/bin/flutter test test/screens/customers test/screens/warranty test/screens/account test/screens/no_port_call_in_screens_test.dart test/app/signed_in_app_test.dart test/screens/orders/create_quote_screen_test.dart` (hẹp) → `flutter test` (toàn bộ); `cd design-system && node --test screens/customers.test.mjs screens/warranty-lookup.test.mjs screens/profile.test.mjs` → `npm test`.

### Previous Story Intelligence (11.1)

- Khuôn đã chạy: cubit trả `bool`/giá trị thay cờ one-shot (§7.2); `LoginState` không `copyWith`, dựng đủ mỗi emit (§7.3) — làm theo cho `ProfileState`; `ForgotPasswordState` có `copyWith` khi cần giữ field.
- Hết phiên cần frame cùng nhịp (§7.4) — bài học: test cũ một `pump()` sau tín hiệu không-phải-tap có thể đỏ dưới BLoC; sửa code.
- Review 11.1: H-1 helper text-guard đọc lẫn cubit màn khác ⇒ đã sửa (đọc theo tên màn, file mồ côi ⇒ ném) ⇒ đặt tên **`customer_list_cubit.dart`/`customer_list_state.dart`**… đúng tiền tố màn, nếu sai helper ném cả 3 guard customers. H-2 guard port bỏ sót `ports.x.y()` ⇒ đã sửa.
- QA 11.1: ca lỗi-sau-close + ca widget tháo màn là bắt buộc (bẫy 4).
- `dart format` báo "changed" cả trên bản HEAD của file cũ (repo viết dòng > 80) — so với HEAD, không ghi file.

### Git intelligence

- `21302e1` (11.1) — đọc diff `login_screen.dart`/`login_cubit.dart`/`login_state.dart`, `no_port_call_in_screens_test.dart`, `read-mobile-screen.mjs`, `login.test.mjs` (đổi 4 dòng sang helper) để chép khuôn.
- `811d3c7` — epics/proposal/spine/project-context Epic 11 (spine AD-12 "Luật state mobile" đã có — không sửa).
- `859b894` (10.8) — `AppPorts`, `signed_in_app.dart` router — không sửa.

### Latest tech notes (đo 2026-10-23, Flutter 3.35.0 / Dart 3.9.0; lock: `flutter_bloc 9.1.1`, `bloc 9.2.1`, `bloc_test 10.0.0`, `equatable 3.0.0`)

- `emit` sau `close` ném `StateError`; `isClosed` công khai. `BlocProvider(create:)` tự đóng cubit khi rời cây; **`BlocProvider.value` không đóng** ⇒ cubit tạo trong `initState` phải `close()` ở `dispose()`.
- `emit` trùng state (`==`) bị bỏ qua. Sealed class Dart 3: `switch` exhaustive không cần `default`.
- Không cần package mới. Nếu thấy cần ⇒ dừng, ghi lý do vào proposal (§6.2).

### Project Structure Notes

- File mới: `mobile/lib/screens/customers/{customer_list,customer_detail,customer_pick}_{cubit,state}.dart`; `mobile/lib/screens/warranty/warranty_lookup_{cubit,state}.dart`; `mobile/lib/screens/account/profile_{cubit,state}.dart`; test: `mobile/test/screens/customers/{customer_list,customer_detail,customer_pick}_cubit_test.dart`, `mobile/test/screens/warranty/warranty_lookup_cubit_test.dart`, `mobile/test/screens/account/profile_cubit_test.dart`, file ca tháo màn (T6).
- File sửa: 5 file màn; `mobile/test/screens/no_port_call_in_screens_test.dart` (bớt 5 entry); `design-system/screens/{customers,warranty-lookup,profile}.test.mjs`; `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` (§8); `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Không sửa:** `mobile/lib/main.dart`, `mobile/lib/app/**`, mọi port/adapter/transport/fake, `mobile/lib/api/generated/**`, 11 màn còn allowlist (gồm `create_quote_screen.dart`), mọi test cũ, `design-system/session/parity.test.mjs`, `design-system/lib/read-mobile-screen.mjs` (helper đủ dùng — sửa chỉ khi chứng minh được lỗi, kèm ca test helper).
- Commit: conventional, tiếng Anh, không nhắc AI; `git add` đường dẫn cụ thể (không `-A`); không push.

### Câu hỏi mở (không chặn dev — đã có mặc định)

- `'ALL'` của danh sách khách: hằng public trong state hay private trong cubit (D1) — mặc định: `const String kAllCustTypes = 'ALL';` ở `customer_list_state.dart`, màn import.
- `CustomerDetailState` một class + status thay vì sealed (D2) — mặc định một class (lý do: eyebrow/title đọc `customer` ở mọi pha).
- Vị trí file ca tháo màn (T6) — mặc định `test/screens/unmount_while_port_pending_menu_screens_test.dart` một file cho 5 màn.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.2 (dòng 778-786)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` §6.1–6.20, §7.1–7.7]
- [Source: `_bmad-output/implementation-artifacts/11-1-nen-bloc-dependency-guard-man-khong-goi-port-phien-va-man-dang-nhap.md` — D7, D10, D11, Review H-1/H-2, Debug Log]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-12 "Luật state mobile"]
- [Source: `_bmad-output/project-context.md` — Kiến trúc code/Mobile (dòng 64), Testing (dòng 77)]
- [Source: `mobile/lib/screens/customers/*.dart`, `mobile/lib/screens/warranty/warranty_lookup_screen.dart`, `mobile/lib/screens/account/profile_screen.dart`, `mobile/lib/app/signed_in_app.dart:120-155`, `mobile/lib/screens/orders/create_quote_screen.dart:925-945`, `mobile/lib/design_system/session/{customers,warranty,password}_port.dart`]
- [Source: `design-system/screens/customers.test.mjs` (e.3)(g)(i)(l)(m)(n), `design-system/screens/profile.test.mjs:104-187`, `design-system/screens/warranty-lookup.test.mjs:40-140`, `design-system/session/parity.test.mjs:527-565`, `design-system/lib/read-mobile-screen.mjs`]

## Dev Agent Record

### Agent Model Used

claude-opus-5-5[1m] (Claude Code, bmad-dev-story)

### Debug Log References

**Bảng đột biến** (script `cp` backup → sửa UTF-8 → chạy lane → `cp` trả + `cmp`; không `git checkout`; mỗi chuỗi chèn được `grep` lại trước khi chạy). Lane port-guard = `flutter test test/screens/no_port_call_in_screens_test.dart`; lane text-guard = `node --test <file>`.

| Mutant | File | Lane | Kết quả |
|---|---|---|---|
| 9a `widget.port.listSources();` | customer_pick_screen | port-guard | ĐỎ `+21 -1` |
| 9b alias `final CustomersPort p = widget.port; p.listSources();` | customer_pick_screen | port-guard | ĐỎ `+21 -1` |
| 9c tear-off `final f = widget.port.lookup;` | customer_pick_screen | port-guard | ĐỎ `+21 -1` |
| 9d `widget.port.listSources.call();` | customer_pick_screen | port-guard | ĐỎ `+21 -1` |
| 9e `final CustomersPort customersPort = widget.port; customersPort.lookup('');` | customer_pick_screen | port-guard | ĐỎ `+21 -1` |
| 9f `widget.port.listSources().then((_) {});` | customer_pick_screen | port-guard | ĐỎ `+21 -1` |
| 9g thêm lại entry pick vào allowlist | no_port_call_in_screens_test | port-guard | ĐỎ `+21 -1` |
| 9h `widget.port.changePassword(...)` | profile_screen | port-guard | ĐỎ `+21 -1` |
| 9i `widget.port.lookup('');` | warranty_lookup_screen | port-guard | ĐỎ `+21 -1` |
| 7a `_page = 1` → `_page = 0 + 1` | customer_list_cubit | customers.test.mjs | ĐỎ pass 20 fail 1 — **review: chỉ ĐỎ vì thay cả dòng khai báo `int _page = 1;`**; thay riêng câu reset thì XANH (regex `/_page = 1/` khớp khai báo). Đã siết regex ở review |
| 7b đổi chữ `'Xác nhận mật khẩu không khớp.'` | profile_cubit | profile.test.mjs | ĐỎ pass 12 fail 1 |
| 7c xoá `warrantyStatus` khỏi màn | warranty_lookup_screen | warranty-lookup.test.mjs | ĐỎ pass 8 fail 1 |
| 8a `RegExp(r'^0').hasMatch(phone)` | customer_pick_cubit | customers.test.mjs | ĐỎ pass 20 fail 1 |
| 8b field `elevation` | customer_detail_cubit | customers.test.mjs | ĐỎ pass 20 fail 1 |
| 8c `DateTime.now()` | warranty_lookup_cubit | warranty-lookup.test.mjs | ĐỎ pass 8 fail 1 |
| 8d `'+84'` | warranty_lookup_cubit | warranty-lookup.test.mjs | ĐỎ pass 8 fail 1 |
| 8e `fetchMe(` | profile_cubit | profile.test.mjs | ĐỎ pass 12 fail 1 |
| 8f `'orders.view_all'` | profile_cubit | profile.test.mjs (g) | ĐỎ pass 12 fail 1 |
| 8g `AppPerm.ordersViewAll` | customer_list_cubit | permission-keys.test.mjs | ĐỎ pass 3 fail 1 |
| 8h gỡ dòng bỏ-import ở profile (g) (bẫy 1, ca âm ngược) | profile.test.mjs | profile.test.mjs | ĐỎ pass 12 fail 1 (⇒ dòng `import 'profile_cubit.dart';` thật sự làm (g) đỏ oan; có tiền xử lý thì xanh) |
| cP bỏ `isClosed` trong `catch` | profile_cubit | profile_cubit_test | ĐỎ `+8 -1` |
| cW bỏ `isClosed` trong `catch` | warranty_lookup_cubit | warranty_lookup_cubit_test | ĐỎ `+6 -1` |
| cD bỏ `isClosed` trong `catch` | customer_detail_cubit | customer_detail_cubit_test | ĐỎ `+7 -1` |
| cL bỏ `isClosed` trong `catch` | customer_list_cubit | customer_list_cubit_test | ĐỎ `+13 -1` |
| tL bỏ kiểm vé trong `catch` | customer_list_cubit | customer_list_cubit_test | ĐỎ `+13 -1` |
| tL0 bỏ kiểm vé trong `try` | customer_list_cubit | customer_list_cubit_test | lần 1 **XANH** (fixture trả cùng một trang ⇒ state muộn trùng ⇒ bloc bỏ qua: mutant tương đương trong fixture) ⇒ sửa fixture (`RecordingCustomersPort.pages`, hai trang khác nhau) ⇒ ĐỎ `+13 -1` |
| cS bỏ `isClosed` ở `loadSources` | customer_pick_cubit | customer_pick_cubit_test | ĐỎ `+17 -2` |
| cK bỏ `isClosed` trong `catch` của `lookup` | customer_pick_cubit | customer_pick_cubit_test | ĐỎ `+18 -1` |
| cC bỏ `isClosed` trong `catch` của `create` | customer_pick_cubit | customer_pick_cubit_test | ĐỎ `+18 -1` |
| cCok bỏ `isClosed ⇒ null` trong `try` của `create` | customer_pick_cubit | customer_pick_cubit_test | ĐỎ `+18 -1` |
| mnt bỏ `&& mounted` trước `onSelect` | customer_pick_screen | unmount_while_port_pending_menu_screens_test | XANH `+14 -0` (lớp cubit `null` đỡ — đúng thiết kế hai lớp) |
| mnt + cCok cùng lúc | pick screen + cubit | unmount_while_port_pending_menu_screens_test | ĐỎ `+13 -1` |

Khác: `bloc 9` cho qua emit **đầu tiên** dù bằng state khởi tạo ⇒ `bloc_test` detail/list/pick thấy thêm `loading`/state rỗng đầu tiên (đã sửa kỳ vọng test mới, không phải hành vi người dùng thấy). Ca widget mới "tạo khách về muộn" lần đầu bấm "Lưu khách hàng" trượt hit-test sau `enterText` ô tên (ô focus còn đang cuộn) ⇒ bỏ `enterText` ô tên (fake không kiểm tên) và `pumpAndSettle` trước tap.

### Completion Notes List

- 5 cubit + 5 state cạnh màn (D1–D5), port qua constructor, `if (isClosed)` trước mọi `emit` sau `await` (cả `catch`). Constructor public 5 màn giữ nguyên chữ ký (vẫn `const`); `CustomerDetailScreen` chuyển `StatefulWidget` → `StatelessWidget` (không còn state riêng, chữ ký không đổi).
- Câu tiếng Việt giữ nguyên byte; hàm hiển thị bảo hành (`dinhDangNgay`, `_conLai`, `_chipTrangThai`, `_bangDon`) ở lại màn; `CustomerFacts`/`_MicroLabel`/hằng top-level ở lại `customer_pick_screen.dart`; `_menuTabIndex = 4` + 3 `obscureText: true` ở lại màn hồ sơ; `_passwordRe` dời vào `profile_cubit.dart`.
- Hành vi cũ giữ (không "tiện tay" sửa): không cờ busy ở tạo khách/tra bảo hành, `sourceNote` gửi khi nguồn không `isOther`, câu lỗi cố định ở hồ sơ, `sourceId: ''`, không debounce danh sách khách (mỗi phím một request, vé chống sai thứ tự).
- Câu hỏi mở đã chọn mặc định: `kAllCustTypes` public ở `customer_list_state.dart`; `CustomerDetailState` một class + status (lý do: topbar đọc `customer` ở mọi pha); ca tháo màn một file `test/screens/unmount_while_port_pending_menu_screens_test.dart` cho 5 màn. `CustomerPickCubit` là field của `State` + `BlocProvider.value` + `close()` ở `dispose` (guard (m) `onPressed: _lookup`); 4 màn còn lại `BlocProvider(create:)` + `context.read` như `LoginScreen`.
- Bẫy 3 (đếm `pump()`): không ca widget cũ nào đỏ ⇒ không cần sửa code vì frame.
- Guard port: bớt đúng 5 entry `'11.2'` (allowlist còn 11). 3 text-guard dùng `readMobileScreen`; profile (g) thêm đúng dòng bỏ-import như customers (g), regex quyền không đổi. `read-mobile-screen.mjs`, `parity.test.mjs` không sửa.
- Test: 5 file `bloc_test` (đầu, thành công, lỗi port, đóng sớm ok + lỗi) + helper `test/screens/customers/recording_customers_port.dart` + file ca tháo màn (14 ca). Test cũ: `git diff --stat 21302e1 -- mobile/test/screens/{customers,warranty,account,orders} mobile/test/app` rỗng (AC 16).
- Cổng: `flutter analyze` sạch; `flutter test` **901/901** xanh lúc dev, **910** sau QA (ca wiring), **913/913** sau review (≥ 830); design-system `npm test` **510/510** xanh; backend/web `git diff 21302e1` rỗng. `dart format -o none`: repo không áp format (file 11.1 như `forgot_password_state.dart` cũng báo "changed") — không ghi file. Không còn file backup.
- Smoke emulator: **chưa chạy** (thuộc 11.4, §6.17).
- TD: không phát hiện lỗi tầng port/adapter.

### File List

- `mobile/lib/screens/account/profile_screen.dart` (sửa)
- `mobile/lib/screens/account/profile_cubit.dart` (mới)
- `mobile/lib/screens/account/profile_state.dart` (mới)
- `mobile/lib/screens/warranty/warranty_lookup_screen.dart` (sửa)
- `mobile/lib/screens/warranty/warranty_lookup_cubit.dart` (mới)
- `mobile/lib/screens/warranty/warranty_lookup_state.dart` (mới)
- `mobile/lib/screens/customers/customer_detail_screen.dart` (sửa)
- `mobile/lib/screens/customers/customer_detail_cubit.dart` (mới)
- `mobile/lib/screens/customers/customer_detail_state.dart` (mới)
- `mobile/lib/screens/customers/customer_list_screen.dart` (sửa)
- `mobile/lib/screens/customers/customer_list_cubit.dart` (mới)
- `mobile/lib/screens/customers/customer_list_state.dart` (mới)
- `mobile/lib/screens/customers/customer_pick_screen.dart` (sửa)
- `mobile/lib/screens/customers/customer_pick_cubit.dart` (mới)
- `mobile/lib/screens/customers/customer_pick_state.dart` (mới)
- `mobile/test/screens/no_port_call_in_screens_test.dart` (sửa — bớt 5 entry)
- `mobile/test/screens/account/profile_cubit_test.dart` (mới)
- `mobile/test/screens/warranty/warranty_lookup_cubit_test.dart` (mới)
- `mobile/test/screens/customers/customer_detail_cubit_test.dart` (mới)
- `mobile/test/screens/customers/customer_list_cubit_test.dart` (mới)
- `mobile/test/screens/customers/customer_pick_cubit_test.dart` (mới)
- `mobile/test/screens/customers/recording_customers_port.dart` (mới)
- `mobile/test/screens/unmount_while_port_pending_menu_screens_test.dart` (mới)
- `mobile/test/screens/menu_screens_cubit_wiring_test.dart` (mới — thêm ở bước QA, review bổ sung vào danh sách)
- `design-system/screens/customers.test.mjs` (sửa; review: siết neo reset trang)
- `design-system/screens/warranty-lookup.test.mjs` (sửa)
- `design-system/screens/profile.test.mjs` (sửa)
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` (sửa — §8)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (sửa)
- `_bmad-output/implementation-artifacts/11-2-chuyen-bloc-man-khach-hang-bao-hanh-ho-so.md` (story)

### Change Log

- 2026-10-23: Chuyển 5 màn Menu (danh sách/chi tiết/tra-tạo khách, tra cứu bảo hành, hồ sơ) sang Cubit; allowlist guard port bớt 5; 3 text-guard đọc cubit/state của màn; thêm `bloc_test` + ca tháo màn; proposal §8. Status → review.
- 2026-10-23: Code review (AI) — sửa 6 finding (2 test xanh giả, 1 neo guard mù, 1 phân lớp, 2 tài liệu); Status → done.

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI, `bmad-story-automator-review` + `/ck:code-review`, reviewer độc lập chạy song song) · 2026-10-23 · **Kết quả: Approve sau khi sửa.**

Hành vi người dùng thấy: so từng nhánh `setState` cũ ↔ `emit` mới cho 5 màn (thứ tự/số request, giữ/xoá field, vé chống sai thứ tự, `mounted`→`isClosed`, vòng đời khi `create_quote_screen` dựng lại pick) — **không lệch**. AC 1–16 đạt; AC 7(a) chỉ đạt sau khi sửa H-1.

**Phương pháp chính:** sweep đột biến xoá từng phép giữ field cũ (`x: state.x`) trong cubit pick/list/profile, chạy lane customers + unmount + wiring + create_quote + signed_in_app. Lần 1: **13/34 mutant sống**. Sau sửa: pick + list **28/28 ĐỎ**; mutant còn lại của profile là tương đương (đã bỏ code thừa).

| # | Mức | Finding | Sửa |
|---|---|---|---|
| H-1 | HIGH | `customers.test.mjs` neo `/_page = 1/` khớp dòng khai báo `int _page = 1;` ⇒ bỏ câu reset trang khi tìm/lọc vẫn XANH (có từ trước 11.2; mutant 7a của dev ĐỎ chỉ vì thay luôn dòng khai báo) | Regex `/^\s*_page = 1;/m` (siết, không nới). Đột biến bỏ câu reset (giữ khai báo) ⇒ ĐỎ; bản sạch xanh |
| M-1 | MEDIUM | `CustomerPickCubit`: 11 phép giữ field không test nào canh — tra lỗi làm mất danh sách nguồn (form tạo khách trống nguồn), nguồn về muộn xoá banner lỗi, Tạo/Huỷ form xoá banner lỗi, lưu lỗi mất thẻ khách (Huỷ ⇒ trống), câu trả lời tra cứu đóng form mở trong lúc chờ. Test "refused … answer kept" và "catalogue late keeps … message" xanh giả (seed không có field mà tên test hứa) | Seed đủ field + 3 ca mới (nguồn muộn sau tra lỗi; tra cứu trả lời/lỗi giữ form + lỗi tạo đặt trong lúc chờ). Sweep: mọi mutant ĐỎ |
| M-2 | MEDIUM | `customer_list_cubit_test` "keeps … page size" xanh giả: fixture `pageSize: 20` trùng mặc định state | Fixture `pageSize: 10`; mutant bỏ giữ `pageSize` ⇒ ĐỎ |
| M-3 | MEDIUM | File List thiếu `mobile/test/screens/menu_screens_cubit_wiring_test.dart` (thêm ở QA); Completion Notes ghi 901 ca (thực tế 910 trước review) | Bổ sung File List, cập nhật số ca |
| L-1 | LOW | `customer_pick_cubit.dart` import `customer_pick_screen.dart` (vòng cubit ↔ màn, cubit kéo cả thư viện widget) | So bằng enum sinh `CreateCustomerRequestDtoCustType`; bỏ import. Đột biến đảo `personal`/`commercial` ⇒ `customer_pick_cubit_test` ĐỎ |
| L-2 | LOW | `customer_list_cubit` lặp `_page = 1; load()` ở `search`/`setCustType` (màn cũ có một `_reloadFromFirstPage`) | Gom lại `_reloadFromFirstPage()` private — neo guard H-1 trỏ đúng một chỗ |
| L-3 | LOW | `ProfileCubit.submit` `emit(ProfileState(error: state.error))` khi `done`: không có state `done && error` ⇒ mutant tương đương, code gây hiểu nhầm | `emit(const ProfileState())` |

**Kiểm lại guard (tự bẻ, `cp` backup + `cmp`, không `git checkout`):** port-guard — `widget.port.listSources()` ở pick, tear-off `widget.port.changePassword` ở hồ sơ, `widget.port.lookup('')` ở bảo hành ⇒ ĐỎ `+21 -1`; text-guard — `AppPerm.ordersViewAll` ở list cubit ⇒ `permission-keys` ĐỎ; `'orders.view_all'` ở profile cubit ⇒ `profile.test.mjs` ĐỎ; `RegExp(r'^0')` ở pick cubit ⇒ `customers.test.mjs` ĐỎ; `DateTime.now()` ở warranty cubit ⇒ `warranty-lookup.test.mjs` ĐỎ; đổi chữ câu xác nhận trong profile cubit ⇒ ĐỎ. Luật backend (scope/FOR UPDATE/lane DB), web, e2e: không áp dụng — story thuần mobile, `git diff 21302e1 -- backend web` rỗng.

**Không phải lỗi (đã kiểm):** detail vẫn gọi `listSources` sau khi tháo màn — y như bản cũ; port bắt một lần trong cubit — các port route/`customersPort` ổn định; comment đầu file có tên màn tiếng Việt — khuôn 11.1 đã commit; `Story 11.2` trong comment — khuôn story bắt buộc. Smoke emulator: chưa chạy (thuộc 11.4, §6.17).

