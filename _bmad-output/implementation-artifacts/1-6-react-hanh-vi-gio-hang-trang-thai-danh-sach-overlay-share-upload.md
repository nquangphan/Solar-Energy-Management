---
baseline_commit: cf9270c
---

# Story 1.6: React — hành vi giỏ hàng, trạng thái danh sách, overlay, share, upload

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên web**,
I want **các mẫu tương tác chuẩn (dòng giỏ hàng, trạng thái list, dialog/bottom-sheet, share, upload ảnh) đóng gói thành component design-system, phẳng "Viền nét", KHÔNG chứa business logic**,
so that **các màn tính năng (Epic 3–8) dùng lại HÀNH VI chuẩn thay vì tự cài — và không ai vô tình tự tính tiền client-side, tự đổi trạng thái đơn, hay tự upload R2 (vi phạm AD-10/16, AD-11, AD-3)**.

## Acceptance Criteria

1. **Given** component dòng giỏ hàng, **When** sửa số lượng/đơn giá, **Then** thay đổi **phát ngay qua callback** (`onQtyChange`/`onUnitPriceChange`) **không cần nút lưu**; dòng pick từ Sản phẩm auto-điền đơn giá (do **caller** truyền, KHÔNG do component tính), dòng tự do/gói nhập tay; cờ "linh động/dự kiến" **chỉ hiển thị** (không ảnh hưởng giá); có **nút xoá dòng** (`onDelete`) — và **component KHÔNG tự nhân `qty × unitPrice` hay tính tổng bất kỳ** (`amount` render từ prop backend trả, bất biến AD-10/16, UX-DR-24).
2. **Given** các mẫu trạng thái list, **When** render, **Then** **Loading** = skeleton (thanh xám `.skel` khớp layout); **Empty** = câu Việt ngắn + hành động chính (vd "Chưa có đơn nào. Bấm ➕Tạo để bắt đầu."); **Error** = thông báo cụ thể (Banner danger) + nút "Thử lại"; **Confirm** = Dialog nêu hậu quả; **phone-search-empty** = "SĐT chưa có trong hệ thống." + nút inline "Tạo khách hàng mới" (UX-DR-19).
3. **Given** quy tắc overlay, **When** mở overlay, **Then** **Dialog** (web + mobile) cho hành động tiền/dữ liệu có hệ quả (Chốt, Huỷ, Duyệt, ghi thanh toán) — nổi bằng **viền ink 1.5px trên backdrop mờ, KHÔNG drop-shadow**; **Sheet** (bottom sheet) cho lựa chọn nhanh; **Esc đóng overlay trên cùng**, click backdrop đóng, **chồng tối đa một cấp**; và **overlay KHÔNG tự đổi `Order.status`** — chỉ thu thập ý định rồi gọi callback (AD-11, UX-DR-20, UX-DR-26).
4. **Given** yêu cầu chia sẻ, **When** bấm Share, **Then** web gọi **Web Share API** (`navigator.share`) ưu tiên **file ảnh** (hoặc PDF); nếu trình duyệt không hỗ trợ share file → **fallback tải file** (download) — tương đương native share (UX-DR-21).
5. **Given** upload ảnh, **When** người dùng thêm ảnh, **Then** web **chọn file** qua `<input type="file" accept="image/*">`, hiện thumbnail, **xoá được**, **luôn optional** (không validate bắt buộc); và **component KHÔNG upload lên R2** — chỉ phát `File` đã chọn qua `onAdd`, backend lo lưu R2 (AD-3, UX-DR-25).

## Tasks / Subtasks

