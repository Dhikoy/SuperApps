import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDigitalAssetApi } from "@/lib/digital-asset-auth";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET() {
  const auth = await requireDigitalAssetApi();
  if (auth.error) return auth.error;

  const items = await prisma.digitalAsset.findMany({
    orderBy: [{ activeFrom: "desc" }, { serviceName: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireDigitalAssetApi();
  if (auth.error) return auth.error;

  const { serviceName, billingCycle, cost, activeFrom } = await request.json();
  if (!serviceName?.trim()) {
    return NextResponse.json({ error: "Nama layanan wajib diisi" }, { status: 400 });
  }
  if (!["BULANAN", "TAHUNAN"].includes(billingCycle)) {
    return NextResponse.json({ error: "Periode harus BULANAN atau TAHUNAN" }, { status: 400 });
  }
  const amount = Number(cost);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Biaya harus lebih dari 0" }, { status: 400 });
  }
  if (!activeFrom) {
    return NextResponse.json({ error: "Tanggal mulai aktif wajib diisi" }, { status: 400 });
  }

  const item = await prisma.digitalAsset.create({
    data: {
      serviceName: String(serviceName).trim(),
      billingCycle,
      cost: Math.round(amount),
      activeFrom: new Date(activeFrom),
    },
  });

  await writeAuditLog({
    actorId: auth.session!.nik,
    actorName: auth.session!.name,
    action: "CREATE",
    entity: "DigitalAsset",
    entityId: item.id,
    details: `${item.serviceName} · ${item.billingCycle} · ${item.cost}`,
  });

  return NextResponse.json(item, { status: 201 });
}
