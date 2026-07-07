---
title: "EXPERIENCE — Phương Nam Solar App (Phase 1)"
status: final
created: 2026-07-06
updated: 2026-07-07
sources:
  - ../../prds/prd-Solar-Energy-Management-2026-07-06/prd.md
  - ./DESIGN.md
---

# Phương Nam Solar — Experience Spine

> Spine hành vi cho app quản lý nội bộ (Phase 1): IA, voice, component behavior, state machine của Đơn, interaction primitives, accessibility, và các Key Flow. Nhận diện thị giác (màu, token, typography, icon) sống ở `DESIGN.md`; spine này quyết định **cách nó hành xử**. Khi mockup và spine mâu thuẫn, spine thắng.

## Foundation

Hai bề mặt, một design system chung: **Web (ReactJS)** cho văn phòng và **Mobile (Flutter)** cho hiện trường. Cùng ngôn ngữ thị giác "Viền nét / blueprint" trên bảng màu "Năng Lượng Sạch" ({colors.teal} + {colors.lime}) — xem `DESIGN.md`. App chạy **online-only** (FR-22, không offline ở Phase 1). Người dùng: ~20 nhân viên nội bộ, 6 vai trò, không có tài khoản khách hàng. Ngôn ngữ giao diện: **tiếng Việt**. Web dựng trong khung trình duyệt + sidebar; Mobile dựng trong khung điện thoại + bottom nav 5 tab. Full parity: mọi màn nghiệp vụ đều có cả bản web lẫn mobile.

Nguyên tắc xuyên suốt (từ PRD §1): app là **máy tăng tốc, không phải hệ kiểm soát**. Hai mục tiêu ngang hàng — **nhanh** (báo giá vài phút thay vì 2 ngày) và **chính xác** (chống báo giá nhầm). Phân quyền để đúng-người-đúng-việc, không để giấu thông tin.

## Information Architecture

25 màn hình, chia 5 nhóm. `mockups/all-screens.html` là composition reference.

| Nhóm | Màn (id) | Đến từ | Mục đích |
|---|---|---|---|
| **A · Xác thực & Nền** | Đăng nhập (`s-login`) | Cold open | Cổng vào; phiên áp đúng bộ Quyền (FR-22) |
| | Quên mật khẩu (`s-forgot`) | Link từ Đăng nhập | Đặt lại mật khẩu qua mã |
| | Trang chủ / Dashboard (`s-home`) | Sau đăng nhập / tab Trang chủ | Doanh thu, đếm đơn theo Trạng thái, đơn gần đây (FR-19) |
| | Menu (`s-menu`) | Tab Menu (mobile) | Cửa vào Khách hàng / Danh mục / Phân quyền / Audit / Hồ sơ / Đăng xuất |
| | Hồ sơ & Đổi mật khẩu (`s-profile`) | Menu / sidebar | Thông tin cá nhân, đổi mật khẩu |
| **B · Đơn hàng** | Danh sách đơn (`s-orders`) | Tab Đơn hàng | Lọc theo Trạng thái, follow-up đơn chưa chốt (FR-10) |
| | Báo giá / Giỏ hàng (`s-quote`) | FAB **+Tạo** / "Xem chi tiết" | Trái tim app: dựng Dòng báo giá, tổng realtime, Chốt (FR-1..5) |
| | Chọn / Tạo khách (`s-customer-pick`) | Trong luồng tạo đơn | Tra SĐT → chọn khách cũ hoặc tạo mới (FR-29) |
| | Chi tiết đơn (`s-order-detail`) | Row danh sách đơn | Trạng thái, lịch sử bản update, ảnh, hành động (FR-6) |
| | Chuyển trạng thái + ảnh (`s-status-change`) | Nút hành động trong Chi tiết đơn | Chọn bước kế, đính kèm ảnh optional (FR-9, FR-23) |
| | Xác nhận huỷ đơn (`s-order-cancel`) | Chi tiết đơn | Huỷ có lý do, ghi Audit |
| **C · Tiền & Chứng từ** | Duyệt chiết khấu (`s-discount-approval`) | Dashboard / thông báo | Danh sách chờ duyệt → Đồng ý / Từ chối kèm lý do (FR-18) |
| | Thanh toán (`s-payments`) | Chi tiết đơn | Cấu hình Lịch, ghi nhận từng đợt (FR-11, FR-12) |
| | Sinh hợp đồng (`s-contract`) | Chi tiết đơn | HĐ Thi công / Mua bán, xuất PDF (FR-13) |
| | Hoá đơn (`s-invoice`) | Chi tiết đơn | Tạo từ Đơn, lưu DB + xuất PDF (FR-27, FR-28) |
| | Chia sẻ / xuất báo giá (`s-share`) | Nút Share sau Chốt | Native share sheet, ưu tiên hình ảnh (FR-21) |
| **D · Khách & Danh mục & Kho** | Danh sách khách hàng (`s-customers`) | Menu / sidebar | Tra cứu khách theo SĐT (FR-29) |
| | Chi tiết khách (`s-customer-detail`) | Row khách | Thông tin theo Loại khách, lịch sử đơn |
| | Danh mục vật tư & giá (`s-catalog`) | Tab Danh mục / sidebar | Nguồn giá cho báo giá; CRUD (FR-14, FR-15) |
| | Chi tiết / Sửa sản phẩm (`s-product-detail`) | Row danh mục | Sửa giá, cờ giá phân tầng |
| | Tồn kho (`s-inventory`) | Tab Kho | Tồn hiện tại theo Sản phẩm (FR-25) |
| | Phiếu kho (`s-stock-vouchers`) | Tab Kho | Nhập / Xuất, xuất gắn Đơn (FR-25, FR-26) |
| **E · Quản trị** | Phân quyền & tài khoản (`s-permissions`) | Menu / sidebar (Admin) | Chọn Account → ma trận Quyền + áp preset Role (FR-16..18) |
| | Tạo / sửa account (`s-account-form`) | Nút trong Phân quyền | Tạo account, nạp Role preset |
| | Audit log (`s-audit`) | Sidebar (Super Admin) | Nhật ký bất biến; chỉ Super Admin (FR-20) |

