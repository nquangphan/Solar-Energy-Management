---
baseline_commit: 04ed8326f8c9fd23057277538e3f686b83fde7ba
---

# Story 6.1: Nhánh Giao hàng — "Đã giao" gate theo cờ Thiết bị (Đang giao → Đã giao)

Status: done

## Story

As a người có quyền xác nhận giao hàng (`delivery.confirm`),
I want các bước giao hàng chỉ hiện khi Đơn có hàng hoá (cờ Thiết bị) — có cờ Vận chuyển thì đi `Đang giao → Đã giao`, không có thì thẳng `Đã giao` (khách tự tới lấy),
so that đơn bỏ mối đi đúng chuỗi giao hàng và không đơn nào kẹt ở `Đã cọc`.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

**Nhánh giao hàng ĐÃ CÓ MỘT NỬA trong bảng từ Story 5.1.** Story này là **story ĐỔI MÁY TRẠNG THÁI có chủ đích** — chủ sở hữu sai lệch FR-7 mà 5.4 (`5-4-...md:25-45, 582-586`) và 5.5 (`5-5-...md:357-360`) đã cố ý đẩy sang đây. Thay đổi tập trung ở **một file domain** (`backend/src/orders/domain/allowed-transition.ts`) + test + hai fake port demo + tài liệu.

### 1. Hiện trạng bảng (`allowed-transition.ts`, 16 dòng, `grep -c "from: TRANG_THAI"` = 16)

