---
baseline_commit: a14245bbec4998cfc54b3b3b47866d518afd2e38
---

# Story 1.11: Màn Đăng nhập dựng thật (demo design system)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người dùng nội bộ**,
I want **màn Đăng nhập dựng bằng chính design system (component + token đã ship ở Story 1.1–1.10)**,
so that **hệ thống chứng minh thư viện dùng được thật, không phải component treo kệ — "ship kèm 1 màn" (AD-13).**

## Acceptance Criteria

1. **Given** thư viện component/token đã có, **When** dựng màn Đăng nhập trên cả web và mobile, **Then** dùng Field `.field-lg`, Button `--primary --wide`, không style ad-hoc, có link "Quên mật khẩu" **And** màn xác thực không hiển thị bottom-nav/sidebar nav (UX-DR-9, UX-DR-15).
2. **Given** đây là bản demo UI (FR-22 phần giao diện), **When** người dùng nhập SĐT/email + mật khẩu, **Then** form validate rỗng/định dạng và hiển thị vùng lỗi bằng component Banner/field-error — logic xác thực thật nối ở Epic 2 (FR-22).
3. **Given** cả hai nền tảng, **When** so sánh màn Đăng nhập, **Then** nhận ra là cùng một màn (parity), khác khung + điều hướng (UX-DR-27).

## Tasks / Subtasks

- [x] **Task 1 — Web: LoginScreen React từ component có sẵn (AC: 1, 2)**
  - [x] Tạo `web/src/screens/auth/LoginScreen.tsx` (biên module MỚI `screens/` — màn là CONSUMER của design-system, KHÔNG nằm trong `design-system/`).
  - [x] Bố cục thẻ căn giữa theo mockup `s-login` (web): brand lockup (`<Icon name="ic-sun"/>` trong ô 44px viền teal bo 11px + "Phương Nam Solar" + subtitle "App quản lý nội bộ · Phase 1"), rồi 2 `Field` `size="lg"` (nhãn "Tài khoản" placeholder "Số điện thoại hoặc email"; nhãn "Mật khẩu" `type="password"` placeholder "Nhập mật khẩu"), rồi `Button variant="primary" size="wide"` nhãn "Đăng nhập", rồi link "Quên mật khẩu?".
  - [x] Bọc trong `WebShell url="app.phuongnamsolar.vn/dang-nhap" sidebar={null}` (slot `sidebar` để `null` cho màn xác thực — comment `WebShell.tsx` đã ghi rõ). KHÔNG dùng `Sidebar`/`Topbar`.
  - [x] Card dùng component `Card` (nền trắng + viền line + bo lg) — KHÔNG tự vẽ box.
  - [x] Link "Quên mật khẩu?" là `<a>`/`<button>` presentational (màn `s-forgot` = Story 2.8; ở đây chỉ là link, KHÔNG điều hướng thật — chưa có router, AD-1/2).
  - [x] Layout wrapper (căn giữa, brand lockup) chỉ dùng token CSS var (`--teal`, `--muted`, `--radius-lg`, spacing token) qua một `web/src/screens/auth/login.css` mỏng; KHÔNG hardcode hex/px trang trí, KHÔNG drop-shadow/gradient (Viền nét, UX-DR-4).

- [x] **Task 2 — Web: validate presentational (rỗng/định dạng) + vùng lỗi (AC: 2)**
  - [x] State cục bộ (`useState`) giữ giá trị 2 field + thông báo lỗi; KHÔNG gọi mạng, KHÔNG auth thật (Epic 2).
  - [x] Khi submit: nếu tài khoản/mật khẩu rỗng → hiện `Banner tone="danger"` phía trên form với câu Việt ngắn (vd "Nhập đủ tài khoản và mật khẩu."); validate định dạng tối thiểu (tài khoản không rỗng, có thể check pattern SĐT/email cơ bản).
  - [x] Banner có `role="alert"`/aria-live để accessibility floor (Story 1.10) — nếu Banner đã có, chỉ dùng lại; KHÔNG tự chế vùng lỗi.
  - [x] Comment rõ: "Demo UI — logic xác thực thật (JWT access+refresh) nối ở Story 2.3; đây chỉ validate trình bày."

