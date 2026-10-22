# Test Automation Summary — Story 10.9 (Đăng nhập bằng số điện thoại)

**Workflow:** bmad-qa-generate-e2e-tests · **Ngày:** 2026-10-22 · **Người chạy:** Đại Ca
**Framework:** backend Jest + supertest (hermetic, `AuthService`/`PasswordResetService` THẬT) · web Vitest + Testing Library
**Kết quả:** backend 123 suite / **2547** xanh (2536 → 2547) · web 37 file / **447** xanh (446 → 447) · eslint 2 spec sửa sạch

## Phạm vi

Dev đã phủ phần lớn AC (5 lane, 12 mutant đỏ). QA rà từng AC dẫn xuất với test hiện có, chỉ thêm ca cho chỗ còn trống. Không sửa code sản phẩm.

## Gap phát hiện & auto-apply (+12 ca)

| # | AC | Gap | Đã vá |
|---|----|-----|-------|
| 1 | AC 8 | Không có assert TRỰC TIẾP rằng 3 DTO request có `phone` bắt buộc và KHÔNG có `email` trong spec. Chỉ drift byte-for-byte đứng canh: nếu regen cùng lúc thì drift vẫn xanh, client Dart sinh `"email": null` ⇒ mọi lần đăng nhập mobile 400 | ✅ `backend/test/openapi-drift.spec.ts` `it.each` 3 DTO (+3) |
| 2 | AC 7/8 | `MeResponseDto.phone` `type: string` + `nullable: true` chưa được assert trên spec | ✅ `openapi-drift.spec.ts` (+1) |
| 3 | AC 2 / biên | Dạng `84912345678` (không `+`) và `0912.345.678` chỉ được phủ ở unit `accountPhoneOrThrow`, chưa chạy qua e2e | ✅ `backend/test/auth-phone.e2e.spec.ts` mở rộng `it.each` login (+2) |
| 4 | AC 3 / biên | Số nước ngoài `+1…` ⇒ 400 không tra: chỉ có ở unit | ✅ `auth-phone.e2e.spec.ts` (+1) |
| 5 | Biên "số cố định hợp lệ ⇒ 401 chứ không 400" | Chưa có ca nào. Nếu ai siết helper thành chỉ nhận di động thì hợp đồng âm thầm đổi | ✅ `auth-phone.e2e.spec.ts` (+1, assert tra `+842838221234`) |
| 6 | Biên `@MaxLength(32)` | Chưa có ca e2e nào cho chuỗi quá dài | ✅ `auth-phone.e2e.spec.ts` (+1) |
| 7 | AC 6 (reset) | `reset-password` số rác ⇒ 400 `fieldErrors.phone` chưa có ca chạy service thật; chưa chứng minh không tra account, không tra mã | ✅ `auth-phone.e2e.spec.ts` (+1) |
| 8 | AC 6 (reset) | `reset-password` tra theo E.164 (cùng chuẩn hoá) chưa được đo | ✅ `auth-phone.e2e.spec.ts` (+1) |
| 9 | AC 11 / D10 | Web bước 2 Quên mật khẩu: chưa đo `resetPassword` nhận đúng SĐT thô đã trim, cũng chưa đo `fieldErrors.phone` ở bước 2 vẫn rơi về MỘT câu chung | ✅ `web/src/test/forgot-password-screen.test.tsx` (+1) |

## Mutation (cp backup, đã khôi phục — `cmp` khớp)

| Mutant | Kết quả |
|---|---|
| `LoginRequestDto.email` `@ApiHideProperty()` → `@ApiPropertyOptional()` | 🔴 ca mới "never exposes email" đỏ (1/3, đúng DTO bị đổi) |
| `PasswordResetService.reset` tra chuỗi thô (bỏ `accountPhoneOrThrow`) | 🔴 2 ca reset mới đỏ |

## Test theo file

### API / e2e (backend)
- [x] `backend/test/auth-phone.e2e.spec.ts` — login nhiều dạng số, số nước ngoài, số cố định, quá dài; reset số rác + tra E.164
- [x] `backend/test/openapi-drift.spec.ts` — hợp đồng spec 3 DTO auth + `MeResponseDto.phone`

### UI (web)
- [x] `web/src/test/forgot-password-screen.test.tsx` — bước 2 gửi SĐT thô, lỗi chỉ có một câu chung

## Coverage theo AC (sau QA)

| AC | Phủ |
|---|---|
| 1, 10 Migration/unique | lane DB `account-phone.db.integration.spec.ts` (dev) |
| 2 Login nhiều dạng | e2e service thật: 4 dạng |
| 3 Số rác/rỗng/thiếu | e2e: `abc`, `+1…`, 33 ký tự, rỗng, thiếu, mảng |
| 4 `email` trong body | e2e login (chuỗi + null), forgot, reset (dev) |
| 5 Bốn nhánh 401 | e2e envelope bằng nhau (dev) + số cố định (QA) |
| 6 Forgot/reset | e2e: body trung tính, publish 1 lần, reset 401 chung, reset 400 rác, tra E.164 |
| 7 `/me` phone | `me.e2e.spec.ts` (dev) + spec nullable (QA) |
| 8 OpenAPI | drift + assert trực tiếp `phone`/vắng `email` (QA) |
| 9 Seed | chạy tay (dev) — seed không có test harness |
| 11 Web | vitest login + forgot cả 2 bước |
| 12 Mobile | widget test login/forgot (dev) — không thấy gap |
| 13 Guard design-system | dev (mutation e1–e3) |
| 14 Smoke | dev đã chạy web + emulator |

API endpoint auth đổi định danh: 3/3 · Màn UI đổi: web 2/2, mobile 2/2.

## Kết quả chạy

- `backend: npm test` → 123/123 suite, 2547/2547
- `web: npm test` → 37/37 file, 447/447
- `npx eslint` trên 2 spec backend sửa → sạch (đã `--fix` prettier phần thêm)
- Không chạy lại: `test:db`, design-system, mobile — không đụng file nào của các lane đó

## Bước tiếp theo

- Code review story 10.9.

## Câu hỏi tồn đọng

- Seed (AC 9) vẫn chỉ được kiểm tay; chưa có harness test cho `prisma/seed.ts`. Không thêm trong QA vì phải tách hàm khỏi script, tức là sửa code sản phẩm.
