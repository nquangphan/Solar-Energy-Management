---
title: "DESIGN — Phương Nam Solar App (Phase 1)"
status: final
created: 2026-07-06
updated: 2026-07-07
sources:
  - ../../prds/prd-Solar-Energy-Management-2026-07-06/prd.md
  - ./mockups/all-screens.html
name: Phương Nam Solar
description: Design system nội bộ quản lý đơn hàng điện mặt trời — dùng chung Web (React) và Mobile (Flutter). Phong cách "Viền nét" (blueprint) phẳng, bảng màu "Năng Lượng Sạch".
colors:
  teal: '#0E9F8E'
  teal-700: '#0B8578'
  teal-050: '#E6F6F4'
  lime: '#A3E635'
  lime-600: '#7DB800'
  lime-050: '#F1FBDD'
  ink: '#0C1F1C'
  ink-2: '#334E49'
  muted: '#4E6B66'
  line: '#DBEBE7'
  bg: '#F4FAF8'
  surface: '#FFFFFF'
  surface-2: '#ECF6F3'
  ok: '#159A6B'
  warn: '#D98A0B'
  danger: '#E14B4B'
  info: '#0E8FA8'
  status-baogia-bg: '#EAF3F1'
  status-baogia-fg: '#3A5450'
  status-baogia-bd: '#CFE5E0'
  status-choduyet-bg: '#FBF0DA'
  status-choduyet-fg: '#8A5C08'
  status-choduyet-bd: '#EFD9A8'
  status-dachot-bg: '#DCF3EF'
  status-dachot-fg: '#0B7264'
  status-dachot-bd: '#B7E5DD'
  status-dacoc-bg: '#E7F5D9'
  status-dacoc-fg: '#4B7A15'
  status-dacoc-bd: '#CDE9AC'
  status-thicong-bg: '#FCEAD4'
  status-thicong-fg: '#985B08'
  status-thicong-bd: '#F2D3A6'
  status-nghiemthu-bg: '#E4EEFA'
  status-nghiemthu-fg: '#345C9C'
  status-nghiemthu-bd: '#C4D8F0'
  status-danggiao-bg: '#DEF1F6'
  status-danggiao-fg: '#0C6B84'
  status-danggiao-bd: '#B7E0EB'
  status-hoanthanh-bg: '#DEF3E6'
  status-hoanthanh-fg: '#137A4C'
  status-hoanthanh-bd: '#B7E5CA'
  status-huy-bg: '#FAE6E6'
  status-huy-fg: '#B22C2C'
  status-huy-bd: '#F0C7C7'
typography:
  font-family:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  display:
    fontSize: 23px
    fontWeight: 900
    letterSpacing: '-.02em'
  title:
    fontSize: 15px
    fontWeight: 800
    letterSpacing: '-.01em'
  body:
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: '1.42'
  meta:
    fontSize: 12.5px
    fontWeight: 600
  micro:
    fontSize: 10px
    fontWeight: 800
    letterSpacing: '.1em'
rounded:
  sm: 8px
  DEFAULT: 10px
  lg: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 6px
  '3': 8px
  '4': 12px
  '5': 16px
  '6': 22px
  '7': 26px
  gutter: 12px
  page-x: 22px
  pscroll: 12px
