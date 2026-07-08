---
baseline_commit: e59ed50
---

# Story 1.5: React — Table, Stepper, KPI, Banner

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên web**,
I want **các component dữ liệu/phản hồi (Table, Stepper, KPI, Banner) dựng từ token dùng chung, phẳng "Viền nét"**,
so that **màn danh sách, chi tiết đơn và dashboard (Epic 3–8) dựng lại từ MỘT bộ component chuẩn — không tự chế bảng/thẻ/banner, không style ad-hoc**.

## Acceptance Criteria

1. **Given** yêu cầu Table, **When** dựng, **Then** bảng **dày** (`.table` `font-size:12.5px`, `border-collapse:collapse`), header nền **surface-2** + **micro uppercase** (`10px/800`, `letter-spacing:.05em`, `border-bottom:1.5px line`), ô `td` **viền dưới line 1px** (`color:var(--ink-2)`), **hàng cuối bỏ viền**, cột số canh phải `.num`, giá trị mạnh `.strong` (`ink` + `800`), hàng zebra `tr.zebra` nền `#F7FBFA` (UX-DR-10).
2. **Given** yêu cầu Stepper, **When** dựng, **Then** node tròn **26px** (`.bul`) nối bằng thanh **1.5px** (`.bar`); `done` = **teal đặc, tick trắng** (`ic-check`), `current` = **viền teal + ring teal-050** (`box-shadow:0 0 0 3px var(--teal-050)` — viền kép sanctioned, KHÔNG phải shadow trang trí), `gate` = **viền đứt mờ** (`border-style:dashed`); nhãn bước **micro** dưới node (`.st-label` `9.5px/700`) (UX-DR-11) **And** bước **không áp dụng bị ẩn hẳn** (caller không truyền vào `steps`) — component **KHÔNG** có biến thể disable/xám.
3. **Given** yêu cầu KPI, **When** dựng, **Then** thẻ **viền line bo lg** (`.kpi` `border:1.5px var(--line)`, `border-radius:var(--radius-lg)`), nhãn **micro-uppercase** `.k-l`, giá trị **display 23px/900** `.k-v` (`letter-spacing:-.02em`), delta màu **`ok`** `.k-d` (`11px/700`, `color:var(--ok)`), biến thể `.accent` (viền teal + nền teal-050) (UX-DR-12).
4. **Given** yêu cầu Banner, **When** dựng, **Then** dải **viền 1.5px** + nền semantic dịu, **mặc định warn** (`var(--warn)` + nền `#FBF0DA` + chữ `#8A5C08`), `--info` (viền `var(--info)` + nền `#DEF1F6` + chữ `#0C6B84`), `--danger` (viền `var(--danger)` + nền `#FAE6E6` + chữ `#B22C2C`), bo `var(--radius)`, có slot **icon SVG bên trái** (`.banner .icn` 16px) và `<b>` đậm `800` (UX-DR-13).
5. **Given** quy tắc "Viền nét" (UX-DR-4), **When** render 4 component trên, **Then** **tuyệt đối phẳng — KHÔNG gradient/background-image, KHÔNG drop-shadow trang trí**; ngoại lệ **duy nhất** là ring `box-shadow:0 0 0 3px var(--teal-050)` của stepper `current` (viền kép, đã được DESIGN.md phê chuẩn), phân cấp còn lại chỉ bằng viền 1.5px + bậc nền.

## Tasks / Subtasks

- [x] **Task 1 — Nối CSS Banner/Table/Stepper/KPI verbatim vào `components.css` (AC: 1, 2, 3, 4, 5)**
  - [x] **Nối thêm** (append) 4 khối CSS vào **cuối** `web/src/design-system/components/components.css` (sau khối chip Story 1.4) — **copy verbatim** từ `mockups/all-screens.html`: **Banner** (dòng 111–116), **Dense table** (dòng 118–126), **Stepper** (dòng 128–141), **KPI** (dòng 143–149). Xem bảng "Đặc tả CSS verbatim" trong Dev Notes. **KHÔNG** đụng các khối `.btn/.card/.frame/.field/.chip/.ktype/.scope-flag` đã ship (Story 1.3/1.4) — chỉ **thêm**.
  - [x] **Remap tên biến radius (gotcha bắt buộc — tiền lệ 1.3/1.4):** mockup dùng `var(--r)` và `var(--r-lg)` (undefined trong `tokens.css`). Thay **đúng 2 chỗ**: `.banner{…border-radius:var(--r)…}` → `var(--radius)`; `.kpi{…border-radius:var(--r-lg)…}` → `var(--radius-lg)`. (Verify tên token trong `web/src/design-system/tokens/tokens.css`: `--radius` dòng 37, `--radius-lg` dòng 38.) Drift-guard test 4 của 1.3 chặn mọi `var(--r*)` sót lại. **Giữ nguyên** `.bul{border-radius:50%}` và `.node`/`.bar` (không phải radius token).
  - [x] **Ring stepper `current` (ngoại lệ được phê chuẩn — AC-2/5):** giữ **verbatim** `.step.current .bul{…box-shadow:0 0 0 3px var(--teal-050)}`. DESIGN.md dòng 217 xác nhận đây là **viền kép hữu hạn**, KHÔNG phải shadow trang trí. Đây là lý do Task 3 phải **nới** drift-guard "no box-shadow" (xem Task 3).
  - [x] Giữ **verbatim** các hằng hex riêng không nằm trong token set (KHÔNG tokenize — canonical/component constant cố ý): Table zebra `#F7FBFA`; Banner `#FBF0DA`/`#8A5C08` (warn), `#DEF1F6`/`#0C6B84` (info), `#FAE6E6`/`#B22C2C` (danger); Stepper `#fff` (nền `.bul`), `#9fb2ad` (chữ `.bul` mặc định), `#c3d3ce` (`.gate .bul`), `#a9bab5` (`.gate .st-label`). Chúng KHÔNG có trong `tokens.css`; thêm vào token layer là scope-creep sang Story 1.1.
  - [x] **Viền nét (AC-5):** KHÔNG thêm `gradient`/`background-image`/`box-shadow` nào **ngoài** ring stepper `current` ở trên. Phân cấp chỉ bằng viền 1.5px + nền token/hex.
