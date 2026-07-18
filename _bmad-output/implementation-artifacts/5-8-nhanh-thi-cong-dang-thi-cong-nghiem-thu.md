---
baseline_commit: 85254af988d8c089daff9530a15a8624902028ff
---

# Story 5.8: Nhánh Thi công — bỏ "Lên lịch" (Đang thi công → Nghiệm thu)

Status: done

## Story

As a người có quyền chuyển bước thi công,
I want các bước thi công chỉ hiện khi cờ Thi công bật,
so that đơn có thi công đi đúng chuỗi Đã cọc → Đang thi công → Nghiệm thu → Hoàn thành, đơn không thi công không lộ bước thừa.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

**Nhánh Thi công ĐÃ ĐƯỢC DỰNG XONG từ Story 5.1/5.4/5.5. Story này KHÔNG dựng lại nó.**

Đây là story **ĐÓNG LANE**: chứng minh nhánh thi công chạy đúng đầu-cuối ở lane HTTP, bịt hai lỗ test còn lại, và gỡ một khẳng định sai trong tài liệu UX. **Kỳ vọng: KHÔNG có dòng nào thay đổi trong `backend/src/`, `web/src/`, `mobile/lib/`.** Nếu bạn thấy mình đang sửa một trong ba thư mục đó, bạn đang đi sai — dừng lại và đọc lại mục này.

### 1. Hai cạnh thi công ĐÃ TỒN TẠI trong bảng — đừng thêm lại

`backend/src/orders/domain/allowed-transition.ts:140-153`:

```ts
{ event: SU_KIEN.batDauThiCong, from: TRANG_THAI_DA_COC,   to: TRANG_THAI_THI_CONG,  requires: PERM.constructionTransition, scopeGuard: 'thiCong' },
{ event: SU_KIEN.xongThiCong,   from: TRANG_THAI_THI_CONG, to: TRANG_THAI_NGHIEM_THU, requires: PERM.constructionTransition, scopeGuard: 'thiCong' },
```

Lối ra của nhánh cũng đã có, `:170-175`:

```ts
{ event: SU_KIEN.hoanThanh, from: TRANG_THAI_NGHIEM_THU, to: TRANG_THAI_HOAN_THANH, requires: PERM.constructionTransition },
```

Bảng hiện có **đúng 16 dòng** (`grep -c "from: TRANG_THAI" backend/src/orders/domain/allowed-transition.ts` = 16). **Story này không được làm số đó đổi.** Story doc 5.7 ghi "19 dòng" theo `grep -c "from:"` — đó là số khác (đếm cả field của interface), đừng chép.

### 2. Bước "Lên lịch thi công" KHÔNG tồn tại trong code — không có gì để xoá

Bộ khoá chính tắc là **10** (`backend/src/orders/domain/order-status.ts:15-25`, `ORDER_STATUS_KEYS` `:67-78`). Không có khoá `lenlich`/`len_lich` nào trong bất kỳ file production nào (backend/web/mobile/design-system). Comment `allowed-transition.ts:32` đã ghi lại việc bỏ bước này.

Vết còn sót **chỉ nằm trong tài liệu UX** (`EXPERIENCE.md:70` và `:98`) — xem Task 4. Các file `.working/*.html` là mockup nháp, **KHÔNG đụng vào**.

### 3. Cờ Thi công tắt ⇒ bước BIẾN MẤT — cơ chế đã có, đừng viết lại ở client

`buocVongDoi()` (`allowed-transition.ts:428-456`) dựng chuỗi stepper bằng BFS trên đồ thị **đã gate theo cờ** (`canhDaGate()` `:380-388`). Cờ tắt ⇒ cạnh biến mất ⇒ bước không có mặt trong chuỗi. `buocKeTiep()` (`:314-330`) lọc cùng một kiểu cho danh sách bước kế.

Client **CẤM** tự suy: source-guard `design-system/screens/order-detail.test.mjs:154-179` cấm hai màn chi tiết chứa literal `'thicong'`/`'nghiemthu'`/`'dacoc'`/… và cấm dựng steps theo `scopeThiCong`. Guard `design-system/screens/order-transition.test.mjs:145-172` cấm literal status/event/cờ trong hai màn chuyển trạng thái. **Các guard này đọc file dạng TEXT THÔ — token bị cấm không được xuất hiện kể cả trong comment.**

### 4. Mobile + Web ĐÃ XONG — không sửa gì