components:
  button:
    border: '1.5px solid {colors.teal}'
    background: '{colors.surface}'
    color: '{colors.teal-700}'
    fontSize: 13px
    fontWeight: 800
    borderRadius: '{rounded.DEFAULT}'
    padding: '9px 15px'
  button-primary:
    background: '{colors.teal}'
    color: '#FFFFFF'
    borderColor: '{colors.teal}'
  card:
    background: '{colors.surface}'
    border: '1.5px solid {colors.line}'
    borderRadius: '{rounded.lg}'
  frame:
    border: '1.5px solid {colors.ink}'
    borderRadius: '{rounded.lg}'
    labelColor: '{colors.ink}'
  chip:
    borderRadius: '{rounded.full}'
    border: '1.5px solid transparent'
    fontSize: 11px
    fontWeight: 700
    padding: '3px 9px'
  field:
    border: '1.5px solid {colors.line}'
    borderRadius: '{rounded.DEFAULT}'
    focusBorder: '{colors.teal}'
    padding: '10px 12px'
    fontSize: 13.5px
  kpi:
    border: '1.5px solid {colors.line}'
    borderRadius: '{rounded.lg}'
    valueSize: 23px
    accentBg: '{colors.teal-050}'
  topbar:
    borderBottom: '1.5px solid {colors.ink}'
    background: '{colors.surface}'
    titleSize: 15px
  botnav:
    tabs: 5
    borderTop: '1.5px solid {colors.ink}'
    fabBg: '{colors.teal}'
    fabRing: '{colors.teal-700}'
  icon:
    system: 'inline SVG sprite (Lucide-style)'
    stroke: currentColor
    strokeWidth: 2px
    usage: '<use href="#ic-*">'
---

Nguồn thị giác duy nhất: [`./mockups/all-screens.html`](./mockups/all-screens.html) — 30 màn, mỗi màn có cả bản Web lẫn Mobile (riêng Cấu hình nguồn khách chỉ có Web), một khối `<style>` chung. Mọi token, hex, spacing, radius và style component bên dưới được rút trực tiếp từ khối `:root` và các class trong file đó. Khi có xung đột, mockup thắng.

## Brand & Style

Đây là app nội bộ cho đội bán hàng và thi công điện mặt trời Phương Nam Solar — công cụ vận hành, không phải trang marketing. Vibe: **hiện đại, tươi sáng, điềm tĩnh, đáng tin**. Không có logo/brand asset sẵn nên bản sắc được xây từ đầu quanh hai trụ: bảng màu **"Năng Lượng Sạch"** và phong cách **"Viền nét" (blueprint)**.

Phong cách "Viền nét" là hồn của hệ thống: giao diện **phẳng tuyệt đối, KHÔNG đổ bóng**. Phân cấp thị giác đến từ **đường viền 1.5px** (teal hoặc mực ink), **nhãn micro chữ hoa** giãn chữ, và khoảng trắng — chứ không đến từ shadow hay gradient. Cảm giác như một bản vẽ kỹ thuật sạch sẽ: chính xác, dày đặc thông tin, dễ quét mắt. Teal đóng vai "mực"; lime là điểm nhấn năng lượng dùng tiết chế.

Một design system, hai nền tảng: **Web (React)** và **Mobile (Flutter)** dùng chung token, cùng ngôn ngữ component. Cùng một màn phải nhận ra được trên cả hai nền tảng — chỉ khác khung (browser chrome vs phone frame) và điều hướng (sidebar vs bottom-nav).

## Colors

Bảng màu "Năng Lượng Sạch" xoay quanh cặp teal + lime, đặt trên nền neutral hơi ngả xanh.

- **Teal `#0E9F8E`** (primary) — màu thương hiệu và là "mực" chủ đạo: viền, icon active, nút primary, nhãn micro. `teal-700 #0B8578` cho chữ/viền cần đậm hơn (text on light, ring). `teal-050 #E6F6F4` cho nền nhấn nhẹ (KPI accent, hover pill).
- **Lime `#A3E635`** (accent) — năng lượng, dùng RẤT tiết chế: nút accent, thanh chart phụ, cờ loại khách hàng (`ktype`). `lime-600 #7DB800` cho chữ lime trên nền sáng; `lime-050 #F1FBDD` cho nền. Lime không dùng cho trạng thái hệ thống hay viền mặc định.
- **Neutral mực**: `ink #0C1F1C` (chữ chính, viền frame nhấn), `ink-2 #334E49` (chữ phụ), `muted #4E6B66` (nhãn, caption), `line #DBEBE7` (viền mặc định — mảnh, cấp thấp nhất).
- **Bề mặt**: `bg #F4FAF8` (nền trang, hơi teal), `surface #FFFFFF` (thẻ/card), `surface-2 #ECF6F3` (header bảng, sidebar, thumbnail).
- **Semantic**: `ok #159A6B`, `warn #D98A0B`, `danger #E14B4B`, `info #0E8FA8` — chỉ dùng cho phản hồi trạng thái (banner, KPI delta, nút danger), không trang trí.

