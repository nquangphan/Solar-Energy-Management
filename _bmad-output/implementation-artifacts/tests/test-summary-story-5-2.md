# Test Automation Summary — Story 5.2 (Auto-transition theo sự kiện nghiệp vụ)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-18 · **Người chạy:** Đại Ca
**Framework:** Jest (backend hermetic, mock Prisma) · lane DB thật trên Postgres (`npm run test:db`, container `pns-postgres` Up 22h)
**Kết quả:** hermetic **1044/1044** xanh (62 suite; 1032 → 1044, **+12 test / +2 suite**) · lane DB **61/61** (8 suite, **không đổi**) · lint sạch trên file QA đụng

Story thuần backend, **không thêm endpoint HTTP nào** (Task 7) ⇒ không sinh E2E trình duyệt và
không dựng controller giả để có cớ viết e2e. "E2E" ở đây là lane DB thật + source-guard quét
toàn `src/`.

## Phạm vi

Story vào QA ở trạng thái `review` với bộ test dev-phase dày (22 test mới, mutation-check M1–M6,
M6 đã báo cáo trung thực). QA phase KHÔNG đếm lại thứ đã phủ — chỉ đi tìm chỗ **mutant còn sống**
theo 6 AC. Phát hiện **3 gap**, auto-apply cả ba, mutation-verify từng cái. Ngoài ra làm nốt
**việc 5.1 giao lại** (dựng lại mutation M1).

Điểm chung của cả 3 gap: chúng là **bất biến khai báo/cấu trúc**, không phải hành vi — nên toàn
bộ 1032 test hành vi của dev phase mù với chúng.

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | #6 | **"Không nhánh nào gọi engine với `actorPermissions` tự chế" KHÔNG có test nào.** M3 của dev phase chỉ chứng minh *một* call-site hiện có truyền quyền thật | M3 đỏ được vì method ấy ĐÃ CÓ test 403. Một **entry point MỚI** (7.2/6.x thêm "chạy với toàn quyền" cho tiện) không có test 403 nào cả ⇒ bypass toàn diện mà **1042/1042 test vẫn xanh**. Đây đúng lớp lỗ mà guard AC-3 sinh ra để chặn, nhưng guard đó chỉ nhìn `Order.status` trong `data` — gọi ĐÚNG engine với quyền giả thì nó không thấy | ✅ **file mới** `test/no-fabricated-actor-permissions.spec.ts` (+8): quét `src/` bằng `stripToCode` + máy đọc tham số cân bằng ngoặc. **Luật 1** — mọi call-site `this.applyTransition(` phải truyền `actorPermissions` là định danh/đường dẫn thuộc tính (thứ NHẬN được), không phải biểu thức dựng tại chỗ. **Luật 2** — không nơi nào trong `src/orders/` dựng tập hợp từ registry (`new Set(…PERM…)` / `Object.values(PERM)`), chặn đường lách "dựng hằng toàn quyền rồi truyền tên hằng vào" |
| 2 | #4 | **`OrdersModule` export `OrdersService` — không lane nào nhìn thấy.** Unit và lane DB đều `new OrdersService(...)`; e2e boot `AppModule` nhưng chưa module nào inject từ ngoài (`payments/` là 7.2) | Gỡ dòng `exports` đi thì **cả 1032 test vẫn xanh**. AC-4 là *lý do tồn tại* của Task 4, mà nó chỉ được bảo vệ bằng lời hứa trong TSDoc. 7.2 sẽ phát hiện lúc boot đỏ — hoặc tệ hơn, phát minh đường ghi status riêng | ✅ **file mới** `test/orders-module-wiring.spec.ts` (+3): metadata `@Module` (khuôn `prisma-wiring.spec.ts`) — export CÓ `OrdersService` · thứ export cũng phải được provide · **CHỈ** `OrdersService` được export. Kiểm metadata thay vì `compile()` vì compile kéo theo Prisma/Storage/Puppeteer: đắt và giòn cho một bất biến khai báo |
| 3 | #1 (AD-18) | **Đường auto không có test nào ghim `publish` SAU commit.** `confirm`/`revise` đều có test `['write','publish']`; cửa mới thì không | Mock `$transaction` gọi callback đồng bộ ⇒ publish trong tx hay ngoài tx cho **kết quả y hệt** ở mọi assertion khác. Publish trong tx + rollback sau đó = audit ghi một transition CHƯA TỪNG xảy ra (đơn vẫn `dachot` mà event nói đã `dacoc`) | ✅ `orders.service.spec.ts` (+1) theo đúng khuôn `confirm` L1507: `expect(thuTu).toEqual(['write','publish'])` |

