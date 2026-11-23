import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllAssets, hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { formatAssetCode, isValidAssetPrefix, nextAssetSeq } from "@/lib/asset-code";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const seeAll = canViewAllAssets(session.role);
  const assets = await prisma.asset.findMany({
    where: seeAll ? undefined : { userId: session.id },
    include: { user: { select: { name: true, nik: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assets);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const laptop = String(body.laptop ?? "");
  const condition = String(body.condition ?? "");
  const warehouse = String(body.warehouse ?? "");
  const quantity = Number(body.quantity ?? 1);
  const autoPrefix = String(body.codePrefix ?? "").toUpperCase();
  const autoCode = body.autoCode === true && isValidAssetPrefix(autoPrefix);
  const manualCode = String(body.serialNumber ?? "").trim();
  if (!laptop.trim() || (!autoCode && !manualCode) || !condition.trim() || !warehouse.trim()) {
    return NextResponse.json({ error: "Nama, kode, kondisi, dan lokasi wajib diisi" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Jumlah harus bilangan bulat minimal 1" }, { status: 400 });
  }

  const data = {
    laptop: laptop.trim(),
    condition: condition.trim(),
    warehouse: warehouse.trim(),
    specification: String(body.specification ?? "").trim() || null,
    category: String(body.category ?? "").trim() || null,
    usageNote: String(body.usageNote ?? "").trim() || null,
    quantity,
    userId: body.userId || null,
  };

  let asset;
  for (let attempt = 0; ; attempt++) {
    let serialNumber = manualCode;
    if (autoCode) {
      const existing = await prisma.asset.findMany({
        where: { serialNumber: { startsWith: `${autoPrefix}-INV-` } },
        select: { serialNumber: true },
      });
      serialNumber = formatAssetCode(autoPrefix, nextAssetSeq(existing.map((a) => a.serialNumber), autoPrefix));
    }
    try {
      asset = await prisma.asset.create({
        data: { ...data, serialNumber },
        include: { user: { select: { name: true } } },
      });
      break;
    } catch (err) {
      const duplicate = (err as { code?: string }).code === "P2002";
      if (duplicate && autoCode && attempt < 3) continue;
      if (duplicate) {
        return NextResponse.json({ error: `Kode ${serialNumber} sudah dipakai aset lain` }, { status: 400 });
      }
      throw err;
    }
  }

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "CREATE",
    entity: "Asset",
    entityId: asset.id,
    details: asset.serialNumber,
  });

  return NextResponse.json(asset, { status: 201 });
}
