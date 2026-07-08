---
baseline_commit: b98d567
---

# Story 1.4: React — Chip, Status-chip (9 trạng thái), chip chỉ đọc

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên web**,
I want **component Chip/Status-chip với đủ 9 trạng thái canonical (đọc-only) + biến thể `.ktype` và `.scope-flag`, dựng từ token dùng chung**,
so that **mọi nơi hiển thị trạng thái đơn dùng đúng MỘT bộ màu canonical — không tự chế màu, không biến chip thành nút bấm**.

## Acceptance Criteria

1. **Given** token chip, **When** dựng Chip, **Then** pill bo **full**, viền **1.5px**, chữ **11px/700**, có `.dot` **6px** cùng màu chữ (`currentColor`), kèm biến thể `.ktype` (viền `lime`, nền `lime-050`) và `.scope-flag` (`on` = viền teal + chữ `teal-700`, `off` = viền line + chữ mờ **gạch ngang**) (UX-DR-7).
2. **Given** 9 trạng thái đơn, **When** render status chip, **Then** đủ **9 chip** đúng bộ 3 hex bg/fg/border và **nhãn verbatim** — Báo giá `#EAF3F1/#3A5450/#CFE5E0`, Chờ duyệt `#FBF0DA/#8A5C08/#EFD9A8`, Đã chốt `#DCF3EF/#0B7264/#B7E5DD`, Đã cọc `#E7F5D9/#4B7A15/#CDE9AC`, Đang thi công `#FCEAD4/#985B08/#F2D3A6`, Nghiệm thu `#E4EEFA/#345C9C/#C4D8F0`, Đang giao `#DEF1F6/#0C6B84/#B7E0EB`, Hoàn thành `#DEF3E6/#137A4C/#B7E5CA`, Huỷ `#FAE6E6/#B22C2C/#F0C7C7` (UX-DR-8) **And** KHÔNG có màu trạng thái nào khác được phép.
3. **Given** status chip, **When** người dùng bấm vào chip, **Then** chip **KHÔNG đổi trạng thái** (chỉ đọc); đổi trạng thái đi qua màn chuyển trạng thái riêng (UX-DR-23) — component **không** nhận/forward `onClick`, không render `<button>`, không `role="button"`/`tabindex`.
4. **Given** quy tắc "Viền nét", **When** render mọi chip trên, **Then** **tuyệt đối phẳng, không drop-shadow/gradient** (UX-DR-4).

## Tasks / Subtasks

- [x] **Task 1 — Nối CSS chip verbatim vào `components.css` (AC: 1, 2, 4)**
  - [x] **Nối thêm** (append) khối CSS chip vào cuối `web/src/design-system/components/components.css` — **copy verbatim** từ khối CSS trong `mockups/all-screens.html` (dòng 90–109): `.chip` + `.chip .dot` + 9 rule `.chip--*` + `.ktype` + `.scope-flag` + `.scope-flag.on` + `.scope-flag.off`. Xem bảng "Đặc tả CSS verbatim" trong Dev Notes. **KHÔNG** đụng khối `.btn/.card/.frame/.field` đã ship (Story 1.3) — chỉ **thêm** khối chip.
  - [x] **Remap tên biến radius pill (gotcha bắt buộc):** mockup dùng literal `border-radius:999px` cho `.chip`/`.ktype`/`.scope-flag`. Tầng token 1.1 đã phát `--radius-full: 9999px` **dành riêng cho chip/pill** (xác minh `web/src/design-system/tokens/tokens.css` dòng 39; DESIGN.md UX-DR-2 "full chỉ cho chip/pill"). **Thay 3 chỗ** `border-radius:999px` → `border-radius:var(--radius-full)` (tiêu thụ token, không để magic number — AD-13 cấm ad-hoc). **Giữ nguyên** `.chip .dot{border-radius:50%}` (hình tròn, không phải pill token).
  - [x] Giữ **verbatim** các hằng riêng của chip không nằm trong token set: 9 bộ hex status (`#EAF3F1`…`#F0C7C7`), `#9fb2ad` (chữ `.scope-flag.off`, trùng hằng placeholder Story 1.3), `#fff` (nền `.scope-flag`). **KHÔNG** tokenize 9 hex status — chúng là màu canonical cố ý để literal, KHÔNG có trong `tokens.css`; thêm vào token layer là scope-creep sang Story 1.1.
  - [x] **Viền nét (AC-4):** KHÔNG thêm `box-shadow`/`shadow`/`gradient`/`background-image`; phân cấp chỉ bằng viền 1.5px + nền token/hex. (Drift-guard test 3 của 1.3 quét toàn file → tự bao khối chip mới.)