- [x] **Task 1 — Nối CSS overlay/sheet/thumbs/skeleton + backdrop `.scrim` vào `components.css` (AC: 2, 3, 5)**
  - [x] **Nối thêm** (append) một khối CSS vào **cuối** `web/src/design-system/components/components.css` (sau khối KPI Story 1.5, hiện dòng 131). **KHÔNG** đụng bất kỳ khối đã ship (`.btn/.card/.frame/.field/.chip*/.banner/.table/.step*/.kpi*`).
  - [x] **Copy verbatim** từ `mockups/all-screens.html` các khối (giữ nguyên mọi hằng hex/px không phải token): **Dialog** `.modal`/`.modal-head`/`.modal-head .mt`/`.modal-body`/`.modal-foot` (dòng 176–180); **Sheet** `.sheet`/`.sheet-grab` (dòng 181–182); **Upload** `.thumbs`/`.thumb`/`.thumb.add` (dòng 164–167). Xem bảng "Đặc tả CSS verbatim" trong Dev Notes.
  - [x] **Remap tên biến radius (gotcha bắt buộc — tiền lệ 1.3/1.4/1.5):** mockup dùng `var(--r)`/`var(--r-lg)` (undefined trong `tokens.css`). Thay: `.modal{…border-radius:var(--r-lg)…}` → `var(--radius-lg)`; `.thumb{…border-radius:var(--r)…}` → `var(--radius)`; `.sheet-grab{…border-radius:99px}` → `var(--radius-full)` (tiền lệ 1.4 remap pill 999px→`--radius-full`). **Giữ nguyên** `.sheet{border-radius:18px 18px 0 0}` (DESIGN.md dòng 226 chốt "sheet đáy bo 18px" — hằng có chủ đích, KHÔNG token). Drift-guard test "no raw --r*" (test 4 của 1.3) chặn mọi `var(--r*)` sót.
  - [x] **Backdrop `.scrim` (MỚI — không có verbatim trong mockup, xem gotcha "overlay demo vs backdrop thật"):** thêm:
    ```css
    .scrim{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(12,31,28,.32)}
    .scrim.scrim--sheet{align-items:flex-end;justify-content:stretch;padding:0}
    ```
    `rgba(12,31,28,.32)` = `--ink` (#0C1F1C) ở alpha .32 (làm mờ nền, KHÔNG drop-shadow). **KHÔNG** append `.overlay` của mockup (dòng 174–175) — đó là hộp gallery viền đứt để canh modal trong trang tĩnh, KHÔNG phải backdrop production (xem gotcha).
  - [x] **Skeleton `.skel` (extract từ inline mockup):** mockup vẽ skeleton bằng inline `background:var(--surface-2);border-radius:6px` (dòng 1207–1208). Rút thành helper token-based để màn KHÔNG style ad-hoc (AD-13):
    ```css
    .skel{background:var(--surface-2);border-radius:6px}
    ```
    Bề rộng/cao do component/màn set (prop), `.skel` chỉ chuẩn hoá màu + bo. `6px` là hằng skeleton (mockup verbatim, không token). **KHÔNG** thêm animation/gradient shimmer (giữ tĩnh như mockup + tránh drop-shadow/gradient vi phạm "Viền nét").
  - [x] **Viền nét (AC-3):** khối mới **KHÔNG** thêm `box-shadow`/`gradient`/`background-image` nào. Modal/sheet nổi bằng **viền ink 1.5px** (đã có trong `.modal`/`.sheet`) trên `.scrim` mờ. Drift-guard test 3 của 1.5 (cấm gradient/bg-image + chỉ cho ring stepper) tự bao khối mới — xác nhận vẫn pass (khối này 0 shadow).
- [x] **Task 2 — Component dòng giỏ hàng `CartLineRow` (AC: 1)**
  - [x] `CartLineRow.tsx`: render **một `<tr>`** để đặt trong `<Table><tbody>`. Props:
    `{ name: string; sku?: string; meta?: string; qty: number; unitPrice: number; amount: number; editable?: boolean; flag?: string; zebra?: boolean; onQtyChange?: (qty: number) => void; onUnitPriceChange?: (unitPrice: number) => void; onDelete?: () => void }`.
  - [x] **Cột 1 (Món/SKU):** `<td>` chứa `<span className="strong">{name}</span>` + (`sku`||`meta`) trong `<span className="micro muted">` xuống dòng; nếu `flag` → thêm `<span className="micro muted">` hiển thị cờ (**chỉ hiển thị**, không tác động giá).
  - [x] **Cột SL / Đơn giá:** nếu `editable` → `<input className="field" inputMode="numeric" value={qty}>` (và tương tự `unitPrice`), `onChange` **phát ngay** `onQtyChange(Number(...))` / `onUnitPriceChange(Number(...))` — KHÔNG nút lưu, KHÔNG debounce chặn. Nếu `!editable` → render số tĩnh `<span className="num mono">`. Ô đặt class `.num` (canh phải).
  - [x] **Cột Thành tiền:** `<td className="num strong mono">{amount}</td>` — **render THẲNG `amount` từ prop**. 🚫 **TUYỆT ĐỐI KHÔNG** viết `qty * unitPrice`, `qty*price`, cộng dồn, format tiền, hay bất kỳ số học tiền nào trong component (bất biến AD-10/16: chỉ `orders/domain` backend tính; client gọi `POST /orders/preview-total`, chỉ **hiển thị** số backend trả). `amount` là **số backend đã tính**, caller truyền vào.
  - [x] **Xoá dòng:** nếu `onDelete` → nút icon `<button className="btn btn--ghost btn--sm" aria-label="Xoá dòng"><Icon name="ic-trash"/></button>` trong cột cuối (hoặc cột hành động). **Swipe-to-delete** là hành vi **mobile/Flutter (Story 1.7)** — web dùng nút; ghi rõ trong docstring, KHÔNG cài swipe ở web.
  - [x] Row nhận `className` zebra khi `zebra` (áp `tr.zebra` — CSS Table 1.5). Header/thead do **màn** tự viết (đúng hợp đồng `Table` của 1.5: `Table` là wrapper `<table>`, ô/hàng do màn áp class).
- [x] **Task 3 — Overlay: `Dialog`, `ConfirmDialog`, `Sheet` (AC: 3)**
  - [x] `Dialog.tsx` (controlled, stateless): props
    `{ open: boolean; title?: ReactNode; onClose: () => void; tone?: 'default' | 'danger'; footer?: ReactNode; closeLabel?: string; children: ReactNode }`.
    - Khi `!open` → **return null** (không render — đây là cách "chồng tối đa một cấp": mỗi Dialog tự ẩn khi đóng; **KHÔNG** lồng Dialog trong Dialog, ghi rõ trong docstring).
    - Khi `open` → `<div className="scrim" onClick={backdrop→onClose}><div className="modal {tone==='danger'?'card--ink':''}" role="dialog" aria-modal="true" onClick={stopPropagation}>`… `.modal-head` (title + nút `<button aria-label="Đóng"><Icon name="ic-close"/></button>` → onClose) … `.modal-body` (children) … `footer && <div className="modal-foot">{footer}</div>`.
    - **Esc đóng (UX-DR-26):** `useEffect` gắn `keydown` trên `document` khi `open`, `e.key==='Escape'` → `onClose()`; cleanup khi đóng/unmount. **Focus:** khi mở, focus vào modal (`ref.focus()` với `tabIndex={-1}`); (khôi phục focus trước đó là nice-to-have — xem open question).
  - [x] `ConfirmDialog.tsx` (thin wrapper trên `Dialog` — chuẩn hoá UX-DR-19 "Confirm = dialog nêu hậu quả" + UX-DR-20 consequential): props
    `{ open; title; consequence: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'default'|'danger'; onConfirm: () => void; onCancel: () => void }`.
    Render `Dialog` với body = `<Banner tone={tone==='danger'?'danger':'warn'}>{consequence}</Banner>` + footer = nút xác nhận (`btn--danger` nếu danger, else `btn--primary`) + nút huỷ (`btn--ghost`). **`onConfirm` chỉ phát ý định** — KHÔNG tự đổi trạng thái/gọi API (AD-11: màn feature gọi backend).
  - [x] `Sheet.tsx` (bottom sheet, controlled): props `{ open; onClose; title?: ReactNode; children }`. `!open`→null. `open`→`<div className="scrim scrim--sheet" onClick={backdrop→onClose}><div className="sheet" role="dialog" aria-modal="true" onClick={stop}><div className="sheet-grab"/>`… title row (+ nút đóng) … children. Esc đóng như Dialog. **Ghi rõ:** Sheet dành cho **lựa chọn nhanh** (UX-DR-20); hành động tiền/dữ liệu có hệ quả **BẮT BUỘC dùng `Dialog`**, không dùng `Sheet`.
- [x] **Task 4 — Trạng thái list: `Skeleton`, `EmptyState`, `ErrorState` (AC: 2)**
  - [x] `Skeleton.tsx`: props `{ width?: string | number; height?: string | number; radius?: string | number; className?: string }`. Render `<div className={['skel', className].filter(Boolean).join(' ')} style={{width, height, borderRadius: radius}} aria-hidden="true" />`. Đây là **khối dựng** skeleton; màn ghép nhiều `Skeleton` khớp layout (mockup ghép 2 thanh/row). (Có thể thêm `SkeletonText` tiện ích sau — YAGNI: chỉ `Skeleton` là đủ.)
  - [x] `EmptyState.tsx`: props `{ icon?: IconName; title: string; message?: string; action?: ReactNode }`. Render khối canh giữa (theo mockup dòng 1196–1203): icon lớn mờ (nếu có, dùng `Icon`), `title` (micro/đậm), `message` (`<p>` 12px), rồi `action` (slot — thường `<Button>`). **Dùng cho cả** empty-list ("Chưa có đơn nào…") **và phone-search-empty** ("SĐT chưa có trong hệ thống." + `action=<Button href/onClick>Tạo khách hàng mới</Button>`). KHÔNG hard-code chuỗi Việt trong component — **màn truyền** `title/message/action` (i18n-friendly + tái dùng nhiều màn).
  - [x] `ErrorState.tsx`: props `{ message: string; onRetry?: () => void; retryLabel?: string }`. Render `<Banner tone="danger" icon="ic-alert">{message}</Banner>` + (nếu `onRetry`) `<Button variant="ghost" size="sm" onClick={onRetry}><Icon name="ic-refresh"/> {retryLabel??'Thử lại'}</Button>` (theo mockup dòng 1211–1213). **Tái dùng `Banner`/`Button` đã ship** — KHÔNG dựng lại banner.
- [x] **Task 5 — Share (Web Share API) + Upload ảnh (AC: 4, 5)**
  - [x] `share.ts` (util thuần, không CSS): `export async function shareFiles(opts: { files?: File[]; title?: string; text?: string; fallbackDownload?: boolean }): Promise<'shared' | 'downloaded' | 'unsupported'>`.
    - Nếu `opts.files?.length` và `navigator.canShare?.({ files })` → `await navigator.share({ files, title, text })` → return `'shared'`.
    - Ngược lại, nếu `fallbackDownload !== false` và có file → tạo `URL.createObjectURL(file)` + `<a download>` click + `revokeObjectURL` → return `'downloaded'` (tương đương "web = share/download", UX-DR-21).
    - Ngược lại return `'unsupported'`. Ưu tiên **ảnh trước PDF** khi caller truyền cả hai (caller sắp `files` theo thứ tự ưu tiên: `[image, pdf]`). Bọc `try/catch` `AbortError` (user huỷ share) → không throw.
  - [x] `ShareButton.tsx` (mỏng): props `{ files?: File[]; title?: string; text?: string; label?: string; variant?: ButtonVariant; onResult?: (r) => void }`. Render `<Button variant={variant??'default'} onClick={()=>shareFiles({files,title,text}).then(onResult)}><Icon name="ic-share"/> {label??'Share'}</Button>`. **KHÔNG** dựng `.share-grid`/`.share-app` (lưới app chia sẻ là **visual native mobile / Flutter Story 1.7**; web dùng OS share sheet qua `navigator.share`, không tự vẽ lưới app).
  - [x] `ImageUpload.tsx` (controlled): props
    `{ images: { id: string; url?: string; name?: string }[]; onAdd: (files: File[]) => void; onRemove?: (id: string) => void; max?: number; accept?: string; multiple?: boolean; hint?: string }`.
    - Render `<div className="thumbs">`: mỗi `images[]` → `.thumb` (nếu `url` → `<img>` phủ kín; else `<Icon name="ic-image"/>`) + (nếu `onRemove`) nút xoá nhỏ (`aria-label="Xoá ảnh"`, `Icon ic-close`/`ic-trash`).
    - Ô thêm: `<label className="thumb add">` bọc `<input type="file" accept={accept??'image/*'} multiple={multiple??true} hidden>` + `<Icon name="ic-plus"/>`; `onChange` → `onAdd(Array.from(files))` rồi reset `input.value=''` (cho phép chọn lại cùng file). Ẩn ô thêm khi `max` đạt.
    - `hint` → `<p className="micro muted">{hint}</p>` (vd "Chụp hoặc chọn từ máy · nhiều ảnh").
    - 🚫 **KHÔNG** upload/`fetch`/gọi R2/tạo signed URL trong component — chỉ phát `File[]` qua `onAdd` (AD-3: backend trung gian R2). **Upload luôn optional** — KHÔNG có validate "bắt buộc ≥1 ảnh" (UX-DR-25).
  - [x] Cập nhật `index.ts` barrel: export `CartLineRow`(+`CartLineRowProps`), `Dialog`(+`DialogProps`), `ConfirmDialog`(+`ConfirmDialogProps`), `Sheet`(+`SheetProps`), `Skeleton`(+`SkeletonProps`), `EmptyState`(+`EmptyStateProps`), `ErrorState`(+`ErrorStateProps`), `ShareButton`(+`ShareButtonProps`), `ImageUpload`(+`ImageUploadProps`), và `shareFiles` từ `./share`. **KHÔNG** xoá/sửa export Story 1.3/1.4/1.5.
- [x] **Task 6 — Drift-guard CSS + source-guard TSX (AC: 1, 2, 3, 4, 5)**
  - [x] **Mở rộng `design-system/components/components.test.mjs`** (CSS drift-guard, đọc file như text):
    - **Đủ selector:** `.scrim`, `.scrim--sheet`, `.modal`, `.modal-head`, `.modal-head .mt`, `.modal-body`, `.modal-foot`, `.sheet`, `.sheet-grab`, `.thumbs`, `.thumb`, `.thumb.add`, `.skel` (thiếu một = fail).
    - **Verbatim lõi:** `.modal{width:340px;…border:1.5px solid var(--ink);border-radius:var(--radius-lg)…}`; `.modal-head` có `border-bottom:1.5px solid var(--line)`; `.modal-foot` có `border-top:1.5px solid var(--line)`; `.sheet` có `border:1.5px solid var(--ink);border-radius:18px 18px 0 0`; `.sheet-grab` có `border-radius:var(--radius-full)`; `.thumb` có `border:1.5px solid var(--line);border-radius:var(--radius)`; `.thumb.add` có `border-style:dashed;border-color:var(--teal)`; `.scrim` có `position:fixed;inset:0` và `background:rgba(12,31,28,.32)`; `.skel{background:var(--surface-2);border-radius:6px}`.
    - **Radius remap:** toàn file **KHÔNG** còn `var(--r)`/`var(--r-lg)` (test 4 của 1.3 tự bao — xác nhận vẫn pass); `.modal` dùng `var(--radius-lg)`, `.thumb` dùng `var(--radius)`, `.sheet-grab` dùng `var(--radius-full)`.
    - **Viền nét:** test 3 của 1.5 (no gradient/bg-image + chỉ ring stepper) tự bao khối mới — xác nhận **0 box-shadow/gradient** trong khối overlay/sheet/thumb/scrim/skel (fail nếu ai thêm drop-shadow cho modal).
    - **Cross-file token integrity:** test cuối (mọi `var()` có trong tokens.css) tự bao — xác nhận `--radius-full`, `--surface-2`, `--ink`, `--line`, `--teal` (mới dùng) đều tồn tại (đã verify).
  - [x] **Tạo `design-system/components/behavior-components.test.mjs`** (source-guard TSX, đọc `.tsx`/`.ts` như text — theo pattern `chip-components.test.mjs`/`data-feedback-components.test.mjs`; **strip comment trước khi quét** để tránh false-positive, tiền lệ 1.4):
    - **CartLineRow — chặn số học tiền (bất biến AD-10/16, CRITICAL):** sau khi strip comment/string, **assert KHÔNG** khớp `/qty\s*[*]\s*unit|unit\w*\s*[*]\s*qty|[*]\s*unitPrice|qty\s*[*]/i` hay tính tổng; **assert** file **render `amount`** trực tiếp (chứa `{amount}` hoặc `amount}`); assert có `onQtyChange`, `onUnitPriceChange`, `onDelete`. (Test này là rào **quan trọng nhất** — bắt mọi mưu toan tính tiền client-side.)
    - **Dialog/Sheet:** assert `Dialog.tsx` có `Escape` + `onClose` + `return null` (hoặc `!open`) + `role="dialog"`; `Sheet.tsx` tương tự + `scrim--sheet`. `ConfirmDialog.tsx` **dùng lại** `Dialog` (import `./Dialog`) — không tự vẽ modal.
    - **ImageUpload — chặn upload (AD-3):** assert có `type="file"`, `accept`, `onAdd`; **assert KHÔNG** chứa `fetch(`, `R2`, `signed`, `upload(` (component không tự upload).
    - **share.ts:** assert gọi `navigator.share` và có nhánh fallback `download` (`createObjectURL` / `download`).
    - **EmptyState/ErrorState:** assert `ErrorState` dùng `Banner` + có `Thử lại`/`retry`; assert không hard-code chuỗi list-cụ-thể trong `EmptyState` (nhận `title` qua prop).
    - **Barrel:** assert `index.ts` export đủ 9 component + `shareFiles`, và **vẫn** export Story 1.3/1.4/1.5 (không hồi quy).
  - [x] Chạy `cd design-system && npm test` — **toàn bộ pass, 0 hồi quy** token/icon/Story 1.3/1.4/1.5. Test phải **fail** nếu: ai đổi/xoá selector CSS mới, lệch verbatim, quên remap radius, thêm shadow/gradient, **hoặc viết số học tiền trong CartLineRow / upload R2 trong ImageUpload**.

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep + chống vi phạm bất biến)

