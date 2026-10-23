# Sprint Change Proposal — Chèn Epic 11 "Chuyển mobile sang BLoC" (chạy TRƯỚC Epic 8)

- **Dự án:** Phương Nam Solar — Phase 1
- **Ngày:** 2026-10-23 (Asia/Saigon)
- **Workflow:** `bmad-correct-course`, chế độ **Batch, không tương tác** (Đại Ca vắng; áp mặc định tuyên bố trước)
- **Người soạn:** Amelia (Developer) · **Kiến trúc:** Winston · **Project Lead:** Đại Ca
- **Kích hoạt bởi:** action item **H-4** (retro Epic 10): quyết kiến trúc state mobile
- **Quyết định gốc (không bàn lại):** Đại Ca, 2026-10-23:
  1. Mobile **BẮT BUỘC** dùng BLoC (`flutter_bloc` + `bloc_test`). Quyết định này đóng H-4.
  2. Chuyển **TẤT CẢ** màn mobile hiện có sang BLoC/Cubit **TRƯỚC Epic 8**. Epic mới mang số **11**. Thứ tự chạy: **Epic 7 → Epic 10 → Epic 11 → Epic 8 → Epic 9** (Epic 7 và 10 đã xong). Màn mobile của Epic 8 và Epic 9 dựng bằng BLoC ngay từ đầu.
- **Phân loại phạm vi:** **Moderate** (thêm một epic + sắp lại backlog; không viết lại PRD, không rollback)

> Ghi chú vận hành: resolver `_bmad/scripts/resolve_customization.py` cần Python 3.11 (máy có 3.9.6) nên block `workflow` được merge tay: chỉ có `customize.toml` gốc (không có override `bmad-correct-course` trong `_bmad/custom/`), `persistent_facts` = `**/project-context.md`, các `activation_steps_*` và `on_complete` rỗng.

---

## 1. Tóm tắt vấn đề

**Vấn đề.** Kế hoạch ban đầu ghi mobile là "Clean Architecture + BLoC", nhưng code chưa từng dùng BLoC. Retro Epic 10 (§3.6) phát hiện lệch này, `project-context.md` được sửa cho khớp thực tế, còn chọn hướng nào thì để thành H-4 cho Đại Ca quyết. Ngày 2026-10-23 Đại Ca chốt: **dùng BLoC, chuyển hết màn cũ trước Epic 8.**

**Hiện trạng mobile (đo 2026-10-23):**

| Hạng mục | Thực tế |
|---|---|
| Màn | 20 file ở `mobile/lib/screens/` (9.307 dòng). **19 file có `StatefulWidget`** (`order_detail_screen.dart` và `stock_vouchers_screen.dart` mỗi file có 3 State); `stock_issue_preview.dart` là widget không state, không gọi port |
| Cách gọi port | Mỗi màn nhận port qua constructor (`final OrdersPort port;`…) rồi gọi thẳng trong `State` (~69 lời gọi `port.x(...)`, ~240 lần `setState`) |
| State cấp app | `lib/app/pns_app.dart`: pha phiên (`restoring/signedOut/forgotPassword/signedIn`), `_loggingOut`, `_signInCount`. `lib/design_system/session/app_session.dart`: `PermissionsProvider` (StatefulWidget gọi `/me`) + `PermissionsScope` (InheritedWidget). `lib/app/signed_in_app.dart`: giữ router + 2 `ValueNotifier` báo tải lại (hạ tầng điều hướng, không có `setState`) |
| Ráp port | `lib/main.dart` (composition root duy nhất, AD-12) → `AppPorts` (11 port) → `PnsApp` → `SignedInApp` → constructor màn |
| Test | 747 test mobile xanh (retro E10). Riêng `test/screens/` có ~357 ca, 10.169 dòng: auth 27, menu 7, hồ sơ 11, khách 18, bảo hành 12, **đơn 143**, thanh toán 42, kho 39, hợp đồng 20, hoá đơn 38. Thêm `pns_app_test` 16, `signed_in_app_test` 13, `session_test` 10 |
| Guard ngoài lane mobile | **19 text-guard** ở `design-system/screens/*.test.mjs` đọc **từng file màn mobile theo đường dẫn cứng** (19 đường dẫn `mobile/lib/screens/...`) và assert trên mã (vd `payment-schedule.test.mjs`: `_canRecord && i.status.json != 'paid'`, cấm `AppPerm.`). Riêng `design-system/permissions/permission-keys.test.mjs` quét cả thư mục `mobile/lib/screens` (nên tự thấy file cubit mới) |
| Dependency | 0 package bloc |

**Loại vấn đề:** đổi kiến trúc theo quyết định của Project Lead (không phải lỗi). Hành vi người dùng thấy không đổi.

