-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "allowance" REAL NOT NULL DEFAULT 0,
    "mealAllowance" REAL NOT NULL DEFAULT 0,
    "deduction" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PayrollAdjustment_year_month_idx" ON "PayrollAdjustment"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAdjustment_userId_year_month_key" ON "PayrollAdjustment"("userId", "year", "month");

-- Lembur hari kerja mengikuti sheet payroll (x1)
UPDATE "PayrollPolicy" SET "overtimeWeekday" = 1.0 WHERE "overtimeWeekday" = 1.5;

-- Aturan payroll PIC
INSERT OR IGNORE INTO "PayrollPolicy" ("company", "standardWorkDays", "salaryDivisor", "calculationMode", "overtimeWeekday", "overtimeHoliday", "useNationalHoliday", "workDaysPattern", "description")
VALUES ('PIC', 22, 173, 'HOURLY', 1.0, 2.0, true, 'MON_FRI', 'Konsultan PIC. Senin–Jumat, libur nasional. Gaji pokok penuh + lembur (÷173 jam).');
