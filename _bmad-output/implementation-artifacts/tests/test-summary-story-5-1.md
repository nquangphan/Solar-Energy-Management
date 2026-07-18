# Test Automation Summary — Story 5.1 (Engine `applyTransition()`)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-18 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend hermetic, mock Prisma) · lane DB thật trên Postgres (`npm run test:db`, Docker `pns-postgres` đang chạy)
**Kết quả:** backend hermetic **1008/1008** xanh (59 suite; 1005 → 1008, **+3 unit**) · lane DB **58/58** (8 suite; 57 → 58, **+1 race**) · lint sạch trên file QA đụng

Story thuần backend — **không có UI**, nên không sinh E2E trình duyệt. "E2E" ở đây là e2e HTTP
qua `AppModule` thật (dev phase đã có) + lane DB thật.

## Phạm vi

Story vào QA ở trạng thái `review` với bộ test dev-phase rất dày và đã mutation-check 6 mutant
(M1–M6). QA phase rà theo 6 AC + bảng transition, tìm chỗ **mutant còn sống**, không đếm lại thứ
đã phủ. Phát hiện **2 gap** (1 unit-mapping, 1 race lane DB), auto-apply cả hai, mutation-checked.

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | #1, #3 | **Engine map 3 lý do từ chối → HTTP, nhưng chỉ nhánh `permission` có test.** Nhánh `scope` và `not_in_table` không test nào chạm | Bốn call-site đều có pre-check trạng thái riêng bắn 409 **trước khi mở transaction**, nên engine không bao giờ thấy cặp ngoài bảng ⇒ hai nhánh còn lại là code không caller. Nhưng chúng là **hợp đồng** cho 5.2/5.5 (dispatch nhiều transition qua một entry point). Mutant gộp `scope` vào chung thông điệp `not_in_table`, hoặc đổi `permission` 403→409, **xanh toàn bộ 2 lane** | ✅ `orders.service.spec.ts` +3 unit gọi thẳng engine (`tx` rỗng — từ chối xảy ra TRƯỚC op DB đầu tiên, nên chính việc `tx` không bị chạm cũng là một assertion). Pin: thông điệp `scope` RIÊNG · thông điệp `not_in_table` · cùng một cặp `dacoc --bắt đầu thi công-->` cho 403 khi thiếu quyền / 409 khi sai cờ |
| 2 | #5 | **Lane DB chỉ chứng minh khoá của `addLine`.** `updateLine` cũng được cấp khoá ở Task 6 nhưng không test nào ép nó chịu tải | Đọc-lại-status-trong-tx **một mình không đóng được cửa sổ**: dưới READ COMMITTED, `SELECT` thường vẫn đọc ảnh chụp `baogia` trong lúc `confirm` giữ khoá chưa commit ⇒ `updateLine` đi tiếp, ghi vào row *dòng* (không đụng khoá nào), commit SAU khi đơn đã `dachot` ⇒ **giá của một đơn đã đóng băng vừa tự đổi** — đúng lỗi TD-23 mà story tuyên đã đóng | ✅ `orders.db.integration.spec.ts` +1 test race 12 vòng, không delay nhân tạo. Bất biến không cần biết ai thắng: đơn `dachot` ⇒ `unitPriceSnapshot === unitPrice` trên mọi dòng (dùng **dòng tự do** vì `priceEditable` ⇒ snapshot bám đúng `unitPrice`, dòng catalog snapshot theo giá danh mục nên không phản ánh được lệnh sửa) |

### Mutation-verify của chính 2 gap (`cp` backup, KHÔNG `git checkout`)

| Mutant | Kỳ vọng | Thực tế |
|--------|---------|---------|
| M-A: gỡ `lockOrderRow` khỏi **`updateLine`** | ĐỎ | ✅ ĐỎ — đúng 1 fail, đúng test race mới (lane DB 57/58) |
| M-B: gộp `scope` vào chung thông điệp `not_in_table` | ĐỎ | ✅ ĐỎ — 1 fail (1007/1008) |
| M-C: `permission` 403 → 409 | ĐỎ | ✅ ĐỎ — 4 fail / 2 suite (gồm cả test dev-phase M3) |

Cả 3 mutant đều compile. Sau mỗi lần revert bằng `cp` và chạy lại xác nhận XANH.

## Không thêm (đã phủ — tránh padding)

- **Domain thuần** (`allowed-transition.spec.ts`): mỗi cặp hợp lệ qua `it.each` toàn bảng · 3 lý do từ chối · **2 test THỨ TỰ ưu tiên** (không lộ trạng thái cho actor thiếu quyền) · bảng không trùng cặp `(from, event)` · 4 transition production có mặt · mọi `requires` là key CÓ THẬT trong registry.
- **Thứ tự op trong tx**: `confirm` `['lock','updateMany']` · `revise` `['lock','updateMany','version.create']` · `applyDiscount` `['lock','updateMany','approval.create']` · từ chối `['approval.updateMany','lock','updateMany']` (bất đối xứng của D giữ nguyên) · đồng ý KHÔNG gọi engine.
- **`where.status` quan sát được** (không hardcode `'baogia'`) — mutant M5 dev phase ĐỎ 5 test.
- **Source-guard** `no-order-status-write-outside-transition`: máy quét **cân bằng ngoặc** (không dùng regex `\{[^}]*\}` cắt sớm) + 2 meta-test bắt buộc + 3 test âm tính (`where` không phải ghi · model khác · trong comment).
- **e2e** (`AppModule` thật, `AuditSubscriber` THẬT): mỗi transition để lại ĐÚNG MỘT vết `StatusChanged` mang from→to · 403 chéo quyền trên cả 4 endpoint · 409 envelope chuẩn qua exception filter.
- **4 mutator nội dung** đều có unit pin `thuTu[0] === 'lock'` + test "status đổi giữa chừng ⇒ 409".
- **Idempotency AC #6**: toàn bộ test 4.5–4.7 giữ nguyên, không sửa assertion nào.

