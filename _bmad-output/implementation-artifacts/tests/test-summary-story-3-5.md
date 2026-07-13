# Test Automation Summary — Story 3.5 (Danh mục Nguồn khách)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-13 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend, hermetic) · `node --test` (design-system) · lane DB Postgres thật
**Kết quả:** **+21 test**, tất cả cổng xanh · **2 khiếm khuyết sản phẩm** tìm ra (chưa sửa — chờ quyết định)

> Ghi ở file riêng theo story, **không đè** `test-summary.md` (đang giữ bản ghi Story 2.5).

## Phạm vi

Story 3.5 vào workflow này **đã có 60 test** (unit 26 · e2e 32 · lane DB 24). Việc của QA vì vậy
không phải viết lại từ đầu mà là **soi lỗ hổng**: đọc từng AC, đối chiếu với những gì test THẬT SỰ
khẳng định, bịt chỗ trống.

## Gap phát hiện & auto-apply

### API / e2e — `backend/test/customer-sources.e2e.spec.ts` (+4)

| # | AC | Gap | Vì sao là gap |
|---|----|-----|---------------|
| 1 | AC-2 | `PATCH` đổi sang tên trùng ⇒ 409 + `fieldErrors` | Chỉ tầng **unit** canh. `translateWriteError()` trong `update()` là **nhánh code khác** với `create()` — gỡ `try/catch` của `update()` thì HTTP trả 500 mà **không suite nào** kêu. |
| 2 | AC-2 | `PATCH { name: '' }` ⇒ 400 | `@IsNotEmpty` trên `name` của DTO update chưa có test nào chạm. |
| 3 | AC-2 | `PATCH` `name` > 100 · `description` > 500 ⇒ 400 | Trần trên **chỉ được test ở POST**. PATCH là **cửa thứ hai** vào đúng hai cột đó — trần chỉ gác một cửa thì không phải trần (bài học HIGH review 3.2). |
| 4 | AC-3 | `DELETE` dòng **đã tắt** ⇒ 204, không ghi DB, **không audit** | Ca đối xứng (`reactivate` dòng đang bật) **có** e2e; ca này chỉ sống ở unit với Prisma mock ⇒ chưa ai chứng minh `AuditSubscriber` **THẬT** im lặng khi trạng thái không đổi. |

### Runtime — `design-system/session/fake-customer-sources-port.test.mjs` (+17, lane MỚI)

🔴 **Test RUNTIME đầu tiên của bất kỳ dòng code web nào trong repo.**

Nợ TD-1: web không có tsc/bundler/JSDOM ⇒ hàng rào của phần web là **guard quét văn bản** — nó
chứng minh được một chuỗi **có mặt**, **không bao giờ** chứng minh được một dòng code **làm đúng
việc nó nói**. Nhưng **Node 24 strip type gốc** ⇒ file `.ts` không dùng cú pháp chỉ-có-ở-TS thì
`node --test` **import và CHẠY được**, không cần bundler, không cần tsc.

`FakeCustomerSourcesPort` là seam mà màn cấu hình render lên trong **mọi** demo và **mọi** test màn
sau này. Lệch hợp đồng backend ⇒ màn được kiểm chứng trên một lời nói dối (dòng mới rơi sai chỗ,
dòng `isOther` **trông như** tắt được, mô tả vừa xoá lại hiện về). Server vẫn đúng; cái dựng trên
fake thì không. 17 test giữ fake đúng **chính những luật** backend bị bắt phải giữ:

- danh mục demo mang **đúng một** dòng `isOther`
- `list(false)` giấu dòng đã tắt + sắp theo `sortOrder`; `list(true)` cho màn cấu hình thấy hết
- `create()` vắng `sortOrder` ⇒ **max + 1**; `sortOrder: 0` được tôn trọng (0 là **vị trí**, không phải "vắng")
- `create()` **không bao giờ** đặt cờ `isOther` — kể cả khi client nhét cờ vào
- `create()` tên trùng ⇒ reject đúng **hình dạng lỗi** mà màn ghim vào ô `name`
- `update()` key **vắng** ⇒ giữ nguyên; `description: null` ⇒ **xoá** mô tả
- 🔴 `update()` **đổi tên dòng `isOther` được, cờ KHÔNG rơi** — mấu chốt của cả thiết kế
- `deactivate()` **từ chối** dòng `isOther`; dòng thường ⇒ **tắt chứ không xoá** (vẫn đọc được)
- `reactivate()` đưa dòng về dropdown; id lạ ⇒ reject ở **mọi** đường ghi
- danh mục **rỗng** là trạng thái thật: dòng đầu nhận `sortOrder: 0`, không phải `NaN`

