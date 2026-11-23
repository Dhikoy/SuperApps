-- CreateTable FundRequest
CREATE TABLE "FundRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "paidBy" TEXT,
    "paidAt" DATETIME,
    "paymentRef" TEXT,
    "realizedBy" TEXT,
    "realizedAt" DATETIME,
    "realizationNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FundRequest_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FundRequest_status_idx" ON "FundRequest"("status");
CREATE INDEX "FundRequest_company_idx" ON "FundRequest"("company");

CREATE TABLE "FundRequestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fundRequestId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "FundRequestItem_fundRequestId_fkey" FOREIGN KEY ("fundRequestId") REFERENCES "FundRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IncomeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "entryDate" DATETIME NOT NULL,
    "remarks" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "IncomeEntry_entryDate_idx" ON "IncomeEntry"("entryDate");
CREATE INDEX "IncomeEntry_company_idx" ON "IncomeEntry"("company");
