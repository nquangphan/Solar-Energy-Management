# Test Automation Summary — Story 4.8 (Xuất & chia sẻ báo giá PDF + ảnh)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-07-17 · **Người chạy:** Đại Ca
**Framework:** Jest + supertest (hermetic, mock Prisma/R2/Chromium — không cần Postgres/mạng)
**Kết quả:** backend **946/946** xanh (57 suite, 934 → 946, **+12 test mới, +1 suite mới**) · mobile/design-system không đụng file → giữ kết quả dev phase (193 + analyze sạch · 290 xanh)

## Phạm vi

Story đã có bộ test dev-phase dày (10 unit service + 8 unit template + 4 e2e + 2 db-lane spec +
4 widget mobile + guards mutation-checked). QA phase rà gap theo 8 AC, phát hiện **4 gap chính +
2 gap nhỏ** — tất cả backend — và auto-apply toàn bộ.

## Gap phát hiện & auto-apply

| # | AC | Gap | Vì sao là gap | Đã vá |
|---|----|-----|---------------|-------|
| 1 | #3 | **`applyVat` resolution ZERO test** — mọi fixture đều `co_vat`. Mutant `applyVat = … \|\| true` (luôn tính VAT) xanh TOÀN suite | Đơn `khong_vat` xuất báo giá sẽ bị TÍNH VAT trên giấy gửi khách — sai tiền mà không test nào đỏ. Cần cả 2 chiều: chưa chốt đọc `Order.vatMode`, đã chốt snapshot `version.vatMode` THẮNG | ✅ `quote-export.service.spec.ts` +2 test (**mutation-checked**: Mutant `\|\| true` → RED đúng 2 test → revert `cp`) |
| 2 | #3 | **Discount `cho_duyet` chưa test** — điều kiện nhận cả `cho_duyet` lẫn `dong_y` (mirror refreshTotals 4.7) nhưng chỉ `dong_y` có test | Đơn đang chờ duyệt xuất báo giá sẽ MẤT dòng chiết khấu — khác con số khách thấy trên màn (vi phạm "thứ thấy trên màn = thứ in ra giấy"). Mutant xoá nhánh `CHO_DUYET` xanh toàn suite | ✅ `quote-export.service.spec.ts` +1 test (**mutation-checked**: Mutant so sánh 2 lần `DONG_Y` → RED → revert `cp`) |
| 3 | #3 | **Nhánh phòng thủ `customer/version null → 404`** (service L68–71) chưa test nào chạm | Khuôn bài 4.7: nhánh phòng thủ không test = không ai canh — gỡ/đổi throw là crash TypeError thành 500 hoặc sai domain error mà suite vẫn xanh | ✅ `quote-export.service.spec.ts` +1 test cả 2 vế null (**mutation-checked**: Mutant đổi NOT_FOUND→VALIDATION_ERROR 400 → RED; mutant `true \|\|`/`false &&` KHÔNG compile vì TS narrowing — đúng bài "mutant phải compile", đổi dạng mutant) |
| 4 | #1 | **`R2StorageAdapter` ZERO test** — lazy-init, message thiếu env, checksum `WHEN_REQUIRED` ×2, `NoSuchKey → 404` đều là hành vi AC #1 nhưng không spec nào đụng | Gap lớn nhất: 2 dòng checksum là fix bắt buộc cho gotcha SDK ≥3.729.0 (R2 từ chối CRC32 — PutObject fail prod) nhưng chỉ được "bảo vệ" bằng comment; mutant xoá 2 dòng → prod vỡ, suite vẫn xanh | ✅ Suite MỚI `r2-storage.adapter.spec.ts` 7 test, mock toàn bộ `@aws-sdk/client-s3` (**mutation-checked**: xoá 2 dòng checksum → RED đúng test config → revert `cp`, diff byte-identical) |
| 5 | #4 | e2e chưa assert `Content-Disposition` của route GET pdf (ảnh có, pdf không) | Route pdf trả sai/thiếu filename khi tải desktop mà không test nào đỏ | ✅ `orders.e2e.spec.ts` +1 assert trong flow test |
| 6 | #3 | `exportedAt` trong response metadata chưa assert ở đâu | Contract DTO khai `exportedAt` — client hiển thị "xuất lúc nào"; field biến mất/không phải datetime là drift thầm lặng | ✅ `orders.e2e.spec.ts` +1 assert ISO datetime hợp lệ |

**Bài học mutation nảy ra trong phase này:** mutant `true || vatApplies(version.vatMode …)` và
`status === CHO_DUYET && status === DONG_Y` đều KHÔNG compile (TS reset narrowing sau `||` hằng /
TS2367 no-overlap trên union literal) → false RED vô nghĩa. Dạng compile được: đẩy hằng ra SAU
(`… || true`) và lặp cùng một literal (`=== DONG_Y || === DONG_Y`, import thừa không vỡ vì
tsconfig không bật `noUnusedLocals`).

