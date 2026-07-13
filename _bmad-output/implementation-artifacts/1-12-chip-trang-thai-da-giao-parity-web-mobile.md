---
baseline_commit: 757efce
---

# Story 1.12: Thêm chip trạng thái "Đã giao" vào design system (9 → 10 chip)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên nền tảng**,
I want **thêm chip trạng thái "Đã giao" (`dagiao`) vào StatusChip trên cả web (React) lẫn mobile (Flutter), cùng một bộ 3 hex canonical**,
so that **vòng đời đơn có đủ bước giao hàng (Epic 6) và parity guard web↔Flutter phủ đủ 10 chip**.

## Acceptance Criteria

1. **Given** 9 chip trạng thái đã có, **When** thêm chip mới, **Then** thêm `dagiao: 'Đã giao'` với bộ 3 hex bg/fg/border tuân quy tắc "Viền nét" (phẳng, không đổ bóng/gradient) và bảng màu "Năng Lượng Sạch"; tổng cộng **10 chip** (UX-DR-8, UX-DR-4).
2. **Given** file `web/src/design-system/components/StatusChip.tsx`, **When** sửa, **Then** thêm `dagiao` vào `StatusKey` union + `STATUS_LABELS`, **KHÔNG** sửa 9 chip cũ (additive, không breaking) (UX-DR-8).
3. **Given** thư viện widget Flutter, **When** cập nhật tương đương, **Then** `mobile/lib/design_system/components/status_chip.dart` có thêm `StatusKey.dagiao` + nhãn + bộ màu **byte-identical** với web (UX-DR-8, UX-DR-27).
4. **Given** parity guard `design-system/components/parity.test.mjs`, **When** chạy `cd design-system && npm test`, **Then** guard kiểm **10 chip** khớp toàn bộ trên cả web và mobile, không thiếu hoặc sai màu (UX-DR-27).
5. **Given** chip mới, **When** render, **Then** vẫn **chỉ-đọc** như 9 chip cũ: `<span>` tĩnh, không `onClick`/`<button>`/`role`/`tabindex` (UX-DR-23) **And** luôn mang nhãn chữ, contrast fg-trên-bg đạt AA ≥ 4.5:1 (UX-DR-26).

## Tasks / Subtasks

- [x] **Task 1 — Chốt bộ 3 hex canonical cho `dagiao` (AC: 1, 5)**
  - [x] Dùng bộ 3 **đề xuất** trong Dev Notes §"Bộ 3 hex `dagiao`": **bg `#DDF3EA` · fg `#0F7657` · border `#B7E5D4`**. Bộ này **chưa từng tồn tại** trong repo — nó được **suy ra** theo quy tắc DESIGN.md, không phải tra cứu. Xem phần suy dẫn + kiểm contrast trước khi gõ.
  - [x] **Nếu Đại Ca / UX chốt bộ hex khác:** thay đúng **6 vị trí literal** (liệt kê ở §"Sáu vị trí literal"). Không có chỗ thứ 7. Mọi thứ khác không đổi.
  - [x] Tuyệt đối **KHÔNG tái dùng** bộ màu của `danggiao` (`#DEF1F6/#0C6B84/#B7E0EB`) — bộ đó còn dùng chung với `banner--info`.
- [x] **Task 2 — Web: TSX + CSS (AC: 1, 2, 5)**
  - [x] `web/src/design-system/components/StatusChip.tsx`: thêm `| 'dagiao'` vào `StatusKey` union **ngay sau `'danggiao'`** (dòng 14); thêm `dagiao: 'Đã giao',` vào `STATUS_LABELS` **ngay sau `danggiao`** (dòng 28). **KHÔNG** đụng props, thân render, hay 9 key cũ — `chip--${status}` tự sinh class, không cần sửa render.
  - [x] `web/src/design-system/components/components.css`: chèn rule mới **ngay sau `.chip--danggiao`** (dòng 57):
    `.chip--dagiao    {background:#DDF3EA;color:#0F7657;border-color:#B7E5D4}`
    **Format bắt buộc chính xác** `{background:…;color:…;border-color:…}` — dấu `;` ngăn cách, `}` đóng ngay, **không** thêm declaration nào khác (test (10) regex bind theo selector, thừa declaration = fail).
  - [x] **KHÔNG** thêm `border-radius` vào rule mới (`.chip` base đã có `var(--radius-full)`). Test (13) chặn literal `999px`/`9999px` sót trong file.
  - [x] Cập nhật comment "9" → "10" ở `StatusChip.tsx` dòng 3, `components.css` block header (dòng 41–47), `index.ts` dòng 24. Barrel **không cần** đổi export (`StatusKey`/`STATUS_LABELS` đã export sẵn).
- [x] **Task 3 — Mobile: Flutter parity (AC: 3, 5)**
  - [x] `mobile/lib/design_system/components/status_chip.dart` — **ba** sửa đổi, đều chèn **ngay sau `danggiao`**:
    - `enum StatusKey`: thêm `dagiao,` (sau dòng 24)
    - `kStatusLabels`: thêm `StatusKey.dagiao: 'Đã giao',` (sau dòng 37)
    - `kStatusColors`: thêm entry, wrap 2 dòng đúng style `dart format` 80-col:
      ```dart
      StatusKey.dagiao:
          StatusChipColors(Color(0xFFDDF3EA), Color(0xFF0F7657), Color(0xFFB7E5D4)),
      ```
  - [x] Thứ tự tham số là `StatusChipColors(background, foreground, border)` — xác minh constructor dòng 89–93 trước khi gõ. Hex **chữ HOA** sau `0xFF` (parity guard uppercase).
  - [x] Cập nhật comment header "9 hex triplets"/"9 canonical order states" → 10 (dòng 4, 14).
  - [x] Chèn **giữa enum** an toàn: đã xác minh không nơi nào đọc `StatusKey.index` hay `values[n]` — chỉ có vòng lặp `StatusKey.values` (không phụ thuộc thứ tự). Không có serialization enum.
