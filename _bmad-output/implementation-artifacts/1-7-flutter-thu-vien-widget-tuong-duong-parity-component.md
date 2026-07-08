---
baseline_commit: 09d8909
---

# Story 1.7: Flutter — thư viện widget tương đương (parity component)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên mobile**,
I want **thư viện widget Flutter phản chiếu ĐÚNG bộ component React (Story 1.3–1.6) từ cùng `AppTokens` + `AppIcon` đã ship, phẳng "Viền nét", KHÔNG chứa business logic**,
so that **cùng một màn nghiệp vụ (Epic 3–8, và màn Đăng nhập 1.11) dựng bằng Flutter được nhận ra là CÙNG màn với web — chỉ khác khung + điều hướng (UX-DR-27) — và không dev mobile nào vô tình tự tính tiền, tự đổi trạng thái đơn, hay tự upload R2 (AD-10/16, AD-11, AD-3)**.

## Acceptance Criteria

1. **Given** `AppTokens` (Story 1.1) + `AppIcon`/`AppIcons` (Story 1.2) đã có trong `mobile/lib/design_system/`, **When** dựng thư viện widget Flutter, **Then** có mặt **đủ** parity với web: **Button, Card, Frame, Field** (mirror 1.3); **Chip + StatusChip 9 trạng thái + CustomerTypeChip + ScopeFlag** (mirror 1.4); **Table, Stepper, KPI, Banner** (mirror 1.5) — **cùng token màu/spacing/radius/typography**, phẳng **không shadow/elevation** (Viền nét, UX-DR-4..13). Mọi giá trị màu/px khớp `components.css` web byte-cho-byte (9 bộ 3 hex status + 3 tone banner + hằng stepper là literal chuẩn tắc mirror verbatim).
2. **Given** tầng hành vi (mirror 1.6), **When** dùng trên mobile, **Then** **CartLineRow** recalc realtime **qua callback** (`onQtyChange`/`onUnitPriceChange`) — **render `amount` từ prop backend, TUYỆT ĐỐI KHÔNG nhân `qty×unitPrice`/tính tổng** (AD-10/16); **ImageUpload** optional, chụp trực tiếp **hoặc** chọn thư viện, **chỉ phát file đã chọn qua `onAdd` — KHÔNG upload R2** (AD-3, UX-DR-25); **overlay** theo đúng quy tắc: **Sheet = bottom-sheet** cho lựa chọn nhanh/native-share, **Dialog** cho hành động tiền/dữ liệu có hệ quả (Chốt/Huỷ/Duyệt/ghi thanh toán) — **overlay chỉ thu ý định qua callback, KHÔNG tự đổi `Order.status`** (AD-11, UX-DR-20, UX-DR-24); cùng **Skeleton/EmptyState/ErrorState/ShareButton/ConfirmDialog** parity với web.
3. **Given** cùng một màn nghiệp vụ, **When** dựng bằng cả React (web) và Flutter (mobile) từ hai thư viện này, **Then** nhận ra là **cùng màn** — chỉ khác **khung** (browser chrome vs phone frame) và **điều hướng** (sidebar vs bottom-nav) (UX-DR-27). Parity màu/spec được **guard tự động** (test cross-platform khẳng định 9 hex status + tone banner + token khớp web). *(Màn demo side-by-side thật là Story 1.11 — 1.7 chỉ cấp widget + guard parity, KHÔNG dựng màn tính năng.)*

## Tasks / Subtasks

> **Naming convention (chốt — đọc trước):** đặt **tiền tố `App`** cho MỌI widget để tránh đụng SDK Flutter/Material (`Card`, `Table`, `Stepper`, `Dialog`, `Banner`, `Chip` đều là widget Material có sẵn) và giữ nhận diện parity: `AppButton`, `AppCard`, `AppFrame`, `AppField`, `AppChip`, `AppStatusChip`, `AppCustomerTypeChip`, `AppScopeFlag`, `AppTable`, `AppStepper`, `AppKpi`, `AppBanner`, `AppCartLineRow`, `AppDialog`, `AppConfirmDialog`, `AppSheet`, `AppSkeleton`, `AppEmptyState`, `AppErrorState`, `AppShareButton`, `AppImageUpload`. File Dart **snake_case**. Class Dart **PascalCase**.

- [x] **Task 1 — Widget nền: `AppButton`, `AppCard`, `AppFrame`, `AppField` (mirror Story 1.3) (AC: 1)**
  - [x] Tạo `mobile/lib/design_system/components/button.dart` — `AppButton`: enum `AppButtonVariant { outline, primary, accent, ghost, danger }` + enum `AppButtonSize { normal, sm }` + cờ `wide`. Mirror `.btn*` (`components.css` 12–21): default = viền `AppTokens.teal` 1.5px, nền `surface`, chữ `teal700` w800 13px, radius `radiusDefault`, padding 9/15; `primary` nền `teal` chữ trắng; `accent` nền `lime050` chữ `lime600` viền `lime`; `ghost` viền `line` chữ `ink2`; `danger` viền+chữ `danger`; `sm` padding 5/10 11.5px radius `radiusSm`; `wide` = full-width. Slot icon trái (`AppIcon`, size **15**). Prop: `{ String? label, IconData?/String? icon, VoidCallback? onPressed, variant, size, wide, Widget? child }` (dùng icon **name** string qua `AppIcon`, KHÔNG IconData).
  - [x] `card.dart` — `AppCard`: nền `surface`, viền `line` 1.5px, radius `radiusLg`; biến thể `ink`/`teal` đổi màu viền (mirror `.card--ink/--teal`). `AppFrame`: viền `ink` 1.5px radius `radiusLg`, `frameLabel` micro-uppercase (10px/w800 letter-spacing .08em `ink`) **đè lên đường viền** ở `top:-8px,left:14px` nền `surface` (mirror `.frame > .frame-label`). Dùng `Stack` + `Positioned` cho label.
  - [x] `field.dart` — `AppField`: viền `line` 1.5px radius `radiusDefault`, nền `surface`, padding 10/12, 13.5px `ink`; **focus đổi viền sang `teal`, KHÔNG glow/shadow**; biến thể `fieldLg` (padding 13/14, 15px); `flabel` micro-uppercase `muted` phía trên (mirror `.field`/`.field-lg`/`.flabel`). Bọc `TextField` với `InputDecoration` (border `OutlineInputBorder`, `focusedBorder` teal, `filled` surface) — **KHÔNG** `Material` elevation. Prop controlled: `{ String? label, controller/value, onChanged, placeholder, bool large, keyboardType, ... }`.
  - [x] **Viền nét (AC-1):** mọi widget dùng `Container(decoration: BoxDecoration(border: Border.all(width: 1.5), borderRadius))` — **CẤM** `BoxShadow`, `elevation > 0`, `Material(elevation:)`, `Shadow(`, gradient. (Xem gotcha "Material tự thêm shadow".)