**Điều hướng.** Mobile — bottom nav 5 tab khoá cứng mọi màn: **Trang chủ · Đơn hàng · ➕Tạo · Kho · Menu**; FAB **+Tạo** (teal, tách khỏi thanh nav) luôn mở màn Báo giá. Màn xác thực (Đăng nhập, Quên MK) không có bottom nav. Web — sidebar dọc: Trang chủ, Đơn hàng, Khách hàng, Danh mục, Kho, Phân quyền, Audit, Hồ sơ. Top bar chuẩn: title + back trái + action phải. Dialog/bottom-sheet chỉ chồng **một cấp**, không hai.

→ Composition reference: `mockups/all-screens.html`. Spine thắng khi mâu thuẫn.

## Voice and Tone

Microcopy tiếng Việt: **ngắn gọn, minh bạch, không hô hào**. Nhãn micro in hoa (định danh), nội dung câu hoàn chỉnh. Brand voice + aesthetic sống ở `DESIGN.md`.

| Nên | Không nên |
|---|---|
| "Chốt đơn" · "Ghi nhận thanh toán" | "Xác nhận thành công! 🎉" |
| "Đã cọc" (chip trạng thái) | "Trạng thái đã được cập nhật" |
| "Không đủ tồn — không thể xuất quá số tồn hiện có." | "Lỗi" / "Error 400" |
| "Chưa có đơn nào. Bấm ➕Tạo để bắt đầu." | "Danh sách trống. Vui lòng thêm dữ liệu!" |
| "SĐT chưa có trong hệ thống." + nút "Tạo khách hàng mới" | "Không tìm thấy kết quả" |
| Con số + động từ: "3 đơn chờ duyệt chiết khấu". | Câu cảm thán, streak, huy hiệu, động viên. |

Nhãn Trạng thái là **danh từ nghiệp vụ verbatim theo Glossary**: Báo giá · Chờ duyệt chiết khấu · Đã chốt · Đã cọc · Lên lịch thi công · Đang thi công · Nghiệm thu · Đang giao hàng · Đã giao · Hoàn thành · Huỷ.

## Component Patterns

