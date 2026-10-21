# Sprint Change Proposal — Chèn Epic 10 "Nối dây client" (chạy TRƯỚC Epic 8)

- **Dự án:** Phương Nam Solar — Phase 1
- **Ngày:** 2026-10-22 (Asia/Saigon)
- **Workflow:** `bmad-correct-course`, chế độ **Batch, không tương tác** (Đại Ca vắng; áp mặc định tuyên bố trước)
- **Người soạn:** Amelia (Developer) · **Kiến trúc:** Winston · **Project Lead:** Đại Ca
- **Kích hoạt bởi:** action item **G-1** (retro Epic 7, = **F-2** retro Epic 6) · nợ **TD-38**, **TD-39**
- **Quyết định gốc (không bàn lại):** Đại Ca, 2026-10-21 22:33 — chèn epic "Nối dây client" **TRƯỚC Epic 8**; correct-course chạy ngay sau retro Epic 7.
- **Phân loại phạm vi:** **Moderate** (thêm một epic + sắp lại backlog; không viết lại PRD, không rollback)

> Ghi chú vận hành: resolver `_bmad/scripts/resolve_customization.py` cần Python 3.11 (máy có 3.9.6) nên block `workflow` được merge tay: chỉ có `customize.toml` gốc (không có override trong `_bmad/custom/`), `persistent_facts` = `**/project-context.md`, các `activation_steps_*` và `on_complete` rỗng.

---

## 1. Tóm tắt vấn đề

**Vấn đề.** Backend NestJS đã phủ Epic 1–7 (116 suite / 2.405 test hermetic, 26 suite / 321 test lane DB) và sinh `backend/openapi/openapi.json` từ code (drift-guard byte-for-byte). Nhưng **không client nào nói chuyện được với backend**:

| Bề mặt | Hiện trạng (xác minh 2026-10-22) |
|---|---|
| Web (`web/`, React 19 + vite + vitest) | 13 port + 13 fake ở `web/src/design-system/session/`; `web/src/main.tsx` là shell demo hai màn auth dùng `FakePasswordPort`; **0 router, 0 composition root, 0 `fetch`/adapter HTTP**; màn Đăng nhập chưa có port đăng nhập |
| Mobile (`mobile/`, Flutter) | 11 port + 11 fake ở `mobile/lib/design_system/session/`; **không `main.dart`, không `android/`/`ios/`**; `pubspec.yaml` vẫn là scaffold token |
| Client sinh từ OpenAPI | **Chưa có** ở cả hai nền tảng (AD-12 bắt buộc; spine §Deferred hoãn "tới khi có app-runtime") |
| Nút chi tiết đơn | `OrderDetailScreen` render "Thanh toán"/"Hợp đồng"/"Hoá đơn" chỉ khi có callback, **chưa caller nào truyền callback** (không router) |
| Contract | Hai ngôn ngữ: 16 route + 2 tham số + ~30 field DTO tiếng Việt, phần còn lại tiếng Anh (TD-39) |

**Loại vấn đề:** giới hạn kỹ thuật lộ ra trong lúc triển khai (kế hoạch 9 epic không có story nào nối client với backend; TD-38 "mồ côi" từ Epic 1).