| Dòng | Cạnh | Gate hiện tại | Vấn đề |
|---|---|---|---|
| `:154-160` | `dacoc --bat_dau_giao--> danggiao` | `scopeGuard: 'vanChuyen'` | Không đòi Thiết bị — FR-7 "Đơn KHÔNG bật Thiết bị → bỏ qua bước giao" không được thi hành |
| `:161-170` | `danggiao --xong_giao--> dagiao` | **không gate** (cố ý, comment `:162-164`) | ĐÚNG — giữ nguyên. Bài học 5.1: gate bước RA bằng cờ khác cờ bước VÀO ⇒ ngõ cụt |
| — | `dacoc → dagiao` | **KHÔNG TỒN TẠI** | Ca "Thiết bị bật, Vận chuyển tắt" (FR-7) không đi được |
| `:182-189` | `dachot --hoan_thanh--> hoanthanh` | `scopeGuard: 'thietBi'` | Giữ nguyên (xem Câu hỏi mở #1) |

⇒ **Hệ quả nghiêm trọng hôm nay:** đơn **Thương mại** (preset chỉ Thiết bị, `scope-preset.ts:26-30`) nếu đi vào `dacoc` (ghi cọc — Epic 7) thì **chỉ còn đường `huy`**. Test "không ngõ cụt" (`test/allowed-transition.spec.ts:215-273`) vẫn xanh vì nó coi `huy` là lối ra hợp lệ. Story này bịt lỗ đó bằng cạnh `dacoc → dagiao`.

### 2. Bộ ba nguồn LỆCH NHAU — thứ tự thắng đã chốt cho story này

| Nguồn | Nói gì |
|---|---|
| `prd.md#FR-7` L159-166 | "Đã giao" gate cờ **Thiết bị**; "Đang giao" gate cờ **Vận chuyển**; Thiết bị bật + Vận chuyển tắt ⇒ `… → Đã giao`; không Thiết bị ⇒ bỏ qua bước giao; chỉ Thiết bị ⇒ `… → (thanh toán) → Đã giao → Hoàn thành` |
| `epics.md#Story 6.1` L550-555 | Trùng FR-7 (AC-1, AC-2 dưới đây) |
| mockup `all-screens.html` L1865 | Trùng FR-7, nói rõ "Đã giao mở theo cờ Thiết bị — không phải cờ Vận chuyển" |
| `EXPERIENCE.md` L98-106 | `[cờ Vận chuyển] Đang giao hàng → Đã giao`; "Đơn chỉ Thiết bị … Không có bước thi công/giao hàng" — **LỆCH** |
| `ARCHITECTURE-SPINE.md` L374-404 (sơ đồ) | Chỉ có `DaCoc --> DangGiao : cờ Vận chuyển`, không có `DaCoc --> DaGiao` — **LỆCH** |

**Quyết định:** đi theo **FR-7 + epics + mockup** (ba nguồn khớp nhau, và epics là nơi viết AC của chính story này). EXPERIENCE.md và sơ đồ spine **được sửa cho khớp** ở Task 6 — không phải ngược lại.

### 3. `scopeThietBi` LUÔN `true` ở production

`scope-preset.ts:8-15` — `scopeThietBi: true` là **type literal**; `UpdateOrderRequestDto` không có field đó (`update-order-request.dto.ts:19`); web `orders-port.ts:303-307` ghi rõ. ⇒ **AC-2 (không cờ Thiết bị) KHÔNG THỂ dựng qua API.** Nó vẫn phải được thi hành trong BẢNG (để bảng = FR-7, và để không ai phải nhớ "à, thietBi luôn true nên khỏi gate"), nhưng **bằng chứng của AC-2 nằm ở lane unit domain** (`test/allowed-transition.spec.ts`). **KHÔNG** viết test e2e/DB dựng đơn `scopeThietBi=false` qua API — đó là trạng thái bất khả thi (bài học 5.8 mục 6).

### 4. LỖI CÓ SẴN trong `buocVongDoi()` — PHẢI sửa, AC-2 phụ thuộc vào nó

Đã chạy thử trên HEAD `04ed832`:

```
buocVongDoi('hoanthanh', {thietBi:true, thiCong:false, vanChuyen:false})
⇒ baogia done, dachot done, nghiemthu DONE, danggiao DONE, dagiao DONE, hoanthanh current
buocVongDoi('hoanthanh', {thietBi:false, thiCong:true, vanChuyen:false})
⇒ … danggiao DONE, dagiao DONE …
```

Nguyên nhân: `buocVongDoi()` (`:428-456`) đánh `done` cho mọi bước `X` có `coDuongToi(canh, X, status)`. Các cạnh RA cố ý không gate (`nghiemthu → hoanthanh`, `danggiao → dagiao`, `dagiao → hoanthanh`) vẫn nằm trong `canhDaGate()`, nên một bước **không vào được** với bộ cờ này vẫn "có đường tới" `hoanthanh` ⇒ stepper khoe bước chưa từng xảy ra (vi phạm UX-DR-11 và **trực tiếp vi phạm AC-2**: đơn không Thiết bị ở `hoanthanh` hiện `danggiao`/`dagiao`).

Sau khi thêm cạnh `dacoc → dagiao`, lỗi lan sang ca mới: đơn tự-lấy ở `dagiao` sẽ có `danggiao` = `done` (vì `danggiao → dagiao` không gate) — đúng loại "màn nói dối" mà comment `:400-417` cấm.

**Sửa (Task 2):** một bước chỉ được `done`/`upcoming` khi nó **VÀO ĐƯỢC từ `baogia`** trên đồ thị đã gate: `done` ⇔ `coDuongToi(canh, 'baogia', X) && coDuongToi(canh, X, status)`; tương tự cho `upcoming`. `baogia` là điểm xuất phát nên bản thân nó luôn đạt (xử lý riêng, đừng để `coDuongToi(baogia, baogia)` trả false loại mất nó — `coDuongToi` đòi ≥ 1 cạnh).

⚠️ **Giới hạn còn lại, KHÔNG sửa ở đây:** khi một trạng thái có NHIỀU đường tới (vd đơn Cá nhân 3 cờ ở `hoanthanh`: cả nhánh thi công lẫn nhánh giao đều "done"; đơn Thương mại ở `hoanthanh` có thể đã đóng thẳng từ `dachot` nhưng stepper vẫn vẽ `dacoc`/`dagiao` done). Phân giải đúng cần đọc LỊCH SỬ (audit), không phải bảng. Ghi ở Dev Notes, **không viết test ghim hành vi đó** (đừng ghim một sai lệch thành test xanh).

### 5. Phần "phiếu xuất kho + trừ tồn" của AC-3 KHÔNG thuộc story này

AC gốc thứ 3 nói "xác nhận phiếu xuất kho + trừ tồn". `StockItem`/`StockVoucher` **chưa tồn tại** (`backend/src/inventory/` không có; schema chưa có model). Chúng ra đời ở 6.2/6.3, và việc gắn phiếu xuất vào transition `Đã giao` là **AC-2 của Story 6.4** (`epics.md:580`). Luật dự án: "mỗi story tạo/sửa CHỈ entity/file nó cần; không phụ thuộc story sau" (`project-context.md#Development Workflow`).

⇒ Story 6.1 **KHÔNG** thêm bất kỳ dòng nào chạm tồn kho (`StockMovement`, `StockItem`, `onHand`, `reserved`, `inventory`). Ghi seam cho 6.4 ở Dev Notes: **hai** cạnh cùng vào `dagiao` (`danggiao → dagiao` và `dacoc → dagiao`), nên 6.4 phải hook theo **đích `to === 'dagiao'`**, không theo một cạnh/một `from` cụ thể.

### 6. KHÔNG cần sửa màn hình nào

Cả bốn màn (web/mobile × chi tiết/chuyển trạng thái) vẽ **đúng thứ backend trả** — `buoc` và `buocKeTiep` từ `GET /orders/:id/vong-doi`; nhãn đích lấy từ `STATUS_LABELS[step.to]` (`OrderStatusChangeScreen.tsx:71-74`, `order_status_change_screen.dart:276`). Source-guard `design-system/screens/order-detail.test.mjs:154-179` và `order-transition.test.mjs:145-172` **cấm** literal status/cờ trong màn. Nếu bạn thấy mình sửa `web/src/screens/` hay `mobile/lib/screens/` — dừng lại.

Thứ DUY NHẤT phía client phải đổi là **hai fake port demo** (chúng là "server giả", chép tay hình dạng vòng đời): `web/src/design-system/session/fake-orders-port.ts:531-675` và `mobile/lib/design_system/session/fake_orders_port.dart:298-389`.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:550-555`)

- **AC-1** — **Given** Đơn bật cờ Thiết bị (có hàng hoá), **When** sau "Đã cọc" và nếu có cờ Vận chuyển, **Then** engine cho bước Đang giao → Đã giao; nếu KHÔNG cờ Vận chuyển, **Then** thẳng sang Đã giao (khách tự tới lấy) (FR-7, AD-7, §2).
- **AC-2** — **Given** Đơn KHÔNG cờ Thiết bị (chỉ công lắp, không hàng), **When** dựng vòng đời, **Then** không có bước giao hàng nào xuất hiện (FR-7, §2).
- **AC-3** — **Given** "Đã giao" trạng thái, **When** chuyển, **Then** ~~xác nhận phiếu xuất kho + trừ tồn~~ (→ Story 6.4, xem mục 🛑5) + ghi Audit + publish `StatusChanged`, đính kèm ảnh optional (FR-9, FR-23, AD-18, §2).

### AC dẫn xuất (đây là phần đo được)

- **AC-4 (bảng)** — `ALLOWED_TRANSITIONS` có **đúng 17 dòng**. Dòng mới: `{ event: xongGiao, from: dacoc, to: dagiao, requires: delivery.confirm, scopeGuard: { thietBi: true, vanChuyen: false } }`. Dòng `bat_dau_giao` đổi gate thành `{ thietBi: true, vanChuyen: true }`. Dòng `danggiao → dagiao` **vẫn không gate**. `hoanThanh` vẫn đúng 3 dòng; `SU_KIEN_THU_CONG` vẫn đúng 5 phần tử, không thêm sự kiện mới vào `SU_KIEN`.
- **AC-5 (cờ phủ định)** — Đơn bật Vận chuyển đứng ở `dacoc` gửi `xong_giao` ⇒ `evaluateTransition` trả `{ ok:false, reason:'scope' }`, HTTP **409** `"Bước này không thuộc phạm vi của đơn."` — có Vận chuyển thì **không được** nhảy cóc qua `danggiao`.
- **AC-6 (lane HTTP, `npm test`, không Docker)** — đơn `dacoc` với `scopeThiCong:false, scopeVanChuyen:false`, actor có `delivery.confirm` + `orders.view_all`:
  - `GET /orders/:id/vong-doi` ⇒ `buocKeTiep` = **đúng** `[{ event:'xong_giao', to:'dagiao', requires:'delivery.confirm' }]`; `buoc` chứa `dagiao` (upcoming) và **không** chứa `danggiao`.
  - `POST /orders/:id/chuyen-trang-thai` `event=xong_giao`, 0 ảnh ⇒ **200** `{ status:'dagiao', soAnhDaLuu:0 }`; kèm 1 ảnh ⇒ `soAnhDaLuu:1`, `Attachment.statusFrom='dacoc'`, `statusTo='dagiao'`.
  - Từ `dagiao` ⇒ `buocKeTiep` = đúng `[{ event:'hoan_thanh', to:'hoanthanh', requires:'delivery.confirm' }]`; POST ⇒ **200** `{ status:'hoanthanh' }`.
- **AC-7 (nhánh có Vận chuyển đi hết qua dây)** — đơn 3 cờ: `dacoc --bat_dau_giao--> 200 danggiao`, `danggiao --xong_giao--> 200 dagiao` (cạnh này **chưa từng** chạy qua lane HTTP — `orders.e2e.spec.ts` không có `xongGiao`).
- **AC-8 (quyền)** — actor thiếu `delivery.confirm` ở `dacoc` (đơn tự-lấy) ⇒ **403** `FORBIDDEN`, status không đổi, không byte nào lên storage; `buocKeTiep` của actor đó **không** chứa `xong_giao`.
- **AC-9 (audit + event, lane unit)** — `chuyenTrangThaiThuCong` với `xongGiao` từ `dacoc`: `StatusChanged` publish **SAU commit**, `before.status='dacoc'`, `after.status='dagiao'`, **đúng một lần** (`toHaveBeenCalledTimes(1)`); ảnh mang chung `occurredAt` với event. Mock `$transaction` phải **chạy thân tx rồi mới ném** cho ca rollback.
- **AC-10 (stepper không nói dối)** — `buocVongDoi()`:
  - `{thietBi:false, …}` (mọi tổ hợp thiCong/vanChuyen) × **mọi** status ⇒ **không** có `danggiao`/`dagiao` (trừ khi status đang chính là nó).
  - Đơn tự-lấy `{T, F, F}` và `{T, T, F}` ở `dagiao` ⇒ `danggiao` **vắng mặt**, `dacoc` done.
  - Đơn Thương mại `{T, F, F}` ở `hoanthanh` ⇒ `thicong`, `nghiemthu`, `danggiao` **vắng mặt** (hôm nay đang `done` — lỗi mục 🛑4).
  - Đơn Thương mại `{T, F, F}` ở `dachot` ⇒ `dacoc`, `dagiao`, `hoanthanh` upcoming; `danggiao` vắng.
- **AC-11 (không ngõ cụt, chặt hơn)** — test ngõ cụt (`allowed-transition.spec.ts:215-273`) dùng **cùng helper gate** với production; thêm khẳng định: với mọi bộ cờ có `thietBi:true`, từ `dacoc` tới được `hoanthanh` **không đi qua `huy`**.
- **AC-12 (không chạm tồn kho)** — diff story không chứa `StockMovement|StockItem|onHand|reserved|inventory` trong `backend/src/`.
- **AC-13 (tài liệu)** — sơ đồ state machine trong `ARCHITECTURE-SPINE.md` và khối `EXPERIENCE.md` L94-106 khớp bảng mới.
- **AC-14 (cổng)** — xanh: `cd backend && npm test && npm run build && npm run openapi:gen` (không drift — kỳ vọng openapi KHÔNG đổi vì DTO không đổi); `npm run lint` không thêm lỗi mới so với baseline (baseline đỏ sẵn — đo bằng stash); `cd web && npm run typecheck && npm test`; `cd design-system && npm test`; `cd mobile && flutter test && flutter analyze`.

---

## Tasks / Subtasks

- [x] **Task 1 — Mở rộng `scopeGuard` thành điều kiện nhiều cờ, có phủ định (AC-4, AC-5)**
  - [x] Trong `backend/src/orders/domain/allowed-transition.ts`, đổi kiểu `TransitionRule.scopeGuard` (`:80-81`) từ `keyof OrderScopeFlags` thành:
    ```ts
    /** Mỗi cờ được liệt kê phải có ĐÚNG giá trị đó; cờ vắng = không phụ thuộc. Vắng cả field = không gate. */
    readonly scopeGuard?: Partial<Readonly<Record<keyof OrderScopeFlags, boolean>>>;
    ```
  - [x] Thêm **một** hàm thuần export `thoaCoPhamVi(rule: TransitionRule, scopeFlags: OrderScopeFlags): boolean` và thay **cả ba** chỗ đang tự viết biểu thức gate: `evaluateTransition` `:231`, `buocKeTiep` `:323`, `canhDaGate` `:386`. Ba bản chép tay của cùng một luật = điểm drift (đúng loại AD-11 cấm).
  - [x] Cập nhật các dòng: `batDauThiCong`/`xongThiCong` ⇒ `{ thiCong: true }`; `batDauGiao` ⇒ `{ thietBi: true, vanChuyen: true }`; `hoanThanh` từ `dachot` ⇒ `{ thietBi: true }`. Dòng `danggiao → dagiao` **giữ không gate** và giữ nguyên comment `:162-164`.
  - [x] Thêm dòng mới **ngay sau** dòng `danggiao → dagiao`: `{ event: SU_KIEN.xongGiao, from: TRANG_THAI_DA_COC, to: TRANG_THAI_DA_GIAO, requires: PERM.deliveryConfirm, scopeGuard: { thietBi: true, vanChuyen: false } }` + comment một-hai dòng: khách tự tới lấy; `vanChuyen: false` là bắt buộc, thiếu nó thì đơn có Vận chuyển nhảy cóc được qua `danggiao`.
  - [x] Dùng lại sự kiện `xongGiao` — cặp `(dacoc, xong_giao)` là khoá mới, không trùng. **KHÔNG** thêm sự kiện mới vào `SU_KIEN` (sẽ kéo theo `@IsIn`, OpenAPI, client).
  - [x] Cập nhật comment đầu bảng (`:94-99`, "bộ 21 key không đổi") nếu cần — không thêm key quyền nào.
  - [x] `evaluateTransition` giữ nguyên THỨ TỰ đánh giá (bảng → cờ → quyền) — đây là quyết định bảo mật (`:205-219`).

- [x] **Task 2 — Sửa `buocVongDoi()` để bước không vào được thì không có mặt (AC-2, AC-10)**
  - [x] Thêm điều kiện "vào được từ `baogia`" như mục 🛑4. `baogia` xử lý riêng (luôn đạt). Giữ nguyên hai ngoại lệ `huy`/`choduyet` và nhánh `current`.
  - [x] Cập nhật JSDoc `:400-427` một câu: cạnh RA không gate vẫn nằm trong đồ thị, nên "có đường tới status" thôi chưa đủ — bước phải vào được với bộ cờ này.
  - [x] **Không** đọc audit/lịch sử để phân giải đa-đường (ngoài scope, xem 🛑4).

- [x] **Task 3 — Test domain `backend/test/allowed-transition.spec.ts` (AC-2, AC-4, AC-5, AC-10, AC-11)**
  - [x] `:62` 16 → **17**.
  - [x] `:99` `toBe('thiCong')` → `toEqual({ thiCong: true })`.
  - [x] Test ngõ cụt `:232-233`: thay `diDuoc` tự viết bằng `thoaCoPhamVi` export; thêm khẳng định AC-11 (từ `dacoc` tới `hoanthanh` không qua `huy` với mọi bộ cờ `thietBi:true`) — loang như hiện có nhưng **bỏ** dòng có `to === 'huy'`.
  - [x] Thêm describe "nhánh giao hàng (Story 6.1)":
    - `{T,F,F}` và `{T,T,F}` ở `dacoc` + `xongGiao` ⇒ `{ ok:true, to:'dagiao' }`.
    - `{T,*,T}` ở `dacoc` + `xongGiao` ⇒ `scope` (AC-5).
    - `{F,F,T}` và `{F,T,T}` ở `dacoc` + `batDauGiao` ⇒ `scope` (AC-2); `xongGiao` ⇒ `scope`.
    - Hai cạnh VÀO nhánh giao (mọi dòng có `to ∈ {danggiao, dagiao}` và `from !== 'danggiao'`) đều có `scopeGuard.thietBi === true` — kiểu test `:96-101` (MỌI dòng, không chỉ dòng đầu; xem memory "đột biến 1 dòng bỏ sót guard dòng anh em").
    - `thoaCoPhamVi`: `{ vanChuyen: false }` với cờ `vanChuyen:true` ⇒ false; với `false` ⇒ true; `undefined` guard ⇒ true.
  - [x] Viết lại test `:383` (AC-11 của 5.4 — tên đang nói "Story 6.1 sẽ thêm cạnh đó"): `{T,T,F}` ở `dacoc` ⇒ `dagiao` upcoming, `danggiao` vắng, `thicong` upcoming.
  - [x] Viết lại test `:372` (Thương mại): giữ `thicong`/`nghiemthu`/`danggiao` vắng; **`dagiao` nay upcoming**; `hoanthanh` upcoming. Đổi tên test cho đúng.
  - [x] Thêm các ca AC-10 (`hoanthanh` Thương mại; `dagiao` tự-lấy; `thietBi:false` × mọi status không có bước giao).
  - [x] Thêm ca `buocKeTiep`: `{T,T,F}` ở `dacoc` ⇒ đúng hai sự kiện `[batDauThiCong, xongGiao]`; `{T,F,F}` ở `dacoc` ⇒ đúng `[xongGiao]` với `to:'dagiao'`; ca `:472` (3 cờ) giữ nguyên — không có `xongGiao`.
  - [x] Các test `daTaiDich` (`:283-326`) phải tự xanh — đặc biệt "không sự kiện nào có `to` trùng một `from` của chính nó": `xongGiao` có `from ∈ {danggiao, dacoc}`, `to = dagiao` ⇒ không xung đột. Nếu đỏ, bạn đã gõ sai dòng.

- [x] **Task 4 — Test executor + HTTP (AC-3, AC-6, AC-7, AC-8, AC-9)**
  - [x] `backend/test/order-status-change.spec.ts`: thêm describe `cạnh dacoc → dagiao (khách tự lấy)` theo khuôn describe `cạnh thicong → nghiemthu` (`:224-290`): ghi qua cổng atomic, `StatusChanged` `dacoc→dagiao` publish **đúng 1 lần** sau commit, ảnh chung `occurredAt`, tx ném sau khi thân chạy ⇒ không publish. Fixture đơn phải có `scopeVanChuyen:false`.
  - [x] `backend/test/orders.e2e.spec.ts` trong describe Story 5.5 (`:3042`): **dùng lại** `DON_DACOC` (`:3044`), `quyenDuLaneThuCong()` (`:3052`), `givenPermissions`, `post(event, files)` (`:3072`), `anh()`; thêm describe "nhánh giao hàng đi hết chuỗi qua dây" theo khuôn `:3702-...` (`donDangO`). Ca: AC-6 (ba bước, vong-doi + POST), AC-7 (`danggiao → dagiao` với 3 cờ), AC-5 (3 cờ + `xongGiao` ở `dacoc` ⇒ 409 thông điệp phạm vi), AC-8 (thiếu `delivery.confirm` ⇒ 403, `txOrderRepo.updateMany` không gọi, `storageMap.size === 0`). Dùng hằng `SU_KIEN.*`, **không** literal.
  - [x] Lane DB (`test/order-status-change.db.integration.spec.ts`): thêm **một** round-trip đơn Thương mại `dacoc → dagiao → hoanthanh` trên Postgres thật (audit 2 dòng, ảnh `statusTo='dagiao'`). Ca `:503-511` ("bảng transition không đổi") — kiểm lại fixture cờ; nếu fixture 3 cờ thì giữ nguyên, đổi tên describe cho khỏi nói dối ("không đổi"). ⚠️ Lane DB **không phải bằng chứng** cho AC — AC phải xanh ở `npm test`. Nếu Docker không chạy được từ shell, ghi rõ "lane DB chưa chạy" trong Completion Notes, đừng đánh `[x]`.

- [x] **Task 5 — Đồng bộ hai fake port demo (không đụng màn)**
  - [x] `web/src/design-system/session/fake-orders-port.ts`: `getLifecycle` (`:531-563`) — chuỗi thành `…dacoc, [thicong, nghiemthu nếu thiCong], [danggiao nếu vanChuyen], dagiao, hoanthanh` (Thiết bị luôn bật trong demo); `buocKeTiepDemo` (`:617-660`) thêm `dacoc && !vanChuyen ⇒ { event:'xong_giao', to:'dagiao', requires:'delivery.confirm' }`.
  - [x] `mobile/lib/design_system/session/fake_orders_port.dart` `:298-389`: thay đổi tương đương, giữ parity hai nền tảng.
  - [x] Chạy `cd web && npm test` và `cd mobile && flutter test` — sửa test nào đang khẳng định hình dạng fake cũ (vd `mobile/test/screens/orders/order_detail_screen_test.dart:290-305` dùng `_StubPort` riêng, không phải fake — có thể không cần đổi). **Không** dùng `dart format` không kèm `-o none` (memory: nó ghi file và lan ra ~20 file).

- [x] **Task 6 — Tài liệu (AC-13)**
  - [x] `ARCHITECTURE-SPINE.md` sơ đồ L384-404: `DaCoc --> DangGiao : Thiết bị + Vận chuyển`; thêm `DaCoc --> DaGiao : Thiết bị, không Vận chuyển (khách tự lấy)`. Thêm một dòng "Thi hành" dưới AD-7 nếu cần: gate là điều kiện nhiều cờ, có phủ định, đánh giá ở `thoaCoPhamVi()`.
  - [x] `EXPERIENCE.md` L94-106: khối sơ đồ chữ + câu "Đơn chỉ Thiết bị … Không có bước thi công/giao hàng" sửa theo FR-7 (Thương mại: `Đã chốt → (thanh toán) → Đã giao → Hoàn thành`, hoặc đóng thẳng từ Đã chốt). **Không** sửa mockup `.html`.
  - [x] Không sửa `prd.md`/`epics.md` (đã đúng).

- [x] **Task 7 — Mutation (bắt buộc, dùng `cp` backup — KHÔNG `git checkout`, code story chưa commit)**
  - [x] Xoá dòng mới `dacoc → dagiao` ⇒ test domain Task 3 **và** e2e AC-6 đỏ.
  - [x] Bỏ `vanChuyen: false` khỏi dòng mới ⇒ AC-5 đỏ (cả domain lẫn e2e).
  - [x] Bỏ `thietBi: true` khỏi dòng `batDauGiao` ⇒ ca AC-2 domain đỏ. **Và** bỏ `thietBi: true` khỏi dòng mới ⇒ ca AC-2 domain đỏ (đột biến MỌI dòng cùng guard, không chỉ một).
  - [x] Mutate `thoaCoPhamVi` bỏ qua giá trị `false` (`flags[k] || !v` hoặc tương đương) ⇒ đỏ.
  - [x] Gỡ điều kiện "vào được từ baogia" ở Task 2 ⇒ ca AC-10 `hoanthanh` Thương mại đỏ.
  - [x] Gate dòng `danggiao → dagiao` bằng `{ vanChuyen: true }` ⇒ **phải xanh** ở test ngõ cụt (vì cờ không đổi giữa chừng — đây là kiểm tra ngược: nếu đỏ thì test ngõ cụt đang đo nhầm) — ghi kết quả; rồi gate bằng `{ thietBi: false }` ⇒ test ngõ cụt **đỏ**.
  - [x] Mỗi mutant phải COMPILE (mutant không compile đỏ mọi suite, không chứng minh gì). Ghi bảng mutant → suite đỏ vào Completion Notes.

---

## Dev Notes

### Files sẽ đổi

| File | Loại | Nội dung |
|---|---|---|
| `backend/src/orders/domain/allowed-transition.ts` | UPDATE | kiểu `scopeGuard`, `thoaCoPhamVi`, 1 dòng mới, 4 dòng đổi gate, `buocVongDoi` reachability |
| `backend/test/allowed-transition.spec.ts` | UPDATE | Task 3 |
| `backend/test/order-status-change.spec.ts` | UPDATE | Task 4 |
| `backend/test/orders.e2e.spec.ts` | UPDATE | Task 4 |
| `backend/test/order-status-change.db.integration.spec.ts` | UPDATE | Task 4 |
| `web/src/design-system/session/fake-orders-port.ts` | UPDATE | Task 5 |
| `mobile/lib/design_system/session/fake_orders_port.dart` | UPDATE | Task 5 |
| `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` | UPDATE | Task 6 |
| `_bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md` | UPDATE | Task 6 |

**Không đổi:** `orders.service.ts` (executor `chuyenTrangThaiThuCong` `:648-779` đã chạy mọi sự kiện trong `SU_KIEN_THU_CONG` — `xongGiao` đã có; pre-check `:672-698` đã map `scope` → 409 thông điệp phạm vi), `orders.controller.ts` (`:840-897`, gate cửa đã có `delivery.confirm`), DTO, `openapi.json`, `permission-registry.ts`, `role-presets.ts` (`KHO_GIAO` `:107` đã có `delivery.confirm`), Prisma schema (không migration), mọi file `screens/`, `auto-transition-map.ts` (`hoanThanh` vẫn 3 dòng — comment `:16` vẫn đúng).

### Hiện trạng phải giữ

- `evaluateTransition` — thứ tự bảng → cờ → quyền (`:205-235`). Không đổi chữ ký public.
- `daTaiDich` (`:255-260`) — cổng no-op lane auto, đọc bảng; dòng mới tự được phủ.
- `buocKeTiep` (`:314-330`) — bốn tầng lọc giữ thứ tự; chỉ thay biểu thức cờ bằng `thoaCoPhamVi`.
- `coTheHuy` (`:345-356`) — không cạnh `huy` nào có `scopeGuard`; không đổi.
- Executor dưới row lock (`applyTransition` + `THU_CONG_GATE_THUA`) re-evaluate bằng chính `evaluateTransition` ⇒ cờ phủ định có hiệu lực ở cả pre-check lẫn trong tx, không cần sửa.
- Mọi đơn `scopeVanChuyen:true` đang có (Cá nhân) — hành vi KHÔNG đổi (`thietBi` luôn true ⇒ gate `batDauGiao` mới tương đương gate cũ ở production).

### Seam cho Story 6.4 (đừng làm ở đây)

Hai cạnh vào `dagiao`. Phiếu xuất gắn transition "Đã giao" (6.4 AC-2) phải hook theo **đích** `dagiao`, không theo `from`. Có thể cân nhắc ở 6.4: hàng rời kho lúc `bat_dau_giao` chứ không phải lúc `xong_giao` — đó là câu hỏi nghiệp vụ của 6.4, ghi lại để không ai quyết ngầm.

### Kiểm thử — luật dự án áp dụng trực tiếp

- `applyTransition` (gate cờ + quyền) nằm trong danh sách **bắt buộc test** (`project-context.md#Testing`).
- AC về mã HTTP chỉ đo được ở lane e2e (ValidationPipe chạy trước service) — memory `dev-pins-ac-deviation-as-green-test`.
- Đếm publish bằng `toHaveBeenCalledTimes(1)`, không `mock.calls[0]` — memory `publish-count-unasserted-duplicate-survives`.
- Mock `$transaction` reject phải chạy thân tx trước — memory `mock-rejected-transaction-false-green`.
- Lint backend đỏ sẵn ~162 lỗi prettier ở baseline — đo bằng `git stash` trước khi nhận lỗi là của mình; chạy `prettier --write` CHỈ trên hunk mình viết.
- Bảng là thuộc tính của TOÀN BẢNG: test bất biến (ngõ cụt, không trùng khoá, gate trên MỌI dòng anh em) quan trọng hơn test call-site đơn lẻ — memory `story-devnotes-drift-from-spine`.

### Previous Story Intelligence (5.8, 5.4, 5.5)

- 5.8 là story "đóng lane" cùng khuôn: kỳ vọng thay đổi nhỏ, e2e đi hết chuỗi qua dây là phần giá trị nhất. Khuôn describe `nhánh thi công đi hết chuỗi qua dây` (`orders.e2e.spec.ts:3702-...`) — chép cấu trúc cho nhánh giao.
- 5.8 mutation phát hiện: bảng có **ba** dòng `hoanThanh` — xoá nhầm dòng thì test vẫn xanh, kết quả mutation GIẢ. Ở story này `xongGiao` sẽ có **hai** dòng — mutation phải nhắm đúng dòng `from: TRANG_THAI_DA_COC`.
- 5.4/5.5 đã viết rõ: khi 6.1 thêm cạnh, `buocVongDoi()`/`buocKeTiep()` **tự** hiện bước mới vì đọc thẳng bảng ⇒ không sửa màn. Đúng — trừ lỗi reachability ở 🛑4 mà 5.4 không thấy vì fixture không bao giờ đặt status ở `hoanthanh` với bộ cờ hẹp.
- 5.1: một lần đã gate bước RA bằng cờ khác cờ bước VÀO ⇒ ngõ cụt. Đừng gate `danggiao → dagiao`.

### Git intelligence

5 commit gần nhất (`04ed832`, `9bd41ba`, `15f3532`, `dc35b74`, `1eb6a29`) là lô chuẩn bị Epic 6: e2e bind loopback (`test/util/listen-loopback.ts` — mọi file e2e mới/ sửa phải dùng), đường ghi đơn có phạm vi (`findScopedOrThrow` — executor đã dùng), web có tsc/vitest (Task 5 phải qua `npm run typecheck`), mọi source-guard có assert chống-rỗng. Không có thư viện mới; không cần nghiên cứu phiên bản (story không thêm dependency).

### Project Structure Notes

- Đặt dòng mới trong bảng cạnh dòng `xongGiao` cũ để người đọc thấy hai đường vào `dagiao` cùng lúc.
- Tên hàm/biến tiếng Việt không dấu theo file (`thoaCoPhamVi`, `canhDaGate`, `coDuongToi`).
- Không đặt mã story/AC vào comment code hay tên test (`review-audit-self-decision.md#Stable Code Artifacts`) — tên test mô tả hành vi. (Lưu ý: test cũ `:383` có chữ "AC-11"/"Story 6.1" — khi viết lại thì bỏ.)

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **`dachot → hoanthanh` (chỉ Thiết bị, đủ tiền)** vẫn giữ. FR-7 dòng cuối gợi ý đơn chỉ Thiết bị đi qua `Đã giao`; spine giữ cạnh đóng thẳng. Mặc định: GIỮ (không đổi hành vi 5.1/5.5 đã ship). Đại Ca muốn bỏ thì là story riêng.
2. **Đơn Thi công + Thiết bị, KHÔNG Vận chuyển** ở `dacoc` sẽ thấy CẢ `Bắt đầu thi công` LẪN `Đã giao` (khách tự lấy) — cùng mô hình rẽ nhánh song song mà đơn 3 cờ đã có hôm nay (`bat_dau_thi_cong` + `bat_dau_giao`). Mặc định: chấp nhận, nhất quán với hiện trạng.
3. **Đơn Vận chuyển mà KHÔNG Thiết bị** — sau story này không vào được nhánh giao. Ở production không xảy ra (`scopeThietBi` luôn true).
4. **Stepper đa-đường** (🛑4) — cần lịch sử để vẽ đúng nhánh đã đi; đề xuất ghi nợ kỹ thuật.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.1` L550-555; `#Story 6.4` L577-582]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-7` L159-166]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-7` L84-88; `#AD-11` L108-113; `#AD-18` L151-155; `#Order state machine` L374-404]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md` L94-106; `mockups/all-screens.html` L1865]
- [Source: `backend/src/orders/domain/allowed-transition.ts` `:80-81, 140-190, 221-235, 314-330, 380-388, 428-456`]
- [Source: `backend/src/orders/domain/scope-preset.ts:8-30` — `scopeThietBi: true` literal]
- [Source: `backend/src/orders/orders.service.ts:648-779` — `chuyenTrangThaiThuCong`]
- [Source: `backend/src/orders/orders.controller.ts:840-897` — `POST /:id/chuyen-trang-thai`]
- [Source: `backend/test/allowed-transition.spec.ts:62, 96-101, 215-273, 372-392, 472-476`]
- [Source: `backend/test/orders.e2e.spec.ts:3042-3100, 3660-3720`]
- [Source: `_bmad-output/implementation-artifacts/5-4-chi-tiet-don-stepper-gate-tabs-lich-su-ban-update.md:25-45, 582-586`; `5-5-...md:357-360`; `5-8-...md:213`]
- [Source: `_bmad-output/project-context.md`]

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, bmad-dev-story)

