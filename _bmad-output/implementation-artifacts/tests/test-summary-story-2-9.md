# Test Automation Summary — Story 2.9 (3 quyền mới: `settings.manage` · `system.feature_flags` · `costs.view`)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-13 · **Người chạy:** Đại Ca
**Framework:** Jest (hermetic — hằng số domain + artifact file, không cần Postgres)
**Kết quả:** 31 suite / **212 test** xanh (206 → 212, +6 test vá gap) · lint + format:check + build sạch

## Phạm vi

Story 2.9 thuần domain (`PERM`/`PERMISSIONS`/`ROLE_PRESETS`) + artifact sinh tự động. **Không có endpoint mới, không có màn UI mới** → không sinh API test hay E2E browser test; bao phủ đúng chỗ rủi ro là **unit domain + drift-guard artifact**. Gate/guard bằng 3 key mới thuộc Story 2.10/3.x/8.x.

## Khoảng trống đã phát hiện & vá (6 test mới)

| # | Gap | Vì sao nguy hiểm | Test vá |
|---|---|---|---|
| 1 | Test tên "17 key cũ giữ nguyên thứ tự" chỉ assert `[0]` và `[16]` | Đảo bất kỳ key nào ở giữa (1–15) vẫn xanh — mà thứ tự registry **chính là** thứ tự artifact FE tiêu thụ (Story 2.6) | `permission-registry.spec.ts` — khoá trọn `slice(0, 17)` |
| 2 | `label`/`group` của 3 entry mới chưa hề được assert | Gõ nhầm `group: 'setting'` lọt qua toàn bộ suite → FE gom nhóm sai ở màn Phân quyền | `permission-registry.spec.ts` — assert đủ `{key,label,group}` cho 3 entry |
| 3 | Quy ước `group` = domain prefix của key không có guard | Entry tương lai đặt group tuỳ tiện, không ai bắt | `permission-registry.spec.ts` — prefix rule, ngoại lệ duy nhất `permissions.manage → accounts` |
| 4 | Bất biến spread `SUPER_ADMIN ⊇ ADMIN` (Gotcha #2 — trục của story) không có test | Thay spread bằng list viết tay mà rơi mất quyền Admin → SUPER_ADMIN thiếu quyền, không suite nào đỏ | `role-presets.spec.ts` — mọi key ADMIN ∈ SUPER_ADMIN, và `len(SUPER) == len(ADMIN) + 2` |
| 5 | Nội dung `ADMIN_PRESET` không bị khoá | Rơi mất một quyền cũ (vd `catalog.manage`) vẫn xanh toàn bộ | `role-presets.spec.ts` — ADMIN = mọi key registry TRỪ `audit.read`/`system.feature_flags`/`orders.view_own` |
| 6 | Drift-guard chỉ kiểm 4 key FE-stub | Không suite nào khẳng định **file commit** có 20 entry với 3 key mới ở cuối | `permissions-drift.spec.ts` — parse file commit: 20 entry, `slice(-3)` đúng key/label/group |

Bonus phát hiện từ gap #6: preset scope xem đơn (`view_all` XOR `view_own`) cũng chưa có guard → thêm test, vì story này có sửa 4 preset.

## Mutation test — chứng minh guard không "chết luôn xanh"

Gieo đúng loại bug mỗi test nhắm tới; **cả 5 đều bị bắt**, sau đó khôi phục nguyên trạng:

| Mutation | Kết quả |
|---|---|
| Đảo `catalogManage` ↔ `contractsGenerate` ở **giữa** registry | 1 test đỏ (gap #1) |
| `group: 'settings'` → `'setting'` | 2 test đỏ (gap #2 + #3) |
| Xoá `PERM.catalogManage` khỏi `ADMIN_PRESET` | 1 test đỏ (gap #5) — trước khi vá thì **không test nào** bắt |
| `KE_TOAN` nhận cả `view_all` lẫn `view_own` | 1 test đỏ (scope XOR) |
| Xoá entry cuối trong `openapi/permissions.json` (sửa tay) | 2 test đỏ (drift byte-for-byte + gap #6) |

## File đã sửa (chỉ test — không đụng code sản phẩm)

1. `backend/test/permission-registry.spec.ts` — khoá trọn thứ tự 17 key cũ; +2 test (label/group 3 entry mới, quy ước group prefix).
2. `backend/test/role-presets.spec.ts` — +3 test (spread `SUPER_ADMIN ⊇ ADMIN`, nội dung `ADMIN_PRESET`, scope xem đơn XOR).
3. `backend/test/permissions-drift.spec.ts` — +1 test (file artifact commit: 20 entry, 3 key mới ở cuối).

## Bao phủ

- **AC-1** (append cuối, 17 key cũ nguyên thứ tự): khoá trọn thứ tự + literal byte-for-byte + label/group ✅
- **AC-2** (ma trận preset, `system.feature_flags` không lọt `ADMIN_PRESET`): tập preset của cả 3 key + bất biến spread + nội dung `ADMIN_PRESET` ✅
- **AC-3** (bất biến `system.feature_flags`): 3 test mirror khuôn `audit.read` (story) ✅
- **AC-4** (artifact 20 entry): drift byte-for-byte + assert trực tiếp file commit ✅

## Sự cố trong lúc chạy workflow (đã xử lý dứt điểm)

Vòng mutation test đầu tiên dùng `git checkout <file>` để hoàn tác. Vì code story **chưa commit**, lệnh đó khôi phục về HEAD và **xoá mất phần implementation của story** ở 3 file (`permission-registry.ts`, `role-presets.ts`, `openapi/permissions.json`). Đã khôi phục đầy đủ: 2 file TS ghi lại byte-for-byte, artifact sinh lại bằng `npm run permissions:gen`. Bằng chứng nguyên vẹn: `git diff --stat openapi/permissions.json` = **15 insertions, 0 deletions** — khớp đúng con số ghi trong Debug Log của story; 31 suite / 212 test xanh. Các vòng mutation sau chuyển sang sao lưu file rồi `cp` phục hồi.

## Bước tiếp theo

- Chạy suite trong CI như hiện tại (`cd backend && npm test`).
- 3 key mới **chưa có consumer** FE/guard — khi Story 2.10 gate endpoint và 2.6 gen key FE từ artifact, bổ sung test gate + parity FE cho 3 key này.

## Câu hỏi còn mở

- Không có (Open Question #2 của story — `audit.read` gate theo quyền, FR-20 — nằm ngoài phạm vi 2.9, thuộc Story 8.2/8.5).
