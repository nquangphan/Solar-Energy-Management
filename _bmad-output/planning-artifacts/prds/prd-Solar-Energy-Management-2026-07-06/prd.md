---
title: "PRD — App quản lý nội bộ công ty NLMT Phương Nam (Phase 1)"
status: final
created: 2026-07-06
updated: 2026-07-07
---

# PRD: App quản lý nội bộ Phương Nam Solar (Phase 1)
*Working title — confirm.*

## 0. Mục đích tài liệu

PRD này dành cho PM, đội phát triển (React web / Flutter mobile / NodeJS backend) và các bước BMad kế tiếp (UX, Architecture, Epics/Stories). Nó xây trên `brief.md` và `addendum.md` (thư mục briefs) và `phase-1-feature-list.md` (thư mục brainstorming) — không lặp lại, chỉ tham chiếu. Cấu trúc: Glossary neo thuật ngữ, Features gộp nhóm với FR đánh số toàn cục (FR-N) và trạng thái ổn định, giả định gắn `[ASSUMPTION]` inline và gom ở §9. Các quyết định công nghệ nằm ở `addendum.md`, không nằm trong PRD.

## 1. Tầm nhìn

Phương Nam Solar bán và thi công điện mặt trời, hiện chạy báo giá + quản lý đơn bằng Excel thủ công — một báo giá có khi mất tới 2 ngày. Phase 1 thay quy trình đó bằng app nội bộ Web + Mobile, lấy màn **Báo giá** kiểu giỏ hàng làm trái tim: thợ khảo sát dựng báo giá cùng khách tại hiện trường, tổng tiền chạy realtime, chốt và chia sẻ ngay tại chỗ.

Nguyên tắc xuyên suốt: app là "máy tăng tốc — không ai phải chờ ai", không phải hệ kiểm soát. Mọi tính năng phục vụ hai mục tiêu ngang hàng: **nhanh** (báo giá vài phút thay vì 2 ngày) và **chính xác** (chống báo giá nhầm). Phân quyền để đúng-người-đúng-việc và chống thao tác nhầm, không để giấu thông tin.

Khi Phase 1 vững, nó là xương sống vận hành để mở ra cổng đại lý tự đặt hàng và CRM ở Phase sau.

## 2. Đối tượng người dùng

App dùng nội bộ, ~20 người, ba vai trò chính. Không có tài khoản khách hàng trong Phase 1.

### 2.1 Jobs To Be Done

- **Thợ khảo sát:** ra báo giá đúng và đẹp ngay trước mặt khách, chốt tại chỗ, không phải về văn phòng.
- **Kế toán:** ghi nhận thu tiền theo đợt và nắm tình hình tài chính mà không phải tổng hợp tay.
- **Đội thi công / Kho:** biết đơn nào tới lượt mình, đang ở bước nào, cần làm gì.
- **Quản lý kinh doanh:** thấy toàn cảnh doanh thu, số đơn, trạng thái đơn bất cứ lúc nào; duyệt chiết khấu.
- **Chủ doanh nghiệp (Admin):** cấp tài khoản, cấu hình quyền theo vai trò, cấu hình danh mục (nguồn khách, VAT, cờ tính năng).

### 2.2 Non-Users (v1)

- Khách hàng cá nhân và đại lý bỏ mối — không có tài khoản, không truy cập app trong Phase 1 (họ chỉ xem/nhận báo giá do nhân viên chia sẻ).

### 2.3 Key User Journeys

- **UJ-1. Thợ khảo sát Hùng chốt đơn ngay tại nhà khách.**
  - **Persona + bối cảnh:** Hùng, thợ khảo sát, đang ở mái nhà khách cá nhân muốn lắp ~8 kWp. Đã đăng nhập app trên điện thoại.
  - **Path:** tạo báo giá mới → chọn loại khách "Cá nhân" (tự bật cờ Thiết bị + Thi công + Vận chuyển) → thêm từng món từ danh mục (pin, inverter, battery, gói vật tư, dây, công lắp) + 1 dòng tự do ghi chú → tổng + VAT nhảy realtime.
  - **Climax:** đưa màn giỏ hàng cho khách xem, khách gật → Hùng bấm **Chốt** → giá đóng băng → bấm **Share** gửi hình ảnh báo giá qua Zalo.
  - **Resolution:** đơn chuyển "Đã chốt", vào danh sách đơn; nếu khách chưa chốt thì nằm ở danh sách follow-up.
  - **Edge case:** khách xin giảm giá → Hùng áp chiết khấu → đơn vào "Chờ duyệt chiết khấu", Hùng gọi điện nhắc sếp duyệt.

- **UJ-2. Kế toán Lan ghi nhận cọc, trạng thái tự nhảy.**
  - **Persona + bối cảnh:** Lan, kế toán tại văn phòng, thấy tiền cọc đợt 1 về tài khoản.
  - **Path:** mở đơn đã chốt → ghi nhận thanh toán đợt 1 theo lịch thanh toán.
  - **Climax:** hệ thống tự chuyển trạng thái đơn sang "Đã cọc" mà không cần ai bấm chuyển trạng thái riêng; audit log ghi lại.
  - **Resolution:** đơn sẵn sàng cho đội thi công lên lịch.

- **UJ-3. Admin Tú cấp tài khoản cho thợ mới.**
  - **Persona + bối cảnh:** Tú, admin, tạo tài khoản cho thợ khảo sát mới.
  - **Path:** tạo account → bấm áp preset role "Thợ khảo sát" (nạp sẵn bộ quyền mặc định) → bỏ bớt quyền "xem tất cả đơn", giữ "xem đơn của mình" → lưu.
  - **Climax:** thợ mới đăng nhập chỉ thấy đúng chức năng của mình, không rối.

## 3. Glossary

