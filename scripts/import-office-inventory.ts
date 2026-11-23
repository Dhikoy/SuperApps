import "dotenv/config";
import { assetPhotoExists, assetPhotoFile } from "../src/lib/asset-photo";
import { prisma } from "../src/lib/prisma";
import { inventoryCode, OFFICE_INVENTORY } from "../src/lib/office-inventory";

function matchHolder(names: { nik: string; name: string }[], hint: string | null) {
  if (!hint) return null;
  const needle = hint.toLowerCase();
  const hits = names.filter((user) => user.name.toLowerCase().includes(needle));
  return hits.length === 1 ? hits[0].nik : null;
}

async function main() {
  const users = await prisma.user.findMany({ select: { nik: true, name: true } });
  let created = 0;
  let updated = 0;
  let photos = 0;

  for (const row of OFFICE_INVENTORY) {
    const serialNumber = inventoryCode(row.no);
    const userId = matchHolder(users, row.holderHint);
    const photoPath = (await assetPhotoExists(serialNumber)) ? assetPhotoFile(serialNumber) : null;
    const data = {
      laptop: row.name,
      condition: row.condition,
      warehouse: row.location,
      specification: row.specification,
      quantity: row.quantity,
      category: row.category,
      usageNote: row.usageNote,
      photoPath,
      userId,
    };
    const existing = await prisma.asset.findUnique({ where: { serialNumber } });
    if (existing) {
      if (photoPath && existing.photoPath !== photoPath) {
        await prisma.asset.update({ where: { id: existing.id }, data: { photoPath } });
        photos += 1;
      }
      updated += 1;
      continue;
    }
    await prisma.asset.create({ data: { ...data, serialNumber } });
    if (photoPath) photos += 1;
    created += 1;
  }

  console.log(
    `Inventaris kantor: ${created} baru, ${updated} sudah ada, ${photos} foto, total ${OFFICE_INVENTORY.length}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