- [x] **Task 3 — Mobile: LoginScreen Flutter tương đương (AC: 1, 2, 3)**
  - [x] Tạo `mobile/lib/screens/auth/login_screen.dart` (biên MỚI `screens/`, snake_case; class `LoginScreen`). Presentational `StatefulWidget` (giữ text 2 field + lỗi cục bộ); KHÔNG BLoC/repository/mạng (backend = Epic 2).
  - [x] Bố cục form toàn màn hình theo mockup `s-login` (mobile): brand lockup (`AppIcon('ic-sun', ...)` ô 56px viền teal bo 14px + "Phương Nam Solar" + subtitle "Đăng nhập để bắt đầu ca làm"), 2 `AppField size: AppFieldSize.large` (label "Tài khoản"/"Mật khẩu"), `AppButton variant: AppButtonVariant.primary, wide: true` nhãn "Đăng nhập", link "Quên mật khẩu?".
  - [x] Bọc trong `AppPhoneFrame(child: ...)` TRỰC TIẾP — KHÔNG dùng `AppMobileShell` (nó thêm topbar + bottom-nav). Màn xác thực không topbar/bottom-nav (UX-DR-15).
  - [x] Validate rỗng cục bộ → hiện `AppBanner` tone danger trên form (cùng câu Việt như web để parity nhãn).
  - [x] Dùng đúng token/`AppField`/`AppButton`/`AppCard`/`AppBanner`/`AppIcon` — KHÔNG style ad-hoc, không shadow.

- [x] **Task 4 — Source-guard + parity test (AC: 1, 3)**
  - [x] Tạo `design-system/screens/login.test.mjs` (thư mục test MỚI `screens/`; runner glob `**/*.test.mjs` nhặt tự động).
  - [x] Assert **compose từ design-system** (web): `LoginScreen.tsx` import `Field`, `Button`, `Card`, `Banner`, `Icon` từ design-system; chuỗi `field-lg`/`size="lg"`, `variant="primary"`, `size="wide"` xuất hiện.
  - [x] Assert **no-nav auth** (web): `LoginScreen.tsx` KHÔNG import/dùng `Sidebar`; nếu dùng `WebShell` thì `sidebar={null}`. (mobile): `login_screen.dart` KHÔNG import `app_mobile_shell.dart`/`AppBottomNav`/`AppTopbar`.
  - [x] Assert **parity coverage**: tồn tại cả `web/src/screens/auth/LoginScreen.tsx` và `mobile/lib/screens/auth/login_screen.dart`; cả hai chứa nhãn Việt byte-identical: "Đăng nhập", "Tài khoản", "Mật khẩu", "Quên mật khẩu", "Phương Nam Solar", "Số điện thoại hoặc email", "Nhập mật khẩu".
  - [x] Assert **có link Quên mật khẩu** trên cả hai (chuỗi "Quên mật khẩu").
  - [x] Assert **no ad-hoc style / Viền nét**: `login.css` (nếu có) KHÔNG chứa `box-shadow`/`gradient`; `login_screen.dart` KHÔNG chứa `BoxShadow`/`elevation`.

- [x] **Task 5 — Flutter widget test (AC: 1, 2)**
  - [x] Tạo `mobile/test/screens/auth/login_screen_test.dart`: pump `LoginScreen`, assert render 2 `AppField` + `AppButton` "Đăng nhập" + text "Phương Nam Solar" + link "Quên mật khẩu"; assert submit rỗng → `AppBanner` lỗi hiện.
  - [x] Assert KHÔNG có `AppBottomNav`/`AppTopbar` trong cây widget (find.byType trả về nothing).

- [x] **Task 6 — Chạy test & tự-kiểm 0 regression (AC: 1, 2, 3)**
  - [x] `cd design-system && node --test "**/*.test.mjs"` → toàn bộ pass, **0 regression** với 140 test Story 1.10.
  - [x] Mobile: nếu `flutter test`/`dart analyze` chạy được → chạy cho file mới (`login_screen.dart` + test); nếu môi trường không có Flutter SDK → ghi rõ trong Completion Notes và dựa vào source-guard (như tiền lệ web).
  - [x] Cập nhật `_bmad-output/implementation-artifacts/tests/test-summary.md` (nếu có mẫu) với tổng test mới.

## Dev Notes

