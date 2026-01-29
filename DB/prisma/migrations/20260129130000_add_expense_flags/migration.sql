-- AlterTable
ALTER TABLE "Expense"
  ADD COLUMN "importance" TEXT DEFAULT '',
  ADD COLUMN "isRefund" BOOLEAN NOT NULL DEFAULT false;
