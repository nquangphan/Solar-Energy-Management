---
baseline_commit: f05d0bb
---

# Story 1.8: App shell mobile — Topbar, Bottom-nav 5 tab + FAB, Phone frame

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên mobile**,
I want **khung app mobile chuẩn — `AppTopbar`, `AppBottomNav` (khoá cứng 5 tab + FAB), `PhoneFrame`, và một scaffold `AppMobileShell` lắp ba mảnh đó lại — dựng từ cùng `AppTokens` + `AppIcon` đã ship, phẳng "Viền nét", KHÔNG chứa business logic**,
so that **mọi màn mobile (Đăng nhập 1.11, Home/Đơn/Kho/Menu ở Epic 3–8) nằm trong MỘT shell nhất quán, được nhận ra là CÙNG màn với web — chỉ khác khung (phone frame vs browser chrome) và điều hướng (bottom-nav vs sidebar) (UX-DR-27) — và không dev nào tự đổi thứ tự/số lượng tab hay nhét logic điều hướng/nghiệp vụ vào shell**.

## Acceptance Criteria

1. **AC-1 — Topbar (UX-DR-14):** **Given** yêu cầu Topbar, **When** dựng `AppTopbar`, **Then** có nút **back** (viền `line` 1.5px, bo `radiusSm` = 8px, nền `surface`, `AppIcon('ic-chevron-left', 18)` màu `teal700`, `aria-label`/`Semantics` "Quay lại") + **tiêu đề** 15px/w800 letter-spacing `-.01em` cắt ellipsis 1 dòng (có **eyebrow micro** 10px/w800 letter-spacing `.1em` UPPERCASE màu `teal` **tuỳ chọn** phía trên) + **action phải** teal-700 (nhận **hoặc** text 12px/w800 **hoặc** `AppIcon` 15px, tuỳ chọn); nền `surface`, **viền dưới `ink` 1.5px**, padding 10/13, gap 10. Back và action **chỉ phát callback** (`onBack`/`onAction`) — KHÔNG tự điều hướng/pop.

2. **AC-2 — Bottom-nav khoá cứng 5 tab + FAB (UX-DR-15):** **Given** yêu cầu Bottom-nav, **When** dựng `AppBottomNav`, **Then** **khoá cứng đúng 5 tab theo thứ tự**: `Trang chủ`(`ic-home`) · `Đơn hàng`(`ic-orders`) · **➕`Tạo`(FAB, `ic-plus`)** · `Kho`(`ic-warehouse`) · `Menu`(`ic-menu`) — **danh sách tab là hằng nội bộ, KHÔNG nhận qua prop** (không thêm/bớt/đổi thứ tự được từ caller). FAB (vị trí giữa, index 2) = nút **tròn 46px nền `teal`**, **vành trắng 3px** + **ring `teal700` 1.5px**, **nhô lên `-22px`** tách khỏi thanh, dấu cộng `AppIcon('ic-plus', 22)` trắng; item thường: icon 22px (màu nghỉ `#A9BAB5`) + nhãn 9.5px/w700 (màu nghỉ `muted`), **tab active đổi chữ→`teal700` + icon→`teal`**; nền `surface`, **viền trên `ink` 1.5px**, padding ngang 2. Bấm tab/FAB **chỉ phát callback** (`onSelect(index)` / `onCreateQuote`) — shell KHÔNG tự đổi màn, KHÔNG chứa router. **And** shell hỗ trợ chế độ **không bottom-nav** (auth) — xem AC-4.

3. **AC-3 — Phone frame (UX-DR-17):** **Given** yêu cầu trình bày mobile, **When** dựng `PhoneFrame`, **Then** thân máy `#0C1512` **bo 40px** padding 9, kính (`glass`) **bo 32px cao 700px** nền `surface` clip nội dung, có **notch** (116×22, `#0C1512`, bo dưới 14px, canh giữa trên) + **status bar giả** (`sbar` cao 34, "9:41" trái / "5G · 82%" phải, 11.5px/w700). Body trong kính xếp dọc: (topbar cố định) → (vùng cuộn `pscroll` padding 12/13, co giãn) → (bottom-nav cố định). Rộng khung 330px (bọc `SizedBox`/`Center`, KHÔNG hardcode chặn responsive ngoài khung).

