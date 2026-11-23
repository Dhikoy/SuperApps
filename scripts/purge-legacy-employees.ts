/**
 * Hapus karyawan legacy yang tidak ada di daftar resmi (src/lib/employees.ts).
 * Usage: npm run db:purge-legacy-employees
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { deleteUserWithRelations } from "../src/lib/delete-user";
import { EMPLOYEES } from "../src/lib/employees";

function normalizeName(name: string) {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

async function main() {
  const official = new Set(EMPLOYEES.map((e) => normalizeName(e.name)));
  const users = await prisma.user.findMany({
    select: { nik: true, name: true, userId: true, role: true },
    orderBy: { name: "asc" },
  });

  const legacy = users.filter(
    (u) => u.role !== "SUPER_ADMIN" && !official.has(normalizeName(u.name))
  );

  if (legacy.length === 0) {
    console.log("Tidak ada karyawan legacy untuk dihapus.");
    return;
  }

  console.log(`Menghapus ${legacy.length} karyawan legacy:`);
  for (const u of legacy) {
    console.log(`- ${u.name} (${u.userId})`);
    await deleteUserWithRelations(u.nik);
  }

  console.log("Selesai.");
}

main()
  .catch((err) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