- **Đơn** — đối tượng trung tâm, đại diện đồng thời cho báo giá và đơn hàng; phân biệt bằng **Trạng thái**. Một Đơn thuộc về một **Khách hàng**, có một tập **Dòng báo giá**, một bộ **Cờ phạm vi**, một **Lịch thanh toán**.
- **Khách hàng** — bên mua trên một Đơn; định danh bằng **SĐT (khoá chính)**. Có **Loại khách**: Cá nhân (họ tên, CCCD, địa chỉ, SĐT) hoặc Thương mại (tên, MST, địa chỉ, SĐT, tài khoản NH). Không có tài khoản đăng nhập ở Phase 1.
- **Báo giá** — Đơn ở các trạng thái trước khi chốt (đang dựng/gửi khách). Không phải đối tượng riêng.
- **Hợp đồng** — văn bản HĐ Thi công hoặc HĐ Mua bán sinh từ một Đơn theo template tĩnh, tham chiếu số báo giá.
- **Chốt** — hành động chuyển Đơn sang trạng thái "Đã chốt"; tại thời điểm này giá được **Snapshot** vào từng Dòng báo giá.
- **Dòng báo giá (line item)** — một dòng trong Đơn: hoặc tham chiếu một **Sản phẩm** trong Danh mục, hoặc là **Dòng tự do** (mô tả tay). Gồm: tên, đơn vị, số lượng, đơn giá, thành tiền, diễn giải, bảo hành (tuỳ chọn).
- **Dòng tự do** — dòng nhập tay không trỏ tới Sản phẩm, không trừ tồn kho. Dùng để ghi chú hoặc sản phẩm không trong danh mục.
- **Gói vật tư** — tập hợp các Sản phẩm được nhóm lại làm checklist trên UI; chọn gói → tick các sản phẩm con → mỗi tick thành một Dòng báo giá bình thường trỏ vào Product thật. Gói KHÔNG lưu lên Đơn.
- **Cờ phạm vi** — 3 cờ bật/tắt trên mỗi Đơn: **Thiết bị**, **Thi công**, **Vận chuyển**. Quyết định các bước trạng thái áp dụng cho Đơn.
- **Loại khách** — Cá nhân hoặc Thương mại; là **preset** đặt giá trị mặc định cho Cờ phạm vi + nhãn báo cáo, sửa được từng Đơn.
- **Trạng thái** — bước trong vòng đời Đơn (xem §4.2).
- **Snapshot giá** — bản sao đơn giá tại thời điểm Chốt, lưu cứng vào Dòng báo giá; sửa Danh mục sau đó không ảnh hưởng.
- **Sản phẩm** — mục trong **Danh mục vật tư**: tên, đơn vị, (các) mức giá. Giá có thể phân tầng (lẻ/sỉ) khi bật cờ giá phân tầng.
- **Lịch thanh toán** — chuỗi **Đợt thanh toán** cấu hình được (tỉ lệ/số tiền + điều kiện) của một Đơn.
- **Chiết khấu** — giảm giá trên Đơn; cần **Duyệt** của người có quyền.
- **Account** — tài khoản người dùng; mang một bộ **Quyền** riêng (nguồn chân lý).
- **Role** — preset bộ Quyền mặc định (Thợ khảo sát, Đội thi công, Kế toán, Kho/Giao hàng, Quản lý/Sếp, Admin); áp vào Account lúc tạo, không phải nguồn chân lý.
- **Quyền** — một hành động được phép (tạo báo giá, chốt, duyệt chiết khấu, chuyển trạng thái X, xem tất cả đơn…).
- **Audit log** — bản ghi bất biến: ai, làm gì, lúc nào.
- **Ảnh đính kèm** — hình ảnh gắn vào một Đơn: hoặc kèm một lần **chuyển Trạng thái** (ảnh bằng chứng của bước đó), hoặc bổ sung tự do trong chi tiết Đơn.
- **Tồn kho** — số lượng hiện có của một Sản phẩm trong kho; tăng khi **Nhập kho**, giảm khi **Xuất kho**.
- **Phiếu kho** — bản ghi nhập/xuất kho một hoặc nhiều Sản phẩm; Xuất kho có thể gắn với một Đơn.
- **Hoá đơn** — chứng từ hoá đơn tạo từ một Đơn, lưu vào hệ thống và xuất PDF. Phase 1 KHÔNG tích hợp nhà cung cấp hoá đơn điện tử (để Phase sau).
- **Super Admin** — người làm và vận hành app (ngoài tổ chức khách hàng). Có mọi quyền khi được cấp. Không bị cấp chặn (luật không-leo-thang quyền).
- **Admin** — chủ doanh nghiệp (khách thuê làm app). Có quyền cấp tài khoản, cấu hình hệ thống.
- **Quản lý (QUAN_LY)** — quản lý kinh doanh. KHÔNG phải chủ doanh nghiệp.
- **Thông báo đẩy (Push)** — thông báo tự động tới thiết bị/hộp thư của account khi có sự kiện nghiệp vụ hoặc nhắc theo lịch; gửi qua Firebase FCM; đích đến tôn trọng phân quyền.
- **Device token** — mã định danh thiết bị của một account để nhận Push (FCM); một account có thể có nhiều Device token.

## 4. Tính năng

### 4.1 Báo giá kiêm đơn (giỏ hàng)

**Mô tả:** Màn dựng Đơn kiểu giỏ hàng, dùng chính tại hiện trường trên mobile. Thợ thêm Dòng báo giá (pick Sản phẩm từ Danh mục hoặc thêm Dòng tự do/gói), đặt số lượng; hệ thống tính thành tiền, tổng trước VAT, tiền VAT, tổng sau VAT theo thời gian thực. Đơn có Cờ phạm vi + trường công suất kWp + hạn hiệu lực báo giá. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Tạo và dựng Đơn (giỏ hàng)
Người có quyền tạo Đơn mới, chọn Khách hàng và Loại khách, thêm/sửa/xoá Dòng báo giá.
**Consequences (testable):**
- Thêm/bớt/sửa số lượng một Dòng → tổng trước VAT, tiền VAT, tổng sau VAT cập nhật ngay không cần lưu thủ công.
- Dòng pick từ Sản phẩm tự điền đơn giá theo Danh mục hiện tại (trước Chốt).
- Cho phép **Dòng tự do:** nhập tay tên (nhiều dòng mô tả), đơn vị, số lượng, đơn giá, diễn giải; không trỏ tới Sản phẩm, không trừ tồn.
- Cho phép **Gói vật tư:** chọn gói → hiện danh sách sản phẩm con → user tick → mỗi item tick thành một Dòng bình thường trỏ Product thật; user tự nhập số lượng. Gói KHÔNG lưu lên Đơn.
- Mỗi Dòng có trường "Diễn giải" (ghi chú), trường riêng "Bảo hành", và cờ đánh dấu "linh động/dự kiến". `[ASSUMPTION: cờ linh động chỉ mang tính hiển thị, không đổi cách tính tiền.]`

#### FR-2: Cờ phạm vi & Loại khách
Người dùng đặt Loại khách để nạp preset Cờ phạm vi mặc định, và bật/tắt từng Cờ trên Đơn.
**Consequences (testable):**
- Chọn "Cá nhân" → mặc định bật cả 3 cờ (Thiết bị, Thi công, Vận chuyển). `[ASSUMPTION]`
- Chọn "Thương mại" → mặc định chỉ bật Thiết bị (Vận chuyển tuỳ chọn), Thi công tắt. `[ASSUMPTION]`
- Sửa cờ trên Đơn được, độc lập với preset; Loại khách vẫn giữ làm nhãn báo cáo.