**Một thay đổi source để mở lane này:** `web/src/design-system/session/fake-customer-sources-port.ts`
đổi `constructor(private rows: …)` (parameter property — cú pháp **chỉ có ở TS**, strip không nổi)
thành field thường + gán trong constructor. **Ngữ nghĩa y hệt.** Comment tại chỗ dặn story sau đừng
đổi ngược, kẻo lane tắt ngóm.

## Coverage

| Bề mặt | Trạng thái |
|---|---|
| 5 endpoint `/customer-sources` (GET · POST · PATCH · DELETE · reactivate) | **5/5** — happy path + 401/403 + 400 + 404 + 409 + audit |
| Bất biến nghiệp vụ (cờ `isOther` · soft-delete-only · hai gate khác nhau) | unit + e2e + Postgres thật |
| Port web (`FakeCustomerSourcesPort`) | **17 test runtime** (trước: **0**) |
| Màn `CustomerSourceConfigScreen.tsx` | vẫn **chỉ guard văn bản** — JSX không strip được. Nợ TD-1 **chưa trả**. |

## Kết quả chạy

```
backend  npm test          608 / 608   (604 + 4 mới, 0 regression)
backend  npm run test:db    24 / 24    (Postgres thật, 2 suite)
backend  npm run lint · format:check   sạch · sạch
design-system  npm test    247 / 247   (230 + 17 mới)
```

## 🔴 Hai khiếm khuyết sản phẩm (CHƯA sửa — chờ Đại Ca)

Cả hai **kiểm chứng bằng probe chạy thật**, không suy đoán. Không cái nào có test kèm — test cho
chúng chỉ xanh được **sau khi** sửa code sản phẩm, mà phạm vi lệnh là "auto-apply gap **in tests**".

### 1. `sortOrder` không có trần trên ⇒ client 500 được endpoint

`sortOrder` có `@Min(0)` nhưng **không `@Max`**. Cột Postgres là `int4` (trần 2 147 483 647).
Probe trên Postgres thật: `POST { name: 'X', sortOrder: 9999999999 }` ⇒ qua validation ⇒ xuống
Prisma ⇒ ném **P2020** ("value out of range") ⇒ `translateWriteError()` **chỉ biết P2002** ⇒ ném
nguyên ⇒ `AllExceptionsFilter` ⇒ **500 INTERNAL_ERROR** (message generic).

Đúng **họ lỗi** mà story tự liệt kê là bài học #4 ("thiếu trần trên ⇒ tràn", HIGH review 3.2) và đã
áp cho `name`/`description` bằng `@MaxLength` — rồi **quên** `sortOrder`. Route gate
`settings.manage` (chỉ Admin) ⇒ không phải DoS công khai, nhưng **400 mới là câu trả lời đúng**.

**Sửa:** `@Max(2147483647)` vào `sortOrder` ở **cả hai** DTO ghi (2 dòng) + test 400 cho POST và PATCH.

### 2. `PATCH {}` (body rỗng) ⇒ ghi DB một cú no-op **và** đẻ một dòng audit nói dối

Probe: `update()` với body rỗng ⇒ `prisma.update({ where, data: {} })` chạy thật ⇒ publish
`CustomerSourceUpdated` với **`before` === `after`** (verify: hai snapshot bằng nhau từng byte).
AuditLog vì vậy ghi "có người sửa nguồn này" cho một lần **không có gì đổi**.

Chính doctrine của story — viết **hai lần** trong comment `customer-sources.service.ts`: *"một dòng
audit cho việc không xảy ra là một dòng audit nói dối"* — đã được áp cho `deactivate()` và
`reactivate()` (cả hai return sớm, không publish). **`update()` thì không.** Không phải thiết kế,
là chỗ sót.

**Sửa:** trong `update()`, không field nào có mặt (hoặc snapshot trước === sau) ⇒ return sớm, không
ghi DB, không publish. + test e2e "PATCH {} ⇒ không audit".

## Bước tiếp theo

- Đại Ca quyết 2 khiếm khuyết trên: sửa ngay trong 3.5 (đang `review`) hay tách story nợ?
- Lane runtime web vừa mở mới chỉ chạm **port**. Màn `.tsx` (JSX) vẫn ngoài tầm — muốn chạm phải trả
  nợ TD-1 (story app-scaffold web). Đưa vào retro Epic 3.

## Câu hỏi tồn đọng

- Hai khiếm khuyết trên là **thay đổi code sản phẩm**, không phải test ⇒ nằm ngoài "auto-apply in
  tests". Chờ quyết định.
