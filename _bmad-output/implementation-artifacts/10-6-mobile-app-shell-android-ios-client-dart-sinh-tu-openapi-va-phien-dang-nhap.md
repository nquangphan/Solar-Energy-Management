---
baseline_commit: 14bf39e
---

# Story 10.6: Mobile: app shell, android/ios, client Dart sinh từ OpenAPI và phiên đăng nhập

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a nhân viên hiện trường,
I want app mobile cài được trên điện thoại và đăng nhập thật,
so that dùng app thay vì demo.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Story này là **bản sao mobile của 10.3** (web: client sinh + transport + phiên) **cộng** app-runtime (`main.dart`, `android/`, `ios/`). Khuôn web đã qua review + smoke — **chép luật, không chép cú pháp**. Đọc `web/src/api/{transport,api-error,session-store,http-auth-port}.ts` và story `10-3-…md` §4–§5 trước.

### 1. Hiện trạng (scout 2026-10-22, sau commit `14bf39e` = Story 10.5 done)

| Bề mặt | Hiện trạng |
|---|---|
| `mobile/` | Package `pns_mobile`, **không `lib/main.dart`, không `android/`, không `ios/`**, không `README`. `pubspec.yaml`: sdk `">=3.4.0 <4.0.0"`; deps `flutter_svg ^2.3.0`, `image_picker ^1.1.2`, `share_plus ^10.1.4`; dev `flutter_lints ^4.0.0`. Comment đầu file vẫn ghi "Minimal scaffold … Token layer scaffold" |
| Toolchain máy (đo `flutter doctor -v`) | **Flutter 3.35.0 / Dart 3.9.0** (fvm, `~/fvm/default`) — KHÔNG phải 3.44 như spine/project-context ghi. Android SDK 36.1, build-tools 36.1.0, NDK 27.0.12077973 (đúng `flutter.ndkVersion`), platform android-36, Gradle 8.12 có cache, JDK 21 của Android Studio. ⚠️ "Some Android licenses not accepted". AVD: `Pixel_9_Pro`, `Medium_Tablet`, `store_210_pixel`. Xcode 26.4 + CocoaPods 1.16.2 |
| Lane mobile baseline | `flutter analyze` **No issues found**; `flutter test` **455 xanh** |
| `lib/screens/auth/login_screen.dart` | Chỉ validate trình bày (rỗng, email-only từ 10.3); prop duy nhất `onForgotPassword?`; `_submit()` kết thúc bằng comment "gọi API đăng nhập + lưu JWT ở đây". Màn tự bọc `AppPhoneFrame` |
| `lib/design_system/session/` | 11 port + 11 fake + `app_session.dart` (`PermissionsProvider` InheritedWidget gọi `MePort.fetchMe()`); `MeResponse` khai tay (TODO thay bằng type sinh — **việc của 10.7**). **Không có port đăng nhập** |
| Kiểu lỗi màn mobile | **Nominal** (Dart): `on PaymentsPortError catch`, `e is ContractsPortError`, `e is InvoicesPortError` — KHÁC web (TS structural nên `ApiError` gán thẳng được). 10.6 chỉ đụng màn Đăng nhập; 10.7/10.8 phải xử lý chuyện này (xem §6 "Ngoài phạm vi") |
| `AppPhoneFrame` | **Khung điện thoại GIẢ của mockup**: thân đen 330px, kính cao cố định 700px, tai thỏ, status bar giả `9:41` / `5G · 82%`. **18 màn** tự bọc nó. Chạy trên điện thoại thật ⇒ "điện thoại trong điện thoại" (bẫy số 4) |
| Guard đang soi mobile | `design-system/session/parity.test.mjs` (bảng file đôi web↔mobile — web `auth-port.ts` ghi rõ "mobile twin lands with Story 10.6, so this file is not in the parity table yet"), `screens/login.test.mjs` (nhãn tiếng Việt hai bên giống từng byte), `components/shell-parity.test.mjs` (literal `width: 330.0`, `height: 700.0`, `0xFF0C1512`… trong `app_phone_frame.dart`), `money/money-render-guard.test.mjs` + `permissions/permission-keys.test.mjs` (chỉ quét `mobile/lib/screens` và `mobile/lib/design_system` ⇒ **`mobile/lib/api/` không bị quét**) |
| Backend auth (không đổi) | `POST /auth/login {email,password}` → `AuthTokensDto {accessToken, refreshToken, expiresIn}`; `POST /auth/refresh {refreshToken}` (rotate, single-use); `POST /auth/logout {refreshToken}` → 204 idempotent; `GET /me` Bearer. Không global prefix (route ở gốc). CORS không liên quan app native |
| `backend/openapi/openapi.json` | OpenAPI **3.0.0**, 58 path, 109 schema, 11 tag. 2 route multipart (`POST /orders/{id}/transition`, `POST /orders/{id}/attachments`, field `files`); **5 route nhị phân** (8 content type: `quote/image`, `quote/pdf`, `attachments/{attachmentId}`, `contracts/{contractId}/pdf`, `invoices/{invoiceId}/pdf`) khai `type: string, format: binary` |
| Root `.gitignore` | ignore `build`, `.dart_tool`, `bin/`, `assets/` (memory: `assets/` nuốt thư mục con), `.env*`. `git check-ignore` đã chạy cho `mobile/android/app/build.gradle.kts`, `mobile/android/gradle/wrapper/gradle-wrapper.jar`, `mobile/ios/Runner/Info.plist`, `mobile/lib/api/generated/x.g.dart`, `mobile/lib/main.dart` ⇒ **không file nào bị ignore** |

### 2. 🔥 BẪY SỐ 1 — `pub get` ra tổ hợp KHÔNG chạy được trên Dart 3.9

Đo thật 2026-10-22 trong scratch (bản sao `mobile/` + spec thật): để pub tự chọn, `json_serializable 6.14.1` (bản cuối hỗ trợ Dart 3.9; 6.15.x cần `^3.12`) đi với `source_helper 1.4.0` ⇒ `build_runner` **không biên dịch được build script**:

```
json_serializable-6.14.1/lib/src/utils.dart:222:35: Error: The method 'toStringNonNullable' is defined in multiple extensions for 'TypeParameterType' …
source_helper-1.4.0/lib/src/dart_type_extension.dart:57:10: Context: This is one of the extension members.
E Failed to compile build script.
```

**Tổ hợp đã đo là chạy được** (Flutter 3.35.0, `flutter pub add`): 

```yaml
environment:
  sdk: ^3.8.0            # json_serializable cảnh báo nếu language version < 3.8
dependencies:
  dio: ^5.11.1
  retrofit: ^4.10.0
  json_annotation: ^4.12.0   # json_serializable từ chối constraint cho phép < 4.12.0
  flutter_secure_storage: ^10.3.4   # pub chọn 10.3.4 trên Flutter 3.35 (11.x không giải được)
dev_dependencies:
  swagger_parser: ^1.45.0
  build_runner: ^2.15.1      # 2.17 cần Dart 3.11
  retrofit_generator: ^10.3.2
  json_serializable: ^6.14.1
  source_helper: 1.3.13      # GHIM CHÍNH XÁC — 1.4.0 xung đột extension với json_serializable 6.14.1
```

Với tổ hợp này: `swagger_parser` sinh **11 client, 82 request, 139 data class, 152 file** trong 0,04s; `build_runner` sinh 118 file `.g.dart` trong ~12s; `flutter analyze` toàn package (gồm code cũ) **No issues found**; xoá sạch + sinh lại **ra đúng byte** (so `shasum` 2 lần).

- `source_helper` là dev dependency **chỉ để ghim** — comment một dòng trong `pubspec.yaml` giải thích (tên + lý do), bỏ ghim khi lên Dart ≥ 3.12.
- **CẤM** nâng Flutter/Dart trong story này (đổi toàn bộ baseline 455 test) và **cấm** `dependency_overrides`.
- Đổi sdk lên `^3.8.0` = đổi language version của package ⇒ `dart format` từ nay dùng tall style (≥ 3.7). **KHÔNG chạy `dart format` toàn package** (memory `dart-format-writes-files-cascade`: nó ghi file kể cả với `--set-exit-if-changed`; kiểm tra thì dùng `-o none`). Chỉ format file mình tạo/sửa.
- Spine/project-context ghi Flutter 3.44: sửa bảng version trong `project-context.md` cho đúng máy (3.35.0 / Dart 3.9.0) cùng commit (G-5). Story 10.7 lưu ý: `go_router 18.x` cần Flutter ≥ 3.44 ⇒ phải chọn bản cũ hơn.

### 3. 🔥 BẪY SỐ 2 — code sinh tải nhị phân **SAI**: giải mã PDF bằng UTF-8

Đo thật: spec backend khai đúng chuẩn `type: string, format: binary` cho PDF/ảnh. `swagger_parser 1.45.0` biến nó thành:

```dart
@GET('/orders/{id}/contracts/{contractId}/pdf')
@DioResponseType(ResponseType.stream)
Stream<String> contractsControllerDownloadPdf({...});
// .g.dart:  (response) => utf8.decoder.bind(response.data!.stream)   ← PDF/PNG qua utf8 ⇒ FormatException / hỏng byte
```

README của swagger_parser: muốn `Stream<Uint8List>` thì schema phải là `type: integer, format: binary` (không chuẩn OpenAPI). **Không** sửa spec backend (AD-12 cấm sửa tay; web `openapi-typescript` sẽ type sai thành `number`).

**Cách đã đo là chạy được (mặc định tuyên bố trước — ghi vào epics.md theo G-5):** script sinh của mobile đọc `backend/openapi/openapi.json`, dựng **bản dẫn xuất** chỉ đổi `type: "string"` → `"integer"` ở schema `format: "binary"` nằm dưới content **khác `application/json`** của **response** (8 content trên 5 route: ảnh đính kèm có 4 kiểu jpeg/png/webp/heic), ghi ra `mobile/.dart_tool/pns_api/openapi.mobile.json` (gitignored, không commit), rồi chạy `swagger_parser` trên bản đó. Kết quả đo: 5 method thành `Stream<Uint8List>`, `.g.dart` trả `response.data!.stream` nguyên byte; `flutter analyze` sạch; vẫn đúng byte khi sinh lại.
- Phép biến đổi là **code** (một hàm thuần, có test riêng: đếm đúng 8 chỗ, không đụng request body multipart, không đụng JSON) — không phải sửa tay spec. Spec backend không đổi ⇒ drift-guard backend/web không bị ảnh hưởng.
- Đếm chỗ đổi phải **> 0** và **= số content `format: binary` của response trong spec gốc** (đếm độc lập trong test, hiện 8) (chống-guard-rỗng: backend đổi cách khai binary ⇒ test đỏ thay vì im lặng sinh `Stream<String>`).
- Adapter tải file là việc của 10.8; 10.6 chỉ cần code sinh **đúng kiểu** + transport parse được envelope lỗi khi body là stream (bẫy số 3, D8).
- **Multipart: đúng sẵn**, không cần đổi: `use_multipart_file: true` ⇒ `@Part(name: 'files') List<MultipartFile>`; field enum `event` gửi `event.toString()` và enum sinh ra override `toString() => json` ⇒ gửi `xong_giao`, không phải `Enum0.xongGiao` (đã đọc enum sinh). Enum inline của multipart bị đặt tên tự động `Enum0` — chấp nhận (code sinh), 10.8 dùng qua alias nếu cần.

