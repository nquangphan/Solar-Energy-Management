-- Nhật ký kiểm toán BẤT BIẾN, append-only (AD-8). CHỉ thêm bảng mới `audit_logs`;
-- KHÔNG đụng `accounts`/`sessions`/`account_permissions` (đã có từ migration trước).
-- `actor_account_id` lưu String KHÔNG FK cascade để bản ghi lịch sử sống sót khi account
-- bị vô hiệu/xoá — audit là snapshot bất biến. Sinh offline (không Postgres cục bộ) bằng
-- `prisma migrate diff --from-schema <prev> --to-schema` — mirror chiến lược migration 2.3/2.4.

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_account_id" TEXT,
    "target_type" TEXT,
    "target_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actor_account_id_idx" ON "audit_logs"("actor_account_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");