- [x] **Task 2 — Chip layer: `AppChip`, `AppStatusChip` (9 trạng thái), `AppCustomerTypeChip`, `AppScopeFlag` (mirror Story 1.4) (AC: 1)**
  - [x] `status_chip.dart` — **nguồn chân lý màu status (mirror verbatim `components.css` 51–59):** khai báo Dart map 9 trạng thái, mỗi trạng thái `{bg, fg, border}` + nhãn Việt verbatim. **Copy đúng 3 hex mỗi trạng thái, KHÔNG token** (đây là hằng chuẩn tắc, giống web để literal):
    | key | nhãn | bg | fg | border |
    |---|---|---|---|---|
    | baogia | Báo giá | `#EAF3F1` | `#3A5450` | `#CFE5E0` |
    | choduyet | Chờ duyệt | `#FBF0DA` | `#8A5C08` | `#EFD9A8` |
    | dachot | Đã chốt | `#DCF3EF` | `#0B7264` | `#B7E5DD` |
    | dacoc | Đã cọc | `#E7F5D9` | `#4B7A15` | `#CDE9AC` |
    | thicong | Đang thi công | `#FCEAD4` | `#985B08` | `#F2D3A6` |
    | nghiemthu | Nghiệm thu | `#E4EEFA` | `#345C9C` | `#C4D8F0` |
    | danggiao | Đang giao | `#DEF1F6` | `#0C6B84` | `#B7E0EB` |
    | hoanthanh | Hoàn thành | `#DEF3E6` | `#137A4C` | `#B7E5CA` |
    | huy | Huỷ | `#FAE6E6` | `#B22C2C` | `#F0C7C7` |
  - [x] `AppChip` (base) + `AppStatusChip`: pill radius `radiusFull`, viền 1.5px, 11px/w700, `.dot` 6px hình tròn `currentColor` opacity .85 (mirror `.chip`/`.chip .dot`). **StatusChip CHỈ ĐỌC** — bấm KHÔNG đổi trạng thái (UX-DR-23); đổi trạng thái qua màn riêng (Epic 5). Prop `AppStatusChip({ required StatusKey status })`; export enum/`StatusKey` + map nhãn (mirror `STATUS_LABELS`).
  - [x] `AppCustomerTypeChip` (mirror `.ktype`): viền `lime`, nền `lime050`, 10.5px/w800 `ink`, pill. `AppScopeFlag` (mirror `.scope-flag`): `on` = viền `teal` chữ `teal700`; `off` = viền `line` chữ `#9fb2ad` **gạch ngang** (`TextDecoration.lineThrough`).

- [x] **Task 3 — Data/feedback: `AppTable`, `AppStepper`, `AppKpi`, `AppBanner` (mirror Story 1.5) (AC: 1)**
  - [x] `banner.dart` — `AppBanner`: enum `AppBannerTone { warn, info, danger }`. Mirror `.banner*` (89–94): base = viền `warn` nền `#FBF0DA` chữ `#8A5C08`; `info` = viền `info` nền `#DEF1F6` chữ `#0C6B84`; `danger` = viền `danger` nền `#FAE6E6` chữ `#B22C2C`; radius `radiusDefault`, padding 10/12, 12px/w600, `b` in đậm w800. Slot `AppIcon` trái size **16** margin-top 1. (3 tone hex là literal chuẩn tắc mirror web.)
  - [x] `table.dart` — `AppTable`: mirror `.table*` (97–105). Header micro-uppercase (10px/w800) `muted` nền `surface2` border-bottom 1.5px `line`; ô padding 9/12 border-bottom 1px `line` chữ `ink2`; **hàng cuối không viền dưới**; cột `num` canh phải; `strong` = `ink` w800; hàng `zebra` nền `#F7FBFA`. `AppIcon` trong ô số size **14**. Là **wrapper cấu trúc bảng** (nhận `columns` + `rows`/`children`) — hàng/ô do màn cấp, khớp hợp đồng web (`Table` là wrapper). Có thể dựng bằng Flutter `Table` widget hoặc `Column`+`Row` (giữ dày/border chuẩn).
  - [x] `stepper.dart` — `AppStepper`: enum `AppStepState { done, current, gate }` + `AppStepItem { label, state }`. Mirror `.step*` (110–123): node tròn **26px** nối bằng thanh 1.5px `line`; `done` = viền+nền `teal` tick trắng (`AppIcon('ic-check', 14)`); `current` = viền `teal` nền `#fff` chữ `teal700` + **ring 3px `teal050`** (vẽ bằng **double border / hai `Container` lồng hoặc `BoxDecoration` 2 lớp — KHÔNG `BoxShadow`**; đây là ngoại lệ "Viền nét" đã duyệt DESIGN.md 217, ring hữu hạn 0 blur); `gate` = viền **đứt** (dashed) màu `#c3d3ce` nhãn `#a9bab5`. Nhãn bước micro (9.5px/w700 `muted`) dưới node. **Bước gate KHÔNG áp dụng bị ẩn hẳn** khỏi `steps` (caller lọc) — KHÔNG disable xám (UX-DR-11). *(Dashed border trong Flutter cần `CustomPainter` hoặc vẽ viền đứt thủ công — xem gotcha.)*
  - [x] `kpi.dart` — `AppKpi`: mirror `.kpi*` (127–131): viền `line` radius `radiusLg` padding 12/14; nhãn micro-uppercase `muted`; giá trị **23px/w900 letter-spacing -.02em**; delta 11px/w700 `ok`; biến thể `accent` viền `teal` nền `teal050`. (Lưới KPI 4→2 cột responsive = **Story 1.9/1.8 app-shell**, KHÔNG làm ở 1.7 — 1.7 chỉ cấp widget `AppKpi` đơn lẻ.)

