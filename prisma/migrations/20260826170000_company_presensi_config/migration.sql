-- Konfigurasi presensi per PT (perusahaan)

CREATE TABLE "CompanyPresensiConfig" (
    "company" TEXT NOT NULL PRIMARY KEY,
    "officeLocationId" TEXT,
    "workScheduleId" TEXT,
    "workDaysPerMonth" INTEGER NOT NULL DEFAULT 22
);

CREATE INDEX "CompanyPresensiConfig_officeLocationId_idx" ON "CompanyPresensiConfig"("officeLocationId");
CREATE INDEX "CompanyPresensiConfig_workScheduleId_idx" ON "CompanyPresensiConfig"("workScheduleId");
