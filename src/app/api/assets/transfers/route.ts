import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";

function fromLabel(asset: { warehouse: string; user: { name: string } | null }) {
  if (asset.user && asset.user.name !== asset.warehouse) {
    return `${asset.warehouse} (${asset.user.name})`;
  }
  return asset.warehouse;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.assetTransfer.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { toUser: { select: { name: true, nik: true } } },
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const assetId = String(body.assetId ?? "");
  const toUserId = String(body.toUserId ?? "");
  const condition = String(body.condition ?? "").trim();
  if (!assetId || !toUserId) {
    return NextResponse.json({ error: "Pilih barang dan tujuan" }, { status: 400 });
  }
  if (!condition) {
    return NextResponse.json({ error: "Kondisi barang wajib diisi" }, { status: 400 });
  }

  const [asset, toUser] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: assetId },
      include: { user: { select: { name: true, nik: true } } },
    }),
    prisma.user.findUnique({ where: { nik: toUserId }, select: { nik: true, name: true } }),
  ]);
  if (!asset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });
  if (!toUser) return NextResponse.json({ error: "Karyawan tujuan tidak ditemukan" }, { status: 400 });
  if (asset.userId === toUser.nik && asset.warehouse === toUser.name) {
    return NextResponse.json({ error: "Barang sudah berada pada karyawan ini" }, { status: 400 });
  }

  const data = {
    assetName: asset.laptop,
    serialNumber: asset.serialNumber,
    condition,
    fromLocation: fromLabel(asset),
    fromUserId: asset.userId,
    toUserId: toUser.nik,
    toLocation: toUser.name,
  };

  const pending = await prisma.assetTransfer.findFirst({
    where: { assetId: asset.id, status: "pending" },
  });
  const transfer = pending
    ? await prisma.assetTransfer.update({
        where: { id: pending.id },
        data,
        include: { toUser: { select: { name: true, nik: true } } },
      })
    : await prisma.assetTransfer.create({
        data: { ...data, assetId: asset.id, createdById: session.nik },
        include: { toUser: { select: { name: true, nik: true } } },
      });

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: pending ? "UPDATE" : "CREATE",
    entity: "AssetTransfer",
    entityId: transfer.id,
    details: `${asset.serialNumber} -> ${toUser.name}`,
  });

  return NextResponse.json(transfer, { status: pending ? 200 : 201 });
}