4. **AC-4 — Scaffold `AppMobileShell` + luồng xác thực không botnav:** **Given** một màn nghiệp vụ, **When** dùng `AppMobileShell(topbar?, body, bottomNav?)`, **Then** nó lắp topbar (nếu có) + body cuộn + bottom-nav (nếu có) **bên trong** `PhoneFrame`; **màn xác thực (Đăng nhập/Quên mật khẩu) truyền `bottomNav: null` → KHÔNG hiển thị bottom-nav** (UX-DR-15), topbar vẫn tuỳ chọn (Đăng nhập không topbar, Quên mật khẩu có topbar + action text "Đăng nhập"). Shell **KHÔNG quyết định** khi nào ẩn nav — caller quyết định bằng cách truyền/không truyền `bottomNav`.

5. **AC-5 — Viền nét + parity + không business logic:** **Given** phong cách "Viền nét" (UX-DR-4..13) và bất biến kiến trúc, **When** kiểm shell, **Then**: (a) **phẳng tuyệt đối** — CẤM `BoxShadow`, `elevation>0`, `Material(elevation:)`, gradient; **ngoại lệ DUY NHẤT được duyệt** là **ring FAB** (vành trắng 3px + ring `teal700` 1.5px, vẽ bằng **viền lồng nhau / 2 lớp `Container`**, hữu hạn 0 blur — cùng cơ chế ring `current` của `AppStepper` Story 1.7, DESIGN.md 217); (b) mọi màu/px lấy từ `AppTokens`/hằng chuẩn tắc **khớp mockup `all-screens.html` byte-cho-byte** (topbar/botnav/phone CSS 232–266), **KHÔNG hardcode hex ad-hoc** ngoài các literal shell chuẩn tắc (`#0C1512`, `#A9BAB5`); (c) shell **thuần trình bày** — KHÔNG gọi mạng, KHÔNG router, KHÔNG tính tiền/đổi trạng thái; chỉ phát ý định qua callback. Parity web (`AppTopbar`/`AppBottomNav`/`WebFrame` React) là **Story 1.9** — 1.8 chỉ cấp phía Flutter + guard theo mockup.

## Tasks / Subtasks

> **Naming convention (chốt — theo Story 1.7):** đặt **tiền tố `App`** cho MỌI widget shell (`AppTopbar`, `AppBottomNav`, `AppMobileShell`) để tránh đụng SDK Flutter/Material. Ngoại lệ đã có tiền lệ: `PhoneFrame` (không đụng tên Material, giữ tên trực diện như `dashed_rect` nội bộ) — **hoặc** đặt `AppPhoneFrame` cho nhất quán; **chọn `AppPhoneFrame`** để đồng bộ tiền tố. File Dart **snake_case**, class Dart **PascalCase**. Đặt shell ở **module riêng** `mobile/lib/design_system/shell/` (biên module mới, tách khỏi `components/` vốn là widget nội dung) + barrel `shell.dart`.

