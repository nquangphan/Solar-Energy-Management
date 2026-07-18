-- AlterTable
ALTER TABLE "order_versions" ADD COLUMN     "created_by_account_id" TEXT;

-- AddForeignKey
ALTER TABLE "order_versions" ADD CONSTRAINT "order_versions_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