### Bối cảnh & nguồn chân lý
- App nội bộ Phương Nam Solar, 3 client tách biệt. Story này đụng **web React + mobile Flutter** (tầng MÀN, tiêu thụ design-system chung; KHÔNG đụng backend — chưa có). Nguồn UI/hành vi: `DESIGN.md` (token/Viền nét, `.field-lg`/`.btn--wide`), `EXPERIENCE.md` (§Xác thực: `s-login`/`s-forgot`; §Điều hướng: màn xác thực không bottom-nav/sidebar), mockup `all-screens.html` (`#s-login`). Kiến trúc: `ARCHITECTURE-SPINE.md` (AD-13 design-system-first, AD-1/2 client không business logic).
- **Đây là màn CUỐI của Epic 1** — chốt "ship kèm 1 màn, không phải thư viện treo kệ" (AD-13). Story 1.10 (done) đã ghi rõ: "1.11 = màn Đăng nhập dùng shell + demo" và cố ý **CHỪA** app-entry/router/màn cho story này.
- **UI-only, xác thực thật ở Epic 2:** FR-22 phần **giao diện** thuộc Epic 1; JWT access+refresh + `/me` gating thật thuộc Epic 2 (Story 2.3 / 2.6). Ở đây validate chỉ là **trình bày** (rỗng/định dạng → Banner), KHÔNG mạng, KHÔNG token, KHÔNG router. Màn "Quên mật khẩu" (`s-forgot`) = **Story 2.8** — 1.11 chỉ có **link**, KHÔNG dựng màn đó.

### Phụ thuộc đã có — TÁI DÙNG, KHÔNG dựng lại (scout-before-code)
- **Field (Story 1.3):** `web/src/design-system/components/Field.tsx` — `<Field label size="lg" .../>` render `.fgroup > .flabel + .field.field-lg`, tự link `htmlFor/id` (a11y). Mobile: `mobile/lib/design_system/components/field.dart` — `AppField(label, size: AppFieldSize.large, controller/onChanged, placeholder, keyboardType, semanticsLabel)`. **Mật khẩu web:** `<Field type="password"/>` (…rest chảy vào `<input>`). **Mật khẩu mobile:** `AppField` HIỆN chưa có `obscureText` — nếu cần che mật khẩu, thêm prop `obscureText` **surgical** vào `AppField` (mở rộng nhỏ, giữ parity với web `type="password"`) hoặc dùng placeholder che; ưu tiên thêm `obscureText` để đúng hành vi. Cập nhật parity test tương ứng.
- **Button (Story 1.3):** `Button variant="primary" size="wide"` → `.btn.btn--primary.btn--wide` (nền teal, chữ trắng, full-width). Mobile: `AppButton(variant: AppButtonVariant.primary, wide: true, label: 'Đăng nhập', onPressed: ...)`. A11y floor ≥44px/48dp đã nằm trong Button/AppButton (Story 1.10) — KHÔNG tự set min-height.
- **Card (Story 1.3):** thẻ trắng + viền line + bo lg cho web card đăng nhập; mobile `AppCard`.
- **Banner (Story 1.5):** `Banner tone="danger"` + icon SVG cho vùng lỗi; mobile `AppBanner`. **KHÔNG tự chế vùng lỗi** — dùng Banner (đã có aria/semantic).
- **Icon (Story 1.2):** `<Icon name="ic-sun" size={22}/>` (web), `AppIcon('ic-sun', size: ..., color: AppTokens.teal)` (mobile). `ic-sun` có trong tập icon canonical (Story 1.2). Màu icon THỪA KẾ `currentColor` (web) — set màu teal ở ancestor.
- **Shell (Story 1.8/1.9):**
  - Web `WebShell` (`shell/WebShell.tsx`) đã có slot `sidebar?: ReactNode` — comment: *"pass a `<Sidebar/>` for office screens, or `null` for auth screens (Đăng nhập / Quên mật khẩu) so no nav renders"*. **Dùng `sidebar={null}`.** `WebFrame` cho faux browser chrome + url pill (display-only, không navigate).
  - Mobile `AppPhoneFrame` (`shell/app_phone_frame.dart`) bọc `child` TRỰC TIẾP (dark body + notch + status bar giả). **KHÔNG dùng `AppMobileShell`** (nó ghép topbar + bottom-nav). Auth = phone frame + form, không topbar/bottom-nav.
- **Token (Story 1.1):** dùng biến token cho mọi màu/spacing/radius trong layout wrapper. KHÔNG hardcode hex.

