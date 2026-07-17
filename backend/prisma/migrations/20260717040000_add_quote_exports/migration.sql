-- CreateTable
CREATE TABLE "quote_exports" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_version_id" TEXT NOT NULL,
    "image_key" TEXT NOT NULL,
    "pdf_key" TEXT NOT NULL,
    "image_size" INTEGER NOT NULL,
    "pdf_size" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "created_by_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_exports_order_id_key" ON "quote_exports"("order_id");

-- CreateIndex
CREATE INDEX "quote_exports_order_version_id_idx" ON "quote_exports"("order_version_id");

-- AddForeignKey
ALTER TABLE "quote_exports" ADD CONSTRAINT "quote_exports_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_exports" ADD CONSTRAINT "quote_exports_order_version_id_fkey" FOREIGN KEY ("order_version_id") REFERENCES "order_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_exports" ADD CONSTRAINT "quote_exports_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

