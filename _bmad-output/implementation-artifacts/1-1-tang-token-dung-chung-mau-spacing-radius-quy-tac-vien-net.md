---
baseline_commit: NO_VCS
---

# Story 1.1: Tầng token dùng chung (màu, spacing, radius, quy tắc "Viền nét")

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên nền tảng**,
I want **một tầng design token chính tắc dùng chung cho cả web (React) và mobile (Flutter)**,
so that **mọi component sau này tham chiếu cùng một nguồn màu/spacing/typography, không hardcode giá trị**.

## Acceptance Criteria

1. **Given** bảng màu "Năng Lượng Sạch" trong DESIGN.md, **When** khai báo token màu, **Then** đủ **14 nhóm màu canonical** đúng hex (teal `#0E9F8E`, teal-700 `#0B8578`, teal-050 `#E6F6F4`, lime `#A3E635`, lime-600 `#7DB800`, lime-050 `#F1FBDD`, ink `#0C1F1C`, ink-2 `#334E49`, muted `#4E6B66`, line `#DBEBE7`, bg `#F4FAF8`, surface `#FFFFFF`, surface-2 `#ECF6F3`, semantic ok/warn/danger/info) **And** **cùng giá trị hex xuất hiện trên cả hai nền tảng, không lệch** (UX-DR-1).
2. **Given** yêu cầu spacing/radius, **When** khai báo token, **Then** spacing scale `4/6/8/12/16/22/26px` + gutter `12px` + page-x `22px` + pscroll `12px`, radius `sm 8px` / `DEFAULT 10px` / `lg 12px` / `full 9999px` **And** `full` (pill) chỉ được dùng cho chip/pill (UX-DR-2).
3. **Given** thang typography, **When** khai báo token role, **Then** có Display `23px/900/-.02em`, Title `15px/800/-.01em`, Body `13.5px/400/1.42`, Meta `11–12.5px/600–700`, Micro `10px/800/.1em uppercase teal`, và style `.mono` `tabular-nums` canh phải cho tiền/số lượng/mã đơn (UX-DR-3).
4. **Given** quy tắc elevation "Viền nét", **When** định nghĩa nền tảng thị giác, **Then** **KHÔNG có token shadow/gradient trang trí**; phân cấp chỉ bằng viền `1.5px` (line → teal/ink) và bậc nền `bg → surface → surface-2` (UX-DR-4).

## Tasks / Subtasks

- [x] **Task 1 — Thiết lập nguồn token chính tắc dùng chung (AC: 1, 2, 3, 4)**
  - [x] Tạo file nguồn chính tắc `design-tokens.json` là **single source of truth** cho toàn bộ giá trị token (màu, spacing, radius, typography). Đây là hợp đồng thị giác chung; web và mobile **derive** từ đây, không tự chế giá trị (AD-13, NFR-9).
  - [x] Rút mọi giá trị **verbatim** từ khối `:root` của mockup nguồn thị giác `mockups/all-screens.html` và bảng token trong `DESIGN.md`. Khi lệch → **mockup thắng** (DESIGN.md §Nguồn thị giác).
- [x] **Task 2 — Token màu 14 nhóm (AC: 1)**
  - [x] Khai báo đủ 14 nhóm màu đúng hex (xem bảng "Token màu canonical" trong Dev Notes).
  - [x] Nhóm semantic gồm 4 giá trị: ok `#159A6B`, warn `#D98A0B`, danger `#E14B4B`, info `#0E8FA8` — chỉ dùng cho phản hồi trạng thái, không trang trí.
  - [x] **Cấu trúc token phải chừa chỗ mở rộng cho 9 bộ hex status-chip** sẽ thêm ở Story 1.4 (không implement chip ở story này — xem "Ranh giới phạm vi").
- [x] **Task 3 — Token spacing + radius (AC: 2)**
  - [x] Spacing scale `4/6/8/12/16/22/26` (px) + alias `gutter=12`, `page-x=22`, `pscroll=12`.
  - [x] Radius `sm=8`, `DEFAULT=10`, `lg=12`, `full=9999`.
  - [x] Ghi rõ (comment/doc token) `full` **chỉ** dùng cho chip/pill — không bo card/field bằng `full`.