Chỉ hành vi. Spec thị giác + token ở `DESIGN.md.Components`.

| Component | Dùng ở | Quy tắc hành vi |
|---|---|---|
| **Dòng giỏ hàng (cart line item)** | Báo giá | Sửa số lượng/đơn giá → tổng recalc ngay, không lưu thủ công (FR-1). Dòng pick từ Sản phẩm auto-điền đơn giá theo Danh mục hiện tại; Dòng tự do/gói nhập tay. Cờ "linh động/dự kiến" chỉ hiển thị, không đổi cách tính (FR-1). Swipe/nút xoá dòng. |
| **Status chip** | Danh sách đơn, Chi tiết đơn, Dashboard | Một chip = một Trạng thái, dùng bộ token màu riêng ({chip.baogia}, {chip.dachot}, {chip.dacoc}, {chip.thicong}, {chip.nghiemthu}, {chip.danggiao}, {chip.hoanthanh}, {chip.huy}). Chỉ đọc — không bấm để đổi; đổi trạng thái qua màn riêng. |
| **Stepper trạng thái** | Chi tiết đơn, Chuyển trạng thái | Hiển thị chuỗi bước **gate theo Cờ phạm vi** (FR-7): bước không áp dụng bị ẩn hẳn, không disable xám. Bước hiện tại nổi bật {colors.teal}; bước đã qua có tick; bước tới mờ. |
| **Ma trận quyền (permission matrix)** | Phân quyền | Lưới Quyền × checkbox trên một Account. Nút "Áp preset Role" nạp giá trị rồi cho tick/bỏ từng ô (FR-17). Nguồn chân lý = bộ Quyền trên Account, không phải Role. |
| **Bộ lọc (filters)** | Danh sách đơn, Khách, Kho, Audit | Lọc theo Trạng thái / mốc thời gian; chip filter bật/tắt. "Xem tất cả đơn" vs "chỉ đơn của mình" phụ thuộc Quyền, không phải filter (FR-18). |
| **Bottom sheet vs Dialog** | Toàn hệ | Bottom sheet (mobile) cho lựa chọn nhanh/native share. Dialog (web + mobile) cho hành động cần xác nhận có hệ quả tiền/dữ liệu (Chốt, Huỷ, Duyệt, ghi thanh toán). Chồng tối đa một cấp. |
| **Share sheet** | Chia sẻ báo giá | Native share sheet của hệ thống (FR-21), ưu tiên **hình ảnh** báo giá, hoặc PDF. Web: share/download tương tự. |
| **Upload ảnh** | Chuyển trạng thái, Chi tiết đơn | Mobile chụp trực tiếp/chọn thư viện; web chọn file. Luôn **optional** ở mọi bước (FR-23). |

## State Patterns

### Máy trạng thái Đơn (Hybrid — gate theo Cờ phạm vi)

Đơn là **một** đối tượng đi qua chuỗi Trạng thái; các bước **Thi công** và **Vận chuyển** chỉ xuất hiện khi Cờ phạm vi tương ứng bật (FR-7). Cờ **Thiết bị** luôn bật (mọi đơn có vật tư).

```
Khảo sát / Báo giá (nháp)
  → [nếu có chiết khấu] Chờ duyệt chiết khấu → (duyệt) →
Đã chốt  ── Chốt: snapshot giá mọi Dòng (FR-5) ──
  → Đã cọc            (auto khi ghi nhận đủ đợt cọc đầu — FR-8)
  → [cờ Thi công]  Lên lịch thi công → Đang thi công → Nghiệm thu
  → [cờ Vận chuyển] Đang giao hàng → Đã giao
Hoàn thành           (thanh toán đủ + nghiệm thu/đã giao xong)
Huỷ                  (có thể từ nhiều trạng thái, kèm lý do)
```

