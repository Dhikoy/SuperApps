import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDigitalAssetApi } from "@/lib/digital-asset-auth";
import { writeAuditLog } from "@/lib/audit-log";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireDigitalAssetApi();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.digitalAsset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Aset digital tidak ditemukan" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.serviceName !== undefined) {
    const name = String(body.serviceName).trim();
    if (!name) return NextResponse.json({ error: "Nama layanan wajib diisi" }, { status: 400 });
    data.serviceName = name;
  }
  if (body.billingCycle !== undefined) {
    if (!["BULANAN", "TAHUNAN"].includes(body.billingCycle)) {
      return NextResponse.json({ error: "Periode harus BULANAN atau TAHUNAN" }, { status: 400 });
    }
    data.billingCycle = body.billingCycle;
  }
  if (body.cost !== undefined) {
    const amount = Number(body.cost);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Biaya harus lebih dari 0" }, { status: 400 });
    }
    data.cost = Math.round(amount);
  }
  if (body.activeFrom !== undefined) {
    data.activeFrom = new Date(body.activeFrom);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada data untuk diupdate" }, { status: 400 });
  }

  const item = await prisma.digitalAsset.update({ where: { id }, data });

  await writeAuditLog({
    actorId: auth.session!.nik,
    actorName: auth.session!.name,
    action: "UPDATE",
    entity: "DigitalAsset",
    entityId: id,
    details: item.serviceName,
  });

  return NextResponse.json(item);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireDigitalAssetApi();
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await prisma.digitalAsset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Aset digital tidak ditemukan" }, { status: 404 });
  }

  await prisma.digitalAsset.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.session!.nik,
    actorName: auth.session!.name,
    action: "DELETE",
    entity: "DigitalAsset",
    entityId: id,
    details: existing.serviceName,
  });

  return NextResponse.json({ ok: true });
}
