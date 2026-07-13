# Test Automation Summary — Story 1.12 (chip trạng thái "Đã giao")

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-10 · **Người chạy:** Đại Ca
**Framework:** `node --test` (design-system guard) + `flutter_test` (render mobile) — không thêm dependency
**Kết quả:** design-system **193 test xanh** · mobile **132 test xanh** · `flutter analyze` sạch

## Phạm vi

Story design-system thuần: thêm chip thứ 10 `dagiao` ("Đã giao") lên cả web (React) lẫn mobile (Flutter).
**Không có API, không có UI runtime để drive** (web chưa có bundler/JSDOM — nợ kỹ thuật kế thừa; mobile chưa có
`main.dart`). E2E ở tầng này = **source-guard + parity guard + render widget test**, đúng pattern Story 1.4/1.7.

## Bối cảnh: vì sao story "189/189 xanh" vẫn cần thêm test

Story 1.12 kết thúc với 189/189 pass. Nhưng suite xanh **không** chứng minh chip thứ 10 được bảo vệ — Dev Notes của
chính story đã cảnh báo 4/5 mảng liệt kê trạng thái là "xanh giả". Workflow này kiểm chứng lại bằng **mutation
testing**: cố tình gài lỗi rồi xem suite có bắt không. Kết quả: **5 lỗ hổng thật**, mỗi lỗ hổng đều để suite pass
189/189 trong khi code đã sai.

## Gap phát hiện & auto-apply (chứng minh bằng mutation)

| # | AC | Gap | Mutation gài vào | Trước | Sau |
|---|----|-----|------------------|-------|-----|
| 1 | AC-3 | Nhãn Dart không có guard verbatim | `kStatusLabels[dagiao]` → `'Đang giao'` | 189 pass 🟢 | **RED** |
| 2 | AC-3 | Bộ màu Dart không ràng buộc theo key | hoán đổi màu `dagiao` ↔ `hoanthanh` | 189 pass 🟢 | **RED** |
| 3 | AC-5 | Không guard chỉ-đọc phía mobile | thêm `onTap` vào `chip.dart` | 189 pass 🟢 | **RED** |
| 4 | AC-5 | Contrast AA không hề được kiểm | fg `dagiao` → `#9FD8C2` (≈2.0:1) | (\*) | **RED** |
| 5 | AC-1 | Không cấm hai chip trùng khít màu | rule `dagiao` = bộ màu `danggiao` | (\*) | **RED** |

(\*) Mutation 4 và 5 **có** bị test (10) sẵn có bắt — nhưng chỉ vì nó dò hex canonical hardcode. Không test nào kiểm
**thuộc tính** contrast hay tính duy nhất. Đổi hex nhất quán ở cả 6 vị trí literal — **đúng quy trình story mô tả khi
UX ratify màu mới** — sẽ lọt hoàn toàn.

### Hai lỗ hổng nghiêm trọng nhất

**(1) Bẫy song sinh `dagiao`/`danggiao` hoàn toàn không được canh** — đúng cái bẫy Dev Notes gọi là lớn nhất:

- `parity.test.mjs` chỉ lấy **mẫu 5 nhãn**, không có `'Đã giao'`.
- Test render Flutter assert `find.text(kStatusLabels[status]!)` — **đọc nhãn từ chính cái map nó đang kiểm**.
  Assertion tự quy chiếu: pass với *bất kỳ* nội dung nào của map, kể cả nhãn sai.

**(2) Web chống hoán đổi màu, mobile thì không.** `components.test.mjs` (10) cố ý ràng bộ 3 hex vào **đúng selector
của nó** (comment: *"so a full color SWAP … is caught"*). Nhưng `parity.test.mjs` kiểm phía Dart bằng
`statusDart.includes(hex)` — hoán đổi hai entry thì mọi hex **vẫn còn trong file**, guard mù hoàn toàn. Web được gia
cố trước một lỗi mà mobile để lọt.

## Test theo file

### Parity cross-platform — `design-system/components/parity.test.mjs`
- [x] `each status triplet is bound to ITS OWN StatusKey entry in Dart (no swap)` — **mới**. Bản sao phía mobile của
      cơ chế ràng-buộc-theo-selector web đã có. `\s*` hấp thụ line-wrap 80-col của `dart format`.
- [x] `every status label is byte-identical Vietnamese on both platforms` — **thay thế** mẫu-5-nhãn. Nay **suy ra cả
      10 nhãn từ `StatusChip.tsx`** (SSOT web) rồi ràng từng `key ↔ label` vào `StatusKey.<key>: '<label>'` phía Dart.
      Không thêm bản sao hardcode thứ ba; tự phủ chip #11 khi có. Có assert số lượng để chống **pass rỗng**.
- [x] `mobile chip widgets stay read-only — never a control (AC-5, UX-DR-23)` — **mới**. Source-guard cấm
      `GestureDetector`/`InkWell`/`onTap`/`onPressed`/`*Button` trong `status_chip.dart` + `chip.dart` (đã strip
      comment). Đối xứng với guard read-only phía web.