- Story này **CHỈ WEB (React)** — giao **behavior/interaction layer**: 1 khối CSS (overlay/sheet/thumbs/skeleton/scrim) + 9 component + 1 util + mở rộng drift-guard + source-guard mới. Đây là mảnh **hành vi** mà Story 1.5 đã **chủ ý hoãn sang 1.6** (xem 1-5 Dev Notes: "Hành vi (giỏ hàng, trạng thái danh sách, overlay, share, upload) → Story 1.6").
- **Component là PRIMITIVE hành vi, KHÔNG phải màn tính năng.** Story 1.6 **không** dựng màn Giỏ hàng thật (đó là **Story 4.1/4.2** backend+web), không dựng màn Chi tiết đơn (5.4), không màn Chia sẻ (4.8). Nó cấp **component tái dùng** để các màn đó ráp lại — đúng AD-13 "design-system-first, dựng component trước mọi màn".
- **Bất biến KHÔNG được chạm (component chỉ là vỏ hành vi, logic ở backend):**
  - 🚫 **KHÔNG tính tiền/thuế client (AD-10/16):** `CartLineRow` render `amount` **từ prop** (backend trả qua `POST /orders/preview-total`). Component **không** nhân `qty×unitPrice`, không cộng tổng, không tính VAT. "Tổng nhảy realtime" = **màn** gọi `preview-total` mỗi lần `onQtyChange`/`onUnitPriceChange` bắn — **component chỉ phát sự kiện tức thì**, backend tính, màn hiển thị.
  - 🚫 **KHÔNG đổi `Order.status` (AD-11):** `Dialog`/`ConfirmDialog` (Chốt/Huỷ/Duyệt/thanh toán) **chỉ thu ý định** (`onConfirm`) rồi callback; **màn** gọi backend, backend chạy `applyTransition()`. Overlay không chứa transition logic.
  - 🚫 **KHÔNG upload R2 (AD-3):** `ImageUpload` phát `File[]` qua `onAdd`; **màn/backend** lo signed URL + R2. Component không `fetch`/không đụng mạng.
  - 🚫 **KHÔNG chuỗi quyền literal (AD-17):** component không tự gate quyền; gating hiển thị/disable là **Story 1.10** (primitive gating). 1.6 chỉ nhận prop/callback.
