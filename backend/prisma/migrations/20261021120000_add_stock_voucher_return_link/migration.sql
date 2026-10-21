-- AlterTable
ALTER TABLE "stock_vouchers" ADD COLUMN     "return_of_voucher_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_vouchers_return_of_voucher_id_key" ON "stock_vouchers"("return_of_voucher_id");

-- AddForeignKey
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_return_of_voucher_id_fkey" FOREIGN KEY ("return_of_voucher_id") REFERENCES "stock_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written CHECK constraint (Prisma does not model CHECK; later `migrate diff` keeps it).
-- A return voucher puts stock back IN and carries no order pair of its own (its order is reached
-- through the origin stock-out), so it never collides with the "one order, one stock-out" unique
-- nor with `stock_vouchers_order_only_xuat`.
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_return_is_stock_in" CHECK ("return_of_voucher_id" IS NULL OR ("type" = 'nhap' AND "order_id" IS NULL AND "order_version_id" IS NULL));
