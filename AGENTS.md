# AGENTS.md

Hướng dẫn cho agent (và người) làm việc trong repo này.

## Đọc trước tiên

1. Đọc `docs/index.md` TRƯỚC khi đọc code.
2. Tìm flow liên quan: `crew-docs where <file>` cho biết file thuộc flow nào, `crew-docs flow <id>` liệt kê
   đúng các file của một flow.
3. Đọc `docs/flows/<id>.md` của flow đó, rồi mới mở các file nó liệt kê.

Luật nghiệp vụ và kiến trúc chi tiết: `_bmad-output/project-context.md` (bất biến AD-1..21, gotcha),
`backend/CONVENTIONS.md` (quy ước backend), spine kiến trúc
`_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`.

## Lệnh

Repo có bốn phần độc lập, mỗi phần cài và chạy trong thư mục của nó; không có `package.json` ở gốc.
Node.js 24 (`engines` của backend ghim `>=24 <25`), Flutter SDK cho `mobile/`.

### Backend (`backend/`, NestJS + Prisma)

- Cài đặt: `cd backend && npm install` (CI dùng `npm ci`), `cp .env.example .env` rồi điền giá trị thật
  (KHÔNG commit `.env`), `npm run prisma:generate`.
- Chạy: `npm run start:dev` (watch). DB local: `npm run prisma:migrate:deploy` rồi `npx prisma db seed`.
- Build: `npm run build` (chạy bản build: `npm run start:prod`).
- Test:
  - `npm test`: lane hermetic (Jest, mock Prisma, không cần Postgres); chạy một file: `npx jest test/<tên>.spec.ts`.
  - `npm run test:db`: lane DB, mọi `*.db.integration.spec.ts`, cần Postgres thật và `DATABASE_URL`
    (máy dev: container `pns-postgres` cổng 5433). `npm test` KHÔNG chạy nhóm này.
- Lint: `npm run lint` (ESLint), `npm run format:check` (Prettier, không ghi file); `npm run format` để ghi.
  Lưu ý: tại commit docs-init (21-10-2026) cả hai lệnh đã đỏ sẵn (ESLint 157 error, Prettier 25 file).
  Đo baseline trên code chưa sửa trước khi nhận lỗi là do mình.
- Sinh artifact (cấm sửa tay kết quả): `npm run openapi:gen` → `openapi/openapi.json`,
  `npm run permissions:gen` → `openapi/permissions.json`.

### Web (`web/`, React 19 + Vite)

- Cài đặt: `cd web && npm ci`.
- Build: `npm run build` (vite build).
- Test: `npm test` (Vitest + jsdom); chạy một file: `npm test -- src/test/<tên>.test.tsx`.
- Lint: không có script lint; kiểm tĩnh là `npm run typecheck` (`tsc --noEmit`, strict).

### Design system (`design-system/`, generator + guard, không có dependency)

- Cài đặt: không cần (`node --test` có sẵn trong Node 24).
- Build (sinh lại output web + mobile từ SSOT): `cd design-system && npm run build`; từng phần:
  `npm run build:tokens`, `npm run build:icons`, `npm run build:permissions`.
- Test: `npm test` (mọi `**/*.test.mjs`); chạy một file: `node --test screens/<tên>.test.mjs`.
- Lint: không có; chính các guard trong `npm test` là lớp kiểm tra.

### Mobile (`mobile/`, Flutter)

- Cài đặt: `cd mobile && flutter pub get`. Máy của chủ dự án có Flutter 3.35.0 qua fvm
  (`~/fvm/versions/3.35.0/bin`) khi `flutter` không có trong PATH.
- Build: chưa có app chạy được (chưa có `main.dart`, `android/`, `ios/`); `mobile/` hiện chỉ là thư viện
  widget, màn và port, kiểm bằng analyze + widget test.
- Test: `flutter test`; chạy một file: `flutter test test/<đường dẫn>_test.dart`.
- Lint: `flutter analyze`; kiểm format không ghi file: `dart format --output=none --set-exit-if-changed lib test`
  (tại commit docs-init: 27 file chưa đúng format). `dart format` thiếu `--output=none` sẽ GHI file.

### CI

`.github/workflows/ci.yml` chạy đủ năm lane (backend hermetic + DB, design-system, web, mobile) nhưng chỉ
chạy tay (`workflow_dispatch`, theo quyết định của chủ dự án ngày 21-10-2026). Trước mỗi push, chạy trên máy
các lane mà thay đổi chạm tới. `.github/workflows/crew-docs.yml` (sinh bởi `crew-docs ci-workflow`, kèm bundle
`.github/crew-docs/crew-docs.cjs`) tự chạy ở mọi push và pull request: `check --range` rồi `check --all`.

## Quy ước

Chung:

- Code (tên biến/hàm/class/file, comment, tên test, log, commit message) viết tiếng Anh; chỉ chuỗi hiển thị
  cho người dùng viết tiếng Việt. Contract API MỚI (route, field DTO, method port) cũng tiếng Anh; route/field
  tiếng Việt có sẵn (`/orders/:id/chot`, `/huy`, `/tra-cuu-bao-hanh`…) giữ nguyên tới khi refactor riêng.
  Tài liệu (`docs/`, story) viết tiếng Việt.