- [x] **Task 4 — Mở rộng ba test list 9 → 10 (AC: 1, 2, 4)**
  - [x] `design-system/components/chip-components.test.mjs` — **BẮT BUỘC, đây là test duy nhất HARD-FAIL**: thêm `['dagiao', 'Đã giao'],` vào mảng `STATUS_LABELS` (dòng 45–55, sau `danggiao`). Test (3) `assert.deepEqual` union ↔ mảng này; sửa union mà quên mảng ⇒ đỏ ngay. Sửa tiêu đề test (3)/(4): "9" → "10".
  - [x] `design-system/components/components.test.mjs`:
    - test (9): thêm `'.chip--dagiao'` vào mảng `required` (dòng 143–149).
    - test (10): thêm `['dagiao', '#DDF3EA', '#0F7657', '#B7E5D4'],` vào mảng `triplets` (dòng 158–168) + đổi tiêu đề "9 status chips" → "10 status chips".
  - [x] `design-system/components/parity.test.mjs`: thêm `dagiao: ['#DDF3EA', '#0F7657', '#B7E5D4'],` vào `STATUS_TRIPLETS` (dòng 28–38) + đổi tiêu đề "9 status triplets" → "10". Entry này ép hex phải có mặt ở **cả** `components.css` **và** `status_chip.dart` — đây là ràng buộc parity thật.
  - [x] `mobile/test/design_system/components/components_render_test.dart` dòng 96: đổi chuỗi tiêu đề `'renders all 9 states…'` → `10`. Vòng lặp `StatusKey.values` (dòng 98) **tự phủ** chip mới, không cần sửa logic.
- [x] **Task 5 — Đồng bộ nguồn thị giác SSOT (AC: 1)**
  - [x] `…/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md`: đổi heading "Status chip — **9** trạng thái đơn hàng" → 10; đổi câu "Vòng đời đơn hàng có 9 trạng thái" → 10; thêm hàng bảng `| Đã giao | .chip--dagiao | #DDF3EA | #0F7657 | #B7E5D4 |` **sau** hàng "Đang giao". Câu "Logic màu" đã bao "giao" trong nhóm xanh-teal — giữ nguyên.
  - [x] `…/mockups/all-screens.html`: legend dòng 21 `STATUS CHIP (9 states)` → 10 + thêm dòng legend `Đã giao  .chip--dagiao  bg#DDF3EA fg#0F7657 bd#B7E5D4` sau "Đang giao" (dòng 27); comment CSS dòng 90 `/* ---------- Status chips (9 order states) ---------- */` → 10 + thêm rule `.chip--dagiao {background:#DDF3EA;color:#0F7657;border-color:#B7E5D4}` sau `.chip--danggiao` (dòng 96). Mockup dùng literal `border-radius:999px` — chip mới **không** khai radius nên không đụng.
  - [x] **An toàn:** không test nào đọc khối chip của mockup. `shell-parity.test.mjs` có đọc mockup nhưng chỉ assert bề mặt shell (topbar/botnav/phone/sidebar) — thêm rule chip không ảnh hưởng. Đã xác minh.
- [x] **Task 6 — Verify (AC: 4, 5)**
  - [x] `cd design-system && npm test` → **189 → 193 test, toàn pass**. (Dự đoán ban đầu của story là "189 → 189, không thêm test mới". Thực tế pha QA đã **thêm 4 test guard mới** — xem Task 7. Số test cuối cùng là **193**, không phải 189.) Test phải **fail** nếu thiếu bất kỳ mảnh nào trong 7 file.
  - [x] `cd mobile && flutter analyze` → sạch; `cd mobile && flutter test` → toàn pass (Flutter 3.35.0 có sẵn: `~/fvm/default/bin/flutter`).
  - [x] Kiểm chéo thủ công: `grep -rn "dagiao" web/ mobile/lib design-system/ _bmad-output/planning-artifacts/ux-designs/` phải ra đúng các vị trí đã sửa — `dagiao` **không** phải substring của `danggiao`, nên grep sạch, không false-positive.
