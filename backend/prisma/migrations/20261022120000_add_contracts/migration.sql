-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_version_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "pdf_key" TEXT NOT NULL,
    "pdf_size" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "created_by_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_seq_key" ON "contracts"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_no_key" ON "contracts"("contract_no");

-- CreateIndex
CREATE INDEX "contracts_order_id_idx" ON "contracts"("order_id");

-- CreateIndex
CREATE INDEX "contracts_order_version_id_idx" ON "contracts"("order_version_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_order_version_id_fkey" FOREIGN KEY ("order_version_id") REFERENCES "order_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;




-- Hand-written CHECK constraints (Prisma does not model CHECK; later `migrate diff` keeps them).
-- A contract is one of the two company templates, and its PDF always has bytes.
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_type_known" CHECK ("type" IN ('construction', 'sale'));
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_pdf_size_positive" CHECK ("pdf_size" > 0);
