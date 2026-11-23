-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "specification" TEXT;
ALTER TABLE "Asset" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Asset" ADD COLUMN "category" TEXT;
ALTER TABLE "Asset" ADD COLUMN "usageNote" TEXT;
