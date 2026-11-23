/**
 * Upsert leave types & office locations tanpa menghapus data user.
 * Jalankan: npx tsx deploy/vps-seed-presensi-config.ts
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:/var/lib/superappsBCI/superappsBCI.db",
});
const prisma = new PrismaClient({ adapter });

const leaveTypes = [
  { name: "Cuti Tahunan", requiresAtasan: true, sortOrder: 1 },
  { name: "Cuti Melahirkan", requiresAtasan: true, sortOrder: 2 },
  { name: "Cuti Penting", requiresAtasan: true, sortOrder: 3 },
  { name: "Sakit", requiresAtasan: false, sortOrder: 4 },
  { name: "Izin Terlambat", requiresAtasan: false, sortOrder: 5 },
];

const offices = [
  { name: "Kantor BCI Jakarta Pusat", address: "Jakarta Pusat", latitude: -6.2088, longitude: 106.8456, radiusMeters: 100 },
  { name: "Kantor BCI Bekasi", address: "Bekasi", latitude: -6.2383, longitude: 106.9756, radiusMeters: 100 },
  { name: "Kantor BCI Tangerang", address: "Tangerang", latitude: -6.1783, longitude: 106.6319, radiusMeters: 100 },
];

async function main() {
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      create: lt,
      update: { requiresAtasan: lt.requiresAtasan, sortOrder: lt.sortOrder, isActive: true },
    });
  }

  for (const office of offices) {
    const existing = await prisma.officeLocation.findFirst({ where: { name: office.name } });
    if (existing) {
      await prisma.officeLocation.update({
        where: { id: existing.id },
        data: { ...office, isActive: true },
      });
    } else {
      await prisma.officeLocation.create({ data: office });
    }
  }

  const ltCount = await prisma.leaveType.count();
  const officeCount = await prisma.officeLocation.count();
  console.log(`Konfigurasi presensi OK — ${ltCount} jenis cuti, ${officeCount} lokasi kantor.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