### A11y — `design-system/components/a11y-floor.test.mjs`
- [x] `every status chip clears the WCAG AA 4.5:1 text floor (UX-DR-26)` — **mới**. Tự tính relative luminance +
      contrast ratio, **parse trực tiếp từ `components.css`** (không hardcode) nên tự phủ chip mới và không bao giờ
      lệch với thứ thực sự ship. Có assert đủ 10 rule để chống pass rỗng.

### Drift-guard — `design-system/components/components.test.mjs`
- [x] `no two status chips share the same colours (AC-2)` — **mới**. Parse 10 rule từ CSS, cấm trùng khít bộ 3.

### Render mobile — `mobile/test/design_system/components/components_render_test.dart`
- [x] `dagiao carries its exact triplet and label` — **mới**. Chứng minh `StatusKey.dagiao` **thật sự vẽ ra**
      `#DDF3EA`/`#B7E5D4` lúc runtime, hiện `'Đã giao'` và **không** phải `'Đang giao'`, và không mang fill của
      `danggiao`/`hoanthanh`.
- [x] Vòng lặp nhãn **đã hết tự quy chiếu**: assert theo `expectedLabels` khai báo tường minh, không đọc `kStatusLabels`.

## Kết quả

| Suite | Trước | Sau |
|---|---|---|
| `cd design-system && npm test` | 189 pass | **193 pass / 0 fail** |
| `cd mobile && flutter test` | 131 pass | **132 pass / 0 fail** |
| `flutter analyze` | sạch | **sạch** |
| `dart format --output=none --set-exit-if-changed` | — | **0 file đổi** |

Mỗi guard mới đều **kiểm chứng ngược**: gài mutation → guard **đỏ đúng tên nó**; restore → xanh lại. Mutation 1, 2, 3
chỉ làm đỏ **đúng một test** (guard tương ứng) ⇒ guard bắt trúng đích, không đỏ lây.

## Độ phủ theo Acceptance Criteria

| AC | Trước | Sau |
|---|---|---|
| AC-1 — 10 chip, hex, "Viền nét" | ✅ | ✅ + cấm trùng khít màu |
| AC-2 — union + nhãn web, additive | ✅ | ✅ |
| AC-3 — Flutter byte-identical | ⚠️ chỉ kiểm **hiện diện** hex, nhãn chỉ mẫu 5/10 | ✅ ràng theo key (chống hoán đổi) + ràng đủ 10 nhãn |
| AC-4 — parity guard đủ 10 chip | ✅ | ✅ |
| AC-5 — chỉ-đọc + contrast AA | ⚠️ web read-only; **mobile read-only & contrast KHÔNG kiểm** | ✅ cả hai |

**Không sửa một dòng source production nào.** Chỉ 4 file test + tài liệu này.

## Hai quyết định cố ý *không* làm

1. **Không siết ngưỡng contrast quá 4.5:1.** Đo thực tế cả 10 chip: `dagiao` **4.823:1** (khớp đúng con số dev đo tay),
   thấp nhất là `dacoc` **4.509:1** — chỉ dư **0.009**. Ngưỡng chặt hơn sẽ làm đỏ những màu UX **đã ratify và đã ship**.
   Test dùng đúng con số AC-5 nêu.
2. **Không assert khoảng cách màu tối thiểu.** Nền `dagiao` cách `hoanthanh` chỉ **4/255**, cách `dachot` **5/255**.
   Đây là đánh đổi UX **đã được ghi nhận** trong Completion Notes và đang chờ Đại Ca/UX ratify — **không phải bug để
   test tự lật ngược** (rule: không âm thầm đảo quyết định của user). Guard chỉ cấm **trùng khít**. Chip vẫn phân biệt
   được nhờ nhãn chữ luôn hiện diện (WCAG 1.4.1).

## Câu hỏi còn mở

1. **Bộ 3 hex `dagiao` vẫn chờ UX ratify.** Test nay **khoá** bộ màu này ở 5 vị trí (thêm 2 so với 6 literal story liệt
   kê — nhưng cả 2 đều *suy ra* từ CSS, không hardcode ⇒ đổi màu vẫn chỉ sửa 6 chỗ). Nếu màu mới rớt AA, guard contrast
   sẽ chặn.
2. **`dacoc` chỉ dư 0.009 trên sàn AA.** Ngoài phạm vi story, nhưng bất kỳ chỉnh sửa nào lên `#4B7A15`/`#E7F5D9` gần
   như chắc chắn làm rớt AA. Guard mới sẽ bắt.
3. **Repo có ~20 file Dart lệch `dart format` từ trước** (`mobile/lib` + `mobile/test`, không liên quan story 1.12).
   Phát hiện tình cờ khi chạy formatter; **đã revert, không sửa** vì ngoài phạm vi và sẽ tạo diff lớn không liên quan.
   Đáng mở story dọn riêng. Lưu ý: `dart format` **ghi đè mặc định** — kiểm tra phải dùng `--output=none`.
