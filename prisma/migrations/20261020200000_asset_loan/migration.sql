-- CreateTable
CREATE TABLE "AssetLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "homeAddress" TEXT,
    "contact" TEXT,
    "hrName" TEXT NOT NULL,
    "directorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signedPath" TEXT,
    "signedAt" DATETIME,
    "signedBy" TEXT,
    "returnedAt" DATETIME,
    "returnedBy" TEXT,
    "returnNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetLoan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetLoan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetLoanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "specification" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "previousWarehouse" TEXT,
    "previousUserId" TEXT,
    CONSTRAINT "AssetLoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "AssetLoan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetLoanItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetLoan_number_key" ON "AssetLoan"("number");

-- CreateIndex
CREATE INDEX "AssetLoan_status_idx" ON "AssetLoan"("status");

-- CreateIndex
CREATE INDEX "AssetLoan_borrowerId_idx" ON "AssetLoan"("borrowerId");

-- CreateIndex
CREATE INDEX "AssetLoanItem_loanId_idx" ON "AssetLoanItem"("loanId");

-- CreateIndex
CREATE INDEX "AssetLoanItem_assetId_idx" ON "AssetLoanItem"("assetId");