- [x] **Task 4 — Token typography (AC: 3)**
  - [x] Khai báo 5 role: Display, Title, Body, Meta, Micro với size/weight/letter-spacing/line-height đúng bảng.
  - [x] Font-family = **native system stack** (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`) — **không tải font ngoài**.
  - [x] Định nghĩa style/token `.mono`: `font-variant-numeric: tabular-nums`, canh phải — dùng cho tiền/số lượng/mã đơn.
- [x] **Task 5 — Quy tắc "Viền nét" (AC: 4)**
  - [x] **KHÔNG** khai báo bất kỳ token `shadow`/`box-shadow`/`gradient` trang trí nào.
  - [x] Khai báo token viền chuẩn: độ dày `1.5px`; cấp viền `line` (thấp) → `teal`/`ink` (cao/nhấn). Bậc nền `bg → surface → surface-2` là công cụ phân tầng duy nhất cùng viền.
- [x] **Task 6 — Phát token ra hai nền tảng (AC: 1, 2, 3, 4)**
  - [x] **Web (React/TS):** phát token thành `tokens.ts` (hằng typed) + biến CSS `:root` — tên biến kebab-case (`--teal-700`, `--space-12`, `--radius-lg`).
  - [x] **Mobile (Flutter/Dart):** phát token thành lớp `AppTokens`/`ThemeExtension` (Dart) — hằng snake_case/camelCase theo chuẩn Dart, cùng giá trị.
  - [x] Nếu dùng generator (khuyến nghị Style Dictionary — xem Dev Notes), commit cả file cấu hình generator + output; nếu mirror tay, phải có test parity ở Task 7.
- [x] **Task 7 — Test parity chống lệch giá trị (AC: 1, 2, 3, 4)**
  - [x] Viết test khẳng định **mọi hex/số ở output web == output mobile == `design-tokens.json`** (không lệch một ký tự). Đây là AC lõi ("cùng giá trị hex trên cả hai nền tảng").
  - [x] Test khẳng định **không có token shadow/gradient** nào tồn tại trong token set (AC-4).

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này **CHỈ** giao tầng **token** (màu/spacing/radius/typography + quy tắc Viền nét dưới dạng token viền/nền). **KHÔNG** dựng component, **KHÔNG** dựng icon.
- **Ngoài phạm vi (thuộc story khác, đừng làm ở đây):** bộ icon SVG sprite → **Story 1.2**; Button/Card/Frame/Field → **Story 1.3**; **9 bộ hex status-chip + `.ktype`/`.scope-flag`** → **Story 1.4** (UX-DR-8); Table/Stepper/KPI/Banner → **Story 1.5**; hằng riêng của component (zebra row `#F7FBFA` của Table, thân phone frame `#0C1512`, ring focus stepper, vành FAB) → định nghĩa trong story component tương ứng, **không** phải token nền của 1.1.
- **Nhưng:** cấu trúc token của 1.1 phải **thiết kế để mở rộng** — Story 1.4 sẽ thêm 9 bộ hex chip vào **chính token layer này** (không tạo layer màu thứ hai). Bảng 9 chip đính kèm bên dưới chỉ để bạn thiết kế chỗ chứa, **không implement ở 1.1**.

### Kiến trúc & nguyên tắc bắt buộc

- **AD-13 (Design-system-first):** tầng design system từ `DESIGN.md` là deliverable ĐẦU TIÊN cho cả hai nền tảng; token là móng của nó. Mọi màn/component sau **cấm style ad-hoc**, phải tham chiếu token. [Source: ARCHITECTURE-SPINE.md#AD-13]
- **NFR-9 / UX-DR-27:** Web (React) và Mobile (Flutter) **dùng chung một design system — cùng token**; cùng một màn phải nhận ra được trên cả hai nền tảng. Đây là lý do tồn tại của story: **một nguồn, không lệch**. [Source: epics.md#NFR-9, DESIGN.md#Brand & Style]
- **Thuần front-end:** story không chạm backend/DB. AD-1/AD-2 (backend sở hữu DB + business logic) **không** áp cho token, nhưng vẫn giữ nguyên tắc chung: không nhét business logic vào tầng token. [Source: project-context.md]
- **Nguồn thị giác duy nhất:** `mockups/all-screens.html` khối `:root`. DESIGN.md ghi rõ "khi có xung đột, mockup thắng" → **đối chiếu hex với mockup, không tự nhớ**. [Source: DESIGN.md dòng 148]

### Quyết định thiết kế được khuyến nghị (single-source token)

Bối cảnh: web + mobile là **hai repo/client tách biệt** (project-context.md), solo dev, ưu tiên đơn giản (NFR-10). AC lõi đòi "cùng hex, không lệch" — nếu mirror tay hai nơi sẽ dễ drift.

- **Khuyến nghị (KISS + chống drift):** một file `design-tokens.json` làm **single source of truth**; dùng **Style Dictionary** sinh ra `tokens.ts` + CSS vars (web) và `AppTokens` Dart (mobile). Kèm test parity như một chốt an toàn.
- **Phương án thay thế:** mirror tay hai file token + **bắt buộc** test parity so với `design-tokens.json`. Ít tooling hơn nhưng phụ thuộc kỷ luật test.
- Dù chọn cách nào, **`design-tokens.json` là nguồn chân lý** và **test parity là bắt buộc** (Task 7). Xem "Câu hỏi mở" ở cuối nếu muốn chốt lại cách phát token trước khi code.

### Token màu canonical (14 nhóm) — verbatim [Source: DESIGN.md#Colors, UX-DR-1]

| Nhóm | Token | Hex |
|---|---|---|
| Teal (primary/"mực") | `teal` | `#0E9F8E` |
| | `teal-700` | `#0B8578` |
| | `teal-050` | `#E6F6F4` |
| Lime (accent, tiết chế) | `lime` | `#A3E635` |
| | `lime-600` | `#7DB800` |
| | `lime-050` | `#F1FBDD` |
| Neutral mực | `ink` | `#0C1F1C` |
| | `ink-2` | `#334E49` |
| | `muted` | `#4E6B66` |
| | `line` (viền mặc định) | `#DBEBE7` |
| Bề mặt | `bg` | `#F4FAF8` |
| | `surface` | `#FFFFFF` |
| | `surface-2` | `#ECF6F3` |
| Semantic (chỉ phản hồi) | `ok` / `warn` / `danger` / `info` | `#159A6B` / `#D98A0B` / `#E14B4B` / `#0E8FA8` |

### Spacing & Radius — verbatim [Source: DESIGN.md#Layout & Spacing, #Shapes, UX-DR-2]

- **Spacing scale (px):** `4, 6, 8, 12, 16, 22, 26`. Alias: `gutter=12`, `page-x=22` (lề ngang trang web), `pscroll=12` (padding vùng cuộn mobile).
- **Radius (px):** `sm=8`, `DEFAULT=10`, `lg=12`, `full=9999`. `full` (pill) **chỉ** cho chip/pill/url-bar/avatar-dot — **không** bo card/field. (Góc trên sheet đáy `18px` là hằng riêng của sheet → Story 1.6, không phải token 1.1.)

### Typography — verbatim [Source: DESIGN.md#Typography, UX-DR-3]

| Role | Size | Weight | Letter-spacing | Line-height | Ghi chú |
|---|---|---|---|---|---|
| Display | 23px | 900 | `-.02em` | — | KPI value; dùng `.mono` cho số |
| Title | 15px | 800 | `-.01em` | — | tiêu đề màn/topbar |
| Body | 13.5px | 400 | — | 1.42 | nội dung |
| Meta | 11–12.5px | 600–700 | — | — | caption, ô bảng |
| Micro | 10px | 800 | `.1em` | — | `uppercase`, màu teal; chữ ký blueprint (`.flabel`, eyebrow, header bảng) |

- **Font:** native system stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. **Không** tải webfont.
- **`.mono`:** `tabular-nums`, canh phải — bắt buộc cho tiền/số lượng/mã đơn (khớp quy ước "tiền = integer đồng", client chỉ hiển thị).

### Quy tắc "Viền nét" (elevation) [Source: DESIGN.md#Elevation & Depth, UX-DR-4]

- **Phẳng tuyệt đối, KHÔNG shadow/gradient trang trí.** Không tạo token `shadow-*`/`gradient-*`.
- Phân tầng bằng: (1) **viền `1.5px`** cấp `line` → `teal`/`ink`; (2) **bậc nền** `bg → surface → surface-2`.
- Các ngoại lệ hữu hạn (ring focus stepper `0 0 0 3px teal-050`, vành FAB `0 0 0 1.5px teal-700`, modal/sheet nổi bằng viền ink 1.5px) **không** phải shadow trang trí và **thuộc story component tương ứng** — đừng đưa vào token 1.1.

### 9 bộ hex status-chip — CHỈ tham chiếu, thêm ở Story 1.4 (UX-DR-8) [Source: DESIGN.md#Status chip]

_(Liệt kê để bạn thiết kế chỗ chứa trong token layer; **không implement ở story này**.)_

| Trạng thái | bg | fg | border |
|---|---|---|---|
| Báo giá | `#EAF3F1` | `#3A5450` | `#CFE5E0` |
| Chờ duyệt | `#FBF0DA` | `#8A5C08` | `#EFD9A8` |
| Đã chốt | `#DCF3EF` | `#0B7264` | `#B7E5DD` |
| Đã cọc | `#E7F5D9` | `#4B7A15` | `#CDE9AC` |
| Đang thi công | `#FCEAD4` | `#985B08` | `#F2D3A6` |
| Nghiệm thu | `#E4EEFA` | `#345C9C` | `#C4D8F0` |
| Đang giao | `#DEF1F6` | `#0C6B84` | `#B7E0EB` |
| Hoàn thành | `#DEF3E6` | `#137A4C` | `#B7E5CA` |
| Huỷ | `#FAE6E6` | `#B22C2C` | `#F0C7C7` |

### Testing standards [Source: project-context.md#Testing]

- Bắt buộc **test parity** (Task 7): khẳng định output web ≡ output mobile ≡ `design-tokens.json` cho từng token; và khẳng định **không tồn tại token shadow/gradient**.
- Web: test bằng runner của repo web (vd Vitest/Jest) trên `tokens.ts`. Mobile: test Dart (`flutter test`) trên `AppTokens`.
- Test phải **fail nếu ai đó sửa hex một nền tảng mà quên nền kia** — đó chính là giá trị chống-drift của story.

### Project Structure Notes

- **Greenfield:** chưa có source web/mobile trong repo, chưa có commit. Backend tree đã định ở spine (`backend/src/...`) nhưng **cây web/mobile chưa được spine quy định**. Story này thiết lập vị trí tầng token; các story sau (1.3 React, 1.7 Flutter) mở rộng cùng cây.
- **Đường dẫn đề xuất** (theo quy ước: web repo tách, mobile repo tách; file kebab-case cho JS/TS, snake_case cho Dart):
  - Nguồn chung: `design-system/tokens/design-tokens.json` (+ cấu hình generator nếu dùng).
  - Web: `web/src/design-system/tokens/tokens.ts` + `web/src/design-system/tokens/tokens.css` (biến `:root`).
  - Mobile: `mobile/lib/design_system/tokens/app_tokens.dart`.
- Nếu repo web/mobile được scaffold riêng (không monorepo), đặt `design-tokens.json` ở nơi cả hai truy cập được (vd repo/thư mục design-system dùng chung, hoặc copy có kiểm soát + test parity). **Chốt vị trí vật lý = một phần "Câu hỏi mở".**
- **Surgical:** chỉ tạo file/scaffold tối thiểu để token compile + test được trên mỗi nền tảng; **không** dựng sẵn cấu trúc component (để story sau). [Source: project-context.md#Scout-before-code]

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Colors] — 14 nhóm màu + hex.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Typography] — thang typography + `.mono`.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Layout & Spacing] và `#Shapes` — spacing + radius.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Elevation & Depth] — quy tắc Viền nét.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html] — khối `:root`, **nguồn thị giác thắng khi xung đột**.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-13] — design-system-first.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — user story + 4 AC (UX-DR-1..4).
- [Source: _bmad-output/planning-artifacts/epics.md#NFR-9] và UX-DR-27 — một design system, hai nền tảng, cùng token.
- [Source: _bmad-output/project-context.md] — stack version, Design-system-first, testing, scout-before-code.

**Stack liên quan:** React (Web) 19.2.7 · Flutter (Mobile) 3.44 · Node.js 24 LTS. Không cần thư viện màu/webfont ngoài (native font stack, hex tĩnh). [Source: ARCHITECTURE-SPINE.md#Stack]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow).

### Debug Log References

- `node --test "tokens/**/*.test.mjs"` (design-system) → 6/6 pass. Parity + no-shadow guards.
- `flutter test` (mobile) → 4/4 pass. Native token guards on `AppTokens`.
- RED→GREEN honored: parity test ran and failed before outputs existed, passed after `node tokens/build-tokens.mjs`.
- Node 24.14.0: `node --test` needs a glob (`tokens/**/*.test.mjs`), not a bare dir — fixed in `package.json`.

### Completion Notes List

Delivered the shared token layer only (no components/icons — those are Stories 1.2–1.5). All values pulled verbatim from the visual source of truth.

**Two open questions resolved (documented decisions):**

1. **Token emission mechanism:** `design-system/tokens/design-tokens.json` is the single source of truth; a **zero-external-dependency Node generator** (`build-tokens.mjs`) derives all platform outputs. Chose a generator (over hand-mirror) to prevent drift, but **without adding Style Dictionary / any external dep** — keeps KISS/YAGNI for a solo dev and avoids a dependency-approval HALT. Generator + outputs are committed, and `parity.test.mjs` fails if any committed output goes stale.
2. **Physical location (web/mobile are separate clients):** placed on the tree the story proposed, inside this repo — source at `design-system/tokens/`, web output at `web/src/design-system/tokens/`, mobile output at `mobile/lib/design_system/tokens/`. Later stories (1.3 React, 1.7 Flutter) extend the same tree.

**Notes / deviations:**
- Font stack conflict: mockup `:root` has `"Helvetica Neue"`, Dev Notes prose said `Helvetica`. Applied **"mockup wins"** → used `"Helvetica Neue"`.
- `meta` role stored as the canonical structured value `12.5px / 600` (within the AC-3 range `11–12.5px / 600–700`).
- `statusChip.sets` left as an **empty reserved extension point** in this same token layer for Story 1.4's 9 status-chip sets (not implemented here).
- **Viền nét (AC-4):** no `shadow`/`gradient` tokens anywhere; hierarchy carried by `border.width = 1.5` and surface steps `bg → surface → surface-2`. A test asserts the banned tokens never appear.
- Minimal Flutter scaffold (`mobile/pubspec.yaml`) added solely so the Dart token test runs — the story explicitly permits minimal per-platform scaffold to compile+test tokens. Web tokens are validated via the Node parity test (which reads `tokens.ts`/`tokens.css` directly); a web build/tsconfig arrives with Story 1.3.

**How to regenerate:** edit `design-tokens.json`, then `cd design-system && npm run build && npm test`.

### File List

- `design-system/tokens/design-tokens.json` (new — single source of truth)
- `design-system/tokens/build-tokens.mjs` (new — zero-dep generator)
- `design-system/tokens/parity.test.mjs` (new — parity + no-shadow tests)
- `design-system/package.json` (new — build/test scripts, no deps)
- `web/src/design-system/tokens/tokens.ts` (new — generated)
- `web/src/design-system/tokens/tokens.css` (new — generated)
- `mobile/lib/design_system/tokens/app_tokens.dart` (new — generated)
- `mobile/pubspec.yaml` (new — minimal token-test scaffold)
- `mobile/pubspec.lock` (new — generated by `flutter pub get`)
- `mobile/test/design_system/tokens/app_tokens_test.dart` (new — Dart token test)
- `_bmad-output/implementation-artifacts/1-1-tang-token-dung-chung-mau-spacing-radius-quy-tac-vien-net.md` (modified — this story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status → review)

### Change Log

| Date | Change |
|---|---|
| 2026-07-07 | Implemented shared design-token layer: SSOT `design-tokens.json` + zero-dep generator emitting web (`tokens.ts`, `tokens.css`) and mobile (`app_tokens.dart`); parity + no-shadow tests on both platforms (Node 6/6, Flutter 4/4). All 4 ACs satisfied. Status → review. |

---

## Câu hỏi mở (giải quyết trước hoặc trong khi dev)

1. **Cơ chế phát token:** dùng generator (khuyến nghị Style Dictionary) từ `design-tokens.json`, hay mirror tay + test parity? (Story đã bắt buộc `design-tokens.json` là nguồn chân lý + test parity dù chọn cách nào.)
2. **Vị trí vật lý của `design-tokens.json`** khi web/mobile là hai repo tách biệt (thư mục design-system dùng chung vs copy có kiểm soát). Chưa có scaffold FE trong repo để suy ra — cần chốt bố cục repo FE.
