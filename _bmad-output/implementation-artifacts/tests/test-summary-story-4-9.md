# Test Automation Summary — Story 4.9 (Bảo hành theo dòng vật tư)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend, hermetic mock Prisma — không cần Postgres) · Flutter widget test (mobile) · `node --test` text/parity guard (design-system)
**Kết quả:** backend **960/960** xanh (57 suite, 959 → 960, **+1 e2e**) · mobile **199/199** + `flutter analyze` sạch (198 → 199, **+1 widget**) · design-system **292/292** (QA không đụng — giữ dev phase)

## Phạm vi

Story vào QA ở trạng thái `review` với bộ test dev-phase dày, mutation-checked sẵn 5 mutant:
6 unit service (addLine ép null + updateLine 5 case) · confirm (all-line freeze + re-chốt identity
`.toBe(chotAt)` + idempotent/retry) · 6 e2e (24/null/0/-5/công-lắp/409/GET-no-leak) · 5 widget
mobile (a)–(e) · guards nhãn + parity twin + OpenAPI regen. QA phase rà gap theo 6 AC, phát hiện
**2 gap** — cả hai là nhánh biên của *chính năng lực headline của story* (nguyên-số hợp lệ, và
null-clear) — và auto-apply cả hai, mutation-checked.

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | #1 | **DTO chỉ test `0`/`-5` (chạm `@Min(1)`), KHÔNG test số thập phân** — mutant gỡ `@IsInt()` mà giữ `@Min(1)` xanh toàn suite | `@Min(1)` một mình nhận `1.5` (1.5 ≥ 1). Không có `@IsInt`, client gửi `warrantyMonths: 1.5` → ghi tháng-lẻ vào DB, "X tháng" hiển thị số thập phân — sai domain (AC #1: "nguyên ≥ 1") mà không test nào đỏ | ✅ `orders.e2e.spec.ts` +1 test `1.5 → 400 fieldErrors warrantyMonths`, `lineRepo.update` KHÔNG gọi (**mutation-checked**: gỡ `@IsInt()` → RED → revert `cp`) |
| 2 | #4 | **Widget mobile chỉ test SET (24/18) + read-only, KHÔNG test CLEAR (ô rỗng → null)** — mutant khiến `_WarrantyCell._commit` bỏ qua nhánh rỗng xanh toàn suite | Null-clear ("bỏ bảo hành") là *lý do tồn tại của sentinel tri-state `kLineFieldAbsent`*: ô rỗng phải gửi `hasWarrantyMonths=true, warrantyMonths=null` (khác "không gửi"). Không có test end-to-end nào lái nhánh này — mutant nuốt ô rỗng thì người dùng không xoá được bảo hành mà suite vẫn xanh | ✅ `create_quote_screen_test.dart` +1 widget: ô đang 144 → nhập rỗng → blur → port nhận CLEAR (**mutation-checked**: bỏ `onChanged?.call(null)` nhánh rỗng → RED → revert `cp`) |

## Không thêm (đã phủ — tránh padding)

- **addLine** cả 2 nhánh pin cứng: catalog thường copy `warrantyMonths: 144` (L310) · công lắp lỡ có 12 → ép `null` (L386). Mutant `? null : null` hay đảo ternary đều RED.
- **updateLine** 5 case: set 24 · null-clear tới Prisma (`'warrantyMonths' in data`) · không gửi → key vắng · công lắp bỏ qua im lặng · **dòng tự do (`productId` null + `priceEditable`) VẪN ghi 18** (bẫy `priceEditable` — pin cả 2 phía điều kiện `warrantyLocked`).
- **confirm** đóng băng: MỌI dòng (3 loại) null → nhận `warrantyStartAt`; identity `.toBe(chotAt của version)` — MỘT timestamp một sự kiện (bài 4.8); re-chốt bản update: dòng đã có mốc GIỮ nguyên (key vắng), CHỈ dòng null nhận mốc mới (mutant "ghi đè mọi dòng" RED); nhánh idempotent/retry + race count 0 → KHÔNG update.
- **e2e** 24 → 200 · null → 200 null · công lắp 12 → 200 vẫn null · sau chốt → 409 (assertMutable) · GET KHÔNG lộ `warrantyStartAt` (negative body).
- **Guards/parity** (dev phase, mutation-checked): nhãn byte-identical `Bảo hành`/`+ Thêm bảo hành`/`Không có` (strip comment — bắt false-green nhãn trong comment) · twin `UpdateOrderLineInput.warrantyMonths` + sentinel Dart · twin `formatWarrantyMonths` + pin `~/ 12` · OpenAPI regen.

