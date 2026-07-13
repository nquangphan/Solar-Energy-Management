-- Giá phân tầng sau cờ (FR-15). CHỈ thêm hai bảng mới `product_prices` + `feature_flags`;
-- KHÔNG đụng bảng đã có (bao gồm `products` — chỉ thêm back-relation ở tầng Prisma, không
-- đổi cột nào).
-- Sinh OFFLINE (không có Postgres cục bộ) bằng
-- `prisma migrate diff --from-schema <schema trước> --to-schema prisma/schema.prisma --script`
-- — mirror chiến lược migration của 2.3/2.4/2.7/2.8/3.1.
--
-- `min_qty` INTEGER: bậc thang theo SỐ LƯỢNG (mua từ N trở lên ăn mức này), KHÔNG theo loại
-- khách — `Customer` chưa tồn tại và ERD spine khoá theo số lượng.
-- Bất biến `min_qty >= 2` ràng ở TẦNG APP (DTO), không phải CHECK constraint: giá gốc
-- `products.price` chính là mức `min_qty = 1` ngầm định.
-- `price` INTEGER đồng, KHÔNG numeric/float (AD-10/AD-16).
-- UNIQUE (`product_id`, `min_qty`): một sản phẩm không thể có hai mức cho cùng một ngưỡng.
-- ON DELETE CASCADE: bậc thang là nguồn phân giải lúc đọc, không phải dữ liệu lịch sử — đơn
-- đã chốt giữ giá snapshot riêng nên xoá bậc thang không mồ côi gì.
--
-- `feature_flags`: khoá chính LÀ tên cờ (không có id uuid riêng). Vắng dòng = cờ TẮT
-- (fail-closed) ⇒ KHÔNG có dòng seed nào ở đây, và điều đó là CỐ Ý: bật cờ = upsert.

-- CreateTable
CREATE TABLE "product_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "product_prices_product_id_idx" ON "product_prices"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_prices_product_id_min_qty_key" ON "product_prices"("product_id", "min_qty");

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
