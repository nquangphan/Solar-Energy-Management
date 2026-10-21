-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_version_id" TEXT NOT NULL,
    "customer_sdt" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_tax_code" TEXT,
    "customer_address" TEXT,
    "seller_legal_name" TEXT NOT NULL,
    "seller_tax_code" TEXT NOT NULL,
    "seller_address" TEXT NOT NULL,
    "seller_representative" TEXT NOT NULL,
    "seller_representative_title" TEXT NOT NULL,
    "seller_phone" TEXT NOT NULL,
    "seller_bank_account" TEXT NOT NULL,
    "vat_rate" INTEGER NOT NULL,
    "apply_vat" BOOLEAN NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "discount_amount" BIGINT NOT NULL,
    "vat_amount" BIGINT NOT NULL,
    "total" BIGINT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "created_by_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_seq_key" ON "invoices"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_version_id_key" ON "invoices"("order_version_id");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_display_order_key" ON "invoice_lines"("invoice_id", "display_order");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_version_id_fkey" FOREIGN KEY ("order_version_id") REFERENCES "order_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written CHECK constraints (Prisma does not model CHECK; later `migrate diff` keeps them).
-- The stored totals are the resolver's output: never negative, and the grand total is always
-- subtotal - discount + VAT. Every order-line write path enforces qty >= 1 (DTO @Min(1); a
-- revise copies existing lines), so an invoice line copied from one is always positive.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amounts_nonneg" CHECK ("subtotal" >= 0 AND "discount_amount" >= 0 AND "vat_amount" >= 0 AND "total" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_total_consistent" CHECK ("total" = "subtotal" - "discount_amount" + "vat_amount");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vat_rate_range" CHECK ("vat_rate" >= 0 AND "vat_rate" <= 100);
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_amount_nonneg" CHECK ("amount" >= 0);