## Ghi chú nền tảng (báo cáo, KHÔNG bịa test)

- **Khoá của `removeLine` và `update` (PATCH cờ) không chứng minh được bằng lane DB.** Đã dựng
  thử và bỏ: với `removeLine`, cửa sổ "đơn `dachot` mà 0 dòng" **vẫn mở kể cả khi khoá đúng** —
  cổng 0-dòng của `confirm` nằm ở fast-path NGOÀI tx, nên một `removeLine` commit giữa fast-path
  và lúc mở tx vẫn hợp lệ về khoá; test này sẽ đỏ trên code đúng. Với `update`, hai kịch bản
  "PATCH thắng rồi confirm" và "PATCH lọt sau lúc chốt" để lại **trạng thái cuối y hệt nhau**
  (cờ phạm vi không được snapshot) ⇒ không quan sát hậu nghiệm được. Ghi nhận thay vì dựng test
  giả để tick ô — cùng lối xử lý mà dev phase đã dùng cho M1.
- **Cửa sổ 0-dòng của `confirm` là một phát hiện mở** (xem Câu hỏi chưa giải đáp §1).
- **Hai tầng permission**: mutation M3 làm ĐỎ unit nhưng KHÔNG đỏ e2e — vì `@RequirePermissions`
  dùng TRÙNG key với bảng transition nên guard HTTP bắn 403 trước. Đã ghi ở Completion Notes #3
  của story; 3 unit mới là thứ giữ tầng engine trung thực cho tới khi 5.2/5.5 có endpoint
  dispatch nhiều transition.

## Coverage sau QA

- **AC #1** engine là đường DUY NHẤT ghi status, gate bảng + cờ + quyền: **đủ** (domain `it.each` toàn bảng + source-guard + QA thêm mapping `scope`/`not_in_table`)
- **AC #2** nơi duy nhất đánh guard + phát `StatusChanged`, không chạm `AuditService`: **đủ** (e2e đi qua `AuditSubscriber` thật)
- **AC #3** thiếu quyền ⇒ 403 envelope, status không đổi: **đủ** (QA thêm test 403-vs-409 không hoán đổi)
- **AC #4** source-guard không ai ghi status ngoài engine: **đủ** (2 meta-test + 3 âm tính, M6 ĐỎ)
- **AC #5** khoá dòng: **đủ ở phía mutator** — `addLine` (M2) **và `updateLine` (M-A, QA thêm)** đều chứng minh load-bearing. Phía **engine vẫn KHÔNG chứng minh được** (M1, lý do kỹ thuật ở story). `removeLine`/`update`: không quan sát hậu nghiệm được (§Ghi chú)
- **AC #6** 4 hợp đồng idempotency byte-for-byte: **đủ** (test 4.5–4.7 xanh không sửa assertion)

## Lane

| Lane | Lệnh | Trước QA | Sau QA |
|------|------|----------|--------|
| Hermetic | `cd backend && npm test` | 59 suite / 1005 test | **59 suite / 1008 test** ✅ |
| DB thật | `cd backend && npm run test:db` | 8 suite / 57 test | **8 suite / 58 test** ✅ |
| Lint | `npx eslint test/orders.service.spec.ts test/orders.db.integration.spec.ts` | — | **0 lỗi** ✅ |

⚠️ Flake đã biết tái diễn đúng một lần (`/orders` 403-line-items), rerun XANH ngay — nằm trong
danh sách flake ở Dev Notes, không liên quan story.
⚠️ `npm run lint` toàn repo vẫn ĐỎ SẴN từ trước story (90 lỗi `prettier/prettier` ngoài phạm vi) —
QA không đụng.

## File QA đụng

- `backend/test/orders.service.spec.ts` (+3 unit: mapping 3 lý do từ chối → HTTP)
- `backend/test/orders.db.integration.spec.ts` (+1 race: `confirm` đua `updateLine`)

## Câu hỏi chưa giải đáp

1. **Cửa sổ "đơn `dachot` với 0 dòng" đang mở.** Cổng 0-dòng của `confirm` nằm ở fast-path NGOÀI
   transaction; một `removeLine` commit giữa fast-path và lúc engine lấy khoá sẽ để lại đơn đã
   chốt không có dòng nào. Khoá không đóng được vì cổng nằm sai phía. Sửa = chuyển kiểm 0-dòng
   vào TRONG tx sau khoá (đơn giản), nhưng hợp đồng cũ là "400 mà KHÔNG mở transaction" nên đây
   là đổi hành vi ⇒ để Đại Ca quyết, không tự sửa trong QA phase.
2. **Khoá phía engine (M1) vẫn là belt-and-braces chưa chứng minh được.** Sẽ thành load-bearing
   khi 5.2/5.5 có caller đọc-rồi-ghi BÊN TRONG engine — đề nghị 5.2 dựng lại mutation M1.
3. Các transition đã khai trong bảng nhưng chưa có call-site (`duCoc`, nhánh thi công/giao hàng,
   `huy`) đang mượn key gần nghĩa nhất trong registry — 5.2/5.5/5.7 cần xác nhận lại khi có
   call-site thật.
