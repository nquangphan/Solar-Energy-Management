---
title: "Product Brief — App quản lý nội bộ công ty NLMT Phương Nam (Phase 1)"
status: ready
created: 2026-07-06
updated: 2026-07-06
---

# Product Brief: App quản lý nội bộ Phương Nam Solar (Phase 1)

## Tóm tắt điều hành

Phương Nam Solar là công ty bán và thi công lắp đặt hệ thống điện mặt trời. Hiện toàn bộ khâu báo giá và quản lý đơn chạy bằng Excel và thao tác tay: một báo giá có khi mất tới **2 ngày** mới tới tay khách, vì nhân viên phải quay về văn phòng, mở file, tra vật tư, điền giá rồi căn chỉnh. Chủ doanh nghiệp nhận thấy cách làm thủ công này bắt đầu rườm rà và kém hiệu quả khi quy mô tăng.

Phase 1 xây một **app quản lý nội bộ (Web + Mobile)** thay thế quy trình Excel, với trái tim là màn **báo giá-kiêm-đơn-hàng kiểu giỏ hàng**: thợ khảo sát ngồi cùng khách tại hiện trường, chọn từng món, tổng tiền nhảy theo thời gian thực, khách gật là chốt và chia sẻ báo giá ngay tại chỗ. Kèm theo là danh mục vật tư – giá tập trung, phân quyền theo từng tài khoản, dashboard cho chủ và nhật ký thao tác (audit log).

Thesis xuyên suốt: **app là "máy tăng tốc — không ai phải chờ ai nữa"**, không phải hệ thống kiểm soát. Mọi tính năng phục vụ hai mục tiêu ngang hàng: **nhanh** (báo giá tại hiện trường trong vài phút thay vì 2 ngày) và **chính xác** (chống báo giá nhầm).

## Vấn đề

- **Báo giá chậm:** quy trình hiện tại buộc nhân viên về văn phòng, mở Excel, tra đúng vật tư và điền giá tay — mất tới 2 ngày cho một báo giá. Khách nguội, cơ hội chốt rơi rụng.
- **Thông tin nghẽn:** ai muốn biết trạng thái đơn, tình hình tài chính đều phải đi hỏi người khác; không tự tra được.
- **Dễ sai:** ráp báo giá tay dễ nhầm món, nhầm số lượng, hoặc lấy giá cũ đã lỗi thời trong Excel.
- **Không có dấu vết:** thay đổi trên file tay không lưu lại ai sửa gì, khi nào.

## Giải pháp

Một app nội bộ Web + Mobile số hoá toàn bộ vòng đời từ **báo giá → đơn hàng → thi công/giao hàng → thanh toán**, trong đó:

- **Báo giá-kiêm-đơn** kiểu giỏ hàng: chọn từng món từ danh mục (kèm dòng tự do/gói và ghi chú), tổng + VAT tính realtime, đưa màn cho khách xem, bấm **Chốt** để đóng băng giá và xuất/chia sẻ (ưu tiên hình ảnh qua khay chia sẻ hệ thống).
- **Một đối tượng duy nhất** cho báo giá và đơn, phân biệt bằng **trạng thái**; luồng trạng thái tự thích ứng theo **cờ phạm vi** của từng đơn (Thiết bị / Thi công / Vận chuyển).
- **Danh mục vật tư – giá tập trung**, cập nhật một chỗ, chốt là snapshot giá vào đơn.
- **Phân quyền theo từng tài khoản** (role chỉ là preset), **dashboard** doanh thu/đơn cho chủ, và **audit log** mọi thao tác.

## Điểm khác biệt

Đây là công cụ nội bộ đo ni đóng giày cho đúng quy trình của Phương Nam — lợi thế không nằm ở "công nghệ độc quyền" mà ở **độ khớp với cách công ty thực sự bán hàng** và ở **tốc độ thực thi**. Ba lựa chọn thiết kế tạo khác biệt so với việc mua một phần mềm quản lý đơn thông thường:

- **Báo giá tại hiện trường, chốt tại chỗ** — biến báo giá từ tài liệu hậu-văn-phòng thành công cụ chốt sale trước mặt khách.
- **Mô hình một-đối-tượng đổi-trạng-thái** — báo giá và đơn không tách rời, theo dõi liền mạch.
- **Bất biến sau khi chốt + để lại dấu vết** — snapshot giá, audit log, sửa-là-tạo-version: minh bạch, không hồi tố.

## Đối tượng phục vụ

Nội bộ ~20 người, 6 vai trò (dùng làm preset quyền):

- **Thợ khảo sát** — *người dùng chính của báo giá*; dựng giỏ hàng cùng khách tại hiện trường trên mobile.
- **Đội thi công** — nhận đơn đã chốt, cập nhật tiến độ thi công/nghiệm thu.
- **Kế toán** — ghi nhận cọc/thanh toán, xem tài chính.
- **Kho / Giao hàng** — xuất vật tư, giao cho khách bỏ mối.
- **Quản lý / Chủ** — duyệt chiết khấu, xem dashboard toàn cảnh.
- **Admin** — tạo tài khoản, cấu hình phân quyền.

## Tiêu chí thành công

Ưu tiên số một của khách: **hệ thống chạy đáng tin cậy** — mọi dữ liệu gửi đi chính xác, mọi luồng nghiệp vụ chạy trơn tru, không lỗi. Đây là thước đo nghiệm thu cốt lõi của Phase 1.

Các chỉ số kết quả mục tiêu:

- Thời gian ra một báo giá: từ ~2 ngày xuống **trong buổi khảo sát (vài phút)**.
- Tỉ lệ báo giá sai (nhầm món/số lượng/giá) tiến về **~0** nhờ giá tập trung + snapshot.
- **20/20 nhân viên** dùng app thay cho Excel cho toàn bộ báo giá mới.

## Phạm vi

**Trong Phase 1** (9 nhóm — chi tiết ở `phase-1-feature-list.md`):
báo giá-kiêm-đơn (giỏ hàng, dòng tự do/gói, VAT, cờ phạm vi, xuất/chia sẻ) · vòng đời & trạng thái Hybrid · lịch thanh toán nhiều đợt · sinh hợp đồng (Thi công / Mua bán) · danh mục vật tư & giá (snapshot lúc chốt) · phân quyền per-account · dashboard · audit log · nền tảng Web + Mobile.

**Ngoài phạm vi Phase 1 (để Phase sau):**

- Cổng tự đặt hàng cho đại lý bỏ mối (khách chưa có tài khoản trong Phase 1).
- Hạn mức chiết khấu tự quyết (Phase 1: mọi chiết khấu do chủ duyệt).
- CRM đầy đủ (Phase 1 chỉ có mầm: danh sách follow-up lead nguội).

## Ràng buộc kỹ thuật

- **Web:** ReactJS. **Mobile:** Flutter (Clean Architecture + BLoC).
- **Design system dùng chung** giữa web và mobile để UI đồng nhất.
- **Backend:** NodeJS. **Hạ tầng:** VPS. **Quy mô:** ~20 người dùng nội bộ.

## Tầm nhìn

Phase 1 dựng xương sống vận hành (báo giá → đơn → thi công/giao → thanh toán, minh bạch và để lại dấu vết). Khi vững, mở ra: **cổng tự phục vụ cho đại lý** (tự đặt hàng, xem giá sỉ), và **CRM đầy đủ** nuôi từ mầm follow-up — biến công cụ nội bộ thành nền tảng bán hàng có khách hàng tham gia trực tiếp.