**Bằng chứng.** `epic-10-retro-2026-10-23.md` §3.6 và §12 (H-4); `project-context.md` dòng 64; `mobile/lib/design_system/session/app_session.dart:7-9` ("a later app-scaffold story may swap it for a Cubit if the app standardises on BLoC").

**Vì sao làm bây giờ.** Epic 8 thêm màn mobile (8.1 Trang chủ, 8.5 Audit qua Menu), Epic 9 thêm hộp thư in-app + deep-link. Chuyển trước thì Epic 8/9 viết thẳng theo khuôn mới, không phải chuyển lại lần hai. Hiện chỉ có 19 màn, test widget phủ dày, nên đây là lúc chuyển rẻ nhất.

**Phát hiện kỹ thuật lúc định cỡ (chặn nếu không xử lý) — kiểm thật trên máy 2026-10-23, Flutter 3.35.0 / Dart 3.9.0, làm trong bản sao ở scratchpad, không đụng `mobile/`:**

1. `flutter pub add flutter_bloc equatable` **giải được**: `flutter_bloc 9.1.1`, `bloc 9.2.1`, `equatable 3.0.0`, `provider 6.1.5+1`. Không đổi package nào đang có.
2. Thêm `dev:bloc_test` thì **KHÔNG giải được**. `bloc_test` kéo package `test`. `flutter_test` của SDK ghim `test_api 0.7.6` và `matcher 0.12.17`, nên `test` chỉ lên được 1.26.x, mà bản này cần `analyzer < 9`. Trong khi đó `json_serializable 6.14.1` (dev, bộ sinh client 10.6) cần `analyzer >= 10`. Bản 6.15+ lại cần SDK 3.12.
3. **Hướng 1, hạ toolchain sinh client** (`json_annotation 4.9.0`, `json_serializable 6.11.2`, `retrofit 4.9.1`, `retrofit_generator 10.2.0`, `source_helper 1.3.8`, `build_runner 2.7.1`): giải được, `flutter analyze` sạch, nhưng **11 file client sinh đổi** (tải nhị phân thành `fetch<Uint8List>` thay vì stream `ResponseBody`) ⇒ **10 test API đỏ** (tải PDF hợp đồng/hoá đơn/báo giá, ảnh đính kèm, multipart). Đây là sửa tầng API, ngoài phạm vi BLoC ⇒ **loại**.
4. **Hướng 2, tách bộ sinh client ra package Dart riêng** (`swagger_parser`, `build_runner`, `retrofit_generator`, `json_serializable`, ghim `source_helper` chuyển sang một pubspec Dart thuần, không có `flutter_test`, **giữ nguyên version**): package sinh chạy `swagger_parser` + `build_runner` trên đúng bản spec dẫn xuất và ra **toàn bộ client giống từng byte** với `mobile/lib/api/generated` đang commit (`diff -rq` rỗng). Pubspec mobile bỏ 5 dev dep đó rồi thêm `flutter_bloc ^9.1.1`, `equatable ^3.0.0`, `dev bloc_test ^10.0.0` thì giải được (`bloc_test 10.0.0`, `test 1.26.2`). Runtime `dio 5.11.1`, `retrofit 4.10.0`, `json_annotation 4.12.0` giữ nguyên. `flutter analyze` sạch, `flutter test` **746/747**: ca duy nhất đỏ là `generated_client_drift_test.dart`, vì script sinh chưa trỏ sang package mới. Story 11.1 sửa ca này ⇒ **chọn hướng này** (mặc định §6.3).
5. Không cần `dependency_overrides`, không nâng Flutter.

---

## 2. Phân tích tác động

