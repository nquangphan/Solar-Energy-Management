# Test Automation Summary — Story 2.3 (Đăng nhập JWT access+refresh)

Ngày: 2026-07-08 · QA automation (bmad-qa-generate-e2e-tests) · Framework: **Jest + ts-jest + supertest** (đã có sẵn, không đổi).

## Phạm vi

Sinh test bổ sung cho tính năng **auth** đã hiện thực (`src/auth/*`, `src/accounts/*`). Chỉ generate test — không review code, không sửa logic sản phẩm.

## Gap phát hiện & đã tự áp (auto-apply)

| # | Gap | Vị trí | Mức |
|---|-----|--------|-----|
| 1 | `auth.config.ts` (`durationToSeconds` + `loadAuthConfig`) — parser TTL có nhánh **throw**, trước đó **0 coverage** | `test/auth.config.spec.ts` (mới) | Cao |
| 2 | `POST /auth/logout` DTO validation (`400 VALIDATION_ERROR`) chưa được kiểm — logout là route auth duy nhất chưa assert validation | `test/auth.e2e.spec.ts` | Trung bình |
| 3 | Chống enumeration: email lạ **vẫn** gọi `verify` với dummy argon2 hash (cân bằng timing) — bất biến bảo mật AC-1, chưa assert | `test/auth.service.spec.ts` | Trung bình |
| 4 | Refresh rotate phát refresh token **mới thật sự** (hash khác hash cũ) — bất biến AC-2, trước chỉ assert một phần | `test/auth.service.spec.ts` | Trung bình |

**Không áp:** `main.ts` fail-fast `JWT_ACCESS_SECRET` — guard inline nhỏ, gắn chặt `NestFactory.create`; test cần tách bootstrap (ngoài phạm vi, KISS). Ghi nhận, chưa test.

## Test đã sinh

### Unit / API
- [x] `test/auth.config.spec.ts` — parser TTL: đơn vị hợp lệ (s/m/h/d), trim, **7 nhánh định dạng sai → throw**; `loadAuthConfig` mặc định + đọc env + fallback.
- [x] `test/auth.service.spec.ts` (+2) — dummy-hash timing chống enumeration; rotate phát refresh token mới.
- [x] `test/auth.e2e.spec.ts` (+1) — `POST /auth/logout` body sai → `400 VALIDATION_ERROR`, không gọi service.

## Coverage (route/hành vi auth)

- Endpoint `/auth/*`: **3/3** (login, refresh, logout) — happy path + validation 400 + envelope 401.
- Nhánh `AuthService`: login đúng/sai (3 nhánh fail, cùng message) · refresh rotate/revoked/expired/not-found · logout idempotent · **dummy-hash timing** · **rotate token mới**.
- `auth.config`: parser TTL + loader env (mới phủ toàn bộ).

## Kết quả chạy

- Auth suite: **36 test xanh** (17 → 36, +19).
- Toàn backend: `jest` → **61/61 xanh**, 10 suite.
- `eslint` + `prettier --check` trên file test đã sửa: **sạch**.

## Next steps

- Integration login→refresh→logout trên Postgres thật vẫn hoãn tới khi có DB (theo chiến lược test Dev Notes — không để suite fail vì thiếu DB).
- Cân nhắc test fail-fast secret khi tách được bootstrap check khỏi `main.ts`.