- [x] **Task 1 — `AppTopbar` (AC: 1, 5)**
  - [x] Tạo `mobile/lib/design_system/shell/app_topbar.dart` — class `AppTopbar extends StatelessWidget`.
  - [x] Prop: `{ required String title, String? eyebrow, VoidCallback? onBack, Widget? action, VoidCallback? onAction }`. `action` nhận Widget tuỳ ý (thường là `Text` teal700 12/w800 **hoặc** `AppIcon(size:15)`); nếu chỉ cần icon-only có thể thêm helper — nhưng **giữ tối giản**, action là slot Widget + `onAction` optional.
  - [x] Layout `Row` (gap 10, padding `EdgeInsets.symmetric(horizontal:13, vertical:10)`): nếu `onBack != null` → nút back `Container` 28×28 viền `line` 1.5px `radiusSm`, nền `surface`, `AppIcon('ic-chevron-left', 18, color: teal700)`, bọc `Semantics(button:true, label:'Quay lại')` + `GestureDetector`/`InkWell` gọi `onBack`; giữa = `Expanded` cột: nếu `eyebrow!=null` → `Text` micro-uppercase (10/w800 ls .1em `teal`) rồi `Text(title)` 15/w800 ls -.01em `maxLines:1 overflow:ellipsis`; phải = `action` (nếu có) bọc tap→`onAction`.
  - [x] Nền `surface`, **border-bottom** `ink` 1.5px: dùng `Container(decoration: BoxDecoration(color: surface, border: Border(bottom: BorderSide(color: ink, width: 1.5))))`. **KHÔNG** `AppBar` Material (tránh elevation/shadow mặc định).
  - [x] Eyebrow uppercase: **KHÔNG** `.toUpperCase()` ngầm — hiển thị đúng chuỗi caller truyền; style `letterSpacing` + hiển thị. (Mockup truyền sẵn chữ hoa; giữ nguyên để parity web.)

- [x] **Task 2 — `AppBottomNav` khoá cứng 5 tab + FAB (AC: 2, 5)**
  - [x] Tạo `mobile/lib/design_system/shell/app_bottom_nav.dart` — class `AppBottomNav extends StatelessWidget`.
  - [x] **Hằng nội bộ** (KHÔNG là prop): `const _tabs = [ (icon:'ic-home', label:'Trang chủ'), (icon:'ic-orders', label:'Đơn hàng'), FAB(index 2, 'ic-plus', label:'Tạo'), (icon:'ic-warehouse', label:'Kho'), (icon:'ic-menu', label:'Menu') ]`. Thứ tự + số lượng **cố định 5**.
  - [x] Prop: `{ required int activeIndex, ValueChanged<int>? onSelect, VoidCallback? onCreateQuote }`. `activeIndex` chỉ để tô active tab thường (0,1,3,4); index 2 là FAB.
  - [x] Layout `Row` (mỗi item `Expanded`, `crossAxisAlignment.end`), `Container` nền `surface`, **border-top** `ink` 1.5px, padding ngang 2. Item thường: cột (gap 2, padding `EdgeInsets.only(top:7, bottom:9)`) `AppIcon(icon, 22, color: active? teal : Color(0xFFA9BAB5))` + `Text(label, 9.5/w700, color: active? teal700 : muted)`; tap → `onSelect(i)`.
  - [x] **FAB (index 2):** cột: `Container` **46×46** hình tròn (`shape: BoxShape.circle`) nền `teal`, **border trắng 3px**, **ring `teal700` 1.5px** (bọc thêm 1 `Container` ngoài hình tròn `teal700` — 2 lớp viền lồng nhau, xem gotcha), `margin: EdgeInsets.only(top:-22, bottom:2)` (dùng `Transform.translate(offset: Offset(0,-22))` hoặc `Stack`/`OverflowBox` vì margin âm trong `Row` không nhô ra ngoài botnav — **xem gotcha "nhô FAB -22px"**), `AppIcon('ic-plus', 22, color: surface)`; nhãn `Text('Tạo', 9.5/w700, color: teal700)`; tap → `onCreateQuote`.
  - [x] **Guard số tab:** thêm `assert(_tabs.length == 5)` và **KHÔNG** thêm ctor cho phép truyền tabs. Đây là điểm test guard AC-2.