- Commit theo Conventional Commits, tiếng Anh. Không commit secret, `.env`, khoá. Repo chưa có `.gitignore`:
  `.env`, `node_modules/`, `dist/` hiện ra là untracked, nên chỉ `git add` đúng file mình sửa.
- Tiền là số nguyên đồng (không float). Client không tự tính tiền/thuế/tồn: luôn hiển thị số backend trả.
- Quyền chỉ lấy từ registry `backend/src/accounts/domain/permission-registry.ts`, không viết literal quyền ở
  chỗ khác. Ẩn/disable UI theo quyền chỉ là UX; backend enforce mọi request.

Backend (`backend/CONVENTIONS.md` là bản đầy đủ):

- Module NestJS theo domain trong `backend/src/<domain>/`; logic thuần nằm ở `<domain>/domain/` (không import
  Nest/Prisma), DTO ở `<domain>/dto/`. File và route kebab-case, entity PascalCase, bảng snake_case số nhiều
  qua `@@map`, ID UUID v4 (riêng `Customer` có PK là SĐT E.164).
- Chỉ `PrismaService` chạm DB. Chỉ `AllExceptionsFilter` dựng error envelope; code nghiệp vụ ném
  `AppException(ErrorCode.X, status, message)`.
- Mọi handler không `@Public()` phải khai `@RequirePermissions`, `@RequireAnyPermissions` hoặc
  `@AuthenticatedOnly()`. Phạm vi dữ liệu do service kiểm (ngoài phạm vi ⇒ 404).
- Hành động nghiệp vụ publish domain event qua `EventBus` sau commit; không gọi audit/notification trực tiếp.
- Chỉ `applyTransition()` đổi `Order.status`. Thứ tự khoá: `orders` FOR UPDATE trước, rồi `products`
  `ORDER BY id FOR UPDATE`. Khoá mới cần một ca `*.db.integration.spec.ts` ép interleaving.
- Đổi DTO/controller ⇒ chạy `npm run openapi:gen`; đổi registry quyền ⇒ `npm run permissions:gen` rồi
  `cd design-system && npm run build:permissions`. Drift-guard so byte-for-byte với file đã commit.
- Source-guard kiến trúc ở `backend/test/no-*.spec.ts`; guard mới phải có assert chống guard-rỗng.

Web (`web/src/`):

- React function component + hook. Mọi màn dùng component/token của `web/src/design-system/`, không style
  ad-hoc. Mỗi màn có một stylesheet cạnh nó.
- Màn gọi backend qua port trong `web/src/design-system/session/*-port.ts` (kèm fake port cho test/demo);
  chưa có router và HTTP client thật, `web/src/main.tsx` chỉ là shell demo đăng nhập.
- Hiển thị tiền chỉ qua `<Money>`/`formatVnd`; cấm `toLocaleString`/`Intl` và in số tiền thô.
- Màn mới phải có ca render trong `web/src/test/screens-render.test.tsx`; mọi className tĩnh phải có rule CSS.

Mobile (`mobile/lib/`):

- Widget trong `mobile/lib/design_system/`, màn trong `mobile/lib/screens/<miền>/`, transport qua port tiêm
  trong `mobile/lib/design_system/session/` (kèm fake port). Quyền dùng `AppPermissionKeys` sinh tự động.
- Hiển thị tiền chỉ qua `MoneyText`/`formatVnd`. Lint theo `analysis_options.yaml` (`flutter_lints`).
- Màn mới cần widget test trong `mobile/test/screens/`.

Design system (`design-system/`):

- `tokens/design-tokens.json`, `icons/icons.json` và `backend/openapi/permissions.json` là nguồn; generator
  sinh `web/src/design-system/{tokens,icons}/*`, `gating/permission-keys.generated.ts` và các file Dart tương
  ứng. Không sửa tay file sinh (dòng đầu ghi `GENERATED`): sửa nguồn rồi `npm run build`.
- Guard dạng text quét toàn văn file nguồn web/mobile: tránh viết chuỗi bị cấm (`shadow`, `gradient`,
  `box-shadow:`, `.toUpperCase()`…) kể cả trong comment.

## Docs đi cùng mỗi lần push

- Mỗi lần push hoặc merge, nếu tập commit đổi file nguồn thì phải có commit (trong cùng lần đó) sửa
  `docs/flows/<id>.md` của mọi flow chứa file đó (luật R3). Từng commit riêng lẻ không cần tự sửa docs.
- File nguồn mới phải có mặt trong một flow của `docs/flows.yaml` (luật R2).
- Sửa `docs/flows.yaml` xong thì chạy `crew-docs generate`.
- Không sửa `.claude/**`, `.githooks/**`, `CLAUDE.md`, `AGENTS.md` (file này) hay các mục `source`, `shared`,
  `unassigned` của `docs/flows.yaml` khi ticket không được chủ dự án cho phép (luật R6).
- Không bao giờ commit credential (luật R7).
- Pre-commit chỉ chặn credential (`crew-docs check --staged`, R7). Kiểm docs trước khi push:
  `crew-docs check --range <base>..HEAD`.
