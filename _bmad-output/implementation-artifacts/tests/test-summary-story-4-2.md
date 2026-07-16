# Test Automation Summary — Story 4.2 (Xem trước tổng realtime qua POST /orders/preview-total)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (backend hermetic) · `node --test` (design-system guard) · `flutter test` (widget)
**Kết quả:** backend **758 test / 50 suite** xanh (754 → 758) · design-system **267** xanh (266 → 267) · mobile **159** xanh (158 → 159) + analyze sạch · prettier + eslint + dart format sạch

## Phạm vi

Story 4.2 dev xong với coverage dày sẵn (unit domain 6 + unit service 2 + e2e 6 + drift 1 + guard
mở rộng + widget 4 case mới, 3 mutation-check RED lúc dev). Việc của workflow là **gap analysis**:
đối chiếu từng assert với mutant có thể sống sót, vá lỗ trong test — không sửa production code
(code đúng, test thiếu).

## Gap phát hiện & auto-apply (6 gap → +5 test, +5 assert guard)

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| G1 | AC-2 | Half-up chỉ test biên **50.5 → LÊN**; chưa có case **dưới .5 → XUỐNG** | **Chứng minh bằng mutant trước khi vá**: `+50 → +99` (ceiling) XANH cả 61 test backend liên quan — mọi case hiện hữu hoặc rơi đúng .5 hoặc tròn/chẵn | ✅ unit (+1): `1009 @ 5%` ⇒ 50.45 ⇒ vat **50**, total 1059 |
| G2 | AC-4 | `@ArrayMaxSize(500)` khai báo, 0 request chạm | Xoá decorator ⇒ body vô hạn lọt, không test nào đỏ (cùng loại gap `@MaxLength` Story 3.5/4.1) | ✅ e2e (+1): đúng 500 dòng ⇒ 200 (tính tay 500/40/540) · 501 ⇒ 400 |
| G3 | AC-1/2 | `@IsInt` chưa được chứng minh — chỉ `@Min` được test (-1, 0) | Xoá `@IsInt` ⇒ tiền **FLOAT** (`100.5`) lọt vào hàm pricing ⇒ output float, vỡ bất biến integer đồng (AD-10) | ✅ e2e (+1): `unitPrice 100.5` ⇒ 400 fieldErrors đúng field · `qty 1.5` ⇒ 400 |
| G4 | AC-1 | Biên **thành công** `@Min(0)`: `unitPrice: 0` hợp lệ chưa test | Mutant `@Min(0) → @Min(1)` chặn dòng-0-đồng hợp lệ mà vẫn xanh — nửa DƯƠNG của biên (bài học G1 story 4.1) | ✅ e2e (+1): `{unitPrice: 0, qty: 3}` ⇒ 200 `{0,0,0}` |
| G5 | AC-3 | Race-ticket `_latestTotals` (mobile): 0 test chứng minh response CŨ về TRỄ bị vứt | Story pin pattern ticket là lý do thiết kế, nhưng xoá check `ticket != _latestTotals` vẫn xanh 158 test — race là hành vi CHỈ widget test thấy được | ✅ widget (+1): `_ManualPreviewPort` (Completer) — 3 preview treo, complete NGƯỢC thứ tự ⇒ số mới giữ nguyên, 2 response trễ bị vứt sạch |
| G6 | AC-1/4 | Web `.tsx` không runtime lane (TD-1): (a) không gì pin **3 field riêng biệt** render — copy-paste `totals.subtotal` ×3 dòng vẫn xanh; (b) công thức fake web không gì pin (fake dart được widget test pin số, fake web thì không) | Guard là tuyến phòng thủ DUY NHẤT của web; lệch công thức fake web ↔ dart là demo web hiển thị số khác backend | ✅ guard (+1 test/5 assert): web render đủ `totals.subtotal`/`totals.vatAmount`/`totals.total`; fake web chứa nguyên văn `Math.floor((subtotal * 8 + 50) / 100)`; fake dart chứa `(subtotal * 8 + 50) ~/ 100` |

**Không thêm (đã cân nhắc, ghi lại có chủ đích):**
- DB lane: endpoint stateless không chạm Prisma — quyết định "không spec DB mới" của story là đúng,
  không phải gap.
- Web race-ticket: cùng logic với mobile nhưng web chưa có runtime harness (TD-1/C-4 chấp nhận
  xuyên Epic 4) — twin mobile đã chứng minh pattern; guard h.3 pin phần text pin được.
