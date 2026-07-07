# Danh sách tính năng Phase 1 — App quản lý công ty NLMT

Nguồn: phiên brainstorm `brainstorm-solar-company-mgmt-phase1-2026-07-03`. Dùng cho ước lượng & lập kế hoạch. Ngôn ngữ: Tiếng Việt.

Triết lý xuyên suốt: app là "máy tăng tốc, không ai phải chờ ai" — self-serve, minh bạch, bất biến sau chốt và để lại dấu vết mọi thay đổi. Phân quyền phục vụ tốc độ và chống thao tác nhầm, không phải để giấu thông tin.

## 1. Báo giá & Đơn hàng

- [ ] Giỏ hàng báo giá realtime: cột tên SP / số lượng / đơn giá / thành tiền; thêm/bớt món thì tổng nhảy ngay.
- [ ] Thêm dòng theo SKU nguyên tử (pick từ danh mục vật tư).
- [ ] Thêm dòng tự do / dòng dạng GÓI mô tả nhiều dòng (không bắt buộc pick SKU).
- [ ] Cột "Diễn giải" cho từng dòng (bảo hành / ghi chú); đánh dấu dòng "linh động" / "dự kiến".
- [ ] Bộ cờ phạm vi trên mỗi đơn: Cung cấp Thiết bị / Thi công / Vận chuyển (checkbox bật-tắt).
- [ ] Trường Công suất kWp cho công trình.
- [ ] Metadata hiệu lực báo giá (thời hạn hiệu lực) và loại khách.
- [ ] Tính VAT: thuế suất (vd 8%) + hiển thị Tổng trước VAT / Tiền thuế VAT / Tổng sau VAT.
- [ ] Nút "Chốt": chuyển báo giá thành đơn đã chốt (đổi trạng thái, đóng băng giá).
- [ ] Xuất PDF báo giá; nút Share dùng native share bottom sheet của hệ thống, ưu tiên chia sẻ HÌNH ẢNH báo giá (hoặc PDF). Web hành xử tương tự.
- [ ] Mở lại đơn đã chốt để chỉnh sửa → tạo BẢN VERSION mới (không sửa đè), snapshot giá lại khi chốt lại.

## 2. Vòng đời & Trạng thái đơn

- [ ] Mô hình 1-object: báo giá và đơn hàng là cùng một đối tượng, khác nhau ở trạng thái.
- [ ] Hybrid scope-flags: luồng trạng thái GATE theo 3 cờ phạm vi của đơn.
- [ ] Bước KHẢO SÁT chỉ xuất hiện / gate theo cờ Thi công.
- [ ] Trạng thái tự nhảy theo sự kiện nghiệp vụ (vd kế toán ghi nhận cọc → tự sang "Đã cọc"); một số bước cần người bấm + duyệt.
- [ ] Loại khách (Cá nhân / Thương mại) = preset set cờ mặc định + nhãn cho báo cáo; vẫn sửa cờ từng đơn được.

## 3. Thanh toán

- [ ] Lịch thanh toán NHIỀU ĐỢT cấu hình được (vd lắp đặt 20/70/10; thương mại 100% trước xuất kho; hoặc tùy đàm phán).
- [ ] Ghi nhận cọc / thanh toán từng đợt → tự động chuyển trạng thái đơn tương ứng.

## 4. Sinh hợp đồng

- [ ] Sinh Hợp đồng Thi công từ đơn.
- [ ] Sinh Hợp đồng Mua bán từ đơn.
- [ ] Hợp đồng tham chiếu số Báo giá của đơn.

## 5. Danh mục vật tư & Giá

- [ ] CRUD sản phẩm & giá bất kỳ lúc nào (không cố định lịch cập nhật); giá cập nhật tập trung.
- [ ] Giá phân tầng lẻ / sỉ: code sẵn nhưng ẩn sau 1 cờ bật/tắt, mặc định TẮT.
- [ ] Trước chốt: giỏ hàng ăn theo giá mới nhất trong danh mục.
- [ ] Snapshot giá vào line item tại thời điểm bấm CHỐT; sửa danh mục sau đó không hồi tố lên đơn đã chốt.

## 6. Phân quyền & Tài khoản

- [ ] Ma trận quyền theo TỪNG ACCOUNT (account là nguồn chân lý quyền).
- [ ] Role preset (Thợ khảo sát, Đội thi công, Kế toán, Kho/Giao hàng, Quản lý/Sếp, Admin) = nút áp bộ quyền DEFAULT khi tạo account; chỉnh thêm/bớt từng quyền sau đó.
- [ ] Màn phân quyền: chọn account → checklist quyền tick/bỏ tick + nút áp preset role.
- [ ] Quyền bấm chuyển từng trạng thái — config được, không hardcode.
- [ ] Quyền DUYỆT trong luồng — config được.
- [ ] Quyền "xem tất cả đơn" vs "chỉ xem đơn của mình" — là 1 quyền trong ma trận.
- [ ] Quyền duyệt CHIẾT KHẤU: mọi chiết khấu cần sếp duyệt (không có hạn mức tự quyết trong Phase 1).

## 7. Dashboard & Báo cáo

- [ ] Doanh thu theo NGÀY / TUẦN / THÁNG.
- [ ] Số lượng đơn hàng.
- [ ] Tổng hợp đơn theo TRẠNG THÁI.

## 8. Hệ thống

- [ ] Audit log mọi hành động (ai làm gì, lúc nào) — làm bằng chứng cho ai chuyển/duyệt trạng thái nào và ai sửa/đổi gì.
- [ ] Hai bản: WEB + MOBILE (mobile cho sale/thợ dùng tại hiện trường trên điện thoại/iPad).
- [ ] Danh sách FOLLOW-UP: báo giá chưa chốt (lead nguội) giữ ở trạng thái "Báo giá" để không rơi rụng.

## Phase sau (parked)

- Cổng tự đặt hàng cho đại lý bỏ mối (khách tự dựng giỏ, xem giá sỉ, gửi đơn, công ty duyệt & giao).
- Hạn mức chiết khấu tự quyết (không cần sếp duyệt trong ngưỡng).
- CRM đầy đủ (mở rộng từ mầm follow-up lead nguội).
