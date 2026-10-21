-- CreateTable
CREATE TABLE "invoice_pdfs" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "pdf_key" TEXT NOT NULL,
    "pdf_size" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "created_by_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pdfs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_pdfs_invoice_id_key" ON "invoice_pdfs"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoice_pdfs" ADD CONSTRAINT "invoice_pdfs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_pdfs" ADD CONSTRAINT "invoice_pdfs_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written CHECK constraint (Prisma does not model CHECK; later `migrate diff` keeps it).
-- A stored PDF is never empty: the row is written only after a successful render + upload.
ALTER TABLE "invoice_pdfs" ADD CONSTRAINT "invoice_pdfs_size_positive" CHECK ("pdf_size" > 0);