| Thứ | Bằng chứng |
| --- | --- |
| Nhãn `Đang thi công` / `Nghiệm thu` byte-identical hai nền tảng | `web/src/design-system/components/StatusChip.tsx:27-28` ↔ `mobile/lib/design_system/components/status_chip.dart:50-51`, khoá bởi `design-system/components/chip-components.test.mjs:45-56,103` |
| Mobile: bước bị cờ chặn VẮNG MẶT chứ không xám | `mobile/test/screens/orders/order_detail_screen_test.dart:263-276` |
| Mobile: chọn nhánh + gửi `xong_thi_cong` + nhận `nghiemthu` | `mobile/test/screens/orders/order_status_change_screen_test.dart:39-43, 168-179, 294-303` |
| Mobile: ảnh optional (0 ảnh là đường thường) | cùng file `:177-178` |
| Web: fake port đã mô phỏng đủ 3 sự kiện thi công | `web/src/design-system/session/fake-orders-port.ts` — `bat_dau_thi_cong` `:627`, `xong_thi_cong` `:641`, `hoan_thanh` từ `nghiemthu` `:651` |

⇒ **Task backend-only.** Đụng vào `mobile/lib` hay `web/src` trong story này là scope creep.

### 5. Lỗ thật còn lại (và chỉ có bấy nhiêu)

Cạnh `thicong → nghiemthu` **chưa bao giờ chạy qua executor ở lane hermetic**:

- `chuyenTrangThaiThuCong()` chưa từng được gọi với `xongThiCong` trong `backend/test/order-status-change.spec.ts` (mọi case dùng `batDauThiCong`, xem `:105`, `:291`, `:422`).
- `POST /:id/chuyen-trang-thai` chưa từng nhận `event=xong_thi_cong` trong `backend/test/orders.e2e.spec.ts` — cả file **không có** chuỗi `xong_thi_cong`, `hoan_thanh`, lẫn `nghiemthu`. ⚠️ Test dùng hằng `SU_KIEN.batDauThiCong`, **không** dùng literal — grep literal `'bat_dau_thi_cong'` chỉ ra một comment ở `:3296`.
- Coverage duy nhất là `backend/test/order-status-change.db.integration.spec.ts:242-290` (`SU_KIEN.xongThiCong` ở `:258`) — **lane DB**, chỉ chạy khi có Postgres, và **không hề assert literal `'nghiemthu'`** (nó chỉ so `audit.after.status === attachment.statusTo`).
- `hoan_thanh` **từ `nghiemthu`** không có case executor nào. `backend/test/orders.service.spec.ts:3378-3402` chỉ chạy dòng `hoanThanh` xuất phát từ `dachot`, **và còn đi qua lane AUTO** (`chuyenTrangThaiTuDong()`) chứ không phải executor thủ công — lỗ rộng hơn nghe tưởng.

⚠️ Bài học 5.7: **lane DB không được tính là bằng chứng** cho AC — Docker Desktop thường không chạy được từ shell agent. AC phải xanh ở `npm test`.

### 6. KHÔNG viết test cho trạng thái bất khả thi

Đừng thêm case "đơn ở `thicong` nhưng `scopeThiCong=false` ⇒ 409". Trạng thái đó không tồn tại được trong production: muốn vào `thicong` phải qua `dacoc → thicong` vốn đã đòi cờ bật. Test đó chỉ chứng minh guard tự nhất quán, không chứng minh hành vi nghiệp vụ nào. Ranh giới cờ đã được đóng ở `orders.e2e.spec.ts:3327-3337` (`dacoc` + cờ tắt ⇒ 409 `Bước này không thuộc phạm vi của đơn.`).

---

## Acceptance Criteria

### AC gốc (nguyên văn từ `epics.md:533-539`)

- **AC-1** — **Given** Đơn bật cờ Thi công, **When** sau "Đã cọc", **Then** engine cho các bước Đang thi công → Nghiệm thu qua allowed-transition table (bỏ bước "Lên lịch thi công" không còn) (FR-7, AD-7, §2).
- **AC-2** — **Given** Đơn KHÔNG bật cờ Thi công, **When** dựng vòng đời, **Then** không có bước thi công nào xuất hiện (FR-7).
- **AC-3** — **Given** mỗi bước thi công (Đang thi công, Nghiệm thu), **When** chuyển, **Then** đi qua `applyTransition()` (permission + audit + event), cho đính kèm ảnh optional (FR-9, FR-23).

### AC bổ sung (dẫn xuất — đây là phần thực sự phải làm)

