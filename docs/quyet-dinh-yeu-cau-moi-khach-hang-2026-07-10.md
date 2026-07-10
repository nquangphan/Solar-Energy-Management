# Yêu cầu mới từ khách hàng — bản ghi quyết định

**Ngày:** 2026-07-10
**Nguồn:** phiên party-mode với Đại Ca (memlog: `_bmad-output/party-mode/memories/installed/.memlog.md`)
**Trạng thái:** đã chốt toàn bộ. Đây là nguồn chân lý cho mọi thay đổi tài liệu và story.

Khách hàng yêu cầu 4 nhóm tính năng. Sau khi soát repo: **người phụ trách đã có sẵn**, hạ tầng tồn kho đã có kế hoạch nhưng sai điểm kích hoạt, bảo hành chưa có gì, lợi nhuận thiếu dữ liệu gốc.

---

## 1. Nguồn khách & người phụ trách

**Người phụ trách:** không thêm gì. Dùng `Order.ownerAccountId` + `Order.assigneeAccountId` (AD-15 đã định nghĩa). `Customer` không đổi.

**Nguồn khách:**

- Bảng mới `CustomerSource { id, name, description, active, sortOrder, isOther }`.
- Seed 5 dòng: Facebook, Zalo, Fanpage, Đại lý, Khác. Mỗi dòng có `description` một câu để người nhập phân biệt (vd: `Fanpage — khách inbox trang công ty`; `Facebook — khách nhắn qua tài khoản cá nhân`).
- Xoá = `active: false`. Hard delete bị chặn ở backend (khách cũ vẫn trỏ vào).
- `isOther` đúng **một** dòng; dòng đó không xoá, không deactivate được. Backend nhận biết "Khác" bằng **cờ**, không bằng so chuỗi tên.
- Đổi tên nguồn → ghi Audit (không chặn được việc đổi nghĩa; ghi lại để truy).
- `Customer.sourceId` **bắt buộc, KHÔNG có giá trị mặc định** trên form. `Customer.sourceNote` bắt buộc khi nguồn có `isOther`.
- `Order.sourceId` — **snapshot lúc tạo đơn**, copy từ `Customer.sourceId`. Lý do: khách quay lại qua kênh khác thì `Customer.sourceId` đổi, nhưng đơn cũ phải giữ nguyên kênh đã mang nó về. Đây là cùng một bài học với `unitPriceSnapshot` (FR-5).
- Màn cấu hình danh mục thuộc Epic 3 (Danh mục), gate bởi quyền mới `settings.manage`.

---

## 2. Tồn kho

**Hai con số, không phải một:**

- `onHand` — hàng thật trong kho. **Chỉ phiếu nhập/xuất kho được đụng vào.**
- `reserved` — hàng đã hứa cho đơn đã chốt.
- **Khả dụng = `onHand` − `reserved`.** Đây là con số sale nhìn thấy.

**Ánh xạ trạng thái đơn → tồn kho:**

| Trạng thái | Tác động |
|---|---|
| Báo giá (nháp) | không đụng |
| Chờ duyệt chiết khấu | không đụng |
| **Đã chốt** | `reserved += qty` |
| Đã cọc | không đổi |
| **Đã giao** (xác nhận phiếu xuất) | `onHand -= qty`, `reserved -= qty` |
| Đang thi công / Nghiệm thu / Hoàn thành | không đụng |
| **Huỷ — trước khi xuất** | `reserved -= qty` |
| **Huỷ — sau khi xuất** | KHÔNG tự cộng. Cần **phiếu nhập trả**. |

**Chốt đơn khi thiếu tồn: CHO CHỐT, không chặn.**
Cảnh báo sớm ngay lúc thêm dòng vào báo giá (`Kho còn 5`). Khả dụng âm hiển thị dạng `Còn 5 · Đã hứa 20 · Cần nhập 15`, không hiện `-15` trần trụi. Gộp mọi sản phẩm khả dụng âm = **danh sách cần mua**.
Chặn vẫn nằm ở khâu **xuất kho** — FR-26 giữ nguyên văn.

**Trạng thái "Đã giao":**

