-- Nền móng Epic 4 (Story 4.1, AD-6): ba bảng mới `orders` + `order_versions` +
-- `order_line_items`; KHÔNG đụng cột nào của bảng đã có (back-relation trên
-- accounts/customers/customer_sources/products chỉ ở tầng Prisma).
-- Sinh OFFLINE (không có Postgres cục bộ) bằng
-- `prisma migrate diff --from-schema <schema HEAD> --to-schema prisma/schema.prisma --script`
-- — mirror chiến lược migration của 2.3/2.4/2.7/2.8/3.1/3.2/3.3/3.4.
--
-- `order_versions` sở hữu TẤT CẢ line item; `orders.current_version_id` là con trỏ bản hiệu
-- lực (FK VÒNG với `order_versions.order_id` — tạo đơn là một transaction 3 bước id-sinh-trước).
-- `orders.source_id` là SNAPSHOT lúc TẠO copy từ `customers.source_id` (FR-35) — cột riêng,
-- KHÔNG join ngược về khách để đọc kênh.
-- `order_line_items.product_id` ON DELETE RESTRICT: dòng catalog phải trỏ được về Product thật
-- (Product soft-delete chính vì FK này); product_id NULL = dòng tự do.
-- Các cột snapshot giá (`unit_price_snapshot`/`catalog_price_snapshot`/`cost_price_snapshot`)
-- và `chot_at`/`vat_rate`/`warranty_start_at` tạo sẵn theo ERD, giữ NULL tới story sở hữu
-- hành vi (4.4/4.5/4.9/6.4).

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customer_sdt" TEXT NOT NULL,
    "current_version_id" TEXT,
    "owner_account_id" TEXT NOT NULL,
    "assignee_account_id" TEXT,
    "source_id" TEXT NOT NULL,
    "cust_type" TEXT NOT NULL,
    "scope_thiet_bi" BOOLEAN NOT NULL DEFAULT true,
    "scope_thi_cong" BOOLEAN NOT NULL DEFAULT false,
    "scope_van_chuyen" BOOLEAN NOT NULL DEFAULT false,
    "k_wp" INTEGER,
    "vat_mode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_versions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "vat_rate" INTEGER,
    "vat_mode" TEXT,
    "chot_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_items" (
    "id" TEXT NOT NULL,
    "order_version_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "price_editable" BOOLEAN NOT NULL DEFAULT false,
    "is_flexible" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "warranty_months" INTEGER,
    "unit_price_snapshot" INTEGER,
    "catalog_price_snapshot" INTEGER,
    "cost_price_snapshot" INTEGER,
    "warranty_start_at" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_current_version_id_key" ON "orders"("current_version_id");

-- CreateIndex
CREATE INDEX "orders_customer_sdt_idx" ON "orders"("customer_sdt");

-- CreateIndex
CREATE INDEX "orders_owner_account_id_idx" ON "orders"("owner_account_id");

-- CreateIndex
CREATE INDEX "orders_source_id_idx" ON "orders"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_versions_order_id_version_no_key" ON "order_versions"("order_id", "version_no");

-- CreateIndex
CREATE INDEX "order_line_items_order_version_id_idx" ON "order_line_items"("order_version_id");

-- CreateIndex
CREATE INDEX "order_line_items_product_id_idx" ON "order_line_items"("product_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_sdt_fkey" FOREIGN KEY ("customer_sdt") REFERENCES "customers"("sdt") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "order_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_owner_account_id_fkey" FOREIGN KEY ("owner_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignee_account_id_fkey" FOREIGN KEY ("assignee_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "customer_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_versions" ADD CONSTRAINT "order_versions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_version_id_fkey" FOREIGN KEY ("order_version_id") REFERENCES "order_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

