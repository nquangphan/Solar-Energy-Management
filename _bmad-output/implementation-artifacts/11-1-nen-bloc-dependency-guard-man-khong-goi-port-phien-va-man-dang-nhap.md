---
baseline_commit: 811d3c7
---

# Story 11.1: Nền BLoC: dependency, guard màn không gọi port, phiên và màn đăng nhập

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a lập trình viên mobile,
I want nền BLoC (dependency, quy ước, guard) cùng phiên, quyền và các màn đăng nhập/menu chạy bằng Cubit,
so that mọi màn sau chuyển theo cùng một khuôn đã được khoá bằng test.

[Đại Ca chốt 2026-10-23 (đóng H-4 retro E10): BLoC bắt buộc, chuyển hết màn cũ trước Epic 8. Story này **đặt khuôn** cho 11.2–11.4 và Epic 8/9. Refactor thuần mobile: **không đổi hành vi người dùng thấy**, backend/web không đổi.]

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Đọc trước (theo thứ tự): `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` **§1 (probe phụ thuộc) + §6 (20 mặc định — luật của story này)**; `mobile/pubspec.yaml`; `mobile/tool/generate_api.dart`; `mobile/swagger_parser.yaml`; `mobile/build.yaml`; `mobile/test/api/generated_client_drift_test.dart`; `mobile/test/api/build_mobile_spec_test.dart`; `mobile/lib/app/pns_app.dart`; `mobile/lib/design_system/session/app_session.dart`; `mobile/lib/app/signed_in_app.dart:290-349`; `mobile/lib/screens/auth/{login_screen,forgot_password_screen}.dart`; `mobile/lib/screens/menu/menu_screen.dart`; `mobile/test/support/dart_source.dart`; `design-system/screens/{login,forgot-password}.test.mjs`; `design-system/session/parity.test.mjs:26-66`.

### 1. Hiện trạng (scout 2026-10-23, HEAD `811d3c7`)

| Phần | Thực tế |
|---|---|
| Dependency | 0 package bloc. Dev dep sinh client nằm **trong** `mobile/pubspec.yaml`: `swagger_parser ^1.45.0`, `build_runner ^2.15.1`, `retrofit_generator ^10.3.2`, `json_serializable ^6.14.1`, ghim `source_helper: 1.3.13`. Runtime `dio ^5.11.1`, `retrofit ^4.10.0`, `json_annotation ^4.12.0` |
| Bộ sinh | `dart run tool/generate_api.dart` (cwd `mobile/`): dựng spec dẫn xuất `.dart_tool/pns_api/openapi.mobile.json` (`buildMobileSpec`: binary response → `integer`, bỏ `format: date`; ≥ `minDateRewrites`=2) → xoá `lib/api/generated/` → `dart run swagger_parser` → `dart run build_runner build`. Config: `mobile/swagger_parser.yaml` (schema `.dart_tool/pns_api/openapi.mobile.json`, output `lib/api/generated`), `mobile/build.yaml` (`generate_for: [lib/api/generated/**]`) |
| Client sinh | `mobile/lib/api/generated/**` (>100 file `.dart` + `.g.dart`). Chỉ import tương đối + `package:dio`, `package:retrofit`, `package:json_annotation`, `dart:typed_data` — **không có `package:pns_mobile/`** ⇒ sinh ở package khác vẫn ra cùng byte |
| Drift test | `generated_client_drift_test.dart` import `../../tool/generate_api.dart` (`generatedDir`, `backendSpecPath`); dựng `<temp>/backend/openapi/openapi.json` + `<temp>/mobile/` (copy `pubspec.yaml`, `pubspec.lock`, `swagger_parser.yaml`, `build.yaml`, `analysis_options.yaml`, `tool/generate_api.dart`), `flutter pub get --offline`, `dart run tool/generate_api.dart`, so từng byte. Timeout 3 phút |
| `PnsApp` | `StatefulWidget`: `_Phase {restoring, signedOut, forgotPassword, signedIn}`, `_loggingOut`, `_signInCount`; `initState` nghe `sessionExpired` + `_restore()`; signedIn ⇒ `PermissionsProvider(key: ValueKey(_signInCount), port: ports.me, child: SignedInApp(onLogout: _logout, onRetry: () => _signInCount++))`; còn lại ⇒ `MaterialApp(key: 'signed-out', home: appPage(_body()))`; forgotPassword bọc `PopScope(canPop:false)` ⇒ back Android về Đăng nhập |
| `PermissionsProvider` | `StatefulWidget` `const PermissionsProvider({key, required port, required child})`; `initState` gọi `port.fetchMe()` 1 lần ⇒ `PermissionsScope(status, perms, me)`; lỗi ⇒ `error`, perms rỗng, me null |
| `LoginScreen` | `StatefulWidget(port: AuthPort, onLoggedIn, onForgotPassword?)`; state `_error/_phoneError/_busy` + 2 controller. Rỗng (sau `trim`) ⇒ "Nhập đủ số điện thoại và mật khẩu."; gửi `phone` đã trim nhưng **`password: _password.text` KHÔNG trim**; `ApiError` có `fieldErrors.phone` ⇒ message đầu dưới ô SĐT; `ApiError` khác ⇒ `e.message`; lỗi không phải `ApiError` ⇒ `kGenericErrorMessage`. Thành công ⇒ `busy=false` rồi `onLoggedIn()` cùng nhịp |
| `ForgotPasswordScreen` | 2 bước `_Step {request, verify}`, 4 controller, `_error/_phoneError/_remaining`, `Timer.periodic` đếm ngược (dừng ở 0, `dispose` huỷ); top-level `formatCountdown()` public; `_codeRe`, `_passwordRe` |
| `MenuScreen` | **Không gọi port.** `_loggingOut` (nút Đăng xuất disable khi đang chờ `onLogout`); đọc `PermissionsScope.of(context).me` |
| Gọi port trong `lib/screens/` | 18 file (19 `StatefulWidget` trừ Menu; `stock_issue_preview.dart` không state). Dạng hiện có: `widget.port.x(`, `widget.ordersPort.x(`, `widget.catalogPort.x(`, `widget.inventoryPort.x(`, `widget.port.x().then(`, lambda `onConfirm: (r) => widget.port.cancel(...)`. Bẫy dương tính giả: truyền port xuống màn con (`port: widget.port`), so sánh `oldWidget.port != widget.port` (`invoice_detail_screen.dart:99`) |
| Test liên quan | `test/screens/auth/login_screen_test.dart`, `forgot_password_screen_test.dart` (27 ca), `test/screens/menu/menu_screen_test.dart` (7), `test/app/pns_app_test.dart` (16), `test/app/signed_in_app_test.dart` (13), `test/design_system/session_test.dart` (10; dựng **`const PermissionsProvider(`**), 747 test mobile xanh |

### 2. 🔥 BẪY SỐ 1 — build_runner chỉ ghi được vào package của chính nó

`build_runner` ở `mobile/tool/codegen/` **không ghi được** ra `mobile/lib/api/generated`. Khuôn đúng (probe 2026-10-23 đã chứng minh giống từng byte): `swagger_parser.yaml` + `build.yaml` **dời nguyên văn** vào `mobile/tool/codegen/` (đường dẫn tương đối trong đó giữ nguyên chữ: `.dart_tool/pns_api/openapi.mobile.json`, `lib/api/generated`), `generate_api.dart` ghi spec dẫn xuất vào `tool/codegen/.dart_tool/pns_api/openapi.mobile.json`, chạy `swagger_parser` + `build_runner build` với `workingDirectory = tool/codegen`, rồi **xoá `mobile/lib/api/generated` và copy cây `tool/codegen/lib/api/generated` sang**, cuối cùng **xoá bản ở `tool/codegen/lib/`** (không để bản sao thứ hai lởn vởn: nó không bị ignore trên clone mới — xem bẫy 4). Package codegen **phải khai cả runtime `dio`/`retrofit`/`json_annotation` cùng constraint** với mobile, vì `retrofit_generator`/`json_serializable` phân giải import của file sinh. **Cấm hạ version toolchain** (hạ ⇒ 11 file sinh đổi, 10 test API tải PDF/ảnh/multipart đỏ — proposal §1 điểm 3).

### 3. 🔥 BẪY SỐ 2 — `emit` sau `close` ném `StateError`; `if (mounted)` không còn che

