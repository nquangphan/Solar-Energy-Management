# Build, test và CI

> Flow `build-ci`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow build-ci` in ra đúng danh sách đó.

## Mục đích

Gom cấu hình build, lint, format, typecheck và test của ba package Node (`backend/`, `web/`, `design-system/`)
và package Flutter (`mobile/`), cùng workflow GitHub Actions `.github/workflows/ci.yml` chạy 5 lane test
trong 4 job. Mỗi lane bắt một loại lỗi mà lane khác không thấy (comment đầu `ci.yml`, bài học retro Epic 3):

| Lane | Bắt được |
|------|----------|
| backend hermetic | logic thuần, source-guard kiến trúc, drift guard `openapi.json`/`permissions.json` |
| backend DB (`test:db`) | unique/FK/CHECK, `FOR UPDATE`, idempotency trên Postgres thật |
| design-system | drift/parity token, icon, component, guard tiền |
| web | `.tsx` sai kiểu/cú pháp, màn không render, className không có CSS, bundle hỏng |
| mobile | lỗi analyze, màn/widget Flutter không render |

Người dùng: mọi dev và agent trước khi push. Lệnh chi tiết của backend: [`backend/README.md`](../../backend/README.md);
quy trình test: `_bmad-output/project-context.md` (mục Testing).

## Điểm vào

- GitHub Actions: workflow `CI` chỉ có trigger `workflow_dispatch`, tức là chỉ chạy khi bấm tay ở tab Actions.
  Tự chạy theo push/PR bị tắt theo quyết định chủ dự án ngày 2026-10-21; bật lại bằng cách thêm
  `push: { branches: [main] }` và `pull_request:` (ghi trong `ci.yml`).
- Vì CI không tự chạy, cổng thật là chạy đủ 5 lane trên máy trước mỗi push (theo `project-context.md`):
  `cd backend && npm test`, `cd backend && npm run test:db`, `cd design-system && npm test`,
  `cd web && npm run typecheck && npm test && npm run build`, `cd mobile && flutter analyze && flutter test`.

## Các bước

Workflow `.github/workflows/ci.yml`, 4 job chạy song song trên `ubuntu-latest`:

1. Job `backend` ("Backend (hermetic + DB lane)"), service `postgres:18` (biến `POSTGRES_USER`,
   `POSTGRES_PASSWORD`, `POSTGRES_DB`, cổng 5432, health check `pg_isready`). Dùng `actions/checkout@v4`,
   `actions/setup-node@v4` với `node-version: 24`, cache npm theo `backend/package-lock.json`. Các step, tất cả
   với `working-directory: backend`:
   1. `npm ci`
   2. `npx prisma generate`
   3. `npm run lint` → `eslint .`
   4. `npm run format:check` → `prettier --check "src/**/*.ts" "test/**/*.ts" "scripts/**/*.ts"`
   5. `npm run build` → `nest build`
   6. Lane hermetic: `npm test` → `jest` (không có `DATABASE_URL`).
   7. Lane DB, `DATABASE_URL` chỉ đặt ở ba step này (không đặt cho cả job): `npx prisma migrate deploy`,
      `npx prisma db seed`, `npm run test:db` →
      `node -r dotenv/config node_modules/.bin/jest --runInBand --testPathIgnorePatterns=/node_modules/ --testRegex "\.db\.integration\.spec\.ts$"`.
2. Job `design-system` ("Design-system (drift + parity guards)"): `setup-node` 24, không cài dependency
   (guard chỉ đọc file của `web/` và `mobile/`, dùng `node:test` có sẵn); step `npm test` →
   `node --test "**/*.test.mjs"`.
3. Job `web` ("Web (typecheck + JSDOM render + build)"): `setup-node` 24, cache theo `web/package-lock.json`;
   `npm ci`, `npm run typecheck` → `tsc --noEmit`, `npm test` → `vitest run`, `npm run build` → `vite build`.
4. Job `mobile` ("Mobile (analyze + widget test)"): `subosito/flutter-action@v2` kênh `stable`;
   `flutter pub get`, `flutter analyze`, `flutter test`.

Hai lane backend tách nhau bằng cấu hình Jest trong `backend/package.json`: `npm test` có
`testPathIgnorePatterns: ["/node_modules/", "\\.db\\.integration\\.spec\\.ts$"]`, còn `test:db` ghi đè
`--testPathIgnorePatterns` và đổi `--testRegex` để chỉ chạy `*.db.integration.spec.ts`. Các spec DB còn tự
skip khi vắng `DATABASE_URL` (đó là ý comment "lane DB tự skip" trong `ci.yml`), nhưng khi biến này có mặt
trong môi trường thì chỉ `testPathIgnorePatterns` giữ `npm test` hermetic.

## Bất biến

| Bất biến | Nơi enforce |
|----------|-------------|
| Mọi file `.ts`/`.tsx` dưới `web/src` parse được bằng compiler TypeScript; quét ít nhất 50 file và có file `.tsx` | `backend/test/web-source-parses.spec.ts` (chạy trong lane backend hermetic) |
| `npm test` của backend không chạy `*.db.integration.spec.ts` | `testPathIgnorePatterns` trong `backend/package.json`; `ci.yml` không đặt `DATABASE_URL` cho step đó |
| Code backend build được chỉ từ `src/` (không kéo `test/`, `scripts/`, `prisma/`) | `backend/tsconfig.build.json` (`exclude`), step `npm run build` |
| Web strict typecheck, không biến/tham số thừa | `web/tsconfig.json` (`strict`, `noUnusedLocals`, `noUnusedParameters`), step `npm run typecheck` |
| Vitest xử lý CSS thật (guard className đọc stylesheet qua `?raw`) | `web/vite.config.ts` (`css: true`) |
| `design-system/` không có dependency nào (generator và guard chỉ dùng Node built-in) | `design-system/package.json` không có `dependencies`; job CI không chạy `npm ci` |
| Phiên bản Node 24 | `engines` trong ba `package.json` (`backend`: `>=24 <25`; `web`, `design-system`: `>=24`), `node-version: 24` trong CI |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `.github/workflows/ci.yml` | Workflow `CI`, 4 job / 5 lane, chỉ `workflow_dispatch` | job `backend`, `design-system`, `web`, `mobile` |
| `backend/package.json` | Package `phuong-nam-solar-backend` 0.1.0: script, dependency, cấu hình Jest, `prisma.seed` | script `build`, `start`, `start:dev`, `start:prod`, `lint`, `format`, `format:check`, `test`, `test:db`, `openapi:gen`, `permissions:gen`, `prisma:generate`, `prisma:migrate:dev`, `prisma:migrate:deploy` |
| `backend/tsconfig.json` | TS cho backend + test + scripts + prisma: `commonjs`, `ES2023`, decorator metadata, `strict` | `compilerOptions`, `include` |
| `backend/tsconfig.build.json` | Kế thừa `tsconfig.json`, loại `test`, `scripts`, `prisma`, `prisma.config.ts`, `**/*.spec.ts` khỏi build | `exclude` |
| `backend/nest-cli.json` | Nest CLI: `sourceRoot: src`, `deleteOutDir: true` | — |
| `backend/eslint.config.mjs` | ESLint flat config: `@eslint/js` + `typescript-eslint` recommended + `eslint-plugin-prettier/recommended`; bỏ qua `dist/`, `node_modules/`, `openapi/`, `coverage/`; `no-explicit-any`, `no-floating-promises`, `no-unsafe-argument` ở mức `warn` | `tseslint.config(...)` |
| `backend/.prettierrc` | Prettier: `singleQuote`, `trailingComma: all` | — |
| `design-system/package.json` | Package `@pns/design-tokens`, ESM, không dependency | script `build`, `build:tokens`, `build:icons`, `build:permissions`, `test` |
| `web/package.json` | Package `@pns/web`: React 19.2.7; dev: TypeScript 6.0.3, Vite 8.1.6, Vitest 4.1.12, jsdom, Testing Library (phiên bản ghim cứng) | script `typecheck`, `build`, `test` |
| `web/tsconfig.json` | TS web: `ES2022`, `moduleResolution: bundler`, `jsx: react-jsx`, `verbatimModuleSyntax`, `noEmit`, `include: ["src"]` | `compilerOptions` |
| `web/vite.config.ts` | Vite + plugin React; Vitest `environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`, `css: true` | `defineConfig` |
| `web/index.html` | Trang SPA (`lang="vi"`, `#root`), nạp `/src/main.tsx` | — |
| `mobile/pubspec.yaml` | Package `pns_mobile` 0.1.0, SDK `>=3.4.0 <4.0.0`; dependency `flutter_svg`, `image_picker`, `share_plus`; dev `flutter_test`, `flutter_lints` | — |
| `mobile/analysis_options.yaml` | `include: package:flutter_lints/flutter.yaml` | — |

## Dữ liệu

- Bảng: flow này không đọc/ghi bảng nghiệp vụ. Lane DB của CI dựng Postgres 18 tạm, áp toàn bộ migration
  (`prisma migrate deploy`) và seed (`prisma db seed`). CI không đặt `SEED_ADMIN_*` nên seed chỉ tạo danh mục
  nguồn khách, bỏ qua account admin.
- Sự kiện: không có.
- Gọi ngoài: GitHub Actions runner, image Docker `postgres:18`, registry npm (`npm ci`), pub.dev
  (`flutter pub get`). Không lane nào gọi R2 hay dịch vụ thật khác: test backend chạy hermetic.

## Flow liên quan

- backend-platform: lane backend chạy các guard của flow đó (`openapi-drift`, `no-manual-prisma-client`, …) và chuỗi migrate/seed của Prisma.
- design-system: job `design-system` chạy text guard `design-system/**/*.test.mjs`; job `web` chạy `screens-render` và `css-class-coverage`; job `mobile` chạy widget test design system.
- accounts-permissions: drift guard `permissions.json` chạy trong lane backend; key quyền sinh ra kiểm ở lane design-system.
- orders, inventory, catalog, customers, system-settings: các ca `backend/test/*.db.integration.spec.ts` (khoá dòng, CHECK, unique) của các flow này chỉ chạy ở lane DB.

## Tests

| Loại | Test | Kiểm tra |
|------|------|----------|
| Source-guard cú pháp (lane backend) | `backend/test/web-source-parses.spec.ts` | Đọc đệ quy `web/src`, `ts.createSourceFile` từng file `.ts`/`.tsx`, gom `parseDiagnostics`; ca chống guard rỗng (≥50 file, có `.tsx`); ca không file nào lỗi cú pháp |

Các test khác do CI chạy thuộc flow riêng của chúng; flow này chỉ sở hữu cấu hình chạy chúng.

## Giới hạn đã biết

- CI không tự chạy. Một PR có thể merge mà không lane nào chạy trên server; cổng là kỷ luật chạy tay.
- Comment đầu `web-source-parses.spec.ts` vẫn ghi "web chưa có tsc (TD-1)". Từ 2026-10-21 web đã có `tsc`, Vitest
  và Vite (`npm run typecheck` bắt cả lỗi cú pháp lẫn lỗi kiểu); guard này nay trùng một phần với lane web nhưng
  vẫn chạy, và là lớp duy nhất bắt lỗi cú pháp web khi chỉ chạy lane backend.
- `format:check` chỉ quét `src/`, `test/`, `scripts/`; `prisma/seed.ts` và `prisma.config.ts` chỉ được Prettier
  kiểm qua `eslint .` (plugin prettier).
- Web chưa có ESLint/Prettier; mobile chỉ có `flutter_lints` mặc định.
- Không có ngưỡng coverage; `collectCoverageFrom` trong `backend/package.json` chỉ khai phạm vi.
- CI không chạy `openapi:gen`, `permissions:gen` hay generator design-system. File sinh cũ bị bắt bởi drift guard
  (đỏ), không được tự sinh lại.
- `mobile/` chưa có `main.dart`, `android/`, `ios/`: lane mobile chỉ analyze + widget test, không build app.
