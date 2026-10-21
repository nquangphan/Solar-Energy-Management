-- AlterTable
ALTER TABLE "stock_vouchers" ADD COLUMN     "order_id" TEXT,
ADD COLUMN     "order_version_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_vouchers_order_id_order_version_id_key" ON "stock_vouchers"("order_id", "order_version_id");

-- AddForeignKey
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_order_version_id_fkey" FOREIGN KEY ("order_version_id") REFERENCES "order_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written CHECK constraints (Prisma does not model CHECK; later `migrate diff` keeps them).
-- An order-bound voucher needs the FULL pair (order, current version): with half of it the
-- "one order, one stock-out" unique catches nothing (Postgres treats NULLs as distinct).
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_order_pair" CHECK (("order_id" IS NULL) = ("order_version_id" IS NULL));

-- Only STOCK-OUTS are order-bound; a return voucher (on cancellation) gets its own link later.
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_order_only_xuat" CHECK ("order_id" IS NULL OR "type" = 'xuat');
