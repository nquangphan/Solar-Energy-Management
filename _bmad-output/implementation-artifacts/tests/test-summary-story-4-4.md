# Test Automation Summary — Story 4.4: VAT cấu hình + tick áp VAT + metadata Đơn

Workflow: bmad-qa-generate-e2e-tests · Ngày: 2026-07-17 · Chế độ: auto-apply gaps

## Phạm vi rà

Coverage sẵn có từ dev phase đã rất dày (settings e2e 401/403/400/biên 0-100/audit; orders e2e PATCH meta happy/400/null-clear/409; preview khong_vat/config-10/vatMode lạ; service spec đủ payload-assert + thứ tự write→publish; 4 widget test mobile a–d; guards mutation-checked 7 mũi). QA phase CHỈ đếm gap thật — không đếm lại phần dev đã phủ.

## Gap phát hiện & test đã thêm (8)

### Backend e2e — `backend/test/orders.e2e.spec.ts` (+3)

- [x] **Smuggle `vatRate: 50` vào preview-total** → whitelist strip IM LẶNG, vẫn tính theo config 8% + response `vatRate: 8`. Bất biến AC-3 "client KHÔNG BAO GIỜ gửi rate" trước đây KHÔNG có test chặn — cùng kỷ luật smuggle-custType của QA 4.3. **Đã mutation-check**: mở `vatRate` vào `PreviewTotalRequestDto` + controller `body.vatRate ?? config` → test RED đúng chỗ (vatAmount 500 000, vatRate 50 lọt ra) → revert bằng `cp` backup → GREEN lại.
- [x] **Preview với `vatMode: 'co_vat'` TƯỜNG MINH** → 200, applyVat true. Tầng HTTP `@IsIn` trước đây chỉ được test với `khong_vat`/`khac`/vắng field — nhánh tick-ON của UI hai nền tảng đi qua giá trị này mà chưa có test.
- [x] **PATCH meta biên HỢP LỆ**: `kWp: 0.01` (min `@Min(0.01)`) + `validityNote` đúng 200 ký tự (`@MaxLength(200)`) → 200 có ghi. Trước đây chỉ test phía sai (0 và 201) — biên hợp lệ chưa chốt.

### Backend e2e — `backend/test/settings.e2e.spec.ts` (+2)

- [x] **PATCH `{}` (ratePercent VẮNG hẳn)** → 400 fieldErrors, không upsert/audit. `it.each` cũ phủ null nhưng KHÔNG phủ absent — hai nhánh khác nhau với validator trần (không `@IsOptional`).
- [x] **Smuggle `key`/`value` kèm ratePercent hợp lệ** → strip, upsert vẫn ĐÚNG `vat.rate_percent`/`'10'` — chặn đường lái upsert sang setting khác qua field lạ.

### Mobile widget — `mobile/test/screens/orders/create_quote_screen_test.dart` (+3)

- [x] **Tick LẠI "Tính VAT"** (khong_vat → co_vat) → fake nhận `'co_vat'`, VAT 8% quay lại totals. Nhánh `checked=true` của handler chưa có test ở nền tảng nào.
- [x] **kWp nhập rác `"abc"`** → lỗi field "Công suất phải là số (vd 8,82)." hiện, KHÔNG gọi port. Nhánh parse-fail đã code ở `_commitKWp` nhưng zero test.
- [x] **kWp xoá rỗng khi đã có giá trị** → PATCH `kWp: null` (hasKWp true, kWp null) — nhánh null-clear qua sentinel tri-state `kMetaFieldAbsent` chưa test.

## KHÔNG phải gap (đã phủ từ dev phase — không đếm)

- 401/403 fail-closed cả 4+2 route; 400 validation đủ bộ; 409 ngoài baogia; audit before→after qua AuditSubscriber thật; thứ tự write→publish; vat-mode registry exhaustive; preview đọc config row '10'; 4 widget test a–d gồm error case; guards nhãn/port-method/parity đã mutation-check 7 mũi trong dev.
- Web browser E2E + tsc: ràng buộc tooling toàn dự án (web/ chưa có bundler/JSDOM — project-context.md), không phải gap của story.
- DB lane: spec `settings.db.integration.spec.ts` đã viết đủ 4 case từ dev phase, vẫn CHƯA chạy được (Docker Desktop cần GUI session) — trạng thái không đổi sau QA.

## Kết quả chạy

| Lane | Trước QA | Sau QA | Kết quả |
|---|---|---|---|
| Backend `npm test` | 817 | **822** (54 suites) | ✅ xanh |
| Mobile `flutter test` | 167 | **170** | ✅ xanh (`dart format -o none` sạch) |
| Design-system `npm test` | 271 | 271 (không đổi — không sửa guard) | — |
| Backend `npm run test:db` | chưa chạy được | chưa chạy được (cần Postgres) | ⚠️ tồn đọng từ dev |

## Coverage

- API endpoints story 4.4: 4/4 (GET+PATCH /settings/vat-rate, PATCH /orders/:id nhóm meta, POST /orders/preview-total) — đủ happy + error surface + smuggle defense.
- UI: mobile 7/7 hành vi meta qua widget test; web qua text-guard (ràng buộc tooling đã ghi nhận).

## Unresolved

- DB lane (`npm run test:db`) vẫn cần chạy khi có Postgres — migration 4.4 sinh offline, chưa từng deploy thật (tồn đọng dev phase, ngoài phạm vi QA automation).