### Vị trí file (module boundary)
- **Web (mới):**
  - `web/src/screens/auth/LoginScreen.tsx` — biên `screens/` MỚI (màn tiêu thụ design-system; KHÔNG đặt trong `design-system/`).
  - `web/src/screens/auth/login.css` (nếu cần layout wrapper) — mỏng, chỉ dùng token var; KHÔNG box-shadow/gradient. Load SAU `tokens.css`/`components.css`/`shell.css` (theo contract barrel Story 1.3/1.9).
- **Mobile (mới):**
  - `mobile/lib/screens/auth/login_screen.dart` — class `LoginScreen` (`StatefulWidget` presentational).
- **Mobile (sửa nhỏ, tùy chọn):** `mobile/lib/design_system/components/field.dart` — thêm prop `obscureText` (parity với web `type="password"`) nếu chọn hướng này. Surgical, giữ mọi test cũ pass.
- **Test (mới):**
  - `design-system/screens/login.test.mjs` — source-guard + parity (Node text-test).
  - `mobile/test/screens/auth/login_screen_test.dart` — Flutter widget test.
- **KHÔNG:** tạo router/navigation thật, gọi mạng, auth logic, state management toàn cục, BLoC cho màn này (backend + auth = Epic 2). KHÔNG dựng màn `s-forgot` (Story 2.8). KHÔNG sửa màu/viền/size của design-system component.

### Spec chuẩn tắc (mockup `#s-login` + UX-DR-9/15/27)
```
WEB (thẻ căn giữa trong WebFrame, KHÔNG sidebar):
  WebShell(url="app.phuongnamsolar.vn/dang-nhap", sidebar=null)
    web-app căn giữa, nền bg
      Card (width ~360, padding ~28/26)
        brand lockup: ô 44px viền teal 1.5px bo 11px > Icon ic-sun teal;
                      "Phương Nam Solar" (17px/900); "App quản lý nội bộ · Phase 1" (11px muted)
        Field label="Tài khoản"  size=lg  placeholder="Số điện thoại hoặc email"
        Field label="Mật khẩu"   size=lg  type=password placeholder="Nhập mật khẩu"
        Button primary wide "Đăng nhập"
        link teal-700 "Quên mật khẩu?"

MOBILE (form toàn màn trong AppPhoneFrame, KHÔNG topbar/bottom-nav):
  AppPhoneFrame(child:
    scroll căn giữa dọc, padding ~22/18
      brand lockup: ô 56px viền teal bo 14px > AppIcon ic-sun; "Phương Nam Solar" (19px/900);
                    "Đăng nhập để bắt đầu ca làm" (11.5px muted)
      AppField label "Tài khoản"  large
      AppField label "Mật khẩu"   large  (obscureText)
      AppButton primary wide "Đăng nhập"
      link teal-700 "Quên mật khẩu?"
  )

VALIDATE (AC-2, presentational): submit rỗng/định dạng sai → Banner danger + câu Việt ngắn.
  KHÔNG auth thật, KHÔNG token, KHÔNG mạng — nối Epic 2 (Story 2.3).

PARITY (UX-DR-27): cùng một màn web↔mobile — chỉ khác khung (browser chrome vs phone frame)
  và điều hướng (không có, cả hai đều auth). Nhãn Việt byte-identical hai bên.
```

### Bất biến phải giữ (AD / UX-DR)
- **AD-13 (design-system-first, cấm style ad-hoc):** MỌI phần tử dùng lại component/token đã ship. Layout wrapper chỉ được dùng token var + flex/grid; KHÔNG hardcode màu trang trí, KHÔNG shadow/gradient (Viền nét, UX-DR-4). Đây là điểm chấm của cả Epic 1 — nếu màn này phải "vá" style ngoài design-system thì design-system chưa đủ; báo lại thay vì ad-hoc.
- **AD-1/2 (client không business logic):** màn chỉ trình bày + validate rỗng cục bộ. KHÔNG router, KHÔNG mạng, KHÔNG tính toán nghiệp vụ. Link "Đăng nhập"/"Quên mật khẩu" KHÔNG điều hướng thật (chưa có router).
- **UX-DR-15 (màn xác thực không nav):** web `sidebar={null}`; mobile KHÔNG `AppMobileShell`/topbar/bottom-nav. Test source-guard chặn regression.
- **UX-DR-9 (Field `.field-lg` cho form đăng nhập):** bắt buộc `size="lg"`/`AppFieldSize.large`.
- **UX-DR-27 (parity):** web↔mobile cùng màn; nhãn Việt trùng byte-for-byte (test parity).
- **FR-22 (login là UI ở Epic 1, auth thật Epic 2):** không lén cài auth/JWT ở đây.

