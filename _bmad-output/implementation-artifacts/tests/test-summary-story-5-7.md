# Test Automation Summary — Story 5.7 (Huỷ đơn kèm lý do)

Ngày: 2026-07-18 · Workflow: `bmad-qa-generate-e2e-tests` · Framework: Jest + Supertest (đã có sẵn)

Story 5.7 vào workflow này khi coverage **đã dày**: 21 ca unit (`backend/test/order-cancel.spec.ts`),
9 ca e2e, 1 source-guard AC-11 có meta-test, 11 guard design-system, 8 widget test mobile. Việc của
vòng này là tìm phần **chỉ `ValidationPipe` + dây HTTP đo được** mà lane unit về bản chất không
chạm tới — unit gọi thẳng `OrdersService.huyDon()`, pipe không tồn tại ở đó.

## Khoảng trống đã phát hiện và đã bịt (7 ca mới, tất cả ở `backend/test/orders.e2e.spec.ts`)

| # | Khoảng trống | Vì sao unit KHÔNG thấy | Ca đã thêm |
|---|---|---|---|
| 1 | **Cận trên** của `@MaxLength(500)` bỏ ngỏ | Chỉ có ca 501 ⇒ hạ trần xuống 499 (hay 50) thì ca đó vẫn đỏ y hệt, không ai báo | 1 ca: lý do **đúng 500 ký tự** ⇒ 200 + ghi đúng cột |
| 2 | `lyDo` **sai kiểu** (số / null / mảng) | `@IsString` là hàng rào duy nhất chặn non-string; gỡ nó ⇒ `input.lyDo.trim()` ném `TypeError` ⇒ **500 INTERNAL** thay vì 400 có `fieldErrors`. Unit luôn truyền string | 3 ca trong `it.each` |
| 3 | Body kèm **field lạ** (`status`, `cancelledAt`, `cancelReason`) | `whitelist: true` sống ở pipe; unit gọi thẳng service nên không có cửa nào để strip | 1 ca: 200 + lệnh `update` chỉ mang đúng 2 cột do service dựng |
| 4 | `fieldErrors[0].code` của ca lý do quá ngắn | Story **cấm** `@MinLength(3)` ở DTO để người dùng nhận đúng một thông điệp. Thêm decorator đó vào ⇒ code đổi `required`→`minLength`, unit vẫn xanh | 1 ca: code `required` + message chứa `3 ký tự` |
| 5 | **Cận dưới** `>= 3` trên dây thật | Unit có ca 3-ký-tự, nhưng ngưỡng người dùng chạm là sau pipe | 1 ca: `'xa.'` ⇒ 200 |

## Đột biến — chứng minh ca mới biết đỏ

Hoàn tác bằng `cp`, không `git checkout` (code story chưa commit). Mọi đột biến đều compile được.

| # | Đột biến | Kết quả |
|---|---|---|
| 1 | `@MaxLength(500)` → `@MaxLength(499)` | ✅ **1 đỏ** — ca 500-ký-tự |
| 2 | Gỡ `@IsString()` | ❌ **sống sót** → đào tiếp, xem dưới |
| 2' | Gỡ **cả** `@IsString()` lẫn `@MaxLength(500)` | ✅ **15 đỏ** |
| 3 | `whitelist: true` → `false` | ❌ **sống sót** → đào tiếp, xem dưới |
| 3' | Controller đọc `dto.cancelReason ?? dto.lyDo` (giữ `whitelist: true`) | ❌ **sống sót** — pipe đã strip mất field lạ |
| 3'' | **Cặp**: `whitelist: false` **+** controller đọc field lạ | ✅ **1 đỏ** — đúng ca field-lạ |
| 4 | Thêm `@MinLength(3)` vào DTO | ✅ **1 đỏ** (sau khi sửa input, xem dưới) |
| 5 | `lyDo.length < DO_DAI_LY_DO_TOI_THIEU` → `<=` | ✅ **1 đỏ** — ca 3-ký-tự |

### Hai lần "sống sót" đều là lớp phòng thủ thứ hai, không phải test rỗng