### 2.1. Checklist thay đổi (kết quả)

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| 1.1 Story kích hoạt | [x] | Không phải story; là H-4 (retro E10) do Đại Ca chốt 2026-10-23 |
| 1.2 Định nghĩa vấn đề | [x] | §1 |
| 1.3 Bằng chứng | [x] | §1, kèm probe phụ thuộc |
| 2.1 Epic hiện tại (E10) | [N/A] | Epic 10 `done`, không mở lại |
| 2.2 Thay đổi cấp epic | [x] | **Thêm Epic 11** |
| 2.3 Rà epic tương lai | [x] | E8, E9: nội dung story không đổi; thêm ghi chú "màn mobile dựng BLoC từ đầu"; đổi thứ tự (§2.2) |
| 2.4 Epic bị vô hiệu/epic mới | [x] | Không epic nào lỗi thời; Epic 11 mới |
| 2.5 Thứ tự epic | [x] | **E7 → E10 → E11 → E8 → E9** |
| 3.1 PRD | [x] | Không xung đột, không đổi FR, MVP giữ nguyên |
| 3.2 Architecture | [!]→[x] | Spine: AD-12 thêm "Luật state mobile"; Stack thêm dòng `flutter_bloc` (§4.4) |
| 3.3 UX | [N/A] | Không đổi màn, chữ, luồng. DESIGN/EXPERIENCE giữ nguyên |
| 3.4 Artifact khác | [x] | `project-context.md` (dòng kiến trúc mobile), `sprint-status.yaml`; 19 text-guard `design-system/screens/` sửa trong từng story |
| 4.1 Điều chỉnh trực tiếp | Viable | Chọn |
| 4.2 Rollback | Not viable | Không có gì để revert; đây là đổi khuôn trên code đang chạy |
| 4.3 Review MVP | Not viable | MVP không đổi |
| 4.4 Hướng chọn | [x] | Điều chỉnh trực tiếp: thêm epic |
| 5.x Thành phần proposal | [x] | §1–§5 |
| 6.1–6.2 Rà soát | [x] | |
| 6.3 Phê duyệt | [x] | Phê duyệt bằng quyết định gốc của Đại Ca (2026-10-23) + mặc định tuyên bố trước §6 |
| 6.4 sprint-status | [x] | §4.3 |
| 6.5 Bàn giao | [x] | §5 |

### 2.2. Tác động epic

- **Epic 7, Epic 10:** không đổi (đã `done`).
- **Epic 11 (mới):** 4 story, §4.1.
- **Epic 8:** nội dung story không đổi; **bắt đầu sau Epic 11**. Thêm ghi chú: màn mobile của Epic 8 (8.1 Trang chủ, 8.5 Audit qua Menu, và màn nào khác nếu có) dựng BLoC theo luật Epic 11 ngay từ đầu, nằm trong phạm vi guard "màn không gọi port".
- **Epic 9:** nội dung story không đổi; thêm cùng ghi chú (9.2 đăng ký token đi qua cubit phiên, 9.4 hộp thư in-app, 9.5 tuỳ chọn thông báo).

### 2.3. Tác động story

- **Không đánh số lại** story nào; mọi key trong `sprint-status.yaml` giữ nguyên.
- Story Epic 1–10 đã `done`: không mở lại. Màn của chúng được chuyển khuôn trong Epic 11 như một refactor riêng. Hành vi giữ nguyên, test widget hiện có là lưới an toàn.

### 2.4. Tác động kỹ thuật

- **Mobile:** thêm `flutter_bloc`, `equatable`, `bloc_test` (dev). Tách 5 dev dep sinh client sang `mobile/tool/codegen/` (package Dart riêng, có lock riêng). Thêm khoảng 19 cubit cho màn và 2 cubit cấp app (phiên, quyền). Sửa 19 file màn + `pns_app.dart` + `app_session.dart`. **Không đổi** port, adapter, transport, client sinh, `main.dart` (ngoài phần ráp cubit cấp app), router, route.
- **Design-system lane:** 19 text-guard đọc file màn mobile theo đường dẫn cứng phải đọc thêm file cubit/state của màn đó. Nếu không, assert phủ định (vd cấm số học tiền, cấm `AppPerm.`) sẽ **mù** với code vừa chuyển sang cubit.
- **Backend, web:** không đổi.
- **Test:** thêm `bloc_test` cho từng cubit; thêm guard "màn không gọi port"; test widget hiện có giữ nguyên finder/expect.
- **Triển khai:** không đổi.

---

## 3. Hướng đi đề xuất

**Chọn: Điều chỉnh trực tiếp. Thêm Epic 11 "Chuyển mobile sang BLoC", chạy giữa Epic 10 và Epic 8.**

- **Effort:** Trung bình (4 story; refactor thuần mobile ~9.300 dòng màn; 1 story nền + 3 story chuyển màn theo nhóm nghiệp vụ).
- **Rủi ro:** Trung bình–thấp.
  - (a) Màn lớn (`create_quote_screen.dart` 1.361 dòng, `order_detail_screen.dart` 1.050, `stock_vouchers_screen.dart` 1.046, `payment_schedule_screen.dart` 1.008) có luồng bất đồng bộ tinh vi: đọc lại im lặng, `reloadSignal`, future của màn con, pop-rồi-push. Đỡ bằng test widget hiện có, không đổi assert.
  - (b) Text-guard design-system mù khi code dời file. Đỡ bằng AC đột biến ở mọi story.
  - (c) `emit` sau `close` ném `StateError`. Các check `if (mounted)` hiện có phải đổi thành `isClosed`, có ca `bloc_test` cho phản hồi về muộn.
