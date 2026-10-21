-- CreateTable
CREATE TABLE "stock_vouchers" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "created_by_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_voucher_lines" (
    "id" TEXT NOT NULL,
    "stock_voucher_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_cost" INTEGER NOT NULL,

    CONSTRAINT "stock_voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_vouchers_seq_key" ON "stock_vouchers"("seq");

-- CreateIndex
CREATE INDEX "stock_vouchers_created_at_idx" ON "stock_vouchers"("created_at");

-- CreateIndex
CREATE INDEX "stock_voucher_lines_product_id_idx" ON "stock_voucher_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_voucher_lines_stock_voucher_id_product_id_key" ON "stock_voucher_lines"("stock_voucher_id", "product_id");

-- AddForeignKey
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_voucher_lines" ADD CONSTRAINT "stock_voucher_lines_stock_voucher_id_fkey" FOREIGN KEY ("stock_voucher_id") REFERENCES "stock_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_voucher_lines" ADD CONSTRAINT "stock_voucher_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Ràng buộc CHECK thêm tay (Prisma không mô hình hoá CHECK; `migrate diff` sau này không xoá).
-- Tồn thật không bao giờ âm — lưới cuối dưới lớp kiểm "xuất quá tồn" của service.
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_on_hand_non_negative" CHECK ("on_hand" >= 0);

-- Số lượng dòng phiếu luôn dương; chiều cộng/trừ do `stock_vouchers.type` quyết.
ALTER TABLE "stock_voucher_lines" ADD CONSTRAINT "stock_voucher_lines_qty_positive" CHECK ("qty" > 0);

ALTER TABLE "stock_voucher_lines" ADD CONSTRAINT "stock_voucher_lines_unit_cost_non_negative" CHECK ("unit_cost" >= 0);