- [x] **Task 3 — `AppPhoneFrame` (AC: 3, 5)**
  - [x] Tạo `mobile/lib/design_system/shell/app_phone_frame.dart` — class `AppPhoneFrame extends StatelessWidget`.
  - [x] Prop: `{ required Widget child, String time = '9:41', String status = '5G · 82%' }`. (child = nội dung kính bên dưới status bar: thường là `AppMobileShell` body.)
  - [x] Thân: `Container` width **330**, nền `Color(0xFF0C1512)`, `borderRadius: 40`, padding `EdgeInsets.all(9)`.
  - [x] Kính: `ClipRRect(borderRadius: 32)` bọc `Container` height **700** nền `surface`, `Column`: (status bar) + `Expanded(child)`. **Notch:** dùng `Stack` — kính là lớp dưới, notch `Positioned(top:0, left/right canh giữa)` `Container` 116×22 nền `#0C1512` `borderRadius: only(bottomLeft:14, bottomRight:14)`.
  - [x] Status bar: `Container` height 34 padding ngang 18, `Row(spaceBetween)`: `Text(time, 11.5/w700)` · `Text(status, 10/w700)`.
  - [x] **KHÔNG** hardcode chặn responsive: bọc ngoài bằng `Center`/`SizedBox` để khung 330px canh giữa; caller có thể đặt trong `SingleChildScrollView` nếu cần.

- [x] **Task 4 — `AppMobileShell` scaffold + barrel (AC: 4)**
  - [x] Tạo `mobile/lib/design_system/shell/app_mobile_shell.dart` — class `AppMobileShell extends StatelessWidget`.
  - [x] Prop: `{ AppTopbar? topbar, required Widget body, AppBottomNav? bottomNav, EdgeInsets bodyPadding = const EdgeInsets.symmetric(horizontal:13, vertical:12) }`.
  - [x] Layout `Column`: nếu `topbar!=null` → topbar (cố định, không cuộn); giữa = `Expanded(child: SingleChildScrollView(padding: bodyPadding, child: body))` (mirror `.pscroll` co giãn cuộn); nếu `bottomNav!=null` → bottomNav (cố định dưới). **Auth = truyền `bottomNav: null`** → không render (AC-4, UX-DR-15).
  - [x] **KHÔNG** tự bọc `AppPhoneFrame` bên trong (giữ tách biệt: `AppMobileShell` là nội dung kính; caller/preview bọc `AppPhoneFrame(child: AppMobileShell(...))`). Ghi rõ trong docstring cách lắp: `AppPhoneFrame(child: AppMobileShell(topbar:..., body:..., bottomNav:...))`.
  - [x] Tạo barrel `mobile/lib/design_system/shell/shell.dart` export 4 class: `AppTopbar`, `AppBottomNav`, `AppPhoneFrame`, `AppMobileShell`. **KHÔNG** re-export tokens/icons/components (import trực tiếp, như `components.dart` Story 1.7).

- [x] **Task 5 — Test: render + hành vi + guard nguồn (AC: tất cả)**
  - [x] Tạo `mobile/test/design_system/shell_render_test.dart`: (a) `AppTopbar` render title + eyebrow (khi có) + back (khi `onBack`) + action; ellipsis khi title dài. (b) `AppBottomNav` render **đúng 5 item**, nhãn đúng thứ tự `Trang chủ/Đơn hàng/Tạo/Kho/Menu`, active index tô teal (tìm màu icon/text). (c) `AppPhoneFrame` render notch + status bar (time/status) + child; kính cao 700, thân bo 40. (d) `AppMobileShell` render topbar+body+bottomNav khi đủ; **KHÔNG** render bottom-nav khi `bottomNav:null`.
  - [x] Tạo `mobile/test/design_system/shell_behavior_test.dart`: (a) tap back → `onBack` bắn 1 lần. (b) tap action → `onAction`. (c) tap tab i (0/1/3/4) → `onSelect(i)`; tap FAB → `onCreateQuote` (KHÔNG bắn `onSelect`). (d) shell **không router/không side-effect**: bấm tab không tự đổi widget tree (chỉ callback).
  - [x] Tạo `mobile/test/design_system/shell_invariants_test.dart` (source-guard, theo mẫu Story 1.4/1.7 — đọc file .dart dạng text, strip comment, regex): (a) **CẤM `BoxShadow`/`elevation`/`gradient`/`Shadow(`** trong `shell/*.dart` **trừ** vùng ring FAB (cho phép comment `// ring FAB` + 2 viền lồng, nhưng CẤM `BoxShadow`); (b) **botnav khoá 5 tab** — `app_bottom_nav.dart` chứa đúng 5 nhãn chuẩn tắc + `assert(...length == 5)` + KHÔNG có param `List<...> tabs` trong ctor; (c) shell **KHÔNG import** `dart:io`/`http`/`dio`/router — regex chặn network/navigation import; (d) màu shell là `AppTokens.*` hoặc literal chuẩn tắc cho phép (`0xFF0C1512`, `0xFFA9BAB5`) — KHÔNG hex ad-hoc khác.
  - [x] Chạy `flutter analyze` (0 issue) + `flutter test` (toàn bộ pass, gồm 53 test Story 1.7 cũ — 0 regression).