#### FR-3: VAT & tổng tiền
Đơn tính và hiển thị Tổng trước VAT / Tiền thuế VAT / Tổng sau VAT. Thuế suất VAT **cấu hình được**, và có **tick chọn có tính VAT hay không** trên Đơn.
**Consequences (testable):**
- Tick "không tính VAT" → tiền thuế = 0, tổng sau VAT = tổng trước VAT.
- Tick "có tính VAT" → áp thuế suất cấu hình (mặc định 8%, sửa được). `[ASSUMPTION: thuế suất cấu hình ở cấp hệ thống, override được ở cấp Đơn; xác nhận phạm vi cấu hình.]`

#### FR-4: Metadata Đơn
Đơn lưu công suất kWp và hạn hiệu lực báo giá.
**Consequences (testable):**
- Hạn hiệu lực nhập được (ví dụ "48h kể từ ngày lên PO"); hiển thị trên báo giá. `[ASSUMPTION: Phase 1 chỉ hiển thị, chưa tự động khoá/nhắc khi hết hạn.]`

#### FR-5: Chốt Đơn & Snapshot giá
Người có quyền bấm Chốt để chuyển Đơn sang "Đã chốt"; hệ thống snapshot đơn giá mọi Dòng.
**Consequences (testable):**
- Sau Chốt, sửa giá Danh mục KHÔNG đổi giá các Dòng của Đơn đã chốt.
- Trước Chốt, Đơn ăn giá mới nhất của Danh mục.

#### FR-6: Sửa Đơn đã chốt (bản update mới + lịch sử)
Người có quyền mở lại Đơn đã chốt để chỉnh → hệ thống tạo **bản update mới** thay vì ghi đè. Trang chi tiết Đơn hiển thị **lịch sử các bản update**.
**Consequences (testable):**
- Mỗi lần chỉnh sinh một bản update mới; các bản cũ vẫn truy được.
- Bản update mới snapshot lại giá khi chốt lại; Audit log ghi ai sửa/đổi gì.
- Trang chi tiết Đơn xem được lịch sử update (bản nào, ai, khi nào, đổi gì) — bản mới nhất là bản hiệu lực.

### 4.2 Vòng đời & Trạng thái Đơn

**Mô tả:** Đơn là một đối tượng, đi qua chuỗi Trạng thái. Các bước áp dụng được **gate theo Cờ phạm vi** (Hybrid). Một số bước tự nhảy theo sự kiện nghiệp vụ; một số cần người + duyệt. Realizes UJ-2.

Chuỗi trạng thái đề xuất `[ASSUMPTION — cần bạn xác nhận/chỉnh danh sách và tên]`:

```
Báo giá (nháp)
  → [nếu có chiết khấu] Chờ duyệt chiết khấu → (duyệt) → 
Đã chốt
  → Thanh toán theo Lịch (mỗi đợt ghi nhận → cập nhật) 
  → [cờ Thi công] Đang thi công → Nghiệm thu
  → [cờ Thiết bị] Đã giao (hoặc Đang giao nếu cờ Vận chuyển bật → Đã giao)
Hoàn thành        (khi thanh toán đủ + nghiệm thu/đã giao xong)
Huỷ               (có thể từ nhiều trạng thái)
```

*Với đơn có cờ Thi công, giai đoạn "Báo giá (nháp)" chính là buổi **Khảo sát** tại hiện trường (bước đầu có thể đặt tên "Khảo sát/Báo giá"). Tên trạng thái cuối cùng chốt ở Architecture.*

**Functional Requirements:**

#### FR-7: Máy trạng thái gate theo Cờ phạm vi
Hệ thống chỉ cho phép/hiển thị các bước hợp lệ với Cờ phạm vi của Đơn. Bước "Đã giao" gate theo **cờ Thiết bị** (đơn có hàng hoá); bước "Đang giao" gate theo **cờ Vận chuyển**.
**Consequences (testable):**
- Đơn KHÔNG bật Thi công → không có bước Đang thi công/Nghiệm thu.
- Đơn bật Thiết bị, KHÔNG bật Vận chuyển → `… → Đã giao` (khách tự tới lấy).
- Đơn bật cả Thiết bị lẫn Vận chuyển → `… → Đang giao → Đã giao`.
- Đơn KHÔNG bật Thiết bị → bỏ qua bước giao, chỉ thi công/nghiệm thu.
- Đơn chỉ Thiết bị (KHÔNG thi công) → Báo giá → Đã chốt → (thanh toán) → Đã giao → Hoàn thành.

#### FR-8: Chuyển trạng thái theo sự kiện
Một số trạng thái tự nhảy khi có hành động nghiệp vụ tương ứng.
**Consequences (testable):**
- Ghi nhận đủ đợt cọc đầu → Đơn tự sang trạng thái tương ứng (vd "Đã cọc"). `[ASSUMPTION: mapping đợt→trạng thái cấu hình theo Lịch thanh toán.]`

#### FR-9: Chuyển trạng thái thủ công + duyệt (có kiểm soát quyền)
Người có quyền chuyển các bước cần thao tác người; bước cần duyệt phải qua người có quyền duyệt.
**Consequences (testable):**
- Chỉ Account có Quyền tương ứng mới chuyển được bước đó (xem §4.6).
- Mọi chuyển trạng thái ghi Audit log (ai, khi nào, từ→đến).

#### FR-10: Danh sách theo dõi & follow-up
Đơn ở trạng thái "Báo giá" (chưa chốt) hiển thị trong danh sách follow-up.
**Consequences (testable):**
- Lọc/nhìn được các Đơn chưa chốt để chăm; không tự xoá/ẩn.

### 4.3 Thanh toán nhiều đợt

**Mô tả:** Mỗi Đơn có Lịch thanh toán cấu hình được; ghi nhận từng đợt cập nhật công nợ và có thể kích hoạt chuyển trạng thái.

**Functional Requirements:**

#### FR-11: Cấu hình Lịch thanh toán
Người có quyền định nghĩa các Đợt thanh toán (tỉ lệ % hoặc số tiền + mô tả điều kiện).
**Consequences (testable):**
- Hỗ trợ mẫu nhiều đợt (vd 20/70/10), một đợt 100%, hoặc tuỳ chỉnh.
- Tổng các đợt = tổng sau VAT của Đơn (cảnh báo nếu lệch). `[ASSUMPTION]`

#### FR-12: Ghi nhận thanh toán
Người có quyền ghi nhận tiền theo từng Đợt.
**Consequences (testable):**
- Ghi nhận đợt → cập nhật trạng thái thanh toán của Đơn; ghi Audit log; có thể auto chuyển trạng thái (FR-8).