### Mutation-verify của chính 3 gap (`cp` backup, KHÔNG `git checkout` — code story chưa commit)

| Mutant | Kỳ vọng | Thực tế |
|--------|---------|---------|
| M-A: gỡ `exports: [OrdersService]` khỏi `orders.module.ts` | ĐỎ | ✅ **ĐỎ đúng 2 test, đúng suite wiring mới** (1042/1044). Trước QA: mutant này **xanh tuyệt đối** |
| M-B: chuyển `publish` vào TRONG callback `$transaction` | ĐỎ | ✅ **ĐỎ đúng 1 test** — chính test AD-18 mới (1043/1044) |
| M-C: thêm method mới `chuyenTrangThaiHeThong()` gọi engine với `new Set(Object.values(PERM))`, `actorAccountId: 'he-thong'` | ĐỎ | ✅ **ĐỎ đúng 2 test, cả hai trong guard mới** (cả luật 1 lẫn luật 2). **1042 test còn lại XANH** — một cửa bypass toàn quyền hoàn chỉnh mà không test hành vi nào thấy |

Cả 3 mutant đều compile (`npx tsc --noEmit` xanh trước khi chạy). Sau mỗi lần revert bằng `cp`
và chạy lại xác nhận XANH + `git diff --stat` khớp nguyên trạng.

Guard mới còn tự kiểm chống **rỗng ruột** (bài học "mutate source-guards for false-PASS"): 1 test
khẳng định máy quét thực sự thấy ≥5 call-site thật và thấy đúng `input.actorPermissions` của cửa
auto · 5 test fixture: bắt bộ quyền dựng tại chỗ (dấu phẩy trong `new Set([a, b])` không cắt biểu
thức làm đôi) · bắt hằng toàn quyền dù truyền vào dưới dạng định danh sạch · **tha** pass-through
hợp lệ (định danh trần, shorthand, đường dẫn) · **tha** `new Set` dedup id thường · **không** đỏ
vì comment/string nhắc hình dạng bị cấm.

## Việc 5.1 giao lại: dựng lại mutation M1 (khoá phía engine)

QA 5.1 để mở câu hỏi #2: *"khoá phía engine vẫn là belt-and-braces chưa chứng minh được — sẽ
thành load-bearing khi 5.2/5.5 có caller đọc-rồi-ghi BÊN TRONG engine, đề nghị 5.2 dựng lại M1."*
Đã làm:

| Mutant | Lane DB (8 suite/61) | Lane hermetic (62 suite/1044) |
|--------|----------------------|-------------------------------|
| M1: gỡ `await this.lockOrderRow(tx, order.id)` khỏi `applyTransition` | ⚠️ **XANH 61/61** | ✅ **ĐỎ 5 test** (`thuTu[0] === 'lock'` ở cả 5 call-site) |

