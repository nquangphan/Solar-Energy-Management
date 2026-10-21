# Design system: token, icon, component, shell, định dạng tiền

> Flow `design-system`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow design-system` in ra đúng danh sách đó.

## Mục đích

Một design system cho hai nền tảng: web React (`web/src/design-system/`) và Flutter
(`mobile/lib/design_system/`). Mục tiêu là cùng một màn hình trên web và mobile dùng cùng màu, khoảng cách,
icon, nhãn trạng thái và cùng một định dạng tiền (`83.010.960 đ`). Flow này gồm:

- nguồn sự thật (SSOT) `design-tokens.json` và `icons.json`, cùng hai generator không phụ thuộc gói ngoài
  sinh ra file token/icon cho web và mobile;
- component, shell (khung màn hình) và lớp a11y viết tay cho từng nền tảng;
- bộ định dạng tiền `formatVnd` / `<Money>` / `MoneyText` và guard chặn in tiền thô;
- các text guard `design-system/**/*.test.mjs` (chạy bằng `node --test`), widget test Flutter, và lane web
  vitest (render màn + phủ class CSS).

Người dùng: dev web/mobile dựng màn hình. Quy ước chung: [`_bmad-output/project-context.md`](../../_bmad-output/project-context.md).

## Điểm vào

- `cd design-system && npm run build:tokens` → `node tokens/build-tokens.mjs`.
- `cd design-system && npm run build:icons` → `node icons/build-icons.mjs`.
- `npm run build` chạy cả hai rồi `permissions/build-permission-keys.mjs` (generator đó thuộc accounts-permissions).
- Màn hình import từ barrel `web/src/design-system/components/index.ts`, `web/src/design-system/shell/index.ts`,
  `mobile/lib/design_system/components/components.dart`, `mobile/lib/design_system/shell/shell.dart`.
- `web/src/main.tsx` nạp CSS theo thứ tự `tokens.css` → `icons.css` → `components.css` → `shell.css` → `a11y.css`.

## Các bước

1. Sửa SSOT: `design-system/tokens/design-tokens.json` (khoá `color`, `statusChip`, `spacing`, `radius`,
   `typography`, `border`, `a11y`) hoặc `design-system/icons/icons.json` (46 icon, `attrs`, `sizes` mặc định 18
   và biến thể 18/22/16/15/14/13, `aliases`).
2. `design-system/tokens/build-tokens.mjs` → `loadTokens()` + `buildOutputs()` ghi ba file trong `OUT_PATHS`:
   `web/src/design-system/tokens/tokens.ts` (`color`, `spacing`, `radius`, `fontFamily`, `typography`, `border`,
   `ColorToken`), `tokens.css` (biến CSS `:root`), `mobile/lib/design_system/tokens/app_tokens.dart` (`AppTokens`,
   gồm `tapTargetMin` 48dp).
3. `design-system/icons/build-icons.mjs` → `loadIcons()` + `buildOutputs()` ghi `web/src/design-system/icons/sprite.ts`
   (`ICON_NAMES`, `IconName`, `ICON_SIZES`, `ICON_SPRITE`), `icons.css`, `Icon.tsx` (`Icon`) và
   `mobile/lib/design_system/icons/app_icons.dart` (`AppIcons`, `AppIcon`, SVG nội tuyến qua `flutter_svg`).
4. Commit cả SSOT lẫn file sinh. File sinh mở đầu bằng `GENERATED from … — do not edit by hand.`; muốn đổi
   thì sửa SSOT rồi chạy lại generator.
5. Component và shell viết tay dùng token: web đọc biến CSS trong `components.css`/`shell.css` (chép nguyên từ
   `mockups/all-screens.html`, chỉ đổi tên biến radius); Flutter đọc `AppTokens`.
6. Hiển thị tiền: web `<Money value={n} />` hoặc `formatVnd(n)` (`web/src/design-system/components/format-vnd.ts`);
   Flutter `MoneyText(n)` hoặc `formatVnd(n)` (`money_text.dart`). Cả hai nhóm chữ số bằng thao tác chuỗi, ra
   `"83.010.960 đ"`, `"0 đ"`, `"-1.500.000 đ"`. Bản web ném `RangeError` nếu giá trị không phải số nguyên an toàn.
7. Chạy guard: `cd design-system && npm test`, `cd web && npm test`, `cd mobile && flutter test` (xem build-ci).

## Bất biến

| Bất biến | Nơi enforce |
|----------|-------------|
| File token sinh ra (`tokens.ts`, `tokens.css`, `app_tokens.dart`) bằng đúng output generator chạy lại từ SSOT; hex/số giống nhau trên json, web, mobile | `design-system/tokens/parity.test.mjs`, `mobile/test/design_system/tokens/app_tokens_test.dart` |
| File icon sinh ra (`sprite.ts`, `icons.css`, `Icon.tsx`, `app_icons.dart`) khớp generator; đúng 46 tên trên cả ba phía; stroke `currentColor`, không tham chiếu ngoài, không raster | `design-system/icons/parity.test.mjs`, `design-system/icons/sprite.test.mjs`, `mobile/test/design_system/icons/app_icons_test.dart` |
| "Viền nét": không token shadow/gradient; shell không inline shadow/elevation | `design-system/tokens/parity.test.mjs`, `design-system/components/shell-tsx.test.mjs`, `mobile/test/design_system/shell_invariants_test.dart` |
| Tiền chỉ hiển thị qua `formatVnd` / `<Money>` / `MoneyText`; cấm in thô field tiền và cấm `toLocaleString`/`Intl`/`NumberFormat`/`toFixed` | `design-system/money/money-render-guard.test.mjs` |
| `formatVnd` web và Dart cho cùng chuỗi trên cùng bảng fixture `vnd-format-cases.json` | `design-system/money/format-vnd.test.mjs`, `mobile/test/design_system/components/money_text_test.dart`, `web/src/test/money.test.tsx` |
| `CartLineRow` không tự tính tiền (hiển thị `amount` backend trả); `ImageUpload` không tự upload, chỉ phát `File[]` | `design-system/components/behavior-components.test.mjs`, `mobile/test/design_system/components/behavior_interaction_test.dart`, `invariant_guard_test.dart` |
| Shell chỉ là trình bày: không router, không gọi mạng, chỉ callback | `design-system/components/shell-tsx.test.mjs`, `mobile/test/design_system/shell_behavior_test.dart`, `shell_invariants_test.dart` |
| Thiếu quyền thì bề mặt biến mất (không disabled/xám) | `design-system/components/gating.test.mjs` |
| Mỗi component web có widget Flutter tương ứng; 10 bộ màu trạng thái, 3 tone banner và nhãn tiếng Việt giống byte-for-byte | `design-system/components/parity.test.mjs`, `shell-parity.test.mjs` |
| Vùng chạm tối thiểu 44px (web) / 48dp (mobile); nút chỉ có icon có `aria-label`/`Semantics`; chip trạng thái đạt tương phản 4.5:1 | `design-system/components/a11y-floor.test.mjs` |
| Mọi màn web render được trên JSDOM; mọi className tĩnh có rule CSS thật | `web/src/test/screens-render.test.tsx`, `web/src/test/css-class-coverage.test.ts` |

Mọi text guard bọc tập quét bằng `assertScanned` / `assertCodeNotBlind` (`design-system/lib/assert-scanned.mjs`)
để đỏ khi bộ quét trả tập rỗng, và bỏ comment bằng `stripComments` (`design-system/lib/strip-comments.mjs`)
trước khi tìm chuỗi cấm.

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `design-system/tokens/design-tokens.json` | SSOT token | khoá `color`, `spacing`, `radius`, `typography`, `border`, `a11y`, `statusChip` |
| `design-system/tokens/build-tokens.mjs` | Generator token (chỉ dùng Node built-in) | `OUT_PATHS`, `loadTokens`, `buildOutputs` |
| `design-system/icons/icons.json` | SSOT 46 icon | `icons`, `attrs`, `sizes`, `aliases` |
| `design-system/icons/build-icons.mjs` | Generator icon | `OUT_PATHS`, `loadIcons`, `buildOutputs` |
| `web/src/design-system/tokens/tokens.ts`, `web/src/design-system/tokens/tokens.css` | Token web (file sinh) | `color`, `spacing`, `radius`, `typography`, `border`, `ColorToken` |
| `web/src/design-system/icons/sprite.ts`, `web/src/design-system/icons/icons.css`, `web/src/design-system/icons/Icon.tsx` | Icon web (file sinh) | `ICON_NAMES`, `ICON_SIZES`, `ICON_SPRITE`, `Icon` |
| `mobile/lib/design_system/tokens/app_tokens.dart` | Token Flutter (file sinh) | `AppTokens` |
| `mobile/lib/design_system/icons/app_icons.dart` | Icon Flutter (file sinh) | `AppIcons`, `AppIcon` |
| `design-system/money/money-fields.mjs` | Danh sách field tiền lấy từ `backend/openapi/openapi.json` (mô tả có chữ "đồng") + danh sách bổ sung | `moneyFields`, `numericProperties`, `EXTRA_MONEY_FIELDS` |
| `design-system/money/vnd-format-cases.json` | Fixture định dạng tiền dùng chung web + Flutter | `cases` |
| `design-system/lib/assert-scanned.mjs`, `design-system/lib/strip-comments.mjs` | Tiện ích chung của text guard | `assertScanned`, `assertCodeNotBlind`, `stripComments` |
| `web/src/design-system/components/format-vnd.ts`, `web/src/design-system/components/Money.tsx` | Định dạng/hiển thị tiền web | `formatVnd`, `Money` |
| `mobile/lib/design_system/components/money_text.dart` | Định dạng/hiển thị tiền Flutter | `formatVnd`, `MoneyText` |
| `web/src/design-system/components/{Button,Card,Frame,Field,Checkbox,Table,Kpi,Skeleton}.tsx` | Component cơ bản web | `Button`, `Card`, `Frame`, `Field`, `Checkbox`, `Table`, `Kpi`, `Skeleton` |
| `web/src/design-system/components/{StatusChip,CustomerTypeChip,ScopeFlag}.tsx` | Chip chỉ đọc | `StatusChip`, `STATUS_LABELS`, `StatusKey`, `CustomerTypeChip`, `ScopeFlag` |
| `web/src/design-system/components/{Banner,EmptyState,ErrorState,Stepper}.tsx` | Phản hồi / tiến trình | `Banner`, `EmptyState`, `ErrorState`, `Stepper`, `StepState` |
| `web/src/design-system/components/{Dialog,ConfirmDialog,Sheet}.tsx` | Overlay | `Dialog`, `ConfirmDialog`, `Sheet` |
| `web/src/design-system/components/{CartLineRow,ImageUpload,AttachmentGallery,ShareButton}.tsx`, `web/src/design-system/components/share.ts` | Hành vi: dòng giỏ, chọn ảnh, xem đính kèm, chia sẻ | `CartLineRow`, `formatWarrantyMonths`, `ImageUpload`, `AttachmentGallery`, `ShareButton`, `shareFiles` |
| `web/src/design-system/components/components.css`, `web/src/design-system/components/index.ts` | CSS component viết tay + barrel | (barrel) |
| `web/src/design-system/shell/{WebShell,WebFrame,Topbar,Sidebar,Toolbar,Seg,Tabs,SearchField}.tsx`, `web/src/design-system/shell/shell.css`, `web/src/design-system/shell/index.ts` | Shell web | `WebShell`, `WebFrame`, `Topbar`, `Sidebar`, `SIDEBAR_NAV`, `Toolbar`, `Seg`, `Tabs`, `SearchField` |
| `web/src/design-system/a11y/a11y.css` | Lớp vùng chạm ≥44px, nạp sau cùng | (CSS) |
| `mobile/lib/design_system/components/{button,card,field,checkbox,table,kpi,skeleton}.dart` | Widget cơ bản Flutter | `AppButton`, `AppCard`, `AppFrame`, `AppField`, `AppCheckbox`, `AppTable`, `AppKpi`, `AppSkeleton` |
| `mobile/lib/design_system/components/{chip,status_chip}.dart` | Chip chỉ đọc | `AppChip`, `AppCustomerTypeChip`, `AppScopeFlag`, `AppStatusChip`, `StatusKey`, `kStatusLabels`, `kStatusColors` |
| `mobile/lib/design_system/components/{banner,empty_state,error_state,stepper}.dart` | Phản hồi / tiến trình | `AppBanner`, `AppEmptyState`, `AppErrorState`, `AppStepper` |
| `mobile/lib/design_system/components/{dialog,sheet}.dart` | Overlay | `showAppDialog`, `AppDialog`, `AppConfirmDialog`, `showAppSheet`, `AppSheet` |
| `mobile/lib/design_system/components/{cart_line_row,image_upload,attachment_gallery,share_button,dashed_rect}.dart` | Hành vi (plugin `image_picker`, `share_plus` được tiêm, không gọi thật trong test) | `AppCartLineRow`, `AppImageUpload`, `platformPickImages`, `AppAttachmentGallery`, `AppShareButton`, `platformShareXFiles`, `DashedRectPainter` |
| `mobile/lib/design_system/components/components.dart` | Barrel widget | (export) |
| `mobile/lib/design_system/shell/{app_mobile_shell,app_phone_frame,app_topbar,app_bottom_nav,app_tabs}.dart`, `mobile/lib/design_system/shell/shell.dart` | Shell Flutter (bottom nav khoá cứng 5 tab) | `AppMobileShell`, `AppPhoneFrame`, `AppTopbar`, `AppBottomNav`, `AppTabs` |

## Dữ liệu

- Bảng: không đọc/ghi DB.
- Sự kiện: không có domain event. Component chỉ phát callback (`onAdd`, `onClose`, …) cho màn hình xử lý.
- Gọi ngoài: không gọi mạng. `shareFiles` dùng `navigator.share`, không hỗ trợ thì tải file xuống;
  Flutter dùng `share_plus` và `image_picker`. Không upload trực tiếp (AD-3: file đi qua backend).
- Đầu vào lúc test: `money-fields.mjs` đọc `backend/openapi/openapi.json` để biết field nào là tiền.

## Flow liên quan

- backend-platform: `openapi.json` là nguồn danh sách field tiền cho money-render guard.
- accounts-permissions: gating primitives (`Gate`, `app_gate.dart`) và `permission-keys` sinh bởi `build-permission-keys.mjs` cùng chạy trong `npm run build`; `gating.test.mjs` sống ở đây nhưng canh file của flow đó.
- auth-session, customers, orders, inventory, system-settings: màn hình dùng component/shell; `screens-render.test.tsx` render mọi màn web của các flow này; money-render guard quét `web/src/screens` và `mobile/lib/screens`.
- build-ci: lane design-system (`npm test`), web (typecheck + vitest + build), mobile (analyze + test).

## Tests

| Loại | Test | Kiểm tra |
|------|------|----------|
| Drift guard (node --test) | `design-system/tokens/parity.test.mjs` | Output token khớp generator; hex, spacing, radius, typography giống nhau 3 phía; 14 nhóm màu; không shadow/gradient; `.mono` canh phải |
| Drift guard | `design-system/icons/parity.test.mjs`, `design-system/icons/sprite.test.mjs` | Output icon khớp generator; 46 tên; stroke `currentColor`; 6 kích thước; import module `sprite.ts` thật và kiểm `ICON_NAMES`/`ICON_SIZES`/`ICON_SPRITE` |
| Parity tiền | `design-system/money/format-vnd.test.mjs` | `formatVnd` web khớp từng ca fixture; ném lỗi với số không hợp lệ; test Flutter đọc cùng fixture; không dùng locale API |
| Text guard tiền | `design-system/money/money-render-guard.test.mjs` | Danh sách field tiền không rỗng; quét đủ file; tự kiểm các mẫu in thô; không màn web/Flutter nào in thô field tiền |
| Text guard component | `design-system/components/components.test.mjs`, `chip-components.test.mjs`, `data-feedback-components.test.mjs`, `behavior-components.test.mjs` | Selector/khai báo CSS khớp mockup; chip chỉ đọc; `Stepper` không trạng thái disabled; `CartLineRow` không tính tiền; `ImageUpload` không upload; barrel đủ |
| Text guard shell | `design-system/components/shell-web.test.mjs`, `shell-tsx.test.mjs`, `shell-behavior.test.mjs`, `shell-parity.test.mjs` | CSS shell khớp mockup; không router/mạng/shadow; nav mặc định và logic mục active; hằng số shell khớp mockup ↔ web ↔ Flutter |
| Text guard parity / a11y / gating | `design-system/components/parity.test.mjs`, `a11y-floor.test.mjs`, `gating.test.mjs` | Xem mục Bất biến |
| Widget test Flutter | `mobile/test/design_system/components/components_render_test.dart`, `behavior_interaction_test.dart`, `money_text_test.dart` | Mọi widget pump được với màu/kích thước `AppTokens`; hành vi lúc chạy (giỏ không tự tính, picker chỉ phát file, share chỉ mở sheet); `formatVnd` Dart khớp fixture, `MoneyText` dùng token `mono` |
| Source guard Flutter | `mobile/test/design_system/components/invariant_guard_test.dart`, `mobile/test/design_system/shell_invariants_test.dart` | Đọc file `.dart` như text. Component: không shadow/gradient/elevation dương, không nhân `qty × unitPrice`, không gọi mạng/upload, dialog không tự đổi trạng thái, share dùng `share_plus`. Shell: không shadow, không `AppBar`/`BottomNavigationBar`/`Scaffold` của Material, đúng 5 tab không ghi đè được, không import io/http/router, màu literal phải nằm trong danh sách hằng shell |
| Widget test Flutter shell | `mobile/test/design_system/shell_render_test.dart`, `shell_behavior_test.dart`, `app_tabs_test.dart` | 5 tab khoá theo thứ tự, tiêu đề cắt ellipsis, notch; back/action/tab/FAB chỉ gọi callback; `AppTabs` chỉ phát ý định |
| Flutter token/icon | `mobile/test/design_system/tokens/app_tokens_test.dart`, `mobile/test/design_system/icons/app_icons_test.dart` | Giá trị `AppTokens` đúng hex/số chuẩn; registry icon đúng 46 tên, SVG tự chứa |
| Vitest + JSDOM | `web/src/test/screens-render.test.tsx` | Render mọi màn `*Screen.tsx` qua fake port; số ca phải bằng số file màn (thêm màn web mới phải thêm ca) |
| Vitest | `web/src/test/css-class-coverage.test.ts` | Mọi className tĩnh trong `web/src` có rule CSS; danh sách `HOOK_ONLY` không có mục thừa |
| Vitest | `web/src/test/money.test.tsx` | `<Money>` hiển thị `83.010.960 đ` trong `mono`; số 0 và số âm; `RangeError` với số lẻ/không hữu hạn |

Giới hạn đã biết: comment đầu nhiều text guard (`behavior-components`, `gating`, `shell-tsx`, `a11y-floor`, …)
vẫn ghi "web has no tsc/bundler"; điều này đã lỗi thời từ khi `web/` có `tsc`, `vite`, `vitest` (TD-1 trả ngày
2026-10-21). Các guard đó vẫn chạy và vẫn có giá trị, chỉ comment là cũ. Component CSS web viết tay, không có
generator; nguồn sự thật của chúng là `mockups/all-screens.html`.