- Trạng thái này **đã có trong vòng đời PRD** nhưng `StatusChip.tsx` (Story 1.4) bỏ sót. Không phải trạng thái mới — là bù cái thiếu.
- Gate theo **cờ Thiết bị** (đơn có hàng hoá), KHÔNG phải cờ Vận chuyển.
  - Cờ Vận chuyển BẬT: `… → Đang giao → Đã giao`
  - Cờ Vận chuyển TẮT: `… → Đã giao` (khách tự tới lấy)
  - Cờ Thiết bị TẮT: không có bước giao (đơn chỉ có công lắp)
- **Bỏ bước "Lên lịch thi công".** Nhánh thi công còn `Đang thi công → Nghiệm thu`.
- Chín chip → **mười** chip. Thêm `dagiao: 'Đã giao'`.

**Phiếu xuất kho:**

- Transition sang "Đã giao" bật UI xác nhận phiếu xuất. Người có `inventory.manage` đếm hàng, xác nhận → trừ tồn → publish `StockIssued` → Audit ghi **người xác nhận**.
- `KHO_GIAO` preset có sẵn cả `deliveryConfirm` lẫn `inventoryManage` → cùng một người, không kẹt quyền.
- **Một Đơn, một phiếu xuất.** `StockMovement` unique trên `(orderId, orderVersionId)` → chốt/xuất idempotent khi retry (bảng quy ước: "thao tác tiền idempotent").
- `reserved` là **tổng của StockMovement**, không phải một cột `int` cộng-trừ.
- Sửa đơn đã chốt (Story 4.6) → version mới → huỷ movement version cũ, tạo movement mới. Không đủ khả dụng → chặn re-chốt.

**Cờ trên Product:**

- `Product.tracksStock` — pin/inverter/battery/dây = `true`; công lắp, phí vận chuyển = `false`. `StockItem` chỉ tồn tại cho sản phẩm `tracksStock`.
- `Product.priceEditable` — phí lắp đặt = `true` (nhà một tầng khác nhà bốn tầng); tấm pin = `false` (giá lấy từ catalog, FR-5).
- Vì `priceEditable` là **cửa sau né duyệt chiết khấu** (FR-18: mọi chiết khấu phải duyệt), `OrderLineItem` lưu **song song** giá catalog và giá đã sửa. Không chặn, nhưng chênh lệch không nằm trong bóng tối.

**Gói vật tư:**

- Gói là **checklist trên UI**, KHÔNG phải sản phẩm, KHÔNG phải dòng tự do.
- Chọn gói → hiện danh sách sản phẩm con → user tick → **mỗi item tick thành một `OrderLineItem` bình thường** trỏ vào Product thật.
- User tự nhập số lượng. Giá = giá item × số lượng. Không có giá trọn gói.
- Bảng `ProductGroup` + `ProductGroupItem { productId }`. **Không cần `defaultQty`.**
- Gói **không lưu lên Đơn**, không snapshot, không in PDF. Phase 1 KHÔNG có BOM và không cần.

**Phí lắp đặt:** một `Product` trong danh mục, `tracksStock = false`, `priceEditable = true`.

---

## 3. Bảo hành

- `Product.warrantyMonths` — mặc định của sản phẩm.
- `OrderLineItem.warrantyMonths` — giá trị thật, sửa được lúc lên đơn, snapshot lúc chốt.
- `OrderLineItem.warrantyStartAt` — **đóng băng lúc DÒNG ĐÓ chốt lần đầu**, không phải lúc Đơn chốt.
  - Lý do: `chotAt` nằm trên `OrderVersion`. Sửa một dòng ghi chú tháng 6 sẽ tạo version mới và **gia hạn bảo hành toàn đơn**. Đặt mốc trên dòng thì hàng cũ giữ ngày cũ, hàng mới thêm lấy ngày mới.