- **Ngoài phạm vi (thuộc story khác — KHÔNG làm ở đây):**
  - **Swipe-to-delete, bottom-sheet native, share-grid app (Zalo/Messenger…), chụp ảnh camera** → **hành vi/visual MOBILE = Flutter Story 1.7**. Web: xoá bằng nút, share bằng `navigator.share`/download, upload bằng file picker. KHÔNG append `.share-grid`/`.share-app`, KHÔNG cài swipe ở web.
  - **`.list-row`, `.pill`, `.kv`, `.mtotals`, `.seg`, `.toolbar`, `.doc`, `.chart`** (còn trong mockup, chưa ship) → **KHÔNG** thuộc 5 AC của 1.6; không append. Nếu màn sau cần, story đó append hoặc grooming bổ sung. (`.pill` cho cờ "dự kiến" → 1.6 render cờ bằng `.micro muted` text, không dựng `.pill`.)
  - **Layout responsive grid (KPI 4→2 cột, sidebar)** → Story 1.9 (web frame). 1.6 không đụng layout khung.
  - **Backend `preview-total`, error envelope, R2 signed URL, `applyTransition`** → Epic 2/4/5. 1.6 định nghĩa **contract callback** để khớp, không cài.
- **Nhưng:** component phải **đủ hành vi ngay** (CartLineRow editable + delete; Dialog Esc/backdrop/close + danger tone; Sheet; Empty/Error/Skeleton; ShareButton share+download; ImageUpload add/remove/optional) để màn Epic 3–8 dùng mà không phải bổ sung.

### Tái dùng hạ tầng 1.1–1.5 — KHÔNG tạo trùng (DRY, scout-before-code)