- [x] **Task 2 — Component React Table/Stepper/KPI/Banner (AC: 1, 2, 3, 4)**
  - [x] `Table.tsx`: wrapper mỏng render `<table className="table …">{children}</table>`. Ghép class `['table', className].filter(Boolean).join(' ')`; forward `...rest` (`TableHTMLAttributes<HTMLTableElement>`). **KHÔNG** dựng sub-component `Th`/`Td`/`Tr` (CSS nhắm thẳng element `.table th/td/tr` — YAGNI). Các class ô/hàng (`.num` canh phải, `.strong` đậm ink, `tr.zebra` zebra, `.mono` số) là **hợp đồng class** màn tự áp trên `<th>/<td>/<tr>` — ghi rõ trong docstring.
  - [x] `Stepper.tsx`: prop `steps: StepItem[]` với `StepItem = { label: string; state?: StepState }`, `StepState = 'done' | 'current' | 'gate'` (không set = upcoming, node trơn). Render `<div className="stepper">` → mỗi step: `<div className="step {state?}"><div className="node"><div className="bul">{content}</div><div className="st-label">{label}</div></div>{notLast && <div className="bar" />}</div>`. **Nội dung `.bul`:** `state==='done'` → `<Icon name="ic-check" />` (import từ `../icons/Icon`); ngược lại → **số thứ tự 1-based** (index+1). **`.bar`** render giữa các step, **bỏ ở step cuối**. Union `StepState` chặn state tự chế; **KHÔNG** có state `disabled`/`grayed` (AC-2: bước không áp dụng bị caller **loại khỏi `steps`**, không render mờ).
  - [x] `Kpi.tsx`: props `label: string`, `value: ReactNode`, `delta?: ReactNode`, `accent?: boolean`, `mono?: boolean` (mặc định `false`; `true` → thêm class `mono` vào `.k-v` cho số/tiền canh cột). Render `<div className="kpi {accent?'accent'}"><div className="k-l">{label}</div><div className={'k-v'+(mono?' mono':'')}>{value}</div>{delta && <div className="k-d">{delta}</div>}</div>`. Delta luôn màu `ok` (do CSS `.k-d` set — UX-DR-12); **không** thêm biến thể màu delta ở story này.
  - [x] `Banner.tsx`: props `tone?: 'warn' | 'info' | 'danger'` (mặc định `'warn'` = base `.banner`, không modifier), `icon?: IconName` (import type từ `../icons/sprite`), `children`. Render `<div className="banner {tone!=='warn'?`banner--${tone}`:''}">{icon && <Icon name={icon} />}{children}</div>`. Slot icon trái tuỳ chọn (mockup dùng `ic-alert`/`ic-clock` cho warn/danger; info thường không icon — giữ optional để cả hai khớp mockup). `<b>` trong children tự đậm `800` theo CSS `.banner b`.
  - [x] **Pattern component** (theo `Button.tsx`/`Icon.tsx` đã ship): React function component, prop union-typed, class ghép `[...].filter(Boolean).join(' ')`, header `// hand-authored`. Import `Icon`/type `IconName` từ layer icon (Story 1.2) — **không** re-implement SVG.
  - [x] Cập nhật `index.ts` barrel: thêm export `Table` (+ `TableProps`), `Stepper` (+ `StepperProps`, `StepItem`, `StepState`), `Kpi` (+ `KpiProps`), `Banner` (+ `BannerProps`, `BannerTone`). **Không** xoá/sửa export Story 1.3/1.4.