### Gotchas (từ Story 1.3–1.10 + đặc thù màn đăng nhập)
1. **"Ship kèm 1 màn" = màn PHẢI compose từ design-system, KHÔNG vẽ lại:** mỗi khối (input, nút, thẻ, banner, icon) là component có sẵn. Nếu thấy mình viết `<input>`/`<button>` trần hay `TextField`/`Container` nút thủ công → SAI, dùng `Field`/`Button`/`AppField`/`AppButton`.
2. **Auth screen = KHÔNG nav (điểm sai kinh điển):** đừng nhét `Sidebar`/`AppMobileShell`/topbar/bottom-nav "cho giống app". Mockup `s-login` cố ý trống nav. Web `WebShell sidebar={null}`, mobile `AppPhoneFrame` trực tiếp.
3. **Không auth thật:** đừng gọi API, đừng lưu token, đừng dựng AuthContext/BLoC auth. Validate chỉ rỗng/định dạng → Banner. Real login = Story 2.3. Comment rõ để dev Epic 2 biết chỗ nối.
4. **Mật khẩu che (obscure) parity:** web `type="password"` che sẵn; mobile `AppField` chưa có `obscureText`. Chọn: (a) thêm prop `obscureText` vào `AppField` (đúng nhất, giữ parity) — nhớ cập nhật test field cũ + parity; hoặc (b) tối thiểu placeholder. Ưu tiên (a). Đừng tự dựng `TextField` riêng ngoài `AppField`.
5. **Layout wrapper KHÔNG phải "component mới":** brand lockup + căn giữa là **composition cấp màn**, không thêm vào `design-system/`. Nhưng vẫn dùng token var, KHÔNG hex/px trang trí ad-hoc. Nếu logo lockup dùng lại nhiều màn sau → tách component ở story sau, KHÔNG phải bây giờ (YAGNI).
6. **Web chưa có React runtime/tsc/router:** `web/` chỉ có `src/`, KHÔNG `package.json`/bundler. Màn là **source `.tsx` guard bằng Node text-test** (như Story 1.3–1.10). KHÔNG thêm test runner/transpile/router (YAGNI). Correctness runtime nối khi có build (Epic 2+). Ghi giới hạn này trong Completion Notes.
7. **Parity nhãn Việt byte-for-byte:** "Đăng nhập", "Tài khoản", "Mật khẩu", "Quên mật khẩu", "Phương Nam Solar", "Số điện thoại hoặc email", "Nhập mật khẩu" phải TRÙNG hai bên (diacritics/casing dễ drift). Test parity assert cả hai file chứa đúng chuỗi.
8. **Banner cho lỗi, KHÔNG glow field:** Field cố ý KHÔNG có glow/ring (Viền nét). Vùng lỗi dùng `Banner tone="danger"` (có aria-live) — không tô đỏ viền field kiểu glow. Nếu muốn đánh dấu field lỗi, đổi viền sang danger token (không shadow), tùy chọn.
9. **Không phá parity byte-for-byte của shell:** dùng `WebFrame`/`WebShell`/`AppPhoneFrame` NGUYÊN — không sửa `shell.css`/frame widget. A11y floor (`a11y.css`) load sau như contract Story 1.10.
10. **Flutter SDK có thể vắng trong CI:** nếu `flutter test` không chạy được trong môi trường, source-guard (`login.test.mjs`) vẫn là lưới an toàn chính; ghi rõ trạng thái chạy được/không trong Completion Notes (như Story 1.9/1.10 đã làm cho web).