- [x] **Task 4 — Hành vi: `AppCartLineRow` + list-state `AppSkeleton`/`AppEmptyState`/`AppErrorState` (mirror Story 1.6) (AC: 2)**
  - [x] `cart_line_row.dart` — `AppCartLineRow`: một dòng giỏ hàng (Row/TableRow). Prop:
    `{ required String name, String? sku, String? meta, required num qty, required num unitPrice, required num amount, bool editable = false, String? flag, bool zebra = false, ValueChanged<num>? onQtyChange, ValueChanged<num>? onUnitPriceChange, VoidCallback? onDelete }`.
    - Cột 1: `name` (`.strong` ink w800) + (`sku`||`meta`) micro `muted` xuống dòng; `flag` (vd "linh động"/"dự kiến") render **chỉ hiển thị** micro `muted` — KHÔNG tác động giá.
    - Cột SL / Đơn giá: nếu `editable` → `AppField`/`TextField` `keyboardType: number`, `onChanged` **phát ngay** `onQtyChange(num.parse)` / `onUnitPriceChange(...)` (không nút lưu, không debounce chặn). Nếu `!editable` → số tĩnh canh phải (`.num`, tabular).
    - Cột Thành tiền: **render THẲNG `amount` từ prop**. 🚫 **TUYỆT ĐỐI KHÔNG** viết `qty * unitPrice`, `qty*price`, cộng dồn, format-tính tiền — `amount` là số **backend đã tính** (client gọi `POST /orders/preview-total`, chỉ hiển thị; AD-10/16). "Tổng nhảy realtime" = **màn** gọi `preview-total` mỗi lần callback bắn, backend tính, màn re-render.
    - **Xoá dòng — MOBILE có swipe (điểm parity web hoãn sang 1.7, UX-DR-24):** bọc dòng trong `Dismissible` (swipe → `onDelete`) **và/hoặc** nút icon `AppIcon('ic-trash')`. `onDelete` chỉ phát ý định (màn xử lý xoá + gọi lại `preview-total`).
  - [x] `skeleton.dart` — `AppSkeleton`: mirror `.skel` — nền `surface2`, radius **6px** (hằng skeleton, không token), **tĩnh, KHÔNG shimmer/gradient** (Viền nét). Prop `{ double? width, height, radius }`. Màn ghép nhiều `AppSkeleton` khớp layout.
  - [x] `empty_state.dart` — `AppEmptyState`: khối canh giữa: icon lớn mờ (optional, `AppIcon`), `title` (micro/đậm), `message`, slot `action` (thường `AppButton`). Dùng cho **cả** empty-list ("Chưa có đơn nào. Bấm ➕Tạo để bắt đầu.") **và** phone-search-empty ("SĐT chưa có trong hệ thống." + action "Tạo khách hàng mới"). **KHÔNG hard-code chuỗi Việt** — nhận `title/message/action` qua prop (UX-DR-19, i18n-friendly).
  - [x] `error_state.dart` — `AppErrorState`: `{ required String message, VoidCallback? onRetry, String retryLabel = 'Thử lại' }` → tái dùng `AppBanner(danger)` + (nếu `onRetry`) `AppButton(ghost, sm, icon: 'ic-refresh')`. **KHÔNG dựng lại banner.**

- [x] **Task 5 — Overlay: `AppDialog`, `AppConfirmDialog`, `AppSheet` (mirror Story 1.6, đúng quy tắc mobile) (AC: 2)**
  - [x] `dialog.dart` — `AppDialog` + helper `showAppDialog(...)`. Mirror `.modal*` (152–156): thẻ 340px (mobile: `min(340, maxWidth-2*22)`), nền `#fff`, **viền `ink` 1.5px**, radius `radiusLg`, overflow hidden. Head padding 13/16 border-bottom `line` + tiêu đề 14px/w800 + nút đóng (`AppIcon('ic-close')` → `Navigator.pop`/`onClose`); body padding 16; foot padding 12/16 border-top `line` gap 8. **Nổi bằng viền ink trên `barrierColor: rgba(12,31,28,.32)` = `AppTokens.ink` @ .32 — KHÔNG drop-shadow.** Dùng `showDialog` với `Dialog`(elevation **0**, `shadowColor` transparent) hoặc `Container` custom. **Back-button/tap-barrier đóng** (native). **Chồng tối đa một cấp** (đừng show Dialog trên Dialog).
  - [x] `AppConfirmDialog` (thin wrapper trên `AppDialog`): `{ required String title, required Widget consequence, String confirmLabel, cancelLabel, AppButtonVariant confirmTone, VoidCallback onConfirm, onCancel }`. Body = `AppBanner(tone: danger?warn)` nêu hậu quả; foot = nút xác nhận (`danger`/`primary`) + nút huỷ (`ghost`). **`onConfirm` CHỈ phát ý định** — KHÔNG tự đổi status/gọi API (AD-11).
  - [x] `sheet.dart` — `AppSheet` + helper `showAppSheet(...)`. Mirror `.sheet`/`.sheet-grab` (160–161): bottom sheet nền `#fff` viền `ink` 1.5px, **top corners bo 18px** (hằng chuẩn DESIGN.md 226, KHÔNG token), grab handle 38×4 `line` pill trên cùng. Dùng `showModalBottomSheet` (elevation **0**, `backgroundColor` transparent + `Container` bo 18px, `barrierColor` ink@.32). **Ghi rõ:** Sheet dành cho **lựa chọn nhanh / native share** (UX-DR-20); hành động **có hệ quả BẮT BUỘC `AppDialog`**. (Bottom-sheet là bề mặt **native mobile** — đây là nơi UX-DR-20 gán cho mobile, khác web.)

- [x] **Task 6 — Native share + upload ảnh: `AppShareButton`, `AppImageUpload` (mirror Story 1.6, dùng cơ chế native) (AC: 2)**
  - [x] **Thêm dependency** vào `mobile/pubspec.yaml`: `share_plus` (native share sheet) + `image_picker` (camera/gallery). Chạy `flutter pub get`. (Xem Open Question về platform permission — plugin không chạy trong test VM, dùng fake khi test.)
  - [x] `share_button.dart` — `AppShareButton`: `{ List<XFile>? files, String? title, text, label = 'Chia sẻ', AppButtonVariant variant, ValueChanged<ShareResult>? onResult }`. Tapping → `Share.shareXFiles(files, ...)` (share_plus) — **native share sheet, ưu tiên ẢNH trước PDF** (caller sắp `files` `[image, pdf]`). Đây chính là "share-grid app (Zalo/Messenger…)" mà web hoãn sang mobile — **dùng OS share sheet, KHÔNG tự vẽ lưới app**. Bắt lỗi/huỷ → không throw. Render bằng `AppButton(icon: 'ic-share')`. **Cho phép inject `Future<void> Function(...)? shareImpl`** để test không gọi plugin thật.
  - [x] `image_upload.dart` — `AppImageUpload` (controlled): `{ required List<AppUploadItem> images, required ValueChanged<List<XFile>> onAdd, ValueChanged<String>? onRemove, int? max, String hint, ImagePickFn? pick }`. Mirror `.thumbs`/`.thumb`/`.thumb.add`:
    - Thumbnails 74px (viền `line` 1.5px radius `radiusDefault` nền `surface2`); mỗi item có ảnh → `Image`, else `AppIcon('ic-image')`; nút xoá nhỏ (`ic-close`/`ic-trash`) nếu `onRemove`.
    - Ô thêm `.thumb.add` (viền **đứt** `teal`, `ic-plus` `teal700` w800): tap → mở `AppSheet` "Chụp ảnh" (camera) / "Chọn từ thư viện" (gallery) → gọi `pick(source)` (mặc định `image_picker`) → **phát `onAdd(files)`**. Ẩn ô thêm khi đạt `max`.
    - `hint` micro `muted` (vd "Chụp hoặc chọn từ máy · nhiều ảnh").
    - 🚫 **KHÔNG upload / `http` / `dio` / R2 / signed URL trong widget** — chỉ phát `XFile[]` qua `onAdd` (AD-3: backend trung gian R2). **Upload luôn optional** — KHÔNG validate "bắt buộc ≥1 ảnh" (UX-DR-25). **Inject `pick`** để test dùng fake picker (tránh plugin thật trong test VM).
  - [x] Tạo barrel `mobile/lib/design_system/components/components.dart` export mọi widget + enum/typedef trên. (Song song `tokens/app_tokens.dart` + `icons/app_icons.dart` đã có — cân nhắc một barrel gốc `design_system/design_system.dart` re-export tokens+icons+components; giữ tối giản, KHÔNG phá import cũ.)

