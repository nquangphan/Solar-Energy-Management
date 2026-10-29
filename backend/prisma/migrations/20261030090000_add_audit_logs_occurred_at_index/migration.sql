-- The audit screen sorts and filters on the business instant; the table grows with every action.
-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");