Mọi lời gọi port trong cubit là `await` ⇒ màn có thể đóng giữa chừng (đăng xuất, back, `PnsApp` đổi nhánh, `PermissionsProvider` bị thay key khi Thử lại). Mỗi chỗ code cũ có `if (!mounted) return;` sau `await` ⇒ trong cubit là `if (isClosed) return;` **trước mọi `emit`** (cả trong `catch`/`finally`, cả trong tick `Timer`). `ForgotPasswordCubit` huỷ `Timer` trong `close()` override. Mỗi cubit có ca `bloc_test` "port trả về sau `close` ⇒ không ném, không emit" (dùng `Completer`).

### 4. 🔥 BẪY SỐ 3 — `.gitignore` không bao giờ được commit ở clone này

`.git/info/exclude` bỏ mọi file tên `.gitignore` (memory dự án). Đừng dựa vào `mobile/tool/codegen/.gitignore` để giấu `.dart_tool/` hay `lib/`: script phải tự dọn `tool/codegen/lib/` sau khi copy; `tool/codegen/.dart_tool/` cùng số phận `mobile/.dart_tool/` hiện tại (chỉ ignore cục bộ). **Commit `tool/codegen/pubspec.yaml` + `tool/codegen/pubspec.lock`** (lock riêng là yêu cầu AC). Trước commit chạy `git status --short mobile/tool` — chỉ được thấy 4 file config/lock (+ `generate_api.dart` sửa).

### 5. 🔥 BẪY SỐ 4 — text-guard đọc file màn theo đường dẫn cứng sẽ MÙ khi chuỗi dời sang cubit

`login.test.mjs` và `forgot-password.test.mjs` assert **dương** (câu validate `'Nhập đủ số điện thoại và mật khẩu.'`, `_timer?.cancel()`, đúng **MỘT** `Không thể đặt lại mật khẩu.`) và **âm** (không email regex, không `elevation`/`BoxShadow`, không lộ nhánh lỗi) trên `readFileSync(<screen>.dart)`. Câu validate/lỗi dời vào cubit ⇒ assert dương đỏ, assert âm **xanh giả**. Sửa: biến `mobile` = **file màn + mọi `*_cubit.dart`/`*_state.dart`/`*_bloc.dart` cùng thư mục** (sort tên, nối). Không nới regex, không xoá assert. Assert "đúng MỘT câu lỗi reset" vẫn đếm trên văn bản nối ⇒ đừng chép câu ấy ở cả màn lẫn cubit. Assert literal field (`label: '…'`, `placeholder: '…'`) vẫn nằm ở màn (widget dựng `AppField`). `money-render-guard.test.mjs` và `permission-keys.test.mjs` đã walk cả `mobile/lib/screens` ⇒ tự thấy file cubit, không cần sửa.

### 6. 🔥 BẪY SỐ 5 — `session_test.dart` dựng `const PermissionsProvider(...)`, `menu_screen_test.dart` dựng màn không có `SessionCubit`

Đổi chữ ký/const của `PermissionsProvider`, hay để `MenuScreen` đọc `context.read<SessionCubit>()`, là phá lưới an toàn (test không có provider đó). ⇒ `PermissionsProvider` **giữ nguyên `const` constructor `({key, required port, required child})`**, chỉ đổi ruột; `MenuScreen` giữ `({sections, onOpen, onLogout})`, cubit riêng của nó nhận callback.

### 7. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Dependency (`mobile/pubspec.yaml`).** Thêm `flutter_bloc: ^9.1.1`, `equatable: ^3.0.0`; dev `bloc_test: ^10.0.0`. Bỏ 5 dev dep sinh client (chuyển sang D2). Giữ `flutter_test`, `flutter_lints`. Không `dependency_overrides`, không nâng Flutter, không `get_it`/`freezed`/`hydrated_bloc`/`bloc_concurrency`. Lệnh: `~/fvm/default/bin/flutter pub get` (Flutter không nằm trên PATH). Kỳ vọng lock: `bloc 9.2.1`, `flutter_bloc 9.1.1`, `equatable 3.0.0`, `bloc_test 10.0.0`, `test 1.26.2`; `dio 5.11.1`, `retrofit 4.10.0`, `json_annotation 4.12.0` **không đổi**. Sửa comment pubspec cho khớp (bộ sinh ở `tool/codegen/`). Commit `mobile/pubspec.lock`.

**D2 — Package sinh `mobile/tool/codegen/`.** `pubspec.yaml`: `name: pns_api_codegen`, `publish_to: none`, `environment.sdk: ^3.8.0` (giống mobile), dependencies `dio ^5.11.1`, `retrofit ^4.10.0`, `json_annotation ^4.12.0`; dev_dependencies `swagger_parser ^1.45.0`, `build_runner ^2.15.1`, `retrofit_generator ^10.3.2`, `json_serializable ^6.14.1`, `source_helper: 1.3.13` (chép nguyên comment lý do ghim + "bỏ ghim khi SDK ≥ 3.12"). **Không `flutter`/`flutter_test`** (Dart thuần — đó là lý do nó giải được). `swagger_parser.yaml` + `build.yaml` **git mv** từ `mobile/` sang (nội dung giữ, chỉ sửa comment đầu). Lock riêng `tool/codegen/pubspec.lock`.

**D3 — `mobile/tool/generate_api.dart` (lệnh giữ nguyên: `cd mobile && dart run tool/generate_api.dart`).** Giữ `buildMobileSpec`, `minDateRewrites`, `backendSpecPath`, `generatedDir` (test khác import chúng). Thêm `const String codegenDir = 'tool/codegen';`. Luồng: đọc spec → ghi `tool/codegen/.dart_tool/pns_api/openapi.mobile.json` → nếu `tool/codegen/.dart_tool/package_config.json` chưa có thì `dart pub get` trong codegen → xoá `tool/codegen/lib/api/generated` → `dart run swagger_parser` + `dart run build_runner build` (cwd codegen) → xoá `mobile/lib/api/generated`, copy cây → xoá `tool/codegen/lib`. `_run` nhận thêm `workingDirectory`. Sửa header comment. Byte-identical là tiêu chí: sau khi chạy, `git status --short mobile/lib/api/generated` **rỗng**.

**D4 — Drift test.** Vẫn rerun **đúng script** trong temp, vẫn so từng byte, đổi bố cục copy: `<temp>/backend/openapi/openapi.json`; `<temp>/mobile/tool/generate_api.dart`; `<temp>/mobile/tool/codegen/{pubspec.yaml,pubspec.lock,swagger_parser.yaml,build.yaml}`. `dart pub get --offline` trong codegen temp (cache máy đã có sau D2), rồi chạy script. Script không cần package mobile ⇒ không copy `mobile/pubspec.*` nữa (nếu `dart run tool/generate_api.dart` đòi pubspec ở cwd thì chạy `dart tool/generate_api.dart`, ghi lý do). Ca "every declared part file is present" giữ nguyên. Assert thêm: `mobile/pubspec.yaml` **không** khai 5 dev dep sinh và `tool/codegen/pubspec.yaml` **có** đủ 5 (chống ai đó thêm lại vào mobile ⇒ `bloc_test` vỡ giải phụ thuộc).

**D5 — `SessionCubit` (`lib/app/session_cubit.dart` + `session_state.dart`).** `SessionCubit(AuthPort auth, {Listenable? sessionExpired})` — **dựng trong `PnsApp`** bằng `BlocProvider(create: (_) => SessionCubit(widget.auth, sessionExpired: widget.sessionExpired)..restore())` ⇒ `main.dart`, `TestApp` (`test/app/support/app_harness.dart`) và chữ ký `PnsApp({auth, ports, sessionExpired})` **không đổi** (§6.6: port từ composition root → constructor widget → `BlocProvider`). State: `final class SessionState extends Equatable { SessionPhase phase; int signInCount; }` + `copyWith` (một class, vì `signInCount` sống qua mọi pha — không `sealed`). `enum SessionPhase { restoring, signedOut, forgotPassword, signedIn }` public. `_loggingOut` là field private của cubit (không render ⇒ không vào state). Method: `restore()` (try `restoreSession`, `catch` ⇒ false; `isClosed` ⇒ return; true ⇒ `signedIn()`), `signedIn()` (count+1, phase signedIn), `showForgotPassword()`, `backToLogin()`, `retryPermissions()` (count+1), `logout()` (`if (_loggingOut) return;` → try `await auth.logout()` finally `_loggingOut=false; if (!isClosed) emit(signedOut)` — **giữ try/finally không catch**, lỗi vẫn nổi lên như cũ), `_onExpired` (chỉ khi phase == signedIn). Listener add trong constructor, remove trong `close()`. `PnsApp` thành `StatelessWidget` bọc `BlocProvider` + `BlocBuilder<SessionCubit, SessionState>`; nhánh render, `ValueKey(signInCount)` cho `PermissionsProvider`, `MaterialApp(key: 'signed-out')`, `PopScope` giữ nguyên chữ; callback gọi method cubit (`context.read`).