- **Timeline:** đẩy Epic 8 lùi đúng bằng Epic 11. Không đổi phạm vi Phase 1.
- **Phương án đã cân nhắc và loại:**
  - *Chuyển dần trong từng story Epic 8/9:* trái quyết định của Đại Ca ("chuyển hết trước Epic 8"); hai khuôn sống song song lâu.
  - *Một story cho cả 19 màn:* quá lớn cho một phiên dev; review không soát nổi.
  - *Bỏ `bloc_test`, test cubit bằng `flutter_test` trần:* trái quyết định của Đại Ca. Không cần, vì đã có hướng tách bộ sinh (§1 điểm 4).
  - *Hạ toolchain sinh client để `bloc_test` giải được:* làm 10 test API đỏ (§1 điểm 3).
  - *Nâng Flutter:* trái luật hiện hành "không nâng Flutter trong story" (10.6, 10.7); chưa kiểm được.

**Thứ tự nội bộ bắt buộc:** 11.1 (nền + guard + phiên + auth/menu) → 11.2 → 11.3 → 11.4 (guard khoá: allowlist rỗng). 11.2–11.4 không phụ thuộc nhau về code, nhưng solo dev chạy tuần tự để allowlist chỉ co lại.

**Action item retro E10 liên quan:**
- **H-4** → `done` (quyết định này).
- **H-5** (luật guard mới phải ship kèm mutant xoá thứ thật cần bảo vệ, cộng danh sách biến thể theo nền tảng): hạn hiện là "trước commit đầu 8.1". **Áp ngay cho guard mới của 11.1**, nên nên xong trước commit đầu 11.1. Không đổi tiêu chí H-5.
- H-1, H-2, H-6, H-7, G-2: không ảnh hưởng, giữ nguyên hạn.

---

## 4. Đề xuất thay đổi chi tiết

### 4.1. `epics.md`: thêm Epic 11 (4 story)

Chèn vào **Epic List** (sau Epic 10, trước Epic 8) và **Epic Details** (ngay trước `## Epic 8`), header ghi rõ **"chạy TRƯỚC Epic 8"**. FR Coverage Map thêm một dòng. Epic 8 và Epic 9 (cả Epic List lẫn Epic Details) thêm ghi chú BLoC. Tóm tắt:

| Story | Tiêu đề | Màn / phần chuyển | Kết quả kiểm được |
|---|---|---|---|
| 11.1 | Nền BLoC: dependency, guard màn không gọi port, phiên và màn đăng nhập | Dependency + tách bộ sinh; `PnsApp` (pha phiên) → `SessionCubit`; `PermissionsProvider` → `PermissionsCubit` (giữ API `PermissionsScope`); Đăng nhập, Quên mật khẩu, Menu | `flutter pub get` giải được, không override; client sinh giống từng byte; guard có allowlist tự kiểm; `bloc_test` cho 5 cubit; test widget hiện có xanh, không đổi assert |
| 11.2 | Chuyển BLoC màn khách hàng, bảo hành, hồ sơ | `customer_list`, `customer_detail`, `customer_pick`, `warranty_lookup`, `profile` (5 file) | Allowlist bớt 5 entry; text-guard `warranty-lookup`/`profile`/khách đọc cả file cubit |
| 11.3 | Chuyển BLoC màn đơn hàng và báo giá | `order_list`, `order_detail` (3 State), `order_status_change`, `discount_approval`, `create_quote` (5 file) | Allowlist bớt 5 entry; giữ `reloadSignal`, đọc lại im lặng, future màn con; 143 ca widget đơn xanh |
| 11.4 | Chuyển BLoC màn thanh toán, kho, hợp đồng, hoá đơn và khoá guard | `payment_schedule`, `inventory`, `stock_vouchers` (3 State), `contracts`, `invoices`, `invoice_detail` (6 file) | Allowlist **rỗng** và bị cấm thêm lại; 0 `StatefulWidget` gọi port trong `lib/screens/`; smoke trên emulator |

Ghi chú vào **Epic 8** và **Epic 9** (Epic List + đầu mục Epic Details):

```
NEW (thêm cuối đoạn mô tả):
**Mobile: BLoC từ đầu** (correct-course 2026-10-23): màn mobile của epic này dựng bằng Cubit/Bloc
theo luật Epic 11 (màn chỉ render state + gửi sự kiện; cubit nhận port qua constructor và là nơi
duy nhất gọi port; `bloc_test` cho logic); nằm trong guard "màn không gọi port". Chạy sau Epic 11.
```

### 4.2. Không có bảng đổi tên contract

Epic 11 không đổi contract API, route, permission key hay field. Mọi đổi tên chỉ ở **tên class Dart nội bộ của mobile** (cubit/state tiếng Anh, theo luật "code mới tiếng Anh").

