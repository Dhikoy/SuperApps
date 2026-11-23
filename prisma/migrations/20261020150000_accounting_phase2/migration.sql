-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "company" TEXT;
ALTER TABLE "Asset" ADD COLUMN "acquisitionCost" REAL;
ALTER TABLE "Asset" ADD COLUMN "acquisitionDate" DATETIME;
ALTER TABLE "Asset" ADD COLUMN "usefulLifeMonths" INTEGER;
ALTER TABLE "Asset" ADD COLUMN "residualValue" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Asset" ADD COLUMN "assetAccount" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "accountCode" TEXT;

-- AlterTable
ALTER TABLE "PayrollPosting" ADD COLUMN "withholding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PayrollPosting" ADD COLUMN "breakdown" TEXT;

-- CreateTable
CREATE TABLE "AccountingSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "company" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_accountCode_fkey" FOREIGN KEY ("accountCode") REFERENCES "Account" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_year_month_company_accountCode_key" ON "Budget"("year", "month", "company", "accountCode");

-- CreateIndex
CREATE INDEX "Budget_year_company_idx" ON "Budget"("year", "company");
