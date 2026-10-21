-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_order_version_id_stock_item_id_type_key" ON "stock_movements"("order_version_id", "stock_item_id", "type");

-- Hand-written CHECK constraint (Prisma does not model CHECK; later `migrate diff` keeps it).
-- `reserved = SUM(qty)` never filters by type, so each type must carry the right sign.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_qty_sign" CHECK (("type" = 'reserve' AND "qty" > 0) OR ("type" IN ('release', 'xuat') AND "qty" < 0));
