# Brainstorm Intent — App quản lý công ty NLMT (Phase 1)

## Bối cảnh & mục tiêu
- App NỘI BỘ công ty bán + thi công lắp pin NLMT. Phase 1.
- Thesis xuyên suốt: "máy tăng tốc — không ai phải chờ ai" (KHÔNG phải hệ kiểm soát/bảo mật).
- Nỗi đau gốc: thông tin nghẽn, phải hỏi người khác mới biết; báo giá hiện mất tới 2 ngày (Excel khoá ở VP + ráp tay) — delay nhân tạo.
- Mục tiêu kép ngang hàng: NHANH (báo giá tại hiện trường trên điện thoại, vài phút) + CHÍNH XÁC (chống báo giá nhầm).
- Phân quyền = "đúng người đúng việc / bớt rối / chống thao tác nhầm", KHÔNG vì giấu thông tin (mọi thứ đã minh bạch).

## Người dùng & vai trò (6 role preset)
Thợ khảo sát · Đội thi công · Kế toán · Kho/Giao hàng · Quản lý/Sếp · Admin.
- Thợ khảo sát = user chính của báo giá, chọn từng món cùng khách tại hiện trường.

## Phạm vi Phase 1 (module chốt)
1. **Báo giá-kiêm-đơn**: giỏ hàng (tên SP / SL / đơn giá / thành tiền / tổng realtime); chọn TỪNG món (BOM builder, KHÔNG default combo — tránh sai); dòng TỰ DO/gói mô tả nhiều dòng + ghi chú/diễn giải (bảo hành); VAT (Tổng trước VAT / Thuế / Tổng sau VAT); bộ CỜ phạm vi (Thiết bị / Thi công / Vận chuyển) + công suất kWp; metadata hiệu lực + loại khách. Đưa màn cho khách coi trực tiếp.
2. **Đơn hàng 1-object**: báo giá & đơn = cùng object khác TRẠNG THÁI; "Chốt" = 1 chuyển trạng thái. Status gate theo CỜ (Hybrid); bước KHẢO SÁT gate theo cờ Thi công. Status TỰ NHẢY theo sự kiện nghiệp vụ (VD kế toán ghi cọc → "Đã cọc"), vài bước cần người + duyệt. Đơn đã chốt sửa → MỞ LẠI tạo bản version mới (không sửa đè), snapshot giá lại khi chốt lại. Báo giá chưa chốt giữ ở danh sách FOLLOW-UP (mầm CRM sau).
3. **Lịch thanh toán nhiều đợt**: cấu hình được (VD lắp đặt 20/70/10; thương mại 100% trước xuất kho; hoặc tùy đàm phán). "Đặt cọc" là 1 đợt trong lịch, KHÔNG phải 1 trạng thái.
4. **Sinh hợp đồng** từ đơn: HĐ Thi công / HĐ Mua bán, tham chiếu số BG.
5. **Danh mục vật tư**: thêm/xoá/sửa SP & giá bất kỳ lúc nào (không cố định lịch); giỏ lấy giá mới nhất. Giá PHÂN TẦNG (lẻ/sỉ) code sẵn nhưng ẩn sau 1 CỜ, mặc định tắt. Snapshot giá vào line item lúc CHỐT.
6. **Phân quyền per-account**: nguồn chân lý = bộ quyền của TỪNG account; role chỉ là nút áp preset default lúc tạo. Màn: chọn account → checklist quyền tick/bỏ + áp preset role. Quyền chuyển trạng thái & quyền DUYỆT đều config được (không hardcode). "Xem đơn của mình vs xem tất cả" là 1 quyền trong ma trận. Mọi chiết khấu cần sếp duyệt.
7. **Dashboard** (sếp): doanh thu theo ngày/tuần/tháng; số lượng đơn; tổng hợp đơn theo trạng thái.
8. **Audit log**: mọi hành động (ai làm gì, lúc nào) — bằng chứng ai chuyển/duyệt trạng thái, hợp văn hoá minh bạch.
9. **Nền tảng**: Web + Mobile (mobile cho sale/thợ tại hiện trường). Xuất PDF khi chốt + nút SHARE, ưu tiên HÌNH ẢNH báo giá qua NATIVE share bottom sheet.

## Quyết định kiến trúc chốt
- **Unified quote-order object**: báo giá & đơn cùng object, status là xương sống nối báo giá ↔ theo dõi.
- **Hybrid scope-flags**: cờ Thiết bị/Thi công/Vận chuyển từng đơn quyết định luồng (không phải loại khách); loại khách = preset cờ + nhãn báo cáo, vẫn sửa được.
- **Permission per-account**: linh hoạt thêm/bớt từng quyền; role = preset cho nhanh.
- **Price snapshot lúc chốt**: trước chốt ăn giá mới nhất, sau chốt khoá — tránh sửa giá hồi tố lên đơn đã gửi.
- **Bất biến sau chốt + audit**: snapshot + audit log + reopen-có-version = một triết lý "sau chốt mọi thay đổi để lại dấu vết".

## Ngoài phạm vi / Phase sau (parked)
- Cổng tự đặt hàng cho đại lý bỏ mối (khách tự dựng giỏ, xem giá sỉ, gửi đơn, cty duyệt & giao).
- Hạn mức chiết khấu tự quyết (giữ đơn giản: mọi chiết khấu sếp duyệt; sale gọi ĐT nhắc).
- CRM đầy đủ (chỉ có mầm follow-up lead nguội ở Phase 1).

## Câu hỏi còn mở
Không còn — cả 2 câu hỏi phát sinh (quyền xem của-mình/tất-cả; contract generation) đều đã chốt trong session.