### 4.4 Sinh hợp đồng

**Mô tả:** Từ một Đơn, sinh văn bản hợp đồng theo loại phù hợp, điền sẵn dữ liệu và tham chiếu số báo giá.

**Functional Requirements:**

#### FR-13: Sinh Hợp đồng Thi công / Mua bán
Người có quyền sinh hợp đồng từ Đơn.
**Consequences (testable):**
- Đơn có cờ Thi công → sinh **HĐ Thi công**; Đơn chỉ Thiết bị → sinh **HĐ Mua bán**. `[ASSUMPTION: mapping theo cờ; xác nhận.]`
- Hợp đồng điền: hai bên, danh mục vật tư/giá, tổng tiền, lịch thanh toán, tham chiếu số báo giá (BG…).
- Xuất PDF để in/gửi, theo mẫu 2 template thật.
- Điều khoản hợp đồng (bảo hành, phạt, bất khả kháng…) là **template tĩnh** theo file mẫu; chỉ điền dữ liệu động (hai bên, vật tư, tiền, lịch thanh toán), không sửa điều khoản theo đơn.

### 4.5 Danh mục vật tư & Giá

**Mô tả:** Kho Sản phẩm tập trung — nguồn giá cho báo giá. CRUD bất kỳ lúc nào; giá có thể phân tầng sau cờ.

**Functional Requirements:**

#### FR-14: CRUD Sản phẩm & Giá
Người có quyền thêm/sửa/xoá Sản phẩm và cập nhật giá bất kỳ lúc nào.
**Consequences (testable):**
- Cập nhật giá phản ánh ngay vào báo giá đang dựng (chưa chốt); không hồi tố Đơn đã chốt (FR-5).
- Mọi thay đổi Sản phẩm/giá ghi Audit log.

#### FR-15: Giá phân tầng (sau cờ)
Hệ thống hỗ trợ giá lẻ/sỉ, ẩn sau một cờ bật/tắt, mặc định tắt.
**Consequences (testable):**
- Cờ tắt → mỗi Sản phẩm một giá duy nhất.
- Cờ bật → chọn được mức giá theo ngữ cảnh (vd theo Loại khách). `[ASSUMPTION: khi bật, quy tắc chọn mức giá mặc định theo Loại khách; xác nhận.]`

### 4.6 Phân quyền & Tài khoản

**Mô tả:** Quyền gắn theo từng Account (nguồn chân lý). Role là preset để áp nhanh. Màn phân quyền: chọn Account → checklist Quyền tick/bỏ + nút áp preset Role. Realizes UJ-3.

**Functional Requirements:**

#### FR-16: Quản lý Account
Admin tạo/sửa/vô hiệu hoá Account.
**Consequences (testable):**
- Tạo Account chọn được Role preset để nạp bộ Quyền mặc định.

#### FR-17: Quyền theo Account (override preset)
Quyền hiệu lực = bộ Quyền lưu trên Account; áp preset Role chỉ nạp giá trị, sau đó tick/bỏ từng Quyền được.
**Consequences (testable):**
- Sửa quyền một Account KHÔNG ảnh hưởng Account khác cùng Role.
- Đổi định nghĩa preset Role sau này không tự đổi Account đã tạo. `[ASSUMPTION]`

#### FR-18: Quyền cấu hình được cho hành động & duyệt
Quyền chuyển từng Trạng thái và quyền Duyệt (chiết khấu, và các bước cần duyệt) là các mục trong ma trận, config được, không hardcode.
**Consequences (testable):**
- "Xem tất cả đơn" vs "chỉ xem đơn của mình" là một Quyền trong ma trận.
- Mọi chiết khấu cần Duyệt bởi Account có quyền duyệt chiết khấu (Phase 1: không có hạn mức tự quyết). Khi có đơn chờ duyệt → hệ thống tự **push** cho người duyệt (FR-31), thay việc gọi ĐT.

**Ma trận quyền × preset mặc định (đề xuất, `[ASSUMPTION]`):**

| Quyền | Thợ KS | Thi công | Kế toán | Kho/Giao | QL/Sếp | Admin |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Tạo/sửa báo giá | ✅ | | | | ✅ | ✅ |
| Chốt đơn | ✅ | | | | ✅ | ✅ |
| Áp chiết khấu | ✅ | | | | ✅ | ✅ |
| Duyệt chiết khấu | | | | | ✅ | ✅ |
| Chuyển bước thi công | | ✅ | | | ✅ | ✅ |
| Xác nhận giao hàng | | | | ✅ | ✅ | ✅ |
| Ghi nhận thanh toán | | | ✅ | | ✅ | ✅ |
| Sửa danh mục & giá | | | ✅ | | ✅ | ✅ |
| Sinh hợp đồng | ✅ | | ✅ | | ✅ | ✅ |
| Xem tất cả đơn | | | ✅ | | ✅ | ✅ |
| Xem dashboard tài chính | | | ✅ | | ✅ | ✅ |
| Quản lý khách hàng | ✅ | | ✅ | | ✅ | ✅ |
| Nhập/Xuất kho | | | | ✅ | ✅ | ✅ |
| Tạo/xuất hoá đơn | | | ✅ | | ✅ | ✅ |
| Quản lý account & phân quyền | | | | | | ✅ |
| Xem Audit log | | | | | | ✅¹ |

¹ Chỉ account **Super Admin** (một account Admin được chỉ định), không phải mọi Admin.

### 4.7 Dashboard & Báo cáo

**Mô tả:** Màn tổng quan cho Quản lý/Chủ.

**Functional Requirements:**

#### FR-19: Dashboard vận hành
Người có quyền xem doanh thu theo ngày/tuần/tháng, số lượng đơn, tổng hợp đơn theo Trạng thái.
**Consequences (testable):**
- Doanh thu tổng theo mốc thời gian chọn; đếm đơn theo từng Trạng thái.
- Chỉ Account có quyền xem dashboard tài chính mới thấy số liệu doanh thu. `[ASSUMPTION: tách quyền xem tài chính khỏi xem đếm đơn?]`

### 4.8 Audit log

**Mô tả:** Nhật ký bất biến mọi hành động, làm bằng chứng minh bạch.

**Functional Requirements:**

#### FR-20: Ghi & tra Audit log
Hệ thống ghi mọi hành động thay đổi dữ liệu (tạo/sửa/xoá, chuyển trạng thái, duyệt, ghi thanh toán, sửa giá).
**Consequences (testable):**
- Mỗi bản ghi: ai (Account), làm gì, đối tượng nào, lúc nào, giá trị trước→sau (khi áp dụng).
- Bản ghi không sửa/xoá được.
- Chỉ account có quyền `audit.read` được xem Audit log. Quyền này cấp được cho account bất kỳ qua màn Phân quyền.

