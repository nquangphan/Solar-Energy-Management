# QA Test Summary — Story 5.4: Chi tiết đơn (stepper gate + tabs + lịch sử bản update)

Ngày: 2026-07-18 · Workflow: `bmad-qa-generate-e2e-tests` · Baseline commit: `a265919`

## Bối cảnh

Dev đã để lại 5.4 với 4 lane xanh và 10 đột biến ĐỎ. Workflow này **không** viết lại những gì đã
có; nó đi tìm chỗ **không có test nào chết** khi phá code — rồi bịt.

Đã kiểm và **không đụng** (đã đủ chặt, đột biến của dev đã chứng minh): `buocVongDoi()` (12 test,
kể cả ca rẽ nhánh + cạnh quay lui), `diffDong()` (8 test, có ca chống false-positive theo giá),
hình dạng `where` của 3 đường đọc (12 test), 4 trạng thái màn + tràn stepper trên mobile.

## Gap đã phát hiện và đã bịt

| # | Gap | Vì sao lane cũ không thấy | Đã thêm |
|---|---|---|---|
| G1 | Phạm vi đọc-theo-id **chưa có lane DB** | `orders-detail-scope.spec.ts` chỉ so **hình dạng** `where` trước Prisma giả. Mệnh đề là `OR` lồng trong `AND` với nhánh `assigneeAccountId` **nullable** — hình dạng đúng mà kết quả sai vẫn là **rò đơn**. Đúng bài học G1 của 5.3. | `backend/test/orders-detail-scope.db.integration.spec.ts` — 10 test |
| G2 | Gate `orders.view_*` **không ai canh** | `no-handler-without-require-permissions.spec.ts` chỉ hỏi "có khai quyền không", **không** hỏi "quyền NÀO". `openapi.json` không chứa thông tin quyền ⇒ drift-guard mù. Nới nhầm một mutator sang gate xem = trao quyền GHI cho người chỉ được nhìn, và **không lane nào đỏ**. | `backend/test/orders-read-gate.spec.ts` — 4 test |
| G3 | Hợp đồng AC-9 **không có parity guard** | `orders.test.mjs` chỉ assert **file port tồn tại**. Web không có tsc (TD-1) ⇒ một field thêm ở backend mà quên ở client render thành **ô trống im lặng** trong tab lịch sử — nói dối trong sổ lịch sử, không phải crash. | `design-system/screens/order-detail.test.mjs` — 2 test |
| G4 | `soDong` + chiều diff chỉ được assert **nửa vời** trong e2e | Fixture cũ có **hai bản cùng 1 dòng** ⇒ `soDong` lấy nhầm từ bản khác vẫn xanh; `thayDoi.them` chưa bao giờ được assert khác rỗng ở tầng e2e ⇒ **đảo hai đối số** `diffDong` (lịch sử kể ngược) đi lọt. | `backend/test/orders.e2e.spec.ts` — fixture bản 2 có 2 dòng + 3 assert mới |
| G5 | Guard `mounted` của màn mobile **chưa bao giờ chạy** | Không test nào để một lượt đọc còn đang bay. Người dùng bấm back giữa lúc tải chậm ⇒ `setState` trên State đã chết ⇒ **exception thật**. | `mobile/test/screens/orders/order_detail_screen_test.dart` — 2 test |

## Đột biến đã chạy (khôi phục bằng `cp`, không `git checkout`)

| Đột biến | Suite phải đỏ | Kết quả |
|---|---|---|
| `@Patch(':id')` mang gate `RequireAnyPermissions(ordersViewAll, ordersViewOwn)` | `orders-read-gate.spec.ts` | **ĐỎ** 2 test |
| `@Get(':id')` quay về `RequirePermissions(quotesCreateEdit)` (regression của chính 5.4) | `orders-read-gate.spec.ts` | **ĐỎ** 2 test |
| `soDong: versions[0].lineItems.length` (lấy số dòng bản đầu) | `orders.e2e.spec.ts` | **ĐỎ** 1 test |
| Đảo hai đối số `diffDong(version, versions[i-1])` | `orders.e2e.spec.ts` | **ĐỎ** 1 test |
| Xoá field `soDong` khỏi port **mobile** | `order-detail.test.mjs` | **ĐỎ** 1 test |
| Thêm field `tongTien` chỉ ở port **web** | `order-detail.test.mjs` | **ĐỎ** 1 test |
| Bỏ `!mounted` khỏi cả hai nhánh của `_load()` | `order_detail_screen_test.dart` | **ĐỎ** 2 test |

