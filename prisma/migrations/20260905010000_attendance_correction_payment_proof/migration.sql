-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "date" DATETIME NOT NULL,
    "requestedClockIn" TEXT,
    "requestedClockOut" TEXT,
    "reason" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceCorrection_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AttendanceCorrection_userId_date_idx" ON "AttendanceCorrection"("userId", "date");
CREATE INDEX "AttendanceCorrection_approvalStatus_idx" ON "AttendanceCorrection"("approvalStatus");

-- AlterTable
ALTER TABLE "FundRequest" ADD COLUMN "paymentProof" TEXT;
