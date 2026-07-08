---
baseline_commit: 74a56b637e30766294c84ca7cf0d5ba4b07a85d6
---

# Story 2.1: Skeleton backend + Prisma + OpenAPI sinh-từ-code

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên backend**,
I want **skeleton NestJS + PostgreSQL (Prisma) với OpenAPI sinh tự động từ code**,
so that **có nền chung và một hợp đồng API duy nhất cho web + mobile**.

## Acceptance Criteria

1. **Given** yêu cầu chủ sở hữu DB duy nhất, **When** dựng backend, **Then** chỉ `prisma/PrismaService` truy cập DB, chỉ backend giữ credential DB, client không có đường chạm DB (AD-1).
2. **Given** API REST, **When** build, **Then** OpenAPI spec được **SINH TỪ code** NestJS như build artifact, versioned + publish; cấm sửa tay spec; web và mobile đều sinh/validate client từ spec này (AD-12).
3. **Given** convention dự án, **When** đặt tên, **Then** entity PascalCase, bảng snake_case số nhiều, file kebab-case, route danh từ số nhiều + action nghiệp vụ là POST sub-resource; tiền là integer đồng; ngày ISO-8601 UTC.

## Tasks / Subtasks

- [x] **Task 1 — Khởi tạo repo backend NestJS (AC: 1, 2, 3)**
  - [x] Tạo thư mục `backend/` MỚI ở gốc repo (đây là client thứ 3, tách biệt web/mobile — project-context "3 client tách biệt"). Init NestJS 11.x app trên Node 24 LTS.
  - [x] `package.json`: pin **Node 24 LTS** qua `"engines": { "node": ">=24 <25" }` (tiền lệ design-system pin Node — obs 14255). Pin `@nestjs/*` 11.x, `prisma`/`@prisma/client` 7.8.0, `@nestjs/swagger` tương thích Nest 11.
  - [x] `src/main.ts`: bootstrap app, bật `ValidationPipe` global (`whitelist: true`, `transform: true`) để DTO validate — nền cho contract-first (AC-2). Đọc `PORT` từ env, mặc định an toàn.
  - [x] `src/app.module.ts`: root module import `PrismaModule` (Task 2) + `HealthModule` (Task 4). **KHÔNG** import module domain (accounts/orders/…) — chúng thuộc story sở hữu (xem Ranh giới phạm vi).
  - [x] `.gitignore` backend: `node_modules/`, `dist/`, `.env`, `.env.*` (KHÔNG commit `.env` — project-context "Không commit secret/.env/khoá").
- [x] **Task 2 — Prisma là điểm truy cập DB DUY NHẤT (AC: 1)**
  - [x] `prisma/schema.prisma`: chỉ khai `datasource db { provider = "postgresql" }` + `generator client`. **CHƯA khai entity nào** — model đầu tiên (`Account`) thuộc Story 2.4; đừng bịa entity ở skeleton (YAGNI). [Cập nhật: Prisma 7 bỏ `url` khỏi schema → connection URL khai ở `prisma.config.ts`; runtime dùng driver adapter `@prisma/adapter-pg`. Xem Completion Notes.]
  - [x] `src/prisma/prisma.service.ts`: `PrismaService extends PrismaClient implements OnModuleInit` → `onModuleInit(){ await this.$connect() }`. Đây là **nơi DUY NHẤT** mở kết nối DB (AD-1). Constructor truyền `PrismaPg` adapter (Prisma 7).
  - [x] `src/prisma/prisma.module.ts`: `@Global()` module export `PrismaService` để mọi module domain sau inject **cùng một** instance — không module nào tự tạo client riêng (chống nhiều nguồn kết nối/sự thật).
  - [x] `.env.example` (commit) khai `DATABASE_URL=postgresql://...` dạng placeholder; `.env` thật (gitignored) chứa credential. Chỉ backend giữ credential DB — web/mobile KHÔNG có biến này.
  - [x] Thiết lập lệnh migrate (`prisma migrate dev`/`deploy`) trong `package.json` scripts. **CHƯA chạy migration tạo bảng** ở story này (không có model) — migration đầu tiên land cùng Story 2.4. Ghi rõ trong Dev Notes.