### Status chip — 10 trạng thái đơn hàng

Vòng đời đơn hàng có 10 trạng thái, mỗi trạng thái một bộ 3 hex (nền/chữ/viền) hài hòa, dịu, đủ tương phản để đọc. Đây là mã màu canonical, không được đổi:

| Trạng thái | class | bg | fg | border |
|---|---|---|---|---|
| Báo giá | `.chip--baogia` | `#EAF3F1` | `#3A5450` | `#CFE5E0` |
| Chờ duyệt | `.chip--choduyet` | `#FBF0DA` | `#8A5C08` | `#EFD9A8` |
| Đã chốt | `.chip--dachot` | `#DCF3EF` | `#0B7264` | `#B7E5DD` |
| Đã cọc | `.chip--dacoc` | `#E7F5D9` | `#4B7A15` | `#CDE9AC` |
| Đang thi công | `.chip--thicong` | `#FCEAD4` | `#985B08` | `#F2D3A6` |
| Nghiệm thu | `.chip--nghiemthu` | `#E4EEFA` | `#345C9C` | `#C4D8F0` |
| Đang giao | `.chip--danggiao` | `#DEF1F6` | `#0C6B84` | `#B7E0EB` |
| Đã giao | `.chip--dagiao` | `#DDF3EA` | `#0F7657` | `#B7E5D4` |
| Hoàn thành | `.chip--hoanthanh` | `#DEF3E6` | `#137A4C` | `#B7E5CA` |
| Huỷ | `.chip--huy` | `#FAE6E6` | `#B22C2C` | `#F0C7C7` |

Logic màu: nhóm báo giá/chốt/giao/hoàn thành ngả xanh-teal (tiến triển tốt); chờ duyệt/thi công ngả cam (đang chờ/đang làm); nghiệm thu ngả xanh dương (kiểm tra); huỷ đỏ.

## Typography

