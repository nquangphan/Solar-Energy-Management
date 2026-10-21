-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "percent" INTEGER,
    "amount" INTEGER NOT NULL,
    "condition_note" TEXT NOT NULL,
    "milestone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedules_order_id_key" ON "payment_schedules"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "installments_schedule_id_seq_key" ON "installments"("schedule_id", "seq");

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Hand-written CHECK constraints (Prisma does not model CHECK; later `migrate diff` keeps them).
-- `amount > 0` turns "the first installment cannot be 0" into a DB invariant, not just an app promise.
ALTER TABLE "installments" ADD CONSTRAINT "installments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "installments" ADD CONSTRAINT "installments_percent_range" CHECK ("percent" IS NULL OR "percent" BETWEEN 1 AND 100);
ALTER TABLE "installments" ADD CONSTRAINT "installments_seq_positive" CHECK ("seq" >= 1);
ALTER TABLE "installments" ADD CONSTRAINT "installments_milestone_known" CHECK ("milestone" IS NULL OR "milestone" IN ('coc', 'tat_toan'));