**D6 — `PermissionsCubit` (`lib/design_system/session/permissions_cubit.dart`).** `PermissionsCubit(MePort port)`, `load()`; state `PermissionsState {SessionStatus status; Set<PermissionKey> perms; MeResponse? me}` (Equatable; một class vì `PermissionsScope` nhận đúng 3 field này). **Giữ trong `app_session.dart`:** `SessionStatus`, `toPermissionSet` (parity guard đòi `me.permissions.toSet()` + `SessionStatus` ở file này), `PermissionsScope` (API đọc quyền — không đổi), `PermissionsProvider` với **cùng const constructor**, ruột = `BlocProvider(create: (_) => PermissionsCubit(port)..load(), child: BlocBuilder → PermissionsScope(...))`. Dựng lại mỗi lần đăng nhập nhờ `ValueKey(signInCount)` ở `PnsApp` (cũ) ⇒ account thứ hai không dính quyền cũ; Thử lại = `retryPermissions()` ⇒ key mới ⇒ cubit mới ⇒ `/me` lại. Header `app_session.dart`: bỏ câu "InheritedWidget (not flutter_bloc) keeps this dependency-free (YAGNI); a later app-scaffold story may swap it for a Cubit if the app standardises on BLoC." — thay bằng một câu: state do `PermissionsCubit` giữ, `PermissionsScope` vẫn là API đọc quyền. Export cubit trong `session.dart` barrel (không ảnh hưởng guard composition root — barrel vốn bị cấm trên đường production).

**D7 — `LoginCubit` (`lib/screens/auth/login_cubit.dart` + `login_state.dart`).** `LoginCubit(AuthPort port)`; state `LoginState {bool busy; String? error; String? phoneError}` + `copyWith` (cẩn thận đặt `null` được — dùng sentinel hoặc constructor đầy đủ, đừng để `copyWith(error: null)` giữ lỗi cũ). `Future<bool> submit({required String phone, required String password})`: màn truyền `_phone.text`, `_password.text` thô; cubit giữ y luật cũ (rỗng sau trim ⇒ câu cũ, `phoneError` null; gửi `phone.trim()` và `password` **không trim**; busy ⇒ return false). Trả `true` khi port nhận ⇒ màn gọi `widget.onLoggedIn()` (lý do chọn trả `bool` thay cờ one-shot trong state: giữ thứ tự cũ "busy=false rồi onLoggedIn cùng nhịp", không cần `BlocListener` + reset cờ). Map lỗi (`_phoneMessageOf`, `kGenericErrorMessage`) dời vào cubit. Màn: `StatefulWidget` chỉ còn 2 controller (§6.9) + `BlocProvider`/`BlocBuilder`; constructor public **giữ nguyên**; `onPressed: state.busy ? null : _submit`; `widget.onForgotPassword` giữ (guard regex `widget\.onForgotPassword`).

**D8 — `ForgotPasswordCubit` (`lib/screens/auth/forgot_password_cubit.dart` + `forgot_password_state.dart`).** `ForgotPasswordCubit(PasswordPort port)`; state `{ForgotStep step; String? error; String? phoneError; int remaining}`; `enum ForgotStep {request, verify}`. `Future<void> requestCode(String phone)`, `Future<bool> reset({phone, code, password, confirm})` (true ⇒ màn gọi `onBackToLogin`). Validation (`_codeRe`, `_passwordRe`, khớp xác nhận) + **đúng một** câu lỗi reset + `Timer.periodic` đếm ngược (dừng ở 0) dời vào cubit; `close()` gọi `_timer?.cancel()` rồi `super.close()`. `formatCountdown()` **giữ public top-level ở `forgot_password_screen.dart`** (hiển thị, có thể đang được import). Màn: 4 controller + `dispose()` (guard đòi `void dispose()`), constructor giữ nguyên. Ghi nhận: đếm ngược là state (đến từ `expiresInSeconds` của port) nên vào cubit, không phải "thuần UI".

**D9 — `MenuCubit` (`lib/screens/menu/menu_cubit.dart`).** Màn không gọi port, nhưng cờ "đang đăng xuất" là cờ đang-gửi (§6.9 ⇒ cubit). `MenuCubit(Future<void> Function()? onLogout)`, state `bool loggingOut` (`Cubit<bool>` đủ — không cần file state riêng; ghi một dòng lý do), `logout()`: `if (state || onLogout == null) return;` emit true → try await finally `if (!isClosed) emit(false)`. `MenuScreen` → `StatelessWidget` bọc `BlocProvider`; constructor giữ nguyên; nút: `onLogout == null || loggingOut ? null : cubit.logout`. Không đọc `SessionCubit` (bẫy 5). Identity vẫn đọc `PermissionsScope.of(context).me`.

**D10 — Guard `mobile/test/screens/no_port_call_in_screens_test.dart`.** Dùng `stripDart(src, dropStrings: true)` của `test/support/dart_source.dart` (bỏ comment + chuỗi ⇒ `// widget.port.x()` và `'port.x'` không tính). Thuật toán đề xuất (dev được đổi, nhưng phải qua đủ ca dưới):
1. Quét `lib/screens/**/*.dart`; **file cubit** = tên kết thúc `_cubit.dart`/`_bloc.dart` (được gọi port); **file màn** = còn lại (gồm `*_state.dart` — state không được gọi port).
2. Tên port trong file: mọi định danh khai với type `\w*Port\??` (field, tham số, biến cục bộ: `final OrdersPort ordersPort;`, `AuthPort authPort = …`), cộng alias lặp tới điểm bất động `(final|var|late final)\s+(\w+)\s*=\s*(?:widget\.)?<tên port>\b(?!\s*\.)`; luôn kèm `port`.
3. Vi phạm: `(?:\b\w+\s*\.\s*)?<tên>\s*\.\s*(?!runtimeType\b|hashCode\b)[a-zA-Z_]\w*` ⇒ bắt gọi `x(`, tear-off `x` không ngoặc, `.call(`, `.then(` chuỗi. **Không** bắt: `port: widget.port`, `oldWidget.port != widget.port`, `widget.ports.me` (type `AppPorts` không khớp `\w*Port\??\s`).
4. Allowlist = `const Map<String, String>` **đúng 16 file màn chưa chuyển** (đường dẫn tương đối `lib/screens/...`): `account/profile_screen.dart`, `contracts/contracts_screen.dart`, `customers/{customer_detail,customer_list,customer_pick}_screen.dart`, `inventory/{inventory,stock_vouchers}_screen.dart`, `invoices/{invoice_detail,invoices}_screen.dart`, `orders/{create_quote,discount_approval,order_detail,order_list,order_status_change}_screen.dart`, `payments/payment_schedule_screen.dart`, `warranty/warranty_lookup_screen.dart`; giá trị = story sẽ gỡ (`'11.2'`/`'11.3'`/`'11.4'`) — chuỗi trong code test, được phép.
5. Ca: (a) file màn ngoài allowlist có vi phạm ⇒ ĐỎ, liệt kê `file:line: đoạn`; (b) mỗi entry allowlist **còn ≥1 vi phạm** và **tồn tại**, không thì ĐỎ "đã sạch — xoá entry"; (c) chống guard rỗng: số file màn quét **≥ 20**, và `login_cubit.dart` có vi phạm mà phần lõi (2–3) thấy được **chính lời gọi `login(`** (self-check trúng lời gọi thật, không trúng chữ ký — memory "guard self-check matches a signature"); (d) self-test detector trên chuỗi mẫu trong test: dương `port.x(`, `widget.port.x(`, `widget.ordersPort.x(`, `final p = widget.port; p.x();`, `final f = widget.port.x;`, `widget.port.x.call(`, `widget.port.x().then(`, `AuthPort authPort = widget.port; authPort.x();`; âm `port: widget.port`, `oldWidget.port != widget.port`, `// widget.port.x()`, `'widget.port.x()'`, `widget.ports.me`.
6. **Phạm vi bổ sung không allowlist:** `lib/app/pns_app.dart` và `lib/design_system/session/app_session.dart` cũng phải 0 vi phạm (chứng minh chuyển phiên/quyền đo được; `auth`/`port` chỉ còn được truyền vào cubit).

**D11 — Text-guard helper.** Thêm `design-system/lib/read-mobile-screen.mjs` (`readMobileScreen(repoRoot, relPath)` ⇒ text file màn + mọi `*_cubit.dart`/`*_state.dart`/`*_bloc.dart` cùng thư mục, sort, nối bằng `\n`; ném nếu file màn không tồn tại) + test nhỏ cạnh nó (`read-mobile-screen.test.mjs`: thư mục tạm có màn + cubit + file khác ⇒ chỉ nối đúng loại; thiếu màn ⇒ ném). `login.test.mjs`, `forgot-password.test.mjs` (cả chỗ đọc `loginMobile` ở ca (g)) dùng helper. 11.2–11.4 dùng lại helper này (DRY). `assertCodeNotBlind` floor giữ nguyên.