- [x] **Task 7 — Vá lỗ hổng guard (phát sinh sau khi story được viết; +4 test, 189 → 193)**

  Story gốc chỉ yêu cầu **nong** ba mảng list sẵn có. Nhưng chính Dev Notes §"Bản đồ test" đã chỉ ra: 4/5 mảng "xanh giả". Khi soi kỹ thì mảng list chỉ chặn được **thiếu**, không chặn được **sai**. Bốn guard sau được **thêm mới** để chip thứ 10 thực sự được bảo vệ:

  - [x] `a11y-floor.test.mjs` — guard **contrast WCAG AA ≥ 4.5:1** cho cả 10 chip, đọc hex trực tiếp từ `components.css` (không hardcode). Trước đây AC-5 chỉ được kiểm **bằng tay, bằng văn xuôi** — không có gì chặn một lần re-tint làm tụt chip xuống dưới AA. **File này KHÔNG có trong File List gốc — nay đã bổ sung.**
  - [x] `components.test.mjs` (10b) — guard **không hai chip nào trùng bộ 3 màu**. Test (10) ghim từng chip vào màu của nó, nhưng không gì cấm bản thân bộ canonical chứa hai entry giống hệt — đúng kịch bản "copy dòng `danggiao` rồi xoá `ng`".
  - [x] `parity.test.mjs` — guard **swap** phía Dart (mỗi bộ 3 phải nằm trên đúng `StatusKey` của nó; `includes` không thấy được hoán vị) + guard **chỉ-đọc phía mobile** (web đã có, Flutter thì chưa — tap handler có thể lọt vào chip mobile mà mọi suite vẫn xanh) + parse nhãn từ web làm SSOT thay vì hardcode bản sao thứ ba.
  - [x] `components_render_test.dart` — bỏ assertion **tự quy chiếu** `find.text(kStatusLabels[status]!)` (đọc nhãn từ chính map đang kiểm ⇒ luôn pass) → thay bằng map `expectedLabels` viết tay + test render `dagiao` end-to-end (đúng màu, đúng nhãn, **không** đội màu/nhãn của `danggiao`).
  - [x] Kiểm chứng ngược bằng mutation: cả 5 guard đều **cắn** (xem Debug Log).

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này là **backfill additive**: 9 chip → 10 chip, **cả hai nền tảng cùng lúc** (không phải web-only như 1.4, cũng không mobile-only như 1.7). Parity guard đọc **cả** `components.css` lẫn `status_chip.dart` nên **không thể** làm một nửa.
- **Ngoài phạm vi (KHÔNG làm ở đây):**
  - Logic transition `Đang giao → Đã giao`, gate cờ Thiết bị/Vận chuyển, phiếu xuất kho, `costPriceSnapshot` → **Epic 6 (Story 6.1, 6.3, 6.4)**. Chip chỉ **hiển thị**.
  - Ánh xạ `StatusKey` (design-system) ↔ enum `Order.status` backend → vẫn hoãn tới Epic 4/5, như 1.4 đã chốt. **Không đoán enum backend.**
  - Thêm token màu vào `design-tokens.json` → **không**. 10 hex status là **component constant cố ý để literal**, không phải token (xem 1.4 Dev Notes). Thêm vào token layer = scope-creep sang Story 1.1.
  - Notification riêng cho "Đã giao" → câu hỏi mở của decision doc, **không thuộc story này**.

### Bộ 3 hex `dagiao` — SUY DẪN, KHÔNG PHẢI TRA CỨU ⚠️

**Sự thật quan trọng:** bộ 3 hex cho `dagiao` **không tồn tại ở bất kỳ đâu trong repo**. DESIGN.md dừng ở 9 chip ("Đây là mã màu canonical, không được đổi"), mockup dừng ở 9 rule, `design-tokens.json` ghi rõ statusChip là extension point "Story 1.4 fills this with 9 status sets", decision doc (`docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md:61`) chỉ nói "Chín chip → mười chip. Thêm `dagiao: 'Đã giao'`" — **không cho màu**. AC-1 của epic uỷ quyền cho người cài đặt tự suy theo quy tắc thiết kế.