- **AC-4** — Lane e2e (`npm test`, không Docker): đơn ở `thicong`, cờ Thi công bật, actor có `construction.transition` ⇒ `POST /orders/:id/chuyen-trang-thai` với `event=xong_thi_cong` trả **200** `{ status: 'nghiemthu', occurredAt, soAnhDaLuu }`.
- **AC-5** — Cùng request, đính kèm 1 ảnh ⇒ `soAnhDaLuu: 1`; bản ghi `Attachment` mang `statusFrom: 'thicong'`, `statusTo: 'nghiemthu'`, và `occurredAt` **trùng** với bản ghi audit của bước (FR-23: ảnh join vào đúng bước bằng cặp khoá này). Gửi 0 ảnh ⇒ **200**, `soAnhDaLuu: 0` — upload luôn optional.
- **AC-6** — `StatusChanged` được publish **SAU commit** với `before.status='thicong'`, `after.status='nghiemthu'`; audit ghi đúng một dòng. (Lane unit, `order-status-change.spec.ts` — mock transaction phải **chạy thân tx rồi mới ném**, mock `mockRejectedValue` trần cho ra xanh giả.)
- **AC-7** — Nhánh thi công **có lối ra**: đơn ở `nghiemthu` + actor có `construction.transition` ⇒ `GET /orders/:id/vong-doi` trả `buocKeTiep` chứa **đúng một** phần tử `{ event: 'hoan_thanh', to: 'hoanthanh', requires: 'construction.transition' }`; `POST` sự kiện đó ⇒ **200** `{ status: 'hoanthanh' }`.
- **AC-8** — Actor **thiếu** `construction.transition` đứng ở `thicong` ⇒ **403** `FORBIDDEN`, status **không đổi**; và `buocKeTiep` của actor đó **rỗng** ⇒ client ẩn hẳn nút (UX-DR-22).
- **AC-9** — Bảng transition **không đổi**: vẫn đúng 16 dòng, bộ khoá vẫn đúng 10, **không** khoá nào tên `lenlich`/`len_lich`. Khoá bằng test, không bằng lời hứa.
- **AC-10** — `EXPERIENCE.md` không còn khẳng định "Lên lịch thi công" là một bước của vòng đời.
- **AC-11** — Mọi gate hiện có giữ xanh: `cd backend && npm test && npm run lint && npm run build && npm run openapi:gen` (không drift), `cd design-system && npm test`, `cd mobile && flutter test && flutter analyze`.

---

## Tasks / Subtasks

- [x] **Task 1 — Đóng cạnh `thicong → nghiemthu` ở lane e2e (AC-1, AC-3, AC-4, AC-5)**
  - [x] Mở `backend/test/orders.e2e.spec.ts`. **Dùng lại nguyên si** các helper đã có, KHÔNG viết helper mới:

    | Helper | Ở đâu | Dùng để |
    | --- | --- | --- |
    | `DON_DACOC` | `:3042-3048` | fixture đơn, `scopeThiCong: true` |
    | đặt status cho case | `:3313-3316` | `orderRepo.findUnique.mockResolvedValue({ ...DON_DACOC, status: 'thicong' })` |
    | `quyenDuLaneThuCong()` | `:3050-3057` | cấp đủ quyền lane thủ công |
    | `givenPermissions(...keys)` | `:255-257` | thu hẹp quyền cho case 403 (mẫu ở `:3340`) |
    | `token()` | `:259-261` | `.set('Authorization', \`Bearer ${token()}\`)` |
    | `post(event, files)` | `:3070-3085` | dựng request multipart + `.attach('anh', …)` |
    | `anh(ghiDe)` | `:3087-3093` | mô tả file (mặc định `cong-truong.jpg`, `image/jpeg`, 1024B) |

  - [x] Thêm case: đơn ở `thicong`, `POST /orders/:id/chuyen-trang-thai` `event=xong_thi_cong` (dùng hằng `SU_KIEN.xongThiCong`, **không** literal), **0 ảnh** ⇒ 200, `status:'nghiemthu'`, `soAnhDaLuu:0`.
  - [x] Thêm case: cùng bước, **1 ảnh** ⇒ 200, `soAnhDaLuu:1`. Đọc payload qua `attachmentRepo.createMany.mock.calls[0][0]` — mẫu destructure có sẵn ở `:3122-3128`. Assert `statusFrom==='thicong'`, `statusTo==='nghiemthu'`.
    ⚠️ Lane e2e **không có sẵn** mẫu assert "occurredAt trùng audit"; mẫu đó nằm ở `order-status-change.spec.ts:189-191` và `:208-215` (`expect(hang.occurredAt).toBe(event.occurredAt)`). Phần join-key thuộc **Task 2** (lane unit), đừng cố nặn nó ở e2e.
  - [x] Thêm case: actor thiếu `construction.transition` ở `thicong` ⇒ 403, đọc lại đơn ⇒ status vẫn `thicong` (AC-8).

- [x] **Task 2 — Đóng cạnh `thicong → nghiemthu` ở lane unit (AC-6)**
  - [x] Mở `backend/test/order-status-change.spec.ts`. Case hiện có đều đi `batDauThiCong` (`:105`); thêm case song song cho `xongThiCong` từ `thicong`.
  - [x] Assert: `updateMany` được gọi với `data: { status: 'nghiemthu' }`; event publish mang `before.status='thicong'`/`after.status='nghiemthu'`.
  - [x] Assert thứ tự publish-sau-commit. ⚠️ Mock `$transaction` phải **thực sự chạy callback** rồi mới ném — `mockRejectedValue` trần khiến test "publish SAU commit" xanh mà không chứng minh gì.

