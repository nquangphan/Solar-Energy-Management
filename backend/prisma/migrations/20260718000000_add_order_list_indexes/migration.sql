-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_assignee_account_id_idx" ON "orders"("assignee_account_id");

