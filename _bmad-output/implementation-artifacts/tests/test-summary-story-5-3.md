# Test Automation Summary — Story 5.3 (Danh sách đơn + follow-up + trạng thái list)

Ngày: 2026-07-18 · Workflow: `bmad-qa-generate-e2e-tests` · Baseline: `c89d91e`

## Bối cảnh

Story 5.3 vào workflow này với vùng phủ đã dày (65 suite/1096 test hermetic, 16 text-guard web,
5 widget test mobile, 8 đột biến bắt buộc đều ĐỎ). Nên workflow **không sinh test cho có** —
mỗi test thêm vào đây phải trả lời được câu hỏi *"đột biến nào đang sống sót?"*. Bốn gap được
tìm bằng cách đó; ba gap còn lại được xét rồi **loại** (mục cuối).

Lưu ý về chữ "E2E" trong dự án này: web chưa có runner (nợ TD-1) nên "E2E web" = text-guard;
"E2E backend" = supertest qua HTTP thật với Prisma mock; sự thật tầng DB nằm ở lane
`*.db.integration.spec.ts` chạy trên Postgres thật.

## Gap đã phát hiện và đã đóng

### G1 — Lane DB chưa từng chạy `GET /orders` ⚠️ giá trị cao nhất

Mọi khẳng định phạm vi trước đó (`orders-list-scope.spec.ts`, `orders.e2e.spec.ts`) so **hình
dạng** của `where` với một Prisma giả: `AND: [{ OR: [owner, assignee] }]`. Hình dạng đúng
**không bằng** kết quả đúng — mệnh đề phạm vi là một `OR` **lồng** trong `AND`, và câu hỏi thật
("đơn của người khác có bị loại khỏi tập trả về không") chỉ Postgres trả lời được. Cùng lý do
cho `include customer.name` (JOIN thật, `Order.customerSdt` → `Customer.sdt`, AD-9) và cho
`skip`/`take` + `count` trong một `$transaction` trên nhiều hàng thật.

Đây là bề mặt bảo mật: rò ở đây là rò dữ liệu khách hàng, triệu chứng duy nhất là "danh sách
hơi dài".

**Mới:** `backend/test/orders-list.db.integration.spec.ts` — 3 account/đơn dựng thật
(đơn của tôi · đơn người khác **giao cho tôi** · đơn hoàn toàn của họ), 8 test:

- `view_own` ⇒ Postgres **loại** đơn người khác, giữ cả nhánh owner lẫn nhánh assignee
- `view_all` ⇒ thấy cả ba, thứ tự mới-nhất-trước (`createdAt` cách nhau thật, không do test tự sắp)
- `followUp=true` + `view_own` ⇒ hai bộ lọc **cùng hiệu lực**, không cái nào ghi đè cái nào
- đơn `dachot` không lọt vào tập follow-up (FR-10)
- `total` đếm toàn bộ tập đã scope, phân trang thật qua 2 trang
- trang vượt quá trang cuối ⇒ `items` rỗng nhưng `total` giữ nguyên
- `customerName` qua JOIN quan hệ
- lọc `status` trên cột vừa đánh index

### G2 — `followUp=false` kèm `status` bị chặn oan

Chỉ `followUp === true` là bộ lọc trạng thái. Nới điều kiện xung đột thành `!== undefined` biến
một truy vấn **hợp lệ** (UI gửi cả hai field khi follow-up đang tắt) thành 400 — và **không test
nào bắt được**.

**Thêm:** 1 test ở `orders-list-scope.spec.ts` + 1 test ở `orders.e2e.spec.ts`.

### G3 — `page`/`pageSize` trong body không được khẳng định là phản chiếu tham số

Pager của cả hai màn suy `totalPages` và nút Trước/Sau từ `page`+`pageSize` trong body. Trả cứng
`page: 1` làm pager kẹt ở trang đầu — mutant sống sót qua toàn bộ suite cũ (test envelope chỉ
kiểm giá trị **mặc định** 1/20).

**Thêm:** 1 test ở `orders.e2e.spec.ts` (`?page=3&pageSize=5` ⇒ body `{page: 3, pageSize: 5}`).

### G4 — Ticket chống race trên mobile chỉ được đọc như *chuỗi*

`orders-list.test.mjs` grep sự **hiện diện** của ticket trong source hai bên; không test nào
chứng minh một response cũ thật sự bị bỏ. Flutter có harness thật ⇒ hành vi này quan sát được.

