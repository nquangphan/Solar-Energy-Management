# Test Automation Summary — Story 2.7 (EventBus port + NotificationDispatcher no-op + audit subscriber)

Ngày: 2026-07-09 · QA automation (bmad-qa-generate-e2e-tests) · Framework: **Jest + ts-jest** (đã có sẵn, không đổi).

## Phạm vi

Sinh test bổ sung cho hạ tầng event đã hiện thực (`src/events/*`, `src/audit/*`, `src/notifications/*`). **Chỉ generate test** — không review code, không sửa logic sản phẩm. Toàn bộ test hermetic (mock Prisma/Logger, không Postgres).

Điểm xuất phát: 6 suite của 2.7, coverage **100% stmts / 90% branch**. Vì coverage dòng đã kín, gap thật nằm ở tầng **hành vi & hợp đồng**, không phải dòng code chưa chạy.

## Gap phát hiện & đã tự áp (auto-apply)

| # | Gap | Vị trí | Mức |
|---|-----|--------|-----|
| 1 | **Source-guard `firebase-admin` rỗng ruột**: regex `(?:from\|require\(\s*)` — nhánh `from` **không cho khoảng trắng**, nên `import * as admin from 'firebase-admin'` (dạng phổ biến nhất, Prettier luôn chèn space) **chưa bao giờ bị bắt**. Bare `import 'firebase-admin'` cũng lọt. | `test/no-direct-side-effect-outside-eventbus.spec.ts` | **Cao** |
| 2 | Source-guard không có **positive control** → nếu regex sai hoặc `collectTsFiles` trả rỗng, guard **xanh giả**. Chính test này phát hiện gap #1. | `test/no-direct-side-effect-outside-eventbus.spec.ts` | **Cao** |
| 3 | `firebase-admin` trong `package.json` deps chưa được chặn — source-guard chỉ quét `src/`. Bằng chứng AC-1 "không có `firebase-admin` trong deps". | `test/no-direct-side-effect-outside-eventbus.spec.ts` | Cao |
| 4 | **Cô lập lỗi chưa chứng minh end-to-end**: audit chết (`create` reject) → notification vẫn dispatched, `publish` không sập producer. Trước chỉ có ở unit bus với mock subscriber. | `test/event-bus.integration.spec.ts` | **Cao** |
| 5 | Nhánh `err instanceof Error ? err.stack : String(err)` — subscriber ném **giá trị không phải Error** chưa được phủ (nhánh duy nhất hở, `in-process-event-bus.ts:36`). | `test/in-process-event-bus.spec.ts` | Trung bình |
| 6 | **Nhiều** subscriber cùng ném → lỗi đầu không được dừng vòng fan-out; mỗi lỗi log riêng. Trước chỉ test một subscriber ném. | `test/in-process-event-bus.spec.ts` | Trung bình |
| 7 | Hợp đồng **fan-out tuần tự** (`await` lần lượt, không `Promise.all`) chưa được khoá — đổi sang song song sẽ đổi ngữ nghĩa audit↔notification mà không test nào đỏ. | `test/in-process-event-bus.spec.ts` | Trung bình |
| 8 | `AuditService.record` **nuốt lỗi hay ném lại?** Hợp đồng: ném lại để `InProcessEventBus` cô lập + log. Chưa assert. | `test/audit.service.spec.ts` | Trung bình |
| 9 | `AuditSubscriber.handle` propagate lỗi từ `record` — cùng lý do #8. | `test/audit.subscriber.spec.ts` | Trung bình |
| 10 | Tổ hợp **có `target` nhưng không `actor`** (system auto-transition tác động đối tượng) chưa test — trước chỉ có "đủ cả 5 chiều" và "không actor không target". | `test/audit.service.spec.ts` | Trung bình |
| 11 | `before`/`after` **falsy hợp lệ** (`false`, `0`) không được bỏ — chỉ `undefined` mới bỏ field. Chặn regression nếu ai refactor `=== undefined` sang `\|\|`. | `test/audit.service.spec.ts` | Thấp |
| 12 | `NotificationDispatcher.handle` trả về **đồng bộ** (không Promise ⇒ không có công việc async/mạng ngầm) và không log error/warn — bằng chứng "no-op thuần" (AC-1). | `test/notification-dispatcher.spec.ts` | Thấp |
| 13 | Integration suite phụ thuộc thứ tự (mock `create` dùng chung, `beforeAll`) → thêm `beforeEach` reset + `afterEach` restore để test độc lập. | `test/event-bus.integration.spec.ts` | Thấp |

