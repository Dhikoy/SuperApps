-- Task per PT + detail + status baru
ALTER TABLE "Task" ADD COLUMN "description" TEXT;
ALTER TABLE "Task" ADD COLUMN "company" TEXT NOT NULL DEFAULT 'BCI';

UPDATE "Task" SET "status" = 'DONE' WHERE "status" = 'SELESAI';
UPDATE "Task" SET "status" = 'PROSES' WHERE "status" = 'TELAT';

CREATE INDEX "Task_company_idx" ON "Task"("company");
