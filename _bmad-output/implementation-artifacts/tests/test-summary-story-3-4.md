# Test Automation Summary — Story 3.4 (Tra SĐT chọn/tạo khách inline + Danh sách + Chi tiết)

Ngày: 2026-07-13 · Framework: Jest + supertest (backend) · `node --test` text-guard (design-system) — đều đã có sẵn.

## Kết quả

| | Trước | Sau |
|---|---|---|
| Backend hermetic (`npm test`) | 532 xanh / 42 suite | **544 xanh** (+12) |
| Backend lane DB thật (`npm run test:db`) | 16 xanh | 16 xanh (không đụng) |
| Design-system guard (`npm test`) | 207 xanh | **213 xanh** (+6) |
| Mobile (`flutter analyze` + `flutter test`) | sạch · 132 | sạch · 132 (không đụng) |
| Lint · format · build | xanh | xanh |

**Không sửa một dòng `src/`, `web/`, `mobile/` nào.** Toàn bộ thay đổi nằm trong 3 file test:
`backend/test/customers.e2e.spec.ts` · `backend/test/customers.service.spec.ts` ·
`design-system/screens/customers.test.mjs`.

## Lỗ hổng đã vá (9)

Bộ test của story vốn dày (hội tụ E.164, needle, route-ordering, `where` assert theo payload, lane
DB thật). Chín chỗ dưới đây là những gì **không ai canh** — mỗi cái chứng minh bằng đột biến.

### 🔴 1. AC-6 — guard KHÔNG hề canh việc tách field theo Loại khách

Đây là lỗ hổng nghiêm trọng nhất. AC-6 là **trái tim của màn Chi tiết**: khách `CA_NHAN` **không**
được thấy `MST`/`Tài khoản NH`; khách `THUONG_MAI` **không** được thấy `CCCD`. Guard cũ kiểm nhãn
**có mặt**, không kiểm nhãn **hiện đúng lúc** — nên nó xanh y hệt nếu `CustomerFacts` render cả hai
bộ field cho mọi khách.

Trong thế giới TD-1 (web không có tsc/runtime test), guard **là** bài test duy nhất. Một AC không
được guard canh là một AC **không được kiểm gì cả**.

Test mới: mỗi nhãn độc quyền (`MST`, `CCCD`, `Tài khoản NH`) xuất hiện **đúng một lần** trong khối
fact-list, và nằm trên **nhánh** của phép kiểm `commercial` (hai nền tảng).
Đột biến: bỏ `if (commercial)` trước `Tài khoản NH` (mobile) · đổi `{commercial && (` thành
`{true && (` (web) ⇒ **mỗi cái 1 ĐỎ**. Guard cũ: xanh trơn.

### 🔴 2. AC-4 — "Ghi rõ nguồn" quyết theo **cờ `isOther`** hay theo **tên nguồn**? Không ai hỏi

Story cấm tường minh: *"đọc cờ từ response, **KHÔNG** so tên `'Khác'`"* — vì Story 3.5 cho phép admin
**đổi tên** nguồn, và một luật nghiệp vụ không được sập vì ai đó sửa nhãn. Code làm đúng; **không
test nào giữ nó lại**.

Test mới: không màn nào được chứa literal `'Khác'` (khớp **kèm nháy** — `Khác` là chuỗi con của
`Khách`, và mọi màn đều nói `Khách hàng`; quét trần sẽ false-positive toàn bộ — đúng cái bẫy story
cảnh báo), và fact-list **phải** đọc `isOther`.
Đột biến: `chosenSource?.isOther === true` → `chosenSource?.name === 'Khác'` ⇒ **1 ĐỎ**.

### 🔴 3. AC-6 — field nullable rỗng: `—` hay `null`?

AC đòi hiện `—`. `orDash()` có, nhưng **không test nào** buộc từng field nullable đi qua nó — bỏ
`orDash` cho một field là để chữ `null` hiện ra màn cho người dùng đọc.
Test mới: cả 5 field nullable (`taxCode`/`cccd`/`address`/`bankAccount`/`sourceNote`) + tên nguồn
phải render qua `orDash` trên **cả hai** nền tảng.
Đột biến: bỏ `orDash` khỏi `Địa chỉ` ⇒ **1 ĐỎ**.

