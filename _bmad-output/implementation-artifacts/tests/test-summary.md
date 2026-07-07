# Tóm tắt Tự động hoá Test — Story 1.1 (Tầng token dùng chung)

**Tính năng:** Tầng design token chính tắc dùng chung web (React) + mobile (Flutter).
**Ngày:** 2026-07-07
**Loại test:** Contract / parity (chống lệch giá trị giữa hai nền tảng). Story chỉ giao **tầng token** — không có API endpoint, không có UI tương tác — nên "E2E" ở đây là **hợp đồng token chéo nền tảng**.

## Framework phát hiện

- **Web / SSOT:** Node.js built-in test runner (`node --test`) — không phụ thuộc ngoài. Chạy: `cd design-system && npm test`.
- **Mobile:** `flutter test`. Chạy: `cd mobile && flutter test`.
- Giữ nguyên framework sẵn có của repo (không thêm dependency).

## Test đã sinh / mở rộng

### Node parity suite — `design-system/tokens/parity.test.mjs`

| # | Test | AC |
|---|---|---|
| 1 | Output web + mobile tái sinh giống hệt từ SSOT (drift guard) | 1–4 |
| 2 | Hex màu byte-identical qua json/ts/css/dart | 1 |
| 3 | Đủ 14 nhóm màu canonical | 1 |
| 4 | Spacing scale + radius giống nhau qua các nền tảng | 2 |
| 5 | 4 role typography khớp thang chuẩn | 3 |
| 6 | Không có token shadow/gradient (Viền nét) | 4 |
| **7** *(mới)* | **Alias spacing (gutter/page-x/pscroll) giống nhau + đúng giá trị** | **2** |
| **8** *(mới)* | **Đủ 5 role gồm `meta` + letter-spacing tới output** | **3** |
| **9** *(mới)* | **`.mono` canh phải chữ số tabular (tiền/số lượng)** | **3** |
| **10** *(mới)* | **`statusChip.sets` tồn tại & rỗng — chốt phạm vi, để dành Story 1.4** | scope |

### Flutter suite — `mobile/test/design_system/tokens/app_tokens_test.dart`

| # | Test | AC |
|---|---|---|
| 1 | Màu canonical khớp nguồn thiết kế — **mở rộng: pin đủ 17/17 giá trị** (thêm `lime-600`, `lime-050`, `ink-2`, `muted`) | 1 |
| 2 | Spacing + radius scale khớp | 2 |
| 3 | Role typography khớp | 3 |
| 4 | Viền nét: border 1.5, không dùng API depth trang trí | 4 |

## Khoảng trống đã phát hiện & vá (auto-apply)

| Gap | AC | Trước | Sau |
|---|---|---|---|
| G1 | 2 | Giá trị alias (gutter/page-x/pscroll) chưa được khẳng định phía web — đổi `page-x` vẫn pass | Test 7 pin `{gutter:12, page-x:22, pscroll:12}` + kiểm CSS/Dart |
| G2 | 3 | Role `meta` (12.5px/600) thiếu trong Node suite | Test 8 khẳng định `meta` tới CSS + Dart |
| G3 | 3 | Letter-spacing (`-.02em`/`-.01em`/`.1em`) chưa kiểm | Test 8 khẳng định trong CSS output |
| G4 | scope | Không có chốt cho điểm mở rộng `statusChip.sets` | Test 10 khẳng định tồn tại & rỗng (chống scope-creep vào 1.4) |
| G5 | 1 | Dart chỉ pin 13/17 màu | Bổ sung `lime-600`/`lime-050`/`ink-2`/`muted` → 17/17 |
| G6 | 3 | `.mono` mới kiểm `tabular-nums`, chưa kiểm canh phải | Test 9 khẳng định `text-align: right` |

## Coverage

- **Nhóm màu:** 17/17 giá trị pin trên cả hai nền tảng (14 nhóm canonical).
- **Spacing:** 7/7 scale + 3/3 alias, đối chiếu chéo nền tảng.
- **Radius:** 4/4.
- **Typography:** 5/5 role + letter-spacing + `.mono`.
- **Viền nét (AC-4):** cấm shadow/gradient + border 1.5 + bậc nền — đủ.
- **4/4 Acceptance Criteria** có test trực tiếp; điểm mở rộng phạm vi (statusChip) được chốt.

## Kết quả chạy

- `design-system` → **10/10 pass** (`node --test "tokens/**/*.test.mjs"`).
- `mobile` → **4/4 pass** (`flutter test`).

## Bước tiếp theo

- Chạy cả hai lệnh test trong CI (chưa có pipeline CI trong repo — greenfield).
- Story 1.4 sẽ điền `statusChip.sets` (9 bộ hex) — Test 10 sẽ cần cập nhật thành "9 bộ" khi story đó chạy.
- Web build/tsconfig tới cùng Story 1.3; khi đó có thể thêm test type-check cho `tokens.ts`.
