# Test Automation Summary — Story 5.8 (Nhánh Thi công: Đang thi công → Nghiệm thu)

Ngày: 2026-07-18 · Workflow: `bmad-qa-generate-e2e-tests` · Framework: Jest + Supertest (đã có sẵn)

Story 5.8 là story **đóng lane**, vào workflow này ở trạng thái `review` với 13 ca đã thêm
(6 e2e, 4 unit, 3 bất biến domain) và 4 đột biến đã được dev tự kiểm. Việc của vòng này là tìm
phần **còn sống sót dưới đột biến** — tức bất biến được `src/` khai báo nhưng không test nào
quan sát được.

Kết quả: **1 khoảng trống thật**, đã bịt. Hai ứng viên khác bị loại có lý do (xem dưới).

## Khoảng trống đã phát hiện và đã bịt (1 ca mới)

| # | Khoảng trống | Vì sao lane hiện có KHÔNG thấy | Ca đã thêm |
|---|---|---|---|
| 1 | Dòng `xongThiCong` khai `scopeGuard: 'thiCong'` nhưng **không test nào đọc nó**. Gỡ gate ⇒ **1365/1365 test vẫn xanh** | Đột biến #2 của story chỉ gỡ gate ở `batDauThiCong`. Gate trên cạnh thứ hai không quan sát được từ hành vi: `nghiemthu` chỉ tới được **qua** `thicong`, mà `thicong` đã bị cờ chặn ⇒ BFS của `buocVongDoi()` không bao giờ chạm cạnh đó. Trạng thái "đơn ở `thicong` + cờ tắt" là bất khả thi trong production (§6 story cấm test nó) ⇒ **không lane hành vi nào với tới được** | `backend/test/allowed-transition.spec.ts` — `cả hai cạnh dựng nhánh thi công đều gate theo cờ Thi công`, đọc thẳng hình dạng bảng |

Ca mới đặt trong `describe('hình dạng bảng')` cùng chỗ với bất biến 16-dòng: cùng loại bằng
chứng (đọc bảng, không dựng đơn), nên **không** vi phạm §6 — nó không dựng trạng thái bất khả thi.

Cạnh RA (`nghiemthu → hoanthanh`) cố ý **không** gate và ca mới không đòi gate ở đó: tới được
`nghiemthu` nghĩa là cờ đã bật từ đầu nhánh, và đơn đang dở không được mất lối ra vì cờ bị đổi
về sau. Điều này được ghi thẳng vào comment của test.

## Đột biến — chứng minh ca mới biết đỏ

Hoàn tác bằng `cp` từ backup, **không** `git checkout` (code story chưa commit). Đột biến compile được.

| Đột biến | Trước khi thêm ca | Sau khi thêm ca |
|---|---|---|
| Gỡ `scopeGuard: 'thiCong'` khỏi dòng `xongThiCong` | ❌ **sống sót** — 1365 test xanh toàn bộ suite | ✅ **1 đỏ** — đúng ca mới, không ca nào khác |
| Gỡ `scopeGuard: 'thiCong'` khỏi dòng `batDauThiCong` | ✅ 10 đỏ (đã có) | ✅ **6 đỏ** trong lane domain, gồm ca mới |

`git diff --stat backend/src` được kiểm lại là **rỗng** sau mỗi lần khôi phục.

## Ứng viên bị loại (có lý do, không phải bỏ sót)

| Ứng viên | Vì sao KHÔNG thêm |
|---|---|
| e2e `/vong-doi` cờ tắt ⇒ assert `nghiemthu` vắng mặt (AC-2 nói số nhiều "không bước thi công nào") | Đã có ở lane domain: `allowed-transition.spec.ts:349-350` assert **cả** `thicong` lẫn `nghiemthu` là `undefined`. Ca e2e `:2871` đã đi qua đúng dây đó cho `thicong`; thêm `nghiemthu` vào cùng ca không chứng minh thêm dây nào — chỉ nhân đôi một bất biến đã khoá |
| e2e `nghiemthu --hoan_thanh-->` khi actor thiếu `construction.transition` ⇒ 403 | `requires: PERM.constructionTransition` của cạnh RA đã bị khoá ở domain (`:474` assert nguyên vẹn cả `requires`), và ánh xạ 403 của lane HTTP đã đo ở cạnh `thicong`. Ca này lặp lại cùng nhánh code |
| Đơn ở `thicong` + `scopeThiCong=false` ⇒ 409 | Story §6 **cấm** — trạng thái bất khả thi trong production. Quyết định này em không lật; lỗ gate ở trên được vá bằng bất biến bảng thay vì bằng ca hành vi giả định |

## Gate

| Lệnh | Kết quả |
|---|---|
| `cd backend && npm test` | ✅ 74 suite / **1366** test (1365 + 1 ca mới), không cần `DATABASE_URL` |
| `cd backend && npm run build` | ✅ |
| `cd backend && npm run openapi:gen` | ✅ `openapi/openapi.json` **không đổi** |
| `npx eslint test/allowed-transition.spec.ts` | ⚠️ 1 error `prettier/prettier` — **có sẵn ở HEAD** (đo bằng cách lint bản `git show HEAD:` của chính file: cũng đúng 1 error) ⇒ ca mới thêm **0 error** |
| `git diff --stat backend/src` | ✅ **rỗng** |

Không chạy `design-system` / `mobile`: vòng này chỉ chạm **một file test backend**, không đụng
SSOT design-system, không đụng `mobile/lib`. Story đã chứng minh hai lane đó xanh ở vòng dev.

Lane DB (`npm run test:db`) **chưa chạy** — cần Docker Desktop GUI, không lên được từ shell agent.
Không tính là bằng chứng AC (đúng như story ghi).

## Coverage

- Cạnh nhánh thi công: **2/2** có ca executor ở lane HTTP + unit (`dacoc→thicong`, `thicong→nghiemthu`)
- Lối ra `nghiemthu→hoanthanh`: phủ ở **3 lane** (domain `buocKeTiep`, `GET /vong-doi`, `POST` ⇒ 200)
- Gate cờ Thi công: **2/2 cạnh** có test đọc gate (trước vòng này: 1/2)
- Bất biến hình dạng bảng: 16 dòng · không bước "lên lịch" · gate hai cạnh — **3 bất biến**

## Việc còn lại

- Story doc `5-8-*.md` ghi "13 test / 3 bất biến domain"; sau vòng này là **14 test / 4 bất biến**.
  Chưa sửa story doc — workflow này chỉ sinh test, không sửa artifact story.
- Nợ lint 162 error toàn `backend/` (160 `prettier/prettier`) vẫn còn, đã được Đại Ca quyết tách
  thành việc riêng.
</content>
</invoke>