**Quy tắc thiết kế ràng buộc lựa chọn** [Source: DESIGN.md#Colors, DESIGN.md#Status-chip]:
- Logic màu canonical: *"nhóm báo giá/chốt/**giao**/hoàn thành ngả xanh-teal (tiến triển tốt); chờ duyệt/thi công ngả cam; nghiệm thu xanh dương; huỷ đỏ."* ⇒ `dagiao` **phải** nằm dải xanh-teal.
- Lime *"KHÔNG dùng cho trạng thái hệ thống"* ⇒ loại lime.
- Mỗi bộ 3 = nền tint rất nhạt (L≈91%) / chữ đậm bão hoà (L≈25–28%) / viền tint trung gian (L≈83%).

**Suy dẫn (trung điểm từng kênh giữa `dachot` và `hoanthanh` — hai chip xanh-teal bão hoà kẹp hai đầu dải):**

| | dachot | hoanthanh | **trung điểm ⇒ `dagiao`** |
|---|---|---|---|
| bg | `#DCF3EF` (220,243,239) | `#DEF3E6` (222,243,230) | **`#DDF3EA`** (221,243,234) |
| fg | `#0B7264` (11,114,100) | `#137A4C` (19,122,76) | **`#0F7657`** (15,118,87) |
| border | `#B7E5DD` (183,229,221) | `#B7E5CA` (183,229,202) | **`#B7E5D4`** (183,229,212) |

Kết quả giữ nguyên "chữ ký" gia đình (`#B7E5xx` viền, `#D?F3E?` nền) và rơi vào hue ≈ 162° — đúng dải teal-green, trùng hue của semantic `ok #159A6B` (159°) ⇒ đọc được là "đã giao = tiến triển tốt, sát hoàn thành".

**Kiểm accessibility (AC-5, UX-DR-26):** contrast `#0F7657` trên `#DDF3EA` = **4.82:1** ≥ 4.5:1 ⇒ đạt **WCAG AA** cho chữ thường (chip là 11px/700, còn dễ hơn). Ngang ngửa `hoanthanh` (~5:1). Không cần đổi.

**Vì sao KHÔNG lấy trung điểm `danggiao`↔`hoanthanh` (hai hàng xóm vòng đời)?** Trung điểm fg đó = `#0F7368` — **đụng gần như trùng** `dachot #0B7264`. Đã loại.

> ⚠️ **Đây là một quyết định thiết kế, không phải sự thật có sẵn.** DESIGN.md tuyên bố màu status là canonical bất biến — một khi ship, nó bị khoá. Bộ đề xuất trên là suy dẫn có cơ sở và đạt AA, nhưng nó **gần** `dachot` và `hoanthanh` (lệch hue ~10° mỗi bên) vì dải xanh-teal vốn đã đông (baogia/dachot/danggiao/hoanthanh). **Dev agent cứ dùng bộ đề xuất để không bị chặn**, nhưng **phải nêu rõ trong Completion Notes** rằng bộ hex là mới-suy-dẫn và cần Đại Ca/UX ratify. Nếu bị đổi, sửa đúng 6 literal bên dưới.

### Sáu vị trí literal (nếu bộ hex bị đổi, chỉ sửa đúng đây)

1. `web/src/design-system/components/components.css` — rule `.chip--dagiao`
2. `mobile/lib/design_system/components/status_chip.dart` — `kStatusColors[StatusKey.dagiao]` (dạng `0xFF…`, chữ HOA)
3. `design-system/components/components.test.mjs` — mảng `triplets`
4. `design-system/components/parity.test.mjs` — `STATUS_TRIPLETS`
5. `…/ux-designs/…/DESIGN.md` — hàng bảng Status chip
6. `…/ux-designs/…/mockups/all-screens.html` — legend + rule CSS

(`StatusChip.tsx` và `chip-components.test.mjs` chỉ giữ **key + nhãn**, không giữ hex ⇒ không đụng.)

### Bản đồ test — cái nào HARD-FAIL, cái nào âm thầm bỏ sót ⚠️

Đây là bẫy lớn nhất của story. Ba mảng liệt kê 9 trạng thái nằm ở ba file test khác nhau, **chỉ một cái chặn bạn**:

| Test | File | Cơ chế | Nếu quên sửa |
|---|---|---|---|
| (3) `StatusKey union declares exactly the 9…` | `chip-components.test.mjs:88` | `assert.deepEqual(union.sort(), STATUS_LABELS.keys.sort())` | 🔴 **ĐỎ NGAY** — union 10 vs mảng 9 |
| (9) chip selectors exist | `components.test.mjs:142` | `css.includes(sel)` trên list cố định | 🟡 **XANH GIẢ** — chip mới không được guard |
| (10) 9 hex triplets | `components.test.mjs:157` | regex per-key trên list cố định | 🟡 **XANH GIẢ** — màu mới trôi tự do |
| (4) STATUS_LABELS verbatim | `chip-components.test.mjs:102` | regex per-key | 🟡 **XANH GIẢ** |
| parity 9 triplets | `parity.test.mjs:50` | `includes` trên map cố định | 🟡 **XANH GIẢ** — **parity web↔mobile của chip mới không được kiểm** |
| `renders all 9 states` | `components_render_test.dart:96` | lặp `StatusKey.values` | ✅ tự phủ; chỉ tiêu đề lạc hậu |

⇒ **Suite vẫn xanh dù bạn quên 4/5 mảng.** Chỉ có test (3) hét lên. Đừng lấy "npm test pass" làm bằng chứng đã xong — phải sửa **đủ cả ba mảng** thì chip thứ 10 mới thật sự có drift-guard + parity guard. Đây chính là cách chip "Đã giao" bị bỏ quên ngay từ Story 1.4.

### Gotcha bắt buộc xử lý

- **`danggiao` vs `dagiao` — hai tên gần như song sinh.** `danggiao` = "**Đang** giao" (đang vận chuyển, chip cyan đã có). `dagiao` = "**Đã** giao" (đã giao xong, chip mới). Lệch đúng một chữ `g`. **Gõ `dagiao` mới hoàn toàn — ĐỪNG copy dòng `danggiao` rồi xoá `ng`**, đó là cách sinh ra lỗi âm thầm (ghi đè chip cyan, compile vẫn pass, test vẫn xanh). Tin tốt: `'danggiao'.includes('dagiao') === false` ⇒ `grep dagiao` **không** dính false-positive, dùng grep để tự kiểm.
- **Đừng tái dùng màu `danggiao`.** Bộ `#DEF1F6/#0C6B84` còn được `banner--info` dùng chung (`parity.test.mjs` BANNER_TONES). Trùng màu = hai trạng thái không phân biệt được.
- **Guard quét TOÀN VĂN như text** (project-context.md#Testing): **tuyệt đối không viết** các chuỗi `shadow` / `gradient` / `box-shadow:` / `var(--r` trong comment CSS mới — false-positive tái diễn, test (3) "Viền nét" sẽ đỏ dù CSS đúng.
- **Format rule CSS phải khít regex** test (10): `\.chip--dagiao\s*\{background:#DDF3EA;color:#0F7657;border-color:#B7E5D4\}`. Khoảng trắng canh cột trước `{` thì được (`\s*`); thêm declaration hay xuống dòng trong `{}` thì **fail**.
- **Dart:** `Color(0xFFRRGGBB)` với hex **chữ HOA** — `parity.test.mjs` build `0xFF${hex.slice(1).toUpperCase()}` rồi `statusDart.includes(...)`. Viết thường ⇒ đỏ.
- **Web chưa có tsc/bundler** (nợ kỹ thuật kế thừa, project-context.md): `.tsx` **không** typecheck được. Union mới chỉ được bảo vệ bằng text-guard `chip-components.test.mjs` + review. Đừng scaffold bundler chỉ để typecheck (YAGNI).
- **Chèn giữa enum Dart** đổi `.index` của `hoanthanh`/`huy`. Đã xác minh **không** nơi nào đọc `.index`/`values[n]`/serialize enum (chỉ `for (final s in StatusKey.values)`). An toàn. Nếu về sau backend map theo index — dùng tên, không dùng index.

### Vị trí vòng đời của "Đã giao" (bối cảnh, không phải việc của story này)

`Đã cọc → Đang giao (cờ Vận chuyển) → Đã giao → Hoàn thành`; nếu tắt cờ Vận chuyển thì `Đã cọc → Đã giao` thẳng (khách tự lấy). Transition `Đã giao` xác nhận phiếu xuất kho, trừ tồn, publish `StockIssued`, snapshot `costPriceSnapshot` lúc xuất. Toàn bộ logic này thuộc **Epic 6** — story 1.12 **chỉ cấp chip hiển thị**, tuyệt đối không cài hành vi đổi status (AD-11: chỉ `applyTransition()` được đổi `Order.status`). [Source: epics.md#Story 6.1, ARCHITECTURE-SPINE.md]

### Tái dùng hạ tầng — KHÔNG tạo trùng (DRY, scout-before-code)

- Mọi thứ cần thiết **đã tồn tại**: `StatusChip.tsx`, `status_chip.dart` (+ `AppChip` base ở `chip.dart`), 3 file test, barrel `index.ts`. Story này **chỉ nong thêm một phần tử** vào các danh sách sẵn có. **Đừng** dựng component/widget/file test mới. Không có `DaGiaoChip` riêng — epic AC-3 viết "widget `DaGiaoChip` **hoặc tương đương**"; tương đương ở đây là `StatusKey.dagiao` trong `AppStatusChip` sẵn có, đúng DRY.
- Chip mới thừa hưởng chỉ-đọc + a11y từ `AppStatusChip`/`StatusChip` — không cần code gì thêm cho AC-5, chỉ **không được** phá.

### Testing standards [Source: project-context.md#Testing, Story 1.4/1.7 pattern]

- `cd design-system && npm test` (`node --test "**/*.test.mjs"`, glob đệ quy, hiện **189 test toàn pass**). Sau story: vẫn 189 test, assertion nhiều hơn.
- `cd mobile && flutter analyze` + `flutter test` — Flutter **3.35.0** thật sự chạy được ở máy này (Story 1.7 đã chạy 56/56).
- Test phải **fail** nếu: xoá rule `.chip--dagiao`, đổi một hex, quên bên Dart, hoặc union lệch mảng nhãn.

### Project Structure Notes

- **Surgical:** chỉ **thêm** một phần tử vào các danh sách hiện có + đồng bộ 2 file doc SSOT. **Không** đụng 9 chip cũ, `tokens/*`, `icons/*`, `.ktype`, `.scope-flag`, banner, hay bất kỳ component nào khác.
- Cây file đụng tới (7 code/test + 2 doc):
  - `web/src/design-system/components/StatusChip.tsx` (sửa)
  - `web/src/design-system/components/components.css` (sửa: +1 rule)
  - `web/src/design-system/components/index.ts` (sửa: comment)
  - `mobile/lib/design_system/components/status_chip.dart` (sửa: enum + 2 map)
  - `design-system/components/chip-components.test.mjs` (sửa: mảng `STATUS_LABELS`)
  - `design-system/components/components.test.mjs` (sửa: `required` + `triplets`)
  - `design-system/components/parity.test.mjs` (sửa: `STATUS_TRIPLETS`)
  - `mobile/test/design_system/components/components_render_test.dart` (sửa: tiêu đề)
  - `…/ux-designs/…/DESIGN.md` + `…/mockups/all-screens.html` (sửa: bảng/legend/rule)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.12] — user story + 4 AC (UX-DR-8, UX-DR-27).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Colors] — bảng màu "Năng Lượng Sạch", `ok #159A6B`, lime cấm dùng cho trạng thái (dòng 160–166).
- [Source: …/DESIGN.md#Status-chip] — bảng 9 hex canonical (dòng 168–182) + câu "Logic màu" đặt nhóm *giao* vào dải xanh-teal (dòng 184). **Hiện ghi "9 trạng thái" — story này nâng lên 10.**
- [Source: …/mockups/all-screens.html] — legend chip (dòng 21–30) + khối CSS chip (dòng 90–102). **9 rule, chưa có `dagiao`.**
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md:61] — "Chín chip → mười chip. Thêm `dagiao: 'Đã giao'`" + cảnh báo "parity test hai nền tảng phải chạy lại". Không cấp hex.
- [Source: _bmad-output/implementation-artifacts/1-4-react-chip-status-chip-9-trang-thai-chip-chi-doc.md] — nguồn gốc chip layer web, quy ước hand-authored, drift-guard, gotcha "web chưa có tsc", lý do 9 hex để literal (không tokenize).
- [Source: _bmad-output/implementation-artifacts/1-7-flutter-thu-vien-widget-tuong-duong-parity-component.md] — nguồn gốc `status_chip.dart`, `StatusChipColors`, parity guard byte-for-byte.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1] — vị trí "Đã giao" trong vòng đời + gate cờ Thiết bị/Vận chuyển (logic thuộc Epic 6).
- [Source: _bmad-output/project-context.md] — AD-11 (chỉ `applyTransition` đổi status), AD-13 (design-system-first, cấm style ad-hoc), testing guard quét toàn văn (tránh chuỗi cấm trong comment), nợ tooling web.