### 4.3. `sprint-status.yaml`

```
OLD:
  epic-10-retrospective: done
  epic-8: backlog

NEW:
  epic-10-retrospective: done
  # Epic 11 chạy SAU Epic 10, TRƯỚC Epic 8 (correct-course 2026-10-23, sprint-change-proposal-2026-10-23.md)
  epic-11: backlog
  11-1-nen-bloc-dependency-guard-man-khong-goi-port-phien-va-man-dang-nhap: backlog
  11-2-chuyen-bloc-man-khach-hang-bao-hanh-ho-so: backlog
  11-3-chuyen-bloc-man-don-hang-va-bao-gia: backlog
  11-4-chuyen-bloc-man-thanh-toan-kho-hop-dong-hoa-don-va-khoa-guard: backlog
  epic-11-retrospective: optional
  epic-8: backlog
```

- **H-4** → `status: done`, resolution: "Đại Ca quyết 2026-10-23: BLoC bắt buộc (`flutter_bloc` + `bloc_test`), chuyển hết màn cũ trước Epic 8 (Epic 11). Xem sprint-change-proposal-2026-10-23.md." Mặc định cũ (giữ khuôn StatefulWidget) **bị thay thế**.
- `last_updated` → `2026-10-23 (correct-course, chèn Epic 11 BLoC trước Epic 8)` (không dùng dấu `:` trong giá trị YAML không quote). Dòng `story_location` giữ nguyên.

### 4.4. `ARCHITECTURE-SPINE.md`

1. **AD-12**: thêm đoạn **"Luật state mobile (correct-course 2026-10-23, Epic 11)"**:
   - OLD: không có luật state cho mobile; `project-context.md` ghi "KHÔNG dùng BLoC".
   - NEW: state của màn mobile do `flutter_bloc` quản. Màn (widget) chỉ **render state và gửi sự kiện** (gọi method cubit hoặc `add` event); **chỉ cubit/bloc gọi port**. Cubit nhận port **qua constructor**, port đi từ composition root `main.dart` → `AppPorts` → `PnsApp`/`SignedInApp` → widget màn → `BlocProvider(create: …)`. Không service locator, không bloc toàn cục. Cubit không gọi mạng trực tiếp (vẫn qua port → adapter → transport). Logic cubit test bằng `bloc_test`; guard "màn không gọi port" khoá luật này.
2. **Stack**: thêm dòng `flutter_bloc (Mobile state) | 9.1.1 (+ bloc 9.2.1, equatable 3.0.0; dev bloc_test 10.0.0)`. Ghi chú Flutter thật trên máy là 3.35.0 (dòng `Flutter 3.44` là bản kế hoạch, đã ghi lệch ở 10.6) và chỉ thêm vào cột version, không đổi version kế hoạch.
3. Frontmatter `updated` → `2026-10-23`.

### 4.5. `project-context.md`

Dòng "Kiến trúc code / Mobile" (dòng 64):

```
OLD:
Mobile = màn `StatefulWidget` + scope `InheritedWidget` (phiên, quyền, bottom-nav) + port/adapter ráp ở
`main.dart`; KHÔNG dùng BLoC (0 dependency bloc — … quyết định mở của Đại Ca trước Epic 9, retro Epic 10 H-4).

NEW:
Mobile = **BLoC bắt buộc** (`flutter_bloc` + `bloc_test`, Đại Ca chốt 2026-10-23, đóng H-4): màn chỉ render
state + gửi sự kiện, **chỉ cubit/bloc gọi port**; cubit nhận port qua constructor (từ `main.dart` → `AppPorts`
→ màn → `BlocProvider`); Cubit mặc định, Bloc khi cần event; state bất biến (`sealed`/`final class` +
`Equatable`). Màn cũ chuyển ở Epic 11 (trước Epic 8); tới khi 11.4 xong, màn trong allowlist của guard
vẫn là `StatefulWidget` gọi port. Scope `InheritedWidget` của design system (`AppPhoneFrameScope`,
`AppBottomNavScope`, `PermissionsScope` làm API đọc quyền) giữ nguyên.
```

Thêm ý vào mục **Testing**: "Mobile: logic cubit test bằng `bloc_test`; text-guard design-system đọc file màn mobile phải đọc cả file cubit/state của màn đó." Frontmatter `updated` → `2026-10-23`. Câu đếm "10 epic/79 story" đổi thành "11 epic/83 story".

### 4.6. PRD / UX

Không đổi.

---

## 5. Bàn giao triển khai

**Phạm vi: Moderate.**

