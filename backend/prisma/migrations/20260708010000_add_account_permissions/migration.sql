-- Story 2.4: lưu quyền per-account (AD-8). CHỈ thêm bảng join `account_permissions`;
-- KHÔNG đụng `accounts`/`sessions` (đã có từ migration đầu 20260708000000).
-- Sinh offline (không Postgres cục bộ) bằng `prisma migrate diff --from-empty
-- --to-schema` rồi tách delta bảng mới — mirror chiến lược Story 2.3.

-- CreateTable
CREATE TABLE "account_permissions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_permissions_account_id_idx" ON "account_permissions"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_permissions_account_id_permission_key" ON "account_permissions"("account_id", "permission");

-- AddForeignKey
ALTER TABLE "account_permissions" ADD CONSTRAINT "account_permissions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