### 4.9 Nền tảng & Chia sẻ

**Mô tả:** Web (ReactJS) cho văn phòng, Mobile (Flutter) cho hiện trường, chung design system.

**Functional Requirements:**

#### FR-21: Xuất & chia sẻ báo giá
Sau Chốt (và khi cần), người dùng xuất báo giá và chia sẻ cho khách. Bảng dòng vật tư trên PDF bao gồm cột **Bảo hành**.
**Consequences (testable):**
- Xuất PDF báo giá; nút Share dùng native share bottom sheet của hệ thống.
- Ưu tiên chia sẻ HÌNH ẢNH báo giá (hoặc PDF). Web hành xử tương tự (share/download).
- Bản xuất (báo giá / hợp đồng) có khối chữ ký (Người lập phiếu / Giám đốc) + logo & thông tin công ty theo mẫu thật.
- Cột Bảo hành hiển thị giá trị từ `OrderLineItem.warrantyMonths`; hiển thị rỗng nếu dòng không có bảo hành (công lắp, phí, tự do).

#### FR-22: Đăng nhập & phiên
Người dùng đăng nhập; phiên áp đúng bộ Quyền của Account.
**Consequences (testable):**
- UI ẩn/hiện chức năng theo Quyền hiệu lực của Account.
- App hoạt động **online** (cần kết nối mạng); **không** hỗ trợ offline mode ở Phase 1.

### 4.10 Đính kèm hình ảnh (bằng chứng & bổ sung)

**Mô tả:** Đơn cho phép gắn Ảnh đính kèm ở hai chỗ: (1) kèm khi chuyển Trạng thái — làm bằng chứng cho bước đó (vd ảnh mặt bằng lúc khảo sát, ảnh tiến độ/nghiệm thu thi công, ảnh biên bản/hàng lúc giao); (2) bổ sung tự do trong chi tiết Đơn bất cứ lúc nào. Hợp với văn hoá minh bạch và bổ trợ Audit log.

**Functional Requirements:**

#### FR-23: Đính kèm ảnh khi chuyển Trạng thái
Khi thực hiện một chuyển Trạng thái, người dùng đính kèm được một hoặc nhiều ảnh cho bước đó.
**Consequences (testable):**
- Mỗi lần chuyển Trạng thái có thể gắn ≥0 ảnh; ảnh gắn với đúng bước chuyển (đơn, từ→đến, thời điểm).
- Ảnh đính kèm được ghi vào Audit log của bước chuyển đó (ai, khi nào).
- Upload ảnh **luôn tuỳ chọn** ở mọi bước — không bước nào bắt buộc phải có ảnh.

#### FR-24: Đính kèm ảnh bổ sung trong chi tiết Đơn
Người có quyền thêm/xoá Ảnh đính kèm ở màn chi tiết Đơn ngoài luồng chuyển trạng thái.
**Consequences (testable):**
- Xem được toàn bộ ảnh của Đơn (cả ảnh theo bước lẫn ảnh bổ sung), kèm mốc thời gian và người tải lên.
- Xoá ảnh: chỉ **người đã tải lên** hoặc người có **quyền chỉnh sửa đơn hàng**. Thêm/xoá ảnh ghi Audit log.
- Upload từ mobile chụp trực tiếp hoặc chọn từ thư viện; web chọn file. `[ASSUMPTION: giới hạn định dạng/dung lượng ảnh và nơi lưu trữ (VPS/đối tượng) chốt ở Architecture.]`

### 4.11 Quản lý tồn kho

**Mô tả:** Theo dõi số lượng Sản phẩm trong kho qua Nhập kho / Xuất kho. Xuất kho gắn với Đơn khi giao vật tư / thi công. Gắn với vai trò Kho/Giao hàng.

**Functional Requirements:**

#### FR-25: Nhập / Xuất kho & Tồn kho
Tồn kho gồm hai con số: **onHand** (hàng thật trong kho, dùng cho phiếu nhập/xuất), **reserved** (hàng đã hứa cho đơn đã chốt). **Khả dụng = onHand − reserved**.
Người có quyền tạo Phiếu kho (nhập/xuất) cập nhật Tồn kho theo Sản phẩm.
**Consequences (testable):**
- Nhập kho: tăng `onHand`; Xuất kho: giảm `onHand` + `reserved`.
- Chốt đơn: tăng `reserved` tương ứng. Không chặn chốt khi thiếu tồn (cảnh báo sớm + danh sách cần mua). Khả dụng âm hiển thị dạng "Còn 5 · Đã hứa 20 · Cần nhập 15".
- Xem được Khả dụng hiện tại theo Sản phẩm.
- Mọi Phiếu kho ghi Audit log (ai, khi nào, số lượng, sản phẩm).
- `reserved` là tổng của `StockMovement` theo đơn, KHÔNG phải một cột `int` cộng-trừ.
- **Một Đơn, một Phiếu xuất kho** — unique trên `(orderId, orderVersionId)`, idempotent khi retry.

#### FR-26: Xuất kho gắn Đơn & Snapshot giá vốn
Xuất kho có thể gắn với một Đơn (giao vật tư / cấp vật tư thi công). Lúc xác nhận phiếu xuất: `onHand` trừ, `reserved` trừ, snapshot `costPriceSnapshot`.
**Consequences (testable):**
- Từ Đơn có cờ Vận chuyển/Thi công, tạo được Phiếu xuất kho theo các Dòng vật tư của Đơn.
- **Chặn ở khâu xuất kho** — khi xuất: nếu `onHand` không đủ → CHẶN, không cho xuất quá tồn (FR-25 chốt không chặn).
- Xác nhận phiếu xuất: người có `inventory.manage` đếm hàng → xác nhận → trừ `onHand` + `reserved` → snapshot `costPriceSnapshot` (bình quân gia quyền tính từ `Product.costPrice` lúc đó) → publish event `StockIssued` → ghi Audit (người xác nhận).
- Phase 1 quản lý **một kho** duy nhất.

### 4.12 Hoá đơn (lưu DB + xuất PDF)

**Mô tả:** Tạo Hoá đơn từ Đơn, lưu vào hệ thống và xuất PDF. Phase 1 KHÔNG tích hợp nhà cung cấp hoá đơn điện tử (để Phase sau).

**Functional Requirements:**

#### FR-27: Tạo Hoá đơn từ Đơn
Người có quyền tạo Hoá đơn cho một Đơn.
**Consequences (testable):**
- Hoá đơn lấy dữ liệu từ Đơn: khách hàng (MST), các Dòng, VAT, tổng tiền.
- Lưu Hoá đơn vào hệ thống (số hoá đơn nội bộ, ngày, gắn Đơn); ghi Audit log.