- [x] **Task 3 — Đóng lối ra `nghiemthu → hoanthanh` (AC-7)**
  - [x] `backend/test/allowed-transition.spec.ts`: thêm assert `ke('nghiemthu', DU_CO, QUYEN_THU_CONG)` trả **đúng một** phần tử `{ event: 'hoan_thanh', to: 'hoanthanh', requires: 'construction.transition' }`. Đặt cạnh case `:442-450` để ai đọc thấy cả chuỗi.
    ⚠️ Tên có sẵn, **đừng phát minh fixture mới**: helper là `ke(status, scopeFlags = DU_CO, quyen = TOAN_QUYEN)` (`:413-419`); `DU_CO` = cả ba cờ bật (`:29-33`); bộ quyền thi công là **`QUYEN_THU_CONG`** (`:407-411`). Không có biến nào tên `quyenCoConstruction`.
  - [x] `backend/test/orders.e2e.spec.ts`: đơn ở `nghiemthu` ⇒ `GET /:id/vong-doi` trả `buocKeTiep` đúng phần tử đó, rồi `POST` sự kiện ⇒ 200 `status:'hoanthanh'`.

- [x] **Task 4 — Khoá hình dạng vòng đời + gỡ vết "Lên lịch" (AC-9, AC-10)**
  - [x] `backend/test/allowed-transition.spec.ts`: thêm bất biến — `ALLOWED_TRANSITIONS.length === 16`; và **không** `from`/`to` nào khớp `/l[eê]n.?l[iị]ch/i`. Diễn đạt bất biến trực tiếp ("vòng đời không có bước lên lịch"), **không** nhắc mã story/AC trong tên test.
  - [x] `backend/test/order-status.spec.ts`: assert `ORDER_STATUS_KEYS` có 10 phần tử **ĐÃ TỒN TẠI** ở `:25` (kèm test trùng lặp `:26`, đối chiếu hai chiều `:35`, `:55`). **Không thêm gì** — chỉ xác nhận nó còn xanh.
  - [x] Sửa `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md`: bỏ `Lên lịch thi công` khỏi danh sách nhãn `:70` và khỏi chuỗi nhánh `:98`, kèm một dòng ghi chú ngắn rằng bước này đã bị bỏ khỏi vòng đời. **Chỉ hai chỗ đó.** KHÔNG đụng `.working/*.html`, KHÔNG đụng `prd.md`.

- [x] **Task 5 — Chạy đủ gate (AC-11)**
  - [x] `cd backend && npm test` — phải xanh, **không** cần `DATABASE_URL`.
  - [x] `cd backend && npm run lint && npm run build && npm run openapi:gen` — `openapi.json` **không được** đổi (story này không đổi contract). Nếu nó đổi ⇒ bạn đã sửa `src/`, quay lại mục 🛑.
  - [x] `cd design-system && npm test` và `cd mobile && flutter test && flutter analyze` — chạy để chứng minh **không regression**, không phải để sửa gì.
  - [x] `cd backend && npx jest allowed-transition order-status-change` chạy trước, rồi mới broaden ra cả suite.

- [x] **Task 6 — Kiểm chứng test mới KHÔNG xanh giả (bắt buộc)**
  - [x] Với mỗi test mới, làm một mutation trên **source** (không phải trên test), chạy lại, xác nhận **ĐỎ**, rồi khôi phục:
    - Đổi `to: TRANG_THAI_NGHIEM_THU` thành `TRANG_THAI_HOAN_THANH` ở dòng `xongThiCong` ⇒ test Task 1/2 phải đỏ.
    - Xoá `scopeGuard: 'thiCong'` khỏi dòng `batDauThiCong` ⇒ test cờ-tắt phải đỏ.
    - Xoá dòng `hoanThanh` from `nghiemthu` ⇒ test Task 3 phải đỏ. ⚠️ Bảng có **ba** dòng `hoanThanh` (`:170-175` từ `nghiemthu`, `:176-181` từ `dagiao`, `:182-189` từ `dachot` gate cờ Thiết bị). Phải xoá đúng dòng `:170-175`; xoá nhầm dòng khác thì test Task 3 vẫn xanh và bạn thu được một kết quả mutation GIẢ.
  - [x] ⚠️ Mutation **phải compile được**, nếu không cả suite đỏ vì lý do khác và chẳng chứng minh gì.
  - [x] ⚠️ **TUYỆT ĐỐI không `git checkout`** để khôi phục — code story chưa commit, checkout sẽ xoá sạch. Dùng `cp` backup trước khi mutate.

---

## Dev Notes

### Đường đi của một transition thi công (đọc trước khi viết test)

`backend/src/orders/orders.service.ts:598-729` `chuyenTrangThaiThuCong()` — thứ tự CỐ ĐỊNH:

