-- Hapus duplikat: 1 record terbaik per userId + tanggal (prioritas ada clock in)
DELETE FROM "Attendance"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "userId", "date"
        ORDER BY
          CASE WHEN "clockInTime" IS NOT NULL THEN 0 ELSE 1 END,
          CASE "status"
            WHEN 'HADIR' THEN 4
            WHEN 'TERLAMBAT' THEN 3
            WHEN 'IZIN' THEN 2
            WHEN 'ALPHA' THEN 1
            ELSE 0
          END DESC,
          "createdAt" ASC
      ) AS rn
    FROM "Attendance"
  )
  WHERE rn > 1
);

-- Hapus duplikat lintas timestamp (hari yang sama WIB, beda jam di kolom date)
DELETE FROM "Attendance"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY
          "userId",
          date(CAST("date" AS INTEGER) / 1000, 'unixepoch', '+7 hours')
        ORDER BY
          CASE WHEN "clockInTime" IS NOT NULL THEN 0 ELSE 1 END,
          CASE "status"
            WHEN 'HADIR' THEN 4
            WHEN 'TERLAMBAT' THEN 3
            WHEN 'IZIN' THEN 2
            WHEN 'ALPHA' THEN 1
            ELSE 0
          END DESC,
          "createdAt" ASC
      ) AS rn
    FROM "Attendance"
  )
  WHERE rn > 1
);

DROP INDEX IF EXISTS "Attendance_userId_date_key";
CREATE UNIQUE INDEX "Attendance_userId_date_key" ON "Attendance"("userId", "date");
