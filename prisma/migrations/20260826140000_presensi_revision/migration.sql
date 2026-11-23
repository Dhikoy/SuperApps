-- Presensi revision: leave types, office locations, overtime detail

CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "requiresAtasan" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "LeaveType_name_key" ON "LeaveType"("name");

CREATE TABLE "OfficeLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE "Overtime" ADD COLUMN "startTime" TEXT;
ALTER TABLE "Overtime" ADD COLUMN "endTime" TEXT;
ALTER TABLE "Overtime" ADD COLUMN "description" TEXT;
