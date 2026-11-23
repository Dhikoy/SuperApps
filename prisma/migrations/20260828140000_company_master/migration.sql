CREATE TABLE "Company" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Company" ("code", "name", "description", "sortOrder", "updatedAt") VALUES
  ('BCI', 'Brown Cinnamon Indonesia', 'PT BCI — Head Office', 1, CURRENT_TIMESTAMP),
  ('MKTECH', 'MKTECH', 'PT MKTECH', 2, CURRENT_TIMESTAMP),
  ('MNT', 'MNT', 'PT MNT', 3, CURRENT_TIMESTAMP),
  ('DPI', 'DPI', 'PT DPI', 4, CURRENT_TIMESTAMP),
  ('LBB', 'LBB', 'PT LBB', 5, CURRENT_TIMESTAMP),
  ('PIC', 'PIC', 'Konsultan Internal & Eksternal', 6, CURRENT_TIMESTAMP);