## Ghi chú nền tảng (không phải gap của story này)

- **Web KHÔNG có runtime harness** (nợ TD-1, `project-context.md`): `CartLineRow.tsx` (4 mode input/none/link/read-only + `commitWarranty` + `formatWarrantyMonths`) và rule `fake-orders-port.ts` chỉ được text-guard + parity phủ, KHÔNG chạy JSDOM. Twin mobile (đã runtime-test đủ) là bằng chứng hành vi; web đợi story app-scaffold. Đây là giới hạn tooling đã biết, không vá được trong phase này.
- Nhánh `formatWarrantyMonths` "X tháng" (không chia hết 12) chỉ chạy runtime ở web (không harness); mobile test (e) lái nhánh "X năm" 144→"12 năm" — chính nhánh này bắt luôn mutant `~/ 12 → / 12` (`144/12 == 12.0` → "12.0 năm"), nên phủ kép với parity guard.

## Coverage sau QA

- **AC #1** sửa bảo hành theo dòng (int ≥ 1 / null-clear / công lắp bỏ qua / 409 sau chốt): **đủ** (QA thêm nhánh non-integer `@IsInt`)
- **AC #2** default + ép null lúc addLine: **đủ** (2 nhánh ternary pin cứng, dev phase)
- **AC #3** đóng băng `warrantyStartAt` per-line lúc chốt lần đầu: **đủ** (all-line + identity + re-chốt + idempotent, dev phase)
- **AC #4** UI cột Bảo hành 2 nền tảng: **đủ mobile** (QA thêm null-clear → 6 widget gồm error case + clear); **web text-guard only** (TD-1)
- **AC #5** format "X năm"/"X tháng"/rỗng: **đủ** (parity pin `~/ 12` + widget (e) runtime bắt `/`→`~/`)
- **AC #6** guards + parity + OpenAPI drift: **đủ** (dev phase mutation-checked)

## Lane

- `cd backend && npm test`: **960/960**, 57 suite. ⚠️ Một lần chạy full có 2 suite đỏ do **cross-suite mock pollution** (loop fail-closed `POST /orders thiếu quyền ⇒ 403` nhận 404 — KHÔNG liên quan 4.9); `npx jest orders.e2e` cô lập **93/93** xanh, rerun full sau đó **960/960** sạch. Flake nền, không phải regression story.
- `cd mobile && flutter test`: **199/199** · `flutter analyze`: **No issues found**. `dart format -o none --set-exit-if-changed` file test sửa: 0 changed.
- `cd design-system && npm test`: **292/292** (QA không đổi file design-system).
- **DB lane:** story KHÔNG thêm migration/ràng buộc DB mới (2 cột `warrantyMonths`/`warrantyStartAt` có sẵn từ `20260716000000_add_orders`) → `npm run test:db` không bắt buộc; Docker headless không lên (bài học `db-lane-needs-docker-desktop-gui`).

## Unresolved

- Web CartLineRow/fake-port warranty: không có lane runtime (TD-1) — đợi story app-scaffold web để test 4 mode + commitWarranty + formatter nhánh "X tháng" chạy thật.
- Action item treo từ 4.4 (migration chưa `migrate deploy` thật) vẫn còn — story 4.9 không thêm migration nên không mở rộng nợ này.