### 4. 🔥 BẪY SỐ 3 — 401 không phải lúc nào cũng là "token hết hạn" (y hệt web)

| Endpoint | 401 nghĩa là | Transport phải |
|---|---|---|
| `POST /auth/login` | sai email/mật khẩu | **KHÔNG refresh**; ném `ApiError` (Banner "Thông tin đăng nhập không đúng") |
| `POST /auth/refresh` | refresh token sai/hết hạn/đã dùng | **KHÔNG refresh lại**; xoá phiên + báo hết phiên |
| `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` | public | **KHÔNG refresh**; ném `ApiError` |
| `POST /auth/change-password` | **mật khẩu hiện tại sai** | refresh 1 lần → phát lại → vẫn 401 ⇒ **ném `ApiError`, KHÔNG đăng xuất** |
| mọi route khác | access token hết hạn/thiếu | refresh 1 lần → phát lại |

Luật (= web, đã qua review M1 của 10.3): **(a)** không refresh 5 đường public `/auth/{login,refresh,logout,forgot-password,reset-password}`; **(b)** mỗi request phát lại **tối đa một lần**, phát lại vẫn 401 ⇒ `ApiError`, giữ phiên; **(c)** chỉ khi **chính lời gọi refresh** hỏng mới xoá phiên + `onSessionExpired` **đúng một lần**; **(d)** request gửi bằng token mà giờ token đã mất (`current == null && sent != null`) ⇒ ném hết phiên **không refresh, không callback** (401 về SAU khi refresh đã hỏng); **(e)** token hiện tại ≠ token đã gửi (request khác vừa refresh xong) ⇒ phát lại ngay, không refresh; **(f)** chỉ lấy `message` của envelope khi refresh trả **401**; 5xx/mạng ⇒ `'Phiên đăng nhập đã hết hạn. Đăng nhập lại.'`.

### 5. 🔥 BẪY SỐ 4 — `AppPhoneFrame` là khung mockup, không phải khung app

Mọi màn mobile (18 file) tự bọc `AppPhoneFrame` ⇒ trên máy thật sẽ vẽ thân đen 330px + status bar giả "9:41 / 5G · 82%" bên trong màn hình thật. Không sửa 18 màn, không đổi literal mà `shell-parity.test.mjs` ghim. **Cách làm (D12):** thêm chế độ "trần" cho `AppPhoneFrame` qua một `InheritedWidget` mà **chỉ app thật** đặt ở gốc; mặc định (test, demo) giữ nguyên khung mockup.

### 6. 🔥 BẪY SỐ 5 — `flutter create` đẻ thêm file làm đỏ lane

Đo thật (`flutter create --platforms=android,ios --org vn.phuongnamsolar --project-name pns_mobile .` trong bản sao): ngoài 71 file `android/`+`ios/`, nó tạo **`lib/main.dart`** (app đếm số), **`test/widget_test.dart`** (test `MyApp` — sẽ ĐỎ/không biên dịch khi `main.dart` bị thay), `README.md`, `mobile/.gitignore`, `.metadata`, `.idea/`, `pns_mobile.iml`. Không ghi đè file đã có (`pubspec.yaml`, `analysis_options.yaml` giữ nguyên — kiểm `git diff` ngay sau lệnh).
- Xoá `test/widget_test.dart`, `README.md` (boilerplate — luật repo không tạo markdown ngoài `docs/`/`plans/`), `.idea/`, `*.iml`. Giữ `.metadata` (flutter tool dùng), `mobile/.gitignore` (chuẩn Flutter).
- `android/app/src/main/AndroidManifest.xml` của template **không có quyền INTERNET** (chỉ có ở `src/debug` và `src/profile`) ⇒ bản release không gọi được mạng. Thêm vào manifest main.
- Android 9+ chặn HTTP cleartext ⇒ backend local `http://10.0.2.2:3000` chỉ chạy được nếu cho cleartext. Chỉ bật ở **`src/debug/AndroidManifest.xml`** (`android:usesCleartextTraffic="true"`), **không** ở main.
- `flutter_secure_storage` v10: minSdk 23 (template dùng `flutter.minSdkVersion` = **24** trên 3.35 — đủ, không cần sửa); README plugin khuyên `android:allowBackup="false"` (khôi phục backup Google Drive ⇒ `InvalidKeyException`) ⇒ đặt ở manifest main.
- `mobile/.flutter-plugins-dependencies` đang được **track** trong git (lạ, có từ trước) và `.gitignore` mới của Flutter ignore nó. Thêm plugin ⇒ file đổi. Mặc định: **không đổi trạng thái track** (không `git rm --cached`), commit bản mới cùng story; ghi vào Câu hỏi mở.

### 7. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Cây file** (snake_case theo quy ước Dart; ranh giới giống web: `design_system/` = trình bày + interface port + fake, `api/` = transport + adapter, `app/` = ráp màn, `main.dart` = composition root):

```
mobile/pubspec.yaml                          # sdk ^3.8.0 + deps §2; sửa comment đầu file (không còn "token scaffold")
mobile/swagger_parser.yaml                   # cấu hình bộ sinh (D2)
mobile/build.yaml                            # giới hạn json_serializable/retrofit_generator vào lib/api/generated/** (D3)
mobile/tool/generate_api.dart                # buildMobileSpec() + chạy swagger_parser + build_runner (D2)
mobile/lib/api/generated/**                  # GENERATED (.dart của swagger_parser + .g.dart của build_runner) — không sửa tay
mobile/lib/api/api_error.dart                # ApiError + 3 thông điệp + parseEnvelope (D7)
mobile/lib/api/transport.dart                # NƠI DUY NHẤT dựng Dio / chạm mạng; Bearer; envelope→ApiError; refresh single-flight (D8)
mobile/lib/api/session_store.dart            # access: bộ nhớ; refresh: flutter_secure_storage (D9)
mobile/lib/api/http_auth_port.dart           # AuthPort trên client sinh (D10)
mobile/lib/design_system/session/auth_port.dart       # interface (cạnh 11 port cũ)
mobile/lib/design_system/session/fake_auth_port.dart  # TEST/DEMO-ONLY
mobile/lib/app/pns_app.dart                  # PnsApp: restoring → Đăng nhập ↔ đã đăng nhập (D11)
mobile/lib/main.dart                         # composition root (D13)
mobile/android/, mobile/ios/                 # flutter create (bẫy 5, D14)
```

**D2 — Bộ sinh: `swagger_parser` + `retrofit` + `json_serializable` trên `dio`** (mặc định §6.10; không cần JVM). `swagger_parser.yaml`:

```yaml
swagger_parser:
  schema_path: .dart_tool/pns_api/openapi.mobile.json   # bản dẫn xuất của bẫy số 2 — tool/generate_api.dart ghi trước
  output_directory: lib/api/generated
  name: pns_api
  language: dart
  json_serializer: json_serializable
  root_client: true
  root_client_name: PnsApiClient
  export_file: true
  use_multipart_file: true
  mark_files_as_generated: true
```

- `tool/generate_api.dart` (chạy `dart run tool/generate_api.dart` trong `mobile/`): (1) `buildMobileSpec(String specJson) → ({String json, int binaryRewrites})` — hàm thuần, đọc spec gốc qua đường dẫn tính từ vị trí script (không từ cwd), ghi bản dẫn xuất; (2) xoá `lib/api/generated/` rồi `dart run swagger_parser`; (3) `dart run build_runner build --delete-conflicting-outputs`. Mã thoát ≠ 0 nếu bước nào hỏng. Không timestamp, không đường dẫn tuyệt đối trong output (đã kiểm: header sinh ra chỉ có `// coverage:ignore-file`, `// GENERATED CODE - DO NOT MODIFY BY HAND`, `// ignore_for_file: type=lint, …`).
- ⚠️ Hook `scout-block` của repo chặn lệnh Bash có chữ `build` (memory `scout-block-hook-dist-build-words`) ⇒ chạy `build_runner` qua `tool/generate_api.dart` hoặc qua file script viết bằng Write tool, không gõ thẳng lệnh.
- Tên method sinh theo `operationId` (vd `authControllerLogin`, `meControllerMe`) — đúng lý do 10.1 đổi `operationId` sang tiếng Anh. Không bật `path_method_name`.
- Enum sinh giữ giá trị tiếng Việt không dấu (`@JsonValue('xong_giao') xongGiao`) — đúng §6.6; là code sinh nên không vi phạm luật ngôn ngữ.

**D3 — `build.yaml`**: giới hạn builder vào code sinh để `build_runner` không quét `lib/`/`test/` cũ (nhanh hơn, không bất ngờ):

```yaml
targets:
  $default:
    builders:
      json_serializable:
        generate_for: [lib/api/generated/**]
      retrofit_generator:
        generate_for: [lib/api/generated/**]
```

(Kiểm tên builder thật bằng lỗi/cảnh báo của `build_runner`; nếu key khác thì sửa theo — ghi vào Debug Log.)

**D4 — Drift-guard** (AC-2): `test/api/generated_client_drift_test.dart` chạy trong `flutter test`:
- (a) **nhanh, luôn chạy:** `buildMobileSpec()` trên spec hiện tại phải ra đúng số chỗ đổi = số content nhị phân của response đếm độc lập từ spec gốc (> 0, hiện 8), và **mỗi** file `.dart` không phải `.g.dart` trong `lib/api/generated/` phải có `part '….g.dart'` tương ứng tồn tại khi nó khai `part`.
- (b) **đúng byte:** copy `pubspec.yaml`, `pubspec.lock`, `swagger_parser.yaml`, `build.yaml`, `tool/`, `lib/` sang thư mục tạm (`Directory.systemTemp`), `flutter pub get --offline`, chạy `dart run tool/generate_api.dart` ở đó, rồi so **từng file** của `lib/api/generated/` (cả `.dart` lẫn `.g.dart`) với bản trong repo — lệch/thiếu/thừa ⇒ ĐỎ, thông điệp chỉ tên file + lệnh regen. Ghi thời gian chạy đo được vào Debug Log (dự kiến 20–40s; nếu > 90s ghi lý do và đề xuất, không tự tắt test).
- Đường dẫn spec gốc tính từ `mobile/` (`../backend/openapi/openapi.json`), không từ cwd tuỳ ý.
- Test gọi tiến trình con: tìm `flutter`/`dart` qua biến môi trường `FLUTTER_ROOT` (`flutter test` đặt sẵn) ⇒ `$FLUTTER_ROOT/bin/flutter`, `$FLUTTER_ROOT/bin/dart`; KHÔNG dùng `Platform.resolvedExecutable` (là `flutter_tester`, không phải `dart`). Thiếu `FLUTTER_ROOT` ⇒ test FAIL kèm thông điệp, không `skip` im lặng.
- Khuôn "MỘT hàm sinh dùng chung cho script và guard" như web (`buildApiSchema()`) và `design-system/permissions/build-permission-keys.mjs` — **không** để script và test mỗi bên một đường sinh (bẫy số 2 của 10.3).