- **Đơn chỉ Thiết bị** (Thương mại mặc định): Báo giá → Đã chốt → (thanh toán) → Hoàn thành. Không có bước thi công/giao hàng.
- **Đơn Cá nhân** (mặc định bật cả 3 cờ): đi trọn chuỗi.
- **Auto-transition theo sự kiện nghiệp vụ (FR-8):** ghi nhận đủ đợt cọc đầu → Đơn **tự** sang "Đã cọc", không ai bấm chuyển trạng thái riêng. Mapping đợt→trạng thái cấu hình theo Lịch thanh toán.
- **Manual + duyệt (FR-9):** các bước cần thao tác người chỉ mở cho Account có Quyền tương ứng; chiết khấu cần Duyệt. Mọi chuyển trạng thái ghi Audit (ai, khi nào, từ→đến).
- **Sửa đơn đã chốt (FR-6):** sinh **bản update mới** (không ghi đè), snapshot lại giá, giữ lịch sử; bản mới nhất là bản hiệu lực.

### State cho danh sách & màn

| State | Bề mặt | Xử lý |
|---|---|---|
| Loading | Mọi list (Đơn, Khách, Kho, Audit) | Skeleton rows khớp layout dự kiến; "Đang tải…" khi cần. |
| Empty | Danh sách đơn / Khách / Danh mục / Phiếu kho | Câu Việt ngắn + hành động chính: "Chưa có đơn nào. Bấm ➕Tạo để bắt đầu." Không gợi ý thừa. |
| Search rỗng (SĐT) | Chọn / Tạo khách | "SĐT chưa có trong hệ thống." + nút **"Tạo khách hàng mới"** ngay tại chỗ (FR-29). |
| Error | Toàn hệ (online-only) | Thông báo cụ thể + "Thử lại". Thao tác tiền idempotent, không mất dữ liệu (NFR). |
| Confirm | Chốt / Huỷ / Duyệt / Ghi thanh toán / Xoá | Dialog xác nhận có hệ quả; nêu rõ hậu quả (vd "Chốt sẽ đóng băng giá"). |
| Chặn tồn | Phiếu xuất kho | Tồn không đủ → **cảnh báo và CHẶN**, không cho xuất quá tồn (FR-26). |

## Interaction Primitives

- **Recalc tổng realtime** — thêm/bớt/sửa Dòng giỏ hàng cập nhật ngay Tổng trước VAT / Tiền VAT / Tổng sau VAT (FR-1, FR-3); tick VAT có/không đổi kết quả tức thì.
- **Tra SĐT → chọn/tạo khách** — nhập SĐT trong luồng tạo đơn: trùng → điền sẵn khách cũ; không thấy → "Tạo khách hàng mới" tại màn (FR-29). Một SĐT = một Khách hàng (chặn trùng).
- **Chốt + snapshot** — bấm Chốt: Đơn → "Đã chốt", đơn giá mọi Dòng đóng băng (FR-5); sửa Danh mục sau đó không hồi tố.
- **Upload ảnh optional per transition** — mỗi lần chuyển trạng thái đính kèm ≥0 ảnh làm bằng chứng bước đó (FR-23); ảnh vào Audit; không bước nào bắt buộc ảnh.
- **Versioning + lịch sử** — sửa đơn đã chốt sinh bản update mới, xem lại được bản nào/ai/khi nào/đổi gì (FR-6).
- **Tap để hành động** (mobile); **click để hành động** + hover lộ quick-action (web). Long-press dành cho chọn text hệ thống.
- **Banned:** đổi trạng thái bằng cách bấm thẳng chip; hạn mức chiết khấu tự quyết (mọi chiết khấu phải Duyệt); bỏ qua bước audit để chạy nhanh (SM-C1 = 0 bước bị bỏ).

## Accessibility Floor

Hành vi; contrast cụ thể ở `DESIGN.md`.

- **Touch target ≥ 48dp** (Android/Flutter) / ≥ 44pt — dùng được bằng ngón tay ngoài hiện trường, kể cả khi đeo găng/thao tác nhanh trên mái nhà.
- **Contrast cho ngoài trời** — nhãn, tổng tiền, nút Chốt phải đọc được dưới nắng; token màu {colors.ink} trên {colors.surface} giữ tỉ lệ AA; chip trạng thái không chỉ dựa vào màu (kèm nhãn chữ).
- **Keyboard trên web** — Tab theo thứ tự đọc; Esc đóng dialog/sheet trên cùng; form thao tác được toàn bằng bàn phím.
- **Form labels** — mọi trường (SĐT, số lượng, đơn giá, mức chiết khấu, lý do huỷ) có nhãn rõ + role/state cho screen reader; nút icon-only (share, back, FAB) có `aria-label`.
- Số tiền/VAT đọc được đầy đủ, không bị cắt ở cỡ chữ lớn.