### Testing standards
- **Web:** không React runtime/tsc — guard bằng **Node text-test** (`design-system/**/*.test.mjs`, chạy `node --test`). Mẫu: `components.test.mjs` (source-guard), `parity.test.mjs`/`shell-parity.test.mjs` (cross-platform), `shell-web.test.mjs` (compose/import guard).
- **Mobile:** thêm **Flutter widget test** (`mobile/test/screens/auth/login_screen_test.dart`) theo mẫu `mobile/test/design_system/shell_render_test.dart` / `components_render_test.dart`. Nếu SDK có → chạy; nếu không → source-guard gánh.
- **Bắt buộc test:** (a) màn compose từ design-system (import Field/Button/Card/Banner/Icon; có `field-lg`/`primary`/`wide`); (b) auth no-nav (không Sidebar/AppMobileShell/topbar/bottom-nav); (c) parity nhãn Việt + tồn tại cả hai file; (d) có link Quên mật khẩu; (e) Viền nét (không shadow/gradient/elevation); (f) validate rỗng → Banner (widget test).
- Chạy `cd design-system && node --test "**/*.test.mjs"` → **0 regression** với 140 test Story 1.10.

### Project Structure Notes
- **Biên module MỚI `screens/`** (web `web/src/screens/auth/`, mobile `mobile/lib/screens/auth/`) song song `design-system/` — đúng tách bạch: design-system = thư viện, screens = màn tiêu thụ. Đây là màn đầu tiên; đặt nền cho Epic 2+ (Trang chủ, Đơn hàng…). Không phá cấu trúc hiện có.
- **Naming:** web `PascalCase.tsx` (`LoginScreen.tsx`) + CSS kebab (`login.css`); Flutter `snake_case` (`login_screen.dart`), class `LoginScreen`. Theo tiền lệ Story 1.3–1.10 + project-context (file/route kebab, entity PascalCase, Flutter snake_case).
- **Test dir MỚI `design-system/screens/`** — runner glob `**/*.test.mjs` (từ `design-system/package.json`) tự nhặt; không cần đổi cấu hình.
- Sửa `AppField` (nếu thêm `obscureText`) là **surgical, đúng scope** — không refactor phần khác; test field cũ phải pass.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.11] — user story + 3 AC (UX-DR-9/15/27, FR-22).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — "màn Đăng nhập dựng thật để chứng minh design system dùng được. Ship kèm 1 màn, không phải thư viện treo kệ" (AD-13).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Field/Button] — `.field-lg` cho form đăng nhập (dòng 237), `.btn--wide` full width (dòng 234).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md] — §Xác thực (`s-login`/`s-forgot`, dòng 27–29); §Điều hướng "Màn xác thực (Đăng nhập, Quên MK) không có bottom nav" (dòng 53).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-login] — markup web thẻ căn giữa (408–445) + mobile form phone frame (447–478); `.field-lg{padding:13px 14px;font-size:15px}` (dòng 86).
- [Source: web/src/design-system/shell/WebShell.tsx] — slot `sidebar` để `null` cho màn xác thực (comment 5–8); `WebFrame` faux browser chrome.
- [Source: mobile/lib/design_system/shell/app_phone_frame.dart] — `AppPhoneFrame(child)` bọc trực tiếp, không topbar/bottom-nav; `shell.dart` barrel (dùng phone frame, KHÔNG `AppMobileShell`).
- [Source: web/src/design-system/components/Field.tsx + Button.tsx] — API `Field size="lg" type="password"`, `Button variant="primary" size="wide"`.
- [Source: mobile/lib/design_system/components/field.dart + button.dart] — `AppField(size: AppFieldSize.large)` (chưa có `obscureText` → cân nhắc thêm), `AppButton(variant: primary, wide: true)`.
- [Source: web/src/design-system/components/Banner.tsx + icons/Icon.tsx] — `Banner tone="danger"` cho vùng lỗi; `Icon name="ic-sun"`.
- [Source: design-system/components/parity.test.mjs + shell-web.test.mjs] — mẫu parity cross-platform + compose/import source-guard.
- [Source: _bmad-output/implementation-artifacts/1-10-primitive-gating-theo-quyen-accessibility-floor-parity.md] — tiền lệ: "1.11 = màn Đăng nhập dùng shell + demo", convention testing text-guard khi chưa có runtime, no-router, module boundary, 140 test baseline.
- [Source: _bmad-output/project-context.md] — AD-13 (design-system-first, cấm ad-hoc), AD-1/2 (client không business logic), Viền nét, scout-before-code, stack (React 19.2.7 / Flutter 3.44).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8, 1M context)

### Debug Log References