- Lưu **tháng** (int). Hiển thị "5 năm" khi chia hết 12, "18 tháng" khi không.
- **Công lắp / phí lắp đặt: không có bảo hành.** `warrantyMonths = null`. KHÔNG viết validation chặn — chỉ để null, không hiện ô.
- **Dòng tự do:** ô bảo hành ẩn sau link `+ Thêm bảo hành`. Không mặc định, không bắt buộc.
- **Phase 1 chỉ TRA CỨU:** SĐT → đơn → từng item + hạn còn lại. Không có phiếu yêu cầu bảo hành, không có vòng đời, không gắn ảnh.
- **Không** nhắc sắp hết hạn bảo hành (để Phase sau).
- Mốc tính từ ngày chốt đơn là **quyết định có ý thức**: đơn thi công chốt tháng 1, nghiệm thu tháng 4 → khách mất 3 tháng bảo hành so với ngày nghiệm thu. Đại Ca chấp nhận. Ghi vào PRD kèm lý do.

---

## 4. Báo cáo lợi nhuận

**Giá vốn nhập ở đâu:**

- `StockVoucherLine.unitCost` — **bắt buộc khi tạo phiếu nhập kho**.
- Hệ thống tự tính **bình quân gia quyền** → cập nhật `Product.costPrice`. Một chỗ gõ, không ai phải nhớ sửa hai nơi.
- KHÔNG dùng FIFO (cần theo dõi lô; PRD §6.2 đã gạch "kiểm kê định kỳ" khỏi phạm vi).
- **Tồn đầu kỳ:** ngày go-live kho đã có hàng nhưng chưa có phiếu nhập nào. Gõ một **phiếu nhập tồn đầu kỳ** lúc triển khai. Nếu quên, báo cáo tháng đầu tiên rỗng.

**Giá vốn đóng băng lúc nào:**

- `OrderLineItem.costPriceSnapshot` — **đóng băng lúc XUẤT KHO**, không phải lúc chốt đơn.
- Lý do: Đại Ca cho chốt khi thiếu tồn. Giá vốn lúc chốt là giá của hàng **chưa mua**. Giá bán là **lời hứa với khách** (đóng băng lúc chốt, FR-5); giá vốn là **sự thật** (chỉ biết khi hàng rời kho).
- **Duyệt chiết khấu** thấy **biên ước tính**, đọc thẳng `Product.costPrice` hiện hành. Dán nhãn rõ là ước tính.
- **Báo cáo lợi nhuận** chỉ đọc `costPriceSnapshot`. **Đơn chưa xuất kho không có trong báo cáo** — vì chưa lãi gì.

**Công thức, không có nhánh `if`:**

```
Lợi nhuận gộp = Σ (unitPriceSnapshot − costPriceSnapshot) × qty
```

- Dòng không có giá vốn xác định (công lắp, phí lắp đặt, dòng tự do) → lúc snapshot đặt `costPriceSnapshot = unitPriceSnapshot` → lãi dòng = 0.
- Hệ quả: app báo **ÍT hơn** sự thật (công lắp bán 5tr, trả thợ 3tr, app báo lãi 0). Chấp nhận — thà thấy ít hơn thật còn hơn nhiều hơn thật.
- Hệ quả 2: **không bao giờ trả lời được "lắp đặt lãi bao nhiêu"**. Cố ý không biết, không phải quên.

**Màn báo cáo:**

- **MỘT** bảng, **bốn cách nhóm** chọn bằng hàng chip: theo đơn / theo tháng / theo sale (`assigneeAccountId`) / theo nguồn khách (`Order.sourceId`). Không dựng bốn màn hình.
- Dòng KPI trên cùng: doanh thu, giá vốn, lợi nhuận gộp, biên %. Dùng component KPI (Story 1.5).
- **Nhãn bắt buộc:** `"Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung."`

**KPI Sale:** bỏ khỏi Phase 1 như một màn riêng. Báo cáo lợi nhuận nhóm theo sale đã phục vụ phần lớn nhu cầu (số đơn, doanh thu, lợi nhuận gộp mang về).

**Báo cáo công nợ:** dữ liệu đã có sẵn từ Epic 7 (`PaymentSchedule`/`Installment`/`Payment`). Không nằm trong phạm vi phiên này.

---

## 5. Quyền — 3 key mới (17 → 20)