1. `findScopedOrThrow()` — đơn ngoài phạm vi xem ⇒ **404**, không rò rỉ sự tồn tại.
2. Whitelist `SU_KIEN_THU_CONG` (`allowed-transition.ts:281-287`) — sự kiện ngoài 5 cái ⇒ **409**. `xongThiCong` và `hoanThanh` **đều nằm trong** whitelist.
3. `evaluateTransition()` thuần, pre-check ⇒ **403** (thiếu quyền) / **409** (`scope` hoặc `not_in_table`).
4. `kiemTraAnh()` ⇒ **400** + `fieldErrors` qua exception filter trung tâm (AD-5).
5. Upload R2 (`putObject`) — **trước** transaction; id ảnh sinh trước upload, key `attachments/{orderId}/{id}.{ext}`.
6. `$transaction([applyTransition → attachment.createMany])`.
7. Publish `StatusChanged` **SAU commit**.

`applyTransition()` (`:442-497`) là **con đường DUY NHẤT** ghi `Order.status` (AD-11): lock row (`lockOrderRow` `:421`) → `updateMany({ where: { id, status: statusCu } })` → `count===0` ⇒ ném sentinel của caller. Nó **không** gọi `AuditService`; `AuditSubscriber` ghi log off event (AD-18).

`scopeFlags` đọc thẳng từ row đơn (`:458-462`): `{ thietBi: order.scopeThietBi, thiCong: order.scopeThiCong, vanChuyen: order.scopeVanChuyen }`.

### Mã lỗi phải khớp từng chữ

| Tình huống | HTTP | Message |
| --- | --- | --- |
| Cờ phạm vi chặn | 409 | `Bước này không thuộc phạm vi của đơn.` |
| Cặp (from,event) không có trong bảng | 409 | `Không chuyển được trạng thái đơn từ trạng thái hiện tại.` |
| Thiếu quyền | 403 | envelope `FORBIDDEN` |

Nguồn: `orders.service.ts:464-482` (message 409 ở `:478` và `:479`; nhánh 403 ở `:468-472`, message `Bạn không có quyền thực hiện chuyển trạng thái này.`). Copy chuỗi từ source, **đừng gõ lại từ trí nhớ**.

### Quyền

`construction.transition` — `backend/src/accounts/domain/permission-registry.ts:44` (`constructionTransition`), nhãn `Chuyển bước thi công` `:99-102`. Preset mang nó: `ADMIN` (`role-presets.ts:36`, kéo theo `SUPER_ADMIN` qua spread `:55`), `QUAN_LY` `:66`, `THI_CONG` `:105`. **Không** có ở `KE_TOAN`, `THO_KS`, `KHO_GIAO`.

Endpoint `POST /:id/chuyen-trang-thai` (`orders.controller.ts:774-828`, decorator quyền `:776-780`) dùng `@RequireAnyPermissions(constructionTransition, deliveryConfirm, paymentsRecord)` — cửa mở cho cả ba nhánh, **quyền thật của từng bước do bảng quyết** ở tầng dưới. Đó là lý do AC-8 phải assert 403 chứ không phải 401/404.

### Lane test — biết lane nào chứng minh được gì

| Lane | Lệnh | Chứng minh được | Bẫy |
| --- | --- | --- | --- |
| Domain unit | `npx jest allowed-transition` | bảng, gate cờ, buocKeTiep, buocVongDoi | không chạm HTTP status |
| Service unit | `npx jest order-status-change` | thứ tự tx/publish, shape attachment | mock tx phải chạy thân rồi mới ném |
| e2e in-memory | `npx jest orders.e2e` | **mã HTTP + ValidationPipe + envelope** | đây là lane DUY NHẤT đo được AC về mã HTTP |
| DB integration | `npm run test:db` | round-trip Postgres thật | **cần Docker Desktop GUI** — không tính là bằng chứng AC |
| Web parse | `npx jest web-source-parses` | `.tsx` có parse được không | web không có tsc |

Tách lane bằng config, không bằng `describe.skip`: `backend/package.json:81-84` (`testPathIgnorePatterns` loại `.db.integration.spec.ts`; `testRegex` ở `:80`), nên `npm test` không bao giờ kéo lane DB kể cả khi `DATABASE_URL` đã export.

### Project Structure Notes

Story này **chỉ** chạm:

- `backend/test/orders.e2e.spec.ts` (UPDATE)
- `backend/test/order-status-change.spec.ts` (UPDATE)
- `backend/test/allowed-transition.spec.ts` (UPDATE)
- `backend/test/order-status.spec.ts` (UPDATE, có thể không cần nếu assert đã có)
- `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md` (UPDATE)

**KHÔNG file mới. KHÔNG migration. KHÔNG đổi contract API.** `openapi.json` phải y nguyên.

### Ranh giới với các story khác