**Gap #1 là lỗi thật, đã sửa** (file test): regex thành `/(?:from\s*|require\(\s*|import\s+)['"]firebase-admin['"]/`, phủ cả 3 lối vào SDK. Guard rule (a) trước đó chỉ chặn được dạng `require(...)`.

## Test đã sinh

### Unit
- [x] `test/in-process-event-bus.spec.ts` (+3) — subscriber ném non-Error → `String(err)`; nhiều subscriber cùng ném → mỗi lỗi log riêng, tất cả vẫn được gọi; fan-out tuần tự theo thứ tự đăng ký.
- [x] `test/audit.service.spec.ts` (+3) — system event có `target` không `actor`; `before`/`after` falsy không bị bỏ; `create` lỗi → `record` ném lại.
- [x] `test/audit.subscriber.spec.ts` (+1) — `record` lỗi → `handle` ném lại (không nuốt).
- [x] `test/notification-dispatcher.spec.ts` (+1) — `handle` đồng bộ, không log error/warn (no-op thuần).

### Source-guard (AD-18)
- [x] `test/no-direct-side-effect-outside-eventbus.spec.ts` (+3) — anti-vacuous (guard thực sự quét file); positive control (bắt vi phạm mô phỏng, không false-positive trên comment); `firebase-admin` chưa có trong deps.

### Integration
- [x] `test/event-bus.integration.spec.ts` (+1) — audit ghi lỗi → notification vẫn dispatched, `publish` không reject (cô lập lỗi trên wiring thật, không mock bus).

## Coverage

- `src/events/`, `src/audit/`, `src/notifications/`: **100% stmts · 100% branch · 100% funcs · 100% lines** (trước: 90% branch — hở `in-process-event-bus.ts:36`).
- AC-1 (port duy nhất + dispatcher no-op): fan-out, cô lập lỗi, no-op/log, deps sạch `firebase-admin`.
- AC-2 (AuditLog append-only, 5 chiều): map đủ chiều · 3 tổ hợp actor/target · không `update`/`delete`/`upsert` · lỗi DB không bị nuốt.
- AC-3 (thay dispatcher không mở lại code): producer chỉ inject `EventBus` · cô lập lỗi end-to-end · source-guard chặn inject consumer trực tiếp.

## Kết quả chạy

- 6 suite của 2.7: **26 test xanh** (13 → 26, +13 gồm 1 test sửa regex).
- Toàn backend: `jest` → **146/146 xanh**, 26 suite (trước 134) — **0 regression**.
- `eslint` + `prettier --check "test/**/*.ts"`: **sạch**.
- **Không đụng `src/`** → `openapi.json`/`permissions.json` không đổi; `openapi-drift` + `permissions-drift` xanh không regen.

## Finding chưa áp (cần quyết định — KHÔNG viết test hợp thức hoá hành vi sai)

**`AuditService.record({ before: null })` sẽ lỗi runtime.** `toJsonInput` ép `null as Prisma.InputJsonValue`, bỏ qua type-check. Kiểm chứng bằng `tsc`:

```
Type 'null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.
```

Prisma yêu cầu `Prisma.JsonNull` (JSON null) hoặc `Prisma.DbNull` (cột NULL) cho field `Json?` — `null` trần bị validator từ chối. Điều này **trái với comment** trong `audit.service.ts:38` ("`null` giữ nguyên (JSON null hợp lệ)") và Task 3 của story.

Chưa có producer thật nào truyền `before: null` (concrete event thuộc E4–E7), nên **chưa nổ**. Test mock Prisma **không thể** bắt lỗi này (mock nhận mọi thứ). Sửa là **thay đổi code sản phẩm**, ngoài phạm vi workflow generate-test → chuyển cho code review / story sở hữu producer đầu tiên (E4).

Hai lựa chọn khi xử lý: (a) map `null` → `Prisma.JsonNull` trong `toJsonInput`; (b) cấm `null` ở contract `DomainEvent` (chỉ cho `undefined`). Kèm test integration Postgres thật để bắt loại lỗi validator này.

## Next steps

- Integration ghi `audit_logs` thật trên Postgres (đọc lại xác minh cột + bắt lỗi validator `Json?`) — hoãn tới khi có DB, theo chiến lược test Dev Notes.
- Xử lý finding `before: null` ở E4 khi có producer đầu tiên.
- Khi Epic 9 lắp FCM: gỡ test "`firebase-admin` chưa nằm trong dependencies" (đó là assertion ranh giới, không phải bất biến vĩnh viễn).
