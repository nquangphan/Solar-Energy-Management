# Vận hành lúc go-live

Các việc phải làm một lần khi đưa app vào dùng thật.

## Gán số điện thoại cho mọi account

**Ai làm:** người quản trị có quyền chạy SQL trên DB production (tới khi có form tạo/sửa account của Story 8.3).

**Khi nào:** ngay lúc go-live, **trước** khi phát tài khoản cho nhân viên.

**Làm gì:** đăng nhập dùng **số điện thoại** (không dùng email). Account admin đầu tiên lấy SĐT từ `SEED_ADMIN_PHONE` lúc `npx prisma db seed` (thiếu biến này thì seed bỏ qua admin). Mọi account khác phải có `accounts.phone` dạng E.164 (`+84…`, không trùng nhau) — backend chuẩn hoá số người dùng gõ (`0912…`, `+84 912…`) rồi tra đúng chuỗi E.164 này.

**Quên bước này thì sao:** account không có SĐT **không đăng nhập được** (báo sai thông tin đăng nhập như mọi trường hợp sai khác) và cũng không dùng được Quên mật khẩu.

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

## Web gọi backend

Web đọc địa chỉ backend từ `VITE_API_BASE_URL` lúc **build** (xem `web/.env.example`). Mặc định `/api`: web và backend cùng origin, reverse proxy chuyển `/api/...` sang backend và bỏ tiền tố `/api` (backend không có tiền tố route). Nếu web host ở origin khác thì build web với URL đầy đủ của backend và đặt `CORS_ORIGINS` phía backend bằng đúng origin của web (vd `https://app.example.vn`, nhiều origin cách nhau dấu phẩy — xem `backend/.env.example`). Để trống `CORS_ORIGINS` thì CORS tắt và trình duyệt chặn mọi lời gọi khác origin.

## Mobile gọi backend

App mobile đọc địa chỉ backend lúc **build/run**: `flutter run --dart-define=API_BASE_URL=<URL backend>` (hoặc cùng cờ đó khi build APK). Thiếu cờ thì app hiện "Chưa cấu hình địa chỉ máy chủ" và không gọi mạng. Emulator Android gọi backend trên máy dev qua `http://10.0.2.2:3000`; HTTP thường chỉ được phép ở bản **debug** — bản release phải dùng `https://`. App native không qua CORS nên không cần thêm origin vào `CORS_ORIGINS`.

## Giá vốn sau go-live

Mỗi phiếu nhập về sau tự tính **bình quân gia quyền** giữa hàng đang có và lô mới, rồi cập nhật giá vốn hiện hành — không phải sửa tay ở danh mục. Phiếu xuất không đổi giá vốn.