- [x] **Task 3 — Mở rộng drift-guard test + nới rào "no box-shadow" (AC: 1, 2, 3, 4, 5)**
  - [x] **Sửa test 3** (`'no shadow/gradient/background-image'`) trong `design-system/components/components.test.mjs`: rào hiện tại `/box-shadow|shadow|gradient|background-image/i` quét **toàn file** → sẽ **fail** khi thêm ring stepper `current`. Nới lại để: (a) **cấm tuyệt đối** `gradient`/`background-image`; (b) cho phép `box-shadow` **chỉ** khi là ring phẳng `0 0 0 3px var(--teal-050)` (0 blur/offset — viền kép, đã phê chuẩn DESIGN.md dòng 217), mọi `box-shadow` khác (có blur/offset) vẫn **fail**. Gợi ý: gom mọi `box-shadow:…` bằng regex và assert từng cái `=== '0 0 0 3px var(--teal-050)'`. Cập nhật tên/comment test cho khớp AC-4/UX-DR-4/11.
  - [x] **Nối thêm** test (sau test 13) khẳng định:
    - **Đủ selector:** `.banner`, `.banner b`, `.banner--info`, `.banner--danger`; `.table`, `.table th`, `.table td`, `.table .num`, `.table .strong`, `.table tr.zebra`; `.stepper`, `.step`, `.step .node`, `.step .bul`, `.step .st-label`, `.step .bar`, `.step.done`, `.step.current`, `.step.gate`; `.kpis`, `.kpi`, `.kpi .k-l`, `.kpi .k-v`, `.kpi .k-d`, `.kpi.accent` (thiếu một = fail).
    - **Verbatim lõi Table (AC-1):** `.table{width:100%;border-collapse:collapse;font-size:12.5px}`; `.table th` có `background:var(--surface-2)`, `text-transform:uppercase`, `border-bottom:1.5px solid var(--line)`; `.table td` có `border-bottom:1px solid var(--line)`, `color:var(--ink-2)`; `.table tr:last-child td{border-bottom:0}`; `.table .num{text-align:right}`; `.table .strong{color:var(--ink);font-weight:800}`; `.table tr.zebra td{background:#F7FBFA}`.
    - **Verbatim lõi Stepper (AC-2/5):** `.step .bul` có `width:26px;height:26px;border-radius:50%;border:1.5px solid var(--line)`; `.step .bar` có `width:26px;height:1.5px;background:var(--line)`; `.step.done .bul{border-color:var(--teal);background:var(--teal);color:#fff}`; `.step.current .bul` chứa `box-shadow:0 0 0 3px var(--teal-050)`; `.step.gate .bul` có `border-style:dashed`; `.st-label` có `font-size:9.5px`.
    - **Verbatim lõi KPI (AC-3):** `.kpi{border:1.5px solid var(--line);border-radius:var(--radius-lg);…}`; `.kpi .k-v{font-size:23px;font-weight:900;letter-spacing:-.02em;…}`; `.kpi .k-d{…;color:var(--ok);…}`; `.kpi.accent{border-color:var(--teal);background:var(--teal-050)}`.
    - **Verbatim lõi Banner (AC-4):** `.banner{…border:1.5px solid var(--warn);background:#FBF0DA;color:#8A5C08;border-radius:var(--radius);…}`; `.banner--info{border-color:var(--info);background:#DEF1F6;color:#0C6B84}`; `.banner--danger{border-color:var(--danger);background:#FAE6E6;color:#B22C2C}`.
    - **Radius remap:** `.banner` dùng `var(--radius)`, `.kpi` dùng `var(--radius-lg)`; toàn file **KHÔNG** còn `var(--r)`/`var(--r-lg)` (test 4 của 1.3 tự bao — xác nhận vẫn pass).
    - (Cross-file token integrity: test 8 của 1.3 tự bao khi quét toàn file — mọi `var()` mới (`--surface-2`, `--ink-2`, `--ok`, `--warn`, `--info`, `--danger`, `--teal-050`…) phải định nghĩa trong `tokens.css`; đã verify tất cả tồn tại.)
  - [x] Chạy `cd design-system && npm test` — **toàn bộ pass, không hồi quy** token/icon/Story 1.3/1.4. Test phải **fail** nếu ai đổi/xoá một rule của 4 component, lệch hex verbatim, quên remap radius, hoặc thêm shadow/gradient trang trí (ngoài ring đã phê chuẩn).

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này **CHỈ WEB (React)** — giao **data/feedback layer**: 4 khối CSS (Banner/Table/Stepper/KPI) + 4 component (`Table`, `Stepper`, `Kpi`, `Banner`) + mở rộng drift-guard test. Đây là mảnh tiếp theo của hợp đồng thị giác, để màn danh sách/chi tiết/dashboard (Epic 3–8) tiêu thụ.
- **Ngoài phạm vi (thuộc story khác — KHÔNG làm ở đây):**
  - **Chart / bar-chart** (`.chart`, mockup dòng 151–155) → **KHÔNG** thuộc 4 component của Story 1.5 (epics AC 1.5 chỉ liệt kê Table/Stepper/KPI/Banner). Dashboard Story **8.1** dùng "KPI + chart component" (epics dòng 559) — chart dựng khi tới 8.1 (hoặc grooming sau bổ sung), KHÔNG append `.chart` ở đây.
  - **`.list-row`** và mọi util khác trong mockup → không thuộc 4 component; **KHÔNG** append.
  - **Flutter/mobile parity** cho Table/Stepper/KPI/Banner → **Story 1.7** (epics dòng 243). 1.5 **không** đụng `mobile/`.
  - **Hành vi** (giỏ hàng, trạng thái danh sách empty/loading/error, overlay, share, upload) → **Story 1.6**. 1.5 chỉ cấp **primitive trình bày** tĩnh; empty/loading/error là hành vi màn (Banner có thể là 1 mảnh của error-state 1.6, nhưng component do 1.5 cấp).
  - **Logic đổi trạng thái đơn** / ánh xạ step ↔ enum `Order.status` backend → **Backend Epic 4/5**. Stepper 1.5 chỉ **hiển thị** chuỗi bước theo `state` caller truyền; **không** cài logic gate/transition.