- [x] **Task 6 — Parity guard theo mockup + cập nhật barrel/tài liệu (AC: 5)**
  - [x] Thêm khối kiểm parity shell vào bộ parity Node hiện có: tạo `design-system/components/shell-parity.test.mjs` (**hoặc** mở rộng `design-system/components/parity.test.mjs`) khẳng định hằng shell Flutter khớp mockup CSS chuẩn tắc: topbar border-bottom ink 1.5px, botnav border-top ink 1.5px + 5 tab, FAB 46px/margin-top -22/ring teal700, phone 330/bo 40/kính 700/bo 32/notch 116×22. **Nguồn chân lý = `all-screens.html` khối `<style>` 232–266** (khi xung đột: mockup thắng). *(Nếu chưa có web shell để so — Story 1.9 — thì guard so Flutter-với-mockup; khi 1.9 xong, mở rộng thành cross-platform.)*
  - [x] Ghi chú trong `shell.dart` docstring rằng parity web (`Story 1.9`) sẽ mirror đúng các hằng này.

## Dev Notes

### Bối cảnh & nguồn chân lý
- App nội bộ Phương Nam Solar, 3 client tách biệt; story này chỉ đụng **mobile Flutter**. Nguồn UI: `DESIGN.md` + mockup `all-screens.html` (**mockup thắng khi xung đột**), hành vi: `EXPERIENCE.md`. Kiến trúc: `ARCHITECTURE-SPINE.md` (AD-1..18).
- **Build-order design-system-first (AD-13):** app shell là tầng design-system, dựng TRƯỚC màn tính năng. Story 1.8 = shell mobile; Story 1.9 = shell web; Story 1.11 = màn Đăng nhập dùng shell để chứng minh.

### Phụ thuộc đã có (Story 1.1, 1.2, 1.7) — TÁI DÙNG, không dựng lại
- `mobile/lib/design_system/tokens/app_tokens.dart` → `AppTokens` (màu/spacing/radius/typography). Dùng: `teal`, `teal700`, `teal050`, `ink`, `muted`, `line`, `surface`, `radiusSm`(8), `radiusLg`(12), `borderWidth`(1.5). **KHÔNG** thêm token mới cho shell trừ khi thật cần; literal shell (`#0C1512`, `#A9BAB5`) là hằng chuẩn tắc không có trong bảng token → khai báo `const` cục bộ trong file shell + document "mirror mockup".
- `mobile/lib/design_system/icons/app_icons.dart` → widget `AppIcon(name, {size, color})` + `AppIcons.registry`. **Đã có sẵn** mọi icon cần: `ic-home`, `ic-orders`, `ic-plus`, `ic-warehouse`, `ic-menu`, `ic-chevron-left`. Dùng **name string**, KHÔNG IconData.
- Mẫu widget nền (Story 1.7) để bắt chước style: `components/card.dart` (Container + BoxDecoration + Border.all), `components/stepper.dart` (**cơ chế ring `current` = 2 lớp viền lồng, KHÔNG BoxShadow** — chép y hệt cho ring FAB), `components/button.dart` (slot `AppIcon`), `components/banner.dart` (border-side + tone). Đọc `stepper.dart` trước khi làm FAB ring.