#### FR-28: Xem & xuất Hoá đơn
Người có quyền xem lại và xuất PDF Hoá đơn đã tạo.
**Consequences (testable):**
- Xem Hoá đơn gắn với Đơn (số, ngày, tổng tiền); xuất/chia sẻ PDF.

### 4.13 Quản lý khách hàng

**Mô tả:** Lưu và tái sử dụng thông tin Khách hàng cho Đơn, Hợp đồng và Hoá đơn. Hỗ trợ hai Loại khách với bộ trường khác nhau.

**Functional Requirements:**

#### FR-29: Quản lý Khách hàng (SĐT làm khoá chính)
Người có quyền tạo/sửa/tra Khách hàng; **SĐT là khoá chính** định danh Khách hàng.
**Consequences (testable):**
- Cá nhân lưu: họ tên, CCCD, địa chỉ, SĐT. Thương mại lưu: tên, MST, địa chỉ, SĐT, tài khoản NH.
- Khi tạo Đơn: nhập **SĐT** để tra → nếu trùng SĐT đã có → chọn lại Khách hàng cũ, điền sẵn thông tin; nếu **không tìm thấy** → hiện nút **"Tạo khách hàng mới"** ngay tại màn tạo đơn.
- Một SĐT = một Khách hàng (chặn tạo trùng SĐT). `[ASSUMPTION: SĐT duy nhất toàn hệ thống.]`
- Dữ liệu Khách hàng chảy vào Đơn (FR-1), Hợp đồng (FR-13) và Hoá đơn (FR-27).

### 4.14 Thông báo đẩy (Push Notification)

**Mô tả:** Đẩy thông báo tới đúng người khi có sự kiện nghiệp vụ bất đồng bộ (chuyển trạng thái, duyệt, thanh toán, tồn kho) và nhắc việc theo lịch — để không ai phải ngồi hỏi/chờ. Kênh chính: **push tới app mobile qua Firebase FCM**; kèm **hộp thư in-app**. Đích đến luôn tôn trọng phân quyền (không đẩy đơn cho account không có quyền xem). `[ASSUMPTION: Phase 1 push chủ yếu cho mobile (Flutter+FCM); web dùng hộp thư in-app + badge, push trình duyệt để Phase sau.]`

**Functional Requirements:**

#### FR-30: Đăng ký thiết bị nhận push
Account đăng ký/gỡ Device token (FCM) khi đăng nhập/đăng xuất.
**Consequences (testable):**
- Một account có nhiều Device token (nhiều thiết bị); gỡ token khi đăng xuất/không hợp lệ.

#### FR-31: Phát thông báo theo sự kiện
Hệ thống gửi Push tới đúng người nhận theo Ma trận thông báo khi sự kiện xảy ra.
**Consequences (testable):**
- Đích đến xác định theo **QUYỀN** (ma trận phân quyền §4.6, per-account), **KHÔNG theo role**: đẩy cho các account **có Quyền tương ứng** + **người phụ trách/được giao đơn**.
- KHÔNG đẩy nội dung đơn cho account không có quyền xem đơn đó (lọc theo quyền xem: "xem tất cả đơn" vs "đơn của mình").
- Mỗi noti mang deep-link mở đúng màn/đơn liên quan.

#### FR-32: Hộp thư in-app
Account xem lịch sử thông báo trong app.
**Consequences (testable):**
- Lưu lịch sử noti theo account; trạng thái đã đọc/chưa đọc; badge đếm chưa đọc.

#### FR-33: Tuỳ chọn thông báo
Account bật/tắt nhận Push theo từng loại noti.

#### FR-34: Nhắc theo lịch
Job nền phát noti #11 (báo giá sắp hết hiệu lực) và #12 (lead nguội) theo ngưỡng thời gian cấu hình.

**Ma trận thông báo × người nhận (theo QUYỀN, không theo role):**

Người nhận = các account **có Quyền** liệt kê (tra trong ma trận phân quyền §4.6) **+** người phụ trách/được giao đơn; luôn lọc theo quyền xem đơn.

| # | Thông báo (sự kiện) | Người nhận = account có Quyền… (+ người phụ trách đơn) |
|---|---|---|
| 1 | Có đơn chờ duyệt chiết khấu | **Duyệt chiết khấu** |
| 2 | Chiết khấu được duyệt/từ chối | Người phụ trách đơn (người đề xuất) |
| 3 | Đơn Đã chốt | **Ghi nhận thanh toán** + Xem tất cả đơn + Xem dashboard tài chính |
| 4 | Đã cọc (sẵn sàng thi công) | **Chuyển bước thi công** |
| 5 | Bắt đầu thi công (Đang thi công) | **Chuyển bước thi công** + người được giao |
| 6 | Nghiệm thu / Hoàn thành | **Ghi nhận thanh toán** + Xem dashboard tài chính |
| 7 | Đang giao hàng (bỏ mối) | **Xác nhận giao hàng** |
| 8 | Đơn bị huỷ | Người phụ trách đơn + Xem tất cả đơn + Xem dashboard tài chính |
| 9 | Ghi nhận thanh toán 1 đợt | Người phụ trách đơn + **Xem dashboard tài chính** |
| 10 | Xuất kho bị chặn (thiếu tồn) | **Nhập/Xuất kho** + Xem tất cả đơn + Ghi nhận thanh toán + Xem dashboard tài chính |
| 11 | Báo giá sắp hết hiệu lực | Người phụ trách đơn |
| 12 | Lead nguội (chưa chốt lâu) | Người phụ trách đơn |
| 13 | Được giao đơn/việc | Người được giao (account cụ thể) |

*Ánh xạ theo Quyền để nhất quán với mô hình phân quyền per-account (FR-17/18): đổi ai giữ quyền nào thì người nhận noti tự đổi theo, không cần sửa cấu hình noti.*

### 4.15 Nguồn khách, Bảo hành & Lợi nhuận

**Mô tả:** Ba nhóm bổ sung sau khi Phase 1 khởi động: ghi lại kênh mang khách về, theo dõi hạn bảo hành từng món trong đơn, và đo lợi nhuận gộp trên vật tư.

**Functional Requirements:**

