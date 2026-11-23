/**
 * Tambah libur nasional 2026 + 2027 ke DB tanpa re-seed penuh.
 * Idempotent — lewati tanggal yang sudah ada.
 *
 * Usage (VPS):
 *   cd /var/www/superappsBCI && npm run db:seed-holidays
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ALL_NATIONAL_HOLIDAYS, toDateKey } from "../src/lib/holidays";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL tidak ada — cek file .env");
    process.exit(1);
  }
  console.log("Database:", dbUrl);

  const existing = await prisma.publicHoliday.findMany({ select: { date: true } });
  const existingKeys = new Set(existing.map((r) => toDateKey(r.date)));

  let added = 0;
  let skipped = 0;

  for (const h of ALL_NATIONAL_HOLIDAYS) {
    if (existingKeys.has(h.date)) {
      skipped += 1;
      continue;
    }
    await prisma.publicHoliday.create({
      data: { date: new Date(`${h.date}T12:00:00`), name: h.name },
    });
    existingKeys.add(h.date);
    added += 1;
  }

  const total = await prisma.publicHoliday.count();
  console.log(`Libur nasional: +${added} baru, ${skipped} sudah ada`);
  console.log(`Total di database: ${total} hari libur`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
