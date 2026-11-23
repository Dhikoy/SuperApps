-- Staff MKTECH: presensi fleksibel (tanpa geofence, selfie + GPS tetap dicatat)
UPDATE "User" SET "flexibleAttendance" = 1 WHERE "company" = 'MKTECH' AND "role" <> 'SUPER_ADMIN';