**Không thêm (đã phủ — tránh padding):** happy path payload từng op + thứ tự pipeline
`['render','put','put','write','publish']` + fixture số phân biệt 720k/800k + 0 dòng 400 +
renderer/storage throw dừng đúng bước + totals rule snapshot-vs-settings + getExportFile 404/key/
contentType (unit service); labels mẫu thật + bảo hành 3 dạng + tick scope + format tiền + dòng
chiết khấu điều kiện + escape HTML + costPrice cấm + null không rò (unit template — QA chỉ thêm
nhánh `applyVat: false` label `VAT` trần vào suite này); e2e 401 loop 3 route + 403 thiếu
`quotes.create_edit` + flow đủ POST→GET×2→audit + chưa-xuất 404 + 0 dòng 400 + xuất lần 2 upsert
MỘT row/key không đổi; db-lane spec FK P2003 + unique orderId viết sẵn (chưa chạy — Docker);
UI: 4 widget test mobile đủ (a)–(d) gồm error case, guards (c.2)/(e)/parity 4.8 đã
mutation-checked ở dev phase — không gap. **Không test render Puppeteer thật trong lane** (đã
chạy tay 1 lần ở dev phase — PDF 54.6KB/PNG 92.7KB sạch); lane phải hermetic. **Không test
số học tiền trong template** — template chỉ FORMAT (AD-16), số đúng/sai là việc
`computeOrderTotals` (đã có suite riêng).

## Test theo file

### Unit — `backend/test/quote-export.service.spec.ts` (+4)
- [x] applyVat rule: đơn chưa chốt `vatMode 'khong_vat'` → KHÔNG tính VAT — không `VAT (`, không 800.000 (mutation-checked)
- [x] applyVat rule: snapshot version `khong_vat` THẮNG `Order.vatMode 'co_vat'` — tổng 9.000.000, không 720.000 (mutation-checked)
- [x] totals rule: đơn `choduyet` + approval `cho_duyet` (chưa quyết) → discount VẪN trừ, mirror refreshTotals 4.7 (mutation-checked)
- [x] dữ liệu hỏng: customer HOẶC version null → 404 NOT_FOUND, KHÔNG render/upload (mutation-checked)

### Unit — `backend/test/quote-template.spec.ts` (+1)
- [x] `applyVat: false` → label `VAT` trần (không kèm phần trăm), số 0 + tổng format đúng input

### Unit MỚI — `backend/test/r2-storage.adapter.spec.ts` (+7)
- [x] LAZY init: khởi tạo adapter KHÔNG cần env R2 — không throw, không dựng S3Client
- [x] Thiếu env lúc DÙNG → Error message tiếng Việt liệt kê đủ 4 biến, không gọi SDK
- [x] S3Client config: `region auto` + endpoint env + checksum `WHEN_REQUIRED` ×2 (mutation-checked)
- [x] putObject đúng Bucket/Key/Body/ContentType; client cache — 2 lần dùng vẫn MỘT S3Client
- [x] getObject thành công: Buffer + ContentType, SDK không trả type → `octet-stream`
- [x] getObject `NoSuchKey` → AppException NOT_FOUND 404 (domain error, không rò lỗi SDK)
- [x] getObject HTTP 404 không tên NoSuchKey → vẫn 404; lỗi khác → propagate NGUYÊN

### E2E — `backend/test/orders.e2e.spec.ts` (+2 assert trong flow test)
- [x] `Content-Disposition` route GET pdf chứa `bao-gia-{id8}.pdf`
- [x] `exportedAt` trong metadata POST là ISO datetime hợp lệ

## Coverage sau QA

- AC #1 storage R2 (lazy, env message, checksum gotcha, NoSuchKey→404): **đủ** (QA thêm toàn bộ — trước đó ZERO test)
- AC #2 template + renderer (labels, bảo hành, scope, format, escape, costPrice): **đủ** (thêm nhánh `applyVat: false`; renderer hermetic by design — không test lane, đã render tay)
- AC #3 endpoint xuất + totals resolution + pipeline + event: **đủ** (thêm applyVat 2 chiều, `cho_duyet`, phòng thủ 404, exportedAt)
- AC #4 2 route proxy tải (Content-Type/Disposition, 404, 401/403): **đủ** (thêm disposition pdf)
- AC #5 port + fakes 2 nền tảng: **đủ** (dev phase — parity + guard (c.2))
- AC #6 UI 2 nền tảng: **đủ** (4 widget test mobile gồm error case; web không runtime — text-guard là lớp duy nhất, TD-1 đã biết)
- AC #7 guards + parity + OpenAPI drift: **đủ** (dev phase, mutation-checked 4 mutant)
- AC #8 phạm vi để lại: **N/A** — không code, không test

## Lane

- `cd backend && npm test`: **946/946**, 57 suite, xanh ngay lần đầu (không flake lần chạy này).
- Mobile/design-system: QA phase không đổi file nào ngoài backend test — kết quả dev phase còn
  hiệu lực (mobile 193 + analyze sạch · design-system 290).
- DB lane: Docker Desktop không lên từ shell agent (bài học 4.4–4.7). Spec
  `quote-exports.db.integration.spec.ts` viết sẵn từ dev phase, **CHƯA chạy**.
  Đại Ca bật Docker Desktop rồi `cd backend && npm run test:db`.

## Unresolved

- DB lane story 4.8 chưa chạy (Docker down) — unique `orderId` (upsert 2 lần = 1 row + P2002) + FK P2003 đơn ma trên Postgres thật chờ xác nhận.
- Action item treo từ 4.4: các migration (giờ gồm `20260717040000_add_quote_exports`) chưa `migrate deploy` thật.
- Render Puppeteer thật chỉ mới chạy tay 1 lần (dev phase) — chưa có lane định kỳ; screenshot throw transient 1 lần đã ghi nhận ở Debug Log story.

---

**Cập nhật 2026-07-17 — DB lane đã chạy:** Postgres 18 (container `pns-postgres`) đã dựng, `prisma migrate deploy` áp đủ 4 migration Epic 4, `npm run test:db` **xanh 8 suite / 56 test** (toàn bộ DB integration lane, gồm case của story này). Caveat "chờ Postgres/Docker" ở trên đã được giải quyết.
