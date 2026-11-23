/**
 * Impor / update karyawan dari src/lib/employees.ts tanpa menghapus data lain.
 * Usage: npx tsx scripts/import-employees.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { EMPLOYEES } from "../src/lib/employees";
import { generateNextNik, uniqueUserIdFromName } from "../src/lib/nik";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  }),
});

function normalizeName(name: string) {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

const COMPANY_SEED = [
  { code: "BCI", name: "Brown Cinnamons International", description: "PT BCI — Head Office", sortOrder: 1 },
  { code: "MKTECH", name: "Mumpuni Teknologi Kolaborasi", description: "PT MKTECH", sortOrder: 2 },
  { code: "MNT", name: "MNT", description: "PT MNT", sortOrder: 3 },
  { code: "DPI", name: "Deprezz Power Indonesia", description: "PT DPI", sortOrder: 4 },
  { code: "LBB", name: "Lha Baguette Bekasi", description: "PT LBB", sortOrder: 5 },
  { code: "PIC", name: "Pandawa Integra Consulting", description: "Konsultan Internal & Eksternal", sortOrder: 6 },
];

async function main() {
  for (const c of COMPANY_SEED) {
    await prisma.company.upsert({
      where: { code: c.code },
      create: { ...c, isActive: true },
      update: { isActive: true },
    });
    await prisma.companyPresensiConfig.upsert({
      where: { company: c.code },
      create: { company: c.code, workDaysPerMonth: 22 },
      update: {},
    });
  }

  const existing = await prisma.user.findMany({
    select: { nik: true, name: true, userId: true, company: true, jobTitle: true, role: true },
  });
  const byName = new Map(existing.map((u) => [normalizeName(u.name), u]));
  const usedUserIds = new Set(existing.map((u) => u.userId));
  const password = await bcrypt.hash("password123", 10);

  let created = 0;
  let updated = 0;

  for (const emp of EMPLOYEES) {
    const key = normalizeName(emp.name);
    const found = byName.get(key);

    if (found) {
      await prisma.user.update({
        where: { nik: found.nik },
        data: {
          name: emp.name,
          company: emp.company,
          jobTitle: emp.jobTitle,
          role: emp.role,
        },
      });
      updated++;
      continue;
    }

    // Coba cocokkan nama lama yang hampir sama (mis. "Ramdani" → "Ramdani ( Adam )")
    const partial = existing.find(
      (u) =>
        normalizeName(u.name).startsWith(normalizeName(emp.name).split(" ")[0]) &&
        u.company === emp.company &&
        !byName.has(key)
    );

    if (partial && !EMPLOYEES.some((e) => normalizeName(e.name) === normalizeName(partial.name))) {
      await prisma.user.update({
        where: { nik: partial.nik },
        data: {
          name: emp.name,
          company: emp.company,
          jobTitle: emp.jobTitle,
          role: emp.role,
        },
      });
      byName.set(key, { ...partial, name: emp.name });
      updated++;
      continue;
    }

    const nik = await generateNextNik(emp.company);
    const userId = uniqueUserIdFromName(emp.name, usedUserIds);

    await prisma.user.create({
      data: {
        nik,
        userId,
        name: emp.name,
        password,
        role: emp.role,
        company: emp.company,
        jobTitle: emp.jobTitle,
      },
    });

    const salaryDefault: Record<string, number> = {
      BCI: 5_000_000,
      LBB: 4_000_000,
      MKTECH: 6_000_000,
      MNT: 4_500_000,
      DPI: 5_500_000,
      PIC: 5_000_000,
    };
    const existingSalary = await prisma.userSalary.findFirst({ where: { userId: nik } });
    if (!existingSalary) {
      await prisma.userSalary.create({
        data: { userId: nik, gajiPokok: salaryDefault[emp.company] ?? 5_000_000 },
      });
    }

    created++;
    byName.set(key, { nik, name: emp.name, userId, company: emp.company, jobTitle: emp.jobTitle, role: emp.role });
  }

  // Set supervisor BCI STAFF → DIREKSI
  const direksi = await prisma.user.findFirst({ where: { company: "BCI", role: "DIREKSI" } });
  if (direksi) {
    await prisma.user.updateMany({
      where: { company: "BCI", role: "STAFF", supervisorId: null },
      data: { supervisorId: direksi.nik },
    });
  }

  console.log(`Import selesai — ${created} baru, ${updated} diupdate, total ${EMPLOYEES.length} karyawan.`);
  console.log("Password akun baru: password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
