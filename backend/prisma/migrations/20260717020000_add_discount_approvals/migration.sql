-- AlterTable
ALTER TABLE "order_versions" ADD COLUMN     "discount_amount" INTEGER;

-- CreateTable
CREATE TABLE "discount_approvals" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_version_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "request_note" TEXT,
    "resolve_note" TEXT,
    "requested_by_account_id" TEXT NOT NULL,
    "resolved_by_account_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discount_approvals_status_idx" ON "discount_approvals"("status");

-- CreateIndex
CREATE INDEX "discount_approvals_order_id_idx" ON "discount_approvals"("order_id");

-- AddForeignKey
ALTER TABLE "discount_approvals" ADD CONSTRAINT "discount_approvals_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_approvals" ADD CONSTRAINT "discount_approvals_order_version_id_fkey" FOREIGN KEY ("order_version_id") REFERENCES "order_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_approvals" ADD CONSTRAINT "discount_approvals_requested_by_account_id_fkey" FOREIGN KEY ("requested_by_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_approvals" ADD CONSTRAINT "discount_approvals_resolved_by_account_id_fkey" FOREIGN KEY ("resolved_by_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

