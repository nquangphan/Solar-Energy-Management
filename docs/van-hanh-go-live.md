# Vận hành lúc go-live

Các việc phải làm một lần khi đưa app vào dùng thật.

## Gõ phiếu nhập tồn đầu kỳ

**Ai làm:** người có quyền `inventory.manage` (preset Kho/Giao hàng, Quản lý, Admin, Super Admin).

**Khi nào:** ngay lúc go-live, trước khi chốt đơn đầu tiên.

**Làm gì:**

1. Kiểm kho thực tế: đếm mọi sản phẩm còn hàng.
2. Mở **Kho → Phiếu kho → Tạo phiếu**, chọn loại **Nhập**, bấm chip **Tồn đầu kỳ** để điền ghi chú.
3. Thêm một dòng cho mỗi sản phẩm còn hàng: **SL** = số đếm được, **Giá vốn / đv** = giá mua thực tế (số nguyên đồng).
4. **Lưu phiếu.** Hệ thống cộng Tồn thật và đặt giá vốn hiện hành của sản phẩm bằng giá vừa gõ.

Tồn đầu kỳ không có loại phiếu riêng — nó là một phiếu nhập bình thường. Phiếu không sửa/xoá được sau khi lưu; gõ sai thì lập phiếu xuất (hoặc nhập) bù.

**Quên bước này thì sao:** mọi sản phẩm có Tồn thật = 0, không xuất kho được, và đơn không có giá vốn ⇒ báo cáo lợi nhuận tháng đầu rỗng.

## Cấu hình thông tin pháp nhân công ty

**Ai làm:** người có quyền `settings.manage` (preset Admin, Super Admin).

**Khi nào:** ngay lúc go-live, **trước** khi sinh hợp đồng hoặc lập hoá đơn đầu tiên.

**Làm gì:** mở màn **Cấu hình hệ thống**, khung **Thông tin pháp nhân**, điền đủ 7 ô (tên công ty, MST, địa chỉ, người đại diện, chức vụ, điện thoại, tài khoản ngân hàng) rồi bấm **Lưu thông tin pháp nhân**.

**Quên bước này thì sao:** hợp đồng và hoá đơn vẫn tạo được, nhưng các ô của công ty in "Chưa cấu hình". Hợp đồng sinh lại được sau khi điền. **Hoá đơn thì không:** hoá đơn chép thông tin người bán lúc lập và không bao giờ đổi, nên hoá đơn lập trước khi cấu hình sẽ mang ô trống vĩnh viễn.

## Chrome cho máy chủ xuất PDF

Báo giá, hợp đồng và hoá đơn đều render PDF bằng Puppeteer, nên máy chủ phải có Chrome/Chromium. Cài bằng `npx puppeteer browsers install chrome` trong thư mục `backend/`, hoặc trỏ `PUPPETEER_EXECUTABLE_PATH` tới Chrome có sẵn. Chạy trong container/VPS thiếu sandbox thì đặt thêm `PUPPETEER_NO_SANDBOX=1` (xem `backend/.env.example`). Thiếu Chrome thì mọi nút xuất PDF báo lỗi.

## Giá vốn sau go-live

Mỗi phiếu nhập về sau tự tính **bình quân gia quyền** giữa hàng đang có và lô mới, rồi cập nhật giá vốn hiện hành — không phải sửa tay ở danh mục. Phiếu xuất không đổi giá vốn.