- [x] **Task 7 — Test native Flutter (widget render + tương tác + rào bất biến) (AC: 1, 2, 3)**
  - [x] Tạo widget test dưới `mobile/test/design_system/components/` (mirror cấu trúc test tokens/icons đã có), chạy `flutter test`:
    - **Render + token (AC-1):** mỗi widget `pumpWidget` không lỗi; `AppButton` đủ 5 variant + 2 size dùng đúng `AppTokens` màu/border; `AppStatusChip` render đủ **9** trạng thái đúng bộ 3 hex + nhãn verbatim; `AppBanner` 3 tone; `AppKpi` value 23/900; `AppTable` header surface2/last-row-borderless; `AppStepper` done/current/gate.
    - **Viền nét (AC-1) — rào no-shadow:** quét **text source** mọi file `components/*.dart` (đọc như text, mirror pattern `parity.test.mjs`), assert **KHÔNG** khớp `BoxShadow|elevation:\s*[1-9]|Shadow\(|LinearGradient|RadialGradient` (ngoại lệ **duy nhất**: ring stepper `current` phải là double-border/2 lớp `Container`, KHÔNG `BoxShadow`). Cộng: assert mọi `Dialog`/`showModalBottomSheet`/`Material` đặt `elevation: 0`.
    - **CartLineRow — rào số học tiền (AD-10/16, QUAN TRỌNG NHẤT):** (a) **runtime:** pump với `qty:2, unitPrice:500, amount:999` → widget hiển thị **999** (KHÔNG 1000) → chứng minh không nhân; sửa field qty → `onQtyChange` bắn giá trị mới **nhưng amount hiển thị KHÔNG đổi** (chờ backend). (b) **source-guard:** strip comment/string rồi assert `cart_line_row.dart` **KHÔNG** khớp `/qty\s*[*]\s*unit|unit\w*\s*[*]\s*qty|[*]\s*unitPrice|qty\s*[*]/i`; assert render `amount` trực tiếp; assert có `onQtyChange/onUnitPriceChange/onDelete`.
    - **ImageUpload — rào no-upload (AD-3):** source-guard assert `image_upload.dart` **KHÔNG** chứa `http`/`dio`/`HttpClient`/`R2`/`signed`/`.upload(`/`fetch`; runtime: tap add → sheet camera/gallery → `pick` (fake) trả 1 file → `onAdd([file])` bắn, widget **không** gọi mạng. Assert optional (không validate bắt buộc).
    - **Overlay — không đổi status (AD-11):** `AppConfirmDialog` `onConfirm` bắn ý định, không có code `applyTransition`/`status=`; back/tap-barrier đóng; source-guard assert `AppSheet` chú thích "lựa chọn nhanh" + consequential→Dialog.
    - **ShareButton:** tap → gọi `shareImpl` (fake) với `files` (ảnh trước PDF); source-guard assert dùng `share_plus`/`Share.share`, KHÔNG tự vẽ share-grid.
  - [x] **Parity cross-platform (AC-3) — guard "cùng màn" chống drift màu:** tạo `design-system/components/parity.test.mjs` (Node, mirror `tokens/parity.test.mjs`/`icons/parity.test.mjs`): đọc `web/src/design-system/components/components.css` **và** `mobile/lib/design_system/components/status_chip.dart` + `banner.dart`, assert **9 bộ 3 hex status** + **3 tone banner hex** xuất hiện **byte-cho-byte trên cả hai** (fail nếu ai đổi màu một bên). Cộng: assert bộ **tên widget parity** (Button/Card/Frame/Field/Chip/StatusChip/CustomerTypeChip/ScopeFlag/Table/Stepper/Kpi/Banner/CartLineRow/Dialog/ConfirmDialog/Sheet/Skeleton/EmptyState/ErrorState/ShareButton/ImageUpload) đều có file Dart tương ứng (parity coverage với `web/.../components/index.ts`).
  - [x] Chạy `cd mobile && flutter analyze` (sạch) + `flutter test` (toàn pass); `cd design-system && npm test` (parity mới pass, **0 hồi quy** token/icon/1.3–1.6). Nếu `mobile/analysis_options.yaml` chưa có → thêm tối giản (`include: package:flutter_lints/flutter_lints.yaml`) + `flutter_lints` devDep (project-context yêu cầu `analysis_options.yaml`).

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep + chống vi phạm bất biến)

- Story này là **PARITY MOBILE (Flutter)** cho toàn bộ tầng component web 1.3–1.6 gộp lại: dựng **thư viện widget** từ `AppTokens`+`AppIcon` đã ship. Đây là **thư viện primitive**, **KHÔNG** phải màn tính năng.
- **KHÔNG dựng màn nào ở 1.7.** Màn Đăng nhập demo (parity side-by-side thật) = **Story 1.11**; app shell mobile (topbar, bottom-nav 5-tab + FAB, phone frame) = **Story 1.8**; gating theo quyền + a11y floor + kiểm parity chính thức = **Story 1.10**. 1.7 chỉ cấp widget + guard parity màu/spec.
- **Bất biến KHÔNG được chạm (widget chỉ là vỏ trình bày/hành vi; logic ở backend) — GIỐNG HỆT web 1.6:**
  - 🚫 **KHÔNG tính tiền/thuế client (AD-10/16):** `AppCartLineRow` render `amount` **từ prop** (backend trả `POST /orders/preview-total`). Widget **không** nhân `qty×unitPrice`, không cộng tổng, không VAT. "Tổng realtime" = **màn** gọi `preview-total` mỗi lần callback → backend tính → màn re-render.
  - 🚫 **KHÔNG đổi `Order.status` (AD-11):** `AppDialog`/`AppConfirmDialog` (Chốt/Huỷ/Duyệt/thanh toán) **chỉ thu ý định** (`onConfirm`) → màn gọi backend → backend chạy `applyTransition()`.
  - 🚫 **KHÔNG upload R2 (AD-3):** `AppImageUpload` phát `XFile[]` qua `onAdd`; **màn/backend** lo signed URL + R2. Widget không đụng mạng.
  - 🚫 **KHÔNG chuỗi quyền literal (AD-17):** widget không tự gate; gating hiển thị/ẩn = **Story 1.10**. 1.7 chỉ nhận prop/callback.
- **Ngoài phạm vi (thuộc story khác):** lưới KPI responsive 4→2 cột & phone frame & bottom-nav (→1.8/1.9); màn thật (→1.11 + Epic 3–8); backend `preview-total`/error-envelope/R2/`applyTransition` (→Epic 2/4/5). 1.7 định nghĩa **contract callback** để khớp, không cài.
- **Nhưng:** widget phải **đủ hành vi ngay** (CartLineRow editable + swipe/nút xoá; Dialog/Sheet back/barrier đóng; Empty/Error/Skeleton; ShareButton native share; ImageUpload camera/gallery + optional) để màn Epic 3–8/1.11 dùng mà không phải bổ sung.