- **Nhưng:** 4 component phải **đủ biến thể ngay** (Table zebra/num/strong; Stepper done/current/gate; KPI accent; Banner warn/info/danger) để story sau dùng mà không phải bổ sung.

### Tái dùng hạ tầng 1.1/1.2/1.3/1.4 — KHÔNG tạo trùng (DRY, scout-before-code)

- **Package `design-system/`** (1.1) + cây `web/src/design-system/components/` (1.3) + layer chip (1.4) **đã tồn tại**. Story 1.5 **mở rộng cùng chỗ**: append vào `components.css`, thêm `*.tsx` cạnh `Button/Card/Field/StatusChip`, cập nhật `index.ts`, mở rộng `components.test.mjs`. **Đừng** dựng package/thư mục/test-runner thứ hai.
- **Consume, không re-declare:** component tham chiếu token `--surface-2`, `--ink`, `--ink-2`, `--muted`, `--line`, `--teal`, `--teal-050`, `--teal-700`, `--ok`, `--warn`, `--info`, `--danger`, `--radius`, `--radius-lg` (do `tokens.css` phát — verify tên **trước** khi viết). Các hằng hex trong Dev Notes **không** phải token → literal verbatim.
- **Stepper `done` tick + Banner icon:** dùng **`Icon` component (Story 1.2)** với `name="ic-check"` (stepper) / `icon?: IconName` (banner) — sprite đã có `ic-check`, `ic-alert`, `ic-clock`, `ic-info`… (verify trong `design-system/icons/icons.json`). **KHÔNG** nhúng `<svg><use>` thủ công — đi qua `Icon` để đồng bộ size class (`.icn` 14px trong stepper/bảng theo `.step .bul .icn`/`.table .num .icn` mockup dòng 327–328; `.banner .icn` 16px dòng 326).
- **KHÔNG cần generator/SSOT JSON:** 4 component web-only, hand-author CSS/TSX verbatim + drift-guard là đủ (KISS/YAGNI). Flutter parity (1.7) dựng widget riêng cùng token/hình/đặc tả — không copy CSS.

### Kiến trúc & nguyên tắc bắt buộc

