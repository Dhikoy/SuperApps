import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllAssets, hasPermission } from "@/lib/roles";
import { resolveAssetPhoto } from "@/lib/asset-photo";
import fs from "fs/promises";

function imageExtension(filename: string): "jpeg" | "png" | "gif" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".gif")) return "gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  return null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => String(id)).filter(Boolean).slice(0, 400)
    : [];

  const seeAll = canViewAllAssets(session.role);
  const assets = await prisma.asset.findMany({
    where: {
      ...(seeAll ? {} : { userId: session.id }),
      ...(ids.length ? { id: { in: ids } } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { serialNumber: "asc" },
  });

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const ordered = ids.length
    ? ids.flatMap((id: string) => {
        const asset = byId.get(id);
        return asset ? [asset] : [];
      })
    : assets;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Aset Fisik");
  sheet.columns = [
    { header: "Foto", key: "photo", width: 16 },
    { header: "Nama barang", key: "name", width: 32 },
    { header: "Kode", key: "code", width: 16 },
    { header: "Spesifikasi", key: "specification", width: 28 },
    { header: "Jumlah", key: "quantity", width: 10 },
    { header: "Jenis", key: "category", width: 18 },
    { header: "Kondisi", key: "condition", width: 28 },
    { header: "Lokasi", key: "location", width: 22 },
    { header: "Pemakaian", key: "usage", width: 28 },
    { header: "PIC", key: "pic", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (let index = 0; index < ordered.length; index += 1) {
    const asset = ordered[index];
    const rowNumber = index + 2;
    sheet.addRow({
      photo: "",
      name: asset.laptop,
      code: asset.serialNumber,
      specification: asset.specification ?? "",
      quantity: asset.quantity ?? 1,
      category: asset.category ?? "",
      condition: asset.condition,
      location: asset.warehouse,
      usage: asset.usageNote ?? "",
      pic: asset.user?.name ?? "",
    });
    sheet.getRow(rowNumber).height = 68;
    sheet.getCell(rowNumber, 3).numFmt = "@";

    if (!asset.photoPath) continue;
    const extension = imageExtension(asset.photoPath);
    const fullPath = resolveAssetPhoto(asset.photoPath);
    if (!extension || !fullPath) continue;
    try {
      const buffer = await fs.readFile(fullPath);
      const imageId = workbook.addImage({
        base64: buffer.toString("base64"),
        extension,
      });
      sheet.addImage(imageId, {
        tl: { col: 0.12, row: rowNumber - 1 + 0.08 },
        ext: { width: 92, height: 64 },
      });
    } catch {
      // Baris tetap diekspor meski file fotonya tidak terbaca.
    }
  }

  const file = Buffer.from(await workbook.xlsx.writeBuffer());
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aset-fisik-${stamp}.xlsx"`,
    },
  });
}