- **#2** — `@MaxLength` của class-validator **tự trả false cho non-string**, nên nó chặn thay
  `@IsString` khi decorator kia biến mất. Ca test đo đúng bất biến "non-string ⇒ 400, không phải
  500"; bất biến đó chỉ vỡ khi **cả hai** decorator cùng mất — và lúc đó nó đỏ 15 ca.
- **#3** — Có ba lớp chặn mass-assignment: `whitelist` của pipe, controller đọc field tường minh,
  service dựng `data` tường minh. Không đột biến một-điểm nào phá được. Phải **ghép hai lớp**
  (`whitelist: false` + controller đọc nhầm field) mới thấy ca này đỏ.

### Một ca đã phải sửa vì đo hụt

Ca #4 ban đầu dùng input `' ok '` — **4 ký tự thô**, nên `@MinLength(3)` cho qua và mutant sống
sót. Đổi sang `'ok'` (2 ký tự thô) thì mutant chết. Ca `' ok '` giữ nguyên ở `it.each` vì nó đo
việc khác: luật trim của service.

## Lane đã chạy

| Lane | Lệnh | Kết quả |
|---|---|---|
| Backend đầy đủ (**tuần tự**) | `npx jest --runInBand` | **74 suite / 1352 test xanh** (1345 cũ + 7 mới) |
| `orders.e2e` đơn lẻ | `npx jest orders.e2e` | **194 xanh**, ổn định 3 lần liên tiếp |
| **DB lane** | `npm run test:db` | ⚠️ **VẪN CHƯA CHẠY** — cần Đại Ca bật Docker Desktop |

Không chạy lại lane web/design-system/mobile: vòng này **chỉ sửa một file test backend**, không
chạm `.tsx`/`.dart`/CSS/guard nào.

## ⚠️ TD-28 quan sát lại được — flake dưới jest song song

`npm test` (song song) đỏ **hai lần liên tiếp nhưng ở hai suite KHÁC nhau**: lần một
`orders.e2e.spec.ts` (71 ca, lỗi ở tầng collect), lần hai `me.e2e.spec.ts` (2 ca, nhận 403 thay
200). Chạy riêng từng suite: xanh. Chạy `--runInBand` toàn bộ: **1352/1352 xanh**.

Suite đỏ đổi chỗ mỗi lần chạy ⇒ nhiễu chéo giữa worker, không phải test của story này. TD-28 đã
được ghi nhận từ trước (story doc 5.7 ghi `customers.e2e.spec.ts` flake một lần y hệt). **Chưa
chẩn đoán nguyên nhân gốc** — vượt phạm vi workflow này, đề nghị mở thành mục nợ riêng.

## Coverage sau vòng này

- **Endpoint `POST /orders/:id/huy`**: 200 (3 ngưỡng độ dài) · 400 (8 dạng body sai) · 403 · 404 ·
  409 (2 dạng) · 401 qua ma trận authn — **đủ mọi nhánh mã HTTP của route**.
- **`GET /orders/:id/vong-doi`**: `coTheHuy` true/false theo quyền; khẳng định `huy` không lọt
  `buocKeTiep`.
- **`GET /orders/:id`**: `cancelReason` + `cancelledAt` serialize ISO-8601 UTC.

## File đã sửa

- `backend/test/orders.e2e.spec.ts` — +7 ca trong khối `Story 5.7`

## Câu chưa có lời giải

1. Lần chạy song song đầu tiên báo `orders.e2e` đỏ ở tầng collect (71 ca) — không tái hiện được ở
   bất kỳ lần chạy nào sau đó, kể cả song song. Xếp chung vào TD-28, nhưng đây là **hình dạng
   flake nặng hơn** những gì TD-28 mô tả (đỏ cả suite, không phải vài ca).
2. DB lane vẫn chưa từng chạy trên Postgres thật ⇒ hai cột `cancel_reason`/`cancelled_at` và tính
   nguyên tử của `applyTransition` + `update` vẫn **chưa được chứng minh** ngoài mock.
