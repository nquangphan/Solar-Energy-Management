# Tóm tắt Tự động hoá Test — Story 1.9 (App shell web — Sidebar + Web frame)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-08 · **Tính năng:** app-shell web (`web/src/design-system/shell/` — 8 component React + `shell.css`).

**Framework:** `node --test` (text-based drift/behaviour guard). Web CHƯA có tsc/React runtime (`web/` chỉ `src/`, đúng contract Story 1.3–1.6) → test đọc `.css`/`.tsx` dạng chuỗi, khẳng định bất biến theo cấu trúc. **KHÔNG** thêm runner mới (tôn trọng quyết định story + YAGNI).

## Cách tiếp cận

Story 1.9 đã ở trạng thái `review` với 114 test (drift-guard CSS + source-guard TSX + parity cross-platform). Workflow QA rà coverage theo AC-1..AC-5, phát hiện các **hành vi shell đã hỗ trợ nhưng chưa được canh**, rồi auto-apply — thêm 1 file hành vi (theo tiền lệ `behavior-components.test.mjs`) + mở rộng file drift-guard CSS (surgical: không đụng shell source).

## Test đã thêm (11)

### E2E / Hành vi component — `design-system/components/shell-behavior.test.mjs` (MỚI, +10)

| # | Test | AC / Invariant |
|---|------|-----|
| 1 | `SIDEBAR_NAV` giữ đúng **8 link chuẩn tắc** theo thứ tự (key→icon→label) + section "Quản trị" | AC-1, Task 2 (Story 1.10 gate bộ này) |
| 2 | Sidebar brand mặc định `ic-sun` + "Phương Nam" | AC-1 |
| 3 | Sidebar tô active **chỉ** link có `key === activeKey`; icon navlink 16, logo 18 | AC-1 |
| 4 | Seg đánh dấu active **chỉ** option `activeKey` | AC-3 |
| 5 | Tabs đánh dấu active **chỉ** tab `activeKey` | AC-3 |
| 6 | Topbar render back/eyebrow/action **có điều kiện** + chevron `ic-chevron-left` size 18 | AC-5 |
| 7 | WebFrame hiển thị url là **text thuần** `.web-url` (KHÔNG anchor) | AC-2 |
| 8 | SearchField ghép `.search` > `.si` (`ic-search`) + tái dùng `.field` + `...rest` | AC-3b |
| 9 | WebShell lắp `WebFrame > [sidebar?] + .main[topbar? + children]` | AC-5a |
| 10 | Toolbar wrapper `.toolbar` merge `className` tuỳ chọn | AC-3a |

### Drift-guard CSS — `design-system/components/shell-web.test.mjs` (MỞ RỘNG, +1)

Test "canonical literals & shell icon sizes": kích thước icon shell (back 18 / action 15 / search 16 / logo 18), navlink icon `16px #8fa39e` + active tint teal, `.web flex:1 1 760px`, `.web-app min-height:520px`, `.search .field padding-left:32px`, literal `#9fb2ad`/`#a9bab5`, `.seg a:last-child` reset viền, `.main padding:18px 20px`, brand logo `26×26` viền teal bo 7px.

## Khoảng trống đã phát hiện & vá (auto-apply)

- **Bộ nav chuẩn tắc chưa canh:** `SIDEBAR_NAV` là contract Story 1.10 lọc theo quyền — nay pin 8 link + thứ tự + section.
- **Logic chọn active chưa test:** "link/seg/tab nào sáng lên" là hành vi UX cốt lõi, trước chỉ test callback được phát; nay khẳng định class `active` chỉ gắn đúng `activeKey`.
- **Composition/DOM wiring chưa test:** SearchField (tái dùng `.field` + icon), WebShell (`.main` bọc topbar+children, sidebar slot), WebFrame (url text thuần).
- **Literal chuẩn tắc CSS chưa pin:** icon sizes, padding-left search, các hex `#8fa39e/#a9bab5/#9fb2ad`, sizing frame — "selectors exist" không phủ giá trị verbatim.

## Kết quả chạy

| Suite | Lệnh | Trước | Sau |
|---|---|---|---|
| Design-system (Node) | `node --test "**/*.test.mjs"` | 114/114 | **125/125** ✅ (0 hồi quy) |

## Coverage

- **8/8 component** shell có test hành vi/composition (Topbar, Sidebar, WebFrame, Toolbar, Seg, Tabs, SearchField, WebShell).
- **AC-1..AC-5** đều có khẳng định hành vi hoặc drift.
- **API test:** N/A — shell thuần trình bày (AD-1/2: không mạng/router/nghiệp vụ), không endpoint để phủ.

## Bước tiếp theo

- Chạy `node --test "**/*.test.mjs"` trong CI (repo greenfield, chưa có pipeline).
- Khi web có tsc/React runtime (story web-app sau), phủ thêm render test thật lên trên các structural guard này.

## Câu hỏi tồn đọng

- Không. Story 1.9 vốn ở `review`; workflow này chỉ mở rộng coverage, không đổi contract component.