- `cd design-system && node --test "**/*.test.mjs"` → tests 148 · pass 148 · fail 0 (baseline 140 + 8 mới, 0 regression).
- `cd mobile && flutter test` → +93 · All tests passed (baseline 90 + 3 widget test mới).
- `cd mobile && flutter analyze` → No issues found!
- Fix ban đầu: (1) comment `login.css` chứa literal "gradient"/"drop-shadow" làm fail guard Viền nét → đổi từ ngữ; (2) widget test thiếu `Material` ancestor cho `TextField` của `AppField` → host bằng `Scaffold` (đúng tiền lệ `shell_render_test.dart`).

### Completion Notes List

- **Task 1–2 (Web):** `web/src/screens/auth/LoginScreen.tsx` — biên module MỚI `screens/` (consumer của design-system). Compose `Card` + brand lockup (`Icon ic-sun`) + 2 `Field size="lg"` (mật khẩu `type="password"`) + `Button variant="primary" size="wide"` + link "Quên mật khẩu?". Bọc `WebShell sidebar={null}` (no-nav auth, UX-DR-15), KHÔNG `Sidebar`/`Topbar`. `login.css` mỏng: chỉ token var cho màu (`--teal`/`--muted`/`--teal-700`/`--bg`) + `--border-width` + spacing token; 0 shadow/gradient. Validate presentational (`useState`): submit rỗng → `Banner tone="danger"`; định dạng tối thiểu SĐT/email. KHÔNG mạng/token/router — comment rõ nối Epic 2 (Story 2.3).
- **Task 3 (Mobile):** `mobile/lib/screens/auth/login_screen.dart` — `LoginScreen` `StatefulWidget` presentational. Bọc `AppPhoneFrame` TRỰC TIẾP (KHÔNG `AppMobileShell` → không topbar/bottom-nav). Compose `AppField AppFieldSize.large` (mật khẩu `obscureText:true`), `AppButton primary wide`, `AppBanner danger`, `AppIcon ic-sun`. Cùng câu Việt như web (parity). Sửa surgical `AppField`: thêm prop `obscureText` (parity `type="password"`) — mọi test cũ pass.
- **Task 4 (Guard):** `design-system/screens/login.test.mjs` (thư mục test MỚI `screens/`, runner glob tự nhặt): 8 khối — compose từ design-system (2 nền tảng), no-nav auth, parity 7 nhãn Việt byte-identical, link Quên mật khẩu, Viền nét (0 shadow/gradient/elevation), obscure parity.
- **Task 5 (Widget test):** `mobile/test/screens/auth/login_screen_test.dart` — pump `LoginScreen`: render 2 `AppField` + `AppButton` + brand + link + `ic-sun`; no topbar/bottom-nav; submit rỗng → `AppBanner`.
- **Task 6 (Chạy test):** 0 regression cả hai nền tảng (148 web-guard, 93 mobile). `test-summary-story-1-11.md` đã tạo. Flutter SDK có sẵn trong môi trường → chạy widget test + analyze thật (không chỉ dựa source-guard).
- **Giới hạn:** Web chưa có React runtime/tsc/bundler trong repo (tiền lệ 1.3–1.10) → màn `.tsx` guard bằng Node text-test; correctness runtime nối khi có build (Epic 2+). Auth thật (JWT), `/me` gating, router = Epic 2; màn `s-forgot` = Story 2.8 (ở đây chỉ link presentational).

### File List

**Mới:**
- `web/src/screens/auth/LoginScreen.tsx`
- `web/src/screens/auth/login.css`
- `mobile/lib/screens/auth/login_screen.dart`
- `design-system/screens/login.test.mjs`
- `mobile/test/screens/auth/login_screen_test.dart`
- `_bmad-output/implementation-artifacts/tests/test-summary-story-1-11.md`

**Sửa:**
- `mobile/lib/design_system/components/field.dart` (thêm prop `obscureText` — surgical, parity với web `type="password"`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-11 → in-progress → review)

## Change Log

| Ngày | Thay đổi |
|------|----------|
| 2026-07-08 | Dựng màn Đăng nhập demo (web React + mobile Flutter) từ design-system: Field/Button/Card/Banner/Icon + shell, no-nav auth, validate presentational → Banner, parity nhãn Việt byte-identical. Thêm `obscureText` cho `AppField`. Test: +8 source-guard/parity, +3 Flutter widget test — 0 regression (148 web-guard, 93 mobile). Status → review. |
