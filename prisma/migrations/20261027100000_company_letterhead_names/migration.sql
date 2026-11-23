-- Nama PT di master Company menjadi sumber KOP dokumen keuangan.
-- Hanya mengisi nama yang masih berupa kode (belum diubah HR).
UPDATE "Company" SET "name" = 'Brown Cinnamons International', "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "code" = 'BCI' AND "name" IN ('BCI', 'Brown Cinnamon Indonesia');
UPDATE "Company" SET "name" = 'Lha Baguette Bekasi', "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "code" = 'LBB' AND "name" = 'LBB';
UPDATE "Company" SET "name" = 'Pandawa Integra Consulting', "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "code" = 'PIC' AND "name" = 'PIC';
UPDATE "Company" SET "name" = 'Mumpuni Teknologi Kolaborasi', "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "code" = 'MKTECH' AND "name" = 'MKTECH';
UPDATE "Company" SET "name" = 'Deprezz Power Indonesia', "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "code" = 'DPI' AND "name" = 'DPI';

-- PT yang sebelumnya hanya ada di daftar KOP invoice
INSERT OR IGNORE INTO "Company" ("code", "name", "description", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('ZEN', 'ZEN Event Organizers', 'PT ZEN', true, 7, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('AMS', 'Arah Makkah Safaran', 'PT AMS', true, 8, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('YKPN', 'YKPN', 'YKPN', true, 9, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