**Kết luận trung thực: tiền đề của câu hỏi 5.1 KHÔNG xảy ra ở 5.2.** `chuyenTrangThaiTuDong` đọc
đơn (`before`) **NGOÀI** transaction rồi truyền vào — bên trong tx không có cặp đọc-rồi-ghi nào
để khoá bảo vệ. Thứ thực sự serialize cuộc đua vẫn là **cổng atomic** `updateMany({ where: { id,
status } })`, đúng như 12 vòng đua thật cho thấy: gỡ khoá đi mà bất biến "một lần đổi, một event,
không ai ném" vẫn đứng. Khoá engine hiện được ghim bằng **cấu trúc** (5 unit test thứ tự op), chưa
bằng một cuộc đua thật.

**Không** thêm `setTimeout` hay dựng test đua giả để ép M1 đỏ ở lane DB — đó đúng là false-green
mà 5.1 đã trả giá. Câu hỏi chuyển tiếp sang 5.5 (xem §Câu hỏi chưa giải đáp).

## Không thêm (đã phủ hoặc là padding — tránh phình)

- **Domain mapping** (`auto-transition-map.spec.ts`): toàn phần qua `Object.values` · liên kết
  hai bảng (sự kiện trả về phải có dòng thật trong `ALLOWED_TRANSITIONS`) · chốt đúng hai mốc.
- **Seam `suKienChoMoc()` → `chuyenTrangThaiTuDong()`**: đã cân nhắc và **bỏ**. Không tìm được
  mutant nào mà chỉ nó giết: bẻ mapping ⇒ M4 đỏ ở domain; bẻ cửa vào ⇒ 10 unit hiện có đỏ. Cửa
  vào nhận `TransitionEvent`, hoàn toàn table-driven, nên nối hai đầu chỉ là padding. Caller thật
  của seam này là 7.2.
- **`daTaiDich`**: 5 test suy từ bảng (mọi dòng qua vòng lặp, cả 3 nhánh `from` của `hoanThanh`,
  hai ca âm tính). M5 dev phase đỏ 12 test qua 2 suite.
- **Cửa vào**: 10 unit (payload `where`/`data` quan sát được · no-op fast-path không mở tx/không
  publish · thua đua ⇒ no-op · thua đua nhưng đơn đi chỗ khác ⇒ 409 · 403 bộ rỗng · 403 thiếu
  đúng `payments.record` · 409 sai cờ phạm vi · đi được khi có cờ · 409 ngoài bảng · thứ tự khoá).
- **Lane DB**: 12 vòng đua tự do không delay · no-op tuyệt đối chứng minh bằng `updatedAt` không
  đổi ở tầng DB.
- **AC-3**: `no-order-status-write-outside-transition.spec.ts` (5.1, không sửa một dòng) vẫn xanh
  khi quét toàn `src/` sau khi module được export. Không viết guard status thứ hai.
- **Task 7**: `openapi-drift` + `permissions-drift` xanh không cần regen (registry vẫn 21 key).
- **M6** (`updateLine` bỏ đọc lại con trỏ trong tx): dev phase đã báo cáo trung thực — ĐỎ ở unit
  hermetic, lane DB không chạm được cửa sổ vì khe pre-tx chỉ có 2 query còn `chot`+`mo_lai` cần
  hàng chục. QA xác nhận phân tích này đúng, **không** dựng lại test giả để tick ô.

## Coverage sau QA

| AC | Nội dung | Trạng thái |
|----|----------|------------|
| #1 | Auto dùng CHUNG `applyTransition()` | **đủ** — payload cổng atomic quan sát được + QA thêm ghim AD-18 publish sau commit |
| #2 | Mapping mốc→sự kiện tra được khi auto-transition | **đủ ở tầng hợp đồng** — toàn phần + liên kết bảng. Giá trị cấu hình là của 7.1 (quyết định đã tuyên bố #2 của story) |
| #3 | `payments/`/`inventory/` gọi engine, không ghi status trực tiếp | **đủ** — source-guard 5.1 quét toàn `src/` |
| #4 | ĐÚNG MỘT method công khai, module export được | **đủ sau QA** — trước QA `exports` hoàn toàn không được bảo vệ (M-A) |
| #5 | Retry ⇒ no-op, không event/audit thứ hai, không 409 | **đủ** — idempotent hai tầng, 12 vòng đua thật, `updatedAt` bất động |
| #6 | Không đường bypass quyền | **đủ sau QA** — M3 giữ call-site hiện có; guard mới giữ **mọi call-site tương lai** (M-C) |

