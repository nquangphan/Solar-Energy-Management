# Phương Nam Solar — Backend (NestJS)

Backend API — **chủ sở hữu DB duy nhất** (AD-1) và toàn bộ business logic. Web (React) + Mobile (Flutter) chỉ gọi REST, không chạm DB.

Story 2.1 dựng **skeleton hạ tầng**: bootstrap NestJS + `PrismaModule`/`PrismaService` + pipeline OpenAPI-sinh-từ-code + convention + một endpoint `GET /health`. Tính năng nghiệp vụ thuộc story sau.

## Stack

- Node.js **24 LTS** (`engines` pin `>=24 <25`) · NestJS **11.x** · Prisma **7.8.0** · PostgreSQL **18.x**

## Cài đặt

```bash
cd backend
npm install
cp .env.example .env      # điền DATABASE_URL thật (KHÔNG commit .env)
npm run prisma:generate
```

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run start:dev` | Chạy dev (watch) |
| `npm run build` / `npm run start:prod` | Build & chạy production |
| `npm run lint` / `npm run format` | Lint & format |
| `npm test` | Jest (e2e health + wiring + source-guard + OpenAPI drift-guard) |
| `npm run openapi:gen` | Sinh `openapi/openapi.json` từ code (không cần server/DB) |
| `npm run prisma:migrate:dev` | Tạo/chạy migration (migration đầu land cùng model đầu tiên ở Story 2.4) |

## Ranh giới (đọc `CONVENTIONS.md`)

- Chỉ `PrismaService` chạm DB — không `new PrismaClient()` nơi khác (source-guard enforce).
- `openapi/openapi.json` là artifact **sinh tự động — CẤM SỬA TAY**; đổi contract = sửa code rồi `npm run openapi:gen`.
- Skeleton chưa có model Prisma nào (YAGNI) — model + migration đầu tiên ở Story 2.4.