- **Package `design-system/` + cây `web/src/design-system/components/`** đã tồn tại (1.1/1.3). 1.6 **mở rộng cùng chỗ**: append vào `components.css`, thêm `*.tsx`/`*.ts` cạnh component đã ship, cập nhật `index.ts`, mở rộng `components.test.mjs` + thêm `behavior-components.test.mjs`. **Đừng** dựng package/thư mục/test-runner thứ hai.
- **Consume, không re-declare:** dùng token `--ink`, `--ink-2`, `--line`, `--surface`, `--surface-2`, `--teal`, `--teal-700`, `--muted`, `--radius`, `--radius-lg`, `--radius-full` (đã verify trong `tokens.css`). Các hằng non-token (`18px` sheet, `6px` skel, `20px`/`#b7c9c4` thumb glyph, `rgba(12,31,28,.32)` scrim) là literal component-constant.
- **Tái dùng component đã ship, KHÔNG dựng lại:**
  - `Button` (1.3) cho nút trong Dialog-foot/EmptyState-action/ErrorState-retry/ShareButton.
  - `Banner` (1.5, tone `warn`/`danger`) cho `ErrorState` và `ConfirmDialog` body.
  - `Table` (1.5) là khung bảng; `CartLineRow` render `<tr>` để đặt trong `<Table><tbody>`.
  - `Field` (1.3, class `.field`) cho input qty/unitPrice của `CartLineRow` và textarea trong màn (màn tự dùng).
  - `Icon`/`IconName` (1.2) cho ic-trash, ic-close, ic-plus, ic-image, ic-share, ic-refresh, ic-alert (verify tên trong `design-system/icons/icons.json`). **KHÔNG** nhúng `<svg><use>` thủ công.
  - `ConfirmDialog` **wrap** `Dialog` (không tự vẽ `.modal`).
- **Pattern component (theo Button/Icon/Stepper đã ship):** React function component, prop union-typed, class ghép `[...].filter(Boolean).join(' ')`, header `// hand-authored`. **Điểm mới của 1.6:** đây là story **đầu tiên** dùng **state/effect/handler** (`useEffect` cho Esc, `onChange`, `useRef` focus) và **browser API** (`navigator.share`, `<input type=file>`, `URL.createObjectURL`) — trước đó (1.3–1.5) component thuần trình bày. Giữ **controlled/stateless** tối đa (open/images/qty do parent giữ) để dễ test + dễ ráp; chỉ dùng `useEffect`/`useRef` cho Esc/focus (a11y).

### Kiến trúc & nguyên tắc bắt buộc