## Lane

| Lane | Lệnh | Trước QA | Sau QA |
|------|------|----------|--------|
| Hermetic | `cd backend && npm test` | 60 suite / 1032 test | **62 suite / 1044 test** ✅ |
| DB thật | `cd backend && npm run test:db` | 8 suite / 61 test | **8 suite / 61 test** ✅ (QA không thêm test DB — xem §M1) |
| Typecheck | `npx tsc --noEmit` | — | **XANH** ✅ |
| Lint | `npx eslint` trên 3 file QA đụng | — | **0 lỗi** ✅ (2 lỗi `prettier/prettier` do QA sinh đã `--fix`) |

⚠️ `npm run lint` toàn repo vẫn ĐỎ SẴN từ trước story (90 lỗi `prettier/prettier` ngoài phạm vi) —
QA không đụng. Không gặp flake nào trong phiên này.

## File QA đụng

- `backend/test/no-fabricated-actor-permissions.spec.ts` — **mới** (+8: 2 luật + 1 chống mù + 5 fixture)
- `backend/test/orders-module-wiring.spec.ts` — **mới** (+3: export/provide/chỉ-một-cửa)
- `backend/test/orders.service.spec.ts` — +1 (AD-18 `['write','publish']` cho cửa auto)

Không đụng một dòng `src/` nào.

## Câu hỏi chưa giải đáp

1. **Fast-path no-op chạy TRƯỚC mọi kiểm quyền.** Một actor **không có quyền nào** gọi
   `chuyenTrangThaiTuDong` trên đơn ĐÃ ở đích sẽ nhận `undefined` (thành công im lặng) thay vì
   403; đơn không tồn tại thì nhận 404 ⇒ phân biệt được sự tồn tại của đơn. Hiện **chưa khai
   thác được** (không có mặt HTTP nào, chỉ module nội bộ gọi), nhưng 7.2 sẽ gọi từ đường có
   request. Hai lựa chọn: (a) giữ nguyên — no-op không đổi gì, và caller đã bị `@RequirePermissions`
   chặn ở tầng HTTP của chính nó; (b) kiểm quyền trước fast-path — đúng chữ "mọi transition
   permission-gated" của AD-7 hơn, nhưng làm retry của một người vừa mất quyền hoá 403 thay vì
   no-op. **Đổi hành vi ⇒ Đại Ca quyết, QA không tự sửa.**
2. **Khoá phía engine vẫn chưa load-bearing** (M1 xanh ở lane DB, xem §trên). Đề nghị dựng lại M1
   ở **5.5**: nếu 5.5 cũng đọc đơn ngoài tx thì khoá engine là dư thật, và nên **báo cáo để gỡ
   hoặc để lại có chủ đích kèm ghi chú**, đừng để nó trôi mãi ở trạng thái "chưa chứng minh được".
3. **Kế thừa từ 5.1, vẫn mở:** ① cửa sổ "đơn `dachot` với 0 dòng" (cổng 0-dòng của `confirm` nằm
   ngoài tx) — đổi hành vi, cần Đại Ca quyết; ② AD-11 nên nâng `[ASSUMPTION]` → `[ADOPTED]` trong
   spine, nay đã có cửa auto thật; ③ D-2 (CI Actions xanh thật) càng cấp vì lane DB tiếp tục lớn.
4. **Hai mốc `coc`/`tat_toan` đã đủ chưa** — vẫn là câu hỏi cấp PRD (§8), trả lời ở 7.1. Guard
   toàn phần đã sẵn sàng: thêm mốc thứ ba mà quên map sẽ ĐỎ ở typecheck, không lọt tới runtime.
