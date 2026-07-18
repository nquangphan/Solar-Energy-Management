# Test Automation Summary — Story 5.9 (Tra cứu bảo hành theo SĐT khách hàng)

Ngày: 2026-07-19 · Workflow: `bmad-qa-generate-e2e-tests` · Framework: Jest + Supertest (đã có sẵn)

Story 5.9 là story **dựng tính năng mới** trên cả ba nền tảng, vào workflow này ở trạng thái
`review` với coverage đã dày: 14 ca backend (6 domain biên/tràn tháng, 8 service), 5 ca e2e,
2 bất biến read-only, 6 widget test mobile, 1 file source-guard hai màn, và 6 đột biến đã được
dev tự kiểm (6/6 ĐỎ).

Việc của vòng này **không** là thêm ca cho đủ số, mà là tìm phần **còn sống sót dưới đột biến** —
bất biến do `src/` khai báo nhưng không lane nào quan sát được.

Kết quả: **1 khoảng trống thật, hạng IDOR**, đã bịt. Ba ứng viên khác bị loại có lý do.

## Khoảng trống đã phát hiện và đã bịt (1 ca mới)

| # | Khoảng trống | Vì sao lane hiện có KHÔNG thấy | Ca đã thêm |
|---|---|---|---|
| 1 | Handler `traCuuBaoHanh` chuyền **bộ quyền THẬT của người gọi** xuống service, nhưng không ca nào quan sát dây đó. Thay `await this.quyenCuaNguoiGoi(account.id)` bằng `new Set([PERM.ordersViewAll])` ⇒ **239/239 test vẫn xanh** — trong khi đó là lỗ IDOR: mọi nhân viên chỉ có `view_own` đọc được đơn bảo hành của người khác | Lane unit **tự dựng** `Set` rồi truyền thẳng vào service ⇒ chứng minh mệnh đề `where` đúng theo bộ quyền, **không** chứng minh bộ quyền đó đến từ đâu. Lane e2e chỉ có hai ca quyền: `view_all` (happy path, không phân biệt được với tập cố định) và **403** — mà 403 do **guard** quyết, guard tự resolve quyền theo đường riêng, không đi qua thân handler. Phạm vi DỮ LIỆU (AD-4) vì thế nằm giữa hai lane và không lane nào chạm | `backend/test/orders.e2e.spec.ts` — `chỉ view_own ⇒ 200 nhưng phạm vi DỮ LIỆU thu hẹp về đơn của chính người gọi` |