### Debug Log References

- RED xác nhận: sau Task 1 (chưa Task 2), đúng 4 ca `buocVongDoi` đỏ — tự lấy ở `dagiao` (×2), Thương mại ở `hoanthanh`, không-Thiết-bị × mọi status ⇒ lỗi reachability 🛑4 là thật.
- `prettier --write` lỡ chạy cả file `order-status-change.spec.ts` (đụng 11 dòng có sẵn) ⇒ dựng lại từ HEAD + chỉ chèn khối mới.
- Lint baseline đo bằng `cp` backup 5 file backend về HEAD: 164 problems (159 error, 5 warning). Sau story: 164 (159/5) — một warning `no-unsafe-argument` do chép khuôn `storageMap.has(data[0].objectKey)` đã gỡ bằng `as string`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Task 1:** `scopeGuard` thành `Partial<Readonly<Record<keyof OrderScopeFlags, boolean>>>`; `thoaCoPhamVi()` export, thay cả ba chỗ (`evaluateTransition`, `buocKeTiep`, `canhDaGate`). Bảng 17 dòng: dòng mới `dacoc --xong_giao--> dagiao` `{thietBi:true, vanChuyen:false}` đặt ngay sau `danggiao → dagiao` (vẫn không gate); `batDauGiao` ⇒ `{thietBi:true, vanChuyen:true}`; nhánh thi công ⇒ `{thiCong:true}`; `dachot → hoanthanh` ⇒ `{thietBi:true}`. Không thêm sự kiện/quyền; thứ tự bảng → cờ → quyền giữ nguyên.
- **Task 2:** `buocVongDoi()` thêm điều kiện "vào được từ `baogia`" (`baogia` luôn đạt). Không đọc audit — giới hạn đa-đường (🛑4) vẫn còn, không ghim bằng test.
- **Task 3:** `allowed-transition.spec.ts` 105 ca (thêm ~20): 17 dòng, `toEqual({thiCong:true})`, test "mọi cặp hợp lệ đi qua" dựng cờ từ guard của chính dòng (dòng có phủ định không đi được với bộ đủ cờ), ngõ cụt dùng `thoaCoPhamVi`, thêm bất biến "có Thiết bị ⇒ `dacoc` tới `hoanthanh` không qua `huy`", describe `thoaCoPhamVi`, describe nhánh giao hàng (gồm `{F,T,F}`/`{F,F,F}` + `xongGiao` ⇒ scope để bắt đột biến bỏ `thietBi` ở dòng mới), ca AC-10, `buocKeTiep` `{T,T,F}`/`{T,F,F}`. Viết lại hai test cũ (tên không còn "AC-11"/"Story 6.1").
- **Task 4:** executor `order-status-change.spec.ts` +5 ca (atomic gate, publish `toHaveBeenCalledTimes(1)`, ảnh chung `occurredAt`, tx chạy thân rồi ném ⇒ không publish, đơn có Vận chuyển ⇒ 409 không ghi gì). e2e `orders.e2e.spec.ts` +8 ca trong describe 5.5 (AC-5/6/7/8, dùng `SU_KIEN.*`, file đã dùng `initAppOnLoopback`). Lane DB: +1 round-trip Thương mại `dacoc → dagiao → hoanthanh` (2 hàng audit đúng cặp, ảnh `dacoc→dagiao` chung `occurred_at`); describe "bảng transition không đổi (AC-12)" đổi tên (fixture 3 cờ, assert giữ nguyên). **Lane DB ĐÃ CHẠY**: `npm run test:db` trên pns-postgres :5433 ⇒ 123/123.
- **Task 5:** web + mobile fake port: chuỗi `…dacoc, [thicong, nghiemthu], [danggiao nếu vanChuyen], dagiao, hoanthanh`; `buocKeTiepDemo` thêm `dacoc && !vanChuyen ⇒ xong_giao → dagiao`. Không sửa màn nào; không test nào khẳng định hình dạng fake cũ nên không cần sửa test. Drift `dart format` của file mobile là có sẵn ở HEAD (đo bằng `-o none`), không ghi file.
- **Task 6:** spine — sơ đồ `DaCoc --> DangGiao : Thiết bị + Vận chuyển`, thêm `DaCoc --> DaGiao : Thiết bị, không Vận chuyển (khách tự lấy)`, dòng "Thi hành" dưới AD-7. EXPERIENCE — khối sơ đồ chữ + câu "Đơn chỉ Thiết bị" theo FR-7. Không sửa prd/epics/mockup.
- **Task 7 — bảng mutant** (backup `cp`, mọi mutant compile `tsc --noEmit` ok; domain = `allowed-transition.spec`, exec = `order-status-change.spec`, e2e = describe nhánh giao):

  | Mutant | domain | exec | e2e |
  |---|---|---|---|
  | M1 xoá dòng `dacoc → dagiao` | 17 đỏ | 4 đỏ | 5 đỏ |
  | M2 bỏ `vanChuyen:false` dòng mới | 3 đỏ (AC-5) | 3 đỏ | 1 đỏ (409) |
  | M3 bỏ `thietBi:true` dòng `batDauGiao` | 4 đỏ | xanh | xanh |
  | M4 bỏ `thietBi:true` dòng mới | 4 đỏ | xanh | xanh |
  | M5 `thoaCoPhamVi` bỏ qua giá trị false (`flags[k] \|\| !v`) | 4 đỏ | 3 đỏ | 1 đỏ |
  | M6 gỡ "vào được từ baogia" | 4 đỏ (gồm Thương mại `hoanthanh`) | xanh | xanh |
  | M7 gate `danggiao → dagiao` `{vanChuyen:true}` | ngõ cụt **xanh** (đúng kỳ vọng); chỉ test "cạnh RA không gate" đỏ | xanh | xanh |
  | M8 gate `danggiao → dagiao` `{thietBi:false}` | ngõ cụt **đỏ** + 5 ca khác | xanh | 1 đỏ |

  M3/M4/M6 xanh ở exec/e2e là đúng thiết kế: `scopeThietBi=false` không dựng được qua API, bằng chứng AC-2 nằm ở lane domain.