- [x] **Task 2 — Component React chip typed, chỉ-đọc (AC: 1, 2, 3)**
  - [x] `StatusChip.tsx`: prop `status: StatusKey` với `StatusKey = 'baogia' | 'choduyet' | 'dachot' | 'dacoc' | 'thicong' | 'nghiemthu' | 'danggiao' | 'hoanthanh' | 'huy'` (union chặn trạng thái tự chế — AC-2). Render **span chỉ-đọc**: `<span className="chip chip--{status}"><span className="dot" />{label}</span>`. Có `STATUS_LABELS` const map key → nhãn canonical (bảng trong Dev Notes); prop `label?: string` cho phép override nhãn hiển thị (mặc định = nhãn canonical). **KHÔNG** khai báo/forward `onClick`; **KHÔNG** spread `...rest` chứa handler làm chip thành nút — chỉ forward các prop trình bày an toàn (`className`, `title`, `aria-*`) nếu cần. Đây là điểm chốt AC-3 (UX-DR-23).
  - [x] `CustomerTypeChip.tsx` (class `.ktype`): render `<span className="ktype">{children}</span>` (nội dung = loại khách, vd "Thợ khảo sát"). Span tĩnh, không tương tác.
  - [x] `ScopeFlag.tsx` (class `.scope-flag`): prop `on: boolean` + `children` (nhãn quyền/phạm vi). Render `<span className={`scope-flag ${on ? 'on' : 'off'}`}>{children}</span>`. Đây là **cờ hiển thị** trạng thái phạm vi (UX-DR-7 "on = teal, off = gạch ngang mờ") — KHÔNG phải toggle; không đổi state khi bấm (a11y: nếu cần semantics, để screen tiêu thụ quyết định, story này chỉ cấp primitive hiển thị).
  - [x] Cập nhật `index.ts` barrel: thêm export `StatusChip` (+ `StatusChipProps`, `StatusKey`), `CustomerTypeChip` (+ props), `ScopeFlag` (+ props). **Không** xoá/sửa export Story 1.3.
  - [x] **Pattern component** (theo `Icon.tsx`/`Button.tsx` đã ship): React function component, prop union-typed, className ghép `[...].filter(Boolean).join(' ')`, header `// hand-authored`.
- [x] **Task 3 — Mở rộng drift-guard test cho chip (AC: 1, 2, 3, 4)**
  - [x] **Nối thêm** test vào `design-system/components/components.test.mjs` (cùng file 1.3 — glob `**/*.test.mjs` đã bao; đừng dựng file/runner mới). Khẳng định:
    - **Đủ selector:** `.chip`, `.chip .dot`, 9 `.chip--*` (`baogia/choduyet/dachot/dacoc/thicong/nghiemthu/danggiao/hoanthanh/huy`), `.ktype`, `.scope-flag`, `.scope-flag.on`, `.scope-flag.off` (thiếu một = fail — AC-1/2).
    - **9 bộ hex verbatim:** mỗi `.chip--*` chứa đúng `background:#…;color:#…;border-color:#…` theo bảng AC-2 (drift-guard chống đổi/tự chế màu status).
    - **Đặc tả lõi chip:** `.chip` có `font-size:11px`, `font-weight:700`, `border:1.5px solid transparent`; `.chip .dot` có `width:6px;height:6px` + `background:currentColor`; `.ktype` refs `var(--lime)` (viền) + `var(--lime-050)` (nền); `.scope-flag.on` refs `var(--teal)`; `.scope-flag.off` có `text-decoration:line-through` + `#9fb2ad`.
    - **Radius pill remap:** khối chip dùng `var(--radius-full)` và **KHÔNG** chứa literal `999px`/`9999px` (bắt lỗi quên remap — song song "no raw --r*" của 1.3). Lưu ý test này quét toàn file; `.chip .dot{border-radius:50%}` vẫn hợp lệ (không phải 999).
    - (AC-4 & cross-file integrity đã được test 3 & 8 của 1.3 tự bao khi quét toàn `components.css` — không cần lặp lại.)
  - [x] Chạy `cd design-system && npm test` — **toàn bộ pass, không hồi quy** token/icon/Story 1.3 (suite 30 → **35 test, toàn pass**). Test phải **fail** nếu ai đổi/xoá một rule chip hoặc lệch hex canonical.

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này **CHỈ WEB (React)** — giao **chip layer**: khối CSS chip + 3 component (`StatusChip` 9 trạng thái, `CustomerTypeChip`=`.ktype`, `ScopeFlag`=`.scope-flag`) + mở rộng drift-guard test. Đây là mảnh tiếp theo của hợp đồng thị giác, để màn danh sách/chi tiết đơn (Epic 4/5) tiêu thụ.
- **Ngoài phạm vi (thuộc story khác — KHÔNG làm ở đây):**
  - **Flutter/mobile parity** cho chip → **Story 1.7**. 1.4 **không** đụng `mobile/`.
  - Table / Stepper / KPI / Banner → **Story 1.5** (chip xuất hiện *bên trong* ô Table ở 1.5, nhưng component chip do 1.4 cấp).
  - Logic **đổi trạng thái đơn** (`applyTransition`, gate cờ+quyền, màn chuyển trạng thái) → **Backend Epic 5 / màn Story 5.x**. 1.4 chỉ hiển thị trạng thái **đọc-only**; tuyệt đối không cài hành vi đổi status.
  - Ánh xạ `StatusKey` (design-system) ↔ **enum `Order.status`** của backend → định nghĩa khi backend ra đời (Epic 4/5). 1.4 dùng key = hậu tố class canonical; **không** đoán enum backend.
