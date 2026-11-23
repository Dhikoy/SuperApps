-- CreateTable
CREATE TABLE "EmployeePenalty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdByNik" TEXT NOT NULL,
    "updatedByNik" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "EmployeePenalty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePenalty_createdByNik_fkey" FOREIGN KEY ("createdByNik") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePenalty_updatedByNik_fkey" FOREIGN KEY ("updatedByNik") REFERENCES "User" ("nik") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PenaltyPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "ratePerPoint" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "rateSetBy" TEXT,
    "lockedBy" TEXT,
    "rateSetAt" DATETIME,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "EmployeePenalty_userId_date_idx" ON "EmployeePenalty"("userId", "date");

-- CreateIndex
CREATE INDEX "EmployeePenalty_company_date_idx" ON "EmployeePenalty"("company", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PenaltyPeriod_company_period_key" ON "PenaltyPeriod"("company", "period");

-- CreateIndex
CREATE INDEX "PenaltyPeriod_period_idx" ON "PenaltyPeriod"("period");