- [x] **Task 3 — Convention đặt tên + lint/format (AC: 3)**
  - [x] ESLint (flat config) + Prettier cho TS backend (project-context "Lint/format bắt buộc"). Cấu hình + script `lint`, `format`, `format:check`.
  - [x] Tạo `backend/CONVENTIONS.md` ghi verbatim quy ước: entity **PascalCase** · bảng **snake_case số nhiều** (`accounts`, `order_line_items`) · file **kebab-case** (`prisma.service.ts`) · route **danh từ số nhiều kebab-case**, action nghiệp vụ = **POST sub-resource** (`/orders/{id}/chot`) · ID **UUID v4** (trừ `Customer` PK = SĐT E.164) · tiền **integer đồng** · ngày **ISO-8601 UTC**. Đây là hợp đồng cho mọi story backend sau. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
  - [x] Cấu hình Prisma `@@map`/`@map` convention (khi thêm model ở story sau): entity Prisma PascalCase → `@@map("<snake_case_plural>")`. Ghi mẫu trong CONVENTIONS.md (không tạo model ở đây).
- [x] **Task 4 — Endpoint health chứng minh skeleton + cho spec ≥1 path (AC: 1, 2)**
  - [x] `src/health/health.controller.ts`: `GET /health` trả trạng thái app; ping DB qua `PrismaService.$queryRaw\`SELECT 1\`` để chứng minh wiring AD-1 (client→backend→Prisma→DB) hoạt động. Đây là endpoint hạ tầng (không phải resource nghiệp vụ) nên `GET /health` là hợp lệ, không vi phạm quy ước danh từ số nhiều.
  - [x] Gắn DTO/`@ApiResponse` (`@ApiOkResponse` + `HealthResponseDto`) cho health để OpenAPI có schema thật (không path rỗng) — làm mẫu contract-first cho story sau.
  - [x] **KHÔNG** thêm endpoint nghiệp vụ nào khác (auth, /me… thuộc story sau).
- [x] **Task 5 — OpenAPI sinh-TỪ-code như build artifact (AC: 2)**
  - [x] Dùng `@nestjs/swagger` (`DocumentBuilder` + `SwaggerModule.createDocument`) build OpenAPI document **từ chính code controller/DTO** — code là chân lý, spec là output (AD-12).
  - [x] Script standalone `scripts/generate-openapi.ts` (chạy qua `npm run openapi:gen`): boot app-context (Nest testing module, override Prisma → không cần DB), `createDocument`, ghi ra artifact versioned `openapi/openapi.json` (đường dẫn cross-repo để web+mobile gen client). **Không** cần server/DB chạy để gen.
  - [x] Set `version` của OpenAPI doc = version backend (`package.json`) → spec versioned (AC-2 "versioned").
  - [x] Ghi rõ trong CONVENTIONS.md + `info.description` của `openapi.json`: **FILE SINH TỰ ĐỘNG — CẤM SỬA TAY**; đổi contract = sửa code rồi `npm run openapi:gen` (AD-12). (JSON không cho comment đầu file → nhúng cảnh báo vào `info.description` + CONVENTIONS.md.) Mirror triết lý drift-guard của Epic 1.