**Stack liên quan:** React (Web) 19.2.7 · Flutter 3.35.0 (`~/fvm/default/bin/flutter`) · Node.js 24 LTS. **Không** thêm dependency nào. [Source: project-context.md#Stack]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

Không có sự cố cần debug. Ba lần chạy kiểm chứng đáng ghi lại:

1. **RED có chủ đích.** Sau khi thêm `| 'dagiao'` vào union TSX (Task 2) mà chưa nong mảng test, `npm test` cho **188 pass / 1 fail** — đúng một test (3) `StatusKey union declares exactly the…` đỏ. Xác nhận đúng dự đoán của Dev Notes: 4/5 mảng còn lại "xanh giả", suite không tự bảo vệ chip mới.
2. **GREEN.** Sau Task 4, `npm test` → **189 pass / 0 fail**, tổng số test không đổi (chỉ assertion tăng), đúng như story dự đoán.
3. **Kiểm chứng ngược (4 mutation, mỗi lần đều restore).** Chứng minh guard thật sự cắn chứ không phải pass rỗng:

   | Mutation | Số test đỏ |
   |---|---|
   | Xoá rule `.chip--dagiao` khỏi `components.css` | 7 |
   | Đổi 1 hex fg `#0F7657` → `#0F7658` trong CSS | 5 |
   | Xoá entry `kStatusColors[StatusKey.dagiao]` (quên mobile) | 3 |
   | Xoá `\| 'dagiao'` khỏi union TSX (union lệch mảng nhãn) | 3 |

   Sau restore: 189/189 pass.

### Completion Notes List

**Đã cài đặt.** Chip thứ 10 `dagiao: 'Đã giao'` có mặt đồng thời trên web (`StatusKey` union + `STATUS_LABELS` + rule `.chip--dagiao`) và Flutter (`StatusKey.dagiao` + `kStatusLabels` + `kStatusColors`), cùng bộ 3 hex **bg `#DDF3EA` · fg `#0F7657` · border `#B7E5D4`**. Ba mảng test (drift-guard nhãn, drift-guard hex, parity web↔mobile) đều đã nong lên 10; hai nguồn thị giác SSOT (DESIGN.md, mockup) đã đồng bộ.

**Kết quả kiểm thử.** `design-system`: **193/193 pass** (189 trước story; +4 test guard mới ở Task 7). `mobile`: `flutter analyze` sạch, `flutter test` **132/132 pass** (+1 render test cho `dagiao`), hai file Dart của story format-clean. Không thêm dependency nào.

⚠️ **`dart format` GHI ĐÈ FILE — luôn dùng `-o none` khi chỉ muốn kiểm tra.** `dart format --set-exit-if-changed <path>` **vẫn ghi** file; cờ đó chỉ đổi exit code. Repo này có 20 file Dart chưa format-clean từ trước, nên một lệnh `dart format lib/ test/` sẽ **cascade** reformat 20 file ngoài phạm vi story. Lệnh kiểm tra an toàn: `dart format -o none --set-exit-if-changed <path>`.

**Chỉ-đọc & a11y (AC-5) giữ nguyên.** Không đụng props, thân render, hay component nào. Chip mới thừa hưởng `<span>` tĩnh từ `StatusChip` và `AppChip` từ `AppStatusChip` — test (1) "chip components carry no interactive handlers/roles" vẫn xanh, chứng minh không có `onClick`/`<button>`/`role`/`tabindex` lọt vào.

⚠️ **CẦN ĐẠI CA / UX RATIFY — bộ 3 hex là suy dẫn mới, chưa từng tồn tại trong repo.** DESIGN.md tuyên bố màu status là canonical bất biến; một khi ship thì bị khoá. Em đã **tự đo lại**, không tin số có sẵn:

- **Contrast fg-trên-bg = 4.823:1** → **đạt WCAG AA** (≥ 4.5:1). Con số 4.82 mà Dev Notes nêu là chính xác. Để so sánh: `hoanthanh` 4.614:1, `dachot` 5.023:1, `danggiao` 5.220:1 — chip mới nằm trong dải bình thường của gia đình.
- **Nhưng độ tách màu rất thấp.** Khoảng cách RGB của **nền** `dagiao` so với `dachot` chỉ **5/255**, so với `hoanthanh` chỉ **4/255**; chữ cách nhau 12–14/255. Nghĩa là trên màn hình, ba chip "Đã chốt" / "Đã giao" / "Hoàn thành" gần như **cùng một màu** — người dùng chỉ phân biệt được nhờ **đọc nhãn chữ**, không phải nhờ màu. Không vi phạm a11y (WCAG 1.4.1: màu không phải kênh truyền tin duy nhất, chip luôn mang nhãn), nhưng **làm mỏng giá trị của chip như tín hiệu thị giác lướt nhanh**. Dev Notes chỉ nói "gần"; đây là con số cụ thể.
- Nguyên nhân gốc: dải xanh-teal đã có sẵn 4 chip (`baogia`/`dachot`/`danggiao`/`hoanthanh`), nhét chip thứ 5 vào cùng dải thì buộc phải chen chúc. Nếu UX muốn `Đã giao` nổi bật hơn, lựa chọn thực tế là **giãn hue** (ví dụ đẩy về xanh lá đậm hơn, tách khỏi `dachot`) — nhưng việc đó có thể phải chỉnh cả `hoanthanh`, tức chạm màu canonical đã ship. **Đây là quyết định của Đại Ca/UX, không phải của dev.**
- Nếu bộ hex bị đổi: sửa đúng **6 vị trí literal** đã liệt kê ở Dev Notes §"Sáu vị trí literal". Không có chỗ thứ 7 — đã grep xác minh (13 hit `dagiao`, khớp hết).

**Sai lệch nhỏ trong phép suy dẫn của Dev Notes (ghi nhận, không sửa).** Bảng "trung điểm" ghi fg = (15,118,**87**) = `#0F7657`. Trung điểm số học thật của kênh B giữa `dachot` (100) và `hoanthanh` (76) là **88** = `#0F7658`. Tương tự, nền làm tròn xuống (234.5→234) còn viền làm tròn lên (211.5→212). Em **giữ nguyên `#0F7657`** như story chỉ định vì đó là giá trị canonical đã được viết vào cả 6 literal + 3 mảng test, và tính nhất quán mới là thứ quan trọng — lệch 1/255 trên một kênh không có tác động thực tế (contrast vẫn 4.823:1, đã đo). Nêu ra để bản ghi trung thực, phòng khi ai đó về sau tính lại trung điểm và tưởng có bug.

**Lệch trạng thái giữa hai nguồn theo dõi.** `sprint-status.yaml` ghi `1-12` là `backlog`, trong khi file story ghi `ready-for-dev`. Em theo file story (Đại Ca chỉ định trực tiếp đường dẫn) và đã đồng bộ sprint-status sang `review`. Đáng để ý vì `create-story` lẽ ra phải cập nhật cả hai.

**Ngoài phạm vi, không đụng (đúng ranh giới story).** Không cài logic transition `Đang giao → Đã giao`, không map `StatusKey` ↔ enum `Order.status` backend, không thêm token vào `design-tokens.json`, không tạo component/widget/file test mới. Chip chỉ **hiển thị** — mọi hành vi đổi trạng thái thuộc Epic 6 và chỉ đi qua `applyTransition()` (AD-11).

### File List

**12 file sửa + 1 file tạo mới** (đường dẫn tương đối gốc repo). *(Bản gốc ghi "10 file" và bỏ sót `a11y-floor.test.mjs` — đã đối chiếu `git status` và sửa lại.)*

**Web (3)**
- `web/src/design-system/components/StatusChip.tsx` — thêm `'dagiao'` vào `StatusKey` union + `STATUS_LABELS`; comment 9→10
- `web/src/design-system/components/components.css` — thêm rule `.chip--dagiao`; comment header 9→10
- `web/src/design-system/components/index.ts` — comment 9-state→10-state

**Mobile (1)**
- `mobile/lib/design_system/components/status_chip.dart` — thêm `StatusKey.dagiao` vào enum + `kStatusLabels` + `kStatusColors`; comment header 9→10

**Test (5)**
- `design-system/components/chip-components.test.mjs` — mảng `STATUS_LABELS` +1 entry; tiêu đề test (3)/(4) 9→10; **[review]** neo `\b` + escape metachar cho regex nhãn
- `design-system/components/components.test.mjs` — mảng `required` +`.chip--dagiao`; mảng `triplets` +1 entry; tiêu đề test (10) 9→10; **[Task 7]** +test (10b) chống trùng bộ 3 màu; **[review]** parse-guard lấy mẫu số **từ file** thay vì hardcode 10
- `design-system/components/parity.test.mjs` — `STATUS_TRIPLETS` +`dagiao`; tiêu đề 9→10; **[Task 7]** +guard swap phía Dart, +guard chỉ-đọc phía mobile, +parse nhãn từ web làm SSOT, hoist `stripDart`; **[review]** guard chỉ-đọc chuyển từ blacklist 7 tên widget → **regex `on[A-Z]`** (blacklist để lọt `Listener(onPointerDown:)`)
- `design-system/components/a11y-floor.test.mjs` — **[Task 7] file bị bỏ sót khỏi File List gốc.** +guard contrast WCAG AA ≥ 4.5:1 cho cả 10 chip, đọc hex trực tiếp từ `components.css`
- `mobile/test/design_system/components/components_render_test.dart` — tiêu đề `renders all 9 states` → `10`; **[Task 7]** bỏ assertion tự-quy-chiếu → map `expectedLabels` viết tay; +render test end-to-end cho `dagiao`

**Nguồn thị giác SSOT (2)**
- `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md` — heading + câu mở 9→10; +1 hàng bảng `Đã giao`
- `_bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html` — legend 9→10 + dòng legend mới; comment CSS 9→10 + rule `.chip--dagiao`

**Theo dõi (1 sửa + 1 tạo mới)**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-12` → `done`
- `_bmad-output/implementation-artifacts/tests/test-summary-story-1-12.md` — **file mới**, tóm tắt mở rộng 189→193 test + kết quả mutation testing

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-13 · **Kết quả: APPROVE** (0 CRITICAL, 0 HIGH còn lại)

**Đã kiểm chứng độc lập.** `design-system` 193/193 pass · `mobile` 132/132 pass, `flutter analyze` sạch · contrast tính lại từ đầu, khớp: `dagiao` = **4.8230:1** (đạt AA), cả 10 chip đều ≥ 4.5. Năm AC đều **thật sự** được cài đặt, không có task nào tick [x] mà chưa làm.

**Guard đứng vững trước tấn công** (đã thử phá, không lọt): cross-match `dagiao`↔`danggiao` (cả hai chiều, trên CSS/TSX/Dart) · hoán vị màu giữa hai state · hoán vị nhãn · guard bottom-nav không bị yếu đi khi hoist `stripDart` · chèn giữa enum Dart an toàn (không nơi nào đọc `.index`).

**Lỗ hổng tìm được và ĐÃ VÁ:**

| # | Mức | Vấn đề | Cách vá |
|---|---|---|---|
| 1 | **HIGH** | Guard chỉ-đọc phía mobile dùng **blacklist 7 tên widget** → `Listener(onPointerDown: …)` lọt qua: chip biến thành control đổi trạng thái (phá AC-5 **và** AD-11) mà **mọi suite vẫn xanh**. | Thay bằng **regex `\bon[A-Z]\w*\s*:`** (bắt *mọi* handler), + họ widget tương tác, + `Semantics(button:true)`. Nay soi cùng một luật với web. |
| 2 | MEDIUM | Hai parse-guard ghim `rules.length === 10` bằng **hằng số**. Một rule chip viết kiểu CSS thường (`{background: #FFF; color: …}`) không khớp regex ⇒ đếm **vẫn ra 10** ⇒ chip thứ 11 lọt vào mà **không bị kiểm contrast, không bị kiểm trùng màu**. | Lấy **mẫu số từ chính file** (`css.match(/\.chip--[\w-]+/g)`): mọi rule khai báo đều **phải parse được**. |
| 3 | MEDIUM | Dev Agent Record **sai sự thật**: ghi 189/189 + 131/131 + "10 file, không thêm test mới", trong khi thực tế là **193/193**, **132/132**, **12 file**, **+4 test mới** — và **bỏ sót hẳn `a11y-floor.test.mjs`** khỏi File List. | Sửa Task 6, thêm Task 7, sửa Completion Notes + File List theo đúng `git status`. |
| 4 | LOW×3 | `stripDart` strip block-comment **trước** line-comment (một `/*` nằm trong `//` sẽ nuốt mất code thật) · nhãn nội suy thẳng vào `RegExp` (nhãn có `(` sẽ **throw** thay vì fail sạch) · 2 comment trỏ dòng lệch 1 sau khi chèn. | Đảo thứ tự strip · thêm `escapeRe()` · sửa dải dòng. |

**Kiểm chứng ngược (mutation).** Hai lỗ hổng trên đều **từng xanh**, nay **đều đỏ**: chèn `Listener(onPointerDown:)` vào `chip.dart` → guard chỉ-đọc đỏ; chèn rule chip thứ 11 kiểu CSS thường (contrast 1.07:1) → **cả hai** parse-guard đỏ. Restore → 193/193.

**Còn mở — cần Đại Ca/UX quyết, KHÔNG chặn merge:** bộ 3 hex là **quyết định thiết kế mới**, không phải tra cứu. `DESIGN.md` tuyên bố màu status là canonical bất biến — ship xong là khoá. Nền `dagiao` cách nền `hoanthanh` **4/255** và `dachot` **5/255** ⇒ ba chip đọc lướt gần như **cùng màu**; người dùng phân biệt được **nhờ nhãn chữ**, không nhờ màu. Không vi phạm a11y (WCAG 1.4.1: màu không phải kênh duy nhất, chip luôn có nhãn), nhưng làm mỏng giá trị tín hiệu thị giác. **"Test xanh" ≠ "UX đã duyệt màu".** Nếu đổi: sửa đúng 6 vị trí literal ở §"Sáu vị trí literal".

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-13 | **Review.** Vá 1 HIGH + 2 MEDIUM + 3 LOW. Trọng yếu: guard chỉ-đọc phía mobile từng dùng blacklist tên widget nên để lọt `Listener(onPointerDown:)` — một chip có thể âm thầm trở thành control đổi trạng thái với suite xanh hoàn toàn; nay đổi sang regex bắt mọi handler `on[A-Z]`, cùng luật với web. Hai parse-guard chip nay lấy mẫu số từ chính file thay vì hằng số 10, nên một rule chip không parse được không còn tàng hình trước guard contrast và guard trùng màu. Đính chính Dev Agent Record cho khớp `git status` (193/193 · 132/132 · 12 file; bổ sung `a11y-floor.test.mjs` bị bỏ sót). Không đổi màu, không đổi hành vi component. |
| 2026-07-10 | Thêm chip trạng thái thứ 10 `dagiao` ("Đã giao") vào design system trên cả web (React) lẫn mobile (Flutter), dùng bộ 3 hex canonical `#DDF3EA`/`#0F7657`/`#B7E5D4` (contrast đo được 4.823:1, đạt AA). Nong ba mảng drift-guard/parity-guard từ 9 lên 10 trạng thái để chip mới thực sự được bảo vệ khỏi drift màu và lệch parity web↔mobile — trước đó chỉ 1/5 mảng chặn được thiếu sót. Đồng bộ DESIGN.md và mockup. Không đổi hành vi 9 chip cũ, không thêm dependency. Bộ hex là suy dẫn mới và **cần UX ratify**. |