- **Nhánh Giao hàng** (`dacoc → danggiao → dagiao`) là **Story 6.1**, không phải story này. Cạnh đã có trong bảng nhưng đừng viết test cho nó ở đây.
- **Auto-transition** `dachot → dacoc` là **Story 5.2** (đã done). Test ở đây bắt đầu từ đơn ĐÃ ở `dacoc`/`thicong`, dựng bằng fixture, không đi qua lane thanh toán.
- **Tồn kho / phiếu xuất** là **Epic 6**. Đường thi công không chạm `StockMovement`.

---

## Bài học từ story trước (áp thẳng vào story này)

1. **AC về mã HTTP chỉ đo được ở lane e2e.** (5.5 AC-13) Đừng viết `it('hiện tại trả 400, không phải 409 như AC')` — đó là ghim một sai lệch thành test xanh, AC vẫn chưa đạt.
2. **Test xanh phải chịu được mutation.** (5.7) Task 6 là bắt buộc, không phải tuỳ chọn. Một test xanh dưới mutation có thể nghĩa là một lớp phòng thủ KHÁC đã cứu nó — nếu vậy, mutate luôn lớp đó.
3. **Widget/e2e test có thể xanh giả vì điều kiện bao ngoài.** (5.7) Fixture phải bật MỌI điều kiện bao ngoài thì assert bên trong mới có nghĩa.
4. **Đừng tin lane DB.** (5.7, 3.6) Docker không lên được từ shell agent; nếu lane DB không chạy được thì **báo là chưa chạy**, không tuyên bố xanh.
5. **Story doc có thể lệch khỏi spine nó trích.** (5.1) Số "19 dòng" ở story 5.7 là ví dụ. Trước khi chép một con số từ story cũ, `grep` lại.

---

## Câu hỏi còn mở

1. `EXPERIENCE.md` là input `sources:` của architecture spine. Story này sửa hai dòng ở đó (Task 4). Nếu Đại Ca muốn giữ tài liệu planning bất biến và chỉ ghi chú "đã bị thay thế", nói trước khi dev chạy — Task 4 sẽ đổi thành thêm dòng ghi chú thay vì sửa nội dung.
2. Mockup `.working/*.html` vẫn vẽ node "Lên lịch TC". Story này cố ý không đụng (là bản nháp, không phải hợp đồng). Nếu chúng còn được dùng làm tham chiếu thị giác thì cần một chỉnh sửa riêng, ngoài phạm vi 5.8.

---

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8] — AC gốc (`:533-539`)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-7] — hybrid state machine gate theo 3 cờ phạm vi
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#AD-11] — enum + bảng transition, một entry point duy nhất
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#AD-18] — domain event qua EventBus port
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#Order state machine] — sơ đồ `DaCoc → DangTC → NghiemThu → HoanThanh`, không có bước lên lịch (`:380-396`)
- [Source: backend/src/orders/domain/allowed-transition.ts:140-153, 170-175, 281-287, 314-330, 428-456]
- [Source: backend/src/orders/orders.service.ts:442-497, 598-729, 1283-1309]
- [Source: backend/src/orders/orders.controller.ts:287-316, 774-828]
- [Source: _bmad-output/implementation-artifacts/5-7-huy-don-kem-ly-do.md] — story trước, bài học mutation-test + lane DB

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

| Lệnh | Kết quả |
| --- | --- |
| `cd backend && npm test` | ✅ 74 suite / 1365 test xanh, **không** cần `DATABASE_URL` |
| `cd backend && npm run build` | ✅ |
| `cd backend && npm run openapi:gen` | ✅ `openapi/openapi.json` **không đổi** (git diff rỗng) |
| `cd backend && npm run lint` | ❌ 162 error — **nợ CÓ SẴN**, xem Completion Notes |
| `cd design-system && npm test` | ✅ 368/368 |
| `cd mobile && flutter test` | ✅ 254 test |
| `cd mobile && flutter analyze` | ✅ No issues found |
| `git diff --stat backend/src` | ✅ **rỗng** — không một dòng nào trong `src/` thay đổi |

### Completion Notes List

**Story đóng lane, không dựng tính năng.** `git diff backend/src` rỗng tuyệt đối, `web/src` và `mobile/lib` không bị chạm — đúng kỳ vọng ở mục 🛑.

**Đã bịt (6 test e2e + 4 test unit + 3 bất biến domain):**

