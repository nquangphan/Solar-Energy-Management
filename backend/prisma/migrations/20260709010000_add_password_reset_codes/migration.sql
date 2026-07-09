-- Mã đặt lại mật khẩu: lưu HASH của mã (argon2id), không bao giờ lưu mã thô. CHỉ thêm bảng
-- mới `password_reset_codes`; KHÔNG đụng `accounts`/`sessions`/`account_permissions`/`audit_logs`
-- (đã có từ migration trước). An toàn của mã entropy thấp dựa vào `expires_at` (TTL ngắn),
-- `consumed_at` (single-use) và `attempt_count` (trần số lần thử) — mọi tra cứu đi theo
-- `account_id`, không theo hash. Sinh offline (không Postgres cục bộ) bằng
-- `prisma migrate diff --from-schema <prev> --to-schema` — mirror chiến lược migration 2.3/2.4/2.7.

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_codes_account_id_idx" ON "password_reset_codes"("account_id");

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