- **AD-13 (design-system-first):** 9 component là mảnh **hành vi** kế tiếp DESIGN.md, dựng trước mọi màn; màn Epic 3–8 **cấm style/hành vi ad-hoc** — phải dùng `CartLineRow`/`Dialog`/`ImageUpload`… [Source: ARCHITECTURE-SPINE.md#AD-13, project-context.md]
- **AD-10 / AD-16 (một hàm pricing, client không tính tiền):** xem "Bất biến" ở trên. `CartLineRow.amount` = số backend. [Source: project-context.md#gotchas, ARCHITECTURE-SPINE.md#AD-10/16]
- **AD-11 (chỉ `applyTransition` đổi status):** overlay xác nhận chỉ phát ý định. [Source: project-context.md#gotchas AD-11]
- **AD-3 (file ở R2 qua backend):** `ImageUpload` không upload. [Source: project-context.md AD-3]
- **UX-DR-20 (overlay rule):** Dialog = web+mobile cho hành động **có hệ quả** (Chốt/Huỷ/Duyệt/ghi thanh toán); Sheet = mobile cho **lựa chọn nhanh**/native share; **chồng tối đa một cấp**. Web 1.6 cấp cả `Dialog` (chính) + `Sheet` (parity/quick-choice) nhưng **buộc** consequential→Dialog trong docstring. [Source: epics.md#UX-DR-20]
- **UX-DR-19 (list-state + microcopy Việt):** Loading skeleton / Empty (câu + action) / Error (cụ thể + Thử lại) / Confirm (nêu hậu quả) / phone-search-empty. Chuỗi Việt **do màn truyền** (component nhận prop) để tái dùng + không cứng hoá. [Source: epics.md#UX-DR-19]
- **UX-DR-21 (share):** web = `navigator.share` (ưu tiên ảnh) hoặc download tương đương. [Source: epics.md#UX-DR-21]
- **UX-DR-25 (upload optional):** web chọn file; luôn optional; mobile chụp/thư viện (1.7). [Source: epics.md#UX-DR-25]
- **UX-DR-26 (a11y floor):** overlay **Esc đóng cấp trên cùng**; nút icon-only có `aria-label` (Đóng/Xoá/Share/thêm ảnh); Dialog `role="dialog" aria-modal="true"`, focus vào modal khi mở; touch target nút ≥ đủ lớn (dùng `Button` đã đạt). [Source: epics.md#UX-DR-26]
- **"Viền nét" (UX-DR-4):** modal/sheet nổi bằng **viền ink 1.5px** trên **backdrop mờ** (`.scrim` = ink@.32), **KHÔNG drop-shadow/gradient**. [Source: DESIGN.md dòng 217/267]
- **Naming/convention:** component React PascalCase (`CartLineRow.tsx`, `Dialog.tsx`, …); util camelCase (`share.ts`). Web = React function components + hooks. [Source: project-context.md#Coding style]

### Đặc tả CSS verbatim (nguồn: mockups/all-screens.html) [Source: mockups/all-screens.html dòng 164–182, DESIGN.md 217/226/267, UX-DR-4/19/20/25]

> **Copy verbatim.** Chỉ đổi **radius var**: `.modal` `var(--r-lg)`→`var(--radius-lg)`; `.thumb` `var(--r)`→`var(--radius)`; `.sheet-grab` `99px`→`var(--radius-full)`. Giữ `.sheet{…18px 18px 0 0}` (hằng phê chuẩn DESIGN.md 226). Thêm `.scrim` + `.skel` (không có verbatim — xem gotcha). Mọi hex/px khác giữ nguyên.

**Dialog (AC-3):**
```css
.modal{width:340px;background:#fff;border:1.5px solid var(--ink);border-radius:var(--radius-lg);overflow:hidden}
.modal-head{padding:13px 16px;border-bottom:1.5px solid var(--line);display:flex;align-items:center;gap:10px}
.modal-head .mt{font-size:14px;font-weight:800}
.modal-body{padding:16px}
.modal-foot{padding:12px 16px;border-top:1.5px solid var(--line);display:flex;gap:8px}
```

**Sheet (AC-3):**
```css
.sheet{width:300px;background:#fff;border:1.5px solid var(--ink);border-radius:18px 18px 0 0;overflow:hidden}
.sheet-grab{width:38px;height:4px;background:var(--line);border-radius:var(--radius-full);margin:9px auto 4px}
```

**Backdrop `.scrim` (MỚI — production, thay hộp `.overlay` demo của mockup):**
```css
.scrim{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(12,31,28,.32)}
.scrim.scrim--sheet{align-items:flex-end;justify-content:stretch;padding:0}
```

**Upload thumbnails (AC-5):**
```css
.thumbs{display:flex;gap:8px;flex-wrap:wrap}
.thumb{width:74px;height:74px;border:1.5px solid var(--line);border-radius:var(--radius);background:var(--surface-2);
  display:flex;align-items:center;justify-content:center;color:#b7c9c4;font-size:20px}
.thumb.add{border-style:dashed;border-color:var(--teal);color:var(--teal-700);font-weight:800}
```

**Skeleton (AC-2 — extract từ inline mockup dòng 1207–1208):**
```css
.skel{background:var(--surface-2);border-radius:6px}
```

### Gotcha bắt buộc xử lý

- **`.overlay` demo vs backdrop thật (chính):** mockup `.overlay{background:var(--surface-2);border:1.5px dashed var(--line);…}` là **hộp gallery viền đứt** để canh modal giữa trang tĩnh — **KHÔNG** phải backdrop production. Dialog thật cần backdrop phủ viewport + làm mờ nền. **Quyết định:** KHÔNG append `.overlay`; thêm `.scrim` (fixed inset-0, `rgba(--ink,.32)`). `.scrim` **không có verbatim** trong mockup — giá trị alpha .32 là đề xuất (xem Open Question #1). Đây là đi lệch verbatim **có chủ đích, đã ghi**.
- **KHÔNG số học tiền trong `CartLineRow` (AD-10/16 — dễ sai nhất):** LLM dev hay "tiện tay" viết `amount = qty * unitPrice`. **CẤM.** `amount` là prop backend trả. `onQtyChange`/`onUnitPriceChange` chỉ **phát số mới**; màn gọi `preview-total`, backend tính, trả `amount`+tổng, màn re-render. Source-guard test bắt mọi `qty*`/`*unitPrice`.
- **Radius var mismatch (tiền lệ 1.3/1.4/1.5):** remap `--r`→`--radius` (.thumb), `--r-lg`→`--radius-lg` (.modal), `99px`→`--radius-full` (.sheet-grab). Giữ `18px 18px 0 0` (.sheet). Test 4 của 1.3 chặn `var(--r*)` sót.
- **Esc/backdrop đóng + chồng ≤1 cấp:** `useEffect` gắn `keydown` document khi `open`; cleanup khi đóng (tránh leak/handler chạy khi đã đóng). Click **backdrop** (`.scrim`) đóng, nhưng click **trong `.modal`/`.sheet`** phải `stopPropagation` (đừng đóng). "Chồng ≤1 cấp" = **cấm lồng Dialog trong Dialog** (ghi docstring); mỗi overlay controlled tự ẩn khi `!open`.
- **`<input type=file>` reset value:** sau `onAdd`, đặt `e.target.value=''` để chọn lại **cùng file** vẫn kích hoạt `onChange` (nếu không, chọn lại file vừa xoá sẽ im). Input `hidden`, bọc trong `<label className="thumb add">`.
- **`navigator.share` giới hạn:** share **file** chỉ chạy trên vài trình duyệt (mobile Chrome/Safari; desktop hạn chế). Luôn `navigator.canShare?.({files})` trước; fallback **download** để "web tương đương". Bắt `AbortError` (user huỷ) → không throw/không lỗi.
- **Web chưa có tooling TS/build (kế thừa 1.2–1.5):** chưa có `tsc`/bundler/JSDOM/testing-library → **KHÔNG typecheck** `.tsx`, **KHÔNG test render/tương tác runtime** (Esc thật, click thật, `navigator.share` thật). Component bảo vệ bằng **drift-guard CSS** + **source-guard TSX (đọc text)** + review thủ công. **KHÔNG** scaffold bundler/tsconfig/JSDOM chỉ để test (YAGNI + là quyết định tooling lớn — xem Open Question #2). Ghi deviation trong Completion Notes.
- **Node test glob:** `package.json` dùng `node --test "**/*.test.mjs"` → tự bao `behavior-components.test.mjs` mới. Không sửa glob.
- **Strip comment trước khi source-guard quét (tiền lệ 1.4/1.5):** để tránh false-positive khi comment chứa chuỗi bị cấm (vd docstring viết "KHÔNG qty*unitPrice"), **loại comment `//…` và `/*…*/` + string literal** trước khi chạy regex cấm số học/upload.

### Testing standards [Source: project-context.md#Testing, Story 1.3/1.4/1.5 pattern]

- **Drift-guard CSS (mở rộng `components.test.mjs`):** đủ selector overlay/sheet/thumb/scrim/skel + verbatim lõi + radius remap; test 3/4/cuối của 1.3/1.5 tự bao (no-shadow, no raw --r, token integrity).
- **Source-guard TSX (mới `behavior-components.test.mjs`):** khẳng định **hợp đồng hành vi** dưới dạng text — **quan trọng nhất là 2 rào bất biến:** (a) `CartLineRow` KHÔNG số học tiền + render `amount` prop; (b) `ImageUpload` KHÔNG upload/fetch/R2. Cộng: Dialog có Esc+onClose+return-null+role; ConfirmDialog import Dialog; share.ts gọi navigator.share + fallback download; ErrorState dùng Banner+retry; barrel export đủ + không hồi quy.
- **Bắt buộc test cho phần "tiền bạc/dễ sai" (project-context):** rào "no client money math" trong CartLineRow là hiện thân trực tiếp của yêu cầu này ở tầng component.
- **Runtime interaction test hoãn** (known limitation — không có JSDOM). Ghi rõ. QA automation có thể bổ sung sau khi web-app shell (Story 1.8/1.9/1.11) mang bundler/test-DOM.
- Chạy: `cd design-system && npm test` (mong đợi suite hiện tại → nhiều hơn, toàn pass, 0 hồi quy). **Không** cần `flutter test` (web-only).

### Previous Story Intelligence (Story 1.5) [Source: 1-5-react-table-stepper-kpi-banner.md]

- **Pattern đã chốt (lặp lại):** append CSS verbatim + remap radius var + component hand-author (`// hand-authored`, class join `filter(Boolean).join(' ')`, union-typed props) + mở rộng barrel không phá export cũ + mở rộng `components.test.mjs` + (nếu có hành vi/contract TSX) thêm source-guard `*-components.test.mjs` đọc text.
- **Suite hiện tại:** `components.test.mjs` (CSS drift-guard, ~ test 1→cuối, gồm no-shadow test 3 + no-raw-r test 4 + token-integrity test cuối) + `chip-components.test.mjs` (source-guard 1.4) + `data-feedback-components.test.mjs` (source-guard 1.5). 1.6: **mở rộng** `components.test.mjs` (CSS) + **thêm** `behavior-components.test.mjs` (source-guard). Đừng phá test cũ.
- **Bài học false-positive (1.5):** comment trong CSS/TSX chứa chuỗi bị regex quét → false fail. **Strip comment trước khi quét** (đặc biệt source-guard cấm `qty*`/`fetch`). Đã ghi trong gotcha.
- **Bài học remap radius:** 1.3 `--r*`→`--radius*`; 1.4 `999px`→`--radius-full`; 1.5 `--r`/`--r-lg`→`--radius`/`--radius-lg`. 1.6 gộp cả ba kiểu (`--r`, `--r-lg`, `99px`).
- **`Table` là wrapper `<table>`** (1.5): `CartLineRow` render `<tr>` để nhét `<tbody>` — khớp hợp đồng "ô/hàng do màn áp class" của 1.5.
- **`Banner` tone `warn`/`info`/`danger`** (1.5): `ErrorState`/`ConfirmDialog` tái dùng, không dựng lại.

### Git Intelligence [Source: recent commits]

- `cf9270c feat(story-1.5)` · `e59ed50 feat(story-1.4)` · `b98d567 feat(story-1.3)` · `18e0dc0 feat(story-1.2)` · `356314c feat(story-1.1)`. Baseline story này = **cf9270c** (HEAD, sau 1.5). Commit conventional `feat(story-1.6): …`, tiếng Việt, **không** tham chiếu AI. File đụng: `web/src/design-system/components/*` + `design-system/components/components.test.mjs` + `design-system/components/behavior-components.test.mjs` (mới).

### Project Structure Notes

- **Surgical (project-context.md#Scout-before-code):** chỉ **thêm** 1 khối CSS + 9 file component + 1 util + cập nhật barrel + mở rộng/thêm test. **Không** đụng khối CSS/component đã ship (`.btn/.card/.frame/.field/.chip*/.banner/.table/.step*/.kpi*` và `Button/Card/Frame/Field/StatusChip/CustomerTypeChip/ScopeFlag/Table/Stepper/Kpi/Banner`), không đụng `tokens/*`, `icons/*`.
- Đường dẫn:
  - Append CSS: `web/src/design-system/components/components.css` (thêm 1 khối cuối file, sau KPI 1.5).
  - Component web (`web/src/design-system/components/`, MỚI): `CartLineRow.tsx`, `Dialog.tsx`, `ConfirmDialog.tsx`, `Sheet.tsx`, `Skeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `ShareButton.tsx`, `ImageUpload.tsx`, `share.ts`; `index.ts` (sửa: thêm export).
  - Test: `design-system/components/components.test.mjs` (sửa: append selector/verbatim overlay/sheet/thumb/scrim/skel) + `design-system/components/behavior-components.test.mjs` (MỚI: source-guard hành vi).

### References

- [Source: mockups/all-screens.html] — CSS: `.modal*` (176–180), `.sheet`/`.sheet-grab` (181–182), `.thumbs`/`.thumb`/`.thumb.add` (164–167), `.overlay` demo (174–175, **không** dùng verbatim), `.skel` inline (1207–1208). DOM chuẩn: list-states orders (1193–1215: empty 1196–1203, loading 1205–1209, error 1210–1214), cart line items (1353–1394 web, 1463–1479 mobile), Dialog chuyển trạng thái + thumbs (1888–1929), Sheet mobile + thumbs (1957–1986), Dialog huỷ đơn danger (2040–2069), share sheet mobile (2787–2802, **share-grid = mobile/1.7**), phone-search-empty (1570). **Nguồn thị giác thắng; copy verbatim phần CSS được liệt kê.**
- [Source: DESIGN.md] — "Modal/sheet nổi bằng viền ink 1.5px, không drop-shadow" (217, 267); sheet đáy bo 18px (226); radius map (224–226); icon size (253–254).
- [Source: epics.md#Story 1.6 (231–238)] — user story + 5 AC (UX-DR-24/19/20/21/25). Cross-ref: cart FR-1 (372, 380), phone-search-empty FR-29 (362), share FR-21 (422), attach FR-23/24 (459, 467), cancel dialog (473), payment dialog (530), discount-approval dialog (415). UX-DR-4 (Viền nét), UX-DR-26 (a11y). Mobile parity → 1.7 (243–244).
- [Source: ARCHITECTURE-SPINE.md] — AD-13 (design-system-first), AD-10/16 (một hàm pricing, client không tính tiền), AD-11 (chỉ applyTransition đổi status), AD-3 (R2 qua backend), AD-17 (permission registry).
- [Source: 1-5-react-table-stepper-kpi-banner.md] — pattern append CSS/component/test, remap radius, gotcha "web chưa có tsc", drift-guard + source-guard; `Table` wrapper, `Banner` tone.
- [Source: web/src/design-system/tokens/tokens.css] — `--ink` (11), `--ink-2` (12), `--muted` (13), `--line` (14), `--surface` (16), `--surface-2` (17), `--teal` (5), `--teal-700` (6), `--radius` (37), `--radius-lg` (38), `--radius-full` (39) (verify trước khi consume).
- [Source: web/src/design-system/components/index.ts] — barrel hiện có export 1.3/1.4/1.5 (giữ nguyên, chỉ thêm).
- [Source: web/src/design-system/icons/Icon.tsx, design-system/icons/icons.json] — `Icon`/`IconName`; sprite có ic-trash/ic-close/ic-plus/ic-image/ic-share/ic-refresh/ic-alert (verify).
- [Source: _bmad-output/project-context.md] — stack version, thuần front-end, Design-system-first, testing, scout-before-code, gotcha AD-3/10/11/16/17.

**Stack liên quan:** React (Web) 19.2.7 · Node.js 24 LTS. **Không** cần dependency web ngoài (CSS thuần + React function components + hooks + browser API + test Node zero-dep). Web-only — **không** đụng Flutter/`mobile/`. [Source: ARCHITECTURE-SPINE.md#Stack, project-context.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8, 1M context)

### Debug Log References

- Hai false-positive trong drift-guard là comment CSS của khối 1.6 tự chứa chuỗi bị quét: (1) literal `var(--r-lg)`/`var(--r)` khiến test "no raw --r*" fail; (2) chữ "gradient"/"drop-shadow" khiến test "no gradient" fail. Xử lý: viết lại comment không nhúng literal bị cấm (đúng tiền lệ 1.4/1.5). CSS thực tế không đổi.

### Completion Notes List

- **Đã giao behavior/interaction layer (chỉ Web/React):** 1 khối CSS append (overlay/sheet/thumbs/scrim/skeleton) + 9 component + 1 util + mở rộng drift-guard CSS + source-guard TSX mới. Toàn bộ 6 task/31 subtask xong; 79/79 test pass (từ 61 → +18 test 1.6).
- **AC-1 (CartLineRow):** `<tr>` đặt trong `<Table><tbody>`; sửa SL/đơn giá phát ngay qua `onQtyChange`/`onUnitPriceChange` (không nút lưu); `amount` render THẲNG từ prop backend — **KHÔNG** số học tiền client (AD-10/16). Cờ chỉ hiển thị; nút xoá dòng (web dùng nút, swipe→1.7 ghi docstring).
- **AC-2 (list-state):** `Skeleton` (helper `.skel` token-based), `EmptyState` (nhận title/message/action qua prop — dùng cho cả empty-list và phone-search-empty, không cứng hoá chuỗi Việt), `ErrorState` (tái dùng `Banner` danger + nút Thử lại). Confirm = `ConfirmDialog`.
- **AC-3 (overlay):** `Dialog`/`Sheet` controlled/stateless; Esc đóng (useEffect keydown document + cleanup), click backdrop đóng, click trong modal stopPropagation, `!open`→null (chồng ≤1 cấp), `role="dialog" aria-modal`, focus modal khi mở. Nổi bằng viền ink 1.5px trên `.scrim` mờ (ink@.32) — 0 drop-shadow. `ConfirmDialog` wrap `Dialog` (không tự vẽ modal); `onConfirm` chỉ phát ý định (AD-11).
- **AC-4 (share):** `share.ts` `shareFiles()` ưu tiên `navigator.share({files})` (guard `canShare`), fallback download (`createObjectURL`+`<a download>`), bắt `AbortError`. `ShareButton` mỏng; KHÔNG vẽ share-grid app (→1.7).
- **AC-5 (upload):** `ImageUpload` controlled: `<input type=file accept=image/*>`, thumbnail, xoá, reset `input.value` sau add, ẩn ô thêm khi đạt `max`, luôn optional. **KHÔNG** fetch/R2/signed/upload — chỉ phát `File[]` qua `onAdd` (AD-3).
- **2 rào bất biến (source-guard) đã kiểm chứng bằng negative test:** chèn `qty * unitPrice` vào CartLineRow và `fetch("/r2/signed")` vào ImageUpload → đúng 2 test fail; revert → 79/79 pass. Guard bắt được vi phạm thật.
- **Deviation có chủ đích (đã ghi):** (a) KHÔNG append `.overlay` demo của mockup; thêm `.scrim` production (fixed inset-0, ink@.32) — Open Question #1 (alpha .32 chờ chủ design chốt). (b) Test tương tác runtime **hoãn** (web chưa có tsc/bundler/JSDOM — kế thừa 1.2–1.5); bảo vệ bằng drift-guard CSS + source-guard TSX đọc text + review — Open Question #2. (c) `Sheet` web giữ lại (parity/quick-choice), consequential buộc `Dialog` — Open Question #3.
- **Naming:** giữ PascalCase cho component (`CartLineRow.tsx`…) khớp convention design-system đã ship (Button/Banner/…) và yêu cầu story; util camelCase (`share.ts`).

### File List

**Thêm mới (component web — `web/src/design-system/components/`):**
- `CartLineRow.tsx`
- `Dialog.tsx`
- `ConfirmDialog.tsx`
- `Sheet.tsx`
- `Skeleton.tsx`
- `EmptyState.tsx`
- `ErrorState.tsx`
- `ShareButton.tsx`
- `ImageUpload.tsx`
- `share.ts`

**Thêm mới (test):**
- `design-system/components/behavior-components.test.mjs`

**Sửa:**
- `web/src/design-system/components/components.css` (append khối behavior/interaction 1.6)
- `web/src/design-system/components/index.ts` (export 9 component + `shareFiles`, giữ export 1.3/1.4/1.5)
- `design-system/components/components.test.mjs` (thêm 5 test drift-guard cho khối 1.6)

## Open Questions (giải quyết khi grooming/dev — không chặn create-story)

1. **Backdrop `.scrim` chưa có đặc tả trong DESIGN.md.** Đề xuất `rgba(12,31,28,.32)` (ink @ 32%). DESIGN chốt "modal nổi bằng viền ink 1.5px, không drop-shadow" nhưng **không nêu màu/độ mờ backdrop**. Cần chủ design xác nhận alpha (.32) hoặc giá trị khác. Không chặn: dùng .32 làm mặc định hợp lý, dễ đổi 1 chỗ.
2. **Test tương tác runtime bị hoãn** (không có JSDOM/testing-library — kế thừa 1.2–1.5). 1.6 là story đầu có hành vi thật (Esc/click/share/file). Nên **thêm harness DOM (JSDOM + @testing-library/react) ngay ở 1.6** hay **hoãn tới web-app shell (1.8/1.9/1.11)**? Đề xuất: **hoãn** (giữ zero-tooling nhất quán, bảo vệ bằng source-guard) — nhưng đây là quyết định tooling, cần user chốt. Không chặn: source-guard + review đủ cho tầng design-system.
3. **`Sheet` trên web** — UX-DR-20 gán bottom-sheet cho **mobile**. 1.6 vẫn cấp `Sheet` web (parity/quick-choice, CSS dùng chung) nhưng consequential buộc dùng `Dialog`. Nếu muốn web **không** có Sheet (thuần Dialog), có thể bỏ `Sheet.tsx` khỏi scope — xác nhận khi grooming. Mặc định: **giữ** (chi phí thấp).

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Story 1.6 tạo (create-story): cấp behavior/interaction layer (React) — append CSS overlay/sheet/thumbs/scrim/skeleton (remap `--r`/`--r-lg`/`99px`→`--radius`/`--radius-lg`/`--radius-full`, giữ sheet 18px), 9 component (`CartLineRow`/`Dialog`/`ConfirmDialog`/`Sheet`/`Skeleton`/`EmptyState`/`ErrorState`/`ShareButton`/`ImageUpload`) + util `share.ts`, mở rộng barrel + drift-guard CSS + source-guard `behavior-components.test.mjs` (rào bất biến: cấm số học tiền client trong CartLineRow, cấm upload R2 trong ImageUpload). 3 open question ghi lại. Status: backlog → ready-for-dev. |
| 2026-07-08 | Story 1.6 dev-story: triển khai đủ 6 task/31 subtask — append khối CSS behavior, 9 component + `share.ts`, mở rộng barrel, +5 test drift-guard CSS + 12 test source-guard TSX mới. Negative test xác nhận 2 rào bất biến (money math CartLineRow / upload ImageUpload) bắt được vi phạm. `cd design-system && npm test` → 79/79 pass, 0 hồi quy. Status: in-progress → review. |
| 2026-07-08 | Code-review (ck:code-review, pending changes) + độc lập code-reviewer. Sửa 2 lỗi Important: (1) Dialog/Sheet cướp focus mỗi lần parent re-render (effect phụ thuộc `onClose` identity) → dùng latest-ref `onCloseRef`, effect key `[open]`; (2) các `<button>`/`<Button>` không submit thiếu `type="button"` (mặc định `submit` sẽ submit form bao ngoài) → thêm `type="button"` cho nút trong CartLineRow/Dialog/Sheet/ImageUpload/ConfirmDialog/ErrorState/ShareButton. Thêm source-guard test (20) chốt `type="button"`; cập nhật guard (3)/(4) khớp đường đóng latest-ref. 4 Minor để lại có lý do (đúng spec/không mở rộng contract). Re-review: PASS, 0 lỗi Critical/Important còn lại. `npm test` → 87/87 pass. Status: review → done. |