- Cạnh `thicong → nghiemthu` giờ chạy qua **lane e2e** (200, `nghiemthu`, `soAnhDaLuu` 0 và 1, cặp khoá `statusFrom`/`statusTo` trên ảnh) và qua **lane unit** (cổng atomic `updateMany`, cặp trạng thái trên `StatusChanged`, `occurredAt` chung giữa ảnh và event).
- Thứ tự **publish-sau-commit** được canh bằng mock `$transaction` **chạy thân tx rồi mới ném** — không dùng `mockRejectedValue` trần (mock trần cho xanh giả, bài học 5.7).
- **Lối ra `nghiemthu → hoanthanh`** đóng ở cả ba lane: `buocKeTiep` domain, `GET /vong-doi` qua dây, và `POST hoan_thanh` ⇒ 200.
- **AC-8**: actor thiếu `construction.transition` ⇒ 403 + `updateMany` không được gọi (đây là cổng DUY NHẤT ghi status theo AD-11 — đọc lại đơn từ mock không chứng minh thêm gì), và `buocKeTiep` rỗng ⇒ client ẩn hẳn nút.
- **AC-9**: bảng khoá ở đúng 16 dòng; không `from`/`to` nào, cũng không khoá nào trong `ORDER_STATUS_KEYS`, khớp `/l[eê]n.?l[iị]ch/i`. `order-status.spec.ts` đã có sẵn assert 10 khoá + đối chiếu hai chiều ⇒ **không thêm gì**, chỉ xác nhận còn xanh.

**Task 6 — 4 mutation trên SOURCE, mỗi cái đều compile được, khôi phục bằng `cp` backup (không `git checkout`):**

| Mutation | Kết quả |
| --- | --- |
| `xongThiCong` đổi đích `nghiemthu` → `hoanthanh` | ĐỎ đúng 5 test mới của Task 1/2 |
| gỡ `scopeGuard: 'thiCong'` khỏi `batDauThiCong` | ĐỎ 10 test, gồm test cờ-tắt |
| xoá dòng `hoanThanh` **từ `nghiemthu`** (đúng dòng, hai dòng `hoanThanh` kia còn nguyên, bảng còn 15) | ĐỎ đúng 3 test lối ra + test 16 dòng |
| thêm khoá `lenlich` vào `ORDER_STATUS_KEYS` | ĐỎ đúng test "vòng đời KHÔNG có bước lên lịch" ⇒ guard không rỗng |

Sau mỗi mutation, `git diff --stat backend/src` được kiểm lại là rỗng.

**⚠️ AC-11 KHÔNG đạt trọn — `npm run lint` đỏ, nhưng là nợ CÓ SẴN:**

- 162 error ở 27 file (160 `prettier/prettier`, 1 `no-useless-escape`, 1 `import/first`), có cả trong `src/`.
- Đo baseline bằng cách stash 3 file test của story: **162 error trước, 162 error sau** ⇒ story 5.8 thêm **0 error**.
- Story chỉ thêm 1 **warning** `no-unsafe-argument` (đọc `mock.calls[0][0]` vốn là `any`) — trùng loại với warning đã có sẵn ở test anh em `orders.e2e.spec.ts:3125`, giữ nguyên cho nhất quán style.
- Đại Ca đã quyết: **ghi nhận nợ, tách thành việc riêng**, không kéo diff format ~27 file vào story này.

**Câu hỏi mở #1 của story đã xử theo phương án mặc định:** `EXPERIENCE.md` được sửa nội dung ở đúng hai chỗ + thêm một dòng ghi chú bước đã bị bỏ. `.working/*.html` và `prd.md` không đụng (câu hỏi mở #2 vẫn để ngỏ).

### File List

- `backend/test/orders.e2e.spec.ts` (UPDATE)
- `backend/test/order-status-change.spec.ts` (UPDATE)
- `backend/test/allowed-transition.spec.ts` (UPDATE)
- `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md` (UPDATE)
- `_bmad-output/implementation-artifacts/tests/test-summary-story-5-8.md` (NEW — tóm tắt vòng QA automation)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE — trạng thái story)
- `_bmad-output/implementation-artifacts/5-8-nhanh-thi-cong-dang-thi-cong-nghiem-thu.md` (UPDATE — story file)

`backend/test/order-status.spec.ts` **không** đổi: assert 10 khoá đã tồn tại sẵn và vẫn xanh.

## Senior Developer Review (AI)

Reviewer: Phan Nhat Quang · Ngày: 2026-07-18 · Kết quả: **Approve** (đã tự sửa, 0 vấn đề CRITICAL còn lại)

### Đã kiểm chứng độc lập (không tin lời story)

| Khẳng định của story | Cách kiểm | Kết quả |
| --- | --- | --- |
| `git diff backend/src` rỗng | `git diff --stat src/` sau mỗi lần restore | ✅ rỗng |
| Bảng đúng 16 dòng | `grep -c "from: TRANG_THAI"` | ✅ 16 |
| 403 của AC-8 đến từ BẢNG, không phải route guard | đọc `orders.controller.ts:776-780` — `deliveryConfirm` nằm trong `@RequireAnyPermissions` ⇒ route mở, bảng chặn | ✅ đúng tầng |
| `openapi.json` không drift | `npm run openapi:gen` + `git diff openapi/` | ✅ rỗng |
| lint 162 error là nợ có sẵn | `npm run lint`, lọc theo 3 file story | ✅ 162; mọi error trong 3 file đều ở dòng CŨ (`:468`, `:87/307/308`, `:3087/3149/3150`), ngoài block mới ⇒ story thêm **0 error** |

