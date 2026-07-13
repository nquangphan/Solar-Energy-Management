-- Danh mục vật tư (FR-14). CHỈ thêm bảng mới `products`; KHÔNG đụng bảng đã có
-- (`accounts`/`sessions`/`account_permissions`/`audit_logs`/`password_reset_codes`).
-- Sinh OFFLINE (không có Postgres cục bộ) bằng
-- `prisma migrate diff --from-schema <schema trước> --to-schema prisma/schema.prisma --script`
-- — mirror chiến lược migration của 2.3/2.4/2.7/2.8.
--
-- Tiền là INTEGER đồng (`price`, `cost_price`), KHÔNG numeric/float: làm tròn phải là
-- quyết định nghiệp vụ tường minh (AD-10/AD-16).
-- `warranty_months` nullable CÓ CHỦ ĐÍCH — công lắp / phí lắp đặt không có bảo hành.
-- `sku` UNIQUE: mã tra cứu duy nhất của vật tư.

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "cost_price" INTEGER NOT NULL,
    "tracks_stock" BOOLEAN NOT NULL DEFAULT true,
    "price_editable" BOOLEAN NOT NULL DEFAULT false,
    "warranty_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