- [x] **Task 6 — Test skeleton (AC: 1, 2)**
  - [x] e2e (`supertest` + Nest testing) cho `GET /health`: trả 200 + shape mong đợi; chứng minh ping DB qua Prisma. Test hermetic (stub Prisma → không cần PostgreSQL trong CI); kết nối DB thật kiểm ở boot production qua `onModuleInit.$connect`.
  - [x] Unit/wiring test: `PrismaModule` là `@Global`, `PrismaService` inject được; source-guard cấm khởi tạo PrismaClient trực tiếp ngoài `PrismaService` (mirror source-guard Epic 1, quét trên code đã strip comment để triệt false-positive).
  - [x] **Drift-guard OpenAPI:** test regen document in-memory và assert output **khớp byte-for-byte** với `openapi/openapi.json` đã commit → nếu ai sửa tay spec hoặc quên regen, test fail (AC-2 "cấm sửa tay"). Mirror drift-guard byte-for-byte của design-system (obs 14245/14252).
  - [x] Chạy `npm run lint` + `npm test` sạch (backend có tooling thật — Node/Nest/Jest — khác web chưa có runtime; chạy test thật, không chỉ text-guard). Kết quả: lint sạch, 6/6 test pass, build ok.

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

- Story này **CHỈ** dựng **skeleton hạ tầng** backend: bootstrap NestJS + `PrismaModule`/`PrismaService` + pipeline OpenAPI-sinh-từ-code + convention đặt tên/lint + **một** endpoint `GET /health` để chứng minh wiring và cho spec ≥1 path. **Không** giao tính năng nghiệp vụ.
- **Ngoài phạm vi (thuộc story khác — ĐỪNG làm ở đây):**
  - **Error envelope + exception filter trung tâm (AD-5)** → **Story 2.2**. Skeleton chỉ bật `ValidationPipe`; đừng dựng envelope/filter global ở đây (2.2 sở hữu shape lỗi + interceptor FE).
  - **Đăng nhập JWT access+refresh, `auth/`** → **Story 2.3**.
  - **Permission registry chính tắc + entity `Account`/`AccountPermission`, migration đầu** → **Story 2.4** (migration tạo bảng land cùng model đầu tiên ở đây).
  - **`/me` + guard quyền server-side mỗi request** → **Story 2.5**.
  - **EventBus port + NotificationDispatcher no-op + audit subscriber** → **Story 2.7**.
  - **Storage R2 (`storage/`), domain module orders/customers/catalog/…** → epic/story tương ứng (không tạo folder rỗng đầu cơ — tạo khi story sở hữu chúng cần).