- **Nhưng:** chip phải **đủ 9 trạng thái + 2 biến thể ngay** để story sau dùng mà không phải bổ sung.

### Tái dùng hạ tầng 1.1/1.2/1.3 — KHÔNG tạo trùng (DRY, scout-before-code)

- **Package `design-system/`** (1.1) + cây `web/src/design-system/components/` (1.3) **đã tồn tại**. Story 1.4 **mở rộng cùng chỗ**: append vào `components.css`, thêm `*.tsx` cạnh `Button/Card/Frame/Field`, cập nhật `index.ts`, append test vào `components.test.mjs`. **Đừng** dựng package/thư mục/test-runner thứ hai.
- **Consume, không re-declare:** chip tham chiếu token `--radius-full`, `--lime`, `--lime-050`, `--teal`, `--teal-700`, `--line`, `--ink` (do `tokens.css` phát). Verify tên biến trong `web/src/design-system/tokens/tokens.css` **trước** khi viết (đặc biệt `--radius-full` — gotcha remap). 9 hex status **không** phải token → literal verbatim.
- **KHÔNG cần generator/SSOT JSON:** chip web-only, hand-author CSS/TSX verbatim + drift-guard là đủ (KISS/YAGNI). Flutter parity (1.7) dựng widget riêng cùng token/hình/đặc tả — không copy CSS.

### Kiến trúc & nguyên tắc bắt buộc

