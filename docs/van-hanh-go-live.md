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

## Giá vốn sau go-live

Mỗi phiếu nhập về sau tự tính **bình quân gia quyền** giữa hàng đang có và lô mới, rồi cập nhật giá vốn hiện hành — không phải sửa tay ở danh mục. Phiếu xuất không đổi giá vốn.