| Key | Nhãn | Gate cái gì | Preset mặc định |
|---|---|---|---|
| `settings.manage` | Cấu hình hệ thống | Danh mục nguồn khách, thuế suất VAT | `ADMIN` (→ `SUPER_ADMIN` thừa hưởng) |
| `system.feature_flags` | Cờ tính năng (vận hành app) | Cờ giá phân tầng (FR-15) | **CHỈ `SUPER_ADMIN`** |
| `costs.view` | Xem giá vốn & lợi nhuận | `Product.costPrice`, báo cáo lợi nhuận | `ADMIN`, `KE_TOAN`, `QUAN_LY` |

**Ranh giới ba quyền "sửa cái gì đó"** — câu hỏi phân biệt: *"Sửa cái này thì đổi SỐ LIỆU, đổi CÁCH CÔNG TY VẬN HÀNH, hay đổi APP CÓ TÍNH NĂNG GÌ?"*

- `catalog.manage` (đã có) — dữ liệu vận hành: sản phẩm, giá bán. Sửa hằng tuần.
- `settings.manage` — cấu hình doanh nghiệp. Đặt một lần rồi quên.
- `system.feature_flags` — bật/tắt tính năng. Chỉ người vận hành app.

**Bất biến có test** (cùng khuôn `audit.read` ở `role-presets.spec.ts`):

- `system.feature_flags` nằm NGOÀI `ADMIN_PRESET`, chỉ append vào `SUPER_ADMIN`.
- **Đường đỏ:** `settings.manage` KHÔNG BAO GIỜ gate màn phân quyền (8.2), ma trận quyền (8.4), hay audit log (8.5). Nếu không, ai có nó sẽ tự cấp cho mình mọi quyền trong một click.

**`audit.read`:** preset giữ nguyên (chỉ `SUPER_ADMIN` mang sẵn), nhưng **cấp được** cho account bất kỳ qua màn Phân quyền. FR-20 phải sửa: gate theo **quyền** `audit.read`, KHÔNG theo role.

**Hai luật mới trong `account-permissions.service.ts`** (hiện `setForAccount()` không kiểm người gọi, và `ADMIN` có `permissions.manage`):

1. **Không cấp được quyền mình không có.** Nếu không, chủ doanh nghiệp tự tick `audit.read` cho chính mình — câu "Super Admin bật quyền lên cho xem" hiện không được thứ gì bảo vệ.
2. **Không sửa / vô hiệu hoá account mang quyền mà mình không có.** Nếu không, chủ doanh nghiệp vô hiệu hoá được tài khoản Super Admin.

**Mô hình vai trò — chốt (đang có BA cách gọi mâu thuẫn trong repo):**

- `SUPER_ADMIN` = **người làm và vận hành app** (ngoài tổ chức khách hàng). Có mọi quyền.
- `ADMIN` = **chủ doanh nghiệp** (khách thuê làm app).
- `QUAN_LY` = quản lý kinh doanh. KHÔNG phải chủ.
- Không tồn tại "team IT".

---

## 6. Bản đồ thay đổi tài liệu & story

### 6.1 Đã code rồi → thêm story vào epic gần nhất

| Story mới | Epic | Nội dung |
|---|---|---|
| **1.12** | Epic 1 | Thêm chip `dagiao: 'Đã giao'` vào `StatusChip.tsx` + widget Flutter tương ứng + parity test. 9 → 10 chip. |
| **2.9** | Epic 2 | Ba quyền mới vào `permission-registry.ts` (append cuối, thứ tự deterministic) + `role-presets.ts` + bất biến test cho `system.feature_flags` + sửa comment sai ở `role-presets.ts:13`. Sinh lại `openapi/permissions.json`. |
| **2.10** | Epic 2 | Luật không-leo-thang + luật không-đụng-cấp-trên trong `account-permissions.service.ts`. Source-guard `"mọi handler không @Public phải có @RequirePermissions"` — `CONVENTIONS.md:137` tự yêu cầu nó **trước Epic 4**; đưa lên **trước Epic 3** vì Epic 3+ đụng giá vốn. |

### 6.2 Chưa code → sửa thẳng tài liệu

**`prd.md`:**