### 🔴 4. Guard xanh với một màn dùng **dữ liệu dựng cứng**

Guard cũ chỉ đòi chữ `CustomersPort` **xuất hiện** trong file. Một màn `import` port rồi render mảng
hardcode vẫn **xanh trọn vẹn** — đúng thứ AC-5 cấm ("3 state thật của port, không phải 3 biến thể
dựng cứng").
Test mới: gọi tên **từng lời gọi** bắt buộc — `port.lookup`/`port.create`/`port.listSources` (pick) ·
`port.list` (list) · `port.get`/`port.listSources` (detail), cả hai nền tảng.

### 5. Quyết định #4 (tra khi submit, KHÔNG debounce theo phím) — chốt trong story, không ai canh

Test mới: không màn nào được gọi `lookup` từ `onChange`/`onChanged`; tra cứu phải gắn vào form submit
(web) / nút `Tra cứu` (mobile). Nếu không, một quyết định đã chốt sẽ trôi mất ở story sau mà không ai
biết.

### 6. Điểm nối Epic 4 (`onSelect`) — "API" duy nhất story để lại, không có test

Test mới: khách **vừa tạo** và khách **được chọn** đều phải quay ra qua `onSelect` (hai nền tảng) —
màn không được tự điều hướng tới một đích chưa tồn tại.

### 7. Trần `@MaxLength` của 2 route mới — chưa field nào có test

`sdt` (32) ở lookup · `q` (200) ở list. Đúng bài học HIGH của review 3.2 ("thiếu trần ⇒ tràn"): gỡ
một `@MaxLength` mà không ai đỏ thì cái trần chỉ là bình luận.
Đột biến: gỡ `@MaxLength(200)` khỏi `q` ⇒ **1 ĐỎ**; gỡ `@MaxLength(32)` khỏi `sdt` ⇒ **1 ĐỎ**.

### 8. Kiểu + biên của query — `page`/`pageSize`/`custType`/`sdt`

- `page=abc` · `pageSize=abc` · `page=1.5` · `pageSize=10.5` ⇒ 400 (canh `@Type(() => Number)` +
  `@IsInt`: thiếu chúng thì một chuỗi/số thực lọt xuống `skip`/`take` của Prisma).
- **`pageSize=100` ⇒ 200, `take=100`.** `pageSize=101 ⇒ 400` **một mình không chứng minh trần đúng** —
  một `@Max(99)` cũng làm nó xanh. Ca biên phải kiểm từ **cả hai** phía.
  Đột biến: `@Max(100)` → `@Max(99)` ⇒ **2 ĐỎ**.
- `?custType=` (rỗng) ⇒ 400: "vắng mặt" là *không lọc*; "rỗng" là một giá trị **không hợp lệ**. Gộp
  hai thứ đó là cách một bộ lọc hỏng trông như một bộ lọc trống.
- `?sdt=a&sdt=b` (lặp key ⇒ **mảng**) ⇒ 400 `isString` — mảng không được tới `normalizeVnPhone`.

### 9. `q` có khoảng trắng thừa — dán SĐT từ chỗ khác vào ô tìm

`list()` có `.trim()`, **không test nào giữ nó**. Bỏ trim ⇒ `contains: ' 0903 '` khớp 0 dòng ⇒ người
dùng kết luận **sai** rằng khách chưa có ⇒ bấm "Tạo khách hàng mới" ⇒ đúng cái **bản ghi trùng người**
mà cả Epic 3 dựng lên để chặn.
Đột biến: bỏ `.trim()` ⇒ **4 ĐỎ**.

## Chứng minh test có RĂNG (mutation ×8, cả tám ĐỎ, khôi phục byte-for-byte)

| Đột biến | Bộ test CŨ | Bộ test MỚI |
|---|---|---|
| `Tài khoản NH` render vô điều kiện (web) | xanh | **1 ĐỎ** |
| bỏ `if (commercial)` trước `Tài khoản NH` (mobile) | xanh | **1 ĐỎ** |
| `needsSourceNote` đọc **tên** nguồn thay vì cờ `isOther` | xanh | **1 ĐỎ** |
| bỏ `orDash` cho `Địa chỉ` (null lọt ra màn) | xanh | **1 ĐỎ** |
| gỡ `@MaxLength(200)` khỏi `q` | xanh | **1 ĐỎ** |
| gỡ `@MaxLength(32)` khỏi `sdt` | xanh | **1 ĐỎ** |
| `@Max(100)` → `@Max(99)` (trần lệch một đơn vị) | xanh | **2 ĐỎ** |
| `list()` bỏ `.trim()` của `q` | xanh | **4 ĐỎ** |

Khôi phục bằng `cp` từ backup (**không** `git checkout` — code story chưa commit); `diff` xác nhận
byte-for-byte, suite xanh lại đầy đủ.

## 🔴 Một xanh-giả bị bắt **trong chính test em vừa viết** (đáng ghi lại)

Test đầu tiên cho trần `sdt` chỉ khẳng định **status 400**. Gỡ `@MaxLength(32)` ⇒ **vẫn xanh**: chuỗi
33 ký tự cũng bị `normalizeVnPhone` từ chối ⇒ 400 tới từ **hàng rào khác**. Test đang kiểm một cái
trần mà nó **không hề chạm tới**.

Sửa: khẳng định **mã ràng buộc** (`fieldErrors[].code === 'maxLength'` / chứa `'isString'`) — mã lỗi
là thứ nói cho ta biết request bị chặn **ở đâu**. Sau khi sửa, cả hai đột biến đều ĐỎ.

Bài học chung: **khi hai hàng rào cùng trả một status, status không phân biệt được chúng.** Test phải
hỏi "bị chặn ở đâu", không chỉ "có bị chặn không".

## Độ phủ theo AC

| AC | Trạng thái |
|---|---|
| AC-1 lookup (hội tụ · 400 rác · không-thấy ⇒ 200) | phủ (+ trần 32 · mảng ⇒ `isString`) |
| AC-2 client không chuẩn hoá SĐT | phủ (guard: regex/replace/`+84`/length-check) |
| AC-3 search/filter/paging + needle | phủ (+ trần `q` · kiểu `page`/`pageSize` · **biên `pageSize=100`** · `custType` rỗng · **trim**) |
| AC-4 màn Chọn/Tạo inline | **vá — cờ `isOther`, `onSelect`, tra-khi-submit** |
| AC-5 màn Danh sách (3 state) | **vá — màn phải GỌI port, không dựng cứng** |
| AC-6 màn Chi tiết (field theo Loại khách) | **vá — trước đó KHÔNG canh gì; nay có assert phủ định + `—`** |
| AC-7 không dữ liệu Đơn | phủ (assert phủ định, có sẵn) |
| AC-8 quyền `customers.manage` | phủ (403 cả 2 route mới · sidebar gated) |
| AC-9 port-only · design-system-first | phủ (+ lời gọi port cụ thể) |
| AC-10 parity web↔mobile | phủ (nhãn byte-identical · 6 file · shell) |
| AC-11 cổng chất lượng | xanh (544 · 16 DB · 213 guard · flutter · lint/format/build) |

## Việc cần Đại Ca biết

- **Màn Chi tiết dùng copy của màn Danh sách khi lỗi tải:** `CustomerDetailScreen` render
  `"Không tải được danh sách khách hàng."` cho lỗi tải **một** khách. Bảng copy của story chỉ định
  nghĩa chuỗi này cho **list-state**. Không phải lỗi test — là **lỗi copy**, và guard nhãn hiện
  **không** bắt được (nó chỉ đòi chuỗi có mặt ở đâu đó). Cần một chuỗi riêng cho chi tiết (vd
  `"Không tải được khách hàng."`) ⇒ **quyết định của Đại Ca**, em không tự sửa copy trong workflow QA.
- **Ô tìm kiếm màn Danh sách vẫn gọi backend mỗi lần gõ** (story đã ghi, chưa quyết). Guard mới chỉ
  khoá hành vi của **tra SĐT** (submit tường minh) — ô tìm kiếm danh sách để nguyên như story chốt.
- Lane DB (`npm run test:db`) **không đụng tới** — 16 test cũ vẫn xanh; các lỗ hổng vá lần này đều
  sống ở tầng pipe/guard, không phải tầng DB.