| Vai trò | Trách nhiệm |
|---|---|
| Đại Ca (Project Lead) | Đọc §6; im lặng ⇒ mặc định thành quyết định. Push thủ công sau 5 lane xanh như hiện hành |
| Winston (Architect) | Giữ "Luật state mobile" trong spine AD-12; review 11.1 (story đặt khuôn) |
| Amelia (Dev) | H-5 trước commit đầu 11.1; `bmad-create-story` 11.1 → 11.4 qua story-automator |
| Story-automator | `parse-epic` thấy 4 story `11.x` (header `### Story 11.N:` dưới `## Epic 11:`) |

**Tiêu chí thành công của Epic 11:**
1. `grep -rl "extends StatefulWidget" mobile/lib/screens` chỉ còn những màn mà State giữ **thuần UI** (controller ô nhập, focus, cuộn, mở/đóng). Guard "màn không gọi port" xanh với allowlist rỗng.
2. Mọi cubit có `bloc_test`: trạng thái đầu, tải thành công, lỗi port → state lỗi đúng câu, phản hồi về sau `close` không ném.
3. ~357 ca widget ở `test/screens/` + `pns_app_test` + `signed_in_app_test` + `session_test` xanh, không đổi finder/expect.
4. 19 text-guard `design-system/screens/` + `permission-keys.test.mjs` xanh và đọc cả file cubit/state; mutant đưa mẫu bị cấm vào file cubit ⇒ ĐỎ.
5. `flutter analyze` sạch; 5 lane (backend, test:db, design-system, web, mobile) xanh; client sinh drift-guard xanh (giống từng byte).
6. Smoke trên emulator Android: đăng nhập → danh sách đơn → chi tiết → thanh toán → hợp đồng/hoá đơn → chia sẻ PDF, như smoke 10.8.

---

## 6. Mặc định tuyên bố trước (im lặng ⇒ thành quyết định)