- **AC-14 cổng:** backend `npm test` 79 suite / 1513 ca xanh; `npm run build` ok; `openapi:gen` không drift (openapi.json không đổi); lint 164 = baseline; web typecheck + vitest 17/17 + build ok; design-system 398/398; mobile `flutter test` 265 ok + `flutter analyze` sạch; `npm run test:db` 123/123.
- **AC-12:** `git diff -- backend/src` không chứa `StockMovement|StockItem|onHand|reserved|inventory`.
- **Seam 6.4:** hai cạnh vào `dagiao` ⇒ phiếu xuất phải hook theo đích `to === 'dagiao'`.

### File List

- backend/src/orders/domain/allowed-transition.ts
- backend/test/allowed-transition.spec.ts
- backend/test/order-status-change.spec.ts
- backend/test/orders.e2e.spec.ts
- backend/test/order-status-change.db.integration.spec.ts
- mobile/test/screens/orders/order_detail_screen_test.dart (review: fixture Thương mại)
- web/src/design-system/session/fake-orders-port.ts
- mobile/lib/design_system/session/fake_orders_port.dart
- _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md
- _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-1-nhanh-giao-hang-dang-giao-da-giao.md

## Senior Developer Review (AI)

**Reviewer:** AI (bmad-story-automator-review + ck:code-review), cho Đại Ca — 2026-10-21
**Outcome:** Approve (sau khi sửa) — 0 CRITICAL, 0 HIGH còn lại.