### 8. Phạm vi

- **Trong:** D1–D11; ca `bloc_test` cho 5 cubit (Session, Permissions, Login, ForgotPassword, Menu); cập nhật proposal 2026-10-23 (mục ghi quyết định giữa story: D3–D9 nếu lệch §6) cùng commit (G-5).
- **Ngoài:** 16 màn trong allowlist (11.2–11.4); `SignedInApp` (router + 2 `reloadSignal` giữ, §6.8); port/adapter/transport/client sinh/router/route; `AppPhoneFrameScope`/`AppBottomNavScope`; backend, web. Lỗi phát hiện ở tầng port/adapter ⇒ ghi TD, không sửa lẫn (§6.16). Smoke emulator chạy ở 11.4 (§6.17) — story này không bắt buộc.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md` Story 11.1)

1. **Given** Flutter 3.35.0 / Dart 3.9.0 trên máy, **When** thêm dependency, **Then** `mobile/pubspec.yaml` có `flutter_bloc: ^9.1.1`, `equatable: ^3.0.0` và dev `bloc_test: ^10.0.0`; `flutter pub get` giải được (probe 2026-10-23: `bloc 9.2.1`, `test 1.26.2`); **không** `dependency_overrides`, không nâng Flutter, không thêm `get_it`/`freezed`/`hydrated_bloc`/`bloc_concurrency` (mặc định §6.2).
2. **Given** `bloc_test` (qua package `test`) không giải chung được với `json_serializable 6.14.1` (cần `analyzer >= 10`) dưới ghim `test_api 0.7.6` của `flutter_test`, **When** thêm `bloc_test`, **Then** 5 dev dep sinh client (`swagger_parser`, `build_runner`, `retrofit_generator`, `json_serializable`, ghim `source_helper: 1.3.13`) chuyển sang package Dart thuần `mobile/tool/codegen/` (pubspec + lock riêng, **cùng version**); `dart run tool/generate_api.dart` (lệnh giữ nguyên) chạy `swagger_parser` + `build_runner` trong package đó và ghi ra `mobile/lib/api/generated`; client sinh **giống từng byte** bản đang commit; `generated_client_drift_test.dart` chạy theo đường dẫn mới và vẫn so từng byte; runtime `dio`/`retrofit`/`json_annotation` giữ nguyên; **không hạ version toolchain** (hạ làm 10 test API đỏ, mặc định §6.3).
3. **Given** `PnsApp` giữ pha phiên trong `State` (`restoring/signedOut/forgotPassword/signedIn`, `_loggingOut`, `_signInCount`, nghe `sessionExpired`), **When** chuyển, **Then** `SessionCubit` (nhận `AuthPort` qua constructor) giữ các pha đó; `PnsApp` chỉ render theo state; hết phiên vẫn về Đăng nhập; `pns_app_test.dart` xanh không đổi finder/expect.
4. **Given** `PermissionsProvider` gọi `/me` trong `State`, **When** chuyển, **Then** `PermissionsCubit` (nhận `MePort`) gọi `/me`; `PermissionsScope.of(context)` **giữ nguyên làm API đọc quyền** cho `AppGate`/`filterNav`/`orderScope` (không sửa primitive gating); cubit dựng lại mỗi lần đăng nhập (đổi account không dính quyền cũ); `/me` lỗi ⇒ màn lỗi + Thử lại/Đăng xuất như hiện tại; `session_test.dart`, `signed_in_app_test.dart` xanh.
5. **Given** `LoginScreen`, `ForgotPasswordScreen`, `MenuScreen`, **When** chuyển, **Then** mỗi màn có một cubit (`LoginCubit`, `ForgotPasswordCubit`, `MenuCubit` hoặc trạng thái đăng xuất đọc từ `SessionCubit`) giữ đang gửi/lỗi/`fieldErrors.phone`/bước; **constructor public của màn giữ nguyên chữ ký**; `TextEditingController`/`FocusNode` được ở lại `State` (mặc định §6.9); test widget auth (27 ca) + menu (7 ca) xanh không đổi finder/expect/fake.
6. **Given** guard mới `mobile/test/screens/no_port_call_in_screens_test.dart`, **When** chạy `flutter test`, **Then** trong `mobile/lib/screens/**` chỉ `*_cubit.dart`/`*_bloc.dart` được gọi method trên port; guard bắt `port.x(`, `widget.port.x(`, port tên khác (`ordersPort`, `inventoryPort`, `catalogPort`…), alias cục bộ, tear-off không ngoặc, `.call(`; allowlist liệt kê **16 file màn chưa chuyển**, mỗi entry **tự kiểm còn vi phạm** (màn đã sạch mà còn trong allowlist ⇒ ĐỎ); chống guard rỗng: số file màn quét ≥ 20 **và** có ít nhất một file cubit gọi port; **đột biến** (H-5): thêm lại một lời gọi port vào `login_screen.dart` theo từng biến thể ⇒ ĐỎ (mặc định §6.13).
7. **Given** text-guard `design-system/screens/login.test.mjs` và `forgot-password.test.mjs` đọc file màn mobile theo đường dẫn, **When** logic dời sang cubit, **Then** guard đọc file màn + mọi `*_cubit.dart`/`*_state.dart` cùng thư mục; không nới regex, không xoá assert; đột biến đưa mẫu bị cấm vào file cubit ⇒ ĐỎ (mặc định §6.14).
8. **Given** mỗi cubit mới, **When** `flutter test`, **Then** có ca `bloc_test`: trạng thái đầu; thành công; lỗi port ⇒ state lỗi mang đúng câu tiếng Việt từ adapter; phản hồi port về sau `close` ⇒ không ném, không `emit` (mặc định §6.10).
9. **Given** quy ước mới, **When** story commit, **Then** đầu `app_session.dart` bỏ câu "InheritedWidget (not flutter_bloc) keeps this dependency-free"; `flutter analyze` sạch; lane mobile + design-system xanh; quyết định giữa story ghi vào proposal 2026-10-23 cùng commit (G-5).

### AC dẫn xuất (đo được)

10. **Byte-identical thật:** sau D3, chạy `cd mobile && dart run tool/generate_api.dart` trên máy ⇒ `git status --short mobile/lib/api/generated` rỗng **và** `mobile/tool/codegen/lib` không còn tồn tại; drift test xanh; đột biến: sửa tay 1 byte trong 1 file `lib/api/generated/**` ⇒ drift test ĐỎ (rồi khôi phục bằng `cp` backup).
11. **Không thêm lại toolchain vào mobile:** drift test (hoặc ca cạnh nó) assert `mobile/pubspec.yaml` không khai `swagger_parser|build_runner|retrofit_generator|json_serializable|source_helper` và `tool/codegen/pubspec.yaml` khai đủ 5 với đúng constraint D2; đột biến thêm `build_runner` vào dev của mobile ⇒ ĐỎ. `build_mobile_spec_test.dart` xanh không đổi.
12. **Pha phiên giữ y cũ** (`bloc_test` `SessionCubit`): restore true ⇒ `signedIn` count 1; false ⇒ `signedOut`; ném ⇒ `signedOut`; `sessionExpired` khi signedIn ⇒ `signedOut`, khi signedOut/forgotPassword ⇒ không emit; `logout()` hai lần khi lần đầu chưa xong ⇒ `auth.logout` gọi **1** lần; logout xong ⇒ `signedOut`; `retryPermissions` ⇒ count+1, phase giữ; sau `close` listener đã gỡ (bump notifier ⇒ không ném).
13. **Quyền** (`bloc_test` `PermissionsCubit`): đầu `loading`/rỗng/null; ok ⇒ `ready` + `toPermissionSet(me)` + `me`; ném ⇒ `error`, rỗng, null; đóng trước khi `/me` về ⇒ không emit. Widget: đăng xuất rồi đăng nhập account khác ⇒ quyền account mới (ca có sẵn trong `signed_in_app_test`/`pns_app_test` — chỉ ra ca nào phủ, nếu không có thì **thêm** ca).
14. **Login** (`bloc_test`): rỗng ⇒ câu validate, 0 lời gọi port; `ApiError` có `fieldErrors.phone` ⇒ `phoneError` = message đầu, `error` null; `ApiError` khác ⇒ `error` = `e.message` nguyên văn; `StateError` ⇒ `kGenericErrorMessage`; port nhận **password không trim** (`' pw '` ⇒ `' pw '`) và phone đã trim; gọi `submit` khi busy ⇒ không gọi port lần 2; thành công ⇒ trả `true`, state `busy:false`.
15. **Quên mật khẩu** (`bloc_test`): rỗng ⇒ câu cũ; ok ⇒ `verify` + `remaining = expiresInSeconds`, đếm lùi về 0 rồi dừng (không xuống âm); lỗi `fieldErrors.phone` ⇒ `phoneError`; lỗi khác ⇒ "Không gửi được mã. Thử lại sau."; mã sai dạng / mật khẩu yếu / không khớp ⇒ đúng câu, 0 lời gọi; reset lỗi bất kỳ ⇒ đúng một câu chung; `close()` khi đang đếm ⇒ timer huỷ, không emit sau đó.
16. **Menu** (`bloc_test` + widget có sẵn): `logout()` hai lần khi lần đầu chưa xong ⇒ callback gọi 1 lần; `onLogout == null` ⇒ không làm gì; xong ⇒ `false`.
17. **Đột biến guard D10 (H-5), mỗi biến thể một lần, cp backup, KHÔNG git checkout:** chèn vào `login_screen.dart` (mutant phải compile — dùng method có thật của `AuthPort`): (a) `widget.port.restoreSession();` (b) alias `final AuthPort p = widget.port; p.restoreSession();` (c) tear-off `final f = widget.port.restoreSession;` (d) `widget.port.restoreSession.call();` (e) tên khác `final AuthPort authPort = widget.port; authPort.logout();` ⇒ mỗi cái ĐỎ ở ca (a) của guard. Thêm: (f) `widget.ports`/`port: widget.port` không ĐỎ (đã có ca âm); (g) thêm `auth/login_screen.dart` vào allowlist ⇒ ĐỎ ca (b); (h) xoá entry `orders/order_list_screen.dart` khỏi allowlist ⇒ ĐỎ ca (a); (i) đổi lời gọi trong `login_cubit.dart` thành không gọi port (vd tạm comment) ⇒ ĐỎ ca (c); (j) chèn `widget.auth.logout();`/`auth.logout()` vào `pns_app.dart` ⇒ ĐỎ phạm vi bổ sung. Ghi bảng kết quả (dòng `Tests:`/số ca đỏ cho từng mutant) vào Debug Log.
18. **Đột biến text-guard D11:** đưa vào `login_cubit.dart`: `'Tài khoản phải là email hợp lệ.'` ⇒ `login.test.mjs` ĐỎ; `elevation` (trong code, không comment) ⇒ ĐỎ. Đưa vào `forgot_password_cubit.dart`: bản sao thứ hai `'Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.'` ⇒ `forgot-password.test.mjs` ĐỎ; `TextInputType.emailAddress` ⇒ ĐỎ. Xoá `_timer?.cancel()` khỏi cubit ⇒ ĐỎ. Đưa `AppPerm.` vào `menu_cubit.dart` ⇒ `permission-keys.test.mjs` ĐỎ (chứng minh guard walk thấy cubit).
19. **Lưới an toàn không bị đụng:** `git diff --stat 811d3c7 -- mobile/test/screens mobile/test/app mobile/test/design_system/session_test.dart` chỉ được có file mới (`no_port_call_in_screens_test.dart`, file `*_cubit_test.dart`) — **0 dòng sửa** trong file test cũ; nếu buộc phải thêm `pump()` thì ghi từng chỗ + lý do vào Completion Notes (§6.12). Toàn bộ lane mobile ≥ 747 ca cũ + ca mới, xanh.

---

## Tasks / Subtasks

- [x] **T1 — Tách bộ sinh (AC 2, 10, 11)**
  - [x] Tạo `mobile/tool/codegen/pubspec.yaml` (D2); `git mv mobile/swagger_parser.yaml mobile/build.yaml mobile/tool/codegen/`; sửa comment đầu.
  - [x] Sửa `tool/generate_api.dart` (D3); chạy `cd mobile/tool/codegen && ~/fvm/default/bin/dart pub get`, rồi `cd mobile && ~/fvm/default/bin/dart run tool/generate_api.dart` ⇒ `git status --short mobile/lib/api/generated` rỗng.
  - [x] Sửa `generated_client_drift_test.dart` (D4) + ca chống thêm lại toolchain (AC 11).
- [x] **T2 — Dependency BLoC (AC 1)**: sửa `mobile/pubspec.yaml` (D1), `flutter pub get`; đối chiếu version lock; `flutter analyze` sạch; `flutter test` toàn lane xanh **trước khi** chuyển code (mốc: mọi thứ còn xanh với dependency mới).
- [x] **T3 — `PermissionsCubit` (AC 4, 9, 13)**: D6; `test/design_system/session/permissions_cubit_test.dart` (bloc_test).
- [x] **T4 — `SessionCubit` + `PnsApp` (AC 3, 12)**: D5; `test/app/session_cubit_test.dart`.
- [x] **T5 — `LoginCubit` (AC 5, 8, 14)**: D7; `test/screens/auth/login_cubit_test.dart`.
- [x] **T6 — `ForgotPasswordCubit` (AC 5, 8, 15)**: D8; `test/screens/auth/forgot_password_cubit_test.dart`.
- [x] **T7 — `MenuCubit` (AC 5, 16)**: D9; `test/screens/menu/menu_cubit_test.dart`.
- [x] **T8 — Guard màn không gọi port (AC 6, 17)**: D10; chạy đủ 10 đột biến AC 17, ghi bảng.
- [x] **T9 — Text-guard (AC 7, 18)**: D11 (helper + test), sửa `login.test.mjs`, `forgot-password.test.mjs`; chạy đột biến AC 18.
- [x] **T10 — Tài liệu (AC 9)**: header `app_session.dart`; proposal 2026-10-23 thêm mục "Quyết định khi làm 11.1" (D3 lệnh chạy script trong drift test, D7/D8 trả `bool`, D9 `Cubit<bool>`, D10 phạm vi bổ sung) — chỉ ghi chỗ lệch/chi tiết hoá §6.
- [x] **T11 — Cổng**: `cd mobile && ~/fvm/default/bin/flutter analyze` sạch; `~/fvm/default/bin/flutter test` xanh; `cd design-system && npm test` xanh; `dart format -o none --set-exit-if-changed <file đã đụng>` (CHỈ file story chạm); AC 19 `git diff --stat`; `git status --short mobile/tool` đúng bẫy 3; không còn file backup (`*.bak`, `bk-*`) trong repo. Backend/web không đổi ⇒ không bắt buộc chạy lại (ghi rõ trong Completion Notes).

---

## Dev Notes

### Quyết định đã chốt — không bàn lại

- 20 mặc định §6 của `sprint-change-proposal-2026-10-23.md` là luật. Đặc biệt: §6.6 (port qua constructor màn, chữ ký màn giữ), §6.7 (state bất biến `Equatable`; lỗi port giữ câu adapter đã map, **không map lại** trong cubit — login giữ đúng nhánh map hiện có ở màn, chỉ dời chỗ), §6.9 (controller ở lại `State`), §6.10 (`isClosed`), §6.12 (test cũ không đổi finder/expect/fake), §6.15 (tên tiếng Anh, file cạnh màn, comment đầu "hand-authored — …").
- **Cubit mặc định**, không `Bloc` event cho 5 cubit này (không có chuỗi sự kiện có thứ tự riêng).
- Ngôn ngữ: code/comment/tên test tiếng Anh; chỉ chuỗi người dùng thấy tiếng Việt (và giữ **byte-for-byte** chuỗi cũ — guard parity web↔mobile so chữ).

### Hiện trạng phải giữ (hành vi)

- Khởi động: skeleton (`SessionSkeleton`) tới khi restore xong; restore ném ⇒ Đăng nhập (không kẹt skeleton).
- Đăng nhập: chạm hai lần khi đang gửi ⇒ một request (nút disable khi busy).
- Back Android ở Quên mật khẩu ⇒ về Đăng nhập (không đóng app) — `PopScope(canPop:false)` ở `PnsApp`.
- `/me` lỗi ⇒ `AppErrorState('Không tải được thông tin tài khoản.', onRetry)` + nút Đăng xuất (`signed_in_app.dart:305-325` — **không sửa file này**; nó đọc `PermissionsScope`).
- Đăng xuất offline: chờ timeout, chạm lần hai không gửi lần hai, cuối cùng vẫn về Đăng nhập và store rỗng.
- Hết phiên từ transport (`sessionExpired` bump) ⇒ về Đăng nhập **sau một `tester.pump()`** (ca `pns_app_test` "session expiry…"). `emit` → stream bloc giao bất đồng bộ (microtask); `pump()` xả microtask trước khi dựng frame nên vẫn qua — nếu không qua, đó là khác hành vi ⇒ sửa code, không sửa test.

### Tình huống biên đã tính

- `PermissionsProvider` bị thay key giữa lúc `/me` đang chờ (Thử lại / đăng xuất) ⇒ cubit cũ `close` ⇒ `/me` về muộn không emit (bẫy 2).
- `SessionCubit.logout()` khi cubit đã đóng (app bị tháo) ⇒ `finally` không emit.
- `ForgotPasswordCubit.requestCode` thành công lần 2 (gửi lại) ⇒ timer cũ huỷ trước khi tạo timer mới (giữ `_timer?.cancel()` ở đầu `_startCountdown`).
- `LoginState.copyWith` xoá lỗi về `null` đúng (đừng dùng `error ?? this.error`).
- `Set<PermissionKey>` trong `Equatable` so sâu (DeepCollectionEquality) — `PermissionsScope.updateShouldNotify` vẫn so `!=` theo instance như cũ; không đổi.

### Kiểm thử — luật dự án áp dụng trực tiếp

- `bloc_test` cho mọi cubit (AC 8): `blocTest<XCubit, XState>(build:, act:, expect:, verify:)`; fake port: dùng `FakeAuthPort`/`FakeMePort`/`FakePasswordPort` có sẵn khi đủ; ca đóng sớm dùng port viết tại test với `Completer`. Không thêm `mocktail`/`mockito` (không có trong dependency; §6.2).
- Guard mới phải có chống-guard-rỗng + mutant (H-5, luật dự án 5). Mutant phải **compile** (memory: mutant không compile ⇒ mọi suite đỏ giả) — dùng method có thật của `AuthPort`.
- Mutation: `cp` file ra scratchpad trước, `cp` ngược lại sau; **không `git checkout`** (code story chưa commit). zsh: bọc lệnh test trong function, in dòng tổng kết mỗi mutant.
- `dart format` **ghi file** kể cả với `--set-exit-if-changed` ⇒ luôn `-o none`, chỉ file story chạm.
- Flutter: `~/fvm/default/bin/flutter`, `~/fvm/default/bin/dart` (không có trên PATH).

### Previous Story Intelligence (10.6 → 10.9, retro E10)

- 10.6 dựng bộ sinh + drift test "một đường sinh duy nhất" — giữ nguyên tinh thần: drift test chạy **chính script**, không tự dựng đường sinh thứ hai.
- 10.6 review: app root cần `Scaffold` để bàn phím không che nút Đăng nhập — `appPage(...)` trong `PnsApp` giữ nguyên (ca `pns_app_test` "on-screen keyboard…").
- 10.7: session store đếm `generation` (refresh về muộn sau đăng xuất không ghi token) — nằm ở adapter/store, không đụng.
- 10.8: `go_router` `pushReplacement` nuốt future của `push`; `reloadSignal` — thuộc `SignedInApp`, ngoài phạm vi.
- 10.9: login/forgot dùng SĐT; câu bước 2 cố định; client chỉ validate rỗng; `fieldErrors.phone` dưới ô. Guard login/forgot vừa sửa ở 10.9 — đừng phá ca (c.2)/(e.1) literal field.
- Retro E10 §3.1: 7/9 story có finding "guard mù" ở review ⇒ lý do H-5: mỗi guard ship kèm mutant xoá thứ thật cần bảo vệ + danh sách biến thể (đã liệt kê ở D10/AC 17).

### Git intelligence

- `811d3c7` docs Epic 11 (epics/spine/project-context/sprint-status đã cập nhật — **không cần sửa lại** spine AD-12 "Luật state mobile" và Stack row `flutter_bloc`, đã có ở `ARCHITECTURE-SPINE.md:126,210`).
- `e71be69` (10.9) chạm đúng login/forgot mobile + guard — đọc diff của nó để biết assert nào mới.
- `859b894` (10.8) — khuôn `AppPorts`, composition root guard.

### Latest tech notes (đo 2026-10-23 trên máy, Flutter 3.35.0 / Dart 3.9.0)

- `flutter_bloc 9.1.1` / `bloc 9.2.1`: `Cubit.emit` sau `close` ném `StateError('Cannot emit new states after calling close')`; `isClosed` là getter công khai. `BlocProvider(create:)` tự `close()` cubit khi rời cây (lazy mặc định `true` — với `PermissionsProvider`/`SessionCubit` cần gọi `load()`/`restore()` ngay ⇒ dùng `..load()` trong `create` và **`lazy: false`** nếu không có widget con nào đọc cubit ngay frame đầu; `BlocBuilder` con đọc ngay nên `lazy` mặc định cũng được — kiểm bằng ca skeleton/loading).
- `bloc_test 10.0.0`: `blocTest` có `seed`, `act`, `wait`, `skip`, `expect`, `errors`, `verify`; `expect` không gồm state đầu.
- `equatable 3.0.0`: `props` trả `List<Object?>`.
- Không có `dependency_overrides`; nếu `pub get` đòi override ⇒ dừng, đối chiếu lại D1/D2 (probe đã giải sạch).

### Project Structure Notes

- File mới: `mobile/tool/codegen/{pubspec.yaml,pubspec.lock}` (+ `swagger_parser.yaml`, `build.yaml` dời sang); `mobile/lib/app/{session_cubit,session_state}.dart`; `mobile/lib/design_system/session/permissions_cubit.dart`; `mobile/lib/screens/auth/{login_cubit,login_state,forgot_password_cubit,forgot_password_state}.dart`; `mobile/lib/screens/menu/menu_cubit.dart`; test: `mobile/test/screens/no_port_call_in_screens_test.dart`, `mobile/test/app/session_cubit_test.dart`, `mobile/test/design_system/session/permissions_cubit_test.dart`, `mobile/test/screens/auth/{login,forgot_password}_cubit_test.dart`, `mobile/test/screens/menu/menu_cubit_test.dart`; `design-system/lib/read-mobile-screen{,.test}.mjs`.
- File sửa: `mobile/pubspec.yaml`, `mobile/pubspec.lock`, `mobile/tool/generate_api.dart`, `mobile/test/api/generated_client_drift_test.dart`, `mobile/lib/app/pns_app.dart`, `mobile/lib/design_system/session/{app_session,session}.dart`, `mobile/lib/screens/auth/{login_screen,forgot_password_screen}.dart`, `mobile/lib/screens/menu/menu_screen.dart`, `design-system/screens/{login,forgot-password}.test.mjs`, `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md`.
- **Không sửa:** `mobile/lib/main.dart`, `mobile/lib/app/{signed_in_app,app_ports,app_routes}.dart`, mọi port/adapter/transport, `mobile/lib/api/generated/**` (phải giữ byte), 16 màn allowlist, mọi test cũ.
- `test/design_system/session/` là thư mục mới (test cũ `session_test.dart` nằm thẳng `test/design_system/`) — được; hoặc đặt `test/design_system/permissions_cubit_test.dart`, chọn một, ghi Completion Notes.
- Commit: conventional, tiếng Anh; `git add` đường dẫn cụ thể (không `-A`); không push.

### Câu hỏi mở (không chặn dev — đã có mặc định)

- Nếu `dart pub get --offline` trong drift test temp không chạy được vì cache thiếu gói codegen trên máy khác: mặc định giữ `--offline` (giống hiện tại với `flutter pub get --offline`), ghi vào README/Completion Notes "chạy `dart pub get` trong `tool/codegen` một lần".
- Đặt thư mục test cubit phiên/quyền (xem Project Structure Notes).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.1]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` §1 (probe), §2.4, §3, §6.1–6.20]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-12 "Luật state mobile" (dòng 126), Stack (dòng 210)]
- [Source: `_bmad-output/project-context.md` — Kiến trúc code/Mobile, Testing]
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` — H-5 action item]
- [Source: `mobile/tool/generate_api.dart`, `mobile/test/api/generated_client_drift_test.dart`, `mobile/lib/app/pns_app.dart`, `mobile/lib/design_system/session/app_session.dart`, `mobile/lib/screens/{auth,menu}/*.dart`, `design-system/screens/{login,forgot-password}.test.mjs`, `design-system/session/parity.test.mjs`, `mobile/test/support/dart_source.dart`]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) — bmad-dev-story, 2026-10-23.

### Debug Log References

**T1/T2 — bộ sinh + dependency.** `tool/codegen` lock: `swagger_parser 1.45.0`, `build_runner 2.15.1`, `retrofit_generator 10.3.2`, `json_serializable 6.14.1`, `source_helper 1.3.13`, `retrofit 4.10.0`, `dio 5.11.1`, `json_annotation 4.12.0` (= lock mobile cũ; chỉ `analyzer` 10.2.0 thay 10.0.1, client vẫn giống byte). `cd mobile && dart run tool/generate_api.dart` (15 s) ⇒ `git status --short mobile/lib/api/generated` rỗng, `tool/codegen/lib` không còn. Lock mobile: `bloc 9.2.1`, `flutter_bloc 9.1.1`, `equatable 3.0.0`, `bloc_test 10.0.0`, `test 1.26.2`; `dio/retrofit/json_annotation` không đổi; 0 `dependency_overrides`. Mốc T2: analyze sạch, 748/748.

**Lệch phát hiện khi chạy:** ca `pns_app_test` "session expiry reported by the transport" đỏ (cần 2 `pump()`): `emit` tới `BlocBuilder` qua microtask, và `tester.pump()` không vẽ frame khi chưa có frame nào được lên lịch (setState cũ lên lịch ngay trong listener). Story giả định `pump()` xả microtask rồi vẽ — sai. Sửa code, không sửa test: `PnsApp` bọc `BlocBuilder` trong `ListenableBuilder(listenable: sessionExpired)` ⇒ frame lên lịch cùng nhịp tín hiệu (jev hỏi: unsure 0.38 ⇒ tự quyết theo luật "sửa code, không sửa test").

**Ca `bloc_test` treo:** "close while counting" viết bằng `testWidgets` + `await cubit.close()` có listener ⇒ treo trong vùng fake-async. Đổi sang `test` thường, chờ thật 1,1 s.

**Đột biến guard D10 (AC 17)** — `cp` backup, khôi phục bằng `cp`, lane `no_port_call_in_screens_test.dart` (19 ca):

| Mutant | Kết quả | Ca đỏ |
|---|---|---|
| (a) `widget.port.restoreSession();` vào `login_screen.dart` | +18 -1 | no screen outside the allowlist calls a port |
| (b) `final AuthPort p = widget.port; p.restoreSession();` | +18 -1 | như (a) |
| (c) `final f = widget.port.restoreSession;` | +18 -1 | như (a) |
| (d) `widget.port.restoreSession.call();` | +18 -1 | như (a) |
| (e) `final AuthPort authPort = widget.port; authPort.logout();` | +18 -1 | như (a) |
| (f) `port: widget.port` / `widget.ports.me` / `oldWidget.port != widget.port` | xanh | ca âm của detector (6 ca) |
| (g) thêm `auth/login_screen.dart` vào allowlist | +18 -1 | every allowlist entry … still calls a port |
| (h) xoá entry `orders/order_list_screen.dart` | +18 -1 | no screen outside the allowlist … |
| (i) comment `await _port.login(...)` trong `login_cubit.dart` | +18 -1 | the guard is not blind … sees the real login call |
| (j) `auth.logout();` vào `pns_app.dart` | +18 -1 | the app shell and the session provider call no port |
| (j2) `widget.auth.logout();` vào `pns_app.dart` | +18 -1 | như (j) |

**Đột biến text-guard D11 (AC 18)** — `node --test` design-system (508 ca):

| Mutant | Kết quả |
|---|---|
| `'Tài khoản phải là email hợp lệ.'` vào `login_cubit.dart` | fail 1 (… no email format check) |
| `elevation` (code) vào `login_cubit.dart` | fail 2 (login + forgot: cùng thư mục `auth/`) |
| bản sao thứ hai câu lỗi reset vào `forgot_password_cubit.dart` | fail 1 (one generic failure message …) |
| `TextInputType.emailAddress` vào `forgot_password_cubit.dart` | fail 2 |
| xoá mọi `_timer?.cancel()` khỏi `forgot_password_cubit.dart` | fail 1 (resend countdown is torn down) |
| `AppPerm.ordersViewAll` vào `menu_cubit.dart` | fail 1 (permission-keys: no ghost keys) |

(Lần chạy đầu hai mutant chuỗi tiếng Việt "sống" vì script đột biến dùng `unicode_escape` làm hỏng chữ chèn vào; sửa script, kiểm chuỗi chèn có mặt, chạy lại ⇒ đỏ.)

**Đột biến AC 10/11/13:** sửa 1 byte `lib/api/generated/models/me_response_dto.dart` ⇒ drift test +2 -1 (`changed: [models/me_response_dto.dart]`). Thêm `build_runner` hoặc `source_helper` vào dev mobile ⇒ `pub get` không giải được (đỏ trước khi test chạy — chính lý do AC 2); assert văn bản chứng minh qua phía codegen: hạ `retrofit_generator: ^10.2.0` ⇒ đỏ "must keep retrofit_generator: ^10.3.2". `pubspec.lock` khôi phục, `cmp` giống hệt. Gỡ `ValueKey(signInCount)` ở `PnsApp` ⇒ đỏ ca "/me failing … Thử lại"; gỡ lớp `ListenableBuilder` ⇒ đỏ ca "session expiry …".

### Completion Notes List

- 5 Cubit: `SessionCubit` (`lib/app/`), `PermissionsCubit` (`lib/design_system/session/`), `LoginCubit`, `ForgotPasswordCubit`, `MenuCubit` (`Cubit<bool>`). Constructor public của `PnsApp`, `PermissionsProvider` (vẫn `const`), `LoginScreen`, `ForgotPasswordScreen`, `MenuScreen` giữ nguyên chữ ký; controller ở lại `State`; `PermissionsScope` không đổi; `formatCountdown` vẫn public ở `forgot_password_screen.dart`.
- Mọi `await` port trong cubit có `isClosed` trước `emit`; `ForgotPasswordCubit.close()` huỷ timer; `SessionCubit.close()` gỡ listener `sessionExpired`.
- Ca mới: 68 (session 15, permissions 4, login 8, forgot 16, menu 6, guard 19 = 15 self-test detector + 4). Lane mobile **816/816** (747 cũ + 1 ca drift chống thêm lại toolchain + 68), `flutter analyze` sạch; design-system **508/508** (+2 ca helper).
- AC 19: `git diff --stat 811d3c7 -- mobile/test/screens mobile/test/app mobile/test/design_system/session_test.dart` rỗng — 0 dòng sửa trong test cũ, không thêm `pump()` nào.
- AC 13 widget: ca có sẵn `signed_in_app_test.dart:338` "signing out A and in as B gives B's permissions" phủ hành vi; lưu ý: ca này xanh cả khi gỡ `ValueKey` (đăng xuất đã tháo `PermissionsProvider` khỏi cây) — key được bảo vệ bởi ca "/me failing … Thử lại" (đột biến ở Debug Log).
- Test cubit quyền đặt ở `test/design_system/session/permissions_cubit_test.dart` (thư mục mới).
- `dart format -o none --set-exit-if-changed` trên 22 file story chạm: báo "changed" — nhưng chính bản HEAD của 7/8 file cũ cũng "unformatted" (repo viết dòng > 80, không áp `dart format`); file mới theo phong cách file cũ. Không ghi file nào.
- `git status --short mobile/tool`: `generate_api.dart` (M), `codegen/{build,swagger_parser}.yaml` (git mv), `codegen/pubspec.{yaml,lock}` (mới); `codegen/.dart_tool/` chỉ ignore cục bộ. Không còn file backup trong repo (backup ở scratchpad).
- Máy mới: chạy `dart pub get` trong `mobile/tool/codegen` một lần trước `flutter test` (drift test dùng `--offline`).
- Backend/web không đổi ⇒ không chạy lại lane backend/web. Smoke emulator thuộc 11.4 (§6.17), chưa chạy.

### File List

- `mobile/pubspec.yaml` (M), `mobile/pubspec.lock` (M)
- `mobile/tool/generate_api.dart` (M)
- `mobile/tool/codegen/pubspec.yaml` (A), `mobile/tool/codegen/pubspec.lock` (A)
- `mobile/tool/codegen/swagger_parser.yaml` (R từ `mobile/swagger_parser.yaml`), `mobile/tool/codegen/build.yaml` (R từ `mobile/build.yaml`)
- `mobile/lib/app/pns_app.dart` (M), `mobile/lib/app/session_cubit.dart` (A), `mobile/lib/app/session_state.dart` (A)
- `mobile/lib/design_system/session/app_session.dart` (M), `mobile/lib/design_system/session/session.dart` (M), `mobile/lib/design_system/session/permissions_cubit.dart` (A)
- `mobile/lib/screens/auth/login_screen.dart` (M), `mobile/lib/screens/auth/login_cubit.dart` (A), `mobile/lib/screens/auth/login_state.dart` (A)
- `mobile/lib/screens/auth/forgot_password_screen.dart` (M), `mobile/lib/screens/auth/forgot_password_cubit.dart` (A), `mobile/lib/screens/auth/forgot_password_state.dart` (A)
- `mobile/lib/screens/menu/menu_screen.dart` (M), `mobile/lib/screens/menu/menu_cubit.dart` (A)
- `mobile/test/api/generated_client_drift_test.dart` (M)
- `mobile/test/screens/no_port_call_in_screens_test.dart` (A)
- `mobile/test/app/session_cubit_test.dart` (A), `mobile/test/design_system/session/permissions_cubit_test.dart` (A)
- `mobile/test/screens/auth/login_cubit_test.dart` (A), `mobile/test/screens/auth/forgot_password_cubit_test.dart` (A), `mobile/test/screens/menu/menu_cubit_test.dart` (A)
- `mobile/test/app/unmount_while_port_pending_test.dart` (A — bước QA: màn/provider bị tháo khi port còn chờ)
- `_bmad-output/implementation-artifacts/tests/test-summary-story-11-1.md` (A — bước QA)
- `_bmad-output/planning-artifacts/epics.md` (M — review: AC 7 Story 11.1 làm rõ "của chính màn đó theo tên")
- `design-system/lib/read-mobile-screen.mjs` (A), `design-system/lib/read-mobile-screen.test.mjs` (A)
- `design-system/screens/login.test.mjs` (M), `design-system/screens/forgot-password.test.mjs` (M)
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-23.md` (M — §7 quyết định khi làm 11.1)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (M)

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI, bmad-story-automator-review + /ck:code-review) — 2026-10-23. **Kết quả:** Approve sau khi sửa (0 CRITICAL còn lại).

**Git vs File List:** 2 file có trong git nhưng thiếu trong File List (`test/app/unmount_while_port_pending_test.dart`, `tests/test-summary-story-11-1.md` — thêm ở bước QA) ⇒ đã bổ sung. `.githooks/` và 2 file `docs/*.xlsx` chưa track là của việc khác (20/10), không thuộc story — không đụng, không commit.

**AC:** 1–19 đều có bằng chứng (đọc code + test + chạy lại). AC 7 và AC 6 đạt **chỉ sau khi sửa** H-1/H-2 bên dưới.

### Finding và cách sửa

| # | Mức | Finding | Bằng chứng | Sửa |
|---|---|---|---|---|
| H-1 | HIGH | `readMobileScreen` đọc **mọi** cubit/state cùng thư mục ⇒ guard login đọc cả `forgot_password_cubit.dart`, assert dương xanh giả. Completion/proposal ghi "chặt hơn, không lỏng hơn" — sai | Đột biến: xoá hết "Quên mật khẩu" khỏi `login_screen.dart` (cả nhãn link lẫn comment) ⇒ `login.test.mjs` **12/12 xanh** (comment đầu `forgot_password_cubit.dart` có chữ đó) | Helper chỉ đọc file logic của chính màn theo tên (`login_screen` ⇒ `login_*`, tên dài nhất thắng); file logic không thuộc màn nào ⇒ ném. Test helper 4 ca (đúng màn, tiền tố lồng, file mồ côi ném, màn thiếu/không phải màn ném). Proposal §7.6 + epics AC 7 cập nhật |
| H-2 | HIGH | Guard "màn không gọi port" mù với port lấy qua gói `AppPorts`: `ports.me.fetchMe()` trong `pns_app.dart` (đúng hình dạng code cũ đưa `ports.me` cho provider) | Đột biến chèn `ports.me.fetchMe();` vào `PnsApp._build` ⇒ guard **19/19 xanh** | `_portPatterns`: thành viên của biến kiểu `…Ports` (mặc định `ports`) tính là port — gọi, alias, tear-off. +3 ca dương detector (`widget.ports.me.fetchMe()`, `AppPorts all; all.password.x()`, alias `final me = widget.ports.me`); ca âm `port: widget.ports.me` vẫn xanh. Proposal §7.7 |
| M-1 | MEDIUM | Luật (8) ngôn ngữ: JSDoc của `design-system/lib/read-mobile-screen.mjs` (file mới) viết tiếng Việt | đọc file | Viết lại tiếng Anh |
| M-2 | MEDIUM | File List thiếu 2 file (xem trên) | `git status` | Bổ sung |
| L-1 | LOW | `generate_api.dart`: một bước sinh lỗi ⇒ `exit` trong `_run`, `tool/codegen/lib/` sinh dở nằm lại (không bị ignore trên clone mới — bẫy 3) | đọc code | `_run` xoá `tool/codegen/lib` trước khi `exit`; drift test (chạy chính script) xanh |

**Đã xét, không phải lỗi (ghi lý do):**
- Cubit giữ port/callback bắt lúc `create` (Login/Forgot/Menu/Session/Permissions), còn code cũ đọc `widget.x` lúc gọi: không đạt được — port đến từ composition root (`main.dart` → `PnsApp`), `onLogout` là tear-off `session.logout` của cùng một `SessionCubit` sống suốt `PnsApp`. Đúng khuôn §6.6.
- Import vòng `app_session.dart` ↔ `permissions_cubit.dart`: Dart cho phép; bắt buộc bởi D6 (parity guard đòi `SessionStatus`/`toPermissionSet` ở `app_session.dart`, `PermissionsProvider` giữ ở đó).
- `ForgotPasswordCubit` validate bước 2 giờ xoá cả `phoneError` (cũ chỉ đặt `_error`): `phoneError` chỉ hiển thị ở bước 1 ⇒ người dùng không thấy khác.
- Số dòng trong báo cáo guard lệch sau chuỗi `'''` nhiều dòng (`stripDart(dropStrings)` bỏ cả `\n` trong chuỗi): helper dùng chung từ 10.6, chỉ ảnh hưởng thông điệp — ngoài phạm vi.

### Đột biến sau sửa (cp backup, khôi phục bằng cp, `cmp` giống hệt)

| Mutant | Kết quả |
|---|---|
| xoá mọi "Quên mật khẩu" khỏi `login_screen.dart` | design-system fail 2 (labels byte-identical, forgot link) — trước sửa: xanh |
| `'Tài khoản phải là email hợp lệ.'` vào `login_cubit.dart` | fail 1 |
| `elevation` (code) vào `login_cubit.dart` | fail 1 (chỉ login — forgot không còn đọc cubit login) |
| bản sao câu lỗi reset vào `forgot_password_cubit.dart` | fail 1 |
| `TextInputType.emailAddress` vào `forgot_password_cubit.dart` | fail 1 |
| bỏ mọi `_timer?.cancel()` trong `forgot_password_cubit.dart` | fail 1 |
| tạo `auth/auth_cubit.dart` (mồ côi) | login + forgot-password ném ⇒ fail 2 file |
| `ports.me.fetchMe();` vào `pns_app.dart` | guard +21 -1 (app shell…) — trước sửa: xanh |
| `final pw = ports.password; pw.requestResetCode('0');` vào `pns_app.dart` | +21 -1 |
| `final f = ports.me.fetchMe;` vào `pns_app.dart` | +21 -1 |
| AC 17 (a)–(e) vào `login_screen.dart` (chạy lại sau đổi detector) | mỗi cái +21 -1 (no screen outside the allowlist…) |

### Cổng sau sửa

- `cd mobile && flutter analyze`: No issues found.
- `flutter test`: **830/830** (816 dev + 11 ca QA unmount + 3 ca detector mới), gồm drift test chạy lại script đã sửa ⇒ client giống từng byte; `git status --short mobile/lib/api/generated` rỗng; `mobile/tool/codegen/lib` không tồn tại.
- `cd design-system && node --test`: **510/510** (+2 ca helper).
- Không còn file backup trong repo (backup ở scratchpad). Backend/web không đổi ⇒ không chạy lane backend/web.

## Change Log

- 2026-10-23 — Story 11.1 dev: bộ sinh client tách sang `mobile/tool/codegen` (giống từng byte); thêm `flutter_bloc`/`equatable`/`bloc_test`; phiên, quyền, Đăng nhập, Quên mật khẩu, Menu chạy bằng Cubit (hành vi giữ nguyên, test cũ không đổi); guard "màn không gọi port" + allowlist 16 màn; text-guard đọc cả cubit/state. Status → review.
- 2026-10-23 — Review (AI): sửa H-1 helper text-guard đọc lẫn cubit màn khác (xanh giả), H-2 guard port mù với `AppPorts`, M-1 JSDoc tiếng Anh, M-2 File List, L-1 dọn `tool/codegen/lib` khi sinh lỗi. Status → done.
