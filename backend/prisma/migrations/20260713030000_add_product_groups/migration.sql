-- Gói vật tư (nền cho checklist báo giá). CHỈ thêm hai bảng mới `product_groups` +
-- `product_group_items`; KHÔNG đụng bảng đã có (bao gồm `products` — chỉ thêm back-relation ở
-- tầng Prisma, không đổi cột nào).
-- Sinh OFFLINE (không có Postgres cục bộ) bằng
-- `prisma migrate diff --from-schema <schema trước> --to-schema prisma/schema.prisma --script`
-- — mirror chiến lược migration của 2.3/2.4/2.7/2.8/3.1/3.2/3.3.
--
-- Gói là một CHECKLIST, không phải một sản phẩm: `product_group_items` CHỈ trỏ `product_id` +
-- thứ tự hiện. KHÔNG có cột số lượng mặc định và KHÔNG có cột giá — số lượng do người dùng gõ
-- lúc dựng báo giá, giá là giá của chính sản phẩm nhân số lượng, và không có giá trọn gói. Một
-- cột định mức ở đây là cửa mở cho BOM, thứ nằm ngoài phạm vi MVP.
--
-- Gói KHÔNG BAO GIỜ lưu lên Đơn (không snapshot, không in PDF) ⇒ không bảng nào FK vào
-- `product_groups` ngoài bảng item của chính nó ⇒ bảng này KHÔNG có dòng seed nào, và danh mục
-- gói bắt đầu RỖNG. Đó là chủ ý, không phải thiếu sót.
--
-- UNIQUE (`product_group_id`, `product_id`): một sản phẩm không nằm hai lần trong CÙNG một gói
-- (tick hai lần cùng một món là vô nghĩa). Một sản phẩm VẪN nằm được ở nhiều gói khác nhau.
-- ON DELETE CASCADE trên gói: item không có đời sống riêng ngoài gói của nó.
-- ON DELETE RESTRICT trên sản phẩm: xoá cứng một sản phẩm đang nằm trong gói bị CHẶN, kẻo
-- checklist trỏ vào hư không.
-- `display_order` INTEGER do SERVER gán (chỉ số trong mảng client gửi) — client không đánh số.

-- CreateTable
CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_group_items" (
    "id" TEXT NOT NULL,
    "product_group_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_groups_name_key" ON "product_groups"("name");

-- CreateIndex
CREATE INDEX "product_group_items_product_group_id_idx" ON "product_group_items"("product_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_group_items_product_group_id_product_id_key" ON "product_group_items"("product_group_id", "product_id");

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "product_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