1. **Số epic:** Epic **11** (không đánh số lại 8/9). Thứ tự chạy E7 → E10 → **E11** → E8 → E9.
2. **Version** (probe `flutter pub add` trên Flutter 3.35.0 / Dart 3.9.0, 2026-10-23): `flutter_bloc: ^9.1.1` (ra `bloc 9.2.1`, `provider 6.1.5+1`), `equatable: ^3.0.0`, dev `bloc_test: ^10.0.0` (ra `test 1.26.2`). **Không `dependency_overrides`, không nâng Flutter.** Không thêm `bloc_concurrency`, `hydrated_bloc`, `get_it`, `freezed`. Cần thêm package thì ghi lý do vào proposal này cùng commit (G-5).
3. **Bộ sinh client tách khỏi pubspec mobile:** `swagger_parser ^1.45.0`, `build_runner ^2.15.1`, `retrofit_generator ^10.3.2`, `json_serializable ^6.14.1` và ghim `source_helper: 1.3.13` chuyển sang package Dart thuần `mobile/tool/codegen/` (pubspec + lock riêng, cùng version, không `flutter_test`). Bỏ ghim khi SDK ≥ 3.12, như ghi chú cũ. `dart run tool/generate_api.dart` (lệnh không đổi) dựng spec dẫn xuất, chạy `swagger_parser` + `build_runner` trong package đó rồi ghi ra `mobile/lib/api/generated`. Client sinh phải **giống từng byte** (đã kiểm ở probe); drift test sửa theo đường dẫn mới, vẫn so từng byte. **Không hạ version toolchain** (§1 điểm 3). Runtime `dio`/`retrofit`/`json_annotation` giữ nguyên trong `mobile/pubspec.yaml`.
4. **Cubit hay Bloc:** **Cubit mặc định.** Chỉ dùng `Bloc` (event class) khi màn cần xử lý chuỗi sự kiện có thứ tự riêng mà Cubit làm rối, ví dụ tìm kiếm gõ-tới-đâu-lọc-tới-đó. Chọn Bloc thì ghi một dòng lý do trong Dev Notes.
5. **Mỗi màn một cubit.** Màn có nhiều route con (chi tiết đơn, phiếu kho) thì mỗi route con một cubit. Widget con nội bộ (sheet, dialog, dòng giỏ) dùng cubit của màn cha qua `context.read`, hoặc giữ State thuần UI. Không cubit dùng chung giữa hai màn, trừ 2 cubit cấp app (§6.8).
6. **Port vào cubit qua constructor.** Port đi từ composition root `main.dart` → `AppPorts` → `PnsApp`/`SignedInApp` → **constructor public của widget màn (giữ nguyên chữ ký)** → `BlocProvider(create: (_) => XCubit(port)..load())`. Không service locator, không bloc singleton, không `BlocProvider` toàn cục cho cubit màn. Lý do giữ chữ ký màn: `SignedInApp`, `order_routes_test` và ~357 ca widget đang dựng màn bằng constructor với fake port. Đổi chữ ký là phá lưới an toàn.
7. **State:** bất biến, `Equatable`. Pha khác hẳn nhau (đang tải / có dữ liệu / lỗi) dùng `sealed class` + `final class` con. Màn form nhiều field dùng một class state + `copyWith`. Lỗi port giữ **câu tiếng Việt đã map ở adapter** (không map lại trong cubit). `fieldErrors` giữ dạng map field → message đầu tiên như hiện tại.
8. **State cấp app:** `PnsApp` (pha phiên, đang đăng xuất, đếm lượt đăng nhập, `sessionExpired`) → `SessionCubit` nhận `AuthPort`. `PermissionsProvider` → `PermissionsCubit` nhận `MePort`, **dựng lại mỗi lần đăng nhập** (giữ hành vi "account thứ hai không dính quyền cũ"). **`PermissionsScope.of(context)` giữ làm API đọc quyền** cho `AppGate`/`filterNav`/`orderScope` (không sửa primitive gating). `SignedInApp` giữ router + 2 `reloadSignal` (hạ tầng điều hướng, không phải state màn). `AppPhoneFrameScope`, `AppBottomNavScope` giữ nguyên.
9. **State thuần UI được ở lại `State`:** `TextEditingController`, `FocusNode`, `ScrollController`, `AnimationController`, cờ mở/đóng phần UI không đi tới port. Mọi thứ đến từ port hoặc gửi tới port, cộng cờ đang tải/đang gửi/lỗi, nằm ở cubit. Widget gửi giá trị ô nhập vào cubit lúc submit.
10. **`if (mounted)` → `isClosed`:** cubit không `emit` sau `close`. Mỗi cubit có ca `bloc_test` cho "phản hồi port về sau khi đóng màn ⇒ không ném, không emit".
11. **Không đổi hành vi người dùng thấy:** chữ, bố cục, điều hướng, thứ tự và số lượng request, gating giữ nguyên. Ca nào lộ khác biệt thì sửa code về như cũ, không sửa test.
12. **Test widget hiện có là lưới an toàn:** file trong `test/screens/`, `test/app/`, `test/design_system/session_test.dart` **không đổi finder/expect/fake**. Chỉ được đổi phần dựng (thêm `pump`/`pumpAndSettle` khi cubit cần thêm một microtask), mỗi chỗ đổi ghi lý do trong Dev Notes. Logic chuyển sang cubit thì **thêm** ca `bloc_test` (không thay ca widget).
13. **Guard "màn không gọi port"** (`mobile/test/screens/no_port_call_in_screens_test.dart`, lane mobile): trong `mobile/lib/screens/**`, chỉ file `*_cubit.dart` / `*_bloc.dart` được gọi method trên port. Guard phải bắt các biến thể: `port.x(`, `widget.port.x(`, port tên khác (`ordersPort`, `inventoryPort`…), alias cục bộ (`final p = widget.port; p.x()`), tear-off (`widget.port.x` không ngoặc), `.call(`. Allowlist các màn chưa chuyển, **mỗi entry tự kiểm còn vi phạm** (màn đã sạch mà còn trong allowlist ⇒ ĐỎ, bắt xoá entry), allowlist co lại ở mỗi story và rỗng ở 11.4. **Chống guard rỗng:** assert số file màn quét được ≥ 20, và ít nhất một file cubit có lời gọi port. **Đột biến bắt buộc** (theo H-5): thêm lại một lời gọi port vào màn đã chuyển, mỗi biến thể một lần ⇒ ĐỎ.
14. **Text-guard design-system:** guard nào ở `design-system/screens/*.test.mjs` đọc file màn mobile thì đọc **file màn + mọi `*_cubit.dart`/`*_state.dart` cùng thư mục màn**, đổi trong cùng story với màn đó. Không nới regex, không xoá assert. Đột biến: đưa mẫu bị cấm (vd `AppPerm.`, phép tính trên field tiền) vào file cubit ⇒ ĐỎ.
15. **Đặt tên + vị trí:** cubit/state tiếng Anh, cạnh màn: `lib/screens/<area>/<screen>_cubit.dart` + `<screen>_state.dart` (vd `OrderListCubit`, `OrderListState`). Cubit cấp app ở `lib/app/` (`session_cubit.dart`) và `lib/design_system/session/` (`permissions_cubit.dart`). Comment đầu file "hand-authored — …" như hiện hành.
16. **Không đổi port/adapter/transport/client sinh/router/route.** Lỗi phát hiện ở tầng đó khi làm thì ghi TD, không sửa lẫn vào Epic 11.
17. **Smoke trên emulator** chạy ở 11.4, ghi vào Dev Agent Record như 10.8. Emulator không khởi động được thì ghi rõ lane chưa chạy và báo Đại Ca, không coi là đạt.
18. **Fake port** giữ nguyên cho test và demo.
19. **Màn mobile Epic 8/9:** dựng Cubit ngay từ đầu, không qua giai đoạn `StatefulWidget` gọi port; guard 11.4 (allowlist rỗng) tự chặn.
20. **H-4** đóng bằng quyết định này. **H-5** áp từ guard của 11.1 (§3).