## Kết quả lane

| Lane | Lệnh | Trước | Sau |
|---|---|---|---|
| Backend hermetic | `cd backend && npx jest` | 67 suite / 1138 test | **68 suite / 1142 test** xanh |
| Backend DB | `cd backend && npm run test:db` | 10 suite / 72 test | **CHƯA CHẠY** — xem dưới |
| Web text-guard | `cd design-system && npm test` | 325 test | **327 test** xanh |
| Mobile | `cd mobile && flutter test` + `analyze` | 217 test | **219 test** xanh, analyze 0 issue |

### ⚠️ Lane DB chưa chạy — cần Đại Ca bật Docker

`docker info` báo daemon không sống. File `orders-detail-scope.db.integration.spec.ts` đã viết,
đã `tsc --noEmit` sạch, đã prettier + eslint sạch, và **tự skip** khi vắng `DATABASE_URL` (nên
`npx jest` vẫn hermetic — đã xác nhận: 68 suite chứ không phải 69). Nhưng **em chưa thấy nó xanh
một lần nào**. Đại Ca bật Docker Desktop rồi chạy:

```
cd backend && npm run test:db
```

Nếu đỏ, khả năng cao là fixture (seed `CustomerSource` "Facebook", hoặc dọn dẹp FK) chứ không
phải service — báo em sửa.

## Đã cân nhắc và CỐ Ý KHÔNG thêm

- **Test race "bản trả lời cũ đè bản mới" trên màn chi tiết.** Nhánh `ticket != _latest` hiện
  **không tới được**: lượt đọc thứ hai chỉ khởi động từ nút "Thử lại", nút đó chỉ có ở trạng thái
  lỗi, mà trạng thái lỗi chỉ tới sau khi lượt đầu đã xong. Viết một test "race" giả sẽ xanh mà
  chứng minh số 0. Đã ghi chú ngay trong file test; ticket giữ nguyên làm phòng thủ cho ngày có
  thêm trigger reload.
- **Test hành vi cho web `OrderDetailScreen.tsx`.** Web vẫn không có tsc/bundler/JSDOM (TD-1);
  dồn assert hành vi vào lane Flutter là quyết định có sẵn của story, không mở lại ở đây.
- **Test đường GHI chưa scope** (`findOrThrow` unscoped phục vụ `PATCH`/`chot`/`mo-lai`).
  Đây là nợ story đã ghi tường minh, thuộc story riêng — không phải finding mới.

## Vấn đề tồn đọng (KHÔNG phải của 5.4)

**Flake trong `test/customer-sources.e2e.spec.ts`** (Epic 2):
`AC-1 — POST (có settings.manage) › name trùng (P2002) ⇒ 409 CONFLICT + fieldErrors`.

Đo được: đỏ khoảng **1/10 lần** khi chạy **toàn suite song song**; chạy **riêng file đó 20 lần
liên tiếp: xanh cả 20**. ⇒ Không phải logic của test, mà là **nhiễu giữa các worker song song**.
Một lần `npx jest --runInBand` (toàn suite, tuần tự): **68 suite / 1142 test xanh** — một mẫu,
chưa đủ để kết luận, nhưng khớp với giả thuyết nhiễu song song.

File này 5.4 không chạm. 5.3 từng ghi nhận "một lỗi không tái hiện được" — đây chính là nó, giờ
đã có tên và có đặc điểm. Đề xuất: mở story kỹ thuật riêng, bắt đầu từ chỗ này.

## Câu hỏi còn treo

1. Bật Docker để chạy lane DB — nếu Đại Ca muốn em chạy luôn, chỉ cần mở Docker Desktop rồi bảo em.
2. Flake `customer-sources.e2e` có tách story riêng không, hay để nó lại cho đợt dọn kỹ thuật sau?