- **AD-13 (Design-system-first):** 4 component là mảnh kế của DESIGN.md, dựng **trước mọi màn**; màn sau **cấm style ad-hoc** — phải dùng `Table`/`Stepper`/`Kpi`/`Banner`. [Source: ARCHITECTURE-SPINE.md#AD-13, project-context.md]
- **Thuần front-end trình bày:** story **không** chạm backend/DB/business logic. Component **không** chứa logic nghiệp vụ; đặc biệt Stepper **KHÔNG** đổi `Order.status` (độc quyền `applyTransition()` backend — AD-11). Stepper = hiển thị chuỗi bước đọc-only theo `state` truyền vào. [Source: project-context.md#gotchas AD-11]
- **Nguồn thị giác duy nhất:** khối CSS `mockups/all-screens.html` (dòng 111–149) + đặc tả DESIGN.md (dòng 238–241). "Khi xung đột, mockup thắng" → **copy verbatim, không tự nhớ/tự chế**. [Source: DESIGN.md#Component-list]
- **"Viền nét" + ngoại lệ hữu hạn (UX-DR-4):** phẳng tuyệt đối, phân cấp bằng viền 1.5px + bậc nền. **Ngoại lệ được phê chuẩn:** ring stepper `current` `box-shadow:0 0 0 3px teal-050` (dùng **như viền kép**, KHÔNG phải drop-shadow), vành FAB, blur indexbar. Modal/sheet nổi bằng **viền ink 1.5px**, không drop-shadow. Đây là căn cứ nới drift-guard test 3. [Source: DESIGN.md dòng 217, epics.md#UX-DR-4]
- **Stepper — gate ẩn hẳn, không xám (UX-DR-11):** bước **không áp dụng** cho luồng đơn hiện tại bị **loại khỏi DOM** (caller không truyền vào `steps`), **KHÔNG** render mờ/disable. Component vì thế **không** có state `disabled`. State `gate` (viền đứt) là bước **áp dụng nhưng chưa mở khoá** (tương lai/khoá), khác với "inapplicable". [Source: epics.md#UX-DR-11, DESIGN.md dòng 239]
- **A11y floor (UX-DR-26):** Banner mang **nhãn chữ** (không chỉ màu/icon); Table header là chữ micro-uppercase; KPI có nhãn `.k-l`. Icon chỉ phụ trợ. [Source: epics.md#UX-DR-26]
- **Naming/convention:** file component React PascalCase (`Table.tsx`, `Stepper.tsx`, `Kpi.tsx`, `Banner.tsx` — nhất quán `Button.tsx`/`Icon.tsx`). Web = React function components + hooks. [Source: project-context.md#Coding style]

### Đặc tả CSS verbatim (nguồn: mockups/all-screens.html dòng 111–149) [Source: mockups/all-screens.html, DESIGN.md dòng 238–241, UX-DR-4/10/11/12/13]

> **Copy verbatim.** Chỉ đổi **radius** `var(--r)`→`var(--radius)` (`.banner`), `var(--r-lg)`→`var(--radius-lg)` (`.kpi`) — 2 chỗ. Giữ nguyên ring `box-shadow` stepper `current` (ngoại lệ phê chuẩn). Mọi hex + giá trị khác giữ nguyên. `.bul{border-radius:50%}` KHÔNG đổi.

**Banner (AC-4):**
```css
.banner{display:flex;gap:9px;align-items:flex-start;border:1.5px solid var(--warn);
  background:#FBF0DA;color:#8A5C08;border-radius:var(--radius);padding:10px 12px;font-size:12px;font-weight:600}
.banner b{font-weight:800}
.banner--info{border-color:var(--info);background:#DEF1F6;color:#0C6B84}
.banner--danger{border-color:var(--danger);background:#FAE6E6;color:#B22C2C}
```

**Dense table (AC-1):**
```css
.table{width:100%;border-collapse:collapse;font-size:12.5px}
.table th{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);
  text-align:left;padding:8px 12px;background:var(--surface-2);border-bottom:1.5px solid var(--line)}
.table td{padding:9px 12px;border-bottom:1px solid var(--line);color:var(--ink-2);vertical-align:middle}
.table tr:last-child td{border-bottom:0}
.table .num{text-align:right}
.table .strong{color:var(--ink);font-weight:800}
.table tr.zebra td{background:#F7FBFA}
```

**Stepper (AC-2/5):**
```css
.stepper{display:flex;flex-wrap:wrap;gap:0}
.step{display:flex;align-items:center;gap:0}
.step .node{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:64px;text-align:center}
.step .bul{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--line);background:#fff;
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#9fb2ad}
.step .st-label{font-size:9.5px;font-weight:700;color:var(--muted);letter-spacing:.02em;max-width:74px}
.step .bar{width:26px;height:1.5px;background:var(--line);margin-top:-18px}
.step.done .bul{border-color:var(--teal);background:var(--teal);color:#fff}
.step.done .st-label{color:var(--ink-2)}
.step.current .bul{border-color:var(--teal);background:#fff;color:var(--teal-700);box-shadow:0 0 0 3px var(--teal-050)}
.step.current .st-label{color:var(--teal-700);font-weight:800}
.step.gate .bul{border-style:dashed;color:#c3d3ce}
.step.gate .st-label{color:#a9bab5}
```

**KPI (AC-3):**
```css
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi{border:1.5px solid var(--line);border-radius:var(--radius-lg);padding:12px 14px}
.kpi .k-l{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.kpi .k-v{font-size:23px;font-weight:900;letter-spacing:-.02em;margin-top:5px}
.kpi .k-d{font-size:11px;font-weight:700;color:var(--ok);margin-top:2px}
.kpi.accent{border-color:var(--teal);background:var(--teal-050)}
```

- `.banner` mặc định = warn (viền `--warn`, nền `#FBF0DA`, chữ `#8A5C08`); `--info`/`--danger` override viền+nền+chữ. `align-items:flex-start` cho icon ngồi trên-trái.
- `.table` header nền `--surface-2`, viền dưới header đậm 1.5px; `td` viền 1px; hàng cuối bỏ viền; zebra nền literal `#F7FBFA`.
- `.step .bul` mặc định viền `line` + chữ mờ `#9fb2ad`; `done` teal đặc chữ trắng; `current` viền teal + **ring teal-050 (box-shadow phê chuẩn)** + chữ teal-700; `gate` viền đứt + mờ. `.bar` nối `margin-top:-18px` để canh giữa node.
- `.kpi` bo `lg`; `.k-v` display 23px/900; `.k-d` luôn màu `ok`; `.accent` viền teal + nền teal-050. (`.kpis` grid 4 cột — layout, màn tự dùng; responsive 4→2 cột là Story 1.9/responsive, không thuộc 1.5.)

### Hợp đồng component React (dùng trong `*.tsx`)

| Component | Props | Render |
|---|---|---|
| `Table` | `...TableHTMLAttributes`, `className?`, `children` | `<table className="table {className}">{children}</table>` — màn tự viết `thead/tbody/tr/td`; áp class `.num`/`.strong`/`tr.zebra`/`.mono` trên element |
| `Stepper` | `steps: {label; state?:'done'\|'current'\|'gate'}[]` | `.stepper` → mỗi step `.step {state}` > `.node`(`.bul`[done→`ic-check`, else số 1-based] + `.st-label`) + `.bar`(bỏ ở cuối) |
| `Kpi` | `label`, `value`, `delta?`, `accent?`, `mono?` | `.kpi {accent}` > `.k-l` + `.k-v {mono}` + `.k-d?` |
| `Banner` | `tone?:'warn'\|'info'\|'danger'`(=warn), `icon?:IconName`, `children` | `.banner {banner--tone}` > `Icon?` + children |

- **Stepper nội dung `.bul`:** `done` → `<Icon name="ic-check" />`; các state khác → **số thứ tự (index+1)**. Lưu ý: mockup có 1 node `gate` cuối ("Hoàn thành") vẽ tick trang trí — hợp đồng chính tắc **done=tick, còn lại=số** rõ hơn; giữ quy tắc này, coi tick-trên-gate là flourish riêng của mockup (ghi trong Completion Notes nếu cần).
- **`mono` cho KPI:** số liệu/tiền dùng `mono` (`tabular-nums`, canh phải — `.mono` từ tokens.css) để cột thẳng; mockup luôn `.k-v mono`. Mặc định `mono=false`; màn số/tiền truyền `mono`.

### Gotcha bắt buộc xử lý

- **Ring stepper vs "no box-shadow" (chính):** drift-guard test 3 của 1.3 cấm **mọi** `box-shadow` khi quét toàn `components.css`. Thêm ring `.step.current .bul{box-shadow:0 0 0 3px var(--teal-050)}` sẽ **fail** test này. Xử lý ở **Task 3**: nới test cho phép **đúng** ring phẳng `0 0 0 3px var(--teal-050)` (0 blur/offset), vẫn cấm mọi shadow có blur/offset + gradient + background-image. Căn cứ: DESIGN.md dòng 217 phê chuẩn ring là "viền kép hữu hạn". **Không** đổi ring sang `outline` (lệch mockup verbatim; `outline` render khác với border-radius trên vài browser).
- **Radius var mismatch (tiền lệ 1.3/1.4):** mockup `var(--r)`/`var(--r-lg)` undefined trong tokens.css → phải remap `--radius`/`--radius-lg` (2 chỗ: `.banner`, `.kpi`). Test 4 của 1.3 chặn `var(--r*)` sót. **Không** đụng `.bul{border-radius:50%}` (hình tròn).
- **Stepper không có state disabled/xám (AC-2/UX-DR-11):** đừng thêm biến thể mờ cho bước "không áp dụng" — bước như vậy do caller **loại khỏi `steps`**. Union `StepState` chỉ gồm `done|current|gate`. `gate` (viền đứt) ≠ inapplicable.
- **Banner icon optional:** UX-DR-13 nói "icon SVG bên trái" nhưng mockup có banner info **không** icon (dòng 506). Giữ `icon?` optional để cả có/không icon đều khớp mockup; warn/danger thường có (`ic-clock`/`ic-alert`), info thường không.
- **Table không sub-component:** CSS nhắm element `.table th/td/tr` → `Table` chỉ là wrapper `<table className="table">`. Dựng `Th`/`Td` là over-engineering (YAGNI) và lệch cách CSS viết. Ghi hợp đồng class trong docstring để màn biết dùng `.num`/`.strong`/`zebra`/`.mono`.
- **Web chưa có tooling TS/build (kế thừa 1.2/1.3/1.4):** chưa có `tsc`/bundler/entry web → **không typecheck** `.tsx` ở story này. Component bảo vệ bằng **drift-guard đọc CSS** + review thủ công TSX. **Không** scaffold bundler/tsconfig chỉ để typecheck (YAGNI). Ghi deviation trong Completion Notes.
- **Node test glob:** `design-system/package.json` dùng `"**/*.test.mjs"` → tự bao `components.test.mjs`. **Xác minh** rồi mở rộng; không sửa glob.

### Testing standards [Source: project-context.md#Testing, Story 1.1/1.2/1.3/1.4 pattern]

- **Drift-guard bắt buộc:** mở rộng `components.test.mjs` khẳng định đủ selector 4 component + verbatim lõi + hex literal + radius remap; **nới** test "no box-shadow" cho ring phê chuẩn. Test phải **fail** nếu lệch mockup, đổi hex, quên remap, hoặc thêm shadow/gradient trang trí.
- **JSX render test hoãn** (như 1.2/1.3/1.4 — Node zero-dep hiện tại không render JSX). Hợp đồng TSX (Stepper state→class, Banner tone→class, KPI accent/mono, barrel) **verify bằng review thủ công** + có thể được QA automation bổ sung **source-guard TSX** (`*-components.test.mjs`, đọc file như text — như `chip-components.test.mjs` của 1.4). Ghi là known limitation.
- Chạy: `cd design-system && npm test` (mong đợi 43 → nhiều hơn, toàn pass, không hồi quy). **Không** cần `flutter test` (web-only).

### Previous Story Intelligence (Story 1.4) [Source: 1-4-react-chip-status-chip-9-trang-thai-chip-chi-doc.md]

- **Pattern đã chốt:** append CSS verbatim + remap radius var + component hand-author `// hand-authored` + class join `[...].filter(Boolean).join(' ')` + union-typed props + mở rộng barrel không phá export cũ + mở rộng `components.test.mjs`. Lặp lại y hệt.
- **Suite hiện tại 43 test** (30 gốc 1.3 + 5 CSS chip + 8 TSX chip-guard). 1.5 mở rộng `components.test.mjs` (CSS). Đừng phá test cũ; chỉ **sửa** test 3 (box-shadow) + **append** test mới.
- **Test 3 & 8 của 1.3 quét toàn file** → tự bao khối mới. Test 8 (cross-file var integrity) yêu cầu mọi `var()` mới phải có trong tokens.css (đã verify). Test 3 (no shadow) là điểm **phải sửa** cho ring stepper.
- **Bài học remap:** 1.3 remap `--r/--r-sm/--r-lg`→`--radius/--radius-sm/--radius-lg`; 1.4 remap `999px`→`--radius-full`. 1.5 remap `--r`→`--radius` (banner), `--r-lg`→`--radius-lg` (kpi). Cùng nguyên tắc: tiêu thụ token, không magic number/var undefined.

### Git Intelligence [Source: recent commits]

- `e59ed50 feat(story-1.4)` · `b98d567 feat(story-1.3)` · `18e0dc0 feat(story-1.2)` · `356314c feat(story-1.1)`. Baseline story này = **e59ed50** (HEAD, sau 1.4). Commit conventional `feat(story-1.5): …`, tiếng Việt, **không** tham chiếu AI. File đụng: `web/src/design-system/components/*` + `design-system/components/components.test.mjs` (như 1.4).

### Project Structure Notes

- **Surgical (project-context.md#Scout-before-code):** chỉ **thêm** 4 khối CSS + 4 file component + cập nhật barrel + mở rộng/sửa test. **Không** đụng khối `.btn/.card/.frame/.field/.chip*` trong `components.css`, không đụng `tokens/*`, `icons/*` (đã ship, đã test).
- Đường dẫn:
  - Append CSS: `web/src/design-system/components/components.css` (thêm 4 khối cuối file).
  - Component web: `web/src/design-system/components/` → `Table.tsx`, `Stepper.tsx`, `Kpi.tsx`, `Banner.tsx` (mới); `index.ts` (sửa: thêm export).
  - Test drift-guard: `design-system/components/components.test.mjs` (sửa test 3 + append test 4 component).

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html] — khối CSS Banner (dòng 111–116), Table (118–126), Stepper (128–141), KPI (143–149); `.banner/.table/.step/.kpi .icn` size (dòng 326–328); ví dụ DOM stepper (dòng 502–504, 1725–1735), KPI (632–652), banner (1212/1424). **Nguồn thị giác thắng. Copy verbatim.**
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md] — component list Table/Stepper/KPI/Banner (dòng 238–241); **ngoại lệ box-shadow ring stepper được phê chuẩn** (dòng 217); radius DEFAULT/lg map (dòng 224–225); semantic màu (dòng 166); display type KPI (dòng 192); micro-uppercase (dòng 196); icon size 14px bảng/stepper (dòng 253).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] — user story + 4 AC (UX-DR-10/11/12/13); UX-DR-4 (Viền nét), UX-DR-26 (a11y nhãn chữ); chart thuộc dashboard 8.1 (dòng 559); Flutter parity 1.7 (dòng 243).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-13] — design-system-first, cấm style ad-hoc; #AD-11 — chỉ `applyTransition` đổi status (Stepper chỉ hiển thị).
- [Source: _bmad-output/implementation-artifacts/1-4-react-chip-status-chip-9-trang-thai-chip-chi-doc.md] — pattern append CSS/component/test, remap radius var, gotcha "web chưa có tsc", drift-guard `components.test.mjs` (test 3 no-shadow + test 8 cross-file var), suite 43 test.
- [Source: web/src/design-system/tokens/tokens.css] — `--radius` (37), `--radius-lg` (38), `--surface-2` (17), `--ink-2` (12), `--muted` (13), `--line` (14), `--teal/--teal-050/--teal-700`, `--ok` (18), `--warn` (19), `--danger` (20), `--info` (21) (verify tên trước khi consume).
- [Source: web/src/design-system/icons/Icon.tsx, design-system/icons/icons.json] — `Icon` component API (`name: IconName`, `size`, `.icn` class) + sprite có `ic-check`/`ic-alert`/`ic-clock`/`ic-info`.
- [Source: _bmad-output/project-context.md] — stack version, thuần front-end, Design-system-first, testing, scout-before-code, gotcha AD-11.

**Stack liên quan:** React (Web) 19.2.7 · Node.js 24 LTS. **Không** cần dependency web ngoài (CSS thuần + React function components + test Node zero-dep). Story web-only — **không** đụng Flutter/`mobile/`. [Source: ARCHITECTURE-SPINE.md#Stack, project-context.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8, 1M context)

### Debug Log References

- 2 false-positive trong drift-guard do **comment trong `components.css`** chứa chuỗi bị regex quét (test quét toàn file như text):
  1. Comment viết `var(--r)`/`var(--r-lg)` → test 8 (cross-file token integrity) báo token thiếu. Sửa: comment nói `--r`/`--r-lg` không có wrapper `var(...)` (theo tiền lệ 1.3).
  2. Comment viết literal `box-shadow:0 0 0 3px var(--teal-050) — …` → test 3 (relaxed) bắt cả chuỗi comment vì regex `box-shadow:([^;}]+)` chạy tới `}` kế tiếp. Sửa: đổi câu chữ comment không còn token `box-shadow:`.
- Negative-check test 3 (relaxed box-shadow): tạm chèn `.kpi{box-shadow:0 2px 8px rgba(0,0,0,.1)}` → test **fail** đúng như mong đợi (shadow có blur/offset bị cấm); revert → 49/49 pass. Xác nhận ring `0 0 0 3px var(--teal-050)` được cho qua, drop-shadow trang trí bị chặn.

### Completion Notes List

- **Task 1 (CSS):** Append 4 khối Banner/Table/Stepper/KPI verbatim từ mockup vào cuối `components.css`, sau khối chip 1.4. Remap đúng 2 chỗ radius: `.banner`→`var(--radius)`, `.kpi`→`var(--radius-lg)`. Giữ ring stepper `current` `box-shadow:0 0 0 3px var(--teal-050)` (ngoại lệ phê chuẩn DESIGN.md 217). Giữ verbatim mọi hằng hex canonical (zebra `#F7FBFA`; banner warn/info/danger; stepper `#fff`/`#9fb2ad`/`#c3d3ce`/`#a9bab5`) — KHÔNG tokenize (tránh scope-creep 1.1). KHÔNG đụng khối `.btn/.card/.frame/.field/.chip*`.
- **Task 2 (React):** 4 component hand-author theo pattern `Button.tsx`/`Icon.tsx`. `Table` = wrapper mỏng `<table className="table">` + forward `...rest`, hợp đồng class `.num/.strong/.mono/tr.zebra` ghi trong docstring (KHÔNG dựng `Th/Td/Tr` — YAGNI). `Stepper` prop `steps: StepItem[]`, union `StepState='done'|'current'|'gate'` (KHÔNG có `disabled`/`grayed`), `.bul` = `ic-check` khi `done` else số 1-based, `.bar` bỏ ở step cuối. `Kpi` props `label/value/delta?/accent?/mono?`, delta luôn màu `ok` (CSS set). `Banner` `tone?='warn'`(base, không modifier)`/info/danger`, `icon?: IconName` optional, `<b>` tự đậm. Mở rộng `index.ts` barrel — không phá export 1.3/1.4.
- **Task 3 (Test):** Nới **test 3**: cấm tuyệt đối `gradient`/`background-image`; gom mọi `box-shadow:` bằng regex, assert từng cái `=== '0 0 0 3px var(--teal-050)'` (drop-shadow có blur/offset vẫn fail). Append **test 14–19**: đủ selector 4 component, verbatim lõi Table/Stepper/KPI/Banner, radius remap. Suite **43 → 49 test, toàn pass, 0 hồi quy**.
- **Deviation (known limitation, kế thừa 1.2/1.3/1.4):** Web chưa có tooling TS/build (không `tsc`/bundler/entry) → **không typecheck** `.tsx`. Component bảo vệ bằng drift-guard đọc CSS (text) + review thủ công TSX. **KHÔNG** scaffold bundler/tsconfig chỉ để typecheck (YAGNI). JSX render test hoãn như tiền lệ; QA automation có thể bổ sung source-guard TSX sau.
- **Mockup flourish ghi nhận:** mockup vẽ tick trang trí trên 1 node `gate` cuối ("Hoàn thành"); hợp đồng chính tắc **done=tick, còn lại=số** rõ hơn — giữ quy tắc này, coi tick-trên-gate là flourish riêng của mockup.

### File List

- `web/src/design-system/components/components.css` (sửa: append 4 khối CSS Banner/Table/Stepper/KPI)
- `web/src/design-system/components/Table.tsx` (mới)
- `web/src/design-system/components/Stepper.tsx` (mới)
- `web/src/design-system/components/Kpi.tsx` (mới)
- `web/src/design-system/components/Banner.tsx` (mới)
- `web/src/design-system/components/index.ts` (sửa: thêm export 4 component + type)
- `design-system/components/components.test.mjs` (sửa: nới test 3 + append test 14–19)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (sửa: 1-5 → in-progress → review)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Story 1.5 tạo (create-story): cấp data/feedback layer (React) — spec append CSS Banner/Table/Stepper/KPI verbatim (remap `--r`/`--r-lg`→`--radius`/`--radius-lg`, giữ ring stepper phê chuẩn), 4 component `Table`/`Stepper`/`Kpi`/`Banner`, mở rộng barrel + drift-guard (nới rào box-shadow cho ring). Status: backlog → ready-for-dev. |
| 2026-07-08 | Story 1.5 dev (dev-story): append 4 khối CSS verbatim + remap radius 2 chỗ + giữ ring stepper; thêm 4 component React (`Table`/`Stepper`/`Kpi`/`Banner`) + mở rộng barrel; nới drift-guard test 3 (chỉ cho phép ring `0 0 0 3px var(--teal-050)`) + append test 14–19. Suite 43 → 49 test, toàn pass, 0 hồi quy. Status: ready-for-dev → review. |
