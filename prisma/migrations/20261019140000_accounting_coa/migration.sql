-- AlterTable
ALTER TABLE "FundRequest" ADD COLUMN "paidFromAccount" TEXT;
ALTER TABLE "FundRequest" ADD COLUMN "realizedAmount" REAL;

-- AlterTable
ALTER TABLE "FundRequestItem" ADD COLUMN "accountCode" TEXT;

-- AlterTable
ALTER TABLE "IncomeEntry" ADD COLUMN "accountCode" TEXT;
ALTER TABLE "IncomeEntry" ADD COLUMN "cashAccount" TEXT;
ALTER TABLE "IncomeEntry" ADD COLUMN "posTransactionId" TEXT;

-- AlterTable
ALTER TABLE "PayrollPosting" ADD COLUMN "cashAccount" TEXT;

-- AlterTable
ALTER TABLE "PosTransaction" ADD COLUMN "accountCode" TEXT;
ALTER TABLE "PosTransaction" ADD COLUMN "cashAccount" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "normalBalance" TEXT NOT NULL,
    "isCash" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "company" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalLine_accountCode_fkey" FOREIGN KEY ("accountCode") REFERENCES "Account" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Account_group_idx" ON "Account"("group");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalEntry_company_idx" ON "JournalEntry"("company");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_source_sourceId_key" ON "JournalEntry"("source", "sourceId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountCode_date_idx" ON "JournalLine"("accountCode", "date");

-- CreateIndex
CREATE INDEX "JournalLine_company_date_idx" ON "JournalLine"("company", "date");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEntry_posTransactionId_key" ON "IncomeEntry"("posTransactionId");