## Phân quyền hiển thị theo quyền

UI **ẩn/hiện chức năng theo Quyền hiệu lực của Account** (FR-22), không disable xám gây rối:

- Thợ khảo sát chỉ thấy: tạo/sửa báo giá, Chốt, áp chiết khấu, đơn của mình, quản lý khách, sinh hợp đồng. Không thấy Dashboard tài chính, Phân quyền, Audit.
- "Xem tất cả đơn" vs "chỉ đơn của mình" quyết định phạm vi Danh sách đơn — là một Quyền trong ma trận (FR-18).
- **Duyệt chiết khấu, ghi thanh toán, nhập/xuất kho, chuyển bước thi công/giao hàng** chỉ hiện cho Account có Quyền tương ứng (ma trận §4.6 PRD).
- **Audit log** chỉ **Super Admin** (một Account Admin được chỉ định) — sidebar/menu ẩn mục này với mọi người khác (FR-20).
- Bề mặt bị cấm không dựng "màn chặn" — đơn giản không xuất hiện trong nav.

## Key Flows

### Flow 1 — Hùng báo giá & chốt tại hiện trường (UJ-1)

Thợ khảo sát Hùng đứng trên mái nhà khách cá nhân muốn lắp ~8 kWp.

1. Bấm FAB **➕Tạo** → màn Báo giá / Giỏ hàng.
2. Nhập SĐT khách → không thấy → "Tạo khách hàng mới" → chọn Loại khách **Cá nhân** → tự bật cả 3 Cờ (Thiết bị, Thi công, Vận chuyển).
3. Thêm từng Dòng từ Danh mục (pin, inverter, battery, gói vật tư, dây, công lắp) + 1 Dòng tự do ghi chú → Tổng + VAT nhảy realtime.
4. **Climax:** đưa màn giỏ hàng cho khách xem, khách gật → Hùng bấm **Chốt** → dialog xác nhận → giá đóng băng (snapshot) → bấm **Share** → native sheet gửi **hình ảnh** báo giá qua Zalo.
5. Đơn → "Đã chốt", vào Danh sách đơn.
- **Edge:** khách xin giảm → Hùng áp chiết khấu → Đơn → "Chờ duyệt chiết khấu", gọi nhắc sếp duyệt.
- **Failure:** mất mạng (online-only) → thông báo cụ thể + "Thử lại"; không mất dòng đã nhập.

### Flow 2 — Lan ghi cọc, trạng thái tự nhảy (UJ-2)

Kế toán Lan tại văn phòng thấy tiền cọc đợt 1 về tài khoản.

1. Mở đơn đã chốt (web) → màn Thanh toán → Lịch thanh toán (vd 20/70/10).
2. Ghi nhận **đợt 1** theo lịch.
3. **Climax:** hệ thống **tự** chuyển Đơn sang "Đã cọc" — Lan không phải bấm chuyển trạng thái riêng; status chip đổi ngay; Audit ghi lại (FR-8).
4. Đơn sẵn sàng cho đội thi công lên lịch.
- **Failure:** tổng các đợt lệch tổng sau VAT → cảnh báo trước khi lưu (FR-11).

### Flow 3 — Tú cấp quyền cho thợ mới (UJ-3)

Admin Tú tạo tài khoản cho thợ khảo sát mới.

1. Phân quyền → **Tạo account** → nhập thông tin.
2. Bấm áp **preset Role "Thợ khảo sát"** → ma trận nạp sẵn bộ Quyền mặc định.
3. Bỏ tick "Xem tất cả đơn", giữ "Xem đơn của mình" → Lưu (nguồn chân lý = bộ Quyền trên Account).
4. **Climax:** thợ mới đăng nhập chỉ thấy đúng chức năng của mình — không Dashboard tài chính, không Audit, không rối. Sửa quyền account này không đụng account khác cùng Role (FR-17).