- §2 (dòng ~25–33): sửa mô tả vai trò theo mô hình chốt ở §5 trên.
- Vòng đời (dòng ~140–148): bỏ "Lên lịch thi công"; "Đã giao" gate theo cờ Thiết bị.
- FR-7: sửa hệ quả "Đơn chỉ Thiết bị → … → Hoàn thành" thành "… → Đã giao → Hoàn thành".
- Dòng ~66 + ~99: **tách** "Dòng tự do" khỏi "gói". Gói = checklist đẻ ra dòng trỏ sản phẩm; dòng tự do = mô tả tay, không `productId`.
- Dòng ~100: bảo hành **ra khỏi** ô "Diễn giải", thành trường riêng trên dòng.
- FR-20: audit gate theo quyền `audit.read`, không theo "tài khoản Super Admin được chỉ định".
- FR-25/FR-26: bổ sung `reserved`, chốt-không-chặn, chặn-ở-xuất, một-đơn-một-phiếu.
- FR mới: nguồn khách; bảo hành theo dòng; lợi nhuận gộp + `costs.view`.
- §6.2 Ngoài phạm vi: giữ "sổ sách kế toán / báo cáo thuế" ngoài phạm vi; nói rõ Phase 1 chỉ có **lợi nhuận gộp trên vật tư**. Thêm: KPI Sale màn riêng, phiếu yêu cầu bảo hành, nhắc hết hạn bảo hành, BOM/định mức, serial tracking.
- Báo giá PDF: thêm cột **Bảo hành**.

**`epics.md`:**

- Epic 1: thêm Story 1.12.
- Epic 2: thêm Story 2.9, 2.10.
- Epic 3: sửa 3.1 (thêm `costPrice`, `tracksStock`, `priceEditable`, `warrantyMonths` lên Product); sửa 3.3 (thêm `sourceId`/`sourceNote`); thêm **3.5** (danh mục Nguồn khách + màn cấu hình, gate `settings.manage`); thêm **3.6** (Gói vật tư — `ProductGroup`/`ProductGroupItem`, checklist).
- Epic 4: sửa 4.1 (snapshot `Order.sourceId`; dòng phí lắp đặt `priceEditable`; gói vật tư đẻ dòng); sửa 4.5 (snapshot warranty + giá catalog song song giá đã sửa); sửa 4.6 (re-snapshot + tính lại `reserved` theo version); sửa 4.7 (người duyệt thấy biên **ước tính**); thêm **4.9** (Bảo hành theo dòng vật tư).
- Epic 5: sửa 5.7 (huỷ trước xuất → giải phóng `reserved`; huỷ sau xuất → phiếu nhập trả); sửa 5.8 (bỏ "Lên lịch"); thêm **5.9** (Tra cứu bảo hành theo SĐT).
- Epic 6: sửa 6.1 ("Đã giao" gate theo cờ Thiết bị); sửa 6.2 (`onHand` + `reserved` + khả dụng); sửa 6.3 (`StockVoucherLine.unitCost` bắt buộc → bình quân gia quyền → `Product.costPrice`); sửa 6.4 (một đơn một phiếu, gắn transition "Đã giao", snapshot `costPriceSnapshot` lúc xuất); sửa 6.5 (chặn ở xuất, KHÔNG chặn chốt); thêm **6.6** (Giữ chỗ tồn khi chốt đơn — `StockMovement` ledger, idempotent); thêm **6.7** (Phiếu nhập trả khi huỷ đơn đã xuất).
- Epic 7: sửa 7.1 (chặn cấu hình lịch thanh toán có đợt đầu 0%).
- Epic 8: sửa 8.5 (audit gate theo `audit.read`); thêm **8.6** (Báo cáo lợi nhuận gộp — một bảng, bốn cách nhóm).
- FR Coverage Map: cập nhật.

**`ARCHITECTURE-SPINE.md`:**

