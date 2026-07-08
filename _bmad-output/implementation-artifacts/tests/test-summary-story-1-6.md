# Tóm tắt Tự động hoá Test — Story 1.6 (hành vi giỏ hàng, trạng thái list, overlay, share, upload)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Tính năng:** Tầng behavior/interaction web (Story 1.6) — `CartLineRow`, `Dialog`/`ConfirmDialog`/`Sheet`, `Skeleton`/`EmptyState`/`ErrorState`, `ShareButton`+`shareFiles`, `ImageUpload`.

**Loại test:** Source-guard tĩnh trên `.tsx`/`.ts` (đọc mã nguồn dạng text, khẳng định bất biến hợp đồng) — cùng kỹ thuật với drift-guard CSS 1.5 và source-guard 1.4/1.5. Repo **chưa có** bundler/tsc/JSDOM/React runtime (quyết định YAGNI cấp story, Open Question #2), nên "E2E" ở đây là **hợp đồng nguồn component**, không phải render DOM. **API tests: không áp dụng** — Story 1.6 thuần front-end design-system, 0 endpoint.

## Khoảng trống phát hiện (đã auto-apply)

Trước workflow: `behavior-components.test.mjs` có **12** source-guard bao 2 rào bất biến then chốt (CartLineRow không tính tiền — AD-10/16; ImageUpload không upload — AD-3) + close semantics cơ bản + barrel. Đối chiếu 5 AC và các "gotcha bắt buộc" của story, **7 hợp đồng hành vi/bất biến sau chưa test nào bảo vệ**:

1. **Overlay chỉ thu ý định — KHÔNG mutate `Order.status`/mạng** (AD-11). Đây là bất biến song song với rào AD-3 của ImageUpload nhưng **hoàn toàn chưa có** guard cho `Dialog`/`ConfirmDialog`.
2. **Backdrop click đóng + click trong `.modal`/`.sheet` `stopPropagation`** (Dialog & Sheet) — gotcha "click backdrop đóng, click trong modal đừng đóng".
3. **Esc listener cleanup + focus khi mở** (`removeEventListener` / `.focus()` / `tabIndex={-1}`) — a11y UX-DR-26 + gotcha "cleanup tránh leak".
4. **CartLineRow sửa phát NGAY qua `onChange`** (input `.field` numeric nối thẳng callback, không nút lưu) — AC-1.
5. **CartLineRow web xoá bằng nút, KHÔNG swipe** (ranh giới Flutter/Story 1.7) — AC-1.
6. **ImageUpload reset `input.value` sau add + ẩn ô thêm khi đạt `max`** — AC-5 gotcha "re-pick cùng file" + ẩn-khi-max.
7. **share.ts nuốt `AbortError`** (user huỷ share → không throw) — AC-4 gotcha.

## Test đã tạo

### Source-guard TSX (mở rộng `behavior-components.test.mjs`, test 13–19)

- [x] `design-system/components/behavior-components.test.mjs` — **+7 test** (12 → 19), tái dùng helper `stripComments`/`stripCommentsAndStrings` có sẵn (DRY):
  - **Test 13 — AD-11 (overlay intent-only):** `Dialog`/`ConfirmDialog` KHÔNG `fetch(`, `applyTransition`, `axios`, `.status =`. *(Rào bất biến overlay — bổ khuyết đối trọng cho rào AD-3 của ImageUpload.)*
  - **Test 14 — backdrop/stopPropagation (AC-3):** `.scrim`/`.scrim--sheet` `onClick={onClose}`; inner `stopPropagation()` (Dialog & Sheet).
  - **Test 15 — a11y (UX-DR-26):** `removeEventListener('keydown'…)` + `.focus()` + `tabIndex={-1}` (Dialog & Sheet).
  - **Test 16 — CartLineRow phát-ngay (AC-1):** `onChange` nối `onQtyChange`/`onUnitPriceChange`; input `inputMode="numeric"`; không `onSave`/`onSubmit`.
  - **Test 17 — CartLineRow xoá-bằng-nút (AC-1):** `<button aria-label="Xoá dòng" onClick={onDelete}>`; không `onTouch*`/`swipe`/gesture (ranh giới 1.7).
  - **Test 18 — ImageUpload reset+max (AC-5):** `input.value = ''` sau add; `images.length >= max`; gate `!full` ẩn ô thêm.
  - **Test 19 — share.ts huỷ-share (AC-4):** special-case `AbortError` trong `catch`.

### Đã có sẵn (không đụng)

- `behavior-components.test.mjs` test 1–12 — 2 rào bất biến (money math CartLineRow / upload ImageUpload) + close semantics + ConfirmDialog wrap Dialog + share fallback + Banner reuse + EmptyState copy-qua-prop + Skeleton + ShareButton + barrel.
- `components.test.mjs` — drift-guard CSS khối 1.6 (overlay/sheet/thumb/scrim/skel) + no-shadow + no-raw-`--r` + token integrity.
- `chip-components.test.mjs` (1.4), `data-feedback-components.test.mjs` (1.5).

## Coverage

- Component/util Story 1.6: **10/10** có source-guard TSX (9 component + `share.ts`).
- Hợp đồng đã khoá thêm: overlay intent-only (AD-11); backdrop/stopPropagation; Esc-cleanup + focus (a11y); CartLineRow phát-ngay + xoá-bằng-nút + no-swipe; ImageUpload value-reset + max-gate; share AbortError.
- API tests: **không áp dụng** (0 endpoint).
- E2E render DOM: **hoãn** (repo chưa có bundler/tsc/JSDOM — Open Question #2 của story, quyết định tooling chờ web-app shell 1.8/1.9/1.11).

## Kết quả chạy

`cd design-system && npm test` → **86/86 pass, 0 fail** (79 → 86, +7 test mới). Không hồi quy token/icon/Story 1.3/1.4/1.5.

Negative-check xác minh guard **không rỗng**: chèn tạm `fetch("/orders/x")` vào `Dialog.tsx` → test 13 "Dialog/ConfirmDialog collect intent only (AD-11)" **fail** đúng như mong đợi; revert → 86/86 pass.

## Checklist (`checklist.md`)

- [x] E2E-equivalent tests generated (source-guard cho tầng design-system)
- [x] API tests — N/A (không endpoint), ghi rõ
- [x] Dùng API framework chuẩn của repo (`node --test`)
- [x] Bao happy path (phát-ngay, xoá, backdrop-close) + error/edge (AbortError, max-gate, no-swipe, no-network)
- [x] Tất cả test chạy pass (86/86); non-vacuous (negative-check)
- [x] Mô tả test rõ ràng; không hardcoded wait/sleep; test độc lập (đọc file tĩnh, không phụ thuộc thứ tự)
- [x] Summary tạo + lưu; kèm coverage

## Next Steps

- Chạy suite trong CI (cùng `npm test`).
- Khi web-app story sau dựng bundler/tsc/JSDOM (1.8/1.9/1.11), bổ sung render-DOM test (Playwright/Vitest) cho tương tác thực (Esc thật, click backdrop thật, `navigator.share` thật, file picker thật); source-guard hiện tại vẫn giữ để khoá hợp đồng nguồn.
</content>
</invoke>