### Vị trí file (module boundary)
- Shell là **biên module mới** → `mobile/lib/design_system/shell/` (song song `components/`, `icons/`, `tokens/`). File mới:
  - `shell/app_topbar.dart`, `shell/app_bottom_nav.dart`, `shell/app_phone_frame.dart`, `shell/app_mobile_shell.dart`, `shell/shell.dart` (barrel).
  - Test: `test/design_system/shell_render_test.dart`, `shell_behavior_test.dart`, `shell_invariants_test.dart`.
  - Parity Node: `design-system/components/shell-parity.test.mjs` (hoặc mở rộng file parity sẵn có).
- **KHÔNG** đụng `components/components.dart` barrel (shell tách riêng). **KHÔNG** sửa component Story 1.7.

### Spec chuẩn tắc (rút verbatim từ mockup `all-screens.html` 232–266) — khớp byte-cho-byte
```
.topbar    padding 10/13 · gap 10 · border-bottom 1.5px ink · bg #fff(surface)
.topbar-back  28×28 · border 1.5px line · radius 8(sm) · bg #fff · color teal-700 · icn 18
.topbar-title 15px/800 ls -.01em · 1 dòng ellipsis
.topbar-eyebrow 10px/800 ls .1em UPPERCASE · teal
.topbar-action 12px/800 · teal-700 (hoặc icn 15)
.botnav    border-top 1.5px ink · bg #fff · padding 0 2
.botnav-item flex1 · col · gap 2 · padding 7/0/9 · 9.5px/700 · color muted · icn 22 color #A9BAB5
.botnav-item.active color teal-700 · .active .icn color teal
.botnav-fab .fab 46×46 · margin-top -22 · mb 2 · circle · bg teal · border 3px #fff · ring 1.5px teal-700 · icn 22 #fff
.phone     w330 · bg #0C1512 · radius 40 · padding 9
.phone .glass radius 32 · overflow hidden · bg surface · h700 · col
.phone .notch top0 · center · 116×22 · bg #0C1512 · radius 0 0 14 14
.phone .sbar h34 · padding 0 18 · 11.5px/700 · spaceBetween ('9:41' | '5G · 82%')
.phone .pbody flex1 · col · bg bg
.pscroll   flex1 · overflow auto · padding 12/13
```
5 tab botnav (thứ tự khoá): `Trang chủ`(ic-home) · `Đơn hàng`(ic-orders) · `Tạo`(FAB ic-plus) · `Kho`(ic-warehouse) · `Menu`(ic-menu).

### Bất biến phải giữ (AD / UX-DR)
- **AD-13:** shell dùng lại token/icon/component đã ship; CẤM style ad-hoc (chỉ literal shell chuẩn tắc được phép).
- **UX-DR-15:** botnav **khoá cứng 5 tab** đúng thứ tự; auth **không** botnav; tab active đổi teal.
- **UX-DR-14/17:** topbar/phone-frame đúng spec trên.
- **Viền nét (UX-DR-4..13):** phẳng, 0 shadow; **ngoại lệ duy nhất = ring FAB** (2 lớp viền lồng, 0 blur — như ring stepper `current`).
- **Không business logic (AD-1/2/11):** shell thuần trình bày; điều hướng/nghiệp vụ do màn/router ở tầng trên; shell chỉ phát callback ý định. KHÔNG mạng, KHÔNG router, KHÔNG tính tiền/đổi trạng thái.

### Gotchas (từ Story 1.7 + đặc thù shell)
1. **Material tự thêm shadow:** KHÔNG dùng `AppBar`, `BottomNavigationBar`, `Scaffold` Material cho shell (chúng thêm elevation/shadow + hành vi mặc định). Dựng bằng `Container`/`Row`/`Column` thuần như component Story 1.7.
2. **Container không set đồng thời `color` + `decoration`:** đặt màu bên trong `BoxDecoration(color:)`.
3. **Ring FAB (-22px nhô ra + vành + ring):**
   - Vành trắng 3px + ring teal-700 1.5px = **2 `Container` tròn lồng nhau** (ngoài `teal700` → trong `#fff` 3px → lõi `teal`), **KHÔNG** `BoxShadow`. Chép cơ chế từ `stepper.dart` ring `current`.
   - **Nhô -22px:** `margin: EdgeInsets.only(top:-22)` trong `Row` **không** cho widget tràn ra ngoài biên botnav (Flutter clip theo layout). Dùng `Transform.translate(offset: Offset(0,-22))` để dịch hình FAB lên (không đổi layout), **hoặc** bọc botnav trong `Stack` với FAB `Positioned` + để `clipBehavior: Clip.none`. Ưu tiên `Transform.translate` cho đơn giản; đảm bảo vùng tap vẫn đúng (`Transform.translate` giữ hit-test tại vị trí dịch).