### Kiểm AC / Task
- AC-1…AC-14: đối chiếu code + test — IMPLEMENTED. Task [x] đều có bằng chứng (bảng 17 dòng, `thoaCoPhamVi` thay cả 3 chỗ, `buocVongDoi` reachability, test domain/exec/e2e/DB, fake port, spine/EXPERIENCE).
- Git vs File List: khớp cho source; file untracked khác (`.githooks/`, `docs/*.xlsx`, story-automator) không thuộc story.

### Luật dự án — kiểm bằng đột biến (cp backup, không git checkout)
| Đột biến | Kết quả |
|---|---|
| `chuyenTrangThaiThuCong` đọc đơn qua `findOrThrow` (bỏ scope) | unit 28 đỏ (gồm "đơn ngoài phạm vi ⇒ 404", "where kẹp owner/assignee"), e2e 1 đỏ (404 đơn người khác), DB 1 đỏ (404 + 0 byte storage) |
| `lockOrderRow` bỏ `FOR UPDATE` | lane DB 2 đỏ (TOCTOU chốt × thêm dòng); `npm test` xanh — khoá chỉ đo được trên Postgres thật |
| Bỏ `vanChuyen:false` dòng mới | 9 đỏ (domain+exec+e2e) |
| Bỏ `thietBi:true` dòng `batDauGiao` / dòng mới | 4 đỏ mỗi mutant (domain) |
| Gỡ điều kiện "vào được từ baogia" | 4 đỏ |
| `thoaCoPhamVi` coi key `undefined` là "đòi undefined" | 1 đỏ (test mới) |

