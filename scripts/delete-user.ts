/**
 * Hapus karyawan lewat CLI (untuk VPS / troubleshooting).
 * Usage: npm run db:delete-user -- haidar
 *        npm run db:delete-user -- 01202600000004
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { deleteUserWithRelations } from "../src/lib/delete-user";

async function main() {
  const id = process.argv[2]?.trim();
  if (!id) {
    console.error("Usage: npm run db:delete-user -- <userId atau nik>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ userId: id.toLowerCase() }, { nik: id }],
    },
    select: { nik: true, userId: true, name: true, role: true },
  });

  if (!user) {
    console.error(`Karyawan tidak ditemukan: ${id}`);
    process.exit(1);
  }

  console.log(`Menghapus: ${user.name} (${user.userId} / ${user.nik}) [${user.role}]`);
  await deleteUserWithRelations(user.nik);

  const check = await prisma.user.findUnique({ where: { nik: user.nik } });
  if (check) {
    console.error("GAGAL — user masih ada di database.");
    process.exit(1);
  }

  console.log("Berhasil dihapus.");
}

main()
  .catch((err) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