4. **Notch chồng lên kính:** dùng `Stack` (kính dưới, notch `Positioned` trên, `z` cao); `ClipRRect` kính TRƯỚC khi phủ notch để notch không bị bo mất.
5. **Parity test — hex Dart `0xFF...`:** khi so literal trong test Node/regex, **đọc thẳng** chuỗi `0xFF0C1512`, KHÔNG `.toUpperCase()` (bug đã gặp Story 1.7 làm hỏng match). Copy đúng nguyên văn.
6. **Eyebrow uppercase:** mockup truyền sẵn chữ hoa; hiển thị verbatim để parity web — KHÔNG ép `.toUpperCase()` trong widget.
7. **`flutter_lints`:** include path là `package:flutter_lints/flutter.yaml` (không phải `flutter_lints.yaml`) — đã cấu hình ở `analysis_options.yaml` Story 1.7, không đổi.

### Testing standards
- Bắt buộc test cho shell (dễ sai + là nền mọi màn): **render đúng spec**, **hành vi callback**, **guard bất biến source-level** (5 tab khoá, 0 shadow trừ ring FAB, 0 network/router import), **parity mockup**.
- Chạy `flutter analyze` (0 issue) + `flutter test` (0 regression với 53 test Story 1.7). Parity Node: `node --test design-system/...` (như bộ 92 test parity hiện có).
- Test host cho widget cần tap: bọc `MaterialApp`/`Directionality` như test Story 1.7 (xem `test/design_system/*` mẫu).

### Project Structure Notes
- Tuân cấu trúc `mobile/lib/design_system/{tokens,icons,components,shell}` — thêm `shell/` là biên tự nhiên, không phá cấu trúc. File kebab? — Dart dùng **snake_case** file, PascalCase class (đúng convention project-context). Không xung đột phát hiện.
- Không tạo `main.dart`/app runtime ở story này (shell là thư viện widget; wiring app thật ở màn Đăng nhập 1.11). Chỉ cấp widget + test.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8] — user story + AC (UX-DR-14/15/17).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Components] (242–244 topbar/botnav/phone) + khối `:root`/token (120–146).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html] — CSS 232–266 (spec chuẩn tắc) + markup 691–777 (topbar+pscroll+botnav trong phone), 532–545 (auth: topbar không botnav). **Nguồn thị giác duy nhất; mockup thắng khi xung đột.**
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md] — AD-1/2 (client không chứa business logic), AD-13 (design-system-first).
- [Source: _bmad-output/project-context.md] — stack (Flutter 3.44, Clean Arch + BLoC), Viền nét, không style ad-hoc.
- [Source: mobile/lib/design_system/components/stepper.dart] — cơ chế ring 2 lớp viền (chép cho FAB); [Source: mobile/lib/design_system/components/card.dart] — mẫu Container+Border.
- [Source: mobile/lib/design_system/icons/app_icons.dart] — `AppIcon` + registry (icon shell đã có sẵn).
- [Source: _bmad-output/implementation-artifacts/1-7-flutter-thu-vien-widget-tuong-duong-parity-component.md] — convention `App`-prefix, guard source-level, parity Node, gotchas.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- `const AppBottomNav(...)` không compile được khi để `assert(_tabs.length == 5)` trong constructor const (Dart cấm truy cập `.length` của List trong const expression — `const_eval_property_access`). Đã chuyển assert vào đầu `build()`; vẫn giữ constructor `const` cho caller và source-guard vẫn khớp regex `_tabs.length == 5`.