#### FR-35: Nguồn khách
Danh mục **Nguồn khách** ghi lại kênh tiếp cận (Facebook, Zalo, Fanpage, Đại lý, Khác). `Customer.sourceId` bắt buộc khi tạo khách; `Order.sourceId` snapshot lúc tạo đơn.
**Consequences (testable):**
- Bảng `CustomerSource { id, name, description, active, sortOrder, isOther }`. Seed 5 dòng: Facebook, Zalo, Fanpage, Đại lý, Khác; mỗi dòng có mô tả phân biệt (vd "Fanpage — khách inbox trang công ty").
- Xoá = `active: false`. Hard delete bị chặn (khách cũ vẫn trỏ vào).
- `isOther` đúng một dòng; dòng đó không xoá/deactivate được. Backend nhận biết "Khác" bằng **cờ**, không bằng so chuỗi tên.
- `Customer.sourceId` KHÔNG có giá trị mặc định trên form. `Customer.sourceNote` bắt buộc khi nguồn có `isOther`.
- `Order.sourceId` = snapshot `Customer.sourceId` lúc tạo đơn; khách quay lại qua kênh khác thì `Customer.sourceId` đổi, nhưng đơn cũ giữ kênh cũ (cùng bài học với `unitPriceSnapshot`, FR-5).
- Màn cấu hình danh mục gate bởi quyền `settings.manage`. Đổi tên nguồn → ghi Audit.

#### FR-36: Bảo hành theo dòng vật tư
Mỗi Dòng vật tư có thời hạn bảo hành riêng, mặc định lấy từ Sản phẩm, sửa được lúc lên đơn.
**Consequences (testable):**
- `Product.warrantyMonths` — mặc định của sản phẩm. `OrderLineItem.warrantyMonths` — giá trị thật, sửa được lúc lên đơn.
- `OrderLineItem.warrantyStartAt` — **đóng băng lúc DÒNG ĐÓ chốt lần đầu**, không phải lúc Đơn chốt. Lý do: sửa đơn tạo `OrderVersion` mới; nếu lấy mốc theo Đơn thì sửa một dòng ghi chú sẽ gia hạn bảo hành toàn bộ hàng cũ, còn hàng mới thêm lại bị lùi ngày.
- Lưu **tháng** (int); hiển thị "5 năm" khi chia hết 12, "18 tháng" khi không.
- Công lắp / phí lắp đặt: `warrantyMonths = null`, không hiện ô. Không viết validation chặn.
- Dòng tự do: ô bảo hành ẩn sau link `+ Thêm bảo hành`. Không mặc định, không bắt buộc.
- Phase 1 chỉ **tra cứu**: SĐT → đơn → từng item + hạn còn lại. Không phiếu yêu cầu bảo hành, không vòng đời, không ảnh, không nhắc sắp hết hạn.
- **Mốc tính từ ngày chốt đơn là quyết định có ý thức.** Đơn thi công chốt tháng 1, nghiệm thu tháng 4 → khách mất 3 tháng bảo hành so với ngày nghiệm thu. Chủ dự án đã biết và chấp nhận đánh đổi này để giữ mốc đơn giản, không phụ thuộc nhánh vòng đời.

#### FR-37: Báo cáo lợi nhuận gộp trên vật tư
Giá vốn nhập ở phiếu nhập kho, đóng băng lúc **xuất kho**, và chỉ đo lợi nhuận **gộp trên vật tư**.
**Consequences (testable):**
- `StockVoucherLine.unitCost` bắt buộc lúc tạo phiếu nhập → hệ thống tự tính **bình quân gia quyền** → cập nhật `Product.costPrice`. Một chỗ gõ duy nhất.
- `OrderLineItem.costPriceSnapshot` đóng băng lúc **xác nhận phiếu xuất kho**, không phải lúc chốt đơn. Lý do: đơn được phép chốt khi thiếu tồn (FR-25), nên giá vốn lúc chốt là giá của hàng chưa mua. Giá bán là lời hứa (đóng băng lúc chốt); giá vốn là sự thật (chỉ biết khi hàng rời kho).
- **Đơn chưa xuất kho KHÔNG có trong báo cáo lợi nhuận** — chưa lãi gì.
- Người duyệt chiết khấu (FR-18) thấy **biên ước tính**, đọc `Product.costPrice` hiện hành, dán nhãn rõ là ước tính.
- Dòng không có giá vốn xác định (công lắp, phí lắp đặt, dòng tự do) → `costPriceSnapshot = unitPriceSnapshot` → lãi dòng = 0. Nhờ vậy công thức chạy **không nhánh `if`**.
- **Công thức:** Lợi nhuận gộp = Σ `(unitPriceSnapshot − costPriceSnapshot) × qty`.
- Báo cáo là **MỘT bảng, BỐN cách nhóm** chọn bằng hàng chip: theo đơn / theo tháng / theo sale (`Order.assigneeAccountId`) / theo nguồn khách (`Order.sourceId`). Không dựng bốn màn hình.
- Dòng KPI trên cùng: doanh thu, giá vốn, lợi nhuận gộp, biên %.
- **Nhãn bắt buộc trên báo cáo:** "Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung."
- Quyền `costs.view` gate đọc `Product.costPrice` và báo cáo lợi nhuận. Guard server-side: response cho account thiếu quyền **không chứa trường `costPrice`** (AD-4 — ẩn ở UI không phải bảo mật).
- Tồn đầu kỳ: ngày go-live kho đã có hàng nhưng chưa có phiếu nhập nào; phải gõ một **phiếu nhập tồn đầu kỳ** lúc triển khai, nếu không báo cáo tháng đầu rỗng. `[ASSUMPTION: người triển khai chịu trách nhiệm bước này.]`

## 5. Non-Goals (rõ ràng)

- Không có tài khoản/khách hàng bên ngoài; không cổng tự đặt hàng cho đại lý (Phase sau).
- Không có hạn mức chiết khấu tự quyết — mọi chiết khấu do người có quyền duyệt.
- Không phải CRM đầy đủ — chỉ có mầm danh sách follow-up.
- Không phải hệ thống kế toán đầy đủ — chỉ ghi nhận thanh toán + tạo hoá đơn (lưu DB + PDF) ở mức vận hành (không sổ sách kế toán, không báo cáo thuế).
- Không tích hợp nhà cung cấp hoá đơn điện tử hợp lệ (VNPT/Viettel/MISA…) ở Phase 1 — để Phase sau.
- Không offline mode — app cần kết nối mạng.

## 6. Phạm vi MVP

### 6.1 Trong phạm vi
Báo giá kiêm đơn (giỏ hàng, dòng tự do/gói, VAT, cờ phạm vi, snapshot, versioning) · máy trạng thái gate theo cờ + auto-transition · lịch thanh toán nhiều đợt + ghi nhận · quản lý khách hàng (SĐT làm khoá) · sinh hợp đồng (Thi công/Mua bán) · danh mục vật tư & giá (giá phân tầng sau cờ) · **quản lý tồn kho** (1 kho, nhập/xuất/tồn, xuất gắn đơn, chặn khi thiếu tồn) · **hoá đơn** (tạo từ đơn, lưu DB + xuất PDF) · phân quyền per-account + role preset · dashboard doanh thu/đơn/trạng thái · audit log · đính kèm ảnh (theo bước chuyển trạng thái + bổ sung trong chi tiết đơn) · **thông báo đẩy** (push mobile qua FCM + hộp thư in-app, đích theo quyền, 13 loại) · Web + Mobile (online) + chia sẻ native.