- ERD: thêm `CUSTOMER_SOURCE`, `PRODUCT_GROUP`, `PRODUCT_GROUP_ITEM`, `STOCK_MOVEMENT`; thêm cột mới lên `CUSTOMER`, `ORDER`, `ORDER_LINE_ITEM`, `PRODUCT`, `STOCK_ITEM`, `STOCK_VOUCHER_LINE`.
- AD mới: **tồn kho hai con số** (`onHand`/`reserved`, `StockMovement` là ledger, `reserved` là tổng chứ không phải biến đếm, unique `(orderId, orderVersionId)`).
- AD mới: **hai mốc đóng băng khác nhau** — giá bán đóng băng lúc chốt (lời hứa), giá vốn đóng băng lúc xuất kho (sự thật).
- AD mới: **không leo thang quyền** — không cấp/sửa quyền mình không có.
- AD-8/AD-15: ghi rõ mô hình vai trò đã chốt (SUPER_ADMIN = người vận hành app).
- Bảng quy ước: ghi `settings.manage` không gate cấp-quyền/audit.

**`sprint-status.yaml`:** thêm 1.12, 2.9, 2.10, 3.5, 3.6, 4.9, 5.9, 6.6, 6.7, 8.6 ở trạng thái `backlog`.

**Không đụng:** `orchestration-2-*.md` và marker của story-automator (Đại Ca đã yêu cầu để nguyên).

---

## 7. Rủi ro / phụ thuộc

- **Story 6.6 (giữ chỗ tồn khi chốt) sửa luồng chốt của Epic 4** nhưng phải nằm ở Epic 6 vì cần `StockItem`/`StockMovement` tồn tại trước. Ghi rõ dependency; đừng để Epic 4 tưởng mình đã xong hẳn.
- **Story 2.10 (source-guard) phải chạy trước Epic 3.** Epic 3 là story đầu tiên đụng `Product.costPrice`. Route quên khai quyền = mọi user đã đăng nhập đọc được giá vốn.
- Thêm chip trạng thái đụng Story 1.4/1.7 đã `done`. Union type chặn trạng thái bịa, nên **thêm** là additive — nhưng parity test hai nền tảng phải chạy lại.
- Tồn đầu kỳ là **bước triển khai**, không phải story. Nếu quên, báo cáo lợi nhuận tháng đầu rỗng và trông như code hỏng.

---

## 8. Đã áp vào tài liệu (2026-07-10)

| File | Thay đổi |
|---|---|
| `prd.md` | §2 vai trò · vòng đời (bỏ "Lên lịch") · FR-7 · Glossary tách dòng-tự-do/gói · FR-20 gate theo quyền · FR-25/26 tồn kho hai con số · **FR-35 Nguồn khách · FR-36 Bảo hành · FR-37 Lợi nhuận gộp** (mục §4.15 mới) · §6.2 ngoài phạm vi · FR-21 cột Bảo hành |
| `epics.md` | +10 story mới · sửa AC 15 story cũ · Epic List · FR Coverage Map |
| `ARCHITECTURE-SPINE.md` | ERD +4 entity, +10 cột · **AD-19** tồn kho hai con số · **AD-20** hai mốc đóng băng · **AD-21** không leo thang quyền · sửa AD-8/14/15 · quy ước đường đỏ `settings.manage` |
| `sprint-status.yaml` | +10 story `backlog`; đổi slug `5-8` (bỏ "lên lịch") |

**FR mới đánh số 35–37.** FR-34 (Nhắc theo lịch) giữ nguyên số — có 9 tham chiếu tới nó ở `epics.md` và `ARCHITECTURE-SPINE.md`.

**Chưa đụng:** code, `orchestration-2-*.md`, marker story-automator.

## 9. Câu chưa trả lời

- Báo cáo **công nợ** (một trong bốn yêu cầu của khách) chưa được thiết kế. Dữ liệu có sẵn ở Epic 7; cần một story màn báo cáo. Đã ghi vào §6.2 PRD là Phase sau.
- Lịch thanh toán có đợt đầu 0% — chặn lúc **cấu hình lịch** hay lúc **áp vào đơn**? Story 7.1 hiện chỉ nói "chặn".
- Ai chịu trách nhiệm gõ **phiếu nhập tồn đầu kỳ** lúc go-live? Nếu quên, báo cáo lợi nhuận tháng đầu rỗng.
- Trạng thái **"Đã giao"** có cần một loại notification riêng không? Ma trận noti hiện giữ 13 loại; hàng #5 đổi từ "Lên lịch thi công" thành "Bắt đầu thi công" để không lệch số đếm, nhưng chưa ai quyết có thêm noti cho "Đã giao".