### Tái dùng hạ tầng 1.1–1.2 — KHÔNG tạo trùng (DRY, scout-before-code)

- **`AppTokens`** (`mobile/lib/design_system/tokens/app_tokens.dart`) đã có đủ 17 màu + spacing + radius + typography + `borderWidth=1.5`. **Consume, KHÔNG re-declare.** `FontWeight` map: 900→`w900`, 800→`w800`, 700→`w700`, 600→`w600`, 400→`w400`.
- **`AppIcon(name, size, color)`** + `AppIcons.registry/names` đã có (46 icon, currentColor). Dùng cho mọi icon (ic-trash, ic-close, ic-plus, ic-image, ic-share, ic-refresh, ic-alert, ic-check, ic-camera…). **KHÔNG** nhúng SVG thủ công, KHÔNG dùng `Icons.*` Material.
- Icon context-size (mirror CSS `.icn` rules): trong `AppButton` = **15**; `AppBanner` = **16**; ô số `AppTable` = **14**; tick/gate `AppStepper` = **14**. `AppIcons.defaultSize` = 18.
- Các hằng **non-token** mirror verbatim web (để literal, KHÔNG thêm vào `AppTokens` — tránh scope-creep Story 1.1): 9 bộ 3 hex status; banner warn/info/danger hex; table zebra `#F7FBFA`; stepper `#9fb2ad`/`#c3d3ce`/`#a9bab5`; thumb glyph `#b7c9c4`; sheet góc `18px`; skel `6px`; scrim `rgba(12,31,28,.32)`.

### Kiến trúc & nguyên tắc bắt buộc