Font hệ thống native stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`) — nhẹ, quen thuộc trên cả hai nền tảng, không cần tải font.

Thang vai trò:

- **Display** — số liệu lớn (KPI value): 23px / 900 / letter-spacing `-.02em`. Dùng `.mono` (`tabular-nums`) cho số để cột thẳng hàng.
- **Title** — tiêu đề màn/topbar: 15px / 800 / `-.01em`.
- **Body** — nội dung: 13.5px / 400 / line-height 1.42.
- **Meta** — caption, giá trị phụ, ô bảng: 11–12.5px / 600–700.
- **Micro (uppercase)** — đặc trưng blueprint: 10px / 800 / letter-spacing `.1em` / `text-transform: uppercase`, màu teal (hoặc muted). Dùng cho nhãn field (`.flabel`), eyebrow topbar, header bảng, nhãn KPI, tiêu đề section trên frame. Đây là chữ ký thị giác của hệ thống — nhãn nhỏ in hoa mực teal.

Số tiền, số lượng, mã đơn luôn dùng `.mono` để canh phải và đọc nhanh.

## Layout & Spacing

Thang spacing dày, phù hợp app dữ liệu dày: 4 / 6 / 8 / 12 / 16 / 22 / 26px. Gutter mặc định 12px; padding trong vùng cuộn mobile (`.pscroll`) 12–13px; lề ngang trang web 22px.

- **Web**: layout 2 cột — sidebar trái cố định 186px + vùng `.main` co giãn. Trang tổng `max-width: 1400px`, canh giữa. Bảng dày, KPI grid 4 cột (co xuống 2 cột dưới 900px).
- **Mobile**: một cột trong phone frame rộng 330px, vùng kính cao 700px. Topbar cố định trên, botnav cố định dưới, thân cuộn ở giữa.
- **Breakpoint** `max-width: 900px`: KPI 4→2 cột; web-app đổi sang xếp dọc; sidebar chuyển thành hàng ngang wrap.

Grid dùng flex/grid, không dùng vị trí tuyệt đối cho layout (chỉ dùng cho notch, nhãn frame, icon search).

## Elevation & Depth

**Không có hệ thống độ cao/shadow.** Đây là quy tắc cứng của phong cách "Viền nét". Phân tầng đến từ:

1. **Viền** — `line` (1.5px, cấp thấp) → `teal`/`ink` (1.5px, cấp cao/nhấn).
2. **Tông nền** — `bg` → `surface` → `surface-2` phân biệt vùng bằng sắc độ nhẹ, không bằng bóng.

Ngoại lệ hữu hạn, không phải shadow trang trí: ring focus của stepper current (`box-shadow: 0 0 0 3px teal-050` — dùng như viền kép), vành teal-700 quanh FAB (`0 0 0 1.5px`), và blur nền của indexbar sticky. Modal/sheet nổi bằng **viền ink 1.5px**, không bằng drop-shadow.

## Shapes

Thang bo góc nhỏ, chừng mực — "giấy bo góc mềm", không phải pill iOS:

- **sm 8px** — nút nhỏ, ô search icon, navlink sidebar, notecard, nút back topbar/logo.
- **DEFAULT 10px** — nút, field, banner, list-row, thumbnail.
- **lg 12px** — card, frame, KPI, modal, web frame.
- **full 9999px** — chỉ dành cho vật thể tròn/viên thuốc: chip trạng thái, pill, url bar, ktype, avatar dot. Sheet đáy bo `18px` ở hai góc trên.

Ảnh/thumbnail bám đúng góc container.

## Components

Tất cả component viền 1.5px, phẳng, không bóng.

- **Button** (`.btn`) — mặc định outline: viền teal 1.5px, nền trắng, chữ `teal-700` 800. Biến thể: `--primary` (nền teal, chữ trắng), `--accent` (nền lime-050, viền lime), `--ghost` (viền line), `--danger` (viền/chữ đỏ). Size `--sm` (padding 5px 10px, bo sm), `--wide` (full width).
- **Card / Frame** — `.card`: nền trắng, viền line, bo lg. `.frame`: viền ink 1.5px + **nhãn frame** nổi trên đường viền (`.frame-label`, micro uppercase) — mô-típ bản vẽ kỹ thuật đặc trưng.
- **Chip / Status-chip** — pill bo full, viền 1.5px, chữ 11px/700, có `.dot` 6px cùng màu chữ. 10 biến thể trạng thái xem bảng màu ở trên. Kèm `.ktype` (loại khách, viền lime), `.scope-flag` (bật/tắt quyền, on = teal, off = gạch ngang mờ).
- **Field** (`.field`) — viền line 1.5px, bo DEFAULT, focus đổi viền sang teal (không glow). Nhãn `.flabel` micro uppercase muted phía trên. `.field-lg` cho form đăng nhập.
- **Table** (`.table`) — dày, header nền `surface-2` + micro uppercase, ô viền dưới line 1px, hàng zebra `#F7FBFA`, cột số canh phải (`.num`), giá trị mạnh in đậm ink.
- **Stepper** — chuỗi node tròn 26px nối bằng thanh 1.5px. `done` = teal đặc chữ trắng; `current` = viền teal + ring teal-050; `gate` = viền đứt nét mờ. Nhãn bước micro dưới node.
- **KPI** (`.kpi`) — thẻ viền line bo lg, nhãn micro uppercase + giá trị display 23px/900 + delta màu `ok`. Biến thể `.accent` viền teal, nền teal-050.
- **Banner** — dải viền 1.5px + nền dịu theo semantic: mặc định warn (cam), `--info` (teal-xanh), `--danger` (đỏ). Icon SVG bên trái.
- **Topbar** (mobile) — canonical: nút back (viền, bo sm) + tiêu đề 15px/800 (có eyebrow micro tùy chọn) + action phải teal-700. Viền dưới ink 1.5px.
- **Bottom-nav** (`.botnav`, khoá cứng 5 tab) — Trang chủ · Đơn hàng · **➕ Tạo báo giá (FAB)** · Kho · Menu. FAB là nút tròn 46px **nền teal**, vành trắng 3px, ring teal-700 1.5px, nhô lên `-22px` tách khỏi thanh; dấu cộng mảnh (SVG `ic-plus`). Tab active đổi màu chữ + icon sang teal.
- **Phone frame** — thân máy `#0C1512` bo 40px, kính bo 32px cao 700px, notch, status bar giả. Dùng để trình bày bản mobile của mỗi màn.
- **Web frame + Sidebar** — khung browser giả (chrome + 3 chấm + url pill) bao `.web-app`. Sidebar trái 186px nền `surface-2`: brand + navlink (active = viền teal + nền trắng) + nhóm `.navsec` micro uppercase. Toolbar có search (icon SVG), segmented control (`.seg`, active nền teal), tabs (gạch chân teal).