- Test đếm call service→domain: kỷ luật 3.2 cấm — payload đã được assert qua số kỳ vọng tính tay.
- `vatRate=0`/số âm vào `computeOrderTotals`: DTO `@Min` chặn trước, service hardcode rate 8 —
  case không thể xảy ra qua mọi caller hiện hữu (YAGNI).
- Debounce/throttle preview: story cấm làm trước (round-trip qua port + ticket là đủ).

## Test theo file

### Unit — `backend/test/order-totals.spec.ts` (6 → 7)
- [x] **MỚI** half-up biên DƯỚI: 1009 @ 5% ⇒ 50.45 làm tròn XUỐNG 50 (giết mutant ceiling `+99`)
- [x] (cũ) rỗng / cộng dồn qua lineAmount / 50.5→51 / applyVat=false / grand-vs-per-line 999@7 / hằng 8

### E2E — `backend/test/orders.e2e.spec.ts` (27 → 30)
- [x] **MỚI** `unitPrice: 0` hợp lệ ⇒ 200 — biên dương của `@Min(0)`
- [x] **MỚI** float unitPrice/qty ⇒ 400 — `@IsInt` chặn trước khi float lọt vào pricing
- [x] **MỚI** biên 500/501 dòng — `@ArrayMaxSize` chạy thật, 500 dòng vẫn tính đúng (500/40/540)
- [x] (cũ) fail-closed 401/403 (6 route) / happy 2 dòng / lines rỗng / -1 / qty 0 / thiếu lines

### Widget — `mobile/test/screens/orders/create_quote_screen_test.dart` (12 → 13)
- [x] **MỚI** race preview: response cũ về SAU bị vứt — `_ManualPreviewPort` complete ngược thứ tự,
      số mới không bị đè, không quay về "—"/0
- [x] (cũ 4.2) giỏ rỗng 0×3 / số fake 12250000-980000-13230000 / lỗi giữ giỏ / qty đổi tổng đổi

### Guard — `design-system/screens/orders.test.mjs` (h.3 MỚI)
- [x] **MỚI** web wire đủ 3 field totals riêng biệt + cả 2 fake chứa nguyên văn công thức half-up

### Không đổi
- `backend/test/orders.service.spec.ts` (previewTotal 2 case đủ) · `openapi-drift.spec.ts` (per-story
  assert đủ) · không spec DB mới

## Mutation-check (kỷ luật 2.10/4.1 — mutant compile sạch, restore bằng `cp`)

| Mutant | Kỳ vọng | Kết quả |
|---|---|---|
| `+ 50` → `+ 99` (ceiling) **trước khi vá** | XANH (chứng minh gap thật) | ✅ 61/61 xanh |
| `+ 50` → `+ 99` sau khi vá | unit G1 RED | ✅ 1 failed |
| xoá `@IsInt()` unitPrice | e2e G3 RED | ✅ 1 failed |
| xoá `@ArrayMaxSize(500)` | e2e G2 RED | ✅ 1 failed |
| `@Min(0)` → `@Min(1)` unitPrice | e2e G4 RED | ✅ 1 failed |
| xoá `ticket != _latestTotals` (nhánh thành công, mobile) | widget G5 RED | ✅ 1 failed |
| web render `vatAmount` → copy-paste `subtotal` | guard h.3 RED | ✅ đúng message |
| fake web `+ 50` → `+ 49` | guard h.3 RED | ✅ đúng message |

## Coverage

- Endpoint `POST /orders/preview-total`: đủ 401/403/happy/rỗng/validation từng decorator
  (`@IsInt`, `@Min` cả 2 biên, `@ArrayMaxSize` cả 2 biên) — mọi decorator trong DTO giờ có test giết mutant.
- Hàm pricing `computeOrderTotals`: half-up đủ CẢ HAI hướng biên (.5 lên, <.5 xuống), một điểm
  làm tròn, applyVat, cộng dồn, rỗng.
- FE: race-ticket có bằng chứng runtime (mobile); web text-guard pin 3 field render + công thức
  fake 2 nền tảng byte-level.

## Xác minh

```
cd backend       && npm test               # 50 suite / 758 test xanh
cd design-system && npm test               # 267 test xanh
cd mobile        && flutter analyze        # No issues found!
cd mobile        && flutter test           # 159 test xanh
prettier --check ✓ · eslint ✓ · dart format -o none (0 changed) ✓
```

## Next Steps

- Chạy `npm run test:db` khi Postgres cục bộ lên (nợ môi trường từ 4.1 — story này không thêm nợ).
- CI 4 lane (C-3) tự chạy các suite này trên push.
