-- Sync schema: User.userId + HR module + POS/Stock/SyncLog

PRAGMA foreign_keys=OFF;

-- User: email → userId (legacy column name)
DROP INDEX IF EXISTS "User_email_key";
ALTER TABLE "User" RENAME COLUMN "email" TO "userId";
CREATE UNIQUE INDEX IF NOT EXISTS "User_userId_key" ON "User"("userId");

-- User: HR relations
ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "User" ADD COLUMN "jobGradeId" TEXT;

-- POS & Stock
CREATE TABLE "PosTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL DEFAULT 'LBB',
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT,
    "transactionDate" DATETIME NOT NULL,
    "externalRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PosTransaction_externalRef_key" ON "PosTransaction"("externalRef");
CREATE INDEX "PosTransaction_transactionDate_idx" ON "PosTransaction"("transactionDate");
CREATE INDEX "PosTransaction_company_idx" ON "PosTransaction"("company");

CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "minQuantity" REAL NOT NULL DEFAULT 0,
    "currentQty" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "StockItem_company_idx" ON "StockItem"("company");

CREATE TABLE "StockOpname" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockItemId" TEXT NOT NULL,
    "countedQty" REAL NOT NULL,
    "countedBy" TEXT NOT NULL,
    "countedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "StockOpname_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PayrollPosting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "company" TEXT NOT NULL DEFAULT 'ALL',
    "totalAmount" REAL NOT NULL,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "postedBy" TEXT NOT NULL,
    "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PayrollPosting_year_month_company_key" ON "PayrollPosting"("year", "month", "company");

CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- HR master data
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "headNik" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Department_name_company_key" ON "Department"("name", "company");
CREATE INDEX "Department_company_idx" ON "Department"("company");

CREATE TABLE "JobGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "company" TEXT,
    "minSalary" REAL,
    "maxSalary" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "JobGrade_company_idx" ON "JobGrade"("company");

CREATE TABLE "Recruitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "applicantName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "Recruitment_status_idx" ON "Recruitment"("status");
CREATE INDEX "Recruitment_company_idx" ON "Recruitment"("company");

CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OnboardingTask_userId_idx" ON "OnboardingTask"("userId");

CREATE TABLE "EmploymentContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmploymentContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EmploymentContract_userId_idx" ON "EmploymentContract"("userId");

CREATE TABLE "BusinessTrip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "purpose" TEXT,
    "budget" REAL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BusinessTrip_userId_idx" ON "BusinessTrip"("userId");

CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "kpiNotes" TEXT,
    "reviewerNik" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PerformanceReview_userId_period_idx" ON "PerformanceReview"("userId", "period");

CREATE TABLE "BpjsEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bpjsKes" TEXT,
    "bpjsTk" TEXT,
    "kesEmployer" REAL NOT NULL DEFAULT 4,
    "kesEmployee" REAL NOT NULL DEFAULT 1,
    "tkEmployer" REAL NOT NULL DEFAULT 3.7,
    "tkEmployee" REAL NOT NULL DEFAULT 2,
    CONSTRAINT "BpjsEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BpjsEnrollment_userId_key" ON "BpjsEnrollment"("userId");

CREATE TABLE "Pph21Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "npwp" TEXT,
    "ptkpStatus" TEXT NOT NULL DEFAULT 'TK/0',
    "dependents" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Pph21Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Pph21Profile_userId_key" ON "Pph21Profile"("userId");

CREATE TABLE "ExitRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "resignDate" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clearanceNote" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExitRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ExitRequest_userId_idx" ON "ExitRequest"("userId");

PRAGMA foreign_keys=ON;