**D5 — `analysis_options.yaml`**: không cần exclude — mọi file sinh có `// ignore_for_file: type=lint, …` và đo thật `flutter analyze` sạch. Chỉ thêm `analyzer: exclude: [lib/api/generated/**]` nếu analyze báo lỗi thật trong code sinh (ghi lý do).

**D6 — Port đăng nhập** `design_system/session/auth_port.dart` (twin của web `auth-port.ts`, tên tiếng Anh):

```dart
abstract class AuthPort {
  /// POST /auth/login — throws ApiError (401 wrong credentials, 400 validation).
  Future<void> login({required String email, required String password});
  /// Start-up: trade the stored refresh token for an access token. false ⇒ show Đăng nhập.
  Future<bool> restoreSession();
  /// POST /auth/logout with the stored refresh token; ALWAYS clears the local session.
  Future<void> logout();
}
```

- Token **không** đi qua port. `FakeAuthPort({Object? throwWith, bool restored = false})` TEST/DEMO-ONLY, header comment theo khuôn `fake_password_port.dart`. Export qua `session.dart` (fake ở nhóm TEST/DEMO-ONLY cuối file).
- Thêm `'auth-port.ts': 'auth_port.dart'`, `'fake-auth-port.ts': 'fake_auth_port.dart'` vào bảng `parityFiles` của `design-system/session/parity.test.mjs` + một test "AuthPort có đúng 3 method `login`/`restoreSession`/`logout` ở cả hai nền tảng" (khuôn test password port dòng 65). Sửa comment đầu `web/src/design-system/session/auth-port.ts` (bỏ câu "Web-only for now…").

**D7 — `ApiError`** (`lib/api/api_error.dart`):

```dart
class ApiError implements Exception {
  ApiError(this.message, {this.status, this.code, this.fieldErrors, this.traceId});
  final String message;
  final int? status;          // vắng khi request không tới được backend
  final String? code;         // envelope.code (AD-5) — màn rẽ nhánh theo cái này
  final List<FieldErrorDto>? fieldErrors;   // type SINH (models/field_error_dto.dart), không khai tay
  final String? traceId;
  @override String toString() => message;
}
```

- 3 hằng thông điệp **giống từng byte web** (`web/src/api/api-error.ts`): `kGenericErrorMessage = 'Không thực hiện được. Thử lại.'`, `kNetworkErrorMessage = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'`, `kSessionExpiredMessage = 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.'`. Thêm một test vào `design-system/session/parity.test.mjs`: ba chuỗi xuất hiện nguyên văn ở cả `api-error.ts` và `api_error.dart` (chống-guard-rỗng: đọc được cả hai file, mỗi chuỗi khớp ≥ 1).
- `ApiError? parseEnvelope(Object? body)`: nhận `Map` | `String` (JSON) | `List<int>` (bytes, UTF-8) — trả null nếu không phải object có `code` + `message` là chuỗi; `fieldErrors` chỉ nhận phần tử có đủ `field`/`code`/`message` chuỗi (bỏ phần tử sai hình). Chỉ transport gọi nó.

**D8 — Transport** (`lib/api/transport.dart`) — tương đương `createTransport` web:

```dart
class Transport {
  Transport({required String baseUrl, required SessionStore session,
             HttpClientAdapter? adapter, void Function()? onSessionExpired});
  Dio get dio;                       // trao cho PnsApiClient ở composition root
  Future<bool> refreshSession();     // dùng chung single-flight (cho HttpAuthPort.restoreSession)
  Future<T> call<T>(Future<T> Function() request);   // gỡ DioException → ApiError cho adapter
}
```

- Dựng **một** `Dio(BaseOptions(baseUrl, connectTimeout: 15s, receiveTimeout: 60s))` + một `Interceptor` riêng (không `QueuedInterceptor` — nó tuần tự hoá MỌI lỗi, không phải single-flight). `adapter` tiêm được ⇒ test dùng `HttpClientAdapter` giả (không mạng thật) — tương đương `fetchImpl` của web.
- `onRequest`: gắn `Authorization: Bearer <access>` trừ 5 đường public (so path **đã bỏ baseUrl**, khớp nguyên segment — bài học L2 của 10.3).
- `onError` với `DioExceptionType.badResponse`: 401 trên route không public ⇒ áp luật bẫy 3; còn lại ⇒ `handler.reject(err.copyWith(error: <ApiError>))`. Envelope parse **ở đây và chỉ ở đây** — kể cả khi `responseType` là `stream` (body là `ResponseBody` ⇒ đọc hết `stream` thành bytes rồi `parseEnvelope`) hoặc `bytes`.
- Lỗi không tới được backend (`connectionError`, `connectionTimeout`, `sendTimeout`, `receiveTimeout`, `unknown` có `SocketException`) ⇒ `ApiError(kNetworkErrorMessage)` không status/code. `DioExceptionType.cancel` ⇒ để nguyên (tương đương `AbortError` web).
- **Refresh single-flight:** `Future<ApiError?>? _refreshing` (null = OK); refresh gọi bằng một `Dio` **trần thứ hai** (cùng `adapter`, cùng `baseUrl`, **không** interceptor) `POST /auth/refresh` với body `RefreshRequestDto(refreshToken: …).toJson()` (type sinh) đọc từ session **ngay lúc gọi**; OK ⇒ lưu **cả hai** token (backend rotate); kiểm response bằng `AuthTokensDto.fromJson` trong try (body lạ ⇒ coi như hỏng).
- **Phát lại:** `dio.fetch(err.requestOptions)` với header Bearer mới, đánh dấu `extra['pns.replayed'] = true` để không phát lại lần hai. Body là `FormData` ⇒ thay bằng `formData.clone()` trước khi phát lại (FormData đã gửi không gửi lại được — multipart của 10.8 đi đường này; có test).
- `call<T>()`: `try { return await request(); } on DioException catch (e) { if (e.error is ApiError) throw e.error!; if (e.type == DioExceptionType.cancel) rethrow; throw ApiError(kGenericErrorMessage); }` — để adapter **không import `package:dio`** và mọi lỗi tới màn đều là `ApiError`.

**D9 — Session store** (mặc định §6.14): `SessionStore` — access token biến trong bộ nhớ; refresh token qua interface tiêm được `SecureKeyValueStore { read, write, delete }`, bản production bọc `FlutterSecureStorage()` (mặc định `AndroidOptions()` của v10, không biometric), key `pns.refreshToken` (cùng tên key web). API: `String? get accessToken`, `Future<String?> readRefreshToken()`, `Future<void> setTokens({required String accessToken, required String refreshToken})`, `Future<void> clear()`. **Mọi** lời gọi secure storage bọc try/catch (`PlatformException` keystore/keychain ⇒ coi như không có token, không crash) — y như `localStorage` web. Test dùng store bộ nhớ, **một instance dùng chung** cho cả session lẫn assert (memory `session-store-factory-new-storage-false-red`).

**D10 — `HttpAuthPort`** (`lib/api/http_auth_port.dart`) = bản Dart của `http-auth-port.ts`: `login` gọi `client.auth.authControllerLogin(body: LoginRequestDto(...))` qua `transport.call`, lưu token vào session; `restoreSession` = không có refresh token ⇒ `false` (0 lời gọi mạng), có ⇒ `transport.refreshSession()`; `logout` gửi `authControllerLogout` nếu có refresh token, **nuốt lỗi**, `finally` xoá phiên.

**D11 — `LoginScreen` + `PnsApp`:**
- `LoginScreen({super.key, required this.port, required this.onLoggedIn, this.onForgotPassword})`. Submit: validate trình bày như cũ → `_busy = true` (nút `onPressed: null` khi busy ⇒ chặn bấm đôi) → `await port.login(...)` → `onLoggedIn()`; lỗi `ApiError` ⇒ Banner hiện `message` nguyên văn; lỗi khác ⇒ `kGenericErrorMessage` (không lộ chữ tiếng Anh). **Không đổi chuỗi nào** (guard `login.test.mjs`). Sửa comment đầu file + bỏ comment "Epic 2 (Story 2.3)…". Cập nhật mọi chỗ `const LoginScreen()` trong test sang `LoginScreen(port: FakeAuthPort(), onLoggedIn: () {})`.
- `lib/app/pns_app.dart` — `PnsApp({required AuthPort auth})`: `MaterialApp(debugShowCheckedModeBanner: false, title: 'Phương Nam Solar', home: …)` (màn cần Material ancestor cho `TextField`, như host của widget test); trạng thái `restoring | signedOut | signedIn`; khởi động gọi `auth.restoreSession()` (hiện `AppSkeleton` khi restoring); `signedIn` ⇒ khung tối thiểu dựng từ widget có sẵn (`AppPhoneFrame` + `AppBanner` info "Đã đăng nhập." + `AppButton` "Đăng xuất" gọi `auth.logout()` rồi về `signedOut`) — **cùng chữ với web 10.3**, 10.7 thay bằng `go_router` + `PermissionsProvider`. `onSessionExpired` của transport ⇒ `signedOut` (PnsApp nhận thêm `ValueListenable`/callback đăng ký từ composition root — chọn cách đơn giản nhất, ghi vào Completion Notes).
- **Quên mật khẩu chưa nối** ở 10.6: `onForgotPassword: null` (link không làm gì). Lý do: adapter password là AC của 10.7, và guard "composition root không import fake" của 10.7 sẽ cấm `FakePasswordPort` ở `main.dart` — không đặt một thứ phải gỡ ngay story sau. (Web 10.3 dùng fake có chủ đích; mobile chọn không, ghi vào epics.md G-5.)

**D12 — Chế độ "trần" của `AppPhoneFrame`** (bẫy số 4): thêm `AppPhoneFrameScope extends InheritedWidget { final bool bare; }` trong `app_phone_frame.dart`. `AppPhoneFrame.build`: nếu `AppPhoneFrameScope.maybeOf(context)?.bare == true` ⇒ trả `ColoredBox(color: AppTokens.surface, child: SafeArea(child: child))` (không thân đen, không tai thỏ, không status bar giả); ngược lại giữ **nguyên** code cũ (mọi literal `shell-parity` ghim còn đó). Chỉ `PnsApp` đặt `bare: true`. Widget test: mặc định vẫn có status bar giả `9:41`; dưới scope `bare` thì không có `9:41`, không có `SizedBox` rộng 330, child vẫn render. Export qua `shell.dart`.