Luật (2) tồn kho: story không chạm `StockMovement|StockItem|onHand|reserved|inventory` (AC-12) — không có thao tác tồn mới cần khoá. Luật (3)/(4): không có màn web/mobile mới. Luật (5): không có source-guard mới. Luật (6): `orders.e2e.spec.ts` dùng `initAppOnLoopback`.

### Findings & xử lý
1. **[MEDIUM] Comment cạnh RA `danggiao → dagiao` lỗi thời** (`allowed-transition.ts`) — nói bước VÀO chỉ đòi Vận chuyển và lấy ví dụ "đơn có Vận chuyển mà không Thiết bị" (giờ đơn đó không vào được `danggiao`). → **Đã sửa**: bước vào đòi Thiết bị + Vận chuyển; diễn giải luật "gate ra khác gate vào ⇒ ngõ cụt" ở dạng tổng quát.
2. **[MEDIUM] Fixture stub mobile nói dối hình dạng backend** (`order_detail_screen_test.dart`, ca "thuong_mai renders no Đang thi công") — vẫn dùng chuỗi cũ `[baogia, dachot, hoanthanh]`; backend sau story trả `[baogia, dachot, dacoc, dagiao, hoanthanh]`. → **Đã sửa** fixture + khẳng định `Đang giao` vắng, `Đã giao` có mặt.
3. **[LOW] `thoaCoPhamVi` lệch hợp đồng JSDoc với key `undefined` tường minh** — kiểu `Partial<Record<…, boolean>>` cho phép `{ vanChuyen: undefined }`; bản cũ so `flags.vanChuyen === undefined` ⇒ chặn âm thầm mọi đơn, trái với "cờ vắng = không phụ thuộc". → **Đã sửa** (`giaTri === undefined ||`) + test; mutant hoàn nguyên bị giết.
4. **[LOW — không đổi, có lý do] Nhánh tự-lấy trong hai fake port không có test** — fake không có đường công khai nào đưa đơn tới `dacoc` (chưa có ghi cọc tới Epic 7), nên nhánh này chưa với tới được trong demo; thêm seam test chỉ để soi một "server giả" là YAGNI. Bằng chứng hành vi thật nằm ở backend (domain + e2e).
5. **[LOW — không đổi, có lý do] Executor đánh giá cờ trên bản đọc TRƯỚC khoá** — cờ phạm vi chỉ sửa được ở `baogia` (`update()` → `assertMutable` dưới `FOR UPDATE`), còn `updateMany` cổng theo `status` quan sát được ⇒ không có cửa sổ đổi cờ giữa pre-check và ghi. Không phải lỗi.
6. **[LOW — không đổi] 2 lỗi prettier ở `allowed-transition.ts:423` và `allowed-transition.spec.ts:676`** — có sẵn, ngoài hunk story (nợ lint baseline).

### Cổng sau fix
backend `npm test` 79 suite / 1517 ca xanh · `npm run build` ok · `openapi:gen` không drift · `npm run test:db` (pns-postgres :5433) 123/123 · web typecheck + vitest 17/17 + build ok · design-system 398/398 · mobile `flutter test` 265 ok + `flutter analyze` sạch.

### Change Log

- 2026-10-21 — Story 6.1: thêm cạnh khách tự lấy `dacoc → dagiao`, gate nhiều cờ có phủ định qua `thoaCoPhamVi()`, sửa stepper khoe bước không vào được, đồng bộ fake port web/mobile + spine/EXPERIENCE. Status → review.
- 2026-10-21 — Review (AI): sửa comment cạnh RA lỗi thời, `thoaCoPhamVi` tôn trọng key `undefined`, fixture stepper Thương mại mobile khớp backend; mutation phạm vi/FOR UPDATE xác nhận có canh. Status → done.
