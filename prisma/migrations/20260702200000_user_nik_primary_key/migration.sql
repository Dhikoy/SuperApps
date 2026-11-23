-- Migration: User primary key changed from id to nik
-- Fresh schema for SQLite (dev reset)

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "Task";
DROP TABLE IF EXISTS "Attendance";
DROP TABLE IF EXISTS "LeaveRequest";
DROP TABLE IF EXISTS "Asset";
DROP TABLE IF EXISTS "WorkSchedule";
DROP TABLE IF EXISTS "User";

CREATE TABLE "User" (
    "nik" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "company" TEXT,
    "jobTitle" TEXT,
    "supervisorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("nik") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "laptop" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset"("serialNumber");

CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "remarks" TEXT,
    "documentAttachment" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "atasanApprovedBy" TEXT,
    "atasanApprovedAt" DATETIME,
    "hrdApprovedBy" TEXT,
    "hrdApprovedAt" DATETIME,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftName" TEXT NOT NULL,
    "standardClockIn" TEXT NOT NULL,
    "standardClockOut" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jamKerjaId" TEXT,
    "date" DATETIME NOT NULL,
    "clockInTime" TEXT,
    "selfieImage" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "status" TEXT NOT NULL DEFAULT 'HADIR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_jamKerjaId_fkey" FOREIGN KEY ("jamKerjaId") REFERENCES "WorkSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROSES',
    "assigneeId" TEXT,
    "attendanceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("nik") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

PRAGMA foreign_keys=ON;