Ca mới cấp quyền **chỉ** `orders.view_own` qua đúng helper `givenPermissions`, gọi thật qua HTTP,
rồi assert `orderRepo.findMany` nhận đúng mệnh đề `OR: [ownerAccountId, assigneeAccountId]` bám
`ACCOUNT_ID` của token. Đây cũng chính là nửa sau của **AC-10** ("hai actor, hai kết quả khác nhau,
cùng 200") — trước đó chỉ nửa 403 được đo ở lane e2e.

Theo bài học 5.8, assert dùng `toHaveBeenCalledTimes(1)` chứ không chỉ đọc `mock.calls[0]`.

## Đột biến — chứng minh ca mới biết đỏ

Hoàn tác bằng `cp` từ backup, **không** `git checkout` (code story chưa commit). Đột biến compile được.

| Đột biến trên source | Trước khi thêm ca | Sau khi thêm ca |
|---|---|---|
| Handler chuyền `new Set([PERM.ordersViewAll])` thay vì quyền thật của người gọi | ❌ **sống sót** — 239/239 xanh (`jest orders.e2e warranty`) | ✅ **1 đỏ** — đúng ca mới, không ca nào khác |
| Bỏ `warrantyMonths: { not: null }` khỏi query dòng (dev chỉ kiểm nhánh `warrantyStartAt`) | ✅ 1 đỏ (đã có) | ✅ 1 đỏ |
| Biên `ngayConLai <= NGUONG_SAP_HET_NGAY` ⇒ `<` (khác với đột biến 90→0 của dev) | ✅ 1 đỏ (đã có) | ✅ 1 đỏ |

`grep` xác nhận **0 dấu vết đột biến** còn lại trong `orders.controller.ts`; `git diff --stat backend/src`
sau vòng này khớp đúng số dòng story trước khi mutate (controller +37, service +174).

## Ứng viên bị loại (có lý do, không phải bỏ sót)

| Ứng viên | Vì sao KHÔNG thêm |
|---|---|
| e2e cho `WarrantyLookupQueryDto`: thiếu `sdt` / `sdt` dài > 32 / `sdt` là mảng ⇒ 400 | **Đột biến tương đương.** `normalizeVnPhone` mở đầu bằng `if (typeof raw !== 'string') return null` (`phone.ts:20`), và tầng gọi dịch `null` thành đúng envelope 400 `field: 'sdt'`. Gỡ sạch `@IsString() @IsNotEmpty() @MaxLength(32)` cho **cùng mã, cùng field, cùng shape** ⇒ ca test sẽ xanh cả hai chiều và chẳng ghim gì. Doc-comment của DTO tự mô tả mình là lớp chặn phòng thủ, không phải lớp DUY NHẤT — mô tả đó đúng. (Bài học 5.9: kiểm tương đương ngữ nghĩa TRƯỚC khi đổ lỗi cho test) |
| Lane render cho màn web `WarrantyLookupScreen.tsx` | **Không lane nào tồn tại để thêm vào.** `web/` không có `package.json`, không tsc, không test runner (TD-1). Hai lane duy nhất canh nó — source-guard `warranty-lookup.test.mjs` (đọc text đã strip comment) và `web-source-parses.spec.ts` (chỉ kiểm parse) — đều đã có và đã được dev kiểm bằng đột biến `'+84'`. Dựng runner cho web là story hạ tầng riêng, không nhét vào 5.9 |
| Assert `orderBy: { displayOrder: 'asc' }` (thứ tự dòng vật tư trong bảng) | Không AC nào phát biểu thứ tự dòng; mockup ngụ ý nhưng không chốt. Thêm assert ở đây là ghim một quyết định chưa ai ra — YAGNI. Ghi lại ở "Còn mở" thay vì test |

## Gate đã chạy

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend toàn bộ | `cd backend && npm test` | **1406 pass / 77 suite** (trước vòng này: 1405) |
| Backend hẹp | `npx jest warranty` · `npx jest orders.e2e -t "view_own"` | xanh |
| Lint (file đã sửa) | `npx eslint test/orders.e2e.spec.ts` so với bản HEAD | **13 error ở CẢ HAI** ⇒ vòng này thêm **0 error mới**. File đã nằm trong nợ prettier 162 error có sẵn từ trước |
| design-system / mobile | — | **KHÔNG chạy lại**: vòng này sửa đúng **một** file `backend/test/orders.e2e.spec.ts`, không chạm `web/`, `mobile/`, `design-system/`. Kết quả của dev (378 pass / 260 pass / analyze sạch) vẫn còn hiệu lực |
| DB integration | `npm run test:db` | **CHƯA CHẠY** — cần Docker Desktop GUI, không lên được từ shell agent. Mọi AC của story đều đo được ở `npm test` |

## Coverage sau vòng này

| AC | Lane đo | Trạng thái |
|---|---|---|
| AC-4 (chuẩn hoá SĐT, 400 rác) | unit + e2e | ✅ |
| AC-5 (không có khách ⇒ 200 `found:false`) | unit + e2e, đột biến 404 ĐỎ cả hai | ✅ |
| AC-6 (field dòng, mốc theo DÒNG) | unit (hai `warrantyStartAt` ⇒ hai `warrantyEndAt`) | ✅ |
| AC-7 (lọc dòng/đơn không bảo hành) | unit, đột biến ĐỎ cả hai nhánh `not: null` | ✅ |
| AC-8 (5 biên trạng thái) | domain, đột biến ngưỡng + biên `<=` ĐỎ | ✅ |
| AC-9 (thứ tự route) | e2e (`findFirst` không hề được gọi) | ✅ |
| **AC-10 (phạm vi hai actor + 403)** | 403 ở e2e; `where` ở unit; **dây quyền controller→service ở e2e (MỚI)** | ✅ **vừa đóng** |
| AC-11 (bản hiệu lực) | unit (shape `where` + phép GOM) | ✅ |
| AC-12 (read-only Phase 1) | `warranty-readonly.spec.ts` (route đọc + không model) | ✅ |
| AC-13 (4 state hai màn) | widget test mobile (6 ca); web = source-guard + parse | ⚠️ web không có lane render (TD-1, kiến trúc) |
| AC-14 (parity port + guard) | `parity.test.mjs` + `warranty-lookup.test.mjs` | ✅ |

## Còn mở

1. **Màn web vẫn không có lane render** — TD-1 toàn hệ, không phải nợ của story 5.9. Chừng nào `web/` chưa có test runner, mọi màn web đều chỉ được canh bằng text-guard + parse check.
2. **Thứ tự dòng vật tư trong bảng chưa được ghim** — `orderBy: { displayOrder: 'asc' }` là hành vi người dùng thấy nhưng không AC nào phát biểu. Nếu Đại Ca muốn thứ tự này là hợp đồng, nói một tiếng em thêm assert.
3. **Lane DB chưa chạy** — cần Đại Ca bật Docker Desktop; em không tuyên bố xanh cho lane chưa chạy.
