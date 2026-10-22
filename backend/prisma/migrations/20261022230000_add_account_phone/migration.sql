-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");