### 6.2 Ngoài phạm vi MVP
- **Cổng đại lý tự đặt hàng** — Phase sau (khách chưa có account).
- **Hạn mức chiết khấu tự quyết** — Phase sau; Phase 1 mọi chiết khấu phải duyệt.
- **CRM đầy đủ** — Phase sau; Phase 1 chỉ danh sách follow-up.
- **Offline mode** — không làm Phase 1; app cần kết nối mạng.
- **Tích hợp HĐĐT nhà cung cấp** — Phase sau; Phase 1 chỉ hoá đơn nội bộ lưu DB + PDF.
- **Nhiều kho / kiểm kê định kỳ** — Phase sau; Phase 1 chỉ 1 kho.
- **Sổ sách kế toán / báo cáo thuế** — ngoài phạm vi. Chỉ ghi nhận thanh toán + tạo hoá đơn (lưu DB + PDF).
- **Báo cáo công nợ** — dữ liệu `PaymentSchedule`/`Installment`/`Payment` có sẵn từ Epic 7; cần story màn báo cáo ở Phase sau.
- **Báo cáo KPI Sale** — một màn riêng ở Phase sau; báo cáo lợi nhuận nhóm theo sale đã phục vụ phần lớn nhu cầu Phase 1.
- **Phiếu yêu cầu bảo hành** (vòng đời, ảnh) — Phase sau; Phase 1 chỉ tra cứu bảo hành theo SĐT.
- **Nhắc sắp hết hạn bảo hành** — Phase sau; Phase 1 không có.
- **BOM / định mức vật tư** — Phase sau; không cần Phase 1.
- **Serial number tracking** — Phase sau; không cần Phase 1.

## 7. Success Metrics

**Primary**
- **SM-1 (Độ tin cậy):** mọi luồng nghiệp vụ chạy trơn tru, dữ liệu gửi đi chính xác, không lỗi — tiêu chí nghiệm thu số 1. Validates FR-1..FR-34. `[ASSUMPTION: cách đo — vd 0 lỗi nghiệp vụ nghiêm trọng trong X tuần chạy thật; chốt ngưỡng.]`
- **SM-2 (Tốc độ báo giá):** thời gian ra một báo giá từ ~2 ngày → trong buổi khảo sát (vài phút). Validates FR-1, FR-5, FR-21.
- **SM-3 (Chính xác):** tỉ lệ báo giá sai (nhầm món/số lượng/giá) tiến về ~0. Validates FR-1, FR-5, FR-14.
- **SM-4 (Adoption):** 20/20 nhân viên dùng app thay Excel cho toàn bộ báo giá mới. Validates toàn hệ.

**Counter-metrics (không tối ưu mù)**
- **SM-C1:** không đánh đổi tốc độ báo giá bằng cách bỏ bớt bước duyệt/audit — số bước bị bỏ qua phải = 0. Counterbalances SM-2.

## 8. Open Questions

*Các quyết định nghiệp vụ đã chốt. Còn lại là chi tiết kỹ thuật để hoàn thiện ở bước Architecture:*

1. Giới hạn định dạng/dung lượng **Ảnh đính kèm** & nơi lưu trữ (VPS/đối tượng). (FR-24)
2. Tên trạng thái cuối cùng + mapping "đợt thanh toán → trạng thái" chi tiết (khung §4.2 đã duyệt). (§4.2, FR-8)
3. Ngưỡng thời gian cho nhắc theo lịch: báo giá "sắp hết hiệu lực" báo trước bao lâu, "lead nguội" sau bao nhiêu ngày chưa chốt? (FR-34)
4. `[ASSUMPTION]` Phase 1: push cho mobile (FCM); web dùng hộp thư in-app + badge, push trình duyệt để Phase sau — xác nhận.

## 9. Assumptions Index

- §4.1 FR-1 — cờ "linh động/dự kiến" chỉ hiển thị, không đổi tính tiền.
- §4.1 FR-2 — preset cờ theo Loại khách (Cá nhân = 3 cờ; Thương mại = chỉ Thiết bị).
- §4.1 FR-3 — VAT: thuế suất cấu hình + tick có/không tính; phạm vi cấu hình (hệ thống/đơn).
- §4.1 FR-4 — hạn hiệu lực chỉ hiển thị, chưa auto khoá/nhắc.
- §4.2 — khung Trạng thái đã duyệt; tên & chi tiết chuyển bước hoàn thiện ở Architecture.
- §4.2 FR-8 — mapping đợt thanh toán → trạng thái cấu hình theo Lịch.
- §4.3 FR-11 — tổng các đợt phải khớp tổng sau VAT (cảnh báo nếu lệch).
- §4.4 FR-13 — mapping cờ → loại hợp đồng; xuất PDF theo mẫu thật.
- §4.5 FR-15 — khi bật giá phân tầng, quy tắc chọn mức mặc định theo Loại khách.
- §4.6 FR-17 — đổi preset Role không hồi tố Account đã tạo.
- §4.6 — ma trận quyền × preset mặc định (toàn bộ bảng là đề xuất).
- §4.7 FR-19 — tách quyền xem tài chính khỏi xem đếm đơn (?).
- §4.10 FR-24 — giới hạn định dạng/dung lượng & nơi lưu Ảnh (chốt ở Architecture).

## NFR — Yêu cầu phi chức năng (cross-cutting)

- **Độ tin cậy (ưu tiên #1):** toàn vẹn dữ liệu tiền/giá/đơn; không mất dữ liệu; thao tác tài chính idempotent, có audit. Là thước đo nghiệm thu chính (SM-1).
- **Hiệu năng:** giỏ hàng cập nhật tổng tức thời; app dùng được mượt trên điện thoại ngoài hiện trường.
- **Bảo mật/kiểm soát:** đăng nhập, phân quyền áp đúng theo Account; audit bất biến. (Mức bảo mật vừa phải — nội bộ ~20 user, không lộ ra ngoài.)
- **Nhất quán UI:** Web + Mobile dùng chung design system.
- **Quy mô:** ~20 user nội bộ, hạ tầng VPS. Đội build: **solo dev** — ưu tiên đơn giản, ít phụ thuộc hạ tầng phức tạp.