**Thêm:** 1 widget test — port thủ công park mọi lời gọi vào `Completer`, để test quyết định
**thứ tự trả lời**: request hiện tại trả trước, request cũ lết về sau; màn phải giữ dữ liệu mới.

## Đột biến — mọi test mới đều có tải trọng

| # | Đột biến | Suite | Kết quả |
|---|---|---|---|
| M-A | `followUp === true` → `followUp !== undefined` trong điều kiện xung đột | `orders-list-scope` + `orders.e2e` | **ĐỎ** (đúng 2 test mới) |
| M-B | Trả cứng `page: 1, pageSize: 20` trong body | `orders.e2e` | **ĐỎ** (1 test) |
| M-C | Bỏ `ticket != _latest` khỏi màn mobile | `order_list_screen_test` | **ĐỎ** (đúng test mới) |
| M-D | Vô hiệu mệnh đề phạm vi quyền (`if (false && …)`) | lane DB | **ĐỎ** (4 test — Postgres bắt được rò) |

Mọi đột biến đều **compile được**; khôi phục bằng `cp` (không `git checkout` — code story chưa
commit). Đã xác nhận không còn vết đột biến trong `src/`.

## Kết quả 4 lane

| Lane | Trước QA | Sau QA |
|---|---|---|
| Backend hermetic `npm test` | 65 suite / 1096 test | **65 suite / 1099 test** ✅ |
| Backend DB `npm run test:db` | 8 suite / 61 test | **9 suite / 69 test** ✅ |
| `design-system` `npm test` | 308 test | **308 test** ✅ (không chạm web) |
| `mobile` `flutter test` | 204 test | **205 test** ✅ · `flutter analyze` sạch · `dart format -o none` sạch |

`eslint` + `prettier` sạch trên mọi file QA này chạm.

**Một lần đỏ không tái lập:** vòng chạy `npm test` đầu tiên sau khi thêm test có 1 test đỏ; 4
vòng đầy đủ liên tiếp ngay sau đó đều 1099/1099 xanh, và tên test đỏ **không được ghi lại kịp**.
Khớp với flakiness không xác định **đã có từ trước** trên baseline 5.2 (chạy đồng thời/shared
state), không phải do test mới — nhưng đây là nợ chưa trả, ghi lại ở mục câu hỏi mở.

## Coverage

- Endpoint `GET /orders`: **1/1** — phạm vi quyền (cả 2 nhánh owner/assignee), follow-up, status,
  phân trang, trần+kiểu query, 403, 400 xung đột, envelope, fence tiền/giá vốn. Nay phủ **cả hai
  tầng**: hình dạng `where` (mock) + kết quả thật (Postgres).
- Màn danh sách đơn: web **text-guard 16 test** (TD-1: không runner) · mobile **6 widget test**
  (4 trạng thái + follow-up + race).
- AC 1-10: đều có ít nhất một test khẳng định trực tiếp; AC-1/AC-5 nay có thêm bằng chứng DB thật.

## Đã cân nhắc và CỐ Ý không thêm (tránh padding)

1. **E2E web bằng Playwright/JSDOM** — `web/` chưa có tsc/bundler/runner (nợ TD-1). Dựng runner
   trong workflow QA là mở một story hạ tầng, ngoài phạm vi.
2. **Test cho `@RequireAnyPermissions` ở tầng HTTP** — `permissions-guard.spec.ts` đã phủ ma trận
   OR đủ 11 ca gồm mảng rỗng và fail-closed; e2e đã có ca 403. Thêm nữa là trùng.
3. **Test EXPLAIN xác nhận 2 index mới được dùng** — kế hoạch truy vấn phụ thuộc thống kê bảng;
   trên bảng test vài hàng Postgres sẽ chọn seq scan và test sẽ đỏ vì lý do sai. Index đã được
   khẳng định ở tầng migration (`CREATE INDEX` đọc bằng mắt) + `migrate deploy` thật.

## Câu hỏi mở

1. Flakiness `npm test` (1 đỏ trong 5 vòng, không tái lập, tên không ghi lại được) vẫn chưa có
   chủ. Nợ này đã theo từ 5.2 sang 5.3 — đề xuất tách một task điều tra riêng chạy jest với
   `--runInBand` + `--detectOpenHandles` để khoanh vùng shared state.
2. Lane DB nay có 2 file cùng dựng fixture cho `orders` (`orders.db.integration` và
   `orders-list.db.integration`) với SĐT/account tách biệt nên không đụng nhau, nhưng nếu Epic 5
   thêm file thứ ba thì nên rút helper dựng/dọn đơn dùng chung.
