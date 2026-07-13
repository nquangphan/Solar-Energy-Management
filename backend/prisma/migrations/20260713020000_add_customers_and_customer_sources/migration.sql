-- CreateTable
CREATE TABLE "customer_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "is_other" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "sdt" TEXT NOT NULL,
    "cust_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cccd" TEXT,
    "tax_code" TEXT,
    "address" TEXT,
    "bank_account" TEXT,
    "source_id" TEXT NOT NULL,
    "source_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("sdt")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_sources_name_key" ON "customer_sources"("name");

-- CreateIndex
CREATE INDEX "customers_source_id_idx" ON "customers"("source_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "customer_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

