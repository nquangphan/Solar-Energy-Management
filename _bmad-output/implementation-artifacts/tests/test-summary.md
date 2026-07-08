# Tóm tắt Tự động hoá Test — Story 1.7 (Flutter — thư viện widget parity)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Tính năng:** thư viện widget Flutter parity (`mobile/lib/design_system/components/`, 21 widget `App`-prefix).

**Framework:** `flutter_test` (widget render + tương tác THẬT trên VM) · `node:test` (parity cross-platform). **Không sinh API test** — story thuần tầng presentation, không backend/endpoint.

## Cách tiếp cận

Story 1.7 đã ở trạng thái `review` với bộ test hiện có (44 Flutter + 92 Node). Workflow QA rà coverage theo 3 AC, phát hiện các **hành vi widget đã hỗ trợ nhưng chưa có test**, rồi auto-apply — thêm test vào đúng file/nhóm sẵn có (surgical: không tạo file test mới, không đụng widget source).

## Test đã thêm (9)

### Tương tác — `mobile/test/design_system/components/behavior_interaction_test.dart` (+7)

| # | Test | AC / Invariant | Loại |
|---|------|-----|-----|
| 1 | `AppCartLineRow` sửa **đơn giá** → `onUnitPriceChange` phát số mới, `amount` giữ nguyên | AC-2 / AD-10/16 | happy |
| 2 | `AppCartLineRow` **swipe-to-delete** (`Dismissible` endToStart) phát `onDelete` | AC-2 / UX-DR-24 | happy (native) |
| 3 | `AppImageUpload` nhánh **thư viện** ("Chọn từ thư viện" → `pick(ImageSource.gallery)` → `onAdd`) | AC-2 / UX-DR-25 | happy |
| 4 | `AppImageUpload` **`onRemove`** phát đúng `id` khi bấm nút xoá thumbnail | AC-2 | happy |
| 5 | `AppImageUpload` đạt **`max`** → ẩn ô thêm (`ic-plus` vắng mặt) | AC-2 / UX-DR-25 | edge |
| 6 | `AppShareButton` kết quả **huỷ/dismissed** → không throw, `onResult` nhận `dismissed` | AC-2 | error |
| 7 | `AppConfirmDialog` nút **Huỷ** → `onCancel` bắn, `onConfirm` KHÔNG bắn, dialog đóng | AC-2 / AD-11 | negative |

### Render/token — `mobile/test/design_system/components/components_render_test.dart` (+2)

| # | Test | AC | Loại |
|---|------|-----|-----|
| 8 | `AppScopeFlag` **on=true** → chữ `teal700`, KHÔNG gạch ngang | AC-1 | complement |
| 9 | `AppErrorState` **không `onRetry`** → không render nút "Thử lại" | AC-1 | negative |

## Khoảng trống đã phát hiện & vá (auto-apply)

- **Money invariant chỉ phủ cột SL:** `onQtyChange` đã có test, nhưng cột **đơn giá** (`onUnitPriceChange`) — field editable thứ hai — chưa chạm runtime. Nay phủ, khẳng định lại "không nhân qty×price".
- **Swipe-to-delete chưa có test:** điểm parity native-mobile đầu bảng (web hoãn sang mobile) trước chỉ test nút thùng rác; nhánh `Dismissible` giờ được exercise.
- **ImageUpload một chiều:** chỉ nhánh camera + happy path; thư viện/`onRemove`/`max` chưa kiểm.
- **Thiếu error/negative path:** share huỷ, confirm-cancel, error-state không-retry — các nhánh "không nên xảy ra" trước không được canh.

## Kết quả chạy

| Suite | Lệnh | Trước | Sau |
|---|---|---|---|
| Flutter widget/interaction | `cd mobile && flutter test` | 44/44 | **53/53** ✅ |
| Flutter static analysis | `cd mobile && flutter analyze` | clean | **clean** ✅ |
| Parity cross-platform (Node) | `cd design-system && npm test` | 92/92 | **92/92** ✅ (0 hồi quy) |

## Coverage

- **21/21 widget** có test render; hành vi AC-2 (cart money invariant, upload no-network, share, overlay intent-only) nay phủ **cả 2 chiều** (happy + negative/edge/error).
- Bất biến vẫn được canh (không đổi): no-shadow, no money-math, no-upload, no-status-mutation (source-guard) + parity 9 hex status + 3 tone banner byte-cho-byte.

## Bước tiếp theo

- Chạy suite trong CI (Flutter + Node) — repo greenfield, chưa có pipeline.
- Camera/share **thật** cần platform scaffold (android/ios) — hoãn sang Story 1.8 (app-shell) như Open Question #1; widget hiện test qua inject `pick`/`shareImpl` trên VM.

## Câu hỏi tồn đọng

- Không. Story 1.7 vốn ở `review`; workflow này chỉ mở rộng coverage, không đổi contract widget.
