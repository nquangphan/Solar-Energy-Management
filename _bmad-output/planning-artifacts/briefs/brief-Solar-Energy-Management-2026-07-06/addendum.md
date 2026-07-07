# Addendum — Chiều sâu cho PRD / Architecture

Phần này giữ các quyết định kiến trúc và ngữ cảnh không đưa vào brief (để brief gọn 1–2 trang), nhưng cần cho PRD và thiết kế kiến trúc kế tiếp. Nguồn: phiên brainstorm 2026-07-03 + đối chiếu 2 bộ hợp đồng/báo giá mẫu thật.

## Quyết định kiến trúc chốt (kèm lý do)

- **Unified quote-order object** — báo giá và đơn là cùng một đối tượng, khác `status`. "Chốt" chỉ là một chuyển trạng thái. *Lý do:* theo dõi liền mạch báo giá ↔ đơn, không nhân đôi dữ liệu.
- **Hybrid scope-flags** — mỗi đơn có 3 cờ độc lập: **Thiết bị / Thi công / Vận chuyển**. Luồng trạng thái **gate theo cờ** (bước Khảo sát chỉ có khi bật cờ Thi công; bước Giao hàng khi bật Vận chuyển). Loại khách (Cá nhân / Thương mại) = **preset bộ cờ mặc định + nhãn báo cáo**, vẫn sửa cờ từng đơn. *Lý do:* khớp mẫu thật (báo giá có checkbox phạm vi), xử được đơn lai, thêm dịch vụ = thêm cờ. *(Đã cân nhắc và loại: A = enum loại khách cứng — quá cứng với đơn lai; B = cờ thuần không có preset — dễ tick sai, mất nhãn báo cáo.)*
- **Status tự nhảy theo sự kiện** — trạng thái đổi như hệ quả của hành động nghiệp vụ được phép (VD kế toán ghi nhận cọc → tự sang "Đã cọc"), không phải nút "chuyển trạng thái" rời. Một số bước vẫn cần người + duyệt.
- **Permission per-account** — nguồn chân lý = bộ quyền của **từng account**; role là nút áp **preset default** lúc tạo. Quyền chuyển trạng thái và quyền **duyệt** đều config được (không hardcode). "Xem tất cả đơn" vs "xem của mình" là một ô quyền trong ma trận. *Lý do:* linh hoạt cho ngoại lệ per-user; phân quyền để tăng tốc và chống thao tác nhầm, không vì bảo mật (nội bộ đã minh bạch).
- **Price snapshot lúc chốt** — trước chốt giỏ ăn giá mới nhất trong danh mục; bấm Chốt thì snapshot giá vào từng line item. *Lý do:* sửa giá danh mục về sau không hồi tố lên đơn/báo giá đã gửi.
- **Bất biến sau chốt + audit** — snapshot giá + audit log mọi thao tác + sửa-đơn-đã-chốt-tạo-version-mới = một triết lý "sau khi chốt, mọi thay đổi phải để lại dấu vết".
- **Giá phân tầng sau cờ** — giá lẻ/sỉ code sẵn nhưng ẩn sau 1 feature flag, mặc định TẮT. *Lý do:* chưa chắc dùng nhưng hợp lý; làm sẵn để khỏi sửa cấu trúc sau, chi phí gần 0.
- **Lịch thanh toán nhiều đợt** — cấu hình được (VD lắp đặt 20/70/10 theo mốc; thương mại 100% trước xuất kho; hoặc "tùy đàm phán"). "Đặt cọc" là một đợt trong lịch, không phải một trạng thái.

## Đối chiếu mẫu thật (2 bộ tài liệu công ty)

Cả hai template báo giá đều mang tiêu đề **"BÁO GIÁ KIÊM ĐƠN ĐẶT HÀNG"** → xác nhận mô hình một-đối-tượng. Dùng chung một mẫu cho cả cá nhân lẫn thương mại. Các chi tiết mẫu thật bổ sung vào Phase 1:

- Cột báo giá: STT / Tên hàng / ĐVT / Số lượng / Đơn giá / Thành tiền / **Diễn giải** (ghi chú bảo hành).
- Có dòng dạng **GÓI** (mô tả nhiều dòng) và dòng đánh dấu "linh động theo dự án" / "dự kiến".
- Bộ **checkbox phạm vi** (Cung cấp thiết bị / thi công / vận chuyển) + trường **Công suất kWp**.
- **VAT 8%**: Tổng trước VAT / Thuế VAT / Tổng sau VAT.
- Trường **Hiệu lực báo giá** (VD "48h kể từ ngày lên PO").
- Loại khách: **cá nhân (CCCD)** vs **công ty (MST + tài khoản NH)**.
- **Hai loại hợp đồng** sinh từ đơn: HĐ Thi công (thanh toán theo đợt, bảo hành công trình 12 tháng) và HĐ Mua bán (100% trước xuất kho, giao tại kho). Cả hai tham chiếu số báo giá (BG…).
- Chân trang: khối ký "Người lập phiếu" + "Giám đốc (ký, đóng dấu)" + logo hãng phân phối.

## Ngữ cảnh dự án

- Đây là dự án **khách đặt hàng** (Phương Nam Solar là khách; đội phát triển là bên làm).
- Động lực: chủ doanh nghiệp thấy quy trình thủ công (Excel/tay) rườm rà, kém hiệu quả khi quy mô tăng.

## Cần chốt thêm (đưa vào PRD)

- Con số cụ thể cho tiêu chí thành công (thời gian báo giá mục tiêu, tỉ lệ sai, mức adoption).
- Timeline giao Phase 1 và quy mô đội phát triển.
- Danh sách trạng thái đầy đủ + ai/điều-kiện chuyển mỗi bước (state machine chi tiết).
- Bộ quyền đầy đủ (Trục 2 ma trận phân quyền) và preset mặc định từng role.