- **Nhưng:** skeleton phải **thiết kế để mở rộng** đúng cây module NestJS trong spine (`common/ auth/ accounts/ orders/ …`) — đặt `PrismaModule` `@Global` để mọi domain sau inject chung; đặt convention `@@map` sẵn để model sau tuân. **Không** hiện thực các domain đó ở 2.1.

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-1 — Backend là chủ DB DUY NHẤT:** chỉ `prisma/PrismaService` chạm DB; chỉ backend giữ credential (`DATABASE_URL` trong `.env` gitignored). Web/mobile KHÔNG có đường/biến chạm DB. Cấm module domain tự `new PrismaClient()`. [Source: ARCHITECTURE-SPINE.md#AD-1]
- **AD-12 — REST + OpenAPI sinh-từ-code, spec là build artifact:** code NestJS là **chân lý**; `openapi.json` là **output sinh tự động**, versioned + publish, là **hợp đồng cross-repo DUY NHẤT** cho CẢ web LẪN mobile gen/validate client. **CẤM sửa tay spec** — đổi contract = sửa DTO/controller rồi regen. [Source: ARCHITECTURE-SPINE.md#AD-12, epics.md#Additional Requirements]
- **Layered client-server (4 tầng):** API (controller/DTO/OpenAPI) → Application (service) → Domain (rule thuần) → Infrastructure (`prisma/`, `storage/`, `auth/`). Domain KHÔNG phụ thuộc Infrastructure; phụ thuộc chảy vào trong. Skeleton đặt `prisma/` ở Infrastructure + `health/` ở API. [Source: ARCHITECTURE-SPINE.md#Design Paradigm]
- **Contract-first, KHÔNG đoán mò:** BE định nghĩa DTO request/response + error shape **trước** khi code → publish qua OpenAPI → FE gen client có type. Skeleton làm mẫu bằng DTO/`@ApiResponse` cho `/health` + bật `ValidationPipe`. [Source: project-context.md#API Contract]
- **Không nhét business logic vào skeleton:** health/prisma là hạ tầng; pricing/VAT/transition/permission là các domain story sau (AD-2/6/11/16). Đừng lôi rule nghiệp vụ vào 2.1.

### Convention đặt tên (AC-3) — hợp đồng cho mọi story backend

| Concern | Quy ước |
|---|---|
| Entity | PascalCase (`Order`, `OrderLineItem`) |
| Bảng DB | snake_case số nhiều (`orders`, `order_line_items`) — Prisma `@@map` |
| File | kebab-case (`prisma.service.ts`, `allowed-transition.ts`) |
| REST route | danh từ số nhiều kebab-case; action nghiệp vụ = **POST sub-resource** (`/orders/{id}/chot`) |
| ID | UUID v4 mọi entity — **trừ** `Customer` (PK = SĐT chuẩn hoá E.164, chỉ chuẩn hoá ở backend `customers`, AD-9) |
| Tiền | **integer đồng** — không float/decimal (AD-10) |
| Ngày giờ | ISO-8601 UTC lưu DB; client hiển thị UTC+7 |

[Source: ARCHITECTURE-SPINE.md#Consistency Conventions, project-context.md#Coding style]

### Quyết định thiết kế được khuyến nghị

- **OpenAPI gen qua script app-context (không cần server chạy):** `@nestjs/swagger` `SwaggerModule.createDocument(app, config)` chạy được trên `NestFactory.create` mà không `listen()`. Script `generate-openapi.ts` boot context → tạo document → ghi `openapi/openapi.json` → thoát. Cho phép gen trong CI/pre-commit và cho drift-guard so byte-for-byte. Đây là cách hiện thực AC-2 "sinh từ code như build artifact".
- **Drift-guard thay vì tin tay:** Epic 1 chứng minh guard byte-for-byte bắt được output cũ/sửa tay (obs 14245/14252/14284). Áp cùng pattern cho `openapi.json`: test regen in-memory rồi so với file commit. Rẻ, chặn "sửa tay spec" ở CI thay vì review thủ công.
- **Prisma schema tối giản ở skeleton:** chỉ datasource+generator, chưa model. Lý do: model là dữ liệu sở hữu bởi domain story (Account=2.4, Order=4.1…); tạo model đầu cơ ở 2.1 vi phạm YAGNI + "mỗi story tạo CHỈ entity nó cần" (project-context#Workflow). Migration tạo bảng thật đi cùng model đầu tiên (2.4). Health ping bằng `$queryRaw SELECT 1` — không cần bảng.
- **Health ping DB (không chỉ app-alive):** ping DB chứng minh chuỗi wiring AD-1 end-to-end ngay từ story đầu, thay vì để lỗi cấu hình Prisma trồi lên ở 2.4. Là e2e endpoint "quan trọng" đầu tiên.

### Tình trạng nền tảng hiện tại (scout-before-code)

- **CHƯA có `backend/`** trong repo — story này tạo mới toàn bộ (đã xác minh: không có `backend/`, `api/`, `server/`). Không có code backend để tái dùng/đè.
- Repo hiện có: `design-system/` (SSOT token/icon + generator zero-dep), `web/src/` (React `.tsx`, **chưa** có tsc/bundler/runtime), `mobile/` (Flutter thật, có `flutter test`). Backend là client thứ 3 độc lập — **không** đụng `web/`, `mobile/`, `design-system/` ở story này.
- **Tiền lệ generated-artifact + drift-guard** đã có ở `design-system/` (`build-tokens.mjs`/`build-icons.mjs` + test byte-for-byte). Backend OpenAPI gen nên **mirror triết lý** đó (output sinh tự động, cấm sửa tay, guard byte-for-byte) — không phát minh pattern mới. [Source: project-context.md#Design-system SSOT, obs 14244/14245]
- **Node/Nest/Jest chạy thật trong môi trường backend** — khác `web/` (chỉ text-guard). Chạy `npm test`/`npm run lint` thật, kỳ vọng correctness runtime, không dừng ở guard tĩnh.

### Tra cứu kỹ thuật mới (pin version — tránh lệch)

- **Node 24 LTS** (Active LTS) — pin qua `engines`. **NestJS 11.1.27**, **Prisma 7.8.0** (`[ASSUMPTION]` trong spine — nếu 7.8.0 chưa phát hành lúc code, dùng bản 7.x ổn định gần nhất và ghi lại trong Completion Notes). **PostgreSQL 18.4**. [Source: ARCHITECTURE-SPINE.md#Stack]
- Prisma 7.x: kiểm generator client mới (`prisma-client` vs `prisma-client-js`) + vị trí output; theo mặc định ổn định, tránh cấu hình preview không cần.
- `@nestjs/swagger` phải khớp major Nest 11 — dùng bản tương thích để `createDocument` API đúng chữ ký.
- Không tải phụ thuộc ngoài phạm vi skeleton (không thêm auth/jwt/passport/config-nặng ở 2.1 — thuộc story sau).

### Project Structure Notes

- Cây module mục tiêu (spine) — story 2.1 chỉ tạo phần **in đậm**, còn lại để story sở hữu tạo sau:
  - `backend/src/` → **`prisma/`** (PrismaService/Module), **`health/`** (health controller + DTO), `common/`(2.2), `auth/`(2.3), `accounts/`(2.4), `orders/`(E4)…
  - `backend/prisma/schema.prisma` (datasource+generator, chưa model)
  - `backend/openapi/openapi.json` (**artifact sinh tự động**)
  - `backend/scripts/generate-openapi.ts`
- **Biến thể có chủ đích:** spine vẽ `common/` cho exception filter — story 2.1 **không** tạo `common/` (không có filter để chứa); 2.2 tạo. Tránh folder rỗng đầu cơ.
- Đường dẫn `openapi/openapi.json` là điểm cross-repo để web/mobile gen client ở story sau (2.6 nối UI, và mỗi story endpoint sẽ regen). Ghi đường dẫn này vào CONVENTIONS.md.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — 3 AC verbatim (chủ DB duy nhất; OpenAPI sinh-từ-code build artifact versioned cấm sửa tay; convention đặt tên/tiền/ngày).
- [Source: ARCHITECTURE-SPINE.md#AD-1] — chỉ `prisma/PrismaService` chạm DB; chỉ backend giữ credential.
- [Source: ARCHITECTURE-SPINE.md#AD-12] — OpenAPI sinh từ code, build artifact versioned+publish, hợp đồng cross-repo duy nhất web+mobile, cấm sửa tay; JWT access+refresh (auth ở 2.3).
- [Source: ARCHITECTURE-SPINE.md#Design Paradigm] — 4 tầng backend (API/Application/Domain/Infrastructure) + quy tắc phụ thuộc chảy vào trong.
- [Source: ARCHITECTURE-SPINE.md#Backend module tree] — cây module đích (`prisma/`, `common/`, `auth/`, domain…).
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions + #Stack] — quy ước đặt tên/tiền/ngày; version Node 24 / Nest 11.1.27 / Prisma 7.8.0 / PG 18.4.
- [Source: _bmad-output/project-context.md] — bất biến AD (client không chạm DB/không business logic), contract-first, coding style/lint, SSOT+generator+drift-guard (mirror cho OpenAPI), không commit `.env`/secret, build-order Epic 2 = nền tảng.
- [Source: _bmad-output/planning-artifacts/epics.md#NFR-1, NFR-6, NFR-10] — độ tin cậy/idempotent tiền (nền cho story sau), auth JWT (2.3), solo-dev ưu tiên đơn giản (chọn skeleton tối giản).
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-07-08.md] — action item "đưa web tooling (tsc+bundler+test runtime) vào scope 2.1" (xem Open Questions — mâu thuẫn build-order backend-only, để chủ dự án quyết).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story workflow)

### Debug Log References

- `prisma generate` ban đầu fail (P1012): Prisma 7 bỏ `url` khỏi `datasource` trong schema. Fix: chuyển connection URL sang `prisma.config.ts` (`datasource.url = env("DATABASE_URL")`) + runtime dùng driver adapter `@prisma/adapter-pg`; datasource block trong schema chỉ còn `provider`.
- `openapi:gen` fail ENOENT: thư mục `openapi/` chưa tồn tại. Fix: `mkdirSync(dirname, { recursive: true })` trước khi ghi.
- Source-guard fail (false-positive): docstring của `prisma.service.ts` chứa nguyên văn chuỗi bị cấm. Fix: strip comment trước khi quét (hiện thực action-item retro Epic 1) — code thật mới tính.
- Wiring test `toBeInstanceOf` fail: PrismaClient 7 trả về proxy → `instanceof` không tin cậy. Fix: assert `constructor.name` + API kế thừa (`$queryRaw`/`$connect`).

### Completion Notes List

- **AC-1 (chủ DB duy nhất):** `PrismaService` (Infrastructure) là điểm truy cập DB duy nhất; `PrismaModule` `@Global` cấp chung một instance. Source-guard test (`no-manual-prisma-client.spec.ts`) fail nếu có khởi tạo PrismaClient trực tiếp ngoài `PrismaService`. Credential DB chỉ ở `.env` (gitignored, đã xác minh `git check-ignore`); `.env.example` là placeholder; không client nào có biến DB.
- **AC-2 (OpenAPI sinh-từ-code, build artifact, cấm sửa tay):** `npm run openapi:gen` sinh `backend/openapi/openapi.json` TỪ code (DocumentBuilder + `createDocument`), version = `package.json` version (`0.1.0`) → versioned. App-context boot qua Nest testing module (override Prisma) nên **không cần server/DB** để gen. Drift-guard test so byte-for-byte artifact-vs-code (`openapi-drift.spec.ts`). Cảnh báo "CẤM SỬA TAY" nhúng trong `info.description` + CONVENTIONS.md (JSON không hỗ trợ comment đầu file).
- **AC-3 (convention):** `CONVENTIONS.md` ghi verbatim quy ước đặt tên/tiền/ngày + mẫu Prisma `@@map`. ESLint (flat config) + Prettier cấu hình, `npm run lint`/`format:check` sạch.
- **Prisma 7.8.0 (giải Open Question #2):** bản 7.8.0 đã phát hành và dùng được — KHÔNG cần fallback 7.x. Nhưng Prisma 7 đổi kiến trúc lớn (bỏ engine Rust mặc định → driver adapter): thêm `@prisma/adapter-pg` (bundle `pg`) + `dotenv` (nạp `.env` cho CLI qua `prisma.config.ts`). Đây là sai khác so với mô tả story (giả định pattern Prisma cũ `url` trong schema) — đã thích ứng, ghi lại đầy đủ. Web/mobile KHÔNG bị ảnh hưởng (chỉ backend).
- **Chưa có model/migration:** `schema.prisma` chỉ datasource+generator (YAGNI). CHƯA chạy `prisma migrate` (không có bảng để tạo); migration đầu land cùng model đầu tiên (Story 2.4). Health ping bằng `$queryRaw SELECT 1` — không cần bảng.
- **Test hermetic:** e2e/health + drift-guard override `PrismaService` bằng stub nên chạy xanh không cần PostgreSQL (CI-friendly). Kết nối DB thật được kiểm ở boot production (`onModuleInit.$connect`). 6/6 test pass, lint sạch, `nest build` ok.
- **Open Question #1 (web tooling vào 2.1):** giữ scope backend theo AC + spine (thêm web tooling sẽ mâu thuẫn AC backend-only). Action item retro Epic 1 vẫn open — đề xuất tách thành nhiệm vụ Epic 2 riêng (trước 2.6). Cần chủ dự án chốt; KHÔNG chặn 2.1.
- **Open Question #3 (vị trí artifact):** dùng `backend/openapi/openapi.json` theo đề xuất story. Chốt lại trước khi Story 2.6 gen client nếu muốn publish nơi khác.
- **Lockfile:** `package-lock.json` KHÔNG commit theo convention repo (root `.gitignore` ignore lockfile; design-system cũng không commit) — giữ nguyên convention.

### File List

Tất cả đường dẫn tương đối gốc repo. Toàn bộ là file MỚI (backend chưa tồn tại trước story này).

**Config / tooling**
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/tsconfig.build.json`
- `backend/nest-cli.json`
- `backend/eslint.config.mjs`
- `backend/.prettierrc`
- `backend/.gitignore`
- `backend/.env.example`
- `backend/prisma.config.ts`

**Prisma (Infrastructure)**
- `backend/prisma/schema.prisma`
- `backend/src/prisma/prisma.service.ts`
- `backend/src/prisma/prisma.module.ts`

**App / Health (API)**
- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/src/health/health.controller.ts`
- `backend/src/health/health.module.ts`
- `backend/src/health/dto/health-response.dto.ts`

**OpenAPI (build artifact)**
- `backend/src/openapi/openapi-document.ts`
- `backend/scripts/openapi-app-context.ts`
- `backend/scripts/generate-openapi.ts`
- `backend/openapi/openapi.json` (SINH TỰ ĐỘNG — commit như artifact)

**Docs**
- `backend/README.md`
- `backend/CONVENTIONS.md`

**Tests**
- `backend/test/health.spec.ts`
- `backend/test/prisma-wiring.spec.ts`
- `backend/test/no-manual-prisma-client.spec.ts`
- `backend/test/openapi-drift.spec.ts`

**Sprint tracking (cho phép sửa)**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-1 → in-progress → review)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Dựng skeleton backend NestJS: `PrismaModule`/`PrismaService` (điểm truy cập DB duy nhất, AD-1, driver adapter Prisma 7), `GET /health` (DTO + ping DB), pipeline OpenAPI-sinh-từ-code + artifact `openapi/openapi.json` (AD-12), CONVENTIONS.md + ESLint/Prettier (AC-3), test skeleton (e2e health + wiring + source-guard + drift-guard byte-for-byte). 6/6 test pass, lint/format sạch, build ok. Prisma 7.8.0 thích ứng kiến trúc driver-adapter mới. |

## Open Questions

1. **Web tooling vào scope 2.1?** Retro Epic 1 mở action item (owner Winston+Amelia): "Đưa web tooling (tsc+bundler+test runtime) vào scope Story 2.1; typecheck toàn bộ .tsx tích luỹ từ Epic 1". **Mâu thuẫn** với AC của 2.1 (backend-only) + build-order (2.1 = backend skeleton). Story này **giữ scope backend** theo AC + spine. Đề xuất: tách web tooling thành story/nhiệm vụ riêng của Epic 2 (vd trước 2.6 "nối UI gating"), không nhồi vào 2.1. **Cần chủ dự án xác nhận** trước khi dev bắt đầu 2.1, hoặc chấp nhận đề xuất tách.
2. **Prisma 7.8.0 phát hành?** Spine đánh dấu `[ASSUMPTION]`. Nếu bản này chưa có lúc code, dùng 7.x ổn định gần nhất và ghi lại — không chặn skeleton.
3. **Vị trí artifact OpenAPI dùng chung cross-repo:** `backend/openapi/openapi.json` (đề xuất). Nếu muốn publish ra nơi web/mobile pull dễ hơn (vd `_bmad-output/` hay package riêng), chốt trước khi 2.6 gen client.