**D13 — `main.dart` = composition root DUY NHẤT** (AC-1, spine AD-12):
- `const String apiBaseUrl = String.fromEnvironment('API_BASE_URL');` — **chỉ ở đây**. Rỗng ⇒ `runApp` một màn lỗi cấu hình dựng từ `AppErrorState`/`AppBanner` với chữ tiếng Việt "Chưa cấu hình địa chỉ máy chủ. Chạy lại với --dart-define=API_BASE_URL=…" và **không** dựng transport (không gọi mạng tới đâu cả). Không có giá trị mặc định hardcode (§6.17).
- Dựng `SessionStore(FlutterSecureStorageStore())` → `Transport(baseUrl, session, onSessionExpired: …)` → `PnsApiClient(transport.dio)` → `HttpAuthPort(client, session, transport)` → `runApp(PnsApp(auth: …))`. **Không import file `fake_*.dart` nào, không import barrel `session.dart`** (barrel re-export fake) — import thẳng `design_system/session/auth_port.dart` nếu cần type.
- `WidgetsFlutterBinding.ensureInitialized()` trước khi chạm secure storage.

**D14 — Android/iOS:**
- Lệnh: trong `mobile/`: `flutter create --platforms=android,ios --org vn.phuongnamsolar --project-name pns_mobile .` ⇒ `applicationId`/`namespace` = `vn.phuongnamsolar.pns_mobile`, bundle iOS `vn.phuongnamsolar.pnsMobile` (mặc định tuyên bố trước — đổi về sau là việc lớn khi đã phát hành, ghi Câu hỏi mở). Dọn file theo bẫy số 5.
- `android/app/src/main/AndroidManifest.xml`: `<uses-permission android:name="android.permission.INTERNET"/>`, `android:label="Phương Nam Solar"`, `android:allowBackup="false"`. `src/debug/AndroidManifest.xml`: thêm `android:usesCleartextTraffic="true"` trên `<application>` (chỉ debug).
- iOS: `CFBundleDisplayName` = "Phương Nam Solar". Không ATS exception, không ký, không build iOS (§6.22). `flutter analyze` sạch là đủ.
- Không thêm icon/splash riêng (YAGNI — dùng mặc định Flutter; ghi Câu hỏi mở).
- `flutter build apk --debug` phải exit 0. Nếu Gradle đòi chấp nhận license: **không tự chấp nhận thay Đại Ca** — ghi BLOCKED phần này, nhờ chạy `! flutter doctor --android-licenses`, làm tiếp phần còn lại.

### 8. Phạm vi

**TRONG:** `flutter create` android/ios + dọn; `pubspec.yaml` (sdk + deps §2); `swagger_parser.yaml`, `build.yaml`, `tool/generate_api.dart`, `lib/api/generated/**`; `ApiError`, `Transport`, `SessionStore`, `HttpAuthPort`; `AuthPort` + `FakeAuthPort` + parity; `LoginScreen` gọi port; `PnsApp`; `AppPhoneFrameScope`; `main.dart`; guard mạng; drift-guard; test transport/session/auth/login/app; smoke emulator; docs G-5.

