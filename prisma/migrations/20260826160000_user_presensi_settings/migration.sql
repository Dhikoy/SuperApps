-- Pengaturan presensi per karyawan: kantor + jadwal shift

ALTER TABLE "User" ADD COLUMN "officeLocationId" TEXT;
ALTER TABLE "User" ADD COLUMN "workScheduleId" TEXT;

CREATE INDEX "User_officeLocationId_idx" ON "User"("officeLocationId");
CREATE INDEX "User_workScheduleId_idx" ON "User"("workScheduleId");
