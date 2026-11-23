-- AlterTable: Attendance clockOutTime
ALTER TABLE "Attendance" ADD COLUMN "clockOutTime" TEXT;

-- CreateTable: PayrollPolicy
CREATE TABLE "PayrollPolicy" (
    "company" TEXT NOT NULL PRIMARY KEY,
    "standardWorkDays" INTEGER NOT NULL,
    "salaryDivisor" INTEGER NOT NULL,
    "calculationMode" TEXT NOT NULL,
    "overtimeWeekday" REAL,
    "overtimeHoliday" REAL,
    "useNationalHoliday" BOOLEAN NOT NULL DEFAULT false,
    "workDaysPattern" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable: UserSalary
CREATE TABLE "UserSalary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gajiPokok" REAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSalary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "UserSalary_userId_idx" ON "UserSalary"("userId");

-- CreateTable: PublicHoliday
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL
);
CREATE UNIQUE INDEX "PublicHoliday_date_key" ON "PublicHoliday"("date");

-- CreateTable: Overtime
CREATE TABLE "Overtime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Overtime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Overtime_userId_date_idx" ON "Overtime"("userId", "date");