**Bằng chứng.**
- Retro Epic 6 §7 Phát hiện 1–2, TD-38/TD-39 (`epic-6-retro-2026-10-21.md`).
- Retro Epic 7 §3.5: fake port lệch backend ở **cả 5 story** Epic 7 (7.2 #10, 7.3 #8, 7.4 #7, 7.5 #7–8) — fake là bản chép tay contract; §7: "chưa có caller nào truyền callback theo quyền"; §9: "Ứng dụng chạy đầu-cuối ❌".
- `jq '.paths' backend/openapi/openapi.json`: 16 route tiếng Việt (bảng §4.2).

**Vì sao bây giờ.** Đổi tên route/field khi chưa có consumer HTTP gần như miễn phí; sau khi client thật dùng thì mỗi lần đổi là một breaking change. Epic 8 thêm 5 màn và Epic 9 (FCM) bắt buộc có app mobile chạy thật — mỗi màn mới chỉ đẻ thêm cùng loại nợ.

---

## 2. Phân tích tác động

### 2.1. Checklist thay đổi (kết quả)

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| 1.1 Story kích hoạt | [x] | Không phải một story; là phát hiện retro E6 (F-2) đến hạn ở retro E7 (G-1) |
| 1.2 Định nghĩa vấn đề | [x] | §1 |
| 1.3 Bằng chứng | [x] | §1 |
| 2.1 Epic hiện tại (E7) | [N/A] | Epic 7 `done`, không mở lại |
| 2.2 Thay đổi cấp epic | [x] | **Thêm Epic 10** |
| 2.3 Rà epic tương lai | [x] | E8, E9: không đổi nội dung, chỉ đổi thứ tự (§2.2) |
| 2.4 Epic bị vô hiệu/epic mới | [x] | Không epic nào lỗi thời; Epic 10 mới |
| 2.5 Thứ tự epic | [x] | **E7 → E10 → E8 → E9** |
| 3.1 PRD | [x] | Không xung đột; không đổi FR; MVP giữ nguyên. Epic 10 là điều kiện để FR-1..FR-37 dùng được thật |
| 3.2 Architecture | [!]→[x] | Cập nhật spine: AD-12 thêm luật client; quy ước REST route; mục Deferred codegen (§4.4) |
| 3.3 UX | [N/A] | Không màn mới; màn có sẵn được nối dây. DESIGN/EXPERIENCE giữ nguyên |
| 3.4 Artifact khác | [x] | `sprint-status.yaml`; README/CONVENTIONS cập nhật trong từng story khi lệnh chạy app đổi |
| 4.1 Điều chỉnh trực tiếp | Viable | Chọn |
| 4.2 Rollback | Not viable | Không có gì để revert; port+fake là đúng thiết kế, chỉ thiếu adapter |
| 4.3 Review MVP | Not viable | MVP không cần cắt |
| 4.4 Hướng chọn | [x] | Điều chỉnh trực tiếp: thêm epic |
| 5.x Thành phần proposal | [x] | §1–§5 |
| 6.1–6.2 Rà soát | [x] | |
| 6.3 Phê duyệt | [x] | Phê duyệt bằng quyết định gốc của Đại Ca (2026-10-21 22:33) + mặc định tuyên bố trước §6 |
| 6.4 sprint-status | [x] | §4.3 |
| 6.5 Bàn giao | [x] | §5 |

### 2.2. Tác động epic

- **Epic 7:** không đổi.
- **Epic 10 (mới):** 8 story, §4.1.
- **Epic 8:** không đổi nội dung story; **bắt đầu sau Epic 10**. Lợi ích: 5 màn Epic 8 ra đời trên router + adapter thật, không thêm port-fake mới.
- **Epic 9:** không đổi nội dung; 9.1 (Firebase) dựng trên app shell + `android/`/`ios/` của 10.6 thay vì tự scaffold. Action item epic 1 "Lên scaffold android/ios" được Story 10.6 xử lý.

### 2.3. Tác động story

- **Không đánh số lại** story nào của Epic 8/9; mọi key trong `sprint-status.yaml` giữ nguyên.
- Story Epic 1–7 đã `done`: không mở lại. Các route/field tiếng Việt chúng tạo ra được đổi trong 10.1/10.2 như một việc refactor riêng — đúng luật ngôn ngữ ở `project-context.md` ("contract cũ tiếng Việt giữ tới khi refactor riêng").

### 2.4. Tác động kỹ thuật

- **Backend:** đổi 16 route + 2 tham số + ~30 field DTO (contract), sinh lại `openapi.json`, cập nhật e2e + source-guard so route; bật CORS theo allowlist. **Không đổi DB, không đổi enum value.**
- **Web:** thêm dependency router + bộ sinh client; composition root; tầng transport duy nhất được gọi mạng; adapter cho 13 port (+ port đăng nhập mới).
- **Mobile:** thêm `main.dart`, `android/`, `ios/`, bộ sinh client Dart, điều hướng, lưu token an toàn; adapter cho 11 port (+ port đăng nhập mới).
- **Test:** guard mới (client sinh lệch spec, fake lọt vào composition root, gọi mạng ngoài transport); smoke đầu-cuối chạy trên máy với backend + Postgres local.
- **Triển khai:** web cần backend chấp nhận origin của static host (CORS) hoặc reverse proxy cùng origin — quyết hạ tầng vẫn hoãn (spine §Deferred), story chỉ thêm allowlist cấu hình bằng env.

---

## 3. Hướng đi đề xuất

**Chọn: Điều chỉnh trực tiếp — thêm Epic 10 "Nối dây client", chạy giữa Epic 7 và Epic 8.**

- **Effort:** Trung bình–Cao (8 story; 2 backend thuần cơ học, 3 web, 3 mobile).
- **Rủi ro:** Trung bình. Rủi ro chính: (a) bộ sinh client Dart kéo nhiều dependency; (b) story adapter đơn/kho/tiền rộng; (c) đổi field làm vỡ fake chép tay — chấp nhận, fake được viết lại theo type sinh ra ở 10.3/10.6.
- **Timeline:** đẩy Epic 8 lùi đúng bằng Epic 10. Không đổi phạm vi Phase 1.
- **Phương án đã cân nhắc và loại:**
  - *Nối dây dần trong từng story Epic 8/9:* mỗi story vừa làm tính năng vừa dựng hạ tầng client ⇒ story phình, Epic 1–7 vẫn không có adapter.
  - *Đổi tên contract sau khi nối client:* mỗi đổi tên thành breaking change ở 3 repo-con.
  - *Một story duy nhất cho mỗi nền tảng:* quá lớn cho một phiên dev (13 port web, 11 port mobile + shell + auth).

**Thứ tự nội bộ bắt buộc:** 10.1 → 10.2 (contract tiếng Anh xong) → 10.3 → 10.4 → 10.5 (web) và 10.6 → 10.7 → 10.8 (mobile). Nhánh web và mobile độc lập nhau sau 10.2, nhưng solo dev nên chạy tuần tự web rồi mobile.

**Lô chuẩn bị Epic 10 (trước commit đầu của 10.1)** — dời nguyên lô chuẩn bị Epic 8 lên:
- **G-3 / TD-50 — race "báo giá → chốt" ở sinh hợp đồng: xếp là action item trong lô chuẩn bị, KHÔNG thành story Epic 10.** Lý do: backend thuần, không liên quan nối client; là sửa một khe đã có khuôn sẵn (`invoices.service.ts` 7.4); cơ chế lô chuẩn bị đã chạy tốt ở E4/E6/E7 (12/12, 9/9, 6/8). Tiêu chí giữ nguyên G-3: ca DB forced-interleaving (holder sửa qty + chốt dưới khoá ⇒ `generate` 409, 0 dòng `contracts`); mutant gỡ kiểm ⇒ lane DB ĐỎ. Phải xong trước 10.1 vì 10.1 sửa `contracts.controller.ts`/test cùng khu vực.
- **G-4** (rà 10 guard `no-*` theo biến thể cú pháp) nên xong trước 10.1, vì 10.1 sửa chính các guard soi route path.
- **G-5** (quyết định giữa story phải vào `epics.md`/spine cùng commit) áp từ 10.1.
- **G-2** (TD-9) giữ hạn "trước 8.3", không bị ảnh hưởng.

---

## 4. Đề xuất thay đổi chi tiết

### 4.1. `epics.md` — thêm Epic 10 (8 story)

Chèn vào **Epic List** và **Epic Details** ngay sau Epic 7, trước Epic 8, header ghi rõ **"chạy TRƯỚC Epic 8"**. FR Coverage Map thêm một dòng. Nội dung đầy đủ nằm trong `epics.md`; tóm tắt:

| Story | Tiêu đề | Nền tảng | Kết quả kiểm được |
|---|---|---|---|
| 10.1 | Đổi route và tham số tiếng Việt sang tiếng Anh | Backend | 16 route + 2 tham số theo bảng §4.2; `openapi.json` sinh lại; 0 route tiếng Việt (guard) |
| 10.2 | Đổi field DTO tiếng Việt sang tiếng Anh | Backend | ~30 field + 3 tên schema theo bảng §4.2; guard tên field; enum value giữ nguyên |
| 10.3 | Web: client sinh từ OpenAPI, phiên đăng nhập và xử lý lỗi một chỗ | Web | Client TS sinh từ `openapi.json` + drift-guard; transport duy nhất gọi mạng; login/refresh/logout; envelope AD-5 parse một chỗ; CORS allowlist ở backend |
| 10.4 | Web: composition root, router và adapter danh mục, khách, cài đặt | Web | `main.tsx` thành composition root; router + gating route theo `/me`; adapter me/password/customers/customer-sources/catalog/settings/warranty |
| 10.5 | Web: adapter đơn, kho, tiền, chứng từ và nút chi tiết đơn theo quyền | Web | Adapter orders/inventory/stock-vouchers/payments/contracts/invoices; 3 nút chi tiết đơn có callback theo quyền; smoke đầu-cuối web |
| 10.6 | Mobile: app shell, android/ios, client Dart sinh từ OpenAPI và phiên đăng nhập | Mobile | `main.dart` + `android/` + `ios/`; client Dart sinh + drift-guard; transport + lưu token an toàn; đăng nhập thật |
| 10.7 | Mobile: điều hướng và adapter danh mục, khách, tài khoản | Mobile | Bottom-nav 5 tab có route thật; adapter me/password/catalog/customers/warranty |
| 10.8 | Mobile: adapter đơn, kho, tiền, chứng từ và nút chi tiết đơn theo quyền | Mobile | Adapter orders/inventory/stock-vouchers/payments/contracts/invoices; 3 nút theo quyền; smoke đầu-cuối mobile |

### 4.2. Bảng đổi tên contract (nguồn chân lý cho 10.1/10.2)

**Route và tham số (10.1)** — đổi cứng, **không alias** (0 consumer HTTP):

| Cũ | Mới |
|---|---|
| `GET /orders/cho-duyet-chiet-khau` | `GET /orders/pending-discount-approvals` |
| `GET /orders/tra-cuu-bao-hanh?sdt=` | `GET /orders/warranty-lookup?phone=` |
| `GET\|POST /orders/{id}/anh` | `GET\|POST /orders/{id}/attachments` |
| `GET\|DELETE /orders/{id}/anh/{attachmentId}` | `GET\|DELETE /orders/{id}/attachments/{attachmentId}` |
| `POST /orders/{id}/ap-chiet-khau` | `POST /orders/{id}/apply-discount` |
| `POST /orders/{id}/duyet-chiet-khau` | `POST /orders/{id}/resolve-discount` |
| `GET /orders/{id}/bao-gia/anh` | `GET /orders/{id}/quote/image` |
| `GET /orders/{id}/bao-gia/pdf` | `GET /orders/{id}/quote/pdf` |
| `POST /orders/{id}/xuat-bao-gia` | `POST /orders/{id}/export-quote` |
| `POST /orders/{id}/chot` | `POST /orders/{id}/confirm` |
| `POST /orders/{id}/chuyen-trang-thai` | `POST /orders/{id}/transition` |
| `POST /orders/{id}/huy` | `POST /orders/{id}/cancel` |
| `POST /orders/{id}/mo-lai` | `POST /orders/{id}/reopen` |
| `GET /orders/{id}/phien-ban` | `GET /orders/{id}/versions` |
| `GET /orders/{id}/vong-doi` | `GET /orders/{id}/lifecycle` |
| `GET\|PATCH /customers/{sdt}` | `GET\|PATCH /customers/{phone}` |

**Tinh chỉnh 10.1** (ghi theo luật G-5, cùng commit story 10.1):

- Tham số query thứ ba bảng trên sót: `GET /customers/lookup?sdt=` → `?phone=`. Query DTO không sinh `components.schemas` nên guard field của 10.2 không thấy được — thuộc 10.1.
- Lỗi chuẩn hoá SĐT ở service (`isPhoneNumber`) trỏ `fieldErrors[].field = 'phone'` cho input path/query (`/customers/{phone}`, `customers/lookup`, `orders/warranty-lookup`), khớp lỗi của ValidationPipe trên cùng endpoint; body `POST /customers` vẫn `sdt` tới 10.2.
- Sáu `operationId` tiếng Việt (bộ sinh client đặt tên method theo nó) đổi bằng tên method handler controller; tên method service giữ:

| Handler cũ | `operationId` mới |
|---|---|
| `OrdersController.traCuuBaoHanh` | `OrdersController_warrantyLookup` |
| `OrdersController.chuyenTrangThai` | `OrdersController_transition` |
| `OrdersController.huyDon` | `OrdersController_cancel` |
| `StockItemsController.lietKe` | `StockItemsController_list` |
| `StockVouchersController.lietKe` | `StockVouchersController_list` |
| `StockVouchersController.chiTiet` | `StockVouchersController_findOne` |

**Field và schema DTO (10.2)** — chỉ tên trên contract; cột DB và enum value giữ nguyên:

| Cũ | Mới | Cũ | Mới |
|---|---|---|---|
| `sdt` | `phone` | `customerSdt` | `customerPhone` |
| `cccd` | `nationalId` | `chotAt` | `confirmedAt` |
| `buoc` | `steps` | `buocKeTiep` | `nextSteps` |
| `trangThai` (bước vòng đời: done/current/upcoming) | `progress` | `coTheHuy` | `canCancel` |
| `coTheXoa` | `canDelete` | `nguoiTaiLen` | `uploadedBy` |
| `soAnhDaLuu` | `savedAttachmentCount` | `laBanHienLuc` | `isCurrent` |
| `soDong` | `lineCount` | `thayDoi` | `changes` |
| `them` / `xoa` / `doiSoLuong` | `added` / `removed` / `qtyChanged` | `tu` / `den` | `from` / `to` |
| `ten` | `name` | `donVi` | `unit` |
| `khaDung` | `available` | `canNhap` | `toPurchase` |
| `tinhTrang` | `stockStatus` | `danhSachCanMua` | `purchaseList` |
| `ma` | `code` | `nguoiTao` | `createdBy` |
| `tongSoLuong` | `totalQty` | `lyDo` | `reason` |
| `scopeThiCong` / `scopeThietBi` / `scopeVanChuyen` | `scopeConstruction` / `scopeEquipment` / `scopeDelivery` | | |
| schema `ThayDoiBanUpdateDto` | `VersionChangesDto` | schema `ThayDoiSoLuongDto` | `QtyChangeDto` |
| schema `CanMuaViewDto` | `PurchaseNeedViewDto` | | |

Story 10.2 được phép tinh chỉnh một tên nếu nó đụng tên đã có trong cùng DTO (ví dụ `OrderLifecycleStepDto` đã có `status`, nên `trangThai` thành `progress`), với điều kiện ghi lại vào bảng này trong cùng commit (luật G-5).

### 4.3. `sprint-status.yaml`

```
OLD:
  epic-7-retrospective: done
  epic-8: backlog

NEW:
  epic-7-retrospective: done
  epic-10: backlog
  10-1-doi-route-va-tham-so-tieng-viet-sang-tieng-anh: backlog
  ... (8 key, slug khớp parse-epic)
  epic-10-retrospective: optional
  epic-8: backlog
```

- G-1 → `done`, resolution trỏ về proposal này; F-2 → `done` (đóng qua G-1).
- G-3: giữ `open`, resolution ghi "xếp lô chuẩn bị Epic 10, trước commit đầu 10.1".
- `last_updated` → `2026-10-22 (correct-course, chèn Epic 10 trước Epic 8)` (không dùng dấu `:` trong giá trị YAML không quote).

### 4.4. `ARCHITECTURE-SPINE.md`

Đây là thay đổi quyết định kiến trúc (composition root, adapter HTTP, bất biến client sinh), nên cập nhật spine:

1. **AD-12**, thêm đoạn "Luật client (correct-course 2026-10-22)":
   - OLD: chỉ có câu "CẢ web LẪN mobile đều sinh/validate client dựa trên spec này".
   - NEW: mỗi client có **MỘT composition root** (web `web/src/main.tsx`, mobile `mobile/lib/main.dart`) là nơi duy nhất ráp port với adapter HTTP; adapter dựng trên **client sinh từ `openapi.json`** (cấm khai type contract bằng tay); **chỉ tầng transport** được gọi mạng; envelope AD-5 parse ở đúng một chỗ trong transport; fake port chỉ dùng trong test/demo, không được import từ composition root; client sinh có drift-guard (sinh lại phải ra đúng byte).
2. **Consistency Conventions / REST route**: ví dụ `/orders/{id}/chot` đổi thành `/orders/{id}/confirm`; thêm "route, tham số, field DTO tiếng Anh; enum value nghiệp vụ (khoá trạng thái, khoá event, loại khách, loại phiếu) giữ nguyên".
3. **Deferred / Chi tiết OpenAPI codegen (FE)**: gạch, ghi "ĐÃ LÊN LỊCH ở Epic 10 (10.3 web, 10.6 mobile)".

### 4.5. PRD / UX

Không đổi.

---

## 5. Bàn giao triển khai

**Phạm vi: Moderate.**

| Vai trò | Trách nhiệm |
|---|---|
| Đại Ca (Project Lead) | Đọc §6; im lặng ⇒ mặc định thành quyết định. Push thủ công sau 5 lane xanh như hiện hành |
| Winston (Architect) | Giữ luật client trong spine AD-12; review 10.3 và 10.6 (hai story đặt khuôn) |
| Amelia (Dev) | Lô chuẩn bị (G-3, G-4, G-5) trước commit đầu 10.1; `bmad-create-story` 10.1 → … → 10.8 qua story-automator |
| Story-automator | `parse-epic` đã thấy đủ 8 story `10.x` (xác minh trong phiên này) |

**Tiêu chí thành công của Epic 10:**
1. `jq '.paths|keys[]' backend/openapi/openapi.json` không còn segment tiếng Việt; guard khoá lại.
2. Web: `npm run build` ra SPA đăng nhập thật vào backend local, đi được báo giá → chốt → thanh toán → hợp đồng → hoá đơn bằng account có quyền; account thiếu quyền không thấy nút tương ứng.
3. Mobile: `flutter run` trên emulator Android đăng nhập thật và đi cùng luồng đó.
4. `grep` 0 lời gọi mạng ngoài tầng transport ở cả hai client; 0 import fake từ composition root (guard).
5. 5 lane (backend, test:db, design-system, web, mobile) xanh.

---

## 6. Mặc định tuyên bố trước (im lặng ⇒ thành quyết định)

1. **Số epic:** Epic **10** (không trùng 8/9; không đánh số lại). Thứ tự chạy E7 → **E10** → E8 → E9.
2. **G-3 (TD-50):** action item lô chuẩn bị Epic 10, không thành story (lý do §3).
3. **Lô chuẩn bị:** G-3, G-4, G-5 xong trước commit đầu 10.1 (dời từ "trước 8.1"); G-2 vẫn "trước 8.3".
4. **Đổi tên cứng, không alias/deprecation:** 0 consumer HTTP nên không cần giai đoạn chuyển tiếp.
5. **Phạm vi đổi tên = route + tham số + field DTO + tên schema** (cả contract), không chỉ route — đổi field sau khi có client cũng là breaking change.
6. **Enum value giữ nguyên tiếng Việt không dấu** (`baogia`, `dachot`, `thicong`, `du_coc`, `xong_giao`, loại khách, loại phiếu…): là mã nghiệp vụ lưu trong DB và audit log; đổi cần migrate dữ liệu + làm lệch lịch sử audit. Enum tính toán không lưu DB (vd `tinhTrang`: `du`/`het`/`am`) cũng giữ, cho một luật duy nhất. Nhãn hiển thị vẫn qua bảng nhãn ở client.
7. **Tên cột/bảng DB giữ nguyên:** DB không phải contract (AD-1).
8. **Tên method port tiếng Việt** (`chuyenTrangThai`, `huyDon`, `themAnh`, `xoaAnh`, `listAnh`, `anhBytes`) đổi sang tiếng Anh trong story adapter tương ứng (10.5, 10.8).
9. **Web codegen:** `openapi-typescript` (sinh type) + `openapi-fetch` (wrapper fetch có type, không runtime nặng); version ghim lúc tạo story.
10. **Mobile codegen:** bộ sinh Dart thuần, không cần JVM (ưu tiên `swagger_parser`); HTTP qua `dio`. Nếu không sinh được multipart/binary đúng, story 10.6 ghi lý do và chọn phương án thay thế trong cùng commit (G-5).
11. **Router web:** `react-router` (chế độ thư viện, không data-router/SSR).
12. **Điều hướng mobile:** `go_router`, gắn vào bottom-nav 5 tab có sẵn (Story 1.8), không đổi số tab.
13. **Lưu token web:** access token chỉ trong bộ nhớ; refresh token trong `localStorage` (công cụ nội bộ ~20 user; backend đã rotate refresh mỗi lần và chặn replay). Logout xoá cả hai và gọi `POST /auth/logout`.
14. **Lưu token mobile:** refresh token trong `flutter_secure_storage`; access token trong bộ nhớ.
15. **Làm mới token:** khi gặp 401, transport gọi `POST /auth/refresh` **một lần** (các request đồng thời chờ chung một lần refresh) rồi phát lại; refresh hỏng ⇒ về màn Đăng nhập.
16. **CORS:** backend bật CORS theo allowlist đọc từ env `CORS_ORIGINS` (rỗng ⇒ tắt); dev web dùng proxy của vite. Chọn reverse proxy cùng origin hay static host riêng vẫn hoãn (spine §Deferred CI/CD).
17. **Base URL:** web `VITE_API_BASE_URL`; mobile `--dart-define=API_BASE_URL`. Không hardcode.
18. **File nhị phân (PDF/ảnh):** tải qua backend kèm Bearer (không link công khai — giữ E-9); web tạo object URL/tải xuống, mobile chuyển byte cho `share_plus`.
19. **Gating 3 nút chi tiết đơn:** "Thanh toán" hiện với mọi account xem được đơn (`GET /orders/{id}/payment-schedule` không yêu cầu quyền riêng; ghi/cấu hình trong màn vẫn gate `payments.record`); "Hợp đồng" ↔ `contracts.generate`; "Hoá đơn" ↔ `invoices.manage` — khớp `@RequirePermissions` của endpoint chính màn đích.
20. **Fake port giữ lại** cho test và màn demo, viết lại theo type sinh ra; không xoá.
21. **Smoke đầu-cuối chạy trên máy** (backend + `pns-postgres` + client), không đưa vào CI (CI vẫn tắt theo quyết định của Đại Ca); kết quả ghi trong Dev Agent Record.
22. **Mobile Phase 1 build Android trước;** `ios/` được scaffold và `flutter analyze` sạch, nhưng build/ký iOS không là tiêu chí Epic 10 (cần máy Mac + tài khoản Apple, ngoài tầm solo dev hiện tại).
23. **G-6 (c) "điều chỉnh khoản thu" (TD-52) và G-6 (b) "sửa phần lịch chưa thu" (TD-51):** ghi vào **backlog chưa xếp epic** (mục 7 dưới đây), **không** thành story Epic 10 — không thuộc phạm vi nối client.
24. **G-6 (h) báo giá giữ `COMPANY_INFO`, gộp vào `system_settings`:** cũng vào backlog chưa xếp epic; không thuộc Epic 10.

## 7. Backlog ghi nhận, chưa xếp epic (từ G-6 qua G-1)

| Mục | Nguồn | Ghi chú |
|---|---|---|
| Điều chỉnh khoản thu (khoản âm / huỷ khoản ghi nhầm) | G-6 (c), TD-52 | Payment append-only; cần thiết kế "khoản điều chỉnh" có audit |
| Sửa phần lịch thanh toán chưa thu khi đơn mở lại đã có tiền | G-6 (b), TD-51 | HĐ đang bị chặn khi lịch lệch tổng |
| Báo giá đọc pháp nhân từ `system_settings` thay `COMPANY_INFO` | G-6 (h) | Cùng nguồn với HĐ/hoá đơn |

Xếp vào epic khi Đại Ca ưu tiên; không chặn Epic 10/8/9.