## 7. Quyết định khi làm 11.1 (2026-10-23)

Chỉ ghi chỗ chi tiết hoá hoặc lệch §6.

1. **Bộ sinh (§6.3):** `mobile/tool/codegen/` giữ `swagger_parser.yaml` + `build.yaml` nguyên văn; `generate_api.dart` ghi spec dẫn xuất vào `tool/codegen/.dart_tool/pns_api/`, `dart pub get` ở đó nếu chưa có `package_config.json`, chạy `swagger_parser` + `build_runner` với cwd `tool/codegen`, copy `lib/api/generated` sang mobile rồi xoá `tool/codegen/lib`. Chạy trên máy: `git status --short mobile/lib/api/generated` rỗng. Drift test copy script + 4 file của package codegen (không copy `mobile/pubspec.*`), `dart pub get --offline` trong codegen temp, rồi vẫn `dart run tool/generate_api.dart` (không cần pubspec ở cwd). Thêm ca: 5 dev dep sinh vắng khỏi `mobile/pubspec.yaml`, có đủ (đúng constraint) trong `tool/codegen/pubspec.yaml`. Máy mới: chạy `dart pub get` trong `mobile/tool/codegen` một lần trước `flutter test` (drift test chạy `--offline`).
2. **Màn trả `bool` thay cờ one-shot:** `LoginCubit.submit` và `ForgotPasswordCubit.reset` trả `true` khi port nhận ⇒ màn gọi `onLoggedIn` / `onBackToLogin`. Giữ thứ tự cũ, không cần `BlocListener` + reset cờ.
3. **`MenuCubit` là `Cubit<bool>`** (một cờ đang-đăng-xuất, không file state). `LoginState` không có `copyWith`: mỗi lần emit dựng đủ state ⇒ bỏ một field là xoá lỗi. `ForgotPasswordState` có `copyWith` (giữ lỗi khi tick đếm ngược) và `withMessages` (thay cả hai lỗi).
4. **Hết phiên cần frame cùng nhịp (§6.11):** `emit` tới `BlocBuilder` qua microtask, nên khi tín hiệu `sessionExpired` bắn thì chưa có frame nào được lên lịch (setState cũ lên lịch ngay) ⇒ ca `pns_app_test` "session expiry…" (một `pump()`) đỏ. Sửa code, không sửa test: `PnsApp` bọc `BlocBuilder` trong `ListenableBuilder(listenable: sessionExpired)` để frame được lên lịch cùng nhịp tín hiệu. Đột biến gỡ lớp bọc ⇒ ca đó đỏ.
5. **Guard màn không gọi port (§6.13), phạm vi bổ sung:** `lib/app/pns_app.dart` và `lib/design_system/session/app_session.dart` cũng phải 0 lời gọi port, không allowlist. Allowlist 16 màn ghi story gỡ (11.2/11.3/11.4).
6. **Text-guard (§6.14), sửa ở review 11.1:** helper `design-system/lib/read-mobile-screen.mjs` nối file màn + **chỉ** `*_cubit.dart`/`*_state.dart`/`*_bloc.dart` **của chính màn đó** theo tên (§6.15: `login_screen.dart` ⇒ `login_*`; trùng nhiều tiền tố thì tên dài nhất thắng). Bản dev đọc mọi file logic cùng thư mục ⇒ guard login đọc cả `forgot_password_cubit.dart` ⇒ assert dương xanh giả (đột biến: xoá hết chữ "Quên mật khẩu" khỏi `login_screen.dart` ⇒ `login.test.mjs` vẫn 12/12 xanh vì comment của cubit quên mật khẩu). File logic không thuộc `*_screen.dart` nào cùng thư mục ⇒ helper **ném** (cubit đặt sai tên không trốn được mọi guard). Story 11.2–11.4 đặt tên cubit/state theo §6.15 là đủ.
7. **Guard màn không gọi port, gói port (review 11.1):** thành viên của biến kiểu `…Ports` (`ports.me.fetchMe()`, alias `final me = ports.me; me.fetchMe()`, tear-off) cũng tính là gọi port. Bản dev bỏ sót: chèn `ports.me.fetchMe();` vào `pns_app.dart` ⇒ guard vẫn xanh.