### Đột biến do reviewer tự chạy (backup bằng `cp`, KHÔNG `git checkout`)

| Đột biến trên `src/` | Kỳ vọng | Thực tế |
| --- | --- | --- |
| Gỡ `scopeGuard: 'thiCong'` khỏi dòng **`xongThiCong`** (dòng anh em mà story 5.7 từng bỏ sót) | ĐỎ | ✅ ĐỎ 1 test |
| Đổi `requires` của dòng `hoanThanh` từ `nghiemthu` → `deliveryConfirm` | ĐỎ | ✅ ĐỎ 2 test (cả domain lẫn e2e) |
| Đổi quyền trong test `buocKeTiep` RỖNG thành `constructionTransition` (thăm dò khả năng với tới) | ĐỎ | ✅ ĐỎ ⇒ assert rỗng do QUYỀN, không phải do đường đi luôn rỗng — không xanh giả |
| Nhân đôi `publish` trên đường **thủ công** (`orders.service.ts:723`) | ĐỎ | ⚠️ **XANH trước khi sửa** — xem Finding 1 |

### Findings đã sửa

**1. [MEDIUM] AC-6 đòi "audit ghi đúng một dòng" nhưng không lane nào đếm số lần publish.**
Mọi test đọc `eventBus.publish.mock.calls[0]` mà không ai assert `toHaveBeenCalledTimes`. Nhân đôi `await this.eventBus.publish(statusChanged)` trên đường thủ công ⇒ **cả lane unit vẫn xanh**, trong khi `AuditSubscriber` ghi log off event (AD-18) sẽ đẻ ra hai dòng audit cho một bước xảy ra một lần.
→ Đã thêm `expect(eventBus.publish).toHaveBeenCalledTimes(1)` vào `order-status-change.spec.ts`. Chạy lại đột biến: **ĐỎ đúng 1 test** ⇒ assert không rỗng nghĩa.

**2. [LOW] Test gate cờ chỉ đọc dòng ĐẦU mang sự kiện đó.**
`ALLOWED_TRANSITIONS.find((r) => r.event === event)` — bảng cho phép nhiều dòng cùng sự kiện (`hoanThanh` 3 dòng, `huy` 3 dòng, `chot` 2 dòng). Hôm nay `xongThiCong`/`batDauThiCong` mỗi cái đúng 1 dòng nên test đúng, nhưng thêm một dòng anh em không gate về sau sẽ lọt — đúng loại lỗ mà chính test này sinh ra để bịt.
→ Đổi sang `filter` + assert MỌI dòng đều gate, kèm `length > 0` để không xanh rỗng.

**3. [MEDIUM] File List thiếu `tests/test-summary-story-5-8.md`** (file mới, chưa track trong git).
→ Đã bổ sung vào File List.

### Không phải finding (ghi lại lý do)

- **AC-11 `npm run lint` đỏ**: 162 error là nợ có sẵn ở 27 file, story thêm 0. Đại Ca đã quyết tách thành việc riêng — không đảo quyết định đó trong review.
- **Không test "đơn ở `thicong` + cờ tắt ⇒ 409"**: §6 story cấm đúng, trạng thái đó bất khả thi trong production. Gate của cạnh thứ hai được canh bằng bất biến ĐỌC BẢNG thay vì dựng đơn — đúng loại bằng chứng.
- **Lane DB không chạy**: đúng chủ trương, AC đã xanh hết ở `npm test` không cần Docker.

### Gate sau khi sửa

`backend`: 74 suite / **1366 test** xanh · build ✅ · `openapi.json` không đổi · lint **162 error** (y baseline).
`design-system`: 0 fail · `mobile`: 254 test ✅ + `flutter analyze` No issues.

## Change Log

| Ngày | Thay đổi |
| --- | --- |
| 2026-07-18 | Review: bịt 2 lỗ test (publish đúng một lần trên lane thủ công; gate cờ đọc MỌI dòng cùng sự kiện chứ không chỉ dòng đầu), bổ sung File List thiếu. Xem "Senior Developer Review (AI)". |
| 2026-07-18 | Đóng lane nhánh Thi công: thêm 6 test e2e (`thicong → nghiemthu → hoanthanh`, 403 thiếu quyền, `buocKeTiep` rỗng), 4 test unit (cổng atomic, cặp trạng thái event, khoá join ảnh, publish-sau-commit), 3 bất biến domain (16 dòng bảng, không có bước lên lịch, lối ra `nghiemthu` đúng một bước). Gỡ "Lên lịch thi công" khỏi `EXPERIENCE.md`. Không đổi `src/`, không đổi contract API. |