- **AD-13 (design-system-first):** thư viện widget Flutter là mảnh **parity** kế tiếp DESIGN.md, dựng **trước mọi màn mobile**; màn Epic 3–8/1.11 **cấm style/hành vi ad-hoc** — phải dùng `AppButton`/`AppCartLineRow`/`AppDialog`… [Source: ARCHITECTURE-SPINE.md#AD-13, project-context.md]
- **UX-DR-27 (parity "cùng màn"):** cùng màn nghiệp vụ nhận ra được trên web + mobile, chỉ khác khung + điều hướng. 1.7 đảm bảo ở **tầng widget**: cùng token, cùng spec màu/spacing/radius/typography, cùng tập component. Guard bằng parity test cross-platform (9 hex status + tone banner + tên widget khớp web). [Source: epics.md#Story 1.7 (243–245), DESIGN.md 156]
- **UX-DR-20 (overlay rule, mobile):** **bottom-sheet (Sheet) = lựa chọn nhanh / native share**; **Dialog = hành động tiền/dữ liệu có hệ quả** (Chốt/Huỷ/Duyệt/ghi thanh toán); chồng tối đa một cấp. Trên mobile, bottom-sheet là bề mặt native (khác web nơi Sheet chỉ parity). [Source: epics.md#UX-DR-20]
- **UX-DR-24 (giỏ hàng, MOBILE có swipe):** dòng recalc realtime qua callback; **swipe-to-delete** (web hoãn sang mobile) → dùng `Dismissible`. `amount` từ backend. [Source: epics.md#UX-DR-24, 1-6 Dev Notes]
- **UX-DR-25 (upload optional, camera/gallery):** mobile chụp trực tiếp **hoặc** chọn thư viện; luôn optional; widget chỉ phát file (AD-3). [Source: epics.md#UX-DR-25]
- **UX-DR-19 (list-state + microcopy Việt):** Skeleton / Empty (câu + action) / Error (cụ thể + Thử lại) / Confirm (nêu hậu quả) / phone-search-empty. Chuỗi Việt **do màn truyền** qua prop. [Source: epics.md#UX-DR-19]
- **UX-DR-11 (stepper):** bước gate **ẩn hẳn** (caller lọc), KHÔNG disable xám; ring `current` là double-border hữu hạn (0 blur), ngoại lệ Viền nét đã duyệt. [Source: epics.md#UX-DR-11, DESIGN.md 217]
- **"Viền nét" (UX-DR-4):** phẳng — phân cấp bằng viền 1.5px + bậc nền; **KHÔNG shadow/elevation/gradient**. Overlay nổi bằng viền ink 1.5px trên barrier ink@.32. [Source: DESIGN.md 217/226/267, components.css]
- **Naming/convention (project-context):** Flutter = Clean Architecture + BLoC; **widget design-system là tầng presentation thuần** (StatelessWidget controlled + callback) — **KHÔNG BLoC/state nghiệp vụ trong widget** (state do màn/BLoC ở tầng trên giữ). File snake_case, class PascalCase, `dart format` + `flutter analyze` sạch. [Source: project-context.md#Coding style]

### Đặc tả visual — nguồn chân lý là `web/src/design-system/components/components.css` (mirror byte-cho-byte)

> **Nguyên tắc:** mọi số px/hex trong widget Flutter phải **khớp `components.css`**. Bảng dưới rút gọn; đọc `components.css` (đã trích trong References) làm chuẩn cuối. Token → `AppTokens.*`; hằng non-token → literal.

- **Button** `.btn` (12–21): border 1.5px teal / surface / teal700 w800 13px / radius default / pad 9×15; primary teal/#fff; accent lime050/lime600/lime; ghost line/ink2; danger danger; sm pad 5×10 11.5px radiusSm; wide full; icon 15.
- **Card/Frame** (24–30): card surface/line1.5/radiusLg (ink|teal variant); frame ink1.5/radiusLg + label 10px/w800/.08em/ink absolute top-8 left14 nền surface.
- **Field** (33–39): line1.5/radiusDefault/surface/pad10×12/13.5px ink; focus→teal no glow; field-lg pad13×14/15px; flabel 10px/w800/.08em muted.
- **Chip** (48–66): pill radiusFull border1.5 11px/w700; dot 6px circle currentColor op.85; 9 status triplets (bảng Task 2); ktype lime/lime050 10.5px/w800 ink; scope-flag on teal/teal700, off line/#9fb2ad line-through.
- **Banner** (89–94): warn `#FBF0DA/#8A5C08` / info `#DEF1F6/#0C6B84` / danger `#FAE6E6/#B22C2C`, border tone, radiusDefault, pad10×12, 12px/w600; icon 16.
- **Table** (97–105): 12.5px; th 10px/w800/.05em muted surface2 border-bottom1.5 line; td pad9×12 border-bottom1px line ink2; last-row no border; num right; strong ink w800; zebra `#F7FBFA`; icon 14.
- **Stepper** (110–123): node 26px; bar 26×1.5 line; bul default line/#fff/#9fb2ad; done teal/teal/#fff; current teal/#fff/teal700 + ring 3px teal050 (double border); gate dashed `#c3d3ce` / label `#a9bab5`; label 9.5px/w700 muted.
- **KPI** (127–131): line/radiusLg/pad12×14; k-l 10px/w800/.06em muted; k-v 23px/w900/-.02em; k-d 11px/w700 ok; accent teal/teal050.
- **Overlay** (152–171): modal 340px/#fff/ink1.5/radiusLg; head pad13×16 border-bottom line + 14px/w800; body 16; foot pad12×16 border-top line gap8; scrim ink@.32; sheet ink1.5 top-radius 18px; sheet-grab 38×4 line pill; thumb 74px line1.5 radiusDefault surface2 glyph `#b7c9c4`; thumb.add dashed teal teal700 w800; skel surface2 6px.

### Gotcha bắt buộc xử lý (Flutter-specific)

- **Material tự thêm shadow/elevation (vi phạm Viền nét — dễ sai nhất):** `Card`, `Dialog`, `showModalBottomSheet`, `AppBar`, `Material`, `ElevatedButton`, `Chip`, `Banner` của Flutter **mặc định có elevation/shadow**. **CẤM dùng trực tiếp.** Dựng bằng `Container(decoration: BoxDecoration(border, borderRadius, color))`. Khi buộc dùng `showDialog`/`showModalBottomSheet`, đặt `elevation: 0`, `shadowColor: Colors.transparent`, `backgroundColor: transparent` rồi tự vẽ `Container` viền. Source-guard test bắt `BoxShadow`/`elevation:[1-9]`.
- **Dashed border (`.thumb.add`, stepper `gate`):** Flutter KHÔNG có `border-style: dashed` sẵn. Dùng `CustomPainter` vẽ viền đứt **hoặc** package `dotted_border` (cân nhắc YAGNI — 2 chỗ dùng, `CustomPainter` nhẹ hơn 1 dependency). Chọn `CustomPainter` trừ khi có lý do. Ghi quyết định.
- **Stepper `current` ring KHÔNG phải BoxShadow:** web dùng `box-shadow:0 0 0 3px teal050` (double-border kỹ thuật, 0 blur). Flutter mirror bằng **`Container` ngoài (nền teal050, padding 3) bọc `Container` trong (node teal border)** hoặc `BoxDecoration` 2 lớp — **TUYỆT ĐỐI KHÔNG** `BoxShadow` (source-guard sẽ fail). Đây là ngoại lệ Viền nét duy nhất.
- **CartLineRow — KHÔNG số học tiền (AD-10/16):** dev hay "tiện tay" viết `amount = qty * unitPrice`. **CẤM.** `amount` là prop backend. `onQtyChange`/`onUnitPriceChange` chỉ phát số mới. Runtime test (amount=999 độc lập qty×price) + source-guard bắt `qty*`/`*unitPrice`.
- **`num` parsing field:** qty/unitPrice là `num`; parse an toàn (`num.tryParse(text) ?? 0`), không crash chuỗi rỗng/không hợp lệ; phát callback ngay (không debounce chặn realtime).
- **Plugin không chạy trong test VM (`image_picker`/`share_plus`):** widget test chạy trên Flutter test host **không** có platform channel thật. **Inject** `pick` (ImageUpload) + `shareImpl` (ShareButton) để test dùng fake; mặc định production wiring tới plugin thật. Tránh gọi plugin trực tiếp trong `build`.
- **Chưa có android/ios scaffold:** `mobile/` là package tối giản (chỉ lib/test/pubspec), **chưa** có `android/`/`ios/`. Camera/share thật cần platform config (permission `NSCameraUsageDescription`/`READ_MEDIA_IMAGES`) — thuộc **Story 1.8 app-shell** hoặc grooming (xem Open Question). 1.7: widget + inject-point sẵn sàng; `flutter test` chạy được không cần platform (widget test trên VM).
- **Dart format 80-col + `ignore_for_file`:** file tokens/icons dùng `// ignore_for_file`; giữ style nhất quán. Chạy `dart format` trước commit.

### Testing standards [Source: project-context.md#Testing, Story 1.1/1.2 Flutter test pattern]

- **KHÁC web (điểm mạnh 1.7):** mobile **CÓ** `flutter_test` (đã dùng ở test tokens/icons) → **test render + tương tác THẬT** (pump widget, gõ field, tap, đóng overlay) — không bị giới hạn "source-guard đọc text" như web 1.6. Tận dụng: mỗi widget có widget test render; CartLineRow/ImageUpload/overlay có test tương tác runtime **cộng** source-guard.
- **2 rào bất biến quan trọng nhất** (mirror web 1.6): (a) `AppCartLineRow` KHÔNG số học tiền + render `amount` prop (runtime **và** source-guard); (b) `AppImageUpload` KHÔNG upload/http/R2 (source-guard + runtime không-gọi-mạng). Cộng: no-shadow (Viền nét), overlay không đổi status, share dùng share_plus.
- **Parity guard cross-platform (AC-3):** `design-system/components/parity.test.mjs` (Node, mirror tokens/icons parity) đọc web CSS + Dart, assert 9 hex status + 3 tone banner **byte-cho-byte** khớp + tên widget parity đầy đủ. Đây là hiện thân "cùng màn" (UX-DR-27) ở tầng test.
- Chạy: `cd mobile && flutter analyze && flutter test` + `cd design-system && npm test`. **0 hồi quy** token/icon (1.1/1.2) + 1.3–1.6 web.

### Previous Story Intelligence (Story 1.6) [Source: 1-6-*.md]

- **Pattern hành vi đã chốt (web 1.6):** controlled/stateless component + callback (không state nghiệp vụ trong component); CartLineRow render `amount` prop (no money math); Dialog/Sheet controlled Esc/backdrop đóng; ImageUpload phát File qua onAdd (no upload); ErrorState/ConfirmDialog tái dùng Banner; barrel export. **1.7 mirror y hệt sang Flutter idiom** (Dismissible thay swipe web-hoãn; showModalBottomSheet native; image_picker/share_plus thay input-file/navigator.share).
- **Bài học code-review 1.6 (áp dụng trước):** (1) overlay **cướp focus** khi parent re-render → Flutter dùng `showDialog`/`showModalBottomSheet` (route riêng) tránh được, nhưng nếu tự dựng overlay thì cẩn thận effect. (2) nút không-submit thiếu `type=button` → Flutter không có khái niệm submit ngầm; nhưng **đảm bảo nút trong form không trigger submit ngoài ý muốn** (Flutter an toàn hơn, chỉ cần onPressed rõ ràng).
- **Bài học false-positive source-guard (1.4/1.5/1.6):** **strip comment/string trước khi quét** regex cấm (`qty*`, `http`, `BoxShadow`) — docstring/comment chứa chuỗi cấm gây false fail. Áp cho source-guard Dart.
- **`STATUS_LABELS` + 9 triplet (1.4):** nhãn Việt verbatim; mirror sang Dart map — parity test giữ đồng bộ.

### Git Intelligence [Source: recent commits]

- `09d8909 feat(story-1.6)` (HEAD, baseline story này) · `cf9270c feat(story-1.5)` · `e59ed50 feat(story-1.4)` · `b98d567 feat(story-1.3)` · `18e0dc0 feat(story-1.2)`. Baseline = **09d8909**. Commit conventional `feat(story-1.7): …`, tiếng Việt, **không** tham chiếu AI. File đụng: `mobile/lib/design_system/components/*` (mới) + `mobile/test/design_system/components/*` (mới) + `mobile/pubspec.yaml` (thêm deps) + `design-system/components/parity.test.mjs` (mới) + (nếu thiếu) `mobile/analysis_options.yaml`. **KHÔNG** đụng `mobile/lib/design_system/tokens/*` `icons/*` (1.1/1.2) hay web `src/design-system/*` (1.3–1.6).

### Latest Tech Information [Source: project-context.md#Stack, web research pubspec]

- **Flutter 3.44** (Clean Architecture + BLoC) — widget design-system là `StatelessWidget` controlled. `flutter_svg ^2.3.0` đã có (icons). **Deps thêm:** `share_plus` (native share; API `Share.shareXFiles(List<XFile>)`), `image_picker` (`ImagePicker().pickImage(source: ImageSource.camera|gallery)` trả `XFile?`). Chọn version stable tương thích Flutter 3.44 / Dart SDK `>=3.4.0 <4.0.0` (khai trong pubspec, chạy `flutter pub get` để khớp). `image_picker` cần platform permission (→ Story app-shell/grooming). Cả hai plugin: widget chỉ **gọi**, KHÔNG upload — AD-3 giữ nguyên.

### Project Structure Notes

- **Surgical (project-context#Scout-before-code):** chỉ **thêm** file widget + test mới + 2 dep + parity test + (optional) analysis_options. **Không** đụng tokens/icons (1.1/1.2), không đụng web (1.3–1.6).
- Đường dẫn (MỚI, `mobile/lib/design_system/components/`): `button.dart`, `card.dart`, `field.dart`, `chip.dart`(hoặc gộp), `status_chip.dart`, `table.dart`, `stepper.dart`, `kpi.dart`, `banner.dart`, `cart_line_row.dart`, `dialog.dart`, `sheet.dart`, `skeleton.dart`, `empty_state.dart`, `error_state.dart`, `share_button.dart`, `image_upload.dart`, `components.dart` (barrel).
- Test (MỚI, `mobile/test/design_system/components/`): `*_test.dart` tương ứng (render + tương tác + source-guard no-shadow / no-money-math / no-upload).
- Cross-platform parity: `design-system/components/parity.test.mjs` (MỚI).
- Sửa: `mobile/pubspec.yaml` (thêm `share_plus`, `image_picker`, dev `flutter_lints`); (nếu thiếu) `mobile/analysis_options.yaml` (mới).

### References

- [Source: web/src/design-system/components/components.css] — **nguồn spec visual chuẩn tắc** mirror byte-cho-byte: Button (12–21), Card/Frame (24–30), Field (33–39), Chip/status/ktype/scope (48–66), Banner (89–94), Table (97–105), Stepper (110–123), KPI (127–131), overlay/sheet/thumb/skel (147–171).
- [Source: web/src/design-system/components/index.ts] — barrel liệt kê **đủ 21 component + typedef** cần parity (Button…ImageUpload + shareFiles). Dùng làm checklist coverage.
- [Source: web/src/design-system/components/CartLineRow.tsx, Dialog.tsx, Sheet.tsx, ImageUpload.tsx, ShareButton.tsx, share.ts, StatusChip.tsx, EmptyState.tsx, ErrorState.tsx] — hợp đồng prop + hành vi web 1.6/1.4 để mirror (đọc khi cần chi tiết prop; bảng Task đã tóm).
- [Source: 1-6-react-hanh-vi-gio-hang-*.md] — pattern behavior layer, 2 rào bất biến (money math / upload), gotcha strip-comment source-guard, code-review focus/submit fixes.
- [Source: mobile/lib/design_system/tokens/app_tokens.dart] — `AppTokens` (consume: teal/teal700/teal050/lime/lime600/lime050/ink/ink2/muted/line/bg/surface/surface2/ok/warn/danger/info; space*/gutter/pageX; radiusSm/Default/Lg/Full; display/title/body/meta/micro font; borderWidth 1.5).
- [Source: mobile/lib/design_system/icons/app_icons.dart] — `AppIcon(name,size,color)` + `AppIcons.registry/names` (46 icon, currentColor). Icon context-size: btn15/banner16/table-num14/stepper14.
- [Source: mobile/test/design_system/tokens/app_tokens_test.dart, icons/app_icons_test.dart] — pattern test Flutter native (import `package:flutter_test`, `test(...)`, `expect(...)`, `pumpWidget`) + no-decorative-depth guard.
- [Source: design-system/tokens/parity.test.mjs, icons/parity.test.mjs] — pattern parity cross-platform Node đọc file text web+dart, assert byte-identical → mirror cho `components/parity.test.mjs`.
- [Source: epics.md#Story 1.7 (240–245)] — user story + 3 AC (UX-DR-5..13, 24, 25, 20, 27). Epic 1 "design-system-first" (190–191).
- [Source: DESIGN.md] — "một design system, hai nền tảng… cùng màn nhận ra được, chỉ khác khung + điều hướng" (156); Viền nét không drop-shadow (217/267); sheet 18px (226); icon SVG hoạt động giống hệt web+Flutter (249).
- [Source: ARCHITECTURE-SPINE.md / project-context.md] — AD-13 (design-system-first), AD-10/16 (một hàm pricing, client không tính tiền), AD-11 (chỉ applyTransition đổi status), AD-3 (R2 qua backend), AD-17 (permission registry); Flutter Clean Architecture + BLoC, dart format + analysis_options.

**Stack liên quan:** Flutter 3.44 (Dart SDK `>=3.4.0 <4.0.0`) · `flutter_svg ^2.3.0` (đã có) · **thêm** `share_plus` + `image_picker` + dev `flutter_lints`. **Mobile-only** — KHÔNG đụng web/`src/design-system/` hay backend. [Source: project-context.md#Stack]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8) — BMAD dev-story workflow.

### Debug Log References

- `flutter analyze` (mobile): No issues found.
- `flutter test` (mobile): 44/44 passed (render + interaction + source-guard).
- `cd design-system && npm test`: 92/92 passed (5 new parity tests, 0 regressions on tokens/icons/1.3–1.6 guards).
- Gotcha fixes during dev: `flutter_lints` include path is `package:flutter_lints/flutter.yaml` (not `flutter_lints.yaml`); `Container` cannot set both `color` and `decoration` (AppTable header); parity test must not `toUpperCase()` the Dart source (turns `0x`→`0X`, breaking the `0xFF…` needle).

### Completion Notes List

- **Task 1–6 (21 widgets, `App`-prefixed):** built the full Flutter parity library from the shipped `AppTokens` + `AppIcon` — Button/Card/Frame/Field, Chip/StatusChip(9)/CustomerTypeChip/ScopeFlag, Table/Stepper/KPI/Banner, CartLineRow/Skeleton/EmptyState/ErrorState, Dialog/ConfirmDialog/Sheet, ShareButton/ImageUpload + `components.dart` barrel. All flat "Viền nét" (1.5px borders, no shadow/elevation/gradient). Non-token constants (9 status triplets, 3 banner tones, zebra/stepper/thumb/sheet/skel literals) mirrored verbatim from `components.css`.
- **Invariants held (widget = presentation only):** `AppCartLineRow` renders backend `amount` and never multiplies qty×unitPrice (AD-10/16); `AppImageUpload` emits `XFile[]` via `onAdd`, zero network/R2 (AD-3); `AppDialog`/`AppConfirmDialog` emit intent only, no status mutation (AD-11). Stepper `current` ring is a teal050 double-border (the one sanctioned Viền-nét exception), never a `BoxShadow`.
- **Native mobile behaviours:** `Dismissible` swipe-to-delete on cart line (web-deferred, UX-DR-24); `showModalBottomSheet` (flat) for Sheet; `image_picker` camera/gallery; `share_plus` OS share sheet (image before pdf). Plugins are injected (`pick`/`shareImpl`) so widget tests run on the VM with no platform channel.
- **Guards:** native runtime tests (money amount independent of qty×price; pick→onAdd; share impl called; overlay confirm/close) + Dart source-guards (no-shadow, no-money-math, no-upload, no-status-change, uses share_plus) + Node cross-platform parity (`design-system/components/parity.test.mjs`: 9 status triplets + 3 banner tones byte-identical web↔Dart, 21-widget coverage, App-prefix names).
- **Deps added:** `image_picker ^1.1.2`, `share_plus ^10.1.4`, dev `flutter_lints ^4.0.0`; new `mobile/analysis_options.yaml`. Open Questions resolved as proposed: permissions deferred to app-shell (1.8); `CustomPainter` (not a package) for dashed borders; `components.dart` barrel added.

### File List

**New — `mobile/lib/design_system/components/`:** `button.dart`, `card.dart`, `field.dart`, `chip.dart`, `status_chip.dart`, `banner.dart`, `table.dart`, `stepper.dart`, `kpi.dart`, `cart_line_row.dart`, `skeleton.dart`, `empty_state.dart`, `error_state.dart`, `dialog.dart`, `sheet.dart`, `share_button.dart`, `image_upload.dart`, `dashed_rect.dart` (internal dashed-border painter), `components.dart` (barrel).

**New — `mobile/test/design_system/components/`:** `components_render_test.dart`, `behavior_interaction_test.dart`, `invariant_guard_test.dart`.

**New — other:** `mobile/analysis_options.yaml`, `design-system/components/parity.test.mjs`.

**Modified:** `mobile/pubspec.yaml` (added `image_picker`, `share_plus`, dev `flutter_lints`); `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-7 → in-progress → review).

## Open Questions (giải quyết khi grooming/dev — không chặn create-story)

1. **Platform permission cho `image_picker`/`share_plus`:** `mobile/` chưa có `android/`/`ios/` scaffold → camera/share **thật** chưa chạy được (chỉ widget + inject-point). Nên (a) thêm platform config + permission ngay ở 1.7, hay (b) hoãn tới **Story 1.8 (app-shell)** khi dựng app chạy thật? **Đề xuất: hoãn (b)** — 1.7 giữ widget testable qua inject `pick`/`shareImpl`, permission theo app-shell. Không chặn: `flutter test` chạy trên VM không cần platform.
2. **`dotted_border` package vs `CustomPainter`** cho viền đứt (`.thumb.add`, stepper `gate`). Đề xuất **`CustomPainter`** (2 chỗ dùng, tránh 1 dependency — YAGNI). Xác nhận khi dev.
3. **Barrel gốc `design_system/design_system.dart`** re-export tokens+icons+components (tiện import 1 dòng) vs chỉ `components/components.dart`. Đề xuất: thêm barrel `components.dart` (bắt buộc) + cân nhắc barrel gốc (nice-to-have). Không chặn.
4. **`AppTable` dựng bằng Flutter `Table` widget vs `Column`+`Row`:** `Table` widget khớp semantic bảng nhưng khó zebra/last-row-borderless linh hoạt. Đề xuất dev chọn cách giữ đúng spec (dày, border 1px, zebra) — có thể `Column` các `Row`. Không chặn.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Code-review (ck:code-review) + sửa parity vs React 1.3–1.6: (1) `AppStepper` render **số bước 1-based** cho node non-done (thêm state `upcoming` mặc định) thay vì chấm `•` — khớp `Stepper.tsx`/`.bul`; (2) `AppField` thêm `didUpdateWidget` resync giá trị controlled (khớp `<input value>` khi màn đẩy giá trị chuẩn hoá/clamp); (3) `AppCartLineRow` thêm prop `id` cho khoá swipe `Dismissible` (tránh trùng khi hai dòng cùng tên); (4) `AppConfirmDialog` → StatefulWidget: đảo thứ tự nút footer `[Huỷ, Xác nhận]` khớp web, phát `onCancel` đúng một lần cho mọi kiểu đóng không-xác-nhận (nút/X/barrier/back) qua cờ `_resolved` + `dispose()`. Thêm 3 test hồi quy. Kết quả: `flutter analyze` sạch, `flutter test` 56/56, `npm test` 92/92. Status: review → done. |
| 2026-07-08 | Story 1.7 hoàn thành (dev-story): 21 widget Flutter parity (`App`-prefix) + barrel + painter viền đứt nội bộ, dựng từ `AppTokens`+`AppIcon` đã ship, phẳng Viền nét. Rào bất biến runtime + source-guard: CartLineRow render `amount` backend (không nhân qty×unitPrice, AD-10/16), ImageUpload phát `XFile[]` không upload/R2 (AD-3), overlay chỉ phát ý định không đổi status (AD-11), no-shadow, share dùng `share_plus`. Native: Dismissible swipe, showModalBottomSheet, image_picker camera/gallery, share_plus. Parity cross-platform `design-system/components/parity.test.mjs` (9 hex status + 3 tone banner byte-cho-byte web↔Dart + coverage 21 widget). Thêm deps `image_picker`/`share_plus`/`flutter_lints` + `analysis_options.yaml`. Kết quả: `flutter analyze` sạch, `flutter test` 44/44, `npm test` 92/92 (0 hồi quy). Status: ready-for-dev → review. |
| 2026-07-08 | Story 1.7 tạo (create-story): parity Flutter cho tầng component web 1.3–1.6 — 21 widget (`App`-prefix) từ `AppTokens`+`AppIcon` đã ship, phẳng Viền nét; rào bất biến mirror web (CartLineRow no-money-math AD-10/16, ImageUpload no-R2-upload AD-3, overlay no-status-change AD-11); native mobile (Dismissible swipe, showModalBottomSheet, image_picker camera/gallery, share_plus native share); test native `flutter test` (render + tương tác runtime + source-guard) + parity cross-platform `design-system/components/parity.test.mjs` (9 hex status + tone banner byte-cho-byte web↔dart, UX-DR-27). Thêm deps `share_plus`/`image_picker`/`flutter_lints`. 4 open question ghi lại. Status: backlog → ready-for-dev. |