- **AD-13 (Design-system-first):** chip là mảnh kế của DESIGN.md, dựng **trước mọi màn**; màn sau **cấm style ad-hoc** — phải dùng `StatusChip`/`.ktype`/`.scope-flag` + 9 hex canonical. [Source: ARCHITECTURE-SPINE.md#AD-13, project-context.md]
- **Thuần front-end trình bày:** story **không** chạm backend/DB/business logic. Chip **không** chứa logic nghiệp vụ; đặc biệt **KHÔNG** đổi `Order.status` — đó là độc quyền `applyTransition()` ở backend (AD-11). Chip = hiển thị đọc-only. [Source: project-context.md#gotchas AD-11]
- **Nguồn thị giác duy nhất:** khối CSS `mockups/all-screens.html` (dòng 90–109) + bảng màu DESIGN.md#Status-chip. "Khi xung đột, mockup thắng" → **copy verbatim, không tự nhớ/tự chế**. [Source: DESIGN.md#Status-chip]
- **Read-only là bất biến UX (UX-DR-23):** status chip **không bao giờ** là nút đổi trạng thái. Render `<span>` tĩnh; không `onClick`, không `<button>`, không `role`/`tabindex`. Đây là AC-3 và là lỗi dễ mắc nhất — người ta hay gắn `onClick` để mở màn. Nếu screen cần mở chi tiết, nút/hàng khác chịu trách nhiệm, KHÔNG phải chip. [Source: epics.md#UX-DR-23, DESIGN.md]
- **A11y floor (UX-DR-26):** chip mang **nhãn chữ** (không chỉ màu) — `StatusChip` luôn render text nhãn, `.dot` chỉ là phụ trợ. Contrast ink-trên-surface của 9 bộ hex đã được DESIGN.md xác nhận đạt đọc-ngoài-trời. [Source: epics.md#UX-DR-26, DESIGN.md#Status-chip]
- **Naming/convention:** file component React PascalCase (`StatusChip.tsx`… — nhất quán `Icon.tsx`/`Button.tsx`). Web = React function components + hooks. [Source: project-context.md#Coding style]

### Đặc tả CSS verbatim (nguồn: mockups/all-screens.html dòng 90–109) [Source: mockups/all-screens.html, DESIGN.md#Status-chip, UX-DR-4/7/8]

> **Copy verbatim.** Chỉ đổi **radius pill** `999px` → `var(--radius-full)` ở `.chip`/`.ktype`/`.scope-flag` (3 chỗ). Mọi hex + giá trị khác giữ nguyên. `.chip .dot{border-radius:50%}` KHÔNG đổi.

**Status chip base + dot (AC-1):**
```css
.chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;
  padding:3px 9px;border-radius:var(--radius-full);border:1.5px solid transparent;white-space:nowrap}
.chip .dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.85}
```

**9 trạng thái canonical (AC-2) — bg / fg / border verbatim:**
```css
.chip--baogia    {background:#EAF3F1;color:#3A5450;border-color:#CFE5E0}
.chip--choduyet  {background:#FBF0DA;color:#8A5C08;border-color:#EFD9A8}
.chip--dachot    {background:#DCF3EF;color:#0B7264;border-color:#B7E5DD}
.chip--dacoc     {background:#E7F5D9;color:#4B7A15;border-color:#CDE9AC}
.chip--thicong   {background:#FCEAD4;color:#985B08;border-color:#F2D3A6}
.chip--nghiemthu {background:#E4EEFA;color:#345C9C;border-color:#C4D8F0}
.chip--danggiao  {background:#DEF1F6;color:#0C6B84;border-color:#B7E0EB}
.chip--hoanthanh {background:#DEF3E6;color:#137A4C;border-color:#B7E5CA}
.chip--huy       {background:#FAE6E6;color:#B22C2C;border-color:#F0C7C7}
```

**Customer-type + scope-flag (AC-1):**
```css
.ktype{font-size:10.5px;font-weight:800;color:var(--ink);border:1.5px solid var(--lime);
  background:var(--lime-050);padding:3px 10px;border-radius:var(--radius-full)}
.scope-flag{font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:var(--radius-full);background:#fff}
.scope-flag.on{border:1.5px solid var(--teal);color:var(--teal-700)}
.scope-flag.off{border:1.5px solid var(--line);color:#9fb2ad;text-decoration:line-through}
```
- `.chip` viền `transparent` để `.chip--*` set `border-color` riêng. `.dot` dùng `currentColor` → tự khớp màu chữ status (AC-1 "cùng màu chữ"). `.scope-flag.off` gạch ngang + chữ mờ `#9fb2ad` (trùng hằng placeholder 1.3 — verbatim). `.ktype` dùng lime (cờ loại khách — DESIGN.md: lime tiết chế).

### Ánh xạ `StatusKey` → nhãn canonical (dùng trong `StatusChip.tsx`)

| `status` (key = hậu tố class) | class | Nhãn canonical (verbatim) |
|---|---|---|
| `baogia` | `.chip--baogia` | Báo giá |
| `choduyet` | `.chip--choduyet` | Chờ duyệt |
| `dachot` | `.chip--dachot` | Đã chốt |
| `dacoc` | `.chip--dacoc` | Đã cọc |
| `thicong` | `.chip--thicong` | Đang thi công |
| `nghiemthu` | `.chip--nghiemthu` | Nghiệm thu |
| `danggiao` | `.chip--danggiao` | Đang giao |
| `hoanthanh` | `.chip--hoanthanh` | Hoàn thành |
| `huy` | `.chip--huy` | Huỷ |

- Nhãn = verbatim AC-2 / DESIGN.md bảng. Mockup có chỗ ghi "Chờ duyệt CK" nhưng **nhãn canonical = "Chờ duyệt"**; nếu screen muốn "CK" thì truyền `label` override. Mặc định luôn là nhãn canonical.

### Gotcha bắt buộc xử lý

- **Radius pill mismatch (chính):** mockup literal `999px` ≠ token `--radius-full: 9999px`. Cả hai render pill như nhau, nhưng token được tạo **đúng cho chip/pill** (tokens.css dòng 35–39 + DESIGN.md UX-DR-2). Remap `999px` → `var(--radius-full)` (3 chỗ) để không để magic number (AD-13). Test Task 3 chặn literal `999px`/`9999px` sót lại. **Không** thêm alias khác vào token 1.1 (surgical).
- **Chip biến thành nút (AC-3, dễ mắc nhất):** đừng thêm `onClick`/`<button>`/`role="button"`/`tabindex` vào `StatusChip`. Chip đọc-only; đổi trạng thái đi qua màn riêng (Epic 5). Nếu spread `...rest`, **loại** các handler tương tác — chỉ cho `className`/`title`/`aria-*`. An toàn nhất: **không** spread `...rest` ở `StatusChip`.
- **Web chưa có tooling TS/build (kế thừa 1.2/1.3):** chưa có `tsc`/bundler/entry web → **không typecheck** `.tsx` ở story này. Component bảo vệ bằng **drift-guard đọc CSS** + review thủ công TSX (gồm kiểm read-only). **Không** scaffold bundler/tsconfig chỉ để typecheck (YAGNI). Ghi deviation trong Completion Notes.
- **Node test glob:** `design-system/package.json` dùng `"**/*.test.mjs"` → tự bao `components.test.mjs`. **Xác minh** rồi append test; không sửa glob.

### Testing standards [Source: project-context.md#Testing, Story 1.1/1.2/1.3 pattern]

- **Drift-guard bắt buộc:** append test vào `components.test.mjs` khẳng định đủ selector chip + 9 hex verbatim + đặc tả lõi + radius-full remap. Test phải **fail** nếu chip lệch mockup, đổi hex canonical, hoặc quên remap.
- **JSX render test hoãn** (như 1.2/1.3 — không test được với Node zero-dep hiện tại). Read-only của `StatusChip` (AC-3) **verify bằng review thủ công TSX** + không có `onClick` trong signature. Ghi là known limitation.
- Chạy: `cd design-system && npm test` (mong đợi 30 → nhiều hơn, toàn pass, không hồi quy). **Không** cần `flutter test` (web-only).

### Project Structure Notes

- **Surgical (project-context.md#Scout-before-code):** chỉ **thêm** khối chip + 3 file component + cập nhật barrel/test. **Không** đụng khối `.btn/.card/.frame/.field` trong `components.css`, không đụng `tokens/*`, `icons/*` (đã ship, đã test).
- Đường dẫn:
  - Append CSS: `web/src/design-system/components/components.css` (thêm khối chip cuối file).
  - Component web: `web/src/design-system/components/` → `StatusChip.tsx`, `CustomerTypeChip.tsx`, `ScopeFlag.tsx` (mới); `index.ts` (sửa: thêm export).
  - Test drift-guard: `design-system/components/components.test.mjs` (sửa: append test chip).

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html] — khối CSS chip dòng 90–109 (`.chip/.chip .dot/.chip--*/.ktype/.scope-flag`); ví dụ dùng `<span class="chip chip--*"><span class="dot"></span>Nhãn</span>` (dòng 393–401). **Nguồn thị giác thắng. Copy verbatim.**
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Status-chip] — bảng 9 hex canonical (dòng 168–182) + quy tắc Chip/ktype/scope-flag (dòng 236) + full 9999px cho chip (dòng 226).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — user story + 3 AC (UX-DR-7/8/23).
- [Source: _bmad-output/planning-artifacts/epics.md] — UX-DR-7 (Chip), UX-DR-8 (9 status), UX-DR-23 (read-only), UX-DR-4 (Viền nét), UX-DR-26 (a11y nhãn chữ).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-13] — design-system-first, cấm style ad-hoc; #AD-11 — chỉ `applyTransition` đổi status.
- [Source: _bmad-output/implementation-artifacts/1-3-react-button-card-frame-field.md] — pattern component web hand-authored, drift-guard `components.test.mjs`, gotcha "web chưa có tsc", cây `web/src/design-system/components/`, radius-var remap tiền lệ.
- [Source: web/src/design-system/tokens/tokens.css] — `--radius-full` (dòng 39) + `--lime/--lime-050/--teal/--teal-700/--line/--ink` (verify tên trước khi consume).
- [Source: _bmad-output/project-context.md] — stack version, thuần front-end, Design-system-first, testing, scout-before-code, gotcha AD-11.

**Stack liên quan:** React (Web) 19.2.7 · Node.js 24 LTS. **Không** cần dependency web ngoài (CSS thuần + React function components + test Node zero-dep). Story web-only — **không** đụng Flutter/`mobile/`. [Source: ARCHITECTURE-SPINE.md#Stack, project-context.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8, 1M context)

### Debug Log References

- `cd design-system && npm test` → **43 tests pass, 0 fail**. Suite grew 30 → 43: +5 CSS drift-guard trong `components.test.mjs` (dev), +8 TSX source-guard trong `chip-components.test.mjs` (QA automation — tự động hoá bất biến read-only AC-3 vốn chỉ "review thủ công"). Không hồi quy token/icon/Story 1.3.

### Completion Notes List

- **Task 1 — CSS chip:** Append khối chip verbatim từ `mockups/all-screens.html` (dòng 90–109) vào cuối `components.css`, sau khối `.field`. Remap đúng 3 chỗ `border-radius:999px` → `var(--radius-full)` (`.chip`, `.ktype`, `.scope-flag`); giữ nguyên `.chip .dot{border-radius:50%}`. 9 hex status + `#9fb2ad` + `#fff` giữ literal (không tokenize — canonical cố ý). Không đụng khối `.btn/.card/.frame/.field`.
- **Task 2 — React components:** 3 file mới đều là function component tĩnh, header `// hand-authored`, className ghép `[...].filter(Boolean).join(' ')` theo pattern 1.3. `StatusChip` dùng `StatusKey` union (9 key) chặn trạng thái tự chế + `STATUS_LABELS` map nhãn canonical + prop `label?` override. **Read-only (AC-3/UX-DR-23):** cả 3 component render `<span>` tĩnh, KHÔNG `onClick`/`<button>`/`role`/`tabindex`, KHÔNG spread `...rest` — chỉ nhận `className` (và `on`/`children` với các flag). Barrel `index.ts` thêm export mới, giữ nguyên export 1.3.
- **Task 3 — Drift-guard:** Append 5 test (9–13) vào `components.test.mjs`: đủ 15 selector chip, 9 bộ hex verbatim, spec lõi (11px/700/border transparent/dot 6px currentColor), ktype/scope-flag token refs + strike-through, remap `var(--radius-full)` + chặn literal `999/9999px`. AC-4 (phẳng) + cross-file token integrity đã được test 3 & 8 của 1.3 tự bao khi quét toàn file.
- **Deviation có chủ đích (kế thừa 1.2/1.3):** Web chưa có tooling TS/build (`tsc`/bundler/entry) → KHÔNG typecheck `.tsx` ở story này (YAGNI, không scaffold bundler chỉ để typecheck). `.tsx` được bảo vệ bằng drift-guard đọc CSS + review thủ công (gồm xác nhận read-only, không handler). JSX render test hoãn (Node zero-dep hiện tại). Read-only AC-3 verify bằng review signature: không prop/handler tương tác trong bất kỳ component nào.
- **Web-only:** Không đụng `mobile/`. Flutter parity là Story 1.7.

### File List

- `web/src/design-system/components/components.css` (sửa: append khối CSS chip — `.chip`/`.chip .dot`/9 `.chip--*`/`.ktype`/`.scope-flag`/`.scope-flag.on`/`.scope-flag.off`)
- `web/src/design-system/components/StatusChip.tsx` (mới)
- `web/src/design-system/components/CustomerTypeChip.tsx` (mới)
- `web/src/design-system/components/ScopeFlag.tsx` (mới)
- `web/src/design-system/components/index.ts` (sửa: thêm export chip layer)
- `design-system/components/components.test.mjs` (sửa: append 5 test drift-guard CSS chip)
- `design-system/components/chip-components.test.mjs` (mới — QA: 8 test source-guard TSX, tự động hoá read-only AC-3 + hợp đồng union/nhãn + barrel)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Story 1.4: cấp chip layer (React) — append CSS chip verbatim (9 trạng thái + `.ktype` + `.scope-flag`, remap pill radius → `var(--radius-full)`), thêm `StatusChip`/`CustomerTypeChip`/`ScopeFlag` (span chỉ-đọc, union-typed), mở rộng barrel + drift-guard (30 → 35 test, toàn pass). Status: ready-for-dev → review. |