**NGOÀI (đừng làm):** `go_router` + bottom-nav có route (10.7); adapter me/password/catalog/customers/warranty (10.7); `PermissionsProvider` nối `/me` thật (10.7); thay `MeResponse` khai tay bằng type sinh, viết lại fake theo type sinh (10.7); guard "composition root không import fake" (10.7 — nhưng `main.dart` 10.6 đã tuân sẵn); đổi tên method/field mobile theo contract + xoá `design-system/lib/web-mobile-contract-map.mjs` (10.8); adapter đơn/kho/tiền/chứng từ, tải PDF + `share_plus` (10.8); xử lý `*PortError` nominal ↔ `ApiError` cho các màn khác Đăng nhập (10.7/10.8 — ghi rõ trong Completion Notes để story sau không quên); Firebase (Epic 9); icon/splash; build/ký iOS; nâng Flutter; đăng nhập bằng SĐT.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:714-721`)

1. **Given** `mobile/` chưa có app-runtime, **When** dựng, **Then** có `lib/main.dart` là composition root duy nhất + thư mục `android/` và `ios/`; `flutter build apk --debug` chạy được; `ios/` có mặt và `flutter analyze` sạch, build iOS không là tiêu chí (mặc định §6.22).
2. **Given** `openapi.json`, **When** chạy script sinh client Dart (mặc định bộ sinh Dart thuần, ưu tiên `swagger_parser`, HTTP qua `dio`), **Then** client + model được sinh, cấm khai tay type contract (AD-12); drift-guard sinh lại ra đúng byte. Nếu phải đổi công cụ, ghi lý do vào spine/proposal cùng commit (G-5).
3. **Given** tầng transport Dart, **When** gọi API, **Then** chỉ transport chạm mạng (guard quét `mobile/lib`, chống-guard-rỗng); envelope AD-5 parse ở một chỗ; base URL từ `--dart-define=API_BASE_URL`.
4. **Given** port đăng nhập mới + màn Đăng nhập Flutter có sẵn, **When** đăng nhập, **Then** refresh token trong `flutter_secure_storage`, access token trong bộ nhớ; 401 ⇒ refresh một lần cho mọi request chờ; refresh hỏng ⇒ về Đăng nhập (mặc định §6.14, §6.15).
5. **Given** test, **When** `flutter test`, **Then** có ca transport: envelope 400 + fieldErrors, 401 → refresh → phát lại, refresh hỏng → đăng xuất; widget test màn Đăng nhập với port giả lập HTTP.

### AC dẫn xuất (đo được)

6. **Toolchain (bẫy 1):** `pubspec.yaml` có sdk `^3.8.0` + đúng bộ deps §2 (`source_helper: 1.3.13` ghim chính xác, có comment lý do); không `dependency_overrides`; `pubspec.lock` commit; Flutter máy vẫn 3.35.0.
7. **Sinh client (AC-2):** `dart run tool/generate_api.dart` exit 0; `lib/api/generated/` có `pns_api_client.dart` (`PnsApiClient`), `export.dart`, 11 thư mục client + `models/`; 5 method nhị phân trả `Stream<Uint8List>` (grep `Stream<String>` trong `lib/api/generated` ⇒ rỗng); 2 method multipart nhận `List<MultipartFile>`; `grep -rn "class .*Dto\b" lib --include=*.dart` ngoài `lib/api/generated/` không có class mới nào khai tay type contract (chỉ `MeResponse` cũ — 10.7).
8. **Drift-guard (AC-2, D4):** test đỏ khi (i) sửa 1 ký tự trong một file `.dart` sinh, (ii) sửa 1 ký tự trong một `.g.dart`, (iii) xoá một file sinh, (iv) thêm field vào một schema trong `openapi.json` mà không regen mobile, (v) `buildMobileSpec` không đổi chỗ nào (mutant `return` spec gốc). Ghi thời gian chạy.
9. **Guard mạng (AC-3):** `test/api/no_network_outside_transport_test.dart` quét mọi `.dart` trong `lib/` **trừ** `lib/api/generated/**`: cấm `import 'package:dio/…'`, `package:http/`, `package:web_socket_channel`, `dart:html`, `package:web/`, và trên code đã bỏ comment + chuỗi: `Dio(`, `HttpClient(`, `Socket.connect`, `RawSocket`, `WebSocket.connect`, `HttpRequest` — ngoại lệ DUY NHẤT `lib/api/transport.dart`. Tự kiểm dương: `transport.dart` **phải** khớp `Dio(` thật (không phải chữ ký/comment — memory `guard-positive-selfcheck-matches-signature`); số file quét ≥ 60 (hiện `lib/` có 79 file tay); bộ bỏ comment hiểu chuỗi (`'a//b'` không nuốt nửa dòng — M2 của 10.3) và luật import chạy trên bản **giữ chuỗi** (memory `striptocode-deletes-string-literals`). Có ca âm: chữ `Dio(` trong comment/chuỗi không đỏ.
10. **Một chỗ parse envelope (AC-3):** `parseEnvelope(` chỉ được gọi trong `transport.dart` (grep/assert trong guard mạng); adapter không import `package:dio`.
11. **Base URL (AC-3, D13):** `String.fromEnvironment('API_BASE_URL')` xuất hiện đúng một lần, ở `main.dart`; không chuỗi `http://`/`https://`/`10.0.2.2`/`localhost` nào trong `lib/` ngoài `lib/api/generated/` (assert trong guard mạng). Thiếu define ⇒ màn lỗi cấu hình, 0 request (widget test với `PnsApp` không cần — test hàm dựng app lỗi cấu hình).
12. **Transport (AC-4, AC-5)** — `test/api/transport_test.dart` với `HttpClientAdapter` giả, mỗi ca đếm số request thật:
    - (a) 400 envelope + `fieldErrors` ⇒ `ApiError(status 400, code, fieldErrors[0].field)`, phần tử `fieldErrors` sai hình bị bỏ;
    - (b) body không phải envelope (HTML 502, rỗng) ⇒ `kGenericErrorMessage`, `status` = HTTP status;
    - (c) lỗi kết nối ⇒ `kNetworkErrorMessage`, không status;
    - (d) 401 → refresh → phát lại thành công, token mới được lưu (cả refresh mới);
    - (e) **hai** request 401 đồng thời ⇒ **đúng một** `POST /auth/refresh`, cả hai phát lại thành công;
    - (f) refresh trả 401 ⇒ session rỗng (cả secure store), `onSessionExpired` gọi **đúng 1 lần**, request ném `ApiError(401, UNAUTHENTICATED)` với message của envelope refresh;
    - (g) hai 401 đồng thời + refresh hỏng ⇒ expired 1 lần; **401 về SAU khi refresh đã hỏng** ⇒ không refresh lần 2, không callback lần 2 (giữ refresh treo bằng `Completer`, thả một request về muộn — memory `held-gate-concurrency-test-misses-late-arrival`);
    - (h) refresh 5xx/mạng ⇒ `kSessionExpiredMessage`;
    - (i) 401 trên 5 đường public ⇒ 0 refresh, `ApiError` của chính envelope; không gắn Bearer ở đó;
    - (j) phát lại vẫn 401 (change-password) ⇒ `ApiError`, **phiên giữ nguyên**, đúng 1 refresh;
    - (k) không có refresh token mà gặp 401 ⇒ expired, 0 lời gọi refresh;
    - (l) Bearer gắn ở route thường, đổi sang token mới khi phát lại;
    - (m) phát lại `FormData` gửi được (body multipart thứ hai không rỗng) — mutant bỏ `clone()` ⇒ ĐỎ hoặc ném "FormData already finalized";
    - (n) lỗi 4xx khi `responseType: stream`/`bytes` ⇒ envelope vẫn được parse (message nguyên văn);
    - (o) `CancelToken.cancel()` ⇒ `DioException` cancel đi nguyên, không expired.
13. **Session store (AC-4, D9):** test: `setTokens` ghi refresh vào store tiêm, access chỉ ở bộ nhớ (store không có key nào chứa access token); store ném lỗi ở `read/write/delete` ⇒ `readRefreshToken()` trả null / không ném; `clear()` xoá cả hai.
14. **HttpAuthPort (D10):** login 200 ⇒ có token; login 401 ⇒ ném `ApiError` "Thông tin đăng nhập không đúng" và **không** ghi token; logout xoá phiên kể cả khi mạng hỏng; restore không token ⇒ `false`, **0** request; restore OK/hỏng.
15. **Widget test Đăng nhập (AC-5):** `LoginScreen` với **`HttpAuthPort` thật + transport + adapter HTTP giả** (không `FakeAuthPort`): đúng email/mật khẩu ⇒ `onLoggedIn` gọi 1 lần, request `POST /auth/login` mang đúng body; 401 envelope ⇒ Banner hiện nguyên văn message, `onLoggedIn` không gọi, nút bật lại; đang busy bấm lần hai ⇒ vẫn 1 request. Các test `login_screen_test.dart` cũ vẫn xanh (nhãn/validate không đổi).
16. **App flow (D11):** widget test `PnsApp` với port HTTP giả lập: không có refresh token ⇒ Đăng nhập; đăng nhập ⇒ "Đã đăng nhập."; Đăng xuất ⇒ về Đăng nhập + `POST /auth/logout` + store rỗng; refresh token hợp lệ lúc khởi động ⇒ vào thẳng "Đã đăng nhập."; `onSessionExpired` ⇒ về Đăng nhập.
17. **Khung trần (D12):** widget test hai chế độ (mục D12); `shell-parity.test.mjs` + `shell_render_test.dart` vẫn xanh **không sửa assert**.
18. **Parity (D6, D7):** `design-system` `npm test` xanh, số test **tăng** (bảng file đôi có auth, test 3 method, test 3 chuỗi thông điệp); không xoá/nới assert nào.
19. **Android (AC-1, D14):** `flutter build apk --debug` exit 0 (ghi kích thước + thời gian); manifest main có INTERNET + `allowBackup="false"`, cleartext chỉ ở debug; `test/widget_test.dart` của template không còn; `git status` không có `.idea/`, `*.iml`, `README.md` mới trong `mobile/`.
20. **Smoke thật trên emulator** (luật 12–13 của automator, §6.21): `pns-postgres` 5433 + backend `npm run start:prod` (`JWT_ACCESS_SECRET` ngẫu nhiên ≥ 32 ký tự **trên lệnh**, không đọc/sửa `.env`) + AVD `Pixel_9_Pro`, `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000`: account smoke riêng `smoke-10-6@local.test` (mật khẩu ngẫu nhiên, băm **argon2id** như `PasswordService` — backend dùng argon2, KHÔNG bcrypt; script chặn mọi DB khác `localhost:5433`); (i) sai mật khẩu ⇒ Banner; (ii) đăng nhập đúng ⇒ "Đã đăng nhập.", màn **không** có khung điện thoại giả; (iii) tắt hẳn app rồi mở lại ⇒ vẫn đăng nhập (refresh token từ secure storage; bảng `sessions` cho đúng 1 lần rotate); (iv) Đăng xuất ⇒ về Đăng nhập, phiên revoked ở DB; (v) mở lại ⇒ Đăng nhập. Dọn: xoá account smoke, tắt backend + emulator nếu mình bật, cổng 3000 trống. Ghi kết quả vào Dev Agent Record.
21. **5 lane xanh:** mobile `flutter analyze` sạch + `flutter test` (> 455, không xoá test cũ); design-system `npm test`; web `npm run typecheck && npm test && npm run build` (chỉ đổi comment `auth-port.ts` — xác nhận); backend `npm test` + `npm run test:db` (không đổi backend — xác nhận không vỡ; `openapi.json` byte không đổi).
22. **G-5 cùng commit:** bullet "Tinh chỉnh khi làm story (quyết 2026-10-22, Story 10.6)" vào `epics.md` Story 10.6 (bộ deps + ghim `source_helper` + sdk `^3.8.0`; bản spec dẫn xuất cho route nhị phân; Quên mật khẩu chưa nối; `applicationId`; khung trần; Flutter thật 3.35); `project-context.md` (bảng version Flutter đúng máy; thay câu "`mobile/` chưa có `main.dart`/`android/`/`ios/` …" bằng mô tả lệnh sinh/transport/composition root mobile); spine `ARCHITECTURE-SPINE.md` §Deferred dòng codegen: ghi mobile đã có ở 10.6 + bản dẫn xuất nhị phân (không đổi công cụ ⇒ không cần sửa proposal); `docs/van-hanh-go-live.md` thêm mục ngắn "Mobile gọi backend" (lệnh `--dart-define`, HTTP chỉ ở debug, release cần HTTPS).

---

## Tasks / Subtasks

- [x] **T1 — App-runtime Android/iOS** (AC-1, AC-19, bẫy 5, D14)
  - [x] `flutter create --platforms=android,ios --org vn.phuongnamsolar --project-name pns_mobile .` trong `mobile/`; `git diff mobile/pubspec.yaml mobile/analysis_options.yaml` ⇒ rỗng
  - [x] Xoá `test/widget_test.dart`, `README.md`, `.idea/`, `*.iml`; giữ `.metadata`, `mobile/.gitignore`
  - [x] Manifest main: INTERNET, label, `allowBackup="false"`; debug manifest: `usesCleartextTraffic="true"`; iOS `CFBundleDisplayName`
  - [x] `git check-ignore` mọi file mới trong `android/` `ios/` (memory `dot-gitignore-assets-swallows-backend-assets`)
- [x] **T2 — Dependencies** (AC-6, bẫy 1): sửa sdk `^3.8.0`; `flutter pub add` đúng bộ §2; comment ghim `source_helper`; sửa comment đầu `pubspec.yaml`; `flutter analyze` + `flutter test` vẫn 455 xanh trước khi viết code mới
- [x] **T3 — Bộ sinh + drift-guard** (AC-2, AC-7, AC-8, bẫy 2, D2–D5)
  - [x] `swagger_parser.yaml`, `build.yaml`, `tool/generate_api.dart` (`buildMobileSpec` thuần + 3 bước)
  - [x] Sinh `lib/api/generated/**`; grep `Stream<String>` rỗng; analyze sạch
  - [x] `test/api/generated_client_drift_test.dart` (a) + (b); test riêng cho `buildMobileSpec` (8 chỗ, không đụng multipart request/JSON)
  - [x] Mutation AC-8 (i)–(v) (backup `cp`, KHÔNG `git checkout` — memory `mutation-test-never-git-checkout`)
- [x] **T4 — ApiError + SessionStore** (AC-13, D7, D9) + test
- [x] **T5 — Transport** (AC-3, AC-4, AC-12, bẫy 3, D8) + 15 ca (a)–(o); mutation: bỏ single-flight, bỏ chặn "token đã mất", refresh cả đường public, bỏ giới hạn phát lại 1 lần, bỏ `clone()` FormData, lấy message mọi envelope refresh ⇒ mỗi mutant ĐỎ đúng ca của nó (mutant phải biên dịch — memory `mutation-must-compile-or-false-red`)
- [x] **T6 — AuthPort + FakeAuthPort + HttpAuthPort + parity** (AC-14, AC-18, D6, D10); sửa comment `web/.../auth-port.ts`
- [x] **T7 — LoginScreen gọi port + PnsApp + khung trần** (AC-15, AC-16, AC-17, D11, D12); cập nhật test cũ dùng `const LoginScreen()`
- [x] **T8 — `main.dart` composition root** (AC-1, AC-11, D13)
- [x] **T9 — Guard mạng** (AC-9, AC-10, AC-11) + tự kiểm dương/âm; mutation: chèn `Dio()` vào một màn, `HttpClient()` vào `app/`, `import 'package:dio/dio.dart'` vào `http_auth_port.dart`, URL `http://` vào `main.dart`, `transport.dart` giấu `Dio(` ⇒ ĐỎ cả 5
- [x] **T10 — Build APK + smoke emulator** (AC-19, AC-20)
- [x] **T11 — 5 lane + docs G-5** (AC-21, AC-22); cập nhật File List; story → `review`

---

## Dev Notes

### Quyết định đã chốt — không bàn lại

- Mặc định §6.10/§6.14/§6.15/§6.17/§6.22 của proposal và AD-12 "Luật client". Bộ sinh vẫn là `swagger_parser` (không đổi công cụ) — bản spec dẫn xuất cho route nhị phân là cách dùng công cụ, không phải đổi công cụ; nếu dev đo thấy cách này hỏng mà phải đổi bộ sinh thì ghi lý do vào spine + proposal cùng commit (AC-2).
- Luật 401/refresh = web 10.3 sau review (bẫy 3). Không làm refresh chủ động theo `expiresIn` (YAGNI).
- Email-only (quyết 10.3): giữ nguyên chuỗi `'Email đăng nhập'`, `'Tài khoản phải là email hợp lệ.'`.
- Không BLoC/Cubit ở 10.6: app dùng `InheritedWidget`/`StatefulWidget` như `PermissionsProvider` (YAGNI, đã quyết ở 2.6).

### Files sẽ đổi / tạo

| File | Việc |
|---|---|
| `mobile/pubspec.yaml`, `mobile/pubspec.lock`, `mobile/.flutter-plugins-dependencies` | deps + sdk (T2) |
| `mobile/swagger_parser.yaml`, `mobile/build.yaml`, `mobile/tool/generate_api.dart` (MỚI) | bộ sinh |
| `mobile/lib/api/generated/**` (MỚI, GENERATED) | client + model |
| `mobile/lib/api/{api_error,transport,session_store,http_auth_port}.dart` (MỚI) | tầng api |
| `mobile/lib/design_system/session/{auth_port,fake_auth_port}.dart` (MỚI), `session.dart` | port |
| `mobile/lib/design_system/shell/app_phone_frame.dart`, `shell.dart` | `AppPhoneFrameScope` |
| `mobile/lib/screens/auth/login_screen.dart` | nhận port |
| `mobile/lib/app/pns_app.dart`, `mobile/lib/main.dart` (MỚI) | app + composition root |
| `mobile/android/**`, `mobile/ios/**`, `mobile/.metadata`, `mobile/.gitignore` (MỚI) | flutter create |
| `mobile/test/api/{generated_client_drift,build_mobile_spec,transport,session_store,http_auth_port,no_network_outside_transport}_test.dart` (MỚI) | test |
| `mobile/test/app/pns_app_test.dart` (MỚI), `mobile/test/screens/auth/login_screen_test.dart`, `mobile/test/design_system/shell_render_test.dart` (thêm ca khung trần) | test |
| `design-system/session/parity.test.mjs` | auth twin + 3 thông điệp |
| `web/src/design-system/session/auth-port.ts` | chỉ comment |
| `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/project-context.md`, `…/ARCHITECTURE-SPINE.md`, `docs/van-hanh-go-live.md` | G-5 |

### Hiện trạng phải giữ

- 455 test mobile, đặc biệt `login_screen_test.dart` (nhãn, không topbar/bottom-nav — UX-DR-15), `shell_render_test.dart` (khung mockup mặc định), mọi màn khác vẫn dùng `AppPhoneFrame` mặc định trong test.
- `design-system/screens/login.test.mjs` (nhãn hai bên giống byte), `components/shell-parity.test.mjs` (literal khung), `session/parity.test.mjs` (bảng file đôi + `MeResponse`/port cũ chưa đổi), `lib/web-mobile-contract-map.mjs` (mobile giữ tên cũ tới 10.8 — **không đổi tên field/method mobile nào** ở story này).
- `PermissionsProvider`/`MePort`/`MeResponse` không đổi (10.7).
- Backend và `openapi.json` không đổi một byte.

### Tình huống biên đã tính

- Secure storage hỏng (keystore reset, restore backup) ⇒ coi như chưa đăng nhập, không crash (D9); `allowBackup=false` giảm khả năng xảy ra.
- Mở app khi backend tắt: `restoreSession` gặp lỗi mạng ⇒ refresh hỏng ⇒ xoá phiên, về Đăng nhập (= D6/L4 web, giữ theo §6.15 "refresh hỏng ⇒ về Đăng nhập"). Đổi hành vi này cần Đại Ca quyết.
- `onSessionExpired` gọi khi app đang ở Đăng nhập ⇒ no-op.
- Đăng xuất khi mạng hỏng ⇒ vẫn về Đăng nhập, secure store rỗng.
- Thiếu `API_BASE_URL` ⇒ màn lỗi cấu hình, không request.
- Hai lần bấm Đăng nhập nhanh ⇒ một request (busy).

### Kiểm thử — luật dự án áp dụng trực tiếp

- Màn mobile mới/sửa ⇒ widget test (luật 4; memory `mobile-screens-need-widget-tests`). `PnsApp` là màn mới.
- Source-guard mới ⇒ assert chống-guard-rỗng (luật 5) + mutate thứ được bảo vệ, đòi ĐỎ (memory `source-guards-mutate-for-false-pass`).
- Widget test gate: fixture phải bật mọi điều kiện bao ngoài (memory `widget-test-gate-unreachable-outer-condition`) — ví dụ test "khung trần" phải chứng minh `AppPhoneFrame` thật sự nằm trong cây.
- Test đồng thời: giữ refresh bằng `Completer` và thả request về **sau** khi refresh hỏng (memory `held-gate-concurrency-test-misses-late-arrival`).
- Đếm lời gọi bằng số request adapter giả nhận (`toHaveBeenCalledTimes(1)` tương đương — memory `publish-count-unasserted-duplicate-survives`).

### Previous Story Intelligence (10.5, commit `14bf39e`; 10.3, commit `cb30dee`)

- 10.3: CLI và API sinh khác byte ⇒ một hàm sinh duy nhất; tự kiểm dương guard mạng từng khớp nhầm chữ ký ⇒ siết bằng lời gọi thật; review M1 (expired 2 lần khi 401 về muộn), M2 (guard mạng mù 8 dạng: alias, `globalThis['fetch']`, comment `'a//b'`…), L1 (message refresh 5xx), L2 (khớp baseUrl lỏng), L3 (abort lúc phát lại) — **viết test cho cả 5 điểm này từ đầu ở Dart**.
- 10.3 smoke: backend băm **argon2id**; `JWT_ACCESS_SECRET` tiêm trên lệnh; StrictMode web chạy effect 2 lần nhưng single-flight giữ 1 lần rotate — mobile kiểm bảng `sessions` tương tự.
- 10.5: tên field/method mobile giữ cũ qua `web-mobile-contract-map.mjs` tới 10.8; MinIO smoke dùng cổng 9200 vì 9100 bị chiếm (10.6 không cần storage).
- 10.4/10.5: `fieldErrors[].message` luôn tiếng Việt từ backend ⇒ mobile hiện nguyên văn.

### Git intelligence

- 5 commit gần nhất đều là Epic 10 (`bf4e520` → `14bf39e`): web-only + backend contract. Khuôn commit: `feat(story-10.x): …` tiếng Anh, `git add` đường dẫn cụ thể, `pubspec.lock` (mobile không bị ignore — khác `package-lock.json`), KHÔNG push.

### Latest tech notes (đo 2026-10-22, pub.dev + spike scratch)

- Bản mới nhất trên pub: `swagger_parser 1.45.0` (sdk ^3.6), `dio 5.11.1`, `retrofit 4.10.0`, `retrofit_generator 10.3.2` (^3.9), `json_serializable 6.15.2` (**^3.12** — không dùng được), `build_runner 2.17.1` (**^3.11** — không dùng được), `flutter_secure_storage 11.2.0` (pub chọn 10.3.4 trên Flutter 3.35), `go_router 18.1.1` (**Flutter ≥ 3.44** — lưu ý 10.7).
- `flutter_secure_storage` v10: cipher tự cài (RSA OAEP + AES-GCM), bỏ `encryptedSharedPreferences`; minSdk 23; khuyên `allowBackup=false`.
- Flutter 3.35 template: `minSdk = flutter.minSdkVersion` (24), `compileSdk`/`targetSdk` 36, NDK `27.0.12077973` — máy có sẵn cả ba.
- Dio: `FormData.clone()` để gửi lại multipart; `ResponseType.stream` ⇒ body lỗi là `ResponseBody`.

### Project Structure Notes

- `mobile/lib/api/` mới, song song `web/src/api/`; interface port ở `design_system/session/` như web. `lib/app/` song song `web/src/app/`.
- Lệch có chủ đích so với web: refresh token đọc **bất đồng bộ** (secure storage) ⇒ `SessionStore.readRefreshToken()` là `Future`; transport đọc nó trong `renew()`; `restoreSession` vẫn single-flight.
- Không sửa spine ngoài dòng Deferred (AD-12 đã có luật client).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. `applicationId` `vn.phuongnamsolar.pns_mobile` / bundle `vn.phuongnamsolar.pnsMobile` — Đại Ca có tên miền/định danh công ty khác không? Đổi sau khi đã phát hành lên store là phát hành app mới.
2. Mở app khi backend tạm tắt ⇒ bị đăng xuất (refresh hỏng vì mạng = refresh hỏng). Giữ như web; muốn "chỉ đăng xuất khi 401" thì quyết cho cả hai nền tảng.
3. `mobile/.flutter-plugins-dependencies` đang được track dù chứa đường dẫn máy — giữ track (mặc định) hay `git rm --cached`?
4. Icon/splash/tên app trên launcher: dùng mặc định Flutter + nhãn "Phương Nam Solar" cho tới khi có asset thương hiệu.
5. Màn Quên mật khẩu trên mobile chưa nối tới 10.7 (link không phản hồi).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 10, Story 10.3 (tinh chỉnh), 10.6, 10.7, 10.8]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-22.md` §2.4, §3, §6.10, §6.14, §6.15, §6.17, §6.20–§6.22]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-5, AD-12 (Luật client), AD-13, §Deferred codegen]
- [Source: `_bmad-output/project-context.md` §Testing (Web tooling), §Development Workflow (Ngôn ngữ)]
- [Source: `_bmad-output/implementation-artifacts/10-3-web-client-sinh-tu-openapi-phien-dang-nhap-va-xu-ly-loi-mot-cho.md` §4–§5, Senior Developer Review]
- [Source: `web/src/api/transport.ts`, `api-error.ts`, `session-store.ts`, `http-auth-port.ts`; `web/src/design-system/session/{auth-port,fake-auth-port}.ts`]
- [Source: `mobile/lib/screens/auth/login_screen.dart`, `mobile/lib/design_system/session/{me_port,password_port,fake_password_port,app_session,session}.dart`, `mobile/lib/design_system/shell/app_phone_frame.dart`]
- [Source: `design-system/session/parity.test.mjs`, `design-system/screens/login.test.mjs`, `design-system/components/shell-parity.test.mjs`]
- [Source: `backend/openapi/openapi.json` — `/auth/*`, `/me`, `ErrorEnvelopeDto`, `FieldErrorDto`, route multipart/nhị phân]
- [Source: swagger_parser README (github.com/Carapacik/swagger_parser) — mục "Generate `Stream<Uint8List>`"; flutter_secure_storage README — Android notice + auto backup]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- `flutter pub add` (Flutter 3.35.0) khoá đúng bộ §2: dio 5.11.1, retrofit 4.10.0, json_annotation 4.12.0, flutter_secure_storage 10.3.4, swagger_parser 1.45.0, build_runner 2.15.1, retrofit_generator 10.3.2, json_serializable 6.14.1, source_helper 1.3.13. Baseline sau đổi deps: analyze sạch, 455 xanh.
- `build.yaml`: key builder thật là `json_serializable`, `retrofit_generator` và thêm `source_gen:combining_builder` (cả ba chỉ chạy trên 152 input của `lib/api/generated/**`). build_runner 2.15 báo `--delete-conflicting-outputs` đã bị bỏ ⇒ script gọi `build_runner build` không cờ.
- Sinh: 11 client, 82 request, 139 data class; 270 file `.dart` trong đó 118 `.g.dart`; 5 method `Stream<Uint8List>`, 0 `Stream<String>`, 2 method `List<MultipartFile>`. `dart run tool/generate_api.dart` ~15s.
- Drift-guard byte-for-byte: **15–16s** (pub get offline + script trong `Directory.systemTemp`). Thư mục tạm chỉ chép `pubspec.yaml/.lock`, `swagger_parser.yaml`, `build.yaml`, `analysis_options.yaml`, `tool/` (không cần `lib/`: script xoá và sinh lại `lib/api/generated` từ đầu).
- `DioExceptionType.transformTimeout` (dio 5.11) ⇒ xếp vào nhóm lỗi mạng.
- Widget test chạy Dio trong fake-async zone ⇒ `runAsync` không đẩy được; dùng `tester.pump(10ms)` lặp 10 lần.
- Mutation (backup `cp`, không `git checkout`; mỗi mutant biên dịch được):
  - Drift AC-8: (i) sửa 1 ký tự `auth_client.dart`, (ii) sửa `field_error_dto.g.dart`, (iii) xoá `auth_tokens_dto.g.dart`, (iv) thêm field vào `AuthTokensDto` trong `openapi.json`, (v) `buildMobileSpec` không đổi chỗ nào ⇒ **5/5 ĐỎ**; khôi phục ⇒ xanh, `openapi.json` cùng shasum.
  - Transport T5: bỏ single-flight ⇒ (e)+(g) đỏ; bỏ chặn "token đã mất" ⇒ (g); refresh cả đường public ⇒ (i); bỏ giới hạn phát lại ⇒ (j) (lặp vô hạn, hết 30s); bỏ `clone()` FormData ⇒ (m); lấy message mọi envelope refresh ⇒ (h) — **6/6 ĐỎ đúng ca**.
  - Guard mạng T9: `net.Dio()` (alias) trong màn Đăng nhập, `io.HttpClient()` trong `app/`, import dio vào `http_auth_port.dart`, `defaultValue: 'http://10.0.2.2:3000'` trong `main.dart`, `transport.dart` đổi sang `Dio.new(` (giấu `Dio(`), `'${Socket.connect}'` trong interpolation, `parseEnvelope` gọi ngoài transport, `fromEnvironment` thứ hai ⇒ **8/8 ĐỎ**.
  - Thêm: `PnsApp` `bare: false` ⇒ test app đỏ; LoginScreen bỏ `onPressed: _busy ? null` ⇒ ca busy đỏ (lớp `if (_busy) return` thứ hai không với tới được qua UI khi nút đã tắt — giữ làm phòng thủ); đổi 1 ký tự `kNetworkErrorMessage` ⇒ parity design-system đỏ.
- `flutter build apk --debug`: exit 0, **43s** lần đầu, APK **148.371.201 byte (~141,5 MiB)**; không vướng Android license.
- Smoke: emulator boot từ snapshot cũ bị nghẽn (`pm install` treo >15 phút) ⇒ tắt, cold boot `-no-snapshot`, tạm tắt `package_verifier_enable`/`verifier_verify_adb_installs` của AVD để cài qua adb rồi **bật lại** khi dọn.

### Completion Notes List

- **Sinh client (AC-2):** `swagger_parser` + `retrofit`/`json_serializable` trên `dio` (không đổi công cụ). `tool/generate_api.dart` có `buildMobileSpec` thuần: chỉ đổi `type: string → integer` ở schema `format: binary` của response khác JSON (8 content / 5 route) ⇒ tải file là `Stream<Uint8List>`; spec backend không đổi một byte. Script và drift-guard dùng CHUNG một đường sinh. `test/api/build_mobile_spec_test.dart` đếm độc lập (8, > 0), chứng minh hoàn tác phép đổi ra lại đúng spec gốc, không đụng multipart/JSON.
- **Transport (AC-3/4/5):** `lib/api/transport.dart` — một `Dio` + `InterceptorsWrapper` (không `QueuedInterceptor`) và một `Dio` trần cho refresh; Bearer trừ 5 đường public (so path sau khi bỏ base path, khớp nguyên segment); envelope parse chỉ ở đây (kể cả body `ResponseType.stream`/`bytes`); luật 401 (a)–(f) giống web 10.3; phát lại tối đa 1 lần, `FormData.clone()`; `call<T>()` gỡ `DioException` ⇒ adapter không import dio. 16 ca test (a)–(o) + biến thể khớp segment.
- **Phiên (D9):** access token trong bộ nhớ, refresh token qua `SecureKeyValueStore` (production = `FlutterSecureStorage`), key `pns.refreshToken`; mọi lỗi storage nuốt ⇒ "không có token".
- **AuthPort + HttpAuthPort + FakeAuthPort (D6/D10)**, parity: bảng file đôi thêm auth, test 3 method + "không token trên port", test 3 thông điệp lỗi giống từng byte web↔mobile. design-system 495 → **497**.
- **LoginScreen** nhận `port` + `onLoggedIn`; busy ⇒ nút tắt; `ApiError` ⇒ Banner nguyên văn, lỗi khác ⇒ `kGenericErrorMessage`; không đổi chuỗi nào. Mật khẩu gửi không trim (giống web).
- **PnsApp** (`lib/app/pns_app.dart`): restoring (skeleton) → Đăng nhập ↔ "Đã đăng nhập." + Đăng xuất; `onSessionExpired` nối bằng `ValueNotifier<int>` mà composition root tạo và transport tăng — PnsApp nhận `Listenable? sessionExpired` (cách đơn giản nhất, không cần thêm state management).
- **Khung trần (D12):** `AppPhoneFrameScope(bare)` trong `app_phone_frame.dart`; chỉ `PnsApp` đặt `bare: true`; code khung mockup và mọi literal `shell-parity` giữ nguyên.
- **main.dart** composition root duy nhất: `API_BASE_URL` chỉ ở đây; rỗng ⇒ `ConfigErrorApp` (không dựng transport); không import fake / barrel `session.dart`. Hàm `buildApp(baseUrl, {secureStore})` để test được.
- **Android/iOS:** `flutter create` (org `vn.phuongnamsolar`); đã xoá `test/widget_test.dart`, `README.md`, `.idea/`, `pns_mobile.iml`, `android/pns_mobile_android.iml`; manifest main INTERNET + label "Phương Nam Solar" + `allowBackup="false"`, cleartext chỉ ở debug; iOS `CFBundleDisplayName` "Phương Nam Solar". Không file mới nào bị root `.gitignore` nuốt.
- **Lưu ý git:** `.git/info/exclude` của máy này loại mọi file tên `.gitignore` ⇒ `mobile/.gitignore`, `mobile/android/.gitignore`, `mobile/ios/.gitignore` (template Flutter) chỉ có hiệu lực local, không commit được; chúng ignore `gradlew`, `gradle-wrapper.jar`, `local.properties`, `GeneratedPluginRegistrant.*`, `ios/Flutter/Generated.xcconfig`… (đúng chuẩn Flutter — tool tự sinh lại khi build). `mobile/.flutter-plugins-dependencies` vẫn được track (mặc định Câu hỏi mở 3), bản mới commit cùng story.
- **Smoke emulator (AC-20) — ĐÃ CHẠY:** `pns-postgres` 5433; backend `npm run start:prod` với `JWT_ACCESS_SECRET` ngẫu nhiên 64 hex trên lệnh (không đọc/sửa `.env`); AVD `Pixel_9_Pro`; APK debug `--dart-define=API_BASE_URL=http://10.0.2.2:3000`, điều khiển bằng `adb input` + `uiautomator dump` + ảnh chụp. Account riêng `smoke-10-6@local.test` (mật khẩu ngẫu nhiên, argon2id, không quyền nào — đăng nhập không cần quyền) chèn SQL thẳng vào `pns-postgres`.
  - (i) sai mật khẩu ⇒ Banner "Thông tin đăng nhập không đúng", màn tràn màn hình, không thân đen/status bar giả;
  - (ii) đúng mật khẩu ⇒ "Đã đăng nhập." + Đăng xuất; `sessions`: 1 dòng chưa revoke;
  - (iii) `am force-stop` (pid rỗng) rồi mở lại ⇒ vào thẳng "Đã đăng nhập."; `sessions`: dòng cũ revoked + 1 dòng mới ⇒ đúng **1 lần rotate**;
  - (iv) Đăng xuất ⇒ về Đăng nhập; cả 2 dòng `sessions` revoked;
  - (v) tắt + mở lại ⇒ Đăng nhập.
  - Dọn: gỡ app khỏi AVD, bật lại verifier, tắt emulator; `DELETE` account smoke (cascade sessions) ⇒ đếm lại 0; tắt backend, cổng 3000 trống; xoá file mật khẩu tạm. Không dùng container `kidy-dev-*`, không gọi dịch vụ ngoài localhost.
- **5 lane:** mobile `flutter analyze` sạch + `flutter test` **510** xanh lúc dev (455 → 510, không xoá test; bước QA thêm `http_stack_loopback_test.dart` ⇒ 521; sau review ⇒ **523**); design-system **497/497**; web typecheck 0 lỗi + **432** test + vite bundle OK (chỉ đổi comment `auth-port.ts`); backend `npm test` **2504/2504** (121 suite) + `npm run test:db` **322/322** (26 suite); backend không có diff, `openapi.json` không đổi.
- **Docs G-5:** epics.md (bullet tinh chỉnh Story 10.6), `project-context.md` (Flutter 3.35.0/Dart 3.9.0; mô tả mobile runtime), spine §Deferred (codegen mobile + bản dẫn xuất), `docs/van-hanh-go-live.md` (mục "Mobile gọi backend").
- **Việc cho story sau (không làm ở 10.6):** màn mobile khác Đăng nhập vẫn bắt lỗi nominal `*PortError` (`on PaymentsPortError catch`, `e is ContractsPortError`…) — khi 10.7/10.8 thay fake bằng adapter HTTP, lỗi tới màn sẽ là `ApiError` ⇒ phải đổi các nhánh bắt lỗi đó (hoặc adapter map `ApiError` → `*PortError`). Quên mật khẩu mobile chưa nối (10.7). `go_router 18.x` cần Flutter ≥ 3.44 ⇒ 10.7 chọn bản cũ hơn.

### File List

Mới:
- `mobile/lib/main.dart` (thay app đếm số của template)
- `mobile/lib/app/pns_app.dart`
- `mobile/lib/api/api_error.dart`, `mobile/lib/api/transport.dart`, `mobile/lib/api/session_store.dart`, `mobile/lib/api/http_auth_port.dart`
- `mobile/lib/api/generated/**` (GENERATED — 270 file: `pns_api_client.dart`, `export.dart`, 11 thư mục client, `models/`, 118 `.g.dart`)
- `mobile/lib/design_system/session/auth_port.dart`, `mobile/lib/design_system/session/fake_auth_port.dart`
- `mobile/tool/generate_api.dart`, `mobile/swagger_parser.yaml`, `mobile/build.yaml`
- `mobile/test/api/support/fake_http.dart`, `mobile/test/api/http_stack_loopback_test.dart` (bước QA: stack thật qua socket loopback 127.0.0.1), `mobile/test/api/api_error_test.dart`, `mobile/test/api/session_store_test.dart`, `mobile/test/api/transport_test.dart`, `mobile/test/api/http_auth_port_test.dart`, `mobile/test/api/build_mobile_spec_test.dart`, `mobile/test/api/generated_client_drift_test.dart`, `mobile/test/api/no_network_outside_transport_test.dart`
- `mobile/test/app/pns_app_test.dart`
- `mobile/.metadata`
- `mobile/android/**` + `mobile/ios/**` — đúng **57 file** sẽ commit (đo `git status -uall` lúc review; sửa tay: `android/app/src/main/AndroidManifest.xml`, `android/app/src/debug/AndroidManifest.xml`, `ios/Runner/Info.plist`):
  - `mobile/android/app/build.gradle.kts`
  - `mobile/android/app/src/debug/AndroidManifest.xml`
  - `mobile/android/app/src/main/AndroidManifest.xml`
  - `mobile/android/app/src/main/kotlin/vn/phuongnamsolar/pns_mobile/MainActivity.kt`
  - `mobile/android/app/src/main/res/drawable-v21/launch_background.xml`
  - `mobile/android/app/src/main/res/drawable/launch_background.xml`
  - `mobile/android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
  - `mobile/android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
  - `mobile/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
  - `mobile/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
  - `mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
  - `mobile/android/app/src/main/res/values-night/styles.xml`
  - `mobile/android/app/src/main/res/values/styles.xml`
  - `mobile/android/app/src/profile/AndroidManifest.xml`
  - `mobile/android/build.gradle.kts`
  - `mobile/android/gradle.properties`
  - `mobile/android/gradle/wrapper/gradle-wrapper.properties`
  - `mobile/android/settings.gradle.kts`
  - `mobile/ios/Flutter/AppFrameworkInfo.plist`
  - `mobile/ios/Flutter/Debug.xcconfig`
  - `mobile/ios/Flutter/Release.xcconfig`
  - `mobile/ios/Podfile`
  - `mobile/ios/Runner.xcodeproj/project.pbxproj`
  - `mobile/ios/Runner.xcodeproj/project.xcworkspace/contents.xcworkspacedata`
  - `mobile/ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`
  - `mobile/ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings`
  - `mobile/ios/Runner.xcodeproj/xcshareddata/xcschemes/Runner.xcscheme`
  - `mobile/ios/Runner.xcworkspace/contents.xcworkspacedata`
  - `mobile/ios/Runner.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`
  - `mobile/ios/Runner.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings`
  - `mobile/ios/Runner/AppDelegate.swift`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@1x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@2x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@3x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@1x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@2x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@3x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@1x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@2x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@3x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@2x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@3x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-76x76@1x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-76x76@2x.png`
  - `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-83.5x83.5@2x.png`
  - `mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/Contents.json`
  - `mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png`
  - `mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png`
  - `mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@3x.png`
  - `mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md`
  - `mobile/ios/Runner/Base.lproj/LaunchScreen.storyboard`
  - `mobile/ios/Runner/Base.lproj/Main.storyboard`
  - `mobile/ios/Runner/Info.plist`
  - `mobile/ios/Runner/Runner-Bridging-Header.h`
  - `mobile/ios/RunnerTests/RunnerTests.swift`
  - KHÔNG commit (máy/build, đang bị `.gitignore` local loại — đã kiểm lúc review: không file nào lọt vào danh sách trên): `mobile/build/`, `mobile/.dart_tool/`, `mobile/android/.gradle/`, `mobile/android/.kotlin/`, `mobile/android/local.properties`, `mobile/android/gradlew`, `mobile/android/gradlew.bat`, `mobile/android/gradle/wrapper/gradle-wrapper.jar`, `mobile/android/app/src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.java`, `mobile/ios/Flutter/Generated.xcconfig`, `mobile/ios/Flutter/flutter_export_environment.sh`, `mobile/ios/Runner/GeneratedPluginRegistrant.*`, `*.iml`, `Pods/`, `ephemeral/` (Flutter tool tự sinh lại). Khi commit: `git add` đúng danh sách trên, không `git add mobile/`.
- (local-only, không commit được do `.git/info/exclude`: `mobile/.gitignore`, `mobile/android/.gitignore`, `mobile/ios/.gitignore`)

Sửa:
- `mobile/pubspec.yaml`, `mobile/pubspec.lock`, `mobile/.flutter-plugins-dependencies`
- `mobile/lib/screens/auth/login_screen.dart`
- `mobile/lib/app/pns_app.dart`, `mobile/test/app/pns_app_test.dart`, `mobile/test/api/no_network_outside_transport_test.dart` (sửa thêm lúc review)
- `mobile/lib/design_system/session/session.dart`
- `mobile/lib/design_system/shell/app_phone_frame.dart`
- `mobile/test/screens/auth/login_screen_test.dart`, `mobile/test/design_system/shell_render_test.dart`
- `design-system/session/parity.test.mjs`
- `web/src/design-system/session/auth-port.ts` (chỉ comment)
- `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/project-context.md`, `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`, `docs/van-hanh-go-live.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, story này

Xoá (file template của `flutter create`, chưa từng commit): `mobile/test/widget_test.dart`, `mobile/README.md`, `mobile/.idea/`, `mobile/pns_mobile.iml`, `mobile/android/pns_mobile_android.iml`

### Change Log

- 2026-10-22 — Story 10.6 dev: app-runtime Android/iOS (`flutter create`, manifest INTERNET/allowBackup/cleartext debug); client Dart sinh từ OpenAPI (`swagger_parser` + retrofit + json_serializable trên dio, bản spec dẫn xuất cho tải nhị phân, drift-guard byte-for-byte); transport một chỗ (Bearer, envelope AD-5 → `ApiError`, refresh single-flight, phát lại 1 lần); phiên (refresh token secure storage, access token bộ nhớ); `AuthPort`/`HttpAuthPort`/`FakeAuthPort` + parity; Đăng nhập gọi port; `PnsApp` + khung trần; `main.dart` composition root với `API_BASE_URL`; guard mạng; smoke emulator chạy thật; docs G-5. Status → review.
- 2026-10-22 — Review (AI): sửa R1 bàn phím che form (Scaffold), R2 Đăng xuất bấm đôi, R3 guard mạng thêm loader ảnh mạng, R4/R5 File List + số test; bác finding drain stream (mutant tương đương). Status → done.

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (AI review, 2026-10-22) — lớp chính `/ck:code-review` + workflow story-automator-review. **Kết quả: Approve sau khi sửa.**

Phạm vi soi: mọi file tay trong File List (`lib/api/*`, `lib/app/pns_app.dart`, `lib/main.dart`, `login_screen.dart`, `app_phone_frame.dart`, `tool/generate_api.dart`, port/fake, 10 file test, manifest Android, `Info.plist`), đối chiếu AC 1–22 và T1–T11 (mọi task [x] có bằng chứng). Backend không có diff ⇒ luật (1) phạm vi ghi đơn và (2) `FOR UPDATE` tồn kho không áp dụng story này (không đường ghi/tồn kho nào bị đụng). Không chạy emulator (máy swap cao — theo chỉ thị); smoke emulator của dev giữ nguyên.

### Findings

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| R1 | MEDIUM | Bàn phím ảo che form Đăng nhập trên máy thật: `PnsApp` bọc màn bằng `Material` trần (không `Scaffold`), khung trần chỉ có `SafeArea` (không tính `viewInsets`) ⇒ mở bàn phím, nút "Đăng nhập"/ô mật khẩu nằm dưới bàn phím và `SingleChildScrollView` không cuộn được vì vùng body không co | `Material` → `Scaffold(backgroundColor: surface)` (tự nhấc body lên trên bàn phím). Test: `viewInsets` 300 ⇒ đáy nút Đăng nhập ≤ vùng nhìn thấy. Mutant trả về `Material` ⇒ ĐỎ |
| R2 | MEDIUM | Đăng xuất bấm đôi ⇒ 2 lời `POST /auth/logout`; mất mạng thì lời gọi treo tới hết `connectTimeout` 15s mà nút vẫn bấm được | Cờ `_loggingOut` tắt nút trong lúc chờ, `finally` luôn về Đăng nhập. Test: bấm 2 lần khi logout đang treo ⇒ đúng 1 request. Mutant bỏ cờ ⇒ ĐỎ |
| R3 | MEDIUM | Guard mạng mù loader ảnh mạng: `Image.network`, `NetworkImage`, `SvgPicture.network` (flutter_svg là dependency sẵn có), `SvgNetworkLoader`, `NetworkAssetBundle` tự mở HTTP ngoài transport (không Bearer, không envelope) — ảnh đính kèm của 10.8 là chỗ dễ trượt vào | Thêm vào `bannedIdentifier` + ca mẫu trong test bộ bỏ comment (đếm 5; chuỗi `'Image.network('` không tính). Mutant chèn `NetworkImage('a')` / `Image.network(u)` vào màn Đăng nhập ⇒ ĐỎ cả hai |
| R4 | MEDIUM | File List thiếu `mobile/test/api/http_stack_loopback_test.dart`; `android/**`/`ios/**` ghi gộp trong khi `.gitignore` Flutter không commit được (`.git/info/exclude`) ⇒ rủi ro `git add mobile/` kéo file máy | File List liệt kê đúng từng đường dẫn platform sẽ commit + danh sách file máy KHÔNG commit (đối chiếu `git status -uall`: không file máy nào lọt) |
| R5 | LOW | Completion Notes ghi `flutter test` 510; thực tế sau QA là 521, sau review 523 | Sửa số |

Đã kiểm và **bác** (không sửa): (a) "body 401 của request `ResponseType.stream` không được đọc trước khi refresh ⇒ giữ kết nối" — mutant xoá dòng drain vẫn xanh vì Dio 5.11 `handleResponseStream` tự `listen` stream nguồn ngay khi nhận response (`dio_mixin.dart`), kết nối được nhả sẵn ⇒ finding sai, đã gỡ bản sửa thử. (b) Mở app khi backend tắt ⇒ bị đăng xuất: đúng mặc định §6.15, đã là Câu hỏi mở 2.

Ghi cho 10.7 (chưa với tới ở 10.6 — trang đã đăng nhập không gọi API nào, nút Đăng xuất chỉ hiện sau restore): nếu Đăng xuất chạy **trong lúc** một refresh đang bay, refresh xong sẽ `setTokens` lại sau `clear()` ⇒ phiên "sống lại" trên máy. Web `transport.ts`/`http-auth-port.ts` cùng khuôn ⇒ khi 10.7 thêm lời gọi nền (`/me`), sửa cho cả hai nền tảng (vd đếm thế hệ phiên trong session store; refresh chỉ lưu nếu thế hệ chưa đổi).

### Kiểm chứng
- Mutation lúc review (backup `cp`, không `git checkout`, mutant biên dịch được): R1 Scaffold→Material ĐỎ; R2 bỏ cờ busy ĐỎ; R3 `NetworkImage(` ĐỎ, `Image.network(` ĐỎ; bẻ lại single-flight (`??=` → `=`) ⇒ (e)+(g) ĐỎ. Khôi phục ⇒ trùng bản backup.
- Lane: mobile `flutter analyze` **No issues found**; `flutter test` **523/523** (gồm drift-guard byte-for-byte 16s); design-system `npm test` **497/497**. Web/backend: review không đổi file nào (web chỉ có comment `auth-port.ts` của dev; backend không diff) — giữ số liệu lane của dev.