### Completion Notes List

- **Task 1 — AppTopbar:** `Container` phẳng, `Border(bottom: BorderSide(ink,1.5))`, KHÔNG `AppBar` Material. Back = `Semantics(button,label:'Quay lại')` + `GestureDetector` → `onBack`; title 15/w800 ls -.01em ellipsis 1 dòng; eyebrow 10/w800 ls .1em teal hiển thị verbatim (không ép `.toUpperCase()` — parity web). Action slot bọc `DefaultTextStyle`+`IconTheme` teal700 → nhận cả `Text` lẫn `AppIcon`, tap → `onAction`.
- **Task 2 — AppBottomNav:** `_tabs` là `const` nội bộ (5 tab khoá, KHÔNG có ctor nhận tabs). FAB (index 2) = ring 2 lớp `Container` lồng (teal700 1.5px → trắng 3px → lõi teal 46px, 0 blur — chép cơ chế ring `current` của stepper, KHÔNG `BoxShadow`), nhô `-22px` bằng `Transform.translate` (giữ hit-test). Tap tab thường → `onSelect(i)`; FAB → `onCreateQuote` (không bắn `onSelect`).
- **Task 3 — AppPhoneFrame:** thân 330 `#0C1512` bo 40 padding 9; kính `ClipRRect(32)` cao 700 nền surface, `Column`(status bar 34 + `Expanded(child)`); notch 116×22 `#0C1512` bo dưới 14 phủ trên kính bằng `Stack`(`Positioned`). Bọc `Center`/`SizedBox` — không chặn responsive.
- **Task 4 — AppMobileShell + barrel:** `Column`(topbar? cố định → `Expanded(SingleChildScrollView(bodyPadding, body))` → bottomNav? cố định). Auth truyền `bottomNav: null` → không render nav. KHÔNG tự bọc `AppPhoneFrame` (caller bọc). Barrel `shell.dart` export đúng 4 class, không re-export tokens/icons/components.
- **Task 5 — Test:** 3 file test mới (`shell_render_test`, `shell_behavior_test`, `shell_invariants_test`). `flutter analyze` = 0 issue; `flutter test` = **80 test pass** (53 test Story 1.7 + 27 test shell mới, 0 regression).
- **Task 6 — Parity mockup:** `design-system/components/shell-parity.test.mjs` khẳng định hằng shell Flutter khớp CSS mockup `all-screens.html` (topbar/botnav/phone). Full parity Node = **98 test pass** (92 cũ + 6 mới, 0 regression). Web shell (Story 1.9) sẽ mở rộng thành cross-platform.

### File List

**Mới (Flutter shell):**
- `mobile/lib/design_system/shell/app_topbar.dart`
- `mobile/lib/design_system/shell/app_bottom_nav.dart`
- `mobile/lib/design_system/shell/app_phone_frame.dart`
- `mobile/lib/design_system/shell/app_mobile_shell.dart`
- `mobile/lib/design_system/shell/shell.dart` (barrel)

**Mới (test):**
- `mobile/test/design_system/shell_render_test.dart`
- `mobile/test/design_system/shell_behavior_test.dart`
- `mobile/test/design_system/shell_invariants_test.dart`
- `design-system/components/shell-parity.test.mjs`

**Sửa:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-8 → in-progress → review)

## Change Log

- 2026-07-08 — Story 1.8 hoàn tất: cấp module shell mobile Flutter (`AppTopbar`, `AppBottomNav` khoá 5 tab + FAB, `AppPhoneFrame`, scaffold `AppMobileShell` + barrel), tất cả phẳng "Viền nét" (ngoại lệ duy nhất = ring FAB 2 lớp viền), thuần trình bày (chỉ phát callback, 0 router/network). Thêm test render + hành vi + source-guard bất biến (Flutter) và parity mockup (Node). analyze 0 issue, 80 Flutter test + 98 Node parity test pass, 0 regression. Trạng thái → review.