## Icon System

Bộ icon **inline SVG sprite** kiểu Lucide (thin-line), self-contained, 0 external ref — hoạt động giống hệt trên Web và Flutter.

- Định nghĩa một lần dạng `<symbol id="ic-*">` trong sprite; dùng qua `<svg class="icn"><use href="#ic-*"/></svg>`.
- Style chuẩn: `stroke: currentColor`, `stroke-width: 2`, `fill: none` — icon tự thừa kế màu chữ ngữ cảnh (teal khi active, muted khi thường).
- Kích thước mặc định 18px (`.icn`), có biến thể theo ngữ cảnh: 22px (botnav/FAB), 16px (search/sidebar), 15px (button), 14px (icon nhỏ trong bảng/stepper), 13px (`.icn-xs`).
- Sprite hiện có 45 symbol, ~647 lượt dùng. Tên theo nghĩa: `ic-home ic-orders ic-invoice ic-inventory ic-warehouse ic-menu ic-customer ic-users ic-user ic-product ic-catalog ic-payment ic-contract ic-audit ic-permissions ic-status ic-plus ic-minus ic-check ic-close ic-edit ic-trash ic-copy ic-send ic-share ic-download ic-external ic-refresh ic-search ic-filter ic-sort ic-more ic-bell ic-mail ic-phone ic-camera ic-image ic-file ic-clock ic-info ic-alert ic-warning(ic-ban) ic-chevron-left/right/down ic-sun`.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Phân cấp bằng viền 1.5px và tông nền | Dùng drop-shadow / gradient để tạo độ sâu |
| Teal làm mực chủ đạo (viền, icon, primary) | Dùng lime tràn lan — chỉ điểm nhấn |
| Nhãn micro chữ hoa mực teal cho label/eyebrow/header | Nhãn thường lệ thường cho vai trò micro |
| Dùng đúng 10 hex chip trạng thái canonical | Tự chế màu trạng thái mới hoặc đổi hex |
| Icon SVG `<use href="#ic-*">`, stroke currentColor | Nhét emoji/glyph unicode hoặc icon raster |
| Số tiền/số lượng dùng `.mono` canh phải | Số canh trái, font tỷ lệ lệch cột |
| FAB teal on-brand, tách khỏi thanh nav | FAB cục lime hay dấu cộng đậm |
| Modal/sheet nổi bằng viền ink 1.5px | Modal đổ bóng kiểu Material |
| Bo góc theo thang sm/DEFAULT/lg, pill chỉ cho chip | Bo tròn card như pill, hoặc góc vuông sắc |
| Giữ Web và Mobile cùng token, cùng component | Chế token riêng cho từng nền tảng |
