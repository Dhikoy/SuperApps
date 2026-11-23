-- Role IT: staff MKTECH (akses penuh kecuali gaji karyawan)
UPDATE "User" SET "role" = 'IT' WHERE "company" = 'MKTECH' AND "role" NOT IN ('SUPER_ADMIN', 'IT');
